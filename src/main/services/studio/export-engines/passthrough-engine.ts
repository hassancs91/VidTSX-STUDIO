/**
 * Engine 2 — the passthrough hybrid (docs/export-engines-plan.md Stage 2).
 *
 * Spans that are plain cuts of a video asset are COPIED: the full ffmpeg's
 * hardware decoder → the nearest-pts select → scale → the hardware encoder,
 * with T1's frame-mapping rule (condition 1). Everything else is rendered by
 * the browser exactly as the standard engine renders it, one frame early, and
 * re-encoded by our ffmpeg with the copied spans' settings (conditions 2, 4).
 * Gaps are black. The pieces are MPEG-TS video-only intermediates joined by
 * stream copy (condition 3) — by the finishing mux itself, which reads the
 * concat list as its video input (Stage 4: no joined intermediate, one write
 * of the output); the audio is one ffmpeg pass over the whole timeline
 * (slice 4: every document the planner reads — gains, fades, transitions,
 * tracks and speed — is planned; the standard path is only the fallback for
 * an empty plan), mixed and AAC-encoded beside the pieces
 * (`passthrough-audio.ts`, Stage 4) and handed to the finishing stage as
 * `audioPath`.
 *
 * It never steps aside (D4): a timeline with nothing to copy still runs here,
 * with every frame through the browser and a note saying so.
 *
 * Every count is checked, never assumed: each piece's frame count here, the
 * finished file's frame count in the finishing stage (`frames` on the
 * product). A mismatch fails the export loudly — a silently wrong frame is
 * the one outcome T1 forbids.
 */
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../../logging/log-engine';
import { copiedPercent, planExportSpans, type ExportSpan, type ExportSpanPlan } from '../../../../shared/studio/export-spans';
import { runFfmpeg } from '../ffmpeg-bin';
import { getFfmpegFullBinary, probeProxyEncoders } from '../ffmpeg-full';
import { PROXY_GPU_ENCODERS, chooseProxyEncoder, type ProxyGpuEncoder } from '../proxy-encoders';
import { producePassthroughAudio } from './passthrough-audio';
import { renderBrowserSpan } from './passthrough-browser';
import {
  ENCODER_NAMES,
  blackSpanArgs,
  browserSpanArgs,
  concatListText,
  copyQualityForCrf,
  copySpanArgs,
  holdLastFrameArgs,
  isConstantFrameRate,
  parseStatsFrame,
} from './passthrough-ffmpeg';
import { exportOutputSize } from './output-size';
import { ffprobeBeside, probeSource, type SourceProbe } from './passthrough-probe';
import { ticksPerFrame } from './passthrough-slow';
import { progressMessage, type SpanTiming } from './passthrough-progress';
import type { ExportEngine, ExportEngineInput, ExportEngineProduct } from './types';

const log = logEngine.createLogger('PassthroughEngine');

/** D2/D4 wording for the greyed-out picker row. */
export const NEEDS_DOWNLOAD =
  'Needs the GPU encoder download: Settings › Rendering › "Faster proxy generation (GPU encoder)" › Download.';
export const NO_WORKING_ENCODER =
  'The GPU encoder download is installed, but no supported hardware encoder works on this machine (NVIDIA, Intel Quick Sync or AMD needed).';
/** D4: shown in the queue while a nothing-to-copy timeline renders. */
export const NOTHING_TO_COPY_MESSAGE = 'Nothing on this timeline can be copied — rendering every frame, as the standard export does.';

/** A copy piece short by this many frames at most holds its last frame (the stream ended before its container). */
const HOLD_LAST_FRAME_MAX = 3;

/**
 * Development override (docs/export-engines-qsv-amf-runbook.md): the name of
 * one encoder to use INSTEAD of the preferred one — only if the probe found
 * it working on this machine; anything else is ignored. The way to exercise
 * the QSV or AMF copy path on a machine that also has NVENC.
 */
export const EXPORT_GPU_ENCODER_ENV = 'VIDTSX_EXPORT_GPU_ENCODER';

/** The full build's binaries and the working encoder — shared with the shot-composite engine (Engine 3). */
export interface Tools {
  ffmpeg: string;
  ffprobe: string;
  encoder: ProxyGpuEncoder;
}

/** The preferred working encoder, or the override when it names a working one. */
export function pickExportEncoder(working: readonly ProxyGpuEncoder[], forced: string | undefined): ProxyGpuEncoder | null {
  if (forced && (PROXY_GPU_ENCODERS as readonly string[]).includes(forced) && working.includes(forced as ProxyGpuEncoder)) {
    return forced as ProxyGpuEncoder;
  }
  return chooseProxyEncoder(working);
}

export async function resolveTools(): Promise<Tools | { reason: string }> {
  const ffmpeg = await getFfmpegFullBinary();
  if (!ffmpeg) return { reason: NEEDS_DOWNLOAD };
  const probe = await probeProxyEncoders(ffmpeg);
  const forced = process.env[EXPORT_GPU_ENCODER_ENV];
  const encoder = pickExportEncoder(probe.working, forced);
  if (!encoder) return { reason: NO_WORKING_ENCODER };
  if (forced) log.info('Export encoder override', { requested: forced, working: probe.working, using: encoder });
  return { ffmpeg, ffprobe: ffprobeBeside(ffmpeg), encoder };
}

export const passthroughExportEngine: ExportEngine = {
  id: 'passthrough',

  async availability() {
    const tools = await resolveTools();
    return 'reason' in tools ? { available: false, reason: tools.reason } : { available: true };
  },

  async produce(input: ExportEngineInput): Promise<ExportEngineProduct> {
    const { project, entry, workDir, color, signal } = input;
    const tools = await resolveTools();
    if ('reason' in tools) throw new Error(tools.reason);
    input.onEncoderResolved?.({ encoderName: ENCODER_NAMES[tools.encoder], hardwareAccelerated: true });

    const plan = planExportSpans(project, entry.durationInFrames);
    if (plan.totalFrames !== entry.durationInFrames) {
      throw new Error(`The span plan covers ${plan.totalFrames} frames but the export has ${entry.durationInFrames}.`);
    }
    const sources = await probeCopiedSources(tools, plan, entry, signal);
    const quality = copyQualityForCrf(input.render.crf, tools.encoder);
    const message = plan.copiedFrames === 0 ? NOTHING_TO_COPY_MESSAGE : undefined;
    log.info('Span plan', { jobId: input.jobId, percent: copiedPercent(plan), spans: plan.spans.map((s) => `${s.kind}:${s.from}+${s.frames}`) });

    // The audio starts now and runs beside the pieces (Stage 4); a failure
    // there stops the next piece rather than waiting for the last one. The
    // rejection is observed here so nothing is unhandled while the loop runs.
    // The product is the concat list of the pieces: the finishing mux reads
    // it as its video input (no joined intermediate, one write of the output).
    const listPath = path.join(workDir, 'spans.txt');
    let audioError: Error | null = null;
    const audioWork = producePassthroughAudio(input, tools.ffmpeg, listPath);
    audioWork.catch((err: unknown) => { audioError = err instanceof Error ? err : new Error(String(err)); });

    // 1. Pieces, in order. The progress line names the copied share, the span
    // in flight and an estimate from this export's own measured rates (Stage 4);
    // the D4 notice stands in for it when nothing can be copied.
    const pieces: Array<{ path: string; frames: number }> = [];
    const timings: SpanTiming[] = [];
    let framesDone = 0;
    let spanIndex = 0;
    const progress = (extra: number) => input.onProgress({
      framesDone: framesDone + extra,
      totalFrames: plan.totalFrames,
      message: message ?? progressMessage({ spans: plan.spans, index: spanIndex, framesInSpan: extra, done: timings, fps: entry.fps }),
    });
    progress(0);
    for (const [i, span] of plan.spans.entries()) {
      if (audioError) throw audioError;
      spanIndex = i;
      let piecePath = path.join(workDir, `span-${String(i).padStart(4, '0')}.ts`);
      const startedAt = Date.now();
      await producePiece(input, tools, sources, span, i, piecePath, progress);
      let expected = span.frames;
      let count = await countPackets(tools.ffprobe, piecePath, signal);
      if (count !== expected && span.kind === 'copy') {
        // The source's video stream ended before its container (the select ran
        // out of frames by a frame or two): hold the last frame, as the browser
        // does past a video's end.
        const missing = expected - count;
        if (count > 0 && missing > 0 && missing <= HOLD_LAST_FRAME_MAX) {
          const tailPath = piecePath.replace(/\.ts$/, '-tail.ts');
          await runFfmpeg(tools.ffmpeg, holdLastFrameArgs({ encoder: tools.encoder, quality, inputPath: piecePath, lastFrame: count - 1, frames: missing, fps: entry.fps, color, outputPath: tailPath }), { signal });
          if ((await countPackets(tools.ffprobe, tailPath, signal)) === missing) {
            log.info('Held the last source frame at a clip tail', { jobId: input.jobId, index: i, frames: span.frames, copied: count, held: missing });
            pieces.push({ path: piecePath, frames: count });
            piecePath = tailPath;
            expected = missing;
            count = missing;
          }
        }
        if (count !== expected) {
          // Anything else: the browser shows whatever the standard export shows.
          log.warn('Copied span came up short; rendering it in the browser instead', { jobId: input.jobId, index: i, frames: span.frames, count });
          const demoted: ExportSpan = { kind: 'browser', from: span.from, frames: span.frames, reason: 'source ended early' };
          plan.spans[i] = demoted;
          plan.copiedFrames -= span.frames;
          piecePath = path.join(workDir, `span-${String(i).padStart(4, '0')}.ts`);
          expected = span.frames;
          await producePiece(input, tools, sources, demoted, i, piecePath, progress);
          count = await countPackets(tools.ffprobe, piecePath, signal);
        }
      }
      if (count !== expected) {
        throw new Error(`Span ${i} (${plan.spans[i].kind}, frames ${span.from}–${span.from + span.frames - 1}) produced ${count} frames instead of ${expected}.`);
      }
      const ms = Date.now() - startedAt;
      log.info('Span done', { jobId: input.jobId, index: i, kind: plan.spans[i].kind, frames: span.frames, ms, realtime: Math.round(((span.frames / entry.fps) / (ms / 1000)) * 100) / 100 });
      timings.push({ kind: plan.spans[i].kind, frames: span.frames, ms });
      pieces.push({ path: piecePath, frames: expected });
      framesDone += span.frames;
      spanIndex = i + 1; // the finished span counts as copied on this tick, not as in flight
      progress(0);
    }

    const percent = copiedPercent(plan);
    const notes: string[] = [
      percent === 0
        ? `Copied nothing of this timeline (${plan.reason ?? 'nothing was a plain cut of a video clip'}); every frame was rendered.`
        : `Copied ${percent} % of this timeline (${plan.spans.filter((s) => s.kind === 'copy').length} of ${plan.spans.length} spans).`,
    ];

    // 2. The list the finishing mux joins from (condition 3); the pieces stay
    // in the scratch folder until the export ends. Their counted frames sum
    // to the plan; the finishing stage checks the finished file against it.
    const framesCounted = pieces.reduce((n, p) => n + p.frames, 0);
    if (framesCounted !== plan.totalFrames) {
      throw new Error(`The pieces hold ${framesCounted} frames instead of ${plan.totalFrames}.`);
    }
    await fs.writeFile(listPath, concatListText(pieces, entry.fps), 'utf-8');

    // 3. The audio (D6/D7) has been mixing and AAC-encoding beside the spans since the plan.
    const audio = await audioWork;
    notes.push(...audio.notes);
    return { videoPath: listPath, videoDemuxer: 'concat', frames: plan.totalFrames, audioPath: audio.audioPath, notes };
  },
};

/**
 * The file a copied span is read from: the entry's per-asset source (a
 * ready proxy on a draft export — docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md
 * Phase 2) else the original. The same file the browser spans decode.
 */
function copySourcePath(entry: ExportEngineInput['entry'], span: Extract<ExportSpan, { kind: 'copy' }>): string {
  return entry.sourcePaths?.[span.assetId] ?? span.assetPath;
}

/** Pure: why a probed source cannot be copied by the select, or null. Shared with Engine 3's bases. */
export function copyDemotionReason(probe: SourceProbe, span: Pick<Extract<ExportSpan, { kind: 'copy' }>, 'rate'>): string | null {
  if (!isConstantFrameRate(probe.frameRate, probe.averageFrameRate)) return 'variable frame rate';
  if (probe.startTime > 0.001) return 'source timestamps do not start at 0';
  if (span.rate !== undefined && span.rate < 1 && ticksPerFrame(probe.timeBase, probe.frameRate) === null) return 'source frame is not a whole number of time-base ticks';
  return null;
}

/** Probe every distinct copied source once; demote spans the select cannot index. */
async function probeCopiedSources(tools: Tools, plan: ExportSpanPlan, entry: ExportEngineInput['entry'], signal: AbortSignal): Promise<Map<string, SourceProbe>> {
  const sources = new Map<string, SourceProbe>();
  for (let i = 0; i < plan.spans.length; i++) {
    const span = plan.spans[i];
    if (span.kind !== 'copy') continue;
    const sourcePath = copySourcePath(entry, span);
    let probe = sources.get(sourcePath);
    if (!probe) {
      probe = await probeSource(tools.ffprobe, sourcePath, signal);
      sources.set(sourcePath, probe);
    }
    const reason = copyDemotionReason(probe, span);
    if (reason) {
      log.warn('Copied span demoted to the browser', { assetPath: span.assetPath, reason });
      plan.spans[i] = { kind: 'browser', from: span.from, frames: span.frames, reason };
      plan.copiedFrames -= span.frames;
    }
  }
  if (plan.copiedFrames === 0 && !plan.reason) {
    plan.reason = plan.spans.find((s): s is Extract<ExportSpan, { kind: 'browser' }> => s.kind === 'browser')?.reason;
  }
  return sources;
}

export async function producePiece(
  input: ExportEngineInput,
  tools: Tools,
  sources: Map<string, SourceProbe>,
  span: ExportSpan,
  index: number,
  outputPath: string,
  progress: (extra: number) => void,
): Promise<void> {
  const { entry, color, signal, workDir } = input;
  // The output size every piece lands on (browser spans reach it through the
  // renderer's own resolution of the same scale).
  const size = exportOutputSize(entry, input.render);
  const quality = copyQualityForCrf(input.render.crf, tools.encoder);
  const onStderr = (text: string) => {
    const f = parseStatsFrame(text);
    if (f !== null) progress(Math.min(f, span.frames));
  };
  switch (span.kind) {
    case 'copy': {
      const sourcePath = copySourcePath(entry, span);
      const source = sources.get(sourcePath);
      if (!source) throw new Error(`Unprobed source ${sourcePath}`);
      await runFfmpeg(
        tools.ffmpeg,
        copySpanArgs({
          encoder: tools.encoder,
          quality,
          sourcePath,
          sourcePixelFormat: source.pixelFormat,
          sourceFrame: span.sourceFrame,
          ...(span.rate !== undefined ? { rate: span.rate } : {}),
          ...(span.rate !== undefined && span.rate < 1 ? { trimBefore: span.trimBefore, clipOffset: span.clipOffset, timeBase: source.timeBase } : {}),
          sourceFrameRate: source.frameRate,
          firstFrameCeil: span.firstFrameCeil,
          frames: span.frames,
          fps: entry.fps,
          width: size.width,
          height: size.height,
          color,
          outputPath,
        }),
        { signal, onStderr },
      );
      return;
    }
    case 'black':
      await runFfmpeg(
        tools.ffmpeg,
        blackSpanArgs({ encoder: tools.encoder, quality, frames: span.frames, fps: entry.fps, width: size.width, height: size.height, color, outputPath }),
        { signal, onStderr },
      );
      return;
    case 'browser': {
      const leadIn = Math.min(1, span.from);
      const intermediate = path.join(workDir, `browser-${String(index).padStart(4, '0')}.mp4`);
      await renderBrowserSpan(input, {
        from: span.from,
        frames: span.frames,
        leadIn,
        outputPath: intermediate,
        jobId: `${input.jobId}:span${index}`,
        onFrames: (rendered) => progress(Math.min(span.frames, Math.max(0, rendered - leadIn))),
      });
      await runFfmpeg(
        tools.ffmpeg,
        browserSpanArgs({ encoder: tools.encoder, quality, inputPath: intermediate, leadIn, frames: span.frames, fps: entry.fps, color, outputPath }),
        { signal, onStderr },
      );
      await fs.rm(intermediate, { force: true }).catch(() => {});
      return;
    }
  }
}

/**
 * Video packets in a piece — one per frame in an MPEG-TS elementary stream.
 * A piece ffmpeg wrote no packet into (headers only: an encoder that emitted
 * nothing — measured 2026-09-12 on a same-size nv12 → yuv420p copy) reads as
 * 0, so the span is sent to the browser like any short one instead of the
 * export dying on ffprobe's "End of file".
 */
export async function countPackets(ffprobe: string, file: string, signal: AbortSignal): Promise<number> {
  const { spawn } = await import('child_process');
  const output = await new Promise<string>((resolve, reject) => {
    const proc = spawn(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c: Buffer) => { stdout += c.toString(); });
    proc.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
    const onAbort = () => proc.kill();
    signal.addEventListener('abort', onAbort, { once: true });
    proc.on('error', reject);
    proc.on('close', (code) => {
      signal.removeEventListener('abort', onAbort);
      if (code === 0) resolve(stdout);
      // Headers and no packet: ffprobe reads it as an unexpected end — a piece
      // holding zero frames, not a probe failure.
      else if (/End of file|Invalid data found/i.test(stderr)) resolve('0');
      else reject(new Error(`ffprobe exited with code ${code}: ${stderr.trim()}`));
    });
  });
  const n = parseInt(output.trim(), 10);
  return Number.isFinite(n) ? n : -1;
}

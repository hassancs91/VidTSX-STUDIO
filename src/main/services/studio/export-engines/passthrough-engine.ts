/**
 * Engine 2 — the passthrough hybrid (docs/export-engines-plan.md Stage 2).
 *
 * Spans that are plain cuts of a video asset are COPIED: the full ffmpeg's
 * hardware decoder → the nearest-pts select → scale → the hardware encoder,
 * with T1's frame-mapping rule (condition 1). Everything else is rendered by
 * the browser exactly as the standard engine renders it, one frame early, and
 * re-encoded by our ffmpeg with the copied spans' settings (conditions 2, 4).
 * Gaps are black. The pieces are MPEG-TS video-only intermediates joined by
 * stream copy (condition 3); the audio is one ffmpeg pass over the whole
 * timeline handed to the finishing stage as `audioPath`, or left to the
 * standard path when the mix needs what only the browser reproduces exactly.
 *
 * It never steps aside (D4): a timeline with nothing to copy still runs here,
 * with every frame through the browser and a note saying so.
 *
 * Every count is checked, never assumed: each piece's frame count, the joined
 * file's frame count and start time. A mismatch fails the export loudly —
 * a silently wrong frame is the one outcome T1 forbids.
 */
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../../logging/log-engine';
import { copiedPercent, planExportAudio, planExportSpans, type ExportSpan, type ExportSpanPlan } from '../../../../shared/studio/export-spans';
import { runFfmpeg } from '../ffmpeg-bin';
import { getFfmpegFullBinary, probeProxyEncoders } from '../ffmpeg-full';
import { chooseProxyEncoder, type ProxyGpuEncoder } from '../proxy-encoders';
import { probeStreams } from './finishing';
import { renderBrowserSpan } from './passthrough-browser';
import {
  ENCODER_NAMES,
  audioPassArgs,
  blackSpanArgs,
  browserSpanArgs,
  concatListText,
  copySpanArgs,
  holdLastFrameArgs,
  isConstantFrameRate,
  joinArgs,
  parseStatsFrame,
} from './passthrough-ffmpeg';
import { ffprobeBeside, probeSource, type SourceProbe } from './passthrough-probe';
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

interface Tools {
  ffmpeg: string;
  ffprobe: string;
  encoder: ProxyGpuEncoder;
}

async function resolveTools(): Promise<Tools | { reason: string }> {
  const ffmpeg = await getFfmpegFullBinary();
  if (!ffmpeg) return { reason: NEEDS_DOWNLOAD };
  const probe = await probeProxyEncoders(ffmpeg);
  const encoder = chooseProxyEncoder(probe.working);
  if (!encoder) return { reason: NO_WORKING_ENCODER };
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
    const sources = await probeCopiedSources(tools, plan, signal);
    const message = plan.copiedFrames === 0 ? NOTHING_TO_COPY_MESSAGE : undefined;
    log.info('Span plan', { jobId: input.jobId, percent: copiedPercent(plan), spans: plan.spans.map((s) => `${s.kind}:${s.from}+${s.frames}`) });

    // 1. Pieces, in order.
    const pieces: Array<{ path: string; frames: number }> = [];
    let framesDone = 0;
    const progress = (extra: number) => input.onProgress({ framesDone: framesDone + extra, totalFrames: plan.totalFrames, message });
    progress(0);
    for (const [i, span] of plan.spans.entries()) {
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
        if (missing > 0 && missing <= HOLD_LAST_FRAME_MAX) {
          const tailPath = piecePath.replace(/\.ts$/, '-tail.ts');
          await runFfmpeg(tools.ffmpeg, holdLastFrameArgs({ encoder: tools.encoder, inputPath: piecePath, lastFrame: count - 1, frames: missing, fps: entry.fps, color, outputPath: tailPath }), { signal });
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
      pieces.push({ path: piecePath, frames: expected });
      framesDone += span.frames;
      progress(0);
    }

    const percent = copiedPercent(plan);
    const notes: string[] = [
      percent === 0
        ? `Copied nothing of this timeline (${plan.reason ?? 'nothing was a plain cut of a video clip'}); every frame was rendered.`
        : `Copied ${percent} % of this timeline (${plan.spans.filter((s) => s.kind === 'copy').length} of ${plan.spans.length} spans).`,
    ];

    // 2. Join (condition 3), then drop the pieces — the joined file is the product.
    const listPath = path.join(workDir, 'spans.txt');
    await fs.writeFile(listPath, concatListText(pieces, entry.fps), 'utf-8');
    const videoPath = path.join(workDir, 'video.mp4');
    await runFfmpeg(tools.ffmpeg, joinArgs(listPath, videoPath, color), { signal });
    const joined = await probeStreams(videoPath);
    if (joined.video?.frames !== plan.totalFrames) {
      throw new Error(`The joined video has ${joined.video?.frames ?? 'no'} frames instead of ${plan.totalFrames}.`);
    }
    await Promise.all(pieces.map((p) => fs.rm(p.path, { force: true }).catch(() => {})));

    // 3. The one audio pass (D6/D7), when the timeline's mix is plain cuts.
    const audioPlan = planExportAudio(project, entry.durationInFrames);
    let audioPath: string | undefined;
    if (!audioPlan) {
      notes.push('Audio mixed by the standard path (gain, fades, speed, transitions or audio tracks are present).');
    } else if (!audioPlan.segments.some((s) => s.kind === 'source')) {
      audioPath = videoPath; // no sound at all → the finishing stage writes no audio track
    } else {
      audioPath = path.join(workDir, 'audio.wav');
      await runFfmpeg(tools.ffmpeg, audioPassArgs(audioPlan, audioPath), { signal });
    }
    return { videoPath, audioPath, notes };
  },
};

/** Probe every distinct copied source once; demote spans the select cannot index. */
async function probeCopiedSources(tools: Tools, plan: ExportSpanPlan, signal: AbortSignal): Promise<Map<string, SourceProbe>> {
  const sources = new Map<string, SourceProbe>();
  for (let i = 0; i < plan.spans.length; i++) {
    const span = plan.spans[i];
    if (span.kind !== 'copy') continue;
    let probe = sources.get(span.assetPath);
    if (!probe) {
      probe = await probeSource(tools.ffprobe, span.assetPath, signal);
      sources.set(span.assetPath, probe);
    }
    const reason = !isConstantFrameRate(probe.frameRate, probe.averageFrameRate)
      ? 'variable frame rate'
      : probe.startTime > 0.001
        ? 'source timestamps do not start at 0'
        : null;
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

async function producePiece(
  input: ExportEngineInput,
  tools: Tools,
  sources: Map<string, SourceProbe>,
  span: ExportSpan,
  index: number,
  outputPath: string,
  progress: (extra: number) => void,
): Promise<void> {
  const { entry, color, signal, workDir } = input;
  const onStderr = (text: string) => {
    const f = parseStatsFrame(text);
    if (f !== null) progress(Math.min(f, span.frames));
  };
  switch (span.kind) {
    case 'copy': {
      const source = sources.get(span.assetPath);
      if (!source) throw new Error(`Unprobed source ${span.assetPath}`);
      await runFfmpeg(
        tools.ffmpeg,
        copySpanArgs({
          encoder: tools.encoder,
          sourcePath: span.assetPath,
          sourceFrame: span.sourceFrame,
          sourceFrameRate: source.frameRate,
          firstFrameCeil: span.firstFrameCeil,
          frames: span.frames,
          fps: entry.fps,
          width: entry.width,
          height: entry.height,
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
        blackSpanArgs({ encoder: tools.encoder, frames: span.frames, fps: entry.fps, width: entry.width, height: entry.height, color, outputPath }),
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
        browserSpanArgs({ encoder: tools.encoder, inputPath: intermediate, leadIn, frames: span.frames, fps: entry.fps, color, outputPath }),
        { signal, onStderr },
      );
      await fs.rm(intermediate, { force: true }).catch(() => {});
      return;
    }
  }
}

/** Video packets in a piece — one per frame in an MPEG-TS elementary stream. */
async function countPackets(ffprobe: string, file: string, signal: AbortSignal): Promise<number> {
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
      else reject(new Error(`ffprobe exited with code ${code}: ${stderr.trim()}`));
    });
  });
  const n = parseInt(output.trim(), 10);
  return Number.isFinite(n) ? n : -1;
}

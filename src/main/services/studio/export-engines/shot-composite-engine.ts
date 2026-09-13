/**
 * Engine 3 — the shot composite (docs/export-engines-plan.md "Engine 3"):
 * the editor project's bake, inside the engine seam. Footage that is a plain
 * cut is COPIED as the passthrough engine copies it; footage a shot paints
 * over is copied too, with the shot layer — rendered alone by the browser,
 * with alpha, for the shot's frames only — laid over it by ffmpeg
 * (`shot-composite-ffmpeg.ts`). The 4K source never goes through Chromium:
 * the browser paints graphics, ffmpeg decodes footage, once. Everything the
 * planner cannot classify (a transformed or letterboxed clip under a shot, a
 * transition window, b-roll on an overlay lane) is a browser span, exactly
 * as the passthrough engine renders one.
 *
 * Shares the passthrough engine's tools, its per-span producers for the
 * span kinds it has, its one audio pass beside the pieces, its concat list
 * for the finishing mux, and its counted-frames rule: every piece is counted,
 * a composite that comes up short goes back to the browser, and a mismatch
 * fails loudly. The passthrough engine itself is untouched (D1: a new engine
 * is one file plus a registry entry).
 */
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../../logging/log-engine';
import {
  compositedPercent,
  copiedPercent,
  planExportSpans,
  type CompositeSpan,
  type CopySpan,
  type ExportSpan,
  type ExportSpanPlan,
} from '../../../../shared/studio/export-spans';
import { runFfmpeg } from '../ffmpeg-bin';
import { producePassthroughAudio } from './passthrough-audio';
import {
  copyDemotionReason,
  countPackets,
  producePiece,
  resolveTools,
  type Tools,
} from './passthrough-engine';
import { ENCODER_NAMES, concatListText, copyQualityForCrf, holdLastFrameArgs, parseStatsFrame } from './passthrough-ffmpeg';
import { exportOutputSize } from './output-size';
import { probeSource, type SourceProbe } from './passthrough-probe';
import { progressMessage, type SpanTiming } from './passthrough-progress';
import { compositeSpanArgs, type CompositeBase } from './shot-composite-ffmpeg';
import { ShotLayerRuns } from './shot-layer-render';
import type { ExportEngine, ExportEngineInput, ExportEngineProduct } from './types';

const log = logEngine.createLogger('ShotCompositeEngine');

/** D4: shown in the queue while a timeline with nothing to copy or composite renders. */
export const NOTHING_TO_COMPOSITE_MESSAGE = 'Nothing on this timeline can be copied or composited — rendering every frame, as the standard export does.';

/** A copy piece short by this many frames at most holds its last frame (the stream ended before its container). */
const HOLD_LAST_FRAME_MAX = 3;

export const shotCompositeExportEngine: ExportEngine = {
  id: 'shot-composite',

  async availability() {
    const tools = await resolveTools();
    return 'reason' in tools ? { available: false, reason: tools.reason } : { available: true };
  },

  async produce(input: ExportEngineInput): Promise<ExportEngineProduct> {
    const { project, entry, workDir, color, signal } = input;
    const tools = await resolveTools();
    if ('reason' in tools) throw new Error(tools.reason);
    input.onEncoderResolved?.({ encoderName: ENCODER_NAMES[tools.encoder], hardwareAccelerated: true });

    const plan = planExportSpans(project, entry.durationInFrames, { compositeShots: true });
    if (plan.totalFrames !== entry.durationInFrames) {
      throw new Error(`The span plan covers ${plan.totalFrames} frames but the export has ${entry.durationInFrames}.`);
    }
    const sources = await probeBases(tools, plan, entry, signal);
    const quality = copyQualityForCrf(input.render.crf, tools.encoder);
    const message = plan.copiedFrames === 0 && !(plan.compositedFrames ?? 0) ? NOTHING_TO_COMPOSITE_MESSAGE : undefined;
    log.info('Span plan', { jobId: input.jobId, copied: copiedPercent(plan), composited: compositedPercent(plan), spans: plan.spans.map((s) => `${s.kind}:${s.from}+${s.frames}`) });

    // The audio runs beside the pieces, as in the passthrough engine.
    const listPath = path.join(workDir, 'spans.txt');
    let audioError: Error | null = null;
    const audioWork = producePassthroughAudio(input, tools.ffmpeg, listPath);
    audioWork.catch((err: unknown) => { audioError = err instanceof Error ? err : new Error(String(err)); });

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
    // The shot layer is rendered once per contiguous run of composite spans.
    const runs = new ShotLayerRuns(input, plan.spans);
    for (const [i, span] of plan.spans.entries()) {
      if (audioError) throw audioError;
      spanIndex = i;
      const startedAt = Date.now();
      const made = await produceCounted(input, tools, sources, runs, plan, i, quality, progress);
      pieces.push(...made);
      await runs.releaseIfPast(span.from + span.frames);
      const ms = Date.now() - startedAt;
      log.info('Span done', { jobId: input.jobId, index: i, kind: plan.spans[i].kind, frames: span.frames, ms, realtime: Math.round(((span.frames / entry.fps) / (ms / 1000)) * 100) / 100 });
      timings.push({ kind: plan.spans[i].kind, frames: span.frames, ms });
      framesDone += span.frames;
      spanIndex = i + 1;
      progress(0);
    }
    await runs.release();

    const copied = copiedPercent(plan);
    const composited = compositedPercent(plan);
    const count = (kind: ExportSpan['kind']) => plan.spans.filter((s) => s.kind === kind).length;
    const notes: string[] = [
      copied === 0 && composited === 0
        ? `Copied nothing of this timeline (${plan.reason ?? 'nothing was a plain cut of a video clip'}); every frame was rendered.`
        : `Copied ${copied} % and composited ${composited} % of this timeline (${count('copy')} copied, ${count('composite')} composited, ${count('browser')} rendered spans).`,
    ];

    const framesCounted = pieces.reduce((n, p) => n + p.frames, 0);
    if (framesCounted !== plan.totalFrames) {
      throw new Error(`The pieces hold ${framesCounted} frames instead of ${plan.totalFrames}.`);
    }
    await fs.writeFile(listPath, concatListText(pieces, entry.fps), 'utf-8');

    const audio = await audioWork;
    notes.push(...audio.notes);
    return { videoPath: listPath, videoDemuxer: 'concat', frames: plan.totalFrames, audioPath: audio.audioPath, notes };
  },
};

/** The file a copied base is read from: the entry's per-asset source (a ready proxy on a draft) else the original. */
function sourcePathOf(entry: ExportEngineInput['entry'], span: CopySpan): string {
  return entry.sourcePaths?.[span.assetId] ?? span.assetPath;
}

/** The copied base of a span, whether it stands alone or under the shot layer. */
function baseOf(span: ExportSpan): CopySpan | null {
  if (span.kind === 'copy') return span;
  if (span.kind === 'composite' && span.base.kind === 'copy') return span.base;
  return null;
}

/**
 * Probe every distinct source once; a base the select cannot index sends its
 * whole span to the browser (a composite's layer would land on nothing).
 */
async function probeBases(tools: Tools, plan: ExportSpanPlan, entry: ExportEngineInput['entry'], signal: AbortSignal): Promise<Map<string, SourceProbe>> {
  const sources = new Map<string, SourceProbe>();
  for (let i = 0; i < plan.spans.length; i++) {
    const span = plan.spans[i];
    const base = baseOf(span);
    if (!base) continue;
    const sourcePath = sourcePathOf(entry, base);
    let probe = sources.get(sourcePath);
    if (!probe) {
      probe = await probeSource(tools.ffprobe, sourcePath, signal);
      sources.set(sourcePath, probe);
    }
    const reason = copyDemotionReason(probe, base);
    if (reason) {
      log.warn('Span demoted to the browser', { assetPath: base.assetPath, kind: span.kind, reason });
      demote(plan, i, reason);
    }
  }
  return sources;
}

function demote(plan: ExportSpanPlan, i: number, reason: string): void {
  const span = plan.spans[i];
  if (span.kind === 'copy') plan.copiedFrames -= span.frames;
  if (span.kind === 'composite') plan.compositedFrames = (plan.compositedFrames ?? 0) - span.frames;
  plan.spans[i] = { kind: 'browser', from: span.from, frames: span.frames, reason };
}

/**
 * Produce span `i` as one or two counted pieces: the passthrough engine's
 * producers for copy / black / browser spans (with its short-tail rule: hold
 * the last frame for a frame or two, else the browser), the composite
 * producer here for composite spans (short → the browser). The count of every
 * piece is checked against the plan before it is kept.
 */
async function produceCounted(
  input: ExportEngineInput,
  tools: Tools,
  sources: Map<string, SourceProbe>,
  runs: ShotLayerRuns,
  plan: ExportSpanPlan,
  i: number,
  quality: number,
  progress: (extra: number) => void,
): Promise<Array<{ path: string; frames: number }>> {
  const { entry, color, signal, workDir } = input;
  const span = plan.spans[i];
  const piecePath = path.join(workDir, `span-${String(i).padStart(4, '0')}.ts`);
  const make = async (s: ExportSpan): Promise<number> => {
    if (s.kind === 'composite') await produceCompositePiece(input, tools, sources, runs, s, i, piecePath, progress);
    else await producePiece(input, tools, sources, s, i, piecePath, progress);
    return countPackets(tools.ffprobe, piecePath, signal);
  };
  let count = await make(span);
  if (count === span.frames) return [{ path: piecePath, frames: span.frames }];

  if (span.kind === 'copy') {
    const missing = span.frames - count;
    if (count > 0 && missing > 0 && missing <= HOLD_LAST_FRAME_MAX) {
      const tailPath = piecePath.replace(/\.ts$/, '-tail.ts');
      await runFfmpeg(tools.ffmpeg, holdLastFrameArgs({ encoder: tools.encoder, quality, inputPath: piecePath, lastFrame: count - 1, frames: missing, fps: entry.fps, color, outputPath: tailPath }), { signal });
      if ((await countPackets(tools.ffprobe, tailPath, signal)) === missing) {
        log.info('Held the last source frame at a clip tail', { jobId: input.jobId, index: i, frames: span.frames, copied: count, held: missing });
        return [{ path: piecePath, frames: count }, { path: tailPath, frames: missing }];
      }
    }
  }
  if (span.kind !== 'browser') {
    log.warn('Span came up short; rendering it in the browser instead', { jobId: input.jobId, index: i, kind: span.kind, frames: span.frames, count });
    demote(plan, i, 'source ended early');
    count = await make(plan.spans[i]);
  }
  if (count !== span.frames) {
    throw new Error(`Span ${i} (${plan.spans[i].kind}, frames ${span.from}–${span.from + span.frames - 1}) produced ${count} frames instead of ${span.frames}.`);
  }
  return [{ path: piecePath, frames: span.frames }];
}

/** The shot layer's window for the span (rendered per run), composited onto its base by ffmpeg. */
async function produceCompositePiece(
  input: ExportEngineInput,
  tools: Tools,
  sources: Map<string, SourceProbe>,
  runs: ShotLayerRuns,
  span: CompositeSpan,
  index: number,
  outputPath: string,
  progress: (extra: number) => void,
): Promise<void> {
  const { entry, color, signal } = input;
  const size = exportOutputSize(entry, input.render);
  const quality = copyQualityForCrf(input.render.crf, tools.encoder);
  // While a run renders, the frames past this span belong to later spans; the line shows this span's.
  const layer = await runs.layerFor(index, span, (rendered) => progress(Math.min(span.frames, Math.max(0, rendered - 1))));
  let base: CompositeBase;
  if (span.base.kind === 'black') {
    base = { kind: 'black' };
  } else {
    const b = span.base;
    const sourcePath = sourcePathOf(entry, b);
    const source = sources.get(sourcePath);
    if (!source) throw new Error(`Unprobed source ${sourcePath}`);
    base = {
      kind: 'source',
      sourcePath,
      sourcePixelFormat: source.pixelFormat,
      sourceFrame: b.sourceFrame,
      ...(b.rate !== undefined ? { rate: b.rate } : {}),
      ...(b.rate !== undefined && b.rate < 1 ? { trimBefore: b.trimBefore, clipOffset: b.clipOffset, timeBase: source.timeBase } : {}),
      sourceFrameRate: source.frameRate,
      firstFrameCeil: b.firstFrameCeil,
      fps: entry.fps,
    };
  }
  await runFfmpeg(
    tools.ffmpeg,
    compositeSpanArgs({ encoder: tools.encoder, quality, base, layerPath: layer.path, leadIn: layer.trimStart, frames: span.frames, fps: entry.fps, width: size.width, height: size.height, color, outputPath }),
    {
      signal,
      onStderr: (text) => {
        const f = parseStatsFrame(text);
        if (f !== null) progress(Math.min(f, span.frames));
      },
    },
  );
}

// The `subjectMask` media job (docs/studio/FILTER_PACKS_DESIGN.md "Analysis
// tracks" → "As built (masks track)"): frames of the asset's ORIGINAL (not
// the proxy — see below) through the bundled ffmpeg straight at MODNet's input
// size (short side 512 on DirectML, 352 on the CPU fallback, /32), each
// through the analysis process (MODNet → the matte area-averaged to ≤ 256 px
// on its long side, 8-bit), deflated per frame (Node zlib) and APPENDED to
// `cache/analysis/<assetId>/mask-v1.bin`; `mask-v1.json` indexes them by
// source seconds (mask-track.ts). Computed per asset span and unioned with
// what an earlier run cached, like the faces track: extending a clip appends
// only the new seconds and rewrites the index.

import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import zlib from 'zlib';
import { logEngine } from '../../../logging/log-engine';
import { analysisEngine } from '../../../analysis-engine/analysis-engine';
import { analysisModel, SUBJECT_MODEL_IDS } from '../../../analysis-engine/model-manifest';
import { MODNET_SHORT_SIDE_CPU, MODNET_SHORT_SIDE_GPU, modnetInputSize } from '../../../analysis-engine/modnet';
import { missingSpans, roundTrackTime, sameTrackRecipe, settledSpanEnd, type TrackSpan } from '../../../shared/studio/analysis-track';
import {
  MASK_TRACK_VERSION,
  maskBlobRelPath,
  maskIndexRelPath,
  maskSizeFor,
  maskTrackCompatible,
  mergeMaskIndex,
  parseMaskIndex,
  serializeMaskIndex,
  type MaskFrameEntry,
  type MaskTrackIndex,
} from '../../../shared/studio/mask-track';
import type { StudioAnalysisMeta } from '../../../shared/ipc/types/studio-analysis';
import { ensureAnalysisModels } from './analysis-models';
import { streamAnalysisFrames } from './analysis-frames';
import type { FaceTrackJobOptions } from './face-track-job';
import { getFfmpegBinary } from './ffmpeg-bin';
import { probeMedia } from './media-import';
import { getProjectCacheDir } from './studio-paths';

const log = logEngine.createLogger('StudioMaskTrack');
const median = (xs: number[]): number => (xs.length ? Math.round([...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] * 10) / 10 : 0);
const deflate = promisify(zlib.deflate);

/** The same request shape as the faces job: asset kind, frame source, spans, fps. */
export type MaskTrackJobOptions = FaceTrackJobOptions;

export interface MaskTrackJobResult {
  /** The index — the renderer reads it, then the blobs beside it. */
  relPath: string;
  analysis: StudioAnalysisMeta;
}

function pinnedModels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of SUBJECT_MODEL_IDS) out[id] = analysisModel(id).sha256;
  return out;
}

function recipeFor(options: MaskTrackJobOptions): { fps: number; models: Record<string, string>; static?: boolean } {
  const still = options.assetKind === 'image';
  return { fps: still ? 1 : options.fps, models: pinnedModels(), ...(still ? { static: true } : {}) };
}

function metaOf(index: MaskTrackIndex, fallback?: string): StudioAnalysisMeta {
  return { ep: index.ep, spans: index.spans, frames: index.frames.length, fps: index.fps, input: index.input, ...(fallback ? { fallback } : {}) };
}

async function paths(projectId: string, assetId: string): Promise<{ index: string; blob: string }> {
  const cacheDir = await getProjectCacheDir(projectId);
  return {
    index: path.join(cacheDir, ...maskIndexRelPath(assetId).split('/')),
    blob: path.join(cacheDir, ...maskBlobRelPath(assetId).split('/')),
  };
}

/** The cached index, or null — also when the bin is shorter than the index says (a lost file is a missing track). */
export async function readMaskIndex(projectId: string, assetId: string): Promise<MaskTrackIndex | null> {
  try {
    const files = await paths(projectId, assetId);
    const index = parseMaskIndex(JSON.parse(await fs.readFile(files.index, 'utf-8')));
    if (!index) return null;
    const { size } = await fs.stat(files.blob);
    return size >= index.bytes ? index : null;
  } catch {
    return null;
  }
}

/** What the wanted spans still need from a cached index: [] = the cache satisfies the request. */
function stillMissing(index: MaskTrackIndex | null, options: MaskTrackJobOptions): TrackSpan[] {
  const still = options.assetKind === 'image';
  if (!index || !sameTrackRecipe(index, recipeFor(options))) return still ? [[0, 0]] : options.spans;
  if (still) return index.frames.length > 0 ? [] : [[0, 0]];
  return missingSpans(index.spans, options.spans, 1 / options.fps);
}

/** The cached track when it already covers the request (the job need not run), else null. */
export async function maskTrackSatisfying(projectId: string, assetId: string, options: MaskTrackJobOptions): Promise<MaskTrackJobResult | null> {
  const index = await readMaskIndex(projectId, assetId);
  if (!index || stillMissing(index, options).length > 0) return null;
  return { relPath: maskIndexRelPath(assetId), analysis: metaOf(index) };
}

/** A span snapped to the frame grid, one frame past its end so the clip's last frame is inside (the faces job's rule). */
function gridSpan(span: TrackSpan, fps: number): { start: number; durationSec: number; frames: number; wanted: number } {
  const start = Math.floor(span[0] * fps + 1e-6) / fps;
  const frames = Math.max(1, Math.ceil((span[1] - start) * fps - 1e-6) + 1);
  return { start, durationSec: frames / fps, frames, wanted: span[1] };
}

export async function generateMaskTrack(
  projectId: string,
  assetId: string,
  sourcePath: string,
  options: MaskTrackJobOptions,
  signal: AbortSignal,
  onProgress: (percent: number, message?: string) => void,
): Promise<MaskTrackJobResult> {
  const throwIfAborted = () => {
    if (signal.aborted) throw new Error('Cancelled');
  };
  const files = await paths(projectId, assetId);
  await fs.mkdir(path.dirname(files.index), { recursive: true });

  const models = await ensureAnalysisModels(SUBJECT_MODEL_IDS, (percent, message) => onProgress(percent, message), signal);
  throwIfAborted();

  let existing = await readMaskIndex(projectId, assetId);
  let todo = stillMissing(existing, options);
  if (todo.length === 0 && existing) return { relPath: maskIndexRelPath(assetId), analysis: metaOf(existing) };

  const loaded = await analysisEngine.loadMasks(models.modnet.path, true);
  if (loaded.fallback) log.warn('DirectML unavailable in the analysis process — masks run on the CPU at short side 352', { reason: loaded.fallback });
  else log.info('Subject model loaded', { ep: loaded.ep, loadMs: loaded.loadMs });
  throwIfAborted();

  // The ORIGINAL, never the proxy: the mask edge is the effect, and the
  // all-intra CRF 28 proxy's artifacts flip MODNet's call at the spike
  // fixture's plush — measured 2026-09-25, the pink toy at the right shoulder
  // joins the mask on 17 of 75 frames from the proxy (up to 31/255 mean alpha
  // in its box) and on 0 of 75 from the original, same code, same 896×512
  // input. The export renders the original too. (Faces keep the proxy.)
  const input = sourcePath;
  const [ffmpeg, probe] = await Promise.all([getFfmpegBinary('ffmpeg'), probeMedia(input, options.assetKind)]);
  if (!probe.width || !probe.height) throw new Error('Could not read the frame size of the source');
  const still = options.assetKind === 'image';
  const fps = still ? 1 : options.fps;
  const recipe = recipeFor(options);
  const mask = maskSizeFor(probe.width, probe.height);
  const inputSize = modnetInputSize(probe.width, probe.height, loaded.ep === 'dml' ? MODNET_SHORT_SIDE_GPU : MODNET_SHORT_SIDE_CPU);
  if (existing && !maskTrackCompatible(existing, { ...recipe, mask })) {
    existing = null;
    todo = still ? [[0, 0]] : options.spans;
  }

  // Append in place over a compatible bin (truncated to what its index
  // describes — a cancelled run's tail goes); a fresh track is written to a
  // part file and renamed over the old bin at the end.
  const fresh = existing === null;
  const target = fresh ? `${files.blob}.${process.pid}.part` : files.blob;
  const handle = await fs.open(target, fresh ? 'w' : 'r+');
  let position = existing?.bytes ?? 0;
  const frames: MaskFrameEntry[] = [];
  const spans: TrackSpan[] = [];
  /** Per frame: the worker's own time, its inference alone, the round trip to it, deflate + write. */
  const timing = { worker: [] as number[], infer: [] as number[], trip: [] as number[], store: [] as number[] };
  let ok = false;
  const t0 = performance.now();
  try {
    if (!fresh) await handle.truncate(position);
    const plan = still ? [{ start: 0, durationSec: 0, frames: 1, wanted: 0 }] : todo.map((span) => gridSpan(span, fps));
    const totalFrames = plan.reduce((n, p) => n + p.frames, 0);
    let lastPercent = -1;
    for (const piece of plan) {
      throwIfAborted();
      const count = await streamAnalysisFrames(
        { ffmpeg, input, inputWidth: probe.width, inputHeight: probe.height, startSec: piece.start, durationSec: piece.durationSec, fps, still, signal, size: inputSize },
        async (rgb, index, size) => {
          const a = performance.now();
          const { mask: alpha, ms, inferMs } = await analysisEngine.mask(rgb, size.width, size.height, mask.width, mask.height);
          const b = performance.now();
          const blob = await deflate(alpha);
          await handle.write(blob, 0, blob.length, position);
          timing.worker.push(ms);
          timing.infer.push(inferMs);
          timing.trip.push(b - a);
          timing.store.push(performance.now() - b);
          frames.push([roundTrackTime(piece.start + index / fps), position, blob.length]);
          position += blob.length;
          const percent = Math.min(99, Math.floor((frames.length / Math.max(totalFrames, 1)) * 100));
          if (percent !== lastPercent) {
            lastPercent = percent;
            onProgress(percent, 'Analyzing subject…');
          }
        },
      );
      spans.push([piece.start, still ? 0 : settledSpanEnd(piece.wanted, piece.start, count, fps)]);
    }
    throwIfAborted();
    ok = true;
  } finally {
    await handle.close();
    if (!ok && fresh) await fs.rm(target, { force: true }).catch(() => {});
  }

  const addition: MaskTrackIndex = {
    version: MASK_TRACK_VERSION,
    kind: 'mask',
    source: { width: probe.width, height: probe.height },
    mask,
    input: inputSize,
    fps: recipe.fps,
    spans,
    ep: loaded.ep,
    models: recipe.models,
    ...(recipe.static ? { static: true } : {}),
    bytes: position,
    generatedAt: new Date().toISOString(),
    frames,
  };
  const merged = mergeMaskIndex(existing, addition);
  const indexPart = `${files.index}.${process.pid}.part`;
  await fs.writeFile(indexPart, serializeMaskIndex(merged), 'utf-8');
  if (fresh) await fs.rename(target, files.blob);
  await fs.rename(indexPart, files.index);
  const elapsed = performance.now() - t0;
  const newBytes = frames.reduce((n, f) => n + f[2], 0);
  log.info('Mask track written', {
    assetId,
    ep: loaded.ep,
    input: `${inputSize.width}x${inputSize.height}`,
    mask: `${mask.width}x${mask.height}`,
    frames: frames.length,
    msPerFrame: frames.length ? Math.round(elapsed / frames.length) : 0,
    // Medians: the worker (inference alone), the round trip to it, deflate + write; the
    // rest of msPerFrame is waiting on the ffmpeg feed. The first frame carries the
    // DirectML warm-up (seconds), so it is reported apart.
    firstFrameMs: timing.worker[0] ?? 0,
    medianMs: {
      worker: median(timing.worker.slice(1)),
      infer: median(timing.infer.slice(1)),
      trip: median(timing.trip.slice(1)),
      store: median(timing.store.slice(1)),
    },
    bytesPerFrame: frames.length ? Math.round(newBytes / frames.length) : 0,
    spans: merged.spans.map((s) => s.map((v) => Math.round(v * 100) / 100)),
  });
  return { relPath: maskIndexRelPath(assetId), analysis: metaOf(merged, loaded.fallback) };
}

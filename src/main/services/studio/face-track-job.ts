// The `faceTrack` media job (docs/studio/FILTER_PACKS_DESIGN.md "Analysis
// tracks" → F3): frames of the asset's all-intra proxy (else its original)
// through the bundled ffmpeg at short side ≤ 512, each through the analysis
// process (YuNet → mesh → `faceFromLandmarks`), Face records rounded to four
// decimals and keyed by source seconds (`start + frame / fps`), written to
// `cache/analysis/<assetId>/faces-v1.json` with a header (frame size, fps,
// spans, the provider that ran, the model hashes). Computed per asset span
// and unioned with what an earlier run cached, so extending a clip analyses
// only the new seconds.

import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { analysisEngine } from '../../../analysis-engine/analysis-engine';
import { analysisModel, FACE_MODEL_IDS } from '../../../analysis-engine/model-manifest';
import {
  FACE_TRACK_MAX_FACES,
  FACE_TRACK_VERSION,
  faceTrackCompatible,
  faceTrackRelPath,
  mergeFaceTrack,
  missingSpans,
  parseFaceTrack,
  roundFace,
  roundTrackTime,
  serializeFaceTrack,
  settledSpanEnd,
  type AnalysisProvider,
  type FaceTrack,
  type FaceTrackFrame,
  type TrackSpan,
} from '../../../shared/studio/face-track';
import type { StudioAnalysisMeta } from '../../../shared/ipc/types/studio-analysis';
import { ensureAnalysisModels } from './analysis-models';
import { streamAnalysisFrames } from './analysis-frames';
import { getFfmpegBinary } from './ffmpeg-bin';
import { probeMedia } from './media-import';
import { getProjectCacheDir } from './studio-paths';

const log = logEngine.createLogger('StudioFaceTrack');

/** One refine pass from the mesh's own points, the way MediaPipe tracks (the spike's setting). */
const REFINE_PASSES = 1;

export interface FaceTrackJobOptions {
  assetKind: 'video' | 'image';
  /** The ready proxy's absolute path, or null to read the original. */
  proxyPath: string | null;
  /** Source-second spans the clips need. */
  spans: TrackSpan[];
  /** The project's fps — the track's sampling rate. */
  fps: number;
}

export interface FaceTrackJobResult {
  relPath: string;
  analysis: StudioAnalysisMeta;
}

/** The pinned model hashes — a track made with other models is a different track. */
function pinnedModels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of FACE_MODEL_IDS) out[id] = analysisModel(id).sha256;
  return out;
}

function headerFor(options: FaceTrackJobOptions): Pick<FaceTrack, 'fps' | 'models' | 'static'> {
  return { fps: options.assetKind === 'image' ? 1 : options.fps, models: pinnedModels(), ...(options.assetKind === 'image' ? { static: true } : {}) };
}

function metaOf(track: FaceTrack, fallback?: string): StudioAnalysisMeta {
  return { ep: track.ep, spans: track.spans, frames: track.frames.length, fps: track.fps, ...(fallback ? { fallback } : {}) };
}

export async function readFaceTrack(projectId: string, assetId: string): Promise<FaceTrack | null> {
  try {
    const file = path.join(await getProjectCacheDir(projectId), ...faceTrackRelPath(assetId).split('/'));
    return parseFaceTrack(JSON.parse(await fs.readFile(file, 'utf-8')));
  } catch {
    return null;
  }
}

/** What the wanted spans still need from a cached track: [] = the cache satisfies the request. */
function stillMissing(track: FaceTrack | null, options: FaceTrackJobOptions): TrackSpan[] {
  const header = headerFor(options);
  if (!track || !faceTrackCompatible(track, header)) return options.assetKind === 'image' ? [[0, 0]] : options.spans;
  if (options.assetKind === 'image') return track.frames.length > 0 ? [] : [[0, 0]];
  return missingSpans(track.spans, options.spans, 1 / options.fps);
}

/** The cached track when it already covers the request (the job need not run), else null. */
export async function faceTrackSatisfying(projectId: string, assetId: string, options: FaceTrackJobOptions): Promise<FaceTrackJobResult | null> {
  const track = await readFaceTrack(projectId, assetId);
  if (!track || stillMissing(track, options).length > 0) return null;
  return { relPath: faceTrackRelPath(assetId), analysis: metaOf(track) };
}

/** A span snapped to the frame grid, one frame past its end so the clip's last frame is inside. */
function gridSpan(span: TrackSpan, fps: number): { start: number; durationSec: number; frames: number; wanted: number } {
  const start = Math.floor(span[0] * fps + 1e-6) / fps;
  const frames = Math.max(1, Math.ceil((span[1] - start) * fps - 1e-6) + 1);
  return { start, durationSec: frames / fps, frames, wanted: span[1] };
}

export async function generateFaceTrack(
  projectId: string,
  assetId: string,
  sourcePath: string,
  options: FaceTrackJobOptions,
  signal: AbortSignal,
  onProgress: (percent: number, message?: string) => void,
): Promise<FaceTrackJobResult> {
  const throwIfAborted = () => {
    if (signal.aborted) throw new Error('Cancelled');
  };
  const cacheDir = await getProjectCacheDir(projectId);
  const relPath = faceTrackRelPath(assetId);
  const file = path.join(cacheDir, ...relPath.split('/'));
  await fs.mkdir(path.dirname(file), { recursive: true });

  // F1: the models, fetched on first use and verified before the load.
  const models = await ensureAnalysisModels(FACE_MODEL_IDS, (percent, message) => onProgress(percent, message), signal);
  throwIfAborted();

  const existing = await readFaceTrack(projectId, assetId);
  const todo = stillMissing(existing, options);
  if (todo.length === 0 && existing) return { relPath, analysis: metaOf(existing) };

  const loaded = await analysisEngine.loadFaces({ yunet: models.yunet.path, mesh: models['face-mesh'].path }, true);
  if (loaded.fallback) log.warn('DirectML unavailable in the analysis process — faces run on the CPU', { reason: loaded.fallback });
  else log.info('Face models loaded', { ep: loaded.ep, loadMs: loaded.loadMs });
  throwIfAborted();

  const input = options.proxyPath ?? sourcePath;
  const [ffmpeg, probe] = await Promise.all([getFfmpegBinary('ffmpeg'), probeMedia(input, options.assetKind)]);
  if (!probe.width || !probe.height) throw new Error('Could not read the frame size of the source');
  const still = options.assetKind === 'image';
  const fps = still ? 1 : options.fps;
  const header = headerFor(options);

  const plan = still ? [{ start: 0, durationSec: 0, frames: 1, wanted: 0 }] : todo.map((span) => gridSpan(span, fps));
  const totalFrames = plan.reduce((n, p) => n + p.frames, 0);
  let done = 0;
  let lastPercent = -1;
  const frames: FaceTrackFrame[] = [];
  const spans: TrackSpan[] = [];
  let frameSize = { width: probe.width, height: probe.height };
  const t0 = performance.now();
  for (const piece of plan) {
    throwIfAborted();
    const count = await streamAnalysisFrames(
      {
        ffmpeg,
        input,
        inputWidth: probe.width,
        inputHeight: probe.height,
        startSec: piece.start,
        durationSec: piece.durationSec,
        fps,
        still,
        signal,
      },
      async (rgb, index, size) => {
        frameSize = size;
        const faces = await analysisEngine.faces(rgb, size.width, size.height, FACE_TRACK_MAX_FACES, REFINE_PASSES);
        frames.push({ t: roundTrackTime(piece.start + index / fps), faces: faces.map(roundFace) });
        done++;
        const percent = Math.min(99, Math.floor((done / Math.max(totalFrames, 1)) * 100));
        if (percent !== lastPercent) {
          lastPercent = percent;
          onProgress(percent, 'Analyzing faces…');
        }
      },
    );
    // The span this run settles (face-track.ts `settledSpanEnd`): never short
    // of what was asked, or a source whose last frame sits before its probed
    // duration would be asked for the same tail forever.
    spans.push([piece.start, still ? 0 : settledSpanEnd(piece.wanted, piece.start, count, fps)]);
  }
  throwIfAborted();

  const addition: FaceTrack = {
    version: FACE_TRACK_VERSION,
    kind: 'faces',
    source: frameSize,
    fps: header.fps,
    spans,
    ep: loaded.ep as AnalysisProvider,
    models: header.models,
    ...(header.static ? { static: true } : {}),
    generatedAt: new Date().toISOString(),
    frames,
  };
  const merged = mergeFaceTrack(existing, addition);
  const part = `${file}.${process.pid}.part`;
  await fs.writeFile(part, serializeFaceTrack(merged), 'utf-8');
  await fs.rename(part, file);
  const elapsed = performance.now() - t0;
  log.info('Face track written', {
    assetId,
    ep: loaded.ep,
    frames: frames.length,
    msPerFrame: frames.length ? Math.round(elapsed / frames.length) : 0,
    spans: merged.spans.map((s) => s.map((v) => Math.round(v * 100) / 100)),
    faces: frames.filter((f) => f.faces.length > 0).length,
  });
  return { relPath, analysis: metaOf(merged, loaded.fallback) };
}

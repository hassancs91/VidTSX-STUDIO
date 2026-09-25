// The faces analysis track (docs/studio/FILTER_PACKS_DESIGN.md "Analysis
// tracks"): what the `faceTrack` media job writes to
// `cache/analysis/<assetId>/faces-v1.json` and what `FilteredPicture` reads
// per frame. Keyed by SOURCE seconds, so trim, split and speed just work and
// the Player (540p proxy) and the export (original) read the same track —
// coordinates are normalised to the frame, and the proxy and the original
// share the aspect.
//
// Pure: the job (main), the composition (renderer + render host) and the
// tests share it. No DOM, no Node.

import type { FilterFace, FilterPoint } from '../types/studio-effects';
import {
  mergeSpans,
  nearestFrameIndex,
  parseTrackSpans,
  roundTrackTime,
  sameTrackRecipe,
  type AnalysisProvider,
  type TrackSpan,
} from './analysis-track';
import type { MaskReader } from './mask-reader';

// The span helpers moved to analysis-track.ts (shared with the masks track);
// re-exported so the faces code keeps its imports.
export { mergeSpans, missingSpans, roundTrackTime, settledSpanEnd, spansCovered } from './analysis-track';
export type { AnalysisProvider, TrackSpan } from './analysis-track';

export const FACE_TRACK_VERSION = 1;
export const FACE_TRACK_FILE = 'faces-v1.json';
/** Coordinates and sizes are stored to this many decimals (~0.1 px at 1080p). */
export const FACE_TRACK_DECIMALS = 4;
/** Up to this many faces per frame are stored (the largest first, by detector score). */
export const FACE_TRACK_MAX_FACES = 4;

/** Cache-relative path of an asset's faces track (forward slashes — it goes over IPC). */
export function faceTrackRelPath(assetId: string): string {
  return `analysis/${assetId}/${FACE_TRACK_FILE}`;
}

export interface FaceTrackHeader {
  version: typeof FACE_TRACK_VERSION;
  kind: 'faces';
  /** The frame size the analysis ran on (short side ≤ 512). Informational: coordinates are normalised. */
  source: { width: number; height: number };
  /** Sampling rate — the project's fps at analysis time; a different fps is a different track. */
  fps: number;
  /** Source-second spans the track covers, sorted and merged. */
  spans: TrackSpan[];
  /** Execution provider of the latest run that wrote frames. */
  ep: AnalysisProvider;
  /** sha256 of the model files, so a model change is a different track. */
  models: Record<string, string>;
  /** A still image: the one frame applies at every time. */
  static?: boolean;
  generatedAt: string;
}

export interface FaceTrackFrame {
  /** Source seconds. */
  t: number;
  faces: FilterFace[];
}

export interface FaceTrack extends FaceTrackHeader {
  /** Sorted by `t`, unique. */
  frames: FaceTrackFrame[];
}

/** What a clip's `FilteredPicture` gets for its asset. */
export interface AnalysisTracks {
  faces?: FaceTrack;
  /**
   * The subject mask per source frame (mask-track.ts): a reader over the
   * deflated blobs — the Player's reads its bytes over IPC, the export's
   * from the asset server (FILTER_PACKS_DESIGN.md "As built (masks track)").
   */
  masks?: MaskReader;
}

const round = (value: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

const roundPoint = (p: FilterPoint): FilterPoint => ({ x: round(p.x, FACE_TRACK_DECIMALS), y: round(p.y, FACE_TRACK_DECIMALS) });

/** A Face record at the track's precision. */
export function roundFace(face: FilterFace): FilterFace {
  const out: FilterFace = {
    center: roundPoint(face.center),
    width: round(face.width, FACE_TRACK_DECIMALS),
    height: round(face.height, FACE_TRACK_DECIMALS),
    rotation: round(face.rotation, FACE_TRACK_DECIMALS),
    leftEye: roundPoint(face.leftEye),
    rightEye: roundPoint(face.rightEye),
    nose: roundPoint(face.nose),
    mouth: roundPoint(face.mouth),
    forehead: roundPoint(face.forehead),
  };
  if (typeof face.mouthOpen === 'number' && Number.isFinite(face.mouthOpen)) {
    out.mouthOpen = round(face.mouthOpen, FACE_TRACK_DECIMALS);
  }
  return out;
}

// ---- the file ---------------------------------------------------------------

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoint = (v: unknown): v is FilterPoint =>
  typeof v === 'object' && v !== null && finite((v as FilterPoint).x) && finite((v as FilterPoint).y);

function parseFace(raw: unknown): FilterFace | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const f = raw as Record<string, unknown>;
  if (
    !isPoint(f.center) || !isPoint(f.leftEye) || !isPoint(f.rightEye) || !isPoint(f.nose) || !isPoint(f.mouth) || !isPoint(f.forehead) ||
    !finite(f.width) || !finite(f.height) || !finite(f.rotation) || f.width <= 0 || f.height <= 0
  ) {
    return null;
  }
  const face: FilterFace = {
    center: f.center, width: f.width, height: f.height, rotation: f.rotation,
    leftEye: f.leftEye, rightEye: f.rightEye, nose: f.nose, mouth: f.mouth, forehead: f.forehead,
  };
  if (finite(f.mouthOpen)) face.mouthOpen = f.mouthOpen;
  return face;
}

/**
 * A track file's JSON → a `FaceTrack`, or null when it is not one this build
 * reads (wrong version, a malformed frame): the clip then plays plain and the
 * job rewrites the file. Frames come back sorted by time and unique.
 */
export function parseFaceTrack(raw: unknown): FaceTrack | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const doc = raw as Record<string, unknown>;
  if (doc.version !== FACE_TRACK_VERSION || doc.kind !== 'faces') return null;
  const source = doc.source as Record<string, unknown> | undefined;
  if (!source || !finite(source.width) || !finite(source.height) || !finite(doc.fps) || doc.fps <= 0) return null;
  const spans = parseTrackSpans(doc.spans);
  if (!spans) return null;
  if (doc.ep !== 'dml' && doc.ep !== 'cpu') return null;
  if (typeof doc.models !== 'object' || doc.models === null) return null;
  if (!Array.isArray(doc.frames)) return null;
  const byTime = new Map<number, FaceTrackFrame>();
  for (const item of doc.frames) {
    if (typeof item !== 'object' || item === null) return null;
    const frame = item as Record<string, unknown>;
    if (!finite(frame.t) || !Array.isArray(frame.faces)) return null;
    const faces: FilterFace[] = [];
    for (const face of frame.faces) {
      const parsed = parseFace(face);
      if (!parsed) return null;
      faces.push(parsed);
    }
    byTime.set(roundTrackTime(frame.t), { t: roundTrackTime(frame.t), faces });
  }
  const models: Record<string, string> = {};
  for (const [k, v] of Object.entries(doc.models as Record<string, unknown>)) if (typeof v === 'string') models[k] = v;
  return {
    version: FACE_TRACK_VERSION,
    kind: 'faces',
    source: { width: source.width, height: source.height },
    fps: doc.fps,
    spans: mergeSpans(spans),
    ep: doc.ep,
    models,
    ...(doc.static === true ? { static: true } : {}),
    generatedAt: typeof doc.generatedAt === 'string' ? doc.generatedAt : '',
    frames: [...byTime.values()].sort((a, b) => a.t - b.t),
  };
}

/** True when `existing` was made the same way `header` asks for — else it is discarded and rebuilt. */
export function faceTrackCompatible(existing: Pick<FaceTrackHeader, 'fps' | 'models' | 'static'>, header: Pick<FaceTrackHeader, 'fps' | 'models' | 'static'>): boolean {
  return sameTrackRecipe(existing, header);
}

/**
 * The union of two tracks of the same asset: frames keyed by time (the
 * addition wins where they overlap), spans merged, the header from the
 * addition (its `ep` is the latest run's). Extending a clip appends its new
 * frames to what an earlier run cached — nothing is recomputed.
 */
export function mergeFaceTrack(existing: FaceTrack | null, addition: FaceTrack): FaceTrack {
  if (!existing || !faceTrackCompatible(existing, addition)) {
    return { ...addition, spans: mergeSpans(addition.spans), frames: [...addition.frames].sort((a, b) => a.t - b.t) };
  }
  const byTime = new Map<number, FaceTrackFrame>();
  for (const frame of existing.frames) byTime.set(frame.t, frame);
  for (const frame of addition.frames) byTime.set(frame.t, frame);
  return {
    ...addition,
    spans: mergeSpans([...existing.spans, ...addition.spans], 1 / addition.fps),
    frames: [...byTime.values()].sort((a, b) => a.t - b.t),
  };
}

/** The file's text: one frame per line so a diff (or a person) can read it. */
export function serializeFaceTrack(track: FaceTrack): string {
  const { frames, ...header } = track;
  const lines = frames.map((f) => JSON.stringify(f));
  return `${JSON.stringify({ ...header, frames: [] }).slice(0, -2)}\n${lines.join(',\n')}\n]}`;
}

// ---- lookup -----------------------------------------------------------------

const NO_FACES: readonly FilterFace[] = Object.freeze([]);

/**
 * The faces at a source time: the nearest stored frame when it lies within
 * half a frame (at the track's rate), else none — a gap in the track plays
 * plain rather than borrowing a face from a second away. A static track (a
 * still) answers with its one frame at every time.
 */
export function facesAt(track: FaceTrack, time: number): readonly FilterFace[] {
  const frames = track.frames;
  const i = nearestFrameIndex(frames.length, (k) => frames[k].t, track.fps, time, track.static);
  return i < 0 ? NO_FACES : frames[i].faces;
}

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

export const FACE_TRACK_VERSION = 1;
export const FACE_TRACK_FILE = 'faces-v1.json';
/** Coordinates and sizes are stored to this many decimals (~0.1 px at 1080p). */
export const FACE_TRACK_DECIMALS = 4;
/** Frame times are stored to this many decimals — far below half a frame at any rate. */
const TIME_DECIMALS = 5;
/** Up to this many faces per frame are stored (the largest first, by detector score). */
export const FACE_TRACK_MAX_FACES = 4;

export type AnalysisProvider = 'dml' | 'cpu';

/** A closed range of source seconds `[start, end]`. */
export type TrackSpan = [start: number, end: number];

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

/** What a clip's `FilteredPicture` gets for its asset. Masks join later. */
export interface AnalysisTracks {
  faces?: FaceTrack;
}

const round = (value: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

export const roundTrackTime = (t: number): number => round(t, TIME_DECIMALS);

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

// ---- spans ------------------------------------------------------------------

/** Sorted union of spans; two spans closer than `gap` seconds join. */
export function mergeSpans(spans: readonly TrackSpan[], gap = 0): TrackSpan[] {
  const sorted = spans
    .filter((s) => Number.isFinite(s[0]) && Number.isFinite(s[1]) && s[1] >= s[0])
    .map((s): TrackSpan => [s[0], s[1]])
    .sort((a, b) => a[0] - b[0]);
  const out: TrackSpan[] = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (last && span[0] <= last[1] + gap) last[1] = Math.max(last[1], span[1]);
    else out.push(span);
  }
  return out;
}

/**
 * The parts of `wanted` that `covered` does not contain, each shrunk by
 * nothing and widened by nothing: the caller decides the margin. A wanted
 * span is satisfied when a covered span reaches within `tolerance` of both
 * of its ends (one frame at the track's rate, so a trim by a fraction of a
 * frame never re-queues a job).
 */
export function missingSpans(covered: readonly TrackSpan[], wanted: readonly TrackSpan[], tolerance: number): TrackSpan[] {
  const have = mergeSpans(covered);
  const out: TrackSpan[] = [];
  for (const want of mergeSpans(wanted)) {
    let cursor = want[0];
    for (const span of have) {
      if (span[1] < cursor - tolerance) continue;
      if (span[0] > want[1] + tolerance) break;
      if (span[0] > cursor + tolerance) out.push([cursor, Math.min(span[0], want[1])]);
      cursor = Math.max(cursor, span[1]);
      if (cursor >= want[1] - tolerance) break;
    }
    if (cursor < want[1] - tolerance) out.push([cursor, want[1]]);
  }
  return out;
}

/**
 * The end of the span one run settles: the last frame it got, and never
 * before the end that was asked for — a feed that stops early has reached
 * the source's last frame (a probed duration can sit a frame past it), so
 * asking again would loop on a tail that does not exist (met live
 * 2026-09-24: a 39.385 s probe on a source whose last frame is at 39.333 s
 * re-ran the job every second until this rule).
 */
export function settledSpanEnd(wantedEnd: number, start: number, frames: number, fps: number): number {
  return Math.max(wantedEnd, start + Math.max(0, frames - 1) / fps);
}

/** True when every wanted span is inside the covered ones (within `tolerance`). */
export function spansCovered(covered: readonly TrackSpan[], wanted: readonly TrackSpan[], tolerance: number): boolean {
  return missingSpans(covered, wanted, tolerance).length === 0;
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

function parseSpans(raw: unknown): TrackSpan[] | null {
  if (!Array.isArray(raw)) return null;
  const spans: TrackSpan[] = [];
  for (const s of raw) {
    if (!Array.isArray(s) || s.length !== 2 || !finite(s[0]) || !finite(s[1]) || s[1] < s[0]) return null;
    spans.push([s[0], s[1]]);
  }
  return spans;
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
  const spans = parseSpans(doc.spans);
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
  if (existing.fps !== header.fps || (existing.static ?? false) !== (header.static ?? false)) return false;
  const keys = new Set([...Object.keys(existing.models), ...Object.keys(header.models)]);
  for (const key of keys) if (existing.models[key] !== header.models[key]) return false;
  return true;
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
  if (frames.length === 0 || !Number.isFinite(time)) return NO_FACES;
  if (track.static) return frames[0].faces;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t < time) lo = mid + 1;
    else hi = mid;
  }
  let best = frames[lo];
  if (lo > 0 && Math.abs(frames[lo - 1].t - time) < Math.abs(best.t - time)) best = frames[lo - 1];
  // Half a frame plus a hair, so a time that lands exactly between two frames
  // (float rounding on either side) still resolves.
  return Math.abs(best.t - time) <= 0.5 / track.fps + 1e-6 ? best.faces : NO_FACES;
}

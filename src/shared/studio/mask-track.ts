// The masks analysis track (docs/studio/FILTER_PACKS_DESIGN.md "Analysis
// tracks" → "As built (masks track)"): what the `subjectMask` media job
// writes under `cache/analysis/<assetId>/` and what the mask reader serves
// per frame.
//
//   mask-v1.bin   the blobs: one zlib-deflated 8-bit alpha map per frame
//                 (`mask.width × mask.height` bytes inflated, row-major,
//                 0 = background, 255 = subject), APPEND-ONLY — a later run
//                 appends its frames and never moves an earlier byte, so a
//                 reader holding an older index still reads valid blobs.
//   mask-v1.json  the index: the header + `frames` = [t, offset, length]
//                 sorted by t (source seconds, 5 decimals); `bytes` = how
//                 much of the bin the index describes (anything past it is a
//                 cancelled run's tail and is truncated by the next run).
//
// A mask is normalised to the whole source frame (the contract's
// `FilterSubjectMask`), so the Player's proxy and the export's original read
// the same blobs; the host relabels `sourceWidth/Height` to whatever it draws.
//
// Pure: the job (main), the readers and the tests share it.

import {
  mergeSpans,
  nearestFrameIndex,
  parseTrackSpans,
  roundTrackTime,
  sameTrackRecipe,
  type AnalysisProvider,
  type TrackSpan,
} from './analysis-track';

export const MASK_TRACK_VERSION = 1;
export const MASK_BLOB_FILE = 'mask-v1.bin';
export const MASK_INDEX_FILE = 'mask-v1.json';
/** The contract's cap: a subject mask is at most this many pixels on its long side. */
export const MASK_MAX_SIDE = 256;

/** Cache-relative path of an asset's mask index (forward slashes — it goes over IPC). */
export function maskIndexRelPath(assetId: string): string {
  return `analysis/${assetId}/${MASK_INDEX_FILE}`;
}

/** Cache-relative path of an asset's mask blobs. */
export function maskBlobRelPath(assetId: string): string {
  return `analysis/${assetId}/${MASK_BLOB_FILE}`;
}

export interface Size {
  width: number;
  height: number;
}

/** The stored mask size for a source: long side at the cap (never upscaled), the aspect kept. */
export function maskSizeFor(width: number, height: number): Size {
  const long = Math.max(width, height);
  const scale = long > MASK_MAX_SIDE ? MASK_MAX_SIDE / long : 1;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface MaskTrackHeader {
  version: typeof MASK_TRACK_VERSION;
  kind: 'mask';
  /** The frame size the feed read (proxy or original). Informational. */
  source: Size;
  /** Every blob inflates to exactly this many pixels. */
  mask: Size;
  /** The model's input size of the latest run (short side 512 on DirectML, 352 on the CPU fallback). */
  input: Size;
  /** Sampling rate — the project's fps at analysis time; a different fps is a different track. */
  fps: number;
  /** Source-second spans the track covers, sorted and merged. */
  spans: TrackSpan[];
  /** Execution provider of the latest run that wrote frames. */
  ep: AnalysisProvider;
  /** sha256 of the model file, so a model change is a different track. */
  models: Record<string, string>;
  /** A still image: the one frame applies at every time. */
  static?: boolean;
  /** Bytes of the bin this index describes. */
  bytes: number;
  generatedAt: string;
}

/** `[t, offset, length]`: source seconds, where the blob starts in the bin, its deflated size. */
export type MaskFrameEntry = [t: number, offset: number, length: number];

export interface MaskTrackIndex extends MaskTrackHeader {
  /** Sorted by `t`, unique. */
  frames: MaskFrameEntry[];
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const positiveInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

function parseSize(raw: unknown): Size | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  return positiveInt(s.width) && positiveInt(s.height) ? { width: s.width, height: s.height } : null;
}

/**
 * An index file's JSON → a `MaskTrackIndex`, or null when it is not one this
 * build reads (wrong version, a mask over the cap, a blob outside `bytes`):
 * the clip then plays plain and the job rebuilds the track.
 */
export function parseMaskIndex(raw: unknown): MaskTrackIndex | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const doc = raw as Record<string, unknown>;
  if (doc.version !== MASK_TRACK_VERSION || doc.kind !== 'mask') return null;
  const source = parseSize(doc.source);
  const mask = parseSize(doc.mask);
  const input = parseSize(doc.input);
  if (!source || !mask || !input || mask.width > MASK_MAX_SIDE || mask.height > MASK_MAX_SIDE) return null;
  if (!finite(doc.fps) || doc.fps <= 0 || !Number.isInteger(doc.bytes) || (doc.bytes as number) < 0) return null;
  const bytes = doc.bytes as number;
  const spans = parseTrackSpans(doc.spans);
  if (!spans) return null;
  if (doc.ep !== 'dml' && doc.ep !== 'cpu') return null;
  if (typeof doc.models !== 'object' || doc.models === null || !Array.isArray(doc.frames)) return null;
  const byTime = new Map<number, MaskFrameEntry>();
  for (const item of doc.frames) {
    if (!Array.isArray(item) || item.length !== 3) return null;
    const [t, offset, length] = item as unknown[];
    if (!finite(t) || !Number.isInteger(offset) || !positiveInt(length)) return null;
    if ((offset as number) < 0 || (offset as number) + length > bytes) return null;
    const time = roundTrackTime(t);
    byTime.set(time, [time, offset as number, length]);
  }
  const models: Record<string, string> = {};
  for (const [k, v] of Object.entries(doc.models as Record<string, unknown>)) if (typeof v === 'string') models[k] = v;
  return {
    version: MASK_TRACK_VERSION,
    kind: 'mask',
    source,
    mask,
    input,
    fps: doc.fps,
    spans: mergeSpans(spans),
    ep: doc.ep,
    models,
    ...(doc.static === true ? { static: true } : {}),
    bytes,
    generatedAt: typeof doc.generatedAt === 'string' ? doc.generatedAt : '',
    frames: [...byTime.values()].sort((a, b) => a[0] - b[0]),
  };
}

/**
 * True when `existing` was made the same way `header` asks for: same fps,
 * still-ness and model, and the same stored mask size (the blobs of one
 * track all inflate to one size) — else it is discarded and rebuilt.
 */
export function maskTrackCompatible(
  existing: Pick<MaskTrackHeader, 'fps' | 'models' | 'static' | 'mask'>,
  header: Pick<MaskTrackHeader, 'fps' | 'models' | 'static' | 'mask'>,
): boolean {
  return sameTrackRecipe(existing, header) && existing.mask.width === header.mask.width && existing.mask.height === header.mask.height;
}

/**
 * The union of two indexes over ONE append-only bin: frames keyed by time
 * (the addition wins — its blobs sit later in the bin), spans merged, the
 * header from the addition (its `ep`, `input` and `bytes` are the latest
 * run's). An incompatible `existing` is dropped: the addition then describes
 * a fresh bin on its own.
 */
export function mergeMaskIndex(existing: MaskTrackIndex | null, addition: MaskTrackIndex): MaskTrackIndex {
  if (!existing || !maskTrackCompatible(existing, addition)) {
    return { ...addition, spans: mergeSpans(addition.spans), frames: [...addition.frames].sort((a, b) => a[0] - b[0]) };
  }
  const byTime = new Map<number, MaskFrameEntry>();
  for (const frame of existing.frames) byTime.set(frame[0], frame);
  for (const frame of addition.frames) byTime.set(frame[0], frame);
  return {
    ...addition,
    bytes: Math.max(existing.bytes, addition.bytes),
    spans: mergeSpans([...existing.spans, ...addition.spans], 1 / addition.fps),
    frames: [...byTime.values()].sort((a, b) => a[0] - b[0]),
  };
}

/** The index file's text: the header on one line, then one frame per line. */
export function serializeMaskIndex(index: MaskTrackIndex): string {
  const { frames, ...header } = index;
  const lines = frames.map((f) => JSON.stringify(f));
  return `${JSON.stringify({ ...header, frames: [] }).slice(0, -2)}\n${lines.join(',\n')}\n]}`;
}

/**
 * The position in `frames` of the entry for a source time: the nearest
 * stored frame within half a frame (the faces rule), else -1 — a gap plays
 * plain. A still's one frame answers at every time.
 */
export function maskEntryIndexAt(index: Pick<MaskTrackIndex, 'frames' | 'fps' | 'static'>, time: number): number {
  const frames = index.frames;
  return nearestFrameIndex(frames.length, (k) => frames[k][0], index.fps, time, index.static);
}

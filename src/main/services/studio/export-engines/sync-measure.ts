/**
 * T8 "Check this export": the pure measuring half, ported from the editor's
 * `tools/verify_sync.py` (`SourceAudio.locate`, `match_frame`, `measure`).
 *
 * For one probe the export's audio window is located in the camera file's
 * audio (normalised cross-correlation, parabolic sub-sample peak), and the
 * export's frame is located among the camera frames within ±0.8 s of where
 * the audio says (z-score correlation of gray thumbnails, integer frame).
 * The sync error is picture time − audio time in the camera file, in ms:
 * positive = the audio is BEHIND the picture. No I/O here; the ffmpeg side
 * is `export-sync-check.ts`.
 */
import type { SyncRect, SyncSize } from '../../../../shared/studio/sync-probes';

/** verify_sync's `SR`: audio is compared at 8 kHz mono. */
export const SYNC_AUDIO_RATE = 8000;
/** How far either side of the planned camera time the audio search reaches. */
export const SYNC_AUDIO_SEARCH_SEC = 0.5;
export const SYNC_MIN_AUDIO_QUALITY = 0.5;
/** A window quieter than this (int16 RMS 50) is silence — nothing to locate. */
export const SYNC_SILENCE_RMS = 50 / 32768;
export const SYNC_MIN_MATCH = 0.9;
export const SYNC_FRAME_BEFORE_SEC = 0.8;
export const SYNC_FRAME_COUNT = 96;
export const SYNC_THUMB_LONG = 192;

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

export interface AudioLocation {
  /** Sub-sample position of the needle's first sample in the haystack. */
  lag: number;
  /** Peak normalised correlation, 1 = identical up to gain. */
  quality: number;
}

/** Where `needle` sits in `haystack` (every lag tried; amplitude-blind). Null when it cannot fit or either side is silent. */
export function locateAudio(needle: Float32Array, haystack: Float32Array): AudioLocation | null {
  const n = needle.length;
  const lags = haystack.length - n + 1;
  if (n === 0 || lags < 1) return null;
  let needleEnergy = 0;
  for (let i = 0; i < n; i++) needleEnergy += needle[i] * needle[i];
  if (needleEnergy === 0) return null;

  const energy = new Float64Array(haystack.length + 1);
  for (let i = 0; i < haystack.length; i++) energy[i + 1] = energy[i] + haystack[i] * haystack[i];

  const scores = new Float64Array(lags);
  let best = -1;
  for (let lag = 0; lag < lags; lag++) {
    const windowEnergy = energy[lag + n] - energy[lag];
    if (windowEnergy <= 0) continue;
    let dot = 0;
    for (let i = 0; i < n; i++) dot += needle[i] * haystack[lag + i];
    scores[lag] = dot / Math.sqrt(needleEnergy * windowEnergy);
    if (best < 0 || scores[lag] > scores[best]) best = lag;
  }
  if (best < 0) return null;

  let lag = best;
  if (best > 0 && best < lags - 1) {
    const y0 = scores[best - 1];
    const y1 = scores[best];
    const y2 = scores[best + 1];
    const denom = y0 - 2 * y1 + y2;
    if (denom < 0) lag = best + (0.5 * (y0 - y2)) / denom;
  }
  return { lag, quality: scores[best] };
}

const countOf = (mask: Uint8Array | undefined, n: number) => (mask ? mask.reduce((a, b) => a + b, 0) : n);

/** (x − mean) / std over the image (or only its masked pixels; the rest are 0); a flat image is all zeros. */
export function zscore(values: ArrayLike<number>, mask?: Uint8Array): Float32Array {
  const n = values.length;
  const out = new Float32Array(n);
  const count = countOf(mask, n);
  if (count === 0) return out;
  let mean = 0;
  for (let i = 0; i < n; i++) if (!mask || mask[i]) mean += values[i];
  mean /= count;
  let variance = 0;
  for (let i = 0; i < n; i++) if (!mask || mask[i]) variance += (values[i] - mean) ** 2;
  const std = Math.sqrt(variance / count);
  if (std === 0) return out;
  for (let i = 0; i < n; i++) if (!mask || mask[i]) out[i] = (values[i] - mean) / std;
  return out;
}

export interface FrameMatch {
  index: number;
  quality: number;
}

/**
 * verify_sync `match_frame`: the window frame most like `frame`
 * (`zscore(win) · zscore(frame) / size`), over the masked pixels only when a
 * layout mask is given.
 */
export function matchFrame(frame: Uint8Array, window: readonly Uint8Array[], mask?: Uint8Array): FrameMatch {
  const target = zscore(frame, mask);
  const count = countOf(mask, target.length);
  let best: FrameMatch = { index: -1, quality: -Infinity };
  if (count === 0) return best;
  window.forEach((candidate, index) => {
    if (candidate.length !== target.length) return;
    const z = zscore(candidate, mask);
    let dot = 0;
    for (let i = 0; i < z.length; i++) dot += z[i] * target[i];
    const quality = dot / count;
    if (quality > best.quality) best = { index, quality };
  });
  return best;
}

/** A pixel stays in the layout mask when its median z-residual across the probes is below this. */
export const SYNC_MASK_RESIDUAL = 0.4;
export const SYNC_MASK_MIN_FRACTION = 0.25;
export const SYNC_MASK_MIN_PROBES = 3;

/**
 * Where the export really shows the camera picture inside the planned box.
 * A transparent overlay shot may still paint over part of the box (video-14's
 * split: a card frame and page background cover ~60 % of the PiP), which no
 * document field says. Each probe's pass-1 best frame is near the shown frame,
 * so per pixel the z-residual |z(target) − z(best)| is small where the camera
 * is visible and large where a graphic covers it; the median across ≥ 3
 * probes makes it a property of the layout, not of one probe. Null when too
 * few probes or too little of the box is left.
 */
export function layoutMask(
  pairs: ReadonlyArray<{ target: Uint8Array; best: Uint8Array }>,
  threshold = SYNC_MASK_RESIDUAL,
  minFraction = SYNC_MASK_MIN_FRACTION,
): Uint8Array | null {
  if (pairs.length < SYNC_MASK_MIN_PROBES) return null;
  const size = pairs[0].target.length;
  if (pairs.some((p) => p.target.length !== size || p.best.length !== size)) return null;
  const residuals = pairs.map((p) => {
    const a = zscore(p.target);
    const b = zscore(p.best);
    return Float32Array.from(a, (v, i) => Math.abs(v - b[i]));
  });
  const mask = new Uint8Array(size);
  const column = new Float32Array(residuals.length);
  const mid = residuals.length >> 1;
  for (let i = 0; i < size; i++) {
    for (let k = 0; k < residuals.length; k++) column[k] = residuals[k][i];
    column.sort();
    const median = residuals.length % 2 ? column[mid] : (column[mid - 1] + column[mid]) / 2;
    if (median < threshold) mask[i] = 1;
  }
  return countOf(mask, size) / size >= minFraction ? mask : null;
}

/**
 * Input seek that makes frame `n` (pts n / fps) the first decoded frame: an
 * accurate seek drops every frame before the seek time, so half a frame early
 * keeps n and drops n − 1 (frame-diff.ts, checked again 2026-10-22 on the
 * video-14 export and master).
 */
export function exactFrameSeek(frame: number, fps: number): number {
  return frame <= 0 ? 0 : (frame - 0.5) / fps;
}

export interface FrameWindow {
  first: number;
  count: number;
  seekSec: number;
}

/** The camera frames to search: from 0.8 s before the audio's time, 96 of them (verify_sync `measure`). */
export function sourceFrameWindow(audioSec: number, fps: number, beforeSec = SYNC_FRAME_BEFORE_SEC, count = SYNC_FRAME_COUNT): FrameWindow {
  const first = Math.max(0, Math.ceil((audioSec - beforeSec) * fps - 1e-9));
  return { first, count, seekSec: exactFrameSeek(first, fps) };
}

const roundEven = (v: number) => Math.max(2, Math.round(v / 2) * 2);

/** Thumbnail size for a crop: long side 192 (verify_sync's 192×108 for 16:9), even sides. */
export function thumbSize(rect: SyncSize, long = SYNC_THUMB_LONG): SyncSize {
  const scale = long / Math.max(rect.width, rect.height);
  return { width: roundEven(rect.width * scale), height: roundEven(rect.height * scale) };
}

export function cropScaleFilter(rect: SyncRect, thumb: SyncSize): string {
  return `crop=${rect.width}:${rect.height}:${rect.x}:${rect.y},scale=${thumb.width}:${thumb.height}:flags=area,format=gray`;
}

export type SyncProbeStatus = 'ok' | 'silent' | 'low-audio' | 'low-video';

export interface ProbeMeasurement {
  windowRms: number;
  /** Where the audio says this moment is in the camera file. */
  audio: { sec: number; quality: number } | null;
  /** Where the picture says it is. */
  video: { sec: number; quality: number } | null;
}

export interface ProbeThresholds {
  minMatch?: number;
  minAudioQuality?: number;
  silenceRms?: number;
}

export type ProbeOutcome = { status: 'ok'; errorMs: number } | { status: Exclude<SyncProbeStatus, 'ok'> };

export function classifyProbe(m: ProbeMeasurement, thresholds: ProbeThresholds = {}): ProbeOutcome {
  if (m.windowRms < (thresholds.silenceRms ?? SYNC_SILENCE_RMS)) return { status: 'silent' };
  if (!m.audio || m.audio.quality < (thresholds.minAudioQuality ?? SYNC_MIN_AUDIO_QUALITY)) return { status: 'low-audio' };
  if (!m.video || m.video.quality < (thresholds.minMatch ?? SYNC_MIN_MATCH)) return { status: 'low-video' };
  return { status: 'ok', errorMs: Math.round((m.video.sec - m.audio.sec) * 10_000) / 10 };
}

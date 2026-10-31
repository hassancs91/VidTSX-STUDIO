/**
 * How much disk one Studio export needs (docs/studio/END_TO_END_PLAN.md §2 T7, part A2):
 * the finished file on the output drive, and the peak of the job's scratch folder in
 * `%TEMP%` — the engine's intermediate, the audio WAV, Fastest's shot layer, and
 * Remotion's own copy of every source file a browser render reads
 * (`remotion-v4.0.435-assets*`, a full copy of each file however short the range).
 *
 * Deliberately on the high side: a refusal names its numbers, and an export that dies
 * with a full disk halfway through costs far more than one re-run after freeing space.
 */
import type { ExportEngineId } from '../../../../shared/studio/export-engines';

export interface DiskEstimateSource {
  /** Size of the file on disk (Remotion copies all of it). */
  bytes: number;
  /** The file's own length in seconds (its probe); 0 when unknown. */
  durationSeconds: number;
  /** Timeline seconds that show this file's picture (0 for audio-only use). */
  videoSeconds: number;
}

export interface ExportDiskEstimateInput {
  engineId: ExportEngineId;
  /** Output W×H (after the render scale). */
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** Absent = Remotion's H.264 default (18). */
  crf?: number;
  /** Every distinct file the export's browser renders read. */
  sources: DiskEstimateSource[];
  /** Fastest only: the longest run of timeline seconds under shots (one ProRes layer lives at a time). */
  longestShotRunSeconds?: number;
}

export interface ExportDiskEstimate {
  /** The finished file, on the output drive. */
  outputBytes: number;
  /** Peak of the job's scratch folder, on the `%TEMP%` drive. */
  tempBytes: number;
  /** The parts of `tempBytes`. */
  temp: { remotionCopies: number; intermediate: number; audio: number; shotLayers: number };
}

export const DEFAULT_H264_CRF = 18;
/** H.264 at CRF 18: ~0.15 bit per pixel per frame on screen/camera material (1080p30 ≈ 9 Mb/s). */
const H264_BITS_PER_PIXEL_AT_CRF18 = 0.15;
/** Every +6 CRF halves the bitrate (x264's rule of thumb). */
const CRF_HALVING_STEP = 6;
/** The audio pass / the Standard engine's in-pass audio: 48 kHz stereo 16-bit PCM. */
export const PCM_BYTES_PER_SECOND = 48_000 * 2 * 2;
/** The finishing stage's AAC (`AAC_ENCODE_ARGS`, 320 kb/s). */
export const AAC_BYTES_PER_SECOND = 320_000 / 8;
/** ProRes 4444 (Fastest's transparent shot layer): Apple's 330 Mb/s at 1080p29.97 ≈ 5.3 bits per pixel. */
const PRORES_4444_BITS_PER_PIXEL = 5.5;

/** Bytes per second of the H.264 the browser engines encode at this size and CRF. */
export function h264BytesPerSecond(width: number, height: number, fps: number, crf = DEFAULT_H264_CRF): number {
  const bitsPerPixel = H264_BITS_PER_PIXEL_AT_CRF18 * 2 ** ((DEFAULT_H264_CRF - crf) / CRF_HALVING_STEP);
  return (width * height * fps * bitsPerPixel) / 8;
}

export function estimateExportDisk(input: ExportDiskEstimateInput): ExportDiskEstimate {
  const seconds = input.fps > 0 ? input.durationInFrames / input.fps : 0;
  const encodedRate = h264BytesPerSecond(input.width, input.height, input.fps, input.crf);
  const remotionCopies = sum(input.sources.map((s) => s.bytes));
  const audio = Math.ceil(seconds * PCM_BYTES_PER_SECOND);
  const aac = Math.ceil(seconds * AAC_BYTES_PER_SECOND);

  if (input.engineId === 'remotion') {
    // Every frame is encoded; the in-pass PCM rides in the same `.mkv` (counted as `audio`).
    const video = Math.ceil(seconds * encodedRate);
    return finish({ outputBytes: video + aac, remotionCopies, intermediate: video, audio, shotLayers: 0 });
  }

  // The copy engines: each second of picture is either copied from its source or encoded,
  // so its rate is at most the larger of the two; seconds with no source picture are encoded.
  let video = 0;
  let pictureSeconds = 0;
  for (const source of input.sources) {
    if (source.videoSeconds <= 0) continue;
    video += source.durationSeconds > 0
      ? Math.max(source.bytes / source.durationSeconds, encodedRate) * source.videoSeconds
      // An unknown length: the whole file bounds the copy (it cannot copy more than all of it).
      : Math.max(source.bytes, encodedRate * source.videoSeconds);
    pictureSeconds += source.videoSeconds;
  }
  video += Math.max(0, seconds - pictureSeconds) * encodedRate;
  video = Math.ceil(video);
  const shotLayers = input.engineId === 'shot-composite'
    ? Math.ceil(((input.longestShotRunSeconds ?? 0) * input.width * input.height * input.fps * PRORES_4444_BITS_PER_PIXEL) / 8)
    : 0;
  // The pieces are joined by the finishing mux straight into the output (no joined copy).
  return finish({ outputBytes: video + aac, remotionCopies, intermediate: video, audio, shotLayers });
}

function finish(parts: { outputBytes: number; remotionCopies: number; intermediate: number; audio: number; shotLayers: number }): ExportDiskEstimate {
  const { outputBytes, ...temp } = parts;
  return { outputBytes, tempBytes: sum(Object.values(temp)), temp };
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + (Number.isFinite(v) && v > 0 ? v : 0), 0);
}

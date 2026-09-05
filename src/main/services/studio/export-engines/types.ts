/**
 * The export-engine seam (docs/export-engines-plan.md D1, D7).
 *
 * An engine turns a prepared Studio export (the generated Remotion entry, its
 * bundle, the trimmed document) into VIDEO FRAMES in a file. Everything after
 * that — the one audio pass over the whole timeline, the mux, the colour tags
 * — is the shared finishing stage (`finishing.ts`), so two exports of one
 * project differ only in how the frames were produced.
 */
import type { StudioProject } from '../../../../shared/types/studio';
import type { ExportEngineId } from '../../../../shared/studio/export-engines';
import type { RenderGpuBackend, RenderHardwareAcceleration } from '../../../../shared/ipc/types';
import type { StudioExportEntry } from '../export-entry';

/**
 * The colour policy every engine encodes to (D7): the tags camera files and
 * the passthrough carry, not Remotion's default `yuvj420p pc bt470bg`. The
 * finishing stage verifies the engine's output against it.
 */
export interface ExportColorPolicy {
  pixelFormat: 'yuv420p';
  range: 'tv';
  matrix: 'bt709';
  primaries: 'bt709';
  transfer: 'bt709';
}

export const EXPORT_COLOR: ExportColorPolicy = {
  pixelFormat: 'yuv420p',
  range: 'tv',
  matrix: 'bt709',
  primaries: 'bt709',
  transfer: 'bt709',
};

/** Encoder knobs the queue already carries; engines honour what applies. */
export interface ExportRenderSettings {
  crf?: number;
  cpuUsage?: string | null;
  gpuBackend?: RenderGpuBackend;
  hardwareAcceleration?: RenderHardwareAcceleration;
  timeoutInMilliseconds: number;
}

export interface ExportProgress {
  framesDone: number;
  totalFrames: number;
  /** Shown in the queue while the engine works (the D4 notice, later). */
  message?: string;
}

export interface ExportEngineInput {
  jobId: string;
  /** The document the entry was generated from (range-trimmed for a range export). */
  project: StudioProject;
  entry: StudioExportEntry;
  bundleUrl: string;
  /** Scratch folder owned by this export; the orchestrator removes it. */
  workDir: string;
  render: ExportRenderSettings;
  color: ExportColorPolicy;
  signal: AbortSignal;
  onProgress: (progress: ExportProgress) => void;
  onEncoderResolved?: (info: { encoderName: string; hardwareAccelerated: boolean }) => void;
}

export interface ExportEngineProduct {
  /** Video file (any container ffmpeg reads) tagged per `input.color`. */
  videoPath: string;
  /**
   * The whole-timeline audio, when the engine's one pass produced it (the
   * Remotion engine mixes it in the same browser walk — a second walk would
   * re-download every source: measured 7 min against 8.6 min of frames on
   * t5-1080p). PCM preferred; the finishing stage does the only AAC encode.
   * Absent → the finishing stage renders the audio itself (`audio-pass.ts`).
   * May be the same file as `videoPath`.
   */
  audioPath?: string;
  /** Notes for the queue record ("copied 87 % of this timeline"). */
  notes?: string[];
}

export interface ExportEngine {
  id: ExportEngineId;
  /** Main-process fact the picker greys out on (a missing optional binary). */
  availability(): Promise<{ available: true } | { available: false; reason: string }>;
  produce(input: ExportEngineInput): Promise<ExportEngineProduct>;
}

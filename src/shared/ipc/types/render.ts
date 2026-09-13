import type { ExportEngineId } from '../../studio/export-engines';

// ─── Render operations ───
// Render operations
// 'webp' renders an animated WebP via the frame-sequence pipeline in
// src/main/services/webp/ (no Remotion codec exists for it). For that codec
// only, `crf` carries the WebP quality 1–100 (higher = better, 100 =
// lossless) instead of an ffmpeg CRF — reusing the field keeps the queue DB
// schema and IPC contracts unchanged.
export type RenderCodec = 'h264' | 'h265' | 'vp8' | 'vp9' | 'gif' | 'prores' | 'webp';

// Maps to Chromium's --use-gl flag, passed via Remotion's chromiumOptions.gl.
// Software backends (swangle/swiftshader) work everywhere; GPU backends
// (angle/angle-egl/egl/vulkan) need compatible drivers and may crash.
export type RenderGpuBackend = 'swangle' | 'swiftshader' | 'angle' | 'angle-egl' | 'egl' | 'vulkan';

// Maps to Remotion's renderMedia({ hardwareAcceleration }). 'if-possible' uses
// GPU video encoders (NVENC/QSV/AMF/VideoToolbox) when available and falls
// back to CPU silently. 'required' fails if no hardware encoder is available.
export type RenderHardwareAcceleration = 'disable' | 'if-possible' | 'required';

export interface RenderStartRequest {
  filePath: string;
  bundleUrl?: string;
  compositionId: string;
  outputPath: string;
  codec: RenderCodec;
  width: number;
  height: number;
  fps: number;
  crf?: number;
  muted?: boolean;
  scale?: number;
  everyNthFrame?: number;
  numberOfGifLoops?: number | null;
  inputProps?: Record<string, unknown>;
  transparent?: boolean;
  cpuUsage?: string | null;
  gpuBackend?: RenderGpuBackend;
  hardwareAcceleration?: RenderHardwareAcceleration;
  /** Studio exports only: route through this export engine + the shared
   *  finishing stage (docs/export-engines-plan.md). Absent = the plain
   *  Remotion render every other composition gets. */
  exportEngine?: ExportEngineId;
  /** Dev verification mode (D5): also export through this engine and report
   *  the pixel diff + audio offset between the two. Ignored in packaged builds. */
  verifyAgainstEngine?: ExportEngineId;
}

export interface RenderStartResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface RenderCancelRequest {
  jobId: string;
}

export interface RenderCancelResponse {
  success: boolean;
  error?: string;
}

// 'finishing' = the export engines' shared finishing stage (audio pass + mux);
// 'verifying' = the dev-only second export + diff (D5).
export type RenderPhase = 'preparing' | 'extracting_audio' | 'bundling' | 'rendering' | 'finishing' | 'verifying';

export interface RenderProgressEvent {
  jobId: string;
  phase: RenderPhase;
  percent: number;
  framesRendered?: number;
  totalFrames?: number;
  message?: string;
}

export interface RenderCompleteEvent {
  jobId: string;
  success: boolean;
  outputPath?: string;
  fileSize?: number;
  error?: string;
  /** Engine notes for the queue record (e.g. the verification summary). */
  message?: string;
  /** Verification report (D5) written beside the export, when it ran. */
  reportPath?: string;
}

// Fired once per render when ffmpeg's encoder choice is resolved — lets the
// UI show whether 'if-possible' actually engaged a hardware encoder (NVENC/
// QSV/AMF/VideoToolbox) or fell back to CPU (libx264/libx265).
export interface RenderEncoderResolvedEvent {
  jobId: string;
  encoderName: string;
  hardwareAccelerated: boolean;
}

export type RenderJobStatus = 'pending' | 'rendering' | 'completed' | 'failed' | 'cancelled';

export interface RenderJob {
  jobId: string;
  compositionId: string;
  outputPath: string;
  status: RenderJobStatus;
  progress: number;
  error?: string;
}

export interface RenderQueueGetRequest {}

export interface RenderQueueGetResponse {
  jobs: RenderJob[];
}

// ─── Render queue persistence types ───
// Render queue persistence types
export type RenderQueueJobStatus = 'queued' | 'rendering' | 'done' | 'error' | 'cancelled';

export interface RenderQueueJob {
  id: string;
  fileName: string;
  filePath: string;
  bundleUrl?: string;
  compositionId: string;
  outputPath: string;
  codec: RenderCodec;
  width: number;
  height: number;
  fps: number;
  crf?: number;
  muted?: boolean;
  scale?: number;
  everyNthFrame?: number;
  numberOfGifLoops?: number | null;
  inputProps?: Record<string, unknown>;
  transparent?: boolean;
  cpuUsage?: string | null;
  gpuBackend?: RenderGpuBackend;
  hardwareAcceleration?: RenderHardwareAcceleration;
  exportEngine?: ExportEngineId;
  verifyAgainstEngine?: ExportEngineId;
  /** Studio exports: 'proxy' = a draft read from the preview proxies (queue-row badge). */
  exportSource?: import('../../studio/export-source').ExportSource;
  /** Free text the engine attached on completion (verification summary, D4 notice). */
  message?: string;
  reportPath?: string;
  // Resolved once ffmpeg starts — ground truth about whether the HW-encoding
  // preference actually picked a hardware encoder or fell back to CPU.
  encoderName?: string;
  encoderHardwareAccelerated?: boolean;
  status: RenderQueueJobStatus;
  progress: number;
  framesRendered: number;
  totalFrames: number;
  fileSize?: number;
  error?: string;
  createdAt: number;
  // Stamped when the job transitions from 'queued' to 'rendering'. Distinct
  // from createdAt (which is when the job was added to the queue) so elapsed
  // time and avg FPS can be computed from actual render-start.
  startedAt?: number;
  completedAt?: number;
}

export interface RenderQueueSaveRequest {
  jobs: RenderQueueJob[];
}

export interface RenderQueueSaveResponse {
  success: boolean;
  error?: string;
}

export interface RenderQueueLoadResponse {
  jobs: RenderQueueJob[];
  error?: string;
}

export interface RenderOpenFileRequest {
  filePath: string;
}

export interface RenderOpenFileResponse {
  success: boolean;
  error?: string;
}

export interface RenderOpenFolderRequest {
  filePath: string;
}

export interface RenderOpenFolderResponse {
  success: boolean;
  error?: string;
}

export interface RenderGetVideosDirResponse {
  path: string;
}

export interface RenderHistoryEntry {
  filePath: string;       // TSX source path that was rendered
  outputPath: string;     // resulting video file path
  completedAt: number;    // ms timestamp
  // Optional metadata — present on entries written by newer builds so the
  // Render tab can display history-sourced items with parity to queue jobs.
  fileName?: string;
  codec?: string;
  width?: number;
  height?: number;
  scale?: number;
  fileSize?: number;
  // Populated by the loader; indicates whether outputPath still exists on disk.
  exists?: boolean;
}

export interface RenderHistoryLoadResponse {
  entries: RenderHistoryEntry[];
  error?: string;
}

export interface RenderHistoryAppendRequest {
  entry: RenderHistoryEntry;
}

export interface RenderHistoryAppendResponse {
  success: boolean;
  error?: string;
}

// ─── Render CPU usage ───
export type RenderCpuUsage = 'low' | 'medium' | 'high' | 'max';

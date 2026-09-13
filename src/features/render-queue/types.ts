// Re-export types from shared IPC types for convenience
export type {
  RenderCodec,
  RenderGpuBackend,
  RenderHardwareAcceleration,
  RenderQueueJob,
  RenderQueueJobStatus,
} from '@shared/ipc/types';

// Additional types for the add job operation
export interface AddJobOptions {
  /** Caller-supplied job id. Agent renders pass the id their `job` artifact
   *  was minted with (agents plan §1.5) so the queue row and the artifact are
   *  the same job; everything else lets the queue mint one. */
  id?: string;
  /** Absolute output path, overriding the default videos folder. Agent renders
   *  write into the session's library folder (§1.11). */
  outputPath?: string;
  filePath: string;
  fileName: string;
  bundleUrl?: string;
  compositionId: string;
  codec: import('@shared/ipc/types').RenderCodec;
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
  gpuBackend?: import('@shared/ipc/types').RenderGpuBackend;
  hardwareAcceleration?: import('@shared/ipc/types').RenderHardwareAcceleration;
  /** Studio exports: the engine + the shared finishing stage (docs/export-engines-plan.md). */
  exportEngine?: import('@shared/studio/export-engines').ExportEngineId;
  verifyAgainstEngine?: import('@shared/studio/export-engines').ExportEngineId;
  /** 'proxy' = a draft read from the preview proxies (docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md). */
  exportSource?: import('@shared/studio/export-source').ExportSource;
}

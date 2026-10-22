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

/**
 * The queue row's "Check A/V" state (T8, END_TO_END_PLAN A6): idle until the
 * button is clicked; running with probes done of total (0 of 0 while main
 * reads the export); then the verdict with the report beside the file, or a
 * plain error.
 */
export type SyncCheckState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number }
  | {
      status: 'result';
      verdict: import('@shared/studio/sync-verdict').SyncVerdict;
      reportPath?: string;
      probes?: { confident: number; total: number };
      elapsedMs?: number;
    }
  | { status: 'error'; message: string };

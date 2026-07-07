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
  filePath: string;
  fileName: string;
  bundleUrl?: string;
  compositionId: string;
  // 'studio' jobs carry studioInput and dispatch via studioRenderStart.
  kind?: 'tsx' | 'studio';
  studioInput?: import('@shared/ipc/types').StudioRenderInput;
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
}

// ─── System Resource Monitor types ───
export interface SystemMonitorDataEvent {
  cpuPercent: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  appRamBytes: number;
  gpu: {
    available: boolean;
    name?: string;
    usagePercent?: number;
    vramUsedMB?: number;
    vramTotalMB?: number;
  };
}

// ─── System info (Main tab dashboard) ───
export interface SystemInfoGetResponse {
  gpu: {
    name: string | null;
    cudaVersion: string | null;
    vramTotalMB: number | null;
    /** Free VRAM at detection time, MB. null when nvidia-smi didn't report it. */
    vramFreeMB: number | null;
  };
  ram: {
    totalBytes: number;
    freeBytes: number;
  };
  disk: {
    freeBytes: number;
    totalBytes: number;
  };
  engines: {
    audio: { available: boolean };
    llm: { available: boolean; backend?: string };
    embedding: { available: boolean };
    image: { available: boolean };
  };
}

// ─── Runtimes table (AI Models → Overview, docs/ai-models-redesign.md §3.1) ───
// The AI runtime (Python + PyTorch) has its own richer IPC (ai-runtime.ts);
// these three are the single-binary downloads.
export type SystemRuntimeId = 'whisper-cpp' | 'sd-cli' | 'ffmpeg-full';

export interface SystemRuntimeIpc {
  id: SystemRuntimeId;
  /** "whisper.cpp", "sd-cli", "GPU encoder (ffmpeg)". */
  name: string;
  /** What it powers, one line. */
  powers: string;
  installed: boolean;
  /** A download / extract is in flight in main (survives a remount). */
  installing: boolean;
  /** The pinned release this app installs. */
  release: string;
  /** Download size for the Install button ("~36 MB"); empty when unknown. */
  downloadLabel: string;
  /** Bytes under the runtime's folder (models are never inside it). */
  sizeOnDiskBytes: number;
  /** The folder Remove deletes. */
  dir: string;
  /**
   * False when the binary in use is the bundled dev drop-in (resources/binaries)
   * rather than a user-data install — nothing here to remove.
   */
  removable: boolean;
}

export interface SystemRuntimesGetResponse {
  success: boolean;
  runtimes: SystemRuntimeIpc[];
  error?: string;
}

export interface SystemRuntimeRemoveRequest {
  id: SystemRuntimeId;
}

export interface SystemRuntimeRemoveResponse {
  success: boolean;
  error?: string;
}

export interface SystemModelsFolderOpenResponse {
  success: boolean;
  error?: string;
}

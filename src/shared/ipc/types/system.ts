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

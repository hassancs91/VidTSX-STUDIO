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

// ─── PyTorch pip install ───
export interface PyTorchPipInstallRequest {
  wheelPath: string;
}

export interface PyTorchPipInstallResponse {
  success: boolean;
  error?: string;
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
    pytorch: { installed: boolean; version?: string; variant?: 'cpu' | 'gpu'; cachedWheels?: ('cpu' | 'gpu')[] };
  };
  python: {
    available: boolean;
    version: string | null;
    path: string | null;
  };
}

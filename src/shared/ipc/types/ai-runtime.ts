// ─── AI runtime (downloadable Python + PyTorch stack) ───
// docs/ai-runtime-implementation-plan.md §3. Shared by main, preload and renderer.

export type AiRuntimeVariant = 'cu126' | 'cpu';

export type AiRuntimeState = 'installed' | 'update-available' | 'missing' | 'installing' | 'broken';

/** Phases after the download engine hands over (the engine's own statuses cover download/extract). */
export type AiRuntimeInstallPhase =
  | 'preflight'
  | 'downloading'
  | 'verifying'
  | 'warming-up'
  | 'finalizing';

export interface AiRuntimeVariantInfo {
  variant: AiRuntimeVariant;
  version: string;
  /** Zip bytes and extracted bytes. */
  bytes: number;
  bytesOnDisk: number;
  sizeLabel: string;
  torch: string;
  cuda: string | null;
  minDriver: string | null;
  /** Why this variant cannot be installed here right now, or null when it can. */
  issue: AiRuntimePreflightIssue | null;
}

export type AiRuntimePreflightIssueCode = 'path-too-long' | 'disk' | 'unsupported-platform' | 'gpu-unsupported';

export interface AiRuntimePreflightIssue {
  code: AiRuntimePreflightIssueCode;
  message: string;
}

export interface AiRuntimeGpuInfo {
  name: string | null;
  driverVersion: string | null;
  vramTotalMB: number | null;
}

export interface AiRuntimeInstalledInfo {
  version: string;
  variant: AiRuntimeVariant;
  dir: string;
  python: string;
  torch: string;
  bytesOnDisk: number;
}

export interface AiRuntimeInstallProgress {
  variant: AiRuntimeVariant;
  phase: AiRuntimeInstallPhase;
  /** Download task id — the renderer matches DOWNLOAD_PROGRESS events on it. */
  downloadId: string;
  message?: string;
}

export interface AiRuntimeStatus {
  state: AiRuntimeState;
  /** The version this app pins. */
  targetVersion: string;
  /** What the GPU check picks for this machine. */
  recommendedVariant: AiRuntimeVariant;
  recommendationReason: string;
  variants: Record<AiRuntimeVariant, AiRuntimeVariantInfo>;
  installed: AiRuntimeInstalledInfo | null;
  install: AiRuntimeInstallProgress | null;
  lastError: string | null;
  gpu: AiRuntimeGpuInfo;
  /** Where runtimes live and how many characters of install-root the deepest file leaves. */
  rootPath: string;
  rootBudgetChars: number;
  longPathsEnabled: boolean;
  diskFreeBytes: number;
}

export interface AiRuntimeStatusResponse {
  success: boolean;
  error?: string;
  status?: AiRuntimeStatus;
}

export interface AiRuntimeInstallRequest {
  /** Omit to install the recommended variant. */
  variant?: AiRuntimeVariant;
}

export interface AiRuntimeInstallResponse {
  success: boolean;
  error?: string;
}

export interface AiRuntimeRepairResponse {
  success: boolean;
  error?: string;
}

export interface AiRuntimeRemoveResponse {
  success: boolean;
  error?: string;
}

/** Pushed to every window whenever the runtime status changes (install phases, completion, removal). */
export type AiRuntimeStatusChangedEvent = AiRuntimeStatus;

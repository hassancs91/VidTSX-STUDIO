// ─── Runtime-backed Python models (docs/ai-runtime-implementation-plan.md §4 step 2, §7b) ───
// Shared by main, preload and renderer. The catalogue itself lives in main
// (src/main/services/python-models/registry.ts); these are its IPC projections.
import type { AiRuntimeState, AiRuntimeVariant } from './ai-runtime';
import type { FitResult } from '../../model-library/fit';

export type PythonModelCategoryIpc = 'image' | '3d';

export interface PythonModelFileStatusIpc {
  label: string;
  dest: string;
  bytes: number;
  present: boolean;
}

export interface PythonModelStatusIpc {
  id: string;
  category: PythonModelCategoryIpc;
  section: 'image-tools' | '3d';
  name: string;
  summary: string;
  /** Bytes of the model's own files (companions shared with other models excluded). */
  sizeBytes: number;
  sizeLabel: string;
  /** Bytes still to download, own files + missing companions. */
  bytesMissing: number;
  licence: { name: string; url: string };
  sourceUrl: string;
  /** All files present (own + companions). */
  installed: boolean;
  files: PythonModelFileStatusIpc[];
  /** A download for this model is in flight. */
  downloading: boolean;
  runtime: {
    state: AiRuntimeState;
    variant: AiRuntimeVariant | null;
    version: string | null;
  };
  /** Ready to run right now (installed + runtime installed at the pinned version). */
  ready: boolean;
  vramMb: number | null;
  cpuOk: boolean;
  estimatedSeconds: { gpu: number; cpu: number };
  /** VRAM fit for the GPU floor (3D models); absent when the model never uses the GPU. */
  fit?: FitResult;
}

export interface PythonModelStatusRequest {
  /** Filter to one model or one category; omit for all. */
  modelId?: string;
  category?: PythonModelCategoryIpc;
}

export interface PythonModelStatusResponse {
  success: boolean;
  models: PythonModelStatusIpc[];
  error?: string;
}

export interface PythonModelDownloadRequest {
  modelId: string;
}

export interface PythonModelDownloadResponse {
  success: boolean;
  error?: string;
}

export interface PythonModelCancelDownloadRequest {
  modelId: string;
}

export interface PythonModelCancelDownloadResponse {
  success: boolean;
}

export interface PythonModelRemoveRequest {
  modelId: string;
}

export interface PythonModelRemoveResponse {
  success: boolean;
  error?: string;
}

// ─── Preflight: structured "not ready" (plan §7b rule 2) ───

export type PythonModelNotReadyReason =
  | 'runtime-missing'
  | 'runtime-update'
  | 'runtime-broken'
  | 'runtime-installing'
  | 'model-missing'
  | 'path-too-long'
  | 'disk'
  | 'unsupported-platform';

export interface PythonModelInstallAction {
  /** Button copy, e.g. "Download the AI runtime (280 MB) and the model (176 MB)". */
  label: string;
  /** What the action will do; the IPC layer maps it to the install functions. */
  kind: 'install-runtime' | 'update-runtime' | 'repair-runtime' | 'download-model' | 'install-runtime-and-model';
  /** Runtime variant that would be installed (recommended one), when the runtime is part of it. */
  variant?: AiRuntimeVariant;
  runtimeBytes?: number;
  modelBytes?: number;
}

export type PythonModelPreflightIpc =
  | { ready: true; modelId: string; device: 'gpu' | 'cpu'; runtimeVariant: AiRuntimeVariant }
  | {
      ready: false;
      modelId: string;
      reason: PythonModelNotReadyReason;
      /** One sentence for a dialog / an agent's ask_user. */
      message: string;
      /** Absent when nothing the app can do fixes it (path too long, disk). */
      action?: PythonModelInstallAction;
    };

export interface PythonModelPreflightRequest {
  modelId: string;
}

export interface PythonModelPreflightResponse {
  success: boolean;
  preflight?: PythonModelPreflightIpc;
  error?: string;
}

/** Perform the preflight's action: install/update the runtime as needed, then download the model. Resolves when done. */
export interface PythonModelInstallRequest {
  modelId: string;
  /** Override the recommended runtime variant (the "smaller CPU-only runtime" link). */
  variant?: AiRuntimeVariant;
}

export interface PythonModelInstallResponse {
  success: boolean;
  error?: string;
}

/** Progress for a python-model job as the UI sees it (mapped from the worker protocol). */
export interface PythonModelProgressIpc {
  requestId: string;
  stage: string;
  pct?: number;
  message?: string;
}

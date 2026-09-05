// ─── Background removal (rembg) in Image Studio — plan §4 steps 4–5 ───
import type { ImageStudioEntry } from './image-studio';
import type { PythonModelPreflightIpc } from './python-models';
import type { AiRuntimeVariant } from './ai-runtime';

export type RembgSource =
  /** A gallery image (Image Studio db id). */
  | { kind: 'image'; id: string }
  /** A dropped / uploaded image that is not in the gallery yet. */
  | { kind: 'base64'; base64: string; fileName?: string; contentType?: string };

export interface RembgOptions {
  alphaMatting?: boolean;
  postProcessMask?: boolean;
}

export interface RembgRunRequest {
  source: RembgSource;
  /** Folder the result lands in (the gallery folder being viewed). */
  folderId?: string | null;
  options?: RembgOptions;
  /**
   * When the runtime / model is missing: false (default) returns `notReady` so the UI
   * can ask; true performs the install first (the user already said yes).
   */
  installIfMissing?: boolean;
  /** With installIfMissing: which runtime variant (default: recommended). */
  runtimeVariant?: AiRuntimeVariant;
}

export interface RembgRunResponse {
  success: boolean;
  /** Job id for progress / complete / error events and cancel. */
  requestId?: string;
  error?: string;
  /** Set (with success false) when the runtime or model must be installed first. */
  notReady?: PythonModelPreflightIpc;
}

/** UI stages: install phases (first click only) then the worker's own stages. */
export type RembgStage =
  | 'installing-runtime'
  | 'downloading-model'
  | 'preparing-runtime'
  | 'removing-background'
  | 'saving';

export interface RembgProgressEvent {
  requestId: string;
  stage: RembgStage;
  /** 0–100 when known. */
  pct?: number;
  message?: string;
}

export interface RembgCompleteEvent {
  requestId: string;
  entry: ImageStudioEntry;
  seconds: number;
}

export interface RembgErrorEvent {
  requestId: string;
  error: string;
  /** Classified failure code (oom, import, weights-corrupt, cancelled, …). */
  code?: string;
  /** Raw worker log tail for the expandable Details. */
  details?: string;
}

export interface RembgCancelRequest {
  requestId: string;
}

export interface RembgCancelResponse {
  success: boolean;
}

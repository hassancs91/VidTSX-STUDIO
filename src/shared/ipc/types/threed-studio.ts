// ─── 3D Studio (image → 3D via TripoSR) — plan §5 ───
import type { PythonModelPreflightIpc } from './python-models';
import type { AiRuntimeVariant } from './ai-runtime';

export interface ThreedStudioEntry {
  id: string;
  /** Display name (source image name by default). */
  name: string;
  /** Folder under `{userData}/threed-studio/models/`. */
  dirName: string;
  meshFileName: string;
  previewFileName: string | null;
  inputFileName: string | null;
  sourceImageName: string;
  /** Image Studio id when the input came from the gallery. */
  sourceImageId: string | null;
  model: string;
  quality: number;
  seed: number | null;
  removeBackground: boolean;
  vertices: number | null;
  faces: number | null;
  sizeBytes: number;
  seconds: number | null;
  device: string | null;
  createdAt: number;
}

export type Sd3dSource =
  | { kind: 'image-studio'; id: string }
  | { kind: 'base64'; base64: string; fileName?: string; contentType?: string };

export interface Sd3dGenerateRequest {
  source: Sd3dSource;
  /** Marching-cubes resolution; the UI caps it by VRAM. */
  quality?: '256' | '512';
  removeBackground?: boolean;
  seed?: number;
  device?: 'auto' | 'cpu';
  /** See RembgRunRequest.installIfMissing. */
  installIfMissing?: boolean;
  runtimeVariant?: AiRuntimeVariant;
}

export interface Sd3dGenerateResponse {
  success: boolean;
  requestId?: string;
  error?: string;
  notReady?: PythonModelPreflightIpc;
}

export type Sd3dStage =
  | 'installing-runtime'
  | 'downloading-model'
  | 'preparing-runtime'
  | 'loading-model'
  | 'preparing-image'
  | 'shape'
  | 'export'
  | 'saving';

export interface Sd3dGenerateProgressEvent {
  requestId: string;
  stage: Sd3dStage;
  pct?: number;
  message?: string;
}

export interface Sd3dGenerateCompleteEvent {
  requestId: string;
  entry: ThreedStudioEntry;
  seconds: number;
}

export interface Sd3dGenerateErrorEvent {
  requestId: string;
  error: string;
  code?: string;
  details?: string;
}

export interface Sd3dCancelRequest {
  requestId: string;
}

export interface Sd3dCancelResponse {
  success: boolean;
}

export interface ThreedStudioListResponse {
  success: boolean;
  entries: ThreedStudioEntry[];
  /** `{userData}/threed-studio/models` — file:// URLs are built from it. */
  basePath: string;
  error?: string;
}

export interface ThreedStudioReadRequest {
  id: string;
}

export interface ThreedStudioReadResponse {
  success: boolean;
  entry?: ThreedStudioEntry;
  meshPath?: string;
  previewPath?: string | null;
  inputPath?: string | null;
  error?: string;
}

export interface ThreedStudioDeleteRequest {
  id: string;
}

export interface ThreedStudioDeleteResponse {
  success: boolean;
  error?: string;
}

export interface ThreedStudioSaveAsRequest {
  id: string;
}

export interface ThreedStudioSaveAsResponse {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface ThreedStudioSaveToLibraryRequest {
  id: string;
  /** Library folder; default `generated/3d`. */
  folder?: string;
}

export interface ThreedStudioSaveToLibraryResponse {
  success: boolean;
  /** Library-relative path of the saved GLB. */
  relPath?: string;
  error?: string;
}

export interface ThreedStudioOpenFolderRequest {
  /** Omit to open the models root. */
  id?: string;
}

export interface ThreedStudioOpenFolderResponse {
  success: boolean;
  error?: string;
}

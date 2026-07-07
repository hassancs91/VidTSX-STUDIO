// ─── Bundle operations ───
// Bundle operations
export interface CompositionMetadata {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export interface BundleCreateRequest {
  filePath: string;
}

export interface BundleCreateResponse {
  success: boolean;
  serveUrl?: string;
  compositions?: CompositionMetadata[];
  cached?: boolean;
  error?: string;
}

export interface BundleInvalidateRequest {
  filePath: string;
}

export interface BundleInvalidateResponse {
  success: boolean;
  error?: string;
}

export interface BundleProgressEvent {
  filePath: string;
  percent: number;
}

// ─── Module operations (native player) ───
// Module operations (native player)
export interface ModuleTranspileRequest {
  filePath: string;
}

export interface ModuleTranspileResponse {
  success: boolean;
  moduleUrl?: string;
  compositionConfig?: {
    id: string;
    durationInFrames: number;
    fps: number;
    width: number;
    height: number;
  };
  componentName?: string;
  error?: string;
  errorLocation?: {
    line: number;
    column: number;
    file: string;
  };
}

export interface ModuleServerUrlResponse {
  url: string | null;
  previewPreloadPath: string | null;
}

// ─── TSX validation ───
// TSX validation
export interface TsxValidateRequest {
  code: string;
}

export interface TsxValidateResponse {
  success: boolean;
  error?: string;
  errorLocation?: {
    line: number;
    column: number;
    file: string;
  };
}

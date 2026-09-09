// ─── Per-model image parameter overrides (W2c) ───
import type { ImageModelParamOverrides, ImageModelParams } from '../../presets/image-model-params';

export interface ImageModelParamsGetResponse {
  success: boolean;
  /** `provider/model` → the fields the user set. */
  overrides: ImageModelParamOverrides;
  error?: string;
}

export interface ImageModelParamsSaveRequest {
  providerId: string;
  modelId: string;
  /** null (or an empty object) removes the override — "Reset to defaults". */
  params: ImageModelParams | null;
}

export type ImageModelParamsSaveResponse = ImageModelParamsGetResponse;

import type { ImageModelCatalogEntry } from '../../presets/image-models';
import type { ProviderModelCategory } from '../../presets/provider-model-defaults';

/** One editable provider×category model catalog, merged with defaults. */
export interface ProviderModelCatalogIpc {
  providerId: string;
  category: ProviderModelCategory;
  models: ImageModelCatalogEntry[];
  /** True when the list equals the shipped defaults (no user override stored). */
  isDefault: boolean;
}

export interface ProviderModelsGetResponse {
  success: boolean;
  catalogs: ProviderModelCatalogIpc[];
  error?: string;
}

export interface ProviderModelsSaveRequest {
  providerId: string;
  category: ProviderModelCategory;
  models: ImageModelCatalogEntry[];
}

export interface ProviderModelsSaveResponse {
  success: boolean;
  catalogs: ProviderModelCatalogIpc[];
  error?: string;
}

export interface ProviderModelsResetRequest {
  providerId: string;
  category: ProviderModelCategory;
}

export type ProviderModelsResetResponse = ProviderModelsSaveResponse;

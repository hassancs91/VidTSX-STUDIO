/**
 * Image-model catalog entry shape, shared by provider implementations (so
 * getSupportedModels() returns display names over IPC) and the settings UI
 * (which renders model dropdowns before any provider is registered).
 */

import type { ImageDialectId } from './image-dialects';

export interface ImageModelCatalogEntry {
  id: string;
  name: string;
  /**
   * Request-body dialect (image-dialects.ts): which parameters the model's
   * API takes and how it sizes output. Absent on a legacy stored row → the
   * provider's default dialect on load.
   */
  dialect?: ImageDialectId;
  /** Credit cost per generation, when a provider exposes one. */
  credits?: number;
  /**
   * Estimated price per generated image (~1MP), for the usage dashboard's
   * cost column only. Informational — the provider is the billing authority;
   * absent/unknown logs $0. Read from the shipped defaults at logging time
   * (user catalog edits keep only id + name).
   */
  priceUsd?: number;
}

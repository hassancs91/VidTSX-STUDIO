/**
 * App-wide model usage store (design §6.1) — wires the category-agnostic core
 * usage store to the settings DB (`modelUsage` key). Engines call
 * `usageStore.recordUse(category, modelId)` on a successful operation; the
 * MODELS_USAGE_GET handler reads it back. Local-only, no telemetry.
 */
import { createUsageStore } from './model-library';
import { getModelUsageMap, setModelUsageMap } from './settings';

export const usageStore = createUsageStore({
  get: getModelUsageMap,
  set: setModelUsageMap,
});

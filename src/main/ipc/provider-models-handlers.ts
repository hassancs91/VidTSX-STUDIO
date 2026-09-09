import type { IpcMainInvokeEvent } from 'electron';
import type {
  ProviderModelsGetResponse,
  ProviderModelsSaveRequest,
  ProviderModelsSaveResponse,
  ProviderModelsResetRequest,
  ProviderModelsResetResponse,
} from '../../shared/ipc/types/provider-models';
import {
  getProviderModelCatalogs,
  saveProviderModels,
  resetProviderModels,
} from '../services/provider-models';
import { initImageEngine } from '../services/image-init';
import { initVideoEngine } from '../services/video-init';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('ProviderModels');

async function reregister(category: ProviderModelsSaveRequest['category']): Promise<void> {
  if (category === 'video') await initVideoEngine();
  else if (category === 'image') await initImageEngine();
  // 'llm': nothing registers per model — the LLM engine takes the model id per
  // request, and pickers re-read the catalog on the renderer's change event.
}

export async function handleProviderModelsGet(): Promise<ProviderModelsGetResponse> {
  try {
    return { success: true, catalogs: await getProviderModelCatalogs() };
  } catch (err) {
    return {
      success: false,
      catalogs: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleProviderModelsSave(
  _event: IpcMainInvokeEvent,
  req: ProviderModelsSaveRequest,
): Promise<ProviderModelsSaveResponse> {
  try {
    await saveProviderModels(req.providerId, req.category, req.models);
    // Re-register the engine that serves this category, so the new list is
    // live in every picker immediately.
    await reregister(req.category);
    log.info('Catalog saved', { providerId: req.providerId, category: req.category, count: req.models.length });
    return { success: true, catalogs: await getProviderModelCatalogs() };
  } catch (err) {
    return {
      success: false,
      catalogs: await getProviderModelCatalogs().catch(() => []),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleProviderModelsReset(
  _event: IpcMainInvokeEvent,
  req: ProviderModelsResetRequest,
): Promise<ProviderModelsResetResponse> {
  try {
    await resetProviderModels(req.providerId, req.category);
    await reregister(req.category);
    log.info('Catalog reset to defaults', { providerId: req.providerId, category: req.category });
    return { success: true, catalogs: await getProviderModelCatalogs() };
  } catch (err) {
    return {
      success: false,
      catalogs: await getProviderModelCatalogs().catch(() => []),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

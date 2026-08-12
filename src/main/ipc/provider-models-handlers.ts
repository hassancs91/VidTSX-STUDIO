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
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('ProviderModels');

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
    // Re-register image providers so the new model list is live immediately.
    await initImageEngine();
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
    await initImageEngine();
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

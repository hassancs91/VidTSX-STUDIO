import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  ProviderModelsGetResponse,
  ProviderModelsSaveRequest,
  ProviderModelsSaveResponse,
  ProviderModelsResetRequest,
  ProviderModelsResetResponse,
} from '../../shared/ipc/types/provider-models';

export const providerModelsApi = {
  providerModelsGet: (): Promise<ProviderModelsGetResponse> =>
    ipcRenderer.invoke(IPC.PROVIDER_MODELS_GET),
  providerModelsSave: (data: ProviderModelsSaveRequest): Promise<ProviderModelsSaveResponse> =>
    ipcRenderer.invoke(IPC.PROVIDER_MODELS_SAVE, data),
  providerModelsReset: (data: ProviderModelsResetRequest): Promise<ProviderModelsResetResponse> =>
    ipcRenderer.invoke(IPC.PROVIDER_MODELS_RESET, data),
};

import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  ProviderKeysGetResponse,
  ProviderKeysSaveRequest,
  ProviderKeysSaveResponse,
} from '../../shared/ipc/types/provider-keys';

export const providerKeysApi = {
  providerKeysGet: (): Promise<ProviderKeysGetResponse> =>
    ipcRenderer.invoke(IPC.PROVIDER_KEYS_GET),
  providerKeysSave: (data: ProviderKeysSaveRequest): Promise<ProviderKeysSaveResponse> =>
    ipcRenderer.invoke(IPC.PROVIDER_KEYS_SAVE, data),
};

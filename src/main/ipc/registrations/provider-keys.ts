import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import { handleProviderKeysGet, handleProviderKeysSave } from '../provider-keys-handlers';

export function registerProviderKeysIpc(): void {
  ipcMain.handle(IPC.PROVIDER_KEYS_GET, handleProviderKeysGet);
  ipcMain.handle(IPC.PROVIDER_KEYS_SAVE, handleProviderKeysSave);
}

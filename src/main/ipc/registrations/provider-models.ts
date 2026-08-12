import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleProviderModelsGet,
  handleProviderModelsSave,
  handleProviderModelsReset,
} from '../provider-models-handlers';

export function registerProviderModelsIpc(): void {
  ipcMain.handle(IPC.PROVIDER_MODELS_GET, handleProviderModelsGet);
  ipcMain.handle(IPC.PROVIDER_MODELS_SAVE, handleProviderModelsSave);
  ipcMain.handle(IPC.PROVIDER_MODELS_RESET, handleProviderModelsReset);
}

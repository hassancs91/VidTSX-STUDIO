import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleImageModelParamsGet,
  handleImageModelParamsSave,
} from '../image-model-params-handlers';

export function registerImageModelParamsIpc(): void {
  ipcMain.handle(IPC.IMAGE_MODEL_PARAMS_GET, handleImageModelParamsGet);
  ipcMain.handle(IPC.IMAGE_MODEL_PARAMS_SAVE, handleImageModelParamsSave);
}

import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleTemplatesList,
  handleTemplatesStage,
  handleTemplatesStateLoad,
  handleTemplatesStateSave,
} from '../template-handlers';

export function registerTemplatesIpc(): void {
  ipcMain.handle(IPC.TEMPLATES_LIST, handleTemplatesList);
  ipcMain.handle(IPC.TEMPLATES_STAGE, handleTemplatesStage);
  ipcMain.handle(IPC.TEMPLATES_STATE_LOAD, handleTemplatesStateLoad);
  ipcMain.handle(IPC.TEMPLATES_STATE_SAVE, handleTemplatesStateSave);
}

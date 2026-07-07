import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleFlowsProjectList,
  handleFlowsProjectCreate,
  handleFlowsProjectLoad,
  handleFlowsProjectUpdate,
  handleFlowsProjectDelete,
  handleFlowsRunPersist,
  handleFlowsRunList,
  handleFlowsRunLoad,
} from '../flows-handlers';

export function registerFlowsIpc(): void {
  ipcMain.handle(IPC.FLOWS_PROJECT_LIST, handleFlowsProjectList);
  ipcMain.handle(IPC.FLOWS_PROJECT_CREATE, handleFlowsProjectCreate);
  ipcMain.handle(IPC.FLOWS_PROJECT_LOAD, handleFlowsProjectLoad);
  ipcMain.handle(IPC.FLOWS_PROJECT_UPDATE, handleFlowsProjectUpdate);
  ipcMain.handle(IPC.FLOWS_PROJECT_DELETE, handleFlowsProjectDelete);

  ipcMain.handle(IPC.FLOWS_RUN_PERSIST, handleFlowsRunPersist);
  ipcMain.handle(IPC.FLOWS_RUN_LIST, handleFlowsRunList);
  ipcMain.handle(IPC.FLOWS_RUN_LOAD, handleFlowsRunLoad);
}

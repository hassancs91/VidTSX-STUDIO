import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleTsxJobStart,
  handleTsxJobCancel,
  handleTsxJobList,
  handleTsxJobClearCompleted,
  initTsxJobBroadcast,
} from '../tsx-job-handlers';

export function registerTsxJobsIpc(): void {
  initTsxJobBroadcast();
  ipcMain.handle(IPC.TSXJOB_START, handleTsxJobStart);
  ipcMain.handle(IPC.TSXJOB_CANCEL, handleTsxJobCancel);
  ipcMain.handle(IPC.TSXJOB_LIST, handleTsxJobList);
  ipcMain.handle(IPC.TSXJOB_CLEAR_COMPLETED, handleTsxJobClearCompleted);
}

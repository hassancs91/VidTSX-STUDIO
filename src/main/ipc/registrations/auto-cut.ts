import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleStudioAnalyzeRun,
  handleStudioAnalyzeCancel,
  handleStudioAutoCutRun,
  handleStudioAutoCutCancel,
} from '../auto-cut-handlers';

export function registerAutoCutIpc(): void {
  ipcMain.handle(IPC.STUDIO_ANALYZE_RUN, handleStudioAnalyzeRun);
  ipcMain.handle(IPC.STUDIO_ANALYZE_CANCEL, handleStudioAnalyzeCancel);
  ipcMain.handle(IPC.STUDIO_AUTO_CUT_RUN, handleStudioAutoCutRun);
  ipcMain.handle(IPC.STUDIO_AUTO_CUT_CANCEL, handleStudioAutoCutCancel);
}

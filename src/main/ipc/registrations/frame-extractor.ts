import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleFrameExtract,
  handleFrameExtractCancel,
  handleFrameSaveZip,
  handleFrameSaveSingle,
} from '../tools-handlers';

export function registerFrameExtractorIpc(): void {
  ipcMain.handle(IPC.TOOLS_FRAME_EXTRACT, handleFrameExtract);
  ipcMain.handle(IPC.TOOLS_FRAME_EXTRACT_CANCEL, handleFrameExtractCancel);
  ipcMain.handle(IPC.TOOLS_FRAME_SAVE_ZIP, handleFrameSaveZip);
  ipcMain.handle(IPC.TOOLS_FRAME_SAVE_SINGLE, handleFrameSaveSingle);
}

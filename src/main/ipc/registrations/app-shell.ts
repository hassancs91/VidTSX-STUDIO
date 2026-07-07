import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleAppGetInfo,
  handleAppOpenExternal,
} from '../app-handlers';
import {
  handleAppGetIsDev,
} from '../creator-handlers';
import {
  handleContextMenuShow,
} from '../menu-handlers';
import {
  handleClipboardReadText,
} from '../clipboard-handlers';
import {
  handleScreenshotCopy,
  handleScreenshotSave,
  handleScreenshotSaveToPath,
  handleScreenshotCaptureHtml,
} from '../screenshot-handlers';
import {
  handlePrototyperRecordStart,
  handlePrototyperRecordStop,
} from '../prototyper-handlers';

export function registerAppShellIpc(): void {
  ipcMain.handle(IPC.APP_GET_INFO, handleAppGetInfo);
  ipcMain.handle(IPC.APP_OPEN_EXTERNAL, handleAppOpenExternal);
  ipcMain.handle(IPC.APP_GET_IS_DEV, handleAppGetIsDev);
  ipcMain.handle(IPC.CONTEXT_MENU_SHOW, handleContextMenuShow);
  ipcMain.handle(IPC.CLIPBOARD_READ_TEXT, handleClipboardReadText);
  ipcMain.handle(IPC.SCREENSHOT_COPY, handleScreenshotCopy);
  ipcMain.handle(IPC.SCREENSHOT_SAVE, handleScreenshotSave);
  ipcMain.handle(IPC.SCREENSHOT_SAVE_TO_PATH, handleScreenshotSaveToPath);
  ipcMain.handle(IPC.SCREENSHOT_CAPTURE_HTML, handleScreenshotCaptureHtml);
  ipcMain.handle(IPC.PROTOTYPER_RECORD_START, handlePrototyperRecordStart);
  ipcMain.handle(IPC.PROTOTYPER_RECORD_STOP, handlePrototyperRecordStop);
}

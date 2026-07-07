import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleBundleCreate,
  handleBundleInvalidate,
} from '../bundle-handlers';
import {
  handleTsxValidate,
} from '../tsx-handlers';

export function registerBundleIpc(): void {
  ipcMain.handle(IPC.BUNDLE_CREATE, handleBundleCreate);
  ipcMain.handle(IPC.BUNDLE_INVALIDATE, handleBundleInvalidate);
  ipcMain.handle(IPC.TSX_VALIDATE, handleTsxValidate);
}

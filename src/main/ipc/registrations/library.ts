import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleLibraryDescriptionSet,
  handleLibraryIndexGet,
  handleLibraryRootGet,
  handleLibraryRootSet,
  handleLibrarySizesGet,
} from '../library-handlers';

export function registerLibraryIpc(): void {
  ipcMain.handle(IPC.LIBRARY_INDEX_GET, handleLibraryIndexGet);
  ipcMain.handle(IPC.LIBRARY_DESCRIPTION_SET, handleLibraryDescriptionSet);
  ipcMain.handle(IPC.LIBRARY_SIZES_GET, handleLibrarySizesGet);
  ipcMain.handle(IPC.LIBRARY_ROOT_GET, handleLibraryRootGet);
  ipcMain.handle(IPC.LIBRARY_ROOT_SET, handleLibraryRootSet);
}

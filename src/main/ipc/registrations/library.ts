import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleLibraryBrandDefaultSet,
  handleLibraryBrandDelete,
  handleLibraryBrandSave,
  handleLibraryBrandsGet,
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
  ipcMain.handle(IPC.LIBRARY_BRANDS_GET, handleLibraryBrandsGet);
  ipcMain.handle(IPC.LIBRARY_BRAND_SAVE, handleLibraryBrandSave);
  ipcMain.handle(IPC.LIBRARY_BRAND_DELETE, handleLibraryBrandDelete);
  ipcMain.handle(IPC.LIBRARY_BRAND_DEFAULT_SET, handleLibraryBrandDefaultSet);
}

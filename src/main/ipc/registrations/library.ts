import { ipcMain, webContents } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleLibraryBrandDefaultSet,
  handleLibraryBrandDelete,
  handleLibraryBrandSave,
  handleLibraryBrandsGet,
  handleLibraryCaptureTrigger,
  handleLibraryDescriptionSet,
  handleLibraryIndexGet,
  handleLibraryRootGet,
  handleLibraryRootSet,
  handleLibrarySizesGet,
} from '../library-handlers';
import { onCaptureEvent } from '../../services/library/capture';

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
  ipcMain.handle(IPC.LIBRARY_CAPTURE_TRIGGER, handleLibraryCaptureTrigger);

  // Visible-capture chip: main pushes 'pending' while a capture window waits
  // for the user, 'closed' when it stops (the media-job push pattern).
  onCaptureEvent((event) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send(IPC.LIBRARY_CAPTURE_EVENT, event);
    }
  });
}

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
import {
  handleLibraryDescribeAvailability,
  handleLibraryDescribeCancel,
  handleLibraryDescribeStart,
  handleLibraryOrganizeApply,
  handleLibraryOrganizeSuggest,
  handleLibraryPrefsSet,
} from '../library-ai-handlers';
import {
  handleLibraryPresetDelete,
  handleLibraryPresetSave,
  handleLibraryPresetsGet,
} from '../preset-handlers';
import { onCaptureEvent } from '../../services/library/capture';
import { libraryDescribeJobs } from '../../services/library/describe-job';

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
  ipcMain.handle(IPC.LIBRARY_PRESETS_GET, handleLibraryPresetsGet);
  ipcMain.handle(IPC.LIBRARY_PRESET_SAVE, handleLibraryPresetSave);
  ipcMain.handle(IPC.LIBRARY_PRESET_DELETE, handleLibraryPresetDelete);
  ipcMain.handle(IPC.LIBRARY_CAPTURE_TRIGGER, handleLibraryCaptureTrigger);

  // AI curation — descriptions (L2) and organize (L7).
  ipcMain.handle(IPC.LIBRARY_DESCRIBE_AVAILABILITY, handleLibraryDescribeAvailability);
  ipcMain.handle(IPC.LIBRARY_PREFS_SET, handleLibraryPrefsSet);
  ipcMain.handle(IPC.LIBRARY_DESCRIBE_START, handleLibraryDescribeStart);
  ipcMain.handle(IPC.LIBRARY_DESCRIBE_CANCEL, handleLibraryDescribeCancel);
  ipcMain.handle(IPC.LIBRARY_ORGANIZE_SUGGEST, handleLibraryOrganizeSuggest);
  ipcMain.handle(IPC.LIBRARY_ORGANIZE_APPLY, handleLibraryOrganizeApply);

  // Visible-capture chip: main pushes 'pending' while a capture window waits
  // for the user, 'closed' when it stops (the media-job push pattern).
  onCaptureEvent((event) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send(IPC.LIBRARY_CAPTURE_EVENT, event);
    }
  });

  // Batch describe: per-item results stream to every renderer, same push
  // shape as the media jobs the Studio timeline already folds in.
  libraryDescribeJobs.onEvent((event) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send(IPC.LIBRARY_DESCRIBE_EVENT, event);
    }
  });
}

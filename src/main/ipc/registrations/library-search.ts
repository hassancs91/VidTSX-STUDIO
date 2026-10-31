import { ipcMain, webContents } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleLibrarySearch,
  handleLibrarySearchSettingsSet,
  handleLibrarySearchStatus,
} from '../library-search-handlers';
import { ensureLibrarySearch, onLibrarySearchEvent } from '../../services/library-search/search-app';
import { lazily } from './lazy';

// Library search (LIBRARY_SEARCH_DESIGN.md §10). `lazily`: the runtime is built on the first call, never at startup
// (§7). The push subscription creates nothing — events flow only once the runtime exists.
export function registerLibrarySearchIpc(): void {
  ipcMain.handle(IPC.LIBRARY_SEARCH, lazily(ensureLibrarySearch, handleLibrarySearch));
  ipcMain.handle(IPC.LIBRARY_SEARCH_STATUS, lazily(ensureLibrarySearch, handleLibrarySearchStatus));
  ipcMain.handle(IPC.LIBRARY_SEARCH_SETTINGS_SET, lazily(ensureLibrarySearch, handleLibrarySearchSettingsSet));

  onLibrarySearchEvent((event) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send(IPC.LIBRARY_SEARCH_EVENT, event);
    }
  });
}

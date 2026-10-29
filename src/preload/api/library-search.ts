import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  LibrarySearchEvent,
  LibrarySearchQueryRequest,
  LibrarySearchResponse,
  LibrarySearchSettingsSetRequest,
  LibrarySearchSettingsSetResponse,
  LibrarySearchStatusResponse,
} from '../../shared/ipc/types';

export const librarySearchApi = {
  // ─── Library search — one shared search (LIBRARY_SEARCH_DESIGN.md §10) ───
  librarySearch: (data: LibrarySearchQueryRequest): Promise<LibrarySearchResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_SEARCH, data),
  librarySearchStatus: (): Promise<LibrarySearchStatusResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_SEARCH_STATUS, {}),
  librarySearchSettingsSet: (data: LibrarySearchSettingsSetRequest): Promise<LibrarySearchSettingsSetResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_SEARCH_SETTINGS_SET, data),
  onLibrarySearchEvent: (callback: (event: LibrarySearchEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: LibrarySearchEvent) => callback(data);
    ipcRenderer.on(IPC.LIBRARY_SEARCH_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.LIBRARY_SEARCH_EVENT, listener);
  },
};

import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  LibraryDescriptionSetRequest,
  LibraryDescriptionSetResponse,
  LibraryIndexGetResponse,
  LibraryRootGetResponse,
  LibraryRootSetRequest,
  LibraryRootSetResponse,
  LibrarySizesGetResponse,
} from '../../shared/ipc/types';

export const libraryApi = {
  // ─── Asset library — index overlay, sizes, root override ───
  libraryIndexGet: (): Promise<LibraryIndexGetResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_INDEX_GET),
  libraryDescriptionSet: (
    data: LibraryDescriptionSetRequest
  ): Promise<LibraryDescriptionSetResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_DESCRIPTION_SET, data),
  librarySizesGet: (): Promise<LibrarySizesGetResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_SIZES_GET),
  libraryRootGet: (): Promise<LibraryRootGetResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_ROOT_GET),
  libraryRootSet: (data: LibraryRootSetRequest): Promise<LibraryRootSetResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_ROOT_SET, data),
};

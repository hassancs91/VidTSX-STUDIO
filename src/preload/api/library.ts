import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  LibraryBrandDefaultSetRequest,
  LibraryBrandDefaultSetResponse,
  LibraryBrandDeleteRequest,
  LibraryBrandDeleteResponse,
  LibraryBrandSaveRequest,
  LibraryBrandSaveResponse,
  LibraryBrandsGetResponse,
  LibraryCaptureEvent,
  LibraryCaptureTriggerRequest,
  LibraryCaptureTriggerResponse,
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

  // ─── Brands (L3/D11) ───
  libraryBrandsGet: (): Promise<LibraryBrandsGetResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_BRANDS_GET),
  libraryBrandSave: (data: LibraryBrandSaveRequest): Promise<LibraryBrandSaveResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_BRAND_SAVE, data),
  libraryBrandDelete: (data: LibraryBrandDeleteRequest): Promise<LibraryBrandDeleteResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_BRAND_DELETE, data),
  libraryBrandDefaultSet: (
    data: LibraryBrandDefaultSetRequest
  ): Promise<LibraryBrandDefaultSetResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_BRAND_DEFAULT_SET, data),

  // ─── Visible web capture handshake (L6/D12) ───
  libraryCaptureTrigger: (
    data: LibraryCaptureTriggerRequest
  ): Promise<LibraryCaptureTriggerResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_CAPTURE_TRIGGER, data),
  onLibraryCaptureEvent: (callback: (event: LibraryCaptureEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: LibraryCaptureEvent) => callback(data);
    ipcRenderer.on(IPC.LIBRARY_CAPTURE_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.LIBRARY_CAPTURE_EVENT, listener);
  },
};

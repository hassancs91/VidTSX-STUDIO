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
  LibraryDescribeAvailabilityResponse,
  LibraryDescribeCancelResponse,
  LibraryDescribeJobEvent,
  LibraryDescribeStartRequest,
  LibraryDescribeStartResponse,
  LibraryDescriptionSetRequest,
  LibraryDescriptionSetResponse,
  LibraryIndexGetResponse,
  LibraryOrganizeApplyRequest,
  LibraryOrganizeApplyResponse,
  LibraryOrganizeSuggestRequest,
  LibraryOrganizeSuggestResponse,
  LibraryPrefsSetRequest,
  LibraryPrefsSetResponse,
  LibraryPresetDeleteRequest,
  LibraryPresetDeleteResponse,
  LibraryPresetSaveRequest,
  LibraryPresetSaveResponse,
  LibraryPresetsGetResponse,
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

  // ─── AI descriptions — availability, consent, batch job (L2) ───
  libraryDescribeAvailability: (): Promise<LibraryDescribeAvailabilityResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_DESCRIBE_AVAILABILITY),
  libraryPrefsSet: (data: LibraryPrefsSetRequest): Promise<LibraryPrefsSetResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_PREFS_SET, data),
  libraryDescribeStart: (
    data: LibraryDescribeStartRequest
  ): Promise<LibraryDescribeStartResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_DESCRIBE_START, data),
  libraryDescribeCancel: (): Promise<LibraryDescribeCancelResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_DESCRIBE_CANCEL),
  onLibraryDescribeEvent: (callback: (event: LibraryDescribeJobEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: LibraryDescribeJobEvent) => callback(data);
    ipcRenderer.on(IPC.LIBRARY_DESCRIBE_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.LIBRARY_DESCRIBE_EVENT, listener);
  },

  // ─── AI organize — suggest, review, apply (L7) ───
  libraryOrganizeSuggest: (
    data: LibraryOrganizeSuggestRequest
  ): Promise<LibraryOrganizeSuggestResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_ORGANIZE_SUGGEST, data),
  libraryOrganizeApply: (
    data: LibraryOrganizeApplyRequest
  ): Promise<LibraryOrganizeApplyResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_ORGANIZE_APPLY, data),

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

  // ─── Editing presets (V1 completion plan §2.5) ───
  libraryPresetsGet: (): Promise<LibraryPresetsGetResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_PRESETS_GET),
  libraryPresetSave: (data: LibraryPresetSaveRequest): Promise<LibraryPresetSaveResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_PRESET_SAVE, data),
  libraryPresetDelete: (data: LibraryPresetDeleteRequest): Promise<LibraryPresetDeleteResponse> =>
    ipcRenderer.invoke(IPC.LIBRARY_PRESET_DELETE, data),

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

import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  ImageGenerateRequest,
  ImageGenerateResponse,
  ImageGenerateCancelRequest,
  ImageGenerateCancelResponse,
  ImageModelsGetRequest,
  ImageModelsGetResponse,
  ImageProviderSwitchRequest,
  ImageProviderSwitchResponse,
  ImageProviderTestRequest,
  ImageProviderTestResponse,
  ImageProvidersGetResponse,
  ImageProvidersSaveRequest,
  ImageProvidersSaveResponse,
  ImageStudioCopyRequest,
  ImageStudioCopyResponse,
  ImageStudioDeleteRequest,
  ImageStudioDeleteResponse,
  ImageStudioFolderCreateRequest,
  ImageStudioFolderCreateResponse,
  ImageStudioFolderDeleteRequest,
  ImageStudioFolderDeleteResponse,
  ImageStudioFolderRenameRequest,
  ImageStudioFolderRenameResponse,
  ImageStudioListResponse,
  ImageStudioMoveToFolderRequest,
  ImageStudioMoveToFolderResponse,
  ImageStudioReadRequest,
  ImageStudioReadResponse,
  ImageStudioSaveAsRequest,
  ImageStudioSaveAsResponse,
  ImageStudioSaveRequest,
  ImageStudioSaveResponse,
  PromptPresetsGetResponse,
  PromptPresetsSaveRequest,
  RefImageDeleteRequest,
  RefImageDeleteResponse,
  RefImageListResponse,
  RefImageReadRequest,
  RefImageReadResponse,
  RefImageSaveRequest,
  RefImageSaveResponse,
  RefImageToggleRequest,
  RefImageToggleResponse,
} from '../../shared/ipc/types';

export const imageStudioApi = {
  // ─── Image generation operations ───
  // Image generation operations
  imageProvidersGet: (): Promise<ImageProvidersGetResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_PROVIDERS_GET),
  imageProvidersSave: (data: ImageProvidersSaveRequest): Promise<ImageProvidersSaveResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_PROVIDERS_SAVE, data),
  imageProviderTest: (data: ImageProviderTestRequest): Promise<ImageProviderTestResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_PROVIDER_TEST, data),
  imageModelsGet: (data?: ImageModelsGetRequest): Promise<ImageModelsGetResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_MODELS_GET, data),
  imageGenerate: (data: ImageGenerateRequest): Promise<ImageGenerateResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_GENERATE, data),
  imageGenerateCancel: (data: ImageGenerateCancelRequest): Promise<ImageGenerateCancelResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_GENERATE_CANCEL, data),
  imageProviderSwitch: (data: ImageProviderSwitchRequest): Promise<ImageProviderSwitchResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_PROVIDER_SWITCH, data),

  // ─── Image Studio operations ───
  // Image Studio operations
  imageStudioSave: (data: ImageStudioSaveRequest): Promise<ImageStudioSaveResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_STUDIO_SAVE, data),
  imageStudioList: (): Promise<ImageStudioListResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_STUDIO_LIST),
  imageStudioDelete: (data: ImageStudioDeleteRequest): Promise<ImageStudioDeleteResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_STUDIO_DELETE, data),
  imageStudioSaveAs: (data: ImageStudioSaveAsRequest): Promise<ImageStudioSaveAsResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_STUDIO_SAVE_AS, data),
  imageStudioCopy: (data: ImageStudioCopyRequest): Promise<ImageStudioCopyResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_STUDIO_COPY, data),
  imageStudioRead: (data: ImageStudioReadRequest): Promise<ImageStudioReadResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_STUDIO_READ, data),
  imageStudioFolderCreate: (data: ImageStudioFolderCreateRequest): Promise<ImageStudioFolderCreateResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_STUDIO_FOLDER_CREATE, data),
  imageStudioFolderRename: (data: ImageStudioFolderRenameRequest): Promise<ImageStudioFolderRenameResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_STUDIO_FOLDER_RENAME, data),
  imageStudioFolderDelete: (data: ImageStudioFolderDeleteRequest): Promise<ImageStudioFolderDeleteResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_STUDIO_FOLDER_DELETE, data),
  imageStudioMoveToFolder: (data: ImageStudioMoveToFolderRequest): Promise<ImageStudioMoveToFolderResponse> =>
    ipcRenderer.invoke(IPC.IMAGE_STUDIO_MOVE_TO_FOLDER, data),

  // ─── Reference image library ───
  // Reference image library
  refImageSave: (data: RefImageSaveRequest): Promise<RefImageSaveResponse> =>
    ipcRenderer.invoke(IPC.REF_IMAGE_SAVE, data),
  refImageList: (): Promise<RefImageListResponse> =>
    ipcRenderer.invoke(IPC.REF_IMAGE_LIST),
  refImageDelete: (data: RefImageDeleteRequest): Promise<RefImageDeleteResponse> =>
    ipcRenderer.invoke(IPC.REF_IMAGE_DELETE, data),
  refImageToggle: (data: RefImageToggleRequest): Promise<RefImageToggleResponse> =>
    ipcRenderer.invoke(IPC.REF_IMAGE_TOGGLE, data),
  refImageRead: (data: RefImageReadRequest): Promise<RefImageReadResponse> =>
    ipcRenderer.invoke(IPC.REF_IMAGE_READ, data),

  promptPresetsGet: (): Promise<PromptPresetsGetResponse> =>
    ipcRenderer.invoke(IPC.PROMPT_PRESETS_GET),
  promptPresetsSave: (data: PromptPresetsSaveRequest): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.PROMPT_PRESETS_SAVE, data),
  promptPresetsReset: (): Promise<PromptPresetsGetResponse> =>
    ipcRenderer.invoke(IPC.PROMPT_PRESETS_RESET),
};

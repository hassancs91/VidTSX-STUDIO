import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  CreatorArchiveTsxRequest,
  CreatorArchiveTsxResponse,
  CreatorGenerateThumbnailRequest,
  CreatorGenerateThumbnailResponse,
  CreatorLoadDraftRequest,
  CreatorLoadDraftResponse,
  CreatorPushTemplateRequest,
  CreatorPushTemplateResponse,
  CreatorSaveDraftRequest,
  CreatorSaveDraftResponse,
} from '../../shared/ipc/types';

export const creatorApi = {
  // ─── Creator (dev-only) template push ───
  // Creator (dev-only) template push
  creatorPushTemplate: (data: CreatorPushTemplateRequest): Promise<CreatorPushTemplateResponse> =>
    ipcRenderer.invoke(IPC.CREATOR_PUSH_TEMPLATE, data),
  creatorGenerateThumbnail: (data: CreatorGenerateThumbnailRequest): Promise<CreatorGenerateThumbnailResponse> =>
    ipcRenderer.invoke(IPC.CREATOR_GENERATE_THUMBNAIL, data),
  creatorLoadPushDraft: (data: CreatorLoadDraftRequest): Promise<CreatorLoadDraftResponse> =>
    ipcRenderer.invoke(IPC.CREATOR_LOAD_PUSH_DRAFT, data),
  creatorSavePushDraft: (data: CreatorSaveDraftRequest): Promise<CreatorSaveDraftResponse> =>
    ipcRenderer.invoke(IPC.CREATOR_SAVE_PUSH_DRAFT, data),
  creatorArchiveTsx: (data: CreatorArchiveTsxRequest): Promise<CreatorArchiveTsxResponse> =>
    ipcRenderer.invoke(IPC.CREATOR_ARCHIVE_TSX, data),
};

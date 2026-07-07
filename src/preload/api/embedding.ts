import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  EmbeddingDownloadProgressEvent,
  EmbeddingEmbedRequest,
  EmbeddingEmbedResponse,
  EmbeddingLoadModelRequest,
  EmbeddingLoadModelResponse,
  EmbeddingModelDeleteRequest,
  EmbeddingModelDeleteResponse,
  EmbeddingModelDownloadRequest,
  EmbeddingModelDownloadResponse,
  EmbeddingModelsListResponse,
  EmbeddingUnloadModelResponse,
} from '../../shared/ipc/types';

export const embeddingApi = {
  // ─── Embedding engine operations ───
  // Embedding engine operations
  embeddingModelsList: (): Promise<EmbeddingModelsListResponse> =>
    ipcRenderer.invoke(IPC.EMBEDDING_MODELS_LIST),
  embeddingModelDownload: (data: EmbeddingModelDownloadRequest): Promise<EmbeddingModelDownloadResponse> =>
    ipcRenderer.invoke(IPC.EMBEDDING_MODEL_DOWNLOAD, data),
  embeddingModelDelete: (data: EmbeddingModelDeleteRequest): Promise<EmbeddingModelDeleteResponse> =>
    ipcRenderer.invoke(IPC.EMBEDDING_MODEL_DELETE, data),
  onEmbeddingDownloadProgress: (callback: (data: EmbeddingDownloadProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: EmbeddingDownloadProgressEvent) => callback(data);
    ipcRenderer.on(IPC.EMBEDDING_DOWNLOAD_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.EMBEDDING_DOWNLOAD_PROGRESS, handler); };
  },
  embeddingLoadModel: (data: EmbeddingLoadModelRequest): Promise<EmbeddingLoadModelResponse> =>
    ipcRenderer.invoke(IPC.EMBEDDING_LOAD_MODEL, data),
  embeddingUnloadModel: (): Promise<EmbeddingUnloadModelResponse> =>
    ipcRenderer.invoke(IPC.EMBEDDING_UNLOAD_MODEL),
  embeddingEmbed: (data: EmbeddingEmbedRequest): Promise<EmbeddingEmbedResponse> =>
    ipcRenderer.invoke(IPC.EMBEDDING_EMBED, data),
};

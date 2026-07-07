import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleEmbeddingModelsList,
  handleEmbeddingModelDownload,
  handleEmbeddingModelDelete,
  handleEmbeddingLoadModel,
  handleEmbeddingUnloadModel,
  handleEmbeddingEmbed,
} from '../embedding-handlers';

export function registerEmbeddingIpc(): void {
  ipcMain.handle(IPC.EMBEDDING_MODELS_LIST, handleEmbeddingModelsList);
  ipcMain.handle(IPC.EMBEDDING_MODEL_DOWNLOAD, handleEmbeddingModelDownload);
  ipcMain.handle(IPC.EMBEDDING_MODEL_DELETE, handleEmbeddingModelDelete);
  ipcMain.handle(IPC.EMBEDDING_LOAD_MODEL, handleEmbeddingLoadModel);
  ipcMain.handle(IPC.EMBEDDING_UNLOAD_MODEL, handleEmbeddingUnloadModel);
  ipcMain.handle(IPC.EMBEDDING_EMBED, handleEmbeddingEmbed);
}

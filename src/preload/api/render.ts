import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  RenderCancelRequest,
  RenderCancelResponse,
  RenderCompleteEvent,
  RenderEncoderResolvedEvent,
  RenderGetVideosDirResponse,
  RenderHistoryAppendRequest,
  RenderHistoryAppendResponse,
  RenderHistoryLoadResponse,
  RenderOpenFileRequest,
  RenderOpenFileResponse,
  RenderOpenFolderRequest,
  RenderOpenFolderResponse,
  RenderProgressEvent,
  RenderQueueGetResponse,
  RenderQueueLoadResponse,
  RenderQueueSaveRequest,
  RenderQueueSaveResponse,
  RenderStartRequest,
  RenderStartResponse,
} from '../../shared/ipc/types';

export const renderApi = {
  // ─── Render operations ───
  // Render operations
  renderStart: (data: RenderStartRequest): Promise<RenderStartResponse> =>
    ipcRenderer.invoke(IPC.RENDER_START, data),
  renderCancel: (data: RenderCancelRequest): Promise<RenderCancelResponse> =>
    ipcRenderer.invoke(IPC.RENDER_CANCEL, data),
  renderQueueGet: (): Promise<RenderQueueGetResponse> =>
    ipcRenderer.invoke(IPC.RENDER_QUEUE_GET, {}),
  renderQueueSave: (data: RenderQueueSaveRequest): Promise<RenderQueueSaveResponse> =>
    ipcRenderer.invoke(IPC.RENDER_QUEUE_SAVE, data),
  renderQueueLoad: (): Promise<RenderQueueLoadResponse> =>
    ipcRenderer.invoke(IPC.RENDER_QUEUE_LOAD),
  renderOpenFile: (data: RenderOpenFileRequest): Promise<RenderOpenFileResponse> =>
    ipcRenderer.invoke(IPC.RENDER_OPEN_FILE, data),
  renderOpenFolder: (data: RenderOpenFolderRequest): Promise<RenderOpenFolderResponse> =>
    ipcRenderer.invoke(IPC.RENDER_OPEN_FOLDER, data),
  renderGetVideosDir: (): Promise<RenderGetVideosDirResponse> =>
    ipcRenderer.invoke(IPC.RENDER_GET_VIDEOS_DIR),
  renderHistoryLoad: (): Promise<RenderHistoryLoadResponse> =>
    ipcRenderer.invoke(IPC.RENDER_HISTORY_LOAD),
  renderHistoryAppend: (data: RenderHistoryAppendRequest): Promise<RenderHistoryAppendResponse> =>
    ipcRenderer.invoke(IPC.RENDER_HISTORY_APPEND, data),

  // ─── Render event listeners ───
  // Render event listeners
  onRenderProgress: (callback: (data: RenderProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: RenderProgressEvent) => callback(data);
    ipcRenderer.on(IPC.RENDER_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.RENDER_PROGRESS, handler);
  },
  onRenderComplete: (callback: (data: RenderCompleteEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: RenderCompleteEvent) => callback(data);
    ipcRenderer.on(IPC.RENDER_COMPLETE, handler);
    return () => ipcRenderer.removeListener(IPC.RENDER_COMPLETE, handler);
  },
  onRenderEncoderResolved: (callback: (data: RenderEncoderResolvedEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: RenderEncoderResolvedEvent) => callback(data);
    ipcRenderer.on(IPC.RENDER_ENCODER_RESOLVED, handler);
    return () => ipcRenderer.removeListener(IPC.RENDER_ENCODER_RESOLVED, handler);
  },
};

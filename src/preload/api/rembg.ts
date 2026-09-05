import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  RembgCancelRequest,
  RembgCancelResponse,
  RembgCompleteEvent,
  RembgErrorEvent,
  RembgProgressEvent,
  RembgRunRequest,
  RembgRunResponse,
} from '../../shared/ipc/types';

export const rembgApi = {
  // ─── Background removal (Image Studio) ───
  rembgRun: (data: RembgRunRequest): Promise<RembgRunResponse> =>
    ipcRenderer.invoke(IPC.REMBG_RUN, data),
  rembgCancel: (data: RembgCancelRequest): Promise<RembgCancelResponse> =>
    ipcRenderer.invoke(IPC.REMBG_CANCEL, data),
  onRembgProgress: (callback: (data: RembgProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: RembgProgressEvent) => callback(data);
    ipcRenderer.on(IPC.REMBG_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.REMBG_PROGRESS, handler); };
  },
  onRembgComplete: (callback: (data: RembgCompleteEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: RembgCompleteEvent) => callback(data);
    ipcRenderer.on(IPC.REMBG_COMPLETE, handler);
    return () => { ipcRenderer.removeListener(IPC.REMBG_COMPLETE, handler); };
  },
  onRembgError: (callback: (data: RembgErrorEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: RembgErrorEvent) => callback(data);
    ipcRenderer.on(IPC.REMBG_ERROR, handler);
    return () => { ipcRenderer.removeListener(IPC.REMBG_ERROR, handler); };
  },
};

import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  Sd3dCancelRequest,
  Sd3dCancelResponse,
  Sd3dGenerateCompleteEvent,
  Sd3dGenerateErrorEvent,
  Sd3dGenerateProgressEvent,
  Sd3dGenerateRequest,
  Sd3dGenerateResponse,
} from '../../shared/ipc/types';

export const sd3dApi = {
  // ─── Image → 3D (TripoSR) ───
  sd3dGenerate: (data: Sd3dGenerateRequest): Promise<Sd3dGenerateResponse> =>
    ipcRenderer.invoke(IPC.SD3D_GENERATE, data),
  sd3dCancel: (data: Sd3dCancelRequest): Promise<Sd3dCancelResponse> =>
    ipcRenderer.invoke(IPC.SD3D_CANCEL, data),
  onSd3dGenerateProgress: (callback: (data: Sd3dGenerateProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: Sd3dGenerateProgressEvent) => callback(data);
    ipcRenderer.on(IPC.SD3D_GENERATE_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.SD3D_GENERATE_PROGRESS, handler); };
  },
  onSd3dGenerateComplete: (callback: (data: Sd3dGenerateCompleteEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: Sd3dGenerateCompleteEvent) => callback(data);
    ipcRenderer.on(IPC.SD3D_GENERATE_COMPLETE, handler);
    return () => { ipcRenderer.removeListener(IPC.SD3D_GENERATE_COMPLETE, handler); };
  },
  onSd3dGenerateError: (callback: (data: Sd3dGenerateErrorEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: Sd3dGenerateErrorEvent) => callback(data);
    ipcRenderer.on(IPC.SD3D_GENERATE_ERROR, handler);
    return () => { ipcRenderer.removeListener(IPC.SD3D_GENERATE_ERROR, handler); };
  },
};

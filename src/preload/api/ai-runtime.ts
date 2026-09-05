import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  AiRuntimeInstallRequest,
  AiRuntimeInstallResponse,
  AiRuntimeRemoveResponse,
  AiRuntimeRepairResponse,
  AiRuntimeStatusChangedEvent,
  AiRuntimeStatusResponse,
} from '../../shared/ipc/types';

export const aiRuntimeApi = {
  // ─── AI runtime (downloadable Python + PyTorch) ───
  aiRuntimeStatus: (): Promise<AiRuntimeStatusResponse> =>
    ipcRenderer.invoke(IPC.AI_RUNTIME_STATUS),
  aiRuntimeInstall: (data: AiRuntimeInstallRequest = {}): Promise<AiRuntimeInstallResponse> =>
    ipcRenderer.invoke(IPC.AI_RUNTIME_INSTALL, data),
  aiRuntimeRepair: (): Promise<AiRuntimeRepairResponse> =>
    ipcRenderer.invoke(IPC.AI_RUNTIME_REPAIR),
  aiRuntimeRemove: (): Promise<AiRuntimeRemoveResponse> =>
    ipcRenderer.invoke(IPC.AI_RUNTIME_REMOVE),
  onAiRuntimeStatusChanged: (callback: (status: AiRuntimeStatusChangedEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: AiRuntimeStatusChangedEvent) => callback(status);
    ipcRenderer.on(IPC.AI_RUNTIME_STATUS_CHANGED, handler);
    return () => { ipcRenderer.removeListener(IPC.AI_RUNTIME_STATUS_CHANGED, handler); };
  },
};

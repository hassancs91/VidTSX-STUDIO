import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  SystemInfoGetResponse,
  SystemModelsFolderOpenResponse,
  SystemMonitorDataEvent,
  SystemRuntimeRemoveRequest,
  SystemRuntimeRemoveResponse,
  SystemRuntimesGetResponse,
} from '../../shared/ipc/types';

export const systemApi = {
  // ─── System resource monitor (always-on, push events only) ───
  // System resource monitor (always-on, push events only)
  onSystemMonitorData: (callback: (data: SystemMonitorDataEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SystemMonitorDataEvent) => callback(data);
    ipcRenderer.on(IPC.SYSTEM_MONITOR_DATA, handler);
    return () => { ipcRenderer.removeListener(IPC.SYSTEM_MONITOR_DATA, handler); };
  },

  // ─── System info ───
  // System info
  systemInfoGet: (): Promise<SystemInfoGetResponse> =>
    ipcRenderer.invoke(IPC.SYSTEM_INFO_GET),

  // ─── AI Models → Overview: runtimes table + storage folder ───
  systemRuntimesGet: (): Promise<SystemRuntimesGetResponse> =>
    ipcRenderer.invoke(IPC.SYSTEM_RUNTIMES_GET),
  systemRuntimeRemove: (data: SystemRuntimeRemoveRequest): Promise<SystemRuntimeRemoveResponse> =>
    ipcRenderer.invoke(IPC.SYSTEM_RUNTIME_REMOVE, data),
  systemModelsFolderOpen: (): Promise<SystemModelsFolderOpenResponse> =>
    ipcRenderer.invoke(IPC.SYSTEM_MODELS_FOLDER_OPEN),
};

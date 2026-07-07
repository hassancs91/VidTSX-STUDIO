import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  PyTorchPipInstallRequest,
  PyTorchPipInstallResponse,
  SystemInfoGetResponse,
  SystemMonitorDataEvent,
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
  pytorchPipInstall: (data: PyTorchPipInstallRequest): Promise<PyTorchPipInstallResponse> =>
    ipcRenderer.invoke(IPC.PYTORCH_PIP_INSTALL, data),
};

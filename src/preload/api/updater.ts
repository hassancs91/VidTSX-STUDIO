import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  UpdaterCancelResponse,
  UpdaterCheckRequest,
  UpdaterCheckResponse,
  UpdaterDownloadResponse,
  UpdaterGetStateResponse,
  UpdaterInstallResponse,
  UpdaterSetPrefsRequest,
  UpdaterSetPrefsResponse,
  UpdaterStateEvent,
} from '../../shared/ipc/types';

export const updaterApi = {
  // ─── Auto-update operations ───
  updaterGetState: (): Promise<UpdaterGetStateResponse> =>
    ipcRenderer.invoke(IPC.UPDATER_GET_STATE),
  updaterCheck: (data?: UpdaterCheckRequest): Promise<UpdaterCheckResponse> =>
    ipcRenderer.invoke(IPC.UPDATER_CHECK, data),
  updaterDownload: (): Promise<UpdaterDownloadResponse> =>
    ipcRenderer.invoke(IPC.UPDATER_DOWNLOAD),
  updaterCancel: (): Promise<UpdaterCancelResponse> =>
    ipcRenderer.invoke(IPC.UPDATER_CANCEL),
  updaterInstall: (): Promise<UpdaterInstallResponse> =>
    ipcRenderer.invoke(IPC.UPDATER_INSTALL),
  updaterSetPrefs: (data: UpdaterSetPrefsRequest): Promise<UpdaterSetPrefsResponse> =>
    ipcRenderer.invoke(IPC.UPDATER_SET_PREFS, data),
  onUpdaterState: (callback: (data: UpdaterStateEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: UpdaterStateEvent) => callback(data);
    ipcRenderer.on(IPC.UPDATER_STATE, handler);
    return () => { ipcRenderer.removeListener(IPC.UPDATER_STATE, handler); };
  },
};

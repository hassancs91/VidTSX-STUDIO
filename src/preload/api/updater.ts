import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  UpdaterDownloadProgressEvent,
  UpdaterErrorEvent,
  UpdaterGetCurrentVersionResponse,
  UpdaterSimpleResponse,
  UpdaterUpToDateEvent,
  UpdaterUpdateAvailableEvent,
  UpdaterUpdateDownloadedEvent,
} from '../../shared/ipc/types';

export const updaterApi = {
  // ─── Updater operations ───
  // Updater operations
  updaterCheck: (): Promise<UpdaterSimpleResponse> =>
    ipcRenderer.invoke(IPC.UPDATER_CHECK),
  updaterDownload: (): Promise<UpdaterSimpleResponse> =>
    ipcRenderer.invoke(IPC.UPDATER_DOWNLOAD),
  updaterInstall: (): Promise<UpdaterSimpleResponse> =>
    ipcRenderer.invoke(IPC.UPDATER_INSTALL),
  updaterGetCurrentVersion: (): Promise<UpdaterGetCurrentVersionResponse> =>
    ipcRenderer.invoke(IPC.UPDATER_GET_CURRENT_VERSION),
  onUpdaterUpdateAvailable: (callback: (data: UpdaterUpdateAvailableEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: UpdaterUpdateAvailableEvent) => callback(data);
    ipcRenderer.on(IPC.UPDATER_UPDATE_AVAILABLE, handler);
    return () => ipcRenderer.removeListener(IPC.UPDATER_UPDATE_AVAILABLE, handler);
  },
  onUpdaterUpToDate: (callback: (data: UpdaterUpToDateEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: UpdaterUpToDateEvent) => callback(data);
    ipcRenderer.on(IPC.UPDATER_UP_TO_DATE, handler);
    return () => ipcRenderer.removeListener(IPC.UPDATER_UP_TO_DATE, handler);
  },
  onUpdaterDownloadProgress: (callback: (data: UpdaterDownloadProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: UpdaterDownloadProgressEvent) => callback(data);
    ipcRenderer.on(IPC.UPDATER_DOWNLOAD_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.UPDATER_DOWNLOAD_PROGRESS, handler);
  },
  onUpdaterUpdateDownloaded: (callback: (data: UpdaterUpdateDownloadedEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: UpdaterUpdateDownloadedEvent) => callback(data);
    ipcRenderer.on(IPC.UPDATER_UPDATE_DOWNLOADED, handler);
    return () => ipcRenderer.removeListener(IPC.UPDATER_UPDATE_DOWNLOADED, handler);
  },
  onUpdaterError: (callback: (data: UpdaterErrorEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: UpdaterErrorEvent) => callback(data);
    ipcRenderer.on(IPC.UPDATER_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC.UPDATER_ERROR, handler);
  },
};

import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  LicenseActivateRequest,
  LicenseActivateResponse,
  LicenseCheckResponse,
  LicenseDeactivateResponse,
  LicenseGetStatusResponse,
  LicenseStatusChangedEvent,
  LicenseWhoamiResponse,
} from '../../shared/ipc/types';

export const licenseApi = {
  // ─── License operations ───
  // License operations
  licenseActivate: (data: LicenseActivateRequest): Promise<LicenseActivateResponse> =>
    ipcRenderer.invoke(IPC.LICENSE_ACTIVATE, data),
  licenseCheck: (): Promise<LicenseCheckResponse> =>
    ipcRenderer.invoke(IPC.LICENSE_CHECK),
  licenseDeactivate: (): Promise<LicenseDeactivateResponse> =>
    ipcRenderer.invoke(IPC.LICENSE_DEACTIVATE),
  licenseGetStatus: (): Promise<LicenseGetStatusResponse> =>
    ipcRenderer.invoke(IPC.LICENSE_GET_STATUS),
  licenseWhoami: (): Promise<LicenseWhoamiResponse> =>
    ipcRenderer.invoke(IPC.LICENSE_WHOAMI),
  onLicenseStatusChanged: (callback: (data: LicenseStatusChangedEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: LicenseStatusChangedEvent) => callback(data);
    ipcRenderer.on(IPC.LICENSE_STATUS_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC.LICENSE_STATUS_CHANGED, handler);
  },
};

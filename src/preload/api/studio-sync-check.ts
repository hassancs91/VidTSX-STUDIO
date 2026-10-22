import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  StudioSyncCheckCancelRequest,
  StudioSyncCheckCancelResponse,
  StudioSyncCheckProgressEvent,
  StudioSyncCheckRequest,
  StudioSyncCheckResponse,
} from '../../shared/ipc/types';

export const studioSyncCheckApi = {
  // ─── Studio — T8 "Check this export" (A/V sync check, END_TO_END_PLAN A6) ───
  studioExportSyncCheck: (data: StudioSyncCheckRequest): Promise<StudioSyncCheckResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_EXPORT_SYNC_CHECK, data),
  studioExportSyncCheckCancel: (data?: StudioSyncCheckCancelRequest): Promise<StudioSyncCheckCancelResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_EXPORT_SYNC_CHECK_CANCEL, data),
  onStudioExportSyncCheckProgress: (callback: (event: StudioSyncCheckProgressEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: StudioSyncCheckProgressEvent) => callback(payload);
    ipcRenderer.on(IPC.STUDIO_EXPORT_SYNC_CHECK_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC.STUDIO_EXPORT_SYNC_CHECK_PROGRESS, listener);
  },
};

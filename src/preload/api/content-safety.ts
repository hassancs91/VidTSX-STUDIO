import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type { ContentSafetyStatusResponse } from '../../shared/ipc/types';

export const contentSafetyApi = {
  // ─── Content Safety ───
  contentSafetyStatus: (): Promise<ContentSafetyStatusResponse> =>
    ipcRenderer.invoke(IPC.CONTENT_SAFETY_STATUS),
};

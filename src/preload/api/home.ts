import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type { HomeSummaryResponse } from '../../shared/ipc/types';

export const homeApi = {
  // ─── Home (V1 completion plan §2.6) ───
  homeSummary: (): Promise<HomeSummaryResponse> => ipcRenderer.invoke(IPC.HOME_SUMMARY),
};

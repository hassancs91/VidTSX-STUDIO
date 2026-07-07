import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  HomepageGetResponse,
} from '../../shared/ipc/types';

export const homepageApi = {
  // ─── Homepage content ───
  // Homepage content
  homepageGet: (): Promise<HomepageGetResponse> =>
    ipcRenderer.invoke(IPC.HOMEPAGE_GET),
};

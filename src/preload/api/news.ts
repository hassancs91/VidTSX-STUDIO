import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  NewsDismissRequest,
  NewsDismissResponse,
  NewsGetResponse,
  NewsSetEnabledRequest,
  NewsSetEnabledResponse,
} from '../../shared/ipc/types';

export const newsApi = {
  // ─── Announcements feed (Phase I) ───
  newsGet: (): Promise<NewsGetResponse> => ipcRenderer.invoke(IPC.NEWS_GET),
  newsDismiss: (data: NewsDismissRequest): Promise<NewsDismissResponse> =>
    ipcRenderer.invoke(IPC.NEWS_DISMISS, data),
  newsSetEnabled: (data: NewsSetEnabledRequest): Promise<NewsSetEnabledResponse> =>
    ipcRenderer.invoke(IPC.NEWS_SET_ENABLED, data),
};

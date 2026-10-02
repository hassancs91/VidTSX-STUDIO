import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  StudioBrandFontsGetRequest,
  StudioBrandFontsGetResponse,
} from '../../shared/ipc/types';

export const studioBrandFontsApi = {
  // ─── Studio — brand fonts (video-10 gap 10) ───
  studioBrandFontsGet: (data: StudioBrandFontsGetRequest): Promise<StudioBrandFontsGetResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_BRAND_FONTS_GET, data),
};

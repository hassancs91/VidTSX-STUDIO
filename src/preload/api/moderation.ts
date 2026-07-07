import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  ModerationCheckRequest,
  ModerationCheckResponse,
} from '../../shared/ipc/types';

export const moderationApi = {
  // ─── Moderation engine ───
  // Moderation engine
  moderationCheck: (data: ModerationCheckRequest): Promise<ModerationCheckResponse> =>
    ipcRenderer.invoke(IPC.MODERATION_CHECK, data),
};

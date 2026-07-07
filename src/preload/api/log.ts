import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  LogWriteRequest,
  LogWriteResponse,
} from '../../shared/ipc/types';

export const logApi = {
  // ─── Logging ───
  // Logging
  logWrite: (data: LogWriteRequest): Promise<LogWriteResponse> =>
    ipcRenderer.invoke(IPC.LOG_WRITE, data),
};

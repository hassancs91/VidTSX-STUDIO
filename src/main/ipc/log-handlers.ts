import type { IpcMainInvokeEvent } from 'electron';
import { logEngine } from '../../logging/log-engine';
import type { LogWriteRequest, LogWriteResponse } from '../../shared/ipc/types';
import type { LogEntry } from '../../logging/log-types';

export async function handleLogWrite(
  _event: IpcMainInvokeEvent,
  data: LogWriteRequest,
): Promise<LogWriteResponse> {
  try {
    const entry: LogEntry = {
      level: data.level,
      module: data.module,
      message: data.message,
      timestamp: new Date().toISOString(),
      process: 'renderer',
      ...(data.context && { context: data.context }),
      ...(data.error && { error: data.error }),
    };

    logEngine.ingest(entry);
    return { success: true };
  } catch {
    return { success: false };
  }
}

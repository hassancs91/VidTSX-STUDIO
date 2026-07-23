import { BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '@shared/ipc/channels';
import type {
  TsxJobStartRequest,
  TsxJobStartResponse,
  TsxJobCancelRequest,
  TsxJobCancelResponse,
  TsxJobListResponse,
  TsxJobClearCompletedResponse,
  TsxJobConfigureRequest,
  TsxJobConfigureResponse,
  TsxJobEvent,
  TsxJobStreamEvent,
} from '@shared/ipc/types';
import { tsxJobEngine } from '../services/tsx-jobs/tsx-job-engine';
import { setTsxJobsMaxConcurrent } from '../services/settings';

let broadcastInitialized = false;

/** Broadcast job snapshots to every window — jobs outlive the window that started them. */
export function initTsxJobBroadcast(): void {
  if (broadcastInitialized) return;
  broadcastInitialized = true;
  tsxJobEngine.onEvent((job) => {
    const payload: TsxJobEvent = { job };
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.TSXJOB_EVENT, payload);
      }
    }
  });
  tsxJobEngine.onStream((jobId, chunk) => {
    const payload: TsxJobStreamEvent = { jobId, chunk };
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.TSXJOB_STREAM, payload);
      }
    }
  });
}

export async function handleTsxJobStart(
  _event: IpcMainInvokeEvent,
  data: TsxJobStartRequest
): Promise<TsxJobStartResponse> {
  try {
    const result = tsxJobEngine.start(data);
    if (result.error) return { success: false, error: result.error };
    return { success: true, jobId: result.jobId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to start job' };
  }
}

export async function handleTsxJobCancel(
  _event: IpcMainInvokeEvent,
  data: TsxJobCancelRequest
): Promise<TsxJobCancelResponse> {
  try {
    return tsxJobEngine.cancel(data.jobId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to cancel job' };
  }
}

export async function handleTsxJobList(): Promise<TsxJobListResponse> {
  try {
    return { jobs: tsxJobEngine.list() };
  } catch {
    return { jobs: [] };
  }
}

export async function handleTsxJobConfigure(
  _event: IpcMainInvokeEvent,
  data: TsxJobConfigureRequest
): Promise<TsxJobConfigureResponse> {
  try {
    if (typeof data?.maxConcurrent === 'number') {
      const clamped = Math.min(4, Math.max(1, Math.round(data.maxConcurrent)));
      tsxJobEngine.configure({ maxConcurrent: clamped });
      await setTsxJobsMaxConcurrent(clamped);
    }
    return { success: true, maxConcurrent: tsxJobEngine.getMaxConcurrent() };
  } catch {
    return { success: false, maxConcurrent: tsxJobEngine.getMaxConcurrent() };
  }
}

export async function handleTsxJobClearCompleted(): Promise<TsxJobClearCompletedResponse> {
  try {
    return { success: true, removed: tsxJobEngine.clearCompleted() };
  } catch {
    return { success: false, removed: 0 };
  }
}

import type { IpcMainInvokeEvent } from 'electron';
import { BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  DownloadEnqueueRequest,
  DownloadEnqueueResponse,
  DownloadControlRequest,
  DownloadControlResponse,
  DownloadGetAllResponse,
  DownloadProgressEvent,
} from '../../shared/ipc/types';
import {
  enqueueDownload,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  getAllDownloads,
  onDownloadProgress,
} from '../services/download-manager';
import type { DownloadProgress } from '../services/download-manager';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('DownloadIPC');

/** Subscribe to engine progress and push to all renderer windows */
export function initDownloadProgressBroadcast(): void {
  onDownloadProgress((progress: DownloadProgress) => {
    const event: DownloadProgressEvent = {
      id: progress.id,
      status: progress.status,
      downloadedBytes: progress.downloadedBytes,
      totalBytes: progress.totalBytes,
      percent: progress.percent,
      speedBps: progress.speedBps,
      etaSeconds: progress.etaSeconds,
      error: progress.error,
      metadata: progress.metadata,
    };

    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.DOWNLOAD_PROGRESS, event);
      }
    }
  });
}

export async function handleDownloadEnqueue(
  _event: IpcMainInvokeEvent,
  data: DownloadEnqueueRequest,
): Promise<DownloadEnqueueResponse> {
  try {
    log.info('Enqueue request', { id: data.id, url: data.url });
    // Fire-and-forget — progress is pushed via DOWNLOAD_PROGRESS events
    enqueueDownload({
      id: data.id,
      url: data.url,
      destPath: data.destPath,
      sha256: data.sha256,
      extraction: data.extraction,
      metadata: data.metadata,
      priority: data.priority,
    }).catch((err) => {
      log.error('Download failed', err, { id: data.id });
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enqueue download';
    log.error('Failed to enqueue download', err, { id: data.id });
    return { success: false, error: message };
  }
}

export async function handleDownloadPause(
  _event: IpcMainInvokeEvent,
  data: DownloadControlRequest,
): Promise<DownloadControlResponse> {
  try {
    pauseDownload(data.id);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to pause download';
    return { success: false, error: message };
  }
}

export async function handleDownloadResume(
  _event: IpcMainInvokeEvent,
  data: DownloadControlRequest,
): Promise<DownloadControlResponse> {
  try {
    resumeDownload(data.id);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to resume download';
    return { success: false, error: message };
  }
}

export async function handleDownloadCancel(
  _event: IpcMainInvokeEvent,
  data: DownloadControlRequest,
): Promise<DownloadControlResponse> {
  try {
    cancelDownload(data.id);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel download';
    return { success: false, error: message };
  }
}

export async function handleDownloadGetAll(
  _event: IpcMainInvokeEvent,
): Promise<DownloadGetAllResponse> {
  const downloads = getAllDownloads();
  return {
    downloads: downloads.map((d) => ({
      id: d.id,
      status: d.status,
      downloadedBytes: d.downloadedBytes,
      totalBytes: d.totalBytes,
      percent: d.percent,
      speedBps: d.speedBps,
      etaSeconds: d.etaSeconds,
      error: d.error,
      metadata: d.metadata,
    })),
  };
}

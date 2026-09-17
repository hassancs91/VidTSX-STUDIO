import type { IpcMainInvokeEvent } from 'electron';
import type { SdVideoModelDownloadRequest, SdVideoModelDownloadResponse } from '../../shared/ipc/types';
import { downloadVideoProfileModel } from '../services/sdvideo-download';

/**
 * One-click video profile download (model + missing companions). Progress
 * reaches the renderer through the global DOWNLOAD_PROGRESS broadcast
 * (metadata.type === 'sdvideo-model') — no per-category progress channel.
 * Generation is not an IPC of its own any more: the video engine's local
 * provider (video-init.ts) drives the sd-cli engine, so the Videos screen,
 * Studio, the agents and Flows all reach it through VIDEO_GENERATE.
 */
export async function handleSdVideoModelDownload(
  _event: IpcMainInvokeEvent,
  data: SdVideoModelDownloadRequest,
): Promise<SdVideoModelDownloadResponse> {
  try {
    await downloadVideoProfileModel(data.modelId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Download failed',
    };
  }
}

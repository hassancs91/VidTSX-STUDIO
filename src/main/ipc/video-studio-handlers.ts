import { dialog, BrowserWindow } from 'electron';
import { copyFile } from 'fs/promises';
import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';
import type {
  VideoStudioSaveRequest,
  VideoStudioSaveResponse,
  VideoStudioListResponse,
  VideoStudioDeleteRequest,
  VideoStudioDeleteResponse,
  VideoStudioSaveAsRequest,
  VideoStudioSaveAsResponse,
  VideoStudioReadPathRequest,
  VideoStudioReadPathResponse,
} from '../../shared/ipc/types';
import { listVideos, deleteVideo, getVideoFilePath } from '../services/video-studio-db';
import {
  saveVideoFromUrl,
  findVideoEntryByFileUrl,
  fileVideoInFolder,
} from '../services/video-studio-save';
import { ModerationBlockedError } from '../../shared/content-safety';

export async function handleVideoStudioSave(
  _event: IpcMainInvokeEvent,
  data: VideoStudioSaveRequest,
): Promise<VideoStudioSaveResponse> {
  try {
    if (!data.url || typeof data.url !== 'string') {
      return { success: false, error: 'Missing video URL' };
    }

    // A clip the video engine already downloaded, gated, and filed: the
    // caller holds its local file URL. Re-saving resolves to the existing
    // entry (no second download, no second gate) and only files it into the
    // requested folder.
    if (/^file:/i.test(data.url)) {
      const existing = await findVideoEntryByFileUrl(data.url);
      if (!existing) return { success: false, error: 'Video is not in Video Studio' };
      return { success: true, entry: await fileVideoInFolder(existing, data.folderId) };
    }

    if (!/^https?:\/\//i.test(data.url)) {
      return { success: false, error: 'URL must be http(s)' };
    }

    const entry = await saveVideoFromUrl({
      url: data.url,
      prompt: data.prompt,
      model: data.model,
      aspectRatio: data.aspectRatio,
      durationSeconds: data.durationSeconds,
      hasAudio: data.hasAudio,
      creditsConsumed: data.creditsConsumed,
      folderId: data.folderId,
    });
    return { success: true, entry };
  } catch (err) {
    if (err instanceof ModerationBlockedError) {
      return { success: false, error: err.message, blocked: err.toBlockInfo() };
    }
    const error = err instanceof Error ? err.message : 'Failed to save video';
    return { success: false, error };
  }
}

export async function handleVideoStudioList(): Promise<VideoStudioListResponse> {
  try {
    const { entries, folders, basePath, thumbnailsBasePath } = await listVideos();
    return { success: true, entries, folders, basePath, thumbnailsBasePath };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to list videos';
    return { success: false, entries: [], folders: [], basePath: '', thumbnailsBasePath: '', error };
  }
}

export async function handleVideoStudioDelete(
  _event: IpcMainInvokeEvent,
  data: VideoStudioDeleteRequest,
): Promise<VideoStudioDeleteResponse> {
  try {
    await deleteVideo(data.id);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete video';
    return { success: false, error };
  }
}

export async function handleVideoStudioSaveAs(
  _event: IpcMainInvokeEvent,
  data: VideoStudioSaveAsRequest,
): Promise<VideoStudioSaveAsResponse> {
  try {
    const sourcePath = await getVideoFilePath(data.id);
    if (!sourcePath) {
      return { success: false, error: 'Video not found' };
    }

    const win = BrowserWindow.getFocusedWindow();
    if (!win) {
      return { success: false, error: 'No focused window' };
    }

    const fileName = path.basename(sourcePath);
    const ext = path.extname(fileName).slice(1) || 'mp4';
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Video',
      defaultPath: fileName,
      filters: [{ name: `${ext.toUpperCase()} Video`, extensions: [ext] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Save cancelled' };
    }

    await copyFile(sourcePath, result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save video';
    return { success: false, error };
  }
}

export async function handleVideoStudioReadPath(
  _event: IpcMainInvokeEvent,
  data: VideoStudioReadPathRequest,
): Promise<VideoStudioReadPathResponse> {
  try {
    const filePath = await getVideoFilePath(data.id);
    if (!filePath) {
      return { success: false, error: 'Video not found' };
    }
    return { success: true, filePath };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to resolve video path';
    return { success: false, error };
  }
}

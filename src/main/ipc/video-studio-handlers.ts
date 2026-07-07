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
import {
  saveVideo,
  setThumbnail,
  listVideos,
  deleteVideo,
  getVideoFilePath,
} from '../services/video-studio-db';
import { extractThumbnail, buildThumbnailFileName } from '../services/video-thumbnailer';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('video-studio-handlers');

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB cap

async function downloadVideo(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(
      err instanceof Error ? `Network error fetching video: ${err.message}` : 'Network error fetching video',
    );
  }
  if (!res.ok) {
    throw new Error(`Failed to download video (HTTP ${res.status})`);
  }
  const contentLength = Number(res.headers.get('content-length') || '0');
  if (contentLength > MAX_VIDEO_BYTES) {
    throw new Error(`Video too large (${contentLength} bytes > ${MAX_VIDEO_BYTES} cap)`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_VIDEO_BYTES) {
    throw new Error(`Video too large (${buf.length} bytes > ${MAX_VIDEO_BYTES} cap)`);
  }
  const headerType = res.headers.get('content-type') || '';
  // VidTSX S3 often returns binary/octet-stream — default to mp4.
  const contentType =
    headerType === 'video/mp4' || headerType === 'video/webm' || headerType === 'video/quicktime'
      ? headerType
      : 'video/mp4';
  return { bytes: buf, contentType };
}

export async function handleVideoStudioSave(
  _event: IpcMainInvokeEvent,
  data: VideoStudioSaveRequest,
): Promise<VideoStudioSaveResponse> {
  try {
    if (!data.url || typeof data.url !== 'string') {
      return { success: false, error: 'Missing video URL' };
    }
    if (!/^https?:\/\//i.test(data.url)) {
      return { success: false, error: 'URL must be http(s)' };
    }

    const { bytes, contentType } = await downloadVideo(data.url);

    const entry = await saveVideo({
      bytes,
      prompt: data.prompt,
      model: data.model,
      aspectRatio: data.aspectRatio ?? null,
      durationSeconds: data.durationSeconds ?? null,
      hasAudio: data.hasAudio ?? false,
      contentType,
      creditsConsumed: data.creditsConsumed ?? null,
      sourceUrl: data.url,
      folderId: data.folderId ?? null,
    });

    // Fire-and-forget thumbnail extraction. Failure is non-fatal.
    const videoPath = path.join((await listVideos()).basePath, entry.fileName);
    const thumbName = buildThumbnailFileName(entry.fileName);
    extractThumbnail(videoPath, thumbName)
      .then(async (result) => {
        if (result) {
          try {
            await setThumbnail(entry.id, thumbName);
          } catch (err) {
            log.warn('Failed to set thumbnail filename', {
              err: err instanceof Error ? err.message : String(err),
            });
          }
        }
      })
      .catch((err) => {
        log.warn('Thumbnail task threw', {
          err: err instanceof Error ? err.message : String(err),
        });
      });

    return { success: true, entry };
  } catch (err) {
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

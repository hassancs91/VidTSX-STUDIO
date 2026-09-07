import path from 'path';
import { fileURLToPath } from 'url';
import type { VideoStudioEntry } from '../../shared/ipc/types';
import { saveVideo, setThumbnail, listVideos, moveToFolder } from './video-studio-db';
import { getVideosDir } from './video-studio-files';
import { extractThumbnail, buildThumbnailFileName } from './video-thumbnailer';
import { checkVideoBuffer } from './content-safety/video-safety';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('video-studio-save');

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB cap

export interface SaveVideoFromUrlInput {
  url: string;
  prompt: string;
  model: string;
  aspectRatio?: string | null;
  durationSeconds?: number | null;
  hasAudio?: boolean;
  creditsConsumed?: number | null;
  folderId?: string | null;
  signal?: AbortSignal;
}

export async function downloadVideo(
  url: string,
  signal?: AbortSignal,
): Promise<{ bytes: Buffer; contentType: string }> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
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
  // Object stores often return binary/octet-stream — default to mp4.
  const contentType =
    headerType === 'video/mp4' || headerType === 'video/webm' || headerType === 'video/quicktime'
      ? headerType
      : 'video/mp4';
  return { bytes: buf, contentType };
}

/** Absolute path of a Video Studio entry's clip. */
export function videoEntryFilePath(entry: VideoStudioEntry): string {
  return path.join(getVideosDir(), entry.fileName);
}

/**
 * The one save path for generated clips: download → Content Safety Gate B
 * (D2c call site 4: 2 fps samples + first/middle/last frames) → SQLite +
 * disk → thumbnail. Used by the video engine's finishing step and by the
 * videoStudioSave IPC. Throws ModerationBlockedError when a frame trips.
 */
export async function saveVideoFromUrl(input: SaveVideoFromUrlInput): Promise<VideoStudioEntry> {
  const { bytes, contentType } = await downloadVideo(input.url, input.signal);

  await checkVideoBuffer(bytes, contentType === 'video/webm' ? '.webm' : '.mp4');

  const entry = await saveVideo({
    bytes,
    prompt: input.prompt,
    model: input.model,
    aspectRatio: input.aspectRatio ?? null,
    durationSeconds: input.durationSeconds ?? null,
    hasAudio: input.hasAudio ?? false,
    contentType,
    creditsConsumed: input.creditsConsumed ?? null,
    sourceUrl: input.url,
    folderId: input.folderId ?? null,
  });

  // Fire-and-forget thumbnail extraction. Failure is non-fatal.
  const thumbName = buildThumbnailFileName(entry.fileName);
  extractThumbnail(videoEntryFilePath(entry), thumbName)
    .then(async (result) => {
      if (!result) return;
      try {
        await setThumbnail(entry.id, thumbName);
      } catch (err) {
        log.warn('Failed to set thumbnail filename', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    })
    .catch((err) => {
      log.warn('Thumbnail task threw', { err: err instanceof Error ? err.message : String(err) });
    });

  return entry;
}

/**
 * Resolve a `file://` URL that points inside the Video Studio clips folder to
 * its entry — how a caller that only holds the engine's local URL (the Flows
 * node, unchanged in video-providers Stage 2) re-saves without a second
 * download or a second gate.
 */
export async function findVideoEntryByFileUrl(url: string): Promise<VideoStudioEntry | null> {
  let filePath: string;
  try {
    filePath = fileURLToPath(url);
  } catch {
    return null;
  }
  const videosDir = path.resolve(getVideosDir()).toLowerCase();
  if (path.resolve(path.dirname(filePath)).toLowerCase() !== videosDir) return null;
  const fileName = path.basename(filePath).toLowerCase();
  const { entries } = await listVideos();
  return entries.find((e) => e.fileName.toLowerCase() === fileName) ?? null;
}

/** File an existing entry into a folder (no-op when it is already there). */
export async function fileVideoInFolder(
  entry: VideoStudioEntry,
  folderId: string | null | undefined,
): Promise<VideoStudioEntry> {
  if (folderId === undefined || folderId === entry.folderId) return entry;
  await moveToFolder([entry.id], folderId);
  return { ...entry, folderId };
}

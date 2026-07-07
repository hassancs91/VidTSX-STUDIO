import type { IpcMainInvokeEvent } from 'electron';
import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type {
  AppGetIsDevResponse,
  CreatorPushTemplateRequest,
  CreatorPushTemplateResponse,
  CreatorGenerateThumbnailRequest,
  CreatorGenerateThumbnailResponse,
  CreatorLoadDraftRequest,
  CreatorLoadDraftResponse,
  CreatorSaveDraftRequest,
  CreatorSaveDraftResponse,
  CreatorArchiveTsxRequest,
  CreatorArchiveTsxResponse,
} from '../../shared/ipc/types';
import { pushTemplate } from '../services/template-pusher';
import { detectSystemFfmpeg, generateAnimatedWebp } from '../services/webp-thumbnail-generator';
import { readDraft, writeDraft, getThumbnailPath } from '../services/creator-db';
import { importLegacyDraftForTsx } from '../services/creator-migrate';
import { archiveTsx } from '../services/creator-archive';

export async function handleAppGetIsDev(): Promise<AppGetIsDevResponse> {
  return { isDev: !app.isPackaged };
}

export async function handleCreatorPushTemplate(
  _event: IpcMainInvokeEvent,
  data: CreatorPushTemplateRequest
): Promise<CreatorPushTemplateResponse> {
  if (app.isPackaged) {
    return { success: false, error: 'Push is only available in dev mode' };
  }
  if (!data?.tsxFilePath || !data.mp4Path || !data.thumbnailPath || !data.title || !data.slug) {
    return { success: false, error: 'Missing required fields (tsxFilePath, mp4Path, thumbnailPath, title, slug)' };
  }
  return pushTemplate(data);
}

export async function handleCreatorGenerateThumbnail(
  _event: IpcMainInvokeEvent,
  data: CreatorGenerateThumbnailRequest
): Promise<CreatorGenerateThumbnailResponse> {
  if (app.isPackaged) {
    return { success: false, error: 'Thumbnail generation is only available in dev mode' };
  }
  if (!data?.mp4Path || !data.tsxFilePath) {
    return { success: false, error: 'Missing mp4Path or tsxFilePath' };
  }
  const ffmpeg = await detectSystemFfmpeg();
  if (!ffmpeg) {
    return {
      success: false,
      error: "ffmpeg not found on PATH. Install ffmpeg and ensure it's on PATH.",
    };
  }
  try {
    const outputPath = getThumbnailPath(data.tsxFilePath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const { path: thumbnailPath, sizeBytes } = await generateAnimatedWebp(data.mp4Path, outputPath);
    return { success: true, thumbnailPath, sizeBytes };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleCreatorLoadPushDraft(
  _event: IpcMainInvokeEvent,
  data: CreatorLoadDraftRequest
): Promise<CreatorLoadDraftResponse> {
  if (!data?.tsxFilePath) {
    return { draft: null, thumbnailPath: null, thumbnailSize: null };
  }
  // Lazy migration: if a legacy sidecar exists for this TSX, pull it into SQLite
  // (and move its thumbnail to the centralized store) before reading.
  await importLegacyDraftForTsx(data.tsxFilePath);
  const draft = await readDraft(data.tsxFilePath);
  const thumbPath = getThumbnailPath(data.tsxFilePath);
  let thumbnailPath: string | null = null;
  let thumbnailSize: number | null = null;
  try {
    const stat = await fs.stat(thumbPath);
    thumbnailPath = thumbPath;
    thumbnailSize = stat.size;
  } catch {
    // thumbnail hasn't been generated yet
  }
  return { draft, thumbnailPath, thumbnailSize };
}

export async function handleCreatorSavePushDraft(
  _event: IpcMainInvokeEvent,
  data: CreatorSaveDraftRequest
): Promise<CreatorSaveDraftResponse> {
  if (app.isPackaged) {
    return { success: false, error: 'Draft save is only available in dev mode' };
  }
  if (!data?.tsxFilePath || !data.draft) {
    return { success: false, error: 'Missing tsxFilePath or draft' };
  }
  try {
    await writeDraft(data.tsxFilePath, data.draft);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function handleCreatorArchiveTsx(
  _event: IpcMainInvokeEvent,
  data: CreatorArchiveTsxRequest
): Promise<CreatorArchiveTsxResponse> {
  if (!data?.tsxFilePath || !data.prompt) {
    return { success: false, error: 'Missing tsxFilePath or prompt' };
  }
  return archiveTsx(data);
}

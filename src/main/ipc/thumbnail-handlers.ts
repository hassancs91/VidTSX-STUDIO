import type { IpcMainInvokeEvent } from 'electron';
import fs from 'fs/promises';
import { getThumbnailPath } from '../services/thumbnail-generator';
import type {
  ThumbnailReadRequest,
  ThumbnailReadResponse,
} from '../../shared/ipc/types';

export async function handleThumbnailRead(
  _event: IpcMainInvokeEvent,
  data: ThumbnailReadRequest
): Promise<ThumbnailReadResponse> {
  try {
    const thumbPath = getThumbnailPath(data.tsxFilePath);
    await fs.access(thumbPath);
    const buffer = await fs.readFile(thumbPath);
    return {
      data: buffer.toString('base64'),
      exists: true,
    };
  } catch {
    return { data: '', exists: false };
  }
}

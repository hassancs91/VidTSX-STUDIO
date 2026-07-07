import { clipboard, nativeImage, dialog, BrowserWindow } from 'electron';
import { copyFile } from 'fs/promises';
import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';
import type {
  ImageStudioSaveRequest,
  ImageStudioSaveResponse,
  ImageStudioListResponse,
  ImageStudioDeleteRequest,
  ImageStudioDeleteResponse,
  ImageStudioSaveAsRequest,
  ImageStudioSaveAsResponse,
  ImageStudioCopyRequest,
  ImageStudioCopyResponse,
  ImageStudioReadRequest,
  ImageStudioReadResponse,
} from '../../shared/ipc/types';
import {
  saveImage,
  listImages,
  deleteImage,
  getImageBuffer,
} from '../services/image-studio-db';
import { validateSaveImageInput } from '../services/image-studio-validation';

export async function handleImageStudioSave(
  _event: IpcMainInvokeEvent,
  data: ImageStudioSaveRequest
): Promise<ImageStudioSaveResponse> {
  const validation = validateSaveImageInput(data);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const entry = await saveImage(data.base64, {
      prompt: data.prompt,
      model: data.model,
      width: data.width,
      height: data.height,
      contentType: data.contentType,
      durationMs: data.durationMs,
      folderId: data.folderId,
    });
    return { success: true, entry };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save image';
    return { success: false, error };
  }
}

export async function handleImageStudioList(): Promise<ImageStudioListResponse> {
  try {
    const { entries, folders, basePath } = await listImages();
    return { success: true, entries, folders, basePath };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to list images';
    return { success: false, entries: [], folders: [], basePath: '', error };
  }
}

export async function handleImageStudioDelete(
  _event: IpcMainInvokeEvent,
  data: ImageStudioDeleteRequest
): Promise<ImageStudioDeleteResponse> {
  try {
    await deleteImage(data.id);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete image';
    return { success: false, error };
  }
}

export async function handleImageStudioSaveAs(
  _event: IpcMainInvokeEvent,
  data: ImageStudioSaveAsRequest
): Promise<ImageStudioSaveAsResponse> {
  try {
    const { entries, basePath } = await listImages();
    const entry = entries.find((e) => e.id === data.id);
    if (!entry) {
      return { success: false, error: 'Image not found' };
    }

    const sourcePath = path.join(basePath, entry.fileName);
    const win = BrowserWindow.getFocusedWindow();
    if (!win) {
      return { success: false, error: 'No focused window' };
    }

    const ext = path.extname(entry.fileName).slice(1);
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Image',
      defaultPath: entry.fileName,
      filters: [{ name: `${ext.toUpperCase()} Image`, extensions: [ext] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Save cancelled' };
    }

    await copyFile(sourcePath, result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save image';
    return { success: false, error };
  }
}

export async function handleImageStudioCopy(
  _event: IpcMainInvokeEvent,
  data: ImageStudioCopyRequest
): Promise<ImageStudioCopyResponse> {
  try {
    const buffer = await getImageBuffer(data.id);
    if (!buffer) {
      return { success: false, error: 'Image not found' };
    }

    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) {
      return { success: false, error: 'Invalid image data' };
    }

    clipboard.writeImage(image);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to copy to clipboard';
    return { success: false, error };
  }
}

export async function handleImageStudioRead(
  _event: IpcMainInvokeEvent,
  data: ImageStudioReadRequest
): Promise<ImageStudioReadResponse> {
  try {
    const buffer = await getImageBuffer(data.id);
    if (!buffer) {
      return { success: false, error: 'Image not found' };
    }
    return { success: true, base64: buffer.toString('base64') };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to read image';
    return { success: false, error };
  }
}

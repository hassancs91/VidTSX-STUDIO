import { clipboard, nativeImage, dialog, BrowserWindow } from 'electron';
import { writeFile } from 'fs/promises';
import path from 'path';
import { loadHtmlInWindow, cleanupTempFile } from '../services/html-loader';
import type {
  ScreenshotCopyRequest,
  ScreenshotCopyResponse,
  ScreenshotSaveRequest,
  ScreenshotSaveResponse,
  ScreenshotSaveToPathRequest,
  ScreenshotSaveToPathResponse,
  ScreenshotCaptureHtmlRequest,
  ScreenshotCaptureHtmlResponse,
} from '../../shared/ipc/types';

export async function handleScreenshotCopy(
  _event: Electron.IpcMainInvokeEvent,
  data: ScreenshotCopyRequest
): Promise<ScreenshotCopyResponse> {
  try {
    const image = nativeImage.createFromDataURL(data.dataUrl);
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

export async function handleScreenshotSave(
  _event: Electron.IpcMainInvokeEvent,
  data: ScreenshotSaveRequest
): Promise<ScreenshotSaveResponse> {
  try {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) {
      return { success: false, error: 'No focused window' };
    }

    const defaultFileName = data.fileName || `screenshot-${Date.now()}.png`;

    const result = await dialog.showSaveDialog(window, {
      title: 'Save Screenshot',
      defaultPath: defaultFileName,
      filters: [
        { name: 'PNG Image', extensions: ['png'] },
        { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Save cancelled' };
    }

    const image = nativeImage.createFromDataURL(data.dataUrl);
    if (image.isEmpty()) {
      return { success: false, error: 'Invalid image data' };
    }

    const ext = path.extname(result.filePath).toLowerCase();
    let buffer: Buffer;

    if (ext === '.jpg' || ext === '.jpeg') {
      buffer = image.toJPEG(90);
    } else {
      buffer = image.toPNG();
    }

    await writeFile(result.filePath, buffer);

    return { success: true, filePath: result.filePath };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save screenshot';
    return { success: false, error };
  }
}

export async function handleScreenshotSaveToPath(
  _event: Electron.IpcMainInvokeEvent,
  data: ScreenshotSaveToPathRequest
): Promise<ScreenshotSaveToPathResponse> {
  try {
    const image = nativeImage.createFromDataURL(data.dataUrl);
    if (image.isEmpty()) {
      return { success: false, error: 'Invalid image data' };
    }

    const ext = path.extname(data.filePath).toLowerCase();
    let buffer: Buffer;

    if (ext === '.jpg' || ext === '.jpeg') {
      buffer = image.toJPEG(90);
    } else {
      buffer = image.toPNG();
    }

    await writeFile(data.filePath, buffer);

    return { success: true, filePath: data.filePath };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save screenshot';
    return { success: false, error };
  }
}

export async function handleScreenshotCaptureHtml(
  _event: Electron.IpcMainInvokeEvent,
  data: ScreenshotCaptureHtmlRequest
): Promise<ScreenshotCaptureHtmlResponse> {
  let win: BrowserWindow | null = null;
  let tempFile: string | null = null;

  try {
    win = new BrowserWindow({
      width: data.width,
      height: data.height,
      show: false,
      webPreferences: {
        offscreen: true,
      },
    });

    tempFile = await loadHtmlInWindow(win, data.html);

    const image = await win.webContents.capturePage();
    if (image.isEmpty()) {
      return { success: false, error: 'Captured empty image' };
    }

    const buffer = image.toPNG();
    await writeFile(data.filePath, buffer);

    return { success: true, filePath: data.filePath };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to capture HTML';
    return { success: false, error };
  } finally {
    if (win) {
      win.destroy();
    }
    if (tempFile) {
      await cleanupTempFile(tempFile);
    }
  }
}

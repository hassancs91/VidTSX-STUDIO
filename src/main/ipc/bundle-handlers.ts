import type { IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { bundleComposition, invalidateCache } from '../services/remotion-bundler';
import { IPC } from '../../shared/ipc/channels';
import type {
  BundleCreateRequest,
  BundleCreateResponse,
  BundleInvalidateRequest,
  BundleInvalidateResponse,
} from '../../shared/ipc/types';

export async function handleBundleCreate(
  event: IpcMainInvokeEvent,
  data: BundleCreateRequest
): Promise<BundleCreateResponse> {
  try {
    const result = await bundleComposition(data.filePath, (percent) => {
      // Send progress to renderer
      const webContents = event.sender;
      if (!webContents.isDestroyed()) {
        webContents.send(IPC.BUNDLE_PROGRESS, {
          filePath: data.filePath,
          percent,
        });
      }
    });

    if (result.success) {
      return {
        success: true,
        serveUrl: result.serveUrl,
        compositions: result.compositions,
        cached: result.cached,
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to create bundle';
    return { success: false, error };
  }
}

export async function handleBundleInvalidate(
  _event: IpcMainInvokeEvent,
  data: BundleInvalidateRequest
): Promise<BundleInvalidateResponse> {
  try {
    invalidateCache(data.filePath);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to invalidate cache';
    return { success: false, error };
  }
}

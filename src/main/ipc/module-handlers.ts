import { ipcMain } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import { IPC } from '@shared/ipc/channels';
import type {
  ModuleTranspileRequest,
  ModuleTranspileResponse,
  ModuleServerUrlResponse,
} from '@shared/ipc/types';
import { transpileTsxCached } from '../services/tsx-transpiler';
import {
  ensureModuleServer,
  getModuleServerBaseUrl,
  storeTranspileResult,
} from '../services/module-server';

/**
 * Handle module transpilation request
 */
async function handleModuleTranspile(
  _event: Electron.IpcMainInvokeEvent,
  request: ModuleTranspileRequest
): Promise<ModuleTranspileResponse> {
  try {
    // Ensure module server is running
    await ensureModuleServer();
    const baseUrl = getModuleServerBaseUrl();

    if (!baseUrl) {
      return {
        success: false,
        error: 'Module server failed to start',
      };
    }

    // Transpile the file
    const result = await transpileTsxCached(request.filePath, baseUrl);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        errorLocation: result.location,
      };
    }

    // Store the transpiled module and get its URL
    const moduleUrl = storeTranspileResult(result);

    return {
      success: true,
      moduleUrl,
      compositionConfig: {
        id: result.config.id,
        durationInFrames: result.config.durationInFrames,
        fps: result.config.fps,
        width: result.config.width,
        height: result.config.height,
      },
      componentName: result.componentName,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during transpilation',
    };
  }
}

/**
 * Handle request for module server URL
 */
async function handleModuleServerUrl(): Promise<ModuleServerUrlResponse> {
  // Ensure server is running
  await ensureModuleServer();
  // The preview-preload script is next to the main preload in out/preload/
  const previewPreloadPath = path.join(__dirname, '..', 'preload', 'preview-preload.js');
  return {
    url: getModuleServerBaseUrl(),
    previewPreloadPath: pathToFileURL(previewPreloadPath).href,
  };
}

/**
 * Register all module-related IPC handlers
 */
export function registerModuleHandlers(): void {
  ipcMain.handle(IPC.MODULE_TRANSPILE, handleModuleTranspile);
  ipcMain.handle(IPC.MODULE_SERVER_URL, handleModuleServerUrl);
}

import { app, shell } from 'electron';
import type { AppGetInfoResponse, AppOpenExternalRequest, AppOpenExternalResponse } from '../../shared/ipc/types';

export async function handleAppGetInfo(): Promise<AppGetInfoResponse> {
  return {
    version: app.getVersion(),
    name: app.getName(),
  };
}

export async function handleAppOpenExternal(
  _event: Electron.IpcMainInvokeEvent,
  data: AppOpenExternalRequest
): Promise<AppOpenExternalResponse> {
  try {
    await shell.openExternal(data.url);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open URL'
    };
  }
}

export const appHandlers = {
  handleAppGetInfo,
  handleAppOpenExternal,
};

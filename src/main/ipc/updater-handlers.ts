import type {
  UpdaterCancelResponse,
  UpdaterCheckRequest,
  UpdaterCheckResponse,
  UpdaterDownloadResponse,
  UpdaterGetStateResponse,
  UpdaterInstallResponse,
  UpdaterSetPrefsRequest,
  UpdaterSetPrefsResponse,
} from '../../shared/ipc/types';
import {
  cancelDownload,
  checkForUpdates,
  downloadUpdate,
  getUpdaterState,
  installUpdate,
  setPrefs,
} from '../services/updater/updater-service';

export async function handleUpdaterGetState(): Promise<UpdaterGetStateResponse> {
  return { state: getUpdaterState() };
}

export async function handleUpdaterCheck(
  _event: Electron.IpcMainInvokeEvent,
  data?: UpdaterCheckRequest
): Promise<UpdaterCheckResponse> {
  try {
    const state = await checkForUpdates(data?.trigger ?? 'manual');
    return { success: true, state };
  } catch (error) {
    return {
      success: false,
      state: getUpdaterState(),
      error: error instanceof Error ? error.message : 'Update check failed',
    };
  }
}

export async function handleUpdaterDownload(): Promise<UpdaterDownloadResponse> {
  try {
    return await downloadUpdate();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed',
    };
  }
}

export async function handleUpdaterCancel(): Promise<UpdaterCancelResponse> {
  try {
    return { success: cancelDownload() };
  } catch {
    return { success: false };
  }
}

export async function handleUpdaterInstall(): Promise<UpdaterInstallResponse> {
  try {
    return await installUpdate();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Install failed',
    };
  }
}

export async function handleUpdaterSetPrefs(
  _event: Electron.IpcMainInvokeEvent,
  data: UpdaterSetPrefsRequest
): Promise<UpdaterSetPrefsResponse> {
  try {
    const state = await setPrefs(data ?? {});
    return { success: true, state };
  } catch {
    return { success: false, state: getUpdaterState() };
  }
}

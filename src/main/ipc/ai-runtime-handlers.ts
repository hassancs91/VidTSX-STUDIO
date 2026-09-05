import { BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '@shared/ipc/channels';
import type {
  AiRuntimeInstallRequest,
  AiRuntimeInstallResponse,
  AiRuntimeRemoveRequest,
  AiRuntimeRemoveResponse,
  AiRuntimeRepairResponse,
  AiRuntimeStatusChangedEvent,
  AiRuntimeStatusResponse,
} from '@shared/ipc/types';
import {
  getAiRuntimeStatus,
  installAiRuntime,
  onAiRuntimeStatusChanged,
  removeAiRuntime,
  repairAiRuntime,
  scanInstalledRuntime,
} from '../services/ai-runtime';
import { PYTHON_MODEL_CATALOG, removePythonModel } from '../services/python-models';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('AiRuntimeIpc');

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export async function handleAiRuntimeStatus(_event: IpcMainInvokeEvent): Promise<AiRuntimeStatusResponse> {
  try {
    return { success: true, status: await getAiRuntimeStatus() };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to read the AI runtime status') };
  }
}

/**
 * Starts the install and returns once it is running; progress arrives through
 * DOWNLOAD_PROGRESS (metadata.type = 'ai-runtime') and AI_RUNTIME_STATUS_CHANGED.
 * A failure is reported on the status row (lastError), not thrown here.
 */
export async function handleAiRuntimeInstall(
  _event: IpcMainInvokeEvent,
  data: AiRuntimeInstallRequest = {},
): Promise<AiRuntimeInstallResponse> {
  try {
    void installAiRuntime({ variant: data.variant }).catch((err: unknown) => {
      log.warn('AI runtime install failed', { error: errorMessage(err, 'unknown') });
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to start the AI runtime install') };
  }
}

export async function handleAiRuntimeRepair(_event: IpcMainInvokeEvent): Promise<AiRuntimeRepairResponse> {
  try {
    const scan = await scanInstalledRuntime();
    const variant = scan.kind === 'installed' ? scan.info.variant : undefined;
    void repairAiRuntime(variant).catch((err: unknown) => {
      log.warn('AI runtime repair failed', { error: errorMessage(err, 'unknown') });
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to start the AI runtime repair') };
  }
}

/** Runtime only, or runtime + every downloaded runtime-backed model (weights and companions). */
export async function handleAiRuntimeRemove(
  _event: IpcMainInvokeEvent,
  data: AiRuntimeRemoveRequest = {},
): Promise<AiRuntimeRemoveResponse> {
  try {
    await removeAiRuntime();
    if (data.includeModels) {
      for (const profile of PYTHON_MODEL_CATALOG) {
        await removePythonModel(profile.id);
      }
      log.info('Runtime-backed models removed with the runtime', { models: PYTHON_MODEL_CATALOG.length });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to remove the AI runtime') };
  }
}

/** Push a fresh status snapshot to every window whenever the service reports a change. */
export function initAiRuntimeStatusBroadcast(): void {
  onAiRuntimeStatusChanged(() => {
    void getAiRuntimeStatus()
      .then((status: AiRuntimeStatusChangedEvent) => {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) win.webContents.send(IPC.AI_RUNTIME_STATUS_CHANGED, status);
        }
      })
      .catch((err: unknown) => log.warn('status broadcast failed', { error: errorMessage(err, 'unknown') }));
  });
}

import type { IpcMainInvokeEvent } from 'electron';
import type {
  PythonModelCancelDownloadRequest,
  PythonModelCancelDownloadResponse,
  PythonModelDownloadRequest,
  PythonModelDownloadResponse,
  PythonModelInstallRequest,
  PythonModelInstallResponse,
  PythonModelPreflightRequest,
  PythonModelPreflightResponse,
  PythonModelRemoveRequest,
  PythonModelRemoveResponse,
  PythonModelStatusRequest,
  PythonModelStatusResponse,
} from '@shared/ipc/types';
import {
  cancelPythonModelDownload,
  downloadPythonModel,
  ensurePythonModelReady,
  getPythonModelStatus,
  listPythonModelStatuses,
  preflightPythonModel,
  removePythonModel,
} from '../services/python-models';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Catalogue status for the AI page ("Image tools" section, 3D tab). Progress of a
 * download reaches the renderer through DOWNLOAD_PROGRESS (metadata.type = 'python-model').
 */
export async function handlePythonModelStatus(
  _event: IpcMainInvokeEvent,
  req: PythonModelStatusRequest = {},
): Promise<PythonModelStatusResponse> {
  try {
    const models = req.modelId ? [await getPythonModelStatus(req.modelId)] : await listPythonModelStatuses(req.category);
    return { success: true, models };
  } catch (err) {
    return { success: false, models: [], error: errorMessage(err, 'Failed to read the model status') };
  }
}

/** Resolves when every file is on disk (or rejects). The UI follows DOWNLOAD_PROGRESS meanwhile. */
export async function handlePythonModelDownload(
  _event: IpcMainInvokeEvent,
  req: PythonModelDownloadRequest,
): Promise<PythonModelDownloadResponse> {
  try {
    await downloadPythonModel(req.modelId);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Download failed') };
  }
}

export async function handlePythonModelCancelDownload(
  _event: IpcMainInvokeEvent,
  req: PythonModelCancelDownloadRequest,
): Promise<PythonModelCancelDownloadResponse> {
  return { success: cancelPythonModelDownload(req.modelId) };
}

export async function handlePythonModelRemove(
  _event: IpcMainInvokeEvent,
  req: PythonModelRemoveRequest,
): Promise<PythonModelRemoveResponse> {
  try {
    await removePythonModel(req.modelId);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Remove failed') };
  }
}

export async function handlePythonModelPreflight(
  _event: IpcMainInvokeEvent,
  req: PythonModelPreflightRequest,
): Promise<PythonModelPreflightResponse> {
  try {
    return { success: true, preflight: await preflightPythonModel(req.modelId) };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Preflight failed') };
  }
}

/**
 * Runtime install / update / repair (progress on the AI Runtime row + DOWNLOAD_PROGRESS
 * type 'ai-runtime') followed by the model download (type 'python-model'). Resolves when
 * the model is ready to run.
 */
export async function handlePythonModelInstall(
  _event: IpcMainInvokeEvent,
  req: PythonModelInstallRequest,
): Promise<PythonModelInstallResponse> {
  try {
    await ensurePythonModelReady(req.modelId, { variant: req.variant });
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Install failed') };
  }
}

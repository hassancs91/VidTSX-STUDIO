import type { IpcMainInvokeEvent } from 'electron';
import type {
  RefImageSaveRequest,
  RefImageSaveResponse,
  RefImageListResponse,
  RefImageDeleteRequest,
  RefImageDeleteResponse,
  RefImageToggleRequest,
  RefImageToggleResponse,
  RefImageReadRequest,
  RefImageReadResponse,
} from '../../shared/ipc/types';
import {
  saveReference,
  listReferences,
  deleteReference,
  toggleReference,
  readReferenceBuffer,
} from '../services/reference-image-files';

export async function handleRefImageSave(
  _event: IpcMainInvokeEvent,
  data: RefImageSaveRequest,
): Promise<RefImageSaveResponse> {
  try {
    const entry = await saveReference(data.base64, data.originalName, data.contentType);
    return { success: true, entry };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save reference image';
    return { success: false, error: message };
  }
}

export async function handleRefImageList(
  _event: IpcMainInvokeEvent,
): Promise<RefImageListResponse> {
  try {
    const entries = await listReferences();
    return { success: true, entries };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list reference images';
    return { success: false, entries: [], error: message };
  }
}

export async function handleRefImageDelete(
  _event: IpcMainInvokeEvent,
  data: RefImageDeleteRequest,
): Promise<RefImageDeleteResponse> {
  try {
    await deleteReference(data.id);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete reference image';
    return { success: false, error: message };
  }
}

export async function handleRefImageToggle(
  _event: IpcMainInvokeEvent,
  data: RefImageToggleRequest,
): Promise<RefImageToggleResponse> {
  try {
    await toggleReference(data.id, data.enabled);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to toggle reference image';
    return { success: false, error: message };
  }
}

export async function handleRefImageRead(
  _event: IpcMainInvokeEvent,
  data: RefImageReadRequest,
): Promise<RefImageReadResponse> {
  try {
    const buffer = await readReferenceBuffer(data.id);
    return { success: true, base64: buffer.toString('base64') };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read reference image';
    return { success: false, error: message };
  }
}

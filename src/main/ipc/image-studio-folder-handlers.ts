import type { IpcMainInvokeEvent } from 'electron';
import type {
  ImageStudioFolderCreateRequest,
  ImageStudioFolderCreateResponse,
  ImageStudioFolderRenameRequest,
  ImageStudioFolderRenameResponse,
  ImageStudioFolderDeleteRequest,
  ImageStudioFolderDeleteResponse,
  ImageStudioMoveToFolderRequest,
  ImageStudioMoveToFolderResponse,
} from '../../shared/ipc/types';
import {
  createFolder,
  renameFolder,
  deleteFolder,
  moveToFolder,
} from '../services/image-studio-db';
import { validateFolderName } from '../services/image-studio-validation';

export async function handleImageStudioFolderCreate(
  _event: IpcMainInvokeEvent,
  data: ImageStudioFolderCreateRequest
): Promise<ImageStudioFolderCreateResponse> {
  const nameCheck = validateFolderName(data.name);
  if (!nameCheck.valid) {
    return { success: false, error: nameCheck.error };
  }

  try {
    const folder = await createFolder(nameCheck.data);
    return { success: true, folder };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to create folder';
    return { success: false, error };
  }
}

export async function handleImageStudioFolderRename(
  _event: IpcMainInvokeEvent,
  data: ImageStudioFolderRenameRequest
): Promise<ImageStudioFolderRenameResponse> {
  const nameCheck = validateFolderName(data.name);
  if (!nameCheck.valid) {
    return { success: false, error: nameCheck.error };
  }

  try {
    await renameFolder(data.id, nameCheck.data);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to rename folder';
    return { success: false, error };
  }
}

export async function handleImageStudioFolderDelete(
  _event: IpcMainInvokeEvent,
  data: ImageStudioFolderDeleteRequest
): Promise<ImageStudioFolderDeleteResponse> {
  try {
    await deleteFolder(data.id, data.deleteImages);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete folder';
    return { success: false, error };
  }
}

export async function handleImageStudioMoveToFolder(
  _event: IpcMainInvokeEvent,
  data: ImageStudioMoveToFolderRequest
): Promise<ImageStudioMoveToFolderResponse> {
  try {
    await moveToFolder(data.imageIds, data.folderId);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to move images';
    return { success: false, error };
  }
}

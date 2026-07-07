import type { IpcMainInvokeEvent } from 'electron';
import type {
  VideoStudioFolderCreateRequest,
  VideoStudioFolderCreateResponse,
  VideoStudioFolderRenameRequest,
  VideoStudioFolderRenameResponse,
  VideoStudioFolderDeleteRequest,
  VideoStudioFolderDeleteResponse,
  VideoStudioMoveToFolderRequest,
  VideoStudioMoveToFolderResponse,
} from '../../shared/ipc/types';
import {
  createFolder,
  renameFolder,
  deleteFolder,
  moveToFolder,
} from '../services/video-studio-db';

const MAX_FOLDER_NAME_LENGTH = 100;
const UNSAFE_FOLDER_CHARS = /[/\\:\0]/;

interface NameOk { valid: true; data: string }
interface NameErr { valid: false; error: string }

function validateFolderName(name: unknown): NameOk | NameErr {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Folder name must be a string' };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Folder name cannot be empty' };
  }
  if (trimmed.length > MAX_FOLDER_NAME_LENGTH) {
    return {
      valid: false,
      error: `Folder name exceeds maximum length (${MAX_FOLDER_NAME_LENGTH} characters)`,
    };
  }
  if (UNSAFE_FOLDER_CHARS.test(trimmed)) {
    return { valid: false, error: 'Folder name contains invalid characters' };
  }
  return { valid: true, data: trimmed };
}

export async function handleVideoStudioFolderCreate(
  _event: IpcMainInvokeEvent,
  data: VideoStudioFolderCreateRequest,
): Promise<VideoStudioFolderCreateResponse> {
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

export async function handleVideoStudioFolderRename(
  _event: IpcMainInvokeEvent,
  data: VideoStudioFolderRenameRequest,
): Promise<VideoStudioFolderRenameResponse> {
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

export async function handleVideoStudioFolderDelete(
  _event: IpcMainInvokeEvent,
  data: VideoStudioFolderDeleteRequest,
): Promise<VideoStudioFolderDeleteResponse> {
  try {
    await deleteFolder(data.id, data.deleteVideos);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete folder';
    return { success: false, error };
  }
}

export async function handleVideoStudioMoveToFolder(
  _event: IpcMainInvokeEvent,
  data: VideoStudioMoveToFolderRequest,
): Promise<VideoStudioMoveToFolderResponse> {
  try {
    await moveToFolder(data.videoIds, data.folderId);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to move videos';
    return { success: false, error };
  }
}

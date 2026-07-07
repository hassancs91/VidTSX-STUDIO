import type { IpcMainInvokeEvent } from 'electron';
import path from 'path';
import { randomBytes } from 'crypto';
import type { UserImageAsset } from '../../shared/types/whiteboard';
import type {
  WhiteboardProjectListResponse,
  WhiteboardProjectSaveRequest,
  WhiteboardProjectSaveResponse,
  WhiteboardProjectLoadRequest,
  WhiteboardProjectLoadResponse,
  WhiteboardProjectDeleteRequest,
  WhiteboardProjectDeleteResponse,
  WhiteboardUserSvgListResponse,
  WhiteboardUserSvgSaveRequest,
  WhiteboardUserSvgSaveResponse,
  WhiteboardUserSvgDeleteRequest,
  WhiteboardUserSvgDeleteResponse,
  WhiteboardUserImageListResponse,
  WhiteboardUserImageUploadRequest,
  WhiteboardUserImageUploadResponse,
  WhiteboardUserImageDeleteRequest,
  WhiteboardUserImageDeleteResponse,
} from '../../shared/ipc/types';
import {
  listProjects,
  saveProject,
  loadProject,
  deleteProject,
} from '../services/whiteboard-projects-db';
import {
  listUserSvgs,
  saveUserSvg,
  deleteUserSvg,
} from '../services/whiteboard-svgs-db';
import {
  listUserImages,
  saveUserImage,
  deleteUserImage,
  saveBinary,
} from '../services/whiteboard-images-db';
import type { UserImageRecord } from '../services/whiteboard-images-db';

export async function handleWhiteboardProjectList(
  _event: IpcMainInvokeEvent
): Promise<WhiteboardProjectListResponse> {
  try {
    const projects = await listProjects();
    return { success: true, projects };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to list projects';
    return { success: false, error };
  }
}

export async function handleWhiteboardProjectSave(
  _event: IpcMainInvokeEvent,
  data: WhiteboardProjectSaveRequest
): Promise<WhiteboardProjectSaveResponse> {
  try {
    await saveProject(data.project);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save project';
    return { success: false, error };
  }
}

export async function handleWhiteboardProjectLoad(
  _event: IpcMainInvokeEvent,
  data: WhiteboardProjectLoadRequest
): Promise<WhiteboardProjectLoadResponse> {
  try {
    const project = await loadProject(data.id);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }
    return { success: true, project };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to load project';
    return { success: false, error };
  }
}

export async function handleWhiteboardProjectDelete(
  _event: IpcMainInvokeEvent,
  data: WhiteboardProjectDeleteRequest
): Promise<WhiteboardProjectDeleteResponse> {
  try {
    await deleteProject(data.id);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete project';
    return { success: false, error };
  }
}

export async function handleWhiteboardUserSvgList(
  _event: IpcMainInvokeEvent
): Promise<WhiteboardUserSvgListResponse> {
  try {
    const svgs = await listUserSvgs();
    return { success: true, svgs };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to list user SVGs';
    return { success: false, error };
  }
}

export async function handleWhiteboardUserSvgSave(
  _event: IpcMainInvokeEvent,
  data: WhiteboardUserSvgSaveRequest
): Promise<WhiteboardUserSvgSaveResponse> {
  try {
    await saveUserSvg(data.asset);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save user SVG';
    return { success: false, error };
  }
}

export async function handleWhiteboardUserSvgDelete(
  _event: IpcMainInvokeEvent,
  data: WhiteboardUserSvgDeleteRequest
): Promise<WhiteboardUserSvgDeleteResponse> {
  try {
    await deleteUserSvg(data.id);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete user SVG';
    return { success: false, error };
  }
}

function recordToAsset(rec: UserImageRecord): UserImageAsset {
  return {
    id: rec.id,
    name: rec.name,
    src: `vidtsx-image://${rec.id}`,
    width: rec.width,
    height: rec.height,
    source: rec.source,
    createdAt: rec.createdAt,
  };
}

function generateImageId(): string {
  // 16 hex chars — 64-bit randomness, plenty for a per-user library and
  // satisfies the SAFE_ID regex in whiteboard-images-db.
  return randomBytes(8).toString('hex');
}

export async function handleWhiteboardUserImageList(
  _event: IpcMainInvokeEvent
): Promise<WhiteboardUserImageListResponse> {
  try {
    const records = await listUserImages();
    return { success: true, images: records.map(recordToAsset) };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to list user images';
    return { success: false, error };
  }
}

export async function handleWhiteboardUserImageUpload(
  _event: IpcMainInvokeEvent,
  data: WhiteboardUserImageUploadRequest
): Promise<WhiteboardUserImageUploadResponse> {
  try {
    if (!data.base64 || data.width <= 0 || data.height <= 0) {
      throw new Error('Invalid image upload payload');
    }
    const ext = (path.extname(data.filename || '').replace(/^\./, '') || 'png').toLowerCase();
    const id = generateImageId();
    const buffer = Buffer.from(data.base64, 'base64');
    const filePath = saveBinary(id, ext, buffer);
    const stem = (path.basename(data.filename || '', path.extname(data.filename || '')) || 'Untitled').trim();
    const record: UserImageRecord = {
      id,
      name: stem || 'Untitled image',
      filePath,
      width: data.width,
      height: data.height,
      source: 'upload',
      createdAt: Date.now(),
    };
    await saveUserImage(record);
    return { success: true, image: recordToAsset(record) };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to upload image';
    return { success: false, error };
  }
}

export async function handleWhiteboardUserImageDelete(
  _event: IpcMainInvokeEvent,
  data: WhiteboardUserImageDeleteRequest
): Promise<WhiteboardUserImageDeleteResponse> {
  try {
    await deleteUserImage(data.id);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete user image';
    return { success: false, error };
  }
}

import fs from 'fs/promises';
import path from 'path';
import { dialog, type IpcMainInvokeEvent } from 'electron';
import type {
  StudioCacheReadRequest,
  StudioCacheReadResponse,
  StudioMediaImportRequest,
  StudioMediaImportResponse,
  StudioProjectCreateRequest,
  StudioProjectCreateResponse,
  StudioProjectDeleteRequest,
  StudioProjectDeleteResponse,
  StudioProjectListResponse,
  StudioProjectLoadRequest,
  StudioProjectLoadResponse,
  StudioProjectSaveRequest,
  StudioProjectSaveResponse,
  StudioRootGetResponse,
  StudioRootSetRequest,
  StudioRootSetResponse,
} from '../../shared/ipc/types';
import { getStudioProjectsRoot, setStudioProjectsRoot } from '../services/settings';
import {
  createProject,
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
} from '../services/studio/project-store';
import { importMediaFiles, MEDIA_DIALOG_FILTERS } from '../services/studio/media-import';
import { safeResolveCachePath } from '../services/studio/studio-paths';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export async function handleStudioRootGet(): Promise<StudioRootGetResponse> {
  return { root: await getStudioProjectsRoot() };
}

export async function handleStudioRootSet(
  _event: IpcMainInvokeEvent,
  data: StudioRootSetRequest,
): Promise<StudioRootSetResponse> {
  try {
    if (!data.root) return { success: false, error: 'Folder path is required' };
    await setStudioProjectsRoot(data.root);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to set projects folder') };
  }
}

export async function handleStudioProjectList(): Promise<StudioProjectListResponse> {
  try {
    const [projects, root] = await Promise.all([listProjects(), getStudioProjectsRoot()]);
    return { success: true, projects, root };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to list projects') };
  }
}

export async function handleStudioProjectCreate(
  _event: IpcMainInvokeEvent,
  data: StudioProjectCreateRequest,
): Promise<StudioProjectCreateResponse> {
  try {
    if (!data.name?.trim()) return { success: false, error: 'Project name is required' };
    if (!(data.width > 0) || !(data.height > 0) || !(data.fps > 0)) {
      return { success: false, error: 'Invalid project dimensions or fps' };
    }
    const project = await createProject(data.name, data.width, data.height, data.fps);
    return { success: true, project };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to create project') };
  }
}

export async function handleStudioProjectLoad(
  _event: IpcMainInvokeEvent,
  data: StudioProjectLoadRequest,
): Promise<StudioProjectLoadResponse> {
  try {
    const project = await loadProject(data.id);
    return { success: true, project };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to load project') };
  }
}

export async function handleStudioProjectSave(
  _event: IpcMainInvokeEvent,
  data: StudioProjectSaveRequest,
): Promise<StudioProjectSaveResponse> {
  try {
    const updatedAt = await saveProject(data.project);
    return { success: true, updatedAt };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to save project') };
  }
}

export async function handleStudioProjectDelete(
  _event: IpcMainInvokeEvent,
  data: StudioProjectDeleteRequest,
): Promise<StudioProjectDeleteResponse> {
  try {
    await deleteProject(data.id);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to delete project') };
  }
}

export async function handleStudioMediaImport(
  _event: IpcMainInvokeEvent,
  data: StudioMediaImportRequest,
): Promise<StudioMediaImportResponse> {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Import Media',
      properties: ['openFile', 'multiSelections'],
      filters: MEDIA_DIALOG_FILTERS,
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, canceled: true };
    }
    const { assets, errors } = await importMediaFiles(data.projectId, result.filePaths);
    return { success: true, assets, errors: errors.length > 0 ? errors : undefined };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to import media') };
  }
}

const CACHE_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function handleStudioCacheRead(
  _event: IpcMainInvokeEvent,
  data: StudioCacheReadRequest,
): Promise<StudioCacheReadResponse> {
  try {
    const filePath = await safeResolveCachePath(data.projectId, data.relPath);
    const buffer = await fs.readFile(filePath);
    const mime = CACHE_MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    return { success: true, data: buffer.toString('base64'), mime };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to read cache file') };
  }
}

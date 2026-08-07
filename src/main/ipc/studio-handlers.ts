import fs from 'fs/promises';
import path from 'path';
import { dialog, type IpcMainInvokeEvent } from 'electron';
import type {
  StudioCacheReadRequest,
  StudioCacheReadResponse,
  StudioExportPrepareRequest,
  StudioExportPrepareResponse,
  StudioMediaImportRequest,
  StudioMediaImportResponse,
  StudioMediaJobEvent,
  StudioMediaPrepareRequest,
  StudioMediaPrepareResponse,
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
import { getProjectDir, safeResolveCachePath } from '../services/studio/studio-paths';
import { studioMediaJobs } from '../services/studio/media-jobs';
import { createExportEntry } from '../services/studio/export-entry';
import { ensureAssetServerUrl } from '../services/remotion-bundler';
import { ensureModuleServer, getModuleServerBaseUrl } from '../services/module-server';
import { timelineDuration } from '../../shared/studio/time-math';

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
    const [project, folderPath] = await Promise.all([
      loadProject(data.id),
      getProjectDir(data.id),
    ]);
    return { success: true, project, folderPath };
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

/**
 * Ask for the derived caches the editor needs (720p proxies for smooth
 * scrubbing, waveforms for the audio lanes). Jobs that already have output on
 * disk come back immediately in `ready`; the rest arrive as job events.
 */
export async function handleStudioMediaPrepare(
  _event: IpcMainInvokeEvent,
  data: StudioMediaPrepareRequest,
): Promise<StudioMediaPrepareResponse> {
  try {
    await getProjectDir(data.projectId); // Validates the id before any fs work.
    await ensureModuleServer();
    const assetBaseUrl = getModuleServerBaseUrl();
    if (!assetBaseUrl) {
      return { success: false, error: 'Local asset server failed to start' };
    }

    const ready: StudioMediaJobEvent[] = [];
    for (const asset of data.assets) {
      if (asset.kind === 'image') continue;
      if (asset.kind === 'video') {
        const event = await studioMediaJobs.request(data.projectId, asset.id, 'proxy', asset.path);
        if (event) ready.push(event);
      }
      if (!asset.hasAudio) continue;
      const waveform = await studioMediaJobs.request(
        data.projectId,
        asset.id,
        'waveform',
        asset.path,
      );
      if (waveform) ready.push(waveform);
    }
    return { success: true, ready, assetBaseUrl };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to prepare media') };
  }
}

/** Generate the Remotion entry for an export; the renderer queues it. */
export async function handleStudioExportPrepare(
  _event: IpcMainInvokeEvent,
  data: StudioExportPrepareRequest,
): Promise<StudioExportPrepareResponse> {
  try {
    const project = data.project;
    if (!project?.timeline || timelineDuration(project.timeline) <= 0) {
      return { success: false, error: 'The timeline is empty — add a clip before exporting' };
    }
    const assetBaseUrl = await ensureAssetServerUrl();
    const entry = await createExportEntry(project, assetBaseUrl);
    return { success: true, ...entry };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to prepare export') };
  }
}

const CACHE_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
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

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
  StudioCutPlanRunRequest,
  StudioCutPlanRunResponse,
  StudioTranscribeCancelRequest,
  StudioTranscribeCancelResponse,
  StudioTranscribeStartRequest,
  StudioTranscribeStartResponse,
  StudioAgentCancelRequest,
  StudioAgentCancelResponse,
  StudioAgentSendRequest,
  StudioAgentSendResponse,
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
import { deleteTranscript } from '../services/studio/asset-transcriber';
import { runCutPlan } from '../services/studio/cut-plan-runner';
import { studioAgent } from '../services/studio/studio-agent';
import { buildAgentSystemPrompt } from '../services/studio/studio-agent-prompt';
import { findSttEntry } from '../../shared/presets/stt-models';
import { transcriptionEngine } from '../../transcription-engine';
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

/**
 * Start a per-asset transcription job. Always an explicit user action — never
 * wired to import — and always a fresh run (an existing transcript means the
 * user chose to re-transcribe, e.g. with a different engine).
 */
export async function handleStudioTranscribeStart(
  _event: IpcMainInvokeEvent,
  data: StudioTranscribeStartRequest,
): Promise<StudioTranscribeStartResponse> {
  try {
    await getProjectDir(data.projectId); // Validates the id before any fs work.
    const entry = findSttEntry(data.sttModelId);
    if (!entry) return { success: false, error: `Unknown transcription model "${data.sttModelId}"` };
    if (!entry.features.wordTimestamps && !entry.features.approximateWordTimestamps) {
      return { success: false, error: 'This model has no word timing — pick another one' };
    }
    if (!transcriptionEngine.getProvider(entry.provider)) {
      return {
        success: false,
        error:
          entry.provider === 'local-whisper'
            ? 'Local Whisper is not available'
            : `${entry.provider} is not configured — add its API key in Settings`,
      };
    }
    try {
      await fs.access(data.sourcePath);
    } catch {
      return { success: false, error: 'Source file not found on disk' };
    }
    await deleteTranscript(data.projectId, data.assetId);
    await studioMediaJobs.request(data.projectId, data.assetId, 'transcript', data.sourcePath, {
      sttModelId: data.sttModelId,
      force: true,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to start transcription') };
  }
}

export async function handleStudioTranscribeCancel(
  _event: IpcMainInvokeEvent,
  data: StudioTranscribeCancelRequest,
): Promise<StudioTranscribeCancelResponse> {
  return { success: studioMediaJobs.cancel(data.projectId, data.assetId, 'transcript') };
}

/** Run the mechanical auto-cut pass; returns the plan JSON, applies nothing. */
export async function handleStudioCutPlanRun(
  _event: IpcMainInvokeEvent,
  data: StudioCutPlanRunRequest,
): Promise<StudioCutPlanRunResponse> {
  try {
    const { plan, planPath } = await runCutPlan(
      data.projectId,
      data.assetId,
      data.sourcePath,
      data.style ?? 'tight',
    );
    return { success: true, plan, planPath };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to plan cuts') };
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

/** One editing-agent chat turn; deltas/tools/proposals stream as push events. */
export async function handleStudioAgentSend(
  _event: IpcMainInvokeEvent,
  data: StudioAgentSendRequest,
): Promise<StudioAgentSendResponse> {
  try {
    return await studioAgent.send(data, (toolsAvailable) =>
      buildAgentSystemPrompt({
        projectName: data.projectName,
        assets: data.assets,
        toolsAvailable,
        reviewOpen: data.reviewOpen,
      }),
    );
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Agent request failed') };
  }
}

export async function handleStudioAgentCancel(
  _event: IpcMainInvokeEvent,
  data: StudioAgentCancelRequest,
): Promise<StudioAgentCancelResponse> {
  return { success: studioAgent.cancel(data.projectId) };
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

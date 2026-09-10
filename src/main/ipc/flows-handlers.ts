import type { IpcMainInvokeEvent } from 'electron';
import type {
  FlowProjectListResponse,
  FlowProjectCreateRequest,
  FlowProjectCreateResponse,
  FlowProjectLoadRequest,
  FlowProjectLoadResponse,
  FlowProjectUpdateRequest,
  FlowProjectUpdateResponse,
  FlowProjectDeleteRequest,
  FlowProjectDeleteResponse,
  FlowRunPersistRequest,
  FlowRunPersistResponse,
  FlowRunListRequest,
  FlowRunListResponse,
  FlowRunLoadRequest,
  FlowRunLoadResponse,
} from '../../shared/ipc/types';
import {
  listFlows,
  loadFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  setGalleryFolderId,
} from '../services/flows-projects-db';
import { persistRun, listRuns, loadRun } from '../services/flows-runs-db';
import {
  createFolder as createGalleryFolder,
  renameFolder as renameGalleryFolder,
  getDb as getImageStudioDb,
} from '../services/image-studio-db';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('flows-handlers');

const FLOW_FOLDER_PREFIX = 'Flow: ';

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function folderExists(folderId: string): boolean {
  try {
    const row = getImageStudioDb()
      .prepare('SELECT 1 FROM folders WHERE id = ?')
      .get(folderId);
    return Boolean(row);
  } catch {
    return false;
  }
}

/**
 * Ensure the flow has a backing Image Studio folder named `Flow: <flowName>`.
 * Creates one if missing or stale (deleted by user from Image Studio).
 * Returns the folder id, or null if creation failed (best-effort — runs continue).
 */
async function ensureFlowGalleryFolder(
  flowId: string,
  flowName: string,
  existingFolderId: string | null,
): Promise<string | null> {
  if (existingFolderId && folderExists(existingFolderId)) {
    return existingFolderId;
  }
  try {
    const folder = await createGalleryFolder(`${FLOW_FOLDER_PREFIX}${flowName}`);
    setGalleryFolderId(flowId, folder.id);
    return folder.id;
  } catch (err) {
    log.warn('Failed to create flow gallery folder', {
      flowId,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function handleFlowsProjectList(
  _event: IpcMainInvokeEvent
): Promise<FlowProjectListResponse> {
  try {
    return { success: true, projects: listFlows() };
  } catch (err) {
    return { success: false, error: errMessage(err, 'Failed to list flow projects') };
  }
}

export async function handleFlowsProjectCreate(
  _event: IpcMainInvokeEvent,
  data: FlowProjectCreateRequest
): Promise<FlowProjectCreateResponse> {
  try {
    if (!data.name?.trim()) {
      return { success: false, error: 'Name is required' };
    }
    const project = createFlow({
      name: data.name.trim(),
      description: data.description,
      graphJson: data.graphJson,
      source: data.source,
      origin: data.origin,
    });
    const folderId = await ensureFlowGalleryFolder(project.id, project.name, null);
    return { success: true, project: { ...project, galleryFolderId: folderId } };
  } catch (err) {
    return { success: false, error: errMessage(err, 'Failed to create flow project') };
  }
}

export async function handleFlowsProjectLoad(
  _event: IpcMainInvokeEvent,
  data: FlowProjectLoadRequest
): Promise<FlowProjectLoadResponse> {
  try {
    const project = loadFlow(data.id);
    if (!project) return { success: false, error: 'Flow not found' };
    const folderId = await ensureFlowGalleryFolder(
      project.id,
      project.name,
      project.galleryFolderId,
    );
    return { success: true, project: { ...project, galleryFolderId: folderId } };
  } catch (err) {
    return { success: false, error: errMessage(err, 'Failed to load flow project') };
  }
}

export async function handleFlowsProjectUpdate(
  _event: IpcMainInvokeEvent,
  data: FlowProjectUpdateRequest
): Promise<FlowProjectUpdateResponse> {
  try {
    const before = loadFlow(data.id);
    const project = updateFlow(data);
    if (!project) return { success: false, error: 'Flow not found' };

    // If the name changed and we have a backing folder, mirror the rename.
    if (
      before &&
      typeof data.name === 'string' &&
      data.name.trim() !== before.name &&
      project.galleryFolderId &&
      folderExists(project.galleryFolderId)
    ) {
      try {
        await renameGalleryFolder(
          project.galleryFolderId,
          `${FLOW_FOLDER_PREFIX}${project.name}`,
        );
      } catch (err) {
        log.warn('Failed to rename flow gallery folder', {
          flowId: project.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { success: true, project };
  } catch (err) {
    return { success: false, error: errMessage(err, 'Failed to update flow project') };
  }
}

export async function handleFlowsProjectDelete(
  _event: IpcMainInvokeEvent,
  data: FlowProjectDeleteRequest
): Promise<FlowProjectDeleteResponse> {
  try {
    // Intentionally does NOT delete the gallery folder — user may want to keep
    // the generated images. Per plan Risk #9.
    deleteFlow(data.id);
    return { success: true };
  } catch (err) {
    return { success: false, error: errMessage(err, 'Failed to delete flow project') };
  }
}

// ─── Flow runs ────────────────────────────────────────────────────────────────

export async function handleFlowsRunPersist(
  _event: IpcMainInvokeEvent,
  data: FlowRunPersistRequest,
): Promise<FlowRunPersistResponse> {
  try {
    if (!data.id || !data.flowId) {
      return { success: false, error: 'Missing run id or flow id' };
    }
    const run = persistRun({
      id: data.id,
      flowId: data.flowId,
      status: data.status,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
      error: data.error,
      nodeResults: data.nodeResults,
    });
    return { success: true, run };
  } catch (err) {
    return { success: false, error: errMessage(err, 'Failed to persist flow run') };
  }
}

export async function handleFlowsRunList(
  _event: IpcMainInvokeEvent,
  data: FlowRunListRequest,
): Promise<FlowRunListResponse> {
  try {
    return { success: true, runs: listRuns(data.flowId) };
  } catch (err) {
    return { success: false, error: errMessage(err, 'Failed to list flow runs') };
  }
}

export async function handleFlowsRunLoad(
  _event: IpcMainInvokeEvent,
  data: FlowRunLoadRequest,
): Promise<FlowRunLoadResponse> {
  try {
    const run = loadRun(data.id);
    if (!run) return { success: false, error: 'Run not found' };
    return { success: true, run };
  } catch (err) {
    return { success: false, error: errMessage(err, 'Failed to load flow run') };
  }
}

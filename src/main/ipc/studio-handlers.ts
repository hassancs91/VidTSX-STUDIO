import fs from 'fs/promises';
import path from 'path';
import { dialog, shell, type IpcMainInvokeEvent } from 'electron';
import type {
  StudioCacheClearRequest,
  StudioCacheClearResponse,
  StudioCacheInfoRequest,
  StudioCacheInfoResponse,
  StudioCacheOpenRequest,
  StudioCacheOpenResponse,
  StudioCacheReadRequest,
  StudioCacheReadResponse,
  StudioExportEnginesListResponse,
  StudioExportPrepareRequest,
  StudioExportPrepareResponse,
  StudioMediaImportRequest,
  StudioMediaImportResponse,
  StudioMediaJobEvent,
  StudioMediaPrepareRequest,
  StudioMediaPrepareResponse,
  StudioMediaRelinkRequest,
  StudioMediaRelinkResponse,
  StudioProjectCloseRequest,
  StudioProjectCloseResponse,
  StudioProjectCreateRequest,
  StudioProjectCreateResponse,
  StudioProjectDeleteRequest,
  StudioProjectDeleteResponse,
  StudioProjectListResponse,
  StudioProjectLoadRequest,
  StudioProjectLoadResponse,
  StudioProjectSaveRequest,
  StudioProjectSaveResponse,
  StudioSnapshotListRequest,
  StudioSnapshotListResponse,
  StudioSnapshotRestoreRequest,
  StudioSnapshotRestoreResponse,
  StudioRootGetResponse,
  StudioRootSetRequest,
  StudioRootSetResponse,
  StudioCutPlanRunRequest,
  StudioCutPlanRunResponse,
  StudioTranscribeCancelRequest,
  StudioTranscribeCancelResponse,
  StudioTranscribeStartRequest,
  StudioTranscribeStartResponse,
  StudioAgentActionResultRequest,
  StudioAgentActionResultResponse,
  StudioAgentCancelRequest,
  StudioAgentCancelResponse,
  StudioAgentChatLoadRequest,
  StudioAgentChatLoadResponse,
  StudioAgentChatResetRequest,
  StudioAgentChatResetResponse,
  StudioAgentChatSaveRequest,
  StudioAgentChatSaveResponse,
  StudioAgentSendRequest,
  StudioAgentSendResponse,
} from '../../shared/ipc/types';
import { getStudioProjectsRoot, setStudioProjectsRoot } from '../services/settings';
import { getDefaultBrandId } from '../services/library/brand-default';
import { readBrand } from '../services/library/brand-store';
import { readPreset } from '../services/library/preset-store';
import {
  createProject,
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
} from '../services/studio/project-store';
import {
  listSnapshots,
  readSnapshot,
  snapshotIfDue,
  snapshotOnOpen,
  writeSnapshot,
} from '../services/studio/snapshot-store';
import {
  classifyMediaKind,
  hashFileHead,
  importMediaFiles,
  MEDIA_DIALOG_FILTERS,
  probeMedia,
} from '../services/studio/media-import';
import { getProjectCacheDir, getProjectDir, safeResolveCachePath } from '../services/studio/studio-paths';
import { flushProjectPoster, scheduleProjectPoster } from '../services/studio/project-poster';
import { getLibraryRoot } from '../services/library/library-paths';
import { findLibraryFileByHash } from '../services/library/library-store';
import { clearCache, getCacheInfo } from '../services/studio/cache-manager';
import { studioMediaJobs } from '../services/studio/media-jobs';
import { deleteTranscript } from '../services/studio/asset-transcriber';
import { runCutPlan } from '../services/studio/cut-plan-runner';
import { studioAgent } from '../services/studio/studio-agent';
import { agentActions } from '../services/studio/agent-actions';
import { buildAgentSystemPrompt } from '../services/studio/studio-agent-prompt';
import { loadAgentChat, resetAgentChat, saveAgentChat } from '../services/studio/agent-chat-store';
import { findSttEntry } from '../../shared/presets/stt-models';
import { transcriptionEngine } from '../../transcription-engine';
import { createExportEntry } from '../services/studio/export-entry';
import { isExportVerifyAvailable, listExportEngineStatus } from '../services/studio/export-engines';
import { getRenderDefaultExportEngine } from '../services/settings';
import { ensureAssetServerUrl } from '../services/remotion-bundler';
import { ensureModuleServer, getModuleServerBaseUrl } from '../services/module-server';
import { timelineDuration } from '../../shared/studio/time-math';
import { rangeDurationInFrames, trimTimelineToRange } from '../../shared/studio/trim-range';

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
    // W5: the editing preset, validated against the library. Its
    // defaultBrandId (when that brand exists) wins over the library default —
    // the preset is the more specific choice. It only sets the project's
    // brandId; the brand itself (vocabulary included) is never touched.
    const libraryRoot = getLibraryRoot();
    const preset = data.presetId ? await readPreset(libraryRoot, data.presetId) : null;
    const presetId = preset ? preset.id : undefined;
    // D11: snapshot the Studio default brand into the new project — validated
    // against the library so a stale default (deleted brand) copies nothing.
    const wantedBrandId = preset?.defaultBrandId || getDefaultBrandId();
    const brandId =
      wantedBrandId && (await readBrand(libraryRoot, wantedBrandId)) ? wantedBrandId : undefined;
    const project = await createProject(data.name, data.width, data.height, data.fps, brandId, presetId);
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
    // Q10 pre-edit safety copy — never fails the open (logged internally).
    await snapshotOnOpen(project);
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
    // Q10: every ~10 minutes of active editing becomes a snapshot. Saves only
    // happen while editing, so hooking the save handler needs no idle timer.
    await snapshotIfDue({ ...data.project, updatedAt });
    // W6: the poster follows the document, once the edits settle.
    scheduleProjectPoster({ ...data.project, updatedAt });
    return { success: true, updatedAt };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to save project') };
  }
}

/** W6: the editor closed the project — write the poster now (the close may
 *  carry no dirty save at all, so the debounce alone would miss it). */
export async function handleStudioProjectClose(
  _event: IpcMainInvokeEvent,
  data: StudioProjectCloseRequest,
): Promise<StudioProjectCloseResponse> {
  try {
    await flushProjectPoster(data.id);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to close project') };
  }
}

export async function handleStudioProjectSnapshotList(
  _event: IpcMainInvokeEvent,
  data: StudioSnapshotListRequest,
): Promise<StudioSnapshotListResponse> {
  try {
    return { success: true, snapshots: await listSnapshots(data.id) };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to list snapshots') };
  }
}

export async function handleStudioProjectSnapshotRestore(
  _event: IpcMainInvokeEvent,
  data: StudioSnapshotRestoreRequest,
): Promise<StudioSnapshotRestoreResponse> {
  try {
    const restored = await readSnapshot(data.id, data.file);
    // Snapshot the current state FIRST — restore must itself be restorable,
    // never destructive (Q10). An unreadable current document is the one case
    // where restoring proceeds without the safety copy: it IS the repair.
    let undoFile: string | undefined;
    try {
      undoFile = await writeSnapshot(await loadProject(data.id));
    } catch {
      // fall through — nothing usable to preserve
    }
    const updatedAt = await saveProject(restored);
    return {
      success: true,
      project: { ...restored, updatedAt },
      ...(undoFile ? { undoFile } : {}),
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to restore snapshot') };
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
    const missing: string[] = [];
    const healed: Array<{ assetId: string; path: string }> = [];
    for (const asset of data.assets) {
      // A moved/renamed source can't feed ffmpeg. Before flagging it for the
      // relink UI (Slice F), search the asset library by content hash — a
      // file reorganized in the library heals silently (L7 move-safety rule);
      // the manual picker stays as the fallback.
      let sourcePath = asset.path;
      try {
        await fs.access(sourcePath);
      } catch {
        const found = asset.hash ? await findLibraryFileByHash(getLibraryRoot(), asset.hash) : null;
        if (found && classifyMediaKind(found) === asset.kind) {
          healed.push({ assetId: asset.id, path: found });
          sourcePath = found;
        } else {
          missing.push(asset.id);
          continue;
        }
      }
      if (asset.kind === 'image') continue;
      if (asset.kind === 'video') {
        const event = await studioMediaJobs.request(data.projectId, asset.id, 'proxy', sourcePath);
        if (event) ready.push(event);
      }
      if (!asset.hasAudio) continue;
      const waveform = await studioMediaJobs.request(
        data.projectId,
        asset.id,
        'waveform',
        sourcePath,
      );
      if (waveform) ready.push(waveform);
    }
    return {
      success: true,
      ready,
      assetBaseUrl,
      ...(missing.length > 0 ? { missing } : {}),
      ...(healed.length > 0 ? { healed } : {}),
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to prepare media') };
  }
}

/**
 * Reconnect a missing source file (Slice F). Opens the native file dialog
 * unless the renderer passes `filePath` (the mismatch-confirm retry). The
 * picked file's content hash is checked against the stored one — a mismatch
 * comes back to the renderer, which confirms with the user and retries with
 * `allowMismatch`. On success the file is re-probed and the renderer merges
 * path/probe/hash into the document; every derived cache is keyed by asset
 * id, so proxies/waveforms/transcripts survive the relink untouched.
 */
export async function handleStudioMediaRelink(
  _event: IpcMainInvokeEvent,
  data: StudioMediaRelinkRequest,
): Promise<StudioMediaRelinkResponse> {
  try {
    await getProjectDir(data.projectId); // Validates the id before any fs work.

    // VIDTSX_RELINK_PICK stands in for the native file dialog in automated
    // runs — OS pickers can't be driven over CDP (docs/ui-automation-cdp.md).
    let filePath = data.filePath ?? process.env.VIDTSX_RELINK_PICK;
    if (!filePath) {
      const result = await dialog.showOpenDialog({
        title: 'Locate Missing Media',
        properties: ['openFile'],
        filters: MEDIA_DIALOG_FILTERS,
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, canceled: true };
      }
      filePath = result.filePaths[0];
    }

    const kind = classifyMediaKind(filePath);
    if (!kind) return { success: false, error: 'Unsupported file type' };
    try {
      await fs.access(filePath);
    } catch {
      return { success: false, error: 'Picked file not found on disk' };
    }

    const hash = await hashFileHead(filePath);
    if (data.expectedHash && hash !== data.expectedHash && !data.allowMismatch) {
      return { success: false, mismatch: true, pickedPath: filePath };
    }

    const probe = await probeMedia(filePath, kind);
    return { success: true, asset: { path: filePath, probe, ...(hash ? { hash } : {}) } };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to relink media') };
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
    let project = data.project;
    if (!project?.timeline || timelineDuration(project.timeline) <= 0) {
      return { success: false, error: 'The timeline is empty — add a clip before exporting' };
    }
    // Range export (D2): trim the document to the I→O window and serialize the
    // result exactly like a full export — serializeTimeline stays the single
    // source of truth. The render length is the window's exact frame count.
    let durationOverride: number | undefined;
    if (data.rangeIn !== undefined && data.rangeOut !== undefined) {
      const fps = project.settings.fps;
      const trimmed = trimTimelineToRange(project.timeline, data.rangeIn, data.rangeOut, fps);
      if (trimmed === project.timeline) {
        return { success: false, error: 'Invalid export range' };
      }
      if (timelineDuration(trimmed) <= 0) {
        return { success: false, error: 'The export range contains no clips' };
      }
      durationOverride = rangeDurationInFrames(data.rangeIn, data.rangeOut, fps);
      project = { ...project, timeline: trimmed };
    }
    const assetBaseUrl = await ensureAssetServerUrl();
    const entry = await createExportEntry(project, assetBaseUrl, durationOverride);
    return { success: true, ...entry };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to prepare export') };
  }
}

/** Export dialog / Settings picker rows (docs/export-engines-plan.md D2/D3). */
export async function handleStudioExportEnginesList(): Promise<StudioExportEnginesListResponse> {
  const defaultId = await getRenderDefaultExportEngine();
  try {
    return { engines: await listExportEngineStatus(), defaultId, verifyAvailable: isExportVerifyAvailable() };
  } catch {
    return { engines: [{ id: defaultId, available: true }], defaultId, verifyAvailable: false };
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
        shots: data.shots,
        toolsAvailable,
        reviewOpen: data.reviewOpen,
        ...(data.openProposal ? { openProposal: data.openProposal } : {}),
        ...(data.captions ? { captions: data.captions } : {}),
        ...(data.timelineDurationSeconds !== undefined
          ? { timelineDurationSeconds: data.timelineDurationSeconds }
          : {}),
        ...(data.script ? { script: data.script } : {}),
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

/** W3: the renderer's answer to an agent 'action' event (apply / export / captions). */
export async function handleStudioAgentActionResult(
  _event: IpcMainInvokeEvent,
  data: StudioAgentActionResultRequest,
): Promise<StudioAgentActionResultResponse> {
  return { success: agentActions.resolve(data) };
}

// Persisted Assistant transcript (Q1d) — renderer owns the list, main does the
// disk I/O beside project.json.
export async function handleStudioAgentChatLoad(
  _event: IpcMainInvokeEvent,
  data: StudioAgentChatLoadRequest,
): Promise<StudioAgentChatLoadResponse> {
  try {
    return { success: true, messages: await loadAgentChat(data.projectId) };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to load the conversation') };
  }
}

export async function handleStudioAgentChatSave(
  _event: IpcMainInvokeEvent,
  data: StudioAgentChatSaveRequest,
): Promise<StudioAgentChatSaveResponse> {
  try {
    await saveAgentChat(data.projectId, data.messages);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to save the conversation') };
  }
}

export async function handleStudioAgentChatReset(
  _event: IpcMainInvokeEvent,
  data: StudioAgentChatResetRequest,
): Promise<StudioAgentChatResetResponse> {
  try {
    await resetAgentChat(data.projectId);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to reset the conversation') };
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

export async function handleStudioCacheInfo(
  _event: IpcMainInvokeEvent,
  data: StudioCacheInfoRequest,
): Promise<StudioCacheInfoResponse> {
  try {
    const info = await getCacheInfo(data.projectId);
    return { success: true, ...info };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to read cache size') };
  }
}

export async function handleStudioCacheOpen(
  _event: IpcMainInvokeEvent,
  data: StudioCacheOpenRequest,
): Promise<StudioCacheOpenResponse> {
  try {
    const cacheDir = await getProjectCacheDir(data.projectId);
    // openPath returns an error string on failure, '' on success.
    const result = await shell.openPath(cacheDir);
    return result ? { success: false, error: result } : { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to open cache folder') };
  }
}

export async function handleStudioCacheClear(
  _event: IpcMainInvokeEvent,
  data: StudioCacheClearRequest,
): Promise<StudioCacheClearResponse> {
  try {
    await clearCache(data.projectId);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to clear cache') };
  }
}

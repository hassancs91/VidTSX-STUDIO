// Studio TSX shots (S4): generate / cancel / import / reconcile / versions.
// The preview's module resolution (D4) lives in studio-shot-module-handler.ts.

import fs from 'fs/promises';
import path from 'path';
import { dialog, type IpcMainInvokeEvent } from 'electron';
import type {
  StudioCreatorProjectsResponse,
  StudioShotCancelRequest,
  StudioShotCancelResponse,
  StudioShotGenerateRequest,
  StudioShotGenerateResponse,
  StudioShotImportRequest,
  StudioShotImportResponse,
  StudioShotVersionsRequest,
  StudioShotVersionsResponse,
  StudioShotsReconcileRequest,
  StudioShotsReconcileResponse,
  StudioShotLibraryResponse,
} from '../../shared/ipc/types';
import { getProjectDir } from '../services/studio/studio-paths';
import { isValidShotId } from '../../shared/studio/shots';
import { shotGenerator } from '../services/studio/shot-generator';
import { listCreatorProjects } from '../services/studio/creator-projects';
import { importShot } from '../services/studio/shot-import';
import { reconcileShots } from '../services/studio/shot-reconcile';
import { listStudioShotLibrary } from '../services/studio/studio-shot-library';
import { getProjectsDir } from '../utils/paths';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('StudioShotIpc');

/** Stop a shot's build, whatever its op and whoever started it (the generator owns one run per shot). */
export async function handleStudioShotCancel(
  _event: IpcMainInvokeEvent,
  data: StudioShotCancelRequest,
): Promise<StudioShotCancelResponse> {
  return { success: true, cancelled: shotGenerator.cancel(data.projectId, data.shotId) };
}

/**
 * Pool button and Inspector (D8 "direct user entry"): a fast-fail handshake
 * that returns the shot id, then the build runs detached — progress and the
 * result arrive as STUDIO_SHOT_JOB_EVENT pushes, exactly like transcript and
 * proxy jobs. The renderer records the playhead at click time and inserts
 * the clip when a new shot's ready event lands.
 */
export async function handleStudioShotGenerate(
  _event: IpcMainInvokeEvent,
  data: StudioShotGenerateRequest,
): Promise<StudioShotGenerateResponse> {
  try {
    const common = {
      ...(data.footage ? { footage: data.footage } : {}),
      ...(data.providerId ? { providerId: data.providerId } : {}),
      ...(data.model ? { model: data.model } : {}),
    };
    if (data.op === 'edit' || data.op === 'refine') {
      if (!data.shotId || !data.activeVersion) {
        return { success: false, error: `${data.op === 'edit' ? 'Edit' : 'Refine'} needs a shot and its active version` };
      }
      if (data.op === 'edit' && !data.instruction?.trim()) {
        return { success: false, error: 'Edit needs an instruction' };
      }
      if (shotGenerator.isRunning(data.projectId, data.shotId)) {
        return { success: false, error: 'This shot is already building: wait for it, or cancel it first.' };
      }
      // What the renderer's registry knows now (project.json lags the autosave).
      const facts = {
        projectId: data.projectId,
        shotId: data.shotId,
        activeVersion: data.activeVersion,
        ...(data.kind ? { kind: data.kind } : {}),
        ...(data.brief ? { brief: data.brief } : {}),
        ...(data.anchor ? { anchor: data.anchor } : {}),
        ...(data.assetRefs ? { assetRefs: data.assetRefs } : {}),
        ...common,
      };
      const run =
        data.op === 'edit'
          ? shotGenerator.edit({ ...facts, instruction: data.instruction!, ...(data.budget ? { budget: data.budget } : {}) })
          : shotGenerator.refine(facts);
      run.catch((err) => log.warn(`Shot ${data.op} ended without a version`, { error: String(err) }));
      return { success: true, shotId: data.shotId };
    }

    if (!data.kind || !data.brief?.trim()) {
      return { success: false, error: 'A shot kind and brief are required' };
    }
    if (data.op === 'regenerate' && !data.shotId) {
      return { success: false, error: 'Regenerate needs the existing shot id' };
    }
    // Wait ONLY for the folder reservation (the id exists from then on) so
    // the renderer can track the run; the build continues detached and
    // completion arrives as push events. A failure before it (no transcript
    // for the anchor, a bad project id, a shot already building) fails fast here.
    const shotId = await new Promise<string>((resolve, reject) => {
      let reserved = false;
      shotGenerator
        .generate(
          {
            projectId: data.projectId,
            kind: data.kind!,
            brief: data.brief!,
            ...(data.name ? { name: data.name } : {}),
            ...(data.anchor ? { anchor: data.anchor } : {}),
            ...(data.assetRefs ? { assetRefs: data.assetRefs } : {}),
            ...(data.durationSeconds !== undefined ? { durationSeconds: data.durationSeconds } : {}),
            ...(data.budget ? { budget: data.budget } : {}),
            ...common,
            origin: { by: 'user' },
            onReserved: (id) => {
              reserved = true;
              resolve(id);
            },
          },
          data.op === 'regenerate' ? data.shotId : undefined,
        )
        .catch((err) => {
          // After reservation the outcome is delivered as an event.
          if (!reserved) reject(err instanceof Error ? err : new Error(String(err)));
          else log.warn('Shot build ended without a version', { error: String(err) });
        });
    });
    return { success: true, shotId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to start shot generation',
    };
  }
}

/** The Creator source adapter for the import picker (D14) — one of several
 *  sources; the import handler below is the same for all of them. */
export async function handleStudioCreatorProjects(): Promise<StudioCreatorProjectsResponse> {
  try {
    return { success: true, projects: await listCreatorProjects() };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list Creator projects',
    };
  }
}

/**
 * Import a TSX as a shot (D14). No `sourcePath` means "let the user find one"
 * — the OS picker stays in main, so the thin renderer callers differ only in
 * whether they already know the file. A clean import is fast and its ready
 * entry arrives on the shot job stream; a conform run returns after the folder
 * is reserved and streams progress like a generation.
 */
export async function handleStudioShotImport(
  _event: IpcMainInvokeEvent,
  data: StudioShotImportRequest,
): Promise<StudioShotImportResponse> {
  try {
    // VIDTSX_SHOT_PICK stands in for the picker in automated runs, like VIDTSX_MEDIA_PICK.
    let sourcePath = data.sourcePath ?? (process.env.VIDTSX_SHOT_PICK || undefined);
    if (!sourcePath) {
      const result = await dialog.showOpenDialog({
        title: 'Import a TSX composition',
        defaultPath: getProjectsDir(),
        properties: ['openFile'],
        filters: [{ name: 'TSX composition', extensions: ['tsx'] }],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, canceled: true };
      }
      sourcePath = result.filePaths[0];
    }

    // Same handshake as generation: resolve as soon as the shot folder exists
    // (instant for a clean import, one reservation for a conform run) and let
    // the rest arrive as job events. A failure BEFORE any folder is reserved —
    // unreadable file, failed gate — resolves with its outcome instead.
    const source = sourcePath;
    const outcome = await new Promise<Awaited<ReturnType<typeof importShot>>>((resolve) => {
      let reserved = false;
      importShot({
        projectId: data.projectId,
        sourcePath: source,
        ...(data.name ? { name: data.name } : {}),
        ...(data.conform ? { conform: true } : {}),
        ...(data.providerId ? { providerId: data.providerId } : {}),
        ...(data.model ? { model: data.model } : {}),
        onReserved: (shotId) => {
          reserved = true;
          resolve({ shotId });
        },
      })
        .then((result) => {
          if (!reserved) resolve(result);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Import failed';
          if (!reserved) resolve({ error: message });
          else log.warn('Shot import failed after handshake', { error: message });
        });
    });
    if (outcome.error) {
      return {
        success: false,
        error: outcome.error,
        ...(outcome.conformable ? { conformable: true } : {}),
        // Echoed so "Convert for Studio" can re-import the very same source
        // the user picked, including through the OS dialog.
        sourcePath,
        ...(data.name ? { name: data.name } : {}),
      };
    }
    return {
      success: true,
      ...(outcome.shotId ? { shotId: outcome.shotId } : {}),
      // A bundled import returns whole (no handshake): the report says what was inlined.
      ...(outcome.report ? { report: outcome.report } : {}),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to import the composition',
    };
  }
}

/** Folder-as-truth version list for the inspector's version picker (D10). */
/** Q2: the Creator library's Studio section — shot folders listed in place. */
export async function handleStudioShotLibrary(): Promise<StudioShotLibraryResponse> {
  try {
    return { success: true, projects: await listStudioShotLibrary() };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list Studio shots',
    };
  }
}

/** Q1c: adopt orphan / dropped-in shot folders. Adoptions ride the job-event
 *  stream; the response is the toast/banner summary. */
export async function handleStudioShotsReconcile(
  _event: IpcMainInvokeEvent,
  data: StudioShotsReconcileRequest,
): Promise<StudioShotsReconcileResponse> {
  try {
    const result = await reconcileShots(data.projectId, data.knownShotIds);
    return { success: true, adopted: result.adopted, failures: result.failures };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Shot reconcile failed',
    };
  }
}

export async function handleStudioShotVersions(
  _event: IpcMainInvokeEvent,
  data: StudioShotVersionsRequest,
): Promise<StudioShotVersionsResponse> {
  try {
    if (!isValidShotId(data.shotId)) {
      return { success: false, error: `Invalid shot id: ${data.shotId}` };
    }
    const dir = path.join(await getProjectDir(data.projectId), 'shots', data.shotId);
    const entries = await fs.readdir(dir);
    const versions = entries
      .map((entry) => /^v(\d+)\.tsx$/.exec(entry)?.[1])
      .filter((v): v is string => v !== undefined)
      .map(Number)
      .sort((a, b) => a - b);
    return { success: true, versions };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list shot versions',
    };
  }
}

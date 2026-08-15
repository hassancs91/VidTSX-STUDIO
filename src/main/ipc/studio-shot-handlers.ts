// Studio TSX shots (S4) — preview module resolution (TSX_SHOTS_DESIGN.md D4).
//
// The renderer never handles absolute paths: it asks for {projectId, shotId,
// version} and gets back a module-server URL it can dynamic-import into the
// in-app <Player>. Transpilation shares the Creator's pipeline
// (esbuild + import-rewrite to the virtual React/Remotion modules), which is
// exactly what makes useCurrentFrame() inside the shot track the host Player
// (Spike 0, PASS 2026-08-14).

import fs from 'fs/promises';
import path from 'path';
import { dialog, type IpcMainInvokeEvent } from 'electron';
import type {
  StudioCreatorProjectsResponse,
  StudioShotGenerateRequest,
  StudioShotGenerateResponse,
  StudioShotImportRequest,
  StudioShotImportResponse,
  StudioShotModuleRequest,
  StudioShotModuleResponse,
  StudioShotVersionsRequest,
  StudioShotVersionsResponse,
} from '../../shared/ipc/types';
import { getProjectDir, getShotVersionPath } from '../services/studio/studio-paths';
import { isValidShotId } from '../../shared/studio/shots';
import { shotGenerator } from '../services/studio/shot-generator';
import { listCreatorProjects } from '../services/studio/creator-projects';
import { importShot } from '../services/studio/shot-import';
import { getProjectsDir } from '../utils/paths';
import { transpileTsxCached } from '../services/tsx-transpiler';
import {
  ensureModuleServer,
  getModuleServerBaseUrl,
  storeTranspileResult,
} from '../services/module-server';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('StudioShotIpc');

export async function handleStudioShotModule(
  _event: IpcMainInvokeEvent,
  data: StudioShotModuleRequest,
): Promise<StudioShotModuleResponse> {
  try {
    const filePath = await getShotVersionPath(data.projectId, data.shotId, data.version);
    try {
      await fs.access(filePath);
    } catch {
      return {
        success: false,
        error: `Shot source missing: ${data.shotId} v${data.version}`,
      };
    }

    await ensureModuleServer();
    const baseUrl = getModuleServerBaseUrl();
    if (!baseUrl) {
      return { success: false, error: 'Module server failed to start' };
    }

    // Content-hash cached: an unchanged version transpiles once; a new
    // version (new content) yields a new hash and therefore a new URL, which
    // is what triggers the renderer's re-import.
    const result = await transpileTsxCached(filePath, baseUrl);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const moduleUrl = storeTranspileResult(result);
    return {
      success: true,
      moduleUrl,
      config: {
        durationInFrames: result.config.durationInFrames,
        fps: result.config.fps,
        width: result.config.width,
        height: result.config.height,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to prepare shot module',
    };
  }
}

/**
 * Pool-button generation (D8 "direct user entry"): fast-fail handshake that
 * returns the reserved/target shot id, then the pipeline runs detached —
 * completion arrives as STUDIO_SHOT_JOB_EVENT pushes, exactly like
 * transcript/proxy jobs. The renderer records the playhead at click time and
 * inserts the clip when the ready event lands.
 */
export async function handleStudioShotGenerate(
  _event: IpcMainInvokeEvent,
  data: StudioShotGenerateRequest,
): Promise<StudioShotGenerateResponse> {
  try {
    if (data.op === 'edit') {
      if (!data.shotId || !data.activeVersion || !data.instruction?.trim()) {
        return { success: false, error: 'Edit needs a shot, its active version, and an instruction' };
      }
      const edit = shotGenerator.edit({
        projectId: data.projectId,
        shotId: data.shotId,
        activeVersion: data.activeVersion,
        instruction: data.instruction,
        ...(data.providerId ? { providerId: data.providerId } : {}),
      });
      edit.catch((err) => log.warn('Shot edit failed', { error: String(err) }));
      return { success: true, shotId: data.shotId };
    }

    if (!data.kind || !data.brief?.trim()) {
      return { success: false, error: 'A shot kind and brief are required' };
    }
    if (data.op === 'regenerate' && !data.shotId) {
      return { success: false, error: 'Regenerate needs the existing shot id' };
    }
    // Wait ONLY for the folder reservation (the id exists from then on) so
    // the renderer can track the run; the pipeline continues detached and
    // completion arrives as push events. A pre-pipeline failure (no
    // transcript for the anchor, bad project id) still fails fast here.
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
            ...(data.providerId ? { providerId: data.providerId } : {}),
            origin: { by: 'user' },
            onReserved: (id) => {
              reserved = true;
              resolve(id);
            },
          },
          data.op === 'regenerate' ? data.shotId : undefined,
        )
        .catch((err) => {
          // After reservation the failure is delivered as an error event.
          if (!reserved) reject(err instanceof Error ? err : new Error(String(err)));
          else log.warn('Shot generation failed after handshake', { error: String(err) });
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
    let sourcePath = data.sourcePath;
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
    return { success: true, ...(outcome.shotId ? { shotId: outcome.shotId } : {}) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to import the composition',
    };
  }
}

/** Folder-as-truth version list for the inspector's version picker (D10). */
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

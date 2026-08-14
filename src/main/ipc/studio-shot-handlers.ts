// Studio TSX shots (S4) — preview module resolution (TSX_SHOTS_DESIGN.md D4).
//
// The renderer never handles absolute paths: it asks for {projectId, shotId,
// version} and gets back a module-server URL it can dynamic-import into the
// in-app <Player>. Transpilation shares the Creator's pipeline
// (esbuild + import-rewrite to the virtual React/Remotion modules), which is
// exactly what makes useCurrentFrame() inside the shot track the host Player
// (Spike 0, PASS 2026-08-14).

import fs from 'fs/promises';
import type { IpcMainInvokeEvent } from 'electron';
import type {
  StudioShotModuleRequest,
  StudioShotModuleResponse,
} from '../../shared/ipc/types';
import { getShotVersionPath } from '../services/studio/studio-paths';
import { transpileTsxCached } from '../services/tsx-transpiler';
import {
  ensureModuleServer,
  getModuleServerBaseUrl,
  storeTranspileResult,
} from '../services/module-server';

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

// Studio TSX shots (S4) — preview module resolution (TSX_SHOTS_DESIGN.md D4).
//
// The renderer never handles absolute paths: it asks for {projectId, shotId,
// version} and gets back a module-server URL it can dynamic-import into the
// in-app <Player>. Transpilation shares the Creator's pipeline
// (esbuild + import-rewrite to the virtual React/Remotion modules), which is
// exactly what makes useCurrentFrame() inside the shot track the host Player
// (Spike 0, PASS 2026-08-14).
//
// A TSX builder version also loads files from its shot folder (`vN.assets/`:
// a 3D model, an environment map, a font; TSX_BUILDER_DESIGN.md P3 part 6, D8).
// They come back as `assets` URLs on the same server, the way the Creator's
// MODULE_TRANSPILE returns them. The folders are registered as asset roots on
// every load, so a restarted app serves them again.

import type { IpcMainInvokeEvent } from 'electron';
import type { StudioShotModuleRequest, StudioShotModuleResponse } from '../../shared/ipc/types';
import { resolveShotModule } from '../services/studio/shot-module-resolver';
import { getShotVersionPath } from '../services/studio/studio-paths';
import { versionAssetsProp } from '../services/tsx-builder/version-assets';
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
    await ensureModuleServer();
    const baseUrl = getModuleServerBaseUrl();
    if (!baseUrl) {
      return { success: false, error: 'Module server failed to start' };
    }

    // Memo → project disk cache → transpile (shot-module-resolver). The URL
    // is the content hash, so a new version (new content) gets a new URL,
    // which is what triggers the renderer's re-import.
    const result = await resolveShotModule(data.projectId, data.shotId, data.version, baseUrl);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const moduleUrl = storeTranspileResult(result);
    const versionPath = await getShotVersionPath(data.projectId, data.shotId, data.version);
    const assets = await versionAssetsProp(versionPath, baseUrl).catch(() => null);
    return {
      success: true,
      moduleUrl,
      config: {
        durationInFrames: result.config.durationInFrames,
        fps: result.config.fps,
        width: result.config.width,
        height: result.config.height,
      },
      ...(assets && Object.keys(assets).length > 0 ? { assets } : {}),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to prepare shot module',
    };
  }
}

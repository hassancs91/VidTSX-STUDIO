// Transition packs (docs/studio/TRANSITION_PACKS_DESIGN.md "Delivery") —
// listing and preview-module resolution, the caption-template path copied.
//
// One deliberate difference: the import gate (react/remotion only, one file)
// runs HERE, at resolve, not only at export — a pack is code that runs in the
// renderer, so a file that breaks the rules never executes.

import type { IpcMainInvokeEvent } from 'electron';
import type {
  StudioTransitionListResponse,
  StudioTransitionModuleRequest,
  StudioTransitionModuleResponse,
} from '../../shared/ipc/types';
import {
  listTransitions,
  readTransitionSource,
  resolveTransition,
} from '../services/studio/transition-packs';
import { transpileTsxCached } from '../services/tsx-transpiler';
import {
  ensureModuleServer,
  getModuleServerBaseUrl,
  storeTranspileResult,
} from '../services/module-server';

export async function handleStudioTransitionList(): Promise<StudioTransitionListResponse> {
  try {
    const items = await listTransitions();
    return {
      success: true,
      transitions: items.map((t) => ({
        kind: t.kind,
        name: t.name,
        packId: t.packId,
        packName: t.packName,
        durationSeconds: t.durationSeconds,
        sceneCopies: t.sceneCopies,
        version: t.version,
        ...(t.description ? { description: t.description } : {}),
        ...(t.usage ? { usage: t.usage } : {}),
        ...(t.tier ? { tier: t.tier } : {}),
      })),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to list transitions' };
  }
}

export async function handleStudioTransitionModule(
  _event: IpcMainInvokeEvent,
  data: StudioTransitionModuleRequest,
): Promise<StudioTransitionModuleResponse> {
  try {
    const item = await resolveTransition(data.kind);
    if (!item) {
      return { success: false, notInstalled: true, error: `Transition not installed: ${data.kind}` };
    }
    const read = await readTransitionSource(item);
    if (!read.ok) return { success: false, error: read.error };

    await ensureModuleServer();
    const baseUrl = getModuleServerBaseUrl();
    if (!baseUrl) return { success: false, error: 'Module server failed to start' };

    const result = await transpileTsxCached(item.filePath, baseUrl);
    if (!result.success) return { success: false, error: result.error };

    return { success: true, moduleUrl: storeTranspileResult(result) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to prepare transition' };
  }
}

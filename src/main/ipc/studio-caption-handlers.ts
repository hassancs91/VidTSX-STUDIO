// Caption templates (D13) — listing and preview-module resolution.
//
// Same shape as the shot-module handler: the renderer never handles absolute
// paths, it asks by namespaced templateId and gets back a module-server URL
// it can dynamic-import into the in-app <Player>. Transpilation shares the
// shot pipeline (esbuild + rewrite to the virtual React/Remotion modules),
// which is what makes a template's useCurrentFrame() track the host Player.

import fs from 'fs/promises';
import type { IpcMainInvokeEvent } from 'electron';
import type {
  StudioCaptionTemplateModuleRequest,
  StudioCaptionTemplateModuleResponse,
  StudioCaptionTemplatesResponse,
} from '../../shared/ipc/types';
import {
  listCaptionTemplates,
  resolveCaptionTemplate,
} from '../services/studio/caption-packs';
import { transpileTsxCached } from '../services/tsx-transpiler';
import {
  ensureModuleServer,
  getModuleServerBaseUrl,
  storeTranspileResult,
} from '../services/module-server';

export async function handleStudioCaptionTemplates(): Promise<StudioCaptionTemplatesResponse> {
  try {
    const templates = await listCaptionTemplates();
    return {
      success: true,
      templates: templates.map((t) => ({
        templateId: t.templateId,
        name: t.name,
        packId: t.packId,
        packName: t.packName,
        ...(t.description ? { description: t.description } : {}),
        ...(t.sampleWords ? { sampleWords: t.sampleWords } : {}),
        ...(t.defaults ? { defaults: t.defaults } : {}),
      })),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list caption templates',
    };
  }
}

export async function handleStudioCaptionTemplateModule(
  _event: IpcMainInvokeEvent,
  data: StudioCaptionTemplateModuleRequest,
): Promise<StudioCaptionTemplateModuleResponse> {
  try {
    const template = await resolveCaptionTemplate(data.templateId);
    if (!template) {
      // Not an error the user must fix: the pack may simply be uninstalled.
      // The panel says so and the layer paints nothing (graceful degrade).
      return { success: false, error: `Caption template not installed: ${data.templateId}` };
    }
    await fs.access(template.filePath);

    await ensureModuleServer();
    const baseUrl = getModuleServerBaseUrl();
    if (!baseUrl) return { success: false, error: 'Module server failed to start' };

    const result = await transpileTsxCached(template.filePath, baseUrl);
    if (!result.success) return { success: false, error: result.error };

    return { success: true, moduleUrl: storeTranspileResult(result) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to prepare caption template',
    };
  }
}

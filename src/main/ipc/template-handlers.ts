import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';
import type {
  TemplateIpc,
  TemplatesListResponse,
  TemplatesStageRequest,
  TemplatesStageResponse,
  TemplatesStateLoadRequest,
  TemplatesStateLoadResponse,
  TemplatesStateSaveRequest,
  TemplatesStateSaveResponse,
} from '@shared/ipc/types';
import type { InstalledTemplate } from '@shared/types/templates';
import { parseAgentId } from '@shared/agents/ids';
import { ensureModuleServer, getModuleServerBaseUrl } from '../services/module-server';
import { assetUrlFor } from '../services/agents/artifact-paths';
import { findTemplate, scanTemplates } from '../services/templates/template-store';
import { loadTemplateState, saveTemplateState, stageTemplate } from '../services/templates/template-stage';

/**
 * The card shows the template's own thumbnail, so the renderer needs a url
 * rather than a path. The preview server being down costs the picture and
 * nothing else, so it is swallowed per template (the agents' icon rule).
 */
async function withThumbnailUrl(template: InstalledTemplate): Promise<TemplateIpc> {
  if (!template.manifest.thumbnail) return template;
  try {
    return { ...template, thumbnailUrl: await assetUrlFor(path.join(template.dir, template.manifest.thumbnail)) };
  } catch {
    return template;
  }
}

export async function handleTemplatesList(): Promise<TemplatesListResponse> {
  try {
    const templates = await scanTemplates();
    return { templates: await Promise.all(templates.map(withThumbnailUrl)) };
  } catch (err) {
    return { templates: [], error: err instanceof Error ? err.message : 'Failed to list templates' };
  }
}

export async function handleTemplatesStage(
  _event: IpcMainInvokeEvent,
  data: TemplatesStageRequest,
): Promise<TemplatesStageResponse> {
  try {
    const template = await findTemplate(data.id);
    if (!template) return { success: false, error: 'That template is not installed.' };
    const staged = await stageTemplate(template, data.format);
    await ensureModuleServer();
    return {
      success: true,
      entryPath: staged.entryPath,
      workDir: staged.workDir,
      format: staged.format,
      assetBaseUrl: getModuleServerBaseUrl() ?? undefined,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to prepare the template' };
  }
}

export async function handleTemplatesStateLoad(
  _event: IpcMainInvokeEvent,
  data: TemplatesStateLoadRequest,
): Promise<TemplatesStateLoadResponse> {
  try {
    // The id becomes a folder name — parse it before it reaches the path join.
    if (!parseAgentId(data.id)) return { state: null };
    return { state: await loadTemplateState(data.id) };
  } catch {
    return { state: null };
  }
}

export async function handleTemplatesStateSave(
  _event: IpcMainInvokeEvent,
  data: TemplatesStateSaveRequest,
): Promise<TemplatesStateSaveResponse> {
  try {
    if (!parseAgentId(data.id)) return { success: false, error: 'Invalid template id.' };
    await saveTemplateState(data.id, data.state);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save' };
  }
}

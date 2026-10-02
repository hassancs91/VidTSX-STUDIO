import path from 'path';
import { app, dialog, type IpcMainInvokeEvent } from 'electron';
import type {
  TemplateIpc,
  TemplatesImportRequest,
  TemplatesImportResponse,
  TemplatesListResponse,
  TemplatesPendingPackageResponse,
  TemplatesRemoveRequest,
  TemplatesRemoveResponse,
  TemplatesStageRequest,
  TemplatesStageResponse,
  TemplatesStateLoadRequest,
  TemplatesStateLoadResponse,
  TemplatesStateSaveRequest,
  TemplatesStateSaveResponse,
} from '@shared/ipc/types';
import type { InstalledTemplate } from '@shared/types/templates';
import { parseAgentId } from '@shared/agents/ids';
import { TEMPLATE_PACKAGE_EXT } from '@shared/templates/manifest';
import { logEngine } from '../../logging/log-engine';
import { ensureModuleServer, getModuleServerBaseUrl } from '../services/module-server';
import { assetUrlFor } from '../services/agents/artifact-paths';
import { findTemplate, scanTemplates } from '../services/templates/template-store';
import { loadTemplateState, saveTemplateState, stageTemplate } from '../services/templates/template-stage';
import { installTemplatePackage, removeTemplate } from '../services/templates/template-install';
import { validateAgentCompositionCode } from '../services/agents/tsx-deps';
import { takePendingPackage } from '../services/packages/pending-open';

const log = logEngine.createLogger('TemplateHandlers');

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

/** Claim the `.vidtsxtemplate` the OS handed us — one-shot, kind-scoped (pending-open.ts). */
export async function handleTemplatesPendingPackage(): Promise<TemplatesPendingPackageResponse> {
  const filePath = takePendingPackage('template');
  return filePath ? { filePath } : {};
}

/**
 * Install a `.vidtsxtemplate` into the user root. No path opens the picker;
 * VIDTSX_TEMPLATE_PICK stands in for it in automated runs. An older version
 * than the installed one comes back as `needsConfirm` and installs nothing.
 */
export async function handleTemplatesImport(
  _event: IpcMainInvokeEvent,
  data: TemplatesImportRequest = {},
): Promise<TemplatesImportResponse> {
  try {
    let filePath = data.path ?? process.env.VIDTSX_TEMPLATE_PICK;
    if (!filePath) {
      const picked = await dialog.showOpenDialog({
        title: 'Import a template',
        properties: ['openFile'],
        filters: [{ name: 'VidTSX template', extensions: [TEMPLATE_PACKAGE_EXT.replace('.', '')] }],
      });
      if (picked.canceled || picked.filePaths.length === 0) return { success: false, canceled: true };
      filePath = picked.filePaths[0];
    }
    const result = await installTemplatePackage(
      filePath,
      { manifestContext: { appVersion: app.getVersion() }, validateComposition: validateAgentCompositionCode },
      data.confirmDowngrade ? { confirmDowngrade: true } : {},
    );
    if (result.needsConfirm) {
      return { success: false, needsConfirm: result.needsConfirm, installedVersion: result.installedVersion, path: filePath };
    }
    if (!result.template) return { success: false, error: 'The template did not install.' };
    return {
      success: true,
      template: await withThumbnailUrl(result.template),
      ...(result.signature
        ? { signature: { status: result.signature.status, ...(result.signature.publisher ? { publisher: result.signature.publisher } : {}) } }
        : {}),
      path: filePath,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn('Template import failed', { error: message });
    return { success: false, error: message || 'Failed to import the template', ...(data.path ? { path: data.path } : {}) };
  }
}

export async function handleTemplatesRemove(
  _event: IpcMainInvokeEvent,
  data: TemplatesRemoveRequest,
): Promise<TemplatesRemoveResponse> {
  try {
    if (!parseAgentId(data.id)) return { success: false, error: 'Invalid template id.' };
    await removeTemplate(data.id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to remove the template' };
  }
}

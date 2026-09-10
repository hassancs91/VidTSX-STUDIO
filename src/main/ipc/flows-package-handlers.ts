// Flows IPC — packaging (docs/flows-plan.md §0.1 item 4, §1.8, W8 Stage 6):
// import a `.vidtsxflow` or a bare `flow.json`, export a flow, and claim the
// package the OS handed the app. Thin bodies over the flows services; error
// shaping only. The Stage 2 stubs these replace lived in
// `flows-artifact-handlers.ts`.

import { app, dialog, type IpcMainInvokeEvent } from 'electron';
import type {
  FlowsExportRequest,
  FlowsExportResponse,
  FlowsImportRequest,
  FlowsImportResponse,
  FlowsPendingPackageResponse,
} from '../../shared/ipc/types';
import { FLOW_PACKAGE_EXT } from '../../shared/flows/flow-package';
import { takePendingPackage } from '../services/packages/pending-open';
import { getNode } from '../services/agents/tools/registry-core';
import { createFlow, loadFlow } from '../services/flows-projects-db';
import { buildFlowPackageDeps } from '../services/flows/flow-package-context';
import { ensureFlowCatalog } from '../services/flows/flow-catalog';
import { decorateProject } from '../services/flows/flow-project-view';
import {
  buildExportManifest,
  exportFileName,
  importFlowFile,
  importFlowJson,
  writeFlowPackage,
  type ImportOutcome,
} from '../services/flows/flow-export-import';
import { loadFlowDoc } from '../services/flows/flow-service';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('flows-package-handlers');

function fail(err: unknown, fallback: string): { success: false; error: string } {
  const message = err instanceof Error ? err.message : String(err);
  log.warn(fallback, { error: message });
  return { success: false, error: message || fallback };
}

/** Claim the `.vidtsxflow` the OS handed us — one-shot, kind-scoped (pending-open.ts). */
export async function handleFlowsPendingPackage(): Promise<FlowsPendingPackageResponse> {
  const filePath = takePendingPackage('flow');
  return filePath ? { filePath } : {};
}

async function settleImport(outcome: ImportOutcome): Promise<FlowsImportResponse> {
  if (outcome.kind === 'needs-confirm') {
    return { success: false, needsConfirm: outcome.needsConfirm, installedVersion: outcome.installedVersion };
  }
  if (outcome.kind === 'installed') {
    await ensureFlowCatalog(buildFlowPackageDeps(), undefined, true);
    const project = loadFlow(outcome.flow.manifest.id);
    if (!project) return { success: false, error: 'The flow installed but its row could not be read.' };
    return { success: true, project: decorateProject(project), warnings: outcome.warnings };
  }
  const { doc } = outcome;
  const project = createFlow({
    name: doc.name,
    ...(doc.description ? { description: doc.description } : {}),
    graphJson: JSON.stringify(doc),
    source: 'imported',
  });
  return { success: true, project: decorateProject(project), warnings: outcome.warnings };
}

/**
 * A path, JSON text, or — with neither — the OS picker (`VIDTSX_FLOW_PICK`
 * stands in for it when driving the app, as `VIDTSX_AGENT_PICK` does for agents).
 */
export async function handleFlowsImport(_event: IpcMainInvokeEvent, data: FlowsImportRequest): Promise<FlowsImportResponse> {
  try {
    const deps = {
      packageDeps: buildFlowPackageDeps(),
      hasTool: (id: string) => Boolean(getNode(id)),
      ...(data.confirmDowngrade ? { confirmDowngrade: true } : {}),
    };
    if (data.json) return await settleImport(importFlowJson(data.json, deps));

    let filePath = data.path ?? process.env.VIDTSX_FLOW_PICK;
    if (!filePath) {
      const picked = await dialog.showOpenDialog({
        title: 'Import a flow',
        properties: ['openFile'],
        filters: [
          { name: 'VidTSX flow', extensions: [FLOW_PACKAGE_EXT.replace('.', ''), 'json'] },
        ],
      });
      if (picked.canceled || picked.filePaths.length === 0) return { success: false, canceled: true, error: 'Import cancelled.' };
      filePath = picked.filePaths[0];
    }
    return await settleImport(await importFlowFile(filePath, deps));
  } catch (err) {
    return fail(err, 'Failed to import the flow');
  }
}

/** A user flow → an unsigned `.vidtsxflow` (`VIDTSX_FLOW_SAVE` stands in for the save dialog). */
export async function handleFlowsExport(_event: IpcMainInvokeEvent, data: FlowsExportRequest): Promise<FlowsExportResponse> {
  try {
    if (!data.flowId) return { success: false, error: 'Missing flow id' };
    const { doc } = loadFlowDoc(data.flowId);
    let targetPath = data.targetPath ?? process.env.VIDTSX_FLOW_SAVE;
    if (!targetPath) {
      const picked = await dialog.showSaveDialog({
        title: 'Export flow',
        defaultPath: exportFileName(doc),
        filters: [{ name: 'VidTSX flow', extensions: [FLOW_PACKAGE_EXT.replace('.', '')] }],
      });
      if (picked.canceled || !picked.filePath) return { success: false, error: 'Export cancelled.' };
      targetPath = picked.filePath;
    }
    const manifest = buildExportManifest(doc, {
      appVersion: app.getVersion(),
      needsOf: (toolId) => {
        const need = getNode(toolId)?.needs;
        return need ? [need] : undefined;
      },
    });
    await writeFlowPackage(manifest, targetPath);
    return { success: true, path: targetPath };
  } catch (err) {
    return fail(err, 'Failed to export the flow');
  }
}

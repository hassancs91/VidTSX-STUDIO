// Flows IPC — a run's artifacts for the run form (docs/flows-plan.md §1.4,
// W8 Stage 2), and the Stage 6 packaging channels as typed "not yet"
// stubs so the Flows page's Import / Export buttons have a real answer.

import { dialog, type IpcMainInvokeEvent } from 'electron';
import type {
  FlowsExportRequest,
  FlowsExportResponse,
  FlowsImportRequest,
  FlowsImportResponse,
  FlowsRunArtifactActionRequest,
  FlowsRunArtifactActionResponse,
  FlowsRunArtifactResolveRequest,
  FlowsRunArtifactResolveResponse,
} from '../../shared/ipc/types';
import { resolveRunArtifact, runRunArtifactAction } from '../services/flows/flow-artifacts';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('flows-artifact-handlers');

const NOT_YET = 'Flow packaging arrives with Stage 6 of the flows plan — importing and exporting flow files is not available yet.';

function fail(err: unknown, fallback: string): { success: false; error: string } {
  const message = err instanceof Error ? err.message : String(err);
  log.warn(fallback, { error: message });
  return { success: false, error: message || fallback };
}

export async function handleFlowsRunArtifactResolve(
  _event: IpcMainInvokeEvent,
  data: FlowsRunArtifactResolveRequest,
): Promise<FlowsRunArtifactResolveResponse> {
  try {
    return await resolveRunArtifact(data.runId, data.artifactId);
  } catch (err) {
    return fail(err, 'Failed to open the run artifact');
  }
}

export async function handleFlowsRunArtifactAction(
  _event: IpcMainInvokeEvent,
  data: FlowsRunArtifactActionRequest,
): Promise<FlowsRunArtifactActionResponse> {
  try {
    return await runRunArtifactAction(data);
  } catch (err) {
    return fail(err, 'That handoff failed');
  }
}

/** Stage 6 implements this; until then the dialog opens and the answer says why nothing happened. */
export async function handleFlowsImport(_event: IpcMainInvokeEvent, data: FlowsImportRequest): Promise<FlowsImportResponse> {
  try {
    if (!data.path && !data.json) {
      const picked = await dialog.showOpenDialog({
        title: 'Import a flow',
        properties: ['openFile'],
        filters: [{ name: 'Flow files', extensions: ['vidtsxflow', 'json'] }],
      });
      if (picked.canceled || picked.filePaths.length === 0) return { success: false, error: 'Import cancelled.' };
    }
    return { success: false, error: NOT_YET };
  } catch (err) {
    return fail(err, 'Failed to import the flow');
  }
}

export async function handleFlowsExport(_event: IpcMainInvokeEvent, data: FlowsExportRequest): Promise<FlowsExportResponse> {
  try {
    if (!data.flowId) return { success: false, error: 'Missing flow id' };
    return { success: false, error: NOT_YET };
  } catch (err) {
    return fail(err, 'Failed to export the flow');
  }
}

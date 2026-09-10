// Flows IPC — a run's artifacts for the run form (docs/flows-plan.md §1.4,
// W8 Stage 2). The packaging channels moved to `flows-package-handlers.ts`
// in Stage 6.

import type { IpcMainInvokeEvent } from 'electron';
import type {
  FlowsRunArtifactActionRequest,
  FlowsRunArtifactActionResponse,
  FlowsRunArtifactResolveRequest,
  FlowsRunArtifactResolveResponse,
} from '../../shared/ipc/types';
import { resolveRunArtifact, runRunArtifactAction } from '../services/flows/flow-artifacts';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('flows-artifact-handlers');

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

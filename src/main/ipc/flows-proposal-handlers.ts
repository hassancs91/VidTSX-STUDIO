// Flows IPC — the Flow Builder's proposal card (flows plan §1.6, W8 Stage
// 4). The card itself arrives on AGENT_RUN_EVENT; these two channels re-read
// it after a navigation and drop it once the user has accepted or discarded.
// Accept never happens here: the renderer saves the proposed document
// through the ordinary FLOWS_PROJECT_UPDATE / FLOWS_PROJECT_CREATE path first,
// so a flow changes by exactly one route.

import type { IpcMainInvokeEvent } from 'electron';
import type {
  FlowsProposalGetRequest,
  FlowsProposalGetResponse,
  FlowsProposalResolveRequest,
  FlowsProposalResolveResponse,
} from '../../shared/ipc/types';
import { getFlowProposal, resolveFlowProposal } from '../services/flows/flow-proposals';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('flows-handlers');

function fail(err: unknown, fallback: string): { success: false; error: string } {
  const message = err instanceof Error ? err.message : String(err);
  log.warn(fallback, { error: message });
  return { success: false, error: message || fallback };
}

export async function handleFlowsProposalGet(
  _event: IpcMainInvokeEvent,
  data: FlowsProposalGetRequest,
): Promise<FlowsProposalGetResponse> {
  try {
    if (!data.sessionId) return { success: false, error: 'Missing session id' };
    return { success: true, proposal: getFlowProposal(data.sessionId) };
  } catch (err) {
    return fail(err, 'Could not read the pending flow proposal');
  }
}

export async function handleFlowsProposalResolve(
  _event: IpcMainInvokeEvent,
  data: FlowsProposalResolveRequest,
): Promise<FlowsProposalResolveResponse> {
  try {
    if (!data.sessionId || !data.proposalId) return { success: false, error: 'Missing session or proposal id' };
    const cleared = resolveFlowProposal(data.sessionId, data.proposalId);
    if (!cleared) return { success: false, error: 'That proposal is no longer pending.' };
    log.info('Flow proposal resolved', { sessionId: data.sessionId, accepted: data.accepted });
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not resolve the flow proposal');
  }
}

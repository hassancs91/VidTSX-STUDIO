// Flows IPC — freeze a session into a flow (flows plan §1.5, W8 Stage 5).
// The draft is built by the freeze service; without `viaAgent` it is queued
// as the session's proposal at once (the canvas shows "Frozen from session
// …"), with it the session's agent gets one turn to name it and the card
// follows on the run stream. Nothing is saved here — Accept on the canvas is
// the write.

import type { IpcMainInvokeEvent } from 'electron';
import type { FlowsFreezeRequest, FlowsFreezeResponse } from '../../shared/ipc/types';
import { agentService } from '../services/agents/agent-service';
import { buildFrozenDraft, freezeViaAgent, frozenSummary, proposeFrozenDraft } from '../services/flows/freeze-service';
// The freeze reads the registry STORE; this import registers every tool.
import '../services/agents/tools/registry';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('flows-handlers');

export async function handleFlowsFreeze(
  _event: IpcMainInvokeEvent,
  data: FlowsFreezeRequest,
): Promise<FlowsFreezeResponse> {
  try {
    if (!data.agentId || !data.sessionId || !data.artifactId) {
      return { success: false, error: 'Missing agent, session or artifact id' };
    }
    if (data.viaAgent && agentService.isRunning(data.sessionId)) {
      return { success: false, error: 'The session is still working — wait for it to finish, then freeze.' };
    }
    const outcome = await buildFrozenDraft(data.agentId, data.sessionId, data.artifactId);
    if (!outcome.ok) return { success: false, error: outcome.error };
    if (data.viaAgent) {
      freezeViaAgent(data.agentId, data.sessionId, data.artifactId, outcome.draft);
      return { success: true, doc: outcome.draft.doc, viaAgent: true };
    }
    const proposal = proposeFrozenDraft(data.agentId, data.sessionId, outcome.draft.doc, frozenSummary(outcome.draft));
    log.info('Session frozen into a proposal', {
      sessionId: data.sessionId,
      artifactId: data.artifactId,
      nodes: outcome.draft.doc.graph.nodes.length,
      params: outcome.draft.doc.params.length,
      notes: outcome.draft.notes,
    });
    return { success: true, doc: outcome.draft.doc, proposalId: proposal.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn('Could not freeze the session', { error: message });
    return { success: false, error: message || 'Could not freeze the session' };
  }
}

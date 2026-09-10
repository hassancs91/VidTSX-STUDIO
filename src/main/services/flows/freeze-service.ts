// The freeze, wired to the real session (flows plan §1.5, W8 Stage 5): load
// the agent, the session record, its artifacts and its call log, run the
// pure `freezeSessionToFlow`, then either queue the draft as a proposal for
// the canvas ("Frozen from session …") or hand it to the session's agent
// for one turn with `save_flow`. The IPC handler and the
// `freeze_session_to_flow` tool both come here.

import type { AgentArtifact } from '../../../shared/types/agents';
import type { FlowDoc, FlowProposal } from '../../../shared/types/flows';
import { agentService } from '../agents/agent-service';
import { readToolCallLog } from '../agents/tool-call-log';
import { getNode } from '../agents/tools/registry-core';
import { ensureLibraryRoot, resolveLibraryPath } from '../library/library-paths';
import { addFlowProposal, dropFlowProposal } from './flow-proposals';
import { freezeSessionToFlow, type FreezeSessionResult } from './freeze-session';
import { setFrozenDraft } from './freeze-drafts';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('FlowFreeze');

export interface FrozenSessionDraft {
  doc: FlowDoc;
  notes: string[];
  sessionTitle: string;
  agentName: string;
}

export type FreezeOutcome = { ok: true; draft: FrozenSessionDraft } | { ok: false; error: string };

/** The draft for one session and artifact, or the typed reason there is none. */
export async function buildFrozenDraft(agentId: string, sessionId: string, artifactId: string): Promise<FreezeOutcome> {
  const agent = await agentService.findAgent(agentId);
  if (!agent) return { ok: false, error: `Agent "${agentId}" is not installed.` };
  const libraryRoot = await ensureLibraryRoot();
  const externalPath = (artifact: AgentArtifact): string | null => {
    const relPath =
      artifact.kind === 'image-set' ? artifact.payload.items[0]?.relPath
        : artifact.kind === 'video' ? artifact.payload.relPath
          : undefined;
    return relPath ? resolveLibraryPath(libraryRoot, relPath) : null;
  };
  return agentService.withSession(agentId, sessionId, async (ctx) => {
    const calls = await readToolCallLog(agentId, sessionId);
    const result: FreezeSessionResult = freezeSessionToFlow({
      session: ctx.session,
      agentName: agent.manifest.name,
      ...(agent.manifest.starter ? { starterTree: agent.manifest.starter } : {}),
      artifacts: ctx.store.list(),
      calls: calls.calls,
      replies: calls.replies,
      artifactId,
      registry: { getNode },
      externalPath,
    });
    if (!result.ok) return result;
    return { ok: true, draft: { doc: result.doc, notes: result.notes, sessionTitle: ctx.session.title, agentName: agent.manifest.name } };
  });
}

/** Queue the draft as the session's proposal card and put it on the run stream. */
export function proposeFrozenDraft(agentId: string, sessionId: string, doc: FlowDoc, summary: string): FlowProposal {
  dropFlowProposal(sessionId);
  const proposal = addFlowProposal({ agentId, sessionId, flowId: null, doc, summary, source: 'frozen' });
  agentService.publish({ sessionId, kind: 'flow-proposal', proposal });
  return proposal;
}

export function frozenSummary(draft: Pick<FrozenSessionDraft, 'sessionTitle' | 'agentName' | 'doc'>): string {
  const steps = draft.doc.graph.nodes.length;
  const params = draft.doc.params.length;
  return `Frozen from the ${draft.agentName} session "${draft.sessionTitle}" — ${steps} step${steps === 1 ? '' : 's'}, ${params} param${params === 1 ? '' : 's'}. Accept to save it as a flow.`;
}

/** What the agent is told about a draft it must name (the `save_flow` turn). */
export function describeDraftForAgent(doc: FlowDoc): string {
  const lines: string[] = [];
  for (const node of doc.graph.nodes) {
    const config = Object.entries(node.config)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([k, v]) => `${k}=${JSON.stringify(typeof v === 'string' && v.length > 120 ? `${v.slice(0, 120)}…` : v)}`)
      .join(', ');
    lines.push(`- ${node.id} (${node.toolId})${node.pause ? ' [pauses]' : ''}: ${config || 'no config'}`);
  }
  const edges = doc.graph.edges.map((e) => `${e.source}.${e.sourceHandle} -> ${e.target}.${e.targetHandle}`);
  const params = doc.params.map((p) => `${p.id} "${p.label}" (${p.kind}) -> ${p.bind.map((b) => `${b.nodeId}.${b.key}`).join(', ')}`);
  return [
    `Draft flow "${doc.name}": ${doc.description}`,
    'Steps:', ...lines,
    `Edges: ${edges.join('; ') || 'none'}`,
    `Params already detected: ${params.join('; ') || 'none'}`,
    `Output: ${doc.outputs.map((o) => `${o.nodeId}.${o.handle}`).join(', ')}`,
  ].join('\n');
}

/**
 * The agent path (§1.5 step 4): stash the draft, give the session's agent one
 * turn with it in context and `save_flow` on the server. The proposal arrives
 * as a `flow-proposal` event when the agent calls the tool; a refusal or a
 * turn that never calls it leaves the draft stashed for a retry.
 */
export function freezeViaAgent(agentId: string, sessionId: string, artifactId: string, draft: FrozenSessionDraft): void {
  setFrozenDraft({ agentId, sessionId, artifactId, doc: draft.doc });
  const prompt =
    `[Freeze into a flow] The winning path of this session up to artifact ${artifactId} was extracted as a draft flow:\n\n` +
    `${describeDraftForAgent(draft.doc)}\n\n` +
    'Call save_flow ONCE: give it a short name and a one-line description, relabel the detected params if their labels read badly, ' +
    'and expose as params only the node config keys a person would change on every run (the things that vary — a brief, a topic, a count), ' +
    'leaving style, size and model settings locked. You cannot add, remove or rewire steps. End your turn right after the call.';
  void agentService
    .send({ agentId, sessionId, prompt, extraTools: ['save_flow'] })
    .then((result) => {
      if (!result.success) log.warn('The freeze turn failed', { sessionId, error: result.error });
    })
    .catch((err) => log.warn('The freeze turn threw', { sessionId, error: err instanceof Error ? err.message : String(err) }));
}

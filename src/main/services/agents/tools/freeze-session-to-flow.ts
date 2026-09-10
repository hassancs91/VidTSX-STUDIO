// `freeze_session_to_flow` — the agent freezes its own session when asked
// (flows plan §1.5, W8 Stage 5). The draft comes from the same lineage walk
// the action bar uses; the tool stashes it and tells the model to name it
// with `save_flow`, which is what puts it on the canvas. Agent-only, no
// ports, needs nothing.
//
// The freeze service reaches the agent service, which owns the runner that
// registers this tool — so it is imported lazily, the way `run_agent` does.

import { z } from 'zod';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const schema = {
  artifactId: z.string().describe('The artifact the flow should end on — usually the finished video or image.'),
};

interface FreezeArgs {
  artifactId: string;
}

export const freezeSessionToFlowTool: AgentToolDef<FreezeArgs> = {
  id: 'freeze_session_to_flow',
  description:
    'Extract the steps that produced an artifact of this session into a draft flow (the winning path only — dead ends and retries are left out). Then call save_flow to name it and choose its params; the user reviews the result on the Flows canvas. Use it when the user asks to turn this session, or what made an artifact, into a reusable flow.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    ctx.emitProgress(args.artifactId);
    const { buildFrozenDraft, describeDraftForAgent } = await import('../../flows/freeze-service');
    const { setFrozenDraft } = await import('../../flows/freeze-drafts');
    const outcome = await buildFrozenDraft(ctx.agentId, ctx.sessionId, args.artifactId);
    if (!outcome.ok) return toolText(`This session cannot be frozen: ${outcome.error}`, true);
    setFrozenDraft({ agentId: ctx.agentId, sessionId: ctx.sessionId, artifactId: args.artifactId, doc: outcome.draft.doc });
    return toolText(
      `${describeDraftForAgent(outcome.draft.doc)}\n\n` +
        (outcome.draft.notes.length > 0 ? `Notes: ${outcome.draft.notes.join(' ')}\n\n` : '') +
        'Now call save_flow once with a name, a one-line description, and the config keys to expose as params (only what changes per run). Then end your turn.',
    );
  },
};

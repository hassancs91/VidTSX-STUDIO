// `propose_memory` — the agent asks to remember something (agents plan §1.10).
//
// NOTHING ENTERS MEMORY THAT THE USER DID NOT SEE AND ACCEPT
// (AGENT_MEMORY_DESIGN M2). This tool only ever QUEUES a card; the write
// happens on accept, in the IPC handler, with the scope the user chose there.
// The tool cannot choose the scope and is not told what was chosen — it learns
// the outcome the way it learns everything else, from the user's next message.
//
// An agent gets this tool only when its manifest declares `memory.propose`;
// agents that do not declare it still READ the memory block, which is the
// read-side/write-side split §1.10 describes.

import { z } from 'zod';
import { MEMORY_TEXT_LIMITS } from '../../../../shared/types/studio-memory';
import { listMemories } from '../../studio/agent-memory';
import { addAgentProposal, hasAgentProposal } from '../memory-proposals';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const schema = {
  kind: z
    .enum(['rule', 'vocabulary', 'profile'])
    .describe(
      'rule = a durable instruction; vocabulary = a name or spelling to get right; profile = a lasting fact about the user.',
    ),
  text: z
    .string()
    .describe(
      'The memory as you will read it back later: a rule is one imperative sentence; vocabulary is the CORRECT spelling; profile is a durable fact.',
    ),
  aliases: z
    .array(z.string())
    .optional()
    .describe('vocabulary only — the manglings this entry corrects.'),
};

interface ProposeMemoryArgs {
  kind: 'rule' | 'vocabulary' | 'profile';
  text: string;
  aliases?: string[];
}

export const proposeMemoryTool: AgentToolDef<ProposeMemoryArgs> = {
  id: 'propose_memory',
  description:
    'Propose ONE durable memory when the user states a GENERAL preference, not a one-off instruction. It is never applied directly: it becomes a card the user accepts, edits, or rejects, and they choose whether it applies to you alone or to every agent. Do not treat it as remembered until they say so, and propose at most one per turn.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    ctx.emitProgress(args.text.slice(0, 60));

    if (hasAgentProposal(ctx.agentId, ctx.sessionId)) {
      return toolText(
        "A memory proposal is already waiting for the user's decision. Do not propose another until they answer it.",
        true,
      );
    }

    const text = args.text.replace(/\s+/g, ' ').trim();
    if (!text) return toolText('A memory proposal needs text.', true);
    const limit = MEMORY_TEXT_LIMITS[args.kind];
    if (text.length > limit) {
      return toolText(`A ${args.kind} memory is limited to ${limit} characters — shorten it.`, true);
    }

    // The active set is already in the system prompt, but guard anyway: a
    // duplicate card is what teaches a user to reject without reading.
    const existing = await listMemories();
    const duplicate = existing.find(
      (m) =>
        m.active &&
        m.kind === args.kind &&
        m.text.toLowerCase() === text.toLowerCase() &&
        (m.agentId === undefined || m.agentId === ctx.agentId),
    );
    if (duplicate) {
      return toolText('That is already in the active memory set — do not propose it again.', true);
    }

    try {
      const proposal = addAgentProposal({
        agentId: ctx.agentId,
        sessionId: ctx.sessionId,
        kind: args.kind,
        text,
        ...(args.aliases ? { aliases: args.aliases } : {}),
      });
      ctx.emit({ sessionId: ctx.sessionId, kind: 'memory-proposal', proposal });
      return toolText(
        'Shown to the user as a card — they may accept it for you alone or for every agent, edit it, or reject it. Do not treat it as remembered yet, and do not propose another this turn.',
      );
    } catch (err) {
      return toolText(err instanceof Error ? err.message : String(err), true);
    }
  },
};

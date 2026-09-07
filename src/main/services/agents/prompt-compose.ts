// Composing an agent's system prompt (agents plan §1.2 step 3).
//
// THE SYSTEM PROMPT IS STATIC FOR THE WHOLE SESSION (decided 2026-09-06). The
// artifact list is never in it — the model learns what exists from tool results
// and from `list_artifacts` — so the cached prefix survives every turn. The one
// ordering rule that matters: memory goes LAST, because editing it must not
// rewrite the skill text out of the cached prefix (AGENT_MEMORY_DESIGN §Rev 2.5,
// the same reason `composeSystemPrompt` takes a trailing block).
//
// Pure. Reading AGENT.md and the skills is `agent-skills.ts` and the runner's
// job, which is what makes the order testable without a package on disk.

import type { StarterAnswers } from '../../../shared/types/agents';
import type { StarterTree } from '../../../shared/agents/starter';
import type { AgentSkill } from './agent-skills';

export interface ComposeAgentPromptInput {
  /** AGENT.md, verbatim. */
  promptBody: string;
  skills?: AgentSkill[];
  /** Fixed for the session; rendered as a labelled block, marked partial when
   *  the user skipped out of the starter. */
  starterAnswers?: StarterAnswers;
  starterTree?: StarterTree;
  /** Tool ids the manifest asked for whose provider is not configured (§1.8). */
  unavailableTools?: string[];
  /** True when the session's provider cannot run a tool loop at all. */
  toolsAvailable: boolean;
  /** Providers that DO support tools, named in the degraded notice. */
  toolCapableProviders?: string[];
  /** Trailing block. Stage 4 fills it from the memory store. */
  memoryBlock?: string;
}

function answerLabel(
  nodeId: string,
  answer: { ids?: string[]; text?: string },
  tree?: StarterTree,
): string {
  const node = tree?.nodes[nodeId];
  const labels = (answer.ids ?? [])
    .map((id) => {
      if (id === '$other') return answer.text ?? 'Other';
      if (node && 'options' in node) {
        return node.options.find((o) => o.id === id)?.label ?? id;
      }
      return id;
    })
    .filter((l) => l.length > 0);
  if (labels.length > 0) return labels.join(', ');
  return answer.text ?? '';
}

function starterBlock(answers: StarterAnswers, tree?: StarterTree): string | null {
  const lines: string[] = [];
  const total = tree ? Object.keys(tree.nodes).length : Object.keys(answers).length;
  for (const [nodeId, answer] of Object.entries(answers)) {
    const question = tree?.nodes[nodeId]?.question ?? nodeId;
    const value = answerLabel(nodeId, answer, tree);
    if (value) lines.push(`- ${question} ${value}`);
  }
  if (lines.length === 0) return null;
  const partial = tree && lines.length < total ? ' (partial — the user skipped ahead to chat)' : '';
  return `## Starter answers${partial}\n\n${lines.join('\n')}`;
}

function toolAvailabilityBlock(input: ComposeAgentPromptInput): string | null {
  if (!input.toolsAvailable) {
    const providers = input.toolCapableProviders?.length
      ? ` Tools work on: ${input.toolCapableProviders.join(', ')}.`
      : '';
    return `## Tool availability\n\nThis provider cannot run tools, so you have none for this session. Answer in words, and say plainly that you cannot make anything until the user switches provider.${providers}`;
  }
  if (input.unavailableTools?.length) {
    return `## Tool availability\n\nThese tools are declared but NOT usable in this session because the provider they need is not configured: ${input.unavailableTools.join(', ')}. Do not call them; tell the user what to configure if they ask for one.`;
  }
  return null;
}

/**
 * AGENT.md, then skills, then the starter answers, then tool availability,
 * then memory. Sections are joined the way `composeSystemPrompt` joins skills,
 * so an agent prompt reads like every other composed prompt in the app.
 */
export function composeAgentSystemPrompt(input: ComposeAgentPromptInput): string {
  const sections: string[] = [];
  for (const skill of input.skills ?? []) {
    sections.push(`## Skill: ${skill.name}\n\n${skill.body}`);
  }
  if (input.starterAnswers) {
    const block = starterBlock(input.starterAnswers, input.starterTree);
    if (block) sections.push(block);
  }
  const availability = toolAvailabilityBlock(input);
  if (availability) sections.push(availability);
  if (input.memoryBlock) sections.push(input.memoryBlock);

  const base = input.promptBody.trim();
  if (sections.length === 0) return base;
  return `${base}\n\n---\n\n${sections.join('\n\n')}`;
}

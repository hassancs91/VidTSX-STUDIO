// The starter tree as interaction cards (agents plan §1.9).
//
// §1.9 says the starter renders "through the same card" the agent's own
// `ask_user` uses, so the user never sees a seam between the questions the
// package ships and the questions the model thinks of. That is exactly what
// this file buys: one starter node becomes one `InteractionRequest`, and the
// shared registry renders it.
//
// PURE, and separate from `StarterFlow.tsx` for the same reason
// `interactions/values.ts` is separate from the cards: the renderer has no
// component test rig (vitest is node-only), so the half that decides what the
// user is asked and what their click MEANS is the half that must be testable.

import type {
  InteractionPayload,
  InteractionRequest,
  StarterAnswers,
} from '@shared/types/agents';
import type { InteractionValues } from '@renderer/components/interactions/types';
import {
  STARTER_END,
  STARTER_OTHER,
  isStarterTextNode,
  type StarterAnswer,
  type StarterNode,
  type StarterTree,
} from '@shared/agents/starter';

/**
 * Which card a node is showing. A select node with `allowOther` needs two: the
 * options themselves, then a text card for what the user typed instead.
 */
export type StarterPhase = 'node' | 'other';

export interface StarterStep {
  nodeId: string;
  phase: StarterPhase;
}

/** The "Other…" choice appended to a select card; `$other` is the stored id. */
const OTHER_CANDIDATE = {
  id: STARTER_OTHER,
  label: 'Something else…',
  detail: 'Type it on the next step',
} as const;

function payloadFor(nodeId: string, node: StarterNode, phase: StarterPhase): InteractionPayload {
  if (phase === 'other') {
    return {
      kind: 'form',
      title: node.question,
      fields: [{ id: STARTER_OTHER, label: 'In your own words', kind: 'text' }],
    };
  }
  if (isStarterTextNode(node)) {
    return {
      kind: 'form',
      title: node.question,
      fields: [
        {
          id: nodeId,
          label: 'Your answer',
          kind: node.multiline ? 'multiline' : 'text',
          ...(node.hint ? { placeholder: node.hint } : {}),
        },
      ],
    };
  }
  return {
    kind: 'pick',
    title: node.question,
    select: node.select,
    candidates: [
      ...node.options.map((option) => ({ id: option.id, label: option.label })),
      ...(node.allowOther ? [OTHER_CANDIDATE] : []),
    ],
  };
}

/**
 * The request one step renders. `sessionId` is empty on purpose: the starter
 * runs BEFORE the session exists (that is the whole point — a session is only
 * created once there is something to put in it), and no card reads the field.
 */
export function starterRequest(
  nodeId: string,
  node: StarterNode,
  phase: StarterPhase,
): InteractionRequest {
  return {
    id: `starter:${nodeId}:${phase}`,
    sessionId: '',
    callId: 'starter',
    createdAt: new Date(0).toISOString(),
    payload: payloadFor(nodeId, node, phase),
  };
}

/** What the card shows when the user comes BACK to a step they answered. */
export function starterInitialValues(
  nodeId: string,
  node: StarterNode,
  phase: StarterPhase,
  answer: StarterAnswer | undefined,
): InteractionValues | undefined {
  if (!answer) return undefined;
  if (phase === 'other') {
    return answer.text ? { [STARTER_OTHER]: [answer.text] } : undefined;
  }
  if (isStarterTextNode(node)) {
    return answer.text ? { [nodeId]: [answer.text] } : undefined;
  }
  if (!answer.ids?.length) return undefined;
  const values: InteractionValues = {};
  for (const id of answer.ids) {
    const label = isStarterTextNode(node)
      ? id
      : (node.options.find((o) => o.id === id)?.label ?? id);
    values[id] = [label];
  }
  return values;
}

/**
 * The card's reply as a stored answer. `pick` keys its values by the candidate
 * id, which IS the option id, so the ids fall straight out of the keys; a text
 * card carries one field whose value is the typed answer.
 */
export function starterAnswerFrom(
  nodeId: string,
  node: StarterNode,
  phase: StarterPhase,
  values: InteractionValues,
  prior: StarterAnswer | undefined,
): StarterAnswer {
  if (phase === 'other') {
    const typed = values[STARTER_OTHER]?.[0];
    return { ids: [STARTER_OTHER], ...(typed ? { text: typed } : {}) };
  }
  if (isStarterTextNode(node)) {
    const text = values[nodeId]?.[0];
    return text ? { text } : {};
  }
  const ids = Object.keys(values);
  // A re-answer that is no longer "Other…" must not keep the old typed text
  // around, or the opening template would render words the user replaced.
  const keepText = ids.includes(STARTER_OTHER) && prior?.text ? { text: prior.text } : {};
  return { ids, ...keepText };
}

/** True when answering this card leads to the typed follow-up rather than on. */
export function needsOtherStep(node: StarterNode, phase: StarterPhase, answer: StarterAnswer): boolean {
  if (phase !== 'node' || isStarterTextNode(node)) return false;
  return node.allowOther === true && (answer.ids ?? []).includes(STARTER_OTHER);
}

/**
 * How many steps are left, counting this one — the longest path to `$end`, so
 * on a branching tree it reads as "at most". The validator has already proven
 * the tree is a DAG that reaches `$end`, so this terminates.
 */
export function stepsRemaining(tree: StarterTree, nodeId: string): number {
  const depth = new Map<string, number>();
  const walk = (id: string): number => {
    const seen = depth.get(id);
    if (seen !== undefined) return seen;
    const node = tree.nodes[id];
    if (!node) return 0;
    depth.set(id, 1); // guards a malformed tree that slipped past validation
    const targets = isStarterTextNode(node)
      ? [node.next]
      : [
          ...node.options.map((o) => o.next),
          ...(node.next ? [node.next] : []),
          ...(node.allowOther ? [node.otherNext ?? node.next ?? STARTER_END] : []),
        ];
    let best = 1;
    for (const target of targets) {
      if (target === STARTER_END || !(target in tree.nodes)) continue;
      best = Math.max(best, 1 + walk(target));
    }
    depth.set(id, best);
    return best;
  };
  return walk(nodeId);
}

/**
 * A name for the session the answers are about to create. It matters more than
 * a label: §1.11 fixes the library folder from the title AT CREATION and never
 * moves it afterwards, so without this every starter session would file its
 * media into `agents/<agent>/new-session` together.
 *
 * The longest thing the user actually TYPED is the most recognisable name they
 * could be given; option labels are the same three words on every session.
 */
export function starterTitle(answers: StarterAnswers): string | undefined {
  const typed = Object.values(answers)
    .map((a) => (a.text ?? '').trim())
    .filter((t) => t.length > 0)
    .sort((a, b) => b.length - a.length)[0];
  if (!typed) return undefined;
  const clean = typed.replace(/\s+/g, ' ');
  return clean.length > 60 ? `${clean.slice(0, 57).trimEnd()}…` : clean;
}

/** Answers with nothing in them at all — nothing worth storing on the session. */
export function isEmptyStarterAnswers(answers: StarterAnswers): boolean {
  return Object.values(answers).every((a) => !a.ids?.length && !(a.text ?? '').trim());
}

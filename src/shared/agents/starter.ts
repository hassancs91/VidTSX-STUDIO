// Starters — the guided, branching first questions an agent package ships
// (agents plan §1.9). Types, the install-time validator, the walker and the
// `opening` template renderer (§7 names all four).
//
// A starter runs entirely in the renderer: no provider, no tokens, offline.
// There is no expression language — branching is only `next` per option — so
// the whole thing is checkable statically, which is what this file does.

/** Terminal `next` target: the tree is finished. */
export const STARTER_END = '$end';

/** The answer id stored when the user picks the appended "Other…" choice. */
export const STARTER_OTHER = '$other';

export const STARTER_LIMITS = {
  maxNodes: 12,
  maxOptions: 8,
  maxQuickStarts: 8,
} as const;

/** Node ids share the agent-id segment grammar. */
export const STARTER_NODE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface StarterOption {
  id: string;
  label: string;
  /** A node id, or `$end`. */
  next: string;
}

export interface StarterSelectNode {
  question: string;
  hint?: string;
  select: 'one' | 'many';
  options: StarterOption[];
  /** Appends an "Other…" choice with a text field. */
  allowOther?: boolean;
  /** Where the "Other…" path goes; falls back to the node's own `next`. */
  otherNext?: string;
  /** Required for `select: "many"`, which has no per-option branch. */
  next?: string;
}

export interface StarterTextNode {
  question: string;
  hint?: string;
  text: true;
  multiline?: boolean;
  next: string;
}

export type StarterNode = StarterSelectNode | StarterTextNode;

export interface StarterTree {
  entry: string;
  nodes: Record<string, StarterNode>;
  /** Template over the answers; `{{nodeId}}` resolves to a label or text. */
  opening: string;
  /** One-click sample prompts on an empty session. */
  quickStarts?: string[];
}

export function isStarterTextNode(node: StarterNode): node is StarterTextNode {
  return (node as StarterTextNode).text === true;
}

/** Every `next` a node can produce, including the "Other…" branch. */
function outgoing(node: StarterNode): string[] {
  if (isStarterTextNode(node)) return [node.next];
  const targets = node.options.map((option) => option.next);
  if (node.next) targets.push(node.next);
  if (node.allowOther) targets.push(node.otherNext ?? node.next ?? STARTER_END);
  return targets;
}

/**
 * Install-time validation (§1.9): node id grammar, size caps, every `next`
 * resolves, no cycles, `$end` reachable from `entry`, and every `{{ref}}` in
 * `opening` names a node. Returns human-readable problems; empty means valid.
 */
export function validateStarter(tree: StarterTree): string[] {
  const errors: string[] = [];
  const ids = Object.keys(tree.nodes);

  if (ids.length === 0) {
    return ['starter.nodes is empty'];
  }
  if (ids.length > STARTER_LIMITS.maxNodes) {
    errors.push(`starter has ${ids.length} nodes (max ${STARTER_LIMITS.maxNodes})`);
  }
  if ((tree.quickStarts?.length ?? 0) > STARTER_LIMITS.maxQuickStarts) {
    errors.push(`starter.quickStarts has too many entries (max ${STARTER_LIMITS.maxQuickStarts})`);
  }

  for (const id of ids) {
    if (!STARTER_NODE_ID_RE.test(id)) {
      errors.push(`starter node id "${id}" must match [a-z0-9-]`);
    }
    const node = tree.nodes[id];
    if (isStarterTextNode(node)) continue;
    if (node.options.length === 0) {
      errors.push(`starter node "${id}" has no options`);
    }
    if (node.options.length > STARTER_LIMITS.maxOptions) {
      errors.push(
        `starter node "${id}" has ${node.options.length} options (max ${STARTER_LIMITS.maxOptions})`,
      );
    }
    const seen = new Set<string>();
    for (const option of node.options) {
      if (seen.has(option.id)) errors.push(`starter node "${id}" repeats option id "${option.id}"`);
      seen.add(option.id);
    }
    if (node.select === 'many' && !node.next) {
      errors.push(`starter node "${id}" is select:"many" and needs a node-level next`);
    }
  }

  if (!(tree.entry in tree.nodes)) {
    errors.push(`starter.entry "${tree.entry}" is not a node`);
    return errors;
  }

  for (const id of ids) {
    for (const target of outgoing(tree.nodes[id])) {
      if (target !== STARTER_END && !(target in tree.nodes)) {
        errors.push(`starter node "${id}" points at unknown node "${target}"`);
      }
    }
  }
  if (errors.some((e) => e.includes('unknown node'))) return errors;

  // Cycles and $end reachability in one walk. `visiting` is the current path,
  // so a re-entered node on that path is a cycle; `done` memoizes.
  const visiting = new Set<string>();
  const done = new Set<string>();
  let reachesEnd = false;
  const walk = (id: string): void => {
    if (visiting.has(id)) {
      errors.push(`starter has a cycle through node "${id}"`);
      return;
    }
    if (done.has(id)) return;
    visiting.add(id);
    for (const target of outgoing(tree.nodes[id])) {
      if (target === STARTER_END) reachesEnd = true;
      else walk(target);
    }
    visiting.delete(id);
    done.add(id);
  };
  walk(tree.entry);
  if (!reachesEnd && !errors.some((e) => e.includes('cycle'))) {
    errors.push(`starter never reaches ${STARTER_END} from "${tree.entry}"`);
  }

  // Unreachable nodes are dead weight the author almost certainly did not
  // mean to ship, and they hide typos.
  for (const id of ids) {
    if (!done.has(id)) errors.push(`starter node "${id}" is unreachable from "${tree.entry}"`);
  }

  for (const ref of tree.opening.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)) {
    if (!(ref[1] in tree.nodes)) {
      errors.push(`starter.opening references "{{${ref[1]}}}", which is not a node`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// The walker (§7) — pure, so the renderer can run a starter with no provider,
// no tokens and no IPC. `validateStarter` above has already proven the tree is
// a DAG that reaches `$end`, so nothing here has to guard against a cycle; it
// guards only against answers, which come from a user and can be anything.
// ---------------------------------------------------------------------------

/** One node's answer, as it is stored on `AgentSession.starter`. */
export interface StarterAnswer {
  /** Option ids for a select node; `$other` when the user typed instead. */
  ids?: string[];
  /** The typed text — a text node's answer, or the "Other…" field. */
  text?: string;
}

/**
 * Where the tree goes after `nodeId`, given what the user answered there.
 * Returns `$end` when the starter is finished, or `null` when the node id is
 * not in the tree (a session whose agent was updated under it).
 *
 * `select: "many"` and text nodes have no per-option branch — they use the
 * node's own `next`, which the validator requires them to carry.
 */
export function nextNode(
  tree: StarterTree,
  nodeId: string,
  answer: StarterAnswer,
): string | null {
  const node = tree.nodes[nodeId];
  if (!node) return null;
  if (isStarterTextNode(node)) return node.next;
  if (node.select === 'many') return node.next ?? STARTER_END;

  const chosen = answer.ids?.[0];
  if (chosen === STARTER_OTHER) return node.otherNext ?? node.next ?? STARTER_END;
  const option = node.options.find((o) => o.id === chosen);
  // An unanswered or unrecognised choice falls through to the node's own next
  // rather than dead-ending: "Skip and chat" leaves exactly this state.
  return option?.next ?? node.next ?? STARTER_END;
}

/** The words one answer contributes to a template — a label, or what was typed. */
function answerText(node: StarterNode | undefined, answer: StarterAnswer): string {
  if (!node || isStarterTextNode(node)) return (answer.text ?? '').trim();
  const labels = (answer.ids ?? [])
    .map((id) =>
      id === STARTER_OTHER
        ? (answer.text ?? '').trim()
        : (node.options.find((o) => o.id === id)?.label ?? ''),
    )
    .filter((label) => label.length > 0);
  if (labels.length > 0) return labels.join(', ');
  return (answer.text ?? '').trim();
}

/**
 * `opening` with every `{{nodeId}}` filled in (§1.9). The result becomes the
 * PREFILLED first message in the chat box, never an auto-send, so the user
 * sees exactly what the starter produced and can edit it.
 *
 * Partial answers are the normal case, not an error: every step offers "Skip
 * and chat". An unanswered reference renders as nothing and the surrounding
 * whitespace collapses, so a half-filled template still reads as a sentence
 * rather than showing `{{brief}}` to the user.
 */
export function renderOpening(tree: StarterTree, answers: Record<string, StarterAnswer>): string {
  const filled = tree.opening.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_match, ref: string) => {
    const answer = answers[ref];
    return answer ? answerText(tree.nodes[ref], answer) : '';
  });
  return filled
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.:;!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

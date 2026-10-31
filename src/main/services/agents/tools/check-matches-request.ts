// `check_matches_request` — the verification gate (DECISION_MODELS_DESIGN.md §10.2): `decide` with a fixed instruction, so a flow author
// writes no prompt. Ruling D-r16 (b): the request is framed EXACTLY as D1 measured T3 (Jev 40 / 40, MSD1 40 / 40) — `state` = D1's T3 rule
// verbatim, ONE `noul` question whose instructions carry the item and the request the way D1's T3 rows do, D1's T3 criteria
// (`K1\hosted-run.cjs` `NOUL_T3`); family `verify`. The benchmark test feeds D1's 40 rows and asserts the bodies equal D1's.

import { z } from 'zod';
import type { AgentToolDef, AgentToolResult } from './types';
import { DECIDE_COMMON_DEFAULTS, DECIDE_COMMON_FIELDS, DECIDE_OUTPUTS, decideCommonSchema, runDecision, type DecideCommonArgs } from './decide-run';

/** D1's T3 rule (`t3-verify.json` `instruction`), verbatim. */
export const CHECK_MATCHES_STATE =
  "You check a video editor's assistant's work. Answer yes only if the item really does what the request or script line asks, by plain " +
  'meaning; a loosely related or merely similar item is NOT a match.';

/** D1's T3 criteria (`NOUL_T3`), verbatim. */
export const CHECK_MATCHES_CRITERIA = {
  true: 'Yes: the item really does what the request or script line asks, by plain meaning.',
  false: 'No: the item does something else, or is only loosely related / merely similar.',
};

const ITEM_KINDS = ['item', 'template', 'caption', 'clip'] as const;
type ItemKind = (typeof ITEM_KINDS)[number];

/** D1's T3 question headers per item kind, and what the request line is called; `item` is the same family for anything else. */
const FRAMES: Record<ItemKind, { ask: string; label: string }> = {
  item: { ask: 'Does this item do what the request asks?', label: 'Request' },
  template: { ask: 'Does this video template do what the request asks?', label: 'Request' },
  caption: { ask: 'Does this caption style match the request?', label: 'Request' },
  clip: { ask: 'Is this library clip the sound the script line describes?', label: 'Script line' },
};

/** D1's T3 `question`: the header, the item, then the request quoted as JSON. */
export function checkMatchesQuestion(kind: ItemKind, item: string, request: string): string {
  const frame = FRAMES[kind];
  return `${frame.ask}\n${item}\n${frame.label}: ${JSON.stringify(request)}`;
}

const schema = {
  item: z.string().min(1).describe('What the item is or does — a template, caption style or clip description.'),
  request: z.string().min(1).describe('What the user asked for (or the script line the item must fit).'),
  itemKind: z.enum(ITEM_KINDS).optional().describe('template, caption (a caption style), clip (a library sound) or item (default).'),
  ...decideCommonSchema,
};

interface CheckMatchesArgs extends DecideCommonArgs {
  item: string;
  request: string;
  itemKind?: ItemKind;
}

export const checkMatchesRequestTool: AgentToolDef<CheckMatchesArgs> = {
  id: 'check_matches_request',
  description:
    'Check whether an item (a template, a caption style, a library clip) really does what a request asks, by plain meaning. The reply ' +
    'is yes or no and a band. act: go ahead with the answer. escalate: the answer is uncertain — do not use the item on this answer; ' +
    'ask the user or gather more evidence first. The answer is a gate, not a fact.',
  schema,
  ports: {
    label: 'Check Matches Request',
    category: 'text',
    inputs: [
      { id: 'item', label: 'Item description', dataType: 'text', required: true, argKey: 'item' },
      { id: 'request', label: 'Request', dataType: 'text', required: true, argKey: 'request' },
    ],
    outputs: DECIDE_OUTPUTS,
    configSchema: [
      {
        kind: 'select',
        key: 'itemKind',
        label: 'The item is a',
        options: [
          { value: 'item', label: 'Item (anything)' },
          { value: 'template', label: 'Video template' },
          { value: 'caption', label: 'Caption style' },
          { value: 'clip', label: 'Library clip (a sound for a script line)' },
        ],
      },
      ...DECIDE_COMMON_FIELDS,
    ],
    defaultConfig: { itemKind: 'item', ...DECIDE_COMMON_DEFAULTS },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    return runDecision(
      {
        state: CHECK_MATCHES_STATE,
        question: {
          type: 'noul',
          instructions: checkMatchesQuestion(args.itemKind ?? 'item', args.item, args.request),
          criteria: { ...CHECK_MATCHES_CRITERIA },
        },
        family: 'verify',
        threshold: args.threshold,
        provider: args.provider,
        allowUncalibrated: args.allowUncalibrated,
      },
      ctx,
    );
  },
};

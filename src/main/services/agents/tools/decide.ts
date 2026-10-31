// `decide` — one typed question about a state, answered by a decision model (DECISION_MODELS_DESIGN.md §10.1, §11). An agent tool and,
// through `ports`, a flow node. It sends what its caller frames (ruling D-r16 (d)): the state, ONE `noul` (yes / no) or `choice` question,
// the family the caller declares (`calibrated` is earned per family — `other`, the default, never is). The agent reads the answer and the
// band only — "Decision: billing (act)" / "Decision: uncertain — top answer billing (escalate)"; the number stays in the run record (§1).
// Not a Studio assistant tool in slice 1 (§13).

import { z } from 'zod';
import type { DecisionQuestion, DecisionTaskFamily } from '../../../../shared/types/decisions';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import {
  DECIDE_COMMON_DEFAULTS,
  DECIDE_COMMON_FIELDS,
  DECIDE_OUTPUTS,
  TOO_FEW_OPTIONS,
  decideCommonSchema,
  parseDecisionOptions,
  runDecision,
  type DecideCommonArgs,
} from './decide-run';

const TYPES = ['choice', 'noul'] as const;
const FAMILIES = ['other', 'routing', 'verify'] as const;

const schema = {
  state: z.string().min(1).describe('The evidence the question is about (text).'),
  type: z.enum(TYPES).describe('noul = a yes / no question; choice = pick ONE option id from `options`.'),
  instructions: z.string().min(1).describe('The question, e.g. "Which team must handle this message?"'),
  options: z
    .union([z.record(z.string(), z.string()), z.string()])
    .optional()
    .describe('choice only: option id → what it means (or one `id: description` per line). At least two.'),
  family: z
    .enum(FAMILIES)
    .optional()
    .describe('routing (send a request to one handler) or verify (does an item do what was asked); other (default) is never calibrated.'),
  ...decideCommonSchema,
};

interface DecideArgs extends DecideCommonArgs {
  state: string;
  type: (typeof TYPES)[number];
  instructions: string;
  options?: Record<string, string> | string;
  family?: DecisionTaskFamily;
}

export const decideTool: AgentToolDef<DecideArgs> = {
  id: 'decide',
  description:
    'Ask a decision model ONE typed question about a state: noul (yes / no) or choice (one option id from `options`). The reply is the ' +
    'answer and a band. act: go ahead with the answer. escalate: the answer is uncertain — do not act on it; ask the user or gather more ' +
    'evidence first. The answer is a gate, not a fact: never tell the user it is a fact. Set `family` to routing or verify when the ' +
    'question is one of those; other answers never act unless `allowUncalibrated` is on.',
  schema,
  ports: {
    label: 'Decide',
    category: 'text',
    inputs: [{ id: 'state', label: 'State', dataType: 'text', required: true, argKey: 'state' }],
    outputs: DECIDE_OUTPUTS,
    configSchema: [
      {
        kind: 'select',
        key: 'type',
        label: 'Question type',
        options: [
          { value: 'choice', label: 'Choice — one of the options' },
          { value: 'noul', label: 'Yes / no' },
        ],
      },
      { kind: 'prompt', key: 'instructions', label: 'Question', placeholder: 'Which team must handle this message?', rows: 2 },
      {
        kind: 'prompt',
        key: 'options',
        label: 'Options (choice) — one `id: description` per line',
        placeholder: 'billing: a payment or invoice question\nsupport: a bug or a crash',
        rows: 4,
      },
      ...DECIDE_COMMON_FIELDS.slice(0, 2),
      {
        kind: 'select',
        key: 'family',
        label: 'Task family',
        options: [
          { value: 'other', label: 'Other — never calibrated' },
          { value: 'routing', label: 'Routing — one handler for a request' },
          { value: 'verify', label: 'Verify — does it do what was asked' },
        ],
      },
      ...DECIDE_COMMON_FIELDS.slice(2),
    ],
    // No empty `instructions` default: it must survive the schema (registry.test.ts) — an unset question fails at run, as it should.
    defaultConfig: { type: 'choice', options: '', family: 'other', ...DECIDE_COMMON_DEFAULTS },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    let question: DecisionQuestion;
    if (args.type === 'choice') {
      const criteria = parseDecisionOptions(args.options);
      if (!criteria) return toolText(TOO_FEW_OPTIONS, true);
      question = { type: 'choice', instructions: args.instructions, criteria };
    } else {
      question = { type: 'noul', instructions: args.instructions };
    }
    return runDecision(
      {
        state: args.state,
        question,
        family: args.family ?? 'other',
        threshold: args.threshold,
        provider: args.provider,
        allowUncalibrated: args.allowUncalibrated,
      },
      ctx,
    );
  },
};

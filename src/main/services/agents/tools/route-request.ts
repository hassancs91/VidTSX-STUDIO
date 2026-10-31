// `route_request` — the routing gate (DECISION_MODELS_DESIGN.md §10.2): `decide` with a fixed instruction over the caller's options, so a
// flow author writes no prompt. Ruling D-r16 (b): framed as D1 measured T2 (Jev 40 / 40, MSD1 40 / 40) — `state` = the routing rule (the
// optional `rule`; by default a generic rule naming the caller's options), ONE `choice` question "Which ONE <subject> must act on this
// request? Request: <JSON>" (`K1\hosted-run.cjs:50-54`; the subject defaults to D1's "tool family"), the options as criteria; family
// `routing`. The benchmark test passes D1's T2 rule + families and asserts the bodies equal D1's.

import { z } from 'zod';
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

/** D1's word for what the options are (T2: the Studio assistant's tool families). */
export const DEFAULT_ROUTE_SUBJECT = 'tool family';

/** The default rule, shaped like D1's T2 rule: "… to the ONE <subject> that must act on it: a (…), b (…), or c (…)." */
export function defaultRoutingRule(subject: string, options: Record<string, string>): string {
  const named = Object.entries(options).map(([id, description]) => `${id} (${description})`);
  const list = named.length > 1 ? `${named.slice(0, -1).join(', ')}, or ${named[named.length - 1]}` : named.join('');
  return `You route a request to the ONE ${subject} that must act on it: ${list}.`;
}

/** D1's T2 question, with the subject named. */
export function routeQuestion(subject: string, request: string): string {
  return `Which ONE ${subject} must act on this request? Request: ${JSON.stringify(request)}`;
}

const schema = {
  request: z.string().min(1).describe('The request to route, as the user typed it.'),
  options: z
    .union([z.record(z.string(), z.string()), z.string()])
    .describe('Where it can go: option id → what that option handles (or one `id: description` per line). At least two.'),
  rule: z.string().optional().describe('The routing rule sent as the state; absent = a generic rule naming the options.'),
  subject: z.string().optional().describe('What the options are, e.g. "team" (default "tool family").'),
  ...decideCommonSchema,
};

interface RouteRequestArgs extends DecideCommonArgs {
  request: string;
  options: Record<string, string> | string;
  rule?: string;
  subject?: string;
}

export const routeRequestTool: AgentToolDef<RouteRequestArgs> = {
  id: 'route_request',
  description:
    'Route a request to the ONE option that must act on it (option id → what it handles). The reply is the option id and a band. act: ' +
    'route it there. escalate: the answer is uncertain — do not route on it; ask the user or gather more evidence first. The answer is a ' +
    'gate, not a fact.',
  schema,
  ports: {
    label: 'Route Request',
    category: 'text',
    inputs: [{ id: 'request', label: 'Request', dataType: 'text', required: true, argKey: 'request' }],
    outputs: DECIDE_OUTPUTS,
    configSchema: [
      {
        kind: 'prompt',
        key: 'options',
        label: 'Options — one `id: description` per line',
        placeholder: 'captions: subtitles on / off / style\nexport: render the finished file',
        rows: 4,
      },
      { kind: 'text', key: 'subject', label: 'The options are (e.g. team)', placeholder: DEFAULT_ROUTE_SUBJECT },
      { kind: 'prompt', key: 'rule', label: 'Routing rule (optional)', placeholder: 'You route a request to …', rows: 3 },
      ...DECIDE_COMMON_FIELDS,
    ],
    defaultConfig: { options: '', subject: '', rule: '', ...DECIDE_COMMON_DEFAULTS },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    const criteria = parseDecisionOptions(args.options);
    if (!criteria) return toolText(TOO_FEW_OPTIONS, true);
    const subject = args.subject?.trim() || DEFAULT_ROUTE_SUBJECT;
    return runDecision(
      {
        // A given rule goes out verbatim (D-r16: D1's T2 rule is passed as is); a blank one → the generic rule.
        state: args.rule && args.rule.trim() ? args.rule : defaultRoutingRule(subject, criteria),
        question: { type: 'choice', instructions: routeQuestion(subject, args.request), criteria },
        family: 'routing',
        threshold: args.threshold,
        provider: args.provider,
        allowUncalibrated: args.allowUncalibrated,
      },
      ctx,
    );
  },
};

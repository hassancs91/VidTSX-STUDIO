// The one call path of the three decision tools (`decide`, `check_matches_request`, `route_request` — DECISION_MODELS_DESIGN.md §10.1–10.2,
// §11): build ONE keyed question over the caller's state, ask the decisions RUNTIME (never the engine — part (c)'s first-use start, settings,
// usage log), and turn the answer into the band + the agent text + the fields the flow runner maps onto ports (`p` lands in the run record
// only). Also the schema pieces and inspector fields the three share.

import { z } from 'zod';
import type { DecisionProviderChoice, DecisionQuestion, DecisionTaskFamily } from '../../../../shared/types/decisions';
import type { AiFeatureSource } from '../../../../shared/types/ai-usage';
import type { ConfigField, PortDef } from '../../../../shared/types/flows';
import type { AgentToolContext, AgentToolResult } from './types';
import { toolText } from './types';
import { decisionErrorText, decisionOutcome, decisionText } from './decide-outcome';

/** No local rung in this slice (D3 failed — D4 HANDOFF part (g)). */
export const DECIDE_PROVIDERS = ['auto', 'jev', 'openrouter-decisions', 'llm'] as const;
export const DEFAULT_DECIDE_THRESHOLD = 0.9;
/** The one question key every decision tool sends. */
export const DECISION_QUESTION_KEY = 'decision';

export const decideCommonSchema = {
  threshold: z.number().min(0).max(1).optional().describe('Act only when the top answer’s score reaches this bar (default 0.9).'),
  provider: z.enum(DECIDE_PROVIDERS).optional().describe('auto = the ladder in Settings; or one pinned provider (never falls back).'),
  allowUncalibrated: z
    .union([z.boolean(), z.enum(['on', 'off'])])
    .optional()
    .describe('Let an uncalibrated answer act (and let auto end at the LLM fallback). Default off.'),
};

export interface DecideCommonArgs {
  threshold?: number;
  provider?: (typeof DECIDE_PROVIDERS)[number];
  allowUncalibrated?: boolean | 'on' | 'off';
}

/** The canvas: the band first — the output the node previews — then the answer; `p` is a number the run record keeps. */
export const DECIDE_OUTPUTS: PortDef[] = [
  { id: 'band', label: 'Band (act / escalate)', dataType: 'text', from: 'field:band' },
  { id: 'answer', label: 'Answer', dataType: 'text', from: 'field:answer' },
  { id: 'p', label: 'p (run record)', dataType: 'number', from: 'field:p', recordOnly: true },
];

export const DECIDE_COMMON_FIELDS: ConfigField[] = [
  { kind: 'number', key: 'threshold', label: 'Act at or above', min: 0, max: 1, step: 0.01 },
  {
    kind: 'select',
    key: 'provider',
    label: 'Provider',
    options: [
      { value: 'auto', label: 'Auto — the order in Settings' },
      { value: 'jev', label: 'TypeSafe Jev' },
      { value: 'openrouter-decisions', label: 'Microsoft Decision (OpenRouter)' },
      { value: 'llm', label: 'LLM fallback (uncalibrated)' },
    ],
  },
  {
    kind: 'select',
    key: 'allowUncalibrated',
    label: 'Uncalibrated answers',
    options: [
      { value: 'off', label: 'Escalate them' },
      { value: 'on', label: 'Let them act (noted)' },
    ],
  },
];

export const DECIDE_COMMON_DEFAULTS = { threshold: DEFAULT_DECIDE_THRESHOLD, provider: 'auto', allowUncalibrated: 'off' } as const;

/** What a tool asks: the caller's (or the built-in's) framing, unchanged (D-r16). */
export interface DecideCall extends DecideCommonArgs {
  state: string;
  question: DecisionQuestion;
  family: DecisionTaskFamily;
}

/** §10.1: the usage log's column — `decision-flow` when the flow runner invoked the tool, `decision-agent` otherwise. */
export function decisionFeatureSource(ctx: Pick<AgentToolContext, 'featureSource'>): AiFeatureSource {
  return ctx.featureSource === 'flows' ? 'decision-flow' : 'decision-agent';
}

export function isOn(value: boolean | 'on' | 'off' | undefined): boolean {
  return value === true || value === 'on';
}

export async function runDecision(call: DecideCall, ctx: AgentToolContext): Promise<AgentToolResult> {
  const allowUncalibrated = isOn(call.allowUncalibrated);
  const provider: DecisionProviderChoice = call.provider ?? 'auto';
  try {
    // Loaded on first use, the way the runtime loads its own deps: the registry imports every tool at startup.
    const { getDecisionRuntime } = await import('../../decisions/decision-runtime');
    const result = await getDecisionRuntime().decide(
      {
        state: call.state,
        questions: { [DECISION_QUESTION_KEY]: call.question },
        provider,
        featureSource: decisionFeatureSource(ctx),
        allowUncalibrated,
        family: call.family,
      },
      { signal: ctx.signal },
    );
    const outcome = decisionOutcome(result.answers[DECISION_QUESTION_KEY], {
      calibrated: result.calibrated,
      threshold: call.threshold ?? DEFAULT_DECIDE_THRESHOLD,
      allowUncalibrated,
    });
    if (outcome.note) ctx.emitProgress('The answer is uncalibrated; it acts because uncalibrated answers are allowed.');
    const fields: Record<string, string | number> = { band: outcome.band, answer: outcome.answer };
    if (outcome.p !== undefined) fields.p = outcome.p;
    if (outcome.note) fields.note = outcome.note;
    return { ...toolText(decisionText(outcome)), fields };
  } catch (err) {
    return toolText(decisionErrorText(err), true);
  }
}

/**
 * Options as the agent sends them (`{ id: description }`) or as the canvas holds them (one `id: description` per line; a line without a
 * colon is its own description). Null when fewer than two distinct ids remain or an id repeats.
 */
export function parseDecisionOptions(options: Record<string, string> | string | undefined): Record<string, string> | null {
  const out: Record<string, string> = {};
  if (typeof options === 'string') {
    for (const line of options.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colon = trimmed.indexOf(':');
      const id = (colon === -1 ? trimmed : trimmed.slice(0, colon)).trim();
      const description = (colon === -1 ? trimmed : trimmed.slice(colon + 1)).trim() || id;
      if (!id || Object.prototype.hasOwnProperty.call(out, id)) return null;
      out[id] = description;
    }
  } else if (options) {
    for (const [id, description] of Object.entries(options)) {
      if (id.trim()) out[id.trim()] = description.trim() || id.trim();
    }
  }
  return Object.keys(out).length >= 2 ? out : null;
}

export const TOO_FEW_OPTIONS = 'A choice needs at least two distinct options, one `id: description` per line.';

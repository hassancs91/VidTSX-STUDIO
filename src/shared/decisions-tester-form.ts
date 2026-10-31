// The developer tester's form → request and result → view (DECISION_MODELS_DESIGN.md §8 / §12). Pure. The tester sits behind the
// dev-preview flag and is THE ONE place a probability is shown — as numbers, in a tester (§1, §8). Its requests carry
// `featureSource: 'decision-test'` (D-r20 (1)).

import type { DecisionsDecideResponse } from './ipc/types/decisions';
import type { DecisionErrorCode, DecisionProviderChoice, DecisionQuestion, DecisionRequest, DecisionTaskFamily } from './types/decisions';
import { decisionOutcome, type DecisionBand } from './decisions-outcome';

/** = the `decide` tool's default (`agents/tools/decide-run.ts` DEFAULT_DECIDE_THRESHOLD — pinned by `decide-shared-pins.test.ts`). */
export const DECISIONS_TESTER_THRESHOLD = 0.9;

/** The developer tester's budget (D2 §9) — a flow / agent `decide` keeps the engine's 15 s default. */
export const DECISIONS_TESTER_TIMEOUT_MS = 30_000;

/** The one question's key in the tester's request. */
export const TESTER_QUESTION_KEY = 'decision';

export const TESTER_PROVIDERS: { value: DecisionProviderChoice; label: string }[] = [
  { value: 'auto', label: 'Auto — the order in Settings' },
  { value: 'jev', label: 'TypeSafe Jev' },
  { value: 'openrouter-decisions', label: 'Microsoft-Decision-1 (OpenRouter)' },
  { value: 'llm', label: 'Your AI provider (uncalibrated)' },
];

export const TESTER_FAMILIES: { value: DecisionTaskFamily; label: string }[] = [
  { value: 'other', label: 'Other (never calibrated)' },
  { value: 'routing', label: 'Routing' },
  { value: 'verify', label: 'Verify' },
];

export interface DecisionsTesterForm {
  state: string;
  type: 'noul' | 'choice';
  instructions: string;
  /** One `id: description` per line (choice only). */
  options: string;
  provider: DecisionProviderChoice;
  family: DecisionTaskFamily;
}

export const EMPTY_TESTER_FORM: DecisionsTesterForm = {
  state: '',
  type: 'choice',
  instructions: '',
  options: '',
  provider: 'auto',
  family: 'other',
};

/** One `id: description` per line; a line without a colon is its own id and description; blank lines skipped; first id wins. */
export function parseTesterOptions(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    const id = (colon >= 0 ? line.slice(0, colon) : line).trim();
    const description = (colon >= 0 ? line.slice(colon + 1) : line).trim() || id;
    if (id && !(id in out)) out[id] = description;
  }
  return out;
}

export type TesterBuild = { ok: true; request: DecisionRequest } | { ok: false; reason: string };

export function buildTesterRequest(form: DecisionsTesterForm): TesterBuild {
  if (!form.state.trim()) return { ok: false, reason: 'Enter a state — the evidence the question is about.' };
  const instructions = form.instructions.trim();
  if (!instructions) return { ok: false, reason: 'Enter the question’s instructions.' };
  let question: DecisionQuestion;
  if (form.type === 'choice') {
    const criteria = parseTesterOptions(form.options);
    if (Object.keys(criteria).length < 2) {
      return { ok: false, reason: 'A choice needs at least two options — one "id: description" per line.' };
    }
    question = { type: 'choice', instructions, criteria };
  } else {
    question = { type: 'noul', instructions };
  }
  return {
    ok: true,
    request: {
      state: form.state,
      questions: { [TESTER_QUESTION_KEY]: question },
      provider: form.provider,
      featureSource: 'decision-test',
      family: form.family,
      timeoutMs: DECISIONS_TESTER_TIMEOUT_MS,
    },
  };
}

export interface TesterProbabilityRow {
  label: string;
  /** Three decimals — a number in a tester, never a claim. */
  value: string;
}

export type TesterResultView =
  | {
      ok: true;
      answer: string;
      band: DecisionBand;
      provider: string;
      model: string;
      calibrated: boolean;
      latencyMs: number;
      cached: boolean;
      probabilities: TesterProbabilityRow[];
      skipped: string[];
      refused?: string;
    }
  | { ok: false; code: DecisionErrorCode; message: string };

const num = (p: number): string => p.toFixed(3);

export function testerResultView(response: DecisionsDecideResponse): TesterResultView {
  if (!response.ok) return { ok: false, code: response.error.code, message: response.error.message };
  const { result } = response;
  const answer = result.answers[TESTER_QUESTION_KEY];
  const outcome = decisionOutcome(answer, {
    calibrated: result.calibrated,
    threshold: DECISIONS_TESTER_THRESHOLD,
    allowUncalibrated: false,
  });
  let probabilities: TesterProbabilityRow[] = [];
  if (answer?.type === 'noul') {
    probabilities = [
      { label: 'yes', value: num(answer.p) },
      { label: 'no', value: num(1 - answer.p) },
    ];
  } else if (answer?.type === 'choice' || answer?.type === 'score') {
    probabilities = Object.entries(answer.probabilities)
      .sort((a, b) => b[1] - a[1])
      .map(([label, p]) => ({ label, value: num(p) }));
  }
  return {
    ok: true,
    answer: outcome.answer,
    band: outcome.band,
    provider: result.provider,
    model: result.model,
    calibrated: result.calibrated,
    latencyMs: result.latencyMs,
    cached: result.cached,
    probabilities,
    skipped: (result.skipped ?? []).map((s) => `${s.provider}: ${s.why}`),
    ...(answer?.type === 'refused' ? { refused: answer.reason } : {}),
  };
}

// A decision → the band and the words the agent reads (DECISION_MODELS_DESIGN.md §10.1, ruling D-r18). Pure.
//
// The band reads the TOP probability — choice: `probabilities[choice]`; noul: `max(p, 1 − p)` with the answer yes iff p ≥ 0.5 — the
// quantity D1 calibrated, never the provider's `confidence`. `act` iff that top probability ≥ the threshold AND the answer is calibrated;
// an uncalibrated answer escalates unless the caller set `allowUncalibrated` (then it acts under the same threshold, noted `uncalibrated`).
//
// THE E3 LESSON (§1, §15.1): the agent reads the answer and the band only — never the number, never a claim word. `p` leaves only as a
// field the flow runner files in the run record.

import type { DecisionAnswer, DecisionErrorCode } from '../../../../shared/types/decisions';

export type DecisionBand = 'act' | 'escalate';

export interface DecisionOutcome {
  band: DecisionBand;
  /** The option id, `yes` / `no`, or '' when the decider gave no answer. */
  answer: string;
  /** The top answer's probability (the gate's quantity) — absent when there is no answer. */
  p?: number;
  note?: 'uncalibrated';
}

export interface DecisionGate {
  calibrated: boolean;
  threshold: number;
  allowUncalibrated: boolean;
}

function topOf(answer: DecisionAnswer | undefined): { answer: string; top: number } | null {
  if (answer?.type === 'noul') return { answer: answer.p >= 0.5 ? 'yes' : 'no', top: Math.max(answer.p, 1 - answer.p) };
  if (answer?.type === 'choice') return { answer: answer.choice, top: answer.probabilities[answer.choice] ?? 0 };
  return null; // refused, missing, or a score (the tools never ask one)
}

export function decisionOutcome(answer: DecisionAnswer | undefined, gate: DecisionGate): DecisionOutcome {
  const top = topOf(answer);
  if (!top) return { band: 'escalate', answer: '' };
  const overBar = top.top >= gate.threshold;
  if (gate.calibrated) return { band: overBar ? 'act' : 'escalate', answer: top.answer, p: top.top };
  if (gate.allowUncalibrated && overBar) return { band: 'act', answer: top.answer, p: top.top, note: 'uncalibrated' };
  return { band: 'escalate', answer: top.answer, p: top.top };
}

/** §10.1's two shapes: "Decision: billing (act)" / "Decision: uncertain — top answer billing (escalate)". */
export function decisionText(outcome: DecisionOutcome): string {
  if (outcome.band === 'act') return `Decision: ${outcome.answer} (act${outcome.note ? ` — ${outcome.note}` : ''})`;
  return outcome.answer ? `Decision: uncertain — top answer ${outcome.answer} (escalate)` : 'Decision: uncertain — no answer (escalate)';
}

/** One plain sentence per error code — no number, never the engine's message (it may carry a status, a duration or the state). */
export const DECISION_ERROR_SENTENCES: Record<DecisionErrorCode, string> = {
  'no-provider':
    'No decision provider is available: add a TypeSafe or OpenRouter key in AI › Providers, or turn Decisions on in Settings.',
  unsupported: 'The question is too large for every decision provider; shorten the state or the options.',
  timeout: 'The decision provider did not answer in time.',
  'provider-error': 'The decision provider failed to answer.',
  'invalid-answer': 'The decision provider sent an answer that could not be read.',
  cancelled: 'The decision was cancelled.',
  'invalid-request': 'The decision request is incomplete: it needs a state, instructions and, for a choice, at least two options.',
};

/** A thrown decision failure → its sentence; anything without a known code is a provider error. */
export function decisionErrorText(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code: unknown }).code : undefined;
  if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(DECISION_ERROR_SENTENCES, code)) {
    return DECISION_ERROR_SENTENCES[code as DecisionErrorCode];
  }
  return DECISION_ERROR_SENTENCES['provider-error'];
}

// A decision → its band (DECISION_MODELS_DESIGN.md §10.1, ruling D-r18 / D-r22 (3)–(4)). Pure; shared by the `decide` tool / nodes (main,
// `agents/tools/decide-outcome.ts` re-exports it) and the developer tester (renderer) so both band the same way.
//
// The band reads the TOP probability — choice: `probabilities[choice]`; noul: `max(p, 1 − p)` with the answer yes iff p ≥ 0.5 — the
// quantity D1 calibrated, never the provider's `confidence`. `act` iff that top probability ≥ the threshold AND the answer is calibrated;
// an uncalibrated answer escalates unless the caller set `allowUncalibrated` (then it acts under the same threshold, noted `uncalibrated`).

import type { DecisionAnswer } from './types/decisions';

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

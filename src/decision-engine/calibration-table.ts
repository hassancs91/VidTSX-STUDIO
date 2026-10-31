/**
 * The calibration table (DECISION_MODELS_DESIGN.md §4 `calibration-table.ts`, the rows of §15.1): (provider, model, task family) →
 * `calibrated`. "Calibrated" is earned, not claimed (§1): only the (provider, model, family) triples D1 measured at 40 / 40 with Brier
 * ≤ 0.021 (`c-hosted.md` §2) are true. The LLM fallback never; the family `other` (the default) never; a local model has no row in this
 * slice (D3 failed). Pure.
 */
import type { DecisionProviderId, DecisionTaskFamily } from './types';

export interface CalibratedDecisionRow {
  provider: DecisionProviderId;
  /** Exact model id — the one requested by the preset or the one served (DecisionResult.model is "as served", §3). */
  model: string;
  family: Exclude<DecisionTaskFamily, 'other'>;
}

/**
 * Jev serves `jev-1.14.0` exactly. OpenRouter is asked for the alias `microsoft/microsoft-decision-1` and served the snapshot
 * `microsoft/microsoft-decision-1-20261009` in every D1 body — that snapshot IS the measured model, so it maps too; any other snapshot
 * behind the alias is model drift and stays false until it is measured.
 */
const MEASURED: ReadonlyArray<Omit<CalibratedDecisionRow, 'family'>> = [
  { provider: 'jev', model: 'jev-1.14.0' },
  { provider: 'openrouter-decisions', model: 'microsoft/microsoft-decision-1' },
  { provider: 'openrouter-decisions', model: 'microsoft/microsoft-decision-1-20261009' },
];

export const CALIBRATED_DECISION_ROWS: readonly CalibratedDecisionRow[] = MEASURED.flatMap((m) => [
  { ...m, family: 'routing' as const },
  { ...m, family: 'verify' as const },
]);

/** True only for a measured (provider, model, family) row; `family` absent = `other` = never. */
export function isDecisionCalibrated(provider: DecisionProviderId, model: string, family: DecisionTaskFamily | undefined): boolean {
  if (provider === 'llm' || family === undefined || family === 'other') return false;
  return CALIBRATED_DECISION_ROWS.some((r) => r.provider === provider && r.model === model && r.family === family);
}

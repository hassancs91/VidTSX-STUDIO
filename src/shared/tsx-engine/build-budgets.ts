// The builder's budgets (TSX_BUILDER_DESIGN.md T6): look rounds and hard caps
// per budget. Shared so the budget pickers (the Creator's, P3 part 2; Studio's
// pool form and Inspector, part 5) show the numbers the builder runs with;
// main reads them from here. P5 part 3 adds the measured tokens per budget
// and the cost estimate's words in the hint.

import type { BuildBudget, BuildCaps, BuildTokens } from '../ipc/types/tsx-build';
import type { TsxBuildCostEstimate } from '../ipc/types/tsx-jobs';

/** Look rounds (render_stills + contact_sheet calls) per budget. */
export const BUDGET_ROUNDS: Record<BuildBudget, number> = { quick: 1, standard: 3, craft: 6 };

/**
 * Generous on purpose: the look budget is the real limit, a cap only stops a
 * runaway. Measured in P0: Quick smoke 13 turns / 4.6k output tokens; Craft
 * B2 run 2 46 turns / 32.6k output tokens / 7.7 min.
 */
export const BUDGET_CAPS: Record<BuildBudget, BuildCaps> = {
  quick: { turns: 40, minutes: 15, outputTokens: 40_000 },
  standard: { turns: 90, minutes: 30, outputTokens: 100_000 },
  craft: { turns: 200, minutes: 60, outputTokens: 250_000 },
};

export const BUDGET_CHOICES: Array<{ value: BuildBudget; label: string }> = [
  { value: 'quick', label: 'Quick' },
  { value: 'standard', label: 'Standard' },
  { value: 'craft', label: 'Craft' },
];

/** The cheapest and the dearest measured run of a budget, by their cost. */
export interface MeasuredTokens {
  low: BuildTokens;
  high: BuildTokens;
}

/**
 * Tokens a builder run used, per model and budget (P5 part 3): the cheapest
 * and dearest of the stored runs, 10-12 to 10-21 (35 builds: Opus 5.5 Craft
 * 13, Standard 1; Sonnet 5.5 Quick 9, Standard 5, Craft 7). Most of a run's
 * cost is the cache write of the system prompt, so the budgets cost about the
 * same on Sonnet. A model or budget with no runs uses Sonnet 5.5's row.
 */
export const MEASURED_BUILD_TOKENS: Record<string, Partial<Record<BuildBudget, MeasuredTokens>>> = {
  'claude-sonnet-5-5': {
    quick: {
      low: { input: 16, output: 2_523, cacheRead: 625_177, cacheCreation: 36_101 },
      high: { input: 12, output: 12_185, cacheRead: 351_680, cacheCreation: 164_763 },
    },
    standard: {
      low: { input: 12, output: 7_229, cacheRead: 368_737, cacheCreation: 90_025 },
      high: { input: 16, output: 14_665, cacheRead: 540_146, cacheCreation: 167_918 },
    },
    craft: {
      low: { input: 18, output: 7_224, cacheRead: 262_905, cacheCreation: 64_091 },
      high: { input: 20, output: 9_269, cacheRead: 720_092, cacheCreation: 171_955 },
    },
  },
  'claude-opus-5-5': {
    standard: {
      low: { input: 26, output: 6_753, cacheRead: 1_125_094, cacheCreation: 53_571 },
      high: { input: 26, output: 6_753, cacheRead: 1_125_094, cacheCreation: 53_571 },
    },
    craft: {
      low: { input: 22, output: 35_797, cacheRead: 1_171_821, cacheCreation: 75_329 },
      high: { input: 54, output: 65_408, cacheRead: 3_511_644, cacheCreation: 173_765 },
    },
  },
};

export const FALLBACK_TOKEN_MODEL = 'claude-sonnet-5-5';

/** The measured tokens for a model's budget, else Sonnet 5.5's. */
export function measuredTokens(model: string, budget: BuildBudget): MeasuredTokens {
  return MEASURED_BUILD_TOKENS[model]?.[budget] ?? MEASURED_BUILD_TOKENS[FALLBACK_TOKEN_MODEL][budget]!;
}

function dollars(value: number): string {
  return value.toFixed(2);
}

/** "≈ $0.51–0.93", "on your plan", "cost unknown". */
export function costEstimateText(estimate: TsxBuildCostEstimate): string {
  if (estimate.kind === 'plan') return 'on your plan';
  if (estimate.kind === 'unknown') return 'cost unknown';
  const low = dollars(estimate.low);
  const high = dollars(estimate.high);
  return low === high ? `≈ $${low}` : `≈ $${low}–${high}`;
}

/**
 * "up to 3 looks · stops at 30 min": what the picked budget buys; with the
 * cost estimate (P5 part 3) once it has arrived.
 */
export function budgetHint(budget: BuildBudget, estimate?: TsxBuildCostEstimate | null): string {
  const rounds = BUDGET_ROUNDS[budget];
  const looks = rounds === 1 ? '1 look' : `up to ${rounds} looks`;
  const base = `${looks} · stops at ${BUDGET_CAPS[budget].minutes} min`;
  return estimate ? `${base} · ${costEstimateText(estimate)}` : base;
}

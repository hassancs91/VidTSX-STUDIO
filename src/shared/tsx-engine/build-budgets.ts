// The builder's budgets (TSX_BUILDER_DESIGN.md T6): look rounds and hard caps
// per budget. Shared so the Creator's budget picker (P3 part 2) shows the
// numbers the builder runs with; main reads them from here.

import type { BuildBudget, BuildCaps } from '../ipc/types/tsx-build';

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

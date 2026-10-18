// The arguments the composition tools share (split out of
// generate-composition.ts in P4 part 3, to keep it under 300 lines):
// `generate_composition`, `edit_composition` and Studio's `generate_tsx_shot`
// take the same budget, and the two composition nodes the same Budget and
// "Generated images" selects.

import { z } from 'zod';
import type { ConfigField } from '../../../../shared/types/flows';
import { BUDGET_CHOICES, budgetHint } from '../../../../shared/tsx-engine/build-budgets';

export const BUILD_BUDGETS = ['quick', 'standard', 'craft'] as const;

export const budgetSchema = z
  .enum(BUILD_BUDGETS)
  .optional()
  .describe(
    'How long the builder may work. quick: ~1-3 min, one look at its frames. standard (default): ~3-10 min, up to 3 looks. craft: up to 60 min, up to 6 looks; only when the user wants a finished piece.',
  );

/** An agent sends a boolean; a flow inspector's select sends 'on' / 'off' (generate-audio's pattern). */
export const onOff = z.union([z.boolean(), z.enum(['on', 'off'])]);

/** true / 'on' → true, false / 'off' → false; absent (or an edit's 'keep') → undefined. */
export function isOn(value: boolean | 'on' | 'off' | 'keep' | undefined): boolean | undefined {
  return value === undefined || value === 'keep' ? undefined : value === true || value === 'on';
}

/** The composition nodes' Budget select: what each budget buys, as the Creator's picker says it. */
export const BUDGET_OPTIONS = BUDGET_CHOICES.map((c) => ({ value: c.value, label: `${c.label} — ${budgetHint(c.value)}` }));

export const generatedImagesSchema = onOff
  .optional()
  .describe('Whether the builder may generate images (priced; needs an image provider). Absent = allowed for an agent, off for a flow node.');

/** The composition nodes' "Generated images" select (Generate and Edit). */
export const GENERATED_IMAGES_FIELD: ConfigField = {
  kind: 'select',
  key: 'generatedImages',
  label: 'Generated images',
  options: [
    { value: 'off', label: 'Off — the builder draws everything in code' },
    { value: 'on', label: 'On — it may generate images (priced, needs an image provider)' },
  ],
};

/** D-2: a flow node buys no images unless it says On; an agent keeps the builder's per-budget default. */
export function generatedImagesOff(value: boolean | 'on' | 'off' | undefined, featureSource: string): boolean {
  return !(isOn(value) ?? featureSource !== 'flows');
}

// The project's cut-style override (plan T1, B2). The Auto Cut picker no
// longer holds a session style: it shows the resolved style (override >
// preset > default) and can pin a base style on the project
// (`settings.cutStyle.base`). These pure helpers keep the Inspector's select a
// thin read/write of the document. Saved with the project, not undoable — the
// same settings edit as the preset and brand pickers.

import type { CutPlanStyleName } from '@shared/types/studio-cut-plan';
import type { StudioProjectSettings } from '@shared/types/studio';
import { normalizeCutStyleSpec } from '@shared/studio/cut-style-spec';

/** The select's value: `'preset'` = no override base (the preset's style, or the default). */
export type CutStyleOverrideChoice = 'preset' | CutPlanStyleName;

/** What the select shows for a stored `settings.cutStyle` (garbage reads as no override). */
export function cutStyleOverrideChoice(cutStyle: unknown): CutStyleOverrideChoice {
  return normalizeCutStyleSpec(cutStyle)?.base ?? 'preset';
}

/**
 * The settings with the override's base set or cleared. Knob overrides already
 * in the spec (hand-written) are kept — they layer over whichever base applies.
 * Clearing the base of a knob-less spec removes `cutStyle` entirely, so the
 * project reads exactly like one that never had an override.
 */
export function withCutStyleOverride(
  settings: StudioProjectSettings,
  choice: CutStyleOverrideChoice,
): StudioProjectSettings {
  const spec = { ...(normalizeCutStyleSpec(settings.cutStyle) ?? {}) };
  if (choice === 'preset') delete spec.base;
  else spec.base = choice;
  const next = { ...settings };
  if (Object.keys(spec).length > 0) next.cutStyle = spec;
  else delete next.cutStyle;
  return next;
}

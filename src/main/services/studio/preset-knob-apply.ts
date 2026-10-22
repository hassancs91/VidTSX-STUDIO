// Apply a learn card's knob changes to a preset style (V1 completion plan
// §2.5; plan T1 / B4 for the nested cut knobs). The card's `proposedStyle`
// and accept (preset-learn-handlers.ts) both go through here, so a nested
// `cut.<knob>` change is written the same way the preset form writes one:
// into `style.cut` over its base, the base's own value dropping the override
// (`withPresetCutKnob`). Pure.

import type { CutStyleFile } from '../../../shared/types/studio-cut-plan';
import type {
  StudioPresetCutKnobKey,
  StudioPresetKnobChange,
  StudioPresetKnobKey,
  StudioPresetStyle,
} from '../../../shared/types/studio-preset';
import type { CutLearnKnob } from '../../../shared/types/studio-cut-learn';
import { cutSpecProblems, presetCutBase, withPresetCutKnob } from '../../../shared/studio/preset-cut';

const CUT_PREFIX = 'cut.';

export function isCutKnobKey(key: StudioPresetKnobKey): key is StudioPresetCutKnobKey {
  return key.startsWith(CUT_PREFIX);
}

/** True when any change targets a nested cut knob (accept then needs the cut-style file). */
export function hasCutKnobChanges(changes: readonly StudioPresetKnobChange[]): boolean {
  return changes.some((c) => isCutKnobKey(c.key));
}

/**
 * The style after the changes. Flat knobs are set; `cut.<knob>` changes are
 * written over the preset's cut base — with `cutFile`, exactly as the form
 * does (a value equal to the base's removes the override); without it (no
 * file at hand), as a plain override.
 */
export function applyKnobChanges(
  style: StudioPresetStyle,
  changes: readonly StudioPresetKnobChange[],
  cutFile?: CutStyleFile | null,
): StudioPresetStyle {
  let next: StudioPresetStyle = { ...style };
  for (const change of changes) {
    if (isCutKnobKey(change.key)) {
      if (typeof change.to !== 'number') continue;
      const knob = change.key.slice(CUT_PREFIX.length) as CutLearnKnob;
      next = cutFile
        ? withPresetCutKnob(next, knob, change.to, cutFile)
        : { ...next, cut: { ...(next.cut ?? {}), [knob]: change.to } };
      continue;
    }
    (next as Record<string, unknown>)[change.key] = change.to;
  }
  return next;
}

/** What is wrong with the style's cut after the changes ([] = fine) — B2's check, base included. */
export function presetCutProblems(style: StudioPresetStyle, cutFile: CutStyleFile): string[] {
  if (!style.cut) return [];
  return cutSpecProblems(style.cut, cutFile.styles[presetCutBase(style, cutFile)]);
}

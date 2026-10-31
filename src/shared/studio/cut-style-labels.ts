// Human labels for the cut-style knobs (plan T1, B2) — one table for every
// place that shows them: Project settings' read-out, the preset editor's Cut
// section and the preset validator's messages. Pure.

import type { CutPlanKnob } from '../types/studio-cut-plan';

export interface CutKnobInfo {
  label: string;
  unit: 's' | 'dB' | '/s';
  /** Input step in the preset editor. */
  step: number;
  /** One line for a tooltip. */
  hint: string;
}

export const CUT_KNOB_INFO: Readonly<Record<CutPlanKnob, CutKnobInfo>> = {
  internalGap: { label: 'Pause split', unit: 's', step: 0.01, hint: 'Split kept speech at pauses at least this long.' },
  head: { label: 'Lead-in', unit: 's', step: 0.01, hint: 'Kept before the first word of each piece.' },
  minTail: { label: 'Tail min', unit: 's', step: 0.01, hint: 'Shortest tail kept after the last word.' },
  maxTail: { label: 'Tail max', unit: 's', step: 0.01, hint: 'Longest tail kept after the last word.' },
  margin: { label: 'Decay margin', unit: 'dB', step: 0.5, hint: 'Level over the noise floor that counts as decayed.' },
  softGap: { label: 'Soft gap', unit: 's', step: 0.1, hint: 'A pause this long ends a section (soft landing).' },
  softMaxTail: { label: 'Soft tail max', unit: 's', step: 0.01, hint: 'Longest tail at a section end.' },
  softMargin: { label: 'Soft margin', unit: 'dB', step: 0.5, hint: 'Decay margin at a section end.' },
  maxHead: { label: 'Onset reach', unit: 's', step: 0.01, hint: 'Snap a lead-in back to the real onset, at most this far.' },
  minSkip: { label: 'Min skip', unit: 's', step: 0.01, hint: 'Merge kept pieces whose gap is shorter than this.' },
  fricZcr: { label: 'Fricative ZCR', unit: '/s', step: 100, hint: 'Zero crossings per second that count as a fricative.' },
  fricMargin: { label: 'Fricative margin', unit: 'dB', step: 0.5, hint: 'Level over the floor a fricative must still have.' },
};

/** `0.15 s`, `12 dB`, `3500 /s`; `off` for an opt-in knob a style lacks. */
export function formatCutKnob(knob: CutPlanKnob, value: number | undefined): string {
  if (value === undefined) return 'off';
  return `${value} ${CUT_KNOB_INFO[knob].unit}`;
}

// The preset editor's Cut section as pure ops (plan T1, B2). A preset's
// `style.cut` holds ONLY what differs from its base: a base edit or a knob
// edit rewrites it that way, and a cut with nothing left is removed — an
// untouched preset keeps no `cut` key. Opt-in knobs the base lacks are not
// editable (DECIDED: turning the opt-ins off = choosing natural/relaxed), so
// they drop when the base changes. Also the checks the validator and the form
// share.

import type { StudioPresetStyle } from '../types/studio-preset';
import type {
  CutPlanKnob,
  CutPlanStyle,
  CutPlanStyleName,
  CutStyleFile,
  CutStyleSpec,
} from '../types/studio-cut-plan';
import { CUT_PLAN_KNOBS, CUT_PLAN_KNOB_BOUNDS, cleanKnob, isCutPlanStyleName } from './cut-style-spec';
import { pacingToCutBase } from './cut-style-resolve';
import { CUT_KNOB_INFO } from './cut-style-labels';

/** The style a preset's cut layers over: `cut.base` ?? mapped pacing ?? the file default (resolver rung 3). */
export function presetCutBase(style: StudioPresetStyle, file: CutStyleFile): CutPlanStyleName {
  const base = style.cut?.base;
  return isCutPlanStyleName(base) ? base : (pacingToCutBase(style.pacing) ?? file.default);
}

function withCut(style: StudioPresetStyle, cut: CutStyleSpec): StudioPresetStyle {
  const { cut: _old, ...rest } = style;
  return Object.keys(cut).length > 0 ? { ...rest, cut } : rest;
}

/**
 * Set the cut's base (undefined = follow the pacing) — or, with the current
 * base, re-prune after a pacing change. Knobs equal to the new base's value
 * and opt-ins the new base lacks drop.
 */
export function withPresetCutBase(
  style: StudioPresetStyle,
  base: CutPlanStyleName | undefined,
  file: CutStyleFile,
): StudioPresetStyle {
  const next: CutStyleSpec = base ? { base } : {};
  const baseStyle = file.styles[presetCutBase({ ...style, cut: next }, file)];
  for (const knob of CUT_PLAN_KNOBS) {
    const value = style.cut?.[knob];
    if (value === undefined || baseStyle[knob] === undefined || baseStyle[knob] === value) continue;
    next[knob] = value;
  }
  return withCut(style, next);
}

/** Set one knob; undefined or the base's own value removes it (back to the base). */
export function withPresetCutKnob(
  style: StudioPresetStyle,
  knob: CutPlanKnob,
  value: number | undefined,
  file: CutStyleFile,
): StudioPresetStyle {
  const baseValue = file.styles[presetCutBase(style, file)][knob];
  const next: CutStyleSpec = { ...(style.cut ?? {}) };
  if (value === undefined || baseValue === undefined || value === baseValue) delete next[knob];
  else next[knob] = value;
  return withCut(style, next);
}

/**
 * What is wrong with a preset's `style.cut` ([] = fine). Out-of-bounds knobs
 * and a tail/onset range turned inside out; with the base style, the range
 * check also counts the knobs the cut leaves to the base.
 */
export function cutSpecProblems(spec: unknown, base?: CutPlanStyle): string[] {
  if (spec === undefined || isCutPlanStyleName(spec)) return [];
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) {
    return ['The cut style must be a base and knob values.'];
  }
  const s = spec as Record<string, unknown>;
  const problems: string[] = [];
  if (s.base !== undefined && !isCutPlanStyleName(s.base)) {
    problems.push('The cut base must be tight, natural or relaxed.');
  }
  for (const knob of CUT_PLAN_KNOBS) {
    if (s[knob] === undefined || cleanKnob(knob, s[knob]) !== undefined) continue;
    const [min, max] = CUT_PLAN_KNOB_BOUNDS[knob];
    const info = CUT_KNOB_INFO[knob];
    problems.push(`Cut ${info.label.toLowerCase()} must be between ${min} and ${max} ${info.unit}.`);
  }
  const value = (knob: CutPlanKnob): number | undefined => {
    const own = cleanKnob(knob, s[knob]);
    return own !== undefined ? own : base?.[knob];
  };
  const minTail = value('minTail');
  const maxTail = value('maxTail');
  if (minTail !== undefined && maxTail !== undefined && minTail > maxTail) {
    problems.push('Cut tail min is above tail max.');
  }
  const head = value('head');
  const maxHead = value('maxHead');
  if (head !== undefined && maxHead !== undefined && maxHead < head) {
    problems.push('Cut onset reach is below the lead-in.');
  }
  return problems;
}

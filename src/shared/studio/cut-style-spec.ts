// Cut-style data validation (plan T1): the knob list and its bounds, the
// normaliser for a preset's `style.cut` / a project's `settings.cutStyle`, and
// the parser for `resources/skills/studio-clean-cut/cut-style.json`. Pure —
// main parses the file, both processes normalise specs.

import {
  CUT_PLAN_STYLE_NAMES,
  type CutPlanKnob,
  type CutPlanStyle,
  type CutPlanStyleName,
  type CutStyleFile,
  type CutStyleSpec,
} from '../types/studio-cut-plan';

/** Every knob, in display order: the eight required ones, then the opt-ins. */
export const CUT_PLAN_KNOBS: readonly CutPlanKnob[] = [
  'internalGap',
  'head',
  'minTail',
  'maxTail',
  'margin',
  'softGap',
  'softMaxTail',
  'softMargin',
  'maxHead',
  'minSkip',
  'fricZcr',
  'fricMargin',
];

/** Knobs every named style must carry (the rest are opt-in). */
export const CUT_PLAN_REQUIRED_KNOBS: readonly CutPlanKnob[] = CUT_PLAN_KNOBS.slice(0, 8);

/**
 * Accepted range per knob (inclusive). Generous on purpose — they reject
 * typos (a margin of 600 dB, a 30 s lead-in), not taste. `softGap` reaches
 * 1000 because a huge value is how a style turns soft landings off (99).
 */
export const CUT_PLAN_KNOB_BOUNDS: Readonly<Record<CutPlanKnob, readonly [number, number]>> = {
  internalGap: [0.05, 10],
  head: [0, 2],
  minTail: [0, 3],
  maxTail: [0, 5],
  margin: [0, 60],
  softGap: [0, 1000],
  softMaxTail: [0, 5],
  softMargin: [0, 60],
  maxHead: [0, 2],
  minSkip: [0, 2],
  fricZcr: [0, 50_000],
  fricMargin: [0, 60],
};

export function isCutPlanStyleName(value: unknown): value is CutPlanStyleName {
  return typeof value === 'string' && (CUT_PLAN_STYLE_NAMES as readonly string[]).includes(value);
}

/** A finite number inside the knob's bounds, else undefined. */
export function cleanKnob(knob: CutPlanKnob, value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const [min, max] = CUT_PLAN_KNOB_BOUNDS[knob];
  return value < min || value > max ? undefined : value;
}

/**
 * A spec read from disk or a form: a known `base` and in-bounds knobs
 * survive, everything else drops. Undefined when nothing survives, so an
 * empty or garbage `cut` behaves exactly like an absent one.
 */
export function normalizeCutStyleSpec(raw: unknown): CutStyleSpec | undefined {
  // A bare style name ("natural") is accepted as `{ base }` for hand edits.
  if (isCutPlanStyleName(raw)) return { base: raw };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const spec: CutStyleSpec = {};
  if (isCutPlanStyleName(r.base)) spec.base = r.base;
  for (const knob of CUT_PLAN_KNOBS) {
    const value = cleanKnob(knob, r[knob]);
    if (value !== undefined) spec[knob] = value;
  }
  return Object.keys(spec).length > 0 ? spec : undefined;
}

function parseStyle(name: CutPlanStyleName, raw: unknown): CutPlanStyle {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`cut-style.json: style "${name}" is missing`);
  }
  const r = raw as Record<string, unknown>;
  const out: Partial<CutPlanStyle> = {};
  for (const knob of CUT_PLAN_KNOBS) {
    if (r[knob] === undefined) continue;
    const value = cleanKnob(knob, r[knob]);
    if (value === undefined) {
      const [min, max] = CUT_PLAN_KNOB_BOUNDS[knob];
      throw new Error(`cut-style.json: ${name}.${knob} must be a number in [${min}, ${max}]`);
    }
    out[knob] = value;
  }
  for (const knob of CUT_PLAN_REQUIRED_KNOBS) {
    if (out[knob] === undefined) throw new Error(`cut-style.json: ${name}.${knob} is required`);
  }
  const style = out as CutPlanStyle;
  if (style.minTail > style.maxTail) {
    throw new Error(`cut-style.json: ${name}.minTail is above maxTail`);
  }
  if (style.maxHead !== undefined && style.maxHead < style.head) {
    throw new Error(`cut-style.json: ${name}.maxHead is below head`);
  }
  return style;
}

/** The shipped file, checked strictly — a bad file is a build bug, so it throws. */
export function parseCutStyleFile(raw: unknown): CutStyleFile {
  if (typeof raw !== 'object' || raw === null) throw new Error('cut-style.json: not an object');
  const r = raw as Record<string, unknown>;
  if (!isCutPlanStyleName(r.default)) {
    throw new Error(`cut-style.json: "default" must be one of ${CUT_PLAN_STYLE_NAMES.join(', ')}`);
  }
  const stylesRaw = (typeof r.styles === 'object' && r.styles !== null ? r.styles : {}) as Record<string, unknown>;
  const styles = {} as Record<CutPlanStyleName, CutPlanStyle>;
  for (const name of CUT_PLAN_STYLE_NAMES) styles[name] = parseStyle(name, stylesRaw[name]);
  return { default: r.default, styles };
}

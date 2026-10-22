// One resolver for the cut style (plan T1, B2 decision 3). Every consumer —
// the Auto Cut button, the agent's run_auto_cut, the editorial snap and
// Transcript deletes — snaps with what this returns, so they cannot disagree.
//
// Precedence, highest first:
//   1. the per-call style (the agent's `run_auto_cut({ style })`) — the named
//      style from the file as-is;
//   2. the project's `settings.cutStyle` — a `base` replaces the preset's
//      choice, knobs alone layer over it;
//   3. the preset's `style.cut` — `base` (else the mapped pacing, else the
//      file default) with its knobs over that base;
//   4. the preset's `style.pacing` mapped (tight → tight, normal → natural,
//      relaxed → relaxed);
//   5. the file's `default`.
// Pure — the caller loads `cut-style.json` (main) and hands it in.

import type { StudioPresetPacing, StudioPresetStyle } from '../types/studio-preset';
import type {
  CutPlanStyle,
  CutPlanStyleName,
  CutStyleFile,
  CutStyleSource,
  CutStyleSpec,
  ResolvedCutStyle,
} from '../types/studio-cut-plan';
import { CUT_PLAN_KNOBS, isCutPlanStyleName, normalizeCutStyleSpec } from './cut-style-spec';

const PACING_BASE: Readonly<Record<StudioPresetPacing, CutPlanStyleName>> = {
  tight: 'tight',
  normal: 'natural',
  relaxed: 'relaxed',
};

export interface CutStyleContext {
  /** An explicit per-call style — wins over everything. */
  callStyle?: CutPlanStyleName;
  /** The project (only `settings.cutStyle` is read; unknown shapes drop). */
  project?: { settings: { cutStyle?: unknown } } | null;
  /** The project's preset; null/absent = no preset (or a stale id). */
  preset?: { name: string; style?: StudioPresetStyle } | null;
}

interface StylePick {
  styleName: CutPlanStyleName;
  style: CutPlanStyle;
  source: CutStyleSource;
  presetName?: string;
}

/** The preset's pacing as a style base, or undefined when unset/unknown. */
export function pacingToCutBase(pacing: unknown): CutPlanStyleName | undefined {
  return typeof pacing === 'string' && Object.prototype.hasOwnProperty.call(PACING_BASE, pacing)
    ? PACING_BASE[pacing as StudioPresetPacing]
    : undefined;
}

function withKnobs(base: CutPlanStyle, spec: CutStyleSpec | undefined): CutPlanStyle {
  const out: CutPlanStyle = { ...base };
  if (!spec) return out;
  for (const knob of CUT_PLAN_KNOBS) {
    const value = spec[knob];
    if (value !== undefined) out[knob] = value;
  }
  return out;
}

/** Rungs 3–5: the preset's cut, its pacing, the file default. */
function presetPick(file: CutStyleFile, preset: CutStyleContext['preset']): StylePick {
  const cut = normalizeCutStyleSpec(preset?.style?.cut);
  const paced = pacingToCutBase(preset?.style?.pacing);
  if (preset && (cut || paced)) {
    const styleName = cut?.base ?? paced ?? file.default;
    return {
      styleName,
      style: withKnobs(file.styles[styleName], cut),
      source: cut ? 'preset' : 'pacing',
      presetName: preset.name,
    };
  }
  return { styleName: file.default, style: { ...file.styles[file.default] }, source: 'default' };
}

function choose(file: CutStyleFile, ctx: CutStyleContext): StylePick {
  if (isCutPlanStyleName(ctx.callStyle)) {
    return { styleName: ctx.callStyle, style: { ...file.styles[ctx.callStyle] }, source: 'call' };
  }
  const lower = presetPick(file, ctx.preset);
  const override = normalizeCutStyleSpec(ctx.project?.settings?.cutStyle);
  if (override?.base) {
    return {
      styleName: override.base,
      style: withKnobs(file.styles[override.base], override),
      source: 'project',
    };
  }
  if (override) return { ...lower, style: withKnobs(lower.style, override), source: 'project' };
  return lower;
}

const SOURCE_LABEL: Readonly<Record<Exclude<CutStyleSource, 'preset' | 'pacing'>, string>> = {
  call: 'requested',
  project: 'project override',
  default: 'default',
};

function displayNameOf(pick: StylePick, overrideCount: number): string {
  const plus = overrideCount > 0 ? ` + ${overrideCount} override${overrideCount === 1 ? '' : 's'}` : '';
  const label =
    pick.source === 'preset' || pick.source === 'pacing'
      ? `preset “${pick.presetName ?? ''}”`
      : SOURCE_LABEL[pick.source];
  return `${pick.styleName}${plus} · ${label}`;
}

/**
 * 8 hex chars (FNV-1a over every knob in a fixed order). Equal knobs give an
 * equal key; any knob change gives a new one — the cut-plan cache keys on it
 * so an edited preset never reuses a stale plan.
 */
export function cutStyleKey(style: CutPlanStyle): string {
  const text = CUT_PLAN_KNOBS.map((knob) => `${knob}=${style[knob] ?? ''}`).join(';');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function resolveCutStyle(file: CutStyleFile, ctx: CutStyleContext = {}): ResolvedCutStyle {
  const pick = choose(file, ctx);
  const base = file.styles[pick.styleName];
  const overrides = CUT_PLAN_KNOBS.filter((knob) => pick.style[knob] !== base[knob]);
  return {
    styleName: pick.styleName,
    style: pick.style,
    source: pick.source,
    overrides,
    ...(pick.presetName !== undefined ? { presetName: pick.presetName } : {}),
    displayName: displayNameOf(pick, overrides.length),
    key: cutStyleKey(pick.style),
  };
}

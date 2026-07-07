// Effects catalog + pure helpers for the Studio Effects tab.
//
// The effect data shapes live in `@shared/ipc/types` (StudioEffect) because the
// composition (shared by preview + headless render) reads them. This module
// owns the EDIT-TIME concerns: each effect's default value, the slider metadata
// the tab renders, and small immutable helpers for toggling / updating an
// effect inside a clip's `effects` array. No React, no IPC — trivially testable.

import type {
  StudioEffect,
  StudioEffectType,
} from '@shared/ipc/types';

// One numeric, slider-backed parameter of an effect. `key` is the property name
// on the effect object; the tab reads/writes `effect[key]` directly.
export interface EffectParamControl {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  // Display formatter for the current value (e.g. "1.2×", "8px", "50%").
  format: (value: number) => string;
}

export interface EffectDefinition {
  type: StudioEffectType;
  label: string;
  description: string;
  // Factory so every toggle-on starts from a fresh, sensible default.
  createDefault: () => StudioEffect;
  params: EffectParamControl[];
}

const px = (v: number) => `${Math.round(v)}px`;
const mult = (v: number) => `${v.toFixed(2)}×`;
const secs = (v: number) => `${v.toFixed(1)}s`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

// The five foundational effects, in display order. Each `param.key` must be a
// numeric property on the matching effect interface.
export const EFFECT_DEFINITIONS: EffectDefinition[] = [
  {
    type: 'fade',
    label: 'Fade',
    description: 'Ease the clip in and out by ramping its opacity at the edges.',
    createDefault: () => ({ type: 'fade', inSeconds: 0.5, outSeconds: 0.5 }),
    params: [
      { key: 'inSeconds', label: 'Fade in', min: 0, max: 5, step: 0.1, format: secs },
      { key: 'outSeconds', label: 'Fade out', min: 0, max: 5, step: 0.1, format: secs },
    ],
  },
  {
    type: 'zoom',
    label: 'Zoom (Ken Burns)',
    description: 'Slowly scale the clip across its duration for a subtle push-in or pull-out.',
    createDefault: () => ({ type: 'zoom', from: 1, to: 1.2 }),
    params: [
      { key: 'from', label: 'Start', min: 0.5, max: 3, step: 0.05, format: mult },
      { key: 'to', label: 'End', min: 0.5, max: 3, step: 0.05, format: mult },
    ],
  },
  {
    type: 'blur',
    label: 'Blur',
    description: 'Apply a constant Gaussian blur to the clip.',
    createDefault: () => ({ type: 'blur', amount: 8 }),
    params: [
      { key: 'amount', label: 'Amount', min: 0, max: 40, step: 1, format: px },
    ],
  },
  {
    type: 'grayscale',
    label: 'Black & White',
    description: 'Desaturate the clip toward black & white.',
    createDefault: () => ({ type: 'grayscale', amount: 1 }),
    params: [
      { key: 'amount', label: 'Intensity', min: 0, max: 1, step: 0.05, format: pct },
    ],
  },
  {
    type: 'shake',
    label: 'Camera Shake',
    description: 'Add an oscillating jitter for a handheld / impact feel.',
    createDefault: () => ({ type: 'shake', intensity: 8, speed: 1 }),
    params: [
      { key: 'intensity', label: 'Intensity', min: 0, max: 40, step: 1, format: px },
      { key: 'speed', label: 'Speed', min: 0.2, max: 4, step: 0.1, format: mult },
    ],
  },
];

export function getEffectDefinition(type: StudioEffectType): EffectDefinition {
  // Non-null: EFFECT_DEFINITIONS covers every StudioEffectType.
  return EFFECT_DEFINITIONS.find((d) => d.type === type)!;
}

export function findEffect(
  effects: StudioEffect[] | undefined,
  type: StudioEffectType
): StudioEffect | undefined {
  return effects?.find((e) => e.type === type);
}

// Add the effect's default (if absent) or remove it (if present). Returns a new
// array; `undefined` when the result is empty so the clip clears its `effects`.
export function toggleEffect(
  effects: StudioEffect[] | undefined,
  type: StudioEffectType
): StudioEffect[] | undefined {
  const current = effects ?? [];
  const next = findEffect(current, type)
    ? current.filter((e) => e.type !== type)
    : [...current, getEffectDefinition(type).createDefault()];
  return next.length > 0 ? next : undefined;
}

// Patch a single numeric param of one effect. No-op (returns the input) when the
// effect isn't enabled, so callers don't have to guard.
export function updateEffectParam(
  effects: StudioEffect[] | undefined,
  type: StudioEffectType,
  key: string,
  value: number
): StudioEffect[] | undefined {
  if (!effects || !findEffect(effects, type)) return effects;
  return effects.map((e) =>
    e.type === type ? ({ ...e, [key]: value } as StudioEffect) : e
  );
}

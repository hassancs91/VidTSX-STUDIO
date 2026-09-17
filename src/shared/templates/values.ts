// What a template's form holds, and what the composition receives from it.
// PURE — shared by the renderer's session hook and main's autosave store.
//
// Saved state keeps only the keys that DIFFER from the manifest default, so a
// template update that changes a default reaches everyone who never touched
// that field, and a removed or retyped control drops out instead of feeding the
// composition a value it no longer understands.

import type {
  ParamValue,
  TemplateFormatOption,
  TemplateManifest,
  TemplatePreset,
  TemplateSavedState,
} from '../types/templates';
import { controlValueProblem } from './manifest';

export type TemplateValues = Record<string, ParamValue>;

/** Every control at its manifest default. */
export function defaultValues(manifest: TemplateManifest): TemplateValues {
  const out: TemplateValues = {};
  for (const c of manifest.controls) out[c.key] = c.default;
  return out;
}

/** Defaults overlaid with whatever of `saved` still fits the current manifest. */
export function resolveValues(manifest: TemplateManifest, saved: Record<string, unknown> | undefined): TemplateValues {
  const out = defaultValues(manifest);
  if (!saved) return out;
  for (const c of manifest.controls) {
    const value = saved[c.key];
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue;
    if (controlValueProblem(c, value) === null) out[c.key] = value;
  }
  return out;
}

/** The chosen format, falling back to the manifest default when `value` is stale. */
export function resolveFormat(manifest: TemplateManifest, value: string | undefined): TemplateFormatOption | null {
  const formats = manifest.formats;
  if (!formats) return null;
  return (
    formats.options.find((o) => o.value === value) ??
    formats.options.find((o) => o.value === formats.default) ??
    formats.options[0]
  );
}

/** Only what differs from the defaults — what autosave writes. */
export function changedValues(manifest: TemplateManifest, values: TemplateValues): TemplateValues {
  const out: TemplateValues = {};
  for (const c of manifest.controls) {
    const value = values[c.key];
    if (value !== undefined && value !== c.default) out[c.key] = value;
  }
  return out;
}

/** A preset overlays its keys; everything else the user set is kept. */
export function applyPreset(values: TemplateValues, preset: TemplatePreset): TemplateValues {
  return { ...values, ...preset.values };
}

/**
 * The preset whose every key matches `values`, so the form can show it as
 * active. When several match, the one that pins the most keys wins — it is the
 * closest description of what is on screen.
 */
export function activePresetId(manifest: TemplateManifest, values: TemplateValues): string | null {
  let best: { id: string; keys: number } | null = null;
  for (const preset of manifest.presets) {
    const keys = Object.keys(preset.values);
    if (keys.length === 0 || !keys.every((k) => values[k] === preset.values[k])) continue;
    if (!best || keys.length > best.keys) best = { id: preset.id, keys: keys.length };
  }
  return best?.id ?? null;
}

/** The props the composition receives: every control, plus the format prop. */
export function buildInputProps(
  manifest: TemplateManifest,
  values: TemplateValues,
  format: TemplateFormatOption | null,
): TemplateValues {
  const out = resolveValues(manifest, values);
  if (manifest.formats && format) out[manifest.formats.prop] = format.value;
  return out;
}

export function toSavedState(
  manifest: TemplateManifest,
  values: TemplateValues,
  format: TemplateFormatOption | null,
): TemplateSavedState {
  return {
    templateVersion: manifest.version,
    ...(format ? { format: format.value } : {}),
    values: changedValues(manifest, values),
  };
}

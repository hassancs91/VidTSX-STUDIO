// Per-clip filter edits (docs/studio/FILTER_PACKS_DESIGN.md "UI") — pure,
// identity-on-reject, the transition-ops contract. A clip's `effects[]` is
// render order: the filter slot first, then the effect. The slot rule (one
// filter + one effect per clip) lives HERE, in `setClipEffect`: a new entry
// replaces the entry of its own category. Categories come from the installed
// list, so the caller passes them in — an entry whose pack is gone has no
// category and is left alone (it shows the plain picture and comes back with
// the pack). The neutral rule (`normalizeEffectParams`): a value equal to the
// manifest default is dropped, so documents never accumulate no-op state.

import type { SerializedTimeline } from '@shared/studio/serialize';
import { INTENSITY_PARAM } from '@shared/studio/filter-pack';
import type {
  FilterCategory,
  FilterParameter,
  StudioClip,
  StudioClipEffect,
  StudioClipKind,
  StudioTimeline,
} from '../types';
import { findClip, withTrackClips } from './timeline-ops';

/** The kinds with a raster source — the only clips a filter applies to. */
export function isEffectClipKind(kind: StudioClipKind): boolean {
  return kind === 'video' || kind === 'image';
}

export type EffectParams = Record<string, number | string>;

/** What the neutral rule measures a value against: the manifest entry's defaults. */
export interface EffectDefaults {
  intensity: number;
  parameters: readonly FilterParameter[];
}

export type CategoryOf = (kind: string) => FilterCategory | undefined;

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function sameParams(a?: EffectParams, b?: EffectParams): boolean {
  const ka = Object.keys(a ?? {});
  const kb = Object.keys(b ?? {});
  return ka.length === kb.length && ka.every((k) => a?.[k] === b?.[k]);
}

function sameEntry(a: StudioClipEffect, b: StudioClipEffect): boolean {
  return a.kind === b.kind && (a.disabled ?? false) === (b.disabled ?? false) && sameParams(a.params, b.params);
}

function sameEffects(a: readonly StudioClipEffect[] | undefined, b: readonly StudioClipEffect[]): boolean {
  return (a?.length ?? 0) === b.length && b.every((entry, i) => sameEntry(a![i], entry));
}

/** The clip with this list, the key deleted when it is empty. */
function withEffects(clip: StudioClip, effects: StudioClipEffect[]): StudioClip {
  const next = { ...clip };
  if (effects.length === 0) delete next.effects;
  else next.effects = effects;
  return next;
}

function replaceEffects(timeline: StudioTimeline, clipId: string, effects: StudioClipEffect[]): StudioTimeline {
  const found = findClip(timeline, clipId);
  if (!found) return timeline;
  return withTrackClips(
    timeline,
    found.track.id,
    found.track.clips.map((c) => (c.id === clipId ? withEffects(c, effects) : c)),
  );
}

/**
 * Apply a pack filter to every eligible clip among `clipIds` — video or image
 * on an unlocked track — replacing the entry of the same category (the slot
 * rule). A filter goes first, an effect last, so the array stays in render
 * order. Re-applying a kind the clip already carries keeps its params and
 * re-enables it. One call = one undo step for the whole selection.
 */
export function setClipEffect(
  timeline: StudioTimeline,
  clipIds: readonly string[],
  kind: string,
  category: FilterCategory,
  categoryOf: CategoryOf,
): StudioTimeline {
  let out = timeline;
  for (const clipId of clipIds) {
    const found = findClip(out, clipId);
    if (!found || found.track.locked || !isEffectClipKind(found.clip.kind)) continue;
    const current = found.clip.effects ?? [];
    const existing = current.find((e) => e.kind === kind);
    const entry: StudioClipEffect = existing ? { kind, ...(existing.params ? { params: existing.params } : {}) } : { kind };
    const kept = current.filter((e) => e.kind !== kind && categoryOf(e.kind) !== category);
    const effects = category === 'filter' ? [entry, ...kept] : [...kept, entry];
    if (sameEffects(current, effects)) continue;
    out = replaceEffects(out, clipId, effects);
  }
  return out;
}

/**
 * The neutral rule. Against the manifest's defaults: intensity is clamped to
 * 0–1 and dropped at the default; a knob is clamped to its range (a colour
 * must be `#rrggbb`) and dropped at its default; a key no spec knows is
 * dropped. Without defaults (the pack is not installed) values pass through
 * untouched. Nothing left = no `params` key at all.
 */
export function normalizeEffectParams(params: EffectParams, defaults?: EffectDefaults): EffectParams | undefined {
  const out: EffectParams = {};
  if (!defaults) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' || Number.isFinite(value)) out[key] = value;
    }
  } else {
    const specs = new Map(defaults.parameters.map((p) => [p.key, p]));
    for (const [key, value] of Object.entries(params)) {
      if (key === INTENSITY_PARAM) {
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        const clamped = Math.max(0, Math.min(1, value));
        if (clamped !== defaults.intensity) out[key] = clamped;
        continue;
      }
      const spec = specs.get(key);
      if (!spec) continue;
      if (spec.type === 'color') {
        if (typeof value === 'string' && COLOR_PATTERN.test(value) && value.toLowerCase() !== spec.default.toLowerCase()) {
          out[key] = value.toLowerCase();
        }
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        const clamped = Math.max(spec.min, Math.min(spec.max, value));
        if (clamped !== spec.default) out[key] = clamped;
      }
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Patch one entry's params (merged over what it has) and/or its enabled
 * state. The Inspector commits this once per slider release — one undo step.
 */
export function updateClipEffect(
  timeline: StudioTimeline,
  clipId: string,
  kind: string,
  patch: { params?: EffectParams; disabled?: boolean },
  defaults?: EffectDefaults,
): StudioTimeline {
  const found = findClip(timeline, clipId);
  if (!found || found.track.locked) return timeline;
  const current = found.clip.effects ?? [];
  const index = current.findIndex((e) => e.kind === kind);
  if (index < 0) return timeline;
  const entry = current[index];
  const next: StudioClipEffect = { kind };
  const params = normalizeEffectParams({ ...entry.params, ...patch.params }, defaults);
  if (params) next.params = params;
  if (patch.disabled ?? entry.disabled ?? false) next.disabled = true;
  if (sameEntry(entry, next)) return timeline;
  const effects = current.slice();
  effects[index] = next;
  return replaceEffects(timeline, clipId, effects);
}

/** Drop one kind from every listed clip — the key goes with the last entry. */
export function removeClipEffect(timeline: StudioTimeline, clipIds: readonly string[], kind: string): StudioTimeline {
  let out = timeline;
  for (const clipId of clipIds) {
    const found = findClip(out, clipId);
    if (!found || found.track.locked || !found.clip.effects?.some((e) => e.kind === kind)) continue;
    out = replaceEffects(out, clipId, found.clip.effects.filter((e) => e.kind !== kind));
  }
  return out;
}

/**
 * The live-preview injection (the `overrideClipTransform` twin): the serialized
 * timeline with one entry's params merged over — what a slider drag shows
 * without a reducer dispatch per pixel. Returns the SAME object when the clip
 * or the entry isn't in the serialization, so memos don't churn.
 */
export function overrideClipEffect(
  timeline: SerializedTimeline,
  clipId: string,
  kind: string,
  params: EffectParams,
): SerializedTimeline {
  let changed = false;
  const tracks = timeline.tracks.map((track) => {
    const index = track.clips.findIndex((c) => c.id === clipId && c.effects?.some((e) => e.kind === kind));
    if (index === -1) return track;
    changed = true;
    const clips = track.clips.slice();
    const clip = clips[index];
    clips[index] = {
      ...clip,
      effects: (clip.effects ?? []).map((e) => (e.kind === kind ? { ...e, params: { ...e.params, ...params } } : e)),
    };
    return { ...track, clips };
  });
  return changed ? { ...timeline, tracks } : timeline;
}

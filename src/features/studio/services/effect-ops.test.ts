import { describe, expect, it } from 'vitest';
import type { SerializedTimeline } from '@shared/studio/serialize';
import type { FilterCategory, StudioClip, StudioTimeline } from '../types';
import {
  normalizeEffectParams,
  overrideClipEffect,
  removeClipEffect,
  setClipEffect,
  updateClipEffect,
  type EffectDefaults,
} from './effect-ops';

const CATEGORIES: Record<string, FilterCategory> = { 'core/noir': 'filter', 'core/vivid': 'filter', 'core/vhs': 'effect', 'core/bloom': 'effect' };
const categoryOf = (kind: string) => CATEGORIES[kind];

/** V1: a video clip, an image clip and an audio clip; V2 is locked. */
function base(effects?: Record<string, StudioClip['effects']>): StudioTimeline {
  const with_ = (id: string) => (effects?.[id] ? { effects: effects[id] } : {});
  return {
    tracks: [
      {
        id: 'v1', kind: 'video', name: 'V1',
        clips: [
          { id: 'a', kind: 'video', assetId: 'x', timelineStart: 0, duration: 4, sourceIn: 0, ...with_('a') },
          { id: 'i', kind: 'image', assetId: 'p', timelineStart: 4, duration: 2, ...with_('i') },
          { id: 's', kind: 'audio', assetId: 'x', timelineStart: 6, duration: 2, sourceIn: 0, ...with_('s') },
        ],
      },
      { id: 'v2', kind: 'video', name: 'V2', locked: true, clips: [{ id: 'l', kind: 'video', assetId: 'x', timelineStart: 0, duration: 4, sourceIn: 0, ...with_('l') }] },
    ],
  };
}
const clip = (t: StudioTimeline, id: string) => t.tracks.flatMap((tr) => tr.clips).find((c) => c.id === id)!;

describe('setClipEffect', () => {
  it('applies to video and image clips, skips sound and locked tracks, one step for the selection', () => {
    const t = base();
    const next = setClipEffect(t, ['a', 'i', 's', 'l', 'nope'], 'core/noir', 'filter', categoryOf);
    expect(clip(next, 'a').effects).toEqual([{ kind: 'core/noir' }]);
    expect(clip(next, 'i').effects).toEqual([{ kind: 'core/noir' }]);
    expect(clip(next, 's').effects).toBeUndefined();
    expect(clip(next, 'l').effects).toBeUndefined();
    // The locked track is the same object: nothing there was touched.
    expect(next.tracks[1]).toBe(t.tracks[1]);
  });

  it('replaces the entry of its own category and keeps the other slot — filter first, effect last', () => {
    const t = base({ a: [{ kind: 'core/noir', params: { intensity: 0.5 } }, { kind: 'core/vhs' }] });
    const swapped = setClipEffect(t, ['a'], 'core/vivid', 'filter', categoryOf);
    expect(clip(swapped, 'a').effects).toEqual([{ kind: 'core/vivid' }, { kind: 'core/vhs' }]);
    const effect = setClipEffect(t, ['a'], 'core/bloom', 'effect', categoryOf);
    expect(clip(effect, 'a').effects).toEqual([{ kind: 'core/noir', params: { intensity: 0.5 } }, { kind: 'core/bloom' }]);
    // An effect on a clip that only has a filter lands after it.
    const onlyFilter = setClipEffect(base({ a: [{ kind: 'core/noir' }] }), ['a'], 'core/vhs', 'effect', categoryOf);
    expect(clip(onlyFilter, 'a').effects?.map((e) => e.kind)).toEqual(['core/noir', 'core/vhs']);
    // A filter on a clip that only has an effect lands before it.
    const onlyEffect = setClipEffect(base({ a: [{ kind: 'core/vhs' }] }), ['a'], 'core/noir', 'filter', categoryOf);
    expect(clip(onlyEffect, 'a').effects?.map((e) => e.kind)).toEqual(['core/noir', 'core/vhs']);
  });

  it('leaves an entry of unknown category alone (its pack is gone) and re-enables a re-applied kind with its params', () => {
    const t = base({ a: [{ kind: 'gone/thing', params: { intensity: 0.3 } }, { kind: 'core/vhs', params: { intensity: 0.4 }, disabled: true }] });
    const next = setClipEffect(t, ['a'], 'core/vhs', 'effect', categoryOf);
    expect(clip(next, 'a').effects).toEqual([{ kind: 'gone/thing', params: { intensity: 0.3 } }, { kind: 'core/vhs', params: { intensity: 0.4 } }]);
  });

  it('is identity when nothing changes', () => {
    const t = base({ a: [{ kind: 'core/noir' }] });
    expect(setClipEffect(t, ['a'], 'core/noir', 'filter', categoryOf)).toBe(t);
    expect(setClipEffect(t, ['s', 'l'], 'core/noir', 'filter', categoryOf)).toBe(t);
  });
});

const BLOOM: EffectDefaults = {
  intensity: 1,
  parameters: [
    { key: 'warmth', label: 'Warmth', type: 'range', min: -1, max: 1, step: 0.05, default: 0.2 },
    { key: 'tint', label: 'Tint', type: 'color', default: '#ffffff' },
  ],
};

describe('normalizeEffectParams — the neutral rule', () => {
  it('drops defaults, unknown keys and bad values; clamps the rest', () => {
    expect(normalizeEffectParams({ intensity: 1, warmth: 0.2, tint: '#FFFFFF', bogus: 3 }, BLOOM)).toBeUndefined();
    // Intensity 2 clamps to 1, which IS the default, so it is dropped too.
    expect(normalizeEffectParams({ intensity: 2, warmth: -5, tint: '#AABBCC' }, BLOOM)).toEqual({ warmth: -1, tint: '#aabbcc' });
    expect(normalizeEffectParams({ intensity: 0.5, warmth: Number.NaN, tint: 'red' }, BLOOM)).toEqual({ intensity: 0.5 });
  });

  it('passes values through when the pack is not installed', () => {
    expect(normalizeEffectParams({ intensity: 1, anything: 'x', n: Number.NaN })).toEqual({ intensity: 1, anything: 'x' });
  });
});

describe('updateClipEffect', () => {
  it('merges params over the entry, applies the neutral rule and toggles disabled — one entry, one step', () => {
    const t = base({ a: [{ kind: 'core/noir' }, { kind: 'core/bloom', params: { warmth: 0.8 } }] });
    const warmer = updateClipEffect(t, 'a', 'core/bloom', { params: { intensity: 0.5 } }, BLOOM);
    expect(clip(warmer, 'a').effects?.[1]).toEqual({ kind: 'core/bloom', params: { warmth: 0.8, intensity: 0.5 } });
    const neutral = updateClipEffect(warmer, 'a', 'core/bloom', { params: { intensity: 1, warmth: 0.2 } }, BLOOM);
    expect(clip(neutral, 'a').effects?.[1]).toEqual({ kind: 'core/bloom' });
    const off = updateClipEffect(t, 'a', 'core/bloom', { disabled: true }, BLOOM);
    expect(clip(off, 'a').effects?.[1]).toEqual({ kind: 'core/bloom', params: { warmth: 0.8 }, disabled: true });
    const on = updateClipEffect(off, 'a', 'core/bloom', { disabled: false }, BLOOM);
    expect(clip(on, 'a').effects?.[1]).toEqual({ kind: 'core/bloom', params: { warmth: 0.8 } });
    // The other entry is untouched.
    expect(clip(on, 'a').effects?.[0]).toBe(t.tracks[0].clips[0].effects?.[0]);
  });

  it('is identity for an unknown clip or kind, a locked track, or an unchanged value', () => {
    const t = base({ a: [{ kind: 'core/bloom', params: { warmth: 0.8 } }], l: [{ kind: 'core/bloom' }] });
    expect(updateClipEffect(t, 'zzz', 'core/bloom', { params: { warmth: 0.1 } }, BLOOM)).toBe(t);
    expect(updateClipEffect(t, 'a', 'core/vhs', { params: { warmth: 0.1 } }, BLOOM)).toBe(t);
    expect(updateClipEffect(t, 'l', 'core/bloom', { params: { warmth: 0.1 } }, BLOOM)).toBe(t);
    expect(updateClipEffect(t, 'a', 'core/bloom', { params: { warmth: 0.8 } }, BLOOM)).toBe(t);
  });
});

describe('removeClipEffect', () => {
  it('drops the kind from every listed clip and deletes the key with the last entry', () => {
    const t = base({ a: [{ kind: 'core/noir' }, { kind: 'core/vhs' }], i: [{ kind: 'core/vhs' }] });
    const next = removeClipEffect(t, ['a', 'i', 's'], 'core/vhs');
    expect(clip(next, 'a').effects).toEqual([{ kind: 'core/noir' }]);
    expect(clip(next, 'i').effects).toBeUndefined();
    expect(removeClipEffect(t, ['a'], 'core/bloom')).toBe(t);
  });
});

describe('overrideClipEffect', () => {
  const serialized: SerializedTimeline = {
    width: 1280, height: 720, fps: 30, durationInFrames: 120,
    tracks: [{ id: 'v1', kind: 'video', clips: [
      { id: 'a', kind: 'video', from: 0, durationInFrames: 120, src: 'u', effects: [{ kind: 'core/noir' }, { kind: 'core/bloom', params: { warmth: 0.8 } }] },
    ] }],
  };

  it('merges params over the one entry, leaving the document untouched', () => {
    const next = overrideClipEffect(serialized, 'a', 'core/bloom', { intensity: 0.3 });
    expect(next.tracks[0].clips[0].effects).toEqual([{ kind: 'core/noir' }, { kind: 'core/bloom', params: { warmth: 0.8, intensity: 0.3 } }]);
    expect(serialized.tracks[0].clips[0].effects?.[1].params).toEqual({ warmth: 0.8 });
  });

  it('returns the same object when the clip or the entry is not there', () => {
    expect(overrideClipEffect(serialized, 'b', 'core/bloom', { intensity: 0.3 })).toBe(serialized);
    expect(overrideClipEffect(serialized, 'a', 'core/vhs', { intensity: 0.3 })).toBe(serialized);
  });
});

import { describe, expect, it } from 'vitest';
import type { StudioProjectSettings } from '@shared/types/studio';
import { cutStyleOverrideChoice, withCutStyleOverride } from './cut-style-override';

const BASE: StudioProjectSettings = { width: 1920, height: 1080, fps: 30, agent: {}, presetId: 'p1' };

describe('cutStyleOverrideChoice', () => {
  it('reads no override as the preset', () => {
    expect(cutStyleOverrideChoice(undefined)).toBe('preset');
  });

  it('reads the stored base', () => {
    expect(cutStyleOverrideChoice({ base: 'relaxed' })).toBe('relaxed');
    expect(cutStyleOverrideChoice({ base: 'natural', head: 0.2 })).toBe('natural');
  });

  it('reads knobs without a base as the preset', () => {
    expect(cutStyleOverrideChoice({ head: 0.2 })).toBe('preset');
  });

  it('reads a hand-written bare name and ignores garbage', () => {
    expect(cutStyleOverrideChoice('natural')).toBe('natural');
    expect(cutStyleOverrideChoice({ base: 'loose' })).toBe('preset');
    expect(cutStyleOverrideChoice(42)).toBe('preset');
  });
});

describe('withCutStyleOverride', () => {
  it('pins a base on a project without an override, keeping every other setting', () => {
    const next = withCutStyleOverride(BASE, 'natural');
    expect(next).toEqual({ ...BASE, cutStyle: { base: 'natural' } });
    expect(BASE.cutStyle).toBeUndefined(); // the input is not mutated
  });

  it('replaces an earlier base', () => {
    const next = withCutStyleOverride({ ...BASE, cutStyle: { base: 'natural' } }, 'tight');
    expect(next.cutStyle).toEqual({ base: 'tight' });
  });

  it('back to the preset removes cutStyle entirely', () => {
    const next = withCutStyleOverride({ ...BASE, cutStyle: { base: 'relaxed' } }, 'preset');
    expect('cutStyle' in next).toBe(false);
    expect(next.presetId).toBe('p1');
  });

  it('keeps hand-written knobs when the base changes or clears', () => {
    const withKnob: StudioProjectSettings = { ...BASE, cutStyle: { base: 'tight', margin: 9 } };
    expect(withCutStyleOverride(withKnob, 'natural').cutStyle).toEqual({ base: 'natural', margin: 9 });
    expect(withCutStyleOverride(withKnob, 'preset').cutStyle).toEqual({ margin: 9 });
  });

  it('drops garbage in the stored spec instead of carrying it forward', () => {
    const junk = { ...BASE, cutStyle: { base: 'loose', head: -5 } } as unknown as StudioProjectSettings;
    expect(withCutStyleOverride(junk, 'relaxed').cutStyle).toEqual({ base: 'relaxed' });
    expect('cutStyle' in withCutStyleOverride(junk, 'preset')).toBe(false);
  });
});

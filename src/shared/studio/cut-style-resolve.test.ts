import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StudioPresetStyle } from '../types/studio-preset';
import { parseCutStyleFile } from './cut-style-spec';
import { cutStyleKey, pacingToCutBase, resolveCutStyle } from './cut-style-resolve';

const FILE = parseCutStyleFile(
  JSON.parse(readFileSync(path.resolve(process.cwd(), 'resources/skills/studio-clean-cut/cut-style.json'), 'utf8')),
);
const preset = (style: StudioPresetStyle, name = 'Shorts') => ({ name, style });
const project = (cutStyle: unknown) => ({ settings: { cutStyle } });

describe('resolveCutStyle — rung 5, the file default', () => {
  it('no project, no preset → the default style, untouched', () => {
    const r = resolveCutStyle(FILE);
    expect(r).toMatchObject({ styleName: 'tight', source: 'default', overrides: [], displayName: 'tight · default' });
    expect(r.style).toEqual(FILE.styles.tight);
    expect(r.presetName).toBeUndefined();
  });

  it('an old preset (no cut, no pacing) and an old project (no cutStyle) resolve to the default', () => {
    const r = resolveCutStyle(FILE, { project: { settings: {} }, preset: preset({ shotsPerMinute: 4 }) });
    expect(r).toMatchObject({ styleName: 'tight', source: 'default', displayName: 'tight · default' });
  });

  it('follows the file when its default changes', () => {
    expect(resolveCutStyle({ ...FILE, default: 'natural' }).styleName).toBe('natural');
  });
});

describe('resolveCutStyle — rung 4, pacing mapped', () => {
  it.each([
    ['tight', 'tight'],
    ['normal', 'natural'],
    ['relaxed', 'relaxed'],
  ] as const)('pacing %s → %s', (pacing, base) => {
    const r = resolveCutStyle(FILE, { preset: preset({ pacing }) });
    expect(r).toMatchObject({ styleName: base, source: 'pacing', presetName: 'Shorts', overrides: [] });
    expect(r.displayName).toBe(`${base} · preset “Shorts”`);
    expect(r.style).toEqual(FILE.styles[base]);
  });

  it('pacingToCutBase ignores unknown values (incl. prototype keys)', () => {
    expect(pacingToCutBase('toString')).toBeUndefined();
    expect(pacingToCutBase(undefined)).toBeUndefined();
    expect(resolveCutStyle(FILE, { preset: { name: 'X', style: { pacing: 'toString' } as unknown as StudioPresetStyle } }).source).toBe('default');
  });
});

describe('resolveCutStyle — rung 3, the preset cut', () => {
  it('base + knobs over that base', () => {
    const r = resolveCutStyle(FILE, { preset: preset({ cut: { base: 'natural', head: 0.25 } }) });
    expect(r).toMatchObject({ styleName: 'natural', source: 'preset', overrides: ['head'] });
    expect(r.style).toEqual({ ...FILE.styles.natural, head: 0.25 });
    expect(r.displayName).toBe('natural + 1 override · preset “Shorts”');
  });

  it('cut.base beats pacing', () => {
    expect(resolveCutStyle(FILE, { preset: preset({ pacing: 'relaxed', cut: { base: 'natural' } }) }).styleName).toBe('natural');
  });

  it('knobs without a base sit on the mapped pacing, else the file default', () => {
    const paced = resolveCutStyle(FILE, { preset: preset({ pacing: 'relaxed', cut: { minTail: 0.5, maxTail: 0.9 } }) });
    expect(paced).toMatchObject({ styleName: 'relaxed', source: 'preset', overrides: ['minTail', 'maxTail'] });
    expect(paced.displayName).toBe('relaxed + 2 overrides · preset “Shorts”');
    const bare = resolveCutStyle(FILE, { preset: preset({ cut: { margin: 9 } }) });
    expect(bare).toMatchObject({ styleName: 'tight', source: 'preset', overrides: ['margin'] });
  });

  it('a knob equal to the base is not an override', () => {
    expect(resolveCutStyle(FILE, { preset: preset({ cut: { base: 'tight', head: 0.15 } }) }).overrides).toEqual([]);
  });

  it('a garbage cut falls through to pacing', () => {
    const style = { pacing: 'normal', cut: { base: 'loose', head: -3 } } as unknown as StudioPresetStyle;
    expect(resolveCutStyle(FILE, { preset: preset(style) })).toMatchObject({ styleName: 'natural', source: 'pacing' });
  });
});

describe('resolveCutStyle — rung 2, the project override', () => {
  const tuned = preset({ pacing: 'tight', cut: { base: 'natural', head: 0.25 } });

  it('a base replaces the preset choice entirely (its knobs too)', () => {
    const r = resolveCutStyle(FILE, { project: project({ base: 'relaxed' }), preset: tuned });
    expect(r).toMatchObject({ styleName: 'relaxed', source: 'project', overrides: [], displayName: 'relaxed · project override' });
    expect(r.style).toEqual(FILE.styles.relaxed);
    expect(r.presetName).toBeUndefined();
  });

  it('a base + knobs', () => {
    const r = resolveCutStyle(FILE, { project: project({ base: 'tight', margin: 10 }), preset: tuned });
    expect(r.style).toEqual({ ...FILE.styles.tight, margin: 10 });
    expect(r.displayName).toBe('tight + 1 override · project override');
  });

  it('knobs alone layer over the preset choice (both count as overrides)', () => {
    const r = resolveCutStyle(FILE, { project: project({ maxTail: 0.5 }), preset: tuned });
    expect(r).toMatchObject({ styleName: 'natural', source: 'project', presetName: 'Shorts', overrides: ['head', 'maxTail'] });
    expect(r.style).toEqual({ ...FILE.styles.natural, head: 0.25, maxTail: 0.5 });
    expect(r.displayName).toBe('natural + 2 overrides · project override');
  });

  it('works without a preset, and a bare name is a base', () => {
    expect(resolveCutStyle(FILE, { project: project('natural') })).toMatchObject({ styleName: 'natural', source: 'project' });
    expect(resolveCutStyle(FILE, { project: project({ head: 0.2 }) })).toMatchObject({ styleName: 'tight', overrides: ['head'] });
  });

  it('a garbage override is ignored', () => {
    expect(resolveCutStyle(FILE, { project: project({ base: 'loose' }), preset: tuned }).source).toBe('preset');
    expect(resolveCutStyle(FILE, { project: project(42) }).source).toBe('default');
  });
});

describe('resolveCutStyle — rung 1, the per-call style', () => {
  it('wins over the project and the preset, and is the named style as-is', () => {
    const r = resolveCutStyle(FILE, {
      callStyle: 'natural',
      project: project({ base: 'relaxed', head: 0.4 }),
      preset: preset({ cut: { base: 'tight', margin: 3 } }),
    });
    expect(r).toMatchObject({ styleName: 'natural', source: 'call', overrides: [], displayName: 'natural · requested' });
    expect(r.style).toEqual(FILE.styles.natural);
  });

  it('an unknown call style is ignored', () => {
    expect(resolveCutStyle(FILE, { callStyle: 'loose' as 'tight' }).source).toBe('default');
  });
});

describe('the cache key', () => {
  it('is 8 hex, equal for equal knobs, new for any knob change', () => {
    const tight = resolveCutStyle(FILE).key;
    expect(tight).toMatch(/^[0-9a-f]{8}$/);
    expect(resolveCutStyle(FILE, { project: project('tight') }).key).toBe(tight);
    expect(cutStyleKey({ ...FILE.styles.tight })).toBe(tight);
    expect(cutStyleKey({ ...FILE.styles.tight, head: 0.16 })).not.toBe(tight);
    const noFric = { ...FILE.styles.tight };
    delete noFric.fricZcr;
    expect(cutStyleKey(noFric)).not.toBe(tight);
    const keys = new Set(['tight', 'natural', 'relaxed'].map((n) => cutStyleKey(FILE.styles[n as 'tight'])));
    expect(keys.size).toBe(3);
  });

  it('the resolved style is a copy — mutating it never touches the file', () => {
    const r = resolveCutStyle(FILE);
    r.style.head = 9;
    expect(FILE.styles.tight.head).toBe(0.15);
  });
});

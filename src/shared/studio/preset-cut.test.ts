import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCutStyleFile } from './cut-style-spec';
import { cutSpecProblems, presetCutBase, withPresetCutBase, withPresetCutKnob } from './preset-cut';
import { formatCutKnob } from './cut-style-labels';
import { resolveCutStyle } from './cut-style-resolve';

const FILE = parseCutStyleFile(
  JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'resources/skills/studio-clean-cut/cut-style.json'), 'utf8'),
  ) as unknown,
);

describe('presetCutBase', () => {
  it('is cut.base, else the mapped pacing, else the file default', () => {
    expect(presetCutBase({ pacing: 'tight', cut: { base: 'relaxed' } }, FILE)).toBe('relaxed');
    expect(presetCutBase({ pacing: 'normal' }, FILE)).toBe('natural');
    expect(presetCutBase({}, FILE)).toBe('tight');
  });
});

describe('withPresetCutKnob', () => {
  it('stores a knob only when it differs from the base', () => {
    const style = withPresetCutKnob({ pacing: 'normal', captions: 'block' }, 'head', 0.3, FILE);
    expect(style).toEqual({ pacing: 'normal', captions: 'block', cut: { head: 0.3 } });
    // natural's own head (0.21) is no override — the cut empties and goes.
    expect(withPresetCutKnob(style, 'head', 0.21, FILE)).toEqual({ pacing: 'normal', captions: 'block' });
    expect(withPresetCutKnob(style, 'head', undefined, FILE)).toEqual({ pacing: 'normal', captions: 'block' });
  });

  it('keeps the base when the last knob goes, and never sets an opt-in the base lacks', () => {
    const style = withPresetCutKnob({ cut: { base: 'natural', margin: 8 } }, 'margin', undefined, FILE);
    expect(style).toEqual({ cut: { base: 'natural' } });
    expect(withPresetCutKnob(style, 'fricZcr', 4000, FILE)).toEqual({ cut: { base: 'natural' } });
  });

  it('what it writes is what the resolver reads', () => {
    const preset = { name: 'Shorts', style: withPresetCutKnob({ pacing: 'tight' }, 'maxTail', 0.5, FILE) };
    const resolved = resolveCutStyle(FILE, { preset });
    expect(resolved.style).toEqual({ ...FILE.styles.tight, maxTail: 0.5 });
    expect(resolved.displayName).toBe('tight + 1 override · preset “Shorts”');
  });
});

describe('withPresetCutBase', () => {
  it('drops knobs equal to the new base and opt-ins it lacks, keeps the rest', () => {
    const style = { cut: { head: 0.21, margin: 9, fricZcr: 4000 } }; // over tight (default)
    expect(withPresetCutBase(style, 'natural', FILE)).toEqual({ cut: { base: 'natural', margin: 9 } });
  });

  it('back to "from pacing" clears the base; an empty cut is removed', () => {
    expect(withPresetCutBase({ pacing: 'relaxed', cut: { base: 'natural' } }, undefined, FILE)).toEqual({
      pacing: 'relaxed',
    });
  });

  it('with the current base it re-prunes after a pacing change', () => {
    // tight → normal pacing: the fricative knob tight had is not editable on natural any more.
    const style = { pacing: 'normal' as const, cut: { fricZcr: 4000, head: 0.3 } }; // no base: follows pacing
    expect(withPresetCutBase(style, undefined, FILE)).toEqual({ pacing: 'normal', cut: { head: 0.3 } });
  });
});

describe('cutSpecProblems', () => {
  it('accepts no cut, a bare style name and a sane spec', () => {
    expect(cutSpecProblems(undefined)).toEqual([]);
    expect(cutSpecProblems('natural')).toEqual([]);
    expect(cutSpecProblems({ base: 'tight', maxTail: 0.5 })).toEqual([]);
  });

  it('names a bad base, a non-object and every out-of-bounds knob', () => {
    expect(cutSpecProblems(42)).toEqual(['The cut style must be a base and knob values.']);
    expect(cutSpecProblems({ base: 'fast', head: 5, fricZcr: -1 })).toEqual([
      'The cut base must be tight, natural or relaxed.',
      'Cut lead-in must be between 0 and 2 s.',
      'Cut fricative zcr must be between 0 and 50000 /s.',
    ]);
  });

  it('checks the ranges inside the spec, and against the base when given', () => {
    expect(cutSpecProblems({ minTail: 0.6, maxTail: 0.4 })).toEqual(['Cut tail min is above tail max.']);
    expect(cutSpecProblems({ maxHead: 0.1, head: 0.2 })).toEqual(['Cut onset reach is below the lead-in.']);
    // tight's maxTail is 0.7: a minTail of 0.8 alone is only wrong once the base is known.
    expect(cutSpecProblems({ minTail: 0.8 })).toEqual([]);
    expect(cutSpecProblems({ minTail: 0.8 }, FILE.styles.tight)).toEqual(['Cut tail min is above tail max.']);
    expect(cutSpecProblems({ head: 0.35 }, FILE.styles.tight)).toEqual(['Cut onset reach is below the lead-in.']);
  });
});

describe('formatCutKnob', () => {
  it('prints the unit, and off for an absent opt-in', () => {
    expect(formatCutKnob('head', 0.15)).toBe('0.15 s');
    expect(formatCutKnob('margin', 12)).toBe('12 dB');
    expect(formatCutKnob('fricZcr', 3500)).toBe('3500 /s');
    expect(formatCutKnob('maxHead', undefined)).toBe('off');
  });
});

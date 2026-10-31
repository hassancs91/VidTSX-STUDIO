// B4: a learn card's knob changes on a preset style — flat knobs set, nested
// `cut.<knob>` changes written over the cut base like the preset form does,
// and B2's cut check on the result.

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseCutStyleFile } from '../../../shared/studio/cut-style-spec';
import { applyKnobChanges, hasCutKnobChanges, presetCutProblems } from './preset-knob-apply';

const FILE = parseCutStyleFile(
  JSON.parse(fs.readFileSync(path.resolve('resources', 'skills', 'studio-clean-cut', 'cut-style.json'), 'utf-8')),
);

describe('applyKnobChanges', () => {
  it('writes cut knobs over the base: a base value drops the override, others stay, flat knobs are set', () => {
    const next = applyKnobChanges(
      { pacing: 'normal', cut: { base: 'tight', head: 0.11, minTail: 0.14 } },
      [
        { key: 'pacing', from: 'normal', to: 'tight', reason: 'x' },
        { key: 'cut.head', from: 0.11, to: FILE.styles.tight.head, reason: 'x' },
        { key: 'cut.margin', from: FILE.styles.tight.margin, to: 9, reason: 'x' },
      ],
      FILE,
    );
    expect(next).toEqual({ pacing: 'tight', cut: { base: 'tight', minTail: 0.14, margin: 9 } });
  });

  it('without the file writes a plain override, and a style with no cut gets one', () => {
    expect(applyKnobChanges({ introSeconds: 8 }, [{ key: 'cut.minTail', from: 0.14, to: 0.08, reason: 'x' }])).toEqual({
      introSeconds: 8,
      cut: { minTail: 0.08 },
    });
  });

  it('flags a learned cut B2 would refuse, and knows when the file is needed', () => {
    const changes = [{ key: 'cut.minTail' as const, from: 0.08, to: 0.9, reason: 'x' }];
    expect(hasCutKnobChanges(changes)).toBe(true);
    expect(hasCutKnobChanges([{ key: 'pacing', to: 'tight', reason: 'x' }])).toBe(false);
    const next = applyKnobChanges({ cut: { base: 'tight', maxTail: 0.5 } }, changes, FILE);
    expect(presetCutProblems(next, FILE)).toEqual(['Cut tail min is above tail max.']);
    expect(presetCutProblems({ pacing: 'tight' }, FILE)).toEqual([]);
  });
});

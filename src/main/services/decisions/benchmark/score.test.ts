// The committed benchmark's REPLAY (DECISION_MODELS_DESIGN.md §15.1): the tree's scorer over D1's RECORDED Jev / Microsoft-Decision-1
// answers (copied scrubbed into ./fixtures) reproduces D1's `reports/c-hosted.md` §2 EXACTLY — every T2 / T3 cell, as printed there
// (table equality, the S1 precedent). T1 is not in the product benchmark (not a first user).
//
// The four rows below are COPIED VERBATIM from D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\reports\c-hosted.md §2 (lines of the
// "Results per provider × task" table); the test parses their cells and compares them with the cells the tree's scorer formats the way
// D1's score.cjs formats them (accuracy / selective `(100·x).toFixed(1)`, Brier / ECE `x.toFixed(3)`).

import { describe, expect, it } from 'vitest';
import { isDecisionCalibrated } from '../../../../decision-engine/calibration-table';
import type { DecisionProviderId } from '../../../../shared/types/decisions';
import t2 from './fixtures/t2-routing.json';
import t3 from './fixtures/t3-verify.json';
import jevT2 from './fixtures/hosted-jev-t2-choice.json';
import jevT3 from './fixtures/hosted-jev-t3-noul.json';
import msd1T2 from './fixtures/hosted-openrouter-msd1-t2-choice.json';
import msd1T3 from './fixtures/hosted-openrouter-msd1-t3-noul.json';
import { c2Cells, scoreChoiceAnswers, scoreNoulAnswers, type C2Cells } from './score';

const C_HOSTED_SECTION_2 = {
  'Jev T2':
    '| Jev | T2 choice (40, 6 families) | **100.0** (40 / 40) | 100.0 (10 / 10) | 0.021 (top-label; multiclass 0.001) | 0.059 | 100.0 (100.0) | 100.0 (90.0) | 100.0 (82.5) | 0 |',
  'Jev T3': '| Jev | T3 noul (40) | **100.0** (40 / 40) | 100.0 (7 / 7) | 0.003 | 0.044 | 100.0 (100.0) | 100.0 (100.0) | 100.0 (97.5) | — |',
  'MSD1 T2':
    '| MSD1 | T2 choice | **100.0** (40 / 40) | 100.0 (10 / 10) | 0.014 (multiclass 0.000) | 0.044 | 100.0 (100.0) | 100.0 (95.0) | 100.0 (87.5) | 0 |',
  'MSD1 T3': '| MSD1 | T3 noul | **100.0** (40 / 40) | 100.0 (7 / 7) | 0.002 | 0.013 | 100.0 (100.0) | 100.0 (100.0) | 100.0 (95.0) | — |',
} as const;

/** One §2 row → its cells (bold marks dropped; the Brier cell split into top-label / binary and the multiclass note). */
function parseRow(row: string): C2Cells {
  const cells = row.split('|').slice(1, -1).map((c) => c.trim().replace(/\*\*/g, ''));
  const brier = /^(\d\.\d{3})(?: \((?:top-label; )?multiclass (\d\.\d{3})\))?$/.exec(cells[4]);
  if (!brier) throw new Error(`unparsed Brier cell: ${cells[4]}`);
  return {
    accuracy: cells[2],
    arabic: cells[3],
    brier: brier[1],
    ...(brier[2] !== undefined ? { brierMulticlass: brier[2] } : {}),
    ece: cells[5],
    selective: [cells[6], cells[7], cells[8]],
    offList: cells[9],
  };
}

const scored = {
  'Jev T2': scoreChoiceAnswers(jevT2, t2),
  'Jev T3': scoreNoulAnswers(jevT3, t3),
  'MSD1 T2': scoreChoiceAnswers(msd1T2, t2),
  'MSD1 T3': scoreNoulAnswers(msd1T3, t3),
};

describe('the replay = c-hosted.md §2 (table equality)', () => {
  for (const name of Object.keys(C_HOSTED_SECTION_2) as Array<keyof typeof C_HOSTED_SECTION_2>) {
    it(`${name}: every cell as printed`, () => {
      expect(c2Cells(scored[name])).toEqual(parseRow(C_HOSTED_SECTION_2[name]));
    });
  }

  it('the brief’s headline numbers (Jev 40 / 40, 40 / 40, Brier 0.021 / 0.003, ECE 0.059 / 0.044; MSD1 40 / 40, 40 / 40, 0.014 / 0.002)', () => {
    const headline = Object.fromEntries(
      Object.entries(scored).map(([name, s]) => [name, [s.groups.ALL.right, s.groups.ALL.n, s.groups.ALL.brier?.toFixed(3), s.groups.ALL.ece?.toFixed(3)]]),
    );
    expect(headline).toEqual({
      'Jev T2': [40, 40, '0.021', '0.059'],
      'Jev T3': [40, 40, '0.003', '0.044'],
      'MSD1 T2': [40, 40, '0.014', '0.044'],
      'MSD1 T3': [40, 40, '0.002', '0.013'],
    });
  });

  it('every row of each set was answered and scored; the probabilities summed to 1 within rounding', () => {
    for (const s of Object.values(scored)) {
      expect(s.groups.ALL).toMatchObject({ rows: 40, n: 40, answered: 40, missing: 0 });
      expect(s.maxProbSumDeviation).toBeLessThan(1e-6);
    }
    expect(scored['Jev T3'].groups.template.rows + scored['Jev T3'].groups.caption.rows + scored['Jev T3'].groups.clip.rows).toBe(40);
    expect([scored['Jev T3'].groups.template.rows, scored['Jev T3'].groups.caption.rows, scored['Jev T3'].groups.clip.rows]).toEqual([16, 10, 14]);
  });

  it('D1’s recorded latencies and served models come through (one 40-question request per set)', () => {
    expect(Object.values(scored).map((s) => [s.latency.all.n, s.latency.all.p95])).toEqual([[1, 499], [1, 342], [1, 2983], [1, 1084]]);
  });
});

describe('the replayed answers are the calibration table’s measured rows (D2 §15.1 as read by D-r17)', () => {
  // The table itself is pinned row by row in src/decision-engine/calibration-table.test.ts (six rows, D-r17 (4)); this ties the
  // replay to it: the model each recorded answer was SERVED by is calibrated for its task's family — and only for that family set.
  const cases: Array<[DecisionProviderId, { requests: Array<{ model: string }> }, 'routing' | 'verify']> = [
    ['jev', jevT2, 'routing'],
    ['jev', jevT3, 'verify'],
    ['openrouter-decisions', msd1T2, 'routing'],
    ['openrouter-decisions', msd1T3, 'verify'],
  ];
  it.each(cases)('%s — served model calibrated for %s', (provider, file, family) => {
    const served = file.requests[0].model;
    expect(isDecisionCalibrated(provider, served, family)).toBe(true);
    expect(isDecisionCalibrated(provider, served, 'other')).toBe(false);
    expect(isDecisionCalibrated('llm', served, family)).toBe(false);
  });
});

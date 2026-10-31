import { describe, expect, it } from 'vitest';
import { CALIBRATED_DECISION_ROWS, isDecisionCalibrated } from './calibration-table';
import { DECISION_PROVIDER_IDS, type DecisionTaskFamily } from './types';

// D2 §15.1 "Calibration table": calibrated: true for exactly (jev, jev-1.14.0, routing | verify) and (openrouter[-decisions],
// microsoft/microsoft-decision-1, routing | verify); false for every other (provider, model, family), for `llm` always, and for the
// family `other` (the default) always.
//
// The served-id decision: D1's recorded OpenRouter responses carry "model": "microsoft/microsoft-decision-1-20261009" (19 of 19 MSD1
// bodies in D1's hosted-responses folder), while the preset requests the alias microsoft/microsoft-decision-1; Jev serves
// "jev-1.14.0" exactly. `DecisionResult.model` is "as served" (§3), so a table keyed only on the alias would never mark a real MSD1
// answer calibrated. The 20261009 snapshot IS the model D1 measured → it maps too. Any OTHER snapshot behind the alias (drift) was never
// measured → false.

const MEASURED_SNAPSHOT = 'microsoft/microsoft-decision-1-20261009';

const EXPECTED_TRUE = new Set([
  'jev|jev-1.14.0|routing',
  'jev|jev-1.14.0|verify',
  'openrouter-decisions|microsoft/microsoft-decision-1|routing',
  'openrouter-decisions|microsoft/microsoft-decision-1|verify',
  `openrouter-decisions|${MEASURED_SNAPSHOT}|routing`,
  `openrouter-decisions|${MEASURED_SNAPSHOT}|verify`,
]);

const MODELS = [
  'jev-1.14.0',
  'jev-latest',
  'jev-1.15.0',
  'JEV-1.14.0',
  'typesafe/jev-1.14',
  'microsoft/microsoft-decision-1',
  MEASURED_SNAPSHOT,
  'microsoft/microsoft-decision-1-20261201',
  'mapika/decider-2b',
  'claude-sonnet-5-5',
  '',
];
const FAMILIES: Array<DecisionTaskFamily | undefined> = ['routing', 'verify', 'other', undefined];

describe('isDecisionCalibrated — §15.1', () => {
  it('the table holds exactly the measured rows', () => {
    const rows = CALIBRATED_DECISION_ROWS.map((r) => `${r.provider}|${r.model}|${r.family}`);
    expect(new Set(rows)).toEqual(EXPECTED_TRUE);
    expect(rows).toHaveLength(EXPECTED_TRUE.size);
  });

  it('is true for exactly those rows over every provider × model × family', () => {
    for (const provider of DECISION_PROVIDER_IDS) {
      for (const model of MODELS) {
        for (const family of FAMILIES) {
          const expected = EXPECTED_TRUE.has(`${provider}|${model}|${family}`);
          expect(isDecisionCalibrated(provider, model, family), `${provider} ${model} ${family}`).toBe(expected);
        }
      }
    }
  });

  it('Jev is calibrated on routing and verify only, and only pinned jev-1.14.0 (never jev-latest)', () => {
    expect(isDecisionCalibrated('jev', 'jev-1.14.0', 'routing')).toBe(true);
    expect(isDecisionCalibrated('jev', 'jev-1.14.0', 'verify')).toBe(true);
    expect(isDecisionCalibrated('jev', 'jev-latest', 'routing')).toBe(false);
  });

  it("D1's served MSD1 snapshot maps; an unmeasured snapshot behind the same alias does not", () => {
    expect(isDecisionCalibrated('openrouter-decisions', MEASURED_SNAPSHOT, 'verify')).toBe(true);
    expect(isDecisionCalibrated('openrouter-decisions', 'microsoft/microsoft-decision-1-20261201', 'verify')).toBe(false);
  });

  it('Jev served through OpenRouter was not measured there → false', () => {
    expect(isDecisionCalibrated('openrouter-decisions', 'typesafe/jev-1.14', 'routing')).toBe(false);
    expect(isDecisionCalibrated('openrouter-decisions', 'jev-1.14.0', 'routing')).toBe(false);
  });

  it('llm is never calibrated, local has no row in this slice, family other / absent never', () => {
    for (const model of MODELS) {
      for (const family of FAMILIES) {
        expect(isDecisionCalibrated('llm', model, family)).toBe(false);
        expect(isDecisionCalibrated('local', model, family)).toBe(false);
      }
    }
    expect(isDecisionCalibrated('jev', 'jev-1.14.0', 'other')).toBe(false);
    expect(isDecisionCalibrated('jev', 'jev-1.14.0', undefined)).toBe(false);
  });
});

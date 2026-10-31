import { describe, expect, it } from 'vitest';
import { DECISION_PROVIDER_PRESETS } from './presets';
import * as engineIndex from './index';

// D2 §4 presets.ts: jev (system-one, https://api.typesafe.ai/v1/systemone, jev-1.14.0 pinned, credentialId 'typesafe') and
// openrouter-decisions (system-one, https://openrouter.ai/api/alpha/decisions, microsoft/microsoft-decision-1, credentialId 'openrouter').
// No OpenAI preset (E-e). No key in a preset.

describe('DECISION_PROVIDER_PRESETS', () => {
  it('holds exactly the two hosted System One presets', () => {
    expect(DECISION_PROVIDER_PRESETS.map((p) => p.id)).toEqual(['jev', 'openrouter-decisions']);
    const [jev, msd1] = DECISION_PROVIDER_PRESETS;
    expect(jev).toMatchObject({
      id: 'jev',
      type: 'system-one',
      baseURL: 'https://api.typesafe.ai/v1/systemone',
      model: 'jev-1.14.0',
      credentialId: 'typesafe',
    });
    expect(msd1).toMatchObject({
      id: 'openrouter-decisions',
      type: 'system-one',
      baseURL: 'https://openrouter.ai/api/alpha/decisions',
      model: 'microsoft/microsoft-decision-1',
      credentialId: 'openrouter',
    });
  });

  it('carries no key and no OpenAI preset', () => {
    for (const p of DECISION_PROVIDER_PRESETS) expect(p.apiKey ?? '').toBe('');
    expect(JSON.stringify(DECISION_PROVIDER_PRESETS).toLowerCase()).not.toContain('openai');
  });
});

describe('src/decision-engine/index.ts', () => {
  it('re-exports the engine instance, the presets and the typed error', () => {
    expect(engineIndex.decisionEngine).toBeDefined();
    expect(engineIndex.DECISION_PROVIDER_PRESETS).toBe(DECISION_PROVIDER_PRESETS);
    expect(new engineIndex.DecisionError('timeout', 'x').code).toBe('timeout');
  });
});

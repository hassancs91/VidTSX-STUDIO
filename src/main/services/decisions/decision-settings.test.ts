import { beforeEach, describe, expect, it, vi } from 'vitest';

// The decisions settings in the KV store (DECISION_MODELS_DESIGN.md §8): `decisionsMode` auto | off (default auto),
// `decisionsHostedOrder` (default ['jev', 'openrouter-decisions'], any rung removable), `decisionsOpenRouterModel`
// (default microsoft/microsoft-decision-1). A default is stored as unset; a stored value that is not ours reads as the default.
const store = new Map<string, unknown>();
vi.mock('../settings-db', () => ({
  getValue: (key: string) => store.get(key),
  setValue: (key: string, value: unknown) => {
    if (value === undefined) store.delete(key);
    else store.set(key, value);
  },
}));

const { getDecisionSettings, setDecisionSettings, DEFAULT_DECISIONS_OPENROUTER_MODEL } = await import('./decision-settings');

const DEFAULTS = { mode: 'auto', hostedOrder: ['jev', 'openrouter-decisions'], openRouterModel: 'microsoft/microsoft-decision-1' };

beforeEach(() => store.clear());

describe('decision settings (KV, §8)', () => {
  it('defaults: auto, [jev, openrouter-decisions], microsoft/microsoft-decision-1', () => {
    expect(getDecisionSettings()).toEqual(DEFAULTS);
    expect(DEFAULT_DECISIONS_OPENROUTER_MODEL).toBe('microsoft/microsoft-decision-1');
  });

  it('writes the three KV keys and reads them back', () => {
    const next = setDecisionSettings({ mode: 'off', hostedOrder: ['openrouter-decisions'], openRouterModel: 'microsoft/microsoft-decision-1-20261009' });
    expect(store.get('decisionsMode')).toBe('off');
    expect(store.get('decisionsHostedOrder')).toEqual(['openrouter-decisions']);
    expect(store.get('decisionsOpenRouterModel')).toBe('microsoft/microsoft-decision-1-20261009');
    expect(next).toEqual({ mode: 'off', hostedOrder: ['openrouter-decisions'], openRouterModel: 'microsoft/microsoft-decision-1-20261009' });
    expect(getDecisionSettings()).toEqual(next);
  });

  it('a default is stored as unset; a field left out is left alone', () => {
    setDecisionSettings({ mode: 'off', hostedOrder: ['openrouter-decisions', 'jev'] });
    setDecisionSettings({ mode: 'auto' });
    expect(store.has('decisionsMode')).toBe(false);
    expect(store.get('decisionsHostedOrder')).toEqual(['openrouter-decisions', 'jev']);
    setDecisionSettings({ hostedOrder: ['jev', 'openrouter-decisions'], openRouterModel: 'microsoft/microsoft-decision-1' });
    expect(store.size).toBe(0);
    expect(getDecisionSettings()).toEqual(DEFAULTS);
  });

  it('any rung is removable — an empty order is stored and read as empty', () => {
    expect(setDecisionSettings({ hostedOrder: [] }).hostedOrder).toEqual([]);
    expect(getDecisionSettings().hostedOrder).toEqual([]);
  });

  it('refuses an unknown mode, an unknown or repeated rung, an empty model — and writes nothing', () => {
    const bad: Array<Parameters<typeof setDecisionSettings>[0]> = [
      { mode: 'maybe' as unknown as 'auto' },
      { hostedOrder: ['jev', 'openai'] as unknown as ['jev'] },
      { hostedOrder: ['jev', 'jev'] },
      { hostedOrder: 'jev' as unknown as ['jev'] },
      { openRouterModel: '   ' },
      { mode: 'off', openRouterModel: '' },
    ];
    for (const patch of bad) expect(() => setDecisionSettings(patch)).toThrow();
    expect(store.size).toBe(0);
  });

  it('a stored value that is not ours reads as the default (never trusted)', () => {
    store.set('decisionsMode', 'maybe');
    store.set('decisionsHostedOrder', 'jev');
    store.set('decisionsOpenRouterModel', 42);
    expect(getDecisionSettings()).toEqual(DEFAULTS);
    store.set('decisionsHostedOrder', ['openai', 'openrouter-decisions', 'openrouter-decisions', 'local']);
    expect(getDecisionSettings().hostedOrder).toEqual(['openrouter-decisions']);
  });
});

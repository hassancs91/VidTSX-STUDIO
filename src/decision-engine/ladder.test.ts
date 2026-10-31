import { describe, expect, it } from 'vitest';
import { planDecisionLadder, skippedBefore, type LadderInput, type LadderProviderState } from './ladder';
import type { DecisionLimits } from './types';
import type { DecisionRequestMeasure } from './validate';

// D2 §6: `auto` walks local (registered AND calibrated for the family) → the hosted rungs in the user's order → the LLM fallback
// (only with allowUncalibrated); a passed-over rung carries a plain `why`. A pinned rung never falls back: unavailable → no-provider,
// over its limits → unsupported. Mode `off` → no-provider. Pure: providers, readiness and settings come in as arguments.

const WIDE: DecisionLimits = { maxOptions: 255, maxLevels: 10, maxStateTokens: 64_000, maxQuestions: 100_000 };
const ready = { ready: true } as const;

const JEV: LadderProviderState = { id: 'jev', model: 'jev-1.14.0', readiness: ready, limits: WIDE };
const MSD1: LadderProviderState = { id: 'openrouter-decisions', model: 'microsoft/microsoft-decision-1', readiness: ready, limits: WIDE };
const LLM: LadderProviderState = { id: 'llm', model: 'claude-sonnet-5-5', readiness: ready, limits: WIDE };
const LOCAL: LadderProviderState = { id: 'local', model: 'mapika/decider-2b', readiness: ready, limits: WIDE };

const MEASURE: DecisionRequestMeasure = { questionCount: 1, maxOptions: 6, maxLevels: 0, stateTokens: 100 };

function input(overrides: Partial<LadderInput> = {}): LadderInput {
  return {
    request: { provider: 'auto', family: 'routing' },
    measure: MEASURE,
    providers: [JEV, MSD1],
    settings: { mode: 'auto', hostedOrder: ['jev', 'openrouter-decisions'] },
    ...overrides,
  };
}

function whyOf(plan: ReturnType<typeof planDecisionLadder>, provider: string): string | undefined {
  return plan.rungs.find((r) => r.provider === provider)?.why;
}

describe('planDecisionLadder — auto', () => {
  it('walks local → jev → openrouter-decisions → llm; the empty local rung says "no local model"', () => {
    const plan = planDecisionLadder(input());
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.usable).toEqual(['jev', 'openrouter-decisions']);
    expect(plan.rungs.map((r) => r.provider)).toEqual(['local', 'jev', 'openrouter-decisions', 'llm']);
    expect(plan.rungs[0]).toEqual({ provider: 'local', why: 'no local model' });
    expect(whyOf(plan, 'jev')).toBeUndefined();
    expect(whyOf(plan, 'llm')).toBe('uncalibrated — allowUncalibrated is off');
  });

  it('treats a missing provider field as auto', () => {
    const plan = planDecisionLadder(input({ request: { family: 'verify' } }));
    expect(plan.ok && plan.usable).toEqual(['jev', 'openrouter-decisions']);
  });

  it('a hosted rung with no registered provider is skipped with "no key"', () => {
    const plan = planDecisionLadder(input({ providers: [MSD1] }));
    expect(plan.ok && plan.usable).toEqual(['openrouter-decisions']);
    expect(whyOf(plan, 'jev')).toBe('no key');
  });

  it('no key anywhere and allowUncalibrated off → no-provider, every rung explained', () => {
    const plan = planDecisionLadder(input({ providers: [LLM] }));
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.code).toBe('no-provider');
    expect(plan.rungs).toEqual([
      { provider: 'local', why: 'no local model' },
      { provider: 'jev', why: 'no key' },
      { provider: 'openrouter-decisions', why: 'no key' },
      { provider: 'llm', why: 'uncalibrated — allowUncalibrated is off' },
    ]);
  });

  it('allowUncalibrated lets auto end at the LLM fallback', () => {
    const plan = planDecisionLadder(input({ providers: [LLM], request: { allowUncalibrated: true } }));
    expect(plan.ok && plan.usable).toEqual(['llm']);
    const withKeys = planDecisionLadder(input({ providers: [JEV, MSD1, LLM], request: { allowUncalibrated: true } }));
    expect(withKeys.ok && withKeys.usable).toEqual(['jev', 'openrouter-decisions', 'llm']);
  });

  it('allowUncalibrated with no text provider registered → the llm rung says "no text provider"', () => {
    const plan = planDecisionLadder(input({ providers: [JEV], request: { allowUncalibrated: true } }));
    expect(whyOf(plan, 'llm')).toBe('no text provider');
  });

  it("follows the user's decisionsHostedOrder", () => {
    const plan = planDecisionLadder(input({ settings: { mode: 'auto', hostedOrder: ['openrouter-decisions', 'jev'] } }));
    expect(plan.ok && plan.usable).toEqual(['openrouter-decisions', 'jev']);
    expect(plan.rungs.map((r) => r.provider)).toEqual(['local', 'openrouter-decisions', 'jev', 'llm']);
  });

  it('a hosted rung removed from the order is switched off — even with its key set', () => {
    const plan = planDecisionLadder(input({ settings: { mode: 'auto', hostedOrder: ['openrouter-decisions'] } }));
    expect(plan.ok && plan.usable).toEqual(['openrouter-decisions']);
    expect(whyOf(plan, 'jev')).toBe('switched off in Settings');
    const none = planDecisionLadder(input({ settings: { mode: 'auto', hostedOrder: [] } }));
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.code).toBe('no-provider');
  });

  it('ignores duplicate and unknown ids in a stale stored order', () => {
    const plan = planDecisionLadder(input({ settings: { mode: 'auto', hostedOrder: ['jev', 'jev', 'openai', 'bogus'] } }));
    expect(plan.ok && plan.usable).toEqual(['jev']);
    expect(plan.rungs.map((r) => r.provider)).toEqual(['local', 'jev', 'openrouter-decisions', 'llm']);
    expect(whyOf(plan, 'openrouter-decisions')).toBe('switched off in Settings');
  });

  it('mode off → no-provider whatever is registered', () => {
    const plan = planDecisionLadder(input({ providers: [JEV, MSD1, LLM], settings: { mode: 'off', hostedOrder: ['jev'] }, request: { allowUncalibrated: true } }));
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.code).toBe('no-provider');
    expect(plan.reason).toMatch(/off/i);
  });

  it('a rung whose limits the request exceeds is skipped with "over its limits"', () => {
    const narrowJev = { ...JEV, limits: { ...WIDE, maxOptions: 4 } };
    const plan = planDecisionLadder(input({ providers: [narrowJev, MSD1] }));
    expect(plan.ok && plan.usable).toEqual(['openrouter-decisions']);
    expect(whyOf(plan, 'jev')).toBe('over its limits');
  });

  it('checks every limit: levels, state tokens, question count', () => {
    const cases: Array<[Partial<DecisionLimits>, Partial<DecisionRequestMeasure>]> = [
      [{ maxLevels: 5 }, { maxLevels: 6 }],
      [{ maxStateTokens: 1_000 }, { stateTokens: 1_001 }],
      [{ maxQuestions: 40 }, { questionCount: 41 }],
    ];
    for (const [limits, measure] of cases) {
      const plan = planDecisionLadder(input({ providers: [{ ...JEV, limits: { ...WIDE, ...limits } }], measure: { ...MEASURE, ...measure } }));
      expect(whyOf(plan, 'jev')).toBe('over its limits');
    }
    const atLimit = planDecisionLadder(input({ providers: [{ ...JEV, limits: { ...WIDE, maxQuestions: 40 } }], measure: { ...MEASURE, questionCount: 40 } }));
    expect(atLimit.ok && atLimit.usable).toEqual(['jev']);
  });

  it('every available rung over its limits → unsupported (not no-provider)', () => {
    const narrow = { ...WIDE, maxOptions: 4 };
    const plan = planDecisionLadder(input({ providers: [{ ...JEV, limits: narrow }, { ...MSD1, limits: narrow }] }));
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.code).toBe('unsupported');
  });

  it('a registered rung that is not ready is skipped with its own reason', () => {
    const plan = planDecisionLadder(input({ providers: [{ ...JEV, readiness: { ready: false, reason: 'the key was rejected' } }, MSD1] }));
    expect(plan.ok && plan.usable).toEqual(['openrouter-decisions']);
    expect(whyOf(plan, 'jev')).toBe('the key was rejected');
  });

  it('a registered local model is used only when calibrated for the family — none is in this slice', () => {
    const plan = planDecisionLadder(input({ providers: [LOCAL, JEV], request: { family: 'verify' } }));
    expect(plan.ok && plan.usable).toEqual(['jev']);
    expect(whyOf(plan, 'local')).toBe('uncalibrated for this task family');
  });
});

describe('planDecisionLadder — pinned', () => {
  it('a pinned ready rung is the only rung', () => {
    const plan = planDecisionLadder(input({ request: { provider: 'jev' } }));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.usable).toEqual(['jev']);
    expect(plan.rungs).toEqual([{ provider: 'jev' }]);
  });

  it('pinned and unavailable → no-provider (never falls back)', () => {
    const noKey = planDecisionLadder(input({ providers: [MSD1], request: { provider: 'jev' } }));
    expect(noKey.ok).toBe(false);
    if (noKey.ok) return;
    expect(noKey.code).toBe('no-provider');
    expect(noKey.reason).toContain('no key');
    const local = planDecisionLadder(input({ request: { provider: 'local' } }));
    expect(!local.ok && local.code).toBe('no-provider');
    expect(whyOf(local, 'local')).toBe('no local model');
    const notReady = planDecisionLadder(input({ providers: [{ ...JEV, readiness: { ready: false, reason: 'offline' } }], request: { provider: 'jev' } }));
    expect(!notReady.ok && notReady.code).toBe('no-provider');
  });

  it('pinned and over its limits → unsupported', () => {
    const plan = planDecisionLadder(input({ providers: [{ ...JEV, limits: { ...WIDE, maxOptions: 4 } }], request: { provider: 'jev' } }));
    expect(!plan.ok && plan.code).toBe('unsupported');
  });

  it('a pinned hosted rung switched off in Settings → no-provider', () => {
    const plan = planDecisionLadder(input({ request: { provider: 'jev' }, settings: { mode: 'auto', hostedOrder: ['openrouter-decisions'] } }));
    expect(!plan.ok && plan.code).toBe('no-provider');
    expect(whyOf(plan, 'jev')).toBe('switched off in Settings');
  });

  it('pinned llm is an explicit opt-in: used without allowUncalibrated', () => {
    const plan = planDecisionLadder(input({ providers: [LLM], request: { provider: 'llm' } }));
    expect(plan.ok && plan.usable).toEqual(['llm']);
    const none = planDecisionLadder(input({ providers: [JEV], request: { provider: 'llm' } }));
    expect(whyOf(none, 'llm')).toBe('no text provider');
  });

  it('pinned local that is registered is used even uncalibrated (the engine stamps calibrated: false)', () => {
    const plan = planDecisionLadder(input({ providers: [LOCAL], request: { provider: 'local', family: 'verify' } }));
    expect(plan.ok && plan.usable).toEqual(['local']);
  });

  it('mode off wins over a pin', () => {
    const plan = planDecisionLadder(input({ request: { provider: 'jev' }, settings: { mode: 'off', hostedOrder: ['jev'] } }));
    expect(!plan.ok && plan.code).toBe('no-provider');
  });
});

describe('skippedBefore', () => {
  it('lists the explained rungs before the one that answered, in order', () => {
    const plan = planDecisionLadder(input({ providers: [MSD1] }));
    expect(skippedBefore(plan.rungs, 'openrouter-decisions')).toEqual([
      { provider: 'local', why: 'no local model' },
      { provider: 'jev', why: 'no key' },
    ]);
    expect(skippedBefore(plan.rungs, 'local')).toEqual([]);
  });
});

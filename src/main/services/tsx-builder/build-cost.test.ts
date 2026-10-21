import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The cost estimate before Start (P5 part 3): measured tokens per budget times
// the model's price. Claude on a key from the table, OpenRouter from its list,
// the subscription "on your plan", anything else "cost unknown".

const resolveProviderInfo = vi.fn();
vi.mock('../agents/tool-support', () => ({ resolveProviderInfo: (...a: unknown[]) => resolveProviderInfo(...a) }));

import {
  CLAUDE_PRICES,
  claudePriceFor,
  estimateBuildCost,
  estimateForProvider,
  priceBudget,
  tokenModelFor,
  tokensCost,
} from './build-cost';
import { parseOpenRouterPricing, resetOpenRouterModelCache } from './openrouter-model-check';
import { MEASURED_BUILD_TOKENS } from '@shared/tsx-engine/build-budgets';

const SUBSCRIPTION = { id: 'claude-subscription', type: 'agent-sdk', authMode: 'subscription', defaultModel: 'claude-sonnet-5-5' };
const API_KEY = { id: 'claude-api', type: 'agent-sdk', authMode: 'api-key', defaultModel: 'claude-sonnet-5-5' };
const OPENROUTER = { id: 'openrouter', type: 'agent-sdk', authMode: 'api-key', baseURL: 'https://openrouter.ai/api', defaultModel: 'anthropic/claude-sonnet-4-6' };
const MINIMAX = { id: 'minimax', type: 'agent-sdk', authMode: 'api-key', baseURL: 'https://api.minimax.io/anthropic', defaultModel: 'MiniMax-M2.7' };
const LOCAL = { id: 'local', type: 'local', authMode: 'subscription', defaultModel: 'local' };

const LIST = {
  data: [
    { id: 'openai/gpt-6.1-sol', architecture: { input_modalities: ['image', 'text'] }, supported_parameters: ['tools'], pricing: { prompt: '0.000002', completion: '0.000008', input_cache_read: '0.0000005' } },
    { id: 'anthropic/claude-opus-5.5', architecture: { input_modalities: ['image', 'text'] }, supported_parameters: ['tools'], pricing: { prompt: '0.000004', completion: '0.00002', input_cache_read: '0.0000002', input_cache_write: '0.000005' } },
    { id: 'openrouter/auto', supported_parameters: ['tools'], pricing: { prompt: '-1', completion: '-1' } },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  resetOpenRouterModelCache();
  resolveProviderInfo.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => LIST });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the price rule against the stored builds', () => {
  // The SDK's own total_cost_usd of the runs the profiles were taken from (runs/P0/vt-profile, *.debug.json).
  const STORED: Array<[string, 'quick' | 'standard' | 'craft', 'low' | 'high', number]> = [
    ['claude-sonnet-5-5', 'quick', 'low', 0.2958084],
    ['claude-sonnet-5-5', 'quick', 'high', 0.852487],
    ['claude-sonnet-5-5', 'standard', 'low', 0.5075804],
    ['claude-sonnet-5-5', 'standard', 'high', 0.9276322],
    ['claude-sonnet-5-5', 'craft', 'low', 0.382351],
    ['claude-sonnet-5-5', 'craft', 'high', 0.9259874],
    ['claude-opus-5-5', 'standard', 'low', 0.7898438],
    ['claude-opus-5-5', 'craft', 'low', 1.5541682],
    ['claude-opus-5-5', 'craft', 'high', 3.4021068],
  ];

  it.each(STORED)('%s %s %s reproduces the SDK cost within 1 %%', (model, budget, end, sdkCost) => {
    const p = CLAUDE_PRICES[model];
    const perToken = { input: p.input / 1e6, output: p.output / 1e6, cacheRead: p.cacheRead / 1e6, cacheWrite: (2 * p.input) / 1e6 };
    const cost = tokensCost(MEASURED_BUILD_TOKENS[model][budget]![end], perToken);
    expect(Math.abs(cost / sdkCost - 1)).toBeLessThan(0.01);
  });
});

describe('claudePriceFor / tokenModelFor', () => {
  it('reads a dated id and a [1m] tag as the base model', () => {
    expect(claudePriceFor('claude-haiku-4-5-20251001')).toEqual(CLAUDE_PRICES['claude-haiku-4-5']);
    expect(claudePriceFor('claude-opus-5-5[1m]')).toEqual(CLAUDE_PRICES['claude-opus-5-5']);
    expect(claudePriceFor('claude-haiku-5-5')).toBeUndefined();
  });

  it('maps an OpenRouter Claude id onto the measured tokens', () => {
    expect(tokenModelFor('anthropic/claude-opus-5.5')).toBe('claude-opus-5-5');
    expect(tokenModelFor('openai/gpt-6.1-sol')).toBe('openai/gpt-6-1-sol');
  });
});

describe('priceBudget', () => {
  it('falls back to Sonnet 5.5 tokens for a budget a model has no runs of', () => {
    const price = { input: 4e-6, output: 20e-6, cacheRead: 0.2e-6, cacheWrite: 8e-6 };
    expect(priceBudget('claude-opus-5-5', 'quick', price)).toEqual(priceBudget('claude-sonnet-5-5', 'quick', price));
    expect(priceBudget('openai/gpt-6-1-sol', 'craft', price)).toEqual(priceBudget('claude-sonnet-5-5', 'craft', price));
  });
});

describe('parseOpenRouterPricing', () => {
  it('reads per-token strings, and drops a variable (-1) or missing price', () => {
    expect(parseOpenRouterPricing({ prompt: '0.000002', completion: '0.000008', input_cache_read: '0.0000005' })).toEqual({
      input: 0.000002,
      output: 0.000008,
      cacheRead: 0.0000005,
    });
    // A Claude model's list entry (live, 10-21): the 1-hour write wins.
    expect(
      parseOpenRouterPricing({ prompt: '0.000004', completion: '0.00002', input_cache_read: '0.0000002', input_cache_write: '0.000005', input_cache_write_1h: '0.000008' }),
    ).toEqual({ input: 0.000004, output: 0.00002, cacheRead: 0.0000002, cacheWrite: 0.000008 });
    expect(parseOpenRouterPricing({ prompt: '-1', completion: '-1' })).toBeUndefined();
    expect(parseOpenRouterPricing({ prompt: '0.000002' })).toBeUndefined();
    expect(parseOpenRouterPricing(undefined)).toBeUndefined();
  });
});

describe('estimateForProvider', () => {
  it('says "on your plan" on the Claude subscription', async () => {
    expect(await estimateForProvider(SUBSCRIPTION as never, undefined, 'craft')).toEqual({ kind: 'plan' });
  });

  it('prices Claude on a key from the table, the default model when none is picked', async () => {
    const est = await estimateForProvider(API_KEY as never, '', 'craft');
    expect(est).toMatchObject({ kind: 'usd', source: 'claude', model: 'claude-sonnet-5-5' });
    if (est.kind !== 'usd') throw new Error('usd');
    expect(est.low).toBeCloseTo(0.382, 2);
    expect(est.high).toBeCloseTo(0.926, 2);
  });

  it('uses the measured Opus tokens on Opus', async () => {
    const est = await estimateForProvider(API_KEY as never, 'claude-opus-5-5', 'craft');
    if (est.kind !== 'usd') throw new Error('usd');
    expect(est.low).toBeCloseTo(1.55, 1);
    expect(est.high).toBeCloseTo(3.4, 1);
  });

  it('is "cost unknown" for an unpriced Claude model on a key', async () => {
    expect(await estimateForProvider(API_KEY as never, 'claude-haiku-5-5', 'quick')).toEqual({ kind: 'unknown' });
  });

  it('prices an OpenRouter model from its list; Claude ids there use their measured tokens', async () => {
    const gpt = await estimateForProvider(OPENROUTER as never, 'openai/gpt-6.1-sol', 'standard');
    expect(gpt).toMatchObject({ kind: 'usd', source: 'openrouter', model: 'openai/gpt-6.1-sol' });
    const opus = await estimateForProvider(OPENROUTER as never, 'anthropic/claude-opus-5.5', 'craft');
    if (opus.kind !== 'usd') throw new Error('usd');
    // The list's own cache-write price (5 $/M) is used, not 2× input.
    expect(opus.high).toBeCloseTo(tokensCost(MEASURED_BUILD_TOKENS['claude-opus-5-5'].craft!.high, { input: 4e-6, output: 20e-6, cacheRead: 0.2e-6, cacheWrite: 5e-6 }), 6);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is "cost unknown" for an unlisted or variable-price OpenRouter model, or no list', async () => {
    expect(await estimateForProvider(OPENROUTER as never, 'openrouter/auto', 'quick')).toEqual({ kind: 'unknown' });
    expect(await estimateForProvider(OPENROUTER as never, 'not/listed', 'quick')).toEqual({ kind: 'unknown' });
    resetOpenRouterModelCache();
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    expect(await estimateForProvider(OPENROUTER as never, 'openai/gpt-6.1-sol', 'quick')).toEqual({ kind: 'unknown' });
  });

  it('is "cost unknown" for other Anthropic-compatible presets, local, and no provider', async () => {
    expect(await estimateForProvider(MINIMAX as never, undefined, 'craft')).toEqual({ kind: 'unknown' });
    expect(await estimateForProvider(LOCAL as never, undefined, 'craft')).toEqual({ kind: 'unknown' });
    expect(await estimateForProvider(null, undefined, 'craft')).toEqual({ kind: 'unknown' });
  });
});

describe('estimateBuildCost', () => {
  it('resolves the provider (absent id = the active one) and never throws', async () => {
    resolveProviderInfo.mockResolvedValueOnce(SUBSCRIPTION);
    expect(await estimateBuildCost({ budget: 'quick' })).toEqual({ kind: 'plan' });
    expect(resolveProviderInfo).toHaveBeenCalledWith(undefined);
    resolveProviderInfo.mockRejectedValueOnce(new Error('settings unreadable'));
    expect(await estimateBuildCost({ providerId: 'claude-api', budget: 'quick' })).toEqual({ kind: 'unknown' });
  });
});

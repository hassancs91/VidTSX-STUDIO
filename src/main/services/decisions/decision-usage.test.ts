import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import type { AiUsageEntry } from '../../../shared/types/ai-usage';
import { DECISION_PROVIDER_PRESETS, DecisionEngine, type SystemOneFetch } from '../../../decision-engine';
import { createDecisionUsageListener, decisionUsageEntry } from './decision-usage';

// One AI-usage row per provider HTTP call (DECISION_MODELS_DESIGN.md §9, D-r17 (1), D-r18 (2)–(3)): `provider` = the KEY's registry id
// (`typesafe` / `openrouter`), `model` as served, `requestType: 'decision'`, the caller's `decision-*` featureSource, input tokens,
// `costUsd` as the provider reported it (else tokens × price — computed by the adapter), `durationMs`. A cache hit logs nothing.
const NOW = new Date('2026-10-31T10:30:00.000Z');
const FAKE_KEY = 'sk-test-FAKE-decisions-0001';
type Row = Omit<AiUsageEntry, 'id'>;

describe('decisionUsageEntry', () => {
  it('a Jev call → provider typesafe (the key id), model as served, requestType decision', () => {
    const costUsd = (10_858 * 0.042) / 1_000_000;
    expect(
      decisionUsageEntry({ provider: 'jev', featureSource: 'decision-agent', model: 'jev-1.14.0', inputTokens: 10_858, costUsd, durationMs: 412 }, NOW),
    ).toEqual({
      timestamp: NOW.toISOString(), provider: 'typesafe', model: 'jev-1.14.0', featureSource: 'decision-agent', inputTokens: 10_858,
      outputTokens: 0, cacheReadInputTokens: 0, costUsd, durationMs: 412, requestType: 'decision',
    });
  });

  it('an OpenRouter call → provider openrouter, the served snapshot, the reported cost', () => {
    const row = decisionUsageEntry(
      { provider: 'openrouter-decisions', featureSource: 'decision-flow', model: 'microsoft/microsoft-decision-1-20261009', inputTokens: 6_087, costUsd: 0.000240576, durationMs: 980 },
      NOW,
    );
    expect(row).toMatchObject({ provider: 'openrouter', model: 'microsoft/microsoft-decision-1-20261009', featureSource: 'decision-flow', costUsd: 0.000240576, requestType: 'decision' });
  });

  it('the llm rung is logged once, here, as provider llm (the text engine logs nothing — next test)', () => {
    const row = decisionUsageEntry({ provider: 'llm', featureSource: 'decision-routing', model: 'glm-4.6', inputTokens: 300, costUsd: 0, durationMs: 2_100 }, NOW);
    expect(row).toMatchObject({ provider: 'llm', model: 'glm-4.6', featureSource: 'decision-routing', requestType: 'decision', inputTokens: 300 });
  });
});

describe('no double log of the llm rung', () => {
  // decision-usage.ts writes the llm rung's row because `llmEngine.generate` writes none: the usage rows of text calls are written by
  // their IPC handlers / callers (llm-handlers.ts, rerank.ts), never inside src/engine/. If the text engine ever logs its own calls,
  // this fails first — and decision-usage must then skip `provider: 'llm'`.
  it('nothing under src/engine/ appends an AI-usage row', () => {
    const root = path.join(process.cwd(), 'src', 'engine');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && /appendEntry|aiUsageService|services\/ai-usage/.test(readFileSync(full, 'utf8'))) offenders.push(full);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

describe('createDecisionUsageListener', () => {
  it('appends one row per event; a throwing or rejecting append never throws', async () => {
    const rows: Row[] = [];
    const listener = createDecisionUsageListener(async (entry) => { rows.push(entry); }, () => NOW);
    listener({ provider: 'jev', featureSource: 'decision-test', model: 'jev-1.14.0', inputTokens: 40, costUsd: 0.00000168, durationMs: 300 });
    listener({ provider: 'jev', featureSource: 'decision-agent', model: 'jev-1.14.0', inputTokens: 41, costUsd: 0.000001722, durationMs: 310 });
    expect(rows.map((r) => r.featureSource)).toEqual(['decision-test', 'decision-agent']);

    const rejecting = createDecisionUsageListener(async () => { throw new Error('db closed'); }, () => NOW);
    expect(() => rejecting({ provider: 'jev', featureSource: 'decision-agent', model: 'm', inputTokens: 1, costUsd: 0, durationMs: 1 })).not.toThrow();
    const throwing = createDecisionUsageListener(() => { throw new Error('sync boom'); }, () => NOW);
    expect(() => throwing({ provider: 'jev', featureSource: 'decision-agent', model: 'm', inputTokens: 1, costUsd: 0, durationMs: 1 })).not.toThrow();
    await Promise.resolve();
  });

  it('end to end: one row per HTTP call; the cache hit logs nothing; cost = tokens × price when the provider reports none', async () => {
    const fetch = vi.fn(async (): ReturnType<SystemOneFetch> => ({
      ok: true, status: 200, text: async () => JSON.stringify({ model: 'jev-1.14.0', answers: { ok: { noul: 0.97 } }, usage: { input_tokens: 1_000 } }),
    }));
    const engine = new DecisionEngine({ fetch });
    const jev = DECISION_PROVIDER_PRESETS.find((p) => p.id === 'jev');
    if (!jev) throw new Error('no jev preset');
    engine.register({ ...jev, apiKey: FAKE_KEY });
    const rows: Row[] = [];
    engine.setUsageListener(createDecisionUsageListener(async (entry) => { rows.push(entry); }, () => NOW));

    const request = { state: 'A red ball.', questions: { ok: { type: 'noul' as const, instructions: 'Is the ball red?' } }, featureSource: 'decision-agent' as const };
    const first = await engine.decide(request);
    const second = await engine.decide(request);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provider: 'typesafe', model: 'jev-1.14.0', requestType: 'decision', featureSource: 'decision-agent', inputTokens: 1_000 });
    expect(rows[0].costUsd).toBeCloseTo((1_000 * 0.042) / 1_000_000, 12);
    expect(JSON.stringify(rows)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(rows)).not.toContain('A red ball');
  });
});

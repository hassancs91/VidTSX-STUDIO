import { describe, expect, it, vi } from 'vitest';
import type { LLMRequest, LLMResponse } from '../../../engine/types';
import type { AiUsageEntry } from '../../../shared/types/ai-usage';
import { createLibraryReranker, RERANK_FEATURE_SOURCE } from './rerank';
import { parseRerankOrder, rerankPromptOf, RERANK_TOP } from './rerank-prompt';
import type { SemanticItem } from './types';

// Smart + AI rerank (LIBRARY_SEARCH_DESIGN.md §8.3, ruling LS-r7): one call to the app-default text provider over the
// top 20, the S1 (d) rules adapted to an ORDER, logged like every call; any bad answer keeps the Smart order; cached by
// query + index version. Every test injects the generator — no provider is ever called.

const item = (relPath: string, text: string): SemanticItem => ({ relPath, text, textHash: `h-${relPath}` });
const ITEMS: SemanticItem[] = [
  item('sfx/party-popper.mp3', 'party popper. emphasis. pop, confetti. A short pop with paper confetti.'),
  item('sfx/crunch-bite.mp3', 'crunch bite. foley. food. A crisp bite into an apple.'),
  item('sfx/crash-tumble.mp3', 'crash tumble. impact. crash, fall. Objects falling over and clattering on a hard floor.'),
];

const response = (text: string, over: Partial<LLMResponse> = {}): LLMResponse => ({
  text,
  model: 'test-model',
  provider: 'test-provider',
  durationMs: 5,
  usage: { inputTokens: 300, outputTokens: 12, cacheReadInputTokens: 4, costUsd: 0.0012 },
  ...over,
} as LLMResponse);

function harness(answer: (req: LLMRequest) => Promise<LLMResponse>, version = { v: 'C:/lib#0' }) {
  const generate = vi.fn(answer);
  const logged: Array<Omit<AiUsageEntry, 'id'>> = [];
  const reranker = createLibraryReranker({
    generate,
    logUsage: async (entry) => {
      logged.push(entry);
    },
    indexVersion: () => version.v,
  });
  return { generate, logged, reranker, version };
}

describe('rerankPromptOf — the S1 (d) rules, adapted to an order', () => {
  it('names the query, numbers every item with its file and text, and asks for a JSON order only', () => {
    const prompt = rerankPromptOf('things falling over', ITEMS);
    expect(prompt).toContain('"things falling over"');
    expect(prompt).toContain('1 | sfx/party-popper.mp3 | party popper.');
    expect(prompt).toContain('3 | sfx/crash-tumble.mp3 | crash tumble.');
    expect(prompt).toMatch(/plain meaning/);
    expect(prompt).toMatch(/not by words that happen to match/);
    expect(prompt).toMatch(/loosely related or merely similar/);
    expect(prompt).toContain('{"order": [');
    expect(prompt).not.toMatch(/already has|matching/);
  });

  it('keeps one item per line (newlines in a description are flattened) and at most RERANK_TOP items', () => {
    const many = Array.from({ length: 25 }, (_, i) => item(`sfx/c${i}.mp3`, `clip ${i}.\nline two`));
    const prompt = rerankPromptOf('x', many);
    expect(RERANK_TOP).toBe(20);
    expect(prompt).toContain('20 | sfx/c19.mp3 | clip 19. line two');
    expect(prompt).not.toContain('sfx/c20.mp3');
  });
});

describe('parseRerankOrder — any bad answer is null (the caller keeps the Smart order)', () => {
  it('a full order → the relPaths in that order; a partial one → only those (the rest follow in Smart order later)', () => {
    expect(parseRerankOrder('{"order": [3, 1, 2]}', ITEMS)).toEqual(['sfx/crash-tumble.mp3', 'sfx/party-popper.mp3', 'sfx/crunch-bite.mp3']);
    expect(parseRerankOrder('{"order": [3]}', ITEMS)).toEqual(['sfx/crash-tumble.mp3']);
  });

  it('tolerates a code fence, text around the object, numeric strings and a bare array', () => {
    expect(parseRerankOrder('```json\n{"order": [3, 2, 1]}\n```', ITEMS)).toEqual(['sfx/crash-tumble.mp3', 'sfx/crunch-bite.mp3', 'sfx/party-popper.mp3']);
    expect(parseRerankOrder('Here: {"order": ["2", "3"]} done', ITEMS)).toEqual(['sfx/crunch-bite.mp3', 'sfx/crash-tumble.mp3']);
    expect(parseRerankOrder('[3, 1]', ITEMS)).toEqual(['sfx/crash-tumble.mp3', 'sfx/party-popper.mp3']);
  });

  it.each([
    ['empty', ''],
    ['prose', 'The best one is crash tumble.'],
    ['broken JSON', '{"order": [3, 1'],
    ['no order field', '{"best": 3}'],
    ['empty order', '{"order": []}'],
    ['a number out of range', '{"order": [3, 4]}'],
    ['zero', '{"order": [0, 1]}'],
    ['a duplicate', '{"order": [3, 3, 1]}'],
    ['a fraction', '{"order": [1.5]}'],
    ['a ref instead of a number', '{"order": ["sfx/crash-tumble.mp3"]}'],
  ])('%s → null', (_name, text) => {
    expect(parseRerankOrder(text, ITEMS)).toBeNull();
  });
});

describe('createLibraryReranker — one logged call per (query, index version, items), cached', () => {
  it('asks the provider once with the prompt and logs the usage as library-search-rerank', async () => {
    const h = harness(async () => response('{"order": [3, 1, 2]}'));
    const order = await h.reranker.rerank('things falling over', ITEMS);
    expect(order).toEqual(['sfx/crash-tumble.mp3', 'sfx/party-popper.mp3', 'sfx/crunch-bite.mp3']);
    expect(h.generate).toHaveBeenCalledTimes(1);
    const req = h.generate.mock.calls[0][0];
    expect(req.prompt).toBe(rerankPromptOf('things falling over', ITEMS));
    expect(RERANK_FEATURE_SOURCE).toBe('library-search-rerank');
    expect(h.logged).toHaveLength(1);
    expect(h.logged[0]).toMatchObject({
      provider: 'test-provider', model: 'test-model', featureSource: 'library-search-rerank', requestType: 'llm',
      inputTokens: 300, outputTokens: 12, cacheReadInputTokens: 4, costUsd: 0.0012,
    });
    expect(typeof h.logged[0].durationMs).toBe('number');
    expect(Number.isNaN(Date.parse(h.logged[0].timestamp))).toBe(false);
  });

  it('a bad answer is still logged (the call was paid) and rejects, so the search keeps the Smart order', async () => {
    const h = harness(async () => response('I would pick the crash.'));
    await expect(h.reranker.rerank('things falling over', ITEMS)).rejects.toThrow(/rerank answer/);
    expect(h.logged).toHaveLength(1);
  });

  it('a failed call rejects, logs nothing, and is not cached (the next settled query asks again)', async () => {
    let fail = true;
    const h = harness(async () => {
      if (fail) throw new Error('Provider "x" not registered');
      return response('{"order": [2]}');
    });
    await expect(h.reranker.rerank('q', ITEMS)).rejects.toThrow('not registered');
    expect(h.logged).toHaveLength(0);
    fail = false;
    expect(await h.reranker.rerank('q', ITEMS)).toEqual(['sfx/crunch-bite.mp3']);
    expect(h.generate).toHaveBeenCalledTimes(2);
  });

  it('the same query over the same items and index version is answered from the cache; concurrent asks share one call', async () => {
    const h = harness(async () => response('{"order": [3, 2, 1]}'));
    const [a, b] = await Promise.all([h.reranker.rerank('things falling over', ITEMS), h.reranker.rerank('things falling over', ITEMS)]);
    const c = await h.reranker.rerank('things falling over', ITEMS);
    expect(a).toEqual(b);
    expect(c).toEqual(a);
    expect(h.generate).toHaveBeenCalledTimes(1);
    expect(h.logged).toHaveLength(1);
  });

  it('a new index version, another query, or another item set asks again', async () => {
    const h = harness(async () => response('{"order": [1]}'));
    await h.reranker.rerank('things falling over', ITEMS);
    h.version.v = 'C:/lib#1';
    await h.reranker.rerank('things falling over', ITEMS);
    await h.reranker.rerank('glass breaking', ITEMS);
    await h.reranker.rerank('glass breaking', ITEMS.slice(0, 2));
    await h.reranker.rerank('glass breaking', [ITEMS[0], { ...ITEMS[1], textHash: 'changed' }]);
    expect(h.generate).toHaveBeenCalledTimes(5);
  });

  it('never asks with nothing to order', async () => {
    const h = harness(async () => response('{"order": [1]}'));
    expect(await h.reranker.rerank('q', [])).toEqual([]);
    expect(h.generate).not.toHaveBeenCalled();
  });
});

// Smart + AI rerank (LIBRARY_SEARCH_DESIGN.md §3 / §4 / §8.3, ruling LS-r7): one call to the user's app-default text
// provider re-orders the Assets box's top 20 for a settled query. Logged like every other call (the
// `llm-handlers.ts` usage-row shape, featureSource 'library-search-rerank'); cached by index version + query + the
// items asked about, so the same settled query never pays twice. A failed call or an unreadable answer rejects — the
// search then keeps the Smart order (`searchLibrary`). The provider is injected: the app wires `llmEngine.generate`
// (search-app.ts), every test a fake.

import type { LLMRequest, LLMResponse } from '../../../engine/types';
import type { AiFeatureSource, AiUsageEntry } from '../../../shared/types/ai-usage';
import { parseRerankOrder, rerankPromptOf } from './rerank-prompt';
import type { LibraryReranker, SemanticItem } from './types';

export const RERANK_FEATURE_SOURCE: AiFeatureSource = 'library-search-rerank';

/** Settled queries kept per session; the oldest answer goes first. */
const MAX_CACHED = 200;

export interface LibraryRerankerDeps {
  /** The app-default text provider (no providerId — `llmEngine.generate`). */
  generate: (request: LLMRequest) => Promise<LLMResponse>;
  /** `aiUsageService.appendEntry`; fire-and-forget, a failure is ignored. */
  logUsage: (entry: Omit<AiUsageEntry, 'id'>) => Promise<unknown>;
  /** Changes whenever the library index is written (the runtime's counter), so a cached order never outlives its items. */
  indexVersion: () => string;
}

function logResponse(deps: LibraryRerankerDeps, res: LLMResponse, durationMs: number): void {
  const entry: Omit<AiUsageEntry, 'id'> = {
    timestamp: new Date().toISOString(),
    provider: res.provider || 'unknown',
    model: res.model || 'unknown',
    featureSource: RERANK_FEATURE_SOURCE,
    inputTokens: res.usage?.inputTokens ?? 0,
    outputTokens: res.usage?.outputTokens ?? 0,
    cacheReadInputTokens: res.usage?.cacheReadInputTokens ?? 0,
    costUsd: res.usage?.costUsd ?? 0,
    durationMs,
    requestType: 'llm',
  };
  try {
    deps.logUsage(entry).catch(() => undefined);
  } catch {
    // the usage log never fails a search
  }
}

async function askProvider(deps: LibraryRerankerDeps, query: string, items: SemanticItem[]): Promise<string[]> {
  const start = Date.now();
  const res = await deps.generate({ prompt: rerankPromptOf(query, items) });
  logResponse(deps, res, Date.now() - start);
  const order = parseRerankOrder(res.text ?? '', items);
  if (!order) throw new Error('rerank answer unreadable');
  return order;
}

export function createLibraryReranker(deps: LibraryRerankerDeps): LibraryReranker {
  const cache = new Map<string, Promise<string[]>>();
  return {
    async rerank(query: string, items: SemanticItem[]): Promise<string[]> {
      if (items.length === 0) return [];
      const key = JSON.stringify([deps.indexVersion(), query, items.map((it) => `${it.relPath}:${it.textHash}`)]);
      const known = cache.get(key);
      if (known) return known;
      const asked = askProvider(deps, query, items);
      cache.set(key, asked);
      if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
      try {
        return await asked;
      } catch (err) {
        // a failed or unreadable answer is never cached — the next settled query asks again
        if (cache.get(key) === asked) cache.delete(key);
        throw err;
      }
    },
  };
}

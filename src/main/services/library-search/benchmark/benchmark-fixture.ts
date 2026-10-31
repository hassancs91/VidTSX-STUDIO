// The benchmark fixture (LIBRARY_SEARCH_DESIGN.md §9.1): S1's labelled set and the precomputed multilingual-e5-small
// vectors for the 51 clips + every scored prompt, both written by `scripts/library-search-fixture.mjs` from the real
// model through the product's own item text (`item-text.ts`) and prefixes (`library-search-engine/prefixes.ts`).
// The semantic ranker here reads those vectors in place of the engine; a clip whose text changed since the fixture
// was written (another textHash) throws, so a stale fixture cannot pass silently (searchLibrary would then report
// `ran: 'basic'`, which the benchmark asserts against).

import fs from 'node:fs';
import path from 'node:path';
import type { SemanticRanker } from '../types';
import type { BenchRow } from './benchmark-measure';
import { cosine, decodeVector, type EncodedVector, type FixturePrecision } from './fixture-codec';

export const FIXTURE_DIR = path.join(__dirname, 'fixtures');
export const LABELLED_SET_FILE = path.join(FIXTURE_DIR, 'labelled-set.json');
export const VECTORS_FILE = path.join(FIXTURE_DIR, 'vectors-multilingual-e5-small.json');

export interface VectorFixtureFile {
  version: 1;
  modelId: string;
  dims: number;
  pooling: 'mean';
  prefixVersion: number;
  precision: FixturePrecision;
  /** What the generator measured when it chose the precision (its report names the run). */
  check: Record<string, unknown>;
  items: Record<string, EncodedVector & { textHash: string }>;
  /** Keyed by the raw prompt (the "query: " prefix is the embedder's). */
  queries: Record<string, EncodedVector>;
}

export interface FixtureVectors {
  file: VectorFixtureFile;
  items: Map<string, { textHash: string; v: Float32Array }>;
  queries: Map<string, Float32Array>;
}

export function loadLabelledSet(): BenchRow[] {
  const parsed = JSON.parse(fs.readFileSync(LABELLED_SET_FILE, 'utf8')) as { rows: BenchRow[] };
  return parsed.rows;
}

export function loadFixtureVectors(file = VECTORS_FILE): FixtureVectors {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as VectorFixtureFile;
  const items = new Map(Object.entries(parsed.items).map(([relPath, e]) => [relPath, { textHash: e.textHash, v: decodeVector(e, parsed.precision) }]));
  const queries = new Map(Object.entries(parsed.queries).map(([prompt, e]) => [prompt, decodeVector(e, parsed.precision)]));
  return { file: parsed, items, queries };
}

/** The injected semantic ranker of the benchmark: cosine over the fixture vectors, best first (ties keep pool order). */
export function fixtureRanker(fx: Pick<FixtureVectors, 'items' | 'queries'>): SemanticRanker {
  return {
    rank: async (query, items) => {
      const q = fx.queries.get(query);
      if (!q) throw new Error(`fixture: no vector for the query ${JSON.stringify(query)}`);
      const ranked = items.map((it) => {
        const rec = fx.items.get(it.relPath);
        if (!rec) throw new Error(`fixture: no vector for ${it.relPath}`);
        if (rec.textHash !== it.textHash) throw new Error(`fixture: stale vector for ${it.relPath} (its item text changed)`);
        return { relPath: it.relPath, cosine: cosine(q, rec.v) };
      });
      ranked.sort((a, b) => b.cosine - a.cosine);
      return { ranked, vectors: { ready: items.length, total: items.length } };
    },
  };
}

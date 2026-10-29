// THE GATED LIVE-MODEL TEST (LIBRARY_SEARCH_DESIGN.md §9.1): runs only when VIDTSX_SEARCH_MODEL_DIR points at a
// downloaded multilingual-e5-small (the catalog's files); skipped otherwise. It re-embeds the 51 clips and every
// scored prompt through the product's embedder (embedder.ts — the worker's code path), asserts each vector agrees
// with the committed fixture (cosine ≥ 0.99), then runs the §9.1 benchmark with the engine child's own logic
// (engine-core.ts: the vector file in a scratch folder, the build, the per-query rank) as the semantic ranker.
// Nothing is downloaded (allowRemoteModels = false, local_files_only) and transformers.js caches go to a scratch
// folder, never into node_modules.
//   VIDTSX_SEARCH_MODEL_DIR=<dir> node <repo>/node_modules/vitest/vitest.mjs run src/library-search-engine/embedder.live.test.ts

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CORPUS_LIBRARY } from '../main/services/library/sound-match-corpus.fixture';
import { semanticItemOf } from '../main/services/library-search/item-text';
import type { SemanticRanker } from '../main/services/library-search/types';
import { SMART_BAR } from '../main/services/library-search/benchmark/benchmark-bar';
import { loadFixtureVectors, loadLabelledSet } from '../main/services/library-search/benchmark/benchmark-fixture';
import {
  ALL, CORPUS, HELD_OUT, benchDeps, formatRecallTable, isCorpusSource, pctOf, recallTable, runBenchmark, type RecallCount,
} from '../main/services/library-search/benchmark/benchmark-measure';
import { cosine } from '../main/services/library-search/benchmark/fixture-codec';
import { loadEmbedder, type TextEmbedder } from './embedder';
import { SearchCore } from './engine-core';
import { prependOrtDllPath } from './ort-dll-path';
import type { EngineModel, SearchWorkerResponse } from './types';
import { vectorFilePath } from './vector-store';

const MODEL_DIR = process.env.VIDTSX_SEARCH_MODEL_DIR ?? '';
const LONG = 600_000;

let scratch = '';
let embedder: TextEmbedder;
let model: EngineModel;

beforeAll(async () => {
  if (!MODEL_DIR) return;
  const require = createRequire(import.meta.url);
  const ortPkg = path.dirname(require.resolve('onnxruntime-node/package.json'));
  prependOrtDllPath([path.join(ortPkg, 'bin', 'napi-v6', 'win32', process.arch)]);
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-library-search-live-'));
  model = { modelId: 'multilingual-e5-small', modelDir: MODEL_DIR, cacheDir: path.join(scratch, 'tf-cache') };
  const t0 = performance.now();
  embedder = await loadEmbedder({ modelDir: model.modelDir, cacheDir: model.cacheDir });
  console.log(`[live] model loaded in ${Math.round(performance.now() - t0)} ms from ${MODEL_DIR}`);
}, LONG);

afterAll(async () => {
  if (!MODEL_DIR) return;
  await embedder?.dispose();
  const leftovers = await fs.readdir(scratch);
  console.log(`[live] scratch ${scratch} holds: ${JSON.stringify(leftovers)}`);
  await fs.rm(scratch, { recursive: true, force: true });
});

/** The engine child's logic as a SemanticRanker: each rank is one 'rank' message through SearchCore. */
function coreRanker(core: SearchCore, answers: Map<string, SearchWorkerResponse>, vectorFile: string): SemanticRanker {
  let n = 0;
  return {
    rank: async (query, items) => {
      n += 1;
      const requestId = `r${n}`;
      await core.handle({ type: 'rank', requestId, model, vectorFile, query, items });
      const a = answers.get(requestId);
      answers.delete(requestId);
      if (!a || a.type !== 'rankResult') throw new Error(a?.type === 'error' ? a.error : `no answer for ${requestId}`);
      return { ranked: a.ranked, vectors: a.vectors };
    },
  };
}

const at = (table: Map<string, RecallCount>, name: string): RecallCount => {
  const c = table.get(name);
  if (!c) throw new Error(`no row set ${name}`);
  return c;
};

describe.skipIf(!MODEL_DIR)('the gated live-model test (multilingual-e5-small, §9.1)', () => {
  it('every clip and every scored prompt re-embeds to its fixture vector (cosine ≥ 0.99)', async () => {
    const fx = loadFixtureVectors();
    const items = CORPUS_LIBRARY.map(semanticItemOf);
    const passages = await embedder.embedPassages(items.map((it) => it.text));
    const itemCos = items.map((it, i) => cosine(passages[i], fx.items.get(it.relPath)?.v ?? new Float32Array(passages[i].length)));
    const prompts = [...fx.queries.keys()];
    const fixtureOf = (p: string, n: number): Float32Array => fx.queries.get(p) ?? new Float32Array(n);
    // The fixture script embedded prompts 32 at a time; the engine embeds each query ALONE (engine-core.ts rank) —
    // q8 dynamic quantization makes a vector depend slightly on its batch-mates' padding, so both are measured.
    const batched = await embedder.embedQueries(prompts);
    const batchedCos = prompts.map((p, i) => cosine(batched[i], fixtureOf(p, batched[i].length)));
    const aloneCos: number[] = [];
    for (const p of prompts) {
      const [v] = await embedder.embedQueries([p]);
      aloneCos.push(cosine(v, fixtureOf(p, v.length)));
    }
    const min = (xs: number[]): string => Math.min(...xs).toFixed(6);
    console.log(`[live] ${items.length} clips: min cosine ${min(itemCos)} · ${prompts.length} prompts: min cosine ${min(batchedCos)} in batches of 32, ${min(aloneCos)} one at a time (the engine's way)`);
    expect(items).toHaveLength(51);
    expect(prompts).toHaveLength(1505);
    expect(Math.min(...itemCos)).toBeGreaterThanOrEqual(0.99);
    expect(Math.min(...batchedCos)).toBeGreaterThanOrEqual(0.99);
    expect(Math.min(...aloneCos)).toBeGreaterThanOrEqual(0.99);
  }, LONG);

  it('the §9.1 thresholds hold on live vectors, through the engine core (vector file, build, rank)', async () => {
    const answers = new Map<string, SearchWorkerResponse>();
    const core = new SearchCore({ loadEmbedder: async () => embedder, send: (m) => { if ('requestId' in m && m.requestId) answers.set(m.requestId, m); } });
    const vectorFile = vectorFilePath(scratch, model.modelId);
    const t0 = performance.now();
    await core.handle({ type: 'sync', requestId: 'build', model, vectorFile, items: CORPUS_LIBRARY.map(semanticItemOf), prune: true });
    console.log(`[live] build of 51 clips in ${Math.round(performance.now() - t0)} ms`);
    expect(answers.get('build')).toEqual({ type: 'syncResult', requestId: 'build', ready: 51, total: 51 });
    const saved = JSON.parse(await fs.readFile(vectorFile, 'utf8')) as Record<string, unknown> & { items: Record<string, unknown> };
    expect(saved).toMatchObject({ version: 1, modelId: 'multilingual-e5-small', dims: 384, pooling: 'mean', prefixVersion: 1 });
    expect(Object.keys(saved.items)).toHaveLength(51);

    const rows = loadLabelledSet();
    const t1 = performance.now();
    const smart = await runBenchmark(rows, benchDeps(CORPUS_LIBRARY, 'smart', coreRanker(core, answers, vectorFile)));
    const basic = await runBenchmark(rows, benchDeps(CORPUS_LIBRARY, 'basic'));
    console.log(`[live] ${smart.length} rows through the core in ${Math.round(performance.now() - t1)} ms (incl. Basic)`);
    const table = recallTable(smart);
    const basicTable = recallTable(basic);
    console.log(`[live] the live table:\n${formatRecallTable(table)}`);
    expect(smart.filter((r) => r.result.ran !== 'smart' || r.result.degraded).map((r) => r.row.id)).toEqual([]);
    for (const [name, r20, r10] of SMART_BAR) {
      expect(pctOf(at(table, name), 20), name).toBeGreaterThanOrEqual(r20);
      expect(pctOf(at(table, name), 10), name).toBeGreaterThanOrEqual(r10);
    }
    const corpusFiles = [...table.keys()].filter(isCorpusSource);
    expect(corpusFiles).toHaveLength(7);
    for (const f of [CORPUS, ...corpusFiles]) {
      expect(pctOf(at(table, f), 20), f).toBe(100);
      expect(pctOf(at(table, f), 10), f).toBe(100);
    }
    for (const [name, c] of table) {
      if (![ALL, CORPUS, HELD_OUT].includes(name) && c.named < 10) continue;
      expect(c.hits[10], name).toBeGreaterThanOrEqual(at(basicTable, name).hits[10]);
    }
  }, LONG);
});

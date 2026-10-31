#!/usr/bin/env node
// Writes the library-search benchmark fixture (LIBRARY_SEARCH_DESIGN.md §9.1):
//   src/main/services/library-search/benchmark/fixtures/labelled-set.json   — S1's labelled set ({ rows })
//   src/main/services/library-search/benchmark/fixtures/vectors-multilingual-e5-small.json — the 51 clips + every
//     scored prompt, embedded by the REAL model through the product's own item text (`item-text.ts`) and prefixes
//     (`library-search-engine/prefixes.ts`), q8, mean pooling + normalise, batches of 32.
// The stored precision (design §9.1): int8 (per-vector scaled) when the fixture's benchmark table equals S1's float32
// (c) table, else int16, checked the same way (exit 1 if neither holds). Also recorded: how many rows' top-20 order
// differs from this run's float32 (and from S1's own perRow), and every clip pair whose cosine order flips with its
// float32 gap — near-ties below the stored precision. The check lands in the file's `check` field and in a report.
//
// Usage (from the repo root):
//   node scripts/library-search-fixture.mjs --model <dir of multilingual-e5-small> --labelled <S1 labelled-set.json>
//        [--s1-report <S1 reports/c-rrf60-multilingual-e5-small-mean.json>] [--out <scratch dir>]
// The model dir must hold the catalog's files (config.json, tokenizer*.json, onnx/model_quantized.onnx); nothing is
// downloaded (allowRemoteModels = false, local_files_only) and transformers.js caches go to <out>/tf-cache, never
// into node_modules.

import * as esbuild from 'esbuild';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const SRC = path.join(REPO, 'src');
const FIXTURE_DIR = path.join(SRC, 'main', 'services', 'library-search', 'benchmark', 'fixtures');
const MODEL_ID = 'multilingual-e5-small';
const BATCH = 32;

function args() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, '')] = argv[i + 1];
  if (!out.model || !out.labelled) {
    console.error('usage: node scripts/library-search-fixture.mjs --model <dir> --labelled <labelled-set.json> [--s1-report <json>] [--out <dir>]');
    process.exit(2);
  }
  out.out = out.out ?? path.join(os.tmpdir(), 'vidtsx-library-search-fixture');
  return out;
}

const ENTRY = `
export { CORPUS_LIBRARY } from './main/services/library/sound-match-corpus.fixture';
export { semanticItemOf } from './main/services/library-search/item-text';
export { queryText, passageText, PREFIX_VERSION } from './library-search-engine/prefixes';
export { runBenchmark, recallTable, benchDeps, formatRecallTable, isScored } from './main/services/library-search/benchmark/benchmark-measure';
export { encodeVector, decodeVector } from './main/services/library-search/benchmark/fixture-codec';
export { fixtureRanker } from './main/services/library-search/benchmark/benchmark-fixture';
export { asCounts, S1_C_RRF60_E5_SMALL } from './main/services/library-search/benchmark/s1-tables';
`;

async function loadProductCode(outDir) {
  const bundle = path.join(outDir, 'library-search-fixture.bundle.cjs');
  await esbuild.build({
    stdin: { contents: ENTRY, resolveDir: SRC, loader: 'ts', sourcefile: 'fixture-entry.ts' },
    outfile: bundle, bundle: true, platform: 'node', format: 'cjs', target: 'node20', packages: 'external', logLevel: 'warning',
  });
  return createRequire(bundle)(bundle);
}

async function loadModel(modelDir, outDir) {
  const require = createRequire(import.meta.url);
  // The app's worker prepends onnxruntime-node's DLL folder to PATH (Windows) — the same here.
  const ortDir = path.join(path.dirname(require.resolve('onnxruntime-node/package.json')), 'bin', 'napi-v6', process.platform, process.arch);
  if (fs.existsSync(ortDir) && !(process.env.PATH ?? '').includes(ortDir)) process.env.PATH = `${ortDir}${path.delimiter}${process.env.PATH ?? ''}`;
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowRemoteModels = false;
  env.localModelPath = path.dirname(modelDir);
  env.cacheDir = path.join(outDir, 'tf-cache');
  const t0 = performance.now();
  const ex = await pipeline('feature-extraction', modelDir, { local_files_only: true, dtype: 'q8' });
  return { ex, loadMs: Math.round(performance.now() - t0) };
}

async function embedAll(ex, texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const t = await ex(texts.slice(i, i + BATCH), { pooling: 'mean', normalize: true });
    for (const v of t.tolist()) out.push(Float32Array.from(v));
  }
  return out;
}

const sameCounts = (a, b) => JSON.stringify(Object.keys(b).map((k) => [k, a[k]])) === JSON.stringify(Object.keys(b).map((k) => [k, b[k]]))
  && Object.keys(a).length === Object.keys(b).length;
const top20 = (r) => r.ids.slice(0, 20).join(',');

async function runAt(P, rows, vectors, precision) {
  const conv = (v) => (precision === 'float32' ? v : P.decodeVector(P.encodeVector(v, precision), precision));
  const items = new Map([...vectors.items].map(([relPath, x]) => [relPath, { textHash: x.textHash, v: conv(x.v) }]));
  const queries = new Map([...vectors.queries].map(([q, v]) => [q, conv(v)]));
  const results = await P.runBenchmark(rows, P.benchDeps(P.CORPUS_LIBRARY, 'smart', P.fixtureRanker({ items, queries })));
  const table = P.recallTable(results);
  return { precision, results, table, counts: P.asCounts(table), fellBack: results.filter((r) => r.result.ran !== 'smart').length };
}

function differ(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i += 1) if (top20(a[i]) !== b(a[i])) n += 1;
  return n;
}

const dot = (x, y) => { let s = 0; for (let i = 0; i < x.length; i += 1) s += x[i] * y[i]; return s; };

/** Every pair of clips whose cosine order (over all 51) flips at `precision` vs float32, with its float32 cosine gap. */
function flips(P, vectors, precision) {
  const conv = (v) => P.decodeVector(P.encodeVector(v, precision), precision);
  const items = [...vectors.items.values()].map((x) => ({ f: x.v, q: conv(x.v) }));
  let pairs = 0;
  let maxGap = 0;
  for (const qv of vectors.queries.values()) {
    const qq = conv(qv);
    const c = items.map((it) => ({ f: dot(qv, it.f), q: dot(qq, it.q) / Math.sqrt(dot(qq, qq) * dot(it.q, it.q)) }));
    for (let i = 0; i < c.length; i += 1) for (let j = i + 1; j < c.length; j += 1) {
      if (Math.sign(c[i].f - c[j].f) !== Math.sign(c[i].q - c[j].q)) { pairs += 1; maxGap = Math.max(maxGap, Math.abs(c[i].f - c[j].f)); }
    }
  }
  return { flippedPairs: pairs, maxFloat32CosineGap: Number(maxGap.toExponential(2)) };
}

function fixtureJson(header, items, queries) {
  const lines = ['{'];
  for (const [k, v] of Object.entries(header)) lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const block = (name, obj, last) => {
    const entries = Object.entries(obj);
    lines.push(`  ${JSON.stringify(name)}: {`);
    entries.forEach(([k, v], i) => lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)}${i < entries.length - 1 ? ',' : ''}`));
    lines.push(`  }${last ? '' : ','}`);
  };
  block('items', items, false);
  block('queries', queries, true);
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const a = args();
  fs.mkdirSync(a.out, { recursive: true });
  const P = await loadProductCode(a.out);
  const labelled = JSON.parse(fs.readFileSync(a.labelled, 'utf8'));
  const rows = labelled.rows;
  const prompts = [...new Set(rows.filter(P.isScored).map((r) => r.prompt))];
  const items = P.CORPUS_LIBRARY.map((e) => P.semanticItemOf(e));

  const { ex, loadMs } = await loadModel(path.resolve(a.model), a.out);
  const t0 = performance.now();
  const itemVecs = await embedAll(ex, items.map((it) => P.passageText(it.text)));
  const queryVecs = await embedAll(ex, prompts.map((p) => P.queryText(p)));
  const embedMs = Math.round(performance.now() - t0);
  const dims = itemVecs[0].length;
  const vectors = {
    items: new Map(items.map((it, i) => [it.relPath, { textHash: it.textHash, v: itemVecs[i] }])),
    queries: new Map(prompts.map((p, i) => [p, queryVecs[i]])),
  };

  const s1 = a['s1-report'] ? JSON.parse(fs.readFileSync(a['s1-report'], 'utf8')) : null;
  const s1Top = s1 ? new Map(s1.perRow.map((r) => [r.id, r.ranked.slice(0, 20).join(',')])) : null;
  const f32 = await runAt(P, rows, vectors, 'float32');
  const f32Top = new Map(f32.results.map((r) => [r.row.id, top20(r)]));
  const tried = [];
  let chosen = null;
  for (const precision of ['int8', 'int16']) {
    const run = await runAt(P, rows, vectors, precision);
    const tableEqualsS1 = sameCounts(run.counts, P.S1_C_RRF60_E5_SMALL);
    const rowsTop20DifferFromFloat32 = differ(run.results, (r) => f32Top.get(r.row.id));
    tried.push({ precision, tableEqualsS1, rowsTop20DifferFromFloat32, fellBack: run.fellBack, run, ...flips(P, vectors, precision) });
    // The design's rule (§9.1): int8 if the fixture's (c) table equals S1's float32 table, else 16-bit (checked too).
    if (tableEqualsS1 && run.fellBack === 0) { chosen = tried[tried.length - 1]; break; }
  }
  const pick = chosen ?? tried[tried.length - 1];
  const check = {
    precision: pick.precision,
    tableEqualsS1: pick.tableEqualsS1,
    rowsTop20DifferFromS1: s1Top ? differ(pick.run.results, (r) => s1Top.get(r.row.id)) : null,
    rowsTop20DifferFromFloat32: pick.rowsTop20DifferFromFloat32,
    flippedPairsVsFloat32: pick.flippedPairs,
    maxFloat32CosineGapOfAFlip: pick.maxFloat32CosineGap,
    float32TableEqualsS1: sameCounts(f32.counts, P.S1_C_RRF60_E5_SMALL),
    float32RowsTop20DifferFromS1: s1Top ? differ(f32.results, (r) => s1Top.get(r.row.id)) : null,
    tried: tried.map(({ precision, tableEqualsS1, rowsTop20DifferFromFloat32, flippedPairs, maxFloat32CosineGap }) => ({
      precision, tableEqualsS1, rowsTop20DifferFromFloat32, flippedPairs, maxFloat32CosineGap,
    })),
    scoredRows: f32.results.length,
    dtype: 'q8',
    generatedBy: 'scripts/library-search-fixture.mjs',
  };

  const enc = (v) => P.encodeVector(v, pick.precision);
  const header = { version: 1, modelId: MODEL_ID, dims, pooling: 'mean', prefixVersion: P.PREFIX_VERSION, precision: pick.precision, check };
  const itemsOut = Object.fromEntries([...vectors.items].map(([relPath, x]) => [relPath, { textHash: x.textHash, ...enc(x.v) }]));
  const queriesOut = Object.fromEntries([...vectors.queries].map(([q, v]) => [q, enc(v)]));
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const vecFile = path.join(FIXTURE_DIR, `vectors-${MODEL_ID}.json`);
  fs.writeFileSync(vecFile, fixtureJson(header, itemsOut, queriesOut));
  const setFile = path.join(FIXTURE_DIR, 'labelled-set.json');
  fs.writeFileSync(setFile, `{\n  "from": "S1 spike labelled set (docs/studio/search/S1-spike-report.md §1)",\n  "rows": [\n${rows.map((r) => `    ${JSON.stringify(r)}`).join(',\n')}\n  ]\n}\n`);

  const report = [
    `# library-search fixture — ${new Date().toISOString()}`, '',
    `model: ${path.resolve(a.model)} (q8, mean + normalise, dims ${dims}); load ${loadMs} ms; embedded ${items.length} items + ${prompts.length} prompts in ${embedMs} ms (batches of ${BATCH})`,
    `rows: ${rows.length} (scored ${f32.results.length}); excluded dropped: ${(labelled.excluded ?? []).length}`,
    `chosen precision: ${pick.precision}${chosen ? '' : ' (NO precision passed the check)'}`,
    `check: ${JSON.stringify(check)}`,
    `files: ${vecFile} ${fs.statSync(vecFile).size} B · ${setFile} ${fs.statSync(setFile).size} B`, '',
    '## float32', '', P.formatRecallTable(f32.table), '',
    ...tried.flatMap((t) => [`## ${t.precision} (table = S1: ${t.tableEqualsS1}; rows differing from float32: ${t.rowsTop20DifferFromFloat32})`, '', P.formatRecallTable(t.run.table), '']),
  ].join('\n');
  const reportFile = path.join(a.out, 'library-search-fixture-report.md');
  fs.writeFileSync(reportFile, report);
  console.log(report.split('\n').slice(0, 6).join('\n'));
  console.log(`report: ${reportFile}`);
  if (!chosen) process.exitCode = 1;
}

await main();

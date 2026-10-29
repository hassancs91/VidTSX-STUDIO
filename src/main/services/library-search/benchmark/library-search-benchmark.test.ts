// THE COMMITTED BENCHMARK (LIBRARY_SEARCH_DESIGN.md §9.1): S1's 1,565-row labelled set over the 51-clip corpus, run
// through the PRODUCT's searchLibrary (pool + keyword list + fusion) with the fixture's multilingual-e5-small vectors
// injected as the semantic ranker. Thresholds, not exact firsts — except the precision check, which pins that the
// stored vectors reproduce S1's float32 (c) table, and "Basic = today", which pins S1's (a) table.

import { beforeAll, describe, expect, it } from 'vitest';
import { CORPUS_LIBRARY } from '../../library/sound-match-corpus.fixture';
import { rankLibrarySounds } from '../../library/sound-match';
import { selectSoundAnswer } from '../../library/sound-answer';
import { itemText, semanticItemOf } from '../item-text';
import {
  ALL, CORPUS, HELD_OUT, benchDeps, clipIdOf, formatRecallTable, isCorpusSource, isScored, pctOf, recallTable, runBenchmark,
  type BenchResult, type RecallCount,
} from './benchmark-measure';
import { SMART_BAR } from './benchmark-bar';
import { fixtureRanker, loadFixtureVectors, loadLabelledSet } from './benchmark-fixture';
import { asCounts, S1_A_KEYWORDS, S1_C_RRF60_E5_SMALL } from './s1-tables';

const rows = loadLabelledSet();
const fx = loadFixtureVectors();
let smart: BenchResult[] = [];
let basic: BenchResult[] = [];
let smartTable = new Map<string, RecallCount>();
let basicTable = new Map<string, RecallCount>();
/** The matcher's own ranking per Basic row (computed once: 1,515 full rankings take seconds). */
let matcher = new Map<number, ReturnType<typeof rankLibrarySounds>>();

beforeAll(async () => {
  smart = await runBenchmark(rows, benchDeps(CORPUS_LIBRARY, 'smart', fixtureRanker(fx)));
  basic = await runBenchmark(rows, benchDeps(CORPUS_LIBRARY, 'basic'));
  smartTable = recallTable(smart);
  basicTable = recallTable(basic);
  matcher = new Map(basic.map((r) => [r.row.id, rankLibrarySounds(CORPUS_LIBRARY, r.row.prompt, {
    soundClass: r.row.cls, minDurationSec: r.row.min, limit: CORPUS_LIBRARY.length,
  })]));
}, 180_000);

const matcherOf = (id: number): ReturnType<typeof rankLibrarySounds> => {
  const m = matcher.get(id);
  if (!m) throw new Error(`no matcher ranking for row #${id}`);
  return m;
};

const at = (table: Map<string, RecallCount>, name: string): RecallCount => {
  const c = table.get(name);
  if (!c) throw new Error(`no row set ${name}`);
  return c;
};

describe('the fixture', () => {
  it("is S1's labelled set: 1,565 rows (1,375 named, 140 ∅, 50 *), each with its source and labeller", () => {
    expect(rows).toHaveLength(1565);
    expect(rows.filter((r) => r.kind === 'named')).toHaveLength(1375);
    expect(rows.filter((r) => r.kind === 'null')).toHaveLength(140);
    expect(rows.filter((r) => r.kind === 'any')).toHaveLength(50);
    // E3's corpus keeps one empty prompt (row #48, '∅') — a prompt is a string, not necessarily non-empty.
    expect(rows.filter((r) => !r.source || !r.labelledBy || typeof r.prompt !== 'string').map((r) => r.id)).toEqual([]);
    expect(rows.filter((r) => r.prompt === '').map((r) => r.id)).toEqual([48]);
  });

  it('holds a vector for every clip (at its current item text) and every scored prompt, within ~3 MB', () => {
    expect(fx.file).toMatchObject({ version: 1, modelId: 'multilingual-e5-small', dims: 384, pooling: 'mean', prefixVersion: 1 });
    // The generator's recorded precision check (scripts/library-search-fixture.mjs): the stored precision reproduces
    // S1's float32 (c) table, and so did the float32 vectors it was quantised from.
    expect(fx.file.check).toMatchObject({ precision: fx.file.precision, tableEqualsS1: true, float32TableEqualsS1: true, scoredRows: 1515 });
    for (const e of CORPUS_LIBRARY) expect(fx.items.get(e.relPath)?.textHash).toBe(semanticItemOf(e).textHash);
    for (const r of rows.filter(isScored)) expect(fx.queries.has(r.prompt)).toBe(true);
    expect([...fx.items.values()].every((x) => x.v.length === 384)).toBe(true);
    expect(JSON.stringify(fx.file).length).toBeLessThan(3_200_000);
    expect(itemText(CORPUS_LIBRARY[0]).length).toBeGreaterThan(0);
  });
});

describe('Smart (keywords + multilingual-e5-small, RRF60) — §9.1 thresholds', () => {
  it('ran Smart on every row (no stale vector, no fallback)', () => {
    expect(smart).toHaveLength(1515);
    expect(smart.filter((r) => r.result.ran !== 'smart' || r.result.degraded).map((r) => r.row.id)).toEqual([]);
  });

  it.each(SMART_BAR)('%s: R@20 ≥ %d, R@10 ≥ %d', (name, r20, r10) => {
    const c = at(smartTable, name);
    expect(pctOf(c, 20), formatRecallTable(smartTable)).toBeGreaterThanOrEqual(r20);
    expect(pctOf(c, 10), formatRecallTable(smartTable)).toBeGreaterThanOrEqual(r10);
  });

  it('CORPUS: each of the 7 files at R@20 = R@10 = 100.0', () => {
    const files = [...smartTable.keys()].filter(isCorpusSource);
    expect(files).toHaveLength(7);
    for (const f of [CORPUS, ...files]) {
      expect(pctOf(at(smartTable, f), 20), f).toBe(100);
      expect(pctOf(at(smartTable, f), 10), f).toBe(100);
    }
  });

  it('no regression vs the keyword baseline on R@10 (ALL / CORPUS / HELD-OUT and every file with ≥ 10 named rows)', () => {
    for (const [name, c] of smartTable) {
      const b = at(basicTable, name);
      if (![ALL, CORPUS, HELD_OUT].includes(name) && c.named < 10) continue;
      expect(c.hits[10], name).toBeGreaterThanOrEqual(b.hits[10]);
    }
  });

  it("reproduces S1's float32 (c) table at R@1 / R@3 / R@10 / R@20 (the precision check)", () => {
    expect(asCounts(smartTable)).toEqual(S1_C_RRF60_E5_SMALL);
  });

  it('nothing fits is never a retrieval decision: a non-empty pool always answers, an empty one is poolSize 0 (§6)', () => {
    for (const r of smart) {
      if (r.result.poolSize > 0) expect(r.result.candidates.length, `#${r.row.id}`).toBe(Math.min(20, r.result.poolSize));
      else expect(r.result.candidates, `#${r.row.id}`).toEqual([]);
    }
    expect(smart.filter((r) => r.result.poolSize === 0).length).toBeGreaterThan(0);
  });
});

describe('Basic = today, exactly (§9.1)', () => {
  it("lists selectSoundAnswer's three first, same clips, same order, on every row", () => {
    const off: number[] = [];
    for (const r of basic) {
      const three = (selectSoundAnswer(matcherOf(r.row.id), r.row.prompt)?.rows ?? []).map((a) => clipIdOf(a.match.entry.relPath));
      if (JSON.stringify(r.ids.slice(0, 3)) !== JSON.stringify(three)) off.push(r.row.id);
      expect(r.result.ran).toBe('basic');
    }
    expect(off).toEqual([]);
  });

  it("equals S1's (a) keyword table per file at R@1 / R@3 / R@10 / R@20", () => {
    expect(asCounts(basicTable)).toEqual(S1_A_KEYWORDS);
  });

  it("answers nothing exactly when the matcher scores nothing (a true miss — the tool then generates)", () => {
    for (const r of basic) {
      const ranking = matcherOf(r.row.id);
      expect(r.result.candidates.length === 0, `#${r.row.id}`).toBe(ranking.matches.length + ranking.nearest.length === 0);
    }
  });
});

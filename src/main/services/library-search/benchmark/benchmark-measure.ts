// The committed benchmark's measures (LIBRARY_SEARCH_DESIGN.md §9.1 = S1's definitions, report §2): recall@k of the
// answer's candidate list (= what the assistant sees) over the named rows ('x|∅' rows count as named); '∅' rows are
// not in recall; '*' rows are never scored. Shared by the benchmark test, the gated live test and the fixture script.

import type { LibraryIndexEntry } from '../../../../shared/types/asset-library';
import type { LibrarySearchResult } from '../../../../shared/types/library-search';
import { searchLibrary } from '../library-search';
import type { LibrarySearchDeps } from '../types';

/** One row of S1's labelled set (`labelled-set.json`). */
export interface BenchRow {
  id: number;
  source: string;
  prompt: string;
  expected: string;
  /** The allowed clip ids. */
  named: string[];
  /** The row also allows "nothing fits" ('x|∅', or a pure '∅' row). */
  hasNull: boolean;
  kind: 'named' | 'null' | 'any';
  cls: 'sfx' | 'music';
  min?: number;
  labelledBy: string;
}

export interface BenchResult {
  row: BenchRow;
  result: LibrarySearchResult;
  /** The candidates' clip ids, in the answer's order. */
  ids: string[];
}

export interface RecallCount {
  named: number;
  /** k → named rows with an allowed clip among the first k candidates. */
  hits: Record<number, number>;
}

export const BENCH_KS = [1, 3, 10, 20] as const;
export const ALL = 'ALL';
export const CORPUS = 'CORPUS';
export const HELD_OUT = 'HELD-OUT';

/** CORPUS = E3's seven committed corpus files (the keyword matcher's own tuning set). */
export const isCorpusSource = (source: string): boolean => source.startsWith('sound-match-corpus');
/** HELD-OUT = E3 verifier round 5's files + S1's own rows (incl. 10 Arabic). */
export const isHeldOutSource = (source: string): boolean => source.startsWith('r5/') || source.startsWith('S1-own');

export const clipIdOf = (relPath: string): string => (relPath.split('/').pop() ?? relPath).replace(/\.[a-z0-9]+$/i, '');

export const isScored = (row: BenchRow): boolean => row.kind !== 'any';

/** Every scored row through the PRODUCT's `searchLibrary` (sound tool request: audio of the row's class, limit 20). */
export async function runBenchmark(rows: BenchRow[], deps: LibrarySearchDeps): Promise<BenchResult[]> {
  const out: BenchResult[] = [];
  for (const row of rows.filter(isScored)) {
    const result = await searchLibrary(
      { query: row.prompt, kinds: ['audio'], soundClass: row.cls, ...(row.min !== undefined ? { minDurationSec: row.min } : {}), limit: 20 },
      deps,
    );
    out.push({ row, result, ids: result.candidates.map((c) => clipIdOf(c.relPath)) });
  }
  return out;
}

function countOf(results: BenchResult[]): RecallCount {
  const named = results.filter((r) => r.row.kind === 'named');
  const hits: Record<number, number> = {};
  for (const k of BENCH_KS) hits[k] = named.filter((r) => r.ids.slice(0, k).some((id) => r.row.named.includes(id))).length;
  return { named: named.length, hits };
}

/** ALL, CORPUS, HELD-OUT, then every source file in first-seen order. */
export function recallTable(results: BenchResult[]): Map<string, RecallCount> {
  const table = new Map<string, RecallCount>([
    [ALL, countOf(results)],
    [CORPUS, countOf(results.filter((r) => isCorpusSource(r.row.source)))],
    [HELD_OUT, countOf(results.filter((r) => isHeldOutSource(r.row.source)))],
  ]);
  for (const source of new Set(results.map((r) => r.row.source))) table.set(source, countOf(results.filter((r) => r.row.source === source)));
  return table;
}

/** recall@k in percent. */
export const pctOf = (c: RecallCount, k: number): number => (c.named ? (100 * c.hits[k]) / c.named : 0);

/** A plain-text table (for the fixture script's report and test messages). */
export function formatRecallTable(table: Map<string, RecallCount>): string {
  const lines = ['| set | named | R@1 | R@3 | R@10 | R@20 |', '|---|---|---|---|---|---|'];
  for (const [name, c] of table) lines.push(`| ${name} | ${c.named} | ${BENCH_KS.map((k) => `${c.hits[k]} (${pctOf(c, k).toFixed(1)})`).join(' | ')} |`);
  return lines.join('\n');
}

/** The deps for one benchmark mode over a fixed library. */
export function benchDeps(entries: LibraryIndexEntry[], choice: 'basic' | 'smart', semantic?: LibrarySearchDeps['semantic']): LibrarySearchDeps {
  return { loadEntries: () => entries, settings: () => ({ choice, modelId: 'multilingual-e5-small', modelDownloaded: true }), semantic };
}

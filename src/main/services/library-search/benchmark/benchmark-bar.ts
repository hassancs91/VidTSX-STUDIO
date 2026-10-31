// THE §9.1 Smart thresholds (LIBRARY_SEARCH_DESIGN.md §9.1 table): [row set, R@20 ≥, R@10 ≥]. Shared by the committed
// benchmark (library-search-benchmark.test.ts, fixture vectors) and the gated live-model test
// (library-search-engine/embedder.live.test.ts, live vectors). CORPUS — each of the 7 files at 100 / 100 — and the
// no-regression rule vs Basic on R@10 are asserted beside it.

import { ALL, HELD_OUT } from './benchmark-measure';

export const SMART_BAR: Array<[string, number, number]> = [
  [ALL, 99.5, 98.5],
  [HELD_OUT, 99.0, 96.5],
  ['r5/c-ordinary.txt', 99.4, 99.4],
  ['r5/d-stopword.txt', 97.5, 93.0],
  ['r5/j-falling.txt', 100.0, 91.6],
  ['r5/b-broad-flagged.txt', 100.0, 100.0],
  ['S1-own-en', 100.0, 100.0],
  ['S1-own-ar', 90.0, 80.0],
];

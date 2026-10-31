// S1's measured tables as hit COUNTS (named rows with an allowed clip among the first k), read from the S1 kit's
// reports (`.vidtsx-temp\search\S1\reports\`): (a) = `a-keywords.json` (the keyword answer at c5a6124 — "today"),
// (c) = `c-rrf60-multilingual-e5-small-mean.json` (RRF60 + multilingual-e5-small, float32 vectors). Each table's
// fractions × named, rounded; they match the report's §4 / §5 / §14 percentages. [named, R@1, R@3, R@10, R@20].

export type S1Counts = Record<string, readonly [number, number, number, number, number]>;

export const S1_A_KEYWORDS: S1Counts = {
  ALL: [1375, 1153, 1248, 1262, 1263],
  CORPUS: [950, 935, 950, 950, 950],
  'HELD-OUT': [425, 218, 298, 312, 313],
  'sound-match-corpus.test.ts': [116, 115, 116, 116, 116],
  'sound-match-corpus-r3-inflections.test.ts': [193, 193, 193, 193, 193],
  'sound-match-corpus-r3-ordinary.test.ts': [125, 125, 125, 125, 125],
  'sound-match-corpus-r3-placement.test.ts': [129, 129, 129, 129, 129],
  'sound-match-corpus-r3-senses.test.ts': [136, 135, 136, 136, 136],
  'sound-match-corpus-r4-frames.test.ts': [65, 53, 65, 65, 65],
  'sound-match-corpus-r4-ordinary.test.ts': [186, 185, 186, 186, 186],
  'r5/j-falling.txt': [12, 3, 4, 4, 4],
  'r5/c-ordinary.txt': [171, 124, 166, 170, 171],
  'r5/d-stopword.txt': [174, 65, 74, 80, 80],
  'r5/i-nine.txt': [6, 1, 2, 6, 6],
  'r5/e-realindex.txt': [2, 0, 2, 2, 2],
  'r5/b-broad-flagged.txt': [26, 1, 26, 26, 26],
  'S1-own-en': [24, 24, 24, 24, 24],
  'S1-own-ar': [10, 0, 0, 0, 0],
};

export const S1_C_RRF60_E5_SMALL: S1Counts = {
  ALL: [1375, 1202, 1304, 1366, 1374],
  CORPUS: [950, 941, 950, 950, 950],
  'HELD-OUT': [425, 261, 354, 416, 424],
  'sound-match-corpus.test.ts': [116, 115, 116, 116, 116],
  'sound-match-corpus-r3-inflections.test.ts': [193, 191, 193, 193, 193],
  'sound-match-corpus-r3-ordinary.test.ts': [125, 123, 125, 125, 125],
  'sound-match-corpus-r3-placement.test.ts': [129, 129, 129, 129, 129],
  'sound-match-corpus-r3-senses.test.ts': [136, 132, 136, 136, 136],
  'sound-match-corpus-r4-frames.test.ts': [65, 65, 65, 65, 65],
  'sound-match-corpus-r4-ordinary.test.ts': [186, 186, 186, 186, 186],
  'r5/j-falling.txt': [12, 4, 4, 12, 12],
  'r5/c-ordinary.txt': [171, 139, 167, 171, 171],
  'r5/d-stopword.txt': [174, 67, 118, 166, 173],
  'r5/i-nine.txt': [6, 2, 6, 6, 6],
  'r5/e-realindex.txt': [2, 2, 2, 2, 2],
  'r5/b-broad-flagged.txt': [26, 19, 26, 26, 26],
  'S1-own-en': [24, 23, 24, 24, 24],
  'S1-own-ar': [10, 5, 7, 9, 10],
};

/** A recall table (benchmark-measure `recallTable`) as the same tuples. */
export function asCounts(table: Map<string, { named: number; hits: Record<number, number> }>): S1Counts {
  const out: Record<string, readonly [number, number, number, number, number]> = {};
  for (const [name, c] of table) out[name] = [c.named, c.hits[1], c.hits[3], c.hits[10], c.hits[20]];
  return out;
}

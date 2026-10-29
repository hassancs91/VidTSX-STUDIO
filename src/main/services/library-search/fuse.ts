// Reciprocal-rank fusion of the keyword list and the semantic ranking (LIBRARY_SEARCH_DESIGN.md §3, S1's (c),
// report §14): fused = Σ 1 / (60 + rank) over the lists that hold the item, rank 1-based; ties by the cosine, then
// by relPath. The fused score is rank-based (max 2 / 61): an ORDER, never shown as a confidence. An item in one list
// only (vectors still building, or no prompt word) keeps its one term. Pure.

export const RRF_K = 60;

export interface FusedItem {
  relPath: string;
  score: number;
  keywordRank?: number;
  semanticRank?: number;
  cosine?: number;
}

export function fuseRankings(keyword: string[], semantic: Array<{ relPath: string; cosine: number }>, k = RRF_K): FusedItem[] {
  const byPath = new Map<string, FusedItem>();
  semantic.forEach(({ relPath, cosine }, i) => byPath.set(relPath, { relPath, score: 1 / (k + i + 1), semanticRank: i + 1, cosine }));
  keyword.forEach((relPath, i) => {
    const term = 1 / (k + i + 1);
    const item = byPath.get(relPath);
    if (item) {
      item.score += term;
      item.keywordRank = i + 1;
    } else byPath.set(relPath, { relPath, score: term, keywordRank: i + 1 });
  });
  const cos = (x: FusedItem): number => x.cosine ?? Number.NEGATIVE_INFINITY;
  return [...byPath.values()].sort((a, b) => b.score - a.score || cos(b) - cos(a) || a.relPath.localeCompare(b.relPath));
}

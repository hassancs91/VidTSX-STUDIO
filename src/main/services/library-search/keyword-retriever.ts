// Basic's ordered list — the keyword half of every search (LIBRARY_SEARCH_DESIGN.md §3). Pure.
//
// Audio with a sound class (the sound tools): E3's matcher exactly as it answers today (S1's (a) list, report §3) —
// `selectSoundAnswer`'s rows first (what the assistant sees today), then the other confident matches in the matcher's
// rank order, then the rest by coverage (the matcher's order breaks ties); clips the matcher does not score are left
// out. The matcher files are read, never changed (byte-identical to 7967c6f).
//
// Anything else (images, video, mixed kinds, audio with no class): a coverage ranking over the file name, tags,
// category and description built from the matcher's exported word functions — the share of the query's
// (weighted) words an entry covers, a field weighing as in the matcher; best first, ties by relPath; none = left out.

import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type { LibrarySearchRequest } from '../../../shared/types/library-search';
import { rankLibrarySounds, type SoundMatch } from '../library/sound-match';
import { matchStrength, promptTerms, soundTokens } from '../library/sound-match-words';
import { CONFIDENT_COVERAGE, selectSoundAnswer } from '../library/sound-answer';
import { promptSoundWords, wordsCoveredBy } from '../library/sound-answer-words';
import type { KeywordHit } from './types';

const FIELD_WEIGHT = { tag: 1, name: 1, category: 0.9, description: 0.6 } as const;
type Field = keyof typeof FIELD_WEIGHT;

function soundList(pool: LibraryIndexEntry[], request: LibrarySearchRequest, soundClass: 'sfx' | 'music'): KeywordHit[] {
  const ranking = rankLibrarySounds(pool, request.query, {
    soundClass,
    ...(request.minDurationSec !== undefined ? { minDurationSec: request.minDurationSec } : {}),
    limit: pool.length,
  });
  const head = (selectSoundAnswer(ranking, request.query)?.rows ?? []).map((row) => row.match);
  const confident = ranking.matches.filter((m) => m.coverage >= CONFIDENT_COVERAGE);
  const below = [...ranking.matches.filter((m) => m.coverage < CONFIDENT_COVERAGE), ...ranking.nearest].sort((a, b) => b.coverage - a.coverage);
  const shown = new Set(head.map((m) => m.entry.relPath));
  const ordered: SoundMatch[] = [...head, ...[...confident, ...below].filter((m) => !shown.has(m.entry.relPath))];
  const words = promptSoundWords(request.query);
  return ordered.map((m) => ({ entry: m.entry, coverage: m.coverage, words: wordsCoveredBy(m.entry, words) }));
}

function fieldsOf(entry: LibraryIndexEntry): Record<Field, string[]> {
  const file = entry.relPath.split('/').pop() ?? entry.relPath;
  return {
    tag: (entry.tags ?? []).flatMap((t) => soundTokens(t)),
    name: soundTokens(file.replace(/\.[a-z0-9]+$/i, '').replace(/[-_.]+/g, ' ')),
    category: entry.audio?.category ? soundTokens(entry.audio.category) : [],
    description: entry.description ? soundTokens(entry.description) : [],
  };
}

function bestHit(word: string, fields: Record<Field, string[]>): number {
  let best = 0;
  for (const field of Object.keys(FIELD_WEIGHT) as Field[]) {
    let strength = 0;
    for (const token of fields[field]) strength = Math.max(strength, matchStrength(word, token));
    best = Math.max(best, FIELD_WEIGHT[field] * strength);
  }
  return best;
}

function coverageList(pool: LibraryIndexEntry[], query: string): KeywordHit[] {
  const { terms } = promptTerms(query);
  const total = terms.reduce((sum, t) => sum + t.weight, 0);
  if (total <= 0) return [];
  const hits: KeywordHit[] = [];
  for (const entry of pool) {
    const fields = fieldsOf(entry);
    let covered = 0;
    const words: string[] = [];
    for (const { word, weight } of terms) {
      const hit = bestHit(word, fields);
      if (hit <= 0) continue;
      covered += hit * weight;
      words.push(word);
    }
    if (covered > 0) hits.push({ entry, coverage: covered / total, words });
  }
  return hits.sort((a, b) => b.coverage - a.coverage || a.entry.relPath.localeCompare(b.entry.relPath));
}

/** The keyword list over an already-filtered pool (`search-pool.ts`), best first; [] = nothing scored. */
export function keywordList(pool: LibraryIndexEntry[], request: LibrarySearchRequest): KeywordHit[] {
  if (pool.length === 0) return [];
  const audioOnly = request.kinds?.length === 1 && request.kinds[0] === 'audio';
  if (audioOnly && request.soundClass) return soundList(pool, request, request.soundClass);
  return coverageList(pool, request.query);
}

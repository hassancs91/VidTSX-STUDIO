// E3 fix round 4 (E-d16b): which of a prompt's sound words a library entry COVERS — the input of the answer's
// word-diversity rule (`sound-answer.ts`). A small, stated duplication of the matcher's field reading: the matcher
// (`sound-match.ts` `fieldsOf` / `hitOf`) does not export it, and the three matcher files stay byte-identical to
// `7967c6f` (E-d16), so the same four fields are tokenized here the same way, through the EXPORTED `soundTokens` /
// `matchStrength` / `promptTerms` (`sound-match-words.ts`).
//
// The rule ("covers a word"): the prompt's words are `promptTerms(prompt).terms` — its head and qualifier words; the
// placement words (`bonus`, "… when the slide changes") are excluded, and a negated word ("no whoosh") is already
// dropped by `soundTokens`. An entry COVERS a word when `matchStrength(word, token) > 0` for some token of its tags,
// its file-name parts, its category or its description — any of the matcher's fields, any strength (an equal word, a
// plural / -y form, a verb-form stem). That is exactly when the matcher's `hitOf` weight for the word is > 0 (every
// field weight is > 0), i.e. when the word adds to that entry's coverage — so every clip the matcher scores covers at
// least one word and no other candidate covers any (pinned by `sound-answer-words.test.ts` over the 51-clip fixture).

import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { matchStrength, promptTerms, soundTokens } from './sound-match-words';

/** The prompt's sound words the coverage is computed over (head + qualifiers; no placement words). */
export function promptSoundWords(prompt: string): string[] {
  return promptTerms(prompt).terms.map((t) => t.word);
}

/** The entry's tokens over the matcher's four fields, read as `sound-match.ts` `fieldsOf` reads them. */
function entryTokens(entry: LibraryIndexEntry): string[] {
  const file = entry.relPath.split('/').pop() ?? entry.relPath;
  return [
    ...(entry.tags ?? []).flatMap((t) => soundTokens(t)),
    ...soundTokens(file.replace(/\.[a-z0-9]+$/i, '').replace(/[_\s.]+/g, '-').split('-').join(' ')),
    ...(entry.audio?.category ? soundTokens(entry.audio.category) : []),
    ...(entry.description ? soundTokens(entry.description) : []),
  ];
}

/** The words (of `words`, in their order) the entry covers. */
export function wordsCoveredBy(entry: LibraryIndexEntry, words: readonly string[]): string[] {
  if (words.length === 0) return [];
  const tokens = entryTokens(entry);
  return words.filter((word) => tokens.some((token) => matchStrength(word, token) > 0));
}

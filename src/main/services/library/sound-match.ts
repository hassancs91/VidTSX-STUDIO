// Reuse before generate (E3, plan §2 T6): score the library's audio entries
// for a sound prompt so generate_sfx / generate_music can answer "the library
// already has these" instead of paying for a new clip. Pure — entries in,
// ranked matches out; the tool layer loads the index and formats the answer.
//
// The score is an idf-weighted coverage of the prompt's words over each entry's
// tags, file name, category and description (a word few clips carry weighs
// more than "soft", which most catalog clips carry), and a match needs either
// half the weight covered, or the prompt's HEAD word (the sound itself — the
// last word of its first clause) plus 30 %. Words after a negation ("no music,
// no metallic ring" — the catalog prompts are full of them) never count. A
// prompt's placement words ("… when the slide changes", "… until the reveal")
// say WHEN the sound plays: they never count in the coverage, so they cannot
// sink a match (F1), but one that names a clip in its tags / name / category
// ("a snap when the TRAP closes") adds a small ranking bonus — never a match.
// The words themselves (tokens, inflections, the head word) are in
// `sound-match-words.ts` (fix round 2, F2).

import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { mediaKindOf } from '../../../shared/media-kinds';
import { promptTerms, soundTokens, wordsMatch } from './sound-match-words';

export { headWord, soundTokens } from './sound-match-words';

export type SoundClass = 'sfx' | 'music';

export interface SoundMatchOptions {
  soundClass: SoundClass;
  /** Drop candidates whose probed length is shorter (a music bed must cover the asked length). */
  minDurationSec?: number;
  /** Default 3. */
  limit?: number;
}

export interface SoundMatch {
  entry: LibraryIndexEntry;
  /** 0–1: the share of the prompt's (idf-weighted) sound words this entry covers. */
  coverage: number;
  /** Prompt words hit in a tag, the file name or the category. */
  strongHits: number;
  /** Placement words hit in a tag, the file name or the category (a ranking bonus only). */
  placementHits: number;
}

/** Above this probed length an unlabelled clip is music, not an effect (the SFX generator's own maximum). */
const SFX_MAX_SECONDS = 30;
const MATCH_COVERAGE = 0.5;
const HEAD_MATCH_COVERAGE = 0.3;
/** Per placement word with a strong hit, capped — enough to break a tie, never to beat a real coverage gap. */
const PLACEMENT_BONUS = 0.05;
const PLACEMENT_BONUS_MAX = 0.1;
const FIELD_WEIGHT = { tag: 1, name: 1, category: 0.9, description: 0.6 } as const;

interface EntryFields {
  tag: string[];
  name: string[];
  category: string[];
  description: string[];
}

function fieldsOf(entry: LibraryIndexEntry): EntryFields {
  const file = entry.relPath.split('/').pop() ?? entry.relPath;
  return {
    tag: (entry.tags ?? []).flatMap((t) => soundTokens(t)),
    name: soundTokens(file.replace(/\.[a-z0-9]+$/i, '').replace(/[_\s.]+/g, '-').split('-').join(' ')),
    category: entry.audio?.category ? soundTokens(entry.audio.category) : [],
    description: entry.description ? soundTokens(entry.description) : [],
  };
}

/** The best field weight a word hits on an entry (0 = none). */
function hitWeight(word: string, fields: EntryFields): number {
  let best = 0;
  for (const field of ['tag', 'name', 'category', 'description'] as const) {
    if (FIELD_WEIGHT[field] > best && fields[field].some((w) => wordsMatch(word, w))) best = FIELD_WEIGHT[field];
  }
  return best;
}

/** sfx / music by folder, file-name prefix or tags; else by probed length; 'either' when nothing tells. */
export function soundClassOf(entry: LibraryIndexEntry): SoundClass | 'either' {
  const segments = entry.relPath.toLowerCase().split('/');
  const file = segments.pop() ?? '';
  const tags = (entry.tags ?? []).map((t) => t.toLowerCase());
  if (segments.includes('music') || file.startsWith('music-') || tags.includes('music') || tags.includes('bed')) return 'music';
  if (segments.includes('sfx') || file.startsWith('sfx-')) return 'sfx';
  const duration = entry.probe?.duration;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return 'either';
  return duration > SFX_MAX_SECONDS ? 'music' : 'sfx';
}

function isCandidate(entry: LibraryIndexEntry, opts: SoundMatchOptions): boolean {
  if ((entry.kind ?? mediaKindOf(entry.relPath)) !== 'audio') return false;
  const cls = soundClassOf(entry);
  if (cls !== 'either' && cls !== opts.soundClass) return false;
  const duration = entry.probe?.duration;
  return opts.minDurationSec === undefined || typeof duration !== 'number' || duration >= opts.minDurationSec;
}

const rankOf = (m: SoundMatch): number => m.coverage + Math.min(PLACEMENT_BONUS_MAX, PLACEMENT_BONUS * m.placementHits);

/** The library sounds that fit the prompt, best first (at most `limit`, default 3); [] = generate. */
export function matchLibrarySounds(entries: LibraryIndexEntry[], prompt: string, opts: SoundMatchOptions): SoundMatch[] {
  const { terms, bonus, head } = promptTerms(prompt);
  const candidates = entries.filter((e) => isCandidate(e, opts)).map((entry) => ({ entry, fields: fieldsOf(entry) }));
  if (terms.length === 0 || candidates.length === 0) return [];
  const n = candidates.length;
  const idf = new Map<string, number>();
  for (const { word } of terms) {
    const df = candidates.filter((c) => hitWeight(word, c.fields) > 0).length;
    idf.set(word, Math.log((n + 1) / (df + 0.5)));
  }
  const total = terms.reduce((sum, t) => sum + t.weight * (idf.get(t.word) ?? 0), 0);
  if (total <= 0) return [];

  const scored: SoundMatch[] = [];
  for (const { entry, fields } of candidates) {
    let covered = 0;
    let strongHits = 0;
    let headHit = false;
    for (const { word, weight } of terms) {
      const hit = hitWeight(word, fields);
      if (hit === 0) continue;
      covered += hit * weight * (idf.get(word) ?? 0);
      if (hit >= FIELD_WEIGHT.category) strongHits += 1;
      if (word === head) headHit = true;
    }
    const coverage = covered / total;
    if (coverage < MATCH_COVERAGE && !(headHit && coverage >= HEAD_MATCH_COVERAGE)) continue;
    const placementHits = bonus.filter((w) => hitWeight(w, fields) >= FIELD_WEIGHT.category).length;
    scored.push({ entry, coverage, strongHits, placementHits });
  }
  scored.sort(
    (a, b) =>
      rankOf(b) - rankOf(a) ||
      b.strongHits - a.strongHits ||
      (b.entry.usedIn?.length ?? 0) - (a.entry.usedIn?.length ?? 0) ||
      a.entry.relPath.localeCompare(b.entry.relPath),
  );
  return scored.slice(0, opts.limit ?? 3);
}

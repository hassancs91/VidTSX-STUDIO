// Reuse before generate (E3, plan §2 T6): score the library's audio entries
// for a sound prompt so generate_sfx / generate_music can answer "the library
// already has these" instead of paying for a new clip. Pure — entries in,
// ranked matches out; the tool layer loads the index and formats the answer.
//
// The score is an idf-weighted coverage of the prompt's words over each entry's
// tags, file name, category and description (a word few clips carry weighs
// more than "soft", which most catalog clips carry), and a match needs either
// half the weight covered, or the prompt's HEAD word (the sound itself — the
// last word of its first clause) hit by an EQUAL word plus 30 %. Words after a
// negation ("no music, no metallic ring" — the catalog prompts are full of
// them) never count. A prompt's placement words ("… when the slide changes",
// "… until the reveal") say WHEN the sound plays: they never count in the
// coverage, so they cannot sink a match (F1), but one that names a clip in its
// tags / name / category ("a snap when the TRAP closes") adds a small ranking
// bonus — never a match. A verb-form stem hit ("running" on a `run` tag) weighs
// `STEM_STRENGTH` of the field, so it never ties an equal hit (F3a). The words
// themselves (tokens, inflections, the head word) are in `sound-match-words.ts`.
//
// The miss rule (E-d15): when nothing matches, `nearestLibrarySounds` gives the
// candidates that still scored — the tool shows them instead of generating.

import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { mediaKindOf } from '../../../shared/media-kinds';
import { matchStrength, promptTerms, soundTokens } from './sound-match-words';

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

export interface SoundRanking {
  /** Above the match threshold, best first. */
  matches: SoundMatch[];
  /** Below it but scoring (coverage > 0), best first — the "closest library sounds" of a miss. */
  nearest: SoundMatch[];
}

/** Above this probed length an unlabelled clip is music, not an effect (the SFX generator's own maximum). */
const SFX_MAX_SECONDS = 30;
const MATCH_COVERAGE = 0.5;
const HEAD_MATCH_COVERAGE = 0.3;
/** Per placement word with a strong hit, capped — enough to break a tie, never to beat a real coverage gap. */
const PLACEMENT_BONUS = 0.05;
const PLACEMENT_BONUS_MAX = 0.1;
const FIELD_WEIGHT = { tag: 1, name: 1, category: 0.9, description: 0.6 } as const;
const STRONG_FIELDS = new Set<keyof EntryFields>(['tag', 'name', 'category']);

interface EntryFields {
  tag: string[];
  name: string[];
  category: string[];
  description: string[];
}

interface Hit {
  /** Field weight × word strength (0 = none). */
  weight: number;
  /** Hit in a tag, the file name or the category (whatever the strength). */
  strong: boolean;
  /** Hit by an equal word (or a plural / -y form) — what the head rule needs. */
  equal: boolean;
}
const NO_HIT: Hit = { weight: 0, strong: false, equal: false };

function fieldsOf(entry: LibraryIndexEntry): EntryFields {
  const file = entry.relPath.split('/').pop() ?? entry.relPath;
  return {
    tag: (entry.tags ?? []).flatMap((t) => soundTokens(t)),
    name: soundTokens(file.replace(/\.[a-z0-9]+$/i, '').replace(/[_\s.]+/g, '-').split('-').join(' ')),
    category: entry.audio?.category ? soundTokens(entry.audio.category) : [],
    description: entry.description ? soundTokens(entry.description) : [],
  };
}

/** The best hit a word makes on an entry. */
function hitOf(word: string, fields: EntryFields): Hit {
  let best = NO_HIT;
  for (const field of ['tag', 'name', 'category', 'description'] as const) {
    if (FIELD_WEIGHT[field] <= best.weight) continue;
    let strength = 0;
    for (const w of fields[field]) strength = Math.max(strength, matchStrength(word, w));
    const weight = FIELD_WEIGHT[field] * strength;
    if (weight > best.weight) best = { weight, strong: STRONG_FIELDS.has(field), equal: strength === 1 };
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

const byRank = (a: SoundMatch, b: SoundMatch): number =>
  rankOf(b) - rankOf(a) ||
  b.strongHits - a.strongHits ||
  (b.entry.usedIn?.length ?? 0) - (a.entry.usedIn?.length ?? 0) ||
  a.entry.relPath.localeCompare(b.entry.relPath);

/** Every candidate scored for the prompt, split at the match threshold; each list at most `limit` long. */
export function rankLibrarySounds(entries: LibraryIndexEntry[], prompt: string, opts: SoundMatchOptions): SoundRanking {
  const { terms, bonus, head } = promptTerms(prompt);
  const candidates = entries.filter((e) => isCandidate(e, opts)).map((entry) => ({ entry, fields: fieldsOf(entry) }));
  if (terms.length === 0 || candidates.length === 0) return { matches: [], nearest: [] };
  const n = candidates.length;
  const idf = new Map<string, number>();
  for (const { word } of terms) {
    const df = candidates.filter((c) => hitOf(word, c.fields).weight > 0).length;
    idf.set(word, Math.log((n + 1) / (df + 0.5)));
  }
  const total = terms.reduce((sum, t) => sum + t.weight * (idf.get(t.word) ?? 0), 0);
  if (total <= 0) return { matches: [], nearest: [] };

  const matches: SoundMatch[] = [];
  const nearest: SoundMatch[] = [];
  for (const { entry, fields } of candidates) {
    let covered = 0;
    let strongHits = 0;
    let headHit = false;
    for (const { word, weight } of terms) {
      const hit = hitOf(word, fields);
      if (hit.weight === 0) continue;
      covered += hit.weight * weight * (idf.get(word) ?? 0);
      if (hit.strong) strongHits += 1;
      if (word === head && hit.equal) headHit = true;
    }
    if (covered <= 0) continue;
    const coverage = covered / total;
    // The bonus is applied in the RANK only, after the threshold: a non-match stays one whatever its bonus.
    const placementHits = bonus.filter((w) => hitOf(w, fields).strong).length;
    const match: SoundMatch = { entry, coverage, strongHits, placementHits };
    if (coverage >= MATCH_COVERAGE || (headHit && coverage >= HEAD_MATCH_COVERAGE)) matches.push(match);
    else nearest.push(match);
  }
  const limit = opts.limit ?? 3;
  return { matches: matches.sort(byRank).slice(0, limit), nearest: nearest.sort(byRank).slice(0, limit) };
}

/** The library sounds that fit the prompt, best first (at most `limit`, default 3); [] = no match. */
export function matchLibrarySounds(entries: LibraryIndexEntry[], prompt: string, opts: SoundMatchOptions): SoundMatch[] {
  return rankLibrarySounds(entries, prompt, opts).matches;
}

/** On a miss: the candidates that still scored, best first (E-d15 — shown instead of generating); [] = a true miss. */
export function nearestLibrarySounds(entries: LibraryIndexEntry[], prompt: string, opts: SoundMatchOptions): SoundMatch[] {
  return rankLibrarySounds(entries, prompt, opts).nearest;
}

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
// no metallic ring" — the catalog prompts are full of them) never count.

import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { mediaKindOf } from '../../../shared/media-kinds';

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
  /** 0–1: the share of the prompt's (idf-weighted) words this entry covers. */
  coverage: number;
  /** Prompt words hit in a tag, the file name or the category. */
  strongHits: number;
}

/** Above this probed length an unlabelled clip is music, not an effect (the SFX generator's own maximum). */
const SFX_MAX_SECONDS = 30;
const MATCH_COVERAGE = 0.5;
const HEAD_MATCH_COVERAGE = 0.3;
/** Words after the head clause ("… with a short tail") describe the sound; they weigh half. */
const QUALIFIER_WEIGHT = 0.5;
const FIELD_WEIGHT = { tag: 1, name: 1, category: 0.9, description: 0.6 } as const;

const NEGATIONS = new Set(['no', 'not', 'non', 'without', 'never']);
/** Spellings of one sound that share no prefix ("swish" stays its own word — the catalog tags it apart). */
const SAME_SOUND: Readonly<Record<string, string>> = { swoosh: 'whoosh', woosh: 'whoosh', swooshes: 'whoosh' };
const CLAUSE_CUT = new Set([
  'for', 'with', 'at', 'like', 'into', 'on', 'in', 'of', 'to', 'from', 'that', 'which', 'as', 'over', 'under', 'between',
  'after', 'before', 'during', 'across', 'through',
]);
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'as', 'at', 'be', 'by', 'do', 'if', 'in', 'is', 'it', 'me', 'my', 'of', 'on',
  'to', 'up', 'us', 'we', 'for', 'with', 'into', 'onto', 'from', 'that', 'this', 'these', 'those', 'which', 'when', 'where',
  'then', 'than', 'very', 'some', 'any', 'its', 'our', 'your', 'their', 'was', 'were', 'are', 'has', 'have', 'had', 'will',
  'can', 'just', 'also', 'like', 'about', 'over', 'under', 'one', 'two', 'three', 'four', 'five', 'second', 'seconds', 'sec',
  'sound', 'sounds', 'sfx', 'effect', 'effects', 'audio', 'clip', 'clips', 'video', 'music', 'track', 'add', 'make', 'use',
  'place', 'need', 'want', 'please', 'give', 'get', 'put', 'first', 'next', 'last', 'cut', 'between', 'after', 'before',
  'during', 'across', 'through',
]);

interface Term {
  word: string;
  weight: number;
}

/** Split into clauses on punctuation; each clause a list of lower-case raw words. */
function clauses(text: string): string[][] {
  return text
    .toLowerCase()
    .split(/[,;.:!?()—–]+/)
    .map((c) => c.match(/[a-z0-9]+(?:[-'][a-z0-9]+)*/g) ?? []);
}

/** One raw word → its tokens: a hyphenated word yields its joined form and its long parts (not after a "no-"). */
function expand(raw: string): string[] {
  const bare = raw.split("'")[0];
  const word = SAME_SOUND[bare] ?? bare;
  if (!word.includes('-')) return word.length >= 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word) ? [word] : [];
  const parts = word.split('-');
  const joined = parts.join('');
  if (NEGATIONS.has(parts[0])) return [joined];
  return [joined, ...parts.filter((p) => p.length >= 3 && !STOP_WORDS.has(p))];
}

/** Each clause's content tokens, with the words a negation governs (to the clause end) removed. */
function clauseTokens(text: string): string[][] {
  return clauses(text).map((words) => {
    const out: string[] = [];
    let negated = false;
    for (const raw of words) {
      if (NEGATIONS.has(raw)) {
        negated = true;
        continue;
      }
      if (!negated) out.push(...expand(raw));
    }
    return out;
  });
}

/** The distinct content tokens of a text, in order (negated words dropped). */
export function soundTokens(text: string): string[] {
  return [...new Set(clauseTokens(text).flat())];
}

/** The head clause's raw words: the first clause, cut before a preposition once a content word was seen. */
function headClause(prompt: string): { head: string[]; rest: string } {
  const all = clauses(prompt);
  const at = all.findIndex((c) => c.some((w) => expand(w).length > 0));
  const first = at >= 0 ? all[at] : [];
  const head: string[] = [];
  for (const raw of first) {
    if (CLAUSE_CUT.has(raw) && head.some((w) => expand(w).length > 0)) break;
    head.push(raw);
  }
  // The remainder keeps its clause breaks (a negation stops at the next one).
  const rest = [first.slice(head.length).join(' '), ...all.slice(at + 1).map((c) => c.join(' '))].join(', ');
  return { head, rest };
}

/** The sound itself: the last content word of the prompt's first clause ("a soft cuckoo clock chime, …" → chime). */
export function headWord(prompt: string): string | undefined {
  const tokens = soundTokens(headClause(prompt).head.join(' '));
  return tokens.length > 0 ? tokens[tokens.length - 1] : undefined;
}

function promptTerms(prompt: string): Term[] {
  const { head, rest } = headClause(prompt);
  const weights = new Map<string, number>();
  for (const word of soundTokens(head.join(' '))) weights.set(word, 1);
  for (const word of soundTokens(rest)) if (!weights.has(word)) weights.set(word, QUALIFIER_WEIGHT);
  return [...weights].map(([word, weight]) => ({ word, weight }));
}

/** Equal, or one a short extension of the other: air/airy, whoosh/whooshes, tick/ticking. */
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 3 && long.length - short.length <= 3 && long.startsWith(short);
}

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

/** The library sounds that fit the prompt, best first (at most `limit`, default 3); [] = generate. */
export function matchLibrarySounds(entries: LibraryIndexEntry[], prompt: string, opts: SoundMatchOptions): SoundMatch[] {
  const terms = promptTerms(prompt);
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
  const head = headWord(prompt);

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
    if (coverage >= MATCH_COVERAGE || (headHit && coverage >= HEAD_MATCH_COVERAGE)) scored.push({ entry, coverage, strongHits });
  }
  scored.sort(
    (a, b) =>
      b.coverage - a.coverage ||
      b.strongHits - a.strongHits ||
      (b.entry.usedIn?.length ?? 0) - (a.entry.usedIn?.length ?? 0) ||
      a.entry.relPath.localeCompare(b.entry.relPath),
  );
  return scored.slice(0, opts.limit ?? 3);
}

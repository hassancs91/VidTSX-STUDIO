// The words of the sound matcher (E3): a text's content tokens, a prompt's weighted terms, head word and
// placement words, and how strongly two words are the same word. Pure. The word sets are in
// `sound-match-vocab.ts`.
//
// Same word (fix round 2, F2; round 3, F3a): equal, or the same stem under known English inflections only —
// plural / 3rd person -s, -es (after s x z ch sh), -ies → y; verb -ing, -ed; adjective -y; a doubled final
// consonant undoubled (popping → pop) and a silent e dropped (closes / closing / close). Not -er / -est / -ly.
// A plural and an adjective -y name the same sound at FULL strength (clicks = click, airy = air); a verb
// form matches at `STEM_STRENGTH` only — "running" / "shutting" / "moving" name an action more often than
// the clip tagged `run` / `shut` / `move`, so such a hit never ties or beats an equal hit (F3a). Two words
// that both have no inflection never match through the silent-e drop alone (hop ≠ hope, bit ≠ bite).

import {
  CLAUSE_CUT, COMPARATIVES, NEGATIONS, OPENER_FILLERS, OPENERS, PARTICLES, PLACEMENT, QUANTIFIERS, SAME_SOUND,
  STOP_WORDS,
} from './sound-match-vocab';

export interface Term {
  word: string;
  weight: number;
}

export interface PromptTerms {
  /** Sound words: the head clause weighs 1, words after it (qualifiers) weigh `QUALIFIER_WEIGHT`. */
  terms: Term[];
  /** Placement words ("… when the TRAP closes"): never in the coverage, only a small ranking bonus. */
  bonus: string[];
  /** The sound itself: the last content word of the head clause. */
  head: string | undefined;
}

/** Words after the head clause ("… with a short tail") describe the sound; they weigh half. */
export const QUALIFIER_WEIGHT = 0.5;
/** A verb-form stem hit ("running" on a `run` tag) against an equal hit's 1 — less than a description hit (0.6 × 1). */
export const STEM_STRENGTH = 0.6;

/** Split into clauses on punctuation; each clause a list of lower-case raw words. */
function clauses(text: string): string[][] {
  return text
    .toLowerCase()
    .split(/[,;.:!?()—–]+/)
    .map((c) => c.match(/[a-z0-9]+(?:[-'][a-z0-9]+)*/g) ?? []);
}

const canonical = (word: string): string => SAME_SOUND[word] ?? COMPARATIVES[word] ?? word;

/** One raw word → its tokens: a hyphenated word yields its joined form and its long parts (not after a "no-"). */
function expand(raw: string): string[] {
  const bare = raw.split("'")[0];
  const word = canonical(bare);
  if (!word.includes('-')) return word.length >= 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word) ? [word] : [];
  const parts = word.split('-');
  const joined = parts.join('');
  if (NEGATIONS.has(parts[0])) return [joined];
  return [joined, ...parts.filter((p) => p.length >= 3 && !STOP_WORDS.has(p))];
}

const hasContent = (words: string[]): boolean => words.some((w) => expand(w).length > 0);

/** The distinct content tokens of a text, in order — every word a negation governs (to the clause end) dropped. */
export function soundTokens(text: string): string[] {
  const out: string[] = [];
  for (const words of clauses(text)) {
    const negatedAt = words.findIndex((w) => NEGATIONS.has(w));
    for (const raw of negatedAt >= 0 ? words.slice(0, negatedAt) : words) out.push(...expand(raw));
  }
  return [...new Set(out)];
}

const VOWEL = /[aeiouy]/;

interface Stem {
  stem: string;
  /** The inflection stripped: none, a plural / -y (full strength), or a verb form (`STEM_STRENGTH`). */
  stripped: 'none' | 'full' | 'verb';
}
const stemCache = new Map<string, Stem>();

/** -s / -es / -ies off; the SAME_SOUND map applied (swooshes → whoosh). */
function singular(word: string): string {
  let s = word;
  if (s.length >= 5 && s.endsWith('ies')) s = `${s.slice(0, -3)}y`;
  else if (s.length >= 5 && /(?:s|x|z|ch|sh)es$/.test(s)) s = s.slice(0, -2);
  else if (s.length >= 4 && s.endsWith('s') && !/(?:ss|us|is)$/.test(s)) s = s.slice(0, -1);
  return SAME_SOUND[s] ?? s;
}

function stemOf(word: string): Stem {
  const cached = stemCache.get(word);
  if (cached !== undefined) return cached;
  let s = singular(word);
  let stripped: Stem['stripped'] = s === word ? 'none' : 'full';
  const m = /^(.+?)(ing|ed|y)$/.exec(s);
  // Not "speed" → "spe" (-ed after e) nor "play" → "pla" (-y after a vowel); ll ss zz ff stay doubled.
  if (m && m[1].length >= 3 && VOWEL.test(m[1]) && !(m[2] === 'ed' && m[1].endsWith('e')) && !(m[2] === 'y' && /[aeiou]$/.test(m[1]))) {
    s = /([bcdgkmnprtv])\1$/.test(m[1]) ? m[1].slice(0, -1) : m[1];
    stripped = m[2] === 'y' ? 'full' : 'verb';
  }
  if (s.length >= 4 && s.endsWith('e')) s = s.slice(0, -1);
  const out: Stem = { stem: SAME_SOUND[s] ?? s, stripped };
  stemCache.set(word, out);
  return out;
}

/** A word's stem under the known inflections above (a stem keeps ≥ 3 letters and a vowel). */
export function wordStem(word: string): string {
  return stemOf(word).stem;
}

/**
 * How strongly two words are the same word: 1 (equal; a plural or -y form — whooshes / airy), `STEM_STRENGTH`
 * (a verb form — ticking / popped), 0 (different: rung / run, sparkle / spark, hop / hope).
 */
export function matchStrength(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 3 || b.length < 3) return 0;
  const sa = stemOf(a);
  const sb = stemOf(b);
  if (sa.stem !== sb.stem || (sa.stripped === 'none' && sb.stripped === 'none')) return 0;
  return sa.stripped === 'verb' || sb.stripped === 'verb' ? STEM_STRENGTH : 1;
}

/** Equal, or the same stem: air/airy, whoosh/whooshes, tick/ticking, pop/popping — never rung/run, sparkle/spark. */
export function wordsMatch(a: string, b: string): boolean {
  return matchStrength(a, b) > 0;
}

/** A placement starts here: a conjunction, or a multi-word opener ("every time", "the moment", "the exact moment"). */
function startsPlacement(words: string[], i: number): boolean {
  const w = words[i];
  if (PLACEMENT.has(w)) return !(w === 'as' && (words[i + 1] === 'a' || words[i + 1] === 'an'));
  const completions = OPENERS[w];
  if (!completions) return false;
  const next = words[i + 1];
  if (next !== undefined && completions.includes(next)) return true;
  return next !== undefined && OPENER_FILLERS.has(next) && words[i + 2] !== undefined && completions.includes(words[i + 2]);
}

/** The head words (up to a preposition once a content word was seen; restarted after "a bit OF") and the rest. */
function cutHead(words: string[]): { head: string[]; tail: string[] } {
  let head: string[] = [];
  let taken = 0;
  for (const raw of words) {
    if (raw === 'of' && head.length > 0 && QUANTIFIERS.has(head[head.length - 1])) {
      head = [];
      taken += 1;
      continue;
    }
    if (CLAUSE_CUT.has(raw) && hasContent(head)) break;
    head.push(raw);
    taken += 1;
  }
  return { head, tail: words.slice(taken) };
}

/**
 * Where the sound starts in a clause that OPENS with a placement clause and has no comma ("when the logo lands
 * a deep impact hit"): at the last "a" / "an" after the conjunction, else at the last content word.
 */
function soundStart(words: string[]): number {
  const p = words.findIndex((_, i) => startsPlacement(words, i));
  for (let k = words.length - 1; k > p; k -= 1) {
    if ((words[k] === 'a' || words[k] === 'an') && hasContent(words.slice(k))) return k;
  }
  for (let k = words.length - 1; k >= 0; k -= 1) if (hasContent([words[k]])) return k;
  return words.length;
}

/** A prompt's sound words (weighted), its placement words (bonus only) and its head word. */
export function promptTerms(prompt: string): PromptTerms {
  const all = clauses(prompt);
  const split = all.map((words) => {
    const at = words.findIndex((_, i) => startsPlacement(words, i));
    return at >= 0 ? { sound: words.slice(0, at), placement: words.slice(at) } : { sound: words, placement: [] };
  });
  const at = split.findIndex((c) => hasContent(c.sound));
  let head: string[];
  let qualifiers: string[];
  let placement: string[];
  if (at >= 0) {
    const cut = cutHead(split[at].sound);
    head = cut.head;
    qualifiers = [cut.tail.join(' '), ...split.slice(at + 1).map((c) => c.sound.join(' '))];
    placement = split.map((c) => c.placement.join(' '));
  } else {
    // Every clause opens with a placement: the sound starts at its last "a" / "an"; the words before it are
    // placement (bonus only, as with a comma — fix round 3), the rest of that clause qualifiers.
    const i = all.findIndex(hasContent);
    if (i < 0) return { terms: [], bonus: [], head: undefined };
    const k = soundStart(all[i]);
    const cut = cutHead(all[i].slice(k));
    head = cut.head;
    qualifiers = [cut.tail.join(' '), ...all.filter((_, j) => j !== i).map((c) => c.join(' '))];
    placement = [all[i].slice(0, k).join(' ')];
  }
  const weights = new Map<string, number>();
  const headTokens = soundTokens(head.join(' '));
  for (const word of headTokens) weights.set(word, 1);
  // Clause breaks kept (a negation stops at the next one).
  for (const word of soundTokens(qualifiers.join(', '))) if (!weights.has(word)) weights.set(word, QUALIFIER_WEIGHT);
  return {
    terms: [...weights].map(([word, weight]) => ({ word, weight })),
    bonus: soundTokens(placement.join(', ')).filter((w) => !weights.has(w) && !PARTICLES.has(w)),
    head: headTokens.length > 0 ? headTokens[headTokens.length - 1] : undefined,
  };
}

/** The sound itself: the last content word of the prompt's head clause ("a soft cuckoo clock chime, …" → chime). */
export function headWord(prompt: string): string | undefined {
  return promptTerms(prompt).head;
}

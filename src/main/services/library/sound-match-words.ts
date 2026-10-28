// The words of the sound matcher (E3): a text's content tokens, a prompt's weighted terms, head word and
// placement words, and when two words are the same word. Pure.
//
// Same word = equal, or the same stem under known English inflections only (fix round 2, F2 — the old "one is
// a prefix of the other, ≤ 3 letters longer" rule matched `rung` to `run` and `sparkle` to `spark`). The
// endings: plural / 3rd person -s, -es (after s x z ch sh), -ies → y; verb -ing, -ed; adjective -y; then a
// doubled final consonant is undoubled (popping → pop) and a silent e dropped (closes / closing / close).
// Not -er / -est / -ly: they make other words (riser ≠ rise, timer ≠ time, shutter ≠ shut).

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

const NEGATIONS = new Set(['no', 'not', 'non', 'without', 'never']);
/** Spellings of one sound that share no stem ("swish" stays its own word — the catalog tags it apart). */
const SAME_SOUND: Readonly<Record<string, string>> = { swoosh: 'whoosh', woosh: 'whoosh', swooshes: 'whoosh' };
const CLAUSE_CUT = new Set([
  'for', 'with', 'at', 'like', 'into', 'on', 'in', 'of', 'to', 'from', 'that', 'which', 'as', 'over', 'under', 'between',
  'after', 'before', 'during', 'across', 'through',
]);
/**
 * A prompt's subordinating conjunctions: from one of these to the clause end the words say WHEN the sound plays
 * ("when the slide changes", "until the reveal", "as soon as …") — placement words, not the sound (F1). "as" is
 * one unless "a" / "an" follows ("as a transition" names the sound's role — a qualifier through the cut above).
 */
const PLACEMENT = new Set([
  'when', 'whenever', 'while', 'whilst', 'until', 'till', 'once', 'if', 'unless', 'because', 'where', 'wherever', 'as',
]);
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'as', 'at', 'be', 'by', 'do', 'if', 'in', 'is', 'it', 'me', 'my', 'of', 'on',
  'to', 'up', 'us', 'we', 'for', 'with', 'into', 'onto', 'from', 'that', 'this', 'these', 'those', 'which', 'when', 'where',
  'then', 'than', 'very', 'some', 'any', 'its', 'our', 'your', 'their', 'was', 'were', 'are', 'has', 'have', 'had', 'will',
  'can', 'just', 'also', 'like', 'about', 'over', 'under', 'one', 'two', 'three', 'four', 'five', 'second', 'seconds', 'sec',
  'sound', 'sounds', 'sfx', 'effect', 'effects', 'audio', 'clip', 'clips', 'video', 'music', 'track', 'add', 'make', 'use',
  'place', 'need', 'want', 'please', 'give', 'get', 'put', 'first', 'next', 'last', 'cut', 'between', 'after', 'before',
  'during', 'across', 'through', 'whenever', 'while', 'whilst', 'until', 'till', 'once', 'unless', 'because', 'wherever',
]);
/** Particles name no sound: "the title slides OUT" must not lift whoosh-wind through its `drawn-out` tag. Bonus only. */
const PARTICLES = new Set(['out', 'off', 'down', 'away', 'back', 'around', 'along', 'past']);

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
const stemCache = new Map<string, string>();

/** A word's stem under the known inflections above (a stem keeps ≥ 3 letters and a vowel). */
export function wordStem(word: string): string {
  const cached = stemCache.get(word);
  if (cached !== undefined) return cached;
  let s = word;
  if (s.length >= 5 && s.endsWith('ies')) s = `${s.slice(0, -3)}y`;
  else if (s.length >= 5 && /(?:s|x|z|ch|sh)es$/.test(s)) s = s.slice(0, -2);
  else if (s.length >= 4 && s.endsWith('s') && !/(?:ss|us|is)$/.test(s)) s = s.slice(0, -1);
  const m = /^(.+?)(ing|ed|y)$/.exec(s);
  // Not "speed" → "spe" (-ed after e) nor "play" → "pla" (-y after a vowel); ll ss zz ff stay doubled.
  if (m && m[1].length >= 3 && VOWEL.test(m[1]) && !(m[2] === 'ed' && m[1].endsWith('e')) && !(m[2] === 'y' && /[aeiou]$/.test(m[1]))) {
    s = /([bcdgkmnprtv])\1$/.test(m[1]) ? m[1].slice(0, -1) : m[1];
  }
  if (s.length >= 4 && s.endsWith('e')) s = s.slice(0, -1);
  stemCache.set(word, s);
  return s;
}

/** Equal, or the same stem: air/airy, whoosh/whooshes, tick/ticking, pop/popping — never rung/run, sparkle/spark. */
export function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 3 && b.length >= 3 && wordStem(a) === wordStem(b);
}

function startsPlacement(words: string[], i: number): boolean {
  return PLACEMENT.has(words[i]) && !(words[i] === 'as' && (words[i + 1] === 'a' || words[i + 1] === 'an'));
}

/** The head words (up to a preposition once a content word was seen) and the rest of a phrase. */
function cutHead(words: string[]): { head: string[]; tail: string[] } {
  const head: string[] = [];
  for (const raw of words) {
    if (CLAUSE_CUT.has(raw) && hasContent(head)) break;
    head.push(raw);
  }
  return { head, tail: words.slice(head.length) };
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
  let placement: string[] = [];
  if (at >= 0) {
    const cut = cutHead(split[at].sound);
    head = cut.head;
    qualifiers = [cut.tail.join(' '), ...split.slice(at + 1).map((c) => c.sound.join(' '))];
    placement = split.map((c) => c.placement.join(' '));
  } else {
    // Every clause is placement: the uncut words, the placement words as half-weight qualifiers (as before F1).
    const i = all.findIndex(hasContent);
    if (i < 0) return { terms: [], bonus: [], head: undefined };
    const k = soundStart(all[i]);
    const cut = cutHead(all[i].slice(k));
    head = cut.head;
    qualifiers = [all[i].slice(0, k).join(' '), cut.tail.join(' '), ...all.filter((_, j) => j !== i).map((c) => c.join(' '))];
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

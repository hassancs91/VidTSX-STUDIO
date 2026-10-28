// The sound matcher's vocabulary (E3, fix round 3): the word sets `sound-match-words.ts` reads. Pure data.
//
// A prompt says three things — the sound ("a soft whoosh"), how it should sound ("with a short tail")
// and WHEN it plays ("every time the slide changes", "right at the first cut"). Only the first two name
// the clip; the placement words are a ranking bonus at most (F1). The sets below draw those lines.

export const NEGATIONS = new Set(['no', 'not', 'non', 'without', 'never']);

/** Spellings of one sound that share no stem ("swish" stays its own word — the catalog tags `ui-send` with it). */
export const SAME_SOUND: Readonly<Record<string, string>> = { swoosh: 'whoosh', woosh: 'whoosh', swooshes: 'whoosh' };

/**
 * Comparatives of the qualifiers the catalog uses ("a softer whoosh", "a deeper impact"): an explicit list,
 * never an -er rule (riser ≠ rise, timer ≠ time, shutter ≠ shut, popper ≠ pop).
 */
export const COMPARATIVES: Readonly<Record<string, string>> = {
  softer: 'soft', deeper: 'deep', louder: 'loud', quieter: 'quiet', quicker: 'quick', faster: 'fast', slower: 'slow',
  longer: 'long', shorter: 'short', lower: 'low', higher: 'high', harder: 'hard', warmer: 'warm', brighter: 'bright',
  darker: 'dark', bigger: 'big', smaller: 'small', lighter: 'light', heavier: 'heavy', gentler: 'gentle', calmer: 'calm',
};

/** Prepositions and relatives that end the head clause once it holds a content word ("a whoosh FOR a cut"). */
export const CLAUSE_CUT = new Set([
  'for', 'with', 'at', 'like', 'into', 'on', 'in', 'of', 'to', 'from', 'that', 'which', 'as', 'over', 'under', 'between',
  'after', 'before', 'during', 'across', 'through',
]);

/**
 * A prompt's subordinating conjunctions: from one of these to the clause end the words say WHEN the sound plays
 * ("when the slide changes", "until the reveal", "as soon as …") — placement words, not the sound (F1). "as" is
 * one unless "a" / "an" follows ("as a transition" names the sound's role — a qualifier through the cut above).
 */
export const PLACEMENT = new Set([
  'when', 'whenever', 'while', 'whilst', 'until', 'till', 'once', 'if', 'unless', 'because', 'where', 'wherever', 'as',
  'anytime',
]);

/**
 * Multi-word placement openers (fix round 3, F3b): the first word → the words that complete it. "every time the
 * slide changes", "the moment the logo lands", "the instant / the second / the minute …". One filler adjective may
 * sit inside ("the exact moment", "the very instant").
 */
export const OPENERS: Readonly<Record<string, readonly string[]>> = {
  every: ['time'],
  each: ['time'],
  any: ['time'],
  the: ['moment', 'instant', 'second', 'minute'],
};
export const OPENER_FILLERS = new Set(['exact', 'very', 'precise', 'same', 'first', 'next', 'last']);

/**
 * "a bit OF static", "a kind OF whoosh", "a piece OF glass breaking": the phrase before "of" is a quantity or a
 * class, not the sound — the head clause restarts after "of" (fix round 3).
 */
export const QUANTIFIERS = new Set([
  'bit', 'kind', 'sort', 'type', 'lot', 'lots', 'touch', 'hint', 'piece', 'pieces', 'couple', 'few', 'pair', 'bunch',
  'burst', 'series', 'amount',
]);

/** Particles name no sound: "the title slides OUT" must not lift whoosh-wind through its `drawn-out` tag. Bonus only. */
export const PARTICLES = new Set(['out', 'off', 'down', 'away', 'back', 'around', 'along', 'past']);

/**
 * Words that never name a sound. Fix round 3 added the adverbs that lead into a placement or a preposition
 * ("RIGHT when", "EXACTLY at", "SHORTLY after", "ONLY when", "IMMEDIATELY after"), the trailing words of an ask
 * ("a whoosh HERE / NOW / AGAIN / TOO"), the wrappers around it ("COULD YOU add", "MAYBE a", "SOMETHING like a",
 * "would be NICE"), the quantifier determiners ("EVERY cut", "EACH slide", "ANOTHER whoosh") and the generic nouns
 * ("THINGS crashing", "SOMEONE running"). "exactly" also stops hitting the "Exactly ONE pop" catalog descriptions.
 */
export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'as', 'at', 'be', 'by', 'do', 'if', 'in', 'is', 'it', 'me', 'my', 'of', 'on',
  'to', 'up', 'us', 'we', 'for', 'with', 'into', 'onto', 'from', 'that', 'this', 'these', 'those', 'which', 'when', 'where',
  'then', 'than', 'very', 'some', 'any', 'its', 'our', 'your', 'their', 'was', 'were', 'are', 'has', 'have', 'had', 'will',
  'can', 'just', 'also', 'like', 'about', 'over', 'under', 'one', 'two', 'three', 'four', 'five', 'second', 'seconds', 'sec',
  'sound', 'sounds', 'sfx', 'effect', 'effects', 'audio', 'clip', 'clips', 'video', 'music', 'track', 'add', 'make', 'use',
  'place', 'need', 'want', 'please', 'give', 'get', 'put', 'first', 'next', 'last', 'cut', 'between', 'after', 'before',
  'during', 'across', 'through', 'whenever', 'while', 'whilst', 'until', 'till', 'once', 'unless', 'because', 'wherever',
  'anytime', 'being',
  // the nouns of the placement openers above (placement syntax, never a sound; "timer" is another word)
  'time', 'moment', 'instant', 'minute', 'exact', 'precise',
  // fix round 3 — adverbs before a placement / preposition
  'right', 'exactly', 'precisely', 'only', 'even', 'shortly', 'immediately', 'soon', 'straight', 'directly', 'really', 'quite',
  // trailing words of an ask
  'here', 'there', 'now', 'later', 'again', 'too', 'anymore', 'instead',
  // wrappers around an ask
  'could', 'would', 'should', 'you', 'maybe', 'probably', 'perhaps', 'something', 'anything', 'someone', 'somebody',
  'anyone', 'thing', 'things', 'stuff', 'nice', 'good', 'great', 'fine', 'cool', 'ok', 'okay', 'thanks', 'thank',
  // quantifier determiners
  'same', 'another', 'other', 'more', 'every', 'each', 'all', 'both', 'several', 'many', 'multiple', 'few',
]);

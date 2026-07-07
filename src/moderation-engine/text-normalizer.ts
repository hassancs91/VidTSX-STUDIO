/**
 * Text normalization for moderation matching.
 *
 * Returns multiple normalized variants of the input so each can be checked
 * independently against the word list. Using separate variants (instead of
 * one aggressively-normalized form) keeps false-positive rates low.
 */

/** Leet-speak / common character substitution map */
const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '3': 'e',
  '$': 's',
  '5': 's',
  '7': 't',
  '8': 'b',
  '+': 't',
};

/** Zero-width and invisible Unicode characters to strip */
const INVISIBLE_RE = /[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u180E]/g;

/**
 * Decode leet-speak substitutions in a lowercased string.
 */
function leetDecode(text: string): string {
  let result = '';
  for (const ch of text) {
    result += LEET_MAP[ch] ?? ch;
  }
  return result;
}

/**
 * Remove non-alphanumeric separators inserted between letters.
 * Catches patterns like "n.u.d.e", "n_u_d_e", "n-u-d-e".
 * Only removes a separator when it sits between two word characters.
 */
function removeSeparators(text: string): string {
  return text.replace(/(\w)[.\-_*~|/\\]+(\w)/g, '$1$2');
}

/**
 * Collapse runs of identical consecutive characters to a single character.
 * Catches "nuuuude" → "nude", "sexxxy" → "sexy".
 */
function collapseRepeats(text: string): string {
  return text.replace(/(.)\1{2,}/g, '$1');
}

/**
 * Strip combining diacritical marks from Latin scripts.
 * Catches "nüde" → "nude", "pörn" → "porn".
 */
function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Strip Arabic tashkeel (diacritical marks) for base-form matching.
 * Removes fathah, dammah, kasrah, sukun, shadda, tanwin, etc.
 */
function stripArabicDiacritics(text: string): string {
  return text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '');
}

/**
 * Produce multiple normalized variants of the input text.
 *
 * Each variant targets a specific evasion technique. The moderation engine
 * checks every variant against the word list so that a match in *any*
 * variant triggers flagging.
 */
export function normalizeForModeration(text: string): string[] {
  // Pre-processing: strip invisible chars, then lowercase
  const cleaned = text.replace(INVISIBLE_RE, '');
  const lower = cleaned.toLowerCase();

  const variants = new Set<string>();
  variants.add(lower);
  variants.add(leetDecode(lower));
  variants.add(removeSeparators(lower));
  variants.add(collapseRepeats(lower));
  variants.add(stripDiacritics(lower));
  variants.add(stripArabicDiacritics(lower));

  // Combined: leet decode + separator removal (catches "n.u.d.3")
  variants.add(removeSeparators(leetDecode(lower)));

  return [...variants];
}

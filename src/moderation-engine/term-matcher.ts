import type { ModerationMatch, ModerationTerm } from './types';
import { normalizeForModeration } from './text-normalizer';

/** Regex character class for word-boundary detection */
const BOUNDARY_RE = /[\s,.\-!?;:'"()[\]{}/\\@#%^&*+=<>~`|]/;

/**
 * Scripts written without spaces between words (Han, Hiragana/Katakana,
 * Thai). A neighbor from these scripts counts as a word boundary — otherwise
 * a CJK/Thai term embedded in a sentence could never match. Hangul is NOT
 * here: Korean is space-delimited, and treating syllables as boundaries
 * would match terms inside unrelated words.
 */
const NO_SPACE_SCRIPT_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿฀-๿]/;

function isBoundary(ch: string): boolean {
  return BOUNDARY_RE.test(ch) || NO_SPACE_SCRIPT_RE.test(ch);
}

/**
 * Word-boundary-aware substring check.
 *
 * Prevents false positives like "assess" matching "ass" or
 * "therapist" matching embedded substrings by verifying that
 * the character before and after the match is a word boundary.
 */
function containsTerm(text: string, term: string): boolean {
  let startIdx = 0;

  while (startIdx <= text.length - term.length) {
    const idx = text.indexOf(term, startIdx);
    if (idx === -1) return false;

    const charBefore = idx > 0 ? text[idx - 1] : undefined;
    const charAfter = idx + term.length < text.length ? text[idx + term.length] : undefined;

    const boundaryBefore = charBefore === undefined || isBoundary(charBefore);
    const boundaryAfter = charAfter === undefined || isBoundary(charAfter);

    if (boundaryBefore && boundaryAfter) {
      return true;
    }

    // Move past this occurrence and keep searching
    startIdx = idx + 1;
  }

  return false;
}

/**
 * Match a term list against every normalized variant of the input text.
 * Shared by the full moderation engine and the generation prompt gate.
 */
export function findTermMatches(terms: ModerationTerm[], text: string): ModerationMatch[] {
  if (!text || text.trim().length === 0) return [];

  const variants = normalizeForModeration(text);
  const matches: ModerationMatch[] = [];
  const seenTerms = new Set<string>();

  for (const term of terms) {
    // Skip if we already matched this exact term string
    if (seenTerms.has(term.term)) continue;

    const termLower = term.term.toLowerCase();

    for (const variant of variants) {
      if (containsTerm(variant, termLower)) {
        seenTerms.add(term.term);
        matches.push({
          term: term.term,
          category: term.category,
          language: term.language,
          severity: term.severity,
        });
        break; // Found in one variant, skip remaining variants
      }
    }
  }

  return matches;
}

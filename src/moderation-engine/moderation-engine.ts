import type { ModerationResult, ModerationMatch, ModerationTerm, ModerationCategory } from './types';
import { MODERATION_TERMS } from './word-lists';
import { normalizeForModeration } from './text-normalizer';

/** Regex character class for word-boundary detection */
const BOUNDARY_RE = /[\s,.\-!?;:'"()[\]{}/\\@#%^&*+=<>~`|]/;

class ModerationEngine {
  private terms: ModerationTerm[] = [];
  private initialized = false;

  /**
   * Initialize the engine. Safe to call multiple times.
   * Automatically called on first check().
   */
  initialize(): void {
    if (this.initialized) return;
    this.terms = MODERATION_TERMS;
    this.initialized = true;
  }

  /**
   * Check text for prohibited content.
   *
   * Synchronous — pure string matching, no I/O.
   * Auto-initializes on first call.
   *
   * @param text - The text to check (prompt, message, etc.)
   * @returns ModerationResult with flagged status and match details
   */
  check(text: string): ModerationResult {
    if (!this.initialized) {
      this.initialize();
    }

    if (!text || text.trim().length === 0) {
      return { flagged: false, matches: [], categories: [] };
    }

    const variants = normalizeForModeration(text);
    const matches: ModerationMatch[] = [];
    const seenTerms = new Set<string>();

    for (const term of this.terms) {
      // Skip if we already matched this exact term string
      if (seenTerms.has(term.term)) continue;

      const termLower = term.term.toLowerCase();

      for (const variant of variants) {
        if (this.containsTerm(variant, termLower)) {
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

    const categories: ModerationCategory[] = [...new Set(matches.map((m) => m.category))];

    return {
      flagged: matches.length > 0,
      matches,
      categories,
    };
  }

  /**
   * Word-boundary-aware substring check.
   *
   * Prevents false positives like "assess" matching "ass" or
   * "therapist" matching embedded substrings by verifying that
   * the character before and after the match is a word boundary.
   */
  private containsTerm(text: string, term: string): boolean {
    let startIdx = 0;

    while (startIdx <= text.length - term.length) {
      const idx = text.indexOf(term, startIdx);
      if (idx === -1) return false;

      const charBefore = idx > 0 ? text[idx - 1] : undefined;
      const charAfter = idx + term.length < text.length ? text[idx + term.length] : undefined;

      const boundaryBefore = charBefore === undefined || BOUNDARY_RE.test(charBefore);
      const boundaryAfter = charAfter === undefined || BOUNDARY_RE.test(charAfter);

      if (boundaryBefore && boundaryAfter) {
        return true;
      }

      // Move past this occurrence and keep searching
      startIdx = idx + 1;
    }

    return false;
  }

  /** Number of terms loaded (for diagnostics) */
  getTermCount(): number {
    if (!this.initialized) this.initialize();
    return this.terms.length;
  }

  /** List of unique language codes in the word list */
  getSupportedLanguages(): string[] {
    if (!this.initialized) this.initialize();
    return [...new Set(this.terms.map((t) => t.language))];
  }
}

export const moderationEngine = new ModerationEngine();

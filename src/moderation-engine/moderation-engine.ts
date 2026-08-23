import type { ModerationResult, ModerationCategory, ModerationTerm } from './types';
import { MODERATION_TERMS } from './word-lists';
import { findTermMatches } from './term-matcher';

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

    const matches = findTermMatches(this.terms, text);
    const categories: ModerationCategory[] = [...new Set(matches.map((m) => m.category))];

    return {
      flagged: matches.length > 0,
      matches,
      categories,
    };
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

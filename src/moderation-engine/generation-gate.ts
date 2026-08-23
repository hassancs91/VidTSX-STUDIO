import type { ModerationMatch } from './types';
import { GENERATION_BLOCKLIST, type GenerationBlockCategory } from './generation-blocklist';
import { findTermMatches } from './term-matcher';

/** Result of checking a visual-generation prompt against the curated blocklist. */
export interface GenerationPromptCheck {
  blocked: boolean;
  /** Highest-priority category among the matches (sexual > pornography > nudity). */
  category?: GenerationBlockCategory;
  matches: ModerationMatch[];
}

const CATEGORY_PRIORITY: GenerationBlockCategory[] = ['sexual', 'pornography', 'nudity'];

/**
 * Gate A — the cheap prompt-side first layer of Content Safety.
 *
 * Checks ONLY against the curated generation blocklist (sexual / nudity /
 * pornography intent). Profanity alone never blocks — this function never
 * sees profanity terms because the blocklist doesn't contain them. Applied
 * exclusively to visual-generation prompt fields; never to chat,
 * transcripts, TSX briefs, or captions (D3/D4 in
 * docs/CONTENT_SAFETY_DESIGN.md).
 */
export function checkGenerationPrompt(text: string): GenerationPromptCheck {
  const matches = findTermMatches(GENERATION_BLOCKLIST, text);
  if (matches.length === 0) {
    return { blocked: false, matches };
  }

  const matched = new Set(matches.map((m) => m.category));
  const category =
    CATEGORY_PRIORITY.find((c) => matched.has(c)) ?? (matches[0].category as GenerationBlockCategory);

  return { blocked: true, category, matches };
}

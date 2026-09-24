import type { ModerationMatch } from './types';
import {
  GENERATION_BLOCKLIST,
  MINORS_ADDITIONS,
  type GenerationBlockCategory,
} from './generation-blocklist';
import { findTermMatches } from './term-matcher';
import { isContentSafetyBypassed } from '../content-safety-engine/dev-bypass';

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
 *
 * Under the dev bypass (dev builds only — see dev-bypass.ts) the curated list
 * is skipped, but the sexualized-minor terms still block.
 */
export function checkGenerationPrompt(text: string): GenerationPromptCheck {
  const terms = isContentSafetyBypassed() ? MINORS_ADDITIONS : GENERATION_BLOCKLIST;
  const matches = findTermMatches(terms, text);
  if (matches.length === 0) {
    return { blocked: false, matches };
  }

  const matched = new Set(matches.map((m) => m.category));
  const category =
    CATEGORY_PRIORITY.find((c) => matched.has(c)) ?? (matches[0].category as GenerationBlockCategory);

  return { blocked: true, category, matches };
}

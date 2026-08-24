/**
 * Content Safety threshold bands (CONTENT_SAFETY_DESIGN.md D2b).
 *
 * Recall-greedy on purpose: a false positive on a GENERATED image costs one
 * re-roll, so the borderline band blocks by default. Constants, not settings —
 * tuned on the NF12 eval set, frozen with the recorded numbers.
 */

/** p(NSFW) at or above this → hard block ("explicit"). */
export const NSFW_HARD_BLOCK_THRESHOLD = 0.8;

/** p(NSFW) at or above this (and below the hard block) → borderline → block. */
export const NSFW_BORDERLINE_THRESHOLD = 0.2;

export type SafetyBand = 'pass' | 'borderline' | 'explicit';

export function classifyBand(nsfwProbability: number): SafetyBand {
  if (nsfwProbability >= NSFW_HARD_BLOCK_THRESHOLD) return 'explicit';
  if (nsfwProbability >= NSFW_BORDERLINE_THRESHOLD) return 'borderline';
  return 'pass';
}

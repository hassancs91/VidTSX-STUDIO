// D7 word bake: transcript words (source-media seconds) → shot-local seconds
// rendered into the generation prompt as a constants block. The shot stays a
// closed, self-contained composition; the anchor recorded on the shot is what
// makes the sync reconstructible (regenerate re-reads and re-bakes).

/** Structural transcript word — matches SttWord without importing engine types. */
export interface ShotAnchorWord {
  text: string;
  start: number;
  end: number;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Words of the anchor span, re-based to shot-local seconds. A word belongs to
 * the span when it STARTS inside it (the convention cut spans use); ends are
 * clamped to the span so the last word never runs past the shot.
 */
export function sliceAnchorWords(
  words: ShotAnchorWord[],
  sourceStart: number,
  sourceEnd: number,
): ShotAnchorWord[] {
  const eps = 1e-6;
  return words
    .filter((w) => w.start >= sourceStart - eps && w.start < sourceEnd - eps)
    .map((w) => ({
      text: w.text,
      start: round3(Math.max(0, w.start - sourceStart)),
      end: round3(Math.max(0, Math.min(w.end, sourceEnd) - sourceStart)),
    }));
}

/**
 * The marked WORDS block baked into the prompt (and expected back in the
 * generated TSX, per the studio-make-tsx skill). Times are shot-local seconds.
 */
export function formatWordsBlock(words: ShotAnchorWord[]): string {
  const lines = words.map(
    (w) => `  { text: ${JSON.stringify(w.text)}, start: ${w.start}, end: ${w.end} },`,
  );
  return ['// WORDS — shot-local seconds, baked from the anchor span', 'const WORDS = [', ...lines, '] as const;'].join('\n');
}

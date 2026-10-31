/**
 * A signed level (LUFS / dB) with a typographic minus (U+2212), one decimal by
 * default — the ONE form the generate_sfx / generate_music answers and the
 * `list_assets(scope:'library')` rows print (E2).
 */
export function signed(n: number, digits = 1): string {
  return n.toFixed(digits).replace(/^-/, '−');
}

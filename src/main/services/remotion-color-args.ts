/**
 * Remotion's `colorSpace: 'bt709'` converts the screenshots to limited-range
 * BT.709 (`zscale=matrix=709:matrixin=709:range=limited`) and tags the
 * matrix + range, but its `-color_primaries` / `-color_trc` flags are
 * overridden by the filter output, so the file leaves primaries and transfer
 * "unknown" (measured 2026-09-05 with the bundled ffmpeg). The Studio export
 * engines' colour policy needs all five tags, so the pre-stitcher's zscale
 * gets primaries/transfer set on the filter itself — encoder-agnostic, and a
 * pure tag on the same pixels (sRGB screenshots already have BT.709 primaries;
 * transfer in = transfer out, so nothing is re-mapped).
 */
export const BT709_ZSCALE_EXTRA = ':primaries=709:primariesin=709:transfer=709:transferin=709';

/** Pure: rewrite one ffmpeg arg list so its zscale filter also tags primaries/transfer. */
export function withBt709FilterTags(args: readonly string[]): string[] {
  const out = [...args];
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i] === '-vf' && out[i + 1].startsWith('zscale=') && !out[i + 1].includes('primaries=')) {
      out[i + 1] = `${out[i + 1]}${BT709_ZSCALE_EXTRA}`;
    }
  }
  return out;
}

import { describe, expect, it } from 'vitest';
import { BT709_ZSCALE_EXTRA, withBt709FilterTags } from './remotion-color-args';

describe('withBt709FilterTags', () => {
  const remotion = ['-c:v', 'libx264', '-colorspace:v', 'bt709', '-color_range', 'tv', '-vf', 'zscale=matrix=709:matrixin=709:range=limited', '-pix_fmt', 'yuv420p'];

  it("extends Remotion's zscale filter with primaries and transfer", () => {
    const out = withBt709FilterTags(remotion);
    expect(out[7]).toBe(`zscale=matrix=709:matrixin=709:range=limited${BT709_ZSCALE_EXTRA}`);
    expect(out.filter((_, i) => i !== 7)).toEqual(remotion.filter((_, i) => i !== 7));
  });

  it('is idempotent and leaves other filter graphs alone', () => {
    expect(withBt709FilterTags(withBt709FilterTags(remotion))).toEqual(withBt709FilterTags(remotion));
    const stitch = ['-i', 'pre.mkv', '-c:v', 'copy', '-colorspace:v', 'bt709'];
    expect(withBt709FilterTags(stitch)).toEqual(stitch);
    const other = ['-vf', 'scale=1280:-2'];
    expect(withBt709FilterTags(other)).toEqual(other);
  });
});

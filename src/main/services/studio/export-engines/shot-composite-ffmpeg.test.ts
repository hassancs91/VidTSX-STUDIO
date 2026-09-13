// The composite span's ffmpeg arguments (docs/export-engines-plan.md "Engine 3"):
// the copied span's own select on the base, the layer's lead-in dropped, the
// straight-alpha RGB overlay, Remotion's zscale to limited BT.709, the copied
// spans' encoder line — pinned as strings, like `passthrough-ffmpeg.test.ts`.
import { describe, expect, it } from 'vitest';
import { EXPORT_COLOR } from './types';
import { compositeSpanArgs, compositeBaseGraph, REMOTION_BT709_ZSCALE, type CompositeSpanArgs } from './shot-composite-ffmpeg';
import { copySpanArgs, nearestSelectFilter } from './passthrough-ffmpeg';

const DJI = 'C:/raw/DJI_0270.MP4';
const base = {
  kind: 'source' as const, sourcePath: DJI, sourcePixelFormat: 'yuv420p10le',
  sourceFrame: 300, fps: 30, sourceFrameRate: { num: 60000, den: 1001 }, firstFrameCeil: false,
};
const args = (extra: Partial<CompositeSpanArgs> = {}): CompositeSpanArgs => ({
  encoder: 'nvenc', base, layerPath: 'C:/tmp/layer-0001.mov', leadIn: 1, frames: 60, fps: 30, width: 1920, height: 1080, color: EXPORT_COLOR, outputPath: 'C:/tmp/span-0001.ts', ...extra,
});

describe('compositeBaseGraph', () => {
  it("uses the copied span's exact select and the NVIDIA scale, then downloads and converts to RGB by the policy", () => {
    const graph = compositeBaseGraph(args());
    expect(graph).toBe(`[0:v]${nearestSelectFilter(base)},scale_cuda=w=1920:h=1080:format=yuv420p,hwdownload,format=yuv420p,setpts=N/(30*TB),scale=in_color_matrix=bt709:in_range=tv,format=rgb24[bg]`);
    // The same select string the copied span would have used (T1 condition 1).
    const copy = copySpanArgs({ ...base, encoder: 'nvenc', frames: 60, width: 1920, height: 1080, color: EXPORT_COLOR, outputPath: 'x.ts' });
    const copyGraph = copy[copy.indexOf('-filter_complex') + 1];
    expect(copyGraph.startsWith(`[0:v]${nearestSelectFilter(base)},scale_cuda=w=1920:h=1080:format=yuv420p`)).toBe(true);
  });

  it("keeps an 8-bit source as nv12 off the card (the copied span's rule), scales in software for the other vendors, and takes black as RGB", () => {
    expect(compositeBaseGraph(args({ base: { ...base, sourcePixelFormat: 'yuv420p' } }))).toContain('scale_cuda=w=1920:h=1080,hwdownload,format=nv12,setpts');
    expect(compositeBaseGraph(args({ encoder: 'qsv' }))).toContain(',scale=w=1920:h=1080,setpts=N/(30*TB),scale=in_color_matrix=bt709:in_range=tv,format=rgb24[bg]');
    expect(compositeBaseGraph(args({ base: { kind: 'black' } }))).toBe('[0:v]format=rgb24[bg]');
  });

  it('carries a sped base on the scaled time line and refuses a slow base without its operands', () => {
    expect(compositeBaseGraph(args({ base: { ...base, rate: 1.5 } }))).toContain(nearestSelectFilter({ ...base, rate: 1.5 }));
    expect(() => compositeBaseGraph(args({ base: { ...base, rate: 0.5 } }))).toThrow(/slow base needs/);
  });
});

describe('compositeSpanArgs', () => {
  it("is the copied span's command shape with the layer as a second input and the overlay join", () => {
    const a = compositeSpanArgs(args());
    expect(a.slice(0, 7)).toEqual(['-y', '-hide_banner', '-nostdin', '-v', 'error', '-stats', '-hwaccel']);
    expect(a).toContain('-copyts');
    expect(a[a.indexOf('-ss') + 1]).toBe('9.983317'); // one source frame before S = 10 s
    expect(a[a.indexOf('-copyts') + 2]).toBe(DJI);
    expect(a[a.indexOf(DJI) + 2]).toBe('C:/tmp/layer-0001.mov');
    const graph = a[a.indexOf('-filter_complex') + 1];
    const [bg, ov, join] = graph.split(';');
    expect(bg).toBe(compositeBaseGraph(args()));
    expect(ov).toBe('[1:v]trim=start_frame=1,setpts=N/(30*TB),format=rgba[ov]');
    expect(join).toBe(`[bg][ov]overlay=0:0:format=rgb:alpha=straight,${REMOTION_BT709_ZSCALE},format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709[v]`);
    expect(REMOTION_BT709_ZSCALE).toBe('zscale=matrix=709:matrixin=709:range=limited:primaries=709:primariesin=709:transfer=709:transferin=709');
    // The copied spans' output line, verbatim.
    const tail = a.slice(a.indexOf('-map') + 2);
    expect(tail).toEqual([
      '-r', '30', '-fps_mode', 'cfr', '-frames:v', '60',
      '-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '23', '-b:v', '0', '-bf', '2', '-g', '60',
      '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-an', '-f', 'mpegts', 'C:/tmp/span-0001.ts',
    ]);
  });

  it('takes a black base from lavfi at the output size and rate, with no seek', () => {
    const a = compositeSpanArgs(args({ base: { kind: 'black' }, leadIn: 0 }));
    expect(a).not.toContain('-hwaccel');
    expect(a).not.toContain('-ss');
    expect(a[a.indexOf('-f') + 1]).toBe('lavfi');
    expect(a[a.indexOf('lavfi') + 2]).toBe('color=black:size=1920x1080:rate=30');
    expect(a[a.indexOf('-filter_complex') + 1]).toContain('[1:v]trim=start_frame=0,');
  });

  it('hands QSV its nv12 and carries the quality level', () => {
    const a = compositeSpanArgs(args({ encoder: 'qsv', quality: 28 }));
    expect(a[a.indexOf('-filter_complex') + 1]).toContain(',format=yuv420p,format=nv12,setparams=');
    expect(a).toContain('h264_qsv');
    expect(a[a.indexOf('-global_quality') + 1]).toBe('28');
  });
});

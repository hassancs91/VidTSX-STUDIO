/**
 * The pure half of the shot-composite engine (docs/export-engines-plan.md
 * "Engine 3"): the ffmpeg argument builder for a COMPOSITE span — the shot
 * layer, rendered by the browser with alpha, laid over footage decoded
 * straight from the source (or over black) and encoded with the copied
 * spans' settings into the same MPEG-TS piece shape every other span makes.
 * No spawning, no fs; `shot-composite-engine.ts` runs it.
 *
 * The graph, measured by hand 2026-09-12 on a DJI 4K 10-bit HEVC file
 * (30 frames in 1.2 s, tags `yuv420p tv bt709 bt709 bt709`):
 *
 *   base   [0:v] the copied span's own select (T1 condition 1, or the
 *          slow-motion recipe) → scale to the output size (NVDEC → scale_cuda
 *          on NVIDIA, then `hwdownload`; software elsewhere) → RGB by the
 *          colour policy's matrix and range;
 *   layer  [1:v] the ProRes 4444 intermediate, its lead-in frame dropped
 *          (condition 4), as straight-alpha RGBA;
 *   join   `overlay` in RGB with straight alpha — the same blend Chromium
 *          does when the whole composition is rendered — then Remotion's own
 *          zscale to limited-range BT.709 (the pre-stitcher's filter with the
 *          primaries/transfer tags `remotion-color-args.ts` adds), so the
 *          composited pixels take the same road to 4:2:0 as a browser span's;
 *   out    the copied spans' encoder line, GOP and colour flags.
 *
 * A black base is the composition's background as a lavfi source, in RGB.
 */
import type { ProxyGpuEncoder } from '../proxy-encoders';
import { BT709_ZSCALE_EXTRA } from '../../remotion-color-args';
import {
  ENCODER_PIXEL_FORMATS,
  colorFlagArgs,
  colorParamsFilter,
  isEightBit420,
  nearestSelectFilter,
  outputTimingArgs,
  seekSeconds,
  spanEncoderArgs,
  type FrameRate,
  type SelectOptions,
} from './passthrough-ffmpeg';
import { slowMotionFilters } from './passthrough-slow';
import type { ExportColorPolicy } from './types';

const COMMON = ['-y', '-hide_banner', '-nostdin', '-v', 'error', '-stats'];

/** Remotion's pre-stitcher conversion (`ffmpeg-args.js`) with the five-tag extension — RGB in, limited BT.709 out. */
export const REMOTION_BT709_ZSCALE = `zscale=matrix=709:matrixin=709:range=limited${BT709_ZSCALE_EXTRA}`;

/** The footage under the layer: the copied span's source and mapping, or the composition's black. */
export type CompositeBase =
  | ({
      kind: 'source';
      sourcePath: string;
      sourcePixelFormat?: string;
      /** Slow motion (rate < 1): the operands of Remotion's media time and the source time base. */
      trimBefore?: number;
      clipOffset?: number;
      timeBase?: FrameRate;
    } & SelectOptions)
  | { kind: 'black' };

export interface CompositeSpanArgs {
  encoder: ProxyGpuEncoder;
  quality?: number;
  base: CompositeBase;
  /** The shot layer: ProRes 4444 with alpha, rendered `leadIn` frames early. */
  layerPath: string;
  leadIn: number;
  frames: number;
  fps: number;
  width: number;
  height: number;
  color: ExportColorPolicy;
  outputPath: string;
}

/** The base's filter chain up to RGB, from the decoder's output (`[0:v]`) to `[bg]`. */
export function compositeBaseGraph(a: CompositeSpanArgs): string {
  const { base } = a;
  const toRgb = `scale=in_color_matrix=${a.color.matrix}:in_range=${a.color.range},format=rgb24`;
  if (base.kind === 'black') return `[0:v]format=rgb24[bg]`;
  // The NVIDIA path scales on the card and downloads the frame; the copied
  // span's own rule for the 8-bit 4:2:0 conversion (`copySpanArgs`) applies.
  const nvencFormat = isEightBit420(base.sourcePixelFormat) ? '' : ':format=yuv420p';
  const scale = a.encoder === 'nvenc'
    ? `scale_cuda=w=${a.width}:h=${a.height}${nvencFormat},hwdownload,format=${isEightBit420(base.sourcePixelFormat) ? 'nv12' : 'yuv420p'}`
    : `scale=w=${a.width}:h=${a.height}`;
  if (base.rate !== undefined && base.rate < 1) {
    if (base.trimBefore === undefined || base.clipOffset === undefined || !base.timeBase) throw new Error('a slow base needs trimBefore, clipOffset and the source time base');
    if (base.firstFrameCeil) throw new Error('a slow span shows the nearest frame on its first slot (measured 2026-09-11); the ceil rule is for rate >= 1');
    const slow = slowMotionFilters({ trimBefore: base.trimBefore, clipOffset: base.clipOffset, rate: base.rate, fps: a.fps, sourceFrameRate: base.sourceFrameRate, timeBase: base.timeBase });
    return `[0:v]${slow.select},${slow.setpts},${slow.fps},${scale},${toRgb}[bg]`;
  }
  return `[0:v]${nearestSelectFilter(base)},${scale},setpts=N/(${a.fps}*TB),${toRgb}[bg]`;
}

/** One composite span → MPEG-TS video-only piece with the copied spans' settings. */
export function compositeSpanArgs(a: CompositeSpanArgs): string[] {
  const { base } = a;
  const layer = `[1:v]trim=start_frame=${a.leadIn},setpts=N/(${a.fps}*TB),format=rgba[ov]`;
  const encoderFormat = ENCODER_PIXEL_FORMATS[a.encoder];
  const join = `[bg][ov]overlay=0:0:format=rgb:alpha=straight,${REMOTION_BT709_ZSCALE},format=yuv420p${encoderFormat === 'yuv420p' ? '' : `,format=${encoderFormat}`},${colorParamsFilter(a.color)}[v]`;
  const graph = `${compositeBaseGraph(a)};${layer};${join}`;
  const baseInput = base.kind === 'black'
    ? ['-f', 'lavfi', '-i', `color=black:size=${a.width}x${a.height}:rate=${a.fps}`]
    : [
        ...(a.encoder === 'nvenc' ? ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda'] : []),
        '-ss', seekSeconds(base), '-copyts', '-i', base.sourcePath,
      ];
  return [
    ...COMMON,
    ...baseInput,
    '-i', a.layerPath,
    '-filter_complex', graph, '-map', '[v]',
    ...outputTimingArgs(a.fps, a.frames),
    ...spanEncoderArgs(a.encoder, a.quality),
    ...colorFlagArgs(a.color),
    '-an', '-f', 'mpegts', a.outputPath,
  ];
}

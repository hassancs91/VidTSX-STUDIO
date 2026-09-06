/**
 * The pure half of the passthrough engine (docs/export-engines-plan.md
 * Stage 2): ffmpeg argument builders for every span kind, the join and the
 * one-pass audio. No spawning, no fs, no electron — everything here is
 * unit-tested; `passthrough-engine.ts` runs it.
 *
 * The four T1 build conditions live here as code:
 *
 * 1. Frame mapping — output frame n of a span starting at source time S shows
 *    the source frame whose pts is NEAREST to S + n/fps: a per-frame `select`
 *    on absolute pts (`-copyts`, seeking one source frame early so a nearest
 *    frame just before S is still decoded), `setpts` onto the exact fps grid,
 *    then `-r fps -fps_mode cfr -frames:v N`. Never `-r` alone, never `fps=`
 *    (both pick other frames — measured in §T1 leg 0).
 * 2. One encoder for both span kinds — browser spans are decoded from
 *    Remotion's intermediate and encoded HERE with the copied spans' settings.
 * 3. Join through MPEG-TS video-only intermediates; the audio is one pass over
 *    the whole timeline, muxed last by the finishing stage.
 * 4. A browser span is rendered one frame early and the lead-in is dropped.
 *
 * Colour: NVENC writes primaries/transfer into the VUI only when the FRAMES
 * carry them (the `-color_primaries` flags alone leave them unknown — measured
 * 2026-09-06 on the 8.1 build), so every graph ends in `setparams` tagging the
 * policy; the output flags stay as belt and braces, and the finishing stage
 * verifies all five tags anyway.
 */
import type { ProxyGpuEncoder } from '../proxy-encoders';
import type { AudioSegment, ExportAudioPlan } from '../../../../shared/studio/export-spans';
import type { ExportColorPolicy } from './types';

/** A source's frame rate as ffprobe reports it (`r_frame_rate`), exact. */
export interface FrameRate {
  num: number;
  den: number;
}

/** T1's copied-span encoder settings (§T1 leg 2: 0 % over 24, 3.9× realtime). */
export const COPY_QUALITY: Record<ProxyGpuEncoder, number> = { nvenc: 23, qsv: 23, amf: 23 };

export const ENCODER_NAMES: Record<ProxyGpuEncoder, string> = { nvenc: 'h264_nvenc', qsv: 'h264_qsv', amf: 'h264_amf' };

const COMMON = ['-y', '-hide_banner', '-nostdin', '-v', 'error', '-stats'];

/** The frame-level tag filter (see the header) for the colour policy. */
export function colorParamsFilter(color: ExportColorPolicy): string {
  return `setparams=range=${color.range}:color_primaries=${color.primaries}:color_trc=${color.transfer}:colorspace=${color.matrix}`;
}

/** Output flags carrying the policy into the container. */
export function colorFlagArgs(color: ExportColorPolicy): string[] {
  return ['-color_range', color.range, '-colorspace', color.matrix, '-color_primaries', color.primaries, '-color_trc', color.transfer];
}

/** Output-side encoder arguments, one GOP shape for every span. */
export function spanEncoderArgs(encoder: ProxyGpuEncoder): string[] {
  const q = String(COPY_QUALITY[encoder]);
  switch (encoder) {
    case 'nvenc':
      return ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', q, '-b:v', '0', '-bf', '2', '-g', '60'];
    case 'qsv':
      return ['-c:v', 'h264_qsv', '-preset', 'medium', '-global_quality', q, '-bf', '2', '-g', '60'];
    case 'amf':
      return ['-c:v', 'h264_amf', '-quality', 'balanced', '-rc', 'cqp', '-qp_i', q, '-qp_p', q, '-bf', '2', '-g', '60'];
  }
}

/** `-r fps -fps_mode cfr -frames:v N`: setpts already put every frame on the grid; declaring the rate stops the encoder re-rounding onto the source's. */
export function outputTimingArgs(fps: number, frames: number): string[] {
  return ['-r', String(fps), '-fps_mode', 'cfr', '-frames:v', String(frames)];
}

export interface SelectOptions {
  /** Source time of output frame 0, in whole composition frames (S = sourceFrame / fps). */
  sourceFrame: number;
  fps: number;
  sourceFrameRate: FrameRate;
  /** T1 leg 3: the first frame after opening a file shows the ceil frame. */
  firstFrameCeil: boolean;
}

/**
 * Pure: the `select` filter implementing condition 1. Keep source frame K
 * (= round(t/D), D = one source frame) iff it is the nearest source frame to
 * the output slot it itself is nearest to: n = max(0, round((t − S)·fps)),
 * slot time S + n/fps, nearest K there = floor(slotTime/D + 0.5). Rationals
 * are written as fractions so ffmpeg evaluates the same doubles this side does.
 */
export function nearestSelectFilter(o: SelectOptions): string {
  const S = `(${o.sourceFrame}/${o.fps})`;
  const D = `(${o.sourceFrameRate.den}/${o.sourceFrameRate.num})`;
  const n = `max(round((t-${S})*${o.fps})\\,0)`;
  const nearestK = `floor((${S}+${n}/${o.fps})/${D}+0.5)`;
  const wantK = o.firstFrameCeil ? `if(lt(${n}\\,1)\\,ceil(${S}/${D}-0.000001)\\,${nearestK})` : nearestK;
  return `select='eq(${wantK}\\,round(t/${D}))'`;
}

/** Seek target: one source frame before S, never negative (seconds, 6 dp). */
export function seekSeconds(o: Pick<SelectOptions, 'sourceFrame' | 'fps' | 'sourceFrameRate'>): string {
  const S = o.sourceFrame / o.fps;
  const D = o.sourceFrameRate.den / o.sourceFrameRate.num;
  return Math.max(0, S - D).toFixed(6);
}

export interface CopySpanArgs extends SelectOptions {
  encoder: ProxyGpuEncoder;
  sourcePath: string;
  frames: number;
  width: number;
  height: number;
  color: ExportColorPolicy;
  outputPath: string;
}

/**
 * One copied span → MPEG-TS video-only piece. NVENC keeps the whole pipeline
 * on the card (NVDEC → select → scale_cuda → NVENC, the measured 3.9× path);
 * the other vendors decode in software and scale on the CPU (unmeasured;
 * correct by construction).
 */
export function copySpanArgs(a: CopySpanArgs): string[] {
  const select = nearestSelectFilter(a);
  const scale = a.encoder === 'nvenc'
    ? `scale_cuda=w=${a.width}:h=${a.height}:format=yuv420p`
    : `scale=w=${a.width}:h=${a.height},format=yuv420p`;
  const graph = `[0:v]${select},${scale},setpts=N/(${a.fps}*TB),${colorParamsFilter(a.color)}[v]`;
  return [
    ...COMMON,
    ...(a.encoder === 'nvenc' ? ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda'] : []),
    '-ss', seekSeconds(a), '-copyts', '-i', a.sourcePath,
    '-filter_complex', graph, '-map', '[v]',
    ...outputTimingArgs(a.fps, a.frames),
    ...spanEncoderArgs(a.encoder),
    ...colorFlagArgs(a.color),
    '-an', '-f', 'mpegts', a.outputPath,
  ];
}

export interface BlackSpanArgs {
  encoder: ProxyGpuEncoder;
  frames: number;
  fps: number;
  width: number;
  height: number;
  color: ExportColorPolicy;
  outputPath: string;
}

/** A gap in the base track: the composition's black background, N frames. */
export function blackSpanArgs(a: BlackSpanArgs): string[] {
  return [
    ...COMMON,
    '-f', 'lavfi', '-i', `color=black:size=${a.width}x${a.height}:rate=${a.fps}`,
    '-vf', `format=yuv420p,${colorParamsFilter(a.color)}`,
    ...outputTimingArgs(a.fps, a.frames),
    ...spanEncoderArgs(a.encoder),
    ...colorFlagArgs(a.color),
    '-an', '-f', 'mpegts', a.outputPath,
  ];
}

export interface BrowserSpanArgs {
  encoder: ProxyGpuEncoder;
  /** Remotion's intermediate (yuv420p tv bt709, CFR), rendered `leadIn` frames early. */
  inputPath: string;
  leadIn: number;
  frames: number;
  fps: number;
  color: ExportColorPolicy;
  outputPath: string;
}

/** Condition 2 + 4: drop the lead-in, re-encode with the copied spans' settings. */
export function browserSpanArgs(a: BrowserSpanArgs): string[] {
  return [
    ...COMMON,
    '-i', a.inputPath,
    '-vf', `trim=start_frame=${a.leadIn},setpts=N/(${a.fps}*TB),format=yuv420p,${colorParamsFilter(a.color)}`,
    ...outputTimingArgs(a.fps, a.frames),
    ...spanEncoderArgs(a.encoder),
    ...colorFlagArgs(a.color),
    '-an', '-f', 'mpegts', a.outputPath,
  ];
}

/** concat-demuxer list with explicit durations, so each piece's offset is exactly frames/fps. */
export function concatListText(pieces: ReadonlyArray<{ path: string; frames: number }>, fps: number): string {
  const quote = (p: string) => p.replace(/\\/g, '/').replace(/'/g, "'\\''");
  return pieces.map((p) => `file '${quote(p.path)}'\nduration ${(p.frames / fps).toFixed(6)}`).join('\n') + '\n';
}

/** Condition 3: concat the TS pieces into one video-only mp4 by stream copy. */
export function joinArgs(listPath: string, outputPath: string, color: ExportColorPolicy): string[] {
  return [
    ...COMMON,
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-map', '0:v:0', '-c:v', 'copy', ...colorFlagArgs(color), '-an',
    outputPath,
  ];
}

/**
 * The one audio pass (D6/D7, condition 3): every audible clip's source audio
 * trimmed sample-exactly, silence for the rest, concatenated at 48 kHz stereo
 * into a WAV the finishing stage AAC-encodes once. Same-asset segments share
 * one input.
 */
export function audioPassArgs(plan: ExportAudioPlan, outputPath: string): string[] {
  const inputs: string[] = [];
  const inputIndex = new Map<string, number>();
  const labels: string[] = [];
  const graph: string[] = [];
  const fmt = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';
  plan.segments.forEach((seg: AudioSegment, i) => {
    const label = `[s${i}]`;
    if (seg.kind === 'silence') {
      graph.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${seg.duration.toFixed(6)},${fmt}${label}`);
    } else {
      let idx = inputIndex.get(seg.assetPath);
      if (idx === undefined) {
        idx = inputs.length;
        inputs.push(seg.assetPath);
        inputIndex.set(seg.assetPath, idx);
      }
      const end = (seg.sourceIn + seg.duration).toFixed(6);
      graph.push(`[${idx}:a:0]atrim=start=${seg.sourceIn.toFixed(6)}:end=${end},asetpts=PTS-STARTPTS,${fmt}${label}`);
    }
    labels.push(label);
  });
  const total = plan.duration.toFixed(6);
  graph.push(`${labels.join('')}concat=n=${labels.length}:v=0:a=1,atrim=end=${total},apad=whole_dur=${total}[out]`);
  return [
    ...COMMON,
    ...inputs.flatMap((p) => ['-i', p]),
    '-filter_complex', graph.join(';'),
    '-map', '[out]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le',
    outputPath,
  ];
}

/** Pure: the frame counter from ffmpeg's `-stats` line. */
export function parseStatsFrame(text: string): number | null {
  const m = /frame=\s*(\d+)/g;
  let last: number | null = null;
  for (let r = m.exec(text); r; r = m.exec(text)) last = Number(r[1]);
  return last;
}

/** Pure: is the source's frame rate constant enough to index by pts? */
export function isConstantFrameRate(r: FrameRate, avg: FrameRate): boolean {
  const a = r.num / r.den;
  const b = avg.num / avg.den;
  return a > 0 && b > 0 && Math.abs(a - b) / a < 1e-3;
}

export function parseFrameRate(text: string | undefined): FrameRate | null {
  if (!text) return null;
  const m = /^(\d+)\/(\d+)$/.exec(text.trim());
  if (m) {
    const num = Number(m[1]);
    const den = Number(m[2]);
    return num > 0 && den > 0 ? { num, den } : null;
  }
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? { num: Math.round(n * 1000), den: 1000 } : null;
}

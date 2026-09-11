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
 *    (both pick other frames — measured in §T1 leg 0). A sped span (slice 4)
 *    is the same rule on the scaled time line, S + rate·n/fps (measured
 *    2026-09-06: every third 59.94 fps frame at 1.5×). A SLOW span (rate < 1,
 *    2026-09-11) is `passthrough-slow.ts`: the select in the stream's integer
 *    ticks as the compositor computes them, each kept frame placed on its
 *    first slot, the `fps` filter repeating it over the slots it serves.
 * 2. One encoder for both span kinds — browser spans are decoded from
 *    Remotion's intermediate and encoded HERE with the copied spans' settings.
 * 3. Join through MPEG-TS video-only intermediates — the finishing mux reads
 *    their concat list as its video input, so the join IS the mux (Stage 4);
 *    the audio is one pass over the whole timeline, muxed there too.
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
import { slowMotionFilters } from './passthrough-slow';
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
  /** Source time of output frame 0, in composition frames (S = sourceFrame / fps) — whole unless the span has a rate. */
  sourceFrame: number;
  fps: number;
  sourceFrameRate: FrameRate;
  /** T1 leg 3: the first frame after opening a file shows the ceil frame. */
  firstFrameCeil: boolean;
  /** Slice 4: the clip's playback rate (absent = 1) — slot n sits at S + rate·n/fps. */
  rate?: number;
}

/**
 * Pure: the `select` filter implementing condition 1. Keep source frame K
 * (= round(t/D), D = one source frame) iff it is the nearest source frame to
 * the output slot it itself is nearest to: n = max(0, round((t − S)·fps/r)),
 * slot time S + r·n/fps, nearest K there = floor(slotTime/D + 0.5). Rationals
 * are written as fractions so ffmpeg evaluates the same doubles this side
 * does; a rate is written as JS prints it (its shortest round-trip form, so
 * strtod gives back the same double). Without a rate the string is exactly
 * what Stage 2 wrote.
 */
export function nearestSelectFilter(o: SelectOptions): string {
  const S = `(${o.sourceFrame}/${o.fps})`;
  const D = `(${o.sourceFrameRate.den}/${o.sourceFrameRate.num})`;
  const r = o.rate !== undefined && o.rate !== 1 ? o.rate : undefined;
  if (r !== undefined && !(r > 0)) throw new Error(`select needs a positive rate, got ${r}`);
  const n = r === undefined ? `max(round((t-${S})*${o.fps})\\,0)` : `max(round((t-${S})*${o.fps}/${r})\\,0)`;
  const slot = r === undefined ? `${S}+${n}/${o.fps}` : `${S}+${r}*${n}/${o.fps}`;
  const nearestK = `floor((${slot})/${D}+0.5)`;
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
  /** Slow motion (rate < 1): the whole numbers the recipe mirrors Remotion with, and the source's time base. */
  trimBefore?: number;
  clipOffset?: number;
  timeBase?: FrameRate;
}

/**
 * One copied span → MPEG-TS video-only piece. NVENC keeps the whole pipeline
 * on the card (NVDEC → select → scale_cuda → NVENC, the measured 3.9× path);
 * the other vendors decode in software and scale on the CPU (unmeasured;
 * correct by construction).
 */
export function copySpanArgs(a: CopySpanArgs): string[] {
  const scale = a.encoder === 'nvenc'
    ? `scale_cuda=w=${a.width}:h=${a.height}:format=yuv420p`
    : `scale=w=${a.width}:h=${a.height},format=yuv420p`;
  let graph: string;
  if (a.rate !== undefined && a.rate < 1) {
    if (a.trimBefore === undefined || a.clipOffset === undefined || !a.timeBase) throw new Error('a slow span needs trimBefore, clipOffset and the source time base');
    if (a.firstFrameCeil) throw new Error('a slow span shows the nearest frame on its first slot (measured 2026-09-11); the ceil rule is for rate >= 1');
    const slow = slowMotionFilters({ trimBefore: a.trimBefore, clipOffset: a.clipOffset, rate: a.rate, fps: a.fps, sourceFrameRate: a.sourceFrameRate, timeBase: a.timeBase });
    graph = `[0:v]${slow.select},${slow.setpts},${slow.fps},${scale},${colorParamsFilter(a.color)}[v]`;
  } else {
    graph = `[0:v]${nearestSelectFilter(a)},${scale},setpts=N/(${a.fps}*TB),${colorParamsFilter(a.color)}[v]`;
  }
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

export interface HoldLastFrameArgs {
  encoder: ProxyGpuEncoder;
  /** The short copy piece. */
  inputPath: string;
  /** Index of its last frame. */
  lastFrame: number;
  /** How many frames to produce, all showing that frame. */
  frames: number;
  fps: number;
  color: ExportColorPolicy;
  outputPath: string;
}

/**
 * A source's video stream can end a few milliseconds before its container
 * (DJI files: the audio runs on), so a clip that runs to the container's end
 * asks for a source frame past the last one. The browser shows the last frame
 * there; this makes the same frames from the short piece's own last frame —
 * one extra encoder generation on one or two frames, instead of minutes of
 * browser rendering per clip tail.
 */
export function holdLastFrameArgs(a: HoldLastFrameArgs): string[] {
  return [
    ...COMMON,
    '-i', a.inputPath,
    '-vf', `trim=start_frame=${a.lastFrame},tpad=stop=${a.frames - 1}:stop_mode=clone,setpts=N/(${a.fps}*TB),format=yuv420p,${colorParamsFilter(a.color)}`,
    ...outputTimingArgs(a.fps, a.frames),
    ...spanEncoderArgs(a.encoder),
    ...colorFlagArgs(a.color),
    '-an', '-f', 'mpegts', a.outputPath,
  ];
}

/**
 * Condition 3: the concat-demuxer list with explicit durations, so each
 * piece's offset is exactly frames/fps. The finishing mux reads it as its
 * video input (`finishMuxArgs` with `videoDemuxer: 'concat'`) — the join and
 * the mux are one stream copy into the output (Stage 4).
 */
export function concatListText(pieces: ReadonlyArray<{ path: string; frames: number }>, fps: number): string {
  const quote = (p: string) => p.replace(/\\/g, '/').replace(/'/g, "'\\''");
  return pieces.map((p) => `file '${quote(p.path)}'\nduration ${(p.frames / fps).toFixed(6)}`).join('\n') + '\n';
}

export interface AudioPass {
  args: string[];
  /** The filter graph, written to `graphPath` by the caller before spawning. */
  graph: string;
}

/**
 * The one audio pass (D6/D7, condition 3): every audible clip's source audio
 * trimmed sample-exactly, silence for the rest, concatenated at 48 kHz stereo
 * into a WAV the finishing stage AAC-encodes once. Same-asset segments share
 * one input. The graph goes through `-filter_complex_script` — inline, 275
 * segments overran Windows' command line (spawn ENAMETOOLONG, 2026-09-06).
 *
 * Every source segment contributes EXACTLY its planned length: a camera
 * file's audio can end before its container (DJI 0271: 44.7 ms short), and a
 * segment trimmed to the clip's end then came up short, so every later
 * segment played early — measured as −44.7 ms per such clip tail, −491 ms by
 * the middle of the 3 h project. `apad=whole_dur` + `atrim=end` pin the
 * length; `aresample=first_pts=0` makes the timestamps start at 0 so a late
 * audio start pads with silence instead of shifting the trim.
 *
 * A segment's static gain (Stage 3) is one linear `volume=` on that segment,
 * the multiplier Remotion applies for a static `volume` prop. A segment whose
 * volume MOVES (slice 3: fades, transitions) gets Remotion's own per-frame
 * expression instead (`remotionVolumeExpression`), placed right after the
 * trim so `t` is SOURCE time as in Remotion's chain.
 *
 * Several chains (slice 2: one per track with sound) are each concatenated
 * and pinned to the whole length, then summed by `amix … normalize=0` — the
 * very filter `@remotion/renderer` merges a composition's audio with, so the
 * levels are Remotion's. One chain keeps Stage 2's graph to the byte.
 *
 * A segment with a RATE (slice 4) is Remotion's chain verbatim instead of the
 * resample + trim above: `aformat=sample_fmts=s16:sample_rates=48000`, the
 * `atempo` chain, then `atrim` at POST-tempo times (`sourceIn / rate`, its
 * planned length after that — `seamless-aac-trim.js` getActualTrimLeft with
 * seamless = true: audioStartFrame/fps/rate + sinceStart/fps), the volume
 * (static or per-frame) right after the trim as Remotion orders it — with
 * the curve's windows on the post-tempo time line, since every registered
 * frame is 1/fps of the stretched audio — then our pin. Measured in slice 3:
 * this chain's PCM is bit-identical between ffmpeg 7.1 and 8.1.
 */
/**
 * Pure: `@remotion/renderer`'s `calculateATempo` (assets/calculate-atempo.js)
 * verbatim — `atempo=<rate to 5 dp>` inside ffmpeg's 0.5–2 range, else the
 * square root twice, recursively. Null at rate 1. The chain is a
 * pitch-preserving WSOLA stretch, and ffmpeg 7.1 (Remotion's) and 8.1 (ours)
 * produce bit-identical PCM for it (measured 2026-09-06).
 */
export function remotionAtempoFilter(rate: number): string | null {
  if (!(rate > 0)) throw new Error(`atempo needs a positive rate, got ${rate}`);
  if (rate === 1) return null;
  if (rate >= 0.5 && rate <= 2) return `atempo=${rate.toFixed(5)}`;
  const half = remotionAtempoFilter(Math.sqrt(rate));
  return `${half},${half}`;
}

/**
 * Pure: a trim point as `@remotion/renderer` writes it (stringify-ffmpeg-filter.js
 * `stringifyTrim`): whole microseconds with a floating-point clean-up (a
 * fraction under 1e-7 floors, over 1 − 1e-7 ceils; anything in between is
 * printed as JS prints the double, and ffmpeg's duration parser keeps the
 * whole microseconds). Same value as `start=<s>` — measured bit-identical —
 * but written Remotion's way so the graph reads as its chain.
 */
export function remotionTrimMicros(seconds: number): string {
  let value = seconds * 1_000_000;
  if (value % 1 < 0.0000001) value = Math.floor(value);
  else if (value % 1 > 0.9999999) value = Math.ceil(value);
  const text = `${value}us`;
  return text.includes('e-') ? '0us' : text;
}

/**
 * Pure: the per-frame volume expression `@remotion/renderer` writes for an
 * asset whose volume changes (assets/ffmpeg-volume-expression.js, the same
 * construction): every frame's value rounded to 1/97 steps at 3 dp
 * (roundVolumeToAvoidStackOverflow — ffmpeg's expression depth), the last
 * value repeated once so the trailing half frame is covered, the values
 * grouped and nested most-common-last, each group a sum of `between(t, …)`
 * windows half a frame either side of the frame's SOURCE time, 4 dp. With
 * `eval=frame` ffmpeg evaluates it once per decoded audio buffer at the
 * buffer's first pts, so a fade is a staircase on the decoder's buffer
 * boundaries — boundaries the pass shares with Remotion's chain (measured
 * 2026-09-06: the same 896/1024-sample frames at the same pts on the DJI
 * file through `aresample=async=1:first_pts=0,atrim` and through Remotion's
 * `aformat,atrim` alike). So a faded clip at gain 0.5 plays its flat part at
 * 0.505 in a Remotion export, and so does the pass.
 */
export function remotionVolumeExpression(volumes: readonly number[], sourceIn: number, fps: number): string {
  if (volumes.length === 0) throw new Error('volume curve without frames');
  const padded = [...volumes, volumes[volumes.length - 1]];
  const groups = new Map<number, number[]>();
  padded.forEach((v, f) => {
    const r = Number((Math.round(v * 97) / 97).toFixed(3));
    const g = groups.get(r);
    if (g) g.push(f);
    else groups.set(r, [f]);
  });
  // The order Remotion iterates its map (Object.keys: integer keys first,
  // ascending, then insertion order), then a stable sort by count so the most
  // common value is the final else.
  const entries = [...groups.entries()];
  const isIndex = (v: number) => Number.isInteger(v) && v >= 0;
  const ordered = [...entries.filter(([v]) => isIndex(v)).sort((a, b) => a[0] - b[0]), ...entries.filter(([v]) => !isIndex(v))]
    .sort((a, b) => a[1].length - b[1].length);
  const windows = (frames: number[]): string => {
    const runs: number[][] = [];
    for (const f of frames) {
      const last = runs[runs.length - 1];
      if (last && f === last[last.length - 1] + 1) last.push(f);
      else runs.push([f]);
    }
    return runs
      .map((r) => `between(t,${((r[0] - 0.5) / fps + sourceIn).toFixed(4)},${((r[r.length - 1] + 0.5) / fps + sourceIn).toFixed(4)})`)
      .join('+');
  };
  const build = (arr: Array<[number, number[]]>): string =>
    arr.length === 1 ? String(arr[0][0]) : `if(${windows(arr[0][1])},${arr[0][0]},${build(arr.slice(1))})`;
  return build(ordered);
}

export function audioPassArgs(plan: ExportAudioPlan, outputPath: string, graphPath: string): AudioPass {
  const inputs: string[] = [];
  const inputIndex = new Map<string, number>();
  const graph: string[] = [];
  const fmt = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';
  const total = plan.duration.toFixed(6);
  const chains = [plan.segments, ...(plan.chains ?? [])];
  const mixed: string[] = [];
  chains.forEach((segments, k) => {
    const labels: string[] = [];
    segments.forEach((seg: AudioSegment, i) => {
      const label = k === 0 ? `[s${i}]` : `[c${k}s${i}]`;
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
        const dur = seg.duration.toFixed(6);
        const gain = seg.gain !== undefined ? `,volume=${seg.gain.toFixed(6)}` : '';
        const rate = seg.rate !== undefined && seg.rate !== 1 ? seg.rate : undefined;
        // Remotion's `t` for the volume windows: source time, or post-tempo time on a sped segment.
        const trimLeft = rate === undefined ? seg.sourceIn : seg.sourceIn / rate;
        let curve = '';
        if (seg.volumes) {
          if (!(plan.fps && plan.fps > 0)) throw new Error('an audio plan with a volume curve needs its fps');
          curve = `,volume='${remotionVolumeExpression(seg.volumes, trimLeft, plan.fps)}':eval=frame`;
        }
        if (rate === undefined) {
          graph.push(`[${idx}:a:0]aresample=async=1:first_pts=0,atrim=start=${seg.sourceIn.toFixed(6)}:end=${end}${curve},asetpts=PTS-STARTPTS,${fmt}${gain},apad=whole_dur=${dur},atrim=end=${dur}${label}`);
        } else {
          const tempo = remotionAtempoFilter(rate);
          const trim = `atrim=${remotionTrimMicros(trimLeft)}:${remotionTrimMicros(trimLeft + seg.duration)}`;
          graph.push(`[${idx}:a:0]aformat=sample_fmts=s16:sample_rates=48000,${tempo},${trim}${curve}${gain},asetpts=PTS-STARTPTS,${fmt},apad=whole_dur=${dur},atrim=end=${dur}${label}`);
        }
      }
      labels.push(label);
    });
    const out = chains.length === 1 ? '[out]' : `[m${k}]`;
    graph.push(`${labels.join('')}concat=n=${labels.length}:v=0:a=1,atrim=end=${total},apad=whole_dur=${total}${out}`);
    mixed.push(out);
  });
  if (chains.length > 1) graph.push(`${mixed.join('')}amix=inputs=${chains.length}:dropout_transition=0:normalize=0[out]`);
  return {
    args: [
      ...COMMON,
      ...inputs.flatMap((p) => ['-i', p]),
      '-filter_complex_script', graphPath,
      '-map', '[out]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le',
      outputPath,
    ],
    graph: graph.join(';\n') + '\n',
  };
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

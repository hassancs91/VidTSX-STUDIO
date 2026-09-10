// The three ffmpeg edits behind `trim_video`, `concat_videos` and
// `extract_frame` (W8 Stage 3). Each builds one argument list, runs it through
// `runFfmpeg`, and returns what the tool files. Pure argument builders are
// exported for the unit tests; nothing here touches the library or artifacts.

import { probeMedia, runFfmpeg, toFfmpegPath, type MediaProbe } from './ffmpeg-run';

/** H.264 + AAC, the app's output contract — what every MP4 the queue makes is. */
const H264_ARGS = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p'];
const AAC_ARGS = ['-c:a', 'aac', '-b:a', '192k'];
const MP4_ARGS = ['-movflags', '+faststart'];

export interface TrimOptions {
  input: string;
  output: string;
  startSeconds: number;
  endSeconds: number;
  /** `precise` re-encodes for a frame-accurate cut; `fast` copies streams and lands on a keyframe. */
  mode: 'precise' | 'fast';
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

export function trimArgs(opts: Pick<TrimOptions, 'input' | 'output' | 'startSeconds' | 'endSeconds' | 'mode'>): string[] {
  const length = Math.max(0.01, opts.endSeconds - opts.startSeconds);
  const seek = ['-ss', opts.startSeconds.toFixed(3), '-i', toFfmpegPath(opts.input), '-t', length.toFixed(3)];
  const codecs = opts.mode === 'fast' ? ['-c', 'copy'] : [...H264_ARGS, ...AAC_ARGS];
  return [...seek, ...codecs, ...MP4_ARGS, toFfmpegPath(opts.output)];
}

export async function trimVideo(opts: TrimOptions): Promise<MediaProbe> {
  const probe = await probeMedia(opts.input);
  if (!probe.hasVideo) throw new Error('The input has no video stream.');
  const end = opts.endSeconds > 0 ? Math.min(opts.endSeconds, probe.duration || opts.endSeconds) : probe.duration;
  if (end <= opts.startSeconds) {
    throw new Error(`Nothing to keep: start ${opts.startSeconds}s is at or after end ${end.toFixed(2)}s (clip is ${probe.duration.toFixed(2)}s).`);
  }
  const length = end - opts.startSeconds;
  await runFfmpeg(trimArgs({ ...opts, endSeconds: end }), {
    ...(opts.signal ? { signal: opts.signal } : {}),
    onProgress: (seconds) => opts.onProgress?.(Math.min(1, seconds / length)),
  });
  return probeMedia(opts.output);
}

export interface ConcatInput {
  path: string;
  probe: MediaProbe;
}

export interface ConcatOptions {
  inputs: string[];
  output: string;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

/**
 * Every clip is scaled to FILL the first clip's size (then cropped — the
 * bundled ffmpeg has no `pad`, `fps` or `setsar` filter, so letterboxing is
 * not available; a clip of another aspect loses its edges), the output rate
 * is the first clip's, clips without audio get a silent track, and the concat
 * filter joins them. Re-encoding is the price of taking clips from different
 * sources.
 */
export function concatArgs(inputs: ConcatInput[], output: string): string[] {
  const first = inputs[0];
  const width = first.probe.width || 1920;
  const height = first.probe.height || 1080;
  const fps = first.probe.fps || 30;
  const args: string[] = [];
  const filters: string[] = [];
  let extraInputs = 0;
  for (const input of inputs) args.push('-i', toFfmpegPath(input.path));
  inputs.forEach((input, i) => {
    filters.push(
      `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=yuv420p[v${i}]`,
    );
    if (input.probe.hasAudio) {
      filters.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo[a${i}]`);
    } else {
      const index = inputs.length + extraInputs;
      extraInputs += 1;
      args.push('-f', 'lavfi', '-t', Math.max(0.1, input.probe.duration).toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
      filters.push(`[${index}:a]anull[a${i}]`);
    }
  });
  const pairs = inputs.map((_, i) => `[v${i}][a${i}]`).join('');
  filters.push(`${pairs}concat=n=${inputs.length}:v=1:a=1[v][a]`);
  return [
    ...args,
    '-filter_complex', filters.join(';'),
    '-map', '[v]', '-map', '[a]',
    '-r', String(fps),
    ...H264_ARGS, ...AAC_ARGS, ...MP4_ARGS,
    toFfmpegPath(output),
  ];
}

export async function concatVideos(opts: ConcatOptions): Promise<MediaProbe> {
  if (opts.inputs.length === 0) throw new Error('No clips to join.');
  const inputs: ConcatInput[] = [];
  for (const path of opts.inputs) {
    const probe = await probeMedia(path);
    if (!probe.hasVideo) throw new Error(`${path} has no video stream.`);
    inputs.push({ path, probe });
  }
  const total = inputs.reduce((sum, i) => sum + i.probe.duration, 0);
  await runFfmpeg(concatArgs(inputs, opts.output), {
    ...(opts.signal ? { signal: opts.signal } : {}),
    onProgress: (seconds) => opts.onProgress?.(total > 0 ? Math.min(1, seconds / total) : 0),
  });
  return probeMedia(opts.output);
}

export interface ExtractFrameOptions {
  input: string;
  /** `.png` or `.jpg` decides the encoder. */
  output: string;
  atSeconds: number;
  signal?: AbortSignal;
}

export function extractFrameArgs(opts: Pick<ExtractFrameOptions, 'input' | 'output' | 'atSeconds'>): string[] {
  const quality = opts.output.toLowerCase().endsWith('.jpg') ? ['-q:v', '2'] : [];
  return ['-ss', Math.max(0, opts.atSeconds).toFixed(3), '-i', toFfmpegPath(opts.input), '-frames:v', '1', ...quality, toFfmpegPath(opts.output)];
}

export async function extractFrameAt(opts: ExtractFrameOptions): Promise<void> {
  await runFfmpeg(extractFrameArgs(opts), opts.signal ? { signal: opts.signal } : {});
}

/**
 * Where a strip of `count` frames samples a clip: the centre of `count` equal
 * slices, so the first frame is not the (often black) very first frame and
 * the last is not the tail. One frame samples at `atSeconds`.
 */
export function stripTimes(durationSeconds: number, count: number, atSeconds: number): number[] {
  const n = Math.max(1, Math.round(count));
  if (n === 1) return [Math.min(Math.max(0, atSeconds), Math.max(0, durationSeconds - 0.05))];
  const usable = Math.max(0, durationSeconds - 0.05);
  return Array.from({ length: n }, (_, i) => Math.round(((i + 0.5) / n) * usable * 1000) / 1000);
}

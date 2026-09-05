/**
 * The shared finishing stage (docs/export-engines-plan.md D7): every engine's
 * video-only product is muxed here with the one audio pass, into the final
 * mp4, under one colour policy. Two exports of one project differ only in
 * how the frames were produced.
 *
 * Colour: the engine encodes to `EXPORT_COLOR`; this stage VERIFIES it
 * (ffprobe before and after the mux) rather than transcoding — a mismatch is
 * an engine bug and must fail loudly, never quietly re-encode (T1 leg 3: mixed
 * tags cannot share a file).
 *
 * Audio: PCM in, one AAC encode here with Remotion's settings (320 kb/s,
 * 18 kHz cutoff). ffmpeg's encoder declares its delay and the mp4 muxer
 * writes the matching edit list, so decoders start at the first real sample
 * — the D6 reference (the camera file, 0 ms) instead of +42.7 ms.
 */
import { spawn } from 'child_process';
import { getFfmpegBinary, runFfmpeg } from '../ffmpeg-bin';
import type { ExportColorPolicy } from './types';

export interface FinishExportOptions {
  videoPath: string;
  /** The whole-timeline audio (PCM preferred); may be `videoPath` itself. */
  audioPath: string;
  outputPath: string;
  color: ExportColorPolicy;
  signal: AbortSignal;
  onProgress?: (fraction: number) => void;
}

export interface ProbedStreams {
  video?: { codec: string; pixFmt?: string; range?: string; matrix?: string; primaries?: string; transfer?: string; frames?: number; width?: number; height?: number };
  audio?: { codec: string; sampleRate?: number; channels?: number; startTime?: number };
  duration?: number;
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  pix_fmt?: string;
  color_range?: string;
  color_space?: string;
  color_primaries?: string;
  color_transfer?: string;
  nb_frames?: string;
  width?: number;
  height?: number;
  sample_rate?: string;
  channels?: number;
  start_time?: string;
}

export async function probeStreams(filePath: string): Promise<ProbedStreams> {
  const ffprobe = await getFfmpegBinary('ffprobe');
  const output = await new Promise<string>((resolve, reject) => {
    const proc = spawn(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c: Buffer) => { stdout += c.toString(); });
    proc.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`ffprobe exited with code ${code}: ${stderr.trim()}`))));
  });
  const data = JSON.parse(output) as { streams?: FfprobeStream[]; format?: { duration?: string } };
  const v = data.streams?.find((s) => s.codec_type === 'video');
  const a = data.streams?.find((s) => s.codec_type === 'audio');
  const frames = v?.nb_frames ? parseInt(v.nb_frames, 10) : undefined;
  return {
    video: v
      ? { codec: v.codec_name ?? '', pixFmt: v.pix_fmt, range: v.color_range, matrix: v.color_space, primaries: v.color_primaries, transfer: v.color_transfer, frames: Number.isFinite(frames) ? frames : undefined, width: v.width, height: v.height }
      : undefined,
    audio: a
      ? { codec: a.codec_name ?? '', sampleRate: a.sample_rate ? parseInt(a.sample_rate, 10) : undefined, channels: a.channels, startTime: a.start_time ? parseFloat(a.start_time) : undefined }
      : undefined,
    duration: data.format?.duration ? parseFloat(data.format.duration) : undefined,
  };
}

/** Pure: the first mismatch between a probed video stream and the policy. */
export function colorMismatch(video: ProbedStreams['video'], color: ExportColorPolicy): string | null {
  if (!video) return 'no video stream';
  const checks: Array<[string, string | undefined, string]> = [
    ['pixel format', video.pixFmt, color.pixelFormat],
    ['colour range', video.range, color.range],
    ['colour matrix', video.matrix, color.matrix],
    ['colour primaries', video.primaries, color.primaries],
    ['transfer', video.transfer, color.transfer],
  ];
  for (const [what, actual, expected] of checks) {
    if (actual !== expected) return `${what} is ${actual ?? 'untagged'}, expected ${expected}`;
  }
  return null;
}

/** ffmpeg flags that carry the policy into the container on a stream copy. */
export function colorTagArgs(color: ExportColorPolicy): string[] {
  return [
    '-color_range', color.range,
    '-colorspace', color.matrix,
    '-color_primaries', color.primaries,
    '-color_trc', color.transfer,
  ];
}

export async function finishExport(options: FinishExportOptions): Promise<ProbedStreams> {
  const before = await probeStreams(options.videoPath);
  const mismatch = colorMismatch(before.video, options.color);
  if (mismatch) {
    throw new Error(`The export engine returned video with the wrong colour tags (${mismatch}).`);
  }

  // A timeline with no sound keeps what every export had: no audio track.
  const audioSource = options.audioPath === options.videoPath ? before : await probeStreams(options.audioPath);
  const hasAudio = audioSource.audio !== undefined;

  const ffmpeg = await getFfmpegBinary('ffmpeg');
  const totalSeconds = before.duration ?? 0;
  await runFfmpeg(
    ffmpeg,
    [
      '-y', '-hide_banner', '-nostdin',
      '-i', options.videoPath,
      ...(hasAudio ? ['-i', options.audioPath, '-map', '0:v:0', '-map', '1:a:0'] : ['-map', '0:v:0', '-an']),
      '-c:v', 'copy',
      ...colorTagArgs(options.color),
      ...(hasAudio ? ['-c:a', 'aac', '-b:a', '320k', '-cutoff', '18000'] : []),
      '-map_metadata', '-1',
      '-movflags', '+faststart',
      options.outputPath,
    ],
    {
      signal: options.signal,
      onStderr: (text) => {
        if (!options.onProgress || totalSeconds <= 0) return;
        const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
        if (!m) return;
        const seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
        options.onProgress(Math.min(1, seconds / totalSeconds));
      },
    },
  );

  const after = await probeStreams(options.outputPath);
  const afterMismatch = colorMismatch(after.video, options.color);
  if (afterMismatch) {
    throw new Error(`The finished file lost its colour tags in the mux (${afterMismatch}).`);
  }
  if (hasAudio && !after.audio) {
    throw new Error('The finished file lost its audio track in the mux.');
  }
  return after;
}

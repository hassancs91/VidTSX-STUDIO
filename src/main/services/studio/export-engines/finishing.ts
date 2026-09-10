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
 * Audio: PCM in, one AAC encode with Remotion's settings (320 kb/s, 18 kHz
 * cutoff) — in the mux, or earlier through `encodeExportAudio` when an engine
 * can overlap it with its frames (Stage 4), in which case the mux copies the
 * stream. ffmpeg's encoder declares its delay and the mp4 muxer writes the
 * matching edit list, so decoders start at the first real sample — the D6
 * reference (the camera file, 0 ms) instead of +42.7 ms.
 *
 * Video in: a media file, or an engine's concat LIST of pieces (`videoDemuxer`
 * `concat`, the passthrough's MPEG-TS spans): the mux then reads the pieces
 * itself, so the join and the mux are one write instead of a joined
 * intermediate copied once more. The seam stays probe → mux → probe: the
 * list probes like a file (the first piece's tags, the summed duration), and
 * the finished file's frame count is checked against what the engine counted.
 */
import { spawn } from 'child_process';
import { getFfmpegBinary, runFfmpeg } from '../ffmpeg-bin';
import type { ExportColorPolicy, ExportEngineProduct } from './types';

export type VideoDemuxer = NonNullable<ExportEngineProduct['videoDemuxer']>;

export interface FinishExportOptions {
  videoPath: string;
  /** Set when `videoPath` is a concat list rather than a media file. */
  videoDemuxer?: VideoDemuxer;
  /** The frame count the engine verified; the finished file must hold exactly this many. */
  expectedFrames?: number;
  /** The whole-timeline audio (PCM preferred); may be `videoPath` itself. */
  audioPath: string;
  outputPath: string;
  color: ExportColorPolicy;
  /** The composition's frame rate, for the index reservation when the container reports no frame count. */
  fps?: number;
  signal: AbortSignal;
  onProgress?: (fraction: number) => void;
}

/** A concat list needs its demuxer named before the input (and `-safe 0` for absolute paths); a media file needs nothing. */
export function demuxerArgs(demuxer?: VideoDemuxer): string[] {
  return demuxer === 'concat' ? ['-f', 'concat', '-safe', '0'] : [];
}

/** The input flags for a video product. */
export function videoInputArgs(videoPath: string, demuxer?: VideoDemuxer): string[] {
  return [...demuxerArgs(demuxer), '-i', videoPath];
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

export async function probeStreams(filePath: string, demuxer?: VideoDemuxer): Promise<ProbedStreams> {
  const ffprobe = await getFfmpegBinary('ffprobe');
  const output = await new Promise<string>((resolve, reject) => {
    const proc = spawn(ffprobe, ['-v', 'error', ...demuxerArgs(demuxer), '-print_format', 'json', '-show_format', '-show_streams', filePath], {
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

/** Remotion's AAC settings — the one encode every export's audio goes through. */
export const AAC_ENCODE_ARGS = ['-c:a', 'aac', '-b:a', '320k', '-cutoff', '18000'];

/**
 * The AAC encode alone, PCM in, to an mp4 container that keeps the encoder
 * delay (the m4a's edit list). Engines may run it EARLY, beside their frames
 * (Stage 4): the native encoder is single-threaded at ~8× realtime — 22 of
 * the 3 h project's 24 mux minutes — while a copying engine leaves the CPU
 * idle. The mux then stream-copies it; the settings never change.
 */
export function aacEncodeArgs(inputPath: string, outputPath: string): string[] {
  // `-f mp4` spelled out: Remotion's ffmpeg build maps no `.m4a` extension.
  return ['-y', '-hide_banner', '-nostdin', '-i', inputPath, '-vn', '-map', '0:a:0', ...AAC_ENCODE_ARGS, '-map_metadata', '-1', '-f', 'mp4', outputPath];
}

export interface EncodeExportAudioOptions {
  /** PCM (any container ffmpeg reads). */
  audioPath: string;
  /** Must end in .m4a. */
  outputPath: string;
  signal: AbortSignal;
}

export async function encodeExportAudio(options: EncodeExportAudioOptions): Promise<void> {
  const ffmpeg = await getFfmpegBinary('ffmpeg');
  await runFfmpeg(ffmpeg, aacEncodeArgs(options.audioPath, options.outputPath), { signal: options.signal });
}

export type FinishAudioMode = 'none' | 'encode' | 'copy';

export interface FinishMuxArgs {
  videoPath: string;
  videoDemuxer?: VideoDemuxer;
  audioPath: string;
  audio: FinishAudioMode;
  outputPath: string;
  color: ExportColorPolicy;
  /**
   * Bytes reserved for the moov atom at the front of the file, so the
   * index lands there in the one write. Absent → ffmpeg's faststart second
   * pass, which shifts the whole mdat: 165 s of a 10 GB file (measured
   * 2026-09-09, 224 s against 59 s with the reservation).
   */
  moovBytes?: number;
}

/** The mux: video by stream copy under the colour tags (from a file or a concat list); audio encoded here or copied when already AAC. */
export function finishMuxArgs(a: FinishMuxArgs): string[] {
  return [
    '-y', '-hide_banner', '-nostdin',
    ...videoInputArgs(a.videoPath, a.videoDemuxer),
    ...(a.audio !== 'none' ? ['-i', a.audioPath, '-map', '0:v:0', '-map', '1:a:0'] : ['-map', '0:v:0', '-an']),
    '-c:v', 'copy',
    ...colorTagArgs(a.color),
    ...(a.audio === 'encode' ? AAC_ENCODE_ARGS : a.audio === 'copy' ? ['-c:a', 'copy'] : []),
    '-map_metadata', '-1',
    ...(a.moovBytes !== undefined ? ['-moov_size', String(a.moovBytes)] : ['-movflags', '+faststart']),
    a.outputPath,
  ];
}

/** ffmpeg's own words when the reservation is too small; the mux then falls back to faststart. */
export const MOOV_TOO_SMALL = /reserved_moov_size is too small/;

/**
 * Room for the index: the 3 h product's moov measured 12.6 bytes per video
 * frame and 20.6 per AAC frame (stts/stsz/stco/ctts), so 32 per sample plus
 * 64 KiB is 1.5× headroom; the unused part is a `free` atom (140 KB on a
 * 30 s file, 12 MB on 3 h).
 */
export function reservedMoovBytes(videoFrames: number, audioFrames: number): number {
  return 32 * (Math.max(0, videoFrames) + Math.max(0, audioFrames)) + 65536;
}

/** AAC frames a mux will write for `seconds` of audio at `sampleRate` (1024 samples each, plus the priming frame). */
export function aacFrameCount(seconds: number, sampleRate: number): number {
  return Math.ceil((seconds * sampleRate) / 1024) + 2;
}

export async function finishExport(options: FinishExportOptions): Promise<ProbedStreams> {
  const before = await probeStreams(options.videoPath, options.videoDemuxer);
  const mismatch = colorMismatch(before.video, options.color);
  if (mismatch) {
    throw new Error(`The export engine returned video with the wrong colour tags (${mismatch}).`);
  }

  // A timeline with no sound keeps what every export had: no audio track.
  const audioSource = options.audioPath === options.videoPath ? before : await probeStreams(options.audioPath);
  const audio: FinishAudioMode = audioSource.audio === undefined ? 'none' : audioSource.audio.codec === 'aac' ? 'copy' : 'encode';
  const hasAudio = audio !== 'none';

  const ffmpeg = await getFfmpegBinary('ffmpeg');
  const totalSeconds = before.duration ?? 0;
  const videoFrames = options.expectedFrames ?? before.video?.frames ?? Math.ceil(totalSeconds * (options.fps ?? 60));
  const audioFrames = hasAudio ? aacFrameCount(totalSeconds, audioSource.audio?.sampleRate ?? 48000) : 0;
  const mux = (moovBytes: number | undefined) => runFfmpeg(
    ffmpeg,
    finishMuxArgs({ videoPath: options.videoPath, videoDemuxer: options.videoDemuxer, audioPath: options.audioPath, audio, outputPath: options.outputPath, color: options.color, moovBytes }),
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
  try {
    await mux(reservedMoovBytes(videoFrames, audioFrames));
  } catch (err) {
    if (options.signal.aborted || !(err instanceof Error) || !MOOV_TOO_SMALL.test(err.message)) throw err;
    // The index outgrew its room (a stream shape the estimate did not foresee): the faststart pass instead.
    await mux(undefined);
  }

  const after = await probeStreams(options.outputPath);
  const afterMismatch = colorMismatch(after.video, options.color);
  if (afterMismatch) {
    throw new Error(`The finished file lost its colour tags in the mux (${afterMismatch}).`);
  }
  if (hasAudio && !after.audio) {
    throw new Error('The finished file lost its audio track in the mux.');
  }
  if (options.expectedFrames !== undefined && after.video?.frames !== options.expectedFrames) {
    throw new Error(`The finished file has ${after.video?.frames ?? 'no'} frames instead of ${options.expectedFrames}.`);
  }
  return after;
}

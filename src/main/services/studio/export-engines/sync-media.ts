/**
 * T8 "Check this export": the ffmpeg reads the sync check needs, all with the
 * bundled (stripped) ffmpeg/ffprobe — WAV over a pipe for audio (no raw PCM
 * muxer), the rawvideo encoder over image2pipe for gray thumbnails (no
 * `select`/`fps`/`showinfo`: frames are reached by an exact seek and
 * identified by their own timestamps from `-stats_enc_pre`).
 * Every child runs at below-normal priority: the check is background work.
 */
import { spawn } from 'child_process';
import { runFfmpeg } from '../ffmpeg-bin';
import { parseWavPcm16 } from './audio-offset';
import type { SyncSize } from '../../../../shared/studio/sync-probes';
import { SYNC_AUDIO_RATE, SYNC_FRAME_STATS_FMT, parseFrameStats, type DecodedFrameTime } from './sync-measure';

export interface MediaFacts {
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  hasAudio: boolean;
}

interface ProbeJson {
  streams?: Array<{ codec_type?: string; width?: number; height?: number; r_frame_rate?: string; duration?: string }>;
  format?: { duration?: string };
}

function parseRate(value: string | undefined): number {
  const [num, den] = (value ?? '').split('/').map(Number);
  return num > 0 && den > 0 ? num / den : 0;
}

export async function probeMedia(ffprobe: string, file: string, signal?: AbortSignal): Promise<MediaFacts> {
  const stdout = await new Promise<string>((resolve, reject) => {
    const proc = spawn(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,duration:format=duration', file], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    proc.stdout.on('data', (c: Buffer) => { out += c.toString(); });
    proc.stderr.on('data', (c: Buffer) => { err += c.toString(); });
    const onAbort = () => proc.kill();
    signal?.addEventListener('abort', onAbort, { once: true });
    proc.on('error', reject);
    proc.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (code === 0) resolve(out);
      else reject(new Error(`ffprobe exited with code ${code}: ${err.trim()}`));
    });
  });
  const data = JSON.parse(stdout) as ProbeJson;
  const video = data.streams?.find((s) => s.codec_type === 'video');
  if (!video?.width || !video.height) throw new Error(`No video stream in ${file}`);
  const durationSec = Number(data.format?.duration ?? video.duration ?? 0);
  return {
    width: video.width,
    height: video.height,
    fps: parseRate(video.r_frame_rate),
    durationSec: Number.isFinite(durationSec) ? durationSec : 0,
    hasAudio: data.streams?.some((s) => s.codec_type === 'audio') ?? false,
  };
}

/**
 * The whole file's audio at 8 kHz mono, sample 0 = time 0. `first_pts=0`
 * pads a late-starting stream with silence — without it a WAV pipe drops the
 * gap (an `-itsoffset 0.1` file would lose its 100 ms).
 */
export async function decodeWholeAudio(ffmpeg: string, file: string, signal?: AbortSignal): Promise<Float32Array> {
  const chunks: Buffer[] = [];
  await runFfmpeg(
    ffmpeg,
    ['-v', 'error', '-nostdin', '-i', file, '-vn', '-af', 'aresample=async=1:first_pts=0', '-ac', '1', '-ar', String(SYNC_AUDIO_RATE), '-f', 'wav', '-acodec', 'pcm_s16le', '-'],
    { signal, priority: 'below-normal', onStdout: (chunk) => chunks.push(chunk) },
  );
  return parseWavPcm16(Buffer.concat(chunks));
}

/** `durationSec` of a file's audio from `startSec` (accurate input seek), 8 kHz mono. */
export async function decodeAudioSpan(ffmpeg: string, file: string, startSec: number, durationSec: number, signal?: AbortSignal): Promise<Float32Array> {
  const chunks: Buffer[] = [];
  await runFfmpeg(
    ffmpeg,
    ['-v', 'error', '-nostdin', '-ss', startSec.toFixed(6), '-i', file, '-t', durationSec.toFixed(6), '-vn', '-ac', '1', '-ar', String(SYNC_AUDIO_RATE), '-f', 'wav', '-acodec', 'pcm_s16le', '-'],
    { signal, priority: 'below-normal', onStdout: (chunk) => chunks.push(chunk) },
  );
  return parseWavPcm16(Buffer.concat(chunks));
}

export interface GrayFrames {
  frames: Uint8Array[];
  /** Each frame's own time in the file, read from ffmpeg's per-frame stats (same order as `frames`). */
  times: DecodedFrameTime[];
}

/**
 * Up to `count` consecutive frames from `seekSec`, through `filter` (crop →
 * thumb → gray), one Uint8Array each, with each frame's real timestamp.
 * `-fps_mode passthrough` stops the image2pipe muxer's constant-rate fill
 * (it repeated the first frame on ~1/3 of seeks); the timestamps come from
 * `-stats_enc_pre` on stderr (no showinfo/framecrc in the bundled build), and
 * a frame without one fails the read rather than being guessed.
 */
export async function grabGrayFrames(
  ffmpeg: string,
  file: string,
  seekSec: number,
  count: number,
  filter: string,
  thumb: SyncSize,
  signal?: AbortSignal,
): Promise<GrayFrames> {
  const chunks: Buffer[] = [];
  let stats = '';
  const seek = seekSec.toFixed(6);
  await runFfmpeg(
    ffmpeg,
    [
      '-v', 'error', '-nostdin', '-ss', seek, '-i', file, '-an', '-frames:v', String(count), '-fps_mode', 'passthrough', '-vf', filter,
      '-stats_enc_pre', 'pipe:2', '-stats_enc_pre_fmt', SYNC_FRAME_STATS_FMT,
      '-f', 'image2pipe', '-vcodec', 'rawvideo', '-pix_fmt', 'gray', '-',
    ],
    { signal, priority: 'below-normal', onStdout: (chunk) => chunks.push(chunk), onStderr: (text) => { stats += text; } },
  );
  const all = Buffer.concat(chunks);
  const size = thumb.width * thumb.height;
  const frames: Uint8Array[] = [];
  for (let at = 0; at + size <= all.length; at += size) frames.push(new Uint8Array(all.subarray(at, at + size)));
  const times = parseFrameStats(stats, Number(seek));
  if (times.length !== frames.length) {
    throw new Error(`Could not read the frame times of ${file} at ${seek} s (${frames.length} frames, ${times.length} times).`);
  }
  return { frames, times };
}

// The one ffmpeg / ffprobe spawn path for the flow product nodes (W8 Stage 3,
// docs/flows-plan.md §6). The binaries are Remotion's, resolved the way every
// other main service resolves them — `RenderInternals.getExecutablePath` with
// `getRemotionBinariesDir()` from `utils/paths.ts` (null in dev, the unpacked
// asar folder when packaged). Abort kills the process; progress is read off
// stderr's `time=` lines so a long trim or concat can report into a node's
// run log.

import { spawn } from 'child_process';
import { getRemotionBinariesDir } from '../../utils/paths';

export type FfmpegBinary = 'ffmpeg' | 'ffprobe';

async function binaryPath(type: FfmpegBinary): Promise<string> {
  const { RenderInternals } = await import('@remotion/renderer');
  return RenderInternals.getExecutablePath({
    type,
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });
}

/** ffmpeg on Windows takes forward slashes everywhere; backslashes break `%d` patterns. */
export function toFfmpegPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export interface RunFfmpegOptions {
  signal?: AbortSignal;
  /** Called with the output position in seconds as ffmpeg reports it. */
  onProgress?: (seconds: number) => void;
}

function parseTime(chunk: string): number | null {
  const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(chunk);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * Run ffmpeg to completion. `-hide_banner -nostdin -y` are prepended so no
 * caller has to remember them; the caller supplies inputs, filters and the
 * output. Rejects with the last stderr lines on a non-zero exit, and with
 * "Cancelled." when the signal fires.
 */
export async function runFfmpeg(args: string[], opts: RunFfmpegOptions = {}): Promise<void> {
  if (opts.signal?.aborted) throw new Error('Cancelled.');
  const exe = await binaryPath('ffmpeg');
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(exe, ['-hide_banner', '-nostdin', '-y', ...args], {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    let cancelled = false;
    const onAbort = () => {
      cancelled = true;
      proc.kill('SIGTERM');
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr = (stderr + text).slice(-4000);
      const seconds = parseTime(text);
      if (seconds !== null) opts.onProgress?.(seconds);
    });
    proc.on('error', (err) => {
      opts.signal?.removeEventListener('abort', onAbort);
      reject(new Error(`Failed to start ffmpeg: ${err.message}`));
    });
    proc.on('close', (code) => {
      opts.signal?.removeEventListener('abort', onAbort);
      if (cancelled) reject(new Error('Cancelled.'));
      else if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.split('\n').filter(Boolean).slice(-6).join(' | ')}`));
    });
  });
}

export interface MediaProbe {
  /** Container duration in seconds; 0 when unknown. */
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

interface ProbeJson {
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    avg_frame_rate?: string;
  }>;
  format?: { duration?: string };
}

function parseFps(rate: string | undefined): number {
  if (!rate) return 0;
  const [num, den] = rate.split('/').map(Number);
  if (Number.isFinite(num) && Number.isFinite(den) && den > 0) return Math.round((num / den) * 100) / 100;
  return Number.isFinite(num) ? num : 0;
}

/** Streams and duration of a media file — what a trim, concat or frame grab needs to know first. */
export async function probeMedia(filePath: string): Promise<MediaProbe> {
  const exe = await binaryPath('ffprobe');
  const json = await new Promise<string>((resolve, reject) => {
    const proc = spawn(
      exe,
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', toFfmpegPath(filePath)],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
    proc.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
    proc.on('error', (err) => reject(new Error(`Failed to start ffprobe: ${err.message}`)));
    proc.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`ffprobe exited with code ${code}: ${stderr.trim()}`))));
  });
  const data = JSON.parse(json) as ProbeJson;
  const video = data.streams?.find((s) => s.codec_type === 'video');
  const audio = data.streams?.find((s) => s.codec_type === 'audio');
  const duration = Number.parseFloat(data.format?.duration ?? '0');
  return {
    duration: Number.isFinite(duration) ? duration : 0,
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    fps: parseFps(video?.r_frame_rate ?? video?.avg_frame_rate),
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
  };
}

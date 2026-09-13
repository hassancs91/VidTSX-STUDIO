/**
 * What the passthrough engine must know about a source that the document
 * cannot tell it: the exact frame rate (`r_frame_rate` as a fraction — the
 * document's `probe.fps` is a rounded float, and the nearest-pts select needs
 * the rational), whether the rate is constant (a VFR file cannot be indexed by
 * pts), where its timestamps start (the select works on absolute pts), and
 * its time base (the slow-motion select works in the stream's integer ticks,
 * as the compositor does). Probed once per distinct source per export, with
 * the full build's ffprobe.
 */
import { spawn } from 'child_process';
import path from 'path';
import { parseFrameRate, type FrameRate } from './passthrough-ffmpeg';

export interface SourceProbe {
  frameRate: FrameRate;
  averageFrameRate: FrameRate;
  startTime: number;
  /** The video stream's time base as num/den (1/60000 on the DJI files). */
  timeBase: FrameRate;
  hasAudio: boolean;
  /** The video stream's pixel format as ffprobe names it (`yuv420p10le` on the DJI files, `yuv420p` on a proxy). */
  pixelFormat?: string;
}

/** ffprobe.exe sits beside the full build's ffmpeg.exe. */
export function ffprobeBeside(ffmpeg: string): string {
  return path.join(path.dirname(ffmpeg), path.basename(ffmpeg).replace(/ffmpeg/i, 'ffprobe'));
}

interface Stream {
  codec_type?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  start_time?: string;
  time_base?: string;
  pix_fmt?: string;
}

export async function probeSource(ffprobe: string, file: string, signal?: AbortSignal): Promise<SourceProbe> {
  const output = await new Promise<string>((resolve, reject) => {
    const proc = spawn(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_entries', 'stream=codec_type,r_frame_rate,avg_frame_rate,start_time,time_base,pix_fmt', file], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c: Buffer) => { stdout += c.toString(); });
    proc.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
    const onAbort = () => proc.kill();
    signal?.addEventListener('abort', onAbort, { once: true });
    proc.on('error', reject);
    proc.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (code === 0) resolve(stdout);
      else reject(new Error(`ffprobe exited with code ${code}: ${stderr.trim()}`));
    });
  });
  const data = JSON.parse(output) as { streams?: Stream[] };
  const video = data.streams?.find((s) => s.codec_type === 'video');
  if (!video) throw new Error(`No video stream in ${file}`);
  const frameRate = parseFrameRate(video.r_frame_rate);
  const averageFrameRate = parseFrameRate(video.avg_frame_rate) ?? frameRate;
  if (!frameRate || !averageFrameRate) throw new Error(`Unreadable frame rate for ${file}`);
  const timeBase = parseFrameRate(video.time_base);
  if (!timeBase) throw new Error(`Unreadable time base for ${file}`);
  const startTime = video.start_time ? Number(video.start_time) : 0;
  return {
    frameRate,
    averageFrameRate,
    startTime: Number.isFinite(startTime) ? startTime : 0,
    timeBase,
    hasAudio: data.streams?.some((s) => s.codec_type === 'audio') ?? false,
    ...(video.pix_fmt ? { pixelFormat: video.pix_fmt } : {}),
  };
}

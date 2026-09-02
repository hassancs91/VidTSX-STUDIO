import { spawn } from 'child_process';
import type { ProxySegment } from './proxy-segments';

/**
 * Timing facts the join needs, read from a container header (no decode).
 * Segments are encoded with `-copyts`, so a segment's `startSec` is the source
 * timestamp of its first frame — which is what makes the join exact.
 */
export interface MediaTiming {
  startSec: number;
  durationSec: number;
  videoStartSec: number | null;
  audioStartSec: number | null;
}

interface FfprobeTiming {
  streams?: { codec_type?: string; start_time?: string }[];
  format?: { start_time?: string; duration?: string };
}

export async function readTiming(ffprobe: string, file: string): Promise<MediaTiming> {
  const json = await new Promise<string>((resolve, reject) => {
    const proc = spawn(ffprobe, [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,start_time:format=start_time,duration',
      '-of',
      'json',
      file,
    ]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    proc.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`ffprobe exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
  const data = JSON.parse(json) as FfprobeTiming;
  const num = (v: string | undefined): number | null => {
    const n = v === undefined ? Number.NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const first = (type: string) => data.streams?.find((s) => s.codec_type === type);
  return {
    startSec: num(data.format?.start_time) ?? 0,
    durationSec: num(data.format?.duration) ?? 0,
    videoStartSec: num(first('video')?.start_time),
    audioStartSec: num(first('audio')?.start_time),
  };
}

export interface ConcatEntry {
  fileName: string;
  durationSec: number;
}

/**
 * Explicit durations for the concat demuxer, so each file's offset is the
 * source-time distance to the next file's first frame rather than whatever
 * the container claims. Measured (2026-09-02): mp4 container durations of
 * x264 B-frame segments run one frame long at some joins, which shifted every
 * later frame by a frame; with `-copyts` starts the sequence matched the
 * single-pass transcode frame for frame.
 */
export function planConcatEntries(plan: ProxySegment[], timings: MediaTiming[]): ConcatEntry[] {
  if (timings.length !== plan.length) {
    throw new Error(`Concat plan mismatch: ${plan.length} segments, ${timings.length} timings`);
  }
  return plan.map((segment, i) => {
    const last = i === plan.length - 1;
    const durationSec = last ? timings[i].durationSec : timings[i + 1].startSec - timings[i].startSec;
    if (!(durationSec > 0)) {
      throw new Error(`Segment ${segment.fileName} has a non-positive span (${durationSec})`);
    }
    return { fileName: segment.fileName, durationSec };
  });
}

/** Offset to put the video input at so it lines up with the single-pass audio
 *  track — only non-zero when the source's streams do not start together. */
export function videoOffsetSec(source: MediaTiming): number {
  if (source.videoStartSec === null || source.audioStartSec === null) return 0;
  const diff = source.videoStartSec - source.audioStartSec;
  return Math.abs(diff) > 0.001 ? diff : 0;
}

import fs from 'fs/promises';
import path from 'path';
import { getProjectCacheDir } from './studio-paths';
import { getFfmpegBinary, runFfmpeg } from './ffmpeg-bin';

export const WAVEFORM_DIR = 'waveforms';

/** Peak buckets per second. 50 is ~1 bucket per 1.5 px at default zoom —
 *  enough shape to spot pauses, small enough to keep the JSON light. */
export const PEAKS_PER_SECOND = 50;
const SAMPLE_RATE = 8000;
const SAMPLES_PER_PEAK = SAMPLE_RATE / PEAKS_PER_SECOND;

export interface WaveformFile {
  version: 1;
  peaksPerSecond: number;
  /** Normalized 0..1 peak per bucket, covering the whole source. */
  peaks: number[];
}

export function waveformRelPath(assetId: string): string {
  return `${WAVEFORM_DIR}/${assetId}.json`;
}

/**
 * Byte offset of the WAV `data` payload, or null if `buf` is still too short.
 *
 * Chunks are walked properly rather than searching for the literal "data":
 * piped WAV from ffmpeg carries a LIST/INFO chunk full of text before the
 * samples, and a naive search can land inside it.
 */
export function findWavDataOffset(buf: Buffer): number | null {
  if (buf.length < 12) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Unexpected audio output: not a RIFF/WAVE stream');
  }
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'data') return pos + 8;
    // Streamed chunks may carry a placeholder length; anything unwalkable
    // means we can't trust the layout.
    if (size === 0xffffffff || size > buf.length + 1_000_000) {
      throw new Error('Unexpected audio output: unwalkable WAV chunk layout');
    }
    pos += 8 + size + (size % 2);
  }
  return null;
}

/**
 * Decode the asset to mono 8 kHz PCM and reduce it to per-bucket peaks. Peaks
 * (not RMS) because the timeline's job is showing where sound *is* — the RMS
 * noise-floor analysis that drives auto-cut is a separate S3 concern.
 */
export async function generateWaveform(
  projectId: string,
  assetId: string,
  sourcePath: string,
  signal?: AbortSignal,
): Promise<string> {
  const ffmpeg = await getFfmpegBinary('ffmpeg');
  const peaks: number[] = [];

  let bucketPeak = 0;
  let samplesInBucket = 0;
  let carry: Buffer | null = null;
  let header: Buffer | null = Buffer.alloc(0);

  const takeSamples = (buffer: Buffer) => {
    const usable = buffer.length - (buffer.length % 2);
    // A 16-bit sample can straddle a chunk boundary — keep the odd byte over.
    carry = usable < buffer.length ? buffer.subarray(usable) : null;
    for (let i = 0; i < usable; i += 2) {
      const amplitude = Math.abs(buffer.readInt16LE(i)) / 32768;
      if (amplitude > bucketPeak) bucketPeak = amplitude;
      if (++samplesInBucket >= SAMPLES_PER_PEAK) {
        peaks.push(Math.round(bucketPeak * 1000) / 1000);
        bucketPeak = 0;
        samplesInBucket = 0;
      }
    }
  };

  const consume = (chunk: Buffer) => {
    if (header !== null) {
      header = Buffer.concat([header, chunk]);
      const offset = findWavDataOffset(header);
      if (offset === null) return;
      const rest = header.subarray(offset);
      header = null;
      takeSamples(rest);
      return;
    }
    takeSamples(carry ? Buffer.concat([carry, chunk]) : chunk);
  };

  await runFfmpeg(
    ffmpeg,
    [
      '-hide_banner',
      '-nostdin',
      '-i',
      sourcePath,
      '-vn',
      '-map_metadata',
      '-1',
      '-ac',
      '1',
      '-ar',
      String(SAMPLE_RATE),
      // This ffmpeg is Remotion's stripped build: it has no raw s16le muxer,
      // so PCM comes out wrapped in WAV and the header is parsed off above.
      '-c:a',
      'pcm_s16le',
      '-f',
      'wav',
      '-',
    ],
    { signal, onStdout: consume },
  );

  if (samplesInBucket > 0) peaks.push(Math.round(bucketPeak * 1000) / 1000);

  const cacheDir = await getProjectCacheDir(projectId);
  const outputPath = path.join(cacheDir, WAVEFORM_DIR, `${assetId}.json`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const file: WaveformFile = { version: 1, peaksPerSecond: PEAKS_PER_SECOND, peaks };
  await fs.writeFile(outputPath, JSON.stringify(file), 'utf-8');
  return waveformRelPath(assetId);
}

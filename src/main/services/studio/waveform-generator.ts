import fs from 'fs/promises';
import path from 'path';
import type { WaveformFile } from '../../../shared/types/studio-waveform';
import { PEAKS_PER_SECOND, RMS_SILENCE_DB } from '../../../shared/types/studio-waveform';
import { getProjectCacheDir } from './studio-paths';
import { getFfmpegBinary, runFfmpeg } from './ffmpeg-bin';

export const WAVEFORM_DIR = 'waveforms';

const SAMPLE_RATE = 8000;
const SAMPLES_PER_PEAK = SAMPLE_RATE / PEAKS_PER_SECOND;

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

function bucketRmsDb(sumSquares: number, count: number): number {
  if (count === 0) return RMS_SILENCE_DB;
  const rms = Math.sqrt(sumSquares / count) / 32768;
  if (rms <= 0) return RMS_SILENCE_DB;
  return Math.max(RMS_SILENCE_DB, Math.round(20 * Math.log10(rms) * 10) / 10);
}

/**
 * Decode the asset to mono 8 kHz PCM and reduce it to per-bucket peaks (what
 * the timeline draws — where sound *is*) plus per-bucket RMS dB (what the
 * auto-cut noise-floor / snap-to-audio analysis reads). Both are computed in
 * TypeScript from the piped samples because Remotion's stripped ffmpeg has no
 * volumedetect filter to lean on.
 */
export async function generateWaveform(
  projectId: string,
  assetId: string,
  sourcePath: string,
  signal?: AbortSignal,
): Promise<string> {
  const ffmpeg = await getFfmpegBinary('ffmpeg');
  const peaks: number[] = [];
  const rmsDb: number[] = [];

  let bucketPeak = 0;
  let bucketSumSquares = 0;
  let samplesInBucket = 0;
  let carry: Buffer | null = null;
  let header: Buffer | null = Buffer.alloc(0);

  const takeSamples = (buffer: Buffer) => {
    const usable = buffer.length - (buffer.length % 2);
    // A 16-bit sample can straddle a chunk boundary — keep the odd byte over.
    carry = usable < buffer.length ? buffer.subarray(usable) : null;
    for (let i = 0; i < usable; i += 2) {
      const sample = buffer.readInt16LE(i);
      const amplitude = Math.abs(sample) / 32768;
      if (amplitude > bucketPeak) bucketPeak = amplitude;
      bucketSumSquares += sample * sample;
      if (++samplesInBucket >= SAMPLES_PER_PEAK) {
        peaks.push(Math.round(bucketPeak * 1000) / 1000);
        rmsDb.push(bucketRmsDb(bucketSumSquares, samplesInBucket));
        bucketPeak = 0;
        bucketSumSquares = 0;
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

  if (samplesInBucket > 0) {
    peaks.push(Math.round(bucketPeak * 1000) / 1000);
    rmsDb.push(bucketRmsDb(bucketSumSquares, samplesInBucket));
  }

  const cacheDir = await getProjectCacheDir(projectId);
  const outputPath = path.join(cacheDir, WAVEFORM_DIR, `${assetId}.json`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const file: WaveformFile = { version: 2, peaksPerSecond: PEAKS_PER_SECOND, peaks, rmsDb };
  await fs.writeFile(outputPath, JSON.stringify(file), 'utf-8');
  return waveformRelPath(assetId);
}

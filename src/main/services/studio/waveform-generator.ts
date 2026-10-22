import fs from 'fs/promises';
import path from 'path';
import type { WaveformFile } from '../../../shared/types/studio-waveform';
import {
  PEAKS_PER_SECOND,
  WAVEFORM_SAMPLE_RATE,
  WAVEFORM_VERSION,
} from '../../../shared/types/studio-waveform';
import { getProjectCacheDir } from './studio-paths';
import { getFfmpegBinary, runFfmpeg } from './ffmpeg-bin';
import { WaveformBucketizer } from './waveform-buckets';

export const WAVEFORM_DIR = 'waveforms';

const SAMPLE_RATE = WAVEFORM_SAMPLE_RATE;
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

/**
 * True when a cached waveform predates the current format (no `zcr`, 8 kHz
 * levels) and should be regenerated. Reads only the head of the file —
 * `version` is the first key the generator writes. Unreadable ⇒ stale.
 */
export async function isWaveformStale(filePath: string): Promise<boolean> {
  try {
    const handle = await fs.open(filePath, 'r');
    try {
      const head = Buffer.alloc(64);
      const { bytesRead } = await handle.read(head, 0, head.length, 0);
      const match = /"version"\s*:\s*(\d+)/.exec(head.toString('utf-8', 0, bytesRead));
      return !match || Number(match[1]) < WAVEFORM_VERSION;
    } finally {
      await handle.close();
    }
  } catch {
    return true;
  }
}

/**
 * Decode the asset to mono 16 kHz PCM and reduce it to per-bucket peaks (what
 * the timeline draws — where sound *is*), RMS dB and zero crossings per second
 * (what the auto-cut noise-floor / snap-to-audio / fricative analysis reads;
 * cutlib reads 16 kHz WAVs, and fricatives live above 8 kHz audio's 4 kHz
 * Nyquist). Computed in TypeScript from the piped samples because Remotion's
 * stripped ffmpeg has no volumedetect filter to lean on.
 */
export async function generateWaveform(
  projectId: string,
  assetId: string,
  sourcePath: string,
  signal?: AbortSignal,
): Promise<string> {
  const ffmpeg = await getFfmpegBinary('ffmpeg');
  const buckets = new WaveformBucketizer(SAMPLE_RATE, SAMPLES_PER_PEAK);
  let header: Buffer | null = Buffer.alloc(0);

  const consume = (chunk: Buffer) => {
    if (header !== null) {
      header = Buffer.concat([header, chunk]);
      const offset = findWavDataOffset(header);
      if (offset === null) return;
      const rest = header.subarray(offset);
      header = null;
      buckets.push(rest);
      return;
    }
    buckets.push(chunk);
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
    { signal, onStdout: consume, priority: 'below-normal' },
  );

  const { peaks, rmsDb, zcr } = buckets.finish();
  const cacheDir = await getProjectCacheDir(projectId);
  const outputPath = path.join(cacheDir, WAVEFORM_DIR, `${assetId}.json`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const file: WaveformFile = {
    version: WAVEFORM_VERSION,
    peaksPerSecond: PEAKS_PER_SECOND,
    peaks,
    rmsDb,
    zcr,
  };
  await fs.writeFile(outputPath, JSON.stringify(file), 'utf-8');
  return waveformRelPath(assetId);
}

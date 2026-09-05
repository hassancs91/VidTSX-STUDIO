/**
 * The T1 audio-offset instrument in product form (scripts/bench/
 * t1-audio-offset.mjs): both files decoded to 48 kHz mono float PCM, then for
 * each window start (seconds in the reference) one second of the reference is
 * slid over the candidate within ±120 ms and the lag with the highest
 * normalised cross-correlation wins. A correct join reports ~0 ms at every
 * window; an AAC priming gap shows as a constant lag, a dropped frame at a
 * seam as a lag that changes across it.
 */
import { runFfmpeg } from '../ffmpeg-bin';

export const AUDIO_RATE = 48_000;
const MAX_LAG_MS = 120;

export interface AudioOffsetRow {
  window: number;
  lagMs?: number;
  lagSamples?: number;
  corr?: number;
  skipped?: boolean;
}

/** Pure: lag (samples) at which `cand` best matches `ref` for one window. */
export function bestLag(
  ref: Float32Array,
  cand: Float32Array,
  refStart: number,
  candStart: number,
  len: number,
  maxLag: number,
): { lag: number; corr: number } {
  let best = { lag: 0, corr: -2 };
  const rs = ref.subarray(refStart, refStart + len);
  let rr = 0;
  for (let i = 0; i < len; i++) rr += rs[i] * rs[i];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const cs = candStart + lag;
    if (cs < 0 || cs + len > cand.length) continue;
    let rc = 0;
    let cc = 0;
    for (let i = 0; i < len; i++) {
      const c = cand[cs + i];
      rc += rs[i] * c;
      cc += c * c;
    }
    const corr = rc / Math.sqrt(rr * cc + 1e-12);
    if (corr > best.corr) best = { lag, corr };
  }
  return best;
}

/**
 * Pure: one row per window. `bOffsetSec` is where the candidate's timeline
 * starts relative to the reference (a clip cut from source time S and placed
 * at timeline time T has bOffset = S − T when the source is the reference).
 */
export function audioOffsetRows(
  ref: Float32Array,
  cand: Float32Array,
  windowsSec: readonly number[],
  bOffsetSec = 0,
  rate = AUDIO_RATE,
): AudioOffsetRow[] {
  const len = rate;
  const maxLag = Math.round((MAX_LAG_MS / 1000) * rate);
  return windowsSec.map((w) => {
    const refStart = Math.round(w * rate);
    const candStart = Math.round((w - bOffsetSec) * rate);
    if (refStart < 0 || refStart + len > ref.length || candStart < 0 || candStart + len > cand.length) {
      return { window: w, skipped: true };
    }
    const r = bestLag(ref, cand, refStart, candStart, len, maxLag);
    return {
      window: w,
      lagMs: Math.round((r.lag / rate) * 10000) / 10,
      lagSamples: r.lag,
      corr: Math.round(r.corr * 1000) / 1000,
    };
  });
}

/** Pure: the samples of a 16-bit mono WAV byte stream as floats in [-1, 1]. A piped WAV carries placeholder sizes, so the data chunk runs to the end. */
export function parseWavPcm16(wav: Buffer): Float32Array {
  const marker = wav.indexOf('data', 12, 'ascii');
  if (marker < 0) throw new Error('WAV stream has no data chunk');
  const start = marker + 8;
  const count = Math.floor((wav.length - start) / 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = wav.readInt16LE(start + i * 2) / 32768;
  return out;
}

/** Decode a file's audio to 48 kHz mono float PCM (WAV over a pipe — the bundled ffmpeg has no raw f32 muxer). */
export async function decodePcm(ffmpeg: string, file: string, signal?: AbortSignal): Promise<Float32Array> {
  const chunks: Buffer[] = [];
  await runFfmpeg(
    ffmpeg,
    ['-v', 'error', '-nostdin', '-i', file, '-vn', '-ac', '1', '-ar', String(AUDIO_RATE), '-f', 'wav', '-acodec', 'pcm_s16le', '-'],
    { signal, onStdout: (chunk) => chunks.push(chunk) },
  );
  return parseWavPcm16(Buffer.concat(chunks));
}

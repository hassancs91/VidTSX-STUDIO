// Loudness normalization of a generated sound (T6 / Q2, E-d7, E-d11): −20 LUFS integrated under a −1.5 dBTP
// ceiling, the `gen_sfx.py` rule (audio-loudness-rule.ts), on the BUNDLED ffmpeg — which has `loudnorm` (its
// analysis pass prints integrated loudness + TRUE peak as JSON) and `volume`, but no `ebur128` / `astats` /
// `volumedetect` / `alimiter`. Measure → plan → re-encode the ORIGINAL with `volume=<gain>dB` into a temp file (same
// extension) → re-measure the TEMP. The ceiling is a property of the ENCODED file (E-d11): when a lossy encode lands
// the true peak over it, re-encode from the ORIGINAL with less gain (at most two corrective passes — one lossy
// generation only), then rename the chosen temp over the original. Never throws and never loses the generated
// bytes: a failure leaves the original in place and says so in the result.

import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { getFfmpegBinary, runFfmpeg } from '../studio/ffmpeg-bin';
import {
  correctiveGain,
  isOverCeiling,
  LOUDNESS_CEILING_DBFS,
  LOUDNESS_MAX_CORRECTIVE_PASSES,
  LOUDNESS_TARGET_LUFS,
  parseLoudnormStats,
  planLoudnessGain,
  type LoudnessGainPlan,
  type LoudnessStats,
} from './audio-loudness-rule';

const log = logEngine.createLogger('AudioNormalize');

/** Each ffmpeg pass must finish within this; a hung process never holds a generation. */
export const NORMALIZE_TIMEOUT_MS = 120_000;
/** mp3 is re-encoded one step above ElevenLabs' default `mp3_44100_128`, so the second lossy generation adds little. */
export const NORMALIZE_MP3_BITRATE = '192k';
/** `normalizeError` is ONE line of at most this many characters (the full ffmpeg stderr goes to the log only). */
export const NORMALIZE_ERROR_MAX_CHARS = 200;

/** Encoder + muxer per extension (the bundled build's audio encoders: libmp3lame, aac, libopus, pcm_s16le). */
const ENCODE_BY_EXT: Record<string, string[]> = {
  '.mp3': ['-c:a', 'libmp3lame', '-b:a', NORMALIZE_MP3_BITRATE, '-f', 'mp3'],
  '.wav': ['-c:a', 'pcm_s16le', '-f', 'wav'],
  '.m4a': ['-c:a', 'aac', '-b:a', '192k', '-f', 'mp4'],
  '.aac': ['-c:a', 'aac', '-b:a', '192k', '-f', 'adts'],
  '.ogg': ['-c:a', 'libopus', '-b:a', '128k', '-f', 'ogg'],
  '.opus': ['-c:a', 'libopus', '-b:a', '128k', '-f', 'opus'],
};

export interface AudioNormalizeOptions {
  targetLufs?: number;
  ceilingDbfs?: number;
  signal?: AbortSignal;
}

export interface AudioLoudnessReading {
  /** Integrated loudness, LUFS. Absent when nothing passed the gate. */
  loudnessLufs?: number;
  /** TRUE peak, dBTP (`loudnorm`'s `input_tp`). Absent for digital silence. */
  peakDbfs?: number;
}

export interface AudioNormalizeResult extends AudioLoudnessReading {
  /** True = the file is at the policy (gain applied, or nothing to apply). False = kept as generated; see `error`. */
  normalized: boolean;
  /** The gain actually applied to the original, dB (0 when none) — the corrective pass's when one ran. */
  gainDb: number;
  clamped: boolean;
  gated: boolean;
  skipped: boolean;
  /** E-d11: re-encodes after the first because the encoded peak was over the ceiling (absent when nothing was encoded). */
  correctivePasses?: number;
  /** E-d11: still over the ceiling after every corrective pass (not expected) — the lowest-peak encode was kept. */
  overCeiling?: true;
  /** Why the file was left un-normalized — ONE line (`summarizeFfmpegError`). */
  error?: string;
  /** What the file measured before the step (absent when the measure pass itself failed). */
  before?: AudioLoudnessReading;
}

interface PassSignal {
  signal: AbortSignal;
  timedOut: () => boolean;
  dispose: () => void;
}

function passSignal(parent: AbortSignal | undefined): PassSignal {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, NORMALIZE_TIMEOUT_MS);
  const onParent = () => ctrl.abort();
  if (parent?.aborted) ctrl.abort();
  else parent?.addEventListener('abort', onParent, { once: true });
  return {
    signal: ctrl.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onParent);
    },
  };
}

async function runPass(args: string[], parent: AbortSignal | undefined, onStderr?: (text: string) => void): Promise<void> {
  const ffmpeg = await getFfmpegBinary('ffmpeg');
  const pass = passSignal(parent);
  try {
    await runFfmpeg(ffmpeg, ['-hide_banner', '-nostdin', '-nostats', '-y', ...args], { signal: pass.signal, onStderr });
  } catch (err) {
    if (pass.timedOut()) throw new Error(`ffmpeg timed out after ${NORMALIZE_TIMEOUT_MS / 1000} s`);
    throw err;
  } finally {
    pass.dispose();
  }
}

const loudnormFilter = (target: number, ceiling: number) => `loudnorm=I=${target}:TP=${ceiling}:LRA=11:print_format=json`;

/** ONE `loudnorm` analysis pass: integrated loudness (LUFS) and TRUE peak (dBTP) of the file as it is. */
export async function measureLoudness(absPath: string, opts: AudioNormalizeOptions = {}): Promise<LoudnessStats> {
  let tail = '';
  const filter = loudnormFilter(opts.targetLufs ?? LOUDNESS_TARGET_LUFS, opts.ceilingDbfs ?? LOUDNESS_CEILING_DBFS);
  await runPass(['-i', absPath, '-vn', '-af', filter, '-f', 'null', '-'], opts.signal, (text) => {
    tail = (tail + text).slice(-16_000);
  });
  const stats = parseLoudnormStats(tail);
  if (!stats) throw new Error('loudnorm printed no stats');
  return stats;
}

/** ONE re-encode of `srcPath` with `volume=<gain>dB` into `outPath` — the codec by the source's extension. */
async function encodeWithGain(srcPath: string, outPath: string, gainDb: number, signal?: AbortSignal): Promise<void> {
  const ext = path.extname(srcPath).toLowerCase();
  const encode = ENCODE_BY_EXT[ext];
  if (!encode) throw new Error(`unsupported container "${ext || '(none)'}"`);
  await runPass(['-i', srcPath, '-vn', '-af', `volume=${gainDb}dB`, ...encode, outPath], signal);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));
const reading = (s: LoudnessStats): AudioLoudnessReading => ({
  ...(Number.isFinite(s.integratedLufs) ? { loudnessLufs: round2(s.integratedLufs) } : {}),
  ...(Number.isFinite(s.truePeakDbtp) ? { peakDbfs: round2(s.truePeakDbtp) } : {}),
});
/** Pass n's output beside the original (same extension, so the muxer and a later probe agree). */
const tempPath = (absPath: string, n: number) => `${absPath}.norm-tmp${n === 0 ? '' : n}${path.extname(absPath).toLowerCase()}`;
const removeQuietly = (paths: string[]) => Promise.all(paths.map((p) => fs.rm(p, { force: true }).catch(() => undefined)));

/** The words that make an ffmpeg stderr line the explanation (warnings and stream info lines carry none of them). */
const ERROR_LINE = /error|invalid|no decoder|not found|unsupported|failed|could not|cannot|unable|denied|no such/i;

/**
 * ONE line for `normalizeError` (N2): from an `ffmpeg exited with code N: <stderr>` message, the FIRST stderr line
 * that reads as an error (the `[ctx @ 0x…]` prefix stripped; banner / stream-info / warning lines skipped), else the
 * last line; the file's absolute path shortened to its name; capped at NORMALIZE_ERROR_MAX_CHARS.
 */
export function summarizeFfmpegError(message: string, absPath?: string): string {
  const exited = /^ffmpeg exited with code -?\d+:\s*([\s\S]*)$/.exec(message);
  const lines = (exited ? exited[1] : message)
    .split(/\r?\n|\r/)
    .map((l) => l.replace(/^\[[^\]]*@\s*(0x)?[0-9a-fA-F]+\]\s*/, '').trim())
    .filter(Boolean);
  let line = lines.find((l) => ERROR_LINE.test(l)) ?? lines[lines.length - 1] ?? message.trim();
  if (absPath) line = line.split(absPath).join(path.basename(absPath));
  if (exited) line = `ffmpeg: ${line}`;
  return line.length > NORMALIZE_ERROR_MAX_CHARS ? `${line.slice(0, NORMALIZE_ERROR_MAX_CHARS - 1)}…` : line;
}

interface EncodedPass {
  tmp: string;
  gainDb: number;
  after: AudioLoudnessReading;
  /** The temp's true peak, dBTP — measured, or predicted when its measure pass failed. */
  peak: number;
  measured: boolean;
}

async function measureEncoded(tmp: string, before: LoudnessStats, gainDb: number, opts: AudioNormalizeOptions) {
  try {
    const s = await measureLoudness(tmp, opts);
    return { after: reading(s), peak: s.truePeakDbtp, measured: true };
  } catch (err) {
    // Encoded but not re-measured: the gain is linear, so record the predicted values and say so in the log.
    log.warn('Loudness re-measure failed — recording the predicted values', { tmp, error: messageOf(err) });
    const predicted = { integratedLufs: before.integratedLufs + gainDb, truePeakDbtp: before.truePeakDbtp + gainDb };
    return { after: reading(predicted), peak: predicted.truePeakDbtp, measured: false };
  }
}

/**
 * E-d11: encode the ORIGINAL with the planned gain, re-measure the temp; while its true peak is over the ceiling,
 * encode the ORIGINAL again with `correctiveGain` (at most LOUDNESS_MAX_CORRECTIVE_PASSES times). Throws (after
 * removing every temp) when an encode fails; the original is never touched here.
 */
async function encodeUnderCeiling(
  absPath: string,
  before: LoudnessStats,
  plan: LoudnessGainPlan,
  ceiling: number,
  opts: AudioNormalizeOptions,
): Promise<EncodedPass[]> {
  const passes: EncodedPass[] = [];
  const temps: string[] = [];
  let gainDb = plan.gainDb;
  try {
    for (let n = 0; n <= LOUDNESS_MAX_CORRECTIVE_PASSES; n++) {
      const tmp = tempPath(absPath, n);
      temps.push(tmp);
      await encodeWithGain(absPath, tmp, gainDb, opts.signal);
      const pass: EncodedPass = { tmp, gainDb, ...(await measureEncoded(tmp, before, gainDb, opts)) };
      passes.push(pass);
      if (!pass.measured || !isOverCeiling(pass.peak, ceiling) || n === LOUDNESS_MAX_CORRECTIVE_PASSES) break;
      gainDb = correctiveGain(gainDb, pass.peak, ceiling);
      log.info('Encoded peak over the ceiling — corrective pass from the original', {
        absPath,
        peak: round2(pass.peak),
        appliedGainDb: pass.gainDb,
        nextGainDb: gainDb,
      });
    }
  } catch (err) {
    await removeQuietly(temps);
    throw err;
  }
  return passes;
}

/** The last pass when it holds (or could not be measured); else the lowest measured peak. */
function choosePass(passes: EncodedPass[], ceiling: number): EncodedPass {
  const last = passes[passes.length - 1];
  if (!last.measured || !isOverCeiling(last.peak, ceiling)) return last;
  return passes.reduce((best, p) => (p.peak < best.peak ? p : best));
}

/**
 * Normalize one audio file in place to the policy (defaults −20 LUFS under −1.5 dBTP). Resolves with what the
 * file IS afterwards — re-measured, never predicted, except when the re-measure pass itself fails.
 */
export async function normalizeAudioFile(absPath: string, opts: AudioNormalizeOptions = {}): Promise<AudioNormalizeResult> {
  const target = opts.targetLufs ?? LOUDNESS_TARGET_LUFS;
  const ceiling = opts.ceilingDbfs ?? LOUDNESS_CEILING_DBFS;
  const failed = { normalized: false as const, gainDb: 0, clamped: false, gated: false, skipped: false };
  let before: LoudnessStats;
  try {
    before = await measureLoudness(absPath, opts);
  } catch (err) {
    log.warn('Loudness measure failed — file kept as generated', { absPath, error: messageOf(err) });
    return { ...failed, error: `measure failed: ${summarizeFfmpegError(messageOf(err), absPath)}` };
  }
  const was = reading(before);
  const plan = planLoudnessGain(before, target, ceiling);
  if (plan.skipped) return { normalized: true, ...was, ...plan, before: was };
  let passes: EncodedPass[];
  let chosen: EncodedPass;
  try {
    passes = await encodeUnderCeiling(absPath, before, plan, ceiling, opts);
    chosen = choosePass(passes, ceiling);
    await fs.rename(chosen.tmp, absPath);
  } catch (err) {
    log.warn('Loudness gain failed — file kept as generated', { absPath, gainDb: plan.gainDb, error: messageOf(err) });
    await removeQuietly(Array.from({ length: LOUDNESS_MAX_CORRECTIVE_PASSES + 1 }, (_, n) => tempPath(absPath, n)));
    return { ...failed, ...was, before: was, error: `apply failed: ${summarizeFfmpegError(messageOf(err), absPath)}` };
  }
  await removeQuietly(passes.filter((p) => p !== chosen).map((p) => p.tmp));
  const correctivePasses = passes.length - 1;
  const overCeiling = chosen.measured && isOverCeiling(chosen.peak, ceiling);
  if (overCeiling) {
    log.warn('Encoded peak still over the ceiling after the corrective passes — kept the lowest', {
      absPath,
      peaks: passes.map((p) => round2(p.peak)),
    });
  }
  log.info('Loudness normalized', { absPath, ...plan, gainDb: chosen.gainDb, correctivePasses, before: was, after: chosen.after });
  return {
    normalized: true,
    ...chosen.after,
    ...plan,
    gainDb: chosen.gainDb,
    correctivePasses,
    ...(overCeiling ? { overCeiling: true as const } : {}),
    before: was,
  };
}

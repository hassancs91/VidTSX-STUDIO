// Per-utterance prosody. We trade `librosa`'s Python-based RMS for ffmpeg's
// `astats` filter — coarser but it ships for free with the existing ffmpeg
// binary and is plenty for the take-tiebreaker decision.
//
// Strategy: one ffmpeg invocation per utterance, trimming to its [start, end]
// range and reading the overall RMS level from `astats`. Speaking rate is
// computed from utterance text + duration (mechanical, no audio analysis).

import { spawn } from 'child_process';
import { getRemotionBinariesDir } from '../../utils/paths';

async function getFfmpegPath(): Promise<string> {
  const { RenderInternals } = await import('@remotion/renderer');
  return RenderInternals.getExecutablePath({
    type: 'ffmpeg',
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });
}

export interface UtteranceRange {
  start: number;
  end: number;
  wordCount: number;
}

export interface UtteranceProsody {
  meanRms: number;
  rmsVariance: number;
  speakingRateWpm: number;
}

export interface ComputeProsodyOptions {
  audioPath: string;
  utterances: UtteranceRange[];
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

const PEAK_DBFS = 20 * Math.log10(1); // reference: 0 dBFS == 1.0 amplitude
// Convert ffmpeg astats `RMS_level` (dBFS, negative) → linear 0..1 amplitude.
function dbfsToLinear(dbfs: number): number {
  if (!isFinite(dbfs)) return 0;
  return Math.pow(10, (dbfs - PEAK_DBFS) / 20);
}

export async function computeProsody(
  opts: ComputeProsodyOptions
): Promise<UtteranceProsody[]> {
  const ffmpegPath = await getFfmpegPath();
  const out: UtteranceProsody[] = [];

  for (let i = 0; i < opts.utterances.length; i++) {
    if (opts.signal?.aborted) throw new Error('aborted');
    const u = opts.utterances[i];
    const duration = Math.max(0.001, u.end - u.start);
    const speakingRateWpm = (u.wordCount / duration) * 60;

    let meanRms = 0;
    let rmsVariance = 0;

    if (duration >= 0.05) {
      const stderr = await new Promise<string>((resolve, reject) => {
        const proc = spawn(
          ffmpegPath,
          [
            '-ss', String(u.start),
            '-t', String(duration),
            '-i', opts.audioPath,
            '-af', 'astats=metadata=1:reset=0',
            '-f', 'null',
            '-',
          ],
          { windowsHide: true }
        );

        let buf = '';
        proc.stderr.on('data', (chunk: Buffer) => {
          buf += chunk.toString();
        });
        proc.on('error', (err) => reject(err));
        proc.on('close', () => resolve(buf));
      });

      // astats emits lines like:
      //   [Parsed_astats_0 @ ...] Overall
      //   [Parsed_astats_0 @ ...] RMS level dB: -23.456
      //   [Parsed_astats_0 @ ...] Peak level dB: -8.123
      //   [Parsed_astats_0 @ ...] RMS peak dB: -19.001
      //   [Parsed_astats_0 @ ...] RMS trough dB: -41.117
      const overallSection = stderr.split('Overall').pop() ?? stderr;
      const rmsMatch = overallSection.match(/RMS level dB:\s*([-\d.]+|-?inf)/);
      const peakMatch = overallSection.match(/RMS peak dB:\s*([-\d.]+|-?inf)/);
      const troughMatch = overallSection.match(/RMS trough dB:\s*([-\d.]+|-?inf)/);

      const rmsDb = rmsMatch ? parseFloat(rmsMatch[1]) : -Infinity;
      meanRms = dbfsToLinear(rmsDb);

      if (peakMatch && troughMatch) {
        const peakLinear = dbfsToLinear(parseFloat(peakMatch[1]));
        const troughLinear = dbfsToLinear(parseFloat(troughMatch[1]));
        // Coarse variance proxy — true variance would need per-window RMS.
        // The relative spread between peak and trough is adequate for the
        // take-tiebreaker comparison.
        rmsVariance = Math.max(0, (peakLinear - troughLinear) ** 2 / 4);
      }
    }

    out.push({
      meanRms: round5(meanRms),
      rmsVariance: round6(rmsVariance),
      speakingRateWpm: round1(speakingRateWpm),
    });

    opts.onProgress?.(i + 1, opts.utterances.length);
  }

  return out;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

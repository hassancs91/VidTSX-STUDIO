// Detect silences via ffmpeg `silencedetect` filter. Same thresholds as the
// reference skill: -32 dB / minimum 0.3s. Output is parsed from stderr.

import { spawn } from 'child_process';
import { getRemotionBinariesDir } from '../../utils/paths';
import type { StudioAnalysisSilence } from '../../../shared/ipc/types';

async function getFfmpegPath(): Promise<string> {
  const { RenderInternals } = await import('@remotion/renderer');
  return RenderInternals.getExecutablePath({
    type: 'ffmpeg',
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });
}

export interface DetectSilencesOptions {
  audioPath: string;
  thresholdDb?: number;
  minDurationSeconds?: number;
  signal?: AbortSignal;
}

export async function detectSilences(
  opts: DetectSilencesOptions
): Promise<StudioAnalysisSilence[]> {
  const ffmpegPath = await getFfmpegPath();
  const thresholdDb = opts.thresholdDb ?? -32;
  const minDur = opts.minDurationSeconds ?? 0.3;

  const stderr = await new Promise<string>((resolve, reject) => {
    const proc = spawn(
      ffmpegPath,
      [
        '-i', opts.audioPath,
        '-af', `silencedetect=n=${thresholdDb}dB:d=${minDur}`,
        '-f', 'null',
        '-',
      ],
      { windowsHide: true }
    );

    const onAbort = () => {
      proc.kill('SIGTERM');
      reject(new Error('aborted'));
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    let buf = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      buf += chunk.toString();
    });
    proc.on('error', (err) => {
      opts.signal?.removeEventListener('abort', onAbort);
      reject(new Error(`ffmpeg failed: ${err.message}`));
    });
    proc.on('close', () => {
      opts.signal?.removeEventListener('abort', onAbort);
      // silencedetect emits to stderr even on exit code 0 — we always parse it.
      resolve(buf);
    });
  });

  const silences: StudioAnalysisSilence[] = [];
  let start: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const startMatch = line.match(/silence_start: ([-\d.]+)/);
    if (startMatch) {
      start = Math.max(0, parseFloat(startMatch[1]));
      continue;
    }
    const endMatch = line.match(/silence_end: ([-\d.]+) \| silence_duration: ([-\d.]+)/);
    if (endMatch && start !== null) {
      const end = parseFloat(endMatch[1]);
      const duration = parseFloat(endMatch[2]);
      silences.push({
        start: round3(start),
        end: round3(end),
        duration: round3(duration),
      });
      start = null;
    }
  }
  return silences;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

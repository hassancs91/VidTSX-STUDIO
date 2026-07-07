// Audio extraction stage of the transcription pipeline, lifted from the
// removed transcribe-vidtsx.ts: mono 16kHz WAV via the bundled ffmpeg, with
// stderr-based progress and abort support.

import { app } from 'electron';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getRemotionBinariesDir } from '../../utils/paths';

// Audio container extensions usable as-is (no ffmpeg extraction needed).
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac', 'opus']);

export function isAudioFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTENSIONS.has(ext);
}

export function getSttTempDir(): string {
  return path.join(app.getPath('temp'), 'vidtsx-transcription');
}

async function getFfmpegPath(): Promise<string> {
  const { RenderInternals } = await import('@remotion/renderer');
  return RenderInternals.getExecutablePath({
    type: 'ffmpeg',
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });
}

/** Extract a mono 16kHz WAV from a video to a temp file. onProgress: 0..100. */
export async function extractAudioToWav(
  inputPath: string,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
): Promise<string> {
  const tempDir = getSttTempDir();
  await fs.mkdir(tempDir, { recursive: true });
  const outputPath = path.join(tempDir, `audio-${Date.now()}.wav`);
  const ffmpegExe = await getFfmpegPath();

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      ffmpegExe,
      ['-i', inputPath, '-ar', '16000', '-ac', '1', '-f', 'wav', '-y', outputPath],
      { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
    );

    const onAbort = () => {
      proc.kill('SIGTERM');
      reject(new Error('aborted'));
    };
    signal.addEventListener('abort', onAbort, { once: true });

    let stderr = '';
    let duration = 0;
    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
      if (duration === 0) {
        const m = stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
        if (m) duration = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
      }
      const t = data.toString().match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (t && duration > 0) {
        const cur = parseInt(t[1]) * 3600 + parseInt(t[2]) * 60 + parseFloat(t[3]);
        onProgress(Math.min(99, Math.round((cur / duration) * 100)));
      }
    });

    proc.on('close', (code) => {
      signal.removeEventListener('abort', onAbort);
      if (code === 0 && existsSync(outputPath)) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr.slice(-500)}`));
      }
    });
    proc.on('error', (err) => reject(new Error(`Failed to start FFmpeg: ${err.message}`)));
  });

  return outputPath;
}

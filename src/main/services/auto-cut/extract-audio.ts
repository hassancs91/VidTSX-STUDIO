// Extract a mono 16kHz wav from a source video using bundled ffmpeg.
// Output is cached per-project — if `audio.wav` already exists in the project
// auto-cut directory, we reuse it (re-running auto-cut should not re-decode).

import { spawn } from 'child_process';
import { access, mkdir } from 'fs/promises';
import path from 'path';
import { app } from 'electron';
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

export function getAutoCutDir(projectId: string): string {
  return path.join(app.getPath('userData'), 'studio-projects', projectId, 'auto-cut');
}

export interface ExtractAudioOptions {
  videoPath: string;
  projectId: string;
  // If true, force re-extraction even if cached.
  force?: boolean;
  signal?: AbortSignal;
}

export interface ExtractAudioResult {
  audioPath: string;
  cached: boolean;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function extractAudio(opts: ExtractAudioOptions): Promise<ExtractAudioResult> {
  const dir = getAutoCutDir(opts.projectId);
  await mkdir(dir, { recursive: true });
  const audioPath = path.join(dir, 'audio.wav');

  if (!opts.force && (await fileExists(audioPath))) {
    return { audioPath, cached: true };
  }

  const ffmpegPath = await getFfmpegPath();
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      ffmpegPath,
      [
        '-y',
        '-loglevel', 'error',
        '-i', opts.videoPath,
        '-ac', '1',
        '-ar', '16000',
        audioPath,
      ],
      { windowsHide: true }
    );

    const onAbort = () => {
      proc.kill('SIGTERM');
      reject(new Error('aborted'));
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('error', (err) => {
      opts.signal?.removeEventListener('abort', onAbort);
      reject(new Error(`ffmpeg failed to spawn: ${err.message}`));
    });
    proc.on('close', (code) => {
      opts.signal?.removeEventListener('abort', onAbort);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(0, 500)}`));
    });
  });

  return { audioPath, cached: false };
}

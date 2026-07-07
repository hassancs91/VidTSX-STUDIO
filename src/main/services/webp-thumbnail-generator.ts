import fs from 'fs/promises';
import { execFile } from 'child_process';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('WebpThumb');

let cachedFfmpeg: string | null | undefined = undefined;

/**
 * Check whether `ffmpeg` is available on PATH. Caches the result per-session.
 * Returns the command name on success ('ffmpeg') or null if not found.
 */
export async function detectSystemFfmpeg(): Promise<string | null> {
  if (cachedFfmpeg !== undefined) return cachedFfmpeg;

  cachedFfmpeg = await new Promise<string | null>((resolve) => {
    execFile('ffmpeg', ['-version'], { timeout: 5000 }, (error) => {
      if (error) {
        resolve(null);
      } else {
        resolve('ffmpeg');
      }
    });
  });
  return cachedFfmpeg;
}

/**
 * Use the system ffmpeg to generate an animated webp from an mp4.
 *
 * - 3s max duration (first 3s of the render)
 * - 10fps (30 frames total)
 * - longest side capped at 640px, aspect ratio preserved (works for 16:9, 9:16, 1:1, etc.)
 * - quality 45 + compression_level 6 (max): optimized for small file size, not photo fidelity
 *
 * Throws with ffmpeg stderr on failure.
 */
export async function generateAnimatedWebp(mp4Path: string, outputPath: string): Promise<{ path: string; sizeBytes: number }> {
  await new Promise<void>((resolve, reject) => {
    execFile(
      'ffmpeg',
      [
        '-i', mp4Path,
        '-t', '3',
        '-vf', 'scale=640:640:force_original_aspect_ratio=decrease:flags=lanczos,fps=10',
        '-c:v', 'libwebp',
        '-loop', '0',
        '-compression_level', '6',
        '-quality', '45',
        '-an',
        '-y',
        outputPath,
      ],
      { timeout: 90000, maxBuffer: 10 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          const tail = typeof stderr === 'string' ? stderr.trim().split('\n').slice(-6).join('\n') : '';
          reject(new Error(tail || error.message));
        } else {
          resolve();
        }
      }
    );
  });

  const stat = await fs.stat(outputPath);
  log.debug('Generated webp thumbnail', { outputPath, sizeBytes: stat.size });
  return { path: outputPath, sizeBytes: stat.size };
}

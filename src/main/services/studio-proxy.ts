// On-demand video proxy generation. Transcodes a source video into a small,
// fast-decoding mp4 so the Studio preview plays/scrubs smoothly on large media.
//
// Aspect ratio is PRESERVED: we scale by height to at most PROXY_HEIGHT and
// never upscale, so a vertical short, a 1:1, and a 16:9 clip all keep their
// shape (just smaller). The proxy shares the source's duration and timebase, so
// clip trims / in-points map onto it unchanged. Export never touches the proxy —
// it always renders from the original `filePath`.

import { spawn } from 'child_process';
import { access, mkdir } from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { getRemotionBinariesDir } from '../utils/paths';

// Target proxy height in pixels. Sources shorter than this are left at their
// native height (no upscale). 720 keeps the preview legible while decoding far
// faster than 4K/1080p source. Tune here if smoother playback is needed.
const PROXY_HEIGHT = 720;

async function getFfmpegPath(): Promise<string> {
  const { RenderInternals } = await import('@remotion/renderer');
  return RenderInternals.getExecutablePath({
    type: 'ffmpeg',
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });
}

async function getFfprobePath(): Promise<string> {
  const { RenderInternals } = await import('@remotion/renderer');
  return RenderInternals.getExecutablePath({
    type: 'ffprobe',
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });
}

export function getProxyDir(projectId: string): string {
  return path.join(app.getPath('userData'), 'studio-projects', projectId, 'proxies');
}

export function getProxyPath(projectId: string, importId: string): string {
  return path.join(getProxyDir(projectId), `${importId}.mp4`);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// Read the source duration (seconds) so we can turn ffmpeg's elapsed-time
// progress into a percentage. Returns 0 if it can't be determined.
async function probeDurationSeconds(filePath: string): Promise<number> {
  const ffprobePath = await getFfprobePath();
  return new Promise<number>((resolve) => {
    const proc = spawn(ffprobePath, [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    let out = '';
    proc.stdout.on('data', (c: Buffer) => { out += c.toString(); });
    proc.on('error', () => resolve(0));
    proc.on('close', () => {
      const n = parseFloat(out.trim());
      resolve(isNaN(n) || n <= 0 ? 0 : n);
    });
  });
}

// Of the given import ids, return those whose proxy file currently exists on
// disk. Used at project load to prune stale proxy references.
export async function verifyProxies(
  projectId: string,
  importIds: string[]
): Promise<string[]> {
  const checks = await Promise.all(
    importIds.map(async (importId) => ({
      importId,
      exists: await fileExists(getProxyPath(projectId, importId)),
    }))
  );
  return checks.filter((c) => c.exists).map((c) => c.importId);
}

export interface GenerateProxyOptions {
  projectId: string;
  importId: string;
  filePath: string;
  force?: boolean;
  signal?: AbortSignal;
  // 0..100, throttled to whole-percent changes by the caller if desired.
  onProgress?: (percent: number) => void;
}

export interface GenerateProxyResult {
  proxyPath: string;
  cached: boolean;
}

export async function generateProxy(opts: GenerateProxyOptions): Promise<GenerateProxyResult> {
  const dir = getProxyDir(opts.projectId);
  await mkdir(dir, { recursive: true });
  const proxyPath = getProxyPath(opts.projectId, opts.importId);

  if (!opts.force && (await fileExists(proxyPath))) {
    return { proxyPath, cached: true };
  }

  const totalSeconds = await probeDurationSeconds(opts.filePath);
  const ffmpegPath = await getFfmpegPath();

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      ffmpegPath,
      [
        '-y',
        '-i', opts.filePath,
        // Scale by height to PROXY_HEIGHT, width auto (even), never upscale.
        // -2 keeps the width divisible by 2 (required by yuv420p / h264).
        '-vf', `scale=-2:'min(${PROXY_HEIGHT},ih)'`,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '25',
        // Frequent keyframes so timeline scrubbing seeks quickly.
        '-g', '48',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        // Machine-readable progress on stdout; suppress the noisy stats line.
        '-nostats',
        '-progress', 'pipe:1',
        proxyPath,
      ],
      { windowsHide: true }
    );

    const onAbort = () => {
      proc.kill('SIGTERM');
      reject(new Error('aborted'));
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    let lastPercent = -1;
    proc.stdout.on('data', (chunk: Buffer) => {
      if (totalSeconds <= 0 || !opts.onProgress) return;
      // ffmpeg -progress emits "out_time_us=..." lines (microseconds elapsed).
      const text = chunk.toString();
      const matches = text.match(/out_time_us=(\d+)/g);
      if (!matches || matches.length === 0) return;
      const last = matches[matches.length - 1];
      const us = parseInt(last.split('=')[1], 10);
      if (isNaN(us)) return;
      const percent = Math.max(0, Math.min(99, Math.round((us / 1e6 / totalSeconds) * 100)));
      if (percent !== lastPercent) {
        lastPercent = percent;
        opts.onProgress(percent);
      }
    });

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

  return { proxyPath, cached: false };
}

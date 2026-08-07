import { spawn } from 'child_process';
import { getRemotionBinariesDir } from '../../utils/paths';

/** ffmpeg/ffprobe come from Remotion's bundled binaries — the app ships no
 *  copies of its own (see docs/studio/PLAN.md §3). */
export async function getFfmpegBinary(type: 'ffmpeg' | 'ffprobe'): Promise<string> {
  const { RenderInternals } = await import('@remotion/renderer');
  return RenderInternals.getExecutablePath({
    type,
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });
}

export interface RunFfmpegOptions {
  signal?: AbortSignal;
  /** Receives stdout bytes instead of them being buffered (PCM piping). */
  onStdout?: (chunk: Buffer) => void;
}

/**
 * Run ffmpeg to completion. Rejects with the tail of stderr on a non-zero exit,
 * which is what actually explains an ffmpeg failure.
 */
export async function runFfmpeg(
  binary: string,
  args: string[],
  options: RunFfmpegOptions = {},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(binary, args, {
      stdio: ['ignore', options.onStdout ? 'pipe' : 'ignore', 'pipe'],
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    if (options.onStdout) proc.stdout?.on('data', options.onStdout);

    const onAbort = () => proc.kill();
    options.signal?.addEventListener('abort', onAbort, { once: true });

    proc.on('error', (err) => {
      options.signal?.removeEventListener('abort', onAbort);
      reject(err);
    });
    proc.on('close', (code) => {
      options.signal?.removeEventListener('abort', onAbort);
      if (options.signal?.aborted) reject(new Error('Cancelled'));
      else if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

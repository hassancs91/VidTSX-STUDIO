import { spawn } from 'child_process';
import os from 'os';
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

/**
 * OS scheduling priority for a background transcode. ffmpeg saturates every
 * core it is given; at normal priority that starves the renderer and the UI
 * stutters while proxies generate. Below-normal keeps the encode running flat
 * out on an idle machine but lets anything interactive win the contention.
 */
export type FfmpegPriority = 'below-normal' | 'idle';

const PRIORITY_VALUES: Record<FfmpegPriority, number> = {
  'below-normal': os.constants.priority.PRIORITY_BELOW_NORMAL,
  idle: os.constants.priority.PRIORITY_LOW,
};

export interface RunFfmpegOptions {
  signal?: AbortSignal;
  /** Receives stdout bytes instead of them being buffered (PCM piping). */
  onStdout?: (chunk: Buffer) => void;
  /** Receives stderr text as it streams (duration/progress parsing). The
   *  rolling tail is still kept internally for error reporting. */
  onStderr?: (text: string) => void;
  /** Lower the child's scheduling priority (background work only — leave unset
   *  for anything the user is waiting on). Best effort: a failed setPriority
   *  never fails the transcode. */
  priority?: FfmpegPriority;
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

    if (options.priority && proc.pid !== undefined) {
      try {
        os.setPriority(proc.pid, PRIORITY_VALUES[options.priority]);
      } catch {
        // Not fatal: the transcode just runs at normal priority.
      }
    }

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr = (stderr + text).slice(-4000);
      options.onStderr?.(text);
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

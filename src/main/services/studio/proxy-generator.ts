import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { getProjectCacheDir } from './studio-paths';
import { getFfmpegBinary, runFfmpeg } from './ffmpeg-bin';

const log = logEngine.createLogger('StudioProxy');

export const PROXY_DIR = 'proxies';
/** Preview height. 720p keeps decode cheap enough for a Player-driven scrub. */
const PROXY_HEIGHT = 720;

/** Sticky once NVENC is known to be unavailable — the reference pipeline was
 *  NVENC-only, and this app must run on machines without it (PLAN §9). */
let nvencUnavailable = false;

/**
 * Keyframe interval, in frames. Proxies exist to be *scrubbed*, and a seek has
 * to decode from the previous keyframe — with the encoder default (250, i.e.
 * ~8s) a single scrub step cost ~57 ms and the timeline ran at ~20 fps. A short
 * GOP trades a little file size for seeks that land almost immediately.
 */
const PROXY_GOP = 15;

function encoderArgs(useNvenc: boolean): string[] {
  return useNvenc
    ? ['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '30', '-g', String(PROXY_GOP)]
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-g', String(PROXY_GOP)];
}

function proxyArgs(sourcePath: string, outputPath: string, useNvenc: boolean): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    // Machine-readable progress on stdout (out_time_us=… lines); -nostats
    // drops the human "frame=…" spam from stderr but keeps the input banner,
    // which is where the total duration comes from.
    '-progress',
    'pipe:1',
    '-nostats',
    '-i',
    sourcePath,
    // Never upscale: min() keeps small sources at their native height.
    '-vf',
    `scale=-2:min(${PROXY_HEIGHT}\\,ih)`,
    ...encoderArgs(useNvenc),
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    '-y',
    outputPath,
  ];
}

/** Cache-relative path of an asset's proxy (forward slashes — it goes in the document). */
export function proxyRelPath(assetId: string): string {
  return `${PROXY_DIR}/${assetId}.mp4`;
}

/**
 * Turns ffmpeg's two output streams into a percent: `-progress pipe:1` emits
 * `out_time_us=…` key-value lines on stdout, while the input's total duration
 * only appears in the stderr banner ("Duration: 00:02:19.03"). Reading it from
 * ffmpeg itself means every caller gets progress without threading probe data
 * through the job queue.
 */
function createProgressParser(onPercent: (percent: number) => void) {
  let totalSeconds: number | null = null;
  let stderrTail = '';
  let stdoutBuf = '';
  return {
    onStderr(text: string): void {
      if (totalSeconds !== null) return;
      // Rolling tail so a "Duration:" line split across chunks still matches.
      stderrTail = (stderrTail + text).slice(-2000);
      const m = /Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)/.exec(stderrTail);
      if (m) totalSeconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    },
    onStdout(chunk: Buffer): void {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() ?? '';
      if (totalSeconds === null || totalSeconds <= 0) return;
      for (const line of lines) {
        const m = /^out_time_us=(\d+)/.exec(line.trim());
        if (!m) continue;
        onPercent(Math.min(100, (Number(m[1]) / 1e6 / totalSeconds) * 100));
      }
    },
  };
}

/**
 * Transcode a 720p H.264 proxy used by the editor preview. Originals are never
 * touched — the export re-points the same composition at them.
 */
export async function generateProxy(
  projectId: string,
  assetId: string,
  sourcePath: string,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const cacheDir = await getProjectCacheDir(projectId);
  const relPath = proxyRelPath(assetId);
  const outputPath = path.join(cacheDir, PROXY_DIR, `${assetId}.mp4`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const ffmpeg = await getFfmpegBinary('ffmpeg');
  const tmpPath = `${outputPath}.part.mp4`;

  const attempt = async (useNvenc: boolean) => {
    // A fresh parser per attempt: the libx264 fallback restarts from 0%.
    const parser = onProgress ? createProgressParser(onProgress) : undefined;
    await runFfmpeg(ffmpeg, proxyArgs(sourcePath, tmpPath, useNvenc), {
      signal,
      ...(parser ? { onStdout: parser.onStdout, onStderr: parser.onStderr } : {}),
    });
  };

  try {
    if (!nvencUnavailable) {
      try {
        await attempt(true);
      } catch (err) {
        if (signal?.aborted) throw err;
        nvencUnavailable = true;
        log.info('NVENC unavailable for proxies, falling back to libx264', {
          error: err instanceof Error ? err.message.slice(0, 200) : String(err),
        });
        await attempt(false);
      }
    } else {
      await attempt(false);
    }
    // Rename only after a clean exit so a killed ffmpeg can't leave a
    // half-written proxy that later looks "ready".
    await fs.rename(tmpPath, outputPath);
    return relPath;
  } catch (err) {
    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw err;
  }
}

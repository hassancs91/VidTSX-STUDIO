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
 * Transcode a 720p H.264 proxy used by the editor preview. Originals are never
 * touched — the export re-points the same composition at them.
 */
export async function generateProxy(
  projectId: string,
  assetId: string,
  sourcePath: string,
  signal?: AbortSignal,
): Promise<string> {
  const cacheDir = await getProjectCacheDir(projectId);
  const relPath = proxyRelPath(assetId);
  const outputPath = path.join(cacheDir, PROXY_DIR, `${assetId}.mp4`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const ffmpeg = await getFfmpegBinary('ffmpeg');
  const tmpPath = `${outputPath}.part.mp4`;

  const attempt = async (useNvenc: boolean) => {
    await runFfmpeg(ffmpeg, proxyArgs(sourcePath, tmpPath, useNvenc), { signal });
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

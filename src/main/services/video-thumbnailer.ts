import path from 'path';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { logEngine } from '../../logging/log-engine';
import { getRemotionBinariesDir } from '../utils/paths';
import { getThumbnailsDir } from './video-studio-files';

const log = logEngine.createLogger('VideoThumbnailer');

/**
 * Extract a single JPEG frame from a video at the given offset. Best-effort —
 * returns null on any failure (missing ffmpeg, codec error, etc.). The caller
 * stores the thumbnail filename in the DB only on success.
 */
export async function extractThumbnail(
  videoPath: string,
  /** Thumbnail filename to write under getThumbnailsDir(). */
  thumbnailFileName: string,
  /** Offset in seconds from the start. Defaults to 1.0. */
  offsetSeconds: number = 1.0,
): Promise<string | null> {
  try {
    const { RenderInternals } = await import('@remotion/renderer');
    const ffmpegExe = RenderInternals.getExecutablePath({
      type: 'ffmpeg',
      indent: false,
      logLevel: 'error',
      binariesDirectory: getRemotionBinariesDir(),
    });

    await fs.mkdir(getThumbnailsDir(), { recursive: true });
    const outputPath = path.join(getThumbnailsDir(), thumbnailFileName);

    return await new Promise<string | null>((resolve) => {
      execFile(
        ffmpegExe,
        [
          '-i', videoPath,
          '-ss', String(offsetSeconds),
          '-frames:v', '1',
          '-vf', 'scale=480:-2:flags=lanczos',
          '-q:v', '4',
          '-y',
          outputPath,
        ],
        { timeout: 20_000 },
        (error) => {
          if (error) {
            log.warn('Thumbnail extraction failed', { error: error.message });
            resolve(null);
          } else {
            resolve(outputPath);
          }
        },
      );
    });
  } catch (err) {
    log.warn('Thumbnail extraction setup failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function buildThumbnailFileName(videoFileName: string): string {
  const base = path.basename(videoFileName, path.extname(videoFileName));
  return `${base}.jpg`;
}

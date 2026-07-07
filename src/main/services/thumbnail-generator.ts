import { logEngine } from '../../logging/log-engine';
import path from 'path';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import { getRemotionBinariesDir } from '../utils/paths';

const log = logEngine.createLogger('Thumbnail');

export function getThumbnailPath(tsxFilePath: string): string {
  const dir = path.dirname(tsxFilePath);
  const base = path.basename(tsxFilePath, '.tsx');
  return path.join(dir, `${base}.thumb.gif`);
}

export async function generateThumbnail(
  videoPath: string,
  tsxFilePath: string
): Promise<string | null> {
  try {
    const { RenderInternals } = await import('@remotion/renderer');
    const ffmpegExe = RenderInternals.getExecutablePath({
      type: 'ffmpeg',
      indent: false,
      logLevel: 'error',
      binariesDirectory: getRemotionBinariesDir(),
    });

    const outputPath = getThumbnailPath(tsxFilePath);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return await new Promise<string | null>((resolve) => {
      execFile(
        ffmpegExe,
        [
          '-i', videoPath,
          '-ss', '0',
          '-t', '3',
          '-vf', 'scale=220:-2:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
          '-r', '8',
          '-loop', '0',
          '-an',
          '-y',
          outputPath,
        ],
        { timeout: 30000 },
        (error) => {
          if (error) {
            log.warn('Thumbnail generation failed', { error: error.message });
            resolve(null);
          } else {
            log.debug('Thumbnail generated', { outputPath });
            resolve(outputPath);
          }
        }
      );
    });
  } catch (err) {
    log.warn('Thumbnail generation error', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { spawn, execFile } from 'child_process';
import { logEngine } from '../../../logging/log-engine';
import { getRemotionBinariesDir } from '../../utils/paths';
import type {
  StudioAssetKind,
  StudioAssetProbe,
  StudioMediaAsset,
} from '../../../shared/types/studio';
import { getProjectCacheDir, getProjectDir } from './studio-paths';

const log = logEngine.createLogger('StudioMediaImport');

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.mts', '.m2ts']);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif']);

export const MEDIA_DIALOG_FILTERS = [
  {
    name: 'Media',
    extensions: [...VIDEO_EXTS, ...AUDIO_EXTS, ...IMAGE_EXTS].map((e) => e.slice(1)),
  },
  { name: 'Video', extensions: [...VIDEO_EXTS].map((e) => e.slice(1)) },
  { name: 'Audio', extensions: [...AUDIO_EXTS].map((e) => e.slice(1)) },
  { name: 'Images', extensions: [...IMAGE_EXTS].map((e) => e.slice(1)) },
];

export function classifyMediaKind(filePath: string): StudioAssetKind | null {
  const ext = path.extname(filePath).toLowerCase();
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (IMAGE_EXTS.has(ext)) return 'image';
  return null;
}

async function getBinaryPath(type: 'ffmpeg' | 'ffprobe'): Promise<string> {
  const { RenderInternals } = await import('@remotion/renderer');
  return RenderInternals.getExecutablePath({
    type,
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
}

function parseFps(stream: FfprobeStream | undefined): number | undefined {
  const rate = stream?.r_frame_rate ?? stream?.avg_frame_rate;
  if (!rate) return undefined;
  const [num, den] = rate.split('/').map((p) => parseInt(p, 10));
  if (Number.isFinite(num) && Number.isFinite(den) && den > 0 && num > 0) {
    return Math.round((num / den) * 100) / 100;
  }
  const single = parseFloat(rate);
  return Number.isFinite(single) && single > 0 ? single : undefined;
}

/** ffprobe any media file (video, audio, or image). */
export async function probeMedia(filePath: string, kind: StudioAssetKind): Promise<StudioAssetProbe> {
  const ffprobePath = await getBinaryPath('ffprobe');
  const output = await new Promise<string>((resolve, reject) => {
    const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath];
    let stdout = '';
    let stderr = '';
    const proc = spawn(ffprobePath, args);
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
    });
    proc.on('error', reject);
  });

  const data = JSON.parse(output) as {
    streams?: FfprobeStream[];
    format?: { duration?: string };
  };
  const videoStream = data.streams?.find((s) => s.codec_type === 'video');
  const audioStream = data.streams?.find((s) => s.codec_type === 'audio');
  const duration = kind === 'image' ? 0 : parseFloat(data.format?.duration ?? '0') || 0;

  return {
    duration,
    width: videoStream?.width,
    height: videoStream?.height,
    fps: kind === 'video' ? parseFps(videoStream) : undefined,
    hasAudio: audioStream !== undefined,
    codec: videoStream?.codec_name ?? audioStream?.codec_name,
  };
}

/** First 1 MiB content hash — cheap identity for relink-when-missing. */
export async function hashFileHead(filePath: string): Promise<string | undefined> {
  try {
    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(1024 * 1024);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const stat = await handle.stat();
      return crypto
        .createHash('sha1')
        .update(buffer.subarray(0, bytesRead))
        .update(String(stat.size))
        .digest('hex');
    } finally {
      await handle.close();
    }
  } catch {
    return undefined;
  }
}

/** Write cache/thumbs/<assetId>.jpg. Best-effort — returns null on failure. */
async function generateThumbnail(
  projectId: string,
  assetId: string,
  filePath: string,
  kind: StudioAssetKind,
  duration: number,
): Promise<string | null> {
  if (kind === 'audio') return null;
  try {
    const ffmpegExe = await getBinaryPath('ffmpeg');
    const cacheDir = await getProjectCacheDir(projectId);
    const relPath = path.join('thumbs', `${assetId}.jpg`);
    const outputPath = path.join(cacheDir, relPath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const seek = kind === 'video' ? ['-ss', String(Math.min(1, duration / 2))] : [];
    const args = [...seek, '-i', filePath, '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '5', '-y', outputPath];
    await new Promise<void>((resolve, reject) => {
      execFile(ffmpegExe, args, { timeout: 20_000 }, (error) => (error ? reject(error) : resolve()));
    });
    return relPath.replace(/\\/g, '/');
  } catch (err) {
    log.warn('Thumbnail generation failed', {
      assetId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Probe + thumbnail a set of files into StudioMediaAsset entries. Does NOT
 *  touch project.json — the renderer owns the document and merges these in. */
export async function importMediaFiles(
  projectId: string,
  filePaths: string[],
): Promise<{ assets: StudioMediaAsset[]; errors: string[] }> {
  await getProjectDir(projectId); // Validates the id early.
  const assets: StudioMediaAsset[] = [];
  const errors: string[] = [];

  for (const filePath of filePaths) {
    const kind = classifyMediaKind(filePath);
    if (!kind) {
      errors.push(`${path.basename(filePath)}: unsupported file type`);
      continue;
    }
    try {
      const probe = await probeMedia(filePath, kind);
      const id = crypto.randomUUID();
      const thumbPath = await generateThumbnail(projectId, id, filePath, kind, probe.duration);
      assets.push({
        id,
        kind,
        path: filePath,
        probe,
        hash: await hashFileHead(filePath),
        ...(thumbPath ? { thumbnail: { path: thumbPath, status: 'ready' as const } } : {}),
      });
    } catch (err) {
      errors.push(
        `${path.basename(filePath)}: ${err instanceof Error ? err.message : 'probe failed'}`,
      );
    }
  }
  return { assets, errors };
}

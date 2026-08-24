import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { checkImageBuffer } from './image-safety';
import { getTempDir } from '../../utils/paths';
import { getFfmpegBinary, runFfmpeg } from '../studio/ffmpeg-bin';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('ContentSafety');

/** 2 fps sampling (D2c) with a hard frame cap as a runaway guard. */
const SAMPLE_FPS = 2;
const MAX_SAMPLED_FRAMES = 300;
/** Frames at or above this dimension get an extra native-res center-crop scan. */
const CROP_SCAN_MIN_DIMENSION = 3000;

interface VideoProbe {
  width: number;
  height: number;
  durationSeconds: number;
}

async function probeVideo(filePath: string): Promise<VideoProbe> {
  const ffprobe = await getFfmpegBinary('ffprobe');
  const stdout = await new Promise<string>((resolve, reject) => {
    const proc = spawn(
      ffprobe,
      [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height:format=duration',
        '-of', 'json',
        filePath,
      ],
      { windowsHide: true },
    );
    let out = '';
    let errTail = '';
    proc.stdout.on('data', (c: Buffer) => { out += c.toString(); });
    proc.stderr.on('data', (c: Buffer) => { errTail = (errTail + c.toString()).slice(-1000); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`ffprobe failed (code ${code}): ${errTail}`));
    });
  });
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const stream = parsed.streams?.[0];
  const duration = Number(parsed.format?.duration ?? 0);
  if (!stream?.width || !stream.height || !Number.isFinite(duration)) {
    throw new Error('ffprobe returned no video stream metadata');
  }
  return { width: stream.width, height: stream.height, durationSeconds: duration };
}

async function extractFrames(
  filePath: string,
  outDir: string,
  prefix: string,
  options: { vf: string; rate?: number; inputArgs?: string[]; maxFrames?: number },
): Promise<string[]> {
  const binary = await getFfmpegBinary('ffmpeg');
  // Remotion's trimmed ffmpeg ships only the scale/crop/trim filters (no
  // `fps`), so sampling uses the `-r` output rate option instead.
  await runFfmpeg(binary, [
    '-hide_banner', '-loglevel', 'error',
    ...(options.inputArgs ?? []),
    '-i', filePath,
    '-vf', options.vf,
    ...(options.rate ? ['-r', String(options.rate)] : []),
    '-frames:v', String(options.maxFrames ?? MAX_SAMPLED_FRAMES),
    '-f', 'image2', '-c:v', 'png',
    path.join(outDir, `${prefix}-%04d.png`),
  ], {});
  const names = (await fs.readdir(outDir)).filter((n) => n.startsWith(`${prefix}-`)).sort();
  return names.map((n) => path.join(outDir, n));
}

/**
 * Content Safety Gate B for generated video (D2c call site 4): classify
 * 2 fps samples plus explicit first/middle/last frames; 4K sources get an
 * additional native-resolution center-crop pass (downscale can shrink small
 * explicit regions below detectability). Any frame trips → the whole clip
 * is blocked. Fail-closed: probe/extract failures block.
 *
 * @throws ModerationBlockedError | Error (fail-closed)
 */
export async function checkVideoFile(filePath: string): Promise<void> {
  const outDir = path.join(getTempDir(), `safety-frames-${randomUUID()}`);
  await fs.mkdir(outDir, { recursive: true });
  try {
    let frames: string[];
    let probe: VideoProbe;
    try {
      probe = await probeVideo(filePath);

      frames = await extractFrames(filePath, outDir, 'sample', {
        vf: 'scale=384:384',
        rate: SAMPLE_FPS,
      });

      // Explicit first / middle / last — rate sampling can miss the endpoints.
      const anchors = [0, probe.durationSeconds / 2, Math.max(0, probe.durationSeconds - 0.15)];
      for (let i = 0; i < anchors.length; i++) {
        frames.push(
          ...(await extractFrames(filePath, outDir, `anchor${i}`, {
            vf: 'scale=384:384',
            inputArgs: ['-ss', anchors[i].toFixed(3)],
            maxFrames: 1,
          })),
        );
      }

      if (Math.max(probe.width, probe.height) >= CROP_SCAN_MIN_DIMENSION) {
        frames.push(
          ...(await extractFrames(filePath, outDir, 'crop', {
            vf: 'crop=384:384',
            rate: SAMPLE_FPS,
          })),
        );
      }
    } catch (err) {
      throw new Error(
        `Content Safety could not sample this video, so it is blocked (fail-closed): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (frames.length === 0) {
      throw new Error('Content Safety sampled no frames from this video, so it is blocked (fail-closed).');
    }
    log.debug('Sampling video', { frames: frames.length, ...probe });

    for (const frame of frames) {
      await checkImageBuffer(await fs.readFile(frame));
    }
  } finally {
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Buffer variant for the fal download path: stage to a temp file, sample, clean up. */
export async function checkVideoBuffer(bytes: Buffer, extension = '.mp4'): Promise<void> {
  const tempPath = path.join(getTempDir(), `safety-check-${randomUUID()}${extension}`);
  await fs.mkdir(path.dirname(tempPath), { recursive: true });
  await fs.writeFile(tempPath, bytes);
  try {
    await checkVideoFile(tempPath);
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

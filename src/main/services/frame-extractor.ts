import { logEngine } from '../../logging/log-engine';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import { getRemotionBinariesDir } from '../utils/paths';

const log = logEngine.createLogger('FrameExtractor');
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import type {
  FrameExtractionPreset,
  ExtractedFrame,
  FrameExtractProgressEvent,
} from '../../shared/ipc/types';

interface ExtractOptions {
  videoPath: string;
  fps: number;
  preset: FrameExtractionPreset;
  everyXSeconds?: number;
  outputFormat: 'png' | 'jpg';
}

interface VideoProbeResult {
  duration: number;
  fps: number;
  width: number;
  height: number;
}

let activeProcess: ChildProcess | null = null;

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

export async function probeVideo(filePath: string): Promise<VideoProbeResult> {
  const ffprobePath = await getFfprobePath();

  const output = await new Promise<string>((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath.replace(/\\/g, '/'),
    ];
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
    streams?: Array<{
      codec_type: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
      avg_frame_rate?: string;
    }>;
    format?: { duration?: string };
  };

  const videoStream = data.streams?.find((s) => s.codec_type === 'video');
  const duration = parseFloat(data.format?.duration ?? '0');
  const fpsStr = videoStream?.r_frame_rate ?? videoStream?.avg_frame_rate ?? '30/1';
  const fpsParts = fpsStr.split('/');
  let fps = 30;
  if (fpsParts.length === 2) {
    const num = parseInt(fpsParts[0], 10);
    const den = parseInt(fpsParts[1], 10);
    if (den > 0) fps = Math.round((num / den) * 100) / 100;
  } else {
    const parsed = parseFloat(fpsStr);
    if (!isNaN(parsed)) fps = parsed;
  }

  return {
    duration,
    fps,
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
  };
}

function estimateFrameCount(
  duration: number,
  preset: FrameExtractionPreset,
  fps: number,
  everyXSeconds?: number
): number {
  switch (preset) {
    case 'first-frame':
    case 'last-frame':
      return 1;
    case 'every-x-seconds':
      return Math.max(1, Math.ceil(duration / (everyXSeconds ?? 1)));
    case 'custom':
    default:
      return Math.max(1, Math.ceil(duration * fps));
  }
}

function toForwardSlash(p: string): string {
  return p.replace(/\\/g, '/');
}

function buildFfmpegArgs(
  videoPath: string,
  outputDir: string,
  options: ExtractOptions,
  ext: string
): string[] {
  // FFmpeg on Windows requires forward slashes for %d output patterns
  const outputPattern = toForwardSlash(path.join(outputDir, `frame_%06d.${ext}`));

  const input = toForwardSlash(videoPath);

  switch (options.preset) {
    case 'first-frame':
      return ['-i', input, '-frames:v', '1', '-y', outputPattern];

    case 'last-frame':
      return ['-sseof', '-0.5', '-i', input, '-frames:v', '1', '-y', outputPattern];

    case 'every-x-seconds': {
      const interval = options.everyXSeconds ?? 1;
      return [
        '-i', input,
        '-r', `1/${interval}`,
        '-y', outputPattern,
      ];
    }

    case 'custom':
    default:
      return [
        '-i', input,
        '-r', String(options.fps),
        '-y', outputPattern,
      ];
  }
}

export async function extractFrames(
  options: ExtractOptions,
  onProgress: (event: FrameExtractProgressEvent) => void
): Promise<{ frames: ExtractedFrame[]; outputDir: string }> {
  const ffmpegPath = await getFfmpegPath();

  onProgress({
    phase: 'probing',
    percent: 0,
    framesExtracted: 0,
    totalFrames: 0,
    message: 'Analyzing video...',
  });

  const probe = await probeVideo(options.videoPath);
  const expectedFrames = estimateFrameCount(
    probe.duration,
    options.preset,
    options.fps,
    options.everyXSeconds
  );

  const outputDir = path.join(os.tmpdir(), 'vidtsx-frames', crypto.randomUUID());
  await fs.mkdir(outputDir, { recursive: true });

  const ext = options.outputFormat === 'jpg' ? 'jpg' : 'png';
  const args = buildFfmpegArgs(options.videoPath, outputDir, options, ext);

  log.debug('Running ffmpeg', { ffmpegPath, args });

  onProgress({
    phase: 'extracting',
    percent: 0,
    framesExtracted: 0,
    totalFrames: expectedFrames,
    message: 'Extracting frames...',
  });

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    activeProcess = proc;

    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      const frameMatch = stderr.match(/frame=\s*(\d+)/g);
      if (frameMatch) {
        const lastMatch = frameMatch[frameMatch.length - 1];
        const count = parseInt(lastMatch.replace(/frame=\s*/, ''), 10);
        const percent = expectedFrames > 0
          ? Math.min(99, Math.round((count / expectedFrames) * 100))
          : 0;
        onProgress({
          phase: 'extracting',
          percent,
          framesExtracted: count,
          totalFrames: expectedFrames,
          message: `Extracted ${count} / ${expectedFrames} frames`,
        });
      }
    });

    proc.on('close', (code) => {
      activeProcess = null;
      if (code === 0) resolve();
      else {
        const lastLines = stderr.split('\n').slice(-10).join('\n');
        reject(new Error(`ffmpeg exited with code ${code}\n${lastLines}`));
      }
    });

    proc.on('error', (err) => {
      activeProcess = null;
      reject(err);
    });
  });

  onProgress({
    phase: 'reading',
    percent: 95,
    framesExtracted: expectedFrames,
    totalFrames: expectedFrames,
    message: 'Reading extracted frames...',
  });

  const files = await fs.readdir(outputDir);
  const frameFiles = files
    .filter((f) => f.startsWith('frame_') && f.endsWith(`.${ext}`))
    .sort();

  const frames: ExtractedFrame[] = frameFiles.map((fileName, idx) => {
    const extractionFps = options.preset === 'every-x-seconds'
      ? 1 / (options.everyXSeconds ?? 1)
      : options.preset === 'custom'
        ? options.fps
        : 1;
    const timestamp = extractionFps > 0 ? idx / extractionFps : 0;

    return {
      index: idx,
      timestamp,
      fileName,
      filePath: path.join(outputDir, fileName),
    };
  });

  onProgress({
    phase: 'reading',
    percent: 100,
    framesExtracted: frames.length,
    totalFrames: frames.length,
    message: `Extracted ${frames.length} frames`,
  });

  return { frames, outputDir };
}

export function cancelExtraction(): boolean {
  if (activeProcess) {
    activeProcess.kill('SIGTERM');
    activeProcess = null;
    return true;
  }
  return false;
}

export async function createFrameZip(
  framePaths: string[],
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    for (const fp of framePaths) {
      archive.file(fp, { name: path.basename(fp) });
    }

    archive.finalize();
  });
}

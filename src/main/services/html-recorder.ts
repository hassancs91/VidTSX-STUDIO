import { BrowserWindow } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import { logEngine } from '../../logging/log-engine';
import { loadHtmlInWindow, cleanupTempFile } from './html-loader';
import { getRemotionBinariesDir } from '../utils/paths';

const log = logEngine;
const FPS = 30;
const FRAME_INTERVAL = Math.round(1000 / FPS);

let recordingWin: BrowserWindow | null = null;
let ffmpegProc: ChildProcess | null = null;
let captureTimer: ReturnType<typeof setInterval> | null = null;
let outputFilePath: string | null = null;
let tempHtmlFile: string | null = null;
let isCapturing = false;
let pipeOpen = false;

async function getFfmpegPath(): Promise<string> {
  const { RenderInternals } = await import('@remotion/renderer');
  return RenderInternals.getExecutablePath({
    type: 'ffmpeg',
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });
}

export async function startRecording(
  html: string,
  width: number,
  height: number,
  filePath: string
): Promise<void> {
  if (recordingWin || ffmpegProc) {
    throw new Error('Recording already in progress');
  }

  outputFilePath = filePath;

  // Ensure even dimensions for H.264
  const w = width % 2 === 0 ? width : width + 1;
  const h = height % 2 === 0 ? height : height + 1;

  // Create hidden BrowserWindow to render HTML
  recordingWin = new BrowserWindow({
    width: w,
    height: h,
    show: false,
    webPreferences: {
      offscreen: true,
    },
  });

  // Load via temp file so CDN scripts/fonts/CSS load properly
  tempHtmlFile = await loadHtmlInWindow(recordingWin, html);

  // Spawn ffmpeg with explicit PNG input codec
  const ffmpegPath = await getFfmpegPath();

  ffmpegProc = spawn(ffmpegPath, [
    '-y',
    '-f', 'image2pipe',
    '-c:v', 'png',
    '-framerate', String(FPS),
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '23',
    '-movflags', '+faststart',
    filePath,
  ], { windowsHide: true });

  pipeOpen = true;

  ffmpegProc.stdin?.on('error', () => {
    pipeOpen = false;
  });

  ffmpegProc.stderr?.on('data', (data: Buffer) => {
    log.debug('HtmlRecorder', `ffmpeg: ${data.toString().trim()}`);
  });

  ffmpegProc.on('error', (err) => {
    log.error('HtmlRecorder', `ffmpeg error: ${err.message}`);
    pipeOpen = false;
  });

  ffmpegProc.on('close', () => {
    pipeOpen = false;
  });

  isCapturing = true;

  // Start frame capture loop
  captureTimer = setInterval(async () => {
    if (!isCapturing || !recordingWin || !pipeOpen) return;

    try {
      const image = await recordingWin.webContents.capturePage();
      if (!image.isEmpty() && pipeOpen && ffmpegProc?.stdin?.writable) {
        ffmpegProc.stdin.write(image.toPNG());
      }
    } catch {
      // Frame capture failed, skip this frame
    }
  }, FRAME_INTERVAL);

  log.info('HtmlRecorder', `Recording started: ${w}x${h} @ ${FPS}fps`);
}

export async function stopRecording(): Promise<string | null> {
  isCapturing = false;

  // Stop capture timer
  if (captureTimer) {
    clearInterval(captureTimer);
    captureTimer = null;
  }

  const filePath = outputFilePath;

  // Close ffmpeg stdin and wait for it to finish
  if (ffmpegProc) {
    const proc = ffmpegProc;
    ffmpegProc = null;

    await new Promise<void>((resolve) => {
      proc.on('close', (code) => {
        if (code === 0) {
          log.info('HtmlRecorder', `Recording saved: ${filePath}`);
        } else {
          log.error('HtmlRecorder', `ffmpeg exited with code ${code}`);
        }
        resolve();
      });

      if (pipeOpen) {
        proc.stdin?.end();
      }
    });
  }

  pipeOpen = false;

  // Destroy the hidden window
  if (recordingWin) {
    recordingWin.destroy();
    recordingWin = null;
  }

  // Clean up temp file
  if (tempHtmlFile) {
    await cleanupTempFile(tempHtmlFile);
    tempHtmlFile = null;
  }

  outputFilePath = null;

  return filePath;
}

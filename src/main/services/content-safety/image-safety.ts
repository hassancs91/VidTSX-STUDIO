import { nativeImage } from 'electron';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { safetyEngine } from '../../../content-safety-engine/safety-engine';
import { classifyBand } from '../../../content-safety-engine/bands';
import type { SafetyModelConfig } from '../../../content-safety-engine/types';
import { ModerationBlockedError } from '../../../shared/content-safety';
import { recordBlocked } from './blocked-counters';
import { getContentSafetyDir } from '../../utils/paths';
import { getFfmpegBinary } from '../studio/ffmpeg-bin';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('ContentSafety');

let modelConfig: SafetyModelConfig | null = null;
let loadFailure: Error | null = null;
let loading: Promise<void> | null = null;

/**
 * Load the bundled classifier into the worker (idempotent). Any failure is
 * remembered and re-thrown on every check — fail-closed, never fail-open.
 * A later retry is allowed only for transient spawn errors, which surface
 * again through safetyEngine's respawn-on-next-use behavior.
 */
async function ensureModelLoaded(): Promise<SafetyModelConfig> {
  if (modelConfig && safetyEngine.isLoaded()) return modelConfig;
  if (loadFailure) throw loadFailure;
  if (!loading) {
    loading = (async () => {
      const dir = getContentSafetyDir();
      const config = JSON.parse(
        await fs.readFile(path.join(dir, 'model-config.json'), 'utf-8'),
      ) as SafetyModelConfig;
      const modelPath = path.join(dir, config.file);
      const bytes = await fs.readFile(modelPath);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (sha256 !== config.sha256) {
        throw new Error(
          `Content Safety model integrity check failed (${sha256.slice(0, 12)}… ≠ recorded ${config.sha256.slice(0, 12)}…)`,
        );
      }
      await safetyEngine.loadModel(modelPath, config);
      modelConfig = config;
      log.info('Classifier loaded', { file: config.file, labels: config.labels });
    })().catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      loadFailure = error;
      log.error('Classifier load failed — visual generation is blocked (fail-closed)', {
        error: error.message,
      });
      throw error;
    });
  }
  await loading;
  return modelConfig!;
}

/** BGRA (Electron toBitmap) → tightly-packed RGB24. */
function bgraToRgb(bgra: Buffer, pixels: number): Uint8Array {
  const rgb = new Uint8Array(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    rgb[i * 3] = bgra[i * 4 + 2];
    rgb[i * 3 + 1] = bgra[i * 4 + 1];
    rgb[i * 3 + 2] = bgra[i * 4];
  }
  return rgb;
}

/**
 * ffmpeg fallback decode: any input format → one PNG at size×size, finished
 * by nativeImage (Remotion's trimmed ffmpeg has no rawvideo muxer — png over
 * image2pipe is what it ships).
 */
async function decodeWithFfmpeg(buffer: Buffer, size: number): Promise<Uint8Array> {
  const binary = await getFfmpegBinary('ffmpeg');
  const png = await new Promise<Buffer>((resolve, reject) => {
    const proc = spawn(binary, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-frames:v', '1',
      '-vf', `scale=${size}:${size}`,
      '-f', 'image2pipe', '-c:v', 'png',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const chunks: Buffer[] = [];
    let stderrTail = '';
    proc.stdout.on('data', (c: Buffer) => chunks.push(c));
    proc.stderr.on('data', (c: Buffer) => { stderrTail = (stderrTail + c.toString()).slice(-2000); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      const out = Buffer.concat(chunks);
      if (code === 0 && out.length > 0) {
        resolve(out);
      } else {
        reject(new Error(`ffmpeg decode failed (code ${code}): ${stderrTail}`));
      }
    });
    proc.stdin.on('error', () => {}); // EPIPE when ffmpeg rejects the input early
    proc.stdin.end(buffer);
  });

  const img = nativeImage.createFromBuffer(png);
  const bitmap = img.isEmpty() ? Buffer.alloc(0) : img.resize({ width: size, height: size }).toBitmap();
  if (bitmap.length !== size * size * 4) {
    throw new Error('ffmpeg produced an undecodable frame');
  }
  return bgraToRgb(bitmap, size * size);
}

/**
 * Decode + squash-resize to the model's square input, as raw RGB24.
 * Squash (not center-crop) on purpose: cropping can push explicit regions
 * out of frame; distortion costs the classifier less than truncation.
 */
async function decodeToModelInput(buffer: Buffer, size: number): Promise<Uint8Array> {
  const img = nativeImage.createFromBuffer(buffer);
  if (!img.isEmpty()) {
    const resized = img.resize({ width: size, height: size, quality: 'best' });
    const bitmap = resized.toBitmap();
    if (bitmap.length === size * size * 4) {
      return bgraToRgb(bitmap, size * size);
    }
  }
  return decodeWithFfmpeg(buffer, size);
}

/**
 * Content Safety Gate B — classify image bytes and throw on anything that
 * isn't clearly safe. Fail-closed at every step: classifier missing,
 * integrity mismatch, undecodable input, or inference error all block.
 *
 * @throws ModerationBlockedError when the classifier flags the image
 * @throws Error when the gate itself is unavailable (fail-closed)
 */
export async function checkImageBuffer(buffer: Buffer): Promise<void> {
  let config: SafetyModelConfig;
  try {
    config = await ensureModelLoaded();
  } catch (err) {
    throw new Error(
      `Content Safety is unavailable, so visual generation is blocked (fail-closed): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let rgb: Uint8Array;
  try {
    rgb = await decodeToModelInput(buffer, config.inputSize[1]);
  } catch (err) {
    // Undecodable input = blocked (Rev 1 decision 8) — an image the gate
    // cannot see is an image the gate cannot clear.
    throw new Error(
      `Content Safety could not decode this image, so it is blocked (fail-closed): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let nsfwProbability: number;
  try {
    nsfwProbability = await safetyEngine.classify(rgb);
  } catch (err) {
    throw new Error(
      `Content Safety inference failed, so this image is blocked (fail-closed): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const band = classifyBand(nsfwProbability);
  if (band !== 'pass') {
    log.info('Image blocked by classifier', { band, p: Number(nsfwProbability.toFixed(4)) });
    recordBlocked('image');
    throw new ModerationBlockedError('image', band);
  }
}

/** Convenience wrapper for the base64 payloads the image engine carries. */
export async function checkImageBase64(base64: string): Promise<void> {
  await checkImageBuffer(Buffer.from(base64, 'base64'));
}

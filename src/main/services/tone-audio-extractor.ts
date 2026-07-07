import { logEngine } from '../../logging/log-engine';
import { BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { ensureModuleServer, getModuleServerBaseUrl, storeTranspileResult } from './module-server';
import { transpileTsxCached } from './tsx-transpiler';
import { getTempDir, ensureTempDir } from '../utils/paths';

const log = logEngine.createLogger('ToneExtractor');

/**
 * Detect whether a TSX file imports Tone.js.
 * Matches `from 'tone'` and `from "tone"` — does not match
 * subpath imports like `from 'tone/build/...'` or unrelated
 * packages like `from 'tone-mapping'`.
 */
export function detectToneImport(content: string): boolean {
  return /from\s+['"]tone['"]/.test(content);
}

interface ToneExtractionParams {
  filePath: string;
  durationSeconds: number;
  fps: number;
  width?: number;
  height?: number;
  sampleRate?: number;
  onProgress?: (percent: number) => void;
}

interface ToneExtractionResult {
  success: boolean;
  wavPath?: string;
  error?: string;
  cleanup: () => Promise<void>;
}

const EXTRACTION_TIMEOUT_MS = 60000;

/**
 * Extract Tone.js audio from a user TSX composition.
 *
 * Opens a hidden BrowserWindow, loads the user's component inside a
 * Tone.OfflineContext, captures the rendered AudioBuffer as a WAV file,
 * and returns the path to the temp WAV.
 *
 * On failure returns { success: false } — the caller should proceed
 * with rendering without audio (graceful degradation).
 */
export async function extractToneAudio(params: ToneExtractionParams): Promise<ToneExtractionResult> {
  const {
    filePath,
    durationSeconds,
    fps,
    width = 1920,
    height = 1080,
    sampleRate = 44100,
    onProgress,
  } = params;

  const noop = async (): Promise<void> => {};

  log.info('Starting Tone.js audio extraction', { filePath, durationSeconds });

  // 1. Ensure module server is running and transpile user code
  try {
    await ensureModuleServer();
  } catch (err) {
    log.error('Failed to start module server for tone extraction', err);
    return { success: false, error: 'Module server failed to start', cleanup: noop };
  }

  const baseUrl = getModuleServerBaseUrl();
  if (!baseUrl) {
    return { success: false, error: 'Module server not available', cleanup: noop };
  }

  const transpileResult = await transpileTsxCached(filePath, baseUrl);
  if (!transpileResult.success) {
    return { success: false, error: transpileResult.error, cleanup: noop };
  }

  const moduleUrl = storeTranspileResult(transpileResult);

  // Use composition config from transpile result for accurate duration
  const compositionFps = transpileResult.config.fps || fps;
  const compositionDurationFrames = transpileResult.config.durationInFrames || Math.ceil(durationSeconds * compositionFps);
  const actualDuration = compositionDurationFrames / compositionFps;

  log.debug('User module transpiled for tone extraction', {
    moduleUrl,
    durationSeconds: actualDuration,
    durationInFrames: compositionDurationFrames,
    fps: compositionFps,
  });

  // 2. Prepare temp WAV path
  await ensureTempDir();
  const hash = createHash('md5').update(filePath + Date.now()).digest('hex').slice(0, 8);
  const wavPath = path.join(getTempDir(), `tone-audio-${hash}.wav`);

  // 3. Create hidden BrowserWindow
  // NOTE: do NOT use offscreen:true — it can throttle requestAnimationFrame
  // and prevent React from committing renders needed for frame iteration.
  const win = new BrowserWindow({
    show: false,
    width: 400,
    height: 300,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      // Critical: hidden/backgrounded windows throttle requestAnimationFrame
      // to ~1Hz by default, which makes our frame-by-frame extraction take
      // ~1s per frame (150 frames > 60s timeout). Disable throttling so RAF
      // fires at full speed even while the window is hidden.
      backgroundThrottling: false,
    },
  });

  // Pipe errors/warnings from the hidden window into the main log so React
  // errors and Tone.js warnings are visible. Skip info/log to avoid IPC
  // overhead — the virtual Remotion module logs on every hook invocation
  // which would flood the log and slow extraction by ~10x.
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level < 2) return; // 0=verbose, 1=info, 2=warn, 3=error
    const levelName = level === 3 ? 'error' : 'warn';
    const src = sourceId ? ` (${sourceId}:${line})` : '';
    log.warn(`[tone-extract-page] [${levelName}] ${message}${src}`);
  });

  try {
    // 4. Load the tone-extract page on the module server
    const extractUrl = `${baseUrl}/tone-extract`
      + `?moduleUrl=${encodeURIComponent(moduleUrl)}`
      + `&duration=${actualDuration}`
      + `&fps=${compositionFps}`
      + `&width=${width}`
      + `&height=${height}`
      + `&durationInFrames=${compositionDurationFrames}`
      + `&sampleRate=${sampleRate}`;

    log.debug('Loading tone extraction page', { extractUrl });
    await win.loadURL(extractUrl);

    // Poll the extraction page for progress updates and emit to onProgress
    let progressTimer: NodeJS.Timeout | null = null;
    if (onProgress) {
      onProgress(0);
      progressTimer = setInterval(() => {
        win.webContents
          .executeJavaScript('window.__TONE_EXTRACT_PROGRESS__ || null')
          .then((p: { percent?: number } | null) => {
            if (p && typeof p.percent === 'number') onProgress(p.percent);
          })
          .catch(() => {});
      }, 250);
    }

    // 5. Poll for result (page sets window.__TONE_EXTRACT_RESULT__)
    const resultJson: string = await win.webContents.executeJavaScript(`
      new Promise(function(resolve) {
        var check = function() {
          if (window.__TONE_EXTRACT_RESULT__) {
            resolve(JSON.stringify(window.__TONE_EXTRACT_RESULT__));
          } else {
            setTimeout(check, 100);
          }
        };
        setTimeout(function() {
          resolve(JSON.stringify({ success: false, error: 'Tone audio extraction timed out after ${EXTRACTION_TIMEOUT_MS / 1000}s' }));
        }, ${EXTRACTION_TIMEOUT_MS});
        check();
      })
    `);

    if (progressTimer) clearInterval(progressTimer);
    if (onProgress) onProgress(100);

    const result = JSON.parse(resultJson) as {
      success: boolean;
      wavBase64?: string;
      error?: string;
      debug?: Record<string, unknown>;
    };

    if (!result.success || !result.wavBase64) {
      const step = (result.debug?.step as string | undefined) ?? 'unknown';
      const errMsg = result.error || 'no error message';
      const stack = result.debug?.stack ? String(result.debug.stack) : '';
      log.error(
        `Tone extraction failed at step "${step}": ${errMsg}${stack ? '\n' + stack : ''}`
      );
      return { success: false, error: result.error || 'Unknown extraction error', cleanup: noop };
    }

    if (result.debug) {
      log.info('Tone extraction debug info', result.debug);
    }

    // 6. Decode base64 WAV and write to temp file
    const wavBuffer = Buffer.from(result.wavBase64, 'base64');
    await fs.writeFile(wavPath, wavBuffer);

    log.info('Tone.js audio extracted successfully', {
      wavPath,
      sizeBytes: wavBuffer.length,
      durationSeconds: actualDuration,
      peakAmplitude: result.debug?.peakAmplitude,
    });

    const cleanup = async (): Promise<void> => {
      try {
        await fs.unlink(wavPath);
        log.debug('Cleaned up tone audio temp file', { wavPath });
      } catch {
        // Ignore cleanup errors
      }
    };

    return { success: true, wavPath, cleanup };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error('Tone audio extraction failed', { error });
    return { success: false, error, cleanup: noop };
  } finally {
    win.destroy();
  }
}

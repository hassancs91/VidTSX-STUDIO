import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { OpenRouterClient, OpenRouterHttpError } from '../../shared/providers/openrouter';
import { findSttEntry } from '../../shared/presets/stt-models';
import type { SttModelFeatures } from '../../shared/presets/stt-models';
import { getRemotionBinariesDir } from '../../main/utils/paths';
import type {
  ProviderTranscribeRequest,
  SttRichResult,
  TranscriptionProvider,
} from '../types';
import { TranscriptionEngineError } from '../types';
import { round3 } from './map-stt-segments';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('OpenRouterStt');

// OpenRouter's STT endpoint has a ~60s upstream provider timeout, so long
// recordings are split into chunks transcribed sequentially. 120s of mono
// 16kHz PCM is ~3.8 MB (~5 MB base64) — safely inside JSON body limits while
// keeping the per-chunk transcription time well under the timeout.
const CHUNK_SECONDS = 120;
// PCM s16le mono 16kHz: bytes per second of audio (excludes the ~44B header).
const PCM_BYTES_PER_SECOND = 16000 * 2;

const NO_FEATURES: SttModelFeatures = {
  wordTimestamps: false,
  approximateWordTimestamps: false,
  speakerLabels: false,
  highlights: false,
  sentiment: false,
  audioEvents: false,
};

export class OpenRouterSttProvider implements TranscriptionProvider {
  readonly type = 'openrouter' as const;
  private readonly client: OpenRouterClient;

  constructor(
    readonly id: string,
    apiKey: string,
  ) {
    this.client = new OpenRouterClient({ apiKey });
  }

  getCapabilities(model: string): SttModelFeatures {
    return findSttEntry(`openrouter/${model}`)?.features ?? NO_FEATURES;
  }

  async transcribe(req: ProviderTranscribeRequest): Promise<SttRichResult> {
    req.onProgress(2, 'Splitting audio into chunks…');
    const chunkDir = path.join(
      app.getPath('temp'),
      'vidtsx-transcription',
      `openrouter-chunks-${Date.now()}`,
    );
    await fs.mkdir(chunkDir, { recursive: true });

    try {
      const chunks = await segmentToWavChunks(req.audioPath, chunkDir, req.signal);
      if (chunks.length === 0) {
        throw new TranscriptionEngineError('Audio produced no chunks to transcribe', this.id);
      }

      const language = req.language && req.language !== 'auto' ? req.language : undefined;
      const segments = [];
      const texts: string[] = [];
      let offset = 0;

      for (let i = 0; i < chunks.length; i++) {
        if (req.signal.aborted) throw new Error('aborted');
        req.onProgress(
          Math.round(5 + (i / chunks.length) * 90),
          `Transcribing chunk ${i + 1} of ${chunks.length}…`,
        );

        const data = await fs.readFile(chunks[i]);
        const chunkSeconds = Math.max(0, data.length - 44) / PCM_BYTES_PER_SECOND;

        let text: string;
        try {
          const res = await this.client.transcribeAudio(
            {
              model: req.model,
              audioBase64: data.toString('base64'),
              format: 'wav',
              language,
            },
            req.signal,
          );
          text = res.text.trim();
        } catch (err) {
          if (req.signal.aborted) throw new Error('aborted');
          if (err instanceof OpenRouterHttpError) {
            throw new TranscriptionEngineError(err.message, this.id, err);
          }
          throw err;
        }

        if (text.length > 0) {
          segments.push({
            id: segments.length,
            start: round3(offset),
            end: round3(offset + chunkSeconds),
            text,
          });
          texts.push(text);
        }
        offset += chunkSeconds;
      }

      req.onProgress(100, 'Transcript ready');
      log.info('Transcription complete', { chunks: chunks.length, model: req.model });

      return {
        result: {
          language: language ?? 'auto',
          duration: round3(offset),
          segments,
          text: texts.join(' ').trim(),
        },
      };
    } finally {
      fs.rm(chunkDir, { recursive: true, force: true }).catch(() => {
        /* best-effort temp cleanup */
      });
    }
  }
}

/** Split any audio file into sequential mono 16kHz PCM WAV chunks via ffmpeg. */
async function segmentToWavChunks(
  inputPath: string,
  outDir: string,
  signal: AbortSignal,
): Promise<string[]> {
  const { RenderInternals } = await import('@remotion/renderer');
  const ffmpegExe = RenderInternals.getExecutablePath({
    type: 'ffmpeg',
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });

  const pattern = path.join(outDir, 'chunk-%04d.wav');

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      ffmpegExe,
      [
        '-i', inputPath,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        '-f', 'segment',
        '-segment_time', String(CHUNK_SECONDS),
        '-y', pattern,
      ],
      { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
    );

    const onAbort = () => {
      proc.kill('SIGTERM');
      reject(new Error('aborted'));
    };
    signal.addEventListener('abort', onAbort, { once: true });

    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      signal.removeEventListener('abort', onAbort);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg segmentation failed with code ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', (err) => reject(new Error(`Failed to start FFmpeg: ${err.message}`)));
  });

  const files = await fs.readdir(outDir);
  return files
    .filter((f) => f.startsWith('chunk-') && f.endsWith('.wav'))
    .sort()
    .map((f) => path.join(outDir, f));
}

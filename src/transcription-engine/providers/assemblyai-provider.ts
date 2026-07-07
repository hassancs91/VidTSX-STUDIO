import fs from 'fs/promises';
import { findSttEntry } from '../../shared/presets/stt-models';
import type { SttModelFeatures } from '../../shared/presets/stt-models';
import type {
  ProviderTranscribeRequest,
  SttHighlight,
  SttRichResult,
  SttSentiment,
  SttUtterance,
  SttWord,
  TranscriptionProvider,
} from '../types';
import { TranscriptionEngineError } from '../types';
import { mapToTranscriptResult, round3 } from './map-stt-segments';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('AssemblyAI');

const BASE_URL = 'https://api.assemblyai.com/v2';
const POLL_INTERVAL_MS = 2000;
// Past this long, say the provider is slow rather than implying it's nearly done.
const SLOW_MS = 3 * 60 * 1000;

const FALLBACK_FEATURES: SttModelFeatures = {
  wordTimestamps: true,
  approximateWordTimestamps: false,
  speakerLabels: true,
  highlights: true,
  sentiment: true,
  audioEvents: false,
};

interface AaiWord {
  text: string;
  start: number; // ms
  end: number; // ms
  confidence?: number;
  speaker?: string | null;
}

interface AaiUtterance {
  text: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: string | null;
}

interface AaiTranscript {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  error?: string;
  text?: string | null;
  words?: AaiWord[] | null;
  utterances?: AaiUtterance[] | null;
  audio_duration?: number | null; // seconds
  language_code?: string | null;
  auto_highlights_result?: {
    results?: Array<{
      text: string;
      count: number;
      rank: number;
      timestamps?: Array<{ start: number; end: number }>;
    }>;
  } | null;
  sentiment_analysis_results?: Array<{
    text: string;
    start: number;
    end: number;
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  }> | null;
}

export class AssemblyAiProvider implements TranscriptionProvider {
  readonly type = 'assemblyai' as const;

  constructor(
    readonly id: string,
    private readonly apiKey: string,
  ) {}

  getCapabilities(model: string): SttModelFeatures {
    return findSttEntry(`assemblyai/${model}`)?.features ?? FALLBACK_FEATURES;
  }

  async transcribe(req: ProviderTranscribeRequest): Promise<SttRichResult> {
    // ── 1. Upload ──
    req.onProgress(5, 'Uploading audio…');
    const audioUrl = await this.upload(req.audioPath, req.signal);
    req.onProgress(20, 'Audio uploaded');
    if (req.signal.aborted) throw new Error('aborted');

    // ── 2. Create transcript ──
    const language = req.language && req.language !== 'auto' ? req.language : undefined;
    // auto_highlights / sentiment_analysis are English-only and conflict with
    // language_detection — only request them when we know the language is English.
    const englishKnown = language === 'en' || req.model === 'slam-1';
    const body: Record<string, unknown> = {
      audio_url: audioUrl,
      speech_model: req.model,
      punctuate: true,
      format_text: true,
      speaker_labels: req.detectSpeakers ?? false,
    };
    if (language) {
      body.language_code = language;
    } else if (req.model !== 'slam-1') {
      body.language_detection = true;
    }
    if (englishKnown && req.enableHighlights) body.auto_highlights = true;
    if (englishKnown && req.enableSentiment) body.sentiment_analysis = true;

    req.onProgress(25, 'Starting transcription…');
    const created = await this.request<AaiTranscript>('POST', '/transcript', body, req.signal);
    log.info('Transcription submitted', { transcriptId: created.id, model: req.model });

    // ── 3. Poll ──
    const start = Date.now();
    let job = created;
    while (job.status === 'queued' || job.status === 'processing') {
      if (req.signal.aborted) throw new Error('aborted');
      await wait(POLL_INTERVAL_MS, req.signal);
      job = await this.request<AaiTranscript>('GET', `/transcript/${created.id}`, undefined, req.signal);

      const elapsedMs = Date.now() - start;
      const elapsed = formatElapsed(elapsedMs);
      if (job.status === 'queued') {
        req.onProgress(35, `Waiting for a transcription slot… (${elapsed})`);
      } else if (job.status === 'processing') {
        req.onProgress(
          70,
          elapsedMs > SLOW_MS
            ? `Still transcribing — taking longer than usual… (${elapsed})`
            : `Transcribing your speech… (${elapsed})`,
        );
      }
    }

    if (job.status === 'error') {
      throw new TranscriptionEngineError(job.error || 'Transcription failed', this.id);
    }

    // ── 4. Map (ms → seconds) ──
    req.onProgress(98, 'Building transcript…');
    return this.mapJob(job, req);
  }

  private mapJob(job: AaiTranscript, req: ProviderTranscribeRequest): SttRichResult {
    const words: SttWord[] = (job.words ?? []).map((w) => ({
      text: w.text,
      start: round3(w.start / 1000),
      end: round3(w.end / 1000),
      confidence: w.confidence,
      speaker: w.speaker ?? undefined,
    }));
    const utterances: SttUtterance[] = (job.utterances ?? []).map((u) => ({
      text: u.text,
      start: round3(u.start / 1000),
      end: round3(u.end / 1000),
      confidence: u.confidence,
      speaker: u.speaker ?? undefined,
    }));
    const highlights: SttHighlight[] = (job.auto_highlights_result?.results ?? []).map((h) => ({
      text: h.text,
      count: h.count,
      rank: h.rank,
      timestamps: (h.timestamps ?? []).map((t) => ({
        start: round3(t.start / 1000),
        end: round3(t.end / 1000),
      })),
    }));
    const sentiments: SttSentiment[] = (job.sentiment_analysis_results ?? []).map((s) => ({
      text: s.text,
      start: round3(s.start / 1000),
      end: round3(s.end / 1000),
      sentiment: s.sentiment,
    }));

    const result = mapToTranscriptResult({
      words,
      utterances,
      text: job.text ?? undefined,
      durationSeconds: job.audio_duration ?? undefined,
      detectedLanguage: job.language_code ?? undefined,
      requestedLanguage: req.language,
      detectSpeakers: req.detectSpeakers ?? false,
    });

    return { result, words, utterances, highlights, sentiments };
  }

  private async upload(audioPath: string, signal: AbortSignal): Promise<string> {
    const data = await fs.readFile(audioPath);
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          authorization: this.apiKey,
          'content-type': 'application/octet-stream',
        },
        body: new Uint8Array(data),
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw new Error('aborted');
      throw new TranscriptionEngineError('Network error uploading to AssemblyAI', this.id, error);
    }
    if (!response.ok) {
      throw new TranscriptionEngineError(
        `AssemblyAI upload failed (${response.status})`,
        this.id,
        await response.text().catch(() => undefined),
      );
    }
    const json = (await response.json()) as { upload_url?: string };
    if (!json.upload_url) {
      throw new TranscriptionEngineError('AssemblyAI upload returned no URL', this.id);
    }
    return json.upload_url;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          authorization: this.apiKey,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw new Error('aborted');
      throw new TranscriptionEngineError('Network error connecting to AssemblyAI', this.id, error);
    }
    if (!response.ok) {
      let message = `AssemblyAI returned ${response.status}`;
      try {
        const errBody = (await response.json()) as { error?: string };
        if (errBody.error) message = errBody.error;
      } catch {
        // ignore parse error
      }
      throw new TranscriptionEngineError(message, this.id);
    }
    return (await response.json()) as T;
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error('aborted'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

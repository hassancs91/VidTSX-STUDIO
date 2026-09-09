// ElevenLabs Scribe STT provider (NEXT_FEATURES_DESIGN.md Q3).
//
// One synchronous multipart request — no webhook (we are local-first with no
// receiver) and no polling (the sync API blocks until done, and the pipeline
// always hands us pre-extracted audio, so payloads are small). The response's
// words[] mixes types: 'spacing' and 'audio_event' entries must be filtered
// when mapping to SttWord — they would pollute captions and auto-cut.

import fs from 'fs/promises';
import path from 'path';
import { findSttEntry } from '../../shared/presets/stt-models';
import type { SttModelFeatures } from '../../shared/presets/stt-models';
import type {
  ProviderTranscribeRequest,
  SttRichResult,
  SttUtterance,
  SttWord,
  TranscriptionProvider,
} from '../types';
import { TranscriptionEngineError } from '../types';
import { mapToTranscriptResult, round3 } from './map-stt-segments';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('ElevenLabs');

const BASE_URL = 'https://api.elevenlabs.io/v1';
const PROGRESS_TICK_MS = 2000;
// Past this long, say the provider is slow rather than implying it's nearly done.
const SLOW_MS = 3 * 60 * 1000;

// Scribe's `keyterms` (API reference, 2026-09-09): at most 1 000 entries,
// each under 50 characters and at most 5 words.
const KEYTERMS_MAX = 1000;
const KEYTERM_MAX_CHARS = 49;
const KEYTERM_MAX_WORDS = 5;

/** The keyterms Scribe accepts, deduped and within its limits. */
export function elevenLabsKeyterms(keyterms: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keyterms ?? []) {
    const term = raw.replace(/\s+/g, ' ').trim();
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    if (term.length > KEYTERM_MAX_CHARS || term.split(' ').length > KEYTERM_MAX_WORDS) continue;
    out.push(term);
    if (out.length >= KEYTERMS_MAX) break;
  }
  return out;
}

const FALLBACK_FEATURES: SttModelFeatures = {
  wordTimestamps: true,
  approximateWordTimestamps: false,
  speakerLabels: true,
  highlights: false,
  sentiment: false,
  audioEvents: true,
  // Held off until Scribe's verbatim behavior is proven on real footage —
  // the auto-cut filler pass depends on verbatim "um"/"uh" (Q3, decided).
  verbatimDisfluencies: false,
};

interface ElWord {
  text: string;
  type?: 'word' | 'spacing' | 'audio_event';
  start?: number; // seconds
  end?: number; // seconds
  speaker_id?: string | null;
}

interface ElTranscript {
  language_code?: string | null;
  text?: string | null;
  words?: ElWord[] | null;
}

export class ElevenLabsProvider implements TranscriptionProvider {
  readonly type = 'elevenlabs' as const;

  constructor(
    readonly id: string,
    private readonly apiKey: string,
  ) {}

  getCapabilities(model: string): SttModelFeatures {
    return findSttEntry(`elevenlabs/${model}`)?.features ?? FALLBACK_FEATURES;
  }

  async transcribe(req: ProviderTranscribeRequest): Promise<SttRichResult> {
    req.onProgress(5, 'Uploading audio…');
    const data = await fs.readFile(req.audioPath);
    if (req.signal.aborted) throw new Error('aborted');

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(data)], { type: 'audio/wav' }),
      path.basename(req.audioPath),
    );
    form.append('model_id', req.model);
    const language = req.language && req.language !== 'auto' ? req.language : undefined;
    if (language) form.append('language_code', language);
    form.append('diarize', String(req.detectSpeakers ?? false));
    form.append('timestamps_granularity', 'word');
    form.append('tag_audio_events', 'true');
    // W4 vocabulary feed: one repeated multipart field per keyterm.
    const keyterms = elevenLabsKeyterms(req.keyterms);
    for (const term of keyterms) form.append('keyterms', term);
    if (keyterms.length > 0) {
      log.info('Keyterms sent', { field: 'keyterms', count: keyterms.length, sample: keyterms.slice(0, 5) });
    }

    // The sync call covers upload AND processing in one await — tick elapsed
    // time so long files don't look hung.
    const start = Date.now();
    const ticker = setInterval(() => {
      const elapsedMs = Date.now() - start;
      req.onProgress(
        70,
        elapsedMs > SLOW_MS
          ? `Still transcribing — taking longer than usual… (${formatElapsed(elapsedMs)})`
          : `Transcribing your speech… (${formatElapsed(elapsedMs)})`,
      );
    }, PROGRESS_TICK_MS);

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/speech-to-text`, {
        method: 'POST',
        headers: { 'xi-api-key': this.apiKey },
        body: form,
        signal: req.signal,
      });
    } catch (error) {
      if (req.signal.aborted) throw new Error('aborted');
      throw new TranscriptionEngineError('Network error connecting to ElevenLabs', this.id, error);
    } finally {
      clearInterval(ticker);
    }

    if (!response.ok) {
      throw new TranscriptionEngineError(
        authFailureMessage(response.status) ?? (await errorBodyMessage(response)),
        this.id,
      );
    }

    const job = (await response.json()) as ElTranscript;
    log.info('Transcription complete', { model: req.model, words: job.words?.length ?? 0 });

    req.onProgress(98, 'Building transcript…');
    return this.mapJob(job, req);
  }

  private mapJob(job: ElTranscript, req: ProviderTranscribeRequest): SttRichResult {
    const words: SttWord[] = [];
    let audioEventsSeen = false;
    for (const w of job.words ?? []) {
      if (w.type === 'audio_event') {
        audioEventsSeen = true;
        continue;
      }
      if (w.type === 'spacing') continue;
      const text = w.text?.trim();
      if (!text || typeof w.start !== 'number' || typeof w.end !== 'number') continue;
      words.push({
        text,
        start: round3(w.start),
        end: round3(w.end),
        speaker: w.speaker_id ?? undefined,
      });
    }

    // Scribe returns no utterances — derive them from speaker runs so
    // diarization reaches the segment level (mapToTranscriptResult only
    // stamps segment speakers from utterances). Without diarization the
    // word-grouping fallback produces better caption-sized segments.
    const utterances =
      (req.detectSpeakers ?? false) && words.some((w) => w.speaker)
        ? groupWordsIntoUtterances(words)
        : [];

    const result = mapToTranscriptResult({
      words,
      utterances,
      text: job.text ?? undefined,
      detectedLanguage: job.language_code ?? undefined,
      requestedLanguage: req.language,
      detectSpeakers: req.detectSpeakers ?? false,
    });

    // Snapshot of what this run actually delivered, not just what the model
    // could do (the per-run features rule).
    const features: SttModelFeatures = {
      ...this.getCapabilities(req.model),
      speakerLabels: (req.detectSpeakers ?? false) && words.some((w) => w.speaker),
      audioEvents: audioEventsSeen,
    };

    return {
      result,
      words: words.length > 0 ? words : undefined,
      utterances: utterances.length > 0 ? utterances : undefined,
      features,
    };
  }
}

/**
 * Group words into utterances for diarized runs: break on speaker change,
 * sentence-ending punctuation, pauses, and caption-sane length caps (the
 * word-grouping fallback's limits, plus the speaker rule).
 */
export function groupWordsIntoUtterances(words: SttWord[]): SttUtterance[] {
  const MAX_SECONDS = 10;
  const MAX_WORDS = 14;
  const MAX_GAP = 1.0;
  const utterances: SttUtterance[] = [];
  let bucket: SttWord[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const first = bucket[0];
    utterances.push({
      text: bucket.map((w) => w.text).join(' ').replace(/\s+([.,!?;:])/g, '$1').trim(),
      start: round3(first.start),
      end: round3(bucket[bucket.length - 1].end),
      speaker: first.speaker,
    });
    bucket = [];
  };

  for (const w of words) {
    const prev = bucket[bucket.length - 1];
    if (prev && (prev.speaker !== w.speaker || w.start - prev.end > MAX_GAP)) flush();
    bucket.push(w);
    const span = w.end - bucket[0].start;
    const endsSentence = /[.!?]["')\]]?$/.test(w.text.trim());
    if (endsSentence || span >= MAX_SECONDS || bucket.length >= MAX_WORDS) flush();
  }
  flush();
  return utterances;
}

/** A 401/403 is an API-key problem, not an upload/network problem — say so. */
function authFailureMessage(status: number): string | undefined {
  return status === 401 || status === 403
    ? 'ElevenLabs rejected the API key — check your ElevenLabs key in Settings.'
    : undefined;
}

async function errorBodyMessage(response: Response): Promise<string> {
  const fallback = `ElevenLabs returned ${response.status}`;
  try {
    const body = (await response.json()) as { detail?: { message?: string } | string };
    if (typeof body.detail === 'string') return body.detail;
    if (body.detail?.message) return body.detail.message;
  } catch {
    // ignore parse error
  }
  return fallback;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

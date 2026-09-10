// Provider-agnostic transcription orchestrator (replaces transcribeWithVidtsx):
// resolve catalog entry → resolve provider → extract WAV (video inputs) →
// provider.transcribe → rich result. One run at a time; cancel aborts it.

import fs from 'fs/promises';
import { transcriptionEngine } from '../../../transcription-engine';
import type { SttRichResult } from '../../../transcription-engine';
import { findSttEntry } from '../../../shared/presets/stt-models';
import type {
  SttTranscribePhase,
  SttTranscribeRunRequest,
} from '../../../shared/ipc/types/stt';
import type { AiFeatureSource } from '../../../shared/types/ai-usage';
import { extractAudioToWav, isAudioFile } from './extract-audio';
import { aiUsageService } from '../ai-usage';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('stt-run');

export type SttProgressCallback = (
  phase: SttTranscribePhase,
  percent: number,
  message: string,
) => void;

let activeController: AbortController | null = null;
let activeTempAudioPath: string | null = null;

export interface TranscribeAudioFileParams {
  /** A ready-to-use audio file (no extraction is performed here). */
  audioPath: string;
  /** STT catalog id from @shared/presets/stt-models. */
  sttModelId: string;
  language?: string;
  detectSpeakers?: boolean;
  enableHighlights?: boolean;
  enableSentiment?: boolean;
  /** Keep disfluencies ("um"/"uh") verbatim when the model supports it. */
  verbatim?: boolean;
  /** W4: names to bias recognition toward — brand vocabulary, script names. */
  keyterms?: string[];
  /** Usage attribution; `'transcription'` unless a flow node runs this (W8 Stage 3). */
  featureSource?: AiFeatureSource;
  signal: AbortSignal;
  onProgress: (percent: number, message: string) => void;
}

/**
 * Core provider call: resolve catalog entry + provider, gate option flags by
 * the model's capabilities, transcribe. No global cancel state — callers with
 * their own pipeline (auto-cut) use this directly with their own signal.
 */
export async function transcribeAudioFile(params: TranscribeAudioFileParams): Promise<SttRichResult> {
  const entry = findSttEntry(params.sttModelId);
  if (!entry) {
    throw new Error(`Unknown transcription model "${params.sttModelId}"`);
  }
  const provider = transcriptionEngine.getProvider(entry.provider);
  if (!provider) {
    throw new Error(
      entry.provider === 'local-whisper'
        ? 'Local Whisper is not available.'
        : `Transcription provider "${entry.provider}" is not configured. Add its API key in Settings > API Keys.`,
    );
  }

  const language = params.language && params.language !== 'auto' ? params.language : undefined;
  const start = Date.now();
  const rich = await transcriptionEngine.transcribeWith(entry.provider, {
    audioPath: params.audioPath,
    model: entry.model,
    language,
    detectSpeakers: params.detectSpeakers && entry.features.speakerLabels,
    enableHighlights: params.enableHighlights && entry.features.highlights,
    enableSentiment: params.enableSentiment && entry.features.sentiment,
    verbatim: params.verbatim && entry.features.verbatimDisfluencies,
    ...(params.keyterms && params.keyterms.length > 0 ? { keyterms: params.keyterms } : {}),
    signal: params.signal,
    onProgress: params.onProgress,
  });

  // Usage log (fire-and-forget) — every STT caller (Transcribe screen, Studio
  // asset-transcriber, auto-cut) funnels through here. Cost is the catalog's
  // informational per-hour estimate × transcript audio duration; local whisper
  // and unpriced entries log $0.
  aiUsageService.appendEntry({
    timestamp: new Date().toISOString(),
    provider: entry.provider,
    model: entry.model,
    featureSource: params.featureSource ?? 'transcription',
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    costUsd: (entry.pricePerHourUsd ?? 0) * ((rich.result.duration || 0) / 3600),
    durationMs: Date.now() - start,
    requestType: 'stt',
  }).catch(() => {});

  return rich;
}

export async function runSttTranscription(
  req: SttTranscribeRunRequest,
  onProgress: SttProgressCallback,
  externalSignal?: AbortSignal,
): Promise<SttRichResult> {
  const controller = new AbortController();
  activeController = controller;
  const signal = controller.signal;
  externalSignal?.addEventListener('abort', () => controller.abort(), { once: true });

  let extractedAudioPath: string | null = null;

  try {
    // ── 1. Extract audio (video only) ──
    let audioPath = req.inputPath;
    if (!isAudioFile(req.inputPath)) {
      onProgress('extracting', 0, 'Extracting audio from your video…');
      extractedAudioPath = await extractAudioToWav(req.inputPath, signal, (pct) => {
        onProgress('extracting', pct, 'Extracting audio from your video…');
      });
      activeTempAudioPath = extractedAudioPath;
      audioPath = extractedAudioPath;
    }
    if (signal.aborted) throw new Error('aborted');

    // ── 2. Transcribe via provider ──
    onProgress('transcribing', 0, 'Starting transcription…');
    log.info('transcription started', { model: req.sttModelId });

    const rich = await transcribeAudioFile({
      audioPath,
      sttModelId: req.sttModelId,
      language: req.language,
      detectSpeakers: req.detectSpeakers,
      enableHighlights: req.enableHighlights,
      enableSentiment: req.enableSentiment,
      ...(req.keyterms ? { keyterms: req.keyterms } : {}),
      signal,
      onProgress: (percent, message) => onProgress('transcribing', percent, message),
    });

    onProgress('parsing', 100, 'Building transcript…');
    return rich;
  } finally {
    activeController = null;
    if (extractedAudioPath) {
      activeTempAudioPath = null;
      fs.unlink(extractedAudioPath).catch(() => {
        /* best-effort temp cleanup */
      });
    }
  }
}

export function cancelSttTranscription(): boolean {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
  if (activeTempAudioPath) {
    const p = activeTempAudioPath;
    activeTempAudioPath = null;
    fs.unlink(p).catch(() => {
      /* best-effort */
    });
  }
  return true;
}

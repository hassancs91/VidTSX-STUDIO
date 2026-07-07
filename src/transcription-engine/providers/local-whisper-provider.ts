import { whisperService } from '../../main/services/whisper';
import { findSttEntry } from '../../shared/presets/stt-models';
import type { SttModelFeatures } from '../../shared/presets/stt-models';
import type { TranscriptSegment } from '../../shared/ipc/types/whisper';
import type {
  ProviderTranscribeRequest,
  SttRichResult,
  SttUtterance,
  SttWord,
  TranscriptionProvider,
} from '../types';

const FALLBACK_FEATURES: SttModelFeatures = {
  wordTimestamps: false,
  approximateWordTimestamps: true,
  speakerLabels: false,
  highlights: false,
  sentiment: false,
  audioEvents: false,
};

export class LocalWhisperProvider implements TranscriptionProvider {
  readonly type = 'local-whisper' as const;

  constructor(readonly id: string) {}

  getCapabilities(model: string): SttModelFeatures {
    return findSttEntry(`local-whisper/${model}`)?.features ?? FALLBACK_FEATURES;
  }

  async transcribe(req: ProviderTranscribeRequest): Promise<SttRichResult> {
    const onAbort = () => whisperService.cancelTranscription();
    req.signal.addEventListener('abort', onAbort, { once: true });

    try {
      if (req.signal.aborted) throw new Error('aborted');

      const result = await whisperService.transcribe(
        { inputPath: req.audioPath, modelId: req.model, language: req.language },
        (_phase, percent, message) => {
          req.onProgress(percent, message ?? 'Transcribing…');
        },
      );

      if (req.signal.aborted) throw new Error('aborted');

      // Build rich extras from segments: utterances mirror segments (whisper
      // has no diarization); words are approximated by character distribution
      // so timing-based consumers (auto-cut) still get word-level anchors.
      const utterances: SttUtterance[] = result.segments.map((s) => ({
        text: s.text,
        start: s.start,
        end: s.end,
      }));
      const words: SttWord[] = result.segments.flatMap((s) => deriveApproximateWords(s));

      // Attach approximate words to segments lacking them so caption tooling works.
      const segments = result.segments.map((s) =>
        s.words && s.words.length > 0
          ? s
          : { ...s, words: deriveApproximateWords(s).map(({ text, start, end }) => ({ text, start, end })) },
      );

      return {
        result: { ...result, segments },
        words,
        utterances,
      };
    } finally {
      req.signal.removeEventListener('abort', onAbort);
    }
  }

  cancel(): void {
    whisperService.cancelTranscription();
  }
}

/**
 * Approximate per-word timing by distributing the segment's time span across
 * its words proportionally to character length. Not exact — whisper.cpp's JSON
 * output has segment bounds only — but close enough for captions and cut anchors.
 */
function deriveApproximateWords(segment: TranscriptSegment): SttWord[] {
  if (segment.words && segment.words.length > 0) {
    return segment.words.map((w) => ({ text: w.text, start: w.start, end: w.end }));
  }

  const tokens = segment.text.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return [];

  const span = Math.max(0, segment.end - segment.start);
  const totalChars = tokens.reduce((sum, t) => sum + t.length, 0) || 1;

  const words: SttWord[] = [];
  let cursor = segment.start;
  for (const token of tokens) {
    const width = (token.length / totalChars) * span;
    const start = cursor;
    const end = Math.min(segment.end, cursor + width);
    words.push({
      text: token,
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
    });
    cursor = end;
  }
  return words;
}

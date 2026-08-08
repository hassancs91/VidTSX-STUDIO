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
  wordTimestamps: true,
  approximateWordTimestamps: true,
  speakerLabels: false,
  highlights: false,
  sentiment: false,
  audioEvents: false,
  verbatimDisfluencies: false,
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

      // whisper.cpp's full JSON output carries measured token-level timings
      // that arrive merged into segment words. Segments without them (or a
      // whole run without them, e.g. an old binary) fall back to
      // character-distribution approximation — the features snapshot records
      // which of the two this run actually delivered.
      const measured = result.segments.some((s) => s.words && s.words.length > 0);

      const utterances: SttUtterance[] = result.segments.map((s) => ({
        text: s.text,
        start: s.start,
        end: s.end,
      }));

      const segments = result.segments.map((s) =>
        s.words && s.words.length > 0 ? s : { ...s, words: deriveApproximateWords(s) },
      );
      const words: SttWord[] = segments.flatMap(
        (s) =>
          s.words?.map((w) => ({
            text: w.text,
            start: w.start,
            end: w.end,
            ...(w.confidence !== undefined ? { confidence: w.confidence } : {}),
          })) ?? [],
      );

      const features: SttModelFeatures = {
        ...this.getCapabilities(req.model),
        wordTimestamps: measured,
        approximateWordTimestamps: !measured,
      };

      return {
        result: { ...result, segments },
        words,
        utterances,
        features,
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
 * its words proportionally to character length. The fallback when whisper's
 * token-level data is unavailable — close enough for captions and for cut
 * anchors once the RMS snap pads are widened.
 */
function deriveApproximateWords(segment: TranscriptSegment): SttWord[] {
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

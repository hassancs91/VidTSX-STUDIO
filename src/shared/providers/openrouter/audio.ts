import type { OpenRouterClient } from './openrouter-client';
import type {
  OpenRouterTranscriptionRequest,
  OpenRouterTranscriptionResult,
  OpenRouterUsage,
} from './types';

interface TranscriptionApiResponse {
  text?: string;
  usage?: OpenRouterUsage;
  error?: { message?: string; code?: number };
}

export async function transcribeAudio(
  client: OpenRouterClient,
  req: OpenRouterTranscriptionRequest,
  signal?: AbortSignal,
): Promise<OpenRouterTranscriptionResult> {
  const body: Record<string, unknown> = {
    model: req.model,
    input_audio: {
      data: req.audioBase64,
      format: req.format,
    },
  };
  if (req.language) body.language = req.language;
  if (req.temperature !== undefined) body.temperature = req.temperature;

  const data = await client.postJson<TranscriptionApiResponse>(
    'audio/transcriptions',
    body,
    signal,
  );

  return { text: data.text ?? '', usage: data.usage, raw: data };
}

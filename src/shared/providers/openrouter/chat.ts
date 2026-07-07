import type { OpenRouterClient } from './openrouter-client';
import type {
  OpenRouterChatApiResponse,
  OpenRouterChatRequest,
  OpenRouterChatResult,
} from './types';

export async function chatCompletion(
  client: OpenRouterClient,
  req: OpenRouterChatRequest,
  signal?: AbortSignal,
): Promise<OpenRouterChatResult> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
  };
  if (req.modalities) body.modalities = req.modalities;
  if (req.imageConfig) body.image_config = req.imageConfig;
  if (req.n !== undefined) body.n = req.n;
  if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
  if (req.temperature !== undefined) body.temperature = req.temperature;

  const data = await client.postJson<OpenRouterChatApiResponse>(
    'chat/completions',
    body,
    signal,
  );

  const images: Array<{ dataUri: string }> = [];
  let text: string | undefined;

  for (const choice of data.choices ?? []) {
    const msg = choice.message;
    if (typeof msg.content === 'string' && msg.content && text === undefined) {
      text = msg.content;
    }
    for (const entry of msg.images ?? []) {
      if (entry.type === 'image_url' && entry.image_url?.url) {
        images.push({ dataUri: entry.image_url.url });
      }
    }
  }

  return { text, images, usage: data.usage, raw: data };
}

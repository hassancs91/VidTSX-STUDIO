import type { OpenRouterClient } from './openrouter-client';
import { chatCompletion } from './chat';
import type { OpenRouterChatRequest, OpenRouterChatResult } from './types';

export async function generateImage(
  client: OpenRouterClient,
  req: OpenRouterChatRequest,
  signal?: AbortSignal,
): Promise<OpenRouterChatResult> {
  return chatCompletion(
    client,
    { ...req, modalities: req.modalities ?? ['image'] },
    signal,
  );
}

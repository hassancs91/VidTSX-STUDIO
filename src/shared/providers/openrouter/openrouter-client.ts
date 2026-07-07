import { logEngine } from '../../../logging/log-engine';
import { OpenRouterHttpError } from './errors';
import { chatCompletion } from './chat';
import { generateImage } from './images';
import { transcribeAudio } from './audio';
import type {
  OpenRouterChatRequest,
  OpenRouterChatResult,
  OpenRouterClientOptions,
  OpenRouterTranscriptionRequest,
  OpenRouterTranscriptionResult,
} from './types';

const log = logEngine.createLogger('OpenRouterClient');

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: OpenRouterClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  }

  async postJson<TResponse>(
    path: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<TResponse> {
    const url = `${this.baseUrl}/${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      log.error('Network error connecting to OpenRouter', error);
      throw new OpenRouterHttpError('Network error connecting to OpenRouter', undefined, error);
    }

    if (!response.ok) {
      let errorMessage = `OpenRouter returned ${response.status}`;
      try {
        const errorBody = (await response.json()) as { error?: { message?: string } };
        if (errorBody.error?.message) {
          errorMessage = errorBody.error.message;
        }
      } catch {
        // ignore parse error
      }
      log.error('OpenRouter API error', new Error(errorMessage), { status: response.status });
      throw new OpenRouterHttpError(errorMessage, response.status);
    }

    const data = (await response.json()) as TResponse & {
      error?: { message?: string; code?: number };
    };

    if (data.error) {
      const message = data.error.message || 'OpenRouter returned an error';
      log.error('OpenRouter returned an error', new Error(message), { code: data.error.code });
      throw new OpenRouterHttpError(message, data.error.code);
    }

    return data;
  }

  async chatCompletion(
    req: OpenRouterChatRequest,
    signal?: AbortSignal,
  ): Promise<OpenRouterChatResult> {
    return chatCompletion(this, req, signal);
  }

  async generateImage(
    req: OpenRouterChatRequest,
    signal?: AbortSignal,
  ): Promise<OpenRouterChatResult> {
    return generateImage(this, req, signal);
  }

  async transcribeAudio(
    req: OpenRouterTranscriptionRequest,
    signal?: AbortSignal,
  ): Promise<OpenRouterTranscriptionResult> {
    return transcribeAudio(this, req, signal);
  }
}

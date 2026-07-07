import { logEngine } from '../../../logging/log-engine';
import { FalHttpError } from './errors';
import type {
  FalClientOptions,
  FalQueueStatus,
  FalQueueStatusResult,
  FalQueueSubmitResult,
} from './types';

const log = logEngine.createLogger('FalQueue');

const QUEUE_BASE_URL = 'https://queue.fal.run';

interface QueueSubmitApiResponse {
  request_id: string;
  status_url: string;
  response_url: string;
}

interface QueueStatusApiResponse {
  status: FalQueueStatus;
  error?: unknown;
  logs?: Array<{ message?: string }>;
}

/**
 * Client for fal.ai's async queue API (long-running jobs like video generation).
 * IMPORTANT: status/result polling MUST use the URLs returned by submit verbatim —
 * subpath endpoints (e.g. fal-ai/veo3/fast) poll at the base app path, so
 * constructing poll URLs by string concatenation breaks.
 */
export class FalQueueClient {
  private readonly apiKey: string;

  constructor(opts: FalClientOptions) {
    this.apiKey = opts.apiKey;
  }

  async submit(
    endpoint: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<FalQueueSubmitResult> {
    const data = await this.request<QueueSubmitApiResponse>(
      `${QUEUE_BASE_URL}/${endpoint}`,
      { method: 'POST', body },
      signal,
    );
    if (!data.request_id || !data.status_url || !data.response_url) {
      throw new FalHttpError('Fal.ai queue submit returned an unexpected response');
    }
    return {
      requestId: data.request_id,
      statusUrl: data.status_url,
      responseUrl: data.response_url,
    };
  }

  async status(statusUrl: string, signal?: AbortSignal): Promise<FalQueueStatusResult> {
    const data = await this.request<QueueStatusApiResponse>(
      statusUrl,
      { method: 'GET' },
      signal,
    );
    return { status: data.status, error: data.error };
  }

  async result<TResponse>(responseUrl: string, signal?: AbortSignal): Promise<TResponse> {
    return this.request<TResponse>(responseUrl, { method: 'GET' }, signal);
  }

  private async request<TResponse>(
    url: string,
    init: { method: 'GET' | 'POST'; body?: Record<string, unknown> },
    signal?: AbortSignal,
  ): Promise<TResponse> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: init.method,
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal,
      });
    } catch (error) {
      log.error('Network error connecting to Fal.ai queue', error);
      throw new FalHttpError('Network error connecting to Fal.ai queue', undefined, error);
    }

    if (!response.ok) {
      let errorMessage = `Fal.ai queue returned ${response.status}`;
      try {
        const errorBody = (await response.json()) as { detail?: string };
        if (errorBody.detail) {
          errorMessage =
            typeof errorBody.detail === 'string'
              ? errorBody.detail
              : JSON.stringify(errorBody.detail);
        }
      } catch {
        // ignore parse error
      }
      log.error('Fal.ai queue API error', new Error(errorMessage), { status: response.status });
      throw new FalHttpError(errorMessage, response.status);
    }

    return (await response.json()) as TResponse;
  }
}

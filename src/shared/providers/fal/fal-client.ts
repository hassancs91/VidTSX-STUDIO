import { logEngine } from '../../../logging/log-engine';
import { FalHttpError } from './errors';
import type { FalClientOptions, FalDownloadResult } from './types';

const log = logEngine.createLogger('FalClient');

const DEFAULT_BASE_URL = 'https://fal.run';

export class FalClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: FalClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  }

  async post<TResponse>(
    endpoint: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<TResponse> {
    const url = `${this.baseUrl}/${endpoint}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      log.error('Network error connecting to Fal.ai', error);
      throw new FalHttpError('Network error connecting to Fal.ai', undefined, error);
    }

    if (!response.ok) {
      let errorMessage = `Fal.ai returned ${response.status}`;
      try {
        const errorBody = (await response.json()) as { detail?: string };
        if (errorBody.detail) {
          errorMessage = errorBody.detail;
        }
      } catch {
        // ignore parse error
      }
      log.error('Fal.ai API error', new Error(errorMessage), { status: response.status });
      throw new FalHttpError(errorMessage, response.status);
    }

    return (await response.json()) as TResponse;
  }

  async downloadAsBase64(url: string, signal?: AbortSignal): Promise<FalDownloadResult> {
    let response: Response;
    try {
      response = await fetch(url, { signal });
    } catch (error) {
      log.error('Network error downloading Fal.ai asset', error);
      throw new FalHttpError('Network error downloading Fal.ai asset', undefined, error);
    }

    if (!response.ok) {
      throw new FalHttpError(
        `Failed to download Fal.ai asset: ${response.status}`,
        response.status,
      );
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';

    return { base64, contentType };
  }
}

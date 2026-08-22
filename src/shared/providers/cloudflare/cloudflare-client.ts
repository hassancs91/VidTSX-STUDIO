import { logEngine } from '../../../logging/log-engine';
import { CloudflareHttpError } from './errors';
import type { CloudflareClientOptions, CloudflareImageResult } from './types';

const log = logEngine.createLogger('CloudflareClient');

const DEFAULT_BASE_URL = 'https://api.cloudflare.com/client/v4';

interface CloudflareJsonEnvelope {
  result?: { image?: string };
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
}

function detectContentType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Thin HTTP client for the Workers AI run endpoint:
 * POST {base}/accounts/{account_id}/ai/run/{model}
 *
 * The response dialect varies per model (flux/leonardo return JSON with a
 * base64 `image`; SD/SDXL return raw binary) — sniffed from the response
 * Content-Type so user-added catalog models work without per-model metadata.
 */
export class CloudflareClient {
  private readonly apiToken: string;
  private readonly accountId: string;
  private readonly baseUrl: string;

  constructor(opts: CloudflareClientOptions) {
    this.apiToken = opts.apiToken;
    this.accountId = opts.accountId;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  }

  async runImage(
    model: string,
    body: Record<string, unknown> | FormData,
    signal?: AbortSignal,
  ): Promise<CloudflareImageResult> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/${model}`;
    const isForm = body instanceof FormData;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: isForm
          ? { Authorization: `Bearer ${this.apiToken}` }
          : { Authorization: `Bearer ${this.apiToken}`, 'Content-Type': 'application/json' },
        body: isForm ? body : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      log.error('Network error connecting to Cloudflare Workers AI', error);
      throw new CloudflareHttpError('Network error connecting to Cloudflare Workers AI', undefined, error);
    }

    if (!response.ok) {
      const message = await this.readErrorMessage(response);
      log.error('Cloudflare Workers AI error', new Error(message), { status: response.status, model });
      throw new CloudflareHttpError(message, response.status);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = (await response.json()) as CloudflareJsonEnvelope;
      if (json.success === false) {
        const message = json.errors?.map((e) => e.message).filter(Boolean).join('; ')
          || 'Cloudflare Workers AI request failed';
        throw new CloudflareHttpError(message, response.status);
      }
      const image = json.result?.image;
      if (!image) {
        throw new CloudflareHttpError('Cloudflare response contained no image', response.status);
      }
      return { base64: image, contentType: detectContentType(image) };
    }

    const buffer = await response.arrayBuffer();
    return {
      base64: Buffer.from(buffer).toString('base64'),
      contentType: contentType.split(';')[0] || 'image/png',
    };
  }

  private async readErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as CloudflareJsonEnvelope;
      const message = body.errors?.map((e) => e.message).filter(Boolean).join('; ');
      if (message) return message;
    } catch {
      // non-JSON error body
    }
    return `Cloudflare Workers AI returned ${response.status}`;
  }
}

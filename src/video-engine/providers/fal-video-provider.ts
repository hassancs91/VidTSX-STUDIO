import { FalQueueClient, FalStorageClient, FalHttpError } from '@shared/providers/fal';
import type { FalQueueSubmitResult } from '@shared/providers/fal';
import { FAL_VIDEO_MODELS } from '@shared/presets/video-models';
import type { VideoModelCatalogEntry } from '@shared/presets/video-models';
import type {
  ProviderMediaInput,
  VideoModelInfo,
  VideoPollResult,
  VideoProvider,
  VideoProviderRequest,
} from '../types';
import { VideoEngineError } from '../types';
import { buildVideoPayload } from '../dialects';
import { toVideoModelInfo } from '../model-info';

/** fal queue result shape shared by the curated video models. */
interface FalVideoResult {
  video?: { url?: string; content_type?: string };
}

/**
 * fal.ai queue provider: one submit, then status polls against the URLs fal
 * returned. Per-model request bodies come from the dialect table; this class
 * only knows the queue protocol.
 */
export class FalVideoProvider implements VideoProvider {
  private readonly client: FalQueueClient;
  private readonly storage: FalStorageClient;
  private readonly models: VideoModelCatalogEntry[];
  private readonly jobs = new Map<string, FalQueueSubmitResult>();

  constructor(
    readonly id: string,
    apiKey: string,
    private readonly defaultModel: string,
    catalog?: VideoModelCatalogEntry[],
  ) {
    this.client = new FalQueueClient({ apiKey });
    this.storage = new FalStorageClient({ apiKey });
    this.models = catalog?.length ? catalog : [...FAL_VIDEO_MODELS];
  }

  /** Reference clips are far too large for a data URI — they go to fal storage. */
  async uploadMedia(
    input: ProviderMediaInput,
    kind: 'video' | 'audio',
    signal?: AbortSignal,
  ): Promise<ProviderMediaInput> {
    if (input.kind === 'url') return input;
    const match = /^data:([^;,]+);base64,(.*)$/s.exec(input.value);
    const base64 = match ? match[2] : input.value;
    const contentType =
      input.contentType ?? match?.[1] ?? (kind === 'video' ? 'video/mp4' : 'audio/mpeg');
    const url = await this.storage.upload(
      Buffer.from(base64, 'base64'),
      contentType,
      undefined,
      signal,
    );
    return { kind: 'url', value: url, contentType };
  }

  getSupportedModels(): VideoModelInfo[] {
    // The default model first, so an unknown id falls back to it.
    const sorted = [...this.models].sort((a, b) =>
      a.id === this.defaultModel ? -1 : b.id === this.defaultModel ? 1 : 0,
    );
    return sorted.map(toVideoModelInfo);
  }

  async submit(request: VideoProviderRequest): Promise<{ providerJobId: string }> {
    const entry = this.models.find((m) => m.id === request.model);
    if (!entry) {
      throw new VideoEngineError(
        `Unknown model "${request.model}". Available: ${this.models.map((m) => m.id).join(', ')}`,
        this.id,
      );
    }
    const { endpoint, body } = buildVideoPayload(entry, request);
    try {
      const submitted = await this.client.submit(endpoint, body, request.signal);
      this.jobs.set(submitted.requestId, submitted);
      return { providerJobId: submitted.requestId };
    } catch (error) {
      throw this.wrap(error);
    }
  }

  async poll(providerJobId: string, signal?: AbortSignal): Promise<VideoPollResult> {
    const tracked = this.jobs.get(providerJobId);
    if (!tracked) {
      return { status: 'failed', error: `Unknown fal request "${providerJobId}".` };
    }
    let status: Awaited<ReturnType<FalQueueClient['status']>>;
    try {
      status = await this.client.status(tracked.statusUrl, signal);
    } catch (error) {
      throw this.wrap(error);
    }
    if (status.status === 'IN_QUEUE') return { status: 'pending' };
    if (status.status === 'IN_PROGRESS') return { status: 'running' };

    // COMPLETED — fetch the result payload. fal reports generation errors here.
    this.jobs.delete(providerJobId);
    try {
      const result = await this.client.result<FalVideoResult>(tracked.responseUrl, signal);
      const url = result.video?.url;
      if (!url) return { status: 'failed', error: 'Generation completed but returned no video.' };
      return {
        status: 'completed',
        url,
        ...(result.video?.content_type ? { contentType: result.video.content_type } : {}),
      };
    } catch (error) {
      const wrapped = this.wrap(error);
      return { status: 'failed', error: wrapped.message };
    }
  }

  async cancel(providerJobId: string): Promise<void> {
    const tracked = this.jobs.get(providerJobId);
    this.jobs.delete(providerJobId);
    if (tracked?.cancelUrl) await this.client.cancel(tracked.cancelUrl);
  }

  private wrap(error: unknown): Error {
    if (error instanceof FalHttpError) {
      return new VideoEngineError(error.message, this.id, error.statusCode, error.cause ?? error);
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}

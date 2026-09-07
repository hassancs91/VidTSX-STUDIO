import { BytePlusArkClient, BytePlusHttpError } from '@shared/providers/byteplus';
import type { BytePlusCreateTaskBody, BytePlusTask } from '@shared/providers/byteplus';
import { BYTEPLUS_VIDEO_MODELS } from '@shared/presets/video-models';
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
import { toVideoModelInfo, withReferenceLimits } from '../model-info';

/** Uploads local bytes somewhere ModelArk can fetch them (fal storage). */
export interface VideoMediaUploader {
  upload(
    bytes: Uint8Array,
    contentType: string,
    fileName?: string,
    signal?: AbortSignal,
  ): Promise<string>;
}

export interface BytePlusVideoProviderOptions {
  /** Override for the regional ModelArk base URL. */
  baseUrl?: string;
  /**
   * Host for reference videos. ModelArk accepts base64 for images and audio
   * but **not** for video, so without one, reference videos are refused and
   * the models report zero of them (plan §2.2).
   */
  mediaUploader?: VideoMediaUploader;
}

/**
 * BytePlus ModelArk provider: Seedance direct, one async task per job.
 * Request bodies come from the `byteplus-seedance` dialect; this class only
 * knows the task protocol and how ModelArk spells its statuses.
 */
export class BytePlusVideoProvider implements VideoProvider {
  private readonly client: BytePlusArkClient;
  private readonly models: VideoModelCatalogEntry[];
  private readonly uploader?: VideoMediaUploader;

  constructor(
    readonly id: string,
    apiKey: string,
    private readonly defaultModel: string,
    catalog?: VideoModelCatalogEntry[],
    options: BytePlusVideoProviderOptions = {},
  ) {
    this.client = new BytePlusArkClient({
      apiKey,
      ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    });
    this.models = catalog?.length ? catalog : [...BYTEPLUS_VIDEO_MODELS];
    if (options.mediaUploader) this.uploader = options.mediaUploader;
  }

  getSupportedModels(): VideoModelInfo[] {
    const sorted = [...this.models].sort((a, b) =>
      a.id === this.defaultModel ? -1 : b.id === this.defaultModel ? 1 : 0,
    );
    return sorted
      .map(toVideoModelInfo)
      .map((info) =>
        withReferenceLimits(info, (kind, declared) =>
          kind === 'videos' && !this.uploader ? 0 : declared,
        ),
      );
  }

  /**
   * Reference videos must reach ModelArk as a URL. Audio may stay inline as a
   * data URI, which keeps a job self-contained when no fal key is present.
   */
  async uploadMedia(
    input: ProviderMediaInput,
    kind: 'video' | 'audio',
    signal?: AbortSignal,
  ): Promise<ProviderMediaInput> {
    if (input.kind === 'url' || kind === 'audio') return input;
    if (!this.uploader) {
      throw new VideoEngineError(
        'BytePlus needs a public URL for reference videos. Add a Fal API key in Providers to host them, or use a fal video model.',
        this.id,
      );
    }
    const { bytes, contentType } = decodeBase64(input, 'video/mp4');
    const url = await this.uploader.upload(bytes, contentType, undefined, signal);
    return { kind: 'url', value: url, contentType };
  }

  async submit(request: VideoProviderRequest): Promise<{ providerJobId: string }> {
    const entry = this.models.find((m) => m.id === request.model);
    if (!entry) {
      throw new VideoEngineError(
        `Unknown model "${request.model}". Available: ${this.models.map((m) => m.id).join(', ')}`,
        this.id,
      );
    }
    const { body } = buildVideoPayload(entry, request);
    try {
      const created = await this.client.createTask(
        body as unknown as BytePlusCreateTaskBody,
        request.signal,
      );
      return { providerJobId: created.id };
    } catch (error) {
      throw this.wrap(error);
    }
  }

  async poll(providerJobId: string, signal?: AbortSignal): Promise<VideoPollResult> {
    let task: BytePlusTask;
    try {
      task = await this.client.getTask(providerJobId, signal);
    } catch (error) {
      throw this.wrap(error);
    }
    switch (task.status) {
      case 'queued':
        return { status: 'pending' };
      case 'running':
        return { status: 'running' };
      case 'succeeded': {
        const url = task.content?.video_url;
        if (!url) return { status: 'failed', error: 'Generation completed but returned no video.' };
        const completionTokens = task.usage?.completion_tokens ?? task.usage?.total_tokens;
        return {
          status: 'completed',
          url,
          contentType: 'video/mp4',
          ...(completionTokens !== undefined ? { usage: { completionTokens } } : {}),
        };
      }
      case 'cancelled':
        return { status: 'failed', error: 'Task was cancelled.' };
      case 'expired':
        return { status: 'failed', error: 'Task expired before it ran.' };
      default:
        return {
          status: 'failed',
          error: task.error?.message ?? 'Video generation failed.',
        };
    }
  }

  /** Only a queued task can be cancelled; a running one keeps going. */
  async cancel(providerJobId: string): Promise<void> {
    try {
      await this.client.deleteTask(providerJobId);
    } catch (error) {
      if (error instanceof BytePlusHttpError && error.statusCode === 404) return;
      throw this.wrap(error);
    }
  }

  private wrap(error: unknown): Error {
    if (error instanceof BytePlusHttpError) {
      return new VideoEngineError(error.message, this.id, error.statusCode, error.cause ?? error);
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}

/** Split a data URI (or raw base64) into bytes plus its content type. */
function decodeBase64(
  input: ProviderMediaInput,
  fallbackType: string,
): { bytes: Uint8Array; contentType: string } {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(input.value);
  const base64 = match ? match[2] : input.value;
  const contentType = input.contentType ?? match?.[1] ?? fallbackType;
  return { bytes: Buffer.from(base64, 'base64'), contentType };
}

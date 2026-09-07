import type {
  VideoClipStore,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoJobListener,
  VideoJobRecord,
  VideoJobResult,
  VideoModelInfo,
  VideoProvider,
  VideoProviderConfig,
  VideoProviderId,
  VideoSafetyGuard,
  VideoUsageLogger,
} from './types';
import { FalVideoProvider } from './providers/fal-video-provider';
import { VideoJobTracker } from './job-tracker';
import type { VideoJobTrackerOptions } from './job-tracker';
import { normalizeVideoRequest, summarizeRequest } from './normalize';
import { resolveMediaInput } from './media-input';
import { VIDEO_MAX_PROMPT_CHARS } from '../shared/presets/video-models';
import { checkGenerationPrompt } from '../moderation-engine/generation-gate';
import { ModerationBlockedError } from '../shared/content-safety';
import { logEngine } from '../logging/log-engine';

const log = logEngine.createLogger('Video');

const DEFAULT_TRACKER_OPTIONS: VideoJobTrackerOptions = {
  pollIntervalMs: 3000,
  maxWaitMs: 30 * 60 * 1000,
  retainMs: 60 * 60 * 1000,
};

const TERMINAL = new Set<VideoJobRecord['status']>(['completed', 'failed', 'cancelled']);

class VideoEngine {
  private providers = new Map<VideoProviderId, VideoProvider>();
  private activeId: VideoProviderId | null = null;
  private safetyGuard: VideoSafetyGuard | null = null;
  private clipStore: VideoClipStore | null = null;
  private usageLogger: VideoUsageLogger | null = null;
  private readonly tracker: VideoJobTracker;

  constructor(options: Partial<VideoJobTrackerOptions> = {}) {
    this.tracker = new VideoJobTracker(
      { ...DEFAULT_TRACKER_OPTIONS, ...options },
      (record, completed) => this.finishJob(record, completed),
    );
  }

  /** Install Gate B for input images. Until it happens, submission refuses to run. */
  setSafetyGuard(guard: VideoSafetyGuard): void {
    this.safetyGuard = guard;
  }

  /** Install the download → frame-sampling Gate B → Video Studio finishing step. */
  setClipStore(store: VideoClipStore): void {
    this.clipStore = store;
  }

  setUsageLogger(logger: VideoUsageLogger): void {
    this.usageLogger = logger;
  }

  register(config: VideoProviderConfig): void {
    if (!config.enabled) return;
    if (!config.apiKey) throw new Error(`API key required for video provider "${config.id}"`);
    let provider: VideoProvider;
    if (config.type === 'fal') {
      provider = new FalVideoProvider(config.id, config.apiKey, config.defaultModel, config.models);
    } else {
      throw new Error(`Unknown video provider type: ${String(config.type)}`);
    }
    this.registerInstance(provider);
    log.info('Provider registered', { providerId: config.id, type: config.type });
  }

  registerInstance(provider: VideoProvider): void {
    this.providers.set(provider.id, provider);
    if (!this.activeId) this.activeId = provider.id;
  }

  unregister(id: VideoProviderId): void {
    this.providers.delete(id);
    if (this.activeId === id) {
      this.activeId = this.providers.keys().next().value ?? null;
    }
  }

  switchProvider(id: VideoProviderId): void {
    if (!this.providers.has(id)) throw new Error(`Video provider "${id}" not registered`);
    this.activeId = id;
  }

  getProviders(): VideoProviderId[] {
    return Array.from(this.providers.keys());
  }

  getActiveProvider(): VideoProviderId | null {
    return this.activeId;
  }

  getModels(providerId?: VideoProviderId): VideoModelInfo[] {
    const provider = providerId ? this.providers.get(providerId) : this.getActive();
    return provider ? provider.getSupportedModels() : [];
  }

  getJob(jobId: string): VideoJobRecord | undefined {
    return this.tracker.get(jobId);
  }

  listJobs(): VideoJobRecord[] {
    return this.tracker.list();
  }

  subscribe(listener: VideoJobListener): () => void {
    return this.tracker.subscribe(listener);
  }

  cancel(jobId: string): Promise<void> {
    return this.tracker.cancel(jobId);
  }

  /** Submit a job (the record form: screens poll or subscribe for progress). */
  async submit(request: VideoGenerationRequest): Promise<VideoJobRecord> {
    // Gate A before anything else — a blocked prompt is refused even when no
    // provider is configured (and before any spend).
    this.validatePrompt(request.prompt);
    this.guardPrompt(request.prompt);
    const provider = request.providerId
      ? this.providers.get(request.providerId)
      : this.getActive();
    if (!provider) {
      throw new Error(
        request.providerId
          ? `Video provider "${request.providerId}" not registered`
          : 'No video provider configured. Add a Fal API key in Settings > API Keys.',
      );
    }
    return this.runGuarded(provider, request);
  }

  /** The awaiting form: submit → poll → download → gate → file → local entry. */
  async generateAndWait(
    request: VideoGenerationRequest,
    options: { onProgress?: VideoJobListener; signal?: AbortSignal } = {},
  ): Promise<VideoGenerationResult> {
    const signal = options.signal ?? request.signal;
    const submitted = await this.submit({ ...request, ...(signal ? { signal } : {}) });
    return new Promise<VideoGenerationResult>((resolve, reject) => {
      const settle = (record: VideoJobRecord): boolean => {
        if (!TERMINAL.has(record.status)) return false;
        unsubscribe();
        signal?.removeEventListener('abort', onAbort);
        if (record.status === 'completed' && record.result) {
          resolve(this.toResult(record, record.result));
        } else {
          reject(
            record.blocked
              ? new ModerationBlockedError(record.blocked.gate, record.blocked.category)
              : new Error(record.error ?? 'Video generation failed.'),
          );
        }
        return true;
      };
      const onAbort = (): void => {
        void this.cancel(submitted.jobId).catch(() => {});
      };
      const unsubscribe = this.tracker.subscribe((record) => {
        if (record.jobId !== submitted.jobId) return;
        options.onProgress?.(record);
        settle(record);
      });
      signal?.addEventListener('abort', onAbort, { once: true });
      const current = this.tracker.get(submitted.jobId);
      if (current) settle(current);
    });
  }

  /**
   * The Content Safety chokepoint: every submission — Flows, the Videos
   * panel, the library, agent tools, all providers current and future —
   * passes Gate A (prompt, in submit()), then Gate B on every input image
   * BEFORE any provider sees it. Fail-closed on both hooks: without the
   * input guard or the finishing store (which gates the output frames)
   * nothing is submitted.
   */
  private async runGuarded(
    provider: VideoProvider,
    request: VideoGenerationRequest,
  ): Promise<VideoJobRecord> {
    const guard = this.safetyGuard;
    const store = this.clipStore;
    if (!guard || !store) {
      throw new Error('Content Safety is not initialized, so video generation is blocked (fail-closed).');
    }

    const models = provider.getSupportedModels();
    const model = models.find((m) => m.id === request.model) ?? models[0];
    if (!model) throw new Error(`Video provider "${provider.id}" has no models.`);

    const normalized = normalizeVideoRequest(model, request, {
      ...(request.firstFrame ? { firstFrame: await resolveMediaInput(request.firstFrame) } : {}),
      ...(request.lastFrame ? { lastFrame: await resolveMediaInput(request.lastFrame) } : {}),
      referenceImages: await Promise.all((request.references?.images ?? []).map(resolveMediaInput)),
    });

    // Gate B on inputs — also keeps NSFW source images off cloud APIs.
    for (const image of [normalized.firstFrame, normalized.lastFrame, ...(normalized.referenceImages ?? [])]) {
      if (image) await guard.checkImage(image, 'input');
    }

    const { providerJobId } = await provider.submit(normalized);
    const now = Date.now();
    const record = this.tracker.start(provider, {
      jobId: this.tracker.newJobId(),
      providerId: provider.id,
      providerJobId,
      featureSource: request.featureSource ?? 'other',
      request: summarizeRequest(normalized, request.folderId),
      submittedAt: now,
      updatedAt: now,
      status: 'pending',
    });
    log.info('Video job submitted', { jobId: record.jobId, provider: provider.id, model: model.id });
    return record;
  }

  /** Download → sampled-frame Gate B → Video Studio, then the usage log. */
  private async finishJob(
    record: VideoJobRecord,
    completed: { url: string; contentType?: string },
  ): Promise<VideoJobResult> {
    const store = this.clipStore;
    if (!store) throw new Error('Content Safety is not initialized, so the clip is blocked (fail-closed).');
    const result = await store.store({
      url: completed.url,
      ...(completed.contentType ? { contentType: completed.contentType } : {}),
      prompt: record.request.prompt,
      model: record.request.model,
      aspectRatio: record.request.aspectRatio,
      durationSeconds: record.request.durationSeconds,
      hasAudio: record.request.generateAudio,
      folderId: record.request.folderId ?? null,
    });
    const model = this.getModels(record.providerId).find((m) => m.id === record.request.model);
    this.usageLogger?.({
      providerId: record.providerId,
      model: record.request.model,
      featureSource: record.featureSource,
      costUsd: (model?.pricePerSecondUsd ?? 0) * record.request.durationSeconds,
      durationMs: Date.now() - record.submittedAt,
    });
    return result;
  }

  private validatePrompt(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) throw new Error('Prompt is required.');
    if (prompt.length > VIDEO_MAX_PROMPT_CHARS) {
      throw new Error(`Prompt too long (max ${VIDEO_MAX_PROMPT_CHARS} characters).`);
    }
  }

  /** Content Safety Gate A: the curated generation blocklist, before any spend. */
  private guardPrompt(prompt: string): void {
    const result = checkGenerationPrompt(prompt);
    if (result.blocked) {
      log.info('Prompt blocked by Content Safety', { category: result.category });
      this.safetyGuard?.onPromptBlocked?.(result.category ?? 'sexual');
      throw new ModerationBlockedError('prompt', result.category ?? 'sexual');
    }
  }

  private toResult(record: VideoJobRecord, result: VideoJobResult): VideoGenerationResult {
    return {
      ...result,
      jobId: record.jobId,
      provider: record.providerId,
      model: record.request.model,
      durationSeconds: record.request.durationSeconds,
      aspectRatio: record.request.aspectRatio,
      hasAudio: record.request.generateAudio,
      durationMs: record.updatedAt - record.submittedAt,
    };
  }

  private getActive(): VideoProvider | undefined {
    return this.activeId ? this.providers.get(this.activeId) : undefined;
  }
}

/** Isolated engine for tests (own registry, own job map, fast poll cadence). */
export function createVideoEngine(options: Partial<VideoJobTrackerOptions> = {}): VideoEngine {
  return new VideoEngine(options);
}

export const videoEngine = new VideoEngine();

import type {
  ImageProviderId,
  ImageProviderConfig,
  ImageProvider,
  ImageSafetyGuard,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageModelInfo,
  ImageParamResolver,
} from './types';
import { hasAnyImageParams, mergeImageParams } from '../shared/presets/image-model-params';
import { FalImageProvider } from './providers/fal-provider';
import { BytePlusImageProvider } from './providers/byteplus-image-provider';
import { OpenRouterProvider } from './providers/openrouter-provider';
import { CloudflareImageProvider } from './providers/cloudflare-provider';
import { checkGenerationPrompt } from '../moderation-engine/generation-gate';
import { ModerationBlockedError } from '../shared/content-safety';
import { logEngine } from '../logging/log-engine';

const log = logEngine.createLogger('Image');

class ImageEngine {
  private providers = new Map<ImageProviderId, ImageProvider>();
  private activeId: ImageProviderId | null = null;
  private safetyGuard: ImageSafetyGuard | null = null;
  private paramResolver: ImageParamResolver | null = null;

  /**
   * Install the Content Safety pixel classifier (Gate B). Called by main at
   * init; until it happens, every generation refuses to run (fail-closed —
   * D2d: a safety gate must not have an absent state).
   */
  setSafetyGuard(guard: ImageSafetyGuard): void {
    this.safetyGuard = guard;
  }

  /** Install the per-model parameter override store (W2c). Optional: without it, requests pass through as-is. */
  setParamResolver(resolver: ImageParamResolver | null): void {
    this.paramResolver = resolver;
  }

  register(config: ImageProviderConfig): void {
    if (!config.enabled) return;

    if (!config.apiKey) {
      throw new Error(`API key required for image provider "${config.id}"`);
    }

    let provider: ImageProvider;

    if (config.type === 'fal') {
      provider = new FalImageProvider(config.id, config.apiKey, config.defaultModel, config.models);
    } else if (config.type === 'byteplus') {
      provider = new BytePlusImageProvider(config.id, config.apiKey, config.defaultModel, config.models);
    } else if (config.type === 'openrouter') {
      provider = new OpenRouterProvider(config.id, config.apiKey, config.defaultModel, config.models);
    } else if (config.type === 'cloudflare') {
      if (!config.accountId) {
        throw new Error(`Cloudflare account ID required for image provider "${config.id}"`);
      }
      provider = new CloudflareImageProvider(config.id, config.apiKey, config.accountId, config.defaultModel, config.models);
    } else if (config.type === 'local' || config.type === 'gemini-cli' || config.type === 'minimax-cli') {
      throw new Error(
        `Image provider type "${config.type}" is a CLI bridge — it registers via registerInstance(), not settings`,
      );
    } else {
      throw new Error(`Unknown image provider type: ${config.type}`);
    }

    this.providers.set(config.id, provider);
    if (!this.activeId) this.activeId = config.id;
    log.info('Provider registered', { providerId: config.id, type: config.type });
  }

  /**
   * Register a pre-built provider instance (e.g. the local sd-cli bridge,
   * which needs no API key and isn't stored in provider settings).
   */
  registerInstance(provider: ImageProvider): void {
    this.providers.set(provider.id, provider);
    if (!this.activeId) this.activeId = provider.id;
    log.info('Provider registered', { providerId: provider.id, type: 'instance' });
  }

  unregister(id: ImageProviderId): void {
    this.providers.delete(id);
    if (this.activeId === id) {
      this.activeId = this.providers.keys().next().value ?? null;
    }
  }

  switchProvider(id: ImageProviderId): void {
    if (!this.providers.has(id)) throw new Error(`Image provider "${id}" not registered`);
    this.activeId = id;
    log.info('Switched provider', { providerId: id });
  }

  getProviders(): ImageProviderId[] {
    return Array.from(this.providers.keys());
  }

  getActiveProvider(): ImageProviderId | null {
    return this.activeId;
  }

  getModels(providerId?: ImageProviderId): ImageModelInfo[] {
    const provider = providerId
      ? this.providers.get(providerId)
      : this.getActive();

    if (!provider) return [];
    return provider.getSupportedModels();
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    log.debug('Generate request', { provider: this.activeId, model: request.model, operation: request.operation });
    return this.runGuarded(this.getActive(), request);
  }

  async generateWith(
    providerId: ImageProviderId,
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResponse> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Image provider "${providerId}" not registered`);
    return this.runGuarded(provider, request);
  }

  /**
   * The Content Safety chokepoint: every generation — Image Studio, Flows,
   * agent tools, provider tests, all providers current and future — passes
   * Gate A (prompt), Gate B on input reference images BEFORE any provider
   * call, and Gate B on every output pixel before it crosses to the caller.
   * Always on; no setting disables it (D2d), and a missing classifier
   * blocks generation rather than skipping the check.
   */
  private async runGuarded(
    provider: ImageProvider,
    incoming: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    const request = this.applyParamOverride(provider, incoming);
    this.guardPrompt(request);

    const guard = this.safetyGuard;
    if (!guard) {
      throw new Error(
        'Content Safety is not initialized, so image generation is blocked (fail-closed).',
      );
    }
    // Input references (img2img / multi-reference): checked before any
    // provider sees them — also keeps NSFW source images off cloud APIs.
    if (request.sourceImage) {
      await guard.checkImage(request.sourceImage, 'input');
    }
    for (const ref of request.referenceImages ?? []) {
      await guard.checkImage(ref, 'input');
    }

    const response = await provider.generate(request);

    for (const image of response.images) {
      await guard.checkImage(image.base64, 'output');
    }
    return response;
  }

  /**
   * Content Safety Gate A: the curated generation blocklist, checked before
   * any provider (and any API spend) sees the prompt.
   */
  private guardPrompt(request: ImageGenerationRequest): void {
    const result = checkGenerationPrompt(request.prompt);
    if (result.blocked) {
      log.info('Prompt blocked by Content Safety', { category: result.category });
      this.safetyGuard?.onPromptBlocked?.(result.category ?? 'sexual');
      throw new ModerationBlockedError('prompt', result.category ?? 'sexual');
    }
  }

  /**
   * `request ⊕ override`: the user's saved params for this provider/model fill
   * whatever the request left unset (top-level width/height included), so
   * every caller — Image Studio, the agents, flows, bulk — gets them.
   */
  private applyParamOverride(
    provider: ImageProvider,
    request: ImageGenerationRequest,
  ): ImageGenerationRequest {
    const modelId = request.model || provider.defaultModel;
    const override = modelId ? this.paramResolver?.(provider.id, modelId) : undefined;
    if (!hasAnyImageParams(override)) return request;
    const params = mergeImageParams(request.params, override);
    return {
      ...request,
      width: request.width ?? params.width,
      height: request.height ?? params.height,
      params,
    };
  }

  private getActive(): ImageProvider {
    if (!this.activeId || !this.providers.has(this.activeId)) {
      throw new Error('No active image provider. Call register() first.');
    }
    return this.providers.get(this.activeId)!;
  }
}

export const imageEngine = new ImageEngine();

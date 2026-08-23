import type {
  ImageProviderId,
  ImageProviderConfig,
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageModelInfo,
} from './types';
import { FalImageProvider } from './providers/fal-provider';
import { OpenRouterProvider } from './providers/openrouter-provider';
import { CloudflareImageProvider } from './providers/cloudflare-provider';
import { checkGenerationPrompt } from '../moderation-engine/generation-gate';
import { ModerationBlockedError } from '../shared/content-safety';
import { logEngine } from '../logging/log-engine';

const log = logEngine.createLogger('Image');

class ImageEngine {
  private providers = new Map<ImageProviderId, ImageProvider>();
  private activeId: ImageProviderId | null = null;

  register(config: ImageProviderConfig): void {
    if (!config.enabled) return;

    if (!config.apiKey) {
      throw new Error(`API key required for image provider "${config.id}"`);
    }

    let provider: ImageProvider;

    if (config.type === 'fal') {
      provider = new FalImageProvider(config.id, config.apiKey, config.defaultModel, config.models);
    } else if (config.type === 'openrouter') {
      provider = new OpenRouterProvider(config.id, config.apiKey, config.defaultModel, config.models);
    } else if (config.type === 'cloudflare') {
      if (!config.accountId) {
        throw new Error(`Cloudflare account ID required for image provider "${config.id}"`);
      }
      provider = new CloudflareImageProvider(config.id, config.apiKey, config.accountId, config.defaultModel, config.models);
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
    this.guardPrompt(request);
    return this.getActive().generate(request);
  }

  async generateWith(
    providerId: ImageProviderId,
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResponse> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Image provider "${providerId}" not registered`);
    this.guardPrompt(request);
    return provider.generate(request);
  }

  /**
   * Content Safety Gate A: every prompt reaching the engine — Image Studio,
   * Flows, agent tools, provider tests, all providers current and future —
   * is checked against the curated generation blocklist before any provider
   * (and any API spend) sees it. Always on; no setting disables it (D2d).
   */
  private guardPrompt(request: ImageGenerationRequest): void {
    const result = checkGenerationPrompt(request.prompt);
    if (result.blocked) {
      log.info('Prompt blocked by Content Safety', { category: result.category });
      throw new ModerationBlockedError('prompt', result.category ?? 'sexual');
    }
  }

  private getActive(): ImageProvider {
    if (!this.activeId || !this.providers.has(this.activeId)) {
      throw new Error('No active image provider. Call register() first.');
    }
    return this.providers.get(this.activeId)!;
  }
}

export const imageEngine = new ImageEngine();

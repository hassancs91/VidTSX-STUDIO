import { IpcMainInvokeEvent } from 'electron';
import { logEngine } from '../../logging/log-engine';
import { imageEngine, IMAGE_PROVIDER_PRESETS } from '../../image-engine';

const log = logEngine.createLogger('ImageHandlers');
import type { ImageProviderConfig } from '../../image-engine';
import { getImageProviders, saveImageProviders, getProviderCredentials } from '../services/settings';
import { aiUsageService } from '../services/ai-usage';
import type {
  ImageProvidersGetResponse,
  ImageProvidersSaveRequest,
  ImageProvidersSaveResponse,
  ImageProviderTestRequest,
  ImageProviderTestResponse,
  ImageModelsGetRequest,
  ImageModelsGetResponse,
  ImageGenerateRequest,
  ImageGenerateResponse,
  ImageGenerateCancelRequest,
  ImageGenerateCancelResponse,
  ImageProviderSwitchRequest,
  ImageProviderSwitchResponse,
} from '../../shared/ipc/types';

// Active in-flight image generations keyed by caller-supplied callId. The
// callId comes from the renderer (e.g. a flow's runId) and lets a separate
// imageGenerateCancel IPC abort the underlying fetch while it's running.
const activeImageGenerates = new Map<string, AbortController>();

// Shared BYOK credential for a provider type ('' when none applies).
function sharedKeyFor(
  type: ImageProviderConfig['type'],
  credentials: Awaited<ReturnType<typeof getProviderCredentials>>,
): string {
  if (type === 'fal') return credentials.fal ?? '';
  if (type === 'openrouter') return credentials.openrouter ?? '';
  return '';
}

export async function handleImageProvidersGet(): Promise<ImageProvidersGetResponse> {
  try {
    const { providers, activeProvider } = await getImageProviders();
    const credentials = await getProviderCredentials();
    return {
      success: true,
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        defaultModel: p.defaultModel,
        enabled: p.enabled,
        hasApiKey: !!(sharedKeyFor(p.type, credentials) || p.apiKey),
      })),
      activeProvider: activeProvider || imageEngine.getActiveProvider(),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to get image providers';
    return { success: false, providers: [], activeProvider: null, error };
  }
}

export async function handleImageProvidersSave(
  _event: IpcMainInvokeEvent,
  data: ImageProvidersSaveRequest
): Promise<ImageProvidersSaveResponse> {
  try {
    // Preserve existing API keys when the incoming key is empty
    const { providers: existing } = await getImageProviders();
    const existingMap = new Map(existing.map((p) => [p.id, p]));

    const configs: ImageProviderConfig[] = data.providers.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      apiKey: p.apiKey || existingMap.get(p.id)?.apiKey || '',
      defaultModel: p.defaultModel,
      enabled: p.enabled,
    }));

    await saveImageProviders(configs, data.activeProvider);

    // Re-initialize engine with new configs
    const currentProviders = imageEngine.getProviders();
    for (const id of currentProviders) {
      imageEngine.unregister(id);
    }

    const credentials = await getProviderCredentials();
    for (const config of configs) {
      try {
        // Shared BYOK credential wins; per-provider key is a legacy fallback.
        const sharedKey = sharedKeyFor(config.type, credentials);
        imageEngine.register({ ...config, apiKey: sharedKey || config.apiKey });
      } catch (err) {
        log.warn(`Failed to register provider "${config.id}"`, { error: err instanceof Error ? err.message : String(err) });
      }
    }

    if (data.activeProvider) {
      try {
        imageEngine.switchProvider(data.activeProvider);
      } catch {
        // Provider not available
      }
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save image provider settings';
    return { success: false, error };
  }
}

export async function handleImageProviderTest(
  _event: IpcMainInvokeEvent,
  data: ImageProviderTestRequest
): Promise<ImageProviderTestResponse> {
  try {
    const { providers } = await getImageProviders();
    const config = providers.find((p) => p.id === data.providerId);
    const providerType = (config?.type || data.providerId) as ImageProviderConfig['type'];

    // Apply unsaved draft overrides from the Settings UI (api key, model),
    // falling back to the shared BYOK credential.
    const credentials = await getProviderCredentials();
    const apiKey =
      data.apiKey?.trim() || sharedKeyFor(providerType, credentials) || config?.apiKey || '';
    const defaultModel = data.defaultModel || config?.defaultModel;

    if (!apiKey) {
      return { success: false, error: 'Add an API key in Settings > API Keys first' };
    }

    if (!config && !defaultModel) {
      return { success: false, error: `Provider "${data.providerId}" not found in settings` };
    }

    // Create a temporary provider for testing using draft values when present
    const testId = `__test_${data.providerId}_${Date.now()}`;
    const testConfig: ImageProviderConfig = {
      id: testId,
      name: config?.name || data.providerId,
      type: providerType,
      apiKey,
      defaultModel: defaultModel || '',
      enabled: true,
    };

    imageEngine.register(testConfig);

    try {
      const result = await imageEngine.generateWith(testId, {
        operation: 'text-to-image',
        prompt: 'A simple red circle on white background',
        width: 256,
        height: 256,
        numImages: 1,
      });

      return {
        success: true,
        durationMs: result.durationMs,
      };
    } finally {
      imageEngine.unregister(testId);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Connection test failed';
    return { success: false, error };
  }
}

export async function handleImageModelsGet(
  _event: IpcMainInvokeEvent,
  data: ImageModelsGetRequest
): Promise<ImageModelsGetResponse> {
  try {
    const models = imageEngine.getModels(data?.providerId);
    return {
      success: true,
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        supportedOperations: m.supportedOperations,
        credits: m.credits,
      })),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to get models';
    return { success: false, models: [], error };
  }
}

export async function handleImageGenerate(
  _event: IpcMainInvokeEvent,
  data: ImageGenerateRequest
): Promise<ImageGenerateResponse> {
  const ctrl = data.callId ? new AbortController() : undefined;
  if (data.callId && ctrl) {
    // If an old controller is still registered for this callId (caller reusing
    // the same id, e.g. retry after a failed cancel), abort the previous.
    activeImageGenerates.get(data.callId)?.abort();
    activeImageGenerates.set(data.callId, ctrl);
  }

  try {
    const engineRequest = {
      operation: data.operation,
      prompt: data.prompt,
      model: data.model,
      width: data.width,
      height: data.height,
      numImages: data.numImages,
      sourceImage: data.sourceImage,
      referenceImages: data.referenceImages,
      outputFormat: data.outputFormat,
      signal: ctrl?.signal,
    };
    const result = data.providerId
      ? await imageEngine.generateWith(data.providerId, engineRequest)
      : await imageEngine.generate(engineRequest);

    // Log usage (fire-and-forget)
    aiUsageService.appendEntry({
      timestamp: new Date().toISOString(),
      provider: data.providerId || imageEngine.getActiveProvider() || 'unknown',
      model: result.model || data.model || 'unknown',
      featureSource: 'image-generation',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      costUsd: 0,
      durationMs: result.durationMs ?? 0,
      requestType: 'image',
    }).catch(() => {});

    return {
      success: true,
      images: result.images,
      model: result.model,
      durationMs: result.durationMs,
    };
  } catch (err) {
    if (ctrl?.signal.aborted) {
      return { success: false, error: 'Image generation cancelled' };
    }
    const error = err instanceof Error ? err.message : 'Image generation failed';
    return { success: false, error };
  } finally {
    if (data.callId && activeImageGenerates.get(data.callId) === ctrl) {
      activeImageGenerates.delete(data.callId);
    }
  }
}

export async function handleImageGenerateCancel(
  _event: IpcMainInvokeEvent,
  data: ImageGenerateCancelRequest,
): Promise<ImageGenerateCancelResponse> {
  const ctrl = activeImageGenerates.get(data.callId);
  if (!ctrl) {
    return { success: true, cancelled: false };
  }
  ctrl.abort();
  activeImageGenerates.delete(data.callId);
  log.info('Cancelled in-flight image generation', { callId: data.callId });
  return { success: true, cancelled: true };
}

export async function handleImageProviderSwitch(
  _event: IpcMainInvokeEvent,
  data: ImageProviderSwitchRequest
): Promise<ImageProviderSwitchResponse> {
  try {
    imageEngine.switchProvider(data.providerId);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to switch image provider';
    return { success: false, error };
  }
}

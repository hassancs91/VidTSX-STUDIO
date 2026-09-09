import { IpcMainInvokeEvent } from 'electron';
import { logEngine } from '../../logging/log-engine';
import { imageEngine, IMAGE_PROVIDER_PRESETS } from '../../image-engine';

const log = logEngine.createLogger('ImageHandlers');
import type { ImageProviderConfig } from '../../image-engine';
import { getImageProviders, saveImageProviders, getProviderCredentials, getCloudflareAccountId } from '../services/settings';
import { getProviderImageModels } from '../services/provider-models';
import { resolveImageModelParams } from '../services/image-model-params';
import { getDefaultImageModelPriceUsd } from '../../shared/presets/provider-model-defaults';
import {
  initImageEngine,
  GEMINI_CLI_IMAGE_PROVIDER_ID,
  INSTANCE_IMAGE_PROVIDER_IDS,
} from '../services/image-init';
import { agyCliService } from '../services/agy-cli';
import { aiUsageService } from '../services/ai-usage';
import { ModerationBlockedError } from '../../shared/content-safety';
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
  ImageCliStatusRequest,
  ImageCliStatusResponse,
} from '../../shared/ipc/types';

// Active in-flight image generations keyed by caller-supplied callId. The
// callId comes from the renderer (e.g. a flow's runId) and lets a separate
// imageGenerateCancel IPC abort the underlying fetch while it's running.
const activeImageGenerates = new Map<string, AbortController>();

// Shared BYOK credential for a provider type ('' when no preset names one —
// instance providers such as local sd-cli have no credential).
function sharedKeyFor(
  type: ImageProviderConfig['type'],
  credentials: Awaited<ReturnType<typeof getProviderCredentials>>,
): string {
  const preset = IMAGE_PROVIDER_PRESETS.find((p) => p.type === type);
  return preset ? credentials[preset.credentialId] ?? '' : '';
}

export async function handleImageProvidersGet(): Promise<ImageProvidersGetResponse> {
  try {
    const { providers, activeProvider } = await getImageProviders();
    const credentials = await getProviderCredentials();
    // Presets merged with saved overrides. A provider is enabled exactly when
    // its key exists ("one key unlocks the provider") — mirrors what
    // initImageEngine actually registers, even when settings are empty.
    const savedMap = new Map(providers.map((p) => [p.id, p]));
    return {
      success: true,
      providers: IMAGE_PROVIDER_PRESETS.map((preset) => {
        const saved = savedMap.get(preset.id);
        const hasApiKey = !!(sharedKeyFor(preset.type, credentials) || saved?.apiKey);
        return {
          id: preset.id,
          name: preset.name,
          type: preset.type,
          defaultModel: saved?.defaultModel || preset.defaultModel,
          enabled: hasApiKey,
          hasApiKey,
        };
      }),
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
    // Preserve existing API keys when the incoming key is empty. Instance
    // providers (local sd-cli, the CLI bridges) are never stored in settings —
    // drop them if a caller sends them.
    const { providers: existing } = await getImageProviders();
    const existingMap = new Map(existing.map((p) => [p.id, p]));

    const configs: ImageProviderConfig[] = data.providers
      .filter((p) => !INSTANCE_IMAGE_PROVIDER_IDS.includes(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        apiKey: p.apiKey || existingMap.get(p.id)?.apiKey || '',
        defaultModel: p.defaultModel,
        enabled: p.enabled,
      }));

    await saveImageProviders(configs, data.activeProvider);

    // Re-initialize the engine with new configs. initImageEngine registers
    // every keyed preset with its catalog models, restores the local sd-cli
    // bridge, and re-applies the (just saved) active provider.
    const currentProviders = imageEngine.getProviders();
    for (const id of currentProviders) {
      imageEngine.unregister(id);
    }
    await initImageEngine();

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
    const preset = IMAGE_PROVIDER_PRESETS.find((p) => p.id === data.providerId);
    const providerType = (config?.type || preset?.type || data.providerId) as ImageProviderConfig['type'];

    // Apply unsaved draft overrides from the Providers UI (api key, model),
    // falling back to the shared BYOK credential.
    const credentials = await getProviderCredentials();
    const apiKey =
      data.apiKey?.trim() || sharedKeyFor(providerType, credentials) || config?.apiKey || '';
    const defaultModel = data.defaultModel || config?.defaultModel || preset?.defaultModel;

    if (!apiKey) {
      return { success: false, error: 'Add an API key in the Providers tab first' };
    }

    if (!defaultModel) {
      return { success: false, error: `No model configured for provider "${data.providerId}"` };
    }

    // Cloudflare's second credential half — draft from the UI wins, then the
    // stored plain settings value.
    const accountId =
      providerType === 'cloudflare'
        ? data.accountId?.trim() || (await getCloudflareAccountId())
        : undefined;
    if (providerType === 'cloudflare' && !accountId) {
      return { success: false, error: 'Add your Cloudflare account ID in the Providers tab first' };
    }

    // Create a temporary provider for testing using draft values when present.
    // The catalog drives the model list; a draft model id not (yet) in the
    // catalog is appended so it can be exercised by the test.
    const catalog = await getProviderImageModels(data.providerId);
    if (defaultModel && !catalog.some((m) => m.id === defaultModel)) {
      catalog.push({ id: defaultModel, name: defaultModel });
    }
    const testId = `__test_${data.providerId}_${Date.now()}`;
    const testConfig: ImageProviderConfig = {
      id: testId,
      name: config?.name || data.providerId,
      type: providerType,
      apiKey,
      accountId,
      defaultModel: defaultModel || '',
      enabled: true,
      models: catalog,
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

      // Log the test generation like the LLM provider test does — it is a
      // real billed request.
      aiUsageService.appendEntry({
        timestamp: new Date().toISOString(),
        provider: data.providerId,
        model: result.model || defaultModel,
        featureSource: 'provider-test',
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        costUsd: getDefaultImageModelPriceUsd(data.providerId, result.model || defaultModel),
        durationMs: result.durationMs ?? 0,
        requestType: 'image',
      }).catch(() => {});

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
    // The gemini-cli bridge reports models from a cached availability probe;
    // make sure one has run so the first listing (e.g. Image Studio load)
    // sees the provider without visiting the AI page first.
    const target = data?.providerId ?? imageEngine.getActiveProvider();
    if (target === GEMINI_CLI_IMAGE_PROVIDER_ID) {
      await agyCliService.ensureProbed().catch(() => {});
    }
    const providerId = data?.providerId ?? imageEngine.getActiveProvider();
    const models = imageEngine.getModels(data?.providerId);
    return {
      success: true,
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        supportedOperations: m.supportedOperations,
        credits: m.credits,
        paramSchema: m.paramSchema,
        paramDefaults: m.paramDefaults,
        params: providerId ? resolveImageModelParams(providerId, m.id) : undefined,
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
      params: data.params,
      signal: ctrl?.signal,
    };
    const result = data.providerId
      ? await imageEngine.generateWith(data.providerId, engineRequest)
      : await imageEngine.generate(engineRequest);

    // Log usage (fire-and-forget). Cost = shipped-default per-image estimate
    // × images returned; unknown models/providers (incl. local) stay $0.
    const usageProvider = data.providerId || imageEngine.getActiveProvider() || 'unknown';
    const usageModel = result.model || data.model || 'unknown';
    aiUsageService.appendEntry({
      timestamp: new Date().toISOString(),
      provider: usageProvider,
      model: usageModel,
      featureSource: 'image-generation',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      costUsd: getDefaultImageModelPriceUsd(usageProvider, usageModel) * result.images.length,
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
    if (err instanceof ModerationBlockedError) {
      return { success: false, error: err.message, blocked: err.toBlockInfo() };
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

/**
 * Detection + auth probe for the CLI-bridge providers (AI Models → Image
 * setup cards). One list response so the deferred mmx provider slots in
 * without a new channel.
 */
export async function handleImageCliStatus(
  _event: IpcMainInvokeEvent,
  data?: ImageCliStatusRequest,
): Promise<ImageCliStatusResponse> {
  try {
    const status = await agyCliService.probeStatus(data?.force ?? false);
    return {
      success: true,
      statuses: [
        {
          id: GEMINI_CLI_IMAGE_PROVIDER_ID,
          installed: status.installed,
          authenticated: status.authenticated,
          binaryPath: status.binaryPath,
          detail: status.detail,
        },
      ],
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to probe CLI providers';
    return { success: false, statuses: [], error };
  }
}

export async function handleImageProviderSwitch(
  _event: IpcMainInvokeEvent,
  data: ImageProviderSwitchRequest
): Promise<ImageProviderSwitchResponse> {
  try {
    imageEngine.switchProvider(data.providerId);
    // Persist so the choice survives restarts and providersGet reflects it
    // (the stored value takes precedence over live engine state there).
    const { providers } = await getImageProviders();
    await saveImageProviders(providers, data.providerId);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to switch image provider';
    return { success: false, error };
  }
}

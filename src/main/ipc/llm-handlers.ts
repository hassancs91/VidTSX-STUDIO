import { IpcMainInvokeEvent } from 'electron';
import { logEngine } from '../../logging/log-engine';
import { llmEngine, PROVIDER_PRESETS } from '../../engine';

const log = logEngine.createLogger('LLMHandlers');
import type { ProviderConfig } from '../../engine/types';
import { getLlmProviders, saveLlmProviders } from '../services/settings';
import { extractHtmlCode } from '../../engine/utils';
import { aiUsageService } from '../services/ai-usage';
import type {
  LlmProvidersGetResponse,
  LlmProvidersSaveRequest,
  LlmProvidersSaveResponse,
  LlmProviderTestRequest,
  LlmProviderTestResponse,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmChatGenerateRequest,
  LlmChatGenerateResponse,
  LlmCancelResponse,
} from '../../shared/ipc/types';
import { composeSystemPrompt } from '../services/skills-registry';

export async function handleLlmProvidersGet(): Promise<LlmProvidersGetResponse> {
  try {
    const { providers, activeProvider } = await getLlmProviders();
    return {
      providers,
      activeProvider: activeProvider || llmEngine.getActiveProvider(),
      presets: PROVIDER_PRESETS,
    };
  } catch (err) {
    return {
      providers: [],
      activeProvider: null,
      presets: PROVIDER_PRESETS,
    };
  }
}

export async function handleLlmProvidersSave(
  _event: IpcMainInvokeEvent,
  data: LlmProvidersSaveRequest
): Promise<LlmProvidersSaveResponse> {
  try {
    await saveLlmProviders(data.providers, data.activeProvider);

    // Re-initialize engine with new configs
    const currentProviders = llmEngine.getProviders();
    for (const id of currentProviders) {
      llmEngine.unregister(id);
    }

    for (const config of data.providers) {
      try {
        llmEngine.register(config);
      } catch (err) {
        log.warn(`Failed to register provider "${config.id}"`, { error: err instanceof Error ? err.message : String(err) });
      }
    }

    if (data.activeProvider) {
      try {
        llmEngine.switchProvider(data.activeProvider);
      } catch {
        // Provider not available
      }
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save provider settings';
    return { success: false, error };
  }
}

export async function handleLlmProviderTest(
  _event: IpcMainInvokeEvent,
  data: LlmProviderTestRequest
): Promise<LlmProviderTestResponse> {
  try {
    const config: ProviderConfig = { ...data.provider, enabled: true };
    const testId = `__test_${config.id}_${Date.now()}`;
    const testConfig: ProviderConfig = { ...config, id: testId };

    log.debug('Testing provider', { id: testConfig.id, type: testConfig.type, defaultModel: testConfig.defaultModel });

    llmEngine.register(testConfig);

    try {
      log.debug('Calling generateWith for test...');
      const result = await llmEngine.generateWith(testId, {
        prompt: 'Say hello in one word.',
        maxTokens: 32,
      });

      log.debug('Test success', { response: result.text.trim() });

      // Log usage (fire-and-forget)
      aiUsageService.appendEntry({
        timestamp: new Date().toISOString(),
        provider: config.id,
        model: result.model || config.defaultModel,
        featureSource: 'provider-test',
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        cacheReadInputTokens: result.usage?.cacheReadInputTokens ?? 0,
        costUsd: result.usage?.costUsd ?? 0,
        durationMs: result.durationMs ?? 0,
        requestType: 'llm',
      }).catch(() => {});

      return {
        success: true,
        responseText: result.text.trim(),
        durationMs: result.durationMs,
      };
    } finally {
      llmEngine.unregister(testId);
    }
  } catch (err) {
    log.error('Provider test failed', err);
    const error = err instanceof Error ? err.message : 'Connection test failed';
    return { success: false, error };
  }
}

export async function handleLlmGenerate(
  _event: IpcMainInvokeEvent,
  data: LlmGenerateRequest
): Promise<LlmGenerateResponse> {
  try {
    const start = Date.now();

    const composedSystemPrompt = data.skillIds && data.skillIds.length > 0
      ? await composeSystemPrompt(data.systemPrompt ?? '', data.skillIds)
      : data.systemPrompt;

    const request = {
      prompt: data.prompt,
      systemPrompt: composedSystemPrompt,
      ...(data.model ? { model: data.model } : {}),
      ...(data.maxTokens ? { maxTokens: data.maxTokens } : {}),
      ...(data.temperature !== undefined ? { temperature: data.temperature } : {}),
      ...(data.thinking ? { thinking: data.thinking } : {}),
      ...(data.effort ? { effort: data.effort } : {}),
      ...(data.maxTurns ? { maxTurns: data.maxTurns } : {}),
      ...(data.reflectionLoops ? { reflectionLoops: data.reflectionLoops } : {}),
      ...(data.reflectionPrompt ? { reflectionPrompt: data.reflectionPrompt } : {}),
      ...(data.images ? { images: data.images } : {}),
      ...(data.agentTools ? { agentTools: data.agentTools } : {}),
      ...(data.allowedTools ? { allowedTools: data.allowedTools } : {}),
      ...(data.sessionScope ? { sessionScope: data.sessionScope } : {}),
    };

    const result = data.providerId
      ? await llmEngine.generateWith(data.providerId, request)
      : await llmEngine.generate(request);

    const durationMs = Date.now() - start;

    // Log usage (fire-and-forget)
    aiUsageService.appendEntry({
      timestamp: new Date().toISOString(),
      provider: result.provider || data.providerId || 'unknown',
      model: result.model || data.model || 'unknown',
      featureSource: data.featureSource ?? 'other',
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      cacheReadInputTokens: result.usage?.cacheReadInputTokens ?? 0,
      costUsd: result.usage?.costUsd ?? 0,
      durationMs,
      requestType: 'llm',
    }).catch(() => {});

    return {
      success: true,
      text: result.text,
      thinking: result.thinking,
      model: result.model,
      durationMs,
      debugLog: result.debugLog,
      usage: result.usage,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Generation failed';
    return { success: false, error };
  }
}

export async function handleLlmChatGenerate(
  _event: IpcMainInvokeEvent,
  data: LlmChatGenerateRequest
): Promise<LlmChatGenerateResponse> {
  try {
    const request = {
      prompt: data.messages[data.messages.length - 1]?.content || '',
      messages: data.messages,
      systemPrompt: data.systemPrompt,
      ...(data.model ? { model: data.model } : {}),
      ...(data.maxTokens ? { maxTokens: data.maxTokens } : {}),
      ...(data.temperature !== undefined ? { temperature: data.temperature } : {}),
      ...(data.thinking ? { thinking: data.thinking } : {}),
      ...(data.effort ? { effort: data.effort } : {}),
      ...(data.maxTurns ? { maxTurns: data.maxTurns } : {}),
      ...(data.sessionScope ? { sessionScope: data.sessionScope } : {}),
    };

    const result = data.providerId
      ? await llmEngine.generateWith(data.providerId, request)
      : await llmEngine.generate(request);

    // Log usage (fire-and-forget)
    aiUsageService.appendEntry({
      timestamp: new Date().toISOString(),
      provider: result.provider || data.providerId || 'unknown',
      model: result.model || data.model || 'unknown',
      featureSource: data.featureSource ?? 'ai-chat',
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      cacheReadInputTokens: result.usage?.cacheReadInputTokens ?? 0,
      costUsd: result.usage?.costUsd ?? 0,
      durationMs: result.durationMs ?? 0,
      requestType: 'llm',
    }).catch(() => {});

    return {
      success: true,
      text: result.text,
      thinking: result.thinking,
      htmlCode: extractHtmlCode(result.text),
      model: result.model,
      durationMs: result.durationMs,
      debugLog: result.debugLog,
      usage: result.usage,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Chat generation failed';
    return { success: false, error };
  }
}

export async function handleLlmCancel(): Promise<LlmCancelResponse> {
  try {
    llmEngine.abortActive();
    return { success: true };
  } catch {
    return { success: false };
  }
}

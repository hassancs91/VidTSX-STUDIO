import { IpcMainInvokeEvent } from 'electron';
import { logEngine } from '../../logging/log-engine';
import { llmEngine, PROVIDER_PRESETS } from '../../engine';
import { llmLocalEngine } from '../../llm-engine';

const log = logEngine.createLogger('LLMHandlers');
import type { ProviderConfig } from '../../engine/types';
import { getLlmProviders, saveLlmProviders, getProviderCredentials } from '../services/settings';
import { initLLMEngine } from '../services/llm-init';
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

// V1 ships only `agent-sdk` presets (V1_RELEASE_PLAN Phase H1) — every visible
// provider gets tools AND prompt caching; nothing ships degraded. `openai` and
// `gemini` return in V2 with real tool-translation layers. The one-line H2
// rule: filter PRESETS only, NEVER saved providers — a saved config for a
// hidden preset keeps working (grandfathered).
// `zai` joined the hidden set 2026-08-17 (Hasan: V1 ships Claude ×2 +
// OpenRouter + MiniMax + Kimi; Z.AI returns later) — same grandfathering
// rule applies: a saved zai config keeps working, only the preset row hides.
const V1_HIDDEN_PRESET_IDS = new Set(['openai', 'gemini', 'zai']);

/** H4 dev override: VITE_FF_ALL_PROVIDERS=1 restores the hidden presets.
 *  The shared VITE_ prefix reaches main-process import.meta.env under
 *  electron-vite (same mechanism as crash-reporting's VITE_SENTRY_DSN). */
function allPresetsEnabled(): boolean {
  const v = import.meta.env?.VITE_FF_ALL_PROVIDERS;
  return v === '1' || v === 'true';
}

export async function handleLlmProvidersGet(): Promise<LlmProvidersGetResponse> {
  try {
    const { providers, activeProvider } = await getLlmProviders();

    // The Local provider only makes sense when node-llama-cpp is actually
    // loadable — production builds don't bundle it yet, so hide the preset
    // (and any stale saved config) there instead of offering a dead option.
    // This local case is the ONE exception to the filter-presets-only rule,
    // because a local config genuinely cannot run.
    const localAvailable = await llmLocalEngine.isAvailable();
    const credentials = await getProviderCredentials();
    const visibleProviders = (localAvailable ? providers : providers.filter((p) => p.type !== 'local'))
      // OpenRouter has no enable toggle in the UI — the shared BYOK credential
      // IS the enablement (Phase C rule), and a saved `enabled: false` is an
      // artifact of the wholesale provider save. Mirror what initLLMEngine
      // registers so the renderer (Inspector provider select) sees the truth.
      .map((p) =>
        p.id === 'openrouter' && !p.apiKey && credentials.openrouter ? { ...p, enabled: true } : p,
      );
    let visiblePresets = localAvailable
      ? PROVIDER_PRESETS
      : PROVIDER_PRESETS.filter((p) => p.type !== 'local');
    if (!allPresetsEnabled()) {
      visiblePresets = visiblePresets.filter((p) => !V1_HIDDEN_PRESET_IDS.has(p.id));
    }

    // Surface auto-enabled presets that need no saved config: local models
    // (keyless) and BYOK providers whose shared credential exists. Never send
    // the credential itself to the renderer.
    const savedIds = new Set(providers.map((p) => p.id));
    const extras: ProviderConfig[] = [];
    const localPreset = visiblePresets.find((p) => p.id === 'local');
    if (localPreset && !savedIds.has('local')) {
      extras.push({ ...localPreset, enabled: true });
    }
    for (const id of ['openrouter', 'zai'] as const) {
      const preset = PROVIDER_PRESETS.find((p) => p.id === id);
      if (preset && !savedIds.has(id) && credentials[id]) {
        extras.push({ ...preset, enabled: true });
      }
    }

    // H2 stranding guard: an active pointer at a preset this handler filtered
    // (stale `local`, or a hidden preset with no saved config) would render a
    // blank select while main kept using it. Fall back to the first usable
    // returned provider — renderer display only; main's resolveToolSupport
    // reads settings unfiltered and stays the truth.
    const returned = [...visibleProviders, ...extras];
    const resolvedActive = activeProvider || llmEngine.getActiveProvider();
    const filteredIds = new Set(
      PROVIDER_PRESETS.filter((p) => !visiblePresets.some((v) => v.id === p.id)).map((p) => p.id),
    );
    const activeOut =
      resolvedActive && filteredIds.has(resolvedActive) && !returned.some((p) => p.id === resolvedActive)
        ? (returned.find((p) => p.enabled)?.id ?? null)
        : resolvedActive;

    return {
      providers: returned,
      activeProvider: activeOut,
      presets: visiblePresets,
    };
  } catch (err) {
    return {
      providers: [],
      activeProvider: null,
      presets: PROVIDER_PRESETS.filter((p) => !V1_HIDDEN_PRESET_IDS.has(p.id)),
    };
  }
}

export async function handleLlmProvidersSave(
  _event: IpcMainInvokeEvent,
  data: LlmProvidersSaveRequest
): Promise<LlmProvidersSaveResponse> {
  try {
    await saveLlmProviders(data.providers, data.activeProvider);

    // Re-materialize the engine from the just-saved settings via the same
    // path boot uses. Registering `data.providers` raw here used to drop the
    // BYOK credential merge and the keyless presets (local, credential-backed
    // openrouter/zai) until the next app restart.
    const currentProviders = llmEngine.getProviders();
    for (const id of currentProviders) {
      llmEngine.unregister(id);
    }
    await initLLMEngine();

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

/**
 * Runs an LLM generation directly (no IPC round-trip). Used by the IPC handler
 * below and by main-process callers like the TSX job engine, which also pass a
 * per-job AbortSignal — something the IPC request cannot carry.
 */
export async function runLlmGenerate(
  data: LlmGenerateRequest,
  signal?: AbortSignal,
  onTextDelta?: (delta: string) => void,
  /** In-process-only request fields the IPC type can't carry (live objects)
   *  or that must never come from the renderer (trailing prompt text). */
  extras?: { mcpServers?: Record<string, unknown>; trailingSystemPrompt?: string }
): Promise<LlmGenerateResponse> {
  try {
    const start = Date.now();

    const composedSystemPrompt =
      (data.skillIds && data.skillIds.length > 0) || extras?.trailingSystemPrompt
        ? await composeSystemPrompt(
            data.systemPrompt ?? '',
            data.skillIds ?? [],
            extras?.trailingSystemPrompt,
          )
        : data.systemPrompt;

    // Content policy clause for Flows (CONTENT_SAFETY_DESIGN.md D4): a flow's
    // system prompt is user-authored config, so the app's one policy line is
    // appended main-side. Text only — LLM surfaces carry NO moderation hooks,
    // by design (the visual gates sit on the image/video engines).
    const finalSystemPrompt =
      data.featureSource === 'flows'
        ? `${composedSystemPrompt ?? ''}${composedSystemPrompt ? '\n\n' : ''}Content policy: this app does not produce sexual or explicit content. Decline such requests and state why.`
        : composedSystemPrompt;

    const request = {
      prompt: data.prompt,
      systemPrompt: finalSystemPrompt,
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
      ...(data.messages ? { messages: data.messages } : {}),
      ...(signal ? { signal } : {}),
      ...(onTextDelta ? { onTextDelta } : {}),
      ...(extras?.mcpServers ? { mcpServers: extras.mcpServers } : {}),
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

export async function handleLlmGenerate(
  _event: IpcMainInvokeEvent,
  data: LlmGenerateRequest
): Promise<LlmGenerateResponse> {
  return runLlmGenerate(data);
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

import type {
  ProviderId, ProviderConfig, LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent, LLMUsage,
} from "./types";
import { ClaudeProvider } from "./providers/claude-provider";
import { AnthropicCompatProvider } from "./providers/anthropic-compat-provider";
import { OpenAICompatProvider } from "./providers/openai-compat-provider";
import { GeminiProvider } from "./providers/gemini-provider";
import { logEngine } from "../logging/log-engine";

const log = logEngine.createLogger('LLM');

const DEFAULT_REFLECTION_PROMPT =
  'Review your previous response. Identify any issues, improve clarity, accuracy, and completeness. Output only the improved version.';

class LLMEngine {
  private providers = new Map<ProviderId, LLMProvider>();
  private activeId: ProviderId | null = null;
  private lastUsedId: ProviderId | null = null;

  register(config: ProviderConfig): void {
    if (!config.enabled) return;

    let provider: LLMProvider;

    if (config.type === "agent-sdk") {
      provider = new ClaudeProvider(config.id, config.authMode, config.defaultModel, config.apiKey, config.baseURL);
    } else if (config.type === "openai-compat") {
      if (!config.apiKey) throw new Error(`API key required for provider "${config.id}"`);
      provider = new OpenAICompatProvider(config.id, config.apiKey, config.baseURL ?? "https://api.openai.com/v1", config.defaultModel);
    } else if (config.type === "gemini") {
      if (!config.apiKey) throw new Error(`API key required for provider "${config.id}"`);
      provider = new GeminiProvider(config.id, config.apiKey, config.defaultModel);
    } else {
      if (!config.apiKey) throw new Error(`API key required for provider "${config.id}"`);
      provider = new AnthropicCompatProvider(config.id, config.apiKey, config.baseURL!, config.defaultModel);
    }

    this.providers.set(config.id, provider);
    if (!this.activeId) this.activeId = config.id;
    log.info('Provider registered', { providerId: config.id, type: config.type });
  }

  switchProvider(id: ProviderId): void {
    if (!this.providers.has(id)) throw new Error(`Provider "${id}" not registered`);
    this.activeId = id;
    log.info('Switched provider', { providerId: id });
  }

  getProviders(): ProviderId[] {
    return Array.from(this.providers.keys());
  }

  getActiveProvider(): ProviderId | null {
    return this.activeId;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    log.debug('Generate request', { provider: this.activeId, model: request.model, reflectionLoops: request.reflectionLoops });
    this.lastUsedId = this.activeId;
    return this.executeWithReflection(this.getActive(), request);
  }

  async *stream(request: LLMRequest): AsyncIterable<LLMStreamEvent> {
    const provider = this.getActive();
    if (!provider.streamGenerate) {
      const response = await provider.generate(request);
      yield { type: "text", text: response.text };
      yield { type: "done", response };
      return;
    }
    yield* provider.streamGenerate(request);
  }

  async generateWith(providerId: ProviderId, request: LLMRequest): Promise<LLMResponse> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Provider "${providerId}" not registered`);
    this.lastUsedId = providerId;
    return this.executeWithReflection(provider, request);
  }

  abortActive(): void {
    const idsToAbort = new Set<ProviderId>();
    if (this.activeId) idsToAbort.add(this.activeId);
    if (this.lastUsedId) idsToAbort.add(this.lastUsedId);
    for (const id of idsToAbort) {
      this.abortProvider(id);
    }
  }

  /** Abort every registered provider — used at app shutdown so no claude.exe children are orphaned. */
  abortAll(): void {
    for (const id of this.providers.keys()) {
      this.abortProvider(id);
    }
  }

  private abortProvider(id: ProviderId): void {
    const provider = this.providers.get(id);
    if (provider && 'abort' in provider && typeof (provider as { abort: () => void }).abort === 'function') {
      (provider as { abort: () => void }).abort();
    }
  }

  unregister(id: ProviderId): void {
    this.providers.delete(id);
    if (this.activeId === id) {
      this.activeId = this.providers.keys().next().value ?? null;
    }
  }

  private getActive(): LLMProvider {
    if (!this.activeId || !this.providers.has(this.activeId)) {
      throw new Error("No active provider. Call register() first.");
    }
    return this.providers.get(this.activeId)!;
  }

  /**
   * Orchestrates reflection loops internally.
   * - Single pass (no reflection): direct provider call
   * - Multiple passes: generate → reset session → reflect → reset → ... → reset → return final
   * Conversation history (messages) is only used for the initial pass.
   * After reflection, the session is reset so the next call can re-feed history cleanly.
   */
  private async executeWithReflection(provider: LLMProvider, request: LLMRequest): Promise<LLMResponse> {
    const loops = request.reflectionLoops ?? 1;

    // Strip reflection params from the request passed to provider (prevent recursion)
    const { reflectionLoops: _rl, reflectionPrompt: _rp, ...providerRequest } = request;

    // Pass 1: normal generation
    let passStart = Date.now();
    let result = await provider.generate(providerRequest);

    if (loops <= 1) return result;

    // Track timing and usage across all passes
    const passTimings: Array<{ turn: number; durationMs: number; hasThinking: boolean; thinkingChars?: number }> = [];
    const allDebugLogs: string[] = [...(result.debugLog ?? [])];
    let totalInputTokens = result.usage?.inputTokens ?? 0;
    let totalOutputTokens = result.usage?.outputTokens ?? 0;
    let totalCost = result.usage?.costUsd ?? 0;
    let totalApiMs = result.usage?.durationApiMs ?? 0;

    // Record pass 1
    passTimings.push({
      turn: 1,
      durationMs: Date.now() - passStart,
      hasThinking: !!result.thinking,
      ...(result.thinking ? { thinkingChars: result.thinking.length } : {}),
    });

    const reflectionInstruction = request.reflectionPrompt ?? DEFAULT_REFLECTION_PROMPT;

    for (let i = 2; i <= loops; i++) {
      // Reset this scope's session for clean, independent reflection —
      // other scopes' live sessions must not be touched
      provider.resetSession?.(request.sessionScope);

      allDebugLogs.push(`[engine] reflection pass ${i}/${loops}`);
      passStart = Date.now();

      const reflectionPrompt = `Here is my previous response:\n\n---\n${result.text}\n---\n\n${reflectionInstruction}`;
      result = await provider.generate({
        ...providerRequest,
        prompt: reflectionPrompt,
        messages: undefined, // don't replay chat history during reflection
      });

      allDebugLogs.push(...(result.debugLog ?? []));
      totalInputTokens += result.usage?.inputTokens ?? 0;
      totalOutputTokens += result.usage?.outputTokens ?? 0;
      totalCost += result.usage?.costUsd ?? 0;
      totalApiMs += result.usage?.durationApiMs ?? 0;

      passTimings.push({
        turn: i,
        durationMs: Date.now() - passStart,
        hasThinking: !!result.thinking,
        ...(result.thinking ? { thinkingChars: result.thinking.length } : {}),
      });
    }

    // Reset session after reflection so next call starts fresh with conversation history
    provider.resetSession?.(request.sessionScope);

    // Merge usage across all passes
    const mergedUsage: LLMUsage = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      ...(totalCost > 0 ? { costUsd: totalCost } : {}),
      numTurns: loops,
      ...(totalApiMs > 0 ? { durationApiMs: totalApiMs } : {}),
      turnTimings: passTimings,
      ...(result.usage?.modelUsage ? { modelUsage: result.usage.modelUsage } : {}),
    };

    return {
      ...result,
      usage: mergedUsage,
      debugLog: allDebugLogs,
    };
  }
}

export const llmEngine = new LLMEngine();

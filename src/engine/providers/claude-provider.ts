import path from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
import type {
  LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent, LLMUsage, LLMTurnTiming, AuthMode, EffortLevel,
} from "../types";
import { LLMEngineError } from "../types";
import { getHumanReadableError, isCliNotFoundError, getStatusCode } from "../utils";
import { logEngine } from "../../logging/log-engine";
import {
  supportsAdaptiveThinking,
  requiresExplicitThinkingDisplay,
  resolveEffort,
} from "./claude-capabilities";

const log = logEngine.createLogger('ClaudeProvider');

const CLI_NOT_INSTALLED_MSG =
  "Claude Code CLI is not installed. Install it with: npm install -g @anthropic-ai/claude-code";

// Bundled claude.exe lives inside app.asar in packaged builds; the SDK's default
// path resolution returns the asar-internal path, which Windows can't spawn. The
// .exe is unpacked by electron-builder's auto-unpack of .exe files — point the
// SDK at the unpacked copy explicitly. Returns undefined in dev so the SDK falls
// back to its own resolution (which works against system-installed claude).
function getBundledClaudeCodePath(): string | undefined {
  if (process.defaultApp) return undefined;
  if (process.platform !== "win32") return undefined;
  return path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "node_modules",
    "@anthropic-ai",
    "claude-agent-sdk-win32-x64",
    "claude.exe",
  );
}

const SESSION_IDLE_TIMEOUT_MS = 120_000;

/** Fields shared by SDKResultSuccess/SDKResultError that signal a failed run. */
interface SdkResultErrorFields {
  subtype?: string;
  is_error?: boolean;
  errors?: string[];
  terminal_reason?: string;
  api_error_status?: number | null;
  result?: string;
}

/**
 * The SDK reports many failures as a `result` message with `is_error`/an error
 * subtype rather than by throwing — usage limits arrive as
 * `terminal_reason: 'blocking_limit'`. Returns a human-readable error message,
 * or null if the result is a genuine success.
 */
function describeErrorResult(r: SdkResultErrorFields): string | null {
  const failed = r.is_error === true || (r.subtype !== undefined && r.subtype !== "success");
  if (!failed) return null;

  if (r.terminal_reason === "blocking_limit") {
    return "Usage limit reached for this provider. Wait for the limit to reset or switch providers.";
  }
  if (r.subtype === "error_max_turns") {
    return "Generation stopped: the model hit the maximum number of turns before finishing.";
  }
  if (r.subtype === "error_max_budget_usd") {
    return "Generation stopped: the configured cost budget was exhausted.";
  }

  const detail = r.errors?.filter(Boolean).join("; ")
    || (typeof r.result === "string" ? r.result.trim() : "");
  return detail || "Generation failed inside the Claude CLI (no details provided).";
}

export class ClaudeProvider implements LLMProvider {
  readonly id: string;

  // Session state
  private session: Query | null = null;
  private sessionAbort: AbortController | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionAlive = false;

  // Input stream
  private messageQueue: SDKUserMessage[] = [];
  private queueResolve: (() => void) | null = null;

  // Session config tracking
  private sessionThinkingKey = "";
  private sessionEffortKey = "";
  private sessionModel = "";
  private sessionScope: string | null = null;
  private sessionSystemPrompt: string | undefined = undefined;

  // Response bridge
  private currentText = "";
  private currentThinking = "";
  private currentDebugLog: string[] = [];
  private pendingResolve: ((response: LLMResponse) => void) | null = null;
  private pendingReject: ((error: unknown) => void) | null = null;
  private pendingStart = 0;
  private pendingModel = "";

  constructor(
    id: string,
    private authMode: AuthMode,
    private defaultModel: string = "claude-sonnet-4-6",
    private apiKey?: string,
    private baseURL?: string,
  ) {
    this.id = id;
    if (authMode === "api-key" && !apiKey) {
      throw new Error("API key required when authMode is 'api-key'");
    }
  }

  private buildEnv(modelOverride?: string): Record<string, string> {
    const env: Record<string, string> = {};
    if (this.baseURL) {
      env.ANTHROPIC_BASE_URL = this.baseURL;
      env.ANTHROPIC_API_KEY = '';  // must be empty when using custom base URL
      // Route all model tiers to the configured model via env vars
      // The SDK uses these env vars to resolve model names internally
      const model = modelOverride || this.defaultModel;
      env.ANTHROPIC_MODEL = model;
      env.ANTHROPIC_SMALL_FAST_MODEL = model;
      env.ANTHROPIC_DEFAULT_SONNET_MODEL = model;
      env.ANTHROPIC_DEFAULT_OPUS_MODEL = model;
      env.ANTHROPIC_DEFAULT_HAIKU_MODEL = model;
    }
    if (this.apiKey) {
      if (this.baseURL) {
        env.ANTHROPIC_AUTH_TOKEN = this.apiKey;
      } else {
        env.ANTHROPIC_API_KEY = this.apiKey;
      }
    }
    return env;
  }

  private buildPromptFromMessages(request: LLMRequest): string {
    if (!request.messages || request.messages.length === 0) return request.prompt;
    return request.messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");
  }

  private buildContentBlocks(request: LLMRequest): string | ContentBlockParam[] {
    const prompt = this.buildPromptFromMessages(request);
    if (!request.images || request.images.length === 0) return prompt;

    const blocks: ContentBlockParam[] = [];
    for (const img of request.images) {
      blocks.push({
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
      });
    }
    blocks.push({ type: 'text' as const, text: prompt });
    return blocks;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    log.debug('generate() called', { baseURL: this.baseURL, defaultModel: this.defaultModel });
    if (request.signal?.aborted) {
      throw new LLMEngineError("Request cancelled", this.id);
    }

    // Forward caller abort to session abort
    if (request.signal) {
      request.signal.addEventListener("abort", () => this.sessionAbort?.abort(), { once: true });
    }

    const thinkingKey = request.thinking ? `${request.thinking.type}:${request.thinking.budgetTokens ?? 0}:${request.thinking.display ?? ''}` : 'off';
    const effortKey = request.effort ?? '';
    const model = request.model || this.defaultModel;

    // Scope gating: no scope => always fresh; mismatch => fresh.
    if (this.sessionAlive) {
      if (!request.sessionScope) {
        log.debug('closing session: no sessionScope on request');
        this.closeSession();
      } else if (request.sessionScope !== this.sessionScope) {
        log.debug('closing session: scope mismatch', { incoming: request.sessionScope, live: this.sessionScope });
        this.closeSession();
      } else if (thinkingKey !== this.sessionThinkingKey || model !== this.sessionModel || effortKey !== this.sessionEffortKey) {
        log.debug('closing session: thinking/effort/model changed');
        this.closeSession();
      } else if (request.systemPrompt !== this.sessionSystemPrompt) {
        log.debug('closing session: systemPrompt changed');
        this.closeSession();
      }
    }

    if (this.sessionAlive) {
      return this.sendToSession(request);
    }

    return this.startSession(request);
  }

  private async startSession(request: LLMRequest): Promise<LLMResponse> {
    this.closeSession();

    // Track session config for change detection
    this.sessionThinkingKey = request.thinking ? `${request.thinking.type}:${request.thinking.budgetTokens ?? 0}:${request.thinking.display ?? ''}` : 'off';
    this.sessionEffortKey = request.effort ?? '';
    this.sessionModel = request.model || this.defaultModel;
    this.sessionScope = request.sessionScope ?? null;
    this.sessionSystemPrompt = request.systemPrompt;

    const env = this.buildEnv(request.model);
    log.debug('Starting session', { baseURL: this.baseURL, defaultModel: this.defaultModel });

    const resolvedModel = request.model || this.defaultModel;
    const thinking = this.buildThinkingConfig(request, resolvedModel);
    const effort = this.buildEffort(request, resolvedModel);
    this.sessionAbort = new AbortController();
    this.messageQueue = [];
    this.queueResolve = null;

    const self = this;

    // Create the input stream async generator
    const inputStream = async function* (): AsyncIterable<SDKUserMessage> {
      // Yield the first message immediately
      yield {
        type: "user" as const,
        message: { role: "user" as const, content: self.buildContentBlocks(request) },
      } as SDKUserMessage;

      // Then wait for and yield subsequent messages
      while (true) {
        if (self.messageQueue.length > 0) {
          yield self.messageQueue.shift()!;
        } else {
          await new Promise<void>((resolve) => { self.queueResolve = resolve; });
        }
      }
    };

    const tools = request.agentTools && request.agentTools.length > 0
      ? request.agentTools
      : [] as string[];
    const maxTurns = tools.length > 0 ? (request.maxTurns || 10) : (request.maxTurns || 1);

    const bundledClaude = getBundledClaudeCodePath();
    const queryInstance = query({
      prompt: inputStream(),
      options: {
        ...(this.baseURL ? {} : { model: resolvedModel }),
        systemPrompt: request.systemPrompt || undefined,
        maxTurns,
        tools,
        abortController: this.sessionAbort,
        settingSources: [],
        ...(bundledClaude ? { pathToClaudeCodeExecutable: bundledClaude } : {}),
        ...(Object.keys(env).length > 0 ? {
          env,
          settings: { env } as Record<string, unknown>,
        } : {}),
        ...(thinking ? { thinking } : {}),
        ...(effort ? { effort } : {}),
        ...(request.allowedTools ? { allowedTools: request.allowedTools } : {}),
      },
    });

    this.session = queryInstance;
    this.currentDebugLog = [
      `[engine] session started — model: ${resolvedModel}, thinking: ${thinking ? JSON.stringify(thinking) : 'off'}, effort: ${effort ?? 'default'}`,
    ];

    // Create the promise for the first response
    const responsePromise = new Promise<LLMResponse>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.pendingStart = Date.now();
      this.pendingModel = request.model || this.defaultModel;
    });

    // Start background message processing loop (fire and forget)
    this.processLoop(queryInstance);

    return responsePromise;
  }

  private sendToSession(request: LLMRequest): Promise<LLMResponse> {
    this.resetIdleTimer();

    // Create promise for this response
    const responsePromise = new Promise<LLMResponse>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.pendingStart = Date.now();
      this.pendingModel = request.model || this.defaultModel;
    });

    // Reset accumulators
    this.currentText = "";
    this.currentThinking = "";
    this.currentDebugLog = [`[engine] reusing session (hot) — thinking: ${this.sessionThinkingKey}`];

    // Push message into the input stream
    this.pushMessage({
      type: "user" as const,
      message: { role: "user" as const, content: this.buildContentBlocks(request) },
    } as SDKUserMessage);

    return responsePromise;
  }

  private async processLoop(queryInstance: Query): Promise<void> {
    const turnTimings: LLMTurnTiming[] = [];
    let turnCount = 0;
    let turnStart = Date.now();

    try {
      for await (const message of queryInstance) {
        if (message.type === "assistant") {
          let turnThinkingChars = 0;
          let hasThinking = false;
          const blockTypes = message.message.content.map((b: { type: string }) => b.type);
          this.currentDebugLog.push(`[engine] blocks: [${blockTypes.join(', ')}]`);
          // Only reset text if this turn has text blocks (preserve text from earlier turns)
          const hasTextBlocks = blockTypes.includes('text');
          if (hasTextBlocks) this.currentText = "";
          for (const block of message.message.content) {
            if (block.type === "text") this.currentText += block.text;
            if (block.type === "thinking" && "thinking" in block) {
              const thinkingText = (block as { type: "thinking"; thinking: string }).thinking;
              this.currentThinking += thinkingText;
              turnThinkingChars += thinkingText.length;
              hasThinking = true;
              this.currentDebugLog.push(`[engine] thinking: ${this.currentThinking.length} chars`);
            }
          }

          // Record turn timing
          turnCount++;
          const turnDuration = Date.now() - turnStart;
          turnTimings.push({
            turn: turnCount,
            durationMs: turnDuration,
            hasThinking,
            ...(turnThinkingChars > 0 ? { thinkingChars: turnThinkingChars } : {}),
          });
          turnStart = Date.now();
        } else if (message.type === "result") {
          // Extract usage stats from SDK result
          const result = message as {
            type: 'result';
            subtype?: string;
            total_cost_usd?: number;
            duration_ms?: number;
            duration_api_ms?: number;
            num_turns?: number;
            usage?: { inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number };
            modelUsage?: Record<string, { inputTokens?: number; outputTokens?: number; costUSD?: number; cacheReadInputTokens?: number }>;
          } & SdkResultErrorFields;

          const resultError = describeErrorResult(result);
          if (resultError) {
            log.error('Result-level error from SDK', undefined, {
              subtype: result.subtype,
              terminalReason: result.terminal_reason,
              apiErrorStatus: result.api_error_status,
            });
            if (this.pendingReject) {
              const reject = this.pendingReject;
              this.pendingResolve = null;
              this.pendingReject = null;
              const friendly = getHumanReadableError(new Error(resultError), this.id);
              reject(new LLMEngineError(friendly, this.id, result.api_error_status ?? undefined));
            }
            this.closeSession();
            return;
          }

          this.sessionAlive = true;
          this.resetIdleTimer();

          const sdkUsage = result.usage;
          const costUsd = result.total_cost_usd;
          const numTurns = result.num_turns;

          // Log to debugLog
          if (costUsd != null) {
            this.currentDebugLog.push(`[engine] cost: $${costUsd.toFixed(4)}`);
          }
          if (numTurns != null) {
            this.currentDebugLog.push(`[engine] turns: ${numTurns}`);
          }
          if (result.duration_api_ms != null) {
            this.currentDebugLog.push(`[engine] api time: ${result.duration_api_ms}ms`);
          }
          if (result.modelUsage) {
            for (const [model, mu] of Object.entries(result.modelUsage)) {
              this.currentDebugLog.push(`[engine] model ${model} — in: ${mu.inputTokens ?? 0}, out: ${mu.outputTokens ?? 0}, cache: ${mu.cacheReadInputTokens ?? 0}, cost: $${(mu.costUSD ?? 0).toFixed(4)}`);
            }
          }

          // Build per-model usage map
          const modelUsageMap = result.modelUsage
            ? Object.fromEntries(
                Object.entries(result.modelUsage).map(([model, mu]) => [model, {
                  inputTokens: mu.inputTokens ?? 0,
                  outputTokens: mu.outputTokens ?? 0,
                  ...(mu.cacheReadInputTokens ? { cacheReadInputTokens: mu.cacheReadInputTokens } : {}),
                  ...(mu.costUSD != null ? { costUsd: mu.costUSD } : {}),
                }])
              )
            : undefined;

          // Aggregate tokens from modelUsage when top-level usage is zero
          let totalInputTokens = sdkUsage?.inputTokens ?? 0;
          let totalOutputTokens = sdkUsage?.outputTokens ?? 0;
          let totalCacheTokens = sdkUsage?.cacheReadInputTokens ?? 0;
          if (totalInputTokens === 0 && totalOutputTokens === 0 && modelUsageMap) {
            for (const mu of Object.values(modelUsageMap)) {
              totalInputTokens += mu.inputTokens;
              totalOutputTokens += mu.outputTokens;
              totalCacheTokens += mu.cacheReadInputTokens ?? 0;
            }
          }

          this.currentDebugLog.push(`[engine] tokens — in: ${totalInputTokens}, out: ${totalOutputTokens}${totalCacheTokens > 0 ? `, cache: ${totalCacheTokens}` : ''}`);

          // Build structured usage
          const llmUsage: LLMUsage = {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            ...(totalCacheTokens > 0 ? { cacheReadInputTokens: totalCacheTokens } : {}),
            ...(costUsd != null ? { costUsd } : {}),
            ...(numTurns != null ? { numTurns } : {}),
            ...(result.duration_api_ms != null ? { durationApiMs: result.duration_api_ms } : {}),
            ...(turnTimings.length > 0 ? { turnTimings: [...turnTimings] } : {}),
            ...(modelUsageMap ? { modelUsage: modelUsageMap } : {}),
          };

          if (this.pendingResolve) {
            const resolve = this.pendingResolve;
            this.pendingResolve = null;
            this.pendingReject = null;
            resolve({
              text: this.currentText,
              ...(this.currentThinking ? { thinking: this.currentThinking } : {}),
              model: this.pendingModel,
              provider: this.id,
              usage: llmUsage,
              durationMs: Date.now() - this.pendingStart,
              debugLog: [...this.currentDebugLog],
            });
          }

          // Reset for next request
          this.currentText = "";
          this.currentThinking = "";
          this.currentDebugLog = [];
          turnTimings.length = 0;
          turnCount = 0;
          turnStart = Date.now();
        }
      }
    } catch (error) {
      log.error('processLoop error', error, {
        errorType: typeof error,
        status: error instanceof Error && 'status' in error ? (error as Record<string, unknown>).status : undefined,
      });
      if (this.pendingReject) {
        const reject = this.pendingReject;
        this.pendingResolve = null;
        this.pendingReject = null;

        if (isCliNotFoundError(error)) {
          reject(new LLMEngineError(CLI_NOT_INSTALLED_MSG, this.id, undefined, error));
        } else {
          const msg = getHumanReadableError(error, this.id);
          reject(new LLMEngineError(msg, this.id, getStatusCode(error), error));
        }
      }
      this.closeSession();
    }
  }

  private pushMessage(msg: SDKUserMessage): void {
    this.messageQueue.push(msg);
    if (this.queueResolve) {
      const resolve = this.queueResolve;
      this.queueResolve = null;
      resolve();
    }
  }

  async *streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamEvent> {
    try {
      const start = Date.now();
      let lastTurnText = "";
      let thinkingText = "";
      const debugLog: string[] = [];
      const turnTimings: LLMTurnTiming[] = [];
      let turnCount = 0;
      let turnStart = Date.now();

      const env = this.buildEnv(request.model);

      const streamModel = request.model || this.defaultModel;
      const thinking = this.buildThinkingConfig(request, streamModel);
      const effort = this.buildEffort(request, streamModel);
      const streamAbort = new AbortController();

      if (request.signal) {
        request.signal.addEventListener("abort", () => streamAbort.abort(), { once: true });
      }

      debugLog.push(`[engine] stream started — model: ${streamModel}, thinking: ${thinking ? JSON.stringify(thinking) : 'off'}, effort: ${effort ?? 'default'}`);

      let sdkResult: ({
        total_cost_usd?: number;
        duration_api_ms?: number;
        num_turns?: number;
        usage?: { inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number };
        modelUsage?: Record<string, { inputTokens?: number; outputTokens?: number; costUSD?: number; cacheReadInputTokens?: number }>;
      } & SdkResultErrorFields) | undefined;

      const contentBlocks = this.buildContentBlocks(request);
      const streamPrompt = typeof contentBlocks === 'string'
        ? contentBlocks
        : (async function* (): AsyncIterable<SDKUserMessage> {
            yield {
              type: "user" as const,
              message: { role: "user" as const, content: contentBlocks },
              parent_tool_use_id: null,
              session_id: '',
            } as SDKUserMessage;
          })();

      const streamTools = request.agentTools && request.agentTools.length > 0
        ? request.agentTools
        : [] as string[];
      const streamMaxTurns = streamTools.length > 0 ? (request.maxTurns || 10) : (request.maxTurns || 1);

      const streamBundledClaude = getBundledClaudeCodePath();
      for await (const message of query({
        prompt: streamPrompt,
        options: {
          ...(this.baseURL ? {} : { model: streamModel }),
          systemPrompt: request.systemPrompt || undefined,
          maxTurns: streamMaxTurns,
          tools: streamTools,
          abortController: streamAbort,
          settingSources: [],
          ...(streamBundledClaude ? { pathToClaudeCodeExecutable: streamBundledClaude } : {}),
          ...(Object.keys(env).length > 0 ? {
            env,
            settings: { env } as Record<string, unknown>,
          } : {}),
          ...(thinking ? { thinking } : {}),
          ...(effort ? { effort } : {}),
          ...(request.allowedTools ? { allowedTools: request.allowedTools } : {}),
        },
      })) {
        if (message.type === "assistant") {
          let turnThinkingChars = 0;
          let hasThinking = false;
          const blockTypes = message.message.content.map((b: { type: string }) => b.type);
          const hasTextBlocks = blockTypes.includes('text');
          if (hasTextBlocks) lastTurnText = "";
          for (const block of message.message.content) {
            if (block.type === "text") {
              lastTurnText += block.text;
            }
            if (block.type === "thinking" && "thinking" in block) {
              const t = (block as { type: "thinking"; thinking: string }).thinking;
              thinkingText += t;
              turnThinkingChars += t.length;
              hasThinking = true;
            }
          }
          turnCount++;
          turnTimings.push({
            turn: turnCount,
            durationMs: Date.now() - turnStart,
            hasThinking,
            ...(turnThinkingChars > 0 ? { thinkingChars: turnThinkingChars } : {}),
          });
          turnStart = Date.now();
        } else if (message.type === "result") {
          sdkResult = message as typeof sdkResult;
        }
      }

      const streamResultError = sdkResult ? describeErrorResult(sdkResult) : null;
      if (streamResultError) {
        yield { type: "error", error: getHumanReadableError(new Error(streamResultError), this.id) };
        return;
      }

      if (lastTurnText) {
        yield { type: "text", text: lastTurnText };
      }

      // Build per-model usage map
      const modelUsageMap = sdkResult?.modelUsage
        ? Object.fromEntries(
            Object.entries(sdkResult.modelUsage).map(([model, mu]) => [model, {
              inputTokens: mu.inputTokens ?? 0,
              outputTokens: mu.outputTokens ?? 0,
              ...(mu.cacheReadInputTokens ? { cacheReadInputTokens: mu.cacheReadInputTokens } : {}),
              ...(mu.costUSD != null ? { costUsd: mu.costUSD } : {}),
            }])
          )
        : undefined;

      // Aggregate tokens from modelUsage when top-level is zero
      let totalIn = sdkResult?.usage?.inputTokens ?? 0;
      let totalOut = sdkResult?.usage?.outputTokens ?? 0;
      let totalCache = sdkResult?.usage?.cacheReadInputTokens ?? 0;
      if (totalIn === 0 && totalOut === 0 && modelUsageMap) {
        for (const mu of Object.values(modelUsageMap)) {
          totalIn += mu.inputTokens;
          totalOut += mu.outputTokens;
          totalCache += mu.cacheReadInputTokens ?? 0;
        }
      }

      // Build structured usage
      const llmUsage: LLMUsage = {
        inputTokens: totalIn,
        outputTokens: totalOut,
        ...(totalCache > 0 ? { cacheReadInputTokens: totalCache } : {}),
        ...(sdkResult?.total_cost_usd != null ? { costUsd: sdkResult.total_cost_usd } : {}),
        ...(sdkResult?.num_turns != null ? { numTurns: sdkResult.num_turns } : {}),
        ...(sdkResult?.duration_api_ms != null ? { durationApiMs: sdkResult.duration_api_ms } : {}),
        ...(turnTimings.length > 0 ? { turnTimings } : {}),
        ...(modelUsageMap ? { modelUsage: modelUsageMap } : {}),
      };

      yield {
        type: "done",
        response: {
          text: lastTurnText,
          ...(thinkingText ? { thinking: thinkingText } : {}),
          model: request.model || this.defaultModel,
          provider: this.id,
          usage: llmUsage,
          durationMs: Date.now() - start,
          debugLog,
        },
      };
    } catch (error) {
      const message = isCliNotFoundError(error)
        ? CLI_NOT_INSTALLED_MSG
        : getHumanReadableError(error, this.id);
      yield { type: "error", error: message };
    }
  }

  abort(): void {
    if (this.pendingReject) {
      const reject = this.pendingReject;
      this.pendingResolve = null;
      this.pendingReject = null;
      reject(new LLMEngineError("Request cancelled", this.id));
    }
    this.sessionAbort?.abort();
    this.closeSession();
  }

  resetSession(): void {
    this.closeSession();
  }

  closeSession(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.session) {
      try { this.session.close(); } catch { /* ignore */ }
      this.session = null;
    }
    this.sessionAbort = null;
    this.sessionAlive = false;
    this.sessionScope = null;
    this.sessionSystemPrompt = undefined;
    this.messageQueue = [];
    this.queueResolve = null;
    this.pendingResolve = null;
    this.pendingReject = null;
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.closeSession(), SESSION_IDLE_TIMEOUT_MS);
  }

  private buildThinkingConfig(request: LLMRequest, model: string) {
    if (!request.thinking || request.thinking.type === "disabled") return undefined;

    // Gate: non-Claude models routed through the SDK (MiniMax-M2.7, non-Claude OpenRouter IDs)
    // don't understand `thinking` — drop it to avoid 400s.
    if (!supportsAdaptiveThinking(model) && request.thinking.type === "adaptive") return undefined;

    if (request.thinking.type === "adaptive") {
      // Opus 4.7 silently defaults display to "omitted" — force "summarized" so our
      // thinking UI stays populated. Caller can override via request.thinking.display.
      const display = request.thinking.display
        ?? (requiresExplicitThinkingDisplay(model) ? "summarized" : undefined);
      return {
        type: "adaptive" as const,
        ...(display ? { display } : {}),
      };
    }
    return {
      type: "enabled" as const,
      budgetTokens: request.thinking.budgetTokens,
      ...(request.thinking.display ? { display: request.thinking.display } : {}),
    };
  }

  private buildEffort(request: LLMRequest, model: string): EffortLevel | undefined {
    return resolveEffort(model, request.effort);
  }
}

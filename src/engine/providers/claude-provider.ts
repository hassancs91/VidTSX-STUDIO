import path from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { CanUseTool, McpServerConfig, Query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
import type {
  LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent, LLMUsage, LLMTurnTiming, AuthMode, EffortLevel,
} from "../types";
import { LLMEngineError } from "../types";
import { getHumanReadableError, isCliNotFoundError } from "../utils";
import { logEngine } from "../../logging/log-engine";
import {
  ClaudeSession,
  CLI_NOT_INSTALLED_MSG,
  describeErrorResult,
  type ClaudeSessionKeys,
  type SdkResultErrorFields,
} from "./claude-session";
import {
  supportsAdaptiveThinking,
  requiresExplicitThinkingDisplay,
  resolveEffort,
} from "./claude-capabilities";

const log = logEngine.createLogger('ClaudeProvider');

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

// Each session is its own claude.exe subprocess — cap the pool so runaway
// callers can't fork-bomb the machine. Evicts least-recently-used idle session.
const MAX_SESSIONS = 8;

export class ClaudeProvider implements LLMProvider {
  readonly id: string;

  /** Hot sessions keyed by sessionScope; scope-less requests are ephemeral. */
  private sessions = new Map<string, ClaudeSession>();

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

  private buildSessionKeys(request: LLMRequest): ClaudeSessionKeys {
    return {
      scope: request.sessionScope ?? null,
      thinkingKey: request.thinking
        ? `${request.thinking.type}:${request.thinking.budgetTokens ?? 0}:${request.thinking.display ?? ''}`
        : 'off',
      effortKey: request.effort ?? '',
      model: request.model || this.defaultModel,
      systemPrompt: request.systemPrompt,
    };
  }

  private createSession(keys: ClaudeSessionKeys, request: LLMRequest): ClaudeSession {
    const resolvedModel = request.model || this.defaultModel;
    const env = this.buildEnv(request.model);
    const thinking = this.buildThinkingConfig(request, resolvedModel);
    const effort = this.buildEffort(request, resolvedModel);
    const tools = request.agentTools && request.agentTools.length > 0
      ? request.agentTools
      : [] as string[];
    // In-process MCP tools count as tools for the turn budget even though the
    // built-in tool list stays empty.
    const hasTools = tools.length > 0 || Boolean(request.mcpServers);
    const maxTurns = hasTools ? (request.maxTurns || 10) : (request.maxTurns || 1);
    const bundledClaude = getBundledClaudeCodePath();

    const session = new ClaudeSession({
      providerId: this.id,
      keys,
      idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
      debugHeader: `[engine] session started — model: ${resolvedModel}, thinking: ${thinking ? JSON.stringify(thinking) : 'off'}, effort: ${effort ?? 'default'}`,
      onClosed: (closed) => {
        if (keys.scope && this.sessions.get(keys.scope) === closed) {
          this.sessions.delete(keys.scope);
        }
      },
      createQuery: (inputStream: AsyncIterable<SDKUserMessage>, abort: AbortController): Query =>
        query({
          prompt: inputStream,
          options: {
            ...(this.baseURL ? {} : { model: resolvedModel }),
            systemPrompt: request.systemPrompt || undefined,
            maxTurns,
            tools,
            abortController: abort,
            settingSources: [],
            ...(request.onTextDelta ? { includePartialMessages: true } : {}),
            ...(bundledClaude ? { pathToClaudeCodeExecutable: bundledClaude } : {}),
            ...(Object.keys(env).length > 0 ? {
              env,
              settings: { env } as Record<string, unknown>,
            } : {}),
            ...(thinking ? { thinking } : {}),
            ...(effort ? { effort } : {}),
            ...(request.allowedTools ? { allowedTools: request.allowedTools } : {}),
            ...(request.mcpServers
              ? { mcpServers: request.mcpServers as Record<string, McpServerConfig> }
              : {}),
            // The agents feature's file-tool path guard (agents plan §1.2).
            ...(request.cwd ? { cwd: request.cwd } : {}),
            ...(request.canUseTool ? { canUseTool: request.canUseTool as CanUseTool } : {}),
          },
        }),
    });

    return session;
  }

  /** Close least-recently-used idle sessions when the pool is over cap. */
  private evictOverCap(): void {
    if (this.sessions.size <= MAX_SESSIONS) return;
    const idle = [...this.sessions.values()]
      .filter((s) => !s.busy)
      .sort((a, b) => a.lastUsedAt - b.lastUsedAt);
    for (const session of idle) {
      if (this.sessions.size <= MAX_SESSIONS) break;
      log.debug('Evicting idle session (pool over cap)', { scope: session.keys.scope });
      session.close();
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    log.debug('generate() called', { baseURL: this.baseURL, defaultModel: this.defaultModel, scope: request.sessionScope });
    if (request.signal?.aborted) {
      throw new LLMEngineError("Request cancelled", this.id);
    }

    const keys = this.buildSessionKeys(request);
    const model = request.model || this.defaultModel;
    const content = this.buildContentBlocks(request);

    if (!keys.scope) {
      // Scope-less request: one-shot session, torn down after the response
      const session = this.createSession(keys, request);
      try {
        return await session.request(content, model, request.signal, request.onTextDelta);
      } finally {
        session.close();
      }
    }

    let session = this.sessions.get(keys.scope);
    if (session && (!session.alive || !session.matches(keys))) {
      log.debug('Closing session: config/scope mismatch', { scope: keys.scope });
      session.close();
      session = undefined;
    }
    if (!session) {
      session = this.createSession(keys, request);
      this.sessions.set(keys.scope, session);
      this.evictOverCap();
    }

    return session.request(content, model, request.signal, request.onTextDelta);
  }

  /** Abort every in-flight request and tear down all sessions (global cancel). */
  abort(): void {
    for (const session of [...this.sessions.values()]) {
      session.abort();
    }
    this.sessions.clear();
  }

  /**
   * Close a specific scope's session, or all sessions when no scope is given.
   * Reflection passes use this to force a fresh conversation without touching
   * other scopes' live sessions.
   */
  resetSession(sessionScope?: string): void {
    if (sessionScope) {
      this.sessions.get(sessionScope)?.close();
      return;
    }
    for (const session of [...this.sessions.values()]) {
      session.close();
    }
    this.sessions.clear();
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

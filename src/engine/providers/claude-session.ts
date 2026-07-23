import type { Query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
import type { LLMResponse, LLMUsage, LLMTurnTiming } from "../types";
import { LLMEngineError } from "../types";
import { getHumanReadableError, isCliNotFoundError, getStatusCode } from "../utils";
import { logEngine } from "../../logging/log-engine";

const log = logEngine.createLogger('ClaudeSession');

export const CLI_NOT_INSTALLED_MSG =
  "Claude Code CLI is not installed. Install it with: npm install -g @anthropic-ai/claude-code";

/** Fields shared by SDKResultSuccess/SDKResultError that signal a failed run. */
export interface SdkResultErrorFields {
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
export function describeErrorResult(r: SdkResultErrorFields): string | null {
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

/** Config values a session is pinned to — a mismatch means a fresh session. */
export interface ClaudeSessionKeys {
  scope: string | null;
  thinkingKey: string;
  effortKey: string;
  model: string;
  systemPrompt: string | undefined;
}

interface ClaudeSessionArgs {
  providerId: string;
  keys: ClaudeSessionKeys;
  /** Builds the SDK query for this session's input stream + abort controller. */
  createQuery: (inputStream: AsyncIterable<SDKUserMessage>, abort: AbortController) => Query;
  /** Called exactly once when the session is torn down, for pool eviction. */
  onClosed: (session: ClaudeSession) => void;
  idleTimeoutMs: number;
  debugHeader: string;
}

/**
 * One live Claude Agent-SDK conversation: the spawned CLI query, its input
 * stream, response accumulators, and the single in-flight promise bridge.
 * A session handles one request at a time; concurrency comes from the
 * provider holding multiple sessions (one per sessionScope).
 */
export class ClaudeSession {
  readonly keys: ClaudeSessionKeys;
  lastUsedAt = Date.now();

  private readonly providerId: string;
  private readonly createQuery: ClaudeSessionArgs['createQuery'];
  private readonly onClosed: (session: ClaudeSession) => void;
  private readonly idleTimeoutMs: number;
  private readonly debugHeader: string;

  private query: Query | null = null;
  private abortController: AbortController | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  // Input stream
  private messageQueue: SDKUserMessage[] = [];
  private queueResolve: (() => void) | null = null;

  // Response bridge (one in-flight request at a time)
  private currentText = "";
  private currentThinking = "";
  private currentDebugLog: string[] = [];
  private pendingResolve: ((response: LLMResponse) => void) | null = null;
  private pendingReject: ((error: unknown) => void) | null = null;
  private pendingStart = 0;
  private pendingModel = "";

  constructor(args: ClaudeSessionArgs) {
    this.providerId = args.providerId;
    this.keys = args.keys;
    this.createQuery = args.createQuery;
    this.onClosed = args.onClosed;
    this.idleTimeoutMs = args.idleTimeoutMs;
    this.debugHeader = args.debugHeader;
  }

  matches(keys: ClaudeSessionKeys): boolean {
    return this.keys.scope === keys.scope
      && this.keys.thinkingKey === keys.thinkingKey
      && this.keys.effortKey === keys.effortKey
      && this.keys.model === keys.model
      && this.keys.systemPrompt === keys.systemPrompt;
  }

  get busy(): boolean {
    return this.pendingResolve !== null;
  }

  get alive(): boolean {
    return !this.disposed;
  }

  request(
    content: string | ContentBlockParam[],
    model: string,
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    if (this.disposed) {
      return Promise.reject(new LLMEngineError("Session already closed", this.providerId));
    }
    if (this.busy) {
      return Promise.reject(new LLMEngineError("Session busy: a request is already in flight", this.providerId));
    }

    this.lastUsedAt = Date.now();
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (signal) {
      if (signal.aborted) {
        return Promise.reject(new LLMEngineError("Request cancelled", this.providerId));
      }
      signal.addEventListener("abort", () => this.abort(), { once: true });
    }

    const responsePromise = new Promise<LLMResponse>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.pendingStart = Date.now();
      this.pendingModel = model;
    });

    const userMessage = {
      type: "user" as const,
      message: { role: "user" as const, content },
    } as SDKUserMessage;

    if (!this.query) {
      // First request: build the input stream (yields this message, then waits
      // for pushed follow-ups) and spawn the CLI query.
      this.currentDebugLog = [this.debugHeader];
      this.abortController = new AbortController();
      this.messageQueue = [];
      this.queueResolve = null;
      const self = this;
      const inputStream = async function* (): AsyncIterable<SDKUserMessage> {
        yield userMessage;
        while (true) {
          if (self.messageQueue.length > 0) {
            yield self.messageQueue.shift()!;
          } else {
            await new Promise<void>((resolve) => { self.queueResolve = resolve; });
          }
        }
      };
      this.query = this.createQuery(inputStream(), this.abortController);
      void this.processLoop(this.query);
    } else {
      // Hot session: reset accumulators and push the message
      this.currentText = "";
      this.currentThinking = "";
      this.currentDebugLog = [`[engine] reusing session (hot) — thinking: ${this.keys.thinkingKey}`];
      this.messageQueue.push(userMessage);
      if (this.queueResolve) {
        const resolve = this.queueResolve;
        this.queueResolve = null;
        resolve();
      }
    }

    return responsePromise;
  }

  abort(): void {
    this.rejectPending(new LLMEngineError("Request cancelled", this.providerId));
    this.abortController?.abort();
    this.close();
  }

  close(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.query) {
      try { this.query.close(); } catch { /* ignore */ }
      this.query = null;
    }
    this.abortController = null;
    this.messageQueue = [];
    this.queueResolve = null;
    this.rejectPending(new LLMEngineError("Session closed", this.providerId));
    this.onClosed(this);
  }

  private rejectPending(error: unknown): void {
    if (!this.pendingReject) return;
    const reject = this.pendingReject;
    this.pendingResolve = null;
    this.pendingReject = null;
    reject(error);
  }

  private resolvePending(response: LLMResponse): void {
    if (!this.pendingResolve) return;
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    this.pendingReject = null;
    resolve(response);
  }

  private armIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.close(), this.idleTimeoutMs);
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

          turnCount++;
          turnTimings.push({
            turn: turnCount,
            durationMs: Date.now() - turnStart,
            hasThinking,
            ...(turnThinkingChars > 0 ? { thinkingChars: turnThinkingChars } : {}),
          });
          turnStart = Date.now();
        } else if (message.type === "result") {
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
            const friendly = getHumanReadableError(new Error(resultError), this.providerId);
            this.rejectPending(new LLMEngineError(friendly, this.providerId, result.api_error_status ?? undefined));
            this.close();
            return;
          }

          const sdkUsage = result.usage;
          const costUsd = result.total_cost_usd;
          const numTurns = result.num_turns;

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

          this.resolvePending({
            text: this.currentText,
            ...(this.currentThinking ? { thinking: this.currentThinking } : {}),
            model: this.pendingModel,
            provider: this.providerId,
            usage: llmUsage,
            durationMs: Date.now() - this.pendingStart,
            debugLog: [...this.currentDebugLog],
          });

          // Reset for the next request on this session
          this.currentText = "";
          this.currentThinking = "";
          this.currentDebugLog = [];
          turnTimings.length = 0;
          turnCount = 0;
          turnStart = Date.now();
          this.armIdleTimer();
        }
      }
    } catch (error) {
      log.error('processLoop error', error, {
        errorType: typeof error,
        status: error instanceof Error && 'status' in error ? (error as Record<string, unknown>).status : undefined,
      });
      if (isCliNotFoundError(error)) {
        this.rejectPending(new LLMEngineError(CLI_NOT_INSTALLED_MSG, this.providerId, undefined, error));
      } else {
        const msg = getHumanReadableError(error, this.providerId);
        this.rejectPending(new LLMEngineError(msg, this.providerId, getStatusCode(error), error));
      }
      this.close();
    }
  }
}

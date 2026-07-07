/** Provider identifier */
export type ProviderId = string; // e.g. "claude", "minimax", "deepseek"

/** Authentication mode */
export type AuthMode = "subscription" | "api-key";

/** Effort level — controls thinking depth + overall token spend on Opus 4.5+/Sonnet 4.6+. */
export type EffortLevel = "low" | "medium" | "high" | "xhigh" | "max";

/** Extended thinking configuration */
export interface ThinkingConfig {
  type: "enabled" | "adaptive" | "disabled";
  budgetTokens?: number;   // min 1024, used when type is "enabled"
  display?: "summarized" | "omitted";  // Opus 4.7 defaults to "omitted" (empty thinking text); set "summarized" to keep thinking visible
}

/** Chat message for multi-turn conversations */
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Supported image media types for vision */
export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

/** Image attachment for vision requests */
export interface LLMImage {
  data: string;              // base64-encoded image data
  mediaType: ImageMediaType;
}

/** What the caller passes */
export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;              // override provider default
  maxTokens?: number;          // default: 8192
  temperature?: number;        // default: provider decides
  thinking?: ThinkingConfig;
  effort?: EffortLevel;        // soft guidance on Claude Opus 4.5+/Sonnet 4.6+ thinking depth + token spend
  maxTurns?: number;           // for Agent SDK: number of tool-use turns (default: 1)
  messages?: LLMMessage[];     // multi-turn chat history (overrides prompt when provided)
  signal?: AbortSignal;        // cancel in-flight request
  reflectionLoops?: number;    // self-reflection iterations (engine handles internally)
  reflectionPrompt?: string;   // custom instruction for reflection passes
  images?: LLMImage[];         // images for vision (attached to current prompt only)
  agentTools?: string[];       // built-in Agent SDK tools to enable (e.g. 'WebFetch', 'WebSearch', 'Edit', 'Agent')
  allowedTools?: string[];     // auto-approve these tools without permission prompts
  sessionScope?: string;       // opt-in hot-session reuse key. Same value across calls that should share a session; omit or change to force a fresh session.
}

/** Per-turn timing info */
export interface LLMTurnTiming {
  turn: number;
  durationMs: number;
  hasThinking: boolean;
  thinkingChars?: number;
}

/** Per-model usage breakdown */
export interface LLMModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  costUsd?: number;
}

/** Full usage stats from a generation */
export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  costUsd?: number;
  numTurns?: number;
  durationApiMs?: number;
  turnTimings?: LLMTurnTiming[];
  modelUsage?: Record<string, LLMModelUsage>;
}

/** What the caller gets back */
export interface LLMResponse {
  text: string;
  thinking?: string;
  model: string;
  provider: ProviderId;
  usage?: LLMUsage;
  durationMs: number;
  debugLog?: string[];
}

/** For streaming responses */
export interface LLMStreamEvent {
  type: "text" | "thinking" | "done" | "error";
  text?: string;
  response?: LLMResponse; // only on "done"
  error?: string;         // only on "error"
}

/** Provider configuration stored in user settings */
export interface ProviderConfig {
  id: ProviderId;
  name: string;            // display name for UI
  type: "agent-sdk" | "anthropic-compat" | "openai-compat" | "gemini";
  authMode: AuthMode;      // "subscription" = use existing login, "api-key" = requires key
  apiKey?: string;         // required when authMode is "api-key"
  baseURL?: string;        // required for anthropic-compat type
  defaultModel: string;
  enabled: boolean;
}

/** The interface every provider must implement */
export interface LLMProvider {
  readonly id: ProviderId;
  generate(request: LLMRequest): Promise<LLMResponse>;
  streamGenerate?(request: LLMRequest): AsyncIterable<LLMStreamEvent>;
  resetSession?(): void;
}

/** Typed error thrown by providers with context for UI display */
export class LLMEngineError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderId,
    public readonly statusCode?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "LLMEngineError";
  }
}

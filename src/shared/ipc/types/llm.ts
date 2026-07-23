import type { AiFeatureSource } from '@shared/types/ai-usage';

// ─── LLM provider types ───
export interface LlmProviderPreset {
  id: string;
  name: string;
  type: 'agent-sdk' | 'anthropic-compat' | 'openai-compat' | 'gemini' | 'local';
  authMode: 'subscription' | 'api-key';
  baseURL?: string;
  defaultModel: string;
}

export interface LlmProviderConfig {
  id: string;
  name: string;
  type: 'agent-sdk' | 'anthropic-compat' | 'openai-compat' | 'gemini' | 'local';
  authMode: 'subscription' | 'api-key';
  apiKey?: string;
  baseURL?: string;
  defaultModel: string;
  enabled: boolean;
}

export interface LlmProvidersGetResponse {
  providers: LlmProviderConfig[];
  activeProvider: string | null;
  presets: LlmProviderPreset[];
}

export interface LlmProvidersSaveRequest {
  providers: LlmProviderConfig[];
  activeProvider: string;
}

export interface LlmProvidersSaveResponse {
  success: boolean;
  error?: string;
}

export interface LlmProviderTestRequest {
  provider: LlmProviderConfig;
}

export interface LlmProviderTestResponse {
  success: boolean;
  responseText?: string;
  durationMs?: number;
  error?: string;
}

// ─── LLM usage stats (mirrors engine LLMUsage for IPC) ───
export interface LlmUsageIpc {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  costUsd?: number;
  numTurns?: number;
  durationApiMs?: number;
  turnTimings?: Array<{
    turn: number;
    durationMs: number;
    hasThinking: boolean;
    thinkingChars?: number;
  }>;
  modelUsage?: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens?: number;
    costUsd?: number;
  }>;
}

// ─── LLM image attachment ───
export interface LlmImageIpc {
  data: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

// ─── LLM generation ───
export interface LlmGenerateRequest {
  prompt: string;
  systemPrompt?: string;
  providerId?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  thinking?: {
    type: 'enabled' | 'adaptive' | 'disabled';
    budgetTokens?: number;
    display?: 'summarized' | 'omitted';
  };
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxTurns?: number;
  reflectionLoops?: number;        // self-reflection iterations (re-sends output for improvement)
  reflectionPrompt?: string;       // custom instruction for reflection (caller provides)
  images?: LlmImageIpc[];          // images for vision analysis
  agentTools?: string[];           // built-in Agent SDK tools to enable (e.g. 'WebFetch', 'WebSearch')
  allowedTools?: string[];         // auto-approve these tools without permission prompts
  skillIds?: string[];             // skill IDs from resources/skills/ to compose into systemPrompt
  sessionScope?: string;           // opt-in hot-session reuse key; omit or change to force a fresh session
  featureSource?: AiFeatureSource;
  messages?: ChatMessage[];        // multi-turn history; when set, providers use it instead of prompt (last entry should be the current user turn)
}

export interface LlmGenerateResponse {
  success: boolean;
  text?: string;
  thinking?: string;
  model?: string;
  durationMs?: number;
  error?: string;
  debugLog?: string[];
  usage?: LlmUsageIpc;
}

// ─── LLM chat generation (multi-turn) ───
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmCancelResponse {
  success: boolean;
}

export interface LlmChatGenerateRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
  providerId?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  thinking?: {
    type: 'enabled' | 'adaptive' | 'disabled';
    budgetTokens?: number;
    display?: 'summarized' | 'omitted';
  };
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxTurns?: number;
  sessionScope?: string;           // opt-in hot-session reuse key; omit or change to force a fresh session
  featureSource?: AiFeatureSource;
}

export interface LlmChatGenerateResponse {
  success: boolean;
  text?: string;
  thinking?: string;
  htmlCode?: string;
  model?: string;
  durationMs?: number;
  error?: string;
  debugLog?: string[];
  usage?: LlmUsageIpc;
}

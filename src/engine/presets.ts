import type { ProviderConfig } from "./types";

export const PROVIDER_PRESETS: Omit<ProviderConfig, "apiKey" | "enabled">[] = [
  {
    id: "claude-subscription",
    name: "Claude (My Subscription)",
    type: "agent-sdk",
    authMode: "subscription",
    defaultModel: "claude-sonnet-4-6",
  },
  {
    id: "claude-api",
    name: "Claude (API Key)",
    type: "agent-sdk",
    authMode: "api-key",
    defaultModel: "claude-sonnet-4-6",
  },
  {
    id: "minimax",
    name: "MiniMax M2.7",
    type: "agent-sdk",
    authMode: "api-key",
    baseURL: "https://api.minimax.io/anthropic",
    defaultModel: "MiniMax-M2.7",
  },
  {
    id: "openrouter",
    name: "OpenRouter (300+ models)",
    type: "agent-sdk",
    authMode: "api-key",
    baseURL: "https://openrouter.ai/api",
    defaultModel: "anthropic/claude-sonnet-4-6",
  },
  {
    id: "openai",
    name: "OpenAI",
    type: "openai-compat",
    authMode: "api-key",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    type: "gemini",
    authMode: "api-key",
    defaultModel: "gemini-2.5-flash",
  },
];

import type { LlmProviderPreset } from "./types";

export const PROVIDER_PRESETS: LlmProviderPreset[] = [
  {
    id: "claude-subscription",
    name: "Claude (Subscription)",
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
    credentialId: "openrouter",
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
  {
    id: "zai",
    name: "Z.AI (GLM)",
    type: "agent-sdk",
    authMode: "api-key",
    baseURL: "https://api.z.ai/api/anthropic",
    defaultModel: "glm-5.2",
    credentialId: "zai",
  },
  {
    // Moonshot ships an Anthropic-compatible endpoint specifically so Claude
    // Code works against it unmodified — buildEnv() already does the required
    // ANTHROPIC_AUTH_TOKEN + empty ANTHROPIC_API_KEY dance for any preset
    // with a baseURL (claude-provider.ts:71-89). V1_RELEASE_PLAN H1a.
    id: "kimi",
    name: "Kimi (Moonshot)",
    type: "agent-sdk",
    authMode: "api-key",
    baseURL: "https://api.moonshot.ai/anthropic",
    defaultModel: "kimi-k3",
  },
  {
    // No key required — runs GGUF models loaded in AI Models → Text via
    // node-llama-cpp. Single llama context, so requests serialize.
    id: "local",
    name: "Local Models (no API key)",
    type: "local",
    authMode: "subscription",
    defaultModel: "local",
  },
];

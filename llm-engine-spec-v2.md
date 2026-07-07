# LLM Engine — Universal Provider Abstraction Layer

## Overview

A TypeScript engine that provides a **single interface** for calling different LLM providers from anywhere in an Electron desktop app (VidTSX Studio). The engine is provider-agnostic — callers pass a prompt and config, get text back. No provider-specific code leaks outside the engine.

**This is a local desktop app** — each user runs it on their own machine with their own accounts and API keys. There is no shared backend or SaaS proxy.

## Architecture

```
┌─────────────────────────────────────┐
│           Your App (UI)             │
│  TSX Generator / Chat / Any Feature │
└──────────────┬──────────────────────┘
               │ llmEngine.generate({ prompt, config })
               ▼
┌─────────────────────────────────────┐
│          LLMEngine (singleton)      │
│  - registerProvider()               │
│  - generate()                       │
│  - streamGenerate()                 │
└──────┬──────────────┬───────────────┘
       │              │
       ▼              ▼
┌─────────────┐ ┌──────────────────┐
│ AgentSDK    │ │ AnthropicCompat  │
│ Provider    │ │ Provider         │
│ (Claude via │ │ (MiniMax, etc.   │
│ subscription│ │  via API key)    │
│ or API key) │ │                  │
└─────────────┘ └──────────────────┘
```

## Dependencies

```bash
npm install @anthropic-ai/claude-agent-sdk @anthropic-ai/sdk
```

- `@anthropic-ai/claude-agent-sdk` (v0.2.81) — wraps Claude Code CLI subprocess. Supports subscription auth (picks up user's existing Claude Code login) OR API key auth.
- `@anthropic-ai/sdk` (v0.80.0) — standard HTTP client. API key only. Works with any Anthropic-compatible endpoint (MiniMax, OpenRouter, etc.).

## Auth Modes

| Provider | Auth Method | How it works |
|----------|-------------|--------------|
| Claude (subscription) | User's existing Claude Code login | Agent SDK auto-detects. No API key needed. User must have Claude Code installed and logged in (`claude login`). |
| Claude (API key) | `ANTHROPIC_API_KEY` env var | Passed via Agent SDK `env` option or via `@anthropic-ai/sdk` directly. |
| MiniMax | API key + custom base URL | Uses `@anthropic-ai/sdk` with `baseURL: "https://api.minimax.io/anthropic"` |
| OpenRouter | API key + custom base URL | Uses `@anthropic-ai/sdk` with `baseURL: "https://openrouter.ai/api/v1"` |

---

## Types — `src/engine/types.ts`

```typescript
/** Provider identifier */
export type ProviderId = string; // e.g. "claude", "minimax", "deepseek"

/** Authentication mode */
export type AuthMode = "subscription" | "api-key";

/** What the caller passes */
export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;          // override provider default
  maxTokens?: number;      // default: 8192
  temperature?: number;    // default: provider decides
}

/** What the caller gets back */
export interface LLMResponse {
  text: string;
  model: string;
  provider: ProviderId;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  durationMs: number;
}

/** For streaming responses */
export interface LLMStreamEvent {
  type: "text" | "done" | "error";
  text?: string;
  response?: LLMResponse; // only on "done"
  error?: string;         // only on "error"
}

/** Provider configuration stored in user settings */
export interface ProviderConfig {
  id: ProviderId;
  name: string;            // display name for UI
  type: "agent-sdk" | "anthropic-compat";
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
}
```

---

## Claude Provider (Agent SDK) — `src/engine/providers/claude-provider.ts`

Uses `@anthropic-ai/claude-agent-sdk`. Supports two auth modes:

1. **Subscription** — no API key needed. The SDK auto-detects the user's existing Claude Code login on their machine. User must have run `claude login` previously.
2. **API key** — passed via the `env` option. Overrides any existing login.

For pure text generation, set `tools: []`.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent, AuthMode,
} from "../types";

export class ClaudeProvider implements LLMProvider {
  readonly id: string;

  constructor(
    id: string,
    private authMode: AuthMode,
    private defaultModel: string = "claude-sonnet-4-6",
    private apiKey?: string
  ) {
    this.id = id;
    if (authMode === "api-key" && !apiKey) {
      throw new Error("API key required when authMode is 'api-key'");
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    let text = "";

    // Only set env when using API key auth
    // When subscription: empty env — SDK uses existing login
    const env: Record<string, string> = {};
    if (this.authMode === "api-key" && this.apiKey) {
      env.ANTHROPIC_API_KEY = this.apiKey;
    }

    for await (const message of query({
      prompt: request.prompt,
      options: {
        model: request.model || this.defaultModel,
        systemPrompt: request.systemPrompt || undefined,
        maxTurns: 10,
        tools: [],
        ...(Object.keys(env).length > 0 ? { env } : {}),
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") text += block.text;
        }
      }
    }

    return {
      text,
      model: request.model || this.defaultModel,
      provider: this.id,
      durationMs: Date.now() - start,
    };
  }

  async *streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamEvent> {
    const start = Date.now();
    let fullText = "";

    const env: Record<string, string> = {};
    if (this.authMode === "api-key" && this.apiKey) {
      env.ANTHROPIC_API_KEY = this.apiKey;
    }

    for await (const message of query({
      prompt: request.prompt,
      options: {
        model: request.model || this.defaultModel,
        systemPrompt: request.systemPrompt || undefined,
        maxTurns: 10,
        tools: [],
        ...(Object.keys(env).length > 0 ? { env } : {}),
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") {
            fullText += block.text;
            yield { type: "text", text: block.text };
          }
        }
      }
    }

    yield {
      type: "done",
      response: {
        text: fullText,
        model: request.model || this.defaultModel,
        provider: this.id,
        durationMs: Date.now() - start,
      },
    };
  }
}
```

---

## Anthropic-Compatible Provider — `src/engine/providers/anthropic-compat-provider.ts`

Uses `@anthropic-ai/sdk` with custom `baseURL`. Works with any Anthropic-compatible API: MiniMax, OpenRouter, DeepSeek, Qwen, GLM, etc. Also works for Claude directly (without Agent SDK overhead) when using API key.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent } from "../types";

export class AnthropicCompatProvider implements LLMProvider {
  private client: Anthropic;

  constructor(
    readonly id: string,
    private apiKey: string,
    private baseURL: string,
    private defaultModel: string
  ) {
    this.client = new Anthropic({ apiKey, baseURL });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    const model = request.model || this.defaultModel;

    const response = await this.client.messages.create({
      model,
      max_tokens: request.maxTokens || 8192,
      ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      messages: [{ role: "user", content: request.prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      model: response.model,
      provider: this.id,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      durationMs: Date.now() - start,
    };
  }

  async *streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamEvent> {
    const start = Date.now();
    const model = request.model || this.defaultModel;
    let fullText = "";

    const stream = this.client.messages.stream({
      model,
      max_tokens: request.maxTokens || 8192,
      ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      messages: [{ role: "user", content: request.prompt }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullText += event.delta.text;
        yield { type: "text", text: event.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();

    yield {
      type: "done",
      response: {
        text: fullText,
        model: finalMessage.model,
        provider: this.id,
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        },
        durationMs: Date.now() - start,
      },
    };
  }
}
```

---

## Engine — `src/engine/llm-engine.ts`

```typescript
import type {
  ProviderId, ProviderConfig, LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent,
} from "./types";
import { ClaudeProvider } from "./providers/claude-provider";
import { AnthropicCompatProvider } from "./providers/anthropic-compat-provider";

class LLMEngine {
  private providers = new Map<ProviderId, LLMProvider>();
  private activeId: ProviderId | null = null;

  register(config: ProviderConfig): void {
    if (!config.enabled) return;

    let provider: LLMProvider;

    if (config.type === "agent-sdk") {
      provider = new ClaudeProvider(config.id, config.authMode, config.defaultModel, config.apiKey);
    } else {
      if (!config.apiKey) throw new Error(`API key required for provider "${config.id}"`);
      provider = new AnthropicCompatProvider(config.id, config.apiKey, config.baseURL!, config.defaultModel);
    }

    this.providers.set(config.id, provider);
    if (!this.activeId) this.activeId = config.id;
  }

  switchProvider(id: ProviderId): void {
    if (!this.providers.has(id)) throw new Error(`Provider "${id}" not registered`);
    this.activeId = id;
  }

  getProviders(): ProviderId[] {
    return Array.from(this.providers.keys());
  }

  getActiveProvider(): ProviderId | null {
    return this.activeId;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    return this.getActive().generate(request);
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
    return provider.generate(request);
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
}

export const llmEngine = new LLMEngine();
```

---

## Presets — `src/engine/presets.ts`

```typescript
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
    type: "anthropic-compat",
    authMode: "api-key",
    baseURL: "https://api.minimax.io/anthropic",
    defaultModel: "MiniMax-M2.7",
  },
  {
    id: "openrouter",
    name: "OpenRouter (300+ models)",
    type: "anthropic-compat",
    authMode: "api-key",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-sonnet-4-6",
  },
];
```

---

## Usage Examples

### Basic — switch from UI

```typescript
import { llmEngine } from "./engine/llm-engine";

// On app startup — register from user settings
llmEngine.register({
  id: "claude",
  name: "Claude (My Subscription)",
  type: "agent-sdk",
  authMode: "subscription",  // uses existing `claude login`
  defaultModel: "claude-sonnet-4-6",
  enabled: true,
});

llmEngine.register({
  id: "minimax",
  name: "MiniMax",
  type: "anthropic-compat",
  authMode: "api-key",
  apiKey: userSettings.minimaxApiKey,
  baseURL: "https://api.minimax.io/anthropic",
  defaultModel: "MiniMax-M2.7",
  enabled: true,
});

// User picks from dropdown — instant switch
llmEngine.switchProvider("minimax");

// Generate from anywhere — same call regardless of provider
const result = await llmEngine.generate({
  prompt: "Create a Remotion TSX component with a 3D rotating globe",
  systemPrompt: "You are a Remotion + Three.js expert. Output only valid TSX.",
  maxTokens: 16000,
});
```

### Multi-provider — Opus reviewer + MiniMax worker

```typescript
const code = await llmEngine.generateWith("minimax", {
  prompt: "Build a ThreeJS voxel Eiffel Tower with lighting modes",
  maxTokens: 16000,
});

const review = await llmEngine.generateWith("claude", {
  prompt: `Review this code and suggest improvements:\n${code.text}`,
  model: "claude-opus-4-6",
});
```

---

## File Structure

```
src/engine/
├── types.ts                          # All type definitions
├── llm-engine.ts                     # Singleton engine class
├── presets.ts                        # Built-in provider configs
└── providers/
    ├── claude-provider.ts            # Agent SDK (subscription + API key)
    └── anthropic-compat-provider.ts  # @anthropic-ai/sdk (API key + custom baseURL)
```

---

## Implementation Notes

1. **Subscription auth** — Agent SDK auto-detects user's Claude Code login. When `authMode: "subscription"`, don't pass `env` to `query()`. User must have run `claude login`.

2. **Detecting subscription availability** — check if Claude Code CLI exists and is authenticated before showing "My Subscription" in UI. Run `claude --version` and `claude /status` via child_process.

3. **Agent SDK spawns a subprocess** — requires Claude Code CLI installed. For users without it, show only the `anthropic-compat` providers.

4. **Streaming** — `@anthropic-ai/sdk` supports `.messages.stream()`. Agent SDK streams via async iteration of `query()`.

5. **Error handling** — wrap all provider calls in try/catch. Surface human-readable messages for: invalid API key (401), rate limit (429), model not found (404), CLI not installed.

6. **`generateWith()`** — call any registered provider without switching UI. Enables the Opus-reviewer + MiniMax-worker pattern.

7. **Adding new providers** — just add a new `ProviderConfig` with the right `baseURL`. No new code needed.

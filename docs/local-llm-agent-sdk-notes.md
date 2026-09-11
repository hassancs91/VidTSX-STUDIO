# Local LLMs behind the Agent SDK — discussion notes

> Date: 2026-09-09 (written up 2026-09-11). Discussion only — nothing was
> implemented. This records what was asked, what was verified against the
> official docs, and how it maps onto the code as it stands today.

## Questions asked

1. Can a local LLM (Ollama, LM Studio, llama.cpp server, vLLM) be plugged
   into the Claude Agent SDK, and does it actually work?
2. Is Ollama integrated in the app today?

## 1. Does the Agent SDK work with a local model?

**Yes.** `@anthropic-ai/claude-agent-sdk` spawns the bundled Claude Code CLI,
and that CLI honours the same endpoint-override environment variables Claude
Code uses for LLM gateways. Anything that speaks the Anthropic Messages API
can sit behind it, including a server on localhost.

### Environment variables the SDK honours

| Variable | Purpose |
|---|---|
| `ANTHROPIC_BASE_URL` | Redirects every API call to a custom endpoint |
| `ANTHROPIC_AUTH_TOKEN` | Bearer token for the custom endpoint (`ANTHROPIC_API_KEY` must be empty) |
| `ANTHROPIC_MODEL` | Default model name the CLI requests |
| `ANTHROPIC_SMALL_FAST_MODEL` | Model for the harness's side calls (title, summaries) |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` / `_OPUS_MODEL` / `_HAIKU_MODEL` | Per-tier aliases; pin all of them to the local model or the harness will request a Claude name the server does not have |

They are passed through the `env` option of `query()`.

### Official support boundary

Anthropic officially supports Bedrock, Vertex AI, and Microsoft Foundry as
alternative backends. Pointing the SDK at a non-Claude model is "as-is":
Anthropic does not test it and does not document it. Ollama, on the other
hand, documents it from their side.

### What exists on the local-server side

- **Ollama ≥ 0.14.0 (released 2026-01-16)** exposes a native
  Anthropic-compatible endpoint at `/v1/messages`. Supported: streaming,
  multi-turn, system prompts, tool calling, thinking blocks, base64 images.
  Not supported: prompt caching (`cache_control`), `tool_choice` forcing,
  token counting, URL images, batch API. Ollama's own docs show Claude Code
  running against it with

  ```
  ANTHROPIC_BASE_URL=http://localhost:11434
  ANTHROPIC_AUTH_TOKEN=ollama   # placeholder, validation skipped
  ```

- **LM Studio, llama.cpp server, vLLM** speak the OpenAI format. They need a
  translator in front of them (LiteLLM proxy is the usual one) to be reached
  through the Agent SDK. Through the app's existing *OpenAI-compatible*
  provider they work directly, but that path has no agent tools (see §2).

### Known limitations when running the Studio agent this way

- **No prompt caching.** The Claude Code harness prompt plus the ~30 Studio
  tool schemas plus the skills plus the memory block is a large system
  prompt, and a local model re-reads all of it every turn. Locally that
  costs time rather than money, but on consumer hardware it is the dominant
  cost per turn.
- **Context floor.** Ollama recommends at least 32K context for agentic
  Claude Code sessions, 64K to be comfortable. The Studio agent's
  end-to-end chains (transcribe → auto cut → b-roll → insert → captions →
  export) need the upper end.
- **Tool-calling quality is the real risk.** Small local models drop or
  malform tool calls in long chains. Qwen3-Coder class models are the
  recommended floor; Ollama's own suggestions are `qwen3-coder`,
  `glm-4.7:cloud`, `minimax-m2.1:cloud`.
- **Streaming stall on large tool arguments.** Ollama did not stream tool
  call arguments token by token, so a big `write`/`edit`-style call could
  hit the CLI's ~255 s idle timeout. Improved in Ollama 0.14.3+
  (ollama/ollama#14858).
- No `tool_choice` forcing, no token counting, no `count_tokens`.

### Sources checked

- https://docs.ollama.com/api/anthropic-compatibility
- https://ollama.com/blog/claude
- https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript
- https://github.com/ollama/ollama/issues/14858

## 2. Is Ollama integrated in the app today?

**Not as a first-class integration.** There is no Ollama code anywhere in
`src/`: no preset, no port 11434, no detection. Three adjacent things exist.

### 2a. The built-in local engine is not Ollama

The **Local Models (no API key)** preset (`id: "local"`, `type: "local"` in
`src/engine/presets.ts`) runs GGUF files in-process through
`node-llama-cpp`, downloaded from AI Models → Text. It is a plain text
provider with no tool calling, so the Studio agent runs *without tools* on
it.

### 2b. The custom provider form already reaches Ollama — text only

AI → Providers → **+ Add custom provider** offers two protocols
(`src/features/ai-models/components/providers/CustomProviderForm.tsx`):

- **OpenAI-compatible** → `OpenAICompatProvider`
- **Anthropic-compatible** → `AnthropicCompatProvider` (a raw
  `@anthropic-ai/sdk` client, *not* the Agent SDK)

The API key is optional. `docs/tsx-generator-manual-test-plan.md` §2 already
lists "a local ollama/vLLM server with protocol OpenAI-compatible and no
key" as a test case. So Ollama works today for the Creator's text
generation through this door. It does **not** give the Studio agent its
tools, because neither compat type is `agent-sdk`.

### 2c. The Agent SDK custom-base-URL path exists and is proven

`src/engine/providers/claude-provider.ts` (`buildEnv`, lines 68–89) builds
exactly the env block a local server needs: `ANTHROPIC_BASE_URL`, empty
`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, and all five model-tier
variables pinned to one model. The **MiniMax, OpenRouter, Z.AI, and Kimi**
presets are all "agent-sdk with a baseURL" and ship on this path.

The Studio agent's tool gate (`resolveToolSupport` in
`src/main/services/studio/studio-agent.ts`, line ~170) enables the MCP tool
server, skills, memory, and `allowedTools` when the provider's
`type === 'agent-sdk'`. An Ollama entry of that type would light all of it
up with no other change.

## Conclusion

The integration is a **config-level change, not an architecture change**.
Two ways to do it when the time comes:

1. Add a hard-coded preset in `src/engine/presets.ts`:
   `type: "agent-sdk"`, `baseURL: "http://localhost:11434"`, placeholder
   token, `defaultModel` set to an installed tag (e.g. `qwen3-coder`).
2. Or let the custom provider form create `agent-sdk` entries (a third
   protocol option, "Anthropic-compatible via Agent SDK"), which also covers
   LiteLLM-fronted LM Studio / vLLM.

Either way the open question is **model quality**, not plumbing. The
cheapest test is adding the preset and running the W3 CDP end-to-end script
against it on the second dev instance (port 9223).

Nothing from this discussion has been implemented.

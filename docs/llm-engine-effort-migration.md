# LLM engine migration: adaptive thinking + `effort`

**Status:** active (as of April 2026)
**Scope:** Claude Agent SDK path only. OpenAI / Gemini providers are TBD.

## Why this changed

Claude Opus 4.7 (April 2026) dropped support for manual `thinking: { type: "enabled", budget_tokens: N }` — it returns **HTTP 400**. Adaptive thinking is now the only thinking mode on Opus 4.7. Anthropic also introduced a new `effort` parameter (`low | medium | high | xhigh | max`) that replaces `budget_tokens` as the recommended way to control thinking depth on Opus 4.7, Opus 4.6, and Sonnet 4.6. `xhigh` is Opus 4.7-only and is the recommended default for coding / agentic work — it matches what Claude Code ships with and what claude.ai uses.

Our old `THINKING_CONFIGS` in [src/shared/tsx-engine/thinking-config.ts](../src/shared/tsx-engine/thinking-config.ts) emitted `{ type: "enabled", budgetTokens: N }`, so picking Opus 4.7 would have 400'd every request.

## What changed in this repo

| Change | File |
|---|---|
| SDK pinned to `0.2.119` (from `^0.2.81`). Opus 4.7 support requires ≥`0.2.111`. | `package.json` |
| `ThinkingConfig.display` field added (`"summarized"` \| `"omitted"`) | `src/engine/types.ts` |
| `EffortLevel` type + `effort?` on `LLMRequest` | `src/engine/types.ts` |
| Capability helper for Claude model IDs | `src/engine/providers/claude-capabilities.ts` (new) |
| `effort` + `display` passed to `query()`; capability gating per model | `src/engine/providers/claude-provider.ts` |
| `ThinkingLevel` extended to 6 values: `off / low / medium / high / xhigh / max` | `src/shared/tsx-engine/types.ts` |
| `THINKING_CONFIGS` rewritten — emits `thinking: adaptive` + `effort` instead of `enabled + budgetTokens` | `src/shared/tsx-engine/thinking-config.ts` |
| Duplicate `ThinkingLevel` removed (imports from `@shared/tsx-engine`) | `src/features/prototyper/hooks/usePrototyperChat.ts` |
| 6-button thinking row (X-High, Max added) | `MotionInputPanel.tsx`, `AIChatScreen.tsx`, `ChatPanel.tsx` |
| `effort` + `display` threaded through IPC | `src/shared/ipc/types.ts`, `src/main/ipc/llm-handlers.ts` |

## Capability matrix

| Capability | Opus 4.7 | Opus 4.6 / Sonnet 4.6 | Opus 4.5 | Haiku 4.5 | Older (3.7 / 3.5) |
|---|---|---|---|---|---|
| `thinking.type: "adaptive"` | **only** supported mode | Supported (recommended) | No | No | No |
| `thinking.type: "enabled"` + `budget_tokens` | **400 error** | Deprecated, still works | Yes | Yes | Yes |
| `effort: low/medium/high/max` | Yes | Yes | Yes | No | No |
| `effort: xhigh` | **Yes** | No | No | No | No |
| `thinking.display` default | `"omitted"` | `"summarized"` | n/a | n/a | n/a |

Notes:
- On Opus 4.7, `display` silently defaults to `"omitted"` — the model still thinks, but the `thinking` field arrives empty. We pass `display: "summarized"` explicitly on Opus 4.7 so our UI can show thinking text. Billing is identical either way.
- `effort` defaults to `"high"` API-side when unset. For coding/agentic workloads Anthropic recommends `"xhigh"` on Opus 4.7.

## Provider path map

| Preset | Provider class | Path |
|---|---|---|
| `claude-subscription`, `claude-api` | `ClaudeProvider` | Native Agent SDK — full effort/adaptive support |
| `minimax` (MiniMax-M2.7) | `ClaudeProvider` | Agent SDK with `baseURL=api.minimax.io/anthropic`. MiniMax-M2.7 is not a Claude model. **Gated** — `effort` and `thinking` are skipped. |
| `openrouter` | `ClaudeProvider` | Agent SDK with `baseURL=openrouter.ai/api`. Claude models via OpenRouter accept effort; non-Claude models are skipped via gating. |
| `openai` | `OpenAICompatProvider` | Ignores `effort` + `thinking` today. Translation TBD. |
| `gemini` | `GeminiProvider` | Ignores `effort` + `thinking` today. Translation TBD. |

## Capability gating (how `ClaudeProvider` handles non-Claude models)

`src/engine/providers/claude-capabilities.ts` exposes:

```ts
supportsEffort(model: string): boolean
supportsAdaptiveThinking(model: string): boolean
supportsXhigh(model: string): boolean
requiresExplicitThinkingDisplay(model: string): boolean
```

`ClaudeProvider.buildEffort` and `buildThinkingConfig` call these before writing `effort` / `thinking` into the `query()` options. If the active model is `MiniMax-M2.7`, a DeepSeek ID via OpenRouter, or anything else that isn't a recognized Claude model, both fields are omitted — the request goes out without thinking/effort params, which is how those models have always been called.

`supportsXhigh` returns `true` only for Opus 4.7. On Opus 4.6 / Sonnet 4.6, a user-selected `xhigh` silently downgrades to `high` at the provider boundary, which matches Claude Code's own fallback behavior.

## UI: current state and future plan

Today the thinking dial is **universal** — all four surfaces (motion input, AI chat, prototyper, render settings) show the same 6-button row `Off / Low / Med / High / X-High / Max` regardless of active provider. If the user picks MiniMax + High, the button lights up but the provider drops the thinking config — no error, just no thinking.

The tradeoff is UI simplicity vs. accuracy. Acceptable for now because 4 of 6 presets route through `ClaudeProvider` and benefit from the dial.

**Future direction:** when OpenAI / Gemini translation lands (see below), make the dial **dynamic** — the active provider exposes a `capabilities` object and the UI greys out / hides buttons the provider can't use. We'll add something like `LLMProvider.getCapabilities(model)` and thread it through the screens that render the dial.

## Adding a provider later (OpenAI, Gemini, etc.)

1. In the provider class's `generate` / `streamGenerate`, read `request.effort` and `request.thinking`.
2. Translate to the provider's native shape:
   - **OpenAI (GPT-5 / o-series)**: `effort` → `reasoning_effort: "low" | "medium" | "high"`. `xhigh` and `max` collapse to `"high"`. `thinking: adaptive` implies `reasoning_effort: "high"` if not otherwise set.
   - **Gemini 2.5**: `thinking: adaptive` → `thinkingConfig: { thinkingBudget: -1 }` (dynamic). `effort` tiers map to fixed budgets: `low=1024`, `medium=8192`, `high=24576`, `xhigh/max=-1`.
3. Add a capability helper analogous to `claude-capabilities.ts` so requests for non-supporting models (e.g. `gpt-4o`, `gemini-2.5-flash-lite`) short-circuit.
4. Flip the UI to dynamic gating (see "Future direction" above).

## Rollback plan

If something regresses catastrophically:

1. Revert `THINKING_CONFIGS` in `src/shared/tsx-engine/thinking-config.ts` to the old `{ type: "enabled", budgetTokens: N }` shape. This works on Sonnet 4.6 (deprecated but accepted) and all older models, but will 400 on Opus 4.7.
2. Revert the SDK pin in `package.json` (but note: SDKs < 0.2.111 cannot use `claude-opus-4-7` at all).
3. Leave `src/engine/types.ts`, `claude-capabilities.ts`, and the IPC additions in place — they're additive and don't change behavior unless consumers set the new fields.

## Verification checklist

Run in `npm run dev`:

- [ ] **Opus 4.7 + High** — TSX generation succeeds; debug log shows non-empty thinking text (validates `display: "summarized"`).
- [ ] **Opus 4.7 + X-High** — debug log shows `effort: xhigh`; generation succeeds.
- [ ] **Opus 4.7 + Off** — no 400; runs without thinking.
- [ ] **Opus 4.6 + X-High** — silently downgrades to `high`; debug log mentions the downgrade.
- [ ] **Sonnet 4.6 + Medium** — adaptive + effort=medium; succeeds.
- [ ] **MiniMax-M2.7 + High** — `ClaudeProvider` drops thinking/effort; request succeeds.
- [ ] **OpenRouter + claude-opus-4-7 + X-High** — full pass-through works. If OpenRouter rejects `effort`, add it to the gate blocklist in `claude-capabilities.ts`.
- [ ] **OpenAI gpt-4o** — unchanged; no reasoning params sent.
- [ ] **Gemini** — unchanged; no `thinkingConfig` sent.

Hot-session reuse: two back-to-back calls with the same model but different effort levels should spawn a new session the second time (debug log: `closing session: thinking/model changed`).

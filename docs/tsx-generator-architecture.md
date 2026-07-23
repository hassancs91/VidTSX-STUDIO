# TSX Generator (Creator) — Architecture

> Contributor guide to the AI TSX generation feature. Updated 2026-07-23 after
> the stabilization + parallel-jobs work (see `tsx-generator-stability-plan.md`).

## Overview

The Creator screen generates animated Remotion TSX compositions from a prompt,
previews them in an isolated player, and refines them through AI edit/fix jobs.
Up to **4 generations run concurrently**, each with an isolated LLM session.

```
Renderer (src/features/motion)                 Main process
┌─────────────────────────────┐   tsxjob:*    ┌──────────────────────────────┐
│ MotionScreen                │──────────────▶│ TsxJobEngine                 │
│  ├ MotionInputPanel         │   IPC         │  (services/tsx-jobs/)        │
│  ├ MotionJobsStrip          │◀──────────────│  ├ shared tsx-engine pipeline│
│  ├ MotionPreviewPanel       │  tsxjob:event │  ├ project-store (atomic fs) │
│  │   └ JobStreamView        │  tsxjob:stream│  └ chat-store (chat.json)    │
│  └ MotionLibraryPanel       │               │        │                     │
│ TsxJobsContext (state)      │               │        ▼                     │
└─────────────────────────────┘               │ LLMEngine (src/engine)       │
                                              │  └ providers + session pool  │
                                              └──────────────────────────────┘
```

## The generation pipeline (`src/shared/tsx-engine/`)

`tsx-generation-service.ts` is **process-agnostic**: every external capability
is injected via `TsxEngineDeps` (`llmGenerate` + `tsxValidate`).

- Renderer callers use the default deps (IPC round-trips).
- The job engine injects main-process deps: direct `llmEngine` calls (with a
  per-job `AbortSignal` + streaming callback) and a direct transpile check.

Pipeline steps: **Plan** (optimize on) or **Classify** (2d/3d) → **Generate**
→ **Verify** (mode-specific checklist) → **Transpile check + AI fix loop**
(esbuild syntax check, up to `maxFixRetries` LLM fix rounds). The Generate/Edit
steps retry transient failures (rate limit, network) with backoff. All steps in
one run share a `sessionScope` so the provider can keep one hot conversation.

Unit tests: `tsx-generation-service.test.ts` (fake deps, no network).

## The job engine (`src/main/services/tsx-jobs/`)

`TsxJobEngine` (modeled on the download manager):

- Job kinds `generate | edit | fix`; statuses
  `queued → planning/generating/verifying/fixing → naming → saving → done`
  (or `error`/`cancelled`).
- `maxConcurrent` (default 4) with overflow queueing; `configure()` to change.
- Per-job `AbortController` — cancel propagates into the in-flight LLM call and
  tears down only that job's session.
- Writes results itself: atomic project-folder reservation
  (`project-store.ts` — non-recursive mkdir + EEXIST suffix bump), `wx`-flag
  version writes, `.debug.json` sidecar, and `chat.json` refinement history.
- Queued jobs persist to `<userData>/tsx-jobs.json` and restore on launch;
  `will-quit` aborts running jobs so no `claude.exe` children are orphaned.
- Events: `tsxjob:event` (job snapshots) and `tsxjob:stream` (throttled LLM
  text deltas during the generating step), broadcast to all windows.

Tests: `tsx-job-engine.test.ts` (mocked LLM/validator, real temp-dir fs).

## LLM providers (`src/engine/`)

`LLMEngine` registers providers from `presets.ts` + saved settings:

| Type | Providers | Notes |
|---|---|---|
| `agent-sdk` | Claude (subscription/API), MiniMax, OpenRouter, Z.AI | Spawns `claude.exe` per session via the Claude Agent SDK; custom `baseURL` routes to compatible vendors |
| `openai-compat` / `anthropic-compat` / `gemini` | OpenAI, Gemini, any compatible endpoint | Stateless SDK clients with per-request abort |
| `local` | node-llama-cpp GGUF models | **No API key** — bridges `src/llm-engine` (load a model in AI Models → Text). Single llama context, so requests serialize |

**Session pool:** `ClaudeProvider` holds a `Map<sessionScope, ClaudeSession>`
(cap 8, LRU-evicted). Each `ClaudeSession` owns one CLI subprocess, its input
stream, and one in-flight request — this is what makes parallel jobs safe.
Scope-less requests get ephemeral one-shot sessions. `resetSession(scope)` is
scope-aware so reflection passes never kill other jobs' sessions.

Providers surface SDK **result-level errors** (`is_error`, `terminal_reason:
'blocking_limit'` = subscription usage limit) as real errors instead of empty
successes, and support `request.onTextDelta` for live streaming (agent-sdk via
`includePartialMessages`; compat providers via their native streams).

## On-disk project layout

```
<userData>/projects/<kebab-name>/
  v1.tsx, v2.tsx, ...      # versions (append-only; UI "Overwrite" rewrites current)
  v1.debug.json            # model, steps, plan, usage, verified/transpileValid
  chat.json                # refinement conversation (fed to edit jobs, capped at 20 turns)
```

## Preview

TSX is transpiled in main (`tsx-transpiler.ts`: esbuild transform + import
rewriting to virtual/vendored/CDN modules), served by a local module server,
and rendered by a Remotion Player inside an isolated `<webview>`. Caches are
content-addressed, so concurrent transpiles are safe.

## Development

- `npm test` — vitest (node env; anything importing `electron` must be mocked).
- `npm run check:types` — type-error **baseline gate** (ratchet-down ceiling;
  lower the numbers in `scripts/check-types.mjs` when your change reduces them).
- E2E: `npx electron-vite dev -- --remote-debugging-port=9222`, then drive the
  `localhost:5173` page target over CDP.

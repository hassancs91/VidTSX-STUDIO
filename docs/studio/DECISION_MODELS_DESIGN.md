# Decision models — one shared decision service (design note)

> **status: D2 — READY FOR HASAN'S REVIEW (orchestrator, 2026-10-31 08:20).** Written from D1's numbers (`docs/studio/decisions/D1-spike-report.md`;
> every number names its kit file under `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\reports\`). **The direction in §1 / §6 / §10 is the
> orchestrator's RECOMMENDATION from ruling D-r11 (ORCHESTRATOR.md), not yet Hasan's decision** — §16 lists what he chooses at the stop; the
> acceptance bar (§15) is fixed here before any verifier, as the brief asks. Branch `decision-models` (cut from `library-search` @ `efa5e0b`).
> No product code exists yet (D-h). Pattern mirrored: `docs/studio/LIBRARY_SEARCH_DESIGN.md`.

## 1. Why, and the decision

- **The gap.** Library search's S1 showed that no similarity floor separates "the library lacks it" from a real match (best Youden J 0.665, S1
  §8); "nothing fits" needed an LLM pick (S1 §10: R@1 80.7 %, wrong-confident 6.3 %, correct none 79.2 %). An LLM call costs 10–23 s per 20
  rows (D1 `c-baseline.md`) and gives no calibrated probability. A **decision model** answers TYPED questions about a state with a probability
  per allowed answer in one fast pass, no prose.
- **Hasan's decision (2026-10-30):** one shared decision service — typed questions about a state → typed answers WITH probabilities, behind
  one contract, with two hosted providers (D-a TypeSafe Jev; D-b the OpenAI Decisions API, else Microsoft-Decision-1 via OpenRouter) and one
  local model (D-c), usable anywhere.
- **What D1 found (§2) and what this note recommends (D-r11):** the hosted deciders are perfect on routing and verification (100 % / 100 %,
  Arabic included, 0.3–3 s per 40 questions, under $0.012 per 1,000 decisions) and their probabilities behave; on the library pick (T1) none
  beats the assistant's own pick or gives a better "nothing fits"; no local candidate comes near the bar. So:
  1. **The first users are the `decide` tool / flow node and verification gates in flows, then request routing** (§10) — **not** library
     search's "nothing fits", which keeps S1's design (the assistant picks over the top-20) unchanged.
  2. **The first slice is hosted-first:** `auto` = Jev → Microsoft-Decision-1 (OpenRouter) → [OpenAI when a key exists] → the LLM fallback
     (§6). The local rung is designed (§5.3) and empty until a candidate passes §15; Mapika decider-2b is the one lead (§16).
  3. The brief's original order (library search + the Assets box first) stays as the alternative in §10.4 — Hasan's call.
- **The E3 lesson, binding everywhere below:** a probability is NOT a fact. No caller shows a probability to the user or to the assistant as a
  claim. Callers consume a decision as an **order**, a **gate** (act above a threshold, escalate below) or a **route**. The number itself
  appears only in logs, a flow's run record and the developer tester.
- **"Calibrated" is earned, not claimed.** `calibrated: true` only for a (provider, model, task family) that passed §15.1's bar; the LLM
  fallback never; a provider on a task family it was not measured on never. Callers that gate refuse uncalibrated answers unless they opt in.

## 2. What D1 measured (the numbers this design rests on)

Task sets (`b-tasksets.md`): **T1** = library search's pick, S1's 240-row sample over the (c) top-20 + "none of these" (187 named / 53 ∅, 10
Arabic); **T2** = 40 Studio-assistant requests → tool family (cut / audio / shots / captions / export / none; 10 Arabic); **T3** = 40 yes / no
verification pairs from the app's own template / caption-style / library-clip descriptions (7 Arabic).

| candidate | T2 routing | T3 verify | T1 pick (choice): acc · R@1 · wrong-confident at τ 0.5 | latency (this desk) | cost / 1,000 | file |
|---|---|---|---|---|---|---|
| keyless LLM (`claude-subscription`, sonnet-5-5) | 100.0 % | 97.5 % | 88.8 % · 80.7 % · 7.1 % (S1: 80.7 / 6.3) | 10–23 s per 20-row call; no probability | subscription quota | `c-baseline.md` |
| **Jev** `jev-1.14.0` (System One, TypeSafe) | **100.0 %** (Brier 0.021) | **100.0 %** (0.003) | 85.0 % · 79.1 % · 9.6 % (0.9–1.0 bin 92.9 % right) | T2 499 ms, T3 342 ms per 40 q; T1 p50 404 / p95 743 ms per 14-row request | T2 $0.011, T3 $0.006, T1 $0.081 | `c-hosted.md` |
| **Microsoft-Decision-1** via OpenRouter Decisions | **100.0 %** (0.014) | **100.0 %** (0.002) | 73.8 % · 66.8 % · 10.0 % (over-confident: 0.9–1.0 bin 84.5 %) | T2 2,983 ms (first call), T3 1,084; T1 p50 978 / p95 1,145 | T2 $0.009, T3 $0.006, T1 $0.071 | `c-hosted.md` |
| OpenAI Decisions (`gpt-6-luna`) | not run — no key | | | | $0.10 / M input (list) | `c-hosted-dryrun.md` |
| Qwen3.5-0.8B Q8 (option probabilities, node-llama-cpp, Vulkan) | 82.5 % | 85.0 % | 47.5 % · 48.7 % (noul) · 38.3 % | warm p95 353–483 ms per question | $0; 812 MB; ≤ 1,552 MB RSS | `c-llama.md` §8 |
| Qwen2.5-0.5B Q8 (same) | 75.0 % | 67.5 % | 27.1 % · 36.4 % (noul) · 71.7 % | 275–722 ms | $0; 676 MB | `c-llama.md` §5 |
| Laya multilingual (community ONNX = the official runtime, `c-laya.md` §9) | 55.0 % | 60.0 % | 50.4 % · 55.6 % · 39.2 % | p95 469–582 ms; RSS 2.3–3.1 GB | $0; 1.32 GB | `c-laya.md` §8 |
| Liquid d1-omni-600M | did not load in node-llama-cpp (`missing tensor blk.16.ffn_gate`); parked by Hasan | | | | LFM licence (revenue-capped) | `c-llama.md` §3 |

- **The rule** ("the smallest local candidate whose T1 + T2 accuracy is within 5 points of the best hosted one, Brier no worse than 0.05 above
  it, warm p95 ≤ 300 ms and ≤ 2 GB RAM"): every local candidate fails every evaluable term by a wide margin (`c-hosted.md` §4) → **no local
  default** (STOP 1). **No decision model beats the assistant's pick on T1** (STOP 2: Jev needs τ > 0.7 for wrong-confident < 6.3 %, where its
  R@1 is ≤ 67.9 %; its correct-none 71.7 % is below the assistant's 75.5–79.2 %). T1 as per-candidate noul (4,632 questions) is unmeasured on
  the hosted providers (held, D-r9).
- **Calibration that can be used:** Jev's top-bin accuracy (P ≥ 0.9): T2 100 % (33 / 33), T3 100 % (19 / 19), T1 92.9 % (127 rows); below 0.8
  it is under-confident (right more often than it says). MSD1 is over-confident on T1 (P ≥ 0.9 → 84.5 %) but perfect on T2 / T3. Jev rounds
  probabilities to hundredths (P24). Hasan's own 2026-10-05 experiment (`D:\repos\ai-video-lab\youtube-videos\01-jev-vs-clef`, 200 + 200 bank
  emails, 6 teams): Jev ≥ 0.95 → 96.5 % right, below → 33–62 %; "decide when ≥ 0.85 sure, else the LLM" held on fresh emails at ~1/6 of the LLM
  bill; Arabic 12 / 12; deciders slip on judgment that needs arithmetic or reference; Jev rejects images, Clef-flash reads them.
- **Contracts (primary docs, `a-sources.md`):** Jev and OpenRouter's Decisions API are System One (`state` + keyed `questions`; OpenRouter
  requires `criteria` {true, false} on `noul`); the OpenAI Decisions API is not (`input` + a `questions[]` array with `name`, `predicate` /
  `choice` / `score`, 1–400 per request); Jev 64k tokens per request / 32k per question; all three bill input only ($0.042 / $0.042 / $0.10 per
  M). node-llama-cpp's full-vocabulary probability map costs ~5/6 of a warm local question (P16) — any future GGUF rung reads option logits only.
- **Operational facts for the adapters:** a `llmGenerate` text can arrive truncated and marked `success` (P11) — JSON readers validate
  completeness; MSD1's first call on OpenRouter's alpha endpoint took 3 s, then ~1 s; Jev 0.3–0.7 s; a T1-style request carries the 20 option
  lines with every question (~2,000 tokens per question, P26) — a state-sharing framing is cheaper and is the product framing (§3).

## 3. The contract (System One-shaped)

`src/shared/types/decisions.ts` (shared by main, the engine and the renderer's status view; no Node types):

```ts
export type DecisionQuestion =
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }      // → P(true)
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }             // option id → description (2..255)
  | { type: 'score'; instructions: string; criteria: string[] };                           // ordered levels, 2–10

export interface DecisionRequest {
  state: string | Record<string, unknown> | unknown[];   // the evidence, sent ONCE per request (the option lists live in criteria)
  questions: Record<string, DecisionQuestion>;           // keyed by the caller's names (System One)
  provider?: DecisionProviderChoice;                     // 'auto' (default) | 'jev' | 'openrouter' | 'openai' | 'local' | 'llm'
  featureSource: AiFeatureSource;                        // who asks — the usage log's column (§9)
  allowUncalibrated?: boolean;                           // may 'auto' end at the LLM fallback (default false)
  timeoutMs?: number;                                    // the caller's budget (§9 defaults)
}

export type DecisionAnswer =
  | { type: 'noul'; p: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; probabilities: Record<string, number>; confidence: number }
  | { type: 'refused'; reason: string };

export interface DecisionResult {
  answers: Record<string, DecisionAnswer>;
  provider: DecisionProviderId;                          // 'jev' | 'openrouter' | 'openai' | 'local' | 'llm'
  model: string;                                         // as served (e.g. 'jev-1.14.0', 'microsoft/microsoft-decision-1-20261009')
  calibrated: boolean;                                   // §1: earned per (provider, model, task family) — §15.1
  usage: { inputTokens: number; costUsd: number };
  latencyMs: number;
  cached: boolean;
  skipped?: Array<{ provider: DecisionProviderId; why: string }>;   // the rungs 'auto' passed over, in plain words
}
```

- `confidence` = the top answer's probability (System One's meaning); `score` = the probability-weighted mean level index. Probabilities are
  renormalised to sum to 1 over the caller's options (Jev's hundredths may sum to 0.99–1.01 — P24); an answer naming an option the caller did
  not send is `invalid-answer`.
- **Typed errors** (`DecisionError.code`): `no-provider` (no rung configured / no key), `unsupported` (over every available adapter's limits —
  options, levels, context, questions per request), `timeout`, `provider-error` (HTTP / engine failure; the message is scrubbed of any key and
  of the state text), `invalid-answer` (unreadable or incomplete — P11), `cancelled`.

## 4. The service — module layout

Feature isolation holds: the service is main-process code; features reach it through the agent tool / flow node (main) and the IPC surface
(renderer). One primary export per file, ≤ ~300 lines, no `any`.

**`src/main/services/decisions/`** (business logic, pure where it can be):

| file | owns |
|---|---|
| `decide.ts` | `decide(request, deps)` — validates, resolves the provider (§6), checks the cache, calls the adapter with the caller's timeout, stamps `calibrated` (§15.1's table), logs usage, returns `DecisionResult`; `deps` injected in every test. |
| `ladder.ts` | the `auto` resolver: which rungs exist now (keys present; a local model on disk; the LLM fallback allowed) and which can answer THIS request (each adapter's `limits`). Pure. |
| `validate.ts` | request shape + per-type rules (choice 2..255 options, score 2–10 levels, non-empty instructions, state size). Pure. |
| `calibration-table.ts` | the shipped table of (provider, model, task family) → `calibrated`, from §15.1's benchmark; pure. |
| `cache.ts` | in-memory LRU keyed by sha256 of the canonical JSON of {provider, model, state, questions}; in-flight sharing. |
| `usage.ts` | one `aiUsageService.appendEntry` row per adapter HTTP call (§9). |
| `adapters/system-one.ts` | Jev and OpenRouter Decisions (§5.1) — one adapter, two configurations. |
| `adapters/openai-decisions.ts` | the OpenAI Decisions API (§5.2). |
| `adapters/local.ts` | the bridge to the engine process (§5.3) — returns `no-provider` while no runtime ships. |
| `adapters/llm-fallback.ts` | the app's text provider answering JSON (§5.4), `calibrated: false` always. |
| `decision-settings.ts` | settings in the KV store (the `search-settings.ts` pattern, §8). |
| `decision-app.ts` | the one instance: keys from `settings.ts`, `fetch`, `llmEngine`, `aiUsageService` (by dynamic import, the `search-app.ts` pattern). |

**`src/decision-engine/`** (the local model's process, mirroring `src/library-search-engine/`): `engine-host.ts` (lazy spawn, request ids,
cold / warm timeouts, death → reject pending + respawn, idle unload, no electron import) and `types.ts` are built in the first slice as the
contract; `worker.ts` and the electron-vite entry `decision-worker` come with the first local runtime that passes §15 (not in this slice).

## 5. The adapters

Every adapter implements `DecisionAdapter { id; model(); limits(): DecisionLimits; available(): Promise<boolean>; answer(request, signal) }`,
where `limits` = max options per choice, max levels, max state tokens, max questions per request.

### 5.1 System One over HTTPS — Jev and OpenRouter Decisions (measured)

- **Jev:** `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer`, model **`jev-1.14.0` pinned** (never `jev-latest`: §15.1's
  table is per model); `state` + keyed `questions` as the contract is. Limits: 255 options, 10 levels, 32k tokens per question / 64k per
  request (no long-context header in this slice); questions per request: pack ≤ 400 (the dry-run's packing) — a bigger request is split, one
  usage row each. Images: not in this slice (Jev returns 400 for them).
- **OpenRouter Decisions:** `POST https://openrouter.ai/api/alpha/decisions`, model `microsoft/microsoft-decision-1` (a setting; any OpenRouter
  decision model id — `typesafe/jev-1.14` is served there too). Quirk table: `criteria` {true, false} is REQUIRED on `noul` (the adapter fills
  `{ true: 'yes', false: 'no' }` when the caller omits it); the response carries `usage.cost` — logged as the provider-reported cost when
  present (D1: it equalled list price exactly); the first call on the endpoint can take ~3 s (budget accordingly, §9).
- Responses: `answers[name].noul` → `p`; `choice` / `score` with `probabilities` + `confidence` unchanged; renormalise; any off-list option →
  `invalid-answer`. Contract tests run against the LIVE response bodies D1 recorded (`B\hosted-responses\`, scrubbed), not against invented ones.

### 5.2 OpenAI Decisions (designed, unmeasured — no key)

`POST https://api.openai.com/v1/decisions`, model `gpt-6-luna`; `input` = the state (an `input_json` part for an object); `questions` = an
ARRAY of `{ name, instructions, type }` with `predicate` for `noul`, `choices[] {value, description}` for `choice`, `levels[] {label,
description}` for `score`; answers by `name`; a `refusal` answer → `{ type: 'refused' }`; ≤ 400 questions per request. Enters `auto` only when
`OPENAI` has a key; `calibrated: false` until §15.1 measures it (a DEFERRED-HASAN live check). D-b's order holds: OpenAI before OpenRouter once it
is measured; until then OpenRouter is the second rung.

### 5.3 The local rung — designed, empty

- Shape: a utilityProcess child (`src/decision-engine/`), never main (the library-search / content-safety lesson: native DLLs and model loads
  stay out of main's loop). The adapter speaks the same `DecisionAdapter` interface; a request the child cannot take (`limits`) is skipped by
  the ladder with a plain reason.
- **What D1 rules out for now:** the SemIf-style option-probabilities adapter over the catalog's tiny GGUFs (far below the bar; node-llama-cpp's
  vocabulary map alone costs ~5/6 of each question — P16); Laya multilingual as shipped (near chance on typed decisions, as its card says; the
  export is faithful); d1-omni (does not load in node-llama-cpp; its runtime is `llama-server`; parked).
- **What could fill it (Hasan's call, §16):** **Mapika decider-2b** — in Hasan's 2026-10-05 experiment 83.5–87.5 % routing with honest
  confidence (P ≥ 0.9 → 96.8–98.8 % right) at 152–162 ms on this laptop's GPU; Apache-2.0; 3.76 GB bf16; System One API; a Python / torch runtime
  (`decider-ai`, torch cu130, `TORCHDYNAMO_DISABLE=1`). The app's `python-models` service spawns Python PER REQUEST (`src/local-python-engine/
  python-runner.ts:102`) for image / 3-D models — a decider needs a **persistent** Python worker (a new piece: spawn once, JSONL over stdio, idle
  unload), which `src/decision-engine/engine-host.ts` is shaped to host. It is spiked first on T1 / T2 / T3 like every candidate; it ships only
  if it passes §15.1.
- Any local candidate: first-use download on a click (never bundled), sha256-checked, under `userData/models/decisions/<id>/`; CPU by default,
  GPU as a setting; `calibrated` per §15.1.

### 5.4 The LLM fallback (uncalibrated)

The app's default text provider through `llmEngine.generate` (or a pinned provider): one prompt per request listing the questions and allowed
answers, JSON back; strict parse; any missing / extra key or a cut text → `invalid-answer` (P11). Probabilities: the chosen answer 1.0.
Always `calibrated: false`; reached by `auto` only with `allowUncalibrated`. It exists so a flow or agent keeps working with no decider key.

## 6. Which provider answers — `auto` vs pinned (hosted-first)

- `provider: 'auto'` (default) walks **Jev → OpenRouter (Microsoft-Decision-1) → OpenAI (once measured + keyed) → the LLM fallback (only with
  `allowUncalibrated`)**; the local rung sits first in the order but is skipped while empty (`skipped: [{ provider: 'local', why: 'no local
  model' }]`). A rung is used only when its key is present and the request fits its `limits`; a `provider-error` moves to the next rung ONCE; a
  `timeout` does not (the caller's budget is spent); a `refused` answer is returned as is.
- A pinned provider never falls back: unavailable → `no-provider`, over its limits → `unsupported`.
- `auto` never sends a request to a hosted provider the user has not given a key for; the user can switch any hosted rung off (§8).

## 7. Processes — nothing blocks main

Main holds keys, the cache, the ladder and the HTTP adapters (`fetch`, async). No local runtime in this slice → zero startup cost and no
native load. The engine host is lazy by design (spawn on first use, idle unload) for when a runtime ships. A dead child rejects its calls (the
ladder moves on) and respawns on the next.

## 8. Keys, settings, UI

- **Keys stay in main** (safeStorage, `settings.ts`): Jev = a new `typesafe` entry in `PROVIDER_REGISTRY` (`src/shared/providers/registry.ts`;
  capability `'decision'`, a new `ProviderCapability`; key placeholder "TypeSafe API key"); OpenRouter = the existing `openrouter` key (it already
  unlocks the OpenRouter LLM preset and image preset); OpenAI = the existing OpenAI text provider's key. The renderer sees has-key booleans only
  (the `provider-keys` IPC, unchanged pattern). AI → Providers shows the TypeSafe row. **The spike's `.env` files are not the app's path** — a
  user pastes the key into the Providers screen like every other key.
- **Settings (KV):** `decisionsMode` — `auto` (default) | `off`; `decisionsHostedOrder` — default `['jev', 'openrouter', 'openai']`, any rung
  removable; `decisionsOpenRouterModel` — default `microsoft/microsoft-decision-1`; `decisionsLocalModelId` — unset (no runtime).
- **UI:** a "Decisions" row in Settings › General beside "Library" (the `LibrarySearchRow.tsx` pattern): mode, the hosted order with has-key
  dots ("Jev — key set · OpenRouter — key set · OpenAI — no key"), the local rung as "none available", and a developer tester behind the
  dev-preview flag (`decisions:decide` with a typed form; shows probabilities — the one place they are shown, as numbers in a tester). UI per
  `UI_SPEC.md`. No hosted call happens without the user's key.

## 9. Timeouts, retries, cache, usage

- **Caller budgets (defaults, from §2's latencies):** a flow / agent `decide` 15 s per request (Jev p95 743 ms, MSD1 1.1 s, first call 3 s);
  a routing hint 2 s (on timeout the hint is simply absent); the developer tester 30 s. Hosted HTTP: one retry on 429 / 5xx / network with
  jitter inside the budget, never on 4xx; the LLM fallback keeps the caller's budget.
- **Packing:** a request is sent as the caller framed it (state once, questions keyed); the adapter splits only when a provider's per-request
  limit requires it (OpenAI 400 questions; Jev 64k tokens), one usage row per HTTP call.
- **Cache:** in memory only (a state may be private text — never written to disk), 1,000 entries, 15 min; failures never cached; identical
  concurrent requests share one call (the LS-r7 rule).
- **Usage:** one `AiUsageEntry` per adapter HTTP call — `provider` (`typesafe` / `openrouter` / `openai`), `model` as served, `featureSource`
  (new values `decision-agent`, `decision-flow`, `decision-routing`, `decision-test`), `requestType` new `'decision'`, input tokens, `costUsd` =
  the provider-reported cost when present (OpenRouter `usage.cost`) else input tokens × the adapter's price table (Jev $0.042 / M; output free on
  all three), `durationMs`. A cache hit logs nothing. (D1's own ledger: 38 requests, $0.038.)
- **Spend:** hosted calls happen only with the user's key; a per-day spend cap is NOT in this slice (§16).

## 10. The first users — probabilities without claims

### 10.1 The `decide` agent tool + flow node (slice 1)

One registration in the agents tool registry (`src/main/services/agents/tools/decide.ts`, registered in `registry.ts`; the `generate_text.ts`
pattern): zod args `{ state, type: 'noul' | 'choice', instructions, options? (choice: id → description), threshold? (default 0.9), provider? }`.
**With `ports` it is also a flow node** ("a tool with `ports` is also a node", `registry-core.ts:91-98`): inputs `state` (text); config `type`,
`instructions`, `options` (one `id: description` per line), `threshold` (number, 0.9), `provider` (select: auto / jev / openrouter / openai /
llm); outputs `answer` (text), `band` (text: `act` | `escalate`), `p` (number — in the run record only). `band = act` iff the top probability ≥
`threshold` AND the answer is `calibrated`; an uncalibrated answer is always `escalate` unless the node's `allowUncalibrated` toggle is on
(then `band = act` with `note = 'uncalibrated'`).
- **What the agent reads** (the tool's text result): "Decision: billing (act)" or "Decision: uncertain — top answer billing (escalate)". Never a
  percentage, never "match", "sure", "confident", "definitely" (the no-claim strings, §15.1). The tool's description tells the model to ask the
  user or gather evidence on `escalate`. `featureSource` = `decision-agent` / `decision-flow`.
- The Studio assistant's tool list (`STUDIO_TOOL_IDS`, append-only) gets no `decide` tool in slice 1 (§13).

### 10.2 Verification gates in flows (slice 1, on 10.1)

Two built-in nodes that are `decide` with a fixed instruction, so flow authors need no prompt-writing: **`check_matches_request`** (`noul`:
"Does this <template / caption style / clip> description do what the request asks?" — T3's exact question family; Jev 100 % / MSD1 100 %, Brier
0.003 / 0.002) and **`route_request`** (`choice` over the caller's option list — T2's family). They expose `band` for branching; a flow that
branches on `band` escalates to a `generate_text` node or to a pause for the user. The flow run record stores `p`; the canvas shows `act` /
`escalate` only.

### 10.3 Studio-assistant request routing (slice 2)

Before a Studio assistant turn, one `choice` over the six families (T2's framing — 100 % on 40 rows, Arabic 10 / 10, ≤ 0.5 s, $0.011 per
1,000) produces a **hint**, never a gate: the system prompt gets one line ("The request most likely concerns: captions.") only when `band =
act`; the tool list is unchanged. `featureSource: 'decision-routing'`, budget 2 s, absent on timeout. What it buys is measured later (fewer
wrong tool calls per turn) — the hint is removable without trace. A hard route (skipping tools, answering `none`-family questions without
them) is NOT in this note.

### 10.4 The alternative — the brief's original first users (not recommended by D1's numbers)

Library search's "nothing fits" (`choice` over the top-20 + none; Jev R@1 79.1 % / wrong-confident 9.6 % / correct none 71.7 % vs the
assistant's 80.7 / 7.1 / 75.5–79.2) would pay a second call for a worse "none"; the Assets box order (per-candidate `noul`) is unmeasured on
the hosted providers (T1 noul held). If Hasan keeps this order anyway, the gate design is: generate without `force` only when P(none) ≥ 0.9
(Jev at τ 0.9: wrong-confident 3.8 %, correct none 86.8 %) and otherwise today's answer unchanged — a NOTE-level gain on 53 ∅ rows, costing one
Jev request (~$0.08 per 1,000) per search.

## 11. The agent tool and the flow step — one registration

Covered in §10.1 (one `registerTool` with `ports`); §10.2's two built-ins are thin wrappers that pre-fill `instructions` and `type`.

## 12. IPC + preload

Channels (`src/shared/ipc/channels.ts`): `decisions:decide` (request / response — the developer tester and the canvas preview), `decisions:status`
(mode, the hosted order with has-key booleans, each rung's `available`, the local rung state), `decisions:settings:set`, and the push event
`decisions:event` (a rung becoming unavailable / available after a key change). Wire types in `src/shared/ipc/types/decisions.ts`; handlers in
`src/main/ipc/decisions-handlers.ts` (try / catch, typed errors), registered `lazily`; preload `src/preload/api/decisions.ts` exposes exactly these.
No key and no state text in any event; `decisions:decide` is gated behind the dev-preview flag in the renderer (slice 1 has no user-facing
caller in the renderer).

## 13. Not in the first slice

The local rung's runtime (no candidate passes); the OpenAI adapter's live measurement (no key); `score` in any UI; images / audio states; hosted
batch endpoints; long-context headers; a disk cache; user-run calibration fitting; a per-day spend cap; the Studio assistant's own `decide` tool
and the hard route; library search's pick / "nothing fits" and the Assets box order (§10.4 — Hasan's call); T1-style 20-option picks as a product
feature; Arabic-specific calibration (Arabic is measured inside T2 / T3's bar).

## 14. Build order (hand-off sized parts, red first)

(a) shared types + `validate` / `ladder` / `calibration-table` / `cache` (pure, tests first) · (b) `adapters/system-one.ts` with an injected
`fetch`, contract-tested on D1's recorded live responses (`B\hosted-responses\`, copied scrubbed into the test fixtures) and dry-run bodies; the
OpenAI adapter on the primary docs' examples (no live call) · (c) `decide.ts` + usage + settings + the `typesafe` key row + IPC + preload + status
+ the engine host contract (no worker) · (d) the `decide` tool / node + the two built-ins (§10.1–10.2) with the T2 / T3 fixtures as unit tests
through an injected adapter · (e) the committed benchmark + the gated live test (§15.1) · (f) the Settings row + the developer tester · (g) the
exit check against §15 (the orchestrator's verifier, ≤ 20 live requests).

## 15. THE ACCEPTANCE BAR (fixed before any verifier; the verifier FAILS only by this)

### 15.1 The committed benchmark (tests in the tree)

- **Fixtures:** D1's `t2-routing.json` (40) and `t3-verify.json` (40) copied into `src/main/services/decisions/benchmark/fixtures/`, plus the
  RECORDED Jev and MSD1 answer files for T2 / T3 (`K\answers\hosted-*-t2-choice.json`, `hosted-*-t3-noul.json`, scrubbed) and the raw response
  bodies for the shape tests. T1 is NOT in the product benchmark (not a first user).
- **Shape (always, offline):** `adapters/system-one.ts` maps every recorded raw response to the same `DecisionResult` the kit scored (choice,
  probabilities to 4 dp, `p`, `usage.input_tokens`); OpenRouter's `usage.cost` is read; an off-list option → `invalid-answer`; a cut JSON →
  `invalid-answer`; every error message is free of the key and the state text (tests inject a fake key and assert it never appears).
- **Replay (always, offline):** the tree's scorer over the recorded answers reproduces `c-hosted.md` §2 EXACTLY — Jev T2 40 / 40, T3 40 / 40,
  Brier 0.021 / 0.003, ECE 0.059 / 0.044; MSD1 40 / 40, 40 / 40, Brier 0.014 / 0.002 — table equality, the S1 precedent.
- **Calibration table (always, offline):** `calibrated: true` for exactly (`jev`, `jev-1.14.0`, `routing`), (`jev`, `jev-1.14.0`, `verify`),
  (`openrouter`, `microsoft/microsoft-decision-1`, `routing`), (`openrouter`, …, `verify`); false for every other (provider, model, family) and
  for `llm` always. The family is set by the caller (`decide` args `family?: 'routing' | 'verify' | 'other'`, default `other` → never calibrated
  in slice 1).
- **Gated LIVE test (`VIDTSX_DECISIONS_LIVE=1`, the key in the environment — DEFERRED-HASAN for the verifier unless Hasan sets it):** Jev on T2 +
  T3 through the product adapter: **accuracy ≥ 38 / 40 on each** (two flips allowed for model drift), Brier ≤ 0.05, 0 off-list, 0 errors, p95 per
  40-question request ≤ 2,000 ms; MSD1 the same bar at p95 ≤ 4,000 ms (its first call excluded). ≤ 4 requests, < $0.01.
- **No-claim strings (always):** over every T2 / T3 row and both bands, the tool's text contains none of `%`, `match`, `matches`, `sure`,
  `confident`, `definitely`, `certain`, `probability`; `band` is the only verdict word.

### 15.2 The gates

`node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run` from the worktree green except the known worktree-only resolution suites
(the LS-r1b / LS-r1c list, each proven in a fresh detached worktree) and DRIVING's load rules; `tsc` web / node at or below the baseline at the
cut (`25 / 10` at `efa5e0b`); the house rules (feature isolation — `decisions/` imports nothing from `studio/`, `asset-library/` or the
renderer; ≤ ~300 lines per file; no `any`; named exports); `package.json` / lock unchanged; the preload exposes only the four `decisions:*`
functions and no key crosses IPC (a test over the preload surface); no `electron` / Node import in `src/shared/types/decisions.ts`.

### 15.3 The live checks (the verifier, isolated profile, CDP 9301–9309)

1. **Main stays responsive:** the ping loop (≤ 250 ms max gap) during 20 concurrent `decisions:decide` calls to a stubbed local HTTP server
   that answers System One bodies with 500 ms delay (no real key needed) — and, when Hasan's key is set, during 5 real Jev calls.
2. **Keys:** the TypeSafe row in AI → Providers accepts a (fake) key; `decisions:status` flips `jev.hasKey` to true; a call with the fake key
   yields `provider-error` whose message holds neither the key nor the state; removing the key flips it back; the renderer bundle contains no key.
3. **The flow node:** a two-node flow (`input_text` → `check_matches_request`) runs on one T3 true row and one false row through the stub server
   → `band` act / escalate as the fixture says; the run record holds `p`; the canvas shows the band only.
4. **The agent tool:** one agent run with `decide` on a T2 row through the stub → the tool's text passes the no-claim test; the usage row carries
   `featureSource: 'decision-agent'`, `requestType: 'decision'`, `costUsd` = tokens × price.
5. **Settings:** `decisionsMode: off` → `no-provider` without a network call (the stub sees nothing); removing `jev` from the order → the stub's
   second configuration (OpenRouter shape) is called.
6. **DEFERRED-HASAN:** the gated live test (15.1) and one real `check_matches_request` run with his key — ≤ 20 requests, ≤ $0.05 in all.

### 15.4 Only notes (never a FAIL)

Latencies beyond the bounds under measured external load (repeat once, record); MSD1's cold first call; Jev's hundredth rounding; the hint's
effect on assistant turns (§10.3, slice 2); anything about the local rung.

## 16. Open questions for Hasan (the stop)

1. **The direction:** §1's recommendation (tool / node + verification gates first, routing as a hint second; library search keeps S1's design;
   hosted-first with an empty local rung) — or the brief's original first users (§10.4)?
2. **T1 noul** on Jev + MSD1 (54 requests, $0.105): run it or not — it needs his reading of "600 hosted decision calls" (requests vs questions).
3. **Clef-flash** (Cloudflare; key present; Jev-compatible; reads images; best on his routing test): add it as a third hosted rung in the spike?
4. **Mapika decider-2b** as the local lead (Python / torch, persistent worker — §5.3): spike it?
5. **OpenAI:** a key for the Decisions API, or leave it designed-only?
6. **The TypeSafe key in the app:** a new Providers row (this note) — fine?
7. A per-day hosted spend cap (not in slice 1) — wanted?

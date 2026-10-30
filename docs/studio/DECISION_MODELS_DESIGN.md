# Decision models — one shared decision service (design note)

> **status: DRAFT — ON HOLD (20:04): D1 STOPPED (BLOCKED by Hasan's STOP rules — `decisions/D1-spike-report.md` §12); this note is
> finished only after Hasan answers D1's questions (§14 of the report), since the local rung (§5.3) and the ladder (§6) depend on them.**
> Written 2026-10-30 while D1's weights downloaded (ORCHESTRATOR.md 16:59). §2 (what D1 measured),
> §5.3's runtime pick, the thresholds in §10 and **§15 THE ACCEPTANCE BAR** are PENDING D1 and are written only after D1 is DONE and its
> STOP judged. Branch `decision-models` (cut from `library-search` @ `efa5e0b`). No product code in this session (D-h).
> Sources: `docs/studio/decisions/NEXT-SESSION.md` (the brief + Hasan's D-a…D-h), `docs/studio/decisions/D1-spike-report.md` (D1),
> the kit `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\reports\` (every number), `docs/studio/LIBRARY_SEARCH_DESIGN.md` (the pattern
> this mirrors).

## 1. Why, and the decision

- **The gap.** Library search's S1 showed that no similarity floor separates "the library lacks it" from a real match (best Youden J
  0.665, S1 §8); "nothing fits" needed an LLM pick (S1 §10: R@1 80.7 %, wrong-confident 6.3 %, correct none 79.2 %). An LLM pick costs a
  model turn (10–23 s per 20 rows in D1's re-run) and gives no calibrated probability. A **decision model** answers TYPED questions about a
  state with a probability per allowed answer in one fast pass, no prose.
- **Hasan's decision (2026-10-30):** one shared decision service — typed questions about a state → typed answers WITH probabilities,
  behind one contract, with two hosted providers (D-a TypeSafe Jev; D-b the OpenAI Decisions API, else Microsoft-Decision-1 via
  OpenRouter) and one local model (D-c), usable anywhere: library search's "nothing fits" and the Assets box order first; then the agents
  (a tool), flows (a step), and routing / classification / verification elsewhere.
- **The E3 lesson, binding everywhere below:** a probability is NOT a fact. No caller shows a probability to the user or to the assistant
  as a claim ("92 % match", "[matched]", "the right sound is …"). Callers consume a decision as an **order**, a **gate** (act above a
  threshold, escalate below — to today's behaviour or to the user), or a **route**. The number itself appears only in logs, the run record
  of a flow, and a developer tester.
- **"Calibrated" is earned, not claimed.** An answer is marked `calibrated: true` only for a (provider, model, task family) whose Brier /
  ECE on the committed benchmark meets §15. Every other answer — the LLM fallback always, a hosted provider until a live check with
  Hasan's key measures it, a local model on a task family it was not measured on — carries `calibrated: false`, and callers that gate
  (§10) refuse uncalibrated answers.

## 2. What D1 measured (the numbers this design rests on)

PENDING D1 (`docs/studio/decisions/D1-spike-report.md`). Facts already fixed by D1 steps 1, 2, 5, 6 (kit reports `a-sources.md`,
`b-tasksets.md`, `c-baseline.md`, `c-hosted-dryrun.md`):

- **Contracts (primary docs, read 2026-10-30):** TypeSafe Jev = System One (`POST https://api.typesafe.ai/v1/systemone`, `state` + keyed
  `questions`, `noul` / `choice` (≤ 255 options) / `score` (≤ 10 levels); 64k tokens per request, 32k per question; $0.042 / M input, output
  free; English "best", Arabic not named). OpenAI Decisions API = GA, `POST /v1/decisions`, `gpt-6-luna` only, `input` + an ARRAY of 1–400
  named questions, `predicate` / `choice` / `score` — NOT System One; $0.10 / M input. Microsoft-Decision-1 = System One on Foundry and on
  OpenRouter's separate Decisions API (`POST https://openrouter.ai/api/alpha/decisions`; `criteria` {true, false} REQUIRED on `noul`
  there); $0.042 / M input. Laya multilingual = mmBERT-base 322M, Apache-2.0, no official ONNX (a community export ran in D1), Arabic weak,
  ships uncalibrated. d1-omni-600M = LFM Open License v1.0 (revenue-capped — not permissive). node-llama-cpp 3.18.1 gives next-token
  probabilities (`controlledEvaluate` … `generateNext.probabilities`); its GPU path on this laptop is Vulkan only.
- **The keyless LLM baseline (D1 step 5, 16 calls):** T1 R@1 80.7 %, wrong-confident 7.1 % (S1 6.3 %), correct none 75.5 %; T2 routing
  100 %, T3 verification 97.5 %; p50 10.4 s / p95 23.4 s per 20-row call; one response arrived `success: true` but cut mid-JSON (P11).
- **Hosted:** every key unset → DEFERRED-HASAN; runners built and dry-run (138 requests for the three task sets on three providers,
  ≤ $0.334).

## 3. The contract (System One-shaped)

`src/shared/types/decisions.ts` (shared by main, the engine and the renderer's status view; no Node types):

```ts
export type DecisionQuestion =
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }      // → P(true)
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }             // option id → description
  | { type: 'score'; instructions: string; criteria: string[] };                           // ordered levels, 2–10

export interface DecisionRequest {
  state: string | Record<string, unknown> | unknown[];   // the evidence; JSON is passed through as JSON
  questions: Record<string, DecisionQuestion>;           // keyed by the caller's names (System One)
  provider?: DecisionProviderChoice;                     // default 'auto' (§6)
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
  provider: DecisionProviderId;                          // 'local' | 'jev' | 'openai' | 'openrouter' | 'llm'
  model: string;
  calibrated: boolean;                                   // §1: earned per (provider, model, task family)
  calibration?: { method: 'temperature'; t: number; version: string };
  usage: { inputTokens: number; costUsd: number };
  latencyMs: number;
  cached: boolean;
  skipped?: Array<{ provider: DecisionProviderId; why: string }>;   // the rungs 'auto' passed over, in plain words
}
```

- `confidence` = the top answer's probability (System One's meaning). `score` = the probability-weighted mean level index.
- Probabilities are renormalised to sum to 1 over the caller's options; an adapter that returns a probability for an option the caller did
  not send is a `provider-error`.
- **Typed errors** (`DecisionError.code`): `no-provider` (nothing configured / downloaded), `unsupported` (the question exceeds every
  available adapter's limits — options, levels, context, language), `timeout`, `provider-error` (HTTP / engine failure, message without any
  key), `invalid-answer` (an unreadable or incomplete answer — P11: a truncated LLM text marked success is `invalid-answer`, never parsed
  leniently in product code), `cancelled`.

## 4. The service — module layout

Feature isolation holds: the service is main-process code; features reach it through the agent tool / flow step (main) and the IPC
surface (renderer). One primary export per file, ≤ ~300 lines, no `any`.

**`src/main/services/decisions/`** (business logic, pure where it can be):

| file | owns |
|---|---|
| `decide.ts` | `decide(request, deps)` — validates, resolves the provider (§6), checks the cache, calls the adapter with the caller's timeout, applies calibration, logs usage, returns `DecisionResult`; `deps` injected in every test. |
| `ladder.ts` | the `auto` resolver: which rungs exist now (local model on disk; hosted keys present; the LLM fallback allowed) and which can answer THIS request (each adapter's `limits`). Pure. |
| `validate.ts` | request shape + per-type rules (choice 1..N options, score 2–10 levels, non-empty instructions, JSON state size). Pure. |
| `calibration.ts` | the shipped temperature table per (provider, model, task family) + `applyTemperature`; the `calibrated` verdict. Pure. |
| `cache.ts` | in-memory LRU keyed by sha256 of the canonical JSON of {adapter, model, calibration version, state, questions}; in-flight sharing. |
| `usage.ts` | one `aiUsageService.appendEntry` row per adapter call (§9). |
| `adapters/system-one.ts` | Jev + OpenRouter Decisions (§5.1). |
| `adapters/openai-decisions.ts` | the OpenAI Decisions API (§5.2). |
| `adapters/local.ts` | the bridge to the engine process (§5.3). |
| `adapters/llm-fallback.ts` | the app's text provider answering JSON (§5.4), `calibrated: false` always. |
| `decision-settings.ts` | settings in the KV store (the `search-settings.ts` pattern, §8). |
| `decision-app.ts` | the one instance: wires keys, the engine host, `llmEngine`, `aiUsageService` (by dynamic import, the `search-app.ts` pattern). |

**`src/decision-engine/`** (the local model's process, mirroring `src/library-search-engine/`): `engine-host.ts` (lazy spawn, request ids,
cold / warm timeouts, death → reject pending + respawn on next use, idle unload, never imports electron — the fork is injected),
`worker.ts` (the child: the runtime D1 recommends, §5.3), `types.ts`. New electron-vite entry `decision-worker` beside `library-search-worker`.

## 5. The adapters

Every adapter implements `DecisionAdapter { id; model(); limits(): DecisionLimits; available(): Promise<boolean>; answer(request, signal) }`,
where `limits` = max options per choice, max levels, max state tokens, max questions per call, languages (a list, or `'unknown'`).

### 5.1 System One over HTTPS — Jev and OpenRouter Decisions

- One adapter, two configurations: **Jev** (`https://api.typesafe.ai/v1/systemone`, model `jev-1.14.0` pinned — not `jev-latest`, so a
  calibration fit cannot drift silently) and **OpenRouter Decisions** (`https://openrouter.ai/api/alpha/decisions`, model
  `microsoft/microsoft-decision-1` for D-b's fallback; any OpenRouter decision model id is a setting, not code). Quirks table:
  OpenRouter requires `criteria` on `noul` (the adapter fills {true: "yes", false: "no"} when the caller omits it).
- The request is the contract nearly as is (`state`, `questions`); answers map `noul` → `p`, `choice` / `score` unchanged. A request that
  exceeds 32k tokens per question is `unsupported` for this adapter (the long-context header is never sent in this slice).
- Images (`assets`, the "danger zone" header) are not in this slice.

### 5.2 OpenAI Decisions

- `POST https://api.openai.com/v1/decisions`, model `gpt-6-luna`; `input` = the state (JSON stringified into an `input_json` part when it
  is an object); `questions` = an ARRAY of `{ name, instructions, type }` with `predicate` for `noul`, `choices[] {value, description}` for
  `choice`, `levels[] {label, description}` for `score`; answers back by `name`; a `refusal` answer → `{ type: 'refused' }`. ≤ 400
  questions per request (more → split, one usage row per HTTP call).
- D-b's order holds: OpenAI first when Hasan's key reaches it; Microsoft-Decision-1 via OpenRouter otherwise.

### 5.3 The local model — in a utilityProcess, never in main

- **Runtime: PENDING D1's recommendation** (Laya multilingual on `onnxruntime-node`, or the option-probabilities adapter on
  `node-llama-cpp` over a catalog GGUF). Either way it runs in `src/decision-engine/worker.ts` inside an Electron **utilityProcess**: the
  library-search / content-safety lesson (sherpa-onnx's older `onnxruntime.dll` in main breaks the 1.24.3 binding in every thread of that
  process) and the main-freeze lesson (a native model load blocks main's loop). The app's existing `src/llm-engine/llm-local-engine.ts`
  loads `node-llama-cpp` in MAIN for the chat provider — the decision engine does not reuse that instance; it loads its own in the child.
- The option-probabilities method (if chosen): the model's chat template, options as single-token letters / Yes-No, the first next-token
  distribution at temperature 0 (no truncation), renormalised over the option tokens; the raw option mass is kept as a validity signal
  (low mass → `invalid-answer`); a shared state prefix is evaluated once per request.
- **First-use download** (CLAUDE.md: never bundled): a catalog entry with the measured size and a sha256, downloaded on a click (Settings
  row, §8) into `userData/models/decisions/<id>/`, hash-checked before first load. D1 found the catalog's `qwen2.5-0.5b-q8` size wrong
  (531,000,000 vs 675,710,816 B on the HF API) — if that model is chosen, the entry is corrected with a test (the LS-r2 precedent).
- GPU: CPU is the default (predictable, no VRAM contention with the chat model or renders); Vulkan offload only if D1 shows a warm p95
  gain that matters, as a setting.

### 5.4 The LLM fallback (uncalibrated)

- The app's default text provider through `llmEngine.generate` (or a pinned provider), one prompt per request listing the questions and
  allowed answers, JSON back; strict parse; any missing / extra key or a cut text → `invalid-answer` (P11). Probabilities: the chosen answer
  1.0 (no verbalised confidence is treated as a probability). Always `calibrated: false`; reached by `auto` only when the caller set
  `allowUncalibrated`.

## 6. Which provider answers — `auto` vs pinned

- `provider: 'auto'` (default) walks the ladder **local → hosted → LLM fallback**: local when its model is on disk and the request fits its
  limits; hosted in the user's order (default: Jev, then OpenAI, then OpenRouter — D-a first) when a key is present and the request fits;
  the LLM fallback only with `allowUncalibrated`. Each skipped rung is reported in `skipped` with a plain reason ("local: 21 options, the
  model's limit is 20"). A provider error on a rung moves to the next rung ONCE; a timeout does not (the caller's budget is spent).
- A pinned provider (`'local' | 'jev' | 'openai' | 'openrouter' | 'llm'`) never falls back: unavailable → `no-provider`, over its limits →
  `unsupported`.
- `auto` never sends a request to a hosted provider the user has not given a key for, and the user can switch hosted rungs off
  (§8: "local only").

## 7. Processes — nothing blocks main

- Main holds keys, the cache, the ladder and the HTTP adapters (fetch — async, light). The local runtime lives only in the engine child;
  startup cost is zero (lazy spawn on the first local request or status call, `lazily` registration).
- Cold / warm timeouts and idle unload follow the library-search host (5 s cold / 2 s warm today) — the warm budget is re-set from D1's
  measured warm p95 (§15). A dead child rejects its calls (the ladder moves on) and respawns on the next.

## 8. Keys, settings, UI

- **Keys stay in main** (safeStorage, `settings.ts`): Jev = a new `typesafe` id in `PROVIDER_REGISTRY` (capability `'decision'`, a new
  `ProviderCapability`); OpenRouter = the existing `openrouter` key; OpenAI = the key of the existing OpenAI text provider (`llmProviders`
  entry `openai`). The renderer sees has-key booleans only (`provider-keys` IPC, unchanged pattern). AI → Providers shows the TypeSafe row.
- **Settings (KV):** `decisionsMode` — `auto` (default) | `local-only` | `off`; `decisionsLocalModelId` — the D1 default; `decisionsHostedOrder`
  — default `['jev', 'openai', 'openrouter']`; `decisionsOpenRouterModel` — default `microsoft/microsoft-decision-1`.
- **UI:** a "Decisions" row in Settings › General beside "Library" (the `LibrarySearchRow.tsx` pattern): the mode, the local model's size and
  a Download button with progress, the state line ("local: ready · hosted: Jev (key set)"). UI per `UI_SPEC.md`. No model or hosted call
  happens without the user's download click or key.

## 9. Timeouts, retries, cache, usage

- **Caller budgets (defaults):** library search's gate 2 s (on timeout the gate is skipped → today's behaviour); Assets order 3 s (→ the
  Smart order); agent tool 30 s; flow step 60 s. Hosted HTTP: one retry on 429 / 5xx / network with jitter inside the budget, never on
  4xx; the LLM fallback keeps the caller's budget.
- **Cache:** in memory only (a state may be private text — never written to disk), 1,000 entries, 15 min; failures never cached; identical
  concurrent requests share one call (the LS-r7 rule).
- **Usage:** one `AiUsageEntry` per adapter call — `provider`, `model`, `featureSource` (new values `decision-library-search`,
  `decision-assets-order`, `decision-agent`, `decision-flow`, `decision-test`), `requestType` new `'decision'` (hosted / LLM) or
  `'local-decision'`, input tokens, `costUsd` = input tokens × the adapter's price table (output free on all three hosted APIs), duration.
  A cache hit logs nothing.
- **Spend:** hosted calls happen only with the user's key; a per-day spend cap is NOT in this slice (a note for Hasan, §16).

## 10. The first users — probabilities without claims

### 10.1 Library search's "nothing fits" (the Studio assistant's sound reuse)

- Today (LIBRARY_SEARCH_DESIGN §6): Smart answers a non-empty pool with up to 20 neutral rows; generating needs `force: true`.
- With decisions: after the search, ONE `choice` over the top-20 + "none of these" (D1's T1 choice framing), `auto`, calibrated answers
  only (`allowUncalibrated: false` — the assistant is already the LLM in the loop), budget 2 s. Three outcomes, thresholds PENDING D1's
  selective-accuracy tables:
  - P(none) ≥ τ_none → the tool may generate without `force` (a ROUTE: one tool round trip saved). Its text says what happened, never why
    with certainty: "No library clip used — generated a new one." No probability, no "nothing matches".
  - top P ≥ τ_act → that clip moves to row 1 of the same neutral 20-row answer (an ORDER). No label, no number.
  - otherwise → today's answer unchanged (escalate = the assistant picks or asks, as S4 measured).
- The no-claim strings of LIBRARY_SEARCH_DESIGN §9 stay a test over every T1 row in every mode, extended to the decision outcomes.

### 10.2 The Assets box order

- The "Smart + AI rerank" rung (LS-r7, `rerank.ts` — one LLM call) gains a decision-model path: `noul` per top-20 candidate ("Is <item> what
  the user searched for?"), ordered by P; used when a calibrated decision provider is available, else today's LLM rerank. Only after the
  query settles (1 s idle / Enter), as today. The grid shows an order only.

### 10.3 Later users (not in the first slice, §13)

Routing (T2 — the assistant's tool family before a turn), verification (T3 — "does this clip match this script line?"), classification.
D1's T2 / T3 numbers say how far a local model can carry them.

## 11. The agent tool and the flow step — one registration

- `decide` in the agents tool registry (`src/main/services/agents/tools/decide.ts`, registered in `registry.ts`; the `generate_text.ts`
  pattern): zod args `{ state, type: 'noul' | 'choice', instructions, options? (choice), provider?, threshold? }`. **With `ports` it is also a
  flow node** (flows plan §1.2: "a tool with `ports` is also a node"): inputs `state` (text); config `type`, `instructions`, `options` (one per
  line), `threshold` (number, default 0.7 — PENDING D1), `provider` (select: auto / local / jev / openai / openrouter); outputs `answer`
  (text), `band` (text: `act` | `escalate`) and `p` (number — the flow's run record shows it; a downstream node reads `band`).
- **What the agent reads** (the tool's text result): the answer and the band in words — "Decision: billing (act — calibrated local model)" or
  "Decision: uncertain (escalate — top answer billing)". Never a percentage as a fact. The tool's description tells the model to ask the user
  or gather more evidence on `escalate`. `featureSource` = `decision-agent` / `decision-flow`.
- The Studio assistant's tool list (`STUDIO_TOOL_IDS`, append-only) gets no `decide` tool in the first slice.

## 12. IPC + preload

Channels (`src/shared/ipc/channels.ts`): `decisions:decide` (request / response — the developer tester and flows' canvas preview),
`decisions:status` (mode, ladder rungs available, has-key booleans, local model on disk / size / loaded), `decisions:settings:set`,
`decisions:model:download` and the push event `decisions:event` (download progress, engine state). Wire types in
`src/shared/ipc/types/decisions.ts`; handlers in `src/main/ipc/decisions-handlers.ts` (try / catch, typed errors), registered `lazily`;
preload `src/preload/api/decisions.ts` exposes exactly these functions. No key, no state text in any event.

## 13. Not in the first slice

`score` in any UI; images / audio states; hosted batch endpoints; long-context headers; a disk cache; user-run calibration fitting; Foundry
deployments; a per-day spend cap; the Studio assistant's own `decide` tool; T2 routing / T3 verification in product; Arabic-specific
calibration.

## 14. Build order (hand-off sized parts, red first)

(a) shared types + `validate` / `ladder` / `calibration` / `cache` (pure, tests first) · (b) the hosted adapters with an injected `fetch`,
contract-tested on D1's dry-run bodies and the primary docs' examples (no live call) · (c) `src/decision-engine/` host + worker + the D1
runtime + the first-use download; the gated live test on the committed benchmark · (d) `decide.ts` + usage + settings + IPC + preload +
status · (e) the `decide` tool / flow node · (f) the first users (§10.1 gate, §10.2 order) · (g) the Settings row + the TypeSafe key row · (h)
the exit check against §15.

## 15. THE ACCEPTANCE BAR

PENDING D1 — fixed here from D1's numbers before any verifier: the committed benchmark (T1 / T2 / T3 fixtures in the tree) with per-task
thresholds for the local default (accuracy, Brier, ECE, wrong-confident at τ), the gates (vitest from the worktree with the known
resolution suites; tsc at or below baseline), the no-claim strings, the live checks (main's ping loop during the engine's cold load; the
download path; the §10 users; the tool + node), what is DEFERRED-HASAN (every hosted check, with his keys, inside D-e's cap), and what is
only a note.

## 16. Open questions for Hasan

PENDING D1's stop report (collected so far: D-e's "600 hosted decision calls" = HTTP requests or questions (D1 P10); a community ONNX export
vs a one-time Python export to ship Laya (D1 P1); d1-omni's revenue-capped licence (D1 P3); reusing the OpenAI text key for the Decisions
API; whether §10.1's "generate without `force`" route is wanted; a per-day hosted spend cap).

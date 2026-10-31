# D4 — THE BUILD: the shared decision engine (D2 §14 (a) → (h))
status: HANDOFF (D4 builder #3, 2026-10-31 10:34) — **part (c) IN PROGRESS: sub-checkpoint (c1) committed at `b7b1648`** (main's decision
services + the `typesafe` registry entry + the `'decision'` capability + the wire types; 5 files / 32 tests green after a red run; tsc web 25 /
node 10); **(c2) is next** (IPC channels + handlers + registration + preload + `electron.d.ts` + the key-save hook + the preload-surface test).
Part (b) DONE at `ed79420`; part (a) DONE at `c7ad6da`. Earlier: orchestrator 09:44 —
D3 judged **FAIL, the local rung stays empty → part (g) is NOT built**; rulings **D-r16** (binds (b), (d), (e)) and **D-r17** (builder #1's
four contract decisions, accepted 10:02).

> Branch `decision-models`, worktree `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\wt` (paths below are relative to it unless absolute).
> The orchestrator's state: `docs/studio/decisions/ORCHESTRATOR.md` — section "Session 2" (Hasan's E-a … E-h verbatim, the rulings from
> D-r12 on). **The design you build is `docs/studio/DECISION_MODELS_DESIGN.md` (D2, accepted) — §4 is the layout to build EXACTLY; §15 is
> the bar the independent verifier (D5) will judge, and ONLY §15.** One builder at a time; red first; one part (a)…(h) per builder unless a
> part is small.

## Goal (the paste-in's D4 text, verbatim)

D4 — THE BUILD, D2 §14 (a) → (h), red first, hand-off-sized parts (one builder at a time; HANDOFF.md per part; a part is DONE when
  its tests are green, tsc ≤ baseline, the house rules hold — feature isolation, ≤ ~300 lines per file, no `any`, named exports —
  and it is committed with explicit paths). Specifics: (b)'s contract tests run on D1's RECORDED live responses (copied scrubbed into
  src/decision-engine/providers/fixtures/ — check that no key or state text is in them) and must map them to the exact
  probabilities D1 scored; (c) registers presets from credentials exactly like image-init.ts; the renderer never sees a key; (d)'s
  tool text passes the no-claim test over every T2 / T3 row and both bands; (e)'s replay test = table equality with
  D1's c-hosted.md §2 (Jev T2 40 / 40, T3 40 / 40, Brier 0.021 / 0.003, ECE 0.059 / 0.044; MSD1 40 / 40, 40 / 40, 0.014 / 0.002) and
  the gated live test (VIDTSX_DECISIONS_LIVE=1 + the key in the environment via hosted-live.sh's two variables) is DEFERRED-HASAN
  for builders (the verifier runs it, ≤ 4 requests); (f) the Settings row + the Providers "Decisions" section per UI_SPEC.md; (g)
  only if D3 passed — the worker ships on the app's `pytorch` runtime path (python-models), a first-use download entry with the
  measured size + sha256, never bundled; (h) the exit check: the full vitest gate from the worktree (logged to a file; LS-r1b /
  LS-r1c proof for the worktree-only suites), tsc, the house-rules sweep, the live checks a builder can run (D2 §15.3 1, 3, 4, 5 with
  the stub server), a Status.md row (top, dated) and a TESTING.md §20 block (after §19) with the measured numbers.

**D2 §14 (the build order, verbatim):** (a) `src/decision-engine/` types + `validate` / `ladder` / `calibration-table` / `cache` (pure, tests
first) · (b) `providers/system-one-provider.ts` with an injected `fetch`, contract-tested on D1's recorded live responses (`B\hosted-responses\`,
copied scrubbed into the test fixtures) and dry-run bodies; the engine class + presets (`credentialId` typesafe / openrouter) · (c) main's wiring
`src/main/services/decisions/` (init from credentials — the `image-init.ts` pattern; usage rows; settings; the `typesafe` registry entry +
`'decision'` capability + its label; IPC + preload + status) · (d) the `decide` tool / node + the two built-ins (§10.1–10.2) with the T2 / T3
fixtures as unit tests through an injected provider · (e) the committed benchmark + the gated live test (§15.1) · (f) the Settings › General row +
the Providers section + the developer tester · (g) ONLY if D3 passed: `src/local-decider-engine/` (the persistent worker host + the Python worker
shipped on the app's `pytorch` runtime path, a first-use download entry with sizes + sha256, the `local-decider` preset registered when the
model is on disk) · (h) the exit check against §15; then D5, the independent verifier (≤ 20 live requests, ≤ $0.05).

## Parts

| part | what | status | commit(s) |
|---|---|---|---|
| (a) | `src/decision-engine/` types + validate / ladder / calibration-table / cache, tests first; `src/shared/types/decisions.ts` (§3) | **DONE** | `c7ad6da` |
| (b) | `providers/system-one-provider.ts` (injected `fetch`) + contract tests on D1's recorded responses (scrubbed fixtures) + dry-run bodies; `decision-engine.ts` + `presets.ts` + `index.ts`; the LLM-fallback provider (§5.4) | **DONE** | `ed79420` |
| (c) | `src/main/services/decisions/` (decision-init from credentials like `image-init.ts`, decision-usage, decision-settings, decision-runtime); registry `typesafe` + `'decision'` capability + label; `openrouter` gains `'decision'`; IPC (§12) + preload + status; the preload-surface test | **IN PROGRESS** — (c1) services + registry + wire types **DONE**; (c2) IPC + preload + key-save hook TODO | (c1) `b7b1648` |
| (d) | `src/main/services/agents/tools/decide.ts` (tool + flow node via `ports`) + `check_matches_request` + `route_request`; T2 / T3 unit tests through an injected provider; the no-claim test | TODO | — |
| (e) | `src/main/services/decisions/benchmark/` — fixtures (T2 / T3 + the recorded Jev / MSD1 answers), the tree's scorer, the replay test (= `c-hosted.md` §2), the calibration-table test, the gated live test (skipped unless `VIDTSX_DECISIONS_LIVE=1`) | TODO | — |
| (f) | Settings › General "Decisions" row + the Providers "Decisions" section + the dev-preview tester (UI_SPEC.md) | TODO | — |
| (g) | ONLY if D3 PASSED — `src/local-decider-engine/` + the worker on the `pytorch` runtime path + the download entry | **NOT BUILT — D3 FAILED** (`D3-mapika-report.md` §6–§7: 3 PASS / 4 FAIL). The ladder starts at Jev; the local rung is reported in `skipped` as `'no local model'` (D2 §6); `local-decider-provider.ts` is NOT written in this slice; `provider: 'local'` pinned → `no-provider` | — |
| (h) | the exit check (full gate logged, LS-r1b / LS-r1c proofs, tsc, house rules, §15.3 1 / 3 / 4 / 5 on the stub server, Status.md row, TESTING.md §20) | TODO | — |

## Rulings that bind this part (ORCHESTRATOR.md "Rulings (session 2)")

- **D-r16 — the request shape.** (a) The `system-one` adapter is a TRANSPORT: it sends the caller's `state` + keyed `questions` unchanged (the
  only rewrite: OpenRouter's required `noul` criteria, D2 §5.1). (b) `check_matches_request` sends `state` = D1's T3 rule VERBATIM (the
  `instruction` of `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\fixtures\t3-verify.json`) and ONE `noul` question whose `instructions`
  carry the item + the request as D1's T3 rows' `question` does, with D1's T3 criteria (`K1\hosted-run.cjs` `NOUL_T3`); `route_request` sends
  `state` = a routing rule (optional `rule` config; default a generic rule naming the caller's options) and ONE `choice` question "Which ONE …
  must act on this request? Request: <JSON>" with the caller's options as criteria (`K1\hosted-run.cjs:50-54`). (c) Tests assert the built-ins
  fed D1's T3 rows / D1's T2 rule + families produce bodies EQUAL to D1's (state + question text + criteria); the gated live test sends D1's
  fixtures in that shape. (d) The generic `decide` tool sends what its caller frames.
- **D3 = FAIL** → no local rung in this slice (part (g) above).

## Read first (from the worktree)

CLAUDE.md; this file; `docs/studio/DECISION_MODELS_DESIGN.md` in full; `docs/studio/end-to-end/DRIVING.md`; `docs/studio/LIBRARY_SEARCH_DESIGN.md`
§3 / §7 and `docs/studio/search/ORCHESTRATOR.md`'s S3 Log (the build pattern that shipped: engine host, lazily-registered IPC, the Settings row,
red-first parts). Code, for the part at hand only: `src/image-engine/{image-engine,presets,types,index}.ts` + `providers/` and
`src/main/services/image-init.ts` (THE PATTERN — register each preset whose `credentials[preset.credentialId]` exists); `src/shared/providers/
registry.ts` (`PROVIDER_REGISTRY`, `ProviderCapability`, `PROVIDER_CAPABILITY_LABELS`); `src/features/ai-models/components/providers/
ProviderKeyRow.tsx`; `src/main/services/agents/tools/{registry-core,generate-text}.ts` (a tool with `ports` is also a flow node);
`src/main/services/ai-usage.ts` + `src/shared/types/ai-usage.ts`; `src/library-search-engine/{search-engine,electron-fork}.ts`;
`src/local-python-engine/python-runner.ts` + `src/main/services/python-models/{service,registry}.ts` (only for (g)).

## Commands (the worktree has NO node_modules — never npx / npm here)

- Tests: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run <paths>` from the worktree root.
- Types: `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit` and `-p tsconfig.node.check.json`;
  **baseline web 25 / node 10 at `b2b8a02`** (orchestrator, 08:50; logs `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D4\tsc-*-b2b8a02.log`)
  — a part is DONE only at ≤ 25 / ≤ 10.
- Build (only when a part needs the app): `node D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build` from the worktree
  root with `NODE_OPTIONS=--max-old-space-size=8192` and `ELECTRON_RUN_AS_NODE` unset.
- The full gate (part (h)): expect the worktree-only suites of `docs/studio/search/ORCHESTRATOR.md` rulings LS-r1 / LS-r1b / LS-r1c (25 suites
  failing ONLY with "Cannot find module '<wt>\stream'" / "'<wt>\stream\promises'", listed by name in LS-r1c) + the 3 E-d2a `shot-bundle*`
  package-resolution suites; each counted only with the proof that it passes in a fresh `git worktree add --detach` at the gate's HEAD
  (commands + outputs recorded; the scratch worktree removed after). Any 29th red, or another error in those, is real. The full run is logged
  to a file (DRIVING's load rules: the dev app off, rerun a timeout-flaky file in isolation).

## Rules (binding — the paste-in's overrides)

- Work only in the worktree; never npx/npm there, never git stash, never touch the main checkout `D:\repos\VidTSX-STUDIO` (another session's
  uncommitted work; never edit / stage / build / launch there, never its `out/` or `node_modules`).
- NO new npm package (fetch is built in; System One is plain HTTPS). If a part seems to need one: Open problems + `status: BLOCKED`.
- Keys: the renderer never sees a key (has-key booleans only); no key in a fixture, log, doc, commit or hand-back; tests use a FAKE key and
  assert it never appears in an error message. Builders make NO live hosted call — the gated live test is written and skipped; the verifier
  runs it. Never open `.env` files or any credential store (`settings.db*`, `~/.claude`, any profile's).
- D1's recorded responses live at `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D1\hosted-responses\` and the answer files at
  `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\answers\`; copy into the tree only what a test needs, SCRUBBED (no key, no `Authorization`,
  no state text beyond what the T2 / T3 fixtures already hold); a key-pattern scan over every fixture before committing it.
- The app (only parts (c) live checks, (f), (h)): isolated profile `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\decisions-D4\profile`
  (copied from `profiles\source\profile` WITHOUT `settings\settings.db*`), CDP **9302**, Studio root set in the first CDP call, launched from the
  worktree's own `out/` per DRIVING "Launch recipe from the worktree"; never Hasan's `%APPDATA%\VidTSX Studio`; if his dev app runs (9222 /
  5173), never kill it, never `electron-vite dev`.
- A probability is never shown to the user or the assistant as a claim (D2 §1, §15.1): the tool text shows the answer and the band only.
- House rules: feature isolation (`decisions/` imports nothing from `studio/`, `asset-library/` or the renderer); ≤ ~300 lines per file; no
  `any`; named exports; `src/shared/types/decisions.ts` has no `electron` / Node import.

## Done

**Part (a) — `c7ad6da` (2026-10-31 09:56), 11 paths, all as of `c7ad6da`:**
- `src/shared/types/decisions.ts` (91 lines; only import `./ai-usage`) — the §3 contract: `DecisionProviderId` :15, `DecisionRequest` :43,
  `DecisionErrorCode` :84, plus `DECISION_PROVIDER_IDS`, `DEFAULT_DECISIONS_HOSTED_ORDER`, `DecisionsMode`, `DecisionTaskFamily`.
- `src/decision-engine/types.ts` — re-exports the contract; `DecisionLimits` :30 (`maxOptions` / `maxLevels` / `maxStateTokens` /
  `maxQuestions`), `DecisionProvider` :53 (`id`, `model`, `limits()`, `checkReady()`, `decide(request, signal)` → `DecisionProviderOutput`
  {answers, model as served, usage}), `DecisionProviderConfig` / `DecisionProviderPreset`, `DecisionCredentialId = 'typesafe' | 'openrouter'`,
  `DecisionError` :82 (`code`, `provider?`).
- `src/decision-engine/validate.ts` — `DECISION_REQUEST_CEILING` :11 (255 options, 10 levels, 64,000 state tokens, 1,000 questions),
  `estimateTokens` :37 (= ceil(UTF-8 bytes / 3)), `validateDecisionRequest(unknown)` :171 → `{ ok, request (clean copy), measure }` or
  `{ ok: false, code: 'invalid-request' | 'unsupported', reason }` (reasons name question keys, never the state).
- `src/decision-engine/ladder.ts` — `planDecisionLadder` :105 (pure; providers + readiness + `{ mode, hostedOrder }` in) → rungs with plain
  whys (`'no local model'`, `'no key'`, `'no text provider'`, `'over its limits'`, `'switched off in Settings'`, `'uncalibrated —
  allowUncalibrated is off'`, `'uncalibrated for this task family'`) + `usable`, or `no-provider` / `unsupported`; `skippedBefore` :135.
- `src/decision-engine/calibration-table.ts` — `CALIBRATED_DECISION_ROWS` :27 (6 rows), `isDecisionCalibrated` :33.
- `src/decision-engine/cache.ts` — `sha256Hex` :30 (WebCrypto), `canonicalJson` :38, `DecisionCache<V>` :59 (`keyOf`, `run` :87, `size`,
  `clear`; LRU 1,000 / TTL 15 min from the write, injectable `now` / `hash`).
- Tests beside them: `validate.test.ts`, `ladder.test.ts`, `calibration-table.test.ts`, `cache.test.ts`.
- `tsconfig.node.json` `include` gains `src/decision-engine/**/*` (the library-search precedent, `62685e9`) — without it tsc never sees the
  engine until main imports it in (c).

**Decisions builder #1 made (the orchestrator may overrule any):**
1. **The MSD1 rung's id is `openrouter-decisions`** (the preset id — D2 §4 presets, §8 `decisionsHostedOrder`, §10.1's node select, and this
   brief); D2 §3 / §15.1's `openrouter` is read as that rung. **`'openai'` is NOT in the union** (E-e: no preset, no key row); a request with
   `provider: 'openai'` or `'openrouter'` is `invalid-request`. `'local'` stays (D2 §3). The USAGE row's `provider` stays the credential name
   (`typesafe` / `openrouter`, §9) — a different field.
2. **`DecisionRequest.family?: 'routing' | 'verify' | 'other'`** added to the §3 interface: §15.1 says the caller sets the family and §6's
   local rung reads "the request's family"; absent = `other` = never calibrated.
3. **`'invalid-request'` added to `DecisionErrorCode`** for malformed requests (1 option, empty instructions, no question, a wrong type);
   `unsupported` keeps §3's meaning (over every adapter's limit: > 255 options, > 10 levels, state > 64,000 est. tokens, > 1,000 questions).
4. **Calibration table = 6 rows, not 4:** (jev, `jev-1.14.0`) and (openrouter-decisions, `microsoft/microsoft-decision-1`) AND (openrouter-
   decisions, `microsoft/microsoft-decision-1-20261009`) × routing | verify. Why: D1's recorded MSD1 bodies all carry `"model":
   "microsoft/microsoft-decision-1-20261009"` (19 of 19 in `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D1\hosted-responses\`; Jev's
   19 carry `"jev-1.14.0"`), `DecisionResult.model` is "as served" (§3), so an alias-only table would never mark a real MSD1 answer
   calibrated; the 20261009 snapshot IS the measured model. Any other snapshot (e.g. `-20261201`) → false (drift, unmeasured); `typesafe/jev-1.14`
   via OpenRouter → false; `llm` and `local` → false always; family `other` / absent → false. Pinned by `calibration-table.test.ts`.
5. **sha256 = WebCrypto** (`globalThis.crypto.subtle`, no Node import), injectable through `DecisionCache({ hash })`.
6. **Ladder details:** a hosted rung removed from `decisionsHostedOrder` is reported `'switched off in Settings'` and is unavailable even when
   pinned (→ `no-provider`); mode `off` beats a pin; a pinned `llm` needs no `allowUncalibrated` (explicit opt-in); a pinned, registered `local`
   is used even uncalibrated (the engine stamps `calibrated: false`); stale / repeated ids in the stored order are ignored; `unsupported` (auto)
   = no usable rung and at least one available rung skipped only for its limits.
7. **Cache:** a caller that shares an in-flight call gets `cached: true` (it made no request of its own → no usage row); failures reject every
   sharer and store nothing.

**Part (b) — `ed79420` (2026-10-31 10:15), 16 paths, all as of `ed79420`:**
- `src/decision-engine/decision-engine.ts` (265 lines) — `class DecisionEngine` :113, `decisionEngine` :265; `setSettingsResolver` :127,
  `setUsageListener` :132 (NEW: one `DecisionUsageEvent` :36 per provider HTTP call = `{ provider, featureSource, model as served,
  inputTokens, costUsd, durationMs }`, emitted only by a real call, never by a cache hit or a sharer — part (c)'s `decision-usage.ts` hooks
  here), `register` :137 (system-one + key → `SystemOneProvider`; else throws "…registerInstance()"), `registerInstance` :154, `decide` :177,
  `decideWith` :182, `run` :186 (validate → readiness of every registered provider → `planDecisionLadder` → per usable rung
  `cache.run({provider, model requested, state, questions})` → stamp), `call` :241 (the provider call raced against the budget signal, so
  a provider that ignores its signal cannot hold the call or the cache's in-flight slot past the budget), `classify` :256 (caller cancel →
  `cancelled`; the budget's timer → `timeout`; a `DecisionError` keeps its code; anything else → `provider-error`; every message scrubbed).
  `DEFAULT_DECISION_TIMEOUT_MS` :31 = 15,000 (§9). `constructor({ fetch?, now? })` — `fetch` goes to every System One provider `register`
  builds.
- `src/decision-engine/presets.ts` — `DECISION_PROVIDER_PRESETS` :7 (`jev`, `openrouter-decisions`, both `usdPerMInputTokens: 0.042`).
- `src/decision-engine/index.ts` — re-exports the engine, the types, the presets, `DecisionLadderSettings`, both provider classes and their
  public types.
- `src/decision-engine/providers/system-one-provider.ts` (225) — `SystemOneFetch` :34 (the structural slice of `fetch`), `SYSTEM_ONE_LIMITS`
  :40, `SystemOneProvider` :106: body `{ model, state, questions }` with the caller's questions unchanged except OpenRouter's noul criteria
  (`noulCriteriaRequired`, default = host `openrouter.ai`); `Authorization: Bearer` + `Content-Type: application/json`; one retry (jitter
  250–750 ms, injectable `retryDelayMs`) on 429 / ≥ 500 / a thrown fetch, never on another status; packs ≤ 400 questions and ≤ 64,000 est.
  tokens (state + Σ instructions + criteria, `estimateTokens`) per HTTP call, a question over 32,000 → `unsupported`; usage per call =
  `usage.input_tokens` (else the body's estimate) and `usage.cost` when present (else tokens × the preset price); served model = `json.model`.
- `src/decision-engine/providers/system-one-answers.ts` — `readSystemOneAnswers` :73 (noul → `p`; choice / score → probabilities over the
  caller's options, renormalised; `confidence` passed through unchanged, else the top probability; score probabilities keyed by level text or
  index; a `refused` / `refusal` answer → `{ type: 'refused' }`; extra answers ignored; anything else → `invalid-answer` naming the key only).
- `src/decision-engine/providers/llm-fallback-provider.ts` (167) — `LlmFallbackGenerate` :36 (structurally `llmEngine.generate`:
  `{ prompt, systemPrompt, maxTokens, temperature: 0, signal }` → `{ text, model, usage? }`), `LlmFallbackProvider` :121 (id `llm`;
  `isReady?` → `'no text provider'`; limits = ceiling with `maxQuestions: 100`; one prompt with the state once and every question + its
  allowed answers; strict parse = one JSON object, optionally in ONE ```json fence; noul = a boolean, choice = an option id, score = a level
  text; missing / extra key, off-list, cut → `invalid-answer`; chosen answer 1.0).
- `src/decision-engine/scrub.ts` — `decisionSecrets` :15 (key + state text/JSON + every question's instructions — D-r16 puts the evidence in
  instructions), `scrubDecisionText` :34 (replace each secret, mask `Bearer …` / `sk-…`, withhold the whole message if a 24-char run still
  matches a secret, cut at 300 chars).
- `src/decision-engine/types.ts` — NEW `DecisionCallUsage` :45 and `DecisionProviderOutput.calls?` :61 (per HTTP call); NEW
  `DecisionProviderConfig.usdPerMInputTokens?` :87 (the §9 price table lives on the preset).
- Tests: the two red files of builder #1 **passed unchanged**; NEW `providers/system-one-provider.contract.test.ts` (recorded bodies),
  `providers/system-one-provider.test.ts` (failure paths), `providers/llm-fallback-provider.test.ts`.
- **Fixtures** `src/decision-engine/providers/fixtures/` (39 KB in all, built by
  `C:\Users\hasan\AppData\Local\Temp\claude\d--repos-VidTSX-STUDIO\d49810c3-af6a-4487-806f-0a54cc0c7f22\scratchpad\make-fixtures.cjs`
  from D1's read-only kit): `system-one-recorded-bodies.json` (the 4 T2 / T3 raw bodies — `model` + `answers` + `usage`; the generation `id`
  and upstream `provider` dropped), `d1-scored-t2-t3.json` (the 4 answer files' served model, logged usage and per-row `probs` / `pTrue`),
  `system-one-dry-run-slice.json` (D1's T2 / T3 dry-run state + 3 questions each incl. one Arabic row — text that is all in D1's
  `t2-routing.json` / `t3-verify.json`). No T1. No key, no `Authorization`.

**Decisions builder #2 made (the orchestrator may overrule any):**
1. **`confidence` is passed through unchanged** (D2 §5.1 "probabilities + confidence unchanged"), the top probability only when absent. Why:
   D1's recorded bodies show System One's confidence is NOT the top probability (Jev differs by up to 0.10, MSD1 by 0.094 on T2), so §3's
   "confidence = the top answer's probability" cannot hold for both; (d)'s band should read `probabilities[choice]` (§10.1 "top probability").
2. **A cached result reports `usage: { inputTokens: 0, costUsd: 0 }`** — it made no request of its own (§9 "a cache hit logs nothing").
3. **Usage per HTTP call goes out through `setUsageListener`**, not through `DecisionResult` (§3's result stays as accepted); a split request
   yields one event per call.
4. **The LLM fallback's noul answer must be a JSON boolean** (not "yes" / "true" strings) and score a level's text — "strict parse".
5. **Two helper files beyond §4's table** (`scrub.ts`, `providers/system-one-answers.ts`) — the ~300-line rule; no other layout change.
6. A provider-error's `skipped` why reads `provider error — <scrubbed provider message>`; `skipped` is omitted when empty (a pin).

**Part (b)'s two tests were written red by builder #1 (kept for the record):**
- `src/decision-engine/presets.test.ts` — exactly two presets: `jev` (`system-one`, `https://api.typesafe.ai/v1/systemone`, `jev-1.14.0`,
  `credentialId: 'typesafe'`) and `openrouter-decisions` (`system-one`, `https://openrouter.ai/api/alpha/decisions`,
  `microsoft/microsoft-decision-1`, `credentialId: 'openrouter'`); no key, no OpenAI; `index.ts` re-exports `decisionEngine`,
  `DECISION_PROVIDER_PRESETS`, `DecisionError`.
- `src/decision-engine/decision-engine.test.ts` — the engine through fake providers. **The API it pins** (revise only if (b)'s fixtures force
  it, and say so): `export class DecisionEngine` (+ `export const decisionEngine`); `setSettingsResolver(() => DecisionLadderSettings)`
  (default: `auto` + the default order); `register(config)` — `system-one` without `apiKey` throws, with one registers (`SystemOneProvider`);
  `local-decider` / `llm-fallback` throw "…registerInstance…"; `registerInstance`, `unregister`, `getProviders`, `checkReady(id)`;
  `decide(request, { signal? })` (validate → ladder → per-rung cache → stamp); `decideWith(id, request)`. Behaviour: `calibrated` stamped per
  request AFTER the cache from the SERVED model + `family`; a `provider-error` (or a plain `Error`) moves to the next rung ONCE (a second one
  throws even if a third rung is usable) and appears in `skipped` with a why matching `/provider error/i`; `timeout` (the engine's own budget
  → the provider's signal aborted, or a provider's typed timeout), `invalid-answer` and `refused` never fall back; a pre-aborted caller signal →
  `cancelled` with no provider call; no error message contains the state text.

**Part (c), sub-checkpoint (c1) — `b7b1648` (2026-10-31 10:32), 12 paths, all as of `b7b1648`:**
- `src/main/services/decisions/decision-init.ts` (54) — `registerDecisionProviders(engine, { credentials, openRouterModel, llm })` :35: the
  `image-init.ts:98-117` loop over `DECISION_PROVIDER_PRESETS` (key → `engine.register({ ...preset, model, apiKey })`; the OpenRouter rung
  requests `decisionsOpenRouterModel`); **a missing key → `engine.unregister(id)`** (image-init never unregisters; decisions must, so status
  flips back, §15.3 2); always `registerInstance(new LlmFallbackProvider({ generate, isReady }))`; no local rung. Pure (no I/O).
  `DecisionCredentials` :19, `DecisionLlmDeps` :22.
- `decision-usage.ts` (50) — `decisionUsageEntry` :22 (provider = the preset's `credentialId` — `typesafe` / `openrouter`; `local` →
  `local-decider`; `llm` → `llm`; `requestType: 'decision'`; outputTokens / cacheRead 0; `costUsd` = the event's, i.e. the adapter's reported
  cost else tokens × price), `createDecisionUsageListener(append, now)` :38 (fire and forget; a throwing / rejecting append never throws).
- `decision-settings.ts` (71) — KV `decisionsMode` / `decisionsHostedOrder` / `decisionsOpenRouterModel`; `getDecisionSettings` :40 (a stored
  value not ours → the default; the order filtered to known hosted ids, first occurrence wins), `setDecisionSettings` :51 (the whole patch is
  validated before any write; a default is stored as unset; an empty order is stored), `DEFAULT_DECISIONS_OPENROUTER_MODEL` :14.
- `decision-runtime.ts` (226) — `class DecisionRuntime` :50 with injected deps (`engine`, `readSettings`, `writeSettings`, `readCredentials`,
  `llm`, `appendUsage`, `emit`): `start` :58 (once; installs `setSettingsResolver` + `setUsageListener`, registers; a failed start retries),
  `keysChanged` :88 (re-register; emit `{ type: 'status', status }` only when the status changed), `decide` :100, `status` :105,
  `setSettings` :111 (throws on a refused patch; re-registers when the OpenRouter model changed; always emits), `testKey` :123 (one tiny noul
  pinned to `jev`, `featureSource: 'decision-test'`, 15 s, a fresh state per call so never a cache hit → `DecisionsDecideResponse`);
  `toDecisionsWireError` :38; the singleton half: `onDecisionsEvent` :178, `getDecisionRuntime` :199 (the real deps — credentials, the text
  engine and the usage log imported on first use, the `search-app.ts` way), `ensureDecisions` :219 (the `lazily` initializer),
  `decisionsKeysChanged` :224 (re-register only if the runtime exists). `WHY_DECISIONS_OFF` :23.
- `src/shared/ipc/types/decisions.ts` (70) — `DecisionsDecideRequest` :14 = `{ request }` | `{ test: 'jev' }`, `DecisionsDecideResponse` :23,
  `DecisionsWireError` :17, `DecisionsHostedRungStatus` :26 (`hasKey` boolean, `enabled`, `available`, `why?`), `DecisionsStatus` :42 (`mode`,
  `hostedOrder`, `openRouterModel`, `jev`, `openrouter-decisions`, `local: { state: 'none' }`, `llm`), `DecisionsStatusResponse` :56,
  `DecisionsSettingsSetRequest` :61, `DecisionsEvent` :70. **NOT yet re-exported from `src/shared/ipc/types/index.ts`** — (c2).
- `src/shared/providers/registry.ts` (141 → 155) — `ProviderCapability` + `'decision'` :15, `ProviderTestKind` + `'decision'` :21, openrouter
  capabilities `['image', 'llm', 'stt', 'decision']` :68, the `typesafe` entry :110 (`TypeSafe`, `TypeSafe API key`, `['decision']`, test
  `'decision'`), `decision: 'Decisions'` :144. The renderer's `ProviderKeysTable.tsx:59` offers a test button only for image / video, so the
  TypeSafe row shows NO test button until (f) wires `test === 'decision'` to `decisionsDecide({ test: 'jev' })`.
- `src/shared/types/ai-usage.ts` — `AiFeatureSource` + `decision-agent` / `decision-flow` / `decision-routing` / `decision-test` :19-22,
  `AiRequestType` + `'decision'` :26.
- Tests: `decision-{settings,usage,init,runtime}.test.ts` (72 / 97 / 96 / 177 lines) + `registry.test.ts` (typesafe row, openrouter
  `'decision'`, the label, the union record + `typesafe`, the badge cross-check gains `decision` ← `DECISION_PROVIDER_PRESETS`).

**Decisions builder #3 made (the orchestrator may overrule any):**
1. **The `llm` rung IS logged by `decision-usage.ts`, once, with `provider: 'llm'`** — `llmEngine.generate` writes no usage row (text rows are
   written by their IPC handlers / callers: `llm-handlers.ts`, `rerank.ts`); pinned by a test that scans every non-test `.ts` under
   `src/engine/` for `appendEntry` / `aiUsageService` / `services/ai-usage` (empty). Gap: the engine's usage event carries no text-provider id
   and no output tokens, so the row reads provider `llm`, outputTokens 0 (changing `DecisionCallUsage` would reopen part (b)).
2. **A removed key unregisters its rung** (image-init keeps a stale provider; decisions must flip status back, §15.3 2).
3. **The TypeSafe row's test is `decisions:decide` `{ test: 'jev' }` and tests the SAVED key** — the preload stays at exactly four functions
   and no key rides on any decisions request; the image / video tests send the draft key, this one does not. (f) must save before testing
   (or disable the button until the key is saved).
4. **The status is keyed by rung at the top level** (`status.jev.hasKey` — §15.3 2's own words), plus `hostedOrder`; `local` = `{ state:
   'none', available: false, why: 'no local model' }`; `llm.available` = the text engine has an active provider (and mode `auto`).
5. **Lazy, the library-search way**: nothing at startup; the runtime starts on the first decisions IPC call or the first `decide`;
   `decisionsKeysChanged()` is a no-op until then (first use reads the keys).
6. Status `why` precedence: mode off (`Decisions are off in Settings`) → `no key` → `switched off in Settings` → `not registered`.

## Verified

All from the worktree root, as of `c7ad6da` (logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D4\`):
- RED (09:52, before any source): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/decision-engine` → `Test Files 4 failed
  (4)`, `Tests no tests`, each "Cannot find module './cache' | './calibration-table' | './ladder' | './validate'" (`a-red.log`).
- GREEN (09:55): the same command → `Test Files 4 passed (4)`, `Tests 66 passed (66)` (`a-green-1.log`).
- tsc (09:56): `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit` → **25** errors;
  `-p tsconfig.node.check.json --noEmit` → **10** errors (= the `b2b8a02` baseline; none in a decision file) (`tsc-web-a.log`, `tsc-node-a.log`);
  `tsc -p tsconfig.node.check.json --listFilesOnly` lists all 10 new `src/decision-engine/*.ts` files + `src/shared/types/decisions.ts`.
- House rules (09:57): imports in the 11 files = `../shared/types/decisions`, `./ai-usage`, intra-engine, `vitest` only (no electron, Node,
  fs, features, renderer, studio, asset-library); no `any`, no `export default`; longest file `ladder.test.ts` 213 lines, longest source
  `validate.ts` 178. No key in any file (the tests use none; the (b) test's fake is `sk-test-FAKE-0000`). No hosted call, no app launch.
- (b) RED (09:59): `… vitest.mjs run src/decision-engine` → `Test Files 2 failed | 4 passed (6)`, `Tests 66 passed (66)`; the 2 fail only on
  "Cannot find module './decision-engine'" / "'./presets'" (`b-red.log`). NOTE: while those two files are in the tree without their modules,
  `tsc -p tsconfig.node.check.json` will count their TS2307s above 10 — that is why they are untracked.

Part (b), all from the worktree root (logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D4\`):
- RED (10:10, the three provider test files written, no (b) source): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  src/decision-engine` → `Test Files 5 failed | 4 passed (9)`, `Tests 66 passed (66)`; the 5 fail only on "Cannot find module
  './decision-engine' | './presets' | './llm-fallback-provider' | './system-one-provider'" (`b-red-2.log`).
- GREEN (10:13, as of `ed79420`'s tree): the same command → `Test Files 9 passed (9)`, `Tests 115 passed (115)` (`b-green-1.log`).
- tsc (10:14): `… tsc -p tsconfig.web.check.json --noEmit` → **25** errors (`tsc-web-b.log`); `-p tsconfig.node.check.json --noEmit` →
  **10** (`tsc-node-b.log`); none in a decision file; `--listFilesOnly` lists 24 `decision-engine` files (every .ts incl. the JSON fixtures).
- Contract on D1's recorded bodies: all 4 bodies × 40 rows map to D1's scored `probs` (choice = D1's argmax, every probability to 4 dp) /
  `pTrue` (4 dp), the served model, `usage.input_tokens` (10,858 / 6,087 / 8,241 / 5,728); MSD1 `usage.cost` 0.000346122 / 0.000240576 read
  exactly; Jev cost = 10,858 × $0.042 / M. The transport test sends D1's dry-run state + questions and asserts the parsed body EQUALS
  `{ model, state, questions }` of D1's dry-run body, for both presets (D-r16 (a)).
- Key-pattern scan (10:15) over every fixture: `grep -noE 'sk-[A-Za-z0-9]|sk-or-|[Bb]earer|[A-Za-z0-9+/_=-]{32,}|TYPESAFE|OPENROUTER'
  src/decision-engine/providers/fixtures/*.json | grep -v ':microsoft/microsoft-decision-1-20261009$'` → **empty** (exit 1; the only raw hit
  of the 32-char pattern is the served model id, filtered by name) and `grep -noiE 'api_key|apikey|authorization|x-api-key|password|secret'
  src/decision-engine/providers/fixtures/*.json` → **empty** (exit 1).
- House rules (10:15): imports in the 16 (b) paths = `../shared/types/decisions`, intra-engine, the 3 fixtures, `vitest` only (no electron,
  Node built-in, fs, features, renderer, studio, asset-library, `src/engine`); no `any`, no `export default`; longest source
  `decision-engine.ts` 265 lines, longest test `decision-engine.test.ts` 293. No hosted call, no app launch; the tests' keys are fakes
  (`sk-test-FAKE-…`, `sk-or-v1-FAKE-…`).

Part (c1), all from the worktree root (logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D4\`):
- RED (10:28, the 4 service tests + the registry edits, no (c) source): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  src/main/services/decisions src/shared/providers/registry.test.ts` → `Test Files 5 failed (5)`, `Tests 4 failed | 2 passed (6)`; 4 files fail
  only on "Cannot find module './decision-init' | '…/decision-runtime' | '…/decision-settings' | './decision-usage'", the registry file on its 4
  new / changed assertions (`c-red.log`).
- GREEN (10:30): the same command → `Test Files 5 passed (5)`, `Tests 32 passed (32)` (`c-green-1.log`).
- Related suites (10:31): `… vitest.mjs run src/decision-engine src/features/ai-models src/shared src/main/services/decisions` → `Test Files
  1 failed | 100 passed (101)`, `Tests 1 failed | 958 passed (959)`; the 1 red = `src/shared/tsx-engine/builder-libraries.test.ts`
  ("@remotion/paths (builder-libraries.ts) is not installed" — the known E-d2a worktree-only package-resolution suite, DRIVING.md:186; it
  touches no file of this part) (`c-green-2.log`).
- tsc (10:30): `… tsc -p tsconfig.web.check.json --noEmit` → **25** (`tsc-web-c1.log`); `-p tsconfig.node.check.json --noEmit` → **10**
  (`tsc-node-c1.log`); no error names a decision / registry / ai-usage / ipc-types file.
- House rules (10:31): imports of the 9 new files = `decision-engine` (+ `/ladder`), `shared/types/{decisions,ai-usage}`,
  `shared/ipc/types/decisions`, `../settings-db`, intra-`decisions/`, `fs` / `path` / `vitest` in tests; dynamic imports in
  `getDecisionRuntime` only (`../settings`, `../../../engine/llm-engine`, `../ai-usage`); none from studio / asset-library / renderer /
  features; no `any`, no `export default`; longest source `decision-runtime.ts` 226, longest test 177. Key scan over the new files: only
  `sk-test-FAKE-…` / `sk-or-v1-FAKE-…`. No hosted call, no app launch.

## Next step

Part (c2) — red first, then commit and mark (c) DONE: (1) a red `src/preload/api/decisions.test.ts` (mock `electron`'s `ipcRenderer`;
`Object.keys(decisionsApi)` is EXACTLY `decisionsDecide`, `decisionsStatus`, `decisionsSettingsSet`, `onDecisionsEvent`, each on its channel;
`src/preload/preload.ts`'s source spreads `...decisionsApi`; the text of `src/shared/ipc/types/decisions.ts` names no key field) and a red
`src/main/ipc/decisions-handlers.test.ts` (the library-search-handlers.test.ts shape: mock `../services/decisions/decision-runtime`;
`{ test: 'jev' }` → `runtime.testKey()`; a `request` whose `featureSource` is not `decision-test` / `decision-flow` → `invalid-request` with no
decide; a throwing runtime → `{ ok: false, error }` never a rejected invoke; status failure → every rung unavailable + `error`; settings
failure → the unchanged status + `error`; a fake key in a thrown message never comes back); (2) then: channels `DECISIONS_DECIDE:
'decisions:decide'`, `DECISIONS_STATUS: 'decisions:status'`, `DECISIONS_SETTINGS_SET: 'decisions:settings:set'`, `DECISIONS_EVENT:
'decisions:event'` beside `LIBRARY_SEARCH_*` in `src/shared/ipc/channels.ts` (654 lines → record after); `export * from './decisions'` in
`src/shared/ipc/types/index.ts`; `src/main/ipc/decisions-handlers.ts` (handlers over `getDecisionRuntime()`, wire errors via
`toDecisionsWireError`); `src/main/ipc/registrations/decisions.ts` (`lazily(ensureDecisions, …)` ×3 + `onDecisionsEvent` broadcast to every
`webContents` — copy `registrations/library-search.ts`), exported from `registrations/index.ts` and called in `register.ts` after
`registerLibrarySearchIpc()`; `src/preload/api/decisions.ts` (`decisionsApi`, copy `api/library-search.ts`) + `api/index.ts` + `...decisionsApi`
in `src/preload/preload.ts`; the four lines in `src/renderer/types/electron.d.ts` beside `librarySearch*` (656 lines → record after);
`await decisionsKeysChanged()` in `handleProviderKeysSave` after `initSttEngine()` (`src/main/ipc/provider-keys-handlers.ts:68`). D2 §12 names
the preload `src/preload/api/decisions.ts` — that IS where this codebase's preload modules live (not `src/shared/ipc/preload.ts`, a 2-line stub).

## Open problems

1. **For the orchestrator:** confirm decision 1 (rung id `openrouter-decisions`, no `openai` in the union) and decision 4 (the served snapshot
   `microsoft/microsoft-decision-1-20261009` is a calibrated row). A verifier reading §15.1 literally ("true for exactly … (`openrouter`,
   `microsoft/microsoft-decision-1`, …)") may count 6 rows as a deviation — the test file's header states why.
2. `docs/studio/decisions/ORCHESTRATOR.md` was already modified in the working tree when builder #1 started (not this builder's edit) — left
   unstaged in every commit.
3. (b) will need `typesafe` in `PROVIDER_REGISTRY` only in (c): the presets use the local `DecisionCredentialId`, so (b) does not depend on it.
4. Decision 1 above was RESOLVED by D-r17 (10:02); decision 4 likewise. Builder #2's decisions 1–6 (part (b)) await the orchestrator — the
   one that shapes §15 is #1 (`confidence` unchanged; (d)'s band reads `probabilities[choice]`).
5. The usage event's `provider` is the RUNG id (`jev` / `openrouter-decisions` / `llm`); (c) maps it to the key's registry id for the usage
   row (`typesafe` / `openrouter`, D-r17 (1)). Whether the `llm` rung writes its own row is (c)'s call — the text engine may already log its
   call (check `ai-usage.ts` before double-logging). → SETTLED in (c1), builder #3 decision 1 (the text engine logs nothing; the llm row is
   written once by decision-usage, provider `llm`).
6. **For the orchestrator (builder #3's decisions 1–6, (c1)):** the one that shapes §15 is #3 — the TypeSafe key test tests the SAVED key via
   `decisions:decide { test: 'jev' }` (no 5th preload function, no key on any decisions request); (f) must save first. Also #1's gap: the llm
   rung's usage row has provider `llm` and outputTokens 0.
7. `docs/studio/decisions/ORCHESTRATOR.md` is still modified in the working tree (not this builder's edit) — left unstaged in `b7b1648` and the
   docs commit.

## Do-not-redo

- The tsc baseline at `b2b8a02` is measured (web 25 / node 10).
- Part (a) is DONE at `c7ad6da` — validate / ladder / calibration-table / cache and the contract; change them only with a test that says why.
- The served-model question for the calibration table is decided and tested (decision 4) — do not re-litigate without the orchestrator.
- Part (b) is DONE at `ed79420` — the engine class, presets, index, both providers, scrub, the fixtures + their key scan. Do not re-copy D1's
  bodies; (e) reuses `providers/fixtures/` for the shape tests and copies only `t2-routing.json` / `t3-verify.json` + the answer files it
  needs for the replay.
- Part (c1) is committed at `b7b1648` — `src/main/services/decisions/decision-{init,usage,settings,runtime}.ts` + tests, the registry entry /
  capability / label, the ai-usage unions, `src/shared/ipc/types/decisions.ts`. (c2) builds ON them (the handlers call `getDecisionRuntime()`;
  `ensureDecisions` / `onDecisionsEvent` / `decisionsKeysChanged` / `toDecisionsWireError` already exist) — do not rewrite them.
- The text engine does not log usage (scanned, test in `decision-usage.test.ts`) — do not add a skip for the `llm` rung.

## Agents so far

- 2026-10-31 09:46–10:00 · D4 builder #1 · ~34 tool calls · part (a) red → green → `c7ad6da`; part (b) red-first tests (engine + presets),
  untracked; HANDOFF + LOG.
- 2026-10-31 10:03–10:17 · D4 builder #2 · ~45 tool calls · part (b): provider tests red → engine + presets + providers green → `ed79420`;
  HANDOFF + LOG.
- 2026-10-31 10:20–10:35 · D4 builder #3 · ~50 tool calls · part (c) sub-checkpoint (c1): 4 service tests + registry edits red → services +
  registry + wire types green → `b7b1648`; HANDOFF + LOG → (c2).

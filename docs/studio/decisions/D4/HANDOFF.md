# D4 — THE BUILD: the shared decision engine (D2 §14 (a) → (h))
status: HANDOFF — **D4 builder #8, 2026-10-31 17:22: part (f) steps 1–4 BUILT and committed (code + tests green, tsc at baseline); step 5 (the
worktree's own build + the two CDP stills on profile `decisions-D4`) is NOT done — it is the Next step.** Builder #7's leftovers were judged
and kept (one fix: the tester's 30 s budget) → sub-checkpoint (f1) `cc754fa`; the UI (Settings › General "Decisions" row, AI → Providers
"Decisions" section with the TypeSafe Test button, the dev-preview tester, the `p` handle hidden) → (f2), see "Done". Previous status (orchestrator
17:03): D4 builder #7 (part (f)) was INTERRUPTED by the session's end (~11:50) and never handed back.
Its work was UNCOMMITTED and UNVERIFIED in the tree (modified: `src/features/flows/components/CustomNode.tsx`,
`src/main/services/agents/tools/decide-outcome.ts`, `decide-run.ts`, `src/shared/types/flows.ts`; new: `src/features/ai-models/services/
decision-providers{,.test}.ts`, `src/features/flows/services/port-visibility{,.test}.ts`, `src/main/services/agents/tools/decide-shared-pins.test.ts`,
`src/shared/decisions-{outcome,tester-form,view}.ts` + `decisions-{tester-form,view}.test.ts`; written 11:47–11:49 — tests + helpers only, no UI
component yet, no build, no profile). **The next builder's FIRST job:** `git diff` + read those files, run their tests and the suites they touch
(`agents/tools/decide*`, `flows`) and tsc; keep what is green and fits D2 / the rulings (it looks like the band / text moved to `src/shared/` so the
renderer can reuse it, and a record-only port hide for D-r22 (2)), fix or drop the rest, commit a green sub-checkpoint, THEN continue part (f)
below. Previous status: HANDOFF (D4 builder #6, 2026-10-31 11:38) — **part (e) DONE at `5605c48`** (the committed benchmark: D1's 4 recorded answer files
scrubbed + the tree's scorer + the replay = `c-hosted.md` §2 cell for cell; the gated live test (SKIPPED without `VIDTSX_DECISIONS_LIVE=1`,
never run by a builder) + its dry run on the recorded bodies; the D-r21 dev stub hook; 5 test files = 38 passed + 2 skipped after a red run;
related suites 86 files / 703 tests + 1 skipped file; tsc web 25 / node 10); the verifier's launcher
`D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D4\live-test.sh` written, `bash -n` only. **Part (f) is next** (the Settings row + the
Providers "Decisions" section + the dev tester). Part (d) DONE at `feb5e69`; part (c) DONE: (c1) `b7b1648` + (c2) `d9ec730`; part (b) DONE at
`ed79420`; part (a) DONE at `c7ad6da`.
Earlier: D4 builder #5 11:16 — (d); D4 builder #4 10:45 — (c2); D4 builder #3 10:34 — (c1); orchestrator 09:44 —
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
| (c) | `src/main/services/decisions/` (decision-init from credentials like `image-init.ts`, decision-usage, decision-settings, decision-runtime); registry `typesafe` + `'decision'` capability + label; `openrouter` gains `'decision'`; IPC (§12) + preload + status; the preload-surface test | **DONE** — (c1) services + registry + wire types; (c2) IPC + preload + key-save hook + the preload-surface test | (c1) `b7b1648`, (c2) `d9ec730` |
| (d) | `src/main/services/agents/tools/decide.ts` (tool + flow node via `ports`) + `check_matches_request` + `route_request`; T2 / T3 unit tests through an injected provider; the no-claim test | **DONE** | `feb5e69` |
| (e) | `src/main/services/decisions/benchmark/` — fixtures (T2 / T3 + the recorded Jev / MSD1 answers), the tree's scorer, the replay test (= `c-hosted.md` §2), the calibration-table test, the gated live test (skipped unless `VIDTSX_DECISIONS_LIVE=1`); **+ the dev-only stub hook of ruling D-r21** (`VIDTSX_DECISIONS_JEV_URL` / `VIDTSX_DECISIONS_OPENROUTER_URL`, honoured only unpackaged + loopback; unit-tested) — (h) and the verifier need it for §15.3 1 / 3 / 4 / 5 | **DONE** (live test written + dry-run-proven, NOT run — DEFERRED-HASAN / the verifier) | `5605c48` |
| (f) | Settings › General "Decisions" row + the Providers "Decisions" section + the dev-preview tester (UI_SPEC.md) | **IN PROGRESS** — steps 1–4 built + tested (f1 + f2); step 5 (build + CDP stills) TODO | (f1) `cc754fa`, (f2) `8f6ff6f` |
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

**Part (c), sub-checkpoint (c2) — `d9ec730` (2026-10-31 10:43), 15 paths, all as of `d9ec730`:**
- `src/shared/ipc/channels.ts` (**654 → 660** lines) — `DECISIONS_DECIDE: 'decisions:decide'` :612, `DECISIONS_STATUS`, `DECISIONS_SETTINGS_SET`,
  `DECISIONS_EVENT` (push) right after `LIBRARY_SEARCH_EVENT`. `src/shared/ipc/types/index.ts` (58 → 59) — `export * from './decisions'`.
- `src/main/ipc/decisions-handlers.ts` (110) — `handleDecisionsDecide` :67 (envelope not an object → `invalid-request`; **`'test' in envelope`
  → only `test === 'jev'` is read → `getDecisionRuntime().testKey()` with no argument**, any request / key riding along ignored (D-r19 (1)); a
  free-form `request` must carry `featureSource` ∈ `RENDERER_FEATURE_SOURCES` :24 = `decision-test` | `decision-flow`, else `invalid-request`
  with no call; then `runtime.decide(request)` — the engine validates on its own clean copy), `handleDecisionsStatus` :88 (`return await`; a
  failure → `unavailableStatus` :40 = mode `auto`, the default order, both hosted rungs `hasKey: false` / `available: false` / `why` = the
  error, `local: { state: 'none' }`, `llm.available: false`, `error`), `handleDecisionsSettingsSet` :96 (a refused patch → the unchanged status
  + `error`; if the status fails too → `unavailableStatus`); `wireError` :29 = `toDecisionsWireError` then `scrubDecisionText(message, [])`
  (masks `Bearer …` / `sk-…` — defence in depth over the engine's own scrub; the status `error` is masked the same way).
- `src/main/ipc/registrations/decisions.ts` (31) — `registerDecisionsIpc` :21: the three request channels `lazily(startDecisionsQuietly, …)`
  (:11 — wraps `ensureDecisions` and SWALLOWS a failed start, because `lazily` would otherwise reject the invoke before the handler's try/catch;
  the handler's own runtime call retries `start()` inside its try/catch and answers typed) + `onDecisionsEvent` → `contents.send(
  IPC.DECISIONS_EVENT, event)` to every non-destroyed `webContents`. Exported from `registrations/index.ts` (37 → 38); called in
  `src/main/ipc/register.ts` :98 right after `registerLibrarySearchIpc()` (101 → 103 lines).
- `src/preload/api/decisions.ts` (29) — `decisionsApi` :17 = exactly `decisionsDecide` / `decisionsStatus` / `decisionsSettingsSet` /
  `onDecisionsEvent`; `decideEnvelope` :13 rebuilds `{ test }` or `{ request }` from the known fields only (a smuggled key never crosses).
  `src/preload/api/index.ts` (47 → 48) re-exports it; `src/preload/preload.ts` (108 → 110) imports it :45 and spreads `...decisionsApi` :97.
- `src/renderer/types/electron.d.ts` (**656 → 661** lines) — the comment + the four declarations from :648, right after `onLibrarySearchEvent`.
- `src/main/ipc/provider-keys-handlers.ts` (83 → 91) — `await decisionsKeysChanged()` :73 after `initSttEngine()`, in its own try/catch (a
  decisions failure logs a fixed warning — no message, so no key — and never fails the save: the keys ARE saved).
- Tests (red first): `src/preload/api/decisions.test.ts` (108 — the four names; the IPC table's `DECISIONS_*` / `decisions:*` entries are exactly
  the four; the key test sends only `{ test: 'jev' }` and an extra envelope field with a fake key is dropped; status / settings:set channels;
  the event subscribe / unsubscribe; `preload.ts` spreads it, `api/index.ts` re-exports it; `electron.d.ts` declares exactly the four; only
  `api/decisions.ts` uses a `DECISIONS_` channel in the preload; no key-carrying field name in `shared/ipc/types/decisions.ts` or the preload
  module), `src/main/ipc/decisions-handlers.test.ts` (167 — test mode, other rung id, the free-form path per feature source, malformed
  envelopes, DecisionError code kept, plain throw → `provider-error`, an unbuildable runtime, status failure, settings refused / both failing,
  a fake key never comes back), `src/main/ipc/registrations/decisions.test.ts` (74 — exactly three handles and nothing built at registration;
  first call starts; a failed start still answers typed; the push reaches live windows only), `src/main/ipc/provider-keys-handlers.test.ts`
  (78 — save / removal both reach `decisionsKeysChanged` AFTER image / video / audio / llm / stt; its failure keeps `success: true`, no key
  logged).

**Decisions builder #4 made (the orchestrator may overrule any):**
1. **The renderer's free-form `decisions:decide` accepts only `featureSource` `decision-test` (the dev tester) or `decision-flow` (the canvas
   preview)**; `decision-agent` / `decision-routing` / any other source / none → `invalid-request` with no call. Why: §12 names exactly those two
   renderer callers, and the usage log's `featureSource` column (§9, §15.3 4) must not be claimable from the window. **The verifier's §15.3 1
   stub run (20 concurrent `decisionsDecide`) must send `featureSource: 'decision-test'`.**
2. **A failed first-use start never rejects the invoke** — `startDecisionsQuietly` swallows it and the handler answers typed (library search's
   registration would reject here; the house rule "every handler … returns typed errors" wins).
3. **The preload rebuilds the decide envelope** from `test` / `request` (an extra envelope field never crosses); `decisionsSettingsSet` passes
   its patch through (main's `setDecisionSettings` validates the whole patch). The `request` object itself is passed as given — the engine's
   `validateDecisionRequest` works on a clean copy, so an extra field inside it never reaches a provider.
4. **A decisions re-register failure in the key save is logged and swallowed** (the keys are saved; image / video / llm init failures still fail
   the save as before — unchanged).
5. Wire / status error messages pass `scrubDecisionText(…, [])` (bearer + `sk-…` masks) in the handler — the engine already scrubs with the
   real key; this covers non-engine throws (settings DB, credential store). A key of another shape in such a throw is not masked (none is known
   to carry one).

**Part (d) — `feb5e69` (2026-10-31 11:15), 14 paths, all as of `feb5e69`:**
- `src/main/services/agents/tools/decide.ts` (116) — `decideTool` :48: zod args `state`, `type` (`choice` | `noul`), `instructions`, `options?`
  (record or one `id: description` per line), `family?` (default `other`), + the common `threshold?` / `provider?` / `allowUncalibrated?`;
  ports: input `state`; outputs = `DECIDE_OUTPUTS`; config `type`, `instructions`, `options`, `threshold`, `provider`, `family`,
  `allowUncalibrated`; a choice with < 2 distinct options → `TOO_FEW_OPTIONS`, no call; a noul goes out WITHOUT criteria (the caller frames,
  D-r16 (d); the OpenRouter adapter adds its own).
- `decide-run.ts` (140) — `runDecision` :84 (the one call path: lazy `import('../../decisions/decision-runtime')` → `getDecisionRuntime().decide(
  { state, questions: { decision: question }, provider, featureSource, allowUncalibrated, family }, { signal: ctx.signal })` → outcome → `{ content:
  [decisionText], fields: { band, answer, p?, note? } }`; any throw → `decisionErrorText`, `isError`), `decisionFeatureSource` :76 (`flows` →
  `decision-flow`, else `decision-agent`), `DECIDE_PROVIDERS` :15 (auto / jev / openrouter-decisions / llm — no local), `DECIDE_OUTPUTS` :36
  (`band` text `field:band` FIRST, `answer` text, `p` number `field:p`), `DECIDE_COMMON_FIELDS` / `_DEFAULTS` / `decideCommonSchema`,
  `parseDecisionOptions` :120, `TOO_FEW_OPTIONS`.
- `decide-outcome.ts` (69) — `decisionOutcome` :35 (D-r18), `decisionText` :45 (§10.1's shapes + `(act — uncalibrated)` + `uncertain — no
  answer (escalate)` for a refusal), `DECISION_ERROR_SENTENCES` :51 (one per `DecisionErrorCode`, no digit), `decisionErrorText` :63 (duck-typed
  `code`; unknown → provider-error; never the engine's message).
- `check-matches-request.ts` (99) — `CHECK_MATCHES_STATE` :11 (D1's T3 rule verbatim), `CHECK_MATCHES_CRITERIA` :16 (`NOUL_T3` verbatim),
  `checkMatchesQuestion` :33 (D1's per-kind header + the item + `Request:` / `Script line:` + `JSON.stringify(request)`; kinds `item` (default:
  "Does this item do what the request asks?") / `template` / `caption` / `clip`), `checkMatchesRequestTool` :51 (inputs `item`, `request`; family
  `verify`).
- `route-request.ts` (96) — `DEFAULT_ROUTE_SUBJECT = 'tool family'` :22, `defaultRoutingRule` :25, `routeQuestion` :32 ("Which ONE <subject>
  must act on this request? Request: <JSON>"), `routeRequestTool` :53 (input `request`; config `options`, `subject`, `rule` (sent VERBATIM when
  not blank), common; family `routing`).
- `registry.ts` — imports + `registerTool(decideTool | checkMatchesRequestTool | routeRequestTool)` at the end; `src/shared/agents/tool-ids.ts`
  — the three ids appended to `AGENT_TOOL_IDS` (append-only). `STUDIO_TOOL_IDS` untouched.
- Fixtures `src/main/services/decisions/benchmark/fixtures/`: `t2-routing.json` + `t3-verify.json` (byte copies of D1's, `cmp` identical) and
  `d1-dry-run-t2-t3.json` (68 KB — D1's Jev T2 / T3 dry-run bodies' `state` + `questions`, model dropped; built by
  `C:\Users\hasan\AppData\Local\Temp\claude\d--repos-VidTSX-STUDIO\d49810c3-af6a-4487-806f-0a54cc0c7f22\scratchpad\make-dryrun-fixture.cjs`
  from `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D1\hosted-dryrun\jev-t{2-choice,3-noul}.json`; one body of 40 questions each; MSD1's
  dry-run bodies carry the SAME state + questions — checked).
- Tests: `decide.test.ts` (223 — request shape, both featureSources, canvas option lines, noul without criteria, < 2 options, band over both
  bands, confidence ignored, noul `max(p, 1 − p)`, threshold, uncalibrated ± allow, refused, every error code, ports + `mapOutputs`, the
  description), `decide-builtins.test.ts` (156 — the REAL `DecisionEngine` + `SystemOneProvider` with a fake `fetch` and a fake key: every T3 row's
  and every T2 row's HTTP body has `state` + the ONE question EQUAL to D1's dry-run body (`toEqual` on type + instructions + criteria), family
  verify / routing, featureSource, the band on the fake answers; the canvas-lines form; the default rule), `decide-no-claim.test.ts` (133 — every
  T3 row × 2 bands × 2 tools (160 texts), every T2 row × 2 bands × 2 tools, uncalibrated ± allow, refused, every error code × 3 tools, the
  descriptions); `registry.test.ts` (the three in `NODE_TOOLS`, primary output `band`, registered but absent from `STUDIO_TOOL_IDS`).

**Decisions builder #5 made (the orchestrator may overrule any):**
1. **The no-claim strings are matched as WHOLE WORDS (`\bcertain\b`, `\bsure\b`, `\bmatch\b`, …) plus `%` anywhere and no digit at all** —
   D2 §10.1's own escalate text is "Decision: uncertain — top answer billing (escalate)", which a substring test for `certain` would fail; the
   brief mandates that exact text. The verifier must read §15.1's list as words (`uncertain` is the hedge, not a claim).
2. **`p` is a third output PORT (`number`, `field:p`)** — the flow runner files ONLY port values in `run.json` (`flow-args.ts` `mapOutputs` →
   `FlowNodeRunState.outputs`), so a port is the only way §15.3 3's "the run record holds `p`" can hold without changing the runner. The band is
   `outputs[0]`, the only output the canvas previews (`CustomNode.tsx` OutputPreview / `StepsStrip.tsx` read `outputs[0]`), so the canvas shows the
   band only; but the node DRAWS a `p (run record)` handle (no value shown) that a flow author could wire to a number input or declare as a flow
   output (then `RunOutputs.tsx` would show the number). Hiding it needs a `PortDef` flag + a renderer filter — (f)'s call, not done here.
3. **`p` = the top answer's probability** (the gate's quantity: choice `probabilities[choice]`; noul `max(p, 1 − p)`), not P(true) — so
   `p ≥ threshold` ⇔ act (when calibrated) reads straight off the run record.
4. **`allowUncalibrated` lifts only the calibration requirement — the threshold still applies** (uncalibrated + allow + top < threshold →
   escalate). D2 §10.1 / the brief read "then act"; a gate that acts on an uncalibrated 0.4 would defeat its purpose (the LLM fallback's chosen
   answer is 1.0, so it always acts when allowed). It is also passed to the request (`allowUncalibrated`), so `auto` may end at the LLM rung.
5. **A refused answer → `escalate`, answer '', no `p`** (text "Decision: uncertain — no answer (escalate)"); an engine ERROR → `isError` + one
   fixed sentence per code (no number, never the engine's message) — in a flow that fails the node, as any tool error does.
6. **`route_request` has an optional `subject` (default D1's "tool family")** so the default question IS D1's measured "Which ONE tool family must
   act on this request? …"; a flow routing to teams sets `subject: team`. The default rule: "You route a request to the ONE <subject> that must act
   on it: a (…), b (…), or c (…)." A given `rule` is sent verbatim (not trimmed).
7. **`check_matches_request`'s `itemKind`** (`item` default / `template` / `caption` / `clip`) picks D1's T3 header and request label; the
   `item` input is D1's item line as is (e.g. `Template "App Launch Teaser": …`). The `caption` header says "match" — it is in the request to the
   decider, never in the agent's text.
8. **Not `priced`, no `needs`** on the three nodes (no `'decision-provider'` need exists; costs are < $0.012 / 1,000 decisions) — (f) may add a
   price hint. Node category `text` (there is no `decision` category).
9. A test-harness lesson: `beforeEach(() => fn.mockReset())` RETURNS the mock, and vitest calls a function returned from `beforeEach` as a
   teardown — with a throwing implementation that fails the test with the mock's own error. Use a block body.

**Part (e) — `5605c48` (2026-10-31 11:37), 19 paths, all as of `5605c48`:**
- `src/main/services/decisions/benchmark/fixtures/hosted-{jev,openrouter-msd1}-t{2-choice,3-noul}.json` — D1's four recorded answer files,
  SCRUBBED by `C:\Users\hasan\AppData\Local\Temp\claude\d--repos-VidTSX-STUDIO\d49810c3-af6a-4487-806f-0a54cc0c7f22\scratchpad\make-answer-fixtures.cjs`
  to `format`, `candidate`, `task`, `mode`, `probability`, `requests[{requestId, latencyMs, questions, phase, model (served)}]`,
  `answers[{id, probs}]` / `[{qid, pTrue}]` (dropped: createdAt, notes, env, status, usage, error, per-answer requestId).
- `benchmark/types.ts` (123) — `T2Fixture` / `T3Fixture` rows, `ChoiceAnswerFile` / `NoulAnswerFile`, `GroupMeasures` (D1's + `right`),
  `BenchmarkScore`. `benchmark/measures.ts` (135) — D1's `measures.cjs` ported exactly: `binOf` :17 (`floor(10·p + 1e-9)`, max 9),
  `reliability` :22 (ECE), `binaryMeasures` :56, `normalise` :73, `topOf` :80 (ties → option order, off-list after), `choiceMeasures` :88
  (top-label + multiclass Brier, off-list), `quantile` :115 (nearest rank), `latency` :122. `benchmark/score.ts` (86) — `scoreChoiceAnswers`
  :30 / `scoreNoulAnswers` :48 (D1's `score.cjs` groups: ALL / Arabic / English + T3's template / caption / clip; pTrue clamped; probs
  renormalised, `maxProbSumDeviation`), `c2Cells` :74 (one §2 row's cells, formatted `(100·x).toFixed(1)` / `toFixed(3)` as score.cjs).
- `benchmark/live-requests.ts` (54) — `buildLiveBenchmarkRequests(t2, t3)` :39: T2 = D1's T2 rule verbatim as `state` + 40 `choice`
  questions `routeQuestion(DEFAULT_ROUTE_SUBJECT, row.request)` with the families' meanings as criteria; T3 = `CHECK_MATCHES_STATE` + 40
  `noul` questions `checkMatchesQuestion(kind, item, request)` with `CHECK_MATCHES_CRITERIA`; D1's keys (`t2_01` …); family routing / verify.
- `benchmark/live-run.ts` (171) — `LIVE_KEY_ENV` :18, `LIVE_MAX_REQUESTS = 4` :24, `isLiveBenchmarkEnabled` :28 (exactly `'1'`),
  `createRequestCap` :33 (past the cap a call throws without reaching the network), `runLiveBenchmark` :110 (refuses a blank / unset key
  before any request; a fresh `DecisionEngine` + `registerDecisionProviders` with that key only; T2 then T3, pinned, `featureSource:
  'decision-test'`, family set, 15 s; latency = wall ms of `engine.decide`; each set scored by `score.ts`) → `LiveProviderResult` (numbers,
  served model, `calibrated`, error code — never a key, header or state).
- `benchmark/live-bar.ts` (82) — `LIVE_BAR` :10, `liveBarViolations` :18 (≥ 38 / 40, Brier ≤ 0.05, 0 off-list, 0 errors, Jev ≤ 2,000 ms every
  request, MSD1 ≤ 4,000 ms with its first call — T2 — excluded; empty = PASS; no result at all → a violation), `liveResultJson` :62
  (`vidtsx-decisions-live/1`: bar,
  requests, per provider × set the whitelisted fields, verdict, violations).
- Tests: `score.test.ts` (100 — THE REPLAY: the 4 T2 / T3 rows of `c-hosted.md` §2 copied verbatim, parsed, compared cell for cell with
  `c2Cells`; headline numbers; 16 / 10 / 14 kinds; D1's latencies; each served model calibrated for its family, not `other`, never `llm`),
  `measures.test.ts` (61 — bins, ECE, missing answers, ties, off-list, multiclass, normalise, quantiles), `live-dry-run.test.ts` (139 — the
  gate; bodies EQUAL D1's dry-run bodies; both providers on the RECORDED bodies via a stub fetch: 40 / 40 × 2, the replay's Brier, 1 HTTP call
  per set, preset URL + `Bearer <fake>`, bar empty; MSD1 first call excluded / Jev not; key refusal with no request; the cap; a 401 → errors;
  the result JSON whitelist), `live.test.ts` (51 — `describe.skipIf(!isLiveBenchmarkEnabled(process.env))`; one shared 4-request cap over the
  real `fetch`; per provider `runLiveBenchmark` → `liveBarViolations` = []; `afterAll` writes `liveResultJson` to `$VIDTSX_DECISIONS_LIVE_OUT`
  else the OS temp dir and logs the path only).
- The D-r21 stub hook: `src/main/services/decisions/decision-init.ts` (54 → 109) — `DecisionBaseURLs` :28, `DECISION_STUB_URL_ENV` :40,
  `resolveDecisionStubURLs` :69 (pure; `isPackaged` / `env` / `log` / `warn` injected; honoured only unpackaged + `http:` + host `127.0.0.1` /
  `localhost`, no userinfo; one warning per ignored variable naming the variable, never the URL; one `decisions: dev stub URL in use for <rung>
  (<host:port>)` line per rung), `registerDecisionProviders` :87 takes `baseURLs` (a stubbed `openrouter-decisions` keeps
  `noulCriteriaRequired: true`). `decision-runtime.ts` (226 → 253) — dep `resolveBaseURLs?` :42, resolved ONCE in `register()` (:89-95; a
  failure → the presets' URLs), `getDecisionRuntime` (:231) resolves via `await import('electron')` `app.isPackaged` (no app → treated as packaged),
  `process.env`, `console.log` / `console.warn`. **Part (b) touched (+6 lines, decision 9 below):** `src/decision-engine/types.ts`
  `DecisionProviderConfig.noulCriteriaRequired?` :92, passed by `decision-engine.ts` `register` :150. Test: `decision-init-stub.test.ts` (132 —
  unpackaged + loopback used / packaged ignored / 6 non-loopback-or-malformed ignored / unset silent; registration per rung with the OpenRouter
  shape kept; the runtime resolves once across start + keysChanged).
- Kit (not in git): `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D4\live-test.sh` — hosted-live.sh's sourcing block VERBATIM (lines 8–15 =
  its 4–11), then `VIDTSX_DECISIONS_LIVE=1`, `VIDTSX_DECISIONS_LIVE_OUT` (default
  `C:/Users/hasan/AppData/Local/vidtsx-e2e/decisions/D5/live-result-<stamp>.json`), `cd` the worktree, `exec node …/vitest.mjs run
  src/main/services/decisions/benchmark/live.test.ts "$@"`. Not executed.

**Decisions builder #6 made (the orchestrator may overrule any):**
1. **MSD1's "first call excluded" = its T2 request** (sent first; D1's cold 2,983 ms call was T2 too): recorded (`firstCall: true`), not judged;
   its T3 is judged ≤ 4,000 ms; Jev's T2 and T3 are both judged ≤ 2,000 ms. With one request per set, "p95 per request" IS each request. No
   warm-up request (it would break ≤ 4 requests).
2. **Latency = the wall ms of the product call** (`engine.decide`, incl. a retry if one happens), not the bare HTTP round trip.
3. **A hard 4-request cap inside the live test** (`createRequestCap`): the adapter's one retry on 429 / 5xx could otherwise make a 5th; a
   capped call never reaches the network, and its set counts as an error (bar fails).
4. **The live requests use the built-ins' own framing functions** (not the dry-run JSON), packed 40 per request with D1's keys, through
   `registerDecisionProviders` (the product registration) — and the dry run pins both bodies EQUAL to D1's dry-run bodies (D-r16 (c)).
5. **The replay compares EVERY T2 / T3 cell of §2** (accuracy, Arabic, Brier + multiclass note, ECE, 3 selective, off-list), parsed from the
   verbatim rows embedded in the test — MSD1's ECE 0.044 / 0.013 included. T1 rows are not in the product benchmark (§15.1).
6. **No new calibration-table test** — `src/decision-engine/calibration-table.test.ts` (part (a)) already pins D-r17's six rows exactly and false
   for every other triple / `llm` / `other`; `score.test.ts` only ties the replay to it (each recorded file's served model).
7. **The stub URLs are resolved once, at the runtime's first start** (the first decisions use), so the env must be set when the app is
   LAUNCHED; a key change re-registers with the same URLs and logs nothing again.
8. **A key refusal** throws before any request; in `live.test.ts` that provider's case fails and is filed `refused: true` in the result JSON;
   the other provider still runs.
9. **`DecisionProviderConfig.noulCriteriaRequired?` (part (b)'s types + engine, +6 lines):** the adapter detects OpenRouter by HOST, so a
   127.0.0.1 stub URL would silently drop OpenRouter's required noul criteria — the stub would then not see the "OpenRouter shape" §15.3 5 names.
   Main sets it `true` for a stubbed `openrouter-decisions` only; real URLs are unchanged (host detection as before; every `src/decision-engine`
   suite passes in the related run below).

**Part (f), sub-checkpoint (f1) — `cc754fa` (2026-10-31 17:17), 14 paths = builder #7's leftovers, JUDGED (all kept; one fix):**
- KEPT — `src/shared/decisions-outcome.ts` (40): `decisionOutcome` / `DecisionBand` / `DecisionGate` / `DecisionOutcome` moved here VERBATIM from
  `decide-outcome.ts` so the renderer's tester bands with the same function; `src/main/services/agents/tools/decide-outcome.ts` (69 → 41) now
  re-exports them (`decisionText`, `DECISION_ERROR_SENTENCES`, `decisionErrorText` unchanged). **Part (d)'s behaviour is unchanged: `decide.test.ts`,
  `decide-no-claim.test.ts`, `decide-builtins.test.ts` pass UNCHANGED** (not edited by #7 or me). New pin file `decide-shared-pins.test.ts` (26): the
  tool's band function IS the shared one, the tester's threshold = `DEFAULT_DECIDE_THRESHOLD`, `p` is the only record-only output.
- KEPT — D-r22 (2), the `p` handle hidden: `src/shared/types/flows.ts` `PortDef.recordOnly?` (+2 lines), `decide-run.ts` `DECIDE_OUTPUTS` `p` gets
  `recordOnly: true` (1 line), `src/features/flows/services/port-visibility.ts` (8, `drawnPorts`) + test, `CustomNode.tsx` (+5 / −2: draws
  `drawnPorts(spec.outputs)`, min height from the drawn count) — 16 source lines in all, under D-r22's ~20. The flow runner is untouched
  (`flow-args.ts` `mapOutputs` still files every output, so `p` still reaches `run.json` — `decide.test.ts`'s `mapOutputs` case is green).
- KEPT — `src/shared/decisions-view.ts` (104, the Settings-row view model: `hostedRungViews`, `keyDotsText` "Jev — key set · OpenRouter — no
  key", `moveHostedRung` / `removeHostedRung` / `addHostedRung` (never mutate; an empty order allowed), `localRungText` "none available",
  `decisionsNowText` (no digit), `normalizeOpenRouterModel`) + test; `src/features/ai-models/services/decision-providers.ts` (53 → 64:
  `isDecisionOnlyProvider`, `decisionSectionRows` (TypeSafe = key row; OpenRouter = listed), `decisionKeyTestGate` (disabled + a tooltip for no
  saved key / an unsaved typed key / a key marked for removal), `decisionTestResult` ("Connected (N ms)" or a plain sentence; the answer's `p`
  never read)) + test; `src/shared/decisions-tester-form.ts` (146 → 150) + test.
- FIXED — the tester carried no budget, so the engine's 15 s default applied; D2 §9 says the developer tester gets 30 s →
  `DECISIONS_TESTER_TIMEOUT_MS = 30_000` and `timeoutMs` on the built request (red first: 2 failing assertions, then green).
- Dropped: nothing.

**Part (f), sub-checkpoint (f2) — `8f6ff6f` (2026-10-31 17:23), 15 paths — steps 1–4, all as of `8f6ff6f`:**
- Logic, red first: `src/shared/decisions-client.ts` (62) — `DecisionsClientApi` (structural slice of `window.api`), `loadDecisionsStatus`,
  `applyDecisionsPatch` (sends exactly the patch; a refused patch keeps main's unchanged status + its `error`), `runDecisionsTester` (form →
  `{ request }` only → `testerResultView`; an incomplete form makes no call); a rejected invoke → a fixed sentence, never the thrown text.
  `decision-providers.ts` `runDecisionKeyTest` :56 — sends exactly `{ test: 'jev' }`. Tests: `src/shared/decisions-client.test.ts` (127) +
  2 cases in `decision-providers.test.ts`.
- Step 1 — `src/renderer/hooks/useDecisionsSettings.ts` (48: status + `onDecisionsEvent` + `apply(patch)`); `src/renderer/components/
  SettingsModal/rows/DecisionsRow.tsx` (144: the LibrarySearchRow card — description, "Now: … · Jev — key set · OpenRouter — no key", the
  mode select auto / off, one line per hosted rung with position, a has-key dot (accent-green / text-dim), "key set / no key · ready / why", ↑ / ↓
  / ✕ (switch off) or + (back on, last), the local rung "none available", the OpenRouter model input + Save (blank / inner whitespace refused);
  `data-decisions-*` hooks for CDP); `GeneralSettingsContent.tsx` (151 → 155): under "Library", `LibrarySearchRow` + `DecisionsRow` in one
  column.
- Step 2 — `src/features/ai-models/components/providers/DecisionsProvidersSection.tsx` (69): the TypeSafe key row (`ProviderKeyRow`, saved with
  the page's one "Save changes" like every key) with the Test button gated by `decisionKeyTestGate` and its tooltip, + OpenRouter LISTED (Key
  saved / No key, "Uses the OpenRouter key in API keys above — Microsoft-Decision-1. Order and model: Settings › General › Decisions"; no
  second key input); `ProvidersContent.tsx` (97 → 106) adds the `<section data-decisions-providers>` "Decisions" right after "API keys";
  `ProviderKeysTable.tsx` (92 → 96) drops decision-only rows (TypeSafe) from API keys; `ProviderKeyRow.tsx` (151 → 157) `test.title?` + a
  `data-provider-test` attribute; `useProviderKeyDrafts.ts` gains `testDecision(id)` (`runDecisionKeyTest(window.api)`; the draft is never read).
- Step 3 — `src/shared/feature-flags.ts` `'decisions-tester': false` (a dev-preview: on in dev builds, hidden in production);
  `src/renderer/hooks/useDecisionsTester.ts` (30) + `rows/DecisionsTester.tsx` (85) under the Decisions row when the flag is on: state, type
  (choice / noul), provider (auto / Jev / MSD1 / your AI provider), family, instructions, options; "Ask" → answer, band, provider · served model ·
  calibrated · ms · cached, the probabilities as 3-decimal numbers, skipped rungs, or `code — message`.
- Step 4 — D-r22 (2) is the (f1) `recordOnly` change above.
- The preload still exposes exactly its four decisions functions (no preload / IPC / provider-keys file touched in (f)); no package.json / lock
  change.

**Decisions builder #8 made (the orchestrator may overrule any):**
1. **TypeSafe's key row MOVES to the Decisions section** (it is no longer in "API keys"); OpenRouter keeps its ONE key row in "API keys" and is
   LISTED in Decisions (status + a pointer, no second input) — one key, one input. §15.3 2's "AI → Providers shows a Decisions section with the
   TypeSafe row (and OpenRouter listed under it too)" reads on this.
2. **The Test button sends `{ test: 'jev' }` only and is disabled unless a TypeSafe key is saved AND no typed draft / removal is pending** (a
   typed key would make the user think the typed key is tested); tooltips: "Save a TypeSafe key first — the test uses the saved key" / "Save the
   typed key first — …never a typed one" / "This key is removed on save — nothing to test" / "Sends one tiny yes / no question to Jev with the
   saved TypeSafe key". Its result reads like the other rows ("Connected (N ms)" / a sentence); `no-provider` → "No saved TypeSafe key, or
   Decisions are off in Settings" (mode `off` also refuses the test — main's `testKey` goes through the engine).
3. **The tester lives in the Settings › General Decisions row** (D2 §8 puts it in that row), behind a NEW dev-preview flag `decisions-tester`
   (FEATURE_FLAGS `false` → on in `electron-vite dev`, hidden in a production build — so the worktree's `electron-vite build` out/ will NOT show it).
   It shows probabilities as numbers (3 decimals) and the band at the tool's default threshold 0.9 with `allowUncalibrated: false`; it sends no
   `allowUncalibrated` (a pinned `llm` needs none — builder #1 decision 6), so `auto` without a hosted key → `no-provider`.
4. **The `p` handle is hidden** (16 lines; `PortDef.recordOnly`). Side effect: an edge a Flow Builder proposal or a hand-written flow wires from
   `p` has no handle to draw on (React Flow warns and skips the edge); the runner still files `p`. The label "p (run record)" stays in the spec
   (visible nowhere on the canvas).
5. The order editor sends the WHOLE new order on every click (`decisions:settings:set { hostedOrder }`); a switched-off rung is listed greyed
   with a + (back on, at the end). Mode and model are separate patches.

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

Part (c2), all from the worktree root (logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D4\`):
- RED (10:40, the 4 test files written, no (c2) source): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  src/preload/api/decisions.test.ts src/main/ipc/decisions-handlers.test.ts src/main/ipc/registrations/decisions.test.ts
  src/main/ipc/provider-keys-handlers.test.ts` → `Test Files 4 failed (4)`, `Tests 2 failed | 1 passed (3)`; 3 files fail only on "Cannot find
  module '/src/preload/api/decisions' | '/src/main/ipc/decisions-handlers' | '/src/main/ipc/registrations/decisions'", the provider-keys file
  on its two `decisionsKeysChanged` assertions (`c2-red.log`).
- GREEN (10:42): the same command → `Test Files 4 passed (4)`, `Tests 41 passed (41)` (`c2-green-1.log`).
- Related suites (10:42–10:43): `… vitest.mjs run src/main/ipc src/preload src/main/services/decisions src/decision-engine src/shared` →
  `Test Files 1 failed | 117 passed (118)`, `Tests 1 failed | 1103 passed (1104)`; the 1 red = `src/shared/tsx-engine/builder-libraries.test.ts`
  ("@remotion/paths (builder-libraries.ts) is not installed" — the known E-d2a worktree-only package-resolution suite, DRIVING.md:186; it
  touches no file of this part) (`c2-green-2.log`). No LS-r1b `stream` failure appeared in these directories.
- tsc (10:43): `… tsc -p tsconfig.web.check.json --noEmit` → **25** (`tsc-web-c2.log`); `-p tsconfig.node.check.json --noEmit` → **10**
  (`tsc-node-c2.log`); `--listFilesOnly` (node) lists all 7 new files + `provider-keys-handlers.ts`; (web) lists `src/renderer/types/
  electron.d.ts` + `shared/ipc/types/decisions.ts`.
- House rules (10:44): imports of the 3 new sources = `electron`, `@shared/ipc/channels` / `../../shared/ipc/channels`, `shared/ipc/types`
  (+ `/decisions`), `shared/types/{decisions,ai-usage}`, `decision-engine` (+ `/ladder`, `/scrub`), `services/decisions/decision-runtime`,
  `../decisions-handlers`, `./lazy` — none from studio / asset-library / renderer / features; no `any`, no `export default`; longest new source
  `decisions-handlers.ts` 110, longest new test 167; big pre-existing files grew only by the channel lines (channels.ts 654 → 660,
  electron.d.ts 656 → 661). Key scan over the 7 new files: only `sk-test-FAKE-handlers-0011` / `-keys-0021` / `-preload-0007`. No hosted
  call, no app launch, no package.json / lock change.

Part (d), all from the worktree root (logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D4\`):
- RED (10:59, the 3 test files + the registry.test.ts edits written, no (d) source): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs
  run src/main/services/agents/tools/decide.test.ts src/main/services/agents/tools/decide-builtins.test.ts
  src/main/services/agents/tools/decide-no-claim.test.ts src/main/services/agents/tools/registry.test.ts` → `Test Files 4 failed (4)`, `Tests 5
  failed | 8 passed (13)`; 3 files fail only on "Cannot find module '/src/main/services/agents/tools/decide' | '…/check-matches-request'", the
  registry file on its 5 new / changed assertions (`d-red.log`).
- GREEN (11:09): the same command → `Test Files 4 passed (4)`, `Tests 38 passed (38)` (`d-green-4.log`). (`d-green-1..3.log` = the fix-up runs:
  the defaultConfig `instructions: ''` that failed the schema, and the `beforeEach` teardown trap of decision 9.)
- Related suites (11:14–11:15): `… vitest.mjs run src/main/services/agents/tools src/main/services/flows src/shared/agents` → `Test Files 49 passed
  (49)`, `Tests 365 passed (365)` (`d-green-5.log`). `registry.test.ts` is NOT a worktree-only `stream` suite here (it passed at 10:55 before any
  edit: 12 / 12), so the registration is proven by it directly.
- tsc (11:09–11:14): `… tsc -p tsconfig.web.check.json --noEmit` → **25** (`tsc-web-d.log`); `-p tsconfig.node.check.json --noEmit` → **10**
  (`tsc-node-d.log`, after typing the fixture rows' `kind` in the two tests — the first run counted 12, both in those test lines).
- House rules (11:15): the 5 new sources import only `zod`, `shared/types/{decisions,ai-usage,flows}`, `./types`, intra-tools, and (dynamic)
  `../../decisions/decision-runtime` — none from studio / asset-library / renderer / features, and not the engine; the tests also import
  `decision-engine` (the real engine + `DecisionError`), `../../flows/flow-args` (`mapOutputs`), the fixtures, `fs` / `path`; no `any`, no
  `export default`; longest source `decide-run.ts` 140, longest test `decide.test.ts` 223. Fixture key scan: `grep -noE
  'sk-[A-Za-z0-9]|sk-or-|[Bb]earer|[Aa]uthorization|api_key|apikey|x-api-key|TYPESAFE_API|OPENROUTER_API'
  src/main/services/decisions/benchmark/fixtures/*.json` → empty (exit 1); the only ≥ 32-char runs in `t2-routing.json` are repo paths. Tests'
  key: `sk-test-FAKE-decide-0031` / `-0041`. No hosted call, no app launch, no package.json / lock change.

Part (e), all from the worktree root (logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D4\`):
- RED (11:32, the 5 test files written, no (e) source): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  src/main/services/decisions/benchmark src/main/services/decisions/decision-init-stub.test.ts` → `Test Files 5 failed (5)`, `Tests 11 failed |
  1 passed (12)`; the 4 benchmark files fail only on "Cannot find module './live-requests' | './live-run' | './measures' | './score'", the stub
  file on "resolveDecisionStubURLs is not a function" (9) + its registration / runtime assertions (2) (`e-red.log`).
- GREEN (11:36): the same command → `Test Files 4 passed | 1 skipped (5)`, `Tests 38 passed | 2 skipped (40)` (`e-green-1.log`; verbose
  `e-green-2.log`). **The 2 skipped = `live.test.ts`'s `jev` and `openrouter-decisions` cases — proof the live test is skipped without
  `VIDTSX_DECISIONS_LIVE=1`** (no request made; it never ran).
- Related suites (11:37): `… vitest.mjs run src/main/services/decisions src/decision-engine src/main/services/agents/tools src/main/services/flows
  src/main/ipc src/preload src/shared/agents` → `Test Files 86 passed | 1 skipped (87)`, `Tests 703 passed | 2 skipped (705)` (`e-green-3.log`).
- tsc (11:36): `… tsc -p tsconfig.web.check.json --noEmit` → **25** (`tsc-web-e.log`); `-p tsconfig.node.check.json --noEmit` → **10**
  (`tsc-node-e.log`); no error in a decisions / benchmark file; `--listFilesOnly` (node) lists all 10 new `benchmark/*.ts`, the 4 new answer
  fixtures and `decision-init-stub.test.ts`.
- **The replay, side by side** (`c-hosted.md` §2 as printed │ the tree's `c2Cells` — `score.test.ts` asserts every cell equal):

  | set | accuracy | Arabic | Brier (multiclass) | ECE | sel ≥ 0.5 | sel ≥ 0.7 | sel ≥ 0.9 | off-list |
  |---|---|---|---|---|---|---|---|---|
  | Jev T2 — §2 │ tree | 100.0 (40 / 40) │ same | 100.0 (10 / 10) │ same | 0.021 (0.001) │ same | 0.059 │ same | 100.0 (100.0) │ same | 100.0 (90.0) │ same | 100.0 (82.5) │ same | 0 │ 0 |
  | Jev T3 | 100.0 (40 / 40) │ same | 100.0 (7 / 7) │ same | 0.003 │ same | 0.044 │ same | 100.0 (100.0) │ same | 100.0 (100.0) │ same | 100.0 (97.5) │ same | — │ — |
  | MSD1 T2 | 100.0 (40 / 40) │ same | 100.0 (10 / 10) │ same | 0.014 (0.000) │ same | 0.044 │ same | 100.0 (100.0) │ same | 100.0 (95.0) │ same | 100.0 (87.5) │ same | 0 │ 0 |
  | MSD1 T3 | 100.0 (40 / 40) │ same | 100.0 (7 / 7) │ same | 0.002 │ same | 0.013 │ same | 100.0 (100.0) │ same | 100.0 (100.0) │ same | 100.0 (95.0) │ same | — │ — |

  The dry run of the live path on the recorded bodies gives the same 40 / 40 × 4 and Brier 0.021 / 0.003 / 0.014 / 0.002 (`live-dry-run.test.ts`).
- Key-pattern scan (11:37) over the 4 new fixtures: `grep -noE 'sk-[A-Za-z0-9]|sk-or-|[Bb]earer|[Aa]uthorization|api_key|apikey|x-api-key|TYPESAFE|OPENROUTER|[A-Za-z0-9+/_=-]{32,}'
  src/main/services/decisions/benchmark/fixtures/hosted-*.json | grep -v ':microsoft/microsoft-decision-1-20261009$'` → **empty** (exit 1; the
  only raw hit of the 32-char pattern is the served model id) and `grep -noiE 'password|secret|token|key"' …/fixtures/hosted-*.json` → **empty**
  (exit 1). Keys in the new tests: only `sk-test-FAKE-live-0051`, `sk-or-v1-FAKE-live-0052`, `sk-test-FAKE-stub-0061`, `sk-or-v1-FAKE-stub-0062`.
- The launcher (11:37): `bash -n D:/repos/VidTSX-STUDIO/.vidtsx-temp/decisions/D4/live-test.sh` → exit 0; `diff <(sed -n '4,11p' …/D1/hosted-live.sh)
  <(sed -n '8,15p' …/D4/live-test.sh)` → exit 0 (the sourcing / CR-strip / export block is identical); a scan for `echo|set -x|printenv|env|cat`
  outside comments → exit 1 (none). NOT executed; no `.env` opened.
- House rules (11:37): imports of the new files = `decision-engine` (+ `/calibration-table`, the part-(b) recorded-bodies fixture in the dry-run
  test), `shared/types/decisions`, `../decision-init` / `./decision-init` / `./decision-settings` (type), `agents/tools/{check-matches-request,
  route-request}`, intra-benchmark, the fixtures, `node:fs` / `node:os` / `node:path` (live.test.ts only), `vitest` — none from studio /
  asset-library / renderer / features; no `any`, no `export default`; longest new source `live-run.ts` 171, longest new test
  `live-dry-run.test.ts` 139; `decision-runtime.ts` 253, `decision-engine.ts` 266. No hosted call, no app launch, no package.json / lock change.

Part (f), all from the worktree root (logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D4\`):
- Builder #7's leftovers as found (17:14, as of `30ce081` + the uncommitted files): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  src/features/ai-models/services/decision-providers.test.ts src/features/flows/services/port-visibility.test.ts
  src/main/services/agents/tools/decide-shared-pins.test.ts src/shared/decisions-tester-form.test.ts src/shared/decisions-view.test.ts` →
  `Test Files 5 passed (5)`, `Tests 36 passed (36)` (`f0-leftovers.log`); related `… run src/main/services/agents/tools src/main/services/flows
  src/features/flows src/features/ai-models src/shared src/main/services/decisions src/decision-engine` → `Test Files 1 failed | 156 passed | 1
  skipped (158)`, `Tests 1 failed | 1355 passed | 2 skipped (1358)`; the 1 red = `src/shared/tsx-engine/builder-libraries.test.ts` ("@remotion/paths
  (builder-libraries.ts) is not installed" — the known worktree-only suite) (`f0-related.log`); tsc web **25** / node **10** (`tsc-web-f0.log`,
  `tsc-node-f0.log`).
- (f1) RED (17:16): `… run src/shared/decisions-tester-form.test.ts` → `Tests 2 failed | 8 passed (10)` (the two `timeoutMs` assertions)
  (`f1-red.log`); GREEN: the 5 leftover files + `decide.test.ts` + `decide-no-claim.test.ts` + `decide-builtins.test.ts` → `Test Files 8 passed (8)`,
  `Tests 62 passed (62)` (`f1-green.log`).
- (f2) RED (17:18): `… run src/shared/decisions-client.test.ts src/features/ai-models/services/decision-providers.test.ts` → `Test Files 2 failed
  (2)`, `Tests 2 failed | 9 passed (11)` — "Cannot find module './decisions-client'" + "runDecisionKeyTest is not a function" ×2 (`f2-red.log`);
  GREEN: the same → `Test Files 2 passed (2)`, `Tests 19 passed (19)` (`f2-green.log`).
- (f2) related (17:21): `… run src/main/services/agents/tools src/main/services/flows src/features/flows src/features/ai-models src/shared
  src/main/services/decisions src/decision-engine src/preload src/main/ipc` → `Test Files 1 failed | 177 passed | 1 skipped (179)`, `Tests 1 failed
  | 1525 passed | 2 skipped (1528)`; the 1 red = `builder-libraries.test.ts` ("is not installed", as above); the skipped file = part (e)'s gated
  live test (`f2-related.log`). The preload-surface test (`src/preload/api/decisions.test.ts`, four functions) is in that green run.
- tsc (17:22, the (f2) tree): web **25** / node **10** (`tsc-web-f2.log`, `tsc-node-f2.log`; every error is in a baseline file — none in a
  decisions / Settings / providers / flows file).
- House rules (17:21): the 15 (f2) paths contain no `any`, no `export default`, no `electron` / `require(`; `src/features/ai-models` imports
  nothing from `features/flows` or `features/studio` (grep empty); the new shared modules import only `./ipc/types/decisions`, `./types/decisions`,
  `./decisions-*`; longest touched file `ProviderKeyRow.tsx` 157 (151 → 157); `GeneralSettingsContent.tsx` 151 → 155, `useProviderKeyDrafts.ts`
  135 → 144, `ProvidersContent.tsx` 97 → 106, `ProviderKeysTable.tsx` 92 → 96. Keys in the new tests: only `sk-test-FAKE-client-0081`,
  `sk-test-FAKE-keytest-0091`. No hosted call, no app launch, no package.json / lock change, no preload / IPC file touched.
- NOT yet verified: the UI in the running app (step 5 below).

## Next step

Part (f) step 5, in a FRESH builder context: check C: ≥ 3 GB free + commit headroom ≥ 6 GB and electron.exe / ports 5173 / 9222 / 9302 (never
touch Hasan's app); build the worktree's own `out/` (Bash from the worktree root: `unset ELECTRON_RUN_AS_NODE; export
NODE_OPTIONS=--max-old-space-size=8192; node D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build > <log> 2>&1`); create
the profile `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\decisions-D4\profile` by copying `profiles\source\profile` WITHOUT
`settings\settings.db*`; launch from the worktree's `out/` per `docs/studio/end-to-end/DRIVING.md` "Launch recipe from the worktree" on CDP
**9302**, NO key saved; in the FIRST CDP call `window.api.studioRootSet(<a scratch folder under C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D4\>)`;
then take and LOOK AT two stills into `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D4\`: (a) Settings › General scrolled to the Decisions
row (`[data-decisions-row]`: "Now: No provider is ready … · Jev — no key · OpenRouter — no key", both rungs, the local rung "none available") and
(b) AI → Providers scrolled to `[data-decisions-providers]` with the TypeSafe Test button (`[data-provider-test="typesafe"]`) visibly DISABLED
(read its `disabled` + `title` via CDP too). Clicks only on `offsetParent !== null` elements (DRIVING). The production build hides the
dev-preview tester (decision 3) — say so; do not run `electron-vite dev`. Stop only the electron.exe whose command line holds the
`decisions-D4` profile path (filter by Name='electron.exe'). Kit (drivers, launch script) in `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D4\`.
Then set part (f) DONE (row + this section) and Next step = part (h).

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
   docs commit; likewise left unstaged in `d9ec730` and (c2)'s docs commit.
8. **For the orchestrator (builder #4's decisions 1–5, (c2)):** the one that shapes §15.3 is #1 — the renderer's free-form `decisions:decide`
   accepts only `featureSource` `decision-test` / `decision-flow`, so the verifier's §15.3 1 stub run (20 concurrent calls) must send
   `featureSource: 'decision-test'` (the brief to D5 should say so). #2 (a failed first-use start answers typed instead of rejecting) differs
   from library search's registration on purpose.
9. (f) wires the TypeSafe row's Test button to `window.api.decisionsDecide({ test: 'jev' })` (D-r19 (3): disabled until a key is SAVED) and
   gates the free-form tester behind the dev-preview flag (D2 §12 / D-r19 (2)) — main does not gate either.
10. **For the orchestrator (builder #5's decisions 1–9, part (d)):** the two that shape §15 are **#1** (the no-claim list is matched as whole
    words — §10.1's mandated escalate text contains "uncertain"; the D5 brief should say so) and **#2** (`p` is a drawn output port — the only
    way into `run.json` without touching the flow runner; the canvas PREVIEWS only the band, but a `p (run record)` handle is visible and
    wireable; a hidden-port flag would be a renderer change for (f)). Also #4 (`allowUncalibrated` keeps the threshold — D2's text says "act").
11. §15.3 3's live check names `input_text → check_matches_request`: `check_matches_request` has TWO required text inputs (`item`, `request`),
    so the verifier's two-node flow needs both wired (two `input_text` nodes, or one wired to `item` with `request` bound by a run param) — the
    D5 brief should say so.
12. `docs/studio/decisions/ORCHESTRATOR.md` is still modified in the working tree (not this builder's edit) — left unstaged in `feb5e69` and
    (d)'s docs commit; likewise in `5605c48` and (e)'s docs commit.
13. **For the orchestrator (builder #6's decisions 1–9, part (e)):** the ones that shape §15 are **#1** (MSD1's excluded first call = its T2
    request; one request per set, so "p95 per request" is each request — the D5 brief should say so) and **#9** (part (b)'s
    `DecisionProviderConfig` gained `noulCriteriaRequired?`, +6 lines, so a stubbed OpenRouter rung keeps the OpenRouter shape §15.3 5 names).
    Also #3 (a hard 4-request cap inside the live test).
14. **How the verifier runs the live test (D5, ≤ 4 of its ≤ 20 requests, < $0.01):** `bash D:/repos/VidTSX-STUDIO/.vidtsx-temp/decisions/D4/live-test.sh`
    (Git Bash; from any directory — it `cd`s into the worktree). PASS = vitest `Tests 2 passed (2)`; the result JSON lands at
    `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D5\live-result-<stamp>.json` (override with `VIDTSX_DECISIONS_LIVE_OUT`) with `verdict`
    and `violations`. A provider whose key does not load fails as `refused` without a request.
15. **For (h) / D5's §15.3 1 / 3 / 4 / 5 on the stub server:** launch the worktree's UNPACKAGED `out/` app with `VIDTSX_DECISIONS_JEV_URL=
    http://127.0.0.1:<port>/…` (and `VIDTSX_DECISIONS_OPENROUTER_URL=http://127.0.0.1:<port2>/…` for §15.3 5) in its environment — the runtime
    reads them at the FIRST decisions use, so they must be set at launch; main logs `decisions: dev stub URL in use for jev (127.0.0.1:<port>)`.
    A FAKE TypeSafe key must be saved through the Providers row (the key still comes from the credential store).
16. **For the orchestrator (builder #8's decisions 1–5, part (f)):** the ones that shape §15 are **#1** (TypeSafe's key row moves to the
    Decisions section; OpenRouter is LISTED there, its key row stays in API keys — §15.3 2's "TypeSafe row (and OpenRouter listed under it
    too)"), **#2** (the Test button sends `{ test: 'jev' }` only, disabled while no key is saved OR a typed draft / removal is pending) and **#3**
    (the tester sits in the Settings Decisions row behind a NEW dev-preview flag `decisions-tester`, so a production `electron-vite build` —
    the worktree's out/ and the verifier's — does NOT show it; the verifier's §15.3 1 stub run goes over `window.api.decisionsDecide` with
    `featureSource: 'decision-test'` anyway, D-r20). Also #4: an edge wired from the hidden `p` has no handle to draw on.
17. The (f2) UI is NOT yet seen in the running app — step 5 (Next step) is the first look; a layout fix found there is part of step 5.
18. `docs/studio/decisions/ORCHESTRATOR.md`: not modified in the working tree at `30ce081` (the status showed only builder #7's files), so
    nothing to leave unstaged this time.

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
- **Part (c) is DONE** — (c2) at `d9ec730`: the four channels, `decisions-handlers.ts`, `registrations/decisions.ts` (lazy, quiet start),
  `src/preload/api/decisions.ts` + `api/index.ts` + the `preload.ts` spread, the four `electron.d.ts` lines, `decisionsKeysChanged()` in the
  key save, and their 4 test files. Do not re-wire them; (f) only CALLS `window.api.decisions*`.
- **Part (d) is DONE at `feb5e69`** — `decide.ts`, `decide-run.ts`, `decide-outcome.ts`, `check-matches-request.ts`, `route-request.ts`, their
  registration (`registry.ts`, `AGENT_TOOL_IDS`), the 3 test files + the registry.test.ts additions, and the benchmark fixtures `t2-routing.json`
  / `t3-verify.json` / `d1-dry-run-t2-t3.json` (key-scanned). The D-r16 (c) equality is proven on all 80 rows through the real engine — (e) need
  not repeat it; its live test may reuse the built-ins' framing.
- **Part (e) is DONE at `5605c48`** — the 4 scrubbed answer fixtures (key-scanned), `benchmark/{types,measures,score,live-requests,live-run,live-bar}.ts`,
  the 4 benchmark test files (the replay = §2 cell for cell; the live test SKIPPED without the env var; its dry run), the D-r21 hook
  (`resolveDecisionStubURLs` + `baseURLs` + the runtime's once-at-start resolve + `noulCriteriaRequired`) and `decision-init-stub.test.ts`, and the
  kit launcher `D4\live-test.sh`. Do not re-copy, re-port or re-run any of it; NEVER run the live test or the launcher as a builder.
- **Part (f) steps 1–4 are committed** — (f1) `cc754fa` (builder #7's leftovers, judged + kept, the 30 s fix) and (f2) `8f6ff6f` (`decisions-client.ts`,
  `runDecisionKeyTest`, the two renderer hooks, `DecisionsRow.tsx` + `DecisionsTester.tsx`, `DecisionsProvidersSection.tsx`, the four provider-file
  edits, the `decisions-tester` flag, the General section). Do not rebuild them; step 5 only builds, launches, looks and fixes what the stills show.

## Agents so far

- 2026-10-31 09:46–10:00 · D4 builder #1 · ~34 tool calls · part (a) red → green → `c7ad6da`; part (b) red-first tests (engine + presets),
  untracked; HANDOFF + LOG.
- 2026-10-31 10:03–10:17 · D4 builder #2 · ~45 tool calls · part (b): provider tests red → engine + presets + providers green → `ed79420`;
  HANDOFF + LOG.
- 2026-10-31 10:20–10:35 · D4 builder #3 · ~50 tool calls · part (c) sub-checkpoint (c1): 4 service tests + registry edits red → services +
  registry + wire types green → `b7b1648`; HANDOFF + LOG → (c2).
- 2026-10-31 10:36–10:46 · D4 builder #4 · ~38 tool calls · part (c) sub-checkpoint (c2): 4 test files red → channels + handlers + lazy
  registration + preload + `electron.d.ts` + the key-save hook green → `d9ec730`; part (c) DONE; HANDOFF + LOG → part (d).
- 2026-10-31 10:49–11:17 · D4 builder #5 · ~68 tool calls (incl. ~7 on the `beforeEach` teardown trap) · part (d): 3 test files + registry.test.ts
  red → `decide` / the two gates / the shared run + outcome modules green → `feb5e69`; part (d) DONE; HANDOFF + LOG → part (e).
- 2026-10-31 11:25–11:40 · D4 builder #6 · ~50 tool calls · part (e): 5 test files red → the scrubbed answer fixtures + scorer + replay + the gated
  live test (skipped, dry-run-proven) + the D-r21 stub hook green → `5605c48`; kit launcher `D4\live-test.sh` (`bash -n` only); part (e) DONE;
  HANDOFF + LOG → part (f).
- 2026-10-31 17:14–17:24 · D4 builder #8 · ~75 tool calls · part (f): builder #7's leftovers judged (36 tests green, related suites green but the
  known `builder-libraries` red, tsc 25 / 10) and kept + the tester's 30 s budget (red → green) → (f1) `cc754fa`; the client logic red → green, then
  the Settings row, the Providers Decisions section, the dev-preview tester → (f2) `8f6ff6f` (related 177 files green but the known red, tsc 25 / 10);
  step 5 (build + CDP stills) handed to the next builder; HANDOFF + LOG.

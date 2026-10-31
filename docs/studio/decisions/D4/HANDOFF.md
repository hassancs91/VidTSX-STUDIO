# D4 — THE BUILD: the shared decision engine (D2 §14 (a) → (h))
status: NEW (orchestrator 2026-10-31 09:44 — D3 judged: **FAIL, the local rung stays empty → part (g) is NOT built**; ruling **D-r16**
binds (b), (d), (e); D4 builder #1 = part (a))

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
| (a) | `src/decision-engine/` types + validate / ladder / calibration-table / cache, tests first; `src/shared/types/decisions.ts` (§3) | TODO | — |
| (b) | `providers/system-one-provider.ts` (injected `fetch`) + contract tests on D1's recorded responses (scrubbed fixtures) + dry-run bodies; `decision-engine.ts` + `presets.ts` + `index.ts`; the LLM-fallback provider (§5.4) | TODO | — |
| (c) | `src/main/services/decisions/` (decision-init from credentials like `image-init.ts`, decision-usage, decision-settings, decision-runtime); registry `typesafe` + `'decision'` capability + label; `openrouter` gains `'decision'`; IPC (§12) + preload + status; the preload-surface test | TODO | — |
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

(nothing yet)

## Verified

(nothing yet)

## Next step

Part (a): write the failing tests first for `src/decision-engine/{validate,ladder,calibration-table,cache}.ts` and the contract types in
`src/shared/types/decisions.ts` + `src/decision-engine/types.ts` (D2 §3, §4, §6, §9, §15.1's calibration rows), then the code until green;
tsc ≤ 25 / 10; commit with explicit paths.

## Open problems

(none yet)

## Do-not-redo

- The tsc baseline at `b2b8a02` is measured (web 25 / node 10).

## Agents so far

(none)

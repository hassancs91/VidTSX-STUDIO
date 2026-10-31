VERDICT: PASS

> Filed by the orchestrator (2026-10-31 18:45) from the D5 verifier's hand-back, VERBATIM below the line: the harness refused the
> verifier's own Write of this file ("Subagents should return findings as text, not write report files"), and the brief allowed it no other
> way, so the verifier returned the report as text and committed nothing. The orchestrator spot-checked its evidence before filing (18:44:
> `live-result-20261031-182824.json` → `verdict PASS`, `violations []`, `requests 4`, Σ `costUsd` 0.001298388, 0 key-shaped strings in it and
> in `live-run-1.log`; `gate-3.log` → `Test Files 3 failed | 564 passed | 7 skipped (574)`, the three E-d2a files; worktree clean at
> `b8e85d0`; 0 `electron.exe`, nothing on 9305 / 18481 / 18482).

---

# D5 — independent verifier, round 1 — decision models

Judged only by `docs/studio/DECISION_MODELS_DESIGN.md` §15, read through rulings D-r16 … D-r28.
- Branch `decision-models`, worktree `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\wt`, range `b2b8a02..HEAD`.
- All tree statements are as of `b8e85d0`. The worktree was clean before and after, and no mutant was committed.
- Run 2026-10-31 18:22:50 → 18:41:29 MEST (`date`).

Locations:
- `<L>` = `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D5\` (logs, stills, JSON).
- `<K>` = `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D5\` (stub, drivers, kit test).

Budget used:
- **Hosted requests: 4 / 8**, cost **$0.001298388**. This is the sum of `costUsd` in `<L>live-result-20261031-182824.json`.
- **Keyless agent runs: 1 / 3.**

Key handling:
- No `.env`, `settings.db*`, `~/.claude` or credential store was opened.
- `live-test.sh` was read first. It echoes nothing: `set -a; . .env; set +a`, a CR strip by parameter expansion, then `exec` vitest.
- The live result JSON and the live log hold no key-shaped string: `grep -ciE "sk-|bearer|api[_-]?key"` → 0 / 0.

## 15.1 The committed benchmark

**Fixtures — PASS.**
- `t2-routing.json`: 40 rows.
- `t3-verify.json`: 40 rows (template 16, caption 10, clip 14).
- The four recorded answer files `hosted-{jev,openrouter-msd1}-{t2-choice,t3-noul}.json` and `d1-dry-run-t2-t3.json`, in `src/main/services/decisions/benchmark/fixtures/`.
- Scrubbed raw bodies (model + answers + usage) for the shape tests are in `src/decision-engine/providers/fixtures/`.
- No T1.

**Shape — PASS.**
- Command: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/decision-engine src/main/services/decisions src/main/services/agents/tools`.
- Output: `Test Files 47 passed | 1 skipped (48)` · `Tests 380 passed | 2 skipped (382)`. The skipped file is the gated `live.test.ts`. Log: `<L>offline-1.log`.
- What the tests check, read in `system-one-provider.contract.test.ts` and `system-one-provider.test.ts`:
  - Each recorded body maps to choice = argmax, with probabilities to 4 dp; noul `p` to 4 dp; `usage.input_tokens`.
  - OpenRouter's `usage.cost` is read as the cost.
  - An off-list option (in `choice` or in `probabilities`) gives `invalid-answer`.
  - A cut JSON body, a non-JSON body and a body without answers each give `invalid-answer`.
  - Error messages contain neither a FAKE key, nor the state, nor the evidence text.

**Replay — PASS.**
- `score.test.ts` holds the four §2 rows verbatim. My own string-equality check against `D1\reports\c-hosted.md`: Jev T2 = line 48, Jev T3 = line 49, MSD1 T2 = line 51, MSD1 T3 = line 52, all EQUAL.
- The test parses every cell and compares it with the tree scorer's formatted output (`toEqual`): accuracy, Arabic, Brier with the multiclass note, ECE, selective ×3, off-list.
- The cells:
  - Jev: 40 / 40 and 40 / 40, Brier 0.021 / 0.003, ECE 0.059 / 0.044.
  - MSD1: 40 / 40 and 40 / 40, Brier 0.014 / 0.002, ECE 0.044 / 0.013.

**Calibration table — PASS.**
- `src/decision-engine/calibration-table.ts` has exactly six rows (D-r17 (4)), each for routing and verify:
  - `jev` / `jev-1.14.0`
  - `openrouter-decisions` / `microsoft/microsoft-decision-1`
  - `openrouter-decisions` / `microsoft/microsoft-decision-1-20261009`
- `llm`, family `other` and an absent family are always false.
- The test sweeps every provider × 11 models × 4 families.

**Gated LIVE — PASS.**
- Command: `bash D:/repos/VidTSX-STUDIO/.vidtsx-temp/decisions/D4/live-test.sh`, run once, 18:28:24 → 18:28:30.
- Output: `Test Files 1 passed (1)` · `Tests 2 passed (2)`. Result JSON: `verdict: PASS`, `violations: []`, `requests: 4`.

| provider | set | right | Brier | ECE | off-list | errors | latency | model | tokens | cost |
|---|---|---|---|---|---|---|---|---|---|---|
| Jev | T2 | 40 / 40 | 0.0199 | 0.0580 | 0 | 0 | 797 ms | jev-1.14.0, calibrated | 10,858 | $0.000456036 |
| Jev | T3 | 40 / 40 | 0.0031 | 0.0462 | 0 | 0 | 279 ms | jev-1.14.0, calibrated | 6,087 | $0.000255654 |
| MSD1 | T2 (first call, excluded per D-r23 (1)) | 40 / 40 | 0.0146 | 0.0449 | 0 | 0 | 2,626 ms | microsoft-decision-1-20261009, calibrated | 8,241 | $0.000346122 |
| MSD1 | T3 | 40 / 40 | 0.0029 | 0.0145 | 0 | 0 | 698 ms | microsoft-decision-1-20261009, calibrated | 5,728 | $0.000240576 |

- Every bar term is met: ≥ 38 / 40, Brier ≤ 0.05, 0 off-list, 0 errors, Jev ≤ 2,000 ms, MSD1 T3 ≤ 4,000 ms.
- One HTTP call per set, so no retry happened.
- Files: `<L>live-result-20261031-182824.json`, `<L>live-run-1.log`.

**No-claim — PASS.**
- `decide-no-claim.test.ts` covers:
  - every T3 row × both bands × yes / no (160 texts from `check_matches_request` and `decide`);
  - every T2 row × both bands (`route_request` and `decide`);
  - uncalibrated (both toggles), refused, every error code from all three tools, and the three tool descriptions.
- It bans `%`, the whole words in D-r22 (1), and any digit. Every text must fit §10.1's two shapes.

**Mutants — 4, all bite.** Script `<K>mutants.sh`, logs `<L>mutant-*.log`. Each was reverted at once with `git checkout -- <file>`; `git status --short` was empty after each one and at the end.
1. Band read from `confidence`: `decisions-outcome.ts` `topOf` changed to use `answer.confidence`. Two real failures:
   - `decide.test.ts` "the band (D-r18 …)";
   - the T2 bands in `decide-no-claim.test.ts`.
   - The third red in that run is the E-d2a `builder-libraries` suite, picked up because the run included `src/shared`.
2. An extra `jev-latest` calibration row: 3 failures in `calibration-table.test.ts`.
3. `(sure act)` in the act text: 5 failures, in `decide-no-claim.test.ts` and `decide.test.ts`.
4. A 5th preload function `decisionsPeek`: 2 failures in `src/preload/api/decisions.test.ts`.

## 15.2 The gates

**vitest — PASS (read by D-r28).**
- Command: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run`, with the app stopped (no electron.exe, ports 5173 / 9222 free).
- Try 1, 18:24:14: 4 red files — the 3 E-d2a suites plus `shot-module-resolver.test.ts` ("never written …v1.json"). Rerun alone, that suite gave `Tests 10 passed (10)`.
- Try 2, 18:26:00, CPU 12 % before: the same 4.
- **Try 3, 18:27:27, CPU 33 % before, is the counted run:**
  - `Test Files 3 failed | 564 passed | 7 skipped (574)` · `Tests 9 failed | 5890 passed | 39 skipped (5938)`.
  - The 3 are E-d2a only, each failing only on package resolution: `@remotion/paths … is not installed`, and esbuild `Could not resolve` for chroma-js, @remotion/shapes, roughjs, @react-three/fiber and @remotion/google-fonts.
- DRIVING's load rule is met: green alone, and a full run green on it within 3 tries.
- **No LS-r1c `stream` suite was red in any run.**
- Logs: `<L>gate-1.log`, `gate-2.log`, `gate-3.log`, `gate-resolver-alone.log`.

**E-d2a independence — PASS (my own proof).**
- Method: a static runtime import-graph walk, `<K>import-graph.cjs`.
  - It follows `import … from`, `export … from`, `import()` and `require()`, over relative paths and the vitest aliases `@shared`, `@main`, `@logging`, `@audio-engine`.
  - It does not follow `import type` or `vi.mock`'d specifiers; packages are leaves.
  - It adds `scripts/builder-unpack.mjs` as a root, because `builder-libraries.test.ts` spawns it.
- Each graph intersected with `git diff --name-only b2b8a02..HEAD`:

| root | files in the graph | range files in it |
|---|---|---|
| `builder-libraries.test.ts` | 2 | 0 |
| `scripts/builder-unpack.mjs` | 1 | 0 |
| `shot-bundle.test.ts` | 8 | 0 |
| `shot-bundle-in-place.test.ts` | 297 | 0 |

- Positive control: the same walk from `src/main/ipc/register.ts` reaches 971 files and finds 32 range files.

**tsc — PASS.**
- `-p tsconfig.web.check.json --noEmit` → 25 `error TS`. `-p tsconfig.node.check.json --noEmit` → 10. The bar is ≤ 25 / ≤ 10.
- No range file has an error.
- Logs: `<L>tsc-web.log`, `<L>tsc-node.log`.

**House rules — PASS, over all 117 range paths.**
- Feature isolation: nothing in `src/decision-engine`, `src/main/services/decisions`, the decide tools, or the decisions IPC / preload / shared files imports `/studio/`, `/asset-library/`, the renderer or `features/`.
- `src/decision-engine` imports no electron or Node module.
- No `any` and no `export default` in any range `.ts` / `.tsx`.
- No cross-feature import in the changed `ai-models` / `flows` files.
- Every NEW code file is ≤ 293 lines.

**package.json / lock — PASS.** Neither file is in the range.

**Preload surface — PASS.**
- `src/preload/api/decisions.ts`, read in full, exposes exactly `decisionsDecide`, `decisionsStatus`, `decisionsSettingsSet`, `onDecisionsEvent`.
- The decide envelope is rebuilt as `{ test }` or `{ request }` only.
- The wire types carry has-key booleans only.
- `decisions.test.ts` pins the surface; mutant 4 bites.
- In the live app, the `window.api` keys containing "decision" are exactly those four.

**`src/shared/types/decisions.ts` — PASS.** Its only import is `import type { AiFeatureSource } from './ai-usage'`.

## 15.3 The live checks

Setup:
- **Profile:** `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\decisions-D5-verify\profile`, copied from `source` with robocopy, `settings.db*` excluded (2,325 files; none present).
- **Build:** the worktree's own fresh `out/` (`electron-vite build` 18:29:49 → 18:31:16, exit 0, `<L>build.log`).
- **Launch:** `<K>launch.sh`, CDP 9305, with:
  - `VIDTSX_DECISIONS_JEV_URL=http://127.0.0.1:18481/v1/systemone`
  - `VIDTSX_DECISIONS_OPENROUTER_URL=http://127.0.0.1:18482/api/alpha/decisions`
- **App log confirms both stub URLs:** "decisions: dev stub URL in use for jev (127.0.0.1:18481)" and the same line for openrouter-decisions (127.0.0.1:18482).
- **First CDP call:** `studioRootSet` → success; `studioRootGet` → `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D5\studio-root`.
- **Stub `<K>stub.cjs`** (plain `node:http`):
  - serves D1's recorded Jev numbers per D-r25 (1): noul matched by the exact T3 question, choice by D1's exact T2 dry-run question;
  - answers after 500 ms; the Jev port serves `jev-1.14.0` with `input_tokens` only; the OpenRouter port serves the MSD1 snapshot with `usage.cost`;
  - returns 422 for anything unmatched;
  - has a 401 mode that echoes the bearer token and the start of the state.
- **Log hygiene:**
  - Stub log `<L>stub-log.jsonl` (31 lines): no header, key or state text.
  - App log: the fake keys 0 times, the private state 0 times.
- Every screenshot was looked at.

**2. Keys — PASS.**
- AI → Providers shows a "Decisions" section with the TypeSafe row, and OpenRouter listed under it (`<L>s2-providers-1.png`, `s2-key-saved.png`).
- Before any key, Test is disabled, with the tooltip "Save a TypeSafe key first…".
- I typed `fake-d5-NOT-A-REAL-KEY-0000` into the row and clicked Save changes:
  - `jev` status became `hasKey: true, available: true`;
  - Test became enabled.
- Stub in 401-echo mode:
  - The UI Test button shows "[message withheld: it echoed the request]" (`s2-test-401.png`).
  - A free-form `decisionsDecide` (`featureSource: 'decision-test'`, private state) returned `provider-error` with the same withheld message. It contains neither the key nor the state.
  - The stub took 2 hits, so there was no retry on 4xx.
- Remove + Save flipped the status to `hasKey: false` ("no key"). The `decisions:event` pushes showed false, then true on the re-save.
- Renderer bundle (191 files): the fake key, `sk-or-v1-<hex>`, `sk-ant-…` and long `Bearer …` literals each appear 0 times.

**1. Main stays responsive — PASS.**
- A `studioRootGet` ping loop ran while 20 concurrent `decisionsDecide` calls went out (`featureSource: 'decision-test'`; T3 rows t3-02…08 and t3-10…22).
- 20 / 20 succeeded: `jev`, calibrated, not cached, 549–561 ms each, 562 ms wall in total.
- **Max ping gap: 19 ms** (3,674 pings during the calls, 5,101 in total). The bar is ≤ 250 ms.
- Stub hits +20. File: `<L>s1-result.json`.

**3. The flow node — PASS.**
- Flow `01M69CZZ93YQWMJFG5GPX5N6WK`: `input_text` ×2 wired to `item` and `request` of `check_matches_request`. Three runs per D-r25 (2):

| row | label | band | answer | p |
|---|---|---|---|---|
| t3-01 | true | act | yes | 0.96 |
| t3-09 | false | act | no | 0.98 |
| t3-27 | true | escalate | yes | 0.88 |

- The stub matched all three exactly.
- `p` is a number in each `run.json` on disk: `<profile>\flows-runs\01M69CZZ…\{8233050b…, dd1d6535…, 18a4f017…}\run.json`.
- The canvas node shows "escalate", with handles `in:item`, `in:request`, `out:band`, `out:answer` — no `p` handle (`<L>s3-canvas-edit2.png`).
- The run view shows only "Band: escalate" (`s3-canvas-2.png`).
- File: `<L>s3-result.json`.

**4. The agent tool — PASS (1 keyless run).**
- The agent: scratch unsigned `d5/decide-probe` (`tools: ['decide']`), installed only in my profile. Its AGENT.md gives D1's T2 framing for t2-01.
- The run took 10,375 ms and replied "TOOL TEXT: Decision: cut (act)".
- `calls.json` at `<profile>\agent-sessions\d5.decide-probe\s-b0673389\` holds one `decide` record. Its args equal D1's dry-run framing (state, instructions, options, `family: routing`), and it has no `isError`.
- The stub took 1 hit, matched `t2-01:exact`.
- My kit test `<K>decide-text.d5.test.ts` (outside `src/`):
  - recomputes through `readSystemOneAnswers` → `isDecisionCalibrated` → `decisionOutcome` → `decisionText`, giving "Decision: cut (act)", calibrated;
  - asserts the agent's quote equals that text and passes the whole-word no-claim test;
  - result `Tests 1 passed (1)` (`<L>s4-kit-test.log`).
- The usage row has `featureSource: 'decision-agent'`, `requestType: 'decision'`, `provider: 'typesafe'`, 339 input tokens, `costUsd 0.000014238` = 339 × 0.042 / 1e6.
- Files: `<L>s4-result.json`, `<L>s4-usage.json`.

**5. Settings — PASS.**
- With `mode: 'off'`, a new request answered `no-provider` ("Decisions are switched off in Settings.") with zero new stub hits. The counters stayed 26 / 0 and the log stayed at 30 lines.
- After check 4, I saved a fake OpenRouter key through its "API keys" row, then set `mode: 'auto'` and `hostedOrder: ['openrouter-decisions']`. Jev's status then read `enabled: false`, "switched off in Settings".
- A noul sent without criteria was answered by `openrouter-decisions`:
  - model `microsoft/microsoft-decision-1-20261009`, calibrated, p 0.08, 137 tokens, $0.000005754 (the stub's cost);
  - the OpenRouter port was hit once (Jev +0), path `/api/alpha/decisions`, with `noulCriteria: [true]`.

**6 — DEFERRED-HASAN.**
- The live test with the real keys ran here: §15.1 above, PASS, 4 requests.
- Two items need Hasan's key inside the app, which only he can enter:
  - §15.3 1's "during 5 real Jev calls";
  - one real `check_matches_request` run with his key.
- These are not a FAIL.

**Cleanup (18:41:05).** I stopped only the electron.exe processes whose command line holds `decisions-D5-verify` (4 PIDs) and my stub (1 node PID). Ports 9305, 18481 and 18482 are free. The launcher job reported exit 127 only because its exec'd electron was killed.

## 15.4 Notes (never a FAIL)

- MSD1's cold first call took 2,626 ms. It is excluded by the bar, and no latency came near a bound.
- Jev's probabilities sum to 1 within 1e-6 after renormalisation.
- There is no local rung. With `jev` taken out of the order, `skipped` lists only `local` — D-r27 note (a).

## Notes (not a FAIL)

- `shot-module-resolver.test.ts` was red in 2 of my 3 full runs. It is the load suite of DRIVING's rule, green alone and in try 3, and outside the range.
- Three files that were already over 300 lines at `b2b8a02` grew a little: `electron.d.ts` 656 → 661, `channels.ts` 654 → 660, `flows.ts` 351 → 353.
- The agent runtime's own claude-subscription turn wrote no usage row; only the decide call did.
- `<K>node_modules\` is vitest's cache from my kit-config run, outside the worktree.

## Comparison with the builders' record (read after measuring)

The `Status.md` row (line 10, "D4 BUILD DONE … D5 has not run yet") and `TESTING.md` §20 are present. Where both of us measured, the numbers agree:

| term | builders (TESTING §20) | mine |
|---|---|---|
| vitest gate | 3 failed / 564 passed / 7 skipped (574); 9 / 5890 / 39 (5938) | identical (try 3) |
| tsc web / node | 25 / 10 | 25 / 10 |
| §15.3 1 max gap | 20.4 ms | 19 ms |
| §15.3 3 bands | act-yes-0.96, act-no-0.98, escalate-yes-0.88 | same |
| §15.3 4 tool text | "Decision: cut (act)" | same |
| §15.3 4 usage | 416 tokens / $0.000017472 | 339 tokens / $0.000014238 |
| §15.3 5 | 0 hits on `off`; OpenRouter port hit with criteria | same |
| §15.1 live test | written, not run | run here: PASS |

The §15.3 4 token counts differ because each side's stub makes its own estimate (D-r26 (4)); both costs equal tokens × 0.042 / 1e6.

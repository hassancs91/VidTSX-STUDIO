# D6 — does Jev's T3 40 / 40 hold in a PRODUCT-SHAPED request? (Hasan's answer 1 at the session-3 stop)
status: DONE — D6 builder 2026-10-31 19:27 (as of `da51e0c` + this file / LOG): the live run ran ONCE, 40 / 40 requests, verdict **HOLDS** (see
"Results"). Opened NEW by the orchestrator 2026-10-31 19:18; ruling D-r29 (ORCHESTRATOR.md "Rulings (session 3)") is the brief's authority.

> Branch `decision-models`, worktree `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\wt` (paths below relative to it unless absolute).
> A MEASUREMENT, not a build: nothing in `src/` changes; the code lives in the kit `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D6\`;
> outputs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D6\`; only this file + `D6/LOG.md` are committed.

## Goal

D2 §15.1 marks Jev's answers `calibrated: true` for family `verify` because D1 measured T3 40 / 40, Brier 0.003 — but ONLY in D1's framing
(state = a fixed task rule, the row's evidence inside the question, 40 questions packed in one request; D-r16). A free-form `decide` with
`family: 'verify'` gets the same stamp while its caller may send the evidence AS the state. Hasan (2026-10-31): measure it before anyone relies
on it. Scope (the orchestrator's proposal he said yes to): **the 40 T3 rows, Jev only, one row per request, ≤ 40 hosted requests (~$0.01)**.

## The framing (fixed — D3's product-shaped note, `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D3\d-run.cjs:32-39`, verbatim)

- `state` = the T3 row's own `question` text (`src/main/services/decisions/benchmark/fixtures/t3-verify.json` `rows[i].question` — the same
  text D1 wrote; it carries the item and the request).
- ONE `noul` question, key = the row id, `instructions` = `Does the item really do what the request asks, by plain meaning?`, `criteria` =
  D1's T3 criteria (`CHECK_MATCHES_CRITERIA` in `src/main/services/agents/tools/check-matches-request.ts`, = D1's `NOUL_T3`).
- Request: `provider: 'jev'` (pinned), `family: 'verify'`, `featureSource: 'decision-test'`, the engine's default 15 s budget; rows sent ONE AT
  A TIME (sequential).

## The bar (fixed BEFORE measuring — D-r29)

"The 40 / 40 holds in the product shape" iff §15.1's live-bar terms for Jev hold on these 40 requests: **≥ 38 / 40 right, Brier ≤ 0.05,
0 errors, p95 per request ≤ 2,000 ms**. Reported beside it (never changing the verdict): the band counts at threshold 0.9 through the tree's
`decisionOutcome` — act-right, **act-wrong (a wrong answer the gate would ACT on)**, escalate — plus ECE, selective ≥ 0.5 / 0.7 / 0.9, per kind
(template / caption / clip), Arabic, latency p50 / p95, tokens, cost, the served model, `calibrated`. Compared with D1's framing: `c-hosted.md` §2
Jev T3 (40 / 40, Brier 0.003, ECE 0.044, sel ≥ 0.9 100.0 % at 97.5 % coverage) and D5's live run (40 / 40, Brier 0.0031, 279 ms for the packed
request). **The confound is stated, not removed:** one row per request vs D1's 40 packed — a difference may come from the framing OR the packing
(a D1-framed one-row-per-request control would cost 40 more requests; offered to Hasan, not run).

## Steps

1. **Kit code** (no `src/` change): a vitest file + its config in the kit that imports the TREE's modules (`src/decision-engine`, 
   `src/main/services/decisions/decision-init.ts` `registerDecisionProviders`, `benchmark/live-run.ts` `createRequestCap` / `LIVE_KEY_ENV`,
   `benchmark/score.ts` `scoreNoulAnswers`, `src/shared/decisions-outcome.ts` `decisionOutcome`) — the `live-run.ts` pattern: a fresh
   `DecisionEngine`, `registerDecisionProviders` with ONLY the Jev key from `process.env[LIVE_KEY_ENV.jev]` (refuse before any request if blank),
   the real `fetch` wrapped by `createRequestCap(fetch, 40)` (HARD cap — a retry counts; past 40 a call throws without the network), skipped
   unless `VIDTSX_D6_LIVE=1`.
2. **Dry run (no network):** the same code with a stub fetch that answers every body with a fixed `noul` — assert 40 HTTP bodies, each `{ model:
   'jev-1.14.0', state: row.question, questions: { [row.id]: { type: 'noul', instructions: <the D3 text>, criteria: <D1's T3> } } }`, compared with
   D3's `productShaped('t3', …)` output (built from the same fixture) row by row; key scan of everything the kit writes.
3. **The launcher** `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D6\product-shape-live.sh`: `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D4\live-test.sh`
   with ONLY its last lines changed (`VIDTSX_D6_LIVE=1`, the output path, `exec` vitest on the kit file / config); prove the sourcing block is
   byte-identical (`diff` of the line ranges, exit 0), `bash -n` OK, no `echo` / `set -x` / `printenv` / `env` / `cat` outside comments.
4. **The live run, ONCE:** `bash D:/repos/VidTSX-STUDIO/.vidtsx-temp/decisions/D6/product-shape-live.sh` → a result JSON of numbers + per-row
   `{ id, kind, arabic, label, pTrue, top, band, answer, latencyMs, inputTokens, costUsd, model, calibrated, error? }` (no state text, no key,
   no header) + a D1-format answer file (`{ format, candidate, task, mode, answers: [{ qid, pTrue }] }`) so the tree's scorer AND D1's
   `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\score.cjs` can re-score it. If the run stops early (cap, 429, network), do NOT run again —
   record it and hand back.
5. **Record** the numbers in this file ("Results"), against the bar and beside D1's framing; one LOG line; commit this file + LOG only.

## Rules (binding)

Work only in the worktree + the kit / output folders; never npx / npm in the worktree; never git stash; never touch the main checkout. No
`src/` change, no new npm package, no Python. Keys: ONLY through the launcher (it sources Hasan's two gitignored `.env` files exactly as
`D1\hosted-live.sh` / `D4\live-test.sh` do) — never open, read, grep, print or copy a `.env`, `settings.db*`, `~/.claude` or any credential
store; never print, log or write a key. ≤ 40 hosted requests (the whole run's ledger after this: ≤ 44 / 60, ≤ $0.50). Edit docs with the
Edit / Write tools only. `date` for every time written. Commit with explicit paths, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
Never push, merge or rebase. A probability is never shown to the user or the assistant as a claim.

## Results

Live run 2026-10-31 19:25:05 → 19:25:15 MEST (result file `startedAt` 17:25:06.082Z, `finishedAt` 17:25:15.112Z), ONCE, through
`D6\product-shape-live.sh`. Kit as of `da51e0c`; nothing in `src/` changed.

### Verdict against the bar (D-r29, fixed before measuring): **HOLDS** — every term met

| term (§15.1 live bar, Jev) | bar | measured | met |
|---|---|---|---|
| right | ≥ 38 / 40 | **40 / 40** (40 answered, 0 missing) | yes |
| Brier | ≤ 0.05 | **0.0042** (0.0042375; 0.004 at D1's 3 dp) | yes |
| errors | 0 | **0** | yes |
| p95 per request | ≤ 2,000 ms | **256.8 ms** (all 40 requests, cold one included) | yes |

Beside it (never changing the verdict): **bands at threshold 0.9 through the tree's `decisionOutcome`: act-right 36, act-wrong 0, escalate 4**
(act-wrong = 0, so nothing is flagged). ECE 0.056. Selective: ≥ 0.5 100.0 % (100.0 % coverage), ≥ 0.7 100.0 % (100.0 %), ≥ 0.9 100.0 %
(90.0 %). Latency: p50 220.5 ms, p95 256.8 ms (all 40); warm (39) p50 220.5 / p95 256.8; cold (the first request) 446.8 ms; per row 186.6 …
446.8 ms; the 40 sequential requests took 9.03 s wall (`startedAt` → `finishedAt`).

### Side by side with D1's framing (same 40 rows, same model `jev-1.14.0`)

| | **D6 — product shape** (state = the row's text; one row per request) | D1 framing — `c-hosted.md` §2 Jev T3 (state = the task rule; 40 packed) | D5 live — D1 framing through the product path |
|---|---|---|---|
| accuracy | **100.0 (40 / 40)** | 100.0 (40 / 40) | 40 / 40 |
| Arabic | 100.0 (7 / 7) | 100.0 (7 / 7) | — |
| Brier | **0.0042** | 0.003 | 0.0031 |
| ECE | 0.056 | 0.044 | — |
| sel ≥ 0.5 / 0.7 / 0.9, acc % (cov %) | 100.0 (100.0) · 100.0 (100.0) · **100.0 (90.0)** | 100.0 (100.0) · 100.0 (100.0) · 100.0 (97.5) | — |
| requests | 40 (one question each) | 1 (40 questions) | 1 |
| latency | p50 220.5 / p95 256.8 ms per request; 9.03 s for all 40 | 342 ms (D1's answer file, its one request) | 279 ms |
| input tokens | 16,706 (all 40 requests) | 6,087 | — |

Per row against D1's answer file (`D1\answers\hosted-jev-t3-noul.json`): 0 answer flips, mean |Δp| 0.0182, max |Δp| 0.07. Reliability (ALL):
D6 0.0–0.1 n 18 (freq 0.000) · 0.1–0.2 n 2 (0.000) · 0.8–0.9 n 2 (1.000) · 0.9–1.0 n 18 (mean p 0.942, freq 1.000) — D1: 19 · 1 · 1 · 19
(mean 0.944). At 0.9, D1's framing would escalate 1 row (t3-27); the product shape escalates 4 — all four right, none acted on wrongly.

### Per kind + Arabic (tree scorer; D1's `score.cjs` gives the same at 3 dp)

| group | rows | right | Brier | ECE | sel ≥ 0.9 acc % (cov %) |
|---|---|---|---|---|---|
| template | 16 | 16 | 0.0043 | 0.057 | 100.0 (87.5) |
| caption | 10 | 10 | 0.0029 | 0.051 | 100.0 (100.0) |
| clip | 14 | 14 | 0.0051 | 0.059 | 100.0 (85.7) |
| Arabic | 7 | 7 | 0.0083 | 0.076 | 100.0 (71.4) |
| English | 33 | 33 | 0.0034 | 0.052 | 100.0 (93.9) |

### The rows the gate would not act on (escalate at 0.9) — and the act-wrong rows

| id | kind | Arabic | label | pTrue (D6) | pTrue (D1 framing) | band |
|---|---|---|---|---|---|---|
| t3-07 | template | yes | true | 0.87 | 0.9 | escalate |
| t3-12 | template | no | false | 0.12 | 0.07 | escalate |
| t3-27 | clip | no | true | 0.89 | 0.88 | escalate |
| t3-37 | clip | yes | false | 0.17 | 0.1 | escalate |

Act-wrong rows: **none** (0 / 40). Wrong rows: none.

### Requests, cost, model, calibration

HTTP: **40 reached the network, 40 attempts (no retry), cap 40**; stopped early: no; rows sent 40. Cost $0.000701652 (the engine's
`usage.costUsd` summed; = 16,706 input tokens × the preset's $0.042 / M). Served model `jev-1.14.0` on 40 / 40 rows; `calibrated: true` on
40 / 40; cached 0. Ledger: D6 used 40 of its ≤ 40; with the run's earlier hosted calls the whole run's ledger is the "≤ 44 / 60" the Rules line
above sets. Keys: only through the launcher (it sourced the two `.env` files; the builder never opened, read or printed them).

### The confound (stated, not removed)

Two things changed at once against D1: the FRAMING (state = the row's own text + a short generic question, vs D1's fixed task rule + the
evidence inside each question) and the PACKING (one row per request vs 40 packed in one). The shift seen here — Brier 0.0042 vs 0.003, ECE
0.056 vs 0.044, 4 escalations at 0.9 vs 1 — cannot be split between the two. One run each, so request-to-request variance on the same model is
not measured either. The separating control (D1's framing, one row per request) costs 40 more requests — offered to Hasan, not run.
Side facts of the shape: 2.74× the input tokens of the packed request (16,706 vs 6,087) and 9.03 s of sequential wall time for 40 checks vs
279 ms for D5's one packed request.

### Commands, outputs, files

1. Dry run (no network, fake key) — `cd /d/repos/VidTSX-STUDIO/.vidtsx-temp/decisions/D6 && node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config D:/repos/VidTSX-STUDIO/.vidtsx-temp/decisions/D6/vitest.config.mts product-shape.test.ts`
   (19:23:57, then again with `--reporter=verbose` 19:24:05) → `Tests 4 passed | 1 skipped (5)` both times; dry files in
   `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D6\dry\`. D1's scorer on the dry answer file (`--out …\D6\dry\score-dry`) = the tree's
   numbers (Brier 0.4709, ECE 0.470 for the fixed stub answer).
2. Launcher proofs before the run — LOG.md 19:24 line (`diff` lines 8-15 and 1-15 exit 0, `cmp` 1-15 exit 0, sha256 `4fac37ec…35fad` both;
   full diff = `16,19c16,21` only; `bash -n` exit 0; no-echo scan no match; 0 CR bytes).
3. Live run — `bash D:/repos/VidTSX-STUDIO/.vidtsx-temp/decisions/D6/product-shape-live.sh --reporter=verbose 2>&1 | tee C:/Users/hasan/AppData/Local/vidtsx-e2e/decisions/D6/live-run-console.log`
   (`--reporter=verbose` passed through the launcher's `"$@"`) → `Tests 1 passed | 4 skipped (5)`, `Duration 9.61s`, pipeline exit 0; printed
   `requests reached the network: 40 (attempts 40)` and `rows sent: 40; stopped early: no; verdict: holds; key scan hits: 0`.
4. Tree re-score from disk — `VIDTSX_D6_RESCORE=<answer file> VIDTSX_D6_RESULT=<result file> node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config D:/repos/VidTSX-STUDIO/.vidtsx-temp/decisions/D6/vitest.config.mts rescore.test.ts --reporter=verbose`
   → `Tests 1 passed (1)`; `ALL: 40 / 40 (answered 40), Brier 0.0042, ECE 0.056, sel 0.5: 100.0 % (100.0 %) · 0.7: 100.0 % (100.0 %) · 0.9:
   100.0 % (90.0 %)`; `latency all p50 220.5 p95 256.8 · warm p50 220.5 p95 256.8 · cold 446.8`; `bands @0.9: {"actRight":36,"actWrong":0,"escalate":4}`.
5. D1 re-score — `node D:/repos/VidTSX-STUDIO/.vidtsx-temp/decisions/D1/score.cjs C:/Users/hasan/AppData/Local/vidtsx-e2e/decisions/D6/answers-hosted-jev-product-t3-noul-2026-10-31T17-25-15-113Z.json --out C:/Users/hasan/AppData/Local/vidtsx-e2e/decisions/D6/score-hosted-jev-product-t3-noul-2026-10-31T17-25-15-113Z`
   → exit 0; `| ALL | 40 | 40 | 40 | 100.0 | 0.004 | 0.056 | 100.0 (100.0) | 100.0 (100.0) | 100.0 (90.0) |`; latency `| all | 40 | 220.5 | 256.8 |`;
   unrounded Brier 0.0042375, ECE 0.05625 (= the tree's); `D1\reports\` untouched (0 files named `*product*`).
6. Key scan of every output file — 0 `sk-` / `Bearer`; the 7 long-token matches are all this run's own file names; the kit sources hold only
   the fake key `sk-test-FAKE-d6-0061` and the scan patterns.

Files — kit `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D6\`: `product-shape.ts` (the run), `product-shape.test.ts` (dry + live),
`rescore.test.ts`, `vitest.config.mts`, `product-shape-live.sh`. Outputs `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D6\`:
`product-shape-result-2026-10-31T17-25-15-113Z.json` (numbers + per-row `{ id, kind, arabic, label, pTrue, top, band, answer, right, outcome,
latencyMs, inputTokens, costUsd, model, calibrated, cached, http }`; no state text, no key, no header),
`answers-hosted-jev-product-t3-noul-2026-10-31T17-25-15-113Z.json` (`vidtsx-d1-answers/1`), `score-hosted-jev-product-t3-noul-2026-10-31T17-25-15-113Z.{json,md}`,
`score-console-2026-10-31T17-25-15-113Z.log`, `live-run-console.log`, `dry\`.

## Agents so far

- D6 builder (2026-10-31 19:18 → 19:27): kit + dry run + launcher proofs + the live run ONCE (40 requests) + both re-scores + this "Results";
  commits this file + LOG.md only.

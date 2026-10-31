# D6 — does Jev's T3 40 / 40 hold in a PRODUCT-SHAPED request? (Hasan's answer 1 at the session-3 stop)
status: NEW — orchestrator 2026-10-31 19:18; ruling D-r29 (ORCHESTRATOR.md "Rulings (session 3)") is the brief's authority.

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

(none yet)

## Agents so far

(none yet)

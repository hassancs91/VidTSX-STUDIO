# D1 — the spike: decision models (hosted × 2, local, keyless LLM baseline) on three small task sets (no product code)
status: IN PROGRESS — steps 1–2 DONE (builder #1 15:58, builder #2 16:12, 2026-10-30); step 3 PART DONE (builder #3, 16:27: route
settled, runner `K\laya-run.cjs` written; weights downloading under the orchestrator, D-r5); **steps 5 + 6 DONE (builder #4, 16:47:
keyless baseline 16 / 40 calls, scored; hosted runners dry-run, no network)**; step 4's adapter `K\llama-run.cjs` NOT written yet

> Branch `decision-models`, worktree `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\wt` (paths below are relative to it).
> The orchestrator's state: `docs/studio/decisions/ORCHESTRATOR.md` — its "Answers in force" (Hasan's D-a…D-h, verbatim) and its
> rulings **D-r1** (the rule with no hosted key) and **D-r2** (wrong-confident with probabilities) bind this part.
> **No `src/` change in D1.** The only tree files D1 writes are this HANDOFF.md, `LOG.md` beside it and
> `docs/studio/decisions/D1-spike-report.md`.

## Goal (Hasan's D1 text, verbatim)

D1 — THE SPIKE (no product code; scratch kits outside the tree). (a) Verify from PRIMARY docs (provider docs,
model cards, repos — not aggregator blogs) for every candidate in D-a…D-c: the request / response contract,
question types, limits (context, options per question, batch), languages (Arabic: yes / no / unknown),
pricing, data retention, licence, weights / runtime / size; record contradictions with the search summary.
(b) Three SMALL task sets, written as committed-style fixtures in the kit, labelled by plain meaning:
T1 = library search's pick + "nothing fits": S1's 240-row sample (.vidtsx-temp\search\S1\, the (d) rows:
187 named / 53 ∅) over the top-20 of S1's (c) RRF60 list, asked as `noul` per candidate ("Is <clip
description> the sound of <prompt>?") AND as one `choice` over the 20 + "none of these" where the model's
limits allow; T2 = routing, ~40 Studio-assistant requests → the tool family (cut / audio / shots / captions /
export / none), 10 in Arabic; T3 = verification, ~40 yes / no pairs from the app's own data (e.g. "does this
library clip's description match this script line?"). (c) Run every candidate that has a key / runs locally:
accuracy; calibration (Brier, ECE over 10 bins, a reliability table); selective accuracy at P ≥ 0.5 / 0.7 /
0.9 (act above, escalate below); T1's wrong-confident rate and correct-"none" rate vs the assistant's pick in
S1 (R@1 80.7 %, wrong-confident 6.3 %, correct none 79.2 %) and vs (c)'s order (top-1 72.2 %); the Arabic
subset; latency p50 / p95 (local cold + warm on THIS laptop, hosted end to end); cost per 1,000 decisions; local
disk + RAM + licence. The keyless claude-subscription answers the same questions as the LLM baseline (JSON,
no calibrated probability). Write docs/studio/decisions/D1-spike-report.md with the tables and a
recommendation by this rule: the local default = the smallest local candidate whose T1 + T2 accuracy is
within 5 points of the best hosted one, Brier no worse than 0.05 above it, warm p95 ≤ 300 ms and ≤ 2 GB
RAM; prefer the one with Arabic. STOP and ask me if no local candidate meets the rule, if no decision model
beats the keyless LLM baseline on T1's wrong-confident rate, or if the numbers point to a different design.

**Exit (orchestrator):** `docs/studio/decisions/D1-spike-report.md` committed, every number in it from a report file of the kit
(named in the report), with: (a) the primary-docs table per candidate (URL + date read per fact; "unknown" where no primary source
says; the contradictions with `NEXT-SESSION.md`'s summary); (b) the three task sets' composition (rows, labels, who labelled, the
Arabic rows); (c) per candidate × task set: accuracy, Brier, ECE, the reliability table, selective accuracy at 0.5 / 0.7 / 0.9; T1's
R@1 / pick acc / wrong-confident / correct none / false none at each τ (D-r2) beside S1's references; the Arabic subset; latency
(cold, warm p50 / p95 with the CPU load beside it); cost per 1,000; disk / RAM / licence; the keyless baseline on the same
questions; every hosted provider's row marked DEFERRED-HASAN with its runner built + dry-run; the recommendation by the rule as
D-r1 reads it; and the STOP judgement — or `status: BLOCKED` naming which STOP fired, with the numbers.

## Plan context (facts the orchestrator checked at `efa5e0b`, 2026-10-30)

- **Why (read first):** `docs/studio/decisions/NEXT-SESSION.md` ("What the search found" — VENDOR-REPORTED, weeks old, from a web
  search: verify every fact; some candidates may not exist as described) and `docs/studio/search/S1-spike-report.md` §2 (measures),
  §8 (no similarity floor separates ∅ from named: best Youden J 0.665), §10 (the pick sample + prompt template + both pick measures).
- **Keys (orchestrator, 15:45):** `JEV_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY` are UNSET in every scope → every hosted run is
  **DEFERRED-HASAN** (D-d, D-r1). Build each hosted runner and dry-run it (request bodies written to the kit, a hard call counter
  ≤ 600 shared by all hosted runners, a $ estimate from the price page vs D-e's $3 cap, NO network call); a runner reads its key from
  `process.env` only, never prints / logs / writes it, and refuses to start when the key is unset. Never look for keys anywhere else.
- **T1's inputs (S1 kit, READ-ONLY — copy what you need into `K`):** `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\S1\d-sample.json`
  (`rows[240]`: `id`, `source`, `stratum`, `kind` named / ∅, `prompt`, `named[]` = the allowed clip ids, `cls` sfx / music; plus `seed`,
  `batches`, `batchIds`); `…\S1\reports\c-rrf60-multilingual-e5-small-mean.json` `perRow[1515]` → `{ id, ranked[20], scores[20] }` (the
  top-20 of (c), by row id); `…\S1\labelled-set.json` (row meta incl. the `'x|∅'` rows); the clip texts come from the 51-clip fixture
  `src/main/services/library/sound-match-corpus.fixture.ts` (relPath, tags, description, `audio.category`, duration); S1's clip line and
  its prompt template are in S1 report §10 and `…\S1\d-prompt-template.txt`; S1's per-row answers `…\S1\d-responses\`, its measures
  code `…\S1\run-d-pick.cjs` + `eval-lib.cjs` (reuse the definitions; S1 §2 / §10 define R@1 vs pick acc).
- **T2 / T3 sources (the app's own data, repo files only):** the Studio assistant's tool ids `src/main/services/studio/agent-tools/index.ts`
  (`STUDIO_TOOL_IDS`) and the group files (`cut-tools`, `audio-tools`, `shot-tools`, `transcript-tools`, `delivery-tools` …) for T2's
  families; T3 from repo fixtures (e.g. the 51-clip fixture's descriptions vs script / transcript lines from test fixtures, template
  descriptions vs requests). Never Hasan's projects (`~/Videos/VidTSX Studio/projects/*`) or `%APPDATA%\VidTSX Studio`.
- **What the app already has (versions read from `D:\repos\VidTSX-STUDIO\node_modules`, 15:52):** `node-llama-cpp` 3.18.1 (prebuilt
  `@node-llama-cpp/win-x64`, `win-x64-cuda`, `win-x64-cuda-ext`, `win-x64-vulkan`; the laptop has an RTX A3000 6 GB),
  `onnxruntime-node` 1.24.3 (win32 x64 binding + DirectML), `@huggingface/transformers` 4.0.1. The app's local GGUF catalog
  `src/llm-engine/model-registry.ts` (e.g. `qwen2.5-0.5b-q8` 531 MB, `qwen3.5-0.8b-q8` 812 MB, `gemma-3-1b-q8` 1.07 GB, `qwen3.5-2b-q4km`
  1.28 GB — read the entries for URLs / licences) — prefer a catalog entry for the node-llama-cpp adapter (a first-use download the app
  already knows) and say why you picked it. The provider code: `src/engine/{llm-engine,types,presets}.ts`,
  `src/engine/providers/{openai-compat-provider,local-llm-provider}.ts` (OpenRouter preset `presets.ts:27`).
- **Kit scripts resolve packages** from the main checkout's `node_modules` by walking up from `K` (S1's kit did) — read-only use, never
  install there. A kit under `B` (outside the repo) must `createRequire('D:/repos/VidTSX-STUDIO/node_modules/')` explicitly.
- **D-f (Laya's npm wrapper):** only under `B\npm-scratch\` (outside the repo); first try WITHOUT it (read its published source /
  model card and reproduce the pre / post-processing with the installed `onnxruntime-node` + transformers.js tokenizer); if you install
  it, `npm install --ignore-scripts` into an empty folder, never run its scripts unless shown necessary, and record name / version /
  integrity / size in the report.

## Steps (numbered; hand off at a step boundary when the 30 % rule says so)

1. **(a) Primary docs.** For Jev; the OpenAI Decisions API; Microsoft-Decision-1 (Foundry + its OpenRouter listing); Laya (multilingual +
   English checkpoints, its repo / model card / npm wrapper); the SemIf method (its repo / paper) + the tiny GGUF(s) you will use with
   node-llama-cpp (model cards: licence, languages incl. Arabic, size) + node-llama-cpp 3.18.1's API for next-token probabilities (its
   docs / types in `node_modules`); Liquid D1-Omni-600M (and D1-3B as a note): contract, question types, limits, Arabic, pricing,
   retention, licence, weights / runtime / size, with URL + date read per fact. Aggregator blogs are not sources (list them as
   "secondary, not used"). A candidate with no primary source → "not verified" and it drops (say so). → `K\reports\a-sources.md`.
2. **(b) The three task sets + the measures.** `K\fixtures\t1-pick.json` (240 rows × top-20, the noul questions and the choice question
   per row, the allowed answers; flag the `'x|∅'` rows), `t2-routing.json` (~40, 10 Arabic, families cut / audio / shots / captions /
   export / none, an allowed set where two fit), `t3-verify.json` (~40 yes / no, roughly balanced, `source` per row) — each row with
   `labelledBy`; the measures lib (accuracy, Brier, ECE over 10 equal-width bins, the reliability table, selective accuracy at 0.5 / 0.7 /
   0.9 with coverage, T1's S1 measures per D-r2, the Arabic subset), self-checked on synthetic answers (an oracle → Brier 0, ECE 0; a
   constant 0.5 on a balanced binary set → Brier 0.25) → `K\reports\b-tasksets.md`.
3. **(c) Local candidate 1 — Laya multilingual** (if step 1 verified it): sizes stated first, resource guard, weights to `B\models\`;
   T1 noul (4,800 pairs) + T1 choice (20 + "none of these" if its limit allows — else say how you fit it), T2 choice, T3 noul; cold load,
   warm p50 / p95 per request AND per question, peak RSS, disk; the CPU load (top processes over 5 s) beside each timing run.
   → `K\reports\c-laya-*.md|json`.
4. **(c) Local candidate 2 — the node-llama-cpp option-probabilities adapter** (SemIf method: options as labelled letters / yes-no,
   the next-token distribution over the option tokens, renormalised) over the tiny GGUF from step 1; the same tasks and measures; GPU
   vs CPU said; + **Liquid D1-Omni-600M** if its weights load in either runtime (else why not). → `K\reports\c-llama-*.md|json`.
5. **(c) The keyless LLM baseline** — the app's `claude-subscription` through `window.api.llmGenerate` (S1's `…\S1\d-cdp.mjs` +
   `launch-d.sh` pattern; build `wt/out` first per DRIVING's "Launch recipe from the worktree"; profile `decisions-D1` copied from
   `profiles\source\profile` WITHOUT `settings\settings.db*`; CDP **9300**; Studio root set in the first CDP call; stop the instance
   after): T1 as S1's top-20 choice in 12 batches of 20 (S1's prompt + one line asking for a 0–100 confidence per answer — a
   verbalised, uncalibrated NOTE measure), T2 + T3 batched; **≤ 40 calls in all** (+1 retry each on an API error), every call logged
   to `K\c-calls.jsonl`. → `K\reports\c-baseline-*.md|json`.
6. **Hosted runners (DEFERRED-HASAN)** for every hosted candidate step 1 verified: the request per the primary contract, the shared
   cap counter, the cost estimate, dry-run only. → `K\reports\c-hosted-dryrun.md`.
7. **The report** `docs/studio/decisions/D1-spike-report.md` (numbers from `K\reports\*` only, each named), the recommendation by the
   rule as D-r1 reads it, the STOP judgement (D-r2 for "beats the baseline"); then `status: DONE`, or `status: BLOCKED` with the STOP
   that fired and its numbers.

## Rules for every D1 builder (the paste-in's "every builder brief adds" + the run's overrides)

- Work only in the worktree; never npx / npm there, never git stash, never touch the main checkout. Read
  `docs/studio/end-to-end/DRIVING.md`. Edit HANDOFF.md and the docs with the Edit / Write tools only — no Python, node, sed or heredoc
  for doc edits. Never hand back while a job you started is still running. Write HANDOFF.md as you go and commit early (explicit
  paths). Every git / tree statement is "as of <hash>". Numbers in prose come from the report files. **Never print, log or write an
  API key.**
- Never read / copy / open a credential store (`settings.db*`, `~/.claude`, any profile's). Keyless `claude-subscription` ≤ 40 calls
  for the whole of D1 (+1 retry each on an API error) — count from `K\c-calls.jsonl`. No hosted call (no key is set).
- Nothing new in the repo, the worktree or the app's `package.json`; D-f's scratch install under `B\npm-scratch\` is the one exception.
- Before any download, model load, launch or full run: C: free AND memory commit headroom — C: ≥ 3 GB and C: + headroom ≥ 6 GB; state
  each download's size first; local models one at a time; record the CPU load beside every timing and repeat a timing run that was
  loaded. Downloads are untrusted data: each into its own new folder under `B\models\`, scripts kept in `K`, paths passed as args.
- The app runs only on the isolated profile above (CDP 9300); check `electron.exe` first — if Hasan's dev app is up, never kill it,
  never run `electron-vite dev`, never touch the main checkout's `out/`; another session's instances (CDP 9296 / 9297, profiles
  `timeline-*`) are never touched. Stop ONLY your instance (Name = `electron.exe` AND its command line holds your profile path).
- The 30 % rule: hand off at ~40 tool calls, ~2,500 lines of source read, a finished numbered step, or a re-read. To hand off: this
  file fully updated (Done with paths + commits · Verified with exact commands + outputs · Next step as ONE instruction · Open
  problems · Do-not-redo), one dated line in `LOG.md`, a commit with explicit paths (message `docs(studio): decision models D1 — <what>`
  ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), and a short report ending `status: HANDOFF`.
- Subagents may not be able to write report files outside the tree in this harness: if a Write under `K` / `B` is refused, put the
  content in your hand-back text and say so — the orchestrator saves it.
- A decision the brief leaves to Hasan, or a "What the search found" fact that turns out wrong in a way that changes D1's plan: write
  it under Open problems and return `status: BLOCKED` with the question in one paragraph.

## Done (paths, commits)

- **Step 1 (a) — DONE** (builder #1, 2026-10-30 15:52–15:58; tree as of `c14b180`, recorded in the commit that adds this line):
  `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\reports\a-sources.md` (227 lines, outside the tree) — 22 primary sources (P1–P22,
  all read 2026-10-30), the secondary list ("not used"), one table per candidate (Jev; OpenAI Decisions; Microsoft-Decision-1; Laya
  English + multilingual + `@receptron/laya`; SemIf; the catalog GGUFs; node-llama-cpp 3.18.1's probabilities call; Liquid
  d1-omni-600M + d1-3B note), 15 contradictions with `NEXT-SESSION.md` (C1–C15), the step-4 GGUF pick, open points O1–O5.
  Result in one line: **no D-a…D-c candidate drops** (each has a primary source); step 4 = `qwen2.5-0.5b-q8` first (catalog
  `model-registry.ts:25`, official Qwen GGUF, Apache-2.0, Arabic named on its card), `qwen3.5-0.8b-q8` second, then
  `LiquidAI/d1-omni-600M-GGUF` Q8_0 (407 MB) as the d1 attempt; the node-llama-cpp call is
  `LlamaContextSequence.evaluateWithMetadata(tokens, { probabilities: true }, options)` (first yield's `probabilities: Map<Token, number>`)
  or `controlledEvaluate` with `generateNext.probabilities` — see a-sources §7.
- **Step 2 (b) — DONE** (builder #2, 2026-10-30 16:02–16:12; tree as of `57c27f8`, recorded in the commit that adds this line). Kit files
  (outside the tree, `K` = `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\`): `build-t1.cjs` → `fixtures\t1-pick.json`; `build-t2-t3.cjs` →
  `fixtures\t2-routing.json` + `fixtures\t3-verify.json`; `measures.cjs` (its header = the answer-file format `vidtsx-d1-answers/1` + every
  definition); `score.cjs <answers.json> [--out <base>]` → md + json; `selfcheck.cjs` → `answers\synthetic\*.json`,
  `answers\s1-pick-top20-t1-choice.json`, `reports\b-selfcheck\<name>.md|json`, `reports\b-selfcheck.md|json|log`; logs
  `reports\b-build-t1.log`, `reports\b-build-t2-t3.log`; the write-up **`reports\b-tasksets.md`** (composition, format, measures, self-check).
  Result: **T1** 240 rows = 187 named / 53 ∅ (31 `'x|∅'`, 10 Arabic), (c) top-1 135 / 187 = 72.2 %, clips = S1's corpus (0 mismatches),
  **4,632** noul questions (music rows have 6 candidates) + 240 choice questions (20 + "none"); **T2** 40 rows, 10 Arabic, 7 two-family rows,
  families mapped to 18 of the 29 `STUDIO_TOOL_IDS` with group file:line; **T3** 40 rows, 20 yes / 20 no, 7 Arabic, 12 source files, every
  file:line checked; **self-check 17 / 17 PASS** incl. S1's own top-20 picks reproducing R@1 151 / 187 = 80.7 %, wrong-confident 15 / 240 =
  6.3 %, correct none 42 / 53 = 79.2 % (and pick acc 170 / 187, false none 13 / 156, the CORPUS / HELD-OUT rows) exactly at every τ.

- **Step 3 (c) Laya multilingual — PART DONE** (builder #3, 2026-10-30 16:15–; see "Step 3 so far" below for the route + files).
- **Step 5 (c) keyless LLM baseline — DONE** (builder #4, 2026-10-30 16:34–16:47; tree as of `b905295`, recorded in the commit that adds
  this line). Kit files (outside the tree, in `K`): `launch-c.sh` (wt/out, profile `decisions-D1`, CDP 9300), `c-cdp.mjs` (S1's driver,
  port / root / ledger changed; budget guard 40 counted calls), `c-build-prompts.cjs` → `c-prompts\{probe,t1-01…12,t2,t3}.txt` (T1 = S1's
  own `top20-NN.txt` + ONE added line asking `{ref, conf}` with a 0–100 confidence; checked: S1 batchIds = the fixture's batches and every
  request's prompt = the fixture row's), `c-run-all.sh`, `c-rerun-06.sh`, `c-answers.cjs` → `answers\baseline-claude-subscription-<t1-choice|
  t2-choice|t3-noul>-<hard|verbalised>.json` (6 files), `reports\c-baseline-<task>-<mode>-<hard|verbalised>.md|json` (score.cjs) and the
  write-up **`reports\c-baseline.md`** + `c-baseline.json`; ledger **`c-calls.jsonl` = 16 counted calls** (probe + 12 T1 + T2 + T3 + the
  t1-06 re-run; no credential logged); responses `c-responses\`; logs `B\logs\{build,app,c-run,c-rerun-06}.log`. Profile
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\decisions-D1\profile` (2,324 files, copied without `settings\settings.db*`); Studio root
  `B\studio-root`. Result (from `reports\c-baseline.md`, model `claude-sonnet-5-5` = S1's): **T1 hard R@1 151 / 187 = 80.7 %, pick acc
  173 / 187 = 92.5 %, wrong-confident 17 / 240 = 7.1 % (4 named / 13 ∅), correct none 40 / 53 = 75.5 %, false none 10 / 156 = 6.4 %**
  (S1 §10: 80.7 % · 90.9 % · 6.3 % · 79.2 % · 8.3 %); same pick as S1 on 225 / 240 rows; T1 choice accuracy 88.8 %; verbalised NOTE at τ 0.5
  wrong-confident 14 / 240 = 5.8 % with R@1 150 / 187 = 80.2 % (τ 0.7: 6 / 240, R@1 127 / 187 = 67.9 %); **T2 100.0 % (40 / 40, Arabic 10 / 10),
  T3 97.5 %** (Arabic 7 / 7); latency per call T1 p50 10,424 / p95 23,370 ms (12 calls of 20 rows), T2 15,776 ms, T3 10,767 ms.
- **Step 6 hosted runners — DONE, dry-run only (DEFERRED-HASAN)** (builder #4, 16:41–16:46): `K\hosted-run.cjs` (jev / openai /
  openrouter-msd1; `--dry-run`, or LIVE with the key from `process.env` only, refuses when unset, shared hard counter `K\hosted-calls.jsonl`
  ≤ 600, $ upper bound ≤ $3 checked before any call); first bodies `K\hosted-dryrun\*.first-body.json` (12), every body
  `B\hosted-dryrun\*.json` (12 MB); write-up **`K\reports\c-hosted-dryrun.md`** + `.json`: **138 requests in all (46 per provider), $0.334
  upper bound** — both caps hold. New primary source read 2026-10-30 16:43: OpenRouter's API reference "Submit a Decisions request"
  (https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request) — noul `criteria` {true,false} is REQUIRED there.

### Step 3 so far (builder #3)

- **Route (1) `laya-ts` — did not run, two reasons (read 2026-10-30 16:16):** (a) its npm name is `laya-ts` (upstream
  `laya-ts/package.json`: `"name": "laya-ts"`, `"version": "0.1.0"`, Apache-2.0, `optionalDependencies` onnxruntime-node / -web `^1.20.0`,
  `"files": ["dist", "scripts/export_onnx.py"]`, `prepack` = tsc build) but **`https://registry.npmjs.org/laya-ts` → `{"error":"Not found"}`**
  — it is not published; the GitHub releases (v0.4.4 … v0.4.18, 2026-10-12 … 10-30) carry only the Python wheel + sdist, and git holds
  TS source with no `dist/` (a tsc build = a new toolchain step); nothing was installed, `B\npm-scratch\` stays empty. (b) Its weights
  come only from `python laya-ts/scripts/export_onnx.py` (laya-ts README.md:5-10) — the HF repos `convaiinnovations/laya` (incl.
  `multilingual/`) and `convaiinnovations/laya-multilingual` hold `model.safetensors` only, no ONNX (HF API tree, 16:17) — and no pip /
  no own export (D-r3). `Agent.load("convaiinnovations/laya", { subfolder: "multilingual" })` would therefore find no `encoder.onnx`.
- **Route (2) taken — community conversion `desplega/laya-onnx` `multilingual/fp32/`** (split `encoder.onnx` + `head.onnx` +
  `tokenizer.json` + `rl_agent_config.json` = laya-ts's own `Agent.load(dir)` layout; its `manifest.json` names `hfRepo
  convaiinnovations/laya-multilingual`, `hfRevision e4e9ddf2…`, a sha256 per file, exported with laya 0.3.21 / torch 2.14 / onnx 1.23,
  opset 18). Why this one over `verdict-models/laya-multilingual` (one 1,290,694,968 B `laya-multilingual.onnx`, "marker_head" family):
  the split layout's pre / post-processing is in the OFFICIAL laya-ts source, so no third-party server code is needed. Its
  `tokenizer.json` sha256 `609d8f4c…` = the official repo's LFS oid.
- **Sizes stated first (HTTP HEAD Content-Length, 16:17):** encoder.onnx 1,230,282,662 · head.onnx 60,101,236 · tokenizer.json 34,363,188 ·
  rl_agent_config.json 472 · manifest.json 1,069 = **1,324,748,627 B**. Resource guard 16:17: C: 29.04 GB free, commit limit 99.70 GB,
  committed 65.53 GB → headroom 34.17 GB, 0 `electron.exe` → pass. Folder: `B\models\laya-multilingual-desplega-fp32\` (new); log
  `B\models\laya-download.log`. One connection ran at ~80 KB/s → stopped; `K\dl-parallel.sh` (ranged parts, 8 / 32 connections) ≈ 0.4 MB/s.
- **Kit files (outside the tree):** `K\dl-parallel.sh` (download only); `K\laya-run.cjs` — Laya's pre / post-processing ported from the
  official laya-ts source (`common.ts` buildQuestionPrefix / sequenceWithState / renderOptions / collateItems, `agent.ts` _encodeItems /
  _decodeRow, `providers.ts` feed / feedHead), `onnxruntime-node` 1.24.3 + `@huggingface/tokenizers` 0.1.3 from the main checkout's
  node_modules (read-only); `--examples` = the worked-example check; `--task t1|t2|t3 --mode noul|choice --out <file> [--limit N]
  [--ep dml]` writes a `vidtsx-d1-answers/1` file with cold load / first answer, per-request latencies, peak RSS and the CPU load (top
  6 processes over 5 s, before + after) in `env`, and the framing in `notes`. The laya-ts source read for it is under
  `B\src-read\laya-ts-main\` (agent.ts, common.ts, tokenizer.ts, providers.ts — reference text, never run).
- **Download state at hand-off (16:27):** `manifest.json` 1,069 B + `rl_agent_config.json` 472 B complete; `tokenizer.json.part0-7`,
  `head.onnx.part0-7`, `encoder.onnx.part0-31` partial — 50 files, 150,076,382 B on disk (encoder parts 90,034,187 B). Every download
  process of this builder was stopped (`Get-CimInstance Win32_Process` with `desplega|dl-parallel` in the command line → 0 left). The
  part counts are fixed by the chunking: **resume with the SAME counts (8 / 8 / 32)** — `dl-parallel.sh` re-reads each part's size and
  continues with `curl -r`. C: 28.68 GB free at 16:27. No hash checked yet (no file complete).
- **Worked examples for the check (in `laya-run.cjs` `EXAMPLES`):** E1 = upstream README.md:557-559 (Hindi `{"body": "मुझसे दो बार शुल्क लिया
  गया, कृपया पैसे वापस करें।"}`, 4 questions; stated: department → `billing` "(confidence: 0.86)"); E2 = the multilingual card's Quickstart
  (Hindi invoice body; stated: department → `billing`); E3 = the README's Arabic state `"تم خصم المبلغ مرتين"` (README.md:623, no stated
  answer — sanity only). These are the only multilingual worked examples with a stated answer found (the laya-ts `fixtures/` hold only
  `option-stability.json`, not model outputs). "Close" for E1 = the 0.86 vs our `confidence` (entropy-based, laya-ts `confidenceFromProbs`)
  AND `answer_confidence` (max p) — the README does not say which; record both.
- **Framing chosen in `laya-run.cjs` (recorded in each answer file's `notes`):** T1 noul = one request per row, its 20 (6 music) candidates as
  20 states × 1 noul question in one forward pass, state `{"request": "<prompt> (a sound effect)|(music)", "clip": <S1 clip line>}`,
  instructions "Is \`clip\` the sound asked for in \`request\`? A loosely related or merely similar clip is NOT a fit."; T1 choice = 21
  options fitted by **Laya's own head budget** (head_max_len 256 → ~11 tokens per option, laya-ts common.ts:128-133), option text
  `<clipId>: <tags> — <description>` so the id + first tags survive the trim, per-row `note` = distinct options / tokens per option;
  T2 = state `{"request": …}`, 6 families with t2's own descriptions; T3 = state = the row question minus its first line, instructions = the
  first line + "A loosely related or merely similar item is NOT a match." Short instructions on purpose: with 21 options the head keeps
  only ~25 instruction tokens.

## Verified (exact commands + outputs)

- `date '+%Y-%m-%d %H:%M'` → `2026-10-30 15:58`; `wc -l …\D1\reports\a-sources.md` → `227`; `grep -c '^| C[0-9]' …\a-sources.md` → `15`;
  `git rev-parse --short HEAD` → `c14b180`; `git status --short` → (clean) before this hand-off's edits.
- node-llama-cpp facts from the installed files (read-only): `node_modules\node-llama-cpp\package.json:3` `"version": "3.18.1"`;
  `dist\evaluator\LlamaContext\LlamaContext.d.ts:221` (`evaluateWithMetadata`), `:256` (`controlledEvaluate`);
  `dist\evaluator\LlamaContext\types.d.ts:415-468` (`SequenceEvaluateMetadataOptions` / `SequenceEvaluateOutput.probabilities`).
- No download, no install, no app launch, no provider / model API call in step 1 (WebSearch / WebFetch of public docs only).
- Step 2 (builder #2, as of `57c27f8`, Node v22.14.0, from `K`): `node build-t1.cjs > reports/b-build-t1.log` → `"named": 187`, `"null": 53`,
  `"xNull": 31`, `"arabic": 10`, `"cTop1Right": 135`, `"cTop1Acc": 0.7219251336898396`, `"ceilingMissIds": [1487]`, `"noulQuestions": 4632`,
  `"noulTrue": 321`, `"clips": 51`, `"s1CorpusMismatches": []`; `node build-t2-t3.cjs > reports/b-build-t2-t3.log` → exit 0, t2 `rows 40`,
  `arabic 10`, `twoFamily 7`, byFamily cut 8 / audio 7 / shots 8 / captions 7 / export 5 / none 5; t3 `rows 40`, `yes 20`, `no 20`, `arabic 7`,
  `sources 12`, `"problems": []`; `node selfcheck.cjs > reports/b-selfcheck.log` → exit 0, last line `**17 / 17 PASS.**`.
  `wc -l` of the kit scripts: build-t1 113, build-t2-t3 196, measures 133, score 91, selfcheck 106; `reports/b-tasksets.md` 223.
  `git status --short` → (clean) before this hand-off's edits. `date '+%Y-%m-%d %H:%M'` → `2026-10-30 16:12`.
- No download, no install, no app launch, no model / provider call in step 2; S1's kit read only (nothing written under `…\search\S1\`).
- Step 3 so far (builder #3, as of `23269e8`): `curl -sS https://registry.npmjs.org/laya-ts` → `{"error":"Not found"}`; GitHub API
  `repos/NandhaKishorM/laya/releases?per_page=15` → assets `laya-0.4.N-py3-none-any.whl` + `laya-0.4.N.tar.gz` only (v0.4.4 … v0.4.18); HF API
  `models/<repo>/tree/main?recursive=1`: `convaiinnovations/laya` + `…/laya-multilingual` → safetensors + tokenizer, no `.onnx`;
  `desplega/laya-onnx` → `multilingual/fp32/{encoder.onnx 1230282662, head.onnx 60101236, manifest.json, rl_agent_config.json, tokenizer.json
  34363188}`; PowerShell `Invoke-WebRequest -Method Head` per file → the same Content-Lengths; guard (16:17) C: 29.04 GB, headroom 34.17 GB.
  `laya-run.cjs` has NOT been executed (no model file complete yet). No install anywhere (`B\npm-scratch\` empty), no app launch, no
  provider call. `date '+%Y-%m-%d %H:%M'` → `2026-10-30 16:27`.
- Steps 5–6 (builder #4, as of `b905295`): guard 16:34 C: 28.55 GB, headroom 31.75 GB, 0 `electron.exe`; 16:41 C: 27.35 GB, headroom
  32.97 GB, 9 `electron.exe` of OTHER sessions (CDP 9341 profile `…\117ddda5…\scratchpad\part2\profile`, CDP 9296 profile `timeline-T`) —
  never touched (they had exited by 16:45); 16:45 C: 27.29 GB, headroom 33.88 GB. Build: `unset ELECTRON_RUN_AS_NODE; export
  NODE_OPTIONS=--max-old-space-size=8192; node D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build` from the
  worktree root → `B\logs\build.log` `rc=0`, 16:36:01–16:39:55, `wt/out` 127 MB, `git status --short` clean after. Profile copy: robocopy
  `/E /XF settings.db settings.db-shm settings.db-wal DevToolsActivePort` → 371.90 MB, `settings.db* in copy: 0`, 2,324 files. First CDP
  call `node c-cdp.mjs root` → `{"set":{"success":true},"get":{"root":"C:\\Users\\hasan\\AppData\\Local\\vidtsx-e2e\\decisions\\D1\\studio-root"}}`
  (again first in `c-rerun-06.sh`, 16:45:55). Probe `node c-cdp.mjs llm probe c-prompts/probe.txt` → `success true`, model
  `claude-sonnet-5-5`, text `OK`, 9,022 ms. `node c-build-prompts.cjs` → exit 0, `problems: []`. `c-run-all.sh` → `B\logs\c-run.log` `ALL
  DONE` 16:44:41, 14 calls all `success true`; t1-06's text CUT at 792 chars (rows 15–20 missing) → `c-rerun-06.sh` → call 16
  `t1-06-rerun` `success true`, 11,077 ms; the 15 rows recoverable from the cut response all match the re-run. `wc -l c-calls.jsonl` → 16,
  16 `"success":true`. Stop: `Get-CimInstance Win32_Process -Filter "Name='electron.exe'"` whose CommandLine is like
  `*vidtsx-e2e*profiles*decisions-D1*profile*` → `Stop-Process` (4 pids, 16:45; again in `c-rerun-06.sh` → `left: 0`); `electron.exe`
  count after → 0. `node c-answers.cjs` → exit 0 (6 answer files, 6 score reports, `c-baseline.md|json`). `node hosted-run.cjs --dry-run` →
  exit 0, keys all `unset`, `totalCalls 138`, `totalUsdUpper 0.334023296`, `fitsCalls true`, `fitsUsd true`; `node hosted-run.cjs
  --provider <jev|openai|openrouter-msd1> --task t2 --mode choice` → `DEFERRED-HASAN: <ENV> is unset — refusing to start …`, rc 2 (×3);
  `hosted-calls.jsonl` absent (no hosted call). `date '+%Y-%m-%d %H:%M'` → `2026-10-30 16:46`.

## Next step (ONE concrete instruction)

**Orchestrator, 16:50 — how a builder knows a weight file landed (no message needed):** each orchestrator download job logs to
`B\models\<name>-download.log`; a file is ON DISK AND USABLE only when its log holds an `ok <path> <bytes>` line with the full size, a
`sha256sum` line, and an `end HH:MM:SS` line — and that sha256 equals the expected one (the `expect sha256` in the log's first line for the
two GGUFs; `manifest.json` in the model folder for Laya's four files). Read the logs only; never touch the jobs. At 16:48 (16 min in,
~0.41 MB/s in all): d1-omni 155.6 / 407.2 MB, Qwen2.5-0.5B 157.3 / 675.7 MB, Laya 243.7 / 1,324.7 MB (tokenizer + head done, encoder
running) — expect d1-omni ≈ 17:15, Qwen ≈ 17:40, Laya ≈ 18:00 (rough). **Order for builder #5:** write `K\llama-run.cjs` (below, no load),
then the d1-omni GGUF load test when it lands, then step 4's Qwen runs when that lands; Laya (step 3) when its files land. One model process
at a time.

**Builder #4, 16:47 — steps 5 and 6 are DONE (see Done).** Next: write the step-4 adapter `K\llama-run.cjs` (node-llama-cpp 3.18.1 option
probabilities per a-sources §7 — `evaluateWithMetadata(tokens, { probabilities: true })`, the next-token distribution over the option
tokens renormalised — with the SAME CLI shape as `K\laya-run.cjs`: `--model <gguf> --task t1|t2|t3 --mode noul|choice --out <file>
[--limit N] [--gpu auto|false]`, writing `vidtsx-d1-answers/1` with cold load / per-request latency / peak RSS / CPU load in `env`)
WITHOUT loading any model, unless the orchestrator has reported the weights landed with sha256 checked — then run steps 3 and 4 per the
plan below (one model process at a time). Never touch the orchestrator's downloads.

**Orchestrator, 16:33 — ruling D-r5 (ORCHESTRATOR.md) re-orders D1:** Hugging Face is slow today for every repo (~75 KB/s per connection,
measured 16:30 on Qwen's own GGUF), so the ORCHESTRATOR holds the weight downloads as its own background jobs (started 16:32, logs under
`B\models\`): the Laya multilingual fp32 resume (builder #3's exact command below), `B\models\qwen2.5-0.5b-q8\qwen2.5-0.5b-instruct-q8_0.gguf`
(675,710,816 B, sha256 `ca59ca7f…44e` from the HF API) and `B\models\d1-omni-600M-gguf\d1-omni-600M-Q8_0.gguf` (407,207,584 B, sha256
`cd94463f…3d3`). **Builder #4: do NOT start, stop or touch any download** (no `curl` / `dl-parallel` of yours; never kill a `curl.exe` /
`bash.exe`). **Your next step = step 5 (the keyless LLM baseline through the app, ≤ 40 calls), then step 6 (the hosted runners, dry-run
only); write the step-4 node-llama-cpp adapter (`K\llama-run.cjs`, no model load) if budget remains.** Steps 3 and 4's measured runs start
when the orchestrator reports the files landed with their sha256 checked. The text below is builder #3's plan for step 3 once the
weights are on disk — the download part of it is the orchestrator's now.

(Builder #3's step-3 plan.) Resume and finish the weights download, then check and run: (1) resource guard (C: ≥ 3 GB, C: + headroom ≥ 6 GB); (2) as ONE
`run_in_background` job, with the SAME part counts: `M=/c/Users/hasan/AppData/Local/vidtsx-e2e/decisions/D1/models/laya-multilingual-desplega-fp32;
K=/d/repos/VidTSX-STUDIO/.vidtsx-temp/decisions/D1; U=https://huggingface.co/desplega/laya-onnx/resolve/main/multilingual/fp32;
L=$M/../laya-download.log; bash $K/dl-parallel.sh $U/tokenizer.json $M/tokenizer.json 34363188 8 >> $L 2>&1; bash $K/dl-parallel.sh
$U/head.onnx $M/head.onnx 60101236 8 >> $L 2>&1; bash $K/dl-parallel.sh $U/encoder.onnx $M/encoder.onnx 1230282662 32 >> $L 2>&1; cd $M &&
sha256sum encoder.onnx head.onnx tokenizer.json rl_agent_config.json >> $L` (≈ 0.4 MB/s → ~50 min for the ~1.17 GB left; wait with a
Monitor, never hand back while it runs — if you must stop it, stop every `curl.exe` / `bash.exe` whose command line holds
`desplega|dl-parallel`); (3) every sha256 must equal `manifest.json`'s (encoder `4bf4feb8…`, head `03f78ddf…`, tokenizer `609d8f4c…`,
rl_agent_config `25061739…`) — else delete the folder and say so; (4) `node K\laya-run.cjs --model <M> --examples` → E1 / E2 must answer
`billing` (E1 near 0.86) BEFORE any measured run — if not, fix the port against `B\src-read\laya-ts-main\` (special ids,
`add_special_tokens: false`, the input / output names it prints in `io`) or stop with "did not run" + the reason; (5) `--task t1 --mode noul
--limit 3` smoke, then the four full runs (`t1 noul`, `t1 choice`, `t2 choice`, `t3 noul`, `--out K\answers\laya-multilingual-<task>-<mode>.json`,
one model process at a time; repeat a timing run whose `cpuLoadBefore/After` shows another heavy process, e.g. vmmemWSL); `node K\score.cjs
<file> --out K\reports\c-laya-<task>-<mode>` each; then a small kit script for the out-of-fold temperature NOTE (2-fold by row id: fit T on one
half, score the other, both directions) and the write-up `K\reports\c-laya.md` (route, files + sizes + hashes, worked-example check, timings
with CPU load, disk, the tables from the score files; DirectML only as a note).

## Open problems

- **P1 (step 3) — Laya multilingual has no OFFICIAL ONNX file — SETTLED by builder #3:** route (1) `laya-ts` did not run (not on npm;
  weights only via a Python export); route (2) = `desplega/laya-onnx` `multilingual/fp32` (see "Step 3 so far"). For D2 / Hasan: an app
  that ships Laya multilingual today would have to ship a COMMUNITY ONNX export or run Python once to export — neither is official.
- **P8 (step 3) — download speed:** Hugging Face served ~80 KB/s per connection, ~0.4 MB/s over 8–32 ranged connections (16:18–16:27);
  the 1.32 GB took longer than this builder's budget. Not a block. For D2: a first-use download of this size at that speed is ~1 h.
- **P9 (step 3, review) — the Laya framing is builder #3's judgement** (state / question split, short instructions, 21 options fitted by
  Laya's own head trim — "Framing chosen" above). A NOTE variant worth one extra run if time allows: T1 choice with the clip lines in the
  STATE and the option ids only (`max_len` 2048, card-sanctioned up to 8,192), so no option text is trimmed.
- **P2 (D2) — D-b's "through the app's existing openai-compat / OpenRouter path" does not hold** (a-sources C7): OpenRouter serves decision
  models on a separate Decisions API (`POST https://openrouter.ai/api/alpha/decisions`, System One body, per OpenRouter's own blog),
  not the chat endpoint. Step 6 builds its runner on that contract after reading OpenRouter's API reference (not read in step 1:
  the model page returned 404 to WebFetch). D2 needs a System One adapter, not the openai-compat provider.
- **P3 (D2, Hasan) — Liquid d1-omni-600M is under LFM Open License v1.0** (commercial use only below $10 M annual revenue — a-sources
  C12): not permissive; any adoption is Hasan's call. Step 4 still tries its official GGUF.
- **P4 (step 3 / D2) — Laya multilingual ships with "no fitted temperatures at all" ("over-confident as shipped")**: raw Brier / ECE
  will look worse than a fitted one; D1 reports raw.
- **P5 (step 4) — catalog size mismatch:** `qwen2.5-0.5b-q8` is 531,000,000 B in `model-registry.ts:31` but Qwen's GGUF card lists Q8_0 at
  676 MB → state the HTTP Content-Length before the download.
- **P6 (steps 3–4, not a block) — T1 noul is 4,632 questions, not the 4,800 of step 3's text:** the 12 music rows' (c) pool is the library's 6
  music clips, so their top-20 is 6 long (228 × 20 + 12 × 6). Their choice question has 7 options (6 + "none").
- **P7 (review, not a block) — T2 / T3 labels and texts are one builder's plain-meaning judgement** (requests / script lines written for D1;
  the repo has no narration fixture). The judgement calls are listed in `b-tasksets.md` §2 (a question about Auto Cut, "Remember …", notes →
  `none`; `transcribe_asset` under captions). The orchestrator or Hasan may overrule a row before step 7; a change means re-running
  `build-t2-t3.cjs` + `selfcheck.cjs` and re-scoring.

- **P10 (step 6, Hasan) — D-e's "≤ 600 hosted decision calls" is read as HTTPS REQUESTS** (the runners pack ≤ 400 questions /
  ≤ 32,000 est. tokens per request → 138 requests for every hosted run). If Hasan meant 600 QUESTIONS, T1 noul alone (4,632 per provider)
  cannot run on any provider. Not a block now (no key is set); Hasan's reading decides before a live run.
- **P11 (step 5, not a block) — one keyless response came back `success: true` but cut mid-JSON** (t1-06, 792 chars; rows 15–20 missing).
  Builder #4 judged it a failed delivery and re-asked the batch ONCE as a NEW counted call (16 of 40), not as a free "API error" retry;
  the answer files use the re-run; `c-answers.cjs` also parses leniently and says so per label. For D2: the app's `llmGenerate` can return
  a truncated text marked success — a JSON-reading caller must validate completeness.
- **P12 (step 7 reference) — "beats the keyless baseline" (D-r2) now has its re-run:** hard reading wrong-confident 17 / 240 = 7.1 % at
  R@1 151 / 187 = 80.7 % (S1: 6.3 %, 80.7 %). So a decision model beats it with wrong-confident < 6.3 % (the lower of the two) at a τ
  where its R@1 ≥ 75.7 % (80.7 − 5). The verbalised NOTE (τ 0.5: 5.8 % at R@1 80.2 %) is not the rule's reference (D-r1: no calibrated
  probability) — step 7 should print it beside, labelled.

## Do-not-redo

- Step 5's 16 keyless calls (`K\c-calls.jsonl`, `K\c-responses\`) — never re-call; re-score with `node c-answers.cjs` (reads the saved
  responses only). 24 keyless calls remain for the whole of D1. Step 6's dry-run (`node hosted-run.cjs --dry-run` is free to re-run; no
  network). The worktree's `out/` is built (as of `b905295`); rebuild only after a `src/` change (D1 makes none).

- Step 1's web reading (P1–P22 in a-sources.md). Later steps add a source only for a gap the table marks "unknown" / "not read"
  that their step needs (e.g. step 6: OpenRouter's Decisions API reference; step 3: `laya-ts`'s weight source).
- Step 2's fixtures, measures, answer-file format and self-check (`K\fixtures\*`, `K\measures.cjs`, `K\score.cjs`, `K\selfcheck.cjs`,
  `K\reports\b-*`). Use them as they are; rebuild only if a T2 / T3 label is overruled (P7). Never re-derive T1 from S1 by hand —
  `build-t1.cjs` is the one path, and S1's kit stays read-only.
- Step 3's route finding (laya-ts unpublished; no official ONNX; desplega split fp32 chosen) — do not re-search npm / HF. Do not restart
  the download from zero: the parts under `B\models\laya-multilingual-desplega-fp32\` resume. Do not re-fetch the laya-ts source: the four
  files are under `B\src-read\laya-ts-main\` and the port is `K\laya-run.cjs`.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-30 · builder #1 · ~38 tool calls · step 1 (a) primary docs → a-sources.md; hand-off at the step boundary.
- 2026-10-30 · builder #2 · ~33 tool calls · step 2 (b) task sets + measures + self-check → b-tasksets.md (17 / 17 PASS); hand-off at the
  step boundary.
- 2026-10-30 · builder #3 · ~52 tool calls · step 3 part 1: route (laya-ts not on npm → desplega split fp32 ONNX), sizes + guard, runner
  `K\laya-run.cjs` + `K\dl-parallel.sh`; download paused at 150 MB / 1.32 GB (slow HF CDN) to hand off at the call budget.
- 2026-10-30 · builder #4 · ~47 tool calls · step 5 (keyless baseline through the app: build, isolated profile, 16 / 40 calls, 6 answer
  files scored, `c-baseline.md`) + step 6 (hosted runners, dry-run: 138 requests, $0.334 upper; OpenRouter's API reference read); hand-off
  at the call budget before `llama-run.cjs`.

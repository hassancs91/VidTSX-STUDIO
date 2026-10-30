# D1 — the spike: decision models (hosted × 2, local, keyless LLM baseline) on three small task sets (no product code)
status: IN PROGRESS — steps 1–2 DONE (builder #1 15:58, builder #2 16:12, 2026-10-30); step 3 next

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

## Next step (ONE concrete instruction)

Step 3 per D-r3: run Laya multilingual on T1 noul (4,632 questions), T1 choice (20 + "none", or say in `notes` how it was fitted), T2
choice and T3 noul — first via the official `laya-ts` npm wrapper of `github.com/NandhaKishorM/laya` under `B\npm-scratch\` only
(`--ignore-scripts`, name / version / integrity / size recorded) if it runs the multilingual checkpoint on `onnxruntime-node`, else a
community ONNX conversion of `convaiinnovations/laya-multilingual` into its own folder under `B\models\` checked against the card's / repo's
worked examples first (no pip, no own export); sizes stated first, the resource guard before any download / load; write each run as a
`vidtsx-d1-answers/1` file under `K\answers\` (format: `K\measures.cjs` header / `K\reports\b-tasksets.md` §4) with cold + warm request
latencies, peak RSS, disk and the CPU load beside each timing in `env`; score each with `node K\score.cjs <file>` and write
`K\reports\c-laya-*.md|json`. If neither route runs, say "did not run" with the reason (the English `@receptron/laya` only as a NOTE).

## Open problems

- **P1 (step 3) — Laya multilingual has no OFFICIAL ONNX file.** `@receptron/laya` (community, MIT) ships only the ENGLISH checkpoint's
  ONNX (`receptron/laya-onnx`: 1.69 GB, no `multilingual` subfolder — a-sources C8, C10). Routes for step 3: the official `laya-ts`
  wrapper in `github.com/NandhaKishorM/laya` (read where it gets weights; D-f's scratch rule) or a community fp32 conversion
  (`verdict-models/laya-multilingual`, `desplega/laya-onnx`) as untrusted data checked against the card's examples. Not a block —
  the candidate exists; step 3 states the route it took and why.
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

## Do-not-redo

- Step 1's web reading (P1–P22 in a-sources.md). Later steps add a source only for a gap the table marks "unknown" / "not read"
  that their step needs (e.g. step 6: OpenRouter's Decisions API reference; step 3: `laya-ts`'s weight source).
- Step 2's fixtures, measures, answer-file format and self-check (`K\fixtures\*`, `K\measures.cjs`, `K\score.cjs`, `K\selfcheck.cjs`,
  `K\reports\b-*`). Use them as they are; rebuild only if a T2 / T3 label is overruled (P7). Never re-derive T1 from S1 by hand —
  `build-t1.cjs` is the one path, and S1's kit stays read-only.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-30 · builder #1 · ~38 tool calls · step 1 (a) primary docs → a-sources.md; hand-off at the step boundary.
- 2026-10-30 · builder #2 · ~33 tool calls · step 2 (b) task sets + measures + self-check → b-tasksets.md (17 / 17 PASS); hand-off at the
  step boundary.

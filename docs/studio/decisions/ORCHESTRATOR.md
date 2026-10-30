# Decision models — orchestrator state

> Run brief: Hasan's paste-in in `docs/studio/decisions/NEXT-SESSION.md` ("Paste-in", :50-147), with that file's
> "Decisions" block (D-a…D-h, :31-46) as his answers — given 2026-10-30 15:45 ("run the fenced Paste-in block … exactly as
> written, with the Decisions block in that file as my answers … it is my instruction for this session"). It follows
> `docs/studio/END_TO_END_RUN.md`'s loop (builders with the 30 % hand-off rule, the stop report, "things you never do") with the
> paste-in's overrides. Parts D1 → D2 run in order with NO stop between them unless a STOP rule fires; **the session STOPS after D2**
> (D-h) for Hasan's review. **No product code in this session.**

- Branch: `decision-models`, cut from `library-search` @ `efa5e0b` (D-g) on 2026-10-30 15:47 +0200, worktree
  `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\wt`. `docs/studio/decisions/NEXT-SESSION.md` (this run's brief) was added on
  `library-search` AFTER `efa5e0b` (`2cc2751`, amended `0df9e9c`); it is brought onto this branch from `0df9e9c` in the first
  commit, unchanged. Not pushed, not merged.
- Start state (15:45): main checkout `end-to-end-p0` @ `5d77600` with the other session's 14 modified + 6 untracked files
  (unchanged; never touched); **Hasan's dev app NOT running** (0 `electron.exe`). **Keys: `JEV_API_KEY`, `OPENAI_API_KEY`,
  `OPENROUTER_API_KEY` all UNSET** (process, user and machine scopes; only set / unset was printed) → per D-d every hosted row is
  **DEFERRED-HASAN**. Resources 15:46: C: 29.4 GB, D: 39.6 GB free; memory commit headroom 33.7 / 99.7 GB; CPU 64 % average of 16
  logical cores over 3 s (top: `vmmemWSL` — external load, not ours).
- A parallel session may run: the assistant-timeline slice in `.vidtsx-temp\search\wt` (branch `library-search`, CDP 9296 / 9297,
  profiles `timeline-T` / `timeline-verify`). Never touch its worktree, branch, profiles, ports or `electron.exe` instances.

| Part | Status | Builders spawned | Re-check | Commit | Numbers | Started / Finished |
|---|---|---|---|---|---|---|
| D1 — the spike (no product code) | BUILDING (step 4; weights downloading, D-r5) | 4 | steps 1–2 (16:00, 16:13); step 3 part 1 (16:31); steps 5–6 (16:50) | docs `ce3f9e4` `71aa0c5` `bfff9d7` `7f72203` | (a): 22 primary sources, 15 contradictions, no candidate drops · (b): T1 240 / T2 40 / T3 40, self-check 17 / 17 | 2026-10-30 15:51 / — |
| D2 — the design note + THE ACCEPTANCE BAR (orchestrator) | TODO | — | — | — | — | — |

No verifier runs in this session: D1 is checked by the orchestrator against its exit (the S1 precedent); D2 fixes the acceptance bar
for a later build + verifier (D-h).

## Answers in force (Hasan, 2026-10-30 — the Decisions block, verbatim)

```
D-a  Hosted provider 1: TypeSafe Jev (the reference System One contract).
D-b  Hosted provider 2: OpenAI Decisions API if Hasan's OpenAI account has access, else Microsoft-Decision-1
     through OpenRouter (the app's existing openai-compat / OpenRouter path). The spike checks access first.
D-c  Local model: spike BOTH (1) Laya multilingual (ONNX on the app's onnxruntime-node) and (2) a node-llama-cpp
     "option probabilities" adapter over a tiny GGUF (the SemIf method — no new package); + Liquid D1-Omni-600M if its
     weights load in either runtime. The keyless claude-subscription is the LLM BASELINE (no calibrated probability).
D-d  Keys: Hasan sets JEV_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY as environment variables BEFORE starting the
     session; spike scripts read process.env only, never print / log / write them. A missing key → that provider's
     rows are DEFERRED-HASAN and the spike runs the rest.
D-e  Hosted spend cap for the whole spike: $3 total, ≤ 600 hosted decision calls; keyless baseline ≤ 40 calls.
D-f  Laya's npm wrapper may be installed ONLY in a scratch kit folder outside the repo (never in the repo, a worktree
     or the app's package.json) for the spike; adopting any package into the app is Hasan's call at the D2 stop.
D-g  Base: a new branch `decision-models` cut from `library-search` @ efa5e0b (search is the first user), new worktree.
D-h  The session STOPS after D2 (spike report + design note + acceptance bar) for Hasan's review — no product code.
```

- **D1's recommendation rule (paste-in, verbatim):** "the local default = the smallest local candidate whose T1 + T2 accuracy is
  within 5 points of the best hosted one, Brier no worse than 0.05 above it, warm p95 ≤ 300 ms and ≤ 2 GB RAM; prefer the one with
  Arabic. STOP and ask me if no local candidate meets the rule, if no decision model beats the keyless LLM baseline on T1's
  wrong-confident rate, or if the numbers point to a different design."
- **D1's references (S1, `docs/studio/search/S1-spike-report.md` §10):** the assistant's pick over the top-20 of (c) on the 240-row
  sample — R@1 80.7 %, pick acc 90.9 %, wrong-confident 6.3 % (15 / 240), correct none 79.2 % (42 / 53); (c)'s order top-1 72.2 %.
- **Overrides (paste-in):** hosted calls only with Hasan's env keys inside D-e's cap — never another paid key; keyless
  `claude-subscription` ≤ 40 calls (+1 retry each on an API error); never read / copy / open a credential store (`settings.db*`,
  `~/.claude`, any profile's); never print a key; nothing new in the repo / worktree / app `package.json` (D-f's scratch install
  outside the repo is the one exception, said in the report); model weights to `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\
  <PART>\models\` with each size stated first and disk checked; isolated profiles only (copied from `profiles\source\profile` WITHOUT
  `settings\settings.db*`; Studio root set in the first CDP call; CDP 9300–9309); never Hasan's `%APPDATA%\VidTSX Studio` library,
  projects or stations; the resource guard (C: ≥ 3 GB and C: + commit headroom ≥ 6 GB before any launch / download / model load /
  full run; local models one at a time; timings with the external CPU load recorded beside them, a loaded latency run repeated);
  DEFERRED-HASAN for anything needing his hands / ears / keys (build + verify up to it, list it, continue); the orchestrator writes
  only docs, commits after each update, logs real-clock times, commits nothing while a builder runs; never push, never merge.
- **Ports / profiles / folders (orchestrator):** D1 builders CDP **9300**, profile `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\
  decisions-D1\profile`. Kit `K` = `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\` (outside the tree; drivers, fixtures, small
  reports); big outputs + models `B` = `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D1\` (D-f's scratch npm folder goes under
  `B`, outside the repo).

## Rulings

- **D-r1 (orchestrator, 15:50 — before any measurement) — the rule with no hosted key.** Every hosted key is unset (D-d), so the
  rule's two hosted terms ("within 5 points of the best hosted one", "Brier no worse than 0.05 above it") are **DEFERRED-HASAN**.
  D1 still applies the rule's other terms (warm p95 ≤ 300 ms, ≤ 2 GB RAM, the Arabic preference) and reports each local candidate's
  T1 + T2 accuracy and Brier beside the keyless baseline's accuracy as a NOTE (the baseline has no calibrated probability; it is not
  the rule's reference). The STOP "no local candidate meets the rule" fires if no local candidate passes the evaluable terms; the
  two other STOP conditions are judged as written. The hosted runners are built and dry-run (request bodies, cap counter, cost
  estimate — no network) so Hasan's keys are the only missing piece.
- **D-r2 (orchestrator, 15:50 — before any measurement) — "wrong-confident" for a model with probabilities.** A decision model's
  T1 answer is a pick when its top option has P ≥ τ, else "none" (abstain); τ ∈ {0.5, 0.7, 0.9}, every table gives all three.
  `choice` mode: the top option over the 20 + "none of these" (a confident "none of these" is "none"). `noul` mode: the candidate with
  the highest P(true), a pick when that P ≥ τ. Wrong-confident, correct none, false none, R@1 and pick acc are S1's definitions
  (§2, §10) over the 240 rows. **"Beats the keyless baseline on T1's wrong-confident rate"** = a lower wrong-confident rate than
  BOTH 6.3 % (S1) and this run's baseline re-run, at a τ where the model's R@1 is no more than 5 points below the baseline's — so
  abstaining on everything never counts as beating it.

- **D-r3 (orchestrator, 16:00) — Laya multilingual's runtime route (builder #1's O1: no official multilingual ONNX).** Step 3 tries, in
  order: (1) the official `laya-ts` package of the upstream repo (Laya's own npm wrapper — D-f covers it: under `B\npm-scratch\` only,
  `--ignore-scripts`, name / version / integrity recorded) if it runs the multilingual checkpoint on `onnxruntime-node`; (2) a community
  ONNX conversion of `convaiinnovations/laya-multilingual`, downloaded as untrusted weights into its own folder under `B\models\` and
  checked against the upstream card's / repo's worked examples before any measured run. **No pip install and no own ONNX export** (a
  new toolchain — Hasan's call). If neither runs, Laya multilingual is "did not run" with the reason, and the ENGLISH checkpoint
  (`@receptron/laya`, ≈ 1.7 GB, size stated first) may run as a NOTE only (no Arabic rows; never the recommended default).
- **D-r4 (orchestrator, 16:00) — D-b's "existing openai-compat / OpenRouter path" (builder #1's C7).** OpenRouter serves decision models
  on its separate Decisions API (`POST https://openrouter.ai/api/alpha/decisions`, System One body — orchestrator spot check ~16:00), so
  the fallback needs a System One adapter with OpenRouter's base URL, not `openai-compat-provider`. Not a block: D-b's order (OpenAI
  first, if Hasan's account has access) stands; D2 designs both adapters; step 6 dry-runs OpenAI's own shape (`input` + `questions[]`,
  `predicate`) and the System One shape (Jev, Microsoft-Decision-1 via OpenRouter).

- **D-r5 (orchestrator, 16:33) — slow downloads: the orchestrator holds them; D1's order becomes 5 → 6 → 3 → 4 → 7.** Hugging Face serves
  ~75 KB/s per connection today for every repo (builder #3: desplega 80 KB/s, ~0.4 MB/s over 8–32 ranged parts; orchestrator 16:30: Qwen's
  official GGUF 3,003,348 B in 40.4 s = 74 KB/s on one connection), so ~2.2 GB of weights takes over an hour — longer than a builder's
  hand-off budget, and a builder may never hand back while its own job runs. The orchestrator therefore runs the three weight downloads
  as its own background jobs with `K\dl-parallel.sh` (read first: curl ranged parts + cat, nothing executed from the downloads), sizes
  stated from HTTP / the HF API before the start, each into its own new folder under `B\models\`, sha256 checked at the end: the Laya
  multilingual fp32 resume (1,324,748,627 B in all, 150,076,382 B already on disk; builder #3's exact command), `qwen2.5-0.5b-instruct-q8_0.gguf`
  675,710,816 B (= the catalog's `fileName`; the catalog's `sizeBytes` 531,000,000 is wrong — builder #1's P5 confirmed), `d1-omni-600M-Q8_0.gguf`
  407,207,584 B. `qwen3.5-0.8b-q8` (812 MB) waits until `qwen2.5-0.5b-q8` has run (builder #1's "SECOND, if the first runs"). Builder #4 does
  step 5 (the keyless baseline — no weights needed) and step 6 (the hosted dry-runs), never touching a download; steps 3 / 4 run when the
  files land; step 7 last.

## Stops

(one line per stop: what was reported, what Hasan said)

## Log

- 15:45 · start checks: main checkout's uncommitted work still there (14 ` M` + 6 `??`, branch `end-to-end-p0` @ `5d77600`); Hasan's dev
  app NOT running (0 `electron.exe`); `JEV_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` unset in every scope.
- 15:46 · resources: C: 29.4 GB, D: 39.6 GB, headroom 33.7 / 99.7 GB, CPU 64 % (`vmmemWSL`).
- 15:47 · branch `decision-models` + worktree `.vidtsx-temp\decisions\wt` @ `efa5e0b`; `NEXT-SESSION.md` checked out from `0df9e9c`.
- 15:50 · this file + `D1/HANDOFF.md` + `D1/LOG.md`; rulings D-r1, D-r2; D1 builder #1 to spawn.
- 15:51 · D1 builder #1 spawned (HEAD `c14b180`; step 1 only, no download / install / launch / call).
- 15:58 · D1 builder #1 HANDOFF (48 calls, ~8 min; **step 1 DONE**, docs `ce3f9e4`): `K\reports\a-sources.md` 227 lines — 22 primary sources
  (P1–P22, read 2026-10-30 via WebFetch, whose page text is a model's extraction — said in the file), secondary sources listed "not used";
  **no D-a…D-c candidate drops**. Contradictions C1–C15 with NEXT-SESSION's summary, the ones that matter: **C5** OpenAI's Decisions API is
  GA (`POST /v1/decisions`, `gpt-6-luna` only, `input` + an ARRAY of 1–400 questions, `predicate` / `choice` / `score` — not System One);
  **C2** Jev 64k per request / 32k per question (262k opt-in), Arabic not named (English "best"); **C7** OpenRouter's decision models live on
  `/api/alpha/decisions` (System One body), not the chat path; **C8 / C10** NEXT-SESSION's Laya numbers (1.7 GB, 2 GB RAM, 512 tokens,
  140 ms) are the community `@receptron/laya` wrapper's ENGLISH bundle — Laya multilingual = mmBERT-base 322M, ≈ 647 MB safetensors, 1,024
  tokens, Arabic weak (0.400 on its card), no fitted temperatures, no official multilingual ONNX; **C12** d1-omni-600M is LFM Open License
  v1.0 (commercial use only under $10 M revenue — not permissive), official GGUF Q8_0 407 MB served by `llama-server` `/v1/systemone`.
  Step-4 pick: `qwen2.5-0.5b-q8` (catalog; Apache-2.0; Arabic named; card says Q8_0 676 MB vs the catalog's 531 MB → Content-Length first)
  → `qwen3.5-0.8b-q8` → d1-omni GGUF. node-llama-cpp 3.18.1: `evaluateWithMetadata(tokens, { probabilities: true })` first yield (or
  `controlledEvaluate` … `generateNext.probabilities`). SemIf's own ladder: 0.6B → 0.440 balanced acc vs 4B 0.813 (a warning for tiny GGUFs).
- 15:59–16:00 · **Orchestrator re-check:** HEAD `ce3f9e4` = HANDOFF + LOG only, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty,
  `B\models\` empty (nothing downloaded); `a-sources.md` read in full. **Independent spot check** (WebFetch, ~16:00): P4 confirms GA,
  `gpt-6-luna` "the only currently supported model", `input` + questions array with `name`, `predicate` / `choice` / `score`, "between 1 and
  400 questions"; P7 confirms `POST https://openrouter.ai/api/alpha/decisions` with `model` + `state` + keyed `questions`, `typesafe/jev-1.14`
  $0.042 / M input, Microsoft-Decision-1 "Text only, $0.042 per million input tokens". Rulings D-r3 (Laya route), D-r4 (C7) above
  (commit `a4fc957`, 16:00:34; its first text said "16:01" / "16:02" — estimates, corrected from the clock). D1 builder #2 (step 2 —
  the task sets + measures) to spawn.
- 16:01 · D1 builder #2 spawned (HEAD `57c27f8`).
- 16:12 · D1 builder #2 HANDOFF (43 calls, ~12 min; **step 2 DONE**, docs `71aa0c5`; no download / install / launch / call; S1's kit read
  only): `K\fixtures\t1-pick.json` (240 rows: 187 named / 53 ∅ / 31 `'x|∅'`, 10 Arabic; (c) top-1 135 / 187 = 72.2 % = S1; one `'x|∅'` row
  #1487 has its allowed clip outside the top-20; noul = 4,632 questions, not 4,800 — the 12 music rows have 6 candidates each),
  `t2-routing.json` (40 rows, 10 Arabic, 7 with two allowed families; cut 8 / audio 7 / shots 8 / captions 7 / export 5 / none 5 by first
  family; mapped to 18 of 29 `STUDIO_TOOL_IDS`), `t3-verify.json` (40 rows, 20 yes / 20 no, 7 Arabic; 16 template / 10 caption-style / 14
  library-clip pairs, every quoted source file:line checked; the requests / script lines are the builder's own — the repo has no
  narration fixture); `K\measures.cjs` + `score.cjs` + `selfcheck.cjs`; ONE answer-file format `vidtsx-d1-answers/1`; `K\reports\b-tasksets.md`
  (composition, judgement calls) + `b-selfcheck.md` — **17 / 17 PASS**, incl. S1's own top-20 picks as P = 1 choice answers → R@1 151 / 187,
  pick acc 170 / 187, wrong-confident 15 / 240 (4 / 11), correct none 42 / 53, false none 13 / 156 = S1 §10 exactly.
- 16:13 · **Orchestrator re-check:** HEAD `71aa0c5` = HANDOFF + LOG only, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty;
  `node selfcheck.cjs` re-run in `K` → 17 / 17 PASS (same table); all 40 T2 rows and every third T3 row read — plain-meaning labels hold
  (T2 "Remember that I always want …" → none = outside the five families, accepted). Resources 16:13: C: 29.1 GB, headroom 36.1 GB, CPU
  33.9 %, 0 `electron.exe`. D1 builder #3 (step 3 — Laya multilingual per D-r3; first download) to spawn.
- 16:14 · D1 builder #3 spawned (HEAD `464f613`).
- 16:28 · D1 builder #3 HANDOFF (63 calls, ~15 min; step 3 part 1, docs `23269e8` `bfff9d7`; no model run): **route (1) `laya-ts` did not run**
  — npm name `laya-ts` 0.1.0 is NOT on the registry (`{"error":"Not found"}`), GitHub releases carry only the Python wheel / sdist, and its
  weights come only from `python laya-ts/scripts/export_onnx.py` (no `.onnx` in either official Convai repo); nothing installed, `B\npm-scratch\`
  empty. **Route (2) = `desplega/laya-onnx` `multilingual/fp32`** (encoder + head + tokenizer + `rl_agent_config.json` = the layout `laya-ts`
  loads; its manifest names upstream + revision + a sha256 per file; tokenizer sha256 = the official repo's): 1,324,748,627 B stated first;
  the download PAUSED at 150,076,382 B (HF ~80 KB/s per connection), every download process stopped. Kit: `K\laya-run.cjs` (Laya's pre /
  post-processing ported from the official `laya-ts` source, onnxruntime-node 1.24.3 + `@huggingface/tokenizers` read-only; `--examples` = E1
  Hindi `billing` 0.86, E2 the card's Quickstart `billing`, E3 Arabic sanity; answer files with cold / warm / RSS / CPU load) — not run yet;
  `K\dl-parallel.sh`; the `laya-ts` source read as text under `B\src-read\`. T1 choice fits 21 options by Laya's own head budget
  (`head_max_len` 256). New open problems P8 (download speed), P9 (the Laya framing is its judgement; a NOTE variant with the clip lines in
  the state).
- 16:29–16:31 · **Orchestrator re-check:** HEAD `bfff9d7`, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty; the partial parts on
  disk; 0 download processes left; `B\npm-scratch\` empty; no reusable GGUF / Laya file anywhere under `vidtsx-e2e`, `.vidtsx-temp`,
  `~/.node-llama-cpp`, `~/.cache/huggingface`. Speed test (16:30, one connection, a 16 MB range of Qwen's official GGUF, file deleted after):
  74,305 B/s; Content-Length 675,710,816. `dl-parallel.sh` read. Resources 16:31: C: 28.5 GB, headroom 33.2 GB → ruling D-r5.
- 16:32 · orchestrator background downloads started (3 jobs: Laya resume, Qwen2.5-0.5B Q8_0, d1-omni Q8_0; logs `B\models\*-download.log`).
  HANDOFF "Next step" amended for builder #4 (steps 5 → 6, then the adapter).
- 16:33 · D1 builder #4 spawned (HEAD `b905295`).
- 16:47 · D1 builder #4 HANDOFF (64 calls, ~15 min; **steps 5 + 6 DONE**, docs `7f72203`): `wt/out` built 16:36–16:39 (rc 0); profile
  `decisions-D1` (0 `settings.db*` in the copy), CDP 9300, Studio root `B\studio-root` set first; other sessions' instances seen at 16:41 (CDP
  9341, and 9296 on `timeline-T`) never touched; **16 / 40 keyless calls** (probe + T1 × 12 + T2 + T3 + one counted re-ask of t1-06, whose
  `success: true` text was cut mid-JSON at 792 chars), all `claude-sonnet-5-5`; its instance stopped. **Baseline (`K\reports\c-baseline.md`):**
  T1 hard — R@1 151 / 187 = 80.7 %, pick acc 173 / 187 = 92.5 %, **wrong-confident 17 / 240 = 7.1 %**, correct none 40 / 53 = 75.5 %, false none
  10 / 156 = 6.4 % (S1: 80.7 / 90.9 / 6.3 / 79.2 / 8.3; same pick on 225 / 240 rows); verbalised confidence (NOTE) at τ 0.5 wrong-confident
  5.8 %, R@1 80.2 %; **T2 100.0 % (Arabic 10 / 10), T3 97.5 % (Arabic 7 / 7)**; T1 call (20 rows) p50 10,424 ms / p95 23,370 ms. **Step 6:**
  `K\hosted-run.cjs` (Jev System One; OpenAI `/v1/decisions` with `input` + `questions[]`; Microsoft-Decision-1 via OpenRouter's Decisions API —
  OpenRouter's own reference read: `criteria` {true, false} REQUIRED on `noul` there, optional at TypeSafe), keys from `process.env` only,
  each refuses when unset (exit 2 ×3), shared counter `K\hosted-calls.jsonl` ≤ 600 + the $3 check before any call; dry-run bodies (first in
  `K\hosted-dryrun\`, all 12 MB in `B\hosted-dryrun\`): 138 requests (46 per provider), upper-bound $0.334. Open problems: **P10** (Hasan) —
  D-e's "600 hosted decision calls" read as HTTP requests; if he meant questions, T1 noul (4,632 per provider) cannot run hosted; **P11** —
  `llmGenerate` can return truncated text marked success (a D2 note); **P12** — D-r2's reference: beat = wrong-confident < 6.3 % at a τ with
  R@1 ≥ 75.7 %.
- 16:48–16:50 · **Orchestrator re-check:** HEAD `7f72203` = HANDOFF + LOG only, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty;
  `K\c-calls.jsonl` = 16 lines, every one ok, `claude-sonnet-5-5`, 9.0–23.4 s; a key-pattern scan (`sk-…`, `Bearer …`) over `K` and
  `B\hosted-dryrun\` → nothing; `K\hosted-calls.jsonl` absent (0 hosted calls). P12 checked against D-r2 (6.3 % is the lower of S1's 6.3 % and
  this run's 7.1 %; R@1 80.7 − 5 = 75.7) — right. Downloads at 16:48: d1-omni 155.6 / 407.2 MB, Qwen 157.3 / 675.7 MB, Laya 243.7 / 1,324.7 MB
  (~0.41 MB/s in all). HANDOFF Next step: how a builder sees a landed file (log `ok` + `sha256sum` + `end`, hash = expected). D1 builder #5
  (`llama-run.cjs`, then d1-omni / Qwen runs as they land) to spawn.

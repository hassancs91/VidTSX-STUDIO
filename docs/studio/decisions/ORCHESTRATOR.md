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
| D1 — the spike (no product code) | **STOP — BLOCKED** (STOP 1 + STOP 2 fired; STOP 3 for the local leg) | 8 | steps 1–2 (16:00, 16:13); step 3 part 1 (16:31); steps 5–6 (16:50) | docs `ce3f9e4` `71aa0c5` `bfff9d7` `7f72203` | (a): 22 primary sources, 15 contradictions, no candidate drops · (b): T1 240 / T2 40 / T3 40, self-check 17 / 17 | 2026-10-30 15:51 / — |
| D2 — the design note + THE ACCEPTANCE BAR (orchestrator) | DRAFT only — waits on Hasan's answer to D1's STOP | — | — | draft `99def5d` | §2 / §5.3 / §15 / §16 pending | 2026-10-30 17:02 / — |

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

- 2026-10-30 20:02 · **STOP — D1 BLOCKED by the paste-in's STOP rules** (`docs/studio/decisions/D1-spike-report.md` §11–§14). Reported: no hosted
  key was set, so Jev / OpenAI / Microsoft-Decision-1 are DEFERRED-HASAN (runners built + dry-run, 138 requests ≤ $0.334); no local candidate
  passes the rule's evaluable terms (both Qwen GGUFs fail warm p95 ≤ 300 ms; d1-omni does not load in node-llama-cpp; Laya's community
  export failed its card's example — NOTE only); no measured decision model beats the keyless baseline on T1 (best R@1 48.7 % at
  wrong-confident 38.3 % vs 80.7 % / 7.1 %); STOP 3 for the local leg. D2 left as a DRAFT. Questions for Hasan: the design direction (hosted
  only + the keyless LLM for T1's pick, or a new local runtime), set the keys for the hosted runs, P10 (600 = requests or questions), Laya's
  `pip install laya` reference check, d1-omni's licence / runtime, T2 / T3 labels. Hasan said: (pending)

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
  (`llama-run.cjs`, then d1-omni / Qwen runs as they land) to spawn. (Commit `09f965c` landed 16:49:21; the "16:50" in this entry and in
  HANDOFF's note was an estimate.)
- 16:49 · D1 builder #5 spawned (HEAD `09f965c`).
- 16:57 · D1 builder #5 HANDOFF (38 calls, ~9 min; step 4 part 1, docs `f5dfb26`; no model loaded — neither file had landed at 16:56:49):
  `K\llama-run.cjs` 149 lines (the `laya-run.cjs` CLI + `--gpu-layers auto|max|N`, `--candidate`, `--licence`, `--info`; the model's chat
  template; letter / Yes-No option labels, refuses a multi-token label; the first next-token map via `controlledEvaluate` …
  `generateNext.probabilities` at temperature 0 — the native sampler then adds no top-k / top-p / min-p, so the map is the whole vocabulary,
  checked by recording its size + sum on the first question; renormalised over the options with the raw option mass recorded; the shared
  prefix reused and checked once against a fresh evaluation; cold / first answer / per-request / per-question latency, peak RSS, VRAM,
  CPU load; its own resource guard incl. "no other laya-run / llama-run"); `K\temp-oof.cjs` 44 lines (the out-of-fold temperature NOTE for
  any answer file; random files → T ≈ 20, as expected). **P13: the GPU path here is Vulkan** (the CUDA prebuilt fails `NoBinaryFoundError` —
  no CUDA toolkit; Vulkan sees the RTX A3000 + Intel UHD, its VRAM reading is broken (free 0) → `--gpu-layers auto` may put 0 layers on
  the GPU; use `max`). Bundled llama.cpp b8390 has `lfm2` but no `systemone` code. P14: its prompt wording is its judgement (for review).
- 16:58–16:59 · **Orchestrator re-check:** HEAD `f5dfb26` = HANDOFF + LOG only, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty;
  the two scripts on disk (149 + 44 lines); 0 `llama-run` / `laya-run` processes. Downloads at 16:59:05 (rates since 16:48:25): d1-omni
  222.1 / 407.2 MB (~104 KB/s → ≈ 17:29), Qwen 227.9 / 675.7 MB (~110 KB/s → ≈ 18:07), Laya 357.5 / 1,324.7 MB (~178 KB/s → ≈ 18:30). No
  builder until a file lands (a builder must not idle on a download); the next spawns when the d1-omni job reports. **While waiting, the
  orchestrator drafts D2's sections that do not depend on D1's numbers** (contract, adapters, processes, keys, IPC, users, tool / step) —
  marked DRAFT; the recommendation, the local default and THE ACCEPTANCE BAR are written only after D1 is DONE and its STOP judged.
- 17:02 · `docs/studio/DECISION_MODELS_DESIGN.md` DRAFT committed (`99def5d`, 278 lines: contract, layout, adapters, ladder, processes, keys,
  timeouts / cache / usage, the first users without claims, the `decide` tool = flow node, IPC, not-in-slice, build order; §2 / §5.3 / §15 /
  §16 PENDING D1).
- 17:38 · **d1-omni landed:** the job ended 17:37:55 — `ok … 407207584`, sha256 `cd94463f…3d3` = expected (four curl resets / one DNS failure
  on the way, absorbed by the per-part retries). Qwen 518.5 / 675.7 MB (~126 KB/s since 17:03 → ≈ 18:00), Laya 840.0 / 1,324.7 MB (~208 KB/s
  → ≈ 18:17). D1 builder #6 (d1-omni `--info` + self-test, then Qwen when it lands) to spawn.
- 17:38 · D1 builder #6 spawned (HEAD `ce296e6`).
- 17:39–17:43 · **downloads (orchestrator, while builder #6 ran — logged now):** the network sped up. Qwen2.5-0.5B landed 17:39:34 (`ok …
  675710816`, sha256 `ca59ca7f…44e` = expected). Laya: tokenizer / head / `rl_agent_config` landed with the manifest's hashes, but the encoder
  job ended `FAIL … (a part is short)` at 17:39:29 after a burst of DNS failures exhausted some parts' retries; re-run 17:39:49 (same 32
  parts, resumed) → `ok … encoder.onnx 1230282662`, sha256 `4bf4feb8…` = `manifest.json`, 17:40:41. With the network fast, the orchestrator
  also fetched builder #1's SECOND GGUF, `qwen3.5-0.8b-q8` (the catalog's own `downloadUrl`, unsloth/Qwen3.5-0.8B-GGUF; 811,843,840 B, sha256
  `0ad885ff…7a6c` from the HF API, stated first; C: 25 GB free) → landed 17:43:04, hash equal. Every D1 weight file is on disk and checked.
- 18:24 · D1 builder #6 HANDOFF (51 calls, ~46 min incl. its runs; step 4 part 2 DONE, docs `aca2ca3` `ba41a37`): **d1-omni did not run** —
  `llama_model_load: error loading model: missing tensor 'blk.16.ffn_gate.weight'` (Vulkan and CPU); its GGUF metadata says encoder + decision
  head (`lfm2.decision.type lfm2-d1-omni`, `attention.causal false`), only `chat_template.systemone`, `ar` among its 15 languages, fitted
  temperatures per question type → needs `llama-server /v1/systemone` or the community ONNX (+ the revenue-capped licence): P15 for Hasan.
  **Qwen2.5-0.5B Q8_0** (self-test: map 151,936 entries = the vocabulary, sum 1.00001, options present, prefix reuse ≤ 0.0066; Vulkan `auto` put
  0 layers on the GPU → `--gpu-layers max` = 25 / 25 on the RTX A3000): T1 noul 43.2 % (Arabic 18.8 %, Brier 0.336, ECE 0.488; P(Yes) ≥ 0.5 on
  2,796 questions vs 321 true; OOF T at the grid max 20 both folds), T1 choice 27.1 % (top answer "none" on 180 rows), **T2 75.0 %** (Arabic
  80.0 %, Brier 0.155), **T3 67.5 %** (Arabic 57.1 %); D-r2: **does not beat the baseline** (best R@1 36.4 %, wrong-confident 71.7 % at τ 0.5;
  choice R@1 0 % = abstains). Warm per question p50 / p95: T1 noul 208 / 389 ms, T1 choice 569 / 722, T2 230 / 275, T3 222 / 351 ms; peak RSS
  ≤ 1,087 MB; VRAM 800 → ~1,700 MiB. **P16:** ~5/6 of a warm question is node-llama-cpp building a JS map of the whole vocabulary (forward
  pass alone p50 30 / p95 62 ms vs 175 / 279 with the map) — a product adapter must read only the option tokens' logits. **P17:** its CPU-only
  runs (T2 9.8 / 12.2 s, T3 7.5 / 18.2 s per question) ran at node-llama-cpp's default 4 threads and partly under another session's load
  (`ffmpeg`, `chrome-headless-shell`) — not a fair CPU figure, not repeated. Kit fixes: cold timings exclude the guard probes;
  `ignoreMemorySafetyChecks` with `max` layers (Vulkan's VRAM reading → `InsufficientMemoryError`); new `llama-mapcost.cjs`,
  `c-llama-run-all.sh`. P18: run `qwen3.5-0.8b` at all?
- 18:25 · **Orchestrator re-check:** HEAD `ba41a37`, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty; `K\answers\` holds the 4 + 2
  CPU + 4 OOF Qwen files and `K\reports\c-llama-*` their scores; `c-llama.md` :33 quotes the load error, :85-87 the D-r2 verdict against both
  references; 0 `llama-run` / `laya-run` processes. **Ruling D-r6 (18:25) — P18 + P17:** `qwen3.5-0.8b-q8` is already on disk (above), so it
  runs AFTER Laya with the same four runs (Vulkan `max` layers the headline; cheap: ~20 min), recorded as the second GGUF of the SemIf
  adapter. A fair CPU figure (`--threads` added to `llama-run.cjs`, e.g. 8 of 16) is taken only for a GGUF candidate still in contention
  after its T1 run. A larger GGUF (`qwen3.5-2b-q4km`, 1.28 GB, catalog) is NOT run unless the orchestrator asks after Laya and the 0.8B — it
  would test whether the method scales, not the brief's "tiny GGUF". D1 builder #7 (step 3 — Laya, then the 0.8B) to spawn.
- 18:26 · D1 builder #7 spawned (HEAD `98801e7`).
- 19:16 · D1 builder #7 HANDOFF (70 calls — over budget because its runs could not be left running; docs `28b509f` `8ef2746`): **Laya multilingual
  did not run — the worked-example gate FAILED** (`K\reports\c-laya.md` §4): E1 (README) `billing` P 0.9929 (stated 0.86); **E2 (the card's
  Quickstart, text checked verbatim) `sales` 0.5811 vs `billing` 0.4168** (stated `billing`); each question alone = identical (no padding
  fault); `add_special_tokens` makes E2 worse (0.7340 `sales`). Port audit line by line against the official `laya-ts` source: every step the
  same (§5). The official `model.safetensors` is unchanged between the export's revision `e4e9ddf2` and main; telling an export fault from
  stale printed outputs needs the official Python runtime (D-r3 forbids). The card's own Limits: "Ships uncalibrated … systematically
  over-confident", "Near chance on typed-decisions zero-shot — 0.342, against a 0.318 random". P19 (options a / b / c) for the orchestrator.
  **Qwen3.5-0.8B Q8_0 (D-r6) DONE** (`c-llama.md` §8): the `--info` probe showed P(`<think>`) 0.9999 at the answer position → `--thoughts
  discourage` (an empty `<think></think>`, Qwen's non-thinking mode) added BEFORE any run and used in all (P20); self-test pass (25 / 25 layers
  Vulkan, map 248,320 = vocabulary, sum 1.00007); T1 noul 87.0 % (below the 93.1 % of always-No; P(Yes) ≥ 0.5 on 610 vs 321 true), T1 choice
  47.5 %, **T2 82.5 %** (Arabic 60.0 %), **T3 85.0 %** (Arabic 57.1 %); D-r2: best R@1 48.7 % (noul τ 0.5) with wrong-confident 38.3 %; τ 0.7 →
  R@1 10.7 % / wc 8.3 % — **does not beat the baseline**; OOF T < 1 on noul (T1 0.27 / 0.30 — under-confident; T1 noul Brier 0.132 → 0.092);
  warm per question p50 / p95 T1 noul 326.1 / 482.7 ms (quiet), T2 281.0 / 353.3 ms (repeat, chrome 4–6 %) — the other two loaded twice by
  another session's `ffmpeg` (55–65 %) / chrome / GPU use, answers identical in the repeats (P21); **fails warm p95 ≤ 300 ms on every task**;
  peak RSS ≤ 1,552 MB. Resources 19:15: C: 24.79 GB, headroom 50.77 GB, no model process left.
- 19:18 · **Orchestrator re-check:** HEAD `8ef2746`, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty; `c-laya.md` §4–§7 read
  (the E1 / E2 / E3 table, the port audit, what would settle it); 0 model processes. **Ruling D-r7 (19:19) — P19:** option (a). Laya
  multilingual runs the four tasks ONCE as a labelled NOTE ("community export FAILED the worked-example gate (E2) — numbers unverified"),
  CPU EP, same framing / scoring / OOF as every candidate, no timing claims beyond what the run records; it is **never eligible for the
  rule's recommendation**. Why: it is D-c's first candidate and Hasan's D2-stop question ("is a local decision model viable?") is better
  answered with its numbers beside the card's own "near chance" warning than without them; the runs are cheap. (b) (the English checkpoint,
  another ~1.7 GB community bundle) is not run; (c) (`pip install laya` for the official runtime) goes on Hasan's list. Then step 7 — the
  report, the recommendation by the rule as D-r1 reads it, and the STOP judgement. D1 builder #8 to spawn. (Commit `ad436b8` landed
  19:18:39; the "19:19" above was an estimate.)
- 19:19 · D1 builder #8 spawned (HEAD `ad436b8`).
- 20:00 · **D1 builder #8 — status BLOCKED** (90 calls incl. a 34-min run; over budget by choice — it drafted the report while T1 noul ran;
  docs `753711b`): **D-r7 Laya NOTE runs** (kit fixes first: `--threads`, a package-version read, the CPU probe; CPU EP 8 intra-op threads,
  19:22:51 → 19:56:59, every run rc 0, quiet machine): T1 noul 17.2 % (P(true) ≥ 0.5 on 4,138 / 4,632; OOF T 20 / 20), T1 choice 50.4 % (best
  R@1 55.6 % at wrong-confident 39.2 %), T2 55.0 %, T3 60.0 %; per question p95 469.2 ms (T1 noul); OS peak RSS 2,269–3,109 MB — every number
  labelled unverified. **The report `docs/studio/decisions/D1-spike-report.md`** (422 lines, every number names its kit file): §11 the rule as
  D-r1 reads it → **no local default** (Qwen2.5-0.5B and Qwen3.5-0.8B fail warm p95 ≤ 300 ms — 388.7 / 722.1 / 350.6 ms and 482.7 / 353.3 ms
  per question; d1-omni did not load; Laya not eligible); §12 **STOP 1 FIRES; STOP 2 FIRES for every measured model** (best local R@1
  48.7 % at wrong-confident 38.3 % vs the bar < 6.3 % at R@1 ≥ 75.7 %; hosted DEFERRED-HASAN — only they could overturn it); **STOP 3 FIRES
  for the local leg** (builder's judgement, P23 — the orchestrator may re-word): no local default from today's candidates; a local leg needs
  a different runtime (an option-logit reader without the vocabulary map, `llama-server` for d1-omni, or an official Laya export). §13
  DEFERRED-HASAN (the hosted runs: one-call probe per provider, then 138 requests ≤ $0.334); §14 six questions for Hasan. Calls: keyless 16 /
  40, hosted 0; no scratch npm install (`B\npm-scratch\` never created); one app launch (step 5).
- 20:01–20:02 · **Orchestrator re-check:** HEAD `753711b`, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty, 0 model processes,
  0 `electron.exe`; the report read (§0, §4, §5, §8–§15); spot checks against the kit's score files — Qwen3.5-0.8B T1 noul accuracy 0.8703 at
  τ 0.5 (= 87.0 %), the baseline's T1 choice accuracy 0.8875 (= 88.8 %), `c-llama.md` :190 / :194 hold 482.7 and 353.3 ms. **STOP 3 wording
  accepted as written** (it separates the measured local leg from the unmeasured hosted leg). **D1 → STOP (BLOCKED by Hasan's own STOP
  rules).** Per the paste-in ("STOP and ask me if …"), D2 is NOT finished: `DECISION_MODELS_DESIGN.md` stays the 17:02 DRAFT (its header now
  says it waits on Hasan's answer). → the stop report.

# Library search — orchestrator state

> Run brief: Hasan's paste-in "Session 10 — library search" (kept verbatim in
> `docs/studio/end-to-end/NEXT-SESSION.md` on this branch, :7-121), following `docs/studio/END_TO_END_RUN.md`'s loop
> (builders with the 30 % hand-off rule, an independent verifier, the stop report, "things you never do").
> Parts S1 → S4 run in order with NO stop between them unless a STOP rule fires (S1's two STOP conditions,
> a BLOCKED builder, three verifier FAILs, or S4's PASS).

- Branch: `library-search`, cut from `end-to-end-p0-e` @ `906273c` (the E3 DONE-PARTIAL record) on 2026-10-29 13:39 +0200,
  worktree `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\wt`. Not pushed, not merged (landing it after `end-to-end-p0-e` is
  Hasan's call).
- Code base at the cut: `git log -1 -- src/` = `c5a6124` (E3 fix round 4, the word-diversity rule). Gates there (E3 builder #18
  and verifier round 5): worktree vitest 3 failed / 508 passed / 5 skipped files — only the three E-d2a package-resolution
  suites; tsc web 26 / node 10.
- Start state (13:37): main checkout `end-to-end-p0` @ `5d77600` with the other session's 10 modified + 6 untracked files
  (unchanged); Hasan's dev app NOT running (0 `electron.exe`). Resources 13:38: C: 51.3 GB, D: 41.8 GB, memory headroom
  42.3 / 99.7 GB.

| Part | Status | Builders spawned | Verifier result | Commit | Numbers | Started / Finished |
|---|---|---|---|---|---|---|
| S1 — the spike (no product code) | **DONE** (STOP not fired) | 4 | — (the report read by the orchestrator against S1's rule; S4 verifies the whole) | docs `5c5bd09` `42f8d43` `3eb1772` `1bacaac` `ee2b78b` `edf531c` `040717f`; report `docs/studio/search/S1-spike-report.md` | R@10 / R@20 ALL: keywords 91.8 / 91.9 → (c) RRF60 + multilingual-e5-small 99.3 / 99.9; HELD-OUT 73.4 / 73.6 → 97.9 / 99.8; CORPUS 100 → 100; pick over top-20 wrong-confident 6.3 % vs keywords 25.4 % (240 rows); warm p95 6.33 / 15.88 ms (51 / 2,000, Electron); no ∅ floor; 25 / 40 model calls | 2026-10-29 13:41 / 14:57 |
| S2 — the design note + THE ACCEPTANCE BAR | **DONE** (orchestrator) | — | — | `docs/studio/LIBRARY_SEARCH_DESIGN.md` (commit: see Log 15:05) | the bar = design §9 (benchmark thresholds per file, no R@10 regression vs keywords, Basic = today, no claim, nothing fits, gates, five live checks, notes) | 2026-10-29 14:58 / 15:05 |
| S3 — build (red-first, hand-off-sized parts) | BUILDING | 0 | | | | 2026-10-29 15:05 / |
| S4 — verify (independent; ≤ 3 FAILs) | TODO | | | | | |

## Answers in force (Hasan's paste-in, 2026-10-29)

- **The design (decided):** layered search — keywords + a small LOCAL embedding model for retrieval (wide recall, top ~20); the
  pick made by the assistant where an LLM is already in the loop (or an optional fast-model / reranker step); NEVER a confident
  claim from retrieval alone; a setting ladder **Basic** (keywords) · **Smart** (+ local embeddings; the default once the model
  is downloaded) · **Smart + AI rerank** (+ the user's own provider; off by default); ONE shared service (first user: the Studio
  assistant's sound reuse; then `list_assets` and the Assets screen search box; later b-roll, templates / packs, transcripts).
- **S1's recommendation rule:** Smart's default model = the smallest whose recall@20 is within 2 points of the best and warm
  p95 ≤ 50 ms (prefer a multilingual model if within 3 points); the pick = the assistant over the top-N where an LLM is in the
  loop. **S1 STOPS** (ask Hasan) if no embedding model beats the keyword baseline on recall@10 by a clear margin, or if the
  numbers point to a different design.
- **S2 fixes THE ACCEPTANCE BAR before any verifier:** benchmark thresholds per corpus file (recall@k of what the assistant
  sees, from S1's numbers), no regression vs the keyword baseline on recall@10, the gates, and what is only a note.
- **S4:** FAILS only by the S2 bar; ≤ 4 keyless assistant turns; three FAILs → stop and report; on PASS a Status.md entry at the
  top + a TESTING.md **§19** block (§18.18+ is reserved for tracks C / D / F), then STOP with the stop report.
- **Overrides:** no paid-key call; model calls only through the app's own keyless `claude-subscription` — S1 ≤ 40 calls, S4 ≤ 4
  turns (+1 retry each on an API error); never read / copy / open a credential store (`settings.db*`, `~/.claude`, any profile's);
  isolated profiles only (`C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\<name>\profile` copied from `profiles\source\profile`
  WITHOUT `settings\settings.db*`; library root `<profile>\assets`; Studio root set in the first CDP call); never Hasan's
  `%APPDATA%\VidTSX Studio` library or his projects, never his stations (`B1-verify-root` + `profiles\B1-verify`,
  `B5-station-root` + `profiles\B5-station`) or B6 / B7 scratch; `profiles\E3` is read-only; the editor repo is read-only; CDP
  ports 9290–9299; the resource guard (C: ≥ 3 GB and C: + headroom ≥ 6 GB before a launch / copy / download / full run;
  `--maxWorkers=2` while headroom < 10 GB; DRIVING's load rules, E-d13); NO new npm package (stop and ask); DEFERRED-HASAN for
  anything needing his hands / ears / keys; the orchestrator writes only docs, commits after each update, logs real-clock times,
  commits nothing while a builder or verifier runs; never push, never merge.
- **Ports / profiles (orchestrator):** S1 builders 9290 (`profiles\search-S1`); S3 builders 9292 (`profiles\search-S3`); S4
  verifier 9295 (`profiles\search-S4-verify`, round N → `-verifyN`). Kits under `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\<PART>\`
  (outside the worktree's tree); big outputs and model downloads under `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\<PART>\`.

## Stops

(one line per stop: what was reported, what Hasan said)

## Log

- 13:37 · start checks: main checkout's uncommitted work still there (16 paths); Hasan's dev app not running.
- 13:38 · `906273c` on `end-to-end-p0-e`: E3 → DONE-PARTIAL as of `c5a6124` (Hasan's option (A)); the track-E exit waits for
  library search (`docs/studio/end-to-end/ORCHESTRATOR.md` table row + "Library search (session 10)").
- 13:39 · branch `library-search` + worktree `.vidtsx-temp\search\wt` @ `906273c`.
- 13:41 · this file + `S1/HANDOFF.md` + `S1/LOG.md`; S1 builder #1 to spawn.
- 13:42 · S1 builder #1 spawned (HEAD `3c0d213`).
- 13:54 · S1 builder #1 HANDOFF (34 calls, ~11 min; step 1 DONE, docs `5c5bd09`, no `src/` change, 0 model calls, no download / launch):
  the labelled set `.vidtsx-temp\search\S1\labelled-set.json` — 1,565 rows (1,375 named / 140 ∅ / 50 `*`), 2,899 excluded with
  reasons; the corpus recounted at 1,073 rows (150 / 194 / 132 / 129 / 204 / 67 / 197); r3 / r4 probe files add no row (every prompt
  already a corpus row); r5 adds c-ordinary (verifier's verdict), j-falling / i-nine / e-realindex / d-stopword / the named broad sets
  (S1 labels); 35 own rows (25 en + 10 ar). **(a) keywords** (`S1\reports\a-keywords.md`): ALL R@1 83.9 / R@3 90.8 / R@10 91.8 /
  R@20 91.9 / MRR 0.874, wrong-confident 100 / 1,515 (6.6 %); the seven corpus files 100 at R@10; weak: d-stopword R@10 46.0,
  j-falling 33.3, the broad named sets R@1 3.8 (25 / 26 confidently wrong), Arabic 0. Orchestrator re-check: tree clean at
  `5c5bd09`, `906273c..HEAD -- src/ scripts/` empty, reports on disk, 0 `electron.exe`. **Its heads-up:** the corpus files ARE the
  keyword matcher's bar (100 by construction) → the comparison must be read on the held-out rows too. **Orchestrator ruling for
  builder #2:** finish every measurement ((b) (c) timings (d) (e), the report) BEFORE judging the STOP rule; report recall@10 on
  ALL, on the corpus files and on the held-out rows (r5 + own); add the top-1 similarity distribution on ∅ vs named rows (S2 needs a
  "nothing fits" floor); then DONE, or BLOCKED with both readings if they disagree.
- 13:56 · S1 builder #2 spawned (HEAD `5de37df`).
- 14:22 · S1 builder #2 HANDOFF (59 calls, ~27 min; (b) (c) timings DONE, docs `42f8d43` `3eb1772` `1bacaac`, no `src/` change, 0 model
  calls, no launch): four catalog models downloaded (489.5 MB, `…\vidtsx-e2e\search\S1\models\`; sizes stated first); CORPUS / HELD-OUT
  subtotals in every table. R@10 / R@20 — (a) ALL 91.8 / 91.9, CORPUS 100 / 100, HELD-OUT 73.4 / 73.6; **(b) multilingual-e5-small** ALL
  98.7 / 99.8 (MRR 0.886), HELD-OUT 96.0 / 99.3, Arabic R@10 90; MiniLM ALL 97.7 / 99.1 (Arabic 30); bge-small CLS 97.5 / 99.0; e5-base 97.8
  / 99.6; **(c) RRF60 + e5-small** ALL 99.3 / 99.9 (MRR 0.917), CORPUS 100, HELD-OUT 97.9 / 99.8. Warm p95 (Electron 41) e5-small 6.33 ms
  / 51, 15.88 ms / 2,000; cold 1,421 ms; RSS 412.8 MB loaded; indexing 2,000 items 48.6 s (MiniLM 21.2 s). **Findings:** (1) the app's
  `embedding-engine/worker.ts:57-59` cannot load a catalog model as written (transformers 4.0.1 wants `onnx/model.onnx`; the catalog ships
  only `model_quantized.onnx` → needs `dtype: 'q8'`); (2) no similarity floor separates ∅ from named rows (best Youden J ≤ 0.67) → "nothing
  fits" belongs to the pick, not retrieval. Process slip: one HANDOFF status line edited by `sed` (content right; its Open problems 6).
  Orchestrator re-check: tree clean at `1bacaac`, `5de37df..HEAD -- src/ scripts/` empty, the c / b / t reports read (numbers match), 0
  `electron.exe`, models 466.9 MiB on disk. Builder #3 ((d) the LLM pick, optional (e), the report, the STOP judgement) to spawn.
- 14:23 · S1 builder #3 spawned (HEAD `89343e6`).
- 14:38 · S1 builder #3 HANDOFF (47 calls, ~15 min; (d) DONE, docs `ee2b78b`, no `src/` change): `wt/out` built; profile `search-S1`
  copied WITHOUT `settings.db*`, CDP 9290, Studio root set first, app stopped after; **25 / 40 model calls** (probe + 12 + 12, 0 errors,
  `claude-sonnet-5-5`, 5–15 s each, ~120 k prompt chars per batch). Sample 240 rows (187 named / 53 ∅; strata A (a)-wrong 40 · N ∅ 50 · H
  held-out 90 · C corpus 60). `reports\d-pick-top20.md` / `d-pick-full51.md`: top-20 of (c) — pick acc 170 / 187 (90.9 %),
  wrong-confident 15 / 240 (6.3 %), correct none 42 / 53 (79.2 %), false none 13 / 156 (8.3 %); held-out 86.2 % / 3.5 %; full 51 —
  87.7 % / 7.5 % / 81.1 % / 9.6 %; same rows: (c) top-1 72.2 %, (a) pick 54.5 % with 25.4 % wrong-confident. Its caveat: most ∅ "wrong"
  picks are corpus ∅ rows plain meaning would fill ("a river running" → stream-soft, "taking a picture" → camera-shutter) — labelled ∅
  for the keyword matcher's word-sense tests (S2's call). (e) named, not downloaded: `Xenova/ms-marco-MiniLM-L-6-v2` 23,856,961 B,
  English-only. **Orchestrator re-check:** tree clean at `ee2b78b`, `89343e6..HEAD -- src/ scripts/` empty, 0 `electron.exe`,
  `d-calls.jsonl` 25 lines; the report's generic table reads R@1 80.7 on ALL where the pick table reads 90.9 % — the pick table counts a
  "none" on an `x|∅` row as right → builder #4 must define both in the report. Builder #4 ((e), the report, the STOP judgement) to spawn.
- 14:39 · S1 builder #4 spawned (HEAD `c642c2a`).
- 14:57 · **S1 builder #4 DONE** (55 calls, ~18 min; docs `edf531c` `040717f`; no model call, no launch): (e) `ms-marco-MiniLM-L-6-v2`
  no gain (ALL R@1 86.6 vs 87.4, Arabic 10 vs 50, 243.7 ms / request) → not recommended; the report §0–§15 (both pick measures defined,
  `d-measures-diff.md`); recommendation by Hasan's rule = **multilingual-e5-small** (all five runs within 2 points of the best R@20 99.8,
  every warm p95 ≤ 50 ms; the multilingual preference) in an RRF60 hybrid, the pick = the assistant over the top-20; **N = 20** (the
  measured pick condition; (c) R@3 / 5 / 8 / 10 / 20 ALL 94.8 / 97.7 / 99.1 / 99.3 / 99.9, HELD-OUT 83.3 / 92.7 / 97.2 / 97.9 / 99.8).
  **STOP judged NOT fired:** R@10 beats keywords on ALL by +5.7…+6.9 and on HELD-OUT by +19.8…+22.6 for every model; the numbers support
  the decided design (no ∅ floor → "nothing fits" = the pick's "none"). Orchestrator re-check: tree clean at `040717f`, `906273c..HEAD --
  src/ scripts/` empty, 0 `electron.exe`, the report read in full (§0–§10, §14–§15). → **S1 DONE; S2 (the orchestrator's own) next.**
- 14:58–15:05 · **S2 — the design note** `docs/studio/LIBRARY_SEARCH_DESIGN.md` written by the orchestrator: the service layout
  (`src/main/services/library-search/` + a utilityProcess engine `src/library-search-engine/` — the content-safety DLL precedent), the
  ladder (auto = Smart when the model is on disk), the vector cache (`<root>/.vidtsx/search/vectors-<modelId>.json`, relPath + textHash +
  modelId), processes (nothing on main; 5 s cold / 2 s warm timeouts → Basic + `degraded`), the first users (the neutral 20-row answer,
  NO claim in any mode; Smart always answers a non-empty pool, `force` to generate; `list_assets` ranked; the Assets box), **§9 THE
  ACCEPTANCE BAR** (the committed benchmark with per-file R@20 / R@10 thresholds from S1 — R@10 taking the larger of the threshold and
  keywords' own (no regression); Basic = today exactly; no-claim strings on all 1,515 rows; nothing-fits; the gates; five live checks —
  the ping loop ≤ 250 ms, the download path, the Assets box ("things falling over" → `crash-tumble` in the first 8: S1 ranks it 4th;
  "صوت زجاج يتكسر" → `break-glass-crack`, S1 2nd), the real handlers app-stopped, ≤ 4 keyless turns; and the notes), IPC, the S3 steps.
  `S3/HANDOFF.md` + `LOG.md` created. S3 builder #1 (step a) to spawn. (Clock: the S2 commit `e83e813` landed at 15:03; "15:05" above
  was the orchestrator's estimate.)
- 15:04 · S3 builder #1 spawned (HEAD `e83e813`).
- 15:19 · S3 builder #1 HANDOFF (60 calls, ~15 min; step a part 1): `3cb73df` the pure service — `src/shared/types/library-search.ts`,
  `src/library-search-engine/prefixes.ts`, `src/main/services/library-search/{types,item-text,search-pool,keyword-retriever,fuse,
  library-search,search-settings}.ts` + 6 test files (42 tests), red first; the benchmark harness `library-search/benchmark/` (codec,
  measures, fixture loader, S1's (a) / (c) tables as hit counts, the §9.1 test asserting EQUALITY with S1's tables) — red until the
  fixture exists; docs `af130ca`. `search-pool.ts` re-states the matcher's `isCandidate` (not exported) via `soundClassOf`, pinned equal on
  the corpus. tsc 26 / 10. Slip: the HANDOFF status line by `sed` (second time in this run). **Orchestrator re-check:** tree clean at
  `af130ca`, matcher diff vs `7967c6f` empty, 20 files / 1,242 lines added (largest 131), no `any`, `vitest run src/main/services/
  library-search --exclude '**/benchmark/**'` → 6 files / 42 tests passed (15:19), 0 `electron.exe`. **Ruling on its open note:** an
  audio search with no sound class (`list_assets(kind: audio)`, the Assets box) uses the coverage ranking — accepted (design §3 names E3's
  matcher for the sound-class path, which keeps Basic = today for `generate_sfx` / `generate_music`). Builder #2 (the fixture script →
  step a green) to spawn.
- 15:21 · S3 builder #2 spawned (HEAD `daa3cc5`).
- 15:57 · S3 builder #2 HANDOFF (56 calls, ~37 min; **step a DONE**): `2ffcc27` — `scripts/library-search-fixture.mjs` 218 (esbuild-bundles
  the product code, S1's model read-only, `dtype: 'q8'`, 51 clips + 1,505 prompts embedded in 9,895 ms; float32 → int8 → int16, the design's
  rule) + `benchmark/fixtures/labelled-set.json` 374,708 B + `vectors-multilingual-e5-small.json` 1,698,742 B stored **int16** (float32 table
  = S1's: true; int8: false, 1,171 rows differ; int16: true — recorded in the file's `check`); the §9.1 test green (the "Basic = today"
  rankings moved into a `beforeAll` with a 180 s timeout; E3's empty-prompt row #48 pinned as nothing-fits); docs `20bc069` `40300e9`
  `0e5257d`. node_modules unchanged (`find -newer` marker empty). Note 1: 14 / 1,515 rows have a different top-20 ORDER from float32 —
  36 clip pairs at cosine gaps ≤ 2.22e-6 (a float32 regeneration itself differs from S1's `perRow` in 1 row). Note 2: **Hasan's dev app came
  up 15:27** (main checkout, CDP 9222, his profile `AppData\Roaming\VidTSX`, 6 `electron.exe`). **Orchestrator re-check:** tree clean at
  `0e5257d`; matcher diff empty; `vitest run src/main/services/library-search` → 7 files / 60 tests passed in 27.5 s (15:57); Hasan's app
  confirmed (ports 9222, his profile); main checkout still 16 paths. **Ruling on note 1:** accepted — the design's check is table
  equality (design §9.1), and it holds on all 18 row sets; the order flips are below float32 regeneration noise. **New rule from 15:57
  (Hasan's app is running):** never kill it, never run `electron-vite dev`, never touch the main checkout's `out/`; our own `electron.exe`
  instances (own profile + port, `wt/out`) are allowed ONLY after checking he is not rendering (no `ffmpeg` / `chrome-headless-shell` /
  Remotion process under his electron PIDs and no `%TEMP%\vidtsx-studio` entry modified in the last 2 min) — DRIVING's startup-sweep rule;
  the full vitest gate expects flakes under his app (DRIVING's load rules / E-d13 apply). Builder #3 (step b — the engine) to spawn.
- 15:59 · S3 builder #3 spawned (HEAD `7071b37`).
- 16:22 · S3 builder #3 HANDOFF (62 calls, ~23 min; **step b DONE**): `3c50783` — `src/library-search-engine/` (`types`, `embedder` q8 +
  mean + e5 prefixes + batches of 32 + refuses a node_modules cache, `vector-store` (the `.vidtsx/search/vectors-<id>.json` file, atomic,
  rebuild on a bad header), `model-lock` (a query jumps the build), `engine-core`, `worker`, `ort-dll-path`, `search-engine` (host: lazy
  spawn, 5 s cold / 2 s warm, respawn on death, 10 min idle unload; no electron import) + `electron-fork`), the `library-search-worker`
  entry, `vector-sync.ts`, `benchmark-bar.ts` (§9.1's thresholds shared), the `embedding-engine/worker.ts` `dtype: 'q8'` fix + test; docs
  `419ada7`. Gated live test (`VIDTSX_SEARCH_MODEL_DIR` = S1's model) green: clips min cosine 1.000000, prompts 1.000000 batched / 0.991872
  one at a time; through the core the live table equals S1's (c) at R@10 / R@20 (ALL 99.3 / 99.9, HELD-OUT 97.9 / 99.8, CORPUS 100);
  node_modules unchanged; tsc 26 / 10 (the engine folder checked by a scratch config — outside `tsconfig.node`'s include until main imports
  it in step c); `wt/out` built (`library-search-worker.js` 13,294 B). **Orchestrator re-check:** tree clean at `419ada7`, matcher diff
  empty, 21 files / +1,574 −11 since `7071b37`, `vitest run src/library-search-engine src/embedding-engine …/vector-sync.test.ts` → 6 passed
  + 1 skipped (the gated file) / 39 tests (16:22); `embedder.live.test.ts:102` asserts the ONE-AT-A-TIME cosines ≥ 0.99 and :105-139 runs the
  §9.1 bar through the engine core. **Ruling on its open problem 1 (query batch effect):** no §9.1 change — the design's gated test is "through
  the product worker's code path", which is what :102 / :105-139 measure; the committed benchmark stays on the batched fixture (= S1). Open
  problem 2 (tsconfig include) → step c must make main import the engine so `tsconfig.node.check.json` covers it; the verifier checks.
  Builder #4 (step c — IPC + settings + the ping loop) to spawn.
- 16:24 · S3 builder #4 spawned (HEAD `0b50a75`).
- 16:47 · S3 builder #4 HANDOFF (93 calls, ~23 min; step c CODE done, the ping loop NOT run): `62685e9` — channels `library:search`,
  `:status`, `:settings:set`, push `library:search:event` (`channels.ts:604-609`), wire types `src/shared/ipc/types/library-search.ts`,
  handlers `src/main/ipc/library-search-handlers.ts` (try/catch, typed errors) registered with `lazily` (`registrations/library-search.ts`,
  `register.ts:96`), preload `src/preload/api/library-search.ts`; `search-runtime.ts` (status, ladder, the background build after a download /
  index write / first status / a short Smart result, events) + `search-app.ts` (the one instance; the real fork); `library-index-events.ts`
  (writeIndex notifies, `library-index-io.ts:113`) + `embedding-model-events.ts`; `tsconfig.node.json` includes `src/library-search-engine/**/*`
  (15 / 15 files listed). tsc 26 / 10; 23 new tests (red first); largest new file 242; `wt/out` rebuilt; the `search-S3` profile + the 51
  clips + E3's index seeded, kit `S3\launch-s3.sh` + `c-ping.mjs`; docs `2639b2a`. Three questions (below).
- 16:47–16:49 · **Orchestrator check of question 1:** `studio-cut-plan-run-handler.test.ts` in THIS worktree → "Cannot find module
  '…\search\wt\stream\promises' imported from …\vitest\dist\module-evaluator.js" (16:48, reproduced); the same file in the track-E worktree
  @ `906273c` → 5 / 5 passed (16:50); the main `node_modules` vite / vitest unchanged since July; `vitest.config.ts` unchanged; the
  worktree's only ignored paths are `out/` and `node_modules/.vite/vitest` (one 6.8 KB results file, from our first run 15:12 — the track-E
  worktree has the same folder); no stray `package.json` / `node_modules` in `.vidtsx-temp\search\`. Builder #4: it fails here with step c's
  tracked edits reverted, `out/` moved and the vitest cache moved, and PASSES in a fresh detached worktree of `0b50a75` with and without
  step c's 21 paths. Cause not found (time-boxed).
- **Rulings (orchestrator, 16:49; committed `59479d5` — its first text said "16:55", an estimate; corrected from the clock):**
  - **LS-r1 (question 1) — the worktree-only `studio-cut-plan-run-handler.test.ts` failure:** counted like the E-d2a suites — the full gate
    may show it red in THIS worktree ONLY with the `stream\promises` resolution error, and only if the same file passes in a fresh detached
    worktree at the gate's HEAD (`git worktree add --detach <scratch> HEAD`, run the file there, remove the worktree; never `npx`; record
    the commands + both outputs). Any other error in it, or a failure in the fresh worktree, is real. The verifier repeats the proof.
  - **LS-r2 (question 2) — the model's size:** correct the catalog entry for `multilingual-e5-small` in `src/embedding-engine/model-registry.ts`
    to the measured download (`sizeBytes: 135_392_016`, `sizeLabel: '135 MB'`; report §7: onnx 118,308,185 + tokenizer.json 17,082,730 + the
    two small JSONs) with a test; the AI Models screen's label becomes the truth. The other catalog entries' undercounts are a NOTE (not
    this slice's).
  - **LS-r3 (question 3) — delete while the engine holds the model:** in scope, small: a before-delete hook in `embedding-model-events.ts`
    that the runtime uses to unload the child before `deleteEmbeddingModel` runs for the search model (unit test); a live delete on Windows
    is a note for S4.
  Builder #5 (finish step c: LS-r2, LS-r3, the ping loop) to spawn.
- 16:51 · S3 builder #5 spawned (HEAD `0e0435c`).
- 17:03 · S3 builder #5 HANDOFF (63 calls, ~13 min; **step c DONE**): `373125a` — LS-r2 (`model-registry.ts:87-89` 135,392,016 B / "135 MB",
  pinned by `model-registry.test.ts`), LS-r3 (`onBeforeEmbeddingModelDelete` / `runBeforeEmbeddingModelDelete`, `embedding-handlers.ts:182-183`
  awaits the hooks, `LibrarySearchRuntime.beforeModelDelete` → `engine.unload()` kill + wait ≤ 2 s, registered `search-app.ts:77`; 11 new
  tests, red 9 → green 18 files / 131); tsc 26 / 10; docs `22517c5`. **The ping loop (design §9.3 1) PASS:** `wt/out` rebuilt at `373125a`;
  the render guard clear (Hasan not rendering; C: 50.2 GB, headroom 25.4 GB); profile `search-S3`, CDP 9292, Studio root set first; status
  before the model Basic / not downloaded / 0; S1's model copied in; spawn + cold load + vector build: **152 pings, 0 errors, max gap 65.1 ms**
  (bar 250), max RTT 8.6 ms; build 57 / 57 in ~4.5 s; first Smart query "things falling over" 40 ms, `ran: smart`, pool 45, `crash-tumble`
  4th (= S1); node_modules unchanged. Its note: the build embeds the 6 `presets/*.json` (kind `data`) every `source`-copied profile carries
  → 57 / 57, not 51 / 51. **Orchestrator re-check:** tree clean at `22517c5`, matcher diff empty, 0 instances of ours,
  `…\search\S3\step-c\ping-report.json` read (pings 152, errors 0, maxGapMs 65.1, maxRttMs 8.6; first query party-popper /
  break-crash-digital / crunch-bite / crash-tumble / break-glass-crack; status2 `smart`, `auto`, 135392016, vectors 57 / 57).
- **Rulings (orchestrator, 17:04):**
  - **LS-r4 — what search covers:** the pool's default kinds = the playable media kinds (audio / video / image — `formatLibraryListing`'s
    `isPlayableMediaKind`); `data`, fonts, 3D models and other files are neither embedded nor returned by `library:search` (the Assets box
    still finds them by name through Basic's filter, design §8.3). So the vector count on a `source`-copied profile reads 51 / 51 (design
    §9.3 2 as written). `search-pool.ts` + `vector-sync` + tests.
  - **LS-r5 — a search during a model delete:** while a before-delete hook for the search model is pending, Smart searches run Basic with
    `degraded: 'model being removed'` and never spawn the child; cleared on the deleted / failed outcome. Unit test.
  Builder #6 (LS-r4, LS-r5, then step d — the agent tools) to spawn.
- 17:05 · S3 builder #6 spawned (HEAD `79b10c3`).
- 17:24 · S3 builder #6 HANDOFF (75 calls, ~18 min; LS-r4 + LS-r5 + step d part 1): `5796423` (LS-r4 the pool = playable media only; LS-r5
  Basic + `degraded: 'model being removed'` during the before-delete hook, cleared on `deleted` / a new optional `'delete-failed'` event);
  `eebcaff` (NEW `agent-tools/tool-library-search.ts` — the tools on `getLibrarySearchRuntime().search`, Basic over the read index if the
  runtime throws; `sound-reuse.ts` rewritten per design §8.1 — one header, an optional "Searched by words only" line, ≤ 20 E2 rows in the
  search's order, the place / force line, no claim / labels; generation only on an empty pool (Smart) / a true miss (Basic) / `force`;
  `REUSE_NOTE` / `FORCE_HINT` / prompt :31-32 rewritten + pinned; NEW `audio-tools-no-claim.test.ts` — all 1,515 rows through the real
  handlers in Basic AND Smart; E3's reuse / fill / miss tests rewritten; matcher, `sound-answer*`, corpus untouched); docs `82d5917`. Its
  runs: audio-tools + prompt 53 / 53; library-search + engine + handlers 131 + 2 skipped; a wider run 149 files passed / 5 failed — the 2
  E-d2a `shot-bundle*` suites + 3 with "Cannot find module '…\wt\stream\promises'" / "'…\wt\stream'" (`pack-package`, `project-package`,
  `project-package-import`). tsc 26 / 10; no file > 205 lines. Not shown red first: the prompt pins. `wt/out` is still the `373125a` build.
- 17:10–17:25 · **Orchestrator check:** `src/main/services/studio/pack-package.test.ts` fails here with the same `…\wt\stream\promises`
  error (reproduced); moving the worktree's own vitest cache (`wt\node_modules\.vite\vitest`, our 6.8 KB results file) aside to
  `.vidtsx-temp\search\S3\wt-node_modules-aside` changes nothing (vitest recreates the folder; same error); the bare import is
  `src/main/services/packages/zip-reader.ts:32` (`'stream/promises'`) — the same code passes in the track-E worktree. Cause environmental to
  this directory, not found (time-boxed again).
- **Rulings (orchestrator, 17:25):**
  - **LS-r1b — LS-r1 extended:** every suite that fails in THIS worktree ONLY with "Cannot find module '<wt>\stream'" or "'<wt>\stream\promises'"
    (today: `studio-cut-plan-run-handler`, `pack-package`, `project-package`, `project-package-import` — the graph through `zip-reader.ts`)
    is counted like the E-d2a suites, each proven green in a fresh detached worktree at the gate's HEAD (commands + outputs recorded); any
    other error, or a red in the fresh worktree, is real. The verifier repeats the proof.
  - **LS-r6 — the header names what ran:** "(words + meaning)" only when Smart ran; "(words only)" when Basic ran (explicit or fallback),
    plus the `degraded` reason line — `generate_*` answers and the `list_assets` header (design §8.1 / §8.2 clarified in the design note,
    this commit; §9 unchanged — the no-claim strings and "the neutral header" still hold). Test-pinned.
  Builder #7 (LS-r6, step d part 2 `list_assets`, rebuild `wt/out`, then step e) to spawn.

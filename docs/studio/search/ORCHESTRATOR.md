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

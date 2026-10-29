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
| S1 — the spike (no product code) | BUILDING | 0 | — (the spike's report is read by the orchestrator against S1's rule; S4 verifies the whole) | | | 2026-10-29 13:41 / |
| S2 — the design note + THE ACCEPTANCE BAR | TODO | | | | | |
| S3 — build (red-first, hand-off-sized parts) | TODO | | | | | |
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

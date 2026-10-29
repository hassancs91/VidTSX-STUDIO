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

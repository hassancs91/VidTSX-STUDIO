# Assistant timeline read — orchestrator state

> Run brief: Hasan's paste-in in `docs/studio/assistant-timeline/NEXT-SESSION.md` (the fenced "Paste-in" block, :24-126),
> following `docs/studio/END_TO_END_RUN.md`'s loop (builders with the 30 % hand-off rule, an independent verifier, ≤ 3 FAIL rounds,
> the stop report, "things you never do") with the paste-in's overrides. Parts T1 → T3 run in order with NO stop between them unless a
> STOP rule fires (a BLOCKED builder, three verifier FAILs, or T3's PASS).

- Branch: `library-search` (not pushed, not merged; its S4 PASS is recorded at `cf7d550`), worktree
  `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\wt`. This slice adds to it from `0df9e9c` (the NEXT-SESSION paste-in commit).
- Code base at the start: `git log -1 -- src/` = `3f08759` (library search S3). Gates there (S4 verifier round 1): worktree vitest
  `Test Files 28 failed | 509 passed | 6 skipped (543)` = the 25 LS-r1c + 3 E-d2a suites; tsc web 25 / node 10.
- Start state (15:45–15:52 +0200, 2026-10-30): main checkout `end-to-end-p0` @ `5d77600` still lists the other session's 20 changed paths
  (14 ` M` + 6 `??`; untouched); **Hasan's dev app NOT running** (0 `electron.exe`, no VidTSX process); the decision-models worktree
  `.vidtsx-temp\decisions\wt` did not exist at 15:45 and exists at 15:52 (`c14b180`, branch `decision-models` — that session started;
  never touched; 0 `electron.exe`, so none of its instances on 9300–9309 run); this worktree `git status --short` clean at `0df9e9c`.
  Resources 15:45: C: 29.4 GB, D: 39.6 GB, memory commit 61.2 / 99.7 GB (headroom 38.5 GB).

| Part | Status | Builders spawned | Verifier result | Commit | Numbers | Started / Finished |
|---|---|---|---|---|---|---|
| T1 — the design note + THE BAR (orchestrator) | BUILDING | — | — | — | — | 2026-10-30 15:52 / |
| T2 — build (red-first, hand-off-sized) | TODO | 0 | — | — | — | |
| T3 — verify (independent; ≤ 3 FAILs) | TODO | — | — | — | — | |

## Answers in force (Hasan's paste-in, 2026-10-30)

- **SCOPE ("lets do the 3"):** (1) a `get_timeline` read tool — every lane's clips (timeline start / end, source in / out, asset), the cut
  points (joins) on the master video track, gaps, the shots / overlays / audio over them; compact, paged / capped so a long project
  (video-14) never floods the context; (2) one line in the system prompt's "State of the edit" (the first few cuts, capped, "+N more");
  (3) a cut anchor for `insert_asset`: `at: { cut: n, offset? }` (n 1-based along the master track; offset seconds, negative = before)
  resolved in code — preferably to `{ anchorAssetId, sourceStart }` on the clip after the cut so it survives later edits; out of range /
  no cut → a plain error naming the cut count. The prompt lines pinned by tests.
- **T1** = the orchestrator's design note `docs/studio/ASSISTANT_TIMELINE_DESIGN.md` with THE ACCEPTANCE BAR, fixed before any verifier.
  **T2** = build, red first, (1) → (2) → (3); rebuild `wt/out`; the builder's own CDP smoke (open the 2-clip project, one `get_timeline`
  call through the real handler, NO model turn); the full gates; no Status.md / TESTING.md records in T2. **T3** = an independent
  verifier (the bar + the commit range + DRIVING's safety rules, never the builders' conclusions), ≤ 4 keyless turns per round; reports
  come back as text and the orchestrator saves them; past ~60 calls → INCOMPLETE + a continuation that reads only that report; three
  FAILs → stop. On PASS: Status.md entry at the top + TESTING.md **§19.5** (inside §19; §18.18+ reserved for tracks C / D / F) + the
  LS-r8 line in `docs/studio/search/ORCHESTRATOR.md`; then STOP with the stop report.
- **Overrides:** model calls only the verifier's ≤ 4 keyless `claude-subscription` turns (+1 retry each on an API error); no paid-key
  call; no other model / provider call (never choose "Smart + AI rerank" live — LS-r7); never read / copy / open a credential store
  (`settings.db*`, `~/.claude`, any profile's). Isolated profiles only. Never Hasan's `%APPDATA%\VidTSX Studio` library or projects,
  his stations (`B1-verify-root`, `profiles\B1-verify`, `B5-station-root`, `profiles\B5-station`) or B6 / B7 scratch; `profiles\E3`,
  `profiles\source`, `profiles\search-*` are read-only. Never the decision-models session's worktree, profiles or ports (9300–9309).
  Resource guard (C: ≥ 3 GB, C: + headroom ≥ 6 GB; `--maxWorkers=2` while headroom < 10 GB; DRIVING's load rules / E-d13). Work only in
  this worktree; never npx / npm there; never git stash; no new npm package. DEFERRED-HASAN for anything needing his hands / ears / keys.
  The orchestrator writes only docs, commits after each update, logs real-clock times, commits nothing while a builder or verifier runs;
  never push, never merge.
- **Ports / profiles:** builders `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\timeline-T\profile` (CDP 9296); the verifier
  `profiles\timeline-verify\profile` (CDP 9297; round N → `timeline-verifyN`). Either may be a copy of `profiles\search-S4-verify\profile`
  WITHOUT `settings\settings.db*` (model, Smart, the 51-clip library), or a fresh copy of `profiles\source\profile`; library root
  `<profile>\assets`; Studio root set in the first CDP call. The 2-clip test project: a copy of
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S4\r1\p2\pristine\` (+ its clip `…\search\S4\r1\media\e3v-clip.mp4`, read-only sources)
  in the agent's own scratch root. Kits `D:\repos\VidTSX-STUDIO\.vidtsx-temp\timeline\<PART>\`; big outputs
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\timeline\<PART>\`.

## Stops

(one line per stop: what was reported, what Hasan said)

## Log

- 15:45 · start checks: main checkout's 20 uncommitted paths still there; Hasan's dev app not running (0 `electron.exe`); no
  `.vidtsx-temp\decisions\wt` yet; worktree clean at `0df9e9c`; C: 29.4 GB, D: 39.6 GB, headroom 38.5 GB.
- 15:52 · `.vidtsx-temp\decisions\wt` now exists (`c14b180`, the parallel session) — not ours, never touched. This file created; T1
  (the design note) starts.

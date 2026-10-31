# Next session — ASSISTANT TIMELINE READ: `get_timeline`, the cuts line, the cut anchor (Hasan 2026-10-30: "lets do the 3, but in a new session")

> **SPENT — this paste-in ran 2026-10-30 15:45–17:43 and stopped on T3 PASS** (all three items built; 4 / 4 live turns placed; LS-r8
> settled by measurement; records `84f8537`). State: `docs/studio/assistant-timeline/ORCHESTRATOR.md` ("Stops"). Do not paste it again.

> Written 2026-10-30 after the library-search run (S4 PASS, `cf7d550`; ruling LS-r8 open). "The 3" is read as **all three items** the
> orchestrator proposed: (1) a `get_timeline` read tool, (2) a cuts line in the prompt's "State of the edit", (3) a cut anchor in
> `insert_asset`. If Hasan meant the cut anchor ONLY, edit the paste-in's SCOPE line before pasting. Paste the fenced block into a new
> Claude Code session at `D:\repos\VidTSX-STUDIO`. It may run AT THE SAME TIME as the decision-models session
> (`docs/studio/decisions/NEXT-SESSION.md`) — the two never share a worktree, branch, profile or CDP port.

## Why (the facts, as of `2cc2751`)

- S4's four keyless turns (design §9.3 5) all named the right clip and then ASKED for the first cut's time: the assistant cannot see cut
  points. The prompt's "State of the edit" gives only `- Timeline: <length> long.` (`src/main/services/studio/studio-agent-prompt.ts:88-90`);
  none of its 25 tools (`studio-agent-prompt-tools.ts:9-33`) reads the timeline's clips — there is no `get_timeline`.
- Not a library-search regression: E3's earlier turn on the same project (before the range) asked too and placed (2.75 s) only after the
  user typed "The cut is at 3.0 seconds" (`C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S4\r1\e3v-agent-chat.orig.json`).
- Building blocks already in the tree: `clipLearnJoins(masterClips)` / `collectCutLearnJoins` (`src/shared/studio/cut-learn-joins.ts:34,69`,
  B4's join maths); `insert_asset`'s `at` = timeline seconds | `{ word, take, assetId? }` resolved to `{ anchorAssetId, sourceStart }` so it
  survives cuts (`src/main/services/studio/agent-tools/insert-tools.ts:28,39,65-96`); `formatTc` for times in the prompt.
- LS-r8 (`docs/studio/search/ORCHESTRATOR.md`): S4 was recorded PASS on the reading "asked with the right clip = a NOTE". This slice turns
  the same four turns into a real placement test and settles LS-r8 by measurement.

## Paste-in

```
You are the ORCHESTRATOR for a small follow-up slice: ASSISTANT TIMELINE READ — let the Studio assistant see the
timeline's clips and cut points, and place at a cut without arithmetic. Follow docs/studio/END_TO_END_RUN.md's
loop (builders with the 30 % hand-off rule, an independent verifier, ≤ 3 FAIL rounds, the stop report, "things
you never do") with the overrides below.

SCOPE (Hasan, 2026-10-30 — "lets do the 3"): (1) a `get_timeline` read tool — every lane's clips (timeline
start / end, source in / out, asset), the cut points (joins) on the master video track, gaps, and the shots /
overlays / audio laid over them; compact, and paged / capped so a long project (video-14: 55 shots, many clips)
never floods the context; (2) one line in the system prompt's "State of the edit", e.g. `- V1: 2 clips · cuts at
0:03.00` (the first few cuts, capped, "+N more"); (3) a cut anchor for `insert_asset`: `at: { cut: n, offset? }`
(n 1-based along the master track; offset seconds, negative = before the cut) resolved in code — prefer resolving
to the clip AFTER the cut as `{ anchorAssetId, sourceStart }` so it survives later edits like the word anchor;
an out-of-range n or a timeline with no cut answers a plain error naming the cut count. The prompt lines for the
new tool / anchor are pinned by tests.

WHERE: the existing worktree D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\wt, branch library-search (not pushed,
not merged — its S4 PASS is recorded; this slice adds to it). Work only there. The main checkout has another
session's uncommitted work: never edit, stage, build or launch there, never touch its out/ or node_modules,
never git stash. No node_modules in the worktree: tests `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs
run …`, types `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit`
(+ tsconfig.node.check.json; baseline now web 25 / node 10), build per docs/studio/end-to-end/DRIVING.md "Track
E"; never npx / npm there; no new npm package. Docs: docs/studio/assistant-timeline/ (ORCHESTRATOR.md,
T2/HANDOFF.md + LOG.md) and docs/studio/ASSISTANT_TIMELINE_DESIGN.md (new). Kits: D:\repos\VidTSX-STUDIO\
.vidtsx-temp\timeline\<PART>\; big outputs: C:\Users\hasan\AppData\Local\vidtsx-e2e\timeline\<PART>\.

READ FIRST (from the worktree): CLAUDE.md; docs/studio/assistant-timeline/NEXT-SESSION.md (this file — "Why");
docs/studio/search/ORCHESTRATOR.md ("Answers in force", the rulings LS-r1c and LS-r8, the Stops line);
docs/studio/LIBRARY_SEARCH_DESIGN.md §9.3 5 (the four turns); docs/studio/END_TO_END_RUN.md;
docs/studio/end-to-end/DRIVING.md; docs/ui-automation-cdp.md. Code: src/main/services/studio/studio-agent-prompt.ts
+ studio-agent-prompt-tools.ts, agent-tools/{insert-tools,project-tools,index,types}.ts,
src/shared/studio/cut-learn-joins.ts, the StudioClip / track types (src/shared/types/studio.ts).

FIRST: say in one line whether the main checkout's uncommitted work is still there, whether my dev app runs
(if it does: never kill it, never run electron-vite dev, launch our own instances only after checking I am not
rendering — DRIVING), and whether the decision-models session's worktree (.vidtsx-temp\decisions\wt) exists /
its electron.exe instances (ports 9300–9309) run — never touch them. Check `git status --short` in the worktree
is clean. Create docs/studio/assistant-timeline/ORCHESTRATOR.md; commit with explicit paths.

PARTS, in order, no stop between them unless a STOP rule fires:
T1 — THE DESIGN NOTE + THE BAR (the orchestrator writes it, before any builder): the tool's output format (an
  example for the 2-clip test project and the paging rule for long timelines), the "State of the edit" line, the
  cut anchor's semantics (n, offset, what it resolves to, its errors), the prompt lines, the files (feature
  isolation, services own logic, pure formatters in src/shared or the tools' services with unit tests, ≤ ~300
  lines per file, no `any`), and THE ACCEPTANCE BAR, fixed before the verifier:
  - unit: get_timeline on fixtures — the 2-clip project (1 cut at 0:03.00), a long synthetic timeline (> 50
    clips; the cap and "+N more" exact), gaps, overlays, audio, an empty timeline; the cuts line exact for 0 / 1 /
    many cuts; the cut anchor: `{ cut: 1 }` → the join's time, `offset` applied, out of range / no cuts → the
    plain error, the anchor still lands on the join after an earlier clip is trimmed (if resolved to the
    footage); the prompt lines pinned; insert_asset's number / word paths unchanged;
  - gates: the worktree vitest gate with LS-r1c (the 25 `<wt>\stream` suites, fresh-worktree proof) and E-d2a
    rule (b); tsc ≤ 25 / 10; the matcher files byte-identical to 7967c6f; library search's §9.1 tests green;
    house rules; no new package;
  - live (the four turns, ≤ 4 keyless claude-subscription turns + 1 retry each on an API error): the same
    prompts as LIBRARY_SEARCH_DESIGN §9.3 5 — "Add a soft whoosh at the first cut." ×2, "Add the sound of things
    falling over at the first cut." ×2 — on an isolated profile with the model, Smart, the 51-clip library, the
    stand-in provider with its counter, the 2-clip project in a clean state per turn. PASS = no claim string in
    any tool answer (§9.1's six), nothing generated, every proposal / placement uses the allowed clip
    (whoosh: whoosh-soft or another whoosh-tagged sfx; falling: crash-tumble) and STARTS within [cut − 1.0 s,
    cut + 0.1 s] of the first cut, at least 3 of the 4 turns place (each prompt at least once); a turn that
    still asks = a NOTE (at most one); FAIL = a generation, a wrong clip, a wrong time, a claim string, or
    fewer than 3 placing turns.
T2 — BUILD, red-first, hand-off-sized: (1) then (2) then (3) with unit tests first; rebuild wt/out; the
  builder's own CDP smoke on an isolated profile (open the 2-clip project, one get_timeline call through the
  real handler, NO model turn); the full gates. No Status.md / TESTING.md records in T2.
T3 — VERIFY: an independent verifier (the bar + the commit range + DRIVING's safety rules, never the builders'
  conclusions; it re-runs the gates, builds its own probes and mutations, runs the four turns — at most 4
  keyless turns in total for the round). Subagents may not write report files outside the tree in this harness:
  the verifier returns its report as text and the orchestrator saves it (e.g. .vidtsx-temp\timeline\T3\rN\REPORT.md).
  A verifier past ~60 tool calls returns INCOMPLETE with its report so far; a continuation of the same round
  reads only that report. Three FAILs → stop and report. On PASS: a Status.md entry at the top and a
  TESTING.md **§19.5** block (inside library search's §19; §18.18+ stays reserved for tracks C / D / F); record in
  docs/studio/search/ORCHESTRATOR.md that LS-r8 is settled by measurement (or not, with the numbers); then STOP
  with the stop report.

OVERRIDES for the whole run
- Model calls: only the verifier's ≤ 4 keyless claude-subscription turns (+1 retry each on an API error); no
  paid-key call; no other model / provider call (never choose "Smart + AI rerank" live — LS-r7). Never read,
  copy or open a credential store (settings.db*, ~/.claude, any profile's).
- Isolated profiles only: builders C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\timeline-T\profile (CDP
  9296); the verifier profiles\timeline-verify\profile (CDP 9297). Either may be a copy of
  profiles\search-S4-verify\profile WITHOUT settings\settings.db* (it already holds the downloaded model, Smart
  and the 51-clip library), or a fresh copy of profiles\source\profile; library root <profile>\assets; Studio root
  set in the first CDP call. The 2-clip test project: copy C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S4\r1\
  p2\pristine\ (+ its clip C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S4\r1\media\e3v-clip.mp4) into your
  own scratch root — read-only sources. Never my %APPDATA%\VidTSX Studio library or projects, never my stations
  (B1-verify-root, profiles\B1-verify, B5-station-root, profiles\B5-station) or B6 / B7 scratch; profiles\E3,
  profiles\source, profiles\search-* are read-only. Never the decision-models session's worktree, profiles or
  ports (9300–9309).
- Resource guard (DRIVING): before any launch, copy, build or full run check C: free AND memory commit headroom
  (C: ≥ 3 GB, C: + headroom ≥ 6 GB; --maxWorkers=2 while headroom < 10 GB); another session may load the CPU —
  DRIVING's load rules / E-d13, measured and recorded.
- Every builder brief adds: "Work only in the worktree; never npx/npm there, never git stash, never touch the
  main checkout. Read docs/studio/end-to-end/DRIVING.md. Edit HANDOFF.md, Status.md and TESTING.md with the
  Edit/Write tools only — no Python, node, sed or heredoc for doc edits. Never hand back while a job you started
  is still running. Select your own processes by --remote-debugging-port or profile path plus Name='electron.exe'.
  Write HANDOFF.md as you go and commit early (explicit paths). Every git / tree / build statement in the records
  is 'as of <hash>' and re-checked after the commit. Numbers in prose come from the report files."
- Anything needing my hands, ears or keys: build + verify up to it, mark it DEFERRED-HASAN, list it, continue.
- The orchestrator writes only docs (docs/studio/assistant-timeline/, the design note, the LS-r8 line in
  docs/studio/search/ORCHESTRATOR.md), commits after each update, logs times from the real clock (`date`), and
  commits nothing while a builder or verifier runs. Never push; never merge.
```

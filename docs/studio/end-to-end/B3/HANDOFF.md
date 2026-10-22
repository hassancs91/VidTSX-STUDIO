# B3 — QA readouts on the cards: hard entries and clipped tails, offending joins listed and auditionable
status: IN PROGRESS (steps 1–3 done: pure QA module + exit (a) measured; QA wired onto plans and
both proposal kinds in main; the card readout with auditionable spots. Step 4 live run DONE
(builder #4): exit (b) met (1 hard entry of 164 joins, explained by the waveform), the negative
fires (121 of 162), the spot audition plays across the join. **Exit (c) needs the orchestrator's
call:** the tail COUNT stays 265 at margin 12/18/24 (the landings get louder: mean +11.45 → +14.51
→ +16.23 dB) — see Open problems. Then: full gate + TESTING §18.9 + STATUS row)

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety rules, profiles on C:, the disk
rules — new artefacts over ~1 MB go to `C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\`, D: stop line
1.0 GB — the "Vitest gate under load" rule, the process-kill lesson, every "Learned" line) and the
**"Track B decisions"** section of `docs/studio/end-to-end/ORCHESTRATOR.md`. B1 (snapper DSP,
waveform v3) and B2 (cut-style.json, `resolveCutStyle`, all four consumers, read-out + override)
are DONE: read their STATUS rows (top of `Status.md`) first.

**Never hand back while a job you started (proxies, waveforms, a render, a check) is still
running — wait for it inside your own session.**

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **B3** | QA readouts on the cards: hard entries and clipped tails (analyze_cut's checks), with the offending joins listed and auditionable | on M2, tight: hard entries 0 at `head 0.15`; raising `margin` shows clipped tails as expected |

Session gates (plan §3 head): `npx vitest run` green (DRIVING.md rule), `npm run check:types` at
or below baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the
STATUS.md row, the TESTING.md §18 block (`### 18.9 B3`, after `### 18.8 B2`). Schema additions
optional only; old proposals/plans without QA fields must still load and render.

## Plan context (§1.x facts, §2 decision, §5 items to read)

**Read plan §1.1 (:52-104) and §2 T1 (:394-426).** T1: "…a `snapHead`, the `minSkip` merge, and
the two QA readouts (hard entries, clipped tails) on the Auto Cut and editorial cards."

**The two checks, exactly (`D:\repos\claude-youtube-editor\tools\analyze_cut.py`, READ-ONLY, 155
lines — read `entry_check` and the clipped-tail loop in `main`):**
- **Hard entries** (`entry_check`): walk the planned segments of a clip in order; a segment start
  `s` is a **real cut join** when it is the first segment or `s − prev_end > 0.75` s (raw source
  time); at a real join, `over = rms_db(s − 0.06, 0.05) − floor`; flag when `over > 15` dB ("a
  breath intake sits ~+12 dB, real speech +20 and up"). Compressed intra-keep pauses (≤ 0.75 s)
  are NOT checked.
- **Clipped tails** (in `main`): for every ATOM (`split_atoms(keeps, words, internal_gap)`) end
  `e`, `gap` = next atom start − e (None for the last), `tail = tail_for(probe, cid, e, gap,
  style)[0]`, `over = rms_db(e + tail) − floor` (cutlib's default 50 ms forward window); flag
  when `over > 6` dB ("word release still audible where we land"). Note it is per atom, not per
  join.
- Studio already has the pieces: `RmsEnvelope.rmsDb` (overlap-weighted windows over the v3
  waveform's 20 ms buckets), `floorDb` (10th pct of 50 ms windows, within 0.16 dB of cutlib on
  M2), `tailFor`, atoms/segments in `cut-planner.ts`. B1 showed Studio's 20 ms buckets can
  over-read a loud bucket edge (≤ ~0.6 dB p95 in tail windows; up to 30 dB at a head-window
  edge) — expect a few threshold-edge disagreements, explain them with the waveform.

**Reference numbers:** Hasan's `videos/video-14/work/analysis/qa-report.md` (tight, his hand-audited
keeps in `cuts.json`) reads **"Hard entries: 0"** and **"clipped-tail risks: 181"** (per clip:
5, 11, 20, 12, 63, 4, 39, 27). The report may predate the latest `cuts.json` — recompute it.
**Never run `analyze_cut.py`'s `main`** (it writes `qa-report.md` INTO the editor repo): import
`entry_check` / `cutlib` from a scratch script (`python -I -B`, outputs only in your scratch on
C:) the way B1's `cutlib_joins.py` did (`.vidtsx-temp/end-to-end/B1/cutlib_joins.py`,
`compare.b1.test.ts`, `vitest.b1.config.ts` — reuse the pattern).

**Where the cards are:** the Auto Cut proposal headline is built in
`src/shared/studio/cut-proposal.ts` (~:102, B2 made it `Auto Cut (<style display name>) · …`);
the plan is made in main (`cut-plan-runner.ts`, `planCuts` in `cut-planner.ts`); the editorial
pass's card comes from the agent's cut tool (`src/main/services/studio/agent-tools/cut-tools.ts`
→ `snapEditorialCuts`, `src/shared/studio/cut-snap.ts`). Review UI: `ReviewCutsSection.tsx`
(it already has audition/seek code — reuse it for "auditionable"), `usePlayback.ts`,
`PreviewPanel.tsx`.

## Orchestrator decisions (DECIDED — follow them; raise objections under Open problems)

1. **One pure QA module** in `src/shared/studio/` (e.g. `cut-qa.ts`) implementing both checks with
   analyze_cut's exact thresholds and windows over `RmsEnvelope`, unit-tested against hand-made
   envelopes (a hot join at +16 dB flags, +14 does not; a join after a 0.6 s pause is not a real
   join; a tail landing +7 dB flags, +5 does not; the last atom has no gap). Thresholds as named
   constants (15 dB, 0.75 s, 0.06/0.05 s, 6 dB).
2. **Computed where the plan/proposal is made** (main) and stored as OPTIONAL fields on the plan
   / proposal (counts + the offending items: clip/asset, source time, timeline time if known,
   dB over floor). Old proposals without them render as today.
3. **On the card:** a QA line under the headline on BOTH the Auto Cut card and the editorial card
   ("Hard entries 0 · clipped tails 12"), expandable to the list; each listed item is
   **auditionable** — one click seeks the preview to ~1 s before the join (or tail end) and
   plays ~2 s (reuse ReviewCutsSection's audition/seek). Zero items = a quiet "QA clean" line.
4. **No model call in B3.** The editorial card's readout is proven through the real cut-tool
   handler with a fixture (no LLM), plus a component/unit test; B6 runs the real editorial pass.
   The Auto Cut card is driven live.
5. **The exit, measured three ways:** (a) Studio's QA on the SAME plan as analyze_cut (cuts.json
   keeps, fitted tight from `cut-style.json`, M2's v3 waveforms + mapped transcripts — B1's
   harness) vs your recomputed analyze_cut numbers: hard entries 0 on both; clipped tails per
   clip with deltas explained. (b) Live on a C: COPY of M2 (never the shared one): every clip
   with speech on V1, Auto Cut with the default style (tight, `head 0.15`) → the card says hard
   entries 0 (or each listed item explained by the waveform). (c) Raise `margin` through the
   project override knobs (12 → 18 → 24 dB, B2's `settings.cutStyle` knobs) → the clipped-tail
   count rises monotonically on the card; record the counts. Also a negative: shrink `head` (e.g.
   0.0 with `maxHead` off via base natural + head 0) → hard entries appear, proving the check
   can fire on real material.

**Material:** M2 = `C:\Users\hasan\AppData\Local\vidtsx-e2e\b-root\projects\video-14-raw` (shared,
READ-ONLY for you: copy it into `C:\Users\hasan\AppData\Local\vidtsx-e2e\B3-root\projects\`
before any live run; media paths keep pointing at the raw clips). Clip ↔ asset ids:
`docs/studio/end-to-end/B1/HANDOFF.md` "Done". Profile: copy
`C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\source\profile` to
`C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\B3\profile`, CDP port 9291. Disk at hand-off:
C: 18.6 GB, D: 2.04 GB.

## Done (file:line, commit hashes)

- **Step 1 — the pure QA module (decision 1), `e583d26`:**
  - `src/shared/studio/cut-qa.ts` (138 lines): named constants `QA_REAL_JOIN_GAP_S 0.75`,
    `QA_ENTRY_LOOKBACK_S 0.06`, `QA_ENTRY_WINDOW_S 0.05`, `QA_HARD_ENTRY_DB 15`,
    `QA_TAIL_WINDOW_S 0.05`, `QA_CLIPPED_TAIL_DB 6` (:27-37); `findHardEntries(segments, env,
    floor?)` = `entry_check` (:50-70; flags on the raw value, stores `overDb` rounded to 0.1);
    `findClippedTails(atoms, style, env, floor?)` = analyze_cut main's loop, per ATOM, gap = next
    atom start − end, null for the last, `tailFor` then `rmsDb(e + tail, 0.05)` (:73-95; item
    `sourceTime` = landing e + tail, `wordEnd` = e); `runCutQa({segments, atoms, style, envelope})`
    (:98-109); `mergeCutQa(reports)` for a card spanning clips (:112-124); `formatCutQaLine` →
    `Hard entries N · clipped tails M` or `QA clean` (:127-130). It imports `tailFor` from
    `cut-planner.ts` (one direction; cut-planner does not import it — that file is 273 lines, so QA
    is NOT inside `planCuts`: the caller runs it on the plan).
  - Types, optional only (`src/shared/types/studio-cut-plan.ts:152-189`): `StudioCutPlan.qa?:
    CutQaReport`; `CutQaKind = 'hard-entry' | 'clipped-tail'`; `CutQaItem {kind, sourceTime,
    wordEnd?, overDb, assetId?, clipId?, timelineTime?}`; `CutQaReport {hardEntries, clippedTails,
    joinsChecked, atomsChecked, items}` (hard entries first, then tails).
  - `src/shared/studio/cut-qa.test.ts` — 11 tests on hand-made 50 bps envelopes: +16 dB flags /
    +14 not; the window before the cut-in, not the speech after it; a 0.6 s skip is not a real join
    (joinsChecked 1) / 0.8 s is (2); window clamped at source start; a tail landing +7 flags / +5
    not; the last atom has no gap (soft, unclamped: lands in silence while the gap-clamped first
    atom lands in its +20 release at 3.19); every atom checked, not every join; run/merge/format.
- **Exit (a) measured** (scratch, not committed — `.vidtsx-temp/` is git-ignored):
  `.vidtsx-temp/end-to-end/B3/analyze_cut_ref.py` (imports `analyze_cut.entry_check` + `cutlib`,
  repeats main's tail loop verbatim, records every join/atom level) →
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\analyze-cut-ref.json`;
  `.vidtsx-temp/end-to-end/B3/compare.b3.test.ts` + `vitest.b3.config.ts` (gated `B3_COMPARE=1`;
  asserts cut-style.json's tight == cuts.json's fitted tight knob for knob; planClip on cuts.json's
  keeps/cuts with M2's v3 waveforms + transcripts, then `runCutQa`) →
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\compare-b3-report.json`.
  **Result: hard entries 0 / 0 on all nine clips; clipped tails analyze_cut 181 (5, 11, 20, 12,
  63, 4, 39, 27 — exactly Hasan's qa-report.md, so that report is current) vs Studio 178 (5, 11,
  20, 12, 61, 4, 38, 27): 178 flagged by both, 3 by analyze_cut only, 0 by Studio only.** Hottest
  real join per clip (dB over floor, analyze_cut / Studio): 0369 5.69/5.37 · 0370 7.01/6.98 ·
  0371 8.70/8.76 · 0372 13.04/12.14 · 0373 11.16/11.11 · 0374 13.38/13.29 · 0375 7.63/7.66 ·
  0376 14.17/14.41 — all under 15 on both sides. Floors within 0.16 dB.
  The 3 deltas, explained: **0373 e=32.618** — same tail (80 ms), level 6.10 vs 5.92 dB: a 0.18 dB
  bucket-averaging read at the 6 dB edge. **0373 e=65.148** — Studio's tail 440 ms vs cutlib's
  380 ms (B1's known tail miss, Studio longer = safe side); at cutlib's landing Studio also reads
  7.37 (would flag), at its own later landing 5.93. **0375 e=51.093** — tail 160 vs 140 ms (one
  20 ms step); at cutlib's landing Studio reads 6.36 (would flag), at its own 5.82. So every
  delta is the 20 ms-bucket measurement B1 documented, none is a logic difference. (Segment counts
  differ on 0370 10/11 and 0371 24/23 = B1's two merge flips; 0373 checks 43/42 real joins — one
  skip sits on the 0.75 s edge on one side; neither side flags anything there.)
- **Step 2: QA wired onto plans and both proposal kinds (decision 2), `47bc6a1`:**
  - `src/shared/studio/cut-qa.ts`: `qaForPlan({segments, keeps, words, style, envelope})` (:111-133)
    re-derives the planner's atoms (`splitAtoms(keeps, sorted words, style.internalGap)`) and runs
    `runCutQa`, so `planCuts` stays QA-free; `withQaAsset(report, assetId)` (:136-138) stamps items
    (keeps an asset already named). The card wording DECIDED above now lives here:
    `formatHardEntries` → `Hard entries N of J joins` (:162), `formatReleaseTails` → `Tails on a
    release M of A landings` (:167), `formatCutQaLine` → both joined (`… · tails on a release …`)
    or `QA clean` only when both counts are 0 (:172). The check logic (:50-109) is unchanged.
  - Auto Cut: `cut-plan-runner.ts:98-112` — after `planCuts`, `plan.qa = qaForPlan` over the same
    one keep `[0, envelope.duration()]` `planCuts` defaults to and `planned.style` (the
    compensated knobs); the plan file on disk carries `qa`. `buildCutProposal`
    (`src/shared/studio/cut-proposal.ts:118`) copies it to `proposal.qa` via `withQaAsset` (the
    renderer's Auto Cut button gets the plan over IPC and builds the proposal with this same
    function, so the toolbar path carries it with no IPC change). `run_auto_cut`'s reply ends with
    the QA line (`workflow-tools.ts:165`).
  - Editorial: `snapCutSpans` (`src/shared/studio/cut-snap.ts:208-209`) returns optional `qa`
    from ITS segments, keeps and pause-compression-off style (`internalGap ∞` → one atom per
    keep); absent when no span survived. `buildEditorialProposal` takes optional `qa` →
    `proposal.qa` (`editorial-cuts.ts:52-53, :94`); `propose_cuts` passes it and ends its reply
    with the QA line (`cut-tools.ts:87, :98`). The Transcript panel's text delete also gets `qa`
    from `snapCutSpans` and ignores it.
  - Type: `StudioProposal.qa?: CutQaReport` (`src/shared/types/studio.ts:336-341`). Proposals are
    persisted as-is (`project-store.ts:56` passes `doc.proposals` through), so `qa` survives a save.
  - Tests (all new cases): `cut-qa.test.ts` — wording with denominators / "QA clean"; `qaForPlan`
    splits at `internalGap` (3 atoms) vs ∞ (2), real join flags at +18 dB; `withQaAsset`.
    `cut-plan-runner.test.ts` — plan.qa `{0,0,joins 2,atoms 2,[]}` and identical in the plan file.
    `run-auto-cut.test.ts` — via the REAL handler: plan.qa, `proposal.qa` equal, reply contains
    `QA clean.`. NEW `src/main/services/studio/agent-tools/cut-tools.test.ts` — `propose_cuts`
    through the REAL handler on a fixture, no model call (decision 4): a retake cut inside
    continuous speech → `hardEntries 1 of 2 joins` (the item's `sourceTime` == the cut's
    `sourceEnd`, > 15 dB), `clippedTails 1` (wordEnd 0.9), assetId `a1`, reply contains `Hard
    entries 1 of 2 joins · tails on a release 1 of 2 landings.`; a cut to the end → 0 hard of 1
    join, 1 tail landing past the cut start (see Open problems). `cut-proposal.test.ts` /
    `editorial-cuts.test.ts` — qa carried + stamped; a pre-B3 plan / no-qa input → no `qa` key.
- **Step 3: the card readout (decision 3 + the DECIDED wording), `99d825d` (code only, no app
  launch — disk override):**
  - `src/features/studio/services/cut-proposal.ts`: `formatCutTc` moved here from
    ReviewCutsSection (:126); constants `QA_AUDITION_LEAD_S 1`, `QA_AUDITION_SPAN_S 2`,
    `QA_VISIBLE_SPOTS 20` (:137-140), slack 0.05 s; `QaSpot {item, time}`;
    `mapQaItemToTimeline(result, proposal, item)` (:160) maps asset + `sourceTime` onto the
    RESULT timeline (accepted cuts applied — what the Player plays while previewing): first clip
    of the asset holding the time, master lane (`masterLane`) first; a time inside an ACCEPTED
    span of the proposal maps to that cut's join (kept edge: `sourceStart` → left piece's end,
    else `sourceEnd` → right piece's start) — this resolves the "editorial tails inside a removed
    span" open problem; null = no asset / not on the timeline. Speed ignored, like
    `mapCutItemToTimeline` and the apply. `buildQaSpots(result, proposal, qa)` (:183) = hard
    entries in plan order, then tails by `overDb` desc, each mapped.
  - NEW `src/features/studio/components/CutQaReadout.tsx` (162 lines): line 1
    `formatHardEntries` (`text-accent-red` when > 0, else neutral; tooltip "the cut-in starts on
    sound more than 15 dB over the room tone — listen for a hard entry"), line 2
    `formatReleaseTails` neutral with the DECIDED tooltip; both 0 → one `QA clean` line
    (`formatCutQaLine`, `text-text-dim`, title = both counts). Toggle `List the spots (N)` /
    `Hide the spots`; rows capped at 20 + `Show all N`. `CutQaSpotRow` (hook-free, the whole row
    is a `<button>`: ▶, chip `hard entry`/`tail`, source time, `+X.X dB`; disabled with "This spot
    is not on the timeline" when unmapped) → `onAudition(time)`. DOM hooks for CDP:
    `[data-cut-qa="report"|"clean"]`, `[data-cut-qa-hard=N]`, `[data-cut-qa-tails=M]`,
    `[data-cut-qa-toggle]`, `[data-cut-qa-spot=hard-entry|clipped-tail]`, `[data-cut-qa-show-all]`.
  - `ReviewCutsSection.tsx`: new required prop `onPlayQaSpot(timelineTime)` (:29); the scratch
    apply is now a `resultTimeline` memo (:65-69, `resultSeconds` derives from it); `<CutQaReadout>`
    renders under the headline + count line, above the ⚠ lines, only when `proposal.qa` exists
    (:83-90) — no `qa` → markup as before. Both cards (Auto Cut, editorial) are `cut-plan` and go
    through here.
  - `EditorShell.tsx`: `handlePlayQaSpot` (:635-643) — turns the result preview on if off
    (restored after, like `handlePlayJoin`), then `playSpan(t − 1, t − 1 + 2, needsRestore)`
    through the existing audition stop-at; passed as `onPlayQaSpot` (:1483).
  - Tests: NEW `src/features/studio/services/cut-proposal-qa.test.ts` (9) — fixture apply sanity;
    hard entry at the cut end → join; Auto Cut tail at the cut start → same join; kept audio →
    through its piece; a tail inside a removed span → that cut's join; a rejected cut → plays in
    place; no asset / other asset / trimmed → null; master lane first; `buildQaSpots` order + times.
    NEW `src/features/studio/components/CutQaReadout.test.ts` (9; Node, no DOM — SSR markup via
    `renderToStaticMarkup`, the row's click by calling the hook-free `CutQaSpotRow` and firing its
    `onClick` prop): wording + denominators + red tone + tooltip + collapsed by default; 0 hard
    entries not red; `QA clean` with no toggle; open-list order 16.4 / 11.5 / 7.2; cap 20 +
    `Show all 25`; a row click calls the audition with the mapped time (2 = the join); an unmapped
    row is disabled and inert; `ReviewCutsSection` without `qa` renders no `data-cut-qa`, with
    `qa` the readout sits under the headline.

- **Step 4 — the live exits (b)/(c) on the REUSED scratch (orchestrator override), builder #4, no
  code change, nothing committed but docs.** Root `C:\Users\hasan\AppData\Local\vidtsx-e2e\B2-root`
  (project.json backed up first to `…\vidtsx-e2e\B3\backup\b2-root-project.before-b3.json`, then
  reset by `.vidtsx-temp/end-to-end/B3/reset-project.mjs`: no `presetId`/`cutStyle`, empty tracks,
  no proposals), profile `profiles\B2\profile`, CDP 9291 (`B3/launch.sh`, `B3/cdp.mjs`,
  `B3/drive.mjs`, `B3/restore.ps1`). All nine clips added to V1 through the pool's "Add to
  timeline" (0366 at 0 … 0373 at 464.346 … 0376 at 1100.298; original total 1283.09 s). Auto Cut
  per clip from the Inspector; card read through `[data-cut-qa*]`, `plan.qa` read from the plan
  file. Card == plan file on every run. Per-run JSON: `C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\exits-<tag>.json`.
  - **Exit (b) — default style (`tight · default`, head 0.15, maxHead 0.3), card per clip
    (hard of joins / tails of landings):** 0366 0/3, 6/8 · 0369 0/5, 5/6 · 0370 0/11, 15/18 ·
    0371 0/23, 36/44 · 0372 0/16, 26/28 · **0373 1/53** (red), 84/92 · 0374 0/3, 5/7 · 0375 0/26,
    50/53 · 0376 0/24, 38/42 → **hard entries 1 of 164 joins, tails 265 of 298 landings**; a rerun
    at the end gave the identical totals. **The one hard entry, explained:** 0373 cut-in at source
    323.198 s (`+17.7 dB`); the removed 2.0 s before it (321.193 → 323.198) holds an
    UNTRANSCRIBED sound at 322.4–322.8 s peaking at −12 dB (speech level; transcript: "ready,"
    ends 320.733, "before" starts 323.348) that decays through the check window (323.14–323.19:
    −35 to −36 dB vs floor −53.1/−53.4). Hasan's hand edit never cuts in there: `cuts.json` removes
    320.01–324.383 as a retake, which is why exit (a) on his keeps read 0. A real hard entry the
    check is meant to catch, not a QA error.
  - **Negative** (`settings.cutStyle {base natural, head 0}` → natural has no `maxHead`): **121 of
    162 joins** hard (per clip 2/3, 4/5, 9/11, 14/22, 13/15, 42/53, 2/3, 16/26, 19/24), tails 97 of
    298 — the check fires on real material.
  - **Exit (c) — margin raised as a project knob override** (`settings.cutStyle {margin: N}` set
    through the app's own project update — the InspectorPanel `onUpdate` prop, the same write the
    override select does, reached via the React fiber; there is no UI editor for single project
    knobs, `cut-style-override.ts` calls them hand-written; the readout then reads `tight + 1
    override · project override` with `margin N` in its title): tails **265 → 265 → 265** at
    margin 12 / 18 / 24 (per clip identical: 6, 5, 15, 36, 26, 84, 5, 50, 38); the landings get
    louder — mean tail item **+11.45 → +14.51 → +16.23 dB** over floor (from the plan files) — but
    no new landing crosses +6 dB: the 33 unflagged landings stay under at every margin. Hard
    entries 1 → 2 → 2 (margin changes the segmentation: 0371 gains one real join that flags;
    164 → 170 → 172 joins checked). Extra sweeps: `softMargin` 6 → 12 on tight → 265 → 269;
    natural base margin 6 → 12 → 18 → 106 → 132 → 132 (a `softMargin 9` run left no JSON — not
    rerun). **Not the "rises monotonically" the brief expects — see Open problems.**
  - **Audition (decision 3), 0373's card:** `List the spots (85)` → 20 rows + `Show all 85`; row 1
    `hard entry 5:23.2 +17.7 dB` maps (fiber `spot.time`) to result time 654.728 = the join; tails
    follow by dB (23.0, 20.1, 18.5, 17.3, 15.9 …). Clicking row 1 (`B3/audition.json`, playhead text
    sampled every ~120 ms, ORIGINAL-timeline coordinates while previewing): 784.33 at 123 ms →
    785.12 at 970 ms → **787.37 at 1386 ms (the removed 2.0 s skipped — cuts applied)** → 788.32
    at 2361 ms, stopped; then the playhead reads 655.44 (preview restored off). Join edges on the
    original timeline: left 785.539, right 787.544 → it played from 1.21 s before the join to
    0.78 s after (≈ 2 s, centred ~0.2 s early — see Open problems).
  - Stills (`C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\stills\`): `b3-card-<tag>-0373.png` for
    every run, `b3-spots-open.png`, `b3-spot-auditioning.png`. The isolated window minimized itself
    repeatedly: `B3/restore.ps1` (ShowWindow on the electron.exe whose command line has
    `--remote-debugging-port=9291`) before each batch.
  - Scratch state left: B2-root's `project.json` = nine clips on V1, no `cutStyle`, no `presetId`,
    proposals rejected; `cache/cut-plans/` gained the per-style plan files. App stopped.

## Verified (exact commands + outputs)

- `npx vitest run src/shared/studio/cut-qa.test.ts` → `Test Files 1 passed (1) · Tests 11 passed (11)`.
- `python -I -B .vidtsx-temp/end-to-end/B3/analyze_cut_ref.py` (1.2 s; log
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\analyze-cut-ref.log`) → per clip `0369: segs 6 joins 5
  hard 0 atoms 6 clipped 5` … `0376: segs 29 joins 21 hard 0 atoms 30 clipped 27`, `TOTAL hard
  entries 0 · clipped tails 181`. Editor repo untouched: `tools/__pycache__` listing (names +
  mtimes) diffed identical before/after.
- `$env:B3_COMPARE='1'; npx vitest run --config .vidtsx-temp/end-to-end/B3/vitest.b3.config.ts
  compare` → 1 passed; summary `{"refHard":0,"studioHard":0,"refTails":181,"studioTails":178,
  "tailsBoth":178,"tailsRefOnly":3,"tailsStudioOnly":0}`.
- `npm run check:types` → `web: 26 errors (baseline 26) ok`, `node: 10 errors (baseline 10) ok`.
- Disk at hand-off: C: 19 GB free, D: 2.1 GB free.
- **Step 2 (`47bc6a1`):** `npx vitest run src/main/services/studio/agent-tools/cut-tools.test.ts
  src/main/services/studio/agent-tools/run-auto-cut.test.ts
  src/main/services/studio/cut-plan-runner.test.ts src/main/services/studio/editorial-cuts.test.ts
  src/features/studio/services/cut-proposal.test.ts src/shared/studio/cut-qa.test.ts` →
  `Test Files 6 passed (6) · Tests 49 passed (49)`. `npx vitest run src/shared/studio
  src/main/services/studio src/features/studio` → 171 files passed, 1 failed =
  `shot-module-resolver.test.ts` "a changed transpiler fingerprint…" (DRIVING.md's known load
  timeout; alone → `10 passed (10)`). `npm run check:types` → `tsconfig.web.check.json: 26 errors
  (baseline 26) ok` · `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
  Full `npx vitest run` (log `C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\vitest-step2-run1.log`)
  → `Test Files 2 failed | 448 passed | 5 skipped (455)`, `Tests 3 failed | 3804 passed`:
  `shot-module-resolver.test.ts` (load flake, green alone) and 2 × `python-models/service.test.ts`
  with **`ENOSPC: no space left on device, ftruncate`** at `service.test.ts:77` (it seeds a
  1.68 GB model file in %TEMP% on C:, which had 1.5 GB free) — environmental, unrelated to B3;
  it fails alone for the same reason. This run does NOT count as the part's gate: rerun the full
  suite when C: has > ~3 GB free.
- Disk at step-2 hand-off: **C: 1.5 GB free, D: 1.6 GB free** (C: fell from 19 GB in ~1 h; B3's
  own C: folder is 85 KB — other sessions).
- **Step 3 (`99d825d`, code only):** `Get-PSDrive C,D` before the run → C: 1.98 GB, D: 1.43 GB.
  `npx vitest run src/features/studio/services/cut-proposal-qa.test.ts
  src/features/studio/components/CutQaReadout.test.ts src/features/studio/services/cut-proposal.test.ts`
  → `Test Files 3 passed (3) · Tests 32 passed (32)`. `npm run check:types` →
  `tsconfig.web.check.json: 26 errors (baseline 26) ok` · `tsconfig.node.check.json: 10 errors
  (baseline 10) ok`; `npx tsc -p tsconfig.web.check.json --noEmit` → 26 `error TS`, 0 of them in
  CutQa* / cut-proposal / ReviewCutsSection / EditorShell. No app launch, no full vitest (override).
- **Step 4 (live, builder #4, 2026-10-22 ~15:30–15:55):** `Get-PSDrive C,D` before launch → C:
  1.97 GB, D: 1.37 GB; no electron running, ports 9222/5173/9291 free. `bash
  .vidtsx-temp/end-to-end/B3/launch.sh` (background) → `node drive.mjs ready` → root
  `B2-root`, nine clips on V1. `node drive.mjs run m12-default none` → `TOTALS
  {"hardEntries":1,"joinsChecked":164,"clippedTails":265,"atomsChecked":298,"cardHard":1,"cardTails":265}`;
  `run m18 '{"margin":18}'` → `{2,170,265,298,2,265}`; `run m24 '{"margin":24}'` →
  `{2,172,265,298,2,265}`; `run neg-natural-head0 '{"base":"natural","head":0}'` →
  `{121,162,97,298,121,97}`; `run sm12 '{"softMargin":12}'` → `{1,164,269,298}`; `run nat-m6
  '{"base":"natural"}'` → `{2,151,106,298}`; `nat-m12` → `{2,151,132,298}`; `nat-m18` →
  `{2,151,132,298}`; `run m12-default-rerun none` → `{1,164,265,298,1,265}`. `node drive.mjs
  audition daf5a84e-…` → samples as in Done. Mean tail dB per style from the plan files: tight m12
  11.45 · m18 14.51 · m24 16.23 · sm12 11.44; natural m6 12.97 · m12 12.55 · m18 13.17. Stopped:
  `taskkill /T /F` on the roots of the processes whose command line has
  `--remote-debugging-port=9291` or the B2 profile path → 0 left; launch task exited 0. Disk after:
  C: 1.84 GB, D: 1.26 GB. No vitest/types run in this session (no code changed).

## Next step (ONE concrete instruction)

**Builder #5 (after the orchestrator rules on exit (c) — Open problems, first item):** run the
gate and write the docs: `Get-PSDrive C,D` (stop under 1.0 GB), then `npx vitest run --exclude
src/main/services/python-models/service.test.ts` logged to
`C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\vitest-full-run1.log` (DRIVING.md "Vitest gate while C:
is low" + "under load"), `npm run check:types`, then the `### 18.9 B3` block in
`docs/studio/TESTING.md` and the STATUS row in `Status.md` with step 4's measured numbers (and the
two caveats under Open problems), commit, B3 DONE. If the orchestrator wants a different (c)
measurement (e.g. `softMargin`, or (c) restated as "count non-decreasing, landings louder"), the
app run is cheap: relaunch with `B3/launch.sh`, `node drive.mjs ready`, `node drive.mjs run <tag>
'<spec>'` (~8 s for all nine clips), stop by the 9291 flag.

**(Superseded — done by builder #4) Orchestrator override (2026-10-22 15:40 — go, without new copies):** C: 1.98 GB, D: 1.37 GB.
Do the live exits WITHOUT new copies: Studio root = the existing scratch
`C:\Users\hasan\AppData\Local\vidtsx-e2e\B2-root` (full M2 copy: 9 clips, proxies, v3 waveforms,
transcripts; its `project.json` has `presetId: youtube-long-form` + `cutStyle {base:tight}` from
B2 — remove both first so the default tight applies; it is scratch, no backup needed) and profile
`C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\B2\profile` (CDP 9291). Then the full gate per
DRIVING.md "Vitest gate while C: is low" (`--exclude src/main/services/python-models/service.test.ts`).
Stop lines 1.0 GB on BOTH drives: check before the launch and before the full test run. Stills
and logs small, under `C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\`. The rest of the paragraph
below still applies except its copy/space conditions.

**WAITS FOR DISK (orchestrator's call):** all B3 code is built (steps 1–3); what remains needs
the app, the M2 copy (~580 MB) + the B3 profile copy (~377 MB) on C:, and a full vitest run
(> ~1.7 GB free on C: for `python-models/service.test.ts`). Start only when the orchestrator says
there is room (C: ≥ ~3 GB, D: ≥ 1.0 GB); check `Get-PSDrive C,D` before every launch/test run.

When there is room, do the live part in ONE session: copy M2 into
`C:\Users\hasan\AppData\Local\vidtsx-e2e\B3-root\projects\` and the source profile to
`…\profiles\B3\profile` (CDP 9291, `studioRootSet` to `…\B3-root` first), open the copy, put every
speech clip on V1 through Auto Cut with the default style and read the card through the DOM
hooks (`[data-cut-qa-hard]`, `[data-cut-qa-tails]`, `[data-cut-qa-toggle]`,
`[data-cut-qa-spot]`) → **exit (b)**: hard entries 0 (or each listed spot explained by the
waveform), click one spot and confirm the playhead lands ~1 s before its mapped time with the
result preview on and stops ~2 s later; **exit (c)**: raise `margin` 12 → 18 → 24 through
Project settings' cut knobs (`settings.cutStyle`), re-run Auto Cut each time, record the tail
counts (must rise monotonically), plus the negative (`base natural`, `head 0`, `maxHead` off →
hard entries > 0); stills to `C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\`. Then stop your
instance (match `--remote-debugging-port=9291`, never the bare digits), run the full
`npx vitest run` gate (DRIVING.md "Vitest gate under load", log to the C: folder), `npm run
check:types`, write the `### 18.9 B3` block in `docs/studio/TESTING.md` (after `### 18.8 B2`,
shape of §17/§18.8, the DECIDED wording) and the STATUS row (`Status.md`), and hand off with B3 DONE.

## Open problems

- **ORCHESTRATOR CALL — exit (c) as worded is not what M2 shows (builder #4, 2026-10-22).**
  Raising `margin` 12 → 18 → 24 on tight leaves the tail COUNT at 265 / 265 / 265 (every clip
  identical) while each flagged landing gets louder (mean +11.45 → +14.51 → +16.23 dB). Reason
  from the numbers: at tight's margin 12, 265 of 298 landings already sit above analyze_cut's
  +6 dB line; the other 33 stay under at every margin (they land in quiet: gap-clamped or soft
  word ends), so a higher margin can only make flagged landings louder, not flag new ones. The
  count is monotone non-decreasing (flat), not rising. `softMargin` 6 → 12 moves it 265 → 269;
  natural's margin 6 → 12 → 18 moves it 106 → 132 → 132. Options: (1) accept (c) as "count never
  falls and the landings measurably move toward the release as margin rises" (record the mean
  dB); (2) restate (c) on a knob/base where the count moves (natural margin 6 → 12, or tight
  `softMargin`); (3) add the mean/worst landing level to the card (a code change — the card
  currently shows counts only). The QA logic matched analyze_cut on Hasan's keeps (exit (a)), so
  this is the 6 dB rule's saturation on tight, not a bug. Builder #4 did not pick one.
- **Audition lands ~0.2 s early (step 4, small, not blocking).** The playhead text (original
  coordinates while the result preview is on) read 784.33 → 788.32 for a span whose join edges
  are 785.539 / 787.544 (expected 784.54 → 788.54): ~1.2 s before and ~0.8 s after the join
  instead of 1.0 / 1.0. Not root-caused: either `mapQaItemToTimeline`'s result timeline and the
  Player's preview timeline differ by ~0.2 s on 0373 (an earlier cut's edges?), or the time read-out
  maps result → original with an offset. A verifier should read the Player's frame through the
  fiber (masks kit `current-player.js`) instead of the text. Also: after the stop the preview is
  restored OFF and the playhead then reads 655.44 — the result-timeline position kept as an
  original-timeline time (a different place in 0373). `handlePlayJoin` uses the same
  `playSpan(…, restorePreview)` path, so that part is pre-existing behaviour, not B3's.
- **Multi-clip card rows (step 4 confirms the cosmetic note below):** 0373's rows show source
  `M:SS.d` only; on a single-asset Auto Cut card that is unambiguous (Auto Cut runs per asset).
- Note for the card wording (decision 3): with Hasan's fitted tight (`margin 12`)
  almost every atom is a "clipped tail" by analyze_cut's 6 dB rule (181 of 200 atoms on video-14,
  and his own report says the same), so the tail count reads as "how many landings ride the
  release", not as errors. Exit (c) relies on exactly this (count rises with `margin`).
  **DECIDED (orchestrator, 2026-10-22):** the card shows the two checks with different weight and
  always with a denominator: **"Hard entries 0 of 37 joins"** (an error class: red/accent when
  > 0) and **"Tails on a release 178 of 200 landings"** (informational, neutral tone; tooltip:
  "the landing is still more than 6 dB over the room tone — soft landing; listen if it sounds
  cut"; analyze_cut calls them "clipped-tail risks"). "QA clean" only when hard entries = 0 AND
  tails = 0. The expandable list puts hard entries first, then tails sorted by dB over floor
  (highest first, cap the visible list at ~20 with "show all"). Each item auditionable as
  decision 3 says. Use the same wording on the editorial card and in STATUS/TESTING.
  (Step 2 put these strings in `cut-qa.ts` — `formatHardEntries` / `formatReleaseTails` /
  `formatCutQaLine` — reuse them; don't retype the wording in the component.)
- **The card's counts are the plan's, not live (step 3, not blocking — say so in TESTING §18.9).**
  `proposal.qa` is computed once when the plan/proposal is made; rejecting a cut or dragging its
  edges does NOT recompute the counts (no envelope in the renderer). The spots still map through
  the CURRENT result timeline, so a click plays what the user will hear now (a spot whose cut was
  rejected plays in place; one swallowed by a widened cut plays at that cut's join). Live
  recompute would need the waveform envelope in the renderer — a later part's call, not B3's.
- **List rows show per-clip SOURCE times (step 3, cosmetic).** A multi-clip Auto Cut card can list
  two spots with the same `M:SS.d` from different clips; the row has no clip name (the component
  has no asset list). The click maps through `assetId`, so the audition is right. Add the clip
  label only if the live run shows it confuses.
- `EditorShell.tsx` is 1,645 lines (pre-existing, far over the ~300 rule); step 3 added one
  13-line handler there because the audition state (`playSpan`, `previewResult`) lives there.
- **RESOLVED in step 3 (`mapQaItemToTimeline`): editorial tails can land inside a removed span.**
  analyze_cut's tail check reads `e + tailFor(e, gap to the next ATOM)` and knows nothing about
  cut spans; Studio's `planClip` additionally clamps a real tail at the next cut's start. Faithful
  to analyze_cut (exit (a) matched with exactly this), but on an editorial card a tail item's
  `sourceTime` can sit inside the span being removed (`cut-tools.test.ts` "a cut to the end"
  shows it: landing > the cut's `sourceStart`). Auto Cut has no cut spans, so its landing = the
  segment end. The audition mapper should clamp such a time to the kept edge (the join) so the
  click plays what the user will hear.
- **Disk is the next risk (for the orchestrator).** At 15:05: C: 1.5 GB free (19 GB an hour
  earlier — other sessions), D: 1.6 GB. The live exits (b)/(c) need a C: copy of M2 (580 MB, all
  of it `cache/` — proxies + waveforms) plus the B3 profile copy (377 MB) ≈ 0.96 GB, leaving
  ~0.5 GB on C:. The full vitest gate also needs > ~1.7 GB free on C: (`python-models/
  service.test.ts` seeds a 1.68 GB file in %TEMP% → ENOSPC now). DONE parts' scratch on C:
  (`vidtsx-e2e\B2-root`, `B2-verify*`, `B1-verify-root`, profiles) is the orchestrator's/Hasan's
  call to free; this builder deleted nothing.

## Do-not-redo

- B1 and B2 are DONE — do not re-port the snapper, re-measure the cutlib joins, or change the
  resolver/precedence. Track A is DONE. Do not touch `main`. The editor repo is READ-ONLY
  (Python on it `-I -B`; never run a tool's `main` that writes into it).
- B3 step 1 is DONE (`e583d26`): do not rewrite `cut-qa.ts` or re-run exit (a) unless the QA
  logic changes — rerun the two scratch commands under "Verified" only to re-check after a change.
- B3 step 2 is DONE (`47bc6a1`): QA is on `StudioCutPlan.qa` (runner), `SnapCutSpansResult.qa`
  (editorial snapper) and `StudioProposal.qa` (both builders, items stamped with `assetId`); the
  agent replies end with the QA line. Do not move it into `planCuts` or add an IPC field — the
  toolbar Auto Cut already gets it through the plan it receives.
- B3 step 3 is DONE (`99d825d`): `CutQaReadout` + `CutQaSpotRow`, `mapQaItemToTimeline` /
  `buildQaSpots` / `formatCutTc` in the renderer's `cut-proposal.ts`, `onPlayQaSpot` →
  `handlePlayQaSpot` in EditorShell, 18 new tests. Do not rebuild the card; the live run only
  reads it (fix only what the live run proves wrong).
- B3 step 4 live run is DONE (builder #4): exit (b) (1 of 164, explained), the negative (121 of
  162), margin 12/18/24 (265 flat), softMargin/natural sweeps and the spot audition are measured —
  do not re-run them unless the orchestrator restates (c) or code changes. Do not copy M2 or a
  profile again: B2-root + `profiles\B2\profile` are the reused scratch.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-22 · builder #1 · ~27 calls · step 1: `cut-qa.ts` + 11 tests (`e583d26`), analyze_cut
  reference script + gated compare → exit (a) measured (0/0 hard entries, 181 vs 178 tails, 3
  deltas explained).
- 2026-10-22 · builder #2 · ~37 calls · step 2: QA on plans (runner), editorial snapper and both
  proposal kinds + wording helpers + agent reply line (`47bc6a1`); new real-handler test for
  `propose_cuts`; types 26/10; full vitest red only on a load flake + ENOSPC (C: 1.5 GB free).
- 2026-10-22 · builder #3 · ~30 calls · step 3 (code only, disk override): the card readout +
  audition mapper + EditorShell handler (`99d825d`); 3 targeted files 32/32, types 26/10.
- 2026-10-22 · builder #4 · ~44 calls · step 4 live on the reused B2-root/B2 profile (CDP 9291):
  exit (b) 1 hard entry of 164 joins (0373, an untranscribed sound in a span Hasan cut as a
  retake), negative 121/162, margin 12/18/24 → tails 265 flat (landings +11.45/+14.51/+16.23 dB),
  audition plays across the join (~0.2 s early); exit (c) wording raised to the orchestrator.

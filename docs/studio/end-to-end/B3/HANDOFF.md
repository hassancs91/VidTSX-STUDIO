# B3 — QA readouts on the cards: hard entries and clipped tails, offending joins listed and auditionable
status: IN PROGRESS (step 1 of the exit done: pure QA module + exit (a) measured)

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

## Next step (ONE concrete instruction)

Wire the QA into main (decision 2) and through to the proposal: in
`src/main/services/studio/cut-plan-runner.ts` `runCutPlan` (:63-103) attach `plan.qa = runCutQa({
segments: plan.segments, atoms: splitAtoms(keeps ?? [{start:0,end:duration}], words sorted,
plan.style.internalGap), style: plan.style, envelope })` (consider a small `qaForPlan` helper in
`cut-qa.ts` so the runner stays thin); in the editorial path (`editorial-cuts.ts`
`snapEditorialCuts` → `cut-snap.ts` `snapCutSpans`, which plans with `internalGap: +Infinity` at
:166-169) compute the same report from ITS segments/keeps/style; then carry the report onto the
proposal (`buildCutProposal`, `cut-proposal.ts:68-117`, and `buildEditorialProposal`) as an
optional field with each item's `assetId`/`clipId` and `timelineTime` mapped from the clip's
placement — with handler-level unit tests (Auto Cut plan-run handler; the real cut-tool handler on
a fixture, no LLM — decision 4) and an old-proposal-without-qa test; then hand off.

## Open problems

- None blocking. Note for the card wording (decision 3): with Hasan's fitted tight (`margin 12`)
  almost every atom is a "clipped tail" by analyze_cut's 6 dB rule (181 of 200 atoms on video-14,
  and his own report says the same), so the tail count reads as "how many landings ride the
  release", not as errors. Exit (c) relies on exactly this (count rises with `margin`).

## Do-not-redo

- B1 and B2 are DONE — do not re-port the snapper, re-measure the cutlib joins, or change the
  resolver/precedence. Track A is DONE. Do not touch `main`. The editor repo is READ-ONLY
  (Python on it `-I -B`; never run a tool's `main` that writes into it).
- B3 step 1 is DONE (`e583d26`): do not rewrite `cut-qa.ts` or re-run exit (a) unless the QA
  logic changes — rerun the two scratch commands under "Verified" only to re-check after a change.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-22 · builder #1 · ~27 calls · step 1: `cut-qa.ts` + 11 tests (`e583d26`), analyze_cut
  reference script + gated compare → exit (a) measured (0/0 hard entries, 181 vs 178 tails, 3
  deltas explained).

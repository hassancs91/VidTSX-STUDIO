# B3 — QA readouts on the cards: hard entries and clipped tails, offending joins listed and auditionable
status: NEW

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

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Write the pure `src/shared/studio/cut-qa.ts` (decision 1) with its unit tests, and the scratch
reference: a `python -I -B` script under `.vidtsx-temp/end-to-end/B3/` that imports
`analyze_cut.entry_check` + `cutlib` and recomputes hard entries and clipped tails per clip for
the fitted tight on cuts.json's keeps (outputs to `C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\`),
then a gated scratch vitest that runs `cut-qa.ts` on the same plans from M2's data and reports
per-clip deltas — then hand off.

## Open problems

(none yet)

## Do-not-redo

- B1 and B2 are DONE — do not re-port the snapper, re-measure the cutlib joins, or change the
  resolver/precedence. Track A is DONE. Do not touch `main`. The editor repo is READ-ONLY
  (Python on it `-I -B`; never run a tool's `main` that writes into it).

## Agents so far (date · approx tool calls · what they covered)

(none yet)

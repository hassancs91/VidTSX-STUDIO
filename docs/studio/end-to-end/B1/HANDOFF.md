# B1 — ZCR in the waveform job; snapHead, fricative-aware snapTail, minSkip; the four knobs
status: NEW

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety rules, launcher, repo facts,
every "Learned" line) and the **"Track B decisions"** section at the end of
`docs/studio/end-to-end/ORCHESTRATOR.md` (M2 location, transcripts, profile, Hasan-dependent parts).

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **B1** | Waveform job emits `zcr` per bucket (cache v2); `RmsEnvelope.zcr()`, `snapHead`, fricative-aware `snapTail`, `minSkip` merge; `CutPlanStyle` + the four knobs; unit tests mirror cutlib's cases | on video-14 clip 1 the plan's joins reproduce cutlib's within ±20 ms for the same style |

Session gates (plan §3 head): `npx vitest run` green, `npm run check:types` at or below
baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the STATUS.md row,
the TESTING.md §18 block (`### 18.7 B1`, under the existing `## 18`). Schema additions optional
only; old projects must open untouched (an old waveform cache must still load — regenerate or
read without `zcr`).

**Never hand back while a job you started (proxies, waveforms, a render) is still running — wait
for it inside your own session.**

## Plan context (§1.x facts, §2 decision, §5 items to read)

**Read plan §1.1 in full (:52-104).** The essentials: `CutPlanStyle` has eight fields
(`src/shared/types/studio-cut-plan.ts:15-29`); `tight`/`natural` are code constants
(`src/shared/studio/cut-planner.ts:36-52` — tight head 0.11 / minTail 0.14 / maxTail 0.4 / margin
5 / softGap 1.2 / softMaxTail 0.6 / softMargin 3; natural head 0.19 / minTail 0.26 / maxTail 0.45),
the reference repo's PRE-October values. `snapTail` (:120-126) steps 0.02 s from `minTail` and stops
at the first window ≤ floor + margin; **no `snapHead`, no ZCR, no `maxHead`, no `minSkip`**; lead-in
is the fixed `head` (`planClip` :204-205); the envelope reads the waveform cache's per-bucket dB
(:83-127), never samples. Hasan's fitted tight (cuts.json `styles.tight`): `internal_gap 0.4,
min_tail 0.08, max_tail 0.7, head 0.15, max_head 0.3, min_skip 0.12, margin 12.0, soft_gap 99.0,
soft_max_tail 0.6, soft_margin 6.0, fric_zcr 3500, fric_margin 5.0`; natural `min_tail 0.26,
max_tail 0.45, head 0.21, margin 6.0, soft_gap 1.2, soft_max_tail 0.7, soft_margin 3.0`. The
October knobs' exact semantics are in `tools/cutlib.py` (`zcr` :77-86, `snap_tail` :88-109,
`snap_head` :111-127, `min_skip` merge :213-222) — plan §1.1 :82-93 summarises them.

**§2 T1 (the B1 slice):** "port `maxHead`, `minSkip`, `fricZcr`, `fricMargin` with cutlib's exact
semantics, a `snapHead`, the `minSkip` merge … ZCR needs samples the dB-bucket envelope does not
have: the waveform job emits a `zcr` array on the same bucket grid (one more number per bucket,
cache version bump, waveforms regenerate — cheap)." B2 (not B1) moves the default style values,
`resolveCutStyle`, the four consumers and the UI — B1 adds the knobs and the DSP.

**§5:** "ZCR needs samples … the cache format changes and every waveform regenerates on first open."

**Orchestrator findings (2026-10-22, read-only) — two traps:**
1. **Sample rate.** `src/main/services/studio/waveform-generator.ts` decodes **mono 8 kHz**
   (`SAMPLE_RATE = 8000` at :10, the comment at :52). cutlib reads **16 kHz** mono WAVs
   (`work/audio/<clip>.wav`; `AudioProbe._load` :40-48, `rms_db` 50 ms forward window :50-60,
   `zcr` 30 ms window :77-86). Fricative energy is 4–12 kHz — above 8 kHz audio's 4 kHz Nyquist —
   so a ZCR computed at 8 kHz cannot reproduce cutlib's `fric_zcr 3500` (zero crossings per
   second) semantics. Compute the ZCR from 16 kHz samples (decode at 16 kHz for the whole job, or a
   second stream) and record which; check the RMS stays comparable.
2. **Cache version.** The waveform file is ALREADY `version: 2` (`waveform-generator.ts:139`,
   `{version: 2, peaksPerSecond, peaks, rmsDb}`). Adding `zcr` makes it **version 3** (the plan's
   "cache v2" predates rmsDb's bump). Old v2 files must still load (no zcr → the fricative rule is
   off for that asset, or regenerate).

**"video-14 clip 1":** `cuts.json` clip `0366` (the first raw clip) is cut ENTIRELY (keeps `[]`:
three aborted cold opens) — it has no joins. Use the first clip that has joins (`0369`, 44 words)
as "clip 1" and say so in STATUS; also run the comparison on every clip with keeps if cheap (a
broader number is better evidence).

**The comparison (exit):** same inputs on both sides — the keeps from `cuts.json`, the words from
Hasan's transcripts (`…\videos\video-14\work\transcripts\<clip>.json`, AssemblyAI), the same
style (Hasan's fitted tight) — run cutlib's planner (`tools/cutlib.py` `plan_clip` :174; find the
CLI/driver in `tools/`, e.g. `cutout.py`) READ-ONLY from a script in your scratch with outputs
only under `.vidtsx-temp/end-to-end/B1/`, and Studio's planner on the waveform data Studio's own
job produces for the raw clip. Report every join's start/end delta; exit = all within ±20 ms (or
explain each outlier with the waveform at that point).

**M2 setup (step 1 of this part — the shared material for track B):** create the Studio project
`video-14-raw` from the nine DJI clips (`D:\repos\claude-youtube-editor\videos\video-14\raw\
*.MP4`, 12.4 GB, referenced in place, read-only) in the scratch root
`C:\Users\hasan\AppData\Local\vidtsx-e2e\b-root` (ORCHESTRATOR "Track B decisions"); profile = a
copy of `.vidtsx-temp/end-to-end/A5/profile` at `.vidtsx-temp/end-to-end/B1/profile` (D: had
3.9 GB free — the profile is 377 MB; proxies/caches go to the C: root). Import through the media
pool (`VIDTSX_MEDIA_PICK=<p1;p2;…>`) or `studioProjectCreate` + IPC; proxies should build on NVENC
(A4 default). Then put Hasan's AssemblyAI transcripts into M2's transcript cache through Studio's
OWN AssemblyAI mapping (find the provider's response→transcript mapper under
`src/main/services/**/transcription-engine/providers/`), via a small script — no STT call, no
download, $0. Record clip ids ↔ asset ids. Never write next to the raw clips.

## Done (file:line, commit hashes)

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Read `cut-planner.ts`, `studio-cut-plan.ts`, `waveform-generator.ts` and `tools/cutlib.py` (236
lines) in full, then write the pure DSP ports (`zcr`, `snapHead`, fricative-aware `snapTail`,
`minSkip` merge) with unit tests that mirror cutlib's cases. (M2 setup must be done before the exit
comparison; order it after the pure code.)

## Open problems

(none yet)

## Do-not-redo

- Track A is DONE (A1–A6 + track exit PASS). Do not touch `main`. The editor repo
  `D:\repos\claude-youtube-editor` is READ-ONLY.

## Agents so far (date · approx tool calls · what they covered)

(none yet)

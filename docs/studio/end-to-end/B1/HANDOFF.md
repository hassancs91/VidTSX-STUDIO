# B1 — ZCR in the waveform job; snapHead, fricative-aware snapTail, minSkip; the four knobs
status: IN PROGRESS (step A pure code + waveform job done, `2dc5add`; next: M2 setup)

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

**Step A — pure DSP ports + waveform job v3, commit `2dc5add`** (agent 1, 2026-10-22):
- `src/shared/types/studio-cut-plan.ts:30-53` — `CutPlanStyle` gains OPTIONAL `maxHead`,
  `minSkip`, `fricZcr`, `fricMargin` (absent = old behaviour, cutlib's "opt-in style keys").
  `TIGHT_STYLE` / `NATURAL_STYLE` unchanged (B2 moves the defaults).
- `src/shared/studio/rms-envelope.ts` (new, 157 lines) — `RmsEnvelope` moved out of
  `cut-planner.ts` (re-exported there, `cut-planner.ts:22-25`, so every importer is unchanged).
  Ctor takes an optional 3rd arg `zcrBuckets`. `rmsDb` (:43) and `zcr` (:54) are
  **overlap-weighted** over the 20 ms buckets (`windowMean` :133) — cutlib measures exact sample
  windows; the old floor-to-bucket window read up to one bucket early. `floorDb` (:60) = 10th
  percentile of **50 ms windows** (cutlib `floor_db`; was the 10th pct of 20 ms buckets).
  `snapTail` (:82) = cutlib `snap_tail` incl. the fricative rule; `snapHead` (:109) = cutlib
  `snap_head` (same float arithmetic: `o += 0.02`, `t -= 0.01`). `hasZcr()`; no zcr ⇒ `zcr()` = 0
  ⇒ the fricative rule is off (v2 caches).
- `src/shared/studio/cut-planner.ts` — `tailFor` passes `fricZcr/fricMargin` (:121-130);
  `planClip` snaps the lead-in with `snapHead` when `maxHead` (:166-178); merge at :194 when
  `minSkip || maxHead` (cutlib :213-222); `styleForFeatures` widens `maxHead` with `head` (:76).
  285 lines.
- `src/shared/studio/cut-skip-merge.ts` (new) — `mergeShortSkips(segments, minSkip, cuts)`
  (cutlib's merge; the merged segment keeps the first start/speechStart, the later end/landing).
- `src/main/services/studio/waveform-buckets.ts` (new) — pure `WaveformBucketizer`: peaks,
  rmsDb (0.1 dB) and `zcr` per bucket (crossings × sr / samples, cutlib's sign rule `x < 0`; a
  crossing is counted in the bucket of the sample that completes it, carried across chunks).
- `src/main/services/studio/waveform-generator.ts` — decodes **mono 16 kHz** for the WHOLE job
  (was 8 kHz; RMS now from 16 kHz too, like cutlib's WAVs); writes `{version: 3,
  peaksPerSecond: 50, peaks, rmsDb, zcr}` (:130); `isWaveformStale(path)` (:54) reads the first
  64 bytes for `"version"` < 3 (unreadable ⇒ stale).
- `src/shared/types/studio-waveform.ts` — `WAVEFORM_SAMPLE_RATE = 16000`, `WAVEFORM_VERSION = 3`,
  `version: 1 | 2 | 3`, optional `zcr`.
- Old caches: `media-jobs.ts:94-99` treats a v1/v2 waveform as not ready → regenerates it once
  on open (plan §5); `cut-plan-runner.ts:47` regenerates before planning when version < 3 and
  passes `file.zcr`; `useAssetEnvelopes.ts` passes `zcr` when present. A v2 file still parses
  everywhere (the peaks reader is unchanged).
- New tests: `src/shared/studio/rms-envelope.test.ts` (13: weighted windows, 50 ms floor, zcr;
  "path" → "pa-": fricative tail 0.08 → 0.18; room tone at ZCR 1500 never qualifies; a hiss at ≤
  floor + fricMargin does not; v2 = the old snapper; "Every" 0.16 s early → lead-in 0.19; clean
  onset → head; capped at maxHead; a fricative onset only with fric_zcr),
  `src/shared/studio/cut-planner-knobs.test.ts` (11: max_head in planClip; "whyyy" 60 ms hole →
  merged at min_skip 0.12; a cut between blocks it; overlap merge at min_skip 0; TIGHT untouched;
  styleForFeatures), `src/main/services/studio/waveform-buckets.test.ts` (5: 1 kHz → 2 k and
  6 kHz → 12 k crossings/s; within 5 % of cutlib's verbatim zcr on voiced/fricative; −20 dB
  square; chunk-split invariance; `isWaveformStale` v1/v2/v3/missing).

## Verified (exact commands + outputs)

- `npx vitest run src/shared/studio src/main/services/studio/editorial-cuts.test.ts src/features/studio/services`
  → `Test Files 84 passed (84) · Tests 807 passed (807)` — the existing cut-planner / editorial /
  text-delete tests are unchanged and green with the weighted windows + 50 ms floor.
- `npx vitest run` (full, app not running) → `Test Files 439 passed | 5 skipped (444) · Tests
  3699 passed | 34 skipped (3733)`, exit 0 — log `.vidtsx-temp/end-to-end/B1/logs/vitest-full-step1.log`
  (run just before the `cut-skip-merge.ts` split; after it `npx vitest run src/shared/studio` →
  42 files / 428 tests green).
- `npm run check:types` (after the split) → `tsconfig.web.check.json: 26 errors (baseline 26) ok`
  · `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- NOT yet verified: the waveform job on real media (16 kHz decode time, v3 file size), the M2
  project, the cutlib comparison (the exit), the CDP click-through.

## Next step (ONE concrete instruction)

Do the M2 setup exactly as "M2 setup" above says: check free space on C: and D: and write the
numbers here; copy `.vidtsx-temp/end-to-end/A5/profile` to `.vidtsx-temp/end-to-end/B1/profile`;
launch an isolated instance on it (CDP port 9271, A1's `launch.sh` copied into `B1/`); set the
Studio root to `C:\Users\hasan\AppData\Local\vidtsx-e2e\b-root`; create `video-14-raw` and import
the nine DJI clips in place with `VIDTSX_MEDIA_PICK`; wait for proxies AND waveforms (confirm
every `cache/waveforms/*.json` starts `{"version":3` and has a `zcr` array; record each clip's
waveform job wall time — the 16 kHz decode is new); then map Hasan's AssemblyAI transcripts into
the project's transcript cache through Studio's own AssemblyAI mapper and record clip ids ↔ asset
ids here. (After M2: the cutlib comparison — a Python driver in `B1/` calling `cutlib.plan_clip`
read-only with `styles.tight` from cuts.json, and a gated live vitest reading M2's waveform +
transcript for Studio's side — then gates, CDP, STATUS/TESTING.)

## Open problems

- **Existing behaviour moved slightly (by design, toward cutlib):** every consumer of
  `RmsEnvelope` (Auto Cut, the editorial snap, Transcript deletes) now reads overlap-weighted
  windows and a 50 ms-window floor, and (after regeneration) 16 kHz levels. No existing test
  changed; say so in the STATUS row.
- **Every waveform of an old project regenerates on first open** (v2 → v3; plan §5 accepted
  it). On the video-14 copy that is 127 decodes at the media queue's 2-at-a-time. Not timed
  yet; the 16 kHz decode doubles the JS sample loop. Measure on M2's nine clips.
- **20 ms grid vs cutlib's exact windows:** `snapHead` walks 10 ms steps over 20 ms windows; the
  weighted model assumes uniform energy inside a bucket, so a ±1-step (10–20 ms) disagreement is
  possible at a sharp onset. The exit comparison will show whether joins stay within ±20 ms; if
  not, explain each outlier with the waveform there (a finer analysis grid would be a plan
  change — ask first).
- `media-jobs.ts` is 314 lines (310 before this part, already over ~300; +4 here).

## Do-not-redo

- Track A is DONE (A1–A6 + track exit PASS). Do not touch `main`. The editor repo
  `D:\repos\claude-youtube-editor` is READ-ONLY.
- Step A (pure DSP + waveform v3, `2dc5add`) is done and green: do not re-port `zcr` /
  `snapHead` / `snapTail` / the merge, and do not re-open the 8 vs 16 kHz question (16 kHz for
  the whole waveform job is decided and committed).

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-22 · agent 1 · ~46 calls · step A: pure DSP ports + 29 unit tests, waveform job v3
  (16 kHz + zcr), stale-cache regeneration; commit `2dc5add`.

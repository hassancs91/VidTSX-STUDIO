# B1 — ZCR in the waveform job; snapHead, fricative-aware snapTail, minSkip; the four knobs
status: DONE (step A `2dc5add` + step 1 M2 setup + step 2 cutlib comparison — exit MET on clip
0369 — + step 3 gates, CDP click-through, STATUS row and TESTING §18.7; awaiting the B1 verifier)

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

**Step 1 — M2 setup (agent 2, 2026-10-22; scratch only, no `src/` change):**
- Scratch kit in `.vidtsx-temp/end-to-end/B1/` (gitignored): `launch.sh` (port **9271**, profile
  `B1/profile` = copy of A5's, 372 MB; exports `VIDTSX_MEDIA_PICK` = the nine raw clips),
  `cdp.mjs` (A5's, port 9271), `m2.mjs create|state`, `wait.mjs install|wait`, `wavetime.mjs`,
  `vitest.b1.config.ts` (scratch vitest config — includes ONLY `B1/*.b1.test.ts`, never part of
  `npx vitest run`), `map-transcripts.b1.test.ts`.
- **M2 = project `video-14-raw`** at `C:\Users\hasan\AppData\Local\vidtsx-e2e\b-root\projects\video-14-raw`
  (root set with `studioRootSet`; created with `studioProjectCreate({name:'video-14-raw', width:
  3840, height: 2160, fps: 60})`; the nine clips imported through the Media Pool's "Import media
  files" button with `VIDTSX_MEDIA_PICK`, referenced in place). Timeline is EMPTY (V1/A1 only) —
  the clips are in the pool. Sources are 3840×2160 **@59.94** (project fps 60 — B parts that care
  should know).
- **Clip ↔ asset ids** (also `B1/logs/m2-transcripts.json`):
  `0366 b6ce244a-6cad-492d-9f39-11a89997a8a3` (20.3 s, 27 words) ·
  `0369 6290a63b-a14f-4933-9be6-a1974b63019d` (47.7 s, 44) ·
  `0370 904f9373-342a-4452-a406-6a2be25b0ffe` (84.0 s, 97) ·
  `0371 0c105962-9fc3-44aa-99e5-b3b56c24bf4f` (193.5 s, 207) ·
  `0372 e29f5e03-95c6-47f2-a22d-08be248a83c5` (118.9 s, 183) ·
  `0373 daf5a84e-da4d-408e-ae6c-bb23a37f7352` (396.2 s, 602) ·
  `0374 b798e8d8-116c-426f-aeea-90ca6ccee687` (32.0 s, 40) ·
  `0375 966e7377-29c0-4654-98d8-98b0ed5fc2f3` (207.7 s, 330) ·
  `0376 27c786f5-d86a-4b3a-b015-395e4a7842cc` (182.8 s, 290).
- **Proxies** (NVENC `nvenc-540p-intra`) + **waveforms v3** for all nine: import click ~08:16:50Z →
  all ready 08:26:08Z (~9 min 20 s, queue 2-at-a-time). Proxy job spans from the job events
  (`B1/logs/m2-job-events.json`): 0370 50.9 s · 0371 132.0 s · 0372 87.2 s · 0373 338.8 s · 0374
  31.0 s · 0375 203.8 s · 0376 118.7 s (0366/0369 started before the recorder).
- **Waveform job wall time ALONE** (`node wavetime.mjs <id> …`: set the file aside, prepare that one
  asset, wait for its event): **0369 (47.7 s) 0.1 s · 0373 (396.2 s) 0.7 s** (~570× realtime —
  the 16 kHz audio-only decode is cheap; the mov demuxer skips the discarded video packets).
  Regenerated files are byte-identical to the first run (deterministic); mtime fresh.
- Every `cache/waveforms/*.json` starts `{"version":3`, `peaksPerSecond 50`, `zcr.length ===
  rmsDb.length` (0369: 2383 buckets, 39,497 B; 0373: 19,813 buckets, 325,363 B).
- **Transcripts:** Hasan's nine saved AssemblyAI responses mapped through Studio's own
  `AssemblyAiProvider.mapJob` (private, called at runtime; no key, no upload, $0) into
  `cache/transcripts/<assetId>.json`, built exactly like `asset-transcriber.ts` step 5
  (`sttModelId 'assemblyai/universal'` = speech_models [universal-3-5-pro, universal-2],
  `engine 'assemblyai'`, verbatim true, `keytermCount 43`, no alias post-pass); each asset's
  `transcript` in `project.json` set `{path, status:'ready', hasWords, wordCount, features, …}`
  with the app STOPPED. Word counts equal the saved responses for all nine (27/44/97/207/183/602/
  40/330/290). M2 cache on C: = 579 MB.
- App stopped afterwards (tree of port 9271 only).

**Step 2 — the exit comparison (agent 3, 2026-10-22; scratch only, no `src/` change):**
- `.vidtsx-temp/end-to-end/B1/cutlib_joins.py` (run `python -I -B`; `sys.dont_write_bytecode`
  before `import cutlib`; `tools/__pycache__/cutlib.cpython-313.pyc` mtime stayed 2026-10-15
  19:17:22) — for every clip of `cuts.json`: `active_keeps`, `cuts`, `load_words` (only
  `work/transcripts/` exists, no `transcripts-u35`), `styles.tight`, `cutlib.plan_clip` → segs,
  plus per-atom `tail_for` / `snap_head` and full **waveform traces** at the exact points the
  snappers read (tail `[o, rms50, zcr30]`, head `[t, rms20, zcr20]`). WAVs = the editor's
  `work/audio/<clip>.wav` (all nine exist, read-only). → `B1/cutlib-joins.json` (1.19 MB, 4.8 s).
- `.vidtsx-temp/end-to-end/B1/compare.b1.test.ts` (scratch config, gated `B1_COMPARE=1`) — M2's
  v3 waveform + mapped transcript per asset (word counts asserted equal to cutlib's), Studio's
  `planClip` with Hasan's fitted tight as a `CutPlanStyle` (all four knobs set), the same keeps +
  cuts; segments paired by **overlap components** (a merge on one side only = a "merge flip");
  each atom's tail/head walk replayed at cutlib's trace points (first decision divergence,
  level over floor + zcr on both sides) → `B1/compare-report.json`.
- `.vidtsx-temp/end-to-end/B1/offset_check.py` (numpy, read-only, prints) — Studio's v3 buckets
  vs the WAV's 20 ms RMS at lags −80…+80 ms.
- **Result — clip 1 = `0369` (first clip with keeps; `0366` keeps `[]`): 6 segments both sides,
  12 joins, deltas start/end (ms) `0/0 · 0/0 · 0/0 · −10/0 · 0/0 · 0/+20` → all within ±20 ms. EXIT
  MET.** Floors: cutlib −54.473 / Studio −54.457 dB.
- **All eight clips with keeps:** 177 segments each side (0370 10/11, 0371 24/23 cancel out) →
  176 overlap components = **352 joins, 348 within ±20 ms (98.9 %)**, histogram `0:306 · ±10:9 · ±20:33 · 40:1 · 60:3`,
  plus **2 merge flips** (outer joins of both within ±20). 200 atoms: tail differs on 40 (max
  60 ms), snapped head on 19 (4 over 20 ms, max 150 ms — all four inside segments both sides
  merged, so no join moved). No soft/punchy flip. Floors within 0.16 dB on every clip.
- **Alignment / level check:** Studio's v3 buckets equal the WAV's 20 ms RMS **at lag 0** (mean
  |dB| 0.02–0.03 on 0369/0371/0373/0376; ±1 ms → 0.22–0.25) — the 16 kHz decode of the MP4 is
  sample-aligned with cutlib's WAVs. At the snappers' own points: 50 ms tail windows |Δ| median
  0.16 dB, p95 0.62, max 3.06 (2,222 points); 20 ms head windows median 0.49, **p95 11.42, max
  30.75 dB** (1,686 points; signed mean +1.67 — see Open problems).
- **Every outlier explained with the waveform (all TAIL knife-edges on the 20 ms grid; each is
  "first step where the two sides decide differently"; margin 12 dB, fric_zcr 3500, fric_margin 5):**
  | clip · atom (word end) | Δ join | what the window read (over floor) |
  |---|---|---|
  | 0371 · 20 (154.254) | end +40 | o=0.24: both +10.1 dB (fricative band 5–12); ZCR cutlib 3367 / Studio 3537 straddle 3500 → Studio keeps walking |
  | 0373 · 16 (63.066) | end +60 | o=0.44: cutlib +11.88 / Studio +12.37 dB straddle +12 |
  | 0373 · 17 (65.148) | end +60 | o=0.38: both +7.5 dB; ZCR 3426 / 3910 straddle 3500 |
  | 0376 · 26 (151.075) | end +60 | o=0.14: cutlib +11.68 / Studio +12.22 dB straddle +12 |
  | 0370 · 6 (60.527) — flip | end −20, Studio skips 60.747→60.887 (140 ms) | o=0.22: cutlib +10.94 dB with ZCR **exactly 3500** (≥ → fricative, walks on to 0.24) / Studio +11.8, ZCR 3147 → stops; cutlib's skip is then 60.887−60.767 = 0.11999… < `min_skip` 0.12 in float → merges |
  | 0371 · 4 (36.136) — flip | tail +60 → Studio merges 36.276→36.407 (131 ms) | o=0.14: cutlib +10.15 / Studio +12.24 dB (window starts 0.8 bucket in) → Studio walks to 0.20 → skip 0.071 < 0.12 → merge |
  The four large head divergences (absorbed by merges): 0372·4, 0375·28 (level 9.3/12.6 and
  11.8/12.6 straddle +12), 0375·20 (ZCR 3300/4010 straddle 3500), 0373·51 (cutlib +7.1, Studio
  +22.9: a 20 ms window 4 ms into a +35 dB bucket — the power-weighted onset smear).

**Step 3 — gates + click-through + write-up (agent 4, 2026-10-22; no `src/` change; docs commit
`cc9a327`):**
- Full gates green (commands under Verified). Click-through on M2, port 9271, `B1/profile`, driver
  `.vidtsx-temp/end-to-end/B1/click.mjs open|add|autocut` (CDP via `B1/cdp.mjs`):
  - Old-cache path: 0369's waveform (`cache/waveforms/6290a63b-….json`) set `"version":3` → `2`
    (sed, app stopped; backup `B1/backup/0369-waveform-v3.json`); opening `video-14-raw` rewrote it
    as v3 **211 ms after the project-card click** (`media-jobs.ts:94-99`), sha256 `24bd4e7b…`
    = the original v3 file (byte-identical), 2383 buckets, zcr 2383.
  - Pool tile `[data-media-tile=6290a63b-…]` → `contextmenu` → "Add to timeline" → V1 clip
    `clip_mvjax6ok_dn6vwy` (47.697667 s) in `project.json` within 1 s; tile click → Inspector
    "Transcript · DJI_20261015115741_0369_D.MP4" with "Re-transcribe" (transcript ready, no STT).
  - "Auto Cut" (Select default tight) → `cache/cut-plans/6290a63b-…-tight.json` written **21 ms**
    after the click: style = built-in `TIGHT_STYLE` (head 0.11, minTail 0.14, maxTail 0.4, margin 5,
    no knobs), 6 segments `[1.756,7.628] [12.63,17.263] [20.45,24.027] [24.238,25.768]
    [28.048,30.244] [39.891,41.084]`, stats kept 19.001 / removed 28.659 of 47.66 s, floor
    −54.457 dB; review panel "Auto Cut (tight) · assemblyai · −28.7 s of 47.7 s · noise floor −54 dB",
    "7 proposed", buttons "Apply 7 cuts" / "Reject all". Copy kept at `B1/inapp-plan-0369-tight.json`;
    `B1/inapp.b1.test.ts` (`B1_INAPP=1`, scratch config) = the in-app plan equals the pure
    `planCuts` on the same M2 files (createdAt aside).
  - Stills: `B1/stills/step3-1-open.png`, `step3-2-added.png`, `step3-3-autocut-review.png`.
  - **M2 restored** (app stopped): `project.json` copied back from `B1/backup/project.json.pre-step3`
    (`cmp` identical; the post-run copy with the clip + 7 proposals kept as
    `backup/project.json.post-step3`), `cache/cut-plans/` removed. Left in M2 by the run (harmless):
    `cache/poster.jpg` and the on-open snapshot `snapshots/project.2026-10-22T08-50-41-569Z.json`
    (= the pre-run project). Tree lists `B1/backup/tree-{pre,post}-step3.txt`.
- Written: the STATUS row (`Status.md` top, "END-TO-END B1 … — DONE") and TESTING.md `### 18.7 B1`.

## Verified (exact commands + outputs)

- **Step 3** (from the repo root, no app running): `npx vitest run > B1/logs/vitest-full-step3.log`
  → `Test Files 4 failed | 435 passed | 5 skipped (444) · Tests 4 failed | 3695 passed` — all four
  5000 ms timeouts in zip-package suites (`agent-package`, `agent-store`, `flow-package`,
  `pack-package`); those four alone → `4 passed · 61 passed` (2.7 s). Rerun `…step3b.log` → `1
  failed | 438 passed` — `flow-render.test.ts:255` `vi.waitFor` (1 s) "expected 0 to be greater
  than 0"; alone → `5 passed`. Rerun `…step3c.log` → **`Test Files 439 passed | 5 skipped (444) ·
  Tests 3699 passed | 34 skipped (3733) · Duration 36.47s`, exit 0.** `npm run check:types` →
  `tsconfig.web.check.json: 26 errors (baseline 26) ok` · `tsconfig.node.check.json: 10 errors
  (baseline 10) ok`. Click-through: `B1_LOG=app-step3.log bash launch.sh` (background) → `node
  click.mjs open` → `wave before open {"version":2,…` · `editor up` · `wave after open
  {"version":3,… ms after card click 210.97 bytes 39497 buckets 2383 zcr 2383`; `node click.mjs add`
  → `menu items ["Transcribe","Add to timeline","Remove from project"]` · `clips on disk
  [{"track":"v1","id":"clip_mvjax6ok_dn6vwy","duration":47.697667}]` · `transcript label [
  'Transcript · DJI_20261015115741_0369_D.MP4' ]`; `node click.mjs autocut` → `plan written ms after
  click 20.8` · `segments 6 […]` · `review buttons [ 'Apply 7 cuts', 'Reject all' ]`. Stopped the
  tree (bash 21100 → node 56012 → electron 55312 + 5 children): 0 processes left with 9271.
  `$env:B1_INAPP='1'; npx vitest run --config .vidtsx-temp/end-to-end/B1/vitest.b1.config.ts inapp`
  → `Test Files 1 passed (1) · Tests 1 passed (1)`. Free space: start C: 36.38 / D: 2.62 GB → end
  C: 36.36 / D: 2.76 GB.

- `npx vitest run src/shared/studio src/main/services/studio/editorial-cuts.test.ts src/features/studio/services`
  → `Test Files 84 passed (84) · Tests 807 passed (807)` — the existing cut-planner / editorial /
  text-delete tests are unchanged and green with the weighted windows + 50 ms floor.
- `npx vitest run` (full, app not running) → `Test Files 439 passed | 5 skipped (444) · Tests
  3699 passed | 34 skipped (3733)`, exit 0 — log `.vidtsx-temp/end-to-end/B1/logs/vitest-full-step1.log`
  (run just before the `cut-skip-merge.ts` split; after it `npx vitest run src/shared/studio` →
  42 files / 428 tests green).
- `npm run check:types` (after the split) → `tsconfig.web.check.json: 26 errors (baseline 26) ok`
  · `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Step 1 (M2), from `.vidtsx-temp/end-to-end/B1/`: `bash launch.sh` (background) →
  `node m2.mjs create` → `root set {"success":true}` · `root get {"root":"C:\\Users\\hasan\\AppData\\Local\\vidtsx-e2e\\b-root"}`
  · `created {"success":true,"project":{"schemaVersion":1,"id":"video-14-raw",…}}` · `import click true`
  (11 s). `node wait.mjs install` then `node wait.mjs wait 570` → last line `08:26:08 assets 9
  waves 9 v3 9 proxyReady 9 events 571` · `ALL DONE`. `node wavetime.mjs 6290a63b-… daf5a84e-…`
  → `…0369_D.MP4 dur 47.7s wall 0.1s ready … v3 pps 50 buckets 2383 zcr 2383 bytes 39497
  identical-to-first-run true` · `…0373_D.MP4 dur 396.2s wall 0.7s ready … buckets 19813 zcr
  19813 bytes 325363 identical-to-first-run true`. With the app stopped, from the repo root:
  `$env:B1_MAP='1'; npx vitest run --config .vidtsx-temp/end-to-end/B1/vitest.b1.config.ts map-transcripts`
  → `Test Files 1 passed (1) · Tests 1 passed (1)`; project.json transcripts read back
  `ready/27 ready/44 ready/97 ready/207 ready/183 ready/602 ready/40 ready/330 ready/290`, 9 files
  in `cache/transcripts/`.
- Free space: start C: 37.04 GB / D: 3.82 GB → after the profile copy D: 3.42 → after M2 C: 36.47 /
  **D: 2.79 GB** (see Open problems).
- Step 2 (exit comparison), from the repo root, app not running:
  `python -I -B .vidtsx-temp/end-to-end/B1/cutlib_joins.py` → `0366: keeps 0 words 27 segs 0` ·
  `0369: keeps 5 words 44 segs 6 floor -54.473…` · `0370: … segs 10` · `0371: … segs 24` ·
  `0372: … segs 9` · `0373: keeps 45 words 602 segs 61` · `0374: … segs 5` · `0375: … segs 33` ·
  `0376: … segs 29` · `wrote …\B1\cutlib-joins.json (4.8s)`; `tools/__pycache__` listing
  unchanged before/after (cutlib.pyc 2026-10-15 19:17:22).
  `$env:B1_COMPARE='1'; npx vitest run --config .vidtsx-temp/end-to-end/B1/vitest.b1.config.ts compare`
  → `Test Files 1 passed (1) · Tests 1 passed (1)`; `compare-report.json` summary
  `{"joinsTotal":352,"joinsWithin":348,"joinsOutside":4,"mergeFlips":2,"tolMs":20,
  "tailLevelDiffDb50ms":{"points":2222,"median":0.16,"p95":0.62,"max":3.06,"meanSigned":0.06},
  "headLevelDiffDb20ms":{"points":1686,"median":0.49,"p95":11.42,"max":30.75,"meanSigned":1.67}}`;
  per clip maxAbs ms `0369 20 · 0370 20 · 0371 40 · 0372 20 · 0373 60 · 0374 20 · 0375 20 · 0376 60`.
  `python -I -B .vidtsx-temp/end-to-end/B1/offset_check.py` → `0369: … best lag +0 ms (mean|dB|
  0.02) … -1:0.25 +0:0.02 +1:0.22` · `0371: best +0 (0.03)` · `0373: best +0 (0.02)` · `0376:
  best +0 (0.03)`.
- Free space before step 2: C: 36.44 GB / D: 2.79 GB (step 2 wrote ~1.3 MB to D:).
- (Steps 1–2 left the click-through and the post-split full gates open; step 3 ran both — see
  the Step 3 line at the top of this section.)

## Next step (ONE concrete instruction)

None for the builder — B1 is DONE. Orchestrator: send the B1 verifier (exit = the ±20 ms join
comparison on 0369 with the same keeps/words/style; commit range `e0d7d84..HEAD` — the only
`src/` commit is `2dc5add`, the rest are docs; the scratch kit
under `.vidtsx-temp/end-to-end/B1/` can be re-run, commands under Verified), then start B2.

## Open problems

- **Existing behaviour moved slightly (by design, toward cutlib):** every consumer of
  `RmsEnvelope` (Auto Cut, the editorial snap, Transcript deletes) now reads overlap-weighted
  windows and a 50 ms-window floor, and (after regeneration) 16 kHz levels. No existing test
  changed; say so in the STATUS row.
- **Every waveform of an old project regenerates on first open** (v2 → v3; plan §5 accepted
  it). On the video-14 copy that is 127 decodes at the media queue's 2-at-a-time. Not timed
  yet; the 16 kHz decode doubles the JS sample loop. Measure on M2's nine clips.
- **20 ms grid vs cutlib's exact windows — MEASURED (step 2), not a blocker:** joins 348/352
  within ±20 ms; the 4 outliers (+40/+60 ms) and 2 merge flips are tail knife-edges (level within
  0.6 dB of floor + 12, one 2.1 dB; or ZCR straddling 3500) — table under Done. The 50 ms tail
  windows read within 0.62 dB p95. **The 20 ms head windows do not:** the overlap-weighted
  POWER mean assumes uniform energy inside a bucket, so a window that touches 4 ms of a loud
  bucket reads up to +23–30 dB over the truth (p95 11.4 dB, signed mean +1.67) → Studio's
  `snapHead` can walk back FURTHER than cutlib's (4 of 200 atoms over 20 ms, max +150 ms, up to
  `maxHead`). On video-14 all four sit inside segments both sides merged, so no join moved, and
  the bias is in the safe direction (more lead-in, never a shaved onset). Fixing it needs a finer
  analysis grid (e.g. 5–10 ms buckets for rms/zcr) = a cache-format/plan change — NOT done; for
  the orchestrator / B2 to weigh if B2's by-ear or hard-entry checks show long lead-ins.
- `media-jobs.ts` is 314 lines (310 before this part, already over ~300; +4 here).
- **D: lost ~0.63 GB during step 1 that is NOT accounted for** (3.42 GB after the 0.40 GB profile
  copy → 2.79 GB after M2). Checked: `B1/profile` still 372 MB, `out/` 125 MB, `node_modules/.vite`
  89 MB, `B1/logs` ~0 MB; all M2 caches are on C: (579 MB). A full `D:\` scan for recent >20 MB
  files was too slow and was stopped. Check `Get-PSDrive D` before anything that writes to D:
  (an `electron-vite dev` launch rewrites `out/`); if it keeps dropping, find the writer before
  going on. The next steps (Python driver, scratch vitest) write only KBs.
- Python + the editor repo: importing `tools/cutlib.py` normally writes `tools/__pycache__/` into
  the READ-ONLY editor repo — use `python -I -B` / `sys.dont_write_bytecode = True`.

## Do-not-redo

- Track A is DONE (A1–A6 + track exit PASS). Do not touch `main`. The editor repo
  `D:\repos\claude-youtube-editor` is READ-ONLY.
- Step A (pure DSP + waveform v3, `2dc5add`) is done and green: do not re-port `zcr` /
  `snapHead` / `snapTail` / the merge, and do not re-open the 8 vs 16 kHz question (16 kHz for
  the whole waveform job is decided and committed).
- Step 1 (M2) is done: do not re-create `video-14-raw`, re-import, rebuild proxies/waveforms or
  re-map transcripts (B2–B6 share it as-is). Do not re-time the waveform job.
- Step 2 (exit comparison) is done: do not rebuild `cutlib_joins.py` / `compare.b1.test.ts` /
  `offset_check.py`; re-run them only to re-check (commands under Verified; ~5 s + ~1 s). Do not
  re-investigate the outliers (explained under Done) or the time alignment (lag 0 measured).
- Step 3 is done: gates green, the click-through ran and M2 was restored. A verifier that drives
  Auto Cut on M2 should back up and restore `project.json` the same way (M2 is shared by B2–B6).

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-22 · agent 1 · ~46 calls · step A: pure DSP ports + 29 unit tests, waveform job v3
  (16 kHz + zcr), stale-cache regeneration; commit `2dc5add`.
- 2026-10-22 · agent 2 · ~48 calls · step 1: M2 `video-14-raw` (nine clips, NVENC proxies, v3
  waveforms, waveform timing, Hasan's AssemblyAI transcripts mapped via `mapJob`); docs-only commit.
- 2026-10-22 · agent 3 · ~30 calls · step 2: cutlib vs Studio comparison on all nine clips (exit
  met on 0369; 348/352 joins within ±20 ms; outliers explained; lag-0 alignment); docs-only commit.
- 2026-10-22 · agent 4 · ~37 calls · step 3: full gates (green on the 3rd run; the first two hit
  only load timeouts outside B1), CDP click-through (v2 → v3 rewrite on open, Add to timeline,
  Auto Cut tight, in-app plan = pure `planCuts`), M2 restored, STATUS row + TESTING §18.7; DONE.

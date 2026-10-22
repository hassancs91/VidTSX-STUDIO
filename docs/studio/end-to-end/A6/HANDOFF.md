# A6 — The user-facing A/V check (T8) on the queue row + report JSON
status: IN PROGRESS (steps 1a + 1b done — the exit numbers hold outside the app; IPC + UI next)

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety rules, launcher, repo facts,
video-14 rules, every "Learned" line). A5's drivers (`.vidtsx-temp/end-to-end/A5/drive.mjs`,
`launch.sh`, `awake-and-priority.ps1`) are reusable.

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **A6** | The A/V check (T8) on the queue row + report JSON | the A5 files pass; a file offset by 100 ms on purpose fails |

Session gates (plan §3 head): `npx vitest run` green, `npm run check:types` at or below
baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the STATUS.md row,
the TESTING.md §18 block (`### 18.6 A6`).

**Never hand back while a render, a check, or any other long job you started is still running —
wait for it inside your own session (background task + notifications).** (A5 lost ~5.7 h to a
builder that handed back mid-render.)

## Plan context (§1.x facts, §2 decision, §5 items to read)

**§2 T8 (verbatim):** "'Check this export' on the finished queue row runs the audio-offset
instrument against the first clip's camera file and a frame match at the sampled times, with
**verify_sync's verdict**: pass iff median |offset| < 25 ms and |drift × span| ≤ 40 ms over ≥ 3
confident probes; report JSON beside the file. The hidden two-engine verification stays for
developers."

**§1.7 Verify (plan :349-356):** hidden dev mode (`run-export.ts:57-60`: not packaged or
`VIDTSX_EXPORT_VERIFY=1`, plus a localStorage flag); re-exports through a second engine and
measures per-frame diffs at first/last/thirds/every cut, audio offset candidate-vs-reference and
**candidate-vs-the first clip's camera file** (`verify.ts:68-101` — `sourceReferenceOf` picks the
first video clip with an audio-bearing asset at speed 1; `windowsWithin` picks 3 windows;
`audio-offset.ts`: 48 kHz mono, 1 s windows, ±120 ms, normalised xcorr, 102 lines). **Report only,
no pass/fail.** The editor's `verify_sync.py` is differential: audio window located in the source
by xcorr, the frame located by z-score within ±0.8 s of where the audio says, sync error =
video − audio; passes iff median |offset| < 25 ms and |drift × span| ≤ 40 ms, needs ≥ 3 confident
probes.

**The reference implementation (read-only, port its semantics):**
`D:\repos\claude-youtube-editor\tools\verify_sync.py` (286 lines). Orchestrator's read of it:
`SR = 8000` audio work rate; frame thumbnails `192×108` grayscale; `SourceAudio.locate` (:112-135)
finds an audio window in the source by FFT xcorr; `match_frame` (:137-148) z-scores a window of
source frames against the edited frame (`sim = zscore(win) @ zscore(frame) / size`); `measure`
(:150-180) searches the source ±0.8 s around where the audio says (`grab_frames(source, … -0.8,
96)`); `report` (:182-210) exits "only N/M probes produced a confident match — try --probes 24,
or --min-match 0.85 if the video is mostly graphics" when too few are confident, and flags drift
when `abs(slope * span) > 40.0`; `--tolerance` default 25 ms (:249). It also has a `--fix` mode —
NOT in A6's scope.

**The hard part for video-14 (orchestrator's note — design, do not skip):** a whole-frame match
against the camera file only works where the camera picture is what the export shows. In the A5
range (80–110 s) the master is hidden under opaque cutaways except inside the split
(`clip_mvba3wua_309b03`, 89.9–103.15 s, `transform {x:1615.733, y:596, scale:0.388889}`, with the
`V14A1Scratch` overlay on top), so naive probes will not reach "≥ 3 confident". The app KNOWS,
for every timeline second, which V1 clip shows, its source time and its transform — so place
probes where the reference is visible and compare only the region where V1 is drawn (map the
export frame's V1 box back to the reference frame through the clip's transform), or skip times
where V1 is covered. Report how many probes were confident and why others were skipped. If after
a real attempt the A5 range cannot yield ≥ 3 confident probes, that is a finding about the exit
as written → BLOCKED with numbers, not a lowered bar.

**The reference file for video-14:** the copy's V1 asset is the 4.05 GB master
`D:\repos\claude-youtube-editor\videos\video-14\output\master-tight-h264.mp4` (read-only) — the
"first clip's camera file" for this project. A range export's timeline seconds map into it
through the V1 clips' `sourceIn`.

**"A file offset by 100 ms on purpose":** make it from one A5 file with a stream copy and an
audio offset (e.g. `-itsoffset 0.1` on the audio input, `-c copy`), written into
`.vidtsx-temp/end-to-end/A6/` — never next to the A5 originals. The check must FAIL it with the
measured offset (≈ 100 ms) in the report.

**UI:** the queue row lives in `src/features/render-queue/components/RenderItem.tsx` /
`RenderItemDetails.tsx` (`RenderQueueContext.tsx`). "Check this export" appears on a finished
Studio export row; it runs in main (IPC), shows progress, then the verdict (pass/fail, median
offset, drift, probes confident/total) and the report path; report JSON written beside the
exported file (e.g. `<name>.sync.json`). The A5 exports are in `.vidtsx-temp/end-to-end/A5/
export/` — for the click-through, either make them rows in the A6 profile's queue (re-run a short
export there) or let the check accept a file path too; the A5 files must still be checked as-is
for the exit.

**Profile:** copy `.vidtsx-temp/end-to-end/A5/profile` (full ffmpeg installed in-app in A4, NVENC
probed, warm fonts, Studio root `v14-root`) to `.vidtsx-temp/end-to-end/A6/profile`. D: had
3.8 GB free and C: 40 GB at 07:08; check before copying.

## Done (file:line, commit hashes)

Step 1a — the pure core, part 1 (agent 1, commit `bcea695`
`feat(studio): A6 — sync check pure core: verdict + probe placement`). No app run, no `src/` outside these files.

- `src/shared/studio/sync-verdict.ts` (~135 lines) — `syncVerdict(rows, attempted, opts)` = a port of
  `verify_sync.py` `report()` (:182-210): offset = median error, MAD, outlier cut
  `|e − offset| < max(60, 6·MAD)`, least-squares slope over the kept rows (≥ 3, else 0), span =
  max t − min t over ALL confident rows, drifting iff `|slope·span| > 40`, pass iff
  `|offset| < 25` (strict) and not drifting; < 3 confident → `'inconclusive'` (never a pass).
  Sign: error = picture's source time − audio's source time; **+ = audio BEHIND**, − = AHEAD.
  One-line `message` for the queue row ("In sync: audio +2.5 ms vs the picture, drift +1.9 ms over
  5 s (6 of 16 probes)." / "Out of sync: audio 100 ms BEHIND the picture (…)." / "…drifts…" /
  "Not enough to judge: only 2 of 16 probes found the camera picture confidently (3 needed).").
  Also exports `median`, `linearSlope`, `SYNC_TOLERANCE_MS 25`, `SYNC_DRIFT_LIMIT_MS 40`,
  `SYNC_MIN_PROBES 3`, types `SyncErrorRow`, `SyncVerdict`.
- `src/shared/studio/sync-probes.ts` (~215 lines) — `planSyncProbes(project, {durationSec, fps,
  output, count=16, windowSec=2, edgeSec=0.25})` → `{ reference, probes, skipped, visibleSec }`.
  Reference = the asset of the FIRST video clip in the export with an audio-bearing asset at
  speed 1 (`sourceReferenceOf` semantics, limited to clips inside the export). Probe starts live
  only in that asset's clips, 0.25 s clear of both clip ends with the 2 s audio window inside the
  clip; minus every span covered on a track ABOVE it (tracks[0] paints on top —
  `TimelineComposition.tsx:112`): a `tsx` cutaway (`tsx.mode !== 'overlay'`) always covers; a
  video/image clip covers when its picture box meets the camera's visible rect; an overlay shot
  does NOT cover and is named on the probe (`overlays`). Skipped spans carry reasons (cutaway
  "<shotId>", speed ×N, rotated, faded, too small/off-frame, shorter than the window).
  `pictureRects(comp, output, media, transform)` = the visible camera picture in export px and the
  same area in camera px (even values; `translate·scale` about the centre + objectFit contain, same
  math as `src/features/studio/services/canvas-transform.ts:72-79`). Probes are evenly spread over
  the free time, snapped to export frames (`t = frame / fps`), `sourceSec = sourceIn + (t − start)`.
- Tests: `src/shared/studio/sync-verdict.test.ts` (7), `src/shared/studio/sync-probes.test.ts` (6),
  incl. the real A5 80–110 s document: all 16 probes in the split, first frame 629,
  exportRect `{2790,1256,1050,840}` ↔ sourceRect `{2,0,2700,2160}` (the PiP's right 442 px are
  off-frame), overlay `v14-a1-scratch` named, 3 skipped cutaway spans (OneWord 0–5.4, Template
  5.4–9.9, Starter 23.15–30).
- **A5 export contexts preserved** (the originals in `.vidtsx-temp/studio/` are swept by the first
  app start 24 h after their mtime — 4650cc99's is 2026-10-22 06:44): copied with `cp -p` to
  `.vidtsx-temp/end-to-end/A6/a5-contexts/`: `studio-entry-video-14-4650cc99.tsx(.json)` = **the
  80–110 s trimmed document, 1800 frames** (t = 0 at 80 s: V1 plain 0–9.9 in 80 · split 9.9–23.15
  in 89.9 PiP · plain 23.15–30 in 103.15; shots OneWord 0–5.4 cutaway, Template 5.4–9.9 cutaway,
  Scratch 9.9–23.15 overlay, Starter 23.15–30 cutaway); `6f4d5c3a` = 85–95 s (600 fr, the Fastest
  cancel); `a5cd21ed` = 6–11 s (300 fr).

Step 1b — the measuring core + the I/O runner, live on the A5 files (agent 2, commit: see LOG.md /
`git log --grep "A6 — sync check measure"`). No app run, no IPC/UI yet.

- `src/main/services/studio/export-engines/sync-measure.ts` (~240 lines, pure) — `rms`,
  `locateAudio(needle, haystack)` (normalised xcorr over every lag, prefix-sum energies, parabolic
  sub-sample peak, null if silent/too short), `zscore(values, mask?)`, `matchFrame(frame, window,
  mask?)` (verify_sync `match_frame`, over the masked pixels when a mask is given),
  **`layoutMask(pairs)`** (NEW, see "The overlay finding" below), `exactFrameSeek(n, fps)` =
  `(n − 0.5)/fps`, `sourceFrameWindow(audioSec, fps)` (first = ceil((audio − 0.8)·fps), 96 frames),
  `thumbSize` (long side 192, even), `cropScaleFilter`, `classifyProbe` → `ok` + errorMs (0.1 ms) |
  `silent` | `low-audio` | `low-video`. Constants: 8 kHz, ±0.5 s audio search, audio quality ≥ 0.5,
  silence RMS 50/32768, min match 0.90, mask residual 0.4, mask ≥ 25 % of the box, mask needs ≥ 3 probes.
- `src/main/services/studio/export-engines/sync-media.ts` (~120 lines, ffmpeg I/O, below-normal
  priority) — `probeMedia` (ffprobe json: w, h, fps, duration, hasAudio), `decodeWholeAudio`
  (`-af aresample=async=1:first_pts=0`, 8 kHz mono WAV pipe), `decodeAudioSpan` (input `-ss`, `-t`),
  `grabGrayFrames` (input `-ss`, `-frames:v N`, crop→scale→gray, rawvideo over image2pipe).
- `src/main/services/studio/export-engines/export-sync-check.ts` (288 lines) —
  `checkExportSync({ exportPath, project, reportPath?, ffmpeg?, ffprobe?, minMatch?, signal?,
  onProgress? })` → `{ report, reportPath }`; probes the export (fps/size/duration from the FILE),
  `planSyncProbes`, decodes the export audio once, per probe `readProbe` (audio locate → export
  thumb + 96 camera thumbs → plain match), then `finishProbes` (one layout mask per box with ≥ 3
  probes, re-match over it), `syncVerdict`, writes the report (default `syncReportPath` =
  `<dir>/<name>.sync.json`). Report: version, file, checkedAt, settings, export facts, reference
  (+ fps), visibleSec, skipped, probes (t, frame, clipId, plannedSourceSec, overlays, windowRms,
  audio {sec, quality}, video {sec, frame, quality, plainQuality, maskShare}, status, errorMs),
  verdict, elapsedMs. Plain messages for "no camera clip with sound", "no audio track", "camera never
  visible long enough".
- Tests: `sync-measure.test.ts` (15, incl. the mask lifting a half-covered match from < 0.75 to
  > 0.95 at the right index, a negative control — a window without the shown frame stays < 0.2 under
  the mask — and mask null with < 3 probes or < 25 % agreement). Live:
  `export-sync-check.live.test.ts` (3, skipped unless `VIDTSX_LIVE_SYNC=1`; makes the 100 ms file).
- **The overlay finding.** The plain whole-box match on the A5 split reads 0.65–0.72 on all 16
  probes (0/16 confident) although its time is right: the `V14A1Scratch` "overlay" shot paints a
  page background + a rounded portrait card frame over ~56 % of the PiP box (stills:
  `.vidtsx-temp/end-to-end/A6/reports/diag/export-629-full.png`, `export-629-crop.png` vs
  `master-5425-crop.png`). No document field says that, so the visible region is found from the
  data: per pixel, the median over all probes in the same box of |z(export thumb) − z(pass-1 best
  camera thumb)| < 0.4 → mask (43.8 % of the box kept here); every probe is then re-matched over the
  mask. The 0.90 bar is unchanged; `plainQuality` stays in the report. Masked: 0.954–0.987.
- **Frame-seek correction:** step 1a's design said `-ss (frame + 0.5)/fps`; that lands on frame
  n + 1. Measured 2026-10-22 (scratch `seek-check.mjs`, bundled ffmpeg vs the full build's
  `select=eq(n,N)` on the export n=700 and the master n=5500): `(n − 0.5)/fps` → frame n,
  `(n + 0.5)/fps` → n + 1 — as `frame-diff.ts` already does. `exactFrameSeek` uses `(n − 0.5)/fps`.

## Verified (exact commands + outputs)

- 2026-10-22 07:31 (agent 2): `VIDTSX_LIVE_SYNC=1 npx vitest run
  src/main/services/studio/export-engines/export-sync-check.live.test.ts` → `Tests 3 passed (3)`,
  152.8 s. Reports in `.vidtsx-temp/end-to-end/A6/reports/` (A5 folder untouched):
  - `a5-standard.sync.json` (A5 Standard `…21-30-54.mp4`): **pass**, offset **+0.2 ms**, spread
    7.3 ms, drift **−2.8 ms over 10.1 s**, **16/16** confident (all used), 52.6 s. Errors (ms):
    23.7 7.7 8.4 −7.6 −6.9 −6.2 −5.5 28.4 −4.2 13.1 −2.9 14.4 −1.5 15.9 −0.2 0.5 (±1 camera frame at
    59.94 vs 60 fps). Audio quality 0.98–1.0.
  - `a5-fastest.sync.json` (A5 Fastest `…21-10-24.mp4`): **pass**, identical numbers (+0.2 ms,
    −2.8 ms/10.1 s, 16/16), 48.3 s.
  - `standard-audio-plus-100ms.sync.json` on `standard-audio-plus-100ms.mp4` (made from the Standard
    file: `ffmpeg -i STD -itsoffset 0.1 -i STD -map 0:v -map 1:a -c copy`; ffprobe audio start_time
    0.078 = 0.1 − the 1024-sample AAC priming): **fail**, offset **+99.4 ms** ("Out of sync: audio
    99.4 ms BEHIND the picture (16 of 16 probes)."), errors 91.7–127.8, 51.3 s.
- First live run, before the mask (07:26): Standard → inconclusive, 0/16, plain match 0.651–0.717
  (log `reports/live-standard.log`).
- `npx vitest run src/main/services/studio/export-engines/sync-measure.test.ts` → `Tests 15 passed (15)`.
- `npx tsc --noEmit -p tsconfig.node.json | grep -E "sync-|export-sync"` → no lines.
- Free space 07:31: C: 38 GB, D: 3.8 GB (the 100 ms file is 16.9 MB on D:).
- Full `npx vitest run` and `npm run check:types` NOT run yet (no app code touched outside these files).

- `npx vitest run src/shared/studio/sync-verdict.test.ts src/shared/studio/sync-probes.test.ts`
  → `Test Files 2 passed (2) · Tests 13 passed (13)` (2026-10-22 07:18).
- `npx tsc --noEmit -p tsconfig.web.json` and `-p tsconfig.node.json`, grepped for
  `sync-(probes|verdict)` → no lines (no errors in the new files). The full `npm run check:types`
  and the full `npx vitest run` were NOT run this session.
- Free space 2026-10-22 07:13: C: 39 GB, D: 3.8 GB.
- Bundled ffmpeg (`node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe -filters`): has
  `crop`, `scale`, `format`, `trim`, `atrim`, `aresample`; **no `showinfo`, no `setpts`** (and per
  memory no `select`/`fps`) → frame times cannot be read back from ffmpeg; use the exact-frame seek
  `-ss (N + 0.5) / fps` and the file's fps from ffprobe (the master is **59.94** fps, the export 60).
  `ffprobe.exe` ships beside it.

## Design for the rest (decided in step 1a — build it this way unless a measurement says no)

- **Measurement (main, pure DSP in `src/main/services/studio/export-engines/sync-measure.ts`):**
  audio at 8 kHz mono (verify_sync `SR`); `locateAudio` = normalised xcorr of the export's 2 s
  window over the camera audio within ±0.5 s of the planned `sourceSec`, prefix-sum energies,
  parabolic sub-sample refinement, quality ≥ 0.5 else "low-audio"; silence gate RMS < 50/32768;
  `matchFrame` = z-score correlation (`zscore(win) @ zscore(frame) / size`, integer frame, no
  refinement — verify_sync :137-148) on gray thumbnails, min match 0.90 else "low-video"; error ms =
  (videoSourceSec − audioSourceSec)·1000.
- **I/O (main, `export-sync-check.ts`):** export audio decoded WHOLE with
  `-af aresample=async=1:first_pts=0` (otherwise a WAV pipe DROPS a start gap such as the
  `-itsoffset 0.1` file's — the 100 ms would vanish); camera audio decoded once per probe (or one
  span) with input `-ss`; export frame `-ss (frame−0.5)/60 -frames:v 1`, camera frames 96 from frame
  `ceil((audioSec − 0.8)·fps)` seeking `(K−0.5)/fps` (corrected in 1b — `+0.5` lands one frame late); both through
  `crop=W:H:X:Y,scale=TW:TH:flags=area,format=gray` (exportRect / sourceRect, long side 192) →
  `-f image2pipe -vcodec rawvideo -pix_fmt gray -`. Report `<export base>.sync.json`: settings,
  reference, plan.skipped, per-probe rows (t, frame, sourceSec, audio sec/quality, video
  sec/quality, errorMs, status, overlays), the `SyncVerdict`, elapsed ms.
- **IPC:** one channel (e.g. `studio:export:sync-check`) with a source of either
  `{ kind: 'entry', entryPath }` (the queue row: `job.filePath` → `readExportContext` gives the
  range-trimmed document) or `{ kind: 'project', projectId, rangeIn, rangeOut }` (main loads the
  project and trims with `trimTimelineToRange`, as `studio-handlers.ts:486-497` does) + a progress
  push event; result = verdict + report path.
- **UI:** "Check this export" on a finished Studio export row (`RenderItem.tsx` /
  `RenderItemDetails.tsx`), progress, then verdict line + "probes confident/total" + report path.

## Next step (ONE concrete instruction)

Step 2 — IPC: add channel `studio:export:sync-check` (+ push event `studio:export:sync-check:progress`)
in `src/shared/ipc/channels.ts` / `types.ts`, a handler in `src/main/ipc/` (try/catch, typed error)
that takes `{ exportPath, source: { kind: 'entry', entryPath } | { kind: 'project', projectId,
rangeIn?, rangeOut? } }`, resolves the document (`readExportContext(entryPath)` → `context.project`;
else load the project and trim with `trimTimelineToRange` as `studio-handlers.ts:486-497` does) and
calls `checkExportSync` (one check at a time; cancel by AbortSignal), returning `{ verdict,
reportPath, probes: {confident, total} }`; expose it in the preload; unit-test the handler with
mocked electron IPC as the other `*-handlers` tests do. Then step 3 = the queue-row UI + the CDP
click-through.

## Open problems

- The queue-row path depends on the export context sidecar, which the 24 h sweep removes
  (`export-context.ts:5-7`). A row older than a day cannot be checked from its entry → the check
  must say so plainly (or fall back to the `project` source). Not a §4 question; a design limit to
  record in TESTING §18.6 unless solved.
- RESOLVED (1b): input-`-ss` camera audio shows no bias — the Standard file reads +0.2 ms.
- RESOLVED (1b): the overlay covers ~56 % of the PiP box; the plain match failed (0/16) and the
  layout mask fixed it at the unchanged 0.90 bar (16/16). For the verifier: the mask is derived from
  the data (median residual across ≥ 3 probes of one box), never from one probe alone; a box with
  < 3 probes keeps the plain match. The negative-control unit test pins that the mask does not
  invent a match. Worth a sentence in TESTING §18.6.
- Cost: ~50 s per check of a 30 s 4K range (16 probes × 96 decoded 4K camera frames, below-normal).
  The UI needs progress (`onProgress` already reports done/total per probe).
- A 4K export's whole audio is decoded into memory at 8 kHz (4 B/sample: 115 MB per hour) — fine
  for now; note it if a long export is checked.

## Do-not-redo

- A1–A5 DONE. The two A5 exit files are the material — do not re-render them. Do not touch `main`.
- Step 1a above (verdict + probe planner + their 13 tests; the A5 contexts copy). Reading
  `verify_sync.py`, `verify.ts`, `audio-offset.ts`, `canvas-transform.ts`, the A5 contexts — done,
  summarised above; do not re-read unless changing them.
- Step 1b above (sync-measure + sync-media + export-sync-check, 15 unit + 3 live tests, the three
  live reports, the 100 ms file `.vidtsx-temp/end-to-end/A6/reports/standard-audio-plus-100ms.mp4`,
  the seek check, the overlay diagnosis). Do not re-run the live checks unless the measuring code
  changes; the reports above are the exit evidence for the measurement.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-22 · agent 1 · ~46 · read the plan/sources, preserved the A5 contexts, built + tested the
  pure verdict and probe planner (step 1a), fixed the rest of the design.
- 2026-10-22 · agent 2 · ~40 · step 1b: measuring core + runner, live on the A5 files; found the
  overlay covering the PiP and added the layout mask; corrected the frame seek.

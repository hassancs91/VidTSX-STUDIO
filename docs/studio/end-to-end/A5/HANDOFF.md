# A5 — Fastest on video-14 (30–60 s range across a split + a cutaway); Standard at 25 % for the record
status: IN PROGRESS (step 0 done — 0.1 `06edaf0`, 0.2 `f84a78d`; step 1 done; Fastest cancel PASS; Fastest 80–110 s DONE 1178 s / 1.53 fps; Standard same range IN FLIGHT at hand-off, job `4e20be8d-…`)

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety rules, launcher, repo facts,
video-14 rules, every "Learned" line). A2, A3 and A4 drivers are reusable:
`.vidtsx-temp/end-to-end/A3/drive.mjs` (export phase on the video-14 copy) and
`.vidtsx-temp/end-to-end/A4/drive.mjs` (`setup14`, `export14 <in> <out> <tag>`, `queue <tag>`).

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **A5** | Fastest on video-14: install the prerequisites, export a 30–60 s range across one split + one cutaway; Standard at 25 % on the same range for the record | both files complete; wall times and fps recorded in STATUS |

Session gates (plan §3 head): `npx vitest run` green, `npm run check:types` at or below
baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the STATUS.md row,
the TESTING.md §18 block (`### 18.5 A5`). Keep BOTH output files and record the exact range
(seconds, frames): A6 (the A/V check) and the track-A exit (frames vs the editor's
`video-14-preview.mp4`) are measured on them.

## Step 0 (orchestrator additions, do these FIRST, test-first, bounded)

1. **A render that can never end.** A4 step 4b saw Remotion's pre-encode ffmpeg die mid-render
   (`react-motion-render*/pre-encode.mkv` gone, "FFmpeg quit … while piping frame 66", `write
   EOF`); both errors were unhandled rejections and `renderMedia()` never settled
   (`node_modules/@remotion/renderer/dist/render-media.js:353-367` with `:255-258`, per the A4
   builder), so the job sat at "rendering" for 11 min until a manual cancel. Seen once, not
   reproduced. A5's renders run 20–45 min each, so make that failure END the job with an error
   instead of hanging: e.g. a guard in `src/main/services/remotion-renderer.ts` that turns the
   pre-encode/stitcher failure into a rejection, and/or a no-progress watchdog (no new frame for
   N minutes → cancel with "Render stalled at frame X"; N must tolerate a slow first 4K frame —
   the A3 verifier measured ~67 s before frame 1 at 4K). Unit-test it with a fake render that
   stalls / whose encoder dies. Do not change Remotion's own files.
2. **One network blip refuses an export.** The A4 verifier saw `fetchAndCache`
   (`src/main/services/font-proxy.ts:59-91`) fail 2 of 104 files with undici `terminated` while
   the rest downloaded; the strict preflight then refused with "Google Fonts could not be
   reached" (`src/main/services/studio/export-engines/font-preflight.ts:40-42`), which was untrue.
   Add one retry on transient fetch errors (network error / 5xx, not 404) and make the message
   say what happened (e.g. "2 of 103 font files could not be downloaded — check your connection
   and export again") when SOME files failed vs "Google Fonts could not be reached" when ALL did.
   Tests first.

## Plan context (§1.x facts, §2 decision, §5 items to read)

**§1.7 Export (plan :320-332):** quality best/high/medium/low = CRF 15/18/23/28; Standard
concurrency = Settings › Rendering default CPU: low 25 % / medium 50 % / high 75 % / max
(`render-cpu-usage.ts:10-15`), passed to `renderMedia({concurrency})`;
`hardwareAcceleration 'if-possible'`, x264 `veryfast`. **Fastest**
(`shot-composite-engine.ts`) copies plain-cut footage and renders only the shot layer with alpha
(ProRes 4444, `shot-layer-render.ts:1-15`), overlaid by ffmpeg; it and Fast need the full ffmpeg
plus a probed NVENC/QSV/AMF encoder (`passthrough-engine.ts:56-98`). **Browser spans** (rendered
in Remotion, not copied) include any non-identity transform (`export-spans.ts:189`), live filters,
letterbox, transitions — so video-14's 20 PiP spans render in the browser under either copy
engine.
**§1.7 the 2026-10-16 attempt (:346-348):** Standard, 82–102 s, 3840×2160 @ 60, CPU 25 %,
cancelled at 171 frames after 607 s (`notes/import/range-082-102.json` in the copy — read it; that
range may already cross a split and a cutaway).
**§2 T7:** "**Fastest is the 4K path to try**, with the full ffmpeg + NVENC prerequisites
installed on this PC; Standard at 25 % is measured on the same range for the record." "**Test
size is capped**: a **30–60 s range**, never the full video."
**§5 "Copy engines and splits":** every transform or crop span is a browser span, so video-14's
splits render in Remotion under Fastest too; the win is on the plain-cut stretches only.
"Expected, recorded here so it is not reported as a bug."
**§0 E1 (the track's property, measured in A6 + the track exit):** median A/V offset ≤ 25 ms,
drift ≤ 40 ms over the span; frames match the editor's preview at the same seconds.

**Moved here from A2:** the live **Fastest cancel** check — a cancelled Fastest range export
leaves nothing (before/after diff of `%TEMP%` top-level entries and the job scratch, as A2 did:
`.vidtsx-temp/end-to-end/A2/snap.mjs`). Do it on a short range BEFORE the long runs (cheap).

**Orchestrator decisions for A5:**
- **Profile:** copy `.vidtsx-temp/end-to-end/A4/profile` (322 MB: full ffmpeg installed through
  the app's own card download in A4, NVENC probed working, warm font cache, Studio root already
  `v14-root`) to `.vidtsx-temp/end-to-end/A5/profile` and use the copy — no second download. In
  STATUS say the prerequisites were installed in A4 by the in-app download and carried over.
  A2 learned the copy engines may need a restart after an in-app install; a fresh launch on the
  copied profile is a restart.
- **Range:** choose a 30 s range (the low end of 30–60 s; renders at 25 % are slow) of the video-14
  copy that contains ≥ 1 split (a V1 clip with a non-identity `transform`) and ≥ 1 cutaway shot
  clip; record the exact in/out seconds and frames and which split / cutaway they contain.
- **Order:** step 0 → Fastest cancel check (short) → Fastest full range → Standard at CPU low on
  the SAME range. One render at a time; render processes below normal; machine held awake
  (DRIVING.md). Record per file: wall time, render fps, output size, ffprobe (codec, size, fps,
  frames, duration, audio), and the job's own engine log lines (span counts: copied vs browser).
- **Disk:** C: had 33 GB free and D: 4.6 GB at 23:49. Each render copies the 4.05 GB master into
  the job scratch on C:; Fastest also writes a ProRes 4444 shot layer (can be several GB at 4K).
  Check C: ≥ 20 GB before each long run. Outputs go to `.vidtsx-temp/end-to-end/A5/export/` on D:
  — if D: drops under 2 GB, stop and record it (do not delete anything outside `.vidtsx-temp/
  end-to-end/`).

## Done (file:line, commit hashes)

- **Step 0.1 — a render that can never end now ends** (`06edaf0`). Root cause confirmed by
  code-read: Remotion throws "FFmpeg quit … while piping frame N" inside its `onFrameBuffer`
  (`node_modules/@remotion/renderer/dist/render-media.js:355-367`), nothing awaits it, and every
  later frame waits forever in `waitForRightTimeOfFrameToBeInserted`, so `renderMedia()` never
  settles; only its cancel signal ends it (`render-media.js:218-220` → frames cancelled → the
  final catch kills the stitcher and rejects, `:520-541`). No process-wide `unhandledRejection`
  listener exists in main and none was added (it would swallow every other rejection's warning
  and cannot attribute an error to a job).
  - `src/main/services/render-stall-guard.ts` (new, 125 lines): `stallAfterMsFor(perFrameTimeout)`
    = per-frame timeout + 2 min, never under 5 min (12 min at the 600 s default — a heavy frame
    Remotion itself still allows can never trip it; the slowest first 4K frame measured, ~67 s,
    is far below). `createStallGuard({stallAfterMs, cancel, totalFrames})` → `noteProgress({
    renderedFrames, encodedFrames, stitchStage})` (a change in any of the three is activity; an
    identical repeated tick is not) and `run(start)` (fresh clock per attempt; checks every 5 s;
    on stall → Remotion's cancel, up to 30 s for the render to settle so its processes/temp are
    released first, then `RenderStalledError`: "Render stalled at frame 66 of 1800: no new frame
    for 12 min — the renderer or its video encoder stopped responding, so the export was
    stopped. Export again; …" / "Render stalled before the first frame (0 of 300) …". The
    message never contains "cancel" (`remotion-renderer.ts` maps such messages to a user cancel).
  - `src/main/services/remotion-renderer.ts:10` import, `:283-290` guard per job (total = the
    `frameRange` length or the composition length), `:347-348` every Remotion progress tick fed
    in, `:364` each attempt (incl. the starvation retry) runs under `stallGuard.run`. Covers every
    caller of `renderComposition` (Studio Standard, Fast/Fastest browser spans and the Fastest
    shot layer, the Render page). The webp path is not guarded (own pipeline). The file was
    434 lines before (already over the 300 rule) and is 444 now — not split in this step.
  - Tests: `src/main/services/render-stall-guard.test.ts` (12: threshold rule, steady render,
    slow first frame, the dead encoder at frame 66 of 1800, encoder-only/stage progress counts,
    repeated tick is not activity, stall before frame 1, render that ignores cancel still ends
    after the grace, waits for the cancelled render to settle first, own errors pass through and
    the timer stops, the retry starts a fresh clock) and
    `src/main/services/remotion-renderer-stall.test.ts` (2: a fake `renderMedia` that reports 66
    frames of a 1800-frame range then only settles on cancel → `onComplete({success:false,
    error:"Render stalled at frame 66 of 1800: no new frame for 12 min…"})`, job status
    `failed`; a render with a frame every 4 min for 80 min at a 30 s per-frame timeout completes
    untouched).
- **Step 0.2 — a font fetch blip no longer refuses an export** (`f84a78d`).
  - `src/main/services/font-upstream-fetch.ts` (new, 60 lines): `fetchFontBytes(url, {retryDelayMs?})`
    — the upstream GET (same Chrome UA as before) with ONE retry after 500 ms when
    `isTransientFontFetchError(err)` (`:34`): any network error (fetch rejects, or the body read
    rejects — undici `TypeError('terminated')`) or a `FontUpstreamStatusError` (`:23`, message
    unchanged: "Upstream 404 for <url>") with status ≥ 500. Never retried: 404 / any 4xx (429
    included), the dev-override block (checked before the fetch, outside the retry), fs write
    errors. One `warn` log line "Font fetch failed; retrying once" per retry.
  - `src/main/services/font-proxy.ts:32,71-72` `fetchAndCache` downloads through it — so the export
    preflight (`ensureFontCached`), `warmFontCache` (brand fonts) and the live `/fonts?u=` proxy
    all get the retry. File 243 → 234 lines.
  - `src/main/services/studio/export-engines/font-preflight.ts:33-41`: `allFailed = failed.length >=
    urls.length` keeps the old "… and Google Fonts could not be reached (N font files missing).
    Connect to the internet …" message; otherwise "Export not started: N of M font files this
    video's shots use could not be downloaded (families) — check your connection and export
    again. The files that did download stay cached." (M = URLs checked; a stylesheet counts once
    with the files it lists, as `total` already did.)
  - Tests: `font-upstream-fetch.test.ts` (new, 8: transient classifier; one request when fine;
    retry once on a `terminated` body / a rejected fetch / a 503; 404 never retried; gives up
    after one retry with the 2nd error; waits the delay), `font-proxy.test.ts` +2 (a `terminated`
    blip on one file of a stylesheet → fetched `[CSS, A, B, B]`, all 3 cached; a 404 fetched
    once), `font-preflight.test.ts` (rewritten: ALL failed → "could not be reached"; SOME failed
    → "3 of 7 font files … could not be downloaded", never "could not be reached"; naming cap).

- **Step 1 — profile copied, range chosen** (agent 3, no source change).
  - `.vidtsx-temp/end-to-end/A4/profile` (322 MB) → `.vidtsx-temp/end-to-end/A5/profile` (`cp -r`).
    Free before: C: 32.75 GB, D: 4.44 GB (2026-10-22 00:03 local). The full ffmpeg
    (`ffmpeg-full/ffmpeg-n8.1.2-50-g1a748fe2cd-win64-gpl-shared-8.1`) was installed in A4 by the
    in-app card download and carried over; on the fresh launch `studioExportEnginesList()` →
    `remotion`, `passthrough`, `shot-composite` all `available: true` (no restart needed).
  - **The range: 80.000–110.000 s = frames 4800–6600 (1800 frames @ 60 fps).** From
    `v14-root/projects/video-14/project.json` (times in seconds, `timeline.tracks`):
    V1 `clip_mvba3wua_2e5da5` plain 75.5–89.9 · **split** `clip_mvba3wua_309b03` 89.9–103.15
    (`transform {x:1615.733, y:596, scale:0.388889}` = the PiP) · `clip_mvba3wua_cc8930` plain
    103.15–128.35. Shots track: **cutaway** `clip_mvba50vo_ebdf0e` V14A1OneWord 75.5–85.4 ·
    **cutaway** `clip_mvba50vo_6f306f` V14A1Template 85.4–89.9 · overlay `clip_mvba50vo_8bd7bc`
    V14A1Scratch 89.9–103.15 (over the split) · **cutaway** `clip_mvba50vo_93c5e8` V14A2Starter
    103.15–116.85. So the range enters AND leaves one split and crosses three cutaways.
    Fact for the record: video-14's 55 shot clips tile the whole timeline (cutaway on every
    plain V1 clip, overlay on every PiP clip), so Fastest copies 0 % anywhere on it — the
    cutaway stretches are "composite" spans (ProRes 4444 shot layer over copied footage), the
    split is a browser span (§5 "Copy engines and splits", expected).
    The 2026-10-16 range 82–102 sits inside this one (`notes/import/range-082-102.json`: Standard,
    CPU 25 %, 1200 frames, cancelled after 607 s).
  - Helpers in `.vidtsx-temp/end-to-end/A5/`: `launch.sh` (port **9245**, profile `A5/profile`,
    log `A5/logs/app.log`), `drive.mjs` (`ready` · `setup` · `run <tag> <engine> <in> <out>
    <cancel|complete> [cancelAfterSec]` — opens video-14, sets the range by Shift+→ seconds, picks
    the engine, resolution `original` (= 3840×2160; the dialog has no `4k` option on this
    project: `original,1440p,1080p,720p,540p,360p`), quality left at the project's `high`, writes
    `report-<tag>.json` every 30 s and at the end with phases, span plan/done log lines, queue
    row, ffprobe of the output, free space), `timeline.mjs` (clip lister), `snap.mjs` (A2's TEMP/
    profile snapshot+diff), `awake-and-priority.ps1` (keep-awake + BelowNormal for render
    processes under the 9245 electron; stops when `A5/stop.flag` exists; log
    `A5/logs/awake-priority.log`), `restore.ps1`, `cdp.mjs`, `dom.js`.
- **Fastest cancel check — PASS** (moved here from A2). `node drive.mjs run fastest-cancel
  shot-composite 85 95 cancel 30` on 85–95 s (600 frames): span plan `copied 0, composited 49,
  spans composite:0+24, composite:24+270, browser:294+306`; first frame 8 s after confirm;
  cancelled from the Queue at frame 24/600 (39 s) → `onRenderComplete {success:false, error:
  "renderMedia() got cancelled"}`, persisted `status: "cancelled"`; **no output file**, the job
  scratch `%TEMP%\vidtsx-studio\export\77d05ebe-…` gone (`scratchDirs: []`; it held
  `audio-graph.txt, audio.m4a, remotion` = 107 MB while running), no new
  `remotion-v*-assets` / `puppeteer_dev_chrome_profile-*` / `react-motion-render*` entries.
  Full `%TEMP%` top-level diff (`snap.mjs diff pre-cancel post-cancel` →
  `A5/snapdiff-cancel.json`): 8 new entries, all zero-byte `.tmpXXXXXX` files — ambient, not
  the app: `%TEMP%` holds 53 of them born every 10–30 s from 21:01 UTC, i.e. before the app was
  launched (~21:03) and after the cancel (21:09); `claude/` and a `<uuid>.tmp` grew = not the app.
  Profile grew 36 MB (bundle-cache +19 MB for the range entry, Chromium Cache, logs, queue).
  Report: `A5/report-fastest-cancel.json`, still `A5/stills/fastest-cancel-queue.png`.
- **Fastest, full range 80–110 s, 4K60 — COMPLETE** (job `2f1adadc-1272-43a9-b591-2241c7637d46`).
  `node drive.mjs run fastest-80-110 shot-composite 80 110 complete`, resolution `original`
  (3840×2160), quality `high`, CPU low, render processes BelowNormal (awake log shows
  chrome-headless-shell + ffmpeg set), free before C: 32.54 / D: 4.07 GB, after C: 41.4 / D: 3.89.
  - Confirm 21:10:24.148 UTC → complete 21:30:02 = **wall 1178.3 s (19.6 min), 1800 frames →
    1.53 fps**; engine "Export finished" `framesMs 1170846, audioPassMs 0, muxMs 729`.
  - Span plan `copied 0, composited 56, spans composite:0+324, composite:324+270,
    browser:594+795, composite:1389+411`; completion message "Copied 0 % and composited 56 % of
    this timeline (0 copied, 3 composited, 1 rendered spans)". Span done: OneWord composite 324 f
    in 355.4 s (0.91 fps) · Template composite 270 f in 29.4 s (9.2 fps) · split browser 795 f in
    556.5 s (1.43 fps) · Starter composite 411 f in 229.3 s (1.79 fps).
  - Disk estimate logged: temp 13.6 GB (remotion copy 4.05 GB + shot layers 10.26 GB est.),
    output 268 MB est.; font preflight 103 URLs, 202 cached, 0 fetched, 0 failed.
  - **Output** `.vidtsx-temp/end-to-end/A5/export/studio-video-14_2026-10-21T21-10-24.mp4`,
    35,076,111 B: h264 Main yuv420p 3840×2160, 60/1, 1800 frames (1800 packets), 30.000 s,
    9.08 Mb/s; aac LC 48 kHz stereo 30.000 s (1408 packets). Job scratch gone, no new TEMP
    entries, persisted `done`, 1800/1800. Report `A5/report-fastest-80-110.json` (ffprobe JSON,
    span lines, phases), stills `A5/stills/fastest-80-110-{dialog,queue}.png`, driver log
    `A5/logs/run-fastest-80-110.log`.

## Verified (exact commands + outputs)

- 2026-10-21 23:54 `npx vitest run src/main/services/remotion-renderer-stall.test.ts
  src/main/services/render-stall-guard.test.ts` → 2 files, 14 tests passed.
- 2026-10-21 23:55 `npx vitest run src/main/services/studio/export-engines src/main/services/remotion
  src/main/services/render-stall-guard src/main/ipc/render-handlers` → 24 passed | 1 skipped
  files, 160 passed | 11 skipped tests.
- 2026-10-21 23:55 `npm run check:types` → web 26 (baseline 26) ok, node 10 (baseline 10) ok.
- 2026-10-21 23:56 `npx vitest run` (no electron.exe running) → 430 passed | 4 skipped files,
  3612 passed | 22 skipped tests, 32.0 s, exit 0. Log:
  `.vidtsx-temp/end-to-end/A5/logs/vitest-step01.log`.
- Not driven live (a real dead encoder could not be reproduced in A4 4c); the live A5 runs will
  show the guard staying quiet on a healthy 4K render.
- Step 0.2: 2026-10-21 23:59 `npx vitest run src/main/services/font-upstream-fetch.test.ts
  src/main/services/font-proxy.test.ts src/main/services/studio/export-engines/font-preflight.test.ts`
  → first RED (3 files failed: module missing, retry test, SOME message), then after the change
  3 files, 20 tests passed.
- 2026-10-22 00:00 `npm run check:types` (no electron.exe running) → web 26 (baseline 26) ok,
  node 10 (baseline 10) ok.
- 2026-10-22 00:01 `npx vitest run` → exit 0, 431 passed | 4 skipped files, 3623 passed | 22
  skipped tests, 44.9 s. Log: `.vidtsx-temp/end-to-end/A5/logs/vitest-step02.log`.
- Step 0.2 not driven live (a mid-body `terminated` cannot be provoked on demand); the A5 cold
  preflight is warm already (A4 profile's font cache is copied).
- Live (agent 3, 2026-10-22 local; log times are UTC = local − 3 h), no `src/` change:
  `bash A5/launch.sh` (background) → `node drive.mjs ready` "ready after 4747 ms" → `node
  drive.mjs setup` → root `…\end-to-end\v14-root`, projects `["video-14"]`, engines all
  available, `defaultId: "remotion"`. Fastest cancel + Fastest full range as under Done.
  The stall guard (step 0.1) stayed quiet through the 19.6 min Fastest render (no "stalled" line).
- **IN FLIGHT at hand-off: Standard, same range.** `node drive.mjs run standard-80-110 remotion 80
  110 complete` started 2026-10-21T21:30:54.574Z (00:30:54 local), job
  **`4e20be8d-d22e-492b-8f1d-73e8fd84ce95`**, first frame at ~74 s (21:32:09 UTC, 4/1800).
  Expected ≈ 22–25 min at CPU low (A3: ~1.36 fps at 4K60) → done ≈ 21:55 UTC / 00:55 local.
  Driver log `A5/logs/run-standard-80-110.log` (ends with a `report …` line or `FAIL`), report
  `A5/report-standard-80-110.json` (rewritten every 30 s while running, final at the end).

## Next step (ONE concrete instruction)

Finish the Standard record, then the exit: read `A5/logs/run-standard-80-110.log` — if it ends
with `report …`, take wall time / fps / output / ffprobe from `A5/report-standard-80-110.json`;
if the driver or app died with the previous agent (no `report` line and nothing on port 9245, or
the job never finished), relaunch (`bash A5/launch.sh` in the background, `rm -f A5/stop.flag`
and start `awake-and-priority.ps1` in the background, `node drive.mjs ready && node drive.mjs
setup`, check C: ≥ 20 GB / D: ≥ 2 GB) and rerun `node drive.mjs run standard-80-110 remotion 80
110 complete` (if the app is alive but only the driver died: wait until `window.api.
renderQueueGet()` is idle, THEN read `renderQueueLoad()` for job `4e20be8d-…` and the
"Export finished" line in `A5/profile/logs/*.log`; the file lands in `A5/export/`). Then stop
the 9245 process tree + its electron-vite, `touch A5/stop.flag`, run the gates (`npx vitest run`
logged to `A5/logs/vitest-final.log`, `npm run check:types`), write the STATUS.md row (both
files' wall time, fps, size, ffprobe; prerequisites installed in A4 by the in-app download and
carried over) and TESTING.md `### 18.5 A5`, commit, return DONE.

## Open problems

- `src/main/services/remotion-renderer.ts` is 444 lines (was 434 before A5, already over the
  ~300 rule). Splitting it (e.g. the encoder-name helpers, the renderMedia option builder) is a
  separate refactor, not part of A5.
- Found, not A5's scope (no fix made): the Render-page/Studio bundling progress is 100× too big —
  `src/main/ipc/render-handlers.ts:199` sends `Math.round(percent * 100)` but
  `bundle-worker.ts:73` already passes Remotion's 0–100 value, so `onRenderProgress` reports
  `bundling 600% … 10000%` (seen in both A5 driver logs). Whether a UI shows it unclamped was
  not checked.
- Wording only: the Fast and Fastest rows always say "Needs the GPU encoder download"
  (`src/shared/studio/export-engines.ts:46,54`, static description) even when it is installed and
  the row is selectable — reads as stale on a PC that has it.
- Fastest was NOT faster than Standard's A3 rate on this range (1.53 fps vs A3's ~1.36 fps
  Standard): every second of video-14 is under a shot, so nothing is copy-only; compare with the
  Standard number when it lands and say so in STATUS (expected per §5, not a bug).

## Do-not-redo

- A1–A4 DONE. The video-14 copy's 55 bundles are fixed (A3) — do not re-bundle. The full ffmpeg is
  already installed in A4's profile — copy it, do not download again. Do not touch `main`.
- Step 1 DONE: `A5/profile` exists (do not copy again); the range is fixed at 80–110 s (frames
  4800–6600) — Standard must use the SAME range. The Fastest cancel check is DONE (PASS). The
  Fastest full-range file exists — do not render it again; keep it (A6 + the track exit use it).

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-21 · agent 1 · ~25 calls · step 0.1 (stall guard, `06edaf0`), gates green.
- 2026-10-22 · agent 2 · ~20 calls · step 0.2 (font fetch retry + partial-failure message,
  `f84a78d`), gates green. Step 0 complete.
- 2026-10-22 · agent 3 · ~50 calls · step 1 (profile copy, range 80–110 s), Fastest cancel check
  (PASS), Fastest full range (done), Standard started and left running at hand-off; docs only.

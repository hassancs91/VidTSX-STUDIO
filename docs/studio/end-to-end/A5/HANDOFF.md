# A5 — Fastest on video-14 (30–60 s range across a split + a cutaway); Standard at 25 % for the record
status: IN PROGRESS (step 0 done — 0.1 `06edaf0`, 0.2 `f84a78d`; next step 1: profile copy + range choice)

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

## Next step (ONE concrete instruction)

Step 1 (prep, no app launch yet): copy `.vidtsx-temp/end-to-end/A4/profile` to
`.vidtsx-temp/end-to-end/A5/profile` (check C:/D: free space first and record it), then pick the
30 s range from the video-14 copy (`.vidtsx-temp/end-to-end/v14-root/projects/video-14`: read
`notes/import/range-082-102.json` and, from `project.json`, the V1 clips with a non-identity
`transform` and the shot/cutaway clips) so it holds ≥ 1 split and ≥ 1 cutaway; write the exact
in/out seconds and frames (60 fps) and the clip ids it contains into this file.

## Open problems

- `src/main/services/remotion-renderer.ts` is 444 lines (was 434 before A5, already over the
  ~300 rule). Splitting it (e.g. the encoder-name helpers, the renderMedia option builder) is a
  separate refactor, not part of A5.

## Do-not-redo

- A1–A4 DONE. The video-14 copy's 55 bundles are fixed (A3) — do not re-bundle. The full ffmpeg is
  already installed in A4's profile — copy it, do not download again. Do not touch `main`.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-21 · agent 1 · ~25 calls · step 0.1 (stall guard, `06edaf0`), gates green.
- 2026-10-22 · agent 2 · ~20 calls · step 0.2 (font fetch retry + partial-failure message,
  `f84a78d`), gates green. Step 0 complete.

# A5 — Fastest on video-14 (30–60 s range across a split + a cutaway); Standard at 25 % for the record
status: NEW

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

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Step 0.1: read `src/main/services/remotion-renderer.ts` and how `renderMedia` reports progress and
errors to the export engines; add the "a dead encoder ends the job" guard test-first.

## Open problems

(none yet)

## Do-not-redo

- A1–A4 DONE. The video-14 copy's 55 bundles are fixed (A3) — do not re-bundle. The full ffmpeg is
  already installed in A4's profile — copy it, do not download again. Do not touch `main`.

## Agents so far (date · approx tool calls · what they covered)

(none yet)

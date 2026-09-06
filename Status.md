# STATUS.md — Current progress

> Claude: update this file after completing each phase.

## Current phase: 6 — Template store + media library
## Status: NOT STARTED

---

## 2026-09-06 — EXPORT ENGINES Stage 3 slice 1: the different-file cut measured, gain-only clips copied

Stage 3 of `docs/export-engines-plan.md` widens the passthrough engine's predicate one
span type at a time, each re-gated. Slice 1 first measured what T1 had not — a cut
between two DIFFERENT source files — then let gain-only clips through. Full log with
the numbers: the plan's §Stage 3 log.

- **Measured: the export shows the CEIL source frame on the first frame after it opens
  a file** (the first clip of each source file on the timeline) and the nearest
  everywhere else — a same-file cut or a return to a file already opened. Two seeds
  through the real dialog in verify mode, each frame identified against the camera
  file's own frames: `t5-1080p-cut-files` (0270, then 0272 from 15 s) shows K 900 at
  the cut where nearest is 899, and the passthrough's nearest read 0.51 % over 24
  against it; `t5-1080p-cut-files2` (A-B-A) shows K 400 where ceil = nearest (not 401,
  so it is the ceil rule and not "the frame after the nearest") and K 1798, the
  nearest, on the return. `planExportSpans` now sets `firstFrameCeil` on a copy span
  whose source file no earlier piece has shown; the A-B-A seed then reads max 0.01 %
  over 24 at all 8 sampled frames, 0 % at both cuts. `docs/PREVIEW_TESTS_PLAN.md`
  §T1 leg 0 gained the two rows. Seeds: `scripts/bench/seed-cut-projects.mjs`.
- **Widened: gain-only clips.** `copyBlocker` no longer blocks on `gain`; the audio
  planner carries the clip's static gain on its segment and the one ffmpeg audio pass
  applies `volume=<gain>` there — the linear multiplier Remotion uses for a static
  `volume` prop. Fades, speed, transitions and audio tracks still go to the browser walk.
- **Gate** on `t5-1080p-cut-gain` (the T1 cut with gain 0.5 on clip B): verify vs the
  Remotion engine max 0.01 % over 24 at the seven frames (the Stage 2 rows); `t1-diff`
  vs the 2026-09-04 control **0 % over 24 at every frame**; audio **0 ms at all eight
  windows vs the camera file AND vs an independent Remotion export** of the same
  project; level 1.000 vs that export at every window, 0.4995–0.4997 (−6.03 dB) vs the
  camera file on the gained clip; the H.264 stream **byte-identical** to the Stage 2
  cut export; spans at 3.2× and 3.9× realtime.
- **Stage 2 gates unchanged:** `t5-1080p` and `t5-1080p-cut` re-exported with video
  AND audio streams byte-identical to the Stage 2 files, 0 % over 24 vs the control at
  the seven frames, 0 ms vs the camera file at the eight windows.
- Gates: check:types 26/22 (baseline), vitest 1,411 green (+5), live ffmpeg tests 5
  (+1: the gained segment at 0.5× the camera file's RMS, lag 0).
- **Next: Stage 3 slice 2** — audio tracks as a mixed second chain in the one pass
  (`amix=normalize=0`; seed a music clip under the T1 cut, gate level + offset against
  a plain Remotion export as above), then multiple video tracks where lower tracks are
  fully covered. Open: whether a return to a file after minutes (the compositor closing
  an idle file) shows the ceil frame — unmeasured, one source frame at one cut.

## 2026-09-06 — EXPORT ENGINES Stage 2 DONE: the passthrough engine at its narrowest predicate, gated on both reference projects

Stage 2 of `docs/export-engines-plan.md` (D1–D7; Stage 1 seam committed 57becff).
The picker's second row, "Fast", copies plain cuts of video assets with the full
ffmpeg's NVDEC → nearest-pts select → NVENC under T1's four conditions and renders
only touched spans in the browser; the gate held: **0 % of pixels over 24 vs the
2026-09-04 control at 1/300/449/450/451/600/899 on `t5-1080p` and `t5-1080p-cut`,
≤ 0.01 % vs the Stage 1 Remotion engine in verify mode, audio 0 ms at every window
vs the DJI camera file, copied spans at 3.7–4.2× realtime, a re-export byte-identical
on video and audio.** Full log with the numbers: the plan's §Stage 2 log.

- **Behind the seam**: `src/shared/studio/export-spans.ts` (pure span planner +
  audio planner, decides from the document alone; the dialog uses it for "Copies
  N % of this timeline") and `src/main/services/studio/export-engines/passthrough-
  {engine,ffmpeg,browser,probe}.ts` (availability = full ffmpeg + a working hardware
  encoder; pieces = copy / black / browser, every piece's frame count checked, TS
  join checked, one ffmpeg audio pass handed over as `audioPath`, D4 notice while a
  nothing-to-copy timeline renders). `remotion-renderer.ts` gained `frameRange`.
- **Findings**: NVENC writes primaries/transfer only from the frames (`setparams`
  in every span graph); against the Stage 1 Remotion engine the copied spans carry
  a ~200-pixel edge residue (0.01 % over 24, max 44) that no scaler moves — colour
  conversion, not frame mapping (flat across the cut); the select clamps the slot
  index so a whole-frame-early seek stays exact.
- **Verified in the real app over CDP**: `t5-1080p` 900 frames in 7.2 s (4.19×),
  `t5-1080p-cut` 450 + 450 in 4.1 + 3.9 s; file ready ~13 s after the plan. **The
  re-seeded 3 h T6 project (275 clips, 330,749 frames, 100 % copied) exported in
  1 h 32 min** — 61 min of copied spans (HEVC 4.2×, the H.264 master 2.6×), ~7 min
  join + audio, 24 min in the finishing mux of the 10.6 GB file — against T6's
  ≈ 3.5 days; its first clip diffs 0 % over 24 vs the control and the audio reads
  0 ms vs the camera file at seven positions across the whole timeline (no drift).
  Four earlier 3 h runs found and fixed, each re-gated: sub-frame clip overruns
  sent 5 % to the browser (planner bound); clip tails one frame short where the
  video stream ends before the container (held-tail piece); `ENAMETOOLONG` on the
  275-segment audio graph (script file); a camera file's audio ending 44.7 ms
  before its container shifted every later clip's audio (segments pinned to their
  planned length) — a fault no 30 s gate could see.
- Gates: check:types 26/22 (baseline), vitest 1,406 green (+31), 2 live ffmpeg tests
  behind `VIDTSX_LIVE_FFMPEG=1`. Bench: `passthrough-video-hash.mjs`;
  `export-engine-run.mjs` matches card titles exactly and takes `--proxy-wait`.
- **Next: Stage 3** — widen the predicate (gain-only clips with `volume=` in the
  audio pass, audio tracks, then multiple video tracks), each widening re-gated;
  measure a cut between two different source files first.

## 2026-09-06 — EXPORT ENGINES Stage 1 DONE: the engine seam, gated on both reference projects

Building resumed for the export-engines plan (`docs/export-engines-plan.md`, D1–D7
locked 2026-09-04). Stage 1 = the seam every engine plugs into, the Remotion path
moved behind it, and the gate met: **the default engine exports `t5-1080p` and
`t5-1080p-cut` at 0 % of pixels over 24 vs the 2026-09-04 control at frames
1/300/449/450/451/600/899 (900 frames, `yuv420p tv bt709`), and the audio reads
0 ms at every window against the DJI camera file (was +42.7 ms on every export).**
Full log with the numbers: the plan's §Stage 1 log.

- **The seam**: `src/shared/studio/export-engines.ts` (catalogue: ids, trade-off
  wording, default) + `src/main/services/studio/export-engines/` — `ExportEngine`
  (`availability`, `produce → { videoPath, audioPath?, notes? }`), registry,
  `remotion-engine.ts`, `finishing.ts` (D7: probe → mux → probe, fails loudly on a
  tag mismatch), `run-export.ts`, `verify.ts` + `frame-diff.ts` + `audio-offset.ts`
  (D5: the T1 instruments in product form), `export-context.ts` (trimmed document
  beside the entry). Queue jobs carry `exportEngine` (new DB column); the render
  handler branches on it after the shared bundle step. Settings › Rendering
  "Default Studio export" (D2); Studio's Export button now opens `ExportDialog.tsx`
  — picker on the default, labels are the trade-off, never the mechanism (D3);
  dev verify controls behind localStorage `vidtsx:export-verify`.
- **Three findings that shaped it**: (1) a separate Remotion audio-only pass
  costs 7 min against 8.6 min of frames (Remotion re-downloads the 1.3 GB source
  per `renderMedia`), so the Remotion engine renders one pass to `.mkv` with PCM
  audio and hands it over — the finishing stage still owns the only AAC encode;
  (2) Remotion's `colorSpace: 'bt709'` leaves primaries/transfer untagged —
  `remotion-color-args.ts` extends its zscale filter; (3) the +42.7 ms was AAC
  priming lost in Remotion's ADTS stream-copy — PCM in, one `aac` encode → 0 ms.
- **Verified in the real app over CDP** (`scripts/bench/export-engine-run.mjs`
  drives the dialog): `t5-1080p` 522 s render-start → file; `t5-1080p-cut` 9 min
  + its verification reference; verify mode on a seeded 3 s two-clip project:
  Remotion vs Remotion diff 0 at 7 frames, audio 0 ms, report + stills beside the
  export. Remotion's bundled ffmpeg has no `select`/`hstack`/rawvideo/f32 — the
  instrument seeks, pipes WAV and tiles in JS.
- Gates: check:types 26/22 (baseline), vitest 1,350 green (+35). Not done, Stage 4
  tickets: queue rows persist `framesRendered 0`; `%TEMP%\remotion-v4…` copies
  per render. Left on disk: project `t5-1080p-cut3s`, three exports + two
  `.verify-remotion.mp4` + one `.verify/` folder under `Videos\VidTSX`.
- **Next: Stage 2** — `passthrough-engine.ts` at the narrowest predicate under
  T1's four conditions, audio as an ffmpeg one pass handed over as `audioPath`,
  gated by the verify mode against the Remotion engine on both reference projects.

## 2026-09-05 (later) — VIDEO PROVIDERS Stage 1 DONE: provider registry (refactor, nothing user-visible)

`src/shared/providers/registry.ts` is now the single definition of every shared BYOK
provider (fal, openrouter, cloudflare, assemblyai, elevenlabs, zai). `ProviderKeyId` /
`ProviderCredentials` derive from it; the Providers-page key rows (labels, hints,
placeholders, capability badges, test buttons, Cloudflare account-id field) render from
it (`SHARED_KEY_ROWS` deleted); the `hasKeys` map is built from its ids. Every engine
preset names its `credentialId` (LLM openrouter/zai, image fal/openrouter/cloudflare,
new `transcription-engine/presets.ts` for STT) and `image-init` / `llm-init` /
`stt-init` / `image-handlers` / `llm-handlers` / `llm-provider-filter` read
`credentials[preset.credentialId]` instead of inline ternaries and id special-cases.
New test `registry.test.ts` pins preset→registry resolution, ids ≡ union, and
badge ⊆ consuming engines. Verified: type gate at baseline (web 26 / node 22), 1318
tests green, Providers page CDP-compared against HEAD row by row — identical, then one
two deliberate changes on Hasan's say-so: OpenRouter now carries the `Transcription`
badge it always earned (`stt-init` registers it), and the Phase C "shared key IS the
enablement" rule is generic (every preset with a `credentialId`, not OpenRouter only —
fixes a saved zai config stranded at `enabled: false`). Full log: `docs/video-providers-plan.md` §6. Next: Stage 2 (video
engine extraction) on Hasan's go. Uncommitted — commit by pathspec when asked.

## 2026-09-05 — AI RUNTIME + REMOVE BACKGROUND + 3D STUDIO: Stage 5 hardening DONE, release-wired (waits for the V1 flip)

**Shipped behind three flags now ON for release** (`ai-system-runtimes`, `ai-3d-models`,
`threed-studio` moved from `.env`-gated to plain `FEATURE_FLAGS: true`): an optional,
downloadable Python + PyTorch runtime (cdn.vidtsx.com, 280 MB CPU / 2.8 GB GPU) with
two curated models — **Remove background** in Image Studio (u2net 176 MB, ISNet 179 MB
used automatically once downloaded) and **3D Studio** (TripoSR 1.7 GB, image → GLB).
Plan + full numbers: `docs/ai-runtime-implementation-plan.md` §10 (2026-09-05 Stage 5).

Stage 5 verified on this box (GTX 1650 Ti 4 GB, dev app over CDP):
- **Guards through the real UI** with the new `VIDTSX_AI_RUNTIME_OVERRIDES` dev stand-in:
  path-too-long (194 chars > 132 budget → both install buttons disabled, both feature
  dialogs say so), disk (1 GB → both blocked; 3 GB → GPU blocked, **CPU offered instead**,
  a fix made on the spot), driver floor (470 → CPU recommended, GPU link disabled with the
  message), VRAM floor (2 GB → same), 512³ disabled on the real 4 GB card.
- **Update path** (fake `2026.09.2` served locally): row "Update available · 2026.09.1 →
  2026.09.2", both features' dialogs "Update the AI runtime", CPU update 149 s, old
  cu126 folder removed after success; **Repair** 142 s; **Remove** now asks inline
  "keep models" / "runtime + models (1.9 GB)" — both verified on disk.
- **The real 2.6 GB GPU download through the row**: ≈ 20 min end to end at this
  2.5–3.5 MB/s uplink (resumed leg 783 s: download 497 s, sha256 31 s, extract 166 s,
  verify 14 s, warm-up 75 s) → "Installed · GPU · 2026.09.1 · 4.6 GB on disk". An app
  restart mid-download (my own edit) resumed from the 1.24 GB partial file.
- **Error matrix**: corrupt TripoSR weights → readable "weights damaged … re-download"
  (a truncated file is caught by the byte count before Python runs); missing package →
  "incomplete or damaged … Use Repair" (doubled hint fixed); runtime at a 178-char path →
  now "path too long" instead of "Repair"; Remove while a job runs → worker cancelled
  first, no EBUSY; cancel at 5 stages of 3D + 2 of rembg → card gone 1.5 s, no orphans, no
  leftovers. OOM cannot be forced on this WDDM box (512³ on 4 GB succeeds, peak 3.25 GB;
  torch spills to shared memory) — covered by Stage 0 + the classifier test.
- **Leftovers closed**: CPU copy "1½–2 min" (measured 96–124 s); ISNet quality check
  (tighter fur edge, 43 % fewer faint pixels, +1.7 s → shipped as a second entry);
  sha256 on every whisper + SD model download and the whisper binary onto the download
  engine; GLB preview on asset tiles/details (shared `GlbViewer`); "Library meshes"
  section in the 3D prompt (context field; caller wiring pending, see the plan).
- **Not done: the rented GPU VM** (no TensorDock/Paperspace account on this box) —
  runbook written into `docs/gpu-cloud-testing-plan.md`, ~45 min once an account exists.

Commits: `0242148` `9557da0` `6060af7` `b1d770f` `6b8b0da` `36951df` `4cd63cd` `2f6be0e`
`ec35745` + the docs commit. Gates: check:types 26/22 (baseline), vitest 1,314 passing (+16).
## 2026-09-04 (evening) — T1 MEASURED: the WYSIWYG tolerance is a number, and the passthrough join is provable inside it

**No product code.** Hasan decided passthrough-first (smart render for
untouched spans, `docs/studio/PLAN.md` §5; full hybrid later, per span type
if the numbers demand it). T1 was the gate and it ran today: three legs on
the same 30 s spans at the same frame indices, on the D-Log HEVC clip and
the H.264 master, every comparison repeated. Everything is in
`docs/PREVIEW_TESTS_PLAN.md` **§T1** with a report file behind every number
(`.vidtsx-temp/bench/t1/`: `preview/`, `frame-map/`, 200 side-by-side
stills, `join/`, `audio/`, `summary.json`). Instruments under
`scripts/bench/`: `t1-preview-capture.mjs` (the real Player over CDP at 1:1,
seeked through the PlayerRef found by a fiber walk, presentation confirmed
by `requestVideoFrameCallback`), `t1-frame-map.mjs` (which *source* frame a
picture shows), `t1-diff.mjs`, `t1-join.mjs`, `t1-audio-offset.mjs`, and
`t8-ffmpeg.mjs` grew `--conform=nearest --source-in --first=ceil --source`.

- **The frame-mapping rule, measured not inferred:** a healthy Remotion
  export shows the source frame whose pts is **nearest** to f/30 (three
  exports, 14 indices each, incl. a real timeline cut — byte-identical to
  the single-clip export); the **preview** shows the last frame **at or
  before** f/30, so the two already disagree by one source frame on about
  half of all frames. ffmpeg's `-r 30` is two frames early and `fps=` drifts
  to ceil; a per-frame `select` on absolute pts reproduces Remotion at every
  index. A span rendered as its *own* composition shows the ceil frame at
  its first frame only. A memory-starved export (this morning's control,
  384 MB free) shows duplicated and skipped source frames — the compositor
  returns whatever survived eviction, silently.
- **Leg 1 — the tolerance (preview vs export today):** mean 3.4–4.8/255
  per channel, 15–18.5 % of pixels over 8, up to **3.0 % over 24**, plus the
  one-frame timing and a +2–3/255 brightness offset on the preview side
  (proxy + `<video>`; the export is 1.3–1.6 from its source frame, the
  preview 3.5–3.9 from its). Repeat: 0.
- **Leg 2 — export vs passthrough** (NVDEC → `scale_cuda` → NVENC with the
  nearest select): mean **≤ 1.74/255, 0 % over 24**, same frame at every
  index, D-Log and H.264 alike; repeat encodes byte-identical; 3.9× realtime
  on HEVC. Three times inside leg 1 on every metric.
- **Leg 3 — the join:** passthrough 0–15 s + browser-rendered 15–30 s. Mixed
  encoders cannot be concatenated (the mp4 recipe jumps to 87 s at the seam,
  the TS route drops frames at the SPS/PPS switch and mis-tags the second
  half); with the browser frames encoded by our ffmpeg to the passthrough's
  settings, **TS video-only intermediates give exactly 900 frames with exact
  pts and a seam at leg 2's level** (1.4–2.0/255, 0 % over 24), except the
  browser span's ceil first frame. Audio: **every Remotion export is +42.7 ms
  late** against the source; the passthrough is at 0; concatenating the
  halves' own audio jumps 61 ms at the seam; **one audio pass is 0 ms at
  every window**.
- **Verdict:** the passthrough join is provable at the tolerance with ~3×
  margin, under four build conditions (nearest select; one encoder for both
  span kinds; TS video-only + one audio pass muxed last; handle the first
  frame of browser spans — render one frame early and drop it). Findings for
  tickets: +42.7 ms export audio; exports tagged `yuvj420p pc bt470bg`;
  preview brightness offset; starved exports show wrong frames with no trace.
- **Then, discussed with Hasan the same evening and LOCKED in
  `docs/export-engines-plan.md` (D1–D7):** the passthrough ships as an
  **opt-in export engine** behind an engine interface + registry (Remotion
  stays the default; Settings default + Export-dialog picker; names
  internal; always runs, with a message when nothing can be copied; hidden
  dev mode that runs two engines and reports the T1 diff; audio reference =
  the camera file, so the Remotion path's +42.7 ms is corrected in a shared
  finishing stage). **Next session: Stage 1 (the engine seam), then Stage 2
  (the passthrough at its narrowest predicate).**
- Left on disk: projects `t5-1080p-join`, `t5-1080p-cut` (Recycle-Bin delete
  via the app), ~1.2 GB in `.vidtsx-temp/bench/t1/`; the 12 `%TEMP%\remotion-v4…`
  folders today's exports left behind are empty (48 KB). Dev app left
  running; keep-awake released.

## 2026-09-04 (later) — T8a/T8b/T8c MEASURED: the screenshot is the export wall, passthrough is the only order-of-magnitude lever; nothing decided

**No product code.** Building stays paused; the decision (passthrough vs
hybrid) is Hasan's. Everything is in `docs/PREVIEW_TESTS_PLAN.md` §T8
"Results", with a report file behind every number (`.vidtsx-temp/bench/t8/`,
stills in `…/t8/stills/`, sampler `…/samples/…__t8-exports.jsonl`, no
standby holes). Bench additions under `scripts/bench/`: `studio-export.mjs`
grew `--media-engine` (patches a sibling copy of the generated export entry
so the composition's own decoder switch flips for one render), `--direct-gpu`,
`--direct-hw`, `--tag`, and captures the `render:complete` event for direct
renders; new `t8-ffmpeg.mjs`, `t8-output-diff.mjs`, `t8-seed-intra.mjs`,
`t8-headless-decode-probe.mjs`.

- **Controls first, because the noise is 1.6×:** the same OffthreadVideo
  export of the T5 30 s HEVC project ran at 1.17 frames/s from the Export
  button (first render of the day, cold source copy) and 1.93 from the
  direct path 35 min later. Ratios are the finding, not rates.
- **T8a — `<Video>` from `@remotion/media` cannot help the DJI files.**
  Under Remotion's default GL backend headless Chrome has no HEVC decoder
  (probe: HEVC Main10 unsupported in every mode; H.264/AV1/VP9 software
  only), so the tag silently falls back to OffthreadVideo — same rate (1.81
  frames/s), same picture, one warning line in the render log. With
  `gl: angle` the shell gets D3D11 on the Intel iGPU, reports hardware HEVC,
  and the render hangs on the first frame until the 600 s timeout, twice
  (`Timeout while extracting frame at time 0.2sec`, GPU decode counters
  zero). On the H.264 master the tag engages (software WebCodecs) and lands
  at 2.08 frames/s vs 1.87 for OffthreadVideo — a wash, though it skips
  OffthreadVideo's 65 s copy of the 6.3 GB source and 1.5 GB of compositor
  memory.
- **T8b — all-intra 4K intermediate:** NVENC 0.90 GB per minute of 4K60
  (120 Mbps) made at 0.89× realtime; x264 crf 16 1.39 GB/min. Exporting
  from it: 2.27 frames/s (+18 % on the nearest control), colour identical.
  Found on the way: the on-card NVENC plan (`scale_cuda=format=yuv420p`,
  T4b's shape) emits solid-green 1.6 KB frames when the size does not
  change — the shipped proxy path always resizes, so it is unaffected.
- **T8c — the passthrough floor:** the same 30 s through ffmpeg NVDEC →
  `scale_cuda` → NVENC at 1080p: **8.8 s, 3.3 CPU-s, 3.4× realtime**, 30.3
  MB vs the control's 32.4 MB, channel means within 1/255. The only
  differences are on motion edges: ffmpeg's `-r 30` conform of a 59.94 fps
  source picks a different frame of each pair than Remotion's time-exact
  seek (902 vs 900 frames) — the frame mapping T1 must prove.
- **What the numbers say:** every browser path lands at 1.8–2.3 frames/s
  once decode is removed or cheapened, so the 3 h timeline is ~40 h at
  best (T6: ~85 h); passthrough puts its untouched footage at ~53 min on
  this GPU, and whatever still goes through the browser costs ~15 s per
  second of timeline.
- Left on disk for inspection: projects `t5-1080p`, `t5-1080p-intra`,
  `t5-1080p-h264` (Recycle-Bin delete via the app when done) and the
  intermediates in `.vidtsx-temp/bench/t8/` (~1.2 GB). Render timeout
  setting verified back at 600 s; `%TEMP%` clean; memories
  `studio-next-session-tasks` and `studio-scale-limits-open` updated.

## 2026-09-04 — export path discussed and researched; three tests planned (T8a/b/c), nothing built

**No code.** Hasan read the T6 verdict (export is the wall) and asked whether
long 4K exports are simply impossible, how CapCut is so fast, whether Remotion
can use the GPU or render in parallel chunks, and whether TSX shots could be
pre-rendered to video and composited in one GPU pass. Answered with sources in
`docs/PREVIEW_TESTS_PLAN.md` **§T8**: CapCut's speed is an all-on-GPU native
pipeline (the shape our T4b proxy generator already has, 2.4× realtime here);
Remotion already renders in parallel (half the threads) so chunking adds
nothing on one machine; its GPU options cover drawing and encoding, never the
per-frame screenshot or the CPU source decode; the hybrid "pre-render TSX,
composite in ffmpeg" is realistic and is the design the architecture doc
warns about (two renderers must agree on every frame). Recommendation
recorded: passthrough for untouched spans first, T1 gates it. **Agreed next
step: three ~30-min tests on the T5 30 s project** — T8a `<Video>` from
`@remotion/media` for export, T8b export from an all-intra intermediate, T8c
the ffmpeg NVDEC→NVENC passthrough floor. Building stays paused; the
decision is Hasan's after the numbers.

## 2026-09-03 — T6 (long-project stress) and T5 (resolution ceiling) MEASURED; the preview test wave is done except T1/T7

**No product code.** Building stays paused, slice 8 on hold, the
PREVIEW_ARCHITECTURE checklist still Hasan's to mark. Everything below is in
`docs/PREVIEW_TESTS_PLAN.md` §T5/§T6 with a report file behind every number
(`.vidtsx-temp/bench/t6/`, `t5/`, `samples/`). Instruments added under
`scripts/bench/`: `seed-long-project.mjs` (a multi-hour Studio project on
disk from the 4 real 4K60 sources), `sample-machine.mjs` (per-process working
sets incl. Remotion's browser/compositor, machine memory, GPU decode/encode
counters, 15–30 s), `watch-proxies.mjs`, `t6-session.mjs` (a driven editing
session over CDP), `studio-export.mjs` (an export through the real UI, timed
from the app's own queue).

- **T6 — 3 h of 4K60 (44 assets, 11,025 s, 275 clips), answer for Hasan:
  supported to open, proxy and edit; NOT supported to export today.**
  Proxy queue 1 h 54 min on x264 / ~1 h 03 min with the GPU encoder on (its
  first real-project number; 1 h 16 min as measured, 13 min of it Modern
  Standby); 4.5 GB of proxies; cold open 2.9 s, warm 0.8 s; editor usable
  while the queue runs. Session: 90 min of driven editing + 5.7 h idle, app
  peak 1.4 GB across all processes, JS heap flat, trimmed to 400 MB under a
  287-MB-free squeeze with zero errors, no crash. Scrub cost identical to the
  3-asset control at every layer count (the only collapse is T2's
  element-count cliff, reproduced on both). **Export: ~1.08 frames/s** from
  4K60 HEVC — the compositor decodes every source frame in software — so the
  3 h timeline is **~3.5 days**; started, stable, cancelled at 86 min. The
  wall is export time; passthrough for untouched spans (PLAN §5, unbuilt) is
  the only fix in sight.
- **T5 — 8K exports correctly.** 30 s at 1080p/4K/6K/8K: all 900 frames at
  the right dimensions; 8K = 434 MB in 28 min 39 s with the stitcher ffmpeg
  at 7.8 GB and 101 MB of machine memory left. The ceiling is memory, not
  resolution; the named failure below it is Remotion's `No frame found at
  position N` (OffthreadVideo cache starvation, hit on 2 of 4 1080p runs when
  < 0.5 GB was free). Frame rate 0.5–1.4/s at every size.
- **Findings for tickets (not fixed, building paused):** Studio Export passes
  no `cpuUsage`, so Settings › Rendering › CPU usage never reaches it;
  failed or cancelled exports leave `%TEMP%emotion-*-assets` source copies
  (1.2–1.9 GB each here, ~33 GB for the 3 h project) and a cancel leaves the
  headless browser running; `renderQueueLoad` rewrites active jobs to
  "interrupted" if called mid-render (it is the startup path — scripts must
  read `renderQueueGet`).
- **Machine hygiene learned the hard way:** this laptop has 15.7 GB, not 32;
  it was shared all day with ~13 GB of other processes and Defender; it
  enters Modern Standby when idle and that stops ffmpeg, samplers and renders
  (holes are documented per result; a keep-awake is now part of the recipe);
  an elevated orphan `cmd.exe` burns ~0.7 core and cannot be killed from a
  normal shell (PID 7608 today, 4628 before). The dev harness also reloads
  the renderer page (Vite client reconnect) after pauses — dev-only.
- **Memory updated:** `studio-scale-limits-open` is now evidence, not
  reasoning. T7 not run. Gates untouched (no `src/` change).

## 2026-09-02 (later) — T4b measured: opt-in GPU proxy encoder SHIPPED (off by default)

**The decision gate below was answered by Hasan with a yes, conditional on
measuring first.** Building otherwise still paused for the preview test wave;
slice 8 still on hold; the PREVIEW_ARCHITECTURE checklist still unanswered.

- **T4b DONE — GPU encode** (`docs/PREVIEW_TESTS_PLAN.md` §T4b). Bench grew
  `--ffmpeg/--encoder/--cq/--preset`, `nvdec`/`cuda`/`d3d11va1cu` decode
  variants and a GPU *VideoEncode* counter. Full pass (1,002 s of 4K60, the
  shipped 540p all-intra profile, concurrency 2): **x264 518 s / 3,281 CPU-s**
  vs **NVENC with the whole pipeline on the card 272 s / 107 CPU-s** at the
  same size (392.6 vs 393.0 MB, cq 33 tuned to match CRF 28). Machine CPU 75%
  → 30%. NVENC fed from system memory (the "decode stays d3d11va" shape) was
  **slower than x264** (556 s): the CPU-side 4K scaler costs more than x264
  at 540p, so only the on-card path ships. T0 in-session: NVENC proxies fling
  at 21–22 ms vs 23–28 ms for x264's, 0 misses; natural/playback vsync-bound
  as always.
- **Three findings that shape the feature:** (1) `-encoders` is not proof —
  ffmpeg 9.0.1 lists NVENC and refuses drivers < 610 (this laptop: 592), so
  the probe *encodes two frames* per candidate; (2) NVENC intra-only is
  `-g 0`, rate control `-rc vbr -cq 33 -b:v 0`, and NVENC cannot share the
  d3d11va decode device on this driver (`CreateInputBuffer failed`) — the
  NVIDIA path decodes with `-hwaccel cuda`; (3) gyan.dev deletes old builds,
  so the catalogue pins a BtbN dated monthly autobuild with its published
  SHA-256 (n8.1.2, shared, 80 MB, GPL v3 — `THIRD_PARTY_NOTICES.md`).
- **What shipped:** `ffmpeg-full.ts` (catalogue → existing download manager
  → `userData/ffmpeg-full/`, functional probe cached in `encoders.json`,
  sticky per-session fallback), `proxy-encoders.ts` (pure: parsing,
  NVENC › QSV › AMF preference, per-vendor args, on-card plan for NVENC,
  profile tags so x264 and GPU windows never join), the generator branch
  (full binary, same below-normal priority, one failure → latch + wipe +
  restart that asset on x264), three IPC channels
  (`studio:proxy-encoder:status|install|set-enabled`), persisted
  `proxyGpuEncoderEnabled` (default off), and Settings › Rendering › **"Faster
  proxy generation (GPU encoder)"** (Download ~76 MB → "Detected: NVIDIA
  NVENC" → checkbox; fallback notice). QSV/AMF ship on the system-memory
  shape, unmeasured (no AMD here), behind the same fallback. Audio pass,
  concat, media-jobs, renderer contract and the Remotion export: untouched.
- **Live (CDP-driven dev app):** download → detected → enabled → video-2
  proxy regenerated by the full binary with the cuda pipeline, child
  `BelowNormal`, GPU encode engine 10.6% / decode 100%, manifest
  `nvenc-540p-intra-q33`, **37,893 frames, all keyframes** in ~5 min (x264:
  6 min 10 s; this master is 8-bit H.264 where NVDEC caps at ~2.3×; the
  10-bit HEVC clips get 3–4×). Hard kill mid-window → resumed (`Resumed proxy
  from finished segments`) → byte-identical output. Disabled → next proxy
  ran on the bundled x264 binary again (`x264-540p-g1-crf28` manifest).
  Fresh T0 on the in-app file: equal-or-better than its same-session
  control in three trios, but the control itself had drifted 26 → 33–57 ms
  by late afternoon (machine state after ~5 h of transcodes; an orphaned
  `cmd.exe` from 28 Aug is burning one core — Hasan may want to kill PID
  4628), so no absolute number is claimed for it; the morning session
  stands. **Setting left OFF; video-2's cache holds the GPU-made proxy.**
- **Gates:** 1,180 tests (1,157 + 23: encoder parsing/choice/args/plan,
  handler round-trip incl. fallback clearing, generator GPU branch + fallback
  + profile-mixing guard + cancel), types 26/22 exact.

## 2026-09-02 — proxy pipeline: priority bugfix, T4 + T3 measured, segmented resumable proxies SHIPPED

**Sanctioned inside the pause as a bugfix plus two wave tests.** Trigger: Hasan
opened the migrated video-2 project (one 6.3 GB 4K60 H.264 master) and proxy
generation pinned every core at NORMAL priority; closing the app mid-transcode
restarted the file from 0%. Slice 8 still on hold; the PREVIEW_ARCHITECTURE
checklist is still unanswered (deliberately).

- **Bugfix (`9a3559b`):** every proxy/waveform ffmpeg child runs at
  **below-normal priority** (`runFfmpeg({ priority })`, `os.setPriority` on
  the child, best effort) and the dead NVENC-first branch is gone (the stripped
  ffmpeg has no hardware encoders; it cost one doomed spawn per session).
  Verified live: `PriorityClass BelowNormal` on the child; renderer rAF p50
  16.7 ms / max 49.9 ms / zero frames over 50 ms while a 4K proxy generated.
- **T4 DONE — hardware decode.** `-hwaccel d3d11va` halves the CPU bill on
  either GPU (8,414 → ~3,900–4,200 CPU-s for 1,002 s of 4K60), but only the
  *discrete* adapter shortens the wait (908 → 567 s, 1.6×); the default
  adapter on a hybrid laptop is the iGPU and saves no time (939 s). Proven by
  the Windows GPU-VideoDecode counter, not inferred. Shipped:
  `proxy-hwaccel.ts` enumerates adapters once per session and prefers a
  discrete one; guarded sticky fallback to software like the NVENC precedent.
  Bench: `scripts/bench/run-proxy-cost.mjs`. Full numbers in
  `docs/PREVIEW_TESTS_PLAN.md` §T4.
- **T3 DONE — proxy codec.** Six variants, T0 against each in one session
  with the control first and last (control held at 32.1–32.9 ms fling p50).
  **All-intra 540p CRF 28 shipped**: fling p50 32 → 25 ms (31 → 41 steps/s),
  12% faster to encode, **2.6× disk** (~23 MB/min of 4K60); the p90 tail
  (43–53 ms) did not move on any variant — it is seek machinery, not decode.
  MJPEG is **unplayable** in Chromium's `<video>` (295/300 misses). Two
  constants to reverse if Hasan prefers 720p fidelity. §T3 has the table.
- **Segmented, resumable proxy generation (`proxy-generator.ts` +
  `proxy-segments.ts` + `proxy-concat.ts`):** fixed 60 s windows → per-window
  files in `cache/proxies/<assetId>/` (renamed into place only after a clean
  exit, pid-suffixed `.part` names so an orphaned ffmpeg cannot collide) →
  one AAC pass → concat-demuxer stream copy → same final `proxies/<id>.mp4`
  path; media-jobs and the renderer are untouched. Resume = skip finished
  windows; a `plan.json` manifest (profile tag, source size/mtime, window)
  makes foreign leftovers get wiped, not joined. Progress is one honest
  percent across windows + audio + join and never goes backwards.
  **Kill test, live:** hard-killed the app with 2 of 11 windows done → both
  survived with their mtimes, no orphan ffmpeg → reopened → log `Resumed
  proxy from finished segments {resumed: 2, total: 11}` → finished. Worst-case
  loss is one window (≤ 60 s of source, ~50 s of work).
- **Frame-exact join was the hard part, and it was measured three times.**
  Container durations of x264 B-frame segments run a frame long at some joins
  (shifted every later frame); an input-side `-t` is packet-based and leaked a
  duplicate frame at 5 of 10 joins on the H.264 master (37,898 frames vs
  37,893); the shipping form — input `-ss`, output absolute `-to`, `-copyts`,
  explicit per-file `duration` lines read from the segments — reproduces the
  single-pass pts sequence exactly on the test clip and gives the master its
  37,893 frames. Matroska segments lose to their millisecond timebase.
- **Fresh T0 on the shipped result** (video-2 master, old 720p GOP-15 proxy vs
  the new segmented all-intra 540p one, control first and last in one
  session): fling p50 31.2 → 26.3 ms, natural scrub 16.6 ms and playback 59.9
  fps on both, frame-accuracy err 8.5 → 7.2 ms. Nothing regressed; the join is
  invisible to the Player.
- **Gates:** 1,157 tests (1,105 + 52 new: segment planning/resume, progress
  aggregation, generator with mocked ffmpeg incl. hwaccel latch and cancel,
  join maths, adapter parsing/choice, runFfmpeg priority), types 26/22 exact.
- **DECISION GATE for Hasan (not built):** GPU *encode* via a
  download-full-ffmpeg-on-first-use (NVENC/QSV/AMF). With decode on the GPU the
  remaining cost is x264 at 540p, ~1.5–2 CPU-s per source second; the wait on
  this laptop is now ~1.2–1.8× realtime. Decode-only may be enough; the ~100 MB
  download and the CRF→bitrate mapping are the costs. Build only on a yes.

## IN PROGRESS: preview-engine test wave (T0–T7) — building PAUSED (2026-08-28)

**Hasan's call: stop building and measure before deciding.** Slice 8
(text-based editing) is NOT started and is deliberately on hold.

Read in this order: **`docs/PREVIEW_TESTS_PLAN.md`** (the wave, T0–T7, status
per test, pass/fail criteria) → `docs/PREVIEW_ARCHITECTURE.md` (the options
and the 12-item checklist the wave feeds) → `scripts/bench/README.md` (how to
run T0). Nothing in the architecture doc is DECIDED until Hasan marks it.

- **T0 DONE (`a164e3b`)** — preview scrub benchmark harness:
  `node scripts/bench/run-bench.mjs --from-project=raw-footage-test
  --media=proxy|original`. Mounts the REAL `TimelineComposition` in a real
  Player inside Electron (same Chromium the app ships). Reports to
  `.vidtsx-temp/bench/`. Gates green, no product code touched.
- **Baseline** (DJI 4K/60/10-bit HEVC): proxy scrub 16.6 ms natural / 48.3 ms
  fling; original 101.5 ms / 281 ms with 70 misses; **playback 59.9 fps on
  both**; the app's own JS is **0.1 ms/step everywhere**.
- **Three findings that bind later work:** (1) our code is not the
  bottleneck, it is entirely decode; (2) proxies buy ~6× and the residual
  pain is *flinging* on proxies, which is what T3's all-intra proxy attacks;
  (3) the same 4K file that costs 281 ms per SEEK plays back at 59.9 fps —
  seeking is the cost, not decoding, which is the measured form of the
  WebCodecs argument in PREVIEW_ARCHITECTURE §D.
- **Measurement warning:** T0's first version measured `requestAnimationFrame`
  and reported a flawless 16.7 ms (= 60 Hz vsync) for configurations that
  visibly lag. It now uses `requestVideoFrameCallback`. **The `57 ms` in
  `proxy-generator.ts` and the `17–25 ms` in the S2 checkpoint below may
  measure the same wrong thing — do not compare them with T0 numbers.**
- **T2 DONE (2026-08-28)** — the decoder swap. `@remotion/media@4.0.435` added
  at the exact pin (no train movement), `case 'video'` swapped behind
  `src/shared/studio/media-engine.ts`. **Default is `offthread`: nothing that
  ships changed.** Run either arm with
  `--engine=offthread|webcodecs`; colour with
  `node scripts/bench/run-frame-diff.mjs`. Gates green (1,105 tests, types
  26/22, `electron-vite build` clean).
- **T2's answer is CONDITIONAL — it inverts on layer count, so do not quote it
  as a yes or a no.** At **1 layer** the shipping path wins: proxy fling 32.6 ms
  vs 47.7 ms, and 4K fling 280 ms vs an outright 400 ms timeout (254/300
  missed). At **3 layers** the shipping path collapses (fling 400 ms, 142
  misses) while WebCodecs holds at **134 ms with zero misses** — 3× better.
  The best single number in the test is **4K natural scrub 90 ms → 19 ms**,
  the decode-forward win §D2 predicted, undone by the fling and playback cases.
- **Two risks the architecture doc flagged did NOT materialise.** DJI 4K 10-bit
  HEVC (`hev1.2.4.H150`) **decodes natively** — 100% of frames through
  WebCodecs, zero fallbacks, zero `<video>` elements. And colour holds on
  D-Log: **0.15/255 systematic shift**, i.e. 0.06%. §D3.2 and §D3.3 are
  answered with pixels.
- **Two things it did NOT settle, stated plainly.** (1) The **export half** of
  the fallback question is unmeasured — preview never falls back, so there is
  nothing to match, but `video-for-rendering` is a different code path and
  nobody has run an export on this engine. (2) **4K playback drops 59.9 → 8.4
  fps**, and that is a real regression that needs explaining before the idea is
  dismissed *or* adopted — Mediabunny's `CanvasSink` rasterises a full
  3840×2160 RGBA frame into a 960 px player, which would be a configuration
  problem rather than a WebCodecs one.
- **Recommendation on file: keep the dep and the flag, default off; do not ship
  the swap.** The result is conditional, and T3's premise ("the winning decoder
  changes what the right proxy is") is now genuinely open. Deleting the dep and
  the `case` stays cheap and is Hasan's call.
- **T0's instrument needed extending, and that is itself a finding.**
  `@remotion/media` draws into a `<canvas>`, so it has **no `<video>`** and
  `requestVideoFrameCallback` does not exist on it — T0 unchanged reports
  150/150 misses, a fake catastrophe. `scripts/bench/harness/probes.ts` taps
  the engine's own `Drew frame <s>` trace, the only channel giving both *when*
  and *which*. **Two further traps were caught by the control disagreeing**
  (a frame already on screen, and the free step across a cut where
  `premountFor` already painted), plus a third now refused rather than
  reported: multi-layer playback fps is unmeasurable on **both** engines
  (they reported "10000 fps" and "Infinity fps"). All four are written up in
  `scripts/bench/README.md`.
- **Bench hygiene learned the hard way: run control and treatment in the SAME
  session.** Proxy fling p50 reads 48.3 ms cold and 32.6 ms warm — same
  command, same code. A fresh treatment run against a remembered baseline
  credits the decoder for the page cache.
- **NEXT: T3, the proxy codec A/B** — now unblocked, and more interesting than
  before: T2 did not crown a decoder, so the "tune the proxy against the
  winning decoder" ordering no longer has a winner to wait for.
- Source material: `raw/` = 9 DJI clips, 15 GB, **27 min** of 3840×2160 60 fps
  10-bit HEVC. Enough for T0–T5; T6 must synthesise 3 h from it.

## Completed phases

### V1 BUILD ORDER Slice 7 — PROJECT PACKAGES (.vidtsx) SHIPPED (2026-08-26)
**`docs/NEXT_FEATURES_DESIGN.md` Q7 (build-order row 7), commits NF16–NF18.
Gate-green per commit (1,105 tests, +81 new; type baselines 26/22 exact);
CDP-verified live: a real project exported and re-imported through the UI,
and the file association proven by firing a second instance with a .vidtsx
on argv.** One file carries a whole Studio project — backup, machine
migration, hand-off, and (later, Q7g) something a creator sells.
(1) **Format** (NF16): `manifest.json` with format/app/schema versions,
per-file sha256 + size, the asset table (originalName/hash/originalBytes so
even a no-media package can relink), counts and `kitVersion`. Reserved from
day one per the Q8 constraint: manifest `kind` ('project' | 'template'),
per-asset `replaceable` + `role`, and `packs`/`packs/` — v1 writes
`kind: 'project'` and never writes `packs`, but all of it round-trips
through the validator so a v1 reader can NAME a template package instead of
choking on it (caption packs get their own `caption-packs/` folder so they
never collide with the reserve). Caps: 20k entries, 256 GiB total, 64 GiB per
media file, 64 MiB for anything the app PARSES — the split matters because
the small cap is the one guarding a JSON parser and the TSX gate.
(2) **Writer** (NF16): plan-then-write, so the dialog can size all three
strategies without touching a file. Policy per Q7b — always project.json +
shots + transcripts + cut-plans + thumbs + the kit pin + a tokens-only brand
snapshot; NEVER proxies/waveforms/renders. project.json is REWRITTEN (media
refs go package-relative, proxy/waveform pointers dropped) so nothing
absolute from the exporter's machine survives; transcript/thumbnail refs need
no rewriting at all because cache-relative paths already match package paths.
Each entry is hashed from the bytes actually streamed (one pass over
multi-GB media), media is STORED not deflated, and a failed write unlinks the
partial file. Zip deps pinned exact (archiver 7.0.1 / unzipper 0.12.3) — no
new dependency was needed.
(3) **Import** (NF17): the manifest is the ALLOWLIST (a stowaway entry is
never read or written); zip-slip is checked twice (string-only name check
before any resolve, then resolve + containment on every target); declared
size must equal the zip's own uncompressed size BEFORE a byte lands (the
zip-bomb shape); every file is hashed as it is written. A newer
format/schema version is refused with a message naming the app version that
wrote it. Always a NEW project id, `migrateProject` as the document gate,
and every path-bearing field rewritten — a package that puts
`../../../evil.jpg` in `thumbnail.path` gets `thumbs/<id>.jpg`. The **D14
gate re-runs on every shot** (mandatory — the exporter's machine proves
nothing): pass = ready, allowlist-gap-only = a Convert card, anything else =
an error card, and the project still opens. Assets with no media get a
project-local PLACEHOLDER path, which routes them through the EXISTING
prepare → library-hash-heal → Locate… flow with zero new machinery. A failed
import leaves nothing behind.
(4) **Brand** (Q7f) all three offers real: match one of yours / create from
the snapshot / keep the tokens project-local at `<project>/brand.json` — the
last one made real by `project-brand.ts`, one `resolveProjectBrand()` now
used by shot generate, shot refine and the export entry's caption palette
(library brand wins; the snapshot is the fallback, including when a library
brandId has gone stale). The exporter's brandId is always dropped.
(5) **Convert in place** (NF17): `shot-conform.ts` — shot-import conforms on
the way IN and can reserve a fresh folder, but an imported shot's id and the
clips referencing it arrived together, so a conversion lands as a NEW VERSION
IN THE SAME FOLDER; re-importing would orphan every clip.
(6) **UI + association** (NF18): export dialog (three strategy tiles carrying
real totals, per-asset table, chat opt-in), import dialog (manifest summary,
brand offer, report cards), `.vidtsx` file association via electron-builder
with the OS hand-off funnelled through one pending slot in main — the push
event only navigates, the PATH waits until the project browser claims it, so
a cold start into another screen cannot drop it. Two new CDP dialog
stand-ins (`VIDTSX_PACKAGE_SAVE`/`VIDTSX_PACKAGE_PICK`, the
`VIDTSX_RELINK_PICK` precedent) documented in `docs/ui-automation-cdp.md`.
**One judgement call for Hasan:** the chat opt-in governs BOTH
`agent-chat.json` and per-shot `chat.json` — Q7a lists the latter
unconditionally, but Q7b's reason ("it's a private conversation") applies to
both. Say the word to split them. **Noted from the live walk:** for a small
source clip the proxies-only package can be LARGER than full media (a 0.4 MB
clip's 720p proxy is 0.6 MB); the tile shows the real number, so the dialog
is honest about it rather than promising "smaller".

### SLICE 5 FOLLOW-UPS CLOSED — blocklist pruning + mailto + eval re-run (2026-08-26)
**Commit NF15. Hasan's Gate A review pass applied: −41 verified-collision
terms → 1,223 (the review artifact was found deleted; rebuilt from source
and walked in-session; every drop verified to fire against the live gate
first). Headliners: fr `bite` (= English "bite" — blocked every innocent
English prompt containing the word), es `concha`, nl `aftrekken`
(subtraction), ar `فرج` (relief), ja `ローター` (rotor), zh `交配`
(animal mating). All 40 pruned prompts + 5 retained-coverage neighbors
pinned as golden tests (moderation suite 47→92). Mailto
`support@vidtsx.com` CONFIRMED final. Eval: the assumed CF/agy accrual had
not happened (still the 12 NF12 starters); re-run reproduces NF12 exactly
(11/12, FP 8.3%, sweep flat) — bands stay frozen 0.8/0.2, no retuning.
Bulk generation of the remaining ~490 SFW eval images approved + started
(agy). Full detail: CONTENT_SAFETY_DESIGN.md "Rev 2 amendments". Still
open from slice 5: full-set eval re-run once images land; live
cloud-provider + video legs (ride Hasan's testing pass).**

### V1 BUILD ORDER Slice 6 — GEMINI/AGY SUBSCRIPTION IMAGE PROVIDER SHIPPED (2026-08-26)
**`docs/NEXT_FEATURES_DESIGN.md` Q1 (build-order row 6), commits NF13–NF14.
Gate-green (983 tests, +31 new; type baselines 26/22 exact); live-verified
via CDP: one real Nano Banana 2 generation driven through the new
"Google (subscription)" provider row in Image Studio — agy spawn → NDJSON
DONE gate → brain-dir harvest → Gate B output classification → gallery
save, ~30 s, $0 (subscription-billed).** (1) `gemini-cli` CLI-bridge
provider (`GeminiCliImageProvider`, registerInstance like the local SD
bridge, zero models until agy detected + authed → UI hides it): TS port of
the proven `gen-image.ps1` recipe split into pure
`agy-cli-protocol.ts` (unit-tested: VERBATIM prompt pinning, DONE-event
success gating because exit 0 lies, non-recursive brain-dir harvest,
conversation_id sibling-of-init) + spawning `agy-cli.ts` service
(concurrency-1 promise-chain queue, 300 s timeout, abort→kill,
GEMINI_API_KEY/GOOGLE_API_KEY stripped from the child env so billing can
never route to the metered API). Provider caps refs at 3 with the
fold-into-prompt message, buckets width/height onto agy's 8-aspect set
(log-distance nearest), stages base64 refs as temp files (+`--add-dir`),
output always JPEG with SOF-parsed real dimensions. Injected
`AgyCliBridge` keeps image-engine free of main imports (local-SD
prepare-hook precedent). (2) Setup card on AI Models → Image
(`GeminiCliSetupCard` + `useGeminiCliStatus`): detect
`%LOCALAPPDATA%\agy\bin\agy.exe`, auth probe = `agy models` exit 0,
install command + manual sign-in instructions (app never automates OAuth),
window-focus re-probe with 60 s throttle, force-probe "Check again";
becoming ready broadcasts `vidtsx:image-providers-changed` so the Image
Studio provider list updates without remount. One `IMAGE_CLI_STATUS`
channel returns a status LIST. (3) Plumbing two-wide for the deferred
MiniMax/mmx provider: type union `'gemini-cli' | 'minimax-cli'`,
`INSTANCE_IMAGE_PROVIDER_IDS` filter (settings-save drops CLI ids),
engine register() rejects CLI types with a registerInstance pointer.
(4) ZERO bespoke safety code — the engine's fail-closed `runGuarded`
chokepoint covers the provider (log-verified: output classified before the
complete event). Usage logs ride the generic handler path (provider
`gemini-cli`, $0). (5) NF14 smoke-catch: agy hangs forever on an open
stdin pipe — spawn now uses `stdio: ['ignore','pipe','pipe']` (the ps1
never hit this because PowerShell hands agy the console's stdin).

### V1 BUILD ORDER Slice 5 — CONTENT SAFETY ENFORCEMENT SHIPPED (2026-08-26)
**`docs/CONTENT_SAFETY_DESIGN.md` Rev 1 plan implemented as written (Rev 2
records the results), commits NF8–NF12. Gate-green per commit (948 tests,
+70 new; type baselines 26/22 exact); CDP-verified live: prompt block in
the real Image Studio UI, Content Safety page with persisting counters, and
one full Gate B round trip (input-ref check → real provider generation →
output check, classifier warm in its own process).**
(1) **Gate A** (NF8): curated `generation-blocklist.ts` — 1,264 terms
re-tagged from the 4,571-term list by sexual/nudity/pornography INTENT
(profanity/slurs never block), +22 sexualized-minor additions, −33
language-blind collisions (tr `am`, `sperm` whale, `kinky` hair, SEGA,
katakana Kant…); normalizer hardened (NFKC, Cyrillic/Greek homoglyphs,
separator-lookahead fix, no-space-script boundaries for zh/ja/th);
engine-chokepoint guard on `imageEngine` + hooks on fal video submit and
both local sd queues; typed `ModerationBlockedError {gate, category}`
destructured to `blocked?` on IPC responses, message = the D5 renderer
copy. Curation review artifact handed to Hasan (his pruning pass open).
(2) **Gate B** (NF9): self-exported fp16 Marqo ONNX (11.4 MB, sha256
868c759f…, parity drift 7.7e-4, export script committed; bundled via
extraResources as the documented download-on-first-use exception);
onnxruntime-node 1.24.3 direct pinned dep, packaged CPU-only (DirectML
stripped, linux never ships); `runGuarded` covers img2img/multi-ref INPUTS
before any provider call and every output; NO guard installed = generation
refused (fail-closed); local SD results classified before the complete
event, blocked files unlinked; decode via nativeImage with ffmpeg
image2pipe/png fallback (trimmed Remotion ffmpeg has no rawvideo muxer);
undecodable = blocked. (3) NF10: video sampling — 2 fps via `-r` (no fps
filter in the trimmed build) + first/middle/last anchors + native-res
center-crop pass ≥3000px, any frame trips → clip blocked; wired into the
fal save path and local Wan; both capture write sites classify the PNG
before it reaches the library. (4) NF11: always-visible `safety` sub-tab
(AI screen) with policy copy, classifier state + sha, and local blocked
counters (settings KV, NOT ai-usage; one CONTENT_SAFETY_STATUS channel);
policy clause in agent prompt + shot contract + appended main-side for
flows; **LLM-hook-absence CI test** pins D4 (engine/llm-handlers/
tsx-engine/stt/agent/captions reference no gate symbol). (5) NF12: eval
harness (`scripts/content-safety-eval.mjs`, dev-only) + 12-image agy SFW
starter set: Marqo 11/12 pass (margins ≤0.086; one FP: anatomy textbook
diagram p=0.859, accepted recall-greedy), **OR-ensemble REJECTED** (xs
flags 6/12 SFW portraits/swimwear/flat → FP 8.3%→58.3%), **bands frozen
0.8/0.2**. The walk caught a real bug fixed in NF12: sherpa-onnx's older
onnxruntime.dll poisons per-process DLL resolution, so the classifier now
runs in an Electron **utilityProcess** (own DLL space) instead of a worker
thread — fail-closed held throughout (generation refused, never passed).
NOT yet live-proven: a real cloud video generation + captures against the
gate (piggybacks Hasan's testing pass); full ~500-image eval re-run before
the public flip; confirm the `support@vidtsx.com` placeholder mailto in
`ContentSafetyContent.tsx`.

### V1 BUILD ORDER Slice 4 — USAGE-TRACKING FIX SHIPPED (2026-08-22)
**`docs/NEXT_FEATURES_DESIGN.md` Q4 (build-order row 4), commits NF6+.
Gate-green (878 tests, +6 new; type baselines 26/22 exact); CDP-verified
live against real historical usage data.** Closes the gaps: before this,
only LLM + image generation logged (image at $0 flat), STT and fal video
nowhere. (1) `AiRequestType` += `'stt' | 'video'`; `AiFeatureSource` +=
`'transcription'`. (2) STT logs in `transcribeAudioFile` — the funnel ALL
three callers share (Transcribe screen, Studio asset-transcriber, auto-cut;
the design named the IPC handler but the service-level chokepoint covers
auto-cut too, which bypasses that handler); cost = new informational
`pricePerHourUsd` on `STT_CATALOG` entries (from their own priceText:
AssemblyAI 0.21/0.21/0.15, Scribe 0.22, whisper-1 0.36; local + unpriced
= $0) × `result.duration`. (3) fal video logs in `getVideoJob`'s completed
path (`requestType: 'video'`, featureSource `'flows'`, wall-clock via new
`submittedAt` on TrackedJob); cost = new `pricePerSecondUsd` on
`VIDEO_MODEL_CATALOG` (kling 0.08, veo-3-fast 0.15, hailuo 0.045, seedance
0.03 — web-verified; wan-2.5 deliberately unpriced, rate varies by
resolution). (4) Image cost: `priceUsd` on `ImageModelCatalogEntry` +
shipped defaults (nano-banana-pro 0.15, nano-banana-2/seedream 0.04,
flux.2-pro 0.03, CF flux-1-schnell 0.0006/klein 0.015/dev 0.05) read via
`getDefaultImageModelPriceUsd` — looked up from the SHIPPED defaults at
logging time because `sanitizeEntries` strips user catalog edits to
id+name, so user overrides can't lose prices; × images returned. All price
fields are documented as informational estimates — the provider bills, we
chart. (5) Chart metric toggle **Tokens | Requests | Cost** end-to-end:
`AiUsageMetric` type → `getChartRows` also selects cost_usd →
`getChartData(period, filter, metric)` → chart IPC `metric?` param →
`useAiUsage` metric state → toggle in `AiUsageChart` beside the period
picker (dynamic title, $-formatted y-axis + tooltips). Log table needed
nothing (columns generalize, as designed). (6) `handleImageProviderTest`
now logs (featureSource `'provider-test'`, priced) — the LLM/image test
asymmetry closed. No DB migration (TEXT columns); ring buffer stays 10k.
6 new tests: chart metric aggregation ×3 (vi.mock'd db — first ai-usage
service tests) + price-lookup ×3. Live-verified via CDP: toggle switches
title/axes ("Estimated Cost Over Time", $1.32–$5.29 from real prior LLM
entries), Requests view surfaces all four providers' lines. NOT yet
live-proven: actual stt/video entries appearing (needs a real transcription
/video run — piggybacks on the same manual passes already queued for
slices 2–3).

### V1 BUILD ORDER Slice 3 — CLOUDFLARE WORKERS AI IMAGES SHIPPED (2026-08-22)
**`docs/NEXT_FEATURES_DESIGN.md` Q2 (build-order row 3), commits NF4+.
Checklist recommendations approved by Hasan (token = secret credential,
account id = plain settings field); gate-green (872 tests, +6 new; type
baselines 26/22 exact); smoke-launched + CDP-verified in the real app.**
Third cloud image provider, by the fal/OpenRouter checklist, with the
two-credential wrinkle: `ProviderCredentials.cloudflare` holds the **API
token** (rides the existing safeStorage blob) while the **account id** is a
plain `cloudflareAccountId` settings value — carried on the providerKeys
get/save IPC (it's not a secret, so it round-trips to the renderer), edited
in a field under the key input in the new ApiKeysSection row, and injected
into the runtime `ImageProviderConfig.accountId` at registration only (never
persisted inside `imageProviders`). New `@shared/providers/cloudflare`
client POSTs `accounts/{id}/ai/run/{model}` and **sniffs the response
Content-Type** to normalize both output dialects to `GeneratedImage.base64`
(flux/leonardo JSON-base64 vs SD/SDXL raw binary) — so user-added catalog
ids work with zero per-model output metadata. `CloudflareImageProvider`
keeps per-model *input* dialects: flux-1-schnell = JSON prompt-only (no size
params), lucid-origin/sdxl-lightning = JSON + clamped width/height, flux-2
klein-9b/dev = multipart form (even prompt-only) with `input_image_0..3`
Blobs for image-to-image/multi-reference (verified against CF's changelog
curl examples). One run = one image → loops for `numImages`. 429/neuron
errors map to a "daily free tier exhausted (10k neurons/day, resets 00:00
UTC)" message. Default catalog (`provider-model-defaults.ts`, user-editable
as usual): flux-1-schnell (default, ≈170 free images/day), flux-2-klein-9b,
flux-2-dev, lucid-origin, sdxl-lightning. Existing red-circle `imageTest`
flow works as-is (row has the flag; test IPC gained a draft `accountId`
override; Test button also gates on account id presence). Engine
registration skips cloudflare when either credential half is missing. 6 new
provider tests (stubbed fetch): JSON dialect + URL/auth shape, binary
dialect + dimension clamping, multipart multi-reference form fields,
free-tier 429 mapping, unsupported-operation refusal, numImages loop. NOT
yet live-proven: a real generation needs Hasan's CF token + account id
(enters via the new Providers row → Test).

### V1 BUILD ORDER Slices 1+2 — AUTO-SAVE HARDENING + ELEVENLABS STT SHIPPED (2026-08-21)
**`docs/NEXT_FEATURES_DESIGN.md` Q10 + Q3 (build-order rows 1–2), commits
NF1–NF3. Checklist recommendations approved by Hasan; both slices gate-green
(866 tests, +22 new; type baselines 26/22 exact).**
**Slice 1 (Q10, NF1)**: (a) Quit-flush — `useStudioProject` gained `flush()`
plus `beforeunload`/window-`blur` listeners, and a main-side close guard
(`ipc/flush-guard.ts`, installed in `createWindow`) that defers the first
window close over a `studio:flush:request` push until the renderer acks
(`studio:flush:ack`) or 1.5 s passes; `OpenProjectContext` acks instantly
when no project is open so non-Studio closes stay instant. (b) Rotating
snapshots — new `snapshot-store.ts`: `<project>/snapshots/project.<ISO>.json`
(colon-free stamps, atomic tmp+rename, NEVER under cache/), written on
project open (deduped by newest-stamp ≥ updatedAt) and by the save handler
whenever the newest snapshot is >10 min old (saves only happen while editing,
so no idle timer); retention = newest 20 whole + older thinned to newest per
UTC day (`selectSnapshotsToPrune` is pure + tested); file names are
pattern-validated before becoming path segments. (c) "Restore version…" —
project name in the editor toolbar is now a menu button (FloatingMenu) →
`RestoreVersionDialog` (two-step inline confirm, CDP-drivable `data-*`
hooks); restore flushes first, main snapshots the current state (the undo
path), writes the snapshot as project.json, and the renderer swaps the doc +
resets the timeline reducer (undo history dies with the replaced document —
by design; the safety snapshot is the way back) + success toast carries an
Undo action that restores the safety snapshot. 12 new snapshot-store tests
(round-trip, dedupe, staleness, retention incl. same-day collapse, traversal
refusal, corrupt refusal). NOT yet live-proven: one manual pass (close
mid-edit → reopen intact; restore → undo restore) is worth doing.
**Slice 2 (Q3, NF2)**: ElevenLabs Scribe v2 as a fourth STT provider, by the
checklist: `SttProviderType`/`TranscribeEngine` += `'elevenlabs'`,
`ProviderCredentials.elevenlabs` (rides the existing safeStorage blob),
has-key plumbing, ApiKeysSection row, engine registration + `stt-init` seed
(`defaultModel: 'scribe_v2'`), catalog `elevenlabs/scribe-v2` (~$0.22/hr;
wordTimestamps + speakerLabels + audioEvents — the catalog's first audioEvents
user; **verbatimDisfluencies deliberately OFF** until proven on Raw Footage
Test audio, so AssemblyAI stays the auto-cut pick). Provider is ONE
synchronous multipart POST (`xi-api-key`, global fetch + FormData — the
codebase's first multipart upload) on pre-extracted audio; `words[]` filters
`spacing`/`audio_event` entries (events only narrow the per-run features
snapshot); diarized runs derive utterances from speaker runs (speaker change/
pause/sentence/length breaks) so segment speakers work without native
utterances. The design's "zero consumer change" claim was FALSE for the
Transcribe screen — its three provider-name branches (hasKeys state,
cloudKeyPresent chain, missing-key copy) are now generalized via a new
`STT_PROVIDER_LABELS`; Studio's picker needed nothing (capability-gated), and
`StudioAssetTranscript.engine` widened to record `'elevenlabs'` honestly
(asset-transcriber, optimistic patch, Inspector label). 10 new provider tests
(vi.stubGlobal fetch — first provider-level STT tests): word filtering,
multipart shape, auto-detect, speaker mapping, feature narrowing, 401 copy,
detail-message surfacing, utterance grouping. NOT yet live-proven: a real
Scribe v2 run needs Hasan's ElevenLabs key (enters via the new Providers
row); the verbatim A/B on Raw Footage Test audio then decides
`verbatimDisfluencies`. Usage logging stays out of scope (that's slice 4).

### SHOT_QUALITY COMPLETE — Q4b scripted capture SHIPPED + Slice-1 leg proven (2026-08-21)
**`docs/studio/SHOT_QUALITY_DESIGN.md` Rev 6 / `ASSET_LIBRARY_DESIGN.md` Rev 4
(L6b), commits SQ26–SQ29. Every slice of the shot-quality plan is now built
and live-verified; leftovers are the v2 ledger.**
Opened by walking the last unproven Slice-1 leg (Creator-save → v(n+1) →
Studio version picker) live on end-card: append-only save, both heads-up
toast variants, picker shows the new version without flipping activeVersion,
folder-as-truth drop after delete. The walk caught two defects, fixed +
re-verified live (SQ26): the code editor's 500 ms auto-save wrote IN PLACE
into Studio shot versions (now buffer-only there; Ctrl+S = new version;
Overwrite hidden), and the library's Studio section served a stale "newest"
between window focuses (now rescans on open/expand/save). Then **Q4b**:
`capture_scripted` — typed steps (navigate/wait/scroll/type/click/capture,
zod discriminated union), agent-authored strings never execute as page code,
partial-stills-with-named-failure, 10 s/step + 120 s/script caps, hidden
window only — over a new shared `capture-window.ts` hardening used by both
capture paths (SQ27); new tool + allow-list + when-to-script skill text with
the two-source rule (SQ28); cookie-banner-dismissal guidance after the A/B
(SQ29). **A/B: one ask → 9-step script → 3 labeled stills of
learnwithhasan.com (top/mid/bottom) → `homepage-walkthrough` kit
BrowserWindow shot over the real states, 0 fix attempts, 96 s; placed via
propose_shots, applied as one undo step, undone cleanly.** Stills:
`scripted-capture-ab-report.html` (local, untracked). Ledgered: visible-mode
scripting, script-builder UI, timeline-aware placement positions.

### SHOT_QUALITY Slice 4 — STYLE MEMORY (Q6) + REFINE (Q5) SHIPPED, live-proven (2026-08-21)
**`docs/studio/SHOT_QUALITY_DESIGN.md` Q5 + Q6 (Rev 5), commits SQ20–SQ25.**
Opened by proving Slice 3's two remaining legs: (i) **kit export RENDER** —
published-guide v5 range-exported 0–8 s; entry dir got
`studio-entry-<pid>-kit-1.0.0/` with the specifier rewritten, render
completed first try (8.06 s, 1080p30); (ii) **agent-driven browser shot** —
one ask produced a `fullPage` capture (6453×9882) and a kit
BrowserWindow walkthrough shot, 0 fix attempts. Then the slice:
(a) **Q6a** — brand-filtered rule/profile memories inject into every shot
generate/regenerate as a `## Learned style` section beside the brand
contract (`composeShotStyleMemory`, 2000-char budget, profile drops first,
rules never silently dropped); proven via sidecar section list AND the
regenerated intro-title v3 whose entrance code cites the rule. (b) **Q6b** —
skill + system-prompt capture triggers (repeated edit instructions,
reasoned rejections, regenerate patterns → gated `propose_memory`; silent
inference stays rejected); rule proposals can be `brandScoped` — main
stamps the project's brandId, never the agent. (c) **Q6c** — new gated
`propose_style_promotion` tool + card: agent names the evidence (no hard
counter), proposal shows the resulting styleNotes size and what it
displaces under the 2000 cap; accept = one click doing brand write + memory
retire in one handler (recomposed against a fresh brand read). Live-proven
end-to-end: the agent promoted the seeded rule citing this session's real
shots; brand.json carries it, memory retired. (d) **Q5 Refine** — Inspector
button beside Regenerate: 3 stills through the **export-parity path**
(`renderShotStills`: synthetic one-clip timeline → createExportEntry → same
kit pin/bundle → `renderStill`), stills + brief + brand + learned rules
through ONE `editTsxPipeline` vision pass (its dormant `images` option,
first user), new `refine` op folds renderer-side like edit. Live: one click
on published-guide v5 → v6 in ~110 s with a 7-point critique that caught
the known tilt flaw (6.4°→4.2°), the cropped headline, the shadow band,
amber overuse, AND applied the learned no-overshoot rule. Stills + verdicts
in `style-memory-refine-ab-report.html` (local, untracked). Automatic
refine rounds stay ledgered until cost/quality says otherwise.

### SHOT_QUALITY Slice 3 — THE KIT (Q4) SHIPPED, A/B-proven (2026-08-21)
**`docs/studio/SHOT_QUALITY_DESIGN.md` Q4 (Rev 4), commits SQ10–SQ18.**
Shots can now import `@vidtsx/kit`. (a) **The pack** at
`resources/shot-kit/core/` (kitVersion 1.0.0): the **navigable
BrowserWindow** flagship (typed URL → loading state → page reveal → scripted
scroll → navigate again, pages = capture stills, cursor + click ripples),
VSCodeWindow + CodeEditorPane + ImageViewerPane, TerminalWindow,
GenericWindow, TypedText, AgentFeed + AgentInputDock, StatBlock, EASINGS —
brand-scrubbed to a `theme` prop, no icon/font library deps, plus the
MANIFEST the prompt cites verbatim. (b) **Delivery**: `kit-bundler.ts`
esbuild-bundles the pack (react/remotion external → virtual URLs) and the
module server serves `/virtual/vidtsx-kit.js`; the transpiler maps the
specifier via `VIRTUAL_SHIM_PACKAGES`; shot lint gained exactly ONE
allowlist entry (subpaths still rejected — tested). (c) **Export pinning**
(`shot-kit-pin.ts`): first accepted kit-importing version snapshots the pack
into `<project>/kit/<version>/` (write-once, folder-as-truth — no
project.json field, no autosave race); the entry copy step copies the
snapshot beside the shot copies as `studio-entry-<pid>-kit-<version>/` and
rewrites the specifier; the sweeper learned prefix-matched directories.
(d) **Prompt/skill**: KIT section (manifest verbatim, craft → KIT →
exemplars → contract ordering), `browser-walkthrough` kit exemplar replaced
`two-stage-statement`, make-tsx skill teaches screencast briefs +
`fullPage: true` captures ("tall viewport" already existed as fullPage).
(e) **SQ10 pre-A/B fix**: `v*.debug.json` records the composed system
prompt + sha256 + section list — which found the slice's real bug:
(f) **SQ17**: the VERIFY step ran on the bare mode checklist and silently
"fixed" contract-compliant shots — stripping kit imports and rewriting
`durationInFrames` → `durationInSeconds` — since D6. It now reviews under
the appended caller contract. **A/B on "Published guide" (same brief ×4,
0 fix attempts each): manifest alone → ignored (v2); prompt hardening →
model re-implemented `const BrowserWindow` locally (v3, v4); + verify fix →
v5 imports the kit, real captured page inside real chrome with scripted
scroll, `kit/1.0.0/` pinned, live Player renders through the virtual
module.** Stills in `kit-slice-ab-report.html` (local, untracked). Driven
end-to-end via CDP (occlusion flags + restore-minimized recipe held).
NOT yet live-proven: export render of a kit shot (pinning is unit-tested;
worth one manual export pass), and the agent-driven browser-shot flow with
fresh fullPage captures.

### SHOT_QUALITY Slice 2 — QUALITY LAYER A SHIPPED, A/B-proven (2026-08-20)
**`docs/studio/SHOT_QUALITY_DESIGN.md` Q3a–Q3d, commits SQ6–SQ9.** What the
pipeline model reads got three upgrades, all prompt/resource-side: (a) an
**exemplars pack** at `resources/shot-exemplars/core/` — six brand-scrubbed
finished shots, two per kind, each ≤120 lines and contract-compliant (titles
drive the injected WORDS block; react+remotion imports only; seconds×fps
timing), packaged exactly like caption packs and loaded per kind by
`shot-exemplars.ts` (corrupt/missing → degrade to none, never a failed
generation); (b) a **craft block** (stagger discipline, easing families,
spatial rhythm, density ceilings, one accent per beat, hold-layout,
exit-clean) that — with the exemplars — opens `buildShotExtraInstructions`
BEFORE every variable section, so the prompt prefix stays cache-friendly;
(c) the make-tsx skill's brief grammar is now **storyboard-grade**: content →
regions (proportions) → beats quoting exact transcript cue words → density/
motion intent, with span-anchoring the default for cutaways/overlays too.
**Q3d honesty gate PASSED** — intro title + end card regenerated live on
"Raw Footage Test" (claude-subscription, one pass, 0 fix attempts each):
the title went from a flat word stream to a three-line composition with a
96 px payoff line and disciplined accent use; the end card kept its layout
(same brief) but gained damped-to-rest motion and proper stagger. Median
moved → kit slice (Q4) is next and worth its scope. Layer A never touches
the fake-screencast gap — as calibrated.

### SHOT_QUALITY Slice 1 — CONTINUITY + LINKED FOLDER SHIPPED, live-proven (2026-08-20)
**`docs/studio/SHOT_QUALITY_DESIGN.md` Q1 + Q2, commits SQ1–SQ4.** Written
after the raw-footage E2E test stranded a session's generated shots from the
agent. (a) The agent request now carries the registry snapshot; `list_shots`
reads it and `propose_shots` places any READY registry shot — shots from
earlier sessions are proposable again. (b) `shot-reconcile.ts` scans `shots/`
against the registry on project open + window focus: gate-passing orphan/
dropped-in folders are adopted through the D14 gate onto the shot job-event
stream (toast), convertible failures land in the existing Convert-for-Studio
banner, and failures are never minted as registry entries. (c) The Assistant
transcript persists per project (`agent-chat.json` beside project.json,
write-behind, corrupt-set-aside; replay capped at the last 30 exchanges; ↺ is
now "New conversation" with rotate-keep-3; the context-usage warning counts
only the replay window). (d) The Creator library gains a **Studio** section —
a live view of every Studio project's shot folders (`studio-shot-library.ts` +
`StudioShotsSection.tsx`); saves into a Studio folder are append-only
(overwrite redirects to v(n+1), next number = MAX existing version) with an
open-project heads-up toast. Live-proven on "Raw Footage Test": a planted
Creator comp drop-in was adopted on open (toast + registry + pool), the agent
listed all nine pool shots via `list_shots`, the transcript file appeared
after the turn, and the Creator section listed 4 projects / 8 shots.
NOT yet live-proven: the Creator-save→v(n+1)→Studio-version-picker loop
(unit-tested only) — worth one manual pass. MotionScreen/TsxJobsContext were
deliberately untouched (parallel-session dirty files).
**Next: Slice 2 (Layer A exemplars + briefs + craft block, then the Q3d A/B
regen on Raw Footage Test).**

### V1 Phases G + H — COMPLETE, live-session acceptance PASSED (2026-08-17)
**The H6 gate below is closed.** All shipped providers have now executed for
real in-app: keys entered via the Providers UI, one Studio agent turn each on a
transcribed project, all landing in ai-usage with non-zero cache reads
(openrouter / minimax / kimi; Z.AI was cut from V1 on 2026-08-17 — the shipped
set is five presets). The in-app leg caught and fixed two bugs: kimi had no
key-entry row (`LLM_ONLY_IDS`), and a fresh OpenRouter shared credential never
enabled the LLM provider (plus a latent bug where any LLM-row save dropped
credential-backed providers from the engine until restart — the save path now
re-runs `initLLMEngine()`). G7 memory acceptance passed all five legs on
claude-subscription, including a both-directions counterfactual (toggle
off/on in a cleared conversation). Details: `V1_RELEASE_PLAN.md` H6/G7 + the
2026-08-17 session-log row. **Remaining for V1: licensing flip checklist +
Phase E hardening (rotate root `.env` keys before the repo goes public).**

### V1 Phase G + H — PLANS GRILLED, REVISED, DECIDED (2026-08-16)
**Status: DESIGN ONLY — no feature code. `docs/studio/AGENT_MEMORY_DESIGN.md`
§Rev 2 + Phase G/H/Q6 in `V1_RELEASE_PLAN.md`.**

**DECISIONS TAKEN (Hasan, 2026-08-16), after the grill below:**
- **V1 ships six `agent-sdk` presets and nothing else** — `claude-subscription`,
  `claude-api`, `zai`, `minimax`, `openrouter`, and **`kimi` (new)**. Kimi is
  Anthropic-native (`https://api.moonshot.ai/anthropic`, model `kimi-k3`, auth
  via `ANTHROPIC_AUTH_TOKEN` with `ANTHROPIC_API_KEY` unset) and `buildEnv()`
  at `claude-provider.ts:71-89` already does exactly that — so it is **one
  preset row, zero new code**. `openai` and `gemini` move to **V2**, where they
  need real tool-translation layers (likely dedicated SDKs), not preset rows.
  The custom-endpoint form is flagged off for V1 (H5), so **V1 is one engine
  path** with tools + caching everywhere and nothing shipped degraded — which
  cuts H3 almost entirely.
- **NEW GATE (H6)**: the ai-usage DB shows `claude-subscription` is the **only
  provider that has ever executed in this app** (27 runs, 2026-08-11→16). The
  other five are config assertions, not evidence. Each needs one real agent
  turn (text + a tool call + non-zero cache read) before release; any that
  fails ships hidden. `openrouter` first — its `baseURL` has no `/anthropic`
  suffix, unlike every other routed preset, and nothing here proves it answers
  in Anthropic shape.
- **`MAX_ACTIVE_RULES = 50`, `MEMORY_PROMPT_BUDGET = 7000` chars** (was
  25/4000, originally an impossible 40/2000). Rationale: the two skills already
  inject **10,508 chars every turn**, so a 7,000-char memory block is the
  smaller half of what already ships. The review trigger changed with it — the
  risk at 50 is **instruction dilution, not cost**, and no token metric will
  show it; a dilution spike (pad to 40 rules, re-check adherence) should run
  before G ships.
- **Skills question answered** (§Rev 2.9): the migrated clean-cut flow **is** a
  real skill file and is editable in a packaged build (`extraResources`, not
  inside `app.asar`) — but edits need a restart (`clearSkillCache()` exists and
  is called by nothing) and the *workflow* half is still hardcoded in
  `studio-agent-prompt.ts`. Memory and skills are the same mechanism; memory is
  the user-facing one, skill editing is a developer affordance. Backlogged.
The open question was whether agent memory is worth building at all, so it got
tested before it got built. A throwaway harness (`.vidtsx-temp/`, gitignored)
drove `query()` with **the same options object `claude-provider.ts:151-174`
builds** — string systemPrompt, `settingSources: []`, a real in-process MCP
server — on `claude-opus-5`, against the real agent prompt + both real skill
files. 4 arms × 3 runs, all 12 clean.
**Injection works, decisively**: a one-line user rule ("never propose fluff
cuts") suppressed fluff in **9/9** runs where the baseline proposed 2 every
time (**3/3**); a note-format rule hit **36/36** vs the baseline's **0/13**.
It also *reduced variance* — the memory arm produced an identical cut-category
sequence all three runs where the baseline produced three different ones.
**Capture triggers correctly untuned**: `propose_memory` fired exactly once on
a general preference (**3/3**) and never on a one-off (**3/3**), even when the
one-off was the kind of pacing instruction that invites a mis-file.
**Citation is prose, not a signal**: the agent cites reliably (**9/9**) and
reads well, but mapping "your standing rule says never propose fluff" back to a
memory id is fuzzy matching — my own scoring regex, written against a known
fixture, missed a plainly-worded citation. So **`lastCitedAt` is cut**, and
with it the staleness-pruning story and M4's most dangerous cache rule.
**Verified in code, changing two design claims**: the Studio agent passes no
`sessionScope`, so `generate()` takes the ephemeral branch and every turn
already spawns and tears down its own claude.exe — `matches()`'s systemPrompt
check never runs, so accepting a memory mid-conversation costs exactly one
cache write (M4's stance holds, for a different reason). And the SDK exposes
**no** mid-conversation system message (`SDKUserMessage.message` is a
`MessageParam`); the real mechanism is `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`,
recorded and deliberately not taken. A string `systemPrompt` is passed
verbatim with no SDK preamble, so M4's caching premise is sound — but
`composeSystemPrompt` appends skills *after* base, so **memory must be appended
last** or every edit re-writes 10.5 KB of skill text out of cache.
**Cut from G**: `lastCitedAt`, brand-scope UI (field + pure filter stay, so
there is never a migration), the Assets memory section (→ one Studio dialog —
memory is app state, not library content, by M7's own argument), the
"replaces →" picker, profile-as-list. **Fixed**: budget 2000 chars vs cap 40
rules never fit (~3,200 chars of rules) → **4000 / 25**, with a stated review
trigger.
**Phase H's premise moved**: `CustomProviderForm` lets users create
`openai-compat`/`anthropic-compat` providers, so **both compat engine paths
ship whether or not the `openai` preset is hidden** — hiding narrows the
*supported* surface, not the reachable code (new H5 decides this on purpose).
H2's rule is now one line: **filter `presets`, never `providers`** — the local
filter at `llm-handlers.ts:32-38` drops saved configs too, which is right for
`local` and exactly the bug to avoid here. Second stranding vector named:
per-project `settings.agent.providerId` can leave the Inspector select blank
while the project keeps sending that provider every turn.

### Studio — L2/L7 LIBRARY DESCRIBE + ORGANIZE (2026-08-16)
**Status: DONE — per ASSET_LIBRARY_DESIGN.md §L2 + §L7, CDP-verified end to
end INCLUDING a real vision batch, a real organize pass, and a real
hash-heal.** The slice is built around **L7 Rev 2's move-safety rule**, not
around the move plan.
**THE RULE**: a Studio project references library files IN PLACE by absolute
path, and the hash-heal only runs on project OPEN — so moving a file out from
under a live session breaks it until the next open. Organize therefore never
proposes assets the currently-open project references; they return as
`skipped` ("in use, close the project to move"), **not** as rejected
proposals, because nothing about the suggestion was wrong — only its timing.
The exclusion is keyed by **rel path AND content hash**, so a project whose
stored path already went stale still pins the bytes. Enforced **twice**: at
suggest, and again at APPLY, since the user can open a project between
reviewing a plan and accepting it and the renderer is not the authority on a
safety rule. A skipped asset does **not** reserve its destination against
another move.
**Confirmed already-shipped, deliberately not rebuilt**: the hash-search half
(`studio-handlers.ts:211-228` → `healed` folded in at `useStudioMedia.ts:169`),
manual description editing, and the index re-key — `scanLibrary` already
re-keys a moved file by hash and carries its description
(`library-reconcile.ts` pass 2), so `applyMoves` is `fs.rename` + ONE re-scan
rather than a second, divergent re-key implementation.
**Knowing what's open** crosses a feature boundary (`asset-library` and
`studio` must not import each other), so it lives in a renderer-level
`OpenProjectContext` (ToastContext precedent): Studio publishes, Assets
reads. Screens stay mounted, so a project stays genuinely open while curating.
**Descriptions (L2)**: vision call on the **app-default provider** (curation
has no project context — a fixed rule). Batch describe copies the media-job
engine — broadcast stream, per-item progress, concurrency 3, **per-item
failure isolation** (one bad PNG fails one asset, never the batch). Batch
**fills gaps, never overwrites** an existing description. Auto-describe on
import is ON for library imports only; project footage goes through the
Studio media pool and never reaches this path. The one-time consent (Rev 2)
is enforced **in main** — a batch is refused until it exists. No provider
(Rev 3) is a first-class state: both AI buttons disable with an explaining
tooltip, a dismissible note says why descriptions and folders matter, and
manual descriptions keep working. Availability re-probes on window focus and
on Refresh — this screen never unmounts, so a provider configured later in
Settings would otherwise stay invisible until restart (found while driving
the app; fixed in this slice).
**Modules**: `library-prefs` (consent/dismissal/import default, read straight
from the settings KV like `library-paths` — settings.ts is a parallel
workstream), `describe-availability`, `describe-asset`, `describe-job`,
`organize-plan` (PURE — the in-use rule lives and is tested here),
`organize-suggest` (prompt + tolerant parse, pure), `organize-run` (the LLM
call), `organize-apply` (disk moves, split out so they carry none of the
provider import chain), `library-ai-handlers`, and 6 IPC channels.
**Tests +55 → 683 total** (in-use exclusion by path and by hash, skipped ≠
destination-reserving, protected `brands/` and `.vidtsx/`, collisions and
no-ops discarded, real disk moves + re-key with the description carried and
NO tombstone, apply-time refusal, describe failure isolation, cancel,
non-image filtering, dedup, no-provider degradation, tolerant plan parsing).
Type baselines 26/22 exact. Of the updater session's dirty files only
`channels.ts` and `electron.d.ts` were touched, staged as HEAD+my-lines blobs.
**Live CDP proof**: consent dialog → real batch described 3 assets in ~7 s
with genuine "what it is + how to use it" one-liners → manual edit persists →
moved a library file behind the app's back (`captures/learnwithhasan.com/` →
`Logos/`) → opening **"Shots core test"** HEALED the path by content hash with
no picker → Organize **with that project still open** proposed 2 free moves
and SKIPPED the healed in-use asset with the exact label → rejected one move,
applied the other: file moved on disk, index re-keyed, the hand-written
description survived, no new tombstone → cleared the default provider and the
note + disabled buttons appeared while manual descriptions still saved →
provider config restored byte-identical.
**Note on the test project**: "Shots core test" is the project that references
a library asset in place; "Auto Cut Test" only points at media outside the
library, so it cannot exercise the skip.
**Reusable test state**: the library now carries a deliberately misfiled
in-use asset at `Logos/build-real-products-with-ai-vibe-enginee.png` (pinned
by "Shots core test" — re-run Organize with it open to re-prove the skip),
`captures/example.com/example-domain-shot.png` (moved by a real organize
apply, hand-written description), and `claudecode-color-2.png` at the root
(a rejected move). Describe consent is now granted on this machine.
Known limits (deliberate): organize reads at most 400 assets per pass, one
pass with no retry, and describe covers images only (the vision attachment
carries nothing else). **Ambient nudges stay v2, as designed.**
NEXT per roadmap: remaining library polish (L4/L5 agent-facing search) or the
V1 release walkthrough — see V1_RELEASE_PLAN.md.

### Studio — D14 CREATOR IMPORT (2026-08-16)
**Status: DONE — per TSX_SHOTS_DESIGN.md §D14 Rev 1 + PACKS_DESIGN.md
"tsx-template", CDP-verified end-to-end INCLUDING a real export.** The slice is
ONE source-agnostic accept path: `importShot({projectId, sourcePath, name?,
conform?})` (`main/services/studio/shot-import.ts`) takes a SOURCE FILE + a
DISPLAY NAME, copies it to `shots/<id>/v1.tsx`, runs the EXISTING gate
(`validateShotCode` = transpile + react/remotion lint + compositionConfig
parse — imports still require the config, D13's opt-out is captions-only) and
returns a ready entry. Callers are thin and interchangeable: the Creator picker
(`creator-projects.ts` scans `getProjectsDir()` for folders of `v*.tsx` →
name/updatedAt/latest version, newest first, parameterized root for tests), the
OS file picker (no `sourcePath` → main opens the dialog), and later a
tsx-template PACK folder — which is why the service never learns the Creator
exists (PACKS_DESIGN.md's door, the caption-loader precedent).
**Registry shape**: `origin: { by: 'user' }`, kind `cutaway` (an imported comp
is a standalone full-frame piece), config snapshot from the source, and NO
stored `prompt` — so Regenerate is correctly disabled ("No stored brief to
regenerate from") while Edit works unchanged. Adoption reuses the SHOT JOB
STREAM: the bus moved out of the generator into `shot-job-events.ts` (both
services publish; op gained `'import'`), so the renderer folds imports through
the same `shots-adopt` path with zero new machinery. Imports land in the pool
only — the user places them (no recorded playhead, so no handshake race).
**Conform-on-import (the allowlist gap)**: `classifyShotImport` (pure, shared)
splits out-of-allowlist imports into CONFORMABLE (chroma-js,
@remotion/shapes|paths|transitions, @remotion/google-fonts, tone — subpaths
included) vs BLOCKING (relative/absolute paths, unknown packages), and refuses
to offer conversion when a blocking import or a non-import lint error rides
along, or when the file doesn't even transpile — never burn an LLM run that
can't succeed. A conformable failure writes NOTHING and returns a pointed error
+ `conformable: true`; "Convert for Studio" re-imports the same source with
`conform: true`, which reserves the folder, writes the untouched `original.tsx`
FIRST, runs ONE `editTsxPipeline` pass whose validate dep is the same gate, and
writes v1 only if it passes (`original.tsx` is not a `v<n>.tsx`, so the version
scan, preview and export copy all ignore it).
**Tests +26 → 628 total** (conformable/blocking/dedup/dynamic-import
classification, otherErrors gating, failure-message wording, conform
instruction, name derivation incl. `v3.tsx` → folder name, Creator scan
ordering/latest-version/skips, folder collision → `-2`, original.tsx
preservation, imported-shot snapshot has no prompt/anchor/assetRefs). Type
baselines 26/22 exact. Of the updater session's dirty files only channels.ts
and electron.d.ts were touched (additive, staged as HEAD+my-lines blobs).
**Live CDP proof (Auto Cut Test, 1280×720, captions ON with core/word-pop +
brand Acme Test)**: picker listed both seeded Creator projects with the LATEST
version (clean-orbit → v2, sorted by mtime) → importing clean-orbit produced a
ready `cutaway` shot in ~1 s whose `v1.tsx` is BYTE-IDENTICAL to the Creator's
v2, placed on O1 and painted in the Player → importing shapes-badge (imports
@remotion/shapes + @remotion/google-fonts/Inter + chroma-js) wrote no files and
showed the pointed error with the Convert action → Convert ran ~20 s and passed
the gate: the triangle became an inline `<svg>` path, chroma-js a small hex
mixer, the font a `"Inter", system-ui` stack, compositionConfig untouched, and
`original.tsx` byte-identical to the source → Regenerate disabled / Apply edit
worked on the imported shot ("deep blue background" → v2, preview updated) →
**Export → Done**: ffmpeg frames at 1.5 s and 9.5 s of the rendered mp4 contain
the imported shot pixels, with the live caption line painted over the first —
imported shots and D13 captions coexist through the D6 copy path.
Reusable test state: Creator projects `clean-orbit` (v1 draft + v2 real) and
`shapes-badge` (allowlist-gap source) under the Creator projects root; Auto Cut
Test now carries both imported shots.
Known limits (deliberate): imports are always `cutaway` (no kind picker), one
conform pass with no retry ladder, conversion can shift the look, and a failed
conversion leaves an error shot the user deletes. V2 ledger unchanged: the
widened import surface (module-server import-map so shots import the Creator 2d
allowlist natively) and "open shot in Creator editor". NEXT per roadmap:
**library describe/organize (L2/L7)** — the L7 organize-skips-open-project rule
is real new scope.

### Studio — D13 CAPTIONS (2026-08-15)
**Status: DONE — per CAPTIONS_DESIGN.md (C1–C4) + PACKS_DESIGN.md, CDP-verified
end-to-end INCLUDING a real export.** Captions are **live props-derived, never
baked**: the serializer derives the word stream from the MASTER LANE at
serialize time and passes it through D12's runtime-props channel, so cutting
the master re-derives on the next serialize and nothing can desync (the D7 bake
stays what it is — a 3-second title mechanism).
**Document (C1)**: `captions?: StudioCaptionLayer` on the project
(`shared/types/studio-captions.ts` — a sibling file because the template props
are a PUBLISHED contract for pack authors); one layer, whole master lane,
absent field = no captions (no schema bump, shots-field precedent).
`normalizeCaptionLayer` on load clamps scale/wordsPerGroup/position, drops a
layer with no templateId, and **keeps an uninstalled templateId on purpose**
(reinstalling the pack must bring the captions back). The layer joined the
reducer's undoable `EditDoc` beside timeline/proposals/shots — apply / style /
disable / remove are each ONE undo step (`services/caption-ops.ts`,
identity-on-reject). Writing back deletes the field rather than storing null.
**Derivation (C2, `shared/studio/caption-words.ts`)**: master lane = the
BOTTOM-most video track with clips (new visual lanes stack on top), falling
back to the first audio lane with clips for voice-over projects. Per clip:
slice words to the visible source window (a word belongs when it STARTS inside
it), clamp ends, re-base to timeline seconds through `speed`, concat in
timeline order. Gaps simply have no words; untranscribed clips contribute
nothing and are surfaced as "N clips have no transcript". Grouping breaks on
`wordsPerGroup`, on punctuation, on pauses > 0.6 s, and NEVER across a clip
boundary.
**Pack-shaped loader (C3 Rev 2 + PACKS_DESIGN.md)**: the built-in ten ship as
ONE pack at `resources/caption-templates/core/` (`pack.json` + `manifest.json`
+ ten `.tsx`), and the loader ALSO scans `packs/` in the assets root, so a
purchasable pack is a folder drop with zero loader changes
(`main/services/studio/caption-packs.ts`, `scanCaptionRoots(builtIn, installed)`
for testability). `templateId` is namespaced (`core/word-pop`) and that is what
the document stores; duplicate pack id → whole pack skipped, first root wins;
corrupt pack / ghost template / wrong type → skipped with a warning; a missing
pack degrades gracefully everywhere. Manifest defaults are per-aspect style
SEEDS (scale + wordsPerGroup only — fields with no home on the document are
dropped, so a pack can't seed what the style can't hold).
**Rendering**: the serializer emits ONE synthetic `kind: 'caption'` track FIRST
(painted last = over everything) carrying `tsx.props.captions` = `{ groups,
style, palette }`; `ShotRuntimeProps` gained the `captions` member (one props
transport, no parallel mechanism). `TimelineComposition`'s dead `'caption'`
case now renders the supplied `captionComponent` (absent → null). Palette
resolves brand-or-override BEFORE the template sees it (templates never read
the brand system; same react+remotion-only lint as shots, with
`requireCompositionConfig: false` — an overlay has no length of its own).
`referencedShotIds` skips caption clips (its shotId is a template id).
**Export (D6 pattern)**: `loadCaptionContext` reads the master lane's
transcripts from the project cache + the active brand, the template file is
validated/font-rewritten/copied beside the shot copies, and the entry imports
it as `captionComponent`. A missing pack or a stale brand logs and exports
without captions — never a failed render.
**UI (C4)**: toolbar "Captions" entry + a third right-panel tab; gallery cards
are tiny lazy-mounted (IntersectionObserver) Players running the REAL template
over the manifest's sample words; position / size / words-per-group /
UPPERCASE / brand-colors toggle with a custom override.
**Tests +62 → 602 total** (derivation windows/re-base/speed/concat/gaps/
untranscribed, grouping breaks, master-lane pick, layer normalize + palette
resolution, pack parse/namespacing/traversal-refusal/defaults, loader
discovery/collision/ghost/corrupt/missing-root + the shipped core pack loads
with all ten, serializer emission present/absent/disabled/re-derive/not-a-shot,
caption reducer actions incl. undo/redo round-trip). Type baselines 26/22
exact. Of the updater session's dirty files only channels.ts, electron.d.ts and
electron-builder.yml were touched (additive blocks, staged as HEAD+my-lines
blobs — audit the diff, and decode git output as UTF-8 or em-dashes mojibake).
**Live CDP proof (Auto Cut Test, 1280×720, 69-word transcript, 11 master
clips)**: gallery listed all ten from the pack with animated cards → applying
Word Pop showed captions at the playhead and "58 words from the master lane"
(the EDIT's words, not the transcript's 69) → ripple-deleting the first master
clip re-derived to 53 words and a different line at the SAME timeline second
("AutoCut test." → "it flows naturally") → apply/undo/redo round-tripped →
selecting brand "Acme Test" repainted the live word from fallback amber/Inter
to the brand accent in Georgia → **Export → Done**: the entry's TIMELINE
carries 21 groups / 58 words + the resolved brand palette, the copied template
file sits beside it, and ffmpeg frames at 2.1 s and 4.23 s contain the caption
pixels matching what the preview showed at the same second. Missing-pack
degrade proven by pointing the document at `bought/neon`: project opened, panel
warned, no captions painted, layer preserved, and picking an installed style
recovered it. One export attempt failed with a Remotion compositor
"No frame found at position …" seek error; re-running with captions ON
succeeded, so it is the known compositor flake, not the caption layer.
Known limits (deliberate): one layer per project, no per-region captions, no
caption text editor (fix the transcript, captions re-derive), crossfade
overlaps interleave briefly, no store/pack-manager UI (folder drop is install
v1). NEXT per roadmap: **D14 Creator import** (TSX_SHOTS_DESIGN.md §D14 — keep
the import service source-agnostic; it doubles as the tsx-template pack door),
then library describe/organize.

### Studio — D12 MEDIA INSIDE SHOTS (2026-08-14)
**Status: DONE — per TSX_SHOTS_DESIGN.md §D12 Rev 2 + ASSET_LIBRARY_DESIGN.md
§L5/§L6, CDP-verified end-to-end INCLUDING a real export.** The serializer
grew a GENERAL runtime-props channel (D13 captions rides it next):
`SerializedClip.tsx.props?: ShotRuntimeProps` (`shared/types/studio.ts` —
extensible object, `assets` is its first member), resolved through the SAME
`AssetUrlResolver` as clip src (module-server proxies in preview, bundle
server :3100 at export — the entry needs zero template changes, props ride
the serialized TIMELINE). **Missing/unresolvable ref → clip drop**, the
missing-src rule. `ClipRenderer` spreads `clip.tsx.props`; `useShotModules`
wrappers/placeholders became props-forwarding (`ShotComponent =
ComponentType<ShotRuntimeProps>`). **Registry**: `assetRefs?:
Record<key, projectAssetId>` on `StudioShot`, sanitized in `normalizeShots`
(malformed map stripped whole), carried through `foldShot` (which silently
dropped unknown fields — extended), the generator's provisional/saved
snapshots, `StudioShotGenerateRequest`, and the regenerate button
(`ShotClipSection` passes `shot.assetRefs`). **Import-on-use seam**
(`services/studio/shot-asset-refs.ts`): tool-side ref values are project
asset ids OR `library:<relPath>`; library values import on use via
`importMediaFiles` (probe/thumbnail/hash, referenced in place, index
description carried into new `StudioMediaAsset.description`), idempotent by
normalized path then content hash; imported assets ride
`StudioShotJobEvent.importedAssets` on the FIRST generating event →
`useShotJobs.onImportedAssets` → EditorShell merges id-keyed into
project.assets. Library NEVER appears in project.json (paths point into it,
referenced in place — by design). **Prompt contract**:
`buildShotExtraInstructions` gained `assets` ("## Media assets (MANDATORY
usage)" — typed `{ assets }` prop, per-key table with dims/duration/
description, never a path/staticFile; brand+WORDS coexistence pinned).
**Agent surface** (studio-agent.ts): `generate_tsx_shot` gained `assetRefs`
(zod 4: `z.record(z.string(), z.string())` — single-arg is a compile error);
NEW `generate_image` (wraps imageEngine active provider, files into
`generated/` via new `library-filing.ts` slug/reserve helpers, born-managed
`origin: 'generated'`, prompt = description, ACTIVE-BRAND AUTO-TAG via
project.settings.brandId with stale-id degrade, bills new `featureSource:
'studio-shot-asset'`, additive/no proposal); NEW `capture_webpage`
(`services/library/capture.ts`: hardened hidden BrowserWindow — sandbox,
per-capture in-memory partition, ALL permission requests denied,
window.open denied, muted, 2× render via zoomFactor+double-size window,
settle delay, full-page = tall window capped 8000px physical; files
`captures/<domain>/<title-slug>.png`, description "title — URL"). **Visible
capture mode** for auth walls: window shows, main pushes
LIBRARY_CAPTURE_EVENT 'pending' → `CaptureChip` (app-root fixed chip, CDP-
drivable) → LIBRARY_CAPTURE_TRIGGER capture/cancel resolves it; 5-min
walk-away timeout. **Library store** gained `upsertEntry` (reconcile only
mints origin 'imported'; born-managed content enters here with hash/size/
mtime bookkeeping so the next scan keeps it — pinned by test).
`StudioAgentAssetInfo` + prompt asset lines gained `description` (Rev 2).
Of the updater session's dirty files only channels.ts + electron.d.ts were
touched (additive capture-channel blocks, staged as HEAD+my-lines blobs).
**Tests +32 → 540 total** (serializer ref resolution + missing-ref drop +
empty-refs, normalizeShots sanitize, prompt assets section, upsertEntry
CRUD/rescan-survival/traversal, filing slug/domain/description/reserve
collision, parseLibraryRef/refKey/matchExistingAsset idempotency/
buildPromptAssets audio-reject). Type baselines 26/22 exact. **Live CDP
proof (Shots core test)**: agent turn "capture learnwithhasan.com → cutaway
using it → propose" ran all three tools (labels in AgentPanel); capture
filed `captures/learnwithhasan.com/build-real-products-with-ai-vibe-enginee
.png` (2560×1440 crisp 2×, index entry origin 'captured' + title—URL
description); import-on-use put it in project.assets WITH description +
pool thumbnail; registry got `assetRefs: { screenshot: <project-id> }`;
generated v1 (claude-opus-5, 50s, 0 fix loops) destructures `{ assets }`
and renders `<Img src={assets.screenshot}>`; review panel → Preview shot
showed the REAL screenshot on a branded card in the Player; Place 1 shot →
clip at 6s on V1; **Export → Done**: entry TIMELINE carries
`props.assets.screenshot` as a :3100 bundle URL, ffmpeg frame at 8s of the
rendered MP4 contains the screenshot pixels + brand-amber caption.
Visible mode proven: example.com visible capture → chip appeared → CDP
clicked "Capture now" → `captures/example.com/example-domain.png`.
generate_image proven wired with graceful error (local SD registered but
sd-cli not installed — no BYOK image key on this machine; its filing path
is shared with capture + unit-tested). Leftovers kept deliberately: the two
captures in the library, "Site showcase" shot placed at 6s in "Shots core
test" (D13/D14 test state). Known limits (deliberate): scroll-and-stitch
over-cap fallback not implemented (cap captures top 8000px); no gate check
that generated code only references provided asset keys (prompt-enforced;
the model added a dead staticFile fallback once — harmless, serializer
drops unresolvable refs before render); `search_assets` still deferred to
library slices; MediaPool "Add from library" picker + library-screen
Capture button land with the library UI slices (the seam is the service).
NEXT per roadmap: **D13 CAPTIONS** (CAPTIONS_DESIGN.md, implementation-
ready — rides this props channel), then D14 Creator import, then library
describe/organize.

### Studio — D11 BRANDS (2026-08-14)
**Status: DONE — brands slice per TSX_SHOTS_DESIGN.md §D11 Rev 2 +
ASSET_LIBRARY_DESIGN.md §L3 Rev 3, CDP-verified end-to-end with a REAL
Claude-subscription regenerate.** App-level MULTIPLE brands at
`brands/<slug>/brand.json` inside the assets root (folder-as-truth; the
folder slug IS the brand id, reserved via `reserveProjectFolder` so name
collisions get `-2`). **Shape** (`StudioBrand`, shared/types/asset-library):
name, palette (primary/secondary/background/text/accent — CSS colors,
breakout-char-rejecting lenient validation in `shared/studio/brand.ts`),
fonts (display/body family names), logoRefs (library relPaths, consumed in
D12 — UI is a comma-list input), styleNotes (≤2000 chars, injected
verbatim). **Store** (`services/library/brand-store.ts`): CRUD against an
explicit root (temp-dir testable), atomic tmp+rename writes, corrupt
folders skipped on list, traversal-guarded ids. `defaultBrandId` in
`brand-default.ts` straight through settings-db (`studioDefaultBrandId`) —
settings.ts NEVER touched (owned by the parallel updater session; the
assetsRootOverride precedent). **Default copy at creation**:
`createProject` gained optional `brandId`; the create handler resolves the
default and validates it still exists (stale → copies nothing) — explicit
snapshot, changing the app default never restyles existing projects;
`migrateProject` spreads settings wholesale so brandId survives round-trips
(pinned by test). **Generation contract**: `buildShotExtraInstructions`
gained `brand?` — "## Brand: <name> (MANDATORY styling)" block with palette
tokens (background line flips cutaway-use vs overlay-reference), fonts as
CSS family stacks ("'Georgia', 'Segoe UI', sans-serif" — shots lint is
react+remotion ONLY, so no @remotion/google-fonts inside shots; uninstalled
Google fonts fall down the stack — v1 limit), style notes verbatim.
`shot-generator.generate()` reads `project.settings.brandId` from
project.json (like width/height/fps — agent tool AND pool button get it
with zero plumbing), `readBrand` degrades stale ids to unbranded with a
warn. Edits inject nothing (no prompt-context channel in editTsxPipeline) —
"apply the (new) brand" IS Regenerate, per the answered design. **IPC**: 4
channels (LIBRARY_BRANDS_GET returns brands + validated defaultBrandId,
BRAND_SAVE create/update, BRAND_DELETE clears a pointing default,
BRAND_DEFAULT_SET validates existence); of the updater session's dirty
files only channels.ts + electron.d.ts were touched (additive blocks,
staged as HEAD+my-lines blobs via hash-object/update-index). **UI (lean)**:
Assets toolbar "Brands" button → BrandsDialog (rows with 5 palette
swatches, fonts line, DEFAULT badge, set/unset default, edit, delete-with-
confirm; BrandForm with live swatch previews and shared-validator inline
errors); MediaPool Shots section "Brand" Select (No brand / brands /
"<id> (missing)" for stale) → non-undoable settings edit through
updateProject, the sttModelId pattern. studio-make-tsx SKILL.md gained a
Brand section (don't restate colors in briefs; regenerate to restyle).
**Tests +24 → 508 total** (validator table incl. CSS-breakout rejection,
normalize round-trip, store CRUD/slug-collision/corrupt-skip/traversal,
prompt-block snapshot incl. background flip + font fallback + WORDS
coexistence, createProject copy + migrate carry). Type baselines 26/22
exact. **Live CDP proof**: Brands dialog → "Acme Test" (ocean palette,
Georgia) → brand.json on disk verbatim; Set default → badge; New Project →
project.json carries `brandId: acme-test`; picker pre-selected in the new
project; "Shots core test" switched to the brand (persisted); Inspector
Regenerate on the Counter overlay → ~3 min real pipeline → v2.tsx defines
`COLORS` = the EXACT five brand hexes + Georgia TYPOGRAPHY (values the
original brief never contained — injection proven), player shows the navy/
serif/amber look, pool card v2 · 5.0 s; screenshots taken. Leftovers kept
deliberately: brand "Acme Test" (assets root) + project "Brand Inherit
Test" for D12 testing. Known limits (deliberate): brand-scoped
`search_assets` behavior deferred to the library slices (index brandId tags
already exist), logos not embeddable until D12 assetRefs, no
palette-from-logo/interview skill (v2). NEXT per roadmap (extended with
Hasan 2026-08-14): D12 (assetRefs, generate_image, capture_webpage — now
explicitly building the serializer-props channel), then **D13 CAPTIONS**
(CAPTIONS_DESIGN.md — implementation-ready: ~10 curated TSX templates,
live props-derived word stream, brand-aware), **D14 Creator import**
(TSX_SHOTS_DESIGN.md §D14 — conform-on-import; small, can slot into any
gap), then library describe/organize.

### Studio — LEAN CANVAS MANIPULATION (2026-08-14)
**Status: DONE — the interaction slice scheduled right after shots UI
(2026-08-14 roadmap decision with Hasan; full rotate/crop/multi-select stays
in V2_FEATURES.md), CDP-verified live with real pointer gestures.** Select a
clip → bounding box + 4 corner handles over the Player; drag to MOVE, corner
drag for uniform SCALE (opposite corner anchored); click-in-player selects
the topmost painted clip. The document side (`StudioClipTransform`,
`update-clip`, transformStyle) was untouched — this is purely the
interaction layer. **Math is a pure service**
(`features/studio/services/canvas-transform.ts`, 22 unit tests): player-rect
→ composition mapping (`fitScale`/`playerPointToComp`), `clipBox` from the
transformStyle semantics (element center = comp center + x/y, box = comp ×
scale; the box is the ELEMENT — letterboxed picture and inspector-set
rotation deliberately not represented), `moveGesture` (round + clamp
±10000), `scaleGesture` (pointer projected onto the fixed diagonal, clamp
1%–1000% — the Inspector's exact ranges — anchor recomputed so it never
drifts), `hitTestClip` (serializer paint order: tracks[0] topmost, trailing
clip over leading through crossfade overlaps, visual kinds only, hidden
tracks skipped for free by using the serialization), and
`overrideClipTransform` (live-preview injection). **`CanvasOverlay.tsx`**
mounts via a new PreviewPanel `overlay` slot (absolute inset-0 over the
aspect box so its own rect IS the player rect, ResizeObserver-tracked);
window-listener drag (the PaneDivider pattern), rAF-throttled; box shows
only when ONE visual clip is selected AND the playhead is inside its span
AND the track is unlocked/visible AND the Player shows the real timeline
(`playerTimeline === tl.timeline` — hidden during Preview result; never in
an export by construction). **Undo discipline:** drags live-preview through
an ephemeral serialized override in EditorShell (zero reducer dispatches per
pixel — CDP-proven: inspector still read 0/0 mid-drag), ONE `update-clip` on
pointer-up; `updateClip`'s identity check makes no-op gestures free.
**PreviewPanel restructure:** the aspect box no longer clips (Player moved
into an inner rounded overflow-hidden div; the PANEL clips instead) so a
box dragged past the frame edge keeps its handles reachable over the
letterbox — beyond the panel (~16 px + letterbox slack) handles clip and the
Inspector numbers are the fallback (canvas zoom is V2). Box clicks are NOT
swallowed: a non-drag click inside the box falls through to the root
hit-test so a clip painted ABOVE the selected one stays click-selectable
(drag-end clicks guarded by a justDragged ref). **Live CDP proof (real
`Input.dispatchMouseEvent` gestures, shots-core-test + Test projects):**
box appears exactly over the frame for identity transform and matches
committed offsets; move drag (−40,−25) player px → inspector −101/−63 (the
predicted comp-px rounding, fit 0.3977); SE-corner drag to 70% → scale 70,
x −293 / y −171 (closed-form match), NW anchor drift 0.0 px; first Ctrl+Z
reverted ONLY the scale, second ONLY the move; picture followed live
mid-drag with the button still down; box absent for: audio clip (via detach
→ auto-selected A1 clip → undone), playhead outside span (two cases),
nothing selected; click-in-player switched selection V1 → topmost FX1
overlay per paint order. Gates green: 484 tests (462 + 22), type baselines
26/22. Known limits (deliberate, lean): no rotate/crop/multi-select/
snapping (V2), box ignores inspector-set rotation, handles unreachable past
the panel edge, overlay hit-box for tsx overlay shots is the full comp
element (transparent pixels included). NEXT per roadmap: D11 brands, then
D12 (assetRefs, generate_image, capture_webpage), then library
describe/organize.

### Studio — S4 SHOTS GENERATION (2026-08-14)
**Status: DONE — third S4 shots slice (D8 + D7 + D6 + D10 per
TSX_SHOTS_DESIGN.md Rev 4), verified live with REAL Claude-subscription
generation over CDP.** Main-side `shot-generator.ts` drives the shared
`generateTsxPipeline`/`editTsxPipeline` with the shot ACCEPTANCE GATE
injected as the pipeline's `tsxValidate` dep — esbuild transpile + the
react/remotion-only single-file import lint (`shared/studio/shot-lint.ts`)
+ a `compositionConfig` PARSE check — so a lint/config violation is a
fix-loop error the pipeline repairs, never the parser's silent 300-frame
default. Main writes ONLY `shots/<id>/v*.tsx` (+ debug sidecars +
`chat.json`); the registry lives in the renderer document via push events
(`STUDIO_SHOT_JOB_EVENT`) folded by `useShotJobs` through the
non-committing `shots-adopt` — an edit's version bump is the one undoable
dispatch (`shot-set-version`). **D8 agent path**: `generate_tsx_shot`
(one shot per call, 10-per-pass cap, refuses while a review is open) +
`propose_shots` (ONE `shot-plan` proposal, built by shared
`buildShotPlanProposal`, source-anchored items); `get_transcript` gained
`startSeconds`/`endSeconds`; skillIds now compose `studio-make-tsx` (new
folder skill: briefs/anchors/pass discipline/from-scratch) next to
clean-cut; system prompt carries the shots workflow + plan-cheap gate +
FROM-SCRATCH mode (Rev 4). `reviewOpen` is now KIND-AGNOSTIC
(`useTimeline.activeProposal` dropped its cut-plan filter;
`handleAgentProposal` and the reviews branch by kind; CutRegionLayer
renders for cut plans only). **D7**: anchored shots bake the anchor
span's words to shot-local seconds into the prompt (`shot-words.ts`,
marked WORDS block; anchor recorded on the shot; regenerate re-bakes).
**D8 pool path**: `STUDIO_SHOT_GENERATE` IPC (reservation handshake via
`onReserved`, then detached; ops generate/edit/regenerate) — playhead
recorded at click, clip lands there on ready as ONE undo step
(`shot-clip-insert` + `insertShotClip`), selected. **From-scratch rule**
(no footage anywhere): shots land on the MASTER lane as opaque cutaways —
proposals back-to-back in order, pool inserts too. **D6 export (the "tsx
renders as NOTHING" fix)**: `createExportEntry` pre-flights every
referenced ready shot (re-validate + lint + config parse → pointed error
BLOCKS the export), copies each source font-normalized
(`rewriteFontUrls`) into the entry temp dir as `studio-entry-*` (swept by
the same TTL), and emits static imports + a `SHOT_COMPONENTS` map passed
as `components` (emission helpers pure in `shared/studio/shot-export.ts`).
**D10**: MediaPool "Shots" section (status/progress/version badges, add
at playhead, delete, Generate form → pool path), `ShotClipSection` in the
Inspector (anchor readout, folder-scanned version picker via
`STUDIO_SHOT_VERSIONS`, edit box → editTsxPipeline, Regenerate, "Resize
clip to shot length" via trim), `ReviewShotsSection` (accept/reject +
"Preview shot" scratch-apply audition that derives the REAL landing spot
by running applyShotProposal on a scratch copy). 48 new unit tests
(import-lint allow/reject table, anchor→shot-local word math incl.
boundary/clamp/rounding, export emission for exactly the referenced ready
shots, proposal build + reducer apply/reject round-trips incl.
registry-drop-on-reject + restore-on-undo, from-scratch placement,
pool-insert). Gates green: 462 tests, 26/22 type baselines. **Live CDP
proof (real Claude subscription provider)**: pool Generate → provisional
card with streaming percent → ready in ~75 s → clip at the playhead on
the master lane (from-scratch), stat-card pixels in the Player with the
counter overlay compositing on top; inspector edit box ("42 → 99…") →
v2 in ~20 s with the edit visibly applied, undo/redo flips
activeVersion 2→1→2; agent chat → generate ("Thanks End Card") →
`shot-plan` proposal → ReviewShotsSection → audition plays the shot at
its future landing spot → "Place 1 shot" → clip at 3–6 s back-to-back,
origin {agent, proposalId}, proposal `applied` (and the open proposal
SURVIVED a full app reload mid-review); export prepare → entry with 3
static shot imports (active versions pinned, error shot excluded) +
components map + normalized copies; hand-corrupted shot (lodash import)
→ export BLOCKED with "Shot "Thanks End Card" (v1) failed export
validation: Import "lodash" is not allowed…"; full render queued and
completed to `studio-shots-core-test_*.mp4`. NOT in this slice: D11
brands, D12 assetRefs/generate_image/capture_webpage (next per design
order), bulk-pass live drill (unit-covered; needs a transcribed longform
project). Known wart: pool-path shot names are slugged briefs (no name
field in the pool form yet). NEXT per roadmap: lean canvas manipulation,
then brands/capture/curation.

### Studio — EDITOR ERGONOMICS (2026-08-14)
**Status: DONE — resizable panes + track-menu discoverability, requested by
Hasan after shots core; CDP-verified live through the real input pipeline.**
Three draggable pane dividers (`PaneDivider`, window-listener drag — the
Creator's ResizableDivider pattern; pointer capture dies the moment the
cursor leaves a 5 px strip): media pool width (160–420), inspector width
(220–460), timeline height (140–520). Sizes persist per machine via
`usePaneSize` → localStorage `studio.pane.*` (deliberately NOT settings KV
or the document — it's window state); defaults match the old fixed layout
exactly. Track options were *functional but invisible* (right-click worked
only on the narrow header cell — verified live, not a bug): now a kebab
(⋮) button on each header (hover-revealed) opens the same menu, AND
right-clicking empty lane background opens it too (`onLaneContextMenu` →
TimelinePanel-owned FloatingMenu; menu items unified in
`services/track-menu.ts` so header + lane can't drift; lane-menu Rename
forwards to the header's inline editor via a `renameRequested` prop).
`TimelinePanel` takes `heightPx`. Live proof (real
`Input.dispatchMouseEvent`): timeline 240→300→400 by drag, pool 230→290,
both restored after reload from localStorage; kebab menu opens; lane
right-click menu opens; Delete removes the track and Ctrl+Z restores it
(4→3→4). Gates green (414 tests, 26/22). **CDP harness gotcha learned: a
`Page.reload` kills `Input.*` event routing on that WebSocket session —
reconnect after every reload or synthetic input silently no-ops.**
**Roadmap decisions recorded this session (with Hasan):** (1) lean canvas
manipulation (move/scale clips directly in the Player) scheduled right
after shots UI D10 — full rotate/crop/multi-select in V2_FEATURES.md; (2)
D8 gains a from-scratch mode (TSX-only videos, no raw footage) — Rev 4
note in TSX_SHOTS_DESIGN.md; full generative end-to-end (image/video
models + TTS + SFX) ledgered in V2_FEATURES.md.

### Studio — S4 SHOTS CORE (2026-08-14)
**Status: DONE — second implementation slice of S4 TSX shots
(TSX_SHOTS_DESIGN.md D1/D4/D5/D9), CDP-verified live.** The document grew
the shot registry: `StudioShot` + required `StudioProject.shots[]`
(normalized to `[]` on load — no schema bump; `migrateProject` would
otherwise DROP the field, it rebuilds from an explicit list), and
`StudioClipTsx` reshaped to `{ shotId, mode }` (the `filePath` stub is
gone; nothing ever wrote it). **D5 contract**: `SerializedClip.tsx
{ shotId, mode }`; serializer drops tsx clips whose shot is missing or not
`ready`; tsx clips carry real `sourceIn`/`trimBefore` semantics applied by
`ClipRenderer` as a nested `<Sequence from={-trimBefore}>` — and for tsx
the crossfade-in shift is NOT clamped at 0 (negative offset keeps the
shot's frame 0 anchored at the original boundary so baked timings can't
fire early). **D4 preview**: `STUDIO_SHOT_MODULE` IPC
(`{projectId, shotId, version}` → `{moduleUrl, config}`; path authority in
main via `getShotVersionPath` with shot-id validation; `transpileTsxCached`
+ module server, content-hash URL = automatic re-import on version bump),
renderer `useShotModules(projectId, shots)` (loads every ready shot's
active version, `setupVirtualModuleGlobals()` before first import,
`shotId@version` cache), each component wrapped in `ShotErrorBoundary` +
labeled placeholder — preview supplier only, per design. **D9**: `EditDoc`
grew `shots` (commit identity check, `proposal-apply` literal, reset,
EMPTY_DOC, write-back all carry it); actions `shot-set-version` (undoable
pointer flip), `shot-remove` (registry entry + referencing clips, ONE undo
step, files stay on disk), `shots-adopt` (non-committing: rewrites
past/present/future so a background generation completing neither plants
an undo step nor gets wiped by one); reconcile-on-open flips crash-stuck
`generating` → `error` in `normalizeShots` (shared/studio/shots.ts, used
by main's migrate). Also: `clipFromShot` in clip-factory (`sourceIn: 0` is
load-bearing for split continuity). New files: `shared/studio/shots.ts`,
`main/ipc/studio-shot-handlers.ts`, `features/studio/hooks/useShotModules.ts`,
`features/studio/components/ShotErrorBoundary.tsx` (class — the sanctioned
boundary exception), `features/studio/services/shot-ops.ts`. 21 new unit
tests (normalize/reconcile matrix, tsx serialize incl. negative-trimBefore
crossfade case, shot ops + reducer round-trips incl. shots-adopt history
rewrite). Gates green: 414 tests, 26/22 type baselines. **Live CDP proof**
(seeded `shots-core-test` project, frame-counter shot): shot renders in
the Player frame-synced (playhead 1.00s → counter 30); `sourceIn: 2` clip
shows 90 at 6.00s (offset mechanics); a REAL UI split at 2s produced a
right half that continues (90 at 3s, `sourceIn: 2` persisted — restart bug
would read 30); stuck-`generating` shot flipped to `error` in the saved
doc and its clip dropped from preview while staying on the timeline; a
runtime-throwing shot rendered the labeled placeholder with the app fully
alive, and recovered after fix + reopen. NOT in this slice (say-so per
plan): D8 generation/proposals/`studio-make-tsx` skill/pool button, D7
word-sync bake, **D6 export wrapper + pre-flight — a tsx clip currently
renders as NOTHING in an export** (entry passes no `components`), D10
pool/inspector shot UI, D11 brands, D12 assetRefs props channel — next
slices per the design order.

### Studio — S4 LIBRARY CORE (2026-08-14)
**Status: DONE — first implementation slice of the S4 asset library
(ASSET_LIBRARY_DESIGN.md L1/L2-manual/L4/L7-relink), CDP-verified live.**
The Assets screen (existing `asset-library` feature) now carries the index
overlay: `<assetsRoot>/.vidtsx/index.json` (disk-as-truth, dot-folder kept
out of the grid), entries keyed by POSIX relPath with `hashFileHead`
content hashes — new files gain entries, Explorer-moves re-key by hash
(description survives, proven in tests + live), deletions tombstone for
7 days and resurrect on re-import of the same bytes. Manual descriptions:
right-hand details panel (type/size/origin/added/path + textarea, saved on
blur, optimistic with rollback). Search over name+description with type
chips (All/Video/Audio/Image/Other) — breadcrumb is the scope, root =
whole library; sizes per folder (tile subtitles) + footer totals, cached
with invalidation on index writes. Assets-root settings override
(`assetsRootOverride` in the settings KV; `library:root:get/set` IPC —
read via settings-db directly, NOT settings.ts, which the parallel updater
session owns; fold a typed accessor in later). **L7 move-safety rule
shipped**: `studioMediaPrepare` now hash-searches the library for missing
sources and heals paths silently (renderer merges via `healed[]`; manual
picker stays the fallback). New: `src/main/services/library/*` (paths,
pure reconcile, store, sizes), `library-handlers` + registration, preload
`libraryApi`, `shared/types/asset-library.ts` (NOTE: `types/library.ts`
was already taken by the Creator project library), renderer
`useLibraryIndex`/`AssetSearchBar`/`AssetDetailsPanel`/`asset-search`.
19 new unit tests (reconcile matrix, store+sizes on temp dir with
Explorer-move + stale-index heal, search filters). Gates green (393
tests, 26/22 type baselines). NOT in this slice (design order): describe
jobs + no-provider nudge, brands, capture, organize, origin/brand filter
chips, probe backfill — next slices per the design docs.

### Studio — S4 TSX SHOTS: DESIGN REVIEW OPEN (2026-08-14)
**Status: DESIGN WRITTEN, AWAITING HASAN'S REVIEW — no implementation.**
`docs/studio/TSX_SHOTS_DESIGN.md` (same pattern as TRANSITIONS_DESIGN.md):
decisions D1–D10 with options + recommendations and an inline-answerable
checklist. Core recommendations: `shots[]` registry in the document with
clips referencing `shotId` (replaces the `filePath` stub — safe, no tsx clips
shipped); cutaways cover from an upper lane (never displace the master);
title = word-synced overlay skill category; preview via live in-renderer ESM
modules sharing the app's React/Remotion (error-boundary containment); export
via static shot imports in the generated entry (react+remotion import
allowlist, pre-flight validation); baked shot-local word timings + recorded
anchor for regenerate re-sync; generate-then-propose `shot-plan` proposals
through the existing audit gate; per-shot `activeVersion` for edit/regenerate
round-trips. One implementation spike flagged: confirm the bundler's TSX rule
compiles files outside the app path before locking the entry shape.
Implementation starts after review.

**Rev 2 (same day, after live discussion with Hasan):** D5/D7/D8 amended
(shot asset props resolved by the serializer, bulk shot passes with a
chat-plan gate + 10-shot cap, brand/asset injection into generation);
D11 brands + D12 media-in-shots added (checklist now 13 items). Two new
docs: `docs/studio/ASSET_LIBRARY_DESIGN.md` (disk-as-truth library +
index.json, AI describe/organize behind the audit gate, brands with
default, search/filter/sizes, web capture via hidden Electron window —
no Playwright; checklist L1–L8) and `docs/studio/V2_FEATURES.md` (parked
ledger: screen capture, optimize/compress, local fonts, fake-screencast
port, props-driven word sync, …). Scope decision: v1 = full library +
professional TSX generation; web capture only (screen capture v2).
Implementation order: library core → shots core → brands/capture/curation.
UX walkthrough artifact published (claude.ai). Both design docs awaiting
Hasan's checklist answers.

**Rev 3 (same day, after adversarial grill — self-review + blind
code-review agent, at Hasan's request):** 8 substantive findings fixed
across both docs. Headline: the D4 preview "in-renderer precedent" was
dead code (webview path is the only exercised consumer; packaged builds
load file:// with webSecurity on) → **Spike 0** (packaged-build ESM import
into an in-app Player) now runs FIRST and gates the preview architecture,
bake-to-proxy promoted to named fallback. Also fixed: tsx clips gain
sourceIn/frame-offset semantics (split restarted the animation; a
crossfade-in shifted baked word timings by the extension); shot proposal
items are source-anchored, renderer-mapped (frozen timelineStart was
stale-by-design and main has no timeline); reject keeps files (no file
deletion under any undoable action); reviewOpen goes kind-agnostic (one
open proposal across all kinds); export pre-flight copies +
font-normalizes shot sources (wrapper only rewrites the entry file);
shots↔EditDoc/undo integration enumerated (generation completion is
non-committing); library relink-by-hash re-scoped as NEW work (today's
relink is a manual picker), hashFileHead pinned as the shared algorithm,
organize skips in-use assets; capture hardened (tall-window capture,
permission/window.open denies); library deletion policy + describe consent
added. Verified good news: Remotion's webpack .tsx rule has no
include/exclude — out-of-root shot files compile (spike closed by reading
the shipped config; superseded by the copy step anyway). Docs now at
TSX_SHOTS_DESIGN Rev 3 (checklist 14 items) / ASSET_LIBRARY_DESIGN Rev 2.

**DESIGN PHASE CLOSED (2026-08-14): both checklists ANSWERED by Hasan in
chat — all recommendations accepted.** Shots #5: react + remotion only.
Two library amendments folded in as ASSET_LIBRARY_DESIGN Rev 3: (a) the
library extends the app's EXISTING `asset-library` Assets screen over
`userData/assets` (a new Studio-pool tab was wrong; assets root gains a
settings override for disk-space freedom; brands live at `brands/` inside
the assets root, visible in the screen); (b) describe degrades gracefully
with no AI provider — imports never block, a dismissible note explains why
descriptions matter, manual entry always works.

**Spike 0 VERDICT: PASS (2026-08-14) — preview Option A confirmed.** In a
packaged win-unpacked build (renderer on `file://` out of app.asar,
`webSecurity: true`), the renderer dynamic-imported a transpiled TSX module
from the module server (`http://127.0.0.1:3200/modules/<hash>.js`), mounted
it in an in-app `<Player>`, and the module's `useCurrentFrame()` matched the
host Player's frame EXACTLY on 20/20 samples over 4 s (e.g. t=205ms both 5 …
t=2806ms both 83) — shared React/Remotion instances work across the origin
boundary; the virtual `remotion`/`react` module imports crossed cleanly too.
No CORS, CSP, or module-resolution errors in the renderer console (the app
ships no CSP; the module server already sends `ACAO: *`). Bake-to-proxy
(Option B) stays a dormant fallback — not activated. Evidence + method:
invoke-only harness `window.__runSpike0(tsxPath)` in
`src/renderer/spike0-harness.tsx` (installed from `main.tsx`, inert until
called; drive via CDP per `docs/ui-automation-cdp.md`, works in packaged
builds via `--remote-debugging-port`). Verified in dev first, then in
`dist/win-unpacked`. NEXT: **library core** → shots core →
brands/capture/curation.

### Studio — post-gate POLISH MINI-SESSION (2026-08-14)
**Status: COMPLETE — the three papercuts the stability gate surfaced are fixed
and CDP-verified live; §15 performance spot-checks run on Hasan's real DJI
session concatenated to one 27.4-min 4K/60 HEVC file. Gates: 374 tests green,
type baselines held at 26 web / 22 node. S4 is next.**

1. **Render-start freeze fixed**: `@remotion/bundler`'s webpack compile now
   runs in an Electron utilityProcess (`src/main/services/bundle-worker.ts`,
   new electron-vite main entry) — it was blocking the main-process event loop
   for seconds (and calls process.chdir, so worker_threads couldn't host it).
   Progress/errors stream back over the port; dev CLI fallback kept. New
   `RenderPrepChip` in the Studio toolbar shows "Preparing render… n%" from
   queue-add until frames start. CDP-verified: chip within 1 s of clicking
   Export, IPC round-trips 2–60 ms through the entire bundle+prep.
2. **Proxy progress**: ffmpeg `-progress pipe:1` + total duration parsed from
   ffmpeg's own stderr banner → whole-percent events through the existing
   StudioMediaJobEvent channel (transcript pattern) → "Proxy n%" chip + 2 px
   bar on the pool card. Ticks stay in transient renderer state; the document
   only sees status changes. Verified climbing live on the 27-min import.
3. **Cache visibility**: per-project cache footer on the browser card — size
   readout, Open in Explorer, two-step Clear (`cache-manager.ts` + 3 IPC
   channels). Clear aborts the project's running media jobs first (Windows
   file-lock), restores the scaffold; browser-only placement so a clear can't
   hit an open editor. Sizes matched disk byte-for-byte.

§15 verdicts (recorded in TESTING.md): transcript 27.4 min → ready in ~75 s
(AssemblyAI, 2,258 words) — very acceptable; timeline responsive under two
concurrent ffmpeg jobs (drag rAF median 34.8 ms, playback 16.7 ms); editor
idle CPU 0.00 s over 10 s; proxy on 4K/60 HEVC WITHOUT NVENC projected
multi-hour — new backlog item: hardware DECODE (d3d11va/qsv) for proxy inputs.
§15 agent-pass item still open (transcript only 2,258 words, under the 5k
threshold).

### Studio — STABILITY GATE PASSED (2026-08-13)
**Status: COMPLETE — Hasan's guided manual pass over every remaining human item
in docs/studio/TESTING.md, including the §13 S3 exit test on real multi-take
DJI footage: auto-cut (37 proposed) + editorial pass both applied → 26 clips,
every join flush to 1e-6 s, export v 68.9333 s / a 68.9920 s (delta = AAC frame
padding, not drift), A/V sync clean by ear at the last cut (1:03.4). S4 opens
after a short polish mini-session.**

Verified by ear/eye this session: §10.4 auditions (all clean) · §8 complete
(AssemblyAI real recording, whisper download + offline, re-transcribe
round-trip, wrong-key error) · §9.2 plan honesty on real footage · §11.1
editorial pass + chat memory + plain question + stop button + second-pass
refusal · §14.1/14.2 network kills · §7.3 decided (park at end).

Fixed/built during the gate (all test+type gated):
- **slam-1 retirement**: AssemblyAI removed the model; catalog now Universal
  (auto → universal-3-5-pro + universal-2) with pinned entries and a legacy
  alias; provider special-cases dropped; 401/403 now reads "AssemblyAI rejected
  the API key — check your AssemblyAI key in Settings."
- **Transcript UX**: Engine picker stays visible when Ready; new Reset button
  (blocked while a review is open).
- **Editorial Pass button** (Inspector → Assistant handoff): one-click entry
  into the agent with full chat transparency; disabled without a transcript /
  during review / while busy.
- **Context warning**: Assistant estimates next-turn context (transcripts +
  chat vs a conservative 128k budget) and banners at ≥40% pointing at the
  existing ↺ Clear.
- **Black-flash fix**: `premountFor` on clip Sequences — joins are seamless in
  preview (export was never affected).
- **Playhead parks at end** after playback (`moveToBeginningWhenEnded={false}`).

Deferred with reasons (in TESTING.md): §11 Local-Models refusal (no local
model installed), §13.5 GIF/WebP (N/A — Studio export is hard-coded h264/mp4),
§15 long-file perf (tail of the polish session). Backlog logged: render-start
freeze, proxy progress bar, cache visibility UI, Studio format picker, agent
timeline-read tool, optional persistent chat.
**Status: COMPLETE — 22 machine-checkable items from §1–§14 driven live via
CDP, ZERO app bugs found; matching items annotated ✎ in TESTING.md so Hasan's
manual gate shrinks to the genuinely human checks (ears at joins, real
multi-take footage, the §13 S3 exit export, network-failure paths)**

Run on throwaway seeded projects (deleted after); `autocut-test` exercised for
the Auto Cut → Reject-all round-trip and restored byte-identical.

- Verified: neighbour clamp flush-stop · edge-trim bounds incl. the 0.04 s
  floor · split contiguity · an 11-op mixed chain (split/trim/move/paste/
  marker/ripple-delete/duplicate) undone to an identical timeline · lock
  blocks drag/trim/delete/paste · Hide drops picture / Mute silences the lane
  live · frame/second arrow steps, Home/End (End parks on the last frame) ·
  zoom anchored on the playhead (0 px drift) · Space guard in inputs · snap
  toggle on/off · gap playback (black + audio continues) and clean
  end-of-timeline stop · Auto Cut → review → Reject all → timeline untouched ·
  no selection/marker bleed across project switches · remove-asset-with-clips
  undo is orphan-safe · autosave force-quit loses only the debounce window,
  JSON intact · history cap: 130 ops → exactly the last 100 undo · corrupt
  project.json skipped by the browser · full relaunch identity · cache-wipe
  regeneration · project create + two-step delete to the Recycle Bin.
- One behavior observation (not a bug): after playing past the end, the
  playhead parks back at 0 — Remotion's `moveToBeginningWhenEnded` default.
  Flagged in §7.3 for Hasan; set the prop to false if end-parking is wanted.
- Two automation gotchas recorded in docs/ui-automation-cdp.md: a MINIMIZED
  window freezes rAF and `Page.bringToFront` won't restore it (use user32
  SW_RESTORE first), and Remotion's pooled shared `<audio>` tags mean
  audibility must be asserted via `paused`, not tag counts/volume.
- No source changes — docs only.

### Studio — core-parity Session 6: Slice F (media relink) (2026-08-13)
**Status: COMPLETE — live CDP verification across three app launches (TESTING.md
§16.8 ticked); no schema changes (consumes the `hash` media-import has written
since S2); core-parity plan FINISHED → next is Hasan's full TESTING.md pass,
then S4**

Sixth and final session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **Missing detection.** `studioMediaPrepare` now `fs.access`es every
  asset path; unreachable ones come back in a new `missing: string[]` and
  their proxy/waveform jobs are skipped (ffmpeg would only fail). The renderer
  keeps missing-ness as environmental state in `useStudioMedia` — deliberately
  NOT in the document (it describes this machine, not the project).
- [x] **UI.** Missing pool cards get a red border + "Missing" overlay with a
  visible "Locate…" button; timeline clips whose asset is missing render a red
  warning tint + border with a "source file missing" tooltip
  (EditorShell → TimelinePanel → TimelineLanes → TimelineClip threading).
- [x] **Relink IPC.** New `STUDIO_MEDIA_RELINK` following the full
  channels/types/handler/registration/preload/electron.d.ts pattern (the last
  one by hand — new channel). Main opens the native picker (or takes
  `filePath` — the mismatch-retry, and `VIDTSX_RELINK_PICK` env stands in for
  the dialog in automated runs, documented in docs/ui-automation-cdp.md),
  verifies the pick's first-1MiB+size sha1 against the stored `asset.hash`,
  re-probes on success, and returns `{ path, probe, hash }` for the renderer
  to merge. Hash mismatch → renderer-built confirm card (CDP-able, like every
  dialog in this app): Cancel or "Use anyway" (override re-probes and rewrites
  the hash so the NEXT relink checks against reality).
- [x] **Cache survival.** Proxies/waveforms/transcripts are keyed by asset id,
  so they ride through untouched; the prepare effect keys on `id:path` so a
  relink re-runs detection and only regenerates what's absent.
- Live CDP (throwaway "relink-test" project + fixture copies, deleted after):
  launch 1 generated caches; launch 2 (file renamed away) showed the full
  missing UI with jobs skipped, a wrong-content pick raised the mismatch card
  (Cancel inert; override merged with re-probe 40.07 s → 2.07 s + new hash);
  launch 3 relinked the true moved file instantly — no prompt, stored hash
  verified equal, proxy mtime unchanged (no regeneration), waveform still
  drawn, document path updated and autosaved.

### Studio — core-parity Session 5: Slice E (transitions: crossfade · dip-to-black) (2026-08-13)
**Status: COMPLETE — design doc first (docs/studio/TRANSITIONS_DESIGN.md), then
unit-tested (17 new tests, 374 total) + live CDP click-through incl. a real
export; schema addition: optional `transitionOut` on StudioClip (no version
bump, old projects open untouched)**

Fifth session of `docs/studio/CORE_PARITY_PLAN.md` — the model-risk slice, so
the design was written down before the code (review it in TRANSITIONS_DESIGN.md).

- [x] **Model.** `transitionOut?: { kind: 'crossfade'|'dip-to-black', duration }`
  on the LEADING clip; valid only while the next clip on the track starts
  exactly at its end (1e-6 s). The document never stores an overlap.
- [x] **Invariant enforcement — reducer-level prune.** The ops do NOT all
  funnel through `withTrackClips` (group ops + applyCutProposal build tracks
  inline), so validity is enforced once in `useTimeline`'s commit path:
  `pruneTransitions` drops any transition whose boundary an edit just broke,
  in the SAME undo step, preserving identity-on-reject. Every current and
  future op inherits it. `splitClip` is the one case prune can't see (halves
  stay contiguous) — it moves the field to the right half explicitly, like the
  fade stripping. Ripple deletes that land clips flush KEEP the transition
  (that's what a ripple means); serialize re-checks contiguity itself because
  loaded documents never passed through the reducer.
- [x] **Render.** `serializeTimeline` builds the overlap: crossfades extend the
  leading clip `duration/2` past the cut and start the trailing one early,
  each side clamped to its source handles (`trimBefore` shifts by
  `ext × playbackRate`; images/tsx unlimited; zero handles both sides → hard
  cut). New `transitionIn/Out { kind, frames }` on SerializedClip;
  `TimelineComposition` draws the ramps — trailing clip opacity 0→1 (it paints
  on top; DOM order = track order), equal-power audio (cos/sin) for
  crossfades, linear to silence for dips — composed with gain × fades in
  `volumeProp`. Dip needs no extension: opacity+volume V to zero at the cut.
- [x] **Ops + reducer.** `transition-ops.ts`: `setTransition` (rejects on
  gap/locked/unknown; clamps duration to both clips), `removeTransition`,
  `pruneTransitions`. Actions `transition-set`/`transition-remove`, one undo
  step each (preset re-pick = replace in place = one step).
- [x] **UI.** `TransitionJoins`: a small square at every contiguous boundary on
  unlocked tracks (accent-filled when set, tooltip shows kind + duration);
  click opens a `FloatingMenu` with Crossfade/Dip × 0.5 s/1 s presets +
  Remove. Numeric duration editing deferred (v2, Inspector).
- Live CDP run (seeded throwaway "transition-test", deleted after): preview at
  the crossfade cut read opacity 0.5 / volumes 0.707+0.707 and the dip cut
  0/0; export (420 frames exactly — transitions never change length) showed a
  half-transparent incoming picture at the cut and a pure-black dip frame; dip
  audio >90 % attenuated inside the ramps; split handed the dip to the right
  half; Backspace-delete pruned + single-undo restored; ripple-delete kept the
  crossfade on the collapsed join.

### Studio — core-parity Session 4: Slice D (markers + range export) (2026-08-13)
**Status: COMPLETE — unit-tested (20 new tests, 357 total) + live CDP click-through
incl. a real frame-accurate range export (TESTING.md §16.6 markers line + §16.7 ticked);
schema addition: optional `markers` on StudioTimeline (no version bump, old
projects open untouched)**

Fourth session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **D1 pure ops.** New `services/marker-ops.ts` (timeline-ops stays at 285
  lines): `addMarker`/`moveMarker`/`removeMarker`/`renameMarker`, all
  identity-on-reject, times clamped ≥ 0, list kept sorted by time, and a
  timeline with zero markers has NO `markers` key so old documents round-trip
  byte-identical. Reducer actions `marker-add/-move/-remove/-rename`, one undo
  step each (add ids minted by the caller, like paste).
- [x] **D1 UI.** M drops a marker at the playhead (text-entry + visibility
  guards respected); `RulerMarkers` draws diamonds on the `TimelineRuler` —
  click = seek, drag = move (3 px threshold, commit on release = one undo
  step), double-click = inline rename popover, right-click = FloatingMenu with
  Rename/Delete. Labels render next to the diamond. Markers persist through
  autosave and were verified across a renderer relaunch.
- [x] **D2 range state.** I/O keys set `rangeIn`/`rangeOut` at the playhead
  (Shift+I/O clears the point) — component state in `EditorShell`, session-only,
  never in the document. Ruler shows the highlighted span between the points
  (a lone point draws a bracket); "Export range" appears in the toolbar only
  when the points span ≥ 1 frame.
- [x] **D2 range export.** `studioExportPrepare` request grew optional
  `rangeIn`/`rangeOut` seconds (electron.d.ts needed no manual change — it
  references the shared type via `import()`). Main trims the document with the
  new shared `trim-range.ts` (`trimTimelineToRange`): edges snapped to the
  frame grid FIRST (cumulative-rounding rule), clips cut like a split
  (head cut advances `sourceIn` + drops fade-in, tail cut drops fade-out),
  markers filtered+shifted — then serializes the result, so `serializeTimeline`
  stays the single source of truth. The render length is exactly
  `frame(out) − frame(in)` (`rangeDurationInFrames` override on
  `createExportEntry`), so a window past the last clip renders trailing
  black/silence like every NLE.
- Live CDP run (seeded throwaway "range-test" project, deleted after): all
  marker gestures + undo steps verified in the DOM; range span at exact px;
  real export → ffprobe 5.033333 s / 151 frames == frame(7.533) − frame(2.5)
  exactly; audio envelope corr 0.871 vs the matching source span (−0.62 vs a
  control span); boundary frames matched the source.
- Note: a stale parallel-session buffer had pre-written the same handler edit
  and left a duplicate import in `studio-handlers.ts` mid-session — reconciled
  by re-reading everything from disk before the gates.

### Studio — core-parity Session 3: Slice C (audio fades + detach audio) (2026-08-12)
**Status: COMPLETE — unit-tested (8 new tests, 337 total) + live CDP click-through
incl. a real export (TESTING.md §16.2 fully ticked + §16.4 completed);
schema addition: optional `fadeInSec`/`fadeOutSec` on StudioClip (no version
bump, old projects open untouched)**

Third session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **C2 spike first (as planned).** Remotion `<Audio src={videoFile.mp4}>`
  plays a video's audio track in preview AND in renderMedia — proved with a
  seeded throwaway project whose audio clip pointed at the video asset with a
  DIFFERENT source span than the muted video clip: the export's envelope
  correlated 0.879 with the audio clip's span and 0.25 with the video's.
  Decision: no ffmpeg audio-extract cache needed; detach reuses the asset.
- [x] **C1 fades.** `fadeInSec`/`fadeOutSec` (timeline seconds) with one
  invariant — both ≥ 0, sum ≤ duration, fade-in wins — enforced by
  `clampFades` in timeline-ops and re-applied by every duration-changing op:
  end/start trims, `setClipSpeed`, and `splitClip` (left half keeps only its
  fade-in, right half only its fade-out, stripped BEFORE clamping so the
  discarded fade can't eat the budget — keeps splits inaudible). Fades ride
  `ClipPatch`/`update-clip` (one undo step per commit). Serialize emits
  `fadeInFrames`/`fadeOutFrames` (rounded, re-clamped after quantization);
  `TimelineComposition.volumeProp` builds gain × ramp callbacks for BOTH
  `<OffthreadVideo>` and `<Audio>` (Remotion's volume callback receives the
  clip-relative frame — trimBefore cancels out via useFrameForVolumeProp, and
  playbackRate does not scale it).
- [x] **C1 UI.** Fade in/out numeric fields in the Clip inspector section
  (audio-bearing kinds); CapCut-style top-corner fade handles on clips with
  translucent ramp wedges (SVG), dragged through the same useClipDrag
  machinery as trims — preview runs the real `updateClip`, so mid-drag you
  see the clamped truth; commit on release = one undo step.
- [x] **C2 detach audio.** `detachAudio(timeline, clipId, newId)` in the new
  `clip-update-ops.ts`: mutes the video (gain 0 — the one mute concept) and
  creates an audio clip with the same assetId/timelineStart/sourceIn/
  duration/speed (sample-aligned by construction), carrying the video's
  pre-detach gain and fades; lands on the first unlocked audio track whose
  span is free, else a fresh `addTrack('audio')` lane. One op = one undo step
  restores both sides. Right-click context menu on video clips
  (`ClipContextMenu` over the existing FloatingMenu), disabled for soundless
  assets/already-muted clips; the new clip is selected after.
- [x] **File split (over-300 fix).** `updateClip`/`setClipSpeed` moved from
  timeline-ops.ts (364 → 285 lines) into `clip-update-ops.ts` alongside
  `detachAudio`; tests moved to `clip-update-ops.test.ts`.
- Live CDP run (throwaway seeded project, deleted after): fade fields → ramp
  wedges + preview element volumes 0.5/1.0/0.5 across the ramps (audio AND
  video elements); handle drag 1 s → 2 s exactly, one undo back; detach via
  context menu → muted video + selected new A1 clip, one undo restored both;
  real export: detached span envelope-corr 0.861 vs the right source span,
  faded span corr 0.904 vs ramped source (0.732 raw), edges at 2 %/12 %.
- CDP gotcha: `FloatingMenu` is position:fixed → `offsetParent === null`, so
  the visible() filter from docs/ui-automation-cdp.md hides it — query
  `[role="menu"]` raw.

### Studio — core-parity Session 2: Slice B1 (clip inspector) (2026-08-12)
**Status: COMPLETE — unit-tested (11 new tests, 329 total) + live CDP click-through
incl. a real export (TESTING.md §16.1 fully ticked + §16.4 per-clip-mute line);
no schema changes (gain/speed/transform/label already existed)**

Second session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **Pure ops.** `updateClip(timeline, clipId, patch)` in `timeline-ops.ts`
  patches `gain` (clamped 0–2) / `label` / `transform` (field-wise merge);
  neutral values (gain 1, empty label, identity transform field) REMOVE the key
  so documents never accumulate no-op state. `setClipSpeed(timeline, clipId,
  speed)` is separate because speed changes duration: `timelineStart` stays
  put, duration = sourceSpan/speed, clamped against the right neighbour like an
  end-trim (no ripple in v1 — the UI says so); rejects when even
  `MIN_CLIP_DURATION` no longer fits. `updateClips(timeline, clipIds, patch)`
  in `timeline-group-ops.ts` for multi-select volume/mute — all-or-nothing on
  locked tracks like `moveClips`. All identity-on-reject, 11 unit tests.
- [x] **Reducer.** Actions `update-clip` / `update-clips` / `clip-speed`; the
  UI commits sliders on release and numeric/label fields on Enter/blur, so one
  committed control change = exactly one undo step (multi-select volume = one
  step for the whole selection).
- [x] **UI.** `ClipSection` at the top of the Inspector when clips are
  selected: name/track/start/length read-outs, volume slider 0–200% + mute
  (pre-mute gain remembered per clip id in component state), speed presets
  0.25–4× + numeric field with the "shortens/lengthens in place" note, opacity
  slider + position/scale/rotation numeric fields (video/image/tsx only),
  label input (empty clears). Multi-selection: "N clips selected", volume+mute
  only. Input primitives split into `inspector-controls.tsx` (~300-line rule).
- Live CDP run (autocut-test, restored to a byte-identical project.json via
  undo afterwards): volume 50% → mute → unmute walked back by 3 single undos;
  2× halved the Length readout and the clip's px width, boxed-in 0.25× clamped
  trim-like; opacity/scale/rotation/x showed up in the player `<video>`'s
  computed style; label renamed the timeline clip; multi-select volume was one
  undo step. Real export while edited: duration 26.60 s matched the sped
  timeline, muted clip's span digitally silent (WAV sample scan), extracted
  frame showed the same translate/scale/rotate/opacity as the preview.
- Note: `timeline-ops.ts` is at 364 lines — over the ~300 guideline because
  the plan pins both new ops to this file; split candidate for a later pass.

### Studio — core-parity Session 1: Slice A (playback rate · copy/paste · timeline QoL) (2026-08-12)
**Status: COMPLETE — unit-tested (7 new tests, 317 total) + full live CDP click-through
(TESTING.md §16.3 / §16.6 / §16.9 ticked); no schema changes**

First session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **A1 — global preview playback rate.** `PLAYBACK_RATES` [0.5, 1, 1.5, 2]
  as `EditorShell` state (session-only, never in the document); rate button in
  the `PreviewPanel` transport cycles up, Shift+click cycles down; wired as the
  `playbackRate` prop on the `@remotion/player` `<Player>`. Auditions pin 1×:
  `playSpan` (Play removed / Play join) sets an `auditioning` flag cleared when
  the audition crosses its stop marker OR on manual pause (so an abandoned
  audition can't leave the rate stuck), and "Preview result" pins while
  checked — the button shows 1× disabled with an honest tooltip, then restores.
  Measured live at 2×: double clock advance over the same wall time.
- [x] **A2 — copy / paste / duplicate.** New pure op `pasteClips(timeline,
  entries, atSeconds, newIds?)` in `timeline-group-ops.ts` (7 unit tests):
  entries target their source track ids, fall back to first-compatible like
  `trackForAsset`, keep relative layout via `offsetSeconds`, fresh clip ids; on
  collision the WHOLE group shifts right together to the nearest fit (the
  minimal-delta candidates are "flush against an existing clip's end");
  identity-on-reject when an entry has no track or the group overlaps itself
  after fallback. Reducer `paste` action = one undo step; ids are minted by the
  caller so the paste can select the new clips (`useClipboard` runs the op
  eagerly and skips dispatch/selection on reject). Clipboard is an in-memory
  ref in the editor — cross-project paste refused by construction. Shortcuts
  Ctrl+C (only claimed when clips are selected) / Ctrl+V (at playhead) /
  Ctrl+D (paste at the selection's own end; leaves the clipboard alone) behind
  the existing text-entry + visibility guards.
- [x] **A3 — auto-scroll + zoom-to-fit.** `usePlayheadFollow`: on the playhead
  exiting the lanes viewport during playback, scrolls it back in at 20% from
  the left; a manual scroll while playing suspends following (own writes
  announce themselves via a programmatic counter), and it resumes when the
  playhead next walks OUT of view — the in→out transition is re-derived on
  manual scroll too, or a stale `wasInView` made the very next frame yank the
  view back (caught while building the CDP test). All refs, no React state.
  Zoom-to-fit (`Shift+Z` + toolbar Expand button): largest `ZOOM_LEVELS` step
  whose pxPerSecond shows the whole timeline, anchored at 0.
- Live CDP run (autocut-test + editorial-test): paste at End landed selected
  right after the last clip, Ctrl+D chained the next copy, undo ×2 → 13-clip
  baseline, redo → 14; zoom-to-fit framed 545 px of content at scrollLeft 0;
  follow jump re-entered at exactly 0.20, manual scroll-back stayed put,
  following resumed after re-enter + walk-out; audition pinned 2×→1×→2×.
- CDP testing gotcha recorded: the timeline lanes' scroll div is NOT the first
  visible `.overflow-auto` containing clips — an outer wrapper (84 px wider,
  never horizontally scrollable) matches first, silently reading `scrollLeft 0`
  forever. Pick the INNERMOST matching container. Also: playback (rAF) is
  throttled while the window is occluded — `Page.bringToFront` first.

### Studio — S3 agent pass: editorial cuts via the Assistant chat (2026-08-12)
**Status: COMPLETE — unit-tested (19 new tests, 310 total) + full live CDP run
(seeded TTS recording → AssemblyAI verbatim transcript → agent chat → 5-cut
proposal → apply → undo ×2 → redo)**

The LLM editorial pass from the S3 plan: the agent reads the VERBATIM
transcript and proposes retakes/false starts/fillers/fluff as cuts. Its output
lands through the SAME `proposal-add` → CutRegionLayer + ReviewCutsSection
flow as mechanical Auto Cut — the agent never touches the timeline.

- [x] **Typed in-process tools through the Agent SDK.** `LLMRequest.mcpServers`
  (main-process-only field, like `onTextDelta`) is passed into
  `ClaudeProvider.createSession`'s query options; `runLlmGenerate` grew an
  in-process `extras` param to carry it past the IPC type. `zod` pinned 4.3.6
  (already a transitive dep). Providers that aren't `agent-sdk` ignore the
  field — the agent's system prompt then honestly says it can chat but not
  edit, and names the fix (pick an Agent-SDK provider in the Inspector).
  Unknown provider ids (e.g. auto-registered `claude-subscription`, which is
  NOT in the saved configs list) are assumed agent-sdk.
- [x] **`studio-agent.ts`** (main): one in-flight turn per project, scope-less
  runs with explicit `messages` history (no hot-session staleness), push
  events over `STUDIO_AGENT_EVENT` (`delta` / `tool` / `proposal`), provider
  from `project.settings.agent.providerId` (its first real consumer),
  `featureSource: 'auto-cut'`. Two tools:
  - `get_transcript` → **takes view** (`transcript-takes-view.ts`, port of
    format_transcript.py): segments split on >0.8 s gaps, `#NN [s - e] (M:SS)`
    lines, pause lines between, fillers inline as `<<uh, 12.34-12.40>>`. Warns
    when the transcript isn't verbatim.
  - `propose_cuts` → `editorial-cuts.ts`: clamp/drop invalid spans, merge
    overlaps + wordless slivers (≤1 s) between cuts, then **RMS-snap edges
    with the existing `planClip`** under `internalGap = ∞` (pause compression
    stays Auto Cut's job) — head pads, decay tails, and the clamp that stops a
    tail riding into cut speech all apply to agent spans. Keeps↔cuts alternate
    1:1 with planner segments, so each item's edges are exactly what apply
    removes. Proposal built in main: retake/false_start/filler start
    **accepted** (veto review), fluff starts **rejected** (policy: suggest,
    don't auto-remove); honest `agentNote` headline + the agent's summary +
    QA notes (merged/dropped/vanished counts).
- [x] **`resources/skills/studio-clean-cut/SKILL.md`** — the clean-cut policy
  ported from claude-youtube-editor and composed into the system prompt via
  `skillIds`: spoken slates outrank judgment, doubled phrase → cut the FIRST,
  filler conservatism (standalone yes, mid-sentence careful, scripted never),
  antecedent rule, paired-fluff notes, "the transcript lies about TIME"
  (word-bound spans; snapping absorbs the error), every cut carries a
  which-take-wins note.
- [x] **Assistant tab is real** (`AgentPanel` + `useStudioAgent`): streaming
  deltas, tool-activity chips, proposal chip linking to review, stop/clear,
  Enter-to-send. A proposal arriving while the user is ON the Assistant tab no
  longer yanks them to the Inspector (regions still appear on the timeline);
  from any other tab the review pulls into view as before. One-review gating
  holds at three layers (send context flag → tool refusal; Auto Cut button;
  proposal-ops no-ops).
- Live walkthrough (dev, CDP): seeded a 38 s TTS wav containing a false start
  + "Let me say that again." slate + doubled "And what, and what" + standalone
  "Um." + a like/subscribe CTA; AssemblyAI verbatim transcript (70 words,
  measured times). One chat turn: agent read the takes view and proposed
  exactly the right 5 cuts — categories correct, fluff unchecked, notes name
  the winning take, and it flagged the one estimated boundary "needs an ear".
  Review showed honest stats (−18.9 s proposed / −11.3 s at Apply-4), regions
  on the A1 clip; Apply split 1→5 clips with the stats toast; two Ctrl+Z
  returned to pristine (un-apply, then un-add); Ctrl+Y brought the full
  review back. Type baseline ratcheted web 27→26.
- Not exercised live: auditions by ear (buttons render; left the proposal
  open in the `editorial-test` project to listen to), the chat-only fallback
  on non-agent-sdk providers, and the propose-cuts-refusal path (logic
  unit-covered). Takes view carries word times only on fillers by design —
  the model estimates other boundaries and the snapper absorbs it; if that
  bites, add per-word times to the view.

### Render pipeline — resolution-scale fix + animated WebP export (2026-08-11)
**Status: COMPLETE — unit-tested (16 new tests) + Electron smoke test; full in-app
render click-through still pending**

- [x] **Downscaled renders no longer zoom/crop pixel-sized content** (user-
  reported "GIF gets bigger and cut"). Root cause: fractional scales (e.g.
  480p from 1080p = 0.4444) were worked around by materializing smaller
  composition dims at scale 1, which re-lays-out the comp — absolute-pixel
  content kept its design size inside a smaller canvas. Fix: `snapRenderScale`
  (`src/shared/render-scale.ts`) picks the nearest scale with exact
  even-integer output dims (480p → 864×486) so Remotion's deviceScaleFactor
  path scales the finished bitmap instead; dims-materializing survives only
  as a logged fallback for near-coprime comp sizes. Modal presets show the
  snapped dims and pass the exact scale.
- [x] **WebP export** (`codec: 'webp'`): Remotion has no WebP codec and its
  bundled ffmpeg ships no libwebp (verified: encoder list has only `gif`,
  ffprobe can't even decode webp), so `src/main/services/webp/` renders a PNG
  sequence via `renderFrames`, encodes each frame through Chromium's canvas
  encoder in a hidden BrowserWindow (tone-extractor pattern; quality 1.0 =
  lossless VP8L, alpha preserved), and muxes with a hand-rolled pure
  RIFF/VP8X/ANIM/ANMF muxer (spec-tested; pad bytes, ALPH carry-through,
  VP8L alpha-bit detection). Zero new dependencies. `crf` is reused as WebP
  quality 1–100 (documented on `RenderCodec`) so queue DB/IPC are unchanged.
  Modal: WebP joins the GIF family (auto-480p, smoothness, loop, muted) plus
  quality presets and the transparency toggle; preview panel plays it in an
  `<img>`. Smoke-tested in real Electron: lossy-opaque + lossless-alpha
  files decode in Chromium's decoder at correct dims.
- Known gap: ffmpeg-based queue thumbnails can't decode .webp output (no
  libwebp in the stripped binary) — thumbnail is skipped gracefully.

### Studio — ripple-delete toggle + track management (2026-08-11)
**Status: COMPLETE — unit-tested (11 new tests, 284 total) + driven live via CDP**

The two queued follow-ups before resuming the S3 agent pass.

- [x] **Auto-ripple toggle** (`TimelinePanel.rippleEnabled`, persisted like
  `snapEnabled` as component state, default ON). Governs the Delete key and the
  toolbar delete button for single AND batch deletes; the button's tooltip
  says which mode is live ("Delete and close the gap" / "Delete, leaving the
  gap"). Backspace stays the explicit leave-the-gap delete in either mode.
- [x] **Track management.** Pure ops in `services/track-ops.ts` (identity-on-
  reject): add (visual tracks insert on TOP because tracks[0] paints in front;
  audio appends), rename, reorder, delete (locked/last-track reject), flag
  toggles — all undoable reducer actions in `useTimeline`.
- [x] **Interactive `TrackHeader`** (own file now): click chooses the track,
  double-click renames inline, lock + mute/hide icons are buttons, right-click
  opens a renderer-built `FloatingMenu` (NOT the native menu — no IPC, CDP-
  drivable) with Rename / Move up / Move down / Delete. "+ Track" button in
  the header column's top cell adds video/overlay/audio.
- [x] **Chosen-track pool adds**: `trackForAsset` gained a `preferredTrackId` —
  the selected track wins when compatible (audio↔audio lanes, visual↔non-audio),
  else the old first-compatible fallback. `useTimeline.selectedTrackId` is
  pruned when its track leaves the document.
- [x] Header column now follows the lanes' vertical scroll (translateY from the
  scroll viewport) — first time track count is user-controlled, so >3 tracks
  scroll; the ruler was already sticky.
- Verified live on the autocut-test project: ripple ON delete closed the full
  span (later clips slid exactly its width) and OFF left every later clip in
  place, undo restored both; O1/A2 landed top/bottom; chosen-track add put the
  clip on selected O1 instead of V1; rename → B-roll; lock/mute/hide labels
  flip; locked track's menu disables Delete; Move down + Delete + full undo
  chain returned exactly to baseline (V1/A1, 13 clips, flags cleared).
- Mid-session note: work briefly interleaved with a `git stash -u` of the
  whole tree; everything was restored from stash@{0} (EditorShell.tsx had to be
  checked out from the stash explicitly). The stash entry still exists and is
  safe to drop once confirmed.
- **User-reported bug fixed same day: vertical clip drags "sometimes snapped
  back" to the original track.** Two causes in `useClipDrag`: (1) the
  click-vs-drag test on release checked ONLY horizontal movement, so a clip
  dragged straight down/up to another lane with <2 px of X drift was discarded
  as "a click that never moved"; (2) the drop re-resolved the target lane from
  the pointerup coords instead of committing what the preview last showed, so
  boundary jitter could flip the outcome. Now: moves use a 2 px box on both
  axes (trims stay X-only), the drop commits the preview's lane
  (`lastTargetTrackId`), and a wobble that resolves back to the identical
  lane+time skips the dispatch instead of burning a no-op undo step. Verified
  live via CDP with a synthetic dx=0 drag: clip hopped V2 → lane above, undo
  restored it (previously this exact gesture always snapped back).

### Studio — timeline multi-select & batch editing (2026-08-11)
**Status: COMPLETE — unit-tested (11 new tests) + driven live via CDP**

User-requested during S3.3 testing (the request surfaced after fixing native
drag-selection painting over the timeline — `select-none` on the panel root).

- [x] Selection is now a SET (`useTimeline.selectedClipIds`; `selectedClipId`
  stays as the derived single selection for split/trim logic). Ctrl/⌘/Shift-
  click toggles membership; plain click collapses; clicking a clip of a
  multi-selection keeps the group so it can be dragged, and collapses on
  release only if the pointer never moved (CapCut semantics). Stale ids are
  pruned whenever clips leave the document (delete/undo/apply-proposal).
- [x] `services/timeline-group-ops.ts` (pure, same identity-on-reject contract):
  `moveClips` — one shared delta, relative positions preserved, clamped so no
  member collides with an unselected neighbour or crosses zero (boxed-in =
  reject), locked tracks reject; `removeClips` — batch delete with per-track
  ripple that closes the FULL removed span; `clipsInRect` — marquee hit-test.
- [x] Marquee drag-select (`useMarqueeSelect`): press empty lane space and drag
  a dashed rectangle; every clip it touches joins the selection (Ctrl/Shift =
  additive); a motionless press keeps the old deselect-click behaviour.
- [x] Group drag rides the existing scratch-document preview (`useClipDrag`
  gains a group mode — same snapping, no track hopping) and commits as ONE
  `move-clips` undo step. Batch delete: Delete = ripple, Backspace = plain,
  toolbar ripple-delete button now deletes the whole selection. New keys:
  Ctrl+A select all, Escape clear selection.
- Verified live: ctrl-click 2 clips → group-drag both +2 s (others untouched)
  → undo restores; marquee across 3 clips from the empty A1 lane; Delete
  removes all 3 with ripple; undo restores; empty-lane click clears.

### Studio (AI video editor) — Phase S3 step 3: cut proposals + review on the timeline (2026-08-11)
**Status: COMPLETE — verified live via CDP with a real AssemblyAI transcription**

Live walkthrough (same session, new machine): seeded 40 s TTS recording with known
pauses → one-click Auto Cut (chained AssemblyAI transcription, 69 words, measured
timestamps) → 12 cuts proposed (−14.0 s, the 3.5 s SSML break found as a 3.8 s
dead-air item) → rejected one item ("Apply 11 cuts" / grey region) → Apply split
the clip into 12 contiguous pieces with the stats toast → ONE Ctrl+Z restored the
full review (12 regions, proposal back to `proposed`). Two real bugs found live
and fixed:
- **AssemblyAI deprecated `speech_model`** (API change since S3.1): provider now
  sends `speech_models` — legacy 'universal' maps to the API's own default pair
  `['universal-3-5-pro','universal-2']`, other ids pass through.
- **useAutoCut chained plan never fired**: an asset has NO transcript entry in the
  document until the first job event, and the watcher read that `undefined` as
  "cancelled", clearing the pending run instantly. Now `undefined` only counts as
  cancelled after the job was seen running.
Note: the seeded TTS clip reports noise floor −120 dB (true digital silence) —
real recordings will show sane floors. Not exercised live: edge-drag by pointer
(logic unit-tested; handles render), auditions by ear, export of an applied cut.

User-reported bug fixed same day: **with "Preview result" on, the playhead
crawled through cut regions** (the Player runs the shorter CUT timeline while
the panel displays the original, so the line lagged and the video ended early).
Fixed with `services/preview-mapping.ts` — a piecewise-linear map between the
two clocks built from the reshaped track's clips (preserved gaps map
proportionally, cut spans collapse to the join). `TimelinePanel` shims its
whole playback surface (playhead, clock, ruler seeks, split-at-playhead, zoom
anchor) into display coordinates while the map is active, so the playhead now
JUMPS across regions and ruler seeks into a cut land on the join; EditorShell
auditions keep talking to the raw player clock. 5 unit tests (jump, collapse,
round-trip).

Design discussion + UI mockups: claude.ai artifact "Auto-Cut Flow" (session 2026-08-11).
Locked decisions: mechanical (silence) cuts first — the LLM editorial pass (retakes/
fillers) is the next slice and feeds the SAME review UI; all items start accepted
(veto-based review); AssemblyAI is the recommended engine (hint in the picker);
ffmpeg smart-render stays deferred.

- [x] **Proposals live in the undo history.** `useTimeline`'s reducer now snapshots
  `{timeline, proposals}` (`EditDoc`) so accept/reject/adjust/apply are all undoable
  and Ctrl+Z after Apply restores BOTH the timeline and the proposal to `proposed`
  in one step. New actions: `proposal-add / -item-status / -item-span / -apply /
  -reject`. Pure list edits in `services/proposal-ops.ts` (same identity-on-reject
  contract as timeline-ops).
- [x] **Plan → proposal** (`services/cut-proposal.ts`): keep-segments inverted into
  cut spans (incl. leading/trailing silence), categorized `long_pause` (<2 s) vs
  `dead_air` (≥2 s), word context in `note` ("…setup. [3.0 s] Now…") and swallowed
  words in `text`; honest headline + planner QA notes in `agentNote`. Also:
  source→timeline region mapping and per-item drag bounds (cuts can't overlap).
- [x] **Apply** (`services/apply-cut-proposal.ts`): accepted spans merged, subtracted
  from every clip playing the asset, survivors kept contiguous (per-track ripple —
  music holds timing), sub-frame slivers dropped, reshaped clips tagged
  `origin: {by:'agent', proposalId}`; first piece keeps its clip id. 19 new unit
  tests across builder/mapping/apply.
- [x] **Review UI.** `CutRegionLayer`: striped amber regions over the lanes (grey =
  rejected), click = select + seek, selected region gets **draggable edge handles**
  (snap to transcript word boundaries via `useAssetTranscripts` reading the cache
  JSON over `studioCacheRead`; item marked `adjusted`). `ReviewCutsSection` in the
  Inspector: stats header with honest before→after (runs the real apply on a
  scratch doc), QA notes, per-item accept toggles + category/adjusted chips +
  transcript context, Apply N cuts / Reject all.
- [x] **Auditions.** Per cut: "Play removed" (original timeline) and "Play join"
  (±1.5 s with accepted cuts applied — finds the post-ripple join by matching the
  survivor clip whose `sourceIn` is the cut's end). Global "Preview result"
  checkbox plays the whole timeline as-if-applied; all built on scratch documents
  through the same `applyCutProposal`, so preview is exactly what commits.
- [x] **One-click Auto Cut** (`useAutoCut` + `TranscriptSection`): transcribes first
  when needed (chains on the transcript-ready document event), then plans, builds
  the proposal, selects the first cut. Engine picker labels AssemblyAI entries
  "best for auto-cut". Button disabled while a proposal is open (one review at a
  time).
- New machine setup fixed en route: committed `.npmrc` with `legacy-peer-deps=true`
  (react-simple-maps@3 peer range vs React 19 — fresh clones couldn't install).
- Pending: live CDP walkthrough (auto-cut → drag an edge → veto → apply → undo →
  redo → export) on the S3.1 test recording; StudioProposalItem gained optional
  `adjusted` flag (schema v1 unchanged — additive).

### Studio (AI video editor) — Phase S3 steps 1–2: transcription + cut planner (2026-08-08)
**Status: COMPLETE — verified end-to-end via CDP (transcribe → cancel → re-transcribe → plan JSON)**

- [x] **Whisper word timestamps are now measured, not approximated.** whisper.cpp
  runs with `-ojf` (full JSON; flag verified against the v1.8.3 binary the app
  downloads) and the new electron-free `src/main/services/whisper-output.ts`
  merges BPE tokens into words with real times + per-word confidence (min token
  p). Two traps handled and unit-tested: bare punctuation tokens carry phantom
  timestamps (a "." can sit 0.9 s after its word — timing comes from speech
  tokens only, else pause detection dies) and sub-word merging (" Auto"+"C"+"ut").
  Char-distribution approximation stays as the per-segment fallback.
- [x] **Capability snapshots, never provider branching.** `SttModelFeatures`
  gained `verbatimDisfluencies`; providers now return the features a run
  actually delivered (whisper: measured vs fallback; AssemblyAI: what was
  requested+returned), and `StudioAssetTranscript` records that snapshot +
  `sttModelId` + `wordCount` in the document. `undefined` = "not available",
  never `[]`. AssemblyAI requests `disfluencies: true` when the caller asks for
  verbatim (auto-cut does; the transcribe feature doesn't).
- [x] **Per-asset transcription is button-triggered only** (media-pool hover
  action + Inspector section with engine picker persisted in
  `settings.sttModelId`) — never on import, so b-roll/music never burn whisper
  minutes or AssemblyAI credits. Runs as the third media-job kind (serialized —
  whisper.ts tracks a single child process), streams percent, writes rich JSON
  to `cache/transcripts/<assetId>.json`, folds meta into the document on
  `ready`. Cancel mid-run removes the entry (verified live); stale
  `'generating'` from a killed session is cleaned up on cancel too.
- [x] **cutlib.py ported to `cut-planner.ts`** (pure logic, 25 unit tests): RMS
  noise floor (10th percentile), speech-run atoms, snap-to-audio tails with
  soft/punchy landings, pause compression, cut-span clamps (a tail must never
  ride into cut SPEECH — the reference repo measured 0.70 s surviving that way).
  Reference `tight`/`natural` styles from the clean-cut skill. Capability
  compensation: approximate timing widens head/tail pads instead of refusing.
  RMS comes from the waveform cache — `waveform-generator` now emits `rmsDb`
  buckets (dBFS, 20 ms grid) alongside peaks (file version 2; v1 files
  regenerate on first plan) because the stripped ffmpeg has no volumedetect.
- [x] **`studio:cutplan:run` IPC** → `cut-plan-runner.ts` loads transcript +
  envelope, writes `cache/cut-plans/<assetId>-<style>.json`, returns the plan;
  Inspector shows stats + QA notes + path. NOTHING touches the timeline —
  proposals/review are S3 step 3. Honest QA readout: non-verbatim engines get a
  "filler cutting will find less" caveat instead of implied AssemblyAI parity.
- Verified live on a 39.4 s recording with known pause positions: 73 words
  measured (`wordTimestamps: true` snapshot in project.json, survives restart),
  13 keep-segments, 12 pauses compressed, soft landing on the 3.3 s gap, style
  un-widened. Also caught live: whisper pads its final decode window past the
  real audio end (41.7 s claimed vs 39.4 s measured) — the envelope's duration
  is authoritative in the runner, not the transcript's.
- Notes: whisper-base word times still smear across some pauses (several known
  SSML breaks didn't surface as word gaps — the documented "transcript lies
  about time" failure mode; the RMS snap is what makes edges robust). AssemblyAI
  path is wired (verbatim + snapshot) but not exercised live — would spend
  credits. `npm run lint` referenced in CLAUDE.md doesn't exist as a script
  (pre-existing); gates used: `check:types` ratchet 27/22 + `npm test` (229).

### Studio (AI video editor) — Phase S2: timeline core (2026-08-07)
**Status: COMPLETE — verified end-to-end via CDP, including the Player checkpoint**

- [x] `src/shared/studio/`: `time-math` (one cumulative-rounding conversion,
  `round(b·fps) − round(a·fps)`, so 100 cuts tile with zero drift), `serialize`
  (document → frames + asset URLs), and the data-driven `TimelineComposition`
  used by BOTH the preview and the export.
- [x] Timeline document reducer + undo/redo in feature state (`useTimeline`,
  100-deep snapshot history, no global store). Pure ops in
  `services/timeline-ops.ts`: add / move (neighbour-clamped) / split /
  trim (source- and neighbour-bounded) / ripple-delete (per-track, so music
  keeps its timing) / remove-asset-clips.
- [x] Tracks/clips UI: ruler, 10-step zoom anchored on the playhead, magnetic
  snapping to clip edges + playhead, drag-move across tracks, edge trims,
  canvas waveforms, selection, keyboard (Space/S/Del/Backspace/Ctrl+Z/Y/
  arrows/Home/End). Drag preview runs the real op on a scratch document, so
  what you see mid-drag is exactly what commits.
- [x] `@remotion/player` preview over 720p proxies; playhead lives outside
  React state (imperative subscribe → DOM), so playback re-renders nothing.
- [x] Background main-process jobs (tsx-job-engine pattern): proxy generator
  (NVENC → libx264 fallback, verified on this machine) and waveform generator;
  status per asset in the document, push events folded back into it.
- [x] Export: generated Remotion entry embedding the serialized timeline
  (originals, not proxies) → existing render queue. Verified output:
  1920×1080@30, 60.000 s video / 60.053 s audio, correct picture per clip,
  black across a deliberate gap, audio bursts at the right seconds.
- [x] **Player-architecture checkpoint passed** (100 cuts, 720p proxies, dev
  build — noisy machine, so ranges): playback 16.7 ms/frame (60 fps, same as a
  2-clip timeline); scrub 17–25 ms at natural drag speed, 25–35 ms flinging
  across the whole timeline; the editor's own JS is ~1.4 ms per scrub step, so
  the ceiling is video decode, not the UI. No HTML5-seek fallback needed.
  Two fixes got it there: proxies need a short GOP (`-g 15` — the encoder
  default ~8 s made each seek decode up to 250 frames, ~20 fps), and
  `TimelineComposition` mounts only clips within ±2 s of the current frame
  (mounting all 100 sequences per frame halved scrub throughput).
- Notes: proxies/waveforms are cached per project, so the same source imported
  into two projects transcodes twice (candidate for a hash-keyed shared cache).
  `EditorShell` imports `useRenderQueue` from `@features/render-queue`,
  following the existing precedent in `features/motion` — the render queue is
  app-level infrastructure exposed through context.
- Pre-existing bug noticed while testing (NOT introduced here, affects all
  renders): the queue shows "Bundling... 10000%" — `render-handlers.ts`
  multiplies an already-0–100 bundler percent by 100 again.

### Studio (AI video editor) — Phase S1: projects & editor shell (2026-08-07)
**Status: COMPLETE — verified end-to-end via CDP**

- [x] Document schema v1 in `src/shared/types/studio.ts` (seconds-only unit
  discipline, provenance, proposals); IPC contracts in
  `src/shared/ipc/types/studio.ts`; 9 `STUDIO_*` channels.
- [x] Main services (`src/main/services/studio/`): `studio-paths` (id
  validation + cache-path traversal guard), `project-store` (folder-as-truth
  listing, atomic tmp+rename saves, `shell.trashItem` delete with rm
  fallback, reuses `reserveProjectFolder`), `media-import` (ffprobe probe for
  video/audio/image, ffmpeg thumbnails to `cache/thumbs/`, content-hash for
  future relink).
- [x] Settings: `studioProjectsRoot` (default `~/Videos/VidTSX Studio`),
  changeable from the browser toolbar via the existing folder dialog.
- [x] Renderer: `ProjectBrowser` (grid cards, two-step delete),
  `NewProjectDialog` (Landscape/Portrait/Square presets + fps),
  `EditorShell` (CapCut layout: media pool | aspect-correct preview stage |
  Inspector+Assistant tabs | full-width timeline scaffold with ruler and
  V1/A1 lanes), debounced document autosave (`useStudioProject`),
  per-project agent provider picker persisted in `settings.agent`.
- [x] CDP-verified: create portrait 1080×1920@60 project → on-disk scaffold
  correct → provider select persists (atomic-save rename observed in USN
  journal) → back → card grid → delete → folder in Recycle Bin, empty state.
  Manual test remaining: media import (native file dialog can't be driven
  via CDP) — probe/thumbnail path is exercised in code but not clicked
  through. S2 exercised everything downstream of it by writing asset entries
  straight into project.json.
- Automation gotcha recorded: `App.tsx` keeps every visited screen mounted
  (`display: none`), so DOM-driving MUST filter to visible elements
  (`offsetParent !== null`) or clicks land on hidden screens' buttons.

### Studio (AI video editor) — Phase S0: gate & scaffold (2026-08-07)
**Status: COMPLETE**

Full architecture + phase plan (S0–S7) in `docs/studio/PLAN.md`. Locked
decisions: Remotion-native `TimelineComposition` for both preview (over 720p
proxies) and export; solid manual timeline core (S2) before auto-cut (S3);
user-chosen studio projects root (folder-as-truth); local whisper default with
AssemblyAI opt-in for word timestamps. Engine knowledge and skills ported from
`D:\repos\claude-youtube-editor` (cutlib planner, render-drift lessons,
clean-cut/make-tsx/suggest-sfx editorial policy).

- [x] Flags `studio: true` (nav teaser) / `studio-editor: false` (prod shows
  Coming Soon, dev fully enabled) — Flows-style gating.
- [x] `src/features/studio/` scaffold: gated `StudioScreen`, draft v1 timeline
  document schema in `types.ts`, barrel.
- [x] Sidebar nav item (Clapperboard, after TSX) + `screens` map entry.

### v1.0.0 — First public release (2026-07-29)
**Status: COMPLETE**

Public scope: TSX Creator, Image Studio, Transcribe, Assets, render queue,
and AI Models (System / Providers / Audio-whisper / Image). Everything else
stays visible as "Coming soon" in production and fully enabled in dev.

- [x] Image Studio local models: `LocalSdImageProvider` bridges the sd-cli
  engine into the cloud ImageEngine (provider id `local`, auto-offered when
  ≥1 ready on-device model). Promise-based `enqueueAwait` on the local
  engine; shared generation preflight (`applySdGenerationPreflight`);
  provider switch persists. Verified end-to-end via CDP (bk-sdm-tiny 256²).
- [x] Coming-soon gating (prod only): AI Models Video/LLMs/Embeddings tabs
  (`ai-video-models` / `ai-llm-models` / `ai-embedding-models` flags; 3D was
  already a placeholder), Flows editor (`flows-editor` flag — nav stays),
  sherpa voice-engine section of the Audio tab (existing `audio-engine`
  flag). Creator's keyless "Local Models" preset is gated on real
  `llmLocalEngine.isAvailable()` because production builds exclude
  node-llama-cpp.
- [x] Repo made public-ready: README.md written, personal scratch notes
  untracked, no secrets/keys in tree (verified), MIT license.
- [x] v1.0.0 Windows installer built and published as a GitHub release.

### TSX Generator stabilization + parallel jobs (Creator)
**Status: COMPLETE — committed 2026-07-23**

Full plan in `docs/tsx-generator-stability-plan.md`; contributor guide in
`docs/tsx-generator-architecture.md`.

- [x] **Phase 1** — stability foundation: compat-provider abort, agent-sdk
  error-result detection, save/auto-save races, retry-with-backoff,
  string-based validate, `npm run check:types` ratchet gate.
- [x] **Phase 2** — main-process job engine (`src/main/services/tsx-jobs/`):
  up to 4 concurrent generations with isolated `ClaudeSession`s, per-job
  provider + cancel, atomic project naming, queued-job persistence, will-quit
  shutdown.
- [x] **Phase 3** — job-based Creator UI: jobs strip, center-panel ownership
  rule, edits/fixes as jobs.
- [x] **Phase 4** — token streaming, per-project `chat.json` refinement
  history, pipeline tests, `local` + Z.AI providers, **props panel**
  (AST prop extraction + live preview inputProps), custom-provider UI
  (any OpenAI/Anthropic-compatible endpoint), library placeholder rows,
  maxConcurrent setting, coalesced library rescans.
- Z.AI preset verified against docs 2026-07-23: base URL
  `https://api.z.ai/api/anthropic`, model `glm-5.2` (opt: `glm-5.2[1m]`).

### Local AI Models redesign (open-source cleanup)
**Status: COMPLETE (Phases 0–4) — committed; field-verification pending**

Replaced the download-centric SD/Flux catalog (hosted on learnwithhasan.com) with
a ComfyUI-style, folder-as-truth model library built on a category-agnostic core.
Zero owner infrastructure for image models. See
`docs/local-image-models-redesign.md` (design) + `docs/local-image-models-implementation.md`
(plan + full Progress Log).

- [x] **Phase 0** — vitest tooling + type-error baseline (node 36 / web 44).
- [x] **Phase 1** — category-agnostic model-library core (`src/shared/model-library/`,
  `src/main/services/model-library/`): scanner, classifier, sidecars, importer,
  usage-store, category/runtime registries. Electron-free, injectable, 37 tests.
- [x] **Phase 2** — image adapter + registry rework: `SdModelDefinition`→profile
  envelopes (34 entries), `flux`→`flux1`/`flux2`, companion resolution, deleted
  `SD_MODELS_BASE_URL`, generic `MODELS_*` IPC, engine on an injected resolver.
- [x] **Phase 3** — dedicated flag-gated "AI Models" sidebar screen; image library
  view rewritten onto `MODELS_SCAN` (`useImageLibrary` + Header/Installed/Catalog/
  SetupDialog); dashboard Library card; deleted hidden GeneralTab folder block.
- [x] **Phase 4** — deleted audio `MODELS_BASE_URL` + fallback, orphaned
  `useSdImageModels`; fixed the dangling NSIS `build/license.txt` reference
  (→ committed `LICENSE.txt`) so `build:win` completes. 67 tests; node 36 / web 36.

**Pending before this ships (flagged in the Progress Log):**
- Interactive UI click-through of the AI Models screen (not run — non-interactive session).
- Catalog metadata verification: FLUX.2 Klein companion source links + the 13
  link-only `sourceUrl`s are best-effort, not network-verified; verify with a real sd-cli.
- sd-cli binary distribution story (still not bundled).

### Captions Generator
**Status: COMPLETE**

- [x] 4-step wizard UI (StepCard components)
  - Step 1: Add audio/video (AudioDropZone with drag & drop)
  - Step 2: Transcribe (ModelSelector with whisper integration)
  - Step 3: Choose caption style (CaptionTemplateSelector)
  - Step 4: Render options (WebM overlay, Burn into video, Export JSON)
- [x] useCaptions hook for wizard state management
  - Step progression logic
  - Transcription integration via existing whisper IPC
  - Style selection
- [x] 3 caption templates (Remotion compositions):
  - BoldPopCaptions: Large centered text with spring pop animation
  - KaraokeCaptions: Word-by-word highlight effect
  - MinimalCaptions: Clean subtitles at bottom with dark bar
- [x] caption-builder service (duration calculation, config generation)
- [x] CaptionPreview with VideoPlayer integration
- [x] Render queue integration:
  - Export WebM overlay (vp8 codec, transparent)
  - Burn into video (h264 codec)
  - Export captions JSON
- [x] Reuses whisper:transcribe IPC from transcription feature

### Phase 5 — Render queue system
**Status: COMPLETE**

- [x] Step 5.2 — Render queue service and UI
  - [x] RenderQueueJob type with full metadata (id, fileName, status, progress, etc.)
  - [x] queue-manager.ts utilities (generateOutputPath, formatFileSize, etc.)
  - [x] RenderQueueContext with state management, IPC event listeners
  - [x] Auto-start next queued job when current completes
  - [x] Debounced persistence to ~/.vidtsx/render-queue.json
  - [x] Load on startup with interrupted job handling
  - [x] Clean up jobs older than 7 days
- [x] IPC handlers added:
  - RENDER_QUEUE_SAVE for persisting queue
  - RENDER_QUEUE_LOAD for loading queue on startup
  - RENDER_OPEN_FILE for opening rendered files
  - RENDER_OPEN_FOLDER for revealing in explorer
  - RENDER_GET_VIDEOS_DIR for default output folder
- [x] UI components created:
  - RenderScreen with toolbar and job list
  - RenderItem with status icons, progress bar, actions
  - RenderProgress wrapper for status-colored progress bar
- [x] Toast notification system (shared component + context)
- [x] Sidebar badge showing active/queued job count
- [x] Render button in WorkspaceScreen integrated with queue

### Phase 4 — Code editor + props panel
**Status: COMPLETE**

- [x] Monaco code editor integration
- [x] Code + visual view mode toggle
- [x] Resizable divider between code and preview
- [x] Auto-save with transpilation refresh
- [x] Props panel (delivered later with the TSX Generator work, 2026-07-23):
  AST-based `props-parser`, `PropsPanel`/`PropField` controls
  (text/number/toggle/color/select), live preview updates via Player
  `inputProps`

### Phase 3 — Remotion player integration
**Status: COMPLETE**

- [x] VideoPlayer component wrapping @remotion/player
- [x] PlayerControls with play/pause, seek, timeline, loop, speed control
- [x] useComponentLoader hook for TSX transpilation
- [x] Native module loading with virtual module globals (setupVirtualModuleGlobals)
- [x] Error boundary and loading states for player
- [x] Screenshot functionality (copy to clipboard, save to file)
- [x] Fullscreen support

### Phase 2 — Workspace + file management
**Status: COMPLETE**

- [x] Step 2.1 — File tree UI component
- [x] Step 2.2 — File management features:
  - [x] "New folder" button in toolbar with inline name input
  - [x] Right-click context menu (native Electron Menu):
    - File: Rename, Delete
    - Folder: Rename, Delete, New subfolder
  - [x] Inline rename (click turns label into input, Enter saves, Escape cancels)
  - [x] Drag-and-drop .tsx files onto window (with visual overlay)
  - [x] Paste TSX from clipboard (Ctrl+V detects TSX-like content)
  - [x] SelectedFileContext for sharing selected file across screens
- [x] IPC channels added:
  - FILE_RENAME for renaming files/folders
  - FILE_GET_PROJECTS_DIR to expose projects directory to renderer
  - CONTEXT_MENU_SHOW for native context menus
  - CLIPBOARD_READ_TEXT for clipboard access
- [x] Components created:
  - InlineRenameInput for inline editing
  - DropZoneOverlay for drag-drop visual feedback
  - SelectedFileContext/Provider for state management

### Phase 1 — App shell + navigation
**Status: COMPLETE**

- [x] Title bar with traffic lights (macOS) / system buttons (Windows)
- [x] Sidebar with 7 navigation icons + settings at bottom
- [x] Screen routing between all 7 screens
- [x] Placeholder screens for each feature
- [x] Reusable shared components:
  - [x] Button (primary/secondary variants, sm/md sizes)
  - [x] Panel (dark surface with optional header)
  - [x] Badge (free/pro variants)
  - [x] ProgressBar (4px height, multiple colors)
  - [x] TextInput (styled input with focus state)
  - [x] IconButton (toolbar actions)
- [x] Barrel export from src/shared/components/index.ts
- [x] WorkspaceScreen updated to use Panel + Button

### Phase 0 — Project scaffold
**Status: COMPLETE**

- [x] Electron 41.0.2 installed and working
- [x] electron-vite 5.0.0 configured as build tool
- [x] TypeScript 5.9.3 with separate configs (node/web)
- [x] React 19.2.4 rendering in Electron window
- [x] Tailwind CSS 4.2.1 with custom theme colors
- [x] Path aliases (@main, @renderer, @features, @shared)
- [x] Preload script with contextBridge
- [x] Typed IPC foundation (22 channels)
- [x] Full folder structure with barrel exports
- [x] electron-builder configured for Windows/macOS

---

## Known issues / tech debt

- `scripts/dev.js` wrapper needed to clear `ELECTRON_RUN_AS_NODE` env var (VSCode terminal issue)
- `@rollup/rollup-win32-x64-msvc` added to optionalDependencies as workaround for npm bug
- Tailwind CSS native binaries (`lightningcss`, `@tailwindcss/oxide`) require explicit install on Windows

---

## Deviations from plan

- Using `scripts/dev.js` wrapper instead of direct `electron-vite dev` due to VSCode environment variable conflict

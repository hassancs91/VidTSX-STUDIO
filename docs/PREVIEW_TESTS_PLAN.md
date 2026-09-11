# Preview engine — the test wave (T0–T7)

> Agreed with Hasan 2026-08-28: **stop building and measure first.** He read
> `docs/PREVIEW_ARCHITECTURE.md` and its 12-item checklist and said, honestly,
> that several items are hard to answer without evidence. Rather than guess, we
> run a bounded wave of tests, then answer the checklist from data.
>
> Companion docs: `docs/PREVIEW_ARCHITECTURE.md` (the options and the
> recommendation), `scripts/bench/README.md` (how to run T0 and what its
> columns mean). Plain-language explainer of the whole subject, for Hasan:
> https://claude.ai/code/artifact/378c33e0-8145-4bd6-a748-e4746f56c8dd
>
> **Nothing in the architecture doc is DECIDED until Hasan marks it.** This
> wave exists to make marking it cheap.

## What tests can and cannot settle

Worth stating up front, because it bounds the wave. Of the architecture doc's
12 checklist items:

- **5 are empirical** — does the decoder swap help, does colour survive it,
  does DJI HEVC decode, what should proxies be made of, where the scale
  ceiling is. Those are what this wave is for.
- **4 are judgement, and no test will ever settle them.** Rejecting the hybrid
  compositor is a *proof* problem: you cannot test your way to "two renderers
  will always agree", you can only fail to find a case where they don't —
  which is the trap itself. Rejecting the dual renderer and the engine
  replacement are questions about what the product is; Premiere's MOGRT/AELib
  outcome is the evidence, and a benchmark adds nothing. Claims language is
  policy.
- **3 are sequencing** and follow from the other two groups.

So the wave buys five answered questions and two permanent instruments. The
rest stays a decision Hasan makes knowing that's what it is.

## Status

| # | Test | Answers | Size | Status |
|---|---|---|---|---|
| **T0** | **Scrub benchmark harness** | (instrument) how long from asking for a frame to that frame being presented | ½ day | **DONE 2026-08-28** — `a164e3b`, results below |
| **T1** | **Fidelity baseline** | (instrument) what our WYSIWYG claim is worth *today*: pixel diff of preview vs export on the same project — and whether a passthrough join is provable inside it | ½ day | **DONE 2026-09-04** — tolerance = mean ≤ 4.8/255, ≤ 3.0 % of pixels over 24, one source frame of timing (preview shows the frame *before* t, export the *nearest*), +2–3/255 preview brightness. ffmpeg passthrough with the nearest-pts select: mean ≤ 1.74, **0 % over 24**, same frame at every index, both codecs; the join is frame-exact and audio-continuous with one encoder + TS video-only intermediates + one audio pass. Every Remotion export's audio is +42.7 ms. Results below |
| **T2** | **Decoder swap** | Is `@remotion/media` faster? Does colour hold on D-Log? Does 4K HEVC decode or fall back? | ~1 day | **DONE 2026-08-28** — conditional: loses at 1 layer, wins at 3. Colour holds; HEVC decodes. Results below |
| **T3** | **Proxy codec A/B** | What proxies should be made of (all-intra vs GOP 5 vs today's GOP 15 vs MJPEG) | ½ day | **DONE 2026-09-02** — all-intra 540p: fling p50 32 → 25 ms, 12% faster to make, 2.6× disk; tail unchanged; MJPEG will not play. Shipped as the proxy profile. Results below |
| **T4** | **Proxy generation cost** | How long a real project makes you wait, and whether `-hwaccel d3d11va` on the input helps | ~2 h | **DONE 2026-09-02** — yes, but only on the *discrete* adapter (1.6× faster, half the CPU); the default adapter halves CPU and saves no time. Results below |
| **T4b** | **GPU encode** | Is a downloaded full ffmpeg with NVENC worth an opt-in setting? | ~½ day | **DONE 2026-09-02** — yes, but only with the *whole* pipeline on the card (NVDEC → `scale_cuda` → NVENC): 1.9× on wall, **31× less CPU**, same size, scrubs the same. NVENC fed from system memory is *slower* than x264. Shipped opt-in, off by default. Results below |
| **T5** | **Resolution ceiling** | Replaces the *assertion* that 8K breaks with a number and a failure mode | ½ day | **DONE 2026-09-03** — 8K exports correctly (900 frames, 434 MB, 28 min for 30 s); the walls are memory (stitcher ffmpeg 0.5 → 7.8 GB from 1080p to 8K, compositor cache starvation = `No frame found at position`) and time (0.5–1.4 frames/s from 4K60 HEVC at any output size). Results below |
| **T6** | **Long-project stress** | Whether 3–5 h of 4K is a supported use case or a documented limit | ~1 day | **DONE 2026-09-03** — documented limit, wall named: **export** (~1 frame/s from 4K60 HEVC → 3 h timeline ≈ 3.5 days). Proxies are a wait (1 h 54 min x264 / ~1 h 03 min GPU for 3 h), session memory is not a wall (1.4 GB peak, no crash in 7 h), scrub cost is unchanged by length. Results below |
| **T7** | **Effects load probe** | Whether slice 10 needs "disable effects in preview" from day one | ½ day | optional — not run 2026-09-03 (T5/T6 took the day); T2's element-count cliff is the nearest datum |
| **T8** | **Export path options + tests** | Whether long-form export can be fixed, and how: `@remotion/media` decoder for export (T8a), all-intra intermediates (T8b), the ffmpeg NVDEC→NVENC passthrough floor (T8c) | 3 × ~30 min | **DONE 2026-09-04** — the screenshot is the wall, not the decode: every browser path lands at 1.8–2.3 frames/s once the source decode is removed or cheapened (T8a `<Video>` cannot decode HEVC in headless Chrome at all and falls back; with a GPU backend it hangs; on H.264 it engages and is a wash; T8b all-intra intermediate +15–25 %, 0.9 GB/min). The ffmpeg passthrough floor (T8c) is **3.4× realtime, 3 CPU-s, colour intact** — ~100× the browser. Results below |

**Source material (checked 2026-08-28):** `raw/` holds **9 DJI clips, 15 GB,
27 minutes total — 3840×2160, 60 fps, 10-bit HEVC (D-Log)**. Enough for
T0–T5 as-is. T6 needs ~3 h, so it must synthesise length by importing the
same clips repeatedly as separate assets (which also stresses the per-asset
proxy queue honestly).

**Caveat that applies to every result below:** these are one machine's
numbers. Ratios should transfer; absolute values will not. T2 and T5 are the
two worth repeating on a second machine (ideally an Intel iGPU laptop) before
anything is decided on them.

---

## T0 — scrub benchmark harness · DONE

`node scripts/bench/run-bench.mjs --from-project=raw-footage-test --media=proxy|original`

Mounts the **real** `TimelineComposition` in a real `@remotion/player`, inside
**Electron** — decoder behaviour is a property of the Chromium build the app
ships, so measuring in a stray Chrome would answer a question nobody asked.
Reports (machine, git sha, fixture config, every raw sample) land in
`.vidtsx-temp/bench/`.

### Two traps it had to be fixed for

Both produced *beautiful* numbers, and both are recorded in
`scripts/bench/README.md` for whoever extends this:

1. **Animation frames measure the monitor, not the video.** `seekTo()` only
   sets state; decode is asynchronous and rAF keeps firing at the refresh rate
   regardless. The first version reported a flawless 16.7 ms (60 Hz vsync) for
   every configuration including ones that visibly lag. Fixed by using
   `requestVideoFrameCallback`, which fires on real presentation and reports
   *which* frame arrived — so it measures cost and correctness together.
   **Consequence: the `57 ms` in `proxy-generator.ts` and the `17–25 ms` in
   Status.md's S2 checkpoint may measure the same wrong thing. Treat them as
   not comparable with anything below.**
2. **Expected-time math must mirror the fixture's frame rounding**, or 78/150
   steps look like decoder misses that are really the harness's fault.

A third guard is built in: the harness **refuses to measure** when rAF is
throttled (occluded/minimised window), per `docs/ui-automation-cdp.md`.

### Baseline — 2026-08-28

Fixture: 40 clips × 1 layer, 1920×1080 @ 30 fps, sources = the Raw Footage
Test DJI clips (3840×2160, 60 fps, 10-bit HEVC), 2 runs.

| Scenario | 720p proxy (GOP 15) | 4K HEVC original |
|---|---|---|
| scrub, natural (1 frame) | **16.6 ms** · 60 steps/s · 0 miss | **101.5 ms** · 9.9 steps/s · 1 miss |
| scrub, fling (15 frames) | **48.3 ms** · 20.7 steps/s · 0 miss | **281 ms** · 3.6 steps/s · **70 miss** |
| playback | **59.9 fps** presented | **59.9 fps** presented |
| app's own JS per step | 0.1 ms | 0.1 ms |
| frame accuracy (err p50) | 8.5 ms | 8.2 ms |

### What it changed

1. **The app's own code is not the bottleneck — 0.1 ms/step, everywhere.**
   Not React, not the serializer, not the timeline UI. The architecture doc
   asserted this; it is now measured.
2. **Proxies earn their keep (~6× on both scrub modes).** The existing design
   works. The residual pain is *flinging on proxies* — 48 ms p50 / 80 ms p90 ≈
   21 steps/s. A GOP-15 proxy of a 60 fps source still decodes up to 15 frames
   per seek, which is exactly what T3 attacks.
3. **The same 4K file that costs 281 ms per SEEK plays back at 59.9 fps.**
   Decoding 4K 10-bit HEVC is not hard for this machine; *seeking* it is. That
   is the entire "hold the decoder open and decode forward" argument
   (`PREVIEW_ARCHITECTURE.md` §D), now evidence rather than assertion.

---

## T1 — fidelity baseline · DONE 2026-09-04

**Question:** what is our WYSIWYG claim actually worth today, as a number —
and is a passthrough export (`docs/studio/PLAN.md` §5) provable *within*
that number? Hasan decided 2026-09-04: passthrough first, full hybrid only
later and per span type. T1 gates the build. Three legs, all on the same
30 s spans at the same composition frames, on the D-Log clip (`t5-1080p`:
DJI 4K60 10-bit HEVC, 1920×1080 @ 30, 900 frames) **and** ordinary footage
(`t5-1080p-h264`: the video-2 4K60 H.264 master), each repeated.

**Method.** Frames are compared by *index*: composition frame f against
frame f of a 30 fps CFR file, per channel mean absolute difference, share
of pixels over 8 and over 24, max delta, and a side-by-side still
(`t1-diff.mjs`, the `t8-output-diff` format generalised to PNG inputs and
an index offset). Frame *identity* is settled separately: `t1-frame-map.mjs`
pulls the six source frames around t = sourceIn + f/30 (input-seeked with
`-copyts`, so each candidate's pts is read, not assumed) and reports which
one a given picture actually is — the mapping rule is measured, never
inferred from a diff. Instruments, all under `scripts/bench/`:

| script | does |
|---|---|
| `t1-preview-capture.mjs` | the **real** preview: opens the project in the dev app over CDP, finds the Player handle by walking the React fiber tree up from the `<video>` (no product code), seeks, waits for `requestVideoFrameCallback` to report the presented `mediaTime`, captures the Player box at **1:1** (a DPR-1 emulated viewport converged so the box is exactly 1920 px wide) |
| `t1-frame-map.mjs` | which source frame a picture (export frame or screenshot) shows |
| `t1-diff.mjs` | the pixel diff + stills, `--b-offset` for sub-compositions |
| `t8-ffmpeg.mjs --conform=nearest\|fps-near\|r30 --source-in --first=ceil --source` | the passthrough spans with a chosen frame-mapping rule |
| `t1-join.mjs` | passthrough span + browser span → one file (`ts` = PLAN §5's TS intermediates, `mp4` = the proxy generator's concat recipe, `--audio` = one audio pass) |
| `t1-audio-offset.mjs` | lag of one file's audio against another by normalised cross-correlation in 1 s windows (±120 ms) |

Two CDP lessons that cost time: an occluded window presents nothing (rvfc
never fires) and `Page.captureScreenshot` hangs — the capture script now
maximises and foregrounds the app window at the OS level first; and a
killed run leaves `Emulation.setDeviceMetricsOverride` in force for the next
one (clear it on entry). Sources: `.vidtsx-temp/bench/t1/` (`preview/`,
`frame-map/`, `stills/` with 200 side-by-sides, `join/`, `audio/`,
`summary.json` — one row per comparison), the two Export-button runs
`join-export.json` / `cut-export.json`, the passthroughs in `…/bench/t8/`.

### Leg 0 — which source frame each side shows (the mapping rule)

Every 30 fps composition frame f has to pick one of the 59.94 fps source
frames K near t = f/30. Measured on 14 indices per file:

| picture | rule | evidence |
|---|---|---|
| **Remotion export** (`<OffthreadVideo>`, healthy run) | **nearest pts to t** — K = round(t·60000/1001) | control 2, the H.264 control and the two-clip cut export agree at all 14 indices, including f=30 → K 60, f=600 → 1199, f=870 → 1738 |
| Remotion export, **first frame of a composition** that starts mid-source (`startFrom` 450) | **first frame with pts ≥ t** (ceil) | the sub-composition shows K 900 at its frame 0 where the full export shows 899; frames 1+ nearest again |
| Remotion export at a **timeline cut** inside one composition | nearest — same as no cut | two-clip project (0–15 s from source 0, 15–30 s from source 15): frame 450 = K 899, **byte-identical** to the single-clip export at 448–452 |
| Remotion export at a cut to a **different source file** (export-engines Stage 3, 2026-09-06) | **ceil** on the first frame after the file is *opened* — the first clip of that file on the timeline | `t5-1080p-cut-files` (0270 0–3 s, then 0272 from 15 s): frame 90 = K 900 where nearest is 899 (the passthrough's nearest 899 read 0.51 % over 24 against it, max 142); with 0272 from 6.667 s, where nearest = ceil = 400, frame 90 = K 400 and not 401 — the ceil, not "the frame after the nearest" |
| Remotion export on a **return to a file already opened** | nearest — like a same-file cut | `t5-1080p-cut-files2` (0270 0–3 s → 0272 → 0270 from 30 s): frame 180 = K 1798, the nearest (ceil 1799 reads 0.047 % against it, 1798 0.016 %); measured 2026-09-11 on a moving shot (`t5-1080p-cut-return*`, export-engines plan §Stage 4 log): a return after 320 s of four other files, after 1 min through two, a 4.4 s seek inside the open stream and a 36 s jump back all show the nearest — the compositor closing an idle file does not turn a return into an open; the ceil is the first frame a render ever extracts from a file |
| Remotion export, **memory-starved** run (control 1, 384 MB free) | **not a rule** | duplicates K 59 at f=29 *and* 30, shows 898 / 899 / 902 at 449–451, ceil at 870 and 899; the cache manager (`frame_cache.rs get_item_id`, threshold 10⁹) returns whatever nearest frame survived eviction |
| **Preview** (Player, 540p proxy in a `<video>`) | **last frame with pts ≤ t** (floor) — K = floor(t·60000/1001) | rvfc `mediaTime` at every capture: f=30 → 0.984317 (K 59), f=600 → 19.986633 (K 1198); both codecs, both passes |
| ffmpeg `-r 30` conform (T8c) | two source frames early — K = 2f−3 | f=30 → 57, f=600 → 1196; 902 frames |
| ffmpeg `fps=30:round=near` | nearest for the first seconds, ceil later (drift) | f=300 → 600, f=870 → 1739; 900 frames |
| **`select` on absolute pts, nearest** (the new `--conform=nearest`) | nearest, every index | matches the healthy export at all 14 indices; `--first=ceil` matches the sub-composition's frame 0 |

So preview and export already disagree on *which frame* on roughly half of
all frames (whenever the nearest source frame lies after t): a one-source-
frame (16.7 ms) timing difference that has always been part of the WYSIWYG
gap and had never been measured.

**The frame-mapping rule, written down for the build:** for output frame n
of a span starting at source time S = startFrom/fps: take the source frame
with the pts nearest to S + n/fps (ties by measurement do not occur at
59.94 → 30). In ffmpeg, with `-ss (S − ½ source frame)` so the nearest
frame *before* S is decoded, `-copyts`, then
`select='eq(floor((S+round((t−S)·30)/30)/D+0.5),round(t/D))'` (D = one source
frame in seconds), `setpts=N/(30·TB)`, `-r 30 -fps_mode cfr -frames:v N`.
Neither `-r 30` nor the `fps` filter reproduces it. A span rendered by the
browser as its *own* composition shows the ceil frame at its first frame
(`--first=ceil` reproduces that) — see leg 3 for what the build does about it.
The same ceil rule applies to the first frame of the FIRST clip of every
source file on the timeline (the export opens the file there, measured
2026-09-06, rows above); a later clip of a file already opened — a same-file
cut or a return — shows the nearest. The span planner
(`src/shared/studio/export-spans.ts`, `firstFrameCeil`) carries both cases.

### Leg 1 — preview vs export today (the tolerance)

10 frames (1, 29, 30, 300, 449, 450, 451, 600, 870, 899), the Player at 1:1
over the shipped 540p all-intra proxy, against a healthy export of the same
project:

| span | mean abs diff per channel | pixels > 8 | pixels > 24 | max | repeat (pass A vs B) |
|---|---|---|---|---|---|
| **D-Log HEVC** (vs control 2) | **3.35 – 4.80 / 255** | 15.3 – 18.5 % | 0.84 – **3.01 %** | 208 | **0 / 0 / 0** — screenshots byte-identical |
| D-Log HEVC (vs control 1, the starved run) | 3.38 – 5.13 | 15.8 – 18.9 % | 0.89 – 3.37 % | 208 | — |
| **H.264 master** (vs its control) | **3.15 – 4.32 / 255** | 14.4 – 17.5 % | 1.06 – 1.48 % | 154 | 0 / 0 / 0 |

Two things make up the number. (1) The timing: at f=1, 29, 30 and 600 the
preview shows the source frame *before* the one the export shows (those are
the rows at 3 % over 24 and max 200+). (2) A uniform shift: the preview is
brighter — whole-frame means 164/155/148 vs 164/152/149 on the D-Log clip
(+2–3 on green), 166/154/150 vs 164/152/148 on H.264 (+2 on every channel).
The frame-map makes the side clear: the preview is 3.5–3.9/255 from the
source frame it shows; the export is 1.3–1.6 from the source frame *it*
shows; so the gap lives on the preview side (proxy encode + the `<video>`
element's colour conversion), not in the export. Neither the proxy
(`yuv420p tv bt709`) nor the source is mis-tagged; the export itself is
tagged `yuvj420p pc bt470bg` — Remotion's PNG → x264 path, self-consistent
but a different tag set from every camera file and from the passthrough.

**Tolerance = leg 1's D-Log row: per-frame mean ≤ 4.8/255, ≤ 18.5 % of
pixels over 8, ≤ 3.0 % over 24, max 208, plus one source frame of timing
on about half of all frames and a +2–3/255 preview-side brightness offset.**
That is what the WYSIWYG claim is worth today, and it is stable (repeat: 0).

### Leg 2 — export vs ffmpeg passthrough

The T8c pipeline (NVDEC → `scale_cuda` 1920×1080 → `h264_nvenc` p5 VBR cq 23)
with the nearest-pts select above, against the same healthy exports:

| span | mean abs diff | pixels > 8 | pixels > 24 | max | repeat (encode A vs B) | wall / CPU for 30 s |
|---|---|---|---|---|---|---|
| **D-Log HEVC** nearest vs control 2 | **1.23 – 1.71 / 255** | 0.91 – 1.6 % | **0 %** | 44 | 0 / 0 / 0 — NVENC output byte-identical | 7.7 s / 3.6 CPU-s (3.9×) |
| **H.264 master** nearest vs its control | **0.97 – 1.74 / 255** | 0.87 – 1.7 % | **0 %** | 40 | 0 / 0 / 0 | 15.7 s / 7.8 CPU-s (1.9×) |
| for contrast: T8c's `-r 30` vs control 2 | 1.43 – 6.13 | up to 13.8 % | up to **5.57 %** | 227 | — | — |
| for scale: control 2 vs control 1 (two Remotion runs) | 0 – 3.12 | up to 7.8 % | up to 2.6 % (where the starved run picked other frames; 0 % elsewhere) | 195 | — | — |
| for scale: cut export vs control 2 (two healthy Remotion runs) | **0** at 448–452 | 0 | 0 | 0 | — | — |

Channel means within 1/255 at every index (colour intact, as T8c found).
With the mapping fixed, the passthrough is **three times closer to the
export than the preview is** on every metric, and it never puts a pixel
over 24. Its residue is encoder noise (x264 CRF vs NVENC cq 23) on the same
source frame. Healthy Remotion exports are themselves deterministic
(byte-identical frames run to run), so this is a real bound, not noise.

### Leg 3 — the join

Passthrough 0–15 s (450 frames, nearest) + a browser-rendered 15–30 s
(`t5-1080p-join`: the same clip as its own composition with `startFrom`
450, exported through the Export button, 467 s at 0.96 frames/s — the day's
memory again) concatenated, checked against the two-clip **cut export**
(the real timeline case) and against the single-clip export.

**Video at the seam.**

| join | frames | video pts at the seam | 448 / 449 | **450** | 451 / 452 / 460… | what happened |
|---|---|---|---|---|---|---|
| mixed encoders, proxy-generator **mp4 concat** recipe | 900 | 14.988 → **87.91 s** | — | — | — | the concat demuxer cannot place Remotion's x264 file (edit list, other timebase) after an NVENC file: timestamps jump, duration 175 s |
| mixed encoders, **TS** intermediates | 900 | 14.9877 → 15.021 (whole file +21 ms) | 1.44 / 1.46 | *not decodable* | — | the decoder drops frames at the SPS/PPS switch (frame 450 cannot be extracted), and the file carries the first half's `tv/bt709` tags over the second half's `pc/bt470bg` payload |
| **same encoder**: browser frames decoded to RGB → NVENC with the passthrough's settings, **TS video-only** intermediates, one audio pass muxed last | **900** | exact: 14.9667, **15.000**, 15.0333 (start 0.000) | 1.44 / 1.46 | 3.14 (1.67 % > 24) | 1.73 / 1.71 / 1.66 … 1.70 at 899, **0 % > 24** | no duplicated or dropped frame; the seam is invisible except frame 450 |
| same encoder, mp4 concat recipe | 900 | start **0.021 s** | same | same | same | the mp4 route starts the video 21 ms late (the first file's audio priming); TS wins |

Frame 450 in the same-encoder join is the sub-composition's ceil frame
(K 900) against the cut export's nearest frame (K 899) — the one rule
difference from leg 0, and it is the browser span's, not the passthrough's:
the passthrough with `--first=ceil` matches the sub-composition at 1.43
(frames 0–2 and 449 at 1.4–1.7), with nearest it matches the cut export.
Everything else at the seam is two encoder generations (x264 export → NVENC
re-encode) at 1.6–2.0/255, 0 % over 24 — under leg 2's bound, a third of
leg 1's.

**Audio at the seam.**

| file | lag vs the source's own audio at 0.5 / 13.5 / 14.5 / 15.2 / 16 / 29 s |
|---|---|
| passthrough (ffmpeg, either span, either codec) | 0 / 0 / 0 / 0 / 0 / 0 ms |
| **every Remotion export** — HEVC control, H.264 control, cut export, sub-composition | **+42.7 ms** at every window (2048 samples; the export's audio edit list starts at media time 0, i.e. no priming skip, 1409 AAC frames for 30.0 s) |
| join with the halves' **own** audio (TS or mp4) | 21.3 / 21.3 / 21.3 / **82.7** / 82.7 / 82.7 ms — a **61 ms jump at the seam** |
| join with **one audio pass** for the whole span (TS video-only + that track) | **0 / 0 / 0 / 0 / 0 / 0 ms** |

So a seam is audio-continuous only with a single audio pass over the whole
timeline (the proxy generator's own lesson, re-measured), and that pass
will sit 42.7 ms off every export the app makes today. Which of the two is
lip-synced to the picture is not something T1 can say (it needs a clap on a
known frame); that every Remotion export carries a fixed +42.7 ms is new,
and is a ticket in its own right.

### Verdict

Pass criterion "a stable number across repeat runs": met — every repeat is
0 (screenshots, NVENC encodes, healthy exports). **The tolerance is leg 1:
mean ≤ 4.8/255, ≤ 3.0 % of pixels over 24, one source frame of timing, a
+2–3/255 preview offset.** Leg 2 sits at mean ≤ 1.74, 0 % over 24 and the
same source frame at every index, on both the D-Log HEVC and the H.264
master; leg 3's seam is at leg 2's level with no dropped or duplicated
frame and 0 ms of audio offset when the audio is one pass. **The
passthrough join is provable at the tolerance, with a margin of about 3×,
under four conditions the build has to meet:** the nearest-pts select (not
`-r`/`fps`), one encoder for both span kinds (browser frames encoded by our
ffmpeg with the passthrough's settings, never Remotion's x264 file
concatenated as-is), TS video-only intermediates with the audio muxed last
from one pass, and the first frame of every browser-rendered span handled
(render it one frame early and drop the lead-in, or accept the sub-
composition's ceil frame — a one-source-frame deviation inside the leg 1
tolerance, outside leg 2's).

**Findings for tickets** (building paused, none fixed): Remotion export
audio +42.7 ms vs the source on every export; exports tagged `yuvj420p pc
bt470bg`; the preview's +2–3/255 brightness offset over proxies; a memory-
starved export silently shows the wrong source frame (dup/skip) and there
is no way to tell from the queue record; Studio exports of a 15 s
sub-composition still take 7.8 min (0.96 frames/s — the touched-span
cost T8 predicted). Left on disk: projects `t5-1080p-join`, `t5-1080p-cut`
(Recycle-Bin delete via the app), ~1.2 GB under `.vidtsx-temp/bench/t1/`; the
12 `%TEMP%emotion-v4…` folders today's exports left behind are empty (48 KB).

---

## T2 — decoder swap · DONE 2026-08-28

**Question:** does `@remotion/media` (Mediabunny + WebCodecs) actually fix
seeking, and can it be adopted without breaking anything?

**What was done:** added `@remotion/media@4.0.435` (pin-hold route (a) — exact
pin, depends on `remotion@4.0.435`, no train movement), swapped `case 'video'`
in `TimelineComposition.tsx` behind `src/shared/studio/media-engine.ts`
(default `offthread`, so nothing that ships changed), and re-ran T0 on both
media tiers at 1 and 3 layers.

### The harness had to be extended, and that is the first finding

**T0 could not run against it unchanged.** `@remotion/media` has no `<video>`
element: on the WebCodecs path it holds a decoder open and draws each frame
into a `<canvas>`. `requestVideoFrameCallback` — the API T0 is built on, and
the fix for trap #1 — does not exist there. Pointed at the new engine, the
untouched harness reports **150/150 misses**, which reads as a catastrophic
decoder and is really an instrument aimed at an element that is no longer
there.

The replacement probe had to keep *both* of rvfc's properties — **when** a
frame was presented and **which** frame it was — or it would be the same trap
in new clothes. The channel carrying both is `@remotion/media`'s own trace log:
at `logLevel: 'trace'` it emits `Drew frame <seconds>s` immediately after
`drawImage`. `scripts/bench/harness/probes.ts` taps it, and deliberately does
not forward those lines to the real console — the driver holds `Runtime.enable`,
so every console call would be serialised over CDP and the benchmark would be
timing its own instrument.

**Instrument cost, measured not assumed:** the tap fires ~300 times in a fling
run lasting ~7.5 s (the engine draws ~2 frames per seek, not 15). At a generous
10 µs per call that is 3 ms — 0.04%. The `--media-log=off` control confirms the
tap is the *only* observation channel and fabricates nothing: disarmed, 150/150
steps miss and 0 frames are seen.

**Two harness bugs were caught by disagreeing with the control**, both of which
had inflated the miss count against WebCodecs:

1. The canvas path had no "already on screen" check, so a step re-requesting a
   frame already displayed waited 400 ms for a draw that was never coming.
2. More subtly, the step that **crosses a cut** is usually free because
   `premountFor` has already painted the incoming clip. The video probe sees
   this by reading `currentTime` off every element; the trace log does not say
   which canvas drew. Fixed with a recency-bounded search of the draw stream.
   Before the fix: 8 and 24 "misses" sitting exactly where the control reported
   8 and 23 **cached** steps.

A third artefact is now refused rather than reported: with N layers the draw
stream interleaves N surfaces, so playback gaps collapse toward zero — a
3-layer run reported **"10000 fps"**. The `<video>` path has the identical flaw
(it reported "Infinity fps"); both are now guarded.

### Results

Control and treatment were run **in the same session**, because fling p50 on
proxies is sensitive to OS file-cache warmth: the offthread control reproduced
T0's baseline on every figure except fling, which came in at 32.6 ms against
the published 48.3 ms. **Compare against the control column below, not against
the T0 baseline table.**

**720p H.264 proxy (GOP 15, 59.94 fps), 1 layer**

| | offthread (control) | webcodecs | verdict |
|---|---|---|---|
| scrub natural p50 | 16.6 ms | **16.0 ms** | wash |
| scrub natural p90 | 17.3 ms | 21.6 ms | worse tail |
| scrub fling p50 | **32.6 ms** | 47.7 ms | **46% worse** |
| scrub fling p90 | **49.4 ms** | 68.6 ms | worse |
| playback presented | 59.9 fps | 30.0 fps | *see note* |
| frame accuracy err p50 | 8.4 ms | 8.0 ms | wash |
| misses | 0 | 0 | — |

**4K 59.94 fps 10-bit HEVC original (D-Log), 1 layer**

| | offthread (control) | webcodecs | verdict |
|---|---|---|---|
| scrub natural p50 | 90.0 ms | **19.0 ms** | **4.7× better** |
| scrub natural p90 | **144.6 ms** | 195.6 ms | worse tail |
| scrub fling p50 | **280.1 ms** | 400 ms (timeout) | **fails outright** |
| scrub fling misses | 75 / 300 | **254 / 300** | far worse |
| playback presented | **59.9 fps** | 8.4 fps | **real regression** |

**720p proxy, 3 layers — the result that inverts the conclusion**

| | offthread | webcodecs | verdict |
|---|---|---|---|
| scrub natural p50 | 66.4 ms (**63 misses**) | **31.6 ms (0 misses)** | **2.1× better** |
| scrub fling p50 | 400 ms (**142 misses**) | **130.6–134.2 ms (0 misses)** | **3× better** |

Replicated over two runs. At three layers the shipping path **collapses** —
nine simultaneous `<video>` elements each servicing a seek — while the
WebCodecs path degrades gracefully. **But see the follow-up below: the driver
is the concurrent `<video>` count, not the layer count, and two layers of
ordinary-length clips is perfectly fine.**

**Note on playback fps.** 59.9 → 30.0 on proxies is *not* a smoothness loss.
The composition is 30 fps and the sources are 59.94 fps: `<OffthreadVideo>`
mounts a `<video>` that free-runs at the source rate, presenting frames the
composition never asked for, while `@remotion/media` draws exactly the
composition's frames. **30.0 fps on a 30 fps composition is the frame-accurate
answer, and the one matching what export produces.** The 8.4 fps on 4K
originals is a different matter and is a genuine regression — it is below the
composition's own frame rate.

### Codec coverage — the D3.2 risk did not materialise

| source | codec string | result |
|---|---|---|
| proxy H.264 | `avc1.640020` | **SUPPORTED** |
| DJI 4K 10-bit HEVC | `hev1.2.4.H150` | **SUPPORTED** |

**100% of frames presented through WebCodecs; zero fell back to
`<OffthreadVideo>`; zero `<video>` elements mounted; no decoder errors.** DJI
10-bit HEVC decodes natively in the Chromium the app ships. The fallback
asymmetry feared in §D3.2 cannot arise from *this* footage in preview, because
nothing falls back.

**Not verified: the export half.** The pass criterion asked whether HEVC falls
back *identically in preview and export*. Preview never falls back, so there is
nothing to match — but the export path (`video-for-rendering`, a different code
path from `video-for-preview`) was not measured. Since preview decodes
everything, the open risk is the reverse asymmetry: export falling back where
preview does not. **Untested, and it stays untested until someone runs an
export on the webcodecs engine.**

### Decoder sessions (D3.4)

Open decoders track `layers × clips-in-mount-window` exactly: **3 open at 1
layer, 9 at 3 layers**, with no errors and no throttling at either. No limit
was reached, so behaviour *at* the limit remains unobserved.

Churn is high and worth knowing before anyone ships this: **454 decoders
created** in a single-layer proxy run, **1,273** across two 3-layer fling runs
— a new decoder per seek rather than one held open and reused. That is a
plausible share of the single-layer fling regression.

### Colour — the D3.3 risk did not materialise either

`node scripts/bench/run-frame-diff.mjs --from-project=raw-footage-test --media=original`

8 frames, on the **10-bit D-Log 4K originals** (the proxies are 8-bit Rec.709
H.264, where nothing interesting can happen):

| | |
|---|---|
| worst mean channel delta | **0.283 / 255** |
| worst signed mean delta | **0.15 / 255** |
| worst max channel delta | 107 / 255, on **0.16% of pixels** |
| whole-frame mean RGB | 164.3/154.9/150.8 vs 164.1/154.7/150.7 |

**No systematic colour divergence.** A tone-mapping disagreement on D-Log would
show as a large *uniform signed* shift across nearly every pixel; the signed
mean is 0.15/255 (0.06%). The large max deltas sit on ~0.15% of pixels — edge
and sub-frame-timing noise, not a colour-space error. The screenshots were
verified to contain real picture (stdev ~60 per channel), so this is not the
trivial "two black rectangles match" result.

**Why this comparison and not preview-vs-export (T1).** T2 risks a *new*
divergence, and the export side does not move — so `d(new, export) ≤ d(new,
old) + d(old, export)`, and a measured `d(new, old) ≈ 0` bounds the new gap at
whatever the old one was, without T1 built first. That is a stronger statement
than "within tolerance". **Its one limit:** had the decoders disagreed, this
test could not say which was right — the pre-agreed escalation trigger to build
the export leg. It did not fire. T1 remains worth building as its own
instrument; T2 simply did not depend on it.

### Follow-up: what the 3-layer collapse actually is (measured after the fact)

The first write-up of this test said the shipping path "collapses at 3 layers".
**That was measured on one run and stated too broadly.** Pinning it down changes
the conclusion, so the correction matters more than the original claim.

**It is not layer count. It is the number of `<video>` elements alive at once**,
which is `layers × clips inside the 2 s mount window` — so a dense sequence of
short clips multiplies it exactly the same way a stack of layers does.

| fixture | `<video>` alive | fling p50 | fling misses |
|---|---|---|---|
| 1 layer, 1.2 s clips | 3 | 32.6 ms | 0 / 300 |
| 2 layers, **6 s** clips | 2 | 32.6 ms | **0 / 300** |
| 3 layers, **6 s** clips | 3 | 51 ms | 53 / 300 |
| 2 layers, 1.2 s clips | 6 | **400 ms** | **270 / 300** |
| 3 layers, 1.2 s clips | 9 | **400 ms** | **142 / 150** |

Read down the `<video>` column, not the layer column: **two layers of ordinary
6-second clips is completely fine (zero misses), and two layers of 1.2-second
clips is a catastrophe.** Same layer count, opposite outcome. The cliff sits
between 3 and 6 concurrent elements.

That reframes the T2 result above. WebCodecs is not "better with layers" — it is
better *at concurrency*, degrading smoothly where `<video>` elements fall off a
cliff (at 2 layers × 1.2 s it holds 85.6 ms with zero misses against 400 ms and
270 misses). The 1-layer comparison, where `<OffthreadVideo>` wins, is measuring
the regime the shipping path is good at.

**This is a finding about what ships today, independent of T2**, and it is the
first hard evidence for a limit the architecture doc only guessed at. Two
consequences worth carrying forward:

- **It is a concrete C1 optimisation lead.** `MOUNT_WINDOW_SECONDS = 2` plus
  `premountFor` is what multiplies the element count. Capping how many video
  clips may be mounted at once — or shrinking the window when the timeline is
  cut-dense — attacks the cliff directly, in the engine we already ship, with
  no dependency change. **Not implemented: building is paused.**
- **It changes what T6 (long-project stress) should look for.** The failure
  mode to hunt is not project length but *local cut density around the
  playhead*, which a long project makes more likely rather than causes.

**Caveat on the fixture.** Every layer here is packed wall-to-wall with clips,
so all N layers have video at every instant — harsher than a real edit, where
an overlay is usually occasional. The `<video>`-count column is the transferable
number; the layer and clip-length columns are just two ways of arriving at it.
Reproduce with `--layers` and `--clip-seconds`.

### Verdict — measured, and it does not resolve to yes or no

| criterion | result |
|---|---|
| scrub p50 materially better on the fling case | **FAIL at 1 layer** (46% worse on proxy; outright timeout on 4K). **PASS at 3 layers** (3× better). |
| frame diff within tolerance | **PASS** — 0.15/255 systematic shift. |
| HEVC decodes or falls back identically in both hosts | **PARTIAL** — decodes natively in preview, never falls back. Export half unmeasured. |
| no new stalls | **FAIL** — 4K playback 59.9 → 8.4 fps; 4K fling is 254/300 timeouts. |

**The swap is not a win today, and it is not a flat no either — it inverts on
layer count.** On the single-layer timeline today's editor mostly shows, the
shipping path is better everywhere except natural-scrub median on originals. On
a three-layer timeline the shipping path falls apart and WebCodecs is the only
one still working. The strongest single number in the test is **4K natural
scrub p50: 90 ms → 19 ms** — the decode-forward win §D2 predicted, arriving
exactly where predicted, then undone by the fling and playback cases.

**Recommendation: keep the dependency and the flag, default off; do not ship
the swap.** Not because it is close to shippable — it is not — but because the
result is *conditional*, T3's premise ("the winning decoder changes what the
right proxy is") is now genuinely open rather than rhetorical, and reverting
throws away the ability to re-measure for the sake of one branch that is off by
default. Cost of keeping: one dependency, one `case`, all gates green. The
alternative — delete the dep and the `case`, keep the probes — remains cheap
and is Hasan's call.

**What would change this verdict, in priority order:**

1. **The 4K playback collapse (59.9 → 8.4 fps) is the thing to explain.** The
   same file plays at 59.9 fps through `<video>`. Mediabunny's `CanvasSink` is
   configured `{poolSize: 2, fit: 'contain', alpha: true}` and sizes its canvas
   to `videoTrack.displayWidth` — a full **3840×2160 RGBA** rasterisation per
   frame, displayed into a 960 px player. If that is the cost, it is a
   configuration problem, not a WebCodecs one.
2. **Decoder churn** — 454 created for one run. A held-and-reused decoder is
   the entire premise; this is not that.
3. **The 4.0.435 vintage.** It predates ~83 releases of fixes and calls itself
   "Experimental". A train-bump re-test (route (b)) would say whether any of the
   above is already fixed upstream — at the cost of re-vendoring
   `resources/vendor/`, per §D3.1.

## T3 — proxy codec A/B · DONE 2026-09-02

**Question:** what should stand-in copies be made of? Premiere's own docs give
the mechanism: intraframe media can be reduced at decode time, long-GOP media
must reconstruct a whole GOP first.

**Method:** the three DJI clips of `raw-footage-test` (370 s of 4K60 10-bit
HEVC) built six ways with `scripts/bench/run-proxy-cost.mjs` (`--gop
--height --crf --codec --out`), every variant decoded on the same NVIDIA
adapter so the encoder is the only thing that differs, then T0 pointed at each
folder with its new `--proxy-dir` flag. The four planned variants plus two
added to attribute the result: all-intra at 720p (is it the GOP or the
frame size?) and GOP 15 at 540p (is it just the frame size?). Fixture as T0:
40 clips × 1 layer, 1920×1080 @ 30 fps, runs=2.

**Every scrub number below comes from one session with the shipping profile
run first and last as the control**, per the hygiene T2 taught: fling p50 on
the control read 32.9 / 32.1 / 32.7 / 32.5 / 32.3 ms across the five
sessions, so the instrument held still.

| variant | encode wall (370 s) | CPU-s | disk | fling p50 | fling p90 | misses | natural p50 |
|---|---|---|---|---|---|---|---|
| **GOP 15 · 720p · CRF 26** (shipping until today) | 332 s | 1,920 | **53 MB** | 32.5 ms · 31 steps/s | 49 ms | 0 | 16.6 ms |
| GOP 5 · 720p · CRF 26 | 309 s | 1,919 | 105 MB (2.0×) | 28.5 ms · 35/s | 51 ms | 1 | 16.6 ms |
| **all-intra · 540p · CRF 28** | **291 s** | **1,609** | 141 MB (2.6×) | **24.6 ms · 41/s** | 43–53 ms | 0–1 | 16.6 ms |
| all-intra · 720p · CRF 28 | 303 s | 1,773 | 223 MB (4.2×) | 29.5 ms | **400 ms** | **16** | 16.6 ms |
| GOP 15 · 540p · CRF 26 | 308 s | 1,648 | 39 MB (0.7×) | 30.1 ms | 43 ms | 1 | 16.6 ms |
| MJPEG · 720p · q 5 | 294 s | 1,574 | **925 MB (17×)** | — | — | **295 / 300** | — |

What the table says:

1. **Natural scrub and playback are vsync-bound on every playable variant**
   (16.6 ms, 59.9 fps). There is nothing left to win there; the codec only
   matters for the fling.
2. **All-intra at 540p is the winner on two of the three criteria** — fling
   median 32 → 25 ms (24% better, 31 → 41 steps per second) and the fastest
   encode (12% less wall, 16% fewer CPU-seconds) — and loses on the third at
   2.6× the disk: about **23 MB per minute of 4K60 source**, so ~1.4 GB per
   hour of footage, ~7 GB for a 5-hour project.
3. **The tail did not move.** p90 sits at 43–53 ms for every playable
   variant including the control. That is three 60 Hz frames and reads as a
   seek-machinery cost, not a decode cost — which is consistent with T0's
   finding that the app's own work is 0.1 ms per step and with T2's decoder
   churn observation. All-intra buys the median, not the hitch.
4. **The win is part GOP, part frame size.** GOP 15 at 540p alone gets 30.1
   ms at 0.7× disk; all-intra at 720p gets 29.5 ms but with a broken tail (16
   misses, 400 ms p90, 4.2× disk). Only the combination — one keyframe per
   frame *and* fewer bytes per frame — moves the median cleanly.
5. **MJPEG is disqualified outright**: Chromium's `<video>` does not decode
   MJPEG in mp4 — 295 of 300 steps missed, playback presented 0 fps. Not
   slow: unplayable. And 17× the disk before that.
6. **One tail event, recorded not hidden.** In the session run right after a
   generation pass, the second all-intra-540 run reported 46.7 ms with 74
   misses. Two further sessions (four runs) put it at 24.2–26.2 ms with 0–1
   misses, so it is treated as machine state (page cache / thermal after 20
   minutes of transcoding), not the codec. Worth knowing if it ever recurs.

**Decision: ship all-intra 540p CRF 28 as the proxy profile** (`PROXY_HEIGHT
= 540`, `PROXY_GOP = 1`, `PROXY_CRF = 28` in `proxy-generator.ts`). It is a
judgement — a 24% median gain against 2.6× disk and a slightly softer
preview frame — and it is two constants to reverse; the segment-folder
manifest carries the profile tag, so a reversal never concatenates old and
new windows. Existing proxies are not regenerated; only new or deleted
ones get the new profile.

**Pass criterion "materially beats GOP 15 on the fling case at acceptable
disk cost": met on the median, honestly not on the tail.**

**Confirmed on the shipped pipeline** (segmented + concat, video-2's 632 s
H.264 master, old proxy kept as the control, run first and last):

| video-2 proxy | fling p50 | natural p50 | playback | err p50 |
|---|---|---|---|---|
| old · 720p GOP 15 (single pass) | 31.2 / 33.1 ms | 16.6 ms | 59.9 fps | 8.5 ms |
| **new · 540p all-intra, 11 windows joined** | **26.3 ms** | 16.6 ms | 59.9 fps | 7.2 ms |

The joined file scrubs and plays exactly like a single-pass one — which is
the point of the frame-exact join work described in Status.md.

---

## T4 — proxy generation cost · DONE 2026-09-02

**Question:** how long does a real project make you wait, and does
`-hwaccel d3d11va` on the transcode *input* help? (The bundled ffmpeg has no
hardware **encoders** — verified — so the NVENC branch in `proxy-generator.ts`
was dead code costing one failed spawn per session. Deleted in `9a3559b`,
the same commit that put every proxy/waveform ffmpeg at below-normal
priority.)

`node scripts/bench/run-proxy-cost.mjs --from-project=raw-footage-test --file=<video-2 master> --variants=sw,d3d11va,d3d11va1`

**Method:** the exact command `proxy-generator.ts` runs (720p, libx264
veryfast, CRF 26, GOP 15, AAC 128k) over the three DJI clips of
`raw-footage-test` (370 s of 3840×2160 59.94 fps 10-bit HEVC) plus the
video-2 master (632 s of 3840×2160 59.94 fps 8-bit H.264, 6.3 GB), two files
at a time, once per decode variant. `-hwaccel_output_format` is **not** set —
the `scale` filter needs frames in system memory. Per file, ffmpeg's own
`-benchmark` gives the CPU seconds it consumed; machine-wide CPU comes from
`os.cpus()` sampled every second; and the Windows *GPU Engine / VideoDecode*
performance counter, sampled per adapter, proves the decoder actually ran on
the GPU (ffmpeg falls back to software **silently** when a hwaccel cannot be
set up, and would otherwise have reported software numbers under a hardware
label).

**The default adapter is the wrong one on a hybrid laptop.** DXGI enumerates
the Intel iGPU as adapter 0 and the GTX 1650 Ti as adapter 1, and ffmpeg's
`-hwaccel d3d11va` takes adapter 0 unless told otherwise. The two are not
close:

| variant | wall for 1002 s of source | realtime | CPU-seconds | machine CPU | GPU decode engine |
|---|---|---|---|---|---|
| software decode (shipping) | **908 s** | 1.10× | **8,414** | 95% | 0% |
| `d3d11va` adapter 0 — Intel UHD | 939 s | 1.07× | 3,886 | 53% | Intel 41% avg / 55% max |
| `d3d11va` adapter 1 — NVIDIA | **567 s** | **1.77×** | 4,195 | 78% | NVIDIA 71% avg / 78% max |

Per file, so the two source types can be told apart (wall seconds; two files
were always running at once, so these are contended numbers, not clip-alone
numbers):

| file | software | Intel d3d11va | NVIDIA d3d11va |
|---|---|---|---|
| DJI 0270 · 139 s HEVC 10-bit | 605 | 251 | 220 |
| DJI 0271 · 73 s HEVC 10-bit | 201 | 129 | 114 |
| DJI 0272 · 158 s HEVC 10-bit | 303 | 268 | 232 |
| video-2 master · 632 s H.264 8-bit | 559 | **939** | 529 |

Three things this says:

1. **Software decode of 4K60 10-bit HEVC is the cost, not the x264 encode.**
   8,414 CPU-seconds for 1,002 seconds of source is 8.4 cores busy for the
   whole pass. That is what pinned the machine when video-2 opened, and it is
   why the priority fix (`9a3559b`) mattered before any speed-up: the wait is
   ~1× realtime either way, the difference is whether the editor is usable
   during it.
2. **Hardware decode halves the CPU bill on either adapter; only the discrete
   one shortens the wait.** The Intel path decodes the HEVC clips about 2×
   faster than software but is *slower* than software on the 8-bit H.264
   master (939 s vs 559 s) — its decode-and-download path saturates at about
   one 4K60 stream, and two were running. Net: no time saved, but the machine
   is half idle instead of pinned. The NVIDIA path is 1.6× faster on the whole
   pass and never worse than software on any file.
3. **The proof mattered.** The first version of the bench inferred "engaged"
   from a log line that only `-hwaccel auto` prints, and would have marked
   every hardware run as a software fallback. The counter is the evidence;
   the CPU-seconds halving is the corroboration.

**What ships (same session):** `proxy-hwaccel.ts` enumerates d3d11va
adapters once per session (`-init_hw_device d3d11va=dx:N`, no media touched,
~100 ms each), prefers the first non-Intel adapter, else the iGPU, else
software; `proxy-generator.ts` puts the chosen `-hwaccel d3d11va
-hwaccel_device N` on every segment's input with the same sticky fallback the
NVENC branch had — one failure and the session finishes in software. On a
desktop with one discrete card adapter 0 *is* that card and nothing changes.

**Pass:** met. A guarded, measurable win — on this machine, 1.6× on the wall
clock and half the CPU, with the caveat that the default-adapter half of the
win is CPU relief only.

**Not settled here:** the GPU-*encode* question (download a full ffmpeg on
first use for NVENC/QSV/AMF). With decode on the GPU the remaining cost is
x264 at 720p, which the per-file CPU numbers put at roughly 2 CPU-seconds
per source second — real but no longer the wall. That is Hasan's call, made
with these numbers rather than by default (see Status.md).

---

## T4b — GPU encode · DONE 2026-09-02

**Question:** Hasan's decision gate from T4 — with decode already on the GPU,
is it worth downloading a full ffmpeg on request so proxies can be *encoded*
on the GPU too (NVENC / Quick Sync / AMF)? Build only on a measured yes.

**Method:** `scripts/bench/run-proxy-cost.mjs` grew `--ffmpeg=<path>`,
`--encoder=x264|nvenc|qsv|amf`, `--cq`, `--preset`, two more decode variants
(`nvdec`, `cuda`, `d3d11va1cu`) and a *VideoEncode* GPU-engine sampler next to
the *VideoDecode* one — the same proof-not-inference rule as T4: an encoder
that quietly ran on the CPU shows ~0 on the encode engine. Same footage as T4
(three DJI 4K60 10-bit HEVC clips + the video-2 4K60 H.264 master, 1,002 s),
concurrency 2, and this time every arm makes the *shipped* profile (540p,
all-intra) so the encoder is the only difference. Then T0 against the
resulting proxies, control first and last in one session.

**Getting a working binary took three tries, and each one is a product
fact:**

1. gyan.dev's current *essentials* build (ffmpeg 9.0.1, 111 MB) lists
   `h264_nvenc` and then refuses to open it: *"Driver does not support the
   required nvenc API version. Required: 13.1 Found: 13.0 … minimum driver
   610.00"*. This laptop runs 592.82. So `-encoders` is necessary and not
   sufficient — the shipped probe **functionally encodes two frames** per
   candidate and records what opened, not what was listed.
2. gyan.dev deletes old versions (every 7.x/8.x URL is a 404), so a pinned
   catalogue entry with a SHA-256 has to come from BtbN's **dated monthly
   autobuild** releases, which stay up and publish `checksums.sha256`.
   Shipped entry: `autobuild-2026-08-31-13-27` →
   `ffmpeg-n8.1.2-50-g1a748fe2cd-win64-gpl-shared-8.1.zip` (80 MB, GPL v3,
   NVENC API 13.0 = driver 570+). The static variant is 168 MB for the same
   binaries; the shared one is chosen for the download size, and the 120 MB
   of headers/import libs it also carries are deleted after the probe.
3. NVENC's arguments are not x264's: `-g 1` is rejected ("Gop Length should
   be greater than number of B frames + 1", even with `-bf 0`) — intra-only
   is **`-g 0`**; there is no CRF — `-rc vbr -cq N -b:v 0`; and on this
   driver NVENC **cannot use the d3d11va decode device** (`CreateInputBuffer
   failed: EncodeAPI Internal Error`), it needs a CUDA device. Verified:
   every output frame is `key_frame=1 pict_type=I`, 37,893 frames on the
   master, all packets flagged K.

**Tuning the quality knob (60 s of DJI 0271, one file at a time):**

| variant | wall | realtime | CPU-s | MB / 60 s | GPU decode / encode |
|---|---|---|---|---|---|
| **x264 CRF 28** (bundled, d3d11va adapter 1) — control | 91.1 s | 0.66× | 250.6 | **22.8** | 36% / 0 |
| NVENC, frames via system memory (NVDEC → CPU `scale` → NVENC), cq 28 | 58.4 s | 1.03× | 162.6 | 39.2 | 50% / 9% |
| same, cq 32 | 55.7 s | 1.08× | 167.7 | 26.1 | |
| same, cq 36 | 53.0 s | 1.13× | 163.8 | 17.0 | |
| same, cq 40 | 52.3 s | 1.15× | 147.3 | 11.3 | |
| NVENC, d3d11va adapter 1 decode + separate CUDA device, cq 32 | 66.7 s | 0.90× | 170.9 | 26.1 | 44% / 8% |
| **NVENC, whole pipeline on the card** (NVDEC → `scale_cuda` → NVENC), cq 32 | **12.1 s** | **4.94×** | **8.2** | 25.3 | **100%** / 19% |

Two things this settles: the size-matched constant-quality value is **cq 33**
(interpolating 32 → 26.1 MB and 36 → 17.0 MB against x264's 22.8 MB; the
full pass below confirms it to 0.1%), and **the CPU-side 4K scaler costs
more than x264 does at 540p** — with decode *and* encode on the GPU, the
system-memory path still burns ~2.7 CPU-seconds per source second just
downloading and resizing 4K frames. Only the path that never brings frames
down to the CPU wins.

**Full pass (1,002 s of source, two files at a time, 540p all-intra, cq 33):**

| arm | wall | realtime | CPU-s | machine CPU | disk | GPU decode / encode |
|---|---|---|---|---|---|---|
| **x264 CRF 28** — what ships by default | 518 s | 1.93× | **3,281** | 75% | 392.6 MB | 70% / 0 |
| **NVENC, whole pipeline on the card** | **272 s** | **3.69×** | **107** | **30%** | 393.0 MB | **99%** / 13% |
| NVENC, d3d11va decode → CPU scale → NVENC (the "decode stays d3d11va" arm) | 556 s | 1.80× | 2,741 | 68% | 395.0 MB | 68% / 9% |

Per file, wall seconds (x264 / full-GPU NVENC / system-memory NVENC):

| file | x264 | NVENC on-card | NVENC via sysmem |
|---|---|---|---|
| DJI 0270 · 139 s HEVC 10-bit | 216 | **56** | 224 |
| DJI 0271 · 73 s HEVC 10-bit | 98 | **30** | 114 |
| DJI 0272 · 158 s HEVC 10-bit | 204 | **63** | 218 |
| video-2 master · 632 s H.264 8-bit | 484 | **272** | 524 |

What the numbers say:

1. **The on-card path is the only one worth shipping.** 1.9× on the pass
   (bounded by NVDEC at ~2.4× realtime per stream, which is why the 632 s
   master alone sets the wall), **31× fewer CPU-seconds**, the machine at
   30% instead of pinned at 75%, and the same bytes on disk. On the 10-bit
   HEVC clips the per-file gain is 3.2–3.9×; on the 8-bit H.264 master 1.8×.
2. **The system-memory arm is a loss** — slower than x264 on every file.
   Hardware encoders are not a drop-in for `-c:v libx264`; the frames have
   to stay where the encoder is. This is why the shipped NVENC path decodes
   with `-hwaccel cuda` (NVDEC, the same silicon d3d11va drives on that
   adapter) rather than the d3d11va args proxy-hwaccel.ts picks: the task
   said "decode stays d3d11va", and the measurement says that arm is the
   slow one. `scale_d3d11` (present in this build) would have been the
   vendor-neutral way to keep frames on the card, but it fails to configure
   on the 10-bit source (`Failed to configure output pad`); QSV and AMF
   therefore ship on the system-memory shape, unmeasured (no AMD here; Quick
   Sync on the iGPU opened in the probe but was not benchmarked), guarded by
   the same sticky fallback.
3. **Quality is size-matched, not proven equal.** cq 33 lands within 0.1% of
   x264 CRF 28 on the same footage (NVENC writes Main profile, x264 High).
   No PSNR/VMAF was run; for a 540p scrub proxy the bytes-per-frame parity
   plus the T0 result below is the bar that was set.

**T0 on the NVENC proxies** (raw-footage-test, 40 clips × 1 layer, runs=2,
fling p50 per run; control first and last):

| session | control (first) | NVENC | control (last) |
|---|---|---|---|
| A — control = the project's cached proxies (still the *old* 720p GOP-15 profile; T3 did not regenerate existing ones) | 33.0 / 33.0 ms | 29.6 / 26.7 ms (2 misses each) | 33.6 / 33.3 ms |
| **B — control = this pass's x264 540p all-intra proxies** | 28.5 / 25.7 ms | **21.3 / 21.7 ms, 0 misses** | 23.1 / 25.4 ms |

Natural scrub 16.6 ms and playback 59.9 fps on every run; frame-accuracy err
p50 8.4–8.5 ms on both. NVENC's all-intra proxies scrub at least as well as
x264's — same GOP structure, same size, and a Main-profile stream is if
anything cheaper to decode. On the video-2 master the same session shape
gave 25.8 / 26.0 → NVENC 29.9 / 24.9 → 25.2 / 23.7 ms, with one 32-miss
tail event on the first NVENC run and later a 21-miss one on a *control*
run that overlapped a dev-app build — the T3 hygiene note again (machine
state, not the codec). The clean video-2 rerun is under *Live verification*.

**Decision: build it, opt-in, off by default.** What ships (same session):

- `src/main/services/studio/ffmpeg-full.ts` — the pinned catalogue entry
  (URL, SHA-256, 80 MB, GPL v3) through the existing download manager into
  `userData/ffmpeg-full/`; the functional encoder probe cached in
  `encoders.json`; the sticky per-session fallback.
- `src/main/services/studio/proxy-encoders.ts` — pure: `-encoders` parsing,
  preference (NVENC › QSV › AMF), per-vendor args, the on-card plan for
  NVENC, profile tags (`nvenc-540p-intra-q33` etc.) so a folder of x264
  windows is never joined to GPU ones.
- `proxy-generator.ts` — when the setting is on and an encoder opened, every
  window runs on the full binary at the same below-normal priority; one
  failure latches the session to x264, wipes that asset's GPU windows and
  restarts it on x264. Audio pass, concat, media-jobs and the renderer
  contract are untouched; the Remotion export never sees the binary.
- Settings › Rendering › **"Faster proxy generation (GPU encoder)"** —
  Download (~76 MB) until installed, then "Detected: NVIDIA NVENC" (or
  "no supported GPU encoder works on this machine" with the checkbox
  disabled), the checkbox, and the fallback notice when it fired.
  `THIRD_PARTY_NOTICES.md` carries the GPL notice.

**Live verification** (dev app driven over CDP, `docs/ui-automation-cdp.md`):

- **Download via the row:** clicked *Download (~76 MB)* → 10 / 41 / 74 / 100%
  in 8 s → verifying → extracted → row reads **"Detected: NVIDIA NVENC"**,
  checkbox enabled. `encoders.json`: listed `nvenc, qsv, amf`, working
  `nvenc, qsv` — AMF listed and refused, exactly the case the functional
  probe exists for. `lib/`, `include/`, `doc/` removed; `LICENSE.txt` kept.
- **Enable → delete video-2's proxy → open project:** the ffmpeg child is
  `userData/ffmpeg-full/…/bin/ffmpeg.exe` with `-hwaccel cuda
  -hwaccel_output_format cuda … scale_cuda … h264_nvenc`, **PriorityClass
  BelowNormal**; Windows GPU-engine counters during the run: VideoEncode
  10.6%, VideoDecode 100% (NVDEC-bound, as the bench said). Segment manifest
  `profile: "nvenc-540p-intra-q33"`. Finished in ~5 min (the x264 wait on
  this file was 6 min 10 s; the master is 8-bit H.264, where NVDEC's ~2.3×
  is the ceiling — the 10-bit HEVC clips are where the 3–4× lives): **37,893
  frames, every packet a keyframe, duration 632.192 s**.
- **Kill/resume on the GPU path:** hard-killed the app with window 0 done
  and window 1 in flight → `seg-0000.mp4` + `seg-0001.mp4.<pid>.part.mp4`
  survived, no orphan ffmpeg → relaunched → log `Resumed proxy from finished
  segments` → finished with **37,893 frames, all keyframes, byte-identical
  size (260,386,344) to the uninterrupted run**.
- **Disable → next proxy is x264 again:** unticked the box, deleted the
  proxy, reopened: the child is the *bundled* `@remotion/compositor…/ffmpeg.exe`
  with `-hwaccel d3d11va -hwaccel_device 1 … -c:v libx264 -preset veryfast
  -crf 28 -g 1`, `BelowNormal`, manifest `profile: "x264-540p-g1-crf28"`.
  Nothing about the default path changed.
- **Fresh T0 on the in-app GPU proxy (video-2) — relative result only.**
  Three trios were run in the afternoon (x264 backup → in-app NVENC → x264),
  and in every one the NVENC file tracked or beat its same-session control:
  32.7 / 32.3 ms vs 33.1 / 35.7 and 34.0 / 38.7 ms in the cleanest; 46.8 /
  45.3 vs 40.5 / 38.3 and 56.8 / 35.1 in the worst. But **the control itself
  had moved** from the morning's 25.8 / 26.0 ms (0 misses) to 33–57 ms with
  20–50 misses, on the identical file, while natural scrub (16.6 ms) and
  playback (59.9 fps) stayed vsync-bound. That is the T3 hygiene event at
  full size — machine state after ~5 hours of transcodes and builds (and an
  orphaned `cmd.exe` from 28 Aug found burning one core), not the proxy —
  so the absolute number for the in-app file is **not claimed**. The
  morning session B above (bench-made NVENC proxy, same encoder and
  settings, 21–22 ms vs 23–28 ms, 0 misses) is the measurement; the in-app
  file is the same profile, byte-count and keyframe structure. Rerun the
  trio on a cold machine before quoting a number for it.

**Pass criterion "a clear win on wall time at comparable quality/size": met
on the on-card path (1.9× wall, 31× CPU, 0.1% size, T0 equal or better),
and explicitly *not* met on the system-memory path, which is why the
feature ships one way and not the other.**

---

## T5 — resolution ceiling · DONE 2026-09-03

**Question:** where does export actually break? The "8K won't work" claim in
`studio-scale-limits-open` memory was *reasoning, not evidence* — export
rasterises a Chromium page at composition size, and that had never been tested
above 4K.

**Method.** One 30 s project per resolution, seeded on disk by
`scripts/bench/seed-long-project.mjs --assets=1 --timeline-seconds=30
--width/--height` (`t5-1080p`, `t5-4k`, `t5-6k`, `t5-8k`): the same 4K60
10-bit HEVC DJI clip (139 s source, first 30 s on the timeline), 30 fps, 900
frames, h264. Each was exported through the real UI — the Studio **Export**
button, over CDP (`t5-export.mjs`) — after its proxy job had finished so no
transcode overlapped the render, and timed from the app's own render queue
(main-process `renderQueueGet` while active, then the render history). Every
output was ffprobed for dimensions **and** frame count. The machine sampler
ran at 15 s with Remotion's headless browser and compositor (`remotion.exe`)
reported separately from the app.

**Instrument finding first, because it cost two runs:** polling
`renderQueueLoad` *during* a render rewrites every `rendering` row in the
queue DB to `error: "Render was interrupted when the app closed"` — it is the
startup-recovery path, not a status read. The render itself was unaffected
(main-process truth said `rendering`, the file landed), but the persisted
record of the first 1080p run says "interrupted". Anyone scripting the queue
must read active renders from `renderQueueGet`.

| output | result | wall (render start → done) | frames/s | output size | headless browser peak | compositor peak | stitcher ffmpeg peak | machine avail. min |
|---|---|---|---|---|---|---|---|---|
| **1080p** 1920×1080 · run 1 | ✅ 900 frames, 1920×1080 | 20 min 07 s | 0.75 | 35.3 MB | 2.0 GB | — (not sampled yet) | 0.5 GB | 172 MB |
| 1080p · run 2 | ❌ **`Compositor error: No frame found at position 245999`** (t ≈ 4.1 s) after 5 min 20 s | — | — | — | 1.6 GB | 0.2 GB | — | 751 MB |
| 1080p · run 3 | ❌ same error, position 55999 (t ≈ 0.9 s) after 2 min 52 s | — | — | — | 1.9 GB | 0.3 GB | — | 258 MB |
| 1080p · run 4 | ✅ 900 frames | 16 min 23 s | 0.92 | 35.5 MB | 2.0 GB | 0.7 GB | 0.5 GB | 431 MB |
| **4K** 3840×2160 | ✅ 900 frames, 3840×2160 | **10 min 33 s** | 1.42 | 148.6 MB | 2.6 GB | 0.9 GB | 1.9 GB | 420 MB |
| **6K** 6144×3456 | ✅ 900 frames, 6144×3456 | **19 min 53 s** | 0.75 | 309.8 MB | 3.6 GB | 1.6 GB | **4.8 GB** | 830 MB (commit 36.1 of 39.8 GB) |
| **8K** 7680×4320 | ✅ 900 frames, 7680×4320 | **28 min 39 s** | 0.52 | 434.2 MB | 3.9 GB | 1.6 GB | **7.8 GB** | **101 MB** (commit 40.3 GB — past the 39.8 GB limit read at the start; the pagefile grew) |

Sources: `.vidtsx-temp/bench/t5/export-*.log|json`,
`.vidtsx-temp/bench/samples/2026-09-03T13-*__t5-exports-2.jsonl`, the
dev-server log for the compositor backtrace.

What the numbers say:

1. **Export speed is not about the output size — it is the 4K60 HEVC source.**
   1080p, 4K and 6K all land between 0.75 and 1.4 frames per second, and the
   spread is machine load, not resolution (the 4K run, on the quietest
   stretch, was the fastest). The GPU VideoDecode counter sat at ≤ 10% for
   every export: Remotion's compositor extracts each source frame in
   *software* from the 10-bit HEVC original, twelve frames in flight, and that
   is the whole budget. **30 s of timeline ≈ 10–20 min of export** on this
   laptop, at any output size up to 6K.
2. **The failure mode below the ceiling is memory, and it is named.** Two of
   four 1080p runs died inside the first five seconds of timeline with
   `Compositor error: No frame found at position N` — Remotion's own
   troubleshooting page attributes it to the OffthreadVideo frame cache being
   too small for the memory available, so extracted frames are evicted before
   they are read. Both failures happened with 0.26–0.75 GB of machine memory
   free (this laptop: 15.7 GB, ~13 GB held by other processes); both
   successes had ≥ 0.43 GB. It is intermittent, the job shows the error in
   the queue, and the export must be restarted from zero. This is the first
   documented export failure and it is a *machine-memory* wall, not a
   resolution one.
3. **Memory scales with output size where you would expect it**: the headless
   browser 2.0 → 2.6 → 3.6 GB and the stitching ffmpeg 0.5 → 1.9 → 4.8 GB from
   1080p to 6K and **7.8 GB at 8K**, where machine commit passed the 39.8 GB
   limit the session started with (Windows grew the pagefile) and available
   memory bottomed at 101 MB. 8K *completed* — 900 correct frames, 434 MB —
   but with nothing to spare on a 16 GB laptop that had 13 GB in other hands;
   the next step up, or a second concurrent export, would not.
   Two more facts from the same runs: Remotion **copies every source file
   into `%TEMP%\remotion-v4.0.435-assets…`** before extracting frames (1.2 GB
   for this one clip; a 3-hour project's 44 sources would be ~33 GB of
   copies per export), and **a failed export leaves that copy behind** — the
   two compositor failures left 2.4 GB in `%TEMP%`; the successful runs
   cleaned theirs up.
4. **Scale snapping did not enter.** Studio exports pass no `scale`, so the
   composition renders at 1:1 and the even-integer snapping in
   `remotion-renderer.ts` is never consulted; 6144×3456 and 7680×4320 are
   even and need none. The 480p-preset case it exists for is a different
   path.
5. **The Settings › Rendering CPU-usage default does not reach Studio
   exports.** `handleExport` passes no `cpuUsage`, so every run above used
   Remotion's default concurrency regardless of the setting (verified: set to
   *Low* before run 4; the queue item still reads "All cores"). The other
   render screens pass their own value. A one-line product gap, noted, not
   fixed (building is paused).

**Pass criterion "a documented ceiling with a named failure mode": met, and
the ceiling is not where the memory said.** 8K exports correctly on this
machine; there is no resolution at which the pipeline produces wrong
dimensions or a wrong frame count. The two walls that actually exist are
(a) **memory** — the stitching ffmpeg roughly doubles per step
(0.5 → 1.9 → 4.8 → 7.8 GB) and the compositor cache starves first, with the
named error `No frame found at position N`; 8K needs ~14 GB across
Remotion's processes and is the practical edge on a 16 GB machine — and
(b) **time** — ~0.5–1.4 frames/s from 4K60 HEVC sources at any output size,
so a minute of timeline is 10–40 minutes of export. Product copy can say
"exports up to 8K; 8K needs a 32 GB machine to be comfortable" and be
telling the truth. Repeat on the Intel-iGPU laptop before quoting the
frame rate, per the caveat at the top of this file.

---

## T6 — long-project stress · DONE 2026-09-03

**Question:** Hasan's actual question — 3–5 h of 4K, many clips. Supported use
case, or documented limit? The memory said "proxy generation, session memory,
or export" would be the wall, as reasoning; this replaces it with numbers.

**Method.** `scripts/bench/seed-long-project.mjs` writes a Studio project
straight to disk (`docs/ui-automation-cdp.md`, "Getting past native dialogs"):
the four real 4K60 sources the app already knows — three DJI 10-bit HEVC clips
(139 + 73 + 158 s) and the video-2 H.264 master (632 s), 1,002 s per set —
imported **11 times over as 44 separate assets** (every asset id gets its own
proxy, waveform and thumbnail, so the per-asset queue is stressed honestly),
cut into 45 s pieces and laid round-robin so neighbouring clips never share a
file. Result: **`t6-stress-3h` — 44 assets, 11,025 s (3.06 h) of 4K60 source,
275 clips on one video track**, 1920×1080 @ 30. The 5 h case is the same
project × 1.6 and is extrapolated, not run, below. Everything was measured on
the dev app driven over CDP (`--remote-debugging-port=9222`), with
`scripts/bench/sample-machine.mjs` sampling every 30 s (per-process working set
for every process of the app plus every ffmpeg, machine-wide available memory,
CPU load, the Windows GPU-engine VideoDecode/VideoEncode counters, bytes in
`cache/`) and a watcher recording when each proxy landed.

**Machine caveat that applies to every T6 number.** This laptop has **15.7 GB
of RAM, not 32**, and during the whole wave it was shared with ~13 GB of
other processes (VS Code, Chrome, eight other Claude sessions, a Django test
suite someone was running, Windows Defender scanning every proxy segment as it
was written — MsMpEng alone read 36% of the machine in one sample — and an
elevated orphan `cmd.exe` burning ~0.7 of a core that could not be killed:
access denied). Available memory sat between 0.4 and 3.7 GB. So the memory
numbers are the app's *own* working sets (which are what transfer) and the
wall-clock numbers are pessimistic by some tens of percent against a clean
machine.

### 1. Opening, and the full proxy queue — x264 default vs the GPU encoder

| | **x264 (default)** | **GPU encoder ON** (Settings › Rendering) |
|---|---|---|
| open → editor usable (cold: no proxies, waveforms or thumbnails) | *(not retained — see note 4)* | **2.9 s** (`openMs: 2897`, 26 clips painted, no "Loading…" seen) |
| open with everything cached (warm) | — | **0.8 s** (`openMs: 806`) |
| first ffmpeg after open | 11 s | 9 s |
| **full queue, 44 proxies + 44 waveforms** | **1 h 53 min 46 s** (first ffmpeg → last proxy landed) | **1 h 15 min 35 s** as measured, **~1 h 03 min** excluding a 13-min Modern Standby hole (see the caveat at the end of §4) |
| realtime factor (11,025 s of source) | 1.62× | 2.43× measured · ~2.9× awake |
| speed-up | — | **1.51× measured · ~1.8× awake** |
| disk written to `cache/proxies/` | 4.55 GB | 4.53 GB |
| CPU load, machine-wide mean over the queue | 81% | 81% (Defender included) |
| GPU VideoDecode, mean / max | 64% / 83% | **87% / 100%** |
| GPU VideoEncode, mean / max | 0 | 11% / 21% |
| app working set — main / renderer / all app processes | 45–176 / 227–605 / 391–1,094 MB | 49–172 / 206–550 / 391–962 MB |
| ffmpeg children (2 at a time), max working set | ~730 MB each | 599 MB |
| machine available memory, minimum | **16 MB** (at the open) | 540 MB |

Sources: `.vidtsx-temp/bench/t6/watch-proxy-{x264,nvenc}.log`, proxy file
mtimes, and `.vidtsx-temp/bench/samples/…__t6-3h-proxy-{x264,nvenc}.jsonl`.
Every GPU-pass child was verified live as the downloaded full build with
`-hwaccel cuda -hwaccel_output_format cuda … scale_cuda … h264_nvenc`, priority
BelowNormal (the x264 pass: the bundled build with `-hwaccel d3d11va
-hwaccel_device 1 … libx264`). One NVENC proxy probed: 960×540, 4,381 packets
for 73.09 s at 59.94 fps — frame-exact, like T4b.

What the numbers say:

1. **The proxy queue is the first wall, and it is a wait, not a failure.** Three
   hours of 4K60 costs **~1 h 54 min** on the shipping x264 path and **~1 h 03
   min** with the opt-in GPU encoder (1 h 16 min as measured, 13 min of which
   the machine was in standby), on a loaded laptop. Scaled linearly, the
   5 h project is **~3 h 10 min / ~1 h 45 min**. Both passes ran to completion:
   88 jobs, no error, no retry, no orphan process. The 1.51× GPU speed-up
   (1.8× awake) is a little below T4b's 1.9× for two known reasons: eleven of the 44 assets are the
   8-bit H.264 master, where NVDEC tops out at ~2.3× (the counter read 87%
   mean, 100% max — the queue is decode-bound, exactly as T4b said), and
   Defender was taking a third of the CPU.
2. **The editor is usable while the queue runs.** The cold open painted the
   timeline in 2.9 s with "Building 44 preview proxies…" in the status and the
   preview playing the originals; the renderer stayed at 200–600 MB throughout
   both passes. The app's own footprint does not scale with the queue — the
   ffmpeg children do (two × ~600–730 MB), which is what the concurrency-2 cap
   bounds.
3. **The one near-OOM moment was the open on the x264 pass**, when the app
   spiked to 1,094 MB (thumbnails and probes for 44 assets, gpu-process at 400
   MB) while two ffmpegs started and the rest of this machine held 13 GB:
   available memory read **16 MB** for one sample and recovered. Nothing
   crashed. This is the shape of the OOM in the 2026-08-19 E2E memory (that
   one had Claude and a 4K original preview on top), and it is a
   machine-memory event, not an app leak — see §3.
4. **The x264-pass cold-open time was not retained** (the session that
   measured it was cut before the number was written down; the screenshot and
   the watcher timestamps survived). The GPU-pass open is the same code path
   under identical cache-absent conditions, so 2.9 s is quoted for both.

### 2. Scrub at length — T0 against the real project

Control = `raw-footage-test` (3 assets, its old 720p GOP-15 proxies), run
**first and last** in each chain per the T3/T4b hygiene. The 44-asset project
carries the shipping 540p all-intra NVENC proxies, so the comparison is "big
project on the new profile" vs "small project on the old profile"; the
absolute control level is what says the instrument held.

**Chain 1 — the default T0 fixture (40 clips × 1.2 s):**

| run | natural p50 | fling p50 (run 1 / run 2) | fling p90 | misses |
|---|---|---|---|---|
| control A (3 assets, 1 layer) | 16.6 ms | 33.6 / 49.1 ms | 400 ms | 0 / 47 |
| **t6-stress-3h, 1 layer** | 16.6 ms | 38.7 / **30.2 ms** | 400 ms | 47 / 5 |
| t6-stress-3h, 3 layers | 400 ms | 400 / 400 ms | 400 ms | 150 / 150 |
| control B (1 layer) | 16.6 ms | 33.5 / 32.7 ms | 51.9 ms | 0 / 0 |
| control at 3 layers | 51 ms | 400 / 400 ms | 400 ms | 142 / 142 |
| t6-stress-3h, 3 layers (rerun) | 33.6 → 400 ms | 400 / 400 ms | 400 ms | 150 / 150 |
| t6-stress-3h, 2 layers | 19.8 → 400 ms | 400 / 400 ms | 400 ms | 145 / 145 |
| control C (1 layer) | 16.6 ms | 33.4 / 41.2 ms | 400 ms | 0 / 46 |

**Chain 2 — the T2 "long" fixture (20 clips × 6 s, the shape T2 showed
survives multi-layer):**

| run | natural p50 | fling p50 (run 1 / run 2) | fling p90 | misses |
|---|---|---|---|---|
| control, 3 layers | 41.1 / 35.9 ms | 59.3 / 49.2 ms | 400 ms | 47 / 21 |
| **t6-stress-3h, 3 layers** | 32.2 / 16.7 ms | 42.7 / 51.3 ms | 400 ms | 38 / 58 |
| **t6-stress-3h, 2 layers** | 16.6 ms | **27.7 / 26.4 ms** | 45.8 ms | 1 / 0 |
| control, 2 layers | 33.2 ms | 33.0 / 33.3 ms | 65.8 ms | 1 / 0 |
| control D (1 layer) | 16.6 ms | 33.0 / 33.3 ms | 50.2 ms | 0 / 0 |

Reports: `.vidtsx-temp/bench/2026-09-03T04-4*…05-1*__*__t6-*.json`.

What the numbers say:

5. **The control held.** Across 32 minutes and eight control runs the clean
   fling p50 read 33.6 / 33.5 / 32.7 / 33.4 / 33.0 / 33.3 ms (T2's baseline for
   this proxy was 32.6 ms); three single runs hit the known tail event (400 ms
   p90, ~46 misses) and are shown, not averaged away. No drift, so the session
   is valid.
6. **Project length and asset count do not change scrub cost.** At one layer
   the 3-hour, 44-file project scrubs at 16.6 ms natural and 30 ms fling — the
   T3 all-intra number — with playback at 59.9 fps. At two layers on 6 s clips
   it is *better* than the control (27 vs 33 ms, ≤ 1 miss) because of the
   proxy profile. At three layers both projects sit in the same tail-miss
   regime T2 documented (p50 43–59 ms, 20–60 misses).
7. **The collapses in chain 1 are the T2 element-count cliff, not T6.**
   Two or three layers of 1.2 s clips means 6–9 `<video>` elements alive at
   once, and both the 3-asset control and the 44-asset project fall to 400 ms
   and total misses on that fixture, exactly as §T2's follow-up table shows.
   That finding stands unchanged: the risk in a long project is *local cut
   density around the playhead*, not the length.

### 3. Session memory — 2 h with the project open

**Method.** With all 44 proxies present, the project was opened (warm open
**0.8 s**) and a scripted editor session was driven over CDP
(`t6-session.mjs`): every ~75 s — 24 frame-steps, 12 one-second steps, 8 s of
playback, a split at the playhead, undo, a random 10–70 s jump, and every
sixth cycle a jump to End and back to Home. The sampler ran at 30 s; the
driver logged the renderer's JS heap and a 500 ms `requestAnimationFrame`
count each cycle. The document on disk stayed at 275 clips throughout (the
split/undo pair nets to zero; autosave wrote it after every cycle).

**What happened:** **71 cycles, 90 minutes of continuous driven editing**
(05:21–06:51 UTC), then the driver's CDP socket died when this harness was
suspended — not the app: the renderer process kept its PID from 05:20 until
the app was closed after 12:38, no `render-process-gone`, nothing in the
Windows Application log, and the project stayed open and idle for another
**5.7 hours** after the driver stopped. (The two page reloads seen at 06:51 and
12:34 are the Vite dev client reconnecting after a pause — a dev-server
artefact that does not exist in a built app.)

| | editing (0–90 min) | idle, project open (90 min → 4 h) | idle, after memory trim (4 h → 7 h) |
|---|---|---|---|
| renderer working set | 284 → 548 → 642 → **756 MB peak** (60 min), then trimmed by the OS to 324–509 MB | **429 MB flat** | 117–147 MB |
| main process | 165–188 MB | 90 MB | 55–62 MB |
| all app processes (main + renderer + GPU + utility) | 695 → **1,391 MB peak** | 656 MB | 275–316 MB |
| renderer JS heap (used) | **97–129 MB, median 112 — flat** | — | — |
| rAF rate at each snapshot | 60 Hz median (one 0 Hz reading, at the pause) | — | — |
| driver errors | **0** | — | — |

Sources: `.vidtsx-temp/bench/samples/2026-09-03T05-19-38-524Z__t6-3h-session.jsonl`
(555 samples), `.vidtsx-temp/bench/t6/session-driver.log` (143 snapshots).

What the numbers say:

8. **Session memory is not the wall.** The JS heap is flat for the whole
   session — whatever grows is outside it (decoded-frame and compositor
   buffers behind the `<video>` elements the mount window keeps alive), and
   the OS reclaimed it on demand: when another process took 5 GB of commit at
   06:15 (a WSL VM and the orphan `cmd.exe`, available memory down to 287 MB)
   the renderer was trimmed from 756 to ~400 MB **and the driver kept cycling
   at 60 Hz with zero errors**. The app's whole footprint for a 3-hour,
   44-asset, 275-clip project peaked at 1.4 GB across all its processes and
   sat at 0.66 GB idle.
9. **The 2026-08-19 OOM is now attributable.** That crash had a 4K *original*
   playing in the preview (no proxy yet), two x264 proxy transcodes at
   normal priority and a Claude session on a machine with ~2 GB free. Every
   one of those pieces has since moved: proxies are 540p (T3), the transcodes
   run at below-normal priority (bugfix 9a3559b) and, this session, the app
   rode out a harder squeeze (287 MB available) without a crash. It was a
   machine-memory event, and the app's own working set is not what filled the
   machine.


### 4. Export — does a full-length export survive?

**Method.** The Export button on the 3-hour project (330,749 frames at 30
fps, 1920×1080, h264), driven over CDP like T5, with `framesRendered` read
from the app's own `render:progress` events every 30 s and the sampler at
15 s. The intent was never to wait for the file: T5 had already put the
frame rate at 0.5–1.4 frames/s, which makes 330,749 frames a multi-day job.
The question was whether it *starts and stays alive* on a project this size,
what it costs while it runs, and what the honest projection is.

**What happened:** the render started 11 s after the click and was
**cancelled by hand after 86 minutes at 1,974 frames (0.6%)**, alive and
progressing. Measured on the continuous, awake stretch 16:07–16:28 UTC:
**1,270 frames in 1,180 s = 1.08 frames/s** (the first hour includes a
59-minute Modern Standby hole — see the caveat below — and is not a rate).

| | value |
|---|---|
| frames/s, awake | **1.08** (T5 range 0.5–1.4) |
| projection for the 3 h timeline | **~85 h ≈ 3.5 days**; 5 h ≈ 6 days |
| main process (holds the render) | 441–581 MB (idle: 80–90 MB) |
| Remotion headless browser | 0.7–2.4 GB |
| compositor (`remotion.exe`) | up to 1.9 GB |
| stitcher ffmpeg | 0.5 GB |
| machine available memory, minimum | 203 MB |
| `%TEMP%` source copies at cancel | 1.85 GB (2 of 44 sources reached) |
| after cancel | active list empty within 1 s; **10 `chrome-headless-shell` processes (0.7 GB) and the 1.85 GB temp copy left behind**; no partial output file |

Sources: `.vidtsx-temp/bench/t6/export-3h*.log`, `…/samples/…__t5-exports-2.jsonl`.

What the numbers say:

10. **Export is the wall, and it is time, not stability.** Nothing broke: the
    render ran, memory was flat (main ~0.5 GB, Remotion ~3–4 GB across its
    processes — the same shape as a 30 s export), and cancel worked. But at
    ~1 frame/s a 3-hour 4K60-HEVC timeline is **three and a half days** of
    export on this laptop, and the shipped pipeline has no way to shorten
    it: every frame is rasterised through Chromium and every source frame
    is decoded in software by the compositor (GPU VideoDecode ≤ 10%
    throughout). Smart-render/passthrough for untouched spans is ledgered in
    `docs/studio/PLAN.md` §5 and unbuilt; without it the long project is not
    exportable in practice.
11. **Two leaks at the edges, both small and both real:** a cancelled or
    failed export leaves its `%TEMP%\remotion-v4.0.435-assets…` source
    copies on disk (1.2–1.9 GB here; up to ~33 GB for this project), and a
    cancel leaves the headless browser processes running until the app
    exits. Neither affects the next render; both are worth a ticket.

**Machine caveat, discovered in this test and applying to two numbers
above.** This laptop enters **Modern Standby** when nobody touches it, and a
suspended machine stops everything — the sampler files show the holes
(`t6-3h-proxy-nvenc`: 21:19–21:32; `t6-3h-session`: 10:08–10:26 and
10:37–12:32, after the driver had finished; `t5-exports-2`: 15:08–16:06).
Two results are affected: **the GPU-encoder proxy queue in §1 contains a
13-minute hole** (proxy 10 landed 21:18:57, proxy 11 at 21:32:04, with
landings every 1–2 min either side), so its honest wall is **~62–63 min,
2.9× realtime, 1.8× over x264** — closer to T4b's 1.9× — and the first hour
of the export above is not a rate. The x264 queue, the T0 chains, the 90-min
session and all four T5 exports have no holes. A keep-awake
(`SetThreadExecutionState`) was armed for the rest of the wave once this was
found.


### Verdict

**Pass criterion — "a supported path with known waits, or a documented limit
with the specific wall named": met, as a documented limit, and the wall is
named.** Of the three hypotheses in the memory:

- **Proxy generation — a wait, not a wall.** 3 h of 4K60 = ~1 h 54 min on
  the default path, ~1 h 03 min with the GPU encoder on; 5 h ≈ 3 h 10 min /
  1 h 45 min. Completed twice without an error, resumable, and the editor is
  usable meanwhile. 1.4 GB of proxies per hour of source.
- **Session memory — not a wall.** Peak 1.4 GB across all app processes for
  44 assets / 275 clips / 3 h, flat JS heap, reclaimable on pressure, no
  crash in 7 h with the project open. Scrub cost is unchanged by project
  length; the only preview cliff is T2's element-count one.
- **Export — the wall.** ~1 frame/s from 4K60 HEVC sources at any output
  size, so the 3 h timeline is ~3.5 days and 5 h ~6 days, on a machine that
  needs ≥ ~0.5 GB free or the compositor cache starves. Nothing in the
  shipped pipeline shortens it.

**Answer for Hasan:** *3–5 hours of 4K is a supported project to open, proxy
and edit — expect one to three hours of proxy generation you can work
through — but it is not a supported project to export today: at about one
frame per second the export of a 3-hour timeline is three and a half days,
and that is the wall. The way through is passthrough export for untouched
spans (ledgered, unbuilt), not more memory or a faster GPU.*


---

## T7 — effects load probe (optional)

**Question:** where does preview fps collapse under stacked effects? Cannot be
answered directly today — packs are slices 9–10 and unbuilt; only crossfade and
dip-to-black exist. Approximate with a stack of CSS/SVG filters plus several
TSX shots on screen at once.

**Pass:** a clip/effect count at which preview drops below usable, informing
whether Q8c's "disable effects in preview" toggle ships with E2 or later.

---

## T8 — the export path: options researched, three tests planned and MEASURED · 2026-09-04

**Where this comes from.** T6 named export time as the long-form wall (~1
frame/s from 4K60 HEVC at any output size, §T6 §4). Hasan asked whether
that means long 4K exports are simply impossible, how CapCut is so fast,
whether Remotion can render on the GPU or in parallel chunks, and whether
TSX shots could be pre-rendered to video and everything composited in one
GPU pass. This section records the answers, with sources, and the three
tests he agreed to run before any build decision. **Nothing here is decided
or built** — building is still paused.

### Why CapCut is fast, and where our 70× goes

CapCut is a native engine: the camera file is decoded on the GPU (NVDEC),
effects run as shaders, the result is encoded on the GPU (NVENC), and frames
never leave the card. On RTX cards with two or more encoders it also splits
the timeline into independent scenes and feeds one to each encoder
("simultaneous scene encoding", ~80% faster with dual encoders per NVIDIA).
We already built that pipeline shape once — the T4b proxy generator (NVDEC →
`scale_cuda` → NVENC) runs at **2.4× realtime** on this laptop. Export runs at
**~1 frame/s = 1/30 realtime**. The ~70× gap is the browser-screenshot design,
not the hardware.

An export has four steps; the GPU can help with two:

| step | GPU today? | note |
|---|---|---|
| decode the source frame | **no** | OffthreadVideo's compositor is CPU-only, no hwaccel switch. Only `<Video>` from `@remotion/media` (WebCodecs inside the headless browser) *could* reach a hardware decoder, if headless Chrome is given a GPU — unmeasured |
| draw the page | yes (`chromiumOptions.gl`; Studio exports pass none) | cheap either way — not where the seconds go |
| the screenshot per frame | never | this is the architecture |
| encode | yes from Remotion 4.0.484 (NVENC, Windows); we ship 4.0.435 | a small share of our export time |

### Parallelism: already on, and chunking does not help one machine

`renderMedia` renders in parallel by default — **half the CPU threads** (six
browser tabs here), which is why the CPU sat at 85–96% in every T5/T6 export.
Chunked rendering exists and is documented ("distributed rendering": equal
frame counts per chunk, `h264-ts`, `enforceAudioTrack`, seamless-AAC or
`pcm-16`, then `combineChunks`, which the docs call "a hard-to-use API most
people should not use directly"). Remotion Lambda is that recipe on many
machines. On **one** machine chunking adds nothing: the cores are already
saturated by the tabs. It pays only with more machines, and each chunk
downloads every asset it touches (44 sources × up to 6.3 GB here). Cloud
rendering with the user's own AWS keys is possible in principle but conflicts
with the local-first rule — a product decision, not an optimisation.

### The levers inside Remotion, rated honestly

| lever | expected gain | status |
|---|---|---|
| `offthreadVideoCacheSizeInBytes` / concurrency tuning | fixes T5's `No frame found at position` starvation; ±30% speed | cheap, not a 70× fix |
| hardware-accelerated *encoding* (4.0.484+) | small; larger files, no CRF | needs a Remotion bump (all packages, same version) |
| `toneMapped: false`, JPEG frames | small | quality trade |
| `<Video>` from `@remotion/media` for export | unknown — large if a hardware decoder engages; Remotion's performance page now says OffthreadVideo "is not optimized" and recommends it; T2 proved it decodes our DJI HEVC with colour intact *in preview* | **test 1** |
| all-intra intermediates for touched spans (Premiere's "optimised media") | likely several ×; still a screenshot per frame; disk-heavy (~1–2 GB/min at 4K) | **test 2** |
| passthrough for untouched spans (smart render, PLAN §5) | footage spans at 2.4× realtime via the T4b pipeline; only touched spans through the browser; joins via the frame-exact concat already proven for proxies | the design; **T1 must prove the join** |

### Hasan's idea: pre-render TSX to video, composite everything in one GPU pass

Realistic, and it is how many tools work: render each TSX shot to a short
alpha video (the renderer already does ProRes 4444 / VP9-alpha), then ffmpeg
overlays them on the footage with GPU decode, `overlay_cuda`, NVENC. Cutaways
never touch the source, TSX shots are short, the long footage never enters
the browser — CapCut-class speed. It is exactly the **hybrid compositor**
that `docs/PREVIEW_ARCHITECTURE.md` marks as the one design not to take, for
one reason: preview drawn by Remotion, export drawn by ffmpeg, so *every
composited frame* must agree between two renderers. The concrete drift
points: transitions (crossfade/dip re-implemented as `xfade`), clip
transforms (scale/position/opacity), blends beyond plain alpha, colour when
an sRGB overlay meets 10-bit D-Log footage, and captions (TSX overlays that
can span the whole video). Each is a second implementation that must match
the first pixel-for-pixel, and T1 is the only way to know.

| design | untouched footage | spans with TSX / transitions / captions | preview = export |
|---|---|---|---|
| today: all Remotion | browser, ~1 frame/s | browser | by construction |
| passthrough (smart render) | ffmpeg GPU, 2.4× realtime | browser | by construction; the joins need T1 |
| full hybrid (Hasan's) | ffmpeg GPU | ffmpeg GPU + pre-rendered TSX | must be proven per feature; T1 forever |

Worth keeping in view: the 3-hour figure is the raw ingest. A talking-head
export after the editorial pass is 20–40 min of final video — ~15 h today;
passthrough brings the footage part to ~12 min and leaves the touched spans,
which is exactly what the tests below size.

### The three tests (agreed 2026-09-04, ~30 min each, on the T5 30 s project)

| # | test | what it decides | pass/read-out |
|---|---|---|---|
| **T8a** | export the 30 s project with `<Video>` from `@remotion/media` instead of `<OffthreadVideo>`; watch the GPU VideoDecode counter and frames/s | whether the decoder swap alone moves export off ~1 frame/s, and whether a hardware decoder engages in headless Chrome | frames/s vs the T5 1080p figure (0.75–0.92); decode counter > 0 = hardware engaged; colour diff vs the OffthreadVideo output (run-frame-diff-style) |
| **T8b** | pre-transcode the clip to an all-intra 4K intermediate (x264 `-g 1` or NVENC `-g 0`, full res) and export from it | whether touched spans need intermediates (cheap frames) or the decoder swap | frames/s; intermediate size per minute |
| **T8c** | run the same 30 s through plain ffmpeg NVDEC → NVENC at 1080p (the T4b pipeline, no browser) | the passthrough floor, and the size/quality of a passthrough-encoded span for T1 to compare against | wall (expect ~12 s); bytes; a still for the fidelity diff |

Then decide: passthrough first (most of the speed, one renderer), the
touched-span path from T8a/T8b, and the full hybrid only for span types
where the numbers say the browser is still the wall. T1 gates all three.

Sources: [renderMedia()](https://www.remotion.dev/docs/renderer/render-media),
[How Remotion Lambda works](https://www.remotion.dev/docs/lambda/how-lambda-works),
[Distributed rendering](https://www.remotion.dev/docs/distributed-rendering),
[combineChunks()](https://www.remotion.dev/docs/renderer/combine-chunks),
[OffthreadVideo](https://www.remotion.dev/docs/offthreadvideo),
[@remotion/media Video](https://www.remotion.dev/docs/media/video),
[Hardware acceleration](https://www.remotion.dev/docs/hardware-acceleration),
[Performance](https://www.remotion.dev/docs/performance),
[NVIDIA on CapCut simultaneous scene encoding](https://blogs.nvidia.com/blog/computex-studio-laptops-encoding-capcut/),
[Frame.io on smart rendering](https://workflow.frame.io/guide/smart-rendering).

### Results · measured 2026-09-04

**Method.** The T5 30 s project re-seeded (`seed-long-project.mjs
--id=t5-1080p --assets=1 --timeline-seconds=30`: the 139 s DJI 4K60 10-bit
HEVC clip, first 30 s, 1920×1080 @ 30, 900 frames, h264), exported through
the dev app over CDP with `scripts/bench/studio-export.mjs`, timed from the
app's own queue (`renderQueueGet` while active), every output ffprobed for
frame count and dimensions, the machine sampler at 15 s, a keep-awake armed
for the whole wave (no holes in the sample file). Two ways to start the same
render: the **Export button** (the T5 recipe) and the **direct path** (the
same `studioExportPrepare` + `renderStart` the button issues, which the bench
needs so it can hand Remotion a patched entry, a GL backend, or a
concurrency). The decoder swap is the composition's own switch
(`src/shared/studio/media-engine.ts`, a global read at render time): the
bench writes a sibling copy of the generated export entry that sets it, so
**no product code changed**. New instruments beside the export driver:
`t8-ffmpeg.mjs` (T8b intermediates and the T8c passthrough, with ffmpeg CPU
time), `t8-output-diff.mjs` (two exports compared at the same frame indices:
per-channel mean absolute difference, share of pixels over 8 and 24, a
side-by-side still with the amplified diff), `t8-seed-intra.mjs` (the same
30 s project pointed at another file) and `t8-headless-decode-probe.mjs`
(Remotion's own `chrome-headless-shell` launched with Remotion's GL flags,
asked `VideoDecoder.isConfigSupported` per codec). Machine as in T5/T6: 15.7
GB, 0.4–2.3 GB free, other sessions running, the elevated orphan `cmd.exe`
(PID 21028, 10,600 CPU-s by midday) still burning a core. Sources:
`.vidtsx-temp/bench/t8/*.log|json`, `…/t8/stills/`,
`.vidtsx-temp/bench/samples/2026-09-04T11-1*__t8-exports.jsonl`.

**Run-to-run noise, stated first.** The two OffthreadVideo controls on the
same file disagree by 1.6×: 1.17 frames/s from the Export button (the first
render of the day: its 1.2 GB source copy was cold, 384 MB free at the low
point) and 1.93 frames/s from the direct path 35 minutes later. T5 saw the
same spread (0.75–1.4). Every comparison below is read against the *nearest*
control in time and the ratios, not the absolute rates, are the finding.

#### The exports

| run | source | decoder in the browser | Chromium GL | wall (render start → done) | frames/s | output | headless browser peak | compositor peak | GPU VideoDecode |
|---|---|---|---|---|---|---|---|---|---|
| **control** (Export button) | DJI HEVC 10-bit | `<OffthreadVideo>` | swangle (the Settings default) | 12 min 47 s | **1.17** | ✅ 900 frames, 32.4 MB | 2.3 GB | 0.3 GB | 0 |
| **control 2** (direct path) | same | `<OffthreadVideo>` | swangle | 7 min 47 s | **1.93** | ✅ 900, 35.5 MB | 3.5 GB | 1.4 GB | 0 |
| **T8a** `<Video>` | same | `@remotion/media` → **fell back to `<OffthreadVideo>`** ("Cannot decode …, falling back", source copied) | swangle | 8 min 17 s | 1.81 | ✅ 900, 35.5 MB | 3.3 GB | 1.2 GB | 0 |
| **T8a** `<Video>` + GPU | same | `@remotion/media`, WebCodecs engaged, **no frame ever returned** | **angle** (D3D11) | ❌ **10 min 01 s, 0 frames** — `Timeout while extracting frame at time 0.2sec` (twice) | 0 | — | 2.0 GB | 10 MB | 0 on both adapters |
| **T8a** `<Video>` on H.264 | video-2 H.264 master (632 s, 6.3 GB), first 30 s | `@remotion/media`, **engaged**, software WebCodecs, no source copy, no fallback | swangle | 7 min 12 s | **2.08** | ✅ 900, 32.0 MB | 3.7 GB | 11 MB (nothing to extract) | 0 |
| H.264 control | same | `<OffthreadVideo>` | swangle | 8 min 02 s (the first 65 s at 1 % = copying the 6.3 GB source into `%TEMP%`; ~2.2 frames/s once rendering) | **1.87** | ✅ 900, 32.2 MB | 3.7 GB | 1.5 GB | 0 |
| **T8b** intermediate | NVENC all-intra 4K h264, 8-bit (452 MB for 30 s) | `<OffthreadVideo>` | swangle | 6 min 37 s | **2.27** | ✅ 900, 35.8 MB | 3.7 GB | 1.4 GB | 0 |

Colour, against the Export-button control at frames 30/300/600/870
(`t8-output-diff.mjs`, side-by-sides in `…/t8/stills/`): the fallback run
differs by a mean of 0.6–1.6/255 per channel with ≤ 0.34 % of pixels over
24 (encoder noise — it *is* OffthreadVideo); the all-intra intermediate by
1.0–1.9/255, ≤ 0.34 % over 24 — **an 8-bit yuv420p intermediate of the
10-bit D-Log source exports the same picture**; the H.264 WebCodecs export
against its own OffthreadVideo control likewise (1.6–2.3/255, ≤ 0.46 % over
24, channel means within 2).

#### What the headless shell can decode (`t8-headless-decode-probe.mjs`)

Remotion 4.0.435 renders in `HeadlessChrome/144.0.7559.20`. WebCodecs is
secure-context-only: on `about:blank` `VideoDecoder` does not exist at all
(the render page is `http://localhost:<port>`, which counts as secure, so
the probe navigates to loopback first).

| `gl` | WebGL reports | HEVC Main10 4K | H.264 High 4K | AV1 | VP9 |
|---|---|---|---|---|---|
| **swangle** (default; every Studio export) | SwiftShader | **no** — hardware, software and no-preference all `false` | software only | software only | software only |
| **angle** | D3D11 on the **Intel UHD Graphics** (not the GTX 1650 Ti) | prefer-hardware **true** | hardware and software | software only | hardware and software |

So under the shipping configuration `<Video>` can never decode the DJI
files: Chrome has no software HEVC decoder, `@remotion/media` sees
`cannot-decode` and silently mounts `<OffthreadVideo>` instead (one warning
line in the render log, nothing in the queue record). Handing the shell a
real GPU makes the iGPU's HEVC decoder *report* itself, and the render then
hangs on the very first frame until Remotion's per-frame timeout (600 s
here) kills it — CPU 9 %, both adapters' VideoDecode counters at zero the
whole time. Where the tag *does* engage (H.264, software decode in the tab)
it renders at 2.08 frames/s against 1.87 for OffthreadVideo on the same
file, i.e. within the noise — and it wins the ~60 s OffthreadVideo spends
copying the 6.3 GB master before the first frame, plus 1.5 GB of compositor
memory.

#### T8b — the intermediates

| intermediate (first 30 s of the DJI clip, 3840×2160, 59.94 fps, all-intra) | make time | ffmpeg CPU | size | rate | per minute of 4K60 |
|---|---|---|---|---|---|
| **h264_nvenc** `-g 0 -bf 0 -cq 18 -preset p4`, NVDEC → system memory → NVENC | 33.8 s (0.89× realtime) | 134 CPU-s | 451.6 MB | 120 Mbps | **0.90 GB** |
| libx264 `-g 1 -bf 0 -crf 16 -preset veryfast` | 51.4 s (0.58×) | 527 CPU-s | 697.2 MB | 186 Mbps | 1.39 GB |

The all-on-card shape (NVDEC → `scale_cuda=format=yuv420p` → NVENC, T4b's
plan) **produced solid green frames of 1.6 KB each** when the size does not
change — with or without an explicit 3840×2160 — while the same filter with
a real resize (T8c, 1080p) is fine. The shipped proxy path always resizes,
so it is unaffected; a future full-resolution intermediate must not reuse
the on-card plan without a frame check. The NVENC intermediate above
therefore decodes on the card, converts p010 → yuv420p on the CPU (that is
the 134 CPU-s) and encodes on the card.

Export from the NVENC intermediate: **2.27 frames/s vs 1.93** for the
nearest OffthreadVideo control (+18 %; +25 % against the fallback run) with
the same memory shape. Cheap frames help, but the compositor's decode of the
4K60 HEVC original was never the bulk of the second per frame.

#### T8c — the passthrough floor (no browser)

The T4b pipeline on the same 30 s: `-hwaccel cuda` → `scale_cuda` 1920×1080
→ `h264_nvenc` (p5, VBR, `-bf 2 -g 60`), conformed to 30 fps, AAC.

| | wall | ffmpeg CPU | realtime | size | rate | frames |
|---|---|---|---|---|---|---|
| cq 23 | **8.8 s** | **3.3 CPU-s** | **3.4×** | 30.3 MB | 8.1 Mbps (control: 32.4 MB, 8.6 Mbps) | 902 |
| cq 19 | 8.6 s | 3.9 CPU-s | 3.5× | 52.8 MB | 14.1 Mbps | 902 |

Against the Export-button control at the same frame indices: **per-channel
means within 1/255** (colour intact, as T4b's proxies were), mean absolute
difference 1.9–6.1/255 and up to 5.6 % of pixels over 24, all of it on
motion edges — the side-by-side still shows the hand one source frame
apart. That is the frame *mapping*, not the picture: ffmpeg's `-r 30`
conform of a 59.94 fps source picks a different one of each pair than
Remotion's time-exact seek does (902 frames vs 900 is the same effect). A
passthrough span has to reproduce Remotion's frame choice, which is exactly
the join T1 exists to prove.

The 9 s runs are shorter than the sampler's interval, so no VideoDecode /
VideoEncode sample landed inside them; T4b's counters already showed this
pipeline on the card (decode engine 100 %, encode 10 %).

#### What the numbers say

1. **The screenshot is the wall, not the decode.** Remove the source decode
   from the browser entirely (H.264 through WebCodecs: 2.08 frames/s), make
   it nearly free (all-intra intermediate: 2.27), or leave it to
   OffthreadVideo (1.17–1.93): every path lands between 1.8 and 2.3 frames
   per second at 1080p on this laptop. The 3 h T6 timeline is **~40 h at the
   best of them**, against ~85 h in T6 — an improvement, not a fix. Nothing
   that keeps a Chromium screenshot per frame gets within an order of
   magnitude of realtime.
2. **The decoder swap is not available for our camera files.** Under the
   shipped GL backend headless Chrome cannot decode HEVC, `@remotion/media`
   falls back silently, and the export is OffthreadVideo with an extra
   warning; with a GPU backend it deadlocks on frame one. It would need a
   Remotion train bump (the media package is "experimental" at 4.0.435), a
   per-file codec probe, `disallowFallbackToOffthreadVideo`, and even then
   it only pays on H.264 — and there it buys the source-copy minute and 1.5
   GB, not frame rate.
3. **Intermediates are a modest, disk-heavy lever**: +18–25 % on frame
   rate for 0.9 GB per minute of 4K60 (NVENC) and a transcode that itself
   runs at 0.9× realtime here. For a touched span they are worth having
   only as a side effect of something else (the proxy path already makes
   them at 540p); they are not the touched-span answer.
4. **Passthrough is a different order of magnitude.** 3.4× realtime, 3
   CPU-seconds for 30 s, colour intact, file size at the control's. On this
   GPU the 3 h timeline's untouched footage is **~53 min** at 1080p instead
   of days, and a 20–40 min talking-head export's footage is 6–12 min. What
   stays slow is whatever still goes through the browser: at ~2 frames/s a
   TSX shot, transition or captioned span costs ~15 s of export per second
   of timeline, so 3 min of touched spans is ~45 min.
5. **Findings for tickets** (not fixed, building paused): OffthreadVideo
   copies the *whole* source file into `%TEMP%` before the first frame (65
   s for the 6.3 GB master here; T5 already logged the leak on failure);
   `@remotion/media`'s fallback leaves no trace in the queue record; the
   on-card NVENC plan corrupts frames at identity size (guard any future
   full-res use); a direct `renderStart` is invisible to the renderer's
   queue (bench-only, but the export IPC has no "who owns this job" field).

**Pass criteria.** T8a — "frames/s vs the T5 figure; decode counter > 0;
colour diff": measured, the counter never left zero, the swap cannot engage
on HEVC and is a wash on H.264; colour identical where it ran. T8b —
"frames/s; size per minute": 2.27 frames/s, 0.90 GB/min. T8c — "wall
(expect ~12 s); bytes; a still": 8.8 s, 30.3 MB, stills in `…/t8/stills/`.
**The decision is Hasan's; the tests do not choose.** The synthetic projects
`t5-1080p`, `t5-1080p-intra`, `t5-1080p-h264` and the intermediates under
`.vidtsx-temp/bench/t8/` were left on disk for inspection.

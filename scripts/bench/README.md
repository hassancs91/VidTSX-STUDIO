# Preview bench (T0)

The instrument the preview-engine tests are built on. Measures **how long it
takes to put one specific frame of the timeline on screen**, on real media, in
the same Chromium build the app ships.

Before this existed, the only scrub figure in the project was one number in a
code comment (`57 ms/step`, `proxy-generator.ts`). Every "is it faster now?"
was a feeling. See `docs/PREVIEW_ARCHITECTURE.md` for what it is being used to
decide.

## Run it

```bash
# 720p proxies (what the editor previews today)
node scripts/bench/run-bench.mjs --from-project=raw-footage-test --media=proxy

# the original camera files (what export uses)
node scripts/bench/run-bench.mjs --from-project=raw-footage-test --media=original

# knobs
--runs=3        # repeats; the report gives median-of-runs plus the spread
--clips=40      # clips per layer in the synthetic timeline
--layers=1      # stacked video layers
--only=scrub-fling
--keep-open     # leave the window up to poke at it
--label=intra-proxy   # tags the report filename
```

Reports land in `.vidtsx-temp/bench/` as JSON, including machine, git sha, the
exact fixture config and every raw sample — so two runs can be diffed later
without trusting a remembered summary.

## What the numbers mean

| Column | Meaning |
|---|---|
| **p50 frame** | Median ms from *asking* for a frame to that frame being **presented**. The headline number. |
| spread | Min–max of the per-run p50s. Single runs swing on a busy machine; the spread is the honest error bar. |
| p90 | The tail. Users feel this more than the median. |
| steps/s | `1000 / p50` — scrub steps per second. |
| JS/step | Synchronous cost of the app's own `seekTo` call. |
| err | \|presented − requested\| in ms — the **frame-accuracy** half, not the speed half. |
| miss | No matching frame within 400 ms. A miss is a visible stall. |
| cached | The frame was already on screen, so nothing had to be decoded. |

**Small JS/step + large p50 = decode-bound**, which is the hypothesis the
decoder swap (T2) exists to test.

## Two traps this harness had to be fixed for

Both were live bugs in the first version, and both produced *beautiful*
numbers. Anyone extending this should know them.

1. **Animation frames measure the monitor, not the video.** `seekTo()` only
   sets React state; decoding is asynchronous, and `requestAnimationFrame`
   keeps firing at the display's refresh rate whether or not the picture
   arrived. The first version reported a flawless `16.7 ms` (i.e. 60 Hz vsync)
   for every configuration, including ones that visibly lag. The fix is
   `requestVideoFrameCallback`, which fires on actual presentation and reports
   *which* frame was presented — so it measures cost and correctness together.
   The `57 ms` figure in the code comment and the `17–25 ms` in Status.md's S2
   checkpoint may well have the same limitation; treat them as not comparable
   with the numbers here.
2. **The expected-time math must mirror the fixture's rounding.** Clips store
   `trimBefore` in whole composition frames, so the media time actually
   requested is the rounded one. Comparing against the unrounded value put
   every step half a source frame off and reported 78/150 misses — the
   harness's own bug, blamed on the decoder for about ten minutes.

A third guard is built in: the harness **refuses to measure** when
`requestAnimationFrame` is throttled, because Chromium stops producing frames
in an occluded or minimised window while timers keep running. See
`docs/ui-automation-cdp.md` — two earlier sessions were lost to exactly that.


## Comparing decoders (T2)

```bash
# the shipping path — <OffthreadVideo>. This is the default.
node scripts/bench/run-bench.mjs --from-project=raw-footage-test --media=proxy --engine=offthread

# @remotion/media (Mediabunny + WebCodecs), EXPERIMENTAL, off by default
node scripts/bench/run-bench.mjs --from-project=raw-footage-test --media=proxy --engine=webcodecs

# the instrument control: canvas tap disarmed (see below)
node scripts/bench/run-bench.mjs ... --engine=webcodecs --media-log=off
```

`--engine` sets `src/shared/studio/media-engine.ts`'s global before the
composition mounts. Nothing that ships changes: the default is `offthread`, and
an unrecognised value falls back to it rather than silently altering what
renders.

**Always run the control in the same session as the treatment.** The fling p50
on proxies moves with OS file-cache warmth — T0's published baseline says 48.3
ms and the same command re-run on a warm cache says 32.6 ms. Comparing a fresh
`webcodecs` run against a remembered `offthread` number is how you accidentally
credit the decoder for the page cache.

### The canvas probe, and why it exists

`@remotion/media` has **no `<video>` element** — it draws into a `<canvas>` —
so `requestVideoFrameCallback`, which everything above is built on, does not
exist on that path. Pointed at it unchanged, this harness reports **150/150
misses**: a perfect-looking catastrophe that is really the instrument aimed at
an element that is not there. That is trap #1 again in a new costume, and it is
why `harness/probes.ts` exists.

The replacement had to preserve both halves of what rvfc gives — **when** a
frame was presented and **which** frame it was. It taps `@remotion/media`'s own
trace log (`Drew frame <seconds>s`, emitted right after `drawImage` at
`logLevel: 'trace'`), which is the only channel carrying both. The tap does
**not** forward those lines to the real console: the driver holds
`Runtime.enable`, so each console call would be serialised over the CDP socket
and the benchmark would be timing its own instrument.

`--media-log=off` is the control. It disarms the tap, and the correct result is
that **everything misses** — that is the proof the tap is the only observation
channel and is not fabricating hits. It cannot be used for a p50 comparison,
because with it off there is nothing to compare. Bound the tap's cost from
`canvasDraws` in the report instead: ~300 traces in a ~7.5 s fling run is 0.04%
at a generous 10 µs each.

### Two more traps, found by this comparison

Both inflated the miss count against WebCodecs, and both were caught only
because the control run disagreed:

3. **A frame already on screen is not a miss.** The canvas path had no
   equivalent of the video path's `currentTime` check, so any step
   re-requesting the displayed frame waited the full 400 ms timeout for a draw
   that was never coming.
4. **The step that crosses a cut is usually free** — `premountFor` has already
   painted the incoming clip. The video probe sees this by reading every
   element's `currentTime`; the trace log does not say which canvas drew, so
   the canvas probe searches the recent draw stream instead (bounded by the
   2 s mount window — an unbounded search would turn real decodes into free
   steps and flatter the engine). Before this, 8 and 24 "misses" sat exactly
   where the control reported 8 and 23 **cached** steps.

**Playback fps is not measured on multi-layer runs, on either engine.** With N
layers, N surfaces present concurrently and the gaps between them are not frame
intervals: the canvas path reported "10000 fps" and the video path "Infinity
fps". Both now refuse and emit a note. Scrub scenarios are unaffected — they
match on media time, not on ordering.

### Extra columns on a `--engine=webcodecs` run

A `decoder path` block is printed after the main table:

| Line | Meaning |
|---|---|
| **presented via** | canvas = decoded by WebCodecs; video = `@remotion/media` **fell back** to `<OffthreadVideo>` for that clip. A speed number means nothing without this — a run that quietly fell back reports the old decoder's numbers under the new decoder's name. |
| **VideoDecoders** | created, and max concurrently open (D3.4 — hardware decoders are finite). High `created` means churn: a new decoder per seek rather than one held open. |
| **isConfigSupported** | the fallback decision itself, observed. Mediabunny asks before committing, so this is the codec-coverage answer rather than an inference from it. |
| **elements mounted** | `<video>` vs `<canvas>` counts — a mixture means some clips took each path. |

## Frame diff (T2 colour)

```bash
node scripts/bench/run-frame-diff.mjs --from-project=raw-footage-test --media=original
```

Shows the same composition frame under both engines, screenshots the composited
page each time, and diffs the pixels. Run it on `--media=original`: the proxies
are 8-bit Rec.709 H.264, where nothing interesting can happen, while the DJI
originals are 10-bit HEVC in D-Log, where tone mapping and colour handling have
the most room to disagree.

It reports **mean**, **signed mean**, and **max** channel delta separately, plus
the share of pixels past a threshold, because those distinguish the two failure
shapes: a colour-space error is a small *uniform signed* shift over nearly every
pixel, while a geometry or timing error is a large delta on a few percent of
pixels. A mean alone cannot tell them apart.

Two guards worth knowing. It waits for **presentation** rather than sleeping —
a fixed delay screenshots whatever happened to be up, which on the slow tier is
routinely the previous frame, and a colour diff of two different frames looks
exactly like a decoder disagreement. And it records the media-time gap between
the two captures, so a comparison of two different source frames is visible in
the output rather than silently averaged in.

## Baseline — 2026-08-28

Machine: this dev box. Fixture: 40 clips × 1 layer, 1920×1080 @ 30 fps,
sources are the Raw Footage Test DJI clips (**3840×2160, 60 fps, 10-bit
HEVC**). `runs=2`. Scrub steps: natural = 1 frame, fling = 15 frames.

| Scenario | 720p proxy (GOP 15) | 4K HEVC original |
|---|---|---|
| scrub, natural (1 frame) | **16.6 ms** · 60 steps/s · 0 miss | **101.5 ms** · 9.9 steps/s · 1 miss |
| scrub, fling (15 frames) | **48.3 ms** · 20.7 steps/s · 0 miss | **281 ms** · 3.6 steps/s · **70 miss** |
| playback | **59.9 fps** presented | **59.9 fps** presented |
| JS per step | 0.1 ms | 0.1 ms |
| frame accuracy (err p50) | 8.5 ms | 8.2 ms |

Three things fall out of this, and they are all decision-relevant:

- **The app's own code is not the bottleneck — 0.1 ms per step, everywhere.**
  Whatever is slow, it is not React, the serializer or the timeline UI.
- **Proxies earn their keep: ~6× on both scrub modes.** The existing design
  works. The residual pain is *flinging* on proxies (48 ms p50, 80 ms p90 ≈ 21
  steps/s), which is exactly where an all-intra proxy should win, because a
  GOP-15 proxy of a 60 fps source still means decoding up to 15 frames per
  seek. That is test T3.
- **The same 4K file that costs 281 ms per seek plays back at 59.9 fps.**
  Decoding 4K 10-bit HEVC is not hard for this machine; *seeking* it is. That
  is the entire argument for holding a decoder open and decoding forward
  (`docs/PREVIEW_ARCHITECTURE.md` §D), measured rather than asserted.

## Extending it for T2 (the decoder swap)

The harness mounts the **real** `TimelineComposition`, so switching the video
tag is a change to the product file, not to the bench — which is the point:
what gets measured is what would ship. Run the same command before and after
the swap and diff the reports.

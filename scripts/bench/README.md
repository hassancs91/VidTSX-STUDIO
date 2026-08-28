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

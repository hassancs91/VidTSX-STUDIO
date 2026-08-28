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
| **T1** | **Fidelity baseline** | (instrument) what our WYSIWYG claim is worth *today*: pixel diff of preview vs export on the same project | ½ day | pending — T2 did not need it (see T2 colour), still unbuilt |
| **T2** | **Decoder swap** | Is `@remotion/media` faster? Does colour hold on D-Log? Does 4K HEVC decode or fall back? | ~1 day | **DONE 2026-08-28** — conditional: loses at 1 layer, wins at 3. Colour holds; HEVC decodes. Results below |
| **T3** | **Proxy codec A/B** | What proxies should be made of (all-intra vs GOP 5 vs today's GOP 15 vs MJPEG) | ½ day | pending — **now unblocked**; T2 leaves the decoder question genuinely open |
| **T4** | **Proxy generation cost** | How long a real project makes you wait, and whether `-hwaccel d3d11va` on the input helps | ~2 h | pending |
| **T5** | **Resolution ceiling** | Replaces the *assertion* that 8K breaks with a number and a failure mode | ½ day | pending |
| **T6** | **Long-project stress** | Whether 3–5 h of 4K is a supported use case or a documented limit | ~1 day | pending |
| **T7** | **Effects load probe** | Whether slice 10 needs "disable effects in preview" from day one | ½ day | optional |

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

## T1 — fidelity baseline (instrument, pending)

**Question:** what is our WYSIWYG claim actually worth today? Preview decodes
720p proxies, export decodes originals — so there is already a gap, and it has
never been measured. Without this number, "the new decoder is within
tolerance" has no tolerance to be within.

**Method:** pick a reference project; capture N preview frames (CDP screenshot
of the Player at known frames, or an offscreen Player render) and the matching
frames from a real `renderMedia` export; pixel-diff them. Report per-frame max
channel delta and a perceptual delta, on ordinary footage *and* on a D-Log clip
(where colour handling differs most).

**Pass/fail:** there is no pass/fail — this test *produces* the tolerance that
T2 is then judged against. It fails only if it cannot produce a stable number
across repeat runs.

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
WebCodecs path degrades gracefully.

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

## T3 — proxy codec A/B (pending, after T2)

**Question:** what should stand-in copies be made of? Premiere's own docs give
the mechanism: intraframe media can be reduced at decode time, long-GOP media
must reconstruct a whole GOP first.

**Method:** build the same footage four ways — all-intra `-g 1` @540p CRF 28,
`-g 5` @720p CRF 26, today's `-g 15` @720p CRF 26, and MJPEG `-q:v 5` — then
run T0 against each. Record scrub p50/p90, disk footprint, and transcode time.

**Pass:** a variant that materially beats GOP 15 on the *fling* case at an
acceptable disk cost. Explicitly **after T2**, because the winning decoder
changes what the right proxy is; tuning against a decoder we are about to
replace is measurement we would redo.

---

## T4 — proxy generation cost (pending)

**Question:** how long does a real project make you wait, and does
`-hwaccel d3d11va` on the transcode *input* help? (The bundled ffmpeg has no
hardware **encoders** — verified — so the NVENC branch in `proxy-generator.ts`
is dead code that costs one failed spawn per session. It goes in the same
commit.)

**Method:** time a full proxy pass over the 27 min of 4K in `raw/`, with and
without the hwaccel flag, at `maxConcurrent = 2`. **Do not** set
`-hwaccel_output_format` — the `scale` filter needs frames in system memory.

**Pass:** a measurable win with a guarded fallback (hwaccel can fail per
machine and per codec, exactly like NVENC did).

---

## T5 — resolution ceiling (pending)

**Question:** where does export actually break? The "8K won't work" claim in
`studio-scale-limits-open` memory is *reasoning, not evidence* — export
rasterises a Chromium page at composition size, and that has never been tested
above 4K.

**Method:** same 30 s project exported at 1080p / 4K / 6K / 8K. Record wall
time, peak memory, and the failure mode when it fails (OOM? renderer crash?
silent wrong output?). Note the even-integer `scale` snapping in
`remotion-renderer.ts` interacts here.

**Pass:** a documented ceiling with a named failure mode, so product copy can
state a limit instead of a guess.

---

## T6 — long-project stress (pending)

**Question:** Hasan's actual question — 3–5 h of 4K, many clips. Supported use
case, or documented limit?

**Method:** synthesise ~3 h by importing the `raw/` clips repeatedly as
separate assets. Measure: project open time, full proxy-queue duration, memory
across a 2 h session, scrub p50 at length (T0 against the real project), and
whether the export survives. The one hard datapoint we have is the
raw-footage E2E run, which passed but hit an OOM crash mid-run and recovered.

**Pass:** either a supported path with known waits, or a documented limit with
the specific wall named (proxy generation, session memory, or export duration
— the three hypotheses in the memory).

---

## T7 — effects load probe (optional)

**Question:** where does preview fps collapse under stacked effects? Cannot be
answered directly today — packs are slices 9–10 and unbuilt; only crossfade and
dip-to-black exist. Approximate with a stack of CSS/SVG filters plus several
TSX shots on screen at once.

**Pass:** a clip/effect count at which preview drops below usable, informing
whether Q8c's "disable effects in preview" toggle ships with E2 or later.

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
| **T3** | **Proxy codec A/B** | What proxies should be made of (all-intra vs GOP 5 vs today's GOP 15 vs MJPEG) | ½ day | **DONE 2026-09-02** — all-intra 540p: fling p50 32 → 25 ms, 12% faster to make, 2.6× disk; tail unchanged; MJPEG will not play. Shipped as the proxy profile. Results below |
| **T4** | **Proxy generation cost** | How long a real project makes you wait, and whether `-hwaccel d3d11va` on the input helps | ~2 h | **DONE 2026-09-02** — yes, but only on the *discrete* adapter (1.6× faster, half the CPU); the default adapter halves CPU and saves no time. Results below |
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

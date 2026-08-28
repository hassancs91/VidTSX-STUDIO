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
| **T1** | **Fidelity baseline** | (instrument) what our WYSIWYG claim is worth *today*: pixel diff of preview vs export on the same project | ½ day | pending |
| **T2** | **Decoder swap** | Is `@remotion/media` faster? Does colour hold on D-Log? Does 4K HEVC decode or fall back? | ~1 day | pending — **recommended next** |
| **T3** | **Proxy codec A/B** | What proxies should be made of (all-intra vs GOP 5 vs today's GOP 15 vs MJPEG) | ½ day | pending — after T2 |
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

## T2 — decoder swap (pending, recommended next)

**Question:** the central one. Does `@remotion/media` (Mediabunny + WebCodecs)
actually fix seeking, and can it be adopted without breaking anything?

**Method:** add `@remotion/media@4.0.435` (verified on npm: exists at our exact
pin, depends on `remotion@4.0.435` + `mediabunny@1.37.0`; description at that
version is "Experimental WebCodecs-based media tags"). Swap `case 'video'` in
`TimelineComposition.tsx` behind a flag. Re-run T0 unchanged and diff. Because
the harness mounts the real composition, the thing measured is the thing that
would ship.

**Measure:** T0's full matrix on both media tiers; T1's frame diff including a
D-Log clip; whether 4K 10-bit HEVC decodes or falls back to `<OffthreadVideo>`;
open decoder count and behaviour at the mount window with layers ≥ 3.

**Pass:** scrub p50 materially better on at least the fling case (the one that
still hurts); frame diff within T1's baseline tolerance; DJI HEVC either
decodes or falls back **identically in preview and export**; no new stalls.

**Fail is cheap and informative:** it is one dependency and one `case`;
delete both, keep the T0/T1 instruments, and the architecture doc gets a
measured "no" instead of an opinion.

**Known risks to watch, from the architecture doc §D3:** the 4.0.435 vintage
predates ~83 releases of fixes to this component (shipping means moving the
whole Remotion train and re-vendoring `resources/vendor/`); `<Audio>` on the
WebCodecs path does **not** preserve pitch on `playbackRate`, so audio stays on
the `remotion` tag and is decided separately; the tier-4 WebGL texture hook
differs (`useOffthreadVideoTexture()` vs `onVideoFrame`/`effects`), which E2b
should be written against.

---

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

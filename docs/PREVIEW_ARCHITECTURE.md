# Preview & render architecture — the Remotion engine, weighed against
# CapCut, Premiere Pro and Camtasia

> Written 2026-08-26 from Hasan's directive: **"compare our Remotion approach
> against CapCut, Premiere Pro and Camtasia, and recommend whether we stay, go
> hybrid, or change course."** Research basis: live-source pass over Adobe,
> TechSmith, CapCut and BytePlus documentation + the Remotion docs, npm
> registry and release notes (all 2026-08-26), plus a code audit of
> `TimelineComposition.tsx`, `serialize.ts`, `proxy-generator.ts`,
> `media-jobs.ts`, `module-server.ts`, `export-entry.ts` and
> `remotion-renderer.ts`.
>
> Same pattern as `CONTENT_SAFETY_DESIGN.md` / `NEXT_FEATURES_DESIGN.md`:
> research facts first, then options each with a named recommendation, then a
> checklist that is answerable inline. **Nothing here is DECIDED until Hasan
> marks it.** Build-order pointer: `NEXT_FEATURES_DESIGN.md` Q14.
>
> Scope note: this doc decides the *engine* question only. It does not re-open
> Q8 (packs), Q9b (the colour ceiling) or the export codec matrix — it takes
> those as constraints and says what each option does to them.
>
> **Status pointer (added 2026-09-17 — the text below is kept as written on
> 2026-08-26, so it still *reads* as if S0 were the next action; it is not).**
> The spike and most of what it gated have been run. Results live in
> `docs/PREVIEW_TESTS_PLAN.md`, not here:
>
> - **S0 (§D4) — DONE 2026-08-28 as T2** (`792b1b5`, follow-up `3fdc24b`).
>   Conditional: the swap loses at 3 concurrent video elements and wins ~3× at
>   6–9; colour holds on D-Log (0.15/255); DJI 4K 10-bit HEVC decodes natively
>   in preview. `@remotion/media@4.0.435` stays behind
>   `src/shared/studio/media-engine.ts`, default `offthread`.
> - **S0's export half — DONE 2026-09-04 as T8a** (`db3f4c6`): in headless
>   Chrome `<Video>` cannot decode HEVC and falls back; on the GPU backend it
>   returns 0 frames; on H.264 it engages and is a wash.
> - **P0 shipped** (`9a3559b`, dead NVENC branch dropped; `-hwaccel` input in
>   `d0ee749`). **P1 shipped** (T3 all-intra 540p proxies, `d0ee749`; opt-in GPU
>   proxy encoder, `60c9c42`). **P2 parked** on T8a + the unexplained 4K
>   playback drop. **P3 not built.**
> - **§D3.6 answered 2026-09-17:** at 4.0.435 both tags take the same
>   `onVideoFrame: (frame: CanvasImageSource) => void` (the WebCodecs path hands
>   it an `ImageBitmap`); there is **no `effects` prop** at this pin. An E2b
>   texture hook written against `onVideoFrame` is therefore authored once.

---

## D0 — The question, and the one property that must survive

The felt gap versus CapCut is **frame-accurate scrubbing**, not rasterisation
quality. Everything below hangs off one architectural fact:

> **ONE renderer, two hosts.** Preview is `@remotion/player` running the same
> React as export; export is `@remotion/renderer` (headless Chromium + the Rust
> compositor) over an entry built by `export-entry.ts`. WYSIWYG is not a
> feature we implemented — it is a *consequence* of there being one rasteriser.

And one product fact (Q8 / Q9's "the agent is the catalog"):

> **Shots, caption templates, the kit and every future pack are the same
> thing** — a TSX component with a typed runtime-props contract, gated by D14.
> Arbitrary user- and LLM-authored React cannot be composited on a fixed GPU
> effect graph without running React. **Any option that silently drops this is
> not on the table**; where an option does drop it, this doc says so in those
> words.

The research question is therefore narrower than "which engine is best": it is
*how do the incumbents buy interactive scrubbing, what do they pay for it, and
can we buy the same thing without selling the property none of them have?*

---

## Facts established by research (not guesses)

Convention as in `NEXT_FEATURES_DESIGN.md`: verified statements are stated
plainly with a source; anything reasoned rather than read is tagged
**(inferred)**. Adobe's helpx pages refused direct fetches all session
(ECONNRESET / timeout); Adobe items below were read through search snapshots,
so their **wording is paraphrased, not quoted** — flagged *(via snapshot)*.

### A1. Ours — verified in code 2026-08-26

- `TimelineComposition.tsx` renders `<OffthreadVideo>` / `<Audio>` / `<Img>` /
  TSX shots / the caption layer inside `<Sequence>`s. In the Player,
  `<OffthreadVideo>` **is a plain `<video>` tag**; during export it becomes an
  `<Img>` fed by an exact frame extracted by the Rust/ffmpeg compositor —
  Remotion's own docs state this split.
- Clips outside a **2-second window** (`MOUNT_WINDOW_SECONDS`) are not mounted;
  `premountFor` renders the next clip hidden and frozen so the media element
  exists and has seeked *before* the cut. The recorded reason: without it every
  join flashes black for the length of a video seek.
- Proxies: **720p, libx264, CRF 26, GOP 15, `+faststart`, AAC 128k**, never
  upscaled (`scale=-2:min(720,ih)`). The GOP-15 comment records the measurement
  that drove it: at the encoder default (250 ≈ 8 s) **one scrub step cost
  ~57 ms and the timeline ran at ~20 fps**.
- Proxies are requested for **every** video asset in the pool on project open
  (`studio-handlers.ts` loops the asset list), through `media-jobs.ts` with
  `maxConcurrent = 2`, FIFO, no priority field. Preview prefers a ready proxy
  and falls back to the original (`useStudioMedia.resolvePreviewUrl`); **export
  always uses originals**. Proxies are a pure optimisation layer — nothing in
  the document depends on them.
- The bundled Remotion ffmpeg ships libx264/libx265 and **no hardware
  encoders**, so `proxy-generator.ts`'s NVENC branch is dead on every machine.
  It costs one failed ffmpeg spawn per session before `nvencUnavailable`
  sticks. The same binary **does** expose `dxva2`/`d3d11va` hwaccels, which we
  never pass on the transcode input.
- Media reaches the Player over the local express server (`module-server.ts`
  `/asset?path=`), with `Access-Control-Allow-Origin: *` and `res.sendFile`,
  i.e. **Range requests and CORS already work** — which is exactly what a
  WebCodecs decoder needs. Not `file://`.
- Installed at 4.0.435 and unused: `@remotion/webcodecs`,
  `@remotion/media-parser`, `@remotion/web-renderer`.
- **"Smart render" was never built.** `docs/studio/PLAN.md` §5 ledgers it as an
  S3+ export optimisation (ffmpeg passthrough for pure-cut spans); no code
  exists. Relevant to option C2 below.
- Export knobs we already expose: `concurrency`, Chromium `gl` backend, `scale`
  (with even-integer snapping), `hardwareAcceleration` passed to Remotion, and
  encoder detection that reports whether ffmpeg picked a hardware encoder.

### A2. CapCut

- **Engine lineage:** CapCut is built on ByteDance's in-house **VE SDK** — the
  BytePlus product page states the VE SDK is "a media processing SDK
  independently developed by ByteDance" and "widely used in ByteDance's own
  apps (e.g. TikTok, Douyin, CapCut, Xigua Video, FaceU, Ulike)", covering
  recording, editing and export, with the **Effects SDK** supplying stickers /
  segmentation / beauty. It advertises "real-time rendering effect preview,
  which is accurate to each frame". A native C++ / GPU-shader pipeline is the
  only way to make those claims **(inferred — ByteDance publishes no engine
  internals)**.
- **Preview and export share the engine, at different input resolution
  (inferred)** — CapCut never says so directly, but their support copy only
  ever attributes preview/export differences to *proxy* and *preview
  resolution*, never to a different renderer.
- **Proxy is a product-level performance mode**, toggled at Menu → Settings →
  **Performance → Proxy**. CapCut's own help says proxy "uses low-res media for
  smoother playback but **may misrepresent scaling or blur effects**" — i.e.
  they accept *semantic* preview divergence, not just softness.
- **Preview quality is a user-facing knob** ("High Quality" / "Full Quality" in
  the preview box) and CapCut tells users to ignore a blurry preview: "the
  low-quality preview is only for smoother editing performance and does not
  reflect the actual quality of the original video."
- Hardware acceleration is a settings toggle covering both real-time preview
  and final render.
- **Their honesty is worth copying:** CapCut Web is documented as
  "cloud-assisted rendering — **what you see is a best-effort approximation,
  not pixel-perfect WYSIWYG**", and mobile as "lower-resolution proxies…
  **layout and timing should match exactly**".
- **Extensibility: no third-party code path.** CapCut ships a first-party
  effect catalogue plus a *template* ecosystem (data, not code). The AR-effect
  authoring tool in the ByteDance family is **TikTok Effect House** (visual
  scripting, targets TikTok), not a CapCut desktop plugin SDK. Nothing lets a
  third party ship a new compositing primitive into CapCut desktop.

### A3. Premiere Pro

*(all via snapshot — paraphrased)*

- **Mercury Playback Engine (GPU accelerated)** handles image processing,
  colour conversion, scaling, blending and a specific set of GPU-accelerated
  effects; it explicitly **does not do encode/decode**. Hardware decode/encode
  is separate (Intel Quick Sync et al.). Playback uses **one** GPU; render and
  export may use several.
- **Preview and export share the engine, and Adobe still refuses to promise
  parity.** Adobe's *Set display quality* page states that, to optimise
  playback, quality at **any** playback resolution (Full, ½, ¼) is **lower than
  when paused** — and that GPU scaling on **export** is always at maximum
  quality regardless of the playback setting. Even the industry standard for
  "the same engine" does not ship a WYSIWYG scrub.
- **Playback resolution ≠ proxy.** Playback resolution asks the *decoder* for a
  smaller image. It is nearly free on intraframe media (ProRes/DNx/CineForm can
  be decoded at reduced size), and can *increase* CPU load on long-GOP H.264,
  where a full GOP must be reconstructed before any downscale. This is the
  single most useful fact in this whole document — see W4.
- **Decoder management is a whole subsystem**: media cache, *indexing* of
  long-GOP files ("required to speed up GOP editing"), *conforming* of audio
  (CFA) and peak files (PEK). Frame accuracy on long-GOP is bought with a
  pre-pass, and the recommended cure for hard cases is transcoding to an
  intraframe mezzanine.
- **Proxies** are a separate, explicit ingest feature (presets, Toggle
  Proxies); export reverts to originals.
- **Smart rendering** is the export-side fast path: with "Match Sequence
  Settings" + "Use Previews", already-rendered preview files are reused instead
  of re-encoded — reported as up to ~20× faster — but **only when source codec,
  frame size, frame rate and bit rate match the export exactly** (ProRes /
  DNxHD-HR / GoPro CineForm). The bounded-fast-path predicate in the industry's
  most mature implementation is *"nothing changed at all"*.
- **Extensibility, and what it costs them:** third-party effects are **C++
  plugins** on the After Effects SDK, with an optional GPU extension. GPU
  kernels are **CUDA and Metal** — OpenCL support was dropped around summer
  2021 — and a **software render path remains mandatory** as fallback. The
  barrier to authoring an effect is a compiler toolchain and a CUDA SDK version
  pinned by Adobe.
- **The user-authored-composition path is the slow path.** Motion Graphics
  Templates (.mogrt) authored in After Effects are rendered inside Premiere by
  **AELib**, an embedded After Effects engine — not by Mercury. They are
  notoriously slow, Multi-Frame Rendering roughly doubled their speed, and the
  official workaround is **Render and Replace** (bake to a flat file). **This is
  Premiere having already built option C3 (dual renderer), and the result is
  the exact failure mode C3 predicts for us.**

### A4. Camtasia

- **Proxy videos**: lower-resolution stand-ins used only while editing; export
  still renders full resolution ("It is not necessary to remove the proxy video
  from the media before exporting, as the export will still render in full
  resolution"). Camtasia tells users "it is expected that the footage should
  look slightly blurred due to lower resolution", and marks proxied media with
  a yellow dot in the bin.
- **Auto-proxy on import from network/cloud drives** since 2023.4.2; otherwise
  user-driven per media item. No documented resolution/codec, no documented
  cache location.
- Camtasia 2023 shipped an **"all new rendering engine"** described as improving
  both preview performance and export speed — i.e. a screencast-first editor
  still needed an engine rewrite to make preview keep up **(the version history
  is the source; the internals are not published)**.
- **Extensibility: assets and presets, no code.** `.campackage` bundles
  templates, libraries, themes, tool presets and export presets; custom
  "assets" are saved *property sets* on built-in annotations/behaviours/effects.
  There is no third-party effect SDK. **Camtasia is the closest existing analog
  to our pack system — minus the ability to ship a new primitive.** Our Q8
  container is a `.campackage` whose items can also be *code*.

### A5. Upstream: WebCodecs, Mediabunny, and where Remotion actually is

Verified against the npm registry and the live docs, 2026-08-26:

- Our pin **4.0.435 was published 2026-03-12**. Latest is **4.0.518, published
  today (2026-08-26)** — we are **83 patch releases / ~5.5 months** behind on a
  train that ships near-daily.
- **`@remotion/media` is the successor media-tag package**, built on
  **Mediabunny + WebCodecs**. `<Video>` from it "extracts the exact frame using
  Mediabunny and displays it in a `<canvas>` tag", **works in both the Player
  preview and server-side rendering**, and is documented as the **recommended**
  tag for new code: Remotion's own comparison ranks it *fastest*, with
  `<OffthreadVideo>` "fast" and `<Html5Video>` "medium", and states plainly that
  "both `<Html5Video>` and `<OffthreadVideo>` are **not optimized**". Only
  `<Video>` is credited with **frame-perfect playback** and partial (Range)
  asset download.
- **`<Video>` has existed since 4.0.354 — before our pin.**
  `npm view @remotion/media@4.0.435` resolves: it depends on `remotion@4.0.435`
  (exact) and `mediabunny@1.37.0`, and its description at that version is
  **"Experimental WebCodecs-based media tags"**. At 4.0.518 the dependency is
  `mediabunny@1.55.1`. **So the one-exact-version rule does not block adoption —
  the package is part of the same train.** What the version *does* decide is
  maturity: fixes landed continuously after our pin (e.g. 4.0.453 "skip video
  decoding when used in `<Audio>`… decode 1 frame ahead", 4.0.455 audio-only
  `<Audio>` wrongly falling back to `<Html5Audio>`, 4.0.472 forward native
  props), and features we might want landed later still (`effects` prop 4.0.464,
  `crop*` 4.0.500).
- **Mediabunny**: **MPL-2.0**, zero-dependency TypeScript, hardware-accelerated
  encode/decode via WebCodecs, frame-accurate seeking and packet-level access.
  Published benchmarks: metadata 862 ops/s vs 1.83 for ffmpeg.wasm; WebM
  conversion 804 fps vs 12.0. Remotion **sponsors it at $1000/month** and is
  folding Media Parser's learnings into it.
- **The two packages sitting unused in our tree are on the way out.** The
  (unreleased) **v5.0 migration doc** states `@remotion/webcodecs` and
  `@remotion/media-parser` are **discontinued in favour of Mediabunny**, and
  `getVideoMetadata()` is removed from `@remotion/renderer`. So "the WebCodecs
  route" is **not** "start using `@remotion/webcodecs`" — that would be building
  on a deprecated API. It is "adopt `@remotion/media`".
- **`@remotion/web-renderer` is stable as of 4.0.491** (browser-side rendering,
  WebCodecs + Mediabunny encoding, no ffmpeg, no bundling step) — *past our
  pin*, and it **does not support `<OffthreadVideo>` at all**. Its subset of
  supported tags/CSS makes it wrong for our arbitrary-TSX compositions, but it
  is worth knowing the door exists.
- **Why WebCodecs fixes seeking, mechanically:** a decoder cannot start at an
  arbitrary frame — it must start at a keyframe and decode forward. `<video>`
  hides this and re-pays it on *every* seek; WebCodecs exposes it, so a client
  can hold an open decoder, decode forward, and cache frames — which is exactly
  what Premiere and CapCut's native engines do. `VideoDecoderConfig` carries a
  `hardwareAcceleration` hint, and Chrome on Windows has a D3D11-based hardware
  video decoder. **This is the same fix the incumbents implemented in C++,
  arriving as a browser API.**

### A6. The cross-cutting finding

**Nobody ships a pixel-accurate preview.** Every incumbent documents the trade
in their own help pages: CapCut ("may misrepresent scaling or blur effects";
web is "not pixel-perfect WYSIWYG"), Adobe (playback quality is lower than
paused, at every playback resolution), TechSmith ("expected… slightly blurred").
They buy interactivity with fidelity because their preview path and their
export path are *not obliged* to agree.

We have the property they don't, and we got it for free. Its price is one
specific bill: **frame-accurate seeking, paid per scrub step, through
`<video>`.** The strategy that falls out of the research is therefore not
"trade WYSIWYG for speed like they did" but **"keep WYSIWYG and buy back the
decode"** — which upstream has already built.

---

## B — Limitations, ours stated as plainly as theirs

| | Preview fidelity | Scrub / decoder | Extensibility ceiling | Other hard limits |
|---|---|---|---|---|
| **VidTSX (today)** | **Exact** — same React, same rasteriser, both hosts | **Weakest link.** `<video>` seek-per-frame; GOP-15 proxies exist only to paper over it (57 ms/step at default GOP). Heavy filter stacks and multi-layer timelines drop Player fps | **Highest** — any TSX component: shots, captions, transitions, effects, agent-authored on request | 8-bit sRGB raster (Q9b: no HDR/10-bit); no hardware encoders in the bundled ffmpeg; no smart-render passthrough (we re-encode every frame of every export); export bounded by Chromium raster; single machine |
| **CapCut** | Proxy may "misrepresent scaling or blur effects"; web preview explicitly not pixel-perfect | Native decoders + GPU compositing; frame-accurate real-time preview | **Closed** — first-party effects + data templates; no third-party primitive | Account/cloud coupling; the effect catalogue is theirs to grow, not yours |
| **Premiere Pro** | Playback quality lower than paused at *every* playback resolution; preview files ≠ export unless smart-render matches exactly | Best-in-class: media cache, indexing/conforming, hardware decode, mezzanine workflow | C++ AE-SDK plugins, CUDA/Metal kernels + mandatory software path; **user-authored comps (MOGRT) run on an embedded AE engine and are the slow path** | Cost, install weight, GPU-vendor coupling (OpenCL dropped) |
| **Camtasia** | Proxy blurs preview by design | Needed a full engine rewrite (2023) to keep preview usable; auto-proxy for network media | **Lowest** — `.campackage` of assets/presets; no code, no new primitives | Screencast-shaped feature set |

Two of our four limits are structural (8-bit raster, Chromium-bound export
speed). Two are **not**: the decoder, and the absence of smart render. This doc
is mostly about the first of those.

---

## C — The options

### C1. Stay Remotion-only and optimise around it

**What it buys:** the WYSIWYG identity, the TSX/pack differentiator and the
whole build order stay exactly as they are; every hour spent is spent on
measurable wins (W0–W5 in §E) with no architectural risk. Effects (Q8c),
transitions (Q8b) and shots keep composing by construction.

**What it costs:** the ceiling is real. Proxy tuning, ordering and quality tiers
make scrubbing *better*; they do not make `<video>` seek cheap. Expect "good",
not "CapCut-instant", on heavy 4K multi-layer timelines.

**What breaks:** nothing.

**WYSIWYG / TSX packs:** untouched.

**Recommendation: YES as the floor — but C1 alone is no longer the best
available answer**, because the seek problem now has an upstream fix (§D) that
costs less than several of the optimisations. C1's wins are worth doing
regardless; C1 as the *whole* answer under-uses what shipped upstream since
March.

### C2. Hybrid: a fast path for plain media, React only where the timeline holds TSX

**Hasan's stated belief: it's a trap. Confirmed — with one exception worth
naming precisely, because it's a real slice we haven't built.**

The proposed formulation is "use the fast path only for clips whose visual
result is exactly reproducible, with automatic fallback". The failure is not in
the fallback; it is in the predicate.

1. **The predicate has to be proved over two rasterisers, and can't be.**
   "Exactly reproducible" means a GPU path and Chromium agree on chroma
   upsampling, YUV→RGB matrix and tone mapping (Remotion tone-maps by default
   since 4.0.117), on `object-fit: contain` letterboxing arithmetic, on the
   resampling kernel for a 0.87 scale, on sub-pixel translate rounding, on alpha
   compositing order, on the exact easing of a fade. Each is a
   *reimplementation*, and reimplementations agree to a tolerance, never to
   equality. A tolerance is a judgement call, and judgement calls become support
   tickets ("preview looked right, export didn't") — the exact class of bug
   WYSIWYG was bought to eliminate.
2. **The eligible class shrinks as the product grows.** Today "plain media +
   transform + fade + crossfade" is a large share of clips. After Q8c, *any*
   clip can carry an `effects[]` stack — and Q9's whole positioning is that the
   agent authors bespoke effects on request. The fast path is fastest exactly
   where the product is least differentiated, and evaporates precisely where
   users spend their creative time. You would be maintaining a second
   compositor whose coverage declines every slice.
3. **Automatic fallback makes performance unpredictable in the worst place.**
   The timeline stutters the moment a user adds the thing they are working on.
   "It got slow when I added the effect" is a worse experience than uniform
   moderate speed.
4. **It doubles the maintenance surface of the riskiest code.** Every future
   primitive (transitions, effects, keyframes, masks) needs a second
   implementation *plus* an eligibility rule, or it silently disables the fast
   path. Two of those three outcomes are bugs.

**The exception, and it is only one: the identity transform.** There *is* a
provably bounded fast path, and Adobe built exactly it. Premiere's smart
rendering reuses existing encoded data **only when source codec, frame size,
frame rate and bit rate match the export exactly** — i.e. only when the
requested transformation is *nothing*. That predicate is decidable from metadata
alone, needs no pixel comparison, and cannot drift. `docs/studio/PLAN.md` §5
already ledgers this for us as the S3+ "smart render" export optimisation
(ffmpeg passthrough of pure-cut spans), and it is **still unbuilt**.

So the honest split is:

- **Hybrid *compositor* for preview: rejected.** Divergence is unbounded in
  principle because it requires two rasterisers to agree.
- **Hybrid *export* via passthrough of untouched spans: legitimate, deferred.**
  Bounded because the predicate is "no transformation at all". It buys export
  *speed*, not scrub speed, so it does not answer D0 — file it behind the
  decoder work, not in front of it.
- **Hybrid *decoder*, single compositor: this is the actually-good idea hiding
  inside the hybrid instinct**, and it is §D. The video frame comes from a
  WebCodecs decoder instead of a `<video>` element; the compositing stays React
  in Chromium, in **both** hosts. Nothing forks, so nothing can diverge.

**Recommendation: reject the hybrid compositor** (Hasan's instinct is right, for
the reason above rather than "it's hard"); **keep smart-render passthrough
ledgered** as an export optimisation; **redirect the energy into §D.**

### C3. Dual renderer — GPU preview + Remotion export

**What it buys:** in principle, CapCut-class scrubbing on plain media.

**What it costs, concretely:** a second compositor (shader graph, text layout,
blend modes, colour management, an animation clock that agrees with Remotion's
frame math) — a multi-quarter native project for a two-person-scale codebase —
and it *still* cannot render a TSX shot, a caption template, or any pack item.
Those would have to be rendered by Remotion offscreen and fed in as textures,
per clip, per frame.

**That is not a hypothesis: Premiere already shipped it.** Mercury is the fast
native engine; user-authored After Effects compositions (MOGRTs) are rendered by
the embedded **AELib**; and MOGRTs are the documented slow path, with "Render
and Replace" (bake to a flat file) as the official coping strategy. Our TSX
shots are our MOGRTs — except they are not an occasional lower-third, they are
the *product*. We would be building a fast engine for the part of the timeline
that is least ours and a slow bridge for the part that is most ours.

**What breaks:** WYSIWYG becomes a claim to be maintained rather than a property
that holds. Every pack item lands in the slow bridge. Preview and export diverge
silently whenever the bridge and the export renderer are given different inputs
(and they will be — that is what a bridge is).

**Recommendation: NO.** Revisit only under the trigger in §E2.

### C4. Replace the engine

**What it buys:** native performance parity.

**What it costs:** everything downstream of "every visual element is code" — TSX
shots, caption templates, the kit, Q7 packages, the entire Q8 pack system, and
Q9's "the agent is the catalog", which is explicitly the moat. It also costs the
export path we have already hardened, and the 4K DJI E2E result. The
buy-instead-of-build variants do not rescue it: commercial editor SDKs (IMG.LY
CE.SDK, Banuba) license per **monthly active user** and, for CE.SDK, **per
exported video** — structurally incompatible with a local-first app under
FSL-1.1-MIT that does not phone home; cloud render APIs (Shotstack,
$0.20–0.30/min) contradict "no backend" outright.

**What breaks:** the differentiator, on purpose.

**Recommendation: NO.** Recorded here so it is closed with a reason, not left as
an open "someday".

---

## D — The WebCodecs route, evaluated seriously

**Is it the real answer to the seeking gap? Yes — but the specific route
matters, and it is not the one the installed-but-unused packages suggest.**

### D1. What upstream actually offers now

- **Not** `@remotion/webcodecs` / `@remotion/media-parser`: both are
  **discontinued in the (unreleased) v5.0 migration** in favour of Mediabunny.
  Building on them would be building on an announced deprecation. Their presence
  in `node_modules` is a transitive artefact, not an asset.
- **Not** `@remotion/web-renderer` for us: stable since 4.0.491, but it renders
  in the browser over a **subset of tags and CSS**, which is the one thing
  arbitrary TSX cannot promise. (It is, however, why `<Video>` from
  `@remotion/media` gets first-class attention upstream — web-renderer does not
  support `<OffthreadVideo>` at all.)
- **Yes**: **`<Video>` / `<Audio>` from `@remotion/media`**, Mediabunny +
  WebCodecs, documented as working **in the Player and in server-side
  rendering**, credited with **frame-perfect playback**, partial download, and
  the **fastest** rendering of the three video tags — with `<OffthreadVideo>` as
  an automatic fallback for anything it cannot decode.

### D2. What it would give the preview

- **Seeking stops being a `<video>` seek.** A held decoder + decode-forward + a
  frame cache is the same technique Premiere buys with indexing and CapCut with
  native decoders. This attacks the 57 ms/step measurement directly, rather than
  papering over it with GOP 15.
- **Hardware decode via WebCodecs' `hardwareAcceleration` hint** (Chrome on
  Windows has a D3D11 video decoder) — the acceleration Chromium already applies
  to `<video>`, but now under our control and without a seek round-trip.
- **Range requests** already work on our asset server, so a 4K original can be
  read partially instead of streamed whole.
- Possibly **fewer proxies**: if a 1080p-displayed preview of a 4K H.264 original
  decodes acceptably, the skip predicate in W1 gets much more aggressive. To be
  measured, not assumed.
- It also makes **export faster** — the same component is the fastest render path
  per Remotion's own comparison.

### D3. What it would cost, honestly

1. **Version decision.** Two routes:
   - **(a) Pin-hold:** add `@remotion/media@4.0.435`. Zero train movement, no
     re-vendoring — but that vintage's own description is **"Experimental
     WebCodecs-based media tags"** and it predates ~83 releases of fixes.
     **Correct for the measurement spike, wrong to ship.**
   - **(b) Train bump** to 4.0.518 (or whatever is current at the time), all
     Remotion packages together per CLAUDE.md, **plus re-running
     `scripts/build-vendor.mjs`** because
     `resources/vendor/{three,react-three-fiber,react-three-drei,remotion-three,preview-runtime}.js`
     are built against the pinned versions. Cost is regression surface, not
     concept: a full export A/B on a reference project, the 1,105-test gate, and
     the type baseline.
2. **Codec coverage.** Mediabunny's supported set governs. H.264/AAC proxies are
   safe; **HEVC / 10-bit DJI originals are the risk** on the export side, where
   we always use originals. The `<OffthreadVideo>` fallback keeps this from being
   fatal, but a fallback that fires in export and not in preview is exactly the
   kind of asymmetry we must measure rather than assume. Note we *already* decode
   different files in the two hosts (proxy vs original) — the invariant we sell
   is "same composition, same React", not "same bytes". **ProRes decode is off by
   default** and needs an extra package.
3. **Colour.** `<OffthreadVideo>` tone-maps by default (since 4.0.117); the
   Mediabunny path handles colour its own way. A preview-only swap therefore
   risks a *colour* divergence on log/HDR-ish sources — which is precisely
   Hasan's DJI D-Log footage. **This is the strongest argument for adopting on
   both hosts rather than preview-only.**
4. **Decoder-session limits.** Hardware decoders are a finite resource. Our
   2-second mount window + `premountFor` + (soon) transitions mounting two clips
   at once could open many simultaneous decoders. Behaviour at the limit
   (throttle? fallback? failure?) must be measured on a real multi-layer
   timeline, not a two-clip demo.
5. **Audio path.** `<Audio>` from `@remotion/media` plays via Web Audio in
   preview with `<Html5Audio>` fallback, and **`playbackRate` changes pitch** (no
   pitch preservation on the WebCodecs path), whereas the fallback preserves it.
   We expose clip `playbackRate`. **Recommendation: swap video first, leave
   `<Audio>` on the `remotion` tag** until the pitch question is decided
   deliberately — sped-up speech that suddenly sounds chipmunked is a product
   regression, not a perf win.
6. **Pack interaction (cross-ref Q8c tier 4).** The WebGL-shader tier's texture
   hook differs: `useOffthreadVideoTexture()` belongs to the OffthreadVideo
   world; `@remotion/media` offers `onVideoFrame` and an `effects` prop
   (4.0.464). If we adopt, **the E2b WebGL parity spike should be written against
   the new API** — worth confirming during the spike so E2b isn't authored twice.

### D4. The spike that decides it (cheap, and it is the recommended next action)

> **Outcome: run 2026-08-28 as T2** — see the status pointer at the top of this
> doc and `docs/PREVIEW_TESTS_PLAN.md` §T2 / §T8a. Do not re-run it from this
> description; the bench commands are in `scripts/bench/README.md`.

**S0 — measurement spike, hours not days.** Add `@remotion/media@4.0.435`
(pin-hold route (a)), swap `case 'video'` in `TimelineComposition.tsx` behind a
dev flag, and measure on the Raw Footage Test project (real 4K DJI clips) and a
100+-cut timeline:

- scrub steps/sec and dropped frames vs today, on **proxy** and on **original**
- playback fps with 3–5 stacked layers
- open decoder count / failure behaviour at the mount window
- a frame diff (preview capture vs `renderMedia` output) on ~20 sampled frames,
  including one D-Log clip → the colour question, answered with pixels

**Acceptance gates before shipping anything:** frame diff within the same
tolerance we already accept between proxy-preview and original-export; no export
regression on the reference project; test gate 1,105 and type baseline 26/22
unchanged; DJI HEVC originals either decode or fall back cleanly **in both hosts
identically**.

**If S0 passes:** ship on route (b) (train bump), video tag swapped in
`TimelineComposition.tsx` — one file, both hosts, identity preserved.
**If S0 fails:** we have spent hours, we keep C1's wins, and we have a measured
reason on file.

---

## E — Recommendation, and the near-term wins

### E1. What to commit to now

**Commit: "one renderer, better decoders" — C1 + D.** Keep the single-renderer
identity as an invariant (it is the property no competitor has and the reason
packs work at all), and close the seek gap by replacing the *decoder* under it,
not the compositor around it. Concretely: run **S0** first; if it passes, adopt
`@remotion/media` in `TimelineComposition.tsx` for **both** hosts on a single
bumped Remotion train; then tune proxies against the decoder we actually ship.

### E2. What to defer, with the trigger that would revisit it

| Deferred | Revisit when |
|---|---|
| Hybrid compositor (C2) | Never on divergence grounds. Only if we ever ship a *documented, user-visible* "fast preview mode" that is honestly labelled approximate — CapCut's posture, adopted deliberately, not a silent optimisation |
| Smart-render export passthrough (C2 exception / PLAN §5 S3+) | When export *duration* becomes the top complaint. Predicate stays "identity transform only", Adobe-style metadata match |
| Dual renderer (C3) | Only if S0 fails **and** C1's wins leave scrub below ~15 fps on a 1080p 3-layer timeline on a mid GPU **and** users are actually leaving over it. Even then, read the MOGRT/AELib story first |
| Replace engine (C4) | If the product stops being "every visual element is code". That is a positioning change, not an engineering one |
| `@remotion/web-renderer` | If a browser / no-Node deployment ever appears (Q11's CLI + local API does not need it) |

### E3. Near-term wins — sized, and reordered

Hasan's list, plus one that outranks all of them, plus the hygiene item found in
the audit:

| # | Win | What it actually buys | Size | Notes |
|---|---|---|---|---|
| **W0** | **Delete the dead NVENC branch** (or gate it on a real one-time encoder probe) | Removes one guaranteed-failing ffmpeg spawn per session; deletes misleading code | **XS** (~30 min) | Bundled ffmpeg has no hardware encoders — verified. Pure hygiene; ship with W2 |
| **W2** | **`-hwaccel d3d11va` on the transcode input** | Faster proxy *generation* (decode side); nothing for scrub | **XS** (~1 h + test) | Needs the same guarded-fallback shape the NVENC branch had, since hwaccel can fail per-machine/per-codec. Do **not** set `-hwaccel_output_format` — the `scale` filter needs frames in system memory |
| **W4** | **Proxy codec/GOP A/B: intraframe vs GOP-15** | **The one on this list that attacks the felt gap.** Adobe's own decoder facts say it: intraframe media reduces at decode time, long-GOP must reconstruct a whole GOP first. A GOP-1 (or MJPEG) proxy makes a seek cost *one frame decode* | **S** (~1 day incl. harness) | Measure three variants — `-g 1` @540p CRF 28, `-g 5` @720p CRF 26, MJPEG `-q:v 5` — on scrub fps, disk footprint and transcode time. Trades disk for scrub; that is the trade Premiere users make with ProRes proxies every day |
| **W3** | **Timeline-first proxy ordering** (+ playhead-clip priority) | Time-to-usable on open, not steady-state speed. Today `media-jobs` is FIFO over the whole asset pool at `maxConcurrent = 2` | **S** (~half day) | Needs a priority field in `media-jobs.ts` and an ordered request loop in `studio-handlers.ts`. Highest *felt* win of the small ones |
| **W1** | **Skip proxies that can't help** | Saves transcode time and disk on assets where the proxy is not cheaper to decode than the source | **S** (~half day) | Honest predicate: `height ≤ 720 && codec == h264` is *not* sufficient — a 720p long-GOP source still seeks badly, which is the whole point of W4. Do it properly with a cheap keyframe-interval probe (`ffprobe -select_streams v -show_entries packet=flags -read_intervals %+5`) and skip only when the source is *already* short-GOP and small |
| **W5** | **Preview-quality / proxy-tier setting** | User control + honest expectation-setting; the CapCut/Premiere knob | **S–M** (~1–1.5 days) | Ship it **last**: it should encode whatever W4 and S0 prove, not guess tiers up front. Likely tiers: *Original* (strong machines) / *720p* / *540p*. Lives in Studio settings; needs a regeneration flow on tier change |

**Reordering, and why.** Hasan's order was W1 → W2 → W3 → W5. Recommended order:
**S0 → W0+W2 → W4 → W3 → W1 → W5.** The reasons are specific:

- **S0 first** because tuning proxy parameters against a decoder we may replace
  in the same month is measurement we would have to redo. It costs hours, and it
  changes the target of every other item.
- **W4 promoted** (it wasn't on the list) because it is the only proxy change
  that addresses seek *cost* rather than decode *volume*, and Adobe's intraframe
  / long-GOP asymmetry is the mechanism.
- **W1 demoted** because a defensible skip predicate needs the keyframe probe,
  and because if S0 + W4 land, the proxy tier changes and the predicate has to be
  rewritten anyway.
- **W5 last** because a settings knob should ship the answer, not the question.

W0 + W2 are one commit in one file and can go any time, including before slice 8
— they are not gated on anything.

---

## F — Cost/risk against the current build order

Slice 8 (text-based editing) is next and touches none of this. Proposed
placement, sizes in the tracker's vocabulary:

| Proposed | Work | Size | Risk | Placement |
|---|---|---|---|---|
| **P0** | W0 + W2 (`proxy-generator.ts` only) | XS | Low — guarded fallback; worst case reverts one commit | Any time; before or alongside slice 8 |
| **S0** | The measurement spike (§D4), dev-flagged, nothing shipped | XS–S | **Near-zero** — one dep at the existing pin + one `case` behind a flag; deleted if it fails | **Before** slice 9. Its result is what Hasan actually decides on |
| **P1** | W4 A/B + W3 ordering | S | Low — the proxy layer is pure optimisation; a bad tier is one regeneration away | After S0, so it tunes the right decoder |
| **P2** | Decoder adoption: train bump + `@remotion/media` in both hosts + re-vendor + export regression | **M** | **Medium** — the risk is the 83-release train bump, not the component. Contained by the §D4 acceptance gates and by the fact that the code change is one `case` in one file | Only if S0 passes; beside or after slice 9 (E1 transitions), **not during** — E1 edits the same composition |
| **P3** | W1 (with keyframe probe) + W5 (preview-quality setting) | S–M | Low | After P2, so the tiers describe reality |
| — | Smart-render export passthrough | M–L | Medium (ffmpeg concat correctness, the a/v duration gate) | Ledgered, unscheduled |
| — | C3 dual renderer / C4 replacement | XL / XXL | High / existential | Rejected above |

**Interaction with slice 9 (Q8b transitions):** `TransitionRenderer` will mount
two clips through the overlap, doubling live decoders exactly where scrubbing is
already hardest. That is an argument for **S0/P2 before or with E1**, and an
argument against doing P2 *during* E1 (two hands in `TimelineComposition.tsx`).

**Interaction with Q8c effects (E2):** unchanged by any recommendation here.
CSS/SVG filter tiers apply identically over a `<canvas>` and a `<video>`; the
tier-4 WebGL texture hook is the one API detail to confirm in S0 (§D3.6).

**Interaction with Q9b (colour ceiling):** unchanged — the 8-bit sRGB raster is a
property of Chromium rasterisation, not of the video decoder. Adopting
`@remotion/media` neither lifts nor lowers it; it only changes *who* converts YUV
to RGB, which is why the D-Log frame diff is in S0's gate list.

---

## Checklist (answerable inline)

1. **The invariant:** confirm "ONE renderer, two hosts" stays a hard invariant —
   no option may fork the compositor, and any preview approximation must be
   user-visible and labelled? *[recommend: yes]*
2. **Hybrid compositor (C2):** rejected on bounded-divergence grounds (the only
   provably safe predicate is the identity transform)? *[recommend: yes —
   Hasan's instinct confirmed, for the reason in C2, not for "it's hard"]*
3. **Dual renderer (C3):** rejected, with Premiere's MOGRT/AELib outcome recorded
   as the evidence? *[recommend: yes]*
4. **Engine replacement (C4):** closed, with the reason recorded (kills TSX packs;
   commercial SDKs are MAU/per-export licensed; cloud APIs contradict
   no-backend)? *[recommend: yes]*
5. **The WebCodecs route = `@remotion/media`**, not `@remotion/webcodecs` /
   `@remotion/media-parser` (both discontinued in the unreleased v5.0)?
   *[recommend: yes]*
6. **Run S0** (the hours-scale measurement spike at the current pin, dev-flagged)
   as the next preview-engine action, before any proxy tuning?
   *[recommend: yes — the cheapest decision-changing experiment available]*
7. **If S0 passes, adopt in BOTH hosts** (not preview-only), accepting a full
   Remotion train bump + re-vendor, gated on frame diff (incl. a D-Log clip),
   export regression, 1,105 tests and the 26/22 type baseline? *[recommend: yes —
   preview-only would re-introduce exactly the two-decoders-one-claim divergence
   this doc rejects]*
8. **`<Audio>` stays on the `remotion` tag** for now (the WebCodecs path does not
   preserve pitch on `playbackRate`)? *[recommend: yes, decide separately]*
9. **Near-term wins in the reordered sequence S0 → W0+W2 → W4 → W3 → W1 → W5**,
   with W4 (intraframe/short-GOP proxy A/B) promoted onto the list and W5 demoted
   to last? *[recommend: yes]*
10. **W0**: delete the dead NVENC branch outright rather than keep it behind a
    probe? *[recommend: delete — the bundled ffmpeg has no hardware encoders, and
    a probe for a capability we never ship is cost without benefit]*
11. **Smart-render export passthrough** stays ledgered (PLAN §5 S3+) as the one
    legitimate hybrid, unscheduled, with an Adobe-style exact-match predicate?
    *[recommend: yes]*
12. **Claims language**: we may say "what you scrub is what renders"; we may
    **not** say "hardware-accelerated timeline" until S0/P2 lands, nor anything
    about 10-bit/HDR (Q9b unchanged)? *[recommend: yes]*

---

## Key sources

**Ours (code, 2026-08-26):** `src/shared/studio/TimelineComposition.tsx` ·
`serialize.ts` · `src/main/services/studio/{proxy-generator,media-jobs,export-entry}.ts` ·
`src/main/services/{module-server,remotion-renderer}.ts` ·
`src/features/studio/hooks/useStudioMedia.ts` · `docs/studio/PLAN.md` §5 ·
`package.json` pins.

**Remotion / upstream (live, 2026-08-26):** `remotion.dev/docs/media`,
`/docs/media/video`, `/docs/media/audio`, `/docs/media/support`,
`/docs/video-tags`, `/docs/offthreadvideo`, `/docs/performance`,
`/docs/web-renderer`, `/docs/5-0-migration`, `/blog/mediabunny` · GitHub release
notes v4.0.453 / v4.0.455 / v4.0.472 · npm registry (`remotion` dist-tags +
publish times; `@remotion/media@4.0.435` and `@4.0.518` dependency sets) ·
mediabunny.dev.

**CapCut / ByteDance:** capcut.com/help — *Editing doesn't match displayed*, *Why
does the video quality change after exporting*, *How do I fix blurry videos after
importing* · capcut.com resource pages (Performance → Proxy, hardware
acceleration) · docs.byteplus.com — *BytePlus Video Editor (VE) SDK product
overview*, *Effects SDK*.

**Adobe (via search snapshot — direct fetches failed all session; wordings
paraphrased):** helpx *Mercury Playback Engine GPU acceleration*, *Set display
quality for the Source and Program Monitors*, *Use preview files when rendering*,
*Smart rendering supported formats*, *Create proxies / ingest* · Adobe community
FAQ *What is Smart Rendering?*, *Intraframe vs Long-GOP*, *Conforming &
indexing* · `ppro-plugins.docsforadobe.dev` *GPU Effects & Transitions* ·
frame.io blog on MOGRT / Dynamic Link rendering via AELib.

**TechSmith:** support.techsmith.com *FAQ: Proxy Videos*, *Playback on Timeline
Appears Choppy*, *Camtasia 2023 version history* · techsmith.com tutorials
*Package & share Camtasia resources* (`.campackage`), *Create custom assets*.

**WebCodecs:** W3C WebCodecs spec · developer.chrome.com *Video processing with
WebCodecs* / *High performance video with hardware decoding* · MDN *Video
processing concepts*.

**Commercial SDK licensing (for C4):** img.ly pricing / CE.SDK product pages ·
banuba.com pricing guide · shotstack pricing.

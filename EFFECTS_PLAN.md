# EFFECTS_PLAN.md — Studio clip effects roadmap

> Hand this file to Claude to implement items **one at a time**. Each task is
> self-contained. Tick the checkbox and flip the **Status** when done.
>
> **Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done
>
> Sibling roadmap: clip-to-clip transitions live in
> [`TRANSITIONS_PLAN.md`](TRANSITIONS_PLAN.md) — different subsystem (see Phase 6).

---

## How the foundation works (read first)

Both the live `<Player>` and the headless export render through the **same**
[`StudioComposition`](src/features/studio/components/StudioComposition.tsx), so an
effect only has to be defined once to work in preview **and** the final MP4.

Effects are a stack stored on the clip: `effects?: StudioEffect[]` on
`StudioVideoClip` (at most one entry per type). At render time `EffectsLayer`
wraps the clip's video and calls `computeEffectStyle(effects, frame, …)` per
frame, which folds the stack into **`opacity` + `transform` + `filter`**:
opacity multiplies, transforms and filters concatenate. With no effects the clip
renders bare (byte-identical to pre-effects output). v1 is **Video track only**.

### Anatomy of a Tier-1 effect (the cheap path)

Adding an effect expressible as `opacity` / `transform` / `filter` touches
exactly three spots:

1. **Union** — add the name to `StudioEffectType` and a small interface to the
   `StudioEffect` union in
   [`src/shared/ipc/types/studio.ts`](src/shared/ipc/types/studio.ts)
2. **CSS** — add a `case` in `computeEffectStyle(...)` in
   [`StudioComposition.tsx`](src/features/studio/components/StudioComposition.tsx)
   (`frame` = clip-local frame; `durationInFrames`, `fps` available)
3. **Catalog** — add an entry to `EFFECT_DEFINITIONS` in
   [`src/features/studio/services/effects.ts`](src/features/studio/services/effects.ts)
   (`label`, `description`, `createDefault()`, slider `params`) — the tab renders
   it automatically.

That's it. No DB migration (clips persist as a JSON blob). Time-based params
should be stored in **seconds**, not frames, so they survive an export-fps
change. Type-check with `npx tsc -p tsconfig.web.check.json --noEmit` (filter to
the studio files — the tree has unrelated pre-existing errors).

### Key files

| Concern | File |
|---|---|
| Types | `src/shared/ipc/types/studio.ts` |
| Catalog + helpers | `src/features/studio/services/effects.ts` |
| CSS compute + `EffectsLayer` | `src/features/studio/components/StudioComposition.tsx` |
| Tab UI | `src/features/studio/components/EffectsTab.tsx` |
| Edit-time hook (`setClipEffects`) | `src/features/studio/hooks/useStudioVideoClips.ts` |
| Tab registration | `src/features/studio/components/ControlPanel.tsx`, `StudioScreen.tsx` |
| Export path | `src/features/studio/services/studio-render-input.ts`, `src/main/ipc/studio-render-handlers.ts` |

---

## Foundation decisions to settle (shape everything downstream)

- [ ] **Atomic effects vs. "Looks" (named recipes).** Many requested effects are
      really stacks (Vintage = sepia + grain + vignette + contrast). Decide
      whether to ship one-click **Looks** on top of the atomic effects (natural
      sibling to the existing Presets panel; a Look is just a named default
      `effects[]` stack). Shapes the UI as the list grows past ~8.
- [ ] **Keyframes on the horizon?** Today each effect is static or has a fixed
      built-in animation (fade ramps edges, zoom ramps start→end). A general
      "animate any param over time" system would retroactively simplify
      fade/zoom/shake into keyframed opacity/scale/translate. Big architecture —
      decide if it's in scope before bespoke per-effect animation piles up.

---

## Phase 0 — Foundation ✅ (done)

- [x] Data model: `StudioEffectType`, `StudioEffect` union, clip `effects?[]`
- [x] `computeEffectStyle()` + `EffectsLayer` in `StudioComposition` (preview == export)
- [x] `EFFECT_DEFINITIONS` + `toggleEffect`/`updateEffectParam` helpers
- [x] Effects tab in the left ControlPanel (operates on the selected video clip)
- [x] Export-path threading (effects pass through; fade in seconds → fps-safe)
- [x] Hook `setClipEffects` + persistence + undo (free via existing save path)
- [x] Starter set: **Fade, Zoom (Ken Burns), Blur, Black & White, Camera Shake**

---

## Phase 1 — Infrastructure (do before big batches; multiplies everything)

- [ ] **Overlay-layer support** — let `EffectsLayer` render sibling `<div>`s
      above (and/or below) the video, driven by the effect stack. *Unlocks all of
      Phase 3 (vignette, tint, letterbox, light-leak, border).* One contained
      change in `StudioComposition`.
- [ ] **Easing field** — optional `easing?: 'linear'|'ease-out'|'ease-in-out'|'spring'`
      on animated effects (fade/zoom/pan/pulse); apply when mapping frame→value.
      Dropdown in the tab. *(Small.)*
- [ ] **Animated preview thumbnails in the tab** — a tiny component that loops the
      effect over a poster frame so each effect shows a live mini-preview. Every
      new effect gets one free. *(Moderate UI, no render-path change.)*
- [ ] **(Optional, big) Keyframe system** — per-param keyframe tracks; generalizes
      every animated effect. See foundation decision above.

---

## Phase 2 — Tier 1 effects (pure CSS: `filter` / `transform` / `opacity`)

Each is one `case` + one catalog entry. No infra needed. ⭐ = high editing value.

- [ ] ⭐ **Brightness** — `filter: brightness()` (slider)
- [ ] ⭐ **Contrast** — `filter: contrast()`
- [ ] ⭐ **Saturation** — `filter: saturate()` (the vibrance complement to B&W)
- [ ] ⭐ **Glow / Bloom** — `filter: drop-shadow()` soft halo (or brightness+blur overlay)
- [ ] **Sepia / Warm** — `filter: sepia()`
- [ ] **Hue shift** — `filter: hue-rotate()` (color mood / cycle)
- [ ] **Invert (negative)** — `filter: invert()`
- [ ] **Opacity / Ghost** — constant `opacity < 1` (static)
- [ ] **Rotate / Tilt** — `transform: rotate()` (static or slow animated)
- [ ] **Flip H / V** — `transform: scaleX(-1)` / `scaleY(-1)`
- [ ] **Slide in/out** — `translate` ramp at the clip edges (positional reveal;
      sibling of Fade)
- [ ] **Pulse / Zoom-punch** — oscillating `scale` (sibling of Shake, on scale;
      good for beat-synced energy)
- [ ] **Pan + Zoom (full Ken Burns)** — extend Zoom with x/y `translate` ramp +
      a direction param
- [ ] **Chromatic aberration (cheap)** — dual red/blue `drop-shadow` offsets

> **Skip-or-relocate:** Flip/Rotate arguably belong with the *transform* tools,
> not Effects. Invert/Ghost are niche — easy, but they clutter the panel.

---

## Phase 3 — Tier 2 effects (need the Phase 1 overlay layer)

- [ ] ⭐ **Vignette** — radial-gradient overlay (darkened edges)
- [ ] ⭐ **Color tint / Wash** — solid or gradient overlay + opacity (teal-orange, etc.)
- [ ] **Letterbox / Cinematic bars** — two black bars (animatable in)
- [ ] **Light leak** — animated warm gradient sweeping across
- [ ] **Border / Frame** — wrapper border + radius + optional inner shadow
- [ ] **Strobe / Flash** — overlay opacity (or `brightness`) spike, periodic

---

## Phase 4 — Tier 3 effects (SVG `<filter>`; deterministic in Chromium)

`feTurbulence` unlocks a whole class. Needs an embedded `<svg>` filter def + a
`filter: url(#id)`; recompute per frame to animate.

- [ ] **Film grain / Noise** — `feTurbulence` overlay (the single most-requested "look" ingredient)
- [ ] **Displacement / Ripple / Wave** — `feDisplacementMap` + `feTurbulence`
- [ ] **Posterize** — `feComponentTransfer` (discrete steps)
- [ ] **Pixelate / Mosaic** — downscale-then-upscale, or `feImage` tiling
- [ ] **Sharpen** — `feConvolveMatrix`
- [ ] **Duotone (accurate)** — `feColorMatrix` map to two colors
- [ ] **Halftone / dots** — `feImage` + blend (harder)

---

## Phase 5 — Tier 4 effects (layered video copies; bigger structural change)

`EffectsLayer` currently wraps a single child — these need it to render multiple
offset copies of the video, so they're a real change.

- [ ] **Glitch (RGB split + slices)** — 3 channel-offset copies + random slices/jitter
- [ ] **VHS / Old TV** — scanlines + chroma noise + jitter composite
- [ ] **Mirror / Kaleidoscope** — duplicated flipped copies
- [ ] **Echo / Trails** — delayed semi-transparent copies (needs frame delay — hardest)

---

## Phase 6 — Separate subsystems (NOT per-clip CSS effects)

Flagged so they don't get mis-scoped into the Effects tab.

- [ ] **Transitions between clips** (crossfade / slide / wipe / dissolve) — lives
      *between two clips*, needs overlap logic. → [`TRANSITIONS_PLAN.md`](TRANSITIONS_PLAN.md)
- [ ] **Speed ramp / Slow-mo / Freeze-frame / Reverse** — time remap; touches
      `playbackRate`, trimming, and duration math. Different plumbing.
- [ ] **Chroma key (green screen)** — per-pixel keying → WebGL/canvas shader. Hard.
- [ ] **True motion blur** — frame blending; not cheap on video in Remotion. Hard.
- [ ] **Particle overlays** (snow / confetti / bokeh) — better built as TSX overlays
      than as clip effects.

---

## Suggested order

1. **Phase 2 high-value (⭐):** Brightness, Contrast, Saturation, Glow — instant grading wins, zero infra.
2. **Phase 1 overlay infra**, then **Phase 3 ⭐:** Vignette, Tint — the next biggest visual payoff.
3. Settle the **Looks vs. atomic** decision; if yes, ship a few named Looks on the atomic set.
4. Cherry-pick **Film grain** (Phase 4) — it's the keystone of most "cinematic" looks.
5. Stylized/energetic batch (Glitch, VHS) only if your content calls for it.

# TRANSITIONS_PLAN.md — Studio video transitions roadmap

> Hand this file to Claude to implement items **one at a time**. Each task is
> self-contained. Tick the checkbox and flip the **Status** when done.
>
> **Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## How the foundation works (read first)

Both the live `<Player>` and the headless export render through the **same**
[`StudioComposition`](src/features/studio/components/StudioComposition.tsx), so a
transition only has to be defined once to work in preview **and** final MP4.

A transition is attached to a clip edge (`transitionIn` / `transitionOut` on
`StudioVideoClip`). The renderer **extends the previous clip's `<Sequence>`** so
it keeps playing underneath while the incoming clip animates in on top — a true
cross-fade with **zero change to timeline duration** (captions/audio/cut-time
stay exact). Out transitions play in-place over the clip's last frames.

### Anatomy of a Tier-1 transition (the cheap path)

Adding a transition that only animates the **incoming** layer (opacity /
transform / clip-path / filter / mask) touches exactly three spots:

1. **Union** — add the name to `StudioTransitionType`
   in [`src/shared/ipc/types/studio.ts`](src/shared/ipc/types/studio.ts)
2. **CSS** — add a `case` in `transitionLayerStyle(type, p, dir)`
   in [`src/features/studio/services/transitions.ts`](src/features/studio/services/transitions.ts)
   (`p` = presence 0→1; `dir` = `'in' | 'out'`)
3. **Catalog** — add an entry to `TRANSITION_DEFINITIONS` (same file) for the tab

That's it. Type-check with `npx tsc -p tsconfig.web.check.json --noEmit`
(filter to the studio files — the tree has unrelated pre-existing errors).

### Key files

| Concern | File |
|---|---|
| Types | `src/shared/ipc/types/studio.ts` |
| Catalog + CSS + planner | `src/features/studio/services/transitions.ts` |
| Rendering (`TransitionLayer`, planner use) | `src/features/studio/components/StudioComposition.tsx` |
| Tab UI | `src/features/studio/components/TransitionsTab.tsx` |
| Edit-time hook | `src/features/studio/hooks/useStudioVideoClips.ts` |
| Export path | `src/features/studio/services/studio-render-input.ts`, `src/main/ipc/studio-render-handlers.ts` |
| Timeline indicator | `src/features/studio/components/TrackRow.tsx`, `StudioTimeline.tsx` |

---

## Phase 0 — Foundation ✅ (done)

- [x] Data model: `StudioTransitionType`, `StudioClipTransition`, clip `transitionIn`/`transitionOut`
- [x] `transitionLayerStyle()` + `planVideoTransitions()` + `TRANSITION_DEFINITIONS`
- [x] Rendering in `StudioComposition` (extend-prev cross-fade, in-place out)
- [x] Transitions tab (In/Out, type picker, duration slider, neighbour-aware copy)
- [x] Export path threading (seconds→frames, fps rescale)
- [x] Timeline edge wedges + split cleanup + persistence + undo
- [x] Starter set: **Fade, Slide, Wipe, Zoom, Flip**

---

## Phase 1 — Infrastructure (do before the big batch; multiplies everything)

- [ ] **Direction field** — add optional `direction?: 'left'|'right'|'up'|'down'`
      to `StudioClipTransition`; make Slide/Wipe/Push respect it. Collapses 4
      directional variants into 1 type + a direction picker in the tab.
      *(Tier: small refactor — touches types, `transitionLayerStyle`, tab UI.)*
- [ ] **Easing field** — add optional `easing?: 'linear'|'ease-out'|'ease-in-out'|'spring'`;
      apply when mapping frame→`p` in `TransitionLayer`. Dropdown in the tab.
      *(Tier: small — one `interpolate`/easing swap.)*
- [ ] **Animated thumbnails in the tab** — a small `TransitionPreview` component
      that stacks an outgoing + incoming card and loops `p` 0→1 through
      `transitionLayerStyle()`. Default to a static mid-pose (`p≈0.5`), animate
      on hover for perf. Abstract two-tone cards first; optional real-frame
      upgrade later (frame-extractor). Every new transition gets a preview free.
      *(Tier: moderate UI, no render-path changes.)*
- [ ] **(Optional) Real-frame thumbnails** — feed the preview a poster frame from
      the previous clip + selected clip instead of abstract cards.

---

## Phase 2 — Tier 1 transitions (pure CSS on the incoming layer)

Each is one `case` + catalog entry (+ direction param if Phase 1 landed).

- [ ] **Slide — directions** (left / right / up / down) — `translateX/Y`
- [ ] **Wipe — directions** (left / right / up / down) — `clip-path: inset()`
- [ ] **Diagonal wipe** — `clip-path: polygon()`
- [ ] **Iris / Circle reveal** — `clip-path: circle(r%)` growing
- [ ] **Zoom out** — scale `1.4 → 1` (mirror of current zoom)
- [ ] **Flip horizontal** — `rotateX` (current Flip is `rotateY`)
- [ ] **Spin** — `rotate() + scale() + opacity`
- [ ] **Blur dissolve** — `filter: blur()` ramping down + opacity
- [ ] **Soft / gradient wipe** — `mask-image: linear-gradient()` (feathered edge)
- [ ] **Shape wipes** — diamond / star / plus via `clip-path: polygon()`
- [ ] **Blinds / bars** — `mask: repeating-linear-gradient()`
- [ ] **Flash** — `filter: brightness()` spike + opacity (flash to white/black)

---

## Phase 3 — Tier 2 (requires animating the OUTGOING clip)

- [ ] **Planner upgrade** — extend `planVideoTransitions()` to also emit a style
      for the held outgoing tail during the overlap window, and apply it in
      `StudioComposition`. *(One contained change — unlocks all items below.)*
- [ ] **Push** (outgoing slides off as incoming slides in) — directional
- [ ] **Cross-zoom** (outgoing zooms out while incoming zooms in)
- [ ] **Dip to color** (black / white / custom — fade out → solid → fade in;
      needs a color layer in the seam)
- [ ] **Cover vs. Reveal** variants
- [ ] **Rotate-push**

---

## Phase 4 — Tier 3 (extra layers / SVG filters)

- [ ] **Glitch / RGB split** — 2–3 offset, channel-tinted copies blended
- [ ] **Whip pan** — directional slide + heavy motion-blur approximation
- [ ] **Ripple / liquid / displacement** — SVG `feTurbulence` + `feDisplacementMap`
- [ ] **3D cube rotate** — both clips on faces of a rotating cube
- [ ] **Luma-matte wipe** — drive the mask from a grayscale gradient/video asset

---

## Phase 5 — Tier 4 (WebGL / assets)

- [ ] **gl-transitions integration** — WebGL canvas sampling both clips as
      textures (warp, crosshatch, doorway, morph, swirl, …)
- [ ] **Page curl / film burn / light leaks** — shader + texture assets
- [ ] **Particle / pixel dissolve** — shader-driven

---

## Phase 6 — Cross-cutting

- [ ] **Audio crossfade** at the seam — interpolate the clip's `<Audio volume>`
      over the overlap (clip audio currently hard-cuts)
- [ ] **Apply to other tracks** (image / text / TSX) — rendering generalizes;
      mostly UI plumbing to expose transitions beyond the Video track
- [ ] **Transition presets** — save a favourite type+duration+easing for one-click apply

---

## Progress

| Phase | Done / Total |
|---|---|
| 0 — Foundation | 7 / 7 ✅ |
| 1 — Infrastructure | 0 / 4 |
| 2 — Tier 1 | 0 / 12 |
| 3 — Tier 2 | 0 / 6 |
| 4 — Tier 3 | 0 / 5 |
| 5 — Tier 4 | 0 / 3 |
| 6 — Cross-cutting | 0 / 3 |

> Update this table as items land.

# ANIMATIONS_PLAN.md — Studio object animations roadmap

> **🚧 HIDDEN for this release (postponed).** The feature is code-complete
> (Phases 0–3, 5, and 4.1) but its two entry points are commented out so users
> can't reach it. To re-enable, uncomment **both**:
> 1. `{ id: 'animations', label: 'Animations' }` in `TABS` —
>    [`ControlPanel.tsx`](src/features/studio/components/ControlPanel.tsx)
> 2. `{ key: 'animations', label: 'Animations' }` in `PASTE_CATEGORY_META` —
>    [`types.ts`](src/features/studio/types.ts)
>
> Everything else (engine, hooks, timeline arrows, copy/apply, custom pose
> editor) stays wired — no other change needed to bring it back.


> Hand this file to Claude to implement items **one at a time**. Each task is
> self-contained. Tick the checkbox and flip the **Status** when done.
>
> **Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## What we're building (read first)

A **Camtasia-style animation system**: you drop an animation **arrow** (a span)
onto any visual object — **video, image, or text** — and over that span the
object **tweens** its visual state (scale / position / rotation / opacity). A
**preset library** fills in *what* the tween does; but preset or not, every
animation is the same underlying thing — a property tween across a draggable
span. There is **no separate "in/out" or "loop" concept**: a fade-in is just an
arrow near the start going opacity `0→1`; a fade-out is an arrow at the end going
`1→0`.

Like effects and transitions, both the live `<Player>` and the headless export
render through the **same**
[`StudioComposition`](src/features/studio/components/StudioComposition.tsx), so an
animation is defined once and works in preview **and** the final MP4.

### The arrow model (`from → to`)

Each arrow carries **both** endpoint states, expressed **relative to the
object's resting transform** (identity = the object as it sits with no
animation). The per-frame state of an object is a pure fold over its arrows,
sorted by start time:

- **Inside** an arrow `[start, end]` → `lerp(from, to, ease(progress))`
- **After** an arrow ends → hold its `to` (no snap-back)
- **Before** the first arrow → hold its `from` (so an entrance stays hidden/off
  until it plays)
- **No arrows / between arrows** → resting (identity)

Arrows on one clip are kept **non-overlapping** (the timeline enforces it), so
the fold is always unambiguous. This one rule expresses entrances, exits, and
held emphasis correctly. Every preset is just a `{ from, to }` pair.

### Anatomy of a preset (the cheap path)

Adding a new preset once Phase 0 + 1 exist touches exactly two spots:

1. **Catalog** — add an entry to `ANIMATION_PRESETS` in
   [`src/features/studio/services/animations.ts`](src/features/studio/services/animations.ts)
   with its `from`/`to` states (+ default duration, default placement, whether
   it's directional).
2. **(only if it needs a new property)** — extend `StudioAnimationState` and the
   `resolveAnimationState()` → CSS mapping (same file). The four v1 properties
   (scale / offsetX / offsetY / rotation / opacity) already cover the starter set.

Type-check with `npx tsc -p tsconfig.web.check.json --noEmit` (filter to the
studio files — the tree has unrelated pre-existing errors).

### Data shapes

```ts
// state at one end of an arrow — all fields optional, relative to resting.
interface StudioAnimationState {
  scale?: number;     // 1 = resting
  offsetX?: number;   // composition px, relative to resting position
  offsetY?: number;
  rotation?: number;  // degrees, relative to resting rotation
  opacity?: number;   // 0..1
}

type StudioAnimationPreset =
  | 'fadeIn' | 'fadeOut' | 'popIn' | 'slideIn' | 'slideOut'
  | 'zoom' | 'spinIn' | 'tilt';

interface StudioClipAnimation {
  id: string;
  preset: StudioAnimationPreset;
  startSeconds: number;      // clip-relative arrow start
  durationSeconds: number;   // arrow length
  from: StudioAnimationState; // state at arrow start (preset fills this)
  to: StudioAnimationState;   // state at arrow end (preset fills this)
  direction?: 'up' | 'down' | 'left' | 'right'; // directional presets only
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

// add to StudioVideoClip, StudioImageClip, StudioTextClip:
//   animations?: StudioClipAnimation[];
```

Stored in **clip-relative seconds** (fps-safe, like effects/transitions). Rides
along in the existing project JSON — old projects load untouched (no migration).

### Key files

| Concern | File |
|---|---|
| Types | `src/shared/ipc/types/studio.ts` |
| Preset catalog + fold + easing + helpers | `src/features/studio/services/animations.ts` *(new)* |
| Rendering (`AnimationLayer`) | `src/features/studio/components/StudioComposition.tsx` |
| Tab UI | `src/features/studio/components/AnimationsTab.tsx` *(new)* |
| Tab registration + props | `src/features/studio/components/ControlPanel.tsx`, `StudioScreen.tsx` |
| Edit-time hooks | `src/features/studio/hooks/useStudioVideoClips.ts`, `useStudioImageClips.ts`, `useStudioTextClips.ts` |
| Export path | `src/features/studio/services/studio-render-input.ts`, `src/main/ipc/studio-render-handlers.ts` |
| Timeline arrow | `src/features/studio/components/TrackRow.tsx`, `StudioTimeline.tsx` |

---

## Phase 0 — Engine (no UI yet; verify via a hand-authored test arrow)

Goal: an animation in a clip's `animations[]` array plays correctly in preview
**and** export. No tab, no timeline UI — temporarily hard-code one arrow on a
clip to verify, then remove it.

- [x] **0.1 Types** — add `StudioAnimationState`, `StudioAnimationPreset`,
      `StudioClipAnimation` to
      [`studio.ts`](src/shared/ipc/types/studio.ts); add optional
      `animations?: StudioClipAnimation[]` to `StudioVideoClip`,
      `StudioImageClip`, `StudioTextClip`. Add a frame-based render mirror
      `StudioRenderClipAnimation` (`startFrames`/`durationFrames`) and an
      `animations?` field on `StudioRenderVideoClip`, `StudioRenderImageClip`,
      `StudioRenderTextClip`.
- [x] **0.2 Service** — create
      [`services/animations.ts`](src/features/studio/services/animations.ts)
      (pure, no React/IPC): `ANIMATION_PRESETS` catalog (the 8 starter presets
      below), `resolveAnimationState(animations, clipLocalFrame, fps)`
      implementing the `from→to` fold, easing functions, default duration +
      clamps, and immutable `addAnimation` / `updateAnimation` /
      `removeAnimation` helpers. Mirror the shape of
      [`effects.ts`](src/features/studio/services/effects.ts) /
      [`transitions.ts`](src/features/studio/services/transitions.ts).
- [x] **0.3 `AnimationLayer`** — add to
      [`StudioComposition.tsx`](src/features/studio/components/StudioComposition.tsx)
      a wrapper (sibling to `EffectsLayer`/`TransitionLayer`) that reads
      `useCurrentFrame()`, calls `resolveAnimationState`, and applies the
      resolved `transform` (translate + scale + rotate) and `opacity`. Skip it
      entirely when a clip has no animations (byte-identical output for existing
      projects). Mind the compose order: for video it wraps **outside**
      `EffectsLayer` so the whole effected clip animates as one unit.
- [x] **0.4 Wire into all three clip branches** — apply `AnimationLayer` inside
      `LayerBox` for the video, image, and text render branches; extend
      `VideoClipInput` / `ImageClipInput` / `TextClipInput` with
      `animations?: StudioRenderClipAnimation[]` (frame-based).
- [x] **0.5 Export thread-through** — in
      [`studio-render-input.ts`](src/features/studio/services/studio-render-input.ts)
      convert each clip's `animations` seconds→frames (at edit fps, so the
      existing fps-rescale path adjusts them) for video, image, and text clips.
- [x] **0.6 Preview thread-through** — in
      [`StudioScreen.tsx`](src/features/studio/components/StudioScreen.tsx) pass
      each clip's `animations` (seconds→frames at composition fps) into the
      `videoClips` / `imageClips` / `textClips` composition inputs.
- [x] **0.7 Verify** — fold logic unit-verified via a bundled harness (fade-in
      ramp + hold, slide pre/post hold, in+out gap-hold, resting fallback,
      `buildAnimation`/`animationsToFrames` round-trip) and type-checks clean
      across renderer + shared + main. Live `<Player>` / headless-export visual
      confirmation folds into Phase 1 (done via the real tab instead of throwaway
      hard-coded arrows).

**Starter presets** (defined in 0.2):

| Preset | from → to | default placement | directional |
|---|---|---|---|
| `fadeIn` | `{opacity:0}` → `{}` | clip start | — |
| `fadeOut` | `{}` → `{opacity:0}` | clip end | — |
| `popIn` | `{scale:0.4, opacity:0}` → `{}` | clip start | — |
| `slideIn` | `{offset:±d, opacity:0}` → `{}` | clip start | ✓ |
| `slideOut` | `{}` → `{offset:±d, opacity:0}` | clip end | ✓ |
| `zoom` | `{}` → `{scale:1.3}` | anywhere | — |
| `spinIn` | `{rotation:-180, opacity:0}` → `{}` | clip start | — |
| `tilt` | `{rotation:-8}` → `{}` | clip start | — |

> `±d` (slide distance) defaults to the object's box dimension (or a fraction of
> the composition size when the object is full-frame) in the chosen direction.

---

## Phase 1 — Animations tab (makes the engine usable)

Goal: pick a clip, click a preset → an arrow is added; see/edit the clip's
arrows. Placement via numeric sliders (the draggable timeline arrow is Phase 2).

- [x] **1.1 Hooks** — add `addAnimation(clipId, preset)` /
      `updateAnimation(clipId, animId, patch)` /
      `removeAnimation(clipId, animId)` to
      [`useStudioVideoClips.ts`](src/features/studio/hooks/useStudioVideoClips.ts),
      [`useStudioImageClips.ts`](src/features/studio/hooks/useStudioImageClips.ts),
      and [`useStudioTextClips.ts`](src/features/studio/hooks/useStudioTextClips.ts).
      `addAnimation` drops the preset's default arrow at the current playhead
      (clip-local), clamped non-overlapping inside the clip.
- [x] **1.2 `AnimationsTab.tsx`** — new component. Header shows the selected
      object's name; empty states mirror EffectsTab/TransitionsTab copy ("select
      a clip" / "add a clip"). A **preset grid** (one-click add). A **list of the
      clip's arrows**, each with: preset label, a Start slider + Duration slider
      (clip-relative seconds), a Direction toggle (only for directional presets),
      an Easing dropdown, and a remove button. "Clear all" when ≥1 arrow.
- [x] **1.3 Register the tab** — add `{ id: 'animations', label: 'Animations' }`
      to `TABS` in
      [`ControlPanel.tsx`](src/features/studio/components/ControlPanel.tsx)
      (beside Effects/Transitions) and thread an `animationsTab` prop through.
- [x] **1.4 Resolve the selected object** — in
      [`StudioScreen.tsx`](src/features/studio/components/StudioScreen.tsx) feed
      the tab the currently-selected video/image/text clip (whichever track) and
      the matching hook's add/update/remove callbacks. Animations apply to all
      three surfaces, so resolve by the selected clip's track type.

**End of Phase 1:** users can add presets to any video/image/text object and see
them play in preview and export. The full concept works minus the drag polish.

---

## Phase 2 — The arrow on the timeline (the Camtasia feel)

- [x] **2.1 Render arrows on the selected clip** — in
      [`TrackRow.tsx`](src/features/studio/components/TrackRow.tsx) draw each
      animation of the **selected** clip as a slanted band inside the clip body
      (`left%`/`width%` from `startSeconds`/`durationSeconds` over the clip's own
      duration), styled like the existing transition-wedge / pending-cut
      overlays. Show only on the selected clip to avoid clutter.
- [x] **2.2 Drag to move** — clip-local drag on an arrow body updates its
      `startSeconds` (clamped within the clip, non-overlapping with sibling
      arrows). Reuse the gesture pattern from `handleClipDragStart`.
- [x] **2.3 Trim the ends** — drag either end of an arrow to change
      `durationSeconds` (min duration; clamped). Reuse `handleClipTrimStart`.
- [x] **2.4 StudioTimeline plumbing** — pass the new arrow move/trim callbacks +
      selected-clip animation data from
      [`StudioScreen.tsx`](src/features/studio/components/StudioScreen.tsx)
      through `StudioTimeline.tsx` to `TrackRow`. Freeze the timeline scale
      during an arrow gesture (`onInteractStart`/`onInteractEnd`).
- [x] **2.5 Click-to-select an arrow** — clicking an arrow on the timeline sets
      `selectedAnimationId` (state in StudioScreen, reset when the primary clip
      changes), highlighting the band. Timeline→tab focus is wired via shared
      state; deeper tab auto-scroll-to-arrow can come later if needed.

---

## Phase 3 — Grow the preset library

Each is one `ANIMATION_PRESETS` entry (+ a new property only if needed). All
follow the same `from→to` arrow concept.

- [x] **3.1 Slide — 4 directions** — already shipped in v1: `slideIn`/`slideOut`
      carry the `direction` field, exposed as the tab's direction toggle.
- [x] **3.2 Fly / drift** — `fly` preset (slide, position-only, no fade).
- [x] **3.3 Bounce In** — `bounceIn` (`{scale:0.3,opacity:0}`→`{}`) with the new
      `easeOutBack` easing (overshoots then settles; verified scale peaks ~1.06).
- [x] **3.4 Zoom Out** — `zoomOut` (`{scale:1.4}`→`{}`, settles to resting).
- [x] **3.5 Spin Out** — `spinOut` (`{}`→`{rotation:180,opacity:0}`, at clip end).
- [x] **3.6 Pan** — `pan` (gentle directional drift, 0.3× box distance, emphasis).
- [x] **3.7 Pulse-ish** — shipped as `grow` ("grow & hold", `{}`→`{scale:1.1}`).
      True there-and-back still needs the Phase 4 multi-keyframe upgrade.

---

## Phase 4 — Custom & power-user (later; not v1)

- [x] **4.1 Custom end-state from canvas** (hybrid) — a `custom` preset (identity
      `from→to` until edited). The Animations tab shows **Set start / end pose**
      toggles + **Start/End opacity** sliders. In pose mode the `TransformOverlay`
      edits the arrow's *effective pose box* (`effectivePoseBox`, resting ⊕ state)
      with aspect locked; edits invert back into the relative state
      (`poseBoxToState`, exact round-trip, opacity carried over). Entering pose
      mode pauses + seeks the playhead to the arrow's edge frame so the canvas
      shows the pose; a banner + Done button exit. Works on video/image/text.
- [ ] **4.2 Drag-from-panel** — drag a preset thumbnail from the tab directly
      onto a clip on the timeline.
- [ ] **4.3 Animated preset thumbnails** — small looped previews in the tab
      (stack a card, loop the resolved state) — every preset gets one free.
- [ ] **4.4 Multi-keyframe arrows** — let one arrow hold >2 keyframes (unlocks
      true pulse / there-and-back). Generalizes the fold to a keyframe list.
- [ ] **4.5 Easing curve editor** — custom cubic-bezier per arrow.

---

## Phase 5 — Cross-cutting

- [x] **5.1 Paste-attributes category** — added `'animations'` to
      `PasteAttributeCategory` + `PASTE_CATEGORY_TARGETS` (video/image/text) +
      `PASTE_CATEGORY_META`; capture in `copyAttributes`, apply in
      `applyAttributes`, surface in `pasteCategoryOptions` (StudioScreen).
- [x] **5.2 Undo/redo** — verified: `StudioHistorySnapshot` holds the full clip
      arrays; arrow ops replace the array, so add/move/trim/remove are snapshotted
      and restored automatically. No change needed.
- [x] **5.3 Split behavior** — `cut-service.ts` now remaps arrows into each half
      on a split: shifted into the half's local time and clamped to it; arrows
      fully outside a half are dropped. Covers all three tracks in one place.
- [x] **5.4 Persistence round-trip** — verified: clips are JSON-serialized
      wholesale (`studio-projects-db.ts`), so `animations` rides along; pre-
      animation projects parse to `animations: undefined` (no motion). No
      migration needed.

---

## Progress

| Phase | Done / Total |
|---|---|
| 0 — Engine | 7 / 7 ✅ |
| 1 — Animations tab | 4 / 4 ✅ |
| 2 — Timeline arrow | 5 / 5 ✅ |
| 3 — Preset library | 7 / 7 ✅ |
| 4 — Custom / power-user | 1 / 5 (4.1 ✅) |
| 5 — Cross-cutting | 4 / 4 ✅ |

> Update this table as items land.

# VidTSX Whiteboard Studio — Implementation Plan

## How to use this document

This is a step-by-step build plan for the Whiteboard Studio module inside VidTSX.

**Rules for the implementer (Claude Code):**

1. Work through steps **in order**. Do not skip ahead.
2. Each step has a **Done when** clause. The step is not complete until that check passes.
3. When a step is done, change `[ ]` to `[x]` in this file. Commit the file change with the step's code.
4. If a step fails or reveals a wrong assumption, **stop and surface the problem** — do not invent workarounds.
5. File names, folder structure, type shapes, and code style are up to you. Follow VidTSX's existing conventions. This plan describes **what** to build, not how to organize it.
6. Phases 0–3 are detailed (path to MVP). Phases 4+ are outlines only — these will be refined before each one starts.

**MVP target:** one SVG drawing draws itself stroke by stroke with a pen follower, inside a working studio shell. No timeline UI, no asset library, no upload yet.

---

## What the studio needs to model

Before any code, agree on the conceptual data the studio operates on. Pick names and shapes that fit the codebase — but every component should read and write from the same model.

A **drawable asset** has an ordered list of SVG path strings (the draw order), a viewBox, a reveal mode (Draw / Wipe / Stamp — only Draw matters for MVP), and optional overrides for duration, stroke color, and stroke width.

A **hand config** has the inline SVG markup of the pen or hand graphic, a tip offset (where the actual tip is in the SVG's local coordinates), and an optional rotation.

A **scene** has a list of assets in draw order, a hand config, a background style (white / lined / grid / chalkboard — only white for MVP), and a draw speed in pixels per second along the path.

The **animator** exposes runtime state: elapsed time, a playing flag, total duration, the index of the path currently being drawn (or none), and the current pen position (or null).

These concepts are the contract between phases. Don't redesign them mid-build without surfacing the change.

---

## Phase 0 — Module scaffold

- [x] **0.1** Stand up an empty Whiteboard Studio module that can be imported and rendered somewhere in the app.
  *Done when:* a placeholder component renders without errors in your usual harness.

- [x] **0.2** Define the conceptual types described above.
  *Done when:* type-check passes.

- [x] **0.3** Add a basic two-pane layout to the root component: a sidebar around 280px wide and a main area that takes the remaining space. Use whatever styling approach VidTSX already uses.
  *Done when:* layout renders correctly.

---

## Phase 1 — Path animator engine

This is the core. Get this right and everything else slots in.

- [x] **1.1** Create thin wrappers around the native DOM path-measurement APIs (`getTotalLength`, `getPointAtLength`) so the rest of the engine doesn't touch the DOM directly.
  *Done when:* the helpers exist and are typed.

- [x] **1.2** Define the animator's public interface — what it takes in (path element refs, speed) and what it exposes (the runtime state plus play / pause / restart actions). Just the shape, no animation logic yet.
  *Done when:* the hook can be called from a component without throwing and returns the expected shape with stub values.

- [x] **1.3** Add path length measurement. When the input refs change, measure each path and store the lengths. Compute total duration from sum of lengths divided by pxPerSec.
  *Done when:* given a parent that mounts three paths, the animator returns a non-zero total duration.

- [x] **1.4** Add the requestAnimationFrame tick loop. While playing, increment elapsed by the actual frame delta. Cap at total duration. Pause when the cap is reached.
  *Done when:* elapsed advances over time, stops at total duration, can be paused.

- [x] **1.5** Add active-path resolution. Given the current elapsed time, determine which path is currently being drawn and how far along it.
  *Done when:* logging values during playback shows them advancing correctly across multiple paths in sequence.

- [x] **1.6** Apply the dashoffset reveal: paths fully drawn get offset 0, the active path gets offset equal to its remaining length, paths not yet started get offset equal to their full length. Set dasharray once at mount.
  *Done when:* with a test SVG, paths visually animate in sequence.

- [x] **1.7** Sample the active path at the active distance to get the current pen position. Expose it on the state.
  *Done when:* the position is non-null during playback and matches the visible drawing edge.

- [x] **1.8** Implement play, pause, and restart. Restart resets elapsed to zero and resumes playback.
  *Done when:* all three work when wired to buttons.

**Performance note for steps 1.6 and 1.7:** dashoffset and pen position update every frame. Write these directly via `setAttribute` on refs, **not** through React state. Re-rendering many paths per frame will jank the studio hard.

---

## Phase 2 — Hand follower

- [x] **2.1** Create a hand follower component that takes a position and a hand config. Renders nothing when position is null.
  *Done when:* component compiles and renders nothing for a null position.

- [x] **2.2** Render the hand's SVG markup inside an outer transform that places its tip exactly at the given position. The transform composition should be: translate to the target position, rotate, then translate by the negative tip offset — so the configured tip lands on the target point regardless of rotation.
  *Done when:* given a fixed position, the hand renders with its tip precisely there.

- [x] **2.3** Provide a default pen — a rotated pencil graphic with tip at origin and a small clockwise rotation (around 28°).
  *Done when:* importable, types valid.

---

## Phase 3 — Single asset rendering (MVP TARGET)

- [x] **3.1** Provide a hardcoded sample asset for testing — a simple house drawing (roof, walls, door, windows) with paths in natural human draw order. Use Draw reveal mode.
  *Done when:* importable, all paths present.

- [x] **3.2** Build the canvas component that ties everything together. It takes an asset and a hand, renders an SVG with the asset's viewBox, renders each path with stroke style (no fill) collecting refs, runs the animator on those refs, and renders the hand follower at the active position.
  *Done when:* given the sample house and default pen, the canvas mounts and renders the SVG.

- [x] **3.3** Wire the canvas into the studio shell's main area with the sample house and default pen hardcoded. Add Play, Pause, and Restart buttons in the sidebar.
  *Done when:* opening the Studio shows the house drawing itself stroke by stroke with the pen following along, and controls work.

- [x] **3.4** Add a speed slider (0.25x to 3x) and a status line showing current stroke and elapsed time. Speed multiplies the elapsed delta.
  *Done when:* slider changes drawing speed in real time, status updates each frame.

🎯 **MVP reached.** Stop. Ship internally and gather feedback. Do not start Phase 4 without checking in.

---

## Phase 4 — Multi-asset scenes

Until now the editor hardcodes a single asset (`SAMPLE_HOUSE`) and renders it directly. Phase 4 makes the canvas, animator, and persistence layer **scene-driven**: a scene is a list of assets, each placed in a shared coordinate system, drawn one after another, on top of a configurable background.

**Scope of this phase:**

- A scene-level coordinate system (so multiple assets can sit side by side instead of stacking at the origin).
- Per-asset placement (`x`, `y`, `scale`) — additive contract change, no breaking edits to the four core types beyond optional fields.
- Animator stays input-flat (one path list) but learns asset boundaries so callers can read `activeAssetIndex`.
- Background variants render: white, lined, grid, chalkboard. Chalkboard inverts the *default* asset stroke color where the asset hasn't overridden it; user-set per-asset stroke colors are respected as-is.
- Thumbnail covers all assets at their placements, on the chosen background.

**Out of scope (deferred to later phases):**

- Drag-to-position / drag-to-reorder UI for assets — Phase 5 (library) and Phase 7 (timeline) own that.
- An asset library or upload surface — Phase 5 / 6.
- Asset deletion UI — Phase 5.
- Custom backgrounds (image / color picker) — Phase 16.

The contract additions (placement, scene viewBox) are the only changes to the four core types in [src/shared/types/whiteboard.ts](src/shared/types/whiteboard.ts). Step 4.1 isolates them so the rest of the phase is mechanical.

- [x] **4.1** Extend the contract types. On `DrawableAsset`, add an optional `placement?: { x: number; y: number; scale: number }` (default treated as `{x:0, y:0, scale:1}` when absent). On `Scene`, add a required `viewBox: string` (the scene's coordinate system, e.g. `'0 0 1280 720'`). Update [src/features/whiteboard/services/whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts)'s `emptyScene()` to seed `viewBox: '0 0 1280 720'`. Older project rows lacking `viewBox` should be tolerated by reading-side code (treat missing `viewBox` as the same default).
  *Done when:* type-check passes; opening an existing project (created in Phase D) loads without errors and falls back to the default viewBox.

- [x] **4.2** Add a second sample asset to [src/features/whiteboard/services/sample-assets.ts](src/features/whiteboard/services/sample-assets.ts) — a simple tree (trunk + foliage outline) with paths in natural draw order, sized to a roughly 200×200 viewBox like the house. Export it as `SAMPLE_TREE`.
  *Done when:* importable; rendered standalone in a quick `<svg viewBox="0 0 200 200">` preview, the tree shape is recognizable.

- [x] **4.3** Update the seed scene in [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx) so a fresh project starts with both assets at distinct placements within the scene viewBox (e.g. house at `x:120, y:260, scale:1.6`, tree at `x:760, y:260, scale:1.6`). Also seed the scene's `viewBox`. The seeding `useEffect` should still only run when `assets.length === 0`.
  *Done when:* creating a new project shows two assets at different positions on the canvas.

- [x] **4.4** Refactor [WhiteboardCanvas.tsx](src/features/whiteboard/components/WhiteboardCanvas.tsx) to take a `scene: Scene` prop instead of `asset: DrawableAsset`. Render the outer `<svg>` with the scene's `viewBox`. For each asset, render a `<g transform="translate(x y) scale(s)">` containing its paths. Collect path refs into the **flat** `pathsRef` array in scene-order (asset 0's paths first, then asset 1's, etc.) so the animator's interface is unchanged. Per-asset stroke style still resolves from the asset's own `strokeColor` / `strokeWidth` overrides, falling back to a scene default.
  *Done when:* given a scene with two assets, both render at their placements; the path refs land in `pathsRef` in scene-order; type-check passes.

- [x] **4.5** Extend [usePathAnimator.ts](src/features/whiteboard/hooks/usePathAnimator.ts) to accept an optional `assetBoundaries?: number[]` (cumulative path counts per asset, e.g. `[3, 7]` means asset 0 owns paths 0–2 and asset 1 owns paths 3–6) and expose `activeAssetIndex: number | null` on its returned state. Internal logic only needs to derive the asset index from the existing `activePathIndex` via the boundaries — no change to the dashoffset / pen sampling math. Update `AnimatorState` in [src/features/whiteboard/types.ts](src/features/whiteboard/types.ts).
  *Done when:* during playback `activeAssetIndex` advances `0 → 1` exactly when `activePathIndex` crosses the boundary; null when nothing is active.

- [x] **4.6** Wire [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx) to drive everything off `project.scene`. Compute `flatPaths` and `assetBoundaries` from `scene.assets` with a `useMemo`. Pass the scene to `<WhiteboardCanvas>` and the flat paths + boundaries to `usePathAnimator`. Remove the `SAMPLE_HOUSE` import from this file (it stays exported from `sample-assets.ts` for the seed scene). Update the status line to read `Asset {n}/{total} · Stroke {k}/{m}` where `m` is the active asset's stroke count.
  *Done when:* the editor renders whatever is in `project.scene`; play/pause/restart drives the multi-asset sequence end to end without jumps; status line updates per frame.

- [x] **4.7** Add a `<SceneBackground>` component (inside [WhiteboardCanvas.tsx](src/features/whiteboard/components/WhiteboardCanvas.tsx) or a sibling file in `components/`) that renders a `<rect>` covering the scene viewBox plus, for `lined` / `grid`, faint `<line>` elements (~24px spacing, stroke `#e5e7eb`, width 1). For `chalkboard`, fill is `#1f2937`. Render it as the first child of the SVG so assets sit on top.
  *Done when:* changing `scene.background` between `white` / `lined` / `grid` / `chalkboard` visibly changes the canvas.

- [x] **4.8** For `chalkboard`, swap the **default** asset stroke from dark to chalk-white (`#f9fafb`). Implementation: `WhiteboardCanvas` selects a default stroke based on `scene.background`; per-asset `strokeColor` overrides still win. Don't mutate the assets — derive the stroke at render time.
  *Done when:* on a chalkboard background, an asset without a `strokeColor` override draws in white; an asset that explicitly sets `strokeColor` (e.g. red) draws in red regardless of background.

- [x] **4.9** Add a background picker to the controls pane in [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx). Four small swatches (white / lined / grid / chalkboard) above the speed slider, with the active one highlighted. Clicking a swatch calls `onUpdateScene({ ...scene, background })`. Style: square 28×28 swatches, `border: 0.5px solid var(--color-border)`, active swatch uses `accent` border color.
  *Done when:* clicking each swatch updates the canvas immediately and the choice persists after closing and reopening the project.

- [x] **4.10** Update [scene-thumbnail.ts](src/features/whiteboard/services/scene-thumbnail.ts) to render the *whole* scene: build an SVG with the scene's viewBox, include the background (rect / lines), then one `<g transform="translate(x y) scale(s)">` per asset containing its paths with the right resolved stroke color. Empty scene (zero assets) still returns `''`.
  *Done when:* a project with the seeded house+tree shows both in its library card thumbnail; switching to a chalkboard background updates the thumbnail accordingly on the next save tick.

- [x] **4.11** Phase 4 verification:
  1. Open a fresh project → editor seeds house + tree at different placements; both visible.
  2. Press Play → house draws fully, then tree begins; pen jumps to the tree's first path-start at the boundary; status line transitions from `Asset 1/2` to `Asset 2/2`.
  3. Restart → both assets reset to hidden; the sequence replays end to end.
  4. Switch background to `lined` → faint horizontal lines appear behind the assets; switch to `chalkboard` → background turns dark and assets render in white.
  5. Close the project, return to library → card thumbnail shows both assets on the chosen background. Reopen → background and scene persist.
  6. `npm run type-check` and `npm run lint` both pass.
  *Done when:* all six pass without console errors.

🎯 **Phase 4 done.** Stop. Do not start Phase 5 without checking in. Phase 5 introduces the SVG library UI and depends on the placement / scene-viewBox contract this phase establishes.

---

## Phase 5 — SVG library UI

Phase 4 made scenes truly multi-asset, but the only way to populate a scene is the hardcoded house+tree seed. Phase 5 lets users **browse and add** assets from a curated catalog and **remove** placed assets when they want to start over. Phase D's integration plan (step C.4) deferred the right-side pane to this phase — that pane gets built here.

**Scope of this phase:**

- A bundled catalog of ~15 hand-authored assets (4–5 categories: shapes, nature, objects, arrows, people).
- A new right-side library pane in the editor, collapsible like the controls pane on the left.
- Static SVG previews on each library card (no animation).
- Search + category filter.
- Click-to-add: dropping a library asset places a *unique scene-instance copy* at the scene viewBox's center.
- A "Scene contents" inventory list in the same pane, with a delete affordance per placed asset.

**Out of scope (deferred):**

- Drag-to-position / drag-to-reorder — Phase 7 (timeline).
- Per-asset stroke colour pickers — Phase 7 (inspector).
- Custom SVG upload + vectorization — Phase 6.
- AI auto-order across newly-added assets — Phase 20.

**Contract additions:** a new `LibraryAsset` type (extends `DrawableAsset` with `name` and `category`) lives in [src/features/whiteboard/types.ts](src/features/whiteboard/types.ts). Scene assets get a unique runtime `id` (e.g. `lib-circle:abc123`) so canvas keys stay stable when other assets are added or removed.

- [x] **5.1** Add the `LibraryAsset` type and an `AssetCategory` union (`'shapes' | 'nature' | 'objects' | 'arrows' | 'people'`) to [src/features/whiteboard/types.ts](src/features/whiteboard/types.ts). `LibraryAsset` = `DrawableAsset & { name: string; category: AssetCategory }`. Re-export from the barrel if needed.
  *Done when:* type-check passes; `LibraryAsset` importable from `@features/whiteboard`.

- [x] **5.2** Build the asset catalog. Create [src/features/whiteboard/services/asset-catalog.ts](src/features/whiteboard/services/asset-catalog.ts) exporting `LIBRARY_ASSETS: LibraryAsset[]` with ~15 entries spread across the five categories: shapes (circle, square, triangle, star), nature (tree, sun, cloud, mountain), objects (house, lightbulb, book), arrows (right, down), people (stick figure, head). Each asset uses viewBox `0 0 200 200`, has paths in natural human draw order, and omits `strokeColor` so the scene default applies. Move `SAMPLE_HOUSE` and `SAMPLE_TREE` here too, renamed into the catalog (with `name`/`category`), and update [sample-assets.ts](src/features/whiteboard/services/sample-assets.ts) to re-export them as named library entries (or update [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx)'s seed import to point at the catalog directly).
  *Done when:* catalog has ≥ 15 entries; type-check passes; each asset renders cleanly when previewed in a `<svg viewBox="0 0 200 200">` test.

- [x] **5.3** Create [src/features/whiteboard/components/AssetPreview.tsx](src/features/whiteboard/components/AssetPreview.tsx) — a small component that renders a static stroke-only SVG preview of any `DrawableAsset`. Props: `asset: DrawableAsset`, `size?: number` (default 64), optional `stroke?: string`. No animation; just `<path>` per entry with `fill="none" stroke strokeWidth strokeLinecap="round"`.
  *Done when:* given any catalog asset, the preview renders a recognisable shape at any size.

- [x] **5.4** Helper for adding a library asset to a scene. Add `addLibraryAssetToScene(scene, libraryAsset): Scene` to [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts). Default placement = centred in the scene viewBox at `scale: 1.5` (asset's local 200 × 1.5 = 300 footprint). Scene-instance `id` = `${libraryAsset.id}:${crypto.randomUUID().slice(0, 8)}`. Returns the new `Scene` with the asset appended. Add a sibling `removeAssetAt(scene, index): Scene`.
  *Done when:* called with the seed scene + a `circle` library asset, returns a scene with three assets, the new one centred and uniquely id'd.

- [x] **5.5** Stable canvas keys. Update [WhiteboardCanvas.tsx](src/features/whiteboard/components/WhiteboardCanvas.tsx) so each `<g>` and its child `<path>`s key off `asset.id` (the unique scene-instance id), not the asset index. This stops React from re-mounting trailing paths when the user deletes an earlier asset, which would otherwise cause a one-frame dasharray flicker. Path keys: `${asset.id}-${pathLocalIndex}`.
  *Done when:* deleting any asset from the scene leaves remaining assets' DOM untouched; the dasharray reveal state on the surviving paths persists.

- [x] **5.6** Create [src/features/whiteboard/components/WhiteboardLibraryPanel.tsx](src/features/whiteboard/components/WhiteboardLibraryPanel.tsx). Layout (top to bottom): a 36px header with the title "Library" and a collapse button (mirroring the controls pane); a search input; a horizontal row of category chips ("All" + the five categories); a scrollable 2-column grid of asset cards (preview thumbnail + name + click → `onAdd(libraryAsset)`); a divider; a "Scene contents" section listing current scene assets (small preview + name + delete `<button>`). Filter: case-insensitive substring on `name` ∧ category match.
  *Done when:* given the catalog + scene + onAdd/onRemove callbacks, renders the grid; search and category chips filter live; click adds; inventory delete fires the callback.

- [x] **5.7** Wire the library pane into [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx). Add a third (rightmost) pane: ~300px default width, collapsible to 24px (mirror the left controls pane's collapse pattern + drag handle on its **left** edge). Pass `LIBRARY_ASSETS`, `project.scene.assets`, and `onAdd` / `onRemove` handlers (which call `onUpdateScene` with the helpers from 5.4). Layout becomes three panes: controls | canvas | library.
  *Done when:* the editor shows three panes; library can be collapsed/expanded and resized; clicking an asset adds to canvas; deleting an inventory item removes from canvas; controls pane and canvas continue to behave as before.

- [x] **5.8** Phase 5 verification:
  1. Open a project → right-side library pane visible with the catalog grid; left controls pane unchanged.
  2. Type "tree" in search → grid filters to one matching card; clear → all return.
  3. Click the "shapes" chip → grid filters to four shape entries; click "All" → restored.
  4. Click any asset card → asset appears centred on the canvas; press Play → existing assets draw, then the newly-added one draws last.
  5. Open the "Scene contents" list → click delete on the original house → house disappears from canvas; remaining tree's drawing state is unaffected when you press Restart.
  6. Collapse the library pane → canvas expands; expand again → library returns. Resize via drag handle works.
  7. Close the project, reopen → catalog is unchanged but scene contents (newly added / deleted) persist.
  8. `npx tsc -p tsconfig.web.json --noEmit` reports no whiteboard-related errors.
  *Done when:* all eight pass without console errors.

🎯 **Phase 5 done.** Stop. Do not start Phase 6 (static preview toggle) without checking in.

---

## Phase 6 — Static preview toggle

After adding an asset from the library, today users have to press Play to see it — there's no way to view the finished result without animating. Phase 6 adds a "Show All" toggle that reveals every path instantly, no animation, so users can compose scenes visually before deciding when to play.

**Scope of this phase:**

- A `previewMode` toggle in the controls pane.
- When ON: every path's `stroke-dashoffset` is forced to `0` (fully revealed); the animator is paused; the hand follower is hidden (`penPosition = null`).
- When OFF: the animator resets to t=0 (paths hidden), ready for play. Same effective state as fresh project load.
- Pressing **Play** while preview is ON automatically turns preview OFF and starts the animation from the beginning.
- Adding a new asset from the library while preview is ON — the new asset reveals immediately, no playback needed.

**Out of scope:**

- A scrubber / timeline (Phase 14 timeline UI).
- Per-asset preview overrides.
- Persisting preview mode across project sessions (it's a local UI affordance, not a scene property).

**Contract additions:** none. The animator gets a new `reset()` action (sibling to `restart()`) that hides paths without auto-playing — a pure ergonomic addition to `PathAnimator`, no type changes to `AnimatorState`.

- [x] **6.1** Add `reset()` to [usePathAnimator.ts](src/features/whiteboard/hooks/usePathAnimator.ts). Behaviour: pause; cancel any pending RAF; set `elapsedRef.current = 0`; loop pathsRef and set every dashoffset to its full length (the "hidden" state); clear snapshot to `{ elapsed: 0, playing: false, activePathIndex: null, activeAssetIndex: null, penPosition: null }`. Crucially: does NOT call `play()` afterwards (this is what differentiates `reset` from `restart`).
  *Done when:* calling `animator.reset()` mid-playback freezes paths to fully-hidden, leaves `playing: false`, and the animator stays idle until the caller invokes `play()`.

- [x] **6.2** Add `previewMode` state to [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx). When the toggle flips:
  - **ON**: call `animator.pause()`, then loop through `pathsRef.current` and `setAttribute('stroke-dashoffset', '0')` on every non-null element. Use a `useEffect` keyed on `[previewMode, project.scene.assets]` so adding/removing assets while preview is on re-applies the override to the new path elements after they mount.
  - **OFF**: call `animator.reset()` so paths return to hidden.
  *Done when:* toggling ON reveals all paths instantly; toggling OFF hides them; adding an asset while preview is ON immediately shows the new asset fully drawn.

- [x] **6.3** Add a "Show All" toggle button to the controls pane in [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx). Place it on the same row as the Restart button, or as a separate small section above the Background picker — your call. Active state uses the accent fill (matching how the active background swatch is styled). Icon: lucide-react `Eye` when on, `EyeOff` when off (or vice-versa, pick whichever feels more intuitive after a quick test).
  *Done when:* the button reflects state visually and clicking it flips `previewMode`.

- [x] **6.4** Auto-disable preview when the user presses **Play**. In `togglePlay`, before calling `animator.play()`, if `previewMode` is true, set it to false (which calls `animator.reset()` via the effect from 6.2), then call `animator.play()` on the next tick (use a `setTimeout(..., 0)` or wait for the next render). Restart should also turn preview off if active.
  *Done when:* with preview ON, clicking Play flips the toggle off, paths reset to hidden, then the animation starts from the beginning of the scene.

- [x] **6.5** Phase 6 verification:
  1. Add house+tree (seeded) → both hidden initially. Click "Show All" → both reveal instantly with no hand follower.
  2. From the library, click "Circle" while preview is ON → circle appears immediately at scene centre, fully drawn, no animation.
  3. Press Play → toggle flips off, paths reset to hidden, the full sequence (house → tree → circle) plays from the start.
  4. Click "Show All" again, then click Restart → toggle flips off, paths reset, animation starts.
  5. `npx tsc -p tsconfig.web.json --noEmit` reports no whiteboard-related errors.
  *Done when:* all five pass without console errors.

🎯 **Phase 6 done.** Stop. Do not start Phase 7 (selection + drag + inspector) without checking in. Phase 7 is bigger than Phases 4–6 combined and warrants a checkpoint.

---

## Phase 7 — Selection, drag-to-reposition, inspector

Phase 5 lets users add and remove assets but they land at a fixed default position. Phase 7 makes the canvas interactive: click an asset to select it, drag to reposition, and adjust per-asset properties (scale, stroke colour, stroke width) in a side-pane inspector. This is the missing direct-manipulation layer.

**Scope of this phase:**

- Single-asset selection via canvas click. Click empty canvas to deselect.
- A visible selection outline (dashed accent-colour rect over the asset's local viewBox).
- Drag-to-reposition: mousedown on a selected asset starts dragging; mousemove updates `placement.x` / `placement.y` in scene coordinates; mouseup commits.
- An **Inspector panel** that swaps in for the Library panel when something is selected. The pane header switches between "Library" / "Inspector".
- Inspector controls: read-only name, x / y number inputs, scale slider, stroke colour picker (HTML `<input type="color">`), stroke width slider, and a Delete button.
- Keyboard: **Delete** / **Backspace** removes the selected asset (when the focus isn't in a text input). **Escape** deselects.

**Out of scope (deferred):**

- Rotation handle / per-asset rotation. (Pen position math and bbox math get complicated; not worth it yet.)
- Multi-select, group operations, or marquee select.
- Snap-to-grid / alignment guides.
- Per-asset draw duration override or per-asset reveal mode (both depend on the timeline UI in Phase 14).
- Drag-to-reorder draw sequence. Reorder still belongs to the timeline.
- Live "magnet" snapping to other assets.

**Contract additions:**

- A renderer-side `Selection` type (`{ assetIndex: number } | null`) lives in [src/features/whiteboard/types.ts](src/features/whiteboard/types.ts). It's UI state, never persisted; not part of the scene contract.
- A `updateAssetAt(scene, index, patch): Scene` helper in [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts) — mirror of `removeAssetAt` for editing.

- [x] **7.1** Add the `Selection` type to [src/features/whiteboard/types.ts](src/features/whiteboard/types.ts) and the `updateAssetAt(scene, index, patch: Partial<DrawableAsset>): Scene` helper to [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts). The helper does a shallow merge of the patch onto the asset at `index` (so partial updates like `{ placement: { x, y, scale } }` work). Out-of-range index returns the scene unchanged.
  *Done when:* type-check passes; given a sample scene, calling `updateAssetAt(scene, 0, { strokeColor: '#ff0000' })` returns a new scene with asset 0's colour changed and other assets untouched.

- [x] **7.2** Selection state in [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx). Add `const [selection, setSelection] = useState<Selection>(null)`. Define `handleSelect(index: number | null)` and pass it down to the canvas. When the active scene's assets change (e.g. one is deleted), clamp the selection: if `selection.assetIndex >= scene.assets.length`, clear it.
  *Done when:* selection state exists; deleting the selected asset auto-clears the selection.

- [x] **7.3** Make assets clickable on the canvas. In [WhiteboardCanvas.tsx](src/features/whiteboard/components/WhiteboardCanvas.tsx), add a transparent click-target rect inside each asset's `<g>` (sized to the asset's local viewBox, `fill="none" pointerEvents="all"`). Add an `onClick` to each `<g>` that calls `onSelect(assetIdx)`. Click on the SVG root background (the SceneBackground rect or the SVG itself) calls `onSelect(null)`. Stop propagation on the asset's click handler so canvas-background click and asset click don't collide.
  *Done when:* clicking any asset on the canvas selects it; clicking blank space deselects.

- [x] **7.4** Render a selection outline. When `selection !== null` and the matching `<g>` is being rendered, append a `<rect>` over the asset's local bbox with `fill="none" stroke=accent strokeWidth=2 strokeDasharray="6 3" pointerEvents="none"`. Place it after the paths so it draws on top. Width and height come from `parseAssetViewBox(asset.viewBox)`.
  *Done when:* the selected asset shows a clearly visible accent-coloured dashed outline that follows the asset's placement transform.

- [x] **7.5** Drag-to-reposition. In [WhiteboardCanvas.tsx](src/features/whiteboard/components/WhiteboardCanvas.tsx), capture the SVG element via a ref. On mousedown on the selected asset's click target, start a drag: convert mouse screen coords to scene coords using `svg.getScreenCTM().inverse()` and the SVG's `createSVGPoint`. Track the initial `(scenePtX, scenePtY)` and the asset's initial `placement.x / .y`. On mousemove (while drag is active) compute scene-coord delta and call `onMove(index, newX, newY)`. On mouseup, end drag. The editor's `onMove` callback calls `onUpdateScene(updateAssetAt(scene, index, { placement: { ...prev, x, y } }))`.
  *Done when:* selecting then dragging an asset moves it live across the canvas, position persists, and the auto-save fires shortly after release.

- [x] **7.6** Create [src/features/whiteboard/components/AssetInspectorPanel.tsx](src/features/whiteboard/components/AssetInspectorPanel.tsx). Props: `asset: DrawableAsset`, `onUpdate(patch: Partial<DrawableAsset>): void`, `onDelete(): void`, `onClose(): void` (deselects). UI sections:
  - **Header** mirroring the Library panel (36px, title "Inspector" + collapse/back chevron that calls `onClose`).
  - **Position** — two number inputs labelled "X" / "Y" bound to `asset.placement?.x / .y` (default 0 if missing).
  - **Scale** — range slider 0.1 → 4 step 0.05 + numeric readout, bound to `asset.placement?.scale ?? 1`.
  - **Stroke colour** — `<input type="color">` + a hex text input, bound to `asset.strokeColor` (default `#1a1a1a`). A "Reset" link clears the override (returns to scene default).
  - **Stroke width** — range slider 0.5 → 8 step 0.5 + numeric readout, bound to `asset.strokeWidth ?? 2`.
  - **Delete** — bottom of pane, accent-red button.
  All edits feed through `onUpdate(patch)` with a partial. Position/scale wrap into the `placement` shape correctly (preserve other axes when only one changes).
  *Done when:* the panel renders the asset's current values; editing each field invokes `onUpdate` with a correctly-shaped patch.

- [x] **7.7** Swap the right pane based on selection. In [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx), when `selection !== null`, render `<AssetInspectorPanel>` in place of `<WhiteboardLibraryPanel>`. The pane's collapse / resize behaviour stays identical. The `onClose` prop on the inspector calls `setSelection(null)` (which falls back to the library view). Wire `onUpdate` to call `updateAssetAt(...)` and `onDelete` to call `removeAssetAt(...)` then `setSelection(null)`.
  *Done when:* selecting any asset swaps the right pane to the Inspector with that asset's data; deselecting / closing returns the Library; resizing and collapsing both views work identically.

- [x] **7.8** Keyboard shortcuts. Attach a `keydown` listener to the editor root (or `window`) that:
  - On `Delete` / `Backspace`: if a selection is active and the active element isn't an `<input>` / `<textarea>`, call the delete handler.
  - On `Escape`: clear selection.
  Clean up the listener on unmount.
  *Done when:* with an asset selected and focus outside any text input, pressing Delete removes it; pressing Escape deselects.

- [x] **7.9** Phase 7 verification:
  1. Open a project → click the seeded house → dashed accent outline appears around it; right pane swaps from Library to Inspector with the house's name + values.
  2. Drag the house — it follows the cursor in scene coordinates, releasing commits the new position. Move it to the bottom-right; it stays there after switching to the library and back via Escape.
  3. In the Inspector, change Scale to 2.5 → house grows in place. Change Stroke colour to red → house renders red. Change Stroke width to 5 → strokes thicken.
  4. Select the tree, press **Delete** → tree disappears, Inspector closes, Library returns. Press **Escape** while nothing is selected → no-op.
  5. With preview mode (Phase 6) ON, select an asset → outline still visible; drag still works; after drop the path stays revealed.
  6. Close the project, reopen → the moved/styled house and the missing tree all persist as expected.
  7. `npx tsc -p tsconfig.web.json --noEmit` reports no whiteboard-related errors.
  *Done when:* all seven pass without console errors.

🎯 **Phase 7 done.** Stop. Do not start Phase 8 (aspect ratio) without checking in.

---

## Phase 8 — Aspect ratio presets

Today every project is hardcoded to a `0 0 1280 720` (16:9) viewBox, and the canvas wrapper in [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx) is `aspect-square` — so even 16:9 content letterboxes inside a 1:1 box. Phase 8 lets users pick the project's aspect ratio so they can author landscape (16:9), portrait (9:16, for short-form vertical video), or square (1:1, for social posts) content.

**Scope of this phase:**

- Three preset aspect ratios: `landscape` (1280 × 720), `portrait` (720 × 1280), `square` (1080 × 1080).
- A picker in the controls pane (next to the Background picker) that swaps the scene's `viewBox`.
- Canvas wrapper adapts its aspect to the scene's ratio without letterboxing.
- Persists as part of the existing `Scene.viewBox` contract — no new contract fields.

**Out of scope (deferred):**

- Custom width/height entry. (Easy to add later if users ask.)
- Auto-recentre / auto-scale of existing asset placements when the aspect changes — placements are kept as-is in scene units; assets that fall off-canvas after a switch can be dragged back via the inspector. Auto-recentre would be a quality-of-life addition but isn't load-bearing.
- Different thumbnail dimensions per aspect — library card thumbnails stay 320 × 180 with `xMidYMid meet`, so portrait scenes letterbox inside the card. Acceptable for MVP; a richer "card respects scene aspect" treatment can come with a future library polish pass.

**Contract additions:** none. `Scene.viewBox` already accepts arbitrary rectangles. We add an `ASPECT_PRESETS` constant + a tiny helper to map a viewBox back to a preset id (or `'custom'`).

- [x] **8.1** Add aspect presets + helper. In [src/features/whiteboard/services/whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts) (or a sibling `aspect-presets.ts` if it gets too crowded), export `ASPECT_PRESETS: ReadonlyArray<{ id: 'landscape' | 'portrait' | 'square'; label: string; viewBox: string; width: number; height: number }>` with the three values and a `getAspectId(viewBox: string): AspectId | 'custom'` helper that string-compares against the presets. Update `DEFAULT_SCENE_VIEWBOX` to be `ASPECT_PRESETS[0].viewBox` so the constant stays a single source of truth.
  *Done when:* `getAspectId(ASPECT_PRESETS[1].viewBox) === 'portrait'`; `getAspectId('0 0 100 50') === 'custom'`; type-check passes.

- [x] **8.2** Aspect-aware canvas wrapper. In [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx), the canvas pane currently wraps the SVG in `<div className="w-full h-full max-w-[800px] max-h-[800px] aspect-square">`. Replace with a wrapper that derives the ratio from `project.scene.viewBox`. Use inline `style={{ aspectRatio: '${w} / ${h}' }}` (parsed from viewBox) so the box adapts to portrait / square / landscape correctly, plus `max-w` / `max-h` caps so the canvas doesn't overflow the pane. Centre with the existing flex container.
  *Done when:* switching viewBox between the three presets visibly changes the canvas's outer aspect — landscape fills width, portrait fills height, square is a square — with no letterbox bands inside the SVG.

- [x] **8.3** Aspect picker UI. In the controls pane in [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx), add a new "Aspect" section above the Background picker (or below it — whichever reads better in a quick sanity check). Three small buttons matching the existing Background swatch style: a wide rectangle for landscape, a tall rectangle for portrait, a square for square. Active button uses the accent border. Click handler computes the new viewBox from the preset and calls `onUpdateScene({ ...scene, viewBox: preset.viewBox })`. Use `getAspectId(scene.viewBox)` to determine which button is active (defaults to "landscape" for legacy / custom values).
  *Done when:* the picker reflects the current viewBox; clicking a preset updates the scene immediately; choice persists across project reload.

- [x] **8.4** Phase 8 verification:
  1. Open an existing project (16:9 seed). Aspect picker shows landscape highlighted; canvas fills the pane in 16:9 with no letterbox.
  2. Click portrait → canvas re-shapes to a tall column; the seeded house and tree stay at their absolute scene-coord positions (the tree may now be off the right edge of the new viewBox — that's expected; user can drag it back).
  3. Click square → canvas re-shapes to a square; visually plausible.
  4. Drag an asset back into the new viewBox → position persists.
  5. Close + reopen → aspect persists.
  6. `npx tsc -p tsconfig.web.json --noEmit` reports no whiteboard-related errors.
  *Done when:* all six pass without console errors.

🎯 **Phase 8 done.** Stop. Do not start Phase 9 (user SVG library) without checking in.

---

## Phase 9 — User SVG library (upload + dedicated tab)

The built-in catalog (Phase 5) covers ~15 hand-authored shapes, but real whiteboard videos need user content — logos, custom illustrations, icon-pack imports. Phase 9 adds an **upload pipeline** plus a dedicated **"My SVGs"** tab in the right pane so user content lives separately from the built-in library and stays user-discoverable. The same storage will later host AI-generated SVGs (future phase, same table, different `source` value).

**Scope of this phase:**

- **"My SVGs" tab** in the right pane, alongside the existing "Library" tab. Each tab has its own content; the **Scene contents** inventory at the bottom is shared.
- **Upload pipeline**: a file-picker entry point, native `DOMParser` to read the file, and a normalizer that flattens transforms, converts `<rect>` / `<circle>` / `<ellipse>` / `<line>` / `<polyline>` / `<polygon>` to `<path>`, strips fills / gradients / filters / embedded `<image>` tags, sequences paths by DOM order.
- **SQLite persistence** for user SVGs — table `user_svgs` (id, name, paths JSON, viewBox, source, created_at). Lives at `userData/whiteboard-svgs/svgs.db`. Mirrors the existing `whiteboard-projects-db.ts` / `whiteboard-projects-migrate.ts` pattern.
- **IPC** for list / save / delete; channels and handlers wired through the existing whiteboard handler module.
- Adding a user SVG to the current scene reuses `addLibraryAssetToScene` — they share the `LibraryAsset` shape.
- A `source: 'upload' | 'ai-generated'` field on each user SVG is **persisted now** so the future AI-generation phase can land into the same table without a migration.

**Out of scope (deferred):**

- **AI generation** itself — its own future phase. Will reuse this storage with `source: 'ai-generated'`.
- **Editing** an uploaded SVG after the fact. For now the workflow is delete + re-upload.
- **Bulk upload** / drag-multiple-files. One file at a time.
- **Categories / search** within "My SVGs" — flat list sorted by recency. Search/categorisation can come if libraries grow large.
- **Cloud sync** / sharing user SVGs across machines. Local-only.
- **Raster files in the same upload** — JPEG / PNG go through Phase 10 (static image) and Phase 12 (vectorization) pipelines.

**Contract additions:**

- New `UserSvgAsset` interface in [src/features/whiteboard/types.ts](src/features/whiteboard/types.ts) extending `LibraryAsset` with `source: 'upload' | 'ai-generated'` and `createdAt: number`. (`LibraryAsset` is the right base because user SVGs render through the same pipeline as catalog assets.)
- New IPC channels: `WHITEBOARD_USER_SVG_LIST`, `WHITEBOARD_USER_SVG_SAVE`, `WHITEBOARD_USER_SVG_DELETE`.
- New SQLite database file. Older project rows in `whiteboard-projects.db` are unaffected.

- [x] **9.1** Add the `UserSvgAsset` type and IPC types. In [src/features/whiteboard/types.ts](src/features/whiteboard/types.ts), define `UserSvgAsset` extending `LibraryAsset` with `source: UserSvgSource` (the new union type) and `createdAt: number`. In [src/shared/ipc/types.ts](src/shared/ipc/types.ts), define the four request/response shapes for list/save/delete. In [src/shared/ipc/channels.ts](src/shared/ipc/channels.ts), add `WHITEBOARD_USER_SVG_LIST`, `WHITEBOARD_USER_SVG_SAVE`, `WHITEBOARD_USER_SVG_DELETE`.
  *Done when:* type-check passes; the new types are importable from `@features/whiteboard` and `@shared/ipc/types`.

- [x] **9.2** SVG parser + normalizer. Create [src/features/whiteboard/services/svg-parser.ts](src/features/whiteboard/services/svg-parser.ts) exporting:
  - `parseSvgFile(file: File): Promise<{ paths: string[]; viewBox: string }>`
  - `normalizeSvgElement(svg: SVGSVGElement): { paths: string[]; viewBox: string }`
  Behaviour: flatten nested `<g transform>` by composing matrices down to leaves; convert primitive elements (`rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`) to equivalent `path` `d` strings; drop `<defs>`, `<filter>`, `<image>`, `<text>`; strip every `fill`/`gradient` attribute (Phase 13 adds fills back as a deliberate feature); ignore CSS-only styles for MVP. Sequence paths by document order. Default viewBox from the SVG element; if missing, fall back to `0 0 ${width} ${height}` from intrinsic dimensions; final fallback `'0 0 200 200'`.
  *Done when:* given a typical icon SVG (e.g. a Heroicons or Tabler export), the function returns a non-empty paths array and a sensible viewBox; type-check passes.

- [x] **9.3** Main-process storage. Create [src/main/services/whiteboard-svgs-db.ts](src/main/services/whiteboard-svgs-db.ts) — SQLite at `userData/whiteboard-svgs/svgs.db`, single table `user_svgs (id TEXT PRIMARY KEY, name TEXT NOT NULL, paths_json TEXT NOT NULL, viewbox TEXT NOT NULL, source TEXT NOT NULL, created_at INTEGER NOT NULL)`. WAL journal mode. CRUD: `listUserSvgs`, `saveUserSvg`, `deleteUserSvg`. Mirror [whiteboard-projects-db.ts](src/main/services/whiteboard-projects-db.ts) shape. Also create [whiteboard-svgs-migrate.ts](src/main/services/whiteboard-svgs-migrate.ts) (no-op stub matching the existing migrate pattern). Wire `migrateWhiteboardSvgs()` in [src/main/index.ts](src/main/index.ts) next to `migrateWhiteboardProjects()`.
  *Done when:* a script can save a row, list it back, and delete it; the directory + db file appear in `userData` after first launch.

- [x] **9.4** IPC handlers. Add three handlers to [src/main/ipc/whiteboard-handlers.ts](src/main/ipc/whiteboard-handlers.ts), each wrapping the DB call in try/catch and returning `{ success, error?, ... }`. Register them in [src/main/ipc/register.ts](src/main/ipc/register.ts). Expose them in the preload bridge so the renderer calls them as `window.api.whiteboardUserSvgList()` / `Save({ asset })` / `Delete({ id })`.
  *Done when:* `window.api` has the three new methods at runtime; renderer calls round-trip without "no handler" errors.

- [x] **9.5** Renderer service + hook. Create [src/features/whiteboard/services/user-svgs-service.ts](src/features/whiteboard/services/user-svgs-service.ts) — thin IPC wrappers (`fetchUserSvgs`, `saveUserSvg`, `deleteUserSvg`) plus `generateUserSvgId()`. Create [src/features/whiteboard/hooks/useUserSvgs.ts](src/features/whiteboard/hooks/useUserSvgs.ts) — loads the list on mount, exposes `userSvgs`, `addFromFile(file)`, `remove(id)`, `refresh()`. `addFromFile` runs the parser, builds a `UserSvgAsset` (`id`, derived `name` from filename minus extension, `source: 'upload'`, `createdAt: Date.now()`), saves through IPC, and refreshes the list.
  *Done when:* hook returns the expected shape; uploading a sample SVG via `addFromFile` round-trips through the DB and the new entry appears in `userSvgs`.

- [x] **9.6** Tab system in the library panel. Refactor [WhiteboardLibraryPanel.tsx](src/features/whiteboard/components/WhiteboardLibraryPanel.tsx): add a 32px tab strip at the top with two pills (`"Library"` / `"My SVGs"`), active pill uses the accent style. Local state for `activeTab`. The existing search + category chips + asset grid stay under the **Library** tab. Under **My SVGs**, render an upload-and-grid layout (built in 9.7). The "Scene contents" section at the bottom of the panel stays visible regardless of the active tab.
  *Done when:* clicking the tabs swaps the upper panel content; the bottom inventory is unaffected; the active tab persists for the lifetime of the editor mount.

- [x] **9.7** "My SVGs" tab content. Build the renderer for the My SVGs tab: a sticky **Upload SVG** button at the top (file picker that accepts only `.svg`), an empty-state message ("No SVGs yet — upload your first") when there are zero entries, and otherwise a 2-column grid of cards. Each card mirrors the Library card shape: `<AssetPreview>` thumbnail + name + click-to-add. Hover affords a small delete button at the top-right of the card. Delete confirms inline (or via the existing toast pattern if it's already in the editor). Sort by `createdAt` desc.
  *Done when:* the tab renders empty → after upload it renders the grid → click adds the SVG to the scene → hover-delete removes it.

- [x] **9.8** Wire upload + add + delete handlers in [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx). Pass `useUserSvgs()` results down to the panel. The "add to scene" handler reuses `addLibraryAssetToScene(scene, userSvg)` since `UserSvgAsset extends LibraryAsset`. The delete handler calls the hook's `remove(id)`.
  *Done when:* full upload → add-to-canvas → delete-from-tab loop works end to end.

- [x] **9.9** Phase 9 verification:
  1. Launch fresh → "My SVGs" tab shows the empty state. Library tab is unchanged from Phase 5.
  2. Click **Upload SVG**, pick a real-world SVG (e.g. a Heroicons file). Card appears in the grid with a recognisable preview.
  3. Click the new card → asset appears centred on the canvas → press Play → it draws stroke-by-stroke alongside the seeded house and tree.
  4. Switch to the Library tab → the built-in catalog still works as before.
  5. Hover the user SVG card → click delete → confirms → the card disappears. The asset that was already added to the scene remains (deleting from the library doesn't retroactively edit scenes).
  6. Restart the app → My SVGs persists across launches.
  7. Upload an SVG with `<rect>` and `<circle>` primitives + a `<g transform="translate(10 20)">` group → the normalizer flattens correctly and all shapes draw at the right positions.
  8. `npx tsc -p tsconfig.web.json --noEmit` reports no whiteboard-related errors.
  *Done when:* all eight pass without console errors.

🎯 **Phase 9 done.** Stop. Do not start Phase 10 (static image asset + non-draw reveals) without checking in.

---

## Phase 10 — Static image assets + non-draw reveal modes

The whiteboard so far only handles SVG paths animated stroke-by-stroke. Real whiteboard videos often need a raster image to land "as-is" — a logo, a screenshot, a photograph — without a drawing animation. Phase 10 introduces a second asset kind (`ImageAsset`) and three non-path reveal modes (`wipe`, `stamp`, `fade`) so users can mix raster content into a scene and pick how each piece appears.

**Scope of this phase:**

- A discriminated union `Asset = DrawableAsset | ImageAsset` carrying a `kind` field; `Scene.assets` becomes `Asset[]`. Existing rows missing `kind` are read as `'drawable'` (no migration needed).
- A new `ImageAsset` shape with `src`, intrinsic `width/height`, `revealMode`, optional `duration` and `opacity`.
- Three non-path reveal modes implemented for raster assets: **wipe** (clip-path slide left-to-right), **stamp** (instant + brief scale-pop), **fade** (opacity ease). The fourth mode `draw` keeps applying to drawable assets only.
- Animator switches from path-count-based asset boundaries to **time-based asset segments**: each asset contributes a `[startMs, endMs]` slot in the unified timeline. Drawable segment length = `pathLength / pxPerSec`; image segment length = `asset.duration ?? DEFAULT_REVEAL_DURATION[mode]`.
- Image upload pipeline: file picker → main-process copy into `userData/whiteboard-images/files/{id}.{ext}` → SQLite row in a new `user_images` table.
- A custom Electron protocol `vidtsx-image://{id}` so the renderer references images by id without absolute file paths or base64 bloat.
- A new "My Images" tab in the right-side library pane mirroring "My SVGs"; clicking a card adds an `ImageAsset` to the scene at scene-centre.
- Inspector swaps to image-specific controls when an image asset is selected: reveal-mode picker (wipe/stamp/fade), opacity slider, replace-image button.

**Out of scope (deferred):**

- Vectorization of raster images — Phase 12.
- Animated GIFs / videos — static frames only.
- Per-asset rotation, non-uniform scale, cropping, filters.
- Custom wipe direction (right-to-left, top-down). MVP is left-to-right; the inspector can grow a direction picker later.
- Reveal modes for drawable assets beyond `draw` (a "wipe" applied to a drawable would skip the pen-follower draw effect — easy to add later, not on the immediate user path).
- Cloud sync of user images.

**Contract additions:**

- `kind: 'drawable' | 'image'` discriminant on every asset. `DrawableAsset` gains `kind: 'drawable'` (optional in storage; materialised to `'drawable'` on read so legacy rows still work).
- New `ImageAsset` interface in [src/shared/types/whiteboard.ts](src/shared/types/whiteboard.ts).
- `RevealMode` union grows to include `'fade'` (already has `'draw' | 'wipe' | 'stamp'`).
- New IPC channels: `WHITEBOARD_USER_IMAGE_LIST`, `_UPLOAD`, `_DELETE` plus a custom protocol registration for `vidtsx-image://`.
- New SQLite database file `userData/whiteboard-images/images.db` with table `user_images`. The `user_svgs` table is unchanged.
- `usePathAnimator`'s `assetBoundaries: number[]` (cumulative path counts) is replaced with `assetSegments: AssetSegment[]` (cumulative time offsets + per-segment metadata). This is a contract change inside the renderer, but no DB change.

- [x] **10.1** Asset-kind discriminant + `ImageAsset` type. In [src/shared/types/whiteboard.ts](src/shared/types/whiteboard.ts), add an optional `kind?: 'drawable'` to `DrawableAsset` and extend `RevealMode` with `'fade'`. Define `ImageAsset { kind: 'image'; id: string; name?: string; src: string; width: number; height: number; revealMode: RevealMode; duration?: number; opacity?: number; placement?: AssetPlacement }`. Export `Asset = DrawableAsset | ImageAsset` and update `Scene.assets` to `Asset[]`. Add type guards `isDrawableAsset(a)` / `isImageAsset(a)`. Update [whiteboard-projects-db.ts](src/main/services/whiteboard-projects-db.ts)'s row→object normaliser to default missing `kind` to `'drawable'` per asset.
  *Done when:* type-check passes; an existing project (Phase 9 era) loads with assets typed as drawable; new image assets compile end-to-end through the canvas signature.

- [x] **10.2** Asset-duration helper + animator segment math. Add `getAssetDuration(asset, scene): number` (ms) in [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts). Drawable assets: sum of path-element lengths (sampled via `getTotalLength`) / `scene.pxPerSec` × 1000. Image assets: `asset.duration ?? DEFAULT_REVEAL_DURATION_MS[asset.revealMode]` (e.g. wipe = 800ms, stamp = 400ms, fade = 500ms). Replace `assetBoundaries: number[]` in [usePathAnimator.ts](src/features/whiteboard/hooks/usePathAnimator.ts) with `assetSegments: { startMs: number; endMs: number; kind: 'drawable' | 'image'; pathStart: number; pathCount: number }[]`. Total duration = sum of all segments. `activeAssetIndex` derives from `elapsed` against `assetSegments`; `activePathIndex` only advances inside drawable segments. Pen position is `null` during image segments.
  *Done when:* a scene with one drawable + one image plays both segments in order, `activeAssetIndex` advances at the segment boundary, pen-follower hides during the image segment.

- [x] **10.3** `<ImageReveal>` component. Create [src/features/whiteboard/components/ImageReveal.tsx](src/features/whiteboard/components/ImageReveal.tsx). Props: `asset: ImageAsset; progress: number /* 0..1 within segment */; visible: boolean`. Renders an SVG `<image>` element at the asset's placement and intrinsic size. Reveal modes:
  - **wipe**: a `<clipPath>` rect that grows from `width=0` to full width via the progress value (left-to-right).
  - **stamp**: opacity binary (0 until `progress > 0.05`, then 1) with a spring-like scale tween `0.7 → 1.05 → 1.0` driven by an easing curve (e.g. cubic-out for the overshoot phase, then settle).
  - **fade**: opacity = ease(progress) (smoothstep).
  Hidden assets (`visible === false`) render with `display: none` so they don't intercept clicks and don't ghost in the export. Update progress via `setAttribute` on a ref (matches the per-frame DOM-only update convention from `usePathAnimator`).
  *Done when:* given a fixed image and a manual progress slider, each reveal mode visibly renders its transition; switching modes updates correctly without remount flicker.

- [x] **10.4** Canvas polymorphic rendering. Update [WhiteboardCanvas.tsx](src/features/whiteboard/components/WhiteboardCanvas.tsx) to dispatch on `asset.kind`. Drawable assets keep the existing `<g>` + `<path>` pipeline. Image assets render via `<ImageReveal>`. The flat `pathsRef` only collects drawable paths (image segments contribute zero refs; `pathStart` / `pathCount` in `assetSegments` carry that mapping). Click-to-select wraps both kinds; selection outline reads the local bbox from either `viewBox` (drawable) or `width/height` (image).
  *Done when:* a scene mixing drawable and image assets renders both, click-select works on both, the selection outline lands on the right bbox for each.

- [x] **10.5** Main-process image storage. Create [src/main/services/whiteboard-images-db.ts](src/main/services/whiteboard-images-db.ts): SQLite at `userData/whiteboard-images/images.db`, table `user_images (id TEXT PRIMARY KEY, name TEXT NOT NULL, file_path TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, source TEXT NOT NULL, created_at INTEGER NOT NULL)`. CRUD plus `saveBinary(id, ext, buffer)` that writes the file under `userData/whiteboard-images/files/`. Mirror [whiteboard-svgs-db.ts](src/main/services/whiteboard-svgs-db.ts). Add [whiteboard-images-migrate.ts](src/main/services/whiteboard-images-migrate.ts) and wire `migrateWhiteboardImages()` in [src/main/index.ts](src/main/index.ts) next to `migrateWhiteboardSvgs()`.
  *Done when:* a small repl script can save a binary, list it back with `file_path` pointing at a real on-disk file, delete it (file + row), and the directory + db file appear in `userData` after first launch.

- [x] **10.6** IPC handlers + custom protocol. Add channels `WHITEBOARD_USER_IMAGE_LIST`, `_UPLOAD` (binary buffer + filename), `_DELETE`. Add request/response types in [src/shared/ipc/types.ts](src/shared/ipc/types.ts). Implement handlers in a new [src/main/ipc/whiteboard-images-handlers.ts](src/main/ipc/whiteboard-images-handlers.ts) (or extend [whiteboard-handlers.ts](src/main/ipc/whiteboard-handlers.ts)) and register in [register.ts](src/main/ipc/register.ts). Register a custom `vidtsx-image://` protocol in [src/main/index.ts](src/main/index.ts) that resolves `vidtsx-image://{id}` to the matching row's `file_path` (validate that the resolved path is inside the controlled `whiteboard-images/files/` directory before serving — defence against path traversal). Expose the three methods on the preload bridge as `window.api.whiteboardUserImage{List,Upload,Delete}()`.
  *Done when:* the renderer can upload a PNG and immediately render it via `<img src="vidtsx-image://{id}">`; both the DB row and the file persist across app restarts; the protocol refuses to serve files outside the controlled directory.

- [x] **10.7** Renderer service + hook. Create [src/features/whiteboard/services/user-images-service.ts](src/features/whiteboard/services/user-images-service.ts) and [src/features/whiteboard/hooks/useUserImages.ts](src/features/whiteboard/hooks/useUserImages.ts) mirroring the user-SVGs pair. `addFromFile(file)` reads the file's intrinsic `width`/`height` (off-screen `<img>` decode), reads the file as a binary buffer, uploads via IPC, returns the persisted row ready to drop into the scene as an `ImageAsset` with `src: vidtsx-image://{id}`.
  *Done when:* the hook round-trips a PNG / JPG / WebP upload through the DB; `userImages` reflects the new entry with correct width/height.

- [x] **10.8** "My Images" tab. Add a third pill (`"My Images"`) to the library-panel tab strip in [WhiteboardLibraryPanel.tsx](src/features/whiteboard/components/WhiteboardLibraryPanel.tsx). Tab content mirrors "My SVGs": sticky **Upload Image** button (file picker `accept="image/png,image/jpeg,image/webp"`), empty state, 2-col card grid sorted by `createdAt` desc, hover-delete with `window.confirm`. Click-to-add creates an `ImageAsset` (with `revealMode: 'fade'` as the default and `placement` centred in the scene viewBox) via a new `addImageAssetToScene(scene, userImage)` helper in [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts). Wire `useUserImages()` in [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx).
  *Done when:* uploading an image surfaces a card; clicking the card drops a fade-revealing image asset into the canvas; Play replays the whole scene with the image fading in at its segment boundary.

- [x] **10.9** Inspector animation picker. Update [AssetInspectorPanel.tsx](src/features/whiteboard/components/AssetInspectorPanel.tsx) to dispatch on `selectedAsset.kind`:
  - **Both kinds:** position (X/Y), scale, delete.
  - **Drawable:** existing stroke colour + stroke width.
  - **Image:** opacity slider (0–1), replace-image button (file picker that re-uploads and updates `src` + intrinsic dimensions), and an **Animation** section with three radio-style buttons `wipe / stamp / fade`. Selecting a mode writes to `asset.revealMode`. Show a small text hint with the default duration ("≈ 800ms"). An optional duration override input is fine but not required.
  *Done when:* selecting an image asset shows the image-only controls; swapping reveal modes mid-edit re-plays the scene with the new mode; replace-image keeps the same id but swaps the file underneath.

- [x] **10.10** Phase 10 verification.
  1. Open an existing project → assets still draw as before; `kind` defaulting to `'drawable'` is invisible to the user.
  2. Open the new "My Images" tab → empty state. Upload a PNG → card appears with the right thumbnail + filename.
  3. Click the card → image lands centred on the canvas with `revealMode: 'fade'`. Press Play → seeded house+tree draw, then the image fades in.
  4. Select the image, switch reveal to `wipe` → Play replays with a left-to-right wipe at the same segment boundary.
  5. Switch to `stamp` → image scale-pops in.
  6. Drag the image; resize via the scale slider; lower opacity to 0.5 → all changes persist after closing and reopening the project.
  7. Replace the image via the inspector's replace button → new file shows up immediately without recreating the asset id.
  8. Mix order: drawable → image → drawable. Play. Pen follower hides during the image segment, reappears on the second drawable.
  9. Restart the app → image persists; reopen project → the image renders on first paint (no flash, no broken `vidtsx-image://` request).
  10. Delete the image asset from the scene → playback skips that slot. Delete the same image from "My Images" → already-placed scene copies remain (no retroactive edit), matching the SVG behaviour.
  11. `npx tsc -p tsconfig.web.json --noEmit` reports no whiteboard-related errors.
  *Done when:* all eleven pass without console errors.

🎯 **Phase 10 done.** Stop. Do not start Phase 11 (text & handwriting + RTL) without checking in. Phase 11 introduces a third asset kind, so the discriminated-union foundation Phase 10 establishes is load-bearing.

---

## Phase 11 — Text assets (type / wipe / stamp / fade)

Phase 10 turned `Asset` into a discriminated union (`DrawableAsset | ImageAsset` keyed on `kind`) and rebuilt the animator around time-based `assetSegments` so non-path reveal modes (`wipe` / `stamp` / `fade`) co-exist with `draw`. The kind-discriminant + the `AssetSpec` union in [usePathAnimator.ts](src/features/whiteboard/hooks/usePathAnimator.ts) are the load-bearing seams Phase 11 plugs into.

Phase 11 introduces the third asset kind: **`TextAsset`** — typography-on-the-canvas with three reveal modes that already exist (`wipe` / `stamp` / `fade`) plus a new text-specific reveal mode `type` (typewriter character-by-character, implemented via a clip-path mask, not per-frame string mutation). Multi-language is handled by SVG `<text>` natively — Arabic with `direction="rtl"` and an Arabic-supporting system font shapes positional joining without glyph-level work.

**Scope of this phase:**

- A new `TextAsset` (`kind: 'text'`) joining `Asset = DrawableAsset | ImageAsset | TextAsset`.
- A new `'type'` value on the `RevealMode` union (text-only).
- Plain SVG `<text>` rendering — no glyph extraction, no font bundling, no opentype.js.
- An "Add Text" button in the controls pane that drops a fresh text asset at scene-centre and selects it for immediate editing.
- `<TextReveal>` component supporting `type / wipe / stamp / fade` modes via clip-path masks and opacity, mirroring `<ImageReveal>`'s ref-handle progress contract.
- Inspector grows a third dispatch branch with eight flat sections: text content, font, size + weight, alignment, direction, color, animation, opacity.
- Animator's `AssetSpec` and `AssetSegment.kind` extend to include `'text'`; `imageHandlesRef` unifies into `assetHandlesRef` so image and text segments share a single per-frame progress writer.
- Library card thumbnails render text content via `<text>` so users can recognise text-heavy scenes from the project list.

**Out of scope (deferred to Phase 11.b — handwritten draw):**

- The `'draw'` reveal mode for text (opentype.js → `usePathAnimator`).
- Bundled handwriting fonts (Caveat, Patrick Hand, Aref Ruqaa, Reem Kufi) under `resources/fonts/`.
- A `vidtsx-font://` custom protocol for serving bundled fonts to the renderer.
- Bidi-aware glyph walker for Arabic handwriting (logical-order iteration, visual-order positioning).
- A `'whiteboard-text-handwritten'` feature flag gating 11.b work.

**Out of scope (deferred to later phases):**

- "My Text" SQLite tab / saved text snippets — text is fully scene-bound.
- Per-character animation curves, gradient fills, text-on-path, multi-line auto-wrap (single-line `\n`-separated rendering only).
- Text-specific stroke (outline) styling — fill colour only.

**Contract additions:**

In [src/shared/types/whiteboard.ts](src/shared/types/whiteboard.ts):

- `RevealMode` extends to `'draw' | 'wipe' | 'stamp' | 'fade' | 'type'`.
- New unions: `TextAlignment = 'left' | 'center' | 'right'`, `TextDirection = 'auto' | 'ltr' | 'rtl'`.
- New `TextAsset { kind: 'text'; id; text; fontFamily; fontSize; fontWeight; alignment; direction; color; revealMode: 'wipe' | 'stamp' | 'fade' | 'type'; duration?; opacity?; placement? }`.
- `Asset = DrawableAsset | ImageAsset | TextAsset`.
- New type guard `isTextAsset(asset): asset is TextAsset`.

In [usePathAnimator.ts](src/features/whiteboard/hooks/usePathAnimator.ts):

- `AssetSpec` extends with `{ kind: 'text'; durationMs: number }`.
- `AssetSegment.kind` extends to `'drawable' | 'image' | 'text'`.
- `imageHandlesRef` (parameter + internal ref) renames to `assetHandlesRef`; both `<ImageReveal>` and `<TextReveal>` expose `{ setProgress(p: number): void }`.

In [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts):

- `DEFAULT_REVEAL_DURATION_MS` gains `type: 1200`.
- New helpers `getTextAssetDurationMs(asset)` and `addTextAssetToScene(scene, opts?)`.
- `updateAssetAt`'s patch type extends to `Partial<DrawableAsset> | Partial<ImageAsset> | Partial<TextAsset>`.

No SQLite, IPC, preload, or custom-protocol changes. `Scene.assets` already serializes text JSON transparently.

- [x] **11.1** Type contract. In [src/shared/types/whiteboard.ts](src/shared/types/whiteboard.ts) add `'type'` to `RevealMode`, define `TextAlignment`, `TextDirection`, and `TextAsset` (`kind: 'text'`, plus `text` / `fontFamily` / `fontSize` / `fontWeight` / `alignment` / `direction` / `color` / `revealMode` / `duration?` / `opacity?` / `placement?`), extend `Asset`, and add `isTextAsset` guard. Re-export `TextAsset` / `TextAlignment` / `TextDirection` / `isTextAsset` from [src/features/whiteboard/types.ts](src/features/whiteboard/types.ts) and the [feature barrel](src/features/whiteboard/index.ts). Verify [whiteboard-projects-db.ts](src/main/services/whiteboard-projects-db.ts)'s row→object normaliser passes unknown `kind` values through untouched (it should — Phase 10 only defaults missing `kind` to `'drawable'`).
  *Done when:* `npx tsc -p tsconfig.web.json --noEmit` reports no whiteboard-related errors; importing `TextAsset` from `@features/whiteboard` resolves; opening an existing project loads without error.

- [x] **11.2** Service helpers. In [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts):
  - Add `'type': 1200` to `DEFAULT_REVEAL_DURATION_MS`.
  - Add `getTextAssetDurationMs(asset)`: returns `asset.duration` if set; else for `'type'` mode returns `Math.max(400, charCount * 50)` so longer strings type for longer; else `DEFAULT_REVEAL_DURATION_MS[asset.revealMode]`.
  - Add `addTextAssetToScene(scene, opts?)`: builds a `TextAsset` with sensible defaults (`text: 'Text'`, `fontFamily: 'Inter, system-ui, sans-serif'`, `fontSize: 48`, `fontWeight: 500`, `alignment: 'left'`, `direction: 'auto'`, `color: '#1a1a1a'`, `revealMode: 'fade'`, `opacity: 1`), centres it at scene-centre using estimated bbox `width = text.length * fontSize * 0.6, height = fontSize * 1.2`, and appends with `${id}:${uuid8}` instance id.
  - Extend `updateAssetAt`'s `patch` parameter to also accept `Partial<TextAsset>`.
  *Done when:* `addTextAssetToScene(emptyScene())` returns a scene with one centred text asset; `updateAssetAt(scene, 0, { text: 'foo' })` returns a scene with the new text content.

- [x] **11.3** Animator: `text` segment kind. In [usePathAnimator.ts](src/features/whiteboard/hooks/usePathAnimator.ts):
  - Extend `AssetSpec` with `{ kind: 'text'; durationMs: number }` and `AssetSegment.kind` to include `'text'`.
  - In `computeSegments`, the `text` branch is identical to the `image` branch: allocate `durationMs / 1000` seconds, `pathCount: 0`, leave `pathCursor` unchanged.
  - Rename `imageHandlesRef` (parameter + internal ref) to `assetHandlesRef`. Each entry is `{ setProgress(p: number): void } | null`. The existing per-frame writer (`writeImageProgress` → rename to `writeAssetProgress`) iterates segments and calls `setProgress` on every non-drawable segment's handle. `<ImageReveal>` keeps its current handle; `<TextReveal>` (next step) implements the same shape.
  - `activeAssetIndex` derivation: no change.
  *Done when:* a test scene `[drawable, text, drawable]` plays in order; `activeAssetIndex` advances 0 → 1 → 2 at correct time boundaries; the pen-follower hides during the text segment.

- [x] **11.4** `<TextReveal>` component. Create [src/features/whiteboard/components/TextReveal.tsx](src/features/whiteboard/components/TextReveal.tsx) mirroring [ImageReveal.tsx](src/features/whiteboard/components/ImageReveal.tsx):
  - `forwardRef` exposing `{ setProgress(p: number): void }`.
  - Props: `asset: TextAsset; visible: boolean; staticReveal: boolean`.
  - Renders an SVG `<text>` with `font-family`, `font-size`, `font-weight`, `fill={asset.color}`, `direction={asset.direction === 'auto' ? undefined : asset.direction}`, `text-anchor` derived from alignment (`left → start`, `center → middle`, `right → end`), `dominant-baseline="hanging"`. Multi-line via `<tspan x="0" dy="...">` per `\n`-split line.
  - Bbox: measure once on mount via `getBBox()` after first paint; cache in state. Re-measure when `text`, `fontFamily`, `fontSize`, or `fontWeight` change.
  - Reveal modes (`setAttribute` on refs, no React rerenders):
    - **`fade`**: opacity = smoothstep(progress).
    - **`wipe`**: a `<clipPath>` rect width grows `0 → measuredBbox.w` (LTR left-to-right; RTL right-to-left, computed by inverting the rect's `x` origin).
    - **`stamp`**: opacity binary (`0` until progress > 0.05) + scale-pop `0.7 → 1.05 → 1.0` cubic — mirror `<ImageReveal>`'s implementation exactly.
    - **`type`**: a `<clipPath>` rect width = `measuredBbox.w * Math.ceil(progress * text.length) / text.length` (LTR; RTL clips from the right). Renders the full `<text>` once and only the clip rect re-attributes per frame.
  - `staticReveal === true` → force `progress = 1`. `visible === false` → `display: none`.
  *Done when:* with a manual progress slider, each of the four modes visibly transitions on "Hello World"; switching modes mid-edit doesn't remount the SVG element; RTL Arabic text wipes from the right edge.

- [x] **11.5** Canvas dispatch. In [WhiteboardCanvas.tsx](src/features/whiteboard/components/WhiteboardCanvas.tsx):
  - Convert the `if (isDrawableAsset) { ... } return <imageBranch>` pattern into an explicit 3-way dispatch with a TypeScript exhaustiveness check (`const _exhaustive: never = asset` in the fallthrough).
  - Text branch: `<g transform={transform}>` with the same `onMouseDown` selection/drag handler; a transparent click-target `<rect>` sized to the measured bbox; `<TextReveal>` storing its handle in `assetHandlesRef.current[assetIdx]`; the dashed selection outline rect using the same measured bbox. The bbox flows up via an `onMeasure(bbox)` callback prop on `<TextReveal>` so the canvas can size the click-target + selection outline.
  - Skip text in the `pathCursor` increment loop (text contributes no paths). Maintain the existing pattern of clearing stale handle slots after asset deletes.
  - `imageHandlesRef` is renamed `assetHandlesRef` everywhere it appears.
  *Done when:* a scene with drawable + image + text renders all three at correct placements; clicking each selects it; selection outline lands on the right bbox per kind; the type-checker proves all three kinds are handled.

- [x] **11.6** `WhiteboardEditor` wiring + Add Text button. In [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx):
  - Update the `flatPaths / assetSpecs / assetPathStarts` memo to handle `isTextAsset`: text contributes no paths, pushes `{ kind: 'text', durationMs: getTextAssetDurationMs(asset) }` to `specs`, leaves `cursor` unchanged.
  - Rename `imageHandlesRef` → `assetHandlesRef` to match the hook signature.
  - Add an "Add Text" button to the controls pane, placed below the Show All / Restart row and above the Aspect picker. Use the lucide-react `Type` icon. Click handler appends a text asset via `addTextAssetToScene` and stashes the new index in a `pendingSelectIndexRef` (mirroring the `pendingActionRef` pattern at the preview-mode effect). A second `useEffect` watches `assets.length` and drains `pendingSelectIndexRef` to call `setSelection({ assetIndex })` once the scene update commits — this ensures the inspector opens on the new asset without racing the React update.
  *Done when:* clicking "Add Text" inserts a centred text at scene-centre, immediately opens the Inspector with text-specific controls, and pressing Play replays the scene with the new text appearing in its segment slot.

- [x] **11.7** Inspector text controls. In [AssetInspectorPanel.tsx](src/features/whiteboard/components/AssetInspectorPanel.tsx):
  - Convert the existing 2-way ternary into a 3-way chain dispatching to `renderTextControls` when `isTextAsset(asset)`.
  - Add a parallel `TEXT_REVEAL_OPTIONS = ['type', 'wipe', 'stamp', 'fade'] as const` constant beside `IMAGE_REVEAL_OPTIONS`.
  - Implement `renderTextControls(asset, onUpdate)` with eight flat sections matching the existing `gap-4` / `text-[11px] uppercase tracking-wider` label style:
    1. **Text** — `<textarea>` (3 rows default, auto-grow up to 6 rows on line count), wires `onUpdate({ text })`. Newlines preserved.
    2. **Font** — `<select>` with `'Inter, system-ui, sans-serif'`, `'Georgia, serif'`, `'Courier New, monospace'`, `'Arial, sans-serif'`, `'Times New Roman, serif'`, `'system-ui, sans-serif'`. (Phase 11.b adds the bundled handwriting fonts.)
    3. **Size + Weight** — two-column row: number input for size (8..200, step 1) + `<select>` for weight (100, 300, 400, 500, 600, 700, 900).
    4. **Alignment** — three-button radio (`grid grid-cols-3`, `bg-accent` on active) with lucide `AlignLeft / AlignCenter / AlignRight` icons.
    5. **Direction** — three-button radio: `Auto / LTR / RTL`. Auto omits the `direction` attribute on the SVG `<text>`.
    6. **Color** — `<input type="color">` + hex text input + Reset link, mirroring the Drawable stroke-colour section.
    7. **Animation** — four-button radio: `Type / Wipe / Stamp / Fade`. Below it, a "≈ {ms}ms" duration hint computed via `getTextAssetDurationMs(asset)`.
    8. **Opacity** — range slider 0..1, mirrors the image opacity section.
  *Done when:* selecting a text asset shows all eight sections; editing each field produces a correctly-shaped `Partial<TextAsset>` patch; switching reveal mode mid-edit re-plays the scene with the new mode; pressing Restart with `direction: 'rtl'` and Arabic text writes right-to-left.

- [x] **11.8** Scene thumbnail. In [scene-thumbnail.ts](src/features/whiteboard/services/scene-thumbnail.ts), extend the renderer to output `<text>` for `TextAsset` (full `<tspan>` multi-line, fully visible — no reveal animation). Verify the existing first-asset fallback handles text without crashing.
  *Done when:* a project with a text asset shows readable text in its library card thumbnail; mixed-kind scenes show all three kinds in the thumbnail.

- [x] **11.9** Preview mode + auto-save. Verify both transparently:
  - Preview mode effect: when ON, in addition to forcing `dashoffset = 0` on every drawable path, call `setProgress(1)` on every non-null entry in `assetHandlesRef.current` so image and text assets reveal instantly. When OFF, `animator.reset()` already pushes progress back to 0 via the per-frame writer.
  - Auto-save: `Scene.assets` already serializes new fields transparently; round-trip a project with a text asset through close + reopen.
  *Done when:* "Show All" reveals text fully (no animation, no clip rect); toggling off resets to hidden; closing and reopening a project preserves every text property.

- [x] **11.10** Phase 11 verification.
  1. Open existing project → drawable + image assets play as before; no console errors.
  2. Click "Add Text" → a new text appears at scene-centre saying "Text"; inspector opens with text-specific controls.
  3. Edit the text to a multi-line phrase ("Hello\nWorld") → both lines render; textarea preserves the newline.
  4. Switch font to Georgia → glyphs change immediately. Size to 96 → text grows. Weight to 700 → bolder.
  5. Switch alignment to centre → text centres around its placement origin. Direction to RTL with Arabic ("مرحبا بالعالم") → glyphs shape correctly with positional joining (browser-native), reading right-to-left.
  6. Cycle reveal modes through `type / wipe / stamp / fade` → press Play after each → each animation looks correct on its segment.
  7. With preview mode ON, add a second text asset → it shows fully without animation.
  8. Drag the text on the canvas → placement persists. Lower opacity to 0.5 → renders at half-alpha.
  9. Mix a scene order: drawable → text → image → drawable. Press Play. Pen-follower hides during text and image segments, reappears for the second drawable.
  10. Press Delete on the selected text → it disappears, inspector closes, surrounding assets remain intact.
  11. Close + reopen the project → all text properties (content, font, size, weight, alignment, direction, color, reveal mode, opacity, placement) persist; library card thumbnail shows the text.
  12. `npx tsc -p tsconfig.web.json --noEmit` reports no whiteboard-related errors. (Use the temp-tsconfig + skipLibCheck workaround if the pre-existing electron-vite/client error blocks output.)
  *Done when:* all twelve pass without console errors.

🎯 **Phase 11 done.** Stop. Do not start Phase 11.b (handwritten draw) or Phase 12 (raster vectorization) without checking in.

---

## Phase 11.b — Handwritten draw for text

Phase 11 ships four text reveal modes (`type` / `wipe` / `stamp` / `fade`), all driven by clip-path masks or opacity tweens. None of them produce the "hand writing letters" feel that whiteboard videos depend on. Phase 11.b adds the missing fifth mode — **`'draw'`** — by extracting glyph outlines from real handwriting fonts and reusing the existing dashoffset / `getPointAtLength` engine the drawable-asset pipeline already uses. The pen follower naturally rides along.

The Phase 11 `TextAsset` contract is forward-compatible: `'draw'` becomes a fifth allowed value on `TextRevealMode` without other shape changes. The seam is the editor's `flatPaths / assetSpecs` memo — a draw-mode text asset contributes paths to the flat `pathsRef` and a `{ kind: 'drawable', pathCount }` spec, so the existing animator handles it identically to a drawable asset. Glyph extraction is async (the font has to load), so a small in-feature cache + a graceful "extracting…" interim are required.

**Scope of this phase:**

- **Bundle four handwriting fonts** under [resources/fonts/](resources/fonts/): **Caveat** (Latin script), **Patrick Hand** (Latin script), **Aref Ruqaa** (Arabic), **Reem Kufi** (Arabic). All four are SIL OFL-licensed Google Fonts. Bundled, not downloaded — works offline.
- **`vidtsx-font://` custom protocol** mirroring `vidtsx-image://`. Resolves `vidtsx-font://{id}` to the bundled font file. Used both as `@font-face` source for the `<text>` reveal modes from Phase 11 and as the `fetch` URL the glyph extractor consumes.
- **Install [opentype.js](https://opentype.js.org/)** (~70 KB) as a renderer-side dependency. Pure JS, no Node bindings.
- **Glyph extractor service** that returns `{ paths: string[]; viewBox: string }` from `(text, fontUrl, fontSize, direction)`. Splits multi-line input by `\n`, walks characters in logical order, and for Arabic applies opentype's `arab` script feature so positional joining (initial / medial / final / isolated forms) is correct. RTL output positions right-to-left so the pen writes in the natural human direction.
- **Async glyph cache** — `useTextGlyphPaths(asset)` returns the cached `{ paths, viewBox }` synchronously when warm, kicks off extraction otherwise, and re-fires when text content / font / size / direction changes. Editing colour or opacity does not invalidate the cache.
- **`<TextReveal>` extension** — when `asset.revealMode === 'draw'`, render extracted `<path>` elements (one per glyph segment) instead of `<text>`, register each path with the parent canvas via `onRegisterPath(localIndex, el)`. Pen follower visibility falls out for free because the parent animator owns the dashoffset.
- **Editor wiring** — extend the `flatPaths / assetSpecs` memo to handle draw-mode text. Cache-warm path: contribute paths to `flatPaths` and `{ kind: 'drawable', pathCount }` to `assetSpecs`. Cache-cold path: contribute zero paths and a placeholder `{ kind: 'text', durationMs: 50 }` so the timeline doesn't stall — the memo re-runs once extraction finishes.
- **Inspector** — when the bundled handwriting fonts are available, the Font select grows a "Handwriting" `<optgroup>` with the four bundled families. The Animation grid stays at four columns until a handwriting font is selected; selecting one promotes it to a five-column grid with a `Draw` button.
- **Scene thumbnail** — draw-mode text in a saved scene renders as static `<path>` glyphs (using the cached extraction if available, else falls back to `<text>`) so library cards reflect what users see in the editor.
- **Feature gate** — a local `IS_HANDWRITING_DRAW_ENABLED` boolean in [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts), default `true` once 11.b.11 verification passes. The codebase's global `feature-flags.ts` is screen-level only ([src/shared/feature-flags.ts](src/shared/feature-flags.ts)), so a local constant is the lighter touch. Future phases can promote it to a per-user setting if needed.

**Out of scope (deferred):**

- A user-uploaded font library (`UserFontAsset` / `My Fonts` tab). Phase 11.b ships a fixed bundled set; user uploads can land in a future "Phase 11.c" if feedback demands it.
- Per-glyph stroke speed control or a "writing rhythm" curve. The existing scene-level `pxPerSec` governs draw timing uniformly.
- Cursive joining for non-Arabic scripts (Devanagari, Thai, etc.). Latin handwriting fonts already handle ligatures via OpenType `liga` features; opentype.js applies them automatically.
- Live mid-word reveals (sub-glyph clipping). Glyphs are atomic — each one draws all of its strokes in sequence.
- Replacing the type/wipe/stamp/fade modes with handwritten variants. They stay clip-path-based; only `'draw'` swaps the rendering pipeline.

**Known limitation surfaced during 11.b verification:** Arabic letters render in their isolated form, not visually joined. The original plan claimed opentype.js would apply `arab` script features automatically — that was wrong. opentype.js doesn't implement OpenType GSUB shaping, and substituting base letters with Presentation Forms (FB50+/FE70+) doesn't help because the bundled Aref Ruqaa / Reem Kufi cmaps don't expose those codepoints. Proper joining requires GSUB application via harfbuzzjs (~3 MB wasm) or a hand-rolled Arabic shaper. **Phase 11.c** will track this. For now Arabic is readable but un-joined.

**Contract additions:**

In [src/shared/types/whiteboard.ts](src/shared/types/whiteboard.ts):

- `TextRevealMode` extends to `'wipe' | 'stamp' | 'fade' | 'type' | 'draw'`.
- No other type changes — `TextAsset.revealMode` already stores the union value.

In [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts):

- New `IS_HANDWRITING_DRAW_ENABLED: boolean` constant.
- New `BUNDLED_HANDWRITING_FONTS` constant: `Array<{ id: string; family: string; cssFamily: string; url: string; script: 'latin' | 'arabic' }>`.
- New `getDrawModeTextDurationMs(asset, totalGlyphLengthPx, pxPerSec)` helper (mirrors how drawable durations resolve from path length / pxPerSec, used for the inspector's `≈ {ms}ms` hint when in draw mode).

In [src/main/index.ts](src/main/index.ts):

- New entry in `protocol.registerSchemesAsPrivileged([...])` for `vidtsx-font`.
- New `protocol.handle('vidtsx-font', ...)` block.

No SQLite, IPC, preload, or `Scene` shape changes. Existing projects with text-mode reveals stay valid; only opening the Inspector with a handwriting font selected exposes the new `Draw` button.

- [x] **11.b.1** Dependencies + feature gate. Install `opentype.js` (`npm install opentype.js@1.3.5` — pinned per CLAUDE.md). Install `@types/opentype.js@1.3.9` as a dev dep. In [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts), export `IS_HANDWRITING_DRAW_ENABLED = false` for now (flips to `true` at the end of 11.b.11). Add a one-line comment that the constant is a temporary gate; future work can promote it to a setting.
  *Done when:* `import * as opentype from 'opentype.js'` resolves; type-check passes; the constant is importable from `@features/whiteboard`.

- [x] **11.b.2** Bundle the four fonts. Create [resources/fonts/](resources/fonts/) and place the four `.ttf` files: `caveat.ttf`, `patrick-hand.ttf`, `aref-ruqaa.ttf`, `reem-kufi.ttf` (lowercase). Sources are Google Fonts — confirm each is OFL-licensed and add a `LICENSE.txt` next to the files documenting the license + source URL. Update [electron-builder.yml](electron-builder.yml) (or `package.json`'s `build` block, whichever holds the existing `extraResources` config) to include `resources/fonts/**` in the packaged app under the same path layout.
  *Done when:* the four `.ttf` files exist on disk under `resources/fonts/`; `npm run build` produces an installer that includes them; in dev, the files resolve via `path.join(__dirname, '../../resources/fonts', '<id>.ttf')` from the main process.

- [x] **11.b.3** `vidtsx-font://` protocol. In [src/main/index.ts](src/main/index.ts):
  - Add `{ scheme: 'vidtsx-font', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true } }` to the existing `protocol.registerSchemesAsPrivileged([...])` array.
  - Add a `protocol.handle('vidtsx-font', async (request) => { ... })` block next to the `vidtsx-image` handler. Resolve `vidtsx-font://{id}` to the bundled font file path via a new `getBundledFontPath(id: string): string | null` service. The service: validates `id` against `/^[a-z0-9-]{1,30}$/`, returns `path.join(getFontsDir(), `${id}.ttf`)` only when the file exists, else `null`. `getFontsDir()` returns `app.isPackaged ? path.join(process.resourcesPath, 'fonts') : path.join(__dirname, '../../resources/fonts')` (mirroring how `iconPath` is resolved at line 102-105).
  - Create [src/main/services/whiteboard-fonts.ts](src/main/services/whiteboard-fonts.ts) housing `getFontsDir()` and `getBundledFontPath(id)`. Path-traversal is enforced by the regex on `id` and by checking the resolved path startsWith the controlled fonts dir.
  *Done when:* in the renderer, `await fetch('vidtsx-font://caveat').then(r => r.arrayBuffer())` returns a non-empty ArrayBuffer; bad IDs (`../etc`, `caveat.ttf%00`) return 404; the protocol works in both dev and packaged builds.

- [x] **11.b.4** Glyph extractor service. Create [src/features/whiteboard/services/text-glyph-extractor.ts](src/features/whiteboard/services/text-glyph-extractor.ts) exporting:
  - `extractGlyphPaths(input: { text: string; fontUrl: string; fontSize: number; direction: TextDirection }): Promise<{ paths: string[]; viewBox: string }>`
  - Implementation steps:
    1. Load the font once and cache it module-level by `fontUrl`: `const font = await opentype.load(fontUrl)`. Loading a fetched URL works in Electron because the renderer can `fetch('vidtsx-font://...')`.
    2. Split `text` by `\n` into lines. Track a running `xCursor` per line and a running `yCursor` advancing by `fontSize * 1.2` per line (matching `<TextReveal>`'s `lineHeightEm = 1.2`).
    3. For each line, iterate characters in logical order. Use `font.stringToGlyphs(line)` to get the post-OpenType-shaping glyph sequence (this is where `arab` positional joining happens automatically — opentype.js applies the script's required features when it sees Arabic codepoints).
    4. For each glyph, compute its `d` string via `glyph.getPath(x, y, fontSize).toPathData(2)`. Accumulate `paths.push(d)` and advance the cursor by `glyph.advanceWidth * (fontSize / font.unitsPerEm)`.
    5. **Direction handling:** for `direction === 'rtl'`, accumulate the per-glyph advance widths first, then position glyphs from the right edge (line width − cumulative advance) so visual-order positioning matches how a human writes Arabic — leftward across the line, but with each glyph laid out from the right edge of the line. For `'auto'` and `'ltr'`, lay out from left to right.
    6. ViewBox: `'0 0 ${maxLineWidth} ${lineCount * fontSize * 1.2}'`. `maxLineWidth` = max of per-line cursor end positions.
  - Skip glyphs that have no path (whitespace, control chars) — they advance the cursor but contribute no entry to `paths`.
  - Wrap `opentype.load` errors in a thrown `Error('Font load failed: ${url}')` so the cache hook can surface a useful message.
  *Done when:* given the input `{ text: 'Hi', fontUrl: 'vidtsx-font://caveat', fontSize: 96, direction: 'ltr' }`, returns 2+ paths (one per glyph segment — H is one path, i may be one or two depending on the font) plus a viewBox roughly `'0 0 ~120 115'`. Given `{ text: 'مرحبا', fontUrl: 'vidtsx-font://aref-ruqaa', fontSize: 96, direction: 'rtl' }`, returns shaped glyph paths positioned from right to left (the leftmost glyph in the output is the last logical character).

- [x] **11.b.5** Type contract + service helpers. In [src/shared/types/whiteboard.ts](src/shared/types/whiteboard.ts) extend `TextRevealMode` to `'wipe' | 'stamp' | 'fade' | 'type' | 'draw'`. In [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts):
  - Export `BUNDLED_HANDWRITING_FONTS` as a `ReadonlyArray<{ id: string; label: string; family: string; cssFamily: string; url: string; script: 'latin' | 'arabic' }>`. Four entries: Caveat / Patrick Hand / Aref Ruqaa / Reem Kufi. `cssFamily` is what the `<text>` element uses (e.g. `'Caveat, cursive'` so the type/wipe/stamp/fade modes still render with the same family); `url` is `vidtsx-font://{id}`.
  - Inject `@font-face` declarations on module load (one per bundled font, src `vidtsx-font://...`) so the type/wipe/stamp/fade modes pick up the family by name. Idempotent — guard with a `loaded` flag.
  - Add `getDrawModeTextDurationMs(totalGlyphLengthPx: number, pxPerSec: number): number` returning `Math.round((totalGlyphLengthPx / pxPerSec) * 1000)` for the inspector's `≈ {ms}ms` hint. The flat path-length sum is computed by the cache hook (11.b.6).
  *Done when:* `BUNDLED_HANDWRITING_FONTS` is importable; selecting a handwriting `cssFamily` in the inspector renders Phase 11's `wipe`/`stamp` correctly with the new font; `TextRevealMode` accepts `'draw'` at compile time.

- [x] **11.b.6** Async glyph cache hook. Create [src/features/whiteboard/hooks/useTextGlyphPaths.ts](src/features/whiteboard/hooks/useTextGlyphPaths.ts):
  - Module-level `Map<string, { paths: string[]; viewBox: string; totalLengthPx: number }>` keyed by `${text}|${fontFamily}|${fontSize}|${direction}` (use a stable hash if keys grow long).
  - Module-level `Map<string, Promise<...>>` for in-flight extractions so concurrent identical requests dedupe.
  - The hook accepts a `TextAsset` and returns `{ status: 'idle' | 'loading' | 'ready' | 'error'; data?: { paths, viewBox, totalLengthPx }; error?: string }`. It only triggers extraction when `IS_HANDWRITING_DRAW_ENABLED` is true and the asset's `fontFamily` resolves to a bundled font URL (look up via `BUNDLED_HANDWRITING_FONTS`); otherwise stays `idle`.
  - On status flip to `'ready'`, compute `totalLengthPx` by spawning a hidden offscreen `<svg>` (or using a single shared one), creating each `<path>` once, calling `getTotalLength()`, summing — this matches what Phase 1.3 measured for drawable paths and lets the editor compute draw-mode durations without re-measuring after mount.
  *Done when:* given a draw-mode text asset, the hook flips `idle → loading → ready` once, returns the cached entry on subsequent renders without re-fetching, and edits to `color` or `opacity` don't change the returned reference.

- [x] **11.b.7** `<TextReveal>` draw-mode branch. In [TextReveal.tsx](src/features/whiteboard/components/TextReveal.tsx):
  - Add new prop: `glyphPaths?: { paths: string[]; viewBox: string } | null` and `onRegisterPath?: (localIndex: number, el: SVGPathElement | null) => void`. The parent (canvas) reads draw-mode glyph paths from the cache hook (11.b.6) and passes them down.
  - Add a `revealMode === 'draw'` branch:
    - If `glyphPaths` is `null`/missing, render nothing (or a tiny `<text>` placeholder showing "extracting…" — your call after a quick UX check).
    - If present, render one `<path>` per entry with `fill="none" stroke={asset.color} strokeWidth={Math.max(2, asset.fontSize * 0.05)} strokeLinecap="round"`. Initial `stroke-dasharray` and `stroke-dashoffset` set inline so the first frame already hides the path before the parent animator's mount effect runs.
    - For each path, call `ref={(el) => onRegisterPath?.(i, el)}` so the parent canvas can collect them into `pathsRef`.
    - The `forwardRef` `setProgress` handle becomes a no-op for `'draw'` — the parent animator drives dashoffsets directly.
  - The `staticReveal === true` case for draw mode renders the same paths fully revealed (`stroke-dashoffset="0"`) inside the same `<g>`.
  - Preserve the existing `onMeasure` callback for draw mode: emit `{ x: 0, y: 0, w: viewBox.width, h: viewBox.height }` once the glyphs are ready so the click-target rect and selection outline still fit.
  *Done when:* a draw-mode text with cached glyph paths renders the right number of `<path>` elements, all initially hidden via dashoffset; `staticReveal` shows them all at once; switching reveal mode mid-edit doesn't remount the SVG `<g>`.

- [x] **11.b.8** Editor wiring — flat path / spec memo. In [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx):
  - For each scene asset, before pushing into `flatPaths` / `assetSpecs`, call `useTextGlyphPaths(asset)` per text asset (use a single hook that takes the array — or wrap the per-asset hook in a child component that lifts results up via callback; pick whichever makes the rules-of-hooks pass cleanly).
  - In the memo:
    - **Drawable text (cache `ready`)**: push `glyphPaths.paths.length` entries into `flatPaths`, push `{ kind: 'drawable', pathCount: glyphPaths.paths.length }` into `assetSpecs`. The asset's identity for `assetHandlesRef` becomes a no-op slot (push `null`).
    - **Drawable text (cache `loading` / `idle`)**: push zero paths and `{ kind: 'text', durationMs: 50 }` (50 ms placeholder so the timeline doesn't pause for a noticeable beat — once extraction finishes the memo re-runs and the proper drawable spec replaces it).
    - **All other text modes** (wipe / stamp / fade / type): unchanged — push `{ kind: 'text', durationMs: getTextAssetDurationMs(asset) }`.
  - Plumb the cached `glyphPaths` and an `onRegisterPath(localIndex, el)` callback through `<WhiteboardCanvas>` down to `<TextReveal>`. The canvas's existing `pathsRef` collection logic stays — text-draw paths register through the same callback drawables already use, but localIndex maps into the canvas-level flatPaths position.
  - Preview mode + restart should already work transparently: drawable paths land in `pathsRef`, `usePathAnimator`'s mount effect calls `setDasharray` and `setDashoffset(fullLength)` on each, the per-frame writer animates them.
  *Done when:* adding a draw-mode text asset, then pressing Play → the existing drawables draw, then the text glyphs draw stroke-by-stroke with the pen follower riding along; `activePathIndex` advances through the glyph paths in order; the status line increments past the text segment correctly.

- [x] **11.b.9** Inspector — handwriting fonts + Draw mode button. In [AssetInspectorPanel.tsx](src/features/whiteboard/components/AssetInspectorPanel.tsx):
  - When `IS_HANDWRITING_DRAW_ENABLED` is true, the Font `<select>` grows an `<optgroup label="Handwriting">` block listing the four bundled families. The existing FONT_OPTIONS stay under a `<optgroup label="System">` group. The select's value still binds to `cssFamily` so all reveal modes (including the existing four) pick up the bundled font.
  - In the Animation grid, when the asset's `fontFamily` resolves to a handwriting `cssFamily` (lookup against `BUNDLED_HANDWRITING_FONTS`), render five buttons (`type / wipe / stamp / fade / draw`) and switch the grid to `grid-cols-5`. When the font is non-handwriting, keep four buttons and skip `draw` (selecting it would extract zero paths). If a draw-mode text asset has its font swapped to a non-handwriting one, auto-revert to `'fade'` via the same `onUpdate` call.
  - Below the Animation grid, when the active mode is `'draw'`, replace the `≈ {ms}ms` hint (computed from `getTextAssetDurationMs`) with `≈ {ms}ms` from `getDrawModeTextDurationMs(totalLengthPx, scene.pxPerSec)`. Read `totalLengthPx` from the cache hook's ready entry. While loading, show `Extracting glyphs…`.
  *Done when:* selecting a handwriting font surfaces the Draw button; choosing Draw kicks off extraction (visible spinner / "Extracting…" hint); after extraction the duration hint updates; switching the font to a non-handwriting family auto-reverts the mode and hides the Draw button.

- [x] **11.b.10** Scene thumbnail + preview-mode parity. In [scene-thumbnail.ts](src/features/whiteboard/services/scene-thumbnail.ts), for draw-mode text:
  - If the glyph cache has a synchronous entry for the asset's params, render one `<path>` per glyph with the right stroke (no fill, fully revealed).
  - Otherwise, fall back to the existing `<text>` rendering so the thumbnail still shows readable text.
  - Add a small `// TODO(phase 11.b)` comment if a synchronous-only API doesn't fit the existing thumbnail pipeline — thumbnails are best-effort and a fallback is acceptable.
  
  In [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx)'s preview-mode effect, after the existing per-path `dashoffset = 0` loop and per-handle `setProgress(1)` loop, no extra logic is needed — draw-mode text paths are already in `pathsRef` (via 11.b.8), so the existing path-zeroing loop reveals them fully. Verify this is the case; if not, the preview effect needs an explicit re-zero pass after the next paint following extraction.
  *Done when:* a project with a draw-mode text asset shows the rendered glyphs (or the `<text>` fallback) in its library card; toggling Show All in an editor with a freshly-added draw-mode text reveals the glyphs fully without a flash.

- [ ] **11.b.11** Phase 11.b verification.
  1. Open existing project → all Phase 11 reveal modes still play correctly; no regression in non-handwriting text rendering.
  2. Click **Add Text** → text appears with the default Inter font; Inspector shows four reveal modes (no Draw); the Font select shows a "Handwriting" optgroup with four entries.
  3. Switch font to **Caveat** → Animation grid grows to five columns; a new **Draw** button appears.
  4. Select **Draw** → "Extracting glyphs…" hint flashes briefly → duration hint updates to a real `≈ {ms}ms` value; press Play → the existing assets draw, then the text writes itself stroke-by-stroke with the pen follower riding the glyph outlines.
  5. Type a multi-line phrase (e.g. `Hello\nWorld`) → both lines extract; pressing Play draws them in logical order, line by line.
  6. Switch font to **Aref Ruqaa**, set Direction to `rtl`, type `مرحبا بالعالم` → glyph extraction applies positional joining (initial / medial / final / isolated forms render correctly); pressing Play writes from right to left, the way Arabic is hand-written.
  7. Switch font to **Patrick Hand**, mode stays `Draw` → glyphs re-extract under the new font; restart plays the new glyphs.
  8. Switch font to **Inter** → Draw button vanishes, mode auto-reverts to `'fade'`; press Play → text fades in (no glyph extraction touched).
  9. With Show All ON, add a draw-mode text → text appears fully revealed once glyphs extract, no animation, no pen follower.
  10. Mix scene order: drawable → draw-text → image → draw-text. Press Play → the pen rides through each drawable and each text segment continuously, hides only during the image segment.
  11. Close + reopen the project → all draw-mode text assets persist; on reopen the glyph cache repopulates on first paint; no flash of unrevealed text.
  12. Restart the app → bundled fonts still resolve via `vidtsx-font://`; draw mode still works.
  13. Set `IS_HANDWRITING_DRAW_ENABLED = true` (flip from 11.b.1).
  14. `npx tsc -p tsconfig.web.json --noEmit` reports no whiteboard-related errors.
  *Done when:* all fourteen pass without console errors.

🎯 **Phase 11.b done.** Stop. Do not start Phase 12 (raster vectorization) without checking in.

---

## Phase 12 — Raster vectorization

Phase 10 lets users upload raster images (PNG/JPG/WebP) but only as `ImageAsset`s with non-path reveal modes (`wipe` / `stamp` / `fade`). For a photo of a logo to **draw itself stroke by stroke**, the raster has to become a `DrawableAsset` first. Phase 12 adds the missing pipeline: a one-click vectorize action that runs a wasm tracer locally (no server, no API key), parses the result through the existing Phase 9 SVG normalizer, and saves the output as a `UserSvgAsset` so it shows up in **My SVGs** and animates through the same engine that handles the bundled catalog and uploaded SVGs.

The seam is the existing `UserSvgAsset` shape (Phase 9): the vectorized output is just another row in the user-SVG table with `source: 'vectorized'` and a pointer to the original image so re-vectorizing with different settings stays cheap. The animator, canvas, inspector, and scene-thumbnail pipelines all work unchanged because the output is a normal `DrawableAsset`.

**Scope of this phase:**

- Bundle [vtracer-wasm](https://www.npmjs.com/package/vtracer-wasm) (~150 KB total: 137 KB wasm + 14 KB JS — smaller than the original ~300 KB estimate). Pure wasm, runs in the renderer with no native deps.
- A renderer-side **vectorizer service** that takes raster bytes + a config, runs `to_svg(...)`, and returns a normalized `{ paths, viewBox }` via the existing Phase 9 [svg-parser.ts](src/features/whiteboard/services/svg-parser.ts).
- A "Vectorize" entry point on user-uploaded images: one click on the image card (or in the inspector when the asset is selected) → modal preview with a threshold slider → click Save → the vectorized SVG appears in **My SVGs**, ready to drop into the scene as a drawable.
- Extend the `UserSvgSource` union with `'vectorized'`. Add an optional `sourceImageId?: string` so re-vectorizing the same source re-traces from the original raster instead of asking the user to re-upload.
- Sensible B&W defaults (`color_mode: 'binary'`, `mode: 'spline'`, `filter_speckle: 8`) with a single **Threshold** slider in the modal that maps to `color_precision`. Power-user knobs (corner threshold, splice threshold, hierarchical mode) deferred until / unless feedback demands them.
- Local feature gate `IS_VECTORIZE_ENABLED` in [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts), default `false` until 12.7 verification passes — mirrors the Phase 11.b gating pattern.

**Out of scope (deferred):**

- **Color vectorization.** B&W only for MVP. The output animates as monochrome strokes; color tracing produces stacked filled regions whose drawing order is non-obvious. Color mode can land later behind a separate toggle.
- **Centerline / single-stroke** vectorization. VTracer outputs closed filled paths; animation strategy is "stroke the outlines" (industry-standard for whiteboard tools — same approach Doodly / Videoscribe use).
- **AI-assisted draw-order.** Path order = DOM order from VTracer. A vision model that proposes a more human-feeling sequence is Phase 20.
- **Batch vectorize.** One image at a time. Bulk vectorize can come if libraries grow large.
- **Re-uploading the source.** If the user deletes the original raster, we keep the vectorized SVG (it has its own paths) but lose the ability to re-vectorize. We don't re-fetch missing sources.

**Contract additions:**

In [src/shared/types/whiteboard.ts](src/shared/types/whiteboard.ts):

- `UserSvgSource` extends to `'upload' | 'ai-generated' | 'vectorized'`.
- `UserSvgAsset` gains optional `sourceImageId?: string` (the `id` of the row in the `user_images` table that backed the trace, when applicable).

In [src/main/services/whiteboard-svgs-db.ts](src/main/services/whiteboard-svgs-db.ts):

- Migration adds `source_image_id TEXT` column (nullable). Existing rows tolerate the new column without re-encode.

No IPC changes (the existing `WHITEBOARD_USER_SVG_*` channels carry the new field transparently). No new custom protocols.

- [x] **12.1** Dependency + feature gate. `npm install vtracer-wasm@0.1.0 --save-exact --legacy-peer-deps`. In [whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts), export `IS_VECTORIZE_ENABLED = false` next to `IS_HANDWRITING_DRAW_ENABLED`. Verify the wasm bundle is included in electron-vite's renderer build (it should be — Vite handles `.wasm` natively via dynamic imports). If the wasm fails to load, add an explicit copy-pattern under [electron.vite.config.mjs](electron.vite.config.mjs)'s renderer build.
  *Done when:* `import init, { to_svg } from 'vtracer-wasm'` resolves; type-check passes; constant importable from `@features/whiteboard`.

- [x] **12.2** Vectorizer service. Create [src/features/whiteboard/services/vectorizer.ts](src/features/whiteboard/services/vectorizer.ts) exporting:
  - `interface VectorizeConfig { mode: 'binary' | 'color'; threshold?: number; filterSpeckle?: number }` — minimal API surface; defaults used for everything else.
  - `vectorizeRaster(bytes: Uint8Array, config?: VectorizeConfig): Promise<{ paths: string[]; viewBox: string }>` — decodes bytes to RGBA pixels via an off-screen `<canvas>` (handles PNG/JPG/WebP transparently), calls the wasm `to_svg(pixels, w, h, config)`, then runs the resulting SVG string through `normalizeSvgElement` from [svg-parser.ts](src/features/whiteboard/services/svg-parser.ts) to extract `{ paths, viewBox }`.
  - Module-level `Promise<void>` for the wasm init call so concurrent vectorizes don't double-initialise.
  - Default config when `mode: 'binary'`: `{ color_mode: 'binary', mode: 'spline', filter_speckle: config.filterSpeckle ?? 8, color_precision: config.threshold ?? 6, hierarchical: 'cutout', corner_threshold: 60, length_threshold: 4, splice_threshold: 45, path_precision: 5 }`.
  *Done when:* given a small B&W PNG (e.g. a simple silhouette), returns a non-empty paths array and a sensible viewBox (matching the input dimensions); type-check passes.

- [x] **12.3** SQLite schema migration. In [whiteboard-svgs-db.ts](src/main/services/whiteboard-svgs-db.ts):
  - Add `source_image_id TEXT` column to the `user_svgs` table via `ALTER TABLE user_svgs ADD COLUMN source_image_id TEXT` inside an idempotent migration block (check `PRAGMA table_info` first so the migration is safe to run on existing databases).
  - Update `UserSvgRecord` (the on-disk row shape) and `rowToRecord` / save handler to round-trip the new field.
  - In [src/shared/types/whiteboard.ts](src/shared/types/whiteboard.ts), extend `UserSvgSource` union and add `sourceImageId?: string` to `UserSvgAsset`.
  *Done when:* a fresh install creates the column; an existing install upgrades cleanly without losing rows; round-trip a saved-then-loaded `UserSvgAsset` and confirm `sourceImageId` survives.

- [x] **12.4** Vectorize hook + service wiring. Create [src/features/whiteboard/hooks/useVectorize.ts](src/features/whiteboard/hooks/useVectorize.ts) exposing `{ status: 'idle' | 'tracing' | 'ready' | 'error'; result?: { paths, viewBox }; error?: string; vectorize(bytes, config?): Promise<void>; reset(): void }`. The hook owns no module-level state — it's a per-modal-instance state machine wrapped around `vectorizeRaster`. In [user-svgs-service.ts](src/features/whiteboard/services/user-svgs-service.ts), accept the new optional `sourceImageId` field on the save request (the IPC type already passes through unknown fields).
  *Done when:* hook returns expected states; calling `vectorize(bytes)` flips `idle → tracing → ready`; result feeds straight into a `UserSvgAsset`-shaped object.

- [x] **12.5** Vectorize modal. Create [src/features/whiteboard/components/VectorizeModal.tsx](src/features/whiteboard/components/VectorizeModal.tsx). Layout: 
  - Top: source image preview (320×240 max, letterboxed).
  - Below: threshold slider (1–8, default 6, mapping to `color_precision`) with a live re-trace on release (debounced 200 ms).
  - Right: vectorized preview using the existing `<AssetPreview>` component (Phase 5) on the latest `{ paths, viewBox }` state.
  - Footer: **Cancel** / **Save to My SVGs** buttons. Save uploads the result via `useUserSvgs().add(...)` (extended with `sourceImageId` and `source: 'vectorized'`).
  - Loading / error states match the existing image-upload flow: spinner during trace, red text below the slider on failure.
  *Done when:* the modal opens with the source preview, dragging the slider re-traces and updates the preview, clicking Save persists a new `UserSvgAsset` and closes the modal.

- [x] **12.6** Entry points. Two places to launch vectorize:
  - **Image card hover action**: in the My Images tab grid, hover an image card → a "Vectorize" icon button appears next to the existing delete button. Click → opens the modal with the source bytes pre-loaded.
  - **Image inspector action**: when an `ImageAsset` is selected, the [AssetInspectorPanel](src/features/whiteboard/components/AssetInspectorPanel.tsx) gets a "Vectorize" section between Animation and File. One button — same modal flow.
  Both actions are gated on `IS_VECTORIZE_ENABLED`. Bytes come from `fetch('vidtsx-image://{id}').then(r => r.arrayBuffer())`.
  *Done when:* both entry points open the modal; the modal pre-loads the source image; saving from either entry point produces a `UserSvgAsset` with `source: 'vectorized'` and `sourceImageId` set to the originating image id.

- [ ] **12.7** Phase 12 verification.
  1. Flip `IS_VECTORIZE_ENABLED = true`. Restart Electron (the gate gets baked into the renderer bundle).
  2. Upload a B&W silhouette PNG (e.g. a simple logo) via the My Images tab. Hover the card → "Vectorize" button appears.
  3. Click Vectorize → modal opens, source preview shows on the left, vectorized preview renders on the right within ~1s.
  4. Slide the Threshold from 6 → 3 → 8 → preview re-traces each time (debounced); higher = more detail, lower = simpler shapes.
  5. Click Save → modal closes, switch to My SVGs tab → the vectorized result appears as a new card with the source image's filename + " (vectorized)".
  6. Click the new SVG card → drops into the scene as a drawable. Press Play → it draws itself stroke-by-stroke through the existing animator, no special handling needed.
  7. Select an `ImageAsset` already on the canvas → Inspector now shows a Vectorize section. Click → same modal flow.
  8. Delete the original image from My Images → confirm the vectorized SVG remains intact in My SVGs (no cascading delete).
  9. Restart the app → vectorized SVGs persist, `sourceImageId` survives.
  10. Try a more complex grayscale photo → trace completes (may take 2–4s), produces a recognisable approximation.
  11. `npx tsc -p tsconfig.web.json --noEmit` reports no whiteboard-related errors.
  *Done when:* all eleven pass without console errors.

🎯 **Phase 12 done.** Stop. Do not start Phase 13 (fill / interior coloring) without checking in.

---

## Phase 12+ — Post-MVP outlines (will be detailed before each phase starts)

- **Phase 13** — Fill / interior coloring. `DrawableAsset` gains optional `fillColor?: string`. Inspector adds a Fill section (color picker + None toggle). Animator timing: fill snaps in instantly the moment the asset's last path completes (cheapest visually-coherent option); a 200ms fade-in mode can land later. Fills are written via direct `setAttribute('fill', ...)` on the path elements when the active-asset boundary advances, mirroring the dashoffset path to avoid per-frame React rerenders.
- **Phase 14** — Timeline UI. Track per asset, drag to reorder and resize, playhead scrubbing, per-asset duration overrides.
- **Phase 15** — Sketchy / hand-drawn style. Integrate [Rough.js](https://roughjs.com/) (~30KB) as a per-asset / per-scene "sketchy" toggle: at scene-build time, run each asset's path data through Rough.js with a deterministic seed, animate the *roughened* paths through the existing animator. [perfect-freehand](https://github.com/steveruizok/perfect-freehand) lands when (and if) we add a free-drawing tool — it generates pressure-tapered stroke outlines from input points, which fits a future "draw on the canvas with mouse" feature, not the import-and-animate flow.
- **Phase 16** — Background variants (lined, grid, chalkboard, custom image).
- **Phase 17** — Hand library plus tip calibration UI for user-uploaded hands.
- **Phase 18** — Camera (pan and zoom on infinite canvas) plus auto-follow-pen mode. *(Addresses the "infinite canvas" need.)* When this lands, change the editor's canvas pane: paint the full pane white (or the project background) and render the scene viewBox as a **dotted-outline frame** (Figma-style) so users see what's inside vs outside the camera. Replaces today's "fit-the-aspect-to-the-pane" sizing — assets become free-floating in an infinite plane and the frame is just a marker.
- **Phase 19** — Voiceover sync (reuse VidTSX's existing Whisper integration); music with ducking; optional pen SFX.
- **Phase 20** — AI auto-order for imported assets (vision model proposes draw sequence).
- **Phase 21** — Remotion composition export. Parallel frame-based animator using a headless path-measurement library. Determinism check: same scene plus same frame yields same pixels.
- **Phase 22** — Render queue integration; GIF and PNG sequence export.

---

## Notes for the implementer

- **One commit per step.** Suggested message: `whiteboard-studio: <step number> <step title>`.
- **The data model is the contract.** Every component reads and writes the same conceptual shape. If a step seems to require changing it, stop and ask.
- **Keep the engine DOM-only for MVP.** A parallel headless variant for Remotion comes in Phase 21 — don't try to abstract over both now.
- **Reference prototypes exist.** Hasan has working prototypes (drawing scene + handwriting) that demonstrate the dashoffset + getPointAtLength approach end to end. Ask him to share if useful.
# Filter packs — pluggable per-clip filters + the Filters tab (Pack system E2, slice 1)

> Status: **all decisions answered (Hasan, 2026-09-18) — two tabs, Filters
> and Effects. P0 passed on every axis, fps included (2026-09-22). P1–P3
> COMMITTED 2026-09-24 (2f0ee49); P4 (export copy step) and P5 (import: the
> pack code generalized over both kinds, `.vidtsxfilter`, the tabs' Import…)
> are BUILT and verified live (2026-09-24, uncommitted) — see "As built
> (P4–P5)", "P4 results", "P5 results". Slice 1 is complete; the tracked
> nine have their own section, "Analysis tracks".** This is
> NEXT_FEATURES_DESIGN.md row 10 (Q8c "effects") started from the other end:
> 22 authored, machine-verified filters already exist in the sibling repo
> (`../vidtsx-addons/filters/`, contract in its `AUTHORING.md` and
> `INTEGRATION.md`), and they fix the contract. Row 10 planned effects as TSX
> wrapper components (CSS/SVG filters over `children`); the authored set is
> **Canvas 2D code** (`render(frame)` paints into a 2D context), so the plug is
> different while the document model, pack container, degrade rules and UI
> pattern are exactly the transitions' (`TRANSITION_PACKS_DESIGN.md`). Where
> this doc differs from Q8c it is marked ★. The 9 face / subject filters need
> analysis tracks (Q8h) and are **out of this slice** — see "What waits" and
> "Analysis tracks".

> **Continue from here (for the next session).** Everything below is the
> record; this is the order of work:
>
> 1. **Commit P4–P5** when Hasan asks (by pathspec, never `stash`): the
>    working tree holds the files listed under "As built (P4–P5)" — new
>    modules, nine deletions (the transition-only package code they replace),
>    and wiring. Tests for every touched file are green; `check:types` at
>    baseline. Suggested message: `feat(studio): filter packs — export copy
>    step, pack import generalized over transitions and filters (E2, P4–P5)`.
> 2. **P6 — content (DECIDED, Hasan 2026-09-24: the transitions split):** the
>    core pack stays at its three; the other ten eligible items ship as ONE
>    pack, `vidtsx-filters` ("VidTSX Filters — Volume 01" 1.0.0) —
>    filters `vivid`, `sepia`, `golden-hour`, `arctic`; effects `comic`,
>    `pixel-party`, `disco`, `kaleidoscope`, `film-halation`,
>    `anamorphic-streaks`. Build it the way P5 verified: esbuild each from
>    the add-ons SDK (`.vidtsx-temp/p0-filters/bundle-filters.mjs` is the
>    bundler; the entry = the add-on's meta + `category` + `parameters` /
>    `presets` copied out of the module + `requires` + `heavy`), zip it with
>    the kit's `live/p5/mkpkg.mjs` shape, gate every bundle, MEASURE `comic`
>    and `pixel-party` at 1080p for `heavy` (the lab said `pixels()`-heavy),
>    import it on the isolated instance, apply each item once, export one
>    project through the P4 checker. Ship the file into
>    `../vidtsx-addons/dist/` (gitignored there) with a copy in the kit, as
>    Volume 01 of transitions was. The add-ons repo carries another session's
>    uncommitted reorganisation — build from `dist/sdk/`, touch nothing there.
> 3. **Slice 2 (the tracked nine):** the ONNX spike in "Analysis tracks" —
>    the `requires` gate is wired end to end (loader, import dialog: a tracked
>    filter is held back with a message naming the missing track), so the
>    spike can start on the analysis side.
> 4. **Open debt (small):** package drag-and-drop (shared with transitions);
>    removing a single from `imported/`; `speed` in the filter clock; the
>    add-ons repo's real builder (`bundle-filters.mjs` in the harness is the
>    only one, and its `.vidtsxfilter` / pack packaging is the kit's
>    `live/p5/mkpkg.mjs`).
> 5. **Verification rules:** re-run the P0 harness (`node run.mjs 30,100,200,300
>    --runs=1` then md5-compare `out/filtered-run1/` with `out/proto-run1/`)
>    after any edit to `FilteredPicture.tsx`, `filter-runtime.ts`,
>    `ClipRenderer.tsx` or `SceneMirror.tsx`; the fps gate
>    (`player/fps-when-quiet.ps1`, Task Scheduler job `vidtsx-p0-filters-fps`)
>    after any change to the Player paint path; `npm run check:types` must
>    stay at its baseline (26 / 10 on 2026-09-24 — read it from the command,
>    not from here). Live checks: `.vidtsx-temp/p0-filters/live/` (README,
>    "P4 / P5 additions"). Two dev traps met in P4: the app's bundle cache is
>    keyed on the entry file's hash alone, so after an edit to shared render
>    code export a project under a NEW id; and `electron-vite dev` never
>    rebuilds main — restart the instance after main-code edits.

## What ships

A **Filters** tab in the editor's left pane: a gallery of filters with live
thumbnails; select a clip on the timeline, click a card, it applies. The
Inspector shows the filter's controls (intensity, the filter's own knobs,
presets, Remove). Built-in filters ship in the existing `core` pack (the same
container, a `filters/` subfolder beside `transitions/`); more arrive as
files the user imports — a pack (`.vidtsxpack`) or a single filter
(`.vidtsxfilter`).

First milestone is deliberately three filters, end to end (preview, export,
undo, degrade), before any content work. Each proves one thing the others
don't:

- `noir` — one `ctx.filter` string plus a gradient. Proves the pipeline and
  that canvas `filter` renders identically in headless Chrome.
- `vhs` — animated: time-seeded interference, a moving tear, burned-in text.
  Proves determinism (preview frame N = export frame N), clip-relative time
  across splits, fonts in the render host.
- `cinematic-bloom` — `parameters` + `presets` + reusable buffers; the
  heaviest of the three (measured 33 ms at 640×360, ~100 ms at 1080p in the
  lab). Proves the param-driven Inspector and sets the "heavy" policy.

## Filters vs effects — one mechanism, two galleries

CapCut (the reference for the audience) keeps two sections: **Filters** are
colour looks — static, LUT-like, one intensity slider, one per clip;
**Effects** are stylized or animated treatments (glitch, VHS, bloom,
kaleidoscope, particles) and the face / body-tracked ones, several per clip
on top of the filter, and optionally placed on their own layer spanning
several clips. The add-ons' 22 span both under one word and one contract:

| Category | Add-ons |
|---|---|
| filter (5) | vivid, noir, sepia, golden-hour, arctic |
| effect (8) | vhs, comic, pixel-party, disco, kaleidoscope, cinematic-bloom, film-halation, anamorphic-streaks |
| effect, tracked (9, waiting) | puppy, kitty, big-mouth, alien, heart-eyes, neon-aura, subject-color-pop, electric-outline, spotlight-subject |

Mechanically there is no difference — every one is `render(frame)` over a
raster — so the engine, loader, document field, export path and import
formats are **one thing**. The split lives in three places only:

- **Manifest `category: 'filter' | 'effect'`**, derived by the builder (a
  static colour look is a filter; animated, lens or tracking treatments are
  effects). Not stored in the document; `effects[]` holds both.
- **The slot rule** (supersedes "one per clip"): a clip holds **one filter
  and one effect**, rendered filter first, then the effect — grade, then
  stylize, the order CapCut composes in. Two chained renderers (the first's
  output canvas is the second's source). A card click replaces the entry of
  its own category. Deeper stacking is the array's job later.
- **The gallery: two tabs, Filters and Effects** (Hasan, 2026-09-18) — one
  panel component with a category prop, mounted twice. Seven tabs with the
  Transcript flag on; the icon-collapse rule carries it.

An effect on its own layer covering a time span (CapCut's adjustment-layer
placement) is **not** in this slice: per-clip plus "apply to all clips on
this track" covers the whole-video case. Ledgered under "What waits".

## Decisions that differ from Q8c (★)

1. ★ **The contract is the add-ons' SDK contract, not a wrapper component.**
   `FilterDefinition` / `RenderContext` / `FrameInput` exactly as in
   `filters/core/types.ts`. Twenty-two filters are written and verified
   against it (zero intensity = exact passthrough, deterministic at fixed
   time, three aspects, 153 pixel-hash regressions). The host vendors the
   SDK's `renderer.ts` + `parameters.ts` (~170 lines, dependency-free) as
   `src/shared/studio/filter-runtime.ts`; a filter never sees React or
   Remotion.
2. ★ **The plug is `onVideoFrame`, not `children`.** A Canvas 2D filter needs
   a raster source. Both media tags at our pin take the same
   `onVideoFrame(frame: CanvasImageSource)` (§D3.6, verified 2026-09-17), and
   in a headless render Remotion's `Img` invokes it **before** it releases
   the frame's `delayRender` handle (`remotion/dist/esm/index.mjs`
   `onImageFrame?.(current)` → `continueRender2(newHandle)`), so a synchronous
   canvas draw made there is in the captured frame. This is the "E2b texture
   hook authored once" the S0 notes anticipated — Canvas 2D instead of WebGL.
3. ★ **Items are bundled JavaScript, not TSX.** A filter's source imports
   shared `core/` helpers (`base`, `pixels`, `highlightBloom` …); the pack
   gate wants one self-contained file per item (the transition precedent).
   The add-ons builder bundles each filter with esbuild (`core/` inlined,
   `export default`), so `filters/<id>.js` has **no imports at all**. The app
   never transpiles it — it gates it and serves it.
4. **Field name.** Q8c sketched `effects: [{ id, params, disabled }]`. The
   sibling field is `transitionOut.kind`, and the loaders' helpers key on
   `kind`, so the entry is `{ kind, params?, disabled? }`.

Unchanged from Q8c: the per-clip `effects[]` array (ordered, stackable — the
schema; v1 UI keeps at most one), param specs in the manifest driving a
generic Inspector, ephemeral preview while dragging, the degrade rule, tiers
of "heavy" with a preview escape hatch. Reserved, not built: `keyframes` (K)
— `params` values are what it would animate; nothing here blocks it.

## Contract

```ts
// The add-ons' types, verbatim (FilterId collapses to string on the host;
// the manifest namespaces it).
export interface FilterDefinition {
  id: string; name: string; tier: 'common' | 'intermediate' | 'advanced';
  tagline: string; description: string; accent: string; symbol: string;
  faceTracking: boolean; subjectTracking?: boolean; animated: boolean;
  defaultIntensity: number;
  parameters?: readonly FilterParameter[];   // range | color
  presets?: readonly FilterPreset[];
  render: (frame: RenderContext) => void;    // paints frame.ctx from frame.source
}
```

Host obligations, all from the add-ons' `INTEGRATION.md`:

- **One renderer per output canvas**, `createFilterRenderer(canvas)`; the
  source is cover-cropped into it. The host sizes the canvas to the source's
  aspect, so the crop is a pure scale.
- **`time` is explicit seconds and a pure function of the Remotion frame** —
  never wall-clock. `time = (frame + trimBefore) / fps`, clip-relative and
  continuous across a split (the `from={-trimBefore}` idea shots use).
  `speed` stays 1 in v1.
- **`intensity` is the renderer's blend** (0 = byte-identical passthrough);
  it rides as `params.intensity`, defaulting to the filter's
  `defaultIntensity`.
- `faces: []` and no `subjectMask` in this slice, so a tracking filter would
  draw the unchanged source — which is why they are not shipped (below).
- Filters are opaque output; mirroring is never used.

## Document model

```ts
/** A pack filter's namespaced id `<packId>/<itemId>` (e.g. `core/noir`). */
export interface StudioClipEffect {
  kind: string;
  /** `intensity` plus the filter's own keys; a value equal to the filter's
   *  default is dropped (the ClipPatch neutral rule), so documents never
   *  accumulate no-op state. */
  params?: Record<string, number | string>;
  disabled?: boolean;
}
// StudioClip gains:
effects?: StudioClipEffect[];   // ordered; an empty array = key deleted
```

- **No schema bump**, for the transitions' reason: `migrateProject` rejects
  `schemaVersion !== 1`, so a bump makes every newly saved project unopenable
  in an older install. An older build ignores the field and shows the plain
  picture. (Whether it *preserves* the field on save depends on the loader's
  normalization — to check in P1; if it strips unknown keys, that is the
  same exposure every additive field has had.)
- **Applies to `video` and `image` clips** — the kinds with a raster source.
  TSX shots are a DOM tree, not a `CanvasImageSource`; filtering them is a
  later, different mechanism. Captions and sound: never.
- **Degrade (Q8d):** a kind whose pack is not installed, or whose module
  failed, renders the plain picture and the clip shows a warning chip; the
  id stays in the document, so reinstalling restores it. Never strip, never
  fail the load.
- **v1 UI keeps one filter and one effect per clip** (the slot rule above;
  a card click replaces its own category's entry). Order in the array is
  render order: the filter entry first. Deeper stacking is the array's job
  later: renderer N's output canvas is renderer N+1's source — the same
  chaining the two slots already use.

## Serializer — almost nothing

`SerializedClip.effects?: StudioClipEffect[]`, copied through for video and
image clips with `disabled` entries dropped. Params are resolved at render
time against the loaded definition (`resolveParameters`), not here — the
serializer stays free of pack knowledge, as it is for transitions.

**Export spans (`export-spans.ts`):** a clip with a live effect is a
**browser span** (`reason: 'filter'`) — never copied by the passthrough
engine, never a shot-composite base. One predicate, one test. The Export
dialog's "copies N %" line then tells the truth for filtered timelines.

## Composition — the one hard part

Today a video clip is `<OffthreadVideo>` (or `@remotion/media`'s `<Video>`)
styled `objectFit: contain` + the clip's transform. A filtered clip renders
**`FilteredPicture.tsx`** instead (a new file; `ClipRenderer.tsx` gets a
branch):

- One wrapper carries the clip's `transform` / opacity. Inside it, the media
  element keeps every prop it has today (audio, ramps, `trimBefore`,
  `playbackRate`) and gains `onVideoFrame={paint}`; above it a `<canvas>`
  with the **same `fill` style** (`object-fit` applies to canvas, so both
  land on the same rect) shows the result. The element stays visible under
  the canvas rather than `visibility: hidden` — the Player's
  `requestVideoFrameCallback` cadence with a hidden element is one of the
  things P0 checks.
- `paint(source)` runs `renderer.render(definition, { source, time,
  options: { intensity, parameters } })`, synchronously — once per entry,
  the filter's output canvas feeding the effect's renderer. Output canvas =
  the source's aspect, capped at the composition's size (a 4K original is
  scaled once, on the way in).
- **Render host:** `onVideoFrame(img)` fires per frame before the handle
  releases (★2) — no `delayRender` of our own. Image clips: `Img`'s
  `onImageFrame` fires ONCE per src (its effect is keyed on the src, not the
  frame), and Remotion's render pool hands a browser tab arbitrary frames of
  the clip, so the render host repaints an image from the loaded element in
  the per-frame layout effect (inside React's commit, before the screenshot)
  — without it an animated filter on a still was frozen per tab and differed
  run to run (P4 finding). Video never takes that path in a render:
  `OffthreadVideo` gives `Img` a new src every frame.
- **Player:** rVFC paints as decoded frames arrive; a frame change while
  paused repaints from the element's current frame with the `SceneMirror`
  settle trick (a draw at `seeked` can come back empty; keep drawing for a
  few frames, never blank).
- **With transitions.** Renders: a window's scene copies are `pictureOnly`
  `ClipRenderer`s, so they carry the filter — N copies, N passes, export
  only. Player: `SceneMirror` mirrors whatever `useSceneSources().source()`
  returns, today `querySelector('video, canvas')` in DOM order — it must
  prefer the filter canvas (`[data-scene-picture]` first), or the mirrors
  show the unfiltered picture through a transition.
- **Engine 3 (`layer: 'shots'`)** never mounts footage, so nothing changes.
- **Who supplies definitions.** `TimelineComposition` gains
  `filterDefinitions?: Record<string, FilterDefinition>` beside
  `transitionComponents`; `PreviewPanel` loads them with
  `useFilterDefinitions(referencedFilterKinds(timeline), retryKey)`, the
  export entry passes static imports. Undefined = today's path, untouched.
- **WebCodecs engine:** same `onVideoFrame` signature, so it works unchanged;
  not measured in v1 (the engine is off by default).

**Preview cost policy.** The SDK's contexts are `willReadFrequently`
(software raster), so `pixels()` loops and multi-pass filters cost CPU per
frame: in the lab, noir-class filters are a few ms, `pixels()` filters
~5–10 ms at 540p, bloom ~60 ms at 540p (≈15 fps). Export is frame-exact
regardless. Two knobs, both cheap: the Player runs a filter at a **working
resolution cap** (the preview is ~900 px wide; P0 picks the cap), and a
**"Filters in preview" toggle** (off → `filterDefinitions: undefined` for
the Player only). Entries the builder measures as slow carry `heavy: true`
→ the badge the transitions tab already has. *P0 outcome:* the cap is 640
and, with one paint per presented frame, all three filters and the two-slot
chain hold 30 fps in the Player — see "P0 results".

## Pack container and loader

The one container (Q8a); this slice adds `filters`:

```
<packId>/
  pack.json                 "transitions": [...], "filters": [...]
  filters/<id>.js           bundled ESM, no imports, default export = FilterDefinition
  thumbnails/<id>.png       optional — cards render live, see UI
```

```jsonc
{ "id": "noir", "name": "Noir", "tier": "common",
  "tagline": "Main character energy.",
  "description": "A punchy monochrome grade with soft cinematic edge shading.",
  "accent": "#bbc0ca", "symbol": "◐", "animated": false,
  "category": "filter",      // 'filter' | 'effect' — which gallery and which slot
  "defaultIntensity": 1,
  "parameters": [ { "key": "…", "label": "…", "type": "range", "min": 0, "max": 1, "step": 0.05, "default": 0.5 } ],
  "presets": [ { "id": "…", "name": "…", "parameters": { … } } ],
  "requires": [],            // 'faceTrack' | 'subjectMask' — none in v1
  "heavy": false, "version": "1.0.0" }
```

An entry is the add-on's `meta.json` plus `category`, `parameters`, `presets`
(the builder copies them out of the module, so the Inspector never waits for
a module — manifests are data, code is code), `requires` (from
`faceTracking` / `subjectTracking`) and `heavy`. A missing `category` reads
as `effect`. The loader **drops an entry
whose `requires` names something this build cannot supply**, with a warning,
like `minAppVersion`. Same two roots, same rules as transitions: built-ins
scan first, a duplicate pack id is skipped whole, a bad entry drops that
item, a missing root is empty. A pack with no `filters[]` is silent to this
loader (as a filters-only pack already is to the transitions loader).

Pure half `src/shared/studio/filter-pack.ts` (types, parsing, id helpers,
`referencedFilterKinds`); fs half `src/main/services/studio/filter-packs.ts`
(`listFilters`, `resolveFilter`, `readFilterSource`). Shared path helpers
already exist (`getBuiltinPacksDir`, `getInstalledPacksDir`).

**Gate** (`defaultFilterGate`): `lintShotSource` with an **empty import
allowlist** (a bundle needs nothing; `react`/`remotion` are refused too), an
esbuild compile, a 512 KB cap, and a textual refusal of `Date.now`,
`performance.now`, `Math.random`, `fetch(`, `XMLHttpRequest`, `WebSocket`,
`import(` — the AUTHORING contract's own rules, enforced. Heuristic, and the
trust model is unchanged: a pack is code that runs in the renderer, install
is the act of trust, the dialog says so.

## Delivery to the renderer and to export

The transition path, copied: channels `studio:filter:list` and
`studio:filter:module`; the handler resolves the id, gates, stores the file
on the module server, returns a URL; the renderer hook `import(url)`s it and
takes `default` when it is an object with a `render` function. Failures
resolve to null (→ plain picture); `notInstalled` stays quiet.

Export (`export-filters.ts`, wired from `export-entry.ts` like
`export-transitions.ts`): collect the kinds the serialized timeline
references, gate each, copy beside the entry as
`studio-entry-<projectId>-filter-<packId>.<itemId>.js` (the prefix keeps it
under the 24 h sweep; the `.` keeps `a-b/c` and `a/b-c` apart), emit a
`FILTER_DEFINITIONS` literal, pass it as `filterDefinitions`. A missing
pack logs and degrades; a gate failure fails the export.

## UI

- **Left pane: two tabs, Filters and Effects** (`PaneTabButton` icons
  `Palette` and `Sparkles`), each mounted only while active, like
  Transitions, and separate from it (Hasan, 2026-09-18). Both are
  `FiltersPanel` with `category` set; each lists only its category and its
  card click fills only its slot. Seven tabs when the Transcript flag is on;
  the `@container` rule already collapses inactive tabs to icons under
  400 px.
- **Cards render live**: each card is a small `<canvas>` painted by the
  runtime over one bundled demo still (the add-ons' generated portrait,
  ≤ 60 KB, in `resources/packs/core/demo/`). A static filter draws once on
  mount; an animated one loops on hover or focus (the transitions rule, for
  the same cost reason). Grouped by pack, tier chips, heavy badge, an
  Import… button.
- **Target = the selected clips** of kind video/image. A card click
  dispatches `clip-effect-set` on each (undoable, one step), replacing the
  entry of the card's category; with nothing eligible selected the panel
  says so. An "Apply to all clips on this
  track" action is one more dispatch and worth having.
- **Inspector** (`ClipSection` → new `FilterSection.tsx`): one block per
  slot (Filter, Effect): name, intensity slider, the item's knobs from the
  manifest through one generic `EffectControls` (range / color — authors
  never write UI), a presets dropdown, Enable, Remove. A slider drag live-previews through
  `overrideClipEffect` (the `overrideClipTransform` twin, ephemeral, no
  reducer dispatch per pixel); release commits one `clip-effect-update`.
- **Timeline**: an `fx` chip on filtered clips — accent = set, amber = pack
  not installed (`filter-status.ts`, the join-status pattern).
- **Preview**: the "Filters in preview" toggle beside the existing preview
  controls.
- New files only: `FiltersPanel.tsx`, `FilterCard.tsx`, `FilterSection.tsx`,
  `EffectControls.tsx`, `useFilters.ts`, `effect-ops.ts`, `filter-status.ts`.
  `EditorShell.tsx` (1536), `useTimeline.ts` (784) and `TimelinePanel.tsx`
  get wiring only.
- Flag: `studio-filters` — a dev-preview like `studio-text-edit`.

## Import — the two extensions, generalized

`.vidtsxpack` allows `filters/*.js` beside `transitions/*.tsx`; a
`.vidtsxfilter` is `filter.json` (the entry's fields + `formatVersion`,
`author`, `license`, `minAppVersion`, `files[]`) plus `<id>.js`, installed
into the reserved `imported/` pack. The P5 zip reader and staging swap are
kind-agnostic already; `transition-package.ts` (shared) and
`transition-install.ts` are not. **Generalize, don't duplicate:** a per-kind
spec `{ manifestKey, subdir, extension, gate }` drives one package module,
and the dialog lists both kinds. `imported/pack.json` carries both arrays.
*As built:* `pack-package.ts` (shared + main) and `pack-install.ts`, the
spec `PackKindSpec` with `TRANSITION_KIND` / `FILTER_KIND`, one IPC set
`studio:pack-package:*`, one `ImportPackDialog` — see "As built (P4–P5)".

Add-ons repo work (there, not here): `tools/build-filters-pack.mjs` grows
from "run `npm run package`" into a real staging step — esbuild bundle per
filter, `export default`, `parameters`/`presets` copied into the entry,
`requires` derived, `heavy` from the lab's timings — plus a per-filter
`.vidtsxfilter`.

## What waits (and why it is honest to say so)

- **9 of the 22 need per-frame analysis**: five face filters (`puppy`,
  `kitty`, `big-mouth`, `alien`, `heart-eyes` — MediaPipe landmarks) and
  four subject filters (`neon-aura`, `subject-color-pop`,
  `electric-outline`, `spotlight-subject` — a person mask). By contract they
  draw the unchanged source without tracks, so shipping them now would be
  shipping no-ops. They are Q8h category 2: a **vision analysis engine**
  that caches data tracks per asset span (the matte precedent), auto-queued
  when such a filter is applied, arriving as `faces` / `subjectMask` per
  frame. Its own design; the `requires` field is the hook.
- **13 are eligible now**: the 5 filters and 8 effects of the category
  table (`comic` and `pixel-party` are `pixels()`-heavy at 1080p and get
  measured for the badge).
- Not in this slice: stacking beyond the two slots, TSX-shot filters,
  keyframed params, an effect on its own layer spanning clips (CapCut's
  adjustment-layer placement — it would filter the composite, which per-clip
  filtering only approximates where layers overlap), a curves/LUT "Adjust" effect
  (Q9b's single-pass rule applies when that lands, not to these), the pack
  manager, drag-and-drop of package files (Electron 41 `File.path`, as for
  transitions).

## Phases

| | Scope | Done when |
|---|---|---|
| **P0** | Spike: the three definitions supplied statically through `FilteredPicture`; measure. Harness `.vidtsx-temp/p0-filters/` (the transitions kit, re-pointed) | **DONE 2026-09-22 — every check below passed; see "P0 results" for the numbers and the two decisions (cap 640, heavy badge informational).** Original bars: **Render host:** through `@remotion/renderer` over the synthetic counter clips — noir stills have R=G=B on every clip pixel; vhs at two frames differ from each other and are byte-identical across two runs; bloom's PSNR against the plain frame is in the lab's range; frames of an unfiltered clip are byte-identical to a no-filter render. **Player:** on the isolated instance at 540p proxy, fps across a filtered clip for each of the three, and for noir under a transition window (mirror shows the filtered picture); rVFC cadence with the canvas over the element; the working-resolution cap chosen. Bars: noir and vhs ≥ 24 fps; bloom recorded and sets the heavy policy |
| **P1** | Engine: `StudioClipEffect`, `filter-runtime.ts` (vendored), `FilteredPicture.tsx`, `ClipRenderer` branch, serializer field, export-spans predicate, `SceneMirror` source preference, `referencedFilterKinds` | **DONE 2026-09-24** — serializer, spans (`filter` reason, never a composite base) and chain tests added (70 green in the touched files); the P0 harness re-run **byte-identical** to `out/proto-run1/` twice (after the FilteredPicture stage-rebuild fix and after the ClipRenderer branch); `check:types` 26 / 10. See "As built" |
| **P2** | Pack loader (shared + main), IPC, `useFilters.ts`, `core` pack gains `filters/` with the three, degrade; the add-ons builder | **DONE 2026-09-24** — loader tests read the shipped core pack (three kinds, bloom's knobs/presets/heavy, every bundle through the gate); live on the isolated instance: the three list, a folder pack dropped into `<assets>/packs/` appears on the next tab open and the preview loads it without a reopen, an uninstalled kind plays plain while an installed one renders. The add-ons builder is still the harness's `bundle-filters.mjs` (the add-ons repo's is not built) |
| **P3** | Filters tab + cards, effect ops, Inspector section + generic controls + presets + ephemeral preview, timeline chip, preview toggle, flag | **DONE 2026-09-24** — CDP pass on the isolated instance, every row: card blocked with nothing selected; apply noir (disk, chip, canvas 640 px, every sampled pixel R=G=B); VHS from the Effects tab fills the second slot; an intensity drag live-previews and commits ONCE (one undo step, redo restores); bloom replaces VHS (slot rule) with noir kept; preset lands its four values and the select tracks it, a knob drag turns it to Custom; Enable off drops the entry from the Player but not the document; Inspector Remove; nine undos to a clean clip and nine redos back; panel Remove; "Apply to all clips on this track"; the image clip is filtered too (640² canvas, gray); the preview toggle empties `filterDefinitions` and restores it; degrade round trip (amber chip + "Not installed" block + plain picture → folder pack drop → chip set, preview painted → pack pulled → amber again, id kept). See "P3 results" |
| **P4** | Export copy step | **DONE 2026-09-24** — `export-filters.ts` (+ 5 tests) wired from `export-entry.ts`; real 1080p Standard exports of the live kit's `p4-filters` / `p4-plain` projects: entry copies byte-identical to `resources/packs/core/filters/*.js`, the entry imports them and passes `filterDefinitions` on the same element as `layer`; clip a frames 30/60/90 byte-identical to the no-filter export; noir frames 150/200 max channel spread 0; the noir + vhs chain over the image clip carries colour and animates (the burned-in clock reads 00:00:01 at frame 280); audio PCM md5 identical across every export. One engine fix came out of it — see "P4 results" |
| **P5** | `filters/` in `.vidtsxpack`, `.vidtsxfilter`, association, generalized package code | **DONE 2026-09-24** — `transition-package.ts` / `transition-install.ts` replaced by `pack-package.ts` / `pack-install.ts` over a per-kind spec (24 tests: the old cases + both-kinds packs, filters-only, wrong-folder files, `requires` hold-back, singles of each kind into one `imported/pack.json`); one dialog, one IPC set (`studio:pack-package:*`), one pending kind; `.vidtsxfilter` association; Import… on the Filters and Effects tabs; live: double-click installs a both-kinds pack, a single lands in `imported/`, the open tab lists it without a reopen and the Player renders the imported kind — see "P5 results" |
| **P6** | The other 10 eligible items as the `vidtsx-filters` Volume 01 pack (DECIDED 2026-09-24 — core stays at three; the transitions split); the analysis-track design for the tracked nine is "Analysis tracks" | The pack imports on the isolated instance, every card paints, `heavy` measured for `comic` / `pixel-party`, one export through the P4 checker; the file in `../vidtsx-addons/dist/` + the kit |

P0–P5 are done: slice 1 is "fully working with three", import included.

### P0 results (2026-09-18)

Harness: `.vidtsx-temp/p0-filters/` (gitignored; README inside). Nothing in
`src/` was touched — the transitions slice was still uncommitted in the
files P1 edits, so the harness carries its own `filter-runtime.ts` (the SDK's
renderer, verbatim) and a `FilteredPicture.tsx` prototype, both written to
be moved into `src/shared/studio/` by P1. Media: the transitions harness's
synthetic 1280×720@30 counter clips. Timeline: four 90-frame clips — c1
noir, c2 vhs, c3 bloom (Golden Diffusion), c4 noir+vhs (both slots).

**Bundling (★3 proven).** `bundle-filters.mjs` = esbuild over the SDK's
`dist/sdk/<id>/index.js` with `core/` inlined and `export default`: noir
1.0 KB, vhs 1.8 KB, cinematic-bloom 3.6 KB, no imports, none of the banned
globals. This is the add-ons builder's job, verbatim.

**Render host — PASSED** (`run.mjs` → `check.mjs`; stills at frames 30, 60,
100, 130, 200, 230, 300, 330; `filtered` rendered twice, `plain` once):

| Check | Result |
|---|---|
| Determinism | all 8 filtered stills **byte-identical across two runs** |
| noir (30, 60) | every pixel R=G=B (max channel spread 0); PSNR vs plain 5.9 dB (a grade, not a tint) |
| vhs (100, 130) | PSNR vs plain 23 dB; frames differ from each other beyond the source's own change (mean Δ 5.23 vs plain's 4.81) — animated on `time`, deterministic |
| bloom (200, 230) | PSNR vs plain 25.0 / 25.1 dB — a soft highlight spill, visible around the white counter and bar edges |
| chain (300, 330) | max channel spread 16 over noir's 0 — vhs's tints ride on the gray, so stage 2 saw stage 1's canvas |
| Frame accuracy | every filtered canvas shows the source frame the plain render shows (A 90, B 70, A 200, B 210) |
| Time | vhs's burned-in clock reads `00:00:02` at frame 100 (= (10 + 60 trim) / 30) and `00:00:07` at 300 — clip time is source-continuous across a trim, as designed |

Mechanism confirmed in the source: `remotion/dist/esm/index.mjs`'s `Img`
runs `onImageFrame?.(current)` and only then `continueRender2(newHandle)`,
so the synchronous draw in `onVideoFrame` is in the captured frame. No
`delayRender` of our own was needed.

**Player — functional PASSED** (`player/smoke.mjs`, Playwright Chromium over
`@remotion/player` at 896×504, run under 100% CPU from other work): each of
the four clips paints its canvas (source-sized 1280×720, sampled pixels gray
for noir and coloured for the rest), exactly one `<video>` per mounted clip,
a paused seek 95 → 125 repaints, playback repaints. First paints took
0.8–3.2 s under that load — the `<video>` element loading a 4.7 MB file,
the same wait the plain Player has, not filter cost. One prototype fix came
out of it: the settle loop now paints from the element itself before the
first `requestVideoFrameCallback`, so a paused Player straight after mount
never waits on rVFC. Seen, pre-existing: at frame 200 the Player's `<video>`
showed source counter 199 where the render shows 200 — the element's seek
landing a frame early, the Player-vs-render class of difference the
transitions P0 also recorded.

**Full renders — PASSED** (`run.mjs --media`, both 360-frame videos at
1280×720 h264, concurrency 2, under the same foreign load: filtered 260 s,
plain 180 s):

| Check | Result |
|---|---|
| Audio | decoded PCM of `filtered.mp4` and `plain.mp4` **identical** (MD5 `ec318fe3…`) — the sound path is untouched, as with transitions |
| Per-frame painting | each of the 8 frames decoded out of `filtered.mp4` sits at 35–43 dB from its filtered still and 6–25 dB from the plain one — `onVideoFrame` ran on every frame of a continuous `renderMedia`, not only in the one-frame stills |

**Player fps — first prototype FAILED the bar, the rewrite PASSED (below)** (gated run 2026-09-18 23:11,
machine quiet at load 12, Playwright Chromium, `@remotion/player` at 896×504
over the 1280×720 source, three runs per clip):

| clip | plain | filtered (first prototype) |
|---|---|---|
| noir | 30.0 fps, 0 skipped, worst gap 36 ms | **14.3 / 14.4 / 11.5 fps**, 41–46 skipped, worst gap 100–195 ms, rAF worst 100–200 ms |
| vhs | 30.0 | **13.2 / 13.3 / 13.1**, 43–44 skipped |
| bloom | 30.0 | **12.0 / 11.4 / 11.6**, 46–48 skipped |
| noir+vhs | 30.0 (one warm-up hiccup) | **8.4 / 6.7 / 7.8**, 54–60 skipped |

Diagnosis: even noir — one `ctx.filter` drawImage — sat at 14 fps with a
~100 ms rAF gap, three times what a 720p software paint costs. The first
prototype painted every playing frame up to THREE times (the frame callback,
the per-frame layout effect and the settle loop all fired) at full source
size on `willReadFrequently` canvases. Two changes, measured as separate arms
on the next quiet window: (1) one paint per presented frame — the frame
callback owns playback, the layout effect and settle serve only paused
scrubs; (2) the design's working-resolution cap in the Player
(`previewMaxSide`, default 640: the preview is ~900 px wide and plays a 540p
proxy). The re-measure ran `cap=0` (change 1 alone) and `cap=640`.

**Re-measure — PASSED** (gated run 2026-09-22 12:42, machine quiet at load
13, same protocol; plain stayed at 30.0 fps with 0 skipped in every run):

| clip | paint-once, full 720p working size (cap 0) | paint-once + cap 640 |
|---|---|---|
| noir | 30.0 / 30.0 / 30.1 fps, 0 skipped, rAF worst 16.8–33 ms | 30.0 / 30.0 / 29.9, 0 skipped, rAF 16.8 |
| vhs | 29.6 / 29.3 / 26.4, 0 / 1 / 10 skipped | 30.1 / 30.1 / 29.8, 0 skipped, rAF 16.8 |
| bloom | 29.4 / 30.3 / 30.0, 2 / 0 / 0 skipped | 30.0 / 30.0 / 30.0, 0 skipped, rAF 16.8 |
| noir+vhs | 25.1 / 23.6 / 25.2, 13–17 skipped, rAF worst up to 100 ms | 30.0 / 30.0 / 29.5, 0 skipped, rAF 16.8–33 |

Painting once per presented frame was the real fix: single filters hold
30 fps even at the full 720p working size. The cap is what carries the
two-slot chain and bloom to 30 with no skipped frames and rAF back at one
display tick. **Decisions: `previewMaxSide` ships at 640; bloom's "heavy"
badge is informational, not a warning** (the transitions' tiles outcome).
Worst presented-frame gaps of 45–86 ms remain in the filtered arms against
~35 ms plain — an occasional single late frame, never a skipped one. Not
covered: real camera footage, 1080p originals with no proxy, a slower
machine, more than two stages.

### Built first (2026-09-18 → 22, committed 2026-09-24 as bd4892f) — the new-file halves of P1 and P2

While the transitions slice stays uncommitted in the files the engine edits
(`ClipRenderer.tsx`, `TimelineComposition.tsx`, `SceneMirror.tsx`,
`serialize.ts`, `types/studio.ts`, `channels.ts`, the preload,
`resources/packs/core/`), everything that is a NEW file was built and tested:

| File | What |
|---|---|
| `src/shared/types/studio-effects.ts` | `StudioClipEffect` (the document entry) and the SDK contract types (`FilterDefinition`, `FilterRenderContext`, params, presets, faces, masks). `types/studio.ts` re-exports it once that file is free |
| `src/shared/studio/filter-runtime.ts` | The vendored renderer (★1): `createFilterRenderer`, `resolveFilterParameters`, `filterSourceSize`, `isFilterDefinition`. The exact code P0 rendered with |
| `src/shared/studio/filter-pack.ts` | Pure parser: `parseFilterPack` / `parseFilterEntries` / `parseFilterParameters` / `parseFilterPresets` (a bad spec or preset drops alone; a spec may not claim `intensity`), `isFilterSupported` (`requires` against `SUPPORTED_FILTER_REQUIREMENTS`, empty in this build), `parseFilterKind`, `referencedFilterKinds` over a structural `effects[]` |
| `src/shared/studio/filter-lint.ts` | The gate's pure half: no imports at all, a default export (esbuild's `export { x as default }` included), banned globals (clock, random, network, storage, workers, eval), 512 KB cap |
| `src/main/services/studio/filter-packs.ts` | The fs half: `scanFilterRoots` / `listFilters` / `resolveFilter` / `readFilterSource` — the transitions loader's rules, plus "held back: needs analysis" |
| `src/shared/studio/FilteredPicture.tsx` | The host component, final shape: `renderMedia({ onVideoFrame, style })` render-prop so `ClipRenderer` keeps its engine switch and every media prop; `sourceOffset` (= `trimBefore`) for the clock; the chain of stages; `data-scene-picture` on the canvas; one paint per presented frame and `previewMaxSide` (640, Player only) after the fps re-measure. The harness re-pointed at this file renders stills **byte-identical** to the prototype's, before and after the rewrite |
| tests | `filter-pack.test.ts` (15), `filter-lint.test.ts` (5), `filter-packs.test.ts` (10): 26 passing; `check:types` at baseline 26 / 10 |

(The rest — the engine wiring, the IPC, `useFilters.ts`, the core pack's
`filters/`, the P3 UI — landed 2026-09-24; next section.)

### As built (P1–P3, 2026-09-24, uncommitted)

The transitions slice had been committed (f9bb79e), so the old-file halves
went in. Where the build differs from the text above, this list wins.

**P1 — engine.**
- `types/studio.ts` re-exports `studio-effects.ts`; `StudioClip.effects?`.
  Checked: `migrateProject` passes `doc.timeline` through untouched, so an
  older build that opens and saves a filtered project keeps the field.
- `serialize.ts`: `SerializedClip.effects` on video and image clips, live
  entries only; every entry disabled = no key at all.
- `filter-chain.ts` (new, pure): `resolveFilterChain(effects, definitions)`
  — document order, disabled and definition-less entries skipped, so the
  rest of the chain still renders (the degrade rule per entry).
- `ClipRenderer.tsx`: `filterDefinitions` prop; the chain is `useMemo`'d on
  `clip.effects` + the map ON PURPOSE — `FilteredPicture` derives its frame
  callback from the chain, and Remotion's `useEmitVideoFrame` cancels and
  re-requests `requestVideoFrameCallback` (painting immediately) on every
  new callback identity, so an unstable chain would double-paint every
  frame. Video: the same tag (either engine) with `onVideoFrame`; image:
  `Img` with `onImageFrame`. Both engines' tags take `onVideoFrame` at
  4.0.435. A render's scene copies carry the filter (N copies, N passes);
  the Player's mirrors copy the filter canvas.
- `FilteredPicture.tsx`: one fix — a chain whose LENGTH changes (an effect
  added or removed live) disposes and rebuilds its stages, or the visible
  canvas stopped being the last stage. Static chains take the same path as
  before; the harness stills stayed byte-identical.
- `SceneMirror.tsx`: `source()` asks for `canvas[data-scene-picture]` FIRST,
  then `video, canvas` — a selector list returns DOM order, and the canvas
  sits after the media element.
- `export-spans.ts`: `copyBlocker` returns `'filter'` for a clip with a live
  entry, decided from the document alone (installed or not is the render's
  business; the dialog's "copies N %" must not depend on it). A shot over a
  filtered clip goes to the browser whole, never a composite base.
- `TimelineComposition` and `TransitionWindow` pass `filterDefinitions`
  through.

**P2 — delivery.**
- Channels `studio:filter:list` / `studio:filter:module`; types in
  `shared/ipc/types/studio-filters.ts` (`StudioFilterInfo` = the manifest
  entry minus the path, so the Inspector never waits for a module);
  `studio-filter-handlers.ts` (list; module = resolve → `readFilterSource`
  gate → `storeRawModule` on the module server, keyed `filter-<md5>` of the
  content so an updated pack file is a new URL — no transpile anywhere);
  preload `studioFilterList` / `studioFilterModule`; `electron.d.ts`.
- `useFilters.ts`: `useFilterList` (installed map is kind → the whole
  `StudioFilterInfo`, since the Inspector needs the knobs),
  `useFilterDefinitions(kinds, retryKey)` (`default` taken when
  `isFilterDefinition`; no `setupVirtualModuleGlobals` — a filter is plain
  Canvas code), `useEffectStatuses`, `FILTERS_CHANGED_EVENT` for P5.
- `PreviewPanel`: `referencedFilterKinds(timeline)` →
  `useFilterDefinitions(kinds, filterRetryKey)`; `filtersInPreview` off
  hands the composition `undefined`.
- `resources/packs/core/`: `filters/{noir,vhs,cinematic-bloom}.js` — the
  harness's bundles, byte-for-byte (the SDK dist is older than they are);
  `pack.json` gains `filters[]` (noir `category: filter`; vhs effect,
  animated, 0.85; cinematic-bloom effect, 4 knobs, 3 presets, `heavy:
  true`). The pack is now called **"Core"** (was "Core Transitions" — it
  holds both; version 1.2.0); two transition tests updated for the name.
- `filter-packs.test.ts` gained a describe over the REAL core pack.

**P3 — UI** (flag `studio-filters`, a dev-preview: on in dev, off in
production; the engine is NOT behind it).
- `effect-ops.ts` (new, pure, + 10 tests): `setClipEffect(clipIds, kind,
  category, categoryOf)` — the slot rule; a filter lands first, an effect
  last; re-applying a kind the clip has keeps its params and re-enables it;
  an entry of unknown category (pack gone) is left alone.
  `updateClipEffect` with `normalizeEffectParams` — the neutral rule against
  the manifest defaults (intensity clamped 0–1 and dropped at the default;
  a knob clamped to its range, a colour lower-cased, dropped at its default;
  unknown keys dropped; without defaults values pass through).
  `removeClipEffect(clipIds, kind)`; `overrideClipEffect` (the
  `overrideClipTransform` twin over the serialization).
- Reducer actions `clip-effect-set` (carries `categories`, the installed
  kind → category map), `clip-effect-update` (carries `defaults`),
  `clip-effect-remove` — each one undo step; a drag commits once on release.
- `filter-status.ts` (+ tests): `effectStatuses(timeline, installed)` → per
  clip the entries, a label ("Noir + VHS Club", "off"), and the one warning
  `not-installed` (suppressed while the list loads).
- `FiltersPanel.tsx` (one component, `category` prop, mounted once per
  tab): selected-clips header (current kind / mixed / none, Remove, "Apply
  to all clips on this track" when one clip is selected), cards grouped by
  pack, no Import… button until P5. `FilterCard.tsx`: a 256×144 canvas
  painted by the real filter over ONE demo still; static = once, animated =
  a rAF loop while hovered or focused; modules load as cards scroll into
  view. **The demo still is a renderer-bundled asset**
  (`src/features/studio/assets/filter-demo.jpg`, 17 KB, the add-ons'
  portrait at 384²) rather than `resources/packs/core/demo/` — no path
  hand-off, no asset route, one decode shared by every card.
- `FilterSection.tsx` (Inspector, single video/image clip): one block per
  entry — slot label (Filter / Effect / Not installed), name, heavy badge,
  On checkbox, Remove, intensity (%), presets select (shows the matching
  preset, else Custom), the knobs through `EffectControls.tsx` (range with
  the spec's step and unit, colour well). Sliders live-preview through
  `EditorShell`'s `effectOverride` and commit on release.
- `LeftPane`: `filters` / `effects` tabs (`Palette` / `Sparkles`), present
  only with the flag (a remembered choice falls back to Media, like
  Transcript). `TimelineClip`: the `fx` chip — accent when set, muted when
  every entry is off, amber when a pack is missing; tooltip = the names (+
  the warning). `PreviewPanel`: the Filters-in-preview toggle beside the
  rate button. `EditorShell`, `InspectorPanel`, `TimelinePanel`,
  `TimelineLanes`: wiring only.

**Not in this build (still open):** P4 export copy, P5 import + the tab's
Import… button, the add-ons repo's builder (`bundle-filters.mjs` in the
harness is the only one), a multi-selection Inspector (the panel applies to
a multi-selection; the Inspector edits one clip), `speed` in the filter
clock (v1 keeps `time = (frame + trimBefore) / fps`).

### P3 results (2026-09-24)

Isolated dev instance (`.vidtsx-temp/p0-filters/live/`: `launch.sh`, own
`--user-data-dir` so its assets root and packs never touch the real
library; `seed.py`; `drive.mjs`), project `p3-filters`: a.mp4 0–4 s, b.mp4
4–8 s (the P0 counters), the add-ons portrait 8–10 s as an image clip.
Disk (`project.json`, autosave) is the assertion; the Player's props were
read through React fibers; canvas pixels sampled from the visible
`canvas[data-scene-picture]`.

| Step | Result |
|---|---|
| Filters tab, nothing selected | panel says select a clip; the noir card is `aria-disabled`; a click writes nothing |
| select clip a → noir card | disk `[{kind:'core/noir'}]`; chip `fx` "Noir"; `filterDefinitions` = `['core/noir']`; canvas 640×360; **mean channel spread 0** over 2 376 samples |
| Effects tab → VHS Club | disk `[noir, vhs]`; chip "Noir + VHS Club"; Inspector FILTER + EFFECT blocks (85 %); spread 1.28 over the gray (stage 2 saw stage 1) |
| intensity drag 80 → 60 → 40 on VHS | the override reached the Player mid-drag (0.6 seen); disk `intensity: 0.4` once; **one Ctrl+Z** removed it; Redo restored it |
| Cinematic Bloom card | replaced VHS, noir kept (slot rule); preset select read `neutral-glass` (= the defaults) |
| preset Golden Diffusion | disk `{threshold 0.55, radius 4, warmth 0.8, strength 0.85}`; select tracked it |
| warmth drag → 0.5 | disk warmth 0.5, the rest kept; select read Custom |
| On off / on | disk `disabled: true`; Player timeline carried noir only; chip "Noir"; on → key gone |
| Inspector Remove (bloom) | disk `[noir]` |
| 9 × Ctrl+Z, 9 × Redo | disk `{}` and Undo disabled; then `[noir]` again |
| panel Remove | disk `{}`; chip gone; Inspector "No filter or effect" |
| noir + "Apply to all clips on this track" | clip-a, clip-b, clip-img all `[noir]` |
| frame 270 (the image clip) | its canvas 640×640, spread 0 |
| Filters-in-preview off / on | `filterDefinitions` `[]` and no canvas; then back |
| `p3-degrade` (clip-a `gone/whoosh` live + `core/noir` disabled) | chip amber `not-installed` "gone/whoosh"; Inspector "NOT INSTALLED" block + a disabled FILTER block; `filterDefinitions` `[]`; no canvas (plain picture); Effects tab warns |
| drop `gone/` (whoosh = a noir copy) into `<assets>/packs/` → open the tab | card `gone/whoosh` listed under "Gone Pack"; the preview loaded it (`['gone/whoosh']`), chip "Whoosh", canvas painted (spread 0) — no reopen |
| pull the pack → open the tab | card gone, chip amber again, disk still `[gone/whoosh, noir(off)]`; the loaded definition stays until the project is reopened (the transitions' rule) |

Two driver notes: the Studio project list does not rescan while mounted
(reload the page after seeding a second project), and a fiber walk that
starts from a `<video>` finds no Player at an image clip — `drive.mjs`
starts from the filter canvas or the `<img>` too.

### As built (P4–P5, 2026-09-24, uncommitted)

**P4 — export copy step.**
- `shot-export.ts`: `filterEntryRefs(kinds, projectId)` — `Filter_<n>`
  identifiers, `studio-entry-<projectId>-filter-<pack>.<item>.js` (the `.js`
  extension is the point: the entry imports the bundle as the pack ships it).
- `export-filters.ts` (new, + `export-filters.test.ts`, 5):
  `prepareFilterSources(serialized, projectId)` — `referencedFilterKinds`,
  `listFilters`, `readFilterSource` (the gate) per kind; an uninstalled kind
  logs and is left out (the clip exports plain, as previewed); a gate failure
  throws with the loader's own message + "Remove it from the timeline or fix
  the pack to export." No font rewrite, no kit pin, no transpile.
- `export-entry.ts` (wiring only): the copies are written verbatim beside the
  entry, `FILTER_DEFINITIONS` is emitted through `buildShotEntryParts`, and
  `filterDefinitions={FILTER_DEFINITIONS}` sits on the one
  `<TimelineComposition>` element that also takes `layer={props.layer}` — so
  the Engine 3 shot-layer render gets it by construction. The 24 h sweep now
  also owns `studio-entry-*.js`.
- `FilteredPicture.tsx`: the render-host image repaint (the "Composition"
  bullet above). The P0 harness stills stayed byte-identical to
  `out/proto-run1/` after it (video is unaffected).

**P5 — import, generalized.** "Generalize, don't duplicate" taken literally:
the transition-only package code is gone and one module set serves both kinds.
- `shared/studio/pack-package.ts` (new, replaces `transition-package.ts`):
  `PackKindSpec` = `{ type, manifestKey, subdir, extension, singleExt,
  singleManifest, parseEntries, maxItemBytes, unsupportedReason? }`;
  `TRANSITION_KIND` (`transitions/*.tsx`, `.vidtsxtransition`) and
  `FILTER_KIND` (`filters/*.js`, `.vidtsxfilter`, `requires` →
  `unsupportedReason`); `PACK_KINDS`; `parsePackPackageManifest` reads every
  kind a pack lists into `sections[]` (a pack must yield at least one usable
  item of any kind; a `.js` under `transitions/` or a `.tsx` under `filters/`
  is "a file it has no use for"; the size cap is per kind);
  `parseSinglePackageManifest(raw, appVersion, spec)`; `packPackageFormat`
  → `{ format: 'pack' } | { format: 'single', spec }`; `packPackageExtensions(types?)`
  for the picker. 24 tests in `pack-package.test.ts` (shared + main).
- `main/services/studio/pack-package.ts` (replaces the main
  `transition-package.ts`): `DEFAULT_PACK_GATES` — transitions = shot lint +
  esbuild `tsx`; filters = `lintFilterSource` + esbuild `js` (a compile at the
  door, like transitions); `openPackPackage` gates each item with ITS kind's
  gate and holds back a filter whose `requires` this build cannot supply;
  `planPackPackage` (per pack / per item inside its kind's array);
  `inspectPackPackage` → `InspectedPackage` whose items carry `type` plus the
  kind's own facts (duration/sceneCopies or category/animated/heavy).
- `main/services/studio/pack-install.ts` (replaces `transition-install.ts`):
  the staging swap writes every kind's subdir; `imported/pack.json` carries
  only the kind arrays that are non-empty (an absent array keeps the other
  loader silent), the entry replacing its old self inside its kind's array.
  `test-pack-package-builder.ts` replaces the transitions builder.
- IPC: `STUDIO_PACK_PACKAGE_INSPECT / INSTALL / PENDING / OPEN_FILE`
  (`studio:pack-package:*`, replacing `studio:transition-package:*`), types in
  `shared/ipc/types/studio-packages.ts`, preload `studioPackPackageInspect`
  (`pick?: PackItemType[]` narrows the OS picker to a tab's own single beside
  `.vidtsxpack`) / `Install` / `Pending` / `onStudioPackPackageOpenFile`;
  handler `studio-pack-package-handlers.ts` (test hook `VIDTSX_PACK_PICK`);
  `pending-open.ts` kind `'pack'` for all three extensions; `main/index.ts`;
  `electron-builder.yml` gains `vidtsxfilter` (and calls `.vidtsxpack` a pack
  of transitions and filters).
- Renderer: `usePackImport.ts` (replaces `useTransitionImport.ts`):
  `usePendingPackPackage`, `announcePacksChanged(types)` → the transitions'
  and/or the filters' changed event; `ImportPackDialog.tsx` (replaces
  `ImportTransitionsDialog.tsx`): sections per kind, the kind's facts per
  line, the title from the file's extension, the toast counts both kinds;
  `FiltersPanel.tsx`: the "More filters / effects" section with Import…
  (`data-filter-import`), the Transitions tab's pattern; `TransitionsPanel`,
  `StudioScreen`, `App.tsx`, `useTransitions.ts`: renames only.
- Deleted: `shared/studio/transition-package.ts` (+ test), `main/services/studio/
  transition-package.ts` (+ test), `transition-install.ts`,
  `test-transition-package-builder.ts`, `studio-transition-package-handlers.ts`,
  `useTransitionImport.ts`, `ImportTransitionsDialog.tsx`.

### P4 results (2026-09-24)

Isolated instance, projects `p4-filters` / `p4-plain` (1920×1080@30 over the
720p P0 counters: a.mp4 0–4 s plain in both; b.mp4 4–8 s noir; the portrait
8–10 s noir + vhs), Standard engine (Fast/Fastest disabled in the isolated
profile — no GPU encoder download; the Fast row's "Copies 40 %" shows the
`filter` blocker holding b and the image in the browser). Tools:
`live/p4/` (README).

| Check | Result |
|---|---|
| Entry copies | `studio-entry-p4-fix-filter-core.noir.js` / `…core.vhs.js` md5-identical to `resources/packs/core/filters/` (00edd5d5, ff8044d3); the entry imports both and passes `filterDefinitions={FILTER_DEFINITIONS} layer={props.layer}` |
| Clip a (plain in both) | decoded frames 30, 60, 90 byte-identical between the filtered and the plain export |
| Clip b (noir) | frames 150, 200: max channel spread **0** over the decoded 4:2:0 frame; PSNR vs plain 12.5 dB |
| Image clip (noir + vhs) | frames 250, 280: spread 17 (colour over gray — stage 2 saw stage 1); 250 vs 280 differ (mean 0.79) where the plain export's are byte-identical; the burned-in clock reads `00:00:00` at 250 and `00:00:01` at 280 (viewed) |
| Preview = export | the Player's own 640² canvas at 250 / 280 matches the export's frame at the SAME index better than the other (32.0 vs 30.4 dB, 31.5 vs 30.5) — the pre-fix export showed no preference (31.4 / 31.4); clip b at 150: 40.9 dB |
| Determinism | two exports of the fixed build byte-identical at every probed frame (120 → 299); audio PCM md5 identical across all exports (`c9e16722…`, Remotion's ffmpeg `-f wav`; the PATH ffmpeg's `-f md5` agrees) |

**The finding.** The first exports were nondeterministic from frame 240 (the
image clip) on: run-to-run PSNR 84 → 43 dB across the clip, and the clock
frozen at `00:00:00`. Cause, in Remotion's source: `Img` fires
`onImageFrame` from a layout effect keyed on its src (once per mount);
`premountFor` is skipped in renders; the render pool hands each tab arbitrary
frames — so each tab painted the still once, at whatever frame it first drew,
and `FilteredPicture` had its per-frame repaint disabled while rendering.
The fix is the render-host image repaint above; the tiny differences that
reached frame 240 (max 3 levels) were x264's lookahead seeing the different
future frames. Also met: the app's bundle cache reused the pre-fix bundle for
every later export of the same project (key = the entry file's hash), and a
minimized isolated window has no rAF, so the Player paints nothing.

### P5 results (2026-09-24)

Packages from `live/p5/mkpkg.mjs` (the core pack's own files, repackaged);
`dbl.sh` = a second `electron.exe` on the same profile; `p5.mjs` reads the
dialog; disk = `<profile>/assets/packs/`.

| Step | Result |
|---|---|
| double-click `fx-demo-1.0.0.vidtsxpack` (wipe-right + noir + vhs) | dialog "Import pack": "1 transition — Wipe right 0.7 s", "2 filters — Noir filter, VHS Club effect · animated", "Installs as a new pack"; Install → `fx-demo/{pack.json, transitions/wipe-right.tsx, filters/noir.js, filters/vhs.js}`, both `.js` md5-identical to core, pack.json with both arrays |
| open `p4-fix`, Filters tab | packs `core`, `fx-demo`; card `fx-demo/noir` painted; Effects tab lists `fx-demo/vhs`; `studioTransitionList` has `fx-demo/wipe-right` |
| select clip a → `fx-demo/noir` | disk `[{kind:'fx-demo/noir'}]`; Player `filterDefinitions` gained `fx-demo/noir`; canvas 640×360, spread 0 — no reopen |
| double-click `whoosh-1.0.0.vidtsxfilter` | "Import filter" · "Installs into Imported."; Install → `imported/filters/whoosh.js` (= noir) and `imported/pack.json` with `filters: [whoosh 1.0.0]` and NO `transitions` key; the open Filters tab listed `imported/whoosh` (painted) with no reopen |
| `whoosh-1.1.0` / `1.0.0` again | "Updates Imported from 1.0.0 to 1.1.0" → Update → version 1.1.0; then the downgrade box + "Install the older version" (cancelled) |
| `clock.vidtsxfilter` (Date.now) | `"Clock" cannot be installed: The filter uses Date.now(): filters are pure functions of the frame and its time.` |
| `tampered.vidtsxpack` | `transitions/wipe-right.tsx does not match its manifest hash.` |
| `fx-only-1.0.0.vidtsxpack` | installs with no `transitions` key; the transitions list is unchanged (5) |
| `fx-demo-1.1.0.vidtsxpack` | "Updates the "fx-demo" pack from 1.0.0 to 1.1.0" → Update → 1.1.0, both kinds kept; no `.installing-*` / `.replaced-*` folders left |
| the transitions Volume 01 pack | still opens in the one dialog: "19 transitions" (cancelled) |
| Import… (Filters and Effects tabs) | present; with `VIDTSX_PACK_PICK` the click opens the dialog for the picked `.vidtsxfilter` |

## Analysis tracks — how the tracked nine get in (slice 2, designed 2026-09-18, ONNX-first 2026-09-22)

Hasan asked how the face and subject filters can be applied at all. The
answer is the Q8h "vision analysis engine", scoped to what these filters
consume. Nothing built in slice 1 changes: `FilteredPicture` gains a
`tracks` prop, and the loader's `requires` gate opens as tracks become
available.

**What a tracked filter consumes per frame** (the SDK's own slots):
`frame.faces` — `Face` records (center, eyes, nose, mouth, forehead, size,
roll, mouth-open) in normalized coordinates, built by the SDK's
`faceFromLandmarks()` from MediaPipe's 478-point mesh; `frame.subjectMask`
— a person/background alpha map at ≤256 px whose `time` must equal the
source frame's time within 1 ms. The contract's rule for video: precompute
per source frame, never track live (the preview and the export must agree,
and live tracking costs 40–100 ms a frame).

**Analysis tracks = media jobs.** Two new `StudioMediaJobKind`s beside
`proxy` / `waveform` / `transcript`, cached under the project's `cache/`:

| Track | Per frame | 1 min @ 30 fps | Cache |
|---|---|---|---|
| `faceTrack` | up to 4 faces × ~12 numbers | ~300 KB JSON | `cache/analysis/<assetId>/faces-v1.json` |
| `subjectMask` | 256-px 8-bit alpha | ~66 MB raw → ~2–5 MB deflated (masks are flat blobs) | `cache/analysis/<assetId>/mask-v1.bin` + frame index |

Tracks are keyed by **source seconds** (`sourceIn + frame / fps`), so trim,
split and speed just work, and the Player (540p proxy) and the export
(original) read the same track: coordinates are normalized, and the host
re-labels a mask's `sourceWidth/Height` to whatever source it is drawn on
(same aspect by construction). Computed per asset span (the clip's
source range, extended on demand and unioned in the cache), like the matte
design.

**Who computes — ONNX in main, decided with Hasan 2026-09-22.** The first
draft ordered MediaPipe WASM in a hidden window first (the add-ons' adapters
exist) and ONNX later. Hasan asked why not the better model from the start;
the answer is that the first order optimized for integration effort, not for
the product — and for the four subject filters the mask edge IS the effect.
Two facts make ONNX the native fit: the installed `onnxruntime-node` build
ships **DirectML** (`DirectML.dll` beside `onnxruntime.dll`), and the
content-safety engine already hosts ONNX models in a utilityProcess with the
DLL-path probing solved (`src/content-safety-engine/worker.ts`).

| | ONNX in main (the plan) | MediaPipe WASM (fallback only) |
|---|---|---|
| Masks | **MODNet** portrait matting (Apache-2.0, ~25 MB ONNX), ~512 px input, true soft alpha: hair detail, no shoulder ghosts | selfie segmenter, 256 px segmentation |
| Faces | **YuNet** detector (OpenCV Zoo, Apache-2.0, ~230 KB, 5 keypoints) + the face-mesh model as ONNX (468 pts, Apache-2.0) → the SDK's `faceFromLandmarks()` unchanged, so `mouthOpen` still comes from the lips | Face Landmarker |
| Host | an analysis utilityProcess on the content-safety pattern; a media job like proxies | a hidden BrowserWindow |
| Frames in | the bundled ffmpeg, PNG over pipe at 512 px (the `image-safety.ts` trick — Remotion's ffmpeg has no rawvideo muxer); the all-intra proxy is the input | `<video>` seeking |
| Speed (to measure) | DirectML: likely 25–40 fps for MODNet; CPU fallback ~8–12 fps | CPU WASM ~10–15 fps |
| Packaging | three model files, downloaded on first use with pinned SHA-256s (the sd-cli / ffmpeg-full supply-chain story) | WASM runtime + models |
| Bonus | the same MODNet job is background removal (Q6): one investment, two features | — |

Costs of this choice: the face pipeline is two models plus crop/align glue
instead of one MediaPipe call (~2 days more), and three files to source and
pin. Given up: MediaPipe's built-in landmark smoothing — if jitter shows, a
deterministic smoothing pass over the cached track does the same (it is a pure
function of the track, so preview and export still agree).

**Spike first (1 day):** run MODNet + YuNet + face-mesh through
`onnxruntime-node` on the add-ons' 72-frame motion fixture
(`filters/.preview-capture/motion-source.webm`); measure ms/frame on CPU and
DirectML; put MODNet's mattes beside the selfie segmenter's on the same frames
(the add-ons' review scripts already make those contact sheets). A clear win
settles the plan; a surprise falls back to MediaPipe behind the same track
format.

**UX.** Applying a tracked filter auto-queues its job; the clip chip reads
"Analyzing faces… 43%" and the clip plays plain until the track lands.
Missing track = plain picture + chip, the id stays (the slice-1 degrade
rule). Export refuses to start while a referenced clip is still analyzing
(the render-prep chip pattern) — a half-analyzed export would drop the
effect silently.

**Limits, stated up front:** selfie-segmenter masks are CapCut-grade, not
rotoscope-grade (approximate hair edges; a shoulder-adjacent object can join
the mask — the add-ons' validation says so; MODNet is chosen to do better); analysis
takes minutes, disk is small; no live effect while analyzing; up to 4 faces
stored per frame where the add-ons' studio tracked one.

**Order and size:** after P1–P5. Faces first (5 filters, the tiny track), M;
masks second (4 filters, the binary track and its loader), M.

## Test plan

- **Unit:** pack parsing (bad entries, `requires`, `heavy`, params spec
  validation), id helpers, effect ops (set / update / remove / neutral
  params dropped / undo shape), serializer pass-through with `disabled`,
  export-spans `filter` reason, `filterEntryRefs` + entry emission, gate
  refusals (an import, `Date.now`, oversize), zip specs.
- **Composition:** nothing renders `TimelineComposition` in vitest, so the
  P0 harness is the structural test — re-run it after any edit to
  `FilteredPicture.tsx`, `ClipRenderer.tsx` or `SceneMirror.tsx`.
- **Live CDP:** the P3 and P4 rows.

## Decision checklist

1. First three `noir` + `vhs` + `cinematic-bloom` (one trivial, one animated,
   one with knobs): **ANSWERED — yes** (Hasan, 2026-09-18). Noir is a
   filter, the other two are effects, so the three cover both slots.
2. A separate **Filters** tab, apart from Transitions: **ANSWERED — yes**
   (Hasan, 2026-09-18).
3. One per clip in v1, schema an array: **ANSWERED — yes** (Hasan,
   2026-09-18); refined by the slot rule to one filter + one effect once
   the two categories were separated — *the refinement is this doc's
   proposal, open to veto.*
4. Video + image clips only; TSX shots later: **ANSWERED — yes** (Hasan,
   2026-09-18).
5. Items as bundled `.js` built by the add-ons repo (★3): **ANSWERED — yes**
   (Hasan, 2026-09-18).
6. The tracked nine wait on analysis tracks; the core pack ships only
   tracking-free items: **ANSWERED — yes** (Hasan, 2026-09-18).
7. `.vidtsxfilter` for singles, into `imported/`; package code generalized:
   **ANSWERED — ok** (Hasan, 2026-09-18).
8. "Are effects the same as filters? CapCut has two sections" (Hasan,
   2026-09-18) → answered by "Filters vs effects": one mechanism, a
   manifest `category`, the slot rule, two galleries. Gallery: **ANSWERED —
   C, two tabs, each separate** (Hasan, 2026-09-18).
9. P6 content, built-in vs pack for the other ten eligible items:
   **ANSWERED — the transitions split** (Hasan, 2026-09-24): core keeps
   `noir` / `vhs` / `cinematic-bloom`; the ten ship as the `vidtsx-filters`
   Volume 01 pack (see "Continue from here" step 2).

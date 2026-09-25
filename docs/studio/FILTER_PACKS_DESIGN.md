# Filter packs — pluggable per-clip filters + the Filters tab (Pack system E2, slice 1)

> Status: **all decisions answered (Hasan, 2026-09-18) — two tabs, Filters
> and Effects. P0 passed on every axis, fps included (2026-09-22). P1–P3
> COMMITTED 2026-09-24 (2f0ee49); P4–P5 COMMITTED 2026-09-24 (8b65aac) — see
> "As built (P4–P5)", "P4 results", "P5 results". P6 (content: the
> `vidtsx-filters` Volume 01 pack) BUILT and verified live 2026-09-24 — see
> "P6 results". Slice 1 is complete, content included; the tracked nine have
> their own section, "Analysis tracks"; its ONNX spike ran 2026-09-24 —
> GO, see "Spike results". Slice 2, the FACES TRACK, is BUILT and verified
> live 2026-09-24, COMMITTED 2026-09-25 (f531b98) — see "As built (faces track)" and "Faces
> track results"; the five face filters ship as Volume 02. The MASKS TRACK and
the analysis Cancel are BUILT and verified live 2026-09-25 (uncommitted) —
see "As built (masks track)" / "Masks track results"; Volume 02 1.1.0 adds
the four subject effects. The ship steps are in "Continue from here" 4.** This is
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
> 1. **Commit P6** when Hasan asks (by pathspec, never `stash`): the repo
>    diff is THIS DOC only — the pack lives outside git
>    (`../vidtsx-addons/dist/vidtsx-filters-1.0.0.vidtsxpack`, gitignored
>    there; the kit copy in `.vidtsx-temp/p0-filters/live/p6/`, gitignored
>    here). Nothing in `src/` changed; `check:types` at baseline. Suggested
>    message: `docs(studio): filter packs — P6 content, the vidtsx-filters
>    Volume 01 pack (E2)`.
> 2. **P6 — DONE 2026-09-24** (the decision stands: core at its three; the
>    other ten as ONE pack, `vidtsx-filters` "VidTSX Filters — Volume 01"
>    1.0.0 — filters `vivid`, `sepia`, `golden-hour`, `arctic`; effects
>    `comic`, `pixel-party`, `disco`, `kaleidoscope`, `film-halation`,
>    `anamorphic-streaks`). Built by the kit's `live/p6/mkpack.mjs` from the
>    add-ons `dist/sdk/` (untouched), `heavy` MEASURED by `paint-bench.mjs`
>    (comic is the one heavy item), gated, imported, every card and every
>    item exercised, one 1080p export through the checker — "P6 results". To
>    rebuild: `node paint-bench.mjs` then `node mkpack.mjs` (heavy is read
>    from the bench, never typed).
> 3. **Slice 2 (the tracked nine) — the spike is DONE 2026-09-24, verdict GO
>    for ONNX in main** ("Spike results" under "Analysis tracks": MODNet
>    29 ms a frame on DirectML at the production shape vs 263 ms on CPU;
>    faces 25 ms end to end; the selfie segmenter reproduces the add-ons'
>    shoulder-ghost failure on every sampled frame, MODNet on none; the
>    heart-eyes / puppy glue proven through the vendored runtime). Harness
>    + evidence: `.vidtsx-temp/s2-analysis/` (README; models pinned in
>    `models/source.json`, never in `resources/`). The `requires` gate is
>    wired end to end, so the build starts on the analysis side, in this
>    order — **not before Hasan says so**:
>    - **Faces track — DONE 2026-09-24, COMMITTED 2026-09-25 as f531b98
>      (the pack lives outside git).** `faceTrack`
>      job + the analysis utilityProcess + the raw-RGB ffmpeg feed + the
>      YuNet / mesh / `faceFromLandmarks` glue + the JSON track + the
>      `tracks` prop + the opened gate + chip / export refusal; Volume 02
>      (`vidtsx-filters-vol02`, the five face effects) built by the kit's
>      `live/faces/mkpack.mjs` and imported live. See "As built (faces
>      track)" / "Faces track results". **Commit when Hasan asks**, by
>      pathspec; suggested message: `feat(studio): faces analysis track —
>      the analysis utilityProcess, the faceTrack job, tracks in the
>      composition and export, chip + export refusal (E2 slice 2, F1–F6)`.
>    - **Masks track — DONE 2026-09-25 (uncommitted), with the Cancel.**
>      `subjectMask` job on the same process and feed (MODNet 896×512 on
>      DML, 352 on the CPU fallback, read from the ORIGINAL — the proxy
>      brings the shoulder ghost back); deflated 256-px blobs appended to
>      `mask-v1.bin` + `mask-v1.json` (2.7 KB/frame on the fixture); the
>      reader (Player: IPC ranges; export: the `.bin` copied beside the
>      entry, HTTP Range from the bundle server); the gate open for the four;
>      Cancel in the Inspector. See "As built (masks track)" / "Masks track
>      results". **Commit when Hasan asks**, by pathspec; suggested message:
>      `feat(studio): masks analysis track — the subjectMask job (MODNet),
>      the mask reader in the Player and export, gate + Cancel (E2 slice 2,
>      M1–M5)`.
>    - **Content — DONE:** Volume 02 1.1.0 (the nine tracked effects),
>      `live/masks/mkpack.mjs`, imported live over 1.0.0.
> 4. **Open debt (small):** package drag-and-drop (shared with transitions);
>    removing a single from `imported/`; `speed` in the filter clock; the
>    add-ons repo's real builder (the kit's `live/p6/mkpack.mjs` +
>    `paint-bench.mjs` are the only pack builder, `live/p5/mkpkg.mjs` the
>    only `.vidtsxfilter` packager); **core's `cinematic-bloom` badge** — it
>    ships `heavy: true` on the lab's ~100 ms figure, but the P6 bench paints
>    it in ~25 ms at 1080p on this machine (comic, the badged one, ~100 ms):
>    Hasan's call whether to drop it (one `pack.json` flag + one test line).
>    Added by the faces track (2026-09-25): **a Cancel for a running analysis**
>    (**DONE 2026-09-25** — the Inspector's analysis line carries it, see
>    "As built (masks track)" M4); **a Settings row for the analysis models** (they download
>    silently into `<ai-models>/analysis/`; nothing lists, sizes, deletes or
>    re-fetches them — every other downloaded model has a row); a
>    multi-selection Inspector (the panel applies to many clips, the
>    Inspector edits one); a smoothing pass over the track (jitter was
>    acceptable on the spike clip; a fast head turn on a long clip has not
>    been looked at); the chip shows the analysis text only on clips ≥ 200 px.
>    **Ship gate (decided with Hasan 2026-09-25): filters ship after the
>    masks track + the Cancel button — BOTH DONE 2026-09-25; the flag is
>    flipped and the packaged smoke passed, see "Ship steps (M6)"; the
>    volumes go on the website later (Hasan, 2026-09-25 — handled
>    separately); open: the commit, the release workflow's build heap.** Everything else in this list stays debt. Shipping also meant: flip `studio-filters` in
>    `src/shared/feature-flags.ts` (a dev-preview: on in dev, OFF in
>    production today — the engine is not behind it, the tabs and Inspector
>    are); one packaged-build smoke (`npm run build:win`) for the analysis
>    worker's DLL probe under `app.asar.unpacked` and the DirectML DLLs the
>    installer now carries — the live pass ran in dev only; and deciding
>    where Volume 01 / 02 are published (they live outside git in
>    `../vidtsx-addons/dist/` and the kit — the installer ships core's three,
>    the volumes reach users as `.vidtsxpack` files).
> 5. **Verification rules:** re-run the P0 harness (`node run.mjs 30,100,200,300
>    --runs=1` then md5-compare `out/filtered-run1/` with `out/proto-run1/`)
>    after any edit to `FilteredPicture.tsx`, `filter-runtime.ts`,
>    `ClipRenderer.tsx` or `SceneMirror.tsx`; the fps gate
>    (`player/fps-when-quiet.ps1`, Task Scheduler job `vidtsx-p0-filters-fps`)
>    after any change to the Player paint path; `npm run check:types` must
>    stay at its baseline (26 / 10 on 2026-09-24 — read it from the command,
>    not from here). The analysis worker is NOT in the node tsconfig (a
>    separate entry, like the safety worker) — type-check it by hand after an
>    edit: `npx tsc --noEmit --strict --module commonjs --moduleResolution
>    node --target es2022 --esModuleInterop --skipLibCheck --types node
>    src/analysis-engine/worker.ts`. The faces kit (`.vidtsx-temp/p0-filters/
>    live/faces/`, README "Faces additions") re-runs the port check, the
>    bench, the pack build and the live pass. Live checks: `.vidtsx-temp/p0-filters/live/` (README,
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
- **13 are eligible now — and shipped**: the 5 filters and 8 effects of the
  category table, three in core and ten in Volume 01 (`comic` measured heavy,
  `pixel-party` measured cheap — "P6 results").
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
| **P6** | The other 10 eligible items as the `vidtsx-filters` Volume 01 pack (DECIDED 2026-09-24 — core stays at three; the transitions split); the analysis-track design for the tracked nine is "Analysis tracks" | **DONE 2026-09-24** — `vidtsx-filters-1.0.0.vidtsxpack` (13.5 KB: 4 filters, 6 effects, README) built by the kit's `live/p6/mkpack.mjs` from the add-ons SDK dist, every bundle through the app's real gate; `heavy` MEASURED at 1080p (comic ~100 ms is the one heavy item; pixel-party 3–4 ms — it downsamples before its pixel loop); the ten render byte-identical across two render-host runs; on the isolated instance: double-click → the dialog lists all ten with their facts → installed byte-identical; every card paints on both tabs; each of the ten applied through its card (canvas + disk); a 1080p Standard export through the P6 checker passed every bar (entry copies byte-identical, clip a byte-identical to the plain twin, audio md5 identical). Shipped to `../vidtsx-addons/dist/` + the kit. See "P6 results" |

P0–P6 are done: slice 1 is complete — three built in, ten in Volume 01, import included.

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

### P6 results (2026-09-24)

Kit: `.vidtsx-temp/p0-filters/live/p6/` (README "P6 additions"). Source: the
add-ons' `dist/sdk/` (read, never touched). The pack:
`vidtsx-filters-1.0.0.vidtsxpack` — `pack.json` (`formatVersion` 1,
`minAppVersion` 1.1.0, `license` See README, `filters[10]`, `files[11]` with
size + sha256), `README.md`, `filters/<id>.js` (0.8–5.5 KB each; the ten
together ~21 KB). An entry = the add-on's `meta.json` + `category`
(vivid / sepia / golden-hour / arctic are filters, the six others effects) +
`parameters` / `presets` copied out of the module (film-halation 5 knobs / 3
presets; anamorphic-streaks 4 / 3, one a colour; the rest none) + `requires:
[]` (asserted: no tracking flag on any of the ten) + `heavy` measured. The
builder asserts `meta.json` equals the module on every displayed field.

**Gate.** All ten (and the core three, re-bundled beside them as calibration)
pass `lintFilterSource` + the esbuild compile (`gate.mjs`); the app's own
`studioPackPackageInspect` over the zip: 10 items, `problems: []`, "Installs
as a new pack".

**`heavy` — measured** (`paint-bench.mjs`: one `renderer.render()` at
1920×1080 through the vendored runtime in headless Chromium — the filters
repo's Playwright install, software raster — 12 timed paints after 2
warm-ups, the worst case over the add-ons' portrait AND the lab's lamp-lit
still, because a highlight filter's cost follows the highlight count; the
machine carried another repo's render job at the time, so the numbers are
relative):

| item | worst-case median paint | item | worst-case median paint |
|---|---|---|---|
| **comic** | **100 ms** | film-halation | 38 ms |
| golden-hour | 45 ms | vhs (core) | 33 ms |
| arctic | 43 ms | vivid | 31 ms |
| disco | 39 ms | anamorphic-streaks | 29 ms |
| noir (core) | 29 ms | sepia | 26 ms |
| cinematic-bloom (core) | 23 ms | kaleidoscope | 21 ms |
| | | pixel-party | 3 ms |

Rule: `heavy` = a worst-case paint of at least two 30 fps frame budgets
(66.7 ms) at 1080p → **comic only** (posterize + ink outlines + halftone:
three `pixels()` passes). **pixel-party is 3–4 ms** — the lab's
"`pixels()`-heavy" was half right: it downsamples to its chunky grid before
the loop. **Finding:** `cinematic-bloom`, shipped `heavy: true` on the lab's
~100 ms figure, paints in 23–25 ms here on both stills — consistent with
P0's own data (bloom held 30 fps at 720p uncapped) — so bloom could not be
the yardstick and the absolute bar replaced it; whether core's bloom keeps
its badge is open debt. `anamorphic-streaks` leaves the portrait untouched
(nothing above its 0.84 threshold) and paints on the lamps — content, not a
bug; the bench flags any item unchanged on every source.

**Render host** (`live/p6/harness/run.mjs`: ten 30-frame 1080p clips over
the P0 counters through the src `FilteredPicture`, one still each, twice +
plain): every still **byte-identical across the two runs**; PSNR vs plain
from 6.1 dB (kaleidoscope) to 25.6 dB (vivid), all finite.

**Live** (isolated instance via `launch.sh` — nothing else ran Electron —
the P3–P5 profile with `fx-demo` / `fx-only` / `imported` still installed):

| Step | Result |
|---|---|
| double-click `vidtsx-filters-1.0.0.vidtsxpack` | "Import pack" · "VidTSX Filters — Volume 01 1.0.0 by VidTSX · See README" · "10 filters": Vivid / Sepia / Golden Hour / Arctic "filter", Comic Book "effect · heavy", Pixel Party "effect", Disco Fever / Kaleidoscope / Film Halation "effect · animated", Anamorphic Streaks "effect" · "Installs as a new pack" → Install: `vidtsx-filters/{pack.json, filters/×10}`, every `.js` md5-identical to the build; the installed pack.json has no `transitions` key |
| Filters tab (`cards.mjs`) | packs core, fx-demo, fx-only, imported, vidtsx-filters; the four cards `ready`, 256×144, painted (every sample non-zero) |
| Effects tab | the six cards `ready`, painted; comic carries the heavy badge; the three animated ones say so |
| clip a → each filter card | disk `[vivid]` → `[sepia]` → `[golden-hour]` → `[arctic]` (the filter slot replaced), the 640×360 canvas painted after each (sepia the least saturated) |
| → each effect card | disk `[arctic, comic]` → `[arctic, pixel-party]` → … → `[arctic, anamorphic-streaks]` (the effect slot replaced, the filter kept), canvas painted after each |
| export state | clip a cleared (Inspector Remove ×2); clip b sepia + comic and the still arctic + disco through the cards; `filterDefinitions` = the four; Inspector arctic 85 % / disco 75 % (their defaults) |

**Export** (`p6-filters` vs its plain twin `p6-plain`, 1920×1080@30
Standard, ~40 s each for 300 frames; `check.py`):

| Check | Result |
|---|---|
| Entry copies | `studio-entry-p6-filters-filter-vidtsx-filters.{sepia,comic,arctic,disco}.js` md5-identical to the INSTALLED pack files and to the kit build; the entry imports the four and passes `filterDefinitions={FILTER_DEFINITIONS} layer={props.layer}` |
| Clip a (plain in both) | decoded frames 30, 60, 90 byte-identical between the exports |
| Clip b (sepia + comic) | frames 150, 200: PSNR vs plain 12.7 dB; mean R−B 33.7 / 33.8 where plain's is −3.5 / −2.2 — sepia's warmth survives comic |
| Still (arctic + disco) | frames 250, 280: PSNR vs plain 20.6 / 16.4 dB; 250 vs 280 mean |Δ| 12.1 where the plain export's is 0.000 — disco animates on time over a still |
| Audio | decoded PCM md5 identical (`c9e16722…` — the same PCM as the P4 exports: same media, same trims) |

Driver notes: `window.api.renderQueueLoad()` called mid-render runs the
queue DB's startup recovery and stamps the in-flight row "Render was
interrupted when the app closed" until the renderer's next save — a
transient lie; poll `renderQueueGet()` for activity and read the persisted
queue once idle (`wait-export.mjs`). `RenderJob.progress` is already a
percentage. Shipped: `../vidtsx-addons/dist/vidtsx-filters-1.0.0.vidtsxpack`
(gitignored there) + the kit copy; `pkgs/` holds the double-clicked copy.
Nothing in `src/` changed; `check:types` 26 / 10.

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
masks second (4 filters, the binary track and its loader), M. — Refined by
the spike below: "Build order with sizes".

### Spike results (2026-09-24)

The "Spike first (1 day)" protocol, run as written in the gitignored harness
`.vidtsx-temp/s2-analysis/` (README inside: the scripts, the order, the
lessons). Nothing in `src/` changed, no package added; `check:types` 26 / 10
before and after. **Verdict: GO for ONNX in main — both wins are clear.**

**Models, sourced and pinned** (`models/source.json`, the add-ons'
convention: url + sha256 + licence; downloaded into the harness only):

| File | Origin | Licence | SHA-256 | Size |
|---|---|---|---|---|
| `modnet.onnx` | Xenova/modnet `onnx/model.onnx` — the official ZHKKKe/MODNet checkpoint converted to ONNX (dynamic `[n,3,h,w]` in, `[n,1,h,w]` matte out) | Apache-2.0 (the repo's LICENSE fetched and kept) | `07c308cf…84df9` | 25.9 MB |
| `yunet-2023mar.onnx` | opencv/opencv_zoo `face_detection_yunet_2023mar.onnx` (fixed `[1,3,640,640]`, 5 keypoints) | **MIT** — the table above said Apache-2.0; the zoo is, the model folder's own LICENSE is MIT (© 2020 Shiqi Yu). Equally clean. | `8f2383e4…52fa4` | 233 KB |
| `face-mesh.onnx` | senty-au/face_landmarks_detector-ONNX — Google's `face_landmarks_detector.tflite` (478 pts) converted with tf2onnx 1.17.0, weights unchanged | Apache-2.0 | `7d6e82de…8beeb` | 4.9 MB |

The mesh's provenance chain is verified, not trusted: the card names the
source bundle `face_landmarker.task` sha `64184e22…` — the very file the
add-ons pin in `public/models/source.json`; unzipping a scratch copy, the
TFLite inside hashes to `c7d54204…`, exactly what the card states; the ONNX
hash matches the card. All three are third-party format conversions of
Apache/MIT originals; the production download manifest pins these hashes
(or re-exports from the official checkpoints — the build's call).

**Speed** — i7-11800H (16 threads), 64 GB, NVIDIA RTX A3000 Laptop GPU
(+ Intel UHD); Node 22.14, onnxruntime-node 1.24.3 with its bundled
DirectML. Machine load: 9 % CPU before the runs, no electron / ffmpeg /
whisper processes (`Win32_Process` checked; the only stranger was another
repo's Django dev server). Medians over 69 timed frames after 3 warm-ups,
frames extracted by the bundled Remotion ffmpeg (PNG over pipe, 640×360,
2.8 ms a frame):

| Model (input) | CPU median | DirectML median | Harness wall / frame |
|---|---|---|---|
| MODNet 896×512 — the production shape (a 540p proxy's short side → 512, /32) | 263 ms (p90 287) | **29.0 ms** (p90 29.5) | 291 / 63 ms |
| MODNet 640×352 (the fixture native, /32) | 116 ms (p90 126) | 16.4 ms (p90 17.0) | 137 / 41 ms |
| selfie segmenter 256×144 — the fallback, MediaPipe CPU delegate in headless Chromium | 14.8 ms (p90 15.6) | — | 32 ms |
| YuNet 640×640 | 5.3 ms | 3.5 ms | |
| face-mesh 256² × 2 passes (detection crop + one refine from its own points) | 24.1 ms | 13.5 ms | |
| faces end to end (decode + detect + mesh ×2 + `faceFromLandmarks`) | 40.0 ms (p90 54) | **24.6 ms** (p90 26) | |

Harness wall includes the PNG decode + resize (~10 ms) and, for masks, a
PNG matte write; the job writes a binary track. DirectML initialised for
all three models on the first try (`{ name: 'dml', deviceId: 0 }`; session
load 0.3–1.7 s vs 0.02–0.2 s on CPU) and ran on the RTX A3000 — nvidia-smi
listed the node process on it at 47 % utilisation — so `deviceId: 0` is the
high-performance adapter, not the iGPU. The two providers agree: mattes max
|Δ| 1/255 (mean 0.00), landmarks max Δ 0.06 px, `mouthOpen` identical to
four decimals. The machine-wide CPU busy figure during the CPU arms reads
60–98 % (ORT's intra-op threads spin between runs) and 14–17 % during the
DML arms — the GPU path leaves the editor its cores.

**Masks, quality** — `out/sheets/masks-contact-sheet.png` (six frames ×
original | MODNet matte | selfie mask | both cut out over flat green),
`edges.png` (the head at 3×), `shoulders.png` (the torso at 2×),
`mask-stats.json`:

- The selfie mask joins the pink plush at the right shoulder in **every**
  sampled frame — the add-ons' VALIDATION.md failure, reproduced. MODNet
  excludes it on all 72.
- Hair: MODNet's edge is a real soft gradient (true alpha — a faint light
  fringe where the matte blends background, no staircase); the selfie's is
  staircased at 256 px and chops the curls.
- MODNet vs selfie mean |Δ| 2.6/255; transition band (16 < α < 240) 1.9 % of
  pixels vs 1.4 % (MODNet's is a gradient, the selfie's is upscaling blur);
  coverage 28.3 % vs 28.7 %.
- Cache: 5.3 KB per frame deflated at 256×144 → **~9.5 MB per minute** at
  30 fps (the table above guessed 2–5; soft mattes deflate worse than binary
  masks). Still small.

**Faces, the glue** — `out/sheets/faces-contact-sheet.png` (six frames ×
Face-record overlay | heart-eyes | puppy, painted through the vendored
`filter-runtime.ts` from bundles built like P6's) and `mouth-open.png`:

- 72 / 72 frames detected, presence 1.00 throughout. The Face record lands:
  eyes on the eyes, nose, mouth, forehead where they belong, the box follows
  the roll (−11° → 0° across the clip); heart-eyes sit on the eyes, puppy's
  nose / tongue / ears on nose / mouth / forehead.
- `mouthOpen` runs 0.01–0.57 with the lips (the series is in
  `out/paint-dml/paint.json`); the puppy tongue is visibly longer at the
  widest frame (57, 0.57) than the quietest (53, 0.01). Paints are
  deterministic (the same frame twice → identical PNG).
- Jitter without any smoothing: centre motion median 1.1 px per frame, p90
  2.7, max 3.7 at 640×360 — no smoothing pass in v1.
- Track: 293 B per frame with 4-decimal rounding → ~530 KB per minute for
  one face (the table's ~300 KB assumed a numeric layout; arrays instead of
  named points get there).

**Facts the build must carry:**

1. Remotion's stripped ffmpeg has **no `fps` filter** (its V→V filters:
   colorspace copy crop fieldorder format hflip null palettegen rotate scale
   tinterlace tonemap transpose trim vflip zscale). `-r 24` on the output
   works without it; `scale=-2:min(ih\,512)` needs the escaped comma.
2. MediaPipe's crop is what makes the mesh land: the detection box centre,
   side 1.5 × max(w, h), rolled by the eye line (YuNet keypoints 0 / 1 =
   right / left eye in image space), then one refine pass from the mesh's
   own points (33 → 263 for the roll). The 478 points come back in crop
   pixels and map back through the same transform; `faceFromLandmarks`
   needs nothing else.
3. YuNet 2023mar is a fixed 640×640 input (letterbox top-left, BGR 0..255,
   no normalisation); `cls` / `obj` are already probabilities.
4. MODNet's production input is the short side at 512, rounded down to /32
   (896×512 for 16:9); the official script keeps sub-512 sources native.

**Decision.** GO for ONNX in main, faces first, then masks, as ordered above.
DirectML is the primary provider. The CPU fallback is **MODNet at short side
352** (116 ms → ~3.5 min of analysis per minute of 30 fps video), not
MediaPipe: the segmenter's 15 ms buys the shoulder ghost, and the mask edge
IS the effect. Faces are fine on either provider (25 / 40 ms). MediaPipe
WASM in a hidden window is not needed; the fallback column stays as history.

**Build order with sizes** (replaces "Order and size"; "Continue from here"
step 3 points here):

1. **Faces track — M (~3 days). DONE 2026-09-24, see "As built (faces
   track)".** `faceTrack` media job; the analysis
   utilityProcess on the content-safety pattern (a pinned download manifest
   for the three files, fetched on first use; DML → CPU fallback recorded on
   the job); the ffmpeg frame feed (`-r`, PNG over pipe, short side 512);
   the YuNet + mesh + `faceFromLandmarks` glue as in the harness's
   `faces.mjs`; a JSON track keyed by source seconds (4-decimal, ≤ 4 faces);
   `FilteredPicture` gains `tracks` → `faces` per frame; the loader's
   `requires` gate opens for the five; the chip + export-refusal UX.
2. **Masks track — M (~3 days).** `subjectMask` job on the same process and
   feed; MODNet at short side 512 (DML) / 352 (CPU); deflated 8-bit 256-px
   blobs + a frame index; the renderer-side mask loader (blob → canvas per
   frame, `time` within 1 ms, `sourceWidth/Height` relabelled); the gate
   opens for the four.
3. **Content — S.** The tracked nine as a Volume 02 (or into Volume 01 with
   `requires`) through the P6 builder.

### As built (faces track, 2026-09-24, committed 2026-09-25 as f531b98)

Where the build differs from the text above, this list wins. Everything in
`src/` here is new or additive; nothing in the add-ons repo changed; no
package was added.

**F1 — models.** `src/analysis-engine/model-manifest.ts` pins the three
files (url + sha256 + bytes + licence + origin — the harness's
`source.json`, verbatim, with ONE correction: `face-mesh.onnx` is
**4 920 995** bytes, not the 4 924 169 the harness recorded; the hash was
always right, the size was a typo — it cost the first live run, below).
`main/services/studio/analysis-models.ts` fetches a missing file through
the app's download engine (`.part` → sha256 → finalize; the job forwards
the percent as its own ticks, "Downloading face models (face-mesh.onnx)…
69 %"), verifies size + sha256 before EVERY load (cached per path / size /
mtime for the process, the `image-safety.ts` rule), deletes and re-fetches
a mismatch, and shares one in-flight download per model. They live in
`<ai-models>/analysis/` (`paths.ts getAnalysisModelsDir()` — the user's AI
models folder, never `resources/`). `audio-models.ts` resolves that folder
on first use instead of at import, so a module that merely imports
`paths.ts` touches no `app` at load — the pack tests mock `electron`
without one. No Settings surface: the app has no generic local-model
screen for ONNX files.

**F2 — the analysis utilityProcess.** `src/analysis-engine/`: `worker.ts`
(the safety worker's DLL probe; sets itself below-normal like the proxy
transcodes; `loadFaces` tries `{ name: 'dml', deviceId: 0 }` for both
sessions, falls back to `['cpu']` and reports `ep` + the DML failure line;
`faces` = YuNet → crop/align → mesh + one refine pass →
`faceFromLandmarks`, the harness's `faces.mjs` ported — `yunet.ts`,
`face-mesh.ts`, `image-ops.ts` are the pure halves; a face whose final
mesh presence is < 0.5 is dropped rather than recorded, the one deliberate
deviation), `analysis-engine.ts` (the host: lazy spawn, requestId map,
death rejects + respawn, `scheduleRelease(60 s)` after the last job so
the GPU and the process are not held by an idle editor), `types.ts`.
`shared/studio/face-landmarks.ts` is the SDK's `faceFromLandmarks`
vendored beside the runtime (★1's rule). Entry `analysis-worker` in
`electron.vite.config.mjs`. **Port check:** the app's pipeline in plain
Node over the spike's 72 frames reproduces the spike's Face records with
**Δ 0 px, mouthOpen Δ 0** on every frame (the kit's `port-check`);
18.6 ms a frame median on DML. **DirectML inside the utilityProcess
initialised first try** (`ep: 'dml'`, session load 1 403 ms) on every job
of the live pass — no fallback was ever taken; the fallback path is
exercised only by the code (`preferGpu: false` → CPU). Packaging:
`electron-builder.yml` now SHIPS the DirectML DLLs on Windows (they were
excluded for the CPU-only safety gate; the gate still opens CPU-only).

**F3 — the `faceTrack` job.** `analysis-frames.ts`: the bundled ffmpeg
over `image2pipe` with the **rawvideo ENCODER** — the stripped build has
no rawvideo muxer but its encoder rides image2pipe, so frames arrive as
raw RGB24 with nothing to decode (10 frames of 640×360 = exactly
6 912 000 bytes; the PNG route was only a way around the muxer); `-r fps`
(no `fps` filter), `scale=W:H` at short side ≤ 512 with even sides
computed up front so the byte count per frame is known; `-ss` before `-i`
per span (every proxy frame is a keyframe); one frame in flight
(stdout paused while a frame is analysed); ffmpeg below-normal.
`face-track-job.ts`: models → existing cache → `missingSpans` → per span
a grid-snapped run (start floored to the frame grid, one frame past the
end) → Face records rounded to 4 decimals keyed by `t = start + k / fps`
(5 decimals) → `mergeFaceTrack` (frames unioned by time, the new run
wins, spans merged, the header from the latest run) → `.part` + rename.
A still is one frame with `static: true`. `media-jobs.ts`: kind
`faceTrack` beside proxy / waveform / transcript — the "already there"
check is span-aware (`faceTrackSatisfying`), one analysis job runs at a
time, the ready event carries `analysis: { ep, spans, frames, fps,
fallback? }` (the job record carries the provider, as asked). IPC
`studio:analysis:request` / `:cancel` (`studio-analysis-handlers.ts`,
validated spans, the proxy's cache path resolved through
`safeResolveCachePath`), preload `studioAnalysisRequest` /
`studioAnalysisCancel`. The format, `shared/studio/face-track.ts`:
header `{ version 1, kind 'faces', source, fps, spans, ep, models
(sha256s), static?, generatedAt }` + `frames[{ t, faces }]`, one frame per
line; `parseFaceTrack` (strict), `facesAt` (binary search, nearest within
half a frame + 1e-6, a frame with no face is "no face", a gap plays
plain), `mergeSpans` / `missingSpans` / `spansCovered` (one-frame
tolerance), `settledSpanEnd`.

**F4 — the renderer and the export.** `SerializedClip.assetId` (media
clips); `TimelineComposition.tracks` (asset id → `{ faces }`) →
`TransitionWindow` scenes → `ClipRenderer` (its own asset's) →
`FilteredPicture` gains `tracks` + `playbackRate`: `sourceTime =
(trimBefore + frame × rate) / fps`, `faces = facesAt(track, sourceTime)`
into the chain (the filter clock `time` is unchanged, rate 1 in v1). The
P0 harness re-ran **byte-identical** after the edit. Export:
`export-tracks.ts` (+ `trackEntryRefs`) copies each needed asset's track
file VERBATIM beside the entry as `studio-entry-<pid>-track-<asset>.json`,
imported statically (`Track_<n>`), passed as `tracks={ANALYSIS_TRACKS}`,
with a `// analysis tracks: <asset>:<sha16>` line in the entry so the
bundle cache (keyed on the entry's hash) follows the track; a missing or
incomplete track THROWS (the backstop behind the editor's refusal). The
gate: `SUPPORTED_FILTER_REQUIREMENTS = { faceTrack }` (`subjectMask` is
still held back with the same message; the three gate tests now pin that
one); `StudioFilterInfo.requires` reaches the renderer.

**F5 — UX.** `hooks/useAnalysisTracks.ts`: the timeline's live tracked
entries → per asset the padded (±0.5 s), clamped, merged source spans
(`services/analysis-status.ts faceTrackNeeds`); a video waits for its
proxy to settle (ready or failed → the original), an image goes at once;
one request per need signature, the guard kept after an error (a retry
loop met live, below); `generating` ticks → `{ analyzing, percent,
message }`, `ready` → the track read through `studioCacheRead` into the
Player's `tracks`; `useStudioMedia` ignores the kind. `filter-status.ts`:
`EffectStatus.analysis` while the track is missing or incomplete for THAT
clip's span, warning `analysis-failed` on an error. `TimelineClip`: the
chip reads "Analyzing faces… 43 %" (the text on clips ≥ 200 px, "43 %"
below; `data-clip-fx="analyzing"`, `data-clip-fx-percent`), the tooltip
says the clip plays plain until the track lands; `FilterSection`: the same
line under the entry (`data-effect-analysis`). `EditorShell.handleExport`:
`exportAnalysisBlockers` before anything is prepared → a toast "Export
waits for face analysis: “<clip>” — Analyzing faces… 12 % — export when
it reaches 100 %", nothing queued.

**F6 — content.** `vidtsx-filters-vol02` "VidTSX Filters — Volume 02"
1.0.0: `puppy`, `kitty`, `big-mouth`, `alien`, `heart-eyes`, all
`category: effect`, `requires: ['faceTrack']`, built by the kit's
`live/faces/mkpack.mjs` (the P6 builder with `faceTrack` allowed,
`subjectMask` refused) from the add-ons `dist/sdk/` (untouched), every
bundle through the app's real gate. `heavy` MEASURED by
`live/faces/paint-bench.mjs` — the P6 bench fed the portrait's Face record
(`face-of.mjs`, through the app's own pipeline), because a face filter
paints nothing without one: **none is heavy** (1080p worst cases:
big-mouth 28 ms, alien 23 ms, puppy 12 ms, kitty 9 ms, heart-eyes 10 ms;
calibration noir 35, vhs 38, bloom 29). The pack is outside git:
`.vidtsx-temp/p0-filters/live/faces/vidtsx-filters-vol02-1.0.0.vidtsxpack`.

**Not in this build (open):** a Settings row for the models (none exists
for local ONNX files); cancelling an analysis from the UI (the IPC exists,
no button); a smoothing pass (the spike's jitter stayed acceptable);
`speed` in the filter clock (the track lookup honours it, the clock does
not — v1); the masks track.

### Faces track results (2026-09-24)

Unit: `face-track.test.ts` (11: format round trip, strict parse, spans,
merge, lookup, `settledSpanEnd`), `model-manifest.test.ts` (2: the pins,
verify size/hash/missing), `analysis-status.test.ts` (6: needs, coverage,
labels, export blockers per clip span), the gate tests re-pinned on
`subjectMask`; 134 green across the touched files; `check:types` 26 / 10
before and after. Port check: Δ 0 against the spike (above).

Isolated dev instance (`live/launch.sh`, the P3 profile; `live/faces/`:
`seed.py` → `f6-faces` 1920×1080 @ 24: `clip-talk` = the spike fixture as
h264 0–3 s, `clip-talk2` the same asset trimmed (sourceIn 1.0, 1.5 s),
`clip-img` the portrait; `seed-refuse.py` → `f6-refuse` = the 39 s
synthetic s3 clip, no face, puppy pre-applied; `drive.mjs`, `check.py` +
`paint-ref.mjs`). Disk and the Player's props (React fibers) are the
assertions.

| Step | Result |
|---|---|
| Volume 02 double-clicked (`dbl.sh`) | the import dialog lists the five, none refused (the gate opened), Install → `<assets>/packs/vidtsx-filters-vol02/` |
| Effects tab → puppy on `clip-talk` | disk `[{kind:'vidtsx-filters-vol02/puppy'}]`; chip `analyzing` "0 %" (title "Puppy Love \| Analyzing faces… 0 % — the clip plays plain until the track lands"); Inspector line the same; the Player has the definition, `tracks: null` |
| First run — models | the chip carried the download: "Downloading face models (face-mesh.onnx)… 69 %", "Verifying face-mesh.onnx…". **Bug 1, fixed:** the manifest's byte count for face-mesh was the harness's typo → my size check refused every correct download → deleted → re-fetched, and the hook cleared its request guard on `error`, so the job re-queued for ever (the log shows the loop). Fix: the pin (4 920 995) + the guard stays after an error |
| The job (after the fix) | `Face models loaded { ep: 'dml', loadMs: 1403 }`; `Face track written { frames: 75, msPerFrame: 29, faces: 75 }` — 3.083 s @ 24 in ~2.2 s wall; the file 22 318 B = **298 B/frame** (the spike's 293), `mouthOpen` 0.046–0.658, ep `dml`, both model hashes in the header |
| Player, frames 53 / 57 (mouthOpen 0.046 / 0.658) | the tongue is a stub at 53 and long at 57; ears on the forehead, nose on the nose (`out/player-053.png`, `-057.png`); vs a reference paint of the same PROXY frame with the same record: 31.6 / 31.7 dB, vs the plain proxy frame 26.2 / 25.8 (the rest is Chromium's vs ffmpeg's YUV→RGB) |
| Reopen the project | `ready` from the cache, no job; the chip `set` |
| "Apply to all clips on this track" | `clip-talk2` covered by the union — no job; `clip-img` a static track (1 frame, 121 ms incl. warm-up, `static: true`); the Player paints puppy on the still (`out/player-120.png`) |
| Export 1 (one clip) / Export 2 (three), 1080p Standard | `check.py`: the entry imports `Track_0` / `Track_1`, carries the hash line, passes `tracks=`; each track copy byte-identical to `cache/analysis/<asset>/faces-v1.json`; `puppy.js` byte-identical to the installed pack; reference paints deterministic; 7 sampled frames (3 / 36 / 68 / 75 / 90 / 104 / 126): export vs reference **29.8–37.2 dB** against **26.5–27.5 dB** vs the plain frame, **92–100 %** of the export-vs-plain difference inside the face box. (First run showed a spurious "+1 frame" at 4 of 11 samples: `-ss` at an exact frame boundary lands on the NEXT frame when the stored pts rounds a hair below it — seek to the frame's centre, `(N + 0.5) / fps`; the memory note is amended.) Bar: ≥ 28 dB and > plain + 3 dB |
| Refusal (`f6-refuse`, opened with puppy on a 39 s clip) | the job auto-queued on open; Export clicked at 12 %: toast "Export waits for face analysis: “vidtsx-s3-talk.mp4” — Analyzing faces… 12 % — export when it reaches 100 %", `renderQueueGet` empty; the chip read "Analyzing faces… 28 %" (text, the clip is wide); 1181 frames at **9 ms/frame** (no face → detector only), ep `dml`; Export after 100 % → "Export added to the render queue" |
| **Bug 2, fixed** | that clip's probed duration (39.385 s) sits a frame past its last frame (39.333 s): the need was clamped to the probe, the track's span ended at its last frame, `spansCovered` said no, and the renderer re-asked for the tail every second — 984 one-frame jobs in the log. `settledSpanEnd`: a run never settles short of what it was asked for. After the restart: opening the project ran ONE tail job (`spans [[0, 39.39]]`), the next two opens none; `f6-faces` opens with both tracks and no job |

Findings the build carries: (1) DirectML works inside the utilityProcess
(first try, every job) — the ship now bundles its DLLs; (2) the rawvideo
encoder over image2pipe replaces the PNG feed; (3) the harness's
face-mesh byte count was wrong; (4) a probed duration can exceed the last
frame's time — never let coverage depend on it; (5) frame-exact seeks in
an h264 file want the frame's centre.

### As built (masks track, 2026-09-25, uncommitted)

Where the build differs from the text above, this list wins. Nothing in the
add-ons repo changed; no package was added (Node `zlib` in, the browser's
`DecompressionStream('deflate')` out).

**M1 — the `subjectMask` job.** Same process, same feed, same job engine as
the faces track:

- `analysis-engine/modnet.ts` (the pure half): `modnetInputSize` = the
  short side AT 512 on DirectML / 352 on the CPU fallback, both sides
  rounded down to /32 — **a smaller source is scaled UP** (★ below);
  `modnetInputFrom` = `(x/255 − 0.5)/0.5` RGB NCHW; `matteToMask` = the
  matte area-averaged to the stored size (both axes, which also undoes the
  /32 stretch) and quantised to 8 bits.
- `worker.ts`: `loadMasks` / `mask` beside the faces pair — the same DLL
  probe, `loadOnBestProvider` (DML → CPU, `ep` + the DML failure line)
  shared by both groups, which load and release independently.
  `analysis-engine.ts`: loads go through the requestId map (two groups can
  no longer share the old id-less load settle); the `exit` handler is bound
  to ITS child, so a released worker's late exit cannot wipe a new one.
- `main/services/studio/mask-track-job.ts`: models (`SUBJECT_MODEL_IDS` =
  MODNet; the manifest gained a `label`, so the chip reads "Downloading
  subject model (modnet.onnx)… 43%") → the cached index → `missingSpans` →
  `loadMasks` → the feed straight at MODNet's input size (`analysis-frames`
  gained an exact `size`; ffmpeg's scaler does the resize) → per frame the
  mask, `zlib.deflate`, **appended** to `mask-v1.bin` → `mask-v1.json`
  rewritten (`.part` + rename). A compatible bin is truncated to what its
  index describes (a cancelled run's tail) and appended to; a fresh one is
  written to a part file and renamed over. A still = one frame, `static`.
- **★ Masks read the ORIGINAL, never the proxy** (faces keep the proxy).
  Measured on the spike fixture: from the all-intra CRF 28 proxy the pink
  plush at the right shoulder joins the mask on **17 of 75 frames** (up to
  31/255 mean alpha in its box); from the original on **0 of 75** — same
  code, same 896×512 input, and the app's masks are byte-identical to plain
  Node on the same input, so it is the proxy's artifacts, not the pipeline.
  The export renders the original too. A mask job therefore does not wait
  for the proxy (`useAnalysisTracks` `canStart`).
- **★ No "keep sub-512 sources native".** The official MODNet script keeps a
  source whose short side is under 512 at its own size (/32); on the 640×360
  fixture that is 640×352, and there the plush joins on 4 of 75 frames (up
  to 80/255). At 896×512 (scaled up) and at 608×352 (the CPU size) on none.
  The model card's rule — always the short side — ships.
- `mask-track.ts` (shared, pure): the index = header `{ version 1, kind
  'mask', source, mask (≤ 256 long side), input, fps, spans, ep, models
  (sha256), static?, bytes, generatedAt }` + `frames: [t, offset, length]`
  sorted by t (5 decimals). `parseMaskIndex` (strict: a mask over the cap or
  a blob outside `bytes` is refused), `maskTrackCompatible` (fps, still-ness,
  model AND mask size), `mergeMaskIndex` (the addition wins, spans merged,
  bytes the larger), `maskEntryIndexAt` (nearest within half a frame; a
  static track answers everywhere). The generic span / lookup helpers moved
  from `face-track.ts` to `analysis-track.ts` (re-exported, so the faces
  code kept its imports).
- `media-jobs.ts` (289 → 280 lines): the analysis branch moved to
  `analysis-jobs.ts` (`isAnalysisKind`, the rel path, the span-aware ready
  check, the run). The two kinds share ONE slot and the worker release.

**M2 — the mask loader.** Transport, decided here: **the Player reads byte
ranges over IPC, the render host by HTTP Range from the bundle server.**
- `shared/studio/mask-reader.ts`: `createMaskReader(index, fetchRange)` —
  `maskAt(t)` answers synchronously from a decoded LRU (360 frames ≈ 13 MB)
  or starts loading the 48-frame window around it; a window's blobs are read
  in as few ranges as they are contiguous (one per analysis run) and inflated
  one by one with `DecompressionStream('deflate')`; the second half of a
  window prefetches the next; a blob that fails is "no mask" there; `load`
  never rejects; `subscribe` fires after each window.
- Player: `services/analysis-io.ts` reads the index through `studioCacheRead`
  and the blobs through the new `studio:analysis:read-mask` (a bounded range
  of THAT asset's `mask-v1.bin`, path built in main from the asset id,
  ≤ 8 MB). Why not the asset server: the Player's server (the module server,
  port 3200) answers ANY origin with `Access-Control-Allow-Origin: *`, so
  serving `.bin` there would widen what a web page can read off the machine.
  (Checked 2026-09-25 with a `file://` + `webSecurity: true` probe — the
  packaged renderer's situation: the Player's video is NOT tainted and
  `fetch` works; the earlier worry that packaged filters could hit a tainted
  canvas does not hold for this server.)
- Export: `export-tracks.ts` → `prepareAnalysisTracks` / `writeAnalysisTracks`
  / `buildTrackEntryParts`: per asset the index copied beside the entry and
  statically imported (`MaskIndex_<n>`), the blobs COPIED beside it as
  `studio-entry-<pid>-mask-<asset>.bin` (a snapshot: an analysis extending the
  cache during the render appends to the cache, not to this file), and
  `masks: createMaskReader(MaskIndex_<n>, httpRangeFetcher("<bundle
  server>/asset?path=<the .bin>"))` in the `tracks` literal; the entry
  imports both from `@shared/studio`; the hash line gains `<asset>:mask:<sha16>`.
  The bundle server's `/asset` allowlist gained `.bin` (that server sends no
  CORS header — same origin as the render page only); the entry sweeper
  owns `.bin` too. Missing / unreadable / incomplete → the backstop throws.
- `FilteredPicture` (297 lines): the reader is used only when a stage has
  `subjectTracking`; per stage `subjectMask = { data, width, height,
  sourceWidth/Height = THAT stage's source (the media, then the previous
  canvas), time = sourceTime }`; Player: a landed window repaints the frame
  on screen; render host: a `useLayoutEffect` holds the frame with
  `delayRender` until its mask is decoded, then repaints (Remotion's `Img`
  pattern). The P0 harness re-ran **byte-identical** (4 / 4 stills).

**M3 — gate + UX.** `SUPPORTED_FILTER_REQUIREMENTS = { faceTrack,
subjectMask }`; the three gate tests pin a made-up `depthMap` as the held-back
case. `services/analysis-status.ts` is keyed by (kind, asset) — `trackNeeds`,
`clipTrackKinds`, `analysisLabel(kind, …)` ("Analyzing subject… 43%",
"Subject analysis failed: …", "Subject analysis canceled"), and
`exportAnalysisBlockers` per (clip, kind); the toast names the kind ("Export
waits for subject analysis: …"). `filter-status.ts`: the first kind that is
not ready speaks for the chip; a canceled track is a warning
(`analysis-canceled`).

**M4 — Cancel.** `services/analysis-requests.ts` is the request state
machine, pure and tested: a guard per key (the need's signature) that stays
after an error AND after a cancel (never re-asked until the need changes),
drops on ready; a need that disappears (the last tracked filter of the asset
removed) cancels a live or in-flight job and forgets its state + track;
re-applying asks again. `FilterSection` shows "Analyzing subject… 43% — the
clip plays plain until the track lands. · Cancel" (`data-effect-analysis-
cancel`); after it "Subject analysis canceled — the clip plays plain.
Re-apply the filter to analyse it." The hook also cancels a job whose reply
arrives after its need vanished (the cancel IPC can beat the async request
handler into main's queue).

**M5 — content.** `vidtsx-filters-vol02` **1.1.0** = the five face effects +
`neon-aura`, `subject-color-pop`, `electric-outline`, `spotlight-subject`,
all `category: effect` (the "Filters vs effects" table), `requires:
['subjectMask']`, built by the kit's `live/masks/mkpack.mjs` from the
add-ons `dist/sdk/` (untouched); the face bundles are byte-identical to
1.0.0's. `heavy` MEASURED by `live/masks/paint-bench.mjs` with a Face record
AND a MODNet mask (the app's code, `mask-of.mjs`) fed per source: **none is
heavy** (1080p worst: subject-color-pop 41 ms, neon-aura 29, spotlight 23,
electric-outline 19; face items 10–42; calibration noir 43, vhs 40, bloom
33). The pack is outside git:
`.vidtsx-temp/p0-filters/live/masks/vidtsx-filters-vol02-1.1.0.vidtsxpack`.

**Also changed:** the frame feed decodes ONE frame ahead of the one being
analysed (`READ_AHEAD`) — before, ffmpeg sat paused through every inference
and the job then waited 17–59 ms a frame on it.

### Masks track results (2026-09-25)

Unit: `mask-track.test.ts` (8: paths/sizes, round trip, strict parse, union
over one bin, compatibility, lookup, still), `modnet.test.ts` (7: input
sizes incl. the scale-up, normalisation, area resample, the /32 un-stretch,
clamp), `mask-reader.test.ts` (6: inflate, one read per contiguous window,
prefetch + notify, interleaved runs, a bad blob / a failing read, gap +
still), `analysis-requests.test.ts` (7: the state machine),
`analysis-status.test.ts` (7, two kinds), `filter-status.test.ts` (+3),
`shot-export.test.ts` (+1), the manifest (MODNet pin checked against the
harness file: 25 888 640 B, sha `07c308cf…` — right this time), the gate
tests re-pinned; **108 green** across the 13 touched files; `check:types`
26 / 10 before and after; the worker type-checks clean by hand.

Port check (`live/masks/port-check.mjs`, the app's code in plain Node vs the
spike): the app's MODNet run on the spike's input reproduces the spike's
mattes **byte for byte** (72 / 72, Δ 0); the stored 256×144 mask vs a sharp
resize of the same matte: mean |Δ| 0.16/255 (edges); the plush 0 on 72.
Cache: **2.7 KB a frame** on the talk fixture (≈ 4.9 MB a minute at 30 fps —
the area average deflates better than the spike's lanczos probe, 5.3 KB);
336 B a frame on the synthetic 39 s clip.

Isolated dev instance (`live/launch.sh`; `live/masks/`: `seed.py` →
`m-masks` 1920×1080 @ 24 = talk.mp4 0–3 s + the portrait 3–4.5 s, and
`m-cancel` = the 39 s synthetic clip with neon-aura pre-applied; `drive.mjs`,
`select.mjs`, `check.py` + `paint-ref.mjs`, `watch-fresh.mjs`):

| Step | Result |
|---|---|
| Volume 02 1.1.0 double-clicked over 1.0.0 | the import dialog lists nine, **none refused** (the gate is open), button **Update** → `pack.json` 1.1.0, nine bundles on disk |
| Neon Aura on talk.mp4 via the Effects tab | the chip and the Inspector carried the first-use download ("Downloading subject model (modnet.onnx)… 38%", "Verifying modnet.onnx…"), then "Analyzing subject… 43% · Cancel"; `Subject model loaded { ep: 'dml' }` |
| The track | 75 frames, **ep dml, input 896×512**, mask 256×144, 2 706 B/frame; the Player holds the reader; the painted frames show the aura round the man (`out/player-017.png`, `fresh-036.png`) |
| **The plush, through the app** | first run (proxy as input): 17 / 75 frames over 8/255 → the ★ fix; after it, from the original: **0 / 75, max 0.00/255** (the Player's own reader at the old worst frame 17: 0) |
| The portrait (a still) | one static frame, 512×512 → 256×256, coverage 0.49; the aura follows the curls (`out/player-img-090.png`) |
| Export, 1080p Standard | `check.py` **0 fails**: the entry imports both indexes + `createMaskReader`/`httpRangeFetcher`, builds a reader per asset over its `.bin` copy; index and blob copies byte-identical to the cache; `neon-aura.js` byte-identical to the installed pack; reference paints (same mask blob, same source frame) deterministic; frames 3 / 36 / 68 / 90: export vs reference **32.6–37.2 dB** against **22.4–25.1 dB** vs the plain frame |
| Cancel (`m-cancel`, 39 s) | at 11 % the Inspector's Cancel → chip `analysis-canceled` ("Its analysis was canceled…"), Inspector "Subject analysis canceled — …", the ffmpeg feed gone, **no re-queue**, the part file removed (the folder empty); Export → toast "Export waits for subject analysis: “vidtsx-s3-talk.mp4” — Subject analysis canceled — re-apply the filter to analyse it", queue empty |
| Remove / re-apply / remove mid-job | removing the entry clears the chip; re-applying re-queues ("Analyzing subject… 5%"); removing it mid-job stops the feed, writes nothing, leaves no orphan; the idle worker is released within the minute |
| Faces regression | `f6-faces`' track regenerated through the new engine: 75 frames, 25 ms/frame, **frames identical** to the pre-masks track |
| Log | no warn / error line in the whole pass; every job in it is one the pass started |

**Speed, faithfully.** Sustained, in the app, on the 39 s clip: **43 ms a
frame** wall (inference 30.2 ms median = the spike's 29, the worker 36,
the round trip 41) — ≈ 23 fps, a minute of 30 fps footage in ~78 s. A short
clip is slower per frame on this laptop: the 3 s fixture ran 125–180 ms a
frame (first frame 3.5–4.3 s of DirectML warm-up; the RTX A3000 does not
ramp its clocks for a 10-second burst — nvidia-smi showed it bouncing
P0–P8 at ≤ 24 % load, and plain-Node inference of the same model drifted
30 → 49 → 99 ms across the session with Docker/WSL active). The CPU
fallback (plain Node, 608×352): **162 ms a frame** ≈ 4.9 minutes of analysis
per minute of 30 fps video — usable for short clips, slow for long ones; it
never ran in the app (DirectML initialised every time).

**The fps gate** (`FilteredPicture` gained the mask path; gated run 12:44, load 10): the shipping arm (cap 640) held noir 30 / 30 / 29.9 and vhs 29.8 / 29.7 / 30 with 0 skipped, but bloom 27.2 / 27.6 / 23 and noir+vhs 28.6 / 28.8 / 27.8 (3–18 skipped) — below the 2026-09-22 record’s clean 30. An interleaved A/B on the same page (`?impl=head` = the committed component from `ab/`, HEAD / now / HEAD / now, `player/fps.mjs --cap=640 --filtered-only`) shows **no difference between the two components** (bloom 23–27 HEAD vs 25–30 now; noir+vhs 26–30 vs 29–30.5; noir, vhs ≈ 30 both): the shortfall is this machine today, not the change (`.vidtsx-temp/p0-filters/ab/ab-results.txt`). The P0 harness stayed byte-identical (4 / 4).

Findings the build carries: (1) the proxy's compression brings the shoulder
ghost back — masks read the original; (2) never keep a sub-512 source
native; (3) the Player's asset server answers any origin with ACAO * (a
pre-existing exposure, not widened here — noted, not fixed); (4) a DOM
node's React fiber pointer can be a stale alternate (the kit's driver read
old props and reported "no track" while the Player painted with it — the
kit now walks the current tree from the root, `live/masks/current-player.js`).

### Ship steps (M6, 2026-09-25)

**(a) The flag.** `studio-filters: true` in `src/shared/feature-flags.ts`
(comment updated: shipped after the ship gate). The Filters / Effects tabs,
the Inspector section and the preview toggle now show in production.

**(b) The packaged build and its smoke** — `npm run build` + `electron-builder
--win --publish never` (the `build:win` steps with an explicit no-publish;
no token was set anyway), smoked from `dist/win-unpacked` on its own profile
(`live/masks/launch-pkg.sh`, CDP 9334, `dbl-pkg.sh`). The smoke found three
problems before it passed:

1. **The renderer build ran out of V8 heap** at Node's default ~4 GB
   ("Reached heap limit", Rollup, 5 925 modules). Built with
   `NODE_OPTIONS=--max-old-space-size=8192` (local only, nothing in the repo).
   The release workflow (`windows-latest`, Node 22, default heap) will likely
   hit the same wall — **not changed here; Hasan's call** (the build step
   needs the larger heap). Whether this build is the first to cross 4 GB was
   not measured.
2. **The packaged app exited 1 on launch, silently.** `win.files` (and
   `mac.files`) held only `!` patterns, so electron-builder added its default
   `**/*` and packed the WHOLE repo root into the asar: `.vidtsx-temp` (504 MB
   of verification kits, spike models, test media), `src`, `docs`, report
   HTML — a 1.29 GB asar (installer 814 MB) whose `package.json` Electron read
   back as garbage, so it never found `main`. Fixed in `electron-builder.yml`:
   both platform lists now start with `out/**/*` and `src/**/*`.
3. **`src/` must be in the asar — the Studio export has never worked
   packaged.** The export bundles its entry at export time and aliases
   `@shared` / `@features` / `@renderer` to `<app.asar>/src/…`
   (`bundle-worker.ts`); the installed May build's asar holds only `out`,
   `node_modules`, `package.json`, and the export failed "Can't resolve
   '@shared/studio'". `src/**/*` (9.4 MB) ships now. Every Studio export in
   an installed build was affected, not just filters (the only packaged
   builds in `dist/` predate the Studio flip).

After the fixes: asar 747 MB (`out`, `node_modules`, `package.json`, `src`),
installer `dist/VidTSX-Studio-Setup-1.1.0.exe` **345 MB** (1.0.0: 334 MB).

| Packaged check | Result |
|---|---|
| Launch (file:// renderer from `app.asar/out/renderer`) | starts; isolated profile, own models folder (the three pinned files copied in, verified by size + sha before load) |
| Volume 02 1.1.0 double-clicked | nine listed, none refused, installed |
| **The worker's DLL probe under `app.asar.unpacked`** | the analysis process loaded `resources\app.asar.unpacked\node_modules\onnxruntime-node\bin\napi-v6\win32\x64\onnxruntime.dll` **and `DirectML.dll`** from there |
| Subject filter (`pk-masks`, neon-aura, opened pre-applied) | `Subject model loaded { ep: 'dml' }`; talk 75 frames at 896×512 (first frame 11 s — a cold DirectML compile in a fresh profile), the still 1 frame; the Player paints the aura (`out/pkg-036.png`), the reader (over IPC) hands frame 17 with the plush at 0 |
| Face filter (`pk-faces`, puppy) | `Face models loaded { ep: 'dml' }`; 75 / 75 frames with a face, the still 1; the Player paints ears / nose / tongue at the widest mouth (`out/pkg-puppy-057.png`) |
| Packaged export, 1080p Standard, `pk-masks` | done; `check.py` (ENTRY_DIR = the install's `resources/.vidtsx-temp/studio`) **0 fails** — the same 32.6–37.2 dB vs 22.4–25.1 dB as the dev export; the render host read the `.bin` copy by HTTP Range |
| Log | the updater can't find `app-update.yml` in a `--dir` output (the NSIS build writes it) and a built-in preset seeding race warns — both unrelated to filters |

**(c) Where Volume 01 / 02 are published — ANSWERED (Hasan, 2026-09-25): on
the website, later, handled separately — not part of this ship** (they live
outside git: Volume 01 in `../vidtsx-addons/dist/`, Volume 02 1.1.0 in the
kit `live/masks/`; the installer ships core's three).

## Test plan

- **Unit:** pack parsing (bad entries, `requires`, `heavy`, params spec
  validation), id helpers, effect ops (set / update / remove / neutral
  params dropped / undo shape), serializer pass-through with `disabled`,
  export-spans `filter` reason, `filterEntryRefs` + entry emission, gate
  refusals (an import, `Date.now`, oversize), zip specs.
- **Faces track (unit):** the format (round trip, strict parse, merge,
  lookup within half a frame, `settledSpanEnd`), the manifest pins and the
  integrity check, needs / coverage / export blockers, the gate opened for
  `faceTrack` and closed for `subjectMask`.
- **Masks track (unit):** the index format (paths, sizes, strict parse, the
  union over one append-only bin, compatibility incl. the mask size, lookup,
  still), MODNet's input size / normalisation / area resample, the reader
  (one read per contiguous window, prefetch, a bad blob, a failing read), the
  request state machine (guards after error and cancel, cancel on removal),
  two-kind needs / labels / blockers / chip, the gate opened for
  `subjectMask` with `depthMap` as the held-back case.
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
   Volume 01 pack. Built and verified 2026-09-24 ("P6 results").

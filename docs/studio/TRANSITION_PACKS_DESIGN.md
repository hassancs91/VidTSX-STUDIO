# Transition packs — pluggable transitions + the Transitions tab (Pack system E1)

> Status: **decisions answered (Hasan, 2026-09-17). All uncommitted as of
> 2026-09-18: P1 engine built; P0 done both halves — Structure A stands for
> renders, the Player uses scene mirrors (A's window-start seam flashed black);
> P2 built and verified live; P4 built and verified with a real export; P3 (the
> Transitions tab) built and CDP-verified 2026-09-18; Player fps measured on a
> quiet machine 2026-09-18 (30.0 / 29.9 across the two windows); P5 (the two
> import formats) built and CDP-verified 2026-09-18. P6 (the content split)
> answered 2026-09-22 and BUILT + verified live the same day: four everyday
> transitions in `core`, nineteen in the importable `vidtsx-transitions` pack
> — see "Content split (P6)". Every phase is built; nothing is committed** —
> see "Phases". This is
> row 9 of the V1 build order in `docs/NEXT_FEATURES_DESIGN.md` and the
> implementation design for its §Q8a/§Q8b. It lifts the "transition packs: NOT
> a pack type yet" line in `PACKS_DESIGN.md`. `TRANSITIONS_DESIGN.md` (Slice E)
> stays the reference for the document invariant, prune rules and handle
> geometry — none of that changes here.
>
> What is new since Q8b was written: 25 authored, machine-verified transitions
> exist in the sibling repo (`../vidtsx-addons/transitions/`, contract in its
> `AUTHORING.md`). They fix the component contract, and three Q8b decisions
> change because of them (marked ★).

## What ships

A **Transitions** tab in the editor's left pane: a gallery of transitions with
live previews; select a join on the timeline, click a card, it applies. Built-in
transitions ship as the `core` pack; more arrive as files the user imports —
a pack (`.vidtsxpack`) or a single transition (`.vidtsxtransition`).

First milestone is deliberately two transitions, end to end (preview, export,
undo, degrade), before any content work:

- `push-left` — one copy of each scene. Proves the pipeline.
- `staggered-tiles` — mounts the outgoing scene 24 times. The worst case; if it
  previews acceptably, everything does.

*(2026-09-22: `staggered-tiles` moved out of `core` and into the pack in P6 —
see "Content split (P6)".)*

## Decisions that differ from Q8b (★)

1. ★ **The contract is the add-ons' contract, not Q8b's sketch.**
   `outgoing`/`incoming`, not `exiting`/`entering`; no `params`, no `fps` in
   v1. Twenty-five components are written and verified against it
   (determinism, clamping, byte-identical endpoints in three aspects). `params`
   returns later as an optional prop when the first transition needs a knob.
2. ★ **No schema v2, no id migration.** `kind` widens to `string`. The bare
   ids `crossfade` and `dip-to-black` stay valid forever and stay
   engine-native; pack transitions are namespaced (`core/push-left`). Reason:
   `migrateProject` rejects any document whose `schemaVersion !== 1`, so a bump
   makes every newly saved project unopenable in an older install. Without a
   bump an older build already degrades an unknown kind to crossfade geometry
   (`serialize.ts` treats every non-dip kind as an overlap) — graceful, free.
3. ★ **No `@remotion/transitions` wrappers for the core pack.** Its
   presentations wrap each scene separately (`presentationDirection`), which is
   a different contract, and `shot-lint.ts` rejects the import. The authored
   set replaces the planned wipe/slide/zoom/flip wrappers.

Deferred out of row 9, unchanged in intent: luma-matte wipes; reserving the
`keyframes` / `effects[]` schema shapes (nothing here blocks them — both are
additive optional fields).

## Contract

```ts
export interface TransitionRuntimeProps {
  outgoing: ReactNode;   // leading clip's picture
  incoming: ReactNode;   // trailing clip's picture
  progress: number;      // linear 0→1 across the overlap; the component eases
  width?: number;        // composition pixels
  height?: number;
  accent?: string;       // decorative edge/light colour
  background?: string;   // backing colour behind 3D motion and dips
}
```

Default export, one file, imports `react` only (`remotion` allowed). Host
obligations, all from the add-ons' `AUTHORING.md`:

- **Scene nodes are picture-only.** A transition may mount a scene many times,
  so the nodes the host hands over are muted and side-effect free. Audio is
  rendered once, outside the component.
- **`progress = frame / overlapFrames`** inside the window — the sampling the
  native crossfade ramp already uses, so both kinds line up frame for frame.
- **`background: 'transparent'`.** On the master lane the composition's black
  shows through; on an overlay lane the tracks underneath do. An opaque
  backing would blank every lower track for the length of the transition.
- `accent` is omitted in v1 (component default). Brand accent through the
  serializer context is a follow-up.

## Document model

```ts
/** 'crossfade' | 'dip-to-black' (engine-native), or a pack transition's
 *  namespaced id `<packId>/<itemId>`. */
export type StudioTransitionKind = string;
```

`StudioClipTransition` is otherwise unchanged (`{ kind, duration }` on the
leading clip). `setTransition`, `pruneTransitions`, `splitClip`, the ripple ops
and `export-spans.ts` are already kind-agnostic. **Degrade rule (Q8d):** an id
whose pack is not installed renders as a crossfade and the join shows a warning
state; the id stays in the document, so reinstalling restores it. Never strip,
never fail the load.

## Serializer — almost nothing

`computeAdjustment` already has the right shape: `dip-to-black` is the one
in-place kind (no handles, no overlap); every other kind takes the overlap
path. Pack transitions need both clips live across the window, which is exactly
crossfade geometry, so the only edits are the `kind` type on
`BoundaryAdjustment` / `SerializedTransition`. A manifest-declared
`geometry: 'in-place'` is reserved, not built.

## Composition — the one hard part

Today each clip is one `<Sequence>` + `ClipRenderer`, and a video clip's sound
rides inside its `<OffthreadVideo>`. A both-scenes wrapper collides with that
three ways: copies of a scene would multiply its audio and its decoders; moving
a clip's element into a wrapper when the window opens remounts it (a remounted
video flashes black for the length of a seek); and a clip with a transition at
both ends cannot live inside one wrapper.

**Structure A — audible spine + muted window (build this first):**

- Every clip keeps today's full-length `<Sequence>` — the **spine**. It carries
  the clip's audio with the existing ramps, untouched, for the whole extended
  clip. While a component window covers it, only its picture is hidden.
  Consequence: **the audio path does not change at all** — preview, the
  browser export, and the `export-audio.ts` mirror all still see exactly one
  audible instance per clip.
- Each component boundary adds one **window**: `<Sequence from={windowStart}
  durationInFrames={overlap} premountFor={margin}>` holding the transition
  component. `outgoing` / `incoming` are muted renders of the two clips, each
  inside a nested `<Sequence from={clip.from − windowStart}>` so the clip keeps
  its own clock and `trimBefore` is not recomputed (the negative-offset trick
  tsx shots already use).
- Seams: at window start the picture hands from the spine to a premounted copy
  parked on that exact frame — the mechanism that already makes every hard cut
  seamless. At window end it hands back to the trailing spine, which has been
  playing hidden through the window, so it is already in sync.
- Cost: during a window each side decodes twice (hidden spine + visible copy);
  a multi-copy transition adds N more. Windows are ~0.7 s and proxies are
  540p all-intra, but the default decoder is only comfortable to ~3 concurrent
  video elements (T2, `PREVIEW_TESTS_PLAN.md`), so **this is what P0 measures.**
- Unresolved component (pack missing, module failed) → no window is built and
  the existing crossfade ramps apply. That is the degrade rule, for free.
- `layer: 'shots'` (export engine 3): a window is built only when both of its
  clips survive the layer filter.

Fallbacks if A fails P0, in order: **B** — one decoder per scene, extra copies
are `<canvas>` mirrors fed by `onVideoFrame` (same signature on both media tags
at our pin); **C** — policy: multi-copy transitions are marked heavy, preview
may drop frames, export stays exact (the Q8c stance on heavy effects).

**What P0 chose (2026-09-17): A for renders, B in the Player — with no extra
decoder at all.** A failed its Player bar at the window START, for both
components and independent of load: Remotion premounts a Sequence frozen at its
first frame, so the window premounts at `progress = 0`, where both core
components short-circuit (`return <div>{outgoing}</div>`). On the window's
second frame they return a different tree, React remounts every scene
`<video>`, and a fresh element has nothing to paint. B needed no new decoder:
the clip's own spine is mounted, in sync and decoding through the whole window
already. `SceneMirror.tsx`:

- `TimelineComposition` provides a `SceneSourceContext` only when
  `useRemotionEnvironment().isPlayer && !isRendering` and some track has a
  window. Renders never see it, so their DOM is byte-for-byte Structure A.
- A covered clip's video element is wrapped in a layout-neutral
  `SceneSourceSlot`, which registers it by clip id. Only covered clips get the
  wrapper.
- A `pictureOnly` video scene renders `<SceneMirror>`, a `<canvas>` painted
  from the slot's `video` (or the WebCodecs engine's `canvas`). It paints in a
  layout effect on every render, so a remounted copy paints before it is
  shown, and again on each rAF after the source's time changes.
- It keeps redrawing for 8 frames after every change. Measured: a `drawImage`
  made at `seeked`, with `readyState` 4, can return transparent pixels; the
  frame arrives a paint or two later. Drawing over the old picture never
  blanks it.
- Image and TSX scenes still render as copies (no decode cost).

Colour: on this machine a `<video>` element shows saturated primaries shifted
from their decoded values (pure blue shows as 28,34,245), the same with BT.709,
BT.601 and untagged files. A canvas `drawImage` returns the decoded values
(35,68,102 against ffmpeg's 33,66,101 on real footage). The mirrored picture
is therefore the one closer to the decode, and a subtle colour step at the
seams is possible on saturated content. It was not visible in the seam captures.

File budget: `TimelineComposition.tsx` was at 300 lines. `ClipRenderer` and the
ramp helpers moved to `ClipRenderer.tsx`; the window is `TransitionWindow.tsx`;
which boundaries get a window, and what each window covers, is the pure
`transition-windows.ts` (`planTransitionWindows`, `coverByClip`, `isCovered`).
The planner re-matches the two sides of a boundary instead of trusting array
adjacency — the serializer drops clips it can't render, so a clip's neighbour
is not always its partner.

Audio curve: both `volumeProp` and `export-audio.ts`'s `clipVolumeAt` test
`kind === 'crossfade'` for equal-power. That flips to `kind !==
'dip-to-black'`, so every pack transition gets the equal-power handoff. The two
functions must change together (the mirror comment says so).

## Pack container and loader

One container for every future kind (Q8a); this slice implements `transitions`.

```
<packId>/
  pack.json
  transitions/<id>.tsx
  thumbnails/<id>.(jpg|mp4)     optional — cards render live, see UI
  README.md                     optional
```

```jsonc
{
  "formatVersion": 1,
  "id": "core",                 // ignored — the folder name is the id
  "name": "Core Transitions",
  "version": "1.0.0",
  "author": "VidTSX", "license": "…", "minAppVersion": "1.1.0",
  "transitions": [
    { "id": "push-left", "name": "Push left",
      "description": "The next scene pushes the current scene off screen.",
      "usage": "Walkthroughs, lists, and sequential stories.",
      "durationSeconds": 0.7, "tier": "common", "sceneCopies": "single",
      "version": "1.0.0" }
  ],
  "files": [ { "path": "…", "size": 0, "sha256": "…" } ]   // zips only
}
```

An entry is the add-on's `meta.json` plus `sceneCopies: 'single' | 'multi'`
(drives the heavy badge and any P0 policy). Two roots, caption-loader rules:
built-ins at `resources/packs/<packId>/` (new `extraResources` block), installs
at `<libraryRoot>/packs/<packId>/`. Built-ins scan first; a duplicate pack id
is skipped whole; a bad entry or a missing file drops that one item; a missing
root is empty, not an error. `minAppVersion` is **enforced** here (the caption
loader parses it and never compares — `compareAgentVersions` is the
comparator). The caption loader keeps skipping these folders (no
`type: 'caption-style'`); caption packs move into the container whenever
convenient, not in this slice.

Pure half `src/shared/studio/transition-pack.ts` (types, parsing, native-kind
set, id helpers shared with `caption-pack.ts`); fs half
`src/main/services/studio/transition-packs.ts` (`listTransitions`,
`resolveTransition`). Path helpers `getBuiltinPacksDir()` and
`getInstalledPacksDir()` replace the three inlined `path.join(getLibraryRoot(),
'packs')`.

*As built (P2):* `getBuiltinPacksDir()` is in `paths.ts`, but
`getInstalledPacksDir()` is in `library-paths.ts`, beside `getLibraryRoot()`.
`library-paths.ts` already imports `paths.ts`, so the other way round would be
an import cycle. `INSTALLED_PACKS_DIR` is gone. A caption pack in the shared
installed root has no `transitions[]` and is skipped silently. A pack whose
`formatVersion !== 1` is skipped with a warning. The fs half also exports
`readTransitionSource(item)`, the import gate shared by the module handler and
the export step.

## Delivery to the renderer and to export

The caption path, copied: channels `studio:transition:list` and
`studio:transition:module`; the handler resolves the id, transpiles with
`transpileTsxCached`, stores on the module server, returns a URL; the renderer
hook runs `setupVirtualModuleGlobals()` then `import(url)`; failures resolve to
`null` (→ crossfade). `TimelineComposition` gains `transitionComponents?:
Record<string, ComponentType<TransitionRuntimeProps>>` beside `components` and
`captionComponent`. File paths never reach the renderer.

One deliberate difference from captions: `lintShotSource(source, {
requireCompositionConfig: false })` runs at **module resolve**, not only at
export, so a file that breaks the import rules never executes. Trust model is
unchanged and inherited: a pack is code that runs in the renderer, install is
the act of trust (the agents precedent), the install dialog says so.

Export (`export-entry.ts`): collect the kinds the serialized timeline
references, `prepareTransitionSource()` per kind (transpile check + lint, a
missing pack logs and falls back to crossfade, a lint failure fails the
export), copy each beside the entry as `studio-entry-<projectId>-transition-
<packId>-<itemId>.tsx` (the prefix keeps them under the 24 h sweep), emit a
`TRANSITION_COMPONENTS` literal and pass it as `transitionComponents`.

*As built (P2 + P4):*

- **Who supplies the components.** The preview's are supplied by
  `PreviewPanel.tsx`, not `EditorShell`:
  `useTransitionComponents(referencedTransitionKinds(timeline))` from
  `hooks/useTransitions.ts`, the same place shot modules are subscribed, so an
  arriving module re-renders the preview only. The hook returns `undefined`
  until something loads, so a timeline without pack transitions takes exactly
  its old path.
- **Not installed.** The module response carries `notInstalled: true` for an
  uninstalled kind, so the hook stays quiet about it. A gate or transpile
  failure is logged instead.
- **Copy names.** They are `studio-entry-<projectId>-transition-<packId>.<itemId>.tsx`,
  with a `.` between the halves, and the import identifiers are positional
  (`Transition_0`, …). A slug can't contain a `.`, whereas dash-joining lets
  `a-b/c` and `a/b-c` collide.
- **Where the code lives.** The step is `prepareTransitionSources()` in
  `export-transitions.ts`, and `export-entry.ts` got wiring only. The pure refs
  are `transitionEntryRefs()` in `shot-export.ts`, emitted through the
  existing `buildShotEntryParts`.
- **IPC types.** They live in `shared/ipc/types/studio-transitions.ts`.

## UI

- **Left pane, one more tab** (`LeftPane.tsx`): Media | Shots | Captions |
  Transitions — and a FIFTH once text editing's flag-gated Transcript tab is
  on (built 2026-09-17, uncommitted at the time of writing). Mounted only
  while active, like Captions, because cards load modules. **Open UI item:**
  `PaneTabButton` is `flex-1 truncate` at 11 px, so five text tabs in the
  300 px default pane get ~52 px each and "Transitions" / "Transcript"
  truncate (worse at the 220 px minimum). Give the tab button an optional
  icon so identity survives truncation; settle against `UI_SPEC.md` in P3.
- **Cards** run a small looping `<Player>` of the real component over two
  generated demo scenes, lazy-mounted by `IntersectionObserver` (the
  `GalleryCard` pattern). Packs therefore need no preview media. Grouped by
  pack; multi-copy entries carry a "heavy" badge.
- **Target = the selected join.** New renderer-side (non-undoable)
  `selectedJoinId` in `useTimeline` beside `selectedClipIds` — the leading
  clip's id, self-pruning when the boundary stops being contiguous. Clicking a
  join button selects it. A card click dispatches the existing
  `transition-set` with the card's `durationSeconds`; with no join selected the
  panel says so instead of guessing. A single selected clip with a contiguous
  next clip counts as its out-join.
- **Panel header** for the selected join: current transition, a duration
  field, Remove.
- **Join menu** keeps Crossfade / Dip to black / Remove and gains "More
  transitions…" (selects the join, opens the tab).
- **Not enough media.** With no source handles a transition serializes to a
  hard cut, silently. Two whole clips back to back is the most common timeline
  there is, so in a gallery this reads as "nothing happened". v1: the join
  renders a warning state with a tooltip naming the fix (trim the clips to
  leave room). Freeze-frame fill is the follow-up.
- Drag a card onto a join: **later**, once the feature is stable (Hasan).
- New files only: `TransitionsPanel.tsx`, `TransitionCard.tsx`,
  `transition-demo-scenes.tsx`, `useTransitions.ts`. `EditorShell.tsx` (1467),
  `TimelinePanel.tsx` (645) and `useTimeline.ts` (726) are over budget already
  and get wiring only.

*As built (P3, 2026-09-18):*

- **Tabs.** `PaneTabButton` takes an optional lucide `icon`: Media `Film`,
  Shots `Clapperboard`, Captions `Captions`, Transcript `ScrollText`,
  Transitions `Blend`. The active icon tab takes its natural width, so its label
  never truncates. The tab row is a CSS `@container`, and below 400 px the
  inactive icon tabs show only the icon (plus the count). The label stays in
  `title` and `sr-only`.
  The active icon takes `--accent-purple-light`, per the UI_SPEC sidebar rule.
  The right pane has no icons, so it is unchanged.
- **Cards rest on a still and loop on hover or focus.** This departs from
  "looping". Measured on the isolated instance: four always-looping cards cost
  1.2 cores, about 0.25 per card against about 0.06 for a caption card. Still
  demo scenes only brought that to 0.95. At rest the tab now costs 0.06 cores
  (the Media tab: 0.06–0.1), and hovering the 24-copy tiles card costs 0.29.
  The still sits 35% into the first transition (`cardPosterFrame`), because a
  dip's midpoint is plain black. A card
  still mounts its Player only while on screen.
- **Basic section.** Crossfade and Dip to black are cards too, above the packs,
  with stand-in demo components (`NATIVE_CARDS`; the engine still renders them
  natively). So a join can go back to a native kind from the tab.
- **Targeting.** `joinTarget()` in `transition-ops.ts`: the clicked join, else a
  single selected clip's out-join. Selecting clips clears the join; selecting a
  join clears the clips, so Delete never acts on a clip the user stopped
  looking at. It prunes on every commit (`isJoin`): unknown clip, locked track,
  or no contiguous next clip. Undo and redo leave it alone.
- **Join click.** With the tab closed, a click selects the join AND opens the
  menu (Crossfade / Dip / "More transitions…" / Remove). With the tab open, a
  click only selects, because the tab is the picker. Right-click always opens
  the menu.
- **Join states** (`join-status.ts`, from the serializer's own
  `transitionSpanFrames`): ghost = none; accent = set; amber fill = pack not
  installed (plays as a crossfade); amber outline = not enough media (plays
  as a hard cut). The tooltip names the transition, its length and any
  warning. A join more than a frame short of its length gets a "plays N s"
  line (`short`). The not-installed warning waits for the first list, so it
  never flashes on open.
- **One list.** `useTransitionList()` lives in `EditorShell`. It feeds the join
  squares and the tab, and the tab calls `refresh()` on every open (a folder
  drop still shows up without reopening). `useJoinStatus()` derives the
  statuses and the tab's target.
- **Sound-only joins.** On an audio or sfx pair, the pack cards are blocked and
  say to use Crossfade or Dip, because a pack transition there would play as
  a crossfade anyway. This path is unit-tested, not driven live.
- **A reinstalled pack comes back live.** `useTransitionComponents(kinds,
  retryKey)` used to cache a failed kind for the life of the editor. Now it
  drops failed kinds when `retryKey` changes. The preview (`PreviewPanel`'s
  `transitionRetryKey`) and the cards both pass the installed list, so a pack
  that reappears on the next re-scan renders without a reopen. A kind that
  loaded stays loaded after its pack is removed, until the editor remounts.
  That is harmless, and the join still warns.

## Import — two extensions

Both are zips read through `openZipPackage` (`packages/zip-reader.ts`: manifest
is the allowlist, zip-slip checked twice, declared size = actual, every file
hashed), both get an `electron-builder.yml` file association and a kind in
`packages/pending-open.ts`, both open an inspect-then-install dialog (the
`ImportAgentDialog` shape) and run the TSX gate per item — one bad item never
sinks a pack.

| | `.vidtsxpack` | `.vidtsxtransition` |
|---|---|---|
| Manifest | `pack.json` | `transition.json` — one `transitions[]` entry + `formatVersion`, `author`, `license`, `minAppVersion`, `files[]` |
| Payload | `transitions/<id>.tsx` … | `<id>.tsx` |
| Installs to | `<libraryRoot>/packs/<packId>/` | the reserved local pack `packs/imported/` |
| Document id | `<packId>/<id>` | `imported/<id>` |
| Already installed | left alone unless the version is newer; downgrade asks | same, per item |

`packs/imported/pack.json` is app-owned and rewritten atomically (temp +
rename) on each single install or removal. `imported` is a reserved pack id: a
`.vidtsxpack` claiming it is refused. Singles never pick their own namespace —
that keeps a sold pack and a loose file from fighting over one folder.

Add-ons repo work (there, not here): `tools/build-pack.mjs` emits the container
shape with a hashed `files[]` for `.vidtsxpack`, and a per-transition
`.vidtsxtransition`; `meta.json` gains `sceneCopies`.

*As built (P5, 2026-09-18):*

- **Formats.** `pack.json` in a `.vidtsxpack` carries the pack `id` itself (a zip
  has no folder name to trust). It must be a valid slug, not `imported`, and
  not a built-in pack's id (built-ins scan first, so such a pack could never
  load). `transition.json` is the add-on's `meta.json` fields at the top level
  plus `formatVersion`, `author`, `license`, `minAppVersion` and `files[]`. The
  payload is exactly `<id>.tsx`.
- **Allowed files.** A pack may declare `transitions/*.tsx`,
  `thumbnails/<slug>.(jpg|jpeg|png|webp|mp4|webm)` and `README.md`. Any other
  path refuses the package. A component is capped at 512 KB. Only components
  that pass the gate are written; thumbnails and README are never unpacked
  (cards render live). A stowaway entry the manifest doesn't list is never
  read.
- **Code.** Pure parsing is `shared/studio/transition-package.ts`. Open, gate
  and plan are `main/services/studio/transition-package.ts`. Writing is
  `transition-install.ts`: a pack is unpacked into a dot-folder staging dir
  (the loader skips dot-folders) and swapped in, with the old folder parked
  and restored if the swap fails. A single's `.tsx` and `imported/pack.json`
  each go through temp + rename, with the entry replaced in place or
  appended. Install re-opens and re-gates the file rather than trusting the
  earlier inspect.
- **Gate.** `defaultTransitionGate` = `lintShotSource(…, {
  requireCompositionConfig: false })` (the resolve-time rule) plus an esbuild
  compile. A failing item in a pack is skipped and listed. A failing single,
  or a pack where every item fails, is refused.
- **IPC.** `studio:transition-package:inspect | install | pending`, plus the
  push `studio:transition-package:open-file`. Inspect owns the OS picker, and
  `VIDTSX_TRANSITION_PICK` is its CDP test hook (like `VIDTSX_AGENT_PICK`).
- **Double-click.** Pending kind `'transition'` covers both extensions, and
  `main/index.ts` nudges on it. `App.tsx` puts the Studio screen on, and
  `StudioScreen` claims the file and hosts `ImportTransitionsDialog` over the
  browser or the editor, because installing is library-wide. The tab has an
  Import… button (in a "More transitions" section). An install fires
  `vidtsx:transitions-changed`, and every `useTransitionList` re-scans on it.
- **Not built.** Drag-and-drop of a package file: Electron 41 has no
  `File.path`, so it needs a `webUtils.getPathForFile` preload helper. The
  agent gallery's drop reads `File.path` and is affected too, which predates
  this work. Also not built: removing a single from `imported`, a pack manager,
  signing, and the add-ons builder. The gate's messages reuse the shot lint's
  wording ("shots may only import…").

## Content split (P6)

**Decision (Hasan, 2026-09-22):** a handful of everyday transitions built in,
the rest as an importable pack. The list is the implementer's:

| | Ships as | Items |
|---|---|---|
| `core` (built in, `resources/packs/core/`) | 4, all single-copy | push-left, wipe-right, zoom-through, iris-open |
| `vidtsx-transitions` — "VidTSX Transitions — Volume 01" 1.1.0 (`.vidtsxpack`) | 19, of which 10 heavy | diagonal-sweep, split-curtain†, venetian-blinds†, clock-wipe, staggered-tiles†, perspective-flip, prism-slices†, film-burn, ripple-reveal, aperture-shutter, vortex-rings†, cube-rotate, accordion-fold†, hexagon-bloom†, liquid-wave, signal-glitch†, page-turn, diamond-cascade†, tunnel-rush† († = heavy) |
| nowhere | 2 | cross-dissolve, dip-to-black |

Why this split:

- `core` is the catalog's `common` tier minus its two engine-native
  duplicates, plus one shape reveal. Iris-open is the fourth because it is the
  one `intermediate` item that is neither another straight wipe
  (diagonal-sweep, clock-wipe) nor multi-copy (split-curtain, venetian-blinds),
  and every NLE's basic set has it. Every core item is single-copy, so the
  heavy badge only ever appears on pack cards.
- **cross-dissolve and dip-to-black ship nowhere.** The Basic section already
  has Crossfade and Dip to black cards, and the authored versions are worse
  in-app: the pack dissolve fades both scenes, so it dims through the
  midpoint, and the pack dip needs handles where the native one is in-place
  and works on two whole clips. Reversing this is one `pack.json` entry and
  one file per item.
- `staggered-tiles` was in `core` only as P0's worst case. Its id is now
  `vidtsx-transitions/staggered-tiles`; nothing had shipped, so nothing
  migrates, and a document holding `core/staggered-tiles` takes the ordinary
  degrade path (verified live, below).
- Pack id `vidtsx-transitions`, so a "not installed" join names the pack to
  get. A later volume is a separate pack id, not a version bump.

*As built (P6, 2026-09-22):*

- **`sceneCopies` is measured, not declared.** `scene-copies.mjs` in the kit
  renders each add-on at seven progress values with marker scenes and counts
  the mounts: split-curtain 2, tunnel-rush 6, prism-slices 7, vortex-rings 7,
  venetian-blinds 8, accordion-fold 8, signal-glitch 13 + 13, staggered-tiles
  24, hexagon-bloom 40, diamond-cascade 40; the other 15 mount each scene once.
  The kit's earlier hardcoded guess had cube-rotate as multi — it is single.
  The add-ons' `meta.json` still has no `sceneCopies` field (add-ons work).
- **The pack is built by the kit**, `p3/mkpack.mjs`: catalog order, the
  add-on's `meta.json` fields plus the measured `sceneCopies`, a README, a
  hashed `files[]`, `minAppVersion` 1.1.0. Output
  `../vidtsx-addons/dist/vidtsx-transitions-1.1.0.vidtsxpack` (gitignored
  there; a copy sits in the kit's `p6/`). The add-ons repo's
  `tools/build-pack.mjs` builds the lead-magnet zip, a different shape, and
  that repo carries another session's uncommitted reorganisation, so no
  builder was added there.
- **Live, on the isolated instance** (scratch main + preload rebuilt, private
  renderer server, own profile, the P3 project with its old P5 packs still
  installed):
  - *Degrade on the renamed id.* The b→c join seeded with
    `core/staggered-tiles` 1.2 s: amber fill, tooltip and panel note "Its pack
    isn't installed, so this plays as a crossfade", the Player builds the
    window (462/36) with no component loaded, and stills at 470 and 480 are a
    plain crossfade of B into C. The four core cards render their posters.
  - *Import.* Double-click (second-instance argv) opened the dialog: "19
    transitions", the 10 heavy ones marked, nothing refused, Install → 19 files
    under `packs/vidtsx-transitions/`, and the tab re-listed without a reopen.
  - *Gallery past 8 cards.* 29 cards (Basic 2, core 4, pack 19, the P5
    leftovers 4) in a 553 px pane, 2172 px tall. Only on-screen cards hold a
    Player: 6 at the top, 12 mid-scroll, 9 at the bottom; scrolled-away cards
    go back to "Preview…" (0 off-screen Players at every step). At rest the
    renderer costs 0.05 cores with 6 mounted and 0.055 with the 12 heavy ones
    on screen, against 0.044 on the Media tab (machine at 8–12 %).
  - *Heavy in the Player* (P0 fps protocol, three runs each, machine 8–12 %,
    540p proxies): hexagon-bloom 219/42 → 29.8–29.9 fps, 0 skipped, worst gap
    53–73 ms; diamond-cascade 462/36 → 29.8–29.9, 0, 53–64 ms; vortex-rings
    1001/39 → 29.9–30.0, 0, 36–39 ms. Outside the windows 30.0, worst 34–37 ms,
    as before. The two 40-copy transitions double push-left's worst gap but
    never drop a frame; the bar (≥ 24 fps, clean) holds with room.
  - *Second round in the Player* (two runs each): prism-slices 225/30 → 30.0
    fps, worst 36 ms; signal-glitch 468/24 (13 + 13 copies) → 29.8, worst 52–75
    ms; the pack's staggered-tiles 1002/36 → 29.8–29.9, worst 46 ms. 0 skipped
    everywhere.
  - *Heavy in a real export, from the imported pack* (the first export ever to
    use one). Two Standard 1080p exports of the same 50 s timeline: round 1
    hexagon-bloom / diamond-cascade / vortex-rings (8.5 min), round 2
    prism-slices / signal-glitch / staggered-tiles under its new
    `vidtsx-transitions/…` id (5 min). Each entry imported its three copies from
    `packs/vidtsx-transitions/`, byte-identical to the add-on sources. The
    frames at 240 / 480 / 1020 show the same pattern and source counter as the
    Player's stills at those frames (WYSIWYG), and frame 100, outside every
    window, is pixel-identical between the two exports. Audio was not
    re-measured: the spine is untouched by any component (P0 / P4).

## Phases

| | Scope | Done when |
|---|---|---|
| **P0** | Structure A in the composition with the two components supplied statically; measure | **DONE 2026-09-17: A for renders, B (scene mirrors) in the Player.** Seams measured 2026-09-17. fps measured 2026-09-18 on a quiet machine: push-left 30.0, staggered-tiles 29.9, no skipped frames. See "P0 protocol" |
| **P1** | Engine for real: types, `ClipRenderer.tsx` split, `TransitionWindow.tsx`, pure planner `transition-windows.ts`, audio curve shared by both mirrors (`usesEqualPowerAudio`) | **BUILT 2026-09-17**: 15 new tests, studio suites 1013 passed, `check:types` at baseline (26 / 10), error lists identical before/after. The composition itself is verified by the P0 harness rather than a markup test (vitest here is node-env, `*.test.ts` only). P0 then added `SceneMirror.tsx`, with the harness re-run: stills byte-identical to the pre-mirror run, audio MD5 unchanged |
| **P2** | Pack loader, IPC, module delivery, `resources/packs/core/` with the two, degrade | **BUILT + VERIFIED 2026-09-17**: 21 loader tests. Live (CDP, isolated instance): both core kinds list, and a pack dropped into the library's `packs/` shows up on the next list with no restart (its declared-but-missing item dropped). The preview loads both modules over IPC. An uninstalled kind (`gone/whoosh`) previews as a crossfade while the installed one on the same track still renders. The join's warning *state* is P3 UI |
| **P3** | Transitions tab, selected join, apply / duration / remove, warning state, menu entry | **BUILT + VERIFIED 2026-09-18**: 14 tests (`join-status.test.ts`), studio suites 616 passed, `check:types` error lists identical before and after (26 / 10). Live CDP pass on the isolated instance: both core kinds applied from cards (one by a clicked join, one by a single selected clip); Player windows 230/21 and 462/36, mid-window stills correct. Length 1.2 → 0.4 s moved the window to 474/12. Undo and redo stepped through length, both applies and Remove, and the selection survived all of them. Remove works. A split plus a ripple delete of 3 s kept both transitions (windows 140 / 372, the same stills). "More transitions…" opens the tab on the join. Warnings: `gone/whoosh` amber-filled, whole clips amber-outlined, both with panel notes. Autosaved `project.json` holds the namespaced kinds. Missing-pack round trip on a folder pack (`demo`, a copy of core): applied `demo/push-left`, then uninstalled and reopened. The project opens, the join warns, the preview plays a crossfade and the id stays. Reinstalled with no reload, and the push is back. See "As built (P3)" for the hover-to-play change and the preview retry |
| **P4** | Export copy step | **BUILT + VERIFIED 2026-09-17**: 7 tests. A real Standard 1080p export from the app: the entry imports both copies (byte-identical to the pack files). Frames 240 / 480 are the push and the tiles (PSNR against a crossfade-only export of the same timeline: 7.6 / 20.4 dB inside the windows; frame 100 identical, 229 / 600 ≥ 55 dB outside). **Decoded audio MD5 identical to the crossfade export**, with RMS equal in both windows (−24.09 / −24.08 dB) |
| **P5** | `.vidtsxpack` + `.vidtsxtransition`, associations, dialogs, add-ons builder | **BUILT + VERIFIED 2026-09-18** (except the add-ons builder, which lives in the other repo). 18 new tests: 10 zip specs in `transition-package.test.ts` (tampered hash, lying size, zip-slip, an unused file, a non-zip, reserved / built-in id, minAppVersion, stowaway, per-item gate, all-refused, same / update / downgrade, singles appended and replaced in place, read back through the real loader) and 8 parser tests. Plus pending-open. `check:types` lists unchanged. Live, on the isolated instance with packages built from real add-on components: Import button → dialog → install, and the tab lists the pack with no reopen. **Double-click** (a second process with the file on argv, which is what a Windows association does): the running app opens the dialog; update 1.0.0 → 1.1.0 applied. A **tampered zip is refused** ("does not match its manifest hash", Install disabled). A mixed pack installs its good item and lists the refused one with the gate's reason. A single lands in `imported/`. Downgrade asks; same version shows "Installed". Imported `motion/iris-open` and `imported/clock-wipe` applied to joins and rendered in the preview |
| **P6** | The rest of the 25 — which are built-in and which are a pack | **ANSWERED (Hasan, 2026-09-22) and BUILT + VERIFIED the same day.** `core` = push-left, wipe-right, zoom-through, iris-open; `vidtsx-transitions` (Volume 01, 1.1.0) = the other 19, 10 of them heavy by measurement; cross-dissolve and dip-to-black ship nowhere (the natives). `staggered-tiles` renamed to `vidtsx-transitions/staggered-tiles`; the old id degrades to a crossfade with the join warning (verified live). Loader tests updated (22 pass), the nine transition suites 93 pass, `check:types` lists identical (26 / 10), P0 harness stills byte-identical to `out-prev` with the harness's own tiles copy. Live: import → 29-card gallery lazy-mounts and unmounts, 0.05 cores at rest; six heavy kinds at 29.8–30.0 fps, 0 skipped; two real exports from the imported pack, WYSIWYG at the window mids. See "Content split (P6)" |

P0–P4 is "fully working with two". P5 can trail: folder drop works from P2.

**Working-tree coordination (2026-09-17).** Text-based editing (row 8) and a
templates feature are built but uncommitted, and they hold edits in the files
P2/P3 must touch: `LeftPane.tsx`, `EditorShell.tsx`, `useTimeline.ts`,
`channels.ts`, `paths.ts`, the preload api, `electron.d.ts`,
`src/shared/studio/index.ts`, `electron-builder.yml`. The engine files
(`TimelineComposition.tsx`, `serialize.ts`, `types/studio.ts`,
`export-audio.ts`) are uncontested. So: **P1 first, in uncontested files only;
P2/P3 start after that work is committed.** P0's fps numbers need a quiet
machine — concurrent Remotion renders from other sessions invalidate them.

*Update, later on 2026-09-17:* templates committed (`560ea19`), which freed
`channels.ts`, `paths.ts`, the preload api, `electron.d.ts` and
`electron-builder.yml`. P2 and P4 were built after that. P2 needed no held
file, because the preview's components come from `PreviewPanel.tsx` (clean),
not `EditorShell`. Still held by text editing: `LeftPane.tsx`,
`EditorShell.tsx`, `useTimeline.ts`, `timeline-ops.ts` and
`shared/studio/index.ts`, which are all of P3. The new modules import leaf
paths (`@shared/studio/transition-pack`) rather than the barrel for the same
reason. *2026-09-18:* text editing committed (`99f3380`); those files are free.
The live-verification kit is in `.vidtsx-temp/p0-transitions/player/`
(README inside).

### P0 protocol

**Export-host half — DONE 2026-09-17, Structure A holds.** Harness:
`.vidtsx-temp/p0-transitions/` (gitignored; `node run.mjs <frames> [--media]`)
— the real `serializeTimeline` and `TimelineComposition` through
`@remotion/bundler` + `@remotion/renderer`, over two synthetic clips with
burned-in frame counters and distinct tones, c1→c2 `core/push-left` 0.7 s,
c2→c3 `core/staggered-tiles` 1.2 s. Two compositions over one timeline: `with`
(components supplied) and `fallback` (none — the degrade path).

| Check | Result |
|---|---|
| Mid-window stills | push-left and the 24-copy tiles both render; no ghost of the covered pictures underneath |
| Frame accuracy | the scene nodes show the same source frame as the clip's own picture (A 180 / B 60 at the first cut; B 170, A 180 at the second) |
| Frames outside the windows (108, 132, 259) | `with` vs `fallback` PNGs **byte-identical** — the engine changes nothing where there is no window |
| Degrade | `fallback` renders a crossfade of the same two frames |
| Audio | decoded PCM of the two full renders has the **same MD5**; level across the tiles window identical (−24.1 dB mean) — 24 muted copies add nothing, the sound path is untouched |

**Player half — seams RUN 2026-09-17, fps RUN 2026-09-18.** On 2026-09-17 CPU
sat at 88–100% the whole time, with about 24 Remotion render processes from
other sessions, so no fps number was taken then. The fps table below is from
2026-09-18. The run used an isolated app instance: a
main + preload build in a scratch folder junctioned to the repo, a private
renderer Vite server with its own dep cache, its own `--user-data-dir`, and a
projects root set to the scratchpad. The media was three synthetic 12 s 1080p30
H.264 clips with burned-in counters, trimmed 2 s at both ends; windows at
frames 230–251 (push-left) and 462–498 (tiles).

| Check | Structure A (video copies) | Scene mirrors (as built) |
|---|---|---|
| Unmuted `<video>` at mid-window | exactly 1 per clip (A+B at 240, B+C at 480) | same |
| `<video>` elements at mid tiles | 27 (2 hidden spines + 25 visible copies) | **2** (the spines); copies are canvases |
| Spine audio node across a window | same node before / through / after (no remount) | same |
| Paused stills at the edges and middles of both windows | correct pictures | correct; same geometry as A |
| **Seam at window start, playing 1×** | **black**: push-left 231–233 fully black; tiles 462–468 black, then the Player stalled at 469 with 27 videos not ready and faded back over ~18 captured frames | **clean** in 6 runs, with captured frames on 230–233 and 461–464 |
| Seam at window end, playing 1× | clean (249–254, 495–501) | clean (248–252, 495–501) |
| WYSIWYG, mid-window, against the exported frame | — | same geometry and source frame (counter 10 at 240, same tile layout at 480). Pixels differ at ~13–14 dB, but frames OUTSIDE any window differ the same (~13.3 dB): the Player plays the untagged 540p proxy and the export decodes the untagged 1080p original with a different YUV matrix. Pre-existing, not a transitions effect |

**fps (2026-09-18, quiet machine).** Machine load was 2–5% before and after,
no ffmpeg or Remotion render running (16 logical cores; Defender active). Same
isolated instance and media, on the P3 test project (same clips and windows:
push-left 230/21, tiles 462/36), 540p proxies ready. Preview 895×504 CSS px at
DPR 1.25, Media tab active. Playing 1× from ~35 frames before each window to
~35 after, with the Player's `frameupdate` timestamps and a rAF trace logged
in the page. Three runs each:

| | effective fps in window | skipped frames | worst gap | out-of-window baseline |
|---|---|---|---|---|
| push-left (21 frames) | 30.0 / 30.0 / 30.0 | 0 / 0 / 0 | 34.7 / 35.2 / 34.7 ms | 30.0 fps, worst 34–37 ms |
| staggered-tiles (36 frames) | 29.9 / 29.9 / 29.9 | 0 / 0 / 0 | 60.6 / 43.2 / 39.9 ms | 30.0 fps, worst 34–35 ms |

rAF never went past 16.9 ms, and the tiles window played at 0.996–0.997×
speed: the one 61 ms gap is a Player-side wait of a frame or so, not a long
paint. With the Transitions tab open (cards at rest): 30.0 and 29.9, worst
34.6 / 42.1 ms. **Both clear the bar with room to spare. A with scene mirrors
stands, and the "heavy" badge is informational rather than a warning.** Not
covered: real camera footage, 1080p originals with no proxy, and a slower
machine.

Seam method: a CDP screencast across each window, cropped to the preview,
with each captured frame mapped to the Player frame through `frameupdate`
timestamps. A frame counts as a flash when its dark-pixel fraction exceeds the
out-of-window baseline (~0.115) by 0.25. Audio was not listened to. The audio
path is unchanged (spine nodes never remount; export PCM is identical to a
crossfade export, see P4).

Also seen, not attributed: the first 1080p export of this project died with
"Compositor exited … memory allocation of 6220854 bytes failed" (one RGB 1080p
frame) at ~61%. The retry succeeded. Compositor private memory climbed to
4.8 GB on the transitions export and to ~3.7 GB mid-render on the crossfade-only
export, while free commit memory machine-wide fell to 3–5 GB. That's Remotion's
frame cache under a loaded machine; a quiet-machine export would settle it.

Original protocol:

1080p / 30 fps project, three H.264 clips ≥ 10 s each trimmed 2 s at both ends
(handles on every side), proxies ready. A→B `core/push-left` 0.7 s, B→C
`core/staggered-tiles` 1.2 s. Through CDP, playing across each window:

1. presented-frame cadence from the Player's `frameupdate` timestamps — worst
   gap and effective fps across the window;
2. `<video>` elements mounted at mid-window, and how many are unmuted (must be
   exactly one per clip);
3. a screenshot at mid-window against the exported frame at the same frame
   number (the WYSIWYG check);
4. by eye and ear: no black flash at either seam, no audio click.

Bars: `push-left` holds ≥ 24 fps with clean seams → A stands. `staggered-tiles`
is recorded whatever it is; under ~15 fps → try B, then settle on C.

## Out of scope

`params` and a param-driven inspector · luma wipes · drag and drop · transitions
on the first clip's head · freeze-frame fill · brand accent · pack manager
screen, updates, signing · embedding referenced pack items in `.vidtsx` project
packages (the `packs/` directory is already reserved for it) · effects (E2).

## Test plan

- **Unit:** pack parsing (bad entries, duplicate ids, missing files, reserved
  id, `minAppVersion`), id helpers and the native set, serializer geometry for
  a namespaced kind (= crossfade numbers), audio curve for a namespaced kind in
  `volumeProp` and `clipVolumeAt` (equal-power at window edges and centre),
  `transitionEntryRef` + entry emission, zip reader specs for both extensions.
- **Composition:** nothing renders `TimelineComposition` in vitest (node env,
  `*.test.ts` only), so its structure is tested twice over instead — the
  decisions as the pure planner's unit tests, the rendering through the P0
  harness (real renderer: stills inside/outside the windows, `with` vs
  `fallback`, audio MD5). Re-run the harness after any edit to
  `TimelineComposition.tsx`, `ClipRenderer.tsx` or `TransitionWindow.tsx`.
- **Live CDP:** the P3 and P4 rows above, plus uninstall-a-pack → project still
  opens, join shows the warning, reinstall restores it.
- **Content (P6):** the two loader tests read the real `resources/packs/core/`
  and pin its four entries; `sceneCopies` for the pack comes from rendering
  (`scene-copies.mjs`), so the heavy badge can't drift from the code.

## Decision checklist

1. First two transitions `push-left` + `staggered-tiles`: **ANSWERED — ok**
   (Hasan, 2026-09-17).
2. Apply by selecting a join and clicking a card; drag and drop later:
   **ANSWERED — yes** (Hasan, 2026-09-17).
3. Two extensions — a pack and a single transition: **ANSWERED — two** (Hasan,
   2026-09-17). Names `.vidtsxpack` / `.vidtsxtransition`, and singles landing
   in a reserved `imported` pack, are this doc's proposal — *open to veto*.
4. Row 8 (text editing) and S0 are not prerequisites. Row 8 is independent
   (and was built 2026-09-17 — it constrains ORDER only, see "Working-tree
   coordination"). S0 ran 2026-08-28 (T2) and 2026-09-04 (T8a); the only
   binding constraint from it — do not run decoder adoption (P2 of
   `PREVIEW_ARCHITECTURE.md`) while E1 edits `TimelineComposition.tsx` —
   holds, P2 is parked.
5. ★ items 1–3 above (contract as authored, no schema bump, no
   `@remotion/transitions` wrappers): recommended, *not yet explicitly
   answered*.
6. P6 content split — built-in versus pack: **ANSWERED — a handful of everyday
   ones built in, the rest as a pack** (Hasan, 2026-09-22). Built the same
   day as core = push-left, wipe-right, zoom-through, iris-open and the
   `vidtsx-transitions` pack = the other 19; the two native duplicates ship
   nowhere. See "Content split (P6)".

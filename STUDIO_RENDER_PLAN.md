# Studio Render / Export — Implementation Plan

> Goal: export a Studio project (source video + cuts + captions + TSX overlay slots)
> to a final MP4, reusing the renderer that Creator/Motion already use.
>
> Status when this plan was written: Studio editing is feature-complete for
> end-to-end testing (no SFX/Music). Rendering is NOT started. This doc is for a
> fresh session to pick up cold.

---

## 0. First steps for the new session (do not skip)

The plan below references current code. **Re-read these files before coding** — they
may have changed since this plan was written:

- `src/main/ipc/render-handlers.ts` — existing render entry (`handleRenderStart`), progress/complete IPC events, queue + history wiring.
- `src/main/services/remotion-renderer.ts` — `renderComposition()` (codec/CRF/concurrency/timeout). The render workhorse.
- `src/main/services/remotion-bundler.ts` — `bundleComposition()`, `getBundlerPort()`.
- `src/main/services/composition-wrapper.ts` — `generateWrapper()` / `cleanupWrapper()`. **The template for the multi-slot wrapper we need.**
- `src/features/studio/components/StudioComposition.tsx` — the preview composition tree (video clips + captions + TSX slots). This is the thing we render.
- `src/features/studio/services/tsx-slot-registry.ts` — in-memory `Map<slotId, ComponentType>`. The render path must NOT depend on this.
- `src/features/studio/services/cut-service.ts` — `compressCutClips()` → visible clips in cut-time + `cutDurationInSeconds`.
- `src/main/services/auto-cut/extract-audio.ts` — `extractAudio()` (ffmpeg). Reusable.
- `src/main/services/studio-tsx-files.ts` — where slot `.tsx` files live: `userData/studio-projects/{projectId}/tsx/`.
- `src/features/studio/components/StudioScreen.tsx` — how preview assembles props (cut clips, caption remap to cut-time, `tsxOverlays`, dims/fps). The render input builder mirrors this.

Also confirm in `package.json`: `@remotion/renderer`, `@remotion/bundler`, `@remotion/cli` are all present and **the same version as `remotion`** (currently 4.0.435 — Remotion packages must always match exactly per CLAUDE.md).

---

## 1. Why this is MEDIUM, not HARD

The renderer is **done and battle-tested** — Creator/Motion render TSX → MP4 today via
`@remotion/bundler` + `@remotion/renderer`. ffmpeg, ffprobe, and the Remotion compositor
binary are bundled in `resources/binaries/`.

Studio's preview composition (`StudioComposition.tsx`) is already the exact tree we want
to render: one `<AbsoluteFill>` stacking (a) `<Video>` clips with cuts via `<Sequence>` +
`trimBefore`, (b) the caption template component, (c) TSX overlay `<Sequence>`s.

So we are **not** building a renderer. The work is three adapters:

1. **Slot bundling bridge** — preview loads slots from an in-memory registry; the headless
   bundler needs them as real on-disk modules statically imported into a Remotion entry.
2. **Props bridge** — `StudioComposition` looks slots up via `getSlotComponent()`; the
   render variant must receive slot components directly (inputProps can't carry React
   components, so they must be statically imported in the generated entry).
3. **Audio for cuts** — *probably free* (Remotion captures `<Video>` audio), but must be
   verified; ffmpeg fallback if not. See §5.

Estimate: **~6–10 hours** for a working prototype.

---

## 2. Architecture: generate → bundle → render a Studio entry

```
Project state (renderer)
  └─(IPC: STUDIO_RENDER_START)─► main process
        1. Build StudioRenderInput from project (cut clips, captions, ready slots, dims/fps)
        2. Materialize a temp Remotion project dir:
             - copy each ready slot .tsx into temp dir
             - generate _studio_root_{hash}.tsx entry that:
                 • statically imports each slot component
                 • imports the render-safe StudioComposition
                 • builds slotComponents map { slotId: Component }
                 • registerRoot(<Composition id="studio" .../>)
        3. bundleComposition(entry) → bundleUrl
        4. renderComposition({ bundleUrl, compositionId:'studio', inputProps, outputPath })
        5. (if needed) ffmpeg audio mux  — see §5
        6. cleanup temp dir
  ◄─ progress + complete events (reuse RENDER_PROGRESS / RENDER_COMPLETE pattern)
```

Reuse `handleRenderStart`'s detached-IIFE + progress-event pattern. Either extend it with a
Studio branch or add a parallel `handleStudioRenderStart` that ends up calling the same
`renderComposition()`.

---

## 3. The render-safe StudioComposition (props bridge)

`StudioComposition` currently does `const Comp = getSlotComponent(overlay.id)` (registry).
Headless render has no registry. Two options:

- **Option A (preferred): add an optional override prop.** Give `StudioComposition` a
  `slotComponents?: Record<string, ComponentType>` prop; when present, resolve overlays from
  it instead of the registry. Preview passes nothing (keeps registry); render passes the map.
  One file touched, no duplication.
- Option B: a parallel `StudioRenderComposition.tsx`. More duplication, avoid.

Go with **Option A**. In the overlay map:
```tsx
const Comp = slotComponents?.[overlay.id] ?? getSlotComponent(overlay.id);
```

Everything else in `StudioComposition` (video clips, caption template via
`@shared/captions/templates`) already bundles fine — those are normal imports the bundler
resolves. Captions specifically are already proven renderable (the standalone Captions
feature renders them; see the caption-composition path in `render-handlers.ts`).

The generated entry file (`_studio_root_{hash}.tsx`) statically imports each slot and the
component map, then wraps `StudioComposition`. Pattern follows `composition-wrapper.ts`
(`generateWrapperWithConfig`), but instead of one user component it imports N slots and the
StudioComposition shell. Sketch:

```tsx
import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { StudioComposition } from '<path-or-alias>/StudioComposition';
import Slot0 from './slot_<id0>.tsx';
import Slot1 from './slot_<id1>.tsx';
// ...
const slotComponents = { '<id0>': Slot0, '<id1>': Slot1 /* ... */ };
const inputProps = /* injected JSON: videoClips, segments, styleId, settings, tsxOverlays, dims */;
const Root = () => (
  <Composition
    id="studio"
    component={(p) => <StudioComposition {...p} slotComponents={slotComponents} />}
    durationInFrames={inputProps.durationInFrames}
    fps={inputProps.fps}
    width={inputProps.width}
    height={inputProps.height}
    defaultProps={inputProps}
  />
);
registerRoot(Root);
```

> NOTE: confirm how the bundler resolves `@shared`/`@features` aliases for an entry written
> to a temp dir. Creator's wrapper writes the entry **into the same dir as the user TSX**
> and imports the component relatively. For Studio we import the *app's* StudioComposition,
> so either (a) write the entry inside `src/features/studio/components/` temporarily, or
> (b) ensure the bundler's webpack config has the path aliases (check `remotion-bundler.ts`
> for an `webpackOverride`). Decide this early — it affects where the temp entry lives.

---

## 4. Build the render input (mirror preview)

Add `src/features/studio/services/studio-render-input.ts` (or build in the handler). It must
reproduce what `StudioScreen.tsx` computes for the `<Player>`:

- **Video clips**: `compressCutClips(videoClips.clips)` → visible clips in cut-time. Map to
  `VideoClipInput { id, url, startFrame, durationInFrames, inPointFrames }`. `startFrame` =
  cut-time start × fps; `inPointFrames` = source in-point × fps.
- **Captions**: remap segments to cut-time (reuse `caption-remap.ts` /
  `remapCaptionsToCutTime`), pass `styleId`, `baseSettings`, `styleConfigs`.
- **TSX slots**: only `status === 'ready'` slots. For each: its `.tsx` file path
  (`getTsxFilePath(projectId, fileName)`), `startFrame`, `durationInFrames`, `inPointFrames`.
- **Dims/fps/duration**: `composition.width/height/fps`; `durationInFrames =
  round(cutDurationInSeconds × fps)` (the **effective cut duration**, not the source).

⚠️ **Asset URLs**: preview serves video via an asset server (`/asset?path=` — see memory:
"staticFile() render gotcha"). Headless render needs the video files reachable too. Check how
Creator/Motion renders resolve asset URLs and reuse that (likely the bundler's static dir or
the asset server staying alive during render). Do NOT hardcode `staticFile()` absolute paths.

---

## 5. Audio (verify before building)

**Hypothesis: audio is free.** The composition renders cut video as `<Video src trimBefore>`
inside `<Sequence>`s. Remotion's `renderMedia` captures and mixes audio from `<Video>`/`<Audio>`
tags automatically. If so, the cut audio comes out correct with zero extra work — same as
preview.

**Action: render a short cut project FIRST and listen.** If audio is correct → done.

**If audio is wrong/missing** (e.g. clips muted, or seams glitch), fall back to ffmpeg
assembly:
1. `extractAudio()` (reuse from auto-cut) to get source audio.
2. ffmpeg `concat`/`atrim`+`concat` the visible cut ranges into one cut-matched track.
3. Either inject as a single `<Audio>` in the composition (and mute the `<Video>`s) OR mux
   post-render with ffmpeg (`-i video.mp4 -i audio.wav -c:v copy -map 0:v -map 1:a out.mp4`).

Keep this as a contingency section — don't build it until §5 verification fails.

---

## 6. IPC + UI

- **Channels** (`src/shared/ipc/channels.ts`): `STUDIO_RENDER_START`, optionally reuse
  existing `RENDER_PROGRESS` / `RENDER_COMPLETE` events (they're generic enough — check the
  payload shape carries a `jobId`).
- **Types** (`src/shared/ipc/types/`): `StudioRenderStartRequest { projectId, outputPath?, quality? }`,
  `StudioRenderStartResponse { success, jobId?, error? }`.
- **Handler**: `handleStudioRenderStart` in a new `studio-render-handlers.ts` (or branch in
  `render-handlers.ts`). Register in `src/main/ipc/registrations/`.
- **Preload**: expose `studioRenderStart` + progress/complete listeners (mirror existing
  render preload).
- **UI**: an **Export** button in Studio (toolbar in `StudioScreen.tsx`, or a new small panel).
  Show progress (reuse the `useSmoothProgress` pattern or the render progress events). On
  complete, offer "Open file" / "Open folder" (handlers already exist:
  `RenderOpenFile` / `RenderOpenFolder`).
  - Gate the button: require ≥1 visible video clip; warn if any TSX slots are still
    `pending`/`queued`/`generating` (they won't be in the render — only `ready` slots are).

---

## 7. Phases (suggested order)

1. **Props bridge** — add `slotComponents` override to `StudioComposition`. Verify preview
   still works unchanged. (~30 min)
2. **Render input builder** — `studio-render-input.ts`, unit-reason against `StudioScreen`
   preview props. (~1–2 h)
3. **Entry generator + bundle** — multi-slot wrapper writer (model on `composition-wrapper.ts`),
   resolve the alias/temp-dir question from §3. Bundle it. (~2–3 h)
4. **Render + IPC + minimal UI** — wire `renderComposition`, a basic Export button, progress.
   Render a SHORT test project. (~2 h)
5. **Audio verification** — §5. Build ffmpeg fallback only if needed. (~0–2 h)
6. **Polish** — quality presets, gating/warnings, cleanup temp dirs, open-file/folder. (~1 h)

---

## 8. Acceptance criteria

- [ ] Export a project with cuts only → MP4 plays, cuts are correct, audio in sync.
- [ ] Export with captions → captions burned in, timed correctly in cut-time.
- [ ] Export with ≥2 ready TSX slots → overlays appear at the right frames, with trims honored.
- [ ] Pending/queued/generating slots are excluded (only `ready`), with a pre-export warning.
- [ ] Temp wrapper/slot-copy files are cleaned up after render (success AND failure).
- [ ] Progress updates in the UI; Open file / Open folder work on completion.

---

## 9. Risks / gotchas

- **Bundler alias resolution** for the temp entry importing `StudioComposition` (§3 NOTE).
  Resolve this first — it's the most likely time-sink.
- **Asset URL reachability** in headless render (§4 ⚠️). Reuse the existing asset approach;
  don't invent `staticFile()` paths (known render gotcha — see memory).
- **Font loading** in TSX slots — `composition-wrapper.ts` routes Google Fonts through a
  local proxy (`fontProxyBaseUrl` / `rewriteFontUrls`). Apply the same to slot files so
  offline/headless renders don't break.
- **CJS imports on esm.sh** — slots may default-import CJS libs (chroma-js etc.); namespace
  imports break at runtime (see memory). The bundler already handles user TSX from Creator,
  so this should carry over, but watch for it.
- **Remotion version lockstep** — never `^`-prefix Remotion packages; all must match `remotion`.
- **Slot `compositionConfig`** — Creator slots export a `compositionConfig`; Studio slots may
  or may not. The render-safe StudioComposition ignores per-slot config (it controls timing via
  `<Sequence from durationInFrames>`), so slots just need to be valid components. Confirm slots
  render headless without their own `<Composition>` registration.

---

## 10. Reusable pieces (inventory)

| Need | Reuse |
|---|---|
| Render to MP4 | `remotion-renderer.ts` → `renderComposition()` |
| Bundle | `remotion-bundler.ts` → `bundleComposition()`, `getBundlerPort()` |
| Wrapper generation template | `composition-wrapper.ts` → `generateWrapper()` / cleanup |
| Progress/complete IPC pattern | `render-handlers.ts` → `handleRenderStart` detached IIFE |
| Cut → visible clips (cut-time) | `cut-service.ts` → `compressCutClips()` |
| Caption cut-time remap | `caption-remap.ts` → `remapCaptionsToCutTime()` |
| Caption templates (renderable) | `@shared/captions/templates` |
| Audio extraction (ffmpeg) | `auto-cut/extract-audio.ts` → `extractAudio()` |
| Slot file paths | `studio-tsx-files.ts` → `getTsxFilePath()` |
| Open file/folder post-render | existing `RenderOpenFile` / `RenderOpenFolder` handlers |

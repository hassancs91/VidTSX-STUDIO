# STATUS.md — Current progress

> Claude: update this file after completing each phase.

## Current phase: 6 — Template store + media library
## Status: NOT STARTED

---

## Completed phases

### Studio (AI video editor) — Phase S2: timeline core (2026-08-07)
**Status: COMPLETE — verified end-to-end via CDP, including the Player checkpoint**

- [x] `src/shared/studio/`: `time-math` (one cumulative-rounding conversion,
  `round(b·fps) − round(a·fps)`, so 100 cuts tile with zero drift), `serialize`
  (document → frames + asset URLs), and the data-driven `TimelineComposition`
  used by BOTH the preview and the export.
- [x] Timeline document reducer + undo/redo in feature state (`useTimeline`,
  100-deep snapshot history, no global store). Pure ops in
  `services/timeline-ops.ts`: add / move (neighbour-clamped) / split /
  trim (source- and neighbour-bounded) / ripple-delete (per-track, so music
  keeps its timing) / remove-asset-clips.
- [x] Tracks/clips UI: ruler, 10-step zoom anchored on the playhead, magnetic
  snapping to clip edges + playhead, drag-move across tracks, edge trims,
  canvas waveforms, selection, keyboard (Space/S/Del/Backspace/Ctrl+Z/Y/
  arrows/Home/End). Drag preview runs the real op on a scratch document, so
  what you see mid-drag is exactly what commits.
- [x] `@remotion/player` preview over 720p proxies; playhead lives outside
  React state (imperative subscribe → DOM), so playback re-renders nothing.
- [x] Background main-process jobs (tsx-job-engine pattern): proxy generator
  (NVENC → libx264 fallback, verified on this machine) and waveform generator;
  status per asset in the document, push events folded back into it.
- [x] Export: generated Remotion entry embedding the serialized timeline
  (originals, not proxies) → existing render queue. Verified output:
  1920×1080@30, 60.000 s video / 60.053 s audio, correct picture per clip,
  black across a deliberate gap, audio bursts at the right seconds.
- [x] **Player-architecture checkpoint passed** (100 cuts, 720p proxies, dev
  build — noisy machine, so ranges): playback 16.7 ms/frame (60 fps, same as a
  2-clip timeline); scrub 17–25 ms at natural drag speed, 25–35 ms flinging
  across the whole timeline; the editor's own JS is ~1.4 ms per scrub step, so
  the ceiling is video decode, not the UI. No HTML5-seek fallback needed.
  Two fixes got it there: proxies need a short GOP (`-g 15` — the encoder
  default ~8 s made each seek decode up to 250 frames, ~20 fps), and
  `TimelineComposition` mounts only clips within ±2 s of the current frame
  (mounting all 100 sequences per frame halved scrub throughput).
- Notes: proxies/waveforms are cached per project, so the same source imported
  into two projects transcodes twice (candidate for a hash-keyed shared cache).
  `EditorShell` imports `useRenderQueue` from `@features/render-queue`,
  following the existing precedent in `features/motion` — the render queue is
  app-level infrastructure exposed through context.
- Pre-existing bug noticed while testing (NOT introduced here, affects all
  renders): the queue shows "Bundling... 10000%" — `render-handlers.ts`
  multiplies an already-0–100 bundler percent by 100 again.

### Studio (AI video editor) — Phase S1: projects & editor shell (2026-08-07)
**Status: COMPLETE — verified end-to-end via CDP**

- [x] Document schema v1 in `src/shared/types/studio.ts` (seconds-only unit
  discipline, provenance, proposals); IPC contracts in
  `src/shared/ipc/types/studio.ts`; 9 `STUDIO_*` channels.
- [x] Main services (`src/main/services/studio/`): `studio-paths` (id
  validation + cache-path traversal guard), `project-store` (folder-as-truth
  listing, atomic tmp+rename saves, `shell.trashItem` delete with rm
  fallback, reuses `reserveProjectFolder`), `media-import` (ffprobe probe for
  video/audio/image, ffmpeg thumbnails to `cache/thumbs/`, content-hash for
  future relink).
- [x] Settings: `studioProjectsRoot` (default `~/Videos/VidTSX Studio`),
  changeable from the browser toolbar via the existing folder dialog.
- [x] Renderer: `ProjectBrowser` (grid cards, two-step delete),
  `NewProjectDialog` (Landscape/Portrait/Square presets + fps),
  `EditorShell` (CapCut layout: media pool | aspect-correct preview stage |
  Inspector+Assistant tabs | full-width timeline scaffold with ruler and
  V1/A1 lanes), debounced document autosave (`useStudioProject`),
  per-project agent provider picker persisted in `settings.agent`.
- [x] CDP-verified: create portrait 1080×1920@60 project → on-disk scaffold
  correct → provider select persists (atomic-save rename observed in USN
  journal) → back → card grid → delete → folder in Recycle Bin, empty state.
  Manual test remaining: media import (native file dialog can't be driven
  via CDP) — probe/thumbnail path is exercised in code but not clicked
  through. S2 exercised everything downstream of it by writing asset entries
  straight into project.json.
- Automation gotcha recorded: `App.tsx` keeps every visited screen mounted
  (`display: none`), so DOM-driving MUST filter to visible elements
  (`offsetParent !== null`) or clicks land on hidden screens' buttons.

### Studio (AI video editor) — Phase S0: gate & scaffold (2026-08-07)
**Status: COMPLETE**

Full architecture + phase plan (S0–S7) in `docs/studio/PLAN.md`. Locked
decisions: Remotion-native `TimelineComposition` for both preview (over 720p
proxies) and export; solid manual timeline core (S2) before auto-cut (S3);
user-chosen studio projects root (folder-as-truth); local whisper default with
AssemblyAI opt-in for word timestamps. Engine knowledge and skills ported from
`D:\repos\claude-youtube-editor` (cutlib planner, render-drift lessons,
clean-cut/make-tsx/suggest-sfx editorial policy).

- [x] Flags `studio: true` (nav teaser) / `studio-editor: false` (prod shows
  Coming Soon, dev fully enabled) — Flows-style gating.
- [x] `src/features/studio/` scaffold: gated `StudioScreen`, draft v1 timeline
  document schema in `types.ts`, barrel.
- [x] Sidebar nav item (Clapperboard, after TSX) + `screens` map entry.

### v1.0.0 — First public release (2026-07-29)
**Status: COMPLETE**

Public scope: TSX Creator, Image Studio, Transcribe, Assets, render queue,
and AI Models (System / Providers / Audio-whisper / Image). Everything else
stays visible as "Coming soon" in production and fully enabled in dev.

- [x] Image Studio local models: `LocalSdImageProvider` bridges the sd-cli
  engine into the cloud ImageEngine (provider id `local`, auto-offered when
  ≥1 ready on-device model). Promise-based `enqueueAwait` on the local
  engine; shared generation preflight (`applySdGenerationPreflight`);
  provider switch persists. Verified end-to-end via CDP (bk-sdm-tiny 256²).
- [x] Coming-soon gating (prod only): AI Models Video/LLMs/Embeddings tabs
  (`ai-video-models` / `ai-llm-models` / `ai-embedding-models` flags; 3D was
  already a placeholder), Flows editor (`flows-editor` flag — nav stays),
  sherpa voice-engine section of the Audio tab (existing `audio-engine`
  flag). Creator's keyless "Local Models" preset is gated on real
  `llmLocalEngine.isAvailable()` because production builds exclude
  node-llama-cpp.
- [x] Repo made public-ready: README.md written, personal scratch notes
  untracked, no secrets/keys in tree (verified), MIT license.
- [x] v1.0.0 Windows installer built and published as a GitHub release.

### TSX Generator stabilization + parallel jobs (Creator)
**Status: COMPLETE — committed 2026-07-23**

Full plan in `docs/tsx-generator-stability-plan.md`; contributor guide in
`docs/tsx-generator-architecture.md`.

- [x] **Phase 1** — stability foundation: compat-provider abort, agent-sdk
  error-result detection, save/auto-save races, retry-with-backoff,
  string-based validate, `npm run check:types` ratchet gate.
- [x] **Phase 2** — main-process job engine (`src/main/services/tsx-jobs/`):
  up to 4 concurrent generations with isolated `ClaudeSession`s, per-job
  provider + cancel, atomic project naming, queued-job persistence, will-quit
  shutdown.
- [x] **Phase 3** — job-based Creator UI: jobs strip, center-panel ownership
  rule, edits/fixes as jobs.
- [x] **Phase 4** — token streaming, per-project `chat.json` refinement
  history, pipeline tests, `local` + Z.AI providers, **props panel**
  (AST prop extraction + live preview inputProps), custom-provider UI
  (any OpenAI/Anthropic-compatible endpoint), library placeholder rows,
  maxConcurrent setting, coalesced library rescans.
- Z.AI preset verified against docs 2026-07-23: base URL
  `https://api.z.ai/api/anthropic`, model `glm-5.2` (opt: `glm-5.2[1m]`).

### Local AI Models redesign (open-source cleanup)
**Status: COMPLETE (Phases 0–4) — committed; field-verification pending**

Replaced the download-centric SD/Flux catalog (hosted on learnwithhasan.com) with
a ComfyUI-style, folder-as-truth model library built on a category-agnostic core.
Zero owner infrastructure for image models. See
`docs/local-image-models-redesign.md` (design) + `docs/local-image-models-implementation.md`
(plan + full Progress Log).

- [x] **Phase 0** — vitest tooling + type-error baseline (node 36 / web 44).
- [x] **Phase 1** — category-agnostic model-library core (`src/shared/model-library/`,
  `src/main/services/model-library/`): scanner, classifier, sidecars, importer,
  usage-store, category/runtime registries. Electron-free, injectable, 37 tests.
- [x] **Phase 2** — image adapter + registry rework: `SdModelDefinition`→profile
  envelopes (34 entries), `flux`→`flux1`/`flux2`, companion resolution, deleted
  `SD_MODELS_BASE_URL`, generic `MODELS_*` IPC, engine on an injected resolver.
- [x] **Phase 3** — dedicated flag-gated "AI Models" sidebar screen; image library
  view rewritten onto `MODELS_SCAN` (`useImageLibrary` + Header/Installed/Catalog/
  SetupDialog); dashboard Library card; deleted hidden GeneralTab folder block.
- [x] **Phase 4** — deleted audio `MODELS_BASE_URL` + fallback, orphaned
  `useSdImageModels`; fixed the dangling NSIS `build/license.txt` reference
  (→ committed `LICENSE.txt`) so `build:win` completes. 67 tests; node 36 / web 36.

**Pending before this ships (flagged in the Progress Log):**
- Interactive UI click-through of the AI Models screen (not run — non-interactive session).
- Catalog metadata verification: FLUX.2 Klein companion source links + the 13
  link-only `sourceUrl`s are best-effort, not network-verified; verify with a real sd-cli.
- sd-cli binary distribution story (still not bundled).

### Captions Generator
**Status: COMPLETE**

- [x] 4-step wizard UI (StepCard components)
  - Step 1: Add audio/video (AudioDropZone with drag & drop)
  - Step 2: Transcribe (ModelSelector with whisper integration)
  - Step 3: Choose caption style (CaptionTemplateSelector)
  - Step 4: Render options (WebM overlay, Burn into video, Export JSON)
- [x] useCaptions hook for wizard state management
  - Step progression logic
  - Transcription integration via existing whisper IPC
  - Style selection
- [x] 3 caption templates (Remotion compositions):
  - BoldPopCaptions: Large centered text with spring pop animation
  - KaraokeCaptions: Word-by-word highlight effect
  - MinimalCaptions: Clean subtitles at bottom with dark bar
- [x] caption-builder service (duration calculation, config generation)
- [x] CaptionPreview with VideoPlayer integration
- [x] Render queue integration:
  - Export WebM overlay (vp8 codec, transparent)
  - Burn into video (h264 codec)
  - Export captions JSON
- [x] Reuses whisper:transcribe IPC from transcription feature

### Phase 5 — Render queue system
**Status: COMPLETE**

- [x] Step 5.2 — Render queue service and UI
  - [x] RenderQueueJob type with full metadata (id, fileName, status, progress, etc.)
  - [x] queue-manager.ts utilities (generateOutputPath, formatFileSize, etc.)
  - [x] RenderQueueContext with state management, IPC event listeners
  - [x] Auto-start next queued job when current completes
  - [x] Debounced persistence to ~/.vidtsx/render-queue.json
  - [x] Load on startup with interrupted job handling
  - [x] Clean up jobs older than 7 days
- [x] IPC handlers added:
  - RENDER_QUEUE_SAVE for persisting queue
  - RENDER_QUEUE_LOAD for loading queue on startup
  - RENDER_OPEN_FILE for opening rendered files
  - RENDER_OPEN_FOLDER for revealing in explorer
  - RENDER_GET_VIDEOS_DIR for default output folder
- [x] UI components created:
  - RenderScreen with toolbar and job list
  - RenderItem with status icons, progress bar, actions
  - RenderProgress wrapper for status-colored progress bar
- [x] Toast notification system (shared component + context)
- [x] Sidebar badge showing active/queued job count
- [x] Render button in WorkspaceScreen integrated with queue

### Phase 4 — Code editor + props panel
**Status: COMPLETE**

- [x] Monaco code editor integration
- [x] Code + visual view mode toggle
- [x] Resizable divider between code and preview
- [x] Auto-save with transpilation refresh
- [x] Props panel (delivered later with the TSX Generator work, 2026-07-23):
  AST-based `props-parser`, `PropsPanel`/`PropField` controls
  (text/number/toggle/color/select), live preview updates via Player
  `inputProps`

### Phase 3 — Remotion player integration
**Status: COMPLETE**

- [x] VideoPlayer component wrapping @remotion/player
- [x] PlayerControls with play/pause, seek, timeline, loop, speed control
- [x] useComponentLoader hook for TSX transpilation
- [x] Native module loading with virtual module globals (setupVirtualModuleGlobals)
- [x] Error boundary and loading states for player
- [x] Screenshot functionality (copy to clipboard, save to file)
- [x] Fullscreen support

### Phase 2 — Workspace + file management
**Status: COMPLETE**

- [x] Step 2.1 — File tree UI component
- [x] Step 2.2 — File management features:
  - [x] "New folder" button in toolbar with inline name input
  - [x] Right-click context menu (native Electron Menu):
    - File: Rename, Delete
    - Folder: Rename, Delete, New subfolder
  - [x] Inline rename (click turns label into input, Enter saves, Escape cancels)
  - [x] Drag-and-drop .tsx files onto window (with visual overlay)
  - [x] Paste TSX from clipboard (Ctrl+V detects TSX-like content)
  - [x] SelectedFileContext for sharing selected file across screens
- [x] IPC channels added:
  - FILE_RENAME for renaming files/folders
  - FILE_GET_PROJECTS_DIR to expose projects directory to renderer
  - CONTEXT_MENU_SHOW for native context menus
  - CLIPBOARD_READ_TEXT for clipboard access
- [x] Components created:
  - InlineRenameInput for inline editing
  - DropZoneOverlay for drag-drop visual feedback
  - SelectedFileContext/Provider for state management

### Phase 1 — App shell + navigation
**Status: COMPLETE**

- [x] Title bar with traffic lights (macOS) / system buttons (Windows)
- [x] Sidebar with 7 navigation icons + settings at bottom
- [x] Screen routing between all 7 screens
- [x] Placeholder screens for each feature
- [x] Reusable shared components:
  - [x] Button (primary/secondary variants, sm/md sizes)
  - [x] Panel (dark surface with optional header)
  - [x] Badge (free/pro variants)
  - [x] ProgressBar (4px height, multiple colors)
  - [x] TextInput (styled input with focus state)
  - [x] IconButton (toolbar actions)
- [x] Barrel export from src/shared/components/index.ts
- [x] WorkspaceScreen updated to use Panel + Button

### Phase 0 — Project scaffold
**Status: COMPLETE**

- [x] Electron 41.0.2 installed and working
- [x] electron-vite 5.0.0 configured as build tool
- [x] TypeScript 5.9.3 with separate configs (node/web)
- [x] React 19.2.4 rendering in Electron window
- [x] Tailwind CSS 4.2.1 with custom theme colors
- [x] Path aliases (@main, @renderer, @features, @shared)
- [x] Preload script with contextBridge
- [x] Typed IPC foundation (22 channels)
- [x] Full folder structure with barrel exports
- [x] electron-builder configured for Windows/macOS

---

## Known issues / tech debt

- `scripts/dev.js` wrapper needed to clear `ELECTRON_RUN_AS_NODE` env var (VSCode terminal issue)
- `@rollup/rollup-win32-x64-msvc` added to optionalDependencies as workaround for npm bug
- Tailwind CSS native binaries (`lightningcss`, `@tailwindcss/oxide`) require explicit install on Windows

---

## Deviations from plan

- Using `scripts/dev.js` wrapper instead of direct `electron-vite dev` due to VSCode environment variable conflict

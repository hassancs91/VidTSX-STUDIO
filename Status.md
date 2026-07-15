# STATUS.md — Current progress

> Claude: update this file after completing each phase.

## Current phase: 6 — Template store + media library
## Status: NOT STARTED

---

## Completed phases

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

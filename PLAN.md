# VidTSX Studio — Master project plan

> **This is the single source of truth for the project.** Before writing any code, read this file.
> After completing any phase, update the status checkboxes below.

## Project overview

VidTSX Studio is an Electron desktop app for previewing, editing, and rendering TSX-based video compositions (built on Remotion). It is local-first and serverless: local asset library, caption generator with local Whisper, a standalone transcription tool, and AI features powered by the user's own provider keys or local models. (The originally planned cloud template store / S3 media library were retired 2026-08-16 — see Phases 6–7 and "No backend API".)

**Target platforms:** macOS (arm64 + x64), Windows (x64)
**Tech stack:** Electron, React, TypeScript , Vite , Remotion , Tailwind CSS 

---

## Architecture principles

1. **Feature modules** — every feature is a self-contained folder under `src/features/`. Each module has its own components, hooks, services, and types. No cross-imports between feature modules; shared code goes in `src/shared/`.
2. **Main/renderer split** — Electron main process code lives in `src/main/`, renderer in `src/renderer/`. They communicate only through typed IPC channels defined in `src/shared/ipc/`.
3. **Service layer** — business logic lives in service classes, never in React components. Components call hooks, hooks call services.
4. **One file, one concern** — no file exceeds ~300 lines. If it does, split it.
5. **Typed IPC contracts** — every IPC channel has a TypeScript type in `src/shared/ipc/channels.ts`. Main and renderer both import from there.

---

## Folder structure

```
vidtsx-studio/
├── PLAN.md                          # THIS FILE — master plan
├── CLAUDE.md                        # Claude Code instructions
├── STATUS.md                        # Current progress tracker
├── package.json
├── electron-builder.yml             # Build config for macOS + Windows
├── vite.config.ts                   # Vite config for renderer
├── tsconfig.json                    # Base TS config
├── tsconfig.main.json               # Main process TS config
├── tsconfig.renderer.json           # Renderer TS config
├── tailwind.config.ts
│
├── src/
│   ├── main/                        # Electron main process
│   │   ├── index.ts                 # Entry: creates window, registers IPC
│   │   ├── window.ts                # Window creation + management
│   │   ├── ipc/                     # IPC handler registrations
│   │   │   ├── register.ts          # Registers all IPC handlers
│   │   │   ├── file-handlers.ts     # File system operations
│   │   │   ├── render-handlers.ts   # Remotion render orchestration
│   │   │   └── whisper-handlers.ts  # Whisper model + transcription
│   │   ├── services/
│   │   │   ├── remotion-renderer.ts # @remotion/renderer wrapper
│   │   │   ├── remotion-bundler.ts  # @remotion/bundler wrapper
│   │   │   ├── ffmpeg.ts            # ffmpeg binary management
│   │   │   └── whisper.ts           # whisper.cpp binary + model management
│   │   └── utils/
│   │       ├── paths.ts             # App data, temp dirs, binary paths
│   │       └── logger.ts            # Main process logging
│   │
│   ├── renderer/                    # React renderer process
│   │   ├── index.html
│   │   ├── main.tsx                 # React entry point
│   │   ├── App.tsx                  # Root layout with sidebar router
│   │   ├── routes.tsx               # Screen routing config
│   │   └── styles/
│   │       └── global.css           # Tailwind imports + app theme
│   │
│   ├── features/                    # Feature modules (renderer-side)
│   │   ├── workspace/               # File tree + player home screen
│   │   │   ├── components/
│   │   │   │   ├── WorkspaceScreen.tsx
│   │   │   │   ├── FileTree.tsx
│   │   │   │   ├── FileTreeItem.tsx
│   │   │   │   └── ImportDialog.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useFileTree.ts
│   │   │   │   └── useProjectFiles.ts
│   │   │   ├── services/
│   │   │   │   └── file-manager.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── editor/                  # Monaco + props panel + preview
│   │   │   ├── components/
│   │   │   │   ├── EditorScreen.tsx
│   │   │   │   ├── CodeEditor.tsx   # Monaco wrapper
│   │   │   │   ├── PropsPanel.tsx   # Auto-generated prop controls
│   │   │   │   ├── PropField.tsx    # Individual prop input
│   │   │   │   └── OutputSettings.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useMonaco.ts
│   │   │   │   └── usePropsExtractor.ts
│   │   │   ├── services/
│   │   │   │   └── props-parser.ts  # AST-based prop extraction
│   │   │   └── types.ts
│   │   │
│   │   ├── player/                  # Shared Remotion player
│   │   │   ├── components/
│   │   │   │   ├── VideoPlayer.tsx  # @remotion/player wrapper
│   │   │   │   └── Timeline.tsx     # Custom timeline controls
│   │   │   ├── hooks/
│   │   │   │   └── usePlayerState.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── templates/               # Template store browser
│   │   │   ├── components/
│   │   │   │   ├── TemplateStoreScreen.tsx
│   │   │   │   ├── TemplateGrid.tsx
│   │   │   │   ├── TemplateCard.tsx
│   │   │   │   └── CategoryFilter.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useTemplateStore.ts
│   │   │   ├── services/
│   │   │   │   └── template-sync.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── media/                   # Media library (local)
│   │   │   ├── components/
│   │   │   │   ├── MediaScreen.tsx
│   │   │   │   ├── MediaGrid.tsx
│   │   │   │   ├── MediaItem.tsx
│   │   │   │   └── UploadZone.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useMediaLibrary.ts
│   │   │   ├── services/
│   │   │   │   └── media-manager.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── captions/                # Caption generator
│   │   │   ├── components/
│   │   │   │   ├── CaptionsScreen.tsx
│   │   │   │   ├── AudioDropZone.tsx
│   │   │   │   ├── ModelSelector.tsx
│   │   │   │   ├── CaptionTemplateSelector.tsx
│   │   │   │   └── CaptionPreview.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useTranscription.ts
│   │   │   │   └── useCaptionRender.ts
│   │   │   ├── services/
│   │   │   │   └── caption-builder.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── transcription/           # Standalone transcription tool
│   │   │   ├── components/
│   │   │   │   ├── TranscriptionScreen.tsx
│   │   │   │   └── TranscriptViewer.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useTranscription.ts # reuses captions hook
│   │   │   └── types.ts
│   │   │
│   │   └── render-queue/            # Render queue management
│   │       ├── components/
│   │       │   ├── RenderScreen.tsx
│   │       │   ├── RenderItem.tsx
│   │       │   └── RenderProgress.tsx
│   │       ├── hooks/
│   │       │   └── useRenderQueue.ts
│   │       ├── services/
│   │       │   └── queue-manager.ts
│   │       └── types.ts
│   │
│   └── shared/                      # Shared between main + renderer
│       ├── ipc/
│       │   ├── channels.ts          # Channel name constants
│       │   ├── types.ts             # Request/response types per channel
│       │   └── preload.ts           # Preload script (contextBridge)
│       ├── types/
│       │   ├── project.ts           # Project, folder, file types
│       │   ├── template.ts          # Template store types
│       │   ├── render.ts            # Render job types
│       │   ├── media.ts             # Media file types
│       │   └── whisper.ts           # Whisper model + transcript types
│       └── constants.ts             # App-wide constants
│
├── resources/                       # Static assets bundled with app
│   ├── icons/                       # App icons (icns + ico)
│   └── binaries/                    # ffmpeg, whisper.cpp (per-platform)
│
└── scripts/
    ├── download-ffmpeg.ts           # Downloads platform-specific ffmpeg
    └── download-whisper.ts          # Downloads whisper.cpp binary
```

---

## Build phases

### Phase 0: Project scaffold
- [ ] Initialize Electron + Vite + React + TypeScript project
- [ ] Configure electron-builder for macOS + Windows
- [ ] Set up Tailwind CSS with dark theme
- [ ] Create folder structure (all empty modules with index.ts barrel exports)
- [ ] Configure path aliases (@main, @renderer, @features, @shared)
- [ ] Set up preload script with contextBridge
- [ ] Create typed IPC foundation (channels.ts, types.ts, register.ts)
- [ ] Verify app launches with blank window on both platforms

**Completion test:** `npm run dev` opens an Electron window with a dark background and "VidTSX Studio" title bar.

---

### Phase 1: App shell + navigation
- [ ] Build sidebar with 7 nav items (Files, Editor, Templates, Media, Captions, Transcribe, Render)
- [ ] Implement screen routing (no react-router — simple state-based switching)
- [ ] Build title bar component (custom, frameless window)
- [ ] Create reusable UI primitives: Button, Input, Panel, Badge, ProgressBar
- [ ] Create placeholder screens for each feature
- [ ] Implement window state persistence (size, position)

**Completion test:** clicking sidebar icons switches between 7 placeholder screens. Window remembers size/position on restart.

---

### Phase 2: Workspace + file management
- [ ] Build FileTree component with folder/file hierarchy
- [ ] Implement file system operations in main process (read/write/delete/rename)
- [ ] "Import TSX" button — file picker + drag-and-drop onto window
- [ ] "Paste TSX" — detect TSX in clipboard, create temp file
- [ ] Create/rename/delete folders
- [ ] Persist project structure to `~/.vidtsx/projects.json`
- [ ] File selection → emits event that player/editor screens consume

**Completion test:** user can create folders, import .tsx files via drag-drop, see them in tree, rename/delete. Project persists on restart.

---

### Phase 3: Remotion player integration
- [ ] Install @remotion/player, @remotion/cli, remotion
- [ ] Build VideoPlayer wrapper component
- [ ] Build Timeline with play/pause, scrub, frame counter, duration
- [ ] Dynamic composition loading from TSX file path
- [ ] Wire file selection → player loads composition
- [ ] Handle player errors gracefully (invalid TSX, missing deps)
- [ ] Support common resolutions: 1080p, 720p, 4K, vertical (1080x1920)

**Completion test:** select a .tsx file from workspace → Remotion player previews it with working timeline controls.

---

### Phase 4: Code editor + props panel
- [ ] Integrate Monaco Editor (@monaco-editor/react)
- [ ] Load selected file content, save on change (debounced)
- [ ] TypeScript + TSX language support with IntelliSense
- [ ] Build props parser (TS AST → extract component inputProps with defaults)
- [ ] Build PropsPanel: auto-generates form fields from parsed props
- [ ] Prop field types: text, number, color (picker), select, boolean (toggle), file (media picker)
- [ ] Props changes → update player preview in real-time
- [ ] OutputSettings panel: format, resolution, FPS selectors
- [ ] Split view: code top, player bottom (resizable divider)

**Completion test:** open .tsx file → see code on left, props auto-detected on right, change a prop → player updates live.

---

### Phase 5: Render engine
- [ ] Install @remotion/renderer, @remotion/bundler
- [ ] Bundle ffmpeg binary per platform (extraResources)
- [ ] Build remotion-renderer service in main process
- [ ] Build remotion-bundler service (Webpack compilation of TSX)
- [ ] Create render queue: add jobs, track progress, cancel
- [ ] IPC: renderer sends render request → main process runs renderMedia()
- [ ] Progress reporting via IPC (frame count, percentage, ETA)
- [ ] Output formats: MP4 (H.264), WebM (VP8/VP9), GIF
- [ ] Render queue UI: list view with progress bars, status badges
- [ ] "Open in Finder/Explorer" button for completed renders
- [ ] Error handling: show meaningful errors for common failures

**Completion test:** import a TSX file, preview it, hit "Render" → MP4 file appears in output folder with progress shown in queue.

---

### Phase 6: Media library — RETIRED (2026-08-16)

Originally: cloud media storage via an API proxy at learnwithhasan.com backed by S3.
**Cut with the whole backend-API track** — the app is local-first with no hosted services
(solo-builder scope; see V1_RELEASE_PLAN.md session log 2026-08-16). Local media handling
is covered by the Assets library that was actually built instead.

---

### Phase 7: Template store — RETIRED (2026-08-16)

Originally: a free/pro template store served by the learnwithhasan API with license tiers.
**Cut with the backend-API track.** The current direction is simpler and serverless:
template packs distributed as files from vidtsx.com / GitHub Releases, announced through
the Phase I feed (V1_RELEASE_PLAN.md) — free packs as the email lead magnet, paid packs as
a later monetization step under FSL (see "Source license" below). No license checks, no
API, no server.

---

### Phase 8: Caption generator
- [ ] Build whisper.cpp binary management (download, platform detect)
- [ ] Whisper model downloader: tiny, base, small, medium, large
- [ ] Model storage in `~/.vidtsx/models/`
- [ ] Audio extraction from MP4 (ffmpeg → WAV)
- [ ] Transcription service: whisper.cpp → JSON with word-level timestamps
- [ ] Caption template selector (connects to template store caption category)
- [ ] Caption preview in Remotion player
- [ ] Render options: WebM overlay (transparent), burn into video, export JSON
- [ ] Progress reporting during transcription

**Completion test:** drop MP4 → select whisper model → transcribe → pick caption template → preview captions → render WebM overlay.

---

### Phase 9: Standalone transcription tool
- [ ] Transcription screen (reuses whisper service from Phase 8)
- [ ] Drop audio/video → transcribe
- [ ] Transcript viewer with timestamps
- [ ] Export as: JSON, SRT, VTT, TXT
- [ ] Copy transcript to clipboard
- [ ] Language selection dropdown

**Completion test:** drop MP3 → transcribe with selected model → view transcript → export as SRT.

---

### Phase 10: Polish + distribution
- [ ] Auto-updater (electron-updater, GitHub Releases)
- [ ] App icons (macOS icns + Windows ico)
- [ ] Settings screen: provider API key management, default output folder, whisper models, about
- [ ] Error boundary + crash reporter
- [ ] First-launch onboarding (3-step: import first file, preview, render)
- [ ] Code signing (macOS notarization + Windows signing)
- [ ] Build + publish CI (GitHub Actions)
- [ ] Installer UX: DMG background, NSIS installer

**Completion test:** `npm run build` produces signed .dmg and .exe installers that auto-update.

---

## Key technical decisions

### Source license (decided 2026-08-16)

VidTSX Studio releases under **FSL-1.1-MIT** (Functional Source License, written by Sentry —
also used by GitButler). What it means:

- Anyone can use, modify, and fork the app for free — including for commercial video work.
- Nobody may use the code to build a product or service that competes with VidTSX
  (no rebrands-for-sale, no "VidTSX Cloud" by a third party).
- Each release automatically converts to plain **MIT after 2 years**.

Consequences that shape everything else:

- **Marketing language is "free and source-available" (fair source), never "open source"** —
  FSL is not OSI-approved and misusing the term invites (justified) backlash on HN/Reddit.
- **CLA before the first outside PR** (cla-assistant GitHub app) so relicensing rights are
  retained. Solo project today, but this cannot be added retroactively.
- **README carries a Remotion note**: VidTSX itself is free; the underlying Remotion engine
  is free for individuals and companies up to 3 people — larger companies need their own
  Remotion company license (Remotion licenses the *user*, not just the developer).
- The non-forkable identity is the **name + vidtsx.com + the update/announcement feeds** —
  keep those under Hasan's control regardless of what happens to the code.
- Hasan is the only party who can sell commercially in the ecosystem (template packs,
  addons) — that is the long-term monetization seam, deliberately deferred for now.

### Dynamic TSX loading strategy
The hardest part of the app is loading arbitrary TSX files in the Remotion player. Strategy:
1. User imports/creates a .tsx file
2. Main process runs `@remotion/bundler` → creates a Webpack bundle
3. Bundle is served locally (express or file:// protocol)
4. Renderer loads the bundle URL in `@remotion/player`
5. Caching: re-bundle only when file content changes (hash check)

**Important:** bundling must handle arbitrary npm imports. We use a pre-configured Webpack config that resolves from a shared `node_modules` in `~/.vidtsx/node_modules/`. Users can run `npm install <package>` in the app's terminal to add deps.

### Whisper.cpp strategy
We use whisper.cpp (C++ binary) rather than OpenAI's Python Whisper because:
- No Python dependency
- Smaller binary (~5MB)
- Runs as a child process, easy to kill/cancel
- Cross-platform without environment issues

Binary is downloaded on first use, not bundled (saves 5MB per platform from installer).

### No backend API — local-first (decided 2026-08-16; replaces the retired "API proxy architecture")

The learnwithhasan.com API proxy (media-to-S3, template store, license tiers) is **cut
entirely**. The app is local-first and serverless: no user accounts, no VidTSX API key,
no cloud storage, no quota. Hosted services are out of scope for a solo builder — this
also removes a whole class of credential/decompilation risk the old design existed to
mitigate.

What remains network-facing, all outbound-only and disclosed in the README:

- **Provider APIs** (Claude, fal, AssemblyAI, …) called with the *user's own* keys —
  keys held in the main process (`safeStorage` per Phase E/Q4), never the renderer.
- **Auto-update feed** (electron-updater, GitHub Releases / vidtsx.com).
- **Announcements feed** — static `vidtsx.com/app/feed.json`, data-only
  (V1_RELEASE_PLAN.md Phase I).
- **Binary/model downloads on first use** (whisper.cpp, sd-cli, models).

The security principles from the retired design survive as rules: nothing secret ships
in the app bundle, and any key the app stores stays main-process-only behind IPC.

### IPC safety
All IPC uses `ipcMain.handle` / `ipcRenderer.invoke` (promise-based).
Never use `ipcRenderer.send` (fire-and-forget) except for progress events.
All channels validated against the typed channel map at runtime.

---

## Dependencies (core)

> **Versions verified: March 14, 2026.** Pin exact versions (no ^ or ~) for Remotion packages.
> Remotion requires ALL @remotion/* packages to be the SAME exact version.

```
# Runtime
electron: 41.0.2                    # Latest stable (Chromium 144, supports ESM)
react: 19.2.4                       # Latest stable (Remotion 4 supports React 19)
react-dom: 19.2.4                   # Must match react version

# Build tooling
typescript: 5.9.3                   # Latest stable (6.0 is RC only — do not use yet)
electron-vite: 5.0.0               # Electron + Vite integration (handles main/preload/renderer)
vite: 7.3.x                        # Use Vite 7.x — Vite 8.0 released Mar 13 but electron-vite
                                    # hasn't confirmed Vite 8 support yet. Upgrade when electron-vite
                                    # publishes a Vite 8-compatible release.
tailwindcss: 4.2.1                  # Latest stable (v4 architecture, CSS-first config)
@tailwindcss/vite: 4.2.1           # Vite plugin for Tailwind v4

# Remotion (ALL must be exact same version — no ^ prefix)
remotion: 4.0.435
@remotion/player: 4.0.435
@remotion/renderer: 4.0.435
@remotion/bundler: 4.0.435
@remotion/cli: 4.0.435

# Editor
@monaco-editor/react: 4.7.0        # Latest stable (supports React 19)

# Cloud / API — none. No backend, no S3 SDK (see "No backend API" decision).
# Outbound calls (provider APIs, feeds, binary downloads) use native fetch in main.

# Packaging & updates
electron-builder: 26.8.1           # Latest stable
electron-updater: 6.8.3            # Latest stable

# DO NOT USE
# @electron/remote — deprecated, security risk. Use IPC instead.
# vite: 8.x — wait for electron-vite to confirm compatibility
# typescript: 6.x — still in RC, not stable
```

### Compatibility notes

- **React 19 + Remotion 4:** Fully supported since Remotion v4.0.236. The Remotion Editor Starter template uses React 19 + Tailwind v4 as its default stack.
- **Electron 41 + Vite 7:** electron-vite 5.0 is the bridge. It handles separate Vite configs for main, preload, and renderer processes.
- **Tailwind v4:** Uses CSS-first configuration (`@import "tailwindcss"` in CSS) instead of the old `tailwind.config.js` approach. The `@tailwindcss/vite` plugin handles compilation.
- **Networking:** Node.js native `fetch()` (available in Electron 41) covers all outbound calls (provider APIs, feeds, downloads). Provider keys are encrypted at rest using `safeStorage` and only decrypted in the main process.

---

## Status tracking

After completing each phase, update STATUS.md with:
- Phase number + name
- Completion date
- Any deviations from the plan
- Known issues or tech debt to address later
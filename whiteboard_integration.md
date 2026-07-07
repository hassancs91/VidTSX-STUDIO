# VidTSX Whiteboard Studio — Integration Plan

> Companion to [whiteboard_studio.md](whiteboard_studio.md). That doc covers the **engine** (animator, hand follower, canvas). This doc covers the **wiring** (where files live, how the feature plugs into the app shell, what to reuse from existing modules).

## How to use this document

Same rules as `whiteboard_studio.md`:

1. Work through steps **in order**.
2. Each step has a **Done when** clause. The step is not complete until that check passes.
3. When a step is done, change `[ ]` to `[x]` in this file. Commit the file change with the step's code.
4. If a step fails or reveals a wrong assumption, **stop and surface the problem** — do not invent workarounds.
5. Suggested commit prefix: `whiteboard-integration: <step> <title>`.

This doc and `whiteboard_studio.md` are **sibling specs**. They interleave: typically you'll do an integration phase, then an engine phase, then back. Each step here calls out which `whiteboard_studio.md` step it pairs with.

**MVP integration target:** the new feature appears in the sidebar, users can create / open / save / delete whiteboard projects from a start page, and the three-pane editor is ready to host the engine work from `whiteboard_studio.md` Phases 1–3.

---

## Phase A — Module scaffold

- [x] **A.1** Create the feature folder layout under [src/features/whiteboard/](src/features/whiteboard/) — subfolders `components/`, `hooks/`, `services/`, plus `types.ts` and `index.ts` at the root. Match the layout of [src/features/motion/](src/features/motion/) and [src/features/image-studio/](src/features/image-studio/).
  *Done when:* the folders exist with stub files; type-check still passes.

- [x] **A.2** Define the four core types in [src/features/whiteboard/types.ts](src/features/whiteboard/types.ts): `DrawableAsset`, `HandConfig`, `Scene`, `AnimatorState`. These are the conceptual shapes from `whiteboard_studio.md`'s "What the studio needs to model" section. Pairs with **`whiteboard_studio.md` step 0.2**.
  *Done when:* type-check passes; types are importable from elsewhere.

- [x] **A.3** Add a placeholder [src/features/whiteboard/components/WhiteboardScreen.tsx](src/features/whiteboard/components/WhiteboardScreen.tsx) — a single `<div>` with the feature name, no layout yet. Pairs with **`whiteboard_studio.md` step 0.1**.
  *Done when:* component compiles and renders without errors when imported.

- [x] **A.4** Create the barrel [src/features/whiteboard/index.ts](src/features/whiteboard/index.ts) exporting `WhiteboardScreen` and the public types. Mirror [src/features/motion/index.ts](src/features/motion/index.ts) — barrel exports only the Screen + key types, nothing internal.
  *Done when:* `import { WhiteboardScreen } from '@features/whiteboard'` resolves cleanly.

---

## Phase B — Wire into the app shell

- [x] **B.1** Add `whiteboard: false` to [src/shared/feature-flags.ts](src/shared/feature-flags.ts). Production-gated until MVP ships; auto-enabled in DEV via the existing `import.meta.env.DEV` check.
  *Done when:* the flag exists; the feature is hidden in a production build, visible in dev.

- [x] **B.2** Import `WhiteboardScreen` and register it in the `screens` map in [src/renderer/App.tsx](src/renderer/App.tsx) under the key `'whiteboard'`.
  *Done when:* dispatching `vidtsx:navigate` with `{ screen: 'whiteboard' }` activates the placeholder screen.

- [x] **B.3** Add a nav entry to `navItems` in [src/renderer/components/Sidebar.tsx](src/renderer/components/Sidebar.tsx). Suggested: `id: "whiteboard"`, `label: "Scribe"` (10-char display fits), `icon: <PenTool ... />` from lucide-react. Place between `creator` and `studio` so generative tools cluster together. If the label/icon don't fit the brand, pick alternatives before continuing.
  *Done when:* sidebar renders the new entry with the icon + label; clicking it activates the screen.

- [x] **B.4** Smoke-test navigation. Open the app in dev, click the new sidebar entry, navigate away, navigate back. The placeholder mounts and unmounts without errors.
  *Done when:* no console errors; visited-screen state in `App.tsx` correctly toggles `display: 'contents'/'none'` for the new screen.

---

## Phase C — Three-pane shell

This phase pairs with **`whiteboard_studio.md` step 0.3** but expands its two-pane sketch to the three-pane pattern every existing VidTSX feature uses. Reference: [src/features/motion/components/MotionScreen.tsx](src/features/motion/components/MotionScreen.tsx).

- [x] **C.1** Replace the placeholder with a 40px top toolbar (label + future metadata slot) and a horizontal flex container below it for the panes. Use Tailwind tokens (`bg-app-surface`, `var(--color-border)`) — no CSS modules, no styled-components.
  *Done when:* toolbar renders, container takes the remaining height correctly.

- [x] **C.2** Add a left collapsible pane (~280px default) for controls (Play/Pause/Restart, speed slider — populated in `whiteboard_studio.md` Phase 3). Use the same `useState` for width + a `useRef` resize-flag pattern as `MotionScreen`. Insert a 4px `cursor-col-resize` drag handle.
  *Done when:* left pane renders, can be resized and collapsed.

- [x] **C.3** Add a center fluid pane (`flex-1`) that will host the canvas in `whiteboard_studio.md` Phase 3. For now, render an empty bordered area as a placeholder.
  *Done when:* center pane fills remaining space and resizes correctly when the left pane changes width.

- [x] **C.4** **Defer** the right (library) pane to `whiteboard_studio.md` Phase 5. Do not stub it — leave the layout two-pane until then. This keeps MVP focused.
  *Done when:* layout is two-pane; no dead code for a third pane.

> Note: after Phase D below, this three-pane shell becomes the **editor view** shown only inside an open project. The library view is the screen's default state when no project is active.

---

## Phase D — Project lifecycle (DB + IPC + library view + auto-save)

This phase adds project persistence so users can create, save, open, and delete whiteboard projects. Pattern mirrors Studio. Run before `whiteboard_studio.md` Phase 1 — the engine writes its scene state into a real project.

Single `whiteboard_projects` SQLite table with columns: `id`, `name`, `scene` (JSON of `Scene`), `thumbnail` (base64 PNG, nullable), `created_at`, `updated_at`. Auto-save debounced 500ms. Thumbnails generated renderer-side from the scene's first asset SVG.

### D.a — Backend (main process)

- [x] **D.1** Create [src/main/services/whiteboard-projects-db.ts](src/main/services/whiteboard-projects-db.ts). Mirror [studio-projects-db.ts](src/main/services/studio-projects-db.ts): SQLite at `userData/whiteboard-projects/whiteboard.db`, single table `whiteboard_projects` with the columns above. CRUD: `listProjects`, `saveProject`, `loadProject`, `deleteProject`. WAL journal mode like Studio.
  *Done when:* a script can create + list + load + delete a row.

- [x] **D.2** Create [src/main/services/whiteboard-projects-migrate.ts](src/main/services/whiteboard-projects-migrate.ts). Stub `migrateWhiteboardProjects()` that ensures the directory exists. No legacy data to import; the file exists for convention so future migrations have a home. Mirror the shape of [studio-projects-migrate.ts](src/main/services/studio-projects-migrate.ts).
  *Done when:* function callable, no-op on first run.

- [x] **D.3** Wire the migration in [src/main/index.ts](src/main/index.ts) next to `migrateStudioProjects()` (around line 137).
  *Done when:* app launches with no errors and the `whiteboard-projects/` directory appears in `userData`.

### D.b — IPC plumbing

- [x] **D.4** Add channels to [src/shared/ipc/channels.ts](src/shared/ipc/channels.ts): `WHITEBOARD_PROJECT_LIST`, `WHITEBOARD_PROJECT_SAVE`, `WHITEBOARD_PROJECT_LOAD`, `WHITEBOARD_PROJECT_DELETE`. Place next to the `STUDIO_PROJECT_*` block.
  *Done when:* type-check passes.

- [x] **D.5** Add types to [src/shared/ipc/types.ts](src/shared/ipc/types.ts): `WhiteboardProjectData` (`id`, `name`, `scene`, `thumbnail?`, `createdAt`, `updatedAt`) plus four request/response interfaces. Use the `Scene` type from [src/features/whiteboard/types.ts](src/features/whiteboard/types.ts).
  *Done when:* type-check passes.

- [x] **D.6** Create [src/main/ipc/whiteboard-handlers.ts](src/main/ipc/whiteboard-handlers.ts) with four handlers mirroring [studio-handlers.ts](src/main/ipc/studio-handlers.ts): each wraps the DB call in try/catch and returns `{ success, error?, ...data }`.
  *Done when:* handlers compile and are exported.

- [x] **D.7** Register the handlers in [src/main/ipc/register.ts](src/main/ipc/register.ts) (or wherever Studio's are registered). Wire `ipcMain.handle` for each channel.
  *Done when:* renderer calls succeed without "no handler" errors.

- [x] **D.8** Expose the handlers in the preload script so they're callable as `window.api.whiteboardProjectList()` etc. Match how Studio's are exposed.
  *Done when:* `window.api` has the four whiteboard methods at runtime.

### D.c — Renderer hook + service

- [x] **D.9** Create [src/features/whiteboard/services/whiteboard-service.ts](src/features/whiteboard/services/whiteboard-service.ts) — thin IPC wrappers (`fetchProjectList`, `saveProject`, `loadProject`, `deleteProject`) plus `generateProjectId()` and `generateProjectName()`. Mirror [studio-service.ts](src/features/studio/services/studio-service.ts).
  *Done when:* importable and typed.

- [x] **D.10** Create [src/features/whiteboard/hooks/useWhiteboardProject.ts](src/features/whiteboard/hooks/useWhiteboardProject.ts). Mirror [useStudioState.ts](src/features/studio/hooks/useStudioState.ts). State: `status` (`'list' | 'loading' | 'ready' | 'error'`), `projects[]`, `currentProject`, `error`. Actions: `createProject`, `openProject`, `removeProject`, `closeProject`, `renameProject`, `updateScene`. Auto-save via 500ms `setTimeout` debounce ref; flush on `closeProject`.
  *Done when:* hook returns the expected shape; create + open + save + close round-trips through the DB.

### D.d — Library view (start page)

- [x] **D.11** Create [src/features/whiteboard/components/WhiteboardLibrary.tsx](src/features/whiteboard/components/WhiteboardLibrary.tsx). Model after [slides-editor/components/ProjectList.tsx](src/features/slides-editor/components/ProjectList.tsx): responsive grid (`grid-cols-2 xl:grid-cols-3`), each card is aspect-video thumbnail + title + last-modified date, hover overlay with delete. Empty state when `projects` is empty: centered icon + "Create your first whiteboard project" + primary "New Project" button.
  *Done when:* renders the empty state for zero projects and the grid for one or more.

- [x] **D.12** Create [src/features/whiteboard/components/WhiteboardProjectCard.tsx](src/features/whiteboard/components/WhiteboardProjectCard.tsx). Single card: thumbnail (gray placeholder if null), name, last-modified, hover delete. Click → `onOpen(id)`. Confirm before delete (use existing dialog primitive or a simple confirm).
  *Done when:* card renders and click + delete callbacks fire correctly.

### D.e — WhiteboardScreen rewire (two-view shell)

- [x] **D.13** Extract the existing three-pane shell from [WhiteboardScreen.tsx](src/features/whiteboard/components/WhiteboardScreen.tsx) into a new [WhiteboardEditor.tsx](src/features/whiteboard/components/WhiteboardEditor.tsx). `WhiteboardScreen` becomes a router: when `useWhiteboardProject().status === 'list'`, render `<WhiteboardLibrary>`; otherwise render `<WhiteboardEditor>`.
  *Done when:* navigation between library and editor works on create / open / close.

- [x] **D.14** Add to the editor toolbar: a "← Back to Projects" button (calls `closeProject`, flushes pending save) and an inline-editable project name (calls `renameProject` on blur). Replace the static "Whiteboard" label.
  *Done when:* toolbar shows the project name editable; the back button returns to the library and the new project appears in the grid.

### D.f — Thumbnail generation

- [x] **D.15** Create [src/features/whiteboard/services/scene-thumbnail.ts](src/features/whiteboard/services/scene-thumbnail.ts). Export `generateSceneThumbnail(scene: Scene): Promise<string>`. Implementation: serialize the scene's first asset to an SVG string, render it through a hidden `Image` to a 320×180 canvas, return `canvas.toDataURL('image/png')`. Renderer-side only, no IPC. Return empty string if the scene has no assets.
  *Done when:* callable with a sample asset, returns a non-empty data URL.

- [x] **D.16** In `useWhiteboardProject`, on every auto-save tick, regenerate the thumbnail before the `saveProject` IPC call. Skip thumbnail regen if the scene hasn't changed since the last save.
  *Done when:* editing a project produces a card thumbnail that updates when you return to the library.

### D.g — Verification

- [ ] **D.17** Lifecycle smoke test:
  1. Open Whiteboard fresh → empty state with "Create your first whiteboard project" + button.
  2. Click **New Project** → editor opens; toolbar shows the new project's auto-generated name.
  3. Edit the project name inline → blur → re-open the screen → name persists.
  4. Click **← Back to Projects** → library shows the new project as a card with a thumbnail (or placeholder if no scene yet).
  5. Click the card → editor reopens with the saved scene loaded.
  6. Click the delete button on a card → confirm → project disappears.
  7. Restart the app → projects persist across launches.
  *Done when:* all seven steps pass without console errors.

---

## Phase E — Reuse map (reference, not steps)

Pin these decisions down before coding the engine, so we don't pivot mid-build.

**Reuse:**

- Layout shell + resize handles → copy structure from [MotionScreen.tsx](src/features/motion/components/MotionScreen.tsx).
- Speed slider → native `<input type="range">` per [GifPlayer.tsx](src/features/motion/components/GifPlayer.tsx) and [BulkControlPanel.tsx](src/features/image-studio/components/BulkControlPanel.tsx). No shared slider primitive exists.
- Buttons → [src/shared/components/Button.tsx](src/shared/components/Button.tsx), [IconButton.tsx](src/shared/components/IconButton.tsx).
- Toast feedback → `useToast()` from [src/renderer/contexts/ToastContext.tsx](src/renderer/contexts/ToastContext.tsx).
- Phase 5 SVG library panel → model after [MotionLibraryPanel.tsx](src/features/motion/components/MotionLibraryPanel.tsx) or [ImageGallery.tsx](src/features/image-studio/components/ImageGallery.tsx).

**Build fresh:**

- `usePathAnimator` hook — `whiteboard_studio.md` requires DOM-only updates via `setAttribute` to avoid per-frame React rerenders. Existing RAF hooks like [useSmoothProgress.ts](src/features/motion/hooks/useSmoothProgress.ts) and [usePlayerState.ts](src/features/player/hooks/usePlayerState.ts) drive React state per frame — wrong shape for this. Reference them only for the `cancelAnimationFrame` cleanup pattern.
- `path-measure.ts` wrappers — no existing `getTotalLength` / `getPointAtLength` utilities anywhere.
- `HandFollower` — no existing SVG transform composition utilities.

**Do not reuse:**

- Remotion Player / Timeline / PlayerControls — overkill for an SVG canvas and tightly coupled to Remotion. `whiteboard_studio.md` Phase 21 is when Whiteboard Studio touches Remotion.
- No new IPC channels for MVP — the MVP runs entirely in the renderer (sample asset hardcoded). IPC enters at `whiteboard_studio.md` Phase 9 (custom SVG upload).

---

## Phase F — End-to-end smoke test (after `whiteboard_studio.md` Phase 3 completes)

- [ ] **F.1** `npm run dev` — app launches, no TS or console errors.
  *Done when:* dev server runs and the app reaches the home screen.

- [ ] **F.2** Sidebar shows the new Whiteboard entry with the chosen icon and label.
  *Done when:* visual confirmation; clicking activates the screen.

- [ ] **F.3** Sample house draws itself stroke-by-stroke with the pencil tip on the active path edge in correct draw order.
  *Done when:* visual confirmation matches `whiteboard_studio.md` step 3.3.

- [ ] **F.4** Play / Pause / Restart all behave correctly.
  *Done when:* matches `whiteboard_studio.md` step 1.8 + 3.3 acceptance.

- [ ] **F.5** Speed slider (0.25x–3x) changes drawing speed in real time; status line updates each frame.
  *Done when:* matches `whiteboard_studio.md` step 3.4 acceptance.

- [ ] **F.6** Switch to another screen and back — Whiteboard re-mounts cleanly with no leaked RAF loops (check the Performance tab or console).
  *Done when:* no warnings or runaway frame counters.

- [ ] **F.7** `npm run type-check` and `npm run lint` both pass.
  *Done when:* both commands exit 0.

- [ ] **F.8** Create a project, draw the sample house, navigate away from the Whiteboard screen and back — the drawing state and project context persist (auto-save fired, scene reloaded).
  *Done when:* the open project remains active after a screen switch with the scene intact.

- [ ] **F.9** Return to the library — the project's card thumbnail reflects the latest scene (not a stale or empty placeholder).
  *Done when:* visual confirmation; thumbnail matches the recently-drawn content.

🎯 **MVP integration done.** Stop. Ship internally per `whiteboard_studio.md` instruction. Future phases of `whiteboard_studio.md` (multi-asset scenes, SVG library, custom upload, timeline, Remotion export) will be detailed before each starts.

---

## Notes for the implementer

- **One commit per step.** Suggested message: `whiteboard-integration: <step> <title>`.
- **The four core types are the contract** shared with `whiteboard_studio.md`. If a step seems to require changing them, stop and ask.
- **This doc and `whiteboard_studio.md` are sibling specs.** If they conflict, surface it — don't pick one silently.

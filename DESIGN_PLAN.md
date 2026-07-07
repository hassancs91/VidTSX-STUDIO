# Design Feature — Plan & Status

> Canva-style workspace for single-canvas creative outputs (YouTube thumbnails, banners, social posts, etc.). Multi-page outputs (carousels) stay in the existing `slides-editor` feature.

**Started:** 2026-05-04
**Phase 1 (foundation) status:** ✅ Complete
**Sidebar position:** between Writer and Studio (icon: `Palette`)

---

## What this feature is

A new top-level screen at `id: "design"` that mirrors the Writer feature's project model:

- **Project** — a container the user creates ("YouTube Channel Q2", "Client X assets", etc.).
- **Design** — a single canvas inside a project, with a **kind** that fixes its dimensions and (eventually) its tooling. First two kinds shipped:
  - `youtube_thumbnail` — 1280 × 720, 16:9
  - `youtube_banner`   — 2560 × 1440, 16:9 (safe area 1546 × 423)

Each design kind is meant to grow its own internal logic — for YouTube Thumbnail, that's planned to include AI Idea generation and Image Generation panels (deferred to Phase 2).

---

## Architecture decisions

### 1. Kind registry (extensibility hinge)

All design kinds live in a single registry: [src/features/design/services/design-kinds.ts](src/features/design/services/design-kinds.ts).

```ts
export interface DesignKindDef {
  id: DesignKind;
  label: string;
  description: string;
  width: number;
  height: number;
  aspectLabel: string;
  toolPanels?: Array<{ id: string; label: string }>;  // reserved for Phase 2
}
```

**Adding a new kind = one entry in this file.** The kind picker, canvas dimensions, and (later) the tools side panel are all driven from this registry. Main process never imports it — DB stores `kind` as a TEXT column; the union type in `@shared/ipc/types` enforces values across the wire.

### 2. Canvas is a placeholder, not a real editor

`DesignCanvas.tsx` renders an empty white `<div>` sized to the design's pixel dimensions, scaled-to-fit with zoom controls (Ctrl/Cmd + scroll, or the +/-/Fit buttons in the bottom-right). No editing library committed to yet.

The DB persists `canvas_json TEXT NOT NULL DEFAULT '{}'` per design so we can plug in fabric.js / konva / a custom editor later without a schema migration.

### 3. Persistence: SQLite, mirroring Writer

`userData/design-projects/design-projects.db` with two tables and FK cascade:

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE designs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  width INTEGER NOT NULL,        -- denormalised from registry at create time
  height INTEGER NOT NULL,
  canvas_json TEXT NOT NULL DEFAULT '{}',
  thumbnail_data_url TEXT,        -- nullable, for design-card preview later
  order_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

`width`/`height` are stored on each design (not just looked up from the registry) so historical designs survive registry changes.

### 4. Three-state screen, no router

[DesignScreen.tsx](src/features/design/components/DesignScreen.tsx) toggles between three views purely with `useState`, mirroring [WriterScreen.tsx](src/features/writer/components/WriterScreen.tsx):

```
ProjectList ──[+ New project]──▶ NewProjectModal ─┐
   │                                               │
   │ click card                                    ▼
   ▼                                       ProjectView (auto-opens new project)
ProjectView ──[+ New design]──▶ NewDesignModal (kind picker)
   │                                               │
   │ click design card                             ▼
   ▼                                       DesignEditor (auto-opens new design)
DesignEditor (toolbar + zoom-to-fit canvas + reserved tool-panel slot)
```

---

## Phase 1 — what's done

### IPC contract

- 9 channels added in [src/shared/ipc/channels.ts](src/shared/ipc/channels.ts):
  - `DESIGN_PROJECT_LIST`, `DESIGN_PROJECT_CREATE`, `DESIGN_PROJECT_LOAD`, `DESIGN_PROJECT_UPDATE`, `DESIGN_PROJECT_DELETE`
  - `DESIGN_CREATE`, `DESIGN_LOAD`, `DESIGN_UPDATE`, `DESIGN_DELETE`
- Request/Response types + domain types (`DesignKind`, `DesignProject`, `DesignProjectListItem`, `Design`, `DesignSummary`) in [src/shared/ipc/types.ts](src/shared/ipc/types.ts)

### Main process

- [src/main/services/design-projects-db.ts](src/main/services/design-projects-db.ts) — better-sqlite3 store; CRUD for projects + designs; `listProjects`, `loadProject` (returns `{ project, designs: DesignSummary[] }`), `createProject`, `updateProject`, `deleteProject`, `createDesign`, `loadDesign`, `updateDesign`, `deleteDesign`.
- [src/main/services/design-projects-migrate.ts](src/main/services/design-projects-migrate.ts) — ensures dir + lazy-inits DB on app startup.
- [src/main/ipc/design-handlers.ts](src/main/ipc/design-handlers.ts) — typed handlers wrapping each DB op in try/catch with `{ success, error?, … }` responses.
- [src/main/ipc/register.ts](src/main/ipc/register.ts) — handlers registered with `ipcMain.handle`.
- [src/main/index.ts](src/main/index.ts) — `migrateDesignProjects()` called on app ready; `closeDesignProjectsDb()` called on `will-quit`.

### Preload

- [src/preload/preload.ts](src/preload/preload.ts) — 9 functions exposed on `window.api`: `designProjectList`, `designProjectCreate`, `designProjectLoad`, `designProjectUpdate`, `designProjectDelete`, `designCreate`, `designLoad`, `designUpdate`, `designDelete`.

### Renderer feature module — [src/features/design/](src/features/design/)

```
src/features/design/
├── components/
│   ├── DesignScreen.tsx         — top-level, owns view state
│   ├── ProjectList.tsx          — grid + empty state
│   ├── ProjectCard.tsx
│   ├── NewProjectModal.tsx
│   ├── ProjectView.tsx          — designs grid for one project
│   ├── DesignCard.tsx           — shows kind + dims (or thumbnail when set)
│   ├── NewDesignModal.tsx       — kind picker (reads DESIGN_KIND_LIST)
│   ├── DesignEditor.tsx         — toolbar + canvas + reserved tools panel
│   └── DesignCanvas.tsx         — empty white canvas, zoom-to-fit, +/-/Fit
├── hooks/
│   ├── useDesignProjects.ts     — list/create/delete projects
│   ├── useDesignProject.ts      — load one project + its designs; create/delete designs
│   └── useDesign.ts             — load one design; debounced canvas save (500ms)
├── services/
│   └── design-kinds.ts          — REGISTRY (single source of truth for kinds)
├── types.ts                     — re-exports from @shared/ipc/types
└── index.ts                     — exports DesignScreen
```

### Wiring

- [src/shared/feature-flags.ts](src/shared/feature-flags.ts) — `design: true`
- [src/renderer/components/Sidebar.tsx](src/renderer/components/Sidebar.tsx) — `Palette` icon nav item between Writer and Studio
- [src/renderer/App.tsx](src/renderer/App.tsx) — `design: DesignScreen` route

### Verification

- ✅ `npx electron-vite build` passes cleanly (only pre-existing `lucide-react`/`@remotion/player` `"use client"` warnings)
- ✅ Sidebar shows Design tab
- ✅ Project list empty state → New Project → modal → auto-navigates to project view
- ✅ New design → kind picker shows YT Thumbnail (1280×720) + YT Banner (2560×1440) → editor opens with placeholder canvas at correct pixel dimensions, zoomed to fit
- ✅ Designs and projects persist in `userData/design-projects/design-projects.db`
- ✅ Cascade delete works (project → designs)

---

## Phase 2 — what's planned next

These were intentionally deferred from the foundation. Each is independently shippable.

### 2.1 Per-kind tool panels (the big one)

The architecture is already in place — `DesignKindDef.toolPanels` is reserved, and `DesignEditor.tsx` has a reserved 240px right-side panel slot. Phase 2 fleshes out the panels.

For **YouTube Thumbnail** specifically, two tools are planned:

1. **AI Idea generation**
   - Prompt user with a seed (video topic, channel niche, draft title).
   - Call the existing `llmEngine.generate({ prompt, systemPrompt })` from `src/engine` (same path Writer uses in [writer-handlers.ts:235-274](src/main/ipc/writer-handlers.ts#L235-L274)).
   - Mirror the prompt-builder pattern from [writer-ai-prompts.ts](src/main/services/writer-ai-prompts.ts) — create `design-ai-prompts.ts` with kind-specific prompt builders. e.g. `buildThumbnailIdeasPrompt(topic)`.
   - Track usage via `aiUsageService.appendEntry({ featureSource: 'design:youtube_thumbnail:ideas', … })`.

2. **Image Generation**
   - Reuse the existing image-engine: `window.api.imageGenerate(...)` with `model: 'vidtsx-image-01'` (Fast, 4 credits), `vidtsx-image-02` (Balanced, 7 credits), or `vidtsx-image-03` (High Quality, 14 credits).
   - Aspect-ratio: lock to 16:9 (1280×720 native).
   - Generated images saved to a per-design folder and exposed to the renderer via a `design-asset://` custom protocol — pattern lifted from [writer-image-store.ts](src/main/services/writer-image-store.ts) + the `writer-asset` protocol handler in [main/index.ts:191-205](src/main/index.ts#L191-L205).

**For YouTube Banner**, plausible tools (TBD with user):
- Channel logo overlay tool
- Safe-area visualization toggle (1546×423 zone)
- Banner text composer

### 2.2 Real canvas editor

Currently the canvas is a placeholder white `<div>`. Phase 2 should commit to an editor library:

- **Option A — fabric.js**: mature, large API, easy text/shape/image manipulation. Larger bundle.
- **Option B — konva** (with `react-konva`): React-friendly, more compositional. Slightly steeper learning curve.
- **Option C — tldraw**: very polished but maybe too opinionated for fixed-canvas designs.

Recommend a sit-down with the user before picking. Whatever lands, the persisted shape is `canvas_json TEXT` — serialize the editor's native state.

### 2.3 Export

- Export to PNG / JPG at native resolution (1280×720, 2560×1440).
- Use the same screenshot pipeline as image-studio (existing `screenshot:capture-html` IPC + `html2canvas`-style capture, or fabric/konva's native `toDataURL`).
- Save to `userData/design-projects/exports/` and offer "Reveal in Explorer" + "Copy to clipboard".

### 2.4 Thumbnail capture for design cards

The DB column `thumbnail_data_url` ships nullable and unused in Phase 1 (cards just show `width × height`). Phase 2 should:
- Capture a low-res preview after each canvas save (debounced).
- Store as data URL (or write a PNG file and reference by path — TBD; data URL is simpler but bloats the DB).
- Display in [DesignCard.tsx](src/features/design/components/DesignCard.tsx) (the conditional render is already there).

### 2.5 More kinds

Adding kinds is one entry in `design-kinds.ts`. Candidates:

- `instagram_post` — 1080 × 1080, 1:1
- `instagram_story` — 1080 × 1920, 9:16
- `twitter_post` — 1600 × 900, 16:9
- `linkedin_banner` — 1584 × 396
- `pinterest_pin` — 1000 × 1500, 2:3

These can each grow their own `toolPanels` in Phase 2.

### 2.6 Polish nice-to-haves

- Project rename + description edit (DB supports it; no UI yet).
- Design reorder within a project (drag-and-drop; `order_index` column already there).
- Duplicate a design ("Save as copy").
- Project search / filter on the list screen (relevant once a user has many).

---

## Notes for the next session

- **Memory note in play:** persistence is SQLite via `<feature>-db.ts` + `<feature>-migrate.ts` pair (already followed). Don't propose JSON.
- **Memory note in play:** lead with the lightest-touch fix. For Phase 2.2 in particular (canvas editor choice), confirm scope with the user before committing to a library.
- The `WRITER_EXPORT_JSON` channel and `handleWriterExportJson` import that appeared in [register.ts](src/main/ipc/register.ts) and [channels.ts](src/shared/ipc/channels.ts) during Phase 1 are unrelated to Design — they belong to the Writer feature.
- `npx electron-vite build` is the canonical build/type check (project has no `type-check` script and `tsconfig.web.json` references a missing `electron-vite/client` types file — pre-existing, not a Design issue).
- App starts the Design feature via `migrateDesignProjects()` in [main/index.ts](src/main/index.ts); DB closes via `closeDesignProjectsDb()` on `will-quit`. Both are idempotent.
- Sidebar ordering put Design between Writer (`BookOpen`) and Studio (`MonitorPlay`) — easy to move.

---

## Quick reference: how to add a new design kind

1. Edit [src/features/design/services/design-kinds.ts](src/features/design/services/design-kinds.ts):
   ```ts
   export const DESIGN_KINDS: Record<string, DesignKindDef> = {
     // … existing
     instagram_post: {
       id: 'instagram_post',
       label: 'Instagram Post',
       description: '1080 × 1080 · 1:1',
       width: 1080,
       height: 1080,
       aspectLabel: '1:1',
     },
   };
   ```
2. Add the literal to the `DesignKind` union in [src/shared/ipc/types.ts](src/shared/ipc/types.ts) (or rely on the existing `(string & {})` escape hatch — but typing it is cleaner).
3. That's it. The kind picker, dimensions, and (later) tool panels all flow from the registry.

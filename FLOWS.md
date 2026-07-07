# Flows feature — status & handoff

> **For the next session:** read this first, then `CLAUDE.md` for project-wide rules. The full original implementation plan lives at `C:\Users\hasan\.claude\plans\i-want-to-create-glittery-moth.md` (outside the repo) — this doc is the in-repo summary that survives.

## What is Flows

A ComfyUI-style visual node-graph builder. A new top-level feature peer to writer, design, image-studio. Each node is a thin adapter over an existing engine call (image generation, gallery read, etc.) — **no reimplementations**. Eventual templates ship for common scenarios.

Sidebar entry: **Flows** (Workflow icon). Feature flag: `flows: true` (visible to production users). Top-level in `src/features/flows/`.

## Locked decisions (do not re-litigate)

1. **Canvas: `reactflow@11.11.4`** — pinned exact, v12 is `@xyflow/react` and breaks imports.
2. **Outputs auto-save to Image Studio gallery** — no separate "Save" node in v1.
3. **Explicit Run button only** — no live re-run on change.
4. **Video deferred entirely** — image-only nodes in v1, no stub palette entry.
5. **Tag gallery outputs by folder** (`Flow: <flowName>`), not by prompt prefix.
6. **Flat schema** — one row per flow in a `flows` table; graph stored as `graph_json TEXT`. No project→graphs container.
7. **Renderer-side execution** — `runFlow` lives entirely in renderer, calls `window.api.imageGenerate` / `imageStudioSave`. Main is a dumb persistence layer.
8. **Templates as `.ts` not `.json`** — typed `TemplateDef` objects; build inlines them into the renderer bundle. JSON would have worked too (`resolveJsonModule: true`) but `.ts` gives compile-time validation of `GraphJson`.
9. **Thumbnails are schematic SVGs** of the topology — pure function (`GraphJson` → SVG data URL) rendered from `services/render-graph-thumbnail.ts`. Powers both the per-flow card thumbnail (regenerated on every autosave) and the template tile previews in `NewFlowDialog`. Earlier `html2canvas`-after-success approach was scrapped in favor of this — schematic is ~1-2 KB, deterministic, doesn't need a successful run, works on Blank flows.
10. **Run history stores image refs, not base64** — `generate-image.execute()` returns `{ image, imageRef }` where `imageRef` is the gallery entry id from `imageStudioSave`. `useFlowRun` strips the heavy `image` field before persisting; on hydrate, `CustomNode` lazy-fetches via `imageStudioRead({ id: imageRef })` (with an in-memory cache).
11. **In-flight imageGenerate is cancellable** — every call carries a `callId` (the run's ULID). Main keeps `Map<callId, AbortController>`; `imageGenerateCancel` IPC aborts the underlying fetch. The signal is threaded through `imageEngine.generate` into each provider's `fetch(..., { signal })`.

## Status: All phases shipped + post-launch polish locked in — feature live in production

| Phase | What | Status |
|---|---|---|
| 1 | Scaffold + DB + project CRUD + empty canvas | ✅ shipped in commit `2e6c44d` |
| 2 | Node registry + palette + inspector + edit/save graph | ✅ shipped in commit `c35b91a` |
| 3 | Execution engine + run state + per-node status UI | ✅ shipped in commit `c35b91a` |
| 4 | Auto-save outputs to per-flow gallery folder | ✅ shipped in commit `c35b91a` |
| 5 | Run history persistence + view past runs | ✅ shipped in commit `e06ef8d` |
| 6 | Templates + thumbnails + flag flip | ✅ shipped in commit `e06ef8d` |
| Polish | imageGenerate provider routing fix | ✅ `e06ef8d` |
| Polish | Run history stores image refs (no base64 bloat) | ✅ `ca21ad9` |
| Polish | In-flight imageGenerate cancellation | ✅ `c853a11` |
| Polish | Schematic SVG thumbnails + smaller cards | ✅ `39b9117` |

## Architecture in one paragraph

Each flow is a row in `flows-projects.db`'s `flows` table with the graph stored as a `graph_json` TEXT blob (mirrors `design-projects-db.ts` and `slides-projects-db.ts`). The node-type registry under `src/features/flows/nodes/` declares ports, default config, an inspector schema, and an async `execute(inputs, config, ctx)`. A reactflow canvas drives the editor; `useFlowGraph` owns nodes/edges/viewport with debounced autosave. `useFlowRun` owns `RunState` + `AbortController`, calls `runFlow` (topo-sort + per-node execute + status events), and provides per-node state via React context that `CustomNode` subscribes to. Generated images auto-save into a per-flow Image Studio folder.

## Critical files

```
src/features/flows/
  index.ts                                  # barrel: exports FlowsScreen + types
  types.ts                                  # FlowProject, GraphJson, GraphNode, GraphEdge, EMPTY_GRAPH
  components/
    FlowsScreen.tsx                         # list/editor router
    FlowProjectList.tsx                     # grid of flow cards
    FlowProjectCard.tsx
    NewFlowDialog.tsx                       # Blank tile + 3 template tiles (Phase 6)
    FlowEditor.tsx                          # 3-column shell: palette | canvas | inspector
    FlowCanvas.tsx                          # reactflow wrapper, controlled, drop-target
    CustomNode.tsx                          # single registered renderer; status colors + previews
    NodePalette.tsx                         # 200px left panel, draggable items
    NodeInspector.tsx                       # 300px right panel, dispatches on configSchema.kind
    RunControls.tsx                         # Run/Cancel + status badge in toolbar
    RunHistoryDropdown.tsx                  # Phase 5: run history picker, mounted left of RunControls
    inspector-fields/
      TextField.tsx, PromptField.tsx, NumberField.tsx, SelectField.tsx,
      ModelPickerField.tsx, GalleryImagePickerField.tsx, ImageUploadField.tsx
  nodes/
    types.ts                                # NodeTypeDefinition, ConfigField, PortDef, isPortCompatible, DATA_TYPE_COLOR
    index.ts                                # NODE_REGISTRY, NODE_TYPES_BY_CATEGORY, getNodeDef
    input-prompt.ts                         # text → text
    input-image-from-gallery.ts             # → image (calls imageStudioRead)
    input-image-upload.ts                   # → image (renderer-downscaled JPEG q=0.85, max 2048px)
    generate-image.ts                       # prompt + sourceImage? + referenceImages? → image
  hooks/
    useFlowProjects.ts                      # list/create/delete flows
    useFlowGraph.ts                         # owns nodes/edges/viewport, mutators, 500ms debounced autosave
    useFlowRun.ts                           # owns RunState + AbortController, exports RunStateProvider + useNodeRunState; persists on completion + exposes hydrate()
    useFlowRuns.ts                          # Phase 5: lists/loads persisted runs for a flow
  services/
    downscale-image.ts                      # canvas-based JPEG downscaler
    topo-sort.ts                            # Kahn's algorithm + cycle detection + validateGraph
    run-flow.ts                             # runFlow runner — emits RunUpdate events; mid-flight abort → 'cancelled' (not 'error')
    render-graph-thumbnail.ts               # Polish: pure (GraphJson → SVG data URL); used by card thumbnails AND template tiles
  templates/                                # Phase 6: starter graphs
    index.ts                                # FLOW_TEMPLATES barrel + TemplateDef type
    single-prompt-image.ts
    gallery-image-variation.ts
    reference-style-transfer.ts

src/main/
  services/
    flows-projects-db.ts                    # SQLite: flows + flow_runs tables; project CRUD + run persist/list/load/prune (cap 20)
    flows-projects-migrate.ts               # called from app.whenReady()
  ipc/
    flows-handlers.ts                       # Project CRUD + ensureFlowGalleryFolder + rename-mirror + run handlers
    registrations/flows.ts                  # ipcMain.handle bindings (per-feature module after IPC refactor)

src/shared/
  components/Select.tsx                     # shared dark-themed native <select> wrapper
  ipc/channels.ts                           # FLOWS_PROJECT_* + FLOWS_RUN_PERSIST/LIST/LOAD
  ipc/types/flows.ts                        # FlowProject + FlowRun* request/response types (per-feature module after IPC refactor)

# Touched (must keep updated when adding flows IPC) — POST-REFACTOR FILE SET:
src/shared/ipc/channels.ts                  # IPC channel constant
src/shared/ipc/types/flows.ts               # request/response types (re-exported by types/index.ts barrel)
src/preload/api/flows.ts                    # window.api.flows* methods (per-feature, after IPC refactor)
src/renderer/types/electron.d.ts            # ElectronAPI interface (manual, drift-prone — see Gotchas)
src/main/ipc/flows-handlers.ts              # handler implementations
src/main/ipc/registrations/flows.ts         # ipcMain.handle bindings

# Other touched (project-wide, less frequent):
src/main/index.ts                           # migrateFlowsProjects + closeFlowsProjectsDb
src/renderer/App.tsx                        # screens map
src/renderer/components/Sidebar.tsx         # nav item (Workflow icon)
src/shared/feature-flags.ts                 # 'flows': false
src/features/image-studio/hooks/useImageGallery.ts  # listens for vidtsx:image-studio:refresh
package.json                                # reactflow 11.11.4 + d3-* overrides
electron.vite.config.mjs                    # optimizeDeps.include for reactflow + d3-transition
```

## Data model

### `flows-projects.db`

```sql
CREATE TABLE flows (
  id                TEXT PRIMARY KEY,                  -- ULID
  name              TEXT NOT NULL,
  description       TEXT,
  graph_json        TEXT NOT NULL DEFAULT '{...}',     -- reactflow-shape: {nodes, edges, viewport}
  thumbnail         TEXT,
  gallery_folder_id TEXT,                              -- Phase 4: id of the Image Studio folder
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
```

`flow_runs` table (Phase 5, shipped):

```sql
CREATE TABLE flow_runs (
  id            TEXT PRIMARY KEY,                  -- ULID
  flow_id       TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  status        TEXT NOT NULL,                     -- 'running'|'success'|'error'|'cancelled'
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  error         TEXT,
  node_results  TEXT NOT NULL DEFAULT '{}'         -- JSON keyed by nodeId — NodeRunState shape
);
CREATE INDEX idx_flow_runs_flow ON flow_runs(flow_id, started_at DESC);
```

Capped at 20 runs per flow — `persistRun` runs INSERT + prune in a single transaction. ON DELETE CASCADE means deleting a flow drops its run history too.

### `graph_json` shape

```ts
{
  nodes: { id, type: 'flowNode', position: {x,y}, data: { typeId: string; config: Record<string, unknown> } }[],
  edges: { id, source, target, sourceHandle, targetHandle }[],
  viewport: { x, y, zoom }
}
```

All nodes share the single reactflow type `'flowNode'`; the inner `data.typeId` dispatches into `NODE_REGISTRY`. So we register **one** custom React component for all node types.

### Port data types and compatibility

`DataType = 'text' | 'image' | 'images'`. Compatibility (used by reactflow's `isValidConnection`):
- text → text ✓
- image → image ✓
- image → images ✓ (collected into array at runtime)
- images → images ✓
- everything else ✗

Handles are color-coded: text=blue, image=purple, images=pink (`DATA_TYPE_COLOR` in `nodes/types.ts`).

## v1 node set (4 nodes)

| typeId | Inputs | Outputs | execute() |
|---|---|---|---|
| `input-prompt` | — | text | returns `{ text: config.prompt }` |
| `input-image-from-gallery` | — | image | calls `window.api.imageStudioRead({ id: config.entryId })` |
| `input-image-upload` | — | image | returns `{ image: config.base64 }` (downscaled to ≤2048px JPEG q=0.85 at upload time) |
| `generate-image` | prompt:text (required), sourceImage?:image, referenceImages?:images | image | calls `window.api.imageGenerate(...)`, then `imageStudioSave({ folderId: ctx.flowFolderId })`, dispatches `vidtsx:image-studio:refresh` |

Adding a new node type = drop one file in `src/features/flows/nodes/`, add one line to `nodes/index.ts` registering it.

## Gallery integration (Phase 4)

- Each flow gets a backing Image Studio folder named `Flow: <flowName>`. Created lazy on `flowsProjectLoad` and `flowsProjectCreate` via `ensureFlowGalleryFolder`. Re-created if the user deleted it from Image Studio.
- Renaming a flow mirrors to the folder via `renameGalleryFolder`.
- Deleting a flow does **not** delete the folder (per plan Risk #9 — users may want to keep generated images).
- After successful save, `generate-image.execute()` dispatches `window.dispatchEvent(new CustomEvent('vidtsx:image-studio:refresh'))`. `useImageGallery` listens for this and reloads, so the folder + images appear in Image Studio without an app restart.

## Gotchas (load-bearing — don't trip on these)

### 1. d3 dedupe via `package.json` overrides
reactflow 11's d3-zoom calls `selection.interrupt()`, which is a side-effect patch added to `d3-selection`'s prototype by `d3-transition`. `react-simple-maps@3.0.0` hoisted `d3-selection`/`d3-zoom` v2 to the top level, while reactflow nested its own v3 copies — the patch landed on the wrong prototype. Fixed in `package.json`:

```json
"overrides": {
  "d3-selection": "^3.0.0",
  "d3-transition": "^3.0.1",
  "d3-zoom": "^3.0.0"
}
```

If react-simple-maps misbehaves in the GLB Viewer feature, this is the suspect (low risk — d3 v2→v3 API is largely compatible).

### 2. `ElectronAPI` interface is manually maintained
`src/renderer/types/electron.d.ts` is a hand-typed mirror of `preload.ts` and is chronically out of sync — many pre-existing `Property X does not exist on type 'ElectronAPI'` errors throughout the codebase. **When adding a new IPC method, update BOTH `preload.ts` AND `electron.d.ts`.** Ignore the existing drift errors for unrelated features.

### 3. Pre-existing peer-dep conflicts
Use `npm install --legacy-peer-deps`. `react-simple-maps@3.0.0` doesn't accept React 19, but the project runs fine on React 19 anyway.

### 4. Vite pre-bundle cache
If reactflow does anything weird after a reactflow-related change, clear `node_modules/.vite` and restart `npm run dev`.

### 5. `electron.vite.config.mjs` — optimizeDeps
```js
optimizeDeps: {
  include: ['reactflow', 'd3-transition']
}
```
Don't remove. Without it, the dep pre-bundler can tree-shake d3-transition's prototype patch.

### 6. Base64 IPC payload bloat (partially resolved)
A chain of generate nodes at 1024² PNG = 3-6 MB per hop, going renderer→main→renderer twice. v1 caps `numImages: 1`, defaults to JPEG. **Run history no longer suffers from this** — `useFlowRun` now strips `image` and persists only `imageRef` (the gallery entry id), and `CustomNode` lazy-fetches on hydrate via `imageStudioRead`. The live runtime path (chaining outputs between nodes during an in-progress run) still passes full base64 in memory; long-term mitigation if that becomes a problem: write generated images straight to disk in main and pass back a `vidtsx-image://` URL.

### 7. Cancellation (resolved)
`useFlowRun` aborts on unmount AND on screen change. **The active IPC `imageGenerate` call IS now aborted mid-flight**: each call carries a `callId` (the run's ULID), main keeps `Map<callId, AbortController>`, and `imageGenerateCancel` looks it up + aborts. The signal is threaded through every provider's `fetch(..., { signal })`. `run-flow.ts` distinguishes mid-fetch abort from a real exception so the run is recorded as `cancelled` (not `error`).

### 8. JSON columns
better-sqlite3 has no JSON type; we use TEXT and `JSON.parse` in row mappers. The graph parser already falls back to `EMPTY_GRAPH` on parse failure.

### 9. Provider availability at execute time
`generate-image` config stores `providerId`, but the user may have disabled that provider since save. Validate in `execute()` and surface a clear error inline on the node (already done — error appears on the node card).

## Project conventions (from CLAUDE.md, do not break)

- Feature modules are isolated — `src/features/flows/` cannot import from `src/features/writer/`. Shared code goes in `src/shared/`.
- IPC is the only renderer↔main bridge. No `require('electron')` in renderer.
- Strict TypeScript, no `any`. Functional React only. Named exports. Kebab-case files (PascalCase for `.tsx`). One export per file. ~300 lines max.
- Path aliases: `@main/`, `@renderer/`, `@features/`, `@shared/`.
- Persistence: better-sqlite3 with the `<feature>-projects-db.ts` + `<feature>-projects-migrate.ts` pair.

## Verification — current state should pass

```bash
npx tsc --noEmit -p tsconfig.web.check.json    # zero flows-related errors
npx electron-vite build                         # builds clean (~60s)
npm run dev                                     # opens app
```

Manual smoke:
1. Sidebar → Flows → New Flow → "Cat portraits"
2. Drag Prompt + Generate Image from left palette → connect Prompt's output to Generate Image's prompt input
3. Click Prompt node → type something in the inspector
4. Click Generate Image node → pick provider + model in inspector
5. Click Run in toolbar → watch nodes go idle → running (purple pulse) → done (green border, image inline on the generate node)
6. Switch to Image Studio → see `Flow: Cat portraits` folder containing the new image
7. Back to Flows → rename "Cat portraits" → "Dog portraits" → folder renames in Image Studio
8. Restart app → flow + nodes + saved viewport persist

## Phase 5 — shipped (run history)

What landed:
- `flows-projects-db.ts` — `flow_runs` table + `persistRun` / `listRuns` / `loadRun`. Insert+prune is a single transaction; cap = 20 per flow.
- `flows-handlers.ts` — `handleFlowsRunPersist` / `…List` / `…Load`. Registered in `registrations/flows.ts`.
- `useFlowRun` — now takes `flowId` and `onRunPersisted`; tracks the latest snapshot in local vars during the run and POSTs it to `flowsRunPersist` after `runFlow` resolves (success/error/cancelled — never `running`). Exposes `hydrate(runState)` for replaying past runs.
- `useFlowRuns` — list/load hook; `useEffect` refreshes when `flowId` changes.
- `RunHistoryDropdown` — toolbar component, click-outside-to-close, status icon + relative time + duration. Mounted left of `RunControls`. Disabled while `status === 'running'`.
- `FlowEditor` — wires it all together; `handleSelectRun` parses `nodeResults` JSON into `Record<string, NodeRunState>` and calls `hydrate`.

~~Known limitation: `node_results` stores full base64…~~ → resolved post-launch (commit `ca21ad9`). `useFlowRun` now strips `image` and persists only `imageRef` (gallery entry id) into `node_results`; `CustomNode` lazy-fetches via `imageStudioRead` on hydrate. See Polish section below.

## Phase 6 — shipped (templates + thumbnails + flag flip)

What landed:
- `templates/` — typed `.ts` files (not JSON; type-checked at author time). Three templates: `single-prompt-image` (the hello-world), `gallery-image-variation` (image-to-image), `reference-style-transfer` (multi-reference). Each carries stable readable IDs (`tpl-prompt`, `tpl-generate`, etc.) — different flow projects can reuse them since IDs only need to be unique within a graph.
- `NewFlowDialog` — 2-column tile grid: Blank tile + 3 template tiles, each rendering a mini schematic preview (via `render-graph-thumbnail`) plus name + description. On submit, the chosen template's `graph` is `JSON.stringify`'d into `flowsProjectCreate`'s `graphJson` field.
- Per-flow card thumbnails — schematic SVG of the topology, regenerated by `useFlowGraph` on every debounced autosave. `useFlowGraph` also backfills a thumbnail on first load when one is missing and the graph has nodes (covers template-instantiated flows that haven't been edited).
- `feature-flags.ts` — `flows: true` (was `false`). Feature is visible to production users.

Skipped from the original plan: `useCanvasShortcuts.ts`. Delete/Backspace is already wired via `deleteKeyCode` on `FlowCanvas`, autosave already runs on every change (no Cmd/Ctrl+S needed), Space-drag is reactflow's default. Adding the file would have produced a no-op hook.

Note: an earlier short-lived `capture-thumbnail.ts` (html2canvas snapshot of `.react-flow` after each successful run) was deleted in favor of the schematic approach — see Locked decision #9 and the Polish section below.

## Post-launch polish — shipped

Four follow-up commits after Phase 6 landed. None of them are new phases — each addresses a documented limitation or surfaces a design direction we wanted to lock in before opening the door to more work.

### Provider routing fix (`e06ef8d`)
`imageGenerate` always routed to `imageEngine`'s globally-active provider, even when callers stored a per-call `providerId`. Picking a Fal model in a Flow node would still hit VidTSX (the active default), throwing `Unknown model "nano-banana-pro"`. Added optional `providerId` to `ImageGenerateRequest`; handler routes via `imageEngine.generateWith(providerId, …)` when set, falls back to `generate(…)` otherwise (preserving Image Studio's old behavior). Flow nodes pass `config.providerId` along.

### Run history → image refs (`ca21ad9`)
`generate-image.execute()` captures the gallery entry id from `imageStudioSave` and returns it as `imageRef` alongside the live `image` base64. `useFlowRun.stripLargeFields()` strips `image` before persisting `node_results`, keeping the row tiny. `CustomNode`'s `OutputPreview` falls back to `useImageFromRef(imageRef)` when there's no live `image`; the hook caches results in a module-level `Map` so re-renders / repeat hydrations don't re-hit the disk.

### In-flight cancellation (`c853a11`)
Renderer's `AbortController` only stopped the runner from scheduling more nodes; the active fetch in main kept running. Now: each `imageGenerate` carries a `callId` (Flows pass `ctx.runId`); main keeps `Map<callId, AbortController>`; `imageGenerateCancel` IPC aborts and removes. `ImageGenerationRequest.signal` is threaded through `imageEngine.generate` → each provider's `fetch(..., { signal })`. `useFlowRun.cancel/reset/unmount` all call `imageGenerateCancel` for the active runId. `run-flow.ts` checks `ctx.signal.aborted` in its catch block to mark the run `cancelled` instead of `error`.

### Schematic SVG thumbnails everywhere (`39b9117`)
`render-graph-thumbnail.ts` is a pure `(GraphJson, opts?) => svgDataUrl` function: bounding-box-fit, category-colored rounded rects (input=blue, generate=purple) on a faint dot grid, with bezier edges. Used in two places:
1. **Per-flow card thumbnails** — `useFlowGraph` regenerates one inside the debounced autosave path on every graph change, plus a backfill on first load when missing. No html2canvas, no live-canvas dependency, works on Blank flows. Thumbnail JPEG (~10-50 KB) → SVG data URL (~1-2 KB).
2. **Template tile previews in `NewFlowDialog`** — same renderer, called via `useMemo` per template at dialog open. Closes the originally-skipped Phase 6 sub-item.

Card chrome shrunk: 16:9 thumb (was 3:2), tighter padding, single-line metadata; grid 3-7 columns by breakpoint (was 2-4).

## How to continue (next session)

1. Read this file, then `CLAUDE.md`.
2. Read the user's auto-memory at `C:\Users\hasan\.claude\projects\d--repos-vidtsx-desktop\memory\MEMORY.md` for personal preferences.
3. Confirm working state: `git log --oneline -8` should show the four polish commits + Phase 5/6 commit at the top.
4. **There is no pending Flows phase.** Future Flows work is open-ended — candidates the user has discussed but NOT committed to:
   - More node types (text manipulation, image upscale, batch generation)
   - Video nodes (Locked decision #4 deferred them; revisit when a real use case appears)
   - Backend-served flow templates (mirror Gallery's `vidtsx/api/library/` pattern; would unlock new templates without app updates)
   - Per-tile pre-rendered template thumbnails (currently the schematic preview is good enough — only worth doing if richer marketing imagery is needed)
5. When adding any IPC method, remember the **6 files (post-refactor)**:
   - `src/shared/ipc/channels.ts` (channel constant)
   - `src/shared/ipc/types/<feature>.ts` (request/response types — re-exported by `types/index.ts`)
   - `src/preload/api/<feature>.ts` (window.api method)
   - `src/main/ipc/<feature>-handlers.ts` (handler impl)
   - `src/main/ipc/registrations/<feature>.ts` (ipcMain.handle binding)
   - `src/renderer/types/electron.d.ts` (manual mirror — drift-prone, see Gotcha #2)

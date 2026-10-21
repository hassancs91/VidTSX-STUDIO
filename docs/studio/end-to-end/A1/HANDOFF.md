# A1 — 4K tile in New Project, 1080p + 1440p export presets, undoable project-size edits
status: DONE — exit met live (CDP, isolated profile) 2026-10-21; code `e4803cd`, docs + evidence in the commit after `639404f`

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **A1** | New Project reads the shared `FORMAT_PRESETS` (4K tile); Export gains 1080p + 1440p presets; project-size edits become an undoable action | a 3840×2160 @ 60 project from the dialog; its Export dialog lists Full, 1440p, 1080p, 720p… |

Session gates (plan §3 head): `npx vitest run` green, `npm run check:types` at or below
baseline (web 26 / node 10 at the branch point — the gate only ratchets down), a live CDP
click-through on an isolated profile, the STATUS.md row, the TESTING.md §18 block. Schema
additions are optional fields only; old projects open untouched.

## Plan context (§1.x facts, §2 decision, §5 items to read)

**§1.7 facts this part rests on** (spot-checked by the orchestrator 2026-10-21, still true):
- New Project offers three tiles from its OWN local list, 1920×1080 / 1080×1920 / 1080×1080,
  fps 24–60: `src/features/studio/components/NewProjectDialog.tsx:17-23` (`FORMAT_PRESETS`
  with `id/label/description/width/height`; ids `landscape|portrait|square`). Just below it
  (`:25-…`) a W5 mapping turns a preset's orientation into the tile id it implies — changing
  tile ids must keep that mapping working.
- The shared list the dialog does not use already has 4K:
  `src/features/studio/services/project-format.ts:26-31` (`FORMAT_PRESETS`, ids
  `1080p|4k|portrait|square`, no `description`; "`id` doubles as the test hook"; max dimension
  7680).
- Project settings edits width/height straight into the document, **not undoable**, and
  nothing else reacts: `src/features/studio/components/ProjectFormatFields.tsx:20-54`.
- Export: `EXPORT_RESOLUTION_PRESETS` = 720p / 540p / 360p only
  (`src/shared/render-presets.ts:85-89`), so a 3840×2160 project offers Full, 720p, 540p,
  360p and **no 1080p**; never-upscale drops presets ≥ the composition (`:130-135`, the
  `isLandscape && height >= compHeight` / portrait `width >= compWidth` checks).
- Since commit `1d5f1d6` a shot whose config differs from the project rides `ShotTimebase`
  (`src/shared/studio/shot-timebase.ts`) — relevant only in that a size change on a project
  with shots does not re-render them.

**§2 T7 decision (the A1 slice of it):** "New Project uses the shared `FORMAT_PRESETS` (so the
4K tile appears) and the Export dialog gains **1080p and 1440p** presets (hidden by
never-upscale on smaller projects)."

**§5 item that touches A1:** "Width/height edits on an existing project are not undoable and
trigger no proxy or shot work; A1 makes the edit undoable but a format change on a project
with shots stays a 'you know what you are doing' operation." → A1 does NOT add proxy/shot
reactions to a size change; it only makes the edit one undo step.

**Driving notes for this part** (from earlier sessions; `docs/ui-automation-cdp.md` is the
full recipe):
- No dev app was running at the branch point (ports 9222 / 5173 free). Check again before
  launching; if one is running, it is Hasan's — do not kill it, run a second isolated instance
  (own `--user-data-dir`, own debugging port) on its Vite server.
- Use a FRESH isolated profile under `.vidtsx-temp/end-to-end/A1/profile` (A1 needs no provider
  keys). A fresh profile's Studio root defaults to `%USERPROFILE%\Videos\VidTSX Studio\projects`
  — Hasan's real projects. **Call `window.api.studioRootSet({ root: <scratch> })` FIRST**, so
  the project the dialog creates lands in a scratch root (e.g.
  `.vidtsx-temp/end-to-end/A1/studio-root`), then
  `window.dispatchEvent(new Event('vidtsx:studio-projects-changed'))`.
- Readiness: the page target can answer with an empty title ~50 s after launch; poll for
  `window.api` plus a visible `Studio` nav button, not just `/json/list`.
- Every DOM query filtered to visible elements (`offsetParent !== null`); `position: fixed`
  menus/dialogs are the exception — query those raw. Prefer `el.click()`; wait ~150 ms after a
  React click before reading the DOM. Hooks: `[data-export-button]`,
  `[data-project-settings-toggle]`, `[data-project-card=<id>]`, editor up when
  `button[aria-label="V1 options"]` is visible.
- The isolated window minimizes itself now and then; restore it (user32 `ShowWindow(hwnd, 9)`
  on the electron.exe whose command line has your port) in the same call as any screenshot,
  and race every `Page.captureScreenshot` against a timeout.
- Undo: `Input.dispatchKeyEvent` Ctrl+Z (`modifiers: 2`, `key: 'z'`, `code: 'KeyZ'`,
  `windowsVirtualKeyCode: 90`) after blurring the active element; assert on `project.json` on
  disk (autosave ~3 s).
- Write long drivers with the Write tool, not a Bash heredoc. Kill only the electron process
  whose command line has YOUR port when done.

## Done (file:line, commit hashes)

All in commit `e4803cd` (branch `end-to-end-p0`):
- **Export 1440p + 1080p.** `src/shared/render-presets.ts:55` (`ResolutionPresetId` gains
  `'1440p'`), `:89-95` (`EXPORT_RESOLUTION_PRESETS` = 1440p, 1080p, 720p, 540p, 360p),
  `isResolutionPresetId` accepts `'1440p'` (settings + ExportDialog remembered-default guards
  pick it up). Never-upscale unchanged. The Settings → default export resolution row lists the
  same ladder (it maps `EXPORT_RESOLUTION_PRESETS`); a remembered rung the project can't offer
  falls back to Full (`pickResolutionOption`).
- **New Project reads the shared list.** `src/features/studio/services/project-format.ts:45-88`:
  `FormatPreset` gains `description`; `FORMAT_PRESETS` (ids `1080p|4k|portrait|square`),
  `DEFAULT_FORMAT_ID = '1080p'`, `formatOrientation(w,h)`, `formatIdForOrientation(orientation,
  currentId)` — W5 mapping now keeps a current tile that already fits (4K stays 4K under a 16:9
  preset). `NewProjectDialog.tsx` drops its local list + `ORIENTATION_FORMAT`, uses these
  (`:8`, `:38`), grid is 4 columns, each tile has `data-new-project-format=<id>` +
  `aria-pressed` (`:147`).
- **Undoable frame size.** `src/features/studio/types.ts` `StudioFrameSize`;
  `project-format.ts:21-35` `isUsableDimension` + pure `setFrameSize` (same object when unchanged
  or unusable → no undo step). `src/features/studio/hooks/useTimeline.ts:115` `EditDoc.frame`,
  `:133` `reset` carries `frame`, `:136` action `set-frame-size`, `:305-307` reducer case, `commit`
  compares `frame` identity, open-reset passes `settings.width/height`, the sync effect
  (`:691-692`, `:715`) writes `settings.width/height` back. `EditorShell.tsx` restore-version reset
  passes the restored doc's size; `:1584` wires `onSetFrameSize` → `tl.dispatch`.
  `ProjectSettingsDialog.tsx` + `ProjectFormatFields.tsx:44` route typed sizes and the format
  buttons through `onSetFrameSize` (fps / name / STT stay plain non-undoable edits). No proxy or
  shot reactions to a size change (plan §5).
- Tests: `src/shared/render-presets.test.ts` (4K ladder with labels + exact float scale; 1080p
  lists no 1080p/1440p; 1440p project; 2160×3840 portrait), `project-format.test.ts` (shared
  list, orientation, W5 mapping), new `src/features/studio/services/frame-size-undo.test.ts`
  (pure op; one undo step; redo; no step for unchanged/odd; interleaves with a split; reset).
  Five reducer test fixtures gained `frame: { width: 1920, height: 1080 }`.

Agent 2 (2026-10-21, docs commit after `639404f`; no source change):
- **CDP click-through** on an isolated instance — exit met (see Verified). Kit under
  `.vidtsx-temp/end-to-end/A1/` (git-ignored): `launch.sh` (`npx electron-vite dev --
  --user-data-dir=.vidtsx-temp/end-to-end/A1/profile --remote-debugging-port=9241 …`), `cdp.mjs`
  (port 9241), `dom.js`, `restore.ps1`, `drive.mjs` (phases `ready | create | export <tag> | undo |
  reopen`), logs `create.log`, `export-4k.log`, `undo.log`, `reopen.log`, stills in `stills/`.
  Instance killed afterwards (only the electron.exe with port 9241).
- `STATUS.md` top row "2026-10-21 — END-TO-END A1 … — DONE"; `docs/studio/TESTING.md` new
  `## 18. End-to-end plan` with `### 18.1 A1` (5 items checked ✎, 1 unit-only item open).

## Verified (exact commands + outputs)

2026-10-21, after `e4803cd`'s changes:
- `npx vitest run src/features/studio/services/ src/shared/render-presets.test.ts` →
  `Test Files 41 passed (41) · Tests 368 passed (368)`.
- `npx vitest run` (full, logged to a scratch file) → `Test Files 415 passed | 4 skipped (419) ·
  Tests 3513 passed | 22 skipped (3535)`, 37.96 s.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
2026-10-21 15:53–15:55 (agent 2), live app, isolated profile `.vidtsx-temp/end-to-end/A1/profile`,
port 9241, Studio root set first to `.vidtsx-temp/end-to-end/A1/studio-root` (`studioRootSet` →
`{"success":true}`, root confirmed, 0 projects). Commands run from `.vidtsx-temp/end-to-end/A1/`:
- `bash launch.sh` (background) → page target "VidTSX Studio" at `http://localhost:5173/`;
  `node drive.mjs ready` → `ready after 5 ms of polling`.
- `node drive.mjs create` →
  `tiles [{"id":"1080p","text":"16:9 1080p YouTube · 1920×1080","pressed":"true"},{"id":"4k","text":"16:9 4K YouTube 4K · 3840×2160","pressed":"false"},{"id":"portrait",…},{"id":"square",…}]`
  · `dialog state {"name":"A1 4K test","fps":"60","pressed":["4k"]}` · `editor up` ·
  `disk after create {…\projects\a1-4k-test\project.json","width":3840,"height":2160,"fps":60}`.
- `node drive.mjs export 4k` → `{"selected":"original","options":[Full (3840×2160), 1440p
  (2560×1440), 1080p (1920×1080), 720p (1280×720), 540p (960×540), 360p (640×360)]}`.
- `node drive.mjs undo` → settings fields `{"w":"1920","h":"1080"}` · disk 1920×1080 after 265 ms ·
  Export now `[Full (1920×1080), 720p (1280×720), 540p (960×540), 360p (640×360)]` · Ctrl+Z → disk
  3840×2160 (791 ms) · Ctrl+Y → 1920×1080 (786 ms) · Ctrl+Z → 3840×2160 (782 ms) · Export back to
  the six-rung 4K list.
- `node drive.mjs reopen` (Back to projects → card → editor, wait 6 s) →
  `project.json byte-identical = true size 547 → 547`; Export still the 4K list.
- Stills: `.vidtsx-temp/end-to-end/A1/stills/new-project-default.png`, `new-project-4k-60.png`,
  `editor-4k.png`, `export-dialog-4k.png`, `settings-1080p.png`, `export-dialog-after-1080p.png`,
  `export-dialog-after-undo.png`, `export-dialog-after-reopen.png`.
- Profile log `profile/logs/vidtsx-2026-10-21.log`: no error-level lines; `dev-app.log`: 0 "error".
- After killing the instance: `npx vitest run` → `Test Files 415 passed | 4 skipped (419) · Tests
  3513 passed | 22 skipped (3535)`, 37.01 s · `npm run check:types` → `tsconfig.web.check.json: 26
  errors (baseline 26) ok` · `tsconfig.node.check.json: 10 errors (baseline 10) ok`.

## Next step (ONE concrete instruction)

None — A1 is DONE. The orchestrator records it and stops for Hasan's "go" before A2.

## Open problems

- Not driven live (unit-tested only): typed width/height in Project settings (same
  `onSetFrameSize` path as the format buttons), the W5 preset→tile mapping (a fresh profile has
  no editing presets, so the preset select is not shown), and a remembered 1440p default on a
  smaller project falling back to Full. Listed in TESTING §18.1.
- Ctrl+Z while the Project settings modal is open was not tried (the driver closes it first).
- `useTimeline.ts` was already ~830 lines (over the 300-line house rule) before A1; A1 added ~20.
  Splitting it is out of A1's scope — noted, not done.
- Cosmetic: in the 4-column New Project grid the tile descriptions wrap to two lines, and the 4K
  tile reads "16:9 4K / YouTube 4K · 3840×2160" (4K twice). Left as is.

## Do-not-redo

- Q6 is done: the October work is committed on `main` as `14d7a63`; you are on
  `end-to-end-p0`. Do not touch `main`.
- Do not redo the code in `e4803cd` (export ladder, shared New Project tiles, `set-frame-size`)
  or its unit tests; the gates above already passed on it.
- Do not re-run the CDP click-through, rewrite the STATUS.md A1 row or the TESTING.md §18.1 block;
  all done by agent 2 with the evidence above.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-21 · ~42 calls · all three code items + unit tests, gates green, commit `e4803cd`.
- 2026-10-21 · ~35 calls · CDP click-through (exit met), gates re-run green, STATUS row, TESTING §18.1.

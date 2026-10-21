# A1 — 4K tile in New Project, 1080p + 1440p export presets, undoable project-size edits
status: IN PROGRESS — code + unit tests committed (`e4803cd`); CDP click-through, STATUS row and TESTING §18 left

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

## Verified (exact commands + outputs)

2026-10-21, after `e4803cd`'s changes:
- `npx vitest run src/features/studio/services/ src/shared/render-presets.test.ts` →
  `Test Files 41 passed (41) · Tests 368 passed (368)`.
- `npx vitest run` (full, logged to a scratch file) → `Test Files 415 passed | 4 skipped (419) ·
  Tests 3513 passed | 22 skipped (3535)`, 37.96 s.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- NOT yet verified: anything in the live app (no CDP run yet).

## Next step (ONE concrete instruction)

Run the CDP click-through on a fresh isolated profile (`.vidtsx-temp/end-to-end/A1/profile`,
scratch Studio root `.vidtsx-temp/end-to-end/A1/studio-root` set via `studioRootSet` FIRST — see
the driving notes above and `docs/ui-automation-cdp.md`): open New Project, assert four tiles
(`[data-new-project-format]` = 1080p, 4k, portrait, square), click `4k`, pick 60 fps, Create;
assert the scratch `project.json` has `settings` 3840×2160 @ 60; open the editor's Export
dialog (`[data-export-button]`) and read its resolution select's options — expect `Full
(3840×2160)`, `1440p (2560×1440)`, `1080p (1920×1080)`, `720p (1280×720)`, `540p (960×540)`,
`360p (640×360)`; screenshot both dialogs; then open Project settings
(`[data-project-settings-toggle]`), click `[data-format-preset="1080p"]`, wait for autosave,
assert 1920×1080 on disk, close the dialog, blur, Ctrl+Z, assert 3840×2160 on disk again. Save
the driver + stills under `.vidtsx-temp/end-to-end/A1/`. Then write the STATUS.md row and the
TESTING.md §18 block (shape per §17) and finish.

## Open problems

- Unknown until the CDP run: whether the editor's Ctrl+Z handler fires while the Project
  settings modal is open (the driver closes the modal first, so the exit does not depend on it).
- `useTimeline.ts` was already ~830 lines (over the 300-line house rule) before A1; A1 added ~20.
  Splitting it is out of A1's scope — noted, not done.

## Do-not-redo

- Q6 is done: the October work is committed on `main` as `14d7a63`; you are on
  `end-to-end-p0`. Do not touch `main`.
- Do not redo the code in `e4803cd` (export ladder, shared New Project tiles, `set-frame-size`)
  or its unit tests; the gates above already passed on it.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-21 · ~42 calls · all three code items + unit tests, gates green, commit `e4803cd`.

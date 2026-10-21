# A1 — 4K tile in New Project, 1080p + 1440p export presets, undoable project-size edits
status: NEW

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

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Read `NewProjectDialog.tsx`, `project-format.ts`, `ProjectFormatFields.tsx`,
`src/shared/render-presets.ts` and their existing tests; then add `1440p` and `1080p` to
`EXPORT_RESOLUTION_PRESETS` with unit tests for a 3840×2160 and a 1920×1080 composition (the
4K one lists Full, 1440p, 1080p, 720p, 540p, 360p; the 1080p one lists no 1080p/1440p).

## Open problems

(none yet)

## Do-not-redo

- Q6 is done: the October work is committed on `main` as `14d7a63`; you are on
  `end-to-end-p0`. Do not touch `main`.

## Agents so far (date · approx tool calls · what they covered)

(none yet)

# Driving the app for end-to-end parts — shared notes (read with your part's HANDOFF.md)

Full recipe: `docs/ui-automation-cdp.md`. These are the rules every part's builder and verifier
follow, plus what earlier parts learned. Orchestrator-maintained; builders add a line under
"Learned" when they hit something new.

## Never touch

- `%APPDATA%\VidTSX Studio` (Hasan's profile; it already holds the full ffmpeg, a font cache,
  his bundle cache). Reading/copying out of it is allowed only where a HANDOFF says so; never
  write, delete or launch the app on it.
- `~/Videos/VidTSX Studio/projects/*` (Hasan's projects, video-14 included). A part that
  renders or re-bundles video-14 works on a COPY in a scratch Studio root.
- Exports land in `%USERPROFILE%\Videos\VidTSX` by default: give the export an output path in
  your scratch folder, or move what you produced out afterwards and list it in HANDOFF.md.

## Isolated instance

- One folder per part: `.vidtsx-temp/end-to-end/<PART>/` (profile, scratch root, driver,
  stills, logs). Verifiers use `<PART>-verify/`. Each agent picks its own CDP port (A1 used
  9241, its verifier 9251) — pick a fresh one, e.g. 92<part-number>x.
- Launcher (A1's, worked first time): `.vidtsx-temp/end-to-end/A1/launch.sh` — copy it, change
  the profile path, port and log path, run it in the background from a script FILE.
  `ELECTRON_RUN_AS_NODE` must be unset.
- Check ports 9222 / 5173 and running `electron.exe` first. If a dev app is already running it
  is Hasan's: do not kill it, do not run a second `electron-vite dev` (it rewrites `out/`);
  run `electron.exe .` on its Vite server with your own `--user-data-dir` and port. Do not
  launch at all while Hasan's app is rendering — a new instance's startup sweep removes
  Remotion asset folders older than 1 h (`run-export.ts` `sweepExportScratch`).
- A fresh profile's Studio root defaults to Hasan's real projects folder.
  **`window.api.studioRootSet({ root })` FIRST**, confirm with `studioRootGet`, then
  `window.dispatchEvent(new Event('vidtsx:studio-projects-changed'))`. Projects live in
  `<root>/projects/<id>`.
- Readiness: poll for `window.api` and a visible `Studio` nav button (the page target can
  answer with an empty title ~50 s after launch).
- When done: stop only the process tree whose command line has YOUR port (and the
  `electron-vite` you started). Run the full `npx vitest run` with the app stopped, logged to a
  file.

## Clicking and reading

- Visible-only queries (`offsetParent !== null`); `position: fixed` menus/dialogs are queried
  raw. Prefer `el.click()`; wait ~150 ms after a React click. Hooks: `[data-export-button]`,
  `[data-project-settings-toggle]`, `[data-project-card=<id>]`,
  `[data-new-project-format=<id>]`, `[data-format-preset=<id>]`; editor up when
  `button[aria-label="V1 options"]` is visible.
- The isolated window minimizes itself now and then: restore it (user32 `ShowWindow(hwnd, 9)`
  on the electron.exe with your port) in the same call as a screenshot; race every
  `Page.captureScreenshot` against a timeout.
- Disk truth beats DOM guessing: `project.json` autosaves in under a second.
- Write drivers longer than a few lines with the Write tool, not a Bash heredoc.

## Renders and exports

- One render at a time, CPU "low" (Settings › Rendering), below-normal priority. Check free
  space on C: and D: before any render or download and write the numbers in HANDOFF.md.
- 4K tests are 30–60 s RANGES of video-14, never the full video.
- Wait for an export with `window.api.renderQueueGet()` until idle, THEN read
  `renderQueueLoad()` once — calling `renderQueueLoad()` mid-render stamps the live row
  "interrupted". A passthrough (Fast/Fastest) export is not in `renderQueueGet`'s list:
  subscribe to `window.api.onRenderProgress`.
- A run longer than a few minutes: hold the machine awake (a background PowerShell calling
  `kernel32!SetThreadExecutionState(0x80000003)` and staying alive), then check timings for
  holes. The machine is a laptop (RTX A3000 6 GB) and Modern Standby suspends renders.
- Never edit `src/` while a live run is in flight: an HMR reload drops the CDP socket, a main
  edit restarts main and kills the export.

## Repo facts

- Git tracks the status file as `Status.md` (`git add STATUS.md` stages nothing on Windows).
- Type gate baseline: web 26 / node 10 (`scripts/check-types.mjs`); it only ratchets down.
- Known full-suite flake, not caused by this branch: `shot-generator.test.ts` (3 tests from
  :197) and `shot-module-resolver.test.ts:151` (5000 ms timeout). Reproduced on `main`. Rerun;
  a green rerun counts.

## Learned (append one dated line per lesson)

- 2026-10-21 · A1 · a fresh profile has no editing presets until seeding finishes ("Could not
  seed built-in preset" EEXIST race is harmless); the New Project preset picker appears once
  presets load.
- 2026-10-21 · A2 · Fast/Fastest in the Export dialog = `<userData>/ffmpeg-full/<extractedDir>/bin/ffmpeg.exe`
  exists + the encoder probe finds a working GPU encoder (`passthrough-engine.ts` `resolveTools`),
  asked fresh on every dialog open (`registry.ts` `listExportEngineStatus`). The Settings toggle
  (`studioProxyEncoderSetEnabled`) is for PROXIES only — not needed: with `enabled:false` Fast was
  selectable. But in the SAME process right after an in-app `studioProxyEncoderInstall`, Fast still
  read "Needs the GPU encoder download" 30 s later (not root-caused); after an app restart all three
  engines were available. So: install the full ffmpeg into the isolated profile, RESTART, then drive
  Fast/Fastest. Check with `window.api.studioExportEnginesList()` before opening the dialog.

## video-14 (track A, from A3 on) — orchestrator rules

- Work only on the shared copy `.vidtsx-temp/end-to-end/v14-root/projects/video-14` (set the
  isolated profile's Studio root to `.vidtsx-temp/end-to-end/v14-root`). The original under
  `~/Videos/VidTSX Studio/projects/video-14` is Hasan's.
- `notes/import/build-video14.mjs` hard-codes `PROJ` = the ORIGINAL project path (:27) and
  `notes/import/warm-fonts.mjs` writes to `%APPDATA%\VidTSX Studio\font-cache` (:19). Never run
  either from the original folder or unmodified; run edited copies that point at the copy / the
  isolated profile.
- The V1 master `D:\repos\claude-youtube-editor\videos\video-14\output\master-tight-h264.mp4` is
  4.05 GB and read-only; every render copies it into the job scratch on C: (check ≥ 10 GB free).

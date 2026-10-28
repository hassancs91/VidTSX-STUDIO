# Driving the app for end-to-end parts — shared notes (read with your part's HANDOFF.md)

Full recipe: `docs/ui-automation-cdp.md`. These are the rules every part's builder and verifier
follow, plus what earlier parts learned. Orchestrator-maintained; builders add a line under
"Learned" when they hit something new.

## Never touch

- **Credential stores, in ANY profile (orchestrator, 2026-10-23):** never read, copy or open a
  `settings.db` (DPAPI-encrypted provider credentials), `~/.claude` credential files, or anything
  else that holds keys or logins — not Hasan's, not an isolated profile's, not a station's. The
  permission classifier refuses it as credential exploration; a B5 and a B6 verifier copied a
  station/scratch `settings.db` anyway (one copy was deleted by the orchestrator, one is listed for
  Hasan). Usage numbers come from the app log or the turn log, not from database files.
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
- **Profiles go on C: from session 2 on (orchestrator, 2026-10-22):** D: is at ~2.8 GB free and
  every profile copy is ~372 MB. A NEW isolated profile (builders and verifiers alike) lives at
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\<PART>[-verify[N]]\profile`, **copied from
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\source\profile`** (an identical copy of A5's
  profile, 2,328 files / 390 MB, made 2026-10-22 12:16 — never launch on `source` itself, never
  copy from D: again); drivers, logs, stills and reports stay in `.vidtsx-temp/end-to-end/<PART>/`
  (keep them small). A new profile's Studio root still defaults wrongly: set it first. Other
  Claude sessions on this machine write to C: and D: too — a drop that is not yours is not a
  reason to stop above the line.
- **D: below 2 GB (orchestrator, 2026-10-22 13:40):** D: hit 1.84 GB from other sessions' writes;
  freeing our D: profiles was refused by the permission classifier (left for Hasan). From now on
  any NEW artefact over ~1 MB (stills, logs of full vitest runs, reports, exports, copies) goes
  to `C:\Users\hasan\AppData\Local\vidtsx-e2e\<PART>\` (drivers and small notes may stay in
  `.vidtsx-temp/end-to-end/<PART>/`). The stop line is now **1.0 GB free on D:** — check before
  launching the app (an `electron-vite dev` rewrites `out/`, ~126 MB, in place) and before any
  vitest run; under 1.0 GB, stop and return BLOCKED.
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
- FIXED in A4 step 0 (`22593db`, test-only): the old full-suite flake in `shot-generator.test.ts` (3 tests from
  :197). From `22593db` on, a red full run is a real failure. `shot-module-resolver.test.ts:151`
  (5000 ms timeout) can still time out under heavy machine load: rerun once, say so.
- **Vitest gate under load (orchestrator, 2026-10-22, session 2):** other Claude sessions often
  hold the CPU near 100 %. Known LOAD timeouts — `shot-module-resolver.test.ts:151`,
  `flow-render.test.ts:255` (1 s `vi.waitFor`), the zip-package suites (agent-package,
  agent-store, flow-package, pack-package, 5000 ms) — do not fail a part when (a) the file passes
  alone, and (b) either a full default run is green within 3 tries OR a full run with
  `npx vitest run --maxWorkers=4` is green. Log every run to a file and name which one counted.
  Any OTHER failure, or one of these failing alone, is real.
- **Vitest gate while C: is low (orchestrator, 2026-10-22 15:40):** `src/main/services/python-models/service.test.ts`
  writes ~1.68 GB to `%TEMP%` (C:) and fails with `ENOSPC` when C: is short; the branch never
  touches `python-models/` (`git diff --stat main..HEAD -- src/main/services/python-models/` is
  empty). While C: has < 4 GB free, the counted full run is `npx vitest run --exclude
  src/main/services/python-models/service.test.ts` (with `--maxWorkers=4` under load) — say so
  in STATUS. Stop line for C: is **1.0 GB** too: check `Get-PSDrive C,D` before every launch and
  every full test run.
- **Reuse, don't copy, while disk is low (orchestrator, 2026-10-22 15:40):** C: copies of M2 and
  profiles from DONE parts already exist under `C:\Users\hasan\AppData\Local\vidtsx-e2e\` and ARE
  scratch: builders reuse `B2-root` (full M2 copy, 9 clips, proxies + v3 waveforms + transcripts)
  with `profiles\B2\profile`; verifiers reuse `B2-verify-root` with `profiles\B2-verify\profile`
  (or `B1-verify-root` with `profiles\B1-verify\profile`). Reset whatever you need inside them
  (e.g. remove `settings.presetId` / `settings.cutStyle`, clear the timeline) — they are not
  shared material. Never modify `b-root` (the shared M2) or `profiles\source`.
- **Disk recovered (orchestrator, 2026-10-22, B5 on):** C: ~19 GB, D: ~33 GB. New scratch copies
  (an M2 copy ~580 MB, a profile ~377 MB) are allowed again while C: stays above ~5 GB — check
  before each. **Reserved, never reuse:** `B1-verify-root` + `profiles\B1-verify` = Hasan's B4
  station (WAITING-HASAN); `B5-station-root` + `profiles\B5-station` = his B5 station once built.
  The python-models exclusion in the vitest gate applies only while C: < 4 GB.

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
- 2026-10-21 · A3 · video-14 has no `button[aria-label="V1 options"]` (its video track label is
  truncated): use `[data-export-button]` visible as the editor-up hook. The preview loads all 55
  shot modules when the project opens, so to see `/modules`, `/virtual/*` and `/fonts?u=`
  requests enable Network and `Page.reload` the renderer first (A3 `drive.mjs player … fresh`).
  Playhead text is `00:08.00/ 08:05.43`. A 5 s 4K60 Standard range on video-14 takes ~4 min at
  CPU low (300 frames, ~1.36 fps).
- 2026-10-21 · A3 · the video-14 copy is not self-contained: its `project.json` points all 127 media
  assets at the ORIGINAL's `media\` by absolute path, so the copy's Player/export READ Hasan's
  files (never write). A CDP recorder attached without a reload sees `Network.loadingFailed` for
  requests it never saw start (no `url`): default the url before using it.
- 2026-10-21 · A4 · the `shot-generator.test.ts` full-suite flake is FIXED (`22593db`, test-only:
  it cancelled a new shot one timer tick after starting it, before the run was tracked); 3
  consecutive full runs green. A failure there now is real. `shot-module-resolver.test.ts:151`
  (5000 ms timeout under load) was not seen in those 3 runs but was not touched.
- 2026-10-21 · A4 · PROXIES pick up an in-app full-ffmpeg install in the SAME process (no restart): the card's download → `Probed GPU proxy encoders` 3.7 s after `Full ffmpeg installed` → NVENC proxies at once. A2's restart need is the export-engine (Fast) status path only. The full ffmpeg download ran at ~0.78 MB/s here (~106 s for 80 MB) — budget ~2 min.
- 2026-10-22 · A5 · %TEMP% gains a zero-byte `.tmpXXXXXX` file every 10–30 s from something outside the app (seen before launch and after a cancel; 53 of them on 2026-10-22) — exclude that pattern from TEMP before/after diffs. video-14's 55 shots tile its whole timeline, so Fast/Fastest copy 0 % of it (cutaway = composite span, PiP split = browser span); a 30 s 4K60 Fastest range took 19.6 min (1.53 fps) at CPU low.
- 2026-10-22 · A6 · Queue rows of one project share the same visible file name ("video-14 · … (range).mp4"): pick a row by its job, read from the React fiber of any element in it (walk `__reactFiber$….return` to `memoizedProps.job`), and match `job.outputPath` / `job.id` (A6 `drive.mjs queue`). A check of a 30 s 4K range takes ~50 s; a row's "Check A/V" works only while its `studio-entry-*.tsx.json` sidecar survives the 24 h sweep.
- 2026-10-22 · A6 fix · the bundled ffmpeg n7.1 piping frames over image2pipe (default constant-rate mode) REPEATS the first frame after an input seek on ~1/3 of seeks (the half-frame seek lands the first pts at +0.5 frame and the rate fill duplicates it): add `-fps_mode passthrough`, and read each frame's own time with `-stats_enc_pre pipe:2 -stats_enc_pre_fmt "{ni} {tbi} {ptsi}"` (works under `-v error`; there is no framecrc/framemd5 muxer and `-v error` hides `-debug_ts`) — never label frames `first + index`.
- 2026-10-22 · B2 · Project settings is a modal: `[data-project-settings-toggle]` only OPENS it, and its X has no aria-label/title — close it with a real CDP mouse click (`Input.dispatchMouseEvent` at the X's `getBoundingClientRect` centre; CSS px, not screenshot px). `vis()` still counts elements UNDER the modal as visible, so a still taken "of the Inspector" can show the modal on top — check a still before trusting it. Preset editor knobs are native `<select>`/`<input>`: set with the prototype value setter + a bubbling `change`/`input` event. Transcript selection: a DOM `Range` over `[data-transcript-body] [data-i=…]` + `selectionchange`, then `[data-transcript-action="delete"]`.
- 2026-10-22 · B2 · **Stopping your instance: match `--remote-debugging-port=<port>` or your profile path, never the bare port number** — a `*9281*` CommandLine filter also matched (and killed) three child processes of another session's headless Playwright Chrome (`playwright_chromiumdev_profile-*`; its args happen to contain the digits).
- 2026-10-22 · B4 · No-model proof for any button that makes one LLM call: set the scratch project's `settings.agent.providerId` to an id nothing registers (e.g. `b4-no-model`) — `llm-engine.ts:77-79` throws "Provider … not registered" before any request; probe first with `window.api.llmGenerate({ prompt, providerId })`. The learn card lands in the Assistant tab (click `Assistant`); a renderer source edit under a live app reloaded it fully back to Home (re-open the project), and a pending card survives (it lives in main). Reducer actions from CDP: `tl.dispatch` is on TimelinePanel's props (`fiberProps(el, p => p.tl?.dispatch)`); the dispatch is stable, read state from disk.
- 2026-10-22 · B1 · Studio's v3 waveform (16 kHz decode of the DJI MP4) equals the editor's `work/audio/<clip>.wav` 20 ms RMS at lag 0 (mean |dB| 0.02–0.03; ±1 ms → 0.25) — compare Studio vs cutlib numbers without any time shift. cutlib harness kit (run `python -I -B`, outputs in B1/): `B1/cutlib_joins.py`, `B1/compare.b1.test.ts` (`B1_COMPARE=1`, scratch config), `B1/offset_check.py`.
- 2026-10-22 · B5 · **Poll project.json no faster than every 200 ms** (B5 uses 250): a 50 ms poller holds the file open often enough that the app's `.tmp` → `project.json` rename fails on Windows (EPERM) → "Save failed", and (until B5's Problem 5 fix) the edit is never re-saved, so MEMORY and DISK silently diverge. A driver that then reads the in-app doc (indices, tokens) and the disk as if they matched acts on the wrong state — B5's "2× long delete" was exactly that (two correct deletes). Before each driven case, assert the in-app state == disk, and watch the "Saved" indicator rather than racing the file. An opened Transcript deletion pill can put its Restore below the fold — check `elementFromPoint` hits the button before trusting a click.
- 2026-10-22 · B5 · **A prepared-not-applied `src/` change:** make it in a scratch `git worktree add --detach .vidtsx-temp/end-to-end/<PART>/<name>-wt HEAD` (gitignored; node resolves the main checkout's `node_modules` by walking up — run `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run …` and `node …/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit` from the worktree, never `npx` there, which looks for a local install), export `git diff` as the patch, `git apply --check` it in the main checkout, re-apply it in the reset worktree and test, then `git worktree remove --force`. This checkout's files are LF while a fresh worktree's are CRLF (`core.autocrlf=true`): an LF patch applies to both, a CRLF copy fails here — pin `*.patch text eol=lf` in a `.gitattributes` next to it.

- 2026-10-23 · B6 · **The Assistant's live state:** `agent` props read up from the textarea's `__reactFiber$` were a STALE alternate — busy / pending frozen at the first streamed words for 12 min while the turn had ended in 26 s (the AI-usage row and the visible Send button said so). Read busy from a visible `button[title="Stop the assistant"]`, and the props by walking DOWN from the container's `__reactContainer$….stateNode.current` (B6 `run.mjs` `findCur`). A cut card with 0 accepted items (a lone fluff) has a disabled Apply — answer it with "Reject all"; the editor's "Review outcome" turn still continues the run. Per-turn usage: `window.api.aiUsageGetLog({ limit })` rows (`featureSource 'auto-cut'` for Studio assistant turns).

- 2026-10-23 · E1 · The Assets screen scans the library on its FIRST mount only; going Home and back
  does NOT rescan (it stays mounted) — click its visible `Refresh` button to drive a reconcile pass. The
  root view shows folders (`e1-seed`, `presets`): `dblclick` the folder's card to list files. The bundled
  Remotion ffprobe n7.1 counts a LAME mp3's encoder delay + padding in `format.duration` (+44 ms on a
  1.3 s tone; ffprobe n8 trims it) — fixed in `probeMedia` via `mp3-gapless.ts`; compare durations against
  an independent ffprobe of a NEWER build, and expect old-build numbers for mp3 to differ.

## Track E (session 4, 2026-10-23) — the worktree

- Track E works ONLY in the worktree `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E\wt` (branch
  `end-to-end-p0-e`). The main checkout `D:\repos\VidTSX-STUDIO` has another session's uncommitted files and
  Hasan's own dev app running from it (his real profile, Vite 5173): never edit, stage, stash, build or
  launch there, never touch its `out/`, never `git stash` anywhere. Commit with explicit paths.
- No `node_modules` in the worktree; never `npx` / `npm` there. Tests:
  `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run [files]`; types:
  `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit` (and
  `tsconfig.node.check.json`), count `error TS` lines — baseline web 26 / node 10.
- Per-part scratch (drivers, small logs, kits): `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\<PART>\`
  (outside the worktree's tree). Profiles: `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\<PART>…\profile`,
  copied from `profiles\source\profile` WITHOUT `settings\settings.db*`. The library root of such a profile
  is `<profile>\assets` — confirm from the running app before any library write.
- **The vitest gate from the worktree (orchestrator, 2026-10-23 20:50):** three files cannot resolve
  packages from a worktree with no `node_modules` of its own — `builder-libraries.test.ts` (`@remotion/paths
  … is not installed`), `shot-bundle.test.ts` and `shot-bundle-in-place.test.ts` (esbuild `Could not resolve
  "chroma-js"` …); they look under `<root>/node_modules` only. A `node_modules` junction in the worktree was
  **refused by the permission classifier** (shared resource) — do not create one, copy one or work around
  it. Rule: the counted full run is the worktree run (`--maxWorkers=2` while headroom < 10 GB), green
  except those three files, each failing ONLY with a package-resolution error; for those three, show they
  are independent of track E's diff (none of the files `git diff --name-only 5d77600..HEAD` lists is in
  their import graph; say the method: static walk / esbuild metafile, `vi.mock`'d modules not followed)
  and say so in STATUS. Any other failure is real (DRIVING's load-timeout rule still applies).
  **WITHDRAWN 2026-10-23 23:00 — the former rule (a)** (`--root <wt>` started from the main checkout's
  directory): `vitest.config.ts` builds its aliases with `resolve('src/…')`, relative to the cwd, so that
  run loads the MAIN checkout's `@shared` / `@main` code (E1 verifier round 3). Do not use it as evidence.
- **E-d13 — the vitest gate under EXTERNAL CPU load (orchestrator, 2026-10-28 21:30):** when another process (measured — e.g.
  `vmmemWSL` at ~60 % of all cores, 21:27) holds the CPU and DRIVING's load rule above cannot be met in 3 default tries + one
  `--maxWorkers=4` run, the counted full run is `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --maxWorkers=2
  --testTimeout=20000 --hookTimeout=20000` (4× the 5000 ms default; it does not change explicit `vi.waitFor` / per-test timeouts). It
  must be green except the three E-d2a suites (resolution only) and DRIVING's named known list (`flow-render.test.ts:255`,
  `shot-module-resolver.test.ts:151`, the zip-package suites), each of those green ALONE. Record the CPU measurement (top processes
  over 5 s) with the run, and say in STATUS that E-d13 was used. Any other failure, or a timeout that persists at 20 s, is real.
- **Studio root FIRST (E1 verifier round 3, 2026-10-23):** a fresh isolated profile's Studio root defaults to
  Hasan's real projects folder and the Home screen lists them on launch. Set `studioRootSet` in the first
  CDP call after the page is ready, before any navigation, and check it with `studioRootGet`; pass the path
  from a FILE-based driver (shell escaping mangled it twice in E1).
- **Launch recipe from the worktree (E1 builder #4, 2026-10-23, worked first time, twice):**
  1. Build the worktree's own `out/` (app stopped; rewrites only `wt/out`, ~125 MB, ~2 min), Bash from the
     worktree root: `unset ELECTRON_RUN_AS_NODE; export NODE_OPTIONS=--max-old-space-size=8192; node
     D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build > <log> 2>&1` (rc 0, only
     "use client" warnings). Rebuild after every `src/` change before a live check.
  2. Launch with NO Vite server (`ELECTRON_RENDERER_URL` unset → main loads `out/renderer/index.html`), from
     a script FILE run with Bash `run_in_background` (kit `E1/launch.sh`): `cd <wt>; unset
     ELECTRON_RUN_AS_NODE ELECTRON_RENDERER_URL; exec D:/repos/VidTSX-STUDIO/node_modules/electron/dist/electron.exe .
     --user-data-dir=<profile> --remote-debugging-port=926x --disable-features=CalculateNativeWinOcclusion
     --disable-backgrounding-occluded-windows --disable-renderer-backgrounding > <app.log> 2>&1`. Ready
     (`window.api` + a visible nav button) in under 10 s; the window opens MINIMISED — restore it without
     activating (kit `E1/restore.ps1`) in the same call as a CDP screenshot, else `captureScreenshot` hangs.
  3. Stop: PowerShell, `Get-CimInstance Win32_Process -Filter "Name='electron.exe'"` whose CommandLine holds
     the profile path → `Stop-Process`. **Filter by Name too**: an unfiltered CommandLine match also hits
     the PowerShell/bash running the stop command (the path is in its own command line) — it killed its
     own shell once (exit 255). The background launcher then reports exit 127 (killed `exec`) — expected.

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
- The video-14 copy's `project.json` points all 127 media assets at the ORIGINAL project's
  `media\` by absolute path (A3 finding): the copy's Player and exports READ Hasan's media files.
  Reading is fine; never relink, re-import, move, rename or delete media from the copy, and never
  run anything that writes next to a media file. Caches (proxies, waveforms) live in the copy's
  own `cache/`.
- 2026-10-21 · A4 · a REFUSED export (disk or fonts) shows nothing in the editor: read it in Queue → the row's Details. Two Standard exports back to back (2nd with a cached bundle) crashed once in Remotion's encoder with its `react-motion-render*` folder gone from the job scratch → unhandled rejection, job stuck at "rendering" until Cancel (A4 step 4b, not root-caused yet).
- 2026-10-21 · A4 · step 4b's mid-render `react-motion-render*` deletion did NOT reproduce in 3 traced back-to-back Standard exports (step 4c). To trace deletes without touching `src/`: launch with `NODE_OPTIONS=--require <preload.cjs>` (Electron dev main honours it) and wrap `fs.rm*/rmdir*/unlink*` + `fs.promises.*` there. NB `%TEMP%\vidtsx-studio` (`getTempDir()`) is SHARED by every profile — another instance's startup `sweepExportScratch` would delete a live job's scratch. A dead Remotion pre-stitcher HANGS the job (renderMedia never settles): cancel it from the Queue.

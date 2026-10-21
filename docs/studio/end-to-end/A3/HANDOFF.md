# A3 — The no-react fix: `remotion/<subpath>` external in shot bundles
status: DONE (2026-10-21, all 4 steps: the code fix + unit tests, commit `c3aefe8`; the shared
video-14 copy; the one-shot proof — Player clean, the 6–11 s 4K60 Standard render COMPLETED, parity
holds, keep T7, no fallback; all 55 re-bundled on the copy, `remotion_delayRenderHandles` = 0 hits;
gates green; STATUS row + TESTING §18.3 committed)

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety rules, launcher, repo facts,
"Learned" lines from A1/A2). Plan §5 calls this part **the highest risk in the plan**.

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **A3** | **The no-react fix**: `remotion/<subpath>` external in `shot-bundle.ts`, lint widened, one video-14 shot re-bundled and rendered 5 s through Standard at 4K60 → then all 55 re-bundled by the import script's bundle step (`--shots-only`) | the 5 s render completes with the brand-font hold released; `grep remotion_delayRenderHandles` over the 55 bundles = 0 hits |

Session gates (plan §3 head): `npx vitest run` green, `npm run check:types` at or below
baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the STATUS.md row,
the TESTING.md §18 block (`### 18.3 A3`). "Anything the composition renders is verified in
preview AND a real export before the part closes" — this part changes what every shot bundle
renders, so the preview (Player) check is part of the exit (see §5 "The Player" below).

## Plan context (§1.x facts, §2 decision, §5 items to read)

**§1.7 "The failure" (plan :333-345)** — read it in full. In short: `@remotion/google-fonts`
imports `remotion/no-react`; that subpath is not external (exact-match regex) and is a "builder
library", so every one of the 55 video-14 shot bundles carries a full copy of
`remotion/no-react`. `shot-bundle-finish.ts:108-125` moves the bundle body into a lazy
`__vidtsxInit()` that runs on first render, and the copy's top-level
`window.remotion_delayRenderHandles = [];` (Remotion 4.0.435 `no-react.mjs:139-146`) then runs
**mid-render**, orphaning the export entry's `'brand fonts'` hold (`export-entry.ts:322-336`,
`BRAND_FONT_WAIT_MS` 8000) and any shot's own hold → timeout. The preview serves one shared copy
at `/virtual/remotion.js/no-react` (`module-server.ts:131-134`). Version skew: the inlined
google-fonts code is the editor's 4.0.486 vs the app's 4.0.435.
**§1.7 the 2026-10-16 attempt (:346-348):** Standard, 82–102 s, 3840×2160 @ 60, CPU 25 %,
cancelled by the user at 171 frames after 607 s (`notes/import/range-082-102.json`).
**§1.3 library limits (:162-167):** `EXTERNAL = /^(react|remotion|@vidtsx\/kit)$/`
(`src/main/services/studio/shot-bundle.ts:36`, exact match); every `@remotion/*` and every
`remotion/<subpath>` is a "builder library" and gets **inlined**
(`src/shared/tsx-engine/builder-libraries.ts:113-118`); the lint allows only the three externals
and rejects subpaths (`src/shared/studio/shot-lint.ts:12, 87-90`) — it runs on the bundled
artifact. The builder's `check` inlines the kit (`build-check.ts:92-93`).
**§1.7 Fonts (:360-364):** font proxy cache `<userData>/font-cache`, miss → upstream fetch, 502 on
upstream failure; shots' `@remotion/google-fonts` loads are not warmed.

**§2 T7 (the A3 slice):** "`remotion/<subpath>` becomes external in the shot bundle
(`EXTERNAL = /^(react|remotion(\/.+)?|@vidtsx\/kit)$/`), the lint allows `remotion/*` subpaths,
the preview keeps serving its shared copy and the export bundle resolves the app's one 4.0.435
copy at module load, before any `delayRender` exists. **A3 proves it on one video-14 shot
first** (inlined 4.0.486 google-fonts code calling the app's no-react — API parity [spike]) and
then re-bundles all 55 through the import script's bundle step."

**§5 items:**
- **A3 parity [spike].** If `NoReactInternals` differs in what the inlined 4.0.486 google-fonts
  uses, the fallback is to externalize `@remotion/google-fonts/*` too and serve it in preview —
  "a bigger change. The one-shot render decides it." (Within the plan: take the fallback if the
  spike fails, and record the evidence.)
- **The Player.** The same reset runs in the preview today (inlined copy inside
  `__vidtsxInit`); its effect on the Player's own `delayRender` holds was never measured. "A3's
  one-shot proof should look at a shot with a font load in the Player as well."

**Orchestrator's read (2026-10-21, read-only):**
- `~/Videos/VidTSX Studio/projects/video-14` = 460 MB; 55 shot folders under `shots/`, each with
  `original.tsx` + `v1.tsx` (the bundle). **All 55 `v1.tsx` contain
  `remotion_delayRenderHandles` today** (`shots/v14-a1-nobody/v1.tsx:982`). V1 master =
  `D:\repos\claude-youtube-editor\videos\video-14\output\master-tight-h264.mp4` (4.05 GB,
  referenced in place, read-only). The editor's preview for frame comparisons:
  `...\output\video-14-preview.mp4` (122 MB).
- `notes/import/build-video14.mjs` **hard-codes `PROJ = 'C:/Users/hasan/Videos/VidTSX
  Studio/projects/video-14'` at :27** and has **no `--shots-only` flag** (only `--dry-run`, :25);
  it imports `studio-lib.mjs`, which compiles Studio's own bundle step from
  `D:/repos/VidTSX-STUDIO/src` on every run (so the branch's fix is what it bundles with), using
  `D:/repos/VidTSX-STUDIO/.vidtsx-temp/v14-import` as scratch.
- `notes/import/warm-fonts.mjs:19` writes to `%APPDATA%\VidTSX Studio\font-cache` — Hasan's real
  profile. Do NOT run it as-is.

**How to work on video-14 safely (orchestrator decision for track A):**
- Make ONE shared copy for track A: `.vidtsx-temp/end-to-end/v14-root/projects/video-14`
  (robocopy/cp of the whole folder, 460 MB on D:; D: had 6.2 GB free at 20:37). A3, A4, A5, A6 and
  the track exit all use it (each isolated profile sets its Studio root to
  `.vidtsx-temp/end-to-end/v14-root`). Never write to the original.
- Run the import script only from the COPY's `notes/import/`, after editing the copy so `PROJ`
  points at the copy (an env var or argv override is fine) and adding `--shots-only` there (the
  script lives in Hasan's project notes, not the repo: changing the COPY is fine; the original
  stays untouched). Read the script fully before running it; `--dry-run` first.
- Fonts: let the isolated profile's own proxy fetch them, or point a copy of `warm-fonts.mjs` at
  `<isolated profile>/font-cache`.
- The 5 s render: a range across `v14-a1-nobody` (or another shot with a google-fonts load), at
  3840×2160 @ 60, Standard, CPU "low". Remotion copies the 4.05 GB master into the job scratch on
  C: (A2 put it there; it is removed after the run) — check C: has ≥ 10 GB free first. Give the
  export an output folder under `.vidtsx-temp/end-to-end/A3/`. Keep the machine awake for the
  render (DRIVING.md).

## Steps (the part, numbered)

1. **Code fix + unit tests** — DONE (`c3aefe8`).
2. **Shared video-14 copy + one-shot re-bundle** — DONE (2026-10-21, agent 2; no repo source
   change, the copy is gitignored).
3. **One-shot proof** — DONE (2026-10-21, agent 3): Player clean at 8.0 s, the 6–11 s render at
   3840×2160 @ 60 through Standard completed (300/300 frames, 232.7 s wall). Spike verdict:
   **parity holds → keep T7; the §5 fallback is not needed.**
4. **All 55** — DONE (2026-10-21, agent 4): `--shots-only` over the copy (55/55, handles 54 → 0),
   grep = 0 files / 0 hits over the 55 `v1.tsx`; full gates green; closing Player check at 8 s and
   30 s clean; STATUS row + TESTING §18.3.

## Done (file:line, commit hashes)

- **`c3aefe8` fix(studio): A3 — keep remotion/<subpath> external in shot bundles.**
  - `src/main/services/studio/shot-bundle.ts:43` — `EXTERNAL = /^(react|remotion(\/.+)?|@vidtsx\/kit)$/`
    (the plan's T7 regex; comment :35-42 says why). The `require()` shim path (CJS deps) covers
    subpaths too: same filter.
  - `src/shared/studio/shot-lint.ts:22-27` — `REMOTION_SUBPATHS = ['remotion/no-react',
    'remotion/version']` (remotion 4.0.435's `exports`: `.`, `./version`, `./no-react`,
    `./package.json`) and `isShotModuleSpecifier()`; :103 the lint uses it. Error text keeps
    its old prefix ("shots may only import from 'react', 'remotion', and '@vidtsx/kit' (plus
    remotion's own …)"). An unknown `remotion/foo` is externalized by the bundle step, then
    rejected by the lint on the artifact.
  - `src/shared/studio/shot-import.ts:20, 49` — the classifier's private `SHOT_MODULES` set is
    gone; it uses `isShotModuleSpecifier`.
  - Preview: `src/main/services/virtual-module-files.ts` (new, pure) — the shared-instance map
    moved out of `tsx-transpiler.ts` (used at :234) and gained `remotion/no-react` →
    `remotion.js/no-react`, `remotion/version` → `remotion.js/version`. Before this, a direct
    `remotion/no-react` import in a transpiled shot went to **esm.sh** (`buildCdnUrl`, no alias)
    = a second copy, offline failure.
  - `src/main/services/module-server.ts:136-139` — new route `/virtual/remotion.js/version`;
    `src/main/services/virtual-modules.ts:346` `getVirtualRemotionVersionModule()` (re-exports
    `VERSION` from `window.__VIDTSX_REMOTION__`, which remotion's root exports). The
    `/virtual/remotion.js/no-react` route (:131) already existed; its virtual module exports
    exactly what 4.0.435 `no-react.mjs:693` exports (`random, interpolate, NoReactInternals`).
  - Export: nothing to change — `@remotion/bundler` 4.0.435 `dist/webpack-config.js:31-33`
    aliases `remotion/no-react`, `remotion/version` and `remotion` to the app's one copy.
  - `src/shared/tsx-engine/builder-libraries.ts:114-115` — comment only.
  - Tests: `shot-bundle.test.ts:193` (Space Grotesk via `@remotion/google-fonts`: no inlined
    `remotion`, no `remotion_delayRenderHandles`, the `remotion/no-react` import hoisted above
    `function __vidtsxInit()`, lint clean); `shot-lint.test.ts:68, 79` (accepts both subpaths;
    rejects `remotion/foo`, a deep `remotion/dist/...` path, `@remotion/google-fonts/Inter`,
    `react-dom`); `virtual-module-files.test.ts` (3 tests).
- **Parity spike, static half:** the editor's inlined google-fonts is
  `D:\repos\claude-youtube-editor\remotion\node_modules\@remotion\google-fonts` **4.0.486**; its
  font module imports `continueRender, delayRender` from `remotion` and uses exactly one
  `NoReactInternals` member, `ENABLE_V5_BREAKING_CHANGES` — present in the app's 4.0.435
  (`node_modules/remotion/dist/esm/no-react.mjs:508` `= false`, exported :684). So the API the
  4.0.486 code calls exists; the one-shot render (step 3) is still the decider per §5.
- **Step 2 — the shared copy + one-shot re-bundle (agent 2, 2026-10-21, nothing in git).**
  - The copy: `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\v14-root\projects\video-14`
    (robocopy /E of the original: 127 dirs, 461 files, 458.17 MB; gitignored by `.gitignore:35`
    `.vidtsx-temp/`). Studio root for every isolated profile from now on:
    `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\v14-root`.
  - The COPY's `notes/import/build-video14.mjs` is edited (the original's is untouched):
    `:25-37` — `PROJ` comes only from `--proj=<dir>` or env `V14_PROJ`, no default ("Refusing to
    run: pass --proj=…"), and anything under `%USERPROFILE%\Videos\VidTSX Studio\projects` is
    refused; `--shots-only` and `--shot=<row id | shot id>` (repeatable / comma list).
    `:97-136` — the `--shots-only` block: needs an existing `project.json`, re-bundles each
    matching timeline row through `importShot` (Studio's `bundleShotSource` compiled from this
    repo's `src` by `studio-lib.mjs`), refuses a shot whose lint fails, whose config differs from
    `project.json`'s or whose media keys differ from its `assetRefs`, then writes ONLY
    `shots/<id>/v<activeVersion>.tsx` (project.json untouched) and prints KB before→after,
    `remotion_delayRenderHandles` count before→after, and whether a top-level
    `from "remotion/no-react"` import sits above `function __vidtsxInit(`. Report:
    `notes/import/shots-only-report.json` (`-dry.json` for a dry run). Exit 2 on any problem.
  - `v14-a1-nobody` re-bundled for real (167 → 124 KB); its pre-A3 bundle is kept at
    `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\A3\v14-a1-nobody.v1.before.tsx`. The other 54
    `v1.tsx` in the copy are still the OLD bundles (step 4 rewrites them).
  - The shot on the timeline: shots-track clip `V14A1Nobody`, `timelineStart` 5.6 s, duration
    11.1 s (5.6–16.7 s); shot config 1920×1080 @ 30, 333 frames.
- **Step 3: the one-shot proof (agent 3, 2026-10-21 20:55–21:05, nothing in git).** All driver
  files are in `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\A3\` (gitignored):
  `launch.sh` (A2's, port **9231**, profile `A3\profile`, log `A3\app.log`), `cdp.mjs`, `dom.js`,
  `restore.ps1` (port 9231), `awake.ps1` (keep-awake + BelowNormal on this repo's processes and
  `chrome-headless-shell`, stops when `A3\awake.stop` exists), `drive.mjs` (phases `ready`,
  `setup`, `player <sec> <tag> [fresh]`, `export <in> <out> <tag>`; editor-up hook is
  `[data-export-button]` — `V1 options` does not exist in video-14, its video track label is
  truncated). The isolated profile now has: Studio root = the copy, CPU "low", output folder
  `A3\export`, crash-report toast dismissed.
  - **Player half — clean.** After a `Page.reload` with Network/Runtime/Log on, open video-14,
    seek to 00:08.00 (inside `V14A1Nobody`): `window.remotion_delayRenderHandles.length` 0 and
    `remotion_renderReady` true from the first sample (+3 s) to the last (+30 s); `/virtual/remotion.js`
    and `/virtual/remotion.js/no-react` both 200; 0 esm.sh requests; 0 non-2xx; 0 exceptions;
    Space Grotesk + Inter faces loaded through the font proxy (`/fonts?u=` ×9, all 200). Report
    `A3\report-player-8s.json`, still `A3\stills\player-8s.png`.
  - **Render half — completed.** Range 0:06–0:11, Standard, Full 3840×2160, Quality High, 60 fps
    (project settings), CPU "low", BelowNormal: 300/300 frames, 232.7 s wall (bundling 6 s,
    first frame 8.3 s after confirm, rendering ≈ 221 s ≈ 1.36 fps), `success: true`, persisted
    row `done 300/300`. The export entry carries the `'brand fonts'` hold (video-14's
    `brand.json` = Space Grotesk / Inter, resolved by `project-brand.ts:41-50` with no
    `brandId`), and no delayRender timeout occurred → the hold was released. For contrast, the
    2026-10-16 attempt (82–102 s, old bundles): 171 frames in 607 s, cancelled. Output
    `A3\export\studio-video-14_2026-10-21T17-59-08.mp4` (4,235,176 bytes); still at timeline
    8.0 s `A3\stills\export-8s.png` matches the Player still (pill "ALMOST NOBODY BUILDS THIS",
    laptop "?", PiP). Report `A3\report-std-4k60-6-11.json`, driver log `A3\run-export.log`.
  - **Spike verdict (§5 "A3 parity"):** the inlined 4.0.486 `@remotion/google-fonts` calling the
    app's one 4.0.435 `remotion/no-react` works in preview and in a real 4K60 export → keep T7,
    no `@remotion/google-fonts` externalization.
- **Step 4: all 55 + gates + close (agent 4, 2026-10-21 21:06–21:20; repo change = docs only).**
  - All 55 `shots/<id>/v1.tsx` in the COPY re-bundled by the copy's `build-video14.mjs
    --shots-only` (log `A3\shots-only-all55.log`, report the copy's
    `notes/import/shots-only-report.json`: `dry:false`, `problems:[]`, 55 rows). Per file: handles
    `1 → 0` for 54 shots, `0 → 0` for `V14A1Nobody` (step 2; 124 → 124 KB, i.e. deterministic);
    KB sum 8,698 → 6,355 (−43 to −44 KB each, e.g. `V14A2Build 278 → 234`, `V14A3HeatMap 122 → 79`).
    The copy's `project.json` was not written.
  - Closing Player check, A3 profile (port 9231, root = the copy, log `A3\app-close.log`):
    8.0 s (`V14A1Nobody`, fresh reload) and 30.0 s (`V14A1Secret`, 28.3–38.6 s, re-bundled in this
    step 173 → 130 KB) both clean. Reports `A3\report-player-8s-all55.json`,
    `A3\report-player-30s-all55.json`; stills `A3\stills\player-8s-all55.png`,
    `A3\stills\player-30s-all55.png` (playhead 00:30.00 on `V14A1Secret`, shot drawn, PiP).
  - Scratch driver fix (gitignored): `A3\drive.mjs:148` maps a request with no `url` to `""` — a
    request already in flight when `Network.enable` ran (non-fresh run) has `loadingFailed`
    without `requestWillBeSent` and crashed the report with `reading 'slice'`.
  - Docs: `Status.md` top row "END-TO-END A3 … DONE"; `docs/studio/TESTING.md` `### 18.3 A3`
    (7 checked, 2 open); `DRIVING.md` one "Learned" line; this file; `LOG.md`.

## Verified (exact commands + outputs)

- `npx vitest run src/shared/studio/shot-lint.test.ts src/main/services/studio/shot-bundle.test.ts src/main/services/virtual-module-files.test.ts src/shared/studio/shot-import.test.ts src/shared/tsx-engine/builder-libraries.test.ts`
  → `Test Files 5 passed (5) · Tests 60 passed (60)`.
- Regression proof: with the old regex swapped back (scratch script
  `swap-external.cjs old`), `npx vitest run src/main/services/studio/shot-bundle.test.ts -t "no-react external"`
  → `AssertionError: expected [ Array(2) ] to not include 'remotion'` · `1 failed`; restored →
  `1 passed`.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Full `npx vitest run`: NOT run yet (run it at the part's end with the app stopped, logged).
- Free space at 20:44: **C: 24.46 GB, D: 6.11 GB**; after the copy (20:50): **C: 24.45 GB,
  D: 5.65 GB**.
- Step 2, from the copy's `notes/import/` (PowerShell):
  - `node build-video14.mjs --shots-only --dry-run` → `Refusing to run: pass --proj=<project dir>
    (or V14_PROJ). There is no default.` exit 1.
  - `node build-video14.mjs --shots-only --dry-run "--proj=$env:USERPROFILE\Videos\VidTSX Studio\projects\video-14"`
    → `Refusing to run on Hasan's projects folder: …` exit 1.
  - `node build-video14.mjs --shots-only --dry-run "--proj=D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\v14-root\projects\video-14"`
    → every row `handles 1 → 0  no-react import top-level` (e.g. `V14A5Cracked 175 → 132 KB`),
    last line `55/55 shots checked (DRY RUN — nothing written); handles after: 0; problems: 0`,
    exit 0. So all 55 already re-bundle clean with `c3aefe8` (config + media keys match).
  - `node build-video14.mjs --shots-only --shot=v14-a1-nobody "--proj=D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\v14-root\projects\video-14"`
    → `V14A1Nobody 167 → 124 KB  handles 1 → 0  no-react import top-level` ·
    `1/1 shots written; handles after: 0; problems: 0` exit 0.
  - `Select-String … shots\v14-a1-nobody\v1.tsx -Pattern remotion_delayRenderHandles` → 0 hits;
    `^import .* from "remotion` → lines 7-34, incl. `:14 import { NoReactInternals } from
    "remotion/no-react";` (four copies, :14/16/18/20, one per inlined google-fonts family), and
    `function __vidtsxInit` at :38 — below every import.
- Step 3 (bash, from `.vidtsx-temp/end-to-end/A3/`; ports 9222/5173/9231 free and no
  `electron.exe` running beforehand):
  - `bash launch.sh` (background) → CDP up; `node drive.mjs ready` → `ready after 8513 ms of polling`.
  - `node drive.mjs setup` → `{"r":{"success":true},"g":{"root":"D:\\repos\\VidTSX-STUDIO\\.vidtsx-temp\\end-to-end\\v14-root"},"c":{"success":true},"o":{"success":true},"projects":["video-14"]}`.
  - `node drive.mjs player 8 player-8s fresh` → `timecodes ["00:08.00/ 08:05.43","00:08.00"]`;
    ten samples `hold {"handles":0,"renderReady":true,"sg":true,"inter":true,"faces":25}`;
    `summary {"final":{"handles":0,"renderReady":true,"sg":true,"inter":true},"virtual":["200 /virtual/remotion.js","200 /virtual/remotion.js/no-react"],"esmSh":0,"non2xx":0,"consoleErrors":7,"exceptions":0}`.
    The 7 console entries are benign: 3 Electron security warnings (dev), the Remotion license
    note, 3 React "unique key" warnings from `V14A1WebWall` / `BrandBg` / `PageDash` (shot code).
    1582 requests: `127.0.0.1:3200` `/modules` 55, `/fonts` 9, `/asset` 6, `/virtual` 3.
  - Free space before the render (20:58): **C: 24.41 GB, D: 5.59 GB**. `awake.ps1` in the
    background (log `A3\awake.log`: BelowNormal set on the `chrome-headless-shell` processes).
  - `node drive.mjs export 6 11 std-4k60-6-11 > run-export.log` → `dialog` Standard checked
    (still `A3\stills\std-4k60-6-11-dialog.png`: "Exports 0:06 – 0:11", Full (3840×2160), High,
    estimate "Standard: about 6 min"); `progress rendering 0% 0/300` at 17:59:16Z … `100% 300/300`
    at 18:02:56Z; `complete {"jobId":"85b5b100-32b6-4445-a50e-5030c7e31760","success":true,…,"fileSize":4235176} elapsed 232670`;
    `final {"persisted":{"status":"done","frames":"300/300",…}}`; `exit 0`.
  - `ffprobe -count_frames` (Remotion's, `node_modules/@remotion/compositor-win32-x64-msvc`) →
    `codec_name=h264|width=3840|height=2160|r_frame_rate=60/1|duration=4.999000|nb_read_frames=300`;
    audio `aac` 4.999 s.
  - `tail -n +596 app.log | grep -iE "delayRender|timeout|timed out|not cleared|brand font|error" | grep -v DEBUG`
    → no lines (595 = the log's length before the export).
  - Job scratch `%LOCALAPPDATA%\Temp\vidtsx-studio\export\85b5b100-…` removed after the run
    (`Test-Path` False). Instance stopped (TaskStop on the launcher + the 9231 tree); ports
    9231/5173/3200 free, no `electron.exe`. Free space after: **C: 23.97 GB, D: 5.55 GB**.
- Step 4 (agent 4). Beforehand: no `electron.exe`, ports 9222/5173/9231/3200 not listening;
  free space 21:06 **C: 23.95 GB, D: 5.55 GB**.
  - PowerShell, cwd the copy's `notes\import`:
    `node build-video14.mjs --shots-only "--proj=D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\v14-root\projects\video-14" *> …\A3\shots-only-all55.log`
    → exit 0; 55 lines `handles 1 → 0  no-react import top-level` (`V14A1Nobody 124 → 124 KB
    handles 0 → 0`); last line `55/55 shots written; handles after: 0; problems: 0`.
  - bash, in the copy: `ls shots/*/v1.tsx | wc -l` → 55;
    `grep -l remotion_delayRenderHandles shots/*/v1.tsx | wc -l` → **0**;
    `cat shots/*/v1.tsx | grep -c remotion_delayRenderHandles` → **0**;
    `grep -rl remotion_delayRenderHandles shots | wc -l` → 0;
    `grep -l '^import .* from "remotion/no-react"' shots/*/v1.tsx | wc -l` → 55. Report sums
    (node over `shots-only-report.json`): `{ n: 55, dry: false, problems: [], hb: 54, ha: 0, kb: 8698, ka: 6355 }`.
  - `npx vitest run > .vidtsx-temp/end-to-end/A3/vitest-full.log 2>&1` (no app running) →
    `Test Files 1 failed | 420 passed | 4 skipped (425)` · `Tests 3 failed | 3540 passed | 22
    skipped (3565)` · 50.2 s; the 3 failures = the known flake (`shot-generator.test.ts` "a
    cancelled new shot…", "the caller's signal…", "a failed new shot…"). Rerun alone
    `npx vitest run src/main/services/studio/shot-generator.test.ts` (log
    `A3\vitest-rerun-shot-generator.log`) → `Test Files 1 passed (1)` · `Tests 18 passed (18)`.
  - `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
    `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
  - `A3_LOG=app-close.log bash launch.sh` (background) → `node drive.mjs ready` → `ready after
    15572 ms of polling`; `window.api.studioRootGet()` →
    `{"root":"D:\\repos\\VidTSX-STUDIO\\.vidtsx-temp\\end-to-end\\v14-root"}` (no `setup` re-run).
  - `node drive.mjs player 8 player-8s-all55 fresh` → `timecodes ["00:08.00/ 08:05.43","00:08.00"]`;
    10 × `hold {"handles":0,"renderReady":true,"sg":true,"inter":true,"faces":25}`;
    `summary {"final":{"handles":0,"renderReady":true,"sg":true,"inter":true},"virtual":["200 /virtual/remotion.js","200 /virtual/remotion.js/no-react"],"esmSh":0,"non2xx":0,"consoleErrors":10,"exceptions":0}`.
    The 10 console entries: the 3 Electron dev security warnings ×2 (before and after the reload),
    the Remotion license note, 3 React "unique key" errors (`AbsoluteFill` / `V14A1WebWall` /
    `PageDash`, shot code). 1582 requests; non-Vite: `/modules` 55 × 200, `/fonts` 9 × 200,
    `/virtual` 3 × 200, `/asset` 4 × 206 + 2 × 200.
  - `node drive.mjs player 30 player-30s-all55` (no reload) → `timecodes ["00:30.00/ 08:05.43","00:30.00"]`;
    10 samples all `handles 0, renderReady true` (faces 37);
    `summary {"final":{"handles":0,"renderReady":true,"sg":true,"inter":true},"virtual":[],"esmSh":0,"non2xx":0,"consoleErrors":3,"exceptions":0}`
    (the 3 = the React key errors; 17 requests, all `/asset` 200/206 — modules and fonts were
    already loaded). A first attempt landed at 00:29.00 and crashed the report on a url-less
    request; fixed in the driver (see Done) and rerun.
  - `grep -iE "delayRender|timeout|timed out|not cleared|error" app-close.log | grep -v DEBUG` →
    no lines (337-line log).
  - Stop: TaskStop on the launcher + `Stop-Process` on every process whose command line has
    `9231` (bash ×2, cmd, node ×2, electron ×2) → `left: 0`, `electron: 0`, nothing listening on
    9231/5173/3200.

## Next step (ONE concrete instruction)

None for A3 — the part is DONE. The orchestrator moves on to A4 (font preflight, GPU proxies),
which reuses the same video-14 copy and may reuse this kit (`A3\launch.sh`, `drive.mjs`; pick a
new port and profile per DRIVING.md).

## Open problems

- **For Hasan (not a blocker):** his own `~/Videos/VidTSX Studio/projects/video-14` still holds
  the OLD 55 bundles (each with an inlined `remotion/no-react`), so exporting it from his profile
  still hits the 2026-10-16 timeout until it is re-bundled; the same goes for any other project
  whose shots were bundled before `c3aefe8` with a `@remotion/*` font load. There is no in-app
  re-bundle; the copy's script refuses his projects folder by design. Shots built from now on
  get the fix through the same bundle step.
- **Copy isolation (for A4–A6):** the copy's `project.json` holds 127 absolute asset paths into
  the ORIGINAL's `media\` folder (`C:\Users\hasan\Videos\VidTSX Studio\projects\video-14\media\…`;
  the copy has its own `media\` with the same 127 files). The Player's `/asset` requests read
  those originals (GET only, seen in `report-player-30s-all55.json`). Nothing writes there, but
  the copy is not self-contained; rewriting the paths to the copy's `media\` is the orchestrator's
  call. (Proxies already resolve inside the copy's `cache\proxies`.)
- `src/main/services/virtual-modules.ts` is now 357 lines (it was 339 before A3, already over the
  ~300 house limit). The version module went there as the natural home; splitting the file is
  out of A3's scope.
- (Resolved in step 3) the live Player check passed — see Done/Verified.
- (Resolved in step 4) all 55 copy bundles are new; no old `__vidtsxInit` can reset the handles
  in the copy's Player any more.
- Not measured: the Player's hold behaviour on the OLD bundle (the pre-A3 baseline). The plan
  does not require it; skipped to stay on the copy's single re-bundled shot.
- The export entry's generated source is in the job scratch and is deleted after the run, so the
  `'brand fonts'` hold is evidenced indirectly (brand resolved from `brand.json`, render completed,
  no delayRender timeout in `app.log`), not by reading the entry.
- Plan §1.3 text ("the lint still allows only the three externals and rejects subpaths") is now
  outdated by design (T7); the plan is not edited by builders.

## Do-not-redo

- A1 DONE, A2 DONE (export disk preflight + job-scoped Remotion temp). Do not touch `main`.
- Step 1 (`c3aefe8`): the externals regex, the lint widening, the preview map/route and their
  tests are done and proven to fail without the fix. Do not re-derive them.
- The parity question is answered statically (one member, present in 4.0.435); only the live
  render remains.
- Step 2: the copy exists (do not re-copy — it would also undo the re-bundle); the copy's
  `build-video14.mjs` already has `--proj` / `--shots-only` / `--shot=` and refuses the original
  path; `v14-a1-nobody` is already re-bundled; the all-55 dry run is already clean. Step 4 is
  just: `node build-video14.mjs --shots-only "--proj=D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\v14-root\projects\video-14"`
  from the copy's `notes/import/`, then the grep.
- Step 3: the one-shot proof is DONE — Player clean, the 6–11 s 4K60 Standard render completed
  (300/300, 232.7 s), parity holds, no fallback. Do not re-render, do not externalize
  `@remotion/google-fonts`. The A3 profile is already set up (root = the copy, CPU low, output
  `A3\export`); reuse it, do not run `setup` against another root.
- Step 4: all 55 copy bundles are re-bundled (grep = 0) and the gates ran green; do not re-run
  `--shots-only` on the copy (it is deterministic, `V14A1Nobody` 124 → 124 KB) unless `src/` changes
  the bundle step again.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-21 · agent 1 · ~38 calls · step 1: read the code paths (bundle step, lint, finish,
  preview transpiler + module server, export webpack aliases), the fix + tests, regression proof,
  types gate, static parity; commit `c3aefe8`.
- 2026-10-21 · agent 2 · ~22 calls · step 2: the video-14 copy (458 MB), the copy's import
  script guarded + `--shots-only`/`--shot=`, all-55 dry run clean, `v14-a1-nobody` re-bundled
  (0 handles, top-level `remotion/no-react` import). Handed off at the step boundary.
- 2026-10-21 · agent 3 · ~45 calls · step 3: A3 driver kit (launch/cdp/drive/awake), Player at
  8.0 s clean (0 handles, renderReady, `/virtual/remotion.js{,/no-react}` 200, no esm.sh), the
  6–11 s 4K60 Standard render completed (300/300, 232.7 s, ffprobe 3840×2160 60/1 300 frames);
  parity verdict = holds. Handed off at the step boundary.
- 2026-10-21 · agent 4 · ~35 calls · step 4: all 55 re-bundled on the copy (handles 54 → 0,
  8,698 → 6,355 KB, grep 0), full vitest (known flake only, rerun 18/18) + types 26/10, closing
  Player check at 8 s and 30 s clean, STATUS row + TESTING §18.3; part DONE.

# A2 — Export disk preflight + cancel/failure cleanup of the job's Remotion assets folder
status: IN PROGRESS (steps 1–2 done; step 3: bundle-probe leak FIXED `4b1156d` and proven live by
run (a′) — a cancelled Standard range leaves nothing; Fast cancel (a″) blocked by the Fast engine
staying "Needs the GPU encoder download" after the download; next = make Fast selectable, then (a″), (b), (c))

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety rules, launcher, repo facts).

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **A2** | The disk preflight (output drive + `%TEMP%`, estimate shown) and the cancel/failure cleanup of the job's Remotion assets folder | a cancelled range export leaves nothing; a too-small disk refuses with numbers |

Session gates (plan §3 head): `npx vitest run` green, `npm run check:types` at or below
baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the STATUS.md row,
the TESTING.md §18 block (add `### 18.2 A2` under the existing `## 18`). Anything the
composition renders is verified in preview AND a real export before the part closes (A2
changes no rendering).

## Plan context (§1.x facts, §2 decision, §5 items to read)

**§1.7 "Temp" (plan :365-370):** temp entries in `<appRoot>/.vidtsx-temp/studio` (24 h sweep);
export scratch `%TEMP%/vidtsx-studio/export/<jobId>` removed after every run; Remotion's own
`%TEMP%/remotion-v4.0.435-assets*` copy of every source is swept at startup when older than
1 h, and on cancel only **empty** trees are removed (`run-export.ts:196-236`) — the cancelled
3.77 GB folder was left behind. **No disk-space preflight for exports** (the only `statfs` is
the AI-runtime installer).

Orchestrator's read of the current code (2026-10-21):
`src/main/services/studio/export-engines/run-export.ts` — `sweepExportScratch()` (startup:
scratch dirs + asset dirs older than 1 h), `remotionAssetDirs()` (every
`remotion-v\d+.\d+.\d+-assets*` under `app.getPath('temp')`), `removeEmptyRemotionAssetDirs(since)`
(after a cancel: only dirs born since the export started AND holding no files — "a folder
holding any file belongs to a live render and is left alone"). The hard part of A2 is knowing
which asset folder is THIS job's, so a cancel never deletes another render's folder (Hasan's
own app or another job may be rendering at the same time). Prefer a positive identification
(e.g. Remotion's own per-render download-map dir, if `renderMedia`/the compositor exposes or
accepts it) over a timing heuristic; record what you find.

Other §1.7 facts that touch A2: range export trims the timeline and overrides the frame count
(`studio-handlers.ts:482-499`); Standard concurrency from Settings › Rendering default CPU
(`render-cpu-usage.ts:10-15`); the two copy engines (Fast/Fastest) also write scratch and
browser spans (`export-spans.ts`), so the preflight and the cleanup should cover all three
engines, not only Standard.

**§2 T7 (the A2 slice):** "**Temp + disk**: on cancel/failure the job's own Remotion assets
folder is deleted; a disk-space preflight (output drive and `%TEMP%`) refuses an export that
would not fit, with the estimate shown."

**Making "a too-small disk" testable:** there is a precedent for a dev-only machine-fact
override — `VIDTSX_AI_RUNTIME_OVERRIDES` (`freeBytes`, read once per process, ignored in
packaged builds; `docs/ui-automation-cdp.md` "Getting past native dialogs"). A matching
dev-only override for the export preflight's free-space probe lets the CDP run show the
refusal and its numbers without filling a disk.

**§5:** none specific to A2. §1.8: C: 25 GB free, D: 7.0 GB free at the branch point.

## Done (file:line, commit hashes)

**Step 1 — pure helpers + unit tests, commit `dd77b87`** (all in
`src/main/services/studio/export-engines/`, none wired in yet):

- **Finding — how Remotion 4.0.435 names its folder:** `@remotion/renderer/dist/tmp-dir.js`
  `tmpDir(str)` = `path.join(os.tmpdir(), str + randomHash(10))`, called by
  `assets/download-map.js` `makeDownloadMap()` with `remotion-v${VERSION}-assets`, from
  `prepare-server.js` `prepareServer()` — one per `renderMedia`/`selectComposition` call
  (Standard's render, each Fast browser span, each Fastest shot layer, the audio pass, the dev
  verify). Public `renderMedia` passes `server: undefined` and exposes neither the server nor
  the folder (only `RenderInternals.internalRenderMedia`, ~60 required params, takes a
  `server`). Remotion does clean it in `closeServer` → `cleanDownloadMap`, but not awaited,
  skipped while `preventCleanup()` is set (stitcher), and its `rmSync` gives up after 2 retries
  on Windows locks → the 3.77 GB leftover. `os.tmpdir()` is read at call time through
  `require('node:os')`'s module object.
- **Positive identification chosen:** `remotion-temp-scope.ts:35` `withRemotionTempDir(dir, fn)`
  — an `AsyncLocalStorage` scope; `os.tmpdir` is replaced once (defineProperty on the
  default-imported builtin) by `() => scope.getStore() ?? original()`. Inside the scope,
  Remotion's `makeDownloadMap()` creates its folder under `dir` (the job's scratch), so it
  leaves with the scratch on success, cancel and failure; renders outside the scope (another
  job, Creator) keep the real temp. The test proves it against Remotion's own
  `RenderInternals.makeDownloadMap()`, and that a parallel task outside the scope still sees
  the real temp.
- `disk-estimate.ts:64` `estimateExportDisk(input)` → `{ outputBytes, tempBytes, temp: {
  remotionCopies, intermediate, audio, shotLayers } }`. Model: H.264 0.15 bit/px/frame at CRF
  18, halving per +6 CRF (`h264BytesPerSecond` :59; 1080p30 ≈ 9.3 Mb/s); PCM 192 kB/s; AAC
  320 kb/s; ProRes 4444 5.5 bit/px (Fastest's shot layer, longest contiguous shot run only —
  one layer lives at a time, `shot-layer-render.ts` `ShotLayerRuns`). Standard: temp =
  whole-file source copies + encoded `.mkv` + PCM; output = encoded + AAC. Fast/Fastest: per
  picture source max(source rate, encode rate) × seconds shown + encode rate × uncovered
  seconds (unknown length → whole file); temp = copies + pieces + WAV (+ layer).
- `disk-sources.ts:31` `exportDiskSources(project, entry)` → distinct files (the entry's proxy
  or the original for picture; the original too when it has sound and the entry reads a proxy;
  audio clips' originals; images skipped) with `videoSeconds`, plus `longestShotRunSeconds`
  (merged `tsx` clips). Copes with `{}` (run-export.test passes `{} as StudioProject`).
- `disk-preflight.ts:32` `diskPreflightVerdict(estimate, { output, temp }, headroom = 512 MB)`
  — volumes keyed by `stat.dev` (`key`) so output + temp on one drive add up; refusal e.g.
  `Not enough disk space for this export. C: needs about 4.8 GB free — temporary files 4.3 GB
  (copies of the sources 3.8 GB, rendered video 410 MB, audio 102 MB) + 512 MB to spare — and
  has 1.2 GB.` `formatBytes` :71 (Explorer units, 1024³).
- `disk-dev-overrides.ts` — `VIDTSX_EXPORT_DISK_OVERRIDES='{"freeBytes":1000}'` (every drive)
  or `'{"freeBytes":{"C:":1000}}'` (by drive label); ignored when `!process.defaultApp`
  (packaged); `devFreeBytesFor(label)` :50.

**Step 2 — wiring + tests, commit `88de827`** (all in `src/main/services/studio/export-engines/`):

- **Which process each render runs in (orchestrator's question) — all in the MAIN process.**
  Standard (`remotion-engine.ts:21,39`), Fast's browser spans (`passthrough-browser.ts:12`) and
  Fastest's shot layers (`shot-layer-render.ts:18`) all call `renderComposition` from
  `src/main/services/remotion-renderer.ts`, which calls `renderMedia`/`selectComposition`
  in-process (:165, :285); the audio pass calls `renderMedia` directly (`audio-pass.ts:16,38`);
  the dev verify re-enters the same engines. The only `utilityProcess` forks in `src/main` are
  the webpack bundle worker (`remotion-bundler.ts:199`, runs BEFORE `runStudioExport`, makes no
  assets folder) and the faces/masks analysis process. No `worker_threads`. So the scope reaches
  every Remotion call of an export. Remotion 4.0.435 reads `os.tmpdir()` in exactly three places
  (`grep -rn "tmpdir()" node_modules/@remotion/renderer/dist`): `tmp-dir.js:53` (the assets
  folder), `open-browser.js:80` (`puppeteer_dev_chrome_profile-*`), `render-media.js:176`
  (`react-motion-render*`) — all three now land in the job's scratch. Still to PROVE on disk in
  the live run (step 3).
- `export-disk-check.ts:41` `checkExportDisk({ jobId, engineId, project, entry, render,
  outputPath })` → `{ estimate, verdict | null }`; never throws: stats the sources in parallel
  (missing → 0 bytes), `volumeOf` :76 = nearest existing parent's `stat.dev` + `statfs`
  `bavail*bsize`, `devFreeBytesFor(label)` overrides; a drive whose free space cannot be read →
  verdict `null` (not judged, logged). Logs `Export disk estimate` (logger `StudioExportDisk`)
  with output/temp/parts/drives on every export.
- `run-export.ts:64` `runStudioExport`: `active.set` first (a cancel during the preflight is
  honoured → `Cancelled`), then `checkExportDisk` :70; a refusal deletes the active entry and
  throws `verdict.message` BEFORE `workDir` exists — the output file is never touched. Then
  `mkdir <workDir>/remotion` and the whole body (`produceExport` :94, the old try-body unchanged)
  runs in `withRemotionTempDir(remotionTemp, …)` :86. `finally`: `removeScratch` (awaited 12 ×
  500 ms, then a background `setInterval` every 5 s, 24 tries, `unref`'d — :197-229), then the
  existing output delete on abort. `removeEmptyRemotionAssetDirs`/`holdsNoFiles` DELETED.
  `sweepExportScratch` :237 unchanged (still sweeps `%TEMP%` Remotion folders older than 1 h —
  Creator / non-Studio renders).
- `remotion-temp-scope.ts:18,41` extended: the scope holds `{ dir, open }`, and `open` turns false
  when `withRemotionTempDir` settles — a timer/handle the export left running reads the real
  temp, never the deleted scratch.
- Tests: `run-export.test.ts:107` (refusal: `freeBytes` 1000 via a mocked `devFreeBytesFor` →
  message matches `/^Not enough disk space for this export\. .+ needs about .+ and has 1 KB\.$/`,
  `produce` never called, a pre-existing output file keeps its bytes, no scratch dir); :117 (an
  engine's `os.tmpdir()` is `<tmp>/export/job-fails/remotion`; a fake
  `remotion-v4.0.435-assets*` with a file inside is gone with the scratch after the engine
  throws); `remotion-temp-scope.test.ts` +1 (a timer started in the scope reads the real temp
  after it ends).

**Step 3 (part) — live run (a), Standard range cancel, 2026-10-21 16:45–16:47 UTC, no commit (no
src change).** Kit in `.vidtsx-temp/end-to-end/A2/` (gitignored): `launch.sh` (port 9242, profile
`A2/profile`, log `A2/dev-app.log`, `A2_LOG=<name>` picks another log file), `restore.ps1`, `cdp.mjs`,
`dom.js` (A1's, port changed), `seed.mjs` (writes `A2/studio-root/projects/a2-disk/project.json`: a
COPY of `C:/Users/hasan/Downloads/1-intro.mp4` → `A2/media/intro-copy.mp4`, 1080p60 H.264+AAC,
72.84 s, 26,117,588 B; timeline 1920×1080 60 fps, clip A 0–20 s from 0 with a 3 s crossfade out,
clip B 20–60 s from 25 s — Fast gets a browser span), `drive.mjs` (`ready` · `setup` = studioRootSet
to the scratch root + `settingsSetRenderDefaultCpuUsage({cpuUsage:'low'})` +
`settingsSetOutputFolder({path: A2/out})` · `run <tag> <engine> <in> <out> <cancel|complete|refuse>
[cancelAfterSec]` = open card `a2-disk`, Home / Shift+→ ×in / `i` / Shift+→ / `o`, "Export range",
engine radio, confirm, follow `onRenderProgress`, cancel from the Queue row, snapshot `%TEMP%`
(`remotion-v*-assets*`, `puppeteer_dev_chrome_profile-*`, `react-motion-render*` with birth times),
`%TEMP%/vidtsx-studio/export/<jobId>/remotion/*` with bytes, and `A2/out`, before / during / 12 s
after; writes `report-<tag>.json`). After launch, every electron.exe whose command line holds
`end-to-end/A2/profile` was set to `BelowNormal` (children inherit it).

Result of `node drive.mjs run std-cancel remotion 5 35 cancel 15` (`report-std-cancel.json`,
`run-std-cancel.log`, stills `stills/std-cancel-dialog.png`, `stills/std-cancel-queue.png`):
- bundling 16:46:11→16:46:50 (fresh bundle, 39 s), rendering 1800 frames, cancelled at 135/1800.
- **During (16:47:07), `%TEMP%\vidtsx-studio\export\218a891e-…\remotion\` held:**
  `remotion-v4.0.435-assetsixqn68x19v` (1 file, 26,117,588 B = the source copy, byte-exact),
  `puppeteer_dev_chrome_profile-cODgkf` (1.77 MB, 45 files — the GL probe's, it ran inside the
  scope), `puppeteer_dev_chrome_profile-uAh3iD` (36.2 MB, 92 files — the render browser),
  `react-motion-renderW6gd2a`. Scratch total 64,074,355 B. **The scope works on disk: Remotion's
  assets folder, both render-time browsers and the render folder all land in the job's scratch.**
- Complete event `success:false, error "renderMedia() got cancelled"`; queue row "Cancelled";
  persisted `status: cancelled, framesRendered 135/1800`.
- **12 s after cancel:** scratch dir for the job GONE, `A2/out` EMPTY (no output file), NO new
  `remotion-v*-assets*` in `%TEMP%`. **One new entry in `%TEMP%`:
  `puppeteer_dev_chrome_profile-jNmJPx`, born 16:46:50.511Z** (5.57 MB, `Default/` +
  `DevToolsActivePort`) — still there after the app was stopped (left in place as evidence).
- Main log (`A2/profile/logs/vidtsx-2026-10-21.log`): `Export disk estimate` at 16:46:51.859Z
  `{engine:"remotion", output:"68 MB", temp:"97 MB", parts:{remotionCopies:26117588,
  intermediate:69984000, audio:5760000, shotLayers:0}, drives:["C: needs 97 MB, has 24.6 GB",
  "D: needs 68 MB, has 6.5 GB"]}`; `GL backend: angle (GPU; …; 960 ms)` at 16:46:52.826Z (so the
  probe started ≈16:46:51.87, AFTER the stray profile was born). No `still locked` line.
- Export dialog: `[data-export-estimate]` was null for this range (the dialog shows no estimate
  before confirm; the estimate is only logged and, on refusal, in the message).

**Step 3 (part) — the bundle-probe leak fixed, commit `4b1156d`** (agent 4):

- Confirmed in code: `bundleComposition` (`src/main/services/remotion-bundler.ts`, MAIN process)
  called Remotion's `getCompositions(serveUrl)` after every FRESH bundle (cached bundles skip it),
  outside any export scope → one `%TEMP%\puppeteer_dev_chrome_profile-*` per (re)bundle.
- `src/main/services/bundle-compositions.ts:12` `listBundleCompositions(serveUrl)` — the
  `getCompositions` call + metadata mapping, run inside
  `withOwnRemotionTemp(path.join(getTempDir(), 'export'), …)`; `remotion-bundler.ts:354` calls it
  (still catches → `[]` + warn as before). The export job's scope was NOT widened.
- `src/main/services/studio/export-engines/own-remotion-temp.ts:15` `withOwnRemotionTemp(parent, fn)`
  — `mkdtemp(<parent>/probe-)`, `withRemotionTempDir(dir, fn)`, `finally` `removeDirWithRetry`.
  A probe folder that stays locked is caught by the background retry and, since it sits under
  `export/`, by `sweepExportScratch` at the next start.
- `src/main/services/studio/export-engines/remove-dir-retry.ts:18` `removeDirWithRetry(dir, what,
  context)` — `run-export.ts`'s `removeScratch`/`tryRemove` moved here unchanged (12 × 500 ms, then
  a background retry every 5 s × 24, `unref`'d); `run-export.ts` `removeScratch` now calls it.
- Test `src/main/services/bundle-compositions.test.ts` (2 tests): a mocked `getCompositions` sees
  `os.tmpdir()` = `<tmp>/export/probe-*`, writes a fake Chrome profile there; after the call the
  folder is gone and `export/` is empty — also when it throws (error passed on); `os.tmpdir()` is
  the real temp afterwards.

**Step 3 (part) — live runs on the fixed build, 2026-10-21 16:56–17:06 UTC** (agent 4; kit
unchanged except `drive.mjs` `openProject` now accepts an already-open editor after a Queue visit,
the engine pick waits up to 15 s for the radio to enable and FAILS the run if it cannot be checked;
new `snap.mjs` = `take <tag>` / `diff <a> <b>` of the top-level entries of `%TEMP%` and of
`A2/profile` (name, recursive bytes, birth, mtime) → `snap-<tag>.json`):

- **(a′) `node drive.mjs run std-cancel2 remotion 5 35 cancel 15` — PASS.** Fresh bundle (new
  process, in-memory bundle cache empty): `bundling` 16:57:33→16:57:39, log `Getting compositions`
  16:57:39.832Z → `Found compositions` 16:57:41.160Z (1.3 s incl. the probe folder removal; no
  `still locked` line). Rendering, cancelled at 127/1800. During (16:57:57) the job's
  `remotion\` held `remotion-v4.0.435-assetsruzn3ijtnu` (26,117,588 B), two Chrome profiles and
  `react-motion-render*` (scratch 60,162,459 B). Final: `scratchLeft:false`,
  **`newTempEntries:[]`**, `outputs:[]`, persisted `cancelled 127/1800`
  (`report-std-cancel2.json`, `run-std-cancel2.log`, `stills/std-cancel2-queue.png`).
- `%TEMP%` accounting (`node snap.mjs diff pre-a1 a1-after` → `snapdiff-a1.json`; window = launch
  16:56:46 → after the runs 17:05:47, incl. the ffmpeg download below): `%TEMP%` net **−412 MB**;
  NO new `puppeteer_dev_chrome_profile-*`, `remotion-v*-assets*`, `react-motion-render*` or
  `vidtsx-studio\export\*`. New: `playwright-artifacts-juqsqq` + `playwright_chromiumdev_profile-sRLUAz`
  (9.4 MB, born 17:05:12 — Playwright, not this app), `claude\` shrank 429 MB (another process),
  five `<uuid>.tmp` files (four 0 B born 17:05:21–28, one 9,317 B born 16:56:46.4 = the app's
  launch second) — NOT yet attributed. `A2/profile` net **+224 MB**: `ffmpeg-full` 177,918,482 B
  (the deliberate GPU-encoder download), `Code Cache` +20 MB, `Cache` +19 MB, `bundle-cache`
  +18 MB (the bundle cache — a named, pruned cache: `bundle-cache-prune.ts`), the rest < 0.1 MB.
- **Full ffmpeg installed into the ISOLATED profile** (not copied from Hasan's): `node cdp.mjs
  evalfile install-ffmpeg.js` (`studioProxyEncoderInstall` + poll) → `installed:true`, `detected:
  "nvenc"`, `listed:["nvenc","qsv","amf"]`, `enabled:false`, 250,764 ms; D: 6.51 → 6.34 GB.
- **(a″) Fast cancel NOT run:** the first attempt silently ran Standard (the radio was disabled,
  the click did nothing — the driver now refuses that). After the install, the Fast row is STILL
  disabled: "Fast … Copies 90 % of this timeline. Needs the GPU encoder download: Settings ›
  Rendering › "Faster proxy generation (GPU encoder)" › Download." (`run-fast-cancel.log`,
  `stills/fast-cancel-dialog.png`). Cause not investigated (an `enabled:false` toggle, a status
  cached at app start, or a check in `passthrough-engine.ts` — see Next step).

## Verified (exact commands + outputs)

- `npx vitest run src/main/services/studio/export-engines/disk-estimate.test.ts
  src/main/services/studio/export-engines/disk-preflight.test.ts
  src/main/services/studio/export-engines/disk-sources.test.ts
  src/main/services/studio/export-engines/remotion-temp-scope.test.ts` →
  `Test Files 4 passed (4) · Tests 19 passed (19)` (2026-10-21 19:25).
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok` (the script exits 1 by design; both
  lines say ok).
- Step 2 (2026-10-21 19:35, no app running): `npx vitest run src/main/services/studio/export-engines/`
  → `Test Files 17 passed | 1 skipped (18) · Tests 126 passed | 11 skipped (137)`.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Full `npx vitest run > .vidtsx-temp/end-to-end/A2/vitest-full-step2b.log` → `Test Files 1 failed |
  418 passed | 4 skipped (423) · Tests 3 failed | 3532 passed | 22 skipped (3557)`; the 3 are the
  known `shot-generator.test.ts` flake (DRIVING.md); `npx vitest run
  src/main/services/studio/shot-generator.test.ts` alone → `Tests 18 passed (18)`.
- Free space before step 3: C: 25.3 GB, D: 6.7 GB (2026-10-21 19:31). No `electron.exe`
  running, ports 9222/5173 free.
- Step 3 run (a), 2026-10-21 16:45 UTC: before launch no `electron.exe`, ports 9222/9242/5173
  free, C: 25.28 GB, D: 6.70 GB; after launch + BelowNormal C: 25.21, D: 6.62; after the run and
  stopping the app C: 24.58, D: 6.56. `bash A2/launch.sh` (background) → `node drive.mjs ready` →
  `ready after 11300 ms of polling`; `node drive.mjs setup` → `{"r":{"success":true},"g":{"root":
  "D:\\repos\\VidTSX-STUDIO\\.vidtsx-temp\\end-to-end\\A2\\studio-root"},"c":{"success":true},
  "o":{"success":true},"projects":["a2-disk"]}`; `node drive.mjs run std-cancel remotion 5 35
  cancel 15` → final `{"jobId":"218a891e-c3ad-4aee-9a7f-b9764091efdb","scratchLeft":false,
  "newTempEntries":[{"name":"puppeteer_dev_chrome_profile-jNmJPx","birth":"2026-10-21T16:46:50.511Z"}],
  "outputs":[],"persisted":{"status":"cancelled",…,"framesRendered":135,"totalFrames":1800}}`.
  App stopped afterwards (0 A2 electron.exe, ports 9242/5173 free).
- Bundle-probe fix (2026-10-21 19:53): `npx vitest run src/main/services/bundle-compositions.test.ts
  src/main/services/studio/export-engines/run-export.test.ts
  src/main/services/studio/export-engines/remotion-temp-scope.test.ts` → `Test Files 3 passed (3) ·
  Tests 10 passed (10)`. `npx vitest run src/main/services/ > A2/vitest-services-step3fix.log` →
  `Test Files 2 failed | 236 passed | 3 skipped (241) · Tests 4 failed | 1854 passed | 18 skipped
  (1876)` — the 4 are the known flakes (`shot-generator.test.ts` ×3, `shot-module-resolver.test.ts`
  ×1); `npx vitest run src/main/services/studio/shot-generator.test.ts
  src/main/services/studio/shot-module-resolver.test.ts` → `Test Files 2 passed (2) · Tests 28
  passed (28)`. `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`. Commit `4b1156d`.
- Live runs (agent 4): before launch 0 `electron.exe`, ports 9222/9242/5173 free, C: 24.52 GB,
  D: 6.56 GB; removed the run-(a) evidence `%TEMP%\puppeteer_dev_chrome_profile-jNmJPx`;
  `node snap.mjs take pre-a1` → `temp count 8915, 40,293,099,182 B; profile 32 entries`;
  `A2_LOG=dev-app-a1.log bash launch.sh` (background) → `node drive.mjs ready` → `ready after 84 ms`
  (port was already listening); `node drive.mjs setup` → `{"r":{"success":true},"g":{"root":
  "D:\\repos\\VidTSX-STUDIO\\.vidtsx-temp\\end-to-end\\A2\\studio-root"},"c":{"success":true},
  "o":{"success":true},"projects":["a2-disk"]}`; all 5 A2 electron.exe set BelowNormal (match
  `end-to-end[/\\]A2[/\\]profile`). (a′) final line: `{"jobId":"3ca67ebb-aab9-4f9f-8553-c5eee8ec125c",
  "scratchLeft":false,"newTempEntries":[],"outputs":[],"persisted":{"status":"cancelled",…,
  "framesRendered":127,"totalFrames":1800}}`. After: `node snap.mjs take a1-after` →
  `temp count 8920, 39,861,207,637 B; profile 34 entries, 313,495,984 B`. App stopped
  (`taskkill /T` on the electron-vite node.exe; 0 electron.exe, ports 9242/5173 free); C: 24.72 GB,
  D: 6.46 GB.

## Next step (ONE concrete instruction)

Make the Fast engine selectable on the isolated profile, then finish step 3: read the Fast
availability check (grep `Needs the GPU encoder download` in
`src/main/services/studio/export-engines/passthrough-engine.ts` and follow it into
`src/main/services/studio/ffmpeg-full.ts` `getFfmpegFullBinary` :70) to learn whether it needs the
`studioProxyEncoderSetEnabled({enabled:true})` toggle or only an app restart (the profile now
holds `ffmpeg-full`, `installed:true, enabled:false`); do NOT change src for this unless the check
is plainly wrong (if it is, record it under Open problems instead of fixing it in A2). Relaunch
(`A2_LOG=dev-app-a2.log bash A2/launch.sh` in the background from bash, `node drive.mjs ready &&
node drive.mjs setup`, BelowNormal on every electron.exe matching `end-to-end[/\\]A2[/\\]profile`),
enable the toggle via IPC if that is what it needs, `node snap.mjs take pre-a2`, then run:
(a″) `node drive.mjs run fast-cancel passthrough 5 35 cancel 10` (the 3 s crossfade at 20 s makes
a browser span; the driver now FAILS if the radio cannot be checked) → `newTempEntries:[]`,
`scratchLeft:false`, `outputs:[]`; `node snap.mjs take a2-after && node snap.mjs diff pre-a2
a2-after` and attribute every new `%TEMP%` entry (look at the `<uuid>.tmp` files' content/owner —
see Open problems); (b) stop, relaunch with `VIDTSX_EXPORT_DISK_OVERRIDES='{"freeBytes":{"C:":300000000}}'`
exported in the shell that runs `launch.sh` (and `A2_LOG=dev-app-refuse.log`), `node drive.mjs run
refuse remotion 5 35 refuse` → `queueText` holds `Not enough disk space for this export. C: needs
about … and has 286 MB.`, `scratchLeft:false`, `A2/out` empty (97 MB temp + 512 MB headroom >
286 MB, so it refuses); (c) stop, relaunch without the override, `node drive.mjs run complete
remotion 5 15 complete` → record output bytes in `A2/out` vs the logged `Export disk estimate`
output for that job. Then step 4 (STATUS.md row — name the bundle cache and the ffmpeg-full
download as the deliberate disk users; TESTING.md `### 18.2 A2`; full `npx vitest run` with the
app stopped, logged to a file; commit; `status: DONE`).

## Open problems

- **RESOLVED (`4b1156d`, proven by run (a′)):** the bundle step's composition listing left a
  ~5.6 MB `%TEMP%\puppeteer_dev_chrome_profile-*` per fresh bundle; it now runs in
  `%TEMP%\vidtsx-studio\export\probe-*`, removed after.
- **For the orchestrator / Hasan (not decided, not acted on):** `%TEMP%` holds **3,135
  `puppeteer_dev_chrome_profile-*` folders, 22.03 GB, ALL born in the last 10 days** (counted
  2026-10-21 16:55 UTC, `snap-pre-a1.json`). Remotion never deletes its Chrome profile on Windows,
  so every Remotion browser OUTSIDE an A2 scope still leaks one: Studio shot stills
  (`studio/shot-stills.ts` `selectComposition`/`renderStill`), the TSX builder stills
  (`tsx-builder/build-stills.ts`, `builder-spike-*`), the GL probe when it runs outside an export,
  Creator renders through `remotion-renderer.ts`, plus other tools on this machine (Playwright,
  Hasan's installed app, other agents). A2 closes the export + bundle paths only. Options for a
  later part: wrap those callers in `withOwnRemotionTemp`, and/or extend `sweepExportScratch` to
  remove `puppeteer_dev_chrome_profile-*` older than 1 h (same rule as the assets folders — but the
  name is generic puppeteer, so another program's live profile could match). Deleting the existing
  22 GB is Hasan's call; nothing was deleted.
- **C: accounting (orchestrator: "Must be accounted for before DONE") — partly done.** Run (a′)
  window: `%TEMP%` net −412 MB, no export/bundle leftovers; the A2 profile (on D:) grew 224 MB
  (ffmpeg-full 178 MB deliberate, Chromium caches 39 MB, bundle-cache 18 MB). Still unattributed:
  five `<uuid>.tmp` in `%TEMP%` (four 0 B born 17:05:21–28 UTC while the app idled on the Export
  dialog; one 9,317 B born 16:56:46.4, the app's launch second). Run (a)'s 25.21 → 24.58 GB C:
  drop remains unexplained but is NOT reproduced by (a′) (C: 24.52 before launch → 24.72 after
  stopping); the 3,135 stray profiles above are the likely long-run C: consumer.
- **DECIDED by the orchestrator (2026-10-21):** the refusal message with its numbers satisfies
  "estimate shown" (T7: "refuses … with the estimate shown"). No Export-dialog change in A2; an
  estimate line in the dialog is logged in ORCHESTRATOR.md as a follow-up. Do not build it.
- The estimate is a heuristic (bits/pixel): record measured output vs estimate in the CDP step
  and raise `H264_BITS_PER_PIXEL_AT_CRF18` only if it under-estimates.
- `getTempDir()` (`%TEMP%/vidtsx-studio`) is shared by every app instance, and
  `sweepExportScratch` removes ALL `export/*` at startup: a second instance launched while
  another renders deletes the live job's scratch — and, after this part, its Remotion copies and a
  live composition probe (the bundle then lists `[]` compositions and warns). Same hazard as
  before (DRIVING.md already says not to launch while Hasan renders); not fixed in A2.
- `runStudioExport` deletes `outputPath` on any cancel, even one before finishing began (a
  pre-existing file of the same name). Unchanged; noted only.
- The dev verify (`verifyAgainstEngine`, dev-only) renders a second, reference export into the
  same scratch; the preflight does not count it. Dev instrument only; not fixed.
- Path length: Remotion's folders now sit under `%TEMP%\vidtsx-studio\export\<uuid>\remotion\`
  (~105 chars before Remotion's own names) and the Chromium profile nests deep. No failure in
  runs (a)/(a′); if one shows, shorten `remotion` → `r` in `run-export.ts` (and the test).

## Do-not-redo

- A1 is DONE (`e4803cd`, docs `bd805af` + `8306c8e`). Do not touch `main`.
- Do not re-investigate how Remotion names/creates its assets folder or hunt for a public
  hook: answered above (none public; the ALS scope on `os.tmpdir` is the chosen
  identification, proven against `RenderInternals.makeDownloadMap()`).
- Do not rewrite the step-1 helpers; extend them if the wiring needs more inputs.
- Step 2 (wiring, `88de827`) is done and green: do not re-wire; the process question is
  answered above (all in main).
- The bundle-probe fix (`4b1156d`) is DONE and (a′) proved it (`newTempEntries:[]` after a fresh
  bundle): do not redo either. The full ffmpeg is already in `A2/profile/ffmpeg-full` — do not
  download it again, never copy Hasan's.
- Run (a) Standard cancel is DONE and its on-disk proof is recorded above: do not re-prove that
  the assets folder / render browsers / react-motion-render land in the job scratch. Only Fast cancel
  (a″), (b) refusal and (c) completion remain. Do not rebuild the kit or
  re-search for a test clip (`A2/media/intro-copy.mp4` + `seed.mjs`).

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-21 19:27 · agent 1 · ~42 calls · read run-export, engines, Remotion internals;
  step 1 (pure helpers, 19 tests), commit `dd77b87`.
- 2026-10-21 19:40 · agent 2 · ~35 calls · step 2: `export-disk-check.ts`, runStudioExport
  wiring, scope `open` guard, 3 new tests; process audit (all Remotion calls in main); commit
  `88de827`.
- 2026-10-21 19:50 · agent 3 · ~42 calls · step 3 kit (`A2/launch.sh`, `seed.mjs`, `drive.mjs`);
  live run (a) Standard range cancel: scope proven on disk, one bundle-step Chrome profile leak
  found in `%TEMP%`; app stopped; no src change, docs commit only.
- 2026-10-21 20:10 · agent 4 · ~45 calls · bundle-probe leak fixed (`bundle-compositions.ts`,
  `own-remotion-temp.ts`, `remove-dir-retry.ts`, 2 tests), commit `4b1156d`; live (a′) PASS
  (`newTempEntries:[]`); `snap.mjs` %TEMP%/profile accounting; full ffmpeg downloaded into the
  isolated profile; Fast still disabled → (a″) not run; found 3,135 stray Chrome profiles (22 GB)
  in %TEMP%; app stopped.

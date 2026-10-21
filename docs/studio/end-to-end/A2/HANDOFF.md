# A2 — Export disk preflight + cancel/failure cleanup of the job's Remotion assets folder
status: IN PROGRESS (steps 1–2 done; step 3 live run (a) Standard cancel DONE and proves the scope
on disk, but found ONE leftover outside the job scope: the bundle step's Chrome profile; next = fix it, then finish step 3)

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

## Next step (ONE concrete instruction)

Close the one leak run (a) found — the `%TEMP%\puppeteer_dev_chrome_profile-*` born at the END of
bundling (16:46:50.5, before `runStudioExport`'s estimate at 16:46:51.86): read
`src/main/services/remotion-bundler.ts` around :340-370 (`getCompositions(serveUrl, …)` :355) and
its caller to confirm it runs in MAIN after a (re)bundle for a Studio export, OUTSIDE
`withRemotionTempDir`; then run that call inside its own scope — `withRemotionTempDir(<a fresh
dir under getTempDir()>, () => getCompositions(...))` and remove that dir in `finally` (reuse
`removeScratch`'s retry from `run-export.ts:197-229` or a shared helper; do not widen the export
job's scope to the bundle step, the bundle is shared/cached) — with a unit test (mock
`@remotion/renderer`'s `getCompositions` to assert `os.tmpdir()` is the scoped dir inside it and the
dir is gone after, also when it throws). Gate: `npx vitest run src/main/services/` +
`npm run check:types`, commit `fix(studio): A2 — …`. Then RELAUNCH (`A2/launch.sh`, run the
launcher from bash in the background, `node drive.mjs ready && node drive.mjs setup`, set
BelowNormal — see Done) and finish step 3 with the kit: (a′) `node drive.mjs run std-cancel2
remotion 5 35 cancel 15` → `newTempEntries` must be `[]` (delete
`%TEMP%\puppeteer_dev_chrome_profile-jNmJPx` first — it is this run's evidence, 5.57 MB, made by the
A2 instance; NOTE the bundle may be cached on the second launch, so to prove the fix re-bundle — e.g.
touch nothing in src but check `report.during` timing shows "bundling" again, or note that the
bundle was cached); (a″) `node drive.mjs run fast-cancel passthrough 5 35 cancel 10` (the 3 s
crossfade at 20 s makes a browser span); (b) stop, relaunch with
`VIDTSX_EXPORT_DISK_OVERRIDES='{"freeBytes":{"C:":1000000000}}'` exported in the shell that runs
`launch.sh` (and `A2_LOG=dev-app-refuse.log`), `node drive.mjs run refuse remotion 5 35 refuse` →
`queueText` must hold `Not enough disk space for this export. C: needs about … and has 954 MB.`,
`scratchLeft:false`, `A2/out` empty — NOTE the refusal needs C: to need > 954 MB − 512 MB headroom:
at 97 MB temp for this 30 s range it will NOT refuse; use `{"freeBytes":{"C:":300000000}}` (286 MB)
or a smaller number, and the message will read `has 286 MB`; (c) stop, relaunch without the override,
`node drive.mjs run complete remotion 5 15 complete` → record the output bytes in `A2/out` vs the
logged `Export disk estimate` output for that job (then move/leave the output in `A2/out`, it is
already in scratch). Then step 4 (STATUS.md row, TESTING.md `### 18.2 A2`, full vitest with the app
stopped, commit, `status: DONE`).

## Open problems

- **Leak found in run (a):** a fresh bundle's composition listing leaves a ~5.6 MB
  `%TEMP%\puppeteer_dev_chrome_profile-*` per (re)bundle (Remotion's `close()` does not remove the
  profile on Windows; the render-time profiles are fine now because they sit in the job scratch).
  Attribution is by timing (born at bundle end, before the job's estimate log, before the GL probe
  started) — confirm in code before fixing (Next step). The exit says "a cancelled range export
  leaves nothing", so this is in scope.
- The Export dialog shows no estimate before confirm (`[data-export-estimate]` absent for the
  range); §2 asks for "the estimate shown" — today it is shown only in the refusal message and the
  log. Decide in step 4 whether the refusal message satisfies "estimate shown" (the plan's T7 text
  reads it as part of the refusal: "refuses … with the estimate shown") — recommended: yes, no
  dialog change.
- C: free fell 25.21 → 24.58 GB across run (a) although scratch and output were cleaned; not
  attributed (Windows / other apps / Electron caches on C:). Re-measure around the next run.

- The estimate is a heuristic (bits/pixel): record measured output vs estimate in the CDP step
  and raise `H264_BITS_PER_PIXEL_AT_CRF18` only if it under-estimates.
- `getTempDir()` (`%TEMP%/vidtsx-studio`) is shared by every app instance, and
  `sweepExportScratch` removes ALL `export/*` at startup: a second instance launched while
  another renders deletes the live job's scratch — and, after this part, its Remotion copies.
  Same hazard as before (DRIVING.md already says not to launch while Hasan renders); not fixed
  in A2.
- `runStudioExport` deletes `outputPath` on any cancel, even one before finishing began (a
  pre-existing file of the same name). Unchanged; noted only.
- The dev verify (`verifyAgainstEngine`, dev-only) renders a second, reference export into the
  same scratch; the preflight does not count it. Dev instrument only; not fixed.
- Path length: Remotion's folders now sit under `%TEMP%\vidtsx-studio\export\<uuid>\remotion\`
  (~105 chars before Remotion's own names) and the Chromium profile nests deep. If the live run
  shows a path-length failure, shorten `remotion` → `r` in `run-export.ts` (and the test).

## Do-not-redo

- A1 is DONE (`e4803cd`, docs `bd805af` + `8306c8e`). Do not touch `main`.
- Do not re-investigate how Remotion names/creates its assets folder or hunt for a public
  hook: answered above (none public; the ALS scope on `os.tmpdir` is the chosen
  identification, proven against `RenderInternals.makeDownloadMap()`).
- Do not rewrite the step-1 helpers; extend them if the wiring needs more inputs.
- Step 2 (wiring, `88de827`) is done and green: do not re-wire; the process question is
  answered above (all in main).
- Run (a) Standard cancel is DONE and its on-disk proof is recorded above: do not re-prove that
  the assets folder / render browsers / react-motion-render land in the job scratch. Only (a′) after
  the bundle-step fix, Fast cancel, (b) refusal and (c) completion remain. Do not rebuild the kit or
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

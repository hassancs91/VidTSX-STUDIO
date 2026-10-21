# A2 — Export disk preflight + cancel/failure cleanup of the job's Remotion assets folder
status: IN PROGRESS (step 2 of 4 done: wired into runStudioExport; next = live CDP run)

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

## Next step (ONE concrete instruction)

Step 3, the live CDP run on an isolated profile (`.vidtsx-temp/end-to-end/A2/`, port 9242;
copy A1's launcher; check C:/D: free space and that no `electron.exe`/port 5173 is up first; a
fresh `electron-vite dev` is fine only if nothing else is running): `studioRootSet` to a scratch
root, create a small project (a COPY of a local mp4 ≥ 30 s; never video-14's folder),
Settings › Rendering CPU "low", then (a) start a Standard range export to an output path in the
scratch folder, and WHILE it renders list `%TEMP%\vidtsx-studio\export\<jobId>\remotion\`
(expect `remotion-v4.0.435-assets*`, `puppeteer_dev_chrome_profile-*`, `react-motion-render*`)
AND `%TEMP%\remotion-v*-assets*` / `%TEMP%\puppeteer_dev_chrome_profile-*` (expect none new —
record names + birth times before and during); cancel from the queue; after ~10 s list both again
(expect no scratch dir, no new `remotion-v*-assets*`, no output file) and grep the main log for
`Export disk estimate` / `still locked`; repeat (a) once with Fast (passthrough) if the project has
a cut that makes a browser span; (b) relaunch with
`VIDTSX_EXPORT_DISK_OVERRIDES='{"freeBytes":{"C:":1000000000}}'` (the temp drive) and start an
export → the queue row's error must read `Not enough disk space for this export. C: needs about …
and has 954 MB.`, no scratch dir, no output; (c) one small real export to completion and record
measured output bytes vs the logged estimate. Save stills + a JSON report in
`.vidtsx-temp/end-to-end/A2/`. Then step 4: STATUS.md row, TESTING.md `### 18.2 A2`, commit,
`status: DONE`.

## Open problems

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
  answered above (all in main) — only the on-disk proof remains (step 3).

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-21 19:27 · agent 1 · ~42 calls · read run-export, engines, Remotion internals;
  step 1 (pure helpers, 19 tests), commit `dd77b87`.
- 2026-10-21 19:40 · agent 2 · ~35 calls · step 2: `export-disk-check.ts`, runStudioExport
  wiring, scope `open` guard, 3 new tests; process audit (all Remotion calls in main); commit
  `88de827`.

# A2 — Export disk preflight + cancel/failure cleanup of the job's Remotion assets folder
status: IN PROGRESS (step 1 of 4 done: pure helpers)

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

## Verified (exact commands + outputs)

- `npx vitest run src/main/services/studio/export-engines/disk-estimate.test.ts
  src/main/services/studio/export-engines/disk-preflight.test.ts
  src/main/services/studio/export-engines/disk-sources.test.ts
  src/main/services/studio/export-engines/remotion-temp-scope.test.ts` →
  `Test Files 4 passed (4) · Tests 19 passed (19)` (2026-10-21 19:25).
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok` (the script exits 1 by design; both
  lines say ok).
- Full `npx vitest run` NOT run yet (nothing app-wide changed yet).

## Next step (ONE concrete instruction)

Wire it into `run-export.ts` `runStudioExport` (:62): BEFORE `active.set` and before creating
`workDir`, call a new impure `export-disk-check.ts` `checkExportDisk({ engineId, project,
entry, render, outputPath })` (stat the `exportDiskSources` files in parallel, missing → 0;
output size via `exportOutputSize(entry, render)`; volumes = `fs.stat(dir).dev` + `statfs`
`bavail * bsize` for `path.dirname(outputPath)` — walk up to the nearest existing parent — and
for `getTempDir()`'s nearest existing parent; label = `path.parse(dir).root` minus the trailing
slash (`C:`); free bytes replaced by `devFreeBytesFor(label)` when set; log the estimate; throw
`new Error(verdict.message)` on refusal — the output file must NOT be touched on a refusal);
then create `path.join(workDir, 'remotion')` and run the whole existing try-body inside
`withRemotionTempDir(thatDir, …)`; delete `removeEmptyRemotionAssetDirs`/`holdsNoFiles` (the
timing heuristic, superseded — keep `sweepExportScratch`'s 1 h sweep of `%TEMP%` for non-Studio
renders); make `removeScratch` keep retrying in the background (e.g. every 5 s for 2 min, not
awaited) after its 6 s of awaited attempts, so a lock held by a killed compositor still clears.
Add run-export tests: a refusal leaves a pre-existing output file in place and never calls
`produce`; an engine that calls `os.tmpdir()` sees `<workDir>/remotion`; the scratch dir is gone
after a thrown engine. Then full vitest (app stopped, logged to a file), check:types, then the
CDP step (cancel a range export → no `remotion-v*-assets*` in `%TEMP%`, no scratch, no output;
`VIDTSX_EXPORT_DISK_OVERRIDES` refusal with its numbers in the queue row).

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

## Do-not-redo

- A1 is DONE (`e4803cd`, docs `bd805af` + `8306c8e`). Do not touch `main`.
- Do not re-investigate how Remotion names/creates its assets folder or hunt for a public
  hook: answered above (none public; the ALS scope on `os.tmpdir` is the chosen
  identification, proven against `RenderInternals.makeDownloadMap()`).
- Do not rewrite the step-1 helpers; extend them if the wiring needs more inputs.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-21 19:27 · agent 1 · ~42 calls · read run-export, engines, Remotion internals;
  step 1 (pure helpers, 19 tests), commit `dd77b87`.

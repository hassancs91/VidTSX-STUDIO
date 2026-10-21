# A4 — Font preflight for exports; GPU proxies default on + the first-4K-import download card
status: IN PROGRESS (steps 0, 1, 2, 3 + the orchestrator's "rebuild the triggering clip on the GPU" override done in code + unit tests; next: step 4, the live CDP run for both exits)

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety rules, launcher, repo facts,
video-14 rules, every "Learned" line — A2 learned that Fast/GPU tools need an app restart after
the in-app full-ffmpeg install).

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **A4** | Font preflight for exports (scan shot copies, warm, refuse when upstream is down); GPU proxies default on when viable + the first-4K-import download card | an export with the upstream blocked after warm-up completes; a fresh 4K import on this PC builds proxies on NVENC without a Settings visit |

Session gates (plan §3 head): `npx vitest run` green, `npm run check:types` at or below
baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the STATUS.md row,
the TESTING.md §18 block (`### 18.4 A4`).

## Step 0 (orchestrator addition, do this FIRST, bounded)

1. **The `shot-generator.test.ts` flake.** It failed in all 3 of the A3 verifier's full runs
   (3 tests from :197 — `isRunning` false, then "This shot is already building" cascading — plus
   `shotDefaults` ENOTEMPTY rmdir and an unhandled rejection from the same file); it passes when
   run alone (and failed 1 in 5 alone once). It fails on `main` too, and the branch does not
   touch `shot-generator.ts` or its test. The session gate can no longer be read while it fails.
   Spend at most ~15 tool calls root-causing it. If it is test isolation (shared temp dir, timers,
   module state, a missing await/cleanup), fix the TEST and prove it with 3 consecutive green full
   runs. If it is a real race in `shot-generator.ts`, do NOT change the product code in A4: record
   the mechanism under Open problems and return to the A4 work. Commit a test-only fix on its own
   (`test(studio): A4 — …`).
2. **Doc over-claim from A3.** `docs/studio/TESTING.md` §18.3 (~:303) cites
   `shot-import.test.ts` for "the import classifier shares the same rule", but that file has no
   `remotion/no-react` / `remotion/version` case. Add the case (accepted; another `remotion/x`
   rejected) so the doc is true.

## Plan context (§1.x facts, §2 decision, §5 items to read)

**§1.7 Fonts (plan :360-364):** proxy cache `<userData>/font-cache`, miss → upstream fetch,
**502 on upstream failure** (`src/main/services/font-proxy.ts:56-87, 173-179` — `fetch(url)` at
:62, `res.status(502)` at :178), registered on both the preview and the export server; brand
fonts are prefetched on brand save (`src/main/services/brand-fonts.ts:68-75`), **shots'
`@remotion/google-fonts` loads are not warmed** — `projects/video-14/notes/import/warm-fonts.mjs`
fills that by hand (Space Grotesk, Inter, JetBrains Mono, Spectral, with `--check`). The URL pass
is `rewriteFontUrls` in `src/main/services/font-proxy-rewrite.ts:33` (re-exported by
`font-proxy.ts:30`, used by `composition-wrapper.ts:281`) — it only sees quoted literals; read
the comment at :46 about what it misses.

**§1.7 Proxies (:357-359):** NVENC measured 60 s of 4K60 HEVC → 540p in **12 s vs 91 s x264**
(`src/main/services/studio/proxy-encoders.ts:7-12`, measured on a GTX 1650 Ti);
`proxyGpuEncoderEnabled` has **no default → off** (`src/main/services/settings.ts:295-300`); one
failure latches x264 for the session. Settings UI row:
`src/renderer/components/SettingsModal/rows/ProxyGpuEncoderRow.tsx` (the optional-download row
pattern, §1.5). Full ffmpeg: BtbN zip, 80.1 MB, SHA pinned, under `<userData>/ffmpeg-full`,
Windows-only (`src/main/services/studio/ffmpeg-full.ts:32-109`).

**§2 T7 (the A4 slice):** "**Fonts never reach the network mid-render**: an export preflight
scans every shot copy's font URLs (the `rewriteFontUrls` pass already finds them), warms the
cache, and refuses to start with a clear message when upstream is unreachable — the proxy's
502-mid-render path goes away. **GPU proxies default on** when an NVIDIA adapter is present and
the full ffmpeg is installed; the first 4K import offers the download with the measured
numbers."

**Orchestrator notes:**
- "Default on" must not override an explicit user choice: an unset setting becomes "on when
  viable"; a user who turned it off stays off. Keep the one-failure x264 latch.
- Making "upstream blocked" testable: same pattern as A2's `VIDTSX_EXPORT_DISK_OVERRIDES` — a
  dev-only override (ignored in packaged builds) that makes the font proxy's upstream fetch fail,
  so the CDP run can (a) warm, then block, then export to completion, and (b) block with a cold
  cache and see the refusal message.
- The download in this part is named by the row ("the first-4K-import download card"): the full
  ffmpeg, 80.1 MB, into A4's isolated profile only. Check C:/D: free space first. After the
  in-app install, a restart may be needed (DRIVING.md "Learned") — if the card's promise
  ("proxies on NVENC without a Settings visit") needs a restart, the card must say so or the code
  must make it unnecessary; record which.
- Material for "a fresh 4K import": the smallest raw DJI clip,
  `D:\repos\claude-youtube-editor\videos\video-14\raw\DJI_20261015115644_0366_D.MP4` (190 MB,
  read-only, referenced in place — import into a scratch project in A4's own scratch root, never
  into the video-14 copy). Confirm it is 3840×2160 with ffprobe first. Proxies land in the scratch
  project's `cache/` — D: had 5.5 GB free at 21:42.
- Material for the font export: the video-14 copy (`.vidtsx-temp/end-to-end/v14-root`, already
  re-bundled in A3). Keep the range short (≈ 3–5 s across a google-fonts shot, e.g. `V14A1Nobody`
  ≈ 0:06–0:11); a 1080p export preset (A1) is fine for the font exit and much cheaper than Full
  4K. Export output into `.vidtsx-temp/end-to-end/A4/`.
- A3 note: `remotion_delayRenderTimeouts` in the render tab is how the A3 verifier saw
  a hold released — useful if you need to prove fonts loaded from the cache during the blocked
  export (the font proxy's own log lines are the simpler evidence: cache hits, zero upstream
  fetches).

## Done (file:line, commit hashes)

- **Step 0.1 — the `shot-generator.test.ts` flake: root-caused as TEST isolation, fixed in the
  test only** (`22593db`). Mechanism: a NEW shot's `generate` reserves its folder on real disk
  (`reserveProjectFolder`, `shot-generator.ts:359`) BEFORE `this.track(...)` (:362); the test
  cancelled after one `setTimeout(0)`. Under a loaded full suite `id` was still `''` at :197 →
  `isRunning` false → the assertion threw, the `hang` run was never cancelled and stayed in the
  module-singleton `runs` map → the next tests that reserve `stats` threw "This shot is already
  building" (the cascade); the orphan run, reading the mocks' lazy `projectDir`, kept writing into
  LATER tests' temp dirs (the ENOTEMPTY in `shotDefaults`' afterEach) and its rejection was the
  unhandled one. Retake/edit/refine/convert track synchronously and were never at risk.
  No product race: `shot-generator.ts` untouched.
  - `src/main/services/studio/shot-generator.test.ts:64` `buildStarted(count = 1)` =
    `vi.waitFor` until the fake engine holds `count` builds; used at :203, :218, :262 (`(2)`: the
    retake test's 2nd build; :265 now asserts `engine.cancelled` = `['job-2']`), :320, :373.
  - :161-163 the attach-media test writes its `v1.assets` files with `fs.mkdirSync`/
    `writeFileSync` in `onReserved` (was an un-awaited `mkdir().then(writeFile)` chain, a second
    race against the build end and afterEach's `rm`).
- **Step 0.2 — the §18.3 over-claim** (`0afc196`). The "import classifier" is
  `classifyShotImport` in `src/shared/studio/shot-import.ts:45` (uses `isShotModuleSpecifier`,
  `shot-lint.ts:25`). New case `src/shared/studio/shot-import.test.ts:37`: `remotion/no-react` +
  `remotion/version` pass; `remotion/foo` and `remotion/dist/cjs/index.js` still listed as
  packages. `docs/studio/TESTING.md:303` now cites `src/shared/studio/shot-import.test.ts:37`
  (the `src/main/services/studio/shot-import.test.ts` A3 named is the writer's test, no classifier).
- **Step 1 — export font preflight, code + unit tests** (`3417d46`). Not yet driven in the app.
  - Pure, `src/main/services/font-proxy-rewrite.ts`: `collectFontUrls` :49 (same `CODE_URL`,
    de-duped, first-seen order); `collectEntryFontUrls` :66 (decodes the copies' proxied
    `/fonts?u=` refs back to upstream URLs + raw quoted ones; other hosts / broken encodings
    dropped); `collectCssFontFileUrls` :81 (a stylesheet body's gstatic `url()`s, now also used
    by `warmFontCache`); `isFontStylesheetUrl` :90.
  - Pure, `src/main/services/studio/export-engines/font-preflight.ts`: `fontPreflightVerdict`
    (ok, or the refusal: "Export not started: this video's shots use Google Fonts that are not
    downloaded yet (Space Grotesk, Inter), and Google Fonts could not be reached (N font files
    missing). Connect to the internet and export again; once downloaded, the fonts stay cached
    and later exports work offline."), `fontFamilyLabels` (gstatic slug → the css2 spelling).
  - `src/main/services/font-proxy.ts:145` `ensureFontCached(url)` — STRICT warm: the URL and,
    for a stylesheet, every file it lists are on disk afterwards or it throws (unlike
    `warmFontCache`, which skips failed files). Returns `{fetched, cached}`.
  - `src/main/services/font-upstream-dev-overrides.ts`: dev-only (ignored when
    `!process.defaultApp`) `VIDTSX_FONT_UPSTREAM_OVERRIDES='{"block":true}'` or
    `'{"blockWhileExists":"<abs path>"}'` (blocked while that file exists — toggle WITHOUT a
    restart; checked on every fetch). `fetchAndCache` (`font-proxy.ts` ~:60) throws
    "Upstream blocked (dev override)" and logs WARN `Font upstream blocked (dev override)` — count
    those lines (and `Font proxy fetch failed`) in the main log as the zero-upstream evidence.
  - `src/main/services/studio/export-engines/export-font-check.ts` `checkExportFonts(jobId, urls)`:
    6 workers over `ensureFontCached`, never throws, logs INFO `Export font preflight` with
    `urls, filesFetched, filesCached, failed, families, ms` (logger `StudioExportFonts`).
  - `src/main/services/studio/export-entry.ts:76` new optional `StudioExportEntry.fontUrls`
    (persisted in the export-context sidecar), filled at :369-378 from the shot, caption and
    transition COPIES as written. Pack filters (verbatim `.js`) and brand fonts (own loader with
    its own timeout, prefetched on brand save) are not scanned.
  - `src/main/services/studio/export-engines/run-export.ts:81-92`: after the disk check,
    `onProgress('preparing', 0, …, 'Checking fonts…')` when there are URLs, then the preflight;
    a refusal throws the message before the scratch dir exists (the UI shows it as the export's
    failure via `sendComplete(false, …, message)`, same path as A2's disk refusal). An entry from
    before A4 (no `fontUrls`) skips it.
- **Step 2 — GPU proxies default on when viable, code + unit tests** (`4671622`). Not yet driven.
  - Pure, `src/main/services/studio/proxy-encoders.ts`: `PROXY_GPU_AUTO_ENCODERS = ['nvenc']`
    (~:76; QSV/AMF are unmeasured → stay opt-in); `effectiveProxyGpuEnabled(setting, viable)` :82
    (`setting ?? viable` — explicit true/false wins); `isProxyGpuAutoViable(working)` :87 (the
    encoder `chooseProxyEncoder` would pick is NVENC — a working NVENC probe encodes frames on the
    card, so it is also the "NVIDIA adapter present" proof); `decideProxyGpuEncoder(setting,
    working)` :97 (unset → NVENC only; true → any working, the pre-A4 opt-in; false → none).
  - `src/main/services/settings.ts:297` `getProxyGpuEncoderSetting(): boolean | undefined`
    REPLACES `getProxyGpuEncoderEnabled` (gone; it collapsed unset into false). The setter is
    unchanged, so unticking writes an explicit `false`.
  - `src/main/services/studio/ffmpeg-full.ts:222` `resolveProxyGpuEncoder`: latch → `false` short-
    circuits → binary → probe → `decideProxyGpuEncoder`. Called per proxy build
    (`proxy-generator.ts:236`), reads the binary + `encoders.json` fresh each time, so a download
    should take effect on the next import WITHOUT a restart — unproven live (see Open problems,
    A2's stale-Fast observation). One-failure x264 latch untouched.
  - IPC: `src/shared/ipc/types/proxy-encoder.ts:9-15` `enabled` is now the EFFECTIVE state, new
    optional `choice?: boolean | null` (null = never chosen); handler
    `src/main/ipc/studio-proxy-encoder-handlers.ts:44-52`.
  - Row `src/renderer/components/SettingsModal/rows/ProxyGpuEncoderRow.tsx`: copy no longer says
    "Off by default"; `[data-proxy-gpu-detected]` reads "Detected: NVIDIA NVENC — on automatically"
    (unset + viable) or "… — opt-in (only NVIDIA turns on by itself)" (unset, QSV/AMF); the
    checkbox shows `enabled` without writing; a toggle sets `choice` optimistically (:77).
  - Tests: `proxy-encoders.test.ts:123` (3 cases), `studio-proxy-encoder-handlers.test.ts:86,95,104`
    (auto-on without writing the setting; QSV stays off until opted in; explicit off stays off)
    + the default case now asserts `choice: null`.
- **Step 3 — the first-4K-import download card, code + unit tests** (`139a4a9`). Not yet driven.
  - Pure, `src/features/studio/services/gpu-proxy-offer.ts`: `GPU_PROXY_MEASURED` :15 (12 s vs 91 s
    per minute, from `proxy-encoders.ts:7-12`); `GPU_PROXY_RESTART_NOTE` :22 (`null` today — the ONE
    constant step 4 sets if a restart proves needed); `isFourKVideo` :38 (`kind==='video'` and
    `max(w,h) ≥ 3840 || min(w,h) ≥ 2160`); `shouldOfferGpuProxyDownload(imported, status, dismissed)`
    :51 — true only when: not dismissed, status `success`, `downloadable === true` (win32; absent =
    older main → no card), `nvidiaAdapter !== false` (unknown still offers), not `installed`, not
    `downloading`, `choice !== false` (DEVIATION from the old Next step's `choice === null`: an
    explicit `true` with no binary — e.g. the binary was deleted — still gets the offer; only an
    explicit OFF silences it), and some imported asset is 4K. `gpuProxyOfferBody` :64 (copy: "4K
    preview proxies take about 91 s per minute of footage on the CPU, about 12 s on an NVIDIA
    graphics card. The GPU encoder is a one-time 76 MB download (full ffmpeg, GPL v3)." — MiB like
    the Settings row, 80069496 B = 76 MiB = the plan's "80.1 MB"); `gpuProxyOfferOutcome` :74 (after
    the install: ok "GPU encoder ready (NVIDIA NVENC): proxies for footage you import from now on
    build on the graphics card." [+ restart note]; or warns: not installed / no working encoder /
    installed but not auto-on (QSV/AMF → "Turn it on in Settings › Rendering")).
  - **"Not now" = per SESSION** (recorded decision): `readOfferDismissed`/`writeOfferDismissed` :87/:91
    over `stored-choice.ts` against `window.sessionStorage`, key `vidtsx:gpu-proxy-offer` = `dismissed`.
    Survives editor remounts/project switches, gone at app restart. No settings-schema change.
  - Main: `src/main/services/studio/gpu-adapters.ts` — pure `hasNvidiaAdapter(info: unknown)` :26
    (Electron `app.getGPUInfo('basic').gpuDevice[].vendorId === 0x10de`, number or hex string;
    null when unreadable), `detectNvidiaAdapter()` :40 (once per session, logs INFO `GPU adapters
    read {nvidia}` under `StudioGpuAdapters`). `FFMPEG_FULL_CATALOGUE.platform = 'win32'`
    (`ffmpeg-full.ts:43`, also used by `doInstall`'s gate :91).
  - IPC: `src/shared/ipc/types/proxy-encoder.ts:21,26` new optional `downloadable?`,
    `nvidiaAdapter?: boolean | null`; handler `studio-proxy-encoder-handlers.ts:34,57`.
  - Renderer: `src/features/studio/hooks/useGpuProxyOffer.ts:46` (`considerImport(assets)` — cheap
    gates first, then ONE `studioProxyEncoderStatus` call; `download()` = `studioProxyEncoderInstall`
    + `onDownloadProgress` ticks filtered on `metadata.type === 'ffmpeg-full'`, then a status refresh
    → outcome; `dismiss()`, `close()`). Card `src/features/studio/components/GpuProxyOfferCard.tsx`
    (fixed bottom-LEFT, `bg-app-active`, the CrashReportingPrompt look; hooks
    `[data-gpu-proxy-offer=offer|downloading|done]`, `[data-gpu-proxy-offer-body]`,
    `[data-gpu-proxy-offer-download]`, `[data-gpu-proxy-offer-dismiss]`,
    `[data-gpu-proxy-offer-outcome=ok|warn]`, `[data-gpu-proxy-offer-close]`).
    `useStudioProject.ts:152` `importMedia()` now also returns the added `assets`;
    `EditorShell.tsx:122` hook, `:950` `considerImport(result.assets)` after the import toast,
    `:1608` the card. Only the media-pool Import button path triggers it (drag-drop has no
    separate import IPC; agent/shot footage imports are not user 4K imports).
  - What the card does NOT do: the import that triggered it already queued its proxy on x264 (the
    job starts before the download ends) and keeps it; only LATER imports use NVENC. Exit test:
    import the 4K clip → card → Download → import the clip AGAIN (a second asset, new proxy job)
    or into a second fresh scratch project → `nvenc-…` profile. Rebuilding the in-flight x264
    proxy on the GPU after the download would need a media-jobs "restart proxy" path (none exists
    in the renderer API) — left out on purpose.
  - Tests: `src/features/studio/services/gpu-proxy-offer.test.ts` (8: 4K classes, offer/quiet
    matrix, copy numbers, outcome, session storage incl. a throwing storage);
    `src/main/services/studio/gpu-adapters.test.ts` (4); handler test `:81-82` asserts
    `downloadable`/`nvidiaAdapter`, `:86` unknown adapter → `null`.

- **Step 3b — orchestrator override: the triggering clip ends on the GPU without a re-import, code +
  unit tests** (`3d450ba`). Not yet driven.
  - Main session record `src/main/services/studio/proxy-build-encoders.ts:16/:21`
    (`recordProxyBuildEncoder` / `getProxyBuildEncoder`, key `projectId:assetId`, value `'x264'` or the
    GPU id; in memory → earlier sessions' proxies are never touched). Written by `generateProxy` right
    after it resolves the encoder (`proxy-generator.ts:238`; the latch-fallback recursion re-records x264).
  - Engine `src/main/services/studio/media-jobs.ts:132` `jobState()` (`running|queued|none`), `:142`
    `restart()` — a RUNNING job gets `restart=true` + abort; `run()`'s `finally` (:242) queues
    `request(..., {force:true})` only after `produce` rejected, i.e. after ffmpeg's `close` (no file
    locks); NO `'canceled'` event, so the asset stays `generating` in the document. A queued job is
    dropped and re-requested; no job → plain force request. `cancel()`/`cancelProject()` clear the flag
    (a cancel wins).
  - Pure planner `src/main/services/studio/proxy-gpu-rebuild.ts:23` `planProxyGpuRebuild(job, encoder)`:
    restart = running+x264, rebuild = none+x264, everything else skip (queued resolves the GPU itself;
    GPU build; unresolved; no build this session). `rebuildProxiesOnGpu` :33 returns early unless
    `resolveProxyGpuEncoder()` resolves (so a latch / explicit off / no NVENC leaves x264 alone); logs
    INFO `Proxies re-queued on the GPU encoder {projectId, encoder, restarted, rebuilt}` (logger
    `StudioProxyGpuRebuild`) — the live-run evidence line.
  - IPC `studio:proxy-encoder:rebuild` (`channels.ts`, types `proxy-encoder.ts` Request/Response with
    `restarted`/`rebuilt`), handler `studio-proxy-encoder-handlers.ts:81` (validates the id via
    `getProjectDir`, drops malformed assets), registration, preload `studioProxyEncoderRebuild`,
    `src/renderer/types/electron.d.ts:492`.
  - Renderer: pure `gpuProxyRebuildTargets` (`gpu-proxy-offer.ts:91`, the 4K videos → `{assetId,path}`)
    and `withRebuildNote` :98 (ok outcome + "The 4K clip already in this project is rebuilding on it
    now." / "The N 4K clips …"). Hook `useGpuProxyOffer(project)` (signature changed; `EditorShell.tsx:122`
    passes `project`), `rebuildOnGpu` :30 runs only when the outcome is ok (:117).
  - `GPU_PROXY_RESTART_NOTE` still `null` (unproven live — step 4 decides).
  - Tests: `media-jobs.test.ts` (NEW, 4: restart running → no canceled + 2nd build after exit; force over
    a file on disk; cancel after restart wins; `queued` state), `proxy-gpu-rebuild.test.ts` (NEW, 4),
    handler test +2 (`describe('studio proxy encoder rebuild …')`), `gpu-proxy-offer.test.ts:110` (+2).

## Verified (exact commands + outputs)

- Step 3b: `npx vitest run src/main/services/studio/media-jobs.test.ts src/main/services/studio/proxy-gpu-rebuild.test.ts src/features/studio/services/gpu-proxy-offer.test.ts src/main/services/studio/proxy-generator.test.ts`
  → `Test Files  4 passed (4)` / `Tests  34 passed (34)` (red before the code: 6 failed);
  `npx vitest run src/main/ipc/studio-proxy-encoder-handlers.test.ts` → `Tests  13 passed (13)`.
- Step 3b `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok`,
  `tsconfig.node.check.json: 10 errors (baseline 10) ok` (first run was web 27: the new API was missing
  from `src/renderer/types/electron.d.ts` — the ElectronAPI type is hand-declared there, not inferred
  from the preload; fixed).
- Step 3b full run, 0 electron.exe, 9222/5173 free:
  `npx vitest run > .vidtsx-temp/end-to-end/A4/logs/vitest-full-override.log 2>&1` → exit 0,
  `Test Files  428 passed | 4 skipped (432)`, `Tests  3598 passed | 22 skipped (3620)`, 39.04 s.

- Step 3: `npx vitest run src/main/ipc/studio-proxy-encoder-handlers.test.ts src/main/services/studio/gpu-adapters.test.ts`
  → `Test Files  2 passed (2)` / `Tests  15 passed (15)`;
  `npx vitest run src/features/studio/services/gpu-proxy-offer.test.ts` → `Tests  8 passed (8)`.
- Step 3 `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok`,
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Step 3 full run, 0 electron.exe, ports 9222/5173 free:
  `npx vitest run > .vidtsx-temp/end-to-end/A4/logs/vitest-full-step3.log 2>&1` → exit 0,
  `Test Files  426 passed | 4 skipped (430)`, `Tests  3585 passed | 22 skipped (3607)`, 39.83 s.
- Free space 2026-10-21 ~22:12: C: 23.36 GB, D: 5.39 GB.

- Step 2: `npx vitest run src/main/services/studio/proxy-encoders.test.ts src/main/ipc/studio-proxy-encoder-handlers.test.ts src/main/services/studio/proxy-generator.test.ts`
  → `Test Files  3 passed (3)` / `Tests  43 passed (43)`.
- Step 2 full run, no electron.exe running, 9222/5173 free:
  `npx vitest run > .vidtsx-temp/end-to-end/A4/logs/vitest-full-step2.log 2>&1` → exit 0,
  `Test Files  424 passed | 4 skipped (428)`, `Tests  3572 passed | 22 skipped (3594)`, 40.24 s.
- Step 2 `npm run check:types` → web 26 (baseline 26) ok, node 10 (baseline 10) ok.

- Step 1: `npx vitest run src/main/services/font-proxy.test.ts src/main/services/font-proxy-rewrite.test.ts src/main/services/font-upstream-dev-overrides.test.ts src/main/services/studio/export-engines/font-preflight.test.ts src/main/services/studio/export-engines/run-export.test.ts src/main/services/brand-fonts.test.ts`
  → `Test Files  6 passed (6)` / `Tests  38 passed (38)`; run-export alone `5 passed (5)`
  (2 new: refusal before touching anything; preflight runs before the engine). The real-shot
  case (`font-proxy-rewrite.test.ts`, skip-if-absent, reads the video-14 copy's
  `v14-a1-nobody/v1.tsx`) RAN: every Google Fonts URL in the bundle (103 unique) is a quoted
  literal `collectFontUrls` sees; its 4 stylesheets are Space Grotesk, Inter, JetBrains Mono,
  Spectral; after `rewriteFontUrls` no raw quoted URL is left.
- Step 1 full run, no Electron running: `npx vitest run > .vidtsx-temp/end-to-end/A4/logs/vitest-full-step1.log 2>&1`
  → exit 0, `Test Files  424 passed | 4 skipped (428)`, `Tests  3566 passed | 22 skipped (3588)`, 35.39 s.
- Step 1 `npm run check:types` → web 26 (baseline 26) ok, node 10 (baseline 10) ok.

- `npx vitest run src/main/services/studio/shot-generator.test.ts` ×5 (Bash loop) →
  `Tests  18 passed (18)` five times.
- `npx vitest run src/shared/studio/shot-import.test.ts` → `Tests  12 passed (12)`.
- 3 consecutive full runs, no Electron running, ports 9222/5173 free:
  `for i in 1 2 3; do npx vitest run > .vidtsx-temp/end-to-end/A4/logs/vitest-full-$i.log 2>&1; …`
  → run 1 `Test Files  421 passed | 4 skipped (425)` / `Tests  3543 passed | 22 skipped (3565)`
  39.83 s; run 2 `421 passed | 4 skipped` / `3544 passed | 22 skipped (3566)` 40.65 s (the new
  classifier case joined from run 2); run 3 same as run 2, 40.71 s. All exit 0. Logs:
  `.vidtsx-temp/end-to-end/A4/logs/vitest-full-{1,2,3}.log`. The `shot-module-resolver.test.ts:151`
  timeout flake did not appear either.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok`,
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Free space 2026-10-21 ~22:05: C: 23.46 GB, D: 5.41 GB.

## Next step (ONE concrete instruction)

**The override below is DONE in code (`3d450ba`, see Done "Step 3b") — do not rebuild it; step 4
proves it live.** In the GPU half, after Download, do NOT re-import first: wait for the card's
`[data-gpu-proxy-offer-outcome=ok]` (expect "… The 4K clip already in this project is rebuilding on it
now."), grep the main log for `Proxies re-queued on the GPU encoder` (expect `restarted:[<id>]` or
`rebuilt:[<id>]`), and while the rebuilt proxy is in flight read
`<root>/projects/<id>/cache/proxies/<assetId>/` plan file `profile` (`nvenc-540p-intra-q33` = GPU; the
segment folder is deleted when the proxy finishes, so poll it during the build — or rely on the
`Probed GPU proxy encoders` line plus the rebuild log line and the NVENC ffmpeg in Task Manager).
Only if that fails, try the re-import fallback and root-cause.

**Orchestrator override (2026-10-21), before step 4:** the exit says "a fresh 4K import on this
PC builds proxies on NVENC without a Settings visit". With the card as built, the 4K clip that
triggered the card keeps its x264 proxy and only a re-import gets NVENC — that misses the exit
for the very clip the user is waiting on (x264 ≈ 91 s per minute of 4K). Add, test-first: after
a SUCCESSFUL download from the card, re-queue the proxy of every 4K asset of the open project
whose proxy is still running or finished on x264 in this session (abort the running x264 job,
then `force` a new proxy job; the media-jobs engine already supports `force`), so the triggering
clip ends with an `nvenc-…` proxy without a re-import. If a restart is truly required for the
GPU tools to be seen, the card must say so (`GPU_PROXY_RESTART_NOTE`) and the exit is then
measured after that one restart — record which. Then run step 4 as below, and in the GPU half
check the TRIGGERING clip's proxy profile, not a re-imported one.

Step 4, GPU half FIRST (it needs no video-14 render): write a CDP driver (Write tool) under
`.vidtsx-temp/end-to-end/A4/` from A1's `launch.sh` (fresh profile `.vidtsx-temp/end-to-end/A4/profile`,
its own CDP port, e.g. 9244 — A1 used 9241 — and its own log), set the Studio root to `.vidtsx-temp/end-to-end/A4/root`, create
a fresh scratch project, ffprobe the DJI clip (expect 3840×2160), then import it through the media
pool's Import button with a dialog stand-in (see `docs/ui-automation-cdp.md` / memory
`VIDTSX_DIALOG_PICK`-style pickers — check which env var `studioMediaImport`'s dialog honours) →
assert `[data-gpu-proxy-offer=offer]` visible with the 91 s / 12 s copy → click
`[data-gpu-proxy-offer-download]` (80069496 B into the isolated profile only; free space first) →
wait for `[data-gpu-proxy-offer=done]` and read `[data-gpu-proxy-offer-outcome]` → WITHOUT a restart
import the clip again → read the main log's `Probed GPU proxy encoders` line and the new proxy's
manifest `profile` in the project's `cache/` (`nvenc-540p-intra-q33` = GPU) → if it fell back to
x264, cat `<profile>/ffmpeg-full/encoders.json`, root-cause (see Open problems) and either fix it or
set `GPU_PROXY_RESTART_NOTE`; then open Settings › Rendering and confirm "Detected: NVIDIA NVENC — on
automatically", ticked, and NO `proxyGpuEncoderEnabled` key in the profile's settings store. Then
the font half (recipe in Open problems), then the gates + STATUS row + TESTING §18.4.

## Open problems

- Not a blocker, by design (record in the §18 block): the preflight is STRICT — it warms every
  URL the copies carry, i.e. all weights × subsets `@remotion/google-fonts` inlines (≈100 URLs
  for video-14's 4 families) plus each family's `css2` URL (`info.url`, metadata the package
  itself never fetches at render; warming it fetches its woff2s too). A cache the preview filled
  (only what the browser used) still needs the network ONCE for the first export of a project;
  after that, exports are offline. Brand fonts (own loader, own timeout, prefetched on brand
  save) and pack filters are not scanned.
- For the step-4 CDP font exit, launch with
  `VIDTSX_FONT_UPSTREAM_OVERRIDES='{"blockWhileExists":"<A4 dir>\\block-fonts"}'` so one session
  does both halves: block file present + cold font cache (fresh profile) → export → the refusal
  text; remove the file → export (warms, renders) → create the file → export again → completes
  with zero `Font upstream blocked` / `Font proxy fetch failed` lines during it and an
  `Export font preflight … filesFetched: 0` line. Keep ranges 3–5 s at 1080p (see Orchestrator
  notes).
- **Step-4 must-record (orchestrator, 2026-10-21): the preflight is strict per URL.** A single
  upstream 404 for one of the ~103 inlined weight/subset URLs refuses the export exactly like a
  network outage. In the live run's warm export, record from the `Export font preflight` line how
  many URLs warmed (`urls`, `filesFetched`, `filesCached`) and whether `failed` is non-empty,
  and grep the main log for the per-URL failures (status codes). If a 404-for-one-file case is
  real, before closing the part split the verdict: "upstream unreachable" (network error / 5xx /
  every URL failing → refuse, today's message) vs "this one file is gone upstream" (a definite
  404/410 while other URLs succeed → WARN, continue the export, name the family/file in the log
  and the export's warnings). `ensureFontCached` throws per URL today; carry the HTTP status in
  the error so `checkExportFonts` / `fontPreflightVerdict` can tell them apart (pure verdict
  first, with tests). If no URL 404s, record "0 failed of N" and leave the strict rule.
- **Step-4 must-record: does a GPU proxy need a restart after the in-app download?** Step 2's
  `resolveProxyGpuEncoder` reads the binary and `encoders.json` fresh per proxy build, so in
  theory no. But A2 saw Fast stay "Needs the GPU encoder download" ~30 s after an in-app install
  until a restart (DRIVING.md "Learned"). One suspect, unverified: a status call that probes while
  the zip is still extracting (`getFfmpegFullBinary` only checks `ffmpeg.exe`, the DLLs may not be
  out yet) caches `{listed:[],working:[]}` into `encoders.json`, which then sticks until the file is
  deleted. In the live run: install from the card, then WITHOUT a restart import the 4K clip and
  read the main log's `Probed GPU proxy encoders` line + the proxy's manifest `profile`
  (`nvenc-540p-intra-q33` = GPU, x264 tag = CPU) in the scratch project's `cache/`. If it fell
  back to x264, cat `<profile>/ffmpeg-full/encoders.json`; fix the root cause in code (preferred)
  or make the card say "restart to apply"; record which.
- Step-4 recipe for the GPU exit: fresh isolated profile (setting unset), check C:/D: free space,
  confirm `D:\repos\claude-youtube-editor\videos\video-14\raw\DJI_20261015115644_0366_D.MP4` is
  3840×2160 with ffprobe, scratch project in A4's own scratch root (never the video-14 copy),
  import → the card → Download (80.1 MB into A4's profile only) → (restart only if proven needed)
  → import/rebuild → proxy profile `nvenc-…` without opening Settings; Settings row then reads
  "Detected: NVIDIA NVENC — on automatically" with the checkbox ticked and no
  `proxyGpuEncoderEnabled` key written (check the profile's settings store).

- Not a blocker: one failing `hang` test in `shot-generator.test.ts` can still leave an orphan
  run that cascades into the next tests (there is no afterEach net — `runs` is private and a
  cancel nobody awaits would itself be an unhandled rejection). With the wait fixed this only
  happens if a real regression makes a hang test fail; the first failure in the log is the real one.

## Do-not-redo

- A1, A2, A3 DONE. The video-14 copy's 55 bundles are already fixed — do not re-bundle.
  Do not touch `main`.
- Step 0 DONE (`22593db`, `0afc196`): do not re-investigate the shot-generator flake or re-add the
  classifier case. DRIVING.md's "Known full-suite flake" line for `shot-generator.test.ts` is
  stale (see the A4 "Learned" line there).
- Step 1 DONE (`3417d46`): do not re-add `collectFontUrls` / the preflight / the dev override;
  the font half only needs its live CDP proof (step 4).
- Step 2 DONE (`4671622`): do not re-add the default-on resolver, the tri-state setting getter,
  the `choice` status field or the row copy; `getProxyGpuEncoderEnabled` is deliberately gone.
- Step 3 DONE (`139a4a9`): do not re-add the offer predicate, the card, the hook, the
  `downloadable`/`nvidiaAdapter` status fields or `gpu-adapters.ts`; the card only needs its live
  proof (step 4) and, if proven necessary, a non-null `GPU_PROXY_RESTART_NOTE`.
- Step 3b DONE (`3d450ba`): do not re-add `jobState`/`restart`, the session encoder record, the
  planner, the `studio:proxy-encoder:rebuild` channel or the card's rebuild note.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-21 · agent 1 · ~40 calls · step 0.1 (flake root cause + test fix, 3 green full runs) and
  step 0.2 (classifier case + TESTING §18.3 citation); peeked at `font-proxy-rewrite.ts:1-70` for
  step 1.
- 2026-10-21 · agent 2 · ~40 calls · step 1 (font preflight: pure collectors + verdict, strict
  `ensureFontCached`, dev upstream block, entry `fontUrls`, run-export wiring, tests, green full
  run); did not read the proxy/GPU code for step 2.
- 2026-10-21 · agent 4 · ~35 calls · step 3 (first-4K-import card: pure predicate/copy/outcome +
  session dismissal, NVIDIA adapter read from Electron GPU info, `downloadable` status field,
  hook + card + EditorShell wiring, tests, green full run); did not launch the app or read the
  media-import dialog code (which env var stands in for its file picker is step 4's first lookup).
- 2026-10-21 · agent 5 · ~40 calls · step 3b (orchestrator override: rebuild this session's x264 4K
  proxies on the GPU after the card's download — engine restart, session encoder record, planner, IPC,
  hook, tests, green full run); did not launch the app or look up the media-import dialog stand-in.
- 2026-10-21 · agent 3 · ~30 calls · step 2 (GPU proxies default on when viable: pure resolver,
  tri-state setting, effective status + `choice`, row copy, tests, green full run); did not read
  `media-jobs.ts` or the import UI for step 3.

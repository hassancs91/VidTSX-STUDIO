# Local Image Models — Implementation Plan & Progress

> Executable step-by-step plan for the redesign agreed in
> **[local-image-models-redesign.md](local-image-models-redesign.md)** (read it first —
> it holds the full rationale; this file holds the tasks).
> Work through phases in order, tick checkboxes as you go, and append to the
> Progress Log at the bottom after every working session.

## Decisions summary (all locked 2026-07-15)

| Decision | Result |
|---|---|
| D1 | Hybrid: profiles keep optional `downloadUrl` (public/stable/unauthenticated only) → one-click download stays; 13 ex-self-hosted entries ship link-only via `sourceUrl` |
| D2 | Folder-as-truth: scanned folder = library; import = move (default) / copy; sidecar `<file>.vidtsx.json` for custom config; no central manifest, no register-in-place |
| D3 | Filename matching against `matchFileNames`; no hashing; header sniffing = phase 2 (not in this plan) |
| D4 | Dedicated top-level "AI Models" sidebar screen (promote `src/features/ai-models/`); usage tracking = disk + activity (local only); delete hidden GeneralTab block |
| D5 | Split family `flux` → `flux1` / `flux2`; all-in-one-checkpoint toggle in Set up dialog |
| Scale | Everything built on the category-agnostic model-library core (design doc §3.4); v1 wires **image only**; audio/LLM/embeddings adapt in a later batch |

## Context for a fresh session

Read in this order: `CLAUDE.md` → `docs/local-image-models-redesign.md` → this file → the Progress Log below.

Key existing files (verified 2026-07-15):

| File | Role |
|---|---|
| `src/local-image-engine/model-registry.ts` | 29-entry catalog; `SD_MODELS_BASE_URL` (owner infra — must die); 13 relative `downloadPath` zips; 16 direct-HF single files (all `archiveFormat: 'none'`) |
| `src/local-image-engine/types.ts` | `SdModelDefinition` + generation/queue types |
| `src/local-image-engine/image-engine.ts` | Queue/orchestration; resolves `modelsBasePath/extractedName/modelFileName` |
| `src/local-image-engine/sd-cli-runner.ts` | `buildArgs()` from modelDef; companion paths = `<modelDir>/<fileName>` |
| `src/main/services/sdimage-models.ts` | Path helpers (hardcodes `userData/ai-models/image` — ignores `aiModelsFolder` setting), `downloadSdModel()`, delete |
| `src/main/services/sdimage-init.ts` | Startup init; restores `sdImageActiveModel` |
| `src/main/ipc/sdimage-handlers.ts` + `src/main/ipc/registrations/sd-image.ts` | 12 handlers / channel registrations |
| `src/shared/ipc/channels.ts` (`SDIMAGE_*` at ~line 215) + `src/shared/ipc/types/sd-image.ts` | Channel names + request/response types |
| `src/preload/api/sd-image.ts` | `window.api.sdImage*` surface |
| `src/renderer/hooks/useSdImageModels.ts` | Download-centric renderer hook |
| `src/features/ai-models/` | **Orphaned** feature (nothing renders `AiModelsTab`). `MainContent.tsx` = working system dashboard incl. PyTorch installer. `ImageModelsContent.tsx` = old download UI to replace |
| `src/features/tools/components/ImageAITesterScreen.tsx` + `hooks/useImageAITester.ts` | Only live consumer (generation tester; lists downloaded models) |
| `src/main/services/settings.ts` | `aiModelsFolder`, `sdImageActiveModel` accessors; settings-db backed |
| `src/main/services/download-manager/` | Shared engine (stays; also serves audio/LLM/embeddings/whisper/torch) |
| `src/audio-engine/model-registry.ts` + `src/main/ipc/audio-handlers.ts:163` | Dead `MODELS_BASE_URL` + its live fallback branch (phase 4 deletes) |
| `src/shared/feature-flags.ts`, `src/renderer/App.tsx` (screens map), `src/renderer/components/Sidebar.tsx` | Screen wiring for phase 3 |

Gotchas (from earlier batches — see auto-memory):

- `npm install` needs `--legacy-peer-deps` (react-simple-maps@3 pins React ≤18).
- **No `test`/`type-check`/`lint` npm scripts exist.** Type checks:
  `npx tsc -p tsconfig.web.check.json --noEmit` and `npx tsc -p tsconfig.node.check.json --noEmit`.
  ~90 PRE-EXISTING errors (web ~48 / node ~44 as of batch 2) — capture exact baseline in Phase 0 and never increase it.
- If the installed production app is running, `npm run dev` exits silently (single-instance lock). Close the installed app first.
- Dev mode force-enables ALL feature flags (`isFeatureEnabled` returns true when `import.meta.env.DEV`).
- sd-cli is NOT bundled — generation E2E tests are optional/conditional on a local `resources/binaries/sd-cli.exe`.
- Conventions (CLAUDE.md): kebab-case files, named exports, no `any`, one primary export & ~300 lines per file, IPC handlers wrap in try/catch returning typed errors, `path.join()` everywhere, exact-pinned deps.

Suggested cadence: **one commit per phase** after its Definition of Done passes.

---

## Phase 0 — Tooling & baseline (small)

- [x] `npm install --save-dev --save-exact vitest --legacy-peer-deps` (verify the app still launches after install, per CLAUDE.md).
- [x] Add scripts to `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.
- [x] Create `vitest.config.ts`: node environment, include `src/**/*.test.ts`. Confirm `electron-vite build` still succeeds (test files aren't entry points, so they're excluded from bundles automatically, but verify).
- [x] Record the exact current type-error counts (web + node) in the Progress Log as the baseline.
- [x] Smoke test: create a trivial `src/main/services/model-library/__placeholder.test.ts` (`expect(1).toBe(1)`), run `npm test`, then delete it.

**Definition of done**: `npm test` runs green; both tsc commands produce the recorded baseline; app launches (`npm run dev`).

---

## Phase 1 — Model-library core (category-agnostic)

**Architecture rule for every module in this phase: no `import 'electron'` and no settings-db import in core logic.** All paths and persistence are injected as arguments/interfaces — this is what makes the core unit-testable and reusable across categories. Thin wiring that reads `app.getPath`/settings lives outside the core (phase 2).

### 1.1 Shared types — `src/shared/model-library/types.ts`

- [x] `ModelCategory` union: `'image' | 'stt' | 'tts' | 'llm' | 'embedding' | 'video'` (video reserved, unused).
- [x] `ModelProfileEnvelope<TMeta>` per design doc §3.4 (id, category, name, sizeBytes/sizeLabel, sourceUrl, `downloadUrl?`, `matchFileNames?`, `requirements?: { minRamGB?; minVramGB? }`, `meta: TMeta`). Added `directoryUnit?: { dirName; files }` for the directory install-kind (needed by 1.2 `matchDirectoryUnits`) and a `ScannedFile` shape shared by scanner + classifier.
- [x] `InstalledModel<TMeta>`: id, category, name, filePath, origin `'profile' | 'custom'`, sizeBytes, meta, `issues: ModelIssue[]`.
- [x] `SidecarFileV1`: `{ version: 1; category: ModelCategory; name?: string; [categoryField]: unknown }` (index signature = category payload spread at top level, validated by the adapter, not the core).
- [x] `RuntimeId` union + `RuntimeStatus` (+ `RuntimeKind`, `RuntimeDescriptor`).
- [x] Typed error/issue codes: `ModelIssue` discriminated union (`missing-companion`/`missing-runtime`/`unrecognized`/`missing-file`/`unreadable-sidecar`) with per-code payloads; plus `ModelLibraryError` class + `ModelLibraryErrorCode` for thrown ops (file-exists, import-failed, …).
- [x] `ModelUsageRecord`: `{ lastUsedAt: string; useCount: number }`, keyed `` `${category}:${modelId}` `` (+ `ModelUsageMap`).
- [x] `ModelCategoryDescriptor<TMeta, TResolved>` interface (category, dirName, installKind, fileExtensions, profiles, familyPresets?, allowCustomImport, requiredRuntime, `resolve()`). Classifier hooks live in `classifier.ts`'s `ClassifyContext`, not the descriptor (kept the descriptor minimal / image-ism-free).

Split into multiple files under `src/shared/model-library/` if any file nears 300 lines; barrel `index.ts`.

### 1.2 Scanner — `src/main/services/model-library/scanner.ts`

- [x] `scanModelFiles(rootDir, { extensions, maxDepth = 3 }): Promise<ScannedFile[]>` — recursive, `fs/promises`, returns `{ absolutePath, fileName, sizeBytes, relDepth }`. Skips dot-dirs; tolerates missing root (returns `[]`); never throws on individual unreadable entries. Extensions matched case-insensitively.
- [x] Directory install-kind support: `matchDirectoryUnits(rootDir, profiles)` → `{ profileId, dirPath, sizeBytes }[]`; matches when `<rootDir>/<directoryUnit.dirName>` exists and all required `files[]` exist (generalizes audio's `isModelDownloaded`; unused by image but part of the core contract).

### 1.3 Classifier — `src/main/services/model-library/classifier.ts`

- [x] `classifyFile(file, ctx): Promise<Classification>` where `ctx = { profiles, companionFileNames, readSidecar }`. Pipeline (design §4): profile filename match (case-insensitive, exact) → sidecar → companion inventory → unrecognized.
- [x] Result union: `{ kind: 'profile', profileId } | { kind: 'custom', sidecar } | { kind: 'companion', companionKind } | { kind: 'unrecognized' }`.
- [x] Pure function — no fs access except the injected `readSidecar` (may be sync or async; awaited). Deviation: `companionFileNames` is a `Record<lowercasedFileName, kind>` (not a bare list) so the result can carry `companionKind`.

### 1.4 Sidecars — `src/main/services/model-library/sidecars.ts`

- [x] `sidecarPathFor(modelFilePath)` → `<modelFilePath>.vidtsx.json`.
- [x] `readSidecar(modelFilePath)` → `{ sidecar: SidecarFileV1 | null; issue? }`. Missing file → `{ sidecar: null }` (no issue); invalid JSON / wrong version → `{ sidecar: null, issue: 'unreadable-sidecar' }`; never throws. (Returns a result object rather than bare `| null` so the caller gets the issue — the classifier's `readSidecar` adapter takes `.sidecar`.)
- [x] `writeSidecar(modelFilePath, sidecar)` / `deleteSidecar(modelFilePath)` (delete tolerates missing).

### 1.5 Importer — `src/main/services/model-library/importer.ts`

- [x] `importModelFile(sourcePath, destDir, mode: 'move' | 'copy')` → destPath. Move = `fs.rename`, fall back to copy+unlink on `EXDEV` (cross-volume). Collision → `ModelLibraryError('file-exists')` (no silent overwrite); missing source → `ModelLibraryError('missing-file')`. Ensures destDir exists.

### 1.6 Usage store — `src/main/services/model-library/usage-store.ts`

- [x] `createUsageStore(persistence: { get(): ModelUsageMap | undefined; set(v): void }, { now? })` → `{ recordUse(category, modelId), getAll(), getFor(category) }`. Persistence injected (phase 2 wires it to settings-db under key `modelUsage`). Deviation: optional injectable `now()` clock for deterministic tests (defaults to wall clock).

### 1.7 Registries — `src/main/services/model-library/category-registry.ts`, `runtime-registry.ts`

- [x] `registerCategory(descriptor)` / `getCategory(category)` / `listCategories()` (+ `__resetCategoryRegistry` test helper). Generic `TMeta`/`TResolved` erased on storage via `as unknown as` (no `any`); callers re-narrow on read.
- [x] `registerRuntime(descriptor)` / `getRuntimeStatus(id)` (+ `getRuntime`, `listRuntimes`, `__resetRuntimeRegistry`). Descriptor: `{ id, kind, isAvailable(), install? }`; unregistered runtime → `{ available: false, installable: false }`.
- [x] Barrel `src/main/services/model-library/index.ts`.

### 1.8 Phase 1 tests (vitest, real temp dirs via `fs.mkdtemp(os.tmpdir())`)

- [x] `scanner.test.ts`: nested layout (old `image/<dir>/<file>` shape!), depth limit, extension filter (+ case-insensitive), missing root, empty dirs, sizes; `matchDirectoryUnits` match/miss/ignore-non-dir.
- [x] `classifier.test.ts`: canonical-name → profile; renamed + sidecar → custom; `ae.safetensors` → companion; random name → unrecognized; case-insensitivity; profile match takes precedence over sidecar; async sidecar reader.
- [x] `sidecars.test.ts`: round-trip (incl. top-level category fields); corrupt JSON → null + issue; wrong version → null + issue; missing → null no issue; delete idempotent.
- [x] `importer.test.ts`: move within volume; copy; collision error; missing destDir auto-created; missing source. (EXDEV fallback: code-reviewed only — can't force cross-volume in CI.)
- [x] `usage-store.test.ts`: record/increment/persist via a fake persistence object; per-category keying; `getFor` prefix strip; `getAll`.

**Definition of done**: `npm test` green (37 tests); type-error counts ≤ baseline (node 36 / web 44); no `electron` import anywhere under `src/main/services/model-library/` or `src/shared/model-library/` (grep → empty). ✅ ALL MET.

---

## Phase 2 — Image adapter + registry rework

### 2.1 Image types — `src/local-image-engine/types.ts`

- [x] `SdModelFamily` → `'sd15' | 'sdxl' | 'sd3' | 'flux1' | 'flux2'` (D5).
- [x] `SdModelMeta` (the envelope `meta` payload): family, defaults, capabilities, `useDiffusionModelFlag?`, `companions?: CompanionRequirement[]`, `allInOne?: boolean`.
- [x] `CompanionRequirement`: `{ kind: 'vae' | 'llm' | 'clip_l' | 't5xxl'; fileNames: string[]; sourceUrl: string; sizeLabel: string }`.
- [x] `ResolvedSdModel`: `modelId` + absolute `modelFilePath`, family, defaults, capabilities, `useDiffusionModelFlag`, `allInOne`, resolved absolute companion paths `{ vae?; llm?; clipL?; t5xxl? }`.
- [x] DELETED from types: `downloadPath`, `archiveFormat`, `extractedName`, `modelFileName`, `SdModelDefinition`, `hidden`. (`matchFileNames` on the envelope replaces `modelFileName`.)

### 2.2 Registry rewrite — `src/local-image-engine/model-registry.ts`

- [x] Convert all **34** entries (not 29 — catalog grew to 34: 21 direct-HF + 13 zip) to `ModelProfileEnvelope<SdModelMeta>`; ids unchanged; old `modelFileName` becomes `matchFileNames[0]`.
- [x] DELETED `SD_MODELS_BASE_URL`; removed its export from `src/local-image-engine/index.ts`.
- [x] 21 direct-HF entries: URL kept as `downloadUrl`; `sourceUrl` = the HF repo page (derived from the resolve URL).
- [x] 13 ex-self-hosted entries: `downloadUrl` omitted; `sourceUrl` added (HF/Civitai page per model — best-effort, flagged unverified in Progress Log).
- [x] Family assignment: flux split into `flux1` (schnell/dev/mini/fill) vs `flux2` (klein).
- [x] **Fixed broken FLUX.1 metadata**: all flux1 GGUFs (schnell/dev q2k/q3k/q4/q8, fill-dev-q4) + full-precision `flux-schnell` now carry `useDiffusionModelFlag: true` + the full flux1 companion set (clip_l, t5xxl, ae.safetensors) with source links. (`flux-schnell` full-precision marked diffusion-model+companions with an inline note to verify all-in-one against a real sd-cli.)
- [x] `FAMILY_PRESETS` for the 5 families (in `family-presets.ts`; defaults, capabilities, companions, flags per design §3.2). flux1 preset = diffusion-model + companions; the `allInOne` toggle clears them.
- [x] Companion `sourceUrl`s: clip_l + t5xxl (comfyanonymous/flux_text_encoders), ae.safetensors (black-forest-labs/FLUX.1-schnell), flux2 VAE + qwen encoders (black-forest-labs org page — **unverified, flagged in Progress Log**). Per-entry companions for flux2 klein 4B (qwen3-4b) vs 9B (qwen3-8b).

### 2.3 Image library service — `src/main/services/sdimage-library.ts` (new)

- [x] Builds the image `ModelCategoryDescriptor` (dirName `'image'`, single-file, `.safetensors/.gguf/.ckpt`, profiles, `FAMILY_PRESETS`, `allowCustomImport: true`, runtime `'sd-cli'`) and `registerImageCategory()` registers it + the sd-cli `RuntimeDescriptor` (wraps `isSdCliInstalled`).
- [x] `getImageModelsDir()` reads the new `imageModelsFolder` setting, default `{aiModelsFolder}/image` — fixes the setting-ignored bug; old default resolves to the same location.
- [x] `scanImageLibrary()`: scanner + classifier + companion inventory → `{ root, installed, unrecognized, companionsFound }`; caches `lastScan`; every mutation rescans.
- [x] `resolveInstalledModel()` / `resolveModelSync(modelId)` — companion lookup model dir → root (design §5, in `sdimage-companions.ts`). Missing file → typed `missing-file`; missing companion → typed `missing-companion` (message names the file + source link).
- [x] `importImageModel(sourcePath, mode, setup?)` — importer + (if unmatched) sidecar write.
- [x] `configureImageModel(filePath, setup)` — writes/updates sidecar (the "Set up" action).
- [x] `removeImageModel(modelId, { deleteFile })` — sidecar always removed; file deleted only when asked (handler passes the explicit flag).
- [x] `sdimage-models.ts` trimmed to `getSdCliBinaryPath` / `isSdCliInstalled`. DELETED `downloadSdModel`/archive branch, `getSdImageModelsDir`, `getSdModelDir`/`getSdModelFilePath`/`isSdModelDownloaded`/`getDownloadedSdModelIds`, `deleteSdModel`.
- [x] D1 download in `sdimage-download.ts`: `downloadProfileModel(profileId)` — only profiles with `downloadUrl`; single-file `.part` → rename into the models-folder root (flat → companion sharing); reuses `sdimage-model-<id>` download-manager id + metadata. **All archive/zip handling deleted.** Split into `sdimage-companions.ts` (companion map + resolution) + `sdimage-download.ts` to keep files under the 300-line rule.

### 2.3a Usage store wiring

- [x] `src/main/services/model-usage.ts`: singleton core usage store wired to settings-db (`modelUsage` key via `getModelUsageMap`/`setModelUsageMap`). Engine's `onModelUsed` → `usageStore.recordUse('image', id)`; MODELS_USAGE_GET reads it back.

### 2.4 Engine rewiring

- [x] `image-engine.ts`: `initialize(resolver, sdCliBinaryPath)`, resolver = `{ list(); resolve(id) }`; `getAvailableModels()` → resolver.list(); `runGeneration` uses `resolve()`; `SD_MODEL_CATALOG` import removed; `onModelUsed` callback fired on success; added `clearActiveModelIfMissing()`.
- [x] `sd-cli-runner.ts`: `buildArgs(resolved, request, outputPath)` (exported, pure); dropped `modelsBasePath`/`modelDef`; companion flags from resolved absolute paths; all-in-one → `-m` + no companions.
- [x] `sdimage-init.ts`: `registerImageCategory()`, ensure dir, initial `scanImageLibrary()`, wire resolver + usage callback, restore `sdImageActiveModel` only if present in scan.
- [x] `settings.ts`: `getImageModelsFolder`/`setImageModelsFolder` + `AppSettings.imageModelsFolder` + `getModelUsageMap`/`setModelUsageMap`.

### 2.5 IPC & preload

- [x] `channels.ts`: added `MODELS_SCAN/IMPORT/CONFIGURE/REMOVE/USAGE_GET/OPEN_FOLDER/SET_FOLDER` — all requests carry `category: ModelCategory` (image implemented; others return typed `'unsupported-category'`).
- [x] `src/shared/ipc/types/model-library.ts` (new): request/response types incl. `InstalledModelIpc` (id, name, family, sizeBytes, filePath, origin, ready, `issues: ModelIssue[]`, capabilities, lastUsedAt, useCount) + `ProfileModelIpc` (id, name, family, sizeLabel, sourceUrl, hasDownload, installed). **Deviation:** the legacy `SdImageModelIpc` shape is KEPT (not reworked) so the Image AI Tester + orphaned hook keep compiling/working in Phase 2; Phase 3 migrates the UI to `MODELS_SCAN`, Phase 4 deletes the legacy shape. This keeps the web type baseline unchanged and the tester functional.
- [x] New handlers `src/main/ipc/model-library-handlers.ts` + `registrations/model-library.ts`; registered in `register.ts` + barrel. Try/catch + typed errors.
- [x] `sdimage-handlers.ts`: `handleSdImageModelsList` → scan-backed (catalog + `downloaded` from scan, legacy shape); `handleSdImageModelDownload` → `downloadProfileModel`; `handleSdImageModelDelete` → `removeImageModel(..., { deleteFile: true })`; generation/queue/cancel/status/settings unchanged.
- [x] Preload: `src/preload/api/model-library.ts` + `preload/api/index.ts` + `preload.ts` spread. (Renderer `electron.d.ts` typings for `models*` deferred to Phase 3 with the UI — devtools calls work regardless.)

### 2.6 Migration sanity (verified via test)

- [x] Old layout `image/<extractedName>/<modelFileName>` found by recursive scan and filename-matched to the same profile id → `sdImageActiveModel` still resolves. Covered by `sdimage-scan.test.ts` (fixture mirrors a real old install → `{ kind: 'profile', profileId: 'sd15-base-q4' }`).

### 2.7 Phase 2 tests — all green (67 total)

- [x] `model-registry.test.ts`: sourceUrl present/https; downloadUrl https + not learnwithhasan; unique ids; unique matchFileNames; flux diffusion-model profiles declare companions; no `flux` family; companion sourceUrls valid; FAMILY_PRESETS coverage.
- [x] `sd-cli-runner.test.ts` (`buildArgs` pure): sd15 basic; flux1 → `--diffusion-model`+`--clip_l`/`--t5xxl`/`--vae`; flux2 → `--llm`+`--vae`; all-in-one flux1 → `-m` no companions; seed/img2img/lora passthrough; width/steps overrides; request `vaePath` overrides companion vae.
- [x] `sdimage-companions.test.ts`: found-next-to-model, found-in-root, model-dir-wins, missing → issues listing searched dirs + source link, all-in-one clears, sd15 empty; `buildCompanionFileKinds` map.
- [x] `sdimage-scan.test.ts`: old-layout → profile; flat canonical → profile; renamed+sidecar → custom; companion → companion; unknown → unrecognized.
- [x] Manual: `npm run dev` boots clean — `initSdImageEngine` runs `registerImageCategory` + initial `scanImageLibrary` with no error (sd-cli-absent warning fires after the scan), `[IPC] IPC handlers registered`. Live devtools `modelsScan` call deferred to Phase 3 (non-interactive session; scan pipeline is covered by `sdimage-scan.test.ts` and runs clean at startup).

**Definition of done**: tests green (67); type counts ≤ baseline (node 36 / web 44); `grep -rn "learnwithhasan"` in `src/local-image-engine` + `src/main/services/sdimage*` = **zero**; app launches; scan runs clean at startup. ✅ ALL MET.

---

## Phase 3 — Dedicated "AI Models" screen + usage UI

### 3.1 Screen wiring

- [x] `feature-flags.ts`: added `'ai-models': false` (prod-hidden; dev force-enabled).
- [x] `src/features/ai-models/components/AiModelsScreen.tsx` (wraps `AiModelsTab` with the standard toolbar/layout, ToolsHubScreen pattern); exported from feature `index.ts`.
- [x] `App.tsx`: `'ai-models': AiModelsScreen` in the screens map. `Sidebar.tsx`: entry (label "AI", `Boxes` icon; the sidebar already gates on `isFeatureEnabled`).

### 3.2 Image library view (rewrite `ImageModelsContent.tsx`)

Follow UI_SPEC.md + existing table styling. Split into sub-components (300-line rule): suggested `ImageLibraryHeader.tsx`, `InstalledModelsList.tsx`, `ProfileCatalogList.tsx`, `ModelSetupDialog.tsx`, hook `useImageLibrary.ts` (replaces `useSdImageModels.ts`).

- [x] `ImageLibraryHeader`: models folder path (truncated), Change (`dialogOpenFolder` → `MODELS_SET_FOLDER`), Open folder (`MODELS_OPEN_FOLDER`), Rescan; sd-cli status chip; Import button.
- [x] `InstalledModelsList` ("Your models"): name, family badge, fs size, status (Ready / Needs N files → expandable companion detail with per-file "Get ↗" links), ACTIVE badge + Use, Reveal (opens models folder — no per-file `showItemInFolder` channel exists; deviation noted), Delete (inline two-click confirm; states it deletes from disk); unrecognized files rendered here with a **Set up** action; per-model usage (`Used N× · date`) shown from the scan's embedded `lastUsedAt`/`useCount`.
- [x] `ProfileCatalogList` ("Model library", profiles not installed): name, family, size, **Get ↗** (reused existing `APP_OPEN_EXTERNAL` / `appOpenExternal`), **Download** when `hasDownload` (reuses existing download-manager progress/pause/resume/cancel, metadata unchanged), search box, note text.
- [x] **Import…**: file picker (`dialogOpen`, `.safetensors/.gguf/.ckpt`) → Set-up dialog with Move/Copy (Move default) → `MODELS_IMPORT`. (Auto-classify happens server-side: a profile-matching filename ignores the sidecar.)
- [x] **`ModelSetupDialog`**: family picker (5 families with default hints), name field, flux1 "All-in-one checkpoint" toggle; used for both import (with Move/Copy) and the unrecognized "Set up" flow (`MODELS_CONFIGURE`).
- [x] Empty state for a fresh folder (points at Download + Import).
- [x] `useImageLibrary` hook replaces the download-centric `useSdImageModels` (which is now orphaned — Phase 4 deletes it).

### 3.3 Dashboard & usage

- [x] `MainContent.tsx`: added a "Library" card — image model count + total disk (from `MODELS_SCAN`). **Deviation:** engine cards were NOT rewired to the runtime-registry — only `sd-cli` is registered in v1 (sherpa/llama/pytorch aren't, per the design's incremental migration stance §3.4/§12), so rewiring now would regress those rows. The cards stay on `use-system-info`; the registry-backed rework lands when those runtimes register (later batch). Library card also notes audio/LLM/embedding totals arrive then.
- [x] Per-model rows show `lastUsedAt`/`useCount`. **Deviation:** read from the scan's embedded usage (added to `InstalledModelIpc` in Phase 2) rather than a separate `MODELS_USAGE_GET` round-trip — one fewer call, same data. `MODELS_USAGE_GET` remains available.
- [x] `GeneralTab.tsx`: DELETED the `{false && ...}` AI-models block + the now-unused `aiModelsFolder`/`browseAiModelsFolder` props (interface + `SettingsScreen` call site). Settings/IPC backend kept (audio still uses the folder). `electron.d.ts`: added `models*` + `sdImageStatus`/`sdImageSetActiveModel`/`sdImageModelDownload`/`appOpenExternal` typings (this *fixed* pre-existing baseline errors → web dropped 44→39).

### 3.4 Phase 3 testing (manual — dev mode)

- [x] `npm run dev` boots clean (dev server + Electron, `[IPC] IPC handlers registered`, image scan runs, no renderer/main errors). Renderer bundle compiles + serves with the new screen.
- [~] **Interactive click-through DEFERRED to an interactive session** (this session is non-interactive — can't drive the Electron GUI to click the screen/folder/import/setup/download/delete flows). The screen is type-safe (web tsc clean), builds, and every flow it calls is either unit-tested (scan/classify/companions/import/registry) or a thin wrapper over Phase-2 services verified to run at startup. The following remain to be exercised by a human: sidebar "AI" → screen renders + Library card totals; Change-folder → empty state; drop `.gguf` → Rescan → Unrecognized → Set up → sidecar appears + persists; Import Move/Copy; canonical rename → profile match → Use → ACTIVE persists; flux1 companion "Needs 3 files" → add companions → Ready; D1 download bk-sdm-tiny; Delete → file+sidecar gone.
- [ ] **E2E generation (only if sd-cli.exe present)**: not run — sd-cli is not bundled locally.

**Definition of done**: type counts ≤ baseline (node **36** / web **39**, below baseline — d.ts fixes); `npm test` green (**67**); prod build unaffected (`npm run build` succeeds; flag keeps the screen hidden in prod). ✅ AUTOMATED CHECKS MET; interactive UI walkthrough deferred (non-interactive session).

---

## Phase 4 — Cleanup & release hygiene

- [x] `src/audio-engine/model-registry.ts`: DELETED `MODELS_BASE_URL` + its `index.ts` export; fixed the doc comment.
- [x] `src/main/ipc/audio-handlers.ts`: deleted the relative-path fallback → `downloadUrl = model.downloadPath`; dropped the `MODELS_BASE_URL` import. Fixed the `downloadPath` doc comment in `audio-engine/types.ts`.
- [x] Sweep: `grep -rn "learnwithhasan" src/` → 4 matches, all **benign** (2 test assertions that *enforce* no-learnwithhasan URLs; the Windows AppUserModelID `com.learnwithhasan.vidtsx-studio` app-identity string; 1 doc-comment rule). Zero hosting references.
- [x] Sweep: `grep -rn "SD_MODELS_BASE_URL\|MODELS_BASE_URL" src/` → **zero**.
- [x] Deleted orphaned `src/renderer/hooks/useSdImageModels.ts` (fully replaced by `useImageLibrary`, no importers). Legacy `SdImage*` IPC types are NOT dead — Tools → Image AI Tester still uses them; left in place.
- [x] Type counts ≤ baseline: node **36**, web **36**; `npm test` green (**67**); `npm run build` + `npm run build:win` succeed. **Fixed a pre-existing `build:win` blocker:** electron-builder.yml pointed NSIS at the missing `build/license.txt` (batch-2 license-removal debt; `build/` is gitignored) → created committed `LICENSE.txt` from the root MIT `LICENSE` and pointed `license: LICENSE.txt`. Installer `dist/VidTSX-Studio-Setup-0.1.14.exe` now builds + signs cleanly.
- [x] Updated `STATUS.md` + auto-memory progress note.
- [ ] External reminder (not in repo): retire `learnwithhasan.com/api/vidtsx/models/*` hosting server-side once a release without the old resolver is out. **(server-side task — cannot be done from this repo.)**

**Definition of done**: sweeps clean (no hosting refs), builds pass (incl. build:win after the license fix), STATUS.md + memory updated, phase commits made. ✅ MET.

---

## Deferred (explicitly NOT in this plan)

- Header sniffing for family auto-detect (design §4 phase-2; GGUF `general.architecture` / safetensors tensor-name fingerprints).
- Multiple scan folders (`extra_model_paths.yaml` pattern).
- Adapting audio/LLM/embedding categories onto the core (design §12 item 5).
- Per-model performance stats; Civitai hash lookup (`sha256` sidecar field).
- sd-cli binary distribution story (bundle vs download from GitHub releases).

---

## Post-completion backlog — hardening + video (for a follow-up session)

The redesign (Phases 0–4) is done and committed. Before it's "stable to ship",
and to grow into video, here's the prioritized backlog.

### A. Hardening / stabilization (make image solid)

1. **Interactive UI verification** — actually click every §3.4 flow (folder change,
   drop→Set up→sidecar persists, import move/copy, canonical rename→profile→Use
   persists across restart, flux1 companion resolution, D1 download, delete). Never
   run in the build sessions (non-interactive).
2. **Download integrity check** (HIGH — root-caused a real failure). A truncated
   `.gguf` passes sd-cli's header parse then dies "read tensor data failed" at
   generation. In `download-manager` (or `downloadProfileModel`) verify the finished
   `.part` size against the server `Content-Length` (and/or profile `sizeBytes`)
   BEFORE the rename; optionally sha256 vs the HF LFS hash. Refuse to reveal a short file.
3. **Friendly generation errors** — the engine forwards raw sd-cli stderr. Map the
   common cases (missing companion, truncated/corrupt file "read tensor data failed",
   OOM/VRAM, unsupported architecture on an old sd-cli) to actionable messages. The
   backend already produces typed `missing-companion`/`missing-file` — extend to sd-cli exit parsing.
4. **Catalog verification sweep** — gpustack SD/SD3.5 sizes + the sdxl-turbo 404 are
   fixed (commit `14ef500`). STILL to verify: flux (leejet) sizes/links, FLUX.2 Klein
   companion GGUF locations, the 13 Civitai/HF link-only `sourceUrl`s, flux-mini. Add a
   dev-only script/test that HEADs every `downloadUrl` (expect 200 + sane `Content-Length`).
5. **VRAM/RAM preflight** — `requirements.minVramGB` exists on the envelope but is
   unused; warn before running a model too big for the detected GPU (e.g. the dev box
   is an RTX A3000 laptop ~6 GB → SD3.5 large/flux-q8 will OOM).
6. **sd-cli distribution** (also the gate for video, see B) — `sd-cli.exe` is
   `*.exe`-gitignored and vanished once already. Decide: commit it (~922 KB), or
   download it on first run from stable-diffusion.cpp GitHub releases (public/stable →
   fits the D1 rule) with a version check. A newer build is REQUIRED for SD3.5-on-old-builds and for video.
7. **Finish the Phase-2 deviation** — migrate Tools → Image AI Tester off the legacy
   `SdImageModelIpc`/sd-image list IPC onto `MODELS_SCAN`, then delete the legacy shape.
8. **Library-service tests** — `sdimage-library` scan→InstalledModel building and
   `resolveInstalledModel` throwing have no unit test (the module imports electron via
   settings). Add one with an injected models dir / stubbed settings.
9. **Companion one-click download** — flux clip_l/t5xxl/ae have public HF URLs (D1-eligible);
   offer to fetch them from the "Needs N files" row instead of only linking out.

### B. Video models (Wan / LTX) — architecturally ready, needs a video adapter

**Great news:** stable-diffusion.cpp (= the bundled `sd-cli` engine) generates video now
— Wan 2.1/2.2 (T2V+I2V) and LTX-2.3 (see the repo's `docs/ltx2.md`), all via GGUF. So
video reuses the existing runtime + GGUF scanning; NO PyTorch pipeline required. The
category-agnostic core already reserves `ModelCategory = 'video'`.

Work to add it (one `ModelCategoryDescriptor` + profiles + a video runner):
- **Newer sd-cli.exe** with video support (the dev box's May build predates it) — ties to A6.
- `video` descriptor: dirName `'video'`, single-file, `.gguf`/`.safetensors`, runtime `'sd-cli'`, its own families (`wan21` / `ltx` / …) + companions (Wan needs a umt5 text encoder + its VAE; LTX its own).
- Video generation args in the runner: frame count, fps, video/frames output (sd-cli's video flags differ from image) + a `VideoGenerationRequest`.
- Profiles sized to the hardware: **Wan 2.1 1.3B GGUF (~4–6 GB VRAM @480p)** is the sweet spot for a 6 GB laptop GPU; **LTX 2B (~6–8 GB)** is borderline; 14B/HunyuanVideo are too heavy.
- UI: reuse the existing Remotion/video player to preview results; a `video` sub-tab in the AI Models screen.
- Sources (2026): [stable-diffusion.cpp README (Wan/LTX)](https://github.com/leejet/stable-diffusion.cpp), [ltx2.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/ltx2.md), [Wan/LTX low-VRAM guide](https://localaimaster.com/blog/local-text-to-video-low-vram).

---

## Progress Log

> Append one entry per working session: date, phase/steps done, deviations
> from plan (and why), verification results (test run, type-error counts vs
> baseline), and anything the next session must know.

- **2026-07-15** — Plan created from agreed design (`local-image-models-redesign.md`). Baseline type-error counts NOT yet captured (Phase 0 task). No implementation started.
- **2026-07-15 — Phase 0 COMPLETE.**
  - **Type-error baseline (never exceed):** `tsconfig.web.check.json` = **44** errors; `tsconfig.node.check.json` = **36** errors (total 80). Lower than the plan's ~90 estimate — captured fresh; these are the hard ceiling. Re-ran both after the vitest install → still 44 / 36 (unchanged).
  - Installed `vitest@4.1.10` (exact-pinned, no `^`; `--legacy-peer-deps`). Added `"test": "vitest run"` + `"test:watch": "vitest"` scripts.
  - Created `vitest.config.ts` at repo root: node environment, `include: ['src/**/*.test.ts']`, with `@shared`/`@main`/`@logging`/`@audio-engine` aliases mirrored from `electron.vite.config.mjs` so core tests can use path aliases. Confirmed neither check tsconfig `include`s the root `vitest.config.ts`, so it can't affect the baseline. **Note for Phase 1:** `.test.ts` files under `src/main`/`src/shared` ARE included by `tsconfig.node.json`, so test files get type-checked by the node check — keep them clean (they'd otherwise inflate the node count). Import from `'vitest'` explicitly (config does not enable `globals`).
  - Smoke test (`__placeholder.test.ts`, `expect(1).toBe(1)`) ran green via `npm test`, then deleted (`src/main/services/model-library/` is now empty).
  - `npm run build` succeeded (✓ built ~43s; main + preload + renderer all clean). `npm run dev` launched cleanly — main/preload built, renderer dev server on :5173, Electron process stayed alive (installed app was NOT running, so no single-instance-lock exit). Cleaned up the spawned electron processes afterward.
  - Deviation: added path aliases to `vitest.config.ts` (plan only specified env + include) — needed so Phase 1 core tests can import via `@shared`/`@main`. No downside.
  - **Next: Phase 1 — model-library core** (category-agnostic types + scanner/classifier/sidecars/importer/usage-store/registries + tests). Rule: no `electron` import and no settings-db import anywhere under the core dirs.
- **2026-07-15 — Phase 1 COMPLETE (model-library core, category-agnostic).**
  - Files created: `src/shared/model-library/{types.ts,index.ts}`; `src/main/services/model-library/{scanner,classifier,sidecars,importer,usage-store,category-registry,runtime-registry,index}.ts` + 5 `.test.ts`.
  - **Verification:** `npm test` → **37 passed / 5 files**. Type-error counts: node **36** (= baseline), web **44** (= baseline). No `electron` import and no settings-db import under either core dir (grep clean — only doc-comment mentions of "settings").
  - **Type-error gotcha hit & fixed:** initial `scanner.ts` typed readdir results as `Awaited<ReturnType<typeof fs.readdir>>`, which resolves to the *last* readdir overload (`Dirent<NonSharedBuffer>[]`) and added +7 node errors. Fixed with a `safeReadDir(): Promise<Dirent<string>[]>` helper (also DRYs the try/catch). Confirms the note: `.test.ts` + core source under `src/main` ARE node-checked, so keep them clean.
  - **Deviations from plan (all noted inline in §1.x):**
    - `classifier` `companionFileNames` is a `Record<fileName, kind>` not a bare list — required to return `companionKind` per the result union.
    - `readSidecar` returns `{ sidecar, issue? }` (not bare `SidecarFileV1 | null`) so the caller receives the `unreadable-sidecar` issue; the classifier ctx uses a `.sidecar`-extracting adapter.
    - `usage-store` `createUsageStore` takes an optional `{ now }` clock for deterministic tests (defaults to wall clock — `Date.now`/`new Date()` are fine in normal app code; only Workflow scripts forbid them).
    - Added `directoryUnit?` + `ScannedFile` to shared types (needed by scanner/classifier) and `ModelLibraryError` class for thrown ops; `ModelCategoryDescriptor` is `<TMeta, TResolved>` with `resolve()`; classifier hooks live in `ClassifyContext`, keeping the descriptor image-ism-free.
    - Registries expose `__reset*` test helpers and store descriptors generic-erased via `as unknown as` (no `any`).
  - Design fidelity: single-file + directory install kinds both supported; sidecar spreads category fields at top level (index signature); usage keyed `${category}:${modelId}`; download policy/companion knowledge deliberately absent from the core (they're phase-2 image-adapter concerns).
  - **Next: Phase 2 — image adapter + registry rework** (SdModelMeta envelope, flux1/flux2 split, companion data, delete `SD_MODELS_BASE_URL`/relative download fields, `sdimage-library.ts`, engine/sd-cli-runner rewire, typed errors, `imageModelsFolder` setting, generic IPC).
- **2026-07-15 — Phase 2 COMPLETE (image adapter + registry rework).**
  - **Verification:** `npm test` → **67 passed / 9 files** (37 core + 30 image). Type-error counts: node **36**, web **44** (both = baseline). `grep learnwithhasan` in `src/local-image-engine` + `src/main/services/sdimage*` = **0**. No references to any deleted symbol (`SD_MODELS_BASE_URL`, `SdModelDefinition`, `getSdImageModelsDir`, `downloadSdModel`, `deleteSdModel`, `isSdModelDownloaded`, …). `npm run build` clean (all 3 bundles). `npm run dev` boots clean — image category registers + initial scan runs with no error.
  - **Catalog reality:** the catalog had grown to **34** entries (not the design's 29): 21 direct-HF (`downloadUrl` kept) + 13 ex-self-hosted zips (link-only via `sourceUrl`). All 34 converted to `ModelProfileEnvelope<SdModelMeta>`, ids unchanged.
  - **Files created:** `src/local-image-engine/family-presets.ts`; `src/main/services/{sdimage-library,sdimage-companions,sdimage-download,model-usage}.ts`; `src/main/ipc/model-library-handlers.ts`; `src/main/ipc/registrations/model-library.ts`; `src/shared/ipc/types/model-library.ts`; `src/preload/api/model-library.ts`; 4 `.test.ts`.
  - **Files reworked:** `types.ts` (family split, SdModelMeta/CompanionRequirement/ResolvedSdModel, deleted SdModelDefinition), `model-registry.ts` (envelopes), `sd-cli-runner.ts` (buildArgs(resolved)), `image-engine.ts` (resolver-injected), `sdimage-models.ts` (trimmed to cli helpers), `sdimage-init.ts`, `settings.ts`, `sdimage-handlers.ts`, `channels.ts`, `register.ts` + barrels/preload.
  - **Deviations (noted inline in §2.x):**
    - **Legacy `SdImageModelIpc` KEPT** rather than reworked. Reworking it in Phase 2 would force rewriting the Image AI Tester + orphaned `useSdImageModels` (web-checked), risking the web baseline and the "tester still lists downloaded models" DoD check. Instead the new `MODELS_SCAN` channel carries the richer installed+profile shape (`model-library.ts` types); the tester keeps the legacy list (now scan-backed: `downloaded` = a scanned model matches the profile id). Phase 3 migrates the UI to `MODELS_SCAN`; Phase 4 deletes the legacy shape + `useSdImageModels`.
    - Split the library service into `sdimage-library.ts` + `sdimage-companions.ts` + `sdimage-download.ts` (300-line rule; companions/download are cleanly separable and companions is electron-free → unit-testable).
    - `registerImageCategory()` is called from `sdimage-init` (not a module side-effect) so registration is deterministic and testable.
    - `resolveModelSync` (engine path) reads the cached `lastScan` synchronously (the engine resolver interface is sync); async `scanImageLibrary` populates it. `sdimage-init` always scans before wiring the resolver.
    - Renderer `electron.d.ts` `models*` typings deferred to Phase 3 (that file is a hand-maintained partial that already omits `sdImage*`, which is why those web errors are pre-existing baseline entries — not introduced here).
  - **⚠️ Metadata needing human/real-sd-cli verification before ship** (design §10 required pre-ship pass):
    - **FLUX.2 Klein companion source links** (qwen3-4b/8b encoders, `flux2_ae.safetensors`) point at the Black Forest Labs HF org page — exact public GGUF locations UNVERIFIED (FLUX.2 is new). `sourceUrl` for the 3 klein profiles + `flux-mini` (TencentARC) + the Civitai/HF pages for the 13 link-only entries are best-effort canonical guesses, not network-verified (couldn't verify each in this session).
    - `flux-schnell` full-precision safetensors marked diffusion-model + companions; verify whether any packaging is all-in-one against a real sd-cli.
  - **Next: Phase 3 — dedicated "AI Models" screen + usage UI** (feature flag, promote `ai-models` feature, rewrite `ImageModelsContent` onto `MODELS_SCAN`/`useImageLibrary`, Set-up dialog, dashboard Library card + runtime-registry-backed engine cards, delete hidden GeneralTab block). Add `models*` to `renderer/types/electron.d.ts` there.
- **2026-07-15 — Phase 3 COMPLETE (AI Models screen + library view + usage UI).**
  - **Verification:** type-error counts node **36** (= baseline), web **39** (< baseline 44 — the `electron.d.ts` `models*`/`sdImage*`/`appOpenExternal` additions fixed several pre-existing missing-method errors). `npm test` → **67 passed / 9 files**. `npm run build` clean (3 bundles). `npm run dev` boots clean (image scan + IPC registered, no errors). **The `ai-models` flag stays `false` in prod → screen hidden in prod builds; dev force-enables it.**
  - **Files created:** `ai-models/components/{AiModelsScreen,ImageLibraryHeader,InstalledModelsList,ProfileCatalogList,ModelSetupDialog}.tsx`, `ai-models/hooks/useImageLibrary.ts`. **Reworked:** `ImageModelsContent.tsx` (full rewrite onto `MODELS_SCAN`), `MainContent.tsx` (Library card), `feature-flags.ts`, `App.tsx`, `Sidebar.tsx`, `ai-models/index.ts`, `GeneralTab.tsx` + `SettingsScreen.tsx` (deleted hidden block + props), `renderer/types/electron.d.ts` (typings).
  - **Deviations (noted inline in §3.x):** (1) engine cards NOT rewired to runtime-registry — only sd-cli is registered in v1; rewiring sherpa/llama/pytorch now would regress them, so they stay on `use-system-info` until those runtimes register (later batch). (2) per-model usage read from the scan's embedded `lastUsedAt`/`useCount` rather than a separate `MODELS_USAGE_GET` call. (3) "Reveal" opens the models folder (no per-file `showItemInFolder` channel exists). (4) Delete uses a two-click inline confirm (no modal-confirm component in the shared kit). (5) Kept legacy `useSdImageModels`/`SdImageModelIpc` for now — Phase 4 deletes them.
  - **⚠️ Interactive UI walkthrough NOT run** (non-interactive session — can't click the Electron GUI). Automated evidence only: types/build/tests pass + clean boot + backend flows unit-tested. A human should run the §3.4 click-through (folder change, drop/setup, import move/copy, canonical rename→profile→Use persist, flux1 companion resolution, D1 download bk-sdm-tiny, delete) before considering Phase 3 field-verified.
  - **Next: Phase 4 — cleanup** (audio `MODELS_BASE_URL` + fallback delete; `grep learnwithhasan src/` = 0; delete orphaned `useSdImageModels` + dead SdImage types; `npm run build:win`; update STATUS.md + memory).
- **2026-07-15 — Phase 4 COMPLETE (cleanup & release hygiene). REDESIGN DONE (Phases 0–4).**
  - Deleted audio `MODELS_BASE_URL` (`audio-engine/model-registry.ts` + `index.ts` export) and the relative-path fallback in `audio-handlers.ts` (→ `downloadUrl = model.downloadPath`; import dropped); fixed the `downloadPath` doc comment. Deleted orphaned `src/renderer/hooks/useSdImageModels.ts`.
  - **Sweeps:** `SD_MODELS_BASE_URL|MODELS_BASE_URL` in src/ = **0**. `learnwithhasan` in src/ = 4, all benign (2 test guards enforcing no-learnwithhasan, the Windows AppUserModelID app-identity string, 1 doc comment) — no hosting references remain.
  - **Verification:** node **36** / web **36** (≤ baseline; web dropped from deleting the orphaned hook + d.ts typings). `npm test` = **67 passing**. `npm run build` clean. `npm run build:win` **succeeds** → signed installer `dist/VidTSX-Studio-Setup-0.1.14.exe`.
  - **Deviation / extra fix:** `build:win` had a pre-existing blocker — electron-builder.yml's NSIS `license: build/license.txt` referenced a file that never existed (batch-2 license-system removal debt; `build/` is gitignored). Created committed `LICENSE.txt` (copy of root MIT `LICENSE`) and set `license: LICENSE.txt`. This is unrelated to the redesign but was required for the build:win DoD and is legitimate release hygiene.
  - STATUS.md + auto-memory (`local-image-models-impl-progress.md`) updated.
  - **⚠️ Before shipping (NOT done in these non-interactive sessions):** (1) interactive click-through of the AI Models screen; (2) verify the unverified catalog `sourceUrl`s / FLUX.2 companion links against a real sd-cli (design §10); (3) sd-cli bundling + generation E2E; (4) retire the server-side `learnwithhasan.com/api/vidtsx/models/*` hosting.

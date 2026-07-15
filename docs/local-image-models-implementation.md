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

- [ ] `feature-flags.ts`: add `'ai-models': false` (prod-hidden; dev force-enabled like the rest).
- [ ] `src/features/ai-models/components/AiModelsScreen.tsx` (new, wraps existing `AiModelsTab` with the standard screen toolbar/layout — copy the pattern from `ToolsHubScreen`); export from feature `index.ts`.
- [ ] `App.tsx`: add `'ai-models': AiModelsScreen` to the screens map. `Sidebar.tsx`: add entry (label "AI Models", gated on the flag — follow existing entries).

### 3.2 Image library view (rewrite `ImageModelsContent.tsx`)

Follow UI_SPEC.md + existing table styling. Split into sub-components (300-line rule): suggested `ImageLibraryHeader.tsx`, `InstalledModelsList.tsx`, `ProfileCatalogList.tsx`, `ModelSetupDialog.tsx`, hook `useImageLibrary.ts` (replaces `useSdImageModels.ts`).

- [ ] Header: models folder path, Change (dir picker via existing dialog IPC pattern), Open folder (`MODELS_OPEN_FOLDER`), Rescan; sd-cli status chip.
- [ ] "Your models" section: name, family badge (FLUX.1/FLUX.2/SDXL/…), size (fs-derived), status (Ready / Needs N files → expandable companion detail with per-file "Get ↗" links / Unrecognized → **Set up**), ACTIVE badge + Use action, Reveal in Explorer, Delete (confirm dialog; states it deletes the file from disk).
- [ ] "Model library" section (profiles not installed): name, family, size, **Get model ↗** (`shell.openExternal` via IPC — check for an existing open-external channel before adding one), **Download** button when `hasDownload` (reuse existing progress/pause/resume plumbing — download-manager metadata unchanged), note text about dropping files into the folder.
- [ ] **Import…**: file picker (`.safetensors/.gguf/.ckpt`) → Move/Copy choice (Move default) → auto-classify → Set up dialog if unrecognized.
- [ ] **Set up dialog**: family picker (5 families), name field, flux1 "All-in-one checkpoint (includes text encoders & VAE)" toggle; explains what defaults the family applies.
- [ ] Empty state for fresh installs (no models yet → points at Get-model links + Import).

### 3.3 Dashboard & usage

- [ ] `MainContent.tsx`: add a "Library" card — per-category disk totals + model counts (from scan) alongside existing disk-free row. Engine cards: back them with `runtime-registry` statuses (sd-cli, sherpa, llama, pytorch) — keep visuals, swap the data source. PyTorch installer stays as-is.
- [ ] Per-model rows (3.2) show `lastUsedAt`/`useCount` from `MODELS_USAGE_GET` (em-dash when never used).
- [ ] `GeneralTab.tsx`: DELETE the `{false && ...}` AI-models block + now-unused `aiModelsFolder`/`browseAiModelsFolder` props (keep the settings/IPC backend — audio still uses the folder; the *image* folder control lives in the new screen header).

### 3.4 Phase 3 testing (manual — dev mode; close the installed app first)

- [ ] `npm run dev` → sidebar shows "AI Models" → screen renders; Main dashboard loads system info; Library card shows totals.
- [ ] Folder flow: Change folder to an empty temp dir → rescan → empty state. Drop a dummy `.gguf` → Rescan → Unrecognized → Set up as `sd15` → sidecar JSON appears next to file; entry shows family badge; restart app → still there.
- [ ] Import flow: Import a dummy file with Move → file relocated into folder + classified. Copy variant → original remains.
- [ ] Rename a dummy file to a canonical profile name (e.g. `stable-diffusion-v1-5-Q4_0.gguf`) → Rescan → matched to profile, no sidecar needed, Use → ACTIVE badge persists across restart (`sdImageActiveModel`).
- [ ] Companion flow: set up a dummy file as flux1 (not all-in-one) → row shows "Needs 3 files" with Get links; add dummy `clip_l.safetensors`/`t5xxl_fp16.safetensors`/`ae.safetensors` to folder root → Rescan → Ready.
- [ ] D1 download: click Download on `bk-sdm-tiny-q4_0` (654 MB, HF direct) → progress/pause/resume/cancel work → lands as file in folder root → matched to profile. (Skippable on constrained network — note in log.)
- [ ] Delete flow: Delete → confirm dialog → file (+ sidecar) gone from disk.
- [ ] **E2E generation (only if you have sd-cli.exe locally)**: place in `resources/binaries/`, download/import a real small model (bk-sdm-tiny), Tools → Image AI Tester → generate → image renders; usage count/lastUsedAt update on the model row. Record result in Progress Log either way.

**Definition of done**: manual checklist passes; type counts ≤ baseline; `npm test` green; prod build unaffected (`npm run build` succeeds; flag keeps screen hidden).

---

## Phase 4 — Cleanup & release hygiene

- [ ] `src/audio-engine/model-registry.ts`: DELETE `MODELS_BASE_URL` (+ its export in `src/audio-engine/index.ts` if present); fix the doc comment ("Update this when hosting models…").
- [ ] `src/main/ipc/audio-handlers.ts`: delete the relative-path fallback (~line 161–163) — `downloadUrl = model.downloadPath` unconditionally; drop the `MODELS_BASE_URL` import.
- [ ] Sweep: `grep -rn "learnwithhasan" src/` → **zero** matches (docs/ may still reference it historically).
- [ ] Sweep: `grep -rn "SD_MODELS_BASE_URL\|MODELS_BASE_URL" src/` → zero.
- [ ] Delete orphaned code this work obsoleted: `useSdImageModels.ts` (if fully replaced), any dead `SdImage*` IPC types.
- [ ] Type counts ≤ baseline; `npm test` green; `npm run build` + `npm run build:win` succeed.
- [ ] Update `STATUS.md` (this work item complete) + the auto-memory progress note.
- [ ] External reminder (not in repo): retire `learnwithhasan.com/api/vidtsx/models/*` hosting server-side once a release without the old resolver is out.

**Definition of done**: all sweeps clean, builds pass, STATUS.md updated, phase commits pushed.

---

## Deferred (explicitly NOT in this plan)

- Header sniffing for family auto-detect (design §4 phase-2; GGUF `general.architecture` / safetensors tensor-name fingerprints).
- Multiple scan folders (`extra_model_paths.yaml` pattern).
- Adapting audio/LLM/embedding categories onto the core (design §12 item 5).
- Per-model performance stats; Civitai hash lookup (`sha256` sidecar field).
- sd-cli binary distribution story (bundle vs download from GitHub releases).

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

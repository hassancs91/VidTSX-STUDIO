# Local Image Models Redesign — ComfyUI-style library

> Status: **DESIGN AGREED — D1–D5 all decided (2026-07-15). Scoped to be
> built on the multi-category model-library core (§3.5). Implementation not
> started.**
> Context: open-source release prep. The app must stop hosting SD/Flux model
> downloads on learnwithhasan.com. This doc proposes replacing the
> download-centric catalog with a user-managed model library.

## 1. Current state (as explored 2026-07-15)

- `src/local-image-engine/model-registry.ts` — 29 hardcoded `SdModelDefinition`
  entries. 16 have absolute HuggingFace URLs; **13 have relative `downloadPath`
  values resolved against `SD_MODELS_BASE_URL` (learnwithhasan.com)** in
  `src/main/services/sdimage-models.ts:75`. The 13 are all `.zip` archives; the
  Flux ones exist as zips specifically to bundle companion files (VAE, Qwen
  encoder, clip_l, t5xxl) with the model.
- `src/main/services/sdimage-models.ts` — path helpers + `downloadSdModel()`
  (routes through the shared download-manager, `.part` rename for single files,
  archive extraction for zips). "Downloaded" = `existsSync` of the model file.
  **Hardcodes `userData/ai-models/image`** — it does not honor the
  `aiModelsFolder` setting that audio and embeddings honor.
- `src/local-image-engine/image-engine.ts` — queue + orchestration. Resolves
  the model path as `modelsBasePath/extractedName/modelFileName`.
- `src/local-image-engine/sd-cli-runner.ts` — builds sd-cli args from the
  model definition; companion files resolved as `<modelDir>/<fileName>`.
- UI: `src/features/ai-models/` (AiModelsTab → ImageModelsContent) is
  **orphaned** — nothing renders it since the batch-1 feature removals. The
  only live consumer is Tools → Image AI Tester (downloaded models only).
- Audio: all 29 entries use absolute GitHub URLs. `MODELS_BASE_URL` in
  `src/audio-engine/model-registry.ts` is dead code, but a live fallback
  branch referencing it remains in `src/main/ipc/audio-handlers.ts:163`.
- Known-broken metadata: `flux-schnell-q4/q8`, `flux-dev-q2k/q3k/q4/q8`,
  `flux-fill-dev-q4` are diffusion-model-only GGUFs but have no companion
  fields and no `useDiffusionModelFlag` — sd.cpp requires
  `--diffusion-model` + `--clip_l` + `--t5xxl` + `--vae` for FLUX.1, so these
  would fail at generation time. The catalog needs a metadata review pass
  independent of the hosting question.

## 2. Design goals

1. Zero dependence on owner infrastructure for image models.
2. Preserve the metadata sd-cli needs (family, defaults, capabilities,
   companion files) — this is the real value of the curated catalog.
3. Users can bring any model file (Civitai, HuggingFace, existing ComfyUI
   collections) and get correct family-level behavior.
4. Existing beta installs keep working with no migration step.
5. Audio/LLM/whisper downloads (public hosts) are untouched; the download
   manager stays.

## 3. Core concepts

### 3.1 Profile (curated, compiled-in)

`SdModelProfile` replaces `SdModelDefinition` for the curated catalog. It is
metadata + a link, not a download instruction:

```ts
interface SdModelProfile {
  id: string;                    // stable, same ids as today
  name: string;
  family: SdModelFamily;
  sizeBytes: number;             // approximate, display only
  sizeLabel: string;
  /** Canonical filenames used to auto-match scanned files (old modelFileName + known variants) */
  matchFileNames: string[];
  /** Human page where the user obtains the model (HF repo / Civitai page) */
  sourceUrl: string;
  /** Optional stable, public, unauthenticated direct URL → enables one-click download (D1: decided — hybrid) */
  downloadUrl?: string;
  defaults: SdGenerationDefaults;
  capabilities: SdModelCapabilities;
  useDiffusionModelFlag?: boolean;
  companions?: CompanionRequirement[];
}

interface CompanionRequirement {
  kind: 'vae' | 'llm' | 'clip_l' | 't5xxl';
  /** Accepted canonical filenames, e.g. ['ae.safetensors'] */
  fileNames: string[];
  sourceUrl: string;             // where to get this file
  sizeLabel: string;
}
```

Deleted from the type: `downloadPath`, `archiveFormat`, `extractedName`.
`SD_MODELS_BASE_URL` is deleted outright.

### 3.2 Family presets (for custom imports)

```ts
const FAMILY_PRESETS: Record<SdModelFamily, {
  defaults: SdGenerationDefaults;
  capabilities: SdModelCapabilities;
  useDiffusionModelFlag?: boolean;
  companions?: CompanionRequirement[];
}>
```

Proposed family split: `sd15 | sdxl | sd3 | flux1 | flux2` (today `flux`
covers both — but FLUX.1 needs clip_l+t5xxl+vae while FLUX.2 needs
llm+vae, and the distinction drives required companions; Decision D5).
Caveat: family presets are a starting point, not ground truth — e.g. an
all-in-one FLUX.1 checkpoint needs no companions while a diffusion-model-only
GGUF needs three; turbo/lightning variants want different steps/cfg. The
import dialog therefore always allows editing, and per-model overrides
(sidecar) always win over the preset.

### 3.3 Installed model (result of scanning)

```ts
interface InstalledSdModel {
  id: string;                    // profile id when matched, else 'custom-<slug>'
  name: string;
  filePath: string;              // absolute
  family: SdModelFamily;
  origin: 'profile' | 'custom';
  sizeBytes: number;             // from fs.stat
  defaults: SdGenerationDefaults;      // profile > sidecar > family preset
  capabilities: SdModelCapabilities;
  companionStatus: { kind: string; found: boolean; resolvedPath?: string }[];
}
```

**The models folder is the single source of truth** — no central manifest.
Custom-model configuration (family choice, name, default overrides) is stored
in a **sidecar file** next to the model: `<modelfile>.vidtsx.json`. Sidecars
survive folder moves, are self-describing, and deleting a model + sidecar
fully removes it. Profile-matched files need no sidecar at all.

### 3.4 Generalization: the model-library core (multi-category)

The app will grow beyond image models: audio (STT/TTS) exists today,
LLM/embedding models exist today, video models (and others) are planned —
some requiring special runtimes (PyTorch pipelines, new binaries). The image
redesign is therefore built as the **first adapter on a category-agnostic
core**, not as image-specific plumbing. What's shared vs. per-category:

**Shared core** (`src/shared/model-library/types.ts` for cross-process
types; `src/main/services/model-library/` for scanner/sidecars/import/usage):

- **Folder taxonomy**: one root `{aiModelsFolder}`, one subfolder per
  category. Existing dirs are grandfathered (`stt/`, `tts/`, `image/`,
  `embeddings/`); new categories get `video/`, `llm/`, etc. Per-category
  folder override settings (image gets one in v1; others as needed).
- **Profile envelope** (category payload nested, not flattened):

  ```ts
  interface ModelProfileEnvelope<TMeta> {
    id: string;
    category: ModelCategory;        // 'image' | 'stt' | 'tts' | 'llm' | 'embedding' | 'video' | ...
    name: string;
    sizeBytes: number; sizeLabel: string;
    sourceUrl: string;
    downloadUrl?: string;           // D1 rule: public/stable/unauthenticated only
    matchFileNames?: string[];      // single-file categories
    requirements?: { minRamGB?: number; minVramGB?: number };
    meta: TMeta;                    // category-specific: SdModelMeta | SherpaModelMeta | LlmModelMeta | ...
  }
  ```

- **Install-unit kinds**: `'single-file'` (image checkpoints, LLM GGUFs) and
  `'directory'` (sherpa audio models: `extractedDirName` + required
  `files[]` — exactly today's `isModelDownloaded` check). The scanner
  supports both; classification for directories = dir-name + files match
  against profiles.
- **Sidecar envelope** `<file>.vidtsx.json`:
  `{ "version": 1, "category": "image", "name": ..., ...categoryFields }` —
  future categories reuse the format.
- **Scan/classify pipeline**, import (move/copy), typed errors, download
  policy (D1), and the **usage store** (keyed `{category}:{modelId}`,
  engines report usage events to one main-process service).
- **Generic IPC**: `MODELS_SCAN` / `MODELS_IMPORT` / `MODELS_CONFIGURE` /
  `MODELS_REMOVE` / `MODELS_USAGE_GET`, all taking a `category` param —
  instead of per-category channel families.

**Per-category adapter** (a descriptor each engine registers with the core):

```ts
interface ModelCategoryDescriptor<TMeta> {
  category: ModelCategory;
  dirName: string;
  installKind: 'single-file' | 'directory';
  fileExtensions: string[];
  profiles: ModelProfileEnvelope<TMeta>[];
  familyPresets?: Record<string, Partial<TMeta>>;  // enables custom imports
  allowCustomImport: boolean;   // image: true; sherpa audio: false (profile-only)
  requiredRuntime: RuntimeId;
  resolve(installed: InstalledModel): TResolved;   // engine-consumable invocation data
}
```

- `allowCustomImport: false` keeps categories like sherpa audio profile-only
  (arbitrary user ONNX dirs can't be configured meaningfully); image/LLM are
  custom-friendly.

**Runtime registry** — the "special libraries" dimension, kept separate from
model categories because runtimes are shared and independently installable:

```ts
interface RuntimeDescriptor {
  id: RuntimeId;                  // 'sd-cli' | 'sherpa-onnx' | 'llama' | 'pytorch' | 'ffmpeg' | ...
  kind: 'bundled-binary' | 'node-module' | 'downloadable-binary' | 'python-runtime';
  isAvailable(): boolean | Promise<boolean>;
  install?: { sizeLabel: string; start(): ... };   // e.g. the existing PyTorch installer
}
```

The Main dashboard's engine cards and the existing PyTorch install flow
become views over this registry. Model rows render runtime state
("Requires PyTorch (GPU) — Install") instead of each tab hand-rolling
checks. A future video category = one `ModelCategoryDescriptor` + (if
needed) one `RuntimeDescriptor`; the library UI, scanning, import, usage
tracking, and download policy come for free.

**Migration stance — deliberately incremental**: v1 builds the core +
**image adapter only**. Audio/LLM/embedding registries and their existing
download flows keep working as-is and are adapted onto the core in a later
batch (their catalogs already fit the envelope; audio's `files[]` model is
the `directory` install kind). The core must simply avoid image-isms:
companions, families, and sidecar-configurability are all optional
per-category capabilities, not assumptions.

## 4. Scanning & matching

- **Folder**: `{imageModelsFolder}`, a new setting defaulting to
  `{aiModelsFolder}/image` (fixes today's inconsistency where the image
  engine ignores `aiModelsFolder`). Users with existing ComfyUI/A1111
  collections just point this at their checkpoints folder. Changing it
  triggers a rescan.
- **Recursive scan**, depth-limited (~3), for `.safetensors`, `.gguf`,
  `.ckpt`. Recursion is what keeps existing beta installs
  (`image/<extractedName>/<modelFileName>`) working untouched.
- **Classification pipeline per file**:
  1. Exact (case-insensitive) filename match against any profile's
     `matchFileNames` → installed profile model (same id as before → the
     `sdImageActiveModel` setting keeps working; zero migration code).
  2. Sidecar `<file>.vidtsx.json` exists → custom model with stored config.
  3. Filename matches a known companion canonical name (from all
     `CompanionRequirement.fileNames` + a small heuristic list) → companion
     inventory, not listed as a model.
  4. Otherwise → "unrecognized" bucket, shown in UI with a **Set up** action
     (pick family → writes sidecar → becomes a custom model).
- **No hashing in v1.** SHA-256 of 13 GB files is expensive and only buys
  exact-identity matching we don't need (family + defaults is what sd-cli
  needs). Filename matching covers files downloaded with canonical names;
  everything else goes through the 10-second Set up flow.
- **Phase-2 enhancement (optional)**: sniff file headers to pre-select the
  family in the Set up dialog — GGUF has a readable metadata header
  (`general.architecture`), safetensors has a JSON header whose tensor names
  distinguish SD1.5/SDXL/SD3/Flux. Cheap (first N KB), no full-file read.

## 5. Companion files (Flux)

- Expected **next to the model file**, with a fallback search in the models
  folder root. Two locations only — keep it simple. A flat models folder
  gives companion sharing for free (one `t5xxl_fp16.safetensors` serves every
  FLUX.1 model in the folder).
- Each companion kind accepts any of its canonical `fileNames`.
- **Preflight before generation** (and shown as a badge in the model list):
  resolve all required companions; on failure return a typed error —
  `{ code: 'missing-companion', kind, expectedNames, searchedDirs, sourceUrl }`
  — and render it as an actionable message: *"Flux.2 Klein needs
  `flux2_ae.safetensors` (VAE). Place it next to the model file or in the
  models folder. Get it here ↗"*.
- The curated data must include companion source links so the error and the
  profile card can link directly to each file.

## 6. UI — dedicated "Local AI Models" screen (D4: decided)

Promote `src/features/ai-models/` (currently orphaned) to a **top-level
sidebar screen** with its own feature flag (dev-visible; off in prod until
the sd-cli bundling story lands). The existing sub-tab structure maps
directly:

- **Main** — stays the system/engines dashboard (GPU/CUDA/RAM/disk, engine
  cards, PyTorch runtime installer, Python status — already built) and gains
  library totals (disk usage per category, model counts).
- **Audio / Image / LLMs / Embeddings** — per-library management.
- The hidden `{false && ...}` AI-models-folder block in GeneralTab is
  **deleted** (not un-hidden); folder controls live in this screen instead.

### 6.1 Usage tracking (local-only — no telemetry)

1. **Disk** (free, derived from scan): per-model file size, per-category
   totals, share of free disk. Shown on Main and per model row.
2. **Activity**: `lastUsedAt` + `useCount` per model id, recorded by each
   engine on generation/transcription/synthesis; persisted as a small map in
   the settings DB. Answers "which of these 40 GB haven't I touched?"
3. *Phase 2 candidate*: per-model performance stats (avg seconds/image on
   this hardware) to guide model choice.

### 6.2 Image models library view

Replace the download-centric `ImageModelsContent` with a library view:

- **Header**: models folder path + Change / Open folder / Rescan; sd-cli
  status.
- **Your models** (scan results): name, family badge, size, status
  (Ready / Needs N companion files / Unrecognized — Set up), Active selector,
  actions: Use, Configure, Reveal in Explorer, Delete file (confirm; actually
  deletes from disk).
- **Model library** (profiles not currently installed): name, family, size,
  **Get model ↗** (opens `sourceUrl` via `shell.openExternal`), plus
  **Download** when `downloadUrl` exists (D1: decided — hybrid). A note
  explains: "Download the file, then drop it into your models folder or use
  Import."
- **Import…** button: file picker → offer **Move** (default; instant rename
  on same volume, even for 13 GB) or **Copy** into the models folder → run
  classification → if unrecognized, family dialog → done. No
  register-in-place in v1 (D2) — users who don't want files moved point the
  models folder at their collection instead.
- **Set up dialog** (unrecognized files): family picker (pre-filled by
  header sniffing once phase 2 lands); for `flux1`, an
  "All-in-one checkpoint (includes text encoders & VAE)" toggle that clears
  companion requirements and switches to `-m` (common Civitai packaging).

## 7. Engine & IPC changes

- `ImageLocalEngine` stops importing the catalog. It receives a resolver:
  `getInstalledModels()` and `resolve(modelId) → ResolvedSdModel` (absolute
  model path, family, flags, defaults, absolute companion paths).
- `sd-cli-runner.buildArgs` takes the resolved struct — no more
  `modelsBasePath + extractedName` joining.
- `src/main/services/sdimage-library.ts` (new) owns scan / classify / import /
  sidecar IO. `sdimage-models.ts` shrinks to sd-cli binary helpers; its
  download/delete-by-id code is deleted.
- IPC: remove `SDIMAGE_MODEL_DOWNLOAD` (unless D1 hybrid); add
  `SDIMAGE_MODELS_SCAN`, `SDIMAGE_MODEL_IMPORT`, `SDIMAGE_MODEL_CONFIGURE`,
  `SDIMAGE_MODEL_REMOVE`, `SDIMAGE_OPEN_MODELS_FOLDER`.
  `SdImageModelIpc` splits into installed-model and profile shapes.
- Typed generation errors (missing model file / missing companion / sd-cli
  missing) instead of raw string messages.

## 8. Audio / whisper / LLM coexistence

Unchanged — they download from public hosts (GitHub releases, public HF) via
the shared download-manager, which also serves the whisper binary and torch
wheels. Cleanup only:

- Delete `MODELS_BASE_URL` from `src/audio-engine/model-registry.ts` and the
  relative-path fallback at `src/main/ipc/audio-handlers.ts:163`.

The unifying rule after this change: **the app only auto-downloads from
stable, public, unauthenticated hosts; everything else is user-supplied.**
(This rule is also the argument for D1-hybrid: 16 image models already meet
that bar.)

## 9. Deletions checklist

- `SD_MODELS_BASE_URL`, `downloadPath`, `archiveFormat`, `extractedName`
  (image types + registry).
- `downloadSdModel()` and archive handling in `sdimage-models.ts`.
- Audio `MODELS_BASE_URL` + fallback branch.
- The hidden `{false && ...}` AI-models-folder block in GeneralTab (folder
  controls move to the new screen). Image download UI (progress/pause/resume)
  is **kept** per D1 for profiles with a `downloadUrl`.
- Server-side (external task): retire `/api/vidtsx/models/image/*` hosting.

## 10. Out of scope (related, separate discussions)

- sd-cli binary distribution (not bundled today; same "public host or
  user-supplied" question applies to it later).
- LoRA / embedding / upscaler library management (the folder+sidecar pattern
  extends naturally if wanted).
- Catalog metadata correction pass for the broken FLUX.1 GGUF entries
  (§1 last bullet) — required before the feature ships regardless.

## 11. Decisions

| # | Question | Status |
|---|----------|--------|
| D1 | Link-only catalog vs hybrid one-click downloads | **DECIDED: hybrid.** Profiles with a stable, public, unauthenticated `downloadUrl` keep one-click download through the download-manager; the 13 formerly self-hosted entries ship link-only (upgradeable to direct URLs case by case once public equivalents are verified). Broken links are fixed via app updates (registry is compiled in). Zero owner infrastructure. |
| D2 | Folder-as-truth vs register-in-place | **DECIDED: folder-as-truth.** See §11.1. |
| D3 | Filename matching, no hashes | **DECIDED.** See §11.2. |
| D4 | Where the management UI lives | **DECIDED: dedicated top-level "Local AI Models" screen** with usage tracking (§6: disk + activity; performance stats phase 2), replacing both the Settings-tab idea and the hidden GeneralTab folder setting. |
| D5 | Split `flux` → `flux1`/`flux2` | **DECIDED.** See §11.3. |

### 11.1 D2 rationale — folder-as-truth

Register-in-place ("import" records an absolute path without moving the
file) forces a central manifest, and the manifest brings: stale entries when
files move/get deleted (reconciliation UI), a library no longer derivable
from the folder contents (two merged sources of truth), lost registrations
when the folder is moved/backed up, and duplicate identities when a
registered file is later copied in. Folder-as-truth has none of these, and
the scenario register-in-place appears to serve — "my models already live in
a ComfyUI folder" — is covered by pointing the configurable models-folder
setting at that folder (no file moves). The only uncovered case is models
scattered across multiple simultaneous locations; if it ever matters, the
clean extension is an "additional scan folders" list setting (ComfyUI's
`extra_model_paths.yaml` pattern) — more scan roots, still no per-file
registry. Phase 2 at most.

### 11.2 D3 rationale — filename matching, header sniffing later, no hashes

The scanner needs (a) profile identity — cosmetic (name, tuned defaults) —
and (b) family — load-bearing (sd-cli flags, companion requirements).
Filename matching against per-profile `matchFileNames` resolves (a)
instantly for canonically-named files; renamed files fall through to a
10-second Set up dialog. SHA-256 hashing (the Civitai/A1111 approach) is
rename-proof but requires reading entire 7–13 GB files — a first scan of a
10-model library can take minutes on slower disks — and buys only cosmetic
identity, plus a digest table to maintain per quantization. Rejected for v1;
the sidecar can grow a `sha256` field later if Civitai-API metadata lookup
is ever wanted. Header sniffing (phase 2) resolves (b) for unknown files in
kilobytes of I/O: GGUF exposes `general.architecture` in its metadata
header; safetensors exposes a JSON tensor-name index whose patterns
fingerprint the architecture (`conditioner.embedders.1.*` → SDXL,
`double_blocks.*` → Flux, …). It pre-selects the family in the Set up
dialog; the user just confirms.

### 11.3 D5 rationale — flux1/flux2 split

The two generations need different sd-cli invocations:

```
FLUX.1:  --diffusion-model X.gguf --clip_l clip_l.safetensors
         --t5xxl t5xxl_fp16.safetensors --vae ae.safetensors
FLUX.2:  --diffusion-model X.gguf --llm qwen3-4b-q4_0.gguf
         --vae flux2_ae.safetensors
```

Family presets drive companion requirements, preflight error text, and
get-this-file links for custom imports; a merged `flux` family can't express
either set, so every custom Flux import would need manual companion config —
the preset failing exactly where friction is highest. Cost of splitting is
near zero: the `SdModelFamily` union grows by one, profiles declare family
explicitly, badges show FLUX.1/FLUX.2. No migration concern (nothing
shipped; profile ids unchanged; `sdImageActiveModel` stores ids, not
families). Related nuance handled in the Set up dialog: all-in-one FLUX.1
checkpoints (bundled encoders+VAE) use `-m` with no companions — a toggle
covers this (§6.2).

## 12. Phasing (post-agreement)

1. **Library core** (§3.4): envelope types, scanner (both install-unit
   kinds), sidecars, import, usage store, runtime registry, generic IPC.
   Built category-agnostic from day one, exercised only by image in v1.
2. **Image adapter + registry rework**: profile envelopes, family presets
   (incl. flux1/flux2 split), companion data, delete base URL + relative
   download fields; keep `downloadUrl` for the 16 public-HF profiles; fix
   broken Flux metadata; rewire engine + sd-cli-runner onto the resolver;
   typed errors; `imageModelsFolder` setting.
3. **Screen**: promote `ai-models` feature to top-level sidebar screen with
   feature flag; new Image models library view; usage tracking (disk +
   activity); Main dashboard engine cards read the runtime registry; delete
   hidden GeneralTab block.
4. **Cleanup**: audio base-URL removal; delete dead download paths; update
   STATUS.md / memory.
5. **Later batch (post-release, optional)**: adapt audio/LLM/embedding
   categories onto the core (descriptors + envelope mapping; their download
   flows already comply with the D1 rule); video and other future
   categories arrive as new descriptors.

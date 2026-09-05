# AI Runtime — implementation plan (background removal + 3D Studio)

> **Status: Stages 1–4 BUILT (2026-09-05); Stage 5 next.** Stage 0 of `docs/local-python-runtime-plan.md` passed (GO).
> This document is the **step-by-step build plan** for putting the downloadable Python runtime
> into the app with its first two models. It **replaces Stages 1–5** of the runtime plan; the
> design (§0–§2), the Stage 0 record (§3.4) and the risks (§10) there still apply.
> Model facts: `docs/local-3d-models-research.md`. Lab evidence: `C:\Users\Malak\Documents\ai-runtime-lab\RESULTS.md`.

## 0. What we are building, in one paragraph

An **optional, downloadable AI runtime** (a relocatable Python + PyTorch folder, one per app
version, hosted on our R2 bucket: 2.6 GB for NVIDIA cards, 334 MB for everyone else) that the app
installs on first use through the existing download engine. On top of it, curated Python models,
each = **weights downloaded from the original Hugging Face repo + a small runner script shipped
inside the app**. Nothing heavy is packaged in the installer. First two models:

| Model | Where the user meets it | Licence | Download | Runs on |
|---|---|---|---|---|
| **Background removal** (rembg, u2net → better ISNet/BiRefNet later) | Image Studio: "Remove background" on any image; Studio agent tool later | MIT / Apache | runtime + 176 MB model | CPU (1–4 s), no GPU needed |
| **Image → 3D** (TripoSR) | New **3D Studio** screen; catalogue in the AI Models "3D" tab | MIT | runtime + 1.6 GB weights + 3 small companions | GPU 30–35 s (4 GB card OK) / CPU ~1 min |

Decisions taken with Hasan on 2026-09-04:

1. **Background removal goes into Image Studio**, not a separate screen. It is an action on existing
   images (and on any dropped image), producing a new PNG with transparency next to the original.
2. **3D gets its own simple "3D Studio" screen**, built by copying the Video Studio skeleton
   (input → generate → gallery), with a GLB viewer. The AI Models "3D" tab only holds the catalogue
   (runtime status, model download), exactly like the Image tab vs Image Studio split today.
3. **Models are organised by what the user gets, not by technology.** No "Python models" tab.
   Runtime-backed models simply carry a "needs AI runtime" badge in their category.
4. **Curated, not open-ended.** A model ships only if: permissive licence, no custom compiled
   CUDA/C++ code, pins fit the one shared runtime version. Each new model ≈ one session.
5. **Ship in V1 if the schedule holds** (≈ 6 sessions, see §8). The feature is fully optional and
   flag-gated, so it cannot destabilise the release.

## 1. Architecture at a glance

```
resources/pipelines/                     ← shipped in the installer (KB, not GB)
  common/protocol.py                     JSON-lines protocol, error codes
  rembg/runner.py                        image → PNG with alpha
  triposr/runner.py + tsr/ + LICENSE     image → GLB (vendored, patched: skimage MC, local DINO cfg, ViT key remap)

{userData}/ai-runtime/<version>-<variant>/   ← downloaded from R2 (cu126 | cpu), manifest.json + python/
{userData}/ai-models/...                     ← weights + companions, sha256-verified (existing model store)

src/main/services/ai-runtime/            install/status/paths/catalogue (copies sdcli-install.ts + runtime-registry)
src/local-python-engine/                 generic worker client: spawn runner.py, parse JSON lines, taskkill tree,
                                         classify failures, serial queue (copies local-image-engine/)
src/main/services/python-models/         model catalogue (rembg + triposr profiles, companions, sha256), downloads
src/features/image-studio/               + "Remove background" action
src/features/threed-studio/              NEW screen (copy of video-studio) + GlbViewer
src/features/ai-models/                  System tab row "AI Runtime"; 3D tab catalogue; "needs runtime" badge
```

Worker protocol (normative, already implemented and tested in the lab):

```
python.exe <pipeline>/runner.py --request <tmp.json>        (or --selftest)
stdout JSON lines:
  {"type":"ready","torch":"2.14.0+cu126","cuda":true,"device":"NVIDIA …","vramMb":4095}
  {"type":"stage","name":"load-model"}  …  {"type":"progress","stage":"shape","pct":42}
  {"type":"result","outputPath":"…","stats":{…}}
  {"type":"error","code":"oom|cuda-mismatch|import|weights-corrupt|cancelled|bad-request|unknown","message":"…"}
stderr = raw log tail.  Cancel = taskkill /PID <pid> /T /F (measured: tree gone < 1.1 s, 0 orphans).
```

## 2. Stage 1 — Build tooling (repo scripts only, no app behaviour) — ~1 session

Goal: a repeatable, verified way to produce the two runtime zips and their catalogue entries.

1. **`scripts/ai-runtime/requirements.in`** — from the lab, minus `torchvision`, plus
   `moderngl`, `glcontext` (texture baking later, no stack bump). Lock both variants:
   `requirements.cu126.lock`, `requirements.cpu.lock` (`uv pip compile --generate-hashes
   --emit-index-url --index-strategy unsafe-best-match`, extra index `whl/cu126` or `whl/cpu`).
2. **`scripts/ai-runtime/build-stack.ps1 <variant> <version>`**:
   - `uv python install 3.11` → copy the standalone interpreter → **delete `Lib\EXTERNALLY-MANAGED`**
     (Stage 0 gotcha 1) → `uv pip sync <lock> --python … --index-strategy unsafe-best-match`.
   - **Prune:** `torch\include` (64 MB), `torch\lib\*.lib` (47 MB), `*/tests`, `__pycache__`;
     **flatten** every `*.dist-info\licenses\**` into `licenses\<package>\` (path depth: the deepest
     relative path drops from 152 to ~120 chars).
   - Write `manifest.json`: `{ version, variant, python, torch, cuda, minDriver, lockSha256,
     maxRelativePathLength, bytesOnDisk, files }`.
   - Zip (deflate, zip64) → sha256 → print the TypeScript catalogue entry to paste.
   - Also `--selftest` the built folder in place before zipping.
3. **`scripts/ai-runtime/verify-stack.mjs <zip>`** — extract to a temp dir with `unzipper`
   (same call as `download-extract.ts`), run `runner.py --selftest` for both pipelines, delete.
4. **`resources/pipelines/`** — move `protocol.py`, `triposr/` (runner, `tsr/`, LICENSE) from the lab;
   write `rembg/runner.py` (see §4). `electron-builder.yml`: add `resources/pipelines` to
   `extraResources`; **remove the two `resources/python` entries** (`electron-builder.yml:147`, `:179`).
5. **R2:** create the bucket + custom domain; `scripts/ai-runtime/upload-r2.ps1` (rclone). Upload
   `2026.09.1-cu126.zip` and `2026.09.1-cpu.zip`. Record URLs + sha256 + bytes.
6. **README.md** in `scripts/ai-runtime/`: release procedure (bump version → build both → verify →
   upload → paste catalogue entries → `npm run check:links`).
7. Tests: none needed beyond `verify-stack.mjs` (it *is* the test). Type gate unchanged.

Done when: both zips are on R2, `verify-stack.mjs` passes on a clean machine profile (or a fresh
temp dir here), and the catalogue entries exist in code but are unused.

## 3. Stage 2 — Runtime service + System tab row — ~1 session

Goal: the user can install, update, repair and remove the runtime from the System tab. No model yet.

1. **`src/main/services/ai-runtime/catalogue.ts`** — `AI_RUNTIME_CATALOGUE`: for each variant
   `{ version: '2026.09.1', variant: 'cu126'|'cpu', urls: [r2Url, hfMirrorLater?], sha256, bytes,
   bytesOnDisk, extractedDir: 'python', minDriver: '525.60', maxRelativePathLength, licence }`.
   Invariant tests (https, sha256 shape, bytes > 0) + a `.links.test.ts` picked up by `check:links`
   (widen the vitest filename filter in `package.json` from `model-registry.links` to `*.links`).
2. **`paths.ts`** — `getAiRuntimeRoot()` = `{userData}/ai-runtime`, `getAiRuntimeDir(version, variant)`,
   `getAiRuntimePython(...)` = `…/python/python.exe`. Uses `path.join`; never hardcoded.
3. **`install.ts`** — copy of `sdcli-install.ts`: inflight-promise guard, one `enqueueDownload({ id:
   'ai-runtime-<variant>', url, destPath, sha256, extraction: { format: 'zip', destDir, deleteArchive:
   true }, metadata: { type: 'ai-runtime', variant, version } })`, then **verify** = read
   `manifest.json`, run `runner.py --selftest` (expect `ready`), then a **warm-up import** (Stage 0:
   first launch on fresh files is 30 s selftest + ~100 s imports because of Defender — do it here,
   not on the user's first generation). Remove older versions after success. Atomic reveal via
   `finalizePath` on the extracted dir.
4. **Preflight** (`preflight.ts`): `detectGpu()` → NVIDIA + driver ≥ floor + VRAM ≥ 4 GB → `cu126`,
   else `cpu`; **path-length guard**: refuse when `len(root) + maxRelativePathLength + 1 > 259`
   unless `LongPathsEnabled = 1` (message names the setting); disk guard = `bytes + bytesOnDisk`.
   The user can override to the CPU variant ("smaller download") from the row.
5. **`status.ts`** — `installed | update-available | missing | installing | broken` + disk usage;
   `register.ts` → `registerRuntime({ id: 'pytorch', kind: 'python-runtime', isAvailable, install })`
   — the first runtime that actually exercises `RuntimeStatus.installable`.
6. **Download engine:** mirror fallback — on a non-resumable failure try the next URL in `urls[]`
   (small change in `download-engine.ts`, unit-tested with a mocked fetch).
7. **IPC:** `AI_RUNTIME_STATUS`, `AI_RUNTIME_INSTALL`, `AI_RUNTIME_REPAIR`, `AI_RUNTIME_REMOVE`
   (`'ai-runtime:status'` …) in `channels.ts` + `types.ts`; handler `ai-runtime-handlers.ts`;
   registration `registrations/ai-runtime.ts`; preload `src/preload/api/ai-runtime.ts`. Progress
   comes through the existing `DOWNLOAD_PROGRESS` broadcast filtered by `metadata.type`.
8. **System tab** (`MainContent.tsx`, behind `ai-system-runtimes`): replace the PyTorch row + Python
   panel with one **"AI Runtime"** row: variant label (GPU / CPU), size, status, Install / Update /
   Repair / Remove, `DownloadCell` progress, "What is this?" tooltip (one sentence + licence link).
9. **Retire the old Python flow** (exact spots from the survey): `getPythonDir/ExePath/PackagesDir`
   (`paths.ts:126-143`), `detectPython/detectPyTorch` (`system-info.ts:100-180`, drop `cachedWheels`),
   `PYTORCH_PIP_INSTALL` (`channels.ts:297`, `system-info-handlers.ts`, `registrations/system.ts`,
   `preload/api/system.ts`, its request/response types), renderer `PyTorchDownloadState` +
   wheel URLs + `pytorchInstall/Pause/Resume/Cancel` in `use-system-info.ts:122-128`, and the
   `resources/python/` folder itself.
10. **Foundation fixes** while here: sha256 on whisper and SD model downloads; whisper binary onto
    the download engine (both already noted in the runtime plan §5).
11. Tests: catalogue invariants + links; install idempotence with a mocked engine (second call while
    inflight returns the same promise); status transitions on manifest version mismatch; preflight
    path-length and variant selection (pure functions); mirror fallback.

Done when: on this box, System tab → Install downloads 2.6 GB, shows progress, verifies, and the row
says "Installed · GPU · 2026.09.1"; Repair re-extracts; Remove deletes; with
`CUDA_VISIBLE_DEVICES=-1` the CPU variant is offered.

## 4. Stage 3 — Worker client + background removal in Image Studio — ~1–1.5 sessions

Goal: first user-visible value, on the simplest model, CPU-only, no viewer needed.

1. **`src/local-python-engine/`** (mirror of `local-image-engine/`):
   - `types.ts` — request/result/event types shared with the pipelines.
   - `python-runner.ts` — `runPipeline({ python, runnerPath, request, onEvent })`: write the request
     JSON to a temp file, `spawn` with `windowsHide`, env `HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
     PYTHONUTF8=1` (+ `CUDA_VISIBLE_DEVICES=-1` for forced CPU — **never** the empty string, Win32
     drops it), JSON-lines parser tolerant of partial chunks, stderr ring buffer, `killActive()` =
     `taskkill /PID /T /F`, exit-code mapping (`0xC0000106` → "path too long" error).
   - `python-failure.ts` — `classifyPythonFailure()` in the `classifySdCliFailure` mould: maps protocol
     error codes + spawn failures to `PythonFailureCode` and human messages; raw tail kept for Details.
   - `python-engine.ts` — `PythonLocalEngine` singleton with the serial queue (`image-engine.ts` shape),
     `onProgress/onComplete/onError`, initialised lazily via `lazily(ensurePythonEngine, …)`.
   - Tests: parser fixtures for every event type + malformed/partial lines; `mock-runner.mjs` that
     emits a scripted event stream so order/cancel/error tests run **without Python** in CI;
     classifier table test; `buildRequest()` pure-function test.
2. **`src/main/services/python-models/`**:
   - `registry.ts` — `PYTHON_MODEL_CATALOG`: profiles `{ id, category, label, runtime: { id: 'pytorch',
     stack: '2026.09' }, files: [{ url, sha256, bytes, dest }], companions: [...], licence, vramMb,
     cpuOk }`. Entries: `rembg-u2net` (u2net.onnx 175,997,641 B, sha256 8d10d2f3…, dest
     `rembg/models/u2net/u2net.onnx`), later `rembg-isnet`/`birefnet`; `triposr` (model.ckpt
     1,677,246,742 B sha256 429e2c6b…, config.yaml, dino config.json, + the u2net companion).
   - `download.ts` — `downloadPythonModel(id, onProgress)` in the `sdvideo-download.ts` shape:
     per-file `.part` + `finalizePath` + sha256, `metadata: { type: 'python-model', modelId, fileLabel,
     fileStep }`.
   - `status.ts` — installed / missing files / `missing-runtime` / runtime version mismatch
     (`update-runtime` action).
   - Tests: catalogue invariants + `.links.test.ts`; companion resolution.
3. **`resources/pipelines/rembg/runner.py`** — protocol events `ready → stage load-model → stage
   process → stage export → result { outputPath, stats: { width, height, seconds } }`; request
   `{ imagePath, outputPath, rembgHome, model: 'u2net' | 'isnet-general-use' | …, device }`; output is
   RGBA PNG (optionally also the matte). Runs on CPU via onnxruntime; GPU not needed.
4. **IPC:** `PYMODEL_STATUS`, `PYMODEL_DOWNLOAD`, `PYMODEL_CANCEL_DOWNLOAD`, and the generation family
   on-convention: `REMBG_RUN`, `REMBG_PROGRESS`, `REMBG_COMPLETE`, `REMBG_ERROR`, `REMBG_CANCEL`.
   Handlers `python-models-handlers.ts`, `rembg-handlers.ts`; preload `python-models.ts`, `rembg.ts`.
5. **Image Studio:**
   - `ImageCard.tsx` / `ImageLightbox.tsx`: new action **"Remove background"**. Also available for a
     dropped/uploaded image in `ImageInput.tsx` (writes into the current folder).
   - First click when runtime/model is missing → one dialog: "Background removal runs on your
     computer. Download the AI runtime (334 MB / 2.6 GB) and the model (176 MB)?" → Install with
     progress (reuses `DownloadCell`), then runs. Store the result as a new image in the same folder
     via `image-studio-files.ts` (`<name>-nobg.png`), recorded in `image-studio-db.ts` with a
     `derivedFrom` field so the gallery can show the link.
   - Hook `useRemoveBackground.ts` → service; no business logic in components.
   - Progress: stages "Preparing runtime" (first launch only) → "Removing background" with cancel;
     `ErrorBanner` with the classified message and expandable raw tail.
6. **AI Models Image tab:** add an **"Image tools"** section listing the rembg model(s) with size,
   licence and the "needs AI runtime" badge (`missing-runtime` issue rendered for the first time in
   `InstalledModelsList.tsx`), Download / Remove. Behind the existing `ai-system-runtimes` flag
   until Stage 5.
7. Manual E2E on this box: GPU box with runtime installed; then with the runtime removed (dialog
   flow); then `CUDA_VISIBLE_DEVICES=-1` (CPU variant path); cancel mid-run; corrupt model file.

Done when: a user with no runtime can go from a photo in Image Studio to a transparent PNG with two
clicks and one download, and every failure shows a readable message.

## 5. Stage 4 — 3D catalogue + 3D Studio + viewer — ~2 sessions

Goal: image → 3D object, viewable in-app, saved where the user expects.

1. **Category:** add `'3d'` to `ModelCategory` (`src/shared/model-library/types.ts:15`); register a
   `'3d'` category adapter (`category-registry.ts`) backed by `python-models/registry.ts`; add `'3d'`
   to `RENDERED_TABS` in `AiModelsTab.tsx` behind the existing `ai-3d-models` flag.
2. **3D tab** (`ThreeDModelsContent.tsx`, replaces `ComingSoonPlaceholder`): runtime status card at the
   top (view over the runtime registry, Install / Update); catalogue list with **licence badge**
   (MIT quiet), **VRAM fit badge** (`evaluateFit`; TripoSR floor 4 GB GPU, `cpuOk: true`), runtime
   chip, Download (weights + companions with `fileStep` progress) / Remove. "Download model +
   install runtime" combined flow when the runtime is missing.
3. **3D Studio screen** (`src/features/threed-studio/`, copied from `video-studio/`):
   - Files: `ThreeDStudioScreen.tsx`, `ControlPanel.tsx` (image drop-zone with file picker + "from
     Image Studio" picker, quality = mc-resolution **capped by VRAM** (256 on ≤ 4 GB; 512 offered
     only ≥ 8 GB), background-removal toggle (on by default, reuses the rembg session inside the
     runner), seed), `ModelGallery.tsx` + `ModelCard.tsx` (thumbnail = the NeRF view-0 render the
     runner already produces), `GlbViewer.tsx` (drei `<Canvas>` + `useGLTF` + `OrbitControls` +
     `Stage`, wireframe/background toggles — the first in-app three.js consumer; `three`, fiber,
     drei are already direct deps), lightbox with the viewer.
   - Storage: `threed-studio-files.ts` → `{userData}/threed-studio/models/<id>/{mesh.glb,
     input.png, preview.png, request.json}`; `threed-studio-db.ts` mirroring `video-studio`.
   - Hooks: `useThreeDGeneration.ts`, `useThreeDGallery.ts`; service `threed-request.ts`.
   - Staged progress: Preparing runtime (first launch) → Loading model → Preparing image →
     Shape (percent from the runner's slab progress) → Export; cancel at any point.
   - Actions: **Save to asset library** (new bridge: `reserveLibraryFile()` under `generated/3d/` +
     copy; the library already classifies `.glb` as `model3d`), Save As, Open folder, Regenerate
     (same / new seed), Delete.
4. **IPC:** `SD3D_GENERATE`, `SD3D_GENERATE_PROGRESS`, `SD3D_GENERATE_COMPLETE`, `SD3D_GENERATE_ERROR`,
   `SD3D_CANCEL`, plus `THREED_STUDIO_SAVE/READ/DELETE/LIST` mirroring `VIDEO_STUDIO_*`.
5. **Sidebar/routes:** add the 3D Studio screen to `routes.tsx` and `Sidebar.tsx` behind a new
   `threed-studio` flag (`FEATURE_FLAGS`), dev-visible.
6. **Asset library preview:** reuse `GlbViewer` for `model3d` tiles (`AssetTile.tsx:38` currently
   shows a cube icon) — small, optional in this stage.
7. **Composition integration (optional, last):** "Library meshes" section in
   `src/shared/tsx-engine/prompts/generate-3d-prompt.ts` so generated TSX can reference saved GLBs
   (the bundler already allowlists `.glb`).
8. Tests: 3D catalogue invariants + links; request builder; gallery reducer; viewer smoke (render
   without crashing, jsdom skip if WebGL missing).
9. Manual E2E on this box: the four lab images (chair, robot, plush photo, red-left probe) end to
   end through the UI; cancel; CPU path; runtime removed mid-way.

Done when: drop a photo → object appears in the viewer in ~35 s on this box → Save to library →
the file shows up in the Assets screen.

## 6. Stage 5 — Hardening and release — ~1 session

1. Preflight and guards end to end (path length, disk, driver floor, VRAM cap on resolution).
2. Runtime **update** path: bump to a fake `2026.09.2` locally → rows show "Update runtime" → old
   version removed after success. Repair (re-extract) and Remove (runtime only vs runtime + models).
3. Error matrix walked through the UI: corrupt weights, OOM, missing package (Repair prompt), path
   too long, runtime removed while a job is queued, cancel at every stage. Messages copy-checked.
4. One rented Windows GPU VM (`docs/gpu-cloud-testing-plan.md`, 8–12 GB card): install, both
   models, `mc 512`, and the update path. This is also the box for validating model #3.
5. Flags: `ai-system-runtimes`, `ai-3d-models`, `threed-studio` → on for release; the Image Studio
   "Remove background" action ships un-flagged once Stage 3 E2E passes.
6. `STATUS.md`, `V1_RELEASE_PLAN.md` (feature row + the "optional 2.6 GB download" wording for the
   release notes), progress log in this doc, memory note.

## 7. Cross-cutting rules (from Stage 0 evidence)

- **Offline by construction:** every file a pipeline touches is declared in the catalogue and
  fetched up front; the runner sets `HF_HUB_OFFLINE`/`TRANSFORMERS_OFFLINE`. A `ConnectionError` in
  a worker is an app bug (undeclared companion), surfaced as such.
- **`ready` before imports:** the runner emits `ready` after `import torch` (~3 s warm) but the
  pipeline imports follow (~4 s warm / ~100 s first launch). The UI shows "Preparing runtime…" until
  the first `stage` event. (Alternative: add `stage: "import"` to the protocol — decide in Stage 3.)
- **Timings to put on cards:** GPU ~35 s per object, CPU ~1 min; background removal 1–4 s.
- **VRAM cap:** never offer a resolution the card cannot hold; 1024 on 4 GB runs 5 min then fails.
- **Never re-host weights;** R2 holds only the runtime zips. Store sha256 + bytes for every file.
- **One runtime version live per app version;** a model needing new pins goes into the *next*
  runtime version, never a per-model install.
- **CI never needs Python:** all engine tests run against `mock-runner.mjs`.

## 7b. Calling the models from anywhere else (agents, Flows, Studio, TSX)

Added 2026-09-04 after Hasan asked whether other parts of the app can call these models. The
answer is **yes by design, but only if the service layer is built first and the UI screens sit on
top of it** — not the other way round. Rules:

1. **One main-process service is the only entry point:** `src/main/services/python-models/service.ts`

   ```ts
   runPythonModel(req: {
     modelId: 'rembg-u2net' | 'triposr' | …;      // catalogue id
     input: { imagePath: string; … };            // per-model input, typed by the catalogue
     options?: Record<string, unknown>;          // per-model options, validated by the catalogue's zod schema
     outputDir: string;                          // caller decides where the result lands
     signal?: AbortSignal;                       // cancel = taskkill the tree
     onProgress?: (e: { stage: string; pct?: number; message?: string }) => void;
   }): Promise<{ outputPath: string; stats: Record<string, unknown> }>
   ```
   IPC handlers (Image Studio, 3D Studio), Studio agent tools, Flows nodes and Agents all call this
   function. It owns the queue (one GPU, jobs serialised across every caller), the runtime/model
   preflight, and the failure classification. Nothing else spawns Python.
2. **Structured "not ready" results, not thrown strings:** `preflightPythonModel(modelId)` returns
   `{ ready: true } | { ready: false; reason: 'runtime-missing' | 'runtime-update' | 'model-missing' |
   'path-too-long' | 'disk'; action: { label; install(): Promise<void> } }` so a screen can show a
   dialog, an agent can `ask_user("Install the AI runtime (334 MB)?")`, and a flow can fail the run
   with a clickable fix.
3. **Declarative capability descriptors in the catalogue** (`registry.ts`), one per model:
   `{ inputs: [{ kind: 'image' }], outputs: [{ kind: 'image' | 'model3d' }], options: ZodRawShape,
   description, needs: 'ai-runtime', estimatedSeconds: { gpu, cpu } }`. This is what lets the agents
   tool registry and the Flows node catalogue register the models **automatically** — the same
   descriptor becomes an `AgentToolDef` (id, description, schema, `needs`) and a flow node
   (`ports` from inputs/outputs). New model = new descriptor + runner script; no UI or tool code.
4. **Wave-1 tools/nodes this plan adds** (fitting the tables in `docs/agents-plan.md` §1.3 and
   `docs/flows-plan.md` §1.2):

   | toolId | ports in → out | source |
   |---|---|---|
   | `remove_background` | image → image | `runPythonModel('rembg-u2net')`, artifact `image` |
   | `generate_3d` | image → model3d | `runPythonModel('triposr')`, artifact `model3d` (new artifact kind: GLB + preview PNG) |

   `save_to_library` already accepts any artifact, so a flow can go photo → remove background →
   generate 3D → save. The Studio agent gets `remove_background` in its tool set (the plush-on-a-
   chair thumbnail case); `generate_3d` is agent-callable but gated by `needs: 'ai-runtime'`.
5. **Outputs are files with a small JSON sidecar** (`<name>.json`: modelId, options, stats, source
   image) written by the service, so every consumer, including the asset library's describe/organise
   features, can read provenance without touching the engine.
6. **TSX compositions** reach the results only through the asset library (saved GLBs / PNGs), never
   by calling the runtime — a render must stay deterministic and offline. The "Library meshes"
   prompt section (Stage 4 step 7) is the bridge.
7. **Persistent worker later, same contract:** if cold start matters for agents chaining several
   calls, the service can keep one warm worker per model behind the same `runPythonModel` signature
   (the protocol already allows a stdin-driven loop). Not in V1.

Changes this makes to the stages above: Stage 3 step 2 gains `service.ts` + `preflight` + the
capability descriptors **before** the Image Studio button is wired (the button is the first caller,
not the owner); Stage 3 step 6 registers `remove_background` as a Studio agent tool; Stage 4 gains
the `model3d` artifact kind, `generate_3d`, and the two flow nodes once the Flows runner exists.
Tests: the service is exercised through `mock-runner.mjs`; descriptors get an invariant test (every
model has inputs/outputs/options and a licence).

## 8. Schedule and order of value

| Stage | Sessions | User sees |
|---|---|---|
| 1 Build tooling + R2 | 1 | nothing (zips on R2) |
| 2 Runtime service + System row | 1 | "AI Runtime" row: install/repair/remove |
| 3 Worker client + rembg in Image Studio | 1–1.5 | **Remove background** in Image Studio |
| 4 3D catalogue + 3D Studio + viewer | 2 | **3D Studio** end to end |
| 5 Hardening + GPU VM + release | 1 | shipped |
| **Total** | **≈ 6–6.5** | |

Model #3 afterwards (≈ 1 session each, no infrastructure change): image upscaling (Real-ESRGAN,
plain PyTorch) or depth estimation (Depth Anything, enables parallax moves on stills) — both fit
the shared runtime; TripoSG / Hunyuan3D-2mini need the 8 GB VM to validate.

## 9. Open decisions (small; defaults chosen, change if you disagree)

1. **Variant choice UI:** auto-pick by GPU, with a "Use the smaller CPU-only runtime (334 MB)" link
   on the row. Default: yes.
2. **Where rembg models appear in the catalogue:** an "Image tools" section inside the Image tab
   (default) vs its own category tab. Default: section.
3. **Better background-removal model at launch:** ship `u2net` (tested) and add `isnet-general-use`
   as a second catalogue entry after a quality check in Stage 3. Default: both if the check passes.
4. **Texture baking in 3D Studio:** off in V1 (vertex colours); wheels stay in the runtime so it can
   be switched on later without a new download.
5. **Runtime version name:** `2026.09.1`.

## 10. Progress log

- 2026-09-04 — plan written after Stage 0 GO. Nothing built yet.
- 2026-09-04 — §7b added: shared `runPythonModel` service + capability descriptors so agents, Flows and Studio call the same models; `remove_background` / `generate_3d` tools and nodes.
- 2026-09-04 — **Stage 1 in progress** (build tooling; no `src/` changes). Commits so far: locks (`f1454c8`), pipelines
  (`bbf8631`), electron-builder (`2190c09`).
  - `scripts/ai-runtime/`: `requirements.in` (lab list − torchvision + moderngl 5.12.0 + glcontext 3.0.0),
    `compile-locks.ps1` → `requirements.cu126.lock` / `requirements.cpu.lock` (65 packages each, pinned to
    cp311 / x86_64-pc-windows-msvc, `--generate-hashes --emit-index-url --index-strategy unsafe-best-match`;
    3.6 s per lock from uv's cache). Pin diff vs the lab locks: exactly −torchvision, +glcontext, +moderngl.
    Lock sha256 (LF-normalised): cu126 `b6249d70…0ab4`, cpu `b50c2c46…07ce`.
  - `resources/pipelines/`: `common/protocol.py` (+ `network` error code, MUST-change #5), `triposr/` byte-identical
    to the lab (runner, patched `tsr/`, LICENSE), new `rembg/runner.py` (ready → load-model → process → export,
    RGBA PNG + optional matte, onnxruntime CPU, **no torch import**; `ready.torch` is `null`). Measured on the lab
    cpu stack: 12 MP `busy.jpg` → RGBA PNG in 8.0 s total (load-model 1.13 s, process 1.74 s, export 0.64 s,
    imports 4.5 s contended); missing input → `bad-request`, missing `u2net.onnx` → `weights-corrupt` (no download).
  - `electron-builder.yml`: `resources/pipelines` → `pipelines` in the shared `extraResources`; both `resources/python`
    entries removed (the folder itself goes in Stage 2 step 9).
  - `build-stack.ps1` findings: (a) `uv pip sync` **keeps the interpreter's seed pip** (the lab note "sync removes pip" was
    wrong) → the script runs `uv pip uninstall pip` and asserts dist-info count == lock count (65); (b) a fresh sync has
    **no `__pycache__`** (uv does not compile bytecode; the prune is a safety net); (c) `antlr4-python3-runtime` is an
    sdist uv builds in seconds — no `--only-binary`; (d) the deepest path after flattening is a *transformers* module
    (126 chars), so the install-root budget on default Windows is **132 chars** (`259 − 126 − 1`); app root ≈ 75.
  - **cu126 build (this box, uv cache warm): 405 s total** — copy 8.4 s, sync 16 s, prune 10 s (include 40.2 MB,
    .lib 46.0 MB, 151 `tests` dirs 42.5 MB), flatten 1.8 s (52 licence trees + 10 root-level files → `licenses/`),
    selftest 58.6 s (triposr ready 5.9 s cuda=true 4095 MB; **rembg ready 52.6 s on first launch of fresh
    onnxruntime files — Defender**), manifest 1.5 s, **zip 291 s**, sha256 9.4 s.
    Result: **14,218 files, 4,613,287,893 B on disk → `2026.09.1-cu126.zip` 2,758,592,573 B (2.57 GiB), sha256
    `8a8fe1f4e776b328df01df2f3459e251f400f6161e0a6c5dad8a259446b46359`**, torch 2.14.0+cu126, CUDA 12.6,
    python 3.11.15 (python-build-standalone 20260807), maxRelativePathLength 126. (Lab, unpruned: 2.64 GiB / 4.86 GB / 31k files.)
  - **cu126 `verify-stack.mjs` PASS (13/13)**: sha256 9.3 s, **unzipper extract 67.3 s** (app's exact call), file count /
    bytes / deepest path == manifest, temp root 58 ≤ 132 budget, triposr selftest **32.9 s on first launch of the
    extracted files** (cuda=true, 4095 MB), rembg selftest **61.4 s** (Defender first-read of onnxruntime + numba/llvmlite
    → Stage 2 must warm both pipelines in the install "verify" step, not just triposr), `ready.torch == manifest.torch`,
    temp dir removed.
  - **R2: not uploaded this session** — no rclone / wrangler / R2 credentials exist on this box (checked PATH, `%APPDATA%\rclone`,
    `%USERPROFILE%\.wrangler`, `AWS_*`/`R2_*`/`CLOUDFLARE_*` env). `scripts/ai-runtime/upload-r2.ps1` (rclone, multipart —
    wrangler's `r2 object put` cannot take a 2.6 GB object) is written; the README header lists the one-time
    `rclone config create r2 s3 provider=Cloudflare …` step. Catalogue URLs are printed with the placeholder
    `https://R2_PUBLIC_BASE_URL` at build time; Hasan supplied the custom domain **https://cdn.vidtsx.com** (bucket `vidtsx-cdn`) on 2026-09-05 and it became the scripts’ default.
  - **cpu build: 252 s total** — copy 4.6 s, sync 21.6 s, prune 11.7 s (include 40.2 MB, .lib 44.1 MB, 151 `tests` dirs
    42.5 MB), flatten 2.2 s, selftest 65.9 s (triposr 4.0 s cuda=false; rembg 61.7 s first launch), **zip 127 s**, sha256 0.9 s.
    Result: **14,190 files, 899,222,488 B on disk → `2026.09.1-cpu.zip` 279,969,216 B (267 MiB), sha256
    `4268ccfd3062f18474e81de185fa8a20598adf423c52e7a193c223da860895c1`**, torch 2.14.0+cpu, cuda null, minDriver null,
    maxRelativePathLength 126 (same deepest transformers file). (Lab, unpruned: 334 MB / 1.13 GB / 31k files.)
    Both variants together: **≈ 11 min of build + ≈ 5 min of verify** on this box with a warm uv cache.
  - **cpu `verify-stack.mjs` PASS (13/13)**: sha256 1.0 s, unzipper extract 17.9 s, counts/bytes/deepest == manifest,
    triposr selftest 14.6 s first launch (cuda=false), rembg 61.6 s first launch, `ready.torch == manifest.torch`.
  - **Stage 1 status: DONE except the R2 upload** (blocked on credentials, see above). Catalogue entries for both variants
    are in `.vidtsx-temp/ai-runtime/2026.09.1-{cu126,cpu}.catalogue.ts` (placeholder base URL) and in the session
    report; they enter code in Stage 2 (`catalogue.ts`). Next: Stage 2 (§3).
- 2026-09-05 — **R2 upload.** Hasan created bucket `vidtsx-cdn` (custom domain **https://cdn.vidtsx.com**) and put a read-write
  and a read-only S3 key pair in the git-ignored `.env` (`R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID_RW`/`_R`,
  `R2_SECRET_ACCESS_KEY_RW`/`_R`). `upload-r2.ps1` now reads `.env`, defines the rclone remote through process-local
  `RCLONE_CONFIG_R2_*` variables (no config file with secrets), and fetches a portable rclone 1.75.1 into
  `%LOCALAPPDATA%\vidtsx-tools\rclone\` when none is on PATH. Bucket-scoped tokens cannot `ListBuckets` (403 on `lsd r2:`),
  so the preflight lists inside the bucket. The read-only key is for checks only — the app never carries a key; the
  bucket is public through the custom domain.
  - Attempt 1 (4 × 64 MB parts, rclone defaults): **failed at 43 % after 12 min** — a ~20 s outage made the S3 SDK report
    `failed to get rate limit token, retry quota exceeded` (StatusCode 0) and each of rclone's 3 whole-file retries
    restarted from zero within seconds. Upload speed here is ~2 MB/s (cu126 ≈ 22 min).
  - Attempt 2 flags: `--s3-chunk-size 32M --s3-upload-concurrency 1 --low-level-retries 60 --retries 6 --retries-sleep 30s
    --timeout 5m --contimeout 1m`, cpu variant first.
  - Attempt 2: **cpu uploaded in 183 s, remote size verified, public URL live** (`https://cdn.vidtsx.com/ai-runtime/2026.09.1-cpu.zip`
    → 200, Content-Length 279,969,216; `.sha256` sidecar readable). cu126 upload in progress at ~2 MB/s with per-part retries
    absorbing the blips (rclone's counter passed 100 % because retried parts are counted twice; no whole-file restart).
  - **cu126 uploaded: 2,815.9 s (47 min, 0.9 MB/s effective incl. retried parts), remote size verified, public URL live**
    (`https://cdn.vidtsx.com/ai-runtime/2026.09.1-cu126.zip` → 200, Content-Length 2,758,592,573). **Both runtimes are on R2.**
    The `-CheckReadOnly` probe crashed on a PS 5.1 quirk (`2>$null` on a native command under `$ErrorActionPreference='Stop'`
    → NativeCommandError) after the read-only key had successfully listed 6 objects; fixed (`-q`, no redirect) and re-run below.
  - Re-run with `-SkipUpload -CheckReadOnly`: both remote sizes verified, both public URLs HEAD 200 with matching Content-Length,
    read-only key lists the 6 objects and gets **403 AccessDenied on PutObject** — permissions are as intended. `upload-r2.ps1`
    gained `-SkipUpload` for exactly this re-check.
- 2026-09-05 — **Stage 2 built while the upload ran** (Hasan: "can't we continue building while uploading?"). Four pathspec
  commits: `18c4855` download-engine `mirrors[]` fallback (+2 tests); `ae63347` `src/main/services/ai-runtime/` (catalogue with both
  entries, manifest reader, pure preflight — variant by driver ≥ 525.60 + VRAM ≥ 4 GB, path budget 259 − maxRel − 1, disk = zip +
  extracted + 5 % —, nvidia-smi facts incl. driver, selftest/warm-up spawner mapping `0xC0000106` → path-too-long, install with
  inflight guard → engine task into `<name>.tmp` → manifest check → both selftests → `triposr --warmup` → atomic rename → old
  versions removed, repair, remove, status state machine, `registerRuntime('pytorch', kind 'python-runtime')`; runners gain
  `--warmup` and the request path emits `stage: "import"` — MUST-change #6 resolved; `check:links` now sweeps every `*.links.test`;
  28 unit tests incl. the install flow against a mocked engine); `be447e0` IPC `ai-runtime:status/install/repair/remove` +
  `status-changed` push, preload, `useAiRuntime` hook, `AiRuntimeRow` on the System tab (Install recommended / "Use the smaller
  CPU-only runtime" / Update / Repair / Remove, DownloadCell progress, Verifying / Warming-up phases, preflight issues inline, "?"
  tooltip with licences), replacing the PyTorch-wheel row + Python panel; `f7ea855` retire `detectPython/detectPyTorch/cachedWheels`,
  `PYTORCH_PIP_INSTALL` (channel, handler, preload, types), `SystemInfoGetResponse.engines.pytorch/python`, `getPython*` in paths.ts,
  and `resources/python` (891 files). Gates: 1,210 vitest tests pass, check:types at baseline (26/22).
  Design notes: the install "verify" step warms **both** pipelines (rembg first launch ≈ 60 s here); status is pushed on every
  phase change rather than polled; the row stays behind `ai-system-runtimes` until Stage 3 (set `VITE_FF_AI_SYSTEM_RUNTIMES=1`
  in `.env` to see it in dev — done on this box). Deferred to Stage 5: sha256 on whisper/SD model downloads and whisper onto the
  download engine (plan §3 step 10 "while here" items).
  - **Stage 2 E2E on this box (dev app driven over CDP, `VITE_FF_AI_SYSTEM_RUNTIMES=1`):** the row rendered "AI Runtime · Not
    installed · Install GPU runtime · 2.8 GB / Use the smaller CPU-only runtime (280 MB)" with the recommendation reason (GTX 1650 Ti,
    driver 592.82). First probe caught a real bug: the disk guard read 0 bytes free because the runtime root did not exist yet →
    `freeBytesAt` now walks up to the nearest existing ancestor. Clicking the CPU link: **installed in 266 s** — download 130 s
    (267 MB from cdn.vidtsx.com at 1–3.5 MB/s, engine `verifying` → `extracting` 58 s), then the service phases `verifying`
    (triposr selftest 9 s) → `warming-up` (rembg 57 s first launch, triposr `--warmup` 9 s) → `installed · CPU · 2026.09.1`,
    946 MB in `%APPDATA%\VidTSX Studio\ai-runtime\2026.09.1-cpu`. Remove from the row deletes the folder. Not exercised here: the
    2.6 GB cu126 download path (same code, ~25 min at this uplink) and Repair — both are Stage 5 checklist items.
    Dev note: `electron-vite dev` needs `-w` to rebuild the main process on change (docs/ui-automation-cdp.md recipe lacks it).
- 2026-09-05 — **Stage 3 built + E2E PASSED** (commits `b9b9f30` engine, `86daf46` python-models service, `03b81a0` rembg UI/IPC/agent tool;
  the shared job skeleton `python-model-job.ts` landed with Stage 4's `520aa8e`).
  - `src/local-python-engine/`: `runPipeline` (temp request JSON, `spawn` windowsHide, env HF_HUB_OFFLINE/TRANSFORMERS_OFFLINE/PYTHONUTF8,
    `CUDA_VISIBLE_DEVICES=-1` only when forcing CPU, JSON-lines parser tolerant of split chunks + noise, 8 KB stderr ring, `taskkill /T /F`
    on cancel or idle timeout, `0xC0000106` → `path-too-long`), `classifyPythonFailure` (protocol codes incl. `network`, spawn, timeout,
    DLL exit codes, no-result), `PythonLocalEngine` serial queue (jobs serialised app-wide; caller-supplied requestId so progress can be
    subscribed before the first event), `mock-runner.cjs` (CommonJS so a copy named `runner.py` runs under node too — the service test
    drives the real `startPythonModel` path with it). 41 engine tests, no Python in CI.
  - `src/main/services/python-models/`: `registry.ts` (rembg-u2net + triposr with original-host URLs, sha256, bytes, `dest`, companions,
    licence, `vramMb`, `cpuOk`, and one **capability descriptor** each: inputs/outputs/zod options/`toolId`/`estimatedSeconds`),
    `request-builder.ts` (strict zod validation; rembg → `rembgHome`, triposr → `modelDir`/`dinoConfigPath`/`mcResolution`/`seed`/
    `previewPath`), `download.ts` (per-file `.part` + `finalizePath` + sha256, `fileLabel`/`fileStep` metadata, companions shared by dest,
    remove never deletes another model's companions), `status.ts` (present = exact byte count), `service.ts` = `preflightPythonModel` →
    structured `{ ready:false, reason, message, action:{kind,label,variant,bytes} }`, `ensurePythonModelReady` (runtime install/update/
    repair then model download), `startPythonModel`/`runPythonModel` (+ provenance sidecar `<output>.json`, usage recorded). 33 tests
    + `registry.links.test` in the `check:links` sweep.
  - IPC `pymodel:*` (status/download/cancel-download/remove/preflight/install) and `rembg:*` (run/progress/complete/error/cancel); the
    rembg handler resolves a gallery image or a dropped file, writes `<stem>-nobg.png` into the images folder and registers it with the
    new `images.derived_from` column (additive `ALTER TABLE` on open). Image Studio: scissors action on cards + lightbox, toolbar
    "Remove background…" file button, gallery file-drop overlay, `useRemoveBackground` hook, floating status card (stage + Cancel +
    ErrorBanner with Details), one install dialog (copy from the preflight; "Use the smaller CPU-only runtime" link). AI page Image tab:
    "Image tools" section (rembg row: licence badge, size, `needs AI runtime` badge, Download / Remove / Install runtime + model) behind
    `ai-system-runtimes`. Studio agent: `remove_background(image, alphaMatting?, postProcessMask?)` built from the descriptor
    (`library:<path>` in → `<name>-nobg.png` filed next to it, origin generated); returns the preflight message when the runtime is missing.
  - **E2E (dev app over CDP, this box, runtime folder empty at start):**
    - Dropped plush photo → dialog "Background removal runs on your computer. Download the AI runtime (2.8 GB) and the model (176 MB)?"
      (GPU recommended: GTX 1650 Ti, driver 592.82). Clicked the GPU button: card showed "Installing the AI runtime · 2%" at 43 s;
      **Cancel** → runtime download cancelled, card cleared (this exposed that cancel did not stop a runtime download the job started —
      fixed in `python-model-job.ts`: cancel now stops worker, model download and that runtime download).
    - Re-triggered, clicked **"Use the smaller CPU-only runtime (280 MB)"**: download 84 s, extract → 149 s, verify (triposr selftest)
      → 156 s, warm-up (rembg first launch + triposr `--warmup`) → 228 s, model download 176 MB → 279 s, first run: worker 5.26 s
      (load-model 0.83, process 1.74, export 0.51 on the 12 MP photo) → **`busy-nobg.png` 3024×4032 in the gallery 286 s after the click.**
    - Gallery image (1024², nano-banana sketch): **4.4 s click → new entry**, worker 3.87 s, `derivedFrom` set to the source id.
    - Cancel during "Preparing runtime": card gone **19 ms** after Cancel, no entry, no orphan worker.
    - Corrupt model (4 MB overwritten in place, size unchanged): "Cannot load background-removal model 'u2net': [ONNXRuntimeError] … INVALID_PROTOBUF
      … Remove the model on the AI page and download it again." with the raw tail behind Details — classified `weights-corrupt`. Restored from the lab copy.
    - Image tools section renders: "Background removal (u2net) · MIT · Ready · 176 MB · ~3s CPU · licence · source ↗ · Remove".
  - Decisions: (1) the install dialog's primary button is the recommended variant, the CPU link is secondary (plan §9.1); (2) `ready` +
    `import` map to "Preparing runtime", `load-model`/`process`/`export` to "Removing background" (plan §7.2 resolved: no protocol change
    needed beyond Stage 2's `stage: import`); (3) sidecars live next to the output (`busy-nobg.json` in the images folder) — the gallery
    lists DB rows only, so they are invisible in the UI; (4) `isnet-general-use` (plan §9.3) deferred — not quality-checked this session.
- 2026-09-05 — **Stage 4 built + E2E PASSED on the CPU runtime** (commits `520aa8e` service side, `ade4647` screen/viewer/tab, `d5eb7bb` fixes).
  - Service side: `python-model-job.ts` (the install-then-run skeleton both screens use), `sd3d-handlers.ts` (TripoSR through
    `startPythonModel` into `{userData}/threed-studio/models/<id>/{mesh.glb, input.png, preview.png, request.json}` + `threed-studio.db`;
    a failed/cancelled run removes its folder), `threed-studio-handlers.ts` (list/read/delete/save-as/save-to-library → `generated/3d/`
    via `reserveLibraryFile` + `upsertEntry` with the preview PNG as a sibling/open-folder), `runner.py` + `seed` and `previewPath`
    (NeRF view-0 after the export), `'3d'` category adapter (`threed-category.ts`, MODELS_SCAN/REMOVE answer for `'3d'`).
  - Screen: `src/features/threed-studio/` — ControlPanel (drop-zone + file picker + "From Image Studio…" picker, quality capped by VRAM:
    256 on ≤ 4 GB, 512 only ≥ 8 GB or on the CPU runtime, remove-background toggle on by default, seed + "New seed", CPU override on a
    GPU runtime), ModelGallery/ModelCard (NeRF preview + input inset), ModelLightbox with `GlbViewer` (drei Canvas + useGLTF + Stage +
    OrbitControls, wireframe + dark/light/grid, WebGL fallback) and Save to asset library / Save As / Open folder / Regenerate / New seed /
    Delete; staged progress Preparing runtime → Loading model → Preparing image → Shape (slab %) → Export → Saving with Cancel. AI Models
    3D tab (runtime card = `AiRuntimeRow`, catalogue rows with MIT / Fits / needs-runtime badges) behind `ai-3d-models`; sidebar "3D" +
    screen behind `threed-studio` (`VITE_FF_THREED_STUDIO`). Shared `AiRuntimeInstallDialog` (renderer) now serves both features.
  - **E2E (CPU runtime, TripoSR weights copied from the lab into `%APPDATA%\VidTSX Studio\ai-models\python\`):**
    - Chair: **123.7 s click → card** (worker 121.65 s: load-model 29.5 s cold disk, preprocess 1.9, encode 21.5, shape 35.8 with live %,
      export 0.02, preview 26.7 s at 320²). 41,864 verts / 83,732 faces, watertight — identical to Stage 0. Lightbox canvas 1520×949;
      "Save to asset library" → `generated/3d/product-png.glb` (+ `-preview.png`). Two findings fixed in `d5eb7bb`: the mesh rendered from the
      side (TripoSR is x-forward/z-up → `Euler(-π/2, -π/2, 0, 'YXZ')` on the model group; the red-left probe's axes from RESULTS.md), the preview
      render is 160² on the CPU (robot afterwards: **7.6 s** instead of 27 s), names drop the extension.
    - Robot: **96.1 s** (load 17.4, preprocess 2.3, encode 22.1, shape 38.6, preview 7.6), 80,649 verts — identical to Stage 0.
    - Cancel at 12 s (during load-model): card cleared, no entry, the reserved model folder removed, no orphan python.
    - 3D tab: "AI Runtime · Installed · CPU · 2026.09.1" card + "TripoSR (image → 3D) · MIT · Fits · Ready · 1.7 GB · ~65s CPU · ~35s GPU (4 GB+)".
    - Card numbers: CPU generation is ~95–125 s through the app on this i7-10750H (Stage 0's 66 s was a warm lab loop without the
      preview and with the ckpt in the page cache); the control panel says "about a minute on the CPU" — revisit the copy in Stage 5.

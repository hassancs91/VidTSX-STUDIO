# AI Runtime — implementation plan (background removal + 3D Studio)

> **Status: PLANNED (2026-09-04).** Stage 0 of `docs/local-python-runtime-plan.md` passed (GO).
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
    `https://R2_PUBLIC_BASE_URL` until the bucket's custom domain exists (`-BaseUrl` / `VIDTSX_R2_PUBLIC_BASE`).
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

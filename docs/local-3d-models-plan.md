# Local 3D Models — Full Implementation Plan

> **Goal:** by the end of this plan, a user can open the 3D tab, download any viable
> open-source 3D model (and whatever runtime it needs) with one click, generate
> image→3D locally, preview the result in-app, save it to the asset library, and use
> it inside generated TSX compositions.
>
> **Basis:** every model/runtime fact referenced here was verified live on 2026-07-16 —
> see `docs/local-3d-models-research.md` (§1 runtime, §2 models, §3 PyTorch audit).
> **Status:** plan only — no phase starts without sign-off. Template for category
> delivery: the video category (progress log in `local-image-models-implementation.md`).

## 1. The coverage problem (why two runtimes)

No single runtime runs "all open 3D models". Unlike LLMs (one architecture → llama.cpp
runs everything), each 3D model family is a different multi-stage pipeline. Coverage
therefore comes in tiers:

| Tier | Runtime | Models | Coverage cost |
|---|---|---|---|
| **A — binary (GGML)** | trellis.cpp (`'trellis'` runtime, downloadable binary, Vulkan/CUDA) | TRELLIS.2-4B only (512/1024 sets; later quants) | Cheapest; best current quality (MIT, PBR); AMD/Intel GPUs OK via Vulkan; 12–16 GB VRAM realistic |
| **B — PyTorch, pure ops** | managed Python env (`'pytorch'` runtime v2) | TripoSR (MIT, 1.56 GiB, ~6 GB VRAM, **CPU-capable**), TripoSG (MIT, geometry), PartCrafter (MIT, parts), Hi3DGen (MIT, geometry) | One big infrastructure build (Phase 4), then ~1 session per model |
| **C — PyTorch + custom CUDA ext** | same + prebuilt extension wheels | Hunyuan3D-2/2mini/2.1 texture stage, Step1X-3D texture, Direct3D-S2 (Triton) | Highest risk on Windows; strategy: ship **shape-only first** (no extensions needed), texture as optional add-on w/ pinned community wheels; NVIDIA-only |
| **D — link-only / import** | n/a for download; runnable if their tier's runtime exists | Gated repos (SF3D, SPAR3D — HF 401 + revenue-capped license) | Catalog shows source page + "import downloaded file" (existing custom-import pattern); no one-click DL (D1 rule) |

License policy (from research §2): MIT/Apache entries are first-class. Territory-restricted
(Hunyuan: void in EU/UK/South Korea) and revenue-capped (Stability Community) models are
**included but explicitly labeled** — a `license` badge + confirmation dialog on first
download ("Commercial use restrictions apply — review the license"). We never re-host
weights; all downloads come from the original HF repos.

## 2. Target architecture

```
src/local-3d-engine/                     # mirrors local-video-engine/
  types.ts                               # ThreeDModelMeta, GenerationRequest/Result, PipelineSpec
  model-registry.ts                      # catalog: all tiers, runtime + license + fit metadata
  trellis-cli-runner.ts                  # Tier A: arg builder + spawn + progress (pure, tested)
  python-runner.ts                       # Tier B/C: spawn python, JSON-lines protocol client
  engine.ts                              # ThreeDLocalEngine singleton: serial queue, routing by tier

src/main/services/
  model-library/…                        # existing core — '3d' is just another category
  python-envs/                           # NEW: managed env service (Phase 4)
    env-manager.ts                       # create/verify/repair/remove per-pipeline envs
    pip-runner.ts                        # pip subprocess + parsed progress events
    pipeline-specs.ts                    # pinned deps per pipeline (lockfile-style)

resources/pipelines/                     # NEW: shipped Python runner scripts (extraResources)
  common/protocol.py                     # JSON-lines event emitter, arg parsing, cancellation
  triposr/runner.py + vendored tsr/      # per-model inference code (vendored where MIT)
  …
```

- **Runtimes in the registry:** `'trellis'` (new `RuntimeId`, kind `'downloadable-binary'`,
  installed by downloading the release zip via the download manager and unzipping into
  `{userData}/runtimes/trellis/<version>/`) and the existing `'pytorch'` (kind
  `'python-runtime'`), upgraded from "installer" to "runtime" in Phase 4.
- **Category:** `'3d'` added to `ModelCategory`; dir `{aiModelsFolder}/3d`; single-file +
  companions (the video adapter's companion machinery covers TRELLIS.2's 7-file set and
  Hunyuan's shape+VAE+texture sets identically). `meta.tier` routes generation to the right
  runner. `allowCustomImport: true` (needed for Tier D gated models).
- **One generation IPC surface** regardless of tier: `SD3D_GENERATE / _PROGRESS / _COMPLETE /
  _ERROR / _CANCEL` — the engine hides whether trellis-cli or python produced the mesh.

### The Python subprocess protocol (Phase 4 core)

- Request: `python.exe {pipeline}/runner.py --request <tempjson>` with env
  `PYTHONPATH`-equivalent injected via `sys.path` bootstrap (embeddable `._pth` isolation —
  known workaround from `system-info.ts`).
- Response: **JSON-lines on stdout**: `{"type":"stage","name":"load-model"}`,
  `{"type":"progress","stage":"shape","pct":42}`, `{"type":"result","glbPath":...}`,
  `{"type":"error","code":"oom|import|cuda-mismatch|…","message":...}`. stderr = raw log tail
  for the expandable Details (ErrorBanner pattern from A3).
- Cancel: kill process tree (`taskkill /PID /T /F` on Windows).
- Failure classification mirrors `classifySdCliFailure`: OOM, missing DLL/import error,
  CUDA/driver mismatch, corrupt weights, cancelled, unknown.
- Envs: `{userData}/python-envs/<pipeline-id>/` via `pip install --target`, one env per
  pipeline (no cross-pipeline conflicts), each with a `manifest.json` (spec hash → verify/repair).
  Torch wheels keep using the existing download-manager flow (resumable, 109 MB CPU /
  2.42 GiB cu126); remaining deps via pip with line-parsed progress and no arbitrary timeout.
- Cold start: accepted for v1 (5–15 s python+torch import); persistent warm worker
  (stdin-driven) is a later optimization, noted in the protocol design so it can be added
  without breaking runners.

## 3. UI / UX design

### 3.1 The 3D tab (replaces ComingSoonPlaceholder)

Same skeleton as the Video tab, plus tier-awareness:

- **Catalog list** grouped: *Ready to generate* (runtime installed + model downloaded) →
  *Downloadable* → *Needs runtime* → *Manual download* (Tier D). Each card: name, size,
  input (image/text badge), output (textured / geometry-only badge), **license badge**
  (MIT/Apache = quiet; Community/Territory = amber with tooltip + first-download dialog),
  **VRAM fit badge** (existing A5 preflight: Fits / CPU offload / Too big), runtime chip
  ("3D Engine" / "Python + CUDA" / "Python (CPU OK)").
- **Runtime cards** at the top of the tab (views over the runtime registry, same pattern as
  the Main dashboard engine cards): "3D Engine (trellis.cpp) — Install (22 MB Vulkan / 649 MB
  CUDA, auto-picked via nvidia-smi)" and "Python Engine — Install (torch CPU 109 MB / CUDA
  2.42 GiB + per-model deps)". Installing a model whose runtime is missing offers both in
  one flow ("Download model + install runtime").
- **Downloads:** per-file step progress for companion sets (`fileLabel`/`fileStep` metadata —
  already built for video), pause/resume/cancel, `.part` + `finalizePath` (no false
  completions), disk-space guard.

### 3.2 Generation panel

Shown when ≥1 model is Ready (video pattern):

- **Input:** image drop-zone with three sources — file picker, **asset library picker**
  (existing image assets), and "Generate one" deep-link to the Image tab. Text→3D is
  presented honestly as a two-step: prompt → local image gen → 3D (one button, staged).
- **Options:** quality (Fast 512 / High 1024 where applicable), texture on/off
  (geometry-only models hide it), background removal toggle (trellis birefnet /
  rembg-equivalent), seed.
- **Progress:** staged bar with named stages (Preparing → Background removal → Shape →
  Texture → Export), per-stage percent from the runner protocol, elapsed + ETA, cancel.
  Auto-offload notice when the preflight downgraded to CPU offload (A5 pattern).
- **Errors:** `ErrorBanner` with friendly classified message + expandable raw tail.

### 3.3 Result viewing & consumption

- **In-app 3D viewer** (zero new deps — drei/`three` are direct dependencies): `<Canvas>` +
  `useGLTF` + `OrbitControls` + neutral `Stage` lighting, wireframe toggle, background
  toggle. Used in the generation result view AND as the preview for `model3d` assets in the
  asset library (today they're just a cube icon tile).
- **Actions:** Save to asset library (one click — the library + bundler already support
  `.glb`), Open folder, Regenerate (same seed / new seed), Delete.
- **Composition integration** (the differentiator): extend
  `src/shared/tsx-engine/prompts/generate-3d-prompt.ts` with a "Library meshes" section —
  the prompt enumerates available `model3d` assets and teaches `useGLTF` usage (asset URL
  via the existing asset server, `<Suspense>` fallback, scale normalization, shadows,
  `layout="none"` interplay). The TSX generate flow gains an "include 3D assets" picker.
- **Usage tracking:** generation reports to the existing usage store
  (`{category}:{modelId}`), so "last used / use count" appears like every other category.

## 4. Step-by-step phases

**Phase 0 — Gates & groundwork (½ session).**
1. File the trellis.cpp LICENSE issue upstream; ask about the `license: other` tag on
   `ilintar/trellis2-gguf`. (Blocking for Phase 2's binary auto-download, not for Phase 1.)
2. Hands-on validation on the dev box (A3000 ~6 GB): run `trellis-cli` Vulkan + CUDA zips,
   512-res generation — record VRAM, wall-clock, output quality. This sets honest fit floors.
3. Fix `python.exe` provisioning in `resources/python/win-x64` (restore + document the
   provisioning step, or first-run download). Required for Phases 4–6, harmless now.
4. Append a go/no-go note to the research doc.

**Phase 1 — '3d' category: catalog + downloads (1 session).** *Approvable independently.*
1. `'3d'` in `ModelCategory`/`ModelSubTab`; category descriptor + `src/local-3d-engine/`
   registry with ALL tiers' entries (Tier B/C/D included as visible-but-gated), exact
   verified sizes, license + tier + runtime metadata.
2. One-click multi-file downloads for ungated entries (companion machinery + `finalizePath`);
   Tier D entries: source-page link + custom import path.
3. 3D tab UI (catalog groups, badges, runtime cards in "not installed" state), fit badges
   via `evaluateFit`, `npm run check:links` coverage for every new URL, registry invariant
   tests (video's `model-registry.test.ts` pattern).
4. Banner: "Generation arrives with the 3D engine" (video-v1 pattern).

**Phase 2 — Tier A runtime + first generation (1–1.5 sessions, gated on Phase 0).**
1. `'trellis'` RuntimeDescriptor: download zip (variant by GPU detection) via download
   manager, unzip, version-pinned, verify by `--help` probe; uninstall/update path.
2. `trellis-cli-runner.ts` (pure arg builder + tests), spawn/progress/cancel, failure
   classification; `ThreeDLocalEngine` with serial queue; `SD3D_*` channels + preload +
   types; A5 preflight with Phase-0-calibrated floors.
3. Generation panel v1 (image input, quality, texture toggle, staged progress, ErrorBanner);
   result actions (Open folder, Save to library — viewer comes in Phase 3).
4. E2E: real 512-res generation on the dev box.

**Phase 3 — Viewing + composition integration (1 session).**
1. `GlbViewer` shared component (drei); wire into generation result + asset library
   `model3d` preview; offline check for draco/meshopt decoder paths (TRELLIS.2 GLBs are
   uncompressed — verify and note).
2. "Save to asset library" flow + toast; asset tiles get live thumbnails (render-to-texture
   snapshot or on-open viewer — decide by perf).
3. `generate-3d-prompt.ts` "Library meshes" extension + asset picker in the TSX generate
   flow; golden-path manual test: generate prop → include in composition → render.

**Phase 4 — PyTorch runtime v2: env manager + runner protocol (2–3 sessions).**
*The big one. No new models yet — pure infrastructure, validated with a stub pipeline.*
1. `python-envs` service: per-pipeline `--target` envs, manifest/verify/repair/remove,
   disk-usage reporting; settings surface ("Python environments" card: list, sizes, remove).
2. `pip-runner.ts`: pip subprocess with parsed progress → download-manager-style events in
   the existing progress UI; torch wheel continues through the download manager; no 5-min
   timeout; retry/resume semantics.
3. `resources/pipelines/common/protocol.py` + `python-runner.ts` (JSON-lines client),
   process-tree cancel, failure classifier extension (import/cuda-mismatch/oom codes).
4. Runtime registry: `'pytorch'` descriptor gains `ensurePipelineEnv(pipelineId)`;
   engine cards show per-pipeline env state.
5. Tests: protocol parser units; integration test with a **mock runner.py** (emits scripted
   events) so CI needs no torch; manual E2E with the stub on CPU.

**Phase 5 — First PyTorch model: TripoSR (1 session, gated on Phase 4).**
1. Vendor TripoSR inference code (MIT) into `resources/pipelines/triposr/`; pinned spec
   (torch already installed + torchvision, numpy, pillow, trimesh, rembg-or-threshold,
   torchmcubes CPU fallback — exact pins fixed at implementation).
2. Catalog entry flips from gated to Ready-flow: download 1.56 GiB ckpt → ensure env →
   generate. CPU mode exposed honestly ("several minutes").
3. This is the sub-8-GB / non-NVIDIA-GPU tier — the low-end answer trellis.cpp can't give.

**Phase 6 — Tier B/C expansion (≈1 session per model, priority order, each gated on demand).**
1. **Hunyuan3D-2mini shape-only** (3.8+0.43 GiB, <6 GB VRAM, no custom extensions) —
   license dialog for territory terms; texture stage explicitly out.
2. **TripoSG** (MIT, geometry, ≥8 GB CUDA).
3. **Hunyuan3D-2 texture stage** as an optional add-on IF pinned community Windows wheels
   for `custom_rasterizer` prove stable; otherwise skip.
4. **PartCrafter / Hi3DGen / Direct3D-S2** by user demand (Direct3D-S2 requires
   triton-windows — lowest priority).
5. Each model = vendored/pinned runner + catalog entry + per-model prompt notes; the
   infrastructure from Phase 4 is unchanged.

**Phase 7 — Polish (1 session, optional).**
Generation history panel (thumbnails of past outputs), batch/queue view, warm-worker
optimization if cold starts annoy, quantized TRELLIS.2 sets once verified against
trellis.cpp, text→3D one-button chain (image gen → 3D) if not landed earlier.

**Total: ~8–10 sessions** for the full program; user-visible value ships at the end of
each phase (catalog@1, first generation@2, composition loop@3, low-VRAM tier@5).

## 5. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| trellis.cpp license never declared | Can't auto-download the binary | Catalog stays; "install manually from GitHub releases" interim; fallbacks: rms80/trellis2cpp (MIT, geometry-only), pull Phase 4/5 forward |
| 512-res needs >8 GB VRAM | Tier A audience shrinks to enthusiast GPUs | Phase 0 measures it; TripoSR (Phase 5) becomes the mainstream tier; honest fit badges regardless |
| trellis.cpp abandoned (single maintainer) | Frozen at pinned version | Version-pinned zips keep working; AMD Lemonade adoption suggests ecosystem pickup; PyTorch path is the hedge |
| pip/env hell on Windows (AV, long paths, DLLs) | Phase 4 slips | Per-pipeline isolated `--target` envs, pinned exact versions, repair button, classified errors with raw-tail Details; mock-runner CI keeps regressions visible |
| Custom CUDA extensions (Tier C) | Texture stages undeployable | Shape-only first; texture only via proven prebuilt wheels; never compile on user machines |
| License complexity confuses users | Support burden / legal exposure | Badge + first-download dialog + license link stored in profile metadata; MIT/Apache entries visually "clean" |
| Disk bloat (envs + weights, 10–30 GB) | User surprise | Sizes shown before download; env/model removal UIs; disk-space preflight already exists |

## 6. Decision points for sign-off

1. **Approve Phase 0 + 1 now** (recommended — identical posture to video's landing).
2. **Phase 2 auto-proceeds** if Phase 0 gates pass? (recommended: yes)
3. **Phase 4–5 (PyTorch program, the big investment):** approve in principle now, or
   re-evaluate after Phase 3 ships and real usage data exists? (recommended: re-evaluate —
   if TRELLIS.2@512 covers most users, TripoSR's audience may not justify 3–4 sessions)
4. **Tier C (Hunyuan/territory-restricted models) in the catalog at all?** — legal comfort
   call; excluding them keeps the catalog clean-MIT and cuts Phase 6 scope.

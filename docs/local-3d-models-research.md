# Local 3D Model Generation — Research Report & Phased Plan

> **Session type:** research + planning only — nothing implemented.
> **Date:** 2026-07-16. All URLs, sizes, and licenses below were verified live on this date
> (HF API / GitHub / HEAD checks) unless explicitly marked otherwise.
> **Context docs:** `docs/local-image-models-redesign.md` §3.4 (category-agnostic core),
> `docs/local-image-models-implementation.md` progress log (video = the template for a new category).

## 0. Executive summary

- **There IS an "sd-cli moment" for 3D — it's two weeks old.** `pwilkin/trellis.cpp`
  (§1.1): C++/GGML runtime for Microsoft's MIT-licensed TRELLIS.2-4B, prebuilt Windows
  Vulkan/CUDA binaries, GGUF weights, `trellis-cli image.png out.glb` → textured-PBR GLB.
  Architecturally identical to our sd-cli/video stack. Risks: 2.5 weeks old, single
  maintainer, **no LICENSE file yet**, realistically 12–16 GB VRAM for good results.
- **The model field splits cleanly by license** (§2): MIT/Apache = TripoSR, TRELLIS/.2,
  TripoSG, Step1X-3D, Direct3D-S2, Hi3DGen; gated = Stability's SF3D/SPAR3D (401, revenue
  cap); territory-restricted = Hunyuan3D-2.x (void in EU/UK/KR). Recommend MIT/Apache-only
  catalog.
- **Our PyTorch "runtime" is an installer, not a runtime** (§3): it can detect and pip-install
  the bare torch wheel and nothing more; no feature consumes it. A Python 3D pipeline means
  building managed envs + a subprocess runner protocol from scratch (~video-effort-sized) —
  justified only if the trellis.cpp route fails or a sub-8-GB tier is demanded (TripoSR).
- **Everything downstream of inference already exists** (§4, §5): `.glb` is whitelisted in
  the asset server, typed in the asset library, and drei/`@remotion/three` are direct deps
  because the app already generates 3D TSX compositions — generated props via `useGLTF` is
  the product story, and it's mostly prompt plumbing.
- **Plan** (§7): Phase 0 gates (license ask + real 512-res VRAM test) → Phase 1 catalog +
  downloads (video template, safe to ship now) → Phase 2 trellis.cpp runner → Phase 3
  preview + composition integration. PyTorch tier deferred. **Recommendation (§8): approve
  Phase 0+1 now; Phase 2 after the gates.**

## 1. Runtime — is there an "sd-cli moment" for 3D?

**Yes — and it is roughly two weeks old.** All findings below verified live against the
repos/APIs on 2026-07-16.

### 1.1 The headline: `pwilkin/trellis.cpp` ✅

https://github.com/pwilkin/trellis.cpp — a standalone **C++/GGML runtime for Microsoft's
TRELLIS.2-4B image→3D model**, matching the sd-cli pattern the app already uses exactly:
ggml backend, GGUF weights, CLI binary, prebuilt Windows zips.

- **What it runs:** the full 5-stage TRELLIS.2 pipeline in C++ — background removal
  (BiRefNet or threshold) → DINOv3 ViT-L conditioning → sparse-structure flow DiT (1.3B) →
  shape DiT + FlexiDualGrid decode → texture DiT (PBR). C++ postprocessing includes hole
  filling, dual-contouring remesh, quadric decimation, xatlas UV unwrap, WebP texture baking.
- **Invocation:** `trellis-cli assets/goblin.png out/goblin.glb` with `--res 512|1024|1536`,
  `--bg-removal`, `--no-texture`, `--require-gpu`; also a **resident HTTP server mode**.
  Output: **GLB with WebP PBR textures** — directly consumable by our asset pipeline (§4).
- **Windows binaries (GitHub releases API, v0.2.1, published 2026-07-13):**
  `trellis-cuda-windows-x64.zip` (648.8 MB), `trellis-vulkan-windows-x64.zip` (22.3 MB),
  `trellis-rocm-windows-x64.zip` (117 MB). 9 releases total; repo pushed as recently as
  2026-07-16 (today).
- **Weights:** GGUF quants at `ilintar/trellis2-gguf` (the author's own repo — card states
  it targets trellis.cpp; per-stage GGUFs: dinov3, ss_flow/ss_dec, shape_flow_512/1024,
  shape_dec, tex_flow_512/1024, tex_dec, birefnet). Community alternative:
  `Aero-Ex/Trellis2-GGUF` (Q4_K_M–Q8_0). Model weights themselves are **MIT** (TRELLIS.2).
- **Ecosystem signal:** AMD's Lemonade 11.0 independently ported this GGML TRELLIS.2
  pipeline as a `POST /v1/3d/generations` backend — a second consumer of the same stack.
- **Performance claims (README):** numerical parity with the PyTorch reference to ~1.8e-2;
  RTX 5060 Ti end-to-end ~3–7.5 min; the 1024-res cascade fits **16 GB VRAM**; CPU fallback
  exists but is "very slow, RAM-hungry".

**Risk profile (the caveats matter):** created 2026-06-28 — ~2.5 weeks old; 15 stars;
single maintainer (pwilkin/ilintar, a known llama.cpp contributor); **no LICENSE file in the
repo yet** — this must be resolved (issue/ask upstream) before we can bundle or auto-download
the binary; realistic VRAM for good results (16 GB at 1024 res; 512 res lower) is above our
image/video floors; minutes-per-asset generation times.

### 1.2 Everything else checked (and why it's not the answer)

| Candidate | Verdict | Evidence |
|---|---|---|
| **stable-diffusion.cpp** (leejet) | ❌ no 3D, none planned | README feature list = image + video only (master-778, 2026-07-14); issue search for 3d/mesh/hunyuan3d/trellis/triposr → zero feature threads |
| **rms80/trellis2cpp** | ⚠️ partial | Credible author (Ryan Schmidt/Meshmixer), MIT, C++/ggml TRELLIS.2 **stage-1 geometry only** (image→watertight OBJ, `<1e-3` L2 vs reference); no texture stage, no releases, DINOv3 conditioning precomputed; self-described "early scaffolding". Fallback/watch |
| **TripoSR ONNX** (`Heliosoph/triposr-onnx`) | ⚠️ partial | Real: `triplane.onnx` + 3.3 GB external data + `nerf.onnx` (opset 17). But card confirms **marching cubes + vertex coloring live outside the graphs** → we'd implement mesh extraction ourselves on onnxruntime. Feasible project, not a binary; 2024-era quality |
| **Stable Fast 3D ONNX** | ❌ none exists | No export found (HF + web); official repo PyTorch-only + gated; needs UV-unwrap/delight postprocessing — worse export story than TripoSR |
| **llama.cpp ecosystem** | ❌ (novelty exception) | No mesh capability. Exception: **LLaMA-Mesh** (nv-tlabs) — Llama-3.1-8B fine-tune emitting OBJ *as text*; GGUFs exist (bartowski, QuantFactory) and run on our existing llama stack. Toy-grade quality, text-only; zero-infra novelty at best |
| **microsoft/TRELLIS (v1) / TRELLIS.2 official** | ❌ | Python + custom CUDA extensions (spconv/flash-attn/nvdiffrast/cumesh/flexgemm), Linux-oriented, 24 GB VRAM rec.; no C++/ONNX deployment. TRELLIS.2 (Dec 2025, MIT, 4B) is the *model* trellis.cpp reimplements |
| **Modly** (modly3d.app, 4.3k stars) | ❌ (UX prior art) | Looks like the answer, isn't: Electron + **Python FastAPI backend**, models run via pip-installed Python extensions. Useful as product prior art (it wraps Hunyuan3D-2 Mini, TripoSG, Trellis2-GGUF) |
| **Hunyuan3D-2.x C++** | ❌ | GGUF quants exist (`calcuis/hy3d-gguf`) but only for Python/ComfyUI loaders; no standalone runtime anywhere |
| **FerrisMind/candle-3d** | ⚠️ embryonic | Rust/candle TripoSR incl. marching cubes; ~0 stars, 10 commits, Windows untested. Watch-only |
| "triposr.cpp" / "triposr ggml" / "hunyuan3d cpp" | ❌ don't exist | GitHub repo search — all hits are Python forks/wrappers |

### 1.3 Verdict

There is exactly **one** "just bundle a binary" option: **trellis.cpp**. It is
architecturally identical to what we already do for sd-cli (ggml + GGUF + CLI + Vulkan/CUDA
Windows zips) and outputs textured GLB directly. It is also brand-new, unlicensed (repo, not
weights), and hungrier than our image/video models. Text→3D has **no** native runtime at
all — the practical route is our existing sd-cli text→image, then trellis.cpp image→3D,
which composes nicely as a product story (§5).

## 2. Model landscape (mid-2026)

All rows verified live 2026-07-16 via the HF API (`/api/models/<repo>`, `/tree/main`) and
unauthenticated `curl -sIL` HEAD checks on `resolve/main` URLs. Sizes are exact server bytes.

### 2.1 Comparison table

| Model | Input | Output | License / commercial | Weights (exact bytes) | One-click DL? | VRAM (per README) | Runtime hazards |
|---|---|---|---|---|---|---|---|
| **TripoSR** (`stabilityai/TripoSR`) | 1 image | mesh, vertex-color texture (OBJ/GLB) | **MIT** ✅ | `model.ckpt` 1,677,246,742 (~1.56 GiB) | ✅ 200 | ~6 GB; **CPU works** | PyTorch + torchmcubes (CPU fallback OK) — lightest of all |
| **Stable Fast 3D** (`stabilityai/stable-fast-3d`) | 1 image | GLB, UV-unwrapped texture | Stability **Community** — commercial < $1M/yr + registration | 4,024,289,892 | ❌ **401 GATED** | ~6 GB; CPU flag exists | custom C++/CUDA texture-baker + UV-unwrapper |
| **SPAR3D** (`stabilityai/stable-point-aware-3d`) | 1 image (+point cloud edit) | GLB + texture | Stability Community (same caps) | 7,326,949,440 | ❌ **401 GATED** | 10.5 GB (7 GB low-VRAM) | same as SF3D |
| **Hunyuan3D-2** (`tencent/Hunyuan3D-2`) | 1 image (text via own T2I) | mesh + baked texture (glb/obj) | Tencent Hunyuan Community — commercial OK but **void in EU/UK/South Korea**, 1M-MAU cap | shape DiT 4,928,151,562 + VAE 428,455,666; paint UNet 3,662,636,472 + delight 3,463,772,592 | ✅ 200 | **6 GB shape-only / 16 GB with texture** | texture stage compiles `custom_rasterizer` CUDA ext (community Windows wheels exist) |
| **Hunyuan3D-2mini** | 1 image | mesh (reuses -2 paint) | Tencent (same caveats) | DiT 3,819,958,234 + VAE 428,455,666 | ✅ 200 | < 6 GB shape | same |
| **Hunyuan3D-2.1** | 1 image | mesh + **PBR** texture | Tencent (same caveats) | DiT 7,366,389,768 (.ckpt only!) + VAE 655,648,152 + PBR UNet 3,925,293,863 | ✅ 200 | **10 / 21 / 29 GB** | heaviest of family |
| **TRELLIS image-large** (`microsoft/TRELLIS-image-large`) | 1 image | mesh / 3DGS / RF | **MIT** ✅ | 8 files ≈ 3,299,233,632 | ✅ 200 | 16 GB; Linux-official | ⚠️ flash-attn + spconv + nvdiffrast + kaolin — worst Windows story |
| **TRELLIS.2-4B** (`microsoft/TRELLIS.2-4B`, Dec 2025) | 1 image | O-Voxel → textured mesh, full **PBR** | **MIT** ✅ | 9 files ≈ 16.2 GB total (~11.1 GB one resolution) | ✅ 200 | **24 GB** official (GGUF route lower, community-reported) | cumesh/o-voxel/flexgemm/flash-attn custom CUDA — **unless run via trellis.cpp (§1)** |
| **TripoSG** (`VAST-AI/TripoSG`) | 1 image | GLB, **geometry only** | **MIT** ✅ | ≈ 7.9 GB (3 parts) | ✅ 200 | ≥ 8 GB, CUDA required | diffusers stack; no texture |
| **Step1X-3D** (`stepfun-ai/Step1X-3D`) | 1 image | mesh + SDXL texture | **Apache-2.0** ✅ | geo ≈ 7.25 GB + tex 3,602,537,816 | ✅ 200 | **27 GB** geo+tex | reuses Hunyuan custom_rasterizer |
| **Direct3D-S2** (`wushuang98/Direct3D-S2`) | 1 image | high-res SDF mesh, no texture | **MIT** ✅ | v1.1 ≈ 2.9 GB | ✅ 200 | 10 GB @512³ / 24 GB @1024³ | **Triton** sparse attention (Windows fork needed) |
| **Hi3DGen / Stable3DGen** (`Stable-X/trellis-normal-v0-1`) | 1 image | geometry mesh, no texture | **MIT** ✅ (NVIDIA deps deliberately stripped for commercial use) | ≈ 2,649,940,432 | ✅ 200 | undocumented (~8–16 GB est.) | TRELLIS-derived minus nvdiffrast |
| **PartCrafter** (`wgsxm/PartCrafter`) | 1 image | **multi-part** meshes, untextured | **MIT** ✅ | ≈ 3.97 GB | ✅ 200 | undocumented | TripoSG stack; Windows fork exists |
| **Apple SHARP** (`apple/Sharp`) | 1 image | 3DGS scene (.ply) | apple-amlr — **research only** ❌ | 2,809,738,232 | ✅ 200 | light, <1 s | not asset gen (view synthesis) — skip |
| **TRELLIS-text-xlarge** | **text** | mesh / 3DGS | **MIT** ✅ | ≈ 4,127,475,189 | ungated (not HEAD-checked) | ≥16 GB | same TRELLIS stack |
| **LLaMA-Mesh** (GGUF) | text | OBJ-as-text | Llama 3.1 license | 8B GGUFs exist | ✅ | runs on our llama stack today | toy quality |

Notable absences/gotchas: **Hunyuan3D-2.5/3.0 have no open weights** (API-only; tracked in
Hunyuan3D-2 issue #316). "Hi3DGen" has no HF repo under that name (renamed Stable3DGen; weights
under `Stable-X/trellis-normal-v0-1`). SF3D/SPAR3D tree listings are visible but downloads 401
without login+license-acceptance → they can't be one-click catalog entries (D1 rule).
Scene-reconstruction models (VGGT, DUSt3R, HunyuanWorld, Lyra) are a different category — excluded.

### 2.2 The trellis.cpp weight set (verified directly)

`ilintar/trellis2-gguf` — **ungated**, direct downloads verified (302→200, exact
Content-Length). Per-stage GGUFs (F16-class):

| File | Bytes | Role |
|---|---|---|
| `dinov3.gguf` | 606,773,440 | image conditioning (required) |
| `ss_flow.gguf` | 2,586,488,480 | sparse-structure DiT (required) |
| `ss_dec.gguf` | 147,379,392 | sparse-structure decoder (required) |
| `shape_flow_512.gguf` | 2,586,636,032 | shape DiT @512 |
| `shape_flow_1024.gguf` | 2,586,636,032 | shape DiT @1024 (alt) |
| `shape_dec.gguf` | 948,745,344 | shape decoder (required) |
| `tex_flow_512.gguf` | 2,586,734,336 | texture DiT @512 |
| `tex_flow_1024.gguf` | 2,586,734,336 | texture DiT @1024 (alt) |
| `tex_dec.gguf` | 948,713,888 | texture decoder (required) |
| `birefnet.gguf` | 882,749,024 | background removal (optional) |

**Minimal textured 512-res set ≈ 9.7 GiB** (7 files); +0.82 GiB for birefnet; both
resolutions ≈ 15.3 GiB. ⚠️ The repo card tags `license: other` while the source TRELLIS.2
weights are MIT — needs a closer look (likely just an unset field, but verify before
catalog inclusion). Community Q4_K_M quants exist (`Aero-Ex/Trellis2-GGUF`: the two big DiTs
drop 2.59 GB → ~789 MB each), but that repo's layout/naming compatibility with trellis.cpp
is **unverified** — v1 should use the author's known-good set.

### 2.3 Best-first-entry analysis

- **Cheapest genuinely-usable entry:** **TripoSR** — MIT, ungated single 1.56 GiB file,
  ~6 GB VRAM *with a real CPU fallback*, single image → textured (vertex-color) mesh. Nothing
  else combines permissive license + ungated + small + CPU-plausible. **But it needs the
  PyTorch runner (§3)** — as a catalog-only entry it's cheap; as a *usable* entry it's the
  expensive path.
- **Best usable-through-a-binary entry:** the **TRELLIS.2 GGUF set via trellis.cpp** — no
  Python at all, best-in-class PBR output, but ~9.7 GiB download and realistically a
  12–16 GB-VRAM experience (CPU fallback "very slow").
- **Best quality on mid consumer GPUs (license permitting):** Hunyuan3D-2 (6 GB shape /
  16 GB textured) — but the **EU/UK/South-Korea territory exclusion** makes it a poor fit
  for a globally-shipped desktop app unless we surface license terms per model very loudly.
  Recommend keeping v1 catalog **MIT/Apache-only**.

## 3. PyTorch path — audit of the existing install flow

### What exists today (verified in source, 2026-07-16)

**The runtime registry already reserves the slot.** `src/shared/model-library/types.ts`:
`RuntimeId` includes `'pytorch'`, `RuntimeKind` includes `'python-runtime'`, and
`RuntimeStatus.installable` was designed for exactly this case ("missing but the app can
install it (e.g. PyTorch)"). `src/main/services/model-library/runtime-registry.ts` is the
generic registry; model rows can already render `{ code: 'missing-runtime', runtime: 'pytorch' }`
issues.

**The Python interpreter** (`src/main/utils/paths.ts:88-107`):
- CPython **3.13 Windows embeddable package** at `resources/python/win-x64/`
  (→ `process.resourcesPath/python` when packaged, via electron-builder `extraResources`).
- **pip 26.0.1 is vendored** in `Lib/site-packages` and tracked in git; the binary files
  (`python.exe`, DLLs, `.pyd`s) are **gitignored** and provisioned out-of-band.
- ⚠️ On this dev box, `python.exe` is currently **absent** from `resources/python/win-x64/`
  (the DLLs are present). `detectPython()` therefore reports unavailable in dev right now.
  Any 3D work on the PyTorch path starts by re-provisioning the exe.
- The embeddable distribution uses a `._pth` file → **isolated sys.path that ignores
  `PYTHONPATH`**. The existing detection code works around this by injecting
  `sys.path.insert(0, packagesDir)` inline in the `-c` script (`system-info.ts:149-151`).
  Every future subprocess launch must do the same (or ship a `sitecustomize.py`).

**The install flow** (`use-system-info.ts` → download manager → `system-info-handlers.ts`):
1. Renderer picks a variant: **CPU** or **GPU (cu126)** — informed by `detectGpu()`
   (nvidia-smi only; AMD/Intel → no GPU option).
2. Downloads exactly **one wheel** to `{aiModelsFolder}` via the shared download manager
   (pause/resume/cancel work, wheel is cached for reinstalls):
   - `torch-2.11.0+cpu-cp313-cp313-win_amd64.whl` — **114,468,993 bytes (~109 MB)**, HTTP 200 ✅
   - `torch-2.11.0+cu126-cp313-cp313-win_amd64.whl` — **2,596,453,916 bytes (~2.42 GiB)**, HTTP 200 ✅
3. `PYTORCH_PIP_INSTALL` IPC → `python -m pip install --target {userData}/python-packages
   --no-cache-dir <wheel>` with a **5-minute timeout** and **no progress reporting**
   (the UI just shows "installing").
4. `detectPyTorch()` verifies by importing torch in a subprocess and reporting
   `torch.cuda.is_available()` → variant cpu/gpu.

### What it can and cannot run today

**It runs nothing.** No feature consumes PyTorch — the only call sites of
`getPythonExePath()` are detection (`system-info.ts`) and the pip-install handler. There is
no inference subprocess, no runner protocol, no Python-side script shipped in the app.
Today's flow is a *runtime installer + dashboard card*, full stop.

It also installs **only the bare `torch` wheel**. A real 3D pipeline needs (at minimum)
`torchvision`, `numpy`, `pillow`, `transformers`/`diffusers` or the model's own package,
`trimesh`/mesh export libs, and often `rembg`/`onnxruntime` for background removal — none of
which the current flow can install (it takes a local wheel path, not a requirements set, and
it installs into **one flat `--target` dir** shared by everything).

### What wiring a 3D pipeline on it would actually take

| # | Work item | Notes / risk |
|---|---|---|
| 1 | **Provision python.exe reliably** | Already designed (extraResources) but currently broken in dev; needs a documented restore step or a first-run download. |
| 2 | **Dependency install beyond one wheel** | Extend the pip flow to a *pinned requirements set per pipeline* (lockfile-style, exact versions, `--no-deps` + explicit list is the reproducible option). Progress: pip gives no machine-readable progress → either parse its output lines or pre-resolve and download the wheels ourselves through the existing download manager (nice: resumable, sizes known, one UX for everything) and `pip install --no-index --find-links`. The 5-min timeout must go. |
| 3 | **Env isolation** | One flat `python-packages` dir cannot hold two pipelines with conflicting pins. Options: (a) one `--target` dir *per pipeline* + `sys.path` injection (simple, disk-hungry), (b) real venvs (embeddable python doesn't ship `venv`; `virtualenv` works but adds moving parts). (a) is the pragmatic choice. |
| 4 | **Subprocess runner protocol** | Same shape as the existing sd-cli runners: spawn `python.exe runner.py --json-args`, stream **JSON-lines events** on stdout (`progress`, `stage`, `result`, `error`), kill on cancel. The image/video engines (`sd-cli-runner.ts` / `video-cli-runner.ts`) are the direct template; failure classification mirrors `classifySdCliFailure` (OOM, missing DLL, import error, CUDA mismatch). |
| 5 | **Cold start** | First run per session pays Python + torch import (~5–15 s on Windows with AV scanning) + model load. Mitigations: keep the subprocess warm between generations (persistent worker reading requests off stdin), or accept it for v1. |
| 6 | **Windows failure modes** | Long-path issues in deep package trees (`--target` paths), AV false-positives on `.pyd`s, cu126 wheel ↔ driver mismatch (detected CUDA version is already surfaced), embeddable-python `._pth` isolation (already understood), DLL hell if a model needs a custom CUDA extension (**this is the killer** — anything requiring `nvdiffrast`, `spconv`, flash/flex-attention custom builds is effectively undeployable to end users on Windows; needs compile toolchains). Model choice must filter for "pure PyTorch ops only". |

**Honest complexity estimate:** the runner protocol + per-pipeline env + pip-progress work
is roughly the size of the whole video-category effort (which had the luxury of an existing
binary). It is *tractable* — the app already has the download manager, runtime registry,
failure-classification, and engine/queue patterns to copy — but it is a new *class* of
runtime (managed Python envs), not a new catalog entry.

## 4. Output viewing — what the renderer can display

**The .glb path is already first-class, end-to-end.** Verified in source:

- `three@0.183.2`, `@react-three/fiber@9.5.0`, `@react-three/drei@10.7.7`, and
  `@remotion/three@^4.0.435` are **direct dependencies** (package.json) — not transitive
  leftovers. They exist because the app has a full **3D TSX generation mode**:
  `src/shared/tsx-engine/prompts/generate-3d-prompt.ts` generates Remotion + `<ThreeCanvas>`
  compositions and explicitly allows `@react-three/drei` imports in user compositions.
- The **asset library** already classifies `.glb/.gltf/.obj/.fbx` as `model3d`
  (`src/features/asset-library/services/file-type.ts:14`) with a cube icon tile.
- The **Remotion bundler's asset server** already whitelists `.glb/.gltf/.obj/.fbx`
  (`src/main/services/remotion-bundler.ts:95`) — a generated mesh can be served into a
  composition today.

So a 3D preview panel is cheap: a small renderer component with `<Canvas>` +
drei `useGLTF` + `OrbitControls` + `Stage`/`Environment` lighting, fed by a `file://` or
asset-server URL (the Video tab's playback pattern). No new dependencies. Note drei's
`useGLTF` draco/meshopt decoders default to CDN URLs — for offline correctness either use
plain (uncompressed) glTF output, or point the decoder path at bundled decoders. TripoSR-class
models emit uncompressed .glb/.obj, so this is a non-issue for v1.

Fallback ("Open folder" + Windows 3D Viewer / external tool) remains available but shouldn't
be needed given the above.

*(One side observation, out of scope for this session: `@remotion/three` is pinned with a
`^` prefix in package.json — CLAUDE.md's "no `^` for Remotion packages" rule says it should
be exactly `4.0.435`.)*

## 5. Product fit — what is 3D generation FOR in VidTSX Studio?

VidTSX Studio is a TSX/Remotion video tool, and it **already renders 3D scenes**: the
`generate-3d` TSX mode produces `@remotion/three` compositions, but today those scenes can
only contain **procedural geometry** (boxes, spheres, particles, instanced meshes — whatever
the LLM can write as JSX primitives). The single biggest quality ceiling on that mode is
that "a rocket", "a coffee cup", "our product" all come out as abstract primitive
approximations.

**The natural product story:** *image/text → 3D prop → asset library → referenced by
generated TSX compositions via `useGLTF`.* Concretely:

1. User generates (or imports) a product shot / logo render / character image.
2. Local 3D model turns it into a textured `.glb` (~seconds to ~2 min depending on model).
3. It lands in the asset library as a `model3d` asset (pipeline already exists).
4. The `generate-3d` prompt is extended so the LLM can reference library meshes
   (`useGLTF(staticFile('assets/rocket.glb'))`) instead of hand-building geometry —
   turntables, fly-throughs, product-hero shots, explainer props.

That's a genuinely differentiating loop (no other Remotion tool has it), and every piece
except the model inference itself already exists in the codebase. It also bounds the quality
bar usefully: props rendered *inside a video composition* (moving camera, small on screen,
stylized lighting) tolerate far more mesh jank than a hero asset for a game engine would —
single-image reconstruction quality is *good enough for this use* well before it's good
enough for e-commerce/AR.

**Open product questions for Hasan** (answers shape the runtime investment — see §8):

- **Q-A. Is the prop-for-compositions loop the goal**, or is "3D" here more of a
  checkbox/coming-soon promise fulfilled (catalog presence, generation quality secondary)?
  The `MainContent` dashboard already teases "3D gen" as upcoming, so *something* is promised.
- **Q-B. Input bias: image→3D or text→3D?** Image→3D is where the cheap/good models are, and
  the app can already produce the input images locally (sd-cli). Text→3D adds little (it's
  mostly text→image→3D under the hood anyway).
- **Q-C. Is ~a few seconds-to-minutes per prop on a 6–8 GB GPU acceptable**, and is CPU-only
  fallback a requirement or a nice-to-have?
- **Q-D. How much do you care that 3D generation *works* at launch of the tab** vs. shipping
  catalog+downloads first (video-style) with the runner gated behind the PyTorch runtime work?

## 6. Recommended architecture

**Runtime: trellis.cpp (`RuntimeId: 'trellis'`, kind `'downloadable-binary'`), not PyTorch.**
Rationale:

- It is the only zero-Python option, and it matches every pattern we already have: ggml
  binary + GGUF weights + CLI runner + Vulkan/CUDA. The video engine
  (`video-cli-runner.ts` / `video-engine.ts` / companion-download machinery) is a
  near-1:1 template — TRELLIS.2's 7-file weight set is exactly our "model + companions"
  shape (Wan/LTX already download up to 5 companions per model).
- The PyTorch path (§3) is a whole new runtime *class* (managed envs, pinned deps,
  pip progress, subprocess protocol) to reach a *worse* model (TripoSR, 2024 quality)
  — while its main advantage (6 GB VRAM / CPU) is partially covered by trellis.cpp's
  512-res mode and undermined by minutes-long CPU runtimes either way.
- `'trellis'` is one new `RuntimeId` union member + one `RuntimeDescriptor`. Unlike sd-cli
  (bundled), the binary should be **downloaded on demand** (Vulkan zip is 22 MB, CUDA
  648 MB — CUDA only offered when nvidia-smi reports a CUDA GPU), which also sidesteps
  bundling a fast-moving binary into our installer.

**Two hard gates before the runner phase (not before the catalog phase):**

1. **License**: trellis.cpp has **no LICENSE file**. We cannot redistribute or
   auto-download the binary until upstream declares one. Action: open a GitHub issue
   asking (the author is a known llama.cpp contributor; ggml ecosystem is MIT-normative —
   likely resolves quickly). Also confirm the `license: other` tag on `ilintar/trellis2-gguf`.
2. **Windows validation**: download the Vulkan and CUDA zips, run
   `trellis-cli <image> out.glb --res 512` on the dev box (A3000, ~6 GB) and confirm:
   does 512-res fit in 6–8 GB VRAM or gracefully offload? What are real wall-clock times?
   The 16 GB README figure is for the 1024 cascade; the 512 behavior on small cards is the
   make-or-break number for our user base, and it is currently **unverified**.

**Model category:** `'3d'` added to `ModelCategory`, dir `{aiModelsFolder}/3d`,
single-file GGUFs + companion set (the video adapter's companion resolution generalizes
directly: shape/tex flow = "model", dinov3/ss_flow/ss_dec/decoders/birefnet = shared
companions). `allowCustomImport: false` in v1 (a lone GGUF stage is not configurable).
Fit floors via the existing A5 preflight (start conservative: 12 GB VRAM / 32 GB RAM for
textured 512; revise after gate 2).

**Catalog policy:** MIT/Apache-only in v1 (excludes Hunyuan's territory-restricted license
and Stability's gated repos). Entries at Phase 1:

1. **TRELLIS.2 512-res textured set** (ilintar GGUFs, ~9.7 GiB + optional birefnet) — the
   primary, runnable-at-Phase-2 entry.
2. **TRELLIS.2 1024-res add-on** (the two alt DiTs, +5.2 GiB) — for 16 GB+ cards.
3. *(optional, catalog-only)* **TripoSR** (MIT, 1.56 GiB) — listed with a "requires PyTorch
   runtime (planned)" gate, only if we want a low-VRAM story on the shelf; otherwise defer
   until a PyTorch runner is ever justified.

**Deliberately deferred:** the PyTorch runner. Keep the `'pytorch'` RuntimeId and installer
as-is; revisit only if (a) trellis.cpp's license or Windows story fails, or (b) user demand
for sub-8-GB 3D generation is real — then TripoSR is the target, and §3's table is the
work list.

**Product integration (the actual point, §5):** generated `.glb` files land in the asset
library (`model3d` type exists), get a drei `useGLTF` preview panel (no new deps), and the
`generate-3d` TSX prompt gains a "library meshes" section so compositions can use generated
props. This last item is pure prompt + asset-URL plumbing and is what turns "a 3D tab" into
a feature only VidTSX has.

## 7. Phased plan

> **Superseded 2026-07-16 (same session):** scope expanded to full open-model coverage
> (both runtimes, all tiers, complete UX) — see **`docs/local-3d-models-plan.md`** for the
> authoritative step-by-step plan. The phases below remain as the original minimal proposal.
> Note also: trellis.cpp runs **only** the TRELLIS.2 family (each 3D model family is a
> different pipeline architecture — there is no general-purpose 3D runtime); every other
> open model requires the PyTorch path, which is why the full plan has two runtime tracks.

Template: the video category (catalog+downloads first, runner second), per the 2026-07-16
progress-log entries in `local-image-models-implementation.md`.

**Phase 0 — gates (½ session, mostly waiting on upstream).**
File the trellis.cpp license issue; clarify GGUF repo license tag; download both Windows
zips and dry-run `trellis-cli --help` + a real 512-res generation on the dev box; record
VRAM/wall-clock. Output: go/no-go note appended to this doc. *No app code.*

**Phase 1 — catalog + downloads (1 session; the earlier implementation prompt becomes this).**
`'3d'` in `ModelCategory` + `ModelSubTab` wiring (replace ComingSoonPlaceholder), category
descriptor + registry (`src/local-3d-engine/` mirroring `local-video-engine/`), TRELLIS.2
entries with companion sets, one-click multi-file download via the existing
`finalizePath` pattern, fit badges, `npm run check:links` coverage, tests mirroring
`model-registry.test.ts`. Banner: "generation arrives with the 3D runtime". *Ships value
identical to video-v1 and fulfills the dashboard's "3D gen" teaser.*

**Phase 2 — runtime + runner (1–1.5 sessions, gated on Phase 0).**
`'trellis'` RuntimeDescriptor (download+unzip Vulkan/CUDA zip via download manager, version
pinned), `trellis-cli` runner mirroring `video-cli-runner.ts` (arg builder pure+tested,
progress parse, cancel/kill, `classifySdCliFailure`-style error mapping), engine singleton +
serial queue, `SD3D_GENERATE/...` channels, A5 preflight, Generate panel in the 3D tab
(image input → .glb output, "Open folder" + save-to-asset-library).

**Phase 3 — viewing + composition integration (1 session).**
Drei `useGLTF` + `OrbitControls` preview component (asset library `model3d` tiles + 3D tab
result view; decoder-path/offline check), "Add to asset library" on generation complete,
`generate-3d-prompt.ts` extension: enumerate library meshes + `useGLTF` usage rules
(staticFile/asset-server URL, scale normalization, `<Suspense>` fallback,
`layout="none"` interactions).

**Phase 4 (optional, unscheduled) — PyTorch/TripoSR low-VRAM tier.** Only on demand
signal; scope = §3's six work items + TripoSR runner (~2–3 sessions). Not part of this
approval.

Rough total for Phases 0–3: **3.5–4 sessions**, of which Phase 1 is committable
independently of the trellis.cpp gates.

## 8. Recommendation & decision point

**Recommendation:** approve **Phase 0 + Phase 1** now. Phase 1 is safe regardless of how
the runtime gates resolve (worst case, the catalog waits for a runner exactly like video
did for two weeks). Hold Phase 2 approval until Phase 0's go/no-go note (license + 512-res
VRAM reality). Treat Phase 3 as the default follow-on — it is where the product
differentiation lives and none of it depends on *which* runtime generates the mesh.

**What could change this recommendation:**
- If Phase 0 finds 512-res doesn't fit ≤8 GB VRAM and CPU is unusable → the catalog's
  audience shrinks to 12–16 GB+ cards; decide whether that's acceptable (video's LTX tier
  already set a 16 GB precedent) or whether the PyTorch/TripoSR tier gets pulled forward.
- If the trellis.cpp license stalls → catalog-only until it resolves; fallbacks
  (rms80/trellis2cpp geometry-only MIT; DIY ONNX TripoSR) are real but each is a
  quality or effort downgrade, documented in §1.2.

Open product questions (§5 Q-A…Q-D) — answers refine scope but don't block Phase 0/1.

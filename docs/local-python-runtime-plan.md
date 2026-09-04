# Local Python Runtime — portable stack + first PyTorch/CUDA model (TripoSR)

> **Status: Stage 0 PASSED (2026-09-04, GO).** Stages 1–5 below are **superseded by
> `docs/ai-runtime-implementation-plan.md`** (background removal in Image Studio + a 3D Studio);
> §0–§3 (design, test box, Stage 0 record) and §9–§11 remain the reference.
>
> **Supersedes** `docs/local-3d-models-plan.md` §2 "Python subprocess protocol — Envs" and
> the whole of **Phase 4** there (per-pipeline `pip install --target` environments built on
> the user's machine). Everything else in that plan — the 3D category, tiers, license
> policy, the 3D tab, the GLB viewer, composition integration — still stands and is
> referenced below rather than repeated. Model facts come from
> `docs/local-3d-models-research.md` (2026-07-16) plus a re-check on 2026-09-03.

## 0. Decisions recorded on 2026-09-03

| # | Decision | Why |
|---|---|---|
| 1 | **Users never run pip.** The app downloads one pre-built, relocatable Python+PyTorch folder ("the stack") per app version, built and tested by us. | Pinokio-style install-time dependency resolution is the failure mode we are avoiding. A pinned zip with a hash is the same supply-chain story as `sd-cli` and `ffmpeg-full`. |
| 2 | **One stack serves every curated Python model in a release.** Torch + CUDA runtime libs download once, not once per model. | The "no CUDA ten times" guarantee, by construction. Curation lets us pick models that share pins. |
| 3 | **Custom CUDA/C++ extensions are compiled by us into the stack, or the model is not shipped.** | Compiling on user machines needs Visual Studio + CUDA toolkit; that is the other Pinokio killer. |
| 4 | **First model: TripoSR** (MIT, 1.56 GiB ungated, ~4 GB VRAM, real CPU fallback). TripoSG is the planned quality upgrade; Hunyuan3D-2mini only with the territory-license dialog. | Only candidate that is permissive, small, Windows-friendly, needs no compiled extension (torchmcubes → scikit-image), and runs on the 4 GB test box. |
| 5 | **Hosting: Cloudflare R2 first** (zero egress; storage ≈ $0.015/GB-month; ops inside free tier). Catalogue entries carry a **mirror list**, Hugging Face as the second mirror later. | Verified against the R2 pricing page 2026-09-03. |
| 6 | **CUDA wheel line: cu126.** | Still supports Turing (sm_75, this box) and Pascal (GTX 10xx); cu128 drops Pascal. Driver floor ≈ 525.60 via CUDA 12 minor-version compatibility. |
| 7 | **Two stack variants: `cu126` (NVIDIA) and `cpu` (everyone else).** Picked by `detectGpu()`. | TripoSR runs on CPU, so AMD/Intel/no-GPU users still get the feature, slower. |
| 8 | **Retire the embedded CPython in `resources/python/`** and the `PYTORCH_PIP_INSTALL` flow. | It is an installer, not a runtime (research §3); `python.exe` is already missing from the dev checkout; the `._pth` isolation hack goes away with it. |

## 1. Target design

### 1.1 The stack (what the user downloads)

Built the ComfyUI-Portable way — **no venv** (a venv bakes absolute paths into `pyvenv.cfg`):

```
ai-runtime/                       # {userData}/ai-runtime/<version>-<variant>/
  manifest.json                   # version, variant, python, torch, cuda, minDriver, lockHash, contents[]
  python/                         # python-build-standalone 3.11.x (relocatable by design)
    python.exe
    Lib/site-packages/            # torch, torchvision, transformers, einops, omegaconf,
                                  # numpy, pillow, trimesh, scikit-image, rembg, onnxruntime, xatlas
  licenses/                       # PyTorch (BSD), NVIDIA CUDA runtime redistributable notices, per-package
```

- **Built by a repo script from a checked-in lockfile** with `uv` (`uv pip compile --generate-hashes`
  → `uv pip sync` into the standalone interpreter's own site-packages). Deterministic; the lock
  hash is stamped into `manifest.json`.
- **Pinned in TypeScript** like `FFMPEG_FULL_CATALOGUE`: `{ version, variant, urls: [r2, hf], sha256, bytes, extractedDir, licence }`.
- **Installed through the existing download engine**: resume, SHA-256 before extraction,
  zip extraction, atomic reveal, EPERM/EBUSY retry. Nothing new in the download layer.
- **Size targets**: `cu126` ≤ 3.5 GB zipped / ~5 GB on disk; `cpu` ≤ 1 GB zipped.
- **Versioning**: `YYYY.MM.N` (e.g. `2026.09.1`). Each app version pins exactly one stack version.
  Same version already installed → no download. Older versions removed after a successful install.
  Models declare `runtime: { id: 'pytorch', stack: '2026.09' }`; a mismatch renders the existing
  `missing-runtime` issue with an "Update runtime" action.

### 1.2 A curated model = weights + a shipped script

```
resources/pipelines/                       # extraResources (replaces resources/python)
  common/protocol.py                       # JSON-lines emitter, request parsing, cancellation, error codes
  triposr/
    runner.py                              # entrypoint: --request <json> | --selftest
    tsr/                                   # vendored TripoSR inference package (MIT), torchmcubes → skimage
    config.yaml                            # model config (from the HF repo)
    LICENSE
```

Weights are **never re-hosted**; they download from the original HF repo into the content-addressed
model store with `.part` + `finalizePath` + **sha256** (a gap today for whisper/SD, closed in Stage 2).
Every file the pipeline touches is declared up front — including the ones upstream code fetches
silently (rembg's `u2net.onnx`, DINO's `config.json`) — and fetched as companions through the
engine. **Rule: a generation must succeed with the network unplugged.**

### 1.3 Worker protocol (unchanged from the July plan, now normative)

`python.exe resources/pipelines/<id>/runner.py --request <tmp.json>` → JSON lines on stdout:

```
{"type":"ready","torch":"2.x.y","cuda":true,"device":"NVIDIA GeForce GTX 1650 Ti","vramMb":4096}
{"type":"stage","name":"load-model"}
{"type":"progress","stage":"shape","pct":42}
{"type":"result","outputPath":"...glb","stats":{"vertices":123456,"seconds":18.2,"peakVramMb":3410}}
{"type":"error","code":"oom|cuda-mismatch|import|weights-corrupt|cancelled|unknown","message":"..."}
```

stderr is the raw log tail for the expandable Details. Cancel = `taskkill /PID <pid> /T /F`.
The protocol is language-neutral on purpose: **CI tests it with a Node mock runner**, so vitest never
needs Python or torch.

### 1.4 Preflight (before any download)

- `detectGpu()` → NVIDIA + driver ≥ floor + VRAM ≥ 4 GB → `cu126`, GPU mode.
- NVIDIA below floor / < 4 GB / non-NVIDIA → `cpu` variant, card says "Runs on CPU — about a
  minute per model" (numbers from Stage 0).
- Disk guard covers stack + weights + companions together.

## 2. The test box (this PC, 2026-09-03)

| | |
|---|---|
| GPU | GeForce GTX 1650 Ti Max-Q, **4 GB**, Turing sm_75 |
| Driver | 592.82 (CUDA 13.1 capable) |
| RAM / CPU | 15.7 GB / i7-10750H (6c/12t) |
| Disk free | 376 GB on C: |
| Toolchain | `uv` at `~\.local\bin\uv.exe`, git, **no** Visual Studio, **no** CUDA toolkit |

If it works here without compiling anything, it works on most users' machines.

## 3. Stage 0 — Prove it outside the app (tests first) — ~1 session

Everything lives in `C:\Users\Malak\Documents\ai-runtime-lab\` (outside the repo, survives
sessions). **No app source is touched.** Results go into `lab\RESULTS.md` and, when done, into
§3.4 of this doc.

### 3.1 Build the stack by hand

```powershell
uv python install 3.11
uv python find 3.11                       # -> %APPDATA%\uv\python\cpython-3.11.x-windows-x86_64-none
# copy that folder to lab\stack\python (python-build-standalone is relocatable)
uv pip compile lab\requirements.in --python lab\stack\python\python.exe --extra-index-url https://download.pytorch.org/whl/cu126 --index-strategy unsafe-best-match --generate-hashes -o lab\requirements.cu126.lock
uv pip sync lab\requirements.cu126.lock --python lab\stack\python\python.exe
lab\stack\python\python.exe -c "import torch;print(torch.__version__,torch.cuda.is_available(),torch.cuda.get_device_name(0))"
```

`requirements.in` (v1): `torch`, `torchvision`, `transformers`, `einops`, `omegaconf`, `numpy`,
`pillow`, `trimesh`, `scikit-image`, `rembg`, `onnxruntime`, `xatlas`, `safetensors`. Exact pins are
fixed by the lock; record them in RESULTS.md.

### 3.2 Vendor TripoSR and patch out the compiled dependency

1. Clone `VAST-AI-Research/TripoSR` at the pinned commit (record it); copy `tsr/` + `LICENSE`.
2. In `tsr/models/isosurface.py` replace `torchmcubes.marching_cubes` with
   `skimage.measure.marching_cubes`. **Check vertex axis order** — skimage returns index order
   (z, y, x); torchmcubes returned (x, y, z). Verify orientation against the input image; fix with
   an axis permutation if mirrored.
3. Download `stabilityai/TripoSR` → `model.ckpt` (1,677,246,742 bytes) + `config.yaml`; record sha256.
4. Load with a **local directory** (`TSR.from_pretrained(local_dir)`), never the hub name.
5. Set `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, `U2NET_HOME=lab\models\rembg`. Run once **with
   Wi-Fi off**. Anything that fails offline (DINO `config.json`, `u2net.onnx`) becomes a declared
   companion file. Check `torch.load(..., weights_only=…)` behaviour on the `.ckpt` with the
   pinned torch.

### 3.3 Write the worker and the smoke harness

- `lab\pipelines\common\protocol.py` + `lab\pipelines\triposr\runner.py` implementing §1.3, with
  `--selftest` (prints the `ready` line and exits).
- `lab\smoke.mjs` (plain Node, no repo imports): spawns the worker, parses JSON lines, asserts
  the event order, times cold start, kills the tree mid-generation on a `--cancel-after` flag, and
  checks `tasklist` for orphaned `python.exe` afterwards.
- Three test images: a clean product shot, a character, and a photo with a busy background
  (exercises rembg).

### 3.4 Measurements and pass criteria

| Test | Pass when | Record |
|---|---|---|
| GPU generation, 4 GB | succeeds at `--mc-resolution 256`; if OOM, at 128 | peak VRAM (`torch.cuda.max_memory_allocated` + nvidia-smi), wall time, vertex count, GLB size |
| CPU generation (`CUDA_VISIBLE_DEVICES=`) | succeeds | wall time (expect ~30 s–3 min) — this number goes on the UI card |
| Offline run | succeeds with Wi-Fi off | list of companion files that had to be pre-fetched |
| Relocation | works after moving `stack\` to a path with spaces and to a ≥ 200-char path | — |
| Zip round trip | zip → sha256 → extract with Node `unzipper` (same lib as the app) → works | zip size (target ≤ 3.5 GB), extraction seconds |
| Protocol | `ready → stage → progress… → result` in order; cancel kills the tree ≤ 2 s; no orphans | cold start (spawn → `ready`) with Defender on |
| Error injection | corrupt ckpt → `weights-corrupt`; `--mc-resolution 1024` on 4 GB → `oom`; missing package → `import` | messages are human-readable |
| Orientation | mesh matches the photo (not mirrored) | axis fix applied, if any |
| `cpu` variant | same lock with the CPU torch index builds and runs | zip size (target ≤ 1 GB) |

**Go / no-go:** all rows pass → Stage 1. Any row fails → fix in the lab, re-run; if 4 GB GPU cannot
pass at 128, the GPU floor becomes 6 GB and this box tests the `cpu` variant (still a valid product).

#### Stage 0 results (2026-09-04) — measured in `C:\Users\Malak\Documents\ai-runtime-lab\` (full log: `lab\RESULTS.md`)

Box: GTX 1650 Ti Max-Q 4 GB (sm_75), driver 592.82, i7-10750H, 16 GB, no VS, no CUDA toolkit.
Stack: python-build-standalone **3.11.15**, **torch 2.14.0+cu126 / +cpu**, torchvision 0.29.0 (not needed — drop),
transformers 5.16.1, rembg 2.0.83, onnxruntime 1.29.0, scikit-image 0.26.0, numpy 2.4.6, pillow 12.3.0,
trimesh 5.1.0, einops 0.8.2, omegaconf 2.3.1, safetensors 0.8.0, xatlas 0.0.11 (64 packages, all wheels).
TripoSR vendored @ `107cefdc244c39106fa830359024f6a2f1c78871`; `model.ckpt` sha256
`429e2c6b22a0923967459de24d67f05962b235f79cde6b032aa7ed2ffcd970ee`.

| Test | Record | Verdict |
|---|---|---|
| GPU generation, 4 GB | **PASS at mc 256.** Peak VRAM 1,866 MB alloc / 2,136 MB reserved (torch), 2.2–2.7 GB nvidia-smi. **30–35 s** warm (load-model 13–15 s, encode ~3 s, shape 4–5 s). Chair 41,864 verts / GLB 1.68 MB; robot 80,649 verts / 3.23 MB; 12 MP phone photo 43,190 verts / 1.73 MB. | PASS |
| CPU generation | **PASS — 66–69 s** (both stacks, same meshes). Card text: "about a minute per model on CPU". | PASS |
| Offline run | **PASS** with every outbound socket blocked. Companions: `model.ckpt`, `config.yaml`, DINO `config.json`, `<rembgHome>\models\u2net\u2net.onnx` (175,997,641 B, sha256 `8d10d2f3bb75ae3b6d527c77944fc5e7dcd94b29809d47a739a7a728a912b491`). | PASS |
| Relocation | Spaces **PASS**. ≥ 200-char root **FAIL on default Windows** (no `LongPathsEnabled`): deepest relative path is 152 chars → root ≤ ~107 chars as built (~135 after pruning). App root ≈ 75 chars → OK with a preflight guard. | CONDITIONAL — criterion changes |
| Zip round trip | cu126 **2.64 GiB** zip (4.6 GB / 31k files on disk), unzipper extract **72 s**, 0 hash mismatches, runs. cpu **334 MB** zip (1.1 GB on disk), extract 43 s, runs. | PASS |
| Protocol | Order asserted on every run. Cold start **2.7–4.3 s** warm, **30–34 s** on first launch of fresh files (Defender). Cancel: tree gone in **0.7–1.1 s**, 0 orphans. | PASS |
| Error injection | `weights-corrupt` / `oom` / `import` all correct and readable. mc 1024 on 4 GB runs **293 s** before `oom` → cap resolution by VRAM. | PASS |
| Orientation | **PASS, no permutation needed** (drop upstream's `[2,1,0]` flip; skimage index order == our grid). Proven by density-at-vertices (identity 1.85 vs ≈25 for the other five permutations) and a red-left probe. Winding needs `gradient_direction="ascent"`. | PASS |
| `cpu` variant | **PASS** — same 64 pins with `+cpu`; builds in 71 s; zip 334 MB. | PASS |

**Verdict: GO for Stage 1.** 4 GB GPU floor stands.

§11 answers: (1) **3.11 confirmed** — every package is a wheel (15 cp311, 4 abi3, 46 pure), nothing compiled.
(2) **torch 2.14.0**, transformers 5.16.1 with a 4→5 ViT key remap in the vendored loader (verified bit-exact
against `ViTModel.from_pretrained`); **torchvision not needed**. (3) **`--bake-texture` works** (moderngl 5.12.0 +
glcontext 3.0.0, WGL context on the iGPU, 52 s at 1024² on CPU) — ship vertex colours in v1, keep the two wheels
in the stack.

Plan changes required before Stage 1 (details in `lab\RESULTS.md` "Things that MUST change"):
1. §3.1 recipe: delete `Lib\EXTERNALLY-MANAGED` from the copied interpreter; compile with `--emit-index-url`, sync with
   `--index-strategy unsafe-best-match`; drop torchvision, add moderngl+glcontext; prune `torch\include` (64 MB),
   `torch\lib\*.lib` (47 MB), `*/tests`; flatten `dist-info\licenses\third_party\**` into `licenses\`; stamp
   `maxRelativePathLength` in `manifest.json`.
2. §3.4 relocation criterion → "root ≤ 107 chars as built + preflight path-length guard
   (`len(root) + maxRelativePathLength + 1 ≤ 259` unless `LongPathsEnabled=1`)".
3. CPU recipe: `CUDA_VISIBLE_DEVICES=` is dropped by Win32 when spawned from Node — use **`-1`** or request `device:"cpu"`.
4. §1.2: companions list = ckpt, config.yaml, DINO config.json, u2net.onnx (exact rembg 2.0.83 layout above).
5. §1.3: add `bad-request` (implemented); consider `network`; `ready` fires before the pipeline imports (~4 s warm,
   ~100 s first launch) — move it or add a `stage:"import"`.
6. §5 verify step: run `--selftest` **and** a warm-up import after extraction (first generation on fresh files took
   170 s vs 34 s warm).
7. §7: cap `mc-resolution` from VRAM (256 on ≤ 4 GB).
8. §10: skimage marching cubes is not a bottleneck (≈1 s of the 4–5 s shape stage); torchmcubes stays out.

## 4. Stage 1 — Build tooling in the repo — ~½–1 session

Adds files, changes no app behaviour.

- `scripts/ai-runtime/`: `requirements.in`, `requirements.cu126.lock`, `requirements.cpu.lock`,
  `build-stack.ps1` (uv → relocatable folder → `manifest.json` → zip → sha256 → prints the
  catalogue entry), `verify-stack.mjs` (extract to temp, run `runner.py --selftest`),
  `upload-r2.ps1` (rclone/wrangler to the bucket), `README.md` (release procedure).
- `resources/pipelines/common/protocol.py`, `resources/pipelines/triposr/**` — moved from the lab.
- `electron-builder.yml`: add `resources/pipelines` to `extraResources`; drop the three
  `resources/python/*` entries.
- R2 bucket + custom domain; upload `2026.09.1-cu126` and `-cpu`; keep licence files inside the zips.

## 5. Stage 2 — Runtime service in the app — ~1 session

- `src/main/services/ai-runtime/`: `catalogue.ts` (pinned entries, mirror list),
  `paths.ts` (`{userData}/ai-runtime/<version>-<variant>/`), `install.ts` (`sdcli-install.ts`
  shape: inflight promise, `enqueueDownload` with sha256 + zip extraction, manifest check,
  old-version cleanup), `status.ts` (`installed | update-available | missing`, disk usage),
  `register.ts` (`registerRuntime({ id: 'pytorch', kind: 'python-runtime', … })`).
- Download engine: try the next mirror URL on a non-resumable failure (small change in
  `download-engine.ts`; unit-tested).
- `system-info.ts`: `detectPyTorch()` becomes "run `--selftest` on the installed stack"; delete the
  `PYTHONPATH`/`sys.path` injection. Remove `PYTORCH_PIP_INSTALL` channel, handler, preload entry,
  and `getPythonDir/ExePath/PackagesDir` from `paths.ts`.
- System tab: "AI Runtime (GPU)" / "(CPU)" row under the existing `ai-system-runtimes` flag —
  size, status, Install / Update / Repair / Remove; progress via `DownloadCell`.
- Foundation fixes bundled here: sha256 on whisper and SD model downloads; whisper binary onto the
  download engine.
- Tests: catalogue invariants (https, sha256 shape, bytes > 0, `check:links` coverage); install
  idempotence with a mocked engine; status transitions on manifest version mismatch; mirror fallback.

## 6. Stage 3 — Worker client + 3D engine — ~1 session

- `src/local-3d-engine/`: `types.ts`, `model-registry.ts` (TripoSR profile: files + sha256 +
  companions, VRAM floor from Stage 0, license `MIT`, `runtime.stack`), `python-runner.ts`
  (spawn, JSON-lines parser, taskkill tree), `python-failure.ts` (classifier, `classifySdCliFailure`
  pattern), `engine.ts` (serial queue singleton, mirrors `video-engine.ts`).
- Tests: parser fixtures for every event type and malformed lines; `mock-runner.mjs` emitting a
  scripted event stream for order/cancel/error tests; registry invariants + links.

## 7. Stage 4 — Category, downloads, IPC, UI — ~1.5–2 sessions

Follows `local-3d-models-plan.md` §3 and Phases 1–3, with the PyTorch tier first:

- `'3d'` in `ModelCategory`/`ModelSubTab`; `sd3d-download.ts` (mirror of `sdvideo-download.ts`,
  weights + declared companions, sha256).
- `SD3D_GENERATE / _PROGRESS / _COMPLETE / _ERROR / _CANCEL` + runtime channels; preload; types.
- 3D tab replaces `ComingSoonPlaceholder`: runtime card, catalogue list with license/fit/runtime
  badges, generate panel (image drop, quality, background removal, seed, staged progress,
  `ErrorBanner`), `GlbViewer` (drei), Save to asset library, Open folder.
- Composition integration (`generate-3d-prompt.ts` "Library meshes") as in the July plan.

## 8. Stage 5 — Hardening and release — ~1 session

- Preflight (§1.4), disk guard, Repair (re-extract stack), Remove (weights only vs runtime).
- Manual E2E checklist on this box (GPU) and with `CUDA_VISIBLE_DEVICES=` (CPU path), then one
  rented Windows GPU VM from `docs/gpu-cloud-testing-plan.md` for an 8–12 GB card.
- `STATUS.md`, progress log in this doc, memory note.

**Total ≈ 6–7 sessions.** User-visible value: runtime row @ Stage 2, first generation @ Stage 4.

## 9. After TripoSR

- **Model #2** (~1 session each, infrastructure unchanged): TripoSG (MIT; needs fp16 + offload to
  approach 6 GB — measure), then Hunyuan3D-2mini shape-only behind the territory-license dialog.
  Each = vendored runner + catalogue entry; if it needs a package, it goes into the *next* stack
  version, never a per-model install.
- **trellis.cpp (Tier A binary)** stays a separate track from the July plan; its 12–16 GB VRAM
  floor means it cannot be validated on this box.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Two curated models need incompatible torch pins | Curate around it; hard cap of two stack versions live at once |
| Stack zip > 2 GB | R2 has no per-file limit at this size; GitHub Releases (2 GB cap) is not a mirror option |
| AV / long paths on extraction of ~30k files | Engine's EPERM retry loop; Stage 0 measures extraction; consider `\\?\` paths if needed |
| Upstream model repo removed | Store sha256 + bytes; later decision on mirroring weights on R2 (a few $/month) |
| skimage marching cubes slower / lower quality than torchmcubes | Stage 0 measures; option to pre-compile torchmcubes into the stack later (we build, users never do) |
| Cold start 5–15 s per generation | Accept for v1; protocol already allows a persistent stdin-driven worker later |

## 11. Open questions (answer during Stage 0)

1. Python 3.11 vs 3.12 for the stack — 3.11 has the widest prebuilt-wheel coverage for future
   models (community TRELLIS wheels target it); confirm every v1 package has a 3.11 wheel.
2. Exact torch pin and whether `torchvision` is actually needed by the vendored `tsr/`.
3. Whether `--bake-texture` (xatlas) is worth shipping in v1 or vertex colours only.

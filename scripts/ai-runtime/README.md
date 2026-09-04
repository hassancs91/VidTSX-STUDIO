# scripts/ai-runtime — building the downloadable AI runtime

The **AI runtime** is a relocatable Python 3.11 + PyTorch folder that the app downloads on first
use (never bundled in the installer) to run curated Python models: background removal (rembg) and
image → 3D (TripoSR) first. Design: `docs/local-python-runtime-plan.md` §0–§1; build plan and stage
log: `docs/ai-runtime-implementation-plan.md`. Everything here is **repo tooling only** — nothing
in `src/` changes when a runtime is rebuilt; the app learns about a new runtime through the
catalogue entry the build prints.

Two variants are built from **one** `requirements.in`:

| variant | who gets it | torch | zip | on disk |
|---|---|---|---|---|
| `cu126` | NVIDIA cards, driver ≥ 525.60 (Pascal and newer) | `2.14.0+cu126` | 2.57 GiB (2,758,592,573 B) | 4.61 GB, 14,218 files |
| `cpu`   | everyone else (AMD / Intel / no GPU) | `2.14.0+cpu` | 267 MiB (279,969,216 B) | 0.90 GB, 14,190 files |

Versions are `YYYY.MM.N` (current: **2026.09.1**). Each app version pins exactly one runtime
version; a model that needs new pins goes into the *next* runtime version, never a per-model install.

## Files

| file | purpose |
|---|---|
| `requirements.in` | top-level pins for both variants (torch, transformers, rembg, onnxruntime, scikit-image, trimesh, moderngl, glcontext, …) |
| `requirements.cu126.lock`, `requirements.cpu.lock` | hashed, self-contained locks (`--emit-index-url`). **Generated — never edit by hand.** |
| `compile-locks.ps1` | regenerates both locks with `uv pip compile` pinned to cp311 / x86_64 Windows |
| `build-stack.ps1 <variant> <version>` | the build: interpreter → sync → prune → flatten licences → selftest → `manifest.json` → zip → sha256 → catalogue entry |
| `stack-tools.py` | stdlib helper used by the build: tree stats and the reproducible deflate/zip64 archive |
| `verify-stack.mjs <zip>` | the Stage 1 test: extract with the app's exact `unzipper` call, check the manifest, run both pipelines' `--selftest` |
| `upload-r2.ps1 -Version … -Bucket …` | rclone upload of both zips + sidecars to R2, prints URLs |

The worker scripts the runtime executes live in `resources/pipelines/` (shipped in the installer
via `extraResources`): `common/protocol.py`, `triposr/runner.py` + vendored `tsr/`, `rembg/runner.py`.

## Release procedure

Measured 2026-09-04 on the dev box with a warm uv cache: cu126 build 405 s (zip 291 s of that), cpu build
252 s, verify 3 + 2 min — about 16 minutes end to end. The first build on a new box also downloads the
2.4 GB cu126 torch wheel (bandwidth-bound; the lab took 27 min at ~1.5 MB/s).

1. **Pick the version.** Bump `YYYY.MM.N` (`N` restarts at 1 each month). Only a pin change needs
   a new version; a rebuild of the same pins must produce byte-identical zips (see Reproducibility).
2. **Re-lock only if pins changed:**
   ```powershell
   powershell -File scripts\ai-runtime\compile-locks.ps1            # same pins, fresh hashes
   powershell -File scripts\ai-runtime\compile-locks.ps1 -Upgrade   # take newer versions
   git diff scripts/ai-runtime/*.lock                                # review every changed pin
   ```
3. **Build both variants** (needs `uv` on PATH, ~12 GB free, no compiler, no CUDA toolkit):
   ```powershell
   powershell -File scripts\ai-runtime\build-stack.ps1 cu126 2026.09.1
   powershell -File scripts\ai-runtime\build-stack.ps1 cpu   2026.09.1
   ```
   Output lands in `.vidtsx-temp\ai-runtime\` (git-ignored): `<version>-<variant>\` (the folder as it
   will be extracted), `<version>-<variant>.zip`, `.zip.sha256`, `.manifest.json`,
   `.build-report.json` (timings, prune sizes, selftest output) and `.catalogue.ts` (the entry to paste).
   The build refuses to continue if the torch build tag does not match the variant, if the
   cu126 build reports no CUDA version, or if either pipeline's `--selftest` fails.
4. **Verify each zip** exactly the way the app installs it:
   ```powershell
   node scripts\ai-runtime\verify-stack.mjs .vidtsx-temp\ai-runtime\2026.09.1-cu126.zip --expect-cuda
   node scripts\ai-runtime\verify-stack.mjs .vidtsx-temp\ai-runtime\2026.09.1-cpu.zip
   ```
   `--expect-cuda` only on a box with an NVIDIA card. `--force-cpu` sets `CUDA_VISIBLE_DEVICES=-1`
   (the value must be `-1`, never empty — Win32 drops empty env values). The first selftest on freshly
   extracted files takes ~30 s (Defender scanning ~27k new files); that is expected and recorded.
5. **Upload to R2** (one-time rclone setup is in the header of `upload-r2.ps1`):
   ```powershell
   powershell -File scripts\ai-runtime\upload-r2.ps1 -Version 2026.09.1 -Bucket <bucket> -BaseUrl https://<custom domain>
   ```
   Objects land at `ai-runtime/<version>-<variant>.zip` (+ `.sha256`, `.manifest.json`).
6. **Paste the two catalogue entries** (`.catalogue.ts`, with the real base URL) into
   `src/main/services/ai-runtime/catalogue.ts` (Stage 2), then `npm run check:links` and
   `npm run check:types`.
7. **Record** sizes, hashes and timings in `docs/ai-runtime-implementation-plan.md` §10; commit with
   explicit pathspecs (`git add scripts/ai-runtime docs/ai-runtime-implementation-plan.md …`).

## What is in a zip

```
manifest.json              version, variant, python, pythonBuild, torch, cuda, minDriver, lockFile,
                           lockSha256, maxRelativePathLength, deepestPath, bytesOnDisk, files,
                           pythonDir, pipelines, builtAt, builtWith
python/                    python-build-standalone 3.11 (relocatable: no venv, no pyvenv.cfg, no .pth
  python.exe               with absolute paths) with every locked package in Lib\site-packages
licenses/<package>/        every *.dist-info\licenses\** tree moved here + python\LICENSE.txt + README.txt
```

Zip entries are rooted at the runtime folder, so the app extracts straight into
`{userData}\ai-runtime\<version>-<variant>\` and finds `manifest.json` and `python\python.exe`
(`extractedDir: 'python'` in the catalogue). `files` and `bytesOnDisk` in the manifest count
everything **except** `manifest.json` itself.

### Pruned at build time (Stage 0 measurements on the unpruned lab stack)

| what | why | saves |
|---|---|---|
| `torch\include\**` | C++ headers, useless without a compiler | 64 MB |
| `torch\lib\*.lib` | import libraries for linking | 44 MB |
| every `*/tests/` directory under site-packages | test suites (sympy 65, scipy 33, networkx 25, numpy 14, …) | 47 MB |
| every `__pycache__` | regenerated lazily on the user's machine (none present after a fresh sync; the prune is a safety net) | 92 MB / ~4 000 files in the lab stack |
| `pip` (`uv pip uninstall pip`) | uv keeps the interpreter's seed pip although it is not in the lock; users never run pip | 6 MB / ~900 files |

`*.dist-info\licenses\**` is **moved** (not deleted) to `licenses\<package>\`. That is both a
notices folder and the fix for path depth: the deepest file in the lab stack was
`torch-2.14.0+cu126.dist-info\licenses\third_party\flash-attention\…\LICENSE.rst` at 145 chars.

### Path length (why `maxRelativePathLength` exists)

Default Windows (no `LongPathsEnabled`) limits a path to 259 chars. The manifest stamps the deepest
relative path so the app's preflight (Stage 2) can refuse to install when
`len(installRoot) + maxRelativePathLength + 1 > 259` and name the policy setting. The build prints
the resulting root budget. Symptoms Stage 0 measured when the budget is blown: `python.exe` at a
257-char path dies with `0xC0000106 STATUS_NAME_TOO_LONG` before printing anything; a 206-char root
starts Python but `import torch` fails with `ModuleNotFoundError` on a 350-char file.

## Reproducibility

- Locks pin every distribution with sha256 hashes; `uv pip sync` verifies them.
- The resolution is pinned to `--python-version 3.11 --python-platform x86_64-pc-windows-msvc`, so the
  lock does not depend on which interpreter runs uv.
- The zip walks entries in sorted order with one fixed timestamp (`YYYY-MM-01` from the version), so
  the same tree gives the same bytes and the same sha256 on any box.
- `lockSha256` in the manifest is computed over the lock text with LF line endings, so it matches
  on CRLF and LF checkouts alike.
- The interpreter is whatever `uv python install 3.11` provides (python-build-standalone; build date
  recorded as `pythonBuild`). A newer patch release changes the zip — bump the runtime version then.

## Gotchas (all measured in Stage 0, all handled by the scripts)

1. uv-managed interpreters ship `Lib\EXTERNALLY-MANAGED`; `uv pip sync` refuses to touch them.
   The build deletes the marker from the copy.
2. `uv pip sync` does not re-read `--extra-index-url` from the compile step, and PyPI alone cannot
   resolve `torch==2.14.0+cu126`. The locks embed the index URLs (`--emit-index-url`) and the build
   passes `--index-strategy unsafe-best-match`.
3. `antlr4-python3-runtime` (via omegaconf) is sdist-only. It is pure Python, uv builds it in seconds,
   and uv's cache keeps the wheel. Do **not** add `--only-binary :all:`.
4. The stack's `Scripts\*.exe` launchers embed the build path in their shebang. Nothing in the app
   runs them (`python.exe runner.py` only), so they are left alone.
5. `ready` is emitted after `import torch`, **before** the pipeline imports (~4 s warm, ~100 s on the
   first launch of fresh files). Stage 2's install step must run `--selftest` **and** a warm-up import
   so the user's first generation is not the slow one.
6. The `cpu` variant on a box with an NVIDIA GPU correctly reports `cuda:false` — torch+cpu has no
   CUDA at all. To exercise the CPU path of the **cu126** build use `CUDA_VISIBLE_DEVICES=-1`.

## Licences

Every third-party notice is inside the zip under `licenses\`. Headline terms: CPython (PSF-2.0),
PyTorch (BSD-3-Clause), NVIDIA CUDA/cuDNN/cuBLAS redistributables in the cu126 variant (NVIDIA
EULA, redistribution permitted with the notices), transformers (Apache-2.0), rembg (MIT),
onnxruntime (MIT), scikit-image (BSD-3-Clause), trimesh (MIT). The vendored TripoSR inference code
in `resources/pipelines/triposr/tsr/` is MIT (`LICENSE` alongside). Model weights are never
re-hosted: they download from the original Hugging Face / GitHub release URLs with sha256 checks.

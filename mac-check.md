# Mac Build Checklist — Audio Engine (sherpa-onnx)

## 1. Install Mac platform packages

Currently only `sherpa-onnx-win-x64` is in `package.json` dependencies.
On Mac, add the appropriate platform package:

```bash
# On Apple Silicon (M1/M2/M3):
npm install sherpa-onnx-darwin-arm64

# On Intel Mac:
npm install sherpa-onnx-darwin-x64

# Or add both to package.json for universal builds:
# "sherpa-onnx-darwin-arm64": "^1.12.35",
# "sherpa-onnx-darwin-x64": "^1.12.35",
```

## 2. macOS dynamic library path (DYLD_LIBRARY_PATH)

On Windows, our `loadSherpa()` in `src/audio-engine/audio-engine.ts` prepends
the DLL directory to `PATH`. On macOS, the equivalent is `DYLD_LIBRARY_PATH`.

**Current code only handles Windows.** Add a macOS block:

```typescript
// In loadSherpa(), after the Windows block:
if (process.platform === 'darwin') {
  const arch = process.arch;
  const pkgName = `sherpa-onnx-darwin-${arch}`;
  // same possibleDirs pattern as Windows
  // set process.env.DYLD_LIBRARY_PATH instead of PATH
}
```

However, note that macOS **System Integrity Protection (SIP)** strips
`DYLD_LIBRARY_PATH` from child processes. In a packaged Electron app the
.dylib files are in the same directory as the .node file, so the loader
usually finds them. **Test this on Mac** — if it fails, the fix is to use
`install_name_tool` to patch the .dylib rpaths at build time, or copy
the .dylib files next to the Electron binary.

## 3. electron-builder.yml — already configured

The `asarUnpack` and `files` sections already include:
- `node_modules/sherpa-onnx-darwin-x64/**`
- `node_modules/sherpa-onnx-darwin-arm64/**`

No changes needed in `electron-builder.yml`.

## 4. Code signing and notarization

macOS Gatekeeper may quarantine the native `.node` binary and `.dylib` files.
When setting up code signing:
- Ensure **all** `.node` and `.dylib` files inside `sherpa-onnx-darwin-*`
  are signed with your Developer ID certificate
- The `electron-builder` `afterSign` hook or `mac.hardenedRuntime` config
  handles this for most cases
- Add entitlements if needed:
  ```
  com.apple.security.cs.allow-unsigned-executable-memory
  com.apple.security.cs.disable-library-validation
  ```

## 5. Universal binary (fat build)

If building a universal dmg (`arch: [arm64, x64]`), electron-builder will
create two app bundles. Each needs its own platform-specific sherpa package.
Make sure both `sherpa-onnx-darwin-arm64` and `sherpa-onnx-darwin-x64` are
in `package.json` dependencies.

## 6. Quick test on Mac

After installing the platform package, run:
```bash
node -e "const s = require('sherpa-onnx-node'); console.log('version:', s.version)"
```

If this prints the version, the native addon loads correctly.
If it fails with a dylib error, set:
```bash
export DYLD_LIBRARY_PATH=./node_modules/sherpa-onnx-darwin-$(uname -m)/lib:$DYLD_LIBRARY_PATH
```

---

# Mac Build Checklist — LLM Engine (node-llama-cpp)

## 1. Install Mac prebuilt binary packages

On Windows we manually extracted the prebuilt packages because npm won't
install cross-platform optional deps. On Mac, the native packages install
normally:

```bash
# On Apple Silicon (M1/M2/M3):
npm install @node-llama-cpp/mac-arm64-metal@3.18.1

# On Intel Mac:
npm install @node-llama-cpp/mac-x64@3.18.1
```

If npm still refuses (due to `optionalDependencies` deduplication), use the
same pack+extract approach we used on Windows:

```bash
npm pack @node-llama-cpp/mac-arm64-metal@3.18.1
mkdir -p node_modules/@node-llama-cpp/mac-arm64-metal
tar xzf node-llama-cpp-mac-arm64-metal-3.18.1.tgz \
  -C node_modules/@node-llama-cpp/mac-arm64-metal --strip-components=1
rm node-llama-cpp-mac-arm64-metal-3.18.1.tgz
```

**Version must match `node-llama-cpp@3.18.1` exactly.**

## 2. electron-builder.yml — already configured

The `asarUnpack` and `files` sections already include:
- `node_modules/node-llama-cpp/**`
- `node_modules/@node-llama-cpp/**`

No changes needed.

## 3. GPU backend

- **Apple Silicon**: Metal is used automatically (very fast, ~5 MB package)
- **Intel Mac**: CPU-only (no Metal support on Intel Macs)

The engine code already passes `gpu: "auto"` to `getLlama()`, so Metal
is picked up automatically on ARM64.

## 4. Code signing and notarization

The `@node-llama-cpp/mac-arm64-metal` package contains native `.node` binaries
and `.dylib` files. Ensure they are:
- Signed with your Developer ID certificate
- Included in notarization

Add entitlements if needed:
```
com.apple.security.cs.allow-unsigned-executable-memory
com.apple.security.cs.disable-library-validation
```

## 5. Quick test on Mac

```bash
node --experimental-vm-modules -e "
  import('node-llama-cpp').then(async ({ getLlama }) => {
    const llama = await getLlama({ gpu: 'auto' });
    console.log('GPU:', llama.gpu);
    console.log('Devices:', await llama.getGpuDeviceNames());
    await llama.dispose();
  });
"
```

Should print `GPU: metal` on Apple Silicon.

## 6. Package sizes

| Package | Size |
|---------|------|
| `mac-arm64-metal` | 5.2 MB |
| `mac-x64` (Intel, CPU) | ~35 MB |

---

# Mac Build Checklist — Image Engine (sd-cli)

## 1. sd-cli binary for macOS

Currently `resources/binaries/` contains `sd-cli.exe` and `stable-diffusion.dll`
(Windows only). For Mac:

- Build or obtain `sd-cli` (no extension) for macOS
- Place in `resources/binaries/sd-cli`
- The code in `sdimage-models.ts` already handles platform detection:
  ```ts
  const ext = process.platform === 'win32' ? '.exe' : '';
  ```

## 2. No additional code changes needed

The image engine spawns `sd-cli` as a child process — it's platform-agnostic
as long as the binary exists at the expected path.

---

---

# Mac Build Checklist — Embedded Python 3.13

## 1. Download standalone Python builds

There is no official "embeddable" Python for macOS (that's Windows-only).
Use **python-build-standalone** from Gregory Szorc:
https://github.com/indygreg/python-build-standalone/releases

Download the `install_only` tarballs for Python 3.13:

```bash
# Apple Silicon (M1/M2/M3/M4):
curl -L -o python-darwin-arm64.tar.gz \
  "https://github.com/indygreg/python-build-standalone/releases/download/20250409/cpython-3.13.3+20250409-aarch64-apple-darwin-install_only.tar.gz"

# Intel Mac:
curl -L -o python-darwin-x64.tar.gz \
  "https://github.com/indygreg/python-build-standalone/releases/download/20250409/cpython-3.13.3+20250409-x86_64-apple-darwin-install_only.tar.gz"
```

> **Note:** Check the releases page for the latest date tag. The URL format is:
> `cpython-{version}+{date}-{arch}-apple-darwin-install_only.tar.gz`

## 2. Extract into resources/python/

```bash
# Apple Silicon:
mkdir -p resources/python/darwin-arm64
tar xzf python-darwin-arm64.tar.gz -C resources/python/darwin-arm64 --strip-components=1

# Intel:
mkdir -p resources/python/darwin-x64
tar xzf python-darwin-x64.tar.gz -C resources/python/darwin-x64 --strip-components=1

# Clean up
rm python-darwin-arm64.tar.gz python-darwin-x64.tar.gz
```

After extraction, the layout should be:
```
resources/python/darwin-arm64/
  bin/python3          ← the executable
  lib/python3.13/      ← stdlib
  lib/libpython3.13.dylib
  ...
resources/python/darwin-x64/
  bin/python3
  lib/python3.13/
  ...
```

## 3. electron-builder.yml — already configured

The per-platform extraResources are set up:
```yaml
mac:
  extraResources:
    - from: resources/python/darwin-${arch}
      to: python
```

electron-builder substitutes `${arch}` with `arm64` or `x64` based on the
target architecture, so each build gets only the right Python.

## 4. Code — already handles macOS

`src/main/utils/paths.ts` resolves the correct binary:
- Production: `{resourcesPath}/python/bin/python3`
- Dev: `resources/python/darwin-{arch}/bin/python3`

## 5. Code signing

The python3 binary and all .dylib files must be signed:
- electron-builder usually signs everything in extraResources automatically
- If notarization fails, add entitlements:
  ```
  com.apple.security.cs.allow-unsigned-executable-memory
  com.apple.security.cs.disable-library-validation
  ```

## 6. Size estimates

| Platform | Compressed | Extracted |
|----------|-----------|-----------|
| darwin-arm64 | ~30 MB | ~100 MB |
| darwin-x64 | ~30 MB | ~100 MB |
| win-x64 (embeddable) | ~11 MB | ~40 MB |

## 7. Quick test on Mac

```bash
./resources/python/darwin-$(uname -m)/bin/python3 --version
# Should print: Python 3.13.3
```

---

# Mac Build Checklist — PyTorch

## 1. PyTorch wheels for macOS

PyTorch macOS wheels are CPU-only (no CUDA on Mac). MPS (Metal) is supported
on Apple Silicon but is included in the standard wheel.

The download URLs in `use-system-info.ts` need macOS variants:
- `torch-{version}-cp313-cp313-macosx_11_0_arm64.whl` (Apple Silicon)
- `torch-{version}-cp313-cp313-macosx_10_13_x86_64.whl` (Intel)

Host these on `learnwithhasan.com/api/vidtsx/pytorch/` alongside the Windows wheels.

## 2. Install flow differences

- No CUDA option on macOS — only show "Install CPU" (MPS is included)
- The system-info service already returns `cudaVersion: null` on Mac,
  so the GPU install button is automatically disabled
- Wheel extraction works the same (.whl is a zip)

## 3. PYTHONPATH

The `system-info.ts` service already sets `PYTHONPATH` to `python-packages/`
when running Python to detect PyTorch version. This works on both platforms.

---

# Summary of all changes needed for Mac

| Engine | What | Where | Action |
|--------|------|-------|--------|
| Audio | Platform package | `package.json` | Add `sherpa-onnx-darwin-arm64` and/or `sherpa-onnx-darwin-x64` |
| Audio | DYLD_LIBRARY_PATH | `src/audio-engine/audio-engine.ts` | Add macOS block in `loadSherpa()` |
| Audio | Code signing | `electron-builder.yml` | Ensure native binaries are signed |
| LLM | Prebuilt package | `node_modules/` | Install `@node-llama-cpp/mac-arm64-metal@3.18.1` |
| LLM | Code signing | `electron-builder.yml` | Ensure .node and .dylib files are signed |
| Image | sd-cli binary | `resources/binaries/` | Add macOS `sd-cli` binary |
| Python | Standalone build | `resources/python/darwin-*/` | Download from python-build-standalone, extract arm64 + x64 |
| Python | Code signing | `electron-builder.yml` | Ensure python3 binary and .dylib files are signed |
| PyTorch | macOS wheels | `learnwithhasan.com` CDN | Host macOS .whl files (CPU only, MPS included) |
| All | Test | Terminal | Run quick tests for each engine |
# Hardware video encoding on Windows (NVENC / QSV / AMF) — known limitation

Status: **Not supported as of Remotion 4.0.435**. This doc captures what we verified, why the current `hardwareAcceleration` setting is effectively a no-op on Windows/Linux, and what it would take to actually use an NVIDIA RTX (or Intel/AMD) hardware encoder in the future.

## The short version

- Remotion's `renderMedia({ hardwareAcceleration: 'if-possible' })` is **macOS-only** (VideoToolbox). On Windows and Linux it is silently ignored and always falls back to `libx264` / `libx265` (CPU).
- Remotion ships its own bundled ffmpeg at `node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe`. That binary is compiled **without** `h264_nvenc`, `h264_qsv`, or `h264_amf` — so even if Remotion's code picked a hardware encoder, the binary would error out.
- The resolved encoder is surfaced in the Render Queue details panel (via `ffmpegOverride` in [remotion-renderer.ts](../src/main/services/remotion-renderer.ts)). On Windows this row will always show `libx264 [CPU]` — that's the ground truth, not a display bug.
- **What IS working on Windows**: the GPU *frame rendering* backend (`chromiumOptions.gl`) via ANGLE/Vulkan. That path is entirely separate from ffmpeg and does use the GPU for WebGL/Three.js scenes. That's the real win for RTX users today.

## How we verified

1. Read Remotion's codec selector at [`node_modules/@remotion/renderer/dist/get-codec-name.js`](../node_modules/@remotion/renderer/dist/get-codec-name.js) — every hardware branch is gated on `process.platform === 'darwin'`:

   ```js
   if (codec === 'h264') {
     if (preferredHwAcceleration && process.platform === 'darwin' && !unsupportedQualityOption) {
       return { encoderName: 'h264_videotoolbox', hardwareAccelerated: true };
     }
     return { encoderName: 'libx264', hardwareAccelerated: false };
   }
   ```

2. Ran `ffmpeg.exe -encoders` on the bundled compositor binary. Video encoders present: `libx264`, `libx265`, `libvpx`, `libvpx-vp9`, `prores_ks`, `gif`, `mjpeg`, `png`, `rawvideo`. **No `*_nvenc`, `*_qsv`, `*_amf`, `*_videotoolbox`, `*_vaapi` entries.**

3. Confirmed against Remotion's public docs:
   > "Currently, only macOS is supported (Acceleration using VideoToolbox)"
   > — https://www.remotion.dev/docs/hardware-acceleration
   - H.264/H.265 hwaccel: added in v4.0.236 — macOS only
   - ProRes hwaccel: added in v4.0.228 — macOS only

4. Side note: NVENC also doesn't accept CRF-based rate control. Remotion's own `hasSpecifiedUnsupportedHardwareQualifySettings()` flags `crf` as incompatible with hardware acceleration. Our UI exposes CRF as the Quality knob, so even on macOS the current wiring silently disables hwaccel whenever a CRF is set (which is always).

## Current state in the codebase

We ship the `hardwareAcceleration` setting end-to-end (Settings default + per-render override), plumbed through:
- [src/shared/ipc/types.ts](../src/shared/ipc/types.ts) — `RenderHardwareAcceleration`
- [src/main/services/settings.ts](../src/main/services/settings.ts) — persisted default `'if-possible'`
- [src/main/services/remotion-renderer.ts](../src/main/services/remotion-renderer.ts) — passed to `renderMedia`
- [src/shared/components/RenderSettingsModal.tsx](../src/shared/components/RenderSettingsModal.tsx) — dropdown
- [src/renderer/components/SettingsScreen.tsx](../src/renderer/components/SettingsScreen.tsx) — default

On Windows this is a no-op at the ffmpeg layer, but the plumbing is correct and macOS users will benefit. Keeping it wired avoids a breaking schema change when Remotion eventually adds Windows support.

We also hardcode `x264Preset: 'veryfast'` in the renderMedia call — that IS a real Windows speed win (~2× faster CPU encode at ~10–15% larger files for the same CRF) and is fully active regardless of platform.

Encoder ground-truth detection is wired via `ffmpegOverride` — the details panel in the Render Queue shows the resolved encoder name plus a GPU/CPU badge. This will keep working correctly if/when NVENC is ever selected.

## Options for a future "real NVENC on Windows" milestone

### Option A — Custom ffmpeg + `ffmpegOverride` + `binariesDirectory`

Ship (or detect on the user's system) a full ffmpeg build that includes `h264_nvenc` / `h264_qsv` / `h264_amf`, point Remotion at it via the `binariesDirectory` option on `renderMedia`, and use the `ffmpegOverride` hook to rewrite the stitcher args:

- Replace `-c:v libx264` → `-c:v h264_nvenc` (or `_qsv` / `_amf` based on detected hardware)
- Strip `-crf <n>` — NVENC doesn't accept CRF
- Add `-b:v <bitrate>` with a CRF-to-bitrate mapping (needs a quality table we define)
- Add `-preset p5` / `-tune hq` (NVENC presets) or equivalent QSV/AMF flags
- Keep pixel format, colorspace, muxer args unchanged

**Pros:** Works today on Remotion 4.x without waiting upstream. Genuine NVENC speed (often ~5× faster encode on fast GPUs).
**Cons:**
- ~100 MB bundle bloat if we ship our own ffmpeg (gyan.dev/BtbN essentials build)
- Fragile — Remotion could change its args layout in any minor version
- Need a per-vendor detection step (probe `ffmpeg -encoders` at app start)
- Quality mapping from CRF→bitrate is approximate; would want per-preset tuned tables
- GIF and ProRes paths should bypass entirely (no hardware path)
- Two-pass codecs (if Remotion uses pre-stitcher + stitcher) need both phases handled

Rough implementation order when we pick this up:
1. Add `detectHardwareEncoders()` in a new main-process service that probes `ffmpeg -encoders` against whichever binary we end up using
2. Surface the detected vendor (NVIDIA/Intel/AMD) in Settings so the UI can show "NVENC available" instead of the misleading "If possible"
3. Decide: bundle our own ffmpeg (simpler, fat) vs detect a system ffmpeg (leaner, user-setup cost)
4. Write the `ffmpegOverride` rewriter with unit tests for each codec path
5. Build a CRF→bitrate quality table for h264/h265 + add a user-facing "target bitrate" Quality mode alongside the existing CRF Quality mode
6. Keep the UI honest — only advertise hardware encoding on machines where probe succeeds

### Option B — Post-render re-encode

Let Remotion produce its CPU-encoded MP4, then immediately re-encode with NVENC using a second ffmpeg pass. No Remotion internals touched.

**Pros:** Decoupled from Remotion's internals; survives Remotion upgrades; simpler to prototype.
**Cons:** Double-encode = quality loss unless we bump bitrate significantly; doubles disk I/O; only a net win on very long renders where CPU encoding is the bottleneck (our scenes are typically dominated by frame rendering, not encoding). Not recommended unless we see real data showing encode is the bottleneck for common user scenes.

### Option C — Wait for Remotion

Track the Remotion roadmap / GitHub issues. If they add Windows NVENC support natively, the existing `hardwareAcceleration: 'if-possible'` plumbing will just start working with zero code changes on our side.

## What to do in the meantime

- **UI copy**: add a platform-aware note next to the HW encoding setting when `process.platform !== 'darwin'`, something like "macOS only — ignored on this platform (see docs)". The dropdown itself stays (macOS users need it); the hint gets honest.
- **Keep the encoder-resolved row** in the Render Queue details panel — it's the single source of truth a user can look at to confirm what ffmpeg actually ran.
- **Keep `x264Preset: 'veryfast'`** — real Windows speed win, unrelated to this issue.
- **Don't regret the plumbing** — when Option A or Remotion's upstream fix lands, the IPC/settings/UI chain is already in place.

## References

- Remotion hardware acceleration docs: https://www.remotion.dev/docs/hardware-acceleration
- `renderMedia()` options: https://www.remotion.dev/docs/renderer/render-media
- Remotion GPU docs (Chromium-level, not encoding): https://www.remotion.dev/docs/gpu
- Internal code reviewed:
  - `node_modules/@remotion/renderer/dist/get-codec-name.js` — the darwin gating
  - `node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe` — no HW encoders in bundled binary

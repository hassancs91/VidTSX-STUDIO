# Third-party notices

Components the app fetches **on request** rather than bundling. Nothing below
is included in the installer; each is downloaded only when the user clicks the
corresponding button in Settings, and each keeps its own licence file next to
the binaries it ships with.

## FFmpeg (full build, GPU proxy encoder) — GPL v3

Used by: Settings › Rendering › *Faster proxy generation (GPU encoder)*.

VidTSX Studio's bundled ffmpeg is Remotion's stripped build and has no
hardware encoders. When the user opts in, the app downloads a full FFmpeg
build published by the BtbN FFmpeg-Builds project and uses it **only** to
encode Studio preview proxies (NVENC / Quick Sync / AMF). Exports still go
through Remotion's own binary.

| | |
|---|---|
| Build | `ffmpeg-n8.1.2-50-g1a748fe2cd-win64-gpl-shared-8.1.zip` (BtbN autobuild 2026-08-31) |
| Source | https://github.com/BtbN/FFmpeg-Builds — build scripts, and https://ffmpeg.org for FFmpeg's source |
| Licence | GNU General Public License v3 (built with `--enable-gpl --enable-version3`; the full text is `LICENSE.txt` inside the download, kept beside `bin/ffmpeg.exe` under the app's user-data folder `ffmpeg-full/`) |
| Integrity | SHA-256 `0a41f31caff48e3035b48f09f5d840bd8d1863008240fc43e457f15e589cf5b3`, verified by the app before extraction |

The app runs this build as a separate process and does not link against it.
It is not modified. Per the GPL, the complete corresponding source for this
build is available from the two repositories above.

FFmpeg is a trademark of Fabrice Bellard, originator of the FFmpeg project.

## stable-diffusion.cpp (`sd-cli`) — MIT

Used by: AI Models › local image generation. Downloaded from the official
`leejet/stable-diffusion.cpp` release on first use; its licence `.txt` files
are kept alongside the binaries under the app's user-data folder `sd-cli/`.

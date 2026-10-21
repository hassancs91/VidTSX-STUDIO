# Recorder design — screen · camera · mic · system audio, straight into Studio

> Written 2026-10-04 from Hasan's brief: **"the best and the smoothest screen
> and camera recording tool that integrates with VidTSX Studio."** Same
> pattern as `PREVIEW_ARCHITECTURE.md` / `ASSET_LIBRARY_DESIGN.md`: verified
> facts first, then the decisions each with a named recommendation, then a
> checklist that is answerable inline. **Nothing here is DECIDED until Hasan
> marks it.**
>
> Supersedes the one-line "Screen / window capture" entry in
> `V2_FEATURES.md` (Capture & recording) and the "Screen Recorder" row in
> `ROADMAP.md`. The fake-screencast skill port (pan/zoom/cursor shots over
> captures) stays in the V2 ledger and is this doc's P5.
>
> Facts marked **[verified]** were read from the installed binaries and the
> code today. Facts marked **[spike]** are expected from Chromium's public
> behaviour but have NOT been measured in our runtime on this machine; P0
> exists to read them, and no UI is built before P0 answers.
>
> **Rev 1 — 2026-10-04, Hasan's answers.** The checklist in §5 is ANSWERED
> except the audio-format default (R4a, now an option — see R4). Two
> amendments from the review: the microphone rides **inside the camera file**
> (or the screen file when no camera is on), split later with Studio's
> existing *Detach audio*; and the entry points are the Recorder screen and
> Studio's Record button (the hotkey is a control while the recorder is open,
> not an entry). §6 answers the question "can Electron do this without lags,
> breaks or stops?" with the failure modes and what each one costs us.
>
> **Rev 2 — 2026-10-04, "confirm".** Hasan confirmed the remaining defaults
> (Compressed audio by default, 60 fps, the overlay preset, the 1080p cap, the
> share MP4, the hotkeys, the build order). **This doc is DECIDED and
> implementation-ready; the build has NOT started** ("we will work on this
> later"). §7 is the list of what is still missing — decisions nobody has
> taken yet, unknowns P0 must read, and the Studio, platform and test work the
> build will need — kept here so picking this up cold needs only this file.

---

## 0. The one property that must survive

"Smooth" is five measurable things, and the design is judged on them:

| # | Property | How it is measured | Target |
|---|---|---|---|
| S1 | **Constant frame rate** at the chosen fps (30 / 60): no dropped runs, no duplicated runs, no variable-rate file | frame-interval histogram over the recording (ffprobe `-show_frames` pts deltas) + the encoder's dropped-frame counter | ≤ 0.1 % of frames late or dropped over 10 min at 1080p60 |
| S2 | **GPU encode** — the CPU is left to the thing being recorded | CPU % of the whole app while recording 1440p60 of a moving scene | ≤ 15 % of one core-equivalent on the 1650 Ti laptop |
| S3 | **Zero A/V offset across every stream** — mic, system audio, camera and screen agree | a clap in front of the camera, measured with `scripts/bench/t1-audio-offset.mjs` (mic vs system vs camera) and a visible flash frame (screen vs camera) | 0 ms at every window; ≤ 1 frame picture-to-picture |
| S4 | **Crash-safe** — a recording is playable up to the last second written, even if the app dies | kill the process mid-recording; recover on the next launch | every recovered file probes and plays |
| S5 | **Instant hand-off** — the recording is on a Studio timeline, scrubbable, seconds after Stop | wall time from Stop to a scrubbable timeline | ≤ 5 s + the proxy job in the background |

And one product thesis, which decides half of the rows below:

> **The recorder makes material; Studio makes the video.** Screen, camera,
> microphone and system audio are recorded as *separate masters* and land on
> the timeline as separate, synchronised clips. The camera bubble, the zoom,
> the cursor highlight and the captions are Studio shots and filters — the
> same things the agent already authors — not pixels baked into a recording.
> That is what makes this recorder "integrate": every editing decision stays
> editable, and the assistant can read and change it.

---

## 1. Verified facts (2026-10-04)

### 1.1 Platform — Electron 41.0.2 = Chromium 146.0.7680.72 [verified from `electron.exe`]

- `desktopCapturer.getSources({ types: ['screen' | 'window'], thumbnailSize, fetchWindowIcons })`
  returns `{ id, name, display_id, thumbnail, appIcon }` per source — enough for
  our own picker grid. **[verified, electron.d.ts]**
- `session.setDisplayMediaRequestHandler((request, callback) => callback({ video, audio }))`
  is how `navigator.mediaDevices.getDisplayMedia()` is answered in Electron;
  the request carries `videoRequested / audioRequested / userGesture`.
  `audio: 'loopback' | 'loopbackWithMute'` captures **system audio, Windows
  only**. `useSystemPicker` is macOS 15+ only and experimental. **[verified]**
- The main window's session has **no permission handlers today** — only the two
  hardened helper windows (`library/capture-window.ts`,
  `agents/web-page-capture.ts`) deny everything on their own in-memory
  sessions. So camera and microphone `getUserMedia` work in the app on Windows
  with no prompt. macOS needs Camera, Microphone and Screen Recording consent
  (`systemPreferences.getMediaAccessStatus / askForMediaAccess`) and Info.plist
  usage strings (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`,
  `NSAudioCaptureUsageDescription` on 14.2+); `electron-builder.yml`'s mac
  block carries none of them yet. **[verified]**
- Nothing in `src/main` uses `globalShortcut`, `Tray`, `powerSaveBlocker`,
  `setAlwaysOnTop` or `setContentProtection` yet; the helper windows do set
  `backgroundThrottling: false` (the precedent for an engine window). The
  renderer has ONE html entry (`src/renderer/index.html`); the preload build
  already has two entries (`preload`, `preview-preload`), so a second page with
  its own preload is a config addition, not a new mechanism. **[verified]**
- Chromium 146 ships WebCodecs (`VideoEncoder` with
  `hardwareAcceleration: 'prefer-hardware'`, `latencyMode`, `bitrateMode`,
  `avc: { format }`), `MediaStreamTrackProcessor` (capture-track frames as
  `VideoFrame` objects, usable in a Worker), and `MediaRecorder` for
  `video/webm` and `video/mp4`. Which hardware encoders Media Foundation
  exposes on the 1650 Ti, whether `MediaRecorder` MP4 engages them, whether the
  `cursor` constraint is honoured for desktop sources, and whether the Windows
  11 build suppresses the yellow capture border around a captured window: **all
  [spike]**.
- Windows capture inside Chromium is Windows Graphics Capture (WGC) with a
  DXGI fallback. It delivers frames **only when the content changes** — the
  source is variable-rate by nature — and it renders the cursor into the frame.
  **[spike for the exact behaviour on this machine]**
- `BrowserWindow.setContentProtection(true)` excludes a window from capture on
  Windows (`WDA_EXCLUDEFROMCAPTURE`): the control bar and the camera bubble can
  be invisible to the recording. **[spike]**

### 1.2 The bundled ffmpeg — Remotion's stripped build [verified by probing `compositor-win32-x64-msvc/ffmpeg.exe`]

| Has | Has not |
|---|---|
| demuxers `matroska,webm` · `mov,mp4` · `mpegts` · `concat` · raw `h264` · `hevc` · `aac` · `flac` · `wav` · `s16le` · `f32le` · `image2pipe` | — |
| muxers `mp4` · `mov` · `matroska` · `webm` · `mpegts` · `wav` | **no `flac` muxer** |
| encoders `libx264` · `libx265` · `libvpx` / `-vp9` · `prores_ks` · `aac` · `libfdk_aac` · `libopus` · `libmp3lame` · `pcm_s16le` | **no hardware encoders** (known), no `flac`, no AV1 |
| audio filters `amix` · `amerge` · `aresample` · `adelay` · `atrim` · `apad` · `volume` · `pan` · `loudnorm` · `asetpts` | — |
| video filters `crop` · `scale` · `format` · `concat` | **no `overlay`**, no `fps`, no `select`, no `tpad`, no video `setpts` |
| input devices `gdigrab` · `dshow` · `vfwcap` · `lavfi` | `ddagrab` (Desktop Duplication) exists only in the full BtbN build that the GPU-proxy opt-in downloads (`ffmpeg-full.ts`, 80 MB, GPL) |
| hwaccels `d3d11va` · `dxva2` (decode only) | — |

Consequences: the bundled binary can **remux, concatenate, trim and mix
audio** for a finishing pass, but it can **composite no picture** (no
`overlay`) — a camera bubble can only be baked by a Studio export, which is
the thesis anyway. `gdigrab` is a CPU GDI BitBlt path (no GPU, no HDR, weak
above 1080p30), so an ffmpeg-native capture is not a candidate for
"smoothest" without the GPL download, and even then it is Windows-only and
monitor-only.

### 1.3 Studio — what a recording has to fit [verified in code]

- `StudioMediaAsset` is **referenced in place**: absolute `path` + `probe`
  (`duration, width, height, fps, hasAudio, codec`) + `hash` (first MiB) +
  cache files (thumb, proxy, waveform, transcript). The probe takes the FIRST
  audio stream and `hasAudio` is a boolean: **one audio stream per file** is
  the supported shape — a 4-stream recording must be four files, not one.
- Import is `importMediaFiles(projectId, paths)` (probe + thumb, no copy); the
  renderer merges the assets into `project.assets`, then `useStudioMedia` asks
  the media job engine for 540p all-intra proxies and waveforms (two
  concurrent ffmpeg jobs, below-normal priority; the GPU encoder when the
  opt-in is on). Transcripts run only from an explicit user action.
- Clips are `timelineStart / duration / sourceIn` in seconds with `transform`,
  `gain`, `effects`; tracks are `video | overlay | audio | caption`; multi-clip
  group ops exist (`timeline-group-ops.ts`) — a session can land as a
  synchronised set of clips and move as one.
- Studio root is a user-chosen folder (default `~/Videos/VidTSX Studio`) with
  `projects/<slug>/`; the cross-project Assets screen is over `userData/assets`.
- Measurement tooling exists: `scripts/bench/t1-audio-offset.mjs`
  (cross-correlation offset), `t1-audio-level.mjs`, `t1-audio-residual.mjs`,
  and the frame diff used by the export gates. The recorder's sync gate reuses
  them.

---

## 2. The engine — four ways to turn a screen into a file

| | **A. `MediaRecorder`** | **B. WebCodecs + muxer** (recommended) | **C. ffmpeg device capture** | **D. Native addon** |
|---|---|---|---|---|
| How | `getDisplayMedia` → `MediaRecorder(stream, {mimeType})` → blobs | `getDisplayMedia` / `getUserMedia` → `MediaStreamTrackProcessor` → paced `VideoEncoder` (hardware) → fragmented-MP4 muxer in JS → bytes streamed to main → file | spawn ffmpeg with `gdigrab` (bundled) or `ddagrab` + NVENC (full build) and `dshow` for camera/mic | WGC / ScreenCaptureKit via a N-API module we ship |
| Frame pacing | none — encodes frames as WGC emits them (variable rate), keyframes on Chromium's schedule | **ours** — a fixed-rate clock submits the latest frame (holds the last frame on a static screen), keyframe every 2 s, per-stream timestamps on one clock | ffmpeg's `-framerate` (gdigrab polls GDI) | ours |
| Quality control | `videoBitsPerSecond` only | bitrate / quantizer mode, `latencyMode: 'quality'`, profile, resolution and **region crop** (`new VideoFrame(frame, { visibleRect })`, zero copy) | full | full |
| Hardware encode | when Chromium picks it (opaque) | `prefer-hardware` (Media Foundation: NVENC / QSV / AMF), software fallback (OpenH264 for H.264, libvpx / libaom for VP9 / AV1) | only the GPL download | yes |
| Container out | WebM (no cues / duration until remuxed) or MP4 (Chromium 126+, where platform codecs exist) | fMP4 we write — crash-safe, real timestamps, finished with `-c copy -movflags +faststart` | anything | anything |
| Camera / mic / system audio | same `getUserMedia` + loopback as B | same | `dshow` device strings (fragile); no WASAPI loopback in ffmpeg on Windows without a virtual device | OS APIs |
| Cross-platform | yes | yes (system audio Windows-only in both — Electron's limit, not ours) | Windows-only | per-OS code |
| New dependency | none | **one pure-TS muxer** (`mediabunny`, MIT, pinned) — or none with the B2 variant below | none (bundled) / GPL download | native build per Electron ABI, supply chain |
| Verdict | the **fallback** if B fails its gate; 1 day of work; cannot meet S1 by design | **recommended** — the only option that owns S1–S3 end to end and stays cross-platform | no — CPU path or GPL + Windows-only | no — out of proportion to the gain while B exists |

**B2 — the no-dependency variant of B:** pipe Annex-B H.264 from the
`VideoEncoder` into the bundled ffmpeg's raw `h264` demuxer over stdin
(`-f h264 -r 60 -i pipe:0 -c copy -movflags frag_keyframe+empty_moov`). It
removes the muxer dependency, but raw H.264 carries **no timestamps**: ffmpeg
assigns them at `-r`, so one missed frame shifts the rest of the file by one
frame forever, and a second audio input needs a Windows named pipe. Kept as a
documented escape hatch; not the recommendation.

Why B is "smooth" and A is not, in one sentence: A encodes whatever WGC emits
whenever it emits it; B decides when a frame is encoded, so the file is CFR by
construction and every stream shares one clock.

---

## 3. Decisions

Each decision: options → **recommendation** → why. Answers go in §5.

### R1 — Engine
**B, WebCodecs + fMP4 muxer, with P0 as a hard gate** (§4). If P0 cannot
reach S1 at 1080p60 on the 1650 Ti laptop with hardware encode engaged, v1
ships **A** behind the same UI and the same finishing / hand-off path, and B
returns as the engine upgrade. The UI, the session format, the sinks and
Studio's side never know which engine produced the bytes.

### R2 — Where capture runs: a dedicated hidden engine window
Options: (a) inside the main app renderer, next to Studio; (b) a **hidden
`BrowserWindow` of its own** (`recorder-engine.html`, a few hundred lines, its
own preload, `backgroundThrottling: false`), the pattern of
`webp-frame-encoder.ts` and `capture-window.ts`; (c) a utility process (no DOM
→ no `getDisplayMedia`, so not possible).

**(b).** The main renderer carries React, the Remotion Player, proxies and
DevTools; minimising it throttles its timers; a Studio renderer crash would end
the recording. The engine window owns `getDisplayMedia` / `getUserMedia`, the
track processors, the encoders and the muxers, and streams finished bytes to
main over IPC (`ArrayBuffer` chunks, ~1.5 MB/s at 12 Mbps — trivial). Main
owns the files, the clock-of-record, the hotkeys and the hand-off. The control
bar and the Studio UI are remote controls: they can close, hide or crash
without touching the recording.

### R3 — Streams are separate masters, plus one session manifest
Options: (a) one MP4 with the camera baked into a corner and one mixed audio
track (what most recorders do); (b) one MP4 with several audio streams; (c)
**separate files per stream + `session.json`**.

**(c), with the microphone riding inside the camera file** (Hasan, Rev 1).
Studio supports one audio stream per file (§1.3) and the camera bubble must
stay movable and resizable after the fact (thesis). The microphone is the one
stream that is *not* its own file: it is muxed into the **camera** file, or
into the **screen** file when no camera is on, so the talking-head clip is a
normal video-with-voice clip anywhere, and Studio's existing right-click
**Detach audio** (`clip-update-ops.ts` `detachAudio`) splits it onto its own
audio track whenever the edit needs that. System audio is always its own
file, because it is the stream people most often mute or replace. A session
folder holds:

```
<studioRoot>/recordings/<yyyy-mm-dd HH.mm Title>/
├─ session.json      schemaVersion, id, title, startedAt, fps, displays, devices,
│                    per-stream { file, kind, offsetSec, probe, carriesMic }, cursor file,
│                    markers[], status: recording | finishing | ready | recovered
├─ screen.mp4        H.264 High 4:2:0, CFR at the chosen fps; carries the mic only when no camera
├─ camera.mp4        H.264 at the camera's native resolution and fps + the microphone (AAC, R4)
├─ system.m4a        system loopback (Windows), AAC — or .wav in the lossless option (R4)
├─ mic.wav           ONLY in the lossless option: a PCM safety master of the voice (R4)
├─ cursor.json       [t, x, y] at ~120 Hz in screen pixels (R8)
└─ thumb.jpg         first non-black frame of screen.mp4
```

`offsetSec` is the stream's start relative to the session's t0 (a late-starting
camera has a positive offset; the layout uses it). A "share" MP4 (screen +
mixed audio, `-c:v copy`, `amix` → `aac`) is a finishing option, not a master
(R10).

### R4 — Codecs and containers
- **Video: H.264 High profile, 4:2:0, in fragmented MP4** (a `moof` at least
  every 2 s = the keyframe interval), finished into progressive MP4 with
  `-c copy -movflags +faststart` so Studio's probe, Remotion and any player
  read it as a normal file. H.264 because every path downstream is measured on
  it (proxies, export passthrough) and every GPU since 2012 encodes it. HEVC /
  AV1 are a quality-per-byte upgrade for later; nothing in the format forbids
  them.
- **Bitrate by resolution and fps**, `latencyMode: 'quality'`, and
  `bitrateMode: 'quantizer'` where the encoder supports it (constant quality,
  what screen content wants). Starting table, to be tuned in P0: 1080p30 8 Mbps
  · 1080p60 12 · 1440p60 20 · 2160p30 30 · 2160p60 45.
- **Audio: a recorder option, "Compressed" (default) or "Lossless"** (Hasan,
  Rev 1 — "maybe we can have this as options"). What the two words mean:
  - *PCM / WAV* is the raw samples, 48,000 per second, nothing thrown away —
    what the microphone actually delivered. Lossless, zero encoder latency,
    sample-exact timing, ≈ 5.8 MB/min mono, ≈ 11.5 MB/min stereo.
  - *AAC* (Advanced Audio Coding) is the compressed format every MP4 player
    expects. At 256 kb/s it is ≈ 1.9 MB/min and transparent for voice and
    music — nobody can hear the difference in a blind test — but it is lossy:
    samples are approximated, and the Studio export encodes to AAC *again*, so
    the voice goes through two lossy passes. Encoding also adds a fixed
    delay (≈ 2,048 samples ≈ 43 ms at 48 kHz) that the muxer must compensate
    (`edts`/priming) or the voice lands 43 ms late — the classic recorder
    sync bug, and a P0 measurement.
  - **Compressed (default):** the mic as AAC 256 kb/s inside the camera (or
    screen) file via `AudioEncoder` (`mp4a.40.2`, a platform encoder on
    Windows and macOS); system audio as AAC in `system.m4a`. One lossy pass
    before export. Smallest, most compatible, the baked-mic layout Hasan
    wants.
  - **Lossless:** the same files, **plus** a `mic.wav` PCM safety master and
    `system.wav` instead of `.m4a`. The layout still uses the camera file's
    voice; the WAV is there for the user who wants to swap the voice master
    in (one click in the Media tab: Relink) or feed whisper the raw samples.
    Costs ≈ 1 GB/h with both streams; a 4 GB WAV roll-over guard.
  - Why not PCM *inside* the MP4: PCM-in-MP4 is a 2023 ISO addition that
    Chromium's `<video>` and most players do not decode, and PCM-in-MOV is
    the opposite island. AAC is the only voice format that is "a normal video
    file" everywhere.
- **Fallback when no H.264 encoder engages**: VP9 in WebM (Studio imports
  `.webm`; proxies are made as for any file). Never a software H.264 encode at
  record time — that is the CPU cost the whole design avoids.

### R5 — Frame pacing and the clock
- One **session clock**: t0 is stamped in main when Record fires (after the
  countdown); every stream's first packet is placed relative to it, and every
  file starts at 0 with `offsetSec` carrying the difference. Chromium stamps
  `VideoFrame` / `AudioData` on one monotonic clock across `getDisplayMedia`
  and `getUserMedia`, which is what makes 0 ms possible — the clap test is the
  proof, every slice.
- **CFR by construction**: a drift-corrected ticker at the chosen fps submits
  the newest captured frame to the encoder with `timestamp = n / fps`; on a
  static screen it re-submits the previous frame (hardware encoders spend
  almost nothing on an unchanged picture — P0 measures the alternative of
  extending the previous sample's duration instead). Why not keep the
  variable-rate source: ffmpeg's `mov` muxer with default vsync duplicates to
  the guessed input rate, Remotion's frame math and the proxy generator assume
  a steady rate, and a 1000 fps timebase from a WGC source is the classic
  "4 GB proxy from a 2-minute capture" bug.
- **The ticker is never `setTimeout`.** Hidden pages get their timers
  throttled to once a second by Chromium; `backgroundThrottling: false` lifts
  that for the engine window, but the pacing clock itself is derived from
  something the OS drives — the audio render callback (an `AudioContext`
  clock) or the capture track's own frame timestamps — so a busy main thread
  cannot stretch a frame interval.
- **Pause** stops the ticker and the audio sinks and records the gap; resuming
  continues timestamps contiguously — the file has no hole, the manifest has
  the gap list (markers).

### R6 — System audio
**Electron loopback on Windows (`audio: 'loopback'`)**, recorded as its own
WAV master; `loopbackWithMute` is the "mute my speakers while recording"
toggle. On macOS the toggle shows "needs a loopback device (BlackHole) — pick
it as the microphone" until Electron exposes ScreenCaptureKit system audio;
P4 tests whether `useSystemPicker` on macOS 15 already carries it. No virtual
audio driver of our own, ever.

### R7 — Camera
`getUserMedia({ video: { deviceId, width, height, frameRate } })` at the
camera's native resolution and fps, recorded as its own master (R3) through the
same paced encoder path; previewed in a **small frameless draggable bubble
window** (mirrored in preview only, never in the file). No background removal
or beautify in the recorder — the masks machinery in Studio's filters is where
a circle crop or a background effect belongs (P5).

### R8 — Cursor and clicks
- **v1: a cursor position track**, `screen.getCursorScreenPoint()` polled in
  main at ~120 Hz for the duration, written to `cursor.json` with the session
  clock. Cheap, no dependency, and it is the input the fake-screencast shot
  (zoom-follow, highlight, smoothing) needs.
- **Clicks and keystrokes have no Electron API.** They need a global input
  hook (`uiohook-napi`, native, per-ABI prebuilds, a supply-chain review like
  sd-cli's). Deferred to P5 as an opt-in; the manifest reserves `events[]`.
- Whether the recorded picture should contain the OS cursor is a user toggle
  if the `cursor: 'never'` constraint works on desktop sources **[spike]**;
  otherwise the cursor is in the picture in v1 and the zoom shot draws its own
  on top.

### R9 — Where recordings live
**`<studioRoot>/recordings/<session>/`** (R3's folder), not inside a project
and not in `userData`: recordings precede projects, are reused across them,
and are big — the Studio root is the drive the user already chose for big
media, and folder-as-truth keeps Explorer the source of truth (delete a folder,
the session is gone). A Recordings list (sessions with thumbnails, open / add /
reveal / delete) lives on the Recorder screen (R11); whether sessions also
surface in the Assets screen is a checklist question.

### R10 — Hand-off into Studio
After Stop, the finishing pass runs in main (faststart remux, WAV headers,
thumb, probe — seconds), then the control bar shows one card:
**Open in Studio** · **Add to current project** · **Show in folder** ·
**Share MP4**.

- *Open in Studio* creates a project named after the session with
  `width × height` = the screen master's (capped to 1920 × 1080 when the
  screen is larger — a setting, default on), `fps` = the recording fps; imports
  the masters through `importMediaFiles`; lays them out at `t = offsetSec`:
  **V1** screen (fit) · **V2** camera (overlay transform preset: 24 % width,
  bottom-right, 24 px margin; its clip carries the voice) · **A1** system
  audio. With no camera the voice is in the screen clip. Either way one
  right-click *Detach audio* moves the voice to its own audio track (Hasan,
  Rev 1). Proxies and waveforms queue as for any import. The layout helper is
  a pure function in `src/features/studio/services/recording-layout.ts` over
  a shared `RecordingSession` type — Studio never imports from the recorder
  module (architecture rule 1).
- *Add to current project* does the same at the playhead in the open project
  (the Media tab's **Record** button is the other way in).
- A recorder setting **"transcribe my voice after recording"** (default off)
  queues the transcript of the file that carries the mic (the asset
  transcriber extracts audio from video files already) — an explicit user
  choice, so the "transcripts never run on import" rule holds.
- *Share MP4* = screen + `amix(mic, system)` → AAC, `-c:v copy`, written next
  to the masters. Screen-only picture by construction (§1.2, no `overlay`): the
  composed video is a Studio export.

### R11 — UI surfaces
- **Entry points** (Hasan, Rev 1): a **Recorder** screen in the sidebar
  (settings, device defaults, the Recordings list) behind flag `recorder`, and
  a **Record** button in Studio's Media tab. The hotkeys (R12) control a
  recorder that is already open; they do not launch it.
- **The control bar** is a separate small frameless **always-on-top** window
  (≈ 440 × 64, `setContentProtection(true)`): source chip (screen / window /
  region) · camera toggle + device · mic toggle + device + level meter · system
  audio toggle · fps / quality chip · **Record** (3-2-1 countdown) · Pause ·
  Stop · elapsed · a dropped-frame dot. Dark surface, UI_SPEC tokens, no
  animation beyond the meter.
- **The source picker** is our own grid over `desktopCapturer` thumbnails
  (Screens / Windows tabs, search, live refresh), not Chromium's picker;
  **region** is a drag-rectangle on a transparent full-screen overlay window
  and becomes a `visibleRect` crop in the encoder path (zero cost) — v1.1
  inside P3.
- "Hide VidTSX while recording" minimises the main window on Record and
  restores it on Stop (default on).

### R12 — Hotkeys, sleep, tray
`globalShortcut` for start/stop (`Ctrl+Shift+R`) and pause (`Ctrl+Shift+P`),
editable in the Recorder screen, registered only while the recorder is open,
conflicts reported. `powerSaveBlocker.start('prevent-display-sleep')` for the
duration. A tray icon with the elapsed time is cheap and useful (the control
bar can be hidden) — v1.1.

### R13 — Crash safety, long recordings, disk, and the things that stop other recorders
fMP4 fragments are appended as they are produced; WAV files get a placeholder
header patched on Stop. `session.json` is written with `status: 'recording'`
at t0; on the next launch a session still in that status is **recovered**
(header patched from the byte length, fMP4 remuxed with `-c copy`, status
`recovered`) and offered in the Recordings list. A free-space check before
Record (refuse under 2 GB), a running estimate in the bar, a stop with a clear
message at 500 MB free. Target test in P4: a 2 h 1080p60 session.

The rest of this decision is the list in §6 made concrete — each item is a
line in the engine or in main, not a hope:

- **Pre-flight before the countdown**: encoder `isConfigSupported` for the
  chosen profile (and whether hardware engaged), source still alive, devices
  present, disk free, sink opened. A failed check is a message before
  Record, never a silent fallback to a software encode.
- **Our own background work stands down**: the Studio media job engine
  (proxies, waveforms, analysis), library describe jobs and downloads are
  paused for the duration and resume on Stop. Nothing of ours competes with
  the recording for cores or disk.
- **Source loss is a gap, not a stop**: a display mode change, a captured
  window closing, a monitor unplug or a full-screen exclusive game ends the
  capture track (`track.onended`). The engine holds the last frame, re-acquires
  the same source (or the display it was on) and continues the same file; the
  gap is a marker in the manifest. Same for audio: a `devicechange` that
  removes the active mic falls back to the default device with a marker.
- **Back-pressure is visible**: the sink queue depth and the encoder's
  dropped-frame count drive the bar's indicator; a sustained drop rate is
  shown, never hidden.
- **Frame lifecycle is strict**: every `VideoFrame` and `AudioData` is closed
  after use (the WebCodecs leak that kills long recordings); the P4 soak is 2 h
  with memory flat.
- **Stop writes nothing critical**: the file is already complete to the last
  fragment; finishing only re-wraps it. There is no "saving…" step that can
  fail after an hour of recording.

### R14 — Permissions and macOS
Windows: nothing to ask. macOS: `systemPreferences.askForMediaAccess('camera' |
'microphone')` and the Screen Recording status check before the first use, the
three Info.plist strings in `electron-builder.yml`'s mac block, and a packaged
smoke on a Mac before the flag flips there. Windows first (Hasan develops on
Windows and system audio is Windows-only); the Mac gate is a P4 exit
criterion, not a v1 blocker for Windows.

### R15 — Module layout, IPC, flag

```
src/features/recorder/              components/ (ControlBar, SourcePicker, CameraBubble,
                                    RecorderScreen, RecordingsList, DeviceRow, LevelMeter)
                                    hooks/ (useRecorderSession, useDevices, useSources)
                                    services/ (session-format.ts, bitrate-table.ts, hotkey-labels.ts)
                                    types.ts · index.ts
src/renderer/recorder-bar.html      the control-bar page (2nd renderer entry; same React, same tokens)
src/renderer/recorder-engine.html   the hidden engine page (R2): capture → encode → mux → chunks
src/preload/recorder-preload.ts     the engine's bridge (chunks out, commands in)
src/main/services/recorder/         session-store.ts · file-sink.ts (fMP4 append, WAV header)
                                    display-media.ts (the handler + source list) · cursor-tracker.ts
                                    finishing.ts (remux, thumb, probe, share mix) · recovery.ts
                                    hotkeys.ts · engine-window.ts · bar-window.ts
src/main/ipc/recorder-handlers.ts   RECORDER_* channels
src/shared/types/recorder.ts        RecordingSession, RecorderStream, RecorderSettings
src/shared/ipc/channels.ts          RECORDER_SOURCES_LIST · RECORDER_DEVICES_LIST · RECORDER_START ·
                                    RECORDER_PAUSE · RECORDER_STOP · RECORDER_CHUNK (engine → main) ·
                                    RECORDER_EVENT (push: state, elapsed, levels, drops) ·
                                    RECORDER_SESSIONS_LIST · RECORDER_SESSION_DELETE ·
                                    RECORDER_HANDOFF (open / add) · RECORDER_SHARE_EXPORT
```

Flag `recorder` in `feature-flags.ts`, dev-preview style (`studio-text-edit`'s
precedent): on in dev, off in production until the ship gate in §4. The
engine page is tiny and has no React; the bar page is a second Vite input
beside `index.html`.

---

## 4. Build order — measured gates, nothing before P0

| Phase | Builds | Exit criterion |
|---|---|---|
| **P0 — spike** (1–2 days, dev-only page, no UI) | `setDisplayMediaRequestHandler` + `desktopCapturer`; `MediaStreamTrackProcessor` → paced `VideoEncoder` (`prefer-hardware`) → `mediabunny` fMP4 → IPC chunks → file; mic + loopback to WAV; the same scene through `MediaRecorder` MP4 for comparison; import both into Studio (probe → proxy → export) | S1 ≤ 0.1 % at 1080p60 and 1440p60 on the 1650 Ti laptop with hardware encode engaged (CPU as S2); clap test 0 ms mic↔system↔camera; Studio imports, proxies and exports the file byte-sane. Reads the [spike] facts: encoder list, cursor constraint, yellow border, content protection. **Decides R1 (B or A).** |
| **P1 — screen + mic MVP** behind `recorder` | engine window, display-media handler, source picker grid, control bar (Record / Stop / elapsed), fMP4 sink with the mic as AAC inside the screen file, `session.json`, pre-flight, finishing (faststart, thumb, probe), the recordings folder, *Open in Studio* (V1 with voice) | a 10-minute 1080p60 recording lands in Studio scrubbable with its proxy; S1–S3, S5 met; AAC priming compensated (voice 0 ms vs a WAV reference); type gate green; unit tests on session-format, sink header math, recording-layout |
| **P2 — camera + system audio + pause** | camera bubble window, device pickers, level meters, the mic moves into the camera file when the camera is on, loopback system audio (`system.m4a`), the Lossless option (WAV masters), pause / resume (contiguous timestamps + gap markers), background jobs stand down, source-loss re-acquire, content protection on the recorder windows, countdown, hide-app option | a session lays out as V1 screen / V2 camera+voice / A1 system at the right offsets and *Detach audio* splits the voice; clap test 0 ms across screen, camera, mic and system; the bar and bubble never appear in the file; a display mode change mid-recording leaves one file with a marker |
| **P3 — hand-off and library** | Recorder screen with the Recordings list, *Add to current project* at the playhead, the Media-tab Record button, "transcribe my voice" setting, Share MP4, region capture | a session recorded from inside Studio is on the open project's timeline at the playhead; a recovered session re-opens; share MP4 plays in a browser |
| **P4 — robustness + macOS** | hotkeys, powerSaveBlocker, disk guard, crash recovery, tray, WAV roll-over, audio-master compression setting, mac permissions + Info.plist, packaged smoke on both platforms | kill-mid-recording recovers; 2 h 1080p60 session completes with S1 held; packaged Windows build records; Mac build records screen + camera + mic. **Ship gate → flag on.** |
| **P5 — the differentiator** (own design doc) | cursor track → a "Zoom & cursor" shot pack (the fake-screencast port: zoom-follow, smoothing, click highlights), click capture opt-in (`uiohook-napi`), camera shape masks, the agent's recorder-aware editing skill ("tighten this screencast") | a raw screencast + cursor track → agent proposal → Studio export that looks like a Screen Studio video |

Dependencies added: **`mediabunny`** (pinned exact, pure TS, MIT) in P0 if B
is chosen; nothing else until P5.

---

## 5. Checklist — answer inline

| # | Question | Recommendation | Answer (Hasan, 2026-10-04) |
|---|---|---|---|
| R1 | Engine: WebCodecs + fMP4 with P0 as the gate, `MediaRecorder` as the fallback? | yes | **yes** (implied by the §6 question: the gate is what proves it) |
| R2 | Capture in a dedicated hidden engine window, not the Studio renderer? | yes | **yes** |
| R3 | Separate files per stream + `session.json`; no camera baked into the screen file? | yes | **yes, amended**: camera, screen and system audio each their own track; the microphone inside the camera file (screen file when no camera), split later with *Detach audio* |
| R4a | Audio format? | was "WAV masters" | **a recorder option**: Compressed (AAC 256 kb/s, **default — confirmed Rev 2**) / Lossless (adds PCM WAV masters) |
| R4b | Default fps: 60 or 30? | 60 for screen, camera at its native rate | **yes** (Rev 2) |
| R5 | CFR by construction (paced encoder); variable-rate source rejected? | yes | **yes** (implied) |
| R6 | System audio Windows-only in v1; macOS shows the loopback-device guidance? | accept | **ok** |
| R8 | Cursor positions in v1; clicks (native hook) deferred to P5? | accept | **ok** |
| R9a | Recordings in `<studioRoot>/recordings/<session>/`? | yes | **yes** |
| R9b | Should sessions also appear in the Assets screen? | not in v1 | **not in v1** (Rev 2) |
| R10a | Camera overlay preset: 24 % width, bottom-right, 24 px margin? | yes | **yes** (Rev 2) |
| R10b | New project size: screen size capped to 1080p (setting, default on)? | yes | **yes** (Rev 2) — the portrait rule is still missing, §7 B1 |
| R10c | Share MP4 (screen + audio mix) in v1? | yes, P3 | **yes** (Rev 2) |
| R11a | Entry points? | sidebar + Media tab + hotkey | **Recorder sidebar screen + Record in Studio**; hotkeys stay as controls only |
| R11b | Control bar as a separate always-on-top window with content protection? | yes | **yes** |
| R12 | Default hotkeys `Ctrl+Shift+R` / `Ctrl+Shift+P`? | yes | **yes** (Rev 2) |
| R13 | fMP4 + recovery on next launch + disk guard + the §6 mitigations? | yes | **yes** — "the safest" is the brief |
| R14 | Windows first; Mac permissions and smoke as a P4 exit criterion? | yes | **ok — build for Windows now, keep the Mac in mind** |
| R15 | One new pinned dependency (`mediabunny`) if P0 picks B? | yes | **ok** |
| P | Build order P0 → P5 with the P0 gate before any UI; target release 1.2.0? | yes | **yes** (Rev 2); start date open — "later" |

---

## 6. Can Electron do this? — where recordings break, and what each break costs us

Hasan's question, verbatim: *"is it fine to use Electron for this, can we
achieve a crisp smooth recording without any lags or breaks or stops or sudden
problems? We face a lot of problems with CapCut, Camtasia and so on."*

**Short answer: yes for 1080p60 and 1440p60, with one honest cost at 4K60,
and P0 measures it on this machine before a line of UI exists.** Loom's and
Descript's desktop recorders are Electron; Google Meet's screen share is the
same Chromium capture path at a billion sessions a month. The failures Hasan
knows from CapCut and Camtasia are mostly *design* failures, not framework
limits, and each one has a named line in R13.

### 6.1 What Electron costs against a native recorder (OBS-class)

| Stage | OBS / native | Chromium (us) | Cost |
|---|---|---|---|
| Capture | Windows Graphics Capture → D3D11 texture | **the same WGC API** → D3D11 texture | none — same pixels, same OS path |
| Hand-off to the encoder | texture stays on the GPU, zero copy | the texture is read back to system memory and converted BGRA → I420, then uploaded to the encoder | ≈ 0.9 GB/s of memory traffic at 1440p60, ≈ 2 GB/s at 4K60 — SIMD-fast, but a fraction of a core at 1440p60 and about a core at 4K60 **[spike measures]** |
| Encode | NVENC via the NVIDIA SDK (all knobs) | **the same NVENC silicon** via Media Foundation (fewer tuning knobs: no lookahead/psy settings) | none for screen content at 12–20 Mb/s; quality identical at the same bitrate |
| Mux + write | native | JS muxer + IPC + Node file append | ≈ 1.5 MB/s — nothing |
| Camera | Media Foundation | Media Foundation (NV12, GPU-backed, zero copy) | none |

So the envelope is: **1080p60 and 1440p60 are OBS-smooth; 4K60 is the one
resolution where the read-back shows and P0 decides whether we offer it,
offer it at 30 fps, or scale to 1440p.** If a future user base needs 4K60,
option D (a native capture addon feeding the *same* encoder, muxer and sinks)
is an upgrade to one stage, not a rewrite. HDR displays capture as SDR in
Chromium (tone-mapped), as they do in every recorder without an HDR mode.

### 6.2 Where "lags, breaks, stops and sudden problems" actually come from

| Failure Hasan has seen | Root cause in the tools that have it | Our line |
|---|---|---|
| Stutter / dropped frames while recording | the recorder's own UI, encoder and disk writes share one process and one thread with the capture; a software encode kicks in silently when the GPU encoder is "busy" | R2: capture and encode in their own window; R13: pre-flight refuses to start on a software encoder; our background jobs stand down; the drop indicator never hides a problem |
| Recording silently stops, or ends with a black screen | a display mode change, a game going full-screen exclusive, a window closing, or a monitor unplugging ends the capture and the tool treats that as Stop | R13: source loss is a gap — re-acquire the same source, hold the last frame, mark the gap, keep the same file |
| "Failed to save" after an hour | the MP4 index (`moov`) is written only at Stop; a crash, a full disk or a long finalization loses everything | R4/R13: fragmented MP4 appends as it goes; Stop writes nothing critical; recovery on next launch |
| Audio drifts or lands late | the mic and the picture are on different clocks and get stitched at the end; the AAC encoder's 43 ms priming is not compensated; variable-rate video is conformed at export | R5: one session clock; R4: priming compensated and measured; R5: CFR by construction |
| The editor can't scrub the recording / proxies explode | variable-frame-rate output with a 1,000 fps timebase | R5: CFR files, measured by the ffprobe interval histogram |
| Recording the wrong thing, or the recorder's own window | picker confusion; the control bar is in the frame | R11: our picker with live thumbnails; `setContentProtection` hides our windows from the capture |
| Headset unplugged → silent track | the device change is ignored | R13: `devicechange` → default device + a marker |
| Memory climbs until the app dies at minute 40 | frame buffers never released | R13: strict `close()` lifecycle; the P4 2-hour soak with flat memory |
| Laptop sleeps or the display blanks mid-take | nothing holds the power state | R12: `powerSaveBlocker` for the duration |
| Disk fills | no guard | R13: refuse under 2 GB, warn, stop cleanly at 500 MB |

### 6.3 What stays a limit, in any tool

- DRM-protected content (Netflix, some players) captures black — by OS
  design.
- The Windows lock screen captures black while locked.
- A machine that is genuinely saturated by the thing being recorded (a game
  at 100 % GPU) drops frames in every recorder; ours shows it, and the encoder
  runs on the GPU's dedicated encode block (NVENC is separate silicon from the
  3D cores), which is the best position available.
- System audio on macOS until Electron exposes ScreenCaptureKit audio (R6).

### 6.4 How P0 answers the question with numbers, not opinion

On the 1650 Ti laptop, a 10-minute recording of a moving scene at 1080p60,
1440p60 and 2160p30/60: the ffprobe interval histogram (S1), the app's CPU
and GPU share (S2), the clap offset across all streams (S3), a kill at minute
5 and a recovery (S4), import → proxy → export in Studio (S5). The same
scene through `MediaRecorder` for the comparison row. The result table goes
in this doc under §8 before P1 starts.

---

## 7. Still missing — the list to work through when the build starts

Everything below is either undecided, unmeasured, or unbuilt and known to be
needed. Nothing here contradicts §3; it is what §3 does not yet say. Items
are grouped by *when* they bite. Tick them off in place.

### A. Before P0 can run

- [ ] **`mediabunny` audit**: pin an exact version, read its fMP4 and WAV
  writers and how it takes `EncodedVideoChunk` / `EncodedAudioChunk`, confirm
  MIT, add the entry to `THIRD_PARTY_NOTICES.md`, measure the bundle cost.
  Fall back to B2 (raw H.264 into the bundled ffmpeg) only if the audit fails.
- [ ] **A P0 harness**: a dev-only page reachable without UI, driven by the CDP
  recipe in `docs/ui-automation-cdp.md`; env stand-ins for the picks the way
  `VIDTSX_MEDIA_PICK` stands in for the file dialog — `VIDTSX_RECORDER_SOURCE`
  (display id or window title), `VIDTSX_RECORDER_MIC` / `_CAMERA` (device
  labels). The same stand-ins serve the automated runs for P1–P4.
- [ ] **A test scene** for S1: a page that paints a frame counter and a moving
  bar at the display refresh, so dropped and duplicated frames are countable
  from the *picture* (OCR of the counter at sampled frames), not only from pts.
- [ ] **A clap rig** for S3: a page that plays a click and flashes white on the
  same tick, played through the speakers (system loopback + mic + camera all
  see it) — the input `t1-audio-offset.mjs` needs.
- [ ] **How to know the hardware encoder engaged**: no public API says so.
  Candidates: `isConfigSupported` with `hardwareAcceleration: 'prefer-hardware'`
  vs `'prefer-software'`, encode latency distribution, CPU share, and whether
  Electron can open `chrome://media-internals` in a dev window. Pick one and
  make it the pre-flight check (R13).
- [ ] **Which GPU Chromium encodes on** on the hybrid laptop. Media Foundation
  may pick the Intel iGPU encoder over NVENC; `proxy-hwaccel.ts` solved the
  same adapter-0 problem for ffmpeg, but Chromium chooses on its own. Read it
  in P0; if it picks wrong, the fix is a Chromium switch or accepting QSV
  quality.

### B. Product decisions nobody has taken yet

- [ ] **B1 — Vertical (Shorts) recordings.** R10b's 1080p cap is a 16:9 rule.
  Needed: a 9:16 preset (camera-only, or a region crop of the screen), what
  project size it creates (1080 × 1920), and how the control bar offers it.
- [ ] **B2 — Camera-only and audio-only modes** (a talking head with no
  screen; a voice-over or podcast take). Cheap in the engine — the engine
  already treats each stream alone — but the bar needs those states and the
  layout helper needs a rule (camera-only → V1 is the camera at full size).
- [ ] **B3 — Teleprompter.** Studio has a Script panel (`ScriptPanel.tsx`,
  `project-script.ts`). Showing the project's script in a content-protected
  floating window while recording (auto-scroll, font size, mirror) is the
  feature that fits Hasan's YouTube workflow best and costs little once the
  bar window exists. Needs its own short design: where the script comes from
  when recording outside a project.
- [ ] **B4 — Markers while recording.** A hotkey for "mark" and one for
  "retake" during a take; `markers[]` in the manifest; how they land in Studio
  (marker-ops exist) and whether the clean-cut proposal reads "retake" as a
  hint. Decide the hotkeys and the mapping.
- [ ] **B5 — Mic processing defaults.** `echoCancellation`,
  `noiseSuppression`, `autoGainControl` on or off by default? Off is the
  cleanest voice; on protects against speaker bleed when system audio plays
  during a take. Proposal: off, with a one-click "Clean voice" toggle in the
  bar; a Studio filter does the real clean-up later.
- [ ] **B6 — Small defaults**: countdown length (3 s), the bubble's default
  size and corner, whether the bubble shows when the camera is off (no), the
  hide-app default per entry point (on from the Recorder screen, off from
  Studio?), what the title prompt does (before Record, or rename after).
- [ ] **B7 — Session naming and renaming.** Folder-name collisions in the same
  minute; renaming a session renames the folder — projects then see missing
  files; Studio's hash relink exists but is manual (Locate…). Decide: rename
  updates open projects, or the folder name is immutable and the title lives
  only in `session.json`.
- [ ] **B8 — Delete policy.** Deleting a session a project references leaves
  "missing" assets. The Recordings list needs a "used by N projects" warning;
  cross-project usage tracking is a V2 ledger item — decide whether this is
  its first consumer or the list just warns generically.
- [ ] **B9 — Share MP4 mix.** Mic and system levels (fixed −6 dB on system?
  `loudnorm`?), file name, and whether it is written automatically or on
  click. Picture is screen-only by construction (§1.2).
- [ ] **B10 — What the bar offers per machine.** From P0's table: is 4K60 a
  choice, a choice with a warning, or hidden on machines that can't hold it?
- [ ] **B11 — Hotkey conflicts** with OBS, Camtasia, ShareX (all default to
  `Ctrl+Shift+R`-adjacent combos). Detect registration failure, show it,
  offer a rebind.
- [ ] **B12 — HDR displays** capture as SDR. Say so in the UI, or not?
- [ ] **B13 — Multi-monitor**: one display per session in v1; "all displays"
  and "follow the mouse between displays" parked.

### C. Technical unknowns P0 and P1 must read (the consolidated [spike] list)

- [ ] Which H.264 hardware encoders Media Foundation exposes here; the
  `bitrateMode: 'quantizer'` support; the actual keyframe cadence honoured.
- [ ] `AudioEncoder` AAC (`mp4a.40.2`) availability on Windows and its priming
  delay; whether the muxer writes the edit list so the voice lands at 0 ms.
- [ ] The `cursor: 'never'` constraint on desktop sources; the yellow border on
  Windows 11 for window capture; `setContentProtection` really excluding our
  windows from a WGC capture.
- [ ] `MediaRecorder` MP4 behaviour (the comparison row) — does it engage the
  hardware encoder, what does its file look like to Studio's probe.
- [ ] An `AudioContext` clock as the pacer inside a hidden window with
  `backgroundThrottling: false`; `MediaStreamTrackProcessor` transferred into a
  Worker; the capture track's real frame-rate cap (`frameRate` constraint vs
  display refresh).
- [ ] Loopback audio: sample rate delivered, behaviour of `loopbackWithMute`,
  and the fact that it **includes our own app's sound** — Studio's preview
  playing during a take would be recorded. Mute the app while recording, or
  warn.
- [ ] Camera at 60 fps: most webcams deliver 30; a 30 fps camera clip over a
  60 fps screen clip is fine for Remotion, but the layout and the proxy
  profile should be checked once.
- [ ] Region crop with odd dimensions — H.264 needs even sizes; round the
  `visibleRect` to even and record the rounding in the manifest.
- [ ] **Back-pressure on the chunk channel**: `ipcRenderer.send` is
  fire-and-forget; the sink needs an ack or credit scheme (`invoke` per chunk,
  or a window of N outstanding) so a slow disk shows up as queue depth in the
  bar instead of unbounded memory.
- [ ] electron-vite with two more HTML inputs (`recorder-bar.html`,
  `recorder-engine.html`) and a third preload: build, dev URL
  (`ELECTRON_RENDERER_URL` + path) and the packaged path under `out/renderer/`.
- [ ] Windows 10 builds older than 1903 fall back from WGC to DXGI inside
  Chromium — confirm the fallback still records (no cursor, slower) rather
  than failing.

### D. Studio-side work the hand-off needs

- [ ] `recording-layout.ts` (pure, tested) for both entry paths — new project
  and "add at the playhead" — including the camera-only and portrait rules
  from B1/B2.
- [ ] **Keeping the four clips in sync after the layout.** The schema has no
  link or group id; `timeline-group-ops` moves a *selection*, so dragging the
  screen clip alone desyncs the camera. Decide: add an optional `groupId` to
  `StudioClip` (a schema addition with migration) and make group moves the
  default for recorded sessions, or accept multi-select as the v1 answer.
- [ ] "Transcribe my voice after recording" wired to the per-asset transcript
  job on the file that carries the mic, honouring the project's STT model.
- [ ] The Media tab's **Record** button (flag-gated), the toast on return, and
  the open-project handshake (the recorder needs the project id and the
  playhead; Studio needs the session when it lands).
- [ ] The Recorder screen's Recordings list: folder scan (folder-as-truth),
  thumbnails through the existing thumbnail route, open / add / reveal /
  delete / rename, the recovered-session banner, the size readout.
- [ ] Settings rows: audio format (R4), fps, bitrate table override, hotkeys,
  hide-app, mic processing (B5), transcribe-after, compress-masters (P4).
- [ ] P5 is its own design doc: the cursor track consumer (zoom-follow shot
  pack), click capture via a native hook, camera shape masks, and the agent's
  recorder-aware skill. Not started.

### E. Platform, packaging, release

- [ ] macOS: the three Info.plist strings in `electron-builder.yml`'s mac
  block, `askForMediaAccess` flow, the Screen Recording status check and the
  guidance screen when denied, `useSystemPicker` test on macOS 15, a dmg smoke
  — all of P4, none started.
- [ ] `THIRD_PARTY_NOTICES.md` entry for `mediabunny`.
- [ ] Feature flag `recorder` + the production flip criteria (the P4 gate),
  release notes for 1.2.0, the website feature list.
- [ ] `docs/ui-automation-cdp.md`: the recorder stand-ins and the visibility
  rule for the bar window (a second window — the existing driver assumes one).
- [ ] `docs/studio/TESTING.md`: what is unit-tested (session format, sink
  header math, bitrate table, layout) and what only the hidden-window harness
  can test (encode, pacing, sync); WebCodecs does not exist in vitest/node.
- [ ] STATUS.md entries per phase; `V2_FEATURES.md` lines move to STATUS.md as
  they ship (the capture line now points here).

### F. Parked on purpose (so they are not re-proposed by accident)

Live streaming · scheduled / timed recording · drawing and annotations during
a take · keystroke overlay (needs the native hook, P5) · auto-zoom at record
time (a Studio shot, P5) · GIF output (Studio's GIF render) · "all displays"
capture · phone capture over USB · remote / guest recording · AI noise removal
at record time (a Studio filter later) · camera background blur or removal (the
masks machinery, P5) · virtual camera output.

---

## 8. P0 results

*Empty until the spike runs. The table from §6.4 lands here: per resolution,
S1 interval histogram, S2 CPU / GPU share, S3 clap offsets, S4 recovery, S5
Studio round-trip, and the `MediaRecorder` comparison row — then the R1
decision line.*

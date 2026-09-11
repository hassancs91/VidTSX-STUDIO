# Export engines — the QSV / AMF copy paths: what to run on an Intel or AMD machine

> Companion to `docs/export-engines-plan.md` (Stage 4 log, "QSV/AMF copy paths",
> 2026-09-11). The fast engine copies untouched footage with the full ffmpeg's
> hardware encoder. Only NVIDIA's `h264_nvenc` has ever produced an export; the
> `h264_qsv` (Intel Quick Sync) and `h264_amf` (AMD AMF) argument builders are
> checked against the encoders' own documentation and unit-tested, and QSV was
> measured OFFLINE on the dev laptop's Intel UHD 630 (the numbers are below),
> but **no export has run through either** — this is the recipe for the machine
> that can. Nothing here changes the default engine (D2: the fast engine stays
> opt-in).

## What is already known (no hardware needed)

Checked 2026-09-11 against `ffmpeg -h encoder=h264_qsv` / `h264_amf` of the
build the app downloads (BtbN `n8.1.2-50-g1a748fe2cd`, 2026-08-31 — the
encoders are compiled in on every machine; only opening them needs the GPU):

| what the NVENC line does | `h264_nvenc` (measured) | `h264_qsv` | `h264_amf` |
|---|---|---|---|
| encoder line | `-preset p5 -rc vbr -cq 23 -b:v 0` | `-preset medium -global_quality 23` — `medium` = TargetUsage 4; a `global_quality` with NO bitrate selects ICQ (intelligent constant quality) on the 1–51 scale | `-quality balanced -rc cqp -qp_i 23 -qp_p 23 -qp_b 23` — CQP with the QP named for all three picture types (unset, `qp_b` is the driver's default, not 23) |
| GOP 60, two B-frames | `-g 60 -bf 2` | `-g 60 -bf 2` → `GopPicSize 60, GopRefDist 3, IdrInterval 0` (every I is an IDR — the piece seams need that) | `-g 60 -bf 2` → `IDR_PERIOD 60`; `-bf` is AMF's own "B Picture Pattern" option on 8.1 (range −1…3) |
| pixel format handed to the encoder | `yuv420p` (from `scale_cuda`) | **`nv12`** — `h264_qsv` accepts `nv12` and `qsv` frames ONLY; before this item the graph ended in `format=yuv420p` and ffmpeg auto-inserted the conversion after `setparams` (its verbose log: `auto-inserting filter 'auto_scale_0'`); the graph now says `format=nv12`. Measured: the two are NOT the same bytes — swscale's direct 10-bit → nv12 conversion rounds chroma differently from 10-bit → yuv420p followed by the lossless nv12 repack (joined files 17,373,923 vs 17,391,953 B) — and read the same against the plain Remotion export (means within 0.03, both max 0.01 % over 24), so the explicit single conversion stands | `yuv420p` — `h264_amf` accepts it directly (also nv12, d3d11, …) |
| device / hwaccel | `-hwaccel cuda -hwaccel_output_format cuda` (NVDEC → `scale_cuda` → NVENC, all on the card) | **none needed** for frames from system memory: the encoder opens its own oneVPL session (`Initialized an internal MFX session using hardware accelerated implementation`); the source is decoded in software and scaled on the CPU (`scale=w:h,format=nv12`) | **none needed**: the encoder creates its own AMF/D3D11 context; software decode, CPU scale (`scale=w:h,format=yuv420p`) |
| colour tags (`yuv420p tv bt709 bt709 bt709`) | `setparams` on the frames + the `-color_*` output flags | both routes read into the VUI: qsvenc sets `ColourDescriptionPresent` from the context's primaries/transfer/matrix and `VideoFullRange` from the range — measured: all five tags on the TS piece and on the joined mp4 | amfenc sets `OUTPUT_COLOR_PROFILE` / `OUTPUT_TRANSFER_CHARACTERISTIC` / `OUTPUT_COLOR_PRIMARIES` / `FULL_RANGE_COLOR` from the same fields (8.1 source) — **unverified on hardware**; the finishing stage refuses a piece whose tags are wrong, so a mismatch fails the export loudly, never silently |
| the frame mapping, `-r 30 -fps_mode cfr -frames:v N`, the slow-motion graph, the join | identical arguments on all three encoders — only the scale, the format and the encoder line differ (pinned in `passthrough-ffmpeg.test.ts`, "every builder on every encoder") | | |

Where this lives: `spanEncoderArgs`, `ENCODER_PIXEL_FORMATS`, `copySpanArgs`,
`blackSpanArgs`, `browserSpanArgs`, `holdLastFrameArgs` in
`src/main/services/studio/export-engines/passthrough-ffmpeg.ts`; the probe
(`ffmpeg -encoders`, then a two-frame encode per listed vendor, cached as
`%APPDATA%\VidTSX Studio\ffmpeg-full\encoders.json`) in
`src/main/services/studio/ffmpeg-full.ts` + `proxy-encoders.ts`; the choice
(`nvenc` > `qsv` > `amf` among the WORKING ones) in `passthrough-engine.ts`
`pickExportEncoder`.

The seams that do not need hardware are unit-tested with the probe mocked
(`passthrough-engine.test.ts`): with QSV or AMF as the only working encoder
`availability()` is available, `produce()` reports `h264_qsv` / `h264_amf` to
the queue row ("Encoder used"), every ffmpeg run carries that vendor's line and
no CUDA flag, and the notes read "Copied 100 % of this timeline (2 of 2
spans)."; the Settings row labels them "Intel Quick Sync" / "AMD AMF"
(`studio-proxy-encoder-handlers.test.ts`).

### QSV, measured offline on the dev laptop (Intel UHD 630, driver 27.20.100.9749, beside a GTX 1650 Ti)

`.vidtsx-temp/bench/open/qsv-amf/proto-qsv.mjs` runs the builders' exact
arguments (bundled by esbuild) on `raw/DJI_20260813142309_0270_D.MP4` (4K
HEVC Main10 59.94 fps) for the two spans of `t5-1080p-cut`, joins them the way
the finishing mux does and reads the Stage 2 gates. Two encodes of the same
span were **byte-identical** (QSV is deterministic here, as NVENC is); each
piece 450/450 frames, first frame a keyframe, the same GOP shape as NVENC's
(8 I, 150 P, 292 B), profile High L4.0; the joined file 900 frames, pts on the
1/30 grid from 0, all five tags; `t1-diff` against the plain Remotion export
(control 2, `studio-t5-1080p-cut_2026-09-04T17-34-16.mp4`) at
1/300/449/450/451/600/899: **max 0.01 % of pixels over 24** (0 at 449), mean
1.46–1.99 per channel, max delta 33–55 — the magnitude of the D5 verify rows
every slice has passed at (NVENC reads 0 % at all seven against the same
control, mean 1.24–1.71, max 33–44). Speed: **0.56× realtime** for the copy
(the 4K 10-bit HEVC software decode is the floor: 37 source frames/s on the
i7-10750H, and a 30 fps output decodes ~2 source frames per output frame)
against NVENC's 3.6× on the same spans; the slow graph, a black piece, a
browser-style piece and a held tail all open and count exactly. The QSV
encoder's own report for the line: `profile: avc high; level: 40 · GopPicSize:
60; GopRefDist: 3; IdrInterval: 0 · TargetUsage: 4; RateControlMethod: ICQ ·
ICQQuality: 23`.

Where the hair above NVENC comes from: NVENC fed by the same software decode
and `scale`,`format=yuv420p` reads 0 % over 24 at six of the seven frames
(0.01 at 300), mean 1.34–1.73 — between scale_cuda's rows and QSV's — so it is
the encoder, not swscale: `-global_quality 23` (ICQ) wrote a 17.4 MB file
where NVENC's `-cq 23` wrote 33.5 MB. "Quality 23" is each vendor's own
scale; the T1 gate, not the number, is the judge.

Decoding on the Intel GPU too (prototypes, NOT in the builder): `-hwaccel qsv`
with the frames downloaded (`hwdownload,format=p010le`) and the CPU scale as
built produced **the same bytes as the software decode** (the HEVC decode is
bit-exact either way) at no real speed gain (0.57–0.61× — the download and
the CPU scale are the floor); keeping the frames on the GPU (`-hwaccel qsv
-hwaccel_output_format qsv` with `vpp_qsv=w=1920:h=1080:format=nv12` or
`scale_qsv`) **failed on this driver** ("Unsupported pixel format … Error
creating frames_ctx for output pad" — the 2021 driver's VPP does not turn
p010 into nv12). Whether to give QSV a GPU-side scale is a later slice's
decision: a newer driver first, then a fallback to the software graph for
machines whose iGPU cannot handle the source (Skylake has no HEVC Main10
decode) — engine logic, not an argument.

**QSV through the app, once** (2026-09-11, the dev app restarted with
`VIDTSX_EXPORT_GPU_ENCODER=qsv`; the recipe below, run on this laptop): the
log shows `Export encoder override {requested: qsv, working: [nvenc, qsv],
using: qsv}` on every export; `slow4` (`copy 450 · copy 450`) read max 0.01 %
over 24 at all 18 sampled frames against its plain Remotion export and
Remotion's source frame at all 15 mapped slots (the repeat triple on K 1000
included), audio 0 ms at eight windows; `xfade` (`copy 435 · browser 30 ·
copy 435`, the browser span re-encoded by h264_qsv) max 0.01 % over 24 at all
13 frames, audio 0 ms vs the camera at eight windows; `t5-1080p-cut` in D5
verify mode — max 0.02 % over 24 against its Remotion reference (frame 451;
0.01 at the other six), max 0.01 % against control 2, audio 0 ms vs the
reference and vs the camera at every window, 13 min 23 s from click (the
copies 0.40× / 0.51× realtime, the reference render the rest). The plan's log
subsection has the tables. Note for the gate: the queue row's PERSISTED
record has no `encoderName` (only the live "Encoder used" event does) — read
the app log's `Export encoder override` line, or the file size (the QSV ICQ
23 files are about half the NVENC files' bytes).

AMF on this laptop: `[AMF] DLL amfrt64.dll failed to open` — no AMD runtime,
the genuine "not this machine" failure; the probe marks it not working and
the engine never picks it.

## The recipe on an Intel or AMD machine

1. **The download.** Settings › Rendering › "Faster proxy generation (GPU
   encoder)" › Download (~80 MB, the BtbN 8.1 GPL build; the row then says
   "Detected: Intel Quick Sync" or "Detected: AMD AMF"). The probe runs once and
   is cached beside the binary (`%APPDATA%\VidTSX Studio\ffmpeg-full\encoders.json`,
   `{"listed":[…],"working":[…]}`); delete the file to re-probe after a driver
   update. If `working` is empty the Export dialog greys the Fast row out with
   `NO_WORKING_ENCODER`'s wording. Check the probe by hand first:
   `ffmpeg -hide_banner -f lavfi -i testsrc=size=256x144:rate=30 -frames:v 2 -c:v h264_qsv -preset medium -global_quality 23 -pix_fmt nv12 -f null -`
   (or `-c:v h264_amf -quality balanced -rc cqp -qp_i 23 -qp_p 23 -qp_b 23`),
   exit 0 is the verdict.
2. **Which encoder the engine will use.** On a machine with ONLY Intel or ONLY
   AMD the engine picks it by itself (`nvenc` > `qsv` > `amf` among the
   working). On a dual-GPU laptop (an iGPU beside an NVIDIA card — the dev
   laptop) set `VIDTSX_EXPORT_GPU_ENCODER=qsv` (or `amf`) in the environment
   the app is launched from: it forces that encoder IF the probe found it
   working, otherwise it is ignored and logged (`Export encoder override` in
   `%APPDATA%\VidTSX Studio\logs\vidtsx-<UTC date>.log`). From the PowerShell
   that runs `.vidtsx-temp/bench/stage3/restart-dev-app.ps1`:
   `$env:VIDTSX_EXPORT_GPU_ENCODER = 'qsv'` first; the spawned Electron
   inherits it. The queue row's "Encoder used" must read `h264_qsv` /
   `h264_amf` — that is the first check.
3. **The raw footage and the seeds.** `raw/DJI_*.MP4` in the repo root (the
   projects reference them by absolute path — the same paths, or re-seed).
   `node scripts/bench/seed-cut-projects.mjs <name> [--force]` writes
   `Videos\VidTSX Studio\projects\<id>\project.json` (the header of that script
   lists every seed and what it exercises); the 30 s single-clip `t5-1080p`
   comes from `seed-long-project.mjs`. The nine byte-identity references are
   `t5-1080p`, `cut`, `gain`, `music`, `stack`, `fade`, `xfade`, `speed`,
   `speed2`; add `slow4` (the slow graph) and `xfade` (a browser span through
   the encoder) as the two kinds the copy path alone does not cover.
4. **The dev app and the driver.** `docs/ui-automation-cdp.md` (Launch; "Studio
   exports from the queue"): restart through `restart-dev-app.ps1`, wait a
   minute after the page target answers, then
   `node scripts/bench/export-engine-run.mjs --project="<card title>" --engine=passthrough [--verify=remotion] --proxy-wait=15 --out=<json>`
   from Bash with the title quoted inside the argument (the titles are in
   `.vidtsx-temp/bench/stage4/run-pt-join.sh`, which is also the nine-reference
   chain: copy it, set the encoder, run it detached as a script file). Exports
   land in `Videos\VidTSX`. Read the export's `Span plan` and `Span done` lines
   in the app log for the copied share and each span's `realtime` factor.
5. **The gate for another encoder is NOT byte identity with the NVENC
   reference files** — a different encoder produces different bytes by
   construction. It is:
   - **The D5 verify against a plain Remotion export** of the same project:
     `--verify=remotion` on `t5-1080p-cut` (20–35 min: the reference renders
     4K sources at ~1 frame/s) → `<export>.verify.json` beside the file. Pass =
     **0 % of pixels over 24 at every sampled frame** (the rows have been
     reading ≤ 0.01 %, i.e. ≤ ~200 of 2 M pixels, at the Stage 2 frames — the
     copy's smaller colour round trip, not a wrong frame; a WRONG source frame
     reads ~2 % over 24 on these shots) **and audio 0 ms** vs the reference and
     vs the camera file at every window. The offline equivalents:
     `node scripts/bench/t1-diff.mjs --a=<remotion.mp4> --b=<export.mp4> --label=<l> --frames=1,300,449,450,451,600,899`,
     `node scripts/bench/t1-audio-offset.mjs --a=raw/DJI_20260813142309_0270_D.MP4 --b=<export.mp4> --windows=0.5,7,13.5,14.5,15.2,16,22,29`,
     and `t1-frame-map.mjs` when a frame reads high (which source frame it shows).
   - **Determinism, NVENC-style:** export the same project twice and compare
     the video streams — `node scripts/bench/passthrough-video-hash.mjs <a.mp4> <b.mp4>`
     must report identical video hashes (the audio pass is encoder-independent
     and identical anyway). QSV is deterministic on the dev laptop; AMF is
     unmeasured — if two AMF exports differ, record it and the gate for AMF
     becomes the D5 verify alone.
   - **All nine references through the engine**, each read with `t1-diff`
     against its plain Remotion export (the `.verify-remotion.mp4` files and
     the 2026-09-04/05 controls in `Videos\VidTSX`, or a fresh
     `--engine=remotion` export), plus `slow4` (the slow graph: the same source
     frame per slot as the Remotion export — `t1-frame-map.mjs --rate=0.25
     --from=450 --source-in=15` — and 0 % over 24 at 449…453 / 648…656) and
     `xfade` (the browser span re-encoded by the vendor: 0 % over 24 across
     435…465).
   - **The pieces' tags:** the finishing stage probes the concat list and
     refuses "video with the wrong colour tags" — if an AMF export fails there,
     the encoder did not write the VUI from the context fields; read the piece
     with `ffprobe -show_streams` and record which of the five is missing.
   - **A live run of the unit pins:** `VIDTSX_LIVE_FFMPEG=1 npx vitest run src/main/services/studio/export-engines/passthrough-ffmpeg.live.test.ts`
     — its last block runs every builder on whichever of `qsv`/`amf` opens on
     the machine (exact counts, pts on the grid, the five tags after the join,
     two encodes byte-identical) and skips the other.
6. **Speed.** Note each span's `realtime` from the log. Expect the software
   decode to be the floor on a 4K HEVC 10-bit source (0.56× on a 6-core
   i7-10750H); an H.264 8-bit source decodes several times faster. A GPU-side
   decode (`-hwaccel qsv` for Intel; `-hwaccel d3d11va` for AMD) is the obvious
   next step and needs the fallback discussed above.
7. **What can go wrong, and what to record.**
   - QSV: `Selected ratecontrol mode is unsupported` / an error opening the
     encoder in ICQ — some VDEnc-only (low-power) configurations reject ICQ;
     try `-low_power 0` by hand, and if only CQP opens (`-q:v 23`), record the
     driver and the mode. A source the iGPU cannot decode is irrelevant here
     (software decode).
   - AMF: run one span by hand with `-v warning` — a GPU without H.264
     B-frame support (pre-RDNA3) logs `B-frames are not supported` and encodes
     without them; the piece is still valid (record the GPU). `DLL amfrt64.dll
     failed to open` = no AMD driver/runtime on the machine.
   - Either: a piece count short by more than 3 frames demotes the span to the
     browser (`Copied span came up short` in the log) — a different failure
     than the encoder's; report it with the span.

## What to record in the plan when it is done

In `docs/export-engines-plan.md`, Stage 4 log, the "QSV/AMF copy paths"
subsection: the machine (GPU, driver, ffmpeg build), the encoder name the
queue row showed, the per-span `realtime` factors, the D5 verify rows
(max % over 24 at the seven frames, the audio offsets), the determinism
verdict (two exports' video hashes), the nine references' `t1-diff` rows, the
slow4 frame map, anything from step 7 — and then remove QSV/AMF from the
"Not done, by design" sentence. Status.md gets a dated entry. If AMF turned
out non-deterministic or wrote wrong tags, the builder change goes in with a
unit test and this runbook's table gets the fact.

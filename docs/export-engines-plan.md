# Export engines — the passthrough build as an opt-in engine

> Decided with Hasan 2026-09-04, right after T1 (`docs/PREVIEW_TESTS_PLAN.md`
> §T1) proved the passthrough join inside the WYSIWYG tolerance. Stage 1 (the
> engine seam) and Stage 2 (the passthrough engine at its narrowest predicate)
> are built and gated — see the §Stage 1 and §Stage 2 logs at the end; Stage 3
> is under way one widening at a time (§Stage 3 log); Stage 4 is not. Companion: `docs/studio/PLAN.md` §5 ("smart render"),
> `docs/PREVIEW_ARCHITECTURE.md` §C2 (why only the identity transform is a
> safe fast path).

## Decisions

| # | decision | why |
|---|---|---|
| **D1** | **Export goes through an engine interface with a registry**, the same shape as the LLM / image / STT providers. Engine 1 = today's Remotion frame-by-frame path, unchanged. Engine 2 = the passthrough hybrid. A future engine is one file plus a registry entry. | "Later on, if we find a new way, adding it should be as easy as adding a new engine." |
| **D2** | **Opt-in.** Settings › Rendering holds the default engine (ships as Remotion); the Export dialog has a picker that starts on the default. Nothing changes for anyone who never opens it. | No behaviour change on the default path while the new engine matures. |
| **D3** | **Engine names stay internal.** The picker shows the user-facing trade-off only (speed, what gets copied), not "Remotion" / "passthrough". | Hasan, 2026-09-04. |
| **D4** | When the fast engine can copy **nothing** of a timeline it **still runs** (result identical to the default engine) and **shows a message while rendering** saying so. It never steps aside. | Hasan, 2026-09-04. Also: the dialog states how much of the timeline will be copied ("copies 87 % of this timeline") before the user commits. |
| **D5** | **A hidden verification mode for development**: one export runs through two engines and reports the T1 pixel diff (per-frame mean / % over 8 / % over 24 / stills) and the audio offset. Every future engine is checked with the same instrument. | Hasan, 2026-09-04. Reuses `scripts/bench/t1-diff.mjs`, `t1-audio-offset.mjs`. |
| **D6** | **Audio timing reference = the camera file (0 ms).** T1 measured every Remotion export at +42.7 ms against the source; the DJI files are in sync as they come from the camera, so the export must match them, and the Remotion engine's audio is corrected too, in the shared finishing stage. A clap clip confirms on the first slice. | Hasan, 2026-09-04. |
| **D7** | **A shared finishing stage** for every engine: the single audio pass over the whole timeline, the mux, the colour tags (`yuv420p tv bt709`, not Remotion's `yuvj420p pc bt470bg`). Two exports of one project differ only in how the video frames were produced. | T1 leg 3: the seam is only continuous with one audio pass; mixed tags cannot share a file. |

## What the fast engine is (and is not)

It is a hybrid **for export only**: spans that are plain cuts of a video
asset (identity transform: no effects, captions, shots, transitions,
speed, crop, opacity) are copied with ffmpeg; everything else is rendered
by the browser exactly as today and encoded by our ffmpeg with the same
settings as the copied spans; the pieces are joined frame-exactly. It is
**not** a second preview compositor (C2 in the architecture doc stays
rejected). A project with edits everywhere gains little, and the dialog
says so up front (D4).

Needs the full ffmpeg with hardware support — the same download the GPU
proxy setting already offers; the option greys out with a download prompt
when it is missing.

## The four build conditions (from T1 — the spec, not advice)

1. **Frame mapping:** for output frame n of a span starting at source time
   S, take the source frame whose pts is **nearest** to S + n/fps. In
   ffmpeg: seek half a source frame early, `-copyts`, the per-frame
   `select` from §T1, `setpts`, `-r <fps> -fps_mode cfr -frames:v N`.
   Never `-r` alone, never the `fps` filter (both pick other frames).
2. **One encoder for both span kinds:** browser spans are Remotion's frames
   taken as RGB and encoded by **our** ffmpeg with the copied spans'
   settings. Never concatenate Remotion's own x264 file (parameter sets and
   colour tags clash, frames drop at the seam).
3. **Join through MPEG-TS video-only intermediates**, concat, then mux the
   one-pass audio last. The mp4 concat recipe starts the video 21 ms late;
   per-piece audio jumps 61 ms at the seam.
4. **First frame of a browser-rendered span:** a span rendered as its own
   composition shows the frame *after* its start time on frame 0 (a real
   timeline cut does not). Render one frame early and drop the lead-in.

Gate for every slice: `t1-diff.mjs` against a full default-engine render of
`t5-1080p` and `t5-1080p-cut` — **0 % of pixels over 24 at every sampled
frame**, 900 frames, audio lag 0 ms at every window.

## Stages

| stage | scope | done when |
|---|---|---|
| **1 — engine seam** · **DONE 2026-09-05** | `ExportEngine` interface + registry in main (`src/main/services/studio/export-engines/`), the Remotion path moved behind it untouched, the shared finishing stage (D7) with the audio correction (D6), Settings default + Export dialog picker (D2/D3), verification mode behind a dev flag (D5) | the default engine exports byte-for-byte what it did before, minus the 42.7 ms; the picker exists but lists one engine — **met**: `t1-diff` vs the 2026-09-04 control 0 % over 24 at 1/300/449/450/451/600/899 on both reference projects, 900 frames, `yuv420p tv bt709`, audio 0 ms at every window vs the camera file (log below) |
| **2 — passthrough, narrowest predicate** · **DONE 2026-09-06** | single video track, pure cuts, no effects/captions/shots; the span planner decides from the document alone; touched spans still go to the browser and are encoded per condition 2; join per condition 3; "copies N %" in the dialog; the D4 message | T1 gate passes on both reference projects; the 3 h T6 project exports in about an hour instead of days — **met**: 0 % over 24 vs the 2026-09-04 control at 1/300/449/450/451/600/899 on both projects, ≤ 0.01 % vs the Stage 1 Remotion engine in verify mode, audio 0 ms vs the camera file at every window, copied spans at 3.7–4.2× realtime, a re-export byte-identical; the 3 h project (275 clips, 100 % copied) exports in 1 h 32 min — 61 min of copied spans, 24 min in the finishing mux — against T6's ≈ 3.5 days, audio in sync end to end |
| **3 — widen the predicate** · **slices 1 + 2 DONE 2026-09-06** (partial) | audio tracks, multiple video tracks where lower tracks are fully covered, clips whose only change is a trim; every widening re-runs the gate | each new span type passes the gate before it is enabled — **slice 1 met**: the different-file cut measured (the export shows the ceil frame on the first frame after it opens a source file, the nearest on a same-file cut or a return; the planner carries it, the A-B-A seed reads 0 % over 24 at both cuts) and gain-only clips copied (video byte-identical to the Stage 2 cut export, audio 0 ms vs the camera file and vs an independent Remotion export at eight windows, level 0.4995–0.4997 on the gained clip and 1.000 vs Remotion); the Stage 2 gates re-run byte-identical. **Slice 2 met**: audio tracks mixed in the one pass (a music clip under the T1 cut: video byte-identical to the Stage 2 cut export, audio 0 ms and level 1.000 vs a plain Remotion export at eight windows, the mixed music at lag 0 and 0.98 of its gained level in the export-minus-camera residual on both exports alike) and several video tracks (the T1 cut as two stacked tracks: video AND audio byte-identical to the Stage 2 cut export, 0 % over 24 vs the control, audio 0 ms vs the camera); the three earlier gates re-run byte-identical on video AND audio. Next: clips whose only change is a trim are already copied (a trim is a cut); the long-return question; Stage 4 |
| **4 — polish** | progress that shows copied vs rendered time, cancel that cleans intermediates, the temp-copy leak from T5, the CPU-usage setting reaching Studio exports | tickets closed, `STATUS.md` row |

Open, not blocking: the clap test (D6) on the first Stage 1 build; whether
the fast engine should also become the default once Stage 3 has held for a
release.

## Stage 1 log — the engine seam · DONE 2026-09-05/06

**What the seam looks like.** `src/shared/studio/export-engines.ts` is the
catalogue (ids, the user-facing trade-off wording, the default); the
implementations live in `src/main/services/studio/export-engines/`:
`types.ts` (`ExportEngine`: `availability()` + `produce(input) → { videoPath,
audioPath?, notes? }`), `registry.ts` (register / resolve / list, catalogue
ids only), `remotion-engine.ts` (engine 1), `finishing.ts` (D7: probe →
mux → probe), `run-export.ts` (engine → audio → finish → verify, owns the
scratch dir and the cancel signal), `verify.ts` + `frame-diff.ts` +
`audio-offset.ts` (D5: the T1 instruments in product form, pure maths
unit-tested), `export-context.ts` (the trimmed document written beside the
entry so a queued job survives a restart). A render-queue job carries
`exportEngine`; `render-handlers.ts` branches on it after the bundle step
every render shares. Settings › Rendering "Default Studio export" (D2);
Studio's Export button opens `ExportDialog.tsx` — picker on the default,
labels show the trade-off, never the mechanism (D3); the dev verify
controls appear only when localStorage `vidtsx:export-verify` is `1` in a
dev build. Adding an engine = one catalogue entry, one file, one
`registerExportEngine` line.

**Three findings that changed the shape while building:**

1. *One browser walk, not two.* The first cut rendered video-only and ran a
   separate Remotion audio-only pass for D7's "single audio pass": 8.6 min
   of frames + **7 min of audio** on t5-1080p — Remotion downloads every
   source again per `renderMedia` call (1.3 GB over loopback), video
   disabled or not. So an engine may hand over the audio its one pass
   produced (`audioPath`); the Remotion engine renders `.mkv` with
   `audioCodec: 'pcm-16'` and the finishing stage still owns the only AAC
   encode. `audio-pass.ts` stays for engines that make no audio.
2. *Remotion's `colorSpace: 'bt709'` tags only matrix + range*; primaries
   and transfer come out "unknown" (its `-color_primaries`/`-color_trc`
   flags lose to the zscale output). `src/main/services/remotion-color-args.ts`
   extends the pre-stitcher's zscale filter (`primaries=709:transfer=709`,
   a pure tag on the same pixels). The finishing stage verifies all five
   tags before and after the mux and fails loudly on a mismatch (the first
   run did: "colour primaries is untagged").
3. *The +42.7 ms was AAC priming*: Remotion compresses its mixed WAV to raw
   ADTS and stream-copies it into the mp4, so the 2048-sample encoder delay
   is never declared. PCM in, one `aac` encode in the mux (320 kb/s, cutoff
   18 kHz — Remotion's settings) → 0 ms.

**Gate (the DONE criterion), default engine through the real dialog over CDP:**

| project | file | `t1-diff` vs control 2 at 1 / 300 / 449 / 450 / 451 / 600 / 899 | `t1-audio-offset` vs `raw/DJI_20260813142309_0270_D.MP4` at 0.5 / 7 / 13.5 / 14.5 / 15.2 / 16 / 22 / 29 s | wall |
|---|---|---|---|---|
| `t5-1080p` | `studio-t5-1080p_2026-09-05T20-26-51.mp4`, 900 frames, `yuv420p tv bt709 bt709 bt709`, 31,222,896 B | **0 % over 24 at every frame**; mean 1.26–2.04/255, 1.0–2.2 % over 8, max 51 (the 601-full → 709-limited round trip, both files decoded to RGB) | **0 ms at every window, corr 1.000** | 522 s from render start to file (frames + mux) |
| `t5-1080p-cut` | `studio-t5-1080p-cut_2026-09-05T20-38-40.mp4`, 900 frames, same tags, same byte count | **0 % over 24 at every frame**, rows identical to the single-clip export (byte-identical frames, as T1 measured) | **0 ms at every window, corr 1.000** | 9 min, then the verification reference |

Verification mode (D5) on the seeded 3 s two-clip project `t5-1080p-cut3s`
(`…/Videos/VidTSX/studio-t5-1080p-cut3s_2026-09-05T21-00-46.verify.json`):
Remotion vs Remotion → 7 frames (1, 30, 44, 45, 46, 60, 89), **diff 0 at
every frame**, audio vs reference 0 ms; 148 s for both renders + the diff.
Stills (a | b | ×8 diff) beside the report. The camera-file audio check
needs a first clip longer than 2 s (skipped on the seed; the 30 s gate rows
above are that check, run by hand).

**Remotion's bundled ffmpeg has no `select`, `hstack`, rawvideo muxer/demuxer
or f32 muxer**, so the instrument seeks (`-ss (n − ½)/fps`, byte-identical
to `select=eq(n,N)`), pipes WAV, and tiles stills in JS → image2pipe → png.

Gates: check:types 26/22 (baseline), 1,350 vitest green (+35: catalogue,
registry, settings default, colour policy, frame diff, audio offset, verify
helpers, zscale rewrite). Bench: `scripts/bench/export-engine-run.mjs`
(the real dialog over CDP, `--verify=<engine>`), `export-engine-wait.mjs`.

Left on disk: projects `t5-1080p-cut3s` (seed), the three 2026-09-05 exports
+ two `.verify-remotion.mp4` references + a `.verify/` stills folder under
`Videos\VidTSX`. Not done (Stage 4 tickets): queue rows persist
`framesRendered 0`, the `%TEMP%\remotion-v4…` asset copies per render.

**Stage 2's first commit:** `passthrough-engine.ts` + its catalogue entry
(needsFullFfmpeg) + one registry line, producing `{ videoPath }` only for a
single-video-track pure-cut timeline: the span planner from the document,
copied spans via ffmpeg-full with T1's nearest-pts select, browser spans
through the Remotion engine re-encoded by our ffmpeg, TS intermediates,
and an ffmpeg one-pass audio handed over as `audioPath` — gated by the
verify mode above against the Remotion engine on `t5-1080p` and
`t5-1080p-cut`.

## Stage 2 log — the passthrough engine, narrowest predicate · DONE 2026-09-06

**What the engine looks like behind the seam.** One catalogue entry
(`passthrough`, label "Fast", `needsFullFfmpeg` + `reportsCopiedShare`), one
`registerExportEngine` line, and five files beside the Remotion engine:

| file | does |
|---|---|
| `src/shared/studio/export-spans.ts` | the span planner, pure and shared: from the document alone, `planExportSpans` cuts the frame line at every base-track clip edge and every overlay edge and classes each piece **copy** (a video clip of a video asset with no transform/speed/gain/fades/transitions, same aspect as the composition, inside the source's duration), **browser** (anything else, adjacent pieces merged) or **black** (a gap, or a range window's tail); `planExportAudio` gives the one-pass audio as source cuts + silence, or null when the mix needs gain/fades/speed/transitions/audio tracks. Frame arithmetic is `serialize.ts`'s: `timeToFrame` edges, Remotion's whole-frame `trimBefore` as the source position |
| `passthrough-ffmpeg.ts` | the pure argument builders — the four T1 conditions as code: the nearest-pts `select` (rationals written as fractions so ffmpeg evaluates the same doubles), `-ss` one source frame early + `-copyts`, `setpts=N/(fps*TB)`, `-r fps -fps_mode cfr -frames:v N`; NVDEC → select → `scale_cuda` → NVENC p5 vbr cq 23 bf 2 g 60 (T1 leg 2's settings; QSV/AMF decode and scale in software, unmeasured); black spans from lavfi; browser spans re-encoded from Remotion's intermediate with `trim=start_frame=leadIn`; TS video-only pieces; a concat list with explicit `duration` lines; the audio pass (`atrim` + `anullsrc` + `concat`, 48 kHz stereo PCM, `apad=whole_dur`) |
| `passthrough-browser.ts` | a browser span through the SAME `renderComposition` the Remotion engine uses (same entry, bundle, zscale colour tags), `frameRange` one frame early, muted, x264 crf 10 — never concatenated as-is |
| `passthrough-probe.ts` | ffprobe of each distinct copied source: exact `r_frame_rate`, VFR check, `start_time` |
| `passthrough-engine.ts` | `availability()` = full ffmpeg installed **and** a hardware encoder probed working (else the D2/D4 download wording greys the row out); `produce()` = plan → probe (VFR or non-zero start time demotes a span to the browser) → pieces in order → count every piece's frames (a short copy piece is re-done in the browser) → join → count the joined file → audio → `{ videoPath, audioPath?, notes }`. The D4 notice rides `onProgress.message` while a nothing-to-copy timeline renders; `notes` carries "Copied N % of this timeline (k of n spans)" into the queue record |

The dialog computes "Copies N % of this timeline" with the same planner on
the live document (range exports trim first), so what it states is what the
engine plans. `remotion-renderer.ts` gained `frameRange`; the queue rows show
an engine's progress message during the rendering phase.

**Findings while building:**

1. *NVENC writes primaries/transfer only from the frames.* On the 8.1 build
   `-color_primaries bt709 -color_trc bt709` as output flags leave both
   "unknown" (matrix and range do land); the finishing stage refused the first
   piece. Every span graph now ends in `setparams=range=tv:color_primaries=
   bt709:color_trc=bt709:colorspace=bt709` (works on CUDA frames), the flags
   stay as belt and braces.
2. *Two references, two numbers.* Against the 2026-09-04 control (Remotion's
   old `yuvj420p pc bt470bg` path) the copied spans read mean 1.36–1.71/255,
   **0 % over 24** — T1 leg 2 exactly. Against the Stage 1 Remotion engine
   (`zscale` → `yuv420p tv bt709`) they read mean 2.2–2.5, **0.01 % over 24**
   (~200 of 2,073,600 pixels, max 40–44, at edges) on some frames. It is flat
   across the cut (449/450/451 alike — a wrong frame reads 3 % and max 200+)
   and no scaler moves it (scale_cuda default/bilinear/bicubic/lanczos, CPU
   bicubic/lanczos/area/bilinear all 0.01 %; scale_cuda default has the
   reference's whole-frame channel means exactly): it is the residue between
   the browser path's two colour conversions and the direct YUV path. The
   Stage 1 engine itself sits 1.3–2.0 from the control.
3. *The select must clamp the slot index.* Seeking a whole source frame early
   (safer than T8's half frame at the equality edge) means a frame before S
   is decoded; `n = max(round((t − S)·fps), 0)` lets it compete only for slot
   0, so it passes only when it really is the nearest — counts stay exact.
4. *A clip may end a hair past its source.* The first 3 h run sent 23 spans
   of ~28 s (5 % of an all-cuts timeline, hours of browser rendering) to the
   browser because the seed's millisecond-rounded clip ends overran the
   source duration by 0.3–0.5 ms and the planner demanded `sourceEnd ≤
   duration`. The last output slot sits one composition frame before the
   clip's end, so an overrun of up to half a composition frame still has a
   nearest source frame for every slot; the bound is now `duration + 0.5/fps`
   (the engine still counts every piece and re-renders a short one).
5. *A source's video stream ends before its container.* Second 3 h run: the
   DJI 0272 file is 157.9745 s long but its video has 9,469 frames (last pts
   157.958 s — the audio runs on), so an untrimmed clip's last output slot
   asks for a frame past the last one and the copy piece comes up one frame
   short; the browser fallback would have cost ~12 min per clip tail (0.96
   frames/s), eleven times over. Past a video's end the browser shows the
   last frame, so the engine now encodes the missing 1–3 frames from the short
   piece's own last frame (`tpad=stop_mode=clone`, `holdLastFrameArgs`) as a
   tail piece — one more encoder generation on one or two frames — and only
   falls back to the browser when more than that is missing.
6. *275 audio segments do not fit on a Windows command line.* The third 3 h
   run copied every span in 64 min and then died in the audio pass with
   `spawn ENAMETOOLONG`: the inline `-filter_complex` graph for 275 segments
   is ~36 KB against the 32 KB limit. The graph is now written beside the
   export and passed with `-filter_complex_script`; the live test runs a
   300-segment pass.
7. *A camera file's audio can end before its container, and one short
   segment shifts everything after it.* The fourth 3 h run's file measured
   0 ms against the camera file for its first 1,440 s, then −44.7 ms, −223,
   −402, −491 ms (flat from 4,044 s on): one −44.7 ms step per DJI 0271 clip
   tail — that file's audio stream is 73.045 s in a 73.090 s container, so
   `atrim=start=45:end=73.09` contributed 28.045 s where the video piece had
   28.09 s, and the concat butted the next segment in early. Every source
   segment is now pinned to its planned length (`apad=whole_dur` +
   `atrim=end`; `aresample=first_pts=0` so a late audio start pads instead of
   shifting the trim); the live test plays the 0271 tail into a 0270 segment
   and reads lag 0. The 30 s gates could not see this (no clip runs to a
   container end); a long timeline with whole-clip cuts is what exposes it.
8. *Pieces and joins verified, not assumed.* MPEG-TS pieces start at 1.4 s;
   the concat demuxer with `duration` lines lands every frame on the exact
   1/30 grid from 0.000 (checked frame by frame on a copy + black + copy join,
   `passthrough-ffmpeg.live.test.ts`, `VIDTSX_LIVE_FFMPEG=1`).

**Gate (the DONE criterion), passthrough engine through the real dialog over CDP with verify mode against the Remotion engine:**

| project | file | verify vs the Stage 1 Remotion engine | `t1-diff` vs control 2 at 1 / 300 / 449 / 450 / 451 / 600 / 899 | `t1-audio-offset` vs `raw/DJI_20260813142309_0270_D.MP4` at 0.5 / 7 / 13.5 / 14.5 / 15.2 / 16 / 22 / 29 s | copied spans | wall |
|---|---|---|---|---|---|---|
| `t5-1080p` | `studio-t5-1080p_2026-09-06T08-16-28.mp4`, 900 frames, `yuv420p tv bt709 bt709 bt709`, 30,289,013 B | 4 frames (1/300/600/899): mean 2.16–2.51, **max 0.01 % over 24** (300, 600; 0 at 1, 899), max 40; audio vs reference **0 ms**, vs camera **0 ms** (0.5/14.3/28.5 s) | **0 % over 24 at every frame**, mean 1.36–1.71, max 44 | **0 ms at every window, corr 1.000** | 1 span, 900 frames, 7.16 s = **4.19× realtime** | 7.7 s of frames + audio, 4.9 s mux → file in ~13 s; 640 s from click including the 9.5 min reference render + diff |
| `t5-1080p-cut` | `studio-t5-1080p-cut_2026-09-06T08-05-08.mp4`, 900 frames, same tags, 30,291,850 B | 7 frames (1/300/449/450/451/600/899): mean 2.16–2.51, **max 0.01 % over 24** (300, 450; 0 elsewhere), max 44; audio vs reference 0 ms, vs camera 0 ms (0.5/6.8/13.5 s) | **0 % over 24 at every frame**, mean 1.36–1.71 | **0 ms at every window, corr 1.000** | 450 + 450 frames: 4.10 s (**3.66×**) + 3.93 s (**3.82×**) | 8.7 s of frames + audio, 4.8 s mux; 646 s from click including the reference |
| `t5-1080p-cut3s` (seed) | `studio-t5-1080p-cut3s_2026-09-06T08-01-24.mp4`, 90 frames | 7 frames, max 0.01 %, audio 0 ms | — | — | 45 + 45 frames at 1.2× (ffmpeg + CUDA start-up dominates a 1.5 s span) | 3 s of frames |

A second export of `t5-1080p-cut` (`…T08-27-39.mp4`) has a **byte-identical
H.264 stream** (29,346,491 B, sha256 5c39f15f…) and audio stream
(`scripts/bench/passthrough-video-hash.mjs`). Reports + stills beside the
exports (`*.verify.json`, `*.verify/`), the diffs under
`.vidtsx-temp/bench/t1/stills/stage2-*`, the driver logs under
`.vidtsx-temp/bench/stage2/`.

**The 3 h project** (`t6-stress-3h`, re-seeded with `seed-long-project.mjs`:
44 assets, 275 clips of ≤ 45 s round-robin over the three DJI HEVC clips and
the video-2 H.264 master, 11,025 s / 330,749 frames, 100 % copyable), through
the real dialog after its 44 proxies had built (55 min, a separate cost):

| stage | wall | what |
|---|---|---|
| 275 copied spans | **63 min** (11:13:52 → 12:17:1x) | HEVC pieces 3.8–4.3× realtime, the H.264 master's 2.5–2.7× (T1 measured its decode at 1.9×); median 2.64×, three clip tails held one frame each |
| join + one-pass audio | ~5 min | TS concat → 10.27 GB video-only mp4, count checked (330,749); audio graph 39.7 KB via the script file, 2.1 GB WAV |
| finishing mux | **27 min** | AAC encode + stream copy + faststart rewrite of a 10 GB file — far slower than the 30 s case scales to; profile in Stage 4 (faststart double write, Defender) |
| **plan → file** | **95.9 min** (`framesMs` 4,119 s + `muxMs` 1,635 s) | `studio-t6-stress-3h_2026-09-06T11-13-47.mp4`, 10,611,520,689 B, 330,749 frames, `yuv420p tv bt709 bt709 bt709`, 11,024.97 s, "Copied 100 % of this timeline (275 of 275 spans)" |

T6 had put this timeline at ≈ 3.5 days through the browser (0.96 frames/s);
the copied spans alone are "about an hour", the whole file 1 h 36 min. Its
first clip is the same source frames as `t5-1080p`: `t1-diff` vs control 2 at
1/300/600/899 reads the same rows as the 30 s export (mean 1.36–1.71, **0 %
over 24**), audio vs the camera file **0 ms** at 0.5/7/13.5/22/29/40 s, and
but **−491 ms by the middle of the timeline** in this fourth run — finding 7
above, fixed after the run (the video is right; the audio pass was the
fault). Three earlier runs of the same project were findings 4–6: 5 % to the
browser (planner bound), one frame short at clip tails (held tail),
`ENAMETOOLONG` in the audio pass (script file); each was killed, fixed,
re-gated and re-run.

**Fifth run, after the audio fix — the export that stands:**

| stage | wall |
|---|---|
| 275 copied spans (3 held tails) | 61 min (13:06:12 → 14:07:28) |
| join + one-pass audio | ~7 min |
| finishing mux | 24.3 min (`muxMs` 1,457 s) |
| **plan → file** | **92.1 min** (`framesMs` 4,068 s + mux); 92.2 min from the Export click |

`studio-t6-stress-3h_2026-09-06T13-06-07.mp4`, 10,614,135,967 B, 330,749
frames, `yuv420p tv bt709 bt709 bt709`, 11,024.97 s, "Copied 100 % of this
timeline (275 of 275 spans)". Frames 300 / 899 vs control 2: mean 1.47–1.69,
**0 % over 24**. Audio vs the camera file, 1 s cross-correlation with a
±3.5 s search, at seven timeline positions from 0 to 5,124 s: corr 1.000
everywhere; 0.0 ms at 0 and 1,440 s, and at the clips whose document start
is off the frame grid exactly the grid rounding the video shares (+10.0 ms
at 2,143.09 s, +16.7 at 2,795.45, −10.0 at 3,447.81, +10.0 at 4,043.99 and
5,123.99 = round(start·30)/30 − start) — **no drift**. So: the copied spans
are "about an hour" (61–63 min for 3.06 h of 4K60 source, 3× realtime
overall), the whole file 1 h 32 min, of which the finishing mux is a Stage 4
target.

Gates: check:types 26/22 (baseline), vitest 1,406 green (+31: planner on the
two T1 documents and the Stage 2 edges, the select/args/list/audio builders,
parsers) + 2 live tests behind `VIDTSX_LIVE_FFMPEG=1`.

Not done, by design (Stage 3/4): gain/fade/speed/transition clips and audio
tracks send the whole audio to the Remotion pass (7 min on t5) and their
spans to the browser; the finishing mux of a 10 GB file took 27 min (profile
the faststart rewrite); the H.264 master decodes at 2.6× against HEVC's 4.2×
(NVDEC, not the engine); QSV/AMF copy paths unmeasured; a cut between two
DIFFERENT source files is planned as nearest (T1 measured only same-file
cuts — measure one on the first Stage 3 slice); many small browser spans each
re-download their sources (merge nearby spans); the ~200-pixel edge residue
vs the Remotion engine if the gate is ever tightened to 0.00 %.

**Stage 3's first commit:** widen `copyBlocker` for `gain`-only clips —
video copied, `volume=` in the audio pass — gated by verify mode on
`t5-1080p-cut` with a gain of 0.5 on clip B and the camera-file check; then
audio tracks (a mixed second input in the one pass) before multiple video
tracks. Measure a cut between two different source files first.

## Stage 3 log — widening the predicate · slice 1 DONE 2026-09-06

**Slice 1 = measure the different-file cut, then gain-only clips.** Two
planner changes (`src/shared/studio/export-spans.ts`), one line in the audio
pass (`passthrough-ffmpeg.ts`), no engine change; the seeds come from the new
`scripts/bench/seed-cut-projects.mjs`.

**Finding 1 — a cut to a different source file shows the CEIL frame; a
return to a file already opened shows the nearest.** T1 leg 0 had measured
only same-file cuts (nearest) and the first frame of a composition that
opens mid-source (ceil); the planner had assumed nearest at every cut. Two
seeds through the real dialog in verify mode against the Remotion engine,
each frame identified against the camera file's own frames (source frame K
scaled to 1080p, diffed against the export's frame):

| seed | question | Remotion at the cut | passthrough |
|---|---|---|---|
| `t5-1080p-cut-files` (0270 0–3 s, then 0272 from 15 s; 6 s, cut at frame 90) | the first clip of a second file | frame 90 = **K 900** — nearest is 899 (15 s × 59.94 = 899.1); K 900 reads 0.01 % over 24 against it, K 899 0.56 %; frames 89 and 91 nearest (178, 901) | with nearest (899): **0.51 % over 24, max 142** at frame 90 (a wrong frame's signature), 0 % at 89 and 91, 0.01 % elsewhere |
| `t5-1080p-cut-files2` (0270 0–3 s → 0272 from 6.667 s → 0270 from 30 s; 9 s, A-B-A, cuts at 90 and 180) | "ceil" or "the frame after the nearest"? and a return to an opened file | frame 90 = **K 400**, where nearest = ceil = 400 (401 reads 0.61 %) → it is the ceil rule, not nearest + 1; frame 180 (back to 0270) = **K 1798, the nearest** (1798 reads 0.016 %, ceil 1799 0.047 %) | "ceil on every change of file" put 1799 at 180: 0.02 % over 24, max 53 (a near-static shot, so a wrong frame reads low here); "ceil on the first clip of each file" puts 1798 there: **0 % at 180**, max 0.01 % over the 8 sampled frames (1/89/90/91/179/180/181/269), audio 0 ms vs reference and camera (`…cut-files2_2026-09-06T15-44-45.mp4`) |

So the rule (`docs/PREVIEW_TESTS_PLAN.md` §T1 leg 0 gained the two rows):
the export shows the ceil frame on the first frame it extracts after OPENING
a source file — the composition opening mid-source, or the first clip of
that file on the timeline; every later clip of an opened file, a same-file
cut or a return, shows the nearest. `planExportSpans` keeps the set of files
every piece so far has shown (copied or rendered) and sets `firstFrameCeil`
on a copy span whose file is new (and `sourceFrame > 0`); the select builder
already took it. Open, not blocking: whether the compositor closes an idle
file on a long timeline so that a return after minutes becomes an open
(ceil) — unmeasured; one source frame at one frame, inside the T1 tolerance,
and the verify instrument shows it as a ~0.5 % row at that cut.

**Widening 1 — gain-only clips.** `copyBlocker` no longer returns `gain`;
`planExportAudio` carries `gain` (only when ≠ 1) on the source segment and
`audioPassArgs` applies `volume=<gain>` between the format and the length
pin — the linear multiplier Remotion applies for a static `volume` prop
(`TimelineComposition.tsx` volumeProp; fades and transitions still go to the
browser walk). A gain of 0 is a multiply by 0, the segment keeps its pinned
length. Unit tests: the planner (copied, gain carried, unity dropped, fades /
speed still block), the graph, and a live pin (`VIDTSX_LIVE_FFMPEG=1`): the
gained segment reads 0.5× the camera file's RMS within 1 % at correlation
> 0.999, lag 0.

**Gate — `t5-1080p-cut-gain` (the T1 cut with gain 0.5 on clip B), through
the real dialog.** Verify mode shares the candidate's audio pass with the
reference, so the level and timing were also read against a plain Remotion
export of the same project (`…cut-gain_2026-09-06T16-04-32.mp4`, 11 min 20 s
from click) and against the camera file:

| check | result |
|---|---|
| file | `studio-t5-1080p-cut-gain_2026-09-06T15-50-36.mp4`, 900 frames, `yuv420p tv bt709 bt709 bt709`, 30,279,550 B, "Copied 100 % of this timeline (2 of 2 spans)" |
| verify vs the Stage 1 Remotion engine at 1/300/449/450/451/600/899 | mean 2.17–2.51, **max 0.01 % over 24** (300, 450; 0 elsewhere), max 44 — the Stage 2 rows; audio vs camera 0 ms (0.5/6.8/13.5 s) |
| `t1-diff` vs control 2 at the seven frames | **0 % over 24 at every frame**, mean 1.36–1.71, max 44 |
| `t1-audio-offset` vs the camera file at 0.5/7/13.5/14.5/15.2/16/22/29 s | **0 ms at every window, corr 1.000** — clip B included (the correlation is normalised) |
| level vs the camera file (1 s RMS) | 0.9954–0.9993 before the cut (the AAC round trip), **0.4992–0.4997 = −6.01…−6.03 dB** at 15.2/16/22/29 s |
| `t1-audio-offset` vs the Remotion export at the eight windows | **0 ms at every window, corr 1.000** |
| level vs the Remotion export | **1.000** at every window (1.0014 at 22 s) — both apply the same multiplier |
| `passthrough-video-hash` vs the Stage 2 cut export `…T08-27-39.mp4` | **H.264 stream byte-identical** (sha 5c39f15f…, 29,346,491 B); audio stream differs, as it must |
| copied spans | 450 frames in 4.68 s (3.21×) + 450 in 3.90 s (3.85×); `framesMs` 9,152, mux 4.9 s; 716 s from click including the reference render |

**Stage 2 gates re-run on the widened planner — nothing moved:**

| project | file | vs the Stage 2 export | `t1-diff` vs control 2 at the seven frames | `t1-audio-offset` vs camera at the eight windows | wall |
|---|---|---|---|---|---|
| `t5-1080p` | `studio-t5-1080p_2026-09-06T16-20-12.mp4` | **video AND audio streams byte-identical** to `…T08-16-28.mp4` (5b327678… / d3434a40…) | 0 % over 24 at every frame, mean 1.36–1.71 | 0 ms, corr 1.000 | 17 s from click |
| `t5-1080p-cut` | `studio-t5-1080p-cut_2026-09-06T16-16-14.mp4` | **video AND audio streams byte-identical** to `…T08-27-39.mp4` (5c39f15f… / d3434a40…) | 0 % over 24 at every frame, mean 1.36–1.71 | 0 ms, corr 1.000 | ~2 min from click (driver wait included) |

Gates: check:types 26/22 (baseline), vitest 1,411 green (+5; a first run had two failures that did not reproduce on the rerun while the gate exports were running), live ffmpeg
tests 5 (+1). Reports + stills beside the exports (`*.verify.json`,
`*.verify/`), the diffs under `.vidtsx-temp/bench/t1/stills/stage3-*`, the
driver logs under `.vidtsx-temp/bench/stage3/`; seeds `t5-1080p-cut-files`,
`t5-1080p-cut-files2`, `t5-1080p-cut-gain` on disk. Two driver lessons: a
card title with a space or a `×` must be quoted INSIDE the argument
(`'"--project=T1 cut"'` in a PowerShell `Start-Process` list, or run the
driver from Bash) — a bare `--project=T1 cut files` matched "T1 " loosely
and exported the wrong project; and someone opening Settings by hand in the
shared dev app mid-run makes the driver report "no Export button".

**Slice 2 (below) took the two widenings named here:** audio tracks as a
mixed chain in the one pass, then several video tracks. Still open: the
long-return question above.

## Stage 3 log — slice 2 · DONE 2026-09-06

**Slice 2 = audio tracks mixed in the one pass, then several video tracks.**
Two planner changes and one graph change, no engine change beyond a note; the
audio planner moved to its own file (`src/shared/studio/export-audio.ts`,
re-exported by `export-spans.ts`) when the planner passed 300 lines. Seeds
`music` and `stack` in `scripts/bench/seed-cut-projects.mjs`; two new
instruments, `t1-audio-level.mjs` (1 s RMS ratio per window) and
`t1-audio-residual.mjs` (below).

**Widening 2 — audio tracks.** `planExportAudio` no longer returns null for
an audio-track clip (kind `audio`/`sfx` on any track, or any clip on an audio
track): every track whose clips carry sound is its own CHAIN of source cuts +
silence covering [0, duration) with the clips' gains, and the pass sums the
chains with `amix=inputs=N:dropout_transition=0:normalize=0` — the very
filter `@remotion/renderer` merges a composition's audio with
(`create-ffmpeg-merge-filter.js`), so a static gain and a mix come out at
Remotion's levels. Each chain is concatenated and pinned to the whole length
first (`atrim=end` + `apad=whole_dur`), then mixed; one chain keeps the Stage
2 graph to the byte (labels and `[out]` unchanged), so the earlier exports'
audio streams cannot move. A muted track contributes no chain; two audible
clips overlapping on ONE track (a document the timeline ops never write) still
return null. Unit tests: the planner (a second chain with its gain, a muted
track, a soundless track, sound only on an audio track, a range window
trimming every chain) and the graph (chain labels, the pin per chain, the
exact amix line, the one-chain graph unchanged); a live pin
(`VIDTSX_LIVE_FFMPEG=1`): the base chain plus a second at gain 0.5 reads the
sample-for-sample sum of the two camera-file segments (correlation > 0.999,
RMS within 1 %), lag 0.

**Widening 3 — several video tracks.** `planExportSpans` no longer sends a
timeline with more than one video track to the browser: tracks are painted
bottom-up in reverse document order (`TimelineComposition.tsx`), so for every
piece between cut edges (now every clip edge on every video track) the
TOPMOST clip covering it is the one on screen; when that clip is a pure cut it
fills the frame and hides every clip below it, so the piece is copied from it
alone; when it is not (a transform, a letterbox, a fade…) the piece goes to the
browser — an upper clip that only partly covers what is below is composited
there; a piece no track covers is black; a dropped upper clip lets the lower
one through. Covered clips still open their files in the browser (every
mounted tag extracts frames), so they count for the ceil rule from slice 1:
a lower-track file that has been playing under an upper clip shows the
NEAREST frame when it comes back into view (modelled from the rule, not
re-measured — the seed below uses one file). Unit tests: the T1 cut as two
tracks plans the two Stage 2 spans; an upper clip in the middle splits the
base and resumes its source position; a transformed upper clip sends its piece
alone to the browser (67 % copied); gaps, a dropped upper clip, the covered
file's ceil flag.

**Instrument finding — a quiet mixed track cannot be timed by correlating the
music file against the export.** Under the camera track the music at gain 0.5
sits at 1/5 of the level; a normalised cross-correlation of the music file
against the export reads corr 0.05 with random lags at 48 kHz, and at 8 kHz
locks at 0 ms on two windows but on a false +1.18 s peak (the periodic tone)
on a third. `t1-audio-residual.mjs` subtracts the camera file's audio from the
export (both at timeline time — lag 0 by the offset gate) and correlates the
RESIDUAL with the music file at music time, reporting lag, correlation and
the residual's RMS over gain × the music's RMS. Second finding: it must
decode whole files — `-ss` before `-i` on an AAC mp4 landed 16 samples off on
the Remotion export at four of five windows (the subtraction then leaves the
whole camera track), while the same file decoded from 0 subtracts cleanly.
`t1-audio-offset.mjs` always decoded whole files, which is why the offset
gates never saw this.

**Gate — `t5-1080p-cut-music` (the T1 cut with a music clip on A1 from 5 to
25 s, source 2 s, gain 0.5; the music is `raw/music-40s.wav`, pink noise +
a 330 Hz tone generated by the seed), through the real dialog.** Verify mode
shares the candidate's audio pass, so the audio was gated against a plain
Remotion export of the same project (`…cut-music_2026-09-06T17-26-59.mp4`,
31,217,778 B, 8.6 min from click) and against the camera file:

| check | result |
|---|---|
| file | `studio-t5-1080p-cut-music_2026-09-06T17-15-09.mp4`, 900 frames, `yuv420p tv bt709 bt709 bt709`, 30,299,859 B, "Copied 100 % of this timeline (2 of 2 spans). Mixed 2 audio chains in the one pass." |
| verify vs the Stage 1 Remotion engine at 1/300/449/450/451/600/899 | mean 2.16–2.51, **max 0.01 % over 24** (300, 450; 0 elsewhere), max 44 — the Stage 2 rows; audio vs reference 0 ms, vs camera 0 ms |
| `t1-diff` vs control 2 at the seven frames | **0 % over 24 at every frame**, mean 1.36–1.71, max 44 |
| `passthrough-video-hash` vs the Stage 2 cut export `…T08-27-39.mp4` | **H.264 stream byte-identical** (sha 5c39f15f…, 29,346,491 B) — an audio track does not touch the picture |
| `t1-audio-offset` vs the plain Remotion export at 0.5/7/13.5/14.5/15.2/16/22/29 s | **0 ms at every window, corr 1.000** |
| `t1-audio-level` vs the Remotion export | **1.000 at every window** (0.9998–1.0017) |
| `t1-audio-offset` vs the camera file | **0 ms at every window**; corr 1.000 outside the music, 0.975–0.987 under it — the same rows as the Remotion export reads |
| `t1-audio-level` vs the camera file | 0.995 at 0.5 s, 1.009–1.025 under the music (the music adds ≈ 1/5 of the level in quadrature), 0.998 at 29 s |
| `t1-audio-residual` (export − camera vs the music file at −3 s, gain 0.5) at 7/13/14.5/16/22 s | **lag 0.00 ms, corr 0.983–0.987, level 0.980–0.986** of the gained music (the AAC round trip) — and the Remotion export reads the SAME rows to four decimals |
| copied spans | 2 of 2, 900 frames; 9.8 min from click including the reference render + diff |

**Gate — `t5-1080p-cut-stack` (the T1 cut as two tracks: V1 15–30 s from
source 15 s, muted, over V2 0–30 s from 0; the same two spans as
`t5-1080p-cut`), through the real dialog in verify mode** — the dialog states
"Copies 100 % of this timeline" for a two-track project (it was "0 %, more
than one video track" before):

| check | result |
|---|---|
| file | `studio-t5-1080p-cut-stack_2026-09-06T17-49-06.mp4`, 900 frames, `yuv420p tv bt709 bt709 bt709`, 30,291,850 B, "Copied 100 % of this timeline (2 of 2 spans)" |
| `passthrough-video-hash` vs the Stage 2 cut export `…T08-27-39.mp4` | **H.264 AND audio streams byte-identical** (5c39f15f… / d3434a40…) — the upper track's span selects the same source frames as the cut's second clip (same file already open → nearest), and the muted upper track contributes no chain |
| verify vs the Stage 1 Remotion engine at 1/300/449/450/451/600/899 | mean 2.16–2.51, **max 0.01 % over 24** (300, 450; 0 elsewhere), max 44 — the Stage 2 rows; audio vs reference 0 ms, vs camera 0 ms |
| `t1-diff` vs control 2 at the seven frames | **0 % over 24 at every frame**, mean 1.36–1.71, max 44 |
| `t1-audio-offset` vs the camera file at the eight windows | **0 ms at every window, corr 1.000** |
| `t1-audio-level` vs the camera file | 0.995–0.9996 (the AAC round trip) — the muted upper track adds nothing |
| wall | 13.3 min from click, of which the two-track Remotion reference render was ≈ 12 min (two mounted `OffthreadVideo` tags); the copied spans themselves as on `t5-1080p-cut` |


**Stage 2 + slice 1 gates re-run on the widened planners — nothing moved:**

| project | file | vs the earlier export | wall |
|---|---|---|---|
| `t5-1080p` | `studio-t5-1080p_2026-09-06T17-37-37.mp4` | **video AND audio streams byte-identical** to `…T08-16-28.mp4` (5b327678… / d3434a40…) | 20 s from click |
| `t5-1080p-cut` | `studio-t5-1080p-cut_2026-09-06T17-39-59.mp4` | **video AND audio streams byte-identical** to `…T08-27-39.mp4` (5c39f15f… / d3434a40…) | 21 s from click |
| `t5-1080p-cut-gain` | `studio-t5-1080p-cut-gain_2026-09-06T17-42-20.mp4` | **video AND audio streams byte-identical** to `…T15-50-36.mp4` (5c39f15f… / dfa537ec…) | 20 s from click |

Gates: check:types 26/22 (baseline), vitest 1,415 (+4) green, live ffmpeg
tests 6 (+1). Reports + stills beside the exports, the driver logs under
`.vidtsx-temp/bench/stage3/` (`*-slice2*`, `music-*`, `stack-*`, `*-pt2`);
seeds `t5-1080p-cut-music`, `t5-1080p-cut-stack` and `raw/music-40s.wav` on
disk.

**Not done, by design (slice 3):** audio fades and crossfade transitions in
the one pass (`afade` / the equal-power curves of `TimelineComposition.tsx`
volumeProp, per-frame — gate level per window against a plain Remotion export
as above); speed changes (`atempo` does not match Remotion's playbackRate
resampling — measure first); the long-return question; then Stage 4.

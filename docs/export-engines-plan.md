# Export engines — the passthrough build as an opt-in engine

> Decided with Hasan 2026-09-04, right after T1 (`docs/PREVIEW_TESTS_PLAN.md`
> §T1) proved the passthrough join inside the WYSIWYG tolerance. Stage 1 (the
> engine seam) and Stage 2 (the passthrough engine at its narrowest predicate)
> are built and gated — see the §Stage 1 and §Stage 2 logs at the end; Stage 3
> widened the predicate one gated slice at a time and is complete for what the
> predicate names (§Stage 3 log, slices 1–4); Stage 4 is not started. Companion: `docs/studio/PLAN.md` §5 ("smart render"),
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
| **3 — widen the predicate** · **DONE 2026-09-06/07** (slices 1–4) | audio tracks, multiple video tracks where lower tracks are fully covered, clips whose only change is a trim; every widening re-runs the gate | each new span type passes the gate before it is enabled — **slice 1 met**: the different-file cut measured (the export shows the ceil frame on the first frame after it opens a source file, the nearest on a same-file cut or a return; the planner carries it, the A-B-A seed reads 0 % over 24 at both cuts) and gain-only clips copied (video byte-identical to the Stage 2 cut export, audio 0 ms vs the camera file and vs an independent Remotion export at eight windows, level 0.4995–0.4997 on the gained clip and 1.000 vs Remotion); the Stage 2 gates re-run byte-identical. **Slice 2 met**: audio tracks mixed in the one pass (a music clip under the T1 cut: video byte-identical to the Stage 2 cut export, audio 0 ms and level 1.000 vs a plain Remotion export at eight windows, the mixed music at lag 0 and 0.98 of its gained level in the export-minus-camera residual on both exports alike) and several video tracks (the T1 cut as two stacked tracks: video AND audio byte-identical to the Stage 2 cut export, 0 % over 24 vs the control, audio 0 ms vs the camera); the three earlier gates re-run byte-identical on video AND audio. **Slice 3 met**: speed measured (Remotion = the nearest source frame on the scaled time line + a pitch-preserving `atempo` that our ffmpeg reproduces bit for bit — the recipe for the next slice, not widened yet); audio fades in the one pass (a faded clip's picture copied byte-identical to the Stage 2 cut export; its audio Remotion's own per-frame `volume=` expression on the same decoder buffers: 0 ms vs the camera file at eight windows, level 1.000 vs a plain Remotion export in 1 s windows outside the ramps and in 100 ms windows inside them); crossfade transitions (only the 30-frame window rendered, 97 % copied; 0 % over 24 vs both references at every sampled frame; the equal-power sum of the two lanes matches a model of the composition within 0.02, where the Remotion export is comb-filtered by its own whole-millisecond asset placement); the five earlier gates re-run byte-identical on video AND audio. **Slice 4 met**: speed (a clip at rate ≥ 1 is copied on the scaled time line — the nearest select with `S + rate·n/fps`, the ceil rule on a first frame unchanged and re-measured on a sped clip that opens a file — and its audio is Remotion's own `aformat s16 48k, atempo, atrim` chain in the one pass, a curve on it on the post-tempo time line; the pass's sped segment byte-identical PCM to that chain with and without a fade; the speed seed reads the SAME source frames as the plain Remotion export at every mapped frame, max 0.01 % over 24 at the seven frames, audio 0 ms and level 1.000 at eight windows, the sped music at lag 0; a second seed with a sped, faded clip of a second file at 2× and a 3× music clip reads the same K and the same levels inside the ramps, +0.3 ms on the faded-in clip = Remotion's whole-ms placement); the seven earlier gates re-run byte-identical on video AND audio. Slow motion (rate < 1) stays a browser span. Next: Stage 4; the long-return question |
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

## Stage 3 log — slice 3 · DONE 2026-09-07

**Slice 3 = speed measured first, then audio fades and crossfade transitions
in the one pass.** The audio planner now reads the SAME serialization the
composition receives (`serializeTimeline` with a stub resolver, so the fade
rounding, the crossfade handles and the shifted `trimBefore` are the
serializer's by construction) and carries a per-frame volume curve; the span
planner copies faded clips and sends only a transition's window to the
browser; the audio pass writes Remotion's own per-frame `volume=` expression.
No engine change. Seeds `fade`, `xfade`, `speed` in
`scripts/bench/seed-cut-projects.mjs`; `t1-audio-level.mjs` gained `--win`
(a 100 ms window reads a level INSIDE a ramp), `t1-frame-map.mjs` gained
`--rate`/`--from` (a sped clip's time line).

**Finding 1 — what Remotion does to a sped clip (`t5-1080p-cut-speed`: clip B
at speed 1.5 from source 15 s, a music clip on A1 at speed 1.5, plain
Remotion export `…cut-speed_2026-09-06T20-37-33.mp4`).** Picture: output
frame n of the clip shows the source frame NEAREST to 15 s + 1.5·n/30 —
frames 450…456 show K 899, 902, 905, 908, 911, 914, 917 (every third source
frame; 899 is the nearest, not the ceil, because the file was already open
for clip A), frame 600 (t = 22.5 s) K 1349, frame 899 (37.45 s) K 2245, all
"nearest" by `t1-frame-map` — the slice-1 rule with the time line scaled.
Audio: `@remotion/renderer` runs `atempo=<rate.toFixed(5)>` BEFORE its trim
(`calculate-atempo.js`, `stringify-ffmpeg-filter.js`: `aformat s16 48k,
atempo, atrim` at post-tempo times — trimLeft = trimBefore/(fps·rate), i.e.
the same source instant), a pitch-preserving WSOLA stretch, not a resample.
Measured: clip B against our full ffmpeg's `atempo=1.50000,atrim=start=10:
end=25` of the camera file reads **lag 0 ms, corr 1.000 at 0.5/3/7/10/14 s,
level 0.999–1.000**; the sped music's export-minus-camera residual against
the same `atempo` of the music file reads **lag 0.00 ms, corr 0.984–0.988,
level 0.98** (the AAC round trip — the rows the slice-2 music gate read) and
against a plain resample (`asetrate·1.5,aresample`) corr 0.2–0.4 at random
lags. And Remotion's bundled ffmpeg 7.1 and our 8.1.2 produce **bit-identical
PCM** for the same `atempo` chain (camera and music alike, md5 of the s16
payload) — so ffmpeg CAN reproduce Remotion's speed exactly: audio =
Remotion's chain verbatim, picture = the nearest select with `t = S +
rate·n/fps`. Not widened in this slice (the fades and transitions were the
scope); it is the recipe for the next one. Until then a sped clip stays a
browser span and sends the whole audio to the Remotion pass.

**Finding 2 — how Remotion applies a volume curve (read in
`@remotion/renderer`, then verified against the real export).** For an
`<OffthreadVideo>`/`<Audio>` with a volume callback, every rendered frame
registers the value the callback returns (`TimelineComposition.tsx`
volumeProp: gain × linear fade ramps × the equal-power crossfade / linear
dip curves, on whole frames); a frame whose value is 0 registers NOTHING, so
the asset starts one frame late on a fade-in (frame 0 of a faded-in clip is
silent, the audio starts at source frame trimBefore + 1 — the crossfade's
trailing clip too, sin 0 = 0). `calculate-asset-positions.js` collects one
value per frame; `ffmpeg-volume-expression.js` rounds each to 1/97 steps at
3 dp (`roundVolumeToAvoidStackOverflow` — ffmpeg's expression depth of 100),
repeats the last value once, groups the values and nests them most-common-
last as `if(between(t,a,b)+…,v,…)` with windows half a frame either side of
the frame's SOURCE time (4 dp), and the filter runs `volume='…':eval=frame`
— evaluated once per decoded audio buffer at the buffer's first pts. So a
Remotion fade is a staircase on the decoder's 1024-sample buffers, not a
per-sample ramp and not exactly a per-video-frame one; and a faded clip at
gain 0.5 plays its flat part at **0.505** (49/97), which the camera-file level
below confirms. Two consequences for the pass: (a) the chain must share the
decoder's buffer boundaries — it does: `aresample=async=1:first_pts=0,atrim`
and Remotion's `aformat,atrim` give the same 896/1024-sample frames at the
same pts on the DJI file (`ashowinfo`), and the 7.1/8.1 outputs of one such
`volume` chain are bit-identical; (b) the expression is placed right after
the trim, before `asetpts`, so `t` is source time as in Remotion's chain.
Third finding, from the same file: Remotion places each asset with
`adelay=<whole ms>` (`padStart·1000).toFixed(0)`), so a clip whose first
audible frame is off the millisecond grid — every fade-in at 30 fps, frame
451 = 15.0333 s → 15033 ms — plays up to 0.5 ms EARLY in a Remotion export.
The pass keeps the exact frame time (D6: the camera file is the reference).
Both predictions hold on the plain Remotion export of the fade seed
(`…cut-fade_2026-09-06T20-54-59.mp4`) against the camera file: clip A (no
fade-in) 0 ms at 0.5/7/13.5 s, clip B **−0.3 ms (−16 samples) at 14.5/15.2/
16/22/29 s**; level 0.9954–0.9995 on A and **0.5027–0.5044 on B's flat part**
(0.505 × the AAC round trip; slice 1's plain gain-0.5 clip read 0.4992–
0.4997). So the gate below reads the pass at 0 ms against the camera on both
clips and at +0.3 ms against the Remotion export on clip B — the Remotion
defect, not the pass's. The crossfade reference (`…cut-xfade_2026-09-06T21-
05-38.mp4`) reads the same: A 0 ms, B (first audible frame 436 = 14.533 s)
−0.3 ms at 14.5/15.2/16/22/29 s, and inside the window the two equal-power
halves of the same file add up to 1.03–1.29 of the camera level in 100 ms
windows (energy adds: two different moments of one recording).

**Widening 4 — fades.** `copyBlocker` no longer returns `fade` (the picture
never fades: `transformStyle`/`transitionOpacity` do not read it), so a faded
clip's span is copied. `planExportAudio` (rewritten on the serialization)
gives a curved clip one source segment per run of audible frames, starting
at that run's source position, with `volumes` = the composition's per-frame
values; `audioPassArgs` turns it into `remotionVolumeExpression` (the
construction above, tested string-for-string) and `eval=frame`. Unit tests:
the T1 fade seed's plan (A's 15-frame ramp, B one frame late at source
451/30 with 0.5/30 … 0.5 … 0.5/60), the fade-out curve values, the one-frame
silence before a faded-in audio clip, the expression's rounding / padding /
windows / ordering, the graph line, fps required. Live pin
(`VIDTSX_LIVE_FFMPEG=1`): a 1 s fade-in at gain 0.5 through the pass versus
Remotion's preprocess chain run verbatim on the same file — **best lag 0
over ±2 samples, corr > 0.9999, level within 0.2 % in 100 ms windows inside
and after the ramp**; the flat part 0.505 of the camera file, the first
100 ms under 6 % of it.

**Widening 5 — transitions.** The span planner takes each video track's
clips from the serializer (the leading clip extended by its handle, the
trailing one started early with the shifted `trimBefore`) and sends ONLY the
transition window to the browser (`reason: 'transition'`; both clips paint
there — the trailing one fading in over the leading one, or the dip to
black); the pieces either side are copies whose source position continues
exactly (a 1 s crossfade at 5 s: copy 0–135, browser 135–165, copy from 165
at source frame 615). The audio planner puts two clips that sound at once on
one track into two LANES, each its own chain, summed by the same `amix` — a
crossfade is the cos curve on the leading clip's last 30 frames and the sin
curve on the trailing clip's first 30 (its frame 0 silent, per finding 2).
Unit tests: the crossfade and dip-to-black span plans, the two-lane audio
plan with the equal-power values, overlapping clips on one track (no longer
null: they sound together, as in the composition).

**Gate — `t5-1080p-cut-fade` (the T1 cut with a 0.5 s fade-out on clip A
and gain 0.5 + a 1 s fade-in + a 2 s fade-out on clip B), through the real
dialog in verify mode; the dialog states "Copies 100 % of this timeline".**
Verify mode shares the candidate's audio pass, so the audio was gated against
the plain Remotion export of the same project (`…cut-fade_2026-09-06T20-54-59.mp4`)
and against the camera file:

| check | result |
|---|---|
| file | `studio-t5-1080p-cut-fade_2026-09-06T22-18-48.mp4`, 900 frames, `yuv420p tv bt709 bt709 bt709`, 30,283,517 B, "Copied 100 % of this timeline (2 of 2 spans)" |
| `passthrough-video-hash` vs the Stage 2 cut export `…T08-27-39.mp4` | **H.264 stream byte-identical** (sha 5c39f15f…, 29,346,491 B) — a fade never touches the picture; the audio stream differs, as it must |
| verify vs the Stage 1 Remotion engine at 1/300/449/450/451/600/899 | mean 2.16–2.51, **max 0.01 % over 24** (300, 450; 0 elsewhere), max 44 — the Stage 2 rows; audio vs reference 0 ms at 0.5/14.3/28.5 s, vs camera 0 ms |
| `t1-diff` vs control 2 at the seven frames | **0 % over 24 at every frame**, mean 1.36–1.54, max 44 |
| `t1-audio-offset` vs the plain Remotion export at 0.5/7/13.5/14.5/15.2/16/22/29 s | **0 ms** at 0.5/7/13.5 s (clip A, fade-out included at 14.2 s: corr 0.954 across the quiet ramp), **+0.3 ms (16 samples)** at 14.5/15.2/16/22/29 s and inside B's ramps at 15.1/28.3/28.9 s — Remotion's whole-ms `adelay` on the faded-in clip (finding 2); the same export reads −0.3 ms against the camera there |
| `t1-audio-level` vs Remotion, 1 s windows | **1.000 at every window** (0.9998–1.0037, the 1.0037 at 16 s = the first second after the fade-in) |
| `t1-audio-level` vs Remotion INSIDE the ramps, 100 ms windows: A's fade-out at 14.5/14.6/14.7/14.8/14.9 s; B's fade-in at 15.05/15.283/15.533/15.783/15.95 s (0 / ¼ / ½ / ¾ / end); B's fade-out at 28.0/28.5/29.0/29.5/29.9 s | **0.998–1.003 at thirteen of the fifteen windows**; 0.977 at 15.05 s and 0.982 at 15.783 s — the two near-silent windows of the recording (RMS 0.005 and 0.0017), where Remotion's 16-sample shift changes what falls inside a 100 ms window |
| `t1-audio-offset` vs the camera file at the eight windows | **0 ms at every window**; corr 1.000 outside the ramps, 0.887–0.947 inside them (a ramp against a flat reference) |
| `t1-audio-level` vs the camera file | 0.9954–0.9993 on A; **0.5046 / 0.5045 at 16 / 22 s** on B's flat part = 0.505 (Remotion's 1/97 rounding of gain 0.5) × the AAC round trip, the row the Remotion export reads (0.5027 / 0.5044); 0.109 / 0.382 / 0.172 at 14.5 / 15.2 / 29 s inside the ramps, equal to Remotion's 0.109 / 0.382 / 0.172 |
| copied spans | 2 of 2, 900 frames; 26.7 min from click in verify mode (the reference render + diff; a first run 30 s after the app restart found no project cards and was rerun) |

**Gate — `t5-1080p-cut-xfade` (the T1 cut with a 1 s crossfade at 15 s),
through the real dialog in verify mode; the dialog states "Copies 97 % of
this timeline" (870 of 900 frames — only the 30-frame window renders).** The
plain Remotion export of the same project is `…cut-xfade_2026-09-06T21-05-38.mp4`:

| check | result |
|---|---|
| file | `studio-t5-1080p-cut-xfade_2026-09-06T21-19-54.mp4`, 900 frames, `yuv420p tv bt709 bt709 bt709`, 30,498,448 B, 3 spans (copy 0–435, browser 435–465, copy 465–900), "Mixed 2 audio chains in the one pass" (the two lanes) |
| verify vs the Stage 1 Remotion engine at 1/300/449/450/451/600/899 | copied frames mean 2.16–2.51, **max 0.01 % over 24** (300), max 42 — the Stage 2 rows; the three frames INSIDE the crossfade window (browser-rendered, both clips blended) mean 0.99–1.04, **0 % over 24**, max 40; audio vs reference 0 ms at 0.5/14.3/28.5 s, vs camera 0 ms |
| `t1-diff` vs control 2 at 1/300/434/465/600/899 (the copied frames either side of the window) | **0 % over 24** at 1/300/434/600/899, 0.01 % at 465 (the first copied frame after the window: nearest, same file open — a wrong frame reads 0.5 %), mean 1.36–1.55, max 44 |
| `t1-audio-offset` vs the plain Remotion export at the eight windows | **0 ms** at 0.5/7/13.5 s (clip A), **+0.3 ms (16 samples)** at 14.5/15.2/16/22/29 s (clip B: Remotion's whole-ms `adelay`, finding 2 — the Remotion export reads −0.3 ms against the camera at the same windows, the pass 0 ms) |
| `t1-audio-level` vs Remotion, 1 s windows | **1.000** at 0.5/7/13.5/16/22/29 s (0.9998–1.0033); 1.15 and 1.06 at 14.5 and 15.2 s (inside the window — next row) |
| inside the crossfade, `t1-audio-gain-curve` at 20 ms steps (both clips are the SAME recording at the same instant here, so the export ÷ camera ratio is the applied curve) | the pass reads the composition's coherent sum cos + sin — 1.07 at 14.56 s, **1.417 at 15.00 s**, 1.00 at 15.52 s — within 0.02 of a model built from the camera file and the two 1/97-rounded curves at every step; the Remotion export reads 1.06 → 1.33 → 1.07/0.98 (a notch at 15.08–15.12 s) → a 1.16 plateau → 0.98 — within 0.01 of the SAME model with the trailing clip 16 samples early at every step, notch and plateau included. So inside a crossfade of one file with itself Remotion's ms placement comb-filters the sum (first notch 1.5 kHz); with two different sources the sum is incoherent and level-neutral. The pass keeps the frame-exact sum the preview plays |
| `t1-audio-offset` vs the camera file at the eight windows | **0 ms at every window**, corr 1.000 outside the window, 0.999/0.991 at 14.5/15.2 s |
| wall | 42 min from click, of which the two-clip Remotion reference render + diff was most (the copied spans themselves as on `t5-1080p-cut`) |

**Stage 2 + slice 1 + slice 2 gates re-run on the widened planners — nothing moved:**

| project | file | vs the earlier export | wall |
|---|---|---|---|
| `t5-1080p` | `studio-t5-1080p_2026-09-06T22-01-13.mp4` | **video AND audio streams byte-identical** to `…T08-16-28.mp4` (5b327678… / d3434a40…) | 4.8 min from click as the driver measures it (its waits included) |
| `t5-1080p-cut` | `studio-t5-1080p-cut_2026-09-06T22-06-09.mp4` | **video AND audio byte-identical** to `…T08-27-39.mp4` (5c39f15f… / d3434a40…) | 2.9 min |
| `t5-1080p-cut-gain` | `studio-t5-1080p-cut-gain_2026-09-06T22-09-13.mp4` | **video AND audio byte-identical** to `…T15-50-36.mp4` (5c39f15f… / dfa537ec…) | 2.9 min |
| `t5-1080p-cut-music` | `studio-t5-1080p-cut-music_2026-09-06T22-12-17.mp4` | **video AND audio byte-identical** to `…T17-15-09.mp4` (5c39f15f… / e18e0a4b…) | 2.8 min |
| `t5-1080p-cut-stack` | `studio-t5-1080p-cut-stack_2026-09-06T22-15-42.mp4` | **video AND audio byte-identical** to `…T17-49-06.mp4` (5c39f15f… / d3434a40…) | 3.1 min |

Gates: check:types 26/22 (baseline), vitest 1,419 green (+4 files' worth: 49
in the planner + builder files; a first full run had two failures that did not
reproduce on the rerun, as in slice 1), live ffmpeg tests 7 (+1). Reports +
stills beside the exports, the driver logs under `.vidtsx-temp/bench/stage3/`
(`*-slice3*`, `fade-*`, `xfade-*`, `speed-*`, `*-pt3`); seeds
`t5-1080p-cut-fade`, `t5-1080p-cut-xfade`, `t5-1080p-cut-speed` on disk. Two
driver lessons: editing `src/shared` while a driver waits reloads the renderer
and the driver never sees its completion event (the export itself finishes;
kill the driver, do not re-export); and the first driver run right after a
restart can find no project cards yet — run it again.

**Not done, by design (next slice):** speed — the recipe is in finding 1
(audio = Remotion's `aformat,atempo,atrim` chain verbatim, bit-identical
across ffmpeg 7.1/8.1; picture = the nearest select with the clip's rate on
the time line; `copyBlocker`'s source-end bound then needs `duration × rate`,
and a crossfade handle on a sped clip consumes `rate` source frames per
frame as the serializer already computes); the long-return question; then
Stage 4 (progress copied vs rendered, cancel cleanup, the 10 GB finishing
mux, merge nearby browser spans — the crossfade window is a 30-frame span
that pays a full bundle + Chrome start, QSV/AMF unmeasured).

## Stage 3 log — slice 4 · DONE 2026-09-07

**Slice 4 = speed, by slice 3's recipe: the picture copied on the scaled time
line, the audio as Remotion's own `atempo` chain in the one pass.** Two planner
changes (`export-spans.ts`, `export-audio.ts`), two builder changes
(`passthrough-ffmpeg.ts`: the select takes a rate, the audio pass gains a sped
branch), one line in the engine (the span's rate reaches `copySpanArgs`). Seed
`speed2` in `scripts/bench/seed-cut-projects.mjs`.

**Widening 6 — the picture of a sped clip.** `copyBlocker` no longer returns
`speed` for a rate ≥ 1; the source-end bound becomes `sourceIn + duration ×
rate ≤ probe.duration + 0.5·rate/fps` (the slots sit `rate` composition frames
apart). A copy span carries `rate`, and its `sourceFrame` is `trimBefore +
rate × (offset into the clip)` — the composition's own arithmetic
(`getExpectedMediaFrameUncorrected`: startFrom + frame × playbackRate), so a
span that starts mid-clip after an overlay or a transition window can sit on a
fractional composition frame. `nearestSelectFilter` maps slot n to `S +
rate·n/fps` with `n = max(0, round((t − S)·fps/rate))`; the rate is written
as JS prints it (the shortest round-trip form, so ffmpeg's strtod gives the
same double); without a rate the string is byte for byte Stage 2's. The ceil
rule on a span's first frame is unchanged. Slow motion (rate < 1) stays a
browser span (`slow motion`): one source frame would have to serve several
output slots and `select` cannot repeat a frame — a frame-duplication recipe
is unmeasured. Unit tests: the speed seed's plan (the T1 cut's two spans, the
second at rate 1.5), a sped clip split by an overlay (the piece after it at
600 + 180 × 1.5), the rate-scaled source-end bound, rate 1 = no rate; the
select string with and without a rate, the JS model of the rule reading K 899,
902 … 917 / 1349 / 2245 for the seed's slots.

**Widening 7 — the audio of a sped clip.** `planExportAudio` no longer returns
null on `playbackRate`: the segment carries `rate`, its `sourceIn` is still
the SOURCE instant of the first audible frame ((trimBefore + k·rate)/fps) and
its `duration` the timeline length. `audioPassArgs` writes such a segment as
Remotion's chain verbatim instead of the resample + trim: `aformat=sample_fmts
=s16:sample_rates=48000`, `calculateATempo` ported (`atempo=<rate to 5 dp>`
inside 0.5–2, else the square root twice, recursively — `remotionAtempoFilter`),
`atrim` at POST-tempo times written as Remotion's `stringifyTrim` does (whole
microseconds with its floating-point clean-up, `remotionTrimMicros`; measured
bit-identical to `start=/end=`), the volume right after the trim as Remotion
orders it, then our pin. The trim point is `sourceIn / rate` =
`seamless-aac-trim.js` getActualTrimLeft with seamless = true
(audioStartFrame/fps/rate + sinceStart/fps, audioStartFrame = trimBefore,
sinceStart = the first audible frame's index). A volume CURVE on a sped clip
sits on the same post-tempo time line: `ffmpegVolumeExpression` receives that
trimLeft and every registered frame is 1/fps of the stretched audio, so
`remotionVolumeExpression(volumes, sourceIn / rate, fps)` — that answers the
open question from slice 3 (what Remotion's windows are for a sped AND faded
clip) from the renderer's code, and the live pin and the `speed2` gate below
confirm it on ffmpeg and on a real export. Unit tests: the speed seed's audio
plan (B at 1.5, the music chain at 1.5 with its gain), a sped clip with a
fade-in (one frame late at (450 + 2)/30, 449 values), the atempo chain and
trim strings, the sped graph line, the sqrt chain for rate 3, the curve
windows at post-tempo times. Live pins (`VIDTSX_LIVE_FFMPEG=1`): the pass's
sped segment is **byte-identical PCM** to Remotion's chain run directly
(`aformat s16 48k, atempo=1.50000, atrim=10000000us:13000000us`), and a sped
segment with a fade-in is byte-identical to the same chain plus Remotion's
volume expression at the post-tempo trim point — the fltp/s16 round trip and
the concat pin move no sample.

**Finding — a sped clip that OPENS a file shows the ceil frame too, and a
near-tie resolves to the nearest.** Seed `t5-1080p-cut-speed2` (0270 0–15 s,
then 0272 at 2× from source frame 3839 = 127.9667 s to its container end, with
gain 0.5 + a 1 s fade-in + a 1 s fade-out; a music clip on A1 at 3×, gain 0.5),
plain Remotion export `…cut-speed2_2026-09-07T08-23-54.mp4` (32 min from click:
two files mounted), `t1-frame-map --rate=2 --from=450 --source-in=127.96666667`:

| frame | t (source s) | Remotion shows | nearest / ceil |
|---|---|---|---|
| 450 (first frame of the file) | 127.9667 | **K 7671 = ceil** (mean 2.10; 7670 reads 2.31) | 7670 / 7671 |
| 451, 452 | 128.0333, 128.1 | K 7674, 7678 = nearest (every fourth 59.94 fps frame at 2×) | 7674 / 7675, 7678 / 7679 |
| 600 | 137.9667 | K 8270 = nearest | 8270 / 8270 |
| 899 (last; t × 59.94 = 9464.53) | 157.9 | K 9465 = nearest (9464 reads 2.37 against 2.23) | 9465 / 9465 |

So slice 1's rule holds with the time line scaled (`firstFrameCeil` is set by
the same `opensFile && sourceFrame > 0`), and the clip that runs to 0272's
container end (video stream 9,469 frames, last pts 157.958 s) needs no held
tail at 2×: its last slot (157.900 s) is a full source frame before the
stream's end, so the piece counts 450 as planned. The held tail of Stage 2
finding 5 is a rate-1 matter (a slot every 1/30 s reaches within 16.7 ms of
the container end); at any rate ≥ 1 the last slot sits `rate/30` s before the
clip's end, past the 16.5 ms by which the DJI video streams fall short.

**Gate — `t5-1080p-cut-speed` (the T1 cut with clip B at 1.5× from source
15 s, the music clip on A1 2–12 s from source 2 s at 1.5×, gain 0.5),
through the real dialog; the dialog states "Copies 100 % of this timeline".**
The verify-mode reference render was lost to a PC shutdown after the export
itself had finished (the queue marked the job "interrupted when the app
closed"; `studio-t5-1080p-cut-speed_2026-09-07T08-55-06.mp4` is complete:
900 frames, `yuv420p tv bt709 bt709 bt709`, 30.000 s of audio), so the picture
was gated directly against the plain Remotion export of the same project
(`…cut-speed_2026-09-06T20-37-33.mp4` — the same Stage 1 engine verify mode
runs, without sharing the audio pass):

| check | result |
|---|---|
| `t1-frame-map` at 450…456 / 600 / 899 on the pass | **K 899, 902, 905, 908, 911, 914, 917 / 1349 / 2245** (mean 1.36–1.43 against the camera frame) — every third source frame, the SAME K as the Remotion export at every frame (which reads mean 1.99–2.15: the browser path's colour round trip) |
| `t1-diff` vs the plain Remotion export at 1/300/449/450/451/600/899 | mean 2.16–2.51, **max 0.01 % over 24** (300, 450, 899; 0 elsewhere), max 44 — the Stage 2 rows, flat across the cut and along the sped clip |
| `t1-diff` vs control 2 at 1/300/449 (clip A) | **0 % over 24**, mean 1.36–1.71, max 44 |
| `passthrough-video-hash` vs the Stage 2 cut export `…T08-27-39.mp4` | **the first 450 access units byte-identical** (clip A's span); the streams differ from frame 450 on, as they must |
| `t1-audio-offset` vs the plain Remotion export at 0.5/7/13.5/14.5/15.2/16/22/29 s | **0 ms at every window, corr 1.000** (no fade here, so no whole-ms placement offset) |
| `t1-audio-level` vs Remotion, 1 s windows | **1.000 at every window** (0.9997–1.0003; 1.0082 at 22 s, a quiet passage at RMS 0.053 through two AAC encodes) |
| clip B vs the pre-stretched camera reference (`atempo=1.50000` of 0270 at post-tempo 10–25 s, slice 3's `speed-cam-atempo-ref.wav`) at 0.5/3/7/10/14 s | **0 ms, corr 1.000, level 0.9985–0.9997** |
| clip A vs the camera file at 0.5/7/13.5 s (D6) | **0 ms, corr 1.000** |
| `t1-audio-residual` (export − camera vs the pre-stretched music, offset 2 s) at 3/5/7/9/11 s | **lag 0.00 ms, corr 0.984–0.988, level 0.9855–0.9873** of the gained music (the AAC round trip) — and the Remotion export reads the same rows to three decimals |

**Gate — `t5-1080p-cut-speed2` (above: 0270 0–15 s, then 0272 at 2× from
source 127.9667 s to its container end with gain 0.5 + 1 s fade-in + 1 s
fade-out, the music clip at 3× with gain 0.5), through the real dialog; the
dialog states "Copies 100 % of this timeline", the engine note "Copied 100 %
of this timeline (2 of 2 spans). Mixed 2 audio chains in the one pass."**
Against the plain Remotion export of the same project
(`…cut-speed2_2026-09-07T08-23-54.mp4`) and the stretched references:

| check | result |
|---|---|
| file | `studio-t5-1080p-cut-speed2_2026-09-07T11-33-28.mp4`, 900 frames, `yuv420p tv bt709 bt709 bt709`, 31,062,315 B; ~2 min from click |
| `t1-frame-map --rate=2` at 450/451/452/600/899 on the pass | **K 7671 (the ceil, as the browser opens the file here), 7674, 7678, 8270, 9465** — the same K as the Remotion export at every frame; mean 1.46–1.53 against the camera frame (Remotion's 2.10–2.23) |
| `t1-diff` vs the plain Remotion export at 1/300/449/450/451/600/899 | mean 2.16–2.51, **max 0.01 % over 24** (300, 899; 0 elsewhere, 0 at 450 — the ceil frame), max 46 — the Stage 2 rows across two files and a rate |
| `t1-diff` vs control 2 at 1/300/449 (clip A) | **0 % over 24**, mean 1.36–1.71 |
| `t1-audio-offset` vs the plain Remotion export at the eight windows | **0 ms** at 0.5/7/13.5/14.5 s (clip A, the cut), **+0.3 ms (16 samples)** at 15.2/16/22/29 s — clip B's first audible frame is frame 451 = 15.0333 s, off the millisecond grid: Remotion's whole-ms `adelay` (slice 3 finding 2) plays it 16 samples early, the pass keeps the frame time |
| clip B vs the pre-stretched 0272 reference (`atempo=2.00000` at post-tempo 63.983–78.983 s = the clip's own chain) at 1.5/3/7/10/13.5 s | the pass **0 ms, corr 1.000** (0.999 / 0.982 inside the ramps); the Remotion export **−0.3 ms** at every window — the prediction, both ways |
| `t1-audio-level` vs Remotion, 1 s windows | **1.000 at every window** (0.9993–1.0016) |
| `t1-audio-level` vs Remotion INSIDE the ramps, 100 ms windows: fade-in at 15.05/15.283/15.533/15.783/15.95 s, fade-out at 29.0/29.25/29.5/29.75/29.9 s | **0.996–1.005 at all ten windows** — the sped curve's staircase is Remotion's, on the post-tempo time line (0272 is near-silent there: RMS 0.0002–0.0018, and the rows still hold) |
| level of clip B vs the stretched reference | **0.5042–0.5045 on the flat part** on the pass, 0.5034–0.5047 on the Remotion export = 0.505 (the 1/97 rounding of gain 0.5) × the AAC round trip; 0.4465 / 0.4457 at 13.5 s (inside the fade-out) |
| clip A vs the camera file at 0.5/7/13.5 s (D6) | **0 ms, corr 1.000** |
| `t1-audio-residual` (export − camera vs the music at 3× = `atempo=1.73205,atempo=1.73205`, trimmed to the clip) at 3/5/7/9/11 s | **lag 0.00 ms, corr 0.987–0.988, level 0.984–0.988** of the gained music — the Remotion export reads the same rows to three decimals: the square-root chain is Remotion's |

**Stage 2 + slices 1–3 gates re-run on the widened planners — nothing moved
(video AND audio streams byte-identical, and the same byte counts):**

| project | file | vs the earlier export (H.264 / audio sha) | wall |
|---|---|---|---|
| `t5-1080p` | `studio-t5-1080p_2026-09-07T11-36-05.mp4`, 30,289,013 B | **byte-identical** to `…T08-16-28.mp4` (5b327678… / d3434a40…) | 2.2 min |
| `t5-1080p-cut` | `studio-t5-1080p-cut_2026-09-07T11-38-27.mp4`, 30,291,850 B | **byte-identical** to `…T08-27-39.mp4` (5c39f15f… / d3434a40…) | 2.2 min |
| `t5-1080p-cut-gain` | `…cut-gain_2026-09-07T11-40-48.mp4`, 30,279,550 B | **byte-identical** to `…T15-50-36.mp4` (5c39f15f… / dfa537ec…) | 2.2 min |
| `t5-1080p-cut-music` | `…cut-music_2026-09-07T11-43-09.mp4`, 30,299,859 B | **byte-identical** to `…T17-15-09.mp4` (5c39f15f… / e18e0a4b…) | 2.2 min |
| `t5-1080p-cut-stack` | `…cut-stack_2026-09-07T11-45-30.mp4`, 30,291,850 B | **byte-identical** to `…T17-49-06.mp4` (5c39f15f… / d3434a40…) | 2.2 min |
| `t5-1080p-cut-fade` | `…cut-fade_2026-09-07T11-47-51.mp4`, 30,283,517 B | **byte-identical** to `…T22-18-48.mp4` (5c39f15f… / 57261f39…) | 2.2 min |
| `t5-1080p-cut-xfade` | `…cut-xfade_2026-09-07T11-50-12.mp4`, 30,498,448 B | **byte-identical** to `…T21-19-54.mp4` (43c6c82d… / 1f2d5442…), the browser-rendered transition window included | 3.2 min |

So the sped branch of the planner and the pass is reached only by a clip that
has a rate: every earlier document produces the same bytes it did before.

Gates: check:types 26/22 (baseline), vitest **1,425 green** (+6 in the
planner and builder files), live ffmpeg tests 8 (+1: a sped segment against Remotion's
chain run verbatim, with and without a volume curve — byte-identical PCM
both ways). Reports beside the exports, driver logs under
`.vidtsx-temp/bench/stage3/` (`*-slice4*`, `speed-pt*`, `speed2-*`, `*-pt4`),
frame maps under `.vidtsx-temp/bench/t1/frame-map/slice4-*`; seed
`t5-1080p-cut-speed2` and the stretched references
`speed2-cam0272-atempo2-ref.wav` / `speed2-music-atempo3-ref.wav` on disk.
Three lessons: a driver chain must be launched as a script FILE through
`Start-Process bash` (a `-c "sleep …; bash …"` string exited silently, and a
backgrounded Bash tool job is killed at 600 s); `t1-audio-offset --b-offset`
is `candStart = window − offset` (a 15 s clip against a 0 s reference needs
`--b-offset=-15`) while `t1-audio-level --b-offset` has the opposite sign;
and slice 3's `speed-music-atempo-ref.wav` has the 0.5 gain baked in, so the
residual instrument reads it with `--gain=1`.

**Not done, by design:** slow motion (rate < 1 — `select` cannot repeat a
source frame; measure how Remotion duplicates frames first); the long-return
question (does the compositor close an idle file so a return after minutes
becomes an open?); transforms, letterboxed sources, overlays and captions
stay browser spans by construction. **Stage 4** is next: progress that shows
copied vs rendered time, cancel that cleans intermediates, the temp-copy leak
from T5, the CPU-usage setting reaching Studio exports, the 24-minute
finishing mux of a 10 GB file, merging nearby browser spans (a 30-frame
transition window pays a full bundle + Chrome start), QSV/AMF unmeasured.

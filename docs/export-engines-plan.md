# Export engines — the passthrough build as an opt-in engine

> Decided with Hasan 2026-09-04, right after T1 (`docs/PREVIEW_TESTS_PLAN.md`
> §T1) proved the passthrough join inside the WYSIWYG tolerance. Stage 1 (the
> engine seam) is built and gated — see §Stage 1 log at the end; Stages 2–4
> are not. Companion: `docs/studio/PLAN.md` §5 ("smart render"),
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
| **2 — passthrough, narrowest predicate** | single video track, pure cuts, no effects/captions/shots; the span planner decides from the document alone; touched spans still go to the browser and are encoded per condition 2; join per condition 3; "copies N %" in the dialog; the D4 message | T1 gate passes on both reference projects; the 3 h T6 project exports in about an hour instead of days |
| **3 — widen the predicate** | audio tracks, multiple video tracks where lower tracks are fully covered, clips whose only change is a trim; every widening re-runs the gate | each new span type passes the gate before it is enabled |
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

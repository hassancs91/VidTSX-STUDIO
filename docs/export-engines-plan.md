# Export engines — the passthrough build as an opt-in engine

> Decided with Hasan 2026-09-04, right after T1 (`docs/PREVIEW_TESTS_PLAN.md`
> §T1) proved the passthrough join inside the WYSIWYG tolerance. Nothing
> below is built yet. Companion: `docs/studio/PLAN.md` §5 ("smart render"),
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
| **1 — engine seam** | `ExportEngine` interface + registry in main (`src/main/services/studio/export-engines/`), the Remotion path moved behind it untouched, the shared finishing stage (D7) with the audio correction (D6), Settings default + Export dialog picker (D2/D3), verification mode behind a dev flag (D5) | the default engine exports byte-for-byte what it did before, minus the 42.7 ms; the picker exists but lists one engine |
| **2 — passthrough, narrowest predicate** | single video track, pure cuts, no effects/captions/shots; the span planner decides from the document alone; touched spans still go to the browser and are encoded per condition 2; join per condition 3; "copies N %" in the dialog; the D4 message | T1 gate passes on both reference projects; the 3 h T6 project exports in about an hour instead of days |
| **3 — widen the predicate** | audio tracks, multiple video tracks where lower tracks are fully covered, clips whose only change is a trim; every widening re-runs the gate | each new span type passes the gate before it is enabled |
| **4 — polish** | progress that shows copied vs rendered time, cancel that cleans intermediates, the temp-copy leak from T5, the CPU-usage setting reaching Studio exports | tickets closed, `STATUS.md` row |

Open, not blocking: the clap test (D6) on the first Stage 1 build; whether
the fast engine should also become the default once Stage 3 has held for a
release.

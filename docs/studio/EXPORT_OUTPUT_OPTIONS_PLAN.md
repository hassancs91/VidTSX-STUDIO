# Studio export: output options (resolution · quality · source)

> Status: **Phases 1 and 2 DONE 2026-09-12.** Phase 1 (resolution + quality,
> both engines): Full/High byte-identical to the pre-change export through
> BOTH engines, the 720p Fast-vs-Standard frame-diff on `video-10-test`.
> Phase 2 (proxy-source drafts, quality on the Fast engine, measured
> estimate, Settings defaults): byte identity held again, and the 540p draft
> of `video-10-test` exported in **12 min** of frames against ~100 min from the
> originals, 0.04 % over 24 vs its Standard reference (§Phase 1 / §Phase 2
> logs at the bottom). Continues `docs/export-engines-plan.md` (Stage 5
> there). Both export engines — Standard (Remotion) and Fast (passthrough) —
> get the same options. Nothing further planned in this track.

## Why

Exporting `video-10` (4K HEVC 10-bit 60 fps DJI originals, 1080p project)
measured **0.8 frames per second** on 2026-09-12: eight browser tabs mostly
idle, the compositor pinned decoding 4K HEVC. Ten minutes of timeline is
about seven hours. Every video editor lets you export a smaller, lower-quality
file to check the cut; Studio's Export dialog offers only the engine.

Two facts shape the design:

1. **Downscaling alone does not make this footage fast.** A 720p output still
   decodes every 4K source frame; it saves encode time and disk, not the hour.
   What makes a test render fast is reading the **540p H.264 proxies** the
   project already keeps in `cache/proxies/` (decode is the whole cost).
   So the option set is resolution + quality + **source**, not resolution alone.
2. **The plumbing mostly exists.** The TSX render path already has
   `RenderSettingsModal` (Original/4K/1080p/720p/480p, Best/High/Medium/Low →
   CRF). A queue job already carries `scale` and `crf`
   (`src/features/render-queue/types.ts`). `renderComposition`
   (`src/main/services/remotion-renderer.ts`) already downscales through
   Remotion's device scale factor and snaps to even dimensions
   (`src/shared/render-scale.ts` `snapRenderScale`). What is missing is the
   Studio dialog, passing the values into the export engines, and the Fast
   engine's copied spans honouring a scale.

## The dialog

`src/features/studio/components/ExportDialog.tsx` gets an **Output** section
under the engine picker. Identical for full and range exports (same dialog).

| control | values | notes |
|---|---|---|
| **Resolution** | Full (project size) · 720p · 540p · 360p | Presets come from ONE shared helper (moved out of `RenderSettingsModal.tsx` into `src/shared/render-presets.ts`, used by both dialogs). Never larger than the project. Aspect-aware, even dimensions (`makeEven` + `snapRenderScale`). |
| **Quality** | Best · High · Medium · Low | Same CRF table as the TSX modal (15 / 18 / 23 / 28 for h264), moved into the same shared helper. Applies to rendered frames (Remotion `crf`) and the final mux. Copied spans in the Fast engine keep their encoder's constant-quality setting (`COPY_QUALITY` in `passthrough-ffmpeg.ts`); Phase 2 maps the four levels onto it. |
| **Source** | Originals · Proxies (draft) | Offered only when every video asset on the timeline has `proxy.status === 'ready'`. Defaults ON when resolution ≤ 540p, OFF otherwise — explicit toggle, auto default. Labelled "draft" in the queue row and the filename suffix (`_720p-draft`). |
| **Heavy-footage notice** | banner + estimate | Shown when any timeline asset probes as ≥ 2160 lines, HEVC 10-bit (`pix_fmt` 10le), or ≥ 50 fps. Phase 1 estimates from a static per-class table; Phase 2 uses the last measured rate for this project from the queue history. |
| **Defaults** | per project + app default | The dialog remembers the last choice per project (`project.settings.export`). Settings › Rendering gains default resolution + quality beside the existing default engine (`exportEngine` in `src/shared/ipc/types/settings.ts`). |

Behaviour rules:

- The composition keeps the **project's dimensions**; only the output is
  scaled (`scale` = target height / project height). Shots lay out identically
  at any size — exactly how the TSX path already works. Never re-lay-out.
- The audio pass reads the **originals in every mode** (cheap; drafts stay
  audibly identical to finals).
- "Full · Best · Originals" must produce byte-for-byte what today's export
  produces (`scale` 1, today's CRF, same resolver) — the gate for Phase 1.

## Plumbing (both engines)

1. **Choice → job.** `ExportChoice` (ExportDialog.tsx) grows `scale`, `crf`,
   `source: 'original' | 'proxy'`. `EditorShell.handleExport` puts `scale` and
   `crf` on the queue job (fields exist) and passes `source` to
   `studioExportPrepare`.
2. **Prepare.** `createExportEntry` (`src/main/services/studio/export-entry.ts`)
   takes `source`; its URL resolver serves `cache/proxies/<assetId>.mp4` when
   asked and the proxy is ready, per asset, else the original. The entry's
   `compositionConfig` stays at project size. IPC types in
   `src/shared/ipc/types/studio.ts`; handler in
   `src/main/ipc/registrations/studio.ts`.
3. **Run.** `render-handlers.ts` already forwards `crf`; add `scale` to
   `ExportRenderSettings` (`export-engines/types.ts`) and pass it through
   `runStudioExport` (`run-export.ts`).
4. **Standard engine** (`remotion-engine.ts`): pass `scale` to
   `renderComposition` — it already snaps and downscales.
5. **Fast engine**:
   - browser spans (`passthrough-browser.ts` → same `renderComposition`): pass
     `scale`, same as above;
   - copied spans (`passthrough-ffmpeg.ts` `copySpanArgs`): a copied span is
     already a decode → colour-tag (`colorParamsFilter`) → encode pass, not a
     stream copy, so add `scale=W:H` (flags `lanczos`) before the colour filter.
     Black spans (`blackSpanArgs`) and hold-last-frame spans
     (`holdLastFrameArgs`) take the same W×H;
   - proxy source: copied spans read the proxy file (960×540, same 60000/1001
     frame rate as the originals, so `nearestSelectFilter` / `seekSeconds`
     math is unchanged) and scale to the output;
   - one shared function computes the output W×H for both engines so the
     frame-diff verification (`verify.ts`, dev-only) compares like with like.
6. **Finishing** (`finishing.ts` `finishExport`): unchanged mechanics; the mux
   probes the video stream, so dimensions follow automatically. Filename gets
   the resolution/draft suffix in `handleExport`.
7. **Queue row** (`RenderItem.tsx` / `RenderItemDetails.tsx`): show
   "720p · draft" badges; the row already shows a resolution label
   (`queue-manager.ts` formats 1080p/720p/4K).

## Phases

**Phase 1 — resolution + quality, both engines (~1 day)**
- `src/shared/render-presets.ts`: presets + CRF table extracted from
  `RenderSettingsModal.tsx`; the TSX modal switches to it (no behaviour change).
- Output section in `ExportDialog.tsx` (Resolution, Quality, heavy-footage
  notice with the static estimate). Per-project memory of the last choice.
- `scale` through `ExportChoice` → job → `ExportRenderSettings` → both engines;
  scale filter in copied/black/hold spans; shared output-dims function.
- Tests: `passthrough-ffmpeg.test.ts` (args with a scale), the shared dims
  function, presets helper; one Fast-vs-Standard gate at 720p on
  `video-10-test` (frame-diff), plus the byte-identity check for Full/Best.

**Phase 2 — proxy source + measured estimate (~1 day)**
- `source` through prepare → resolver; availability rule (all proxies ready);
  auto-default at ≤ 540p; draft labelling in queue + filename.
- Quality levels mapped onto the copied-span encoder's constant-quality value.
- Measured-rate estimate from the last export of the same project in the
  queue history; static table stays as the fallback.
- Settings › Rendering defaults for resolution + quality.

## Decisions taken (2026-09-12, with Hasan)

- Source is an explicit toggle with an automatic default (on at ≤ 540p).
- Defaults live in Settings › Rendering AND per project (last used wins).
- No upscaling: presets never exceed the project size (same rule as the TSX modal).
- The Fast engine is greyed out on a machine until the GPU encoder download
  (Settings › Rendering › "Faster proxy generation (GPU encoder)" › Download) is
  installed — that is why it showed disabled on 2026-09-12; unrelated to this work.

## Test project

`~/Videos/VidTSX Studio/projects/video-10-test` — blocks 0–2 of video-10
(163.6 s, 4909 frames, 12 shots, 2 4K HEVC sources with ready proxies). Built
for exactly this kind of test; a full export of it at 1080p from originals
takes ~105 min on the dev laptop, so the 720p-proxy draft is the number to
beat and to report.

## Phase 1 log — DONE 2026-09-12

What was built, where, and two things the plan had wrong.

- **Shared presets** — `src/shared/render-presets.ts` (+ test): `resolutionOptions(w, h, presets, fullLabel)`
  (aspect-aware, `snapRenderScale`-snapped even dims, never at or above the composition),
  `TSX_RESOLUTION_PRESETS` (4K/1080p/720p/480p) and `EXPORT_RESOLUTION_PRESETS` (720p/540p/360p),
  `RENDER_QUALITY_OPTIONS` + `renderCrf(quality, codec)` (15/18/23/28 for h264; the VP9/WebP/GIF
  branches the modal had), `DEFAULT_RENDER_QUALITY = 'high'`. `src/shared/components/RenderSettingsModal.tsx`
  now reads all of it (116 lines of local copies removed; behaviour unchanged — the 480p-from-1080p →
  864×486 snap is pinned in the test). `src/features/workspace/components/RenderSettingsModal.tsx` is
  an unreferenced older copy (WorkspaceScreen imports the shared one) — left alone.
- **One output-size rule** — `resolveRenderScale` in `src/shared/render-scale.ts`: scale 1 is the
  identity; else the snapped scale; else the rounded-even materialized dims at scale 1 with
  `materialized: true`. `remotion-renderer.ts` now calls it (the same three branches it had inline);
  `export-engines/output-size.ts` (`exportOutputSize(entry, render)`) is what the passthrough engine
  (copied + black spans) and `verify.ts` (pixel count, stills) read, so the browser span, the copied
  span and the reference export land on the same W×H.
- **Plumbing** — `ExportChoice` carries `resolution`, `quality`, `scale`, `crf`;
  `EditorShell.handleExport` puts `scale`/`crf` on the queue job (the row's resolution label already
  applies `job.scale`), names a scaled file `<project>_720p.mp4`, and remembers the choice in
  `project.settings.export` (`StudioProjectSettings.export`, strings; unknown values fall back).
  The agent's export action passes no options → project size, default quality — today's export.
  `ExportRenderSettings.scale` (`export-engines/types.ts`) ← `render-handlers.ts` ← the job; the
  Remotion engine and the passthrough browser span pass it to `renderComposition`.
- **Dialog** — `ExportDialog.tsx` + `ExportOutputSection.tsx` (Resolution · Quality selects, the
  hint line, the heavy-footage notice). `services/export-estimate.ts` (+ test): `heavyFootageOf`
  (timeline video assets probing ≥ 2160 lines, HEVC, or ≥ 50 fps — the probe has no `pix_fmt`, so
  10-bit is not detected), the static estimate (0.8 browser fps measured 2026-09-12, copied spans at
  3.9× realtime — T1) and `formatEstimate`. `data-export-resolution` / `data-export-quality` /
  `data-export-heavy` for drivers.
- **Two corrections to the plan above.** (1) "Full · **Best** · Originals is byte-identical to today":
  today's export carries no CRF, so Remotion encodes at its default **18 = the table's High**. The
  dialog therefore starts on **High** and the byte-identity gate is **Full · High**; Best (15) is a
  new, larger option. (2) "add `scale=W:H` before the colour filter" in `copySpanArgs`: a copied span
  already ends in a scale (`scale_cuda` on NVENC, `scale` on QSV/AMF — the 4K → 1080p path); only the
  W×H it is given changed. No filter was added, no flags changed, so the Full path is the same string
  to the byte (pinned in `passthrough-ffmpeg.test.ts`).
- **Fast engine on this laptop.** The GPU-encoder ffmpeg (80 MB, BtbN n8.1.2) had never been
  installed here (the export-engines work ran on the other machine); installed 2026-09-12 through the
  app's own `studioProxyEncoderInstall`, NVENC detected (RTX A3000; QSV listed too). The picker's
  Fast row is enabled since.
- **Quality on the Fast engine in Phase 1**: the CRF reaches only frames Remotion encodes — the
  Standard engine's whole file. The Fast engine re-encodes every piece with the copied spans'
  constant-quality 23 (`COPY_QUALITY`), so its Quality pick changes nothing yet; Phase 2 maps the
  four levels onto it (as planned).

**Gates (2026-09-12, dev app restarted on the new code, `video-10-test` range 40.6–46.1 s = 165
frames, 4K HEVC 60 fps originals, two plain-cut clips + one shot span):**

| gate | result |
|---|---|
| `check:types` | web 26 / node 10 — both at baseline |
| vitest | **2400 passed, 22 skipped** (274 files) — new: render-presets 8, export-estimate 6, output-size 3, resolveRenderScale 3, scaled-span args 3 |
| **Full · High byte identity, Standard** | baseline exported on the OLD main process (6,704,456 bytes, 209 s) vs the new code with `scale 1, crf 18` as the dialog sends: **`cmp` identical** |
| **Full · High byte identity, Fast** | baseline (6,058,147 bytes) vs new: **`cmp` identical** |
| **720p Fast vs Standard (range, D5 verify)** | Fast at `scale 720/1080` with `verifyAgainstEngine: remotion`: **both files 1280×720 yuv420p tv bt709, 165 frames**; copied 96 % (3 of 4 spans); **max 0.01 % of pixels over 24 at the 10 sampled frames** (1, 55, 77–79, 110, 154–156, 164), max mean 2.74/255 — the same reading the 1080p gates give; **audio 0 ms vs the reference** at 0.5/2/4 s (corr 1.000), 1.6 ms vs the camera file at the clip's two windows. 350 s from click to verified (Fast pieces + the Standard reference + the diff). **First run failed the gate**: "frame buffers too short … for 921600 pixels" — the reference was 852×480 because the `resolveRenderScale` refactor had handed the snapped output dims to `renderMedia`'s composition override AND kept the scale (double downscale; the TSX render path's 720p preset would have suffered the same). Fixed to the pre-refactor rule (composition dims stay unless materialized) and re-run: the result above |
| **720p Fast vs Standard (full project, the real dialog)** | Driven through the real dialog (`export-dialog.mjs`: Fast row, `720p (1280×720)`, High, verify → Standard, confirm) — the job carried exactly that; at full length this timeline copies 0 % (every span is under a shot), so the run was every frame through the browser twice (≈ 2.5 h). **Cancelled by Hasan at 5 % (244/4909 frames, "about 1 h 10 min left")** — the range row above is the recorded gate; the full-length number belongs to Phase 2, where the proxy source is what changes it |

Drivers: session scratchpad `export-range.mjs` (the IPC path the dialog uses — `studioExportPrepare`
+ `renderStart` with `exportEngine`/`scale`/`crf`/`verifyAgainstEngine`), `export-dialog.mjs` (the real
dialog: engine row, `data-export-resolution`, `data-export-quality`, the verify checkbox, confirm),
`dialog-shot.mjs` (screenshot). Baseline files under the scratchpad's `exports/`.

## Phase 2 log — 2026-09-12

- **Source** — `src/shared/studio/export-source.ts` (+ test): `ExportSource = 'original' | 'proxy'`,
  `proxySourceAvailability(project)` (every video asset a timeline video clip plays has
  `proxy.status === 'ready'`; the missing ones by file name for the dialog's note),
  `defaultExportSource(w, h, available)` (proxy at an output short side ≤ 540, else original),
  `exportFileSuffix(resolution, source)` → `_720p`, `_540p-draft`, `_draft`, or nothing.
- **Prepare → entry** — `StudioExportPrepareRequest.source`; `createExportEntry(…, videoSource)`
  builds `sourcePaths[assetId] = <project>/cache/proxies/<assetId>.mp4` for every ready proxy when
  asked for a draft and points the entry's asset URLs at those files (per asset: proxy when ready, else
  the original). `StudioExportEntry.source` / `.sourcePaths` ride the export context to the engines.
  The composition keeps the project size; a proxy frame is upscaled by the browser exactly as the
  preview shows it.
- **Fast engine** — copied spans read `entry.sourcePaths[assetId] ?? span.assetPath`
  (`copySourcePath`), probed by that path (the proxy's own frame rate feeds the select — same
  60000/1001 as the DJI originals, so the maths is unchanged); the browser spans decode the same
  files through the entry. The audio pass keeps `planExportAudio`'s original paths in every mode.
- **Quality on the Fast engine** — `copyQualityForCrf(crf, encoder)` = CRF + 5 clamped to 1–51, so
  High (18) → the measured 23 (the same argument string as before the option; pinned) and
  Best/Medium/Low → 20/28/33. `spanEncoderArgs(encoder, quality)`; every piece kind (copy, black,
  browser re-encode, hold-last-frame) takes the one value.
- **Dialog** — `ExportOutputSection`: a "Draft from the preview proxies" checkbox when available
  (a note naming the clips without a proxy otherwise); auto default from the resolution until the
  user touches it; the notice's second line changes for a draft. `ExportChoice.source`;
  `EditorShell.handleExport` passes it to prepare, stamps `exportSource` on the queue job (the row
  shows a `draft` badge — `RenderItem.tsx`), names the file with the suffix, and remembers
  `settings.export.source` beside resolution + quality.
- **Estimate** — `measuredExportRate(jobs, compositionId, engine, source)` in `export-estimate.ts`:
  the newest finished queue job of the same project + engine + source (≥ 30 frames) gives
  seconds per frame; the dialog reads the render queue's in-memory `jobs` (never `renderQueueLoad`,
  which rewrites live rows) and words it "Last export of this project at these settings ran at N fps —
  about M min for this one." The static table stays the fallback for originals; a first draft says it
  will record its rate.
- **NVENC and 8-bit sources** — found by the draft gate (its row below): the copied-span graph asked
  `scale_cuda` for `format=yuv420p` on a source that is already nv12 at the output size and NVENC
  emitted nothing for a 3-frame span. `SourceProbe.pixelFormat` (ffprobe `pix_fmt`) now decides:
  8-bit 4:2:0 sources get no format conversion on the NVENC path; 10-bit sources keep the measured
  string. `countPackets` reads a packet-less piece as 0 (→ the browser), never a crash.
- **Queue DB** — `export_source` and `started_at` columns (`ensureColumn`), so the draft badge and
  the measured rate survive a restart.
- **Settings › Rendering** — "Default Studio export output" row (`ExportOutputDefaultRow.tsx`):
  resolution preset + quality, `renderDefaultExportResolution` / `renderDefaultExportQuality` in
  the settings store (normalized; `SETTINGS_SET_RENDER_DEFAULT_EXPORT_OUTPUT`), read by the dialog
  when the project has no remembered choice. Source has no app default — it is the automatic rule.

**Gates (2026-09-12, dev app restarted on the Phase 2 code):**

| gate | result |
|---|---|
| `check:types` | web 26 / node 10 — both at baseline |
| vitest | **2409 passed, 22 skipped** (275 files; export-source 7, measured rate 2, quality rows 2, the 8-bit NVENC row 1 new). Under load (a render + the app booting) five 5 s timeouts in `project-package-import.test.ts` / `flow-render.test.ts` — they pass alone and in the final quiet run |
| **Full · High · Originals byte identity, both engines** (range 40.6–46.1 s) | against the SAME baselines exported on the pre-Phase-1 main process: Standard **`cmp` identical** (6,704,456 B, 259 s), Fast **`cmp` identical** (6,058,147 B, 122 s) — the quality mapping (High → 23) and the source resolver (originals when no draft is asked) change nothing on the default path |
| **540p draft of `video-10-test` through Fast, the real dialog, verified against Standard at the same size** | Driven through the real dialog: Fast row, `540p (960×540)`, High, the draft toggle **on by itself** (the ≤ 540p rule), verify → Standard, confirm; the entry's asset URLs and `sourcePaths` point at both `cache/proxies/<id>.mp4` files, composition 1920×1080, 4909 frames; the queue row `video-10 test · blocks 0–2_540p-draft.mp4`, `scale 0.5`, `crf 18`. **First run failed**: "ffprobe exited with code 1: span-0003.ts: End of file" — the 3-frame copied span `copy:1373+3` came out with headers and no packet. Reproduced by hand with the span's exact arguments: from the ORIGINAL 3 packets, from the PROXY none; NVDEC decodes the proxy fine after the seek (showinfo through `hwdownload`), the select passes the right three frames, the CPU path encodes them, a real downscale (640×360) encodes them, `format=nv12` or no format encodes them — only `scale_cuda=w=960:h=540:format=yuv420p` (the same size, nv12 → yuv420p on the card, `passthrough=0` too) hands NVENC frames it never emits from, for 3 frames; with 20 frames requested it emits 20. **Fix**: `copySpanArgs` omits scale_cuda's `format=yuv420p` for an 8-bit 4:2:0 source (`SourceProbe.pixelFormat` from ffprobe's `pix_fmt`, `isEightBit420`) — NVENC takes nv12 and the stream reads `yuv420p` either way; the 10-bit camera path keeps its exact string (pinned). And `countPackets` reads a packet-less piece as 0 so such a span goes to the browser instead of killing the export. **Second run: passed** — Fast draft **12 min 0 s of frames** (`framesMs` 718,126 for 4909 frames ≈ 6.8 fps; copied 10 %, 14 of 22 spans; audio pass beside the pieces; mux 0.5 s) against ~100 min for the same timeline from the originals; the Standard reference from the same proxies 11 min 40 s; **both files 960×540 yuv420p, 4909 frames; 22 sampled frames, max 0.04 % of pixels over 24 (frame 1636), max mean 1.89/255; audio 0 ms vs the reference at 0.5 / 81.1 / 162.1 s (corr 1.000)**; 33.0 MB. Files: `~/Videos/VidTSX/studio-video-10-test_2026-09-12T14-11-04.mp4` + `.verify-remotion.mp4` + `.verify.json`. The measured rate is on the queue row for the next estimate (`export_source` + `started_at` are persisted in the queue DB since — `ensureColumn`) |

## Kick-off prompt (Phase 2, new session)

```
Read docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md (Phase 1 is done — read its log) and implement Phase 2: the Source toggle (originals / proxies) through studioExportPrepare → the entry's URL resolver, the availability rule (every timeline video asset's proxy ready) and the auto default at ≤ 540p, the draft label in the queue row + filename suffix; map the four quality levels onto the Fast engine's copied-span constant-quality value; the measured-rate estimate from the queue history; Settings › Rendering defaults for resolution + quality. Gate: Full/High/Originals stays byte-identical through both engines; a 540p-proxy draft of video-10-test through Fast, timed, frame-diffed against its Standard export at the same size. Update the plan's status line and Status.md when done.
```

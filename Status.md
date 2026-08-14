# STATUS.md — Current progress

> Claude: update this file after completing each phase.

## Current phase: 6 — Template store + media library
## Status: NOT STARTED

---

## Completed phases

### Studio — S4 TSX SHOTS: DESIGN REVIEW OPEN (2026-08-14)
**Status: DESIGN WRITTEN, AWAITING HASAN'S REVIEW — no implementation.**
`docs/studio/TSX_SHOTS_DESIGN.md` (same pattern as TRANSITIONS_DESIGN.md):
decisions D1–D10 with options + recommendations and an inline-answerable
checklist. Core recommendations: `shots[]` registry in the document with
clips referencing `shotId` (replaces the `filePath` stub — safe, no tsx clips
shipped); cutaways cover from an upper lane (never displace the master);
title = word-synced overlay skill category; preview via live in-renderer ESM
modules sharing the app's React/Remotion (error-boundary containment); export
via static shot imports in the generated entry (react+remotion import
allowlist, pre-flight validation); baked shot-local word timings + recorded
anchor for regenerate re-sync; generate-then-propose `shot-plan` proposals
through the existing audit gate; per-shot `activeVersion` for edit/regenerate
round-trips. One implementation spike flagged: confirm the bundler's TSX rule
compiles files outside the app path before locking the entry shape.
Implementation starts after review.

### Studio — post-gate POLISH MINI-SESSION (2026-08-14)
**Status: COMPLETE — the three papercuts the stability gate surfaced are fixed
and CDP-verified live; §15 performance spot-checks run on Hasan's real DJI
session concatenated to one 27.4-min 4K/60 HEVC file. Gates: 374 tests green,
type baselines held at 26 web / 22 node. S4 is next.**

1. **Render-start freeze fixed**: `@remotion/bundler`'s webpack compile now
   runs in an Electron utilityProcess (`src/main/services/bundle-worker.ts`,
   new electron-vite main entry) — it was blocking the main-process event loop
   for seconds (and calls process.chdir, so worker_threads couldn't host it).
   Progress/errors stream back over the port; dev CLI fallback kept. New
   `RenderPrepChip` in the Studio toolbar shows "Preparing render… n%" from
   queue-add until frames start. CDP-verified: chip within 1 s of clicking
   Export, IPC round-trips 2–60 ms through the entire bundle+prep.
2. **Proxy progress**: ffmpeg `-progress pipe:1` + total duration parsed from
   ffmpeg's own stderr banner → whole-percent events through the existing
   StudioMediaJobEvent channel (transcript pattern) → "Proxy n%" chip + 2 px
   bar on the pool card. Ticks stay in transient renderer state; the document
   only sees status changes. Verified climbing live on the 27-min import.
3. **Cache visibility**: per-project cache footer on the browser card — size
   readout, Open in Explorer, two-step Clear (`cache-manager.ts` + 3 IPC
   channels). Clear aborts the project's running media jobs first (Windows
   file-lock), restores the scaffold; browser-only placement so a clear can't
   hit an open editor. Sizes matched disk byte-for-byte.

§15 verdicts (recorded in TESTING.md): transcript 27.4 min → ready in ~75 s
(AssemblyAI, 2,258 words) — very acceptable; timeline responsive under two
concurrent ffmpeg jobs (drag rAF median 34.8 ms, playback 16.7 ms); editor
idle CPU 0.00 s over 10 s; proxy on 4K/60 HEVC WITHOUT NVENC projected
multi-hour — new backlog item: hardware DECODE (d3d11va/qsv) for proxy inputs.
§15 agent-pass item still open (transcript only 2,258 words, under the 5k
threshold).

### Studio — STABILITY GATE PASSED (2026-08-13)
**Status: COMPLETE — Hasan's guided manual pass over every remaining human item
in docs/studio/TESTING.md, including the §13 S3 exit test on real multi-take
DJI footage: auto-cut (37 proposed) + editorial pass both applied → 26 clips,
every join flush to 1e-6 s, export v 68.9333 s / a 68.9920 s (delta = AAC frame
padding, not drift), A/V sync clean by ear at the last cut (1:03.4). S4 opens
after a short polish mini-session.**

Verified by ear/eye this session: §10.4 auditions (all clean) · §8 complete
(AssemblyAI real recording, whisper download + offline, re-transcribe
round-trip, wrong-key error) · §9.2 plan honesty on real footage · §11.1
editorial pass + chat memory + plain question + stop button + second-pass
refusal · §14.1/14.2 network kills · §7.3 decided (park at end).

Fixed/built during the gate (all test+type gated):
- **slam-1 retirement**: AssemblyAI removed the model; catalog now Universal
  (auto → universal-3-5-pro + universal-2) with pinned entries and a legacy
  alias; provider special-cases dropped; 401/403 now reads "AssemblyAI rejected
  the API key — check your AssemblyAI key in Settings."
- **Transcript UX**: Engine picker stays visible when Ready; new Reset button
  (blocked while a review is open).
- **Editorial Pass button** (Inspector → Assistant handoff): one-click entry
  into the agent with full chat transparency; disabled without a transcript /
  during review / while busy.
- **Context warning**: Assistant estimates next-turn context (transcripts +
  chat vs a conservative 128k budget) and banners at ≥40% pointing at the
  existing ↺ Clear.
- **Black-flash fix**: `premountFor` on clip Sequences — joins are seamless in
  preview (export was never affected).
- **Playhead parks at end** after playback (`moveToBeginningWhenEnded={false}`).

Deferred with reasons (in TESTING.md): §11 Local-Models refusal (no local
model installed), §13.5 GIF/WebP (N/A — Studio export is hard-coded h264/mp4),
§15 long-file perf (tail of the polish session). Backlog logged: render-start
freeze, proxy progress bar, cache visibility UI, Studio format picker, agent
timeline-read tool, optional persistent chat.
**Status: COMPLETE — 22 machine-checkable items from §1–§14 driven live via
CDP, ZERO app bugs found; matching items annotated ✎ in TESTING.md so Hasan's
manual gate shrinks to the genuinely human checks (ears at joins, real
multi-take footage, the §13 S3 exit export, network-failure paths)**

Run on throwaway seeded projects (deleted after); `autocut-test` exercised for
the Auto Cut → Reject-all round-trip and restored byte-identical.

- Verified: neighbour clamp flush-stop · edge-trim bounds incl. the 0.04 s
  floor · split contiguity · an 11-op mixed chain (split/trim/move/paste/
  marker/ripple-delete/duplicate) undone to an identical timeline · lock
  blocks drag/trim/delete/paste · Hide drops picture / Mute silences the lane
  live · frame/second arrow steps, Home/End (End parks on the last frame) ·
  zoom anchored on the playhead (0 px drift) · Space guard in inputs · snap
  toggle on/off · gap playback (black + audio continues) and clean
  end-of-timeline stop · Auto Cut → review → Reject all → timeline untouched ·
  no selection/marker bleed across project switches · remove-asset-with-clips
  undo is orphan-safe · autosave force-quit loses only the debounce window,
  JSON intact · history cap: 130 ops → exactly the last 100 undo · corrupt
  project.json skipped by the browser · full relaunch identity · cache-wipe
  regeneration · project create + two-step delete to the Recycle Bin.
- One behavior observation (not a bug): after playing past the end, the
  playhead parks back at 0 — Remotion's `moveToBeginningWhenEnded` default.
  Flagged in §7.3 for Hasan; set the prop to false if end-parking is wanted.
- Two automation gotchas recorded in docs/ui-automation-cdp.md: a MINIMIZED
  window freezes rAF and `Page.bringToFront` won't restore it (use user32
  SW_RESTORE first), and Remotion's pooled shared `<audio>` tags mean
  audibility must be asserted via `paused`, not tag counts/volume.
- No source changes — docs only.

### Studio — core-parity Session 6: Slice F (media relink) (2026-08-13)
**Status: COMPLETE — live CDP verification across three app launches (TESTING.md
§16.8 ticked); no schema changes (consumes the `hash` media-import has written
since S2); core-parity plan FINISHED → next is Hasan's full TESTING.md pass,
then S4**

Sixth and final session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **Missing detection.** `studioMediaPrepare` now `fs.access`es every
  asset path; unreachable ones come back in a new `missing: string[]` and
  their proxy/waveform jobs are skipped (ffmpeg would only fail). The renderer
  keeps missing-ness as environmental state in `useStudioMedia` — deliberately
  NOT in the document (it describes this machine, not the project).
- [x] **UI.** Missing pool cards get a red border + "Missing" overlay with a
  visible "Locate…" button; timeline clips whose asset is missing render a red
  warning tint + border with a "source file missing" tooltip
  (EditorShell → TimelinePanel → TimelineLanes → TimelineClip threading).
- [x] **Relink IPC.** New `STUDIO_MEDIA_RELINK` following the full
  channels/types/handler/registration/preload/electron.d.ts pattern (the last
  one by hand — new channel). Main opens the native picker (or takes
  `filePath` — the mismatch-retry, and `VIDTSX_RELINK_PICK` env stands in for
  the dialog in automated runs, documented in docs/ui-automation-cdp.md),
  verifies the pick's first-1MiB+size sha1 against the stored `asset.hash`,
  re-probes on success, and returns `{ path, probe, hash }` for the renderer
  to merge. Hash mismatch → renderer-built confirm card (CDP-able, like every
  dialog in this app): Cancel or "Use anyway" (override re-probes and rewrites
  the hash so the NEXT relink checks against reality).
- [x] **Cache survival.** Proxies/waveforms/transcripts are keyed by asset id,
  so they ride through untouched; the prepare effect keys on `id:path` so a
  relink re-runs detection and only regenerates what's absent.
- Live CDP (throwaway "relink-test" project + fixture copies, deleted after):
  launch 1 generated caches; launch 2 (file renamed away) showed the full
  missing UI with jobs skipped, a wrong-content pick raised the mismatch card
  (Cancel inert; override merged with re-probe 40.07 s → 2.07 s + new hash);
  launch 3 relinked the true moved file instantly — no prompt, stored hash
  verified equal, proxy mtime unchanged (no regeneration), waveform still
  drawn, document path updated and autosaved.

### Studio — core-parity Session 5: Slice E (transitions: crossfade · dip-to-black) (2026-08-13)
**Status: COMPLETE — design doc first (docs/studio/TRANSITIONS_DESIGN.md), then
unit-tested (17 new tests, 374 total) + live CDP click-through incl. a real
export; schema addition: optional `transitionOut` on StudioClip (no version
bump, old projects open untouched)**

Fifth session of `docs/studio/CORE_PARITY_PLAN.md` — the model-risk slice, so
the design was written down before the code (review it in TRANSITIONS_DESIGN.md).

- [x] **Model.** `transitionOut?: { kind: 'crossfade'|'dip-to-black', duration }`
  on the LEADING clip; valid only while the next clip on the track starts
  exactly at its end (1e-6 s). The document never stores an overlap.
- [x] **Invariant enforcement — reducer-level prune.** The ops do NOT all
  funnel through `withTrackClips` (group ops + applyCutProposal build tracks
  inline), so validity is enforced once in `useTimeline`'s commit path:
  `pruneTransitions` drops any transition whose boundary an edit just broke,
  in the SAME undo step, preserving identity-on-reject. Every current and
  future op inherits it. `splitClip` is the one case prune can't see (halves
  stay contiguous) — it moves the field to the right half explicitly, like the
  fade stripping. Ripple deletes that land clips flush KEEP the transition
  (that's what a ripple means); serialize re-checks contiguity itself because
  loaded documents never passed through the reducer.
- [x] **Render.** `serializeTimeline` builds the overlap: crossfades extend the
  leading clip `duration/2` past the cut and start the trailing one early,
  each side clamped to its source handles (`trimBefore` shifts by
  `ext × playbackRate`; images/tsx unlimited; zero handles both sides → hard
  cut). New `transitionIn/Out { kind, frames }` on SerializedClip;
  `TimelineComposition` draws the ramps — trailing clip opacity 0→1 (it paints
  on top; DOM order = track order), equal-power audio (cos/sin) for
  crossfades, linear to silence for dips — composed with gain × fades in
  `volumeProp`. Dip needs no extension: opacity+volume V to zero at the cut.
- [x] **Ops + reducer.** `transition-ops.ts`: `setTransition` (rejects on
  gap/locked/unknown; clamps duration to both clips), `removeTransition`,
  `pruneTransitions`. Actions `transition-set`/`transition-remove`, one undo
  step each (preset re-pick = replace in place = one step).
- [x] **UI.** `TransitionJoins`: a small square at every contiguous boundary on
  unlocked tracks (accent-filled when set, tooltip shows kind + duration);
  click opens a `FloatingMenu` with Crossfade/Dip × 0.5 s/1 s presets +
  Remove. Numeric duration editing deferred (v2, Inspector).
- Live CDP run (seeded throwaway "transition-test", deleted after): preview at
  the crossfade cut read opacity 0.5 / volumes 0.707+0.707 and the dip cut
  0/0; export (420 frames exactly — transitions never change length) showed a
  half-transparent incoming picture at the cut and a pure-black dip frame; dip
  audio >90 % attenuated inside the ramps; split handed the dip to the right
  half; Backspace-delete pruned + single-undo restored; ripple-delete kept the
  crossfade on the collapsed join.

### Studio — core-parity Session 4: Slice D (markers + range export) (2026-08-13)
**Status: COMPLETE — unit-tested (20 new tests, 357 total) + live CDP click-through
incl. a real frame-accurate range export (TESTING.md §16.6 markers line + §16.7 ticked);
schema addition: optional `markers` on StudioTimeline (no version bump, old
projects open untouched)**

Fourth session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **D1 pure ops.** New `services/marker-ops.ts` (timeline-ops stays at 285
  lines): `addMarker`/`moveMarker`/`removeMarker`/`renameMarker`, all
  identity-on-reject, times clamped ≥ 0, list kept sorted by time, and a
  timeline with zero markers has NO `markers` key so old documents round-trip
  byte-identical. Reducer actions `marker-add/-move/-remove/-rename`, one undo
  step each (add ids minted by the caller, like paste).
- [x] **D1 UI.** M drops a marker at the playhead (text-entry + visibility
  guards respected); `RulerMarkers` draws diamonds on the `TimelineRuler` —
  click = seek, drag = move (3 px threshold, commit on release = one undo
  step), double-click = inline rename popover, right-click = FloatingMenu with
  Rename/Delete. Labels render next to the diamond. Markers persist through
  autosave and were verified across a renderer relaunch.
- [x] **D2 range state.** I/O keys set `rangeIn`/`rangeOut` at the playhead
  (Shift+I/O clears the point) — component state in `EditorShell`, session-only,
  never in the document. Ruler shows the highlighted span between the points
  (a lone point draws a bracket); "Export range" appears in the toolbar only
  when the points span ≥ 1 frame.
- [x] **D2 range export.** `studioExportPrepare` request grew optional
  `rangeIn`/`rangeOut` seconds (electron.d.ts needed no manual change — it
  references the shared type via `import()`). Main trims the document with the
  new shared `trim-range.ts` (`trimTimelineToRange`): edges snapped to the
  frame grid FIRST (cumulative-rounding rule), clips cut like a split
  (head cut advances `sourceIn` + drops fade-in, tail cut drops fade-out),
  markers filtered+shifted — then serializes the result, so `serializeTimeline`
  stays the single source of truth. The render length is exactly
  `frame(out) − frame(in)` (`rangeDurationInFrames` override on
  `createExportEntry`), so a window past the last clip renders trailing
  black/silence like every NLE.
- Live CDP run (seeded throwaway "range-test" project, deleted after): all
  marker gestures + undo steps verified in the DOM; range span at exact px;
  real export → ffprobe 5.033333 s / 151 frames == frame(7.533) − frame(2.5)
  exactly; audio envelope corr 0.871 vs the matching source span (−0.62 vs a
  control span); boundary frames matched the source.
- Note: a stale parallel-session buffer had pre-written the same handler edit
  and left a duplicate import in `studio-handlers.ts` mid-session — reconciled
  by re-reading everything from disk before the gates.

### Studio — core-parity Session 3: Slice C (audio fades + detach audio) (2026-08-12)
**Status: COMPLETE — unit-tested (8 new tests, 337 total) + live CDP click-through
incl. a real export (TESTING.md §16.2 fully ticked + §16.4 completed);
schema addition: optional `fadeInSec`/`fadeOutSec` on StudioClip (no version
bump, old projects open untouched)**

Third session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **C2 spike first (as planned).** Remotion `<Audio src={videoFile.mp4}>`
  plays a video's audio track in preview AND in renderMedia — proved with a
  seeded throwaway project whose audio clip pointed at the video asset with a
  DIFFERENT source span than the muted video clip: the export's envelope
  correlated 0.879 with the audio clip's span and 0.25 with the video's.
  Decision: no ffmpeg audio-extract cache needed; detach reuses the asset.
- [x] **C1 fades.** `fadeInSec`/`fadeOutSec` (timeline seconds) with one
  invariant — both ≥ 0, sum ≤ duration, fade-in wins — enforced by
  `clampFades` in timeline-ops and re-applied by every duration-changing op:
  end/start trims, `setClipSpeed`, and `splitClip` (left half keeps only its
  fade-in, right half only its fade-out, stripped BEFORE clamping so the
  discarded fade can't eat the budget — keeps splits inaudible). Fades ride
  `ClipPatch`/`update-clip` (one undo step per commit). Serialize emits
  `fadeInFrames`/`fadeOutFrames` (rounded, re-clamped after quantization);
  `TimelineComposition.volumeProp` builds gain × ramp callbacks for BOTH
  `<OffthreadVideo>` and `<Audio>` (Remotion's volume callback receives the
  clip-relative frame — trimBefore cancels out via useFrameForVolumeProp, and
  playbackRate does not scale it).
- [x] **C1 UI.** Fade in/out numeric fields in the Clip inspector section
  (audio-bearing kinds); CapCut-style top-corner fade handles on clips with
  translucent ramp wedges (SVG), dragged through the same useClipDrag
  machinery as trims — preview runs the real `updateClip`, so mid-drag you
  see the clamped truth; commit on release = one undo step.
- [x] **C2 detach audio.** `detachAudio(timeline, clipId, newId)` in the new
  `clip-update-ops.ts`: mutes the video (gain 0 — the one mute concept) and
  creates an audio clip with the same assetId/timelineStart/sourceIn/
  duration/speed (sample-aligned by construction), carrying the video's
  pre-detach gain and fades; lands on the first unlocked audio track whose
  span is free, else a fresh `addTrack('audio')` lane. One op = one undo step
  restores both sides. Right-click context menu on video clips
  (`ClipContextMenu` over the existing FloatingMenu), disabled for soundless
  assets/already-muted clips; the new clip is selected after.
- [x] **File split (over-300 fix).** `updateClip`/`setClipSpeed` moved from
  timeline-ops.ts (364 → 285 lines) into `clip-update-ops.ts` alongside
  `detachAudio`; tests moved to `clip-update-ops.test.ts`.
- Live CDP run (throwaway seeded project, deleted after): fade fields → ramp
  wedges + preview element volumes 0.5/1.0/0.5 across the ramps (audio AND
  video elements); handle drag 1 s → 2 s exactly, one undo back; detach via
  context menu → muted video + selected new A1 clip, one undo restored both;
  real export: detached span envelope-corr 0.861 vs the right source span,
  faded span corr 0.904 vs ramped source (0.732 raw), edges at 2 %/12 %.
- CDP gotcha: `FloatingMenu` is position:fixed → `offsetParent === null`, so
  the visible() filter from docs/ui-automation-cdp.md hides it — query
  `[role="menu"]` raw.

### Studio — core-parity Session 2: Slice B1 (clip inspector) (2026-08-12)
**Status: COMPLETE — unit-tested (11 new tests, 329 total) + live CDP click-through
incl. a real export (TESTING.md §16.1 fully ticked + §16.4 per-clip-mute line);
no schema changes (gain/speed/transform/label already existed)**

Second session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **Pure ops.** `updateClip(timeline, clipId, patch)` in `timeline-ops.ts`
  patches `gain` (clamped 0–2) / `label` / `transform` (field-wise merge);
  neutral values (gain 1, empty label, identity transform field) REMOVE the key
  so documents never accumulate no-op state. `setClipSpeed(timeline, clipId,
  speed)` is separate because speed changes duration: `timelineStart` stays
  put, duration = sourceSpan/speed, clamped against the right neighbour like an
  end-trim (no ripple in v1 — the UI says so); rejects when even
  `MIN_CLIP_DURATION` no longer fits. `updateClips(timeline, clipIds, patch)`
  in `timeline-group-ops.ts` for multi-select volume/mute — all-or-nothing on
  locked tracks like `moveClips`. All identity-on-reject, 11 unit tests.
- [x] **Reducer.** Actions `update-clip` / `update-clips` / `clip-speed`; the
  UI commits sliders on release and numeric/label fields on Enter/blur, so one
  committed control change = exactly one undo step (multi-select volume = one
  step for the whole selection).
- [x] **UI.** `ClipSection` at the top of the Inspector when clips are
  selected: name/track/start/length read-outs, volume slider 0–200% + mute
  (pre-mute gain remembered per clip id in component state), speed presets
  0.25–4× + numeric field with the "shortens/lengthens in place" note, opacity
  slider + position/scale/rotation numeric fields (video/image/tsx only),
  label input (empty clears). Multi-selection: "N clips selected", volume+mute
  only. Input primitives split into `inspector-controls.tsx` (~300-line rule).
- Live CDP run (autocut-test, restored to a byte-identical project.json via
  undo afterwards): volume 50% → mute → unmute walked back by 3 single undos;
  2× halved the Length readout and the clip's px width, boxed-in 0.25× clamped
  trim-like; opacity/scale/rotation/x showed up in the player `<video>`'s
  computed style; label renamed the timeline clip; multi-select volume was one
  undo step. Real export while edited: duration 26.60 s matched the sped
  timeline, muted clip's span digitally silent (WAV sample scan), extracted
  frame showed the same translate/scale/rotate/opacity as the preview.
- Note: `timeline-ops.ts` is at 364 lines — over the ~300 guideline because
  the plan pins both new ops to this file; split candidate for a later pass.

### Studio — core-parity Session 1: Slice A (playback rate · copy/paste · timeline QoL) (2026-08-12)
**Status: COMPLETE — unit-tested (7 new tests, 317 total) + full live CDP click-through
(TESTING.md §16.3 / §16.6 / §16.9 ticked); no schema changes**

First session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **A1 — global preview playback rate.** `PLAYBACK_RATES` [0.5, 1, 1.5, 2]
  as `EditorShell` state (session-only, never in the document); rate button in
  the `PreviewPanel` transport cycles up, Shift+click cycles down; wired as the
  `playbackRate` prop on the `@remotion/player` `<Player>`. Auditions pin 1×:
  `playSpan` (Play removed / Play join) sets an `auditioning` flag cleared when
  the audition crosses its stop marker OR on manual pause (so an abandoned
  audition can't leave the rate stuck), and "Preview result" pins while
  checked — the button shows 1× disabled with an honest tooltip, then restores.
  Measured live at 2×: double clock advance over the same wall time.
- [x] **A2 — copy / paste / duplicate.** New pure op `pasteClips(timeline,
  entries, atSeconds, newIds?)` in `timeline-group-ops.ts` (7 unit tests):
  entries target their source track ids, fall back to first-compatible like
  `trackForAsset`, keep relative layout via `offsetSeconds`, fresh clip ids; on
  collision the WHOLE group shifts right together to the nearest fit (the
  minimal-delta candidates are "flush against an existing clip's end");
  identity-on-reject when an entry has no track or the group overlaps itself
  after fallback. Reducer `paste` action = one undo step; ids are minted by the
  caller so the paste can select the new clips (`useClipboard` runs the op
  eagerly and skips dispatch/selection on reject). Clipboard is an in-memory
  ref in the editor — cross-project paste refused by construction. Shortcuts
  Ctrl+C (only claimed when clips are selected) / Ctrl+V (at playhead) /
  Ctrl+D (paste at the selection's own end; leaves the clipboard alone) behind
  the existing text-entry + visibility guards.
- [x] **A3 — auto-scroll + zoom-to-fit.** `usePlayheadFollow`: on the playhead
  exiting the lanes viewport during playback, scrolls it back in at 20% from
  the left; a manual scroll while playing suspends following (own writes
  announce themselves via a programmatic counter), and it resumes when the
  playhead next walks OUT of view — the in→out transition is re-derived on
  manual scroll too, or a stale `wasInView` made the very next frame yank the
  view back (caught while building the CDP test). All refs, no React state.
  Zoom-to-fit (`Shift+Z` + toolbar Expand button): largest `ZOOM_LEVELS` step
  whose pxPerSecond shows the whole timeline, anchored at 0.
- Live CDP run (autocut-test + editorial-test): paste at End landed selected
  right after the last clip, Ctrl+D chained the next copy, undo ×2 → 13-clip
  baseline, redo → 14; zoom-to-fit framed 545 px of content at scrollLeft 0;
  follow jump re-entered at exactly 0.20, manual scroll-back stayed put,
  following resumed after re-enter + walk-out; audition pinned 2×→1×→2×.
- CDP testing gotcha recorded: the timeline lanes' scroll div is NOT the first
  visible `.overflow-auto` containing clips — an outer wrapper (84 px wider,
  never horizontally scrollable) matches first, silently reading `scrollLeft 0`
  forever. Pick the INNERMOST matching container. Also: playback (rAF) is
  throttled while the window is occluded — `Page.bringToFront` first.

### Studio — S3 agent pass: editorial cuts via the Assistant chat (2026-08-12)
**Status: COMPLETE — unit-tested (19 new tests, 310 total) + full live CDP run
(seeded TTS recording → AssemblyAI verbatim transcript → agent chat → 5-cut
proposal → apply → undo ×2 → redo)**

The LLM editorial pass from the S3 plan: the agent reads the VERBATIM
transcript and proposes retakes/false starts/fillers/fluff as cuts. Its output
lands through the SAME `proposal-add` → CutRegionLayer + ReviewCutsSection
flow as mechanical Auto Cut — the agent never touches the timeline.

- [x] **Typed in-process tools through the Agent SDK.** `LLMRequest.mcpServers`
  (main-process-only field, like `onTextDelta`) is passed into
  `ClaudeProvider.createSession`'s query options; `runLlmGenerate` grew an
  in-process `extras` param to carry it past the IPC type. `zod` pinned 4.3.6
  (already a transitive dep). Providers that aren't `agent-sdk` ignore the
  field — the agent's system prompt then honestly says it can chat but not
  edit, and names the fix (pick an Agent-SDK provider in the Inspector).
  Unknown provider ids (e.g. auto-registered `claude-subscription`, which is
  NOT in the saved configs list) are assumed agent-sdk.
- [x] **`studio-agent.ts`** (main): one in-flight turn per project, scope-less
  runs with explicit `messages` history (no hot-session staleness), push
  events over `STUDIO_AGENT_EVENT` (`delta` / `tool` / `proposal`), provider
  from `project.settings.agent.providerId` (its first real consumer),
  `featureSource: 'auto-cut'`. Two tools:
  - `get_transcript` → **takes view** (`transcript-takes-view.ts`, port of
    format_transcript.py): segments split on >0.8 s gaps, `#NN [s - e] (M:SS)`
    lines, pause lines between, fillers inline as `<<uh, 12.34-12.40>>`. Warns
    when the transcript isn't verbatim.
  - `propose_cuts` → `editorial-cuts.ts`: clamp/drop invalid spans, merge
    overlaps + wordless slivers (≤1 s) between cuts, then **RMS-snap edges
    with the existing `planClip`** under `internalGap = ∞` (pause compression
    stays Auto Cut's job) — head pads, decay tails, and the clamp that stops a
    tail riding into cut speech all apply to agent spans. Keeps↔cuts alternate
    1:1 with planner segments, so each item's edges are exactly what apply
    removes. Proposal built in main: retake/false_start/filler start
    **accepted** (veto review), fluff starts **rejected** (policy: suggest,
    don't auto-remove); honest `agentNote` headline + the agent's summary +
    QA notes (merged/dropped/vanished counts).
- [x] **`resources/skills/studio-clean-cut/SKILL.md`** — the clean-cut policy
  ported from claude-youtube-editor and composed into the system prompt via
  `skillIds`: spoken slates outrank judgment, doubled phrase → cut the FIRST,
  filler conservatism (standalone yes, mid-sentence careful, scripted never),
  antecedent rule, paired-fluff notes, "the transcript lies about TIME"
  (word-bound spans; snapping absorbs the error), every cut carries a
  which-take-wins note.
- [x] **Assistant tab is real** (`AgentPanel` + `useStudioAgent`): streaming
  deltas, tool-activity chips, proposal chip linking to review, stop/clear,
  Enter-to-send. A proposal arriving while the user is ON the Assistant tab no
  longer yanks them to the Inspector (regions still appear on the timeline);
  from any other tab the review pulls into view as before. One-review gating
  holds at three layers (send context flag → tool refusal; Auto Cut button;
  proposal-ops no-ops).
- Live walkthrough (dev, CDP): seeded a 38 s TTS wav containing a false start
  + "Let me say that again." slate + doubled "And what, and what" + standalone
  "Um." + a like/subscribe CTA; AssemblyAI verbatim transcript (70 words,
  measured times). One chat turn: agent read the takes view and proposed
  exactly the right 5 cuts — categories correct, fluff unchecked, notes name
  the winning take, and it flagged the one estimated boundary "needs an ear".
  Review showed honest stats (−18.9 s proposed / −11.3 s at Apply-4), regions
  on the A1 clip; Apply split 1→5 clips with the stats toast; two Ctrl+Z
  returned to pristine (un-apply, then un-add); Ctrl+Y brought the full
  review back. Type baseline ratcheted web 27→26.
- Not exercised live: auditions by ear (buttons render; left the proposal
  open in the `editorial-test` project to listen to), the chat-only fallback
  on non-agent-sdk providers, and the propose-cuts-refusal path (logic
  unit-covered). Takes view carries word times only on fillers by design —
  the model estimates other boundaries and the snapper absorbs it; if that
  bites, add per-word times to the view.

### Render pipeline — resolution-scale fix + animated WebP export (2026-08-11)
**Status: COMPLETE — unit-tested (16 new tests) + Electron smoke test; full in-app
render click-through still pending**

- [x] **Downscaled renders no longer zoom/crop pixel-sized content** (user-
  reported "GIF gets bigger and cut"). Root cause: fractional scales (e.g.
  480p from 1080p = 0.4444) were worked around by materializing smaller
  composition dims at scale 1, which re-lays-out the comp — absolute-pixel
  content kept its design size inside a smaller canvas. Fix: `snapRenderScale`
  (`src/shared/render-scale.ts`) picks the nearest scale with exact
  even-integer output dims (480p → 864×486) so Remotion's deviceScaleFactor
  path scales the finished bitmap instead; dims-materializing survives only
  as a logged fallback for near-coprime comp sizes. Modal presets show the
  snapped dims and pass the exact scale.
- [x] **WebP export** (`codec: 'webp'`): Remotion has no WebP codec and its
  bundled ffmpeg ships no libwebp (verified: encoder list has only `gif`,
  ffprobe can't even decode webp), so `src/main/services/webp/` renders a PNG
  sequence via `renderFrames`, encodes each frame through Chromium's canvas
  encoder in a hidden BrowserWindow (tone-extractor pattern; quality 1.0 =
  lossless VP8L, alpha preserved), and muxes with a hand-rolled pure
  RIFF/VP8X/ANIM/ANMF muxer (spec-tested; pad bytes, ALPH carry-through,
  VP8L alpha-bit detection). Zero new dependencies. `crf` is reused as WebP
  quality 1–100 (documented on `RenderCodec`) so queue DB/IPC are unchanged.
  Modal: WebP joins the GIF family (auto-480p, smoothness, loop, muted) plus
  quality presets and the transparency toggle; preview panel plays it in an
  `<img>`. Smoke-tested in real Electron: lossy-opaque + lossless-alpha
  files decode in Chromium's decoder at correct dims.
- Known gap: ffmpeg-based queue thumbnails can't decode .webp output (no
  libwebp in the stripped binary) — thumbnail is skipped gracefully.

### Studio — ripple-delete toggle + track management (2026-08-11)
**Status: COMPLETE — unit-tested (11 new tests, 284 total) + driven live via CDP**

The two queued follow-ups before resuming the S3 agent pass.

- [x] **Auto-ripple toggle** (`TimelinePanel.rippleEnabled`, persisted like
  `snapEnabled` as component state, default ON). Governs the Delete key and the
  toolbar delete button for single AND batch deletes; the button's tooltip
  says which mode is live ("Delete and close the gap" / "Delete, leaving the
  gap"). Backspace stays the explicit leave-the-gap delete in either mode.
- [x] **Track management.** Pure ops in `services/track-ops.ts` (identity-on-
  reject): add (visual tracks insert on TOP because tracks[0] paints in front;
  audio appends), rename, reorder, delete (locked/last-track reject), flag
  toggles — all undoable reducer actions in `useTimeline`.
- [x] **Interactive `TrackHeader`** (own file now): click chooses the track,
  double-click renames inline, lock + mute/hide icons are buttons, right-click
  opens a renderer-built `FloatingMenu` (NOT the native menu — no IPC, CDP-
  drivable) with Rename / Move up / Move down / Delete. "+ Track" button in
  the header column's top cell adds video/overlay/audio.
- [x] **Chosen-track pool adds**: `trackForAsset` gained a `preferredTrackId` —
  the selected track wins when compatible (audio↔audio lanes, visual↔non-audio),
  else the old first-compatible fallback. `useTimeline.selectedTrackId` is
  pruned when its track leaves the document.
- [x] Header column now follows the lanes' vertical scroll (translateY from the
  scroll viewport) — first time track count is user-controlled, so >3 tracks
  scroll; the ruler was already sticky.
- Verified live on the autocut-test project: ripple ON delete closed the full
  span (later clips slid exactly its width) and OFF left every later clip in
  place, undo restored both; O1/A2 landed top/bottom; chosen-track add put the
  clip on selected O1 instead of V1; rename → B-roll; lock/mute/hide labels
  flip; locked track's menu disables Delete; Move down + Delete + full undo
  chain returned exactly to baseline (V1/A1, 13 clips, flags cleared).
- Mid-session note: work briefly interleaved with a `git stash -u` of the
  whole tree; everything was restored from stash@{0} (EditorShell.tsx had to be
  checked out from the stash explicitly). The stash entry still exists and is
  safe to drop once confirmed.
- **User-reported bug fixed same day: vertical clip drags "sometimes snapped
  back" to the original track.** Two causes in `useClipDrag`: (1) the
  click-vs-drag test on release checked ONLY horizontal movement, so a clip
  dragged straight down/up to another lane with <2 px of X drift was discarded
  as "a click that never moved"; (2) the drop re-resolved the target lane from
  the pointerup coords instead of committing what the preview last showed, so
  boundary jitter could flip the outcome. Now: moves use a 2 px box on both
  axes (trims stay X-only), the drop commits the preview's lane
  (`lastTargetTrackId`), and a wobble that resolves back to the identical
  lane+time skips the dispatch instead of burning a no-op undo step. Verified
  live via CDP with a synthetic dx=0 drag: clip hopped V2 → lane above, undo
  restored it (previously this exact gesture always snapped back).

### Studio — timeline multi-select & batch editing (2026-08-11)
**Status: COMPLETE — unit-tested (11 new tests) + driven live via CDP**

User-requested during S3.3 testing (the request surfaced after fixing native
drag-selection painting over the timeline — `select-none` on the panel root).

- [x] Selection is now a SET (`useTimeline.selectedClipIds`; `selectedClipId`
  stays as the derived single selection for split/trim logic). Ctrl/⌘/Shift-
  click toggles membership; plain click collapses; clicking a clip of a
  multi-selection keeps the group so it can be dragged, and collapses on
  release only if the pointer never moved (CapCut semantics). Stale ids are
  pruned whenever clips leave the document (delete/undo/apply-proposal).
- [x] `services/timeline-group-ops.ts` (pure, same identity-on-reject contract):
  `moveClips` — one shared delta, relative positions preserved, clamped so no
  member collides with an unselected neighbour or crosses zero (boxed-in =
  reject), locked tracks reject; `removeClips` — batch delete with per-track
  ripple that closes the FULL removed span; `clipsInRect` — marquee hit-test.
- [x] Marquee drag-select (`useMarqueeSelect`): press empty lane space and drag
  a dashed rectangle; every clip it touches joins the selection (Ctrl/Shift =
  additive); a motionless press keeps the old deselect-click behaviour.
- [x] Group drag rides the existing scratch-document preview (`useClipDrag`
  gains a group mode — same snapping, no track hopping) and commits as ONE
  `move-clips` undo step. Batch delete: Delete = ripple, Backspace = plain,
  toolbar ripple-delete button now deletes the whole selection. New keys:
  Ctrl+A select all, Escape clear selection.
- Verified live: ctrl-click 2 clips → group-drag both +2 s (others untouched)
  → undo restores; marquee across 3 clips from the empty A1 lane; Delete
  removes all 3 with ripple; undo restores; empty-lane click clears.

### Studio (AI video editor) — Phase S3 step 3: cut proposals + review on the timeline (2026-08-11)
**Status: COMPLETE — verified live via CDP with a real AssemblyAI transcription**

Live walkthrough (same session, new machine): seeded 40 s TTS recording with known
pauses → one-click Auto Cut (chained AssemblyAI transcription, 69 words, measured
timestamps) → 12 cuts proposed (−14.0 s, the 3.5 s SSML break found as a 3.8 s
dead-air item) → rejected one item ("Apply 11 cuts" / grey region) → Apply split
the clip into 12 contiguous pieces with the stats toast → ONE Ctrl+Z restored the
full review (12 regions, proposal back to `proposed`). Two real bugs found live
and fixed:
- **AssemblyAI deprecated `speech_model`** (API change since S3.1): provider now
  sends `speech_models` — legacy 'universal' maps to the API's own default pair
  `['universal-3-5-pro','universal-2']`, other ids pass through.
- **useAutoCut chained plan never fired**: an asset has NO transcript entry in the
  document until the first job event, and the watcher read that `undefined` as
  "cancelled", clearing the pending run instantly. Now `undefined` only counts as
  cancelled after the job was seen running.
Note: the seeded TTS clip reports noise floor −120 dB (true digital silence) —
real recordings will show sane floors. Not exercised live: edge-drag by pointer
(logic unit-tested; handles render), auditions by ear, export of an applied cut.

User-reported bug fixed same day: **with "Preview result" on, the playhead
crawled through cut regions** (the Player runs the shorter CUT timeline while
the panel displays the original, so the line lagged and the video ended early).
Fixed with `services/preview-mapping.ts` — a piecewise-linear map between the
two clocks built from the reshaped track's clips (preserved gaps map
proportionally, cut spans collapse to the join). `TimelinePanel` shims its
whole playback surface (playhead, clock, ruler seeks, split-at-playhead, zoom
anchor) into display coordinates while the map is active, so the playhead now
JUMPS across regions and ruler seeks into a cut land on the join; EditorShell
auditions keep talking to the raw player clock. 5 unit tests (jump, collapse,
round-trip).

Design discussion + UI mockups: claude.ai artifact "Auto-Cut Flow" (session 2026-08-11).
Locked decisions: mechanical (silence) cuts first — the LLM editorial pass (retakes/
fillers) is the next slice and feeds the SAME review UI; all items start accepted
(veto-based review); AssemblyAI is the recommended engine (hint in the picker);
ffmpeg smart-render stays deferred.

- [x] **Proposals live in the undo history.** `useTimeline`'s reducer now snapshots
  `{timeline, proposals}` (`EditDoc`) so accept/reject/adjust/apply are all undoable
  and Ctrl+Z after Apply restores BOTH the timeline and the proposal to `proposed`
  in one step. New actions: `proposal-add / -item-status / -item-span / -apply /
  -reject`. Pure list edits in `services/proposal-ops.ts` (same identity-on-reject
  contract as timeline-ops).
- [x] **Plan → proposal** (`services/cut-proposal.ts`): keep-segments inverted into
  cut spans (incl. leading/trailing silence), categorized `long_pause` (<2 s) vs
  `dead_air` (≥2 s), word context in `note` ("…setup. [3.0 s] Now…") and swallowed
  words in `text`; honest headline + planner QA notes in `agentNote`. Also:
  source→timeline region mapping and per-item drag bounds (cuts can't overlap).
- [x] **Apply** (`services/apply-cut-proposal.ts`): accepted spans merged, subtracted
  from every clip playing the asset, survivors kept contiguous (per-track ripple —
  music holds timing), sub-frame slivers dropped, reshaped clips tagged
  `origin: {by:'agent', proposalId}`; first piece keeps its clip id. 19 new unit
  tests across builder/mapping/apply.
- [x] **Review UI.** `CutRegionLayer`: striped amber regions over the lanes (grey =
  rejected), click = select + seek, selected region gets **draggable edge handles**
  (snap to transcript word boundaries via `useAssetTranscripts` reading the cache
  JSON over `studioCacheRead`; item marked `adjusted`). `ReviewCutsSection` in the
  Inspector: stats header with honest before→after (runs the real apply on a
  scratch doc), QA notes, per-item accept toggles + category/adjusted chips +
  transcript context, Apply N cuts / Reject all.
- [x] **Auditions.** Per cut: "Play removed" (original timeline) and "Play join"
  (±1.5 s with accepted cuts applied — finds the post-ripple join by matching the
  survivor clip whose `sourceIn` is the cut's end). Global "Preview result"
  checkbox plays the whole timeline as-if-applied; all built on scratch documents
  through the same `applyCutProposal`, so preview is exactly what commits.
- [x] **One-click Auto Cut** (`useAutoCut` + `TranscriptSection`): transcribes first
  when needed (chains on the transcript-ready document event), then plans, builds
  the proposal, selects the first cut. Engine picker labels AssemblyAI entries
  "best for auto-cut". Button disabled while a proposal is open (one review at a
  time).
- New machine setup fixed en route: committed `.npmrc` with `legacy-peer-deps=true`
  (react-simple-maps@3 peer range vs React 19 — fresh clones couldn't install).
- Pending: live CDP walkthrough (auto-cut → drag an edge → veto → apply → undo →
  redo → export) on the S3.1 test recording; StudioProposalItem gained optional
  `adjusted` flag (schema v1 unchanged — additive).

### Studio (AI video editor) — Phase S3 steps 1–2: transcription + cut planner (2026-08-08)
**Status: COMPLETE — verified end-to-end via CDP (transcribe → cancel → re-transcribe → plan JSON)**

- [x] **Whisper word timestamps are now measured, not approximated.** whisper.cpp
  runs with `-ojf` (full JSON; flag verified against the v1.8.3 binary the app
  downloads) and the new electron-free `src/main/services/whisper-output.ts`
  merges BPE tokens into words with real times + per-word confidence (min token
  p). Two traps handled and unit-tested: bare punctuation tokens carry phantom
  timestamps (a "." can sit 0.9 s after its word — timing comes from speech
  tokens only, else pause detection dies) and sub-word merging (" Auto"+"C"+"ut").
  Char-distribution approximation stays as the per-segment fallback.
- [x] **Capability snapshots, never provider branching.** `SttModelFeatures`
  gained `verbatimDisfluencies`; providers now return the features a run
  actually delivered (whisper: measured vs fallback; AssemblyAI: what was
  requested+returned), and `StudioAssetTranscript` records that snapshot +
  `sttModelId` + `wordCount` in the document. `undefined` = "not available",
  never `[]`. AssemblyAI requests `disfluencies: true` when the caller asks for
  verbatim (auto-cut does; the transcribe feature doesn't).
- [x] **Per-asset transcription is button-triggered only** (media-pool hover
  action + Inspector section with engine picker persisted in
  `settings.sttModelId`) — never on import, so b-roll/music never burn whisper
  minutes or AssemblyAI credits. Runs as the third media-job kind (serialized —
  whisper.ts tracks a single child process), streams percent, writes rich JSON
  to `cache/transcripts/<assetId>.json`, folds meta into the document on
  `ready`. Cancel mid-run removes the entry (verified live); stale
  `'generating'` from a killed session is cleaned up on cancel too.
- [x] **cutlib.py ported to `cut-planner.ts`** (pure logic, 25 unit tests): RMS
  noise floor (10th percentile), speech-run atoms, snap-to-audio tails with
  soft/punchy landings, pause compression, cut-span clamps (a tail must never
  ride into cut SPEECH — the reference repo measured 0.70 s surviving that way).
  Reference `tight`/`natural` styles from the clean-cut skill. Capability
  compensation: approximate timing widens head/tail pads instead of refusing.
  RMS comes from the waveform cache — `waveform-generator` now emits `rmsDb`
  buckets (dBFS, 20 ms grid) alongside peaks (file version 2; v1 files
  regenerate on first plan) because the stripped ffmpeg has no volumedetect.
- [x] **`studio:cutplan:run` IPC** → `cut-plan-runner.ts` loads transcript +
  envelope, writes `cache/cut-plans/<assetId>-<style>.json`, returns the plan;
  Inspector shows stats + QA notes + path. NOTHING touches the timeline —
  proposals/review are S3 step 3. Honest QA readout: non-verbatim engines get a
  "filler cutting will find less" caveat instead of implied AssemblyAI parity.
- Verified live on a 39.4 s recording with known pause positions: 73 words
  measured (`wordTimestamps: true` snapshot in project.json, survives restart),
  13 keep-segments, 12 pauses compressed, soft landing on the 3.3 s gap, style
  un-widened. Also caught live: whisper pads its final decode window past the
  real audio end (41.7 s claimed vs 39.4 s measured) — the envelope's duration
  is authoritative in the runner, not the transcript's.
- Notes: whisper-base word times still smear across some pauses (several known
  SSML breaks didn't surface as word gaps — the documented "transcript lies
  about time" failure mode; the RMS snap is what makes edges robust). AssemblyAI
  path is wired (verbatim + snapshot) but not exercised live — would spend
  credits. `npm run lint` referenced in CLAUDE.md doesn't exist as a script
  (pre-existing); gates used: `check:types` ratchet 27/22 + `npm test` (229).

### Studio (AI video editor) — Phase S2: timeline core (2026-08-07)
**Status: COMPLETE — verified end-to-end via CDP, including the Player checkpoint**

- [x] `src/shared/studio/`: `time-math` (one cumulative-rounding conversion,
  `round(b·fps) − round(a·fps)`, so 100 cuts tile with zero drift), `serialize`
  (document → frames + asset URLs), and the data-driven `TimelineComposition`
  used by BOTH the preview and the export.
- [x] Timeline document reducer + undo/redo in feature state (`useTimeline`,
  100-deep snapshot history, no global store). Pure ops in
  `services/timeline-ops.ts`: add / move (neighbour-clamped) / split /
  trim (source- and neighbour-bounded) / ripple-delete (per-track, so music
  keeps its timing) / remove-asset-clips.
- [x] Tracks/clips UI: ruler, 10-step zoom anchored on the playhead, magnetic
  snapping to clip edges + playhead, drag-move across tracks, edge trims,
  canvas waveforms, selection, keyboard (Space/S/Del/Backspace/Ctrl+Z/Y/
  arrows/Home/End). Drag preview runs the real op on a scratch document, so
  what you see mid-drag is exactly what commits.
- [x] `@remotion/player` preview over 720p proxies; playhead lives outside
  React state (imperative subscribe → DOM), so playback re-renders nothing.
- [x] Background main-process jobs (tsx-job-engine pattern): proxy generator
  (NVENC → libx264 fallback, verified on this machine) and waveform generator;
  status per asset in the document, push events folded back into it.
- [x] Export: generated Remotion entry embedding the serialized timeline
  (originals, not proxies) → existing render queue. Verified output:
  1920×1080@30, 60.000 s video / 60.053 s audio, correct picture per clip,
  black across a deliberate gap, audio bursts at the right seconds.
- [x] **Player-architecture checkpoint passed** (100 cuts, 720p proxies, dev
  build — noisy machine, so ranges): playback 16.7 ms/frame (60 fps, same as a
  2-clip timeline); scrub 17–25 ms at natural drag speed, 25–35 ms flinging
  across the whole timeline; the editor's own JS is ~1.4 ms per scrub step, so
  the ceiling is video decode, not the UI. No HTML5-seek fallback needed.
  Two fixes got it there: proxies need a short GOP (`-g 15` — the encoder
  default ~8 s made each seek decode up to 250 frames, ~20 fps), and
  `TimelineComposition` mounts only clips within ±2 s of the current frame
  (mounting all 100 sequences per frame halved scrub throughput).
- Notes: proxies/waveforms are cached per project, so the same source imported
  into two projects transcodes twice (candidate for a hash-keyed shared cache).
  `EditorShell` imports `useRenderQueue` from `@features/render-queue`,
  following the existing precedent in `features/motion` — the render queue is
  app-level infrastructure exposed through context.
- Pre-existing bug noticed while testing (NOT introduced here, affects all
  renders): the queue shows "Bundling... 10000%" — `render-handlers.ts`
  multiplies an already-0–100 bundler percent by 100 again.

### Studio (AI video editor) — Phase S1: projects & editor shell (2026-08-07)
**Status: COMPLETE — verified end-to-end via CDP**

- [x] Document schema v1 in `src/shared/types/studio.ts` (seconds-only unit
  discipline, provenance, proposals); IPC contracts in
  `src/shared/ipc/types/studio.ts`; 9 `STUDIO_*` channels.
- [x] Main services (`src/main/services/studio/`): `studio-paths` (id
  validation + cache-path traversal guard), `project-store` (folder-as-truth
  listing, atomic tmp+rename saves, `shell.trashItem` delete with rm
  fallback, reuses `reserveProjectFolder`), `media-import` (ffprobe probe for
  video/audio/image, ffmpeg thumbnails to `cache/thumbs/`, content-hash for
  future relink).
- [x] Settings: `studioProjectsRoot` (default `~/Videos/VidTSX Studio`),
  changeable from the browser toolbar via the existing folder dialog.
- [x] Renderer: `ProjectBrowser` (grid cards, two-step delete),
  `NewProjectDialog` (Landscape/Portrait/Square presets + fps),
  `EditorShell` (CapCut layout: media pool | aspect-correct preview stage |
  Inspector+Assistant tabs | full-width timeline scaffold with ruler and
  V1/A1 lanes), debounced document autosave (`useStudioProject`),
  per-project agent provider picker persisted in `settings.agent`.
- [x] CDP-verified: create portrait 1080×1920@60 project → on-disk scaffold
  correct → provider select persists (atomic-save rename observed in USN
  journal) → back → card grid → delete → folder in Recycle Bin, empty state.
  Manual test remaining: media import (native file dialog can't be driven
  via CDP) — probe/thumbnail path is exercised in code but not clicked
  through. S2 exercised everything downstream of it by writing asset entries
  straight into project.json.
- Automation gotcha recorded: `App.tsx` keeps every visited screen mounted
  (`display: none`), so DOM-driving MUST filter to visible elements
  (`offsetParent !== null`) or clicks land on hidden screens' buttons.

### Studio (AI video editor) — Phase S0: gate & scaffold (2026-08-07)
**Status: COMPLETE**

Full architecture + phase plan (S0–S7) in `docs/studio/PLAN.md`. Locked
decisions: Remotion-native `TimelineComposition` for both preview (over 720p
proxies) and export; solid manual timeline core (S2) before auto-cut (S3);
user-chosen studio projects root (folder-as-truth); local whisper default with
AssemblyAI opt-in for word timestamps. Engine knowledge and skills ported from
`D:\repos\claude-youtube-editor` (cutlib planner, render-drift lessons,
clean-cut/make-tsx/suggest-sfx editorial policy).

- [x] Flags `studio: true` (nav teaser) / `studio-editor: false` (prod shows
  Coming Soon, dev fully enabled) — Flows-style gating.
- [x] `src/features/studio/` scaffold: gated `StudioScreen`, draft v1 timeline
  document schema in `types.ts`, barrel.
- [x] Sidebar nav item (Clapperboard, after TSX) + `screens` map entry.

### v1.0.0 — First public release (2026-07-29)
**Status: COMPLETE**

Public scope: TSX Creator, Image Studio, Transcribe, Assets, render queue,
and AI Models (System / Providers / Audio-whisper / Image). Everything else
stays visible as "Coming soon" in production and fully enabled in dev.

- [x] Image Studio local models: `LocalSdImageProvider` bridges the sd-cli
  engine into the cloud ImageEngine (provider id `local`, auto-offered when
  ≥1 ready on-device model). Promise-based `enqueueAwait` on the local
  engine; shared generation preflight (`applySdGenerationPreflight`);
  provider switch persists. Verified end-to-end via CDP (bk-sdm-tiny 256²).
- [x] Coming-soon gating (prod only): AI Models Video/LLMs/Embeddings tabs
  (`ai-video-models` / `ai-llm-models` / `ai-embedding-models` flags; 3D was
  already a placeholder), Flows editor (`flows-editor` flag — nav stays),
  sherpa voice-engine section of the Audio tab (existing `audio-engine`
  flag). Creator's keyless "Local Models" preset is gated on real
  `llmLocalEngine.isAvailable()` because production builds exclude
  node-llama-cpp.
- [x] Repo made public-ready: README.md written, personal scratch notes
  untracked, no secrets/keys in tree (verified), MIT license.
- [x] v1.0.0 Windows installer built and published as a GitHub release.

### TSX Generator stabilization + parallel jobs (Creator)
**Status: COMPLETE — committed 2026-07-23**

Full plan in `docs/tsx-generator-stability-plan.md`; contributor guide in
`docs/tsx-generator-architecture.md`.

- [x] **Phase 1** — stability foundation: compat-provider abort, agent-sdk
  error-result detection, save/auto-save races, retry-with-backoff,
  string-based validate, `npm run check:types` ratchet gate.
- [x] **Phase 2** — main-process job engine (`src/main/services/tsx-jobs/`):
  up to 4 concurrent generations with isolated `ClaudeSession`s, per-job
  provider + cancel, atomic project naming, queued-job persistence, will-quit
  shutdown.
- [x] **Phase 3** — job-based Creator UI: jobs strip, center-panel ownership
  rule, edits/fixes as jobs.
- [x] **Phase 4** — token streaming, per-project `chat.json` refinement
  history, pipeline tests, `local` + Z.AI providers, **props panel**
  (AST prop extraction + live preview inputProps), custom-provider UI
  (any OpenAI/Anthropic-compatible endpoint), library placeholder rows,
  maxConcurrent setting, coalesced library rescans.
- Z.AI preset verified against docs 2026-07-23: base URL
  `https://api.z.ai/api/anthropic`, model `glm-5.2` (opt: `glm-5.2[1m]`).

### Local AI Models redesign (open-source cleanup)
**Status: COMPLETE (Phases 0–4) — committed; field-verification pending**

Replaced the download-centric SD/Flux catalog (hosted on learnwithhasan.com) with
a ComfyUI-style, folder-as-truth model library built on a category-agnostic core.
Zero owner infrastructure for image models. See
`docs/local-image-models-redesign.md` (design) + `docs/local-image-models-implementation.md`
(plan + full Progress Log).

- [x] **Phase 0** — vitest tooling + type-error baseline (node 36 / web 44).
- [x] **Phase 1** — category-agnostic model-library core (`src/shared/model-library/`,
  `src/main/services/model-library/`): scanner, classifier, sidecars, importer,
  usage-store, category/runtime registries. Electron-free, injectable, 37 tests.
- [x] **Phase 2** — image adapter + registry rework: `SdModelDefinition`→profile
  envelopes (34 entries), `flux`→`flux1`/`flux2`, companion resolution, deleted
  `SD_MODELS_BASE_URL`, generic `MODELS_*` IPC, engine on an injected resolver.
- [x] **Phase 3** — dedicated flag-gated "AI Models" sidebar screen; image library
  view rewritten onto `MODELS_SCAN` (`useImageLibrary` + Header/Installed/Catalog/
  SetupDialog); dashboard Library card; deleted hidden GeneralTab folder block.
- [x] **Phase 4** — deleted audio `MODELS_BASE_URL` + fallback, orphaned
  `useSdImageModels`; fixed the dangling NSIS `build/license.txt` reference
  (→ committed `LICENSE.txt`) so `build:win` completes. 67 tests; node 36 / web 36.

**Pending before this ships (flagged in the Progress Log):**
- Interactive UI click-through of the AI Models screen (not run — non-interactive session).
- Catalog metadata verification: FLUX.2 Klein companion source links + the 13
  link-only `sourceUrl`s are best-effort, not network-verified; verify with a real sd-cli.
- sd-cli binary distribution story (still not bundled).

### Captions Generator
**Status: COMPLETE**

- [x] 4-step wizard UI (StepCard components)
  - Step 1: Add audio/video (AudioDropZone with drag & drop)
  - Step 2: Transcribe (ModelSelector with whisper integration)
  - Step 3: Choose caption style (CaptionTemplateSelector)
  - Step 4: Render options (WebM overlay, Burn into video, Export JSON)
- [x] useCaptions hook for wizard state management
  - Step progression logic
  - Transcription integration via existing whisper IPC
  - Style selection
- [x] 3 caption templates (Remotion compositions):
  - BoldPopCaptions: Large centered text with spring pop animation
  - KaraokeCaptions: Word-by-word highlight effect
  - MinimalCaptions: Clean subtitles at bottom with dark bar
- [x] caption-builder service (duration calculation, config generation)
- [x] CaptionPreview with VideoPlayer integration
- [x] Render queue integration:
  - Export WebM overlay (vp8 codec, transparent)
  - Burn into video (h264 codec)
  - Export captions JSON
- [x] Reuses whisper:transcribe IPC from transcription feature

### Phase 5 — Render queue system
**Status: COMPLETE**

- [x] Step 5.2 — Render queue service and UI
  - [x] RenderQueueJob type with full metadata (id, fileName, status, progress, etc.)
  - [x] queue-manager.ts utilities (generateOutputPath, formatFileSize, etc.)
  - [x] RenderQueueContext with state management, IPC event listeners
  - [x] Auto-start next queued job when current completes
  - [x] Debounced persistence to ~/.vidtsx/render-queue.json
  - [x] Load on startup with interrupted job handling
  - [x] Clean up jobs older than 7 days
- [x] IPC handlers added:
  - RENDER_QUEUE_SAVE for persisting queue
  - RENDER_QUEUE_LOAD for loading queue on startup
  - RENDER_OPEN_FILE for opening rendered files
  - RENDER_OPEN_FOLDER for revealing in explorer
  - RENDER_GET_VIDEOS_DIR for default output folder
- [x] UI components created:
  - RenderScreen with toolbar and job list
  - RenderItem with status icons, progress bar, actions
  - RenderProgress wrapper for status-colored progress bar
- [x] Toast notification system (shared component + context)
- [x] Sidebar badge showing active/queued job count
- [x] Render button in WorkspaceScreen integrated with queue

### Phase 4 — Code editor + props panel
**Status: COMPLETE**

- [x] Monaco code editor integration
- [x] Code + visual view mode toggle
- [x] Resizable divider between code and preview
- [x] Auto-save with transpilation refresh
- [x] Props panel (delivered later with the TSX Generator work, 2026-07-23):
  AST-based `props-parser`, `PropsPanel`/`PropField` controls
  (text/number/toggle/color/select), live preview updates via Player
  `inputProps`

### Phase 3 — Remotion player integration
**Status: COMPLETE**

- [x] VideoPlayer component wrapping @remotion/player
- [x] PlayerControls with play/pause, seek, timeline, loop, speed control
- [x] useComponentLoader hook for TSX transpilation
- [x] Native module loading with virtual module globals (setupVirtualModuleGlobals)
- [x] Error boundary and loading states for player
- [x] Screenshot functionality (copy to clipboard, save to file)
- [x] Fullscreen support

### Phase 2 — Workspace + file management
**Status: COMPLETE**

- [x] Step 2.1 — File tree UI component
- [x] Step 2.2 — File management features:
  - [x] "New folder" button in toolbar with inline name input
  - [x] Right-click context menu (native Electron Menu):
    - File: Rename, Delete
    - Folder: Rename, Delete, New subfolder
  - [x] Inline rename (click turns label into input, Enter saves, Escape cancels)
  - [x] Drag-and-drop .tsx files onto window (with visual overlay)
  - [x] Paste TSX from clipboard (Ctrl+V detects TSX-like content)
  - [x] SelectedFileContext for sharing selected file across screens
- [x] IPC channels added:
  - FILE_RENAME for renaming files/folders
  - FILE_GET_PROJECTS_DIR to expose projects directory to renderer
  - CONTEXT_MENU_SHOW for native context menus
  - CLIPBOARD_READ_TEXT for clipboard access
- [x] Components created:
  - InlineRenameInput for inline editing
  - DropZoneOverlay for drag-drop visual feedback
  - SelectedFileContext/Provider for state management

### Phase 1 — App shell + navigation
**Status: COMPLETE**

- [x] Title bar with traffic lights (macOS) / system buttons (Windows)
- [x] Sidebar with 7 navigation icons + settings at bottom
- [x] Screen routing between all 7 screens
- [x] Placeholder screens for each feature
- [x] Reusable shared components:
  - [x] Button (primary/secondary variants, sm/md sizes)
  - [x] Panel (dark surface with optional header)
  - [x] Badge (free/pro variants)
  - [x] ProgressBar (4px height, multiple colors)
  - [x] TextInput (styled input with focus state)
  - [x] IconButton (toolbar actions)
- [x] Barrel export from src/shared/components/index.ts
- [x] WorkspaceScreen updated to use Panel + Button

### Phase 0 — Project scaffold
**Status: COMPLETE**

- [x] Electron 41.0.2 installed and working
- [x] electron-vite 5.0.0 configured as build tool
- [x] TypeScript 5.9.3 with separate configs (node/web)
- [x] React 19.2.4 rendering in Electron window
- [x] Tailwind CSS 4.2.1 with custom theme colors
- [x] Path aliases (@main, @renderer, @features, @shared)
- [x] Preload script with contextBridge
- [x] Typed IPC foundation (22 channels)
- [x] Full folder structure with barrel exports
- [x] electron-builder configured for Windows/macOS

---

## Known issues / tech debt

- `scripts/dev.js` wrapper needed to clear `ELECTRON_RUN_AS_NODE` env var (VSCode terminal issue)
- `@rollup/rollup-win32-x64-msvc` added to optionalDependencies as workaround for npm bug
- Tailwind CSS native binaries (`lightningcss`, `@tailwindcss/oxide`) require explicit install on Windows

---

## Deviations from plan

- Using `scripts/dev.js` wrapper instead of direct `electron-vite dev` due to VSCode environment variable conflict

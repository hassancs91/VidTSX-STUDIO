# Studio core-parity plan — timeline features before S4

> Goal: close the gaps between our timeline and the CapCut/Camtasia core
> feature set, then freeze and run the full stability gate
> (`docs/studio/TESTING.md`) before any new phase (S4+) starts.
>
> Read `docs/studio/PLAN.md` first for architecture; house rules from
> CLAUDE.md apply (feature isolation, IPC-only bridge, ops in services,
> ~300 lines/file, seconds-only clock, identity-on-reject pure ops, every
> edit an undoable reducer action). Each feature's acceptance tests live in
> `TESTING.md` §16 — a feature is done when its block passes.
>
> Explicitly NOT here (owned by later phases): text/titles (S4), captions +
> SFX/music/denoise (S5), keyframes/effects/filters/export presets (S7),
> compound clips, screen recording.

## Slice A — quick wins (no schema changes)

### A1. Global preview playback rate (1× / 1.5× / 2×)

Watch-speed for editing — the OVERALL preview plays faster; nothing about
the document or export changes. Not per-clip speed (that's B1).

- UI: small rate button in `PlayerControls`-style position on the Studio
  preview (`PreviewPanel`) cycling 1× → 1.5× → 2× (Shift+click cycles down;
  consider 0.5× at the front for detail work). Active rate shown on the
  button; resets to 1× per app session, not persisted in the document.
- Wiring: `playbackRate` prop on the `@remotion/player` `<Player>` in
  `PreviewPanel`; state lives in `EditorShell` (or `usePlayback`) so
  auditions can force 1× — **Play removed / Play join / Preview result
  auditions must temporarily pin 1×** (you audition joins at real speed),
  restore after.
- Gotchas: audio pitch shifts at ≠1× (Remotion behavior — acceptable, it's a
  monitoring aid); the playhead subscription is rate-agnostic (it reads the
  frame), so the timeline playhead and preview-time map need no changes —
  verify with "Preview result" ON.
- Test: TESTING.md §16.9.

### A2. Copy / paste / duplicate

- In-memory clipboard in the studio feature (module state or ref in
  `EditorShell`) holding deep-copied clips + their track ids and relative
  offsets. NOT the OS clipboard (cross-project paste is out of scope — refuse
  cleanly if the assets aren't in the open project).
- New pure op in `services/timeline-group-ops.ts`: `pasteClips(timeline,
  entries, atSeconds)` — target the source track ids (fall back to
  first-compatible like `trackForAsset`), keep relative layout, fresh clip
  ids, clamp/reject on collision with the SAME rules as `moveClips`
  (identity-on-reject). Duplicate = paste at `selectionEnd` of the original.
- Reducer: one new `paste` action → one undo step; paste selects the new
  clips. Shortcuts Ctrl+C / Ctrl+V (at playhead) / Ctrl+D in
  `useTimelineShortcuts` (respect the text-entry + visibility guards).
- Test: §16.3.

### A3. Timeline QoL — auto-scroll + zoom-to-fit

- Auto-scroll: while playing, if the playhead exits the visible viewport,
  scroll the lanes so it re-enters at ~20% from the left (CapCut behavior);
  a manual scroll during playback suspends following until the playhead
  leaves view again (no fighting the user). Lives in `TimelinePanel` next to
  the existing imperative playhead subscription — keep it out of React state.
- Zoom-to-fit: button + `Shift+Z` — pick the zoom step whose pxPerSecond
  shows the whole timeline; anchor at 0.
- Test: §16.6 (markers moved to Slice D).

## Slice B — clip inspector (schema fields already exist)

### B1. Clip section in `InspectorPanel` + `update-clip` op

`StudioClip.gain/speed/transform/label` are fully supported by
`serialize.ts` (gain→volume, speed→playbackRate, transform→CSS) and
`TimelineComposition` — this slice is ops + UI only.

- New pure op `updateClip(timeline, clipId, patch)` in
  `services/timeline-ops.ts`: patches `gain`, `label`, `transform`
  (identity-on-reject on unknown clip / locked track / no-change).
- **Speed is NOT a plain patch**: changing speed changes the clip's timeline
  `duration` (`sourceSpan / speed`). Decision: keep `timelineStart` fixed,
  recompute duration, clamp against the right neighbour exactly like a trim
  (reject if it can't fit at minimum). No ripple on speed change (v1) —
  document that in the UI ("shortens/lengthens in place").
- Reducer action `update-clip` → single undo step per committed control
  change (commit sliders on release, not per-pixel, or undo history floods).
- UI: "Clip" section at the top of the Inspector when `selectedClipId` is
  set — name/track/time read-outs, volume slider (0–200%, maps gain 0–2) +
  mute toggle (gain 0 with previous value remembered in component state),
  speed presets (0.25/0.5/1/1.5/2/4) + numeric field, opacity slider,
  position/scale/rotation numeric fields (video/image/tsx clips only),
  label text input. Multi-selection: show "N clips selected", offer volume
  and mute only (applies to all — one undo step).
- Per-clip mute is part of this block (§16.4's mute item folds in here).
- Test: §16.1.

## Slice C — audio fades + detach audio (schema additions)

### C1. Fades

- Schema (additive, no version bump — like `adjusted`): `fadeInSec?` /
  `fadeOutSec?` on `StudioClip`, clamped so `fadeIn + fadeOut ≤ duration`.
- Serialize: pass through; `TimelineComposition` builds a per-frame volume
  callback (Remotion `volume={(f) => ...}` with `interpolate`) combining
  gain × fade ramps for `<Audio>` AND `<OffthreadVideo>`.
- UI: corner fade handles on audio-bearing clips (drag from top corners —
  CapCut style) + numeric fields in the Clip inspector section. Trims/splits
  clamp existing fades (pure-op responsibility; unit-test).
- Test: §16.2.

### C2. Detach audio

- New op `detachAudio(timeline, clipId)`: video clip gets muted
  (`gain: 0`... prefer explicit `muted: true`? No — reuse gain 0 to avoid a
  second mute concept), plus a NEW audio clip on the first unlocked audio
  track (create one if none) with the SAME assetId/sourceIn/duration/speed,
  sample-aligned. One undo step restores both.
- Verify early (spike, before UI): Remotion `<Audio src={videoFileUrl}>`
  plays an mp4's audio track in preview AND `renderMedia` — the waveform
  pipeline already treats video files as audio sources, but the composition
  path must be proven. If it doesn't hold, the fallback is an ffmpeg
  audio-extract cache job (more work — decide only after the spike).
- Context-menu entry on video clips ("Detach audio") via the existing
  renderer-built `FloatingMenu`.
- Test: §16.4.

## Slice D — markers + range export

### D1. Markers

- Schema (additive): `markers?: Array<{ id, time, label?, color? }>` on
  `StudioProject.timeline` (timeline-level, not track). Reducer actions
  `marker-add / -move / -remove / -rename` (undoable).
- UI: M key drops a marker at the playhead; diamonds on the ruler; click =
  seek, drag = move, double-click = rename, right-click = delete.
- Test: §16.6 markers items.

### D2. Range export (in / out)

- I / O keys set `rangeIn`/`rangeOut` (component state in `EditorShell`, not
  the document — a monitoring/export aid, not an edit; Shift+I/O clears).
  Ruler shows the highlighted span.
- Export dialog/flow gains "Export range" when a range is set:
  `studioExportPrepare` request grows optional `rangeIn`/`rangeOut` seconds;
  the generated entry offsets `Sequence` timing or (simpler) serializes a
  trimmed timeline — pick the approach that keeps `serializeTimeline` the
  single source of truth. Frame-accuracy at both ends via the existing
  cumulative-rounding helper; ffprobe the output in testing.
- Test: §16.7.

## Slice E — basic transitions (crossfade · dip-to-black)

The only slice with real model risk — design first, then build.

- Model: transition lives on the BOUNDARY, stored on the leading clip:
  `transitionOut?: { kind: 'crossfade' | 'dip-to-black', duration }`,
  valid only when the next clip on the track starts exactly at this clip's
  end (contiguous). Ripple/trim/split/delete must keep or drop it sanely
  (pure-op rules + unit tests; dropping with a note is fine in v1).
- Render: clips stay non-overlapping in the document; `serialize.ts` extends
  the two sequences by `duration/2` each at render time and drives opacity
  ramps (crossfade) or a black overlay + audio dip (dip-to-black). Source
  material must exist beyond the cut for a crossfade — clamp the transition
  duration to available handles (trimmed-away media), exactly like every NLE.
- UI: drop-zone square at the join (click → picker with the two kinds +
  duration), or context menu on the boundary; region renders as a small
  overlap badge on the clips.
- Audio: crossfade = equal-power volume ramp on both clips; dip = ramp to 0
  and back.
- Test: §16.5.

## Slice F — media relink

- `media-import.ts` already computes a content hash on import (`hash?` on
  the asset) — this is the consumer.
- Missing-file detection on project open (cheap `fs.access` in main during
  load, or on `studioMediaPrepare`): asset flagged `missing` in the UI
  (badge on the pool tile, clips render with a warning tint).
- "Locate…" on a missing asset → native file dialog → main verifies the
  picked file's hash matches (mismatch = warn + allow override), rewrites
  `asset.path`, re-probes; proxies/waveforms/transcripts are keyed by asset
  id so they survive. New IPC `STUDIO_MEDIA_RELINK` following the
  channels/types/handler/preload/electron.d.ts pattern (all five places —
  `electron.d.ts` is manual, forgetting it fails the web type gate).
- Test: §16.8.

## Order & session sizing

Each slice is one working session, roughly increasing in risk:

| Session | Slices | Schema change | Risk |
|---|---|---|---|
| 1 | A1 + A2 + A3 | none | low |
| 2 | B1 | none (fields exist) | low |
| 3 | C1 + C2 | fades fields | medium (detach spike) |
| 4 | D1 + D2 | markers field | low-medium |
| 5 | E | transitionOut field | highest — design review first |
| 6 | F | none | low |

After session 6: run ALL of `TESTING.md` (Hasan's full manual pass + the S3
exit export gate), fix what falls out, and only then open S4.

## Standing rules for every slice

- Pure ops first with unit tests (identity-on-reject), then reducer action,
  then UI. Gates per session: `npm test` + `npm run check:types` (baselines
  ratchet down only) + a live CDP click-through of the new feature.
- Schema additions are optional fields only — no version bump, old projects
  must open untouched. Anything the composition renders must be verified in
  BOTH preview and a real export before the slice closes.
- Update `STATUS.md` + tick the matching `TESTING.md` §16 block per session.

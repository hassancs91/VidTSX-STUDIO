# STATUS.md — Current progress

> Claude: update this file after completing each phase.

## Current phase: 6 — Template store + media library
## Status: NOT STARTED

---

## Completed phases

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

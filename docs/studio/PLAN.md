# Studio — AI-Powered Video Editor: Architecture & Phase Plan

> Feature module: `src/features/studio/` · Flags: `studio` (nav) / `studio-editor` (screen body)
> Companion ledger: `docs/studio/STATUS.md` (create when S1 starts; S0 is tracked in root STATUS.md).
> Reference implementation of the editing pipeline: `C:\Users\Malak\Documents\GitHub\claude-youtube-editor` (skills + Python tools + Remotion shots). We port its data model and engine knowledge; we do not depend on it at runtime.

## 1. Vision

A full professional video editor and creator powered by AI — CapCut-grade UI, open source,
free, BYOK. Horizontal and vertical, longs and shorts. The user records (or imports) footage;
the agent cuts it, authors TSX graphics, places SFX/music/captions, generates images and video
clips — and every AI action lands on a normal, hand-editable timeline.

**Core thesis (inherited from claude-youtube-editor):** the edit lives in a JSON document and
the agent is an editor who writes it. In claude-youtube-editor that document is split across
`cuts.json` / `timeline.json` / `sfx-plan.json` with Claude Code authoring them and Python
tools doing deterministic ffmpeg work. Studio unifies this into **one timeline document per
project that is simultaneously the UI's data model and the agent's work surface**:

- The timeline UI renders the document; mouse edits mutate it (with undo/redo).
- The agent edits the same document through typed tools — so every AI action is a visible,
  reviewable change on the timeline, and every manual tweak is context the agent can read.
- Bulk/destructive AI edits arrive as **proposals** the user audits before applying (the
  clean-cut skill's hard user-audit gate, rebuilt as native UI).

## 2. Locked decisions (2026-08-07)

| Decision | Choice |
|---|---|
| Preview architecture | **Remotion-native**: one data-driven `TimelineComposition` is both the `@remotion/player` preview (over 720p proxies) and the final `renderMedia` render. What you scrub is what renders. An ffmpeg "smart render" fast path for cut-only spans comes later as an optimization (S3+). |
| Milestone path | **Solid core, then auto-cut**: S2 ships scrub/split/trim/ripple/undo — enough to review and adjust AI cuts by hand — then S3 is auto-cut. Advanced manual tools come later alongside AI phases. |
| Storage | **User-chosen projects root** (settings-configurable; default `~/Videos/VidTSX Studio`). Source media referenced in place; each project folder holds `project.json` + caches. Folder-as-truth for project listing (no DB unless listing gets slow). |
| Transcription default | **Local whisper by default, AssemblyAI opt-in** (BYOK) recommended in the UI for best word-timestamp accuracy — the original cut pipeline was calibrated on AssemblyAI with verbatim disfluencies + keyterms. |
| Naming | Screen id `studio`, label "Studio". Was Coming Soon in production (Flows-style: nav visible, teaser screen) until the flip on 2026-09-10 (`docs/v1-completion-plan.md` §3.1) — `studio-editor: true` now, the teaser remains as the flag's off branch. |

## 3. What we reuse

### From VidTSX (direct reuse)

| Need | Existing machinery |
|---|---|
| Agent runtime, sessions, model/provider selection | `src/engine/` (`llmEngine`, `ClaudeProvider`, presets), `runLlmGenerate()` in `src/main/ipc/llm-handlers.ts` with `featureSource: 'studio'`, `useLlmProviders` for the picker UI |
| Editing-domain skills in prompts | `src/main/services/skills-registry.ts` + `resources/skills/` |
| Transcription (whisper.cpp local + AssemblyAI) | `src/transcription-engine/`, `src/main/services/whisper.ts`, `stt/` services |
| TSX shot generation | `src/shared/tsx-engine/tsx-generation-service.ts` pipeline (plan → generate → verify → transpile-fix) |
| Bundling & final render | `src/main/services/remotion-bundler.ts` (has the `@shared` alias our composition needs) + `remotion-renderer.ts` + render queue feature |
| ffmpeg / ffprobe | Remotion's binary via `RenderInternals.getExecutablePath` (pattern in `whisper.ts:311`, `frame-extractor.ts:35`) |
| Filmstrips, thumbnails, waveform inputs | `frame-extractor.ts`, `video-thumbnailer.ts`, `thumbnail-generator.ts` |
| Image generation | `src/image-engine/` + `src/local-image-engine/` |
| Video generation | `src/main/services/video-generation.ts` (fal) + `src/local-video-engine/` |
| Captions | `src/shared/captions/templates/` (6 finished caption compositions + word-timing utils) |
| Long-running job pattern | `src/main/services/tsx-jobs/tsx-job-engine.ts` (concurrency, abort, persistence, stream broadcast) |
| Scrub bar / transport UI | `src/features/player/components/Timeline.tsx`, `PlayerControls.tsx`; resizable panels from `MotionScreen.tsx` |
| Props → inspector controls | `src/features/editor/services/props-parser.ts` + `PropsPanel.tsx` |
| Downloads (SFX packs, models) | `src/main/services/download-manager/` |
| Usage/cost tracking | `aiUsageService.appendEntry({ featureSource: 'studio' })` |

### From claude-youtube-editor (ports, not dependencies)

| Asset | Disposition |
|---|---|
| `tools/cutlib.py` (174 lines, stdlib-only) — RMS noise floor, atoms, snap-to-audio tails, pause compression | **Port to TypeScript** in main process (`cut-planner.ts`). The single most valuable port. |
| `tools/format_transcript.py` — readable "takes" view for the agent | Port (small). |
| `tools/analyze_cut.py` / `verify_cut.py` concepts — QA report + second-ASR-pass verification | Port incrementally in S3 (verify pass can be a later hardening step). |
| `render_cuts.py` knowledge — NVENC segments, **MPEG-TS concat** (mp4 concat drifts ~10–16 ms/cut), **sample-exact audio built separately**, CFR re-stamp for the hevc_nvenc PTS drift | Encode into the S3+ ffmpeg fast-path renderer. Must add CPU fallback (libx264) — the original is NVENC-only. |
| `bake.py` — cutaway/overlay compositing with cumulative-rounding frame math | The frame math carries into `TimelineComposition`; the ffmpeg compositing shape into the smart-render path. |
| The 8 skills (`clean-cut`, `make-tsx`, `fake-screencast`, `vidtsx-2d-generator`, `clean-audio`, `suggest-sfx`, `packaging`, `brand-setup`) | Adapt into `resources/skills/` studio skills, phase by phase. clean-cut's editorial policy (cut the FIRST doubled phrase; spoken editing instructions outrank judgment; ASR-lies-about-time failure modes) is the crown jewel. |
| SFX/music library format (`palette.json` + `catalog.json` + `used_in`) and ElevenLabs generation | Adopt format in S5; generation BYOK. |
| Plan-file discipline lessons | Unified document + explicit units (see §4) fix the ms-vs-s and stale-clock hazards the original documents. |

## 4. The timeline document (foundation — everything depends on this)

Draft v1 types live in `src/features/studio/types.ts` and will migrate to
`src/shared/types/studio.ts` when main-process services need them (S1).

Principles:

1. **Single document, single clock.** All times are **seconds (float) on the project timeline
   or in source media**, never milliseconds, never frames. Frames exist only at the Remotion
   boundary via one conversion helper using cumulative rounding (`bake.py`'s
   `round(b·fps) − round(a·fps)` trick) so per-clip rounding never accumulates drift.
   claude-youtube-editor mixed ms/s across files and documented a stale-clock data hazard —
   we do not repeat that.
2. **Non-destructive.** Clips reference sources with `sourceIn`/`duration`; nothing re-encodes
   until export. Cut spans removed by auto-cut are recoverable (the proposal history keeps them).
3. **Provenance.** Every clip records whether a user or an agent (and which proposal) created it.
4. **Schema versioned** (`schemaVersion`) with explicit migration on open.

Shape (abbreviated — see types.ts for the authoritative version):

```
StudioProject
├─ schemaVersion, id, name, createdAt/updatedAt
├─ settings: { width, height, fps, agent: { providerId?, model? } }
├─ assets: MediaAsset[]        — referenced source files
│    { id, kind: video|audio|image, path, probe {duration,width,height,fps,hasAudio},
│      proxy? {path,status}, waveform?, transcript? {path, engine, hasWords}, hash? }
├─ timeline: { tracks: Track[] }
│    Track { id, kind: video|overlay|audio|caption, name, muted?, locked?, hidden?, clips: Clip[] }
│    Clip  { id, kind: video|audio|image|tsx|caption|sfx, assetId?,
│            timelineStart, duration, sourceIn?, speed?, gain?,
│            transform? {x,y,scale,rotation,opacity},
│            tsx? {filePath, mode: cutaway|overlay},
│            origin? {by: user|agent, proposalId?}, label?, note? }
└─ proposals: Proposal[]       — the audit gate
     { id, kind: cut-plan|sfx-plan|shot-plan, status: proposed|applied|rejected|partial,
       createdAt, agentNote, items: ProposalItem[] }   — items individually accept/rejectable
```

Semantics carried over from the original: a `tsx` clip on a `video` track = **cutaway**
(replaces picture, master audio continues); on an `overlay` track = transparent overlay.
Auto-cut output is a set of keep-segments on the main video track (ripple-applied), with the
cut spans + categories (`retake`, `false_start`, `filler`, `fluff`, …) living in the proposal.

### On-disk layout

```
<studioRoot>/                          user setting, default ~/Videos/VidTSX Studio
└─ projects/<slug>/
   ├─ project.json                     the document (debounced atomic writes)
   ├─ shots/                           generated TSX shot files (vN.tsx like the Creator)
   ├─ cache/                           disposable — proxies/<assetId>.mp4, waveforms/, transcripts/, filmstrips/
   └─ renders/                         exports (also registered in the render queue)
```

Folder-as-truth: the project browser scans `projects/*/project.json`. Source media is
referenced in place by absolute path + content hash for relink-when-missing.

## 5. Preview & render

**`TimelineComposition`** — a data-driven Remotion composition in `src/shared/studio/`
(reachable by both the renderer and the bundler via the existing `@shared` webpack alias, the
same route the caption templates use). It receives the serialized timeline + an asset URL map
via `inputProps` and lays out every clip as `<Sequence>`s: `<OffthreadVideo startFrom>` for
video, `<Audio>` for audio/SFX, `<Img>`, caption components, and lazy-loaded TSX shot modules.

- **Preview:** `@remotion/player` in the editor plays the composition with the asset map
  pointed at **720p proxies**, served over the existing local HTTP asset route (the bundler's
  express `/asset?path=` allowlist endpoint, or module-server) — not `file://`.
- **Export:** `renderMedia` on the same composition with the asset map pointed at originals.
  Runs through the existing render queue.
- **Proxies:** ffmpeg 720p H.264 per source asset, generated on import as background jobs
  (NVENC when available, libx264 fallback), with per-asset status in the document. Waveform
  PNGs and filmstrip strips generated alongside.
- **Smart render (S3+, optimization):** for export spans that are pure video cuts, extract
  segments losslessly-ish with ffmpeg (TS-intermediate concat, sample-exact audio) and only
  Remotion-render spans containing TSX/effects, then composite — the `render_cuts.py` +
  `bake.py` model. Gate on `ffprobe` v-duration == a-duration like the original.

Performance guardrails for the Player path: proxies only in preview, virtualized timeline
rows, canvas waveforms, rAF-driven scrub (pattern already in `player/Timeline.tsx`), and
measuring early with a 100+-cut timeline (S2 exit criterion). Fallback position if the Player
chokes on real-world timelines: HTML5-video seek-skipping preview — only with evidence.

## 6. The agent layer

- **Chat panel** in the editor (right side, collapsible) bound to the project. Provider/model
  picker reuses the existing provider config; choice stored in `project.settings.agent`.
- Agent requests run in main via `runLlmGenerate` with Claude Agent SDK sessions
  (`sessionScope: 'studio:<projectId>'`) and **typed tools**, e.g.:
  `get_timeline`, `get_transcript` (takes view), `get_asset_info`,
  `propose_cuts(plan)`, `propose_sfx(plan)`, `edit_timeline(ops)` (small direct edits),
  `generate_tsx_shot(spec)` (wraps the Creator pipeline), `search_sfx_library(query)`.
- **The audit gate is law:** bulk/destructive operations (cut plans, SFX plans) are proposals;
  the timeline renders them as color-coded regions with per-item accept/reject and category
  labels + the agent's notes; applying is one undoable transaction. Small explicit user asks
  ("split this clip at 12s") may apply directly but remain undoable.
- Editorial knowledge ships as **skills** (`resources/skills/studio-*`), adapted from the
  claude-youtube-editor skills, composed into the system prompt per task.
- Buttons and chat converge: the "Auto Cut" toolbar button invokes the same agent + tools as
  typing "cut the silences" in chat.

## 7. Feature module layout

```
src/features/studio/
├─ components/    StudioScreen (gate + browser + editor shell), ProjectBrowser, EditorLayout,
│                 MediaPool, PreviewPanel, TimelinePanel (tracks/clips/ruler/playhead),
│                 InspectorPanel, AgentChatPanel, ProposalReview
├─ hooks/         useStudioProjects, useTimeline (reducer + undo/redo), usePlayback, useProposals
├─ services/      (renderer-side pure logic) timeline-ops, time-math, snapping
├─ types.ts       document schema (v1 draft lives here now)
└─ index.ts       barrel

src/shared/studio/          TimelineComposition + serialization + time-math shared with main
src/main/services/studio/   project-store, proxy-generator, waveform-generator,
                            cut-planner (cutlib port), transcript-view, studio-agent (tools),
                            smart-render (S3+)
src/main/ipc/studio-handlers.ts + registrations/studio.ts · src/preload/api/studio.ts
```

House rules apply: no cross-feature imports (share via `src/shared/`), IPC-only bridge,
services own logic, ~300 lines/file, exact-pinned Remotion 4.0.435. Undo/redo via feature
context + reducer (no global store per CLAUDE.md; revisit only if it demonstrably hurts).

## 8. Phases

Each phase ends with something testable in dev builds. Production kept the Coming Soon
screen until `studio-editor` was consciously flipped on 2026-09-10 (V1 completion plan §3
step 5, outcome in §3.1 there).

- **S0 — Gate & scaffold** ✅ *(this commit)*: flags (`studio: true` nav / `studio-editor:
  false` body), sidebar item + screens entry, feature module skeleton with Coming Soon screen,
  draft schema in types.ts, this plan.
- **S1 — Projects & editor shell**: studio root setting; project browser (create with name +
  orientation preset 16:9/9:16/1:1 + fps, open/delete); project-store (folder-as-truth, atomic
  saves); CapCut-style editor layout (media pool / preview / inspector / timeline / chat panel
  placeholders); media import + ffprobe + thumbnails; per-project agent provider/model picker.
  *Test: create landscape + portrait projects, import media, relaunch, everything persists.*
- **S2 — Timeline core** ✅: document reducer + undo/redo; tracks/clips UI (ruler, zoom, snap,
  playhead, select/move/split/trim/ripple-delete); `TimelineComposition` + Player preview;
  proxy + waveform background jobs; export through the render queue.
  *Test: manually cut a talking-head video end-to-end and export it; scrub a 100-cut timeline
  smoothly (the Player-architecture checkpoint).*
  **Checkpoint result: the Remotion-Player architecture holds — no HTML5-seek fallback needed.**
  Measured on a 100-cut timeline over 720p proxies (dev build, dev server running, so numbers
  are noisy run to run):
  - Playback: 16.7 ms median frame (60 fps), identical to a 2-clip timeline.
  - Scrub at natural drag speed (~0.1 s of media per frame): 17–25 ms median (~40–60 fps).
  - Scrub flinging across the whole timeline (~0.5 s per frame, crossing a cut nearly every
    frame): 25–35 ms median (~30–40 fps).
  - The editor's own JS is ~1.4 ms per scrub step; everything above that is Player/video work,
    so the ceiling is decode, not the timeline UI.

  Two fixes got it there, both worth keeping in mind for S3+:
  1. Proxies need a short GOP (`-g 15`). With the encoder default (~8 s between keyframes)
     every seek decoded up to 250 frames and scrubbing sat at ~20 fps.
  2. `TimelineComposition` mounts only clips within ±2 s of the current frame. Mounting all
     100 `<Sequence>`s on every frame change roughly halved scrub throughput.
- **S3 — Auto-cut** (first AI feature): word-timestamp transcription on import (whisper
  default / AssemblyAI opt-in, keyterms support); cutlib port; `studio-clean-cut` skill; agent
  chat + tools; proposal review UX on the timeline; ripple-apply; QA readouts (dead-air,
  clipped-tail warnings). ffmpeg smart-render fast path for cut-only exports.
  *Test: raw multi-take recording → auto-cut proposal → audit → apply → export; A/V sync
  verified at the last cut (ffprobe duration gate).*
- **S4 — TSX shots**: generate cutaway/overlay shots via the Creator pipeline synced to word
  timestamps (`studio-make-tsx` skill); shots preview natively on the timeline; edit/regenerate
  round-trips; screenshot-based shots later.
- **S5 — Audio**: SFX library (palette/catalog format) + `studio-suggest-sfx` agent proposals
  with per-cue audition; music beds with sidechain ducking; denoise (clean-audio decision
  table: dynamic noise → ElevenLabs isolator BYOK, stationary → RNNoise/arnndn); captions from
  the existing templates driven by the transcript.
- **S6 — Visual assets**: image generation (imageEngine) and video generation (fal/local) as
  timeline clips; asset library integration; b-roll workflows.
- **S7 — Pro polish & packaging**: transitions, keyframed transforms/effects, export presets
  (per-platform), title/thumbnail packaging skill, project archiving/relink tooling.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Remotion Player perf on long, cut-heavy timelines | Proxies-only preview; S2 exit criterion is an explicit 100-cut scrub test **before** we invest in S3+; documented HTML5 fallback. |
| whisper word-timestamp quality hurts auto-cut edges | Default whisper but recommend AssemblyAI in UI; cutlib's RMS snap-to-audio makes edges robust to modest timestamp error; keep the token-time-fix override concept. |
| A/V drift in ffmpeg fast path | Port the *lessons*, not just the code: TS-intermediate concat, sample-exact audio, CFR re-stamp, ffprobe duration gate. Full-Remotion export (S2) is the always-correct reference path. |
| NVENC assumptions (original is NVENC-only) | Every ffmpeg invocation gets a libx264/CPU fallback; encoder sniffing pattern already exists in `remotion-renderer.ts`. |
| Timeline UI scope creep | S2 tool set is fixed (scrub/split/trim/ripple/undo); everything else is explicitly later. |
| Schema regret | `schemaVersion` + migration-on-open from day one; proposals keep enough data to reconstruct. |
| Huge media on C: | User-chosen studio root; caches clearly disposable under `cache/`. |

## 10. Out of scope for now

Multi-cam, collaborative editing, plugin system, cloud rendering, macOS binaries validation
(follow the app-wide Windows-first stance), publishing/upload integrations (packaging skill
covers metadata only).

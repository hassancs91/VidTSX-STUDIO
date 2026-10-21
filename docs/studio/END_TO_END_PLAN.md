# End-to-end plan — raw files to the finished video, inside Studio

> Written 2026-10-21 from Hasan's brief: **"I open the Studio, create a new project, add raw
> video files, tell the agent to start, it cuts, then I tell it to add visuals and animations,
> it uses the TSX generator and other models, and finalizes the video."** Editing only —
> packaging, thumbnails, upload and Notion are OUT of scope by his call the same day.
>
> Same pattern as `RECORDER_DESIGN.md` / `TSX_BUILDER_DESIGN.md`: verified facts first, then the
> decisions, then the build order with a measured exit per part, then the checklist. Facts marked
> **[verified]** were read from the code on 2026-10-21 (five read-only passes, spot-checked).
> Facts marked **[spike]** are expected but not measured in our runtime; the part that needs
> them measures them before building on them.
>
> **Rev 1 — 2026-10-21, DECIDED.** Hasan answered the nine questions in §4 before this doc was
> written ("go recommended" on 3, 5–8; his own words on 1, 4, 9) and added three items: parallel
> shot builds, "make the agent read everything as if I am here in Claude Code", and the folds
> into the 4K and cut tracks. The Recorder stays "later". **The build has NOT started.**
>
> The measuring stick is **video-14** ("build desktop apps with Claude Code", 8:05.7, 55 shots,
> 20 of them splits), which exists twice: the locked edit imported into
> `~/Videos/VidTSX Studio/projects/video-14` (3840×2160 @ 60, V1 = the locked master, 55 editable
> shots) and the nine raw DJI clips in `D:\repos\claude-youtube-editor\videos\video-14\raw\`
> (12.4 GB) with the hand-audited cut `work/analysis/cuts.json` beside them. Every exit below is
> measured against one of those two, never against a demo clip.

---

## 0. The one property that must survive

"End to end inside Studio" is six measurable things. Each track below owns one:

| # | Property | How it is measured | Target |
|---|---|---|---|
| E1 | **A 4K60 export completes and is in sync** | a 30–60 s range of the locked video-14 across one split and one cutaway, Standard and Fastest, then the A/V check | both finish; median A/V offset ≤ 25 ms, drift ≤ 40 ms over the span; frames match the editor's preview at the same seconds |
| E2 | **The cut lands where Hasan's hand audit landed** | Auto Cut + editorial on the nine raw clips vs `cuts.json`; join geometry at every cut vs his fitted style | hard entries 0; median lead-in / tail at joins within ±30 ms of the fitted tight; content overlap reported, bar set after the first run (§3 B6) |
| E3 | **Every video-14 shot shape is expressible, splits included** | three split rows rebuilt as Studio-native splits and compared with the editor's bake | hole within 4 px at 1080p; the speaker through the hole; nothing of the master outside it |
| E4 | **Voice cleanup keeps levels and sync** | RMS before/after; the audio-offset instrument on the cleaned track | RMS within ±0.5 dB; offset ≤ 5 ms after compensation; the export carries the cleaned audio |
| E5 | **A generated sound is found before it is regenerated** | the agent asked for a sound that exists in the imported library | placed from the library, no generation call; a generated one appears with duration, tags, loudness, and plays |
| E6 | **N shots build at once without the app falling over** | four Act-1 shots in one batch at N = 2 | wall time < 60 % of serial; no crash; RAM peak recorded |

And one thesis, which decides half the rows below:

> **Nothing Hasan does by hand in the editor repo stays there.** The knob values he fitted on
> 2026-10-15, the review rules he wrote across four videos, the SFX library he grew, the
> de-reverb recipe his room needs — each becomes a thing the Studio owns and the assistant can
> read. The editor repo stops being the source of truth for how his videos are cut.

---

## 1. Verified facts (2026-10-21)

### 1.1 The cut [verified]

- `CutPlanStyle` has eight fields: `internalGap, head, minTail, maxTail, margin, softGap,
  softMaxTail, softMargin` (`src/shared/types/studio-cut-plan.ts:15-29`). Two named styles,
  `tight` and `natural`, are **code constants** (`src/shared/studio/cut-planner.ts:36-52`): tight
  = head 0.11 / minTail 0.14 / maxTail 0.4 / margin 5 / softGap 1.2 / softMaxTail 0.6 /
  softMargin 3; natural = head 0.19 / minTail 0.26 / maxTail 0.45. These are the reference
  repo's **pre-October** values (`.claude/skills/clean-cut/SKILL.md:101-116`).
- The snapper walks the tail only: `snapTail` (cut-planner.ts:120-126) steps 0.02 s from
  `minTail` and stops at the first window ≤ floor + margin. **There is no `snapHead`, no ZCR,
  no `maxHead`, no `minSkip`** (grep over `src`: zero hits). Lead-in is the fixed `head`
  (`planClip` :204-205). The envelope reads the waveform cache's per-bucket dB values
  (:83-127); it never sees samples.
- Who picks the style: the Auto Cut button is a session-state picker defaulting to `tight`
  (`TranscriptSection.tsx:254, 267-270`); the IPC defaults to `tight`
  (`studio-handlers.ts:460-465`); the agent's `run_auto_cut` takes `style?` and defaults to
  `tight` (`agent-tools/workflow-tools.ts:130-145`). The editorial pass calls
  `snapEditorialCuts` **without a style** → `natural` with pause compression off
  (`cut-tools.ts:56-62`, `cut-snap.ts:164-165`). Transcript-tab deletes also snap with
  `natural` (`text-delete.ts:148-154`); a missing envelope becomes silence, so every tail =
  `minTail` (:137-142).
- The preset's `pacing` (`tight|normal|relaxed`) and `auto_cut.aggressiveness` **reach no
  snapper**: `pacing` appears only as prose in the preset prompt (`agent-preset-prompt.ts:47`)
  and as an inference in `preset-learn-stats.ts`; `aggressiveness` only in
  `preset-workflow-lines.ts`. There is no mapping code.
- Hasan's fitted tight for video-14 (`videos/video-14/work/analysis/cuts.json` → `styles.tight`):
  `internal_gap 0.4, min_tail 0.08, max_tail 0.7, head 0.15, max_head 0.3, min_skip 0.12,
  margin 12.0, soft_gap 99.0, soft_max_tail 0.6, soft_margin 6.0, fric_zcr 3500, fric_margin
  5.0`; natural = `min_tail 0.26, max_tail 0.45, head 0.21, margin 6.0, soft_gap 1.2,
  soft_max_tail 0.7, soft_margin 3.0`. `soft_gap 99` disables soft landings in tight.
- The three October knobs, from `tools/cutlib.py`: **`zcr(t, win 0.03)`** = zero crossings per
  second (:77-86; voiced ~1–2 k, fricatives 4–12 k); **`snap_tail`** keeps walking while the
  level is above floor + `fric_margin` AND zcr ≥ `fric_zcr` (:88-109; a weak final "th" sat
  below floor + 12 and "path" played as "pa-"); **`snap_head`** walks back from the word start
  while the level is above floor + margin (or still a fricative), up to `max_head`, and returns
  at least `head` and at most `max_head`, onset + 30 ms (:111-127; "Every" began 0.16 s before
  its token); **`min_skip`** merges consecutive keeps closer than it when no cut lies between
  (:213-222; a 50 ms ASR token over a 0.4 s "whyyy" left a 60 ms hole). QA that gates a plan:
  `analyze_cut.py` **hard entries** (at a join, RMS 60 ms before the start minus floor > 15 dB,
  :40-55) and **clipped tails** (level at the tail end minus floor > 6 dB). video-14's QA report
  reads "Hard entries: 0". The fitting method is in the clean-cut skill (:104-110): sweep `head`
  against the hard-entry count, smallest value reaching zero.
- Review signals: a cut region's edges can be dragged on the timeline before applying
  (`CutRegionLayer.tsx:123-161`); the drag **overwrites** `sourceStart/End` and sets
  `adjusted: true` (`proposal-ops.ts:54-68`). `StudioProposalItem` keeps no original span
  (`studio.ts:302-326`). Learn-from-video counts `cutItemsAdjusted` as a boolean tally
  (`preset-learn-stats.ts:124`); **no stat captures where the user put the edge.** Transcript
  deletions are derived state ("Deletions are never state", `transcript-doc.ts:5-7`) and apply
  directly with one undo, no proposal (`text-delete.ts:10-11`); a later trim is
  indistinguishable from the delete.
- The Transcript tab is behind `studio-text-edit: false` (`feature-flags.ts:73`): on in dev,
  hidden in production; STATUS 2026-09-17 lists it as not verified on a long project, on
  AssemblyAI transcripts, or by ear.

### 1.2 Presets, memory, skills [verified]

- Presets live as user copies: `<assetsRoot>/presets/<id>/preset.json + PRESET.md` (+ optional
  `skills/<id>/SKILL.md`), built-ins seeded once from `resources/presets/` and then edited in
  place (`preset-store.ts:25-32`, `preset-builtins.ts:43-81`). `StudioPresetStyle` holds eight
  knobs (`studio-preset.ts:16-25`); `StudioPresetKnobKey = keyof StudioPresetStyle` (:146) —
  **only those can be learned**. `applyPresetLearning` (preset-store.ts:153-176) patches
  `style`, appends to PRESET.md and pushes a `learned[]` entry (cap 20). The learn card is one
  pending proposal per project (`agent-preset-proposals.ts:24-26`); accept re-applies the
  knob changes over the preset as it is now (`preset-learn-handlers.ts:61-97`).
- The preset block is injected as `middleSystemPrompt` under a 4000-char budget
  (`agent-preset-prompt.ts:85-110`); order = skills → preset → memory
  (`skills-registry.ts:140-168`).
- Memory: rules ≤ 300 chars, 50 active, 7000-char block, app-wide or per brand
  (`studio-memory.ts:124-147`); `propose_memory` → card → `upsertMemory`
  (`memory-handlers.ts:111-140`); injected last as `trailingSystemPrompt`.
- Skills: ONE directory, `resources/skills` (packaged: `<resources>/skills`)
  (`utils/paths.ts:114-119`); **no user skills folder, no override by id**. Resources beside
  `SKILL.md` are listed and readable by `readSkillResource` (:166-187) but **never injected and
  never read by any agent tool** (`docs/SKILLS.md:135`). `AGENT_SKILL_IDS = studio-clean-cut,
  studio-make-tsx` (`studio-agent.ts:30`). `studio-clean-cut` is a faithful port of the
  reference clean-cut policy (slates outrank, always cut retakes, doubled phrase cuts the
  first, fluff suggest-only, the transcript lies about time) plus two rules of its own; it
  carries no knob values ("the snapper adds lead-ins and decay tails itself").

### 1.3 Shots, the transform, the kit, the assistant's reach [verified]

- `StudioClipTransform = { x?, y?, scale?, rotation?, opacity? }` (`studio.ts:94-100`).
  **No crop, mask, clip-path or radius on clips.** It becomes
  `translate() scale() rotate()` + opacity on the media element
  (`ClipRenderer.tsx:47-58, 155-163`), the same code for preview and export. `updateClip`
  merges field-wise through `TRANSFORM_KEYS` derived from `TRANSFORM_NEUTRAL`
  (`clip-update-ops.ts:30-37, 50-103`) — a new field is silently dropped unless added there.
  Inspector: opacity, X/Y, scale, rotation (`ClipSection.tsx:190-234`); CanvasOverlay: drag to
  move, four corners to scale (`CanvasOverlay.tsx:281-299`).
- How the video-14 import expressed a split: cut V1 at the span and set `transform` from the
  box + crop centre + zoom (`projects/video-14/notes/import/v14-model.mjs:62-81`
  `pipTransform`, `build-video14.mjs:133-144`). Exact only while the shot is opaque outside
  the hole; with video-14's box the scaled master is 747×420 design px, so a shot transparent
  outside the box shows master where the editor's bake shows black
  (`CAPABILITY_GAPS.md:323-327`). The editor's `PipHole` (`remotion/src/lib/pip.tsx:62-112`)
  is a CSS `mask-image` evenodd rounded rect (radius 24), a bezel ring, and a grow-in over 8
  frames; `bake.py:336-358` crops the master INTO the box over black and lays the alpha shot
  on top.
- `StudioShotKind = 'cutaway'|'overlay'|'title'` (`studio.ts:201`); the agent tool enum
  matches (`shot-tools.ts:39`). The background rule by kind (`shot-build-request.ts:81-90`):
  cutaway = opaque root, anything else = no root background. The builder's "looks" composite a
  transparent shot over the **plain contain-fit master** (`look-backdrop.ts:39-74`,
  `shot-generator.ts:348-350`) — never cropped or transformed, so a split's looks would show
  the uncropped master through the hole.
- Kit: `@vidtsx/kit` = EASINGS, TypedText, GenericWindow, TerminalWindow, StatBlock,
  BrowserWindow, Marker/Ring, VSCodeWindow, CodeEditorPane, ImageViewerPane, AgentFeed,
  AgentInputDock, KitIcon (`resources/shot-kit/core/MANIFEST.md`, pack 1.0.0). The builder's
  `check` **inlines the kit into the artifact** (`build-check.ts:92-93`); the write-once pin
  `<project>/kit/<version>/` matters for imported shots. Adding a component = file +
  `index.tsx` export + MANIFEST section + pack bump.
- Library limits were lifted at the bundle step, not the lint: `EXTERNAL =
  /^(react|remotion|@vidtsx\/kit)$/` (`shot-bundle.ts:36`, exact match); every `@remotion/*`
  and every `remotion/<subpath>` is a "builder library" and gets **inlined**
  (`builder-libraries.ts:113-118`); the lint still allows only the three externals and rejects
  subpaths (`shot-lint.ts:12, 87-90`) — it runs on the bundled artifact, so it only ever sees
  them.
- The Studio assistant runs with **no SDK built-in tools**: `allowedTools` = the 31
  `mcp__studio__*` tools, no `cwd`, no `canUseTool`, no `agentTools`, no `sessionScope`
  (`studio-agent.ts:108-124`); history is replayed as one text prompt
  (`claude-provider.ts:93-98`); a scope-less request is a one-shot `claude.exe` torn down after
  the answer (:208-215). Hot sessions keyed by `sessionScope` exist (MAX 8, idle 120 s,
  :44-53); no SDK `resume` anywhere.
- The Agents feature already does the file-tool pattern: `cwd = workspaceDir`, `canUseTool =
  createFileToolGuard(workspaceDir)`, `agentTools` = Read/Write/Edit/Glob/Grep, and **those SDK
  tool names stay OUT of `allowedTools`** because bare names auto-approve before the guard
  (`agent-runner.ts:202-230`, verified against SDK 0.3.286). The builder uses the same guard
  inside its work folder (`tsx-builder.ts:36, 191-200`). The guard denies any other tool and
  anything outside the root after `realpath` (`file-tool-guard.ts:24-96`).
- Notes: `<project>/notes/*.md`, 200k chars, written by the UI
  (`studio-notes-handlers.ts` list/read/write/delete); the agent's `list_notes`/`read_note`
  are **read-only by design** (`notes-tools.ts:1-4`). No agent tool sets speed, sourceIn,
  transform or crop on a clip; everything lands as a proposal (`agent-tools/*.ts`,
  `studio-agent.ts:3-6`).

### 1.4 Builds and concurrency [verified]

- One serialization point: `canStart` returns `runningCount() === 0`
  (`tsx-job-engine.ts:250-256`; `maxConcurrent = 4` at :53 is dead for builds). Every
  shot operation is one build job (`shot-generator.ts:5-13`). **No global bundle state is
  left**: each bundle is served under its own URL (`build-stills.ts:12-14`,
  `remotion-bundler.ts:63-65`), per-run dirs and guards (`tsx-builder.ts:59, 110, 226`); the
  §7 concurrency note in `TSX_BUILDER_DESIGN.md:1439-1440` predates this.
- Stills: one bundle per look call (cached when the entry is unchanged), then sequential
  `renderStill` per frame in a fresh page, 120 s timeout (`build-stills.ts:134-243`). GL
  backend probed once per app run. Other ceilings: 8 `claude.exe` sessions
  (`claude-provider.ts:48`); one assistant turn per project (`studio-agent.ts:41`); ffmpeg
  media jobs 2 (`media-jobs.ts:58`).
- The agent pass: `SHOTS_PER_PASS_CAP = 10` (`shot-proposal.ts:8`), the 11th generate in a turn
  is refused (`shot-tools.ts:58-59`); `AGENT_MAX_TURNS` 64.
- Cost on this PC (`TSX_BUILDER_DESIGN.md`): first bundle 54 s, later 16–25 s, a look round
  15–50 s (:448); a 5 s Studio cutaway at Standard ≈ 1.0 min, $0.64 API-eq (:999); Refine
  48 s (:825); edit at Standard 76 s (:833). **No RAM figure for a build is recorded**; the
  only RAM record is the 2026-08-19 raw-footage run that died at 95–99 % RAM with two
  `claude.exe` runs plus proxies (`raw-footage-test-report.html`, Findings).

### 1.5 The audio path, the job engine, the engines (voice cleanup) [verified]

- Media jobs: `StudioMediaJobKind = proxy|waveform|transcript|faceTrack|subjectMask`
  (`src/shared/ipc/types/studio.ts:263`); `maxConcurrent = 2`; id `${projectId}:${assetId}:${kind}`;
  a job is skipped when its cache file exists unless `force`; `exclusiveRunning` serializes
  transcripts (`media-jobs.ts:58-194`); `produce()` is a per-kind switch (:222-277) and
  `relPathFor()` a second one (:28-33). Outputs under `<project>/cache/` (`studio-paths.ts:13-26`).
  Events broadcast on `studio:media:job-event`; the renderer patches `proxy`/`waveform`
  cache files on the asset through `withCacheFile` (`useStudioMedia.ts:72-146`,
  `asset-patch.ts:29-38`, typed to those two kinds). `waveform-generator.ts` is the minimal
  job template (ffmpeg at below-normal priority, write to cache, return relPath).
- **Picture and sound come from the ONE `src`** of a video clip: `<OffthreadVideo src
  trimBefore volume muted playbackRate>` (`ClipRenderer.tsx:138-176`), `src` resolved once per
  clip (`serialize.ts:299`) — the proxy in preview (its audio a 128k AAC re-encode,
  `proxy-generator.ts:111-113`). The Standard engine renders audio in the same Remotion pass
  (`remotion-engine.ts:34, 64`). The two copy engines build the audio from
  `planExportAudio` → ffmpeg: `clipAudibles` sets `assetPath: asset.path` at
  **`export-audio.ts:125`**, the single place a substitute per asset plugs in for them.
  `verify.ts:34-36`: one audio pass shared by both files. So a cleaned track must reach BOTH
  the serializer and `planExportAudio`.
- `detachAudio` is a pure document op (clone to an audio clip, mute the video clip,
  `clip-update-ops.ts:153-201`); no files. Transcription extracts 16 kHz mono WAV with
  Remotion's ffmpeg (`stt/extract-audio.ts:35-86`).
- ElevenLabs: generation provider at `https://api.elevenlabs.io/v1`, header `xi-api-key`,
  routes `/sound-generation` and `/music` (`elevenlabs-audio-provider.ts:23-80`); STT provider
  posts multipart to `/speech-to-text` (`transcription-engine/providers/elevenlabs-provider.ts:97-130`).
  Keys: DPAPI via `safeStorage`, has-key booleans only to the renderer
  (`provider-keys-handlers.ts:26-68`, `settings-db.ts`). **No `/v1/audio-isolation` call
  exists** (grep: zero hits; mentioned only in `NEXT_FEATURES_DESIGN.md:940` and
  `docs/studio/PLAN.md:241`).
- ffmpeg: the shipping binary is Remotion's stripped compositor build
  (`ffmpeg-bin.ts:7-15`); known gaps: no HW encoders, no raw s16le muxer, no `volumedetect`.
  **Whether it has `arnndn`, `afftdn`, `highpass` or `astats` is verified nowhere** [spike].
  The optional full build is BtbN `ffmpeg-n8.1.2-50-g1a748fe2cd-win64-gpl-shared-8.1.zip`
  (80.1 MB, SHA pinned) under `%APPDATA%/VidTSX Studio/ffmpeg-full`, Windows-only
  (`ffmpeg-full.ts:32-109`); the two copy engines use it.
- The reference recipe, `tools/clean_voice.py` (162 lines): extract mono 44.1 kHz WAV →
  `eleven` (POST `/v1/audio-isolation`, ~1000 credits/min) or `rnnoise`
  (`highpass=f=90,arnndn=m=<model>.rnnn`, run with `cwd` set because `:` and `\` break the
  filtergraph on Windows) → **RMS-match** by `astats` ("RMS level dB", gain = src − cleaned,
  peak cap −1 dBFS, explicitly not LUFS) → remux with the video stream copied, drift warning
  > 0.15 s. It does **not** compensate arnndn's fixed 480-sample latency; the memory record says
  a separate `rnnoise_final.py` did (xcorr-measured) and is not in the repo. Models in
  `tools/models/rnnoise/`: `cb.rnnn` (300 KB) and `sh.rnnn` (298 KB) are real; **`bd.rnnn` is
  a 14-byte "404: Not Found"**. The de-reverb recipe is in memory only
  (`room-echo-dereverb.md`): `dereverb_mel_band_roformer_mono_anvuew.ckpt` through
  `audio-separator` 0.47 on torch 2.14.1 + cu130, venv `C:\Users\hasan\venvs\dereverb`, MONO
  required (stereo variants return the dual-mono lav unchanged), 8 min ≈ 8:40 on the RTX A3000
  6 GB, ~55 min CPU, then RNNoise `sh` as a second pass; **the exact weights URL is not
  recorded anywhere** [open].
- Python runtime: a catalogue model declares `id, category ('image'|'3d'), pipeline
  (`rembg`|`triposr`), runtime pytorch, files[] (original-host URLs + sha256), vramMb (null =
  never GPU), cpuOk, capability {inputs [{kind:'image'}], outputs}` (`python-models/registry.ts:21-68`);
  **no per-model pip requirements** — dependencies come from the frozen runtime
  (`ai-runtime/catalogue.ts`: `2026.09.1`, cu126 2.76 GB zip / 4.6 GB on disk, cpu 280 MB,
  built by `scripts/ai-runtime/build-stack.ps1` from `requirements.in`; the lock has
  onnxruntime, rembg, scipy, **no audio-separator / librosa / soundfile / torchaudio**).
  `runPythonModel` is the one entry point, one worker at a time, `requestDir` + JSON-lines
  protocol, provenance sidecar (`service.ts:115-308`, `python-runner.ts:102-106`,
  `resources/pipelines/<pipeline>/runner.py`). Inputs are typed image-only (`service.ts:49`).
  `preflight.ts:48-59` picks cu126 on NVIDIA + driver ≥ 525.60 + VRAM ≥ 4 GB.
- UI surfaces: per-asset hover actions Add / Transcribe / Remove (`AssetHoverActions.tsx:23-83`)
  and a context menu (`MediaPool.tsx:84-93`); the Inspector's asset section is
  `TranscriptSection.tsx` (STT model select + Transcribe) — the template for a cleanup
  section; the optional-download row pattern is `ProxyGpuEncoderRow.tsx`.

### 1.6 The library and generated audio (SFX) [verified]

- `LibraryIndexEntry` is the only per-asset record: `relPath, hash?, description?, brandId?,
  origin ('imported'|'generated'|'captured'), addedAt, probe?, size?, mtimeMs?`
  (`asset-library.ts:17-37`). **No `kind`, no `tags`, no `duration`, no `usedIn`.** `probe` is
  **never written** (`upsertEntry`, `library-store.ts:138-170`; reconcile clears it), so
  `list_assets(scope:'library')` never shows a duration (`project-tools.ts:59`). Kind is
  derived from the extension in two places that disagree on `.opus`
  (`media-import.ts:38-44`, `features/asset-library/services/file-type.ts:3-19`).
- Describe is vision-only (`describe-asset.ts:22-76`); audio gets no description. The Assets
  screen filters by category + free text over name and description (`asset-search.ts:12-52`);
  **no filter by origin, brand or tag; no audio playback** (`AssetTile.tsx:37` icon only;
  `AssetDetailsPanel.tsx:69-82` previews images and GLB).
- `generateAudioAsset` (`generate-audio-asset.ts:79-124`): engine → `generated/` →
  description = prompt → filename `${kind}-${slug}` → `upsertEntry(origin 'generated',
  description, brandId)`. **No ffprobe, no loudness, no tags**; `durationSeconds` is the
  requested length or a CBR estimate. ElevenLabs: `/sound-generation`
  (`eleven_text_to_sound_v2`, 0.5–30 s, $0.12/min) and `/music` (`music_v2`, 3–600 s,
  $0.15/min); MP3 only. Studio tools `generate_sfx` / `generate_music`
  (`audio-tools.ts:81-136`) also import the file into the project and return
  `library:<relPath>`; `insert_asset` places a `library:` audio ref on an audio lane with
  `gain` (`insert-tools.ts:36-133`) — clip kind `'audio'`, never `'sfx'`, **no fades**
  (`apply-insert-proposal.ts:46-59`). The prompt tells the agent to list the library before
  generating **b-roll** only; **no reuse-before-generate rule exists for sound**
  (`studio-agent-prompt-tools.ts:21, 69-75`; `studio-make-tsx/SKILL.md`: zero sfx mentions).
- Timeline: clip kind `'sfx'` exists and is treated as `'audio'` everywhere; `'sfx-plan'` is a
  label with no builder, runner or apply path (G4 in `CAPABILITY_GAPS.md:119-127`).
- Hasan's library: `media/library/sfx/catalog.json` = **45 clips** (41 ElevenLabs + 4 synth
  chords) with `id, file, category (motion/tension/emphasis/snap/foley/reward/texture/impact),
  tags[], duration_s, peak_dbfs, loudness_lufs (−20 target), source, model, license, prompt,
  used_in[]`; `palette.json` = 41 recipes + `defaults {prompt_influence 0.45, target_lufs −20,
  ceiling_dbfs −1.5}`; `media/library/music/` has its own catalog + 6 clips. `gen_sfx.py`
  normalizes to the target LUFS under the peak ceiling and preserves `used_in`. `brand.md` §10
  gains: payoffs −5/−6, transitions −6/−8, beds −9/−11; duck ~4 dB. The suggest-sfx skill's
  library-first rule and USER-AUDIT gate are its §41-45 and §65-66.

### 1.7 Project format, export, the 4K failure, verify, proxies, fonts, temp [verified]

- New Project offers three tiles, 1920×1080 / 1080×1920 / 1080×1080, fps 24–60
  (`NewProjectDialog.tsx:17-23`); the shared list it does not use already has `4k 3840×2160`
  (`features/studio/services/project-format.ts:26-31`, max dimension 7680). Project settings
  edits width/height straight into the document, **not undoable**, and nothing else reacts
  (`ProjectFormatFields.tsx:20-54`). Since commit `1d5f1d6` a shot whose config differs from
  the project rides `ShotTimebase` (own clock `floor(f × shotFps / compFps)`, own
  `useVideoConfig`, scaled-to-fit box; `src/shared/studio/shot-timebase.ts`, wired in
  `serialize.ts:313` and `ClipRenderer.tsx:250-258`, 160-line test), and `/asset` serves
  fonts and data in preview and export (`asset-route-extensions.ts`).
- Export: quality best/high/medium/low = CRF 15/18/23/28 (`render-presets.ts:47-52`);
  **`EXPORT_RESOLUTION_PRESETS` = 720p / 540p / 360p only** (:85-89), so a 3840×2160 project
  offers Full, 720p, 540p, 360p and **no 1080p**; never-upscale drops presets ≥ the
  composition (:133-135). Range export trims the timeline and overrides the frame count
  (`studio-handlers.ts:482-499`). Standard concurrency = Settings › Rendering default CPU:
  low 25 % / medium 50 % (default) / high 75 % / max (`render-cpu-usage.ts:10-15`), passed to
  `renderMedia({concurrency})`; `hardwareAcceleration 'if-possible'`, x264 `veryfast`.
- Fastest (`shot-composite-engine.ts`) copies plain-cut footage and renders only the shot
  layer with alpha (ProRes 4444, `shot-layer-render.ts:1-15`), overlaid by ffmpeg; it and
  Fast need the full ffmpeg plus a probed NVENC/QSV/AMF encoder (`passthrough-engine.ts:56-98`).
  **Browser spans** (rendered in Remotion, not copied) include any non-identity transform
  (`export-spans.ts:189`), live filters, letterbox, transitions — so video-14's 20 PiP spans
  render in the browser under either copy engine.
- **The failure.** `@remotion/google-fonts` imports `remotion/no-react`; that subpath is not
  external (exact-match regex) and is a "builder library", so **every one of the 55 video-14
  shot bundles carries a full copy of `remotion/no-react`**. `shot-bundle-finish.ts:108-125`
  moves the bundle body into a lazy `__vidtsxInit()` that runs on first render, and the
  copy's top-level block — Remotion 4.0.435 `no-react.mjs:139-146`:
  `window.remotion_delayRenderHandles = [];` — now runs **mid-render** (in
  `shots/v14-a1-nobody/v1.tsx` it sits at :982 inside `__vidtsxInit()` at :34). `delayRender`
  pushes into that array and readiness is `length === 0` (`index.mjs:420, 472, 492`), so the
  export entry's `'brand fonts'` hold (`export-entry.ts:322-336`, `BRAND_FONT_WAIT_MS` 8000)
  and any shot's own hold are orphaned → timeout. The preview serves one shared copy at
  `/virtual/remotion.js/no-react` (`module-server.ts:131-134`), but a bundled shot carries the
  inlined copy there too (effect in the Player unmeasured). Version skew: the inlined
  google-fonts code is the editor's 4.0.486 against the app's 4.0.435.
- The 2026-10-16 attempt: Standard engine, 82–102 s, 3840×2160 @ 60, 1200 frames, CPU 25 %,
  cancelled by the user at 171 frames after 607 s (`notes/import/range-082-102.json`, app log
  19:05:54–19:06:01Z: entry + bundle fine, then no failure line).
- Verify: hidden dev mode (`run-export.ts:57-60`: not packaged or `VIDTSX_EXPORT_VERIFY=1`,
  plus a localStorage flag); re-exports through a second engine and measures per-frame diffs
  at first/last/thirds/every cut, audio offset candidate-vs-reference and
  **candidate-vs-the first clip's camera file** (`verify.ts:68-101`, `audio-offset.ts`: 48 kHz
  mono, 1 s windows, ±120 ms, normalised xcorr). **Report only, no pass/fail.** The editor's
  `verify_sync.py` is differential (audio window located in the source by xcorr, the frame
  located by z-score within ±0.8 s of where the audio says, sync error = video − audio) and
  passes iff median |offset| < 25 ms and |drift × span| ≤ 40 ms, needs ≥ 3 confident probes.
- Proxies: NVENC path measured 60 s of 4K60 HEVC → 540p in **12 s vs 91 s x264**
  (`proxy-encoders.ts:7-12`); `proxyGpuEncoderEnabled` has **no default → off**
  (`settings.ts:295-297`); one failure latches x264 for the session.
- Fonts: proxy cache `%APPDATA%/VidTSX Studio/font-cache`, miss → upstream fetch, **502 on
  upstream failure** (`font-proxy.ts:56-87, 173-179`), registered on both the preview and the
  export server; brand fonts are prefetched on brand save (`brand-fonts.ts:68-75`), **shots'
  `@remotion/google-fonts` loads are not warmed** — `projects/video-14/notes/import/warm-fonts.mjs`
  fills that by hand (Space Grotesk, Inter, JetBrains Mono, Spectral, with `--check`).
- Temp: entries in `<appRoot>/.vidtsx-temp/studio` (24 h sweep); export scratch
  `%TEMP%/vidtsx-studio/export/<jobId>` removed after every run; Remotion's own
  `%TEMP%/remotion-v4.0.435-assets*` copy of every source is swept at startup when older than
  1 h, and on cancel only **empty** trees are removed (`run-export.ts:196-236`) — the cancelled
  3.77 GB folder was left behind. **No disk-space preflight for exports** (the only `statfs` is
  the AI-runtime installer).

### 1.8 Machine and material [verified 2026-10-21]

- Disk: C: 27.8 GB free (Studio projects, caches, temp live there); D: 7 GB free (the repos
  and the 12.4 GB of raw video-14 clips). Studio projects: video-10 1.0 GB, video-14 0.4 GB
  (the master is referenced in place on D:). No Remotion temp leftovers today.
- The Studio tree is on `main` at the P5 close (`1395e34`) with **uncommitted work** from early
  October: the Recorder STATUS entry, the V2 ledger note, a resizable track-header column
  (`TimelinePanel.tsx`, `timeline-view.ts`) and a portaled timeline context menu
  (`FloatingMenu.tsx`), plus a `Button.tsx` and `HomeScreen.tsx` tweak — 8 files, +87/−25.
- `~/Videos/VidTSX Studio/projects/video-14`: V1 = `master-tight-h264.mp4` (3840×2160 59.94 fps,
  485.718 s) referenced in place, 35 clips, 20 PiP transforms, 55 shots via Studio's own
  bundle step, 127 media, the editor's plans and transcript under `notes/editor/`, build and
  verify scripts under `notes/import/`. Passed: one-shot proof (cues ±1 frame, 4K sharp, PiP on
  face), a 205-frame pass (median SSIM 0.988), in-app open. Failed: the 4K range export above.

---

## 2. Decisions

Each one: what Hasan decided (2026-10-21) → the shape it takes → why. Marked **DECIDED** where
his answer closes it; the few sub-questions that remain are in §4.

### T1 — The cut: styles on the preset, a generic default cut skill, learned values saved in the user preset — DECIDED

Hasan: *"per preset + a generic skill that is the default cut, updates are saved in user preset."*

- **The generic default** = `studio-clean-cut` (built-in, read-only, the policy prose) plus a
  **default cut style** shipped beside it as data (`resources/skills/studio-clean-cut/cut-style.json`:
  the three named styles). Its `tight` becomes **Hasan's fitted tight** (§1.1), `natural` his
  fitted natural, and a `relaxed` derived from natural. The old constants go.
- **Per preset**: `StudioPresetStyle` gains `cut?: Partial<CutPlanStyle> & { base?: 'tight'|'natural'|'relaxed' }`.
  `pacing` keeps its meaning and now **maps** to `base` (tight → tight, normal → natural,
  relaxed → relaxed) when `cut.base` is unset. One resolver, `resolveCutStyle(project, preset)`,
  feeds **all four** consumers — the Auto Cut button, `run_auto_cut`, the editorial snap and
  Transcript deletes — so the style picker in `TranscriptSection` becomes a read-out of the
  preset with an override that is stored on the project (`settings.cutStyle`), not in session
  state.
- **Learning writes into the user's preset** through the existing learn card and
  `applyPresetLearning`; `StudioPresetKnobKey` widens to the nested cut knobs. Nothing is
  inferred silently (the memory design's rule stands).
- **The knobs**: port `maxHead`, `minSkip`, `fricZcr`, `fricMargin` with cutlib's exact
  semantics (§1.1), a `snapHead`, the `minSkip` merge, and the two QA readouts (hard entries,
  clipped tails) on the Auto Cut and editorial cards. ZCR needs samples the dB-bucket envelope
  does not have: the waveform job emits a `zcr` array on the same bucket grid (one more number
  per bucket, cache version bump, waveforms regenerate — cheap).
- **The learning signal** (Hasan: "ok"): every proposal item keeps its **snapped** span beside
  the user's final span; every user trim and Transcript delete tags the clip
  `origin {by:'user', op}`. Learn-from-video measures, at every join the user touched, the
  lead-in actually kept before the first word and the tail kept after the last word, and the
  level at the user's tail edges relative to the floor; it proposes `head`, `minTail`,
  `maxTail` and `margin` when the user's medians differ from the style by more than 30 ms
  (or 1 dB) over at least 10 joins. The card shows the numbers. That is the loop the
  2026-10-15 audit did by hand (21 joins → one style).
- **Why:** the Studio today would re-create the pacing he rejected; the preset is already the
  user-owned, learnable object; the four consumers disagreeing on the style is a latent bug.

### T2 — The split: crop + radius on the clip, a `split` shot kind, a PipHole in the kit, a transform tool — DECIDED (recommended)

- `StudioClipTransform` gains `crop?: { x, y, w, h }` (fractions of the source frame) and
  `radius?` (px, project space). Rendering: `clip-path: inset(top right bottom left round r)`
  on the media element, which clips in the element's own box and then rides the transform —
  the same code in preview and export. `TRANSFORM_NEUTRAL` grows; Inspector numeric fields;
  CanvasOverlay draws the crop box (handles are v2). A helper `fitCropToBox(box, cropCentre,
  zoom, project)` — the `pipTransform` formula moved out of the import script — computes
  crop + x/y/scale for "put this region of the speaker in that box".
- **`split` shot kind** = transparent root + a hole: `StudioShot.split = { box, radius, cropCx,
  cropCy, zoom }` in design px; the builder contract says "paint everything except a rounded
  hole at box B; the speaker shows through it", the looks composite the shot over **the master
  cropped into the box over black** (look-backdrop gains the box, mirroring the editor's
  `MasterPipPreview`), and a split exemplar joins the prompt. Placing a split (propose_shots,
  or the Shots tab) is one undo step: cut V1 at the span, set the fitted crop transform on the
  clips inside, add the overlay clip. Clips carry `mode: 'overlay'` as today.
- **PipHole** ported into `@vidtsx/kit` (mask-image evenodd rounded rect, bezel ring, grow-in,
  `hideFrom`), pack 1.1.0; existing projects keep their pin for imported shots.
- **Agent tool** `set_clip_transform({ clipId | span }, { x,y,scale,rotation,opacity,crop,radius }
  | { fitToBox })` → a review card (a `transform-plan` proposal, same shape as `insert-plan`),
  so "the agent never edits the timeline directly" holds.
- **Why:** the alternative (the shot renders the master itself) breaks preview/export
  identity and the master-lane boundary the whole model rests on; this one is additive and the
  import already proved the geometry.

### T3 — The assistant reads everything, like Claude Code in the project folder — DECIDED (Hasan: "make the agent read everything as if am here in claude code")

- **File tools inside `<project>/`**: `Read`, `Glob`, `Grep` over the whole project folder
  (shots and their `vN.src/`, stills, `debug.json`, `notes/`, `cache/transcripts`,
  `project.json`, `brand.json`, the kit pin); **`Write`/`Edit` restricted to `notes/`** (shots
  change only through the builder's versioned edit path; the timeline only through proposals).
  Mechanism = the Agents runner's pattern lifted into `studio-agent.ts`: `cwd = <project>`,
  `agentTools = [Read, Glob, Grep, Write, Edit]`, `canUseTool = createFileToolGuard(root, {
  writable: ['notes'] })`, SDK tool names kept out of `allowedTools` (§1.3's ordering fact).
  A second read-only root for the skills directory so resources beside `SKILL.md` are
  readable.
- **`write_note`** tool (create/replace/append, same 200k cap) and `notes/PLAN.md` as the
  project's CLAUDE.md: its head (≤ 2000 chars) injected into the system prompt, the rest read
  on demand. The editor's per-act plans and the review rules land there on import.
- **Skills with resources + a user skills folder**: `userData/skills/<id>/` overrides a
  built-in by id (highest version wins, the agents rule); `studio-make-tsx/resources/review-rules.md`
  = Hasan's standing rules, read by the assistant and folded into the builder's craft packs
  where they apply to a shot. The two skills stay in the prompt; resources are read, not
  pasted.
- **Session continuity**: `sessionScope: 'studio:<projectId>'` so a turn's tool calls and
  results survive to the next turn inside one `claude.exe` session (prompt cache included);
  Studio sessions get a longer idle (30 min, setting) and the text replay stays the fallback
  when the session is gone.
- **Why:** this is the parity audit's P1 + P5 + P8, grounded in a mechanism the app already
  ships and verified against the SDK. Bash stays off; typed tools cover what Bash would do.

### T4 — Parallel shot builds — DECIDED (added by Hasan)

- `canStart` becomes `runningCount() < buildConcurrency`, a setting (default decided by the
  F0 spike, expected 2 on this PC), with the 8-session ceiling and "one assistant turn per
  project" unchanged. Stills already serve per-bundle URLs; each build keeps its own guard.
- A **batch tool** `generate_tsx_shots([...])` (the V2 ledger's array-spec tool) starts up to
  N builds, reports each as it finishes (progress chips per shot), and returns all results;
  `generate_tsx_shot` stays for one-offs. `SHOTS_PER_PASS_CAP` becomes a setting (default 20).
- **Render gently** is a rule, not a hope: builds run at below-normal priority, a global CPU
  budget (low/medium/high) is honoured by exports AND builds, and a build is refused to start
  when free RAM is under 2 GB.
- **Why:** 55 shots at ~1–3 min serial is hours of waiting in front of the panel; the app
  crashed once at 95–99 % RAM, so the spike measures before the default is set.

### T5 — Voice cleanup: three engines, one job, one switch — DECIDED (Hasan: "all engines")

- **Job kind `cleanAudio`** in the media-jobs engine (its two switches), options `{ engine,
  params }`, output `cache/clean-audio/<assetId>-<engine>.wav` (48 kHz, the source's channel
  count), plus a sidecar `{ engine, gainDb, latencyMs, rmsBefore, rmsAfter }`. The asset gains
  `cleanAudio?: { path, status, engine }` and `useCleanAudio?: boolean`. One job per engine; a
  **15 s sample mode** (`sample: { start, seconds }`) for the A/B before the full run.
- **Substitution reaches both paths**: with `useCleanAudio` on, the serializer gives a video
  clip `muted` and emits a paired `<Audio src={cleaned} trimBefore volume playbackRate>`
  (preview and the Standard engine), and `clipAudibles` uses the cleaned path as `assetPath`
  (the copy engines). Transcription, waveforms and cut snapping **stay on the original** —
  the fitted margins were measured on raw recordings and the pipeline order here is cut →
  visuals → voice (§4 Q1).
- **E1 ElevenLabs Voice Isolator**: `POST /v1/audio-isolation` (multipart, mp3 back) through
  the existing provider + key; cost shown before the run; file-size limit measured [spike].
- **E2 RNNoise**: `highpass=f=90, arnndn=m=<model>` with `cb.rnnn` / `sh.rnnn` shipped in
  `resources/audio-models/rnnoise/` (licence recorded in THIRD_PARTY_NOTICES), run with the
  full ffmpeg if the stripped build lacks `arnndn` [spike], filtergraph paths escaped on
  Windows, and **the 480-sample latency compensated** by trimming 10 ms at 48 kHz, verified by
  the audio-offset instrument.
- **E3 Mel-Band RoFormer de-reverb** on the Python runtime: new pipeline `dereverb`
  (`resources/pipelines/dereverb/runner.py` on `audio-separator` with the mono anvuew
  checkpoint), category `audio`, input kind `audio` (the registry's kinds widen), `vramMb`
  4000, `cpuOk` true with the ~55 min warning, weights from the original host with sha256
  [open: the URL], and a **new runtime lock** (`2026.11.x`, audio-separator + its torch audio
  deps, `build-stack.ps1`, selftest). The recipe chains E3 then E2, as a preset step.
- **Levels and sync**: RMS-match by `astats` (not LUFS), peak cap −1 dBFS, offset measured by
  cross-correlation and compensated, refuse above 15 ms residual, original always kept.
- **UI**: an Inspector "Voice cleanup" section (engine select, Preview 15 s, Clean, Use cleaned
  toggle, the numbers), a hover action, an agent tool `clean_voice(assetId, engine)` that
  blocks like `transcribe_asset`, and a `voice_cleanup` preset step.
- **Why:** the plumbing (jobs, provider, full ffmpeg, Python runtime) exists; what is missing
  is one job kind and the substitution point, which §1.5 located exactly.

### T6 — SFX as library content — DECIDED (recommended)

- `LibraryIndexEntry` gains `kind` (one shared extension → kind table replaces the two that
  disagree), `probe` **filled on upsert** for audio and video (ffprobe duration), `tags[]`,
  `audio?: { category, loudnessLufs, peakDbfs, source, model }`, `usedIn[]` (project ids,
  written when a `library:` ref lands in a project through `insert_asset`,
  `generate_tsx_shot` assetRefs or the pool import). Index version 2 with a migration that
  back-fills `kind`.
- `generateAudioAsset` normalizes to the palette defaults (**−20 LUFS under a −1.5 dBFS
  ceiling**, §4 Q2), probes the duration, and records `category` + `tags` from the tool args.
- **Reuse before generate**: `list_assets(scope:'library', kind:'audio', query)` shows
  duration, category, tags and `usedIn`; the prompt rule says search first; `generate_sfx`
  returns the top three library matches instead of generating unless `force`. The Assets
  screen gets audio playback in the tile and details, and origin/tag chips.
- **Importer**: `scripts/import-sfx-library.mjs` reads the reference `sfx/catalog.json` and
  `music/catalog.json` and files 45 + 6 clips into `library/sfx/` and `library/music/` with
  fields mapped and `used_in` preserved.
- **Not in this plan**: a `propose_sfx` cue plan with audition (G4) — ask-first stays, per
  Hasan's standing rule on explainers.

### T7 — 4K projects and export — DECIDED (recommended)

- New Project uses the shared `FORMAT_PRESETS` (so the 4K tile appears) and the Export dialog
  gains **1080p and 1440p** presets (hidden by never-upscale on smaller projects).
- **The fix is Studio-side**: `remotion/<subpath>` becomes external in the shot bundle
  (`EXTERNAL = /^(react|remotion(\/.+)?|@vidtsx\/kit)$/`), the lint allows `remotion/*`
  subpaths, the preview keeps serving its shared copy and the export bundle resolves the
  app's one 4.0.435 copy at module load, before any `delayRender` exists. **A3 proves it on one
  video-14 shot first** (inlined 4.0.486 google-fonts code calling the app's no-react — API
  parity [spike]) and then re-bundles all 55 through the import script's bundle step.
- **Fastest is the 4K path to try**, with the full ffmpeg + NVENC prerequisites installed on
  this PC; Standard at 25 % is measured on the same range for the record.
- **Fonts never reach the network mid-render**: an export preflight scans every shot copy's
  font URLs (the `rewriteFontUrls` pass already finds them), warms the cache, and refuses to
  start with a clear message when upstream is unreachable — the proxy's 502-mid-render path
  goes away. **GPU proxies default on** when an NVIDIA adapter is present and the full ffmpeg
  is installed; the first 4K import offers the download with the measured numbers.
  **Temp + disk**: on cancel/failure the job's own Remotion assets folder is deleted; a
  disk-space preflight (output drive and `%TEMP%`) refuses an export that would not fit,
  with the estimate shown.
- **Test size is capped**: a **30–60 s range**, never the full video, until Hasan says
  otherwise (his answer 9).

### T8 — A user-facing A/V check after export — DECIDED (fold into the 4K track)

- "Check this export" on the finished queue row runs the audio-offset instrument against the
  first clip's camera file and a frame match at the sampled times, with **verify_sync's
  verdict**: pass iff median |offset| < 25 ms and |drift × span| ≤ 40 ms over ≥ 3 confident
  probes; report JSON beside the file. The hidden two-engine verification stays for
  developers.

### T9 — Form, branch, order, material — DECIDED (Hasan: 7, 8, 9 "ok")

- One document (this one), six tracks, one branch `end-to-end-p0` off `main` **after the
  uncommitted October work is committed** (§4 Q6). One STATUS row per part; TESTING.md §18.
- **Order: A 4K → B cut → C visuals → D voice → E SFX → F parallel.** A first because every
  other exit needs a working export and it closes the paused test.
- **Material**: M1 = the existing `projects/video-14` (tracks A, C, F); M2 = a new
  `projects/video-14-raw` from the nine DJI clips, referenced in place on D:, proxies and caches
  on C: (tracks B, D, E). C: budget: proxies ~1 GB, cleaned audio < 1 GB, one 4K range export
  with temp ≤ 10 GB — within the 27.8 GB free.

---

## 3. Build order — tracks, parts, measured exits

Every part is one session with Hasan's "go". Session gates: `npx vitest run` green,
`npm run check:types` at baseline (ratchets down only), a live CDP click-through on an isolated
profile (`docs/ui-automation-cdp.md`), STATUS.md row, TESTING.md §18 block. Schema additions are
optional fields; old projects open untouched. Anything the composition renders is verified in
preview AND a real export before the part closes.

### Track A — 4K project and export (E1)

| Part | What | Exit |
|---|---|---|
| **A1** | New Project reads the shared `FORMAT_PRESETS` (4K tile); Export gains 1080p + 1440p presets; project-size edits become an undoable action | a 3840×2160 @ 60 project from the dialog; its Export dialog lists Full, 1440p, 1080p, 720p… |
| **A2** | The disk preflight (output drive + `%TEMP%`, estimate shown) and the cancel/failure cleanup of the job's Remotion assets folder | a cancelled range export leaves nothing; a too-small disk refuses with numbers |
| **A3** | **The no-react fix**: `remotion/<subpath>` external in `shot-bundle.ts`, lint widened, one video-14 shot re-bundled and rendered 5 s through Standard at 4K60 → then all 55 re-bundled by the import script's bundle step (`--shots-only`) | the 5 s render completes with the brand-font hold released; `grep remotion_delayRenderHandles` over the 55 bundles = 0 hits |
| **A4** | Font preflight for exports (scan shot copies, warm, refuse when upstream is down); GPU proxies default on when viable + the first-4K-import download card | an export with the upstream blocked after warm-up completes; a fresh 4K import on this PC builds proxies on NVENC without a Settings visit |
| **A5** | Fastest on video-14: install the prerequisites, export a 30–60 s range across one split + one cutaway; Standard at 25 % on the same range for the record | both files complete; wall times and fps recorded in STATUS |
| **A6** | The A/V check (T8) on the queue row + report JSON | the A5 files pass; a file offset by 100 ms on purpose fails |
| **Track exit** | E1 met on both files; frames match the editor's `video-14-preview.mp4` at the same seconds; nothing left in `%TEMP%` | |

### Track B — The cut (E2)

| Part | What | Exit |
|---|---|---|
| **B1** | Waveform job emits `zcr` per bucket (cache v2); `RmsEnvelope.zcr()`, `snapHead`, fricative-aware `snapTail`, `minSkip` merge; `CutPlanStyle` + the four knobs; unit tests mirror cutlib's cases | on video-14 clip 1 the plan's joins reproduce cutlib's within ±20 ms for the same style |
| **B2** | The default cut style file beside `studio-clean-cut` with Hasan's fitted values; `resolveCutStyle`; all four consumers on it; the picker becomes a preset read-out + project override; Project settings shows the resolved knobs; the preset editor gets a Cut section | the Auto Cut card headline names the preset's style; editorial and Transcript deletes snap with the same knobs |
| **B3** | QA readouts on the cards: hard entries and clipped tails (analyze_cut's checks), with the offending joins listed and auditionable | on M2, tight: hard entries 0 at `head 0.15`; raising `margin` shows clipped tails as expected |
| **B4** | The learning signal: snapped span kept beside the final span on proposal items; user trims and text deletes tagged; learn-from-video measures lead-in / tail / level at user-touched joins and proposes the cut knobs with numbers | after Hasan re-does his 21 Act-1 joins on M2, the card proposes `head`, `minTail`, `margin` within ±30 ms / ±1 dB of the fitted tight |
| **B5** | `studio-text-edit` on in production after Hasan's pass on M2 (AssemblyAI transcript, by ear, long project) | his pass clean; flag flipped |
| **B6** | The content measurement: Auto Cut + editorial on all nine clips vs `cuts.json` — proposed cut seconds ∩ his cut seconds / his cut seconds, and the spans he cut that the pass did not propose, listed by category | the overlap number and the miss list recorded in STATUS; **the bar for the next round is set from this run**, not invented here |
| **Track exit** | E2 met; the editor's `clean-cut` skill marked superseded for cutting | |

### Track C — Visuals: the split, the assistant's reach, the rules (E3)

| Part | What | Exit |
|---|---|---|
| **C1** | `crop` + `radius` on the clip transform end to end (types, neutral keys, serializer, ClipRenderer `clip-path`, Inspector, CanvasOverlay box, `fitCropToBox`); export-spans treats a crop as a browser span | the video-14 split transforms re-expressed with a crop show black outside the box in preview and export |
| **C2** | The `split` shot kind: shot field, contract line, backdrop cropped into the box for the looks, a split exemplar, placement as one undo step (cut + crop transform + overlay clip) | three video-14 split rows rebuilt from their edit-plan briefs; hole within 4 px at 1080p; the speaker through it |
| **C3** | PipHole in the kit (pack 1.1.0) + `set_clip_transform` tool → `transform-plan` card | the assistant moves a split's box on request; the card shows before/after; one undo |
| **C4** | File tools in the project (read everywhere, write in `notes/`), `write_note`, `notes/PLAN.md` head in the prompt, the skills root readable, `sessionScope` per project with a 30 min idle | "what did we decide about Act 3?" answered from `notes/editor/edit-plan-act3.md`; the assistant names the shot sources it read; turn 2 remembers turn 1's tool results |
| **C5** | User skills folder with override by id; `review-rules.md` as a resource of `studio-make-tsx`; the applicable rules reach the builder's craft pack for a shot | a split brief yields PiP-in-corner, no fade from blank paper, `loadFont` fonts, no boiling ink, on the stills |
| **Track exit** | E3 met; the editor's `make-tsx` review rules marked as living in the Studio | |

### Track D — Voice cleanup (E4)

| Part | What | Exit |
|---|---|---|
| **D0** | Spike: `ffmpeg -filters` on the stripped build (arnndn / highpass / astats); ElevenLabs isolation on a 60 s file (size limit, cost); the weights URL + licence for the anvuew checkpoint; `audio-separator` pinned into a trial runtime lock | the four answers in this doc's §5 |
| **D1** | `cleanAudio` job kind + asset fields + sample mode + sidecar; E2 RNNoise with latency compensation, RMS match, offset check | on M2 clip 1: RMS ±0.5 dB, offset ≤ 5 ms, the 15 s A/B plays in-app |
| **D2** | Substitution: serializer pair (muted video + `<Audio>`), `clipAudibles` path, `useCleanAudio` toggle; preview and all three engines | an export of a cleaned range carries the cleaned audio and passes A6 |
| **D3** | E1 ElevenLabs isolation with the cost shown | a 1-minute sample cleaned; cost logged by the usage sink |
| **D4** | E3 de-reverb pipeline on the Python runtime (new runtime version, registry audio kinds, runner, selftest), chained E3 → E2 as a preset step | video-14's master de-reverbed in-app on the A3000 in ≈ the 8:40 the recipe measured; the CPU warning shown without a GPU |
| **D5** | UI (Inspector section, hover action), `clean_voice` tool, `voice_cleanup` preset step | the one-line "edit this video" run includes cleanup when the preset says so |
| **Track exit** | E4 met; the editor's `clean-audio` skill marked superseded | |

### Track E — SFX as library content (E5)

| Part | What | Exit |
|---|---|---|
| **E1** | Index v2: `kind`, `probe` on upsert, `tags`, `audio`, `usedIn`; one kind table; migration | `list_assets(scope:'library')` shows durations for every audio file |
| **E2** | Generation writes loudness-normalized files with category/tags; `usedIn` written on every landing | a generated SFX appears with duration, tags, −20 LUFS, and the project id after insert |
| **E3** | Reuse-before-generate (prompt rule, `generate_sfx` top-3 matches, `force`); Assets screen playback + origin/tag chips | the whoosh case in E5 |
| **E4** | The importer over the reference `sfx/` and `music/` catalogs | 45 + 6 clips in the library with fields mapped, `used_in` preserved, licences noted |
| **Track exit** | E5 met | |

### Track F — Parallel shot builds (E6)

| Part | What | Exit |
|---|---|---|
| **F0** | Spike: RAM and CPU of 1, 2, 3 concurrent Standard builds on this PC (and the laptop if available), stills wall time per build | the default `buildConcurrency` chosen from numbers, in STATUS |
| **F1** | `canStart` < N, the setting, the RAM floor, the shared CPU budget honoured by builds and exports, below-normal priority on stills | two builds run at once; a third waits; a build is refused under 2 GB free |
| **F2** | `generate_tsx_shots([...])` batch tool with per-shot progress; the pass cap as a setting | four Act-1 shots in one batch at N = 2 |
| **Track exit** | E6 met | |

### Session sizing

| Session | Parts | Schema | Risk |
|---|---|---|---|
| 1 | A1 + A2 | none | low |
| 2 | A3 | none (bundle step) | **highest in the plan** — the API-parity spike decides it |
| 3 | A4 + A5 + A6 | export report file | medium (prerequisite installs) |
| 4 | B1 | waveform cache v2 | medium (DSP port with tests) |
| 5 | B2 + B3 | preset `cut`, project `cutStyle` | low |
| 6 | B4 + B5 + B6 | proposal item spans, clip origin | medium (the measurement) |
| 7 | C1 | clip `crop`/`radius` | medium (CSS order [spike]) |
| 8 | C2 + C3 | shot `split`, `transform-plan` proposal | medium |
| 9 | C4 + C5 | none (settings) | medium (SDK session + guard) |
| 10 | D0 + D1 + D2 | asset `cleanAudio` | medium |
| 11 | D3 + D4 + D5 | registry kinds, runtime version | **high** (runtime rebuild, 2.76 GB) |
| 12 | E1 + E2 | index v2 | low |
| 13 | E3 + E4 | none | low |
| 14 | F0 + F1 + F2 | settings | medium (RAM) |

After session 14: Hasan's full pass of TESTING.md §18 on M1 and M2, then the first full
video made here, raw to delivered, with no editor-repo step.

---

## 4. Checklist — answered

Hasan's nine (2026-10-21), verbatim where he wrote them:

1. **Where the cut knobs live** — *"yes per preset + a generic skill that is the default cut,
   updates are saved in user preset."* → T1.
2. **The learning signal from his edges** — *"ok"* → T1 / B4.
3. **The split model** — *"recommended"* → T2.
4. **Voice cleanup engines** — *"lets plan adding the all engines."* → T5, all three.
5. **SFX scope** — *"ok"* → T6, cue plan stays later.
6. **The 4K fix Studio-side, Fastest as the 4K path** — *"ok"* → T7.
7. **One document, six tracks, exits on video-14, one branch** — *"ok"* → T9.
8. **Order 4K → cut → visuals → voice → SFX → parallel** — *"ok"* → T9.
9. **Test material** — *"ok, but dont test rendering a large video, test 4k with like 30-60
   seconds max"* → T7 / A5: ranges only.

Added by him the same message: parallel shot builds (T4), "make the agent read everything as
if am here in claude code" (T3), fold the A/V check, proxies, fonts, temp into the 4K track and
the text-edit flag into the cut track (A4/A6, B5), the Recorder stays later.

Still open — answer inline when the part comes up (each has a recommendation; "go
recommended" works):

- **Q1 (D2)** Cut snapping, waveforms and transcription stay on the ORIGINAL audio; cleaning
  is applied after the cut. ☐ yes *(recommended)* ☐ snap on the cleaned track
- **Q2 (E2)** Generated SFX normalized at generation to −20 LUFS under −1.5 dBFS (the palette
  defaults). ☐ yes *(recommended)* ☐ store raw, measure only
- **Q3 (C4)** The assistant writes only in `notes/`; shots change through the builder's edit
  path. ☐ yes *(recommended)* ☐ also let it edit shot sources
- **Q4 (B4)** Learn thresholds: ≥ 10 touched joins, > 30 ms or > 1 dB. ☐ yes *(recommended)*
  ☐ other: ___
- **Q5 (F0)** `buildConcurrency` default from the spike, expected 2. ☐ yes ☐ fixed at: ___
- **Q6 (now)** Commit the uncommitted October work as-is, then branch `end-to-end-p0`.
  ☐ yes *(recommended)* ☐ stash it

---

## 5. Still missing / risks

- **A3 parity [spike].** The inlined `@remotion/google-fonts` code is 4.0.486; it will call
  the app's 4.0.435 `remotion/no-react` once that is external. If `NoReactInternals` differs
  in what google-fonts uses, the fallback is to externalize `@remotion/google-fonts/*` too and
  serve it in preview — a bigger change. The one-shot render decides it.
- **The Player.** The same reset runs in the preview today (inlined copy inside
  `__vidtsxInit`); its effect on the Player's own `delayRender` holds was never measured. A3's
  one-shot proof should look at a shot with a font load in the Player as well.
- **`clip-path` under `transform` [spike].** Expected: the inset clips in the element's local
  box and rides the transform. Chrome verifies it in C1 before the Inspector is built.
- **ZCR needs samples.** The waveform job today reads PCM through ffmpeg into buckets; adding a
  zero-crossing count per bucket is one pass, but the cache format changes (v2) and every
  waveform regenerates on first open.
- **arnndn availability [spike].** The stripped Remotion ffmpeg may lack `arnndn` and
  `astats`; then E2 needs the full ffmpeg download (80 MB, Windows-only today), which the copy
  engines already require. The `bd.rnnn` model in the reference repo is a dead file.
- **The de-reverb weights [open].** The checkpoint name is known, its download URL and licence
  are not recorded anywhere; D0 finds them. A new runtime lock means a 2.76 GB download for
  every user who turns E3 on, and the mono requirement must be enforced (stereo variants
  silently no-op on a dual-mono lav).
- **ElevenLabs isolation limits [spike].** File-size and duration caps are undocumented in our
  notes; D0 measures on 60 s and decides whether long files are chunked.
- **RAM for parallel builds.** No build RAM figure exists; the 2026-08-19 crash is the only
  data point. F0 measures before a default is set; the 2 GB floor is a guess until then.
- **Copy engines and splits.** Every transform or crop span is a browser span, so video-14's 20
  splits render in Remotion under Fastest too; the win is on the plain-cut stretches only.
  Expected, recorded here so it is not reported as a bug.
- **Width/height edits** on an existing project are not undoable and trigger no proxy or shot
  work; A1 makes the edit undoable but a format change on a project with shots stays a
  "you know what you are doing" operation.
- **The Transcript tab** is unverified on long projects and AssemblyAI transcripts; B5 is
  Hasan's pass, not a code change.
- **The learning loop measures what it can see.** Joins the user never touches teach nothing;
  the card says how many joins it learned from.
- **Docs to update when built**: `CAPABILITY_GAPS.md` (gap 4 closed by C1/C2, G4 narrowed by
  E), `VIDEO10_TESTING_FEEDBACK.md` (gaps 4, 5), `V2_FEATURES.md` (array-spec tool, user
  skills, canvas crop), `AGENT_PACKAGE_SPEC.md` (file tools in the Studio assistant),
  `docs/SKILLS.md` (user skills, resources), `TESTING.md` §18, `THIRD_PARTY_NOTICES.md`
  (rnnoise models, audio-separator), STATUS.md per part, and the editor repo's three skills
  marked superseded when their track closes.

---

## 6. Picking this up cold (next session)

1. Read, in order: this file; `CLAUDE.md`; `STATUS.md` (top entry); `CAPABILITY_GAPS.md` from
   "Fifth project"; `CLAUDE_CODE_PARITY_AUDIT.md` (background for T3).
2. Confirm the tree: `git status` — if the October work is still uncommitted, ask Hasan for
   Q6, then `git switch -c end-to-end-p0`.
3. Start at **A1** unless Hasan names a part. One part per "go"; the exit column is the
   definition of done; record the numbers in STATUS.md the way the P-phase rows did.
4. Drive the app on an isolated profile (`docs/ui-automation-cdp.md`: copy
   `settings/settings.db` + `Local State`, `--user-data-dir=<scratch>/vt-profile`,
   `ELECTRON_RUN_AS_NODE` unset). The video-14 Studio project is Hasan's; a part that renders
   or re-bundles it works on a copy first.
5. Render gently: one render at a time, CPU "low", below-normal priority; check free space on
   C: and D: first (§1.8). The 4K test is a 30–60 s range, never the full video.
6. The reference repo (`D:\repos\claude-youtube-editor`) is read-only for this plan: `cutlib.py`,
   `clean_voice.py`, `pip.tsx`, `bake.py`, `review-rules.md`, the SFX catalogs and video-14's
   `cuts.json` are the specs the parts port from.

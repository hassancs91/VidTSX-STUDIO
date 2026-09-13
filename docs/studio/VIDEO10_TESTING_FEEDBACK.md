# video-10 testing round — updates to implement

> Hasan is testing Studio on the imported `video-10` project
> (`~/Videos/VidTSX Studio/projects/video-10`, built 2026-09-11 — see its
> `notes/IMPORT-REPORT.md` and the "Third project" section of
> `CAPABILITY_GAPS.md`). Feedback lands here as it comes, one item each,
> **nothing is implemented during the round**. When the round ends, a new
> session implements the whole list together. Move a line to `Status.md`
> when it ships.

## 1. Ripple across all tracks ("auto-align shots when I cut") — SHIPPED 2026-09-12

> Built as specified below (see `Status.md` 2026-09-12): `services/ripple-ops.ts`
> + `hooks/useRippleMode.ts`, the layers toggle in the timeline toolbar
> (default ON), I/O + Delete range delete, ripple trims, cut proposals follow
> the mode. Kept here for the reasoning; the checklist rows are in TESTING.md §3.

**Asked 2026-09-11.** Hasan wants to cut 2:21.17 → 2:21.22 (50 ms at the
end of a clip) and have every later TSX shot and master clip slide left
with it, instead of re-aligning 60 shots by hand.

**Today:** ripple is per-track by design — `removeClip(…, ripple)` in
`src/features/studio/services/timeline-ops.ts` slides later clips on the
SAME track only ("other tracks hold their timing", meant for music beds).
`apply-cut-proposal.ts` has the same per-track semantics, so an agent
auto-cut after shots are placed also breaks sync. In/out range points exist
(`onSetRangePoint`) but only drive range export; there is no delete-range
op, so a span cut is split × 2 + select + Delete.

**Build (small, pure ops + one toggle):**

1. **"Ripple all tracks" mode** beside the existing Auto-ripple toggle
   (`TimelineToolbar.tsx`, `useTimelineShortcuts.ts`). Removing a span from
   the master lane shifts every clip on every **unlocked** track that starts
   after the span by the removed duration; a clip straddling the span shrinks
   by the overlap (keeps its start, loses the covered part). Locked tracks
   never move — the music-bed case the current design protects.
2. **Range ripple delete:** in point + out point + Delete removes that span
   from the master lane with all tracks following. One step for the case
   above.
3. **Cut proposals honour the same setting** (`apply-cut-proposal.ts`), so
   agent auto-cuts keep shots aligned.
4. Undo = one step; tests in `timeline-ops.test.ts` for straddle, exact-edge,
   locked-track and zero-length cases. Note the project's float-seconds
   model: a 50 ms cut is 1.5 frames at 30 fps — exact in the document,
   frame-snapped in preview.

## 2. Opening a project freezes the UI for a moment — needs a real loading state

**Asked 2026-09-11.** Clicking the video-10 card: the app stalls briefly
before the editor appears. A "Loading project…" text exists
(`EditorShell.tsx` ~953) but it only covers the `studio:project:load` IPC;
the stall comes AFTER that, on the editor's first mount, when everything
below fires at once (likely cause — profile first, then fix):

- `useShotModules` loads **all 62 ready shots in parallel** on mount: 62
  `studioShotModule` IPCs (main-process transpile of 120–160 KB each), then
  62 dynamic imports evaluated in the renderer, each bundle carrying
  `@remotion/google-fonts` loaders that call `delayRender` + fetch fonts.
- `studioShotsReconcile` runs on mount and on every window focus
  (`EditorShell.tsx` ~166): scans 62 shot folders and runs
  `validateShotCode` (another transpile per shot).
- First paint of a 359-clip timeline (297 master + 62 shots) + the Player,
  right after parsing a 398 KB `project.json`.
- Media prepare (proxies for 19 GB of 4K HEVC, waveforms, thumbnails) kicks
  off in the same instant; it is async, but its first events land during
  the same frame budget.

**Build:**

1. Profile the open with the Performance panel on video-10 to confirm which
   of the above blocks the main thread (renderer vs main-process wait).
2. A staged loading state that stays up until the editor is actually
   interactive: parse → shots N/62 → first frame ready; a skeleton timeline
   is fine while shots stream in. Placeholders already exist per shot
   (`ShotPlaceholder` "Loading…"), so the gate is about *when* the shell
   flips from spinner to editor, not about new components.
3. Throttle shot-module loading: a small concurrency queue, playhead-nearest
   first, off the first-paint path; cache transpiled modules across opens
   (the shot version is immutable, `v<N>.tsx`, so a disk cache keyed by
   `shotId@version` is safe).
4. Debounce/skip the reconcile validate when the folder listing is unchanged
   since the last run (mtime/size fingerprint) — it should never transpile
   62 shots on every window focus.
5. Keep it measured: report open-to-interactive on video-10 before/after in
   `Status.md`, the way the S2 100-cut checkpoint was recorded.

## 3. Copy the clip name from the inspector with one click — SHIPPED 2026-09-13

> Built as specified: `CopyButton` (`src/shared/components/`) over a shared
> `useCopyToClipboard` hook; the five ad-hoc `navigator.clipboard` spots now
> go through the same helper. See `Status.md` 2026-09-13.

**Asked 2026-09-11.** With a clip selected, Hasan wants the clip's name
copied to the clipboard in one click (e.g. to paste a shot id into the
assistant or a note).

**Today:** `ClipSection.tsx` ~99 renders the name as a `ReadOnlyValue`
(`clip.label ?? asset file name ?? clip.kind`); no copy affordance. The app
already copies via `navigator.clipboard.writeText` elsewhere (image studio,
transcription screen), so no new plumbing.

**Build:** a small copy icon button at the right of the Name field (and the
same on the shot's name in `ShotClipSection.tsx` for tsx clips — copy the
shot id, which is what the assistant's tools take). Click → clipboard, a
brief "Copied" flash in place, no toast. Tooltip "Copy name". Extract a tiny
shared `CopyValue` so the three existing ad-hoc copy spots can use it too.

## 4. Assistant draft is lost when switching right-panel tabs — SHIPPED 2026-09-13

> Built with the hook variant: `useAgentDraft(projectId)` inside `AgentPanel`
> over a pure `agent-draft-store.ts` (sessionStorage, keyed by project). The
> Script tab holds no local state, so nothing to do there. See `Status.md`.

**Asked 2026-09-11.** Type in the assistant box without sending, switch to
another right-panel tab (Inspector / Captions / Script), come back: the box
is empty.

**Cause (confirmed in code):** `EditorShell.tsx` ~1161 renders the right
panel as a ternary on `rightTab`, so `AgentPanel` unmounts on every tab
switch and its `const [draft, setDraft] = useState('')`
(`AgentPanel.tsx` ~66) is thrown away. Selecting a clip also flips the tab
to Inspector unless you are on Assistant (~364), so a stray click loses the
draft too.

**Build:** lift the draft out of the panel — keep it in `EditorShell` (or a
`useAgentDraft(projectId)` hook) keyed by project id, and pass
`draft`/`onDraftChange` down. Persist it in `sessionStorage` under
`studio:agent-draft:<projectId>` so a renderer reload keeps it as well; clear
it on send. Same treatment for the Script tab's editor if it turns out to
hold local state (check `ScriptPanel`). Alternative — keep all four tabs
mounted and toggle `hidden` — is heavier (the timeline/inspector already
re-render per selection) and unnecessary for one text field.

## 5. Left pane gets Media | Captions tabs; media items become a compact grid

**Asked 2026-09-11.** (a) Captions should live on the LEFT pane as a tab next
to Media, not in the right panel. (b) In Media, each file is too big — one
full-width card per asset with a 16:9 thumbnail — so a project with 113
assets (video-10) is a very long single column. Shrink the thumbnails so
several items fit per row.

**Today:** the left column is `MediaPool` alone (`EditorShell.tsx` ~1055,
width `poolPane.size`), a single `flex flex-col gap-2` list
(`MediaPool.tsx` ~140) where each `AssetCard` has a full-width
`aspect-video` thumbnail (~602) plus name/status/actions; the shots list
(`ShotsSection`, ~190) sits under it in the same column. The right panel has
four tabs — Inspector | Captions | Script | Assistant (~1136–1160) — and
`CaptionsPanel` renders there (~1174).

**Build:**

1. Left pane tab strip (same `RightTabButton` look, 32 px): **Media |
   Shots | Captions** (Hasan, 2026-09-11: TSX shots get their own tab, not a
   section under Media). Move `CaptionsPanel` there with its props
   unchanged; lift `ShotsSection` out of `MediaPool` into its own tab with
   import TSX + generate in its header (brand and preset move to Project
   settings, item 7.4); right
   panel becomes Inspector | Script | Assistant. Remember the active left
   tab per project like `rightTab`. Keep the pane resizable.
2. Media as a responsive grid: `grid-cols-[repeat(auto-fill,minmax(88px,1fr))]`
   (tile ≈ 88–110 px at the default pane width → 3–4 per row), thumbnail on
   top with the kind badge and status pill (proxy %, transcript, missing)
   overlaid small, one-line truncated name below, actions (add / transcribe
   / remove) on hover or in a right-click menu instead of a permanent row.
   Selected tile gets the accent ring; keyboard focus order unchanged.
3. A density toggle in the pane header (grid / list) so the current roomy
   card remains available for reading long file names; persist in
   `localStorage`.
4. Same grid treatment in the Shots tab (62 shots in video-10); tab labels
   carry counts (Media 113 · Shots 62).
5. Verify drag-to-timeline still works from a tile, and that the
   `data-shots-section` hook used by the CDP tests keeps its name.

## 6. Removing media (or a shot) that is on the timeline: no warning today — SHIPPED 2026-09-13

> Built as specified, reducer variant for the undo: `remove-asset` carries the
> asset snapshot + its pool index in the undoable slice (`removedAssets`),
> the project sync drops/restores the asset; `services/asset-usage.ts` for the
> counts, `RemoveConfirmCard.tsx` in place of the tile/row, badges on both.
> See `Status.md` 2026-09-13.

**Asked 2026-09-11** ("do we get a warning or prevent removing?").

**Today — neither.** The X on a media tile (`MediaPool.tsx` ~704, title
"Remove from project (file is not deleted)") calls `handleRemoveAsset`
(`EditorShell.tsx` ~851): it dispatches `remove-asset-clips` (every clip
playing the asset is deleted — on video-10 that is up to 297 master clips
for one raw file) and then `removeAsset` drops the asset from
`project.assets`. No confirm, no count shown. Worse, it is only half
undoable: the clip deletion is one step in the timeline history, but
**assets are not in the undoable slice** (`useTimeline.ts` ~71: timeline,
proposals, shots, captions only), so Ctrl+Z brings the clips back pointing
at an asset that no longer exists, and the serializer silently skips them.
Recovery is a snapshot restore. The shot X (~445, `handleRemoveShot`)
removes the shot and its clips the same way, no confirm; that one IS in the
undo slice.

**Build:**

1. In-use check before removal: count clips (per track) and, for assets,
   shots that reference it via `assetRefs`. If any, show a confirm card in
   place of the tile/inspector ("Used by 297 clips on V1 and 2 shots.
   Remove anyway? The clips are deleted; the file stays on disk.") with
   Remove / Cancel. Unused → remove immediately as now.
2. Make asset removal undoable: either move `assets` into the undoable
   slice, or make `remove-asset` a single reducer action that carries the
   asset snapshot so undo restores asset + clips together. Prefer the
   reducer action — one undo step, no cross-store coupling.
3. Tile affordance: an asset in use shows a small "on timeline" badge
   (clip count) so the state is visible before anyone reaches for the X.
4. Same confirm for shots in use (count of tsx clips).

## 7. Brand selector is invisible when there are no library brands

**Asked 2026-09-11** ("why I don't see brand selector?").

**Cause (confirmed):** the picker in `ShotsSection` renders only when
`brands.length > 0 || brandId` (`MediaPool.tsx` ~294). This machine's
library (`userData/assets`) has a `presets/` folder and **no `brands/`**,
and video-10 has no `settings.brandId` — its brand is the project-local
`brand.json` snapshot (the `.vidtsx` "keep the tokens with the project"
path), which `resolveProjectBrand` does use for generation, silently. So
the UI shows nothing at all: no picker, no hint that a snapshot is active,
no way to create a brand from here. The preset picker has the identical
guard (~318).

**Build:**

1. Always render the Brand row. Empty library → the select offers
   "No brand" + "Create brand…" (opens the Assets screen's brand form, or an
   inline mini-form: name, 5 palette colours, display/body font).
2. Show the project snapshot as a real option: "Project brand (snapshot)"
   selected by default when `brand.json` exists and no `brandId` is set,
   with a "Save to library" action that promotes it to
   `assets/brands/<slug>/` and sets `brandId`.
3. Same for Preset: always visible, "Create preset…" when empty.
4. **Dedicated home (Hasan, 2026-09-11: "shouldn't brand and preset have
   their own place instead of the media?").** Yes — they are project-level
   settings, like resolution, fps and the STT model, and today those have no
   surface either. Add a **Project settings** popover/panel opened from the
   top bar (next to Export): name, width×height, fps, STT model, **Brand**,
   **Preset**, plus a compact read-out of what the brand supplies (palette
   swatches, fonts). Remove both pickers from the media pool / Shots tab; the
   Shots header keeps only import and generate. The assistant already reads
   the preset from `settings.presetId`, so nothing else moves.

## 8. Proxy generation took ~1 hour on video-10 — is that normal, and can it be faster?

**Asked 2026-09-11.** First open of video-10 spent roughly an hour building
proxies.

**Is it normal? Yes, for the shipping path.** video-10 is 1,896 s of
3840×2160 59.94 fps 10-bit HEVC (9 DJI clips, 19 GB). The measured numbers in
`docs/PREVIEW_TESTS_PLAN.md` §T4/T5 for exactly this kind of source:

| path | realtime | video-10 estimate |
|---|---|---|
| software decode → x264 540p all-intra (bundled ffmpeg) | 1.10× | ~29 min, 8+ cores pinned |
| NVIDIA `d3d11va` decode → x264 (what ships by default when the adapter is found) | 1.77× | ~18 min |
| same, per file while two run at once (contended) | 0.66× | ~48 min |
| **NVENC, whole pipeline on the card** (NVDEC → `scale_cuda` → NVENC, cq 33) | **4.94×** | **~6.5 min** |

Add 9 waveforms over 32 min of audio and 104 image thumbnails, and the
default path lands in the 45–60 min range Hasan saw. The 4.9× path exists
in the code (`proxy-encoders.ts`, `resolveProxyGpuEncoder`) but is **off
by default** (`proxyGpuEncoderEnabled` unset on this machine) and needs the
downloadable full ffmpeg (`ffmpeg-full.ts`, userData/ffmpeg-full — not
downloaded here). This laptop has an RTX A3000, so the fast path applies.

**Discuss / build:**

1. **Turn the GPU path on by default when it is viable**: NVIDIA adapter
   present + full ffmpeg downloaded (or offer the download on first 4K
   import: "Proxies for this footage will take ~50 min on the CPU or ~7 min
   on your GPU — download the GPU encoder (≈ 90 MB)?"). Keep the sticky
   fallback to x264 on any NVENC failure (already implemented).
2. **Show the estimate and progress honestly**: per-asset ETA from the
   measured realtime factor of the path in use, overall "n of 9 · ~12 min
   left" in the media pane header, and a clear "playing original until
   proxy is ready" state (the original 4K plays at ~8 fps in preview — T2).
3. **Order the queue by what the user is looking at**: playhead asset first,
   then timeline order; today it is import order.
4. **Concurrency**: two files at once halves per-file speed on the CPU path
   (the 0.66× row); on the GPU path NVDEC is the bound (~2.4× per stream), so
   2 parallel streams is right there. Make concurrency per-path, not fixed.
5. Waveforms and thumbnails are cheap; run them first so the timeline is
   scrubbable while proxies build.
6. Re-measure on video-10 after the change and record wall time in
   `Status.md` next to the T5 numbers.


## Import gaps — discussion state (2026-09-11, to continue)

The 12 gaps from the video-10 import (`notes/IMPORT-REPORT.md` in the
project, `CAPABILITY_GAPS.md` "Third project"). Hasan went through them once;
the deep explanations for 2, 3, 4, 5, 10 were given and are summarised here
so tomorrow starts from his decisions, not from scratch.

| # | Gap | Hasan's call | Notes |
|---|---|---|---|
| 1 | Import path from claude-youtube-editor | **Dropped** | editor is private + temporary; no editor-specific importer. (A generic "open folder as project" was not discussed — ask.) |
| 2 | Real shots fail the shot contract | **Open — wants to understand, likely yes** | Bundle (esbuild, main process) as the official Import TSX step: file or folder → one self-contained file, lazy-init body, literal exports, lint after, report of what was inlined. Allowed packages = Studio's own deps (lucide, chroma, @remotion/*, google-fonts); anything else refuses with a clear message for now. Replaces the LLM "Convert for Studio" paraphrase for the mechanical cases. Proven on video-10: 62/62 at ~50 ms each. |
| 3 | Attach media to an imported shot (`assetRefs`) | **Open — asked for example, given** | Model is fine (hand-written refs render in preview + export). Build: a Media section in the shot inspector (asset picker → key), and the import step from #2 auto-registers every `staticFile`/literal media path it finds, with a summary. Example: B2NameCard = book page 67 + door tile → two refs, two `assets.<key>` lookups. |
| 4 | Split / PiP authoring | **Open — asked what the transparent-hole case is** | Two shapes. (a) Opaque frame with a window — all 11 video-10 splits — works today via master transform; build the control (box + crop centre + zoom → x/y/scale, cuts the clip at the span). (b) Transparent shot with a floating (e.g. circular) face bubble — master would show everywhere the shot doesn't paint, and the circle needs the video clipped: needs a crop/mask property (rect + radius → clip-path) on the clip transform. Zero cases in video-10, one in video-2. **Decision pending: include the crop property or not.** |
| 5 | Shot kit coverage | **Open — asked what "port" means, explained** | Copy the editor's recurring lib pieces into `@vidtsx/kit` (theme tokens, listed in MANIFEST so generation uses them): band chips (13 uses), Claude-line terminal (7), PipHole (11), BrandBg/kicker. Not the tiles row or the book (content-specific). |
| 6 | SVG in the media import allowlist | **Yes** | one-line change in `media-import.ts`. |
| 7 | Notes home | **Yes** | Notes tab in the right panel over `notes/*.md`, readable by the assistant. |
| 8 | Imported cut's suggested-fluff / takes | **Deferred (ok)** | only matters for imported cuts. |
| 9 | Brand roles (5 vs 11) | **Yes** | optional extra roles (success, warning, danger, line, dark scale); lands with Project settings (feedback item 7). |
| 10 | Fonts | **Open — wants to understand, explained** | Real gap confirmed: nothing injects brand fonts; generated shots use plain family strings and render in Segoe UI on a machine without the font installed (preview AND export). Imported shots only work because their bundle carries the google-fonts loader URLs the font proxy rewrites. Build: on brand save prefetch its Google Fonts into the proxy cache; preview + export inject the brand fonts globally. Small, removes a silent failure. |
| 11 | Delivery format policy | **Yes (policy)** | project format = delivery format; shots render at project resolution with layout scaled. No code until the first 4K export. |
| 12 | First-open cost | **Covered by feedback item 8** | |

Suggested implementation order once decided: 2, 3, 6, 4, 7, 5, 9, 10; 11 is
a decision. **Next session: resume at 2, 3, 4 (crop yes/no), 5, 10.**

## Feedback backlog (add below as testing continues)

## 9. Copy / download the full assistant chat of a session — SHIPPED 2026-09-12

> Built the same day (Hasan: "implement now, raw tools and results optional —
> we can select"): a download button in the Assistant composer opens a menu
> with Copy chat / Copy chat + tool details / Save chat as Markdown… /
> Save chat + tool details…. Every tool call now records its
> arguments and result (capped) on the chat message, plus timestamps and the
> answering model. See `Status.md` 2026-09-12.

**Asked 2026-09-12** while testing the assistant: a one-click way to get the
whole conversation out of the panel (copy to clipboard, or download a file)
so Hasan can hand it to a Claude session with "here is what went wrong".

**Today:** the chat IS on disk — `<project>/agent-chat.json`
(`{ version, updatedAt, messages[] }`, written by
`src/main/services/studio/agent-chat-store.ts`; "New conversation" archives the
current one as `agent-chat.<stamp>.json` next to it). But nothing in the UI
surfaces it: the `AgentPanel` header (`AgentPanel.tsx` ~214–230) has Memory,
New conversation, Stop/Send only, and there is no copy affordance on messages.
Two limits of the stored form matter for a bug report: (a) each message is
just `{ id, role, text }` (`AgentChatMessage`, `src/shared/types/agents.ts`
~382) — the tool calls, applied actions, provider/model and errors the panel
showed live are NOT in the file; (b) a JSON blob is awkward to paste into a
chat.

**Build:**

1. Two header actions in `AgentPanel`: **Copy chat** (clipboard, Markdown) and
   **Save chat…** (main-process `dialog.showSaveDialog`, default name
   `<project>-assistant-<date>.md`, same pattern as `flows-package-handlers.ts`
   ~105). Both render the same Markdown: a header (project name, date,
   provider + model, preset id), then `### You` / `### Assistant` blocks in
   order. Reuse the shared `CopyValue` from item 3 for the clipboard part.
2. Make the transcript worth reading: extend `AgentChatMessage` with optional
   `at` (ISO), `providerId`/`model` on assistant turns, and a compact
   `activity[]` of the tool/action lines the panel showed (name + one-line
   result or error). Persist them; the store's corrupt-file fallback already
   copes with older files (missing fields = absent). Decision for Hasan:
   include the raw tool arguments/results (bigger, better for debugging) or
   only their one-line summaries.
3. Per-message copy on hover (the assistant's answer alone), since that is
   the common "paste this one reply" case.
4. Optional: **Include app log** checkbox on Save — appends the
   `[StudioAgent]` lines of the current log file for that time span, which is
   where the provider errors actually land today.

<!-- 10. … -->

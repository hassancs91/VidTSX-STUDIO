# S4 design — TSX shots (cutaway · overlay · title)

> Phase S4 of `docs/studio/PLAN.md`. Written before the code, per the
> "design first" rule — this is the reviewable artifact, same pattern as
> `TRANSITIONS_DESIGN.md` (Slice E). Each decision lays out options, names a
> recommendation, and the checklist at the end is answerable inline.
> Decisions here are v1; anything marked *(v2)* is deliberately out.
>
> **Rev 2 — 2026-08-14, after the review discussion with Hasan.** D5/D7/D8
> amended (shot asset props, bulk passes), D11 (brands) and D12 (media inside
> shots) added. Library / brand storage / capture internals live in the
> companion `ASSET_LIBRARY_DESIGN.md`; everything parked for later is
> ledgered in `V2_FEATURES.md`.
>
> **Rev 3 — 2026-08-14, after the adversarial grill (self-review + blind
> code-review agent).** Fixes applied: D4 re-founded on **Spike 0** (the
> cited in-renderer precedent turned out to be dead code) with
> bake-to-proxy the named fallback; tsx clips gain `sourceIn`/frame-offset
> semantics (fixes split-restart + crossfade desync); shot proposal items
> are source-anchored (a frozen `timelineStart` was stale-by-design, and
> main has no timeline to map with); reject keeps files; one open proposal
> across ALL kinds; export pre-flight copies + font-normalizes shot
> sources; the shots↔undo integration is enumerated. Library-side grill
> fixes are in `ASSET_LIBRARY_DESIGN.md` Rev 2.

## What already exists (the design builds on, not around, these)

- **Schema stubs**: `StudioClipKind` includes `'tsx'`; `StudioClipTsx
  { filePath, mode: 'cutaway' | 'overlay' }` (`src/shared/types/studio.ts:83`);
  `StudioProposalKind` reserves `'shot-plan'`. `TimelineComposition` renders
  `case 'tsx'` as `null` today, and `serialize.ts:187` already exempts tsx
  clips from the "must resolve a src" drop. **No shipping document contains a
  tsx clip yet** — nothing creates them — so reshaping `StudioClipTsx` is safe
  without a schema-version bump (noted per decision below). *(Rev 3)* This
  window closes the moment any S4 build writes a tsx clip to a real project:
  the reshape lands in the FIRST S4 commit, before any such build exists.
- **Generation pipeline**: `generateTsxPipeline` / `editTsxPipeline`
  (`src/shared/tsx-engine/tsx-generation-service.ts:256/:447`) are
  process-agnostic via `TsxEngineDeps { llmGenerate, tsxValidate }` — main can
  drive them with `runLlmGenerate` + `validateTsxCode` directly.
  `TsxPromptContext` carries width/height/fps/duration into the prompt; the
  result reports `transpileValid` + `fixAttempts` (esbuild parse gate).
- **Versioned storage**: `reserveProjectFolder` / `writeNextVersion` /
  `writeDebugSidecar` (`src/main/services/tsx-jobs/project-store.ts`) are
  collision-safe and take a `parentDir`; `chat-store.ts` gives edit
  continuity (`chatHistory`, limit 20). The project scaffold already creates
  `shots/` (`studio-paths.ts:32`).
- **Export**: `export-entry.ts` writes a generated TSX entry that imports
  `TimelineComposition` from `@shared/studio`, embeds the serialized timeline
  as a literal, and exports `compositionConfig` so the generic wrapper +
  render queue need no Studio branch. Bundling now runs in a utilityProcess
  (`bundle-worker.ts`, c0b1b2d) with the `@shared` alias and
  `node_modules` resolution patched in.
- **Preview execution machinery** (Creator): esbuild transpile in main
  (`tsx-transpiler.ts`), import-rewrite to the module server's virtual
  modules so user code shares the app's one React/Remotion instance, dynamic
  `import()` of the served ESM. *(Rev 3 correction)* Only the isolated
  `<webview>` consumer (`IsolatedPreview`) is actually exercised today; the
  in-renderer path (`useComponentLoader.lazyComponent` +
  `setupVirtualModuleGlobals()`) is assembled but has **no live consumer** —
  its one user (`VideoPlayer.tsx`) is a deprecated stub. Studio needs the
  in-renderer shape (a webview cannot composite inside the timeline
  Player), so it must be *proven*, not assumed — Spike 0 in D4.
- **Agent layer**: in-process MCP tools (`studio-agent.ts`), the
  `propose_cuts` pattern (main never writes the document; proposals travel as
  events, the renderer reducer owns apply), `formatTakesView` transcript
  markup, and the skills registry (`studio-clean-cut` is the composed-skill
  precedent; `extract-and-cut` is the closest "documented I/O" template).

## Shot lifecycle at a glance (recommended shape)

```
agent chat / pool button
  → generate_tsx_shot(spec)                     [main: shot-generator service]
      generateTsxPipeline (plan→generate→verify→transpile-fix)
      shots/<shotId>/v1.tsx + v1.debug.json + chat.json
  → shot-plan proposal (event → reducer proposal-add)
  → review: preview natively in the Player (scratch-apply, like cuts)
  → apply: tsx clips land on an overlay/upper track, origin {agent, proposalId}
  → preview: transpile shot → ESM import → component map → TimelineComposition
  → export: entry statically imports shots/<id>/vN.tsx → same bundle+render path
  → edit/regenerate: editTsxPipeline → v(N+1).tsx → shot.activeVersion bump
```

---

## D1. Where the shot lives in the document — registry vs clip-only

The clip needs to reference generated TSX; the question is whether the shot
itself is a first-class document entity.

- **Option A — clip-only (today's stub)**: `tsx.filePath` points straight at a
  file. No home for prompt/anchor/chat metadata; regenerating means rewriting
  the path on every clip that uses the shot; the media pool can't list shots;
  provenance and status have nowhere to live.
- **Option B — shot registry**: new top-level `shots: StudioShot[]` on
  `StudioProject`, clips reference by id:

  ```ts
  interface StudioShot {
    id: string;                       // also the folder name under shots/
    name: string;                     // display, from the brief
    kind: 'cutaway' | 'overlay' | 'title';
    createdAt: string;
    /** Version the timeline uses, e.g. 2 → shots/<id>/v2.tsx. */
    activeVersion: number;
    status: 'generating' | 'ready' | 'error';
    /** Snapshot of the shot's own compositionConfig (fps/dims/frames). */
    config?: { durationInFrames: number; fps: number; width: number; height: number };
    /** What the shot was synced to — enables regenerate re-sync (D7). */
    anchor?: { assetId: string; sourceStart: number; sourceEnd: number };
    prompt?: string;                  // original brief, for the inspector
    origin?: StudioClipOrigin;
    error?: string;
  }
  ```

  `StudioClipTsx` becomes `{ shotId: string; mode: 'cutaway' | 'overlay' }`
  (replacing `filePath` — safe, see above; the schema comment moves to the
  shot). Versions on disk stay append-only; `activeVersion` is document state,
  so switching versions is a normal undoable reducer action.
- **Option C — shots as `StudioMediaAsset` kind `'tsx'`**: reuses pool/asset
  plumbing, but every asset field (absolute `path`, `probe`, `proxy`, `hash`,
  relink) fits generated-versioned content poorly, and asset-kind logic
  (clip-factory, import, media jobs) branches everywhere.

**Recommendation: B.** It is the transitions-doc lesson applied again: put the
state where every existing op already handles it (the document), and let
edit/regenerate round-trips be one field bump instead of a clip sweep. Like
`EditDoc` grew `proposals`, the undoable unit grows `shots` only for the
actions that touch them.

## D2. Shot kinds & placement semantics

The reference semantics ("cutaway replaces picture, master audio continues;
overlay composites transparently") map onto our track model as **covering,
not displacing**: the shot sits on a lane above the footage; an opaque shot
hides the picture while the master clip (and its audio) keeps playing
underneath. Displacing the master track would be destructive and would break
audio continuity — exactly what S4 must not do.

- **Kinds**: `cutaway` (opaque full-frame background mandated by the skill),
  `overlay` (transparent background), `title` = an **overlay whose skill
  template is text-first + word-synced** — same machinery, no third rendering
  mode. Storing `kind: 'title'` on the shot (D1) keeps the pool/inspector
  honest without touching clip semantics.
- **`mode` stays explicit on the clip** (`cutaway | overlay`), not derived
  from track kind. The current schema comment ties mode to track kind, but
  deriving it would make a drag between lanes silently change compositing
  intent; explicit mode only controls what the skill generates (background)
  and the default drop target. Rendering is identical either way — layering
  is already track order.
- **Default placement**: the first `overlay` track (created on demand, above
  the video tracks); the user can drag shots to any non-audio lane afterwards
  (`trackAccepts` already allows visual kinds anywhere non-audio).

**Recommendation:** cutaway/overlay/title as above; title is a skill
category, not a schema mode; covering placement on an upper lane.

## D3. On-disk layout & versioning

```
projects/<slug>/shots/
└─ <shotId>/
   ├─ v1.tsx  v1.debug.json          (writeNextVersion / writeDebugSidecar)
   ├─ v2.tsx  v2.debug.json
   └─ chat.json                      (edit-instruction continuity, limit 20)
```

- Reuse `reserveProjectFolder(shotId, shotsDir)` + `writeNextVersion` +
  `writeDebugSidecar` from `tsx-jobs/project-store.ts` verbatim — they are
  the only collision-safe writers (the renderer-side `saveNewVersion` in
  `useMotionProject` is not; Studio never uses it).
- Folder-as-truth for the *version list* (scan `v*.tsx` like the Creator);
  the *document* records only `activeVersion`. A missing folder/version at
  open renders the clip as a placeholder (D9), same spirit as missing media.
- `shots/` is **not** under `cache/` — it is user work-product, survives
  cache Clear (cache-manager already only touches `cache/`).

**Recommendation:** as drawn. No new storage machinery.

## D4. Preview path — how the Player runs user TSX

The Studio preview is a direct `<Player component={TimelineComposition}>` in
the renderer (`PreviewPanel.tsx:61`) — no bundler, no webview. Options for
getting shot code into it:

- **Option A — live module, in-renderer**: main transpiles the shot's active
  version (`transpileTsxCached` — esbuild + import-rewrite, already built),
  the module server serves it as ESM, the Studio renderer dynamic-imports it
  once per version and hands the component to the composition (D5). Because
  imports are rewritten to the virtual React/Remotion modules and
  `setupVirtualModuleGlobals()` pins those globals to the app's own instances,
  `useCurrentFrame()` inside the shot resolves against the *hosting Player's*
  context — the shot is frame-synced for free.
  - *Safety*: the shot runs in the app renderer process. Containment: (1) the
    transpile gate — a shot that doesn't parse never mounts; (2) a
    `ShotErrorBoundary` wrapped around each shot component **by the preview
    supplier only** — a throwing shot renders a labeled placeholder tile
    instead of white-screening the Player (export deliberately unwrapped so a
    broken shot fails the render loudly, not silently); (3) per-track `hidden`
    already mutes a misbehaving lane. What this does *not* contain: an
    infinite loop in shot code hangs the renderer — same exposure the Creator
    accepts for its in-renderer loader, and the code is first-party
    (agent-generated for this user, then user-edited). The webview isolation
    used by the Creator's standalone preview is not available here — a
    separate process cannot composite into the Player's frame.
- **Option B — bake to proxy video**: render each shot to a transparent-alpha
  video via the render pipeline; preview plays it as a normal clip; export
  uses live TSX. Full isolation and cheap playback, but: minutes of latency
  per regenerate, alpha-codec cost, and preview stops being the same code
  path as export — the "what you scrub is what renders" guarantee bends.
- **Option C — TSX source through `inputProps` + in-composition eval**: no.
  Components aren't data; eval in the composition would run in the render's
  headless Chrome too.

**Recommendation: A, gated on Spike 0** *(Rev 3)*. The grill showed Option
A's "existing precedent" is dead code, and production adds two untested
conditions: the packaged renderer loads over `file://` with
`webSecurity: true` (`src/main/index.ts:83` disables it only in dev,
explicitly *for* the module server), so a shot import is a cross-origin
module `import()` from a `file://` page. CORS `*` is already set on the
module server, so it plausibly works — but nothing has ever run it.

**Spike 0 — runs FIRST, before any other S4 work**: in a **packaged
build**, dynamic-import a transpiled module from the module server into the
app renderer, mount it inside an in-app `<Player>`, and verify
`useCurrentFrame()` tracks the host Player (shared React/Remotion instances
across the boundary). Pass → Option A as designed. Fail → **Option B is the
named fallback** (bake shots to transparent proxy video for preview; export
stays live TSX), promoted from v2 escape hatch to contingency — D5's
component-map contract survives either way; only the preview supplier
changes. Per-shot bake as a *performance* aid for heavy shots remains v2,
evidence-gated (the S2 rule).

Mechanics: a new `STUDIO_SHOT_MODULE` IPC (`{ projectId, shotId }` →
`{ moduleUrl, config } | error`) keeps path authority in main (renderer never
handles absolute paths); a renderer `useShotModules(project)` hook imports
every referenced shot's active version up front (shots are few; no lazy
per-approach loading needed, so `premountFor` behavior is untouched) and
produces the component map. Version bump or regenerate → new content hash →
new module URL → re-import; stale entries dropped.

## D5. Serializer & composition contract

Components can't ride `inputProps`; they arrive as a parallel map keyed by
shot id, supplied differently per consumer but rendered identically:

```ts
// serialize.ts
SerializedClip += tsx?: {
  shotId: string;
  mode: 'cutaway' | 'overlay';
  /** Rev 2: shot asset refs resolved to URLs per environment (D12). */
  props?: { assets?: Record<string, string> };   // ref key → URL
}

// TimelineComposition.tsx
TimelineCompositionProps += components?: Record<string, React.ComponentType>
```

- `ClipRenderer` `case 'tsx'`: look up `components[clip.tsx.shotId]`; render
  inside the existing transform/opacity styling so `transform` and fades
  compose exactly as for media. Missing component → `null` (the preview
  supplier substitutes a placeholder component instead, so the shared
  composition stays dumb).
- *(Rev 3)* **tsx clips get real `sourceIn` semantics.** Shot clips are
  created with `sourceIn: 0`; the serializer emits `trimBefore` for them
  like any media clip; `ClipRenderer` applies it as a frame offset (a
  nested `<Sequence from={-trimBefore}>` around the component). One
  mechanism fixes two grill findings: **split** now yields a right half
  that *continues* the animation (split already advances a defined
  `sourceIn`, `timeline-ops.ts:186`; undefined meant restart-from-zero),
  and a **crossfade into** a shot stays content-aligned (the serializer's
  `trimBefore` compensation at `serialize.ts:199` now applies, so baked
  word timings no longer shift earlier by the extension). Transitions on
  shots remain unlimited-handle (`MEDIA_KINDS` excludes tsx) — but not
  "for free" as Rev 1 claimed: this offset is the price, paid once.
- *(Rev 2)* Shots that use media declare `assetRefs: Record<key, assetId>` on
  the shot (D12); the serializer resolves each ref through the **same
  `AssetUrlResolver` machinery as clip `src`** (module server in preview,
  bundle server in export) and passes `{ assets }` as props to the component.
  Generated code references `assets.<key>`, never a file path — the
  preview/export URL asymmetry stays the serializer's problem, exactly as it
  does for media clips.
- Preview supplier: `useShotModules` map, each entry wrapped in
  `ShotErrorBoundary`; not-yet-loaded/failed → placeholder component.
- Export supplier: the generated entry (D6) builds the map from static
  imports — no boundary, errors fail the render.
- Serializer drops tsx clips whose shot is missing from `shots[]` or not
  `ready` (mirrors the missing-`src` drop, keeps the rest playable).

**Recommendation:** as above — one new prop, one new serialized field, no
geometry changes.

## D6. Export path

Extend `createExportEntry` (`export-entry.ts`): for each `ready` shot
referenced by the serialized timeline, emit a static import of its active
version and pass the map:

```tsx
// Rev 3: imports point at normalized COPIES in the entry's temp dir,
// written by the export pre-flight (fonts rewritten, casing canonical).
import Shot_a1b2 from './shot-a1b2-v2.tsx';
const SHOT_COMPONENTS = { 'a1b2': Shot_a1b2 };
<TimelineComposition timeline={TIMELINE} components={SHOT_COMPONENTS} />
```

- webpack compiles the shot copies like any TSX; `react`/`remotion` resolve
  via the `node_modules` patch already in `bundle-worker.ts:44`. *(Rev 3 —
  spike resolved, then superseded)* Verified against `@remotion/bundler`'s
  shipped webpack config: the `\.tsx?$` rule has **no include/exclude** — it
  compiles by extension anywhere on disk, so out-of-app-path imports would
  work directly. We copy anyway (next bullet), which also sidesteps the
  case-sensitive-paths plugin and any network-drive quirks.
- *(Rev 3)* Export-prepare's pre-flight **normalizes and copies** each
  referenced shot source into the entry's temp dir; the entry imports the
  copies. The same `rewriteFontUrls` pass the preview transpiler applies
  per served file runs here — without it, brand Google-Fonts load through
  the local proxy in preview but hit gstatic.com from headless Chrome at
  export (divergent output; hard failure offline), because the wrapper only
  ever normalizes the *entry* file (`composition-wrapper.ts:258`). Copying
  is safe because shots are single-file by lint (no relative imports). The
  pre-flight also re-validates each shot with `validateTsxCode` and blocks
  export with a pointed message on failure (`formatBundleError` remains the
  backstop for anything that slips through).
- **Import surface (the preview/render gap)**: preview can pull any package
  from esm.sh; the render bundle only resolves what's installed. v1 shots are
  therefore restricted to `react` + `remotion` (+ nothing else): the skill
  mandates it, and the generation tool enforces it with a cheap import-lint
  before accepting a version — a disallowed import is a fix-loop error, not a
  latent export failure. The three/R3F stack is installed and vendored, so it
  *could* be allowed, but 3D shots on the timeline deserve their own perf
  pass *(v2)*.

**Recommendation:** static-import entry + export pre-flight + react/remotion
import allowlist for v1.

## D7. Word-timestamp sync contract

Transcript words are source-media seconds (`StudioTranscriptFile.words`,
flat `SttWord[]`). The shot needs word timing relative to itself.

- **Option A — baked timings**: the generation tool converts the anchor
  span's words to shot-local seconds (`word.start − anchor.sourceStart`) and
  renders them into the prompt; the generated TSX carries them as constants
  (`const WORDS = [...]` in a clearly-marked block). The shot is a closed,
  self-contained composition — exactly what the pipeline already produces and
  what `compositionConfig` parsing expects.
- **Option B — words via props**: serializer injects re-based word arrays as
  per-clip props. Live re-sync under edits, but it needs a per-clip
  source→timeline word mapping at serialize time, a props channel through
  `SerializedClip`, and shots that consume a runtime contract — three new
  moving parts before the first shot ships. This is caption-shaped work and
  S5 owns captions.

**Recommendation: A**, with the anchor recorded on the shot (D1) so the sync
is *reconstructible*: regenerate re-reads the transcript for
`anchor.assetId/sourceStart/sourceEnd` and re-bakes.

*(Rev 2)* The asset-props channel added in D5/D12 does not reopen this
decision: it carries only URLs, which genuinely must resolve per environment.
Word timings stay baked — two different problems, two mechanisms.

Placement + drift rules (documented behavior):

- *(Rev 3)* Placement is **source-anchored, renderer-mapped**: proposal
  items carry the anchor (`assetId` + `sourceStart` — fields
  `StudioProposalItem` already has) and the *renderer* maps them to a
  timeline position at review and again at apply, via the existing
  `mapCutItemToTimeline` (`cut-proposal.ts:138`) — the cut-proposal
  discipline, which is exactly what keeps items honest while the user keeps
  editing during a two-pipeline-lengths bulk pass. (A frozen
  `timelineStart` was doubly wrong: stale after any ripple, and main —
  whose `StudioAgentSendRequest` carries no timeline — could never have
  computed it.) Unanchored shots fall back to a stored `timelineStart`,
  re-anchored to the playhead at apply if the spot is taken. Clip duration
  defaults to the shot's `config` duration.
- Moving the clip keeps internal sync (timings are shot-local). Ripple edits
  move the shot clip with its lane like any clip.
- Cutting the master *underneath* the shot's span desyncs the inner word
  timing — accepted for v1; the inspector shows the shot's anchor
  (asset + source span + "re-sync" hint) and regenerate re-bakes. Auto
  re-sync on edit is *(v2)*.

## D8. Generation entry points — tool, skill, proposal flow

**Agent tool** `generate_tsx_shot` on the existing in-process MCP server
(`studio-agent.ts` pattern):

```ts
{
  kind: z.enum(['cutaway', 'overlay', 'title']),
  brief: z.string(),                      // what the shot should show
  assetId: z.string().optional(),         // anchor asset (required for title)
  sourceStart: z.number().optional(),     // anchor span, source seconds
  sourceEnd: z.number().optional(),
  durationSeconds: z.number().optional(), // default: anchor span length
  assetRefs: z.record(z.string()).optional(), // key → asset id (Rev 2, D12)
}
```

Handler: build `TsxPromptContext` from `project.settings` (+ background rule
by kind, + shot-local word table from the transcript when anchored), run
`generateTsxPipeline` with deps `{ llmGenerate: runLlmGenerate,
tsxValidate: validateTsxCode }`, `featureSource: 'studio-tsx-shot'`,
`sessionScope: 'studio:tsx-shot:<uuid>'`; write `v1.tsx` + sidecar; emit
progress as agent `tool` events (the pipeline's `onProgress` maps cleanly).
*(Rev 3)* The acceptance gate is three checks: esbuild transpile, the
import/single-file lint (react + remotion only, **no relative imports** —
what makes export's copy step safe), and a `compositionConfig` **parse**
check — `parseCompositionConfig` silently falls back to 300 frames / 30 fps
on any non-literal value, so an unparsed config must be a fix-loop error,
never a silent default.
The nested-LLM-inside-a-tool-call shape is fine — `runLlmGenerate` is
re-entrant and `propose_cuts` already does main-side compute in a tool.

*(Rev 2)* The handler additionally injects the project's **active brand**
(D11) into the prompt context — palette as required tokens, fonts, style
notes verbatim — and resolves `assetRefs` into an asset table (name, kind,
dimensions from the existing probe data) the model designs against. The
companion tools `search_assets`, `generate_image`, and `capture_webpage`
(defined in `ASSET_LIBRARY_DESIGN.md`) let a shots pass find or make its own
material; images/captures are additive assets, so they carry no proposal of
their own — the shot proposal is where the outcome is judged.

**Bulk passes** *(Rev 2)* — "add shots for the first 5 minutes" is the same
machinery at scale: N tool calls, one `shot-plan` proposal with N items. The
discipline the skill enforces is **plan cheap, generate expensive**: for a
multi-shot ask the agent first posts a textual shot list in chat (anchors +
one-liners) and gets a go-ahead *before* burning pipeline runs — a cheap
conversational gate ahead of the visual proposal gate. `get_transcript`
gains optional `startSeconds`/`endSeconds` so a range ask reads only its
slice, and a per-pass cap of 10 shots guards runaway passes (the agent asks
before exceeding it, like the single-proposal rule). The tool stays strictly
one-shot-per-call — simpler progress attribution and failure isolation when
one of seven shots dies in its fix loop. Generation runs up to 4 concurrent
(the Creator's cap), so a 7-shot pass costs roughly two pipeline-lengths of
wall clock.

**Proposal flow — generate-then-propose.** Review must let Hasan *see* the
shot before accepting, so generation happens first, then a `shot-plan`
proposal arrives (same event channel; `EditorShell.handleAgentProposal`
branches on kind). Items extend `StudioProposalItem` with optional fields
(consistent with the existing optional-field style; a discriminated union is
cleaner but retypes proposal-ops and the review UI for no v1 gain):

```ts
StudioProposalItem += {
  shotId?: string;
  // Placement is source-anchored: assetId/sourceStart already exist on the
  // item; the RENDERER maps them to timeline coords at review/apply (D7).
  timelineStart?: number;   // fallback for UNANCHORED shots only (Rev 3)
  duration?: number;
  mode?: 'cutaway' | 'overlay';
}
```

Apply = insert tsx clips (+ create the overlay track if needed) with
`origin { by: 'agent', proposalId }`, one undoable transaction through the
existing `proposal-apply` path (which needs its `kind === 'cut-plan'` filters
in `useTimeline.activeProposal` and the review components generalized — a
`ReviewShotsSection` sibling of `ReviewCutsSection`, with scratch-apply
preview exactly like cuts audition today). *(Rev 3)* Reject = close the
proposal and drop the registry entry — **files stay on disk**. Reject is an
undoable reducer action; deleting files under it would make undo restore an
entry pointing at nothing. This is the D9 rule applied uniformly: no file
deletion on any undoable action (folder-as-truth already ignores
unreferenced folders). The single-proposal guard carries over and *(Rev 3)*
becomes **kind-agnostic**: today `activeProposal` filters
`kind === 'cut-plan'` (`useTimeline.ts:450`), so a live shots review would
not stop the agent opening a cut plan on top of it — two open reviews, one
scratch-applied to the preview, is a state nothing defines. Rule: **one
open proposal at a time, across all kinds** (`reviewOpen` counts any), and
`handleAgentProposal`'s unconditional `selectCut(items[0])` branches by
proposal kind.

**Direct user entry** *(kept, small)*: a "Generate shot" action in the media
pool / inspector drives the same main-side service over a
`STUDIO_SHOT_GENERATE` IPC + a `StudioShotJobEvent` push channel (the
transcript/proxy job-event pattern), and inserts the clip directly —
*(Rev 3)* the playhead position is recorded at click time and the clip
lands there (first free span on the target lane) when generation completes,
selected, as one undoable step — "buttons and chat converge". The
Creator's `tsx-job-engine` is not reused: its statuses/channels are
Creator-UI-shaped, and shots don't need its persistence/queue for v1.

**The `studio-make-tsx` skill** (folder skill, `resources/skills/`): the
ported `make-tsx` design policy — composition craft, pacing, the required
`export const compositionConfig` (literal values only — the parser does not
evaluate expressions), background rules per kind (cutaway: opaque fill;
overlay/title: fully transparent), the react/remotion-only + single-file
import rule, the marked `WORDS`/timing-constants block, *(Rev 3)* all
timing math in **seconds × fps via `useVideoConfig()`** (a literal
`compositionConfig` is still required, but the animation must survive an
fps change — never hardcode frame counts), and *when* to reach for the tool
(word tables in the takes-view markup it already reads via
`get_transcript`).
Policy in the skill, contract in the tool schema — the `studio-clean-cut`
split, kept.

**Recommendation:** all of the above; agent path and pool button share one
main-side `shot-generator.ts` service.

## D9. Edit / regenerate round-trips — no orphaning

- **Edit**: instruction (from inspector box or chat) → `editTsxPipeline`
  with `chat.json` history → `writeNextVersion` → reducer action
  `shot-set-version` bumps `activeVersion` (one undo step; disk is
  append-only so undo/redo just flips the pointer). Preview re-imports on the
  new content hash; nothing touches clips.
- **Regenerate** (fresh take, same anchor): `generateTsxPipeline` with the
  original prompt + re-read anchor words → new version, same flow.
- **Duration mismatch**: clip duration stays authoritative. A shorter shot
  simply holds its final state for the remainder (time-driven TSX renders
  fine past its internal end); a longer one truncates. When a version bump
  changes `config.durationInFrames`, the inspector offers a one-click
  "resize clips to shot length" (a normal clip-update op) — never automatic.
- **Version pinning is per-shot, not per-clip.** Two clips of one shot always
  show the same version; duplicating a shot (new id, files copied) is the
  escape hatch when divergence is wanted *(v2 if ever)*.
- **Deletion**: deleting a shot that clips reference prompts and removes
  those clips in the same undoable transaction (document side); the files go
  to a `shots/.trash/` sweep only on the *next save* after undo history can
  no longer restore the reference *(simplest v1: files are left on disk;
  folder-as-truth ignores unreferenced folders, and project delete removes
  everything)*. Deleting clips never deletes the shot — it stays in the pool.
- **Missing on open** (folder gone, cloud-sync half-state): shot `status:
  'error'`, clips render the placeholder, inspector offers regenerate —
  mirrors missing-media handling; nothing crashes, nothing is silently
  dropped from the document.
- *(Rev 3)* **Document/undo integration, enumerated** — the grill showed
  "one field bump" undersold it. `EditDoc` grows `shots`, which touches
  every hand-built literal in the reducer: `commit()`'s identity
  short-circuit (`useTimeline.ts:137` — a shots-only change would otherwise
  be swallowed), the `proposal-apply` case's `{ timeline, proposals }`
  literal (which as-written would *drop* the field), `reset`, `EMPTY_DOC`,
  and the write-back effect's guard + write. And **generation completing is
  not a committed action**: a background `shot-add`/status flip enters
  through a non-committing path (like `reset` — no history entry), so a
  finishing shot never wipes the user's redo stack or plants an undo step
  they didn't perform. Undoable shot ops are exactly the user-meaningful
  ones: `shot-set-version`, delete-with-clips, and the proposal actions.
- *(Rev 3)* **Reconcile on open**: scan `shots/` against the registry —
  entries stuck `generating` (crash mid-run) flip to `error`; folders with
  no registry entry are ignored (the same folder-as-truth stance versions
  already take).

**Recommendation:** as above — the invariant is that clips reference an id
that the document always resolves *somehow* (ready / error / placeholder),
never a dangling file path.

## D10. UI surfaces (v1)

- **Media pool**: a "Shots" section listing `shots[]` (name, kind badge,
  status/version); drag to timeline creates a tsx clip via `clip-factory`
  (new `clipFromShot`); "Generate shot" button.
- **Inspector (tsx clip selected)**: shot name/kind, anchor readout, version
  picker (folder-scanned), edit-instruction box (→ edit job), Regenerate,
  "resize to shot length" when mismatched.
- **Timeline**: tsx clips get a distinct tint + kind glyph; otherwise they
  are ordinary clips — move/trim as-is; *(Rev 3)* split and crossfades stay
  content-aligned via the tsx `sourceIn`/frame-offset semantics (D5;
  without them, the right half of a split would restart the animation from
  frame 0 — the Rev 1 "works for free" claim was wrong).
- **Review**: `ReviewShotsSection` with per-item accept/reject + "Preview
  shot" audition (scratch-apply + park, the cuts pattern).

## D11. Brands *(Rev 2)*

Ported intent of the reference `brand-setup` skill, made native. Storage and
UI detail live in `ASSET_LIBRARY_DESIGN.md` §L3; what shots need to know:

- **App-level library, multiple brands** at `brands/<slug>/` inside the
  assets root (the existing `asset-library` feature's tree — see the
  library doc L1/L3 Rev 3; `brand.json` + logo refs). `defaultBrandId` lives
  in Studio settings; a new project **copies** the default into
  `project.settings.brandId` at creation — explicit, so changing the app
  default later never silently restyles an old project. Switchable per
  project any time.
- **v1 brand shape**: name, palette (primary / secondary / background /
  text / accent), fonts (Google + system in v1; local font files are
  ledgered for v2), logo asset refs, free-text style notes.
- **Generation contract**: the shot tool injects the active brand into the
  prompt context and the `studio-make-tsx` skill mandates honoring it —
  palette tokens, brand fonts, logo placement per notes. Existing shot
  versions keep their look (baked TSX); the inspector offers **"Restyle to
  brand"** = a regenerate with the (new) brand injected.
- **Brand-scoped search**: assets carry an optional `brandId` tag; with an
  active brand, `search_assets` defaults to brand-tagged + unbranded assets
  — a smaller haystack for the agent, automatically.

## D12. Media inside shots *(Rev 2)*

What makes shots look professional: logos, screenshots, product footage
*inside* the generated composition.

- **`assetRefs: Record<key, assetId>` on the shot** (D1 registry). The
  serializer resolves refs to URLs per environment and passes them as
  `assets` props (D5); generated code uses `<Img src={assets.logo}>` /
  `<OffthreadVideo src={assets.demo}>` — never a file path.
- **Import-on-use seam**: the app-level library is a *picking surface, not a
  reference domain*. The moment a library asset is used — timeline clip or
  shot ref — it is imported into the project as a normal `StudioMediaAsset`
  (referenced in place at its library path, description carried along). The
  document stays self-contained; probe/proxy/thumbnails/relink machinery
  untouched; the library never appears in `project.json`.
- **`generate_image` agent tool** (wraps the existing `imageEngine`): output
  is *born managed* in the library (`generated` origin), auto-tagged with
  the active brand, its generation prompt saved as the initial description.
  Additive → no proposal of its own; visible as a tool event, judged through
  the shot proposal that uses it.
- **`capture_webpage`** feeds screenshot material the same way (library doc
  §L6) — the road to fake-screencast-style shots.
- **Perf note**: video-inside-a-shot means a second decoder during preview —
  fine for short cutaways; added to the perf guardrails to measure, not fear.

## Out of scope (v2+)

Ledgered with owners and context in **`V2_FEATURES.md`** — headline items:
fake-screencast skill port; props-driven word sync; three/R3F import
surface; per-shot bake-to-proxy preview; auto re-sync after under-shot
cuts; per-clip version pinning; opening shots in the Creator editor; shot
templates/library.

## Test plan sketch

- **Unit**: serialize tsx clips (component-key emission, missing/not-ready
  drop, transitions on tsx clips); shot ops (add/set-version/delete with
  clip cascade, undo round-trips); shot-plan proposal build/apply/reject;
  anchor → shot-local word math; import-lint allow/reject table;
  export-entry emits imports + map for exactly the referenced ready shots;
  *(Rev 2)* asset-ref resolution (preview vs export URLs, missing ref →
  shot drop rule); brand-context injection snapshot; bulk-pass cap guard.
- **Live CDP**: chat → generate (progress events) → review → apply → shot
  visible in Player at the anchor word (frame screenshot); edit round-trip
  (v2 appears, preview updates, undo returns to v1); broken-shot placeholder
  (hand-corrupt a version) without Player crash; export → extracted frame
  contains shot pixels at the right time; export pre-flight blocks on an
  invalid shot with a readable error.

---

## Decision checklist — ANSWERED (Hasan, 2026-08-14)

All 14 items accepted as recommended (walked through in chat; #2 cutaway
semantics and #4 the Spike 0 gate explained and confirmed; #5 answered:
**react + remotion only** in v1). This doc is implementation-ready pending
Spike 0's verdict on D4. Original items kept for the record:

1. **Shot registry (D1)** — top-level `shots: StudioShot[]`, clips carry
   `tsx: { shotId, mode }` (replacing `filePath`, no schema bump since no
   documents have tsx clips): **OK?**
2. **Placement (D2)** — cutaways *cover* from an upper lane (master keeps
   playing underneath), never displace the master track: **OK?**
3. **Title (D2)** — a skill category of overlay (text-first + word-synced),
   not a third schema mode: **OK?**
4. **Preview (D4, Rev 3)** — Option A gated on **Spike 0** (packaged-build
   cross-origin module import into an in-app Player), run before any other
   S4 work; bake-to-proxy is the named fallback if it fails; error-boundary
   + placeholder containment; accepted: a pathological infinite loop in
   shot code can hang the editor: **OK?**
5. **Import surface (D6)** — v1 shots may import `react` + `remotion` only,
   enforced by tool-side lint (three/R3F deferred): **OK, or include the
   three stack now?**
6. **Word sync (D7)** — baked shot-local timings + recorded anchor
   (regenerate re-bakes); props-driven sync deferred to S5-adjacent work:
   **OK?**
7. **Proposal flow (D8, Rev 3)** — generate-then-propose so review can
   preview; rejected shots keep their files (registry entry removed — no
   file deletion on any undoable action); **one open proposal at a time
   across all kinds**; direct pool-button generation inserts at the
   recorded playhead without a proposal: **OK?**
8. **Proposal item shape (D8)** — extend `StudioProposalItem` with optional
   shot fields (no discriminated union yet): **OK?**
9. **Versioning (D9)** — per-shot `activeVersion` (no per-clip pin); on
   duration change, clips stay put and the inspector offers resize: **OK?**
10. **Deletion (D9)** — deleting a referenced shot prompts and removes its
    clips in one undo step; files stay on disk (unreferenced folders are
    ignored): **OK?**
11. **Bulk passes (D8, Rev 2)** — chat-level plan gate before multi-shot
    generation; `get_transcript` range params; 10-shot per-pass cap; tool
    stays one-shot-per-call: **OK?**
12. **Brands (D11, Rev 2)** — app-level multiple brands, default copied into
    the project at creation (never restyled retroactively); v1 fonts limited
    to Google + system: **OK?**
13. **Media in shots (D12, Rev 2)** — `assetRefs` resolved to asset props by
    the serializer (the one props channel); import-on-use seam;
    `generate_image` runs without its own proposal: **OK?**
14. **tsx `sourceIn` semantics (D5, Rev 3)** — shot clips carry
    `sourceIn: 0`, the serializer emits `trimBefore`, the composition
    applies a frame offset (split continuity + crossfade alignment):
    **OK?**

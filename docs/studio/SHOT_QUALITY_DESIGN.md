# Shot quality design — agent continuity · linked folder · kit · style memory

> Written 2026-08-19 after the first full-pipeline live test on real footage
> (project "Raw Footage Test") and the review discussion with Hasan. Same
> pattern as `TSX_SHOTS_DESIGN.md`: each decision lays out options, names a
> recommendation, and the checklist at the end is answerable inline. Several
> decisions were **already taken in chat (Hasan, 2026-08-19)** and are marked
> DECIDED — they are recorded here, not reopened.
>
> **The problems this doc answers** (both surfaced by the live test):
> 1. Shots generated in one session are stranded from the agent afterwards —
>    `propose_shots` only accepts ids from the in-memory per-pass map
>    (`studio-agent.ts:356`), there is no pool-inventory tool, and the
>    Assistant transcript dies with the renderer. The agent's honest reply
>    ("I can't see an existing shot pool from here") is the spec of the gap.
> 2. Generated shots are visually basic next to the reference work in
>    `claude-youtube-editor` (`remotion/src/shots/video-2` — same DJI footage,
>    25 shots, a 740-line video-local `_shared` kit over a 1,061-line repo kit,
>    storyboard headers with per-cue frame timings, ROUND-7 iteration notes).
>    The gap is not the model; it is everything around the model: no component
>    vocabulary, no exemplars, one-line briefs, and a fix loop that repairs
>    validity but never looks at quality.
>
> Plus one scope addition from Hasan: a **linked folder** between Studio
> projects and the TSX Creator library, both directions.
>
> This doc **promotes two parked V2 items**: the module-server import-map
> ("widened import surface") and the fake-screencast port — both from
> `V2_FEATURES.md`. Kit internals get their own build slices; this doc owns
> the decisions.

## What already exists (the design builds on, not around, these)

- **Agent tools** (`studio-agent.ts`): get_transcript, generate_tsx_shot,
  propose_shots, propose_cuts, generate_image, capture_webpage,
  propose_memory. `propose_shots` validates against `generatedShots`, a map
  scoped to the current pass — nothing reads the registry.
- **Chat transport**: the renderer owns the transcript and replays
  `history: ChatMessage[]` to main on every send
  (`shared/ipc/types/studio.ts:314`); each turn spawns a fresh claude.exe.
  Persisting the transcript therefore restores *agent continuity*, not just
  scrollback.
- **Registry & files**: shots exist because `project.json.shots[]` says so;
  `normalizeShots` reconciles stuck states on load but **orphan
  `shots/<id>/` folders are invisible** (verified during the crash-recovery
  leg of the live test). Each shot folder carries `chat.json` + debug
  sidecars — enough to reconstruct kind/brief for adoption.
- **D14 import**: `importShot({projectId, sourcePath, name?, conform?})` is
  source-agnostic (gate = transpile + react/remotion lint + config parse;
  conform-on-import for the Creator-allowlist gap). The Creator library and
  Studio shots already share the folder-of-`v*.tsx` shape — D14 chose that
  deliberately.
- **Packs precedent**: caption packs (`resources/caption-templates/core/` +
  `packs/` scan, namespaced ids, corrupt-pack degrade) are the packaging
  model for anything folder-shaped.
- **Module server**: content-hash module URLs, virtual modules
  (`remotion.js`, `react-jsx-runtime.js`) already served; Spike 0 proved
  packaged-build ESM import into the Player.
- **Brand injection**: `buildShotExtraInstructions` injects palette/fonts/
  styleNotes verbatim as a MANDATORY block; `styleNotes` caps at 2000 chars.
- **Memory (G phases, shipped)**: store with `brandId?` on entries and a pure
  brand filter in composition (`agent-memory-prompt.ts:101` — brand-scope UI
  was cut, the data model survived). `propose_memory` capture is gated behind
  review; injection goes into the **agent's** system prompt only — the
  pipeline model never sees memory today.
- **Capture**: hardened hidden BrowserWindow (sandbox, permission denies,
  2× render) — Playwright was **deliberately rejected** in
  ASSET_LIBRARY_DESIGN; visible mode + CaptureChip for auth walls.
- **Safety seams**: `OpenProjectContext` (renderer-level, L7) publishes which
  Studio project is open; describe-availability re-probes on window focus —
  the no-watcher precedent.

---

## Q1 — Agent continuity: the registry is the agent's memory

### Q1a. `list_shots` tool — DECIDED (build)

A read-only tool over the registry: id, name, kind, duration, anchor
(assetId + span), activeVersion, status, origin. No new state. The agent's
"I have no handle on their IDs" disappears.

### Q1b. `propose_shots` accepts any ready registry shot — DECIDED (build)

The membership check widens from `generatedShots.has(id)` to "exists in the
registry AND status ready". Everything downstream (`buildShotPlanProposal`,
review panel, audit gate) already works from shot objects. The per-pass cap
still applies to *generation*; proposing existing shots is free.

### Q1c. Reconcile `shots/` ↔ registry on project open

**One mechanism serves two masters**: crash orphans (folders the registry
never adopted) and the linked-folder drop-in (Q2). On project open and on
window focus (Q2 decision), scan `shots/` for folders with `v*.tsx` but no
registry entry and run the **existing D14 gate** on the newest version:

- Pass → adopt: registry entry, pool card. Metadata from `chat.json` /
  debug sidecar when present (generation-born orphans have them); otherwise
  name from the folder, kind `cutaway`, no prompt (Regenerate disabled —
  the D14 imported-shot rule).
- Conformable fail → surface the D14 "Convert for Studio" affordance on the
  pool card, exactly like a picker import.
- Hard fail → error-status pool entry the user can delete; files stay.

*Recommendation*: adoption is **silent for gate-passing shots** (a toast
"2 shots adopted from disk"), never silent for failures. No confirm dialog —
the pool is already the review surface, and rejecting = deleting the card.

### Q1d. Persist the Assistant transcript — DECIDED (Hasan, 2026-08-19)

- **Where**: `<project>/agent-chat.json`, beside project.json — conversation
  is work-product and travels with a handed-off project folder. NOT under
  `cache/` (Clear Cache must never eat a conversation). Write-behind after
  each completed turn; corrupt file set aside on load (memory-store
  precedent).
- **Replay cap**: the UI keeps the full transcript; the request replays only
  the last N turns. History is append-only → prompt-cache-optimal; a rolling
  summary would invalidate the prefix every turn and is rejected. N is a
  constant, not a setting. *(Open: N — recommendation 30 user/assistant
  turns.)*
- **Explicit reset**: a "New conversation" action in AgentPanel. Today
  restart is an accidental reset; once persistence lands, reset must be a
  choice. The old transcript is renamed (`agent-chat.<ts>.json`), not
  deleted, capped at the 3 most recent.
- Proposal refs / tool-event lines persist as the display rows they already
  are; open proposals themselves already survive restart via the document.

---

## Q2 — Linked folder: Studio shots ↔ Creator library — DECIDED (Hasan, 2026-08-19)

The formats already agree (folder of `v*.tsx` on both sides), so this is a
*mounting* design, asymmetric on purpose:

- **Studio → Creator: a live view, not a copy.** The Creator library gains a
  "Studio" section listing every Studio project's `shots/` folders in place,
  grouped by project ("Raw Footage Test / Intro title"). Open → edit → save.
- **Append-only versions** *(decided: yes)*: Creator saving into a Studio
  shot folder always writes `v(n+1).tsx`, never edits `v(n)` in place —
  sidesteps preview-cache and undo ambiguity entirely. Studio's version
  picker already folder-scans, so the new version appears; **activeVersion
  never auto-flips** — the Inspector shows the newer version and flipping
  stays the existing one-undo dispatch.
- **Open-project safety** *(decided: yes)*: Creator warns before saving into
  a shot whose Studio project is currently open (`OpenProjectContext`, both
  screens share the renderer). Warn-and-proceed, not block — append-only
  writes are safe; the warning is about preview surprise, not corruption.
- **Scan trigger** *(decided: focus/open)*: project-open + window-focus
  rescan (describe-availability precedent). No filesystem watcher in v1.
- **Creator → Studio: gated adoption** *(decided: pool-only landing)*: a TSX
  dropped into a project's `shots/` (Explorer drag, or a later in-app "Send
  to Studio project…" affordance) is picked up by the Q1c reconcile — gate,
  conform when needed, registry entry, pool card. The user places it; no
  auto-timeline landing (the end-card lesson from the live test).
- **Dialect note**: until Q4's import-map lands, Creator comps using
  chroma/@remotion/shapes/google-fonts need the conform LLM pass to enter
  Studio. After Q4 the allowlists converge and conform becomes the fallback,
  not the norm. Sequencing matters (see Slices).

---

## Q3 — Quality Layer A: what the pipeline model reads

### Q3a. Exemplars pack — DECIDED source (Hasan, 2026-08-19)

2–3 finished shots per kind (cutaway / overlay / title), ported from
`claude-youtube-editor` (`shots/example/` + video-2's kit-free shots),
**brand-scrubbed to tokens** — shipped at `resources/shot-exemplars/`
(folder-shaped like caption packs; becomes the "style pack" door later, and
the repo goes public so nothing brand-specific may ride along). Injected
into the shot prompt as a static prefix section ("this is the bar — match
this level of layout, staggering, and choreography"), cache-friendly.

*(Open: exemplar count/budget — recommendation 2 per kind, ≤120 lines each,
≈8 KB total; measure cache-write cost before widening.)*

### Q3b. Storyboard-grade briefs (skill text)

`studio-make-tsx` SKILL.md gains a brief grammar modeled on the reference
repo's shot headers: **regions** ("left 60% window, right 40% list"),
**beats keyed to cue words** ("on 'deploys itself' the third row lights"),
density and motion intent. The words table already bakes for ANY anchored
shot (D7) — the skill must direct the agent to anchor cutaways to spans and
choreograph against cues, not only titles. Range reads via
`get_transcript(assetId, start, end)` exist already.

### Q3c. Craft block (shot prompt)

A short design-vocabulary section in `buildShotExtraInstructions` (or the
shared 2D prompt for shots): stagger discipline, easing families and when
each reads well, spatial rhythm / thirds, density ceilings, "one accent per
beat". This is taste-as-rules; the exemplars are taste-as-evidence — ship
both, they reinforce.

### Q3d. Validation A/B

Before any Layer B work: regenerate the live-test intro + end card on
"Raw Footage Test" with Layer A in place and compare. Cheap honesty gate on
whether exemplars+briefs move the median before the kit scope is committed.

---

## Q4 — Quality Layer B: the kit (fake screencast as components)

The reference repo's power tools are `<FactoryWindow>`, `<AgentFeed>`,
typed-text with cursor, terminal/browser/VS Code chrome — hundreds of lines
a per-shot generation can never rebuild. They become a **core shot-kit
pack**:

- **Shape**: `resources/shot-kit/core/` — pack.json + components + a
  MANIFEST (component names, prop signatures, one-line usage) that the
  prompt cites verbatim. Versioned (`kitVersion` in pack.json). Contents
  ported from `claude-youtube-editor` `lib/{kit,browser,vscode,screencast}`
  + the best of video-2 `_shared`, brand-scrubbed.
- **Delivery**: module-server import-map serves the kit under a virtual
  specifier (recommendation: `@vidtsx/kit`) — the parked V2 "widened import
  surface", promoted. Shot lint learns exactly one allowlist entry.
- **Export**: the entry copy step (D6 pattern) copies the kit version the
  project was built against beside the shot copies and rewrites the
  specifier — old projects re-render identically forever, kit upgrades never
  restyle existing exports.
- **Brand**: kit components take tokens as **props**; palette resolves
  before the component sees it (the captions rule — kit never imports the
  brand system).
- **Prompt**: a KIT section (manifest + 2 mini-usage examples) and the Q3a
  exemplars rewritten in kit vocabulary.
- **Editing**: kit source is user-visible (extraResources, the skills
  precedent) but treated read-only in v1; "fork a kit component into a
  shot" is ledgered v2.

*(Open: initial component roster — recommendation: window chrome (generic +
VS Code + browser + terminal), TypedText, AgentFeed, StatBlock, GuidePage,
DeviceFrame, EASINGS. Cut list is a checklist item, not scope creep room.)*

### Q4b. Scripted capture (follow-on, not v1 of the kit)

"Real screencast" content stays two-source: kit renders the *motion*
(typing, feeds, cursors — synthetic is crisper and deterministic);
`capture_webpage` supplies real *content* stills. A **scripted capture v2**
(navigate → scroll → type → click → capture N stills) extends the existing
hardened hidden window via `webContents.sendInputEvent` + `capturePage` —
**no Playwright**, preserving the ASSET_LIBRARY_DESIGN decision and its
security posture. Rides after the kit; design details land as a rev on
ASSET_LIBRARY_DESIGN when scheduled.

---

## Q5 — Quality Layer C: the refine loop

A **user-triggered "Refine" button** on the shot (Inspector, beside
Regenerate): render 2–3 stills of the current version (preview/transpile
infra exists), send them + the brief + the brand block to the app-default
vision provider, one critique-and-revise pass through `editTsxPipeline`,
capped at 1 round per click. Always-on automatic rounds are ledgered until
the button proves the critique moves quality (and what it costs).
*(Open: confirm button-first — recommendation yes.)*

---

## Q6 — Style memory: the agent learns the user's style, per brand

**DECIDED (Hasan, 2026-08-19): route (b) — memory-with-promotion.** Learned
style lives in the existing G-phase memory store (userData, machine-local,
review-gated); the **brand folder carries only the curated contract**
(`styleNotes`), and stable learned rules get *promoted* into it with
explicit approval. Grounds: the assets root is synced/relocatable content —
high-churn learned writes there invite conflicts; the consent/revocation
machinery (propose → review → deactivate/edit/delete) already exists only on
the memory side; and promotion-as-curation keeps the portable artifact
trustworthy for the agency case (an editor serving multiple client brands).

Build pieces:

- **Q6a. Pipeline injection.** `buildShotExtraInstructions` gains a style
  block: brand-filtered rule/profile memories (the existing pure filter)
  injected into every generate/regenerate beside the brand contract.
  Deterministic — does not depend on the agent copying rules into briefs.
  Char-budgeted like the agent-side block. Shot-generator already loads the
  project brand; this is one more read.
- **Q6b. Capture triggers (skill/prompt text).** The agent treats as
  style signals: repeated edit instructions across shots ("subtler" twice),
  review rejections with stated reasons, regenerate patterns — and proposes
  a brand-scoped rule via the existing gated `propose_memory`. Silent
  inference stays rejected (G design, reaffirmed).
- **Q6c. Promotion.** When a brand-scoped rule has held stable across shots,
  the agent proposes promoting it into the brand's `styleNotes` ("this has
  applied across N shots — make it part of the brand?"); accept = one click,
  the memory is retired to avoid double-injection. `styleNotes` caps at
  2000 chars → promotion respects a budget and the proposal must say what
  it would displace; a richer per-brand style file is ledgered v2.
  *(Open: stability threshold — recommendation: agent judgment with the
  proposal naming the evidence, no hard counter.)*

---

## Sequencing (slices)

1. **Continuity slice** — Q1a + Q1b + Q1c + Q1d + Q2 (the linked folder IS
   mostly Q1c + a Creator library section). Small, unblocks daily use.
2. **Layer A slice** — Q3a–c, then the Q3d A/B on Raw Footage Test.
   Prompt/skill text only.
3. **Kit slice** — Q4 (import-map, gate, export pinning, manifest, prompt).
   The big one; exemplars re-cut in kit vocabulary at the end of it.
4. **Style memory slice** — Q6a first (pure plumbing), Q6b/Q6c with it or
   just after; Q5 Refine button once the kit gives it something to refine.
5. **Scripted capture** — after the kit, as an ASSET_LIBRARY_DESIGN rev.

> **Rev 2 — 2026-08-20: Slice 1 SHIPPED (commits SQ1–SQ4) and live-proven on
> "Raw Footage Test" (drop-in adopted on open, agent listed the full pool via
> `list_shots`, transcript persisted, Creator Studio section live).**
> Implementation notes vs the doc: (a) reconcile failures are surfaced via
> toast/banner and NEVER minted as error registry entries — an error card per
> focus rescan would re-litter the pool; the Q1c "error-status pool entry"
> line is superseded. (b) The Q2 open-project warning shipped as a
> save-time heads-up toast rather than a pre-save confirm: append-only writes
> made the blocking dialog pure friction, and MotionScreen (which owns the
> save UI) was carrying parallel-session edits. Revisit only if the toast
> proves too quiet. (c) Replay cap N=30 is implemented as 30 exchanges
> (60 messages). Remaining unproven leg: Creator-save → v(n+1) → Studio
> version picker, unit-tested but not yet walked in the app.

## Checklist — ANSWERED (Hasan, 2026-08-20)

Decided in chat 2026-08-19 and recorded above, not re-asked: Q1d location +
reset, Q2 (append-only / warn / focus-open / pool-only), Q3a source, Q4
greenlight, Q6 route (b).

1. **Q1d** replay cap N = 30 turns — **yes.** Integration note (from Hasan's
   review): the existing context-usage warning
   (`useStudioAgent.ts` `contextUsage` + AgentPanel amber banner) currently
   counts ALL messages — correct while everything replays, wrong once
   persistence lands. Commit 3 must (a) count only the replayed window,
   (b) turn ↺ into "New conversation" (rotate, keep 3), (c) update the
   warning copy. Post-cap, the warning fires mostly on transcript weight.
2. **Q1c** silent adoption for gate-passing shots, toast only — **yes.**
   Failures always get a visible error/convert card.
3. **Q3a** exemplar budget 2 per kind, ≤120 lines — **yes.** Revisit after
   the Q3d A/B.
4. **Q4** roster — **amended (Hasan): the browser is the flagship and must
   be a *navigable fake browser*, not static chrome.** `<BrowserWindow>`
   takes a navigation script — type URL in the address bar → loading state →
   page reveal → scroll-to → navigate again — with page content supplied as
   `capture_webpage` stills, so it can "open and navigate any page".
   Consequences: capture gains a tall-viewport option in the kit slice
   (full-height stills so in-browser scrolling pans over real pages);
   click-through interaction stays scripted-capture v2 (Q4b). Roster v1:
   chrome ×4 (generic / VS Code / **navigable browser** / terminal),
   TypedText, AgentFeed, StatBlock, EASINGS. GuidePage + DeviceFrame defer
   to the first kit update.
5. **Q4** `@vidtsx/kit` — **yes.** Release-checklist side item: register the
   `@vidtsx` npm org before the repo goes public so the specifier can never
   be shadowed.
6. **Q5** Refine as user-triggered button first — **yes.**
7. **Q6c** promotion threshold by agent judgment, evidence named in the
   proposal — **yes.**

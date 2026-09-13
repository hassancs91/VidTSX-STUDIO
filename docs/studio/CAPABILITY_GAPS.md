# Studio capability gaps — what a real edit needs that we cannot express

> **Question Hasan asked (2026-08-29):** "we should rethink any limitations our
> studio has, it should be capable to create any edit we want to our videos."
>
> This is the answer, derived from evidence rather than brainstormed. Nothing
> here is a decision — it is the list a decision would be made from.
>
> Companion: `scripts/migrate-editor-project.mjs` (the migration that produced
> the Tier-1 findings), `docs/studio/PLAN.md` (the model as designed).

## Method

Three sources, in descending order of how much they should be trusted:

1. **A real project, migrated.** `claude-youtube-editor/videos/video-2` — a
   10.5-minute video, 632 s master, **24 TSX shots, 3,660 lines**, 67 % of the
   running time covered by TSX. Migrated into Studio for real (not analysed on
   paper), so every Tier-1 gap below is something that actually stopped a real
   shot from arriving intact.
2. **A second real project, for comparison.** `video-1` — **77 shots**, all of
   them `cutaway` or `overlay`. Studio expresses **100 %** of video-1. That
   matters: it tells us the model was right for the material it was designed
   against, and that the gaps are *new* demands, not original sins.
3. **A sweep of the model itself** against ordinary editing operations. These
   are Tier 2: real absences, but nothing has yet demanded them, so they are
   listed to be judged rather than queued.

**Bias worth naming:** two projects by one editor is a narrow base. It is
strong evidence about *Hasan's* editing and weak evidence about editing in
general. Every Tier-1 item is grounded; Tier-2 items are reasoned.

## What Studio can express today

The complete vocabulary, so the gaps are readable against it:

| | |
|---|---|
| Tracks | `video`, `overlay`, `audio`, `caption` |
| Clips | `video`, `audio`, `image`, `tsx`, `caption`, `sfx` |
| Clip properties | `sourceIn`, `duration`, `speed` (constant), `gain`, `fadeInSec/OutSec` |
| Transform | `x`, `y`, `scale`, `rotation`, `opacity` — **static, no keyframes** |
| Transitions | `crossfade`, `dip-to-black` |
| TSX modes | `cutaway` (opaque cover), `overlay` (transparent composite) |

## The organising finding

Every confirmed gap sits on one boundary, and naming it makes the list
predictable instead of arbitrary:

> **A TSX shot can do anything it likes to pixels it draws itself. It can do
> nothing to the master's pixels, and nothing to the timeline's shape.**

This is why video-1 needed nothing: 77 shots that draw their own pixels. It is
why video-2 needs four things: it started asking the master to participate —
be cropped into a box, pause while something else plays — and asking shots to
carry their own media.

So the useful question is not "what does an NLE have that we lack" (a long,
mostly irrelevant list). It is **"where must Studio touch the master, or the
timeline's shape?"** That is a short list, and it is below.

---

## Tier 1 — proven by migrating video-2

`node scripts/migrate-editor-project.mjs --video=video-2` → **20 of 24 shots
migrate**, 422.5 s of TSX over a 632 s master. The four that do not, and the
one that only half does, are the gaps.

### G1 · Crop and box placement — *3 shots, ~100 s of video-2*

The reference's `split` type scales and crops the master into a rectangle
(`master_box` in design-space px) with a chosen crop centre and zoom, and
composites a transparent TSX over it — a PiP where the shot draws everything
and leaves a hole for the master.

Studio's transform has `scale`/`x`/`y` but **no crop and no destination box**,
so there is no way to say "this region of the master, in that rectangle".
`ColdOpenPrompt` (a circular face PiP at 1.5× crop zoom) is not approximable by
scale+translate — without clipping, the master overflows its hole.

**Why it can't be pushed into TSX:** the shot would have to render the master
itself, and a shot cannot reach the master lane.

### G2 · Time insertion / ripple — *1 shot, 8.7 s*

The reference's `insert` **pauses the master clock**: at 109.7 s the master (and
any cutaway running across that point) freezes, an 8.7 s shot plays with *its
own audio*, then everything resumes — every later beat lands 8.7 s later, and
the output is 640.9 s rather than 632.2 s.

Studio's shots "cover, not displace" by design. There is no operation that
lengthens the timeline by inserting time.

**Partially expressible:** split the master into two clips with an 8.7 s gap and
put the TSX in the gap. Worth prototyping — it may be that G2 is a *UI* gap
(no "insert" operation) rather than a *model* gap. Note the reference also
splits `B2bVideo2022` across the insert and resumes it at `@+17.80s`, so a real
implementation must let a shot's own clock pause too.

### G3 · Shot-owned media — *10 of the 20 migrated shots*

Half the shots load images and video (`lib('projects/video-2/yt-2022/thumb.jpg')`,
`lib('library/logos/vscode.webp')`). Rendered standalone with no media
resolution, **10 of 20 shots render and 10 fail** — purely on assets.

Studio *has* the right mechanism (`shot.assetRefs` → resolved URLs on the
`assets` prop, and a rule that generated code must never hardcode a path,
precisely so preview and export agree). What is missing is any **path from an
existing shot into it**. The migration currently rewrites the kit's `lib()`
helper to absolute paths, which Studio's `staticFile` override resolves — so
**preview works and export does not**, the exact asymmetry the rule exists to
prevent.

This is the gap most likely to bite outside this migration: any shot anyone
writes elsewhere and brings in has the same problem.

### G4 · The SFX layer is a stub — *79 events in video-2*

video-2 carries **79 placed SFX cues** with per-cue gain, plus a music pass.
Studio has the `sfx` clip kind, and `StudioProposalKind` lists `'sfx-plan'` —
but that string is the **only** occurrence in the codebase. There is no
library, no placement, no proposal runner.

Also: `StudioAssetKind` is `video | audio | image`, so an SFX library would
arrive as undifferentiated audio assets today.

### G5 · Studio's lint is stricter than Studio's runtime — *blocked all 24 shots*

Every shot failed the import gate on `react/jsx-runtime` and
`remotion/no-react` — **both of which the module server serves**, and both of
which resolve natively at export. The gate also greps for literal
`export default` / `export const compositionConfig =`, so a bundled file whose
exports are identical but written as `export { X as default }` is rejected.

Small, but it makes "bring a TSX from anywhere" harder than it needs to be, and
`shot-import.ts` exists specifically to make that easy. The migration works
around it rather than loosening it — that call belongs to a review of the gate,
not to a migration script.

---

## Tier 2 — found by sweeping the model, not yet demanded

Real absences. **None has been asked for by either project**, and for a
specific reason worth stating: *the reference absorbs all of these inside TSX
shots*, which is the escape hatch working as designed. Listed so the choice to
keep absorbing them is deliberate.

| # | Gap | Today | Why it hasn't bitten |
|---|---|---|---|
| **G6** | **Animated transform / keyframes** — no move, scale or fade *over time* on a clip; no Ken Burns on a still | `transform` is static | Every animation lives inside a TSX shot |
| **G7** | **Colour** — no LUT, grade, or tone-map control | none | The reference grades upstream; its master arrives finished |
| **G8** | **Speed** — constant `speed` only; no ramps, no freeze-frame | `speed` | Reference freezes via a shot, not the clip |
| **G9** | **Transitions** — 2 kinds | crossfade, dip-to-black | Cuts dominate; shots handle the rest |
| **G10** | **Masks / blend modes** | none | TSX composites its own pixels |

**G7 deserves separate attention.** The reference's master is already graded,
so Studio never sees log footage. But Hasan's raw material is **DJI D-Log**, and
Studio previews and exports it untouched — flat and grey. The moment the
editorial path is used on raw clips (which is the *other* half of the plan,
deliberately deferred), colour stops being Tier 2. It is the one item here with
a known trigger date.

---

## What is NOT missing

Stated so the list is bounded and honest:

- **The master + shots model is right.** It expressed 100 % of video-1 and 83 %
  of video-2, and the migration's failures are four named operations, not a
  structural mismatch.
- **The TSX contract is right.** All 24 shots already carried a default export
  and a `compositionConfig` Studio's parser reads unmodified. 3,660 lines of
  real shot code bundled into Studio's single-file form **with no rewriting**.
- **Cutaway/overlay is the right pair.** 89 of the 101 shots across both
  projects are one of the two.
- **Captions, transcription, auto-cut, packs, brand** — all present, none
  implicated by this exercise.

## Sequencing — a suggestion, not a decision

1. **G3 (shot media)** first. It is the only gap that breaks a *shipping*
   promise (preview/export identity), it blocks half of an already-migrated
   project, and `assetRefs` means the design work is done.
2. **G1 (crop)** next — the largest missing *editing* capability, ~100 s of one
   real video, and independently useful for reframing 4K into 1080p.
3. **G2 (time insertion)** — prototype the two-clips-and-a-gap route before
   deciding it is a model change; it may only need a UI operation.
4. **G5 (the lint)** — cheap, and it makes external shots a supported path.
5. **G4 (SFX)** — a feature, not a gap; size it against the roadmap.
6. **G7 (colour)** — schedule with the raw-footage editorial work, not before.

**Open question this does not answer:** the migration targets 1920×1080 @ 30
because that is what the shots declare, while the reference delivers 4K60. What
Studio should do when shot resolution and delivery resolution disagree is
undecided and is not a gap on this list — it is a design question.

## Third project: video-10, imported whole (2026-09-11)

`claude-youtube-editor/videos/video-10` (10.7 min, 9 raw 4K60 clips, a 277-segment cut,
62 shots: 38 cutaways, 13 overlays, 11 splits) was rebuilt as a Studio project **as if it had been
made here** — raw footage as assets, the cut as 297 master-lane clips placed by the render's frame
counts, AssemblyAI transcripts in the cache, every shot bundled to one file with `assetRefs` for its
104 images, the script, a brand snapshot. Project: `~/Videos/VidTSX Studio/projects/video-10`; the
build script and stills are in its `notes/import/`; the full mapping and gap list in
`notes/IMPORT-REPORT.md`. Studio's own gate passes 62/62 shots; the serializer keeps every clip;
stills rendered with Studio's Remotion match the editor.

What it changes in the list above:

- **G1 is narrower than stated.** A split is expressible today: cut the master clip at the span and
  give it `transform {x, y, scale}` derived from `master_box` + crop centre + zoom; the shot's opaque
  paper hides the overflow and the hole shows the face (verified by render for `B0Terminal` and
  `B4NextUrl`). What is missing is the *authoring* control, not the model. Only shots that are
  transparent outside the hole (a circular face PiP) still need clipping.
- **G3 confirmed, and it renders once written.** `assetRefs` hand-written into `project.json` (SVG
  logos included) resolve through the `assets` prop in preview and export. The UI needs "attach an
  asset to this shot".
- **New: module-scope media.** Shots that call `staticFile()` in top-level constants never see the
  `assets` prop, which only exists at render. The bundle must run its body lazily on first render.
  Any externally-written shot has this shape; a Studio import path must handle it.
- **New: no way in.** No "open folder as project", no raw-folder + cut-list import, no SVG in the
  media import allowlist (the asset server serves it), no home for plans/edit plans/QA reports/takes.
- **New: kit coverage.** The editor's `lib/` (tiles row, chips/bands, Claude-line terminal, PiP hole,
  3D book, screencast) is what real shots reach for; `@vidtsx/kit` covers terminal/browser/VS Code/
  window/stat block/typed text. Bundling inlines the rest, but a shot written *in* Studio cannot.

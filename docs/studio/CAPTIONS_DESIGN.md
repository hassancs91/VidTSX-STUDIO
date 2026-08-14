# Studio captions — template-driven, live-derived (D13)

> Status: **implementation-ready** (walked through with Hasan 2026-08-14;
> the load-bearing decision — captions derived LIVE from the timeline via
> serializer props, never baked — answered explicitly). Scheduled after D12
> (`TSX_SHOTS_DESIGN.md`), which builds the serializer-props channel this
> feature rides.

The v1 goal: CapCut-grade captions for videos — especially shorts — from
**~10 curated templates** that apply instantly, look professional out of the
box, and inherit the project brand (D11). More templates later; the pack is
data, not architecture.

## The two decisions everything follows from

1. **Templates are hand-crafted TSX, not LLM-generated.** Ten parameterized
   react+remotion components shipped with the app. Deterministic, free,
   instant, and quality-controlled — the LLM pipeline stays for bespoke
   shots. "TSX-powered" means they render through the exact same preview
   runtime and export path shots do; it does not mean generation.
2. **Captions follow the EDIT, not the source** *(answered: live props)*.
   The serializer derives the word stream from the master lane's clips at
   serialize time and passes it to the template as **props** — preview and
   export share the code path. Cut the master, captions re-derive; fix a
   transcript typo, captions update. Nothing is ever baked, so nothing can
   desync (the D7 bake is right for a 3-second title and wrong for a
   full-video caption layer).

## What this builds on

- Word-level transcripts per asset (whisper + AssemblyAI) and the word
  slice/re-base math (`shared/studio/shot-words.ts`).
- Title shots prove word-synced TSX overlays render/export correctly.
- D5 serializer + D6 export-entry copy step + the module-server preview.
- **D12's serializer-props channel** (`assets` props) — captions add a
  `words`/`style` prop through the same mechanism.
- D11 brands: template colors/fonts default from `project.settings.brandId`.

## C1. Document model

- `captions?: StudioCaptionLayer` on the project document — **one layer in
  v1**, spanning the whole master lane. Absent field = no captions; no
  schema bump (the shots-field precedent: no shipped document has one).

  ```ts
  interface StudioCaptionLayer {
    templateId: string;            // manifest id, e.g. 'word-pop'
    enabled: boolean;              // toggle without losing config
    style: StudioCaptionStyle;
  }
  interface StudioCaptionStyle {
    position: 'bottom' | 'center' | 'top';
    scale: number;                 // 1 = template default for the aspect
    wordsPerGroup: number;         // 1–6; templates may interpret loosely
    uppercase: boolean;
    colors: 'brand' | StudioCaptionColors;  // explicit override object
  }
  ```

- **Undo**: the caption layer lives in the reducer's undoable slice
  (timeline + proposals + shots precedent). Apply / style change / disable
  are each ONE undoable action.

## C2. Word-stream derivation (the core of the slice)

Pure function in `shared/studio/caption-words.ts`, serializer-called:

- Walk the **master lane** clips in timeline order. For each clip whose
  asset has a word transcript: slice words to the clip's visible source
  window (`sourceIn` … `sourceIn + duration`), re-base to timeline seconds
  (`timelineStart + (word.start − sourceIn)`).
- Concatenate across clips; timeline gaps simply have no words (correct
  behavior, not an error). Untranscribed clips contribute nothing; the UI
  surfaces "N clips have no transcript — transcribe for captions there".
- **Crossfade overlaps**: each clip's words map independently and are
  ordered by timeline time; v1 accepts the brief interleave inside an
  overlap (audio crossfades there too; not worth machinery).
- **Grouping**: split the stream into groups by `wordsPerGroup`, breaking
  early on punctuation and speech gaps > ~0.6 s. Templates receive groups
  with per-word timings and decide highlight behavior themselves.
- Trim/split/move of master clips need no caption logic at all — the next
  serialize re-derives. That is the whole point of decision #2.

## C3. Template pack

- `resources/caption-templates/<id>.tsx` + `manifest.json` (id, display
  name, config defaults **per aspect** — 9:16 wants a higher bottom margin
  and larger scale than 16:9 — and sample words for gallery previews).
- Component contract: default-exported react+remotion component (same
  import lint as shots — they must be resolvable by the preview module
  server) receiving `{ groups, style, palette }` props. `palette` arrives
  resolved (brand or override) — templates never read the brand system.
- Serializer emits the caption layer as a top overlay using the D12
  component/props mechanism; export copies the template file exactly like
  `studio-entry-*` shot sources (D6 pattern, font-URL rewrite included).
- **The v1 ten** (accepted as the starting set; swaps are data changes):
  karaoke highlight · word-pop (Hormozi) · boxed/pill background ·
  one-word center punch · two-line rolling · bold stroke/outline ·
  gradient-fill active word · bounce-in · dim-past/bright-current ·
  minimal bottom line.

## C4. UI

- "Captions" entry point in the editor (toolbar button → right-panel
  section). Template gallery: animated preview cards — each card is a tiny
  Player looping the template over sample words (lazy-mount visible cards,
  unmount when the panel closes). Below: style controls (position, scale,
  words per group, uppercase, brand-colors toggle with custom override),
  Apply / Disable.
- Transcript corrections happen in the existing transcript panel; captions
  re-derive automatically — no separate caption text editor in v1.

## Out of scope (v2 ledger)

Multiple caption layers / per-region captions; caption text overrides
decoupled from the transcript; animated emoji/keyword decoration; template
marketplace / user-authored templates; per-clip caption styles; title-shot
re-sync via the props channel (the channel exists after D12+D13 — wiring
title shots to it is its own small slice).

## Test plan sketch

- **Unit**: derivation (sourceIn/trim windows, re-base math, multi-clip
  concat, gaps, untranscribed clips, crossfade ordering), grouping
  (punctuation/pause breaks, group bounds), brand-palette resolution,
  serializer emission (caption layer present/absent/disabled), export copy.
- **Live CDP**: apply a template → words visible at the playhead frame; cut
  the master lane → captions follow the edit (screenshot before/after at
  the same timeline second); switch template + undo round-trip; brand
  colors reflected; export → extracted frame contains caption pixels.

## Decision checklist — ANSWERED (Hasan, 2026-08-14)

1. **Live props-derived captions** (never baked): **ANSWERED — yes.**
2. **Sequencing** — D13, immediately after D12 rides its props channel:
   **ANSWERED — yes.**
3. Template list — the ten above as the starting set, swap freely later:
   **accepted.**
4. Single layer / whole-timeline span / reducer-owned undo / grouping
   heuristics: accepted as recommended (revisit at slice start only if
   implementation surfaces a conflict).

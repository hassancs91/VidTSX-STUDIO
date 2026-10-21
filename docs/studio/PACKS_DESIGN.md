# Content packs — the convention (v1: shape only, no store)

> Status: **convention accepted (Hasan, 2026-08-14).** Written before D13 so
> the caption-template loader is born pack-shaped. This doc defines a FOLDER
> CONVENTION, not a feature: v1 ships no store UI, no pack manager, no
> licensing. The business plan it serves: the app goes open source; packs
> (caption styles, SFX, TSX templates, starter projects) are sellable
> CONTENT distributed later via the learnwithhasan.com backend — the app
> only ever "loads folders", and commerce stays out of the codebase
> (CLAUDE.md: no cloud credentials in the app, ever).

## The convention

A pack is a folder with a `pack.json` manifest at its root:

```jsonc
{
  "id": "core",                  // folder-safe slug; globally unique per type
  "name": "Core Captions",
  "version": "1.0.0",
  "type": "caption-style",       // caption-style | sfx | tsx-template | project-starter
  "author": "VidTSX",            // optional
  "description": "…",            // optional
  "minAppVersion": "1.0.0"       // optional; loader skips + warns when newer
}
```

- **Locations, two roots per type**: built-ins ship inside the app at
  `resources/<type-dir>/<packId>/` (e.g. `resources/caption-templates/core/`);
  installed packs live in the **assets root** at `packs/<packId>/` — beside
  `brands/`, so they are user-visible in the Assets screen, travel with the
  library, and relocate via the existing root override. Discovery = scan
  both roots; a duplicate pack id is skipped with a warning (first root
  wins), never merged.
- **Install v1 = folder drop** (Explorer). Later: in-app install that
  downloads from the backend with the user's API key and unzips into
  `packs/` — same loader, zero new load-path code.
- **Namespaced item ids**: everything a document references is
  `<packId>/<itemId>` (e.g. `templateId: 'core/word-pop'`). A missing
  referenced item **degrades gracefully** (the stale-`brandId` precedent:
  render nothing / fall back to default, warn once) — uninstalling a pack
  must never corrupt or hard-fail a project.
- **Folder-as-truth**: no registry DB. The manifest is the only metadata
  file; item discovery rules are per-type (below). Corrupt pack → skipped
  on scan with a warning, like corrupt brand folders.

## Per-type notes

- **caption-style** *(first consumer — D13 is the reference
  implementation)*: pack folder contains `<templateId>.tsx` +
  `manifest.json` per CAPTIONS_DESIGN.md §C3 (Rev 2: the per-pack layout
  and namespaced ids supersede the flat `resources/caption-templates/`
  sketch). Templates pass the same import lint as shots.
- **sfx**: audio files in ordinary folders + pre-written descriptions.
  Install = copy into the assets root + batch-register via the library
  store's `upsertEntry` (descriptions are the product — they are what the
  agent searches). Needs no new machinery; not scheduled until an SFX pack
  actually exists.
- **tsx-template**: TSX shot files + briefs/thumbnails; import runs D14's
  acceptance gate (transpile + lint + config parse, conform-on-import for
  out-of-allowlist files). D14's import service must therefore be
  source-agnostic ("import a TSX from anywhere"), Creator being one source.
- **project-starter**: a project folder template, instantiated by copy +
  re-id. Constraint to honor when built: referenced media must live inside
  the pack or the library — never absolute machine paths.
- **craft** *(TSX Builder P4, 2026-10-18; a kind of the multi-kind
  container, beside `transitions` and `filters`)*: know-how the TSX builder
  follows for one build, composed into its system prompt after its house
  method. `pack.json` lists `craft: [{ id, name, role, description, with?,
  suggest?, version }]`; each text is `craft/<id>.md` in SKILL.md format
  (frontmatter `name` + `description`, the body is what the builder reads; at
  most 64 KB, else skipped with a warning). A `role` says what the pack is
  for: a **form** is a kind of piece (its rules and the moves that make it
  good) and may bring other packs (`with`: full ids, expanded nested, each
  once) and suggest the composer's settings (`suggest`: `aspectRatio`
  16:9 / 9:16 / 1:1 / 4:5, `seconds`, `loop`, `budget`); a **method** is a way
  to find the picture; a **style** is a look (one per build at most). Ids are
  namespaced like every pack item (`core/infographic-loop`). Seven ship in
  `resources/packs/core/`: the form `infographic-loop` (brings
  `concept-to-picture`, suggests 4:5, 8 s, loop, Craft), the method
  `concept-to-picture`, and the styles `style-blueprint`, `style-flat-bold`,
  `style-neon-dark`, `style-editorial`, `style-custom` (the user's own words
  for the look, sent as the request's `style`). Callers: the Creator's Kind
  and Style pickers, the agent tools' `packs` and the flow node's Kind and
  Style (`docs/AGENT_PACKAGE_SPEC.md`). A request naming an unknown id is
  refused before it queues; an edit keeps the packs its version was built
  with (`vN.debug.json` `craftPacks`), and an id this app no longer has is
  skipped and logged. Code: `src/shared/studio/craft-pack.ts` (format,
  parsing, `expandCraftIds`), `src/main/services/tsx-builder/craft-packs.ts`
  (catalogue, read once and cached). **v1 limit: built-in packs only** — the
  loader reads `resources/packs/`, and a `.vidtsxpack` import does not take
  `craft` (not in `pack-package.ts`'s `PACK_KINDS`). An agent package carries
  its own builder know-how as `builder: true` skills (`docs/SKILLS.md`).
- **transition / video-effect packs: NOT a pack type yet.** Transitions are
  hardcoded serializer geometry; effects don't exist. Both need a pluggable
  surface first (V2 ledger) — packs follow that architecture, not the
  reverse. *(2026-09-17: the pluggable surface for transitions is designed in
  `TRANSITION_PACKS_DESIGN.md`, which also introduces the multi-kind
  container layout — `pack.json` + `transitions/<id>.tsx` — from
  `NEXT_FEATURES_DESIGN.md` §Q8a. Effects are still not a pack type.)*

## Explicitly out of scope (until the business needs them)

Store/browse UI · pack manager screen · licensing/DRM/entitlement checks ·
pack updates/versioning UX · transition & effect packs · user-authored
template tooling. None of these require rework later as long as loaders
are born pack-shaped and item ids are namespaced from day one.

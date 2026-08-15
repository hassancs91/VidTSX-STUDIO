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
- **transition / video-effect packs: NOT a pack type yet.** Transitions are
  hardcoded serializer geometry; effects don't exist. Both need a pluggable
  surface first (V2 ledger) — packs follow that architecture, not the
  reverse.

## Explicitly out of scope (until the business needs them)

Store/browse UI · pack manager screen · licensing/DRM/entitlement checks ·
pack updates/versioning UX · transition & effect packs · user-authored
template tooling. None of these require rework later as long as loaders
are born pack-shaped and item ids are namespaced from day one.

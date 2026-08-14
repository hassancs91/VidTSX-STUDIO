# V2 features ledger — parked, not forgotten

> Everything explicitly deferred from the S4-era design discussions
> (2026-08-14, Hasan + Claude), one line each with enough context to pick it
> back up cold. When a v2 item ships, move its line to STATUS.md.
> Older per-doc deferrals still live where they were made
> (`TRANSITIONS_DESIGN.md` "Out of scope", `CORE_PARITY_PLAN.md` phase
> ownership notes); this file is the ledger from S4 onward.

## Capture & recording

- **Screen / window capture** via Electron `desktopCapturer` — record or
  screenshot the user's own screen/apps. Deliberately split from v1 web
  capture (picker UI + OS permissions + recording pipeline = its own
  feature). Source: capture discussion; v1 is web-only by decision.
- **Capture presets & scripting** — device-frame presets (phone/laptop
  mockup frames around captures), multi-page capture runs from a URL list.
- **Fake-screencast skill port** (`fake-screencast` from
  claude-youtube-editor) — pan/zoom/cursor TSX shots over captures. v1
  ships the *material* pipeline (capture → library → `assetRefs`); the
  dedicated skill + cursor/scroll animation templates are v2.

## Asset library

- **Optimize / compress jobs** — image recompression, video transcode
  presets, "reclaim N MB" suggestions; rides the existing job + size-scan
  infrastructure. Source: Hasan, library discussion.
- **Ambient organize nudges** — "3 assets look misfiled" surfaced passively
  (v1 organize is user-triggered behind the review gate).
- ~~Standalone library screen~~ — resolved in v1: the library extends the
  app's existing `asset-library` Assets screen (library doc L8 Rev 3), so
  a dedicated screen already exists.
- **Local model auto-describe** — vision descriptions via local models
  (v1 uses the app-default cloud provider).
- **Cross-project usage tracking** — `used_in` per asset (the reference
  SFX-library format has this) for safe-delete warnings and popularity
  sorting.

## Brands

- **Local font files** in brands — needs font serving into both preview and
  render bundles; v1 is Google + system fonts only.
- **Brand-setup skill** — interview-style brand creation, or extracting
  palette/fonts from an uploaded logo/screenshot.
- **Per-shot brand override** — v1 brand selection is per-project only.
- **Brand-wide restyle pass** — regenerate all shots in a project against a
  newly switched brand in one proposal (v1 offers per-shot "Restyle to
  brand").

## TSX shots

- **Props-driven live word sync** — serializer-injected word arrays so
  title shots re-sync automatically under edits; v1 bakes shot-local
  timings + records the anchor (regenerate re-bakes). Caption-shaped work;
  coordinate with S5.
- **Auto re-sync after under-shot cuts** — detect drift via the anchor and
  offer/perform regenerate automatically (v1: inspector flag + manual
  regenerate).
- **three / R3F import surface** — allow the vendored three stack in shots
  (needs a timeline-preview perf pass). Pending checklist #5 answer.
- **Per-shot bake-to-proxy preview** — render a heavy shot to a proxy video
  for scrubbing while export stays live TSX; only with measured evidence
  (the S2 rule).
- **Per-clip version pinning / shot duplication for divergence** — v1 pins
  versions per shot, not per clip.
- **Shot templates / cross-project shot library** — reusable shot starting
  points; interacts with brands.
- **Open shot in Creator editor** — cross-feature UX (isolation says no for
  now; shots are files, the pipeline is shared, the UIs stay separate).
- **Screenshot-based shots, advanced** — beyond fake-screencast: scroll
  video captures, interaction recordings as shot material.

## Agent & pipeline

- **Bundle dry-run gate** — optional post-generation `bundleComposition`
  smoke test for shots (v1 gate is esbuild transpile + import lint; cheap
  and nearly sufficient given the import allowlist).
- **Array-spec generation tool** — batch `generate_tsx_shots([...])` if
  one-per-call ever proves too chatty (v1 keeps one-shot-per-call by
  decision, checklist #11).
- **Persistent shot-generation queue** — tsx-job-engine-style persistence /
  resume for shot jobs across app restarts (v1 runner is in-memory).

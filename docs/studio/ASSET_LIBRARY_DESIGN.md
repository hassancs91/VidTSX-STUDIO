# Asset library design — folders · descriptions · brands · capture

> Companion to `TSX_SHOTS_DESIGN.md` (Rev 2) — S4's second work stream.
> Written before the code, per the "design first" rule; decisions L1–L8 with
> a recommendation each and an inline-answerable checklist at the end.
> Everything deferred is ledgered in `V2_FEATURES.md`.
>
> Thesis (Hasan, 2026-08-14): the library is a **knowledge base the agent
> navigates** — the better the user (and the AI) organizes it, the better
> the agent picks and generates. Descriptions and structure are not
> cosmetics; they are generation quality.

## What this builds on

- Studio root setting + folder-as-truth precedent (project browser).
- `StudioMediaAsset` referenced-in-place model + content `hash` for relink.
- Media-job event pattern (transcript/proxy) for background work with
  per-item progress; cache-manager's size-scan pattern.
- The audit-gate law: bulk AI changes arrive as reviewable proposals.
- `imageEngine` / local image engine for generation; Electron's own
  Chromium for capture (no new binaries).

---

## L1. Location & source of truth — real folders, one overlay

- **Disk-as-truth**: the library lives at `<studioRoot>/library/` with real
  folders the user creates (`logos/`, `screenshots/`, `b-roll/`, `music/`,
  …). Organize in the app *or* in Explorer; the pool mirrors reality. No
  virtual-tree/disk-tree sync bugs, and users with existing organized
  folders get credit instantly (importing a folder preserves its structure).
- **One overlay the disk can't hold**: `library/index.json` — per-asset
  metadata keyed by library-relative path, rename-resilient via content
  hash:

  ```ts
  interface LibraryIndexEntry {
    relPath: string;            // key; POSIX separators
    hash: string;               // content hash — identity across moves
    description?: string;       // the human/AI-authored signal (L2)
    brandId?: string;           // optional brand tag (L3)
    origin: 'imported' | 'generated' | 'captured';
    addedAt: string;
    probe?: StudioAssetProbe;   // cached; refreshed on mtime change
  }
  ```

- Index writes are debounced-atomic like `project.json`. A scan on library
  open reconciles disk vs index: new files gain entries, moved files re-key
  by hash, deleted files drop (description preserved in a tombstone list
  until the next scan confirms — protects against transient cloud-sync
  states).
- Type is derived (extension + probe), not stored user-side; `kind`
  video/audio/image follows the existing asset-kind rules.

**Recommendation:** as drawn. Managed content (`generated`, `captured`) is
*born* inside the library; imported footage for a specific edit keeps living
wherever the user has it (projects reference in place, unchanged).

## L2. Descriptions — manual, auto, and batch AI

The description is what the agent actually reads: *"primary logo, white on
transparent, use on dark backgrounds"* beats any filename.

- **Manual**: editable inline in the pool inspector, always.
- **Auto on import** (library imports only, default ON — a logo deserves a
  caption, a 27-minute DJI file does not): a vision call drafts a one-liner;
  the user corrects the ones that matter. Uses the **app-default provider**
  — library curation has no project context, so this is a fixed rule, not a
  per-call choice.
- **Batch "Describe with AI"**: select assets or a folder → background job,
  one vision call per asset, per-item progress via the media-job event
  pattern, results land as editable descriptions. Failures per-item, never
  batch-fatal.
- Generated assets get their generation prompt as the initial description
  (free and accurate); captures get page title + URL (L6).

**Recommendation:** all three; auto-describe ON for library imports, OFF for
project footage imports.

## L3. Brands — multiple, default, orthogonal to folders

- **Storage**: `<studioRoot>/brands/<slug>/brand.json`; as many brands as
  the user wants. Logo files are ordinary library assets (brand-tagged);
  `brand.json` references them by library path + hash.

  ```ts
  interface StudioBrand {
    id: string; name: string;
    palette: { primary: string; secondary: string; background: string;
               text: string; accent: string };
    fonts: { display: string; body?: string };   // Google/system names, v1
    logoRefs: string[];                          // library relPaths
    styleNotes?: string;                         // free text, injected verbatim
    createdAt: string; updatedAt: string;
  }
  ```

- **Default**: `defaultBrandId` in Studio settings. New projects copy it
  into `project.settings.brandId` (explicit snapshot — changing the default
  later never restyles existing projects). Per-project switch any time.
- **Brand tags on assets**: optional `brandId` per index entry, assigned in
  bulk (select folder → "Assign to brand"). Folders stay about *what things
  are*; brand is orthogonal metadata. Shared assets stay unbranded.
- **Why tags matter**: `search_assets` with an active brand defaults to
  brand-tagged + unbranded — the agent searches a smaller, correct haystack.
- Fonts v1: Google + system names only (the Google-Fonts proxy path already
  exists in the pipeline). Local font files → `V2_FEATURES.md`.
- Brand-setup interview skill / extract-palette-from-logo → v2.

**Recommendation:** as drawn; brand UI is a section of the library screen
plus the default picker in Studio settings.

## L4. Search, filters, sizes — the "professional library" baseline

- **Search**: client-side over name + description (the index is small; no
  search infra). **Filters**: type · folder · origin · brand — chips, not a
  query language.
- **Sizes**: per-folder and total, computed with the cache-manager scan
  pattern, cached with invalidation on library writes; shown in the folder
  tree and a library footer (the cache-footer precedent).
- Optimize/compress jobs ride this same infrastructure later → v2 ledger.

**Recommendation:** all in v1 — this is cheap and it is what makes the
library feel professional rather than a dumping ground.

## L5. Agent tools

All follow the `propose_cuts` conventions: zod schemas, main never writes
any project document, progress as events.

- **`search_assets({ query?, folder?, brandScope? })`** → a compact **assets
  view** (the `formatTakesView` idea for media):

  ```
  library/logos/
    lg_01  vidtsx-logo-white.png  1024×1024  [brand:vidtsx]  "primary logo, white on transparent, for dark bg"
  library/screenshots/
    sc_11  dashboard-dark.png     2560×1440             "app dashboard, dark theme, editor open"
  ```

  Default `brandScope`: active brand + unbranded when the project has a
  brand; `'any'` on request. Also searches the open project's own assets
  (footage) — one tool, two scopes, clearly labeled in the output.
- **`generate_image({ prompt, folder?, aspect? })`** — wraps `imageEngine`
  (BYOK, same provider config as the app's image features). Files into the
  given folder or `generated/`; auto-tags active brand; prompt becomes the
  description; returns the asset row. Additive → no proposal; visible as a
  tool event; billed `featureSource: 'studio-shot-asset'`.
- **`capture_webpage({ url, viewport?, fullPage? })`** — L6. Same filing
  rules, `captures/<domain>/` default.

**Recommendation:** these three plus the D8 shot tools are the complete v1
agent surface for assets.

## L6. Web capture — Electron is the browser

No Playwright, no downloaded browser: a hidden `BrowserWindow` in main loads
the URL and `webContents.capturePage()` grabs it. **Web capture only in v1**
(decided 2026-08-14); screen/window capture via `desktopCapturer` is a
separate v2 feature.

- **Capture service** (`src/main/services/library/capture.ts`): hardened
  hidden window — `sandbox: true`, isolated non-persistent session, no
  privileged preload, external navigation confined — it renders arbitrary
  web content and gets browser-level trust only. Viewport presets (16:9,
  portrait, device widths), `deviceScaleFactor: 2` for crisp shot material,
  full-page via scroll-and-stitch, network-idle + settle-delay heuristics
  before the shot.
- **Auth-walled pages**: **visible capture mode** — the window opens
  visibly, the user logs in and navigates, then hits Capture. No credential
  handling on our side, covers dashboards/account pages.
- Output: PNG into `library/captures/<domain>/`, origin `captured`,
  description = page title + URL, brand-taggable like anything else.
- Two doors: library "Capture" button (URL + preset picker) and the
  `capture_webpage` agent tool.

**Recommendation:** as drawn. This is the on-ramp to fake-screencast-style
shots (pan/zoom/cursor over a capture) — the skill port itself stays in v2,
but its material pipeline ships now.

## L7. AI organize — suggestions with the audit gate

- **"Organize" action**: an agent pass reads the index (names, descriptions,
  folder tree) and returns a move plan — *"dashboard-final2.png →
  screenshots/ (currently in logos/)"* — presented as a reviewable list with
  per-item accept/reject, then applied as real disk moves + index re-key.
  Bulk file changes get the same gate as bulk timeline changes.
- **The move-safety rule that makes this OK**: projects reference library
  assets by path, so moves could orphan them — except relink-by-hash
  already exists for missing assets. **The library is the first place
  relink searches**; a project opening with a stale path heals silently by
  hash. This rule is load-bearing for the whole feature.
- Ambient nudges ("3 assets look misfiled") → v2; v1 is user-triggered only.

**Recommendation:** ship organize in v1 — it is the feature that makes
"AI keeps the library structured" real, and the gate + relink rule make it
safe.

## L8. Module layout & IPC

```
src/main/services/library/   library-store (index, scan, moves), describe-job,
                             capture, sizes
src/features/studio/…        v1 surface: a "Library" tab in the media pool
                             (browse/search/filter, describe, organize,
                             capture, brand assign); standalone screen → v2
src/shared/types/library.ts  index entry, brand, IPC contracts
src/main/ipc/library-handlers.ts + registrations/library.ts
src/preload/api/library.ts
```

House rules apply (IPC-only bridge, services own logic, ~300 lines/file).
The library never appears in `project.json` — the import-on-use seam
(`TSX_SHOTS_DESIGN.md` D12) is the only crossing point.

## Test plan sketch

- **Unit**: index reconcile (new/moved-by-hash/deleted, tombstones); move
  plan apply + re-key; relink-by-hash from library; brand tag bulk-assign;
  search/filter over name+description; size scan invalidation;
  assets-view formatting; capture filing + description defaults.
- **Live CDP**: import a structured folder → tree mirrors it; batch
  describe with per-item progress; organize round-trip (suggest → reject
  one → apply → project relinks by hash); capture a URL (hidden + visible
  modes) → asset lands described; brand create + set default + new project
  inherits; `search_assets` respects brand scope in an agent run.

---

## Decision checklist (answer inline)

1. **L1** — disk-as-truth at `<studioRoot>/library/` with `index.json`
   overlay keyed by relPath + hash: **OK?**
2. **L2** — auto-describe ON for library imports / OFF for project footage;
   curation always uses the app-default provider: **OK?**
3. **L3** — brands as designed (multiple, `defaultBrandId` copied at
   project creation, brand *tags* on assets instead of brand folders;
   Google/system fonts only in v1): **OK?**
4. **L5** — `search_assets` defaults to active-brand + unbranded scope;
   `generate_image` and `capture_webpage` file-and-tag automatically with
   no proposal of their own: **OK?**
5. **L6** — capture via hidden Electron window (sandboxed, scale 2,
   full-page stitch) + visible mode for logged-in pages; web only in v1:
   **OK?**
6. **L7** — AI organize ships in v1 behind the review gate, with
   library-first relink-by-hash as the safety rule: **OK?**
7. **L8** — v1 library UI lives as a tab inside the Studio media pool
   (standalone screen later): **OK?**
8. **Implementation order** — library core → shots core → brands + capture
   + AI curation (each slice independently testable): **OK?**

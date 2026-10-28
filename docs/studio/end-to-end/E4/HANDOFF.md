# E4 — The importer over the reference `sfx/` and `music/` catalogs
status: HANDOFF

> Track E, session 5 — **runs BEFORE E3** (E3's exit, the whoosh case, needs the imported library). **Work only in
> the worktree** `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E\wt` (branch `end-to-end-p0-e`); paths below are
> relative to it. Decisions E-d1…E-d10 + E-d2a (ORCHESTRATOR.md "Session 4 — track E") and the session-5 overrides
> ("Session 5") bind this part; **E-d8** is this part's own decision. E1 + E2 are the base: the index has `kind`,
> `probe`, `probeStamp`, `tags`, `audio {category, loudnessLufs, peakDbfs, source, model}`, `usedIn`; E2 fills them
> for generated sounds — E4 fills them from the catalogs (read E2's HANDOFF "Done" for the field semantics E2
> settled, e.g. what `peakDbfs` holds and whether `audio` gained a `license` field).

## Goal (the §3 row verbatim + the exit)

| **E4** | The importer over the reference `sfx/` and `music/` catalogs | 45 + 6 clips in the library with fields mapped, `used_in` preserved, licences noted |

**Exit:** 45 + 6 clips in the library with fields mapped, `used_in` preserved, licences noted.

**How the exit is measured (orchestrator):** on an isolated profile (E-d3: `…\vidtsx-e2e\profiles\E4\profile`,
copied from `source` WITHOUT `settings\settings.db*`; library root `<profile>\assets`), the importer is run with an
EXPLICIT target library (E-d8: no implicit default — a missing `--library` refuses) against the read-only reference
catalogs `D:\repos\claude-youtube-editor\media\library\sfx\catalog.json` (45 clips) and `…\music\catalog.json`
(6 clips):
1. **Dry run first:** prints the plan (every file, its target relPath, the mapped fields, what would be skipped) and
   writes NOTHING — proven by a hash of the whole target library tree (files + `.vidtsx/index.json`) before and after.
2. **The import:** 45 + 6 files land under the stated folders (T6: "files 45 + 6 clips into `library/sfx/` and
   `library/music/`" — relative to the assets root; the exact relPaths are the builder's call, stated in STATUS and
   stable), each **byte-identical** to its source (sha256), and 51 index entries exist with `kind: 'audio'`,
   `origin: 'imported'`, `probe.duration` within 10 ms of an INDEPENDENT ffprobe (the profile's `ffmpeg-full` n8.1.2),
   `audio.category` ← `category`, `tags` ← `tags`, `audio.loudnessLufs` ← `loudness_lufs`, `audio.peakDbfs` ←
   `peak_dbfs`, `audio.source` ← `source`, `audio.model` ← `model`, the licence noted (where E2/E4 put it — a field or
   the description; stated), a description the agent can read (the catalog `prompt` / `desc` is the natural one),
   and **`used_in` preserved verbatim** (the catalog values are editor-repo video ids such as `short-1-chess`,
   `video-2` — not Studio project ids; where they go is the builder's call, stated — but every value must be
   recoverable from the index, and E2's Studio ids must be able to join them).
3. **The 4 synth chords** (`piano-c-maj`, `piano-g-maj`, `piano-a-min`, `piano-f-maj`: no `category`, `tags`,
   `peak_dbfs`, `loudness_lufs`, `model`, `license`, `prompt`; they have `desc`, `function: "content"`, `source:
   "gen_chords.py (deterministic additive synth, equal temperament A4=440)"`, `used_in: ["short-9-chords"]`) import
   with what they have; "no licence recorded in the catalog" is noted for them (E-d8).
4. **Idempotent:** a second run changes nothing (no duplicate files, no duplicate entries, `index.json` equal or
   fields-only updated — say which); a run after one source clip's catalog entry changes (e.g. a tag added in a
   COPY of the catalog on D:, never the original) updates that entry only.
5. `list_assets(scope:'library', kind:'audio', query:'whoosh')` (the REAL handler) shows `whoosh-soft` with its
   duration, category `motion`, its tags, `−20.0` LUFS and its `used_in`; a live CDP click-through on the E4 profile
   (the worktree's own build) shows the `sfx` and `music` folders in the Assets screen with the files and durations
   (a still). No model call is needed for E4 (E-d9).
Plus the session gates (DRIVING "Track E": worktree vitest green except the three E-d2a resolution suites + rule
(b); `tsc` web 26 / node 10; Status.md row at the top; TESTING **§18.16** — E-d10).

## Plan context

- **T6 (decision, the "Importer" bullet, verbatim):** "`scripts/import-sfx-library.mjs` reads the reference
  `sfx/catalog.json` and `music/catalog.json` and files 45 + 6 clips into `library/sfx/` and `library/music/` with
  fields mapped and `used_in` preserved."
- **E-d8 (orchestrator):** the importer takes an explicit target library (no implicit default) and has a dry run; in
  this run it only ever targets an isolated profile's library. The reference catalogs are read-only; 4 of the 45 SFX
  (synth chords) carry no `category` / `license`. The editor repo `D:\repos\claude-youtube-editor` is never written
  (Python there only with `-I -B`; a copy of a catalog for a test goes on D: scratch).
- **The catalogs (read-only, inspected 2026-10-24):**
  - `sfx/catalog.json` = `{ note, clips[45] }`; every clip has `id, file ("clips/<id>.mp3"), duration_s, source,
    used_in[]`; 41 also have `category, tags[], peak_dbfs, loudness_lufs, model, license, prompt`; 4 have `desc,
    function` instead. Categories: motion 5, tension 2, emphasis 11, snap 4, foley 11, reward 3, texture 4, impact 1,
    none 4. `used_in` non-empty on 40 clips (e.g. `whoosh-soft` in 16 videos). `loudness_lufs` −27.9…−20.0 (the
    ceiling bound some), `peak_dbfs` −12.5…−1.3. All 45 files exist; nothing in `clips/` is outside the catalog;
    1,114,625 bytes total; all `.mp3`.
  - `music/catalog.json` = `{ note, clips[6] }`; every clip has `id, file, category (ambient / tech / lofi / cinematic /
    lullaby / documentary), tags[], duration_s (57.051 or 63.033), requested_ms, peak_dbfs (−7.8…−1.6), loudness_lufs,
    source 'elevenlabs:music', model 'music_v2', force_instrumental, license, prompt, used_in[]` (only
    `lullaby-tender` → `["short-7-kids"]`); 7,890,109 bytes total; all `.mp3`. `palette.json` beside each catalog is
    the generation recipe list — not imported.
  - `license` text (41 + 6): "ElevenLabs generated (text-to-sfx|text-to-music); owner: the repo author, commercial use
    per the account's ElevenLabs plan".
  - **Durations:** the catalog `duration_s` came from the editor's own ffprobe at generation time and may INCLUDE the
    LAME encoder delay + padding that E1's probe trims (−27…−51 ms at 44.1 / 48 kHz — E1 R2). The index `probe` is
    measured by the product (trimmed); compare it against an independent ffprobe n8 (trimmed), and REPORT the
    deltas to `duration_s` without failing on them.
- **Settled by E2 (builders #1–#2, `60b5537` / `841e311` — read E2's HANDOFF "Done" §1–§3 for the detail):** `LibraryAudioMeta`
  gained optional `peakKind: 'true' | 'sample'`, `gainDb`, `normalizeError`; E2 writes a TRUE peak (dBTP, loudnorm) with
  `peakKind: 'true'` — the catalogs' `peak_dbfs` is a SAMPLE peak → E4 writes `peakKind: 'sample'`. `normalizeTags()` in
  `library-filing.ts` (trim / lower-case / dedupe / cap 20) is the one tag normalizer — use it. The `list_assets` row
  appends ` · category: … · tags: … · −20.0 LUFS · used in: …` after the description (E1's exact-string tests hold).
  `audio.source` for generated sounds is the provider id (`elevenlabs` / `standin`); for the catalogs keep the catalog's
  `source` string verbatim (`elevenlabs:sound-generation`, `elevenlabs:music`, the gen_chords.py text) — say so.
- **§1.6 facts:** `LibraryIndexEntry` / `LibraryAudioMeta` in `src/shared/types/asset-library.ts` (optional fields
  only — a new `license?` is an optional addition); `upsertEntry(root, relPath, { origin, description?, brandId?,
  tags?, audio? })` (`src/main/services/library/library-store.ts:135`) probes through `probeLibraryFile` and writes
  through the per-root serialize chain (`library-index-io.ts`: `version: 1, rev: 2`, the one-time backup) — it is
  the right seam for every imported file; `hashFileHead` (`media-import.ts`) is the identity projects use (keep it);
  `reserveLibraryFile` / `sanitizeFolder` / `slugify` in `library-filing.ts`; the library root of a profile is
  `<profile>\assets` (`library-paths.ts:27-30`, no override without a settings store); the REAL `list_assets`
  (`agent-tools/project-tools.ts` → `library-listing.ts`, E2's row format).
- **Scripts in this repo** (`scripts/*.mjs`) are standalone Node (none imports `src/` or `out/`);
  `migrate-editor-project.mjs` bundles TSX with esbuild at run time. A script that must write the index EXACTLY as the
  app does should not re-implement `library-index-io.ts` — one honest shape: a pure service in
  `src/main/services/library/` (reads the catalogs, maps fields, copies files, upserts through the real `upsertEntry`
  with the root passed explicitly; unit-tested on a temp root with the real bundled ffprobe) plus
  `scripts/import-sfx-library.mjs` that esbuild-bundles and runs it (`--library <root> --from <editor repo>
  [--dry-run]`), mocking only `electron`'s `app.getPath` (never a settings store). The builder decides and states it.
  `getBinaryPath('ffprobe')` (`src/main/utils/paths.ts:122-135`) resolves the Remotion compositor's ffprobe from
  `node_modules` — fine from a script started in the worktree (node walks up to the main checkout's `node_modules`).
- **§5 items touching E4:** "Docs to update when built": STATUS per part, TESTING §18 (18.16).
- **Session 6 notes (orchestrator, 2026-10-28):** (1) the 51 catalog files are pairwise DISTINCT by sha256 (checked read-only
  16:30) — so `importLibraryFile`'s hash dedupe in a project (`matchExistingAsset`, `library-import.ts`) cannot collapse two of
  them; (2) E4 imports the clips AS-IS (byte-identical is the exit) — never through E2's normalizer (`normalizeAudioFile`
  re-encodes); the catalogs' `loudness_lufs` / `peak_dbfs` are recorded, not re-measured into the file; (3) E2's fix round 1
  (`f990487`) changed `audio-normalize.ts` / `audio-loudness-rule.ts` (E-d11: the ceiling holds on the encoded file),
  `shot-asset-refs.ts` (mark after validation) and added `src/main/services/studio/pool-import.ts` (the pool-import seam) —
  E2's HANDOFF "Done" line numbers older than that commit have drifted; read the code at HEAD; (4) memory commit headroom has
  swung between 0.5 and 19 GB this session (Brave / WSL) — measure right before every full run and use `--maxWorkers=2` when
  it is under 10 GB.
- **Session-5 overrides:** no paid-key call (nothing here calls a provider); no model call needed; isolated profile
  only — **never Hasan's `%APPDATA%\VidTSX Studio\assets`**; the editor repo read-only; the resource guard (C: ≥ 3 GB
  and C: + headroom ≥ 6 GB before a launch / copy; watchdog at 1.5 GB — kit `.vidtsx-temp/end-to-end/E1/watchdog.ps1`;
  `--maxWorkers=2` while headroom < 10 GB); E-d4 before any launch; CDP port **9264**; profile
  `…\profiles\E4\profile`; per-part scratch `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E4\`; big outputs
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\E4\`. Kits to copy: `.vidtsx-temp/end-to-end/E1/` (`launch.sh`,
  `restore.ps1`, `watchdog.ps1`, `cdp.mjs`, `vitest.e1.config.ts`, `list-assets.e1.test.ts` — the REAL handlers against
  a profile's library with `vi.mock('electron')` `app.getPath('userData')` → the profile and `settings-db` → no
  override) and E2's kit (`.vidtsx-temp/end-to-end/E2/`).

## Done (file:line, commit hashes)

### Design note (builder #1, 2026-10-28 — binds the rest of E4)

Code read: `asset-library.ts` (types), `library-store.ts` (all; `upsertEntry` :135-186 always probes + always writes),
`library-index-io.ts` (all; `loadIndex` is READ-ONLY — the backup / mkdir happen only in `writeIndex`), `library-filing.ts`
(exports), `library-used-in.ts` (`addUsedIn`), `library-paths.ts` (exports; imports `utils/paths` → `electron`, and
`settings-db`), `media-import.ts` (imports; ffprobe via `RenderInternals.getExecutablePath`, null binaries dir when
`!app.isPackaged`), `library-probe-duration.test.ts` (mock pattern: `electron` only), `pre-e1-control.test.ts` (pins the
v2 fields `kind / tags / audio / usedIn`; `audio` is pinned as a whole object), `migrate-editor-project.mjs` (esbuild
pattern), E1 kit `list-assets.e1.test.ts` + `vitest.e1.config.ts`. Catalogs inspected read-only with `node -e` (counts
match the HANDOFF: sfx 45 — 41 with category/tags/peak/lufs/model/license/prompt, 4 chords with desc/function; music 6 —
all fields + requested_ms / force_instrumental; every `file` is `clips/<id>.mp3`; no tag needs normalizing; max 8 tags).

1. **Module split.** `src/main/services/library/catalog-import-map.ts` (pure, no IO): `parseCatalog` (narrows `unknown`,
   per-clip problems), `mapCatalogClip`, `changedFields`, `NO_LICENCE_NOTE`. `src/main/services/library/catalog-import.ts`
   (IO, ≤ 300 lines): `planCatalogImport(libraryRoot, sources)` (read-only: reads the catalogs, sha256 of every source,
   stat + sha256 of an existing target, `loadIndex` — which never writes) and `applyCatalogImport(libraryRoot, plan)`
   (copies, then `upsertEntry` per file — the app's own seam: probe, `hashFileHead`, the per-root chain, `version 1 /
   rev 2`, the one-time backup). `mergeUsedIn` (pure) goes in `library-used-in.ts`; `upsertEntry`'s meta gains
   `usedIn?: string[]`, **merged** inside the chain (existing order kept, catalog values appended once — never drops a
   Studio project id E2 marked). `scripts/import-sfx-library.mjs` esbuild-bundles `catalog-import.ts` (cjs, node) into
   `<repo>/.vidtsx-temp/import-sfx-library/` (gitignored, inside the repo so `@remotion/renderer` resolves by walking up
   to the main checkout's `node_modules`), with a plugin: `electron` → a stub (`isPackaged: false`, `getPath(name)` →
   a temp dir, `userData` THROWS — the importer has no implicit library), `settings-db` → a stub that throws on use
   (never a settings store), every other bare package external.
2. **relPath scheme (stable):** `sfx/<basename of file>` and `music/<basename of file>` under the assets root — i.e.
   `sfx/whoosh-soft.mp3`, `music/ambient-pad.mp3` (basename = `<id>.mp3` for all 51). A `file` with `..`, an absolute
   path or a non-audio extension is `invalid`.
3. **Field mapping.**
   | catalog | index | |
   |---|---|---|
   | `file` | relPath `<section>/<basename>`; source = `<clips dir>/<file>` | clips dir = the catalog's folder unless overridden |
   | `id` | (= the file's basename) | not stored separately |
   | `prompt` (else `desc`) | `description` | chords: `desc` + ` (no licence recorded in the catalog)` |
   | `category` | `audio.category` (trim + lower-case) | absent on the 4 chords → absent |
   | `tags` | `tags` via `normalizeTags` | absent → not written |
   | `loudness_lufs` | `audio.loudnessLufs` | recorded, not re-measured (session-6 note 2) |
   | `peak_dbfs` | `audio.peakDbfs` + `peakKind: 'sample'` | only when present |
   | `source` | `audio.source` VERBATIM | `elevenlabs:sound-generation` / `elevenlabs:music` / the gen_chords.py text |
   | `model` | `audio.model` | |
   | `license` | **NEW optional `audio.license`** (verbatim) | absent → not written; the note goes in the description + the report |
   | `used_in` | `usedIn` VERBATIM (editor video ids), merged with existing | E2's Studio ids join the same array |
   | `duration_s` | not stored — `probe` is MEASURED by `upsertEntry` | the report prints `probe − duration_s` per clip |
   | `requested_ms`, `force_instrumental` (music), `function` (chords) | **dropped** — generation request parameters / the editor mixer's role; listed per clip as `dropped` in the plan | |
   | — | `origin: 'imported'`, `kind: 'audio'` (by `upsertEntry`) | no `gainDb` / `normalizeError` — the importer never re-encodes |
4. **Actions per clip (the plan):** `copy` (target absent, no index entry elsewhere with the same bytes) · `update`
   (same bytes at the target — or at the relPath of an entry with the same `hashFileHead` whose file's sha256 matches, i.e.
   the user moved it — and `changedFields` non-empty: fields only, no copy) · `unchanged` (same bytes, fields equal → no
   write at all) · `conflict` (different bytes at the target → skipped, never overwritten) · `missing-source`. A
   clip the parser cannot use (no id, `..` / absolute / non-audio `file`, bad `used_in`) is a plan `problem` line, never
   an item. Catalog is the truth for the mapped fields (a re-run re-applies them; `usedIn` only grows).

### Built (builder #1) — the service + tests (design §1–§6, §8; the script §7 NOT built yet)

- `src/main/services/library/catalog-import-map.ts` (156 lines, pure): `parseCatalog` :91, `mapCatalogClip` :104,
  `changedFields` :147, `NO_LICENCE_NOTE` :16, dropped fields `requested_ms / force_instrumental / function` :19.
- `src/main/services/library/catalog-import.ts` (198 lines): `CatalogSource` :31, actions :44, `planCatalogImport` :127
  (read-only), `applyCatalogImport` :181 (refuses a plan made for another root), `copyIn` :149 (`COPYFILE_EXCL` + sha256
  re-check, removes a bad copy), moved-file lookup by `hashFileHead` + sha256 :116-122.
- `src/shared/types/asset-library.ts:48-52` — `LibraryAudioMeta.license?` (optional, verbatim).
- `src/main/services/library/library-used-in.ts:28-41` — `mergeUsedIn` (pure). `library-store.ts` — `upsertEntry` meta
  `usedIn?` :146, merged inside the chain :173 (doc comment :134-135).
- Tests: `catalog-import-map.test.ts` (8), `catalog-import.test.ts` (7, real bundled ffprobe, WAV fixtures),
  `library-used-in.test.ts` (+1 `mergeUsedIn`), `pre-e1-control.test.ts` (fixture `audio` gains `peakKind: 'sample'` +
  `license`, asserted :91; the old-code rewrite keeps `audio` whole — `toEqual` at :139).
5. **Dry run proof:** the CLI's `--dry-run` calls only `planCatalogImport` (no mkdir, no copy, no `upsertEntry`) and
   prints every item (target relPath, action, mapped fields, dropped fields, notes). Unit test: tree snapshot (paths +
   sha256) equal before/after, no `.vidtsx/` created. Live: a sha256 over every file of the target tree (incl.
   `.vidtsx/index.json`) before = after.
6. **Idempotency:** second run → 51 × `unchanged` → no write: `index.json` BYTE-EQUAL. Changed catalog COPY (one tag
   added; `--sfx-catalog <copy>` while the clips still resolve against the editor repo's `sfx/` folder) → that one clip
   `update` (`changed: ['tags']`), every other entry equal.
7. **CLI:** `node scripts/import-sfx-library.mjs --library <assets root> --from <editor repo> [--dry-run]
   [--sfx-catalog <file>] [--music-catalog <file>] [--report <json>]` — refuses without `--library` or `--from`, when
   `--library` is not an existing directory, or when it lies inside `--from`. Exit 0 = no conflict / missing / invalid.
8. **Tests (red first):** `catalog-import-map.test.ts` (parse + map of an sfx clip / a chord / a music clip shaped like
   the real ones; `changedFields`), `catalog-import.test.ts` on a temp root with the REAL bundled ffprobe (`electron`
   mocked only) — **fixtures are WAVs written from JS, not copies of the real clips** (a unit suite must not depend on
   another repo on disk; the 51 real mp3s go through the live run): dry run writes nothing; import byte-identical +
   fields + probe; re-run byte-equal index; changed catalog → one entry; Studio id in `usedIn` kept; conflict not
   overwritten; moved file not re-copied. `library-used-in.test.ts` + `mergeUsedIn`; `pre-e1-control.test.ts` extended
   with `audio.license` (E-d5).

## Verified (exact commands + outputs)

Builder #1, 2026-10-28 (worktree root; logs in `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E4\`):
- Resource guard before the runs: `Get-PSDrive C,D` → C 53.3 GB, D 43.8 GB free; headroom
  `(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory/1MB` → 32.8 GB.
- RED first: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/main/services/library/catalog-import-map.test.ts
  src/main/services/library/catalog-import.test.ts src/main/services/library/library-used-in.test.ts` → `Test Files 3 failed (3)
  · Tests 1 failed | 8 passed (9)` (the two new modules missing; `mergeUsedIn is not a function`) — `red.log`.
- GREEN: the same + `pre-e1-control.test.ts` + `library-store.test.ts` → `Test Files 5 passed (5) · Tests 41 passed (41)`
  — `green1.log`.
- Types: `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit` → 26 `error TS`;
  `-p tsconfig.node.check.json` → 10 (= baseline; none in the touched files) — `tsc-web.log`, `tsc-node.log`.
- NOT run yet: the full worktree vitest, the script, anything live.

## Next step (ONE concrete instruction)

**Builder #2:** build `scripts/import-sfx-library.mjs` per design §1 + §7 — esbuild-bundle
`src/main/services/library/catalog-import.ts` (`platform: 'node'`, `format: 'cjs'`, `bundle: true`) into
`<repo>/.vidtsx-temp/import-sfx-library/catalog-import.bundle.cjs` (repo = the script's parent folder; gitignored; inside
the repo so `@remotion/renderer` resolves by walking up to `D:\repos\VidTSX-STUDIO\node_modules`), with ONE plugin:
`electron` → a stub module (`app.isPackaged = false`, `app.getPath(name)` → `<os.tmpdir()>/vidtsx-import-sfx-library/<name>`
except `userData`, which THROWS; `app.getAppPath()` → repo), any import resolving to `src/main/services/settings-db` → a
stub whose functions throw (never a settings store), every other bare specifier external (keep `@shared/` / `@main/` /
`@logging/` / `@audio-engine/` aliases resolving to `src/` if the graph uses them); then `require()` the bundle, parse
`--library <dir> --from <editor repo> [--dry-run] [--sfx-catalog <file>] [--music-catalog <file>] [--report <json>]`
(refusals per §7; sources = `{section, catalogPath: override ?? <from>/media/library/<section>/catalog.json, clipsDir:
<from>/media/library/<section>}`), print one line per item (action · relPath · sha256[0..12] · category · tags · LUFS ·
peak · usedIn · dropped · notes; after an import also `probe` and `probe − duration_s` in ms) + a summary, write the plan
/ results JSON to `--report`, exit 0 only when no conflict / missing-source / problem. Smoke it on a SCRATCH root
`C:\Users\hasan\AppData\Local\vidtsx-e2e\E4\smoke-root` (not the E4 profile yet): dry run (tree hash before = after) →
import (51 copy) → re-run (51 unchanged, index.json byte-equal); commit; then the live run on the E4 profile (exit steps
1–5 above) and the gates.

**Builder #1 (done):** read this file, E2's HANDOFF "Done" (the field semantics E2 settled), then
`src/main/services/library/library-store.ts` (`upsertEntry`), `library-filing.ts`, `library-paths.ts`, `scripts/
migrate-editor-project.mjs` (first 60 lines: the esbuild pattern) and `.vidtsx-temp/end-to-end/E1/list-assets.e1.test.ts`;
inspect the two catalogs read-only (`python -I -B` or node reading the JSON — never write in the editor repo). Write a
**design note** here (under Done): the module split (service ≤ 300 lines + the script), the relPath scheme, the field
mapping table (incl. where `license`, `prompt`/`desc`, `used_in`, `requested_ms` / `force_instrumental` / `function` go
or are dropped — say which are dropped and why), the dry-run proof, idempotency (hash-identical source → update
fields only), the CLI shape, the test list (red first, on a temp root with COPIES of two or three real clips from the
catalogs — copying from the editor repo is reading it). Then build the service + tests, commit at a green checkpoint,
and hand off or continue by the 30 % rule; the script, the live run on the E4 profile (dry run → import → re-run →
`list_assets` → the Assets still) and the gates follow.

## Open problems

(none blocking.) Two stated semantics for STATUS: (1) the catalog is the truth for the mapped fields, so a re-run
re-applies `description` / `tags` / `audio` over an in-app edit of them (only `usedIn` merges); (2) `upsertEntry` keeps
the existing `tags` when the mapped `tags` is `undefined`, so a catalog that DROPS its whole tag list does not clear the
entry's tags (a changed list replaces them).

## Do-not-redo

- The design note (above) and the catalog inspection (counts confirmed 2026-10-28).
- The service + its tests, `audio.license`, `mergeUsedIn`, `upsertEntry`'s `usedIn`, the pre-E1 control extension —
  commit `4aed92f` (green: 41 tests in 5 files; tsc 26 / 10).

## For Hasan (real-video list candidates)

- Importing the catalogs into HIS real library (`%APPDATA%\VidTSX Studio\assets`) — the one run of the importer with
  his library as the explicit target, after he has read the dry run.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-28 · builder #1 · ~36 calls · design note; `catalog-import-map.ts` + `catalog-import.ts` + tests (red → green);
  `audio.license`, `mergeUsedIn`, `upsertEntry` `usedIn`; pre-E1 control extended; tsc 26 / 10; commit `4aed92f`
  (records `dc41822` + this one).

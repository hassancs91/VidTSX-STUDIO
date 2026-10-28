# E4 — The importer over the reference `sfx/` and `music/` catalogs
status: DONE

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
   overwritten; moved file not re-copied (after a rescan only — R1 / E-d12, fix round 1). `library-used-in.test.ts` + `mergeUsedIn`; `pre-e1-control.test.ts` extended
   with `audio.license` (E-d5).

### Built (builder #2) — the script (design §7)

- `scripts/import-sfx-library.mjs` (~220 lines): esbuild-bundles `catalog-import.ts` (`platform node`, `cjs`) into
  `<repo>/.vidtsx-temp/import-sfx-library/catalog-import.bundle.cjs` with ONE plugin: `electron` → a stub (`isPackaged
  false`, `getPath('userData')` THROWS, other names → `<tmp>/vidtsx-import-sfx-library/<name>`), the repo's
  `settings-db` → a generated stub (every export of the real file, each throws), `@shared/ @main/ @logging/
  @audio-engine/` → `src/`, every other bare specifier external. Refuses (exit 2) without `--library` / `--from`, a
  non-folder `--library`, a `--library` (or `--report`) inside `--from`. Prints one line per item (action · relPath ·
  sha256[0..12] · category · [tags] · LUFS · peak(kind) · used_in · dropped · changes · notes; after a write `probe` and
  `probe-catalog` ms) + a `summary` JSON; `--report` writes `{summary, problems, items}`. Exit 1 on any conflict /
  missing-source / problem / failed clip.
- Scratch helper (not in the repo): `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E4\tree-hash.mjs <root> [out.json]` —
  one sha256 over every file (relPath + sha256, sorted) incl. `.vidtsx/index.json`.

## Verified (exact commands + outputs)

Builder #4, 2026-10-28 — FIX ROUND 1 (test + docs only; no app launch, no importer run, no profile copy; logs in
`D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E4\fix1-*.log`):
- N1 test change: `catalog-import.test.ts` `snapshot` (:45-57) pushes a `<rel>/` line per folder before recursing, plus
  `<rel> <sha256>` per file. RED first — mutation M1 applied TEMPORARILY with the Edit tool in `planCatalogImport`
  (`catalog-import.ts`, after `loadIndex`: `await fs.mkdir(path.join(libraryRoot, 'sfx'), { recursive: true });`), then
  `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/main/services/library/catalog-import.test.ts` → rc 1,
  `× the dry run (plan) writes nothing and states every file, target and the mapped fields` · `AssertionError: expected [ 'sfx/' ]
  to deeply equal []` · `Test Files 1 failed (1)` · `Tests 1 failed | 6 passed (7)` (`fix1-red.log`). (Before the change the same
  mutation passed — the verifier's M1: 24 / 24, `…\E4-verify\mutate.txt`.)
- GREEN: the mutation removed with the Edit tool; `git hash-object src/main/services/library/catalog-import.ts` = `HEAD:` blob
  `c6342087…` (byte-identical); `git diff --name-only -- src/ scripts/` → only `catalog-import.test.ts`; the same command → rc 0,
  `Test Files 1 passed (1)` · `Tests 7 passed (7)` (`fix1-green.log`).
- Targeted suites: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/main/services/library
  src/main/services/studio/agent-tools/library-listing.test.ts` → rc 0, `Test Files 25 passed (25)` · `Tests 219 passed (219)`,
  6.41 s (the 24 library files incl. `catalog-import*.test.ts`, `library-used-in.test.ts`, `pre-e1-control.test.ts`; no test
  exists for `scripts/`) (`fix1-suites.log`).
- Types: `tsc -p tsconfig.web.check.json --noEmit` → **26** `error TS`; `-p tsconfig.node.check.json` → **10**; 0 lines naming an
  E4 file (`fix1-tsc-web.log`, `fix1-tsc-node.log`).
- Commits: `4fa1551` (test, `catalog-import.test.ts` only), `51dff42` (records: Status.md + TESTING §18.16), + this HANDOFF / LOG
  commit. `git diff --stat 3a39dc7..HEAD -- src/ scripts/` → `catalog-import.test.ts | 7 +++++--` only. No rebuild: `wt/out` at
  `5247ed9` stays current (no product code changed; tests are not in the app bundle).
- Records changed (`51dff42`): TESTING.md:511 (item 1: N1 + N2), :518 (R1: the rescan condition, verifier N6 evidence, test
  :203, "For Hasan"), :520 new (the verifier-round-1 → fix-round-1 line); Status.md:10 (title), :27-29 (`planClip` lookup through
  index entries only), :46 (R2 `checkArgs` :74-83, refusals :81-82), :84-89 (N1 + N2), :139-149 (R1, was :132-134), :157-159
  ("For Hasan" — open the app once first), :160-167 new (the fix-round line).

Builder #3, 2026-10-28 — THE GATES (app stopped: 0 `electron.exe`; HEAD `cf5328d`; `git diff --stat 4aed92f..HEAD -- src/` empty →
no `src/` change since the service commit, `wt/out` at `5247ed9` is current, no rebuild). Outputs `C:\Users\hasan\AppData\Local\vidtsx-e2e\E4\`:
- Guard: `Get-PSDrive C,D` → C 53.1 GB, D 43.8 GB free; headroom `(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory/1MB` →
  29.5 GB (≥ 10 → default workers).
- Full worktree vitest, from the worktree root: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run` >
  `vitest-full-1.log` 2>&1 → `Test Files 3 failed | 489 passed | 5 skipped (497)` · `Tests 9 failed | 4165 passed | 35 skipped
  (4209)` · `Duration 74.43s`; 0 "Test timed out". The 3 files / 9 tests = E-d2a's suites, resolution only: `builder-libraries` 1
  (`@remotion/paths (builder-libraries.ts) is not installed`), `shot-bundle` 5 (`Could not resolve` `roughjs` / `@remotion/shapes` /
  `@react-three/fiber` / `chroma-js` / `@remotion/google-fonts/SpaceGrotesk`), `shot-bundle-in-place` 3 (all three import
  `chroma-js` — `Could not resolve "chroma-js" (v1.tsx:1)`; the two that pass do not import it).
- Rule (b): `git diff --name-only 5d77600..HEAD` → `diff-list.txt` (76 files); `node C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\import-graph.cjs
  <wt> diff-list.txt` → `import-graph.txt`: builder-libraries 2 / shot-bundle 15 / shot-bundle-in-place 23 (vi.mock'd, not loaded:
  shot-generator.ts, shot-import-land.ts, media-import.ts) / builder-unpack.mjs 1 local modules — touched by the E diff: **NONE**.
- Types: `tsc -p tsconfig.web.check.json --noEmit` → **26** `error TS`; `-p tsconfig.node.check.json` → **10** (baseline); 0 lines
  naming an E4 file (`tsc-web.log`, `tsc-node.log`).

Builder #2, 2026-10-28 — the smoke on a SCRATCH root `C:\Users\hasan\AppData\Local\vidtsx-e2e\E4\smoke-root` (logs in
`…\end-to-end\E4\smoke-*.log`, reports `…\vidtsx-e2e\E4\smoke-{dry,import,rerun}.json`):
- Refusals: no `--library` → rc 2 "--library is required (there is no default library)"; `--library C:\nope\none` →
  rc 2 "is not an existing folder — refusing"; `--library D:\repos\claude-youtube-editor\media` → rc 2 "lies inside
  --from".
- Dry run: `node scripts/import-sfx-library.mjs --library <smoke-root> --from D:/repos/claude-youtube-editor --dry-run`
  → rc 0, `counts {copy: 51}`, 0 problems, `noLicence` = the 4 `piano-*` chords; tree hash before = after
  (`e3b0c442…` empty, 0 files — no folder created).
- Import: rc 0, `{copy: 51}`, 0 failed, 5.7 s, `probe − duration_s` −42…0 ms (n 51); `whoosh-soft` probe 0.680 s;
  tree `075bc26e…` 52 files (51 + `index.json`) 9,069,944 B; dirs `.vidtsx music sfx`.
- Re-run: rc 0, `{unchanged: 51}`, 0.38 s; tree `075bc26e…` and `index.json` sha256 `271c1d08…` BYTE-EQUAL.

Builder #2, 2026-10-28 — THE LIVE RUN on the E4 profile (exit items 1–5). Kit (gitignored) `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E4\`:
`launch.sh`, `watchdog.ps1`, `restore.ps1` (E1 kit, E4 paths, CDP 9264), `cdp.mjs`, `root-set.js`, `tree-hash.mjs`,
`index-diff.mjs`, `exit.e4.test.ts` + `vitest.e4.config.ts`, `sfx-catalog.changed.json` (the changed COPY), logs `live-*.log`,
`exit-*.log`; outputs `C:\Users\hasan\AppData\Local\vidtsx-e2e\E4\` (reports `live-{1-dry,2-import,3-rerun,4-changed,5-back,
6-after-mark}.json`, index snapshots `index.after-*.json`, `exit.json`, stills `assets-{root,sfx,music}.png`, `build-1.log`, `app-2.log`).
- Guard: C 52.4 / D 43.8 GB free, headroom 31 GB; no electron.exe; no `%TEMP%\vidtsx-studio\export`. Profile: `robocopy source
  E4 /E /XF settings.db*` → rc 1, 2,325 files / 371.8 MB, **0 `settings.db*`** after. `wt/out` rebuilt at `5247ed9` (src =
  `4aed92f`; builder #2 changed NO `src/`) — rc 0, 2 m 51 s, only "use client" warnings (`build-1.log`).
- Launch 1 (CDP 9264, watchdog on): `studioRootSet` FIRST → `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E4\root`;
  `libraryRootGet` → `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\E4\profile\assets`, `isOverride: false`. Library before:
  7 files (`presets/`), no index. App STOPPED before the importer wrote (one writer at a time).
- 1 Dry run → rc 0, `{copy: 51}`; tree `6ca7edd6…` (7 files) before = after.
- 2 Import → rc 0, `{copy: 51}`, 5.4 s; tree `f8a68a50…` 59 files; `index.json` `de91fc4c…`.
- 3 Re-run → rc 0, `{unchanged: 51}`; tree + `index.json` BYTE-EQUAL (`de91fc4c…`) — **nothing changed**.
- 4 Changed catalog COPY (`wind-soft` + tag `e4-changed`, `--sfx-catalog …\E4\sfx-catalog.changed.json`) → `{unchanged: 50,
  update: 1}` (`changes: tags`); `index-diff` = only `sfx/wind-soft.mp3` key `tags`. 5 The original catalog again → `{update: 1}`,
  the tag gone again (the catalog is the truth for the mapped fields).
- `usedIn` + a Studio id: the REAL `markLibraryUsedIn(root, ['sfx/whoosh-soft.mp3'], 'e4-exit')` (`exit.e4.test.ts`,
  `E4_STEP=mark`) → the 16 editor ids + `e4-exit`; importer re-run → `{unchanged: 51}`, `index.json` byte-equal (`17f8783b…`) —
  the Studio id is kept.
- Exit check (`E4_STEP=verify`, app stopped, REAL handlers, `electron` + `settings-db` mocked): **51 / 51** byte-identical
  (sha256 library file = source); 51 / 51 fields (`kind audio`, `origin imported`, description = `prompt` / chords `desc +
  " (no licence recorded in the catalog)"`, `tags` = `normalizeTags(catalog)`, `audio.category / loudnessLufs / peakDbfs +
  peakKind 'sample' / source` VERBATIM `/ model / license`); `usedIn` verbatim 51 (41 non-empty); `probe.duration` vs the
  independent ffprobe n8.1.2: **max |Δ| 0 ms**; `probe − duration_s`: 38 × 0, 12 × +0.2…+0.5 ms (the catalog's 3-decimal
  rounding), `camera-shutter` **−42 ms** (encoder delay + padding). Index `version 1, rev 2`, 51 entries. Round 1 of the driver
  failed on ONE row: `trap-snap`'s catalog tags hold `snap` twice, the entry has it once (`normalizeTags` dedupe) — the driver
  now expects `normalizeTags(catalog)` and lists it (`tagsNormalizedBy`); round 2 `Tests 1 passed` (`exit-verify-2.log`,
  `exit.json`).
- The REAL `list_assets({ scope: 'library', kind: 'audio', query: 'whoosh' })` → 6 rows; whoosh-soft: `- library:sfx/whoosh-soft.mp3
  (audio, 0.68 s, imported) — "A short, soft air whoosh for a scene transition. …" · category: motion · tags: whoosh, transition,
  cutaway, air, swipe, motion · −20.0 LUFS · used in: short-1-chess, short-2-math, short-3-algo, ch-3-honeypot, short-6-sheet,
  ch-4-code-driven-logos, short-4-git, short-5-prob, short-8-phish, short-9-chords, short-10-fees, vox-1-coffee, short-11-map,
  ch-5-three-skills, blue-man-1-door, video-2, e4-exit`.
- Launch 2 (CDP 9264, watchdog on): root set first again; Assets → `Refresh` → root: `music`, `sfx`, `presets`, "3 items · 8.6 MB"
  (`assets-root.png`); dblclick `sfx` → 45 `.mp3` names, "45 items · 1.1 MB" (`assets-sfx.png`); breadcrumb `Assets` → dblclick
  `music` → 6 names, "6 items · 7.5 MB" (`assets-music.png`). The screen prints NO duration (E2's finding — pre-E2 UI; durations
  are in the index and the `list_assets` row). `app-2.log` 0 "error". After the app's scan: 57 entries (+6 `presets/` files),
  **none of the 51 imported entries changed** (`index-diff` after-mark vs after-app-scan). App stopped (4 processes, by profile
  path + Name).
- Editor repo never written: its `git status` shows `media/library/sfx/catalog.json` modified — PRE-EXISTING (mtime 2026-10-10
  11:18, sha256 `50555ee1…`), as are `media/library/catalog.json` and `faces/README.md`; not ours.

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

**E4 verifier round 2:** check fix round 1 against the evidence — `4fa1551` (the test: `snapshot` records folders; re-apply M1
and see it red, `fix1-red.log` / `fix1-green.log`), `51dff42` (records: TESTING §18.16 :511 / :518 / :520, Status.md E4 entry
:10 / :27-29 / :46 / :84-89 / :139-149 / :157-167 — the "Records changed" line under Verified) and that `git diff --stat
3a39dc7..HEAD -- src/ scripts/` is the test file only (so the round-1 gates, exit evidence and `wt/out` at `5247ed9` still stand).
Re-run anything on the verifier's OWN profile / scratch only (never the E4 profile's library — E3 may use it; never Hasan's).
Not edited here (orchestrator's file): `ORCHESTRATOR.md:921` (session-6 log) still says "a moved clip found by content hash,
not re-copied" — its :950-954 record R1 / E-d12.

(Done 2026-10-28 by builder #4 — see Verified:) **FIX ROUND 1 — builder #4 (orchestrator, 2026-10-28; verifier round 1 FAILED on the RECORDS only — see "Verifier round 1"
under Open problems; decision E-d12 below).** No product-code change. In order: (1) **N1, test-only, red first:** in
`src/main/services/library/catalog-import.test.ts` make the dry-run `snapshot` (:46-53) record DIRECTORIES as well as files
(e.g. a `dir/` line per folder), then prove it catches the verifier's mutation M1: temporarily make `planCatalogImport` /
the dry-run path create an empty `sfx/` folder (or `fs.mkdir` it in the test's dry-run call path) → the dry-run test goes RED
(record the command + output), revert the mutation → green; run `src/main/services/library` + `scripts`-related E4 suites +
`pre-e1-control.test.ts`, and tsc web / node (26 / 10). (2) **R1:** `docs/studio/TESTING.md:518` and `Status.md:133` (and any
other line claiming it, e.g. the code bullet for `planClip`): a moved clip is found by `hashFileHead` + sha256 ONLY through an
index entry that already records its new place — i.e. after the app (or `scanLibrary`) has rescanned the library; a clip moved
outside the app and NOT yet rescanned is copied again to its catalog place (a duplicate file, nothing lost) — cite the
verifier's N6 evidence (`C:\Users\hasan\AppData\Local\vidtsx-e2e\E4-verify\negatives.txt` / `stage2.txt` — read them for the
exact wording / numbers) and the unit test's `scanLibrary(root)` at `catalog-import.test.ts:200`. Add a line to "For Hasan":
open the app once (Assets → Refresh) before running the importer on a library where clips were moved by hand. (3) **R2:**
`Status.md:45` `checkArgs` (:74-80) → (:74-83), the two "inside --from" refusals at :81-82 (re-read the script at HEAD). (4) **N2**
(optional, one line in the records): the dry run with an index PRESENT is shown by verifier round 1 (digests equal, its
`lib-*.json` / `dry-*.log`) — the builders' live dry run had no index yet. (5) A line "verifier round 1 FAIL (records: R1, R2)
→ fix round 1 `<hash>`" in the Status entry and §18.16. Commit the test (`test(studio): E4 — …`) and the docs (`docs(studio):
E4 — …`) with explicit paths; HANDOFF `status: DONE`, LOG line, commit. Rebuild `wt/out` is NOT needed (test + docs only — the
app bundle does not include tests; say so).

**E-d12 (orchestrator, 2026-10-28):** R1 is closed by stating the condition, not by a code change. The importer runs with the
app closed; finding a hand-moved clip without an index entry would need the importer to scan the library itself, and a scan
writes the index — which the dry run must never do. The consequence of the stated limit is a duplicate copy of a clip (an extra
file, nothing lost, nothing overwritten), and the remedy is one rescan in the app before the run (on Hasan's list).

(Superseded 2026-10-28 by the FAIL above:) **E4 verifier:** check the records against the evidence — Status.md E4 entry (lines 10–150, commit `ce9aaac`), TESTING §18.16
(lines 509–520), the gates above (`C:\Users\hasan\AppData\Local\vidtsx-e2e\E4\vitest-full-1.log`, `import-graph.txt`, `tsc-*.log`)
and the live evidence (`exit.json`, `live-*.json`, `index.after-*.json`, the three stills) — on the verifier's OWN isolated profile /
scratch root if anything is re-run (never the E4 profile's library, which E3 may use; never Hasan's library).

**Builder #3 (done):** run the gates, then write the records. Exit items 1–5 are MET (Verified, builder #2 live run) — never redo
them. No app running; no `src/` change since `4aed92f` (so `wt/out` at `5247ed9` is current — rebuild only if you change
`src/`). (1) Resource guard; full worktree vitest `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run` (add
`--maxWorkers=2` if headroom < 10 GB) logged to `C:\Users\hasan\AppData\Local\vidtsx-e2e\E4\vitest-full-1.log`; green except the
three E-d2a suites with resolution errors only; rule (b): `git diff --name-only 5d77600..HEAD` vs their import graphs (esbuild
metafile per suite, packages external, `?raw` as leaves, `vi.mock`'d modules not followed — E2's method, `…\E2\import-graph-2.txt`);
tsc web 26 / node 10. (2) Status.md entry at the TOP (2026-10-28, house format, the Verified numbers below + the two re-run
behaviours under Open problems + the `trap-snap` dedupe + the relPath scheme `sfx/<id>.mp3` / `music/<id>.mp3` + licence in
`audio.license` / chords' description), TESTING §18.16 (E-d10, model §18.15), HANDOFF `status: DONE`, a LOG line, commit.

**Builder #2 (done):** build `scripts/import-sfx-library.mjs` per design §1 + §7 — esbuild-bundle
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

**Fix round 1 (builder #4, 2026-10-28): R1, R2, N1, N2 CLOSED** — R1 + R2 + N2 in the records (`51dff42`), N1 by the test
(`4fa1551`, red with M1 → green); N3 / N4 / N5 need no change (already recorded). Nothing open.

### Verifier round 1 — FAIL on the records only (2026-10-28; its own profile `profiles\E4-verify`, CDP 9274; evidence `C:\Users\hasan\AppData\Local\vidtsx-e2e\E4-verify\`, kit `.vidtsx-temp\end-to-end\E4-verify\`)

- **R1 (records defect).** `docs/studio/TESTING.md:518` "a moved file (same bytes elsewhere, found by `hashFileHead` + sha256) is
  not re-copied" holds only when the index already records the new place: the cited unit test rescans first
  (`catalog-import.test.ts:200` `await scanLibrary(root)`), and `planClip` (`catalog-import.ts:114-121`) looks only through index
  entries whose `hash` matches. Verifier case N6: in a scratch library `sfx/chime-reward.mp3` moved to `favs/` WITHOUT a rescan →
  the importer planned `copy` and left two copies; after the app's own scan the same kind of move (`camera-shutter` → `my-favs/`)
  → `unchanged`, no copy, index byte-equal. `Status.md:133` says the same as TESTING. → E-d12 under Next step.
- **R2 (records nit).** `Status.md:45` "`checkArgs` (:74-80) holds the refusals" — the function spans :74-83; the two "inside
  --from" refusals are at :81-82.
- Notes (non-blocking): **N1** the dry-run unit test's `snapshot` (`catalog-import.test.ts:46-53`) lists files only, so a dry run
  that creates an empty folder passes (mutation M1: 24 / 24 green; M1b "dry run writes a file" caught); the code creates none.
  **N2** the builders' live dry run had no `index.json` yet — "incl. `.vidtsx/index.json`" is shown only by the verifier's dry runs
  with an index present (digests equal). **N3** the esbuild bundle write `wt/.vidtsx-temp/import-sfx-library/catalog-import.bundle.cjs`
  is the one write outside `--library` / `--report` (gitignored, documented). **N4** the Assets tiles show no duration (the exit's
  durations are in the index + `list_assets`, as recorded). **N5** rule (b) counts differ by method (2 / 15 / 23 / 1 vs its
  esbuild 2 / 12 / 20) — both NONE.
- What passed (the verifier's own numbers): gates (default workers, headroom 31 GB) 489 / 3 / 5 files, 4,165 / 9 / 35 tests, the 3
  E-d2a suites resolution only; its own esbuild graph 0 / 0 / 0 (control: `catalog-import.test.ts` → 16 hits); tsc 26 / 10. Its own
  profile + its own reader: dry run tree hash equal (fresh and with an index); 51 copied in 4.77 s; 51 / 51 sha256-identical, every
  field = the catalog, `usedIn` verbatim, probe = ffprobe n8.1.2 0 ms; re-run byte-equal; a project join through the real
  `importLibraryFile` survives a re-run; its own changed copy (4 entries: category, a `used_in` id, a prompt, a tag REMOVED) → exactly
  those 4 entries / fields changed, the project id kept; `list_assets` whoosh row ✓; the editor library tree digest unchanged.
  Negatives: 5 refusals rc 2 (nothing written), conflict + missing source in one run (sha kept, no entry), no writes outside
  `--library` / `--report` but the bundle; E-d5 its own control on its imported index (no pre-E1 field lost; new fields kept);
  mutations M1b / M2 / M3 / M4 caught. Live CDP 9274 (Studio root first): `sfx` / `music` / its moved folder listed; the app's scan
  re-keyed the moved entry with all fields.

(none blocking before verifier round 1.) Two stated semantics for STATUS: (1) the catalog is the truth for the mapped fields, so a re-run
re-applies `description` / `tags` / `audio` over an in-app edit of them (only `usedIn` merges); (2) `upsertEntry` keeps
the existing `tags` when the mapped `tags` is `undefined`, so a catalog that DROPS its whole tag list does not clear the
entry's tags (a changed list replaces them). Builder #2 adds: (3) design note "no tag needs normalizing" was wrong —
`trap-snap`'s catalog list holds `snap` twice; the entry has 6 tags (`normalizeTags` dedupe; every other list verbatim);
(4) the HANDOFF's "−27…−51 ms" duration expectation held for ONE clip only (`camera-shutter` −42 ms); the other 50 are within
+0.5 ms of `duration_s`; (5) the Assets screen shows no durations (E2 noted it) — the exit's "files and durations" is met by the
files on screen + the durations in the index / `list_assets` row.

## Do-not-redo

- The design note (above) and the catalog inspection (counts confirmed 2026-10-28).
- The service + its tests, `audio.license`, `mergeUsedIn`, `upsertEntry`'s `usedIn`, the pre-E1 control extension —
  commit `4aed92f` (green: 41 tests in 5 files; tsc 26 / 10).
- The script `scripts/import-sfx-library.mjs` (`5247ed9`) + its smoke; the E4 profile copy; the `wt/out` build at `5247ed9`;
  the whole live run (dry run, import, re-run, changed COPY + back, Studio-id mark + re-run, exit check, `list_assets`, the
  three Assets stills). The E4 library now holds the 51 clips (whoosh-soft `usedIn` ends with `e4-exit`) — E3 may use it.
- The gates at `cf5328d` (`8dba927`) and the records — Status.md E4 entry, TESTING §18.16 (`ce9aaac`). Re-run the gates only if
  `src/` changes.
- Fix round 1: the N1 test (`4fa1551`, red → green) and the R1 / R2 / N2 / fix-round records (`51dff42`).

## For Hasan (real-video list candidates)

- Importing the catalogs into HIS real library (`%APPDATA%\VidTSX Studio\assets`) — the one run of the importer with
  his library as the explicit target, after he has read the dry run.
- Before that run, if clips were moved by hand in his library: open the app once (Assets → Refresh) so the moves are indexed —
  else each moved clip is copied again to its catalog place (a duplicate, nothing lost; E-d12).

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-28 · builder #1 · ~36 calls · design note; `catalog-import-map.ts` + `catalog-import.ts` + tests (red → green);
  `audio.license`, `mergeUsedIn`, `upsertEntry` `usedIn`; pre-E1 control extended; tsc 26 / 10; commit `4aed92f`
  (records `dc41822` + this one).
- 2026-10-28 · builder #2 · ~45 calls · `scripts/import-sfx-library.mjs` + smoke (`5247ed9`); E4 profile; `wt/out` build; the
  live run — exit items 1–5 MET; gates + records left (Next step).
- 2026-10-28 · builder #3 · ~38 calls · the gates (vitest 489 / 3 / 5 files, 4,165 / 9 / 35 tests, 74.43 s; rule (b) none;
  tsc 26 / 10 — `8dba927`); Status.md E4 entry (lines 10–150) + TESTING §18.16 (lines 509–520) (`ce9aaac`); status DONE (this
  commit). No `src/` change, no rebuild, no app launch, no importer run.
- 2026-10-28 · builder #4 (fix round 1) · ~35 calls · N1 test (`snapshot` records folders) red with M1 → green (`4fa1551`);
  records R1 / R2 / N2 + the verifier-round-1 line in Status.md + TESTING §18.16 (`51dff42`); library suites 25 files / 219
  tests; tsc 26 / 10; status DONE (this commit). No product-code change, no rebuild, no app launch, no importer run.

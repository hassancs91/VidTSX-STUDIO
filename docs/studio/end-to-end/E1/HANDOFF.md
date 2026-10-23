# E1 — Index v2: `kind`, `probe` on upsert, `tags`, `audio`, `usedIn`; one kind table; migration
status: IN PROGRESS (builder #1 handed off 2026-10-23 — kind table + types + control copies done)

> Track E, session 4. **Work only in the worktree** `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E\wt`
> (branch `end-to-end-p0-e`); paths below are relative to it. Decisions E-d1…E-d10 in ORCHESTRATOR.md
> "Session 4 — track E" bind this part.

## Goal (the §3 row verbatim + the exit)

| **E1** | Index v2: `kind`, `probe` on upsert, `tags`, `audio`, `usedIn`; one kind table; migration | `list_assets(scope:'library')` shows durations for every audio file |

**Exit:** `list_assets(scope:'library')` shows durations for every audio file.

**How the exit is measured (orchestrator):** an isolated profile's library (E-d3) seeded in the PRE-E1
index format (entries without `probe`/`kind`, as the pre-E1 code writes them) with real audio files of
every audio extension in the kind table (at least `.mp3 .wav .m4a .ogg .opus .flac`), plus an image and a
video. After the migration (the worktree app launched on that profile), the REAL `list_assets` handler with
`scope:'library'` prints a duration for every audio file (and the video); each duration matches an
independent ffprobe within 10 ms; a file added AFTER the migration (the upsert path) gets its duration too;
a reconcile pass (a file touched / renamed / added on disk) keeps or refreshes `probe` instead of clearing
it. Plus the session gates below.

## Plan context

- **T6 (decision, first bullet, verbatim):** "`LibraryIndexEntry` gains `kind` (one shared extension → kind
  table replaces the two that disagree), `probe` **filled on upsert** for audio and video (ffprobe
  duration), `tags[]`, `audio?: { category, loudnessLufs, peakDbfs, source, model }`, `usedIn[]` (project
  ids, written when a `library:` ref lands in a project through `insert_asset`, `generate_tsx_shot`
  assetRefs or the pool import). Index version 2 with a migration that back-fills `kind`."
- **§1.6 facts (verbatim):** "`LibraryIndexEntry` is the only per-asset record: `relPath, hash?,
  description?, brandId?, origin ('imported'|'generated'|'captured'), addedAt, probe?, size?, mtimeMs?`
  (`asset-library.ts:17-37`). **No `kind`, no `tags`, no `duration`, no `usedIn`.** `probe` is **never
  written** (`upsertEntry`, `library-store.ts:138-170`; reconcile clears it), so
  `list_assets(scope:'library')` never shows a duration (`project-tools.ts:59`). Kind is derived from the
  extension in two places that disagree on `.opus` (`media-import.ts:38-44`,
  `features/asset-library/services/file-type.ts:3-19`)." Describe is vision-only; the Assets screen
  filters by category + free text (`asset-search.ts:12-52`).
- **Split of work across track E (so E1 does not over-build):** E1 = the fields + types, the one kind
  table, probe on upsert + kept across reconcile, the migration, durations in `list_assets`. **E2** fills
  `tags` / `audio` at generation (loudness) and writes `usedIn` on every landing. **E4** fills them from the
  reference catalogs. **E3** adds `list_assets(… kind:'audio', query)` filtering, shows category / tags /
  `usedIn` in its output, the reuse rule, and the Assets screen playback + chips. Showing `kind` beside the
  duration in E1 is fine.
- **E-d5 (downgrade safety) is a hard requirement of this part:** today's `loadIndex`
  (`src/main/services/library/library-store.ts:42`) returns an EMPTY index when `version !== 1`, and its
  next write rebuilds the index from a disk scan (descriptions, origins, brand ids, hashes, tombstones
  lost). Hasan's installed 1.1.x app and the main-branch code read the same
  `%APPDATA%\VidTSX Studio\assets\.vidtsx\index.json` as any dev build he runs. So: an E1-written index is
  read WITHOUT LOSS by the pre-E1 reader — prove it with a control test that runs the pre-E1 `loadIndex`
  and its upsert / reconcile writes (source from `git show 5d77600:src/main/services/library/…`) on an
  E1-written index; record whether the NEW fields survive an old write. Meet "version 2" with a marker the
  old reader ignores (e.g. keep `version: 1`, add `rev: 2`) or any mechanism that passes the control. The
  migration writes a one-time backup of the pre-migration index beside it (e.g.
  `.vidtsx/index.v1-backup.json`) and is idempotent.
- **ffprobe:** use whatever the app already uses to probe media (Remotion's compositor ffprobe / the
  existing probe helpers) — no new binaries, no new packages. Probing must not block the main process for
  long on a big library (the migration back-fill runs in the background / batched; say how long it took
  on your seeded library).
- **§5 items touching E:** "Docs to update when built: `CAPABILITY_GAPS.md` (… G4 narrowed by E) …" — E3
  does the G4 note; E1 updates nothing there unless it changes a documented fact.
- **Gates (every part):** full vitest green from the worktree (`--maxWorkers=2` while commit headroom
  < 10 GB; DRIVING.md's load-timeout rule applies); types ≤ web 26 / node 10; a live CDP click-through on
  an isolated profile from the worktree's own build (for E1: launch on the seeded profile → the migration
  on disk (backup present, kinds, probes) → the Assets screen still lists every file (a still) → the
  `list_assets` output); the Status.md entry at the top (dated, house format, measured numbers); the
  TESTING.md **§18.14** block; committed on `end-to-end-p0-e` with explicit paths.

## Done (file:line, commit hashes)

### Design note (builder #1, 2026-10-23 — read before building; it binds the rest of E1)

Code read (pre-E1, `5d77600`): `asset-library.ts:15-58` (entry/tombstone/file types, `version: 1`),
`library-store.ts:38-47` (`loadIndex`: `version !== 1` → EMPTY), `:138-170` (`upsertEntry`, no probe),
`library-reconcile.ts:57-144` (pure; pass 1 touched → `probe: undefined`; moved = spread (keeps every
field); `toTombstone`/`resurrect`/new entries name pre-E1 fields only; returns a fresh
`{ version: 1, entries, tombstones }` — **drops unknown top-level keys**), `media-import.ts:17-44`
(VIDEO/AUDIO/IMAGE sets + `classifyMediaKind`; `probeMedia` :91 = Remotion's ffprobe, `-show_format`
duration), `file-type.ts:3-19` (renderer table: no `.opus .mts .m2ts`; has `.avif` + model3d/font/data),
`project-tools.ts:53-69` (library rows: `classifyMediaKind`, `probe?.duration.toFixed(1)`).
Callers: `upsertEntry` ×13 (capture, generate-{audio,image,video}, render-jobs, port-media, 3D, …);
`scanLibrary` from library IPC (Assets screen), organize-apply, library-ai, builder-asset-tools;
`loadIndex` from list_assets, `shot-asset-refs.ts:141`, `library-import.ts:52`.

1. **One kind table** — `src/shared/media-kinds.ts`: `MEDIA_EXT_KIND` ext → `LibraryAssetKind`
   (`'video'|'audio'|'image'|'model3d'|'font'|'data'|'other'`), the UNION of both old tables (`.opus`,
   `.mts`, `.m2ts`, `.aac` in; `.avif` an image). `mediaKindOf(name)` returns the kind ('other' for
   unknown). `classifyMediaKind` (main) = the table narrowed to video/audio/image (null otherwise) and
   `MEDIA_DIALOG_FILTERS` are built from it; `file-type.ts` `classifyAsset` reads the same table
   (`AssetCategory` = `LibraryAssetKind`). One behaviour change: `.avif` becomes importable as an image
   (Chromium draws it; ffprobe only fills width/height — check the bundled ffprobe reads it, else note it).
2. **Types** (`asset-library.ts`, optional fields only): entry gains `kind?`, `tags?: string[]`,
   `audio?: LibraryAudioMeta { category?, loudnessLufs?, peakDbfs?, source?, model? }`,
   `usedIn?: string[]`; tombstone gains the same four + `probe?` (so a delete → re-import keeps them);
   `LibraryIndexFile` gains `rev?: 2`. `version` STAYS `1` (E-d5). E1 fills `kind` + `probe`; E2/E4
   fill `tags`/`audio`/`usedIn` (`upsertEntry` meta accepts `tags?`/`audio?` now, pass-through only).
3. **Read path** — new `loadIndex` accepts `version: 1` (with or without `rev`) exactly as before and
   derives a missing `kind` from the table on read (no write), so every consumer sees `kind`.
4. **Probe on upsert** — new `library-probe.ts` `probeLibraryFile(abs, kind)`: audio/video only,
   `probeMedia` (the app's ffprobe), errors → `undefined` + a warn (never fails the upsert). `upsertEntry`
   probes before entering the serialize chain (like the hash) and writes `kind` + `probe`.
5. **Reconcile** keeps/refreshes probe: `reconcileIndex` takes an optional injected
   `probeOf(relPath, kind)`; touched (size/mtime changed) → refreshed probe (was: cleared); moved → kept
   (spread, as before); resurrected → tombstone's probe/kind/tags/audio/usedIn, else probed; new → probed
   + `kind`. `scanLibrary` passes a BUDGETED prober (inline cap per scan, e.g. 20 files) so a mass drop
   never stalls the Assets screen; whatever is left without a probe goes to the back-fill (6).
6. **Back-fill** — `library-backfill.ts` `scheduleProbeBackfill(root)`: deduped per root, runs off the
   startup path, probes audio/video entries lacking `probe` in small batches (concurrency 2), writes once
   per batch under the store's serialize chain, and only patches an entry whose relPath + size + mtime
   still match what was probed. Kicked after every scan and by the migration.
7. **Migration** — `library-migrate.ts` `migrateLibraryIndex(root)` at app start (`index.ts` beside
   `sweepExportScratch`, `void …catch`): reads the raw file; when `rev !== 2` or an entry lacks `kind`:
   copy the RAW pre-migration bytes to `.vidtsx/index.v1-backup.json` once (never overwritten), back-fill
   `kind`, write `rev: 2`, then `scheduleProbeBackfill`. Idempotent (rev 2 + every kind → no write).
   A missing/unreadable index → nothing (no backup, no write). An old-app write drops `rev` → the next
   start re-runs it (backup kept from the first run).
8. **E-d5 control** — frozen copies of the pre-E1 `library-store.ts` + `library-reconcile.ts`
   (`git show 5d77600:…`, import paths adjusted only) under `src/main/services/library/pre-e1-control/`;
   a test writes an E1 index (kinds, probes, tags, audio, usedIn, rev 2) and runs the OLD
   `loadIndex` / `upsertEntry` / `setDescription` / `scanLibrary` (touched + moved + deleted + new file)
   on it: every pre-E1 field must survive; the test pins which NEW fields survive an old write (expected:
   untouched + moved entries keep all; touched keep all but `probe`; tombstoned lose the new four; `rev`
   dropped by an old scan) and that the new reader + migration recover (kind back-filled, backup kept).
9. **list_assets** — library rows use `entry.kind`, print `kind` + duration `toFixed(2)` s (≤ 5 ms
   rounding, inside the 10 ms exit tolerance) for audio/video, `length unknown (probing)` when a media
   entry has no probe yet.
10. **Module split (decided while building, to stay under ~300 lines and avoid an import cycle
    store ↔ back-fill):** new `library-index-io.ts` = `serialize`, `loadIndex` (kind derived on read),
    `writeIndex` (always `version: 1, rev: 2`; before its FIRST write per root per process it makes the
    one-time `index.v1-backup.json` from the raw on-disk bytes when they lack `rev: 2` and no backup
    exists — so no new-code write, migration or not, can replace a pre-E1 index without the backup),
    `updateIndex(root, mutate)`. `library-store.ts` keeps scan / setDescription / upsert / findByHash and
    re-exports `loadIndex` (callers unchanged); `library-backfill.ts` and `library-migrate.ts` import the
    io module. `library-probe.ts` wraps `probeMedia` with a 15 s timeout (a hung ffprobe must never stall
    the per-root chain). Unit tests mock `./library-probe` (no real ffprobe in new tests); suites that do
    not mock it fall back gracefully (probe fails → undefined) — watch their timing in the full run.

### Built (builder #1) — commit `cd978c3`

- **Kind table** — `src/shared/media-kinds.ts:11-48` (`MEDIA_EXT_KIND`, `extensionOf`, `mediaKindOf`,
  `isPlayableMediaKind`, `extensionsOfKind`) + `src/shared/media-kinds.test.ts` (6 tests, red first:
  module missing → green). Wired: `media-import.ts:17-40` (`classifyMediaKind` + `MEDIA_DIALOG_FILTERS`
  from the table), `features/asset-library/services/file-type.ts` (whole file, `classifyAsset` reads the
  table), `features/asset-library/types.ts:4-5` (`AssetCategory = LibraryAssetKind`).
- **Types** — `src/shared/types/asset-library.ts`: `LibraryAssetKind`, `PlayableMediaKind`,
  `LibraryAudioMeta`, `LibraryIndexV2Fields` (`kind? tags? audio? usedIn?`) on entry AND tombstone
  (tombstone also `probe?`), `LIBRARY_INDEX_REV = 2`, `LibraryIndexFile.rev?` with `version: 1` kept
  (E-d5 comment on the field).
- **E-d5 control copies** — `src/main/services/library/pre-e1-control/library-store.ts` (200 lines) and
  `library-reconcile.ts` (149): `git show 5d77600:…` + a 4-line header, only the relative import paths
  rewritten (sed: `../../../logging|shared` → 4 levels, `../studio/media-import` → `../../studio/…`,
  `./library-paths|sizes` → `../`). Not imported by app code. **The control TEST is not written yet.**

## Verified (exact commands + outputs)

- 2026-10-23 20:25, from the worktree root:
  `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/shared/media-kinds.test.ts` before
  the module → `Test Files 1 failed (1)` (red: import missing); after → `Tests 6 passed (6)`.
- `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.node.check.json --noEmit | grep -c "error TS"`
  → **10**; `-p tsconfig.web.check.json` → **26** (= baseline, with the control copies in the tree).
- `node …/vitest.mjs run src/shared/media-kinds.test.ts src/main/services/library src/features/asset-library src/main/services/studio/media-import`
  → `Test Files 14 passed (14)`, `Tests 129 passed (129)`.
- No launch, copy or full run yet → no resource numbers needed yet (take them before the first one).

## Next step (ONE concrete instruction)

Write `src/main/services/library/pre-e1-control.test.ts` RED-first against the design (§8) — it imports
the NEW `library-store` / a new `library-migrate` (missing → red) and the frozen
`pre-e1-control/library-store`, writes an E1 index, runs the old `loadIndex` / `upsertEntry` /
`setDescription` / `scanLibrary` (touched + moved + deleted + new file) on it and pins the survivors —
then build design §10 (`library-index-io.ts`, `library-probe.ts`) and §3–§7 (reconcile `probeOf`,
upsert probe, back-fill, migration) until it and new unit tests for each are green; then §9
(`list_assets`) and the startup hook in `src/main/index.ts` beside `sweepExportScratch` (:227).

## Open problems

(none)

## Do-not-redo

- The design note above (code already read: the §1.6 files, all callers listed in it).
- The kind table and its wiring; the type additions; the frozen control copies (re-create them only if
  5d77600's files are found to differ — they were taken by `git show`).

## For Hasan (real-video list candidates)

(none)

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-23 · builder #1 · ~40 · design note; kind table (red→green) + wiring; v2 types; frozen pre-E1
  control copies; checkpoint commit. Handed off at the tool-call budget.

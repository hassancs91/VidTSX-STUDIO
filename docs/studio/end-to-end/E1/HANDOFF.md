# E1 — Index v2: `kind`, `probe` on upsert, `tags`, `audio`, `usedIn`; one kind table; migration
status: FIX (verifier round 2 FAIL — V2-1 garbage file listed 0.00 s, V2-2 mp3 range, W1–W3 docs; orchestrator 2026-10-23 ~22:45; LAST fix round)

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
  `./library-paths|sizes` → `../`). Not imported by app code.

### Built (builder #2) — commit `6005a7e` (design §3–§10 all built; nothing left in code)

- **E-d5 control test, RED first** — `src/main/services/library/pre-e1-control.test.ts` (5 tests). Red at
  20:26 (`./library-index-io` missing), green after the build. It runs the FROZEN pre-E1 store on an
  index written by the E1 code. **Findings (pinned):** the old `loadIndex` reads the E1 index whole
  (`version: 1` + `rev: 2` → NOT the empty index; every entry incl. the new fields); old
  `setDescription` / `upsertEntry` keep EVERY field, old and new, and keep `rev: 2`; old `scanLibrary`:
  untouched + moved entries keep everything, touched keep all but `probe` (cleared; hash refreshed),
  tombstones keep the pre-E1 fields only (lose `kind probe tags audio usedIn`), new files get no `kind`,
  and `rev` is DROPPED → the next E1 start re-migrates (backup = the old-written bytes, kinds back,
  back-fill re-probes). Every pre-E1 field survives every old write.
- **IO** — `library-index-io.ts` (127 lines): `serialize` (the one per-root chain), `parseIndex`,
  `withKinds`, `loadIndex` (:60, kind derived on read), `backupIndexOnce` (:72, `flag: 'wx'` = never
  overwritten), `writeIndex` (:101, always `version: 1, rev: 2`; first write per root per process backs
  up an on-disk index lacking rev 2), `updateIndex`.
- **Probe** — `library-probe.ts` `probeLibraryFile` (audio/video only via `probeMedia`, 15 s race, never
  throws). `isTimedMediaKind` added to `src/shared/media-kinds.ts`.
- **Reconcile** — `library-reconcile.ts`: optional `probeOf` (5th arg, default → undefined); every
  output entry gets `kind` from the table; touched → probe REFRESHED; moved → kept; tombstones carry
  `kind probe tags audio usedIn`; resurrect → tombstone's probe else probed; new → probed.
- **Store** — `library-store.ts`: `scanLibrary` passes a budgeted prober (`SCAN_PROBE_BUDGET = 20` inline
  ffprobes per scan) and kicks the back-fill when a timed entry still lacks a probe; `upsertEntry`
  probes BEFORE the chain, writes `kind` + `probe` (keeps the old probe only for an unchanged file),
  passes `tags` / `audio` through; re-exports `loadIndex`.
- **Back-fill** — `library-backfill.ts` `scheduleProbeBackfill(root)`: deduped per root (a request
  mid-pass queues one more pass; the promise settles after all), batches of 8, 2 ffprobes at a time,
  one write per batch, patches only while relPath + size + mtime match, never recreates a gone index,
  does not retry an unchanged failed file (per process). Returns `{candidates, probed, failed, written,
  ms}` and logs `Library probe back-fill pass` (read the timing for the seeded library from the app log).
- **Migration** — `library-migrate.ts` `migrateLibraryIndex(root)` → `{migrated, backedUp, kindsFilled,
  skipped?}`; `migrateLibraryIndexAtStartup()` hooked in `src/main/index.ts` right after
  `sweepExportScratch` (dynamic import, `void …catch`). Logs `Library index migrated to rev 2`.
- **list_assets** — `src/main/services/studio/agent-tools/library-listing.ts` `formatLibraryListing`
  (pure): playable kinds only (as before), `entry.kind`, `toFixed(2)` s for audio/video, `length
  unknown (probing)` with no probe; `project-tools.ts` calls it (the old inline loop + cap removed).
- **Unit tests** (written after their modules — only the control test was red-first):
  `library-reconcile-v2.test.ts` (8), `library-migrate.test.ts` (9: migration of a pre-E1 index with
  all six audio extensions, idempotence, no-index / unreadable / non-v1 untouched, backup on a plain E1
  write, upsert probe + pass-through, failed-probe no-retry, scan budget + back-fill, size/mtime guard,
  gone index), `agent-tools/library-listing.test.ts` (4).

### Live-check prep (builder #3, 2026-10-23 20:39–) — no `src/` change

All kit files in `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E1\` (outside the worktree, gitignored):
- **Resources + E-d4 at 20:39:** C: 55.2 GB free, D: 26.0 GB, commit limit 99.7 GB, headroom 51.1 GB.
  Hasan's app = `electron.exe .` (pid 41748, `--user-data-dir=C:\Users\hasan\AppData\Roaming\VidTSX Studio`)
  with NO ffmpeg / ffprobe / Remotion children; `%TEMP%\vidtsx-studio\export` does not exist → not exporting.
  Ports 9261 / 9262 / 9266 free.
- **Profile (b) DONE:** `robocopy profiles\source\profile profiles\E1\profile /E /XF settings.db*` → 371.9 MB,
  `settings\` empty. Path `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\E1\profile`. Its `assets\` had
  only `presets\` (3 × `preset.json` + `PRESET.md`, + `.seeded.json`) — no index before the seed.
- **Media (c) DONE:** `node seed-media.mjs <profile> e1-seed` (the PROFILE COPY's `ffmpeg-full` n8.1.2) →
  `<profile>\assets\e1-seed\` `tone-a.mp3` 1.3 s · `tone-b.wav` 2.25 · `tone-c.m4a` 3.1 · `tone-d.ogg`
  (vorbis) 1.75 · `tone-e.opus` 2.6 · `tone-f.flac` 0.9 · `tone-g.aac` (ADTS) 1.5 · `still.png` · `still.avif`
  (libaom, for the open `.avif` question) · `clip.mp4` (2 s h264 + aac). `only=late-h.wav,tone-b-longer.wav`
  makes the post-migration / touch cases.
- **Pre-E1 index (c) DONE — written BY the frozen pre-E1 code** (more faithful than mimicking it):
  `seed-index.e1.test.ts` runs `pre-e1-control/library-store.ts` `scanLibrary(<profile>\assets)` through
  the scratch config `vitest.e1.config.ts` (root = the E1 folder, **`cacheDir` pinned to `E1\.vite-cache`** —
  with no package.json there Vite would otherwise cache into the main checkout's `node_modules`; checked:
  main `node_modules\.vite-temp` untouched since 09/17, its `.vite` results predate the run). Result:
  `{version:1, entries:16, tombstones:[]}` (10 seed + 6 preset files; `.seeded.json` skipped), no `rev`,
  no `kind`, no `probe`; sha256 `b495fdfaa027bf200c5941be693835574665b048963c927f4f0eb91db03cefcd`; copy
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\index.pre-e1.seeded.json` (the backup must equal it).
- **Drivers written, NOT yet run:** `launch.sh` (worktree build, no Vite server, CDP 9261), `watchdog.ps1`
  (stops only processes whose command line holds `vidtsx-e2e\profiles\E1\profile` when C: < 1.5 GB; exits
  when that instance is gone), `cdp.mjs` (`wait` / `eval` / `assets` / `shot`), `list-assets.e1.test.ts`
  (REAL `buildProjectTools(ctx)` `list_assets({scope:'library'})` with the real `getLibraryRoot()` —
  electron `userData` = the E1 profile, settings-db mocked to "no override" — + an independent ffprobe
  (the profile's ffmpeg-full) per audio/video entry, report → `…\vidtsx-e2e\E1\<E1_REPORT>.json`),
  `upsert.e1.test.ts` (REAL `upsertEntry` with the real Remotion ffprobe on a file added after the
  migration; run ONLY while the E1 app is stopped).
- **Build (d) DONE (launch NOT yet tried):** from the worktree root, Bash:
  `unset ELECTRON_RUN_AS_NODE; export NODE_OPTIONS=--max-old-space-size=8192; node D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build > C:/Users/hasan/AppData/Local/vidtsx-e2e/E1/build.log 2>&1`
  → rc 0 in **113 s** (`✓ built in 1m 39s` for the renderer), only "use client" warnings; writes
  `wt/out/{main,preload,renderer}` (127 MB; gitignored by `out/`); packages resolve from the main
  checkout's `node_modules` by walking up (read-only). The main checkout's `out/main/index.js` stayed at
  20:01 (Hasan's). A build leaves no Vite dep cache.

### Live check + live bug fix (builder #4, 2026-10-23 20:46–20:57) — see the commit after `af915f8`

- **Resources + E-d4:** 20:46 C: 55.0 GB free, D: 25.8 GB, commit limit 99.7 GB, headroom 50.8 GB; 20:55
  C: 54.9, headroom 49.7. No ffmpeg / ffprobe / Remotion process anywhere, no `%TEMP%\vidtsx-studio\export`
  → Hasan's app not exporting (both launches). Ports 9261/9262/9266 free.
- **Launch 1 (20:46, build of `6005a7e`):** ready at once; `libraryRootGet()` → `root` =
  `…\profiles\E1\profile\assets`, `isOverride: false`. Profile log: `Library index migrated to rev 2`
  `{fromRev: null, entries: 16, tombstones: 0, kindsFilled: 16, backedUp: true}` at 17:46:33.217Z, then
  `Library probe back-fill pass {candidates: 8, probed: 8, failed: 0, written: 8, ms: 347}` (348 ms after).
  Disk: `index.v1-backup.json` sha256 `b495fdfa…cefcd` = the pristine pre-E1 copy; `index.json`
  `version: 1, rev: 2`, 16 entries all with `kind` (7 audio, 1 video, 2 image, 6 data), `probe` on the
  7 audio + the video, none on images/data.
- **`list_assets` after migration** (`E1_REPORT=after-migration` → `…\vidtsx-e2e\E1\after-migration.json`):
  a duration for every audio file and the video; all within 10 ms of the independent ffprobe (n8.1.2)
  EXCEPT `tone-a.mp3`: index 1.344 s / printed 1.34 vs ffprobe 1.300 (the seed is a 1.3 s sine) → **the
  live bug**.
- **The bug:** the bundled Remotion ffprobe (n7.1) prints `format.duration` = frames × 1152 / rate for a
  LAME mp3 (56 × 1152 / 48000 = 1.344), i.e. WITH the encoder delay (576) + end padding (1536 samples);
  n8.1.2 trims them (1.300). Pre-existing in `probeMedia` (Studio import has the same +25–50 ms on every
  LAME mp3), surfaced by E1's exit.
- **Fix, red first:** `src/main/services/studio/mp3-gapless.test.ts` (6 tests) red at 20:51 (module
  missing), then `src/main/services/studio/mp3-gapless.ts` (96 lines: `parseMp3Gapless` = ffmpeg's
  `mp3_parse_info_tag` fields — Xing/Info frame count + LAME/Lavf/Lavc delay/padding, MPEG-1/2/2.5, ID3v2
  skip; `gaplessDuration` trims ONLY when ffprobe's value equals the untrimmed frame total within 1 ms, so a
  newer ffprobe that already trims is left alone) → 6/6 green. Wired in `media-import.ts:15` (import) + `:114-118`
  (`probeMedia`: no video stream + codec `mp3` → `gaplessDuration(duration, await readMp3Gapless(path))`).
- **Rebuild** (20:53, the recipe above) rc 0 in 124 s → **launch 2** (20:56): NO `LibraryMigrate` line
  (idempotent: rev 2 + every kind → no write), backup unchanged.
- **Assets screen** (launch 1): the root lists folders `e1-seed` (612 KB) + `presets`; `e1-seed` lists all
  10 files — still `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\assets-screen.png` (looked at: 7 audio
  cards with the note icon incl. `.opus` + `.aac`, `.avif` and `.png` draw thumbnails, `.mp4` a video card,
  "10 items · 612 KB").
- **Reconcile pass** (launch 1, Assets `Refresh` button — Home→Assets does NOT rescan): `tone-b.wav`
  overwritten by a 3.4 s file (touched) → probe REFRESHED 2.25 → 3.4 (hash refreshed); `tone-f.flac` →
  `tone-f-moved.flac` (moved) → keeps probe 0.9 + hash; `late-h.wav` (new) → probe 1.15 inline (no
  back-fill needed). Log `Library scan complete {files: 17, entries: 17, tombstones: 0}`.
  Launch 2: `touch tone-a.mp3` + first Assets visit → probe refreshed 1.344 → **1.3** by the fixed probe.
- **Upsert path** (app stopped): `late-upsert.mp3` (1.7 s sine, 44.1 kHz LAME, made by the profile's
  ffmpeg-full) → `upsert.e1.test.ts` (REAL `upsertEntry`, real Remotion ffprobe) 1/1 → entry `kind: audio`,
  `probe {duration: 1.7, codec: mp3}`, hash, size, mtime.
- **`list_assets` final** (`E1_REPORT=final` → `…\vidtsx-e2e\E1\final.json`, 1/1 green): 11 rows, every
  audio file + the video with a duration; diff vs independent ffprobe: index 0 ms for all 11; printed ≤
  3.5 ms (`toFixed(2)` rounding: opus 2.6065→2.61, aac 1.527682→1.53).
- **`.avif`** (open question): the bundled ffprobe reads it (`codec_name=av1|width=640|height=360`).
- **Stopped:** both E1 instances by profile path (Name `electron.exe`); `wt/out` holds the fixed build.
  The watchdog ran for both launches; its 2nd run exited 30 s in on ONE empty WMI answer (C: never below
  54 GB) → kit `watchdog.ps1` now exits only after 3 consecutive misses. Nothing of mine is running.

### Gates + close (builder #5, 2026-10-23 20:59–21:15) — no `src/` change; the closing commit follows `a3f48d8`

- **Resources (20:59):** C: 54.8 GB free, D: 25.7 GB, commit limit 99.7 GB, headroom 51.5 GB → default workers. No
  E1 instance running (Hasan's dev app from the main checkout untouched).
- **Full run #2 = the counted run** (HEAD `a3f48d8`): green except the three E-d2a resolution suites, each failing only
  on package resolution; no LOAD timeout this time (run #1's `pack-package` flake did not recur).
- **E-d2a (a):** read first — none of the three writes relative to `process.cwd()` (tests write only under
  `os.tmpdir()`; `builder-unpack.mjs --check` writes nothing; all package lookups are `__dirname` / script-location
  relative: `builder-libraries.test.ts:46,53`, `shot-bundle.test.ts:90…221`, `shot-bundle-in-place.test.ts:10`). Ran
  them with `--root <wt>` from the main checkout's directory → the SAME 9 failures (expected: the cwd plays no part);
  nothing in the main checkout newer than the run (top two levels + `node_modules/.vite*`, `.vitest`).
- **E-d2a (b):** import graphs via esbuild metafiles (packages external, Vite `?raw` imports as leaves, each suite's
  `vi.mock`'d modules not loaded) vs `git diff --name-only 5d77600..HEAD` (27 files): NONE in any graph. Note:
  without the mock rule, `shot-bundle-in-place.test.ts`'s static graph DOES reach E1 code (`media-import.ts` →
  `mp3-gapless.ts`, `media-kinds.ts`, library store …) — but the suite replaces `./media-import`, `./shot-generator`
  and `./shot-import-land` with `vi.mock` (`shot-bundle-in-place.test.ts:13-31`), so none of it loads there.
  Script: `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\import-graph.cjs`; output `…\E1\import-graph.txt`.
- **Docs:** Status.md entry at the top (2026-10-23 E1, DONE, with the measured numbers, the mp3 side effect on Studio
  imports and the E-d2a gate statement); TESTING.md §18.14 (after §18.13, E-d10).

### Fix round 1 (builder #6, 2026-10-23 21:20–21:45) — commits `eb533e4`, `36a0586`, + the docs commit after them

- **V1-1 / V1-2 (MUST), red first — `eb533e4`:** `src/main/services/studio/media-import.ts:56-71` — `FfprobeStream` gains
  `disposition?.attached_pic`; `isRealVideoStream` (a video stream that is NOT an attached picture); `probeMedia` (:121)
  picks `videoStream` with it, so a cover-art mp3 gets the gapless trim (:124-127) and `codec` / `width` / `height` / `fps`
  from the real streams. Test `src/main/services/studio/media-import-probe.test.ts` (4; `child_process.spawn`,
  `@remotion/renderer`, `../../utils/paths` and `readMp3Gapless` mocked): RED on `184e996` = 3 failed (`expected +0 to be
  1` — trim skipped; `expected 'mjpeg' to be 'mp3'`; a video with cover art got `width: 320`), 1 passed (plain mp3) →
  4/4 green. Consumers of an mp3's `width` / `codec`: Studio kind + lane come from the extension (`classifyMediaKind`),
  `generateThumbnail` returns null for audio; only `AssetCard.tsx:57` ("· W×H"), `shot-asset-refs.ts:70`,
  `shot-build-media.ts:51`, `builder-asset-tools.ts:143` read width/height, all optional → an mp3 now carries none
  (correct). `video-edit.ts` / `export-sync-check.ts` have their own local `probeMedia` (untouched).
- **V1-3 (MUST):** Status.md + TESTING §18.14 + the `media-import.ts` comment now state the measured range −30…−70 ms
  (cover-art 44.1 kHz −30.2, narration −41, catalog sfx −42.4, 48 kHz tone −44, long VBR −50.4, 22.05 kHz −70.2; lower
  sample rates trim more).
- **V1-4 + V1-5 (SHOULD, both done — one shared stamp), red first — `36a0586`:**
  `src/shared/types/asset-library.ts` `LibraryIndexV2Fields.probeStamp?: LibraryProbeStamp { size, mtimeMs, failed?: true }`
  (optional, entry + tombstone). NEW `src/main/services/library/library-probe-state.ts` (pure): `makeProbeStamp`,
  `probeStateOf` → `none | ok | stale | failed | missing` (no stamp on a probe = trusted, so pre-fix E1 probes stay ok),
  `needsProbe` (missing | stale). Wired: `library-backfill.ts` (work list = `needsProbe`; every result patched with a
  stamp, a failure stamped `failed` and a stale probe that no longer reads removed; the in-memory per-process failed set
  is GONE — persisted instead); `library-store.ts` (`kickBackfillIfNeeded` uses `needsProbe`; `upsertEntry` stamps the
  stat it measured, a failure stamped `failed`, an unchanged file whose re-probe failed keeps the old probe + stamp);
  `library-reconcile.ts` (touched / new → stamp when probed; tombstones carry the stamp; resurrect keeps the tombstone's
  stamp with its probe, else stamps a fresh probe; moved keeps it — a rename keeps size + mtime);
  `agent-tools/library-listing.ts` (`ok` → duration; `failed` → `length unknown (unreadable)`; `missing` / `stale` →
  `length unknown (probing)`, never the stale number). The start-up migration already kicks the back-fill on every start
  (`library-migrate.ts:58`, also when nothing migrates), so a stale probe left by an older app is re-probed at the next
  start or the next scan. Test `src/main/services/library/library-probe-stamp.test.ts` (4; a "new process" =
  `vi.resetModules()` + a fresh `library-backfill` import): RED on `eb533e4` = 3 failed (no stamp on a failed upsert;
  `late.wav` listed `(probing)` after a failed back-fill; `hires.flac` rewritten by the FROZEN pre-E1 `upsertEntry`
  listed `2.50 s`), 1 passed (move / unstamped guard) → 4/4 green.
- **Live re-measure (E1 profile, app stopped — no launch, so no E-d4 needed):** made
  `<profile>\assets\e1-seed\cover-art.mp3` with the profile's ffmpeg-full (3.0 s 550 Hz sine, libmp3lame 128k 44.1 kHz,
  + a 320×320 png cover, `-map 0 -map 1 -c copy -id3v2_version 3 -disposition:v attached_pic`); scratch
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\fix1\{tone.mp3,cover.png}`. Independent ffprobe n8.1.2: `stream mp3
  attached_pic=0 | stream png 320 attached_pic=1 | format duration=3.000000`; the bundled Remotion ffprobe n7.1 raw:
  `3.030204` (= the verifier's +30.2 ms). Kit `upsert.e1.test.ts` (`E1_UPSERT=e1-seed/cover-art.mp3`, the REAL
  `upsertEntry` → REAL `probeMedia`) 1/1 → index entry `probe {duration: 3, hasAudio: true, codec: "mp3"}` (no width),
  `probeStamp {size: 49998, mtimeMs: 1792780699801.7952}`; kit `list-assets.e1.test.ts` (`E1_REPORT=fix1-cover-art`, the
  REAL `list_assets` handler) 1/1 → `library:e1-seed/cover-art.mp3 (audio, 3.00 s, generated)`; 11 timed rows, index 0 ms
  off the independent ffprobe for all 11, printed ≤ 3.5 ms (opus 2.61, aac 1.53) —
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\fix1-cover-art.json`. `index.v1-backup.json` sha256 still `b495fdfa…cefcd`.
  The E1 profile's library now holds 19 entries (+ `cover-art.mp3`).
- **Known limit (in Status):** a 15 s ffprobe TIMEOUT is stamped as a failure too — retried only once the file changes.
- **`wt/out` is STALE** (built from `a3f48d8`, before fix round 1): rebuild with the DRIVING "Track E" recipe before any
  live launch.

## Verified (exact commands + outputs)

- 2026-10-23 20:25, from the worktree root:
  `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/shared/media-kinds.test.ts` before
  the module → `Test Files 1 failed (1)` (red: import missing); after → `Tests 6 passed (6)`.
- `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.node.check.json --noEmit | grep -c "error TS"`
  → **10**; `-p tsconfig.web.check.json` → **26** (= baseline, with the control copies in the tree).
- `node …/vitest.mjs run src/shared/media-kinds.test.ts src/main/services/library src/features/asset-library src/main/services/studio/media-import`
  → `Test Files 14 passed (14)`, `Tests 129 passed (129)`.
- Builder #2, 2026-10-23, from the worktree root:
  - `node …/vitest.mjs run src/main/services/library/pre-e1-control.test.ts` BEFORE the modules →
    `Test Files 1 failed (1)`, `Tests no tests` (red: `./library-index-io` cannot be resolved); after →
    5/5 green.
  - `node …/vitest.mjs run src/main/services/library/library-migrate.test.ts src/main/services/library/library-reconcile-v2.test.ts`
    → `Test Files 2 passed (2)`, `Tests 17 passed (17)`.
  - `node …/vitest.mjs run src/main/services/studio/agent-tools src/main/services/library src/shared src/features/asset-library src/main/services/studio/media-import`
    → `Test Files 1 failed | 110 passed (111)`, `Tests 1 failed | 988 passed (989)` — the one failure is
    `src/shared/tsx-engine/builder-libraries.test.ts` "electron-builder.yml unpacks every package…":
    `Error: @remotion/paths (builder-libraries.ts) is not installed` — WORKTREE-ONLY (see Open problems).
  - Types: `tsc -p tsconfig.node.check.json` → **10**, `-p tsconfig.web.check.json` → **26** (= baseline).
  - Resources 2026-10-23 ~20:40 (before the full run): C: 55.2 GB free, D: 26.0 GB free, commit limit
    99.7 GB, headroom 51.8 GB → default workers.
  - FULL RUN #1 (`node …/vitest.mjs run`, default workers, Hasan's dev app running; log
    `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\vitest-full-1.log`): `Test Files 4 failed | 472 passed |
    5 skipped (481)`, `Tests 10 failed | 4051 passed | 35 skipped (4096)`, 56 s. The 4 files:
    `pack-package.test.ts` (1 — `Test timed out in 5000ms` + ENOENT; a known LOAD flake per DRIVING;
    alone → `Tests 14 passed (14)`), and three WORKTREE-ONLY resolution failures (see Open problems):
    `shot-bundle.test.ts` (5), `shot-bundle-in-place.test.ts` (3) — esbuild `Could not resolve
    "chroma-js" / "roughjs" / "@remotion/shapes" / "@react-three/fiber" / "@remotion/google-fonts/…"`,
    and `builder-libraries.test.ts` (1). None is in code E1 touched (`git diff --stat 5d77600 HEAD --
    shot-bundle*.ts pack-package.ts scripts electron-builder.yml src/shared/tsx-engine` is empty).

- Builder #4, 2026-10-23, from the worktree root:
  - `node …/vitest.mjs run src/main/services/studio/mp3-gapless.test.ts` before the module →
    `Test Files 1 failed (1)`, `Tests no tests` (red); after → `Tests 6 passed (6)`.
  - Types after the fix: `tsc -p tsconfig.node.check.json` → **10**; `-p tsconfig.web.check.json` → **26**.
  - `node …/vitest.mjs run src/main/services/studio src/main/services/library src/shared/media-kinds.test.ts src/features/asset-library`
    → the only failures were the 8 tests of `shot-bundle-in-place.test.ts` (3) + `shot-bundle.test.ts` (5),
    the known worktree-only resolution suites (summary line not captured — the full run will count).
  - Live: the exit tables in `…\vidtsx-e2e\E1\after-migration.json` (1 mp3 out by 44 ms → the fix) and
    `…\vidtsx-e2e\E1\final.json` (all 11 within 10 ms; index 0 ms) — numbers under "Live check" above.

- Builder #5, 2026-10-23 (the gates):
  - Resources: `Get-CimInstance Win32_OperatingSystem` → `limitKB=104541096 freeKB=53985372` (headroom 51.5 GB);
    `Get-PSDrive` → C: 54.8 GB, D: 25.7 GB free.
  - Bash from the worktree root:
    `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run > C:/Users/hasan/AppData/Local/vidtsx-e2e/E1/vitest-full-2.log 2>&1`
    → `Test Files  3 failed | 474 passed | 5 skipped (482)`, `Tests  9 failed | 4058 passed | 35 skipped (4102)`,
    `Duration  34.94s`. Failures: `builder-libraries.test.ts` 1 (`Error: @remotion/paths (builder-libraries.ts) is not
    installed`), `shot-bundle.test.ts` 5 (`Could not resolve "roughjs"` / `"@remotion/shapes"` / `"@react-three/fiber"` /
    `"chroma-js"` / `"@remotion/google-fonts/SpaceGrotesk"`), `shot-bundle-in-place.test.ts` 3 (`ok: false`; the one
    message printed: `Could not resolve "chroma-js" (v1.tsx…`) — nothing else.
  - Rule (a), Bash: `cd /d/repos/VidTSX-STUDIO && node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --root
    D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/E/wt <the three files> > …/E1/vitest-rule-a.log` → `Test Files  3
    failed (3)`, `Tests  9 failed | 23 passed (32)`, 9 resolution-error lines; `find` for main-checkout entries newer
    than a stamp → none.
  - Rule (b): `node …\E1\import-graph.cjs <wt> <diff list>` (rc 0) →
    `builder-libraries.test.ts: 2 local modules … NONE` · `shot-bundle.test.ts: 15 … NONE` ·
    `shot-bundle-in-place.test.ts: 23 … (vi.mock'd, not loaded: shot-generator.ts, shot-import-land.ts,
    media-import.ts) … NONE` · `scripts/builder-unpack.mjs: 1 … NONE`.
  - Types: `tsc -p tsconfig.web.check.json --noEmit | grep -c 'error TS'` → **26**; `-p tsconfig.node.check.json` → **10**.

- Builder #6 (fix round 1), 2026-10-23, Bash from the worktree root (logs under `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\`):
  - `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/main/services/studio/media-import-probe.test.ts`
    on `184e996` → `Tests 3 failed | 1 passed (4)` (`fix1-probe-red.log`); after the fix, with `mp3-gapless.test.ts` →
    `Test Files 2 passed (2)`, `Tests 10 passed (10)`.
  - `node …/vitest.mjs run src/main/services/library/library-probe-stamp.test.ts` on `eb533e4` → `Tests 3 failed | 1
    passed (4)` (`fix1-stamp-red.log`); after the fix `node …/vitest.mjs run src/main/services/library
    src/main/services/studio/agent-tools/library-listing.test.ts src/main/services/studio/media-import-probe.test.ts
    src/main/services/studio/mp3-gapless.test.ts src/shared/media-kinds.test.ts src/features/asset-library` →
    `Test Files 21 passed (21)`, `Tests 169 passed (169)` (incl. the E-d5 control `pre-e1-control.test.ts` 5/5).
  - Types: `tsc -p tsconfig.node.check.json --noEmit` → **10** `error TS`; `-p tsconfig.web.check.json` → **26**.
  - Resources 21:37: `limitKB=104541096 freeKB=59126856` (headroom 56.4 GB); C: 52.3 GB, D: 25.8 GB free; 0 E1 instances.
  - Full run: `node …/vitest.mjs run > …\E1\fix1\vitest-full-3.log` → `Test Files 3 failed | 476 passed | 5 skipped
    (484)`, `Tests 9 failed | 4066 passed | 35 skipped (4110)`, `Duration 47.27s`; the 9 = `builder-libraries` 1
    (`@remotion/paths (builder-libraries.ts) is not installed`), `shot-bundle` 5 + `shot-bundle-in-place` 3 (`Could not
    resolve` chroma-js ×2, roughjs, @remotion/shapes, @react-three/fiber, @remotion/google-fonts/SpaceGrotesk) — E-d2a only.
  - Rule (b): `git diff --name-only 5d77600..HEAD > …\E1\fix1\diff-list.txt` (32) → `node …\E1\import-graph.cjs <wt>
    …\E1\fix1\diff-list.txt` rc 0 → all four graphs "touched by the E diff: NONE" (`…\E1\fix1\import-graph.txt`).
  - Live: see "Fix round 1" (`…\E1\fix1\upsert-cover-art.log`, `…\E1\fix1\list-assets-cover-art.log`,
    `…\E1\fix1-cover-art.json`).

## Next step (ONE concrete instruction)

FIX round 2 (orchestrator, 2026-10-23 ~22:45 — the LAST fix round before a stop: a third FAIL stops the run): fix
V2-1 red-first (a unit test with a probe result whose duration is missing / 0 / non-finite that fails on `1312e09`),
then V2-2 and W1–W3 (docs only); re-run the E1 suites + the E-d5 control + the full worktree gate + types; re-measure
a garbage `.flac` (random bytes; your own) through the real `upsertEntry` / back-fill + `list_assets` → "length
unknown (unreadable)"; update Status.md's E1 entry + TESTING §18.14; commit; return DONE.

## Open problems

### Verifier round 2 — FAIL (2026-10-23 ~22:40; V1-1, V1-2, V1-5, E-d5, the exit for every readable file all PASS)

- **V2-1 (MUST): a file ffprobe "reads" without a duration is listed as a successful 0.00 s probe.** Verifier's
  `v2/broken/garbage.flac` (random bytes): ffprobe (bundled n7.1, gyan, n8.1.2) exits rc 0, a flac stream with
  `sample_rate=0`, `channels=0`, `format.duration` `N/A`; ffmpeg cannot decode it (rc 183).
  `src/main/services/studio/media-import.ts:122` `parseFloat(data.format?.duration ?? '0') || 0` makes it
  `{duration: 0, codec: 'flac', hasAudio: true}`; `src/main/services/library/library-probe.ts:28` accepts it and
  stamps it good; `agent-tools/library-listing.ts:25-26` prints `(audio, 0.00 s, imported)` in every listing —
  contradicting Status.md:89-90 / TESTING.md:487 ("a file ffprobe cannot read lists as `length unknown
  (unreadable)`"). Fix: the LIBRARY probe treats an audio / video probe without a finite duration > 0 as a
  failed probe (stamped failed, listed unreadable). Whether Studio's own import (`probeMedia` callers outside
  the library) should change too: decide by reading what a 0-duration import does today and say so; do not
  widen the change beyond what you can test. Related ffprobe quirk (record only, not a fix): random bytes named
  `.aac` give rc 0 and an estimated 0.792 s (gyan prints the same) → lists "0.79 s" — a known limit of
  ffprobe, name it in Status.
- **V2-2 (MUST, docs + the code comment `media-import.ts:123-124`):** the mp3 trim change is stated as
  "−30…−70 ms"; the verifier measured **−27.0 ms** (48 kHz VBR mono) to **−115.0 ms** (11.025 kHz MPEG-2.5 CBR,
  2.3510 → 2.2360); 22.05 kHz −53.8…−70.0, 32 kHz −62.0, 44.1/48 kHz −28.0…−51.2. State it as "about −25 to
  −115 ms; the lower the sample rate, the more" (or the exact measured range from both verifiers).
- **W1 (docs):** "tombstones lose kind/probe/…" applies only to tombstones the OLD scan creates; E1 tombstones
  that already exist keep those fields under every old write.
- **W2 (docs):** the consumer list for the attached-picture change should name face / mask tracking (an
  audio + cover `.mp4` now stops with "Could not read the frame size of the source" instead of reading the
  picture's 600×600), export-spans and sync-probes (fall back to the composition size), proxies — none
  changes for a real video (verifier: 11 real-video files identical pre-E1 vs HEAD).
- **W3 (docs, optional):** rule (b)'s module counts differ by method between agents; say the method.
- Verifier round 2 evidence: `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1-verify2\`, scripts
  `.vidtsx-temp/end-to-end/E1-verify2/` (its seed has the garbage `.flac` / `.aac` — make your own).

### Verifier round 1 — FAIL (2026-10-23; ALL FIXED in fix round 1 — V1-1/V1-2 `eb533e4`, V1-3 docs, V1-4/V1-5 `36a0586`)

- **V1-1 (MUST — the exit): an mp3 with embedded cover art is listed 30 ms too long.**
  `src/main/services/studio/media-import.ts:116` `if (!videoStream && audioStream?.codec_name === 'mp3')`:
  an ID3 cover picture appears in ffprobe as a "video" stream (mjpeg, `disposition.attached_pic: 1`), so
  the gapless trim is skipped and the bundled ffprobe's untrimmed value lands in the index. Verifier's
  `cover-art.mp3` (3.000 s; ffprobe 2025-11 gyan, n8.1.2 and a decoded sample count all 3.0000): index
  3.030204, `list_assets` "3.03 s" (+30.2 ms > 10 ms). `readMp3Gapless` reads that file fine (frames 116,
  startPad 576, endPad 756) and `gaplessDuration(3.030204, info)` returns 3.000 — only the guard stops it.
  A live Studio import of the same file also gives 3.030204. `mp3-gapless.test.ts` has no cover-art case.
- **V1-2 (MUST — same root cause): the cover picture's fields are recorded as the audio file's.**
  `media-import.ts:122,126` take `width` / `codec` from the attached picture: the audio file is stored as
  `codec: 'mjpeg', width: 320`, and E1 now persists that into the library index. Treat `attached_pic`
  streams as not-video everywhere `probeMedia` picks the video stream (pre-existing in `probeMedia`, but
  E1 makes it durable) — check what consumers read `hasVideo` / `width` for an imported mp3 so the fix does
  not change a Studio import's lane / kind.
- **V1-3 (MUST — the record):** Status.md E1 entry and TESTING §18.14 say the mp3 change is "25–50 ms";
  measured live it is −41 ms (narration), −70.2 ms (22.05 kHz `.MP3`), −42.4 ms (catalog sfx), −50.4 ms
  (long VBR) — state the measured range (lower sample rates trim more).
- **V1-4 (SHOULD):** `list_assets` prints `length unknown (probing)` for files that can never be probed
  (a garbage `.mp3`, an empty `.wav` — the back-fill fails them on every start). Do not promise "probing"
  for a failed probe: e.g. stamp a failed probe with the size + mtime it was tried at, skip it in the
  back-fill until those change, and print `length unknown (unreadable)`; or the smallest change that
  stops the false promise. Unit-test it.
- **V1-5 (SHOULD if ≤ ~30 lines + a test, else record in Status as a known limit):** mixed old/new app on
  one library — an OLD `upsertEntry` on a file rewritten in place refreshes `size` / `mtimeMs` but keeps
  E1's `probe`, so the new code lists a stale duration forever (verifier: `hires.flac` rewritten to
  4.0 s, listed 2.5 s even after Refresh). A probe stamped with the size + mtime it measured would let
  the reader / back-fill notice and re-probe (shares the stamp with V1-4).
- Not findings (verifier confirmed): migration + byte-identical backup, idempotency, E-d5 control (old
  reader 28/28 deep-equal; old writes keep every pre-E1 field), old-write → re-migrate keeps the first
  backup, no-index / unreadable-index starts destroy nothing, reconcile refresh / keep / probe / tombstone
  resurrect, upsert 0 ms, negatives N1–N3 fail on revert, gates (474 files / 4,058 tests + the 3 E-d2a
  suites, rule (b) independent graphs; types 26/10), the click-through stills. Verifier's evidence:
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1-verify\`, harness `.vidtsx-temp/end-to-end/E1-verify/`.

### Earlier (builders)

- **RESOLVED by E-d2a (orchestrator, 20:50):** the worktree cannot resolve packages for three suites
  (`builder-libraries`, `shot-bundle`, `shot-bundle-in-place`); the gate rule was applied as written (see "Gates +
  close") and stated in STATUS. Hasan: allowing a `node_modules` junction in the worktree would make the gate whole.
- **Live-only facts:** (1) `.avif` — ANSWERED: the bundled ffprobe reads it (av1, 640×360) and the
  Assets screen draws its thumbnail; (3) back-fill on the seeded library — ANSWERED: 8 files in 347 ms;
  (2) still unmeasured: the first Assets scan of a BIG drop with ≤ 20 inline probes (the seeded drop of 3
  changed files was instant) — say so in STATUS, not a gate.
- **Behaviour change outside the library (from the mp3 fix):** `probeMedia` is also Studio's import
  probe, so a LAME/Lavf mp3 imported into a Studio project now gets its gapless length (−25…−50 ms vs
  before). Already-saved projects keep their stored probe. Mention in STATUS.
- `list_assets` output prints `length unknown (probing)` for a media entry without a probe; durations use
  `toFixed(2)` (≤ 5 ms rounding, inside the exit's 10 ms).
- A library-root override changed at runtime is not migrated until the next start (its index still reads
  fine: kinds derived on read; the first E1 write backs it up and writes rev 2; scans kick the back-fill).

## Do-not-redo

- The design note above (code already read: the §1.6 files, all callers listed in it).
- The kind table and its wiring; the type additions; the frozen control copies (re-create them only if
  5d77600's files are found to differ — they were taken by `git show`).
- ALL of design §3–§10 (built + unit-tested at `6005a7e`); the E-d5 control test and its findings.
- Live-check prep (a)–(d): the E1 profile copy, the seed media, the pre-E1 index (re-seeding would need
  the index deleted first — `seed-index.e1.test.ts` refuses an existing one; the pristine copy is
  `…\vidtsx-e2e\E1\index.pre-e1.seeded.json`), the kit files, the worktree build.
- The whole live click-through (builder #4): migration on disk, the Assets still, the reconcile pass, the
  upsert path, both `list_assets` reports, the mp3 fix + its rebuild/relaunch. The E1 profile's library is
  now POST-migration (17 + 1 files) — do not expect the pre-E1 state there any more.
- The gates (builder #5): full run #2, E-d2a (a) + (b), types; the Status.md entry and TESTING §18.14.
- Fix round 1 (builder #6): V1-1…V1-5 code + red-first tests, the live cover-art re-measure, full run #3, rule (b) on the
  new diff, types, the Status / TESTING updates. `cover-art.mp3` is already in the E1 profile's library.

## For Hasan (real-video list candidates)

(none)

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-23 · builder #1 · ~40 · design note; kind table (red→green) + wiring; v2 types; frozen pre-E1
  control copies; checkpoint commit. Handed off at the tool-call budget.
- 2026-10-23 · builder #2 · ~40 · E-d5 control test red→green + findings; index IO / probe / reconcile /
  store / back-fill / migration / startup hook / list_assets formatter + 21 new unit tests (`6005a7e`);
  types 26/10; full run #1. Handed off at the tool-call budget (live check not started).
- 2026-10-23 · builder #3 · ~42 · live-check prep: resources + E-d4, E1 profile copy (no settings.db),
  real seed media (7 audio exts + png + avif + mp4), the pre-E1 index written by the frozen pre-E1 scan,
  scratch vitest config (own cacheDir), launcher / watchdog / CDP / list_assets / upsert drivers, the
  worktree build (113 s, rc 0). No `src/` change; the app was NOT launched (no processes left running).
  Handed off at the tool-call budget.
- 2026-10-23 · builder #4 · ~42 · live click-through (2 launches from `wt/out`, CDP 9261): migration +
  backup + back-fill on disk, Assets still, reconcile (touched/moved/new), upsert, `list_assets` exit
  tables; live bug (mp3 +44 ms) fixed red-first (`mp3-gapless.ts`), rebuilt, re-verified; DRIVING launch
  recipe + a Learned line; kit `restore.ps1` + watchdog 3-miss fix. Handed off at the tool-call budget
  (gates + Status + TESTING left; nothing running).
- 2026-10-23 · builder #5 · ~30 · the gates: full vitest run #2 (counted; only the 3 E-d2a resolution suites red),
  E-d2a (a) tried (same 9 failures, nothing written in the main checkout) + (b) import-graph check (no E file in any
  graph, `vi.mock` honoured), types 26/10; Status.md entry + TESTING §18.14; closing commit. DONE; nothing running.
- 2026-10-23 · builder #6 (fix round 1) · ~40 · V1-1/V1-2 attached pictures not video (red→green, `eb533e4`); V1-4/V1-5
  probe stamp (red→green, `36a0586`); V1-3 measured range in docs; live cover-art re-measure via the real `upsertEntry` +
  `list_assets` (3.000 vs 3.000, app not launched); full run #3 + rule (b) + types 26/10; Status / TESTING. DONE; nothing
  running.

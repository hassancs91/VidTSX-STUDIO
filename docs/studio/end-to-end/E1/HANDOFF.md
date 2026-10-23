# E1 — Index v2: `kind`, `probe` on upsert, `tags`, `audio`, `usedIn`; one kind table; migration
status: NEW

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

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Read the index code §1.6 names (`src/shared/types/asset-library.ts`, `src/main/services/library/library-store.ts`,
`library-reconcile.ts`, `media-import.ts`, `src/features/asset-library/services/file-type.ts`,
`src/main/services/studio/agent-tools/project-tools.ts`) and write a short design note under "Done" here —
the new fields, where the one kind table lives (`src/shared/`), how `probe` is filled on upsert and kept
across reconcile, the E-d5 downgrade mechanism, the migration + backup — then build red-first: kind table →
index types + migration with the old-reader control test → probe on upsert / reconcile → durations in
`list_assets`.

## Open problems

(none)

## Do-not-redo

(none)

## For Hasan (real-video list candidates)

(none)

## Agents so far (date · approx tool calls · what they covered)

(none)

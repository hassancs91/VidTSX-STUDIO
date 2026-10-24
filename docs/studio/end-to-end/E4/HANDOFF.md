# E4 — The importer over the reference `sfx/` and `music/` catalogs
status: NEW

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

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

**Builder #1:** read this file, E2's HANDOFF "Done" (the field semantics E2 settled), then
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

(none yet)

## Do-not-redo

(nothing yet)

## For Hasan (real-video list candidates)

- Importing the catalogs into HIS real library (`%APPDATA%\VidTSX Studio\assets`) — the one run of the importer with
  his library as the explicit target, after he has read the dry run.

## Agents so far (date · approx tool calls · what they covered)

(none yet)

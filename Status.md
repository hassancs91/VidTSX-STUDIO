# STATUS.md — Current progress

> Claude: update this file after completing each phase.

## Current phase: 6 — Template store + media library
## Status: NOT STARTED

---

## 2026-10-24 — END-TO-END E2: generation writes loudness-normalized files with category / tags; `usedIn` written on every landing — DONE (fix round 1 after verifier round 1 FAIL; the E2 verifier round 2 is next)

- **What:** part E2 of `docs/studio/END_TO_END_PLAN.md` (track E, session 5, records in session 6; worktree branch
  `end-to-end-p0-e`, E-d1). Row: "Generation writes loudness-normalized files with category/tags; `usedIn` written on
  every landing". Exit: a generated SFX appears with duration, tags, −20 LUFS, and the project id after insert.
  **Result: met** on an isolated profile, with a DEV-ONLY stand-in at the engine boundary (no ElevenLabs call, E-d6) and
  everything after it real: the REAL `generate_sfx` handler filed `generated/sfx-a-short-airy-whoosh-2.mp3` with
  `probe.duration 2` (independent ffprobe n8.1.2: 2.000000 s, 0 ms off), `tags ["whoosh","air"]`, category `motion`,
  −20.27 LUFS recorded / **−20.2 LUFS on an independent `ebur128`**, true peak −10.8 dBTP, and `usedIn ["e2-exit"]` — still
  one entry after the REAL `insert_asset`; the REAL `list_assets(scope:'library')` row prints all of it.
- **The code** (line numbers re-read at HEAD after fix round 1 — `src/` last changed in `f990487`):
  - `60b5537` — the normalizer. `src/main/services/library/audio-loudness-rule.ts` (pure, 109 lines): `LOUDNESS_TARGET_LUFS =
    -20` (:7), `LOUDNESS_CEILING_DBFS = -1.5` (:9), `LOUDNESS_GATED_BELOW_LUFS = -50` (:11), `LOUDNESS_MIN_GAIN_DB = 0.1` (:13),
    `parseLoudnormStats` (:54; `input_i` / `input_tp`, `-inf` → `-Infinity`), `planLoudnessGain` (:69; the rule below).
    `src/main/services/library/audio-normalize.ts` (281 lines since fix round 1): `measureLoudness` (:118; ONE
    `loudnorm=I=-20:TP=-1.5:LRA=11:print_format=json` analysis pass, `-vn -f null -`); the gain is ONE re-encode `-af
    volume=<g>dB` of the ORIGINAL into `<abs>.norm-tmp<ext>`, then `fs.rename` over the original — same extension; codec by
    extension: `.mp3` libmp3lame `NORMALIZE_MP3_BITRATE = '192k'` (:31), `.wav` pcm_s16le, `.m4a` / `.aac` aac 192k (:39-40),
    `.ogg` / `.opus` libopus 128k, anything else "unsupported container" (`60b5537`'s `applyGain`; since `f990487`
    `encodeWithGain` :130 inside the ceiling loop, below); `normalizeAudioFile` (:237) → `AudioNormalizeResult { normalized,
    loudnessLufs?, peakDbfs?, gainDb, clamped, gated, skipped, error?, before?, correctivePasses?, overCeiling? }`;
    `NORMALIZE_TIMEOUT_MS` 120 s per pass (:29). `src/shared/types/asset-library.ts:27-47` `LibraryAudioMeta` gains `peakKind?:
    'true' | 'sample'` (:39), `gainDb?` (:45), `normalizeError?` (:47) — optional only (E-d5).
  - `841e311` — the call site, the args, the stand-in. `src/main/services/library/generate-audio-asset.ts` (181 lines):
    `GenerateAudioAssetRequest` gains `category?` / `tags?` (:53, :55); `normalizeAudioFile(absPath, { signal })` (:137) runs
    after `fs.writeFile` and BEFORE `upsertEntry` (:154), so the index's probe + hash describe the levelled file; the `audio`
    meta = `{ category?, loudnessLufs?, peakDbfs?, peakKind: 'true' (:144), source: <provider id>, model, gainDb,
    normalizeError? }`; `normalizeCategory` (:104, trim + lower-case); `GeneratedAudioAsset` gains `normalized` (a REQUIRED
    boolean), `loudnessLufs?`, `peakDbfs?`, `normalizeError?`, `category?`, `tags?` (and `loudnessGated?` :80 since fix round
    1); `durationSeconds` = the upsert's `probe.duration` (:161) when finite and > 0, else the engine's figure. `library-filing.ts:60-74` `TAGS_MAX = 20` +
    `normalizeTags` (trim, lower-case, drop empties, dedupe, cap; `undefined` when nothing is left). `agent-tools/
    audio-tools.ts`: `generate_sfx` (:119) / `generate_music` (:150) gain `category` (1–40 chars; hints
    `CATEGORY_HINT_SFX` :55 motion / tension / emphasis / snap / foley / reward / texture / impact, `CATEGORY_HINT_MUSIC` :57
    bed / sting / intro / outro / loop / transition) and `tags` (≤ 20); the answer prints `Loudness −20.3 LUFS, peak −10.8
    dBTP. Filed with category: motion · tags: whoosh, air.` (U+2212, one decimal). The stand-in: below.
  - `68bbe44` — `usedIn`. `src/main/services/library/library-used-in.ts` (93 lines): `addUsedIn` (:22, pure),
    `markLibraryUsedIn(root, relPaths, projectId)` (:32) → `updateIndex` on main's per-root serialize chain (the file keeps
    `version: 1, rev: 2`), existing entries only, deduplicated, no write when nothing changed, never throws (a failed patch
    is warned, the import stands); `markLibraryUsedInForPaths(projectId, absPaths)` (:75) keeps only paths under
    `getLibraryRoot()` via `libraryRelPathOf` (`library-paths.ts:69`; null for the root itself, another drive, a parent, or
    a sibling-prefix `<root>-other\…`). The three seams: below.
  - `3084668` — the listing row: `src/main/services/library/format-level.ts` `signed()` (the one U+2212 LUFS / dB form, now
    shared with `audio-tools.ts`); `agent-tools/library-listing.ts` `formatLibraryRow` (:22) + `formatMetaSuffix` (:43).
  - Docs: `12cf9df` (HANDOFF prepared), `70bb70f` `59b8e93` `1e36cbc` `bbfd17e` `4eb6bf5` (builders #1–#5) + this entry's
    commit. Kit (gitignored): `.vidtsx-temp/end-to-end/E2/`.
- **The loudness rule (E-d7, Hasan's Q2):** −20 LUFS integrated under a −1.5 dBTP ceiling, ported from the editor repo's
  `tools/gen_sfx.py` `normalize_clip()`: measure I + peak; peak unmeasurable → leave; I not finite or I < −50 (EBU R128
  gated the clip — e.g. a 0.3 s transient) → peak-normalize to the ceiling (`gain = ceiling − peak`); else `gain = target −
  I`, and if `peak + gain > ceiling` → `gain = ceiling − peak` (clamped — the recorded LUFS is then honestly above −20);
  |gain| < 0.1 dB → skip; ONE re-encode with `volume`; re-measure and record what the file now is. **Toolset: the bundled
  (stripped) Remotion ffmpeg n7.1 only** — `loudnorm` (its analysis pass prints `input_i` / `input_tp` as JSON) +
  `volume`; it has NO `ebur128`, `astats`, `volumedetect`, `alimiter` or `dynaudnorm`, and the full ffmpeg (an optional
  download) is not assumed. **`peakKind: 'true'`:** E2's `audio.peakDbfs` is a TRUE peak in dBTP (`loudnorm`'s `input_tp`,
  4× oversampled); the reference catalogs' `peak_dbfs` is a sample peak, which E4's import writes with `peakKind: 'sample'`;
  true ≥ sample, so a −1.5 dBTP ceiling is at least as safe. **Bitrate:** an mp3 stays an mp3, re-encoded with libmp3lame
  **192k** — one step above ElevenLabs' `mp3_44100_128`, so the second lossy generation adds little (sample rate / channels
  kept; the live files read `bit_rate 198284`). **The ceiling holds on the ENCODED file (E-d11, fix round 1 `f990487`):**
  until fix round 1 the ceiling was applied only to the pre-encode true peak and the lossy re-encode could push the file
  OVER it (verifier round 1: a 0.25 s burst, gated, +7.2 dB → −1.27 dBTP recorded, −1.268 dBFS sample by `ffmpeg-full`; this
  entry used to call it "a few tenths of a dB off it", which hid that it can go over). Now the product re-measures the
  encoded temp (its own `loudnorm` pass) and, while it records over −1.5, re-encodes from the ORIGINAL (never from an encoded
  temp — one lossy generation) with `correctiveGain` = applied − overshoot − 0.1 dB (`LOUDNESS_CEILING_MARGIN_DB`), at most
  two corrective passes (`LOUDNESS_MAX_CORRECTIVE_PASSES`). Live re-check: the verifier's burst → 1 corrective pass, −1.88
  recorded, **−1.9 dBTP / −1.871 dBFS** on the meter; the clamped tick train 0 passes, −1.8 dBTP; the main whoosh 0 passes
  (numbers under "Verifier round 1 → fix round 1" below).
- **The un-normalized policy:** the normalizer never throws and never loses bytes. A failed measure or apply (missing
  binary, non-zero exit, the 120 s timeout, bad JSON, an unsupported container) removes the temp output and keeps the
  original; the entry records `audio.normalizeError`; the tool answers "NOT loudness-normalized (<reason>) — the raw file is
  kept." (`describeLevel`, `audio-tools.ts:61-70`, :63; since fix round 1 the reason is ONE line —
  `summarizeFfmpegError`, `audio-normalize.ts:155`); the `list_assets` row prints ` · −12.3 LUFS (not normalized)` with a
  measured value or ` · not normalized` without one. A caller abort DURING the normalize pass is recorded the same way
  (`normalizeError: 'Cancelled'`, bytes kept) and not retried — re-normalizing an existing entry is not in E2.
- **The DEV-ONLY stand-in (E-d6, named here as required):** `src/audio-engine/generation/providers/
  standin-audio-provider.ts` `StandinAudioProvider(filePath)` — `id 'standin'` (:18), `generate()` returns the file's bytes
  as `audio/mpeg` with model `standin` (:27), `pricePerSecondUsd` → 0 (:30), so the engine records **`costUsd 0`** (the
  answer prints `$0.000`). Registered by `src/main/services/audio-generation-standin.ts` `registerDevStandinProvider()` ONLY
  when **`!app.isPackaged`** (:23) AND **`VIDTSX_AUDIO_STANDIN_FILE`** (:18) names an existing file (else false; a missing
  file is warned), called at the END of `initAudioGenerationEngine` (`audio-generation-init.ts:66`) — **after the BYOK
  loop**, so a real key registered first stays the active provider (`registerInstance` keeps the first `activeId`).
  **Inert in a packaged build.** The file must be an **mp3** (the engine's `ext` is hard-coded `.mp3`,
  `audio-generation-engine.ts:155`, left as is). The live app initialises the engine lazily (first generation, an Agents
  tool, or a key save), so the stand-in's warn line appears on first use, not at launch.
- **Builder #2's notes, answered:** the tool's progress line still reads "Generating at ElevenLabs…" when the stand-in
  answers (`audio-tools.ts:86`; cosmetic, the answer itself names no provider) — left as is; `GeneratedAudioAsset.normalized`
  is a REQUIRED boolean (tsc: the agents' `generate-audio.ts` compiles unchanged); the agents' `generate_audio` tool keeps
  its args and gets the normalization for free (its answer prints no LUFS; its test mock gained `normalized: true`); a
  Cancelled normalize is recorded, not retried (above); the stand-in is mp3 only (above).
- **`usedIn` — the three landings of a `library:` ref (T6):** (1) `importLibraryFile` (`agent-tools/library-import.ts:51`,
  `:62`) marks with `project.id` before BOTH returns (an existing project asset and a fresh import) — reached by
  `insert_asset`'s `resolveAssetRef`, by `generate_sfx` / `generate_music`'s own import and by every tool taking a
  `library:` ref; (2) `resolveShotAssetRefs` (`src/main/services/studio/shot-asset-refs.ts:166`) marks every library ref
  it resolved, ONCE after its loop AND after `buildPromptAssets` (:164) has validated the refs (`generate_tsx_shot`
  assetRefs; a ref that throws marks nothing — true since fix round 1 `f990487`: before it the mark ran BEFORE the
  validation, so an audio ref's "shots are visual-only" throw left the project in `usedIn` (verifier round 1, F2); pinned by
  `shot-asset-refs.test.ts` "a library AUDIO ref beside a valid image ref throws … and marks NOTHING"); (3) the pool import
  `handleStudioMediaImport` (`src/main/ipc/studio-handlers.ts:299`) calls `importMediaFilesMarkingLibrary`
  (`src/main/services/studio/pool-import.ts:8`, 15 lines, since `f990487`) = `importMediaFiles` → `markLibraryUsedInForPaths`
  on the imported paths that lie under the library root → the import result; **pinned by `pool-import.test.ts` (2)**, which
  fails with the mark commented out (red recorded, `…\E2\n3-red.log`; verifier round 1's mutation M3 had left 47 files /
  352 tests green). The handler file is 672 lines — over the ~300 rule since before E2, not split here.
  `shot-build-media.ts` / `shot-bundle-media.ts` import a shot's own files — a library file cannot reach them; not wired.
  A `usedIn` write is an index patch, never a `project.json` write. A file under the root that the index has never seen is
  logged and left to the next scan — the scan does not know the project id, so that one landing is not recorded.
- **The listing row (`list_assets(scope:'library')`):** after the description, only when present, ` · category: motion`
  · ` · tags: whoosh, air` · ` · −20.3 LUFS` (one decimal; `(not normalized)` as above) · ` · used in: e2-exit`. An entry
  without the fields prints exactly E1's row (pinned). No `kind` / `query` filtering — E3's (the handler ignores an extra
  `kind` arg today).
- **The live exit (2026-10-24, builder #5; the worktree at `3084668`, its own build `wt/out` rebuilt — `✓ built in
  2m 30s`):** profile `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\E2\profile` (copied from `source` WITHOUT
  `settings.db*`; library root confirmed live: `<profile>\assets`, `isOverride: false`), Studio root
  `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E2\root`, project `e2-exit` (`createProject('e2-exit', 1920, 1080, 30)`).
  The REAL handlers ran in stopped-app vitest drivers on that live index (`exit-main.e2.test.ts`, `exit-ceiling.e2.test.ts`
  — two invocations, the engine singleton keeps the first stand-in); mocked only `electron` (userData = the profile,
  `isPackaged: false`), `settings-db` (the Studio root; no credentials), `utils/paths` (`getRemotionBinariesDir: () => null`
  → the bundled ffmpeg) and `ai-usage`. Driver stdout: `[AudioGenerationStandin] DEV stand-in audio provider "standin"
  registered (VIDTSX_AUDIO_STANDIN_FILE)`, providers `["standin"]`, active `standin`. **Independent meter:** the SOURCE
  profile's `ffmpeg-full` n8.1.2 — `ebur128=peak=true` (integrated I + true peak), `astats` (sample peak), ffprobe n8
  (duration, LAME delay / padding trimmed).
  - **Main** — stand-in `standin.mp3` (band-limited pink noise, 2.000 s, 44.1 kHz mono, 128k; in: −9.3 LUFS, true peak
    +0.6 dBTP, sample peak +0.54 dBFS): `generate_sfx({ prompt: 'a short airy whoosh', durationSeconds: 2, category:
    'motion', tags: ['whoosh','air'] })` 466 ms → `generated/sfx-a-short-airy-whoosh-2.mp3` (49,571 B, `bit_rate 198284`).
    Entry: `kind audio`, `origin generated`, `tags ["whoosh","air"]`, `audio { category motion, loudnessLufs −20.27,
    peakDbfs −10.79, peakKind true, source standin, model standin, gainDb −10.71 }`, `probe { duration 2, hasAudio true,
    codec mp3 }`. Meter: **I −20.2 LUFS** (−0.2 LU off target; recorded − meter −0.07 LU), **true peak −10.8 dBTP**
    (recorded − meter +0.01 dB), sample peak −10.79 dBFS, ffprobe 2.000000 s (**0 ms** off `probe.duration`). Gain −10.71
    = −20 − I_in (expected −10.7; not clamped). Answer: `Sound effect ready: project asset id "e2ec8044-…"
    (library:generated/sfx-a-short-airy-whoosh-2.mp3, 2.00 s, $0.000). Loudness −20.3 LUFS, peak −10.8 dBTP. Filed with
    category: motion · tags: whoosh, air. …`. **`usedIn`:** `["e2-exit"]` already after the generate tool's OWN import
    (`importLibraryFile` marks); then the REAL `insert_asset({ assetId: 'library:generated/sfx-a-short-airy-whoosh-2.mp3',
    lane: 'audio', at: 0 })` → `Insert proposed (id "prop_mvm2whpg_zumvj2"): Insert "sfx-a-short-airy-whoosh-2.mp3" as
    audio at 0:00.0 · 2.0 s` (a review card; its `resolveAssetRef` re-marks) → still exactly `["e2-exit"]` (deduplicated).
    The REAL `list_assets({ scope: 'library' })` row: `- library:generated/sfx-a-short-airy-whoosh-2.mp3 (audio, 2.00 s,
    generated) — "a short airy whoosh" · category: motion · tags: whoosh, air · −20.3 LUFS · used in: e2-exit`.
  - **Ceiling-binding** — `standin-quiet.mp3` (a uniform train of 1 ms 2 kHz bursts every 100 ms at −6 dBFS; in: −27.4
    LUFS, −5.7 dBTP, sample −5.73 dBFS): `generate_sfx({ prompt: 'a quiet tick train', durationSeconds: 2, category:
    'snap', tags: ['tick','quiet'] })` 555 ms → `generated/sfx-a-quiet-tick-train.mp3`. The wanted +7.4 dB would put the
    peak at +1.7 → **clamped, `gainDb` +4.18** (expected −1.5 − (−5.7) = +4.2); recorded −23.44 LUFS / −1.79 dBTP; meter
    **I −23.4 LUFS** (honestly short of −20; recorded − meter −0.04 LU), **true peak −1.8 dBTP** (0.3 dB under the ceiling
    after the mp3 re-encode — this encode landed under; since fix round 1 an encode that lands OVER is corrected, above;
    recorded − meter +0.01 dB), sample peak −1.83 dBFS; ffprobe 2.000000 (0 ms);
    `usedIn ["e2-exit"]`. Answer `… Loudness −23.4 LUFS, peak −1.8 dBTP. Filed with category: snap · tags: tick, quiet.`
  - **Music path** — same driver, same stand-in: `generate_music({ prompt: 'a soft bed', durationSeconds: 3 })` (3 = the
    engine's music minimum) 232 ms → `generated/music-a-soft-bed.mp3`, the same normalize (`gainDb` 4.18, −23.44 LUFS,
    −1.79 dBTP; meter −23.4 / −1.8), no category given → none written, `probe.duration 2` (the real length wins over the
    requested 3; ffprobe 2.000000, 0 ms), `usedIn ["e2-exit"]`. Answer `Music ready: project asset id "266dace6-…" (…, 2.00
    s, $0.000). Loudness −23.4 LUFS, peak −1.8 dBTP.` — the SAME project asset id as the tick train: the two files are
    byte-identical (one stand-in through the same gain; index hash `836dabd6…` on both), so the import's
    `matchExistingAsset(known, absPath, hash)` (`library-import.ts:46`, pre-E2) returned the earlier asset; the music
    entry's `usedIn` was still marked. A stand-in artefact, not a finding.
  - Index after: `version 1, rev 2`, 4 entries — the 4th, `generated/sfx-a-short-airy-whoosh.mp3`, is run 1 of the main
    driver (same product values; that run then failed in the DRIVER's meter helper — `execFileSync` read stdout only, fixed
    with `spawnSync`; the file is kept).
  - **CDP click-through** (port 9262, the worktree build, no Vite server; the launcher exported `VIDTSX_AUDIO_STANDIN_FILE`;
    `app-1.log`: `Main-process init complete in 398ms`, no stand-in line — lazy init, nothing generated live, E-d9): FIRST
    call `studioRootSet` (BEFORE: `C:\Users\hasan\Videos\VidTSX Studio`, the default — Home listed Hasan's projects for
    ~5 s, nothing opened or written) → AFTER: the E2 root; `libraryRootGet` → `<profile>\assets`, `isOverride: false`.
    Assets → `Refresh` → root `generated` (194 KB) + `presets` → dblclick `generated` → tiles `music-a-soft-bed.mp3`,
    `sfx-a-quiet-tick-train.mp3`, `sfx-a-short-airy-whoosh-2.mp3`, `sfx-a-short-airy-whoosh.mp3` (each with its
    description) → the whoosh selected → details Type `audio (mp3)`, Size 48.4 KB, Origin generated, Path
    `generated/sfx-a-short-airy-whoosh-2.mp3`; footer `4 items · 194 KB`. Still
    `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\assets-generated.png` (73,513 B). Stopped by port / profile +
    `Name='electron.exe'` (4 → 0).
  - **The Assets screen prints no duration anywhere** (a tile = name + description, `AssetTile.tsx:139-140`; the details panel
    = Type / Size / Origin / Added / Path, `AssetDetailsPanel.tsx:86-90` — pre-E2 UI, unchanged). The exit's "appears with
    duration" is met by the index (`probe.duration 2`) and the `list_assets` row (`2.00 s`) on the same live index, as E1
    recorded it. The tag chips are E3's row; a duration / LUFS line in the details panel is Hasan's call.
- **Gates (2026-10-24, builder #5, app stopped, HEAD `3084668` + docs):** guard before the launch C: 46.72 GB / D: 23.81 GB
  free, headroom 36.69 GB → default workers; watchdog never fired. Full vitest from the worktree (`node
  D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run`): **485 files passed, 3 failed, 5 skipped (493); 4,138 tests
  passed, 9 failed, 35 skipped (4,182); 51.80 s**, no timeouts (`…\E2\vitest-full-1.log`). The 3 files / 9 tests are
  exactly E-d2a's suites, each failing ONLY on package resolution — `builder-libraries.test.ts` 1 (`@remotion/paths … is not
  installed`), `shot-bundle-in-place.test.ts` 3 (`Could not resolve "chroma-js"`), `shot-bundle.test.ts` 5 (`roughjs` /
  `@remotion/shapes` / `@react-three/fiber` / `chroma-js`). Rule (b): none of the 68 files of `git diff --name-only
  5d77600..HEAD` is in their import graphs — esbuild metafile per suite, packages external, `?raw` as leaves, `vi.mock`'d
  modules not followed (`…\E1\import-graph.cjs`): builder-libraries 2 local modules, shot-bundle 15, shot-bundle-in-place 23
  (`shot-generator.ts`, `shot-import-land.ts`, `media-import.ts` vi.mock'd, not loaded), `scripts/builder-unpack.mjs` 1 —
  NONE touched (`…\E2\import-graph.txt`). Types: `tsc -p tsconfig.web.check.json` → 26, `-p tsconfig.node.check.json` → 10
  = baseline, none in E2's files (`tsc-web-5.log`, `tsc-node-5.log`; also 26 / 10 at each of the four code commits). Every
  step red first: (a) 18 tests, (b) 9 files / 67 (incl. the E-d5 control), (c) 4 files / 29 (neighbours 33 / 251), (d) 3
  files / 16 (neighbours 34 / 257) — logs `…\E2\a-red.log` … `d-green-2.log`. The records (builder #6, 2026-10-28) are
  docs only (`git diff --stat 3084668..HEAD -- src/` empty) — nothing re-run.
- **Verifier round 1 FAIL → fix round 1 (2026-10-28).** Verifier round 1 FAILED on **F1** (the −1.5 ceiling over after the mp3
  re-encode: a 0.25 s burst, gated, −1.3 dBTP / −1.268 dBFS sample by `ffmpeg-full`) and **F2** (the shot-ref `usedIn` mark
  before validation) → fix round 1 **`f990487`** (code + tests, builder #7) + docs `d350e6c`, `fd964ad` (the live re-check) and
  this records commit (builder #8). In `f990487`: E-d11 in `audio-normalize.ts` — `encodeWithGain` (:130) encodes the ORIGINAL
  into a temp, `measureEncoded` (:176) re-measures it, `encodeUnderCeiling` (:193) re-encodes from the ORIGINAL with
  `correctiveGain` (`audio-loudness-rule.ts:107`, applied − overshoot − 0.1 dB) while `isOverCeiling` (:102, the recorded
  two-decimal peak) holds, at most 2 passes; `choosePass` (:227) keeps the last pass that holds, else the lowest peak;
  `gainDb` = the gain ACTUALLY applied; **`correctivePasses` / `overCeiling` are result fields only, not indexed** (the
  recorded `peakDbfs` already shows any overshoot; `overCeiling` + a `log.warn` only if every pass stays over — not seen).
  **One change to the ported `gen_sfx.py` rule:** the 0.1 dB skip no longer keeps a file whose peak is already over the
  ceiling (`audio-loudness-rule.ts:92`; `plan(−20.05, −1.45)` → −0.05 applied) — within E-d11. F2: `buildPromptAssets` first
  (`shot-asset-refs.ts:164`), then the mark (:166). N3: `pool-import.ts` + `pool-import.test.ts` (above). N2:
  `summarizeFfmpegError` (`audio-normalize.ts:155`) — the FIRST stderr line that reads as an error (`ERROR_LINE` :148: error
  / invalid / no decoder / not found / unsupported / failed / could not / cannot / unable / denied / no such; the `[ctx @
  0x…]` prefix stripped), else the last line; the absolute path shortened to the file name; prefixed `ffmpeg: `; ≤ 200
  chars (`NORMALIZE_ERROR_MAX_CHARS` :33); the full stderr stays in the log — the verifier's mp2-in-`.mp3` now reads
  `measure failed: ffmpeg: Decoding requested, but no decoder found for: mp2`. N5: `GeneratedAudioAsset.loudnessGated?`
  (`generate-audio-asset.ts:80`, set at :176) → `describeLevel` (`audio-tools.ts:68`) answers ` Peak-normalized to −1.9
  dBTP — too short or too quiet for a loudness (LUFS) reading.` (silence: ` Silent — no loudness or peak to level; kept as
  generated.`); the index is unchanged. Tests: `audio-normalize-ceiling.test.ts` (new; the REAL bundled ffmpeg; a JS 0.25 s
  stereo noise-burst mp3 — red on the old code at −1.44 dBTP), `audio-loudness-rule.test.ts` +4, `audio-normalize.test.ts` +1,
  `shot-asset-refs.test.ts` +1 (F2 red), `pool-import.test.ts` 2 (red by commenting the mark out), `audio-tools.test.ts` +1
  (N5 red), `generate-audio-asset.test.ts` +1 — **this one written WITH the code, not run red first**.
  **Live re-check** (builder #8, stopped-app driver `.vidtsx-temp/end-to-end/E2/fix1.e2.test.ts`, one invocation per
  stand-in, the REAL handlers on the E2 profile; a pass-through spy on `normalizeAudioFile` records the result-only fields;
  meter `ffmpeg-full` n8.1.2; `…\E2\fix1.json`):
  | stand-in (meter in: I / TP / sample) | branch | corrective passes | `gainDb` | recorded LUFS / dBTP | meter out: I / TP / sample | rec − meter (LU / dB) | probe vs ffprobe |
  |---|---|---|---|---|---|---|---|
  | `v-short.mp3` (verifier's; −70 gated / −8.7 / −8.705, 0.25 s stereo) | gated | **1** (first encode −1.27) | +6.87 | — / −1.88 | −70 / **−1.9** / **−1.871** | — / +0.02 | 0 ms |
  | `standin-quiet.mp3` (−27.4 / −5.7 / −5.727) | clamped | 0 | +4.18 | −23.44 / −1.79 | −23.4 / **−1.8** / **−1.832** | −0.04 / +0.01 | 0 ms |
  | `standin.mp3` control (−9.3 / +0.6 / +0.538) | target | 0 | −10.71 | −20.27 / −10.79 | **−20.2** / −10.8 / −10.791 | −0.07 / +0.01 | 0 ms |
  Every output ≤ −1.5 dBTP and ≤ −1.5 dBFS; the control is unchanged from the exit (no regression). New library files:
  `generated/sfx-a-short-noise-hit-fix1.mp3`, `…-quiet-tick-train-fix1.mp3`, `…-short-airy-whoosh-fix1.mp3` (`usedIn
  ["e2-exit"]` each). **Gates after fix round 1** (app stopped; guard C: 34.8 GB, headroom 22.5 GB): full worktree vitest
  `--maxWorkers=2` → **487 files passed, 3 failed, 5 skipped (495); 4,149 tests passed, 9 failed, 35 skipped (4,193);
  262.38 s**, no timeouts (`…\E2\vitest-full-2.log`) — the 3 files / 9 tests are E-d2a's suites, each only on package
  resolution (`builder-libraries` 1 `@remotion/paths … is not installed`; `shot-bundle-in-place` 3 `Could not resolve
  "chroma-js"`; `shot-bundle` 5 `roughjs` / `@remotion/shapes` / `@react-three/fiber` / `chroma-js` /
  `@remotion/google-fonts/SpaceGrotesk`); rule (b) on the new 71-file `git diff --name-only 5d77600..HEAD` (+
  `audio-normalize-ceiling.test.ts`, `pool-import.ts`, `pool-import.test.ts`): same method (`…\E1\import-graph.cjs`) → 2 / 15 /
  23 / 1 local modules, touched by the E diff: NONE (`…\E2\diff-list-2.txt`, `import-graph-2.txt`); types web **26** / node
  **10**, none in E2's files (`tsc-web-6.log`, `tsc-node-6.log`); `wt/out` rebuilt at HEAD (`…\E2\build-2.log`).
- **Also in this entry's commit — E1 verifier round 4, V4-N1:** the E1 entry's W2 line below and TESTING §18.14 no longer
  list proxies among the consumers of the probe's width / height (`proxy-generator.ts` reads `probe.duration` (:240) and
  `probe.hasAudio` (:251, :321) only). V4-N2 not needed (`pre-e1-control.test.ts` untouched).
- **Not measured / open:** the live ElevenLabs call (E-d6 — for Hasan); the `generate_tsx_shot` assetRefs seam and the pool
  import seam are unit-tested only in my runs (the pool import now by `pool-import.test.ts`; the verifier ran it live); the
  short-transient case ran live in fix round 1 (above); a normalize failure only as unit (F) in my runs (the verifier's
  mp2-in-`.mp3` ran live); a second corrective pass was never needed live; the Assets
  screen shows no duration / LUFS / tags (above).
- **For Hasan:** one live ElevenLabs `generate_sfx` (a real key, his profile) — the real response through the same
  normalize / probe / index path as the stand-in (real-video list). Whether the Assets details panel should print the
  duration / LUFS.
- **Evidence:** `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\` — `exit.json` (every number), `exit-summary.md` (what was
  measured by what, with tolerances), `exit-run-1.log` / `exit-run-2.log` (main) / `exit-ceiling-run-1.log`, `app-1.log`,
  `assets-generated.png`, `build-1.log`, `standin.mp3` / `standin-quiet.mp3`, `a-red.log` … `d-green-2.log`,
  `vitest-full-1.log`, `diff-list.txt` + `import-graph.txt`, `tsc-web-1…5.log` / `tsc-node-1…5.log`, `watchdog.log`; fix
  round 1: `fix1.json`, `fix1-short.log` / `fix1-ceiling.log` / `fix1-main.log`, `vitest-full-2.log`, `diff-list-2.txt` +
  `import-graph-2.txt`, `tsc-web-6.log` / `tsc-node-6.log`, `build-2.log`, and in the kit `f1-red.log`, `f2-red.log`,
  `n3-red.log`, `n2-red.log`, `n5-red.log` + greens; the
  profile `…\profiles\E2\profile`; kit `.vidtsx-temp/end-to-end/E2/` (`launch.sh`, `live.mjs`, `cdp.mjs`, `e2-common.ts`,
  the two drivers, `vitest.e2.config.ts`). TESTING.md §18.15; HANDOFF `docs/studio/end-to-end/E2/HANDOFF.md`.

## 2026-10-23 — END-TO-END E1: library index v2 — `kind`, `probe` on upsert, `tags` / `audio` / `usedIn`, one kind table, the migration — DONE (fix round 3, docs only, after verifier FAIL 3 on the records)

- **What:** part E1 of `docs/studio/END_TO_END_PLAN.md` (track E, session 4; worktree branch `end-to-end-p0-e`, cut from
  `end-to-end-p0` @ `5d77600` — orchestrator decision E-d1). Row: "Index v2: `kind`, `probe` on upsert, `tags`, `audio`,
  `usedIn`; one kind table; migration". Exit: `list_assets(scope:'library')` shows durations for every audio file.
  **Result: met.** On an isolated profile seeded in the PRE-E1 index format (written by the frozen pre-E1 code) with all
  seven audio extensions + png + avif + mp4, after the migration the REAL `list_assets` handler prints a duration for
  every audio file and the video, each within 10 ms of an independent ffprobe (index 0 ms off for all 11, printed ≤ 3.5 ms
  = `toFixed(2)` rounding); a file added after the migration (upsert) and a reconcile pass (touched / moved / new) keep or
  refresh `probe`.
- **The code:**
  - `cd978c3` — ONE extension → kind table `src/shared/media-kinds.ts` (`MEDIA_EXT_KIND`, `mediaKindOf`, …; the union of
    the two old tables: `.opus .mts .m2ts .aac` in, `.avif` an image) replaces `media-import.ts`'s sets and the renderer's
    `file-type.ts` table (`AssetCategory = LibraryAssetKind`); index types gain `kind? tags? audio? usedIn?` on entries and
    tombstones (tombstones also `probe?`) and `LibraryIndexFile.rev?: 2` with `version: 1` KEPT (E-d5); frozen pre-E1
    `library-store.ts` / `library-reconcile.ts` copies in `src/main/services/library/pre-e1-control/` (`git show 5d77600:…`,
    import paths only) for the control test.
  - `6005a7e` — `library-index-io.ts` (the one per-root serialize chain; `loadIndex` derives a missing `kind` on read;
    `writeIndex` always writes `version: 1, rev: 2`, and its first write per root per process copies a pre-rev-2 on-disk
    index to `.vidtsx/index.v1-backup.json` once, `flag: 'wx'`); `library-probe.ts` (the app's `probeMedia` = Remotion's
    ffprobe, audio / video only, 15 s cap, never throws); `upsertEntry` probes before the chain and writes `kind` + `probe`,
    passes `tags` / `audio` through; `reconcileIndex` takes an injected prober — touched → probe REFRESHED (was cleared),
    moved → kept, resurrected → the tombstone's, new → probed; `scanLibrary` probes ≤ 20 files inline per scan and hands the
    rest to `library-backfill.ts` (deduped per root, batches of 8, 2 ffprobes at a time, one write per batch, patches only
    while relPath + size + mtime still match); `library-migrate.ts` at app start (beside `sweepExportScratch` in
    `src/main/index.ts`): backup once, back-fill `kind`, write `rev: 2`, kick the back-fill — idempotent; `list_assets`
    library rows via `agent-tools/library-listing.ts`: `entry.kind` + duration `toFixed(2)` s, `length unknown (probing)`
    while a media entry has no probe (fix round 1: `(unreadable)` for a failed one).
  - `a3f48d8` — the live finding (below): `src/main/services/studio/mp3-gapless.ts` + its `probeMedia` wiring.
  - Fix round 1 (verifier FAIL 1): `eb533e4` — `probeMedia` skips attached-picture streams (`disposition.attached_pic`)
    when it picks the video stream; `36a0586` — the probe stamp (below).
  - Fix round 2 (verifier FAIL 2): `d3908c3` — a library probe without a finite duration > 0 is a failed probe (below).
  - Docs: `26daa16` `24c83c6` `590cee9` `0c63adf` `af915f8` + this entry's commit. Kit (gitignored):
    `.vidtsx-temp/end-to-end/E1/`.
- **E-d5 downgrade safety (control test, red first):** `pre-e1-control.test.ts` runs the FROZEN pre-E1 store on an
  E1-written index: the old `loadIndex` reads it whole (`version: 1` + `rev: 2` is NOT its empty index); old
  `setDescription` / `upsertEntry` keep every field, old and new, and `rev`; an old `scanLibrary` keeps everything on
  untouched + moved entries, clears `probe` on touched ones, tombstones THE OLD SCAN CREATES lose `kind probe probeStamp
  tags audio usedIn`, and a tombstone the E1 code already made keeps every field only while it STAYS a tombstone (old
  `setDescription` / `upsertEntry`, an old scan that does not resurrect it — pinned in fix round 2): **an old scan that
  RESURRECTS it** (the same bytes back while an old app runs) rebuilds the entry from the pre-E1 fields only — the frozen
  `resurrect()` (`pre-e1-control/library-reconcile.ts:45-60`) names `relPath hash description brandId origin addedAt size
  mtimeMs`, so `kind`, `probe`, `probeStamp`, `tags`, `usedIn`, `audio` are LOST; the next E1 start restores `kind` (derived
  on read, written by the migration) and `probe` (the back-fill), while `tags` / `audio` / `usedIn` are gone (fix round 3,
  R1 — the earlier record "keeps every field under every old write" was false); new files get no `kind`, and `rev` is
  DROPPED → the next E1 start re-migrates (backup kept from the first run, kinds back, the back-fill re-probes). **Every pre-E1 field survives every old write** — Hasan's installed 1.1.x app and the main branch read an E1
  library without loss.
- **The live click-through** (the worktree's own build `wt/out`, no Vite server, CDP 9261; profile
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\E1\profile` copied from `source` WITHOUT `settings.db`; library root
  confirmed `<profile>\assets`, `isOverride: false`):
  - Seed `assets\e1-seed\`: `tone-a.mp3` 1.3 s · `tone-b.wav` 2.25 · `tone-c.m4a` 3.1 · `tone-d.ogg` 1.75 · `tone-e.opus`
    2.6 · `tone-f.flac` 0.9 · `tone-g.aac` 1.5 · `still.png` · `still.avif` · `clip.mp4` 2 s; the index (16 entries incl.
    6 preset files) written by the frozen pre-E1 `scanLibrary` (no `rev` / `kind` / `probe`), sha256 `b495fdfa…cefcd`.
  - Launch 1: `Library index migrated to rev 2 {fromRev: null, entries: 16, kindsFilled: 16, backedUp: true}`; **probe
    back-fill 8 files in 347 ms** (probed 8, failed 0, written 8); `index.v1-backup.json` sha256 = the pristine seed;
    `index.json` `version: 1, rev: 2`, kinds 7 audio / 1 video / 2 image / 6 data, `probe` on the 8 timed entries only.
    Launch 2: no migration line (idempotent), backup unchanged.
  - Assets screen: `e1-seed` lists all 10 files ("10 items · 612 KB"; `.opus` / `.aac` as audio cards, `.avif` draws its
    thumbnail — the bundled ffprobe reads it, av1 640×360) — still `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\assets-screen.png`.
  - Reconcile (the Assets `Refresh` button): touched `tone-b.wav` → probe refreshed 2.25 → 3.4 s; moved `tone-f.flac` →
    keeps 0.9 s + hash; new `late-h.wav` → 1.15 s inline. Upsert: `late-upsert.mp3` (1.7 s) through the REAL
    `upsertEntry` + Remotion ffprobe → `kind: audio`, `probe {duration: 1.7, codec: mp3}`.
  - `list_assets(scope:'library')` (the REAL `buildProjectTools(ctx)` handler): after the migration every audio file + the
    video had a duration, all within 10 ms of an independent ffprobe (n8.1.2) **except `tone-a.mp3` (1.344 vs 1.300 s)** →
    the live bug; final, after the fix: **11 rows, index 0 ms off for all 11, printed ≤ 3.5 ms** (opus 2.6065 → 2.61,
    aac 1.527682 → 1.53).
- **Live bug, fixed red-first — mp3 durations (a side effect on Studio imports):** the bundled Remotion ffprobe (n7.1)
  reports a LAME / Lavf mp3's `format.duration` as frames × 1152 / rate, i.e. WITH the encoder delay + end padding (+44 ms on
  a 1.3 s tone; ffprobe n8 trims them). `mp3-gapless.ts` reads the Xing/Info + LAME tag (frame count, delay, padding;
  MPEG-1/2/2.5, ID3v2 skipped) and trims only when ffprobe's value equals the untrimmed frame total within 1 ms (a newer
  ffprobe that already trims is left alone); `probeMedia` applies it to every mp3 without a real video stream. **`probeMedia`
  is also Studio's import probe: an mp3 imported into a Studio project now gets its gapless length — shorter than before by
  (encoder delay + padding) / sample rate: about −25 ms at 48 kHz to −160 ms at 8 kHz; the lower the rate, the more
  (verifier rounds 1–3, measured; in every case the product equals two independent ffprobes and the decoded sample count:
  8 kHz MPEG-2.5 CBR −156.0 on a real Studio import / −160 in the library; 11.025 kHz VBR −151.0, MPEG-2.5 CBR −115.0
  (2.3510 → 2.2360 s); 12 kHz −116; 16 kHz −72 / −90; 22.05 kHz −53.8…−76.2; 24 kHz −52 / −70; 32 kHz −48…−62.0;
  44.1 / 48 kHz −26.9…−51.2 — e.g. 48 kHz VBR mono −27.0, cover-art 44.1 kHz −30.2, 44.1 kHz CBR −32.1, narration −41,
  catalog sfx −42.4, 48 kHz tone −44, 44.1 kHz with cover on a Studio import −45.1, long VBR −50.4); fix round 3, R2 — the
  earlier "about −25 to −115 ms" understated it; already-saved projects keep their stored probe.**
- **Fix round 1 (verifier FAIL 1, 2026-10-23), red first:**
  - **V1-1 / V1-2 — cover art:** an ID3 cover picture is a "video" stream to ffprobe (mjpeg / png, `attached_pic: 1`), so
    an mp3 with cover art skipped the gapless trim (+30.2 ms, over the exit's 10 ms) and was recorded as `codec: mjpeg,
    width: 320`. `probeMedia` (`media-import.ts`) now picks the first video stream that is NOT an attached picture: the
    trim applies, `codec` / `width` / `height` / `fps` come from the real streams. Studio's asset kind and lane come from
    the extension (`classifyMediaKind`), audio gets no thumbnail. Consumers of the Studio probe's `width` / `height`
    (completed in fix round 2, W2): face / mask tracking (`face-track-job.ts:137`, `mask-track-job.ts:146`) — an
    audio-only file with cover art (e.g. an audio + cover `.mp4`) now stops with "Could not read the frame size of the
    source" instead of tracking the picture's 600×600; `export-spans.ts:190` ("unknown source size") and
    `sync-probes.ts:141` fall back to the composition size; `AssetCard`'s "· W×H"; the
    shot asset refs' / build media's / `builder-asset-tools`' optional `width` / `height` — an mp3 now carries none
    (correct). **None changes for a real video** (verifier 2: 11 real-video files probe identically pre-E1 vs HEAD; a video
    with cover art keeps its real stream). `services/media/ffmpeg-run.ts` (agents, video-edit, captions, content safety)
    has its own probe — untouched. Unit `media-import-probe.test.ts` (4; 3 red on `184e996`).
  - **V1-4 / V1-5 — the probe stamp:** `LibraryIndexV2Fields.probeStamp?: { size, mtimeMs, failed? }` (optional; entry +
    tombstone) = the file version a probe — or a failed probe — was measured on. `library-probe-state.ts` (pure)
    `probeStateOf` → `ok` (stamp fits, or no stamp: trusted) / `stale` (stamp ≠ the entry's size/mtime: an older app kept
    the probe across a rewrite) / `failed` (failed on this very version) / `missing`. Upsert (`library-store.ts:164`) and the
    back-fill (`library-backfill.ts:94`) stamp what they measure, a failure too (`failed: true`, persisted — the back-fill's
    in-memory no-retry set is gone), so an unreadable file is not retried until it changes, across restarts, and lists as
    `length unknown (unreadable)`. The reconcile does NOT stamp a failed probe — it stamps only a probe it got
    (`library-reconcile.ts:74`, `:113`, `:163`), so a file that fails inline during a scan is left with no probe and no stamp
    (`missing`), and the back-fill the scan kicks re-probes and stamps it (fix round 3, N1 — the earlier "upsert, reconcile
    and the back-fill stamp" was wrong about the reconcile; verifier 3: 9 of 20 inline probes failed on a fresh scan and
    listed `(probing)` for ~1–2 s until the back-fill stamped them). A stale probe lists as `(probing)` (never the stale
    number) and the back-fill (kicked by every scan and at start) re-probes it. Unit `library-probe-stamp.test.ts` (4; 3 red
    on `eb533e4`).
  - **Live re-measure (the real `probeMedia` + `list_assets`, E1 profile, app stopped):** `e1-seed\cover-art.mp3` (3.0 s
    LAME 44.1 kHz sine + a 320×320 png cover, made by the profile's ffmpeg-full; independent ffprobe n8.1.2: `3.000000`,
    streams mp3 + png `attached_pic=1`; the bundled n7.1 raw: `3.030204`) → the REAL `upsertEntry` → index `probe
    {duration: 3, hasAudio: true, codec: mp3}` (no width), stamped; the REAL `list_assets(scope:'library')` → `3.00 s`;
    all 11 timed rows within 10 ms (index 0 ms for all; printed ≤ 3.5 ms) — `…\vidtsx-e2e\E1\fix1-cover-art.json`. Backup
    `index.v1-backup.json` still sha256 `b495fdfa…cefcd`.
  - **Known limit:** an ffprobe TIMEOUT (15 s) is stamped as a failure too — that file is retried only once it changes.
- **Fix round 2 (verifier FAIL 2, 2026-10-23), red first — `d3908c3`:**
  - **V2-1 — a file ffprobe "reads" without a duration:** random bytes named `.flac` give ffprobe rc 0, a flac stream with
    `sample_rate=0` and `format.duration=N/A`; `probeMedia`'s `parseFloat(…) || 0` (pre-E1, `media-import.ts`) made it
    `{duration: 0, codec: flac}`, which the library stamped good and listed `0.00 s`. Now `probeLibraryFile`
    (`library-probe.ts`) treats an audio / video probe without a finite duration > 0 as a FAILED probe (returns undefined →
    upsert and the back-fill stamp it `failed` → `length unknown (unreadable)`; the reconcile leaves such an entry unprobed
    and unstamped, and the back-fill it kicks fails it — N1); `probeStateOf`
    (`library-probe-state.ts`, `hasUsableDuration`) never trusts such a probe already in an index (written by the
    fix-round-1 code): `stale` → listed `(probing)` → the back-fill re-probes and stamps it failed; `upsertEntry` no longer
    keeps one for an unchanged file. Unit `library-probe-duration.test.ts` (12; all 12 red on `1312e09`'s code).
  - **Studio's own import is NOT changed (decided):** a 0-duration import today (pre-E1 behaviour, E1 did not touch it)
    lands in the pool with `probe.duration 0` — no duration badge (`MediaThumbnail.tsx:31`), a dropped clip is 0.1 s
    (`clip-factory.ts:38`), analysis treats it as unbounded (`analysis-status.ts:103`). Rejecting it at import would change
    a Studio flow E1's tests do not cover; left as is (a candidate follow-up, not E1).
  - **Live re-measure (my own garbage files, E1 profile, app stopped — no launch):** `assets\e1-fix2\` = 64 KiB random
    `garbage.flac` / `.mp3` / `.wav` / `.aac` + a 0-byte `empty.wav`; the REAL `upsertEntry` (flac, mp3, empty wav), the
    FROZEN pre-E1 `upsertEntry` then the REAL back-fill (wav, aac: `candidates 2, probed 1, failed 1`; a second pass
    `candidates 0` — nothing retried unchanged), the REAL `list_assets(scope:'library')`. `garbage.flac`: the real
    `probeMedia` returns `{duration: 0, codec: flac}` (independent ffprobe n8.1.2: `sample_rate=0 | duration=N/A`, rc 0)
    → stamped failed, `(audio, length unknown (unreadable), imported)`; `.mp3` / `.wav` / `empty.wav` (ffprobe rc 1) →
    unreadable too; the 11 real timed rows unchanged (`3.00 s`, `1.30 s`, …). Report
    `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\fix2\garbage.json`, driver `.vidtsx-temp/end-to-end/E1/garbage.e1.test.ts`.
  - **Known limit (an ffprobe quirk, recorded, not fixed):** random bytes named `.aac` give ffprobe rc 0 and an ESTIMATED
    length (ADTS: mine 0.956783 s in both the bundled and the n8.1.2 ffprobe, `sample_rate=0`; verifier 2's 0.792 s) → it
    lists as a duration (`0.96 s`), not unreadable.
- **Gates (2026-10-23, HEAD `a3f48d8`):** guard 54.8 GB C: free, 25.7 GB D:, commit headroom 51.5 / 99.7 GB → default
  workers; no E1 instance running. Full vitest from the worktree (`node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs
  run`): **474 files passed, 3 failed, 5 skipped (482); 4,058 tests passed, 9 failed, 35 skipped (4,102); 34.9 s**, no load
  timeout (the counted run; log `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\vitest-full-2.log`). **The worktree gate
  (E-d2a):** the three failing files are exactly the worktree-only package-resolution suites, each failing ONLY on
  resolution — `builder-libraries.test.ts` 1 (`@remotion/paths … is not installed`), `shot-bundle.test.ts` 5 and
  `shot-bundle-in-place.test.ts` 3 (esbuild `Could not resolve "chroma-js" / "roughjs" / "@remotion/shapes" /
  "@react-three/fiber" / "@remotion/google-fonts/…"`). (a) `--root <wt>` started from the main checkout's directory does
  not resolve them — the same 9 failures (`vitest-rule-a.log`; nothing written in the main checkout) — because all three
  look packages up from `__dirname` / the script's own location, not the cwd; (b) **none of their import graphs holds a
  file of `git diff --name-only 5d77600..HEAD`** (esbuild metafile, the suite's `vi.mock`'d modules not loaded):
  builder-libraries 2 local modules, shot-bundle 15, shot-bundle-in-place 23 (it reaches `media-import.ts` only as
  `vi.mock('./media-import')`), `scripts/builder-unpack.mjs` 1 (`…\E1\import-graph.txt`, script `import-graph.cjs`). They
  re-run from the main checkout when track E lands. Types: `tsc -p tsconfig.web.check.json` → 26, `-p
  tsconfig.node.check.json` → 10 = baseline. E1's own suites (`media-kinds` 6, `pre-e1-control` 5, `library-migrate` 9,
  `library-reconcile-v2` 8, `library-listing` 4, `mp3-gapless` 6) green in that run.
- **Gates after fix round 1 (2026-10-23 ~21:40, HEAD `36a0586` + docs):** guard C: 52.3 GB free, D: 25.8 GB, commit
  headroom 56.4 / 99.7 GB → default workers; no E1 instance running. Full vitest from the worktree: **476 files passed, 3
  failed, 5 skipped (484); 4,066 tests passed, 9 failed, 35 skipped (4,110); 47.3 s** (`…\E1\fix1\vitest-full-3.log`) —
  the 3 files / 9 tests are the same E-d2a resolution suites, each failing only on resolution (`@remotion/paths … is not
  installed`; `Could not resolve "chroma-js"` ×2 / `"roughjs"` / `"@remotion/shapes"` / `"@react-three/fiber"` /
  `"@remotion/google-fonts/SpaceGrotesk"`); rule (a) not repeated (nothing in the setup changed since builder #5's try);
  rule (b) re-run on the new diff (32 files): none in any of their graphs (`…\E1\fix1\import-graph.txt`). E1 suites + the
  E-d5 control: `src/main/services/library` + listing + probe + gapless + kinds + asset-library → 21 files, 169 tests
  green. Types: web 26, node 10 = baseline.
- **Gates after fix round 2 (2026-10-23 ~22:19, HEAD `d3908c3`):** guard C: 51.9 GB free, D: 25.7 GB, commit headroom
  52.6 / 99.7 GB (`limitKB=104541096 freeKB=55164952`) → default workers; no E1 instance running. Full vitest from the
  worktree: **477 files passed, 3 failed, 5 skipped (485); 4,079 tests passed, 9 failed, 35 skipped (4,123); 33.1 s**
  (`…\E1\fix2\vitest-full-4.log`) — the 3 files / 9 tests are the same E-d2a suites with the SAME failure messages as
  run #3 (resolution only: `@remotion/paths … is not installed`; `Could not resolve` chroma-js ×2 / roughjs /
  @remotion/shapes / @react-three/fiber / @remotion/google-fonts/SpaceGrotesk, and the `ok: false` results they cause);
  rule (b) re-run on the 33-file diff: none in any graph (`…\E1\fix2\import-graph.txt`). **Rule (b)'s method (W3):** per
  suite an esbuild bundle metafile from the test file, packages external, Vite `?raw` imports as leaves (text, not
  followed), the suite's `vi.mock`'d local modules not followed; "local modules" = the non-package inputs of that
  metafile. Another method (e.g. a static walk that follows `vi.mock`'d modules) counts differently — what is checked is
  that no file of `git diff --name-only 5d77600..HEAD` is in any graph. E1 suites + the E-d5 control
  (`src/main/services/library` + listing + probe + gapless + kinds + asset-library) → 22 files, 181 tests green; the
  control alone 6/6. Types: web 26, node 10 = baseline.
- **Fix round 3 (verifier FAIL 3 on the RECORDS only, 2026-10-24) — docs only, no behaviour change in `src/`:** the exit,
  the gates, E-d5 and every earlier finding passed verifier 3; its findings were wrong or missing statements in this entry,
  TESTING §18.14 and one code comment. Corrected above: **R1** (E-d5 — an old scan that RESURRECTS an E1 tombstone loses
  the new fields; the earlier "keeps every field under every old write" was false), **R2** (the mp3 trim range is
  (delay + padding) / sample rate, −25 ms at 48 kHz to −160 ms at 8 kHz; "−25 to −115" understated it), **N1** (the
  reconcile does not stamp a failed probe; upsert and the back-fill do). The `media-import.ts:123-126` comment carries the
  R2 range (comment text only). Recorded:
  - **Known limit (N2, an ffprobe limit, recorded, not fixed):** a TRUNCATED mp3 whose Xing header announces the full
    length (verifier 3: 9 KB, 5.0 s in the header, 0.52 s of audio) lists the header length (`5.00 s`) — the same as both
    independent ffprobes (n8.1.2, gyan 2025-11): the duration comes from the header, not from decoding. Same class as the
    `.aac` estimate above (verifier 3's random `.aac` bytes: 1.57 s = gyan's estimate).
  - Not findings (verifier 3): N3 — `upsertEntry` probes before the chain's `stat`, so a rewrite in that gap would stamp an
    old probe with the new size / mtime (nit, open); N5 — proxy jobs fail for an audio-only `.mp4` with cover art and an
    `mp3-only.mp4` has no thumbnail — pre-E1 behaviour (the proxy reads only `probe.duration`, unchanged by E1).
- **Gates after fix round 3 (2026-10-24 08:46, docs only):** guard C: 47.5 GB free, D: 25.8 GB; no E1 instance, no launch, no
  profile copy, no full run (nothing in `src/` changed behaviour — `git diff` of `media-import.ts` shows comment lines only).
  E1 suites + the E-d5 control from the worktree (`node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  src/main/services/library src/main/services/studio/agent-tools/library-listing.test.ts
  src/main/services/studio/media-import-probe.test.ts src/main/services/studio/mp3-gapless.test.ts
  src/shared/media-kinds.test.ts`): **20 files, 170 tests passed, 3.5 s** (`C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\fix3\e1-suites.log`).
  Types: `tsc -p tsconfig.web.check.json` → 26, `-p tsconfig.node.check.json` → 10 = baseline (`…\E1\fix3\tsc-web.log`, `tsc-node.log`).
- **Not measured / open:** the first Assets scan of a BIG drop (≤ 20 inline probes per scan, the rest to the back-fill) —
  the seeded drop of 3 changed files was instant; a library-root override changed at runtime is migrated at the next start
  (until then it reads fine: kinds derived on read, the first E1 write backs it up and writes rev 2). E2 fills `tags` /
  `audio` / `usedIn`; E3 adds kind / query filtering and shows them. `CAPABILITY_GAPS.md` unchanged (E3 writes the G4 note).
- **For Hasan:** allowing a `node_modules` junction in the worktree would make track E's vitest gate whole (E-d2a).
  Nothing for the real-video list.
- **Evidence:** `C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\` — `index.pre-e1.seeded.json`, `after-migration.json`,
  `final.json`, `assets-screen.png`, `vitest-full-1.log`, `vitest-full-2.log` (counted), `vitest-rule-a.log`,
  `import-graph.txt` / `import-graph.cjs`, `build.log`; `fix1\` (round 1); `fix2\` (round 2: `v2-1-red.log`,
  `v2-1-green.log`, `e1-suites.log`, `control.log`, `garbage.json`, `garbage-run.log`, `vitest-full-4.log`,
  `diff-list.txt`, `import-graph.txt`); the profile `…\profiles\E1\profile`; kit `.vidtsx-temp/end-to-end/E1/`.
  TESTING.md §18.14; HANDOFF `docs/studio/end-to-end/E1/HANDOFF.md`.

## 2026-10-23 — END-TO-END B7: editorial cuts leave no hard entries — EXIT PARTIAL (overlap waits for Hasan)

- **What:** part B7 of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`). It is not a row in the plan's §3: Hasan
  added it on 2026-10-23 (session 3) after the track-B exit failed on E2's "hard entries 0" (B6's applied cut **6 / 146**,
  all six at the end of an editorial item). The row: the produced cut of the assistant's real pass leaves no hard entries.
  Scope = the five mechanisms the track-B exit found: (1) the 1.0 s wordless-sliver merge cap, (2) editorial cut-ins on a
  removed word's leftover sound, (3) the planner's clamp slicing an onset (0375 122.7), (4) Auto Cut planning over spans
  the editorial pass already removed (B6: 199.5 s of its 587.1 s), (5) cuts the card's own QA flags reaching Apply. Exit,
  on ONE real pass (`Cut this video.`, all nine M2 clips, the keyless `claude-subscription`, B6's run shape): **0 hard
  entries** on the applied cut; **content overlap ≥ 90.5 %** of Hasan's cut seconds (orchestrator decision 8: read on the
  APPLIED cut, the all-proposed number beside it); **median lead-in / tail within ±30 ms** of the fitted tight. **Result:
  hard entries 0 and both medians are met on all three live runs and every replay; overlap is not — the last allowed pass
  missed it by 2.40 s of H, on model variance (decision 12) → EXIT PARTIAL — WAITING-HASAN (overlap).**
- **The code** (every fix red-first; every change in the shared snap / planner / card code that all consumers use — T1's
  one-resolver rule):
  - `31feae2` — the five mechanisms mapped to file:line; fixture `src/shared/studio/cut-snap-b7.fixture.json` (the real 20 ms
    buckets + words around B6's six hard entries).
  - `a31080a` — mechanisms 1–3: a wordless gap between two cuts of the same kind merges at any length unless > 1.0 s of it is
    loud (`cut-snap.ts` `mergeKey`, `LOUD_GAP_MAX_S`); a cut end moves out of the removed word's MEASURED release and out of
    the kept word's lead-in (new `cut-snap-landing.ts` `landCutEnd`); B2's text-delete style test moved to a roomier gap
    (both pre-B7 cut-ins there were hard entries, +40.0 / +36.0 dB).
  - `eaf682d` — item 5: a cut whose join carries a card-QA hard entry starts unchecked with its reason (new `cut-qa-flags.ts`,
    optional `StudioProposalItem.qaFlag`) on both cards; `propose_cuts` / `run_auto_cut` name it and the reply must; both
    Apply paths (the click, `accept_proposal`) take only checked items.
  - `2102419` — item 4: Auto Cut (button and `run_auto_cut`, one `runCutPlan` path) plans over the asset's timeline keeps
    (new `cut-keeps.ts`, `plan.keeps`, own `-k<tag>` plan file); the card proposes only inside them and headlines "−X s of
    Y s still on the timeline"; the QA readout adds "— N unchecked by QA".
  - `d1d253a` — step 4b: `run_auto_cut` after `accept_proposal` in one turn plans over the timeline as the apply left it
    (the renderer returns `sourceKeeps` computed with the reducer's own `applyProposalByKind`; main overlays them).
  - `ca51e9f` — step 7: keeps-limited Auto Cut plans only the keeps that hold words, so a wordless clip head / tail is one
    card item (`keepsWithWords`); an authored editorial end inside a word or a too-short gap lands in the nearest quiet
    inter-word gap within 1.5 s, on the side holding most of the straddled word (decision 10), with the kept word's
    walked-onset cap (`endOutOfSpeech`, editorial-only `seekQuietGap`).
  - `ecaa5bd` — step 9 (a): `run_auto_cut` (incl. "Nothing to cut") and `propose_cuts` results end with the clips on the
    timeline still without a card of this run, in timeline order (new `cut-sweep.ts`, `agent-tools/cut-run-line.ts`) + the
    `CLIP-BY-CLIP RUNS` prompt line.
  - `47b7acf` — step 9 (b), decision 11: when that side has no quiet gap, the other side's is taken only across words the
    item's own note names as one run (no note → ≤ 2 words, ≤ 0.4 s); the row says `extended past "…" to land on quiet`.
  - `1b74b73` — decision 13: a retract that would re-keep covered words the item names goes forward instead, within
    decision 11's cap (step 6's 0375 slate "Another take." 132.732 → 133.826; Hasan's hand 133.816).
  - Docs: `06d2da9` `f327293` `8b980b3` `734cc74` `965e736` `7ade6bc` `bed6d6c` `0db1b88` `d9cdc13` `629f803` `277f724`
    `b40e390` + this entry's commit. Kits (gitignored): `.vidtsx-temp/end-to-end/B7/`.
- **The three live runs** (decision 5's shape: each ONE pass on a FRESH D: copy of the shared M2 + a profile copied WITHOUT
  `settings.db`; the keyless `claude-subscription`, every turn `claude-sonnet-5-5`; cut style tight · default; every card
  captured from `project.json` before a real-click answer — Apply = the checked items, "Reject all" when none; measured with
  `exit_check.py` (analyze_cut `entry_check` on real joins > 0.75 s) and B6's `measure.py`; none broken by the harness —
  decision 9's three passes are spent):

  | Run (code) | Hard entries (applied) | Lead-in / tail median vs fitted tight | Overlap applied (the bar) / all proposed | Turns · model time · notional | Items editorial + Auto Cut · applied · QA-unchecked | Final V1 |
  |---|---|---|---|---|---|---|
  | B6 baseline (pre-B7) | 6 / 146 | 0 / +6 ms | 0.9049 / 0.9051 | 17 · 337.2 s · $3.89 | 39 + 261 · 298 · — | 196 clips · 509.149 s |
  | Step 6 (`d1d253a`) | **0 / 137** | 0 / −4 ms | 0.8723 / 0.8974 | 17 · 345.0 s · $4.01 | 35 + 163 · 190 · 6 (named) | 187 · 534.285 s |
  | Pass 2 (`ca51e9f`) | **0 / 121** | 0 / −14 ms | 0.8418 / 0.8479 | 16 · 323.8 s · $2.82 | 33 + 142 · 173 · 1 (named) | 160 · 561.346 s |
  | **Pass 3 (`1b74b73`, the last)** | **0 / 137** | **0 / −14 ms** | **0.9020 / 0.9024** (2.40 s of H short) | 17 · 355.1 s · $3.97 | 31 + 171 · 201 · 0 | 181 · 510.509 s |

  - **Step 6:** turn 1's reply had no `[next: …]` marker, so `Move on.` was typed (decision 9 records it); turn 8 offered
    Auto Cut → B6's answer `Yes, run Auto Cut for the pauses on all nine clips.`; turn 17 re-ran Auto Cut on 0375 ("nothing
    to cut" — item 4 working). Overlap lost to six authored ends in continuous speech left unchecked by QA (15.05 s) and to
    wordless clip heads / 0373's tail kept whole by keeps-limited Auto Cut (12.27 s) → step 7.
  - **Pass 2:** turn 1 carried its marker (no `Move on.`); B6's Auto Cut answer after turn 8's offer; the Auto Cut sweep
    **skipped 0371** (turn 11 miscounted, turn 12 ran 0372, turn 16 said all nine were cut — 47.0 s of H), and 0375's
    authored 195.0 inside the slate "other" found no quiet gap on decision 10's side (unchecked, 4.96 s) → step 9 (a) / (b).
  - **Pass 3:** turn 1 ran `run_auto_cut` on 0366 FIRST (the prompt's order; every earlier run started editorial), then
    editorial cards alone for 0366 0370 0371 0372 0373 0375 0376; 0369 / 0374 got none ("nothing to cut" — the same applied
    cut as the earlier runs' Reject all on 0369's lone fluff); turn 8 ended the editorial pass **without a marker and
    without offering Auto Cut**. B6's Auto Cut answer was typed at the same point as in every earlier run, and nothing
    else — **accepted by the orchestrator as the run shape** (every run got the same input at the same point); **the model
    did not offer it** (without it the cut after turn 8 measures 0.4581). Then one `run_auto_cut` per clip and all nine got a
    card (step 9 (a)'s list held; turn 17's "Nothing to cut" on 0373 named 0376 next). 0 cuts unchecked by QA; every card's
    QA 0 hard entries. Per clip applied: 0366 0.839 · 0369 0.930 · 0370 0.940 · 0371 0.962 · 0372 0.967 · 0373 0.850 · 0374
    0.869 · 0375 0.908 · 0376 0.880. Where its overlap went (vs B6's applied 735.952 s: −9.209 lost, +6.907 gained; 0 s inside
    a QA-unchecked item, 0.27 s in the unchecked fluff): the model's own spans in 0373 — "Just the first scan cleaned up 42
    gigabytes…" 365.651–370.432 (his flag 3, 4.78 s; only B6 cut it), "Uh" 84.16–86.82 (2.66 s; B6 / step 6), "uh"
    252.9–253.47 (0.57 s; step 6 authored it); gained B6's doubled-phrase misses 0373 25.219–26.816 and 319.72–321.193.
  - Every run: Hasan's own plan 0 / 134 hard entries; produced speeds 1, monotonic; B6's slivers (0366 4.83 / 12.63, 0373
    247.86 / 391.59) gone; pass 3 has no wordless produced segment at all.
- **The replays (decision 12)** — each capture fed offline through the FINAL code (the snap + `buildEditorialProposal` on
  the captured `propose_cuts` args, the real `runCutPlan` over the replayed timeline's keeps, the real `applyCutProposal`,
  answered as live; b-root's real envelopes and words; B6's args are cut at 600 chars, so its items replay from the snapped
  card); kit `replay.b7.test.ts` + `exit_check_replay.py` + `replay-split.py`:

  | Replay | Applied overlap (live) | All proposed | Hard entries | Medians lead / tail | Model share: H no authored span covers | Code share: H inside an authored span, not applied | Shortfall to 0.905·H |
  |---|---|---|---|---|---|---|---|
  | B6 | 0.9091 (0.9049) | 0.9102 | 0 / 135 | 0 / −14 ms | 24.551 s | 0.205 s | 0 |
  | Step 6 | 0.9125 (0.8723) | 0.9143 | 0 / 134 | 0 / −4 ms | 22.143 s | 0.415 s | 0 |
  | Pass 2 | 0.8480 (0.8418) | 0.8488 | 0 / 122 | 0 / −14 ms | 27.957 s + 50.828 s (0371, no Auto Cut card) | 0.378 s | 46.341 s |
  | Pass 2 + 0371's Auto Cut card | 0.9061 | 0.9069 | 0 / 132 | 0 / −14 ms | 27.957 s | 0.378 s | 0 |
  | **Pass 3** | **0.9020 (= live)** | 0.9024 | **0 / 137** | 0 / −14 ms | 30.123 s | 0.427 s | **2.400 s** |
  | Pass 3 + step 6's two 0373 fillers (`84.16–86.74`, `252.9–253.32`) | **0.9060** | 0.9064 | 0 / 137 | 0 / −14 ms | 26.557 s | 0.427 s | 0 |

  The code share is edge-level in every replay (the tight 0.15 s head pad before a kept word an authored span reached —
  four in pass 3) and smaller than any shortfall: no code regression.
- **Outcome (decision 12):** the live pass is the exit (Hasan's wording) and misses the overlap bar by 2.40 s of H; every
  replay has 0 hard entries; the B6 and step-6 replays clear 0.905, pass 2's misses only by the clip the model skipped (0.9061
  with it), and pass 3's own capture misses only by spans the model did not author this time (it did in step 6; with them
  0.9060) → **"missed on model variance" — B7 = EXIT PARTIAL — WAITING-HASAN (overlap)**, onto his real-video list; the run
  continues to the track-B exit.
- **The orchestrator's decisions, as they landed:** 1 (item 5) → `eaf682d`; live 6 / 1 / 0 cuts unchecked, every one named
  in its reply, none ticked. 2 (item 4) → `2102419` + `d1d253a`. 3 → every fix red-first from the real cases. 4 (no
  regression) → B1's cutlib reproduction 348 / 352 joins + 2 merge flips (report JSON-equal), B3's offline QA 0 / 0 hard +
  178 / 181 tails (JSON-equal), B2's five Transcript-delete edges 0 ms — after every snap change (kit runs 1–5); B3's LIVE
  Auto Cut numbers (hard 1 / 164) were not re-measured (they need the app; an untouched clip plans byte-for-byte as before,
  pinned by `cut-plan-runner.test.ts`). 5–7 → three fresh copies, profiles without `settings.db`, nothing waited on Hasan.
  8 → the bar read on the applied cut. 9 → step 6, pass 2, pass 3. 10 → "nearest quiet gap by time" = the word rule on all
  five real cases. 11 → `47b7acf`. 12 → the replays above. 13 → `1b74b73`, built with decision 11's cap (≤ 2 words, ≤ 0.4 s)
  instead of the literal "end unchanged" branch: naming alone moved five real retracts, because the model's notes quote the
  winning take too.
- **Gates (this entry, 2026-10-23, HEAD `b40e390` = the code of `1b74b73`):** guard `28.9 GB C: free; commit 95.0 / 107.3 GB`
  (C: ≥ 4 GB → no python-models exclusion); full `npx vitest run --maxWorkers=2`, app stopped, **first run green: 471 files /
  4,030 tests passed, 5 / 34 skipped, 145.2 s** (the counted run; log `C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\vitest-full.log`);
  `npm run check:types` → web 26 / node 10 = baseline (`…\B7\types-final.log`). At each code step: the targeted cut / agent
  set green (last: decision 13's 40 files / 412 tests), check:types 26 / 10, the decision-4 kits unchanged. The three live
  passes ARE the click-through (real input on isolated profiles over CDP).
- **Follow-ups (not fixed in B7 — orchestrator rulings 2026-10-23):**
  - **Step 9 (a)'s list has gaps:** the editorial list never names the clips still lacking Auto Cut (pass 3 ran Auto Cut on
    0366 only, then editorial alone; nothing told the model eight clips lacked it until the user's message); 0369 / 0374 stay
    listed after a read with nothing to cut (nothing records "reviewed, nothing to cut"), so 0369 was re-read 3× (turns 3, 5,
    7); turn 17 claimed 0373 "got no Auto Cut card" (turn 13 carded it). Also by construction: a second same-kind sweep that
    does not start on a carded clip counts the earlier sweep's clips as done; a card answered < ~1 s before the tool runs can
    be missed (autosave lag); no line for a timeline with < 2 media assets.
  - **The cut-out mirror:** an authored START early in the gap after a kept word truncates that word's tail
    (`cut-planner.ts:163`); a mirror of `landCutEnd` needs `tailFor`'s gap-dependent tail. None of the real cases needed it.
  - **0376 @ 119.084 at +14.4 dB** (0.6 dB under the hard-entry bar; the gap never drops below +9 dB — breath / room — and the
    cut keeps 0.3 s of it before "These"): clean by the shipped QA, marginal by ear.
  - **The readout counting:** the card's QA counts are still the plan's, not recomputed over the checked items (only "— N
    unchecked by QA" was added); the plan file's `stats.removedDuration` / `sourceDuration` stay whole-source (nothing
    user-facing reads them).
  - **`run_auto_cut` and a hand edit during a turn:** the agent's own applies reach the next tool in the turn (step 4b), but a
    timeline edit the USER makes mid-turn is not seen until the next turn.
  - **Model behaviour / the prompt:** the `[next: …]` marker missed at step 6 turn 1 and pass 3 turn 8; the "Cut this video."
    order varies by run (editorial first then an Auto Cut offer, or Auto Cut on the first clip only then editorial alone,
    with no offer); content every run misses: 0373 112.3–122.0 (his flag 2, 9.7 s) and 0366's cross-clip retake (3.26 s).
  - **Choices inside B7 (the orchestrator's to change):** decision 13 applies only to the straddled-word retract, and a slate
    whose forward crossing is > 0.4 s of speech stays in the cut (the literal reading is a two-line change in
    `cut-snap-landing.ts` `endOutOfSpeech`); step 9 (b)'s fallback is symmetric (a retract fallback also needs named words —
    no real case takes it); the quiet-gap seek is editorial only (a Transcript delete in continuous speech keeps the user's
    words; QA still flags it, item 5's rule does not apply to text deletes); `QUIET_GAP_SEEK_S = 1.5`; the Auto Cut plan's QA
    reads the spoken keeps only.
  - Smaller: the wordless gap 0373 391.988–393.36 between an applied retake and the unchecked fluff "Okay," stays as the card
    leaves it; B3's 0373 @ 323.198 true positive now starts unchecked on its card, so that pause stays in the produced cut;
    B2's scratch preset `profiles\B2\…\youtube-long-form\preset.json` lost its `style.cut` (input drift outside B7, untouched).
- **For Hasan's real-video list:** the overlap bar (≥ 90.5 % on the applied cut) on a real pass; 0376 @ 119.084 (+14.4 dB) by
  ear. B6's next-round bar stays PROPOSED.
- **Evidence:** `C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\` — step 6 `run\` (`turns.jsonl`, `proposals-raw.json`,
  `proposals.json`, `proposals-accepted.json`, `run-summary.json`), `exit\`, `measure\`, `measure-accepted\`,
  `overlap-causes.json`, `s7-landed.json`, `s7-expected-overlap.json`; `pass2\` and `pass3\` (the same layout; pass 3 adds
  `measure-turns1-8\`); `replay\` (`b6`, `s6`, `p2`, `p2-plus-0371`, `p3`, `p3-plus-s6fillers`, `replay-summary.json`,
  `replay-split.out`; earlier rounds `replay-s9c\`, `replay-d13\`); the decision-4 kit reports `b1-compare-report.json`,
  `b2-textdel-report.json`, `b3-compare-report.json`; the gates `vitest-full.log`, `types-final.log`. Applied runs on D: (kept
  as evidence): `.vidtsx-temp/end-to-end/B7/{root,profile}`, `B7/pass2/`, `B7/pass3/`. `b-root` unchanged (every copy's
  `project.json` sha256 `EBE94FD7…123DDA` = b-root's). TESTING.md §18.13; HANDOFF `docs/studio/end-to-end/B7/HANDOFF.md`.

## 2026-10-23 — END-TO-END B6: the content measurement — the Studio assistant's real cut pass (editorial + Auto Cut) on all nine raw clips vs Hasan's `cuts.json`: **overlap 90.5 %**, the miss list, the proposed bar for the next round — DONE (a measurement; no `src/` change; verifier fix round 1 corrected the record)

- **What:** part B6 of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`, docs only). The §3 row: "Auto Cut + editorial
  on all nine clips vs `cuts.json` — proposed cut seconds ∩ his cut seconds / his cut seconds, and the spans he cut that the
  pass did not propose, listed by category"; exit "the overlap number and the miss list recorded in STATUS; the bar for the
  next round is set from this run". This is E2's content half (the join-geometry half is B1–B3).
- **The run (real input, real model):** scratch copy `C:\Users\hasan\AppData\Local\vidtsx-e2e\B6-root` (`video-14-raw`,
  copied from the shared M2) + `…\profiles\B6\profile`, CDP 9331, launcher strips every `CLAUDE*` / `ANTHROPIC*` env var.
  Provider = the app's own keyless `claude-subscription` (Agent SDK, bundled `claude.exe`, no key anywhere, no credential
  store read) — the B6 profile's default; project `settings.agent` = `{}`; cut style = **tight · default** (B2's fitted
  tight, read back in every `run_auto_cut` result). Timeline = all nine clips on V1 in raw order, 1,283.148 s, 1,820
  AssemblyAI words. Prompt typed in the Assistant tab, exactly **`Cut this video.`** Every card was captured from
  `project.json` BEFORE it was answered, then answered with a real click: Apply (fluff starts unchecked, so the accepted
  items), or **Reject all** when 0 items were accepted (0369's lone fluff card). The editor's own "Review outcome: …
  Continue with the next step." message (the `[next: …]` marker) continued every step. **17 turns, all `claude-sonnet-5-5`:**
  turn 1 typed → 7 auto turns = the editorial pass, one clip per turn (0366 → 0376; 0374 read with 0375, no cuts) → the
  assistant stopped and OFFERED Auto Cut ("I can run Auto Cut for the pauses, then plan shots and captions") → turn 9
  typed as the user: **`Yes, run Auto Cut for the pauses on all nine clips.`** → 8 auto turns, one `run_auto_cut` per clip
  → it stopped offering shots/captions (not taken). Model time (the usage rows' `durationMs`) 222.723 s editorial (turns
  1–8) + 114.441 s Auto Cut (turns 9–17) = **337.164 s**; tokens
  in 57,067 / out 17,621 / cache-read 2,524,453; the SDK's notional cost $3.89 (subscription — counts against the plan,
  not billed per token). One full pass used of the two allowed. Proposals: **39 editorial items** (27 retake, 6 filler, 4
  false_start, 2 fluff) + **261 Auto Cut items** (153 long_pause, 108 dead_air); after applying, the scratch edit is
  **8:29.1** (509.1 s, 196 clips) vs his tight **8:04**.
- **The exit number:** H = his cut seconds = raw time outside his `active_keeps` = **813.3 s** of 1,283.0 s. P = the union
  of every proposed span in source time = 775.8 s. **Overlap |P∩H| / |H| = 736.1 / 813.3 = 90.5 %**; precision |P∩H| / |P|
  = 94.9 % (**99.2 %** without Auto Cut's compressions of pauses INSIDE his keeps, 34.0 s, which his tight also compresses
  but H does not count). Accepted items only (no unchecked fluff): 90.5 % / 95.1 %. Auto Cut alone: overlap 67.8 %,
  precision 94.0 %; editorial alone: 48.4 %, 98.9 %. Per clip overlap: 0366 79.15 · 0369 93.5 · 0370 93.5 · 0371 95.9 ·
  0372 96.4 · 0373 87.0 · 0374 86.9 · 0375 90.6 · 0376 87.8 %.
- **The miss list** (H \ P = 77.2 s; spans ≥ 0.3 s = **52 spans / 42.03 s**, the other 35.18 s are slivers < 0.3 s at cut
  edges = join geometry, not content; fix round 1: two spans of exactly 0.300 s — 0376 119.084–119.384 unlisted, 0376
  122.840–123.140 pause — had been dropped by a float compare, 0.29999999999999716 < 0.3; `measure.py` now compares in
  integer ms): **retake 4 / 5.2 s** (0366 15.6–18.8 "Today everyone is building websites." — he cut ALL of
  0366, superseded by the take that opens 0369: a cross-clip retake the per-clip pass cannot see; 0373 247.9–248.4; 0375
  14.5–15.1 "The same—"; 0375 132.7–133.6 "Another take." — a slate left in) · **repeat 4 / 5.1 s** (doubled phrases whose
  first delivery stayed: 0371 31.9–33.4 "a website,", 0373 25.2–26.8 "and clean up, moves everything.", 0373 83.6–84.2 "You
  see now?", 0373 319.7–321.2 "Before it's ready,") · **manual 1 / 9.7 s** (0373 112.3–122.0 "So this boilerplate is powered
  by the Claude Code SDK…" = his judgment-call flag 2, default cut) · **dead_air 1 / 4.0 s** (0376 168.1–172.1, a phantom
  "M" token 3.8 s long: the assistant left it — "probably silence or a phantom token" — and Auto Cut did not cut it either,
  presumably keeping the token's span as speech; not traced in code) ·
  **filler 1 / 1.0 s** (0374 "okay,") · **pause 32 / 13.26 s** (inside his keep gaps, 0.30–0.64 s, median 0.38 s — around
  the style's 0.4 s internal gap) · **unlisted 9 / 3.72 s** (clip tails / cut-gap slivers).
- **False cuts** (P \ H, excluding pause-in-keep; every content piece comes from an editorial item): content at ≥ 0.3 s
  **5 / 4.05 s** (0369 "Look at this." 0.52 s = the rejected fluff card; 0370 "uh" 0.58 s; 0373 "before being ready."
  0.96 s, "Okay, great." 1.24 s = the unchecked fluff item; 0375 "Please focus." 0.76 s = his flag 4) — accepted-only
  3 / 2.30 s; counting every content piece
  (also 0371 "uh" 0.05 s and 0375 "um" 0.17 s) 7 / 4.27 s, accepted-only 5 / 2.52 s. Inside his fluff suggestions 2 / 1.25 s
  at ≥ 0.3 s (3 / 1.40 s, every piece). **Judgment calls:** his six `flags[]`, each matched to the `cuts[]`/`keeps[]` entry
  by its quoted text + clip + time — **4 of 6 land on his default**: flag 3 ("his instruction: cut", 0373 365.551–370.432)
  proposed 100 %; flags 1 / 5 / 6 (default keep: 0375 143.41 "and he's sharing his game…", 0376 69.747 "Since this project is
  a desktop application?", 0373 91.276 "Do you see this?") untouched; flag 2 (default cut, 0373 112.306–121.903, 9.7 s) not
  proposed; **flag 4 (default keep, 0375 30.500–31.255 "Please focus.") cut** — the editorial `false_start` item
  28.909–31.700 "Please focus." (accepted) covers it, plus Auto Cut 28.909–30.350 / 31.375–31.700. (Fix round 1: the first
  record matched flag 4 to the nearest keep, "it builds the app…" 32.99 s, and counted 5 of 6.) His four
  `fluff_suggestions` (suggest-only): proposed 0 / 1 / 15 / 0 % — the pass's own two fluff spans were elsewhere.
- **Also seen (findings, not fixed — B6 is a measurement):** for "Cut this video." the assistant ran the editorial pass
  FIRST and only offered Auto Cut afterwards (the prompt's "edit this video" order is Auto Cut first); the editorial snap
  left **hard entries on 8 of 42 editorial joins** (2/4, 1/2, 0/3, 0/5, 0/4, 4/12, 1/7, 0/5) vs Auto Cut's 1 of 164 —
  E2's "hard entries 0" is not met on the editorial joins; 0369's only proposal was one fluff span, so 0369 got no
  editorial cut at all. **Auto Cut ran AFTER the editorial cuts were applied but planned over each clip's whole source**
  (found by the verifier, added in fix round 1): 199.5 s of its 587.1 s fall inside already-applied editorial spans (94 of
  its 261 items wholly inside), so its card headlines count seconds already removed — 0373's card says "−171.2 s of
  396.3 s", and 85.6 s of those 171.2 s were already cut by the applied editorial items. A follow-up for the next round,
  not fixed in B6.
- **Proposed bar for the next round (Hasan confirms):** with the same run shape (one real pass, `Cut this video.` + the
  Auto Cut follow-up) — **overlap ≥ 92 %**, **retake + repeat + filler + false_start misses ≤ 6 s in total with none > 1.5 s**
  (his flagged judgment calls excepted), **false content cuts ≤ 3 s**, **precision without pause-in-keep ≥ 99 %**, **≥ 5 of
  6 flags at his default**. Reason: of the 77.2 s missed, 35.18 s are sub-0.3 s edge slivers and 13.26 s are 0.30–0.64 s
  pauses in his keep gaps, around the style's own threshold — join geometry and the style, owned by B1–B3, not by the
  editorial pass. The content misses are few and named: the cross-clip retake (3.3 s), four first-of-a-doubled-phrase
  deliveries (5.1 s, the policy's own "cut the FIRST" rule), a slate left in (0.8 s), the phantom-token dead air (4.0 s).
  Fixing just the cross-clip retake, the repeats and the phantom token adds ≈ 12.4 s → 748.5 / 813.3 = 92.0 %; flag 2
  (9.7 s) stays a judgment call, so the bar does not demand it. The **≤ 6 s** comes from the same fixes: today's retake +
  repeat + filler + false_start misses are **11.32 s** (retake 5.15 + repeat 5.13 + filler 1.04; no false_start miss); the
  fixes named for the overlap bar (the cross-clip retake 3.26 s + the four repeats 5.13 s) leave **2.93 s** (three short
  retakes 0.50 / 0.56 / 0.84 s + the 1.04 s filler), and 6 s is that remainder with ~3 s of headroom. **Today's run fails 4
  of the 5 items** — overlap (90.5 %), content misses (11.32 s; two > 1.5 s: 0366's 3.26 s retake, 0373's 1.60 s repeat),
  false content cuts (4.05 s at ≥ 0.3 s; accepted-only 2.30 s would pass) and flags (4 of 6: flag 4 cut, flag 2 not
  proposed) — and passes precision without pause-in-keep (99.2 %).
- **Gates:** `npx vitest run` **465 files / 3,920 tests passed** (5 / 34 skipped) on the first run, app stopped, log
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B6\vitest-run1.log`; `npm run check:types` web 26 / node 10 (baseline 26 / 10);
  the live click-through IS the run (17 real turns, every card answered by a real click). Editor repo untouched
  (`tools/__pycache__` newest 2026-10-16; `measure.py` runs cutlib `python -I -B`, read-only); `b-root`'s `project.json` hash
  unchanged (`ebe94fd7…`). Evidence: `…\vidtsx-e2e\B6\run\` (`turns.jsonl` = every turn's prompt, reply, tool calls, usage;
  `proposals-raw.json` = the 17 cards as captured; `proposals.json` / `proposals-accepted.json`), `…\B6\measure\measure.json`
  + `…\B6\measure-accepted\measure.json` (round 0, kept); kit (gitignored) `.vidtsx-temp/end-to-end/B6/` (`run.mjs`,
  `measure.py`, `launch.sh`, `cdp.mjs`, `probe.mjs`, `restore.ps1`). TESTING.md §18.12; HANDOFF
  `docs/studio/end-to-end/B6/HANDOFF.md`.
- **Fix round 1 (2026-10-23, verifier FAIL on the record, not the measurement):** docs + the gitignored `measure.py` only —
  0.3 s compared in integer ms; flags matched by quoted text + clip + time (no nearest-entry fallback); new outputs
  `miss_summary`, `false_by_label_min` (≥ 0.3 s), per-category min / median / max, `flags_at_default`; selftest adds the
  boundary and the six flag entries. Re-run on the SAME capture (`proposals.json` = `proposals-raw.json` derived, 300 = 300
  items identical; `proposals-accepted.json` = raw minus the 2 unchecked fluff items) → `…\B6\measure-fix1\measure.json` +
  `…\B6\measure-accepted-fix1\measure.json`: H / P / P∩H / overlap / precision unchanged; misses 52 / 42.03 s; flags 4 of 6.
  No new model run, no app launch, no `src/` change → the gates above are unaffected (not re-run).

## 2026-10-22 — END-TO-END B5: the Transcript tab (`studio-text-edit`) on the long raw recording — automated pre-pass, four bugs fixed, Hasan's station + by-ear checklist, the flip and a backfill fix prepared (NOT applied); verifier fix round 1 (close / quit during a `project.json` lock) in — DONE up to Hasan's step — exit DEFERRED to Hasan's real-video test (2026-10-23)

- **What:** part B5 of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`; code `fb32ab1` → `aa58ee8` → `e69d182`,
  fix round 1 `750c0d0`; station + checklist `8bf5433` → `3e7a285`). The §3 row: "`studio-text-edit` on in production after Hasan's pass on M2
  (AssemblyAI transcript, by ear, long project)", exit "his pass clean; flag flipped". Both halves of the exit are
  Hasan's; B5 built and verified everything up to them — the machine's half of the pass on the long project with real
  mouse and keyboard over CDP on an isolated profile, the bugs it found fixed (tests first), his station and checklist
  (walked literally), the flip and the backfill alternative written down and NOT applied.
- **Material / the long project:** M2 `video-14-raw` (nine raw DJI clips 3840×2160 59.94 fps in a 60 fps project, v3
  waveforms, Hasan's AssemblyAI transcripts mapped through Studio's `AssemblyAiProvider.mapJob`, 27/44/97/207/183/602/40/
  330/290 = **1,820 words**) on the scratch copy `C:\Users\hasan\AppData\Local\vidtsx-e2e\B5-root` + `…\profiles\B5\profile`
  (CDP 9321). Long project = all nine clips on V1 in raw order, nothing cut, speed 1 → **1,283.148 s, toolbar `/ 21:23.09`**.
- **Open and read:** header **"1,820 words"**, 192 takes; tab click → all 1,820 words in the DOM in **405 / 139 / 241 ms**,
  first paint **563 / 231 / 360 ms** (three cold mounts — the pane unmounts on a tab switch). Every token vs Hasan's raw
  AssemblyAI JSON: 1,820 = 1,820, AssemblyAI's text kept (291 punctuated, 268 capitalised), a 27-word time table equal;
  after the UTF-8 fix **0 text mismatches** (the only differences left are the 76 backfilled starts, below).
- **Seek / karaoke / scroll:** a real click on the first / middle / last word of every clip → **27/27 playhead frame =
  round(word start × 60), 0 frames off**, the word lit; the clip's video within −14…+16 ms of the word (≤ one source
  frame). Karaoke, 12 s from words 900 and 1700: **0 mismatched frames** (rAF p50 16.7 / p95 17.1 ms); played past the
  bottom of the view (20 s from word 776): the lit word out of view on 1 of 1,155 frames, 36 auto-scrolls. Wheel scroll
  of the whole document (11,846 px) top → bottom in 3.3 s: p95 29.9 ms, 0 long tasks.
- **Ten delete cases** (real drag, or click + real SHIFT+click; real Delete key; each from the original timeline): inside
  0371 (6 words, `Removed 6 words · −4.0 s`), across 0372 → 0373 (6 words, two pills, four tagged edges), one short word
  ("one" 65 ms, `−0.1 s`), the first word of 0370, the last word of 0374, a long selection 0373 709–777 (**69 words, `−62.5
  s`**, exact), and four single short words whose start the backfill moved (bf1–bf4, `−1.0 / −3.2 / −2.2 / −2.9 s`).
  **Every one:** ONE undo step, redo exact, the cut edges the RESOLVED tight style's (B2), both new edges tagged
  `'text-delete'` (B4), Restore by a real click → length 1283.148, per-asset source cover == original, doc text ==
  original; Ctrl+Z back to the original on disk.
- **Fillers:** AssemblyAI in verbatim mode DOES emit them on M2 — **um ×3, uh ×12** (counted in the raw JSON = what the
  tab tints). "Remove 15 fillers" → **13 cut in one undo step, −13.8 s** (1283.148 → 1269.354, 22 clips); 2 "uh" sit
  inside their neighbours' pads ("too tight to cut cleanly") and stay; one 0373 "Uh" takes its 4.5 s pause with it
  (`¶ 7.0s`, the tight style's edges — on Hasan's listening list).
- **Read-only while an Auto Cut review is open** (real Media → tile → Auto Cut): banner "A review is open — apply or reject
  it to edit by text.", the bar's Delete and "Remove 14 fillers" disabled, the Delete key changes nothing on disk, an
  opened pill shows no Restore, a word click still seeks frame-exact; "Reject all" → editable. **Save + reopen:** two
  deletes, "Back to projects", reopen → 1,808 tokens, both deletions and 4 `'text-delete'` tags intact; both restored by
  real clicks AFTER the reopen (no in-memory history) → 1283.148 s, 1,820 tokens.
- **The four bugs fixed (tests first, red before each):** (1) **UTF-8 `fb32ab1`** — all 32 em-dash words (`39—` …) showed
  as mojibake (`atob` → one char per byte); NEW `cache-text.ts` `decodeBase64Utf8` (`TextDecoder`), every `atob(` → text
  path in `src/features/studio` goes through it (`cache-text.test.ts` 5, `useAssetTranscripts.test.ts` 2). (2) **Autosave
  retry `aa58ee8`** — a Windows `rename` refused while another process held `project.json` (EPERM) left the edit unsaved
  with nothing retrying, so memory and disk diverged (builder #2's "2× long delete" = two correct deletes on top of a
  failed save): main `renameWithRetry` (EPERM/EBUSY/EACCES, 8 tries, ≤ 1.4 s), renderer `createAutosave` (a refused or
  thrown save stays dirty and retries at 1/2/5/10 s, a flush waits for it; after 3 failures a persistent red
  "Save failed — retrying"; `[data-save-state]` on the indicator). Live with a held lock and the editor open: 6 s → saved
  at 10.4 s with no further edit; 14 s → the error at 9.9 s, saved at 15.5 s (`rename-retry.test.ts` 5,
  `project-store.test.ts` +2, `autosave.test.ts` 8). **Closing or quitting DURING a lock was not covered by `aa58ee8`:** its
  close flush gave up ~7.3 s after the close and dropped the edit — a 4 s lock landed, but the verifier's 10 s lock with
  the close at +2.3 s (and a quit at +2.0 s) lost it, leaving a `project.json.tmp` nobody read. Fixed in fix round 1
  (`750c0d0`, next bullet). (3) **Restore into view `aa58ee8`** — an opened deletion pill near
  the bottom put its Restore 14 px below the visible body; it now scrolls into view on open (`DeletionPill.test.ts` 4).
  (4) **Filler toast `e69d182`** — "Removed 15 fillers" when 13 were cut; `TextDeletePlan.removedTokens` counts the words
  of the runs really cut (`text-delete.test.ts` +3). 29 new tests over the part before the fix round.
- **Verifier round 1 → fix round 1 (`750c0d0`, tests first): close / quit while another program holds `project.json`
  no longer loses the edit.** A closing editor (and the window's quit-flush request) hands its unsaved document to MAIN
  in one IPC call (`studio:project:handoff`); main's NEW `project-writer.ts` owns the write from then on — one writer per
  project, serialized, retries in the background at 1/2/3/5/10/15/30 s for up to 10 min (logged; a reopened editor's save
  supersedes it); on quit `shutdown.ts` drains pending writes for at most 4 s, else the `.tmp` stays. NEW
  `project-recovery.ts`: on open, a `project.json.tmp` that parses as a project and is newer than `project.json` is
  finalized (or opened unsaved while still held) and the editor toasts **"Recovered unsaved changes"** once; an older or
  corrupt `.tmp` is moved aside as `project.json.tmp.ignored-<time>` (kept, logged, not loaded). Unit: `project-writer.test.ts`
  (the verifier's model — real `createAutosave` + real `renameWithRetry` vs a 10 s hold, close at +2.0 / 2.3 / 3.0 / 6.2 s →
  lands; give-up bound; quit → `.tmp` → recovered once; recovery on real files), `autosave.test.ts` +4 (`takeUnsaved`),
  hook-level `useStudioProject.test.ts` 5 + `useTextEdit.test.ts` 1 (reverting either wiring now fails them).
  **Live on B5-root (CDP 9321, real double-click on "uh" (i165) + real Delete key, PowerShell holding `project.json` with
  no sharing for 10 s, disk polled every 250 ms):**

  | case | edit applied | close / quit | result | main log |
  |---|---|---|---|---|
  | no lock, close | +0.79 s | "Back to projects" +1.01 s | edit on disk +1.27 s (first poll), no `.tmp` | "Handed-off project save landed" (attempt 1, 4 ms) |
  | **10 s lock, close (the verifier's case)** | +1.49 s | "Back to projects" +2.34 s | lock released +10.09 s → **edit landed +10.31 s**, `.tmp` gone, 10 clips / 1282.568 s | warn "…refused — retrying in the background" (EPERM) +5.03 s; "…landed" attempt 3, 7,974 ms after the hand-off |
  | no lock, quit (real WM_CLOSE) | +0.65 s | +0.74 s | edit on disk +1.00 s, app gone +1.07 s; relaunch: no toast | "…landed" (attempt 1, 3 ms) |
  | **10 s lock, quit (real WM_CLOSE)** | +1.67 s | +2.02 s | app gone +7.25 s (5.2 s: 4 s drain); `project.json` untouched, `.tmp` = the edit; **relaunch → "Recovered unsaved changes" once**, `project.json` = the edit, `.tmp` gone; reopen → no toast | warn "…refused" +3.52 s; warn "Quit while a project save was still refused — project.json.tmp is recovered on the next open" +6.97 s; open: "Recovered unsaved changes from project.json.tmp" |
  | no lock, quit (`window.close()`) | +0.60 s | +0.68 s | edit on disk +0.95 s, app gone +0.96 s; relaunch: no toast | — (a plain save, below) |
  | **10 s lock, quit (`window.close()`)** | +1.58 s | +2.01 s | `.tmp` written +2.27 s, app gone +4.09 s; `project.json` untouched; **relaunch → "Recovered unsaved changes" once**, the edit on disk, `.tmp` gone; reopen → no toast | open: "Recovered unsaved changes from project.json.tmp" |
  | older `.tmp` (valid project, `updatedAt` 2020) | — | open | moved aside `project.json.tmp.ignored-…`, bytes equal, NOT loaded (1,820 words), no toast | warn "Ignored project.json.tmp — kept aside" (older than project.json) |
  | corrupt `.tmp` (cut-off JSON) | — | open | the same | warn … "not a usable project (Unexpected end of JSON input)" |

  A page-script `window.close()` skips the BrowserWindow `close` event (the flush guard): the `beforeunload` flush saves
  instead, and a refused one survives through the `.tmp` + recovery. The app never calls it (native frame on Windows; X,
  Alt+F4 and the taskbar send WM_CLOSE = the hand-off path). B5-root's `project.json` written back byte-equal afterwards
  (`…\vidtsx-e2e\B5\fix1-live\`, still `…\B5\stills\b5-fix1-after-lock-quit-wm.png`).
- **The 2026-09-17 open items on this material:** clip speed is 1 on all nine clips (the `trimClip` / `trimClipRippleAll`
  / `applyCutProposal` speed debt does not apply); Hasan's AssemblyAI words hold **0 zero-duration words** (the captions'
  durationless-word drop does not bite here — it stays open for whisper).
- **The backfill question (for Hasan's ears) and its prepared fix:** `withSpokenSpans`
  (`src/features/studio/services/transcript-doc.ts`) gives a word stamped < 50 ms the silence before it (≤ 1 s) — written
  for whisper.cpp's 0–20 ms stamps — and it also fires on AssemblyAI: **76 of 1,820 starts move earlier, 25 by ≥ 0.5 s**;
  in 33 of the 37 gaps ≥ 150 ms the RMS peaks ≥ 15 dB over the floor, so whether the word sits there is a listening
  question (a click seeks up to 1 s early; deleting one such word cut 0.7–3.6 s of source). HASAN-STEP part A puts 8 of
  them to his ears. **Prepared, NOT applied: `docs/studio/end-to-end/B5/backfill-fix.patch`** (code + test): backfill by
  the transcript's engine — whisper (or none recorded) keeps it, AssemblyAI / ElevenLabs words stay as delivered. A
  duration rule cannot separate them (whisper's "the" is 20 ms, AssemblyAI's "a" 16 ms: "≤ 20 ms" would still move 28 of
  the 76, W5's 708 ms among them). On M2's real words the patch leaves **76 of 76 at their own start** (0 moved;
  `…\vidtsx-e2e\B5\backfill\count.json`). Red first on HEAD (`2 failed | 16 passed`), `git apply --check` clean on HEAD
  (it also applies to a CRLF checkout), the patched tree: `transcript-doc` + `text-delete` 35/35, `src/features/studio`
  49 files / 436 tests, types 26 / 10. `docs/studio/end-to-end/B5/.gitattributes` keeps the patch LF (a CRLF copy does
  not apply to this checkout's LF files).
- **Hasan's station:** `C:\Users\hasan\AppData\Local\vidtsx-e2e\B5-station-root` + `…\profiles\B5-station\profile`, the same
  long project (`/ 21:23.09`), `settings.agent.providerId = "b5-no-model"` (no model call possible), start snapshot
  `…\vidtsx-e2e\B5\station-start\project.json` (sha256 `2cfaf220…`); launcher `docs/studio/end-to-end/B5/hasan-station.ps1`
  (this branch's dev build on the station profile only; `-Reset` backs his project up, then restores the snapshot).
  Opened once through the launcher, read-only — hash unchanged. **`docs/studio/end-to-end/B5/HASAN-STEP.md` walked
  literally** with real input on the scratch copy: part A 8/8 clocks exact, part B 11/11 (bar count = toast count, the
  kept text around each join as written, 1283.148 → 1156.398 s), part C restores + undo/redo, part D "Remove 9 fillers" →
  `Removed 8 fillers · −12.0 s (1 spot too tight…)`, back to the original with 15 Ctrl+Z. Fix round 1 (the verifier's
  wording notes): D5 names which of the two "So here's what I did. I created" is kept (the one followed by "a starter",
  `06:08.40`) and where the selection ends (`06:07.27`); D2's selection includes the "Other take." that opens the 3:49 take
  (`03:49.35`–`03:49.51`); part A's stamps read "16–49 ms" (W8 "How" is 49 ms) — clocks from the station's own document.
- **The flip, prepared NOT applied:** the only production gate is `src/shared/feature-flags.ts:73` (`'studio-text-edit':
  false`, read at `EditorShell.tsx:110`; dev builds force plain flags on) → `true` + the comment `:68-72`; commit message
  `feat(studio): Transcript tab on in production (studio-text-edit) after the B5 by-ear pass on M2` — in HASAN-STEP.md.
- **B4 doc debt (decision 6):** B4's row above and TESTING §18.10 said "zoom in 4× (320 px/s)" — now "zoom in until the +
  magnifier greys out (at least 320 px/s = 4 clicks from the opening zoom, 5–6 from Zoom to fit)", as B4/HASAN-STEP.md.
- **Gates:** full `npx vitest run` (app stopped; C: 17.7 GB → no exclusion) **first run green: 462 files / 3895 tests
  passed, 5 / 34 skipped, 46.8 s** (`C:\Users\hasan\AppData\Local\vidtsx-e2e\B5\vitest-full-builder8-run1.log`; also green
  after each code commit — builders #4 and #5); `npm run check:types` web 26 / node 10 = baseline. Live CDP click-throughs
  on isolated profiles throughout (above). **Fix round 1:** after `750c0d0` full run 3 `--maxWorkers=4` green (465 / 3920;
  runs 1–2 hit the DRIVING.md load timeouts `shot-module-resolver` / `flow-render`, each green alone); after the live
  re-check (app stopped, C: 16.5 GB → no exclusion) **full `npx vitest run` first run green: 465 files / 3920 tests passed,
  5 / 34 skipped, 50.8 s** (`C:\Users\hasan\AppData\Local\vidtsx-e2e\B5\vitest-full-fix1-builder10-run1.log`); types 26 / 10.
  25 new tests in the fix round (`project-writer.test.ts` 15, `autosave.test.ts` +4, `useStudioProject.test.ts` 5,
  `useTextEdit.test.ts` 1).
- **THE EXIT WAITS FOR HASAN: his by-ear pass per `docs/studio/end-to-end/B5/HASAN-STEP.md`, then his flag flip.**
  (~55–60 min) From `D:\repos\VidTSX-STUDIO`: `powershell -ExecutionPolicy Bypass -File
  docs\studio\end-to-end\B5\hasan-station.ps1` → Studio → `video-14-raw` → Transcript tab; part A (8 short words: does the
  highlight start early? does deleting it eat sound before the word?), part B (11 kept deletes — retakes, a stutter, a
  filler by hand, a word inside a sentence, a phrase, across two clips — each played across its join), part C (restore +
  undo), part D ("Remove 9 fillers"). "Clean" = no clipped word start or end, no click, no word lost or doubled, a
  natural pause, Restore exact. Then the flip (the one-line diff in HASAN-STEP.md) — and, only if part A sounds wrong,
  `git apply docs/studio/end-to-end/B5/backfill-fix.patch` first.
- **Honest notes:** the flag is still `false` (production hides the tab) and the backfill patch is not applied, so the
  station runs the backfill as it is; ElevenLabs transcripts are unverified either way (none in this material — the
  patch leaves them as delivered; adding `'elevenlabs'` to its one set restores the backfill for them); the patch takes
  `transcript-doc.ts` from 290 to 305 lines and reads `engine`, which the `StudioAssetTranscript.features` comment asks
  consumers not to branch on — no `features` flag says "durationless words"; `EditorShell.tsx` stays far over ~300 lines
  (pre-existing).
- **2026-10-23 — exit deferred:** the by-ear pass was not run (Hasan's decision, quoted in the B4 entry's 2026-10-23
  bullet below); `src/shared/feature-flags.ts` `studio-text-edit` stays `false`;
  `docs/studio/end-to-end/B5/backfill-fix.patch` stays unapplied; the B5 station is untouched (its `project.json` still
  equals the start snapshot); the pass + his two calls (apply the patch, flip the flag) move to his real-video test.

## 2026-10-22 — END-TO-END B4: the learning signal — snapped span beside the final span; user trims and Transcript deletes tagged; learn-from-video measures the joins and proposes the cut knobs — DONE up to Hasan's step, fix rounds 1–2 in — exit DEFERRED to Hasan's real-video test (2026-10-23)

- **What:** part B4 of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`; code `92d846f` → `c5a6f4c` →
  `2865675` → `f39a220` → `a734ff5`), the plan's §2 T1 "The learning signal". **The signal** (optional fields only —
  old projects / proposals / presets open untouched): every cut-plan proposal item keeps its `snapped` span beside
  the user's final span (written by both creators, Auto Cut / `run_auto_cut` and the editorial snap /
  `propose_cuts`, and kept from the pre-drag span on the first drag); a user trim tags the moved edge
  `origin.edges[edge] = 'trim'` (`by` / `proposalId` kept, so learn stats still count who placed the clip); a
  Transcript delete tags the edges it creates `'text-delete'` (not a sample until the user trims it); split / range
  delete / ripple / restore drop the tags of edges they rewrite; undo restores the untagged clip. **The measurement**
  (pure, `src/shared/studio/cut-learn*.ts`): at every touched edge, tail = edge − last word end and its level over
  the floor (the snapper's 50 ms window), lead-in = first word start − edge, each beside the RESOLVED style's own
  edge at that join (B2's resolver); Q4 gate per knob (since fix round 1) — ≥ 10 edges on its side AND |fitted −
  current| > 30 ms (margin: > 1 dB). **The learn path:** `StudioPresetKnobKey` widens to `cut.head` / `cut.minTail` /
  `cut.maxTail` / `cut.margin`; `propose_preset_update` and Inspector → PROJECT → "Learn from this video" (same
  code, every number computed in code) put the knob rows + cut lines + a collapsible per-join list on the learn card
  (NEW `CutLearnBlock.tsx`); accept writes `style.cut` through `applyPresetLearning` (base kept; a value equal to
  the base's drops the override; B2's `cutSpecProblems` refuses an invalid result). No preset → "no editing preset to
  learn into", nothing saved (the existing pattern; the project override is not a save target).
- **Why the card FITS instead of taking a raw median (ruling 1):** the snapper's tail is not a knob value — with the
  fitted tight (minTail 0.08, margin 12) the tails it keeps run ~0.14–0.22 s and land a few dB UNDER floor + 12 (its
  20 ms walk stops at the first window at or below the line), so a raw median would propose minTail ≈ 0.2 s (the
  stand-in's median tail is 0.22 s — far outside 0.08 ± 0.03) and a margin read off landings that sit at or under
  the line. The values come from an L1 fit through the snapper's own rules (it equals the median where the rule is a
  constant, as for the lead-in); the gate is on the fit (|fitted − current|, per knob), the medians are shown, not gated
  on. The card shows both: "you kept a
  median 0.22 s after the last word, cut 11.4 dB over the floor (the style: 0.4 s, 6 dB); minTail 0.08 s and margin
  12 dB reproduce your edges". **`maxTail` is only ever raised** (ruling 8: identifiable only up to the longest tail
  kept; the card says "at least N s"; a test fails without the guard). **`softGap` is not learned** (not one of
  T1's four): Hasan's 10-15 "soft landings off" stays a style choice — a follow-up if he wants it learned.
- **The stand-in exit, live on M2 (CDP 9301, the reused scratch `vidtsx-e2e\B2-root` + `profiles\B2\profile`; no
  model call — the project's provider id `b4-no-model` is registered by nothing, proven "not registered" before the
  click):** start = the old pre-October tight on a scratch PRESET (ruling 7: `style.cut = {base:'tight', head 0.11,
  minTail 0.14, maxTail 0.4, margin 5}`, softGap 99) → Auto Cut + apply on 0369 / 0370 / 0371 (7 / 15 / 31 cuts,
  `snapped` on every item) → Act 1 = the raw span behind preview-tight 0:00–1:55 mapped through `cuts.json`'s keeps →
  47 joins on V1, 28 sentence joins, **the first 21 trimmed** (39 edges, through the reducer's `'trim'` that the
  edge drag dispatches, ripple all) to the fitted tight's own edges → "Learn from this video" → **`Cut lead-in 0.11 →
  0.15`, `Cut tail min 0.14 → 0.08`, `Cut margin 5 → 12`** (`Cut tail max 0.4 → 0.5`, "at least"), "learned from 21
  joins you trimmed (19 lead-ins, 20 tails)" — **Δ 0 / 0 / 0 vs the exit's 0.15 / 0.08 / 12.** Accept → the preset's
  `style.cut` = `{base:'tight', maxTail:0.5}` (back to base tight's values, before/after recorded). One live defect
  fixed: the per-join list rendered 420 px wide in the ~200 px Assistant column → stacked rows (`a734ff5`).
- **The negatives** (the REAL `propose_preset_update` handler on the stand-in's M2 data — real v3 waveforms and
  transcripts, no model): all 39 tagged edges at the START style's own edges (±≤ 10 ms) → **0 cut changes at 21
  joins** (medians +0 ms lead-in, +0 ms / +0.1 dB tail); tags on 9 joins only → **0 changes** + "Learned from 9 joins
  — at least 10 touched joins are needed before the cut knobs change."; as trimmed = the live card exactly.
- **Hasan's station (ready, click-checked, at its start state):** Studio root `C:\Users\hasan\AppData\Local\vidtsx-e2e\B1-verify-root`
  + profile `…\vidtsx-e2e\profiles\B1-verify\profile` (scratch; never his own profile or projects); V1 = his own
  `cuts.json` keeps of 0369 / 0370 / 0371 to the Act-1 cut-off (retakes out) planned with the old tight → **36 clips,
  33 joins, 1:46.8** (the planner also splits keeps at internal pauses, so a few joins are mid-sentence); preset "B4
  start — old tight" with the flat knobs zeroed (the card shows cut rows only). In-memory dry run (nothing written):
  every join trimmed to the fitted tight's edges through the REAL reducer + handler → **33 joins (30 lead-ins, 30
  tails) → head 0.15 / minTail 0.08 / margin 12** (maxTail ≥ 0.5), no flat rows. Launched once through
  `docs/studio/end-to-end/B4/hasan-station.ps1 -CdpPort 9311`: project opens, ripple lit, readout `tight + 4
  overrides · preset “B4 start — old tight”`, one trim tagged and undone; app stopped, station reset (`-Reset`).
  Re-read on disk at step 7: provider `b4-no-model`, preset `b4-start-old-tight`, V1 36 / A1 0, 0 proposals, 0
  tagged clips, preset `style.cut` = the old tight, `learned[]` empty.
- **FIX round 1 (after the B4 verifier's round-1 FAIL, 2026-10-22):** (1) **HASAN-STEP.md** now says to turn **Snap
  off** before the first trim (the magnet "Snap to edges and playhead" is ON at every editor open,
  `TimelinePanel.tsx:95`; it pulls an edge to any clip edge within 8 px, and the neighbour's edge sits where the dragged
  edge started, so a small trim snapped back — no edit, no tag) and to **zoom in** at each join (playhead on the join,
  Zoom in 4–5× from the default 20 px/s: 320 px/s = 30 ms ≈ 10 px, 640 px/s ≈ 19 px), how to see a trim took (that
  check was WRONG for lead-ins — replaced in fix round 2, below), and that a missing `Cut lead-in` row means the fit sat ≤ 30
  ms from 0.11 (read "head X s" off the Lead-in line); time now ~25–30 min. (2) **The head gate (orchestrator
  decision):** each knob is proposed when ≥ 10 edges on its side AND **|fitted − current| > 30 ms (> 1 dB for
  margin)** — no longer on the median offset from the style's own edges, which joins where the onset rule gives both
  styles the same lead-in dilute (`src/shared/studio/cut-learn.ts`; the card still shows the medians and the fitted
  values). Seeded ±40 ms jitter on the **station's real 33 joins** (`.vidtsx-temp/end-to-end/B4/jitter.b4.test.ts`,
  `B4_JITTER=1`, the learn path's own loaders read-only, 10 seeds; `…\vidtsx-e2e\B4\jitter-station.json` /
  `jitter-station.old-gate.json`): head proposed **old gate 2/10 → new 9/10** (±30 ms 4 → 10/10, ±20 ms 7 → 10/10;
  first 21 joins ±40 ms 4 → 8/10); fitted head 0.13–0.16 in every run; own (start) edges ±20 / ±40 ms → head 0/10
  both gates, one tail false positive at ±40 ms (minTail 0.14 → 0.10, seed 8). **Not fully closed:** the start head
  0.11 is only 40 ms under 0.15 and Q4 proposes only moves > 30 ms on the 10 ms knob grid, so a fit of 0.13 / 0.14
  (inside 0.15 ± 0.03) is NOT proposed — the misses above are exactly those; unit test over 40 synthetic seeds: fit in
  0.15 ± 0.03 in 40/40, proposed in 32/40 (it fails under the old gate). (3) The card no longer says "Knobs unchanged —
  the edit matched the preset" above cut lines (now "No knob changes proposed — the cut lines below say what was
  measured"; PRESET.md: "no knob moved past the learning thresholds"); a join whose head was dragged on the proposal
  and whose tail was trimmed counts once (`collectCutLearnJoins` merges the drag into the trim join). Station
  untouched (data, not code).
- **FIX round 2 (after the B4 verifier's round-2 FAIL, 2026-10-22; docs + one card line):** the round-1 "check each
  trim took" was WRONG for lead-ins — with ripple on, a lead-in trim slides the clip back so its edge returns to the
  join (`ripple-ops.ts:266-279`); only the waveform and the timeline total move. **HASAN-STEP.md §2 now:** Snap off
  FIRST (before the playhead is placed — with Snap on a small drag can snap to the playhead, which stands on the
  nearest frame, and commit a few-ms trim); per join: ruler click → zoom in until the + magnifier greys out (640 px/s,
  the top; at least 320 px/s = 4 clicks from the opening 20 px/s, 5–6 from Zoom to fit — aligned with B4/HASAN-STEP.md
  in B5; at the top the join can sit at the viewport's right edge: scroll it back) → read the toolbar total `/ MM:SS.FF` (frames, 60/s) → drag from the clip's **lower
  half** (found live: the 12 px "Add transition" square sits on every join at mid-height and the 9 px "Fade in/out"
  dots in the top corners — grabbing them does not trim) → **the total moves by about the trim for BOTH edges** (30–50
  ms = 2–3 frames; tail edge stays where dropped, lead-in edge comes back to the join — normal); unchanged = drag
  again; too much = Ctrl+Z. The join table's times are seconds while the clock shows frames (0:10.25 = `00:10.15`).
  **Live, real mouse (CDP `Input.dispatchMouseEvent`) on the scratch B2-root laid out as the station (36 clips), Snap
  off:** lead-in −41 / +41 ms at 320 px/s → total `01:46.47 → 01:46.50 → 01:46.47`, edge x 356 → 356 (back at the
  join), `sourceIn` 20.450 → 20.409 → 20.450, tag `edges.start: 'trim'`; tail +50 / −30 ms at 640 px/s → `01:46.47 →
  01:46.50 → 01:46.48`, edge x 352.8 → 384.8 → 365.8, end 10.245 → 10.295 → 10.265, tag `edges.end: 'trim'`; lead-in
  ∓41 ms at 640 → `01:46.48 → 01:46.51 → 01:46.48`; **a failed trim** (Snap on, playhead away, 4 px) → total
  unchanged, disk unchanged, no tag — the doc's cue. Grabs on the square / a fade dot changed nothing (pointer target
  logged). The card shows the stats sentence once when there is no summary model (`PresetUpdateCard.tsx:66-71`).
  Verifier round 2's numbers, recorded: rule (a) on the station's real 33 joins with seeded jitter **40/40 (±20 ms),
  40/40 (±30), 39/40 (±40 — the miss is minTail fitting 0.04)**; own-style false positives **0/40 at ±20 / ±30, 5/40
  at ±40 (minTail only)**. Gates: full `npx vitest run` (no exclusion, C: 19 GB) **first run green: 457 files / 3866
  tests passed, 5 / 34 skipped, 51.9 s** (`…\vidtsx-e2e\B4\vitest-full-fix2-run1.log`); types 26/10. Hasan's station
  was only read (its 36 start clips copied into the scratch B2-root's project).
- **THE EXIT WAITS FOR HASAN** (the §3 row: "after Hasan re-does his 21 Act-1 joins on M2, the card proposes `head`,
  `minTail`, `margin` within ±30 ms / ±1 dB of the fitted tight"). What he must do — **`docs/studio/end-to-end/B4/HASAN-STEP.md`**
  (~25–30 min): from `D:\repos\VidTSX-STUDIO` run `powershell -ExecutionPolicy Bypass -File
  docs\studio\end-to-end\B4\hasan-station.ps1` → Studio → `video-14-raw` (V1 = 36 clips, 01:46.47, ripple buttons
  lit) → **Snap off FIRST, then per join: playhead on it, zoom in until the + magnifier greys out (4 clicks from the
  opening zoom reach 320 px/s, 5–6 from Zoom to fit), drag an edge from the clip's lower half, check
  the toolbar total moved by about the trim** (a lead-in edge comes back to the join with ripple on — normal) → trim
  each sentence join the way he wants it (about 21 of the 33 listed) by dragging clip edges only — no splits, deletes or
  Transcript edits → nothing selected → Inspector → PROJECT → **Learn from this video** (not the Assistant chat; leave
  the Provider dropdown alone) → Assistant tab → **pass rule (a), per knob (orchestrator, 2026-10-22): the row is
  proposed with its new value in range, OR the row is missing and the card's fitted value for that knob is in range**
  — `Cut lead-in` / head 0.12–0.18, `Cut tail min` / minTail 0.05–0.11, `Cut margin` / margin 11–13; the record says
  which case each knob was (a fit inside the range but ≤ 30 ms from the start value is Q4's threshold working as
  specified). Screenshot the card or note the three numbers + "learned from N joins", then tell Claude. `-Reset` restarts the station (saving his trims first under `…\vidtsx-e2e\B4\station-runs\`).
- **Gates (fix round 1, C: 19 GB free → no exclusion):** `npx vitest run` run 1 red only on the NEW 40-seed jitter
  test timing out at 5 s under the suite's load (my own test; given a 60 s timeout, 11/11 alone) → **run 2 counted:
  457 files / 3866 tests passed, 5 / 34 skipped, 43.1 s** (`…\vidtsx-e2e\B4\vitest-full-fix1-run*.log`); types 26/10.
  The M2 negatives (`negatives.b4.test.ts`) re-run: unchanged outcomes (as-trimmed = the four changes; own-style → 0;
  9 joins → 0 + the "at least 10" line).
- **Gates (build):** `npx vitest run --exclude src/main/services/python-models/service.test.ts --maxWorkers=4` — **run 2 is
  the counted run: 456 files passed, 5 skipped; 3852 tests passed, 34 skipped, 96.0 s** (app stopped; log
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\vitest-full-run2.log`). Run 1 (same command, log `…\B4\vitest-full.log`)
  had 2 failures, both on DRIVING.md's known-load list — `flow-render.test.ts:255` (the 1 s `vi.waitFor`) and
  `shot-module-resolver.test.ts:151` (its 1 s background-write poll, "never written") — both passed alone (`…\B4\vitest-alone-run1.log`,
  2 files / 15 tests). **`python-models/service.test.ts` was EXCLUDED for disk** (DRIVING.md "Vitest gate while C:
  is low": C: 2.26 GB, D: 4.98 GB free before the runs; the branch never touches `python-models/`); `--maxWorkers=4`
  because the CPU sat at 100 % from other sessions. `npm run check:types` web 26 / node 10 = baseline. New tests over
  the part (38): `cut-learn.test.ts` (9), `cut-learn-joins.test.ts` (9), `clip-edit-tags.test.ts` (12, through the
  real reducer), `agent-tools/preset-tools.test.ts` (5, the REAL `propose_preset_update` + accept handlers, real
  `cut-style.json` and preset store), `preset-knob-apply.test.ts` (3), plus `snapped` cases in `cut-proposal` /
  `editorial-cuts` tests.
- **Honest notes:** joins the user never touches teach nothing; counts are per side (head edges → `head`, tail edges
  → the tail knobs) and the card's "joins" = joins with ≥ 1 measured edge; all tails are fitted as punchy landings
  (under a small `softGap` the report says how many landed soft); accept takes every change on the card, `maxTail`
  included; with a project override the card measures against the override but accept teaches the preset (the card
  says so). The stand-in preset (copied from YouTube long-form) also moved eight flat knobs on accept — the existing
  flat learning against a bare timeline, not B4; the station's preset has them zeroed. The stand-in's targets are the
  fitted tight's own edges (Hasan's 21 individual 10-15 edits are not recorded anywhere), so the real proof is his redo.
  `AgentPanel.tsx` grew to 425 lines (420 before B4) and `EditorShell.tsx` by one line (1,646) — both pre-existing
  far over ~300.
- **Open (follow-ups, not blockers):** a per-knob opt-out on the learn card; learning `softGap` if Hasan wants it;
  the Inspector's AI Assistant "Provider" dropdown shows "App default (active provider)" for an unregistered provider
  id (display only); the ripple mode lives in renderer `localStorage`, not in the project. Also in this commit, the
  B3 doc debt (decision 7): the B3 row and TESTING §18.9 now say eight clips with keeps (not nine) for the hand plan,
  add the 133 vs 134 joins flip (0373 seg 17), and replace "audition starts ~0.2 s early" with the toolbar-clock
  misread (the audition plays ±0.99 s, as designed). TESTING §18.10.
- **Next:** the orchestrator marks B4 `WAITING-HASAN` (his step above) and continues; the B4 verifier is the
  orchestrator's call.
- **2026-10-23 — Hasan's station attempt; exit deferred:** on the B4 station he trimmed 14 joins (3 lead-ins, 13 tails)
  **by the waveform's look, not by ear**; the card proposed `Cut tail min (s) 0.14 → 0.01` and `Cut margin (dB) 5 →
  21.5` (median tail 0.096 s, +17.9 dB over the floor at 13 joins; the start style 0.4 s / 5.9 dB), no lead-in row (3 <
  10; median lead-in 0.051 s). Rule (a) missed on both tail knobs, the lead-in not judgeable — and not a valid sample
  (eyeballed tails end in the word's audible decay; his 10-15 tight ends tails at +12 dB, median ~0.21 s on M2). Update
  preset was not pressed; his trims stay in the station's `project.json`
  (`C:\Users\hasan\AppData\Local\vidtsx-e2e\B1-verify-root`) for a later offline re-measure. Hasan: "thats too much, can
  we just continue working, and I will do full testing on a real new video later" → the exit (≥ 10 joins per side, set
  by ear, then Learn, rule (a)) moves to his real-video test. ORCHESTRATOR.md "Session 3".

## 2026-10-22 — END-TO-END B3: QA readouts on the cards — hard entries and clipped tails, offending joins listed and auditionable — DONE

- **What:** part B3 of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`; code `e583d26` → `47bc6a1` →
  `99d825d`), the plan's §2 T1 "two QA readouts". **One pure module** `src/shared/studio/cut-qa.ts` = Hasan's
  `tools/analyze_cut.py` checks with its exact numbers as named constants, over `RmsEnvelope`: **hard entries**
  (`entry_check`: a real cut join = the first segment or a source skip > 0.75 s; the 0.05 s window from 0.06 s
  before the cut-in; flag > 15 dB over the floor) and **clipped tails** (analyze_cut main's loop, per ATOM:
  landing = word end + `tailFor(gap to the next atom)`, 0.05 s window, flag > 6 dB). Computed in main where the
  plan / proposal is made: `runCutPlan` writes `plan.qa` (also in the plan file) → `buildCutProposal` carries
  `proposal.qa` stamped with the asset (the toolbar's Auto Cut gets it with the plan — no IPC change); the
  editorial snap (`snapCutSpans`) returns `qa` → `buildEditorialProposal` → `proposal.qa`; `run_auto_cut` /
  `propose_cuts` replies end with the QA line. Schema additions are optional only (`StudioCutPlan.qa?`,
  `StudioProposal.qa?`): old plans and proposals load and render as before. **UI:** NEW `CutQaReadout.tsx` under
  the cut card's headline (Auto Cut and editorial both go through `ReviewCutsSection`): **"Hard entries N of J
  joins"** (red when > 0) and **"Tails on a release M of A landings"** (neutral; tooltip "the landing is still more
  than 6 dB over the room tone — soft landing; listen if it sounds cut" — analyze_cut's "clipped-tail risks");
  "QA clean" only when both are 0. `List the spots (N)` → hard entries first, then tails loudest first, 20 rows +
  `Show all N`; every row is **auditionable**: one click maps the spot onto the RESULT timeline
  (`mapQaItemToTimeline` — master lane first; a time inside an accepted removed span → that cut's join) and plays
  ~2 s from ~1 s before it with the result preview on (`handlePlayQaSpot` → the existing `playSpan`).
- **The exit, measured three ways (2026-10-22; M2 = `video-14-raw`, the nine raw DJI clips):**
  **(a) the same plan as analyze_cut** — Hasan's hand-audited keeps (`cuts.json`), tight from `cut-style.json`
  (asserted equal to `cuts.json`'s fitted tight knob for knob), M2's v3 waveforms + transcripts, analyze_cut
  recomputed read-only (`python -I -B`, its `main` never run): **hard entries 0 / 0 on all eight clips with keeps**
  (0366 has none — Hasan cut it whole; corrected in B4 from "nine", per the B3 verifier); joins checked Studio
  **133** vs analyze_cut **134** — one real-join flip at 0373 seg 17 (Studio's skip 0.738 s vs analyze_cut's
  0.798 s across the 0.75 s real-join line, because Studio's seg 16 ends 60 ms later, 63.566 vs 63.506 — the same
  20 ms-bucket read; not hard either way, +4.8 dB at that cut-in); tails
  analyze_cut **181** (5, 11, 20, 12, 63, 4, 39, 27 — exactly Hasan's `qa-report.md`, so that report is current)
  vs Studio **178** (5, 11, 20, 12, 61, 4, 38, 27): 178 flagged by both, 3 by analyze_cut only, 0 by Studio only —
  each the 20 ms-bucket read B1 documented (one 0.18 dB read at the 6 dB edge; two Studio tails 60 / 20 ms longer,
  which at cutlib's landing also read over 6 dB). Hottest real join per clip under 15 dB on both sides (max 0376
  14.17 / 14.41); floors within 0.16 dB. **(b) "hard entries 0 at `head 0.15`"** — met on Hasan's plan (a), and live
  on Studio's own Auto Cut over all nine clips (CDP, port 9291, the reused scratch `vidtsx-e2e\B2-root` +
  `profiles\B2\profile`, default style `tight · default`, head 0.15, maxHead 0.3; card == `plan.qa` in the plan
  file on every run): **hard entries 1 of 164 joins, tails on a release 265 of 298 landings** (per clip
  hard/joins · tails/landings: 0366 0/3 · 6/8, 0369 0/5 · 5/6, 0370 0/11 · 15/18, 0371 0/23 · 36/44, 0372 0/16 ·
  26/28, **0373 1/53** · 84/92, 0374 0/3 · 5/7, 0375 0/26 · 50/53, 0376 0/24 · 38/42; a rerun gave identical
  totals). The one flag is a **TRUE positive** the check exists to catch: 0373's cut-in at source 323.198 s,
  **+17.7 dB** — an UNTRANSCRIBED sound at 322.4–322.8 s (peak −12 dB; "ready," ends 320.733, "before" starts
  323.348) in the removed 2.0 s before it decays into the check window (323.14–323.19 s: −35 / −36 dB over a floor
  of −53.1 / −53.4); Hasan's edit removes 320.01–324.383 as a retake. Not a lead-in failure (the head snapper cannot
  know about sound the transcript lacks); the card shows it in red and auditions it. **Negative control:** project
  override `{base: natural, head: 0}` → **121 of 162 joins** hard (tails 97 of 298). **(c) "raising `margin` shows
  clipped tails as expected"** — met as: on tight the count is already saturated at margin 12 (265 of 298 landings
  over +6 dB) and does not fall as margin rises — **265 / 265 / 265 at margin 12 / 18 / 24** (project knob override
  `settings.cutStyle {margin: N}`; per clip identical) — while the flagged landings get louder, **mean +11.45 →
  +14.51 → +16.23 dB over the floor** (from the plan files); where the count is not saturated it rises: **natural
  margin 6 → 12 → 18 → 106 → 132 → 132** (tight `softMargin` 6 → 12: 265 → 269). Hard entries 1 → 2 → 2 at margin
  12 / 18 / 24 (margin moves the segmentation: 0371 gains one real join, which flags; joins 164 → 170 → 172).
  **Audition:** 0373's `List the spots (85)` → 20 rows + `Show all 85`, row 1 `hard entry 5:23.2 +17.7 dB`; its
  click (mapped to result time 654.728 = the join) played across the join with the cuts applied — toolbar clock
  `13:04.33` → `13:05.12` → **`13:07.37` (the removed 2.0 s skipped)** → `13:08.32` (MM:SS.FF in 60 fps frames,
  `formatClock`) = 784.55 → 785.20 → 787.62 → 788.53 s around the join edges 785.539 / 787.544, i.e. **0.99 s
  before to 0.99 s after** (the B3 verifier read the same from the video element: source 320.200 → 321.075, skip,
  323.217 → 324.112 around 321.193 / 323.198), stopped, preview restored off. Evidence:
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\` (`analyze-cut-ref.json`, `compare-b3-report.json`,
  `exits-<tag>.json`, `audition.json`, `stills\b3-*.png`); drivers and scratch harness in
  `.vidtsx-temp/end-to-end/B3/`. TESTING §18.9.
- **Gates:** `npx vitest run --exclude src/main/services/python-models/service.test.ts --maxWorkers=4` **451 files
  passed, 5 skipped; 3814 tests passed, 34 skipped, 104.7 s** — the counted run, green on the first try (app
  stopped; log `C:\Users\hasan\AppData\Local\vidtsx-e2e\B3\vitest-full-run1.log`). **`python-models/service.test.ts`
  was EXCLUDED for disk** (DRIVING.md "Vitest gate while C: is low": it seeds a 1.68 GB file in `%TEMP%` and fails
  with `ENOSPC` while C: has < 4 GB free — C: 1.84 GB, D: 1.11 GB before the run; the branch never touches
  `python-models/`, `git diff --stat main..HEAD -- src/main/services/python-models/` is empty); `--maxWorkers=4`
  because the CPU sat at ~76 % from other sessions. `npm run check:types` web 26 / node 10 = baseline. New unit
  tests over the part: `cut-qa.test.ts`, `cut-tools.test.ts` (the real `propose_cuts` handler, no model call),
  `cut-proposal-qa.test.ts` (9), `CutQaReadout.test.ts` (9), plus QA cases in `cut-plan-runner` / `run-auto-cut` /
  `cut-proposal` / `editorial-cuts` tests.
- **Honest notes:** the card's counts are the plan's, not live — rejecting a cut or dragging its edges does not
  recompute them (no waveform envelope in the renderer); the spots map through the CURRENT result timeline, so a
  click plays what the user will hear now. On tight the tail count reads "how many landings ride the release" (181
  of 200 atoms on Hasan's own keeps), not errors — hence the two checks' different weight on the card. The
  editorial card is proven through the real `propose_cuts` handler on a fixture and the component test (no model
  call in B3); B6 runs the real editorial pass. `EditorShell.tsx` grew by one 13-line handler (1,645 lines,
  pre-existing far over ~300). The margin knob was set through the app's own project update (no UI editor exists
  for a single project knob).
- **Open (follow-ups, not blockers):** (the earlier "audition starts ~0.2 s early, 1.21 s before / 0.78 s after"
  is withdrawn — corrected in B4 from the B3 verifier: it took the toolbar clock's frames for hundredths
  (`formatClock`, `src/features/studio/services/timeline-view.ts:43-52`, MM:SS.FF in 60 fps frames); the audition
  plays **±0.99 s** around the join, as designed); after the stop the playhead parks at the result-timeline time
  read as an original-timeline time (pre-existing, shared with `handlePlayJoin`); a median / worst landing-dB line on the card
  (the tail count saturates on tight); list rows show source `M:SS.d` with no clip label; no UI for single project
  cut knobs.
- **Next:** the B3 verifier; then B4.

## 2026-10-22 — END-TO-END B2: the default cut style file; `resolveCutStyle`; all four consumers; picker → preset read-out + project override; Project settings knobs; preset editor Cut section — DONE

- **What:** part B2 of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`; code `bc104c3` → `4f0b33b` →
  `b86b279` → `c50968f` → `bf46298`), the plan's §2 T1 slice. **Data:** `resources/skills/studio-clean-cut/cut-style.json`
  (ships via `electron-builder.yml` `extraResources` `skills/**/*`) holds three named styles — `tight` = Hasan's
  fitted tight from `cuts.json` (all twelve knobs incl. B1's `maxHead 0.3 / minSkip 0.12 / fricZcr 3500 /
  fricMargin 5`), `natural` = his fitted natural (eight knobs, no opt-ins), `relaxed` = natural with every time
  knob ×1.5 (`internalGap 0.6, head 0.32, minTail 0.39, maxTail 0.68, softGap 1.8, softMaxTail 1.05`, dB margins
  unchanged — **orchestrator decision 1; it is data, Hasan can change it**) — and `"default": "tight"`. The old
  `TIGHT_STYLE` / `NATURAL_STYLE` / `CUT_PLAN_STYLES` constants are gone. **One pure resolver**
  `resolveCutStyle(file, {callStyle?, project?, preset?})` (`src/shared/studio/cut-style-resolve.ts`): per-call
  style (the agent's `run_auto_cut({style})`) > project `settings.cutStyle` > preset `style.cut` (`base` + partial
  knobs) > preset `pacing` mapped (tight/normal/relaxed → tight/natural/relaxed) > the file's default; it returns
  the knobs, a display name (`tight · default`, `natural + 1 override · preset “YouTube long-form”`,
  `tight · project override`) and an 8-hex key. **All four consumers on it:** the Auto Cut button (sends the live
  `presetId`/`cutStyle`), `run_auto_cut` (enum + `relaxed`; omitted = the project's style), the editorial snap and
  Transcript deletes (renderer gets the resolved style over the new `studio:cut-style:resolve` IPC; main is the only
  reader of the file). The plan cache file is now `<asset>-<style>-<key>.json`, so an edited preset never reuses a
  stale plan; old `<asset>-tight.json` files are left in place (nothing reads plans back). **UI:** the Transcript
  section's session picker became `AutoCutRunner` — a read-out of the resolved style (title = every knob) and an
  override Select (`Preset’s style (<name>)` / Tight · Natural · Relaxed for this project) stored on the project as
  `settings.cutStyle = {base}` (saved, NOT undoable — the preset-picker pattern; choosing the preset again removes
  the key); Project settings gains a "Cut style" block (name + all twelve knobs, opt-ins absent = "off",
  overrides in accent); the preset editor gains a Cut section (base select + one input per knob the base has;
  only knobs that differ from the base are stored; out-of-range values refused by `validatePresetInput`). Schema
  additions are optional only: a project without `cutStyle` and a preset without `cut` resolve exactly as before
  through the new path.
- **The exit, live 2026-10-22 (CDP, isolated profile on C:, port 9281, on a COPY of M2 in
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B2-root` — the shared M2 was never opened):** Assets › Presets ›
  YouTube long-form › Cut: base Natural, Lead-in 0.25 → Save → `preset.json` `style.cut = {"base":"natural","head":0.25}`
  (pacing stays `normal`); Talking-head short saved untouched → no `cut` key; Course lesson Decay margin 600 → "Cut
  decay margin must be between 0 and 60 dB." in the section and the form, Save refused, file byte-identical. In
  Studio, preset = YouTube long-form → Project settings and the Inspector read-out both say **`natural + 1 override ·
  preset “YouTube long-form”`** (Lead-in 0.25 s in accent, Onset reach / Min skip / Fricative ZCR / Fricative margin
  "off"); **Auto Cut on 0369 → card headline `Auto Cut (natural + 1 override · preset “YouTube long-form”) · assemblyai
  · −27.8 s of 47.7 s · noise floor -54 dB`**, plan `…-natural-15b4f39a.json` written 10 ms after the click. Override →
  Tight for this project → disk `settings.cutStyle = {"base":"tight"}`, read-out and Project settings `tight · project
  override` (twelve knobs), Auto Cut → `Auto Cut (tight · project override) · … −29.8 s of 47.7 s` (`…-tight-42f80e70.json`,
  22 ms). **Same knobs for editorial and Transcript deletes:** a Transcript delete of words 12–23 ("But I noticed …
  business.", 3.9 s selected) → "Removed 12 words · −13.1 s", cut at **[7.328, 20.41] s = `planTextDelete` with the
  resolved tight exactly** (the preset's natural + head 0.25 would cut [7.628, 20.31], plain natural [7.628, 20.35]);
  the editorial snapper (`snapEditorialCuts`) with the same resolved style on the same words lands on [7.328, 20.41]
  too; the resolve IPC with the live settings and from disk (the editorial / agent path) give the same key
  `42f80e70`. **Override survives** 4K → 1080p → undo → redo → the Transcript delete: `settings.cutStyle` stays
  `{"base":"tight"}` on disk after every step. Back to "Preset’s style" → the `cutStyle` key is removed and the card
  names the preset again. Stills `C:\Users\hasan\AppData\Local\vidtsx-e2e\B2\stills\b2-{1..10}-*.png`; driver
  `.vidtsx-temp/end-to-end/B2/drive.mjs`, scratch check `textdel.b2.test.ts` (`B2_TEXTDEL=1`, scratch config).
- **Gates:** `npx vitest run` **447 files passed, 5 skipped; 3778 tests passed, 34 skipped, 42.0 s** (app stopped,
  first try); `npm run check:types` web 26 / node 10 = baseline. New unit tests over the part: `cut-style-spec` /
  `cut-style-resolve` (every rung, garbage at every rung, the key), `cut-style-store` (9), `cut-plan-runner` (3),
  `cut-style-handlers` (5), `studio-cut-plan-run-handler` (4), `cut-style-override` (9), `preset-cut` (11), plus the
  repointed planner / editorial / text-delete / proposal tests.
- **Honest notes:** (decision 4) **editorial and Transcript deletes moved from the old natural** (head 0.19 / minTail
  0.26 / maxTail 0.45 / margin 5) **to the resolved style — Hasan's fitted tight by default** (head 0.15 with the
  onset walk up to 0.3, minTail 0.08, maxTail 0.7, margin 12, the fricative rule, min-skip 0.12), so authored joins
  land tighter unless the preset or project says natural; both keep pause compression off (an editorial-pass
  choice, not a style). Auto Cut's default stays tight (now the fitted one). The project override is saved but not
  undoable, like the preset and brand pickers. A spec cannot switch an opt-in knob OFF over a tight base
  (`CutStyleSpec` = partial values; "no fricative rule" = base natural/relaxed) — **follow-up when Hasan asks**
  (e.g. `null` = remove). The agent tools still read the project from disk (like `get_preset`), the button reads
  the live document; they agree once autosave lands (<1 s). B1's finding stands (Studio's `snapHead` can lead in up
  to +150 ms longer than cutlib's where a 20 ms bucket edge is loud) — B3 measures.
- **Fix round 1 (2026-10-22, after the verifier's FAIL):** the agent's `run_auto_cut` did NOT use the resolved style
  in preset projects — the prompt's "EDITING PRESET" mapping (`auto_cut` light/normal → `run_auto_cut(style:
  "natural")`, aggressive → `"tight"`) sent a call style, the top rung, so the agent's Auto Cut skipped the project
  override and the preset's cut (Course lesson: agent natural, button / Transcript deletes / editorial relaxed). Now
  `studio-agent-prompt-tools.ts` says an `auto_cut` step runs `run_auto_cut` WITHOUT `style` (the project's cut style
  comes from the preset or the project override; the step's aggressiveness does not pick a style; pass `style` only
  when the user asked for one in this conversation) — the tool line and the generic workflow step say the same — and
  the preset block's knob line names a preset's own cut (`describePresetStyle`: `pacing tight · cut style natural,
  lead-in 0.25 s`). No other prompt/skill text instructs a style (grep of `resources/skills/**`,
  `resources/presets/*/PRESET.md` — their "Auto Cut runs light/normal/aggressive" lines are prose and name no
  `style` — `preset-workflow-lines.ts`, `studio-agent-prompt*.ts`). An unknown style name in a call is now refused
  with a typed error instead of silently becoming the file default. `PresetForm.tsx` 307 → 246 lines (the style
  grid moved to `PresetStyleFields.tsx`, 83). **Evidence (no model call needed):** NEW `run-auto-cut.test.ts` runs
  the REAL `run_auto_cut` handler with the real cut-style store, preset-store, runner and planner, the shipped
  `cut-style.json` and the shipped Course lesson preset on a fixture project: no style → reply and plan `relaxed ·
  preset “Course lesson”`, plan file `a1-relaxed-<key of the shipped relaxed>.json`; project override `{base:
  natural, head: 0.25}` → `natural + 1 override · project override`; explicit `tight` (the user asked) → `tight ·
  requested`. `studio-agent-prompt.test.ts` +4 (the full prompt and the block of each of the three shipped presets
  contain no `run_auto_cut(style:` / `style: "<name>"`; run against the old prompt text the test FAILS),
  `agent-preset-prompt.test.ts` +2, `cut-style-store.test.ts` +1 (unknown name refused; omitted = the preset's
  relaxed). Gates: `npm run check:types` web 26 / node 10 = baseline; `npx vitest run --maxWorkers=4` **448 files
  passed, 5 skipped; 3788 tests passed, 34 skipped, 91.8 s** (the counted run; three default-width runs each had only
  the known `shot-module-resolver.test.ts:151` 5 s load timeout).
- **Open:** the Project settings modal's X has no aria-label/title (pre-existing).
- **Next:** the B2 verifier (round 2); then B3.

## 2026-10-22 — END-TO-END B1: ZCR in the waveform job; snapHead, fricative-aware snapTail, minSkip; the four knobs — DONE

- **What:** part B1 of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`; code `2dc5add`), the plan's §2 T1
  slice: cutlib's October knobs ported with its exact semantics. `CutPlanStyle` gains four OPTIONAL fields
  (`maxHead`, `minSkip`, `fricZcr`, `fricMargin`; absent = the old behaviour; `TIGHT_STYLE` / `NATURAL_STYLE` and
  the UI unchanged — B2 moves the defaults). `RmsEnvelope` moved to `src/shared/studio/rms-envelope.ts`
  (re-exported from `cut-planner.ts`): overlap-weighted `rmsDb` / `zcr` windows over the 20 ms buckets, a floor
  from 50 ms windows (cutlib's `floor_db`), `snapTail` with the fricative rule, a new `snapHead` (lead-in walked
  back up to `maxHead`), the `minSkip` merge (`cut-skip-merge.ts`). **Waveform job v3:** decodes mono **16 kHz**
  for the whole job (was 8 kHz — fricative energy sits above an 8 kHz file's 4 kHz Nyquist, so cutlib's
  `fric_zcr 3500` needs 16 kHz) and writes `zcr` (zero crossings per second) per 20 ms bucket beside `peaks` /
  `rmsDb` (`{version: 3, …, zcr}`; pure `waveform-buckets.ts`). Old v1/v2 waveform files still parse everywhere
  and regenerate once on project open and before planning (no zcr ⇒ the fricative rule is off). 29 new unit tests
  (`rms-envelope.test.ts` 13, `cut-planner-knobs.test.ts` 11, `waveform-buckets.test.ts` 5) mirror cutlib's cases.
- **Material (M2, shared by track B):** Studio project `video-14-raw` in the scratch root on C:
  (`C:\Users\hasan\AppData\Local\vidtsx-e2e\b-root`), the nine raw DJI clips of video-14 referenced in place
  (3840×2160 @ 59.94), NVENC proxies + v3 waveforms for all nine in ~9 min 20 s; Hasan's saved AssemblyAI
  transcripts mapped through Studio's own `AssemblyAiProvider.mapJob` ($0, no STT call; word counts match all
  nine). Waveform job alone: **0.1 s for a 47.7 s clip, 0.7 s for 396.2 s** (~570× realtime).
- **The exit, measured 2026-10-22:** Studio's `planClip` on M2's v3 waveforms vs Hasan's `tools/cutlib.py`
  `plan_clip` (run read-only, `python -I -B`) on his 16 kHz WAVs, same keeps (`cuts.json`), same AssemblyAI
  words, Hasan's fitted tight with all four knobs. **"Clip 1" = `0369`** (`0366`, the first raw clip, is cut
  entirely — keeps `[]`, no joins): **6 segments both sides, 12 joins, start/end deltas 0/0 · 0/0 · 0/0 · −10/0 ·
  0/0 · 0/+20 ms → all within ±20 ms.** Broader: all eight clips with keeps → **352 joins, 348 within ±20 ms
  (98.9 %)**, 4 at +40/+60 ms and 2 merge flips (their outer joins within ±20), each a tail knife-edge on the
  20 ms grid (level within ~0.6 dB of floor + 12 dB, one 2.1 dB, or ZCR straddling 3500) — every one explained
  with the waveform in `docs/studio/end-to-end/B1/HANDOFF.md`. Noise floors within 0.16 dB on every clip; Studio's
  v3 buckets equal the WAV's 20 ms RMS at **lag 0** (mean |dB| 0.02–0.03).
- **Click-through (CDP, isolated profile, port 9271):** the 0369 waveform marked `"version":2` → opening
  `video-14-raw` rewrote it as v3 **211 ms** after the project card click (warm cache — the app had already read
  the clip; the B1 verifier measured **~5 s** for the first open after a fresh launch, a cold read of two clips
  at 2 jobs at once), byte-identical to the original v3 file; pool context menu "Add to timeline" → the clip on V1 (47.7 s); Transcript section → **Auto Cut (tight)**
  → `cache/cut-plans/…-tight.json` written **21 ms** after the click: built-in tight, 6 segments, 7 proposals,
  −28.7 s of 47.7 s, noise floor −54.457 dB, review open ("Apply 7 cuts" / "Reject all"); that plan equals the
  pure `planCuts` on the same files (scratch test). Stills `.vidtsx-temp/end-to-end/B1/stills/step3-{1-open,
  2-added,3-autocut-review}.png`. M2 restored afterwards (`project.json` byte-identical to before).
- **Gates:** `npx vitest run` **439 files passed, 5 skipped; 3699 tests passed, 34 skipped, 36.5 s** (app
  stopped; the two runs before it each failed only load timeouts outside B1 — four zip-package suites at 5000 ms,
  then `flow-render.test.ts`'s 1 s `vi.waitFor` — all pass alone); `npm run check:types` web 26 / node 10 =
  baseline.
- **Honest notes:** existing behaviour moved slightly, by design toward cutlib: every `RmsEnvelope` consumer
  (Auto Cut, the editorial snap, Transcript deletes) now reads overlap-weighted windows and a 50 ms-window floor,
  and 16 kHz levels after regeneration; no existing test changed. Every waveform of an old project regenerates on
  first open (plan §5; cheap — ~570× realtime). The 20 ms grid over-reads a loud bucket edge in the HEAD walk
  (20 ms head windows: p95 11.4 dB off cutlib's, max 30.8), so Studio's `snapHead` can lead in up to +150 ms
  longer than cutlib's (4 of 200 atoms on video-14; all inside segments both sides merged, so no join moved; safe
  direction) — a finer analysis grid would be a cache/plan change, left for B2/B3 to weigh.
- **Open:** `media-jobs.ts` is 314 lines (310 before B1); D: free space fell ~0.6 GB during M2 setup without a
  writer found in our folders (other sessions run on this machine).
- **Next:** the B1 verifier; then B2 (default style values, `resolveCutStyle`, the consumers, the UI).

## 2026-10-22 — END-TO-END A6: the A/V check ("Check A/V") on the finished Studio export row + report JSON — DONE

- **What:** part A6 of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`; code `bcea695`, `a4b88d3`,
  `16f1a37`, `1ffa650`, fix round 1 `717bc74`), the plan's §2 T8: a user-facing port of the editor's `verify_sync.py`. **Verdict**
  (`src/shared/studio/sync-verdict.ts`): pass iff median |offset| < 25 ms and |drift × span| ≤ 40 ms over ≥ 3
  confident probes, else fail; < 3 confident = "Not enough to judge" (never a pass); + = audio behind the
  picture. **Probes** (`src/shared/studio/sync-probes.ts`): the reference is the first camera clip's file in the
  export (audio-bearing, speed 1); probes sit only where that picture is visible — cutaway shots are skipped with
  a reason, overlays are named, a PiP box is mapped back to camera pixels through the clip's transform.
  **Measure** (`src/main/services/studio/export-engines/sync-measure.ts`, `sync-media.ts`,
  `export-sync-check.ts`, `sync-xcorr.ts`): an 8 kHz FFT xcorr locates each 2 s export audio window in the camera
  audio within ±2 s of the timeline's time, a z-score frame match finds the shown camera frame among 96 camera
  frames centred between the audio's and the timeline's time, **each camera frame labelled by its own timestamp**
  (ffmpeg `-fps_mode passthrough` + `-stats_enc_pre`; a frame without one is an error, never a guess), error =
  video − audio; a **layout mask** learned from all probes of one box (median residual) handles an overlay painting
  over part of the PiP. Report `<export>.sync.json` (version 2) beside the file. **IPC** `studio:export:sync-check` (+ cancel, progress push), source =
  the queue row's export entry or a project + range. **UI:** "Check A/V" on a finished Studio export row
  (`RenderItem.tsx:181`) → progress "probe N of 16" + Cancel → a green/red/amber verdict line, offset · drift ·
  probes · time, the report name + "Open report". No schema change.
- **Measured 2026-10-22 09:13–09:26, with the fixed code** (`717bc74`), on the two A5 exit files (video-14 copy,
  80–110 s 4K60; reference = the 4.05 GB 59.94 fps master), live click-through over CDP on an isolated profile
  (port 9261, `.vidtsx-temp/end-to-end/A6/`): **A5 Standard** → **IN SYNC, offset −2.6 ms, drift +3.5 ms over
  10.1 s, 16 of 16 probes confident, 52.5 s**; **A5 Fastest** → **IN SYNC, the same numbers, 48.3 s** (identical
  per-probe errors; reports beside each file in `.vidtsx-temp/end-to-end/A5/export/`). Offset files (ffmpeg stream
  copies, no queue row; through the app's IPC over CDP): **audio +100 ms → FAIL, +96.8 ms** ("audio 96.8 ms BEHIND
  the picture", 16/16, 50.0 s — the exit); **video 3 frames late → FAIL, −52.6 ms** (project + range source, 50.7 s);
  **audio 27 ms early → FAIL, −29.6 ms** (52.3 s); **audio 600 ms early → FAIL, −602.9 ms** (49.6 s). Out of the app
  (live test, 11 files, every one 16/16) **every verdict matches the truth** (|shift| < 25 ms ⇒ pass, else fail):
  true 0 / 0 / +10 / −27 / −30 / −33 / −80 / −600 / video +2 fr / video +3 fr / +100 ms → measured −2.6 / −2.6 / +7.4 /
  −29.6 / −32.6 / −35.6 / −82.6 / −602.9 / −35.9 / −52.6 / +96.8 ms, spread 3.1–3.4 ms. Cancel mid-check (round 1)
  → panel back to idle in < 2 s, no ffmpeg left, the earlier report untouched. `npx vitest run` **436 files passed,
  5 skipped; 3670 tests passed, 34 skipped, 36.8 s** (the two runs before it each failed only
  `shot-module-resolver.test.ts` "a changed transpiler fingerprint" — the known load flake, passes alone 10/10);
  `npm run check:types` web 26 / node 10 = baseline.
- **Fix round 1 (the verifier's round-1 FAIL):** the bundled ffmpeg, piping frames at a constant rate, REPEATED the
  first camera frame after ~1/3 of seeks, and the check labelled frames `first + index`, so those windows read one
  camera frame (16.7 ms) late. Audio 27 and 33 ms early PASSED (−18.9 / −23.2 ms) and the round-1 numbers (+0.2 ms on
  the A5 files, +99.4, −50.5) were wrong; audio 600 ms early read "Not enough to judge" and blamed the picture (the
  audio search was ±0.5 s). Fixed: passthrough decode + frames labelled by their own timestamps (a regression unit
  test pins a window whose first frame repeats), audio search ±2 s, "Not enough to judge" names the side that failed.
- **The −2.6 ms is real, and kept:** the check measures the FILE's own picture-vs-sound offset, including where the
  render put whole camera frames. On the A5 files the sound sits on the timeline to 0.0 ± 0.1 ms at all 16 probes;
  each picture is a whole 59.94 fps camera frame in a 60 fps export (the nearest frame on 14 probes, the next on 2),
  and the median of those 16 quantization steps is −2.6 ms (the 59.94/60 beat moves the phase only 0.06 frame/s, so
  10.1 s samples ~0.6 of one cycle). Every file made from them inherits it, so measured = applied shift − 2.6 ms.
  Near the bar the check reads the export's true offset: this file with its audio shifted +26 ms would read +23.4 ms
  → pass, and its pictures really are 23.4 ms from their sound.
- **Honest notes:** on video-14 the plain whole-frame match found **0 of 16** probes (0.65–0.72): the
  `V14A1Scratch` overlay paints a card over ~56 % of the PiP and no document field says so. The mask derived
  from the data (≥ 3 probes of one box agreeing) lifts the match to 0.95–0.99 at the unchanged 0.90 bar; a
  negative-control test pins that it cannot invent a match. But masked quality is computed over pixels chosen
  BECAUSE they agree, so 0.95–0.99 overstates confidence and the 0.90 bar is weaker than it reads; each probe's
  unmasked `plainQuality` stays in the report. ~50 s per check of a 30 s 4K range.
- **Open (by design / not built):** the queue row reads the export's context sidecar, which the 24 h sweep
  removes — an older row says "This export can no longer be checked from the queue … Export it again to check it"
  (handler-tested, not driven: the A4 sidecar was still present); only Studio export rows can be checked (no
  "check any file" picker); "Open report" not clicked live (it opens the OS default app).
- **Next:** the A6 verifier, round 2; then B1 (A6 is track A's last row).

## 2026-10-22 — END-TO-END A5: Fastest on video-14 (30 s 4K60 range, split + cutaways); Standard at 25 % for the record — DONE

- **What:** part A5 of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`; code `06edaf0`, `f84a78d`), the
  plan's §2 T7 measurement. **Step 0 (two fixes):** a render whose Remotion pre-encode ffmpeg dies can no longer
  hang — `render-stall-guard.ts` (wired in `remotion-renderer.ts` for every engine and the Render page) fails the
  job "Render stalled at frame X of Y …" after the per-frame timeout + 2 min (min 5 min, 12 min at default) with
  no new frame, cancelling Remotion first so its processes and temp are released; one font fetch blip no longer
  refuses an export — `font-upstream-fetch.ts` retries a network error / 5xx once (never a 4xx), and the
  preflight says "N of M font files … could not be downloaded — check your connection" unless ALL failed.
  **Prerequisites:** the full ffmpeg (NVENC) was installed in A4 by the in-app card download and carried over
  in a copy of A4's profile; on a fresh launch all three engines were available (no second download, no
  restart). **Range:** 80.000–110.000 s = frames 4800–6600 (1800 @ 60 fps) of the video-14 copy — enters and
  leaves the PiP split `clip_mvba3wua_309b03` (89.9–103.15 s) and crosses the cutaways `V14A1OneWord`,
  `V14A1Template`, `V14A2Starter`. Both files kept in `.vidtsx-temp/end-to-end/A5/export/` for A6 and the
  track exit. No schema change.
- **Measured 2026-10-22** over CDP on an isolated profile (port 9245, `.vidtsx-temp/end-to-end/A5/`),
  3840×2160 @ 60, Quality high, CPU low (25 %), render processes below normal, machine held awake:
  **Fastest** — wall **1178.3 s (19.6 min), 1.53 fps**; span plan copied 0 / composited 56 % (OneWord composite
  324 f in 355.4 s · Template composite 270 f in 29.4 s · the split as a browser span 795 f in 556.5 s · Starter
  composite 411 f in 229.3 s); `studio-video-14_2026-10-21T21-10-24.mp4` **35,076,111 B**, h264 Main 3840×2160
  60/1, 1800 frames, 30.000 s, 9.08 Mb/s + AAC 48 kHz stereo 30.000 s. **Standard** — wall **1046.4 s
  (17.4 min), 1.72 fps**; `studio-video-14_2026-10-21T21-30-54.mp4` **17,002,605 B**, h264 High 3840×2160 60/1,
  1800 frames, 29.999 s, 4.26 Mb/s + AAC 48 kHz stereo 30.000 s. Both: 1800/1800 persisted `done`, job scratch
  gone, no new `%TEMP%` entries, 0 "Render stalled" lines. **Fastest cancel** (moved from A2) PASS: 85–95 s
  cancelled at 24/600 → `cancelled`, no output, scratch (107 MB while running) gone, no Remotion/Chrome
  leftovers in `%TEMP%`. Disk estimate at 4K runs high (safe): output 268 MB estimated vs 35.1 / 17.0 MB.
  `npx vitest run` **431 files passed, 4 skipped; 3623 tests passed, 22 skipped, 43.3 s**; `npm run
  check:types` web 26 / node 10 = baseline.
- **Honest note:** Fastest copies **0 %** of video-14 — its 55 shots tile the whole timeline (a cutaway on
  every plain clip, an overlay on every PiP), so every span is composited or rendered in the browser (plan §5
  "Copy engines and splits", expected). On this range **Standard (1.72 fps) beat Fastest (1.53 fps)** and wrote
  a file half the size (x264 CRF vs NVENC). Fastest pays off only on footage with no shot over it.
- **Open (found, no fix made):** bundling progress is sent 100× too big (`render-handlers.ts:199` →
  "bundling 600% … 10000%"); the Fast/Fastest rows always read "Needs the GPU encoder download" even when it
  is installed (`export-engines.ts:46,54`); `remotion-renderer.ts` is 444 lines (over the ~300 rule before A5);
  a real dead encoder was not driven live (unit-tested only).
- **Next:** A6 (the A/V check on these two files).

## 2026-10-21 — END-TO-END A4: export font preflight; GPU proxies default on + the first-4K-import download card — DONE

- **What:** part A4 of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`; code `3417d46`, `4671622`,
  `139a4a9`, `3d450ba`; test-only `22593db`, `0afc196`), the plan's §2 T7 slice. **Fonts:** every Studio export
  now scans the shot, caption and transition COPIES for Google Fonts URLs (new optional
  `StudioExportEntry.fontUrls`, `export-entry.ts:76`), warms the font cache strictly (`ensureFontCached`,
  `font-proxy.ts:145`; 6 workers in `export-font-check.ts`) and refuses to start with a clear message when a
  file is missing and upstream is unreachable (`font-preflight.ts`, wired in `run-export.ts:81-92` before the
  scratch dir exists) — the font proxy's 502-mid-render path no longer happens. Dev-only
  `VIDTSX_FONT_UPSTREAM_OVERRIDES` (ignored packaged) blocks upstream for testing. **GPU proxies:** an unset
  setting now means "on when NVENC works" (`effectiveProxyGpuEnabled`/`decideProxyGpuEncoder`,
  `proxy-encoders.ts:82,97`); an explicit off stays off, QSV/AMF stay opt-in, the one-failure x264 latch is
  kept; no setting is written by the default. **The card:** the first 4K import through the media pool offers
  the full ffmpeg (76 MiB = 80,069,496 B) with the measured 91 s vs 12 s per minute; after the download, main
  re-queues this session's x264 4K proxies on NVENC (`studio:proxy-encoder:rebuild`, media-jobs `restart()`),
  so the clip that triggered the card ends on the GPU without a re-import. "Not now" lasts the app session.
  Step 0 also fixed the `shot-generator.test.ts` full-suite flake (test isolation: it cancelled one timer
  tick after starting a NEW shot, before the run was tracked). No schema change (optional fields only).
- **Verified 2026-10-21** over CDP on an isolated profile (port 9244, `.vidtsx-temp/end-to-end/A4/`):
  **GPU exit** — fresh profile, 3840×2160 HEVC 60 fps DJI clip (20.3 s) → card **1.6 s** after Import →
  Download **80,069,496 B in ~106 s** → probe `working:[nvenc,qsv]` 3.7 s after install → the TRIGGERING
  clip's proxy rebuilt as `nvenc-540p-intra-q33` in **7.9 s** (x264 had taken **23.7 s**); re-import straight
  to NVENC in **6.3 s**; **no restart, no Settings visit**; Settings row "Detected: NVIDIA NVENC — on
  automatically", ticked, **no `proxyGpuEncoderEnabled` key written**. **Font exit** (video-14 copy, Standard
  1080p 0:06–0:11, CPU low): cold cache + blocked upstream → refused, "Export not started: … Google Fonts …
  (103 font files missing) …" in the Queue row's Details, no scratch, no output; unblocked → preflight
  **103 URLs, 0 failed** (strict per-URL rule stays), completed 166.3 s, 1,362,839 B; **blocked after warm-up →
  preflight 0 fetched / 202 cached / 0 failed (36 ms), 0 upstream lines, completed in 181.5 s, 1,362,505 B**
  (h264 1920×1080, 300 frames + AAC). `npx vitest run` **428 files passed, 4 skipped; 3598 tests passed,
  22 skipped, 46.6 s**; `npm run check:types` web 26 / node 10 = baseline.
- **Known issue (seen once, not root-caused):** in step 4b a Standard export started ~10 s after the
  previous one lost its `remotion\react-motion-render*` folder mid-render; Remotion's pre-encode ffmpeg died at
  frame 66 and `renderMedia()` never settled (its `onFrameBuffer` throw is an unhandled rejection), so the job
  sat at "rendering" / 70 % for 11 min until Cancel (which cleaned up fully). It did NOT reproduce in 3 traced
  back-to-back runs (a delete tracer saw nothing in the app delete that folder). A guard that fails the job
  when the pre-stitcher dies moves to A5 step 0.
- **Open (Hasan):** a refused export shows nothing in the editor (no toast) — the message lives in Queue →
  Details (same as A2's disk refusal). The preflight is strict: a project's FIRST export needs the network
  once even when the preview filled the cache (all weights × subsets, ≈100 URLs for video-14's 4 families);
  after that, exports work offline. Brand fonts and pack filters are not scanned.
- **Next:** A5.

## 2026-10-21 — END-TO-END A3: the no-react fix — `remotion/<subpath>` external in shot bundles — DONE

- **What:** part A3 of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`, code `c3aefe8`), the
  plan's §2 T7. The shot bundle step keeps `remotion/<subpath>` external
  (`EXTERNAL = /^(react|remotion(\/.+)?|@vidtsx\/kit)$/`, `shot-bundle.ts:43`), so a shot that loads a
  font through `@remotion/google-fonts` no longer carries its own copy of `remotion/no-react`, whose
  top-level `window.remotion_delayRenderHandles = []` ran mid-render inside the lazy `__vidtsxInit()`
  and orphaned the export entry's `'brand fonts'` hold (the 2026-10-16 4K timeout). The lint accepts
  `remotion/no-react` + `remotion/version` only (`shot-lint.ts` `isShotModuleSpecifier`, shared with the
  import classifier); the preview maps both to the Player's one copy (`virtual-module-files.ts`, new
  `/virtual/remotion.js/version` route — before, a direct import went to esm.sh); the export needed
  nothing (`@remotion/bundler` aliases both subpaths to the app's 4.0.435). No schema change. Parity
  spike: the inlined 4.0.486 google-fonts uses only `NoReactInternals.ENABLE_V5_BREAKING_CHANGES`,
  present in 4.0.435 → T7 kept, no fallback.
- **Verified 2026-10-21** on a copy of video-14 (`.vidtsx-temp/end-to-end/v14-root`, Hasan's project
  untouched), CDP isolated profile port 9231: **one-shot render** 0:06–0:11 across `V14A1Nobody`,
  Standard, 3840×2160 @ 60, High, CPU low, below-normal → **completed 300/300 frames in 232.7 s**
  (~1.36 fps; ffprobe h264 3840×2160 60/1, 300 frames, 4.999 s + AAC), no delayRender timeout, export
  still = Player still (before: 171 frames in 607 s, cancelled). **All 55** re-bundled by the copy's
  import script (`--shots-only`): 55/55, 0 problems, `remotion_delayRenderHandles` 54 → 0, 8,698 →
  6,355 KB; `grep remotion_delayRenderHandles` over the 55 `v1.tsx` = **0 hits**. **Player** at 8.0 s and
  30.0 s with all 55 re-bundled: 0 handles, `renderReady` true for 30 s each, Space Grotesk + Inter via
  the font proxy (9 × 200), `/virtual/remotion.js{,/no-react}` 200, 0 esm.sh, 0 non-2xx, 0 exceptions.
  `npx vitest run` 425 files: 420 passed, 4 skipped, 1 failed = the known `shot-generator.test.ts`
  flake (3 tests; alone 18/18 pass); `npm run check:types` web 26 / node 10 = baseline.
- **Open (Hasan):** your own `~/Videos/VidTSX Studio/projects/video-14` still has the OLD 55 bundles
  (only the copy was re-bundled), as does any other project whose shots were bundled before A3 with a
  `@remotion/*` font load; there is no in-app re-bundle. The copy's `project.json` points its 127 media
  assets at the ORIGINAL's `media/` by absolute path (read-only, seen in the Player's `/asset` requests).
- **Next:** A4.

---

## 2026-10-21 — END-TO-END A2: export disk preflight + cancel/failure cleanup of the job's Remotion temp — DONE

- **What:** part A2 of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`, code `dd77b87`,
  `88de827`, `4b1156d`). Every Studio export (Standard, Fast, Fastest) now runs its Remotion calls in an
  `AsyncLocalStorage` scope on `os.tmpdir()` (`remotion-temp-scope.ts`), so Remotion's
  `remotion-v4.0.435-assets*` source copies, its Chrome profiles and `react-motion-render*` land in the
  job's own scratch `%TEMP%\vidtsx-studio\export\<jobId>\remotion\` and leave with it on success,
  cancel and failure (`removeDirWithRetry`: 12 × 500 ms, then a background retry); renders outside the
  scope keep the real temp. The fresh-bundle composition listing runs in its own `export\probe-*`
  folder (`bundle-compositions.ts`). Before any scratch or output is made, a disk preflight
  (`export-disk-check.ts`) estimates output + temp per drive (`disk-estimate.ts`: H.264 0.15 bit/px/frame
  at CRF 18, PCM, AAC, ProRes shot layer) and refuses with the numbers when a drive lacks need + 512 MB.
  Dev-only `VIDTSX_EXPORT_DISK_OVERRIDES` fakes free space (ignored when packaged). No schema change,
  no dialog change (an estimate line in the Export dialog is a logged follow-up).
- **Verified 2026-10-21** (CDP, isolated profile port 9242, scratch root `.vidtsx-temp/end-to-end/A2/`,
  1080p60 test clip, CPU low, below-normal): **Standard range cancel** after a fresh bundle (127/1800
  frames) — during, the job scratch held the 26,117,588 B assets copy + 2 Chrome profiles (60.2 MB);
  12 s after, no scratch, no output, **no new `%TEMP%` entry**. **Fast range cancel** (copy span + browser
  span, 829/1800) — job dir 73.3 MB during, then nothing left, no new `%TEMP%` entry. **Refusal** with C:
  faked to 300,000,000 B: queue row Error → Details "Not enough disk space for this export. C: needs about
  609 MB free — temporary files 97 MB (copies of the sources 25 MB, rendered video 67 MB, audio 5 MB) +
  512 MB to spare — and has 286 MB."; no scratch, no output file. **Completed** 10 s Standard range:
  4,344,305 B (H.264 1920×1080 60 fps 600 frames + AAC, 10.000 s) vs estimate 23 MB output / 49 MB temp
  (5.4× over — the safe side). `%TEMP%` over launch → Fast cancel → complete → stop: 0 new entries.
  Deliberate disk users: the bundle cache (`<userData>/bundle-cache`, +18 MB per fresh bundle, pruned)
  and the GPU-encoder ffmpeg download (178 MB, `<userData>/ffmpeg-full`). `npx vitest run` 424 files:
  419 passed, 1 failed = the known `shot-generator.test.ts` flake (3 tests; alone 18/18 pass);
  `npm run check:types` web 26 / node 10 = baseline.
- **Open (Hasan):** `%TEMP%` holds ~3,135 stray `puppeteer_dev_chrome_profile-*` (22 GB, last 10 days)
  from Remotion callers outside exports (shot stills, TSX builder stills, Creator) and other tools —
  not deleted, no sweep added.
- **Next:** A3.

---

## 2026-10-21 — END-TO-END A1: 4K New Project tile, 1440p + 1080p export presets, undoable frame size — DONE

- **What:** the first part of `docs/studio/END_TO_END_PLAN.md` (branch `end-to-end-p0`, code `e4803cd`).
  New Project reads the shared `FORMAT_PRESETS` (`project-format.ts`) — four tiles 16:9 1080p · 16:9 4K ·
  9:16 · 1:1, the W5 preset→orientation mapping keeps a tile that already fits (4K stays 4K under a 16:9
  preset). Export gains **1440p and 1080p** (`render-presets.ts` ladder 1440p/1080p/720p/540p/360p;
  never-upscale unchanged, so a 1080p project still lists Full/720p/540p/360p); the Settings default
  export resolution row lists the same ladder. Project-size edits (typed W/H and the format buttons in
  Project settings) are one `set-frame-size` timeline action — undo/redo like any edit; fps / name / STT
  stay plain edits; no proxy or shot reaction to a size change (plan §5). No schema change.
- **Verified 2026-10-21:** CDP click-through on an isolated profile (port 9241, scratch Studio root
  `.vidtsx-temp/end-to-end/A1/`): New Project showed tiles `1080p|4k|portrait|square` (1080p pressed);
  4K + 60 fps + Create → editor up, `project.json` settings **3840×2160 @ 60**; Export resolution listed
  **Full (3840×2160), 1440p (2560×1440), 1080p (1920×1080), 720p, 540p, 360p**; Project settings → 16:9
  1080p wrote 1920×1080 to disk in 265 ms and Export then listed Full (1920×1080)/720p/540p/360p;
  Ctrl+Z → 3840×2160 on disk, Ctrl+Y → 1920×1080, Ctrl+Z → 3840×2160 (~0.8 s each); close + reopen left
  `project.json` byte-identical. `npx vitest run` 415 files / 3513 tests passed (37.0 s);
  `npm run check:types` web 26 / node 10 = baseline.
- **Next:** A2 on Hasan's "go".

---

## 2026-10-21 — END-TO-END PLAN: written and DECIDED, build not started

- **What:** `docs/studio/END_TO_END_PLAN.md` — raw files to the finished video inside Studio, editing only
  (packaging / upload / Notion out of scope by Hasan). Six tracks, each with an exit measured on video-14:
  **A** 4K project + export (the `remotion/no-react` inlining that orphans the export's delayRender holds,
  1080p/1440p export presets, font preflight, GPU proxies default, temp + disk preflight, a user-facing A/V
  check) · **B** the cut (Hasan's 2026-10-15 fitted knobs ported with ZCR / snapHead / minSkip, styles on
  the preset behind one resolver for all four consumers, learning head/tail/margin from the joins he moves,
  hard-entry + clipped-tail readouts, the text-edit flag) · **C** visuals (crop + radius on the clip
  transform, a `split` shot kind with a cropped backdrop for the looks, PipHole in the kit, a transform
  tool, file tools + writable notes + session continuity + a user skills folder for the assistant) ·
  **D** voice cleanup (a `cleanAudio` job; ElevenLabs isolation, RNNoise with the 480-sample latency
  compensated, Mel-Band RoFormer de-reverb on the Python runtime; substitution in the serializer and
  `clipAudibles`) · **E** SFX as library content (index v2 with kind / probe / tags / usedIn, loudness at
  generation, reuse-before-generate, the reference catalog importer) · **F** parallel shot builds (the
  `canStart` gate, a batch tool, a RAM floor).
- **Verified for the doc (2026-10-21):** five read-only passes over the code, spot-checked — the exact-match
  externals regex (`shot-bundle.ts:36`), the one-at-a-time gate (`tsx-job-engine.ts:250-256`), the missing
  1080p export preset on 4K projects (`render-presets.ts:85-89`), GPU proxies off by default
  (`settings.ts:295-297`), no `snapHead`/ZCR in the Studio snapper, the reset line in Remotion 4.0.435
  `no-react.mjs:139-146` sitting inside `__vidtsxInit()` of every video-14 bundle.
- **Decided by Hasan the same day:** all nine checklist items (§4) plus parallel builds, "the agent reads
  everything as if I am here in Claude Code", the folds into the 4K and cut tracks; the Recorder stays later;
  **4K tests are 30–60 s ranges, never the full video.** Six sub-questions remain in §4, each with a
  recommendation.
- **Order:** A → B → C → D → E → F, 14 sessions (§3). Branch `end-to-end-p0` off main once the uncommitted
  October work (track-header resize, portaled menu, Recorder entry) is committed — his call (§4 Q6).
- **Next:** A1 on his "go".

---


## 2026-10-04 — Recorder: designed and decided, build not started

- **What:** the screen + camera + mic + system-audio recorder that hands off onto a Studio timeline — Hasan's brief "the best and the smoothest recording tool that integrates with VidTSX Studio". Design doc `docs/studio/RECORDER_DESIGN.md`, written in the house pattern (verified facts → decisions with a recommendation → checklist), **answered and confirmed by Hasan the same day** (Rev 1 + Rev 2).
- **Decided:** WebCodecs engine with paced constant-frame-rate encode in a hidden engine window, fragmented MP4 appended as it records (crash-safe), separate masters per stream with the microphone inside the camera file (screen file when no camera; Studio's existing *Detach audio* splits it), system audio its own file, audio as a recorder option (Compressed AAC default / Lossless adds WAV masters), recordings in `<studioRoot>/recordings/<session>/`, entry points = a Recorder sidebar screen + Record in Studio's Media tab, control bar as an always-on-top content-protected window, cursor positions recorded (clicks need a native hook — P5), Windows first with the Mac as a P4 gate, one pinned dependency (`mediabunny`) if the P0 spike picks WebCodecs over `MediaRecorder`.
- **Verified today for the doc:** Electron 41.0.2 = Chromium 146; `setDisplayMediaRequestHandler` + `audio: 'loopback'` (Windows only) in the d.ts; the bundled Remotion ffmpeg has mp4/webm/wav muxers, `amix`/`aresample`/`adelay`, raw `h264`/`wav`/`s16le` demuxers, `gdigrab`/`dshow` devices — and **no `overlay`, `fps` or `select`** (no picture compositing outside a Studio export); Studio's probe takes one audio stream per file; `detachAudio` exists in `clip-update-ops.ts`.
- **Build order:** P0 spike (measures S1–S5 on the 1650 Ti laptop, decides the engine) → P1 screen + mic behind flag `recorder` → P2 camera + system audio + pause → P3 hand-off + Recordings list → P4 robustness + macOS (ship gate) → P5 zoom/cursor shot pack (own doc). **Nothing built; no dependency added; flag not created.**
- **Still missing** — the doc's §7, kept for the cold pick-up: portrait/Shorts preset, camera-only and audio-only modes, a teleprompter over the project script, markers/retake hotkeys, mic processing defaults, session rename/delete policy, the clip `groupId` question for keeping the four clips in sync, the P0 harness and clap rig, the hardware-encoder detection method, mac entitlements, THIRD_PARTY_NOTICES, CDP stand-ins, TESTING.md.
- **Next:** "later" (Hasan). When it starts: §7 A, then P0.

---

## 2026-10-02 — V1 GO-LIVE: 1.1.0 PUBLISHED

- Hasan said "go". `main` pushed (49 commits), repo flipped **public** (history as-is, his choice), `v1.1.0` tagged; the release workflow passed first time (types, full tests, build, draft with `.exe` + blockmap + `latest.yml`).
- CI installer smoked from an extracted copy on a throwaway profile (hash = `latest.yml`, unsigned as decided, DSN main-only, template preview drawn, clean exit). Release notes corrected and **published as latest** (https://github.com/hassancs91/VidTSX-STUDIO/releases/tag/v1.1.0).
- Update path live: the feed and `latest.yml` answer anonymously; a 1.1.0 client reports "on the latest version".
- **Next (Hasan, runbook step 9):** `feed.json` on vidtsx.com, download page, README GIF, cla-assistant. Then 1.1.1.

---

## 2026-10-02 — V1 GO-LIVE: checkpoint committed, step 3a closed, installer rebuilt for Hasan's pass

- **Hasan's decisions:** commit the tree; of the paused 3a items only the shot Media section click-through and templates audio control + importer stay in V1. Gap 4 split/PiP, gap 5 kit coverage, proxy speed, transition drag-drop + single removal and TSX agent mode on an open project move to 1.1.1.
- **Committed (local, not pushed):** the checkpoint as ten commits by pathspec (`2b4da8b`..`6d382aa`), then `0bf124f` (bundled shots follow their `assets` prop — a Media-section swap left the preview stale), `afe8f01` (templates `audio` control), `6bb350c` (`.vidtsxtemplate` importer + `scripts/template-pack.mjs`), `33c7bf7` (docs).
- **Verified live** on isolated dev instances: Media section swap / attach / detach / undo; template import from the gallery and by double-click, audio play / replace / remove / looks, a render whose MP4 carries both sounds, remove, downgrade confirm, a `lodash` import refused. Two bugs the live checks caught are fixed (the stale preview; a downgrade "Yes" that did nothing).
- **Gates:** `check:types` 26 / 10; full vitest 336 files / 2904 tests green.
- **Installer:** `dist/VidTSX-Studio-Setup-1.1.0.exe` 375.1 MB, 2026-10-02 12:22, `check:bundle` ok, DSN in the main bundle only, `studio-text-edit` off. `dist/win-unpacked` smoke on a throwaway profile: Home, the first-launch crash prompt, a template import + the D14 refusal + audio over `/asset`, a bundled shot import — zero error-level log lines.
- **Next:** Hasan's pass on this installer; on his "go", runbook steps 5–8 (flip, tag `v1.1.0`, smoke the CI draft, publish).

## 2026-10-01 — V1 GO-LIVE: Hasan's pass clean, Agent SDK 0.3.286 verified in the packaged app, scope widened

- **Hasan's pass:** "it looks working" on the 2026-09-30 installer. He also bumped the Agent SDK to 0.3.286
  (Claude Code 2.1.286) and added Fable 5.1, Opus 5.5 and Sonnet 5.5 to the Claude catalogs.
- **Verified the bump:** types at baseline, lockfile in sync for CI, full suite green; all eight Claude ids
  answered a real subscription turn headless; the SDK's native `claude.exe` is auto-unpacked by
  electron-builder and the packaged app ran real turns on all three new models plus an adaptive-thinking
  turn on Fable. Installer is 375 MB now (the new executable compresses worse).
- **Scope widened (Hasan: "I want to do all tasks we agreed on before"):** the open items from the testing
  rounds are V1 work, listed as runbook step 3a; built before the flip.

## 2026-09-30 — V1 GO-LIVE: decisions taken, old release deleted, repo audit, first-launch crash-reporting prompt

Runbook `docs/v1-go-live-runbook.md` §1 holds the seven decisions as Hasan made them; the log has the detail.

- **Decided:** flip this repo public as-is, but only after Hasan has confirmed every planned feature works (D1);
  unsigned (D2); crash reporting ON with a one-time first-launch prompt (D3); text-based editing stays hidden
  (D4); personal files out of the repo (D5); the July 1.0.0 release deleted so 1.1.0 is the first stable
  release (D6); tests stay in CI (D7).
- **Done:** `gh release delete v1.0.0 --cleanup-tag` (no releases, no tags remain). Audit of every root file
  and every file over 2 MB: `my_notes.md`, `.claude/settings.local.json` and the four A/B report HTMLs
  (two embed frames of the raw footage) untracked and gitignored — all six entered the repo on 2026-09-09,
  after the accidental public window, so none was ever exposed.
- **Built + live-verified:** the first-launch consent prompt (`CrashReportingPrompt.tsx`, the
  `crashReportingPrompted` setting, the pure rule in `src/shared/crash-reporting-prompt.ts` with tests).
  On isolated dev instances with a dummy DSN: shows once on a fresh profile, "Not now" and "Enable" both
  record the answer and retire the card, a relaunch never asks again, a build without a DSN never asks.
- **Crash reporting, two bugs found by the live test and fixed** (`crash-reporting.ts`; Hasan's Sentry
  project and the `VITE_SENTRY_DSN` secret are in place). (1) The SDK was started lazily on consent, but
  `@sentry/electron` refuses `init` after app `ready`, so on a fresh install Enable saved the setting and
  captured nothing until the next launch. Now the SDK starts at boot whenever a DSN exists and consent only
  gates `beforeSend`; the session tracker is dropped and client reports are off so an unconsented client
  makes no request at all. (2) Log lines written before consent rode along as breadcrumbs inside the first
  consented event; `beforeBreadcrumb` is now gated and the trail cleared on every consent change. Both
  verified against a local fake ingest endpoint with the captured bodies grepped: consent off → zero
  requests (idle, a batch of errors, a graceful quit); on → three envelopes per batch; no pre-consent text
  in any consented payload; the Windows username in zero payloads; `C:\Users\Malak` → `C:\Users\[user]`.
  Full log in `docs/crash-reporting-release-checklist.md` (Stages 2–3) and the runbook.
- **Updater noise kept out of Sentry** (`updater-service.ts`): a failed update CHECK (offline, GitHub
  unreachable, 404 on a private repo) now logs at warn — a breadcrumb, not an event — and only a failed
  DOWNLOAD stays at error; electron-updater's own logger errors are warnings too. Found because the
  packaged real-DSN batch carried two Updater events beside the three test events.
- **Gates:** `check:types` 26 / 10 (baseline); full vitest 325 files / 2844 tests green; updater tests 8/8.
- **Pending Hasan:** confirm the `[packaged-real-dsn]` batch in his Sentry project (three test events plus
  the two pre-fix Updater events); then his full pass on the rebuilt installer; then the commit, the flip
  and the tag.

## 2026-09-26 — V1 GO-LIVE: runbook written, repo prep + local gates done, waiting on Hasan's decisions and pass

`docs/v1-go-live-runbook.md` is the one ordered list from "all the code is built" to "users are
installing it" (owner per step, log at the bottom). It starts from the finding that every V1 plan
phase and workstream has landed, so what remains is release mechanics.

- **Where we stand (verified):** version 1.1.0 (the July 1.0.0 tag is burned), no `v1.1.0` tag, repo
  PRIVATE, CI never run, every installer ever built is unsigned (the "signed" note in
  `V1_RELEASE_PLAN.md` was wrong), no root `.env`, app keys are pre-rotation, secret scan of history
  since 2026-08-16 clean.
- **Step 1, repo prep (uncommitted):** `release.yml` build step gets an 8 GB heap; README rewritten
  around the sidebar as it ships (Studio first, Agents / Flows / Videos / 3D / Templates added,
  provider lists match `V1_HIDDEN_PRESET_IDS`, "Coming soon" replaced); `SECURITY.md`,
  `CONTRIBUTING.md`, `docs/release-notes/1.1.0.md`, `docs/launch/feed.example.json`; the update
  checklist header now points at the runbook.
- **Step 2, local gates, all PASS:** `check:types` 26 / 10 (baseline); `npm run build:win` exit 0
  (`dist/VidTSX-Studio-Setup-1.1.0.exe`, 344.6 MB, `check:bundle` ok); artifact-level hidden-surface
  check read verbatim from the (unminified) renderer bundle: the five env-gated flags are `void 0`,
  `flows` / `video-studio` / `studio-filters` / `agents` on, `studio-text-edit` and `license-ui` off;
  clean-profile smoke of `win-unpacked`: window at 1.7 s, alive at 30 s, zero error/warn, only provider
  registrations; vitest 324 files / 2840 tests passed, 0 failed.
- **CI blocker found and fixed:** `package.json` declares `es-module-lexer@2.3.1` but the committed
  `package-lock.json` root block did not, so the workflow's `npm ci` would have refused the lockfile on
  the first run. `npm install --package-lock-only` added exactly that line.
- **Next (Hasan):** decisions D1–D7 in the runbook §1 (flip this repo as-is, unsigned, crash reporting
  compiled out, text-edit hidden, untrack `my_notes.md`, leave v1.0.0, keep tests in CI) and the pass on
  the installed 1.1.0 build (step 3). Then: commit by pathspec, flip public, `git tag v1.1.0`, smoke the
  CI draft, publish, `feed.json` on vidtsx.com.

## 2026-09-17 — TEXT-BASED EDITING slice 1 (row 8): edit the video by editing its transcript

`docs/NEXT_FEATURES_DESIGN.md` §Q5, "Slice 1 outcome", holds the four deviations from the design, what the live pass
found and what is not verified. Behind the dev-preview flag `studio-text-edit` (on in dev, hidden in production).
Committed 2026-09-18.

- **What:** a Transcript tab in the Studio editor's left pane — click a word to seek, karaoke highlight, select words
  and delete them (edges snapped to the waveform's RMS), deletion pills that restore, filler tint + remove, read-only
  while an Auto Cut review is open. A delete is N timeline spans in ONE undo step.
- **How:** no new IPC — the snapper moved to shared (`cut-planner.ts` + `cut-snap.ts` out of `src/main/`) and the
  renderer already reads the transcript and `rmsDb` through `studioCacheRead`. Deletes go through the range-delete span
  ops scoped to the clips under the selection, not the asset-wide `apply-cut-proposal`. Restore is a new op
  (`restoreDeletion` + `insertGapOnTrack`).
- **Fixed on the way:** `splitClip` and `cutSpanFromClips` ignored clip speed (`clipRate`); words whisper.cpp stamps
  with ~0 duration no longer vanish from the panel.
- **Verified:** 37 new unit tests; `check:types` at baseline (26 / 10); a 23/23 CDP pass with real mouse and keyboard
  input on an isolated instance.
- **Open:** `trimClip`, `trimClipRippleAll` and `applyCutProposal` still ignore clip speed; captions still drop the
  durationless words (`clipWords`); not verified on a long project, on AssemblyAI / ElevenLabs transcripts, or by ear on
  real speech — Hasan's pass before the flag flips.

## 2026-09-17 — TEMPLATES BATCH 2: ten built-ins, overlay support, a verify script

`docs/templates-batch-2.md` §9 holds the full log, every deviation and what is still open.

- **Batch 1 first:** committed by pathspec (`560ea19`), then the UI click-through it never had, over CDP — every control
  type, a look, format switch, Reset, Render → Rendered tab, library open leaving the mode, autosave across a real
  restart. Nothing needed fixing.
- **Nine templates** from `vidtsx-addons`: `github-stars` (Milestones), `quote-card` (Social), `before-after` and
  `app-launch-teaser` (Product), `subscribe-bumper` and `logo-reveal-mask` (Openers, Archivo webfont), and three
  overlays — `name-title-third`, `social-handle-bug`, `key-point-callout`. Each with a form, 4–5 looks, a thumbnail.
- **Overlays (C2):** stand-in footage behind the Player (`shared/templates/backdrops.ts`, a Backdrop picker — preview
  only, the composition never sees it) and a Render dialog that opens on transparent WebM (`RenderSettingsModal`
  `initial`). **Slider (C1)** for bounded numbers of at most 1000 stops.
- **`scripts/template-verify.mjs` (T1):** the app's real render path headless — stage, wrapper with the font proxy,
  bundler, `/asset`, `renderStill` — for every format, the defaults and every look; `--thumb` writes `thumb.jpg`, over
  a backdrop for overlays. The built-ins test now also fails on shipped assets nothing names (H1).
- **Verified:** the script over all ten × 3 formats × every look (each looked at); a 73/73 CDP pass over all ten in
  the app, including Archivo `loaded` inside the preview and the backdrop layer; a transparent WebM rendered from the
  UI with measured alpha, composited over a photo. `check:types` at baseline (26 / 10); vitest 2714 tests — 9 load
  timeouts in the full run, all green on rerun.
- **Not verified:** that WebM over footage inside a Studio project. The addons repo's `AUTHORING.md` still lacks a
  `template.json` section.

## 2026-09-17 — TEMPLATES P0–P3: a third Creator mode — ready-made compositions you fill in

`docs/templates-plan.md` holds the decisions (§1), the manifest (§2), the working copy (§4) and what is next (§7).

- **What:** TSX Creator gains `Prompt | Agent | Templates`. Templates mode turns the left column into a gallery;
  opening a template swaps it for that template's **form** (groups, looks, a format picker), the centre previews it
  live and renders it with the form's values. No provider, no prompt. Values autosave per template. One built-in:
  `vidtsx/youtube-subs` (from `vidtsx-addons`), under the new `resources/templates/` (extraResources).
- **An extension kind, like agents and flows:** `template.json` per folder, the shared `<namespace>/<name>` id, a
  two-root folder-as-truth scan where the higher version wins. The form is **declared in the manifest, never parsed
  from the TSX** (NEXT_FEATURES_DESIGN Q8's rule); controls are Q8c's `ParamSpec` plus `text` / `textarea` / `image`,
  rendered by the shared `ParamField` so transitions and effects can reuse it. The importer and `.vidtsxpack` are P4.
- **The working copy** (`{userData}/template-work/<ns>/<name>/`): main stages the entry per format and BOTH preview
  and render load that file. Three facts forced it, each checked in code: a built-in cannot render in place (the
  wrapper is written beside the entry; `resources/` is read-only when installed); a job's `width`/`height` do NOT size
  a render (the bundle's `<Composition>`, built from the file's `compositionConfig`, wins — so a format rewrites that
  literal); and `staticFile(prop)` breaks at render (only string literals are rewritten today — so staging routes
  every call through `window.location.origin + '/asset?path='`, which the preview server and the render bundle server
  both serve).
- **Also:** the Rendered tab came out of `MotionPreviewPanel` (734 → 594 lines) into `useRenderedOutputs` +
  `RenderedOutputView`, shared by both panels. The Creator's own props panel is untouched — it is preview-only by
  design (its footer says so); only the template path passes `inputProps` to the render.
- **Gates:** `check:types` at baseline (26 / 10), no error in a touched file; vitest 299 files / 2586 passed; 38 new
  tests in `src/shared/templates` + `src/main/services/templates`, several of which run against EVERY folder under
  `resources/templates` (manifest parses, files exist, keys appear in the source, stages and transpiles in every
  format) — adding a built-in is dropping a folder in and running them.
- **Verified for real, headless** (`.vidtsx-temp/templates-verify/run.mjs`: scan → stage → the app's
  `generateWrapper` → `@remotion/bundler` → the `/asset` route → `getCompositions` → `renderStill`): portrait reported
  1080×1920; non-default text, number and accent arrived; a relative avatar and an absolute background both fetched
  200 and are in the frame.
- **Not verified: the UI.** No click-through yet (mode toggle, gallery, form, autosave round trip, format switch,
  Render). Hasan's own dev app was running without a debug port and holds the single-instance lock, and a second dev
  instance would have rewritten `out/main/chunks` under it. Needs a dev-app restart (new IPC) and a CDP pass.

## 2026-09-17 — AI MODELS REDESIGN P6: the live pass (CDP), and what it fixed

`docs/ai-models-redesign.md` §6 → the new **§8 verification log** holds every row (this laptop, RTX A3000 6 GB).
Harness: `docs/ui-automation-cdp.md` (new last section — viewport emulation, `var` helpers, no source edits during a run).

- **Screen:** every section at 1280×800 and maximized, no horizontal scroll; hidden presets absent from the Providers
  table, the catalogs accordion and the `llmProvidersGet` presets the Studio agent and Agents pickers read; Antigravity
  and Codex rows both Ready (Codex 0.154.0). Overview, Image, Video, Audio, 3D read as designed.
- **Codex:** one 1536×1024 image through the app's `imageGenerate` on `codex-cli` in 28.7 s, usage row `codex-cli` /
  `gpt-image-2` / `costUsd: 0`.
- **The never-run click test:** Wan 2.1 1.3B Q4 + companions downloaded through the app (~4 GB at ~3.4 MB/s); after
  the rescan the Videos screen offers "Local (open source)" with the model, the Flows `generate_video` node reports
  available, and 2 s clips were submitted through `videoGenerate` on the local provider (16:9 first, which kept
  overflowing the VAE decode while the ladder was being built, then 1:1 for the run that went to the end). It **completed and was filed** — 2 s, 480×480 (1:1), 16 fps VP8 webm, 204 KB, usage row `local` / `costUsd: 0` — 29 minutes wall on this 6 GB laptop: out of memory at load → rung 0 (offload + encoder on CPU) sampled 20/20 then overflowed in the VAE decode → rung 1 (VAE on CPU) re-sampled and decoded on the CPU (~16 min). `verifiedOn: 2026-09-17` is now on the Wan 2.1 1.3B Q4 registry entry, so its Recommended row reads "Tested".
- **Fixed on the way (in this commit):** `refreshSdVideoBinary()` after an in-app sd-cli install (the video engine had
  captured the binary path at init — an install after a first Videos listing left Local empty until restart);
  `clipOnCpu` / `vaeOnCpu` on the local video request and runner (`--clip-on-cpu` / `--vae-on-cpu`) and an
  out-of-memory **retry ladder** in `LocalSdVideoProvider` under the same job — rung 0 offloads the weights and puts
  the text encoder on the CPU (Wan's umt5 expands to 5.9 GB, more than a 6 GB card holds beside the model), rung 1
  moves the VAE too, and an overflow after the last sampling step jumps straight to that rung (the fit estimate counts
  the model file only); a per-provider `jobTimeoutMs` on `VideoProvider` (local: 3 h; the engine's 30-minute cloud
  default cut the first successful run's CPU decode) and the tracker now cancels the provider's work when it gives up
  (an abandoned sd-cli used to keep the GPU); the runner's
  progress parser keys on sd.cpp's `s/it` rate so the tensor-loader bar is no longer reported as sampling steps
  (`video-cli-progress.test.ts`); Overview's runtimes row marks a bundled dev drop-in as not removable and shortens the
  ffmpeg release label.
- **Machine notes:** this laptop's `resources/binaries/sd-cli.exe` was a lone 618 KB exe without DLLs (exit
  `0xC0000135`) that also made the in-app install skip itself — moved aside as `sd-cli.exe.broken-drop-in.bak`, the
  app then installed the pinned release into `%APPDATA%\VidTSX Studio\sd-cli` (104 MB). C: read 0.17 GB free during
  the unit suites (the ai-runtime / python-models tests pre-allocate catalogue-sized files under %TEMP%) and 44 GB
  afterwards — those 16 failures are disk, not code.
- **Gates:** `check:types` at baseline (26 / 10); vitest local-video-engine + video-engine 90 passed (new
  `video-cli-progress.test.ts` 3, provider OOM-retry tests 2).
- **Not verified:** the 12 GB+ video tiers (GPU-VM leg), the Studio / Agents `generate_video` calls themselves, Image
  Studio's own click path for Codex, and a screenshot of the running job card (the panel draws cards only for jobs it
  submitted; the driver used the IPC).

## 2026-09-17 — AI MODELS REDESIGN P5: OpenAI Codex as a subscription image provider

`docs/ai-models-redesign.md` §3.7 (D4; the spike of 2026-09-16), phase P5. The Antigravity pattern, one more time.

- **Provider** `src/image-engine/providers/codex-cli-provider.ts` — `CodexCliImageProvider` (type `'codex-cli'`, the
  reserved second CLI slot in `ImageProviderConfig.type` and `ImageProviderType`): one model, "GPT Image 2
  (subscription)", listed only when the probe says installed + signed in; text-to-image and multi-reference (≤ 3
  references staged to files for `-i`); the requested width × height buckets onto the nearest of 1024², 1536×1024,
  1024×1536 (`nearestCodexSize` — the request is an aspect, not a pixel size); PNG dimensions read from IHDR.
  Registered from `image-init.ts` (`registerCodexCliImageProvider`, `CODEX_CLI_IMAGE_PROVIDER_ID`, in
  `INSTANCE_IMAGE_PROVIDER_IDS`); the `'codex-cli'` image dialect carries its param schema.
- **Service** `src/main/services/codex-cli.ts` — detects the native binary inside the npm global package
  (`%APPDATA%\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\…\codex.exe`; the
  `codex.cmd` shim would need a shell and a shell means quoting a multi-line prompt; `VIDTSX_CODEX_BINARY` overrides),
  probes `codex --version` + `codex login status` (cached 60 s, re-probed on window focus by `useImageCliStatus`),
  generates with `codex exec --skip-git-repo-check -s read-only -C <tmp> -c model_reasoning_effort=low --json -o
  last.txt --ephemeral "<instruction>" [-i <refs>]` — stdin closed, prompt before `-i`, `OPENAI_API_KEY` stripped
  from the child so the run bills the plan — and harvests the newest `exec-*.png` written after the start stamp under
  `$CODEX_HOME/generated_images/<thread_id>/` (the thread id is the first JSONL event; the tool call itself is
  invisible in `--json`). Concurrency 1 with a queue; 10-minute timeout.
- **Pure, tested** `src/main/services/codex-cli-protocol.ts` (`codex-cli-protocol.test.ts` 13): JSONL parsing that
  skips the stdin notice, thread id, last agent message, usage, the DONE check, the instruction (size pinned, prompt
  verbatim, no commands / files, "reply with exactly: DONE"), the argument order, the harvest rule, version and
  login-status parsing, the size bucketing and the PNG header.
- **`--ephemeral` — tried and recorded.** Text probe: 11.7 s, `thread.started` still carries a thread id, `-o` still
  writes. Image trial (codex-cli 0.154.0, one 1536×1024 clapperboard, low effort): **38 s, DONE, and
  `generated_images/<thread_id>/exec-….png` (1.7 MB) was still written** — so the service runs ephemeral by default
  and app runs stay out of `codex resume`. Usage on the plan for that turn: 36 k input tokens (17 k cached), 116 out.
- **Providers page:** a second `CliSubscriptionRow` ("OpenAI Codex", Images) in `SubscriptionsSection` through
  `useImageCliStatus('codex-cli')` — `image:cli:status` now probes both CLIs and carries `version`, shown beside the
  name; install copy `npm i -g @openai/codex`, then `codex login`. `useActiveImageProvider` offers "OpenAI Codex
  (subscription)" whenever the provider lists a model. Usage rows log provider `codex-cli` at `costUsd: 0` (no
  catalogue price).
- **Gates:** `check:types` at baseline (26 / 10) after adding `'codex-cli'` to the shared `ImageProviderType`; vitest
  main IPC + image-engine + features 491 passed, protocol tests 28 (agy 15 + codex 13). **Not verified live:** the
  Providers row detecting this machine's Codex through the app, and one image from Image Studio — P6.

## 2026-09-17 — AI MODELS REDESIGN P4: Overview — Hardware, a Runtimes table, Storage

`docs/ai-models-redesign.md` §3.1 (D8), phase P4. `components/overview/` replaces `MainContent.tsx`.

- **Hardware** (`HardwarePanel`): GPU · VRAM (total / free) · CUDA · RAM · Disk with a refresh, on the template's
  `LocalSectionPanel` header. The decorative scan animation is gone; loading is one line.
- **Runtimes** (`RuntimesTable` + `RuntimeRow`): one table — whisper.cpp (transcription · captions · Studio scripts),
  sd-cli (local image and video), GPU encoder (full ffmpeg for Studio proxies), AI runtime (Python + PyTorch) — with
  Runtime · Status (badge + the pinned release) · On disk · Install / Remove. New IPC `system:runtimes:get`
  (`main/services/system-runtimes.ts`: installed, in-flight, release tag, bytes under each runtime's folder — whisper's
  `models/` excluded) and `system:runtime:remove` (deletes the folder; whisper keeps its models; refused mid-install).
  Install reuses each runtime's own IPC (`whisperBinaryInstall`, `sdImageCliInstall`, `studioProxyEncoderInstall`);
  progress comes from the download broadcast (`sdcli-binary`, `ffmpeg-full`) or whisper's progress channel
  (`hooks/useSystemRuntimes.ts`). The AI runtime keeps its own row (`AiRuntimeRow`: variants, Repair, Remove with
  models) as the table's last row. `SDCLI_RELEASE_TAG` and `WHISPER_RELEASE_TAG` are exported for the release column.
- **Storage** (`StoragePanel`): the AI models folder with Change (`useSettings.browseAiModelsFolder`) and Open (new
  `system:models-folder:open`), then installed count · size per category — image and video from the library scan,
  audio from the whisper list, 3D from the Python catalogue (`hooks/useLibraryStorage.ts`) — and a total.
- **Dropped:** the Audio Engine / LLM Engine / Embedding Engine / Image Engine cards — the hidden engines leave no row;
  sd-cli and the AI runtime moved into the table.
- **Gates:** `check:types` at baseline (26 / 10); vitest main IPC + features + shared 865 passed. Not driven live (P6).

## 2026-09-17 — AI MODELS REDESIGN P3b: local video is a provider of the video engine

`docs/ai-models-redesign.md` §3.5 (D3: "this is the intended use — in Videos, in agents, in Studio, in flows, like
everything else"), phase P3b.

- **Provider.** `src/video-engine/providers/local-sd-video-provider.ts` — `LocalSdVideoProvider` implements
  `VideoProvider` over the local sd-cli engine (`videoLocalEngine`, injected as a small interface so the tests need no
  Electron): `getSupportedModels()` = the installed models with every companion present, `[]` without sd-cli (the
  LocalSdImageProvider rule — offered only when it can generate); `submit` maps the engine's normalized request onto
  sd-cli (`local-video-request.ts`: 2–5 s → 4n+1 / 8n+1 frames per family, 16:9 · 9:16 · 1:1 from the model's native
  size, a first frame staged to a file for i2v), runs the injected preflight, enqueues; `poll` reads the job map the
  engine callbacks fill (the provider is their one owner) and reports the sd-cli step progress; `cancel` kills the run.
  A finished clip is a `file://` URL — `downloadVideo` in `video-studio-save.ts` reads that scheme from disk, so the
  clip goes through the same Gate B frame sampling and Video Studio filing as a cloud clip.
- **Progress on the job card.** `VideoPollResult` / `VideoJobRecord` / `VideoJobData` carry
  `progress { step, totalSteps, percent }`; the tracker updates on a percent change; `VideoJobCard` shows a bar and
  "Step n/N" beside the elapsed time (cloud providers still report none).
- **Registration** (`video-init.ts`): `registerLocalVideoProvider()` after the cloud presets, id `local`, named
  "Local (open source)" like Image Studio's; `ensureVideoProvidersReady()` (the cloud re-init + the lazy video-library
  scan) runs before every listing and submit; `usableVideoProviderIds()` hides a provider with no models, so the
  Videos screen, the Flows node and the agents never see an empty Local. The models-folder scan stays off the startup
  path — the first listing pays it. `useVideoLibrary.rescan` broadcasts `vidtsx:video-providers-changed`, so a model
  that just finished downloading appears in the pickers without a remount.
- **Reach.** The Videos screen, the Studio agent's `generate_video`, the Agents `generate_video` tool / Flows node all
  submit through `videoEngine.submit`, so they reach it unchanged; tool copy now names "local"; `resolveToolCapabilities`
  gates on `hasUsableVideoProvider()` (cloud key or a ready local model). The usage row logs provider `local`,
  `costUsd: 0` (the model publishes a 0 rate). Content Safety: Gate A in `submit`, the input-image gate before the
  provider, Gate B on the output in the clip store — the same three chokepoints as every provider.
- **Preflight** moved to `src/main/services/sdvideo-preflight.ts` (`applySdVideoPreflight`: won't-fit → typed refusal,
  over-VRAM → CPU offload), injected as the provider's `prepare` hook.
- **Removed:** `VideoGeneratePanel`, `useVideoGenerate`, the `sdvideo:generate` / `:progress` / `:complete` / `:error` /
  `:cancel` channels, their types, preload and d.ts entries, and the generate / cancel handlers — the AI Models Video
  section manages models only (its strip says how many are ready and where they generate).
- **Gates:** `check:types` at baseline (26 / 10); vitest video-engine 59 passed (new `local-video-request.test.ts` 6,
  `local-sd-video-provider.test.ts` 8); agents + studio tools + flows + main IPC 478 passed (`generate-video.test.ts`
  mocks the readiness helper). **Not verified live:** the Videos screen listing "Local (open source)", a clip from it,
  and the Studio / Agents / Flows paths — the P6 CDP pass (Wan 2.1 1.3B Q4 download + the never-run click test).

## 2026-09-17 — AI MODELS REDESIGN P3: one template for the local-model sections (Image · Video · Audio · 3D)

`docs/ai-models-redesign.md` §3.3–§3.6, phase P3.

- **Template** (`components/local/`): `LocalModelPage` fixes the order status strip → Defaults → Installed →
  Recommended → All models, full width. `LocalModelStatusStrip` = the runtime chip (`LocalRuntimeChip`: state badge +
  an inline Install with the download bar — the sd-cli and whisper setup cards folded into one line) + models folder +
  Change / Open / Rescan / Import…. `LocalSectionPanel` is the UI_SPEC panel header with a count, a caption line, an
  empty state and a disclosure variant; `CatalogModelRow` = name · family · `TierChip` · Fits · Tested, the size under
  it, Download / Get ↗ / the shared DownloadCell; `RecommendedModelsList`; `AllModelsList` (collapsed, the count in
  the header, search when open); `LocalDefaultsRow`; `InstalledSimpleRow`. Rows are `types.ts` `CatalogRowData`, so a
  page maps its own model shape and the row knows no category.
- **Pure, tested:** `services/catalog-sections.ts` (`splitCatalogSections` — uninstalled entries only, Recommended
  laptop tier first; `filterCatalog`; `profileToCatalogRow`) and `services/whisper-catalog.ts` (Whisper as one family:
  downloaded = Installed, `base · small · large-v3` = Recommended, all five sizes under All, a one-line hint per size).
  `services/download-labels.ts` holds the speed / phase copy the strips share.
- **Runtimes:** `hooks/useSdCliRuntime.ts` (installed + one-click install + `sdcli-binary` progress) is one hook for
  the Image and Video strips (`SdCliRuntimeChip`) and took that state out of `useImageLibrary` (406 → 344 lines);
  `AiRuntimeChip` puts the AI runtime on the 3D strip (recommended-variant Install / Update / Repair with the phase
  copy) — variants and Remove stay on Overview (P4).
- **Pages.** Image: strip (sd-cli, folder, Change / Open / Rescan / Import…) → Installed → Recommended (the 8 marked
  entries) → All models (the other 26, Civitai link-only rows included) → Image tools (flag). Video: strip (sd-cli,
  Open / Rescan) → the generate panel (until P3b) → Installed → Recommended (the 5) → All; a "Tested" chip renders only
  where the registry carries `verifiedOn` (new on `ModelProfileEnvelope` and `ProfileModelIpc`, mapped by the scan
  handler; no entry has it yet — P6 earns the first). Audio: strip (whisper.cpp chip + one pointer "Cloud transcription
  and sound generation use your provider keys → Providers", a deep link to that section) → Defaults (default
  transcription model) → Installed (a Default chip on the active size) → Recommended → All; the sherpa voice engine
  stays env-gated below as a second family. 3D: strip (AI runtime chip, Open folder / Rescan — `modelsOpenFolder` now
  accepts `3d`) → Installed → Recommended (a handful of entries, so no All disclosure).
- **Removed:** `ImageLibraryHeader`, `SdCliSetupCard`, `ProfileCatalogList`, `WhisperModelsSection`. `FamilyBadge`
  learned `whisper` and `triposr`.
- **Gates:** `check:types` at baseline (26 / 10); vitest ai-models + model-library 17 passed (new
  `catalog-sections.test.ts` 6, `whisper-catalog.test.ts` 3). Not driven live — the P6 CDP pass. Seen while running
  the full suite before committing P1 / P2: two `python-models/service.test.ts` cases fail with ENOSPC (C: had 1.6 GB
  free — the test pre-allocates catalogue-sized files under %TEMP%), and nine studio tests that timed out beside a
  concurrent tsc run passed alone.

## 2026-09-16 — AI MODELS REDESIGN P2: the section rail and the Providers page

`docs/ai-models-redesign.md` §2 + §3.2, phase P2 (Hasan: "go for it" on the rail).

- **Rail.** `AiModelsSections.tsx` (replaces `AiModelsTab.tsx`) = `AiSectionRail` + the active section, full
  height and width under the toolbar. Sections come from `types.ts` `AI_SECTIONS` in three groups — Overview ·
  Providers · Usage / **Local models:** Image · Video · Audio · 3D (LLMs, Embeddings behind their flags) /
  Content Safety. Usage is its own entry (D9). Deep links: `vidtsx:navigate` now carries an optional
  `section`; Home's status strip (providers / runtime / whisper), the Transcribe screen's "install whisper"
  and the Agents "add a provider" button land on Providers, Overview or Audio instead of the first section.
- **Providers** (`providers/ProvidersContent.tsx`, one Save in the header): **API keys** as a table
  (`ProviderKeysTable` → `ProviderKeyRow` per registry provider on the shared `ProviderGridRow` columns
  Provider · Powers · Status · Key · actions; own-key LLM rows via `LlmKeyRow` — Claude (API key) plus any
  grandfathered saved MiniMax / Kimi config, badged "Legacy"); **Subscriptions** (`SubscriptionsSection`:
  Claude through `LlmSubscriptionRow`, Google Antigravity through the generic `CliSubscriptionRow` — the
  Image tab's `GeminiCliSetupCard` folded into a status row + "How to set up" expander; `useGeminiCliStatus`
  generalised to `useImageCliStatus(providerId)` so the Codex row of P5 is one more call); **Custom
  endpoints** only when one is saved or the H5 flag is on; **Defaults** (`ProviderDefaultsBar`); **Model
  catalogs** as an accordion (`ModelCatalogSection` → `ProviderCatalogRow` per provider, collapsed to
  "Fal — 12 image · 4 video models — Defaults", configured providers first, the rest under "Providers
  without a key"; the existing `ModelCatalogCard` renders inside the open row). The page's unsaved state
  lives in `hooks/useProviderKeyDrafts.ts`; the grouping and "configured" rules are pure in
  `services/catalog-groups.ts` (tested). `EnabledToggle` extracted from `LlmProviderRow`.
- **Removed:** `AiModelsTab.tsx`, `ApiKeysSection.tsx`, `GeminiCliSetupCard.tsx`, `useGeminiCliStatus.ts`,
  `ComingSoonPlaceholder.tsx` (every section renders).
- **Gates:** `check:types` at baseline (26 / 10); vitest ai-models + preset tests 19 passed (new
  `catalog-groups.test.ts` 5). **Not yet driven live** — Hasan's own dev instance holds the single-instance
  lock without a debugging port; the P6 CDP pass covers every section at 1280×800 and maximized.

## 2026-09-16 — AI MODELS REDESIGN P1: the quick wins (hidden presets, full width, Video on, recommended lists)

`docs/ai-models-redesign.md` (Hasan's feedback of the day; decisions D1–D9 answered) — phase P1 of six.
Feedback list: `docs/UI_POLISH_PLAN.md` item 1.

- **One preset rule, two readers.** `src/main/services/llm-preset-visibility.ts` holds the V1 hidden set —
  now `openai`, `gemini`, `zai`, **`minimax`, `kimi`** — plus the H4 override (`VITE_FF_ALL_PROVIDERS`) and a
  new gate for the `local` preset (`VITE_FF_AI_LLM`: it follows the LLMs tab, and the runtime probe is
  skipped when the flag is off). `handleLlmProvidersGet` reads it as before (presets only, saved configs
  grandfathered), and `getProviderModelCatalogs()` now applies the same rule — the Model catalogs grid had
  been rendering a card for every hidden provider (OpenAI, Gemini, Z.AI) because nothing filtered it.
- **Full width.** `AiModelsScreen` drops `max-w-6xl mx-auto`; the section rail comes with P2.
- **Video tab on.** `ai-video-models` moved from `ENV_GATED` to `FEATURE_FLAGS: true`; `VITE_FF_AI_VIDEO`
  removed from `.env.example` and `env.d.ts`.
- **Recommended + tier.** `ModelProfileEnvelope.recommended` (8 image entries, 5 video entries marked per the
  plan's §3.4/§3.5) and `ProfileModelIpc.recommended` / `.tier`, the tier derived by `hardwareTierFor(
  estimateNeededVramGB(requirement))` in `fit.ts` — the same number the Fits badge grades, so the label and
  the badge can never disagree. UI consumption is P3.
- **Gates:** vitest main + shared + renderer **1797 passed** (219 files; new `llm-preset-visibility.test.ts`
  5, `fit-tier.test.ts` 3, llm-handlers +2: a saved kimi config survives the hide; local hidden without the
  flag, offered with it); `check:types` at baseline (26 / 10). Live CDP pass of the screen is P6's.
- **Codex spike (D4) ran the same day** — three headless `codex exec` generations, ~40 s each, sizes
  honoured, an edit from a reference kept the composition; details and the harvest rule in the plan's §3.7.

## 2026-09-13 — STUDIO: opening a project is staged and faster — shot modules off the editor, a disk cache of transpiled modules, no-op media patches, reconcile fingerprint (feedback 2)

`docs/studio/VIDEO10_TESTING_FEEDBACK.md` item 2. Clicking the video-10 card stalled before the editor was
usable; "Loading project…" only covered the `studio:project:load` IPC.

**Open-to-interactive, as measured.** t0 = `pointerdown` on the project card. Interactive = the latest of
(a) the editor shell visible (`[data-project-menu]`), (b) every ready shot module settled (62
`studio-open:shot:import-end` marks; a failed module is a placeholder by design and counts), (c) the first
Player frame painted (no "Loading…" tile in the Player, every visible `<video>` at `readyState ≥ 2`, then
rAF + timeout), and (d) the end of the last long task (> 50 ms) followed by 1 s with no long task and no
rAF gap. Read from the renderer's own timeline (PerformanceObserver `longtask`, an rAF gap probe, User
Timing marks); a run whose rAF stalled > 2 s (a covered or minimized window) is thrown away. Every stage
drops a `studio-open:*` mark (`services/open-timing.ts`: `load:start/end`, `media-prepare:start/end`,
`reconcile:start/end`, `shot:ipc-start|ipc-end|import-end:<id>`, `waveform:read:<id>`, `interactive`),
cleared at the start of each open. Dev build (`electron-vite dev`) on this laptop, video-10 read-only
(open, wait, back): project.json identical apart from `updatedAt` — which no longer moves on an open.

**What the profile said (before).** Cold open: project:load IPC 22 ms, shell visible 272 ms, shot IPCs
921→1822 ms (median 717 ms of main-process transpile wait, renderer idle meanwhile), imports done 2331 ms,
9 long tasks = 1504 ms blocking (longest 601 ms), interactive 2619 ms. Warm: IPCs cached in main (median
107 ms), interactive 1474–1592 ms, still 607–658 ms blocking. A trace (devtools.timeline + CPU profile,
aligned on a click mark) put style + layout + paint at ~110 ms in total; the rest was **React re-rendering
the whole editor** — EditorShell rendered 14× (cold) / 12× (warm) per open, and each render re-ran 113 media
tiles, 62 mounted shot cards, the timeline and the Player. The renders came from: mounting on the reducer's
empty state, then again after `reset`; the Player's ref callback `setPlayer` re-rendering synchronously
inside the mount commit; media-prepare re-announcing 9 proxies + 9 waveforms already on disk, which rebuilt
the asset objects (2–4 renders, a pointless autosave, its "Saved" render, and `updatedAt` moving on every
open); 62 module arrivals held in EditorShell state (3–4 renders); one waveform setState per asset.
Reconcile on video-10 is a readdir (no unknown folders) — no renderer cost. Shot fonts: 5 requests, done
before first frame.

**Built**, in the order the numbers justified:

- **Staged loading + mount gate.** `EditorShell` shows `OpenProgressView` (Reading project → Preparing
  timeline → Loading shots N of 62 → Drawing the first frame, with a bar; stage rules in the pure
  `services/open-stages.ts`) and mounts the editor only once the reducer has adopted the document
  (`useTimeline` now returns `projectId`). `OpenProgressOverlay` covers the mounted editor until the loader
  has settled every shot and two frames have painted, then retires for good (a later regenerate loads
  behind its tile, not behind a curtain); "Open without waiting" appears after 8 s.
- **Shot modules off the editor.** `services/shot-module-loader.ts` — a per-editor store (not global):
  concurrency 6, order from `services/shot-load-order.ts` (under the playhead first, then outward, a tie to
  what plays next, pool-only shots last; a seek of ≥ 1 s re-orders what is still queued), batched snapshots
  (the first arrival and the last one publish at once, the rest coalesce per 120 ms), stable placeholders
  per `shotId@version`. `hooks/useShotModuleLoader.ts` (replaces `useShotModules`) syncs the wanted set —
  from the document's shots while the editor is still mounting, so main starts before the mount — and sends
  each IPC before `setupVirtualModuleGlobals` resolves. `PreviewPanel` and the overlay subscribe with
  `useShotModuleSnapshot` (`useSyncExternalStore`): a module arriving re-renders the Player only.
- **Disk cache of transpiled modules** (`src/main/services/studio/shot-module-cache.ts` +
  `shot-module-resolver.ts`): memo → `<project>/cache/shot-modules/<shotId>/v<N>.json` → transpile (written
  back in the background, tmp + rename). An entry is served only when its source size + mtime match the
  current `v<N>.tsx` (an external in-place edit misses) and its transpiler fingerprint matches
  (`src/main/services/transpiler-fingerprint.ts`: sha256 of esbuild's version + every `.js` under
  `out/main`, so any main build change — transpiler, import rewriter, vendor maps — invalidates every entry
  once). The module-server base URL is stored as a token. It lives under `cache/`, so Clear cache removes
  it (video-10: 62 files, 27 MB). `handleStudioShotModule` goes through the resolver; export is untouched
  (`transpileTsxCached` unchanged).
- **No-op media events stay no-ops.** `services/asset-patch.ts`: `withCacheFile` returns the same asset when
  the document already records that path + status, `patchProjectAsset` the same project when nothing
  changed; `updateProject` skips the save for an identity update; `missingAssetIds` is replaced only when
  its contents differ; the open's waveform reads land in one `setWaveforms`.
- **Player handle out of React state.** `usePlayback` keeps the Player in a ref and attaches its listeners
  in the ref callback; `play()` / `pause()` replace the exposed `player`; the returned object is memoised.
- **Reconcile fingerprint** (`shot-reconcile.ts`): the known ids + each unknown folder's newest `v<N>.tsx`
  size/mtime; unchanged since the project's last complete scan → return at once, nothing read or validated.
  It also removes a quiet cost: an unadoptable folder used to be re-validated on every window focus (the
  "already reported" memo was checked after the gate).

**Before / after** (video-10, same driver; cold = first open after an app restart, then two warm opens):

| run | open-to-interactive | blocking (Σ long task − 50 ms) | longest task | EditorShell renders |
|---|---|---|---|---|
| cold, before | 2619 ms (2748 traced) | 1504 ms (1628) | 601 ms (757) | 14 (traced) |
| warm 1, before | 1592 ms | 607 ms | 316 ms | 12 (traced warm) |
| warm 2, before | 1474 ms | 658 ms | 310 ms | |
| cold, after | **1971 ms** (other cold runs of the final code: 1880, 1904, 2004, 2266) | 651 ms | 498 ms | |
| warm 1, after | **1193 ms** | 674 ms | 450 ms | 8 (traced; 3 are loading views) |
| warm 2, after | **947 ms** (862 in an earlier run) | 440 ms | 408 ms | |
| first open after an app update (cache miss) | 3577 ms | 1086 ms | 706 ms | |

After, cold: shot IPCs leave at 30 ms (before the mount), median 29 ms from the disk cache; shell 561 ms;
first frame 845 ms. Honest notes: warm blocking is about flat — the mount is now ONE render of 400–500 ms
instead of two shorter ones, so the longest task grew; React's dev-only performance-track logging
(`measure` / `addValueToProperties`) is 100–180 ms of every open in these numbers and absent in
production. The first open after an update is ~1 s slower than the old all-at-once transpile (6 at a time
on the transpile path); concurrency 16 measured 1.66–2.55 s cold with main-process IPC latency up to
735 ms, so 6 stayed. Cold numbers swing ±0.5 s run to run on the dev build.

- **Gates:** check:types at baseline (26/10); vitest studio + shared **696 passed** (76 files; new
  `shot-module-loader.test.ts` 11 incl. the ordering, `open-stages.test.ts` 4, `asset-patch.test.ts` 5);
  main services + IPC 527 passed (new `shot-module-resolver.test.ts` 10 — memo/disk/transpile tiers, a new
  version, in-place rewrite by size and by mtime, fingerprint change, cleared cache, base-URL round trip;
  `transpiler-fingerprint.test.ts` 3; `shot-reconcile.test.ts` +3 fingerprint tests).
- **CDP** (drivers in the session scratchpad: `profile-open.mjs` with `--trace` / `--profile`,
  `analyze-trace.js`, `analyze-tasks.js`, `frames.mjs`, `invalidate.mjs`, `smoke.mjs`): video-10 preview
  frames before (the stashed tree) vs after at f1957, f5709 (B3IntoCode's code window), f6313, f9864 and
  f19019 are pixel-identical; f13 has 0.20 % of pixels over 24 (footage decode); zero placeholder tiles in
  both. On `video-10-test`: a `v2.tsx` for b2-mechanism selected in the inspector → the preview shows the
  v2 text and `cache/shot-modules/b2-mechanism/v2.json` appears → back to v1 → original; `v1.tsx` rewritten
  in place with the project closed → reopen shows the new text and the v1 entry is rewritten (new mtime +
  hash) → restored → original (7/7). Transport after the `usePlayback` change: seek, Play (playhead
  10 → 12.6 s), Pause holds. Reconcile with a 120 KB unadoptable drop-in: first scan 39 ms and one failure,
  five more scans 1–7 ms and nothing, folder removed → clean. project.json after every run: only
  `updatedAt` (plus a captions/script key-order swap after the version switch) — values identical.
- **Left for later:** the mount itself (400–500 ms warm in dev: the full editor, 113 tiles, 62 hidden shot
  cards, Remotion's AudioContext) — memoising the left-pane lists or mounting the Shots tab on demand is
  the next lever; served shot modules carry inline source maps (25 MB for 62 shots, 3× the source).
- **Next** in the round: 8 (proxy speed).

## 2026-09-13 — STUDIO: Project settings panel (feedback 7) + left pane Media | Shots | Captions with a media grid (feedback 5)

`docs/studio/VIDEO10_TESTING_FEEDBACK.md` items 5 and 7, built together (7.4 moved the brand/preset pickers
out of the Shots section, so the panel came first). Before: the brand picker rendered only with library
brands (none on this machine), video-10's `brand.json` snapshot was used by generation silently, project
format/STT had no surface, captions sat in the right panel, and 113 assets were a single column of
full-width cards.

- **Project settings** (`components/ProjectSettingsDialog.tsx` over `ProjectFormatFields` +
  `ProjectBrandFields` + `BrandReadout`), opened from a Settings button beside Export or the size chip:
  name; frame size (typed values commit on Enter/blur through `services/project-format.ts` — even, 16–7680 —
  plus 1080p / 4K / 9:16 / 1:1 buttons); fps; STT model; Brand; Preset; a read-out of the brand's five colours
  and fonts. Settings edits stay non-undoable (the brand / STT precedent).
- **Brand as the renderer sees it = as main renders it.** `services/project-brand-options.ts` (pure): the
  options (snapshot option when `brand.json` exists — then no "No brand", since `resolveProjectBrand` always
  falls back to it; stale ids "(missing)"; "Create brand…"), and `effectiveBrand` mirroring main's order.
  EditorShell's caption `activeBrand` now uses it, so caption previews paint the snapshot like the export
  already did. **Save to library**: new IPC `studio:project:brand:get` / `studio:project:brand:promote`
  (`ipc/studio-brand-handlers.ts`, `promoteProjectBrand` in `services/studio/project-brand.ts` → `createBrand`),
  the renderer then sets `brandId`; `hooks/useProjectBrand.ts`. **Create brand… / Create preset…**
  (`services/open-library-form.ts`) navigate to Assets and fire `vidtsx:assets-open`; `AssetLibraryScreen`
  opens `BrandsDialog` / `PresetsDialog` on their New form (`startNew`). `useBrandList` / `usePresetList`
  re-read on `vidtsx:screen-active` (studio) and after a promote, and now use async/await.
- **Left pane** (`components/LeftPane.tsx`): Media N | Shots N | Captions via the shared `PaneTabButton`
  (the right panel is Inspector | Script | Assistant); the top bar's Captions button targets the left tab.
  Tab per project in localStorage (`studio.leftTab.<id>`, `hooks/useStoredChoice.ts` over the pure
  `services/stored-choice.ts`). Media and Shots stay mounted and hidden, so an open import panel or a typed
  brief survives a tab switch; Captions mounts on demand. A reconcile drop-in failure switches to Shots.
  Pool pane default 230 → 300 px (min 220, max 480): three 88 px tiles per row.
- **MediaPool.tsx 804 → 188 lines**, split: `MediaTile` (grid) / `AssetCard` (list) over `MediaThumbnail`
  (duration + kind, proxy / transcribing / transcript-ready pill, Missing + Locate…) and
  `AssetHoverActions` (same titles as before); a right-click `FloatingMenu` (Add · Transcribe/Re-transcribe ·
  Locate… · Remove); `DensityToggle` (grid/list, `studio.media.density`); the item-6 confirm spans the grid
  row. `ShotsPanel` (keeps `data-shots-section`, header = Import + Generate + density) over `ShotCard`
  (row or tile), `ImportShotPanel`, `GenerateShotForm` (`GenerateShotSpec` moved there). Item 5's
  "verify drag-to-timeline from a tile" had a wrong premise: the pool never had a drag.
- **Gates:** check:types at baseline (26/10); vitest studio + shared **679 passed** (74 files; new:
  `project-brand-options.test.ts` 6, `project-format.test.ts` 3, `stored-choice.test.ts` 2) +
  `project-brand.test.ts` 3 (promote copies the snapshot incl. vocabulary, a second promote gets its own
  slug, no snapshot → readable error); asset-library + main IPC suites 86 green.
- **CDP on `video-10-test`** (dev app restarted for the new IPC; drivers `drive-panes.mjs`,
  `drive-settings.mjs`, `drive-size.mjs` over a shared `cdp-lib.mjs` in the session scratchpad):
  tabs "Media 20" / "Shots 12"; 20 tiles, 3 per row at 92 px in the 312 px pane; click → accent ring;
  right-click → Add to timeline → 62 on-screen clips → Ctrl+Z → 59; X on the 75-clip master → full-row
  confirm → Cancel; list → 20 cards; Shots: 12 tiles with badges, no brand/preset picker in the DOM, a typed
  brief survives Media → Shots, B0Terminal confirm → Cancel; Captions via the top bar → the left tab with
  10 templates; renderer reload → Captions still active. Settings: snapshot "Learn With Hasan (project
  snapshot)" selected, 5 swatches, "Space Grotesk / Inter"; 1281 + Enter → 1282×1080 in the chip; "abc" →
  the hint and revert; 9:16 → 1080×1920 → 1080p; fps 25 → 30; Save to library → `learn-with-hasan`
  selected, read-out "library", button gone → snapshot re-selected, library copy deleted; Create brand… →
  Assets with "New brand" open. **Each of the three runs: project.json vs the pre-run backup differs only in
  `updatedAt`.** The run caught one bug, fixed before the last run: a size preset equal to the current
  size left half-typed text in the fields. Most screenshots of the second and third runs were skipped —
  the window was covered (hidden) — see the new section in `docs/ui-automation-cdp.md`.
- **Next** in the round: 2 (open-time loading state) and 8 (proxy speed).

## 2026-09-13 — STUDIO: removing media or a shot that is on the timeline asks first, and asset removal is one undo step (feedback 6)

`docs/studio/VIDEO10_TESTING_FEEDBACK.md` item 6. Before: the X on a media tile silently deleted every clip
playing the asset (297 master clips for one raw file on video-10) and dropped the asset; Ctrl+Z brought the
clips back pointing at an asset that no longer existed (assets were outside the undoable slice).

- **Usage counts** `src/features/studio/services/asset-usage.ts` (pure): `usageByAsset` (clips per track in
  track order + shots referencing the asset through `assetRefs`), `usageByShot`, and the sentences —
  "Used by 297 clips on V1 and 2 shots." / "Used by 9 clips on the timeline." `EditorShell` memoises both
  maps off the timeline and passes getters to the pool.
- **Confirm in place** `components/RemoveConfirmCard.tsx`: the X on an in-use tile (or shot row) swaps it for
  a card — name, the usage line, "Remove anyway? The clips are deleted; the file stays on disk. Undo restores
  both.", Cancel / Remove. Unused → removed at once, as before. Tiles and shot rows carry an "N clips" /
  "N shots" badge (`data-usage-badge`) so the state is visible before anyone reaches for the X.
- **Undoable asset removal, the reducer way.** Assets stay owned by `useStudioProject` (proxy / transcript
  status lands there from background jobs and must never be undone), so the undoable slice records only
  WHICH assets are gone: `EditDoc.removedAssets` = `{ asset, index }` snapshots, action `remove-asset`
  (replaces `remove-asset-clips`) drops the clips and appends the snapshot in one commit; the project sync
  effect filters those ids out of `project.assets` and, when an undo takes one off the list, splices the
  snapshot back at its original index — so project.json after remove + undo is identical (checked, only
  `updatedAt` moves). Never persisted; reset on open; a repeat removal is a no-op.
- **Gates:** check:types at baseline (26/10); vitest `asset-usage.test.ts` (3) + `remove-asset.test.ts` (3)
  + 6 existing fixtures gained the field; studio + shared 665 green. **CDP on `video-10-test`:** the first
  master (75 clips on V1) → X → the card with "Used by 75 clips on V1." → Cancel → tile back, 59 on-screen
  clips unchanged → X → Remove → 19 clips, tile gone → Ctrl+Z → 59 clips, tile back first in the pool
  with its badge; shot row B0Terminal → "Used by 9 clips on the timeline." → Cancel. Saved file vs the
  pre-run backup: only `updatedAt`.
- **Next** in the round: 5 + 7 together (left-pane tabs / media grid + Project settings), then 2 and 8.

## 2026-09-13 — STUDIO: copy the clip name / shot id (feedback 3) + the assistant draft survives tab switches (feedback 4)

Two small items from the video-10 round (`docs/studio/VIDEO10_TESTING_FEEDBACK.md`).

- **Copy name.** `src/shared/components/CopyButton.tsx` — a one-click copy icon with an in-place "Copied"
  flash (tooltip + `data-copied`, no toast) over `src/shared/hooks/useCopyToClipboard.ts`, which is now
  the app's single clipboard path (`copyTextToClipboard` never throws; the lightboxes, the thumbnail
  generator, the transcription screen and the chat export all go through it — same behaviour, one
  helper). `ClipSection` puts it at the right of the Name field (the clip's label / file name / kind);
  `ShotClipSection` puts it beside the shot's name and copies the **shot id**, since that is what the
  assistant's tools take.
- **Assistant draft.** The right panel renders one tab, so `AgentPanel` unmounted on every tab switch
  (and on a clip click, which flips to Inspector) and dropped its `useState` draft. Now
  `hooks/useAgentDraft.ts` over the pure `services/agent-draft-store.ts`: the text is written through to
  sessionStorage under `studio:agent-draft:<projectId>` on every edit, read back on mount, removed on
  send / when emptied — survives tab switches and a renderer reload, gone with the window. The Script
  tab holds no local state, so nothing to do there.
- **Gates:** check:types at baseline (26/10); vitest — `agent-draft-store.test.ts` (3) + the touched
  features green (69 files / 661). **CDP on `video-10-test`:** Copy name on a master clip → its file
  name on the (stubbed) clipboard, tooltip "Copied" → back to "Copy name" after 1.5 s; the tsx clip
  `b0-terminal` → `b0-terminal`; a draft typed in the composer, Inspector, back → restored verbatim
  (the textarea was unmounted in between); Inspector → clip click → Assistant → still there; emptying
  the box removes the key.
- **Next** in the round: 6 — shipped the same morning (entry above).

## 2026-09-12 — EXPORT ENGINES: Engine 3 "Fastest" (shot composite) — the editor's bake inside the engine seam; a renderer bug found on the way

`docs/export-engines-plan.md` "Engine 3 — shot composite" (design, the diagnosis, four gate rows).
Why: Hasan asked why the editor project renders video-10 far faster than Studio — its bake never sends
footage through Chromium (Remotion renders shots alone with alpha, ffmpeg overlays them on cut footage) —
and asked for it as a third engine, the two existing ones untouched.

- **Engine** `src/main/services/studio/export-engines/shot-composite-engine.ts` (id `shot-composite`,
  picker "Fastest", same GPU-encoder download as Fast): copy / black / browser spans by the passthrough
  engine's exported producers; **composite spans** = the shot layer (overlay + caption lanes' tsx /
  caption / image clips over a transparent background — `TimelineComposition layer='shots'`, reached
  through the `layer` input prop the generated entry forwards) rendered once per run of composite spans
  as ProRes 4444 with alpha (`shot-layer-render.ts`, `ShotLayerRuns`, gaps under 30 frames rendered
  through), then one ffmpeg command per span (`shot-composite-ffmpeg.ts`: the copied span's own select →
  `scale_cuda` → `hwdownload` → RGB by the policy → `overlay=format=rgb:alpha=straight` → Remotion's
  zscale + the five tags → NVENC → MPEG-TS piece). Planner: `planExportSpans(…, { compositeShots: true })`
  — byte-identical without the option (pinned). Dialog row states both shares ("Copies 10 % … and
  composites shots over another 58 %"); progress line "Copied 5 % · composited 15 % · compositing 18 of
  51 spans · about 12 min left". `export-engine-run.mjs` gained `--resolution` / `--source`.
- **The renderer bug (fixed):** `renderComposition` built Remotion's composition object without `props`,
  and `renderMedia` hands the component `composition.props`, not `inputProps` — so no input prop ever
  reached a component through this path. One line in `remotion-renderer.ts` (`props: options.inputProps
  ?? {}`); the shot layer had been rendering the 4K footage (0.9 fps, 73 s per start = Remotion
  downloading the 2 GB source), now 10 fps graphics-only.
- **Gates** (`video-10-test`, 4909 frames, Full from the 4K originals, the real dialog, D5 verify vs
  Standard at 22 frames: **max 0.33 % over 24, audio 0 ms** on every run — the over-24 pixels sit on glyph
  edges, Standard's JPEG screenshots vs the layer's PNG): run 2 75.7 min → run 3 (props fix + runs)
  **40.7 min** → run 4 on the `angle` backend **23.0 min**, against Standard **55 min** (`swangle`) /
  **31.5 min** (`angle`). check:types at baseline (26/10); vitest 2421 + the new files green.
- **Found on the way:** Settings › Rendering › GPU backend defaults to `swangle` (software ANGLE); on
  this laptop it costs the shot layer 5× (1.9 vs 10 fps) and the Standard engine 43 % (55 vs 31.5 min).
  Restored to `swangle` after the measurement — changing the default is Hasan's call.
- **Next:** the splits (a transformed master under a shot = 32 % of this project, 12.7 of the 23 min) as
  an ffmpeg crop/scale/overlay base; a shot-layer cache keyed on the layer's clips; whether Fastest
  becomes the default.

## 2026-09-12 — STUDIO EXPORT: output options Phase 1 — resolution + quality in the Export dialog, honoured by both engines

`docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md` Phase 1 (its log has the file-by-file account and the gates).
Why: video-10's 4K HEVC 60 fps originals export at 0.8 fps; a draft-size export is the first half of the
fix (Phase 2, proxies as the source, is the half that makes it fast).

- **Shared presets** `src/shared/render-presets.ts`: the resolution ladder (aspect-aware, `snapRenderScale`-
  snapped even dims, never at/above the composition) and the quality → CRF table (15/18/23/28) moved out of
  `RenderSettingsModal.tsx`, which now reads them (behaviour pinned: 480p from 1080p = 864×486). Export
  ladder = Full · 720p · 540p · 360p.
- **One output-size rule**: `resolveRenderScale` (`render-scale.ts`) → `renderComposition`,
  `export-engines/output-size.ts` → the passthrough engine's copied + black spans and the D5 verify, so
  browser spans, copied spans and the reference export share one W×H.
- **Dialog**: `ExportDialog.tsx` + `ExportOutputSection.tsx` — Resolution · Quality, a heavy-footage
  notice (`services/export-estimate.ts`: ≥ 2160 lines / HEVC / ≥ 50 fps on the timeline, static estimate
  from the measured 0.8 browser fps + 3.9× copy) and the choice remembered per project
  (`settings.export`). `scale`/`crf` ride the queue job → `ExportRenderSettings.scale` → both engines;
  a scaled file is `<project>_720p.mp4`; the agent's export action stays at project size.
- **Gates**: check:types at baseline (26/10); vitest **2400 passed** (23 new); **Full · High byte-identical
  to the pre-change export through BOTH engines** (a 165-frame range of `video-10-test`, baselines exported
  on the old main process, `cmp` clean — "today's export" is CRF 18 = High, not Best); **720p Fast vs
  Standard on the same range: both 1280×720, max 0.01 % over 24 at 10 frames, audio 0 ms** — after the
  gate's first run caught a double downscale in my `renderComposition` refactor (852×480 reference; fixed
  to the pre-refactor rule). Full-project 720p run through the real dialog: see the plan's log row.
- **Also**: the Fast engine's GPU-encoder ffmpeg had never been installed on this laptop (the engine work
  was on the other machine) — installed via the app (NVENC on the RTX A3000), Fast row enabled here since.
  Session drivers (IPC range export, real-dialog export, dialog screenshot) described in the plan's log.
- **Phase 2, same day** (the plan's Phase 2 log): **Source** — `src/shared/studio/export-source.ts`
  (availability = every timeline video asset has a ready proxy; auto default = proxies at ≤ 540p;
  `_540p-draft` suffix); `studioExportPrepare({ source })` → `createExportEntry` points the entry's asset
  URLs at `cache/proxies/<assetId>.mp4` and records `entry.sourcePaths`, which the Fast engine's copied
  spans read too (the audio pass keeps the originals). **Quality on Fast** — `copyQualityForCrf` (CRF + 5:
  High → the measured 23, so the default path is unchanged) on every piece kind. **Dialog** — "Draft from
  the preview proxies" checkbox (or a note naming the clips without a proxy), a `draft` badge on the queue
  row, `settings.export.source` remembered. **Estimate** — `measuredExportRate` from the render queue's
  in-memory jobs (same project + engine + source) replaces the static table once a matching export
  exists. **Settings › Rendering** — "Default Studio export output" (resolution + quality) via
  `SETTINGS_SET_RENDER_DEFAULT_EXPORT_OUTPUT`; a project's remembered choice wins. **Gates**: types at
  baseline; vitest **2409 passed**; Full·High·Originals **byte-identical again through both engines**
  vs the pre-Phase-1 baselines; **the 540p draft of `video-10-test` through the real dialog (toggle on by
  itself at 540p, verify → Standard): 12 min 0 s of frames (6.8 fps) against ~100 min from the originals,
  both files 960×540, 22 sampled frames max 0.04 % over 24, audio 0 ms.** Its first run caught a real
  bug: `scale_cuda … format=yuv420p` on an nv12 source at the SAME size starves NVENC (a 3-frame span,
  headers and no packet) — 8-bit 4:2:0 sources now skip the conversion (`SourceProbe.pixelFormat`), the
  10-bit camera path keeps its pinned string, and a packet-less piece goes to the browser instead of
  killing the export. `export_source` + `started_at` are persisted in the queue DB.
- **Next**: nothing planned in this track.

## 2026-09-12 — STUDIO: ripple across all tracks + range delete; preview transpiler parses imports (B3IntoCode placeholder)

Two items from Hasan's video-10 testing round (`docs/studio/VIDEO10_TESTING_FEEDBACK.md` item 1, and
"why is B3IntoCode a placeholder?").

- **Ripple all tracks** (`src/features/studio/services/ripple-ops.ts`, pure; `hooks/useRippleMode.ts`).
  A third ripple mode beside off / this-track: removing a span of time from the MASTER lane (delete a
  master clip, I/O + Delete, an edge trim, an applied cut proposal) pulls every unlocked track along —
  later clips slide by the removed length, a clip straddling the span keeps the parts outside it (a
  middle cut becomes two pieces with the right piece's `sourceIn` advanced, splitClip's fade/transition
  convention), locked tracks and markers-before-the-span never move, markers inside vanish and later ones
  slide. Deleting a clip on a non-master lane is still a per-track ripple (a shot's removal must never
  cut the footage under it). Lengthening a master trim opens a gap instead of clamping on the neighbour
  (`insertGapAllTracks`). Mode lives in localStorage (`studio.ripple.mode`, default **all**) as a tiny
  external store so the toolbar (new layers button), `useTimelineShortcuts`, `useClipDrag` (live preview
  runs the ripple op too), `EditorShell`'s proposal preview/apply and `ReviewCutsSection` all read one
  value. Reducer: `trim.rippleAllTracks`, `remove-clips.allTracks`, new `remove-span`,
  `proposal-apply.rippleAllTracks`; each one undo step. `applyCutProposal(…, { rippleAllTracks })`
  derives the master lane's removed timeline spans from its kept pieces and takes them out of the
  tracks that play no cut asset. Captions need nothing (derived on serialize); `buildPreviewTimeMap`
  still picks the first reshaped track carrying assets (tsx lanes have none) — unchanged.
  **Tests:** `ripple-ops.test.ts` (19: straddle, exact edges, sub-frame span, locked, zero-length,
  markers, gap insert, mixed selections, all four trim directions) + 3 in `apply-cut-proposal.test.ts`.
  **CDP on video-10** (dev app launched with `--remote-debugging-port`, driver in the session
  scratchpad): I at f4200, O at f4202, Delete → 360 → 362 clips, both straddlers (B2NameCard shot,
  the master clip) cut into two pieces, every later clip on all lanes shifted by exactly 0.0667 s,
  autosave landed, Ctrl+Z gave a byte-identical timeline. Range delete is one keypress now: I, O,
  Delete — the 2:21.17 → 2:21.22 case from the feedback.
- **B3IntoCode placeholder = a preview-transpiler bug, fixed at the root.** `tsx-transpiler.ts` rewrote
  bare imports to CDN/virtual URLs with a text regex (`from\s*['"]…['"]`) over the whole esbuild
  output; the shot's VS Code highlighter contains `prev === "from" || …`, the regex read `from"` as an
  import and swallowed code up to the next quote → invalid JS → dynamic import threw → placeholder tile
  (61/62 shots fine; B7ClaudeMd shares the lib but tree-shook the highlighter). Replaced with
  `es-module-lexer` 2.3.1 (pinned; the parser Vite uses) in `src/main/services/import-rewriter.ts`:
  only real static imports, re-exports and literal dynamic imports are rewritten (edited back to front),
  strings/comments/templates untouched, `tone` default-import → namespace on the real statement. Export
  (webpack) was never affected. Tests: `import-rewriter.test.ts` (6, incl. the end-to-end transpile of a
  `from"`-bearing shot parsing under esbuild); all three code-window shots of video-10 re-transpiled and
  pass `node --check`; CDP: the preview at f5709 shows the full scene, zero placeholder tiles.
  The composition-config / default-export finders in the transpiler are still text regexes — top-level
  `export` only, far less exposed; noted in the file.
- **Export the assistant chat** (feedback item 9, asked and built the same day). A download button in
  the Assistant composer → FloatingMenu, right-anchored: Copy chat · Copy chat + tool details · Save chat as
  Markdown… · Save chat + tool details… (`services/agent-chat-export.ts`, pure formatter +
  file name; the save goes through the existing `dialogSave` IPC). To make the transcript worth
  reading, the persisted `StudioAgentChatMessage` gained `at`, `providerId`/`model` (assistant rows)
  and `toolCalls[].args/result/isError`: every Studio tool is wrapped by
  `agent-tools/tool-result-events.ts`, which emits a new `'tool-result'` agent event after the handler
  (arguments JSON capped at 4 k chars, result text at 12 k, errors flagged and rethrown); the hook attaches
  it to the latest chip of that tool. Older transcripts simply lack the fields. Tests: 12 across the
  formatter, the wrapper and the store. Not driven by CDP — Hasan was using the dev app at the time.
- Suite: 2348 + 40 new passing; `check:types` at baseline (web 26 / node 10).

---

## 2026-09-11 — EXPORT ENGINES: QSV/AMF copy paths — checked, prepared, QSV measured here; AMF stays the open measurement

The third open item of the Stage 4 log (`docs/export-engines-plan.md`, "QSV/AMF copy paths";
runbook `docs/export-engines-qsv-amf-runbook.md`). The brief's premise was half wrong: the dev laptop
has an **Intel UHD 630 beside the GTX 1650 Ti** and `h264_qsv` opens (the 2026-09-02 probe cache
already said so), so QSV was measured for real; `h264_amf` fails for the genuine reason (`DLL
amfrt64.dll failed to open`) and is the one encoder that has never encoded a frame. The fast engine
stays opt-in (D2).

- **Builders vs `ffmpeg -h encoder=h264_qsv` / `h264_amf` (8.1):** the encoder lines were right (QSV
  `-preset medium -global_quality 23` = TargetUsage 4 + ICQ — the encoder reports `RateControlMethod:
  ICQ, ICQQuality: 23, GopPicSize: 60, GopRefDist: 3, IdrInterval: 0`; AMF CQP with `-bf` as AMF's own
  B-pattern option). Two fixes: **`h264_qsv` takes nv12 only** — every graph ended in `format=yuv420p`
  and ffmpeg auto-inserted the conversion (`auto-inserting filter 'auto_scale_0'`); `ENCODER_PIXEL_FORMATS`
  now names each encoder's format and every software-frame graph ends in it (measured: not the same
  bytes as the auto-inserted run — swscale's direct 10-bit→nv12 rounds chroma differently from
  10-bit→yuv420p + the lossless repack — and the same against the plain Remotion export, means within
  0.03). **AMF's CQP named no B-frame QP** — `-qp_b 23` added. No `-hwaccel`/`-init_hw_device` is
  needed on either for system-memory frames. NVENC's strings pinned byte for byte.
- **Tests:** every builder × three encoders (the shared arguments, the frame-mapping select identical
  across vendors, the slow graph on qsv/amf, no CUDA off NVENC); `passthrough-engine.test.ts` (new,
  the probe mocked): QSV or AMF as the only working encoder → available, `h264_qsv`/`h264_amf` named to
  the queue row, every run on the vendor's line, "Copied 100 % (2 of 2 spans)"; NVENC preferred when all
  work; the probe's parsing on the real 8.1 `-encoders` lines; the Settings row's "AMD AMF". New dev
  override **`VIDTSX_EXPORT_GPU_ENCODER=qsv|amf`** (`pickExportEncoder`: only a probed-working
  encoder, else ignored and logged) — how QSV/AMF is exercised on a dual-GPU machine; the live test's
  new block runs every builder on whichever of qsv/amf opens (here: qsv ran, amf skipped).
- **QSV offline** (`.vidtsx-temp/bench/open/qsv-amf/proto-qsv.mjs`, the builders' exact arguments on
  the T1 cut's spans): 450/450 frames, the same GOP shape as NVENC (I 8 · P 150 · B 292), High L4.0,
  the five tags on the pieces and after the join, **two encodes byte-identical**, `t1-diff` vs control
  2 **max 0.01 % over 24** (0 at 449; NVENC 0 % at all seven), **0.56× realtime** against NVENC's 3.6×
  — the 4K HEVC Main10 software decode is the floor (37 source frames/s); decoding on the Intel GPU
  with the frames downloaded gives the SAME bytes (the decode is bit-exact) and no speed;
  `vpp_qsv`/`scale_qsv` fail on this 2021 driver (p010 → nv12 unsupported). Whether QSV should decode
  on the GPU is a later slice's call (it needs a software fallback for iGPUs that cannot decode the
  source).
- **QSV through the app** (the dev app restarted with the override; the log's `Export encoder override
  … using: qsv` on every export; the runbook's gate exercised once): **slow4** `copy 450 · copy 450`,
  max 0.01 % over 24 at all 18 sampled frames vs its plain Remotion export, **Remotion's source frame at
  all 15 mapped slots** (899, 900, 900, 901 · 998, 999, 999, 1000 ×3, 1001, 1001, 1002 …), audio 0 ms
  at eight windows, 62.9 s from click; **xfade** `copy 435 · browser 30 · copy 435` (the browser span
  re-encoded by h264_qsv), max 0.01 % over 24 at all 13 frames, audio 0 ms vs the camera at eight
  windows; **t5-1080p-cut in D5 verify mode**: max 0.02 % over 24 vs its Remotion reference (frame 451;
  0.01 at the other six — the NVENC rows read ≤ 0.01, a wrong frame ~2 %), max 0.01 % vs control 2,
  audio 0 ms vs the reference and vs the camera at every window, 13 min 23 s from click. The copies
  ran at 0.4–0.5× realtime (the software HEVC 10-bit decode; beside other work). The queue row's
  persisted record carries no `encoderName` (the live event does) — the log's override line is the
  evidence.
- Gates: check:types 26/10 (baseline), vitest 2342 (267 files, 22 skipped; +18), live ffmpeg 10 passed + 1 skipped of 11
  (amf skipped here). The nine NVENC
  references not re-exported (the NVENC arguments are pinned unchanged). Open: **AMF — never run**;
  the runbook says exactly what to run on an AMD machine (the download, the seeds, the driver chain,
  the gate = D5 verify + two exports byte-identical, not byte identity with the NVENC files) and what
  to record.

## 2026-09-11 — EXPORT ENGINES: slow motion (rate < 1) measured and copied

The last widening the Stage 3 predicate owed (`docs/export-engines-plan.md` §Stage 4 log, "Slow
motion"). A clip at a rate under 1 was a browser span because `select` cannot repeat a source frame
and how Remotion repeats frames was unmeasured. The fast engine stays opt-in (D2).

- **Four seeds** (`scripts/bench/seed-cut-projects.mjs slow | slow4 | slow-open | slow-open4`): the
  T1 cut with clip B at 0.5× for 25 s (at 0.5× on a 59.94 fps source the first repeated frame is at
  slot 602, so a 15 s clip has none), at 0.25× for 15 s (every second slot repeats; a one-tick tie at
  frames 651–653), and a clip at 0.1× / 0.25× that OPENS 0270 at 47 s as the first clip of the file.
  Plain Remotion exports first, every frame identified against the source frames around its mapped
  time (`t1-frame-map`, `.vidtsx-temp/bench/open/slow/measure-slow.sh`).
- **Finding: Remotion shows the source frame nearest, in the stream's integer ticks, to its own
  media time `(trimBefore + m·rate)/fps`, and repeats it plainly on every slot it is nearest to** —
  0.25×: K 899, 900, 900, 901, 901 …, three slots on K 1000 where the slot times pass the half-frame
  by one tick (the later frame wins); 0.5×: one frame per slot, the one repeat at frames 1051/1052;
  0.1×: slot 412 shows K 2899 where the real-valued nearest is 2900 — the compositor truncates the
  time to ticks (`ffmpeg.rs` calc_position) before the frame cache picks the nearest (ties later).
  **A slow clip that opens its file shows the nearest on slot 0, not the ceil** (K 2817 at 0.1× and
  0.25×; the ceil 2818 reads 2.98 against 2.05): the ceil rule is a rate ≥ 1 rule.
- **Recipe** (prototyped with the full ffmpeg, then built as `passthrough-slow.ts`): `select` keeps
  the frames some slot asks for by the tick-exact rule (Remotion's arithmetic mirrored op for op,
  the interpolate multiplier `(S + rate) − S` included), `setpts` places each on its FIRST slot, the
  `fps` filter repeats it over the following slots. `-fps_mode cfr` alone fills a one-slot gap with
  the frame AFTER it (prototype B: K 901 on slot 2 where Remotion shows 900) — so the `fps` filter,
  not cfr. Prototype A on the 0.25× clip: 450 frames in 4.1 s, the same source frame as the Remotion
  export at all 24 sampled slots, max 0.01 % of pixels over 24 at 20 frames.
- **Code:** `copyBlocker` no longer returns `slow motion`; a slow span carries `trimBefore` +
  `clipOffset` (whole numbers — a fractional `sourceFrame` cannot reproduce the renderer's doubles);
  `probeSource` reads the stream's `time_base`; `copySpanArgs` takes the slow graph for rate < 1 and
  keeps slice 4's graph byte for byte otherwise; the engine demotes a slow span whose source frame is
  not a whole number of ticks; `firstFrameCeil` only at rate ≥ 1. The audio of a slow clip was
  already Remotion's `atempo` chain (slice 4).
- **Gate:** the four seeds through the passthrough engine on the restarted app (the dialog says "Copies
  100 %" for each): **the same source frame as the plain Remotion export at all 58 mapped slots** (the
  repeat triple, the 0.5× repeat at 1051/1052, slot 412's tick frame, slot 0 of both opening clips),
  `t1-diff` **max 0.01 % of pixels over 24 at all 55 sampled frames**, audio 0 ms and level 1.000 at
  every window; the D5 verify on slow4 max 0.01 % over 24 at the seven frames, audio 0 ms vs its
  reference and vs the camera (a first run's reference — 800 MB free, vitest beside it — showed a
  neighbour frame at 451/452/651, the T1 leg 0 memory-starved pattern; the copy matched the plain
  export there; the clean rerun matched everywhere); **the nine references byte-identical on video
  AND audio**; a slow span copies at ~6× realtime (the 1,200-frame seed 22.7 s from click against the
  Remotion export's 13.6 min; the opening seeds 12 s against 4–5 min).
- Gates: check:types 26/10 (baseline), vitest 2324 (266 files, 20 skipped; a first run beside the
  reference render had 7 load failures that did not reproduce), live ffmpeg 9 (+1: the slow recipe's
  exact counts at 0.25×/0.5×/from a clip offset, pts on the grid, two runs byte-identical).
  Bench under `.vidtsx-temp/bench/open/slow/`; the four seeds on disk. Open: a slow clip that runs
  to its source's container end (the `fps` flush at EOF is left to the held-tail path — modelled,
  not exported); the T1 leg 0 table gained the slow-motion row.

## 2026-09-11 — EXPORT ENGINES: the long-return question

The item Stage 3 slice 1 left open (`docs/export-engines-plan.md` §Stage 4 log, "The long-return
question"). `planExportSpans` sets `firstFrameCeil` only on a copy span whose file is new to the
timeline: the browser shows the CEIL source frame on the first frame after OPENING a file and the
NEAREST on a same-file cut or a return — measured in slice 1 on one 3 s return, on a near-static
shot. Unmeasured until now: whether the compositor closes an idle file on a long timeline, so that a
return after minutes of other material behaves like an open (ceil). The fast engine stays opt-in (D2).

- **Three seeds** (`scripts/bench/seed-cut-projects.mjs return | return-short | return-1m`), every
  return to 0270 at source 1376/30 = 45.8667 s — a 30 fps grid time at K 2749.25, so the nearest
  (2749) and the ceil (2750) differ, on a moving shot (adjacent source frames ~2 % over 24 apart):
  a return after 320 s of four other DJI files (frame 9900 of 10,200); the control with a 5 s
  return plus a same-file forward seek of 4.4 s inside the open stream (60.2 s) and a 36 s jump
  back (29.2 s); a 1 min return through two other files.
- **Instrument:** `t1-frame-map.mjs` on the first three frames of every return — the export frame
  against the six source frames around the mapped time, both at 1080p, mean abs diff; best K read
  against the nearest and the ceil index (`.vidtsx-temp/bench/open/long-return/measure-return.sh`).
- **Control (plain Remotion, `…return-short_2026-09-10T21-45-58.mp4`, 9.5 min from click):** the
  5 s return shows **K 2749 = nearest** (mean 1.99 against 3.34 / 3.14 for 2748 / 2750), the seek
  inside the open stream **3608 = nearest** (2.11 vs 3.17 / 3.07), the jump back **1750 = nearest**
  (2.01 vs 3.24 / 3.06); frames +1 and +2 nearest everywhere. Slice 1's return rule holds with a
  strong signal, and a same-file seek — forward inside the stream or back to a new stream — is a
  return, not an open.
- **The long return (plain Remotion, `…return_2026-09-10T22-01-52.mp4`, 10,200 frames, 1 h 29 min
  from click, never memory-starved):** frame 9900 shows **K 2749 = nearest** (1.99 against 3.34 /
  3.14), 9901/9902 nearest — the control's rows to the hundredth. The 1 min return through two other files (`…return-1m_2026-09-10T23-35-32.mp4`): K 2749 = nearest, the same rows.
- **Answer: a return is a return, whatever the gap — the planner is right, no code change.** The
  ceil is confined to the first frame a render ever extracts from a file; `firstFrameCeil` = "the
  timeline has not shown this file before" is the whole rule. The compositor's source (v4.0.435)
  agrees on the shape: a request > 5 s from every open stream opens a new stream and seeks, so a 3 s
  return, a 320 s return and a same-file jump are one operation; a video closed for an empty cache
  reopens the same way. Why the first-ever open lands on the ceil is not visible in that code — it
  stays a measured rule. 
- **The passthrough engine on the same three seeds** (100 % copied; the 340 s project in **80 s from
  click** against the reference's 1 h 29 min): the same source frame as the Remotion export at every
  measured frame of every return and jump (K 2749 / 2751 / 2753 at the 45.8667 s return in all
  three; 3608… and 1750… at the short seed's jumps) — the planner's `firstFrameCeil: false` on a
  return span is what the browser does. `t1-diff` of each pair at the returns and around them: max 0.01 % of pixels
  over 24 at every sampled frame, 0 at every return's first frame.
- Gates: check:types 26/10 (baseline), vitest 2312 (261 files, 19 skipped), live ffmpeg 8.
  Bench under `.vidtsx-temp/bench/open/long-return/`; the three seeds on disk.

## 2026-09-10 — EXPORT ENGINES Stage 4 slice 5: no intermediate copy — the join is the mux

The item Stage 4's log left open (`docs/export-engines-plan.md` §Stage 4 log, slice 5). The
passthrough engine no longer joins its MPEG-TS pieces into a `video.mp4` that the finishing
mux then copies again: it hands the finishing stage its concat list
(`ExportEngineProduct.videoDemuxer: 'concat'` + the frame count its pieces summed to), the mux
reads the list as its video input (`-f concat -safe 0`, one stream copy into the output), the
list is probed like a file (D7's probe → mux → probe seam stands) and the finished file's
frame count is checked against the engine's. The fast engine stays opt-in (D2).

- **Offline first, on the 3 h product cut back into 276 TS pieces:** the join 241 s + the mux
  190 s against the one-step mux 162 s, whole-file md5 identical. The 43 s the plan attributed
  to the intermediate was the mux's read of a joined mp4; the join itself is ~4 min on 3 h —
  the concat demuxer parses 56 million TS packets on one core, so that read is the floor of
  both paths and is now paid once.
- **Then run-export, the 3 h project: `framesMs` 3,543 s against 3,775, `muxMs` 142 s against
  152, plan → file 61.4 min against 65.4** (`studio-t6-stress-3h_2026-09-10T19-30-06.mp4`,
  10,626,498,208 B, the 09-09 product's byte size; whole-file md5 identical to it (5b9de1ff…) — the one-step and the two-step exports of the 3 h project are the same bytes).
- **Gate: nine of nine references byte-identical on video AND audio** (t5-1080p, cut, gain,
  music, stack, fade, xfade, speed, speed2; `muxMs` 374–442 ms). The xfade seed differed at
  first: its document on disk had been edited in the app on 09-10 before this slice (the first
  clip's transition became dip-to-black 0.5 s, per the project's snapshots — a seed is
  app-editable, so a byte reference holds only while the span plan matches the seed script);
  re-seeded with `seed-cut-projects.mjs xfade --force` it re-exports byte-identical (43c6…/1f2d…).
  The edited version had been re-gated by D5 against a plain Remotion export first: max 0.03 % of pixels over 24 at frames 1/300/449/450/451/600/899 (max mean 2.51/255), audio 0 ms vs the Remotion reference and vs the camera at every window (`studio-t5-1080p-cut-xfade_2026-09-10T20-38-07.verify.json`). The cancel regression (the pieces now
  stay in scratch until the end) is clean: scratch, output and the browser gone, the row
  `cancelled` at 443/900.
- Gates: check:types 26/10 (baseline), vitest 2312 (261 files, 19 skipped), live ffmpeg 8.
  `export-engine-run.mjs` reaches the cards Studio-first with a retried Back. Still owed:
  QSV/AMF (no Intel/AMD encoder here), the long-return question, slow motion.

## 2026-09-09 — EXPORT ENGINES Stage 4: the finishing mux cut 25×, copied-vs-rendered progress, cancel cleanup

Stage 4 of `docs/export-engines-plan.md` (Stage 3 closed at 36d7ace), slices 1–3 built and
gated, slice 4 measured. Full log with the numbers: the plan's §Stage 4 log. The fast engine
stays opt-in (D2); flipping the default is Hasan's call.

- **The 24-minute mux was the AAC encode, not the faststart rewrite.** Profiled offline on the
  3 h project's own 10.27 GB video + 2.12 GB WAV with the finishing stage's binary: the
  current command 1,502 s (the app's 1,457 reproduced), video copy alone 43 s, copy + copy with
  the moov reserved 59 s, copy + copy + faststart 224 s. ffmpeg's native `aac` encoder is
  single-threaded at 8× realtime — 1,360 s of the 1,502 — and the copies leave the CPU idle, so
  `passthrough-audio.ts` now runs the one pass AND the finishing stage's own AAC encode (same
  binary, same `320k / cutoff 18000`, PCM in) beside the spans; the mux copies both streams and
  reserves the index up front (`-moov_size` = 32 B × samples + 64 KiB, faststart as the
  fallback). A copied AAC keeps its encoder delay: first packet at pts −1024, 0 ms vs the camera.
- **Gate: the nine references byte-identical on video AND audio** (t5-1080p, cut, gain, music,
  stack, fade, xfade, speed, speed2 re-exported; every stream hash equal to its 2026-09-06/07
  file); their `muxMs` 271–312 ms against 3.3–28.7 s. **The 3 h project: `muxMs` 152 s against
  1,457 s; plan → file 65.4 min against 92.1** (`studio-t6-stress-3h_2026-09-09T14-30-14.mp4`, 10,626,498,208 B, 330,749 frames, yuv420p tv bt709, ftyp · moov 14.8 MB · free 12.4 MB · mdat).
- **Progress that shows copied vs rendered.** The queue row reads `Copied 4 % · copying 12 of
  275 spans · about 41 min left` / `Copied 48 % · rendering 1 of 1 spans · under a minute left`
  (`passthrough-progress.ts`, pure, tested: the estimate from this export's measured copy and
  browser rates). Rows persisted `framesRendered 0` because the counts lived only in the
  renderer's progress ref and the finishing ticks carried none — fixed on both sides; a
  cancelled row now stays cancelled with its last counts. The 3 h row persisted 330749/330749.
- **Cancel cleans up.** Scratch removal retries through Windows' file locks and drops the
  half-written output; a startup sweep removes scratch folders and hour-old
  `%TEMP%\remotion-v*-assets*` copies (the T5 leak — 14 folders, 4 GB, on its first run).
  Measured with `scripts/bench/export-cancel-run.mjs`: the xfade seed cancelled inside its browser span (49 %, 11 headless browsers up from 4) → scratch, output and the seven browsers gone, the row `cancelled` at 443/900 — the first run left Remotion's asset folder as an EMPTY tree (its cancel removes the files, not the directories), so the abort path now removes empty `remotion-v*-assets*` trees created since the export started too; the 3 h project cancelled 150 s in (5 %, 14 of 275 spans, the audio pass and the AAC encode in flight) → scratch and output gone, no Remotion folder, no browser, the row `cancelled` at 17597/330749. The Settings › Rendering
  CPU-usage stop now reaches Studio exports (`renderCpuUsageConcurrency`).
- **Merging nearby browser spans: measured, not built.** A browser span costs ≈ 16 s of start +
  0.92 s per frame (four 30-frame windows 42–45 s, a 90-frame window 99 s, new seeds `xfade3`
  and `xfade2x`); merging pays only for gaps under ~19 frames. The 3.2 min per window Stage 3
  saw was contention.
- Gates: check:types 26/10 (baseline), vitest 2312 (261 files, 19 skipped) green, live ffmpeg 8. Still owed:
  QSV/AMF (no Intel/AMD encoder here), the long-return question, slow motion.

## 2026-09-10 — V1 COMPLETION W8 DONE: Flows, all seven stages — the plan is complete

W8 of `docs/v1-completion-plan.md` §2.8, per `docs/flows-plan.md`. The
parked discussion was answered in the morning (six decisions in §0.1 of the
flows plan, `2f3d791`), then Stages 0–6 ran unattended, one fresh-context
session per stage, each verified before the next. Full outcome under the
W8 section of the completion plan; a per-stage outcome under §3–§9 of the
flows plan; the seven §10 acceptance rows filled in there.

- 31 commits by pathspec beside the export-engines session's dirty tree
  (`c2edda9` … `f7dd591`); `check:types` at baseline (web 26 / node 10)
  after every stage; 2312 tests, up from 2035; `electron-vite build
  --outDir .vidtsx-temp/w8-build` passes; the `flows` flag is ON.
- What exists: `FlowDoc` v2 + v1 migration; `ports` on the shared registry
  (twenty tool ids appended) and `invokeTool` as the one handler path; the
  main-process runner with persistence, cancel, Resume and checkpoints
  through the interaction broker; the run form, the Flows page groups, the
  inspector's expose/pause toggles; the product nodes (transcribe, captions,
  TTS, audio, frames, trim, concat, save); `run_flow` in the shared
  registry AND in the Studio agent's own server (a shot range → clip →
  flow → `insert_asset` card); the `run_agent` node; the Flow Builder
  built-in with the proposal overlay; freeze a session into a flow; the
  `.vidtsxflow` container on the shared zip layer; the five built-in
  flows; "Run a flow on this" from Library and Video Studio; a Flows group
  in the Tools hub beside the screens.
- Runs: every built-in three times unattended, all success (thumbnail,
  frame-strip, explainer-30s, product-ad, add-effect); Motion Post → `run_flow`;
  the Builder's captions flow; Studio `add-effect` on shots 7–9; a frozen
  Motion Post session re-run with a new brief. Spend $3.25 real (seven
  Kling clips, one minimax run, AssemblyAI cents) of the $30 cap.
- Pending for Hasan: sign the built-in flows (or ship unsigned), the one
  `src/main/index.ts` line for the `.vidtsxflow` double-click nudge, the
  coupled version bump + installer rebuild (`resources/flows` now ships),
  the Tools hub's own `VITE_FF_TOOLS` gate, the ElevenLabs key for the
  audio node's live row, two Content Safety false positives on product
  images, the `docs/ui-automation-cdp.md` pointer line living in HEAD only.

---

## 2026-09-10 — V1 COMPLETION W8 STAGE 6 DONE: packaging, built-in flows, Tools hub, flag on

Stage 6 of `docs/flows-plan.md` (§9, §1.7, §1.8, §0.1 items 2–4) landed in
three commits by pathspec: `a774ddc` (the `.vidtsxflow` package layer on the
shared zip reader — manifest parser, reader, signing through the agents'
module, store, catalog rows, export / import, the run folders moved to
`<userData>/flows-runs`, `scripts/flow-pack.mjs`, the file association),
`784cb84` (the five built-ins as package manifests, the Tools hub "Flows"
group, "Run a flow on this" on Library and Video Studio, the Flows page's
Installed group / trust tags / uninstall), `2bbcc55` (`flows` flag on,
`docs/FLOW_PACKAGE_SPEC.md`, `docs/examples/flow-starter/`,
`docs/flows-ui-automation.md`) and the docs commit.

Gates: `check:types` at baseline (web 26 / node 10); `npx vitest run`
2312 passing (+64); `electron-vite build --outDir
.vidtsx-temp/w8-build` 2 m 14 s.

Exists now: Flows ships on (no `VITE_FF_FLOWS`), with five built-in flows
under Built-in (read-only, Duplicate copies), `.vidtsxflow` import / export /
install / uninstall with the agents' three trust states, a bare `flow.json`
import, the Tools hub listing the built-ins, and "Run a flow on this" from a
Library image / video and a Video Studio card. Every built-in ran three
times unattended on the second instance (all `success`; explainer run 2 was
the kill-mid-render + Resume row; product-ad run 1 the attended pick). Two
fixes the runs forced: `run.json`'s rename retries a Windows EPERM, and
absolute-path `staticFile()` in a composition is rewritten to the asset
server before a render (compositions with media on a port never rendered).
Spend $2.40 real (six Kling clips) + $0.001 AssemblyAI; LLM on the
subscription at $0. Screenshots `.vidtsx-temp/w8/stage6-*.png`.

Pending for Hasan: sign the five built-ins with the `vidtsx-1` key
(`flow-pack.mjs --sign`, or ship them as "Built-in" unsigned); one line in
`src/main/index.ts` (`queuePackageOpen`) to nudge the window to Flows on a
double-clicked `.vidtsxflow` once that file is free; the version bump (the
built-ins declare `minAppVersion 1.1.0`) and the installer rebuild with
`resources/flows`; §10 row 5 (Motion Post → `run_flow` → freeze → run) was
cited from Stages 4 and 5 rather than re-run end to end.

---

## 2026-09-10 — V1 COMPLETION W8 STAGE 5 DONE: freeze a session into a flow

Stage 5 of `docs/flows-plan.md` (§8, §1.5 "Freeze") landed in four commits by
pathspec: `675b02b` (the session call log `calls.json` + the freeze service —
lineage walk, args inverse, param detection, draft assembly), `26b7629`
(`save_flow`, `freeze_session_to_flow`, `FLOWS_FREEZE`, "Freeze into a flow"
on the agent stage's action bar, the frozen proposal on the Flows canvas),
`38db337` (the tool-only convention paragraph in Motion Post 1.3.0, TSX
Composer 1.1.0, Web Designer 1.0.1; manifests re-hashed) and the docs commit.

Gates: `check:types` at baseline (web 26 / node 10); `npx vitest run` 2248
passing (+20); `electron-vite build --outDir .vidtsx-temp/w8-build` 1 m 59 s.

Exists now: every agent session records its tool calls with arguments and its
interaction replies; any artifact on the agent stage can be frozen — the
winning path only (dead ends, rejected picks, failed retries dropped) becomes
nodes, edges, params (intake / pick values by value match, the first step's
text input as the run's prompt) and pauses (nodes a card reviewed), with the
session's brand as the run-level default; the draft shows on the canvas as
"Frozen from session …", Accept saves a `frozen`-sourced flow, Discard leaves
nothing; an agent can do the same through `freeze_session_to_flow` +
`save_flow` (name, description, param labels, exposed keys, pauses — never the
graph).

Verified on the second instance: a Motion Post session (brief → variants →
pick → composition → approve → render, `video-4` 1080×1920 8 s) frozen from
the action bar into Generate Composition (paused) → Render Composition with a
Brief param and a title select; accepted; run unattended with a new brief →
`success` in 172 s, an MP4 whose frame matches the session's (same brand
ground, amber numeral, serif line, rule). Spend $0 real ($1.03 API-equivalent
on the subscription). Screenshots `.vidtsx-temp/w8/stage5-*.png`.

Pending: the `viaAgent` naming turn was verified by unit tests only; sessions
recorded before this stage carry no lineage (typed error); Stage 6 (packaging,
built-ins, Tools hub, flag flip) is next.

---

## 2026-09-10 — V1 COMPLETION W8 STAGE 4 DONE: run_flow, run_agent, the Flow Builder

Flows plan §7 built and verified on the second dev instance (outcome
subsection under §7 of `docs/flows-plan.md`). Commits by pathspec, beside
the export-engines session's dirty tree: `a68bc9e` the shared `run_flow`
(unattended, the session's brand, outputs copied into the session, the
priced listing in the description), the `run_agent` node (non-deterministic,
`agent-provider` gate) and the Builder's `list_nodes` / `read_flow` /
`propose_flow` / `read_run`; `db11706` the Studio `run_flow` on a shot range
(`flow-tools.ts`, `flow-range.ts`: shots = master-track clips, ffmpeg trim →
the `video` param, the result imported and handed to `insert_asset`);
`136478f` the `vidtsx/flow-builder` built-in, `FlowProposalOverlay` (added
green / removed red / changed amber, Accept through the ordinary save),
"Ask the builder" on the shared `AgentChat`, Motion Post 1.2.0 with
`run_flow`; `73f0a0d` the four fixes the live runs found.

Gates: `check:types` web 26 / node 10 (baseline); `npx vitest run` 2228
passing (+48); `electron-vite build --outDir .vidtsx-temp/w8-build` 2 m 8 s.
Live: the Builder turned "make me a flow that captions a video" into a
three-node proposal, Accept saved it, its `run_flow` captioned the speech
MP4 in 42 s (AssemblyAI $0.0009); Motion Post ran the Thumbnail flow from
one line and showed the image on its stage in 42 s ($0); Studio ran
add-effect on shots 7–9 (a 9 s trim → one Kling 2.5 Turbo Pro clip, $0.40)
and the B-roll insert card was applied at 0:18. Spend $0.40 + $0.001.

Pending: `run_agent` live (unit-tested only); the Builder's card only on the
Flows canvas; Stage 5 (freeze) reuses the overlay; Stage 6 packaging,
built-ins in the Built-in group, the flag flip.

---

## 2026-09-10 — V1 COMPLETION W8 STAGE 3 DONE: product nodes

Flows plan §6 (`docs/flows-plan.md`, outcome subsection under §6). Four
commits by pathspec beside the export-engines session's dirty tree:
`efe1ed8` media helpers + the seven product nodes + `generate_audio` ports,
`4062256` the composition trio inside a flow (media convention, main-side
render settle, brand on nodes), `b16ef0b` the five built-in flow fixtures, `49e3303` the bundling-percent /
note-throttle / frame-name fixes the live runs found, plus the docs commit.

- Gates: `check:types` at baseline (web 26 / node 10); `npx vitest run`
  2180 passing (up from 2132, 48 new); `electron-vite build --outDir
  .vidtsx-temp/w8-build` 1 m 53 s alone.
- What exists now: `src/main/services/media/` (ffmpeg spawn + probe, trim /
  concat / frame grab on the filters Remotion's ffmpeg build has, a Remotion
  render driven from main); `transcribe`, `caption_video`, `text_to_speech`,
  `extract_frame`, `trim_video`, `concat_videos`, `save_to_library` in the
  registry (`AGENT_TOOL_IDS` appended); `generate_audio` is a priced node;
  `generate_composition` loads port media through `staticFile()` and binds a
  provider/model; `render_composition` renders inside a flow (job settled in
  main, MP4 filed through the agents' reconciler, cancel + Resume); per-node
  `brandId` on the four brand-taking nodes; `resources/flows/vidtsx/*/flow.json`
  validated against the registry; the Thumbnail prompt in
  `src/shared/prompts/`.
- Verified on the second instance (W3 profile, `VITE_FF_FLOWS=1`):
  `explainer-30s` brief → script → composition → 30.06 s 1920×1080 MP4
  unattended on `claude-subscription` (525 s, $0; on-brand) and on the
  `minimax` baseURL preset (272 s, $0.44); `frame-strip` 6 frames in 2 s;
  `transcribe` + `caption_video` through AssemblyAI in 41 s ($0.001, brand
  vocabulary spelled right, karaoke burn-in); kill mid-render → Resume
  reruns the render and finishes. Spend $0.44 real.
- Pending: `product-ad` / `add-effect` live runs (fal spend, Stage 6's
  three-runs rule); an `input_audio_file` node; `openrouter` has no LLM key
  on the W3 profile (minimax stood in); ElevenLabs audio node verified at the
  unit seam only; the caption templates size text for 1080p.

---

## 2026-09-10 — V1 COMPLETION W8 STAGE 2 DONE: pause, run form, Flows page

Stage 2 of `docs/flows-plan.md` §5 (W8 Flows, adjusted by §0.1 items 6, 9,
10). Full outcome under "Stage 2 outcome" in the plan. `check:types` at
baseline (web 26, node 10); 2132 tests, up from 2104; `electron-vite build
--outDir .vidtsx-temp/w8-build` passes (1 m 52 s, alone). Commits by
pathspec: `b9d3aa6` (the inspector fields and the ActionBar moved to shared
homes), `a7b87db` (checkpoints through the interaction broker), `99a57eb`
(run form, Flows page, inspector toggles, run-scoped artifact IPC), this one
(docs). Spend $0 — 12 image calls, all on the Antigravity bridge
(`gemini-cli` / `nano-banana-2`), logged as `featureSource: 'flows'`.

- **Checkpoints** (decision 4): a `pause` node in an attended run raises a
  card through the agents' `InteractionBroker` (pick for several images,
  approve for one artifact, editable form for text), persisted in
  `run.json.pending`; accept substitutes the chosen value on the port, the
  first reject reruns the node once with the note on its prompt, a second
  reject or Stop cancels; an app close at a checkpoint survives as expired
  and Resume asks again without rerunning. `ctx.ask` works for tools in
  attended runs. `generate_image` gained `count` (1–4 variations).
- **Run form** (`FlowWorkspace` Run | Edit): params in order through the
  shared fields (`image` / `video` pick file or library), `BrandSelect`
  beside the mode switch, the priced-steps line, Run / Cancel / Resume;
  outputs large through the shared viewer registry with the shared
  `ActionBar` over run-scoped `FLOWS_RUN_ARTIFACT_RESOLVE` / `_ACTION`; the
  pause card over the viewer; a collapsible steps strip.
- **Inspector**: `PauseToggle` per node, `ExposeParamToggle` per field
  (bound fields lock), `LlmModelPickerField` on the shared `ModelSelect` +
  `useModelPicker` with `modelMode`. **Flows page**: My flows / Built-in /
  Installed groups, New, Import, card menu (Run, Edit, Details, Duplicate,
  Export, Remove); Import / Export are typed Stage 6 stubs.
- **Verified live** on the second instance: two params exposed from the
  inspector, an attended run paused with a three-image pick card, the
  chosen image fed the next node, the output showed with the action bar
  (Save to Library → Assets), unattended skipped the pause, reject + retry
  honoured the note, kill-at-checkpoint → Resume re-asked without a rerun.
- **Pending**: Stage 3 (product nodes, the render-queue bridge), Stage 6
  (packaging, built-ins, the Library / Video Studio handoffs — `prefill` is
  ready), no `images` output port exists yet (pick follows the artifact).

---

## 2026-09-10 — V1 COMPLETION W8 STAGE 1 DONE: registry ports and the main runner

Stage 1 of `docs/flows-plan.md` §4 (W8 Flows, adjusted by §0.1 items 7,
9, 10, 14). Full outcome under "Stage 1 outcome" in the plan. `check:types`
at baseline (web 26, node 10); 2104 tests, up from 2064; `electron-vite
build --outDir .vidtsx-temp/w8-build` passes (2 m 40 s). Commits by
pathspec: `7d4924b` (invokeTool + tool-server reroute), `92d710c` (ports,
NodeSpecs, five new tools), `5b0f3a6` (runner, run store, IPC, canvas),
`578b946` (two acceptance fixes), this one (docs). Spend $0 — every image
went through the Antigravity bridge (`gemini-cli` / `nano-banana-2`).

- **invokeTool** (`agents/tools/invoke-tool.ts`, §11): the one handler
  path — zod validation, the `needs` gate when capabilities are passed,
  the usage `featureSource` stamped on the context, throw → error result.
  The agents' tool server calls it; `tool-server.test.ts` unchanged.
- **Ports.** `ports` on ten tools; `listNodeSpecs(capabilities)` (`needs`
  + `available`, `priced`, `priceHint` from the fal catalog) and
  `getNode`. New: `input_text`, `input_image_library`, `input_image_file`,
  `input_video_file` (inputs COPY into `<libraryFolder>/inputs`), and
  `generate_text` (decision-12 model modes, `useBrand`). `generate_image`
  takes a source and references as image-set ids.
- **Runner** (`src/main/services/flows/`): validate against the registry,
  topo-sort, args from ports + params + config, `invokeTool` with a
  run-scoped context, artifacts filed, video jobs settled in main, run.json
  persisted after every node, `FLOWS_RUN_EVENT` relayed, cancel through
  the signal, Resume from the first non-done node; 20 runs per flow with
  their folders under `<assets>/flows/<flowId>/runs/<runId>/`.
- **Canvas** on `NodeSpec`s from `FLOWS_NODES_LIST`: palette by category,
  the `needs` chip, previews from run asset urls, Run / Cancel / Resume;
  `nodes/*` and the renderer runner deleted.
- **Verified live** (second instance, W3 profile): the three templates ran
  from the canvas through main (27 s, 22 s, and — after the image-to-image
  → reference fallback — 18 s on Resume); killing the app mid-node left an
  interrupted run that offered Resume, and Resume finished it (31 s).
- **Next (Stage 2).** Pause through the broker (the seam is marked in
  `flow-runner.ts`), the run form, the Flows page groups; render jobs
  inside a flow wait for Stage 3's queue bridge.

---

## 2026-09-10 — V1 COMPLETION W8 STAGE 0 DONE: contracts and migration

Stage 0 of `docs/flows-plan.md` §3 (W8 Flows, unparked by §0.1). Full
outcome under "Stage 0 outcome" in the plan. `check:types` at baseline
(web 26, node 10); 2064 tests, up from 2035; `electron-vite build --outDir
.vidtsx-temp/w8-build` passes. Commits by pathspec: `c2edda9` (code), this
one (docs). Spend $0.

- **Contracts.** `src/shared/types/flows.ts`: `FlowDoc` v2 (§1.1 verbatim —
  `params` with the inspector kinds + `image`/`video`, `graph` with
  per-node `pause`, `outputs`, `origin`), `DataType` ×8, `PortDef`
  (`argKey`, `from`), `ToolPorts`, `NodeSpec` (`needs`, `priced`,
  `priceHint`), `FlowRunMode`, `FlowRunDoc` (run.json with run-level
  `brandId`), `FlowPortValue`, `FlowRunEvent`, `isPortCompatible`.
- **Migration.** `src/shared/flows/migrate-v1.ts`: the alias table both
  ways, ids validated (ulid or `n-…`, case-insensitive) and rewritten
  deterministically with edges following, outputs = sinks, `pause` false,
  removed model ids kept; `parseFlowDoc` migrates / passes through /
  empties. `doc-graph.ts` (`withGraph` reconcile), `topo-sort.ts` (shared
  Kahn), `validate.ts` (17 structural codes, no registry).
- **IPC.** Ten `FLOWS_*` channels and their types appended; `docVersion`,
  `origin`, `source` on the project summary. No handlers or preload yet.
- **Store.** `flows-projects-db.ts`: three columns by idempotent ALTER,
  every v1 row rewritten as a FlowDoc at open, reads always v2, writes
  accept v1 or v2; `flow_runs` split into `flows-runs-db.ts`.
- **Canvas.** `useFlowGraph` maps the doc to and from reactflow and keeps
  params/outputs/origin/pause on a ref across saves; verified live on the
  second instance — template → 3 nodes / 2 edges, drag → v2 row with the
  moved position, back, reopen → same canvas
  (`.vidtsx-temp/w8/stage0-canvas.png`).
- **Next (Stage 1).** Registry `ports` + `NodeSpec`s, `invokeTool`, the
  main runner and run store, the `FLOWS_*` handlers + preload +
  `electron.d.ts`, the six migrated nodes, the canvas on the new specs.

---

## 2026-09-10 — V1 COMPLETION W9 DONE: web designer agent

Workstream W9 of `docs/v1-completion-plan.md` §2.9 — the last workstream of
the night; W8 Flows stays parked by decision. Full outcome under the W9
acceptance paragraph in the plan. `check:types` at baseline (web 26, node
10); 2035 tests, up from 2013; `electron-vite build --outDir
.vidtsx-temp/w9-build` passes. Commits by pathspec: `1a57a15` (the `web-page`
kind, write_page / edit_page / capture_page / export_site, the sandboxed
WebPageViewer), `c58e39e` (the `vidtsx/web-designer` built-in), this one
(docs).

- **The kind.** `ARTIFACT_KINDS` gains `'web-page'` (`{ relPath, refs,
  inlineBytes }`, workspace root); `AGENT_TOOL_IDS` gains `write_page`,
  `edit_page`, `capture_page`, `export_site` — both append-only. Every
  kind-switch site W2b listed follows. `src/shared/agents/web-page.ts` holds
  the one grammar: `artifact:<id>[/<n>]` references, the validator (one
  document, nothing external, no network API, `<a href>` links allowed), the
  viewer CSP verbatim from the plan, the export CSP, the three widths, the
  16 MB inlined cap.
- **The tools.** `write_page` validates, resolves references against the
  session's own media artifacts, weighs the inlined page and stores it;
  `edit_page` = one instruction through the session's model, same gate, new
  version; `capture_page` renders the inlined page in a sandboxed offscreen
  window whose `webRequest` cancels everything but its own file, files the
  PNG as an image-set and hands the model a JPEG (new
  `AgentToolResult.images`); `export_site` writes `site-<slug>/` (index.html +
  assets/) and the zip into the session's library folder.
- **The viewer.** `WebPageViewer` — `sandbox="allow-scripts"`, no
  `allow-same-origin`, srcdoc under the CSP, Desktop / Tablet / Phone; the
  stage action bar gains `open-in-browser` and `export-site` for this kind.
- **The built-in.** `vidtsx/web-designer` 1.0.0 with the `web-design` skill,
  a three-question starter (the brand question is the session brand picker),
  three quick starts, `files[]` hashed by `agent-pack.mjs --hash`.
- **Acceptance, live (session `s-e156225f`, Opus 5, brand `acme-test`).**
  Poster image → cheapest-available fal clip (`seedance-2.0-fast`, 5 s,
  $1.20 — the requested `seedance-1-lite` is a legacy catalog entry the tool
  does not offer; $0.20 over the brief's cap) → the job note woke the agent →
  `write_page` → two `capture_page`s → `edit_page` → `web-page-7` v2. Viewer
  screenshotted at all three widths; "Export site" → folder + zip; Edge
  (remote-debugged) plays the hero `<video>` (`currentTime 1.6 → 3.1 s`, no
  failed requests); the export is copied to
  `C:\Users\Malak\Videos\VidTSX\vidtsx-landing-site-w9\`. Network block:
  `write_page` refused the `<img src="https://example.com/x.png">` +
  `fetch('https://example.com')` page with three named findings; the same
  page written straight into the viewer iframe rendered "fetch rejected |
  img onerror fired | parent blocked: SecurityError" with zero requests to
  example.com on the wire.
- **Left.** Per-model prices in `generate_video`'s catalog answer (so
  "cheapest" is decidable); a first-screen capture default (full pages reach
  the model small); a Home thumbnail for web-page sessions; `edit_page` has
  no fix loop; main-started turns still read `busy: false` in the renderer.

---

## 2026-09-10 — V1 COMPLETION W6 DONE: project posters + Home

Workstream W6 of `docs/v1-completion-plan.md` §2.6 — the plan's second cut
line. Full outcome under the W6 acceptance paragraph in the plan.
`check:types` at baseline (web 26, node 10); 2013 tests, up from 2002;
`npm run build` passes with Home as the default screen. Commits by
pathspec: `a80dbcf` (posters), `fcc6524` (Home), `a92a8ef` + this one (docs).

- **Posters.** `project-poster.ts` + the pure `project-poster-pick.ts`:
  `<project>/cache/poster.jpg` from the first video clip on the top-most
  video track at 10 % of the timeline (proxy if ready, else the original),
  written on save (4 s trailing debounce in main) and on close (new
  `STUDIO_PROJECT_CLOSE`, one line in `useStudioProject`'s cleanup). No
  video → no file. `StudioProjectSummary.posterPath` + `brandId`; the
  renderer reads it through `studioCacheRead` like asset thumbnails;
  `ProjectPoster` (shared) keeps the orientation or draws the brand-palette
  gradient with the initials. The Studio browser's grey box is gone
  (`ProjectCard.tsx` split out).
- **Home.** `src/features/home/`, default screen, first in the sidebar,
  `home: true`. One `HOME_SUMMARY` IPC (`home-summary.ts`) over the
  existing stores: eight Studio projects, Motion projects (folder scan,
  newest `vN.tsx` mtime), agent sessions across installed agents, provider
  has-key count, AI runtime scan, whisper binary + models, the queue via a
  new side-effect-free `peekQueueJobs()`, updater state, version. Sections:
  header (greeting, version, update chip), Continue (eight cards + See all),
  Start tiles (flag-filtered; Flows hidden while env-gated), Status strip,
  Announcements (the feed MOVED here on `useNews`; `NewsCard.tsx` deleted).
- **Navigation.** Home imports no feature: `vidtsx:navigate` + the target's
  open event after the 150 ms mount delay — new `vidtsx:studio-open`
  (`projectId` or `newProject`) and `vidtsx:agents-open` (`agentId`,
  `sessionId`; `AgentWorkspace.openSession`), the existing
  `vidtsx:creator-open` for TSX. New `vidtsx:screen-active` from App's
  routing effect and `vidtsx:studio-projects-changed` after a close.
- **Evidence.** Every card kind and every tile driven over CDP 9223 and the
  screen changed each time; poster written on close (`sourceTime 3`) and on
  save (`sourceTime 42`, 7 s after the IPC save); audio-only project stays
  the placeholder with no ffmpeg; a 9:16 project shows a 53×94 portrait
  poster. Cold start to the screen's DOM: Creator before 5.3–5.6 s, Home
  after 5.4–5.9 s on settled runs (6.7–7.0 s right after a build), data
  +125–240 ms; main init unchanged (~200 ms). Screenshots in
  `.vidtsx-temp/w6/`.
- **Left:** no thumbnail for Motion/session cards (kind icon); no Images /
  Videos / 3D recents; the poster signature is in-memory (one frame after
  each launch); `EditorShell.tsx` still ~1 300 lines.

---

## 2026-09-10 — V1 COMPLETION W7 DONE: TSX agent mode

Workstream W7 of `docs/v1-completion-plan.md` §2.7. Full outcome under the
W7 acceptance paragraph in the plan. `check:types` at baseline (web 26, node
10); 2002 tests, up from 1990. Commits `8aabd36` (move), `58e4a98` (main +
built-in), `8a6b58c` (panel) and the docs commit.

- **`Prompt | Agent`** at the top of the Creator's input panel. Agent mode
  keeps the panel's Provider / Model / Brand pickers and embeds the shared
  `AgentChat` (embedded form: no chip, `ask_user` cards under the chat)
  bound to the new built-in `vidtsx/tsx-composer`. The reusable chat half
  of the Agents feature moved first to `src/renderer/components/agents/` and
  `src/renderer/hooks/agents/` (rule 1: motion never imports agents).
- **The sink.** `motion-project-sink.ts`, one adapter on a new runner hook
  (`prepareArtifact`): a session with `motionSink` writes every composition
  as the next `vN.tsx` of a Motion project — the first composition creates
  it (named after the composition's title, the prompt mode's own naming)
  and `motionProjectId` is remembered on the session; the draft carries
  `payload.motion = { folderPath, versionPath }` so the preview loads it
  and the Render button renders it exactly as in prompt mode.
- **Brand + model** (decision 7 / W1): the turn's model reaches
  `generate_composition` / `edit_composition` via `AgentToolContext.model`;
  the session brand's `buildBrandInstructions` block (now shared in
  `src/shared/studio/brand-instructions.ts`) is injected ahead of the
  agent's style notes, so both modes build under one contract.
- **Skill = the prompt.** The 2D generate prompt's Style presets / Layout /
  Typography sections are `TSX_CRAFT_RULES` (byte-identical prompt output);
  the agent's `tsx-craft` SKILL.md is generated from them
  (`scripts/gen-tsx-craft-skill.mjs`) with a drift-guard test;
  `scripts/agent-pack.mjs --hash` rewrote the manifest's `files[]`.
- **Evidence.** Session `s-afece65c`, Opus 5, brand `acme-test`: "Make me a
  10-second logo sting for my brand" (one form question answered on the
  card) → `projects/acme-test-logo-sting/v1.tsx`; "make the text bigger" →
  `v2.tsx` as an `edit_composition` of v1 (112→160 / 32→48 px), preview on
  v2; the Render button → `Videos\VidTSX\AcmeTestLogoSting_2026-09-10T00-17-55.mp4`
  — ffprobe h264 1920×1080 30 fps, 300 frames, AAC, 10.048 s. Seven usage
  rows, all `claude-opus-5 / agent / vidtsx/tsx-composer`; main log 0
  warn/error. Sessions and project deleted afterwards.
- **Left:** binding Agent mode to an already-open project; no chat turns
  written into the Motion project; no thinking dial in Agent mode; no icon;
  `MotionScreen` / `agent-service.ts` over the line budget. For W6:
  `AgentSession.motionSink` / `motionProjectId` ride `listAgentSessions`.

---

## 2026-09-10 — V1 COMPLETION W2b BUILT, live rows pending: ElevenLabs sound effects + music

Workstream W2b of `docs/v1-completion-plan.md` §2.2 — the last W2 provider
subsection (W2a and W2c landed earlier today). Full outcome under the W2b
acceptance paragraph in the plan. `check:types` at baseline (web 26, node
10); 1990 tests, up from 1955. Commits `170edef`, `5e6ac90`, `0a2dde2` and
the docs commit.

- **No ElevenLabs key on this machine** — neither profile has one (checked
  inside main over the inspector, the legacy STT rows too), so the rows that
  need ElevenLabs' own answer are PENDING with steps in the outcome; nothing
  fabricated. The no-key row ran on the real wire; the end-to-end Studio run
  ran with ONLY the ElevenLabs HTTP response stubbed inside main (request
  bodies recorded) — engine, filing, import, word anchor, audio lane, cards
  and export are the production code.
- **The engine.** `src/audio-engine/generation/`: `AudioGenerationEngine`,
  `elevenlabs-audio-provider.ts`, the one request shape, the API's bounds
  enforced before the call, usage rows priced at $0.12/min SFX and $0.15/min
  music (pricing page; §5 q2 answered). Wire verified against the reference:
  music takes `music_length_ms` (the plan's `duration_ms` was stale), `seed`
  only with a composition plan, `output_format` on the query string. Audio
  prompts are NOT gated — ledger line in `CONTENT_SAFETY_DESIGN.md` (Rev 3).
- **Tools.** Studio `generate_sfx` / `generate_music` (awaited, imported on
  use, then `insert_asset(lane: "audio")`; the prompt's "not available" line
  replaced; preset sfx/music steps map to them). Agents `generate_audio`
  (needs `audio-provider`) + the `audio` artifact kind and `AudioViewer`.
  IPC `AUDIO_GENERATE`; registry capability `audio` on ElevenLabs.
- **Evidence.** Bodies `{ text, model_id: eleven_text_to_sound_v2,
  duration_seconds: 1.5 }` and `{ model_id: music_v2, force_instrumental,
  prompt, music_length_ms: 30000 }`; usage rows $0.003 / $0.075; the whoosh
  anchored to the second "building blocks" at 24.466 s; export 60 s
  1080×1920 H.264 + AAC, and in the source's quiet stretch at 28–30 s the
  export's 220 Hz band reads −44.5 dB against the source's −64.8 dB.
- **Found and fixed.** A bed "at 0" landed at 27.5 s — the one audio lane
  pushed it past the whoosh; an audio insert now takes a FREE lane at its
  placement, adding one when needed (`0a2dde2`, verified live: lane A2 at 0 s).
- **For W7:** `ARTIFACT_KINDS` has six kinds now (`audio` last), every
  kind switch site is listed in `5e6ac90`; `AGENT_TOOL_IDS` is eleven ids;
  `resolveToolCapabilities()` is async (`audioProvider`).

---

## 2026-09-10 — V1 COMPLETION W2a DONE: Seedream images on ModelArk

Workstream W2a of `docs/v1-completion-plan.md` §2.2 — the first of the W2
provider subsections (W2b ElevenLabs audio stays open; W2c landed earlier
today). Full outcome under the W2a acceptance paragraph in the plan.
`check:types` at baseline (web 26, node 10); 1955 tests, up from 1937.
Commits `55c9bc1`, `192d5f0` and the docs commit.

- **The wire.** `BytePlusArkClient.createImage` → `POST /images/generations`
  (synchronous, `b64_json`); `BytePlusImageProvider` behind the image
  engine's chokepoint, so Gate A/B, the W2c param resolver, usage logging
  and library filing came free. Per-model size envelope: ModelArk's
  `<width>x<height>` form has a total-pixel FLOOR (2560×1440 worth on 4.5
  / 5.0 lite, 1280×720 on 5.0 pro), so the app's 1024² / 1280×720 asks are
  scaled onto it on multiples of 16 — seen on the wire as `1920x1920` and
  `2560x1440`.
- **Docs over plan.** Real ids `seedream-4-5-251128`,
  `seedream-5-0-lite-260128`, `dola-seedream-5-0-pro-260628` in
  `src/shared/presets/image-model-entries.ts` with the published prices
  ($0.04 / $0.035 / $0.045). The 4.x / 5.x reference lists no
  `guidance_scale` and no `seed`; live, seed is accepted and guidance is
  rejected, so the `byteplus-seedream` dialect is Seed only now.
- **Registry.** `byteplus` → `['video', 'image']`, image preset `byteplus`
  (default Seedream 4.5), `ImageProviderConfig.type` / `ImageProviderType`
  gain `'byteplus'`; the key test stays the video call.
- **Live rows** on a real key: text→image, image→image and a two-reference
  call on 5.0 Pro (25 / 98 / 89 s, bodies captured); the Studio agent's
  `generate_image` picked byteplus as the active provider and filed the
  image; usage rows at $0.045 — including the agent path, which had logged
  $0 for every provider until now (`generate-image-asset.ts` fixed).
- **Left.** Seedream 4.5 and 5.0 lite are not activated on the account
  (only pro is): activate them in the Ark Console, then rerun on 4.5. Sets
  on 4.5 / lite use `sequential_image_generation: 'auto'` (count is the
  model's, untested live); pro loops one call per image.

---

## 2026-09-10 — V1 COMPLETION W2c DONE: per-model image parameters

Workstream W2c of `docs/v1-completion-plan.md` §2.2 — the third of the W2
provider subsections (W2a Seedream on ModelArk and W2b ElevenLabs audio
stay open). Full outcome under the W2c acceptance paragraph in the plan.
`check:types` at baseline (web 26, node 10); 1937 tests, up from 1908.
Commits `7f6008d`, `d562325` and the docs commit.

- **One shape for local and cloud.** `ImageModelParams` + `ImageParamSchema`
  in `src/shared/presets/image-model-params.ts`; overrides in the settings
  key `imageModelParamOverrides`, keyed `provider/model`. The cloud image
  engine merges `request ⊕ override` at its chokepoint through an injected
  resolver, so Image Studio, both agent registries, flows and bulk inherit
  an override with no call-site change; the family defaults fill the rest
  in sd-cli's `buildArgs`. The direct sd-cli IPC applies it too.
- **Local.** `FAMILY_PARAM_SCHEMAS` in `family-presets.ts` (the dialog never
  hardcodes fields), `toSdRequest` in `local-sd-provider.ts`, and the engine
  now logs the exact argv per spawn (`"sd-cli argv"`).
- **Cloud.** `ImageDialectId` (`fal-flux | fal-nano-banana | fal-generic |
  cloudflare | byteplus-seedream | openrouter | gemini-cli`) with
  `IMAGE_DIALECT_DEFAULTS` (paramSchema + supportedOperations),
  `hydrateImageEntry`, the catalog sanitiser keeping `dialect` on image
  rows, shipped entries naming theirs. fal / Cloudflare send exactly the
  fields their dialect declares (Cloudflare maps steps per model with the
  API caps); OpenRouter and the Antigravity CLI declare none. Fixed on the
  way: `fal-generic` exists in both dialect namespaces, so the video
  type guard is now structural (`textToVideoEndpoint`).
- **UI.** Gear on every installed local row and every cloud image catalog
  row → `ModelParamsDialog` (schema-driven, Save / Reset to defaults);
  dialect select when adding a fal image id; Image Studio's "Advanced"
  disclosure renders the selected model's schema for this request.
- **Verified in the real app** (second instance, W3 profile, CDP 9223): the
  tiny SD 1.5 profile with Steps 12 / karras / a negative prompt saved
  through the gear logged `--steps 12 … -n "blurry, text" … --scheduler
  karras` with the model's own size/CFG/sampler; reset logged `--steps 4`
  and no `-n`/`--scheduler`. Nano Banana's dialog shows the "no
  parameters" notice, Cloudflare's shows four fields, a `fal-flux` row
  three. One real fal run with Seed 12345 saved on SeedREAM v4.5: the
  captured wire body carried `seed: 12345` ($0.12 across three images;
  SeedREAM is not seed-deterministic, the capture is the proof).
- **For W2a.** Entries with `dialect: 'byteplus-seedream'`; the provider
  reads `request.params.cfgScale/seed`, exposes `defaultModel` and puts the
  dialect's `paramSchema` on each model info. Details in the outcome.

---

## 2026-09-10 — STUDIO FLIP DONE: studio-editor on, testing pass on raw footage

Step 5 of `docs/v1-completion-plan.md` §3 — the first cut line with Studio
in the release. `studio-editor` is a plain `true`; `npm run build` passes
with the flip and the bundle reads `"studio-editor": true`. Full log — the
three parked findings, the run on the 4K DJI clip, the hand tests, the
three long-GOP exports and the driving lessons — in the plan's §3.1 "Studio
flip outcome". `check:types` at baseline (web 26, node 10); 1908 tests, up
from 1898. Commits `c8ebecc`, `f081745`, `3771ce2`, `d226d9b` and the docs
commit.

- **The flip.** The Coming Soon screen stays as the flag's off branch (a kill
  switch); README gains a Studio section and drops Video Studio from "Coming
  soon"; docs/studio/PLAN.md and V1_RELEASE_PLAN.md note the date.
- **W3 finding 2 — confirmed and fixed.** `LLM_CANCEL` called
  `llmEngine.abortActive()`, and the Claude provider's abort closes EVERY
  session — a Stop in the Tools chat killed a running Studio turn. Now each
  renderer request has its own AbortController tagged with window, feature
  source and session scope (`llm-request-scope.ts`); cancel reaches only the
  matching ones; main-process turns are untouchable by construction.
- **W5 finding — fixed.** Under 30 s the learn card withholds pacing,
  shots/min and SFX/min and says so ("Edit under 0:30 (0:12) — …"); the
  count-and-flag knobs still hold. Formatting moved to
  `preset-learn-format.ts`.
- **W3 finding 1 — not reproduced; safety net shipped.** The same kind of
  clip (8 s GOPs, B-frames, 17-piece cut) exported 960/960 frames three times
  — 1.75 GB free, a 50 MB cache cap (dev knob
  `VIDTSX_OFFTHREAD_VIDEO_CACHE_BYTES`), and 310–430 MB free — byte-identical
  each time. `renderComposition` now retries once with one tab on that exact
  error and the queue row's text says what to do.
- **The run.** One line on the raw 4K HEVC 0271 clip (73 s, 664 MB) with the
  YouTube long-form preset: transcribe (125 words, 4 keyterms) → Auto Cut
  natural 24 → editorial 8 → two shots → one library b-roll → captions →
  export; four cards clicked, 8 min to the queue, 6 min to render, MP4 478
  frames / 15.933 s H.264 + AAC, complete. No crash, free RAM bottomed at
  510 MB, zero error/warn lines in the main log. $2.31 API-equivalent, all
  LLM turns on the subscription route.
- **By hand.** Cold open (proxy ~2 min), Inspector Transcribe, Auto Cut by
  button, split, undo/redo (buttons and keys), a 1.5 s trim and its undo,
  captions, a 30.6 MB proxies-only `.vidtsx` package read back by inspect.
- **Next:** W2 providers (a, c, then b), then W7, W6, W9, W8 per §3. Finding 1
  stays open as a reproduction; `remotion-renderer.ts` (424 lines) wants its
  split.

---

## 2026-09-09 — V1 COMPLETION W5 DONE: editing presets + learn from this video

W5 of `docs/v1-completion-plan.md`. A preset is the playbook for one kind of
video — the workflow the assistant follows, the style knobs, and a PRESET.md
it reads — picked per project, and "learn from this video" writes back into
it only through a card. Full log — the entity, the prompt slot, the two runs,
the learn card, the round trip and the driving lessons — in the plan's §2.5
"W5 outcome". `check:types` at baseline (web 26, node 10); 1898 tests,
up from 1843. Commits `aaa6aa2`, `cc136a7` and the fix + docs commits.

- **The entity.** `StudioPreset` at `<assetsRoot>/presets/<id>/` (preset.json
  + PRESET.md, optional skills/), a store like the brand store, three
  brand-scrubbed built-ins (Talking-head short, YouTube long-form, Course
  lesson) seeded into the library on first use, a Presets dialog on the
  Assets screen with the markdown editor and a one-line-per-step workflow.
- **In the prompt.** `composeSystemPrompt` has a middle slot now: the
  preset block sits after the skills and before the memory block, under a
  4 000-char budget with a visible truncation marker; `get_preset` reads the
  rest. The preset's workflow replaces the generic order; there is no
  `run_preset` — the agent is the runner.
- **Proof.** The same 60 s clip and the same chat line on two presets: the
  short ran a tight Auto Cut, opened on the hook line, put a word-synced title
  in the upper third and word-pop uppercase captions; the lesson ran a light
  Auto Cut that kept pauses under two seconds, suggested no fluff, made a
  chapter title card and rolling sentence-case captions.
- **Learn from this video.** Deterministic timeline stats + one LLM summary →
  a card with the knob diff and the numbers behind each row. On a
  hand-tightened project it proposed pacing relaxed → tight (28.5 cuts/min,
  mean clip 2 s); accept wrote the knobs, a "Learned from" section and the
  learned log. The chat path (`propose_preset_update`) uses the agent's own
  summary; reject writes nothing.
- **Round trip.** preset.json travels in a `.vidtsx` (knobs, workflow, body);
  the import dialog offers match / create / none, like the brand.
- **Next:** the Studio flip (`studio-editor: true`) with its own testing pass
  on the raw-footage clips — the three parked findings (long-GOP "No frame
  found", the global `LLM_CANCEL`, the naive learn numbers on tiny edits) go
  on its list.

---

## 2026-09-09 — V1 COMPLETION W4 DONE: script, vocabulary, brands everywhere

W4 of `docs/v1-completion-plan.md`. Names the brand cares about now reach
the transcription engine before it hears them, the Script tab gives the
editorial pass the intended final read, and every agent session knows its
brand. Full log — the feed, the AssemblyAI answer, the card, the Agents
picker and the run's evidence — in the plan's §2.4 "W4 outcome".
`check:types` at baseline (web 26, node 10); 1843 tests, up from 1807.
Commits `448a086`, `03d2a65`, `531496e`, `548eab7`, `20e705c`.

- **Vocabulary lives on the brand** (`StudioBrand.vocabulary[]`, cap 200,
  edited in the Brand form as `Term = mangling, mangling`). The memory tier
  stays the proposal path: `propose_vocabulary` is a multi-select card the
  agent raises after every transcription and from the script; accept writes
  the library brand and retires the memories it now carries.
- **The STT feed.** Brand terms + script proper nouns + vocabulary memories
  compose into `keyterms` on the transcription request; AssemblyAI gets
  `keyterms_prompt` (`word_boost` is deprecated and rejected by the
  Universal-3 models — §5 question 3 closed), ElevenLabs Scribe `keyterms`,
  whisper.cpp `--prompt`. A deterministic post-pass then replaces every
  alias in the words and text, logged per replacement.
- **Proof.** The same 15 s clip transcribed with the feed reads "VidTSX" ×3,
  "Remotion", "LearnWithHasan"; without it, "VIDTSX", "ReMotion", "Learn with
  Hassan". The log shows `keyterms_prompt` with four terms.
- **Script.** `project.script`, a Script tab, the opening in the system
  prompt, `get_script` for the rest; the editorial workflow reads it to pick
  the keeper take.
- **Brands in Agents.** `get_brand` in the shared registry (Motion Post
  1.1.0 uses it), a brand picker in the starter and a chip on open sessions
  (`AGENT_SESSION_BRAND_SET`). Flows' brand input waits for W8, per the plan.
- **Next:** W5 (editing presets + learn from this video), then the Studio
  flip.

---

## 2026-09-09 — V1 COMPLETION W3 DONE: the Studio agent goes end-to-end

W3 of `docs/v1-completion-plan.md`. "Edit this video" in the Assistant now
runs transcribe → auto cut → editorial pass → shots → b-roll → captions →
export with the user only answering review cards, and every step is a tool
that calls the service the matching button already calls. Full log — the
split, the nine tools, the renderer action bridge, the run's evidence and the
three findings it leaves — in the plan's §2.3 "W3 outcome". `check:types` at
baseline (web 26, node 10); 1807 tests, up from 1786. Commits `2384f09`,
`df40d92` and the marker fix.

- **Split first, then add.** `studio-agent.ts` went from ~890 lines to 175;
  the tools live in `src/main/services/studio/agent-tools/*.ts` with an
  append-only id list. New tools never go back in the service file.
- **Nine new tools, no new mechanism.** transcribe_asset, run_auto_cut (the
  SAME proposal as the toolbar button — `buildCutProposal` is shared now),
  generate_video (awaited, brand-tagged, imported into the project),
  insert_asset (a one-clip `insert-plan` proposal with its own review card,
  word-anchored to the footage), list_assets, get_brand, set_captions,
  accept_proposal (only on the user's explicit "apply it") and export_project.
- **The document and the queue are renderer-owned**, so apply / export /
  captions go through a main→renderer action bridge (`agent-actions.ts`,
  `STUDIO_AGENT_ACTION_RESULT`). A multi-step run continues by itself: the
  agent ends a card-awaiting message with `[next: …]`, and answering the card
  sends the review outcome back as a turn — queued if the card is answered
  while the last sentence is still streaming (the live run found that gap).
- **Driven for real** on a second dev instance: one chat line on a 60 s
  talking-head excerpt, four cards clicked, an exported 13.6 s MP4 with 27
  cuts, two shots, one Kling b-roll and karaoke captions; cancel mid-shot
  left the timeline untouched. About $2.4 of provider spend.
- **Left open.** SFX/music wait for W2b (the prompt says so); a Remotion
  compositor "No frame found" on a long-GOP libx264 encode (re-encoded, then
  fine) and one unexplained provider-level cancel are noted in the outcome
  for the flip's testing pass. Fable 5.1 still waits for the SDK bump (W1).

---

## 2026-09-09 — V1 COMPLETION W1 DONE: the model foundation (pick a model, not only a provider)

W1 of `docs/v1-completion-plan.md` — the first of the nine workstreams, and
the one the others build on. A user now picks a MODEL wherever an LLM runs:
the Studio agent (a planning slot and a shot slot, plus a thinking dial, in
the Inspector and as a chip in the Assistant composer), Agents sessions (the
same chip; the choice sticks to the session), and the TSX panel (a Model
select under Provider). Full log with the verified catalog, the contract
deltas and the acceptance evidence: the plan's §2.1 "W1 outcome".
`check:types` at baseline (web 26, node 10); 1786 tests passing, up from 1764.

- **The catalog is what a real call accepted, not what the plan guessed.**
  Every seeded id was called before it stayed, headless under Electron with
  the app's own stored keys. Claude: Opus 5, Sonnet 5, Opus 4.8, Sonnet 4.6,
  Haiku 4.5. MiniMax M3/M2.7/M2.5, Kimi K3/K2.7-code/K2.6, seventeen OpenRouter
  ids. OpenAI, Gemini and Z.AI (hidden in V1, no key on hand) keep only the
  default they already run on.
- **Claude Fable 5.1 is OUT of the Claude catalogs** — the subscription route
  answers "Claude Code 2.1.119 does not support this model; version 2.1.251 or
  newer is required": the pinned Agent SDK 0.2.119 bundles that Claude Code.
  The SDK bump is the one follow-up W1 leaves; Fable is reachable through
  OpenRouter meanwhile (`anthropic/claude-fable-5.1`, verified). **Done
  2026-10-01:** Agent SDK 0.2.119 → 0.3.286 (bundled Claude Code 2.1.286;
  the 5.5 models need ≥ 2.1.280) and Fable 5.1, Opus 5.5, Sonnet 5.5 seeded
  at the top of the Claude catalogs. Lesson: the app runs the SDK's OWN
  `claude.exe`, so a global `claude update` never clears that error.
- **One catalog mechanism, not a new one.** `category: 'llm'` joins image and
  video in `PROVIDER_MODEL_DEFAULTS`; the Model Catalogs card, the `{id,name}`
  sanitiser and the settings override key all applied unchanged. Custom ids
  are free text everywhere; a typed `claude-haiku-4-5` round-tripped through
  settings and was served by the provider under that id.
- **Two Studio slots.** The planning model runs the chat turn (the editorial
  pass is that turn — `propose_cuts` is a tool it calls, there is no second
  LLM call); the shot model runs `generate_tsx_shot`, Media Pool shots and the
  import conform pass, injected once at the `buildShotEngineDeps` seam. Driven
  live: one turn planned on Opus 5 and generated a shot on Sonnet 5, and the
  usage log shows both on the same project.
- **Agents remember.** A turn that names a provider/model patches the session
  before running, so the chip restores it on reopen; mid-session switch from
  Sonnet 5 to Haiku 4.5 put the new model on the next usage row.
- **The Claude 5 surface reached the engine** (`claude-capabilities.ts`:
  adaptive thinking, effort to max incl. xhigh, explicit display for Fable /
  Opus 5 / Sonnet 5 / Opus 4.8), and OpenRouter's dotted ids now hit the same
  rows as the hyphenated ones.
- **Second dev instance, exercised for the first time** (own profile, CDP
  9223) — the three launch lessons are in the outcome: `--entry` beside
  `--outDir`, `app.setAppPath` for the built-in agents, no key seeding needed.

Files: `src/shared/presets/llm-models.ts` (+test), `llm-model-options.ts`
(+test), `ModelSelect.tsx`, `ModelPickerChip.tsx`, `useModelPicker.ts`,
`AgentSettingsSection.tsx`, `claude-capabilities.test.ts`,
`prompt-builder.test.ts`; the wiring across Studio, Agents, Creator and the
TSX pipeline (`model` on every `buildLlmRequest`).

Next: W3 (Studio agent end-to-end) per the plan's §3 order.

---

## 2026-09-08 — AGENTS Stage 6 DONE: hardening, the author docs, and usage per agent

Stage 6 of `docs/agents-plan.md` (§9) — the last code stage. Everything §9 asks
for is done or explicitly recorded as not done, and what remains before agents
can ship is three RELEASE decisions that are Hasan's, not code. Full log with the
contract deltas and the orphan the real app found: the plan's §9 "Stage 6
outcome"; the six new acceptance rows are §10 rows 20–25. `check:types` at
baseline (web 26, node 10); 1753 tests passing, up from 1732.

Scope was agreed first. §9 estimates ~1 session and Stage 5 handed over four
more things, so four questions were put to Hasan: usage accounting **done
properly** rather than cut; the render queue's mid-flight id rewrite **not**
fixed at source; Tools › AI Chat **left in place** (closing open question 2 with
a decision rather than a deletion); and the content-safety row driven for real.

- **The stage went blank the moment a render started.** Stage 5 fixed the
  reporting direction of the queue's id rewrite and left the reading direction
  alone, so `liveJob` still looked a row up by the artifact's own job id — which
  stops naming a row as soon as the render begins. No progress bar, and no
  Cancel button, for exactly the span in which cancelling is what you want.
  `matchRenderRow` is the same rule inverted, beside `matchRenderJob` in the same
  pure tested module.
- **An orphan, found only by driving.** Cancelling a render left the NEXT one
  stuck at "Running" for ever: an agent asked to render one composition twice
  gets two `job` artifacts sharing ONE output path, and with the first still
  counted as pending, every update meant for the second matched the first.
  `pendingRenderJobs` now excludes settled jobs — the rule the session-open
  reconciler already applied.
- **A user's cancel is not overwritten by its own error.** Cancelling reports
  twice, and the cancellation's own "renderMedia() got cancelled" used to win, so
  a render the user deliberately stopped read as Failed. The first terminal
  report now stands; only `failed` is refused, so a queue Retry still works.
- **A transcript that parsed into the wrong shape was silently destroyed.** Bad
  JSON already rotated aside; good JSON of the wrong shape was read as an empty
  list, which the next append wrote back over the history. `readJsonFile` now
  takes a shape check, so `chat.json` and `session.json` join `artifacts.json`
  under the store rule.
- **Usage accounting by agent, done rather than cut — a schema change.**
  `featureSource: 'agent'` cannot say WHICH agent, so `AiUsageEntry` gained
  `agentId`, the SQLite table gained `agent_id` with an additive migration for
  databases that predate it, and the AI page grew a by-agent table that filters
  the log below it. Two producer bugs surfaced on the way: agent images logged as
  `studio-shot-asset`, and attributing only the chat turns would have credited
  each agent with a fraction of its real spend — most of a run is the composition
  pipeline. Both paths are stamped. `ai-usage-db.test.ts` is the first test this
  repo has had against the real usage store, on node's own SQLite, because
  `better-sqlite3` is built for Electron's ABI.
- **§9's content-safety line was wrong.** `generate_composition` does NOT pass
  through `checkGenerationPrompt` and must not: `CONTENT_SAFETY_DESIGN.md` D0.2
  gives LLM surfaces zero hooks so that text false positives are structurally
  impossible. The gate lives on the image and video engines, and it was verified
  from a real agent tool call — the refusal reached the model verbatim and the
  run carried on.
- **Author docs that actually ship a package.** `docs/AGENT_PACKAGE_SPEC.md` is
  the contract; `docs/examples/agent-starter/` is a working agent that was
  packed, installed and RUN in the app, not merely validated.
- **The CDP smoke recipe** is in `docs/ui-automation-cdp.md`, with two escaping
  traps that cost real time: a regex literal inside a `q()` template literal
  silently loses its backslashes, and escaped-bracket Tailwind selectors throw.

**Before agents can go out — Hasan's calls, and the first two are coupled:**
flip `feature-flags.ts` `agents: true`; bump `package.json` **together with**
both built-ins' `minAppVersion` (raise one alone and either the flag does
nothing or both built-ins silently vanish from the gallery), re-stamping their
`files[]` hashes and re-running `agent-pack.mjs --check`; then rebuild the
installer, which is the only way to prove Windows registers `.vidtsxagent` and
hands the path over on a real double-click.

## 2026-09-08 — AGENTS Stage 5 DONE: the built-in agents, the starter, the file association

Stage 5 of `docs/agents-plan.md` (§8). The app now SHIPS agents: two built-ins
in the installer, a guided start that asks the package's own questions before a
session exists, and a double-clicked `.vidtsxagent` that lands on the Agents
page. Motion Post takes a one-line brief to a rendered MP4 in one session. Full
log with the contract deltas and the two bugs the real app found: the plan's §8
"Stage 5 outcome". `check:types` at baseline (web 26, node 10); the suite green.

Scope was agreed first. §8 estimates ~1 session but Stages 2, 3 and 4 had each
deferred something into it, so the cut was all three: the agents, the starter UI
(`StarterFlow.tsx` + `QuickStarts.tsx`, which Stage 4 left precisely so they
could be driven against Motion Post's real tree), and the file association.
Hasan answered three decisions: §8's "two built-in agents" stands and the second
one is `vidtsx/assistant` (resolving open question 2); Motion Post ships
UNSIGNED, because a built-in is inside the signed installer and
`origin: 'builtin'` outranks the trust tag; and `package-open.ts` moves out of
`services/studio/` rather than being widened where it sat.

- **`resources/agents/vidtsx/motion-post/`** — `agent.json` (seven tools, the
  §1.1 starter tree, `memory: { propose: true }`, no `updateUrl` because a
  built-in updates with the app), `AGENT.md` (a seven-step workflow whose
  load-bearing lines are the two that say END YOUR TURN, since the non-blocking
  `ask_user` depends on the model actually stopping), a `social-motion` skill
  that is craft rather than TSX rules (timing, text hierarchy, safe zones,
  easing vocabulary), and an icon. **`resources/agents/vidtsx/assistant/`** is
  the no-tools chat companion. `minAppVersion` is 1.0.0 on both, not the 1.1.0
  §1.1 shows: the manifest is checked against the RUNNING app version, so 1.1.0
  would make the built-in unloadable in the build that ships it. Stage 6 raises
  both at the release bump.
- **The starter runs BEFORE the session is created**, which is the decision the
  session had to make. `AGENT_SESSION_CREATE` already takes `starter`, so no
  patch channel is needed; backing out of the questions leaves no empty session
  folder; and the answers NAME the session, which matters because §1.11 fixes
  the library folder from the title at creation and never moves it.
- **It renders through the same interaction cards** `ask_user` uses (§1.9's "no
  seam"): a select node is a `pick`, a text node a one-field `form`, and
  "Something else…" routes to a second card that collects the typed words.
  `initialValues` on the cards is what lets Back restore an answer.
- **The `.vidtsxagent` association**, owed since Stage 2. The pending slot in
  `package-open.ts` now carries a KIND and moved to
  `services/packages/pending-open.ts`; a claim names the kind it can handle, so
  Studio's project browser can never swallow an agent package. Proven end to end
  in dev by launching a second Electron instance with the file on argv. The part
  that needs a packaged installer — Windows actually registering the extension —
  is Stage 6's.

**Two bugs the real app found that no unit test could have.** A finished render
was never filed: `RenderQueueContext.startNextJob` replaces a row's id with the
one main mints for the render, so the id an agent render is queued under
survives only until it STARTS, and the completion is then reported for an id no
artifact carries. Every early run produced its video and none of them knew it.
The fix is a pure, tested matcher (`services/render-job-match.ts`) that falls
back to the output path. And the chat composer could be locked behind a Stop
button for a run it had nothing to do with, because `busy` was not reset when
the open session changed.

## 2026-09-08 — AGENTS Stage 4 DONE: interactions, the mid-run round trip, memory per agent

Stage 4 of `docs/agents-plan.md` (§7). The `ask_user` round trip that has worked
since Stage 1 now has real cards behind it, and agents remember things — with
the user choosing how far each memory reaches. Full log with the six contract
deltas and the four decisions §7 left open: the plan's §7 "Stage 4 outcome".
43 new tests in 5 files; `check:types` at baseline (web 26, node 10); the suite
green at 1698.

Scope was agreed first. §7 estimates ~1 session and Stage 3 handed this stage
the starter tree too, so the cut was: all of §7 — interactions and memory —
plus the pure starter walker (`nextNode`, `renderOpening`, tested), deferring
only `StarterFlow.tsx` and `QuickStarts.tsx` to Stage 5. Motion Post is the
first agent that actually carries a `starter` tree, so its UI gets driven
against the real one instead of a fixture invented for the purpose.

**Interactions.** `form`, `pick` and `approve` cards in a registry under
`src/renderer/components/interactions/`, shared with Flows the way the artifact
viewers are (§1.3 says there; §7's file list says the feature folder — the
plan contradicts itself and §1.3 has the reason). `PendingQuestionCard`, the
Stage 3 placeholder, is deleted. The answer shaping lives apart from the
components in `values.ts`, because it decides what the model reads and the
renderer has no component test rig: `pick` keys by candidate id and values with
the label the user saw, which is exactly what makes §7's criterion true.

**Memory (§1.10).** `StudioMemory` gained `agentId` — the one additive touch to
`src/main/services/studio/` rule 4 permits, asked and approved before writing,
44 lines across two files. Undefined still means app-wide, so every Studio read
returns exactly the set it returned before. `propose_memory` is a registry tool,
opt-in through the manifest at RUN time, and the proposal card carries the scope
line the agent does not get to set. `MemoryDialog` moved to
`src/renderer/components/memory/` (asked and approved) so both features open the
same dialog; `AgentPanel.tsx` changed one import line.

**Both criteria proven in the real app, over CDP.** A packed throwaway agent on
`claude-subscription` wrote two documents, asked for a pick between them, and —
after the second candidate was clicked and sent — named that title in its next
message and built on it. A proposed rule accepted "this agent only" is visible
on the agents dialog's own tab and **absent from Studio's**, while one accepted
"all agents" shows in both; a later agent turn cited the scoped rule by name
without being asked to. `form` and `approve` were driven too, though §7 does not
require them.

Two things the app caught that the tests could not. A pending question that
outlives a reload is **not** "expired" as §7 says — that line predates the
non-blocking form winning, and under it the reply is an ordinary message, so the
question is fully answerable; the card now says it was asked in an earlier run
instead. And a pick candidate and a filmstrip thumbnail carry the same document
title, so the usual shortest-text selector clicks the thumbnail: the cards now
publish `data-interaction-card` and `data-interaction-option` (plus
`aria-pressed`), matching the `data-memory-row` convention already in the
dialog.

Next: Stage 5 — the built-in "Motion Post" agent, which also carries
`StarterFlow` / `QuickStarts` and the `.vidtsxagent` file association. Still
owed and Hasan's to run: `node scripts/agent-pack.mjs --genkey`, without which
`publishers.ts` stays empty and every signed package reads "Signed, unverified
publisher".

---

## 2026-09-08 — AGENTS Stage 3 DONE: the Agents page, the workspace, wave-1 viewers

Stage 3 of `docs/agents-plan.md` (§6). Everything Stages 0–2 built is now
reachable: an agent can be imported, opened, talked to, and its results viewed
and handed off. Full log with the six contract deltas: the plan's §6 "Stage 3
outcome". 38 new tests in 4 files (171 across 18 in the two agents folders);
`check:types` at baseline; the suite green at 1655.

Scope was agreed first — §6 estimates ~3 sessions, so the cut was "all of §6
except the starter tree", which Stage 4 already owns the walker for.

- **17 IPC channels answer, and the seams Stages 1–2 left were the bodies.**
  `agent-handlers.ts` and `agent-run-handlers.ts` are thin: `scanAgents`,
  `installAgentPackage`, `removeAgent` and `checkAgentUpdate` are the four
  gallery handlers, and `buildAgentPackageDeps()` — written by Stage 2 and
  imported by nothing — is what they hand them. `agent-service.ts` is the one
  object the IPC layer talks to; it owns the runner, the artifact stores and
  the two job reconcilers.
- **The session store is new and is the piece Stage 1 named but did not build.**
  `agent-sessions.ts` writes `session.json` and `chat.json` under
  `agent-sessions/<namespace>.<name>/<sessionId>/`, folder-as-truth like the
  agent store, corrupt records rotated aside rather than deleted. `libraryFolder`
  is fixed at CREATE and stored, because §1.11 says renaming a session must not
  move media its artifacts already point at — a folder recomputed from the
  current title would quietly do exactly that.
- **The render round trip runs end to end in the real app.** Render on the
  action bar mints a `job` artifact, `buildQueueRequest` completes it with the
  TSX path and an output path inside the session's library folder, the app's ONE
  render queue renders it under the agent's own job id, the renderer reports
  back over the new `AGENT_JOB_UPDATE`, and main files the mp4 into the asset
  library (`origin: generated`) and appends the `video` artifact whose id lands
  in `resultArtifactId`. Verified with a real render, not a fake one.
- **Viewers live under `renderer/components/artifact-viewers/` so Flows can
  share them**, keyed by kind in a registry that only grows. §1.3 named Image
  Studio's `ImageCard`/`ImageLightbox` and the queue's `RenderItem` as things to
  reuse; both sit inside other features, and a viewer Flows also consumes must
  not reach into one — so the grid, the lightbox and the job row are written
  fresh. Small components; the isolation rule is worth more.
- **The step 0 experiment Stage 1 left owed was run: 0 of 10.** Ten real turns
  on `claude-subscription` against a throwaway agent with a deliberately neutral
  prompt. Every trial produced `write_document → ask_user` and stopped; none
  called a tool after asking, and all ten persisted the question to
  `session.json`. The plan's rule adds a runner-enforced stop only above 1 of
  10, so nothing was added — the tool's description and result text carry it.
- **Driving the app found a bug the tests could not.** Opening an agent created
  a spurious empty session every time, because the workspace read "the session
  list has not answered yet" as "there are no sessions". `useAgentSessions` now
  exposes `loaded` and the workspace waits for it.
- **Still owed before Stage 4 ships anything user-visible:** interactions are a
  placeholder card (`ask_user` works, so a session can hold a question — the
  card shows it and lets the user dismiss it); the `.vidtsxagent` file
  association is deliberately still unclaimed (rule 4 covers `package-open.ts`,
  and Import plus drag-and-drop cover the need); and `publishers.ts` is still
  empty, so every signed package reads "Signed, unverified publisher" until
  `agent-pack.mjs --genkey` is run. The screen ships behind
  `feature-flags.ts` `agents: false` — visible in dev, hidden in production.

## 2026-09-08 — AGENTS Stage 2 DONE: package reader, validator, install and signing

Stage 2 of `docs/agents-plan.md` (§5). A `.vidtsxagent` file can now be read,
validated, signed, verified, installed, shadowed, downgraded and removed — all
proven from vitest against temp roots, none of it reachable from the UI yet
(that is Stage 3). Full log with the contract deltas: the plan's §5 "Stage 2
outcome". 53 new tests in 4 files; `check:types` at baseline; the suite green.

- **One zip layer, two formats.** `services/packages/zip-reader.ts` now holds
  the container guarantees — entry caps, duplicate-name refusal,
  manifest-as-allowlist, declared == actual before a byte is written, both
  zip-slip gates, sha256 hashed as each file lands — and
  `studio/project-package-unzip.ts` is reduced to the `.vidtsx` spec
  (manifest name, parser, limits, the "not a readable .vidtsx package"
  sentence). The 255 existing package tests pass UNCHANGED, which is what made
  the refactor safe to make. Asked and decided with Hasan first, because §5
  wanted it and the plan's own rule 4 forbade touching `services/studio/`;
  decision 6 is about the Studio AGENT, and duplicating a security gate is
  worse than editing the file.
- **The signature covers what the publisher WROTE.** Two bugs found while
  writing the tests, both fixed by carrying the manifest through untouched.
  Verifying against the zod-parsed manifest would have failed on every package
  whose author omitted `description` (zod fills `''`) or carried a key zod
  strips — so verification runs on `rawManifest`. And the installed folder is
  folder-as-truth, but `agent.json` describes the other entries rather than
  appearing among them, so `extractAll` never writes it: the installer copies
  `manifestBytes` byte for byte, because a re-serialisation stops verifying.
  There is a test that edits an installed `agent.json` in place and asserts the
  agent drops off the list.
- **A publisher is matched by KEY BYTES, never by the keyId it claims.**
  Otherwise anyone naming their key `vidtsx-1` would get the accent tag; there
  is a test for exactly that impersonation. Outcomes as §1.6 specifies: known
  key = verified, valid-but-unknown = signed-unknown (installs), unsigned =
  installs with a warning, invalid = REFUSED before anything touches disk.
- **`publishers.ts` ships empty on purpose, and that is the one thing owed.**
  No VidTSX signing key exists yet, so no signature can honestly be attributed
  to us. `node scripts/agent-pack.mjs --genkey` prints the private key to store
  outside the repo (`VIDTSX_AGENT_SIGNING_KEY`) and the exact `publishers.ts`
  entry to paste — Hasan's to run, since the private half must never reach a
  session.
- **Installs are rename-swaps.** Extract to a sibling staging folder, rotate
  the live folder to `.bak`, rename staging in; a failed swap puts the backup
  back. So a crash leaves either the old agent or the new one, never half of
  each, and a refused package leaves the installed one exactly as it was.
  Newer replaces, equal reinstalls, older returns `needsConfirm: 'downgrade'`
  and writes nothing until confirmed. Highest version wins across the two
  roots, equal prefers the built-in — so removing a user copy brings the
  built-in back with no special casing.
- **`agent-pack --check` IS the install validator.** The script bundles
  `parseAgentManifest` and `signAgentManifest` straight out of `src/` with
  esbuild, so packer and app cannot drift on the rules or on what "canonical
  JSON" means. The round-trip test drives the real script in a child process:
  `--check` clean, `--check` reporting three problems at once and exiting 1,
  then pack → sign → install → scan.
- **Deliberately NOT done, and Stage 3 owns it:** the `.vidtsxagent` file
  association. §5 asked for it, but `package-open.ts` holds one global pending
  slot that `studio-package-handlers.ts` claims — a second extension needs that
  slot to carry a kind and its consumer to change with it — and none of it can
  be tested until an Agents screen exists. The Import button and drag-and-drop
  cover installing; double-click is convenience. `extraResources`
  (`resources/agents → agents`) IS wired.
- Also: entry-path safety, duplicate entries, the size caps and a reserved-name
  rule (a manifest may never list `signature.json` or `licensee.json`) moved
  into `parseAgentManifest`, where `--check` can apply them offline;
  `ARTIFACT_KINDS` / `INTERACTION_KINDS` became values; `shared/agents/tool-ids.ts`
  is the bundleable copy of the registry's ids, with `registry.test.ts`
  asserting the two are equal; four `paths.ts` helpers
  (`getAgentsDir` / `getBuiltinAgentsDir` / `getAgentSessionsDir` /
  `getAgentOutputFolder`), which Stage 1 had listed as owed.

## 2026-09-07 — AGENTS Stage 1 DONE: tool registry, runner, artifact store, wave-1 tools

Stage 1 of `docs/agents-plan.md` (§4). A runner that takes a manifest, builds
its tool server, runs a turn and produces artifacts — proven from vitest, not
from the app. No IPC handlers and no screens yet, so nothing is reachable from
the UI. Nothing under `src/main/services/studio/` was touched. Full log with
the contract deltas: the plan's §4 "Stage 1 outcome".

- **The write/read split is real** (§1.3): a tool RETURNS an artifact draft,
  `tool-server.ts` hands it to the runner's `fileArtifact`, and
  `artifact-store.ts` is the one write path — it assigns `<kind>-<n>` ids over
  one per-session sequence, `createdAt`, the producer, and the version. Tools
  read prior artifacts through `ctx.readArtifacts()`, which returns copies. A
  handler that throws cannot leave a half-written store, and a draft whose
  `relPath` is absolute or climbs out is refused before anything is written.
- **`generate_video` was converted to the job shape, and that was not a
  handler change.** `generate-video-asset.ts` split into `submitVideoAsset`
  and `fileVideoAsset`, because the library copy, the brand read and the
  upsert all happened after the wait. The awaiting form is gone — it had
  exactly one caller. **The idempotency key is the job id**: filing builds
  `<folder>/<slug>-<12 hex of jobId><ext>` instead of calling
  `reserveLibraryFile`, which would have handed out a `-2` name and duplicated
  the clip on the second call. `video-jobs.ts` reconciles off the TERMINAL
  `VideoJobRecord`, never off the subscription event: one job, a whole session
  on open, and a live watch that is only an optimisation over those. Filing
  that throws does NOT mark the job failed — the clip is gated and on disk, and
  the next session open retries. A job the in-memory tracker has lost is
  reported failed rather than left pending forever. `ctx.signal` still reaches
  the engine, so cancelling a run stops paying for a video.
- **`ask_user` ships NON-BLOCKING, and the step 0 experiment is still owed.**
  Every row that decides between the forms is a long blocking wait, so the
  decision rule was applied to what is already known: the blocking form is
  chosen only if it passes the 15- and 65-minute rows, neither has been
  observed, so the non-blocking form ships. It survives an hour away and an app
  restart. The one row that can still change code — "does the model end its
  turn after asking", 10 runs — belongs to Stage 3, when there is a real chat
  to run it in; the enforcement the plan describes is deliberately NOT
  implemented without the measurement.
- **The file-tool guard is the one piece of security code, and it is wired.**
  `file-tool-guard.ts` resolves every path argument (`..` normalised, symlinks
  followed through the existing prefix, so a Write to a not-yet-existing file
  is still checked) and denies anything outside the session workspace. Network
  tools pass; every other tool name is denied, Bash included. Reaching the SDK
  needed two additive engine fields — `cwd` and `canUseTool` on `LLMRequest`,
  through `claude-provider`'s session query and `runLlmGenerate`'s extras —
  typed structurally so `src/engine/` still does not import the SDK. The runner
  passes them ONLY when `workspace.sdkFileTools` is true.
- **Four contract additions to §1.3**, each forced by a real consumer:
  `ctx.callId` (a context per CALL, since a tool cannot know the call id an
  event needs), `result.supersedes` (what "the runner assigns the version"
  takes as input), `result.jobRequest` (a render tool cannot emit an event
  carrying an artifact id that does not exist until the runner files the
  draft), and `ctx.ask` returning `InteractionAskResult` rather than a reply —
  under the non-blocking form the ordinary outcome is "posted", which is not a
  reply at all. The `answered` case is there so switching forms later touches
  `interaction-broker.ts` and nothing else.
- **The system prompt is static for the session**, as §1.2 requires: AGENT.md,
  skills, starter answers, tool availability, memory LAST. There is no way to
  pass an artifact list into it — the model learns ids from tool results and
  `list_artifacts`.
- **Wave-1 tools**: `write_document`, `generate_composition`,
  `edit_composition` (new version, prior file untouched), `render_composition`
  (mints a job and returns), `generate_image`, `generate_video`, `ask_user`,
  `list_artifacts`. The model never names a file: titles are slugged and
  counted. `tsx-deps.ts` composes the acceptance gate from the same three
  shared pieces Studio's `validateShotCode` composes rather than importing
  Studio's copy.
- One shared-code touch: the SKILL.md frontmatter parser moved to
  `src/shared/skills/parse-skill.ts`; `skills-registry.ts` imports it.
- Tests: 80 across 10 files — guard matrix (`..`, absolute, symlink, Glob/Grep
  roots, non-string args, every other tool name), artifact store (ids,
  versions, containment, corrupt-file rotation, copies), broker (post, reject a
  second, the fixed answer format, cancel, adopt across a restart), prompt
  order, registry selection and capability gating, the video reconciler
  (idempotent, re-driven, retried), the runner against a stub LLM, and one
  turn's worth of real tool calls end to end. Gates: `check:types` at baseline
  (web 26, node 10), `npx vitest run` green (1564 passed).
- **Before Stage 2**: no IPC handlers, no preload, no screens; no
  `getAgentsDir` / `getBuiltinAgentsDir` / `getAgentSessionsDir` /
  `getAgentOutputFolder`; no session store — the runner takes a session object
  and a persist hook. Manifest subagents parse and validate but are not passed
  to the SDK; nothing in wave 1 declares any.

## 2026-09-07 — AGENTS Stage 0 DONE: contracts and shared types

Stage 0 of `docs/agents-plan.md` (§3). Types only — nothing runs yet, nothing
under `src/main/services/studio/` was touched, and no screen changed. Every
later stage now codes against fixed shapes.

- **`src/shared/types/agents.ts`** — the manifest interface, `InstalledAgent`
  (manifest + `builtin | user` origin + signature status + a manual update
  record), the five wave-1 artifact kinds with per-kind payloads, and
  `AgentArtifactDraft` as `AgentArtifact` minus `id`/`createdAt`/`producer`/
  `version`, derived from the same payload map so a draft can never drift from
  the stored form. Interaction request/reply, `AgentRunEvent`, `AgentSession`,
  `AgentSessionSummary`.
- **The write/read split is in the types** (plan §1.3, decided 2026-09-07): a
  tool returns a *draft* and only the runner mints ids. The `job` payload
  documents its own before/after rule — minted at submit with `jobId`, `job`,
  `status`, and nothing else; the output arrives later as a separate artifact
  whose id is written back into `resultArtifactId`.
- **`src/shared/agents/ids.ts`** — `parseAgentId` / `assertAgentId`, plus
  `agentDirSegments` (install root, two segments) and `agentDirName` (the flat
  `<ns>.<name>` session folder). The id is the only user string that becomes a
  path, so paths are built from PARSED segments and nothing downstream splits
  the raw string.
- **`src/shared/agents/starter.ts`** — starter tree types and `validateStarter`:
  node-id grammar, size caps, every `next` resolves, no cycles, `$end`
  reachable, unreachable nodes flagged, and every `{{ref}}` in `opening` names
  a node. The walker and the template renderer are Stage 4's.
- **`src/shared/agents/manifest.ts`** — `parseAgentManifest` (zod), the package
  constants and `AGENT_LIMITS`. It is PURE: what needs the running app (which
  tool ids exist, which artifact/interaction kinds are registered, what version
  this build is) arrives through an optional `ManifestContext`, so one function
  serves the install validator, `agent-pack.mjs --check`, and the tests. It
  collects every problem and throws them together, because an author fixing a
  package should see the whole list. `compareAgentVersions` lives here rather
  than importing main's `compareVersions` — shared may not import main.
- **IPC** — `src/shared/ipc/types/agents.ts` and fourteen channels
  (`AGENTS_LIST/INSPECT/INSTALL/REMOVE/CHECK_UPDATE`, four session channels,
  `AGENT_RUN_SEND/CANCEL/EVENT`, `AGENT_INTERACTION_REPLY`,
  `AGENT_ARTIFACT_ACTION`). No handlers yet — Stage 3 registers them.
- Tests: `manifest.test.ts` (id grammar, semver, unknown tool ids, `Bash`
  refused always and file tools only behind `workspace.sdkFileTools`,
  `minAppVersion` too high, prompt/icon not listed in `files[]`, non-https
  `updateUrl`, all-problems-at-once) and `starter.test.ts` (the §1.1 example,
  bad entry, dangling `next`, cycle, unreachable `$end`, orphan node, bad node
  ids, `select:"many"` without a node-level next, unknown `{{ref}}`). 23 tests.
- Gates: `check:types` at baseline (web 26, node 10), `npx vitest run` green.

## 2026-09-07 — VIDEO PROVIDERS Stage 5 DONE: the plan is CLOSED, and Videos ships in V1

Stage 5 of `docs/video-providers-plan.md`, the last one. No new provider work:
the Flows node learns what the panel already knows, the Videos screen comes out
from behind its flag, and the agent tool is written against the shipped engine.
Full log: the plan's section 6.

- **The Flows "Generate Video" node offers only what its model accepts.** It had
  static aspect / duration / resolution lists — the union of every model — and
  let the engine clamp at submit, so a saved flow could carry a duration its
  model never takes and a seed the model ignores. Those selects are now one
  `video-model-options` inspector field reading the model's `VideoModelInfo`,
  and it **re-clamps the saved config** when the model changes. Live on BytePlus
  Seedance 2.5: a 4–30 s *slider*, aspect chips including BytePlus's own
  `adaptive`, resolutions `720p/480p/1080p` with no "Model default" and no 4K,
  an audio toggle, **no Seed field at all** — and a node deliberately created
  with `resolution: ''` and `seed: '12345'` came back saved as `'720p'` and
  `''`.
- **`supports.seed` now reaches the pickers.** It lived on the catalog entry and
  stopped there, so nothing downstream could know that neither Seedance 2.x
  family takes a seed.
- **`video-studio` is on for V1 (D1).** It is a plain flag set `true` now;
  `VITE_FF_VIDEO_STUDIO` is retired from `.env.example` and `env.d.ts`. Proved by
  launching the dev app *without* the variable and finding Videos in the nav —
  the same launch hid it yesterday. **Flows stays env-gated.**
- **`generate_video` is written and not registered** — a thin wrapper on
  `generateVideoAsset` with `needs: 'video-provider'` and a `video` artifact
  pointing at the local clip, never a provider URL. `docs/agents-plan.md` §1.3
  owns the registry; agents Stage 1 plugs it in.
- **The provider matrix is complete.** Stage 4 had covered fal t2v, BytePlus t2v
  and fal reference; this stage ran the last three from the panel at 4 s / 480p —
  **fal i2v** (187.7 s, $0.88), **BytePlus i2v** (229.1 s, $0.40) and **BytePlus
  reference-to-video** (320.4 s, $0.40) — plus the Flows node itself (167.1 s,
  $0.40, feature source `flows`). The log shows the chokepoint in order for the
  reference job: the input clip frame-sampled → **then** uploaded to fal storage
  (ModelArk takes a reference video only as a URL) → **then** submitted → output
  sampled → filed.
- **Found on the way**: ModelArk refuses a first frame under 300 px tall, and
  said so in its own words in the panel with no job created — a Video Studio
  *thumbnail* is too small to use as a first frame. And a careless driver loop
  cancelled two live jobs by clicking a job card's Cancel; the app handled it
  correctly (BytePlus refused to cancel a running task, as documented). Three
  clicking lessons went into `docs/ui-automation-cdp.md`.
- **Docs**: `docs/CONTENT_SAFETY_DESIGN.md` D2c is six callers with the video
  input gate written out in order; `V1_RELEASE_PLAN.md` gains a cloud-video
  checklist (all PASS bar one artifact check deferred to the next `build:win`)
  and two known issues for the release notes.
- **Gates**: `check:types` web 26 / node 10 (baseline); vitest **1466 green**
  (+7).
- **Next**: nothing in this plan. Goal 11 of `V1_RELEASE_PLAN.md` is met and the
  remaining V1 work is Hasan's testing pass, the licence flip and the installer
  rebuild.

## 2026-09-07 — VIDEO PROVIDERS Stage 4 DONE: the Videos generation panel

Stage 4 of `docs/video-providers-plan.md`. The Videos screen is a generation
tool now, not just a gallery: Image Studio's split, with the control panel on
the left, the gallery on the right, and job cards in the grid while clips
generate. Full log: the plan's section 6.

- **The panel offers only what the chosen model publishes.** Duration renders
  as chips for a discrete list and as a labelled slider for a range; aspect and
  resolution list the model's own values; the audio toggle appears only where
  the model makes audio; and the mode tabs (Generate / Frames / Reference) are
  the routes that model actually has — the frame and reference routes are
  mutually exclusive on both providers, so one combined form would have
  promised a request neither API accepts. Live: Seedance 2.5 shows a 4–30 s
  slider and all three modes, Veo 3.1 Fast shows 4/6/8 s and **no Reference
  tab**, and BytePlus shows its own `adaptive` aspect where fal says `auto`.
- **`ReferenceImageLibrary` moved to `src/shared/`** and learned a `'local'`
  selection mode. It used to persist every tick on the shared manifest, which
  made two pickers on one screen fight over one flag — and first frame + last
  frame is exactly that. Image Studio's behaviour is unchanged.
- **Reference video and audio travel as local paths**, so the bytes never enter
  the renderer; each picker prints its per-model limit and disappears when that
  limit is 0 (which is how a BytePlus-only install correctly offers no
  reference video). Job cards show status, elapsed time, Cancel, and the
  Content Safety copy verbatim when a job is refused.
- **Cost estimates are per resolution now** — the Stage 3 open item. The engine
  bills at the requested resolution's published rate and falls back to the
  headline (720p) rate otherwise, with the panel marking the fallback "at list
  rate". Measured on the same clips Stage 3 logged: **fal $1.88 → $0.88** and
  **BytePlus $0.92 → $0.40**. The other Stage 3 item needed nothing: the usage
  table already has an "Out Tokens" column and the BytePlus rows carry 38,830.
- **Live acceptance, all from the panel**: a clip generated on fal (197 s) and
  one on BytePlus (265 s) running side by side as two cards; a reference job
  with a real image and a real clip, whose main log shows Gate B sampling the
  input clip **before** the upload and the submit; a cancel that landed in 2 s;
  and a blocked prompt that showed the Content Safety copy and created no job
  at all.
- **Gates**: `check:types` web 26 / node **10** — the node baseline dropped from
  22 because moving a renderer component into `src/shared/` revealed that the
  node config never saw the `window.api` declaration. vitest **1459 green**.
- **Next**: Stage 5 — the Flows node on the same capabilities, the
  `video-studio` flag flipped on for V1, the `generate_video` agent tool, and
  the V1 checklist rows.

## 2026-09-07 — VIDEO PROVIDERS Stage 3 DONE: BytePlus ModelArk, editable video catalogs, reference-to-video

Stage 3 of `docs/video-providers-plan.md`. Video generation now has a second
provider and user-editable model catalogs, and Seedance omni references (image +
video + audio) work end to end. Full log with what was verified how: the plan's
§6 Stage 3 log.

- **Schema pinned first** (the plan's §5 open items, now closed): the ModelArk
  docs render client-side, so the reference was decoded out of the page's own
  embedded document JSON. Base URL, bearer auth, create/get/delete task, the
  `content` array with roles, the six statuses, `usage.completion_tokens`, and
  the four model ids (`dreamina-seedance-2-5-260628`, `-2-0-260128`,
  `-2-0-fast-260128`, `-2-0-mini-260615`). **Images and audio may be base64 data
  URIs; video may not** — reference clips need a URL, so they go through fal
  storage, and without a fal key the BytePlus models report zero reference
  videos. Seedance 2.x takes no `seed`. On fal: the 2.5 / 2.0 / 2.0-fast slugs
  and **Veo 3.1 Fast**, which takes the D3 slot the deprecated `fal-ai/veo3/fast`
  held (the old entry stays in code so saved flows still resolve).
- **New**: `shared/providers/byteplus/` (ModelArk client), `fal/fal-storage.ts`
  (initiate + PUT, 90 MB cap), `byteplus-video-provider.ts`, and the
  `fal-seedance-2` + `byteplus-seedance` dialects. Catalogs gained a **video**
  category: stored rows keep id + name + dialect and everything else is
  re-derived on load from a per-dialect capability template plus route
  derivation, so a user-added slug can't carry stale capabilities and a known id
  keeps its verified ones.
- **The chokepoint moved to `input-media-gate.ts`** and runs in one order:
  resolve → Gate B on every input image and the frame sampler on every reference
  clip → **only then** upload what can't travel inline. A reference video with no
  sampler is refused (fail-closed).
- **Surfaces**: `byteplus` is one registry entry (key row, `[Video]` badge,
  credential slot) with a Test button that lists tasks and spends nothing; the
  Flows node's model select is now a provider+model picker fed by the engine, and
  the node gained reference-image/video/audio inputs and a Resolution field.
- **Gates**: `check:types` web 26 / node 22 (baseline); vitest 146 files / 1445
  tests green (+26 this stage). **Live** 11/11 keyless checks over CDP, plus the
  Providers page, both catalog cards and the Flows inspector driven for real.
- **Live fal E2E PASSED**: Seedance 2.5 reference-to-video, 4 s at 480p with one
  image, one video and one audio reference — gated, uploaded, generated in 374 s,
  downloaded, sampled again, filed as one Video Studio entry (1.70 MB, local
  `file://`, fal URL only as `sourceUrl`), usage row `fal / seedance-2.5 / flows /
  $1.88`. The first attempt was refused by Gate B on a synthetic reference image
  before any upload — the input gate working as designed.
- **Live BytePlus E2E PASSED** (key entered by Hasan the same evening): a
  Prompt → Generate Video flow pinned to BytePlus / Seedance 2.5, 4 s at 480p,
  **Run clicked in the UI** — Complete in 371 s, one Video Studio entry
  (1.02 MB, 854×480 / 4.04 s, thumbnail written), local `file://` handed back and
  the ModelArk URL kept only as `sourceUrl` (it expires in 24 h with a
  100-download cap, so downloading is the only way the clip survives). Usage row
  `byteplus / dreamina-seedance-2-5-260628 / flows / $0.92` carrying
  **`outputTokens: 38830`** — the ModelArk token count it actually bills on. The
  Test button authenticated the key in 980 ms without generating anything.
- **Open for Hasan**: cost estimates are per model, not per resolution, so both
  480p rows above over-state (fal $1.88, BytePlus $0.92). A fresh ModelArk
  account also needs balance > $30, a Savings Plan at that tier, or a resource
  pack before Seedance 2.x activates.
- **Next**: Stage 4 — the Videos generation panel.

## 2026-09-07 — EXPORT ENGINES Stage 3 slice 4: speed in the one pass and the copied picture

Stage 3 of `docs/export-engines-plan.md`, slice 4 (slice 3 = 6ee7087). The recipe slice 3
measured is now the engine: a sped clip's picture is copied on the scaled time line and its
audio is Remotion's own `atempo` chain in the one pass. Full log with the numbers: the plan's
§Stage 3 log, slice 4.

- **Widened: the picture of a sped clip.** `copyBlocker` accepts a rate ≥ 1 (the source-end
  bound scales with it); a copy span carries `rate` and its source position is
  trimBefore + rate × offset, as the composition computes it; `nearestSelectFilter` maps slot n
  to S + rate·n/fps. Without a rate the select string is byte for byte Stage 2's. Slow motion
  (rate < 1) stays a browser span: one source frame would serve several slots and `select`
  cannot repeat a frame.
- **Widened: the audio of a sped clip.** `planExportAudio` no longer returns null on
  `playbackRate`; the segment carries `rate`, and the pass writes Remotion's chain verbatim —
  `aformat s16 48k`, `calculateATempo` ported (square roots outside 0.5–2), `atrim` at
  post-tempo times in Remotion's microsecond form, the volume right after the trim — then the
  pin. A curve on a sped clip sits on the post-tempo time line (`sourceIn / rate`), read from
  `seamless-aac-trim.js` + `ffmpeg-volume-expression.js` and confirmed on a real export. Live
  pins: the pass's sped segment, with and without a fade, is **byte-identical PCM** to
  Remotion's chain run directly.
- **Measured: a sped clip that opens a file shows the CEIL frame** (K 7671 where nearest is
  7670 on the new `t5-1080p-cut-speed2` seed), the nearest after that (every fourth 59.94 fps
  frame at 2×), and a near-tie (9464.53) resolves to the nearest — the slice-1 rule with the time
  line scaled, which the planner already applied. A clip that runs to 0272's container end
  needs no held tail at 2× (the last slot sits rate/30 s before the end, past the 16.5 ms the
  DJI video streams fall short).
- **Gate — `t5-1080p-cut-speed`** (B at 1.5×, music at 1.5×): "Copies 100 %"; the frame map
  reads the SAME source frames as the plain Remotion export at 450…456/600/899 (K 899, 902 …
  917, 1349, 2245); `t1-diff` vs that export max 0.01 % over 24 at the seven frames, 0 % vs the
  control on clip A; clip A's 450 access units byte-identical to the Stage 2 cut export; audio
  **0 ms and level 1.000 vs the Remotion export at all eight windows**, clip B 0 ms / 0.999 vs the
  pre-stretched camera reference, the sped music at lag 0 / 0.986 of its gained level on both
  exports alike. (The verify-mode reference render was lost to a PC shutdown after the export
  had finished; the on-disk plain Remotion export is the same engine and stood in.)
- **Gate — `t5-1080p-cut-speed2`** (0272 at 2× to its end with gain 0.5 + 1 s fades, music at
  3×): "Copies 100 %"; the same K as the Remotion export at every mapped frame (ceil on the
  first); max 0.01 % over 24 at the seven frames; audio 0 ms on clip A and **+0.3 ms on the
  faded-in sped clip** — Remotion's whole-ms placement (the Remotion export reads −0.3 ms
  against the stretched camera reference, the pass 0 ms); level 1.000 in 1 s windows and
  0.996–1.005 in 100 ms windows inside both ramps; the flat part 0.504 = 0.505 × AAC on both;
  the 3× music at lag 0 / corr 0.987 / level 0.985 on both.
- **Earlier gates unchanged:** `t5-1080p`, `t5-1080p-cut`, `t5-1080p-cut-gain`,
  `t5-1080p-cut-music`, `t5-1080p-cut-stack`, `t5-1080p-cut-fade`, `t5-1080p-cut-xfade`
  re-exported with video AND audio streams byte-identical to their earlier files.
- Gates: check:types 26/22 (baseline), vitest 1,425 green (+6 planner/builder tests), live
  ffmpeg tests 8 (+1).
- **Stage 3 is complete for what the predicate names** (cuts, gain, audio tracks, several
  video tracks, fades, transitions, speed ≥ 1). Still browser spans: slow motion (a
  frame-duplication recipe to measure), transforms, letterboxed sources, overlays, captions.
  **Next: Stage 4** — progress that shows copied vs rendered time, cancel that cleans
  intermediates, the 10 GB finishing mux, merging nearby browser spans (a 30-frame transition
  window pays a full bundle + Chrome start), QSV/AMF unmeasured; the long-return question.

## 2026-09-07 — EXPORT ENGINES Stage 3 slice 3: speed measured, audio fades and crossfades in the one pass

Stage 3 of `docs/export-engines-plan.md`, slice 3 (slice 2 = 2c564c6). Speed measured first,
then two widenings of the passthrough engine's predicate, each gated through the real dialog;
full log with the numbers: the plan's §Stage 3 log, slice 3.

- **Measured: speed.** A Remotion export of a clip at speed 1.5 shows the source frame NEAREST
  to S + 1.5·n/fps (every third 59.94 fps frame; nearest, not ceil, when the file is already
  open) and plays its audio through `@remotion/renderer`'s pitch-preserving `atempo` chain
  (`aformat s16 48k, atempo=1.50000, atrim` at post-tempo times). Our full ffmpeg reproduces
  it — lag 0 ms, corr 1.000, level 1.000 against the export; Remotion's bundled ffmpeg 7.1
  and our 8.1.2 produce **bit-identical PCM** for the chain (a plain resample reads corr 0.3
  at random lags). Not widened in this slice; the recipe is recorded for the next one.
- **Found: how Remotion applies a volume curve** — one value per rendered frame; a frame at
  volume 0 registers no audio (a fade-in's first frame is silent, the asset starts one frame
  late); values rounded to 1/97 steps (a faded clip at gain 0.5 plays at 0.505); the filter
  `volume='if(between(t,…))':eval=frame` evaluated per decoded audio buffer in source time;
  every asset placed with a whole-millisecond `adelay`, so any clip whose first audible frame
  is off the ms grid plays up to 0.5 ms early (−0.3 ms measured on both reference exports
  against the camera file). The pass keeps the exact frame time (D6).
- **Widened: audio fades.** The audio planner reads the SAME serialization the composition
  receives (`serializeTimeline` with a stub resolver) and carries the per-frame curve of a
  faded clip; the pass emits Remotion's own expression (`remotionVolumeExpression`) right
  after the trim, on decoder buffers the chain shares with Remotion's (verified). A fade never
  touches the picture, so a faded clip is copied.
- **Widened: transitions.** Only a transition's window goes to the browser (both clips paint
  there); the pieces either side are copied from the serializer's extended geometry; a
  crossfade's two overlapping clips become two lanes summed by the same `amix`.
- **Gate — `t5-1080p-cut-fade`** (A fade-out 0.5 s; B gain 0.5, fade-in 1 s, fade-out 2 s):
  "Copies 100 %"; H.264 stream **byte-identical** to the Stage 2 cut export; verify vs the
  Remotion engine max 0.01 % over 24 at the seven frames; `t1-diff` vs the control **0 % over
  24 at every frame**; audio **0 ms vs the camera file at all eight windows**; level vs the
  plain Remotion export **1.000 at all eight 1 s windows and 0.998–1.003 in 100 ms windows
  inside the ramps** (two near-silent windows 0.98, where Remotion's 16-sample early placement
  changes the window's content); B's flat part 0.505 of the camera level on both exports, as
  the 1/97 rounding predicts; the offset vs the Remotion export reads +0.3 ms on the faded-in
  clip only — Remotion's whole-ms placement, which reads −0.3 ms against the camera.
- **Gate — `t5-1080p-cut-xfade`** (1 s crossfade at 15 s): "Copies 97 %"; verify vs the
  Remotion engine **0 % over 24 at all seven frames** (the blended window frames included);
  `t1-diff` vs the control 0 % over 24 on the copied frames; audio **0 ms vs the camera at all
  eight windows**, level 1.000 vs the plain Remotion export outside the window; inside it the
  pass reads the composition's coherent cos + sin sum (this seed crossfades one recording with
  itself, peak 1.417) within 0.02 of a camera-file model at every 20 ms step, while the Remotion
  export reads the same model with its trailing clip 16 samples early (a comb filter) — the
  whole-ms placement above. New instrument: `scripts/bench/t1-audio-gain-curve.mjs`.
- **Earlier gates unchanged:** `t5-1080p`, `t5-1080p-cut`, `t5-1080p-cut-gain`,
  `t5-1080p-cut-music`, `t5-1080p-cut-stack` re-exported with video AND audio streams
  byte-identical to their earlier files.
- Gates: check:types 26/22 (baseline), vitest 1,419 green, live ffmpeg tests 7 (+1: a faded
  segment against Remotion's chain run verbatim, lag 0, corr > 0.9999, level within 0.2 %).
- **Next: Stage 3 slice 4 — speed** by the recorded recipe; the long-return question; then
  Stage 4 (progress copied vs rendered, cancel cleanup, the 10 GB finishing mux, merge nearby
  browser spans — a 30-frame transition window pays a full bundle + Chrome start).

## 2026-09-06 — EXPORT ENGINES Stage 3 slice 2: audio tracks mixed in the one pass, several video tracks copied

Stage 3 of `docs/export-engines-plan.md`, slice 2 (slice 1 = 28a8236). Two widenings of
the passthrough engine's predicate, each gated through the real dialog; full log with
the numbers: the plan's §Stage 3 log, slice 2.

- **Widened: audio tracks.** The audio planner (now `src/shared/studio/export-audio.ts`,
  re-exported by `export-spans.ts`) plans every track with sound as its own chain of
  source cuts + silence over the whole timeline, with the clips' gains; the one ffmpeg
  pass concatenates and pins each chain, then sums them with
  `amix=inputs=N:dropout_transition=0:normalize=0` — the filter `@remotion/renderer`
  itself merges a composition's audio with, so the levels are Remotion's. One chain
  keeps the Stage 2 graph to the byte. Two audible clips overlapping on one track still
  send the audio to the browser walk.
- **Widened: several video tracks.** `planExportSpans` cuts at every clip edge on every
  video track and copies each piece from the TOPMOST clip covering it when that clip is a
  pure cut (it fills the frame and hides everything below); a transformed or letterboxed
  upper clip sends its piece to the browser, a gap on every track is black, a dropped
  upper clip lets the lower one through, and covered clips count as having opened their
  files for slice 1's ceil rule.
- **Gate — `t5-1080p-cut-music`** (the T1 cut with a pink-noise music clip on A1 from
  5 to 25 s at gain 0.5): H.264 stream **byte-identical** to the Stage 2 cut export;
  verify vs the Remotion engine max 0.01 % over 24 at the seven frames; `t1-diff` vs
  the 2026-09-04 control **0 % over 24 at every frame**; audio **0 ms and level 1.000
  at all eight windows vs a plain Remotion export** of the same project, 0 ms vs the
  camera file; the mixed music itself at **lag 0.00 ms and 0.98 of its gained level** in
  the export-minus-camera residual, the same rows the Remotion export reads.
- **Gate — `t5-1080p-cut-stack`** (the T1 cut as two tracks: V1 15–30 s, muted, over
  V2 0–30 s): the dialog states "Copies 100 %"; video AND
  audio streams **byte-identical** to the Stage 2 cut export; verify max 0.01 % over 24;
  `t1-diff` 0 % over 24 at every frame; audio 0 ms vs the camera file at all eight windows.
- **Earlier gates unchanged:** `t5-1080p`, `t5-1080p-cut` and `t5-1080p-cut-gain`
  re-exported with video AND audio streams byte-identical to their previous files.
- New instruments: `scripts/bench/t1-audio-level.mjs` (1 s RMS ratio per window) and
  `t1-audio-residual.mjs` (export − camera correlated with the music file: a quiet
  mixed track cannot be timed by correlating the music against the mix, and `-ss` on
  an AAC mp4 lands 16 samples off — decode whole files).
- Gates: check:types 26/22 (baseline), vitest 1,415 (+4) green, live ffmpeg tests 6 (+1).
- **Next: Stage 3 slice 3** — audio fades and crossfade transitions in the one pass
  (`afade` / the equal-power curves, gated per window against a plain Remotion export),
  speed changes measured first (`atempo` vs Remotion's resampling), the long-return
  question; then Stage 4 (progress copied vs rendered, cancel cleanup, the 10 GB
  finishing mux, merge nearby browser spans, QSV/AMF unmeasured).

## 2026-09-06 — EXPORT ENGINES Stage 3 slice 1: the different-file cut measured, gain-only clips copied

Stage 3 of `docs/export-engines-plan.md` widens the passthrough engine's predicate one
span type at a time, each re-gated. Slice 1 first measured what T1 had not — a cut
between two DIFFERENT source files — then let gain-only clips through. Full log with
the numbers: the plan's §Stage 3 log.

- **Measured: the export shows the CEIL source frame on the first frame after it opens
  a file** (the first clip of each source file on the timeline) and the nearest
  everywhere else — a same-file cut or a return to a file already opened. Two seeds
  through the real dialog in verify mode, each frame identified against the camera
  file's own frames: `t5-1080p-cut-files` (0270, then 0272 from 15 s) shows K 900 at
  the cut where nearest is 899, and the passthrough's nearest read 0.51 % over 24
  against it; `t5-1080p-cut-files2` (A-B-A) shows K 400 where ceil = nearest (not 401,
  so it is the ceil rule and not "the frame after the nearest") and K 1798, the
  nearest, on the return. `planExportSpans` now sets `firstFrameCeil` on a copy span
  whose source file no earlier piece has shown; the A-B-A seed then reads max 0.01 %
  over 24 at all 8 sampled frames, 0 % at both cuts. `docs/PREVIEW_TESTS_PLAN.md`
  §T1 leg 0 gained the two rows. Seeds: `scripts/bench/seed-cut-projects.mjs`.
- **Widened: gain-only clips.** `copyBlocker` no longer blocks on `gain`; the audio
  planner carries the clip's static gain on its segment and the one ffmpeg audio pass
  applies `volume=<gain>` there — the linear multiplier Remotion uses for a static
  `volume` prop. Fades, speed, transitions and audio tracks still go to the browser walk.
- **Gate** on `t5-1080p-cut-gain` (the T1 cut with gain 0.5 on clip B): verify vs the
  Remotion engine max 0.01 % over 24 at the seven frames (the Stage 2 rows); `t1-diff`
  vs the 2026-09-04 control **0 % over 24 at every frame**; audio **0 ms at all eight
  windows vs the camera file AND vs an independent Remotion export** of the same
  project; level 1.000 vs that export at every window, 0.4995–0.4997 (−6.03 dB) vs the
  camera file on the gained clip; the H.264 stream **byte-identical** to the Stage 2
  cut export; spans at 3.2× and 3.9× realtime.
- **Stage 2 gates unchanged:** `t5-1080p` and `t5-1080p-cut` re-exported with video
  AND audio streams byte-identical to the Stage 2 files, 0 % over 24 vs the control at
  the seven frames, 0 ms vs the camera file at the eight windows.
- Gates: check:types 26/22 (baseline), vitest 1,411 green (+5), live ffmpeg tests 5
  (+1: the gained segment at 0.5× the camera file's RMS, lag 0).
- **Next: Stage 3 slice 2** — audio tracks as a mixed second chain in the one pass
  (`amix=normalize=0`; seed a music clip under the T1 cut, gate level + offset against
  a plain Remotion export as above), then multiple video tracks where lower tracks are
  fully covered. Open: whether a return to a file after minutes (the compositor closing
  an idle file) shows the ceil frame — unmeasured, one source frame at one cut.

## 2026-09-06 — EXPORT ENGINES Stage 2 DONE: the passthrough engine at its narrowest predicate, gated on both reference projects

Stage 2 of `docs/export-engines-plan.md` (D1–D7; Stage 1 seam committed 57becff).
The picker's second row, "Fast", copies plain cuts of video assets with the full
ffmpeg's NVDEC → nearest-pts select → NVENC under T1's four conditions and renders
only touched spans in the browser; the gate held: **0 % of pixels over 24 vs the
2026-09-04 control at 1/300/449/450/451/600/899 on `t5-1080p` and `t5-1080p-cut`,
≤ 0.01 % vs the Stage 1 Remotion engine in verify mode, audio 0 ms at every window
vs the DJI camera file, copied spans at 3.7–4.2× realtime, a re-export byte-identical
on video and audio.** Full log with the numbers: the plan's §Stage 2 log.

- **Behind the seam**: `src/shared/studio/export-spans.ts` (pure span planner +
  audio planner, decides from the document alone; the dialog uses it for "Copies
  N % of this timeline") and `src/main/services/studio/export-engines/passthrough-
  {engine,ffmpeg,browser,probe}.ts` (availability = full ffmpeg + a working hardware
  encoder; pieces = copy / black / browser, every piece's frame count checked, TS
  join checked, one ffmpeg audio pass handed over as `audioPath`, D4 notice while a
  nothing-to-copy timeline renders). `remotion-renderer.ts` gained `frameRange`.
- **Findings**: NVENC writes primaries/transfer only from the frames (`setparams`
  in every span graph); against the Stage 1 Remotion engine the copied spans carry
  a ~200-pixel edge residue (0.01 % over 24, max 44) that no scaler moves — colour
  conversion, not frame mapping (flat across the cut); the select clamps the slot
  index so a whole-frame-early seek stays exact.
- **Verified in the real app over CDP**: `t5-1080p` 900 frames in 7.2 s (4.19×),
  `t5-1080p-cut` 450 + 450 in 4.1 + 3.9 s; file ready ~13 s after the plan. **The
  re-seeded 3 h T6 project (275 clips, 330,749 frames, 100 % copied) exported in
  1 h 32 min** — 61 min of copied spans (HEVC 4.2×, the H.264 master 2.6×), ~7 min
  join + audio, 24 min in the finishing mux of the 10.6 GB file — against T6's
  ≈ 3.5 days; its first clip diffs 0 % over 24 vs the control and the audio reads
  0 ms vs the camera file at seven positions across the whole timeline (no drift).
  Four earlier 3 h runs found and fixed, each re-gated: sub-frame clip overruns
  sent 5 % to the browser (planner bound); clip tails one frame short where the
  video stream ends before the container (held-tail piece); `ENAMETOOLONG` on the
  275-segment audio graph (script file); a camera file's audio ending 44.7 ms
  before its container shifted every later clip's audio (segments pinned to their
  planned length) — a fault no 30 s gate could see.
- Gates: check:types 26/22 (baseline), vitest 1,406 green (+31), 2 live ffmpeg tests
  behind `VIDTSX_LIVE_FFMPEG=1`. Bench: `passthrough-video-hash.mjs`;
  `export-engine-run.mjs` matches card titles exactly and takes `--proxy-wait`.
- **Next: Stage 3** — widen the predicate (gain-only clips with `volume=` in the
  audio pass, audio tracks, then multiple video tracks), each widening re-gated;
  measure a cut between two different source files first.

## 2026-09-06 — VIDEO PROVIDERS Stage 2 DONE: the video engine, extracted behind the Content Safety chokepoint

Stage 2 of `docs/video-providers-plan.md` (D1–D7 locked 2026-09-04; Stage 1 registry
shipped 2026-09-05). Behaviour-preserving: nothing user-visible changes, the Flows
"Generate Video" node is untouched. Full log with what was verified how: the plan's
§6 Stage 2 log.

- **`src/video-engine/`** mirrors `src/image-engine/`: `VideoProvider` (submit + poll
  + cancel), `VideoModelInfo` with a **dialect id + capabilities**, a dialect table
  (`dialects.ts`, the five fal families + generic — the model-id `switch` is gone), a
  job tracker (in-memory Map, one poll loop per job, subscribers, cancel), presets with
  `credentialId`, and the fal provider absorbing `video-generation.ts` +
  `video-payloads.ts` (both deleted). `video-init.ts` registers from the shared
  credentials at startup and on every key save.
- **Chokepoint, fail-closed like images**: Gate A on the prompt before the provider
  lookup; **Gate B on first / last / reference frames before any provider call**
  (audit §1.5 closed); on completion the engine downloads the clip through the one
  Video Studio save path (frame-sampling Gate B) and the job record carries the
  **local entry — callers never see the remote URL**. `generateAndWait` +
  `library/generate-video-asset.ts` give main-process callers (agents later) the same
  entry point images have.
- **IPC**: `videoGenerate` gains optional `providerId` / `folderId` / `featureSource`;
  `videoGetJob` reads the tracker; new `videoCancel` + `video:job-progress` push.
  `videoStudioSave` resolves a `file://` URL inside the clips folder to its existing
  entry, which is how the unchanged Flows node keeps its `videoRef` / folder filing
  with one download instead of two.
- **Gates**: `check:types` web 26 / node 22 (baseline); vitest 143 files / 1375 tests
  green (+22: dialect builders, tracker with a mock provider, chokepoint order).
  **Live** (dev app via CDP): 11/11 keyless checks — Gate A over IPC with the counter
  incrementing, unknown-job / cancel paths, the progress subscription, and a real
  download → classifier → frame-sampling → save → `file://` re-save round trip.
- **Live fal E2E PASSED** (real key entered mid-session, engine re-registered on
  save): the unchanged Flows node ran Prompt → Generate Video (Kling 2.5 Turbo Pro,
  5 s) via CDP — push `pending → running → completed` in 117 s, one Video Studio
  entry (9.04 MB, thumbnail), node preview playing the local `file://` clip, badge
  Complete, usage row `fal / kling-2.5-turbo-pro / flows / $0.40`.
- **Open for Hasan**: §5 re-check — Kling 2.5 Turbo Pro slug current; **Veo 3 Fast
  (`fal-ai/veo3/fast`) is deprecated on fal** — successor `fal-ai/veo3.1/fast` (same
  dialect + 1080p/4k); the swap belongs to the Stage 3 default catalog.
- **Next**: Stage 3 — BytePlus ModelArk provider, video catalog category, reference
  uploads.

## 2026-09-06 — EXPORT ENGINES Stage 1 DONE: the engine seam, gated on both reference projects

Building resumed for the export-engines plan (`docs/export-engines-plan.md`, D1–D7
locked 2026-09-04). Stage 1 = the seam every engine plugs into, the Remotion path
moved behind it, and the gate met: **the default engine exports `t5-1080p` and
`t5-1080p-cut` at 0 % of pixels over 24 vs the 2026-09-04 control at frames
1/300/449/450/451/600/899 (900 frames, `yuv420p tv bt709`), and the audio reads
0 ms at every window against the DJI camera file (was +42.7 ms on every export).**
Full log with the numbers: the plan's §Stage 1 log.

- **The seam**: `src/shared/studio/export-engines.ts` (catalogue: ids, trade-off
  wording, default) + `src/main/services/studio/export-engines/` — `ExportEngine`
  (`availability`, `produce → { videoPath, audioPath?, notes? }`), registry,
  `remotion-engine.ts`, `finishing.ts` (D7: probe → mux → probe, fails loudly on a
  tag mismatch), `run-export.ts`, `verify.ts` + `frame-diff.ts` + `audio-offset.ts`
  (D5: the T1 instruments in product form), `export-context.ts` (trimmed document
  beside the entry). Queue jobs carry `exportEngine` (new DB column); the render
  handler branches on it after the shared bundle step. Settings › Rendering
  "Default Studio export" (D2); Studio's Export button now opens `ExportDialog.tsx`
  — picker on the default, labels are the trade-off, never the mechanism (D3);
  dev verify controls behind localStorage `vidtsx:export-verify`.
- **Three findings that shaped it**: (1) a separate Remotion audio-only pass
  costs 7 min against 8.6 min of frames (Remotion re-downloads the 1.3 GB source
  per `renderMedia`), so the Remotion engine renders one pass to `.mkv` with PCM
  audio and hands it over — the finishing stage still owns the only AAC encode;
  (2) Remotion's `colorSpace: 'bt709'` leaves primaries/transfer untagged —
  `remotion-color-args.ts` extends its zscale filter; (3) the +42.7 ms was AAC
  priming lost in Remotion's ADTS stream-copy — PCM in, one `aac` encode → 0 ms.
- **Verified in the real app over CDP** (`scripts/bench/export-engine-run.mjs`
  drives the dialog): `t5-1080p` 522 s render-start → file; `t5-1080p-cut` 9 min
  + its verification reference; verify mode on a seeded 3 s two-clip project:
  Remotion vs Remotion diff 0 at 7 frames, audio 0 ms, report + stills beside the
  export. Remotion's bundled ffmpeg has no `select`/`hstack`/rawvideo/f32 — the
  instrument seeks, pipes WAV and tiles in JS.
- Gates: check:types 26/22 (baseline), vitest 1,350 green (+35). Not done, Stage 4
  tickets: queue rows persist `framesRendered 0`; `%TEMP%\remotion-v4…` copies
  per render. Left on disk: project `t5-1080p-cut3s`, three exports + two
  `.verify-remotion.mp4` + one `.verify/` folder under `Videos\VidTSX`.
- **Next: Stage 2** — `passthrough-engine.ts` at the narrowest predicate under
  T1's four conditions, audio as an ffmpeg one pass handed over as `audioPath`,
  gated by the verify mode against the Remotion engine on both reference projects.

## 2026-09-05 (later) — VIDEO PROVIDERS Stage 1 DONE: provider registry (refactor, nothing user-visible)

`src/shared/providers/registry.ts` is now the single definition of every shared BYOK
provider (fal, openrouter, cloudflare, assemblyai, elevenlabs, zai). `ProviderKeyId` /
`ProviderCredentials` derive from it; the Providers-page key rows (labels, hints,
placeholders, capability badges, test buttons, Cloudflare account-id field) render from
it (`SHARED_KEY_ROWS` deleted); the `hasKeys` map is built from its ids. Every engine
preset names its `credentialId` (LLM openrouter/zai, image fal/openrouter/cloudflare,
new `transcription-engine/presets.ts` for STT) and `image-init` / `llm-init` /
`stt-init` / `image-handlers` / `llm-handlers` / `llm-provider-filter` read
`credentials[preset.credentialId]` instead of inline ternaries and id special-cases.
New test `registry.test.ts` pins preset→registry resolution, ids ≡ union, and
badge ⊆ consuming engines. Verified: type gate at baseline (web 26 / node 22), 1318
tests green, Providers page CDP-compared against HEAD row by row — identical, then one
two deliberate changes on Hasan's say-so: OpenRouter now carries the `Transcription`
badge it always earned (`stt-init` registers it), and the Phase C "shared key IS the
enablement" rule is generic (every preset with a `credentialId`, not OpenRouter only —
fixes a saved zai config stranded at `enabled: false`). Full log: `docs/video-providers-plan.md` §6. Next: Stage 2 (video
engine extraction) on Hasan's go. Uncommitted — commit by pathspec when asked.

## 2026-09-05 — AI RUNTIME + REMOVE BACKGROUND + 3D STUDIO: Stage 5 hardening DONE, release-wired (waits for the V1 flip)

**Shipped behind three flags now ON for release** (`ai-system-runtimes`, `ai-3d-models`,
`threed-studio` moved from `.env`-gated to plain `FEATURE_FLAGS: true`): an optional,
downloadable Python + PyTorch runtime (cdn.vidtsx.com, 280 MB CPU / 2.8 GB GPU) with
two curated models — **Remove background** in Image Studio (u2net 176 MB, ISNet 179 MB
used automatically once downloaded) and **3D Studio** (TripoSR 1.7 GB, image → GLB).
Plan + full numbers: `docs/ai-runtime-implementation-plan.md` §10 (2026-09-05 Stage 5).

Stage 5 verified on this box (GTX 1650 Ti 4 GB, dev app over CDP):
- **Guards through the real UI** with the new `VIDTSX_AI_RUNTIME_OVERRIDES` dev stand-in:
  path-too-long (194 chars > 132 budget → both install buttons disabled, both feature
  dialogs say so), disk (1 GB → both blocked; 3 GB → GPU blocked, **CPU offered instead**,
  a fix made on the spot), driver floor (470 → CPU recommended, GPU link disabled with the
  message), VRAM floor (2 GB → same), 512³ disabled on the real 4 GB card.
- **Update path** (fake `2026.09.2` served locally): row "Update available · 2026.09.1 →
  2026.09.2", both features' dialogs "Update the AI runtime", CPU update 149 s, old
  cu126 folder removed after success; **Repair** 142 s; **Remove** now asks inline
  "keep models" / "runtime + models (1.9 GB)" — both verified on disk.
- **The real 2.6 GB GPU download through the row**: ≈ 20 min end to end at this
  2.5–3.5 MB/s uplink (resumed leg 783 s: download 497 s, sha256 31 s, extract 166 s,
  verify 14 s, warm-up 75 s) → "Installed · GPU · 2026.09.1 · 4.6 GB on disk". An app
  restart mid-download (my own edit) resumed from the 1.24 GB partial file.
- **Error matrix**: corrupt TripoSR weights → readable "weights damaged … re-download"
  (a truncated file is caught by the byte count before Python runs); missing package →
  "incomplete or damaged … Use Repair" (doubled hint fixed); runtime at a 178-char path →
  now "path too long" instead of "Repair"; Remove while a job runs → worker cancelled
  first, no EBUSY; cancel at 5 stages of 3D + 2 of rembg → card gone 1.5 s, no orphans, no
  leftovers. OOM cannot be forced on this WDDM box (512³ on 4 GB succeeds, peak 3.25 GB;
  torch spills to shared memory) — covered by Stage 0 + the classifier test.
- **Leftovers closed**: CPU copy "1½–2 min" (measured 96–124 s); ISNet quality check
  (tighter fur edge, 43 % fewer faint pixels, +1.7 s → shipped as a second entry);
  sha256 on every whisper + SD model download and the whisper binary onto the download
  engine; GLB preview on asset tiles/details (shared `GlbViewer`); "Library meshes"
  section in the 3D prompt (context field; caller wiring pending, see the plan).
- **Not done: the rented GPU VM** (no TensorDock/Paperspace account on this box) —
  runbook written into `docs/gpu-cloud-testing-plan.md`, ~45 min once an account exists.

Commits: `0242148` `9557da0` `6060af7` `b1d770f` `6b8b0da` `36951df` `4cd63cd` `2f6be0e`
`ec35745` + the docs commit. Gates: check:types 26/22 (baseline), vitest 1,314 passing (+16).
## 2026-09-04 (evening) — T1 MEASURED: the WYSIWYG tolerance is a number, and the passthrough join is provable inside it

**No product code.** Hasan decided passthrough-first (smart render for
untouched spans, `docs/studio/PLAN.md` §5; full hybrid later, per span type
if the numbers demand it). T1 was the gate and it ran today: three legs on
the same 30 s spans at the same frame indices, on the D-Log HEVC clip and
the H.264 master, every comparison repeated. Everything is in
`docs/PREVIEW_TESTS_PLAN.md` **§T1** with a report file behind every number
(`.vidtsx-temp/bench/t1/`: `preview/`, `frame-map/`, 200 side-by-side
stills, `join/`, `audio/`, `summary.json`). Instruments under
`scripts/bench/`: `t1-preview-capture.mjs` (the real Player over CDP at 1:1,
seeked through the PlayerRef found by a fiber walk, presentation confirmed
by `requestVideoFrameCallback`), `t1-frame-map.mjs` (which *source* frame a
picture shows), `t1-diff.mjs`, `t1-join.mjs`, `t1-audio-offset.mjs`, and
`t8-ffmpeg.mjs` grew `--conform=nearest --source-in --first=ceil --source`.

- **The frame-mapping rule, measured not inferred:** a healthy Remotion
  export shows the source frame whose pts is **nearest** to f/30 (three
  exports, 14 indices each, incl. a real timeline cut — byte-identical to
  the single-clip export); the **preview** shows the last frame **at or
  before** f/30, so the two already disagree by one source frame on about
  half of all frames. ffmpeg's `-r 30` is two frames early and `fps=` drifts
  to ceil; a per-frame `select` on absolute pts reproduces Remotion at every
  index. A span rendered as its *own* composition shows the ceil frame at
  its first frame only. A memory-starved export (this morning's control,
  384 MB free) shows duplicated and skipped source frames — the compositor
  returns whatever survived eviction, silently.
- **Leg 1 — the tolerance (preview vs export today):** mean 3.4–4.8/255
  per channel, 15–18.5 % of pixels over 8, up to **3.0 % over 24**, plus the
  one-frame timing and a +2–3/255 brightness offset on the preview side
  (proxy + `<video>`; the export is 1.3–1.6 from its source frame, the
  preview 3.5–3.9 from its). Repeat: 0.
- **Leg 2 — export vs passthrough** (NVDEC → `scale_cuda` → NVENC with the
  nearest select): mean **≤ 1.74/255, 0 % over 24**, same frame at every
  index, D-Log and H.264 alike; repeat encodes byte-identical; 3.9× realtime
  on HEVC. Three times inside leg 1 on every metric.
- **Leg 3 — the join:** passthrough 0–15 s + browser-rendered 15–30 s. Mixed
  encoders cannot be concatenated (the mp4 recipe jumps to 87 s at the seam,
  the TS route drops frames at the SPS/PPS switch and mis-tags the second
  half); with the browser frames encoded by our ffmpeg to the passthrough's
  settings, **TS video-only intermediates give exactly 900 frames with exact
  pts and a seam at leg 2's level** (1.4–2.0/255, 0 % over 24), except the
  browser span's ceil first frame. Audio: **every Remotion export is +42.7 ms
  late** against the source; the passthrough is at 0; concatenating the
  halves' own audio jumps 61 ms at the seam; **one audio pass is 0 ms at
  every window**.
- **Verdict:** the passthrough join is provable at the tolerance with ~3×
  margin, under four build conditions (nearest select; one encoder for both
  span kinds; TS video-only + one audio pass muxed last; handle the first
  frame of browser spans — render one frame early and drop it). Findings for
  tickets: +42.7 ms export audio; exports tagged `yuvj420p pc bt470bg`;
  preview brightness offset; starved exports show wrong frames with no trace.
- **Then, discussed with Hasan the same evening and LOCKED in
  `docs/export-engines-plan.md` (D1–D7):** the passthrough ships as an
  **opt-in export engine** behind an engine interface + registry (Remotion
  stays the default; Settings default + Export-dialog picker; names
  internal; always runs, with a message when nothing can be copied; hidden
  dev mode that runs two engines and reports the T1 diff; audio reference =
  the camera file, so the Remotion path's +42.7 ms is corrected in a shared
  finishing stage). **Next session: Stage 1 (the engine seam), then Stage 2
  (the passthrough at its narrowest predicate).**
- Left on disk: projects `t5-1080p-join`, `t5-1080p-cut` (Recycle-Bin delete
  via the app), ~1.2 GB in `.vidtsx-temp/bench/t1/`; the 12 `%TEMP%\remotion-v4…`
  folders today's exports left behind are empty (48 KB). Dev app left
  running; keep-awake released.

## 2026-09-04 — cloud video providers planned and LOCKED (no code)

**No code.** Hasan flagged that shipping V1 of *VidTSX* with no reachable video
generation looks odd (cloud video exists in `video-generation.ts` but only the
hidden Flows node calls it). Audited the provider layers: LLM/image/STT have
interface + registry + presets; video is the outlier (no engine, model-id
`switch` for payloads, input frames skip Gate B); a new credential touches ~6
files. Plan in `docs/video-providers-plan.md`, decisions locked with Hasan:
Videos screen becomes the generation tool (unhidden for V1), BytePlus ModelArk
for Seedance direct (Volcengine deferred), Seedance-focused fal defaults,
images + video + audio references in V1, callable from screens / library /
agents over one engine. Five stages: provider registry refactor → `src/video-engine/`
extraction → BytePlus provider + editable video catalogs + reference uploads →
Videos generate panel → Flows node + flag flip + E2E. `V1_RELEASE_PLAN.md` goal 11
added. Starts at Stage 1 when Hasan says go.

## 2026-09-04 (later) — T8a/T8b/T8c MEASURED: the screenshot is the export wall, passthrough is the only order-of-magnitude lever; nothing decided

**No product code.** Building stays paused; the decision (passthrough vs
hybrid) is Hasan's. Everything is in `docs/PREVIEW_TESTS_PLAN.md` §T8
"Results", with a report file behind every number (`.vidtsx-temp/bench/t8/`,
stills in `…/t8/stills/`, sampler `…/samples/…__t8-exports.jsonl`, no
standby holes). Bench additions under `scripts/bench/`: `studio-export.mjs`
grew `--media-engine` (patches a sibling copy of the generated export entry
so the composition's own decoder switch flips for one render), `--direct-gpu`,
`--direct-hw`, `--tag`, and captures the `render:complete` event for direct
renders; new `t8-ffmpeg.mjs`, `t8-output-diff.mjs`, `t8-seed-intra.mjs`,
`t8-headless-decode-probe.mjs`.

- **Controls first, because the noise is 1.6×:** the same OffthreadVideo
  export of the T5 30 s HEVC project ran at 1.17 frames/s from the Export
  button (first render of the day, cold source copy) and 1.93 from the
  direct path 35 min later. Ratios are the finding, not rates.
- **T8a — `<Video>` from `@remotion/media` cannot help the DJI files.**
  Under Remotion's default GL backend headless Chrome has no HEVC decoder
  (probe: HEVC Main10 unsupported in every mode; H.264/AV1/VP9 software
  only), so the tag silently falls back to OffthreadVideo — same rate (1.81
  frames/s), same picture, one warning line in the render log. With
  `gl: angle` the shell gets D3D11 on the Intel iGPU, reports hardware HEVC,
  and the render hangs on the first frame until the 600 s timeout, twice
  (`Timeout while extracting frame at time 0.2sec`, GPU decode counters
  zero). On the H.264 master the tag engages (software WebCodecs) and lands
  at 2.08 frames/s vs 1.87 for OffthreadVideo — a wash, though it skips
  OffthreadVideo's 65 s copy of the 6.3 GB source and 1.5 GB of compositor
  memory.
- **T8b — all-intra 4K intermediate:** NVENC 0.90 GB per minute of 4K60
  (120 Mbps) made at 0.89× realtime; x264 crf 16 1.39 GB/min. Exporting
  from it: 2.27 frames/s (+18 % on the nearest control), colour identical.
  Found on the way: the on-card NVENC plan (`scale_cuda=format=yuv420p`,
  T4b's shape) emits solid-green 1.6 KB frames when the size does not
  change — the shipped proxy path always resizes, so it is unaffected.
- **T8c — the passthrough floor:** the same 30 s through ffmpeg NVDEC →
  `scale_cuda` → NVENC at 1080p: **8.8 s, 3.3 CPU-s, 3.4× realtime**, 30.3
  MB vs the control's 32.4 MB, channel means within 1/255. The only
  differences are on motion edges: ffmpeg's `-r 30` conform of a 59.94 fps
  source picks a different frame of each pair than Remotion's time-exact
  seek (902 vs 900 frames) — the frame mapping T1 must prove.
- **What the numbers say:** every browser path lands at 1.8–2.3 frames/s
  once decode is removed or cheapened, so the 3 h timeline is ~40 h at
  best (T6: ~85 h); passthrough puts its untouched footage at ~53 min on
  this GPU, and whatever still goes through the browser costs ~15 s per
  second of timeline.
- Left on disk for inspection: projects `t5-1080p`, `t5-1080p-intra`,
  `t5-1080p-h264` (Recycle-Bin delete via the app when done) and the
  intermediates in `.vidtsx-temp/bench/t8/` (~1.2 GB). Render timeout
  setting verified back at 600 s; `%TEMP%` clean; memories
  `studio-next-session-tasks` and `studio-scale-limits-open` updated.

## 2026-09-04 — export path discussed and researched; three tests planned (T8a/b/c), nothing built

**No code.** Hasan read the T6 verdict (export is the wall) and asked whether
long 4K exports are simply impossible, how CapCut is so fast, whether Remotion
can use the GPU or render in parallel chunks, and whether TSX shots could be
pre-rendered to video and composited in one GPU pass. Answered with sources in
`docs/PREVIEW_TESTS_PLAN.md` **§T8**: CapCut's speed is an all-on-GPU native
pipeline (the shape our T4b proxy generator already has, 2.4× realtime here);
Remotion already renders in parallel (half the threads) so chunking adds
nothing on one machine; its GPU options cover drawing and encoding, never the
per-frame screenshot or the CPU source decode; the hybrid "pre-render TSX,
composite in ffmpeg" is realistic and is the design the architecture doc
warns about (two renderers must agree on every frame). Recommendation
recorded: passthrough for untouched spans first, T1 gates it. **Agreed next
step: three ~30-min tests on the T5 30 s project** — T8a `<Video>` from
`@remotion/media` for export, T8b export from an all-intra intermediate, T8c
the ffmpeg NVDEC→NVENC passthrough floor. Building stays paused; the
decision is Hasan's after the numbers.

## 2026-09-03 — T6 (long-project stress) and T5 (resolution ceiling) MEASURED; the preview test wave is done except T1/T7

**No product code.** Building stays paused, slice 8 on hold, the
PREVIEW_ARCHITECTURE checklist still Hasan's to mark. Everything below is in
`docs/PREVIEW_TESTS_PLAN.md` §T5/§T6 with a report file behind every number
(`.vidtsx-temp/bench/t6/`, `t5/`, `samples/`). Instruments added under
`scripts/bench/`: `seed-long-project.mjs` (a multi-hour Studio project on
disk from the 4 real 4K60 sources), `sample-machine.mjs` (per-process working
sets incl. Remotion's browser/compositor, machine memory, GPU decode/encode
counters, 15–30 s), `watch-proxies.mjs`, `t6-session.mjs` (a driven editing
session over CDP), `studio-export.mjs` (an export through the real UI, timed
from the app's own queue).

- **T6 — 3 h of 4K60 (44 assets, 11,025 s, 275 clips), answer for Hasan:
  supported to open, proxy and edit; NOT supported to export today.**
  Proxy queue 1 h 54 min on x264 / ~1 h 03 min with the GPU encoder on (its
  first real-project number; 1 h 16 min as measured, 13 min of it Modern
  Standby); 4.5 GB of proxies; cold open 2.9 s, warm 0.8 s; editor usable
  while the queue runs. Session: 90 min of driven editing + 5.7 h idle, app
  peak 1.4 GB across all processes, JS heap flat, trimmed to 400 MB under a
  287-MB-free squeeze with zero errors, no crash. Scrub cost identical to the
  3-asset control at every layer count (the only collapse is T2's
  element-count cliff, reproduced on both). **Export: ~1.08 frames/s** from
  4K60 HEVC — the compositor decodes every source frame in software — so the
  3 h timeline is **~3.5 days**; started, stable, cancelled at 86 min. The
  wall is export time; passthrough for untouched spans (PLAN §5, unbuilt) is
  the only fix in sight.
- **T5 — 8K exports correctly.** 30 s at 1080p/4K/6K/8K: all 900 frames at
  the right dimensions; 8K = 434 MB in 28 min 39 s with the stitcher ffmpeg
  at 7.8 GB and 101 MB of machine memory left. The ceiling is memory, not
  resolution; the named failure below it is Remotion's `No frame found at
  position N` (OffthreadVideo cache starvation, hit on 2 of 4 1080p runs when
  < 0.5 GB was free). Frame rate 0.5–1.4/s at every size.
- **Findings for tickets (not fixed, building paused):** Studio Export passes
  no `cpuUsage`, so Settings › Rendering › CPU usage never reaches it;
  failed or cancelled exports leave `%TEMP%
emotion-*-assets` source copies
  (1.2–1.9 GB each here, ~33 GB for the 3 h project) and a cancel leaves the
  headless browser running; `renderQueueLoad` rewrites active jobs to
  "interrupted" if called mid-render (it is the startup path — scripts must
  read `renderQueueGet`).
- **Machine hygiene learned the hard way:** this laptop has 15.7 GB, not 32;
  it was shared all day with ~13 GB of other processes and Defender; it
  enters Modern Standby when idle and that stops ffmpeg, samplers and renders
  (holes are documented per result; a keep-awake is now part of the recipe);
  an elevated orphan `cmd.exe` burns ~0.7 core and cannot be killed from a
  normal shell (PID 7608 today, 4628 before). The dev harness also reloads
  the renderer page (Vite client reconnect) after pauses — dev-only.
- **Memory updated:** `studio-scale-limits-open` is now evidence, not
  reasoning. T7 not run. Gates untouched (no `src/` change).

## 2026-09-02 (later) — T4b measured: opt-in GPU proxy encoder SHIPPED (off by default)

**The decision gate below was answered by Hasan with a yes, conditional on
measuring first.** Building otherwise still paused for the preview test wave;
slice 8 still on hold; the PREVIEW_ARCHITECTURE checklist still unanswered.

- **T4b DONE — GPU encode** (`docs/PREVIEW_TESTS_PLAN.md` §T4b). Bench grew
  `--ffmpeg/--encoder/--cq/--preset`, `nvdec`/`cuda`/`d3d11va1cu` decode
  variants and a GPU *VideoEncode* counter. Full pass (1,002 s of 4K60, the
  shipped 540p all-intra profile, concurrency 2): **x264 518 s / 3,281 CPU-s**
  vs **NVENC with the whole pipeline on the card 272 s / 107 CPU-s** at the
  same size (392.6 vs 393.0 MB, cq 33 tuned to match CRF 28). Machine CPU 75%
  → 30%. NVENC fed from system memory (the "decode stays d3d11va" shape) was
  **slower than x264** (556 s): the CPU-side 4K scaler costs more than x264
  at 540p, so only the on-card path ships. T0 in-session: NVENC proxies fling
  at 21–22 ms vs 23–28 ms for x264's, 0 misses; natural/playback vsync-bound
  as always.
- **Three findings that shape the feature:** (1) `-encoders` is not proof —
  ffmpeg 9.0.1 lists NVENC and refuses drivers < 610 (this laptop: 592), so
  the probe *encodes two frames* per candidate; (2) NVENC intra-only is
  `-g 0`, rate control `-rc vbr -cq 33 -b:v 0`, and NVENC cannot share the
  d3d11va decode device on this driver (`CreateInputBuffer failed`) — the
  NVIDIA path decodes with `-hwaccel cuda`; (3) gyan.dev deletes old builds,
  so the catalogue pins a BtbN dated monthly autobuild with its published
  SHA-256 (n8.1.2, shared, 80 MB, GPL v3 — `THIRD_PARTY_NOTICES.md`).
- **What shipped:** `ffmpeg-full.ts` (catalogue → existing download manager
  → `userData/ffmpeg-full/`, functional probe cached in `encoders.json`,
  sticky per-session fallback), `proxy-encoders.ts` (pure: parsing,
  NVENC › QSV › AMF preference, per-vendor args, on-card plan for NVENC,
  profile tags so x264 and GPU windows never join), the generator branch
  (full binary, same below-normal priority, one failure → latch + wipe +
  restart that asset on x264), three IPC channels
  (`studio:proxy-encoder:status|install|set-enabled`), persisted
  `proxyGpuEncoderEnabled` (default off), and Settings › Rendering › **"Faster
  proxy generation (GPU encoder)"** (Download ~76 MB → "Detected: NVIDIA
  NVENC" → checkbox; fallback notice). QSV/AMF ship on the system-memory
  shape, unmeasured (no AMD here), behind the same fallback. Audio pass,
  concat, media-jobs, renderer contract and the Remotion export: untouched.
- **Live (CDP-driven dev app):** download → detected → enabled → video-2
  proxy regenerated by the full binary with the cuda pipeline, child
  `BelowNormal`, GPU encode engine 10.6% / decode 100%, manifest
  `nvenc-540p-intra-q33`, **37,893 frames, all keyframes** in ~5 min (x264:
  6 min 10 s; this master is 8-bit H.264 where NVDEC caps at ~2.3×; the
  10-bit HEVC clips get 3–4×). Hard kill mid-window → resumed (`Resumed proxy
  from finished segments`) → byte-identical output. Disabled → next proxy
  ran on the bundled x264 binary again (`x264-540p-g1-crf28` manifest).
  Fresh T0 on the in-app file: equal-or-better than its same-session
  control in three trios, but the control itself had drifted 26 → 33–57 ms
  by late afternoon (machine state after ~5 h of transcodes; an orphaned
  `cmd.exe` from 28 Aug is burning one core — Hasan may want to kill PID
  4628), so no absolute number is claimed for it; the morning session
  stands. **Setting left OFF; video-2's cache holds the GPU-made proxy.**
- **Gates:** 1,180 tests (1,157 + 23: encoder parsing/choice/args/plan,
  handler round-trip incl. fallback clearing, generator GPU branch + fallback
  + profile-mixing guard + cancel), types 26/22 exact.

## 2026-09-02 — proxy pipeline: priority bugfix, T4 + T3 measured, segmented resumable proxies SHIPPED

**Sanctioned inside the pause as a bugfix plus two wave tests.** Trigger: Hasan
opened the migrated video-2 project (one 6.3 GB 4K60 H.264 master) and proxy
generation pinned every core at NORMAL priority; closing the app mid-transcode
restarted the file from 0%. Slice 8 still on hold; the PREVIEW_ARCHITECTURE
checklist is still unanswered (deliberately).

- **Bugfix (`9a3559b`):** every proxy/waveform ffmpeg child runs at
  **below-normal priority** (`runFfmpeg({ priority })`, `os.setPriority` on
  the child, best effort) and the dead NVENC-first branch is gone (the stripped
  ffmpeg has no hardware encoders; it cost one doomed spawn per session).
  Verified live: `PriorityClass BelowNormal` on the child; renderer rAF p50
  16.7 ms / max 49.9 ms / zero frames over 50 ms while a 4K proxy generated.
- **T4 DONE — hardware decode.** `-hwaccel d3d11va` halves the CPU bill on
  either GPU (8,414 → ~3,900–4,200 CPU-s for 1,002 s of 4K60), but only the
  *discrete* adapter shortens the wait (908 → 567 s, 1.6×); the default
  adapter on a hybrid laptop is the iGPU and saves no time (939 s). Proven by
  the Windows GPU-VideoDecode counter, not inferred. Shipped:
  `proxy-hwaccel.ts` enumerates adapters once per session and prefers a
  discrete one; guarded sticky fallback to software like the NVENC precedent.
  Bench: `scripts/bench/run-proxy-cost.mjs`. Full numbers in
  `docs/PREVIEW_TESTS_PLAN.md` §T4.
- **T3 DONE — proxy codec.** Six variants, T0 against each in one session
  with the control first and last (control held at 32.1–32.9 ms fling p50).
  **All-intra 540p CRF 28 shipped**: fling p50 32 → 25 ms (31 → 41 steps/s),
  12% faster to encode, **2.6× disk** (~23 MB/min of 4K60); the p90 tail
  (43–53 ms) did not move on any variant — it is seek machinery, not decode.
  MJPEG is **unplayable** in Chromium's `<video>` (295/300 misses). Two
  constants to reverse if Hasan prefers 720p fidelity. §T3 has the table.
- **Segmented, resumable proxy generation (`proxy-generator.ts` +
  `proxy-segments.ts` + `proxy-concat.ts`):** fixed 60 s windows → per-window
  files in `cache/proxies/<assetId>/` (renamed into place only after a clean
  exit, pid-suffixed `.part` names so an orphaned ffmpeg cannot collide) →
  one AAC pass → concat-demuxer stream copy → same final `proxies/<id>.mp4`
  path; media-jobs and the renderer are untouched. Resume = skip finished
  windows; a `plan.json` manifest (profile tag, source size/mtime, window)
  makes foreign leftovers get wiped, not joined. Progress is one honest
  percent across windows + audio + join and never goes backwards.
  **Kill test, live:** hard-killed the app with 2 of 11 windows done → both
  survived with their mtimes, no orphan ffmpeg → reopened → log `Resumed
  proxy from finished segments {resumed: 2, total: 11}` → finished. Worst-case
  loss is one window (≤ 60 s of source, ~50 s of work).
- **Frame-exact join was the hard part, and it was measured three times.**
  Container durations of x264 B-frame segments run a frame long at some joins
  (shifted every later frame); an input-side `-t` is packet-based and leaked a
  duplicate frame at 5 of 10 joins on the H.264 master (37,898 frames vs
  37,893); the shipping form — input `-ss`, output absolute `-to`, `-copyts`,
  explicit per-file `duration` lines read from the segments — reproduces the
  single-pass pts sequence exactly on the test clip and gives the master its
  37,893 frames. Matroska segments lose to their millisecond timebase.
- **Fresh T0 on the shipped result** (video-2 master, old 720p GOP-15 proxy vs
  the new segmented all-intra 540p one, control first and last in one
  session): fling p50 31.2 → 26.3 ms, natural scrub 16.6 ms and playback 59.9
  fps on both, frame-accuracy err 8.5 → 7.2 ms. Nothing regressed; the join is
  invisible to the Player.
- **Gates:** 1,157 tests (1,105 + 52 new: segment planning/resume, progress
  aggregation, generator with mocked ffmpeg incl. hwaccel latch and cancel,
  join maths, adapter parsing/choice, runFfmpeg priority), types 26/22 exact.
- **DECISION GATE for Hasan (not built):** GPU *encode* via a
  download-full-ffmpeg-on-first-use (NVENC/QSV/AMF). With decode on the GPU the
  remaining cost is x264 at 540p, ~1.5–2 CPU-s per source second; the wait on
  this laptop is now ~1.2–1.8× realtime. Decode-only may be enough; the ~100 MB
  download and the CRF→bitrate mapping are the costs. Build only on a yes.

## IN PROGRESS: preview-engine test wave (T0–T7) — building PAUSED (2026-08-28)

**Hasan's call: stop building and measure before deciding.** Slice 8
(text-based editing) is NOT started and is deliberately on hold.

Read in this order: **`docs/PREVIEW_TESTS_PLAN.md`** (the wave, T0–T7, status
per test, pass/fail criteria) → `docs/PREVIEW_ARCHITECTURE.md` (the options
and the 12-item checklist the wave feeds) → `scripts/bench/README.md` (how to
run T0). Nothing in the architecture doc is DECIDED until Hasan marks it.

- **T0 DONE (`a164e3b`)** — preview scrub benchmark harness:
  `node scripts/bench/run-bench.mjs --from-project=raw-footage-test
  --media=proxy|original`. Mounts the REAL `TimelineComposition` in a real
  Player inside Electron (same Chromium the app ships). Reports to
  `.vidtsx-temp/bench/`. Gates green, no product code touched.
- **Baseline** (DJI 4K/60/10-bit HEVC): proxy scrub 16.6 ms natural / 48.3 ms
  fling; original 101.5 ms / 281 ms with 70 misses; **playback 59.9 fps on
  both**; the app's own JS is **0.1 ms/step everywhere**.
- **Three findings that bind later work:** (1) our code is not the
  bottleneck, it is entirely decode; (2) proxies buy ~6× and the residual
  pain is *flinging* on proxies, which is what T3's all-intra proxy attacks;
  (3) the same 4K file that costs 281 ms per SEEK plays back at 59.9 fps —
  seeking is the cost, not decoding, which is the measured form of the
  WebCodecs argument in PREVIEW_ARCHITECTURE §D.
- **Measurement warning:** T0's first version measured `requestAnimationFrame`
  and reported a flawless 16.7 ms (= 60 Hz vsync) for configurations that
  visibly lag. It now uses `requestVideoFrameCallback`. **The `57 ms` in
  `proxy-generator.ts` and the `17–25 ms` in the S2 checkpoint below may
  measure the same wrong thing — do not compare them with T0 numbers.**
- **T2 DONE (2026-08-28)** — the decoder swap. `@remotion/media@4.0.435` added
  at the exact pin (no train movement), `case 'video'` swapped behind
  `src/shared/studio/media-engine.ts`. **Default is `offthread`: nothing that
  ships changed.** Run either arm with
  `--engine=offthread|webcodecs`; colour with
  `node scripts/bench/run-frame-diff.mjs`. Gates green (1,105 tests, types
  26/22, `electron-vite build` clean).
- **T2's answer is CONDITIONAL — it inverts on layer count, so do not quote it
  as a yes or a no.** At **1 layer** the shipping path wins: proxy fling 32.6 ms
  vs 47.7 ms, and 4K fling 280 ms vs an outright 400 ms timeout (254/300
  missed). At **3 layers** the shipping path collapses (fling 400 ms, 142
  misses) while WebCodecs holds at **134 ms with zero misses** — 3× better.
  The best single number in the test is **4K natural scrub 90 ms → 19 ms**,
  the decode-forward win §D2 predicted, undone by the fling and playback cases.
- **Two risks the architecture doc flagged did NOT materialise.** DJI 4K 10-bit
  HEVC (`hev1.2.4.H150`) **decodes natively** — 100% of frames through
  WebCodecs, zero fallbacks, zero `<video>` elements. And colour holds on
  D-Log: **0.15/255 systematic shift**, i.e. 0.06%. §D3.2 and §D3.3 are
  answered with pixels.
- **Two things it did NOT settle, stated plainly.** (1) The **export half** of
  the fallback question is unmeasured — preview never falls back, so there is
  nothing to match, but `video-for-rendering` is a different code path and
  nobody has run an export on this engine. (2) **4K playback drops 59.9 → 8.4
  fps**, and that is a real regression that needs explaining before the idea is
  dismissed *or* adopted — Mediabunny's `CanvasSink` rasterises a full
  3840×2160 RGBA frame into a 960 px player, which would be a configuration
  problem rather than a WebCodecs one.
- **Recommendation on file: keep the dep and the flag, default off; do not ship
  the swap.** The result is conditional, and T3's premise ("the winning decoder
  changes what the right proxy is") is now genuinely open. Deleting the dep and
  the `case` stays cheap and is Hasan's call.
- **T0's instrument needed extending, and that is itself a finding.**
  `@remotion/media` draws into a `<canvas>`, so it has **no `<video>`** and
  `requestVideoFrameCallback` does not exist on it — T0 unchanged reports
  150/150 misses, a fake catastrophe. `scripts/bench/harness/probes.ts` taps
  the engine's own `Drew frame <s>` trace, the only channel giving both *when*
  and *which*. **Two further traps were caught by the control disagreeing**
  (a frame already on screen, and the free step across a cut where
  `premountFor` already painted), plus a third now refused rather than
  reported: multi-layer playback fps is unmeasurable on **both** engines
  (they reported "10000 fps" and "Infinity fps"). All four are written up in
  `scripts/bench/README.md`.
- **Bench hygiene learned the hard way: run control and treatment in the SAME
  session.** Proxy fling p50 reads 48.3 ms cold and 32.6 ms warm — same
  command, same code. A fresh treatment run against a remembered baseline
  credits the decoder for the page cache.
- **NEXT: T3, the proxy codec A/B** — now unblocked, and more interesting than
  before: T2 did not crown a decoder, so the "tune the proxy against the
  winning decoder" ordering no longer has a winner to wait for.
- Source material: `raw/` = 9 DJI clips, 15 GB, **27 min** of 3840×2160 60 fps
  10-bit HEVC. Enough for T0–T5; T6 must synthesise 3 h from it.

## Completed phases

### V1 BUILD ORDER Slice 7 — PROJECT PACKAGES (.vidtsx) SHIPPED (2026-08-26)
**`docs/NEXT_FEATURES_DESIGN.md` Q7 (build-order row 7), commits NF16–NF18.
Gate-green per commit (1,105 tests, +81 new; type baselines 26/22 exact);
CDP-verified live: a real project exported and re-imported through the UI,
and the file association proven by firing a second instance with a .vidtsx
on argv.** One file carries a whole Studio project — backup, machine
migration, hand-off, and (later, Q7g) something a creator sells.
(1) **Format** (NF16): `manifest.json` with format/app/schema versions,
per-file sha256 + size, the asset table (originalName/hash/originalBytes so
even a no-media package can relink), counts and `kitVersion`. Reserved from
day one per the Q8 constraint: manifest `kind` ('project' | 'template'),
per-asset `replaceable` + `role`, and `packs`/`packs/` — v1 writes
`kind: 'project'` and never writes `packs`, but all of it round-trips
through the validator so a v1 reader can NAME a template package instead of
choking on it (caption packs get their own `caption-packs/` folder so they
never collide with the reserve). Caps: 20k entries, 256 GiB total, 64 GiB per
media file, 64 MiB for anything the app PARSES — the split matters because
the small cap is the one guarding a JSON parser and the TSX gate.
(2) **Writer** (NF16): plan-then-write, so the dialog can size all three
strategies without touching a file. Policy per Q7b — always project.json +
shots + transcripts + cut-plans + thumbs + the kit pin + a tokens-only brand
snapshot; NEVER proxies/waveforms/renders. project.json is REWRITTEN (media
refs go package-relative, proxy/waveform pointers dropped) so nothing
absolute from the exporter's machine survives; transcript/thumbnail refs need
no rewriting at all because cache-relative paths already match package paths.
Each entry is hashed from the bytes actually streamed (one pass over
multi-GB media), media is STORED not deflated, and a failed write unlinks the
partial file. Zip deps pinned exact (archiver 7.0.1 / unzipper 0.12.3) — no
new dependency was needed.
(3) **Import** (NF17): the manifest is the ALLOWLIST (a stowaway entry is
never read or written); zip-slip is checked twice (string-only name check
before any resolve, then resolve + containment on every target); declared
size must equal the zip's own uncompressed size BEFORE a byte lands (the
zip-bomb shape); every file is hashed as it is written. A newer
format/schema version is refused with a message naming the app version that
wrote it. Always a NEW project id, `migrateProject` as the document gate,
and every path-bearing field rewritten — a package that puts
`../../../evil.jpg` in `thumbnail.path` gets `thumbs/<id>.jpg`. The **D14
gate re-runs on every shot** (mandatory — the exporter's machine proves
nothing): pass = ready, allowlist-gap-only = a Convert card, anything else =
an error card, and the project still opens. Assets with no media get a
project-local PLACEHOLDER path, which routes them through the EXISTING
prepare → library-hash-heal → Locate… flow with zero new machinery. A failed
import leaves nothing behind.
(4) **Brand** (Q7f) all three offers real: match one of yours / create from
the snapshot / keep the tokens project-local at `<project>/brand.json` — the
last one made real by `project-brand.ts`, one `resolveProjectBrand()` now
used by shot generate, shot refine and the export entry's caption palette
(library brand wins; the snapshot is the fallback, including when a library
brandId has gone stale). The exporter's brandId is always dropped.
(5) **Convert in place** (NF17): `shot-conform.ts` — shot-import conforms on
the way IN and can reserve a fresh folder, but an imported shot's id and the
clips referencing it arrived together, so a conversion lands as a NEW VERSION
IN THE SAME FOLDER; re-importing would orphan every clip.
(6) **UI + association** (NF18): export dialog (three strategy tiles carrying
real totals, per-asset table, chat opt-in), import dialog (manifest summary,
brand offer, report cards), `.vidtsx` file association via electron-builder
with the OS hand-off funnelled through one pending slot in main — the push
event only navigates, the PATH waits until the project browser claims it, so
a cold start into another screen cannot drop it. Two new CDP dialog
stand-ins (`VIDTSX_PACKAGE_SAVE`/`VIDTSX_PACKAGE_PICK`, the
`VIDTSX_RELINK_PICK` precedent) documented in `docs/ui-automation-cdp.md`.
**One judgement call for Hasan:** the chat opt-in governs BOTH
`agent-chat.json` and per-shot `chat.json` — Q7a lists the latter
unconditionally, but Q7b's reason ("it's a private conversation") applies to
both. Say the word to split them. **Noted from the live walk:** for a small
source clip the proxies-only package can be LARGER than full media (a 0.4 MB
clip's 720p proxy is 0.6 MB); the tile shows the real number, so the dialog
is honest about it rather than promising "smaller".

### SLICE 5 FOLLOW-UPS CLOSED — blocklist pruning + mailto + eval re-run (2026-08-26)
**Commit NF15. Hasan's Gate A review pass applied: −41 verified-collision
terms → 1,223 (the review artifact was found deleted; rebuilt from source
and walked in-session; every drop verified to fire against the live gate
first). Headliners: fr `bite` (= English "bite" — blocked every innocent
English prompt containing the word), es `concha`, nl `aftrekken`
(subtraction), ar `فرج` (relief), ja `ローター` (rotor), zh `交配`
(animal mating). All 40 pruned prompts + 5 retained-coverage neighbors
pinned as golden tests (moderation suite 47→92). Mailto
`support@vidtsx.com` CONFIRMED final. Eval: the assumed CF/agy accrual had
not happened (still the 12 NF12 starters); re-run reproduces NF12 exactly
(11/12, FP 8.3%, sweep flat) — bands stay frozen 0.8/0.2, no retuning.
Bulk generation of the remaining ~490 SFW eval images approved + started
(agy). Full detail: CONTENT_SAFETY_DESIGN.md "Rev 2 amendments". Still
open from slice 5: full-set eval re-run once images land; live
cloud-provider + video legs (ride Hasan's testing pass).**

### V1 BUILD ORDER Slice 6 — GEMINI/AGY SUBSCRIPTION IMAGE PROVIDER SHIPPED (2026-08-26)
**`docs/NEXT_FEATURES_DESIGN.md` Q1 (build-order row 6), commits NF13–NF14.
Gate-green (983 tests, +31 new; type baselines 26/22 exact); live-verified
via CDP: one real Nano Banana 2 generation driven through the new
"Google (subscription)" provider row in Image Studio — agy spawn → NDJSON
DONE gate → brain-dir harvest → Gate B output classification → gallery
save, ~30 s, $0 (subscription-billed).** (1) `gemini-cli` CLI-bridge
provider (`GeminiCliImageProvider`, registerInstance like the local SD
bridge, zero models until agy detected + authed → UI hides it): TS port of
the proven `gen-image.ps1` recipe split into pure
`agy-cli-protocol.ts` (unit-tested: VERBATIM prompt pinning, DONE-event
success gating because exit 0 lies, non-recursive brain-dir harvest,
conversation_id sibling-of-init) + spawning `agy-cli.ts` service
(concurrency-1 promise-chain queue, 300 s timeout, abort→kill,
GEMINI_API_KEY/GOOGLE_API_KEY stripped from the child env so billing can
never route to the metered API). Provider caps refs at 3 with the
fold-into-prompt message, buckets width/height onto agy's 8-aspect set
(log-distance nearest), stages base64 refs as temp files (+`--add-dir`),
output always JPEG with SOF-parsed real dimensions. Injected
`AgyCliBridge` keeps image-engine free of main imports (local-SD
prepare-hook precedent). (2) Setup card on AI Models → Image
(`GeminiCliSetupCard` + `useGeminiCliStatus`): detect
`%LOCALAPPDATA%\agy\bin\agy.exe`, auth probe = `agy models` exit 0,
install command + manual sign-in instructions (app never automates OAuth),
window-focus re-probe with 60 s throttle, force-probe "Check again";
becoming ready broadcasts `vidtsx:image-providers-changed` so the Image
Studio provider list updates without remount. One `IMAGE_CLI_STATUS`
channel returns a status LIST. (3) Plumbing two-wide for the deferred
MiniMax/mmx provider: type union `'gemini-cli' | 'minimax-cli'`,
`INSTANCE_IMAGE_PROVIDER_IDS` filter (settings-save drops CLI ids),
engine register() rejects CLI types with a registerInstance pointer.
(4) ZERO bespoke safety code — the engine's fail-closed `runGuarded`
chokepoint covers the provider (log-verified: output classified before the
complete event). Usage logs ride the generic handler path (provider
`gemini-cli`, $0). (5) NF14 smoke-catch: agy hangs forever on an open
stdin pipe — spawn now uses `stdio: ['ignore','pipe','pipe']` (the ps1
never hit this because PowerShell hands agy the console's stdin).

### V1 BUILD ORDER Slice 5 — CONTENT SAFETY ENFORCEMENT SHIPPED (2026-08-26)
**`docs/CONTENT_SAFETY_DESIGN.md` Rev 1 plan implemented as written (Rev 2
records the results), commits NF8–NF12. Gate-green per commit (948 tests,
+70 new; type baselines 26/22 exact); CDP-verified live: prompt block in
the real Image Studio UI, Content Safety page with persisting counters, and
one full Gate B round trip (input-ref check → real provider generation →
output check, classifier warm in its own process).**
(1) **Gate A** (NF8): curated `generation-blocklist.ts` — 1,264 terms
re-tagged from the 4,571-term list by sexual/nudity/pornography INTENT
(profanity/slurs never block), +22 sexualized-minor additions, −33
language-blind collisions (tr `am`, `sperm` whale, `kinky` hair, SEGA,
katakana Kant…); normalizer hardened (NFKC, Cyrillic/Greek homoglyphs,
separator-lookahead fix, no-space-script boundaries for zh/ja/th);
engine-chokepoint guard on `imageEngine` + hooks on fal video submit and
both local sd queues; typed `ModerationBlockedError {gate, category}`
destructured to `blocked?` on IPC responses, message = the D5 renderer
copy. Curation review artifact handed to Hasan (his pruning pass open).
(2) **Gate B** (NF9): self-exported fp16 Marqo ONNX (11.4 MB, sha256
868c759f…, parity drift 7.7e-4, export script committed; bundled via
extraResources as the documented download-on-first-use exception);
onnxruntime-node 1.24.3 direct pinned dep, packaged CPU-only (DirectML
stripped, linux never ships); `runGuarded` covers img2img/multi-ref INPUTS
before any provider call and every output; NO guard installed = generation
refused (fail-closed); local SD results classified before the complete
event, blocked files unlinked; decode via nativeImage with ffmpeg
image2pipe/png fallback (trimmed Remotion ffmpeg has no rawvideo muxer);
undecodable = blocked. (3) NF10: video sampling — 2 fps via `-r` (no fps
filter in the trimmed build) + first/middle/last anchors + native-res
center-crop pass ≥3000px, any frame trips → clip blocked; wired into the
fal save path and local Wan; both capture write sites classify the PNG
before it reaches the library. (4) NF11: always-visible `safety` sub-tab
(AI screen) with policy copy, classifier state + sha, and local blocked
counters (settings KV, NOT ai-usage; one CONTENT_SAFETY_STATUS channel);
policy clause in agent prompt + shot contract + appended main-side for
flows; **LLM-hook-absence CI test** pins D4 (engine/llm-handlers/
tsx-engine/stt/agent/captions reference no gate symbol). (5) NF12: eval
harness (`scripts/content-safety-eval.mjs`, dev-only) + 12-image agy SFW
starter set: Marqo 11/12 pass (margins ≤0.086; one FP: anatomy textbook
diagram p=0.859, accepted recall-greedy), **OR-ensemble REJECTED** (xs
flags 6/12 SFW portraits/swimwear/flat → FP 8.3%→58.3%), **bands frozen
0.8/0.2**. The walk caught a real bug fixed in NF12: sherpa-onnx's older
onnxruntime.dll poisons per-process DLL resolution, so the classifier now
runs in an Electron **utilityProcess** (own DLL space) instead of a worker
thread — fail-closed held throughout (generation refused, never passed).
NOT yet live-proven: a real cloud video generation + captures against the
gate (piggybacks Hasan's testing pass); full ~500-image eval re-run before
the public flip; confirm the `support@vidtsx.com` placeholder mailto in
`ContentSafetyContent.tsx`.

### V1 BUILD ORDER Slice 4 — USAGE-TRACKING FIX SHIPPED (2026-08-22)
**`docs/NEXT_FEATURES_DESIGN.md` Q4 (build-order row 4), commits NF6+.
Gate-green (878 tests, +6 new; type baselines 26/22 exact); CDP-verified
live against real historical usage data.** Closes the gaps: before this,
only LLM + image generation logged (image at $0 flat), STT and fal video
nowhere. (1) `AiRequestType` += `'stt' | 'video'`; `AiFeatureSource` +=
`'transcription'`. (2) STT logs in `transcribeAudioFile` — the funnel ALL
three callers share (Transcribe screen, Studio asset-transcriber, auto-cut;
the design named the IPC handler but the service-level chokepoint covers
auto-cut too, which bypasses that handler); cost = new informational
`pricePerHourUsd` on `STT_CATALOG` entries (from their own priceText:
AssemblyAI 0.21/0.21/0.15, Scribe 0.22, whisper-1 0.36; local + unpriced
= $0) × `result.duration`. (3) fal video logs in `getVideoJob`'s completed
path (`requestType: 'video'`, featureSource `'flows'`, wall-clock via new
`submittedAt` on TrackedJob); cost = new `pricePerSecondUsd` on
`VIDEO_MODEL_CATALOG` (kling 0.08, veo-3-fast 0.15, hailuo 0.045, seedance
0.03 — web-verified; wan-2.5 deliberately unpriced, rate varies by
resolution). (4) Image cost: `priceUsd` on `ImageModelCatalogEntry` +
shipped defaults (nano-banana-pro 0.15, nano-banana-2/seedream 0.04,
flux.2-pro 0.03, CF flux-1-schnell 0.0006/klein 0.015/dev 0.05) read via
`getDefaultImageModelPriceUsd` — looked up from the SHIPPED defaults at
logging time because `sanitizeEntries` strips user catalog edits to
id+name, so user overrides can't lose prices; × images returned. All price
fields are documented as informational estimates — the provider bills, we
chart. (5) Chart metric toggle **Tokens | Requests | Cost** end-to-end:
`AiUsageMetric` type → `getChartRows` also selects cost_usd →
`getChartData(period, filter, metric)` → chart IPC `metric?` param →
`useAiUsage` metric state → toggle in `AiUsageChart` beside the period
picker (dynamic title, $-formatted y-axis + tooltips). Log table needed
nothing (columns generalize, as designed). (6) `handleImageProviderTest`
now logs (featureSource `'provider-test'`, priced) — the LLM/image test
asymmetry closed. No DB migration (TEXT columns); ring buffer stays 10k.
6 new tests: chart metric aggregation ×3 (vi.mock'd db — first ai-usage
service tests) + price-lookup ×3. Live-verified via CDP: toggle switches
title/axes ("Estimated Cost Over Time", $1.32–$5.29 from real prior LLM
entries), Requests view surfaces all four providers' lines. NOT yet
live-proven: actual stt/video entries appearing (needs a real transcription
/video run — piggybacks on the same manual passes already queued for
slices 2–3).

### V1 BUILD ORDER Slice 3 — CLOUDFLARE WORKERS AI IMAGES SHIPPED (2026-08-22)
**`docs/NEXT_FEATURES_DESIGN.md` Q2 (build-order row 3), commits NF4+.
Checklist recommendations approved by Hasan (token = secret credential,
account id = plain settings field); gate-green (872 tests, +6 new; type
baselines 26/22 exact); smoke-launched + CDP-verified in the real app.**
Third cloud image provider, by the fal/OpenRouter checklist, with the
two-credential wrinkle: `ProviderCredentials.cloudflare` holds the **API
token** (rides the existing safeStorage blob) while the **account id** is a
plain `cloudflareAccountId` settings value — carried on the providerKeys
get/save IPC (it's not a secret, so it round-trips to the renderer), edited
in a field under the key input in the new ApiKeysSection row, and injected
into the runtime `ImageProviderConfig.accountId` at registration only (never
persisted inside `imageProviders`). New `@shared/providers/cloudflare`
client POSTs `accounts/{id}/ai/run/{model}` and **sniffs the response
Content-Type** to normalize both output dialects to `GeneratedImage.base64`
(flux/leonardo JSON-base64 vs SD/SDXL raw binary) — so user-added catalog
ids work with zero per-model output metadata. `CloudflareImageProvider`
keeps per-model *input* dialects: flux-1-schnell = JSON prompt-only (no size
params), lucid-origin/sdxl-lightning = JSON + clamped width/height, flux-2
klein-9b/dev = multipart form (even prompt-only) with `input_image_0..3`
Blobs for image-to-image/multi-reference (verified against CF's changelog
curl examples). One run = one image → loops for `numImages`. 429/neuron
errors map to a "daily free tier exhausted (10k neurons/day, resets 00:00
UTC)" message. Default catalog (`provider-model-defaults.ts`, user-editable
as usual): flux-1-schnell (default, ≈170 free images/day), flux-2-klein-9b,
flux-2-dev, lucid-origin, sdxl-lightning. Existing red-circle `imageTest`
flow works as-is (row has the flag; test IPC gained a draft `accountId`
override; Test button also gates on account id presence). Engine
registration skips cloudflare when either credential half is missing. 6 new
provider tests (stubbed fetch): JSON dialect + URL/auth shape, binary
dialect + dimension clamping, multipart multi-reference form fields,
free-tier 429 mapping, unsupported-operation refusal, numImages loop. NOT
yet live-proven: a real generation needs Hasan's CF token + account id
(enters via the new Providers row → Test).

### V1 BUILD ORDER Slices 1+2 — AUTO-SAVE HARDENING + ELEVENLABS STT SHIPPED (2026-08-21)
**`docs/NEXT_FEATURES_DESIGN.md` Q10 + Q3 (build-order rows 1–2), commits
NF1–NF3. Checklist recommendations approved by Hasan; both slices gate-green
(866 tests, +22 new; type baselines 26/22 exact).**
**Slice 1 (Q10, NF1)**: (a) Quit-flush — `useStudioProject` gained `flush()`
plus `beforeunload`/window-`blur` listeners, and a main-side close guard
(`ipc/flush-guard.ts`, installed in `createWindow`) that defers the first
window close over a `studio:flush:request` push until the renderer acks
(`studio:flush:ack`) or 1.5 s passes; `OpenProjectContext` acks instantly
when no project is open so non-Studio closes stay instant. (b) Rotating
snapshots — new `snapshot-store.ts`: `<project>/snapshots/project.<ISO>.json`
(colon-free stamps, atomic tmp+rename, NEVER under cache/), written on
project open (deduped by newest-stamp ≥ updatedAt) and by the save handler
whenever the newest snapshot is >10 min old (saves only happen while editing,
so no idle timer); retention = newest 20 whole + older thinned to newest per
UTC day (`selectSnapshotsToPrune` is pure + tested); file names are
pattern-validated before becoming path segments. (c) "Restore version…" —
project name in the editor toolbar is now a menu button (FloatingMenu) →
`RestoreVersionDialog` (two-step inline confirm, CDP-drivable `data-*`
hooks); restore flushes first, main snapshots the current state (the undo
path), writes the snapshot as project.json, and the renderer swaps the doc +
resets the timeline reducer (undo history dies with the replaced document —
by design; the safety snapshot is the way back) + success toast carries an
Undo action that restores the safety snapshot. 12 new snapshot-store tests
(round-trip, dedupe, staleness, retention incl. same-day collapse, traversal
refusal, corrupt refusal). NOT yet live-proven: one manual pass (close
mid-edit → reopen intact; restore → undo restore) is worth doing.
**Slice 2 (Q3, NF2)**: ElevenLabs Scribe v2 as a fourth STT provider, by the
checklist: `SttProviderType`/`TranscribeEngine` += `'elevenlabs'`,
`ProviderCredentials.elevenlabs` (rides the existing safeStorage blob),
has-key plumbing, ApiKeysSection row, engine registration + `stt-init` seed
(`defaultModel: 'scribe_v2'`), catalog `elevenlabs/scribe-v2` (~$0.22/hr;
wordTimestamps + speakerLabels + audioEvents — the catalog's first audioEvents
user; **verbatimDisfluencies deliberately OFF** until proven on Raw Footage
Test audio, so AssemblyAI stays the auto-cut pick). Provider is ONE
synchronous multipart POST (`xi-api-key`, global fetch + FormData — the
codebase's first multipart upload) on pre-extracted audio; `words[]` filters
`spacing`/`audio_event` entries (events only narrow the per-run features
snapshot); diarized runs derive utterances from speaker runs (speaker change/
pause/sentence/length breaks) so segment speakers work without native
utterances. The design's "zero consumer change" claim was FALSE for the
Transcribe screen — its three provider-name branches (hasKeys state,
cloudKeyPresent chain, missing-key copy) are now generalized via a new
`STT_PROVIDER_LABELS`; Studio's picker needed nothing (capability-gated), and
`StudioAssetTranscript.engine` widened to record `'elevenlabs'` honestly
(asset-transcriber, optimistic patch, Inspector label). 10 new provider tests
(vi.stubGlobal fetch — first provider-level STT tests): word filtering,
multipart shape, auto-detect, speaker mapping, feature narrowing, 401 copy,
detail-message surfacing, utterance grouping. NOT yet live-proven: a real
Scribe v2 run needs Hasan's ElevenLabs key (enters via the new Providers
row); the verbatim A/B on Raw Footage Test audio then decides
`verbatimDisfluencies`. Usage logging stays out of scope (that's slice 4).

### SHOT_QUALITY COMPLETE — Q4b scripted capture SHIPPED + Slice-1 leg proven (2026-08-21)
**`docs/studio/SHOT_QUALITY_DESIGN.md` Rev 6 / `ASSET_LIBRARY_DESIGN.md` Rev 4
(L6b), commits SQ26–SQ29. Every slice of the shot-quality plan is now built
and live-verified; leftovers are the v2 ledger.**
Opened by walking the last unproven Slice-1 leg (Creator-save → v(n+1) →
Studio version picker) live on end-card: append-only save, both heads-up
toast variants, picker shows the new version without flipping activeVersion,
folder-as-truth drop after delete. The walk caught two defects, fixed +
re-verified live (SQ26): the code editor's 500 ms auto-save wrote IN PLACE
into Studio shot versions (now buffer-only there; Ctrl+S = new version;
Overwrite hidden), and the library's Studio section served a stale "newest"
between window focuses (now rescans on open/expand/save). Then **Q4b**:
`capture_scripted` — typed steps (navigate/wait/scroll/type/click/capture,
zod discriminated union), agent-authored strings never execute as page code,
partial-stills-with-named-failure, 10 s/step + 120 s/script caps, hidden
window only — over a new shared `capture-window.ts` hardening used by both
capture paths (SQ27); new tool + allow-list + when-to-script skill text with
the two-source rule (SQ28); cookie-banner-dismissal guidance after the A/B
(SQ29). **A/B: one ask → 9-step script → 3 labeled stills of
learnwithhasan.com (top/mid/bottom) → `homepage-walkthrough` kit
BrowserWindow shot over the real states, 0 fix attempts, 96 s; placed via
propose_shots, applied as one undo step, undone cleanly.** Stills:
`scripted-capture-ab-report.html` (local, untracked). Ledgered: visible-mode
scripting, script-builder UI, timeline-aware placement positions.

### SHOT_QUALITY Slice 4 — STYLE MEMORY (Q6) + REFINE (Q5) SHIPPED, live-proven (2026-08-21)
**`docs/studio/SHOT_QUALITY_DESIGN.md` Q5 + Q6 (Rev 5), commits SQ20–SQ25.**
Opened by proving Slice 3's two remaining legs: (i) **kit export RENDER** —
published-guide v5 range-exported 0–8 s; entry dir got
`studio-entry-<pid>-kit-1.0.0/` with the specifier rewritten, render
completed first try (8.06 s, 1080p30); (ii) **agent-driven browser shot** —
one ask produced a `fullPage` capture (6453×9882) and a kit
BrowserWindow walkthrough shot, 0 fix attempts. Then the slice:
(a) **Q6a** — brand-filtered rule/profile memories inject into every shot
generate/regenerate as a `## Learned style` section beside the brand
contract (`composeShotStyleMemory`, 2000-char budget, profile drops first,
rules never silently dropped); proven via sidecar section list AND the
regenerated intro-title v3 whose entrance code cites the rule. (b) **Q6b** —
skill + system-prompt capture triggers (repeated edit instructions,
reasoned rejections, regenerate patterns → gated `propose_memory`; silent
inference stays rejected); rule proposals can be `brandScoped` — main
stamps the project's brandId, never the agent. (c) **Q6c** — new gated
`propose_style_promotion` tool + card: agent names the evidence (no hard
counter), proposal shows the resulting styleNotes size and what it
displaces under the 2000 cap; accept = one click doing brand write + memory
retire in one handler (recomposed against a fresh brand read). Live-proven
end-to-end: the agent promoted the seeded rule citing this session's real
shots; brand.json carries it, memory retired. (d) **Q5 Refine** — Inspector
button beside Regenerate: 3 stills through the **export-parity path**
(`renderShotStills`: synthetic one-clip timeline → createExportEntry → same
kit pin/bundle → `renderStill`), stills + brief + brand + learned rules
through ONE `editTsxPipeline` vision pass (its dormant `images` option,
first user), new `refine` op folds renderer-side like edit. Live: one click
on published-guide v5 → v6 in ~110 s with a 7-point critique that caught
the known tilt flaw (6.4°→4.2°), the cropped headline, the shadow band,
amber overuse, AND applied the learned no-overshoot rule. Stills + verdicts
in `style-memory-refine-ab-report.html` (local, untracked). Automatic
refine rounds stay ledgered until cost/quality says otherwise.

### SHOT_QUALITY Slice 3 — THE KIT (Q4) SHIPPED, A/B-proven (2026-08-21)
**`docs/studio/SHOT_QUALITY_DESIGN.md` Q4 (Rev 4), commits SQ10–SQ18.**
Shots can now import `@vidtsx/kit`. (a) **The pack** at
`resources/shot-kit/core/` (kitVersion 1.0.0): the **navigable
BrowserWindow** flagship (typed URL → loading state → page reveal → scripted
scroll → navigate again, pages = capture stills, cursor + click ripples),
VSCodeWindow + CodeEditorPane + ImageViewerPane, TerminalWindow,
GenericWindow, TypedText, AgentFeed + AgentInputDock, StatBlock, EASINGS —
brand-scrubbed to a `theme` prop, no icon/font library deps, plus the
MANIFEST the prompt cites verbatim. (b) **Delivery**: `kit-bundler.ts`
esbuild-bundles the pack (react/remotion external → virtual URLs) and the
module server serves `/virtual/vidtsx-kit.js`; the transpiler maps the
specifier via `VIRTUAL_SHIM_PACKAGES`; shot lint gained exactly ONE
allowlist entry (subpaths still rejected — tested). (c) **Export pinning**
(`shot-kit-pin.ts`): first accepted kit-importing version snapshots the pack
into `<project>/kit/<version>/` (write-once, folder-as-truth — no
project.json field, no autosave race); the entry copy step copies the
snapshot beside the shot copies as `studio-entry-<pid>-kit-<version>/` and
rewrites the specifier; the sweeper learned prefix-matched directories.
(d) **Prompt/skill**: KIT section (manifest verbatim, craft → KIT →
exemplars → contract ordering), `browser-walkthrough` kit exemplar replaced
`two-stage-statement`, make-tsx skill teaches screencast briefs +
`fullPage: true` captures ("tall viewport" already existed as fullPage).
(e) **SQ10 pre-A/B fix**: `v*.debug.json` records the composed system
prompt + sha256 + section list — which found the slice's real bug:
(f) **SQ17**: the VERIFY step ran on the bare mode checklist and silently
"fixed" contract-compliant shots — stripping kit imports and rewriting
`durationInFrames` → `durationInSeconds` — since D6. It now reviews under
the appended caller contract. **A/B on "Published guide" (same brief ×4,
0 fix attempts each): manifest alone → ignored (v2); prompt hardening →
model re-implemented `const BrowserWindow` locally (v3, v4); + verify fix →
v5 imports the kit, real captured page inside real chrome with scripted
scroll, `kit/1.0.0/` pinned, live Player renders through the virtual
module.** Stills in `kit-slice-ab-report.html` (local, untracked). Driven
end-to-end via CDP (occlusion flags + restore-minimized recipe held).
NOT yet live-proven: export render of a kit shot (pinning is unit-tested;
worth one manual export pass), and the agent-driven browser-shot flow with
fresh fullPage captures.

### SHOT_QUALITY Slice 2 — QUALITY LAYER A SHIPPED, A/B-proven (2026-08-20)
**`docs/studio/SHOT_QUALITY_DESIGN.md` Q3a–Q3d, commits SQ6–SQ9.** What the
pipeline model reads got three upgrades, all prompt/resource-side: (a) an
**exemplars pack** at `resources/shot-exemplars/core/` — six brand-scrubbed
finished shots, two per kind, each ≤120 lines and contract-compliant (titles
drive the injected WORDS block; react+remotion imports only; seconds×fps
timing), packaged exactly like caption packs and loaded per kind by
`shot-exemplars.ts` (corrupt/missing → degrade to none, never a failed
generation); (b) a **craft block** (stagger discipline, easing families,
spatial rhythm, density ceilings, one accent per beat, hold-layout,
exit-clean) that — with the exemplars — opens `buildShotExtraInstructions`
BEFORE every variable section, so the prompt prefix stays cache-friendly;
(c) the make-tsx skill's brief grammar is now **storyboard-grade**: content →
regions (proportions) → beats quoting exact transcript cue words → density/
motion intent, with span-anchoring the default for cutaways/overlays too.
**Q3d honesty gate PASSED** — intro title + end card regenerated live on
"Raw Footage Test" (claude-subscription, one pass, 0 fix attempts each):
the title went from a flat word stream to a three-line composition with a
96 px payoff line and disciplined accent use; the end card kept its layout
(same brief) but gained damped-to-rest motion and proper stagger. Median
moved → kit slice (Q4) is next and worth its scope. Layer A never touches
the fake-screencast gap — as calibrated.

### SHOT_QUALITY Slice 1 — CONTINUITY + LINKED FOLDER SHIPPED, live-proven (2026-08-20)
**`docs/studio/SHOT_QUALITY_DESIGN.md` Q1 + Q2, commits SQ1–SQ4.** Written
after the raw-footage E2E test stranded a session's generated shots from the
agent. (a) The agent request now carries the registry snapshot; `list_shots`
reads it and `propose_shots` places any READY registry shot — shots from
earlier sessions are proposable again. (b) `shot-reconcile.ts` scans `shots/`
against the registry on project open + window focus: gate-passing orphan/
dropped-in folders are adopted through the D14 gate onto the shot job-event
stream (toast), convertible failures land in the existing Convert-for-Studio
banner, and failures are never minted as registry entries. (c) The Assistant
transcript persists per project (`agent-chat.json` beside project.json,
write-behind, corrupt-set-aside; replay capped at the last 30 exchanges; ↺ is
now "New conversation" with rotate-keep-3; the context-usage warning counts
only the replay window). (d) The Creator library gains a **Studio** section —
a live view of every Studio project's shot folders (`studio-shot-library.ts` +
`StudioShotsSection.tsx`); saves into a Studio folder are append-only
(overwrite redirects to v(n+1), next number = MAX existing version) with an
open-project heads-up toast. Live-proven on "Raw Footage Test": a planted
Creator comp drop-in was adopted on open (toast + registry + pool), the agent
listed all nine pool shots via `list_shots`, the transcript file appeared
after the turn, and the Creator section listed 4 projects / 8 shots.
NOT yet live-proven: the Creator-save→v(n+1)→Studio-version-picker loop
(unit-tested only) — worth one manual pass. MotionScreen/TsxJobsContext were
deliberately untouched (parallel-session dirty files).
**Next: Slice 2 (Layer A exemplars + briefs + craft block, then the Q3d A/B
regen on Raw Footage Test).**

### V1 Phases G + H — COMPLETE, live-session acceptance PASSED (2026-08-17)
**The H6 gate below is closed.** All shipped providers have now executed for
real in-app: keys entered via the Providers UI, one Studio agent turn each on a
transcribed project, all landing in ai-usage with non-zero cache reads
(openrouter / minimax / kimi; Z.AI was cut from V1 on 2026-08-17 — the shipped
set is five presets). The in-app leg caught and fixed two bugs: kimi had no
key-entry row (`LLM_ONLY_IDS`), and a fresh OpenRouter shared credential never
enabled the LLM provider (plus a latent bug where any LLM-row save dropped
credential-backed providers from the engine until restart — the save path now
re-runs `initLLMEngine()`). G7 memory acceptance passed all five legs on
claude-subscription, including a both-directions counterfactual (toggle
off/on in a cleared conversation). Details: `V1_RELEASE_PLAN.md` H6/G7 + the
2026-08-17 session-log row. **Remaining for V1: licensing flip checklist +
Phase E hardening (rotate root `.env` keys before the repo goes public).**

### V1 Phase G + H — PLANS GRILLED, REVISED, DECIDED (2026-08-16)
**Status: DESIGN ONLY — no feature code. `docs/studio/AGENT_MEMORY_DESIGN.md`
§Rev 2 + Phase G/H/Q6 in `V1_RELEASE_PLAN.md`.**

**DECISIONS TAKEN (Hasan, 2026-08-16), after the grill below:**
- **V1 ships six `agent-sdk` presets and nothing else** — `claude-subscription`,
  `claude-api`, `zai`, `minimax`, `openrouter`, and **`kimi` (new)**. Kimi is
  Anthropic-native (`https://api.moonshot.ai/anthropic`, model `kimi-k3`, auth
  via `ANTHROPIC_AUTH_TOKEN` with `ANTHROPIC_API_KEY` unset) and `buildEnv()`
  at `claude-provider.ts:71-89` already does exactly that — so it is **one
  preset row, zero new code**. `openai` and `gemini` move to **V2**, where they
  need real tool-translation layers (likely dedicated SDKs), not preset rows.
  The custom-endpoint form is flagged off for V1 (H5), so **V1 is one engine
  path** with tools + caching everywhere and nothing shipped degraded — which
  cuts H3 almost entirely.
- **NEW GATE (H6)**: the ai-usage DB shows `claude-subscription` is the **only
  provider that has ever executed in this app** (27 runs, 2026-08-11→16). The
  other five are config assertions, not evidence. Each needs one real agent
  turn (text + a tool call + non-zero cache read) before release; any that
  fails ships hidden. `openrouter` first — its `baseURL` has no `/anthropic`
  suffix, unlike every other routed preset, and nothing here proves it answers
  in Anthropic shape.
- **`MAX_ACTIVE_RULES = 50`, `MEMORY_PROMPT_BUDGET = 7000` chars** (was
  25/4000, originally an impossible 40/2000). Rationale: the two skills already
  inject **10,508 chars every turn**, so a 7,000-char memory block is the
  smaller half of what already ships. The review trigger changed with it — the
  risk at 50 is **instruction dilution, not cost**, and no token metric will
  show it; a dilution spike (pad to 40 rules, re-check adherence) should run
  before G ships.
- **Skills question answered** (§Rev 2.9): the migrated clean-cut flow **is** a
  real skill file and is editable in a packaged build (`extraResources`, not
  inside `app.asar`) — but edits need a restart (`clearSkillCache()` exists and
  is called by nothing) and the *workflow* half is still hardcoded in
  `studio-agent-prompt.ts`. Memory and skills are the same mechanism; memory is
  the user-facing one, skill editing is a developer affordance. Backlogged.
The open question was whether agent memory is worth building at all, so it got
tested before it got built. A throwaway harness (`.vidtsx-temp/`, gitignored)
drove `query()` with **the same options object `claude-provider.ts:151-174`
builds** — string systemPrompt, `settingSources: []`, a real in-process MCP
server — on `claude-opus-5`, against the real agent prompt + both real skill
files. 4 arms × 3 runs, all 12 clean.
**Injection works, decisively**: a one-line user rule ("never propose fluff
cuts") suppressed fluff in **9/9** runs where the baseline proposed 2 every
time (**3/3**); a note-format rule hit **36/36** vs the baseline's **0/13**.
It also *reduced variance* — the memory arm produced an identical cut-category
sequence all three runs where the baseline produced three different ones.
**Capture triggers correctly untuned**: `propose_memory` fired exactly once on
a general preference (**3/3**) and never on a one-off (**3/3**), even when the
one-off was the kind of pacing instruction that invites a mis-file.
**Citation is prose, not a signal**: the agent cites reliably (**9/9**) and
reads well, but mapping "your standing rule says never propose fluff" back to a
memory id is fuzzy matching — my own scoring regex, written against a known
fixture, missed a plainly-worded citation. So **`lastCitedAt` is cut**, and
with it the staleness-pruning story and M4's most dangerous cache rule.
**Verified in code, changing two design claims**: the Studio agent passes no
`sessionScope`, so `generate()` takes the ephemeral branch and every turn
already spawns and tears down its own claude.exe — `matches()`'s systemPrompt
check never runs, so accepting a memory mid-conversation costs exactly one
cache write (M4's stance holds, for a different reason). And the SDK exposes
**no** mid-conversation system message (`SDKUserMessage.message` is a
`MessageParam`); the real mechanism is `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`,
recorded and deliberately not taken. A string `systemPrompt` is passed
verbatim with no SDK preamble, so M4's caching premise is sound — but
`composeSystemPrompt` appends skills *after* base, so **memory must be appended
last** or every edit re-writes 10.5 KB of skill text out of cache.
**Cut from G**: `lastCitedAt`, brand-scope UI (field + pure filter stay, so
there is never a migration), the Assets memory section (→ one Studio dialog —
memory is app state, not library content, by M7's own argument), the
"replaces →" picker, profile-as-list. **Fixed**: budget 2000 chars vs cap 40
rules never fit (~3,200 chars of rules) → **4000 / 25**, with a stated review
trigger.
**Phase H's premise moved**: `CustomProviderForm` lets users create
`openai-compat`/`anthropic-compat` providers, so **both compat engine paths
ship whether or not the `openai` preset is hidden** — hiding narrows the
*supported* surface, not the reachable code (new H5 decides this on purpose).
H2's rule is now one line: **filter `presets`, never `providers`** — the local
filter at `llm-handlers.ts:32-38` drops saved configs too, which is right for
`local` and exactly the bug to avoid here. Second stranding vector named:
per-project `settings.agent.providerId` can leave the Inspector select blank
while the project keeps sending that provider every turn.

### Studio — L2/L7 LIBRARY DESCRIBE + ORGANIZE (2026-08-16)
**Status: DONE — per ASSET_LIBRARY_DESIGN.md §L2 + §L7, CDP-verified end to
end INCLUDING a real vision batch, a real organize pass, and a real
hash-heal.** The slice is built around **L7 Rev 2's move-safety rule**, not
around the move plan.
**THE RULE**: a Studio project references library files IN PLACE by absolute
path, and the hash-heal only runs on project OPEN — so moving a file out from
under a live session breaks it until the next open. Organize therefore never
proposes assets the currently-open project references; they return as
`skipped` ("in use, close the project to move"), **not** as rejected
proposals, because nothing about the suggestion was wrong — only its timing.
The exclusion is keyed by **rel path AND content hash**, so a project whose
stored path already went stale still pins the bytes. Enforced **twice**: at
suggest, and again at APPLY, since the user can open a project between
reviewing a plan and accepting it and the renderer is not the authority on a
safety rule. A skipped asset does **not** reserve its destination against
another move.
**Confirmed already-shipped, deliberately not rebuilt**: the hash-search half
(`studio-handlers.ts:211-228` → `healed` folded in at `useStudioMedia.ts:169`),
manual description editing, and the index re-key — `scanLibrary` already
re-keys a moved file by hash and carries its description
(`library-reconcile.ts` pass 2), so `applyMoves` is `fs.rename` + ONE re-scan
rather than a second, divergent re-key implementation.
**Knowing what's open** crosses a feature boundary (`asset-library` and
`studio` must not import each other), so it lives in a renderer-level
`OpenProjectContext` (ToastContext precedent): Studio publishes, Assets
reads. Screens stay mounted, so a project stays genuinely open while curating.
**Descriptions (L2)**: vision call on the **app-default provider** (curation
has no project context — a fixed rule). Batch describe copies the media-job
engine — broadcast stream, per-item progress, concurrency 3, **per-item
failure isolation** (one bad PNG fails one asset, never the batch). Batch
**fills gaps, never overwrites** an existing description. Auto-describe on
import is ON for library imports only; project footage goes through the
Studio media pool and never reaches this path. The one-time consent (Rev 2)
is enforced **in main** — a batch is refused until it exists. No provider
(Rev 3) is a first-class state: both AI buttons disable with an explaining
tooltip, a dismissible note says why descriptions and folders matter, and
manual descriptions keep working. Availability re-probes on window focus and
on Refresh — this screen never unmounts, so a provider configured later in
Settings would otherwise stay invisible until restart (found while driving
the app; fixed in this slice).
**Modules**: `library-prefs` (consent/dismissal/import default, read straight
from the settings KV like `library-paths` — settings.ts is a parallel
workstream), `describe-availability`, `describe-asset`, `describe-job`,
`organize-plan` (PURE — the in-use rule lives and is tested here),
`organize-suggest` (prompt + tolerant parse, pure), `organize-run` (the LLM
call), `organize-apply` (disk moves, split out so they carry none of the
provider import chain), `library-ai-handlers`, and 6 IPC channels.
**Tests +55 → 683 total** (in-use exclusion by path and by hash, skipped ≠
destination-reserving, protected `brands/` and `.vidtsx/`, collisions and
no-ops discarded, real disk moves + re-key with the description carried and
NO tombstone, apply-time refusal, describe failure isolation, cancel,
non-image filtering, dedup, no-provider degradation, tolerant plan parsing).
Type baselines 26/22 exact. Of the updater session's dirty files only
`channels.ts` and `electron.d.ts` were touched, staged as HEAD+my-lines blobs.
**Live CDP proof**: consent dialog → real batch described 3 assets in ~7 s
with genuine "what it is + how to use it" one-liners → manual edit persists →
moved a library file behind the app's back (`captures/learnwithhasan.com/` →
`Logos/`) → opening **"Shots core test"** HEALED the path by content hash with
no picker → Organize **with that project still open** proposed 2 free moves
and SKIPPED the healed in-use asset with the exact label → rejected one move,
applied the other: file moved on disk, index re-keyed, the hand-written
description survived, no new tombstone → cleared the default provider and the
note + disabled buttons appeared while manual descriptions still saved →
provider config restored byte-identical.
**Note on the test project**: "Shots core test" is the project that references
a library asset in place; "Auto Cut Test" only points at media outside the
library, so it cannot exercise the skip.
**Reusable test state**: the library now carries a deliberately misfiled
in-use asset at `Logos/build-real-products-with-ai-vibe-enginee.png` (pinned
by "Shots core test" — re-run Organize with it open to re-prove the skip),
`captures/example.com/example-domain-shot.png` (moved by a real organize
apply, hand-written description), and `claudecode-color-2.png` at the root
(a rejected move). Describe consent is now granted on this machine.
Known limits (deliberate): organize reads at most 400 assets per pass, one
pass with no retry, and describe covers images only (the vision attachment
carries nothing else). **Ambient nudges stay v2, as designed.**
NEXT per roadmap: remaining library polish (L4/L5 agent-facing search) or the
V1 release walkthrough — see V1_RELEASE_PLAN.md.

### Studio — D14 CREATOR IMPORT (2026-08-16)
**Status: DONE — per TSX_SHOTS_DESIGN.md §D14 Rev 1 + PACKS_DESIGN.md
"tsx-template", CDP-verified end-to-end INCLUDING a real export.** The slice is
ONE source-agnostic accept path: `importShot({projectId, sourcePath, name?,
conform?})` (`main/services/studio/shot-import.ts`) takes a SOURCE FILE + a
DISPLAY NAME, copies it to `shots/<id>/v1.tsx`, runs the EXISTING gate
(`validateShotCode` = transpile + react/remotion lint + compositionConfig
parse — imports still require the config, D13's opt-out is captions-only) and
returns a ready entry. Callers are thin and interchangeable: the Creator picker
(`creator-projects.ts` scans `getProjectsDir()` for folders of `v*.tsx` →
name/updatedAt/latest version, newest first, parameterized root for tests), the
OS file picker (no `sourcePath` → main opens the dialog), and later a
tsx-template PACK folder — which is why the service never learns the Creator
exists (PACKS_DESIGN.md's door, the caption-loader precedent).
**Registry shape**: `origin: { by: 'user' }`, kind `cutaway` (an imported comp
is a standalone full-frame piece), config snapshot from the source, and NO
stored `prompt` — so Regenerate is correctly disabled ("No stored brief to
regenerate from") while Edit works unchanged. Adoption reuses the SHOT JOB
STREAM: the bus moved out of the generator into `shot-job-events.ts` (both
services publish; op gained `'import'`), so the renderer folds imports through
the same `shots-adopt` path with zero new machinery. Imports land in the pool
only — the user places them (no recorded playhead, so no handshake race).
**Conform-on-import (the allowlist gap)**: `classifyShotImport` (pure, shared)
splits out-of-allowlist imports into CONFORMABLE (chroma-js,
@remotion/shapes|paths|transitions, @remotion/google-fonts, tone — subpaths
included) vs BLOCKING (relative/absolute paths, unknown packages), and refuses
to offer conversion when a blocking import or a non-import lint error rides
along, or when the file doesn't even transpile — never burn an LLM run that
can't succeed. A conformable failure writes NOTHING and returns a pointed error
+ `conformable: true`; "Convert for Studio" re-imports the same source with
`conform: true`, which reserves the folder, writes the untouched `original.tsx`
FIRST, runs ONE `editTsxPipeline` pass whose validate dep is the same gate, and
writes v1 only if it passes (`original.tsx` is not a `v<n>.tsx`, so the version
scan, preview and export copy all ignore it).
**Tests +26 → 628 total** (conformable/blocking/dedup/dynamic-import
classification, otherErrors gating, failure-message wording, conform
instruction, name derivation incl. `v3.tsx` → folder name, Creator scan
ordering/latest-version/skips, folder collision → `-2`, original.tsx
preservation, imported-shot snapshot has no prompt/anchor/assetRefs). Type
baselines 26/22 exact. Of the updater session's dirty files only channels.ts
and electron.d.ts were touched (additive, staged as HEAD+my-lines blobs).
**Live CDP proof (Auto Cut Test, 1280×720, captions ON with core/word-pop +
brand Acme Test)**: picker listed both seeded Creator projects with the LATEST
version (clean-orbit → v2, sorted by mtime) → importing clean-orbit produced a
ready `cutaway` shot in ~1 s whose `v1.tsx` is BYTE-IDENTICAL to the Creator's
v2, placed on O1 and painted in the Player → importing shapes-badge (imports
@remotion/shapes + @remotion/google-fonts/Inter + chroma-js) wrote no files and
showed the pointed error with the Convert action → Convert ran ~20 s and passed
the gate: the triangle became an inline `<svg>` path, chroma-js a small hex
mixer, the font a `"Inter", system-ui` stack, compositionConfig untouched, and
`original.tsx` byte-identical to the source → Regenerate disabled / Apply edit
worked on the imported shot ("deep blue background" → v2, preview updated) →
**Export → Done**: ffmpeg frames at 1.5 s and 9.5 s of the rendered mp4 contain
the imported shot pixels, with the live caption line painted over the first —
imported shots and D13 captions coexist through the D6 copy path.
Reusable test state: Creator projects `clean-orbit` (v1 draft + v2 real) and
`shapes-badge` (allowlist-gap source) under the Creator projects root; Auto Cut
Test now carries both imported shots.
Known limits (deliberate): imports are always `cutaway` (no kind picker), one
conform pass with no retry ladder, conversion can shift the look, and a failed
conversion leaves an error shot the user deletes. V2 ledger unchanged: the
widened import surface (module-server import-map so shots import the Creator 2d
allowlist natively) and "open shot in Creator editor". NEXT per roadmap:
**library describe/organize (L2/L7)** — the L7 organize-skips-open-project rule
is real new scope.

### Studio — D13 CAPTIONS (2026-08-15)
**Status: DONE — per CAPTIONS_DESIGN.md (C1–C4) + PACKS_DESIGN.md, CDP-verified
end-to-end INCLUDING a real export.** Captions are **live props-derived, never
baked**: the serializer derives the word stream from the MASTER LANE at
serialize time and passes it through D12's runtime-props channel, so cutting
the master re-derives on the next serialize and nothing can desync (the D7 bake
stays what it is — a 3-second title mechanism).
**Document (C1)**: `captions?: StudioCaptionLayer` on the project
(`shared/types/studio-captions.ts` — a sibling file because the template props
are a PUBLISHED contract for pack authors); one layer, whole master lane,
absent field = no captions (no schema bump, shots-field precedent).
`normalizeCaptionLayer` on load clamps scale/wordsPerGroup/position, drops a
layer with no templateId, and **keeps an uninstalled templateId on purpose**
(reinstalling the pack must bring the captions back). The layer joined the
reducer's undoable `EditDoc` beside timeline/proposals/shots — apply / style /
disable / remove are each ONE undo step (`services/caption-ops.ts`,
identity-on-reject). Writing back deletes the field rather than storing null.
**Derivation (C2, `shared/studio/caption-words.ts`)**: master lane = the
BOTTOM-most video track with clips (new visual lanes stack on top), falling
back to the first audio lane with clips for voice-over projects. Per clip:
slice words to the visible source window (a word belongs when it STARTS inside
it), clamp ends, re-base to timeline seconds through `speed`, concat in
timeline order. Gaps simply have no words; untranscribed clips contribute
nothing and are surfaced as "N clips have no transcript". Grouping breaks on
`wordsPerGroup`, on punctuation, on pauses > 0.6 s, and NEVER across a clip
boundary.
**Pack-shaped loader (C3 Rev 2 + PACKS_DESIGN.md)**: the built-in ten ship as
ONE pack at `resources/caption-templates/core/` (`pack.json` + `manifest.json`
+ ten `.tsx`), and the loader ALSO scans `packs/` in the assets root, so a
purchasable pack is a folder drop with zero loader changes
(`main/services/studio/caption-packs.ts`, `scanCaptionRoots(builtIn, installed)`
for testability). `templateId` is namespaced (`core/word-pop`) and that is what
the document stores; duplicate pack id → whole pack skipped, first root wins;
corrupt pack / ghost template / wrong type → skipped with a warning; a missing
pack degrades gracefully everywhere. Manifest defaults are per-aspect style
SEEDS (scale + wordsPerGroup only — fields with no home on the document are
dropped, so a pack can't seed what the style can't hold).
**Rendering**: the serializer emits ONE synthetic `kind: 'caption'` track FIRST
(painted last = over everything) carrying `tsx.props.captions` = `{ groups,
style, palette }`; `ShotRuntimeProps` gained the `captions` member (one props
transport, no parallel mechanism). `TimelineComposition`'s dead `'caption'`
case now renders the supplied `captionComponent` (absent → null). Palette
resolves brand-or-override BEFORE the template sees it (templates never read
the brand system; same react+remotion-only lint as shots, with
`requireCompositionConfig: false` — an overlay has no length of its own).
`referencedShotIds` skips caption clips (its shotId is a template id).
**Export (D6 pattern)**: `loadCaptionContext` reads the master lane's
transcripts from the project cache + the active brand, the template file is
validated/font-rewritten/copied beside the shot copies, and the entry imports
it as `captionComponent`. A missing pack or a stale brand logs and exports
without captions — never a failed render.
**UI (C4)**: toolbar "Captions" entry + a third right-panel tab; gallery cards
are tiny lazy-mounted (IntersectionObserver) Players running the REAL template
over the manifest's sample words; position / size / words-per-group /
UPPERCASE / brand-colors toggle with a custom override.
**Tests +62 → 602 total** (derivation windows/re-base/speed/concat/gaps/
untranscribed, grouping breaks, master-lane pick, layer normalize + palette
resolution, pack parse/namespacing/traversal-refusal/defaults, loader
discovery/collision/ghost/corrupt/missing-root + the shipped core pack loads
with all ten, serializer emission present/absent/disabled/re-derive/not-a-shot,
caption reducer actions incl. undo/redo round-trip). Type baselines 26/22
exact. Of the updater session's dirty files only channels.ts, electron.d.ts and
electron-builder.yml were touched (additive blocks, staged as HEAD+my-lines
blobs — audit the diff, and decode git output as UTF-8 or em-dashes mojibake).
**Live CDP proof (Auto Cut Test, 1280×720, 69-word transcript, 11 master
clips)**: gallery listed all ten from the pack with animated cards → applying
Word Pop showed captions at the playhead and "58 words from the master lane"
(the EDIT's words, not the transcript's 69) → ripple-deleting the first master
clip re-derived to 53 words and a different line at the SAME timeline second
("AutoCut test." → "it flows naturally") → apply/undo/redo round-tripped →
selecting brand "Acme Test" repainted the live word from fallback amber/Inter
to the brand accent in Georgia → **Export → Done**: the entry's TIMELINE
carries 21 groups / 58 words + the resolved brand palette, the copied template
file sits beside it, and ffmpeg frames at 2.1 s and 4.23 s contain the caption
pixels matching what the preview showed at the same second. Missing-pack
degrade proven by pointing the document at `bought/neon`: project opened, panel
warned, no captions painted, layer preserved, and picking an installed style
recovered it. One export attempt failed with a Remotion compositor
"No frame found at position …" seek error; re-running with captions ON
succeeded, so it is the known compositor flake, not the caption layer.
Known limits (deliberate): one layer per project, no per-region captions, no
caption text editor (fix the transcript, captions re-derive), crossfade
overlaps interleave briefly, no store/pack-manager UI (folder drop is install
v1). NEXT per roadmap: **D14 Creator import** (TSX_SHOTS_DESIGN.md §D14 — keep
the import service source-agnostic; it doubles as the tsx-template pack door),
then library describe/organize.

### Studio — D12 MEDIA INSIDE SHOTS (2026-08-14)
**Status: DONE — per TSX_SHOTS_DESIGN.md §D12 Rev 2 + ASSET_LIBRARY_DESIGN.md
§L5/§L6, CDP-verified end-to-end INCLUDING a real export.** The serializer
grew a GENERAL runtime-props channel (D13 captions rides it next):
`SerializedClip.tsx.props?: ShotRuntimeProps` (`shared/types/studio.ts` —
extensible object, `assets` is its first member), resolved through the SAME
`AssetUrlResolver` as clip src (module-server proxies in preview, bundle
server :3100 at export — the entry needs zero template changes, props ride
the serialized TIMELINE). **Missing/unresolvable ref → clip drop**, the
missing-src rule. `ClipRenderer` spreads `clip.tsx.props`; `useShotModules`
wrappers/placeholders became props-forwarding (`ShotComponent =
ComponentType<ShotRuntimeProps>`). **Registry**: `assetRefs?:
Record<key, projectAssetId>` on `StudioShot`, sanitized in `normalizeShots`
(malformed map stripped whole), carried through `foldShot` (which silently
dropped unknown fields — extended), the generator's provisional/saved
snapshots, `StudioShotGenerateRequest`, and the regenerate button
(`ShotClipSection` passes `shot.assetRefs`). **Import-on-use seam**
(`services/studio/shot-asset-refs.ts`): tool-side ref values are project
asset ids OR `library:<relPath>`; library values import on use via
`importMediaFiles` (probe/thumbnail/hash, referenced in place, index
description carried into new `StudioMediaAsset.description`), idempotent by
normalized path then content hash; imported assets ride
`StudioShotJobEvent.importedAssets` on the FIRST generating event →
`useShotJobs.onImportedAssets` → EditorShell merges id-keyed into
project.assets. Library NEVER appears in project.json (paths point into it,
referenced in place — by design). **Prompt contract**:
`buildShotExtraInstructions` gained `assets` ("## Media assets (MANDATORY
usage)" — typed `{ assets }` prop, per-key table with dims/duration/
description, never a path/staticFile; brand+WORDS coexistence pinned).
**Agent surface** (studio-agent.ts): `generate_tsx_shot` gained `assetRefs`
(zod 4: `z.record(z.string(), z.string())` — single-arg is a compile error);
NEW `generate_image` (wraps imageEngine active provider, files into
`generated/` via new `library-filing.ts` slug/reserve helpers, born-managed
`origin: 'generated'`, prompt = description, ACTIVE-BRAND AUTO-TAG via
project.settings.brandId with stale-id degrade, bills new `featureSource:
'studio-shot-asset'`, additive/no proposal); NEW `capture_webpage`
(`services/library/capture.ts`: hardened hidden BrowserWindow — sandbox,
per-capture in-memory partition, ALL permission requests denied,
window.open denied, muted, 2× render via zoomFactor+double-size window,
settle delay, full-page = tall window capped 8000px physical; files
`captures/<domain>/<title-slug>.png`, description "title — URL"). **Visible
capture mode** for auth walls: window shows, main pushes
LIBRARY_CAPTURE_EVENT 'pending' → `CaptureChip` (app-root fixed chip, CDP-
drivable) → LIBRARY_CAPTURE_TRIGGER capture/cancel resolves it; 5-min
walk-away timeout. **Library store** gained `upsertEntry` (reconcile only
mints origin 'imported'; born-managed content enters here with hash/size/
mtime bookkeeping so the next scan keeps it — pinned by test).
`StudioAgentAssetInfo` + prompt asset lines gained `description` (Rev 2).
Of the updater session's dirty files only channels.ts + electron.d.ts were
touched (additive capture-channel blocks, staged as HEAD+my-lines blobs).
**Tests +32 → 540 total** (serializer ref resolution + missing-ref drop +
empty-refs, normalizeShots sanitize, prompt assets section, upsertEntry
CRUD/rescan-survival/traversal, filing slug/domain/description/reserve
collision, parseLibraryRef/refKey/matchExistingAsset idempotency/
buildPromptAssets audio-reject). Type baselines 26/22 exact. **Live CDP
proof (Shots core test)**: agent turn "capture learnwithhasan.com → cutaway
using it → propose" ran all three tools (labels in AgentPanel); capture
filed `captures/learnwithhasan.com/build-real-products-with-ai-vibe-enginee
.png` (2560×1440 crisp 2×, index entry origin 'captured' + title—URL
description); import-on-use put it in project.assets WITH description +
pool thumbnail; registry got `assetRefs: { screenshot: <project-id> }`;
generated v1 (claude-opus-5, 50s, 0 fix loops) destructures `{ assets }`
and renders `<Img src={assets.screenshot}>`; review panel → Preview shot
showed the REAL screenshot on a branded card in the Player; Place 1 shot →
clip at 6s on V1; **Export → Done**: entry TIMELINE carries
`props.assets.screenshot` as a :3100 bundle URL, ffmpeg frame at 8s of the
rendered MP4 contains the screenshot pixels + brand-amber caption.
Visible mode proven: example.com visible capture → chip appeared → CDP
clicked "Capture now" → `captures/example.com/example-domain.png`.
generate_image proven wired with graceful error (local SD registered but
sd-cli not installed — no BYOK image key on this machine; its filing path
is shared with capture + unit-tested). Leftovers kept deliberately: the two
captures in the library, "Site showcase" shot placed at 6s in "Shots core
test" (D13/D14 test state). Known limits (deliberate): scroll-and-stitch
over-cap fallback not implemented (cap captures top 8000px); no gate check
that generated code only references provided asset keys (prompt-enforced;
the model added a dead staticFile fallback once — harmless, serializer
drops unresolvable refs before render); `search_assets` still deferred to
library slices; MediaPool "Add from library" picker + library-screen
Capture button land with the library UI slices (the seam is the service).
NEXT per roadmap: **D13 CAPTIONS** (CAPTIONS_DESIGN.md, implementation-
ready — rides this props channel), then D14 Creator import, then library
describe/organize.

### Studio — D11 BRANDS (2026-08-14)
**Status: DONE — brands slice per TSX_SHOTS_DESIGN.md §D11 Rev 2 +
ASSET_LIBRARY_DESIGN.md §L3 Rev 3, CDP-verified end-to-end with a REAL
Claude-subscription regenerate.** App-level MULTIPLE brands at
`brands/<slug>/brand.json` inside the assets root (folder-as-truth; the
folder slug IS the brand id, reserved via `reserveProjectFolder` so name
collisions get `-2`). **Shape** (`StudioBrand`, shared/types/asset-library):
name, palette (primary/secondary/background/text/accent — CSS colors,
breakout-char-rejecting lenient validation in `shared/studio/brand.ts`),
fonts (display/body family names), logoRefs (library relPaths, consumed in
D12 — UI is a comma-list input), styleNotes (≤2000 chars, injected
verbatim). **Store** (`services/library/brand-store.ts`): CRUD against an
explicit root (temp-dir testable), atomic tmp+rename writes, corrupt
folders skipped on list, traversal-guarded ids. `defaultBrandId` in
`brand-default.ts` straight through settings-db (`studioDefaultBrandId`) —
settings.ts NEVER touched (owned by the parallel updater session; the
assetsRootOverride precedent). **Default copy at creation**:
`createProject` gained optional `brandId`; the create handler resolves the
default and validates it still exists (stale → copies nothing) — explicit
snapshot, changing the app default never restyles existing projects;
`migrateProject` spreads settings wholesale so brandId survives round-trips
(pinned by test). **Generation contract**: `buildShotExtraInstructions`
gained `brand?` — "## Brand: <name> (MANDATORY styling)" block with palette
tokens (background line flips cutaway-use vs overlay-reference), fonts as
CSS family stacks ("'Georgia', 'Segoe UI', sans-serif" — shots lint is
react+remotion ONLY, so no @remotion/google-fonts inside shots; uninstalled
Google fonts fall down the stack — v1 limit), style notes verbatim.
`shot-generator.generate()` reads `project.settings.brandId` from
project.json (like width/height/fps — agent tool AND pool button get it
with zero plumbing), `readBrand` degrades stale ids to unbranded with a
warn. Edits inject nothing (no prompt-context channel in editTsxPipeline) —
"apply the (new) brand" IS Regenerate, per the answered design. **IPC**: 4
channels (LIBRARY_BRANDS_GET returns brands + validated defaultBrandId,
BRAND_SAVE create/update, BRAND_DELETE clears a pointing default,
BRAND_DEFAULT_SET validates existence); of the updater session's dirty
files only channels.ts + electron.d.ts were touched (additive blocks,
staged as HEAD+my-lines blobs via hash-object/update-index). **UI (lean)**:
Assets toolbar "Brands" button → BrandsDialog (rows with 5 palette
swatches, fonts line, DEFAULT badge, set/unset default, edit, delete-with-
confirm; BrandForm with live swatch previews and shared-validator inline
errors); MediaPool Shots section "Brand" Select (No brand / brands /
"<id> (missing)" for stale) → non-undoable settings edit through
updateProject, the sttModelId pattern. studio-make-tsx SKILL.md gained a
Brand section (don't restate colors in briefs; regenerate to restyle).
**Tests +24 → 508 total** (validator table incl. CSS-breakout rejection,
normalize round-trip, store CRUD/slug-collision/corrupt-skip/traversal,
prompt-block snapshot incl. background flip + font fallback + WORDS
coexistence, createProject copy + migrate carry). Type baselines 26/22
exact. **Live CDP proof**: Brands dialog → "Acme Test" (ocean palette,
Georgia) → brand.json on disk verbatim; Set default → badge; New Project →
project.json carries `brandId: acme-test`; picker pre-selected in the new
project; "Shots core test" switched to the brand (persisted); Inspector
Regenerate on the Counter overlay → ~3 min real pipeline → v2.tsx defines
`COLORS` = the EXACT five brand hexes + Georgia TYPOGRAPHY (values the
original brief never contained — injection proven), player shows the navy/
serif/amber look, pool card v2 · 5.0 s; screenshots taken. Leftovers kept
deliberately: brand "Acme Test" (assets root) + project "Brand Inherit
Test" for D12 testing. Known limits (deliberate): brand-scoped
`search_assets` behavior deferred to the library slices (index brandId tags
already exist), logos not embeddable until D12 assetRefs, no
palette-from-logo/interview skill (v2). NEXT per roadmap (extended with
Hasan 2026-08-14): D12 (assetRefs, generate_image, capture_webpage — now
explicitly building the serializer-props channel), then **D13 CAPTIONS**
(CAPTIONS_DESIGN.md — implementation-ready: ~10 curated TSX templates,
live props-derived word stream, brand-aware), **D14 Creator import**
(TSX_SHOTS_DESIGN.md §D14 — conform-on-import; small, can slot into any
gap), then library describe/organize.

### Studio — LEAN CANVAS MANIPULATION (2026-08-14)
**Status: DONE — the interaction slice scheduled right after shots UI
(2026-08-14 roadmap decision with Hasan; full rotate/crop/multi-select stays
in V2_FEATURES.md), CDP-verified live with real pointer gestures.** Select a
clip → bounding box + 4 corner handles over the Player; drag to MOVE, corner
drag for uniform SCALE (opposite corner anchored); click-in-player selects
the topmost painted clip. The document side (`StudioClipTransform`,
`update-clip`, transformStyle) was untouched — this is purely the
interaction layer. **Math is a pure service**
(`features/studio/services/canvas-transform.ts`, 22 unit tests): player-rect
→ composition mapping (`fitScale`/`playerPointToComp`), `clipBox` from the
transformStyle semantics (element center = comp center + x/y, box = comp ×
scale; the box is the ELEMENT — letterboxed picture and inspector-set
rotation deliberately not represented), `moveGesture` (round + clamp
±10000), `scaleGesture` (pointer projected onto the fixed diagonal, clamp
1%–1000% — the Inspector's exact ranges — anchor recomputed so it never
drifts), `hitTestClip` (serializer paint order: tracks[0] topmost, trailing
clip over leading through crossfade overlaps, visual kinds only, hidden
tracks skipped for free by using the serialization), and
`overrideClipTransform` (live-preview injection). **`CanvasOverlay.tsx`**
mounts via a new PreviewPanel `overlay` slot (absolute inset-0 over the
aspect box so its own rect IS the player rect, ResizeObserver-tracked);
window-listener drag (the PaneDivider pattern), rAF-throttled; box shows
only when ONE visual clip is selected AND the playhead is inside its span
AND the track is unlocked/visible AND the Player shows the real timeline
(`playerTimeline === tl.timeline` — hidden during Preview result; never in
an export by construction). **Undo discipline:** drags live-preview through
an ephemeral serialized override in EditorShell (zero reducer dispatches per
pixel — CDP-proven: inspector still read 0/0 mid-drag), ONE `update-clip` on
pointer-up; `updateClip`'s identity check makes no-op gestures free.
**PreviewPanel restructure:** the aspect box no longer clips (Player moved
into an inner rounded overflow-hidden div; the PANEL clips instead) so a
box dragged past the frame edge keeps its handles reachable over the
letterbox — beyond the panel (~16 px + letterbox slack) handles clip and the
Inspector numbers are the fallback (canvas zoom is V2). Box clicks are NOT
swallowed: a non-drag click inside the box falls through to the root
hit-test so a clip painted ABOVE the selected one stays click-selectable
(drag-end clicks guarded by a justDragged ref). **Live CDP proof (real
`Input.dispatchMouseEvent` gestures, shots-core-test + Test projects):**
box appears exactly over the frame for identity transform and matches
committed offsets; move drag (−40,−25) player px → inspector −101/−63 (the
predicted comp-px rounding, fit 0.3977); SE-corner drag to 70% → scale 70,
x −293 / y −171 (closed-form match), NW anchor drift 0.0 px; first Ctrl+Z
reverted ONLY the scale, second ONLY the move; picture followed live
mid-drag with the button still down; box absent for: audio clip (via detach
→ auto-selected A1 clip → undone), playhead outside span (two cases),
nothing selected; click-in-player switched selection V1 → topmost FX1
overlay per paint order. Gates green: 484 tests (462 + 22), type baselines
26/22. Known limits (deliberate, lean): no rotate/crop/multi-select/
snapping (V2), box ignores inspector-set rotation, handles unreachable past
the panel edge, overlay hit-box for tsx overlay shots is the full comp
element (transparent pixels included). NEXT per roadmap: D11 brands, then
D12 (assetRefs, generate_image, capture_webpage), then library
describe/organize.

### Studio — S4 SHOTS GENERATION (2026-08-14)
**Status: DONE — third S4 shots slice (D8 + D7 + D6 + D10 per
TSX_SHOTS_DESIGN.md Rev 4), verified live with REAL Claude-subscription
generation over CDP.** Main-side `shot-generator.ts` drives the shared
`generateTsxPipeline`/`editTsxPipeline` with the shot ACCEPTANCE GATE
injected as the pipeline's `tsxValidate` dep — esbuild transpile + the
react/remotion-only single-file import lint (`shared/studio/shot-lint.ts`)
+ a `compositionConfig` PARSE check — so a lint/config violation is a
fix-loop error the pipeline repairs, never the parser's silent 300-frame
default. Main writes ONLY `shots/<id>/v*.tsx` (+ debug sidecars +
`chat.json`); the registry lives in the renderer document via push events
(`STUDIO_SHOT_JOB_EVENT`) folded by `useShotJobs` through the
non-committing `shots-adopt` — an edit's version bump is the one undoable
dispatch (`shot-set-version`). **D8 agent path**: `generate_tsx_shot`
(one shot per call, 10-per-pass cap, refuses while a review is open) +
`propose_shots` (ONE `shot-plan` proposal, built by shared
`buildShotPlanProposal`, source-anchored items); `get_transcript` gained
`startSeconds`/`endSeconds`; skillIds now compose `studio-make-tsx` (new
folder skill: briefs/anchors/pass discipline/from-scratch) next to
clean-cut; system prompt carries the shots workflow + plan-cheap gate +
FROM-SCRATCH mode (Rev 4). `reviewOpen` is now KIND-AGNOSTIC
(`useTimeline.activeProposal` dropped its cut-plan filter;
`handleAgentProposal` and the reviews branch by kind; CutRegionLayer
renders for cut plans only). **D7**: anchored shots bake the anchor
span's words to shot-local seconds into the prompt (`shot-words.ts`,
marked WORDS block; anchor recorded on the shot; regenerate re-bakes).
**D8 pool path**: `STUDIO_SHOT_GENERATE` IPC (reservation handshake via
`onReserved`, then detached; ops generate/edit/regenerate) — playhead
recorded at click, clip lands there on ready as ONE undo step
(`shot-clip-insert` + `insertShotClip`), selected. **From-scratch rule**
(no footage anywhere): shots land on the MASTER lane as opaque cutaways —
proposals back-to-back in order, pool inserts too. **D6 export (the "tsx
renders as NOTHING" fix)**: `createExportEntry` pre-flights every
referenced ready shot (re-validate + lint + config parse → pointed error
BLOCKS the export), copies each source font-normalized
(`rewriteFontUrls`) into the entry temp dir as `studio-entry-*` (swept by
the same TTL), and emits static imports + a `SHOT_COMPONENTS` map passed
as `components` (emission helpers pure in `shared/studio/shot-export.ts`).
**D10**: MediaPool "Shots" section (status/progress/version badges, add
at playhead, delete, Generate form → pool path), `ShotClipSection` in the
Inspector (anchor readout, folder-scanned version picker via
`STUDIO_SHOT_VERSIONS`, edit box → editTsxPipeline, Regenerate, "Resize
clip to shot length" via trim), `ReviewShotsSection` (accept/reject +
"Preview shot" scratch-apply audition that derives the REAL landing spot
by running applyShotProposal on a scratch copy). 48 new unit tests
(import-lint allow/reject table, anchor→shot-local word math incl.
boundary/clamp/rounding, export emission for exactly the referenced ready
shots, proposal build + reducer apply/reject round-trips incl.
registry-drop-on-reject + restore-on-undo, from-scratch placement,
pool-insert). Gates green: 462 tests, 26/22 type baselines. **Live CDP
proof (real Claude subscription provider)**: pool Generate → provisional
card with streaming percent → ready in ~75 s → clip at the playhead on
the master lane (from-scratch), stat-card pixels in the Player with the
counter overlay compositing on top; inspector edit box ("42 → 99…") →
v2 in ~20 s with the edit visibly applied, undo/redo flips
activeVersion 2→1→2; agent chat → generate ("Thanks End Card") →
`shot-plan` proposal → ReviewShotsSection → audition plays the shot at
its future landing spot → "Place 1 shot" → clip at 3–6 s back-to-back,
origin {agent, proposalId}, proposal `applied` (and the open proposal
SURVIVED a full app reload mid-review); export prepare → entry with 3
static shot imports (active versions pinned, error shot excluded) +
components map + normalized copies; hand-corrupted shot (lodash import)
→ export BLOCKED with "Shot "Thanks End Card" (v1) failed export
validation: Import "lodash" is not allowed…"; full render queued and
completed to `studio-shots-core-test_*.mp4`. NOT in this slice: D11
brands, D12 assetRefs/generate_image/capture_webpage (next per design
order), bulk-pass live drill (unit-covered; needs a transcribed longform
project). Known wart: pool-path shot names are slugged briefs (no name
field in the pool form yet). NEXT per roadmap: lean canvas manipulation,
then brands/capture/curation.

### Studio — EDITOR ERGONOMICS (2026-08-14)
**Status: DONE — resizable panes + track-menu discoverability, requested by
Hasan after shots core; CDP-verified live through the real input pipeline.**
Three draggable pane dividers (`PaneDivider`, window-listener drag — the
Creator's ResizableDivider pattern; pointer capture dies the moment the
cursor leaves a 5 px strip): media pool width (160–420), inspector width
(220–460), timeline height (140–520). Sizes persist per machine via
`usePaneSize` → localStorage `studio.pane.*` (deliberately NOT settings KV
or the document — it's window state); defaults match the old fixed layout
exactly. Track options were *functional but invisible* (right-click worked
only on the narrow header cell — verified live, not a bug): now a kebab
(⋮) button on each header (hover-revealed) opens the same menu, AND
right-clicking empty lane background opens it too (`onLaneContextMenu` →
TimelinePanel-owned FloatingMenu; menu items unified in
`services/track-menu.ts` so header + lane can't drift; lane-menu Rename
forwards to the header's inline editor via a `renameRequested` prop).
`TimelinePanel` takes `heightPx`. Live proof (real
`Input.dispatchMouseEvent`): timeline 240→300→400 by drag, pool 230→290,
both restored after reload from localStorage; kebab menu opens; lane
right-click menu opens; Delete removes the track and Ctrl+Z restores it
(4→3→4). Gates green (414 tests, 26/22). **CDP harness gotcha learned: a
`Page.reload` kills `Input.*` event routing on that WebSocket session —
reconnect after every reload or synthetic input silently no-ops.**
**Roadmap decisions recorded this session (with Hasan):** (1) lean canvas
manipulation (move/scale clips directly in the Player) scheduled right
after shots UI D10 — full rotate/crop/multi-select in V2_FEATURES.md; (2)
D8 gains a from-scratch mode (TSX-only videos, no raw footage) — Rev 4
note in TSX_SHOTS_DESIGN.md; full generative end-to-end (image/video
models + TTS + SFX) ledgered in V2_FEATURES.md.

### Studio — S4 SHOTS CORE (2026-08-14)
**Status: DONE — second implementation slice of S4 TSX shots
(TSX_SHOTS_DESIGN.md D1/D4/D5/D9), CDP-verified live.** The document grew
the shot registry: `StudioShot` + required `StudioProject.shots[]`
(normalized to `[]` on load — no schema bump; `migrateProject` would
otherwise DROP the field, it rebuilds from an explicit list), and
`StudioClipTsx` reshaped to `{ shotId, mode }` (the `filePath` stub is
gone; nothing ever wrote it). **D5 contract**: `SerializedClip.tsx
{ shotId, mode }`; serializer drops tsx clips whose shot is missing or not
`ready`; tsx clips carry real `sourceIn`/`trimBefore` semantics applied by
`ClipRenderer` as a nested `<Sequence from={-trimBefore}>` — and for tsx
the crossfade-in shift is NOT clamped at 0 (negative offset keeps the
shot's frame 0 anchored at the original boundary so baked timings can't
fire early). **D4 preview**: `STUDIO_SHOT_MODULE` IPC
(`{projectId, shotId, version}` → `{moduleUrl, config}`; path authority in
main via `getShotVersionPath` with shot-id validation; `transpileTsxCached`
+ module server, content-hash URL = automatic re-import on version bump),
renderer `useShotModules(projectId, shots)` (loads every ready shot's
active version, `setupVirtualModuleGlobals()` before first import,
`shotId@version` cache), each component wrapped in `ShotErrorBoundary` +
labeled placeholder — preview supplier only, per design. **D9**: `EditDoc`
grew `shots` (commit identity check, `proposal-apply` literal, reset,
EMPTY_DOC, write-back all carry it); actions `shot-set-version` (undoable
pointer flip), `shot-remove` (registry entry + referencing clips, ONE undo
step, files stay on disk), `shots-adopt` (non-committing: rewrites
past/present/future so a background generation completing neither plants
an undo step nor gets wiped by one); reconcile-on-open flips crash-stuck
`generating` → `error` in `normalizeShots` (shared/studio/shots.ts, used
by main's migrate). Also: `clipFromShot` in clip-factory (`sourceIn: 0` is
load-bearing for split continuity). New files: `shared/studio/shots.ts`,
`main/ipc/studio-shot-handlers.ts`, `features/studio/hooks/useShotModules.ts`,
`features/studio/components/ShotErrorBoundary.tsx` (class — the sanctioned
boundary exception), `features/studio/services/shot-ops.ts`. 21 new unit
tests (normalize/reconcile matrix, tsx serialize incl. negative-trimBefore
crossfade case, shot ops + reducer round-trips incl. shots-adopt history
rewrite). Gates green: 414 tests, 26/22 type baselines. **Live CDP proof**
(seeded `shots-core-test` project, frame-counter shot): shot renders in
the Player frame-synced (playhead 1.00s → counter 30); `sourceIn: 2` clip
shows 90 at 6.00s (offset mechanics); a REAL UI split at 2s produced a
right half that continues (90 at 3s, `sourceIn: 2` persisted — restart bug
would read 30); stuck-`generating` shot flipped to `error` in the saved
doc and its clip dropped from preview while staying on the timeline; a
runtime-throwing shot rendered the labeled placeholder with the app fully
alive, and recovered after fix + reopen. NOT in this slice (say-so per
plan): D8 generation/proposals/`studio-make-tsx` skill/pool button, D7
word-sync bake, **D6 export wrapper + pre-flight — a tsx clip currently
renders as NOTHING in an export** (entry passes no `components`), D10
pool/inspector shot UI, D11 brands, D12 assetRefs props channel — next
slices per the design order.

### Studio — S4 LIBRARY CORE (2026-08-14)
**Status: DONE — first implementation slice of the S4 asset library
(ASSET_LIBRARY_DESIGN.md L1/L2-manual/L4/L7-relink), CDP-verified live.**
The Assets screen (existing `asset-library` feature) now carries the index
overlay: `<assetsRoot>/.vidtsx/index.json` (disk-as-truth, dot-folder kept
out of the grid), entries keyed by POSIX relPath with `hashFileHead`
content hashes — new files gain entries, Explorer-moves re-key by hash
(description survives, proven in tests + live), deletions tombstone for
7 days and resurrect on re-import of the same bytes. Manual descriptions:
right-hand details panel (type/size/origin/added/path + textarea, saved on
blur, optimistic with rollback). Search over name+description with type
chips (All/Video/Audio/Image/Other) — breadcrumb is the scope, root =
whole library; sizes per folder (tile subtitles) + footer totals, cached
with invalidation on index writes. Assets-root settings override
(`assetsRootOverride` in the settings KV; `library:root:get/set` IPC —
read via settings-db directly, NOT settings.ts, which the parallel updater
session owns; fold a typed accessor in later). **L7 move-safety rule
shipped**: `studioMediaPrepare` now hash-searches the library for missing
sources and heals paths silently (renderer merges via `healed[]`; manual
picker stays the fallback). New: `src/main/services/library/*` (paths,
pure reconcile, store, sizes), `library-handlers` + registration, preload
`libraryApi`, `shared/types/asset-library.ts` (NOTE: `types/library.ts`
was already taken by the Creator project library), renderer
`useLibraryIndex`/`AssetSearchBar`/`AssetDetailsPanel`/`asset-search`.
19 new unit tests (reconcile matrix, store+sizes on temp dir with
Explorer-move + stale-index heal, search filters). Gates green (393
tests, 26/22 type baselines). NOT in this slice (design order): describe
jobs + no-provider nudge, brands, capture, organize, origin/brand filter
chips, probe backfill — next slices per the design docs.

### Studio — S4 TSX SHOTS: DESIGN REVIEW OPEN (2026-08-14)
**Status: DESIGN WRITTEN, AWAITING HASAN'S REVIEW — no implementation.**
`docs/studio/TSX_SHOTS_DESIGN.md` (same pattern as TRANSITIONS_DESIGN.md):
decisions D1–D10 with options + recommendations and an inline-answerable
checklist. Core recommendations: `shots[]` registry in the document with
clips referencing `shotId` (replaces the `filePath` stub — safe, no tsx clips
shipped); cutaways cover from an upper lane (never displace the master);
title = word-synced overlay skill category; preview via live in-renderer ESM
modules sharing the app's React/Remotion (error-boundary containment); export
via static shot imports in the generated entry (react+remotion import
allowlist, pre-flight validation); baked shot-local word timings + recorded
anchor for regenerate re-sync; generate-then-propose `shot-plan` proposals
through the existing audit gate; per-shot `activeVersion` for edit/regenerate
round-trips. One implementation spike flagged: confirm the bundler's TSX rule
compiles files outside the app path before locking the entry shape.
Implementation starts after review.

**Rev 2 (same day, after live discussion with Hasan):** D5/D7/D8 amended
(shot asset props resolved by the serializer, bulk shot passes with a
chat-plan gate + 10-shot cap, brand/asset injection into generation);
D11 brands + D12 media-in-shots added (checklist now 13 items). Two new
docs: `docs/studio/ASSET_LIBRARY_DESIGN.md` (disk-as-truth library +
index.json, AI describe/organize behind the audit gate, brands with
default, search/filter/sizes, web capture via hidden Electron window —
no Playwright; checklist L1–L8) and `docs/studio/V2_FEATURES.md` (parked
ledger: screen capture, optimize/compress, local fonts, fake-screencast
port, props-driven word sync, …). Scope decision: v1 = full library +
professional TSX generation; web capture only (screen capture v2).
Implementation order: library core → shots core → brands/capture/curation.
UX walkthrough artifact published (claude.ai). Both design docs awaiting
Hasan's checklist answers.

**Rev 3 (same day, after adversarial grill — self-review + blind
code-review agent, at Hasan's request):** 8 substantive findings fixed
across both docs. Headline: the D4 preview "in-renderer precedent" was
dead code (webview path is the only exercised consumer; packaged builds
load file:// with webSecurity on) → **Spike 0** (packaged-build ESM import
into an in-app Player) now runs FIRST and gates the preview architecture,
bake-to-proxy promoted to named fallback. Also fixed: tsx clips gain
sourceIn/frame-offset semantics (split restarted the animation; a
crossfade-in shifted baked word timings by the extension); shot proposal
items are source-anchored, renderer-mapped (frozen timelineStart was
stale-by-design and main has no timeline); reject keeps files (no file
deletion under any undoable action); reviewOpen goes kind-agnostic (one
open proposal across all kinds); export pre-flight copies +
font-normalizes shot sources (wrapper only rewrites the entry file);
shots↔EditDoc/undo integration enumerated (generation completion is
non-committing); library relink-by-hash re-scoped as NEW work (today's
relink is a manual picker), hashFileHead pinned as the shared algorithm,
organize skips in-use assets; capture hardened (tall-window capture,
permission/window.open denies); library deletion policy + describe consent
added. Verified good news: Remotion's webpack .tsx rule has no
include/exclude — out-of-root shot files compile (spike closed by reading
the shipped config; superseded by the copy step anyway). Docs now at
TSX_SHOTS_DESIGN Rev 3 (checklist 14 items) / ASSET_LIBRARY_DESIGN Rev 2.

**DESIGN PHASE CLOSED (2026-08-14): both checklists ANSWERED by Hasan in
chat — all recommendations accepted.** Shots #5: react + remotion only.
Two library amendments folded in as ASSET_LIBRARY_DESIGN Rev 3: (a) the
library extends the app's EXISTING `asset-library` Assets screen over
`userData/assets` (a new Studio-pool tab was wrong; assets root gains a
settings override for disk-space freedom; brands live at `brands/` inside
the assets root, visible in the screen); (b) describe degrades gracefully
with no AI provider — imports never block, a dismissible note explains why
descriptions matter, manual entry always works.

**Spike 0 VERDICT: PASS (2026-08-14) — preview Option A confirmed.** In a
packaged win-unpacked build (renderer on `file://` out of app.asar,
`webSecurity: true`), the renderer dynamic-imported a transpiled TSX module
from the module server (`http://127.0.0.1:3200/modules/<hash>.js`), mounted
it in an in-app `<Player>`, and the module's `useCurrentFrame()` matched the
host Player's frame EXACTLY on 20/20 samples over 4 s (e.g. t=205ms both 5 …
t=2806ms both 83) — shared React/Remotion instances work across the origin
boundary; the virtual `remotion`/`react` module imports crossed cleanly too.
No CORS, CSP, or module-resolution errors in the renderer console (the app
ships no CSP; the module server already sends `ACAO: *`). Bake-to-proxy
(Option B) stays a dormant fallback — not activated. Evidence + method:
invoke-only harness `window.__runSpike0(tsxPath)` in
`src/renderer/spike0-harness.tsx` (installed from `main.tsx`, inert until
called; drive via CDP per `docs/ui-automation-cdp.md`, works in packaged
builds via `--remote-debugging-port`). Verified in dev first, then in
`dist/win-unpacked`. NEXT: **library core** → shots core →
brands/capture/curation.

### Studio — post-gate POLISH MINI-SESSION (2026-08-14)
**Status: COMPLETE — the three papercuts the stability gate surfaced are fixed
and CDP-verified live; §15 performance spot-checks run on Hasan's real DJI
session concatenated to one 27.4-min 4K/60 HEVC file. Gates: 374 tests green,
type baselines held at 26 web / 22 node. S4 is next.**

1. **Render-start freeze fixed**: `@remotion/bundler`'s webpack compile now
   runs in an Electron utilityProcess (`src/main/services/bundle-worker.ts`,
   new electron-vite main entry) — it was blocking the main-process event loop
   for seconds (and calls process.chdir, so worker_threads couldn't host it).
   Progress/errors stream back over the port; dev CLI fallback kept. New
   `RenderPrepChip` in the Studio toolbar shows "Preparing render… n%" from
   queue-add until frames start. CDP-verified: chip within 1 s of clicking
   Export, IPC round-trips 2–60 ms through the entire bundle+prep.
2. **Proxy progress**: ffmpeg `-progress pipe:1` + total duration parsed from
   ffmpeg's own stderr banner → whole-percent events through the existing
   StudioMediaJobEvent channel (transcript pattern) → "Proxy n%" chip + 2 px
   bar on the pool card. Ticks stay in transient renderer state; the document
   only sees status changes. Verified climbing live on the 27-min import.
3. **Cache visibility**: per-project cache footer on the browser card — size
   readout, Open in Explorer, two-step Clear (`cache-manager.ts` + 3 IPC
   channels). Clear aborts the project's running media jobs first (Windows
   file-lock), restores the scaffold; browser-only placement so a clear can't
   hit an open editor. Sizes matched disk byte-for-byte.

§15 verdicts (recorded in TESTING.md): transcript 27.4 min → ready in ~75 s
(AssemblyAI, 2,258 words) — very acceptable; timeline responsive under two
concurrent ffmpeg jobs (drag rAF median 34.8 ms, playback 16.7 ms); editor
idle CPU 0.00 s over 10 s; proxy on 4K/60 HEVC WITHOUT NVENC projected
multi-hour — new backlog item: hardware DECODE (d3d11va/qsv) for proxy inputs.
§15 agent-pass item still open (transcript only 2,258 words, under the 5k
threshold).

### Studio — STABILITY GATE PASSED (2026-08-13)
**Status: COMPLETE — Hasan's guided manual pass over every remaining human item
in docs/studio/TESTING.md, including the §13 S3 exit test on real multi-take
DJI footage: auto-cut (37 proposed) + editorial pass both applied → 26 clips,
every join flush to 1e-6 s, export v 68.9333 s / a 68.9920 s (delta = AAC frame
padding, not drift), A/V sync clean by ear at the last cut (1:03.4). S4 opens
after a short polish mini-session.**

Verified by ear/eye this session: §10.4 auditions (all clean) · §8 complete
(AssemblyAI real recording, whisper download + offline, re-transcribe
round-trip, wrong-key error) · §9.2 plan honesty on real footage · §11.1
editorial pass + chat memory + plain question + stop button + second-pass
refusal · §14.1/14.2 network kills · §7.3 decided (park at end).

Fixed/built during the gate (all test+type gated):
- **slam-1 retirement**: AssemblyAI removed the model; catalog now Universal
  (auto → universal-3-5-pro + universal-2) with pinned entries and a legacy
  alias; provider special-cases dropped; 401/403 now reads "AssemblyAI rejected
  the API key — check your AssemblyAI key in Settings."
- **Transcript UX**: Engine picker stays visible when Ready; new Reset button
  (blocked while a review is open).
- **Editorial Pass button** (Inspector → Assistant handoff): one-click entry
  into the agent with full chat transparency; disabled without a transcript /
  during review / while busy.
- **Context warning**: Assistant estimates next-turn context (transcripts +
  chat vs a conservative 128k budget) and banners at ≥40% pointing at the
  existing ↺ Clear.
- **Black-flash fix**: `premountFor` on clip Sequences — joins are seamless in
  preview (export was never affected).
- **Playhead parks at end** after playback (`moveToBeginningWhenEnded={false}`).

Deferred with reasons (in TESTING.md): §11 Local-Models refusal (no local
model installed), §13.5 GIF/WebP (N/A — Studio export is hard-coded h264/mp4),
§15 long-file perf (tail of the polish session). Backlog logged: render-start
freeze, proxy progress bar, cache visibility UI, Studio format picker, agent
timeline-read tool, optional persistent chat.
**Status: COMPLETE — 22 machine-checkable items from §1–§14 driven live via
CDP, ZERO app bugs found; matching items annotated ✎ in TESTING.md so Hasan's
manual gate shrinks to the genuinely human checks (ears at joins, real
multi-take footage, the §13 S3 exit export, network-failure paths)**

Run on throwaway seeded projects (deleted after); `autocut-test` exercised for
the Auto Cut → Reject-all round-trip and restored byte-identical.

- Verified: neighbour clamp flush-stop · edge-trim bounds incl. the 0.04 s
  floor · split contiguity · an 11-op mixed chain (split/trim/move/paste/
  marker/ripple-delete/duplicate) undone to an identical timeline · lock
  blocks drag/trim/delete/paste · Hide drops picture / Mute silences the lane
  live · frame/second arrow steps, Home/End (End parks on the last frame) ·
  zoom anchored on the playhead (0 px drift) · Space guard in inputs · snap
  toggle on/off · gap playback (black + audio continues) and clean
  end-of-timeline stop · Auto Cut → review → Reject all → timeline untouched ·
  no selection/marker bleed across project switches · remove-asset-with-clips
  undo is orphan-safe · autosave force-quit loses only the debounce window,
  JSON intact · history cap: 130 ops → exactly the last 100 undo · corrupt
  project.json skipped by the browser · full relaunch identity · cache-wipe
  regeneration · project create + two-step delete to the Recycle Bin.
- One behavior observation (not a bug): after playing past the end, the
  playhead parks back at 0 — Remotion's `moveToBeginningWhenEnded` default.
  Flagged in §7.3 for Hasan; set the prop to false if end-parking is wanted.
- Two automation gotchas recorded in docs/ui-automation-cdp.md: a MINIMIZED
  window freezes rAF and `Page.bringToFront` won't restore it (use user32
  SW_RESTORE first), and Remotion's pooled shared `<audio>` tags mean
  audibility must be asserted via `paused`, not tag counts/volume.
- No source changes — docs only.

### Studio — core-parity Session 6: Slice F (media relink) (2026-08-13)
**Status: COMPLETE — live CDP verification across three app launches (TESTING.md
§16.8 ticked); no schema changes (consumes the `hash` media-import has written
since S2); core-parity plan FINISHED → next is Hasan's full TESTING.md pass,
then S4**

Sixth and final session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **Missing detection.** `studioMediaPrepare` now `fs.access`es every
  asset path; unreachable ones come back in a new `missing: string[]` and
  their proxy/waveform jobs are skipped (ffmpeg would only fail). The renderer
  keeps missing-ness as environmental state in `useStudioMedia` — deliberately
  NOT in the document (it describes this machine, not the project).
- [x] **UI.** Missing pool cards get a red border + "Missing" overlay with a
  visible "Locate…" button; timeline clips whose asset is missing render a red
  warning tint + border with a "source file missing" tooltip
  (EditorShell → TimelinePanel → TimelineLanes → TimelineClip threading).
- [x] **Relink IPC.** New `STUDIO_MEDIA_RELINK` following the full
  channels/types/handler/registration/preload/electron.d.ts pattern (the last
  one by hand — new channel). Main opens the native picker (or takes
  `filePath` — the mismatch-retry, and `VIDTSX_RELINK_PICK` env stands in for
  the dialog in automated runs, documented in docs/ui-automation-cdp.md),
  verifies the pick's first-1MiB+size sha1 against the stored `asset.hash`,
  re-probes on success, and returns `{ path, probe, hash }` for the renderer
  to merge. Hash mismatch → renderer-built confirm card (CDP-able, like every
  dialog in this app): Cancel or "Use anyway" (override re-probes and rewrites
  the hash so the NEXT relink checks against reality).
- [x] **Cache survival.** Proxies/waveforms/transcripts are keyed by asset id,
  so they ride through untouched; the prepare effect keys on `id:path` so a
  relink re-runs detection and only regenerates what's absent.
- Live CDP (throwaway "relink-test" project + fixture copies, deleted after):
  launch 1 generated caches; launch 2 (file renamed away) showed the full
  missing UI with jobs skipped, a wrong-content pick raised the mismatch card
  (Cancel inert; override merged with re-probe 40.07 s → 2.07 s + new hash);
  launch 3 relinked the true moved file instantly — no prompt, stored hash
  verified equal, proxy mtime unchanged (no regeneration), waveform still
  drawn, document path updated and autosaved.

### Studio — core-parity Session 5: Slice E (transitions: crossfade · dip-to-black) (2026-08-13)
**Status: COMPLETE — design doc first (docs/studio/TRANSITIONS_DESIGN.md), then
unit-tested (17 new tests, 374 total) + live CDP click-through incl. a real
export; schema addition: optional `transitionOut` on StudioClip (no version
bump, old projects open untouched)**

Fifth session of `docs/studio/CORE_PARITY_PLAN.md` — the model-risk slice, so
the design was written down before the code (review it in TRANSITIONS_DESIGN.md).

- [x] **Model.** `transitionOut?: { kind: 'crossfade'|'dip-to-black', duration }`
  on the LEADING clip; valid only while the next clip on the track starts
  exactly at its end (1e-6 s). The document never stores an overlap.
- [x] **Invariant enforcement — reducer-level prune.** The ops do NOT all
  funnel through `withTrackClips` (group ops + applyCutProposal build tracks
  inline), so validity is enforced once in `useTimeline`'s commit path:
  `pruneTransitions` drops any transition whose boundary an edit just broke,
  in the SAME undo step, preserving identity-on-reject. Every current and
  future op inherits it. `splitClip` is the one case prune can't see (halves
  stay contiguous) — it moves the field to the right half explicitly, like the
  fade stripping. Ripple deletes that land clips flush KEEP the transition
  (that's what a ripple means); serialize re-checks contiguity itself because
  loaded documents never passed through the reducer.
- [x] **Render.** `serializeTimeline` builds the overlap: crossfades extend the
  leading clip `duration/2` past the cut and start the trailing one early,
  each side clamped to its source handles (`trimBefore` shifts by
  `ext × playbackRate`; images/tsx unlimited; zero handles both sides → hard
  cut). New `transitionIn/Out { kind, frames }` on SerializedClip;
  `TimelineComposition` draws the ramps — trailing clip opacity 0→1 (it paints
  on top; DOM order = track order), equal-power audio (cos/sin) for
  crossfades, linear to silence for dips — composed with gain × fades in
  `volumeProp`. Dip needs no extension: opacity+volume V to zero at the cut.
- [x] **Ops + reducer.** `transition-ops.ts`: `setTransition` (rejects on
  gap/locked/unknown; clamps duration to both clips), `removeTransition`,
  `pruneTransitions`. Actions `transition-set`/`transition-remove`, one undo
  step each (preset re-pick = replace in place = one step).
- [x] **UI.** `TransitionJoins`: a small square at every contiguous boundary on
  unlocked tracks (accent-filled when set, tooltip shows kind + duration);
  click opens a `FloatingMenu` with Crossfade/Dip × 0.5 s/1 s presets +
  Remove. Numeric duration editing deferred (v2, Inspector).
- Live CDP run (seeded throwaway "transition-test", deleted after): preview at
  the crossfade cut read opacity 0.5 / volumes 0.707+0.707 and the dip cut
  0/0; export (420 frames exactly — transitions never change length) showed a
  half-transparent incoming picture at the cut and a pure-black dip frame; dip
  audio >90 % attenuated inside the ramps; split handed the dip to the right
  half; Backspace-delete pruned + single-undo restored; ripple-delete kept the
  crossfade on the collapsed join.

### Studio — core-parity Session 4: Slice D (markers + range export) (2026-08-13)
**Status: COMPLETE — unit-tested (20 new tests, 357 total) + live CDP click-through
incl. a real frame-accurate range export (TESTING.md §16.6 markers line + §16.7 ticked);
schema addition: optional `markers` on StudioTimeline (no version bump, old
projects open untouched)**

Fourth session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **D1 pure ops.** New `services/marker-ops.ts` (timeline-ops stays at 285
  lines): `addMarker`/`moveMarker`/`removeMarker`/`renameMarker`, all
  identity-on-reject, times clamped ≥ 0, list kept sorted by time, and a
  timeline with zero markers has NO `markers` key so old documents round-trip
  byte-identical. Reducer actions `marker-add/-move/-remove/-rename`, one undo
  step each (add ids minted by the caller, like paste).
- [x] **D1 UI.** M drops a marker at the playhead (text-entry + visibility
  guards respected); `RulerMarkers` draws diamonds on the `TimelineRuler` —
  click = seek, drag = move (3 px threshold, commit on release = one undo
  step), double-click = inline rename popover, right-click = FloatingMenu with
  Rename/Delete. Labels render next to the diamond. Markers persist through
  autosave and were verified across a renderer relaunch.
- [x] **D2 range state.** I/O keys set `rangeIn`/`rangeOut` at the playhead
  (Shift+I/O clears the point) — component state in `EditorShell`, session-only,
  never in the document. Ruler shows the highlighted span between the points
  (a lone point draws a bracket); "Export range" appears in the toolbar only
  when the points span ≥ 1 frame.
- [x] **D2 range export.** `studioExportPrepare` request grew optional
  `rangeIn`/`rangeOut` seconds (electron.d.ts needed no manual change — it
  references the shared type via `import()`). Main trims the document with the
  new shared `trim-range.ts` (`trimTimelineToRange`): edges snapped to the
  frame grid FIRST (cumulative-rounding rule), clips cut like a split
  (head cut advances `sourceIn` + drops fade-in, tail cut drops fade-out),
  markers filtered+shifted — then serializes the result, so `serializeTimeline`
  stays the single source of truth. The render length is exactly
  `frame(out) − frame(in)` (`rangeDurationInFrames` override on
  `createExportEntry`), so a window past the last clip renders trailing
  black/silence like every NLE.
- Live CDP run (seeded throwaway "range-test" project, deleted after): all
  marker gestures + undo steps verified in the DOM; range span at exact px;
  real export → ffprobe 5.033333 s / 151 frames == frame(7.533) − frame(2.5)
  exactly; audio envelope corr 0.871 vs the matching source span (−0.62 vs a
  control span); boundary frames matched the source.
- Note: a stale parallel-session buffer had pre-written the same handler edit
  and left a duplicate import in `studio-handlers.ts` mid-session — reconciled
  by re-reading everything from disk before the gates.

### Studio — core-parity Session 3: Slice C (audio fades + detach audio) (2026-08-12)
**Status: COMPLETE — unit-tested (8 new tests, 337 total) + live CDP click-through
incl. a real export (TESTING.md §16.2 fully ticked + §16.4 completed);
schema addition: optional `fadeInSec`/`fadeOutSec` on StudioClip (no version
bump, old projects open untouched)**

Third session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **C2 spike first (as planned).** Remotion `<Audio src={videoFile.mp4}>`
  plays a video's audio track in preview AND in renderMedia — proved with a
  seeded throwaway project whose audio clip pointed at the video asset with a
  DIFFERENT source span than the muted video clip: the export's envelope
  correlated 0.879 with the audio clip's span and 0.25 with the video's.
  Decision: no ffmpeg audio-extract cache needed; detach reuses the asset.
- [x] **C1 fades.** `fadeInSec`/`fadeOutSec` (timeline seconds) with one
  invariant — both ≥ 0, sum ≤ duration, fade-in wins — enforced by
  `clampFades` in timeline-ops and re-applied by every duration-changing op:
  end/start trims, `setClipSpeed`, and `splitClip` (left half keeps only its
  fade-in, right half only its fade-out, stripped BEFORE clamping so the
  discarded fade can't eat the budget — keeps splits inaudible). Fades ride
  `ClipPatch`/`update-clip` (one undo step per commit). Serialize emits
  `fadeInFrames`/`fadeOutFrames` (rounded, re-clamped after quantization);
  `TimelineComposition.volumeProp` builds gain × ramp callbacks for BOTH
  `<OffthreadVideo>` and `<Audio>` (Remotion's volume callback receives the
  clip-relative frame — trimBefore cancels out via useFrameForVolumeProp, and
  playbackRate does not scale it).
- [x] **C1 UI.** Fade in/out numeric fields in the Clip inspector section
  (audio-bearing kinds); CapCut-style top-corner fade handles on clips with
  translucent ramp wedges (SVG), dragged through the same useClipDrag
  machinery as trims — preview runs the real `updateClip`, so mid-drag you
  see the clamped truth; commit on release = one undo step.
- [x] **C2 detach audio.** `detachAudio(timeline, clipId, newId)` in the new
  `clip-update-ops.ts`: mutes the video (gain 0 — the one mute concept) and
  creates an audio clip with the same assetId/timelineStart/sourceIn/
  duration/speed (sample-aligned by construction), carrying the video's
  pre-detach gain and fades; lands on the first unlocked audio track whose
  span is free, else a fresh `addTrack('audio')` lane. One op = one undo step
  restores both sides. Right-click context menu on video clips
  (`ClipContextMenu` over the existing FloatingMenu), disabled for soundless
  assets/already-muted clips; the new clip is selected after.
- [x] **File split (over-300 fix).** `updateClip`/`setClipSpeed` moved from
  timeline-ops.ts (364 → 285 lines) into `clip-update-ops.ts` alongside
  `detachAudio`; tests moved to `clip-update-ops.test.ts`.
- Live CDP run (throwaway seeded project, deleted after): fade fields → ramp
  wedges + preview element volumes 0.5/1.0/0.5 across the ramps (audio AND
  video elements); handle drag 1 s → 2 s exactly, one undo back; detach via
  context menu → muted video + selected new A1 clip, one undo restored both;
  real export: detached span envelope-corr 0.861 vs the right source span,
  faded span corr 0.904 vs ramped source (0.732 raw), edges at 2 %/12 %.
- CDP gotcha: `FloatingMenu` is position:fixed → `offsetParent === null`, so
  the visible() filter from docs/ui-automation-cdp.md hides it — query
  `[role="menu"]` raw.

### Studio — core-parity Session 2: Slice B1 (clip inspector) (2026-08-12)
**Status: COMPLETE — unit-tested (11 new tests, 329 total) + live CDP click-through
incl. a real export (TESTING.md §16.1 fully ticked + §16.4 per-clip-mute line);
no schema changes (gain/speed/transform/label already existed)**

Second session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **Pure ops.** `updateClip(timeline, clipId, patch)` in `timeline-ops.ts`
  patches `gain` (clamped 0–2) / `label` / `transform` (field-wise merge);
  neutral values (gain 1, empty label, identity transform field) REMOVE the key
  so documents never accumulate no-op state. `setClipSpeed(timeline, clipId,
  speed)` is separate because speed changes duration: `timelineStart` stays
  put, duration = sourceSpan/speed, clamped against the right neighbour like an
  end-trim (no ripple in v1 — the UI says so); rejects when even
  `MIN_CLIP_DURATION` no longer fits. `updateClips(timeline, clipIds, patch)`
  in `timeline-group-ops.ts` for multi-select volume/mute — all-or-nothing on
  locked tracks like `moveClips`. All identity-on-reject, 11 unit tests.
- [x] **Reducer.** Actions `update-clip` / `update-clips` / `clip-speed`; the
  UI commits sliders on release and numeric/label fields on Enter/blur, so one
  committed control change = exactly one undo step (multi-select volume = one
  step for the whole selection).
- [x] **UI.** `ClipSection` at the top of the Inspector when clips are
  selected: name/track/start/length read-outs, volume slider 0–200% + mute
  (pre-mute gain remembered per clip id in component state), speed presets
  0.25–4× + numeric field with the "shortens/lengthens in place" note, opacity
  slider + position/scale/rotation numeric fields (video/image/tsx only),
  label input (empty clears). Multi-selection: "N clips selected", volume+mute
  only. Input primitives split into `inspector-controls.tsx` (~300-line rule).
- Live CDP run (autocut-test, restored to a byte-identical project.json via
  undo afterwards): volume 50% → mute → unmute walked back by 3 single undos;
  2× halved the Length readout and the clip's px width, boxed-in 0.25× clamped
  trim-like; opacity/scale/rotation/x showed up in the player `<video>`'s
  computed style; label renamed the timeline clip; multi-select volume was one
  undo step. Real export while edited: duration 26.60 s matched the sped
  timeline, muted clip's span digitally silent (WAV sample scan), extracted
  frame showed the same translate/scale/rotate/opacity as the preview.
- Note: `timeline-ops.ts` is at 364 lines — over the ~300 guideline because
  the plan pins both new ops to this file; split candidate for a later pass.

### Studio — core-parity Session 1: Slice A (playback rate · copy/paste · timeline QoL) (2026-08-12)
**Status: COMPLETE — unit-tested (7 new tests, 317 total) + full live CDP click-through
(TESTING.md §16.3 / §16.6 / §16.9 ticked); no schema changes**

First session of `docs/studio/CORE_PARITY_PLAN.md`.

- [x] **A1 — global preview playback rate.** `PLAYBACK_RATES` [0.5, 1, 1.5, 2]
  as `EditorShell` state (session-only, never in the document); rate button in
  the `PreviewPanel` transport cycles up, Shift+click cycles down; wired as the
  `playbackRate` prop on the `@remotion/player` `<Player>`. Auditions pin 1×:
  `playSpan` (Play removed / Play join) sets an `auditioning` flag cleared when
  the audition crosses its stop marker OR on manual pause (so an abandoned
  audition can't leave the rate stuck), and "Preview result" pins while
  checked — the button shows 1× disabled with an honest tooltip, then restores.
  Measured live at 2×: double clock advance over the same wall time.
- [x] **A2 — copy / paste / duplicate.** New pure op `pasteClips(timeline,
  entries, atSeconds, newIds?)` in `timeline-group-ops.ts` (7 unit tests):
  entries target their source track ids, fall back to first-compatible like
  `trackForAsset`, keep relative layout via `offsetSeconds`, fresh clip ids; on
  collision the WHOLE group shifts right together to the nearest fit (the
  minimal-delta candidates are "flush against an existing clip's end");
  identity-on-reject when an entry has no track or the group overlaps itself
  after fallback. Reducer `paste` action = one undo step; ids are minted by the
  caller so the paste can select the new clips (`useClipboard` runs the op
  eagerly and skips dispatch/selection on reject). Clipboard is an in-memory
  ref in the editor — cross-project paste refused by construction. Shortcuts
  Ctrl+C (only claimed when clips are selected) / Ctrl+V (at playhead) /
  Ctrl+D (paste at the selection's own end; leaves the clipboard alone) behind
  the existing text-entry + visibility guards.
- [x] **A3 — auto-scroll + zoom-to-fit.** `usePlayheadFollow`: on the playhead
  exiting the lanes viewport during playback, scrolls it back in at 20% from
  the left; a manual scroll while playing suspends following (own writes
  announce themselves via a programmatic counter), and it resumes when the
  playhead next walks OUT of view — the in→out transition is re-derived on
  manual scroll too, or a stale `wasInView` made the very next frame yank the
  view back (caught while building the CDP test). All refs, no React state.
  Zoom-to-fit (`Shift+Z` + toolbar Expand button): largest `ZOOM_LEVELS` step
  whose pxPerSecond shows the whole timeline, anchored at 0.
- Live CDP run (autocut-test + editorial-test): paste at End landed selected
  right after the last clip, Ctrl+D chained the next copy, undo ×2 → 13-clip
  baseline, redo → 14; zoom-to-fit framed 545 px of content at scrollLeft 0;
  follow jump re-entered at exactly 0.20, manual scroll-back stayed put,
  following resumed after re-enter + walk-out; audition pinned 2×→1×→2×.
- CDP testing gotcha recorded: the timeline lanes' scroll div is NOT the first
  visible `.overflow-auto` containing clips — an outer wrapper (84 px wider,
  never horizontally scrollable) matches first, silently reading `scrollLeft 0`
  forever. Pick the INNERMOST matching container. Also: playback (rAF) is
  throttled while the window is occluded — `Page.bringToFront` first.

### Studio — S3 agent pass: editorial cuts via the Assistant chat (2026-08-12)
**Status: COMPLETE — unit-tested (19 new tests, 310 total) + full live CDP run
(seeded TTS recording → AssemblyAI verbatim transcript → agent chat → 5-cut
proposal → apply → undo ×2 → redo)**

The LLM editorial pass from the S3 plan: the agent reads the VERBATIM
transcript and proposes retakes/false starts/fillers/fluff as cuts. Its output
lands through the SAME `proposal-add` → CutRegionLayer + ReviewCutsSection
flow as mechanical Auto Cut — the agent never touches the timeline.

- [x] **Typed in-process tools through the Agent SDK.** `LLMRequest.mcpServers`
  (main-process-only field, like `onTextDelta`) is passed into
  `ClaudeProvider.createSession`'s query options; `runLlmGenerate` grew an
  in-process `extras` param to carry it past the IPC type. `zod` pinned 4.3.6
  (already a transitive dep). Providers that aren't `agent-sdk` ignore the
  field — the agent's system prompt then honestly says it can chat but not
  edit, and names the fix (pick an Agent-SDK provider in the Inspector).
  Unknown provider ids (e.g. auto-registered `claude-subscription`, which is
  NOT in the saved configs list) are assumed agent-sdk.
- [x] **`studio-agent.ts`** (main): one in-flight turn per project, scope-less
  runs with explicit `messages` history (no hot-session staleness), push
  events over `STUDIO_AGENT_EVENT` (`delta` / `tool` / `proposal`), provider
  from `project.settings.agent.providerId` (its first real consumer),
  `featureSource: 'auto-cut'`. Two tools:
  - `get_transcript` → **takes view** (`transcript-takes-view.ts`, port of
    format_transcript.py): segments split on >0.8 s gaps, `#NN [s - e] (M:SS)`
    lines, pause lines between, fillers inline as `<<uh, 12.34-12.40>>`. Warns
    when the transcript isn't verbatim.
  - `propose_cuts` → `editorial-cuts.ts`: clamp/drop invalid spans, merge
    overlaps + wordless slivers (≤1 s) between cuts, then **RMS-snap edges
    with the existing `planClip`** under `internalGap = ∞` (pause compression
    stays Auto Cut's job) — head pads, decay tails, and the clamp that stops a
    tail riding into cut speech all apply to agent spans. Keeps↔cuts alternate
    1:1 with planner segments, so each item's edges are exactly what apply
    removes. Proposal built in main: retake/false_start/filler start
    **accepted** (veto review), fluff starts **rejected** (policy: suggest,
    don't auto-remove); honest `agentNote` headline + the agent's summary +
    QA notes (merged/dropped/vanished counts).
- [x] **`resources/skills/studio-clean-cut/SKILL.md`** — the clean-cut policy
  ported from claude-youtube-editor and composed into the system prompt via
  `skillIds`: spoken slates outrank judgment, doubled phrase → cut the FIRST,
  filler conservatism (standalone yes, mid-sentence careful, scripted never),
  antecedent rule, paired-fluff notes, "the transcript lies about TIME"
  (word-bound spans; snapping absorbs the error), every cut carries a
  which-take-wins note.
- [x] **Assistant tab is real** (`AgentPanel` + `useStudioAgent`): streaming
  deltas, tool-activity chips, proposal chip linking to review, stop/clear,
  Enter-to-send. A proposal arriving while the user is ON the Assistant tab no
  longer yanks them to the Inspector (regions still appear on the timeline);
  from any other tab the review pulls into view as before. One-review gating
  holds at three layers (send context flag → tool refusal; Auto Cut button;
  proposal-ops no-ops).
- Live walkthrough (dev, CDP): seeded a 38 s TTS wav containing a false start
  + "Let me say that again." slate + doubled "And what, and what" + standalone
  "Um." + a like/subscribe CTA; AssemblyAI verbatim transcript (70 words,
  measured times). One chat turn: agent read the takes view and proposed
  exactly the right 5 cuts — categories correct, fluff unchecked, notes name
  the winning take, and it flagged the one estimated boundary "needs an ear".
  Review showed honest stats (−18.9 s proposed / −11.3 s at Apply-4), regions
  on the A1 clip; Apply split 1→5 clips with the stats toast; two Ctrl+Z
  returned to pristine (un-apply, then un-add); Ctrl+Y brought the full
  review back. Type baseline ratcheted web 27→26.
- Not exercised live: auditions by ear (buttons render; left the proposal
  open in the `editorial-test` project to listen to), the chat-only fallback
  on non-agent-sdk providers, and the propose-cuts-refusal path (logic
  unit-covered). Takes view carries word times only on fillers by design —
  the model estimates other boundaries and the snapper absorbs it; if that
  bites, add per-word times to the view.

### Render pipeline — resolution-scale fix + animated WebP export (2026-08-11)
**Status: COMPLETE — unit-tested (16 new tests) + Electron smoke test; full in-app
render click-through still pending**

- [x] **Downscaled renders no longer zoom/crop pixel-sized content** (user-
  reported "GIF gets bigger and cut"). Root cause: fractional scales (e.g.
  480p from 1080p = 0.4444) were worked around by materializing smaller
  composition dims at scale 1, which re-lays-out the comp — absolute-pixel
  content kept its design size inside a smaller canvas. Fix: `snapRenderScale`
  (`src/shared/render-scale.ts`) picks the nearest scale with exact
  even-integer output dims (480p → 864×486) so Remotion's deviceScaleFactor
  path scales the finished bitmap instead; dims-materializing survives only
  as a logged fallback for near-coprime comp sizes. Modal presets show the
  snapped dims and pass the exact scale.
- [x] **WebP export** (`codec: 'webp'`): Remotion has no WebP codec and its
  bundled ffmpeg ships no libwebp (verified: encoder list has only `gif`,
  ffprobe can't even decode webp), so `src/main/services/webp/` renders a PNG
  sequence via `renderFrames`, encodes each frame through Chromium's canvas
  encoder in a hidden BrowserWindow (tone-extractor pattern; quality 1.0 =
  lossless VP8L, alpha preserved), and muxes with a hand-rolled pure
  RIFF/VP8X/ANIM/ANMF muxer (spec-tested; pad bytes, ALPH carry-through,
  VP8L alpha-bit detection). Zero new dependencies. `crf` is reused as WebP
  quality 1–100 (documented on `RenderCodec`) so queue DB/IPC are unchanged.
  Modal: WebP joins the GIF family (auto-480p, smoothness, loop, muted) plus
  quality presets and the transparency toggle; preview panel plays it in an
  `<img>`. Smoke-tested in real Electron: lossy-opaque + lossless-alpha
  files decode in Chromium's decoder at correct dims.
- Known gap: ffmpeg-based queue thumbnails can't decode .webp output (no
  libwebp in the stripped binary) — thumbnail is skipped gracefully.

### Studio — ripple-delete toggle + track management (2026-08-11)
**Status: COMPLETE — unit-tested (11 new tests, 284 total) + driven live via CDP**

The two queued follow-ups before resuming the S3 agent pass.

- [x] **Auto-ripple toggle** (`TimelinePanel.rippleEnabled`, persisted like
  `snapEnabled` as component state, default ON). Governs the Delete key and the
  toolbar delete button for single AND batch deletes; the button's tooltip
  says which mode is live ("Delete and close the gap" / "Delete, leaving the
  gap"). Backspace stays the explicit leave-the-gap delete in either mode.
- [x] **Track management.** Pure ops in `services/track-ops.ts` (identity-on-
  reject): add (visual tracks insert on TOP because tracks[0] paints in front;
  audio appends), rename, reorder, delete (locked/last-track reject), flag
  toggles — all undoable reducer actions in `useTimeline`.
- [x] **Interactive `TrackHeader`** (own file now): click chooses the track,
  double-click renames inline, lock + mute/hide icons are buttons, right-click
  opens a renderer-built `FloatingMenu` (NOT the native menu — no IPC, CDP-
  drivable) with Rename / Move up / Move down / Delete. "+ Track" button in
  the header column's top cell adds video/overlay/audio.
- [x] **Chosen-track pool adds**: `trackForAsset` gained a `preferredTrackId` —
  the selected track wins when compatible (audio↔audio lanes, visual↔non-audio),
  else the old first-compatible fallback. `useTimeline.selectedTrackId` is
  pruned when its track leaves the document.
- [x] Header column now follows the lanes' vertical scroll (translateY from the
  scroll viewport) — first time track count is user-controlled, so >3 tracks
  scroll; the ruler was already sticky.
- Verified live on the autocut-test project: ripple ON delete closed the full
  span (later clips slid exactly its width) and OFF left every later clip in
  place, undo restored both; O1/A2 landed top/bottom; chosen-track add put the
  clip on selected O1 instead of V1; rename → B-roll; lock/mute/hide labels
  flip; locked track's menu disables Delete; Move down + Delete + full undo
  chain returned exactly to baseline (V1/A1, 13 clips, flags cleared).
- Mid-session note: work briefly interleaved with a `git stash -u` of the
  whole tree; everything was restored from stash@{0} (EditorShell.tsx had to be
  checked out from the stash explicitly). The stash entry still exists and is
  safe to drop once confirmed.
- **User-reported bug fixed same day: vertical clip drags "sometimes snapped
  back" to the original track.** Two causes in `useClipDrag`: (1) the
  click-vs-drag test on release checked ONLY horizontal movement, so a clip
  dragged straight down/up to another lane with <2 px of X drift was discarded
  as "a click that never moved"; (2) the drop re-resolved the target lane from
  the pointerup coords instead of committing what the preview last showed, so
  boundary jitter could flip the outcome. Now: moves use a 2 px box on both
  axes (trims stay X-only), the drop commits the preview's lane
  (`lastTargetTrackId`), and a wobble that resolves back to the identical
  lane+time skips the dispatch instead of burning a no-op undo step. Verified
  live via CDP with a synthetic dx=0 drag: clip hopped V2 → lane above, undo
  restored it (previously this exact gesture always snapped back).

### Studio — timeline multi-select & batch editing (2026-08-11)
**Status: COMPLETE — unit-tested (11 new tests) + driven live via CDP**

User-requested during S3.3 testing (the request surfaced after fixing native
drag-selection painting over the timeline — `select-none` on the panel root).

- [x] Selection is now a SET (`useTimeline.selectedClipIds`; `selectedClipId`
  stays as the derived single selection for split/trim logic). Ctrl/⌘/Shift-
  click toggles membership; plain click collapses; clicking a clip of a
  multi-selection keeps the group so it can be dragged, and collapses on
  release only if the pointer never moved (CapCut semantics). Stale ids are
  pruned whenever clips leave the document (delete/undo/apply-proposal).
- [x] `services/timeline-group-ops.ts` (pure, same identity-on-reject contract):
  `moveClips` — one shared delta, relative positions preserved, clamped so no
  member collides with an unselected neighbour or crosses zero (boxed-in =
  reject), locked tracks reject; `removeClips` — batch delete with per-track
  ripple that closes the FULL removed span; `clipsInRect` — marquee hit-test.
- [x] Marquee drag-select (`useMarqueeSelect`): press empty lane space and drag
  a dashed rectangle; every clip it touches joins the selection (Ctrl/Shift =
  additive); a motionless press keeps the old deselect-click behaviour.
- [x] Group drag rides the existing scratch-document preview (`useClipDrag`
  gains a group mode — same snapping, no track hopping) and commits as ONE
  `move-clips` undo step. Batch delete: Delete = ripple, Backspace = plain,
  toolbar ripple-delete button now deletes the whole selection. New keys:
  Ctrl+A select all, Escape clear selection.
- Verified live: ctrl-click 2 clips → group-drag both +2 s (others untouched)
  → undo restores; marquee across 3 clips from the empty A1 lane; Delete
  removes all 3 with ripple; undo restores; empty-lane click clears.

### Studio (AI video editor) — Phase S3 step 3: cut proposals + review on the timeline (2026-08-11)
**Status: COMPLETE — verified live via CDP with a real AssemblyAI transcription**

Live walkthrough (same session, new machine): seeded 40 s TTS recording with known
pauses → one-click Auto Cut (chained AssemblyAI transcription, 69 words, measured
timestamps) → 12 cuts proposed (−14.0 s, the 3.5 s SSML break found as a 3.8 s
dead-air item) → rejected one item ("Apply 11 cuts" / grey region) → Apply split
the clip into 12 contiguous pieces with the stats toast → ONE Ctrl+Z restored the
full review (12 regions, proposal back to `proposed`). Two real bugs found live
and fixed:
- **AssemblyAI deprecated `speech_model`** (API change since S3.1): provider now
  sends `speech_models` — legacy 'universal' maps to the API's own default pair
  `['universal-3-5-pro','universal-2']`, other ids pass through.
- **useAutoCut chained plan never fired**: an asset has NO transcript entry in the
  document until the first job event, and the watcher read that `undefined` as
  "cancelled", clearing the pending run instantly. Now `undefined` only counts as
  cancelled after the job was seen running.
Note: the seeded TTS clip reports noise floor −120 dB (true digital silence) —
real recordings will show sane floors. Not exercised live: edge-drag by pointer
(logic unit-tested; handles render), auditions by ear, export of an applied cut.

User-reported bug fixed same day: **with "Preview result" on, the playhead
crawled through cut regions** (the Player runs the shorter CUT timeline while
the panel displays the original, so the line lagged and the video ended early).
Fixed with `services/preview-mapping.ts` — a piecewise-linear map between the
two clocks built from the reshaped track's clips (preserved gaps map
proportionally, cut spans collapse to the join). `TimelinePanel` shims its
whole playback surface (playhead, clock, ruler seeks, split-at-playhead, zoom
anchor) into display coordinates while the map is active, so the playhead now
JUMPS across regions and ruler seeks into a cut land on the join; EditorShell
auditions keep talking to the raw player clock. 5 unit tests (jump, collapse,
round-trip).

Design discussion + UI mockups: claude.ai artifact "Auto-Cut Flow" (session 2026-08-11).
Locked decisions: mechanical (silence) cuts first — the LLM editorial pass (retakes/
fillers) is the next slice and feeds the SAME review UI; all items start accepted
(veto-based review); AssemblyAI is the recommended engine (hint in the picker);
ffmpeg smart-render stays deferred.

- [x] **Proposals live in the undo history.** `useTimeline`'s reducer now snapshots
  `{timeline, proposals}` (`EditDoc`) so accept/reject/adjust/apply are all undoable
  and Ctrl+Z after Apply restores BOTH the timeline and the proposal to `proposed`
  in one step. New actions: `proposal-add / -item-status / -item-span / -apply /
  -reject`. Pure list edits in `services/proposal-ops.ts` (same identity-on-reject
  contract as timeline-ops).
- [x] **Plan → proposal** (`services/cut-proposal.ts`): keep-segments inverted into
  cut spans (incl. leading/trailing silence), categorized `long_pause` (<2 s) vs
  `dead_air` (≥2 s), word context in `note` ("…setup. [3.0 s] Now…") and swallowed
  words in `text`; honest headline + planner QA notes in `agentNote`. Also:
  source→timeline region mapping and per-item drag bounds (cuts can't overlap).
- [x] **Apply** (`services/apply-cut-proposal.ts`): accepted spans merged, subtracted
  from every clip playing the asset, survivors kept contiguous (per-track ripple —
  music holds timing), sub-frame slivers dropped, reshaped clips tagged
  `origin: {by:'agent', proposalId}`; first piece keeps its clip id. 19 new unit
  tests across builder/mapping/apply.
- [x] **Review UI.** `CutRegionLayer`: striped amber regions over the lanes (grey =
  rejected), click = select + seek, selected region gets **draggable edge handles**
  (snap to transcript word boundaries via `useAssetTranscripts` reading the cache
  JSON over `studioCacheRead`; item marked `adjusted`). `ReviewCutsSection` in the
  Inspector: stats header with honest before→after (runs the real apply on a
  scratch doc), QA notes, per-item accept toggles + category/adjusted chips +
  transcript context, Apply N cuts / Reject all.
- [x] **Auditions.** Per cut: "Play removed" (original timeline) and "Play join"
  (±1.5 s with accepted cuts applied — finds the post-ripple join by matching the
  survivor clip whose `sourceIn` is the cut's end). Global "Preview result"
  checkbox plays the whole timeline as-if-applied; all built on scratch documents
  through the same `applyCutProposal`, so preview is exactly what commits.
- [x] **One-click Auto Cut** (`useAutoCut` + `TranscriptSection`): transcribes first
  when needed (chains on the transcript-ready document event), then plans, builds
  the proposal, selects the first cut. Engine picker labels AssemblyAI entries
  "best for auto-cut". Button disabled while a proposal is open (one review at a
  time).
- New machine setup fixed en route: committed `.npmrc` with `legacy-peer-deps=true`
  (react-simple-maps@3 peer range vs React 19 — fresh clones couldn't install).
- Pending: live CDP walkthrough (auto-cut → drag an edge → veto → apply → undo →
  redo → export) on the S3.1 test recording; StudioProposalItem gained optional
  `adjusted` flag (schema v1 unchanged — additive).

### Studio (AI video editor) — Phase S3 steps 1–2: transcription + cut planner (2026-08-08)
**Status: COMPLETE — verified end-to-end via CDP (transcribe → cancel → re-transcribe → plan JSON)**

- [x] **Whisper word timestamps are now measured, not approximated.** whisper.cpp
  runs with `-ojf` (full JSON; flag verified against the v1.8.3 binary the app
  downloads) and the new electron-free `src/main/services/whisper-output.ts`
  merges BPE tokens into words with real times + per-word confidence (min token
  p). Two traps handled and unit-tested: bare punctuation tokens carry phantom
  timestamps (a "." can sit 0.9 s after its word — timing comes from speech
  tokens only, else pause detection dies) and sub-word merging (" Auto"+"C"+"ut").
  Char-distribution approximation stays as the per-segment fallback.
- [x] **Capability snapshots, never provider branching.** `SttModelFeatures`
  gained `verbatimDisfluencies`; providers now return the features a run
  actually delivered (whisper: measured vs fallback; AssemblyAI: what was
  requested+returned), and `StudioAssetTranscript` records that snapshot +
  `sttModelId` + `wordCount` in the document. `undefined` = "not available",
  never `[]`. AssemblyAI requests `disfluencies: true` when the caller asks for
  verbatim (auto-cut does; the transcribe feature doesn't).
- [x] **Per-asset transcription is button-triggered only** (media-pool hover
  action + Inspector section with engine picker persisted in
  `settings.sttModelId`) — never on import, so b-roll/music never burn whisper
  minutes or AssemblyAI credits. Runs as the third media-job kind (serialized —
  whisper.ts tracks a single child process), streams percent, writes rich JSON
  to `cache/transcripts/<assetId>.json`, folds meta into the document on
  `ready`. Cancel mid-run removes the entry (verified live); stale
  `'generating'` from a killed session is cleaned up on cancel too.
- [x] **cutlib.py ported to `cut-planner.ts`** (pure logic, 25 unit tests): RMS
  noise floor (10th percentile), speech-run atoms, snap-to-audio tails with
  soft/punchy landings, pause compression, cut-span clamps (a tail must never
  ride into cut SPEECH — the reference repo measured 0.70 s surviving that way).
  Reference `tight`/`natural` styles from the clean-cut skill. Capability
  compensation: approximate timing widens head/tail pads instead of refusing.
  RMS comes from the waveform cache — `waveform-generator` now emits `rmsDb`
  buckets (dBFS, 20 ms grid) alongside peaks (file version 2; v1 files
  regenerate on first plan) because the stripped ffmpeg has no volumedetect.
- [x] **`studio:cutplan:run` IPC** → `cut-plan-runner.ts` loads transcript +
  envelope, writes `cache/cut-plans/<assetId>-<style>.json`, returns the plan;
  Inspector shows stats + QA notes + path. NOTHING touches the timeline —
  proposals/review are S3 step 3. Honest QA readout: non-verbatim engines get a
  "filler cutting will find less" caveat instead of implied AssemblyAI parity.
- Verified live on a 39.4 s recording with known pause positions: 73 words
  measured (`wordTimestamps: true` snapshot in project.json, survives restart),
  13 keep-segments, 12 pauses compressed, soft landing on the 3.3 s gap, style
  un-widened. Also caught live: whisper pads its final decode window past the
  real audio end (41.7 s claimed vs 39.4 s measured) — the envelope's duration
  is authoritative in the runner, not the transcript's.
- Notes: whisper-base word times still smear across some pauses (several known
  SSML breaks didn't surface as word gaps — the documented "transcript lies
  about time" failure mode; the RMS snap is what makes edges robust). AssemblyAI
  path is wired (verbatim + snapshot) but not exercised live — would spend
  credits. `npm run lint` referenced in CLAUDE.md doesn't exist as a script
  (pre-existing); gates used: `check:types` ratchet 27/22 + `npm test` (229).

### Studio (AI video editor) — Phase S2: timeline core (2026-08-07)
**Status: COMPLETE — verified end-to-end via CDP, including the Player checkpoint**

- [x] `src/shared/studio/`: `time-math` (one cumulative-rounding conversion,
  `round(b·fps) − round(a·fps)`, so 100 cuts tile with zero drift), `serialize`
  (document → frames + asset URLs), and the data-driven `TimelineComposition`
  used by BOTH the preview and the export.
- [x] Timeline document reducer + undo/redo in feature state (`useTimeline`,
  100-deep snapshot history, no global store). Pure ops in
  `services/timeline-ops.ts`: add / move (neighbour-clamped) / split /
  trim (source- and neighbour-bounded) / ripple-delete (per-track, so music
  keeps its timing) / remove-asset-clips.
- [x] Tracks/clips UI: ruler, 10-step zoom anchored on the playhead, magnetic
  snapping to clip edges + playhead, drag-move across tracks, edge trims,
  canvas waveforms, selection, keyboard (Space/S/Del/Backspace/Ctrl+Z/Y/
  arrows/Home/End). Drag preview runs the real op on a scratch document, so
  what you see mid-drag is exactly what commits.
- [x] `@remotion/player` preview over 720p proxies; playhead lives outside
  React state (imperative subscribe → DOM), so playback re-renders nothing.
- [x] Background main-process jobs (tsx-job-engine pattern): proxy generator
  (NVENC → libx264 fallback, verified on this machine) and waveform generator;
  status per asset in the document, push events folded back into it.
- [x] Export: generated Remotion entry embedding the serialized timeline
  (originals, not proxies) → existing render queue. Verified output:
  1920×1080@30, 60.000 s video / 60.053 s audio, correct picture per clip,
  black across a deliberate gap, audio bursts at the right seconds.
- [x] **Player-architecture checkpoint passed** (100 cuts, 720p proxies, dev
  build — noisy machine, so ranges): playback 16.7 ms/frame (60 fps, same as a
  2-clip timeline); scrub 17–25 ms at natural drag speed, 25–35 ms flinging
  across the whole timeline; the editor's own JS is ~1.4 ms per scrub step, so
  the ceiling is video decode, not the UI. No HTML5-seek fallback needed.
  Two fixes got it there: proxies need a short GOP (`-g 15` — the encoder
  default ~8 s made each seek decode up to 250 frames, ~20 fps), and
  `TimelineComposition` mounts only clips within ±2 s of the current frame
  (mounting all 100 sequences per frame halved scrub throughput).
- Notes: proxies/waveforms are cached per project, so the same source imported
  into two projects transcodes twice (candidate for a hash-keyed shared cache).
  `EditorShell` imports `useRenderQueue` from `@features/render-queue`,
  following the existing precedent in `features/motion` — the render queue is
  app-level infrastructure exposed through context.
- Pre-existing bug noticed while testing (NOT introduced here, affects all
  renders): the queue shows "Bundling... 10000%" — `render-handlers.ts`
  multiplies an already-0–100 bundler percent by 100 again.

### Studio (AI video editor) — Phase S1: projects & editor shell (2026-08-07)
**Status: COMPLETE — verified end-to-end via CDP**

- [x] Document schema v1 in `src/shared/types/studio.ts` (seconds-only unit
  discipline, provenance, proposals); IPC contracts in
  `src/shared/ipc/types/studio.ts`; 9 `STUDIO_*` channels.
- [x] Main services (`src/main/services/studio/`): `studio-paths` (id
  validation + cache-path traversal guard), `project-store` (folder-as-truth
  listing, atomic tmp+rename saves, `shell.trashItem` delete with rm
  fallback, reuses `reserveProjectFolder`), `media-import` (ffprobe probe for
  video/audio/image, ffmpeg thumbnails to `cache/thumbs/`, content-hash for
  future relink).
- [x] Settings: `studioProjectsRoot` (default `~/Videos/VidTSX Studio`),
  changeable from the browser toolbar via the existing folder dialog.
- [x] Renderer: `ProjectBrowser` (grid cards, two-step delete),
  `NewProjectDialog` (Landscape/Portrait/Square presets + fps),
  `EditorShell` (CapCut layout: media pool | aspect-correct preview stage |
  Inspector+Assistant tabs | full-width timeline scaffold with ruler and
  V1/A1 lanes), debounced document autosave (`useStudioProject`),
  per-project agent provider picker persisted in `settings.agent`.
- [x] CDP-verified: create portrait 1080×1920@60 project → on-disk scaffold
  correct → provider select persists (atomic-save rename observed in USN
  journal) → back → card grid → delete → folder in Recycle Bin, empty state.
  Manual test remaining: media import (native file dialog can't be driven
  via CDP) — probe/thumbnail path is exercised in code but not clicked
  through. S2 exercised everything downstream of it by writing asset entries
  straight into project.json.
- Automation gotcha recorded: `App.tsx` keeps every visited screen mounted
  (`display: none`), so DOM-driving MUST filter to visible elements
  (`offsetParent !== null`) or clicks land on hidden screens' buttons.

### Studio (AI video editor) — Phase S0: gate & scaffold (2026-08-07)
**Status: COMPLETE**

Full architecture + phase plan (S0–S7) in `docs/studio/PLAN.md`. Locked
decisions: Remotion-native `TimelineComposition` for both preview (over 720p
proxies) and export; solid manual timeline core (S2) before auto-cut (S3);
user-chosen studio projects root (folder-as-truth); local whisper default with
AssemblyAI opt-in for word timestamps. Engine knowledge and skills ported from
`D:\repos\claude-youtube-editor` (cutlib planner, render-drift lessons,
clean-cut/make-tsx/suggest-sfx editorial policy).

- [x] Flags `studio: true` (nav teaser) / `studio-editor: false` (prod shows
  Coming Soon, dev fully enabled) — Flows-style gating.
- [x] `src/features/studio/` scaffold: gated `StudioScreen`, draft v1 timeline
  document schema in `types.ts`, barrel.
- [x] Sidebar nav item (Clapperboard, after TSX) + `screens` map entry.

### v1.0.0 — First public release (2026-07-29)
**Status: COMPLETE**

Public scope: TSX Creator, Image Studio, Transcribe, Assets, render queue,
and AI Models (System / Providers / Audio-whisper / Image). Everything else
stays visible as "Coming soon" in production and fully enabled in dev.

- [x] Image Studio local models: `LocalSdImageProvider` bridges the sd-cli
  engine into the cloud ImageEngine (provider id `local`, auto-offered when
  ≥1 ready on-device model). Promise-based `enqueueAwait` on the local
  engine; shared generation preflight (`applySdGenerationPreflight`);
  provider switch persists. Verified end-to-end via CDP (bk-sdm-tiny 256²).
- [x] Coming-soon gating (prod only): AI Models Video/LLMs/Embeddings tabs
  (`ai-video-models` / `ai-llm-models` / `ai-embedding-models` flags; 3D was
  already a placeholder), Flows editor (`flows-editor` flag — nav stays),
  sherpa voice-engine section of the Audio tab (existing `audio-engine`
  flag). Creator's keyless "Local Models" preset is gated on real
  `llmLocalEngine.isAvailable()` because production builds exclude
  node-llama-cpp.
- [x] Repo made public-ready: README.md written, personal scratch notes
  untracked, no secrets/keys in tree (verified), MIT license.
- [x] v1.0.0 Windows installer built and published as a GitHub release.

### TSX Generator stabilization + parallel jobs (Creator)
**Status: COMPLETE — committed 2026-07-23**

Full plan in `docs/tsx-generator-stability-plan.md`; contributor guide in
`docs/tsx-generator-architecture.md`.

- [x] **Phase 1** — stability foundation: compat-provider abort, agent-sdk
  error-result detection, save/auto-save races, retry-with-backoff,
  string-based validate, `npm run check:types` ratchet gate.
- [x] **Phase 2** — main-process job engine (`src/main/services/tsx-jobs/`):
  up to 4 concurrent generations with isolated `ClaudeSession`s, per-job
  provider + cancel, atomic project naming, queued-job persistence, will-quit
  shutdown.
- [x] **Phase 3** — job-based Creator UI: jobs strip, center-panel ownership
  rule, edits/fixes as jobs.
- [x] **Phase 4** — token streaming, per-project `chat.json` refinement
  history, pipeline tests, `local` + Z.AI providers, **props panel**
  (AST prop extraction + live preview inputProps), custom-provider UI
  (any OpenAI/Anthropic-compatible endpoint), library placeholder rows,
  maxConcurrent setting, coalesced library rescans.
- Z.AI preset verified against docs 2026-07-23: base URL
  `https://api.z.ai/api/anthropic`, model `glm-5.2` (opt: `glm-5.2[1m]`).

### Local AI Models redesign (open-source cleanup)
**Status: COMPLETE (Phases 0–4) — committed; field-verification pending**

Replaced the download-centric SD/Flux catalog (hosted on learnwithhasan.com) with
a ComfyUI-style, folder-as-truth model library built on a category-agnostic core.
Zero owner infrastructure for image models. See
`docs/local-image-models-redesign.md` (design) + `docs/local-image-models-implementation.md`
(plan + full Progress Log).

- [x] **Phase 0** — vitest tooling + type-error baseline (node 36 / web 44).
- [x] **Phase 1** — category-agnostic model-library core (`src/shared/model-library/`,
  `src/main/services/model-library/`): scanner, classifier, sidecars, importer,
  usage-store, category/runtime registries. Electron-free, injectable, 37 tests.
- [x] **Phase 2** — image adapter + registry rework: `SdModelDefinition`→profile
  envelopes (34 entries), `flux`→`flux1`/`flux2`, companion resolution, deleted
  `SD_MODELS_BASE_URL`, generic `MODELS_*` IPC, engine on an injected resolver.
- [x] **Phase 3** — dedicated flag-gated "AI Models" sidebar screen; image library
  view rewritten onto `MODELS_SCAN` (`useImageLibrary` + Header/Installed/Catalog/
  SetupDialog); dashboard Library card; deleted hidden GeneralTab folder block.
- [x] **Phase 4** — deleted audio `MODELS_BASE_URL` + fallback, orphaned
  `useSdImageModels`; fixed the dangling NSIS `build/license.txt` reference
  (→ committed `LICENSE.txt`) so `build:win` completes. 67 tests; node 36 / web 36.

**Pending before this ships (flagged in the Progress Log):**
- Interactive UI click-through of the AI Models screen (not run — non-interactive session).
- Catalog metadata verification: FLUX.2 Klein companion source links + the 13
  link-only `sourceUrl`s are best-effort, not network-verified; verify with a real sd-cli.
- sd-cli binary distribution story (still not bundled).

### Captions Generator
**Status: COMPLETE**

- [x] 4-step wizard UI (StepCard components)
  - Step 1: Add audio/video (AudioDropZone with drag & drop)
  - Step 2: Transcribe (ModelSelector with whisper integration)
  - Step 3: Choose caption style (CaptionTemplateSelector)
  - Step 4: Render options (WebM overlay, Burn into video, Export JSON)
- [x] useCaptions hook for wizard state management
  - Step progression logic
  - Transcription integration via existing whisper IPC
  - Style selection
- [x] 3 caption templates (Remotion compositions):
  - BoldPopCaptions: Large centered text with spring pop animation
  - KaraokeCaptions: Word-by-word highlight effect
  - MinimalCaptions: Clean subtitles at bottom with dark bar
- [x] caption-builder service (duration calculation, config generation)
- [x] CaptionPreview with VideoPlayer integration
- [x] Render queue integration:
  - Export WebM overlay (vp8 codec, transparent)
  - Burn into video (h264 codec)
  - Export captions JSON
- [x] Reuses whisper:transcribe IPC from transcription feature

### Phase 5 — Render queue system
**Status: COMPLETE**

- [x] Step 5.2 — Render queue service and UI
  - [x] RenderQueueJob type with full metadata (id, fileName, status, progress, etc.)
  - [x] queue-manager.ts utilities (generateOutputPath, formatFileSize, etc.)
  - [x] RenderQueueContext with state management, IPC event listeners
  - [x] Auto-start next queued job when current completes
  - [x] Debounced persistence to ~/.vidtsx/render-queue.json
  - [x] Load on startup with interrupted job handling
  - [x] Clean up jobs older than 7 days
- [x] IPC handlers added:
  - RENDER_QUEUE_SAVE for persisting queue
  - RENDER_QUEUE_LOAD for loading queue on startup
  - RENDER_OPEN_FILE for opening rendered files
  - RENDER_OPEN_FOLDER for revealing in explorer
  - RENDER_GET_VIDEOS_DIR for default output folder
- [x] UI components created:
  - RenderScreen with toolbar and job list
  - RenderItem with status icons, progress bar, actions
  - RenderProgress wrapper for status-colored progress bar
- [x] Toast notification system (shared component + context)
- [x] Sidebar badge showing active/queued job count
- [x] Render button in WorkspaceScreen integrated with queue

### Phase 4 — Code editor + props panel
**Status: COMPLETE**

- [x] Monaco code editor integration
- [x] Code + visual view mode toggle
- [x] Resizable divider between code and preview
- [x] Auto-save with transpilation refresh
- [x] Props panel (delivered later with the TSX Generator work, 2026-07-23):
  AST-based `props-parser`, `PropsPanel`/`PropField` controls
  (text/number/toggle/color/select), live preview updates via Player
  `inputProps`

### Phase 3 — Remotion player integration
**Status: COMPLETE**

- [x] VideoPlayer component wrapping @remotion/player
- [x] PlayerControls with play/pause, seek, timeline, loop, speed control
- [x] useComponentLoader hook for TSX transpilation
- [x] Native module loading with virtual module globals (setupVirtualModuleGlobals)
- [x] Error boundary and loading states for player
- [x] Screenshot functionality (copy to clipboard, save to file)
- [x] Fullscreen support

### Phase 2 — Workspace + file management
**Status: COMPLETE**

- [x] Step 2.1 — File tree UI component
- [x] Step 2.2 — File management features:
  - [x] "New folder" button in toolbar with inline name input
  - [x] Right-click context menu (native Electron Menu):
    - File: Rename, Delete
    - Folder: Rename, Delete, New subfolder
  - [x] Inline rename (click turns label into input, Enter saves, Escape cancels)
  - [x] Drag-and-drop .tsx files onto window (with visual overlay)
  - [x] Paste TSX from clipboard (Ctrl+V detects TSX-like content)
  - [x] SelectedFileContext for sharing selected file across screens
- [x] IPC channels added:
  - FILE_RENAME for renaming files/folders
  - FILE_GET_PROJECTS_DIR to expose projects directory to renderer
  - CONTEXT_MENU_SHOW for native context menus
  - CLIPBOARD_READ_TEXT for clipboard access
- [x] Components created:
  - InlineRenameInput for inline editing
  - DropZoneOverlay for drag-drop visual feedback
  - SelectedFileContext/Provider for state management

### Phase 1 — App shell + navigation
**Status: COMPLETE**

- [x] Title bar with traffic lights (macOS) / system buttons (Windows)
- [x] Sidebar with 7 navigation icons + settings at bottom
- [x] Screen routing between all 7 screens
- [x] Placeholder screens for each feature
- [x] Reusable shared components:
  - [x] Button (primary/secondary variants, sm/md sizes)
  - [x] Panel (dark surface with optional header)
  - [x] Badge (free/pro variants)
  - [x] ProgressBar (4px height, multiple colors)
  - [x] TextInput (styled input with focus state)
  - [x] IconButton (toolbar actions)
- [x] Barrel export from src/shared/components/index.ts
- [x] WorkspaceScreen updated to use Panel + Button

### Phase 0 — Project scaffold
**Status: COMPLETE**

- [x] Electron 41.0.2 installed and working
- [x] electron-vite 5.0.0 configured as build tool
- [x] TypeScript 5.9.3 with separate configs (node/web)
- [x] React 19.2.4 rendering in Electron window
- [x] Tailwind CSS 4.2.1 with custom theme colors
- [x] Path aliases (@main, @renderer, @features, @shared)
- [x] Preload script with contextBridge
- [x] Typed IPC foundation (22 channels)
- [x] Full folder structure with barrel exports
- [x] electron-builder configured for Windows/macOS

---

## Known issues / tech debt

- `scripts/dev.js` wrapper needed to clear `ELECTRON_RUN_AS_NODE` env var (VSCode terminal issue)
- `@rollup/rollup-win32-x64-msvc` added to optionalDependencies as workaround for npm bug
- Tailwind CSS native binaries (`lightningcss`, `@tailwindcss/oxide`) require explicit install on Windows

---

## Deviations from plan

- Using `scripts/dev.js` wrapper instead of direct `electron-vite dev` due to VSCode environment variable conflict

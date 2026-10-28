# E2 — Generation writes loudness-normalized files with category/tags; `usedIn` written on every landing
status: FIX

> Track E, session 5. **Work only in the worktree** `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E\wt`
> (branch `end-to-end-p0-e`); paths below are relative to it. Decisions E-d1…E-d10 + E-d2a in ORCHESTRATOR.md
> "Session 4 — track E" and the session-5 overrides ("Session 5") bind this part. E1 (`a35aef3` + fix round 3)
> is the base: `kind` / `probe` / `probeStamp` / `tags` / `audio` / `usedIn` exist as optional index fields;
> since `841e311` (builder #2) generation writes `tags` + `audio`; since `68bbe44` (builder #3) `usedIn` is written on
> the three landings (§4 done); since `3084668` (builder #4) the listing row prints category / tags / LUFS / `usedIn`
> (§5 done — the code of E2 is complete). **The LIVE step is DONE (builder #5, 2026-10-24): the exit's items 1–4,
> the ceiling-binding case and the music path ran through the REAL handlers on the E2 profile with the stand-ins,
> every number is in `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\exit.json` + `exit-summary.md`; the live CDP
> click-through (port 9262) and its still are taken; the gates ran (under Verified).** **The RECORDS are written
> (builder #6, 2026-10-28, `3249cbe`, docs only): the Status.md entry at the top (`Status.md:10-192`), TESTING §18.15
> (`docs/studio/TESTING.md:492-506`), V4-N1. E2 is DONE on the builder side; the E2 verifier (round 1) is next.**

## Goal (the §3 row verbatim + the exit)

| **E2** | Generation writes loudness-normalized files with category/tags; `usedIn` written on every landing | a generated SFX appears with duration, tags, −20 LUFS, and the project id after insert |

**Exit:** a generated SFX appears with duration, tags, −20 LUFS, and the project id after insert.

**How the exit is measured (orchestrator):** on an isolated profile (E-d3: `…\vidtsx-e2e\profiles\E2\profile`,
copied from `source` WITHOUT `settings\settings.db*`; library root `<profile>\assets`, confirmed from the running
app; Studio root set FIRST to a scratch root on D:, e.g. `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E2\root`,
with one small fresh project), **no ElevenLabs call** (E-d6): the stand-in returns a LOCALLY MADE sound at the
engine boundary (the `AudioGenerationProvider` result) — e.g. 2.0 s of band-limited noise with a short tail,
made by the profile's `ffmpeg-full`, deliberately NOT at −20 LUFS and with a peak near 0 dBFS so both the gain
and the ceiling matter. Then, through the REAL tool handlers (`buildAudioTools(ctx)` → `generate_sfx` →
`generateAudioAsset`; `insert_asset`), the generated file must:
1. land under `generated/` as `sfx-<slug>.<ext>` and get an index entry with `kind: 'audio'`, `origin:
   'generated'`, `probe.duration` within 10 ms of an INDEPENDENT ffprobe (the profile's `ffmpeg-full` n8.1.2),
   `tags` = the tool's tags (plus whatever the design derives), `audio: { category, loudnessLufs, peakDbfs,
   source, model }` filled;
2. measure, with a meter INDEPENDENT of the product code (the source profile's `ffmpeg-full` `ebur128` for
   integrated LUFS + true peak, `astats` for sample peak), integrated loudness **−20 ± 0.5 LU** and peak **≤ −1.5
   dBFS** — and the recorded `loudnessLufs` / `peakDbfs` within ±0.5 LU / ±0.5 dB of that independent reading;
3. after `insert_asset({ assetId: 'library:<relPath>', lane: 'audio', … })` on the project (or after the
   generate tool's own import — say which), have `usedIn` = `[<projectId>]` in the index, deduplicated on a
   second landing in the same project;
4. show all of it in `list_assets(scope:'library')`: duration, category, tags, the LUFS, `usedIn` on the row.
Plus: the **ceiling-binding case** (a quiet sound where −20 LUFS would push the peak over −1.5 dBFS → the gain is
clamped to the ceiling, the recorded LUFS is honestly above −20 and the peak is at the ceiling — the `gen_sfx.py`
rule), the **short-transient case** (a sound under ~0.4 s: EBU R128 integrated loudness is gated / unreliable →
the fallback rule, see below), and the music path (`generate_music` runs through the same `generateAudioAsset`),
each with a unit test through the REAL bundled ffmpeg. The two other landings (`generate_tsx_shot` assetRefs,
the pool import by path) write `usedIn` too — unit-tested at least. A live CDP click-through on the E2 profile
(the worktree's own build) shows the generated sound in the Assets screen (`generated` folder) with its
duration; no model call is needed for E2 (E-d9) — the generation itself is driven through the real handlers.
Plus the session gates (DRIVING "Track E": worktree vitest green except the three E-d2a resolution suites +
rule (b); `tsc` web 26 / node 10; Status.md row at the top; TESTING §18.15 — E-d10).

## Plan context

- **T6 (decision, second + fourth bullets, verbatim):** "`generateAudioAsset` normalizes to the palette defaults
  (**−20 LUFS under a −1.5 dBFS ceiling**, §4 Q2), probes the duration, and records `category` + `tags` from the
  tool args." · "`usedIn[]` (project ids, written when a `library:` ref lands in a project through
  `insert_asset`, `generate_tsx_shot` assetRefs or the pool import)."
- **Q2 (Hasan, in force):** generated SFX normalized at generation to −20 LUFS under −1.5 dBFS.
- **E-d6 (stand-in):** no ElevenLabs call, no key in any profile. The stand-in enters at the engine boundary
  (the HTTP response / engine result); everything after it is real (save → normalize → probe → index → import →
  insert). A stand-in seam reachable in the live app is dev-only (inert when packaged — e.g. registered only
  when `!app.isPackaged` and an env var names the file) and is named in STATUS. The one live ElevenLabs call goes
  on Hasan's real-video list.
- **E-d7 (loudness):** −20 LUFS integrated under a −1.5 dBFS peak ceiling (palette defaults:
  `D:\repos\claude-youtube-editor\media\library\sfx\palette.json` `defaults {prompt_influence 0.45, target_lufs
  −20.0, ceiling_dbfs −1.5, model eleven_text_to_sound_v2}`); the ceiling rule is ported from the editor repo's
  `tools/gen_sfx.py` `normalize_clip()` (:99-114, read-only; Python only with `-I -B`): measure I (ebur128) and the
  peak; if the peak is unmeasurable → leave; if I is None or **I < −50** (ebur128 gated the clip) → peak-normalize
  to the ceiling (`gain = ceiling − peak`); else `gain = target − I`, and if `peak + gain > ceiling` → `gain =
  ceiling − peak`; skip when |gain| < 0.1 dB; apply as ONE re-encode with `volume=<gain>dB`; then re-measure and
  record. The product path must work on the **bundled (stripped) ffmpeg** — the full ffmpeg is an optional
  download and is not assumed. LUFS is verified with an independent meter; tolerance ±0.5 LU where the ceiling
  does not bind.
- **§1.6 facts (verified 2026-10-21, re-checked 2026-10-24 in the worktree):**
  - `generateAudioAsset` (`src/main/services/library/generate-audio-asset.ts:79-124`): `audioGenerationEngine.generate(…)`
    → `result.bytes` / `result.ext` / `result.durationSec` / `result.model` / `result.providerId` / `costUsd` →
    `reserveLibraryFile(root, folder, `${kind}-${slug}`, ext)` → `fs.writeFile` → `upsertEntry(root, relPath,
    { origin: 'generated', description, brandId? })`. **No probe, no loudness, no tags**; `durationSeconds` is the
    requested length or a CBR estimate. Also used by the agents' `generate-audio.ts` tool — the normalization
    applies there too (a library-wide property).
  - The engine: `src/audio-engine/generation/audio-generation-engine.ts` (`register` :93, `generate` :116; a
    `Map<string, AudioGenerationProvider>`), types `src/audio-engine/generation/types.ts` (`AudioProviderResult {
    bytes, model }` :90, `AudioGenerationResult { providerId, model, bytes, ext, durationSec, costUsd? }` :105,
    `AudioGenerationProvider` :98); the ElevenLabs provider `providers/elevenlabs-audio-provider.ts` (MP3 back;
    `output_format` query param). Registration: `src/main/services/audio-generation-init.ts` (lazy, from the BYOK
    credentials; `register` :56, `unregister` :52) — the stand-in registers beside it, dev-only.
  - Studio tools `generate_sfx` / `generate_music` (`src/main/services/studio/agent-tools/audio-tools.ts:81-136`;
    args today: `prompt, durationSeconds, loop, promptInfluence` / `prompt, durationSeconds, instrumental,
    compositionPlan, seed`) → `generateAndImport` (:55-78) → `generateAudioAsset` → `importLibraryFile(ctx,
    relPath)` → the text names the project asset id for `insert_asset`. **E2 adds `category` + `tags` args** (T6)
    and passes them through to `audio.category` / `tags`.
  - **The three landings of a `library:` ref (T6) — the `usedIn` seams:** (1) `importLibraryFile`
    (`agent-tools/library-import.ts:31-60`; reached by `insert_asset`'s `resolveAssetRef` :20, by
    `generate_sfx` / `generate_music`, by every W3 tool taking a `library:` ref); (2) `resolveShotAssetRefs`
    (`src/main/services/studio/shot-asset-refs.ts:93-153`, `importMediaFiles` at :136 — `generate_tsx_shot` assetRefs);
    (3) the pool import `src/main/ipc/studio-handlers.ts:297` `importMediaFiles(data.projectId, filePaths)` — the
    user's own import of a file that lies UNDER the library root (`toLibraryRelPath`). `shot-build-media.ts:127`
    and `shot-bundle-media.ts:23` also import — check whether a library file can reach them. `ctx.req.projectId` is
    at hand in (1) and (2); (3) has `data.projectId`. Main owns the library index (`library-index-io.ts`, the per-root
    serialize chain) — a `usedIn` write is an index patch, never a `project.json` write (main never writes it).
  - `insert_asset` (`agent-tools/insert-tools.ts:36-133`): `assetId` = project asset id or `library:<path>`; `lane
    'audio'` requires `asset.kind === 'audio'` (:58-61); `gain` 0–4; the clip kind is `'audio'`, never `'sfx'`, **no
    fades** (`src/features/studio/services/apply-insert-proposal.ts:46-59`) — not E2's to change.
  - `list_assets(scope:'library')` rows: `agent-tools/library-listing.ts` `formatLibraryRow` (E1) prints `(kind,
    N.NN s, origin, brand) — "description"`; E2 adds category / tags / LUFS / `usedIn` (E3 adds `kind` + `query`
    filtering and the top-3 matching). The listing is capped at 150 rows.
  - Index types (`src/shared/types/asset-library.ts`): `LibraryAudioMeta { category?, loudnessLufs?, peakDbfs?,
    source?, model? }`, `LibraryIndexV2Fields { kind?, tags?, audio?, usedIn?, probeStamp? }` — all optional (E-d5:
    the pre-E1 reader keeps them on entries it does not rewrite; an old scan's RESURRECT of a tombstone drops them —
    E1 R1). `upsertEntry` (`library-store.ts`) already passes `tags` / `audio` through.
  - Reference catalogs (read-only): `sfx/catalog.json` 45 clips `{id, file, category, tags[], duration_s, peak_dbfs,
    loudness_lufs (−20.0), source 'elevenlabs:sound-generation', model, license, prompt, used_in[]}`;
    `music/catalog.json` 6 clips (+ `requested_ms`, `force_instrumental`, source `'elevenlabs:music'`, model
    `music_v2`). E4 imports them; E2's field names must line up (`audio.category` ← `category`, `tags` ← `tags`,
    `audio.loudnessLufs` ← `loudness_lufs`, `audio.peakDbfs` ← `peak_dbfs`, `audio.source` ← `source`, `audio.model` ←
    `model`, `usedIn` ← `used_in`).
- **The bundled ffmpeg (orchestrator, 2026-10-24, `node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe`,
  n7.1):** filters present: `loudnorm` (with `print_format` 0–2 → the analysis pass prints `input_i`, `input_tp`,
  `input_lra`, `input_thresh` as JSON when run with `-f null -`), `volume`, `aformat`, `aresample`, `atrim`, `apad`,
  `silencedetect`, `anullsrc`. **Absent: `ebur128`, `astats`, `volumedetect`, `alimiter`, `dynaudnorm`.** Audio
  encoders: `libmp3lame`, `aac`, `libfdk_aac`, `libopus`, `opus`, `pcm_s16le`. Muxers: `mp3`, `wav`, `mp4`, `ogg`,
  `opus`, `adts`, `null`. So the product measures with a `loudnorm` analysis pass (integrated I and TRUE peak dBTP)
  and applies the gain with `volume` — note `input_tp` is a true peak, the catalogs' `peak_dbfs` is a sample peak
  (true peak ≥ sample peak, so a −1.5 dBTP ceiling is at least as safe); say in the type comment / STATUS which one
  `peakDbfs` holds. The independent meter: `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\source\profile\ffmpeg-full\
  ffmpeg-n8.1.2-50-g1a748fe2cd-win64-gpl-shared-8.1\bin\ffmpeg.exe` has `ebur128`, `astats`, `volumedetect`,
  `loudnorm`, `alimiter` (never run the app on `source`; reading its binaries is fine).
- **mp3 after a re-encode:** `libmp3lame` through the `mp3` muxer writes a Xing/Info + LAME tag (encoder delay +
  padding) → E1's `mp3-gapless.ts` trims the probe exactly; the independent ffprobe n8 trims it too. Keep the
  original extension (the catalogs are mp3) unless the design argues otherwise — state the bitrate.
- **Carried from E1's verifier round 4 (docs, small — do them in E2's Status / TESTING pass):** (V4-N1) the E1 entry's W2
  line (`Status.md:98`, `TESTING.md:486`) lists proxies (`proxy-generator.ts:231`) among the consumers of the probe's
  width / height, but `proxy-generator.ts` reads only `probe.duration` and `probe.hasAudio` (`:251`, `:321`) — drop
  proxies from that list (the fix-round-3 sentence at `Status.md:199` is the right one; it may say "duration + hasAudio");
  (V4-N2) if you touch `src/main/services/library/pre-e1-control.test.ts`, rename the case at `:182` so its title says
  what it pins ("keeps every field under old writes that do not resurrect it") — a test-title rename only.
- **§5 items touching E2:** none directly ("arnndn availability" is track D's). Docs to update when built:
  STATUS per part, TESTING §18 (18.15).
- **Session-5 overrides:** no paid-key call; model calls not needed for E2; isolated profile only; the resource
  guard (C: ≥ 3 GB and C: + headroom ≥ 6 GB before a launch / copy; watchdog at 1.5 GB — kit
  `.vidtsx-temp/end-to-end/E1/watchdog.ps1`; `--maxWorkers=2` while headroom < 10 GB); E-d4 before any launch
  (Hasan's app: 0 `electron.exe` at 08:38 — re-check); CDP port **9262**; profile `…\profiles\E2\profile`;
  per-part scratch `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E2\`; big outputs
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\`.
- **E1's kit to copy from** (`D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E1\`): `launch.sh` (the worktree launch
  recipe, DRIVING "Track E"), `restore.ps1`, `watchdog.ps1`, `cdp.mjs`, `vitest.e1.config.ts` (a scratch vitest config
  with its own `cacheDir`, run as `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config <cfg>
  <file>`), `list-assets.e1.test.ts` / `upsert.e1.test.ts` (how to call the REAL handlers against a profile's library
  root with the app stopped: they `vi.mock('electron')` so `app.getPath('userData')` is the profile and mock
  `src/main/services/settings-db` to return no override, so the real `getLibraryRoot()` is `<profile>assets`; read them).

## Done (file:line, commit hashes)

### Design note (builder #1, 2026-10-24 — read before building; it binds the rest of E2)

Code read: `generate-audio-asset.ts` (all), `audio-generation-engine.ts` (`registerInstance` :92 — "the door for a
keyless provider", `generate` :116-160: **`ext: '.mp3'` is hard-coded** at :158, `costUsd = rate × durationSec`, rate 0 →
`0`), `types.ts`, `audio-generation-init.ts` (all; the BYOK loop :49-62), `audio-tools.ts` (all), `library-import.ts`
(all), `library-listing.ts` (all) + its test, `library-store.ts` (all; `upsertEntry` :135-186 returns the entry WITH
`probe`), `library-index-io.ts` (all; `updateIndex` :118 = the chain), `library-paths.ts` (all), `asset-library.ts`
(all), `shot-asset-refs.ts:93-153`, `studio-handlers.ts:275-302`, `ffmpeg-bin.ts` (`getFfmpegBinary`, `runFfmpeg` with
`onStderr` — the spawn helper the normalizer reuses), `media-import.ts` (`probeMedia` :99-140, `hashFileHead`,
`importMediaFiles`' callers), `shot-build-media.ts:112-130`, `shot-bundle-media.ts:1-45`, the three audio tests,
`vitest.config.ts`, `utils/paths.ts` (imports `electron` → every real-ffmpeg test mocks `../../utils/paths` to
`getRemotionBinariesDir: () => null`, like E1's `media-import-probe.test.ts`; `@remotion/renderer` then resolves the
compositor package from the main checkout's `node_modules`, as E1's kit proved). Bundled ffmpeg n7.1 re-checked
2026-10-24: `sine anullsrc loudnorm volume aformat aresample atrim apad amix concat` present; **no `anoisesrc`**, no
`ebur128 / astats / volumedetect / alimiter`; encoders `libmp3lame aac libfdk_aac libopus opus pcm_s16le`; muxers
`mp3 wav mp4 ogg opus null`.

1. **The normalize step (a).** Two modules under `src/main/services/library/`:
   - `audio-loudness-rule.ts` (pure, no IO): `LOUDNESS_TARGET_LUFS = -20`, `LOUDNESS_CEILING_DBFS = -1.5`,
     `LOUDNESS_GATED_BELOW_LUFS = -50`, `LOUDNESS_MIN_GAIN_DB = 0.1`; `parseLoudnormStats(stderr)` → `{ inputI, inputTp }`
     (numbers; `-inf` → `-Infinity`; null when the JSON block is missing); `planLoudnessGain(stats, target, ceiling)` =
     the `gen_sfx.py normalize_clip()` rule verbatim: peak unmeasurable (`-Infinity` / NaN) → leave (gain 0, `gated`);
     I not finite or I < −50 → `gain = ceiling − peak` (`gated`); else `gain = target − I`, and if `peak + gain >
     ceiling` → `gain = ceiling − peak` (`clamped`); |gain| < 0.1 → `skipped` (gain 0). Returns `{ gainDb, clamped, gated,
     skipped }`.
   - `audio-normalize.ts` (ffmpeg, ≤ 300 lines): `measureLoudness(abs)` = ONE `loudnorm` analysis pass
     (`-i abs -af loudnorm=I=-20:TP=-1.5:LRA=11:print_format=json -f null -`, `input_i` / `input_tp` read off stderr —
     `input_tp` is a TRUE peak, dBTP, 4× oversampled); `applyGain(abs, gainDb)` = ONE re-encode `-af volume=<g>dB`
     into `<abs>.norm-tmp<ext>` then `fs.rename` over the original, **same extension**, codec by extension: `.mp3` →
     `libmp3lame -b:a 192k` (one step above ElevenLabs' `mp3_44100_128`, so the second lossy generation adds little;
     sample rate / channels kept), `.wav` → `pcm_s16le`, `.m4a` / `.aac` → `aac -b:a 192k`, `.ogg` / `.opus` →
     `libopus -b:a 128k`, anything else → failure "unsupported container"; `normalizeAudioFile(abs, { signal? })` =
     measure → plan → (apply → re-measure) → `AudioNormalizeResult { normalized, loudnessLufs?, peakDbfs?, gainDb,
     clamped, gated, skipped, error?, before?: { loudnessLufs?, peakDbfs? } }`. **It never throws and never loses
     bytes:** any ffmpeg failure (missing binary, non-zero exit, 120 s timeout via `AbortSignal`, bad JSON) deletes the
     temp output, leaves the original untouched and returns `normalized: false` + `error` (with the measured values
     when the measure pass worked). `skipped` and digital silence (peak `-inf`) return `normalized: true, gainDb 0`
     without a re-encode. `loudnessLufs` / `peakDbfs` are the RE-MEASURED values after the re-encode (what the file
     actually is — an mp3 re-encode can move the peak by a few tenths of a dB on transients; recorded truthfully, the
     ceiling is applied pre-encode to the true peak).
   - Call site: `generateAudioAsset` between `fs.writeFile` and `upsertEntry` (passes `req.signal`); the `audio`
     meta it writes = `{ category?, loudnessLufs?, peakDbfs?, peakKind: 'true', source: result.providerId, model:
     result.model, gainDb, normalizeError? }`; `tags` when given. `GeneratedAudioAsset` gains `normalized`,
     `loudnessLufs?`, `peakDbfs?`, `normalizeError?`, `category?`, `tags?`, and **`durationSeconds` becomes the index
     probe's duration** (`upsertEntry`'s returned `probe.duration`) when it exists, else the engine's figure. The tool's
     answer prints LUFS / peak / category / tags, and on a failure says "NOT loudness-normalized (<reason>) — the raw
     file is kept".
   - Types (`asset-library.ts`, optional only): `LibraryAudioMeta` gains `peakKind?: 'true' | 'sample'` (E2 writes
     `'true'`; E4 maps the catalogs' sample peak with `'sample'`), `gainDb?`, `normalizeError?`; the `peakDbfs` comment
     says which peak each writer stores.
2. **The stand-in (b), E-d6.** `src/audio-engine/generation/providers/standin-audio-provider.ts`:
   `StandinAudioProvider(filePath)` with `id = 'standin'`; `generate()` reads the file's bytes (the file **must be an
   mp3** — the engine's `ext` is hard-coded `.mp3`, :158, left as is), returns `{ bytes, contentType: 'audio/mpeg', model:
   'standin' }`; `pricePerSecondUsd` → `0` so the engine records `costUsd 0`. Registration `src/main/services/
   audio-generation-standin.ts` `registerDevStandinProvider()`: only when `!app.isPackaged` AND `process.env.
   VIDTSX_AUDIO_STANDIN_FILE` names an existing file; called at the END of `initAudioGenerationEngine` (after the BYOK
   loop, so a real key — registered first — stays the active provider; `activeId ??=`). Inert when packaged; named in
   STATUS. The exit driver (app stopped, E1-kit pattern) sets the env var and mocks `electron` (`app.isPackaged: false`,
   `app.getPath('userData')` = the E2 profile).
3. **`category` + `tags` (c).** `generate_sfx` / `generate_music` gain `category?: string` (described with the catalog
   vocabulary motion / tension / emphasis / snap / foley / reward / texture / impact; music: bed / sting / …; free
   string, trimmed + lower-cased) and `tags?: string[]` (`normalizeTags` in `library-filing.ts`: trim, lower-case,
   dedupe, drop empties, cap 20). `GenerateAudioAssetRequest` gains `category?` / `tags?`. The design derives NO extra
   tags (the kind is the filename prefix, the category has its own field). `audio.source` = the provider id
   (`elevenlabs` / `standin`), `audio.model` = the engine result's model. The agents' `generate_audio` tool keeps its
   args (it gets the normalization for free); its test stays green with a `normalized: true` mock.
4. **`usedIn` (d).** `src/main/services/library/library-used-in.ts`: pure `addUsedIn(entry, projectId): boolean`;
   `markLibraryUsedIn(root, relPaths, projectId)` → `updateIndex` on the per-root chain (E-d5 serialize path, `rev: 2`),
   patches EXISTING entries only (a file under the root the index has never seen is left to the next scan — logged),
   deduplicated, returns false from `mutate` when nothing changed (no write), never throws (warn) so no import fails
   on an index hiccup; `markLibraryUsedInForPaths(projectId, absPaths)` = the same for absolute paths, keeping only
   those under `getLibraryRoot()` (new pure `libraryRelPathOf(root, abs): string | null` in `library-paths.ts`). The
   three seams: (1) `importLibraryFile` marks on BOTH returns (existing asset and fresh import) — so `generate_sfx`'s
   own import writes `usedIn` and `insert_asset`'s `resolveAssetRef` re-marks (a no-op); (2) `resolveShotAssetRefs`
   collects every library relPath it resolved (existing or imported) and marks once after the loop with `project.id`;
   (3) `handleStudioMediaImport` calls `markLibraryUsedInForPaths(data.projectId, assets.map(a => a.path))` after
   `importMediaFiles`. `shot-build-media.ts` / `shot-bundle-media.ts` import a shot's own `vN.assets/` and
   `staticFile()` files from the shot folder — a library file cannot reach them; stated, not wired.
5. **The listing row (e).** `formatLibraryRow` appends, after the description and only when present: ` · category:
   motion` · ` · tags: whoosh, air` · ` · −20.0 LUFS` (one decimal; ` (not normalized)` when `normalizeError`) · ` · used
   in: p1, p2`. Entries without the fields print exactly as in E1 (the E1 listing tests hold unchanged).
6. **Tests (f), red first.** `audio-loudness-rule.test.ts` (parse incl. `-inf`; the rule table: down / up / clamp /
   gated −70 and `-inf` I / skip < 0.1 / silence). `audio-normalize.test.ts` through the REAL bundled ffmpeg (only
   `../../utils/paths` mocked) on fixtures written from JS as 48 kHz mono 16-bit PCM WAVs (no ffmpeg source filters
   needed; `anoisesrc` is absent anyway): (A) a 1 kHz tone at ≈ −12 LUFS with a 5 ms spike to −0.3 dBFS → gain ≈ −8,
   not clamped, I_out −20 ± 0.5, peak ≤ −1.5; (B) a click train at ≈ −31 LUFS, peak −6 dBFS → clamp: gain = 4.5,
   `clamped`, I_out ≈ −26.5 (honestly above −20), peak −1.5 ± 0.1; (C) a 0.3 s burst → `gated` → peak at −1.5; (D) a
   6 s tone + LCG-noise bed at ≈ −30 LUFS → gain up, I_out −20 ± 0.5; (E) an mp3 made from (A) by the bundled ffmpeg →
   `.mp3` kept, I_out −20 ± 0.5, duration within 10 ms by the real `probeMedia` (the gapless trim); (F) the failure
   policy: an unsupported extension and a bogus binary → bytes unchanged, `normalized: false`, `error`. Independent
   checks inside the tests: the sample peak of a WAV output read from its PCM in JS (no ffmpeg), LUFS by a second
   analysis pass (the live exit's independent meter is `ffmpeg-full`'s `ebur128` + `astats`). Then: `generate-audio-
   asset.test.ts` (mock `./audio-normalize`; `audio` / `tags` reach `upsertEntry`; a failed normalize is recorded and the
   file kept; `durationSeconds` from the probe), `audio-tools.test.ts` (category / tags pass through; LUFS in the text;
   the not-normalized text), `library-used-in.test.ts` (add / dedupe / unknown relPath / other fields untouched / no
   write when unchanged / paths outside the root dropped), seam tests for (1) and (2) with the import mocked,
   `library-listing.test.ts` (+ the E2 extras).

### Built (builder #1) — commit `60b5537` (design §1 "normalize step" only; the call site is NOT wired yet)

- `src/main/services/library/audio-loudness-rule.ts` (pure, 85 lines): `LOUDNESS_TARGET_LUFS = -20`,
  `LOUDNESS_CEILING_DBFS = -1.5`, `LOUDNESS_GATED_BELOW_LUFS = -50`, `LOUDNESS_MIN_GAIN_DB = 0.1`;
  `parseLoudnormStats(stderr)` (`input_i` / `input_tp`, `-inf` → `-Infinity`, null without a block);
  `planLoudnessGain(stats, target?, ceiling?)` → `{ gainDb (0.01 dB), clamped, gated, skipped }` — the `gen_sfx.py` rule.
- `src/main/services/library/audio-normalize.ts` (≈170 lines): `measureLoudness(abs, opts)` (one `loudnorm=I:TP:LRA=11:
  print_format=json` pass, `-vn -f null -`, stats off a 16 KB stderr tail), `applyGain(abs, gainDb, signal)` (one
  re-encode `-af volume=<g>dB` into `<abs>.norm-tmp<ext>` → `fs.rename` over the original; `ENCODE_BY_EXT`: `.mp3`
  libmp3lame **192k** `-f mp3`, `.wav` pcm_s16le, `.m4a` aac 192k `-f mp4`, `.aac` aac `-f adts`, `.ogg`/`.opus` libopus
  128k; else "unsupported container"), `normalizeAudioFile(abs, { targetLufs?, ceilingDbfs?, signal? })` →
  `AudioNormalizeResult { normalized, loudnessLufs?, peakDbfs?, gainDb, clamped, gated, skipped, error?, before? }`;
  `NORMALIZE_TIMEOUT_MS` 120 s per pass (an `AbortController` fed by the timer and the caller's signal; a timeout reads
  "ffmpeg timed out after 120 s", a caller abort "Cancelled"). Failure policy as designed: measure failed → `normalized:
  false, error: 'measure failed: …'`, nothing written; apply failed → the temp output removed, the original untouched,
  `error: 'apply failed: …'`, `loudnessLufs` / `peakDbfs` = the measured (unchanged) file; re-measure failed → applied,
  predicted values recorded + a warn. Uses `getFfmpegBinary` / `runFfmpeg` from `../studio/ffmpeg-bin` (the
  library→studio import already exists for `hashFileHead`).
- `src/shared/types/asset-library.ts:27-51` `LibraryAudioMeta` gains `peakKind?: 'true' | 'sample'`, `gainDb?`,
  `normalizeError?` (optional); the `peakDbfs` comment names the two writers (E2 true peak, E4 sample peak).
- Tests: `audio-loudness-rule.test.ts` (10: parse incl. `-inf` / non-number; down / up / clamp / gated −70 and `-inf` /
  the −50 edge / skip < 0.1 (0.1 applied) / silence / custom target+ceiling) and `audio-normalize.test.ts` (8, the REAL
  bundled ffmpeg, only `../../utils/paths` mocked; fixtures = JS-written 48 kHz mono 16-bit WAVs: (A) tone + 5 ms spike
  → down, not clamped, −20 ± 0.5, peak ≤ −1.5, JS sample peak within 0.3 dB of `tp + gain`, second analysis pass −20 ±
  0.5; (B) click train → `clamped`, `gainDb = −1.5 − tp` ± 0.02, peak −1.5 ± 0.1, LUFS < −22; (C) 0.3 s burst → `gated`,
  peak −1.5 ± 0.1 — so the bundled `loudnorm` reports a gated / `-inf` (or < −50) integrated value for a 0.3 s file;
  (D) 6 s bed → up > 5 dB, −20 ± 0.5; (E) a 128k mp3 of (A) → `.mp3` kept, −20 ± 0.5, gapless duration (ffprobe −
  LAME delay/padding) within 10 ms of the input and of 3.000 s; (F) WAV bytes named `.flac` → `apply failed:
  unsupported container`, bytes byte-equal, measured values recorded, no temp file; an empty `.mp3` → `measure failed`,
  still 0 bytes; `AbortSignal.abort()` → `Cancelled`, bytes unchanged). **Known limit (for the record):** the ceiling is
  applied to the pre-encode true peak; on an mp3 with transients the post-encode peak can sit a few tenths of a dB
  off the ceiling — recorded as measured (one re-encode, the gen_sfx rule), not forced; the WAV fixtures pin the rule
  exactly, the mp3 fixture pins the loudness + duration.
- NOT built yet (after builder #4): the live check only (the code is complete).

### Built (builder #2) — commit `841e311` (design §1 "Call site", §2 stand-in, §3 args)

- `src/main/services/library/generate-audio-asset.ts` (178 lines): `GenerateAudioAssetRequest` gains `category?` /
  `tags?` (:52-55); after `fs.writeFile` → `normalizeAudioFile(absPath, { signal? })` (:131) BEFORE `upsertEntry`, so the
  probe + hash describe the levelled file; `normalizeCategory` (trim + lower-case, :108-111) and `normalizeTags`; the
  `audio` meta (:134-143) = `{ category?, loudnessLufs?, peakDbfs?, peakKind: 'true', source: result.providerId, model:
  result.model, gainDb, normalizeError? }`; `upsertEntry(root, relPath, { origin, description, brandId?, tags?, audio })`
  (:148-154); `GeneratedAudioAsset` gains `normalized` (REQUIRED boolean), `loudnessLufs?`, `peakDbfs?`, `normalizeError?`,
  `category?`, `tags?` (:66-85); `durationSeconds` = the upsert's `probe.duration` when finite and > 0, else the engine's
  figure (:155-156). A failed normalize is recorded (`audio.normalizeError`, descriptor `normalized: false`), never thrown.
- `src/main/services/library/library-filing.ts:59-74` `TAGS_MAX = 20`, `normalizeTags(tags?)` → trim / lower-case / drop
  empties / dedupe / cap 20, `undefined` when nothing is left (an entry never carries an empty `tags: []`).
- `src/main/services/studio/agent-tools/audio-tools.ts` (175 lines): both tools gain `category: z.string().min(1).max(40)
  .optional()` (hints `CATEGORY_HINT_SFX` motion / tension / emphasis / snap / foley / reward / texture / impact;
  `CATEGORY_HINT_MUSIC` bed / sting / intro / outro / loop / transition) and `tags: z.array(z.string().min(1)).max(20)
  .optional()`, passed through untouched (the library step normalizes). The answer: `Sound effect ready: project asset id
  "asset-9" (library:generated/sfx-a-whoosh.mp3, 2.97 s, $0.006, brand: acme-test). Loudness −20.0 LUFS, peak −8.2 dBTP.
  Filed with category: motion · tags: whoosh, air. It is in the project inventory now — place it …` — `signed()` prints a
  typographic minus (U+2212), one decimal (:61-63); on `normalized: false` the level clause is ` NOT loudness-normalized
  (<normalizeError>) — the raw file is kept.` (`describeLevel`, :66-74); duration `toFixed(2)`; the tool descriptions
  name the normalization + category / tags.
- Stand-in (§2, E-d6): `src/audio-engine/generation/providers/standin-audio-provider.ts` (33 lines) `StandinAudioProvider
  (filePath)`, `id 'standin'` (`STANDIN_AUDIO_PROVIDER_ID`), `generate()` → `{ bytes: await fs.readFile(filePath),
  contentType: 'audio/mpeg', model: 'standin' }`, `pricePerSecondUsd() → 0` (the engine then records `costUsd 0`);
  exported from `src/audio-engine/generation/index.ts`. `src/main/services/audio-generation-standin.ts` (49 lines)
  `STANDIN_AUDIO_FILE_ENV = 'VIDTSX_AUDIO_STANDIN_FILE'`, `registerDevStandinProvider(): boolean` — `!app || app.isPackaged`
  → false; env unset / blank → false; `fs.statSync(path.resolve(file)).isFile()` false → `log.warn` + false; else
  `registerInstance(new StandinAudioProvider(abs))` + `log.warn('DEV stand-in audio provider "standin" registered
  (VIDTSX_AUDIO_STANDIN_FILE)', { file, active })` → true; never throws. Called at the END of `initAudioGenerationEngine`
  after the BYOK loop (`audio-generation-init.ts:66-68`), so a real key stays `activeId` (`registerInstance` uses `??=`).
- Tests (red first — `…\E2\b-red.log`: 11 failed + 2 files "Cannot find module"): `generate-audio-asset.test.ts` (9:
  `./audio-normalize` mocked; call order normalize < upsert and the `{ signal }` argument; the `audio` meta on the upsert;
  stale brand; category lower-cased + tags normalized / capped at 20; failed normalize → `normalizeError` on the entry,
  bytes kept, descriptor `normalized: false`; `durationSeconds` from `probe.duration` else the engine's 3; the music path
  → `source: 'standin', model: 'standin'`), `audio-tools.test.ts` (6: category + tags reach `generateAudioAsset`; `2.97 s`,
  `−20.0 LUFS`, `peak −8.2 dBTP`, `category: motion`, `tags: whoosh, air`; the not-normalized line; `generate_music`
  likewise), `library-filing.test.ts` (+2 `normalizeTags`), `standin-audio-provider.test.ts` (3: bytes back as
  `audio/mpeg` / through `createAudioGenerationEngine()` → `providerId 'standin'`, `model 'standin'`, `costUsd 0`, `ext
  '.mp3'`, `durationSec 2` / a missing file rejects), `audio-generation-standin.test.ts` (6: the env name; packaged → false
  even with the file; no env → false; missing file → false + one warn; ok → true, listed, active, price 0, the warn names
  the file; a provider registered first stays active). The agents' `generate-audio.test.ts` mock gains `normalized: true`
  — no arg change there, green.

### Built (builder #3) — commit `68bbe44` (design §4 `usedIn`: the helper + the three seams)

- `src/main/services/library/library-used-in.ts` (93 lines, new): `addUsedIn(entry, projectId): boolean` (:22-26, pure —
  appends once, false when already there); `markLibraryUsedIn(root, relPaths, projectId)` (:32-69) → `updateIndex` on the
  per-root chain (`library-index-io.ts:118`, so the file keeps `version: 1, rev: 2` and never interleaves with a scan),
  dedupes the input, patches EXISTING entries only, `mutate` returns `changed` so nothing is written when nothing changed;
  an unknown relPath is `log.warn`ed ("not in the library index yet — left to the next scan") and skipped; the whole
  patch sits in try/catch → a failed write is `log.warn`ed ("index patch failed — the import stands"), never thrown; a
  blank `projectId` or an empty list returns at once. `markLibraryUsedInForPaths(projectId, absPaths)` (:75-93) →
  `getLibraryRoot()` + `libraryRelPathOf` keeps only paths UNDER the root (outside paths are ordinary pool files — no
  log), then `markLibraryUsedIn`; its own try/catch covers a root-resolution failure.
- `src/main/services/library/library-paths.ts:63-75` `libraryRelPathOf(root, abs): string | null` — `path.relative` of the
  two resolved paths; null when `''` (the root itself), absolute (another drive), `..` or starting with `..<sep>` (a parent
  or a sibling — `<root>-other\x.mp3`, `<root>2\x.mp3`, `<root>.mp3` all yield `..\…`); a name under the root that merely
  starts with dots (`..hidden.mp3`) is inside. Case-insensitive on Windows because `path.win32.relative` is.
- The three seams: (1) `src/main/services/studio/agent-tools/library-import.ts` (66 lines) imports the helper (:10),
  computes the canonical key once (`toLibraryRelPath`, :49) and marks with `project.id` BEFORE both returns — the
  existing-asset return (:50-53) and the fresh import (:62, before the turn state + `assets-imported` emit, so the index is
  patched by the time the renderer adopts the asset); a missing file / failed import throws before any mark. (2)
  `src/main/services/studio/shot-asset-refs.ts` (167 lines): `landed: string[]` (:104-106) collects
  `toLibraryRelPath(libraryRoot, absPath)` for every library ref after its hash (:135, existing or imported), ONE
  `markLibraryUsedIn(libraryRoot, landed, project.id)` after the loop (:162-164) — a throw inside the loop marks nothing.
  (3) `src/main/ipc/studio-handlers.ts` `handleStudioMediaImport` (:299-301) calls `markLibraryUsedInForPaths(data.projectId,
  assets.map((a) => a.path))` after `importMediaFiles` — **wired but covered by the helper's test only** (the handler has no
  test; `studio-handlers.ts` is 674 lines, over the ~300 rule before E2 — not E2's to split).
- Tests (19 new, red first — `…\E2\c-red.log`: `library-used-in.test.ts` "Cannot find module", 7 failed | 14 passed —
  the cases asserting "not marked" passed before the code, as they should): `library-used-in.test.ts` (8; `electron` +
  `../settings-db` + `log-engine` mocked, a REAL index written with `writeIndex` per case: patch existing only + unknown
  warned + every other entry / tombstone `toEqual` before; dedupe within a call and against the file, append across
  projects; no rewrite (bytes + mtime) on an identical call / empty list / blank project / unknown-only; a failed write
  (a DIRECTORY at `<index>.tmp`) resolves, warns, bytes unchanged; a file-as-root resolves; `markLibraryUsedInForPaths`
  marks the under-root path only — the `<root>-other\…` sibling trap and a far path dropped, no warn, and an all-outside
  call does not touch the index; empty / blank never throw), `library-paths.test.ts` (4: inside → POSIX key =
  `toLibraryRelPath`, `..hidden.mp3` inside, unnormalized input resolved; root / parent / outside → null; the three
  sibling-prefix traps → null; win32-only: drive-letter case both ways, upper-cased path, another drive → null),
  `agent-tools/library-import.test.ts` (4, new file; `library-paths` / `library-used-in` / `library-store` /
  `project-store` / `media-import` mocked, a real temp file: existing asset returned + marked `(libRoot, [rel], 'p1')`,
  no import, no emit; fresh import with `./generated/…` spelling → description carried, `importedAssets` + the emit,
  marked with the canonical key; missing file / failed import → throws, not marked), `shot-asset-refs.test.ts` (+3: two
  library refs — one already a project asset by path, one imported — plus a plain id → refs rewritten, ONE mark with
  both relPaths and `project.id`; no library ref → no mark, no import; a missing file → throws, no mark).

### Built (builder #4) — commit `3084668` (design §5 the listing row)

- `src/main/services/library/format-level.ts` (8 lines, new): `signed(n, digits = 1)` → `toFixed` with a typographic minus
  (U+2212) — the ONE LUFS / dB form; `audio-tools.ts` now imports it (its local copy removed, :59-62 before) and
  `audio-tools.test.ts` stayed green unchanged.
- `src/main/services/studio/agent-tools/library-listing.ts` (57 lines): `formatLibraryRow` (:21-33) appends
  `formatMetaSuffix(entry)` (:35-57) after the description: ` · category: <audio.category>` (non-empty) · ` · tags: a, b`
  (`tags.length > 0`, joined `, `) · ` · −20.0 LUFS` when `audio.loudnessLufs` is finite, with ` (not normalized)` appended
  when `audio.normalizeError` is set, or ` · not normalized` when the error is set without a number · ` · used in: p1, p2`
  (`usedIn.length > 0`). Nothing else changed — no filtering, no `kind` / `query` args (E3's). An entry without the
  fields (or with `tags: []` / `usedIn: []` / `audio: {}` / `category: ''` / a NaN LUFS) prints exactly the E1 string.
- Tests (red first — `…\E2\d-red.log`): `library-listing.test.ts` (+4 in a new describe: everything in order; un-normalized
  with / without a number; none of the fields → E1 exactly, incl. the empty-array / `{}` / `''` / NaN entry; lone tags /
  lone used-in / the suffix with no description), `format-level.test.ts` (2, new file).

### Prepared for the live step (builder #4, 2026-10-24 — no launch, no app run)

- The E2 profile exists: `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\E2\profile`, robocopy of `profiles\source\profile`
  with `/E /XF settings.db*` — 2,325 files, 371.9 MB, **zero `settings\settings.db*`** (checked), `assets\` present (the
  library root once the app confirms it). Not launched on yet; its Studio root is still the default (set it FIRST).
- Two stand-in mp3s in `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\` (made by the SOURCE profile's `ffmpeg-full` n8.1.2,
  libmp3lame 128k, 44.1 kHz mono, 2.000 s, 33,062 bytes each; recipes + the independent measurements under Verified):
  `standin.mp3` (the exit's sound: −9.3 LUFS, true peak +0.6 dBTP — far from −20, peak over full scale) and
  `standin-quiet.mp3` (the ceiling-binding sound: a uniform 1 ms burst train, see Verified for its I / peak — its gain to
  −20 pushes the peak over −1.5, so the clamp rule must fire).

### Live step (builder #5, 2026-10-24 — no `src/` change; drivers + evidence only)

- **Scratch kit** `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E2\` (copied from E1's and adapted): `launch.sh` (profile
  `profiles/E2/profile`, port **9262**, log `…\vidtsx-e2e\E2\app-1.log`, `export VIDTSX_AUDIO_STANDIN_FILE=C:/Users/hasan/AppData/
  Local/vidtsx-e2e/E2/standin.mp3` before the `exec`), `restore.ps1` / `watchdog.ps1` (E2 marks, watchdog log `…\E2\watchdog.log`),
  `vitest.e2.config.ts` (`include: ['*.e2.test.ts']`, own `cacheDir`), `cdp.mjs` (E1's on 9262), **`live.mjs`** (`root` = `studioRootSet`
  FIRST + `studioRootGet` + `libraryRootGet`; `assets` = Assets nav → `button[title="Refresh"]` → `dblclick` on the `generated`
  tile (`div[title="generated"]` → parent tile `[title=<abs path>]`) → tile names (`div[title$=.mp3]`) → click the whoosh tile →
  visible leaf texts; `shot` = `restore.ps1` spawned in the SAME call, then `Page.captureScreenshot` raced against 20 s),
  **`e2-common.ts`** (constants; the INDEPENDENT meter = `ffmpeg-full` n8.1.2 via `spawnSync` — `ebur128=peak=true` → I + true
  peak, `astats=measure_overall=Peak_level` → sample peak, `ffprobe` → duration / size / bit_rate / sample_rate; `ensureProject`
  refuses a projects dir that is not under the E2 root; `makeCtx` = a real `createTurnState()` + `req { projectId, projectName,
  prompt '', history [], assets [], shots [], reviewOpen false }`; `parseToolAnswer`; `writeExit` merges keys into `exit.json`),
  **`exit-main.e2.test.ts`** (items 1–4 with `standin.mp3`), **`exit-ceiling.e2.test.ts`** (the ceiling case + the music path with
  `standin-quiet.mp3`; a second vitest invocation because the engine singleton keeps the first stand-in). Mocks in each driver:
  `electron` (`app.getPath('userData')` = the E2 profile, `isPackaged: false`), the worktree's `settings-db` (`getValue(
  'studioProjectsRoot')` → `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E2\root`, everything else `undefined` → library root
  `<profile>\assets`, credentials `{}` — no key anywhere), `utils/paths` partial (`getRemotionBinariesDir: () => null`, the rest
  original), `ai-usage` (no usage row). Everything else is REAL: `initAudioGenerationEngine` → `registerDevStandinProvider`;
  `buildAudioTools` → `generate_sfx` / `generate_music` → `generateAudioAsset` → `normalizeAudioFile` (bundled ffmpeg) →
  `upsertEntry` (real probe) → `importLibraryFile` (+ `markLibraryUsedIn`); `buildInsertTools` → `insert_asset` → `resolveAssetRef`;
  `buildProjectTools` → `list_assets`; `createProject`.
- **The worktree build** `wt/out` rebuilt at `3084668` (`…\E2\build-1.log`: `✓ built in 2m 30s`, rc 0, 3 "use client" warnings).
- **The project**: `…\E2\root\projects\e2-exit` (`createProject('e2-exit', 1920, 1080, 30)`; `project.json` keeps `assets: []` —
  main never writes it; the generate tool's import reaches the renderer as an `assets-imported` event, which the stopped-app
  driver only records: `{ id 'e2ec8044-…', kind 'audio', path '<profile>\assets\generated\sfx-a-short-airy-whoosh-2.mp3', probe
  { duration 2 } }` — the pool references the library file in place, no copy under the project).
- **The live library** (`<profile>\assets`, index `version 1 / rev 2`, 4 entries, all `usedIn ["e2-exit"]`, all `probe.duration 2`):
  `generated/sfx-a-short-airy-whoosh.mp3` (run 1 — the product was right, the DRIVER's meter helper read stdout only; kept),
  `generated/sfx-a-short-airy-whoosh-2.mp3` (THE exit), `generated/sfx-a-quiet-tick-train.mp3` (the ceiling case),
  `generated/music-a-soft-bed.mp3` (the music path). Each 49,571 bytes, 44.1 kHz mono, ffprobe `bit_rate 198284` (the 192k
  re-encode).
- **Evidence** in `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\`: `exit.json` (every number), `exit-summary.md` (what was measured by
  what, with tolerances — the records' source), `exit-run-1.log` (run 1, the driver bug), `exit-run-2.log` (the main case, green),
  `exit-ceiling-run-1.log` (green), `app-1.log` (the live app), `assets-generated.png` (the still: `Assets / generated`, four
  tiles with descriptions, the whoosh's details panel), `build-1.log`, `watchdog.log`, `diff-list.txt` + `import-graph.txt` (rule
  (b)), `vitest-full-1.log`, `tsc-web-5.log` / `tsc-node-5.log`.

### Records (builder #6, 2026-10-28 — docs only, commit `3249cbe`)

- `Status.md:10-192` — the E2 entry at the TOP (above E1's, now at :194), dated 2026-10-24, titled like E1's ("— DONE
  (builder records; the E2 verifier is next)"): What · The code per commit (`60b5537` / `841e311` / `68bbe44` / `3084668`, file:line
  re-read at HEAD — see Open problems for the shifted numbers) · the loudness rule + the bundled-ffmpeg toolset · `peakKind 'true'`
  · libmp3lame 192k · the un-normalized policy · the DEV-ONLY stand-in named (`VIDTSX_AUDIO_STANDIN_FILE`, `!app.isPackaged`, after
  the BYOK loop, `costUsd 0`, mp3 only) · builder #2's notes answered · the three `usedIn` seams (pool import helper-tested only) ·
  the listing row · the live exit numbers (main / ceiling / music, the independent meter, the CDP outputs, the still) + the
  Assets-screen-prints-no-duration note · gates (import-graph method + the 3 E-d2a suites, 485 / 4,138, tsc 26 / 10) · V4-N1 ·
  not measured · for Hasan · evidence. Every number copied from `exit.json` / `exit-summary.md` / `vitest-full-1.log` /
  `import-graph.txt` / `tsc-*-5.log` / `build-1.log` (opened this session), not from memory.
- `docs/studio/TESTING.md:492-506` — §18.15 after §18.14's shape (E-d10): a Material paragraph + 13 items; ✎ only on the Assets
  click-through (the one thing that ran in the app over CDP); the handler items say "stopped-app driver on the live index".
- V4-N1: `Status.md:98` (now `:282`, the E1 entry's W2 line) — "`sync-probes.ts:141` fall back to the composition size; proxies
  (`proxy-generator.ts:231`); `AssetCard`'s "· W×H"" → "`sync-probes.ts:141` fall back to the composition size; `AssetCard`'s
  "· W×H""; `docs/studio/TESTING.md:486` — "fall back to the composition size, proxies, `AssetCard`; none changes for a real
  video." → "fall back to the composition size, `AssetCard`; none changes for a real video (proxies are not a consumer:
  `proxy-generator.ts` reads `probe.duration` + `probe.hasAudio` only — E1 verifier round 4, V4-N1)." Checked at HEAD:
  `proxy-generator.ts` reads `probe.duration` (:240) and `probe.hasAudio` (:251, :321) only. V4-N2 not needed
  (`pre-e1-control.test.ts` untouched).

## Verified (exact commands + outputs)

- 2026-10-24 · builder #1 · from the worktree root: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  src/main/services/library/audio-loudness-rule.test.ts src/main/services/library/audio-normalize.test.ts` BEFORE the
  implementation existed → `Test Files 2 failed (2) · Tests no tests` ("Error: Cannot find module './audio-loudness-rule'
  …", "Cannot find module '/src/main/services/library/audio-normalize'") — `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\
  a-red.log`; AFTER → `Test Files 2 passed (2) · Tests 18 passed (18) · Duration 3.64s` — `…\E2\a-green-1.log`.
- Types on `60b5537`: `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit` →
  26 `error TS` lines; `-p tsconfig.node.check.json` → 10; none in the new or edited files (`…\E2\tsc-web-1.log`,
  `tsc-node-1.log`).
- Bundled ffmpeg toolset re-check (2026-10-24, `node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe -filters /
  -encoders / -muxers`, n7.1): in the design note's first paragraph. Node for the tests: v22.14.0.
- 2026-10-24 · builder #2 · red, from the worktree root: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  src/main/services/library/generate-audio-asset.test.ts src/main/services/studio/agent-tools/audio-tools.test.ts
  src/main/services/agents/tools/generate-audio.test.ts src/main/services/library/library-filing.test.ts
  src/audio-engine/generation/providers/standin-audio-provider.test.ts src/main/services/audio-generation-standin.test.ts`
  BEFORE the code → `Test Files 5 failed | 1 passed (6) · Tests 11 failed | 23 passed (34)` (+ "Cannot find module
  './standin-audio-provider'" / "…/audio-generation-standin"; the agents' test green) — `…\E2\b-red.log`. AFTER (the
  six + `pre-e1-control.test.ts` + `audio-normalize.test.ts` + `audio-loudness-rule.test.ts`) → `Test Files 9 passed (9) ·
  Tests 67 passed (67)` — `…\E2\b-green-1.log`.
- Types on `841e311`: `tsc -p tsconfig.web.check.json --noEmit` → 26 `error TS` lines; `-p tsconfig.node.check.json` → 10;
  none in the new or edited files (`…\E2\tsc-web-2.log`, `tsc-node-2.log`).
- 2026-10-24 · builder #3 · red, from the worktree root: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  src/main/services/library/library-used-in.test.ts src/main/services/library/library-paths.test.ts
  src/main/services/studio/agent-tools/library-import.test.ts src/main/services/studio/shot-asset-refs.test.ts` BEFORE the
  code → `Test Files 4 failed (4) · Tests 7 failed | 14 passed (21)` + "Cannot find module '/src/main/services/library/
  library-used-in'" — `…\E2\c-red.log`. AFTER (same four) → `Test Files 4 passed (4) · Tests 29 passed (29)` —
  `…\E2\c-green-1.log`. Neighbouring suites `… run src/main/services/library src/main/services/studio/agent-tools
  src/main/services/studio/shot-asset-refs.test.ts` (incl. `pre-e1-control.test.ts`, the normalizer, the call-site and
  stand-in suites) → `Test Files 33 passed (33) · Tests 251 passed (251) · Duration 5.21s` — `…\E2\c-green-2.log`.
- Types on `68bbe44`: `tsc -p tsconfig.web.check.json --noEmit` → 26 `error TS` lines; `-p tsconfig.node.check.json` → 10;
  none in the new or edited files (`…\E2\tsc-web-3.log`, `tsc-node-3.log`).
- 2026-10-24 · builder #4 · red, from the worktree root: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  src/main/services/studio/agent-tools/library-listing.test.ts src/main/services/library/format-level.test.ts` BEFORE the
  code → `Test Files 2 failed (2) · Tests 3 failed | 5 passed (8)` + "Cannot find module './format-level'" (the
  none-of-the-fields case passes before the code, as it should) — `…\E2\d-red.log`. AFTER (+ `audio-tools.test.ts`,
  unchanged) → `Test Files 3 passed (3) · Tests 16 passed (16)` — `…\E2\d-green-1.log`. Neighbouring suites `… run
  src/main/services/library src/main/services/studio/agent-tools src/main/services/studio/shot-asset-refs.test.ts` →
  `Test Files 34 passed (34) · Tests 257 passed (257) · Duration 4.99s` — `…\E2\d-green-2.log`.
- Types on `3084668`: `tsc -p tsconfig.web.check.json --noEmit` → 26 `error TS` lines; `-p tsconfig.node.check.json` → 10;
  none in `format-level` / `library-listing` / `audio-tools` (`…\E2\tsc-web-4.log`, `tsc-node-4.log`).
- Environment snapshot 2026-10-24 10:12 (builder #4; re-run before any launch): `Get-PSDrive C,D` → C: 47.11 GB, D: 23.83 GB
  free; `Win32_OperatingSystem.FreeVirtualMemory` → 37.25 GB headroom; `electron.exe` count 0; `%TEMP%\vidtsx-studio\export`
  0 files written in the last 10 min; E1 kit present (`cdp.mjs garbage.e1.test.ts launch.sh list-assets.e1.test.ts
  restore.ps1 seed-index.e1.test.ts seed-media.mjs upsert.e1.test.ts vitest.e1.config.ts watchdog.ps1`); the independent
  meter `…\profiles\source\profile\ffmpeg-full\ffmpeg-n8.1.2-50-g1a748fe2cd-win64-gpl-shared-8.1\bin\ffmpeg.exe` present
  (+ `ffprobe.exe` beside it).
- Profile copy (builder #4): `robocopy <source\profile> C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\E2\profile /E /XF
  settings.db* /NFL /NDL /NJH /NP /R:1 /W:1` → rc 1 (= copied), `Bytes: 371.90 m` in 0:00:03; afterwards `Test-Path
  <E2>\settings\settings.db` → False, `settings.db*` count in `<E2>\settings` → 0, 2,325 files, `<E2>\assets` exists.
- Stand-ins (builder #4; `ffmpeg-full` n8.1.2 = the independent meter; both 2.000 s, 44.1 kHz mono, libmp3lame 128k,
  33,062 bytes; in `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\`):
  - `standin.mp3` — `-f lavfi -i "anoisesrc=d=2:c=pink:r=44100:a=1:s=42" -af "highpass=f=300,lowpass=f=4000,afade=t=out:
    st=1.2:d=0.8:curve=exp,volume=12dB,alimiter=limit=0.9661:level=false:attack=1:release=30" -ac 1 -c:a libmp3lame -b:a
    128k`. Measured: `-af ebur128=peak=true -f null -` → **I −9.3 LUFS, true peak +0.6 dBTP**; `-af astats` → sample peak
    **+0.54 dBFS**, RMS −11.73 dB; `ffprobe` → `duration=2.000000`, `sample_rate=44100 channels=1 bit_rate=128000`. (An
    earlier try at +6 dB never reached the limiter: −14.0 LUFS / −2.8 dBTP — replaced.)
  - `standin-quiet.mp3` — `-f lavfi -i "aevalsrc='0.5*sin(2*PI*2000*t)*lt(mod(t,0.1),0.001)':s=44100:d=2:c=mono" -c:a
    libmp3lame -b:a 128k` (a uniform train of 1 ms 2 kHz bursts every 100 ms at −6 dBFS). Measured: ebur128 → **I −27.4
    LUFS, true peak −5.7 dBTP**; astats → sample peak **−5.73 dBFS**, RMS −29.44 dB; ffprobe → `duration=2.000000`. Expected
    through the product: wanted gain −20 − (−27.4) = +7.4 → peak +1.7 > −1.5 → **clamped**, gain = −1.5 − (−5.7) = **+4.2**,
    recorded LUFS ≈ **−23.2** (honestly above −20), peak −1.5 ± a few tenths after the mp3 re-encode. (Two earlier tries
    failed the R128 gate: a gated 9 %-duty noise-burst train read −19.8 LUFS; a 2 ms / 100 ms train read −24.2 LUFS with a
    −6.2 dBTP peak → +4.2 of gain lands at −2.0, under the ceiling — not binding; both replaced.)
- No launch, no build, no driver run yet (builder #4).
- 2026-10-24 · builder #5 · **resource guard** 10:23:44 (before the build): `Get-PSDrive C,D` → C: 46.76 GB, D: 23.83 GB free;
  `FreeVirtualMemory` → 36.22 GB headroom; `electron.exe` 0; `%TEMP%\vidtsx-studio\export` absent. 10:30:38 (before the launch):
  C: 46.72 / D: 23.81; headroom 36.69; `electron.exe` 0; export dir absent. Watchdog (`…\E2\watchdog.ps1`, background) log: `10:31:31
  watchdog start` … `10:36:23 E2 instance gone (3 checks), watchdog exit` (never fired).
- builder #5 · **build** (Bash, worktree root): `unset ELECTRON_RUN_AS_NODE; export NODE_OPTIONS=--max-old-space-size=8192; node
  D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build > …\E2\build-1.log 2>&1` → `✓ built in 2m 30s`, rc 0,
  3 "use client" warnings; `out/main/index.js` 3,041,233 bytes 10:24, `out/renderer/index.html` 10:27.
- builder #5 · **the exit drivers** (worktree root, app stopped): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  --config D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/E2/vitest.e2.config.ts exit-main > …\E2\exit-run-2.log 2>&1` → `Test Files
  1 passed (1) · Tests 1 passed (1) · Duration 2.25s` (run 1, `exit-run-1.log`, failed in the DRIVER's meter helper after the product
  had already written `sfx-a-short-airy-whoosh.mp3` correctly); `… exit-ceiling > …\E2\exit-ceiling-run-1.log` → `1 passed · 2.73s`.
  Driver stdout: `[AudioGenerationStandin] DEV stand-in audio provider "standin" registered (VIDTSX_AUDIO_STANDIN_FILE)` ·
  `[AudioGenerationInit] Engine initialized` · `providers: ["standin"] active: standin` · `[AudioNormalize] Loudness normalized`.
  **Main** (`standin.mp3` in −9.3 LUFS / +0.6 dBTP / +0.54 dBFS): `generate_sfx({ prompt 'a short airy whoosh', durationSeconds 2,
  category 'motion', tags ['whoosh','air'] })` 466 ms → `generated/sfx-a-short-airy-whoosh-2.mp3`, 49,571 B; entry `kind audio`,
  `origin generated`, `tags ["whoosh","air"]`, `audio { category motion, loudnessLufs −20.27, peakDbfs −10.79, peakKind true,
  source standin, model standin, gainDb −10.71 }`, `probe { duration 2, hasAudio true, codec mp3 }`, `usedIn ["e2-exit"]`;
  independent (`ffmpeg-full` n8.1.2): ebur128 **I −20.2 LUFS**, **true peak −10.8 dBTP**, astats sample peak **−10.79 dBFS**, ffprobe
  `duration 2.000000` (diff **0 ms**), 44.1 kHz mono, bit_rate 198,284 → I − (−20) = **−0.2 LU**; recorded − meter **−0.07 LU** /
  **+0.01 dB**; gain −10.71 vs the unclamped −20 − (−9.3) = −10.7. Answer: `Sound effect ready: project asset id "e2ec8044-…"
  (library:generated/sfx-a-short-airy-whoosh-2.mp3, 2.00 s, $0.000). Loudness −20.3 LUFS, peak −10.8 dBTP. Filed with category:
  motion · tags: whoosh, air. …`. `insert_asset({ assetId 'library:generated/sfx-a-short-airy-whoosh-2.mp3', lane 'audio', at 0 })` →
  `Insert proposed (id "prop_mvm2whpg_zumvj2"): Insert "sfx-a-short-airy-whoosh-2.mp3" as audio at 0:00.0 · 2.0 s …`; `usedIn` after
  generate `["e2-exit"]`, after insert `["e2-exit"]` (one entry). `list_assets({ scope 'library' })` row: `- library:generated/
  sfx-a-short-airy-whoosh-2.mp3 (audio, 2.00 s, generated) — "a short airy whoosh" · category: motion · tags: whoosh, air · −20.3 LUFS
  · used in: e2-exit` (printed 2.00 s vs ffprobe 2.000, 0 ms). **Ceiling** (`standin-quiet.mp3` in −27.4 LUFS / −5.7 dBTP / −5.73
  dBFS): `generate_sfx({ prompt 'a quiet tick train', durationSeconds 2, category 'snap', tags ['tick','quiet'] })` →
  `generated/sfx-a-quiet-tick-train.mp3`; `audio { category snap, loudnessLufs −23.44, peakDbfs −1.79, peakKind true, source
  standin, model standin, gainDb 4.18 }`, `usedIn ["e2-exit"]`; **gain +4.18 = the clamp** (−1.5 − TP_in; expected +4.2, the wanted
  −20 − (−27.4) = +7.4 refused); independent: **I −23.4 LUFS** (honestly short of −20), **true peak −1.8 dBTP**, sample peak **−1.83
  dBFS**, ffprobe 2.000000 (0 ms); recorded − meter −0.04 LU / +0.01 dB; meter TP − ceiling = **−0.3 dB** (the mp3 re-encode, builder
  #1's known limit). Answer: `… Loudness −23.4 LUFS, peak −1.8 dBTP. Filed with category: snap · tags: tick, quiet.` **Music**:
  `generate_music({ prompt 'a soft bed', durationSeconds 3 })` → `generated/music-a-soft-bed.mp3`, `audio { loudnessLufs −23.44,
  peakDbfs −1.79, peakKind true, source standin, model standin, gainDb 4.18 }` (no category), `probe.duration 2` (the stand-in's
  real length; ffprobe 2.000000, 0 ms), meter I −23.4 / TP −1.8, `usedIn ["e2-exit"]`; answer `Music ready: project asset id
  "266dace6-…" (library:generated/music-a-soft-bed.mp3, 2.00 s, $0.000). Loudness −23.4 LUFS, peak −1.8 dBTP.` Index after: `version 1,
  rev 2`, 4 entries. All in `…\E2\exit.json` (+ `exit-summary.md`).
- builder #5 · **live CDP 9262**: `bash …\E2\launch.sh` (Bash `run_in_background`; the launcher later reports exit 127 = the killed
  `exec`, expected) → `node cdp.mjs wait` → `ready after ~0 s of polling` (`app-1.log`: `Main-process init complete in 398ms`; no
  stand-in line — lazy init, see Open problems). `node live.mjs root` → `studioRootGet BEFORE: {"root":"C:\\Users\\hasan\\Videos\\
  VidTSX Studio"}` · `studioRootSet → {"success":true}` · `studioRootGet AFTER: {"root":"D:\\repos\\VidTSX-STUDIO\\.vidtsx-temp\\
  end-to-end\\E2\\root"}` · `libraryRootGet → {"success":true,"root":"C:\\Users\\hasan\\AppData\\Local\\vidtsx-e2e\\profiles\\E2\\
  profile\\assets", …, "isOverride":false}` · title `VidTSX Studio`, nav buttons Home … Assets … Queue. `node live.mjs assets` →
  `clicked Assets: true` · `clicked Refresh: true` · `root view names: ["generated","194 KB","presets","9.1 KB"]` · `open folder:
  dblclicked C:\…\profiles\E2\profile\assets\generated` · `generated folder tiles: ["music-a-soft-bed.mp3","sfx-a-quiet-tick-train.
  mp3","sfx-a-short-airy-whoosh-2.mp3","sfx-a-short-airy-whoosh.mp3"]` · `select: clicked sfx-a-short-airy-whoosh-2.mp3` · visible
  texts: `Audio`, `generated`, the four names + descriptions (`a soft bed`, `a quiet tick train`, `a short airy whoosh` ×2), `audio
  (mp3)`, `generated/sfx-a-short-airy-whoosh-2.mp3`. `node live.mjs shot C:/…/E2/assets-generated.png` → `restore: restored pid 48392
  (was iconic: True) (rc 0)` · `wrote … 73513 bytes` (checked by eye: breadcrumb `Assets / generated`, four tiles, the details panel
  Type `audio (mp3)` / Size 48.4 KB / Origin generated / Added 10/24/2026 / Path `generated/sfx-a-short-airy-whoosh-2.mp3`, footer
  `4 items · 194 KB`; v1.1.0 BETA). Stop (PowerShell): `Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object {
  CommandLine -like '*--remote-debugging-port=9262*' -or … '*profiles\E2\profile*' } | Stop-Process` → `E2 electron.exe before: 4`,
  `electron.exe after (all): 0` at 10:35:49.
- builder #5 · **gates** (app stopped): rule (b) — `git diff --name-only 5d77600..HEAD > …\E2\diff-list.txt` (68 files) then `node
  C:\…\vidtsx-e2e\E1\import-graph.cjs <wt> …\E2\diff-list.txt` (esbuild metafile per suite, packages external, `?raw` as leaves,
  `vi.mock`'d modules not followed) → `builder-libraries.test.ts: 2 local modules in graph; touched by the E diff: NONE` ·
  `shot-bundle.test.ts: 15 …: NONE` · `shot-bundle-in-place.test.ts: 23 … (vi.mock'd, not loaded: shot-generator.ts,
  shot-import-land.ts, media-import.ts): NONE` · `scripts/builder-unpack.mjs: 1 …: NONE` (`…\E2\import-graph.txt`). Full run (default
  workers — headroom 36 GB): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run > …\E2\vitest-full-1.log 2>&1` → `Test
  Files 3 failed | 485 passed | 5 skipped (493) · Tests 9 failed | 4138 passed | 35 skipped (4182) · Start at 10:36:10 · Duration
  51.80s`; the 3 = exactly the E-d2a suites — `builder-libraries.test.ts` (1: `Error: @remotion/paths (builder-libraries.ts) is not
  installed`), `shot-bundle-in-place.test.ts` (3: `Could not resolve "chroma-js"`), `shot-bundle.test.ts` (5: `Could not resolve
  "roughjs"` / `"@remotion/shapes"` / `"@react-three/fiber"` / `"chroma-js"` …) — resolution only; no timeouts. Types:
  `tsc -p tsconfig.web.check.json --noEmit` → **26** `error TS` lines; `-p tsconfig.node.check.json` → **10**; none in E2's files
  (`…\E2\tsc-web-5.log`, `tsc-node-5.log`).
- 2026-10-28 · builder #6 · **records, docs only** (no build, no launch, no driver re-run, no measurement, no vitest run). Evidence
  re-read for the numbers: `cat exit-summary.md exit.json` (75 + 265 lines; every Status / TESTING number matches them and the
  Verified lines above); `grep -E "Test Files|Tests |Start at|Duration" vitest-full-1.log` → `Test Files 3 failed | 485 passed | 5
  skipped (493)` · `Tests 9 failed | 4138 passed | 35 skipped (4182)` · `Start at 10:36:10` · `Duration 51.80s`; the 9 `FAIL` lines are
  `shot-bundle-in-place.test.ts` ×3, `shot-bundle.test.ts` ×5, `builder-libraries.test.ts` ×1; `cat import-graph.txt` → the four
  "touched by the E diff: NONE" lines; `wc -l < diff-list.txt` → 68; `grep -c "error TS" tsc-web-5.log tsc-node-5.log` → 26 / 10;
  `build-1.log` → `✓ built in 2m 30s`; `assets-generated.png` 73,513 bytes. Line numbers for the Status entry re-read at HEAD with
  `grep -n` over the E2 files. Commit `3249cbe` (`git add -- Status.md docs/studio/TESTING.md`). Then, from the worktree root:
  `git diff --stat 3084668..HEAD -- src/` → **empty output** (no `src/` file changed since the last code commit).

## Next step (ONE concrete instruction)

**FIX ROUND 1 — builder #7 (orchestrator, 2026-10-28; verifier round 1 FAILED on F1 + F2, see "Verifier round 1" under Open
problems).** In order, red first for every code change, commit at each green checkpoint:
1. **F1 — the ceiling holds on the ENCODED file (decision E-d11, below).** In `src/main/services/library/audio-normalize.ts`
   (`normalizeAudioFile` / `applyGain`, now 172 lines — split if it passes ~300): keep the ORIGINAL bytes until the end; encode
   original → temp with the planned gain; re-measure the TEMP (the product's own `loudnorm` pass); if its true peak is over the
   ceiling, re-encode from the ORIGINAL (never from the already-encoded temp — one lossy generation only) with the gain lowered
   by the overshoot plus a small margin (0.1 dB is a sane start — state what you chose and why); at most two corrective passes;
   then rename the temp over the original. Applies to EVERY branch (gated, clamped, and an unclamped target whose peak lands
   within a few tenths of the ceiling). Record `gainDb` = the gain actually applied, and the re-measured LUFS / peak; if the
   corrective passes still leave it over (not expected), keep the lowest result, `log.warn`, and say so in the result (a field
   or the error text — your call, stated). The failure policy is unchanged (a failure never loses the bytes). Red test FIRST
   through the REAL bundled ffmpeg on an **mp3** fixture that overshoots today (the verifier's case: a ~0.25 s noise burst →
   the gated branch; build the noise in JS like the existing fixtures — `anoisesrc` is absent from the bundled ffmpeg — then
   mp3 it with the bundled ffmpeg; if a JS fixture will not overshoot on the current code, find one that does — e.g. vary the
   burst, sample rate or stereo — and say what reproduced it); assert the product's re-measured true peak ≤ −1.5 and, inside
   the test, an independent check (decode the output to PCM with the bundled ffmpeg and compute the sample peak in JS ≤ −1.5
   dBFS). Keep the existing 18 normalizer tests green; the (C) case's WAV expectation stays.
2. **F2 — `resolveShotAssetRefs` marks only after the refs validate.** `src/main/services/studio/shot-asset-refs.ts:163-166`:
   compute `buildPromptAssets(refs, known)` FIRST, then `markLibraryUsedIn`, then return. Red test first in
   `shot-asset-refs.test.ts`: a library AUDIO ref (plus a valid image ref) → the call throws "visual-only" AND
   `markLibraryUsedIn` was NOT called.
3. **N3 — the pool-import seam gets a test** (the verifier's mutation M3: removing the mark at `studio-handlers.ts:299-301` left
   47 files / 352 tests green). Make the seam testable without growing the 674-line handler (e.g. a small exported function —
   `importMediaFilesMarkingLibrary(projectId, filePaths)` or similar — that the handler calls, in a file of its own or beside
   `library-used-in.ts`), and pin it with a test that FAILS when the mark is removed (prove it: run it once with the mark
   commented out, record the red).
4. **N2 + N5 — the answer text.** `normalizeError` stores ONE line (the first meaningful stderr line, trimmed, capped ~200
   chars, no CRLF; keep the full stderr in the log only) — `audio-normalize.ts`; and the gated answer no longer reads
   "Loudness peak −1.3 dBTP." with no LUFS clause (`audio-tools.ts` `describeLevel`): say it was peak-normalized (too short /
   too quiet for a loudness reading) and give the peak. Pin both in the existing tests.
5. **Live re-check (stopped-app drivers, the E2 kit; the app is NOT needed):** rebuild nothing for this; run the short-transient
   case through the REAL handlers on the E2 profile with the VERIFIER's stand-in
   `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2-verify\standins\v-short.mp3` (read-only — set `VIDTSX_AUDIO_STANDIN_FILE` to it;
   a new driver file `exit-short.e2.test.ts` in `.vidtsx-temp\end-to-end\E2\`, its own invocation), and re-run the ceiling case
   with `standin-quiet.mp3` in a new driver (or the existing one — a new generated file name is fine); measure the outputs with
   the INDEPENDENT meter (`ffmpeg-full` n8.1.2 `ebur128=peak=true` + `astats`) → true peak ≤ −1.5 dBTP and sample peak ≤ −1.5
   dBFS on both; write the numbers to `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\fix1.json`.
6. **Gates + rebuild:** full worktree vitest **`--maxWorkers=2`** (memory headroom is under 10 GB this session) with no app
   running, logged to `…\vidtsx-e2e\E2\vitest-full-2.log` — green except the three E-d2a suites, each only on package
   resolution; rule (b) re-run (the diff list changed: `git diff --name-only 5d77600..HEAD`, then the import-graph walk); tsc web
   26 / node 10. Then rebuild `wt/out` (DRIVING "Track E" step 1, no app running) so the verifier finds a current build.
7. **Records:** in the E2 `Status.md` entry and TESTING §18.15 — correct the over-claims (`Status.md:65-67` "a few tenths off
   it" → the ceiling now holds on the encoded file, with the new numbers; `:92-93` + `TESTING.md:504` "a throw marks nothing" →
   true after the F2 fix, say what changed; `TESTING.md:501` "−1.5 ± 0.1" → what holds for WAV vs mp3), N1 (`Status.md:158`
   `AssetTile.tsx:135` → `:139-140`), the pool-import seam's new test, a line "verifier round 1 FAIL (F1 ceiling over after the
   mp3 re-encode; F2 shot-ref mark before validation) → fix round 1 `<hashes>`", and the gate numbers. Commit with explicit
   paths, set `status: DONE`, LOG line, return the evidence.

**E-d11 (orchestrator, 2026-10-28, within Q2 "under −1.5 dBFS"):** the −1.5 ceiling is a property of the FILE the library
keeps, not of the pre-encode plan. A lossy re-encode can push the true peak a few tenths over (verifier: 0.25 s burst, gated
branch, +7.2 dB → −1.27 recorded / −1.3 dBTP / −1.268 dBFS sample by `ffmpeg-full`). So after the encode the product
re-measures and, when over, re-encodes from the ORIGINAL with less gain (corrective pass, at most two). Chosen over a fixed
pre-encode margin because it keeps the `gen_sfx.py` result exactly where no overshoot happens and lands clamped files as close to
the ceiling as the encoder allows. `gen_sfx.py` has the same single-pass hole (inherited) — the editor repo stays read-only.

(Superseded 2026-10-28 by the FAIL above:) **E2 is DONE on the builder side. Orchestrator: spawn the E2 verifier, round 1** (ORCHESTRATOR "Session 6": the exit, the gates,
its own negative / control cases on ITS OWN profile copy `profiles\E2-verify` without `settings.db*`, CDP 9272, its own stand-in
sounds through the dev seam `VIDTSX_AUDIO_STANDIN_FILE`, an independent meter; the E2 profile's library read-only). Its inputs:
`Status.md:10-192`, `docs/studio/TESTING.md:492-506`, this file, `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\exit.json` +
`exit-summary.md`.

(Done by builder #6, kept for the record:) **Builder #6 — the RECORDS only (no new measurement, no launch, no build, no driver run; everything is measured and under
Verified / `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\exit-summary.md` + `exit.json`).** In order: (1) read `Status.md:10-219`
(E1's entry = the house format) and `docs/studio/TESTING.md:476-493` (§18.14's shape); (2) write the E2 `Status.md` entry at the
TOP, dated 2026-10-24, titled like E1's, with: What · The code (every E2 commit: `60b5537` normalizer + rule, `841e311` call site +
stand-in + args, `68bbe44` usedIn seams, `3084668` listing row — what each did, file:line from "Done") · the loudness rule
(−20 LUFS under −1.5 dBTP, the `gen_sfx.py` clamp / gated / skip rule) and the bundled-ffmpeg toolset (`loudnorm` analysis pass +
`volume`; no `ebur128` / `astats` there) · the stand-in named as DEV-ONLY (`VIDTSX_AUDIO_STANDIN_FILE`, `!app.isPackaged`, after
the BYOK loop, `costUsd 0`, mp3 only) · `peakKind 'true'` = dBTP from `loudnorm` `input_tp` (E4's catalog import writes `'sample'`)
· bitrate libmp3lame 192k (one step above ElevenLabs' 128k) · the un-normalized policy (file kept, `audio.normalizeError`, the
answer's "NOT loudness-normalized (…) — the raw file is kept", the row's `(not normalized)` / `not normalized`; a Cancelled normalize
is recorded, not retried) · builder #2's notes answered ("Generating at ElevenLabs…" progress line left as is; `normalized` a
required boolean; the agents' `generate_audio` unchanged) · the `usedIn` seams (three; the pool-import one helper-tested only) ·
the listing row · the live click-through WITH the numbers (from Verified: main / ceiling / music, the meter, the CDP outputs,
the still path) and the Assets-screen-has-no-duration note · gates (import graph method + the 3 suites, 485 / 4138, tsc 26 / 10)
· not measured (the live ElevenLabs call; `generate_tsx_shot` assetRefs and the pool import seams unit-tested only; the short-
transient case only as a unit test (C) — no live 0.3 s stand-in) · for Hasan (the one live ElevenLabs `generate_sfx`) · evidence
paths; (3) TESTING §18.15 after §18.14's shape, items marked ✎ where they ran in the app over CDP (only the Assets click-through
did; the handlers ran in the stopped-app drivers on the live index); (4) V4-N1: `Status.md:98` + `TESTING.md:486` — drop proxies
from the probe width / height consumer list (`proxy-generator.ts` reads `duration` + `hasAudio` only); V4-N2 NOT needed
(`pre-e1-control.test.ts` untouched); (5) commit `docs(studio): E2 — records (Status entry, TESTING §18.15, V4-N1)` with explicit
paths (`Status.md` spelling), set this file's `status: DONE`, append the LOG line, commit again, return the evidence. The code is
complete (`3084668`); the E2 profile, both stand-ins, the build, the drivers, the still exist — do not remake or re-run them.

(The plan builder #5 followed, kept for the record:) Scratch: drivers + small logs in `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\
E2\`, everything over ~1 MB (build / app / full-vitest logs, stills, `exit.json`) in `C:\Users\hasan\AppData\Local\vidtsx-e2e\
E2\`. Never touch Hasan's `%APPDATA%\VidTSX Studio`, his projects, `profiles\source`, the B4 / B5 stations or any B6 / B7
scratch; never read, copy or open a `settings.db`.

0. **Resource guard + E-d4, right before each of (a), (b) and (c):** `Get-PSDrive C,D`; headroom = `(Get-CimInstance
   Win32_OperatingSystem).FreeVirtualMemory / 1MB` GB; go only with C: ≥ 3 GB AND (C: free + headroom) ≥ 6 GB (10:12:
   47.1 / 23.8 / 37.3). Start the watchdog once: copy `…\E1\watchdog.ps1` → `…\E2\watchdog.ps1`, point its profile match at
   `profiles\E2\profile` (it stops only OUR electron.exe when C: < 1.5 GB), run it in the background. E-d4: `Get-CimInstance
   Win32_Process -Filter "Name='electron.exe'"` — a process without `--user-data-dir` is Hasan's: then launch only if
   `%TEMP%\vidtsx-studio\export` has had no write in the last 10 min (0 processes / 0 writes at 10:12).
(a) **Rebuild the worktree's own `out/`** (DRIVING "Track E" step 1; Bash from the worktree root, ~2 min, can run in the
   background while (b) is written): `unset ELECTRON_RUN_AS_NODE; export NODE_OPTIONS=--max-old-space-size=8192; node
   D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build > /c/Users/hasan/AppData/Local/vidtsx-e2e/
   E2/build-1.log 2>&1` → rc 0, only "use client" warnings. Rebuild again after any later `src/` change.
(b) **The exit through the REAL handlers, app STOPPED** — a scratch vitest driver after E1's kit (`…\E1\upsert.e1.test.ts`
   / `list-assets.e1.test.ts`: copy their `vi.mock('electron')` / `../settings-db` / log mocks; `…\E1\vitest.e1.config.ts` →
   `…\E2\vitest.e2.config.ts` with its own `cacheDir` under `E2\` and the driver file(s) as `include`); run from the
   worktree root: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config D:/repos/VidTSX-STUDIO/
   .vidtsx-temp/end-to-end/E2/vitest.e2.config.ts > /c/Users/hasan/AppData/Local/vidtsx-e2e/E2/exit-run-1.log 2>&1`. Use
   TWO driver files (`exit-main.e2.test.ts`, `exit-ceiling.e2.test.ts`) run as two invocations — the engine is a singleton
   and keeps the first stand-in (Open problems). In each: `process.env.VIDTSX_AUDIO_STANDIN_FILE` = the mp3 (main:
   `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\standin.mp3`; ceiling: `…\standin-quiet.mp3`) at the TOP, before any import;
   `vi.mock('electron')` → `app.isPackaged: false`, `app.getPath('userData')` = `C:\Users\hasan\AppData\Local\vidtsx-e2e\
   profiles\E2\profile` (so the real `getLibraryRoot()` = `<profile>\assets`); if the normalizer needs it, mock the
   WORKTREE's `src/main/utils/paths` → `getRemotionBinariesDir: () => null` as `audio-normalize.test.ts` does (then
   `@remotion/renderer` finds the compositor's ffmpeg in the main checkout's `node_modules` — E1 proved it). The project:
   create ONE small project under `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E2\root\projects\<id>` the project-store
   way (read `src/main/services/studio/project-store.ts` for the create / load functions and the `project.json` shape — or
   create it LIVE first in (c) with `studioProjectCreate` and run the driver against it afterwards); build the
   `StudioToolContext` (`agent-tools/types.ts`: `req.projectId`, `state.importedAssets`, the emit) the way
   `audio-tools.test.ts` / `library-import.test.ts` do, but with the REAL project on disk and the REAL services unmocked.
   Then, in order: `initAudioGenerationEngine()` (`src/main/services/audio-generation-init.ts`; the warn names the stand-in
   file — capture it); `buildAudioTools(ctx)` → `generate_sfx({ prompt: 'a short airy whoosh', durationSeconds: 2, category:
   'motion', tags: ['whoosh', 'air'] })` → read the index (`library-index-io.ts` names the file under `<profile>\assets`) →
   the entry `generated/sfx-<slug>.mp3`: **item 1** `kind 'audio'`, `origin 'generated'`, `tags ['whoosh','air']`, `audio.
   {category 'motion', loudnessLufs, peakDbfs, peakKind 'true', source 'standin', model 'standin', gainDb ≈ −10.7}`,
   `probe.duration`; `usedIn [<projectId>]` already (the tool's own `importLibraryFile` marks — say so, item 3 first half);
   then the insert tools → `insert_asset({ assetId: 'library:generated/sfx-<slug>.mp3', lane: 'audio', at: 0 })` → `usedIn`
   still exactly `[<projectId>]` (**item 3**, dedup); then `list_assets({ scope: 'library', kind: 'audio' })` → **item 4**:
   the row `- library:generated/sfx-<slug>.mp3 (audio, 2.0x s, generated) — "a short airy whoosh" · category: motion ·
   tags: whoosh, air · −20.0 LUFS · used in: <projectId>` (the LUFS within ±0.5 of −20.0, one decimal). **Item 2, the
   independent meter** on `<profile>\assets\generated\sfx-<slug>.mp3` with `ffmpeg-full` (`…\source\profile\ffmpeg-full\
   ffmpeg-n8.1.2-50-g1a748fe2cd-win64-gpl-shared-8.1\bin\ffmpeg.exe`): `-af ebur128=peak=true -f null -` → I within −20 ± 0.5
   LU and true peak ≤ −1.5 dBTP; `-af astats` → sample peak ≤ −1.5 dBFS; `ffprobe.exe -show_entries format=duration` within
   10 ms of `probe.duration` (n8 trims the LAME delay / padding like `mp3-gapless.ts`); the recorded `loudnessLufs` /
   `peakDbfs` within ±0.5 of the meter. Ceiling file (second driver): expect `audio.gainDb ≈ +4.2` (= −1.5 − TP_in),
   `loudnessLufs ≈ −23.2` (above −20 — honest), `peakDbfs` −1.5 ± a few tenths (mp3 re-encode; builder #1's known limit) and
   the meter agreeing within ±0.5; the music path in the same second driver: `generate_music({ prompt: 'a soft bed',
   durationSeconds: <MUSIC_MIN_SECONDS or more — check src/audio-engine/generation> })` → `generated/music-<slug>.mp3`,
   `audio.source 'standin'`, the same normalize (the stand-in returns the same 2 s file whatever the request; the index
   `probe.duration` is the real 2.0 s). Write every number to `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\exit.json` +
   `exit-summary.md` (what was measured by what, with tolerances).
(c) **LIVE CDP, port 9262:** copy `…\E1\launch.sh` → `…\E2\launch.sh` (profile `C:/Users/hasan/AppData/Local/vidtsx-e2e/
   profiles/E2/profile`, port 9262, log `C:/Users/hasan/AppData/Local/vidtsx-e2e/E2/app-1.log`, and `export
   VIDTSX_AUDIO_STANDIN_FILE=C:/Users/hasan/AppData/Local/vidtsx-e2e/E2/standin.mp3` before the `exec` so the stand-in
   registers in the live app — the log line `DEV stand-in audio provider "standin" registered` appears when the engine
   initialises; check WHEN `initAudioGenerationEngine` runs — if only lazily on first use, say so and rely on the driver
   for the stand-in evidence); run with Bash `run_in_background`; ready = `window.api` + a visible nav button. FIRST CDP call,
   from a FILE-based driver (`…\E2\cdp.mjs` after `…\E1\cdp.mjs`): `window.api.studioRootSet({ root: 'D:\\repos\\VidTSX-
   STUDIO\\.vidtsx-temp\\end-to-end\\E2\\root' })` → `studioRootGet` echoes it; then confirm the library root is
   `<profile>\assets` (grep `src/shared/ipc/preload.ts` for a library-root getter; else the app log); then the Assets
   screen → `Refresh` (E1: it scans on first mount only) → `dblclick` the `generated` folder card → the generated sound(s)
   listed with duration; ONE still, `restore.ps1` (port 9262) in the SAME call as `Page.captureScreenshot` (race it against
   a timeout) → `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2\assets-generated.png`. `list_assets` cannot run live without a
   model turn (E-d9) → say "the stopped-app driver on the live index is the `list_assets` evidence". Stop: PowerShell
   `Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.CommandLine -like '*--remote-debugging-
   port=9262*' -or $_.CommandLine -like '*profiles\E2\profile*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`
   — never a bare number. (If (b) ran before (c), the live index already has the entries and the Assets screen shows them;
   if you create the project live first, run (b) after and take the still after a `Refresh`.)
(d) **Records:** `Status.md` entry at the TOP in the house format (copy the E1 entry's shape) with: the measured numbers
   (stand-in I / TP in → file I / TP / sample peak out, `gainDb`, `probe.duration` vs ffprobe), the stand-in named
   (`VIDTSX_AUDIO_STANDIN_FILE`, dev-only, `!app.isPackaged`, after the BYOK loop), `peakKind 'true'` (dBTP from `loudnorm`
   `input_tp`), the bitrate (libmp3lame 192k re-encode of ElevenLabs' 128k), the un-normalized policy (file kept, `audio.
   normalizeError`, the answer's "NOT loudness-normalized" line, the row's `(not normalized)` / `not normalized`), builder
   #2's four Open-problem notes answered ("Generating at ElevenLabs…" progress line left as is; a Cancelled normalize is
   recorded, not retried; `normalized` required; the mp3-only stand-in), the V4-N1 edit (`Status.md:98` + `TESTING.md:486`:
   drop proxies from the probe width / height consumers — `proxy-generator.ts` reads `duration` + `hasAudio` only) and V4-N2
   only if `pre-e1-control.test.ts` is touched; TESTING §18.15 block (E-d10, after §18.14's shape). Then the gates: the full
   worktree vitest run with the app stopped (`node …/vitest.mjs run > C:\…\E2\vitest-full-1.log 2>&1`; `--maxWorkers=2` while
   headroom < 10 GB), green except the three E-d2a resolution suites (`builder-libraries.test.ts`, `shot-bundle.test.ts`,
   `shot-bundle-in-place.test.ts`, each failing ONLY on package resolution) with rule (b): none of `git diff --name-only
   5d77600..HEAD` is in their import graph (static walk; say the method); tsc 26 / 10; commit (`docs(studio): E2 — …`, explicit
   paths, `Status.md` spelling); HANDOFF `status: DONE` + LOG line; return the evidence. Hand off at any numbered boundary
   when near 40 calls; never hand back with the app or a build running.

## Open problems

### Verifier round 1 — FAIL (2026-10-28; its own profile `profiles\E2-verify`, CDP 9272; evidence `C:\Users\hasan\AppData\Local\vidtsx-e2e\E2-verify\`, kit `.vidtsx-temp\end-to-end\E2-verify\`)

- **F1 (code defect + exit miss on the short-transient case + records defect) — the −1.5 ceiling is not held after the mp3
  re-encode.** Stand-in `v-short.mp3` (0.25 s, 44.1 kHz stereo noise burst; meter in: I −70 LUFS (gated), TP −8.7 dBTP) →
  real `generate_sfx` → `generated/sfx-verifier-short-noise-hit.mp3`: gated branch, gain +7.2 (= −1.5 − (−8.7)), recorded
  `peakDbfs −1.27`; independent `ffmpeg-full`: ebur128 TP **−1.3 dBTP**, astats sample peak **−1.268 dBFS** — ~0.23 dB OVER −1.5
  (Q2 "under −1.5 dBFS"; exit item 2 "peak ≤ −1.5"). Cause: `audio-loudness-rule.ts:72` (gated `gainDb = ceiling − peak`) and
  `:75-76` (clamp) land exactly on the ceiling; `audio-normalize.ts:154-171` does one lossy libmp3lame 192k re-encode, then
  re-measures and records, never enforcing; the engine always writes `.mp3` (`audio-generation-engine.ts:155`), so every
  gated / clamped generation can overshoot. Unit (C) (`audio-normalize.test.ts:162-168`) uses a lossless WAV; the builders' and
  the verifier's clamped cases happened to land under (−1.8, −1.86). Inherited from `gen_sfx.py` (same single pass). Records:
  `TESTING.md:501` "peak-normalized to −1.5 ± 0.1" (true for WAV only); `Status.md:65-67` "a few tenths of a dB off it" does not
  say it can go OVER. → E-d11 under Next step.
- **F2 (code defect + records defect) — `resolveShotAssetRefs` writes `usedIn` before the refs validate.**
  `shot-asset-refs.ts:163-165` marks, then `:166` `buildPromptAssets` throws for an audio ref (`:62-66` "shots are visual-only
  (D2)") → `generate_tsx_shot` fails but the index lists the project for an asset it never got. Evidence `run-short.json`:
  `shotC.threw` "Asset ref 'snd' is audio — shots are visual-only…", `usedInAfterShotC ["e2v-a","e2v-c"]`; also
  `sfx-verifier-loud-pink-burst.mp3` ended `usedIn [e2v-a, e2v-b, e2v-c]` the same way. Records: `Status.md:92-93` +
  `TESTING.md:504` "a throw marks nothing" — false for this throw.
- Notes (non-blocking): **N1** `Status.md:158` points at `AssetTile.tsx:135` (`<CopyIcon />`); the name is :139-140. **N2**
  `normalizeError` stores the whole multi-line ffmpeg stderr (CRLF, the absolute user path, exit code 4294967274) and the answer
  prints all of it. **N3** the pool-import seam has no test (mutation M3: mark removed → 47 files / 352 tests green); live it
  works (`studioMediaImport` into `e2v-b` → `usedIn [a, c]` → `[a, c, b]`). **N4** a path whose under-root part differs in case
  (`GENERATED/SFX-….MP3`) is not marked (index keys case-sensitive) — logged, left to the next scan. **N5** a gated file's answer
  reads "Loudness peak −1.3 dBTP." with no LUFS clause. **N6** in `applyGain`'s catch `fs.rm` could mask the original error (still
  caught upstream). **N7** the port matches `gen_sfx` (true peak instead of sample peak — stricter, documented; the 0.1 dB skip =
  `apply_gain`). **N8** `wt/node_modules/.vite` (one 48 KB cache file from 2026-10-23 20:19) — an earlier run's, harmless.
- What passed (for the record — the verifier's own numbers): gates — full worktree vitest `--maxWorkers=2` 3 failed | 485
  passed | 5 skipped files, 9 failed | 4,138 passed | 35 skipped tests (the 3 E-d2a suites, resolution only; its own import-graph
  walk: 0 / 0 / 1 hits, the one an erased `import type`), tsc 26 / 10; loud stand-in (−7.2 LUFS / +0.2 dBTP in) → recorded −20.28
  / −12.9, meter I −20.3 / TP −12.9 / astats −12.896, probe 2.5 = ffprobe 2.500000; `usedIn [A]` → `[A]` (dedupe) → `[A, B]`; the
  row with category / tags / −20.3 LUFS / used in; ceiling (−34.7 / −13.5 in) → gain +11.99 clamped, −23.07 / −1.86 recorded, meter
  −23.0 / −1.9 / −1.873; music −20.26 / −12.7 vs meter −20.2 / −12.7; at-target −20.01 → gain 0, bytes md5-identical; an mp2-in-
  `.mp3` → bytes kept, `normalizeError`, "NOT loudness-normalized … the raw file is kept", row "· not normalized"; the stand-in gate
  (unset / packaged / missing → not registered; control → `["standin"]`); six outside-root paths → null, index unchanged;
  mutations M1 (normalize call removed → 3 / 9 fail), M2 (`importLibraryFile` marks removed → 2 / 4 fail); live CDP 9272 Studio
  root first, Assets › generated 7 files, index fields kept after the app's own scan; records' numbers and ~60 pointers checked
  (all right except N1); V4-N1 fixed.

- (builder #2, note, not blocking) The tool's progress line still reads "Generating at ElevenLabs…" when the stand-in
  answers (`audio-tools.ts` `emitProgress`); cosmetic — the answer text itself names nothing provider-specific. Fix only if
  a later step touches that line; say so in Status if not.
- (builder #2, note) A caller abort DURING the normalize pass returns `normalized: false, error: 'Cancelled'`, and the raw
  file is indexed with `audio.normalizeError: 'Cancelled'` (the bytes are kept, the turn is cancelled anyway). Re-running
  the normalizer on an existing entry is not in E2's scope — one line in Status.
- (builder #2, note) `GeneratedAudioAsset.normalized` is a REQUIRED boolean; tsc confirmed the agents' `generate-audio.ts`
  compiles unchanged (it reads none of the new fields — its answer does not print the LUFS; E2 does not change it).
- (builder #2, for the live step) The stand-in file must be an mp3 (the engine's `ext` is `.mp3`, by design left as is);
  the exit's locally made sound (band-limited noise, peak near 0 dBFS, not at −20 LUFS) therefore goes through
  `ffmpeg-full` into an mp3 BEFORE it is named in `VIDTSX_AUDIO_STANDIN_FILE`.
- (builder #3, note, not blocking) `handleStudioMediaImport`'s `usedIn` mark (`studio-handlers.ts:299-301`) is wired but
  covered by the helper's test only (`library-used-in.test.ts` → `markLibraryUsedInForPaths`); the handler has no test and
  the file is 674 lines (over the ~300 rule since long before E2). The live step's pool-import check, if wanted: drop a copy
  of a library file by path through `studioMediaImport` and read `usedIn` — optional, the plan's exit does not need it.
- (builder #3, note) The marks are awaited inline (one index read + at most one atomic write per landing, on the per-root
  chain). `generate_sfx` → its own `importLibraryFile` marks; a following `insert_asset` on the same ref re-marks (a read,
  no write). A second `generate_sfx` in the same turn finds the asset in `ctx.state.importedAssets` and re-marks likewise.
- (builder #3, note) In `resolveShotAssetRefs` the ONE mark comes after the loop, so a later ref that throws (missing file,
  failed import) leaves earlier refs unmarked — consistent with the call failing as a whole (its `imported` list is lost
  too). A file under the root that the index has never seen (a fresh copy before the next reconcile) is logged and left
  to the next scan, as designed (§4) — the scan's upsert does NOT know the project id, so that one landing is never
  recorded; acceptable (T6 says "written when a ref lands"; the index normally knows every file by then).
- (builder #3, housekeeping) The worktree has an UNCOMMITTED 7-line change in `docs/studio/end-to-end/E4/HANDOFF.md`
  (someone else's — present before builder #3 started; left unstaged, not E2's). Commit with explicit paths only.
  **Resolved by builder #4's start:** `git status` was clean at `c3663f8` (the orchestrator committed it) — nothing foreign
  is pending in the worktree now; keep committing with explicit paths anyway.
- (builder #4, for the live step) `standin.mp3` decodes to a TRUE peak of **+0.6 dBTP** (sample peak +0.54 dBFS): the
  mp3 encode overshoots the −0.3 dBFS limiter and a decoded mp3 may exceed full scale. The normalizer reads
  `loudnorm`'s `input_tp` (≈ +0.6) and applies ≈ −10.7 dB (= −20 − (−9.3)), so the ceiling cannot bind on this file — as
  the main case should be; the ceiling is exercised by `standin-quiet.mp3`. Record the live `input_tp` the product saw
  (`audio.gainDb` = −20 − I_in when not clamped) next to the independent numbers.
- (builder #4, lesson, R128 gating) A **gated** burst train (noise bursts between digital silence) is NOT "quiet" to an
  EBU R128 meter: the relative gate (−10 LU under the ungated mean) drops the silent blocks and the integrated value is
  the loudness of the bursts alone (a 9 %-duty train of −6 dBFS white-noise bursts read **−19.8 LUFS**; a −34 LUFS bed +
  one −6 dBFS burst would read ≈ −20 for the same reason). A ceiling-binding file must be UNIFORM over its 400 ms blocks
  (every block the same loudness): a sample-accurate `aevalsrc` train of short tone bursts every 100 ms. The product's
  `loudnorm` gates the same way, so the live case's recorded `loudnessLufs` on such a file is honest.
- (builder #4, note) `robocopy`'s exit code 1 means "files copied" — the PowerShell tool reports it as a failure; read
  the summary lines, not the rc. The copy of the 372 MB profile took 3 s.
- (builder #4, for the live step) The engine is a module singleton (`ensureAudioGenerationEngine`), and `registerInstance`
  keeps the first `activeId` (`??=`): to run the main AND the ceiling case through the real handlers, either use TWO driver
  files run as two vitest invocations (each with its own `VIDTSX_AUDIO_STANDIN_FILE` set before any import), or check
  `audio-generation-init.ts` `unregister` (:52) / the engine's `unregister` resets `activeId` before re-registering — the two
  files are the simpler path. **Done so (builder #5): two driver files, two invocations — worked.**
- (builder #5, for the records) **The Assets screen prints no duration** anywhere: a tile shows the name + the description
  (`AssetTile.tsx:135`), the details panel shows Type / Size / Origin / Added / Path (`AssetDetailsPanel.tsx:86-90`) — pre-E2 UI,
  unchanged. The plan's "shows the generated sound … with its duration" is met by the index (`probe.duration 2`) and the
  `list_assets` row (`2.00 s`) from the stopped-app driver on the SAME live index, as E1 recorded it. Whether the details panel
  should print `probe.duration` (and the LUFS / tags) is a UI addition for Hasan's call, not E2's exit.
- (builder #5, note) Run 1 of the main driver left `generated/sfx-a-short-airy-whoosh.mp3` in the live library (the product path was
  fully right — same values as run 2; the driver's meter helper used `execFileSync`, which returns stdout only while ffmpeg prints
  its summary to stderr → fixed with `spawnSync`). The exit's numbers are run 2's `…-whoosh-2.mp3`. The Assets still shows both.
- (builder #5, note) The live app initialises the audio engine lazily (`ensureAudioGenerationEngine` at `generate-audio-asset.ts:97`,
  `agents/tool-support.ts:74`; eagerly only on a key save, `provider-keys-handlers.ts:66`), so `app-1.log` has no stand-in line — the
  stopped-app driver's stdout has it (`[AudioGenerationStandin] DEV stand-in audio provider "standin" registered
  (VIDTSX_AUDIO_STANDIN_FILE)`); the live app was not asked to generate (no model turn, E-d9). The launcher exported the env var
  anyway.
- (builder #5, safety note) `studioRootGet` BEFORE the first call answered `C:\Users\hasan\Videos\VidTSX Studio` — the fresh profile's
  Home listed Hasan's projects for the ~5 s between readiness and `live.mjs root` (nothing opened, nothing written; DRIVING "Studio
  root FIRST" followed — it was the first CDP call after `wait`).
- (builder #5, note) `insert_asset` answers `Insert proposed (id "prop_…"): Insert "sfx-a-short-airy-whoosh-2.mp3" as audio at
  0:00.0 · 2.0 s` — a review card, not applied (apply is the renderer's); its `resolveAssetRef` re-marks `usedIn` (a read, no write:
  still exactly `["e2-exit"]`). `list_assets({ scope: 'library', kind: 'audio' })` ignores `kind` (E3's arg) — the row is the same.
- (builder #5, note) `generate_music` with `durationSeconds: 3` (the engine's `MUSIC_MIN_SECONDS`) → the stand-in's 2.0 s file; the
  index `probe.duration` is the real 2.0 s and the answer prints `2.00 s` (the probe wins over the request, as designed); no
  `category` given → none written (`audio` without `category`), tags none.
- (builder #6, discrepancy — records vs the code at HEAD; the Status entry uses HEAD's numbers) Several file:line refs in "Done"
  above no longer match the code at `3084668` (= HEAD for `src/`): `generate-audio-asset.ts` — `normalizeAudioFile` is at :135 (Done:
  :131), `peakKind: 'true'` :142 (the meta, Done: :134-143), `upsertEntry` :152 (Done: :148-154), `probe?.duration` :159 (Done:
  :155-156), `normalizeCategory` :102 (Done: :108-111); `library-listing.ts` is 78 lines with `formatLibraryRow` :22 and
  `formatMetaSuffix` :43 (Done: 57 lines, :21-33 / :35-57); `library-paths.ts` `libraryRelPathOf` :69 (Done: :63-75);
  `library-import.ts` existing-asset mark :51 (Done: :50-53); `audio-tools.ts` `describeLevel` :61-63 (Done: :66-74, before builder
  #4 moved `signed()` out); and the engine's hard-coded `ext: '.mp3'` is at `audio-generation-engine.ts:155`, not :158 (design note
  §2, builder #2's note). No behaviour claim is affected — only the line numbers.
- (builder #6, note — not in HANDOFF before) The music path's answer names the SAME project asset id as the ceiling case
  (`266dace6-b947-4506-852a-f1dded303690`, `exit.json` `ceiling.answer` / `music.answer`): both generated files are byte-identical
  (one stand-in through the same +4.18 dB; index `hash 836dabd68d5c49cd6541da85f78e611424ec87e6` on both), so `importLibraryFile`'s
  `matchExistingAsset(known, absPath, hash)` (`library-import.ts:46`, pre-E2) returned the tick train's project asset; the music
  entry's `usedIn ["e2-exit"]` was still marked (:51). A stand-in artefact (a real provider never returns identical bytes for two
  prompts); recorded in Status / TESTING, not a finding. A verifier may want its two stand-ins to differ.

## Do-not-redo

- The design note (code already read: the list in its first paragraph — do not re-read those files beyond the lines
  you edit).
- `audio-loudness-rule.ts` + `audio-normalize.ts` + their 18 tests (green at `60b5537`; the red run is recorded under
  Verified). The `LibraryAudioMeta` additions.
- The bundled-ffmpeg toolset re-check of 2026-10-24 (`anoisesrc` absent; `sine` / `anullsrc` present — the fixtures are
  JS-written WAVs anyway).
- Builder #2's call site, `normalizeTags`, the `category` / `tags` args, the stand-in provider + `registerDevStandinProvider`
  and their 24 new / updated tests (green at `841e311`; the red run is under Verified). The answer's `−20.0 LUFS` form
  (U+2212, one decimal) is pinned by `audio-tools.test.ts` — the §5 listing row should print the same form, not redesign it.
- Builder #3's `library-used-in.ts`, `libraryRelPathOf`, the three seams and their 19 tests (green at `68bbe44`; the red
  run is under Verified). The pool-import seam stays helper-tested only (said under Open problems) — do not write a
  `studio-handlers` test for it unless a verifier asks.
- Builder #4's `format-level.ts` + the §5 suffix in `library-listing.ts` and their 6 tests (green at `3084668`; the red run
  is under Verified). The row's form is pinned by exact strings — do not restyle it.
- The E2 profile copy (`profiles\E2\profile`, no `settings.db*`) and the two stand-in mp3s with their measurements (under
  Verified) — reuse them; remake a stand-in only if its file is gone (the recipes are under Verified).
- The environment snapshot of 10:12 is NOT a substitute for the resource guard: run `Get-PSDrive C,D` + the headroom
  check again right before the build, the driver and the launch.
- (builder #5) The worktree build at `3084668` (`wt/out`, `build-1.log`) — rebuild only after a `src/` change. The two exit drivers
  and `exit.json` / `exit-summary.md` (re-running them adds MORE generated files to the live library — `-3.mp3` …; do not re-run
  for the records). The live click-through + the still `assets-generated.png`. The import-graph run (`…\E2\import-graph.txt`) —
  re-run only if the diff list changes (a `src/` commit).
- (builder #6) The records: `Status.md:10-192`, `docs/studio/TESTING.md:492-506`, V4-N1 (`3249cbe`). A verifier fix round edits
  them in place; it does not rewrite them from scratch.

## For Hasan (real-video list candidates)

- The one live ElevenLabs `generate_sfx` call (a real key, his profile) — checks the real response goes through the
  same normalize / probe / index path as the stand-in (E-d6).

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-24 · builder #1 · ~30 · read the brief's docs (HANDOFF, DRIVING, ORCHESTRATOR B/4/5, PLAN §1.6 / T6 / track E,
  TESTING §17 / §18.14, E1 design + fix rounds + do-not-redo) and ≈ 1,600 lines of code; wrote the design note (a)–(f);
  built design §1's normalizer + rule red → green (18 tests through the real bundled ffmpeg), types 26 / 10, commit
  `60b5537`; records + hand-off. No launch, no profile copy, no live step.
- 2026-10-24 · builder #2 · ~42 · read the brief's docs (HANDOFF in full, DRIVING "Never touch" / "Isolated instance" /
  "Repo facts" / "Track E", ORCHESTRATOR session-4 decisions + session 5, PLAN T6 + the E2 row, TESTING §17 / §18.14) and
  ≈ 1,100 lines of code (the six files of the step + the engine / provider / normalize / store / index-io signatures);
  built design §1 "Call site" + §2 stand-in + §3 args red → green (24 new / updated tests; 9 files / 67 green incl. the
  E-d5 control and the normalizer suites), types 26 / 10, commit `841e311`; records + hand-off after the step. No launch,
  no profile copy, no live step.
- 2026-10-24 · builder #3 · ~32 · read the brief's docs (HANDOFF in full, DRIVING "Never touch" / "Repo facts" / "Track E",
  ORCHESTRATOR session 4 + 5, PLAN T6) and ≈ 1,500 lines of code (only the files the Next step named: index-io, library-paths,
  library-import, shot-asset-refs + its test, the handler's import block + :275-302, the V2 fields, the test-mock patterns
  of `library-filing.test.ts` / `audio-generation-standin.test.ts` / `audio-tools.test.ts`); built design §4 red → green (19
  new tests in 4 files; neighbouring suites 33 files / 251 green), types 26 / 10, commit `68bbe44`; records + hand-off
  after the step (the 30 % rule: one numbered step). No launch, no profile copy, no live step.
- 2026-10-24 · builder #4 · ~28 · read the brief's docs (HANDOFF in full, DRIVING in full) and ≈ 250 lines of code (only
  the files the Next step named: `library-listing.ts` + its test, `audio-tools.ts:1-16` / `:50-79`, `asset-library.ts:20-75`);
  built design §5 red → green (6 new tests in 2 files; `audio-tools.test.ts` unchanged green; neighbouring suites 34 files /
  257 green), types 26 / 10, commit `3084668`; then the launch-free preparations of the live step: the environment
  snapshot, the E2 profile copy (no `settings.db*`), the two stand-in mp3s made + measured with `ffmpeg-full` (three
  tries for the ceiling-binding one — the R128-gating lesson under Open problems); records + hand-off at the step
  boundary. No launch, no build, no driver run.
- 2026-10-24 · builder #5 · ~36 · read the brief's docs (HANDOFF in full, DRIVING in full, ORCHESTRATOR session 4 + 5, CDP doc
  Launch / Minimal driver / visibility rule, the E1 kit) and ≈ 450 lines of code (only what the drivers needed: `agent-tools/types.ts`,
  `audio-generation-init.ts`, `createProject`, `studio-paths.ts` / `settings.ts` root resolution, the preload names, `AssetTile` /
  `AssetDetailsPanel` hooks); rebuilt `wt/out`; wrote the E2 kit + the two REAL-handler drivers; ran the exit (items 1–4, the
  ceiling case, the music path — all within tolerance, numbers in `exit.json`); the live click-through on 9262 (Studio root first,
  library root confirmed, Assets → generated, the still); the gates (import graph, full vitest, tsc); records + hand-off at the
  step boundary (the records are the next step). No `src/` change.
- 2026-10-28 · builder #6 · ~25 · the RECORDS only: read CLAUDE.md, this HANDOFF in full, `Status.md:1-225` (E1's entry), TESTING
  §18 head + §18.14, DRIVING "Never touch" + "Track E", ORCHESTRATOR "Track B decisions" + "Session 6", PLAN T6 + the E2 row, the
  evidence (`exit-summary.md`, `exit.json`, the gate logs) and `grep -n` line checks of the E2 files; wrote the Status entry
  (`Status.md:10-192`), TESTING §18.15 (`:492-506`), V4-N1 (Status W2 line now :282, TESTING :486); commit `3249cbe`; HANDOFF
  DONE + LOG. No `src/` change (`git diff --stat 3084668..HEAD -- src/` empty), no build, no launch, no driver run, no vitest.

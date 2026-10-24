# E2 — Generation writes loudness-normalized files with category/tags; `usedIn` written on every landing
status: BUILDING

> Track E, session 5. **Work only in the worktree** `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E\wt`
> (branch `end-to-end-p0-e`); paths below are relative to it. Decisions E-d1…E-d10 + E-d2a in ORCHESTRATOR.md
> "Session 4 — track E" and the session-5 overrides ("Session 5") bind this part. E1 (`a35aef3` + fix round 3)
> is the base: `kind` / `probe` / `probeStamp` / `tags` / `audio` / `usedIn` exist as optional index fields and
> `tags` / `audio` / `usedIn` are still written by NOBODY.

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
- NOT built yet: the call site in `generateAudioAsset` + `audio` / `tags` (design §1 "Call site", §3), the stand-in (§2),
  `usedIn` (§4), the listing row (§5), the remaining tests of §6, the live check.

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
- No launch, no profile copy, no live step yet (no resource check needed so far).

## Next step (ONE concrete instruction)

**Builder #2:** wire the call site, the stand-in and the args — design §1 "Call site", §2, §3 — red first. (1) Tests:
update `src/main/services/library/generate-audio-asset.test.ts` (add `vi.mock('./audio-normalize', …)` →
`normalizeAudioFile` mock resolving `{ normalized: true, loudnessLufs: -20.01, peakDbfs: -8.2, gainDb: -8, clamped:
false, gated: false, skipped: false }`; `upsertEntry` must receive `{ origin, description, brandId?, tags: [...],
audio: { category?, loudnessLufs, peakDbfs, peakKind: 'true', source: 'elevenlabs', model: 'eleven_text_to_sound_v2',
gainDb } }`; a `normalized: false, error: 'apply failed: x'` mock → `audio.normalizeError: 'apply failed: x'` and the
file still on disk; `durationSeconds` = `upsertEntry`'s returned `probe.duration` when present, else the engine's 3;
`tags` normalized — trim / lower-case / dedupe / cap 20; `category` lower-cased), update `src/main/services/studio/
agent-tools/audio-tools.test.ts` (`generate_sfx({ prompt, category: 'motion', tags: ['Whoosh', 'air'] })` passes
`category` + `tags` to `generateAudioAsset`; the answer text contains the LUFS (`−20.0 LUFS`) and the probed
duration; a `normalized: false` result → the text says "NOT loudness-normalized (<error>) — the raw file is kept";
`generate_music` likewise), and give the agents' `src/main/services/agents/tools/generate-audio.test.ts` mock
`normalized: true` (keep it green — no arg change there). Run the three → red. (2) Code: `generate-audio-asset.ts`
(request gains `category?: string`, `tags?: string[]`; after `fs.writeFile`: `const norm = await
normalizeAudioFile(absPath, { signal: req.signal })`; `upsertEntry(root, relPath, { origin, description, brandId?,
tags?, audio })` with the `audio` meta of design §1; result gains `normalized`, `loudnessLufs?`, `peakDbfs?`,
`normalizeError?`, `category?`, `tags?`, and `durationSeconds = entry.probe?.duration ?? result.durationSec`);
`normalizeTags(tags?: string[]): string[] | undefined` in `library-filing.ts` (+ 2 cases in `library-filing.test.ts`);
`audio-tools.ts` (both tools: `category: z.string().min(1).max(40).optional()` described with motion / tension /
emphasis / snap / foley / reward / texture / impact (music: bed / sting / …), `tags: z.array(z.string().min(1)).max(20)
.optional()`; the answer line as designed); the stand-in: `src/audio-engine/generation/providers/standin-audio-provider.ts`
(`StandinAudioProvider(filePath)`, `id 'standin'`, `generate()` → `{ bytes: await fs.readFile(filePath), contentType:
'audio/mpeg', model: 'standin' }`, `pricePerSecondUsd() → 0`) + its test (bytes back; through
`createAudioGenerationEngine().registerInstance(provider)` → `generate({ kind:'sfx', prompt:'x', durationSec: 2 })`
gives `providerId 'standin'`, `model 'standin'`, `costUsd 0`, `ext '.mp3'`); `src/main/services/audio-generation-standin.ts`
`registerDevStandinProvider(): boolean` (only when `!app.isPackaged` AND `process.env.VIDTSX_AUDIO_STANDIN_FILE` names
an existing file; `log.warn` naming the file when it registers — it is a dev seam), called at the END of
`initAudioGenerationEngine` in `audio-generation-init.ts` (after the BYOK loop; `audio-generation-init` has no test —
unit-test the helper with `electron` mocked: packaged → false / no env → false / file missing → false / ok → registered).
Run → green; types 26 / 10; commit `feat(studio): E2 — generation records loudness, category, tags; the dev stand-in
provider` (explicit paths); then continue with §4 (`usedIn`: `library-used-in.ts` + `libraryRelPathOf` + the three
seams, tests red first) and §5 (the listing row) by the 30 % rule — hand off after a step with the HANDOFF updated.

## Open problems

(none yet)

## Do-not-redo

- The design note (code already read: the list in its first paragraph — do not re-read those files beyond the lines
  you edit).
- `audio-loudness-rule.ts` + `audio-normalize.ts` + their 18 tests (green at `60b5537`; the red run is recorded under
  Verified). The `LibraryAudioMeta` additions.
- The bundled-ffmpeg toolset re-check of 2026-10-24 (`anoisesrc` absent; `sine` / `anullsrc` present — the fixtures are
  JS-written WAVs anyway).

## For Hasan (real-video list candidates)

- The one live ElevenLabs `generate_sfx` call (a real key, his profile) — checks the real response goes through the
  same normalize / probe / index path as the stand-in (E-d6).

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-24 · builder #1 · ~30 · read the brief's docs (HANDOFF, DRIVING, ORCHESTRATOR B/4/5, PLAN §1.6 / T6 / track E,
  TESTING §17 / §18.14, E1 design + fix rounds + do-not-redo) and ≈ 1,600 lines of code; wrote the design note (a)–(f);
  built design §1's normalizer + rule red → green (18 tests through the real bundled ffmpeg), types 26 / 10, commit
  `60b5537`; records + hand-off. No launch, no profile copy, no live step.

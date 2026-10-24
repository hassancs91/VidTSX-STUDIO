# E2 — Generation writes loudness-normalized files with category/tags; `usedIn` written on every landing
status: NEW

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

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

**Builder #1:** read this file, then the files named under "§1.6 facts" (≈ 700 lines; do not read more than you
need), and write a **design note** here (under Done) before building: (a) the normalize step — where it runs
(inside `generateAudioAsset` between `fs.writeFile` and `upsertEntry`, as a pure service, e.g.
`src/main/services/library/audio-normalize.ts` ≤ 300 lines: measure (loudnorm analysis JSON) → gain rule (gen_sfx) →
apply (`volume`, one re-encode, same ext) → re-measure → `{ loudnessLufs, peakDbfs, gainDb, clamped, gated }`), its
failure policy (ffmpeg missing / fails → the file is kept un-normalized and the entry says so — never lose the
generated bytes), and how it is unit-tested through the REAL bundled ffmpeg (fixtures made with `anullsrc` /
`sine` / `anoisesrc` if present — check `-filters`; otherwise write PCM wavs from a few lines of JS); (b) the stand-in
provider (E-d6) — dev-only, env-named file, `costUsd 0`, `source 'standin'`; (c) `category` + `tags` on
`generate_sfx` / `generate_music` and the `audio` record (`source` = the provider id, `model` = the engine's);
(d) the `usedIn` helper in `library-store.ts` + the three seams; (e) the `list_assets` row format; (f) the test
list, red first. Then build (a) + its tests, commit at a green checkpoint, and hand off or continue by the 30 %
rule. Pure ops with unit tests first, then the seams, then the live check (rebuild `wt/out` after every `src/`
change — ~2 min).

## Open problems

(none yet)

## Do-not-redo

(nothing yet)

## For Hasan (real-video list candidates)

- The one live ElevenLabs `generate_sfx` call (a real key, his profile) — checks the real response goes through the
  same normalize / probe / index path as the stand-in (E-d6).

## Agents so far (date · approx tool calls · what they covered)

(none yet)

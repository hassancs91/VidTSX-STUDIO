# E3 — Reuse-before-generate (prompt rule, `generate_sfx` top-3 matches, `force`); Assets screen playback + origin/tag chips
status: DONE

> Track E, session 5 — **runs AFTER E4** (the exit, the whoosh case, needs the imported library). **Work only in the
> worktree** `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E\wt` (branch `end-to-end-p0-e`); paths below are relative
> to it. Decisions E-d1…E-d10 + E-d2a (ORCHESTRATOR.md "Session 4 — track E") and the session-5 overrides ("Session 5")
> bind this part. Base: E1 (index v2), E2 (generation normalizes + `category` / `tags` args + `usedIn` on landing + the
> `list_assets` row with category / tags / LUFS / usedIn), E4 (45 + 6 catalog clips in the isolated library). Read E2's
> and E4's HANDOFF "Done" for the field semantics and the relPath scheme before designing.

## Goal (the §3 row verbatim + the exit)

| **E3** | Reuse-before-generate (prompt rule, `generate_sfx` top-3 matches, `force`); Assets screen playback + origin/tag chips | the whoosh case in E5 |

**Exit:** the whoosh case in E5 — §0 E5 verbatim: "**A generated sound is found before it is regenerated** · how
measured: the agent asked for a sound that exists in the imported library · target: placed from the library, no
generation call; a generated one appears with duration, tags, loudness, and plays".

**How the exit is measured (orchestrator):** on an isolated profile (E-d3: `…\vidtsx-e2e\profiles\E3\profile`,
copied from `source` WITHOUT `settings\settings.db*` → the keyless `claude-subscription` is the app default, as in
B6 / B7; library root `<profile>\assets`), with the 45 + 6 catalog clips imported by E4's importer (explicit target =
this profile's library) and a small fresh project on a scratch Studio root on D: (one short clip on V1 so an `at`
exists; Studio root set FIRST):
1. **The whoosh case (live, the real Assistant tab, real input, keyless subscription, a handful of turns — E-d9):**
   ask for a soft whoosh at a cut the way Hasan would ("Add a soft whoosh at the first cut."). PASS = the turn ends
   with an `insert_asset` card (or an applied clip, if the user's ask was explicit) whose asset is the LIBRARY clip
   (`library:<E4 relPath of whoosh-soft or another whoosh-tagged sfx>`), and **no generation happened**: the stand-in
   provider (E2, dev-only) is either not registered or, if registered for the control, its call counter stays 0; the
   tool log shows `list_assets` and/or `generate_sfx` returning matches, then `insert_asset`. Measured from the
   turn log / `aiUsageGetLog` rows and the index (`usedIn` of the placed clip gains the project id — E2), not from the
   model's prose. Run the same ask twice (model variance, B6 lesson); both must place from the library. **Negative /
   control:** the same ask for a sound the library does NOT have ("a cuckoo clock chime") → with no audio provider
   configured the tool says so (no provider notice, no crash); with the E2 stand-in registered (dev-only env) it
   generates once and the generated file lands with duration, tags, −20 LUFS and `usedIn` (E2's exit, re-shown here —
   "a generated one appears with duration, tags, loudness"). **`force`:** `generate_sfx({ prompt: 'soft whoosh',
   force: true })` through the REAL handler generates (stand-in) even though matches exist.
2. **The tool-level rule (REAL handlers, no model):** `generate_sfx({ prompt: 'a soft airy whoosh for a transition'
   })` on the imported library returns the top three library matches (refs, durations, categories, tags, LUFS,
   `usedIn`) and does NOT generate — and does so BEFORE the "no audio provider" check, so reuse works on a profile
   with no key; `list_assets(scope:'library', kind:'audio', query:'whoosh')` lists the whoosh clips with duration,
   category, tags, `usedIn`; a query with no match returns the empty answer, not an error. Ranking is a pure function
   with unit tests (tags / category / description / file name; the order on a few realistic prompts recorded).
3. **The prompt rule:** the Studio assistant prompt says search the library before generating any SOUND (today it
   says so for b-roll only — `studio-agent-prompt-tools.ts:69-70`); the preset mapping line (`:75`) for an `sfx` /
   `music` step says the same. Unit-pinned (the prompt builder's tests).
4. **Assets screen (live CDP, the worktree's own build, the E3 profile):** an audio tile plays its sound (a visible
   play control on the tile or in the details panel; the details panel has an `<audio controls>` and shows origin +
   tag chips and the sound fields — category, LUFS, peak, source, `usedIn`); clicking play on `whoosh-soft` produces
   a playing `<audio>` element (`!paused`, `currentTime` advancing — read over CDP) with the right `src`; a still of
   the details panel with the chips; the chips FILTER (click a tag or an origin chip → the grid narrows; the search
   service's unit tests cover origin / tag matching). "Plays" is measured from the DOM (`paused`, `currentTime`,
   `readyState`), not by ear; the by-ear check goes on Hasan's list.
5. `CAPABILITY_GAPS.md` G4 gets the "narrowed by E" note (§5 "Docs to update when built").
Plus the session gates (DRIVING "Track E": worktree vitest green except the three E-d2a resolution suites + rule (b);
`tsc` web 26 / node 10; Status.md row at the top; TESTING **§18.17** — E-d10).

## Plan context

- **T6 (decision, the "Reuse before generate" bullet, verbatim):** "`list_assets(scope:'library', kind:'audio',
  query)` shows duration, category, tags and `usedIn`; the prompt rule says search first; `generate_sfx` returns the
  top three library matches instead of generating unless `force`. The Assets screen gets audio playback in the tile
  and details, and origin/tag chips." · "**Not in this plan**: a `propose_sfx` cue plan with audition (G4) — ask-first
  stays, per Hasan's standing rule on explainers."
- **§1.6 facts (re-checked 2026-10-24):**
  - The prompt: `src/main/services/studio/studio-agent-prompt-tools.ts` (87 lines) — `:21` `list_assets` ("what already
    exists before you generate anything"), `:31-32` `generate_sfx` / `generate_music` lines (no reuse rule), `:69`
    "5. B-roll: `list_assets(scope: "library")` for something that fits, else `generate_video`", `:70` "6. Sound:
    `generate_sfx` for a transition or an emphasis …" (no search-first), `:75` the EDITING PRESET mapping (`broll:
    library` means list first; an `sfx` step means `generate_sfx` + `insert_asset`). The whole prompt is built by
    `studio-agent-prompt*.ts`; B2 / B6 pinned parts of it in unit tests — extend, do not fork.
  - Tools: `generate_sfx` / `generate_music` (`agent-tools/audio-tools.ts:81-136`; after E2 also `category`, `tags`);
    `generateAndImport` (:55-78) checks `hasAudioProvider()` FIRST (:60) → the reuse lookup must come before it;
    `list_assets` (`agent-tools/project-tools.ts`, `kind` ∈ video / audio / image, `query` substring over path +
    description) → `library-listing.ts` (`formatLibraryListing`, cap 150; E2's row); `insert_asset`
    (`agent-tools/insert-tools.ts`) takes `library:<path>` (`resolveAssetRef` → `importLibraryFile` → E2's `usedIn`).
  - Assets screen (`src/features/asset-library/`): `AssetTile.tsx` (156 lines) — `:37` audio = `<AudioIcon />` only;
    `:71-72` a tile's preview is `${moduleServerUrl}/asset?path=${encodeURIComponent(previewPath)}` (the module
    server `src/main/services/module-server.ts:212-231` serves ANY absolute path whose extension is in
    `asset-route-extensions.ts` — `.mp3 .wav .m4a .ogg .flac .aac .opus` are in — through Express `res.sendFile`,
    which honours Range requests, so an `<audio src=…>` can seek; `previewFailed` falls back to the icon). `AssetDetailsPanel.tsx` (134 lines) — `:69-82` previews
    `<img>` / the GLB viewer; `:88` an "Origin" row from `meta.origin` (the index entry); no audio, no tags, no sound
    fields. `AssetLibraryScreen.tsx:315-316` passes `selectedPreviewUrl` / `selectedGlbUrl`. `services/asset-search.ts`
    — `CategoryFilter = 'all' | video | audio | image | other`, `filterAssets(entries, query, category, descriptionOf)`
    over name + description only; no origin / tag filter (pure, unit-tested). The renderer reads the index through IPC
    (`LIBRARY_INDEX_GET`, `src/shared/ipc/channels.ts:566`) — the E1/E2 fields are already in the `LibraryIndexEntry`
    type it receives. `AssetSearchBar.tsx` holds the category filter UI. UI rules: `UI_SPEC.md` (read before any
    component change); files ≤ 300 lines → a new `AudioPreview.tsx` / `AssetChips.tsx` rather than growing the tile.
  - `CAPABILITY_GAPS.md` §G4 (`docs/studio/CAPABILITY_GAPS.md:119-127`): "The SFX layer is a stub … no library, no
    placement, no proposal runner". E3 writes the "narrowed by E" note (library + reuse + placement through
    `insert_asset`; the cue plan / `sfx-plan` runner still open).
  - Timeline: clip kind `'sfx'` exists and is treated as `'audio'`; `insert_asset` makes `'audio'` clips with `gain`, no
    fades (`apply-insert-proposal.ts:46-59`) — not E3's to change.
- **The reference rule being ported (read-only):** the editor repo's `suggest-sfx` skill's library-first rule and
  USER-AUDIT gate (`D:\repos\claude-youtube-editor\.claude\skills\suggest-sfx\SKILL.md` §41-45, §65-66 per the plan §1.6)
  — read it for the wording of "search first, generate only when nothing fits"; the Studio rule is ask-first (a card),
  never a cue plan.
- **Live-assistant driving (B6 / B7 kits, reuse):** `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\B6\` (`run.mjs` —
  `findCur` reads the Assistant's live props from `root.current` downward, busy = the visible Stop button; `probe.mjs
  providers` → `{"active":"claude-subscription"}`; `cdp.mjs`, `launch.sh`, `restore.ps1`) and B6's HANDOFF.md steps 2–9
  (the recipe, the `[next: …]` marker, `aiUsageGetLog({ limit })` rows with `featureSource`). DRIVING "Learned" B6 line.
  The E3 profile has no `settings.db` → `claude-subscription` is the default provider; probe it first with
  `window.api.llmGenerate({ prompt: 'Say OK', providerId: 'claude-subscription' })` as B6 did. Keep the model turns to
  what the exit needs (E-d9): the whoosh case ×2, the negative, nothing else.
- **E2's stand-in (E-d6):** dev-only, env-named — read E2's HANDOFF for the env var and the provider id; register it
  only for the control / negative cases and say in the record which launches had it.
- **Session 6 notes (orchestrator, 2026-10-28):** (1) E2 is DONE after a fix round — `generate_sfx` / `generate_music`
  (`agent-tools/audio-tools.ts`) now carry `category` / `tags`, the answer prints LUFS + peak (a gated sound reads "Peak-normalized
  to −1.9 dBTP — too short or too quiet for a loudness (LUFS) reading."), a failed normalize keeps the bytes with a ONE-line
  `audio.normalizeError`; the −1.5 dBTP ceiling holds on the encoded file (E-d11, `audio-normalize.ts`). The reuse lookup goes
  BEFORE `generateAndImport`'s provider check and must not call the normalizer or the engine at all. (2) E4's relPath scheme is
  `sfx/<catalog file name>` and `music/<catalog file name>` (e.g. `sfx/whoosh-soft.mp3`); catalog clips carry `audio.license`
  (new optional field), `peakKind: 'sample'`, `audio.source` = the catalog string verbatim, `usedIn` = the catalog's `used_in`
  (editor-repo video ids) merged with Studio project ids; the 4 synth chords' description ends "(no licence recorded in the
  catalog)" — read E4's HANDOFF "Done" for the final word. (3) The app CREATES a fresh `settings.db` inside an isolated
  profile on its first launch (seen on `E2-verify`) — expected; it holds no keys; still never read / copy / open it. A profile
  without a pre-existing store defaults the Assistant to the keyless `claude-subscription`. (4) The pool-import seam is now
  `src/main/services/studio/pool-import.ts` `importMediaFilesMarkingLibrary`. (5) Memory headroom has swung 0.5–33 GB this
  session — measure before every launch / full run; `--maxWorkers=2` under 10 GB.
- **Session-5 overrides:** no paid-key call; model calls only through the keyless `claude-subscription`, only for the
  exit's turns; isolated profile only — **never Hasan's library or projects**; the resource guard (C: ≥ 3 GB and C: +
  headroom ≥ 6 GB before a launch / copy; watchdog at 1.5 GB — kit `.vidtsx-temp/end-to-end/E1/watchdog.ps1`;
  `--maxWorkers=2` while headroom < 10 GB); E-d4 before any launch; CDP port **9263**; profile
  `…\profiles\E3\profile`; per-part scratch `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\`; big outputs
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\`. Kits: E1's (`launch.sh`, `restore.ps1`, `watchdog.ps1`, `cdp.mjs`,
  `vitest.e1.config.ts`, the REAL-handler drivers), E2's and E4's (`.vidtsx-temp/end-to-end/E2/`, `E4/`).

## Done (file:line, commit hashes)

### Design note (builder #1, 2026-10-28 — binds the rest of E3)

Read first (HEAD `ceb250c`): `studio-agent-prompt-tools.ts` (87 lines: `:21` list_assets, `:31-32` generate_sfx /
generate_music, `:70` step 6, `:75` preset mapping — §1.6 still right), `agent-tools/audio-tools.ts` (177 lines;
`generateAndImport` `:78-108`, provider check `:84`), `project-tools.ts` (77), `library-listing.ts` (78; E2 row
`formatLibraryRow` `:22-34` + `formatMetaSuffix` `:43-57`; the query filter `:69-70` is ONE substring over relPath +
description), the E4 catalogs (45 sfx: whoosh-soft / whoosh-wind / whoosh-reverse / whoosh-data-burst carry the tag
`whoosh`; descriptions = the catalog `prompt`, full of "no music, no metallic ring" negations), E2's filing name
`generated/<kind>-<slug>.mp3` (`generate-audio-asset.ts:131`).

**(a) The matcher** — `src/main/services/library/sound-match.ts`, pure (entries in, ranked matches out; no I/O):
- Candidates: audio entries only (`entry.kind ?? mediaKindOf(relPath)` = `audio`). Sound class: `music` when a folder
  segment is `music`, the file name starts `music-`, or the tags hold `music` / `bed`; `sfx` when a folder is `sfx` or the
  name starts `sfx-`; otherwise by probe length (> 30 s = music, else sfx; unknown length = both). `generate_sfx` sees
  sfx, `generate_music` sees music.
- Tokens: lower-case words of ≥ 3 letters (a hyphenated word also yields its joined form: `lo-fi` → `lofi`), minus stop
  words (articles, prepositions, "sound/sfx/effect/audio/clip/video/add/make"), minus every word after a negation
  (`no`, `not`, `without`, `never`) up to the next punctuation — so "no music, no metallic ring" in a catalog prompt
  never matches "music". Two words match when equal or when one is a prefix of the other (≥ 3 letters, ≤ 3 letters
  longer: `air`/`airy`, `whoosh`/`whooshes`, `tick`/`ticking`).
- Score: each distinct prompt token `t` weighs `idf(t) = ln((N + 1) / (df(t) + 0.5))` over the candidate set (a word no
  candidate has weighs most; "soft", on most catalog clips, weighs little), times its best field hit on the entry: tag
  1.0, file-name word 1.0, category 0.9, description 0.6. `coverage = Σ hit·idf / Σ idf`.
- Head word: the last token of the prompt's first clause (cut at `, ; . : ( —` or before `for with at like into on in of
  to from that which`): "a soft cuckoo clock chime" → `chime`; "a fast airy whoosh with a short tail" → `whoosh`.
- A match: `coverage ≥ 0.5`, OR the head word hits AND `coverage ≥ 0.3`. Ranked by coverage, then strong hits (tag /
  name / category), then `usedIn` count (proven clips first), then relPath. Top 3. `generate_music` also drops a bed
  shorter than the requested `durationSeconds` (insert_asset can trim a longer bed, not stretch a shorter one).
- Answer (`formatSoundMatches`): "The library already has N sound(s) matching "<prompt>" — nothing was generated (no
  cost):" + the E2 `formatLibraryRow` rows (ref, duration, origin, description, category, tags, LUFS, used in — reused,
  not re-written) + "Place one with insert_asset(assetId: "library:<path>", lane: "audio", at: …). Only if none of
  them fits, call generate_sfx again with force: true." Exported for the tool and the tests.
- Where: a thin `agent-tools/sound-reuse.ts` (loads the index via `loadIndex(getLibraryRoot())`, runs the matcher,
  formats; a read failure returns `null` = fall through to generation, never blocks it). `generate_sfx` gains
  `force?: boolean`; its handler calls the reuse lookup FIRST (before `generateAndImport` and so before
  `hasAudioProvider()` — reuse works on a profile with no key; the normalizer / engine are never touched).
- `generate_music`: the SAME rule (a library bed is as reusable as a whoosh — the catalog ships six), with `force`,
  except a `compositionPlan` call (a precise score, nothing to match — it generates) and the length drop above.
- `list_assets` query (`library-listing.ts:69-70`): broadened, backward compatible — every whitespace-separated word of
  the query must appear in relPath + description + tags + category (a one-word query behaves exactly as before plus tags /
  category; "soft whoosh" now finds `sfx/whoosh-soft.mp3`, which the old phrase-substring missed).

**(b) The prompt rule** — `studio-agent-prompt-tools.ts`: the `list_assets` line (`:21`) adds "for any SOUND search
kind "audio" first"; the `generate_sfx` line (`:31`) says it returns library matches instead of generating unless
`force: true`, and `generate_music` (`:32`) "same library check"; step 6 (`:70`) becomes "search the library first
(`list_assets(scope: "library", kind: "audio", query: …)`) and place a sound that fits; generate only when nothing fits
…; library sounds need no provider"; the preset mapping (`:75`) says an `sfx` / `music` step searches the library first
the same way. Pinned in `studio-agent-prompt.test.ts` (a new `describe` in the existing file — extend, not fork).

**(c) Assets screen (the UI step; read `UI_SPEC.md` + the components first, line numbers re-checked then):** one
`AudioPreview.tsx` (`<audio controls preload="none">` in the details panel for audio entries) and a play / pause
icon button on audio tiles driven by ONE screen-owned audio element (so one sound plays at a time by construction; the
details `<audio>` pauses it on `play`). URL = the tile-preview URL (`${moduleServerUrl}/asset?path=…`); no server URL →
the control is disabled with a title; `onError` → "Can't play this file" and the icon stays. `AssetChips.tsx` in the
details panel: the origin chip + tag chips; a click sets a chip filter `{ origin } | { tag }` held by the screen and
shown as a removable pill by the search bar; `asset-search.ts` gains a pure `matchesChip(meta, chip)` and the text
search also matches tags (unit tests). Sound fields (only when present): Category, Loudness (LUFS / "not normalized"),
Peak (dBTP for `peakKind 'true'`, dBFS sample otherwise), Source, Model, Licence, Used in.

**(d) G4 note** (`CAPABILITY_GAPS.md` §G4): "Narrowed by E (2026-10-28): a library (index v2 — category / tags / LUFS /
peak / usedIn, E1–E2), the 45 + 6 catalog clips importable (E4), generation normalized and filed (E2), reuse before
generate (E3: `generate_sfx` / `generate_music` answer the top-3 library matches unless `force`; the prompt rule) and
placement as an ask-first `insert_asset` card. Still open: the cue plan / `sfx-plan` runner with audition
(`propose_sfx`) — not in this plan (ask-first stays)."

**(e) Tests, red first:** `library/sound-match.test.ts` (tokens + negation + hyphen; the order on realistic prompts
over a catalog-shaped fixture — "a soft airy whoosh for a transition", "soft whoosh", "a fast airy whoosh with a short
tail", "a soft UI click", "warm lo-fi bed"; no match for "a cuckoo clock chime" and a long variant; class filters; the
music length drop; the answer text); `audio-tools.test.ts` extended (matches → no provider check, no engine; `force`
generates; no match → generates as before; index read failure → generates; music: plan skips the lookup, short bed
dropped); `library-listing.test.ts` extended (multi-word + tag / category query); `studio-agent-prompt.test.ts`
extended (the sound rule + the mapping). UI step: `asset-search.test.ts` extended (chip + tag search).

**(f) Live plan (later steps):** guard → copy `source\profile` → `E3\profile` with `robocopy /E /XF settings.db*`
(verify none) → E4's importer `--library <E3 profile>\assets` (dry run first, app stopped; the root confirmed from the
running app first) → rebuild `wt/out` → launch on CDP 9263 WITHOUT `VIDTSX_AUDIO_STANDIN_FILE` → Studio root
`…\E3\root` in the first call → a fresh project + one short clip on V1 → tool-level checks through the REAL handlers
(exit item 2) → whoosh case ×2 (2 turns + their review outcome only) → negative with no provider (1 turn) → relaunch WITH
the stand-in env for the negative's generation (1 turn) and `force` through the real handler (no model) → Assets screen
CDP (play `whoosh-soft`, chips, still). Turn budget: 4 model turns + the `llmGenerate('Say OK')` probe.

### Built (builder #1, 2026-10-28) — (a) the matcher + tool wiring, (b) the prompt rule; commit: see LOG / `git log`

- `src/main/services/library/sound-match.ts` (224 lines, NEW, pure): `soundTokens` `:100`, `headWord` `:120`,
  `soundClassOf` `:167`, `matchLibrarySounds` `:187` (thresholds `:36-37`; `SAME_SOUND` `:44` — swoosh / woosh =
  whoosh, added after the real-catalog run showed "a gentle swoosh between scenes" unmatched; "swish" stays apart, the
  catalog tags `ui-send` with it). As the design note, plus: 2-letter tokens kept (`ui`, `ai`) with the 2-letter stop
  words; "between / after / before / during / across / through" cut the head clause; "cut / first / next / last" are
  stop words (placement words, not the sound).
- `src/main/services/studio/agent-tools/sound-reuse.ts` (45 lines, NEW): `formatSoundMatches` (rows = E2's
  `formatLibraryRow`, so ref · duration · origin · description · category · tags · LUFS · used in) and
  `libraryReuseAnswer` (index read failure → `null` → generation proceeds).
- `agent-tools/audio-tools.ts`: `REUSE_NOTE` `:63` in both descriptions; `force` `:127` / `:164`; `generate_sfx` reuse
  call `:133` (before `generateAndImport` → before `hasAudioProvider()`); `generate_music` `:173` (prompt form only; a
  `compositionPlan` never looks; `minDurationSec = durationSeconds`).
- `agent-tools/library-listing.ts` `matchesQuery` `:66` (used `:85`): every query word in relPath + description + tags +
  category. `project-tools.ts` — the `query` describe says so.
- `studio-agent-prompt-tools.ts`: `:21` (list_assets — "For any SOUND … search it first"), `:31` (`force?` + "It checks
  the library FIRST …"), `:32` (music: same check, the length rule), `:70` (step 6 — search before generating any
  sound; library sounds need no provider), `:75` (the `sfx` / `music` preset mapping lists the library first).
- Tests: `library/sound-match.test.ts` (NEW, 14 tests); `audio-tools.test.ts` `:105` new describe (5 tests, the REAL
  matcher over a mocked index); `library-listing.test.ts` +1; `studio-agent-prompt.test.ts` `:93` new describe (4).
  Red first for the matcher (module missing → "no tests", 1 failed file); the handler / listing / prompt tests were
  written right after their code (not run red — say so if a verifier asks).

### Built (builder #2, 2026-10-28) — (c) the Assets screen, (d) the G4 note; commit `8bde97c` (+ the docs commit)

All under `src/features/asset-library/` (imports only `@shared/*`, React and the feature's own files; no Node, no fs —
the index arrives over the existing `LIBRARY_INDEX_GET` IPC, URLs from the module server the screen already asked for).
- `services/asset-search.ts` (119 lines): `ChipFilter = { origin } | { tag }` `:16`, `SearchableMeta` `:19`,
  `matchesChip` `:35` (no chip = everything; a chip never matches an unindexed file; tags case-insensitive),
  `sameChip` `:43`, `chipLabel` `:50` ("Origin: generated" / "Tag: whoosh"), `chipsOf` `:55` (origin first, tags
  deduped, blanks dropped); `filterAssets` `:90` now takes `metaOf` (the index entry) + an optional `chip`, and the text
  search matches name + description + **tags + sound category**, every whitespace word required (one word = the old
  substring, so strictly broader — the same rule as `list_assets`).
- `services/sound-fields.ts` (61, NEW): `formatDuration` `:17` ("1.2 s" / "1:05"), `soundFieldsOf` `:35` → rows in order
  Duration (`probe.duration`) · Category · Loudness ("−20.0 LUFS"; "not normalized" when `normalizeError`; else "no
  LUFS reading") · Peak ("−1.9 dBTP · true peak" / "−3.3 dBFS · sample peak" / plain dBFS when the kind is unknown) ·
  Source · Model · Licence · Used in (`usedIn` joined); a row only when present. U+2212 minus, as E2's answers print it.
- `services/asset-urls.ts` (31, NEW): `moduleAssetUrl` `:10` (no server → `null`), `selectedAssetUrls` `:23` (image /
  glb / audio) — replaced the screen's two inline URL blocks.
- `services/exclusive-playback.ts` (30, NEW): `createExclusivePlayback` `:19` — `claim` pauses the previous player,
  `release` forgets the current one. `hooks/useAudioPlayback.ts` (85, NEW) `:27`: the ONE screen-owned `<audio
  data-asset-audio="tile" hidden preload="none">` (rendered by the screen with `sharedProps`, `AssetLibraryScreen.tsx:246`)
  plays every tile; `toggle(path, url)` swaps `src` / pauses; `onPlay` re-claims the slot (`:72` — a `src` swap can fire
  `pause` → release first); an `AbortError` from a fast re-click is not a failure; `error` / a rejected `play()` →
  `failedPath`. The details player calls `claim` on play → the tile player pauses: one sound at a time.
- Components (NEW): `TilePlayButton.tsx` (61) — a `role="button"` span inside the tile's `<button>` (like the copy
  control; stops propagation, so no select), bottom-left round 28 px, play / pause SVG, accent when playing,
  `data-tile-play="idle|playing|failed"`; no server → dim + "Can't play — the preview server isn't running"; failed →
  red + "Can't play this file". `AudioPreview.tsx` (50) — `<audio controls preload="none" data-asset-audio="details">`
  (`colorScheme: dark`), `onError` → "Can't play this file."; no URL → "Playback needs the preview server, which isn't
  running." (`data-audio-preview="unavailable|failed"`). `AssetChips.tsx` (44) — `chipsOf(meta)` as 10 px pills
  (origin outlined in accent-light, tags on surface, the active one accent), `data-chip="origin:x|tag:y"`, click sets /
  clears the screen's chip.
- Wiring: `AssetTile.tsx:125` (`audio?: TileAudio`), `AssetGrid.tsx:52` `audioFor` (`:93`), `AssetDetailsPanel.tsx:98`
  AudioPreview, `:99` AssetChips, `:105` the sound rows (label column 48 → 56 px, `:149`; the Origin row kept),
  `AssetSearchBar.tsx:56` the removable chip pill (`data-chip-filter`; placeholder "Search name, description or tag…"),
  `AssetLibraryScreen.tsx:84` playback, chip state + `searching` includes the chip, `:215` `selectedAssetUrls`, `:291`
  `onClearChip`, `:324` `onAudioPlay={playback.claim}`.
- Tests (red first, recorded below): `asset-search.test.ts` (195; the old 4 fixtures moved to `metaOf` + 12 new),
  `sound-fields.test.ts` (6), `asset-urls.test.ts` (5), `exclusive-playback.test.ts` (3). No component test: the vitest
  config is `environment: 'node'`, `include: src/**/*.test.ts` — the logic sits in the services / hook (house rule).
- (d) `docs/studio/CAPABILITY_GAPS.md:129` — the G4 "Narrowed by E (2026-10-28)" note, as design note (d) + the screen.
- Live plan started: `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\E3\profile` copied (below). Nothing launched,
  no importer run, no model turn.

## Verified (exact commands + outputs)

- 2026-10-28, builder #2, worktree root, HEAD `c3f9276` + the new test files only — **red**: `node
  D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/features/asset-library/services/` → `asset-search.test.ts`
  14 failed (`matchesChip is not a function`, `description.toLowerCase is not a function`, the chip assertions
  `expected [ 'whoosh-soft.mp3', …(4) ] to deeply equal [ 'whoosh-soft.mp3', 'airy-01.mp3' ]`), and `asset-urls.test.ts` /
  `exclusive-playback.test.ts` / `sound-fields.test.ts` `Error: Cannot find module './…'`.
- After the services: same command → `Test Files 5 passed (5)` · `Tests 38 passed (38)`; after the components:
  `vitest run src/features/asset-library/` → `5 passed (5)` · `38 passed (38)`.
- `tsc -p tsconfig.web.check.json --noEmit` → **26** `error TS` (none under `asset-library`); `-p
  tsconfig.node.check.json` → **10**. Commit `8bde97c`.
- `wt/out` rebuilt (resource guard first: C: 50.7 GB, D: 43.8 GB, headroom 28.7 GB; no app on the worktree / 9263):
  `unset ELECTRON_RUN_AS_NODE; export NODE_OPTIONS=--max-old-space-size=8192; node
  D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build > …\E3\build-b2.log` → rc 0, renderer
  "✓ built in 2m 28s"; `out/renderer/assets/index-Cxk4oc3v.js` contains `data-tile-play`.
- Profile copy (guard: C: 50.7 GB, headroom 29 GB): `robocopy …\profiles\source\profile …\profiles\E3\profile /E /XF
  settings.db*` → rc 1 (copied), Files 2328 total / 2325 copied / 3 skipped (the `settings.db*` files); afterwards
  `settings.db*` under the E3 profile: **0**; 371.8 MB; `<profile>\assets` exists (from the source copy).

- 2026-10-28, worktree root, HEAD `ceb250c` + the working tree above:
  `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/main/services/studio/studio-agent-prompt.test.ts
  src/main/services/studio/agent-tools/ src/main/services/library/ src/main/services/content-safety/llm-hook-absence.test.ts`
  → `Test Files 39 passed (39)` · `Tests 314 passed (314)` (includes `library/pre-e1-control.test.ts` — E-d5 green).
- `tsc -p tsconfig.web.check.json --noEmit` → **26** `error TS`; `-p tsconfig.node.check.json` → **10**; no error line
  names `sound-match`, `sound-reuse`, `audio-tools`, `library-listing`, `project-tools` or the prompt files.
- The order over the REAL catalogs (45 sfx + 6 music read-only from `D:\repos\claude-youtube-editor\media\library`,
  mapped as E4 does — relPath `sfx|music/<id>.mp3`, description = prompt/desc, tags, category, `used_in`, `duration_s`;
  a temporary test file, deleted, not committed) → `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\catalog-order.txt`
  (run BEFORE the `SAME_SOUND` line; only the swoosh row changes after it):
  "a soft airy whoosh for a transition" → whoosh-soft 1.00 | whoosh-wind 0.75 | whoosh-reverse 0.60 ·
  "soft whoosh" / "Add a soft whoosh at the first cut." / "a soft whoosh for a cut" → whoosh-soft 1.00 | whoosh-reverse
  0.92 | whoosh-wind 0.92 · "a fast airy whoosh with a short tail" → whoosh-data-burst 0.74 | whoosh-soft 0.54 | dash-zip
  0.51 · "whoosh transition" → whoosh-soft | whoosh-wind · "a cuckoo clock chime" and the long cuckoo variant → no match
  · "a soft UI click" → ui-click-soft 1.00 | ui-toggle-on 0.96 | pop-reveal 0.53 · "camera shutter" → camera-shutter |
  trap-snap · "a door knock" → knock-solid | chess-piece-capture · "a dog bark" → no match · music "warm lo-fi bed" →
  lofi-warm · "calm ambient bed under speech" → ambient-pad 0.64 · "upbeat corporate rock with drums" → no match · "warm
  lo-fi bed" ≥ 120 s → no match.
- The gates (builder #4, 2026-10-28 20:17–20:24, no app running — 0 `electron.exe`; HEAD `5d602fb`, tree clean, `src/` as of
  `8bde97c` = the `wt/out` build): guard C: 50.0 GB, D: 43.8 GB, headroom 27.7 GB → default workers. From the worktree root
  `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run > C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\vitest-full-1.log
  2>&1` → `Test Files 4 failed | 492 passed | 5 skipped (501)` · `Tests 10 failed | 4214 passed | 35 skipped (4259)` · 86.05 s;
  the 4th file `flow-render.test.ts:255` ("expected 0 to be greater than 0" in its 1 s `vi.waitFor` — DRIVING's known LOAD
  timeout) → alone `vitest run src/main/services/flows/flow-render.test.ts` → `1 passed (1)` · `5 passed (5)`
  (`vitest-flow-render-alone.log`); re-check (C: 50 GB, headroom 27.9 GB, 0 electron) → full run 2 (`vitest-full-2.log`, the
  COUNTED run) → `Test Files 3 failed | 493 passed | 5 skipped (501)` · `Tests 9 failed | 4215 passed | 35 skipped (4259)` ·
  75.31 s, 0 "timed out"; the 3 files / 9 tests = `builder-libraries` 1 (`@remotion/paths (builder-libraries.ts) is not
  installed`), `shot-bundle` 5 (`Could not resolve` roughjs / @remotion/shapes / @react-three/fiber / chroma-js /
  @remotion/google-fonts/SpaceGrotesk), `shot-bundle-in-place` 3 (`Could not resolve "chroma-js"`) — resolution only.
- Rule (b): `git diff --name-only 5d77600..HEAD > …\E3\diff-list.txt` at HEAD `5d602fb` → 99 files (84 under `src/`); `node
  C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\import-graph.cjs <wt> …\E3\diff-list.txt > …\E3\import-graph.txt` → rc 0:
  `builder-libraries.test.ts: 2 local modules … NONE`, `shot-bundle.test.ts: 15 … NONE`, `shot-bundle-in-place.test.ts: 23
  … (vi.mock'd, not loaded: shot-generator.ts, shot-import-land.ts, media-import.ts) … NONE`, `scripts/builder-unpack.mjs: 1
  … NONE` (method: esbuild metafile per suite, packages external, `?raw` as leaves, `vi.mock`'d modules not followed).
- Types: `tsc -p tsconfig.web.check.json --noEmit` → **26** `error TS` (`…\E3\tsc-web.log`); `-p tsconfig.node.check.json` →
  **10** (`tsc-node.log`); 0 error lines name an E3 file (asset-library, sound-match, sound-reuse, audio-tools,
  library-listing, project-tools, studio-agent-prompt). No gate failure → no `src/` change, no rebuild.
- Records commit `bc2cc9b`: Status.md E3 entry **:10-233** (above E4's, now :235); TESTING **§18.17 :524-537**; titles —
  E4 "…; the E4 verifier round 3 is next)" → "…; the E4 verifier round 3 PASSED on the records (2026-10-28))" (Status :235),
  E2 "…; the E2 verifier round 2 is next)" → "…; the E2 verifier round 2 PASSED (2026-10-28))" (Status :437). Re-checked
  AFTER `bc2cc9b`: `git diff --name-only 5d77600..HEAD` still 99 files (the four docs files it touches were already in the
  list); `git diff --stat 5d602fb..HEAD -- src/ scripts/` empty; `git log -1 --format=%h -- src/` → `8bde97c`.

### The live step (builder #3, 2026-10-28, ~20:00–20:15 local) — ALL exit measurements PASS; no code change

Kit (NEW, scratch, not committed): `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\` — `launch.sh` (E1's, profile E3,
CDP 9263, `RUN=n` → `…\vidtsx-e2e\E3\app-n.log`, NO stand-in env), `watchdog.ps1` (E1's, E3 profile mark), `restore.ps1` /
`cdp.mjs` (B6's, port 9263), `e3.mjs` (`root` · `probe` · `assets` · `assets2` · `case <name> "<ask>"`; B6's `findCur`
agent reader), `vitest.e3.config.ts` (E2's) + `tools-noprovider.e3.test.ts` / `tools-standin.e3.test.ts` (E2's mocks:
electron userData = E3 profile, settings-db → only the Studio root, `getRemotionBinariesDir: () => null`, ai-usage
sink). All numbers: **`C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\live.json`** (+ `live-assets*.json`, `turns.jsonl`,
`tools-*.json`, `assets-details.png`, `assets-full.png`, `import*.json|log`).
- **Guard** before each launch / the import: C: 50.3 GB, D: 43.8 GB, headroom 28.3–28.8 GB; no electron.exe; no
  `%TEMP%\vidtsx-studio\export`. Watchdog ran for each launch (log `…\E3\watchdog.log`).
- **Step 1** — launch 1 (no stand-in): first call `studioRootSet(E3\root)` → `studioRootGet` = `D:\…\E3\root`;
  `libraryRootGet` = `C:\…\profiles\E3\profile\assets` (`isOverride false`); active provider `claude-subscription`. App
  stopped (4 processes, 0 left). Importer from the worktree root: `node scripts/import-sfx-library.mjs --library
  <profile>\assets --from D:\repos\claude-youtube-editor --dry-run --report …\E3\import-dry.json` → rc 0, `items 51, copy
  51, problems 0`; same without `--dry-run` (`--report …\E3\import.json`) → rc 0, `items 51, copy 51, problems 0, failed 0,
  4.699 s, probe−catalog −42…0 ms`; `sfx\` 45 files, `music\` 6; noLicence = the 4 piano chords (as E4).
- **Step 3a (tool level, no provider, app stopped)** — `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  --config D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/E3/vitest.e3.config.ts tools-noprovider` → 1 passed; engine
  `providers [] active null`, no stand-in env. `generate_sfx({ prompt: 'a soft airy whoosh for a transition' })` → 19 ms,
  not an error, "The library already has 3 sounds matching … — nothing was generated (no cost, no provider needed):"
  `sfx/whoosh-soft.mp3` (0.68 s · motion · tags whoosh, transition, cutaway, air, swipe, motion · −20.0 LUFS · used in
  16 editor ids) | `sfx/whoosh-wind.mp3` (1.20 s) | `sfx/whoosh-reverse.mp3` (0.88 s) → the matches come BEFORE the
  provider check. `list_assets(library, audio, 'whoosh')` → rows incl. the 4 whoosh-tagged clips + dash-zip + flame-snuff;
  `list_assets(…, 'cuckoo clock')` → "No matching assets in the library." (not an error); `generate_sfx('a cuckoo clock
  chime')` → isError "No audio provider is configured. Ask the user to add an ElevenLabs key in AI → Providers." (no
  crash); `generate_music('warm lo-fi bed', 30)` → `music/lofi-warm.mp3`. Index byte-identical before / after, no
  `generated/` file. (Run BEFORE the live turns on purpose — see step 3b.)
- **Step 2 — Assets screen** (launch 2, no stand-in; first call `studioRootSet`; the `sfx` folder opened by a
  double-click on its folder tile): `[data-tile-play]` of `whoosh-soft.mp3` (real mouse click) → after 0.4 s the shared
  `audio[data-asset-audio="tile"]` `paused false, currentTime 0.21, readyState 4, duration 0.680`, `src` =
  `http://127.0.0.1:3200/asset?path=C%3A%5C…%5Csfx%5Cwhoosh-soft.mp3` (decoded = the tile's path); after 1.6 s it had played
  to its end (0.68). On the longest sfx (`piano-a-min.mp3`, 2.6 s): `paused false`, `currentTime 0.415 → 1.433` over 1.0 s,
  button `data-tile-play="playing"`. Details panel (`assets-details.png`): `<audio controls>` present; chips `origin:imported`
  + 6 tags; rows "Duration 0.7 s · Category motion · Loudness −20.0 LUFS · Peak −1.6 dBFS · sample peak · Source
  elevenlabs:sound-generation · Model eleven_text_to_sound_v2 · Licence ElevenLabs generated … · Used in short-1-chess …
  video-2". Details `play()` → `paused false, 0.459 → 1.474` over 1 s; then a tile play on whoosh-soft → the details player
  `paused true` (1.593) and the tile plays whoosh-soft (one sound at a time). Chip `tag:whoosh` → tiles **45 → 4**
  (whoosh-data-burst / -wind / -soft / -reverse), pill "Tag: whoosh ×"; cleared → 45; chip `origin:imported` → 45 → 45, pill
  "Origin: imported ×" (every sfx is imported — nothing to narrow here; unit-tested).
- **Step 4 — the whoosh case LIVE** (launch 2, NO stand-in env, keyless `claude-subscription`; probe
  `llmGenerate({ prompt: 'Say OK', providerId: 'claude-subscription' })` → success, "OK", 9.5 s, claude-sonnet-5-5).
  THREE FRESH projects (e3-w1, e3-w2, e3-cuckoo), each with `clip-a.mp4` + `clip-b.mp4` (3 s each, made with ffmpeg-full
  into `…\E3\media`; added via `studioMediaImport` + the app's `studioProjectLoad`/`Save` (the editor not open yet — the
  renderer normally adds them, `useStudioProject.ts:170-176`), then the Media pool's "Add to timeline" ×2 → V1 0–3 | 3–6 s,
  the first cut at 3.0 s). One typed turn each (real input):
  - **e3-w1** "Add a soft whoosh at the first cut." → `list_assets(library, audio, "whoosh")` → `insert_asset(assetId
    "library:sfx/whoosh-soft.mp3", lane audio, at 2.8)` → card `prop_mvsfivc6_ihb0uj` kind `insert-plan` status `proposed`
    (2.8 s, 0.680 s); `generated/` none before / after; `whoosh-soft` usedIn 16 → 17 (+`e3-w1`); usage 1 row
    claude-subscription / claude-sonnet-5-5 / featureSource `auto-cut` / 910 in · 681 out; 23.4 s. **PASS.**
  - **e3-w2** same ask → `list_assets(…, "soft whoosh")` → `insert_asset("library:sfx/whoosh-soft.mp3", audio, 2.8)` →
    `prop_mvsfket2_qnj0tr` insert-plan proposed; no generation; usedIn 17 → 18 (+`e3-w2`); 1 usage row; 24.4 s. **PASS.**
  - **e3-cuckoo** "Add a cuckoo clock chime at the first cut." → `list_assets("cuckoo")` "No matching assets" →
    `list_assets("chime")` → `generate_sfx(prompt "A wooden cuckoo clock chime: …", 2 s, category …)` → isError "No audio
    provider is configured …"; no card, no generation; reply "I couldn't add a cuckoo chime. The library has no cuckoo
    sound, and generating one needs an ElevenLabs key …" + offers `chime-reward` as a stand-in, asks first. **PASS.**
  3 model turns + the probe; 0 retries. App stopped (5 processes, 0 left).
- **Step 3b (stand-in control, app stopped, a SEPARATE vitest invocation — run AFTER the live negative so the generated
  cuckoo could not answer it)**: `… vitest.mjs run --config …\E3\vitest.e3.config.ts tools-standin` → 1 passed;
  `VIDTSX_AUDIO_STANDIN_FILE = …\E3\standin-e3.mp3` (own: sine 880 Hz 1.6 s, −25.8 LUFS in → a gain-UP case); engine
  active `standin`. `generate_sfx({ prompt: 'a cuckoo clock chime', category: 'ui', tags: ['cuckoo','clock','chime'] })`
  → ONE new file `generated/sfx-a-cuckoo-clock-chime.mp3`: duration 1.6, tags cuckoo/clock/chime, category ui,
  `loudnessLufs −20.26`, `peakDbfs −16.67` (true), source standin, usedIn `["e3-tools"]`; independent ffmpeg-full ebur128
  **I −20.2 LUFS, TP −16.7**. The SAME ask again (`{ prompt: 'a cuckoo clock chime' }`) → "The library already has 1
  sound matching … — nothing was generated", `library:generated/sfx-a-cuckoo-clock-chime.mp3 … used in: e3-tools`, 0 new
  files (a generated sound is found before it is regenerated). `generate_sfx({ prompt: 'soft whoosh', force: true })` → 1
  new file `generated/sfx-soft-whoosh.mp3` (generated although 3 library whooshes match).

## Next step (ONE concrete instruction)

**Orchestrator:** E3 → VERIFY — spawn the E3 verifier round 1 (CDP 9273, its own `profiles\E3-verify` copy WITHOUT
`settings.db*`; range `ceb250c..HEAD`; the records to check: Status.md E3 entry :10-233, TESTING §18.17 :524-537). Builder
#4 (gates + records) is done: gates green (Verified above), records committed; no code change, no live run.

## Open problems

- None blocking.
- `AssetLibraryScreen.tsx` is **464** lines (it was 456 before E3 — already over the ~300 rule); E3 added +8 net (the
  inline URL blocks moved to `asset-urls.ts`). A split (e.g. the rename / delete / dialogs block) is a later cleanup,
  not E3's.
- Untested by unit: the hook's DOM event order (`pause` on a `src` swap before `play`) — the live CDP check covers it
  (play tile A, then tile B: only B's path is `playingPath`; play the details player: the tile player pauses). Design choices a verifier may question (stated, not open): `generate_music` follows the same rule (the
  plan's T6 bullet names only `generate_sfx`; reason in the note (a)); `list_assets`' query broadened to all-words over
  path + description + tags + category (strictly broader than before for one word).
- `audio-tools.test.ts` is 302 lines (the ~300 rule) — split the E3 describe into its own file if it grows.
- From the live step (none blocking, none a code defect of E3): (1) `list_assets(query: 'whoosh')` also lists
  `flame-snuff` whose description says "no whoosh" — the listing query is a plain word match (the matcher's negation rule
  is not applied there); harmless (the model picked whoosh-soft both times), a later polish. (2) The Studio assistant's
  usage rows carry `featureSource: "auto-cut"` for an SFX turn — a label question for the usage log, not E3's. (3) The
  stand-in returns identical bytes every call, so the `force` whoosh got the SAME project asset id as the cuckoo (the pool
  dedups by hash) — a stand-in artifact (real generations differ). (4) Not observed live: details-play pausing a tile
  that is STILL playing (both tile sounds had ended first); the other direction (tile pauses the details player) was.
  (5) An empty project `e3-whoosh-1` sits in the E3 root from the first `case` attempt (the driver then seeded assets
  through load/save) — scratch, harmless.

## Do-not-redo

- The design note (a)–(f) and the matcher / tool / prompt build above — extend, do not redesign. The real-catalog
  order was recorded (`E3\catalog-order.txt`); the unit fixture pins the same shape.
- (c) the Assets screen (`8bde97c`) and (d) the G4 note — done and green; the `wt/out` rebuild at `8bde97c`; the E3
  profile copy (re-copy only if it is found damaged — verify `settings.db*` = 0 either way; the app creates a fresh
  store at its first launch, expected, never read it).
- The live step (builder #3): the import into the E3 library (51 clips — the library now ALSO holds two generated
  stand-in files under `generated/`), the Assets-screen CDP check, the tool-level checks (both drivers), the three live
  turns. Do NOT re-run the model turns (E-d9 budget spent: 3 turns + the probe).

## For Hasan (real-video list candidates)

- Listening to the Assets-screen playback and to a placed library whoosh in the real editor (the by-ear half of
  "plays"); the one live ElevenLabs generation (E2's item) through the reuse rule with `force`.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-28 · builder #1 · ~40 calls · design note (a)–(f); built (a) the matcher + `generate_sfx` / `generate_music`
  reuse with `force` + the broadened `list_assets` query, (b) the prompt rule, pinned; the real-catalog order recorded;
  39 test files green, tsc 26 / 10; committed. UI, G4 note, live and gates not started.
- 2026-10-28 · builder #2 · ~38 calls · (c) the Assets screen, red first (chip filter + tag search, sound fields, URLs,
  one-at-a-time playback; 5 files / 38 tests), the components + wiring, tsc 26 / 10, `8bde97c`; (d) the G4 note;
  `wt/out` rebuilt; the E3 profile copied. Nothing launched, no importer, no model turn.
- 2026-10-28 · builder #3 · ~42 calls · the live step: 2 launches (no stand-in), import 51, Assets screen CDP (play,
  one-at-a-time, chips 45 → 4, still), tool level (no provider + stand-in, two drivers), whoosh ×2 + cuckoo live — all
  PASS, no code change. Gates / records not started.
- 2026-10-28 · builder #4 · ~38 calls · the gates (2 full worktree vitest runs — run 2 counted, run 1's `flow-render`
  load timeout passed alone; rule (b) NONE over 99 files; tsc 26 / 10), Status.md E3 entry, TESTING §18.17, the E2 / E4
  title fixes (`bc2cc9b`); HANDOFF DONE. No `src/` change, no launch, no model turn.

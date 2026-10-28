# E3 — Reuse-before-generate (prompt rule, `generate_sfx` top-3 matches, `force`); Assets screen playback + origin/tag chips
status: HANDOFF

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

## Verified (exact commands + outputs)

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
- Not yet run: the full worktree vitest, a `wt/out` rebuild, anything live.

## Next step (ONE concrete instruction)

**Builder #2:** build (c), the Assets screen — read `UI_SPEC.md` (chips, icon buttons, the details-panel rows), then
`src/features/asset-library/` (`AssetTile.tsx`, `AssetDetailsPanel.tsx`, `AssetLibraryScreen.tsx` around `:315`,
`services/asset-search.ts` + its test, `AssetSearchBar.tsx`) and the module server `/asset` handler; then, red first in
`asset-search.test.ts`, a pure chip filter (`{ origin } | { tag }`) + tag-aware text search; then `AudioPreview.tsx`
(details `<audio controls preload="none">`) + a play / pause icon button on audio tiles driven by ONE screen-owned
audio element, `AssetChips.tsx` (origin + tag chips that set the chip filter, a removable pill by the search bar), and the
sound fields (Category, Loudness, Peak by `peakKind`, Source, Model, Licence, Used in) — per the design note (c); files
≤ 300 lines; `tsc` 26 / 10; commit. Then (d) the G4 note, then the live plan (f).

## Open problems

- None blocking. Design choices a verifier may question (stated, not open): `generate_music` follows the same rule (the
  plan's T6 bullet names only `generate_sfx`; reason in the note (a)); `list_assets`' query broadened to all-words over
  path + description + tags + category (strictly broader than before for one word).
- `audio-tools.test.ts` is 302 lines (the ~300 rule) — split the E3 describe into its own file if it grows.

## Do-not-redo

- The design note (a)–(f) and the matcher / tool / prompt build above — extend, do not redesign. The real-catalog
  order was recorded (`E3\catalog-order.txt`); the unit fixture pins the same shape.

## For Hasan (real-video list candidates)

- Listening to the Assets-screen playback and to a placed library whoosh in the real editor (the by-ear half of
  "plays"); the one live ElevenLabs generation (E2's item) through the reuse rule with `force`.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-28 · builder #1 · ~40 calls · design note (a)–(f); built (a) the matcher + `generate_sfx` / `generate_music`
  reuse with `force` + the broadened `list_assets` query, (b) the prompt rule, pinned; the real-catalog order recorded;
  39 test files green, tsc 26 / 10; committed. UI, G4 note, live and gates not started.

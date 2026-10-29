# E3 — Reuse-before-generate (prompt rule, `generate_sfx` top-3 matches, `force`); Assets screen playback + origin/tag chips
status: DONE (builder #20, 2026-10-29 12:27) — **fix round 4 is COMPLETE: the records committed `dbe935a` (Status.md E3 entry :10-1111 — title, the new "Verifier round 4 FAIL (F4 …) → fix round 4" bullet :425-602, the current-state parts, a fix-round-4 Gates bullet, Not measured (24)–(32); TESTING §18.17 :524-541 — the material line, a fix-round-4 item :534, the Gates item, the notes). No `src/` change (`src/` = `c5a6124`), no gate / build / launch / model call. The E3 verifier round 5 — E3's LAST — is next (Next step).** Before: HANDOFF (builder #19, 2026-10-29 12:12) — **E-d16d items 1–2 DONE, NO `src/` change (`src/` = `c5a6124`): the greedy experiment (kit; corpus 1,073 + broad 15,998, index unchanged) fixes the six quiet probes but LOSES right clips (vs `c5a6124`: corpus 5, broad 56 — 6 with none left, incl. "a sparkling screen"; vs `7967c6f`: 3 / 20 NEW), 0 confident firsts moved, corpus green → by E-d16d's rule greedy is NOT kept; `c5a6124` stays and the six F9 "a quiet `<-ing>`" probes are NOTES (Built / Verified "builder #19"). Item 3 (the records, incl. E-d16c + E-d16d) is next — builder #20, Next step.** Before: HANDOFF (builder #18, 2026-10-29 11:58) — **items 2–4 DONE (no `src/` change; `src/` = `c5a6124`): item 2 the fix4b re-run (catalog + broad — every number builder #17's experiment predicted holds; 9 left = E-d16c's NOTES), item 3 the gates (vitest 3 / 508 / 5 — the E-d2a suites only, first default run; tsc 26 / 10; rule (b) NONE), item 4 `wt/out` rebuilt 11:54. Item 5 (the records, incl. E-d16c) is next — builder #19, Next step.** Before: HANDOFF (builder #17, 2026-10-29 11:37) — **Hasan answered builder #16 with E-d16b (the word-diversity rule + a long-standing confident first is a note). Builder #17 item 1 DONE `c5a6124`: the E-d16b rule in `sound-answer.ts` + NEW `sound-answer-words.ts` (red → green; "covers" = any matcher field, any strength — the definition experiment in Built "builder #17"); items 2–5 (re-run the corpus + both step-4 drivers → `*-fix4b` reports, gates, rebuild, records) are next — Next step.** Before: BLOCKED (builder #16, 2026-10-29 11:15) — **step 4 (regression + broad probes) DONE: the fill regresses nothing vs `7967c6f`; a question E-d16 / E-d16a do not settle (confident noun-carrier firsts ABOVE the 0.5 line on participle + noun phrasings, pre-existing at `09e81ea`; 51 probes with the verb carrier not in the three) — Open problems "builder #16", Next step; steps 5–7 wait for Hasan's answer.** Earlier: **fix round 4 (E-d16 + E-d16a) IN PROGRESS: step 1 (the answer-level recall fill, red → green) DONE by builder #13 `34feafe`; step 2 (the corpus: recall over the answer's three + verifier round 4's probes as 264 rows) DONE by builder #14 `9a13e3b`; step 3 (the record fixes) DONE by builder #15 `d30830a`; step 4 (regression + broad probes) is next, then 5–7 — builder #16** (Next step). Before session 9: STOPPED — **FOURTH verifier FAIL** (round 4, 2026-10-29 01:24–02:00, E-d15 (iii): **F4** — fix round 3's own stem factor (`STEM_STRENGTH = 0.6`) with the equal-hit head rule lets a verb-form modifier + a noun that is ANOTHER clip's tag match the stranger CONFIDENTLY while the right clip — first at both `788c8d2` and `09e81ea` — drops into the nearest list a match answer never shows: "a cracked screen" / "a glitching screen" → `power-down` only, "a scribbled note" / "a typed note" → `chime-reward` only; plus four (iv) number nits in Status.md). Fix round 3 itself is complete (items 1–4: the corpus `574edbc`, the matcher `02e2a10`, the miss rule `7967c6f`, the records `3cff0be` / `5852abf`; gates, build and every other record TRUE in round 4). The session-8 rule: a FAIL in round 4 stops the run — **fix round 4 is set out in "Next step" (the answer-level recall fill — decision E-d16, Hasan's go 2026-10-29 10:07) for session 9, then verifier round 5 = E3's LAST under E-d16's bar; the track-E exit is NOT run.** Open problems → "Verifier round 4".

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

### Built (builder #5, fix round 1, 2026-10-28) — F1 (`b176881`) + the `generate_music` `force` pin (`788c8d2`)

- **F1** — `src/main/services/library/sound-match.ts`: `PLACEMENT` (the set after `CLAUSE_CUT`) = `when whenever while
  whilst until till once if unless because where wherever as`; `startsPlacement` / `promptClauses` (before `headClause`)
  cut each PROMPT clause where one of them starts, to that clause's end (`as` is one unless `a` / `an` follows — "as a
  transition" stays a qualifier through the old preposition cut; "as soon as" / "as the logo lands" are placement);
  `headClause` reads `promptClauses` instead of `clauses`. **What the placement words weigh now: nothing** — dropped like
  negated words, never the head word, never a 0.5 qualifier. Reason: the catalog describes sounds, not scene events, so a
  placement word hits no clip and, having the highest idf, only dilutes the coverage (the F1 misses); when it does hit,
  it is a coincidence choosing the sound ("switches" → `ui-toggle-on`'s `switch` tag — the WRONG-sound case). A leading
  placement clause ("When the logo lands, add a deep impact hit.") is skipped whole. Entry fields (descriptions) are
  untouched — only the prompt is cut. `after` / `before` / `between` / `during` keep the builder-#1 rule (a preposition
  cut, qualifiers at 0.5) — they are as often a plain preposition ("before the cut"); on the real index "a hit after the
  logo lands" → impact-soft 0.39 and "a whoosh before the slide changes" → whooshes 0.32 still MATCH (borderline, noted).
- Tests: `library/sound-match-placement.test.ts` (NEW, 13 tests; a fixture of 21 entries copied from the E3 profile's
  REAL imported index — description / tags / category / duration verbatim, `usedIn` count as the catalog's; the nine
  verifier prompts + the leading-clause form + "as soon as" + "as a transition" + three no-match controls).
  `sound-match.test.ts` untouched (all 14 still green).
- **Note 2** — `agent-tools/audio-tools.test.ts` (302 → 202 lines) split: the E3 reuse describe moved to
  `agent-tools/audio-tools-reuse.test.ts` (NEW, 173 lines, same mocks; the generate mock now answers per `kind`) + a new
  test "generate_music force: true generates even though a library bed matches (and skips the lookup)" (control first:
  the same ask without `force` answers `library:music/lofi-warm.mp3`). The old file keeps the `loadIndex` mock with an
  EMPTY library (no match → generates as before).

### Built (builder #7, fix round 2, 2026-10-28) — F2 + the corpus (E-d14); commit: see LOG / `git log`

- **The corpus (step 1, the acceptance bar):** `src/main/services/library/sound-match-corpus.fixture.ts` (71 lines) — ALL 51
  catalog clips of the builders' E3 index, verbatim (relPath, kind, tags, description, audio.category, probe.duration; `usedIn`
  as its count), generated by the scratch `E3\corpus-gen.cjs` from `E3\corpus-extract.json` (`corpus-extract.cjs`, read-only
  `readFileSync` of the index; SHA-256 `e5352386…12c5`, mtime `2026-10-28T18:13:42.105Z` unchanged). `sound-match-corpus.test.ts`
  (208 lines): **150 rows** = every distinct prompt / class / length the builders (70) and both verifier rounds used (round 1
  `c-matcher.json` 45, all within the 70; `b-noprov.json` 13, 10 new; round 2 `a-noprov.json` 67, 48 new; `c-probe.txt` 35,
  22 new), each
  with its right outcome by plain meaning ('a|b' = acceptable firsts, '∅' = no match, 'a|∅', '*', `not` = never offered;
  music rows with lengths). Rows that correct a recorded result: "a bell rung once" / "a bell rung" (bell-holding clip or ∅,
  never `dash-zip`), "a snap when the trap closes" → trap-snap, "a soft tick while the countdown runs" → clock-tick-soft, "when
  the logo lands a deep impact hit" → an impact, "as the title appears a soft whoosh" → whoosh-soft, "if the answer is right a
  chime" → a chime, "a sparkle when the star appears" (never `zap-electric`), "camera shutter" ×2 (never `trap-snap`).
  **Red** on `0e168cf` code: `Tests 10 failed | 141 passed (151)` (`E3\fix2-corpus-red.log`) — exactly those 10 rows.
- **The fix (step 2):** the words moved to `src/main/services/library/sound-match-words.ts` (179 lines, NEW; `sound-match.ts`
  249 → 141 — builder #8: `git show 788c8d2:…/sound-match.ts | wc -l` → 249, not 250; re-exports `headWord` / `soundTokens`). (a) **F2** — `wordsMatch` = equal, or the same `wordStem`: the
  endings -s, -es (after s x z ch sh), -ies → y, -ing, -ed (not after e: `speed`), -y (not after a vowel: `play`); then a
  doubled b c d g k m n p r t v undoubled (`popping` → pop) and a silent e dropped (close / closes / closing / closed); a stem
  keeps ≥ 3 letters and a vowel (`string`). **No -er / -est / -ly** (riser ≠ rise, timer ≠ time, shutter ≠ shut). `rung` ≠
  `run`, `sparkle` ≠ `spark`; air/airy, whoosh/whooshes, tick/ticking, pop/popping still match. (b) **placement words
  bonus-only** — `promptTerms` returns `bonus` (the placement clauses' content words, minus particles `out off down away back
  around along past`); never in idf / the denominator; a matched clip gets +0.05 per bonus word hitting a tag / name / category
  (cap 0.10) in the RANK only (`SoundMatch.placementHits`); a non-match stays one. (c) **a leading placement clause without a
  comma** — when the cut empties every clause: the sound starts at the last "a" / "an" after the conjunction (else the last
  content word), the placement words weigh 0.5. The conjunctions themselves (`while whilst until till once unless because
  whenever wherever`) became stop words (so "once" / "until" alone are not a sound).
- Tests: `sound-match-words.test.ts` (63 lines, NEW; the suffix pairs both ways, the non-pairs, stems, bonus / particles /
  the no-comma fallback / placement-only prompts — written after the code, not run red); the corpus green; `sound-match.test.ts`
  (14) and `sound-match-placement.test.ts` (13) untouched and green.

### Built (builder #9, fix round 3, 2026-10-29) — items 1–2: the corpus `574edbc`, the matcher fix `02e2a10`

- **Item 1 — the corpus extended (E-d15 (i)):** every probe of verifier round 3 (`…\E3-verify\r3\b-probes.txt` 513 probes /
  508 distinct, `c-probes2.txt` 148 lines, `c-probes3.txt` 48) not already one of the 150 rows — **659 new rows** (695 probes
  read, 1 already a row, 35 duplicates across the three files) — in four files over the SAME 51-clip fixture, sharing
  `src/main/services/library/sound-match-corpus-rows.ts` (58 lines: `CorpusRow` / `CorpusOpts`, the id sets `W IMPACT HIT THUD
  CLICK CHIME POP CRASH ZAP KNOCK WIND SNAP FAIL`, `NO_DASH` / `NO_TRAP` / `NO_SNUFF`, `corpusRun`, `describeCorpus(title, rows,
  count)`): `sound-match-corpus-r3-inflections.test.ts` (b-probes "inflections", 194 rows), `…-r3-senses.test.ts` (b-probes
  "collisions" + c-probes2 running / shutting / moving / senses + c-probes3, 204), `…-r3-placement.test.ts` (b-probes
  "placement" + c-probes2 "placementAdverbs", 129), `…-r3-ordinary.test.ts` (b-probes "ordinary" + "music", 132). The 150-row
  file is untouched. Coverage of the probe list checked by a scratch script (want 659 / got 659 / missing 0 / extra 0 / dups 0).
  Outcomes by plain meaning in the file's conventions; **'*' (open) on 38 rows** — polysemy ("a shocking reveal / hit / moment",
  "a building collapse" kept as crash-tumble|riser-soft, "a key turning in a lock", "winding up / down", "slowing down", "a pitch
  going down", "taking off", "a car / plane taking off", "a stinging slap"), sounds the library has no clip for ("a zipper",
  "zipping a jacket", "a speeding car", "waves crashing", "a fire crackling" ×2, "firing a gun" ×2, "breaking news", "a
  breakdown", "a dies roll", "a wind-up toy", "a sweeping broom", "sweeping strings", "a puffy cloud", "a lightning strike", "a
  floating island ambience", "a capture card", "a marking pen", "a rush of moving air", "a shutting / taking / closing sound", "a
  gate / case closing"), a tag that is the only trace ("stories", "singles", "hopes", "going", "a gone moment", "lighting",
  "sliding", "positively", "a magical moment"), and music "background music" / "a background bed while the host talks" (every bed
  fits). **'x|∅' (recall rows — the library has the sound but the phrasing is a different class)**: the noun + participle
  heads ("a tap running", "water running over rocks", "a stream running through a forest", "running creek", "running water
  ambience", "wind blowing", "the wind blowing", "a wind blowing softly"), "a machine / system / phone shutting down", "a
  computer shutting off", the -er / -en forms ("a runner", "eaten", "a buildup"), "a timer beep", "a dying battery", "a
  heart thumping", "a vacuum sucking", "a gliding plane", "a car skidding", "a rocket taking off", "a lid / box shutting",
  "message sent", "taking a picture", "typed text appearing", "a shattering window", "a popped balloon", "a clicky button", "a
  positive ding", "a stamped letter", "stamping feet", "a breaking news sting", "a running joke sting", "a swinging / sliding
  door", "a scanning laser", "puffing", "woooosh", "a warm bed under the voice" (music 60). **`not` rows (never offered):**
  `dash-zip` on 17 running / water rows, `trap-snap` on "shutting down" / "shutting off" / "a shutting down sound",
  `flame-snuff` on the three "wind blowing" rows, `page-flip` on "when the / a card flips a whoosh". Accepted on purpose (stated):
  "a running whoosh" → `W|dash-zip` (dash-zip's description IS "a quick zippy whoosh" with footsteps — a whoosh of something
  running; it ranks first at 0.60 through its `run` tag + the description's whoosh, the whooshes at 0.41), "a whoosh going down"
  → `W|power-down`, "a softer whoosh" / "a whoosh but softer" → W (whoosh-soft first after the comparative map).
  **Red on `09e81ea`** (`node …/vitest.mjs run src/main/services/library/sound-match-corpus` → `E3\fix3-corpus-red.log`):
  `Test Files 4 failed | 1 passed (5)` · `Tests 88 failed | 726 passed (814)` — **88 / 659 rows** (the commit message of
  `574edbc` says 87 — a typo; the log is right): the F3 rows (running water ×8, shutting ×4, moving air ×4, "a brook running over
  stones", "a stream running through a forest", "a tap running", "water running from a tap / over rocks"), the F1-class openers /
  adverbs / trailing words / wrappers (47 rows: every "right / exactly / precisely / only / even / shortly / immediately / soon
  …", "every / each / any time", "the (exact) moment / instant / second", "here / there / now / later / again / too", "could you
  add", "something like", "would be nice", "the same whoosh again", "when the user taps the button a click"), F3c
  (swooshing ×2, swooshed, wooshing ×2), the quantifier-of rows (9: "a bit of static / a whoosh", "a little bit of static", "a
  tiny bit of wind", "a burst of static", "a kind / sort / type / different type of whoosh"), "a hop" (hope/hop stem collision),
  "a deeper impact", "a long whoosh" (impact-deep-soft's `long-tail`), "turning off" (page-flip's `turn`), "wind blowing" ×2
  (flame-snuff), "while the host talks a calm bed" (music), "a moving whoosh", "a chime right after the answer".
- **Item 2 — the fix (`02e2a10`; 47 files / 1,181 tests green in `library/` + `agent-tools/` + the prompt test —
  `E3\fix3-green.log`; `sound-match.ts` 141 → **181** lines, `sound-match-words.ts` 179 → **211**, NEW `sound-match-vocab.ts`
  **90** (the word sets moved out: NEGATIONS, SAME_SOUND, COMPARATIVES, CLAUSE_CUT, PLACEMENT, OPENERS, OPENER_FILLERS,
  QUANTIFIERS, PARTICLES, STOP_WORDS), NEW `sound-match-bonus.test.ts` 52):**
  - **F3a (the factor, stated):** `matchStrength(a, b)` (`sound-match-words.ts`) = **1** for an equal word, a plural / -es /
    -ies pair or an adjective -y pair (clicks = click, whooshes = whoosh, airy = air, whooshy = whoosh, stories = story),
    **`STEM_STRENGTH` = 0.6** for a verb form (-ing / -ed: running / run, shutting / shut, moving / move, ticking / tick,
    popped / pop — the same as an equal hit in the description, so a stem hit on a tag never ties an equal tag hit and ranks
    like a description hit), **0** when the words differ and neither carries an inflection (the silent-e drop alone made hop =
    hope, bit = bite — gone; rung ≠ run, sparkle ≠ spark, riser ≠ rise, shutter ≠ shut stay). `hitOf()` (`sound-match.ts`) =
    field weight × strength; **the head rule needs an EQUAL hit** (`word === head && hit.equal`), so "a tap running" (head
    `running`, a stem hit on dash-zip's `run`) cannot match through the 0.30 head rule — dash-zip 0.26 on "a tap running",
    0.30 on "running water" (no head), 0.32 on "a running stream", trap-snap 0.32 on "shutting down", chess-piece-thock 0.38 on
    "moving air" — all below the 0.5 line, so NOT offered (`not` rows green); stream-soft 0.50 / 0.46, power-down 0.46,
    wind-soft 0.60 first. The pinned pair `run` / `running` in `sound-match-words.test.ts:11` STAYS a match (at 0.6): the
    corpus decided — "a running sound" / "running" / "someone running fast" / "running footsteps" → dash-zip are right by
    plain meaning, and single -ing words ("whooshing", "clicking", "chiming", "humming", "hitting") still match through the
    0.5 line (coverage = 0.6 on their one term). `strongHits` counts a tag / name / category hit of any strength;
    `placementHits` likewise (so "appears" → pop-reveal's `appear` tag still earns the bonus).
  - **F3b:** `OPENERS` = `every time`, `each time`, `any time`, `the moment`, `the instant`, `the second`, `the minute` (one
    filler adjective allowed inside: `the exact moment`, `the very instant`; `OPENER_FILLERS` = exact very precise same first
    next last) and the one-word `anytime` — `startsPlacement()` treats them exactly like `when` (anywhere in the clause, so "a
    whoosh AT the moment the slide changes" works too). STOP_WORDS gained the adverbs `right exactly precisely only even
    shortly immediately soon straight directly really quite`, the trailing `here there now later again too anymore instead`,
    the wrappers `could would should you maybe probably perhaps something anything someone somebody anyone thing things stuff
    nice good great fine cool ok okay thanks thank`, the determiners `same another other more every each all both several
    many multiple few`, `being`, and the opener nouns `time moment instant minute exact precise` — none names a catalog
    sound; "exactly" / "precise" no longer hit party-popper's / crunch-bite's "Exactly ONE …" or clock-tick-soft's "precise".
    `promptTerms('a whoosh shortly after the cut')` → terms [whoosh], head whoosh. **The no-comma leading clause** ("when the
    logo lands a deep impact hit") now yields its placement words as BONUS words (logo, lands), not half-weight qualifiers —
    the corpus decided ("when the user taps the button a click" → CLICK needs it; the old expectation in
    `sound-match-words.test.ts` changed accordingly, said in the test name). **Quantifier-of:** `QUANTIFIERS` = bit kind sort
    type lot lots touch hint piece pieces couple few pair bunch burst series amount — `cutHead()` restarts the head clause
    after "<quantifier> of" ("a bit of static" → static, "a little bit of static", "a kind of whoosh", "a piece of glass
    breaking" → breaking). **COMPARATIVES** (explicit map, no -er rule): softer deeper louder quieter quicker faster slower
    longer shorter lower higher harder warmer brighter darker bigger smaller lighter heavier gentler calmer → their base,
    applied in `expand()` to prompts and entries alike ("a softer whoosh" → whoosh-soft, "a deeper impact" → impact-deep-soft,
    "a long whoosh" → whoosh-wind through its "Longer and softer" description).
  - **F3c:** `SAME_SOUND` is applied to the stem in `stemOf()` / `singular()` as well as to the raw word in `expand()`:
    swooshing / swooshed / wooshing / swooshy / swooshes = whoosh (0.6 / 0.6 / 0.6 / 1 / 1).
  - **MI / MJ pinned** (`sound-match-bonus.test.ts`): MI — two clips, A covers click (tag) + tail (tag) = 1.00, B click (tag)
    + tail (description) = 0.867 with THREE placement hits (trap, latch, shut): capped +0.10 → 0.967 second; the cap dropped →
    1.017 first. MJ — ten clips (idf sharp 1.48 / snap 1.99): B covers sharp only = 0.427, misses the head word, three
    placement hits: a non-match that `nearestLibrarySounds` lists; the bonus before the threshold → 0.527 → a match.
    Plus the true-miss case ("a cuckoo clock chime" → no match AND no nearest). **Proved** (`E3\fix3-mi-mj-red.log`): MI
    applied by sed (`m.coverage + PLACEMENT_BONUS * m.placementHits`) → `Tests 1 failed | 2 passed (3)` × "MI — the bonus is
    capped …"; restored; MJ applied (`rankOf(match) >= MATCH_COVERAGE || (headHit && rankOf(match) >= HEAD_MATCH_COVERAGE)`)
    → `1 failed | 2 passed` × "MJ — …"; restored by `git checkout -- sound-match.ts`; `git diff --stat` EMPTY after, HEAD
    `02e2a10`.
  - **For item 3, already in place:** `rankLibrarySounds(entries, prompt, opts) → { matches, nearest }` and
    `nearestLibrarySounds()` in `sound-match.ts` — `nearest` = the candidates with coverage > 0 below the threshold, sorted by
    the same rank, at most `limit`; `matchLibrarySounds()` = `.matches` (unchanged signature). The tool / answer / prompt side
    is NOT done. (Builder #10: DONE — below.)

### Built (builder #10, fix round 3, 2026-10-29) — item 3, the miss rule (E-d15): `7967c6f`

- **(a) `agent-tools/sound-reuse.ts` (45 → 74 lines):** `ReuseAnswer = { kind: 'match' | 'nearest'; text }` `:27`;
  `formatSoundMatches` `:34` (wording unchanged); NEW `formatNearestSounds(nearest, prompt, toolName)` `:46` — `No library sound
  matched "<prompt>" well — nothing was generated (no cost, no provider needed). The closest library sounds:` + E2's
  `formatLibraryRow` rows + `If one of them fits, place it with insert_asset(assetId: "library:<first>", lane: "audio", at: …) — a
  library ref works as the asset id. If none fits, call <tool> again with force: true to generate a new one.`;
  `libraryReuseAnswer()` `:61` runs `rankLibrarySounds` — matches → `match`, else nearest → `nearest`, else (nothing scores — a
  TRUE miss) `null`; the index unreadable → `null` (generation proceeds, as before).
- **(b) `audio-tools.ts` (198 → 199):** `if (reuse) return text(reuse.text)` `:135` / `:179` — both kinds generate nothing;
  `force` skips the lookup as before (`:132` / `:172`); a `compositionPlan` call never looks; `minDurationSec = durationSeconds`
  applies to the nearest too (a bed that cannot cover the asked length is useless either way — stated choice: `durationSeconds:
  90` on a library whose longest bed is 57 s leaves NO candidate → a true miss → generates). `FORCE_HINT` `:60` + one sentence
  ("The same on a miss: the tool answers the closest library sounds instead of generating, and force: true is the only way to
  generate while anything in the library scores."); `REUSE_NOTE` `:63` + one ("On a miss it answers the three closest library
  sounds instead of generating; only when nothing in the library scores does it generate without force.").
- **(c) `studio-agent-prompt-tools.ts` (87; one sentence each):** `:21` "Even a sound the library lacks starts there: on a miss
  generate_sfx / generate_music answer the closest library sounds before anything is generated."; `:31` "When nothing matches well
  it STILL generates nothing: it answers the three closest library sounds — place one that fits, or call again with `force: true`
  to generate; it generates without `force` only when nothing in the library scores at all."; `:32` "and the same miss rule — the
  closest library beds instead of a new track, `force: true` to generate"; `:70` "A miss answers the closest library sounds, not a
  new file — call again with `force: true` only when none of them fits either."; `:75` "on a miss either tool answers the closest
  library sounds instead of generating — `force: true` generates when none fits". Pinned: `studio-agent-prompt.test.ts` `:122` (a
  fifth `it` in the E3 describe; 200 lines).
- **(d) `agent-tools/audio-tools-miss.test.ts` (NEW, 180 lines; the reuse test's mocks + its 4-entry library; 5 tests):** a near
  miss ("a cuckoo clock chime, tick tock, wind, airy" — clock / tick / tock / wind / airy hit, cuckoo / chime — the head — do not)
  answers the three nearest (clock-tick-soft first, then the two whooshes) with the exact wording, and `hasAudioProvider`, the
  engine and the import are never called; a one-word near miss ("a cuckoo clock chime" → clock-tick-soft alone, nothing else); a
  TRUE miss ("a dog bark") generates, and says "No audio provider" without one; `force` on a miss generates without looking;
  music — "a warm bed for a cooking show" → lofi-warm as the nearest, `durationSeconds: 90` → generates, a plan never looks.
  `audio-tools-reuse.test.ts` (173): its "no match" test now asks "a dog bark" (the cuckoo's "clock" is a near miss on that
  mock — said in the test name). **Red first** (`E3\fix3-miss-red.log`, the tests before the code): `Tests 11 failed | 832 passed
  (843)` — the 3 miss tests, the prompt pin, 7 corpus recall rows.
- **(e) The corpus RECALL assertion:** `sound-match-corpus-rows.ts` (58 → 79) — `corpusRank()` `:40` (matches + nearest as ids),
  `expectCorpusRow()` `:56`: the first result as before; then, for a row whose expected is not '*' and names a clip, some allowed
  clip must be in matches ∪ nearest (top 3 each); then the `not` list (on `matches` only — a `not` clip MAY be a near miss: the
  model reads its description and decides); `describeCorpus` calls it, and the 150-row `sound-match-corpus.test.ts` (208 → 192)
  calls it too (its own runner removed). **Rows → '∅' — plain-meaning corrections, each with a comment in its file: 10.** The named
  clip carries NO word of the prompt, so no rule can reach it (a synonym gap, not a ranking fault): r3 "taking a picture"
  (camera-shutter says photo / capture; chess-piece-capture is the one near miss), "a buildup" (riser-soft says build / build-up),
  "a runner" (runner ≠ run — no -er), "eaten" (crunch-bite's `eat`; no -en), "a tap running" and "running creek" (stream-soft:
  stream / brook / water / trickle / babbling — neither word; dash-zip is the one near miss and still never a MATCH — `NO_DASH`
  kept), "woooosh" (an elongated spelling); the 150-row file "a ding", "a ding if correct", "a ding when the answer is right" (the
  chimes say "bell notes", no `ding` — fix round 2's N3). Row counts unchanged (150 + 194 + 204 + 129 + 132).
- **(f) The REAL-handler drivers** — kit `E3\tools-noprovider-fix3.e3.test.ts` / `tools-standin-fix3.e3.test.ts` (copies of
  builder #3's, which stay untouched), both PASS (Verified). **A stated fact corrected:** on the E3 profile "a cuckoo clock chime"
  is a MATCH — its library holds `generated/sfx-a-cuckoo-clock-chime.mp3` from the live step (found before regenerated, the E2
  promise) — so the near-miss prompts there are "a grandfather clock chiming midnight" (sfx: clock / chiming score on the
  generated cuckoo, clock-tick-soft and the chimes; grandfather / midnight on nothing) and "a warm bed for a cooking show"
  (music); the true-miss prompt is "a dog bark" (no word of it in any clip, generated ones included).

### Built (builder #11, fix round 3, 2026-10-29) — item 4a–4c: the regression report, the broad probe set, the gates, the rebuild; NO `src/` change (code HEAD stays `7967c6f`)

- **The kit (scratch `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\`, not committed):** `fix3-lib.ts` — ONE `readFileSync` of the E3
  profile's index (READ-ONLY; SHA-256 + mtime stamped before / after every run), the pool = every entry NOT under `generated/` (so the 4
  generated entries are seen by no matcher), the fixture asserted = the pool's 51 audio entries verbatim, and the three matchers:
  OLD-788 = `sound-match-788.ts` (checked: `git show 788c8d2:src/main/services/library/sound-match.ts | diff - sound-match-788.ts` →
  only its two `@shared` import lines re-pointed to the worktree's absolute paths), OLD-09e = `sound-match-09e.ts` +
  `sound-match-words-09e.ts` (NEW this round: `git show 09e81ea:…/sound-match.ts` with its two shared imports + the two
  `./sound-match-words` lines re-pointed — `diff` shows exactly those 4 lines; `…/sound-match-words.ts` byte-identical to `git show`),
  NEW = the worktree (`../E/wt/src/main/services/library/sound-match`). Drivers: `catalog-fix3.e3.test.ts` (4a), `broad-fix3.e3.test.ts`
  (4b), `probe-fix3.e3.test.ts` (22 adjective + verb-form phrasings the broad set lacks), the readers `fix3-analyze.cjs` /
  `fix3-analyze2.cjs` (the changed-first breakdowns printed from the summary file), `vitest-full-fix3.sh` (the full run from a script
  FILE, background). `sound-match-old.ts` is fix round 1's `7a0d6ad` copy — not used. All four drivers run with
  `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/E3/vitest.e3.config.ts <name>`
  from the worktree root (logs `catalog-fix3.log`, `broad-fix3.log`, `probe-fix3.log`, each `1 passed`).
- **The index as it is now (stamped by every driver):** 61 entries, 57 without `generated/`, 51 audio (= the fixture); `generated/` =
  `sfx-a-cuckoo-clock-chime-2.mp3`, `sfx-a-cuckoo-clock-chime.mp3`, `sfx-a-dog-bark.mp3`, `sfx-soft-whoosh.mp3` (4 — builder #3's two +
  builder #10's two), EXCLUDED from the pool; SHA-256 `876f9f611c2704eb1980502bb8d9e44c79ef899957586af4bb10c86545c16c95`, mtime
  `2026-10-28T22:31:02.584Z` (00:31:02 local, builder #10's stand-in run) — identical before / after all four runs.
- **4a — `E3\catalog-order-fix3.txt`** (the 809 rows = the five corpus files' `ROWS` literals, read from the files' text and evaluated
  with their own constants; per-file counts asserted 150 / 194 / 204 / 129 / 132): for each old version a section with every changed
  row (old / new top 3, HEAD's nearest 3 on a new miss, the row's expected string), then the strict lists. **vs `788c8d2`: 358 changed ·
  165 first results changed · 19 matches lost · 114 gained · a CORRECT first lost (strict — the old first was a clip the row names, the
  new first is not) 3 · a CORRECT match lost 4. vs `09e81ea`: 301 · 116 · 19 lost · 55 gained · 7 · 7.** Every strict loss is an
  `x|∅` RECALL row whose head is a verb form after a noun (the F3a 0.6 factor; the right clip is the FIRST nearest in each): vs 788 "a
  shattering window" (break-glass-crack 0.54 → ∅, nearest 0.26), "a heart thumping" (launch-thump 0.39 → ∅, nearest 0.24), "a vacuum
  sucking" (whoosh-reverse 0.43 → ∅, nearest 0.26), + "a wind blowing softly" (flame-snuff 0.55 | wind-soft 0.50 | whoosh-wind 0.47 →
  ∅; nearest whoosh-wind 0.30 | wind-soft 0.30 | flame-snuff 0.21 — the `not` clip gone from the matches); vs 09e "a man running" and "a
  car skidding" (dash-zip 0.43 → ∅, nearest 0.26), "fingers snapping" (ui-click-soft | ui-send | trap-snap 0.30 → ∅, nearest the same
  three 0.18), "a heart thumping", "a vacuum sucking", "a lid shutting" and "a box shutting" (trap-snap 0.43 → ∅, nearest 0.26). The
  corpus is green on HEAD, so every new first is an accepted one; **no row lost a correct first or match that the corpus does not
  accept as ∅-with-the-clip-in-reach.** The 19 lost matches per version are the `not` removals and the recall / '∅' / '*' rows (vs 09e:
  wind blowing ×2, a hop, a gun firing, a man running, lighting, a tap running, water running from a tap, a stream running through a
  forest, water running over rocks, a car skidding, a key turning in a lock, fingers snapping, waves crashing, a heart thumping, a vacuum
  sucking, a closing sound, a lid / a box shutting; vs 788 also a bell rung once / a bell rung (dash-zip 0.60 → ∅, nearest the chimes
  0.20), a shattering window, a marking pen, a wind-up toy, a runner, eaten, positively, a zipper, a buildup). Builder #9's intentional
  firsts, confirmed vs `09e81ea`: "a running whoosh" dash-zip 0.85 → 0.60 (the whooshes 0.38; `W|dash-zip`), "winding down" whoosh-wind
  / wind-soft 0.53 → power-down 0.47 alone ('*'), "a key turning in a lock" page-flip 0.38 → ∅ (nearest keys-typing-soft 0.38 |
  page-flip 0.23; '*'), "a door slamming" stamp-hit | knock-solid 0.50 → knock-solid 0.50 alone, "moving air" / "air moving"
  chess-piece-thock 0.63 → gone (wind-soft 0.60 first), "a long whoosh" impact-deep-soft 0.62 → whoosh-wind 0.77, "a softer whoosh"
  whoosh-wind 0.75 → whoosh-soft 1.00, "a deeper impact" impact-soft 0.36 → impact-deep-soft 1.00. The F3 rows: "running water" dash-zip
  0.50 | stream-soft 0.50 → stream-soft 0.50 alone; "shutting down" trap-snap 0.57 → power-down 0.43 alone; "a whoosh shortly after the
  cut" ∅ → the whooshes 1.00; "a whoosh every time the slide changes" ∅ → whooshes 1.00 (both olds); "swooshing" ∅ → whooshes 0.60;
  "a tap running" dash-zip 0.43 → ∅ (nearest dash-zip 0.26 — a `not` clip may be a near miss, by design); "a hop" chime-magic 1.00 → ∅
  (nearest ∅).
- **4b — the broad probe set** (`C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\broad-probes-fix3.txt`, 1.66 MB, every probe with 788 /
  09e / new top 3 + HEAD's nearest 3 on a new miss; the summary at its top; `E3\broad-probes-fix3-summary.txt` = the summary + every
  probe whose FIRST changed vs either old, 2,786, each auto-classed — a "carrier" = a clip whose tag / file name / category holds the
  probe's base word): **243 base words** (every tag, tag hyphen-part, file-name part and category of the 51 clips, ≥ 3 letters) × every
  inflection (the plural, -ing, -ed, -y by the usual spelling rules; -er from an explicit list of 69 real words) × bare / "a w" / "a w
  sound" / "a soft w", plus "a <base>" with the 7 openers and 3 leading forms (`right when the slide changes, a …`, `just a …`, `could you
  add a …`); the class = `music` only for the 30 words found on music clips alone → **7,554 probes**. **vs `788c8d2`: 4,596 changed ·
  2,555 first changed · 491 new misses · 1,939 new matches · 469 "WORSE?" candidates (old first a carrier, new first not — or a new miss
  with no carrier in the nearest). vs `09e81ea`: 3,892 · 1,803 · 12 new misses · 1,744 new matches · 4 "WORSE?".** Read and classified
  (the breakdowns in `fix3-analyze*.cjs`' output, quoted in Verified): (1) **improvements** — 1,930 / 1,736 new matches whose first
  carries the word (the openers / adverbs / wrappers: `… exactly when the slide changes` was party-popper / crunch-bite via "Exactly
  ONE …", `… shortly after the cut` was ∅ at 09e, `every time` / `the moment` / `right at` / `only when`, `could you add a …`, `right
  when …, a …`; the comparatives "softer" / "longer"; the SAME_SOUND stems) and the 90 / 40 swaps to a carrier first ("draw" 788
  whoosh-wind via "drawn" → pencil-scribble, "spark" 788 sparkle-soft → zap-electric, "sparkly" 788 zap-electric → sparkle-soft,
  "messagy" 788 break-glass-crack → ui-send, "moving" 09e chess-piece-thock 1.00 → a 0.60 tie with wind-soft); (2) **documented ties**
  — 21 / 3 swaps between two carriers ("capturing" chess-piece-capture → camera-shutter, "snapping" trap-snap → ui-click-soft (the
  `snap` category), "popper" pop-reveal → party-popper, "a pop exactly when …" party-popper → pop-reveal, the chess / board / piece /
  wood / knock / texture `shortly after the cut` orders, "a emphasis / foley exactly when …" — category words); (3) **the -er forms**
  (231 of the 469 vs 788): 788's prefix rule matched "clicker / ticker / knocker / streamer / jumper / swiper / hitter / snapper …";
  09e and HEAD find nothing — fix round 2's design (no -er), not this round's; (4) **nonsense inflections** (the other 238 vs 788:
  "backwardses", "blockeding", "keysing", "cozyy", "docuy", "treeses", "typinging", "workinged" …) — 788's ≤ 3-letter prefix rule,
  not phrasings; (5) **the 4 "WORSE?" vs 09e, read:** "a soft marking" stamp-hit 0.84 → impact-soft 0.66 | stamp-hit 0.50 (a verb
  form; the stamp second), "a soft moving" chess-piece-thock 0.84 → wind-soft 0.66 | chess-piece-thock 0.50 (better by plain meaning —
  the F3 class), "a soft singling" / "a soft singled" knock-solid 0.75 → ui-click-soft 0.52 (nonsense forms of the tag `single`) —
  **none an ordinary phrasing with a clearly wrong first → no fix**; (6) **strangers** (a new match whose first carries no word): 8 vs
  09e, all "a drums …" (music; `drums` is the `no-drums` tag's part — lofi-warm 0.60, the one bed whose description has drums: right by
  meaning), + "a soft singling" vs 788; (7) **new misses with the carrier in the nearest** (12 vs 09e / 24 vs 788): the ordinary ones
  are **"a soft knocking"** (knock-solid 0.82 → ∅; nearest chess-piece-capture 0.49 | knock-solid 0.49 | chess-piece-thock 0.30) and
  **"a soft breaking"** (break-crash-digital | break-glass-crack 0.82 → ∅; nearest the same two 0.49 | crunch-bite 0.30); the rest are
  nonsense forms ("a soft majing / pianoed / solidding / brokened / knocked") and, vs 788, -er / prefix artefacts ("a soft clicker",
  "a soft menus", "a soft lullabying"). **No "worse" first in the brief's sense** (an ordinary phrasing where the library has the sound
  and the new first is clearly wrong, or the sound lost from matches AND nearest) — so no code change.
- **The one class to note (E-d15 — a NOTE, not a FAIL; Open problems "builder #11"):** an adjective the clip's own text does not hold +
  a verb-form head word. The 0.6 stem hit alone cannot reach the 0.5 line and the head rule needs an EQUAL hit, so the tool answers the
  nearest list (the right clip first in it) instead of a match. `E3\probe-fix3.txt` (22 phrasings, 788 / 09e / HEAD): "a soft knocking"
  → ∅ (nearest knock-solid 0.49; 788 / 09e 0.82), "a gentle knocking" 0.44 (old 0.72 / 0.73), "a loud knocking" 0.22 (old 0.36), "a
  soft knocking when the door opens" 0.49 (old 0.82), "a soft breaking" 0.49 (old 0.82), "a slow ticking" 0.20 (old 0.43 / 0.34), "a loud
  crashing" 0.24 (old 0.39) — each ∅ with the right clip FIRST in the nearest; while "a soft knock" 0.82, "a gentle knock" 0.73, "a
  knocking" 0.60, "a soft knocking at the door" knock-solid 0.67, "a soft / quick / gentle whooshing" 0.68 / 0.60 / 0.60, "a soft
  ticking / clicking" 0.68, "a soft popping / chiming", "a gentle sparkling", "a quiet humming" 0.60 and "a soft typing" 1.00 still
  MATCH (the clip's text holds the adjective, or the head is a noun). By E-d15 (ii) no FAIL — nothing is generated and the clip is in
  the nearest three; (iii) no wrong first. Candidate corpus rows for the verifier / Hasan's list (recall rows): 'a soft knocking' →
  `knock-solid|chess-piece-capture|∅`, 'a gentle knocking' likewise, 'a soft breaking' → `break-crash-digital|break-glass-crack|∅`, 'a
  slow ticking' → `clock-tick-soft|ui-click-soft|∅`, 'a loud crashing' → `CRASH|∅`. A possible later fix (NOT done — outside the brief's
  fix clause, and it would need the corpus + both probe sets re-run): count a verb-form head hit at a higher floor (e.g. coverage ≥
  0.4); the F3 rows would stay unmatched (dash-zip 0.26–0.32 / trap-snap 0.32 / chess-piece-thock 0.38, none with an equal head).
- **4c — gates and the rebuild:** in Verified "builder #11" (CPU measured → DRIVING's normal rule; run 2 counted; rule (b) NONE over
  the 99-path `src/` + `scripts/` diff list; tsc 26 / 10; the `wt/out` rebuild at `7967c6f`).

### Built (builder #13, fix round 4, 2026-10-29) — step 1: the answer-level recall fill (E-d16 + E-d16a), commit `34feafe`

- **NEW pure `src/main/services/library/sound-answer.ts` (75 lines)** — `selectSoundAnswer(ranking)` :58-75 takes a
  `rankLibrarySounds()` ranking (called with `limit` = every candidate — an option, not a matcher change) and returns
  `{ kind, rows, confident, weak } | null`: the CONFIDENT matches (`coverage >= CONFIDENT_COVERAGE` 0.5 — the matcher's own
  `MATCH_COVERAGE`, mirrored as a constant because the matcher file stays byte-identical) first in the matcher's order, then the
  below-threshold sounds — weak matches (a `matches` entry under 0.5 = the head rule) AND `nearest` together — sorted by
  `byCoverageClosestFirst` :50-55 (coverage desc; |gap| < `COVERAGE_EPSILON` 1e-9 = a tie → `closest` before `weak match`;
  same label → the matcher's order, stable sort); `ANSWER_SIZE` 3; null = no row (a TRUE miss). **Stated choice — the kind follows
  the rows SHOWN:** a `matched` row → 'match'; else a `weak match` row → 'weak'; else 'nearest' (so three closest that outrank
  every weak match by coverage read as a pure miss). `labelOfMatch` :45-47. Unit tests `sound-answer.test.ts` (89 lines, 10 tests:
  null; ≥3 confident keep the matcher's order; "a cracked screen"; the E-d16a "a breaking screen" pin; the epsilon tie; a closest
  above a weak; the mix; a pure miss; never padded; the label threshold).
- **`agent-tools/sound-reuse.ts` (74 → 95 lines)** — `formatReuseAnswer` + `libraryReuseAnswer` (`ReuseAnswer.kind` now
  'match' | 'weak' | 'nearest'); the old `formatSoundMatches` / `formatNearestSounds` are gone (no other importer in `src/`).
  **The exact rendering (stated):** each row = E2's `formatLibraryRow` with the label after its "- ":
  `- [matched] library:sfx/… (audio, 0.68 s, imported) — "…" · category: … · tags: …` / `- [weak match] …` / `- [closest] …`.
  Headers: a confident match, all shown matched → the OLD header unchanged (`The library already has N sounds matching "<p>" —
  nothing was generated (no cost, no provider needed):`); a confident match + others → `… (no cost, no provider needed). 3 shown:
  1 matched, 1 weak match, 1 closest:` (zero parts omitted); only weak → `The library may have a sound for "<p>" — only 1 weak
  match, nothing confident; nothing was generated (no cost, no provider needed). The closest library sounds:`; a pure miss → fix
  round 3's header verbatim (its rows now carry `[closest]`). Last line: 'match' → `Place the one that fits with insert_asset(assetId:
  "library:<first shown>", lane: "audio", at: …) — a library ref works as the asset id. Only if none of them fits, call <tool> again
  with force: true to generate a new one.`; 'weak' / 'nearest' → fix round 3's `If one of them fits, place it with … If none fits,
  call <tool> again with force: true …`. **Marker unique to the new wording (for step 6): `The library may have a sound for`.**
- **`audio-tools.ts` (199 lines, unchanged count)** — `FORCE_HINT` :61 "returned library sounds (matched, weak match or closest)";
  `REUSE_NOTE` :64 "returns up to three library:<path> refs … the matches first, then the closest other library sounds, each row
  labelled [matched], [weak match] or [closest] (only weak matches: the library "may have" the sound)". The handlers (:132-135,
  :172-178) are unchanged — `if (reuse) return text(reuse.text)`; force / plan / `minDurationSec` / before-the-provider-check as
  before.
- **`studio-agent-prompt-tools.ts` :31 only** (87 lines) — "returns up to three `library:<path>` refs instead of generating (no cost,
  no provider needed) — the matches first, then the closest other library sounds, each row labelled `matched`, `weak match` or
  `closest` (only weak matches: the library "may have" the sound); place the one that fits …". :21 / :32 / :70 / :75 say the miss
  rule, still true — unchanged. Pinned: `studio-agent-prompt.test.ts` (200 → 204) — the :104 pin re-worded + a new `it` "the recall
  fill (E-d16, fix round 4)".
- **Tests:** NEW `agent-tools/audio-tools-fill.test.ts` (184 lines, 8 tests; real handlers over the committed 51-clip
  `CORPUS_LIBRARY`, same mocks as the miss test; the engine + normalizer are behind the mocked `generateAudioAsset`): "a cracked
  screen" → `weak match power-down | closest break-glass-crack | closest pop-reveal` + "may have"; "a scribbled note" → `closest
  pencil-scribble | weak match chime-reward` (the tie); **"a breaking screen" → `matched power-down | closest break-crash-digital |
  closest break-glass-crack`** (E-d16a pin); "running water" → `matched stream-soft | closest dash-zip` (never padded); "an F major
  triad" → the old header, 3 matched; "a soft knocking" → fix round 3's wording, 3 closest; a true miss generates, `force` generates
  without a lookup; music — "a pulsing bed" → `matched tech-pulse | closest lullaby-tender | closest ambient-pad`, with
  `durationSeconds: 60` lullaby-tender (57.05 s) drops out, a pure miss, a plan and `force` never look. Every answer case asserts
  `hasAudioProvider` / `generateAudioAsset` / `importLibraryFile` uncalled. `audio-tools-miss.test.ts` (180 → 184) and
  `audio-tools-reuse.test.ts` (173 → 177) updated for the labels; **the reuse test's "a soft airy whoosh for a transition" on its
  4-clip mock: `whoosh-wind` is a WEAK (head-rule) match — the old answer said "2 sounds matching"; now "1 sound matching … 3 shown:
  1 matched, 1 weak match, 1 closest" (`clock-tick-soft` via "soft" in its description).** Music "may have" is covered by the
  pure tests only (no music prompt on the fixture gives a weak match — the probe below).
- **NO matcher change:** `git diff 7967c6f -- src/main/services/library/sound-match.ts src/main/services/library/sound-match-words.ts
  src/main/services/library/sound-match-vocab.ts | wc -c` → `0` (as of `34feafe`).
- Scratch: kit `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\fix4-rank.e3.test.ts` → `fix4-rank.txt` (the full `7967c6f`
  rankings with coverages for 24 prompts — the inputs the fill tests were written against); logs `fix4-red.log`, `fix4-green.log`
  (the wide run with 3 ffmpeg load timeouts), `fix4-green-2.log` (counted), `fix4-ffmpeg-alone.log`, `fix4-tsc-node-step1.log`.

### Built (builder #14, fix round 4, 2026-10-29) — step 2: the corpus (recall over the ANSWER's three + verifier round 4's probes), commit `9a13e3b`

- **`src/main/services/library/sound-match-corpus-rows.ts` (79 → 146 lines)** — (a) `expectCorpusRow` :96-104 (lines as of `9a13e3b`): the FIRST assertion
  stays on `matches[0]` (weak or confident; none = '∅'), `not` stays on the matches (top three), the RECALL now runs over the ANSWER
  — NEW `corpusAnswer()` :81-84 = `selectSoundAnswer(rankLibrarySounds(CORPUS_LIBRARY, prompt, { …, limit: CORPUS_LIBRARY.length }))`
  (the call `sound-reuse.ts` `libraryReuseAnswer` makes), `expectRecall()` :89-93. (b) The header :1-23 states both conventions and
  E-d16's row convention; NEW `expectAnswerRow()` :107-126 + `describeAnswerCorpus()` :144-146 (the round-4 files): the named clip in
  the answer's three; a first labelled `matched` must be allowed EXCEPT (E-d16a) at the 0.5 line (|cov − 0.5| < `COVERAGE_EPSILON`)
  or tied (within it) with an allowed `matched` row shown, when an allowed clip is in the three — the row must carry `edge: 'line' |
  'tie'` (new `CorpusOpts.edge` :29-34) and a row carrying an `edge` whose first IS allowed fails ("stale E-d16a note"); a weak /
  closest first is not asserted; '∅' = no confident first (stated choice: the answer may still show weak / closest rows); the
  exception never applies to a '∅'-only row. `describeCorpus` keeps its signature (both go through `describeRows` :128-136).
- **NEW `sound-match-corpus-r4-frames.test.ts` (85 lines, 67 rows)** — g-probe's 32 (verifier's expectations verbatim except "a
  rewound tape" → '∅' vocabulary note) + f-probe's 35 new rows (6 of its 41 were already rows), MY verdicts (f-probe carries none;
  the map is in the kit `fix4-corpus.e3.test.ts` `F_VERDICT`): knocking → `KNOCK` / "at the door", "when the door opens" →
  `knock-solid`; "a soft breaking" → the break clips; "a slow ticking" → `clock-tick-soft`; "a loud crashing" → `CRASH`; "a quiet
  humming" → `scan-hum`; scribbled / sketched / pencil note / signature / line → `pencil-scribble`; "a glitched photo" → `glitch-zap`;
  "a popped message" → `pop-reveal|ui-send`; "a typed message" → `keys-typing-soft`; "a launched message" → `ui-send|launch-thump`;
  "a crashed device" → `power-down|break-crash-digital`; "a shattered phone screen" → `break-glass-crack`; "a swiped card" →
  `whoosh-soft`; the rest the one obvious clip. E-d16a `edge: 'line'` rows: "a breaking screen" (power-down 0.50), "a glitched photo"
  (camera-shutter 0.50), "a typed message" (ui-send 0.50) — listed in the header and inline.
- **NEW `sound-match-corpus-r4-ordinary.test.ts` (211 lines, 197 rows)** — c-ordinary's 236 minus 39 already in the corpus; the
  verifier's expectations kept VERBATIM (none wrong by plain meaning on my read of all 197) except three 'x|∅' rows whose clip scores
  0 → '∅' + `// vocabulary note` ("a clicker", "a river running", "a running tap" — the last two keep `NO_DASH`); E-d16a `edge:
  'tie'`: "an F major triad" (the three majors at 0.60, piano-c-maj first). 45 duplicates skipped in all (6 f + 39 c; list in
  `E3\fix4-corpus-review.txt`).
- **No old row changed:** the five old files pass with the recall over the answer (try1: their 814 tests green — 809 rows + 5 count
  tests). **NO matcher change:** `git diff 7967c6f -- <the three matcher files> | wc -c` → `0` (as of `9a13e3b`).
- Kit: `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\fix4-corpus.e3.test.ts` (parses g / c / f, dedupes against the 809, writes
  the two row files with `FIX4_WRITE=1`, the review sheet `fix4-corpus-review.txt` — every r4 row's ANSWER (labels + coverages) beside
  the 7967c6f answer — and the LESS check over 809 + 264 rows); `fix4-r4-notes.txt` (the 25 r4 rows whose answer first is not an
  allowed clip); logs `fix4-corpus.log`, `fix4-corpus-red.log`, `fix4-corpus-try1.log`, `fix4-corpus-green.log`,
  `fix4-corpus-green-2.log`, `fix4-tsc-node-step2.log`.

### Built (builder #15, fix round 4, 2026-10-29) — step 3: the (iv) record fixes, commit `d30830a`

- **`Status.md` E3 entry (line numbers as of `d30830a`):** :189 "the whooshes at 0.41" → **0.38**; :213 "trap-snap 0.32 on
  'shutting down'" → **0.34** (`E3\fix4-rank.txt:46-48`: `M: power-down 0.4294 | N: trap-snap 0.3424 …` at `7967c6f`); :215
  "power-down 0.46" → **0.43**; :305 "(riser-soft says build / build-up)" → **"build / building"**; verifier note 1 — :405-408,
  :412-413 and :783-785 "the right clip FIRST in the nearest" → "in the nearest — SECOND in four of the seven adjective + verb-form
  phrasings ('a soft / gentle / loud knocking' list chess-piece-capture first on an exact tie, 'a slow ticking' ui-click-soft first)"
  — checked against `E3\probe-fix3.txt` HEAD rows: knocking ×3 `chess-piece-capture 0.49 / 0.44 / 0.22 | knock-solid` (same
  coverage), "a slow ticking" `ui-click-soft 0.20 | clock-tick-soft 0.20`, while "a soft knocking when the door opens" (knock-solid
  first), "a soft breaking" (break clips 1–2) and "a loud crashing" (break-crash-digital | crash-tumble) have a right clip first.
- **`docs/studio/TESTING.md` §18.17:** :533 the same note-1 correction + "trap-snap 0.32 on 'shutting down'" → 0.34; :540 the
  note-1 correction (fix round 3 notes).
- **`src/main/services/library/sound-match-corpus-r3-ordinary.test.ts:16`** — the false comment "(riser-soft says build-up)" →
  "(riser-soft says build / building)" (comment only; no row changed).
- NOT changed (left for step 7, see Open problems "builder #15"): Status.md :789 "(dash-zip 0.26–0.32 / trap-snap 0.32 /
  chess-piece-thock 0.38)" in open item (16) — not one of the verifier's four nits; whether any F3 shutting row scores 0.32 is
  unchecked.

### Built (builder #16, fix round 4, 2026-10-29) — step 4: regression + broad probes (what the MODEL SEES); NO `src/` change (code HEAD stays `9a13e3b` + the comment-only `d30830a`)

- **Kit (scratch `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\`, not committed):** `fix4-lib.ts` — per prompt the answer of
  four versions on the REAL E3 index (fix3-lib's `loadPool`: one read, SHA-256 + mtime before / after, the pool = every entry NOT
  under `generated/` so the 4 generated entries are seen by no version, the fixture asserted = the pool's 51 audio entries
  verbatim): `788c8d2` / `09e81ea` = that matcher's top three (a miss generated — nothing shown); `7967c6f` = matches top three
  else nearest top three, from HEAD's matcher (byte-identical to `7967c6f`; `rankLibrarySounds` sorts then slices, so the full
  ranking's first three = the default call's); the fill = `selectSoundAnswer(rankLibrarySounds(pool, p, { …, limit:
  max(ANSWER_SIZE, pool) }))` with labels (the `sound-reuse.ts` :89-90 call). `compare()` per old version: answer changed (shown
  ids / order), first shown changed, a right clip LOST (old showed it, the fill does not), LOST with NO right clip left shown,
  GAINED, a confident first changed (the fill's first `[matched]` and different), WORSE (old first right, the fill's confident
  first not). Drivers `catalog-fix4.e3.test.ts` (4a), `broad-fix4.e3.test.ts` (4b); readers `fix4-analyze.cjs`,
  `fix4-analyze2.cjs`, `fix4-analyze3.cjs` (the noun-first classes below). Logs `catalog-fix4.log`, `broad-fix4.log` (each `1
  passed`).
- **4a — `E3\catalog-order-fix4.txt`** (1,073 rows = the seven corpus files' `ROWS` literals, per-file counts asserted 150 / 194 /
  204 / 129 / 132 / 67 / 197; a RIGHT clip = one the row names): **vs `788c8d2`: 577 changed · 283 first shown changed · 3 LOST · 0
  with no right clip left · 186 GAINED · 161 confident first changed · 2 WORSE. vs `09e81ea`: 483 · 208 · 3 · 0 · 120 · 100 · 3. vs
  `7967c6f`: 326 · 7 · 1 · 0 · 15 · 0 · 0.** Read: the WORSE rows are the E-d16a `edge: 'line'` rows ("a breaking screen", "a
  glitched photo", + "a typed message" vs 09e — the right clip in the three); the LOST rows each keep another right clip shown (vs
  7967c6f only "a moving transition", the recorded note; vs 788 "quickly moving air", "a running whoosh", "a popper"; vs 09e "a
  quicker whoosh", "a long whoosh", "a moving transition"); the 7 firsts changed vs `7967c6f` are a weak match first → a closest
  first on an exact tie (E-d16a's tie rule): "a scribbled note", "scribbling a note", "a scribbled note when the text appears", "a
  sketched note" → `pencil-scribble`, "a typed note" → `keys-typing-soft`, "air moving past" → `wind-soft`, "a stinging slap" ('*')
  → `sting-scare-comic`. **No row lost its last right clip against any version.**
- **Next step (a), open item (16) settled:** the shutting rows' full `7967c6f` rankings (same file, "the shutting rows" section, 34
  rows): trap-snap scores **0.3424** on "shutting down", "shutting off", "a shutting down sound"; 0.3000 (nearest) on "a door
  shutting" / "shutting the door" / "the door is shutting"; 0.2585 on "a lid / box shutting", "a shutting lid"; 0.2180–0.2468 on the
  rest. **No shutting row scores 0.32 → Status.md :789 "trap-snap 0.32" → "trap-snap 0.34" (Edit tool, this commit).**
- **4b — the broad set** (`C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\broad-probes-fix4.txt`, 4.8 MB, every probe with the four
  answers; the kit summary `E3\broad-probes-fix4-summary.txt`, 2.4 MB, = counts per version and per frame + the lists). **Frames:**
  F1 bare `<form>` · F2 "a `<form>`" · F3 "a `<form>` sound" · F4 "a soft `<form>`" (every inflection — plural, -ing, -ed, -y, the
  69-word -er list — of every base word: tag / tag hyphen-part / file-name part / category, ≥ 3 letters; 1,281 probes each) · F5 "a
  `<base>` `<opener>`" × the 7 placement openers (1,701) · F6 "right when the slide changes, a `<base>`" / "just a `<base>`" / "could
  you add a `<base>`" (729) — builder #11's frames verbatim — **plus NEW F7 participle + noun "a `<-ed form>` `<noun>`" / "a `<-ing
  form>` `<noun>`" (5,064), F8 noun + participle "a `<noun>` `<-ing form>`" (2,532), F9 adjective + verb-form "a gentle / loud /
  slow / quiet `<-ing form>`" (848; soft is F4)**; nouns = other clips' words (the candidate list ∩ the base words): screen, photo,
  message, board, device, door, page, glass, book, menu, piece, timer (note / card / window / button / phone / key / logo / tape are
  no catalog word); a RIGHT clip = a carrier of the BASE word (the noun's carriers listed, not right — the F4 shape). **243 base
  words · 15,998 probes. vs `788c8d2`: 10,330 changed · 6,769 first shown changed · 955 LOST · 880 with no carrier left · 4,690
  GAINED · 4,667 confident first changed · 1,976 WORSE. vs `09e81ea`: 8,194 · 4,988 · 88 · 22 · 3,172 · 3,471 · 1,678. vs
  `7967c6f`: 8,159 · 10 · 0 · 0 · 6,482 · 0 · 0.** Read: vs `7967c6f` the fill only ADDS (6,482 probes gain a carrier, none loses
  one, no confident first moves); its 10 first changes are a weak match first → a closest first ("a quiet appearing / firing /
  flipping / marking / moving / switching" → the verb carrier on an exact tie; "a screen firing / flipping / marking / moving" →
  `[closest] power-down 0.47` first, the verb carrier second — a closest first of another class = an E-d16 note). The LOST / WORSE
  vs the two olds are fix round 3's matcher (the same rows show at `7967c6f`); the 22 vs `09e81ea` with no carrier left are listed in
  the summary (section "vs 09e81ea — a carrier LOST with NO carrier left shown"), not classified one by one this round.
- **The noun-first class (`fix4-analyze*.cjs` over the two files) — the reason for BLOCKED (Open problems "builder #16"):** 5,709
  F7 / F8 probes whose fill first is a CONFIDENT clip carrying only the NOUN: **3,624 AT the 0.5 line** (every one with a verb carrier
  in the three — E-d16a notes; 1,648 of them had the verb carrier first at `09e81ea`: fix round 3's F3a regression, now at the line)
  and **2,085 ABOVE it (0.53–0.89)** — 2,034 with a verb carrier in the three (e.g. "a zapped device" → `[matched] power-down 0.54 |
  [closest] glitch-zap 0.28 | [closest] zap-electric 0.28`), **51 without** (all "… screen": "a sparkling / clicking / ticking /
  whooshing / snapping screen", their "a screen …-ing" forms and nonsense forms; "a sparkling screen" → `[matched] power-down 0.53 |
  [weak match] pop-reveal 0.49 | [weak match] scan-hum 0.32`, sparkle-soft not shown). Of the 2,085 only **24** had a verb carrier
  first at `09e81ea` — all "a longed / longing `<noun>`" nonsense (a 0.50 tie there); of the 51, **none** (e.g. "a clicking screen"
  → `power-down 0.82` at both olds). Every one of these answers has the same first at `7967c6f`.

### Built (builder #17, fix round 4, 2026-10-29) — item 1: the E-d16b word-diversity rule, commit `c5a6124`

- **The rule (`src/main/services/library/sound-answer.ts`, 75 → 96 lines; lines as of `c5a6124`):** `selectSoundAnswer(ranking,
  prompt)` :77-96 (the prompt is a NEW required argument) — the confident rows (coverage ≥ 0.5, the matcher's order, ≤ 3) first; the
  below-threshold rows (weak + closest, sorted by E-d16a's `byCoverageClosestFirst` as before) then go through `newWordsFirst`
  :64-75: **group A = the below rows that cover a prompt word NO SHOWN confident row covers, then group B = the rest, each group
  keeping E-d16a's order** (coverage, a closest before a weak match on a 1e-9 tie, the matcher's order within a label). Early exit
  (stated, equivalent): no confident row shown → E-d16a's order (every scoring row covers some word, so group A = all); three shown
  → no slot left. The header comment :1-21 states the rule. Callers: `agent-tools/sound-reuse.ts:90` and
  `sound-match-corpus-rows.ts:83` now pass the prompt (one line each).
- **"Covers a word" (NEW `src/main/services/library/sound-answer-words.ts`, 39 lines) — the exact rule, stated in its header
  :7-13:** the prompt's words = `promptTerms(prompt).terms` (head + qualifiers; the placement words — `bonus` — excluded; negated
  words already dropped by `soundTokens`); an entry covers a word when `matchStrength(word, token) > 0` for a token of its tags,
  file-name parts, category or description, tokenized as `sound-match.ts` `fieldsOf` does — ANY field, ANY strength; exactly when
  the matcher's `hitOf` weight is > 0, i.e. the word adds to that entry's coverage. `promptSoundWords` :19-21, `wordsCoveredBy`
  :35-39 (the field reading :24-32 is the stated duplication — the matcher does not export `fieldsOf`).
- **Why "any field" and not "strong fields only" — the definition experiment (kit, not shipped):** `E3\fix4b-lib.ts`
  `variantFill()` + `E3\variants-fix4b.e3.test.ts` → `E3\variants-fix4b.txt` (log `variants-fix4b.log`, 1 passed, 139.66 s; index
  SHA-256 `876f9f61…6c95` / mtime `2026-10-28T22:31:02.584Z` before = after): over builder #16's 15,998 broad probes, three readings
  of "covers" — **any** (any field, both sides): changed vs `34feafe` 63 · right LOST vs `7967c6f` 0 · right LOST vs `34feafe` 0 ·
  confident first moved 0 · noun-first above 0.5 with NO right clip in the three **9** (`34feafe`: 51); **strong** (tag / name /
  category, both sides): 125 · 0 · **6** · 0 · **0**; **asym** (shown rows strong, candidates any): 142 · 0 · **35** · 0 · 0. The
  strong reading's 6 losses vs `34feafe` are all F4 "a soft `<form>`" ("a soft digitaling / digitaled / failing / failed /
  paperring / paperred" → glitch-zap / break clips / pencil-scribble replaced by `whoosh-soft` / `impact-soft` 0.18–0.19): "soft"
  is in the confident clip's description but in no tag, so the ten "-soft" FILE NAMES become group A (71 F4 answers trade a real
  candidate for a "-soft" stranger, e.g. "a soft appear" loses chime-magic 0.40). **Chosen: any** (= Hasan's example rule, the
  matcher's own coverage sense, no loss anywhere). The 9 it leaves are listed in Open problems "builder #17".
- **Tests:** `sound-answer.test.ts` 89 → 158 (the 10 old tests now pass the prompt — `''` = no words = E-d16a's order; NEW describe
  "the word-diversity rule (E-d16b)", 7 tests: the diversity order on the "a sparkling screen" shape (vs E-d16a alone and vs a
  prompt with no uncovered word), a description hit covers (the "a clicking screen" limit), a tie inside each group, confident rows
  untouched (two + three), all words covered = E-d16a's order, no confident row = E-d16a's order, placement words never count). NEW
  `sound-answer-words.test.ts` (53 lines, 3 tests: the prompt words; per-field cover on the real fixture — power-down `screen`,
  pop-reveal `sparkling` + `screen` via its description, sparkle-soft `sparkling`, flame-snuff's negated "no whoosh" covers nothing;
  **the duplication pinned against the matcher**: over 15 prompts × every candidate of the class, `covers ≥ 1 word` ⇔ the ranking
  scores the clip). `audio-tools-fill.test.ts` 184 → 204 (2 tests through the REAL handler): "a sparkling screen" → `matched
  power-down | weak match pop-reveal | closest sparkle-soft` (header "… 3 shown: 1 matched, 1 weak match, 1 closest:"); "a whooshing
  screen" → `matched power-down | closest whoosh-soft | closest whoosh-reverse`; "a clicking screen" → `matched power-down | weak
  match pop-reveal | weak match scan-hum` pinned as the stated limit. **No existing pin changed** ("a breaking screen", "a moving
  transition", "a soft knocking", the reuse / miss tests all unchanged — the rule only reorders the below rows when a confident row
  leaves a word uncovered).
- **NO matcher change:** `git diff 7967c6f -- src/main/services/library/sound-match.ts src/main/services/library/sound-match-words.ts
  src/main/services/library/sound-match-vocab.ts | wc -c` → `0` (as of `c5a6124`).
- Kit (scratch, not committed): `E3\sound-answer-34f.ts` (= `git show 34feafe:…/sound-answer.ts`, blob `94e847db…`, import path
  only changed — the `34feafe` column), `E3\fix4b-lib.ts` (fix4-lib + the `34feafe` column + HEAD called with the prompt +
  `variantFill`), `E3\variants-fix4b.e3.test.ts`; **prepared, NOT run:** `E3\catalog-fix4b.e3.test.ts` /
  `E3\broad-fix4b.e3.test.ts` (= builder #16's drivers with `VERSIONS` / `answers` from `fix4b-lib` — four old columns incl.
  `34feafe` — writing `E3\catalog-order-fix4b.txt`, `…\vidtsx-e2e\E3\broad-probes-fix4b.txt`, `E3\broad-probes-fix4b-summary.txt`).

### Built (builder #18, fix round 4, 2026-10-29) — item 2: the fix4b re-run (catalog + broad) at `c5a6124`; NO `src/` change

- **Both drivers green, the E3 index untouched** (each report's lines 1-2: 61 entries, the pool 57 without `generated/`, 51 audio =
  the fixture verbatim; SHA-256 `876f9f61…6c95` / mtime `2026-10-28T22:31:02.584Z` before = after — UNCHANGED).
- **Catalog — `E3\catalog-order-fix4b.txt`** (1,073 rows, per-file 150 / 194 / 204 / 129 / 132 / 67 / 197; :4-7): **vs `788c8d2`**
  580 changed · 283 first · 4 LOST · 0 none left · 186 GAINED · 161 confident first changed · 2 WORSE; **vs `09e81ea`** 487 · 208 · 4 ·
  0 · 120 · 100 · 3; **vs `7967c6f`** 329 · 7 · **2 LOST · 0 none left** · 15 · **0** · 0; **vs `34feafe`** 10 · 0 · **1 LOST · 0
  none left** · 0 · **0** · 0. The edge rows hold (the "worse" list vs `7967c6f` is empty; "a breaking screen" → `[matched]
  power-down 0.50 | [closest] break-crash-digital 0.30 | [closest] break-glass-crack 0.30`; "a glitched photo" → glitch-zap 2nd; "a
  typed message" → keys-typing-soft 2nd). **The 2 LOST vs `7967c6f`** (builder #16 had 1): "a moving transition" (whoosh-wind out,
  whoosh-soft first — the recorded note) and NEW **"a sucking whoosh before the reveal"** (= the 1 LOST vs `34feafe`): `[matched]
  whoosh-reverse 0.60 | [closest] pop-reveal 0.21 | [closest] impact-deep-soft 0.21` (was `whoosh-reverse | whoosh-soft 0.30 |
  whoosh-wind 0.30`). **Justified by the rule, not a regression:** `E3\why-fix4b.txt` (scratch `why-fix4b.e3.test.ts`, the HEAD helpers
  on the fixture) — prompt words `[sucking, whoosh, reveal]` ("before the reveal" is not a placement opener here, so `reveal` is a
  word); whoosh-reverse covers `sucking + whoosh`, pop-reveal / impact-deep-soft cover `reveal`, whoosh-soft / whoosh-wind only
  `whoosh` → E-d16b's group A = the two `reveal` clips. A right clip (whoosh-reverse) stays FIRST and confident; under the bar = a
  "stranger in the three" NOTE. **The brief's "LOST must be 0 vs `7967c6f`" holds for the BROAD set (below) — not for the catalog,
  where it was already 1 at builder #16 and is 2 now, both with a right clip left (none-left 0).** The other 9 rows changed vs
  `34feafe` (:4880-4923, all read): the below rows reorder only — a clip covering a word the confident first misses moves up ("a knock
  before the door opens" → ui-click-soft 0.10 covers `opens`; "wind blowing through the trees" → flame-snuff covers `blowing`; "a
  gentle stream of running water" → dash-zip `running`; "a soft knocking at the door" → whoosh-soft / impact-soft `soft`; …); no
  first moved, no right clip lost.
- **Broad — `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\broad-probes-fix4b.txt`** (4,812,692 bytes; summary
  `E3\broad-probes-fix4b-summary.txt` 2,430,651 bytes; :3-7): builder #16's frames verbatim (F1 bare · F2 "a w" · F3 "a w sound" · F4
  "a soft w" — 1,281 each · F5 the 7 placement openers 1,701 · F6 leading adverbs / wrappers 729 · F7 participle + noun 5,064 · F8 noun +
  participle 2,532 · F9 "a gentle / loud / slow / quiet `<-ing>`" 848); 243 base words, 12 nouns, **15,998 probes**. **vs `788c8d2`**
  10,350 changed · 6,769 first · 941 LOST · 866 none left · 4,718 GAINED · 4,667 conf · 1,976 WORSE; **vs `09e81ea`** 8,218 · 4,988 ·
  73 · 8 · 3,200 · 3,471 · 1,678; **vs `7967c6f`** 8,196 · 10 · **0 · 0** · 6,524 · **0** · 0; **vs `34feafe`** **63** · 0 · **0 ·
  0** · 42 · **0** · 0. **Every number builder #17's experiment predicted holds** (`E3\variants-fix4b.txt:2` "any": 63 changed vs
  `34feafe`, 0 LOST vs either, 0 confident first moved, 9 left). The noun-first class (summary :56): **5,709** probes, "right in the
  three: true" 5,700 / **false 9** = exactly E-d16c's list ("a clicked / clicking screen", "a screen clicking", "a softed / softing
  screen", "a screen softing", "a warmed / warming screen", "a screen warming" — power-down's own text carries the verb word, so the
  rule cannot fire). Vs builder #16's step 4 (`34feafe`): `7967c6f` GAINED 6,482 → 6,524; `09e81ea` none-left 22 → 8; `788c8d2`
  none-left 880 → 866.
- **The 63 changed vs `34feafe`, all read** (scratch `E3\broad34-fix4b.e3.test.ts` = the broad driver listing every probe changed
  vs `34feafe` → `E3\broad-probes-fix4b-34f-summary.txt`, extracted to `E3\broad34-read.txt`): **48 = 16 bases × "a `<-ed>` screen" /
  "a `<-ing>` screen" / "a screen `<-ing>`"** (air, fast, foley, motion, out, paper, piano, reward, single, snap, solid, sparkle, tail,
  texture, tick, whoosh) — the E-d16b fix: the verb's carrier now in the three after the confident power-down (e.g. "a whooshing
  screen" → `power-down 0.55 | whoosh-soft 0.27 | whoosh-reverse 0.27`, was `| pop-reveal | scan-hum`); 42 GAINED a carrier, the 6
  "reward" / "solid" ones already showed it and only reorder. **15 = F4 "a soft `<form>`"** (break ×3, comic ×2, crunch ×2, electric ×2,
  knock ×3, solid ×3): the confident clip covers the verb but not `soft`, so a "-soft" file (whoosh-soft / impact-soft 0.16–0.18) takes
  the slot a second verb clip had — e.g. **"a soft crunching" → `crunch-bite 0.50 | whoosh-soft 0.16 | impact-soft 0.16`** (was `|
  break-crash-digital 0.30 | whoosh-soft`), "a soft knock" → chess-piece-thock 0.49 replaced by whoosh-soft 0.18. The right clip stays
  first in all 15 (the "a soft crunching" side effect — a NOTE: a stranger in the three).
- **The 8 vs `09e81ea` with no carrier left (summary :8367-8392), classified:** 2 are E-d16c's ("a screen clicking", "a screen
  warming"); **6 are F9 "a quiet `<-ing>`"** ("a quiet airing / emphasising / singling / snapping / tailing / warming") — NONE is lost vs
  `7967c6f` (fix round 3's matcher, not the fill): `quiet` is a word five clips' text carries (clock-tick-soft, keys-typing-soft,
  scan-hum, flame-snuff, owl-hoot — all nearest at 0.31–0.36), the verb's carrier 6th at 0.25–0.29 (`E3\why-fix4b.txt` "RANK" lines:
  "a quiet snapping" → `clock-tick-soft 0.31 | keys-typing-soft 0.31 | scan-hum 0.31 | flame-snuff 0.31 | owl-hoot 0.31 | ui-click-soft
  0.29 | ui-send 0.29 | trap-snap 0.29`; "a quiet warming" → warm-shimmer 0.25 6th). No confident row is shown, so E-d16b does not apply;
  NO matcher change (E-d16 / E-d16c) → recorded as an open note: **"a quiet snapping" / "a quiet warming" are plausible phrasings — a
  verifier could read them as bar (ii)** (they were in builder #16's 22 too, at `34feafe`; the fill did not cause them).

### Built (builder #19, fix round 4, 2026-10-29) — E-d16d items 1–2: the GREEDY experiment → NOT kept (the fallback); NO `src/` change (code stays `c5a6124`)

- **The variant (kit only, never in `src/`):** `E3\sound-answer-greedy.ts` = `sound-answer.ts` at `c5a6124` with `newWordsFirst`
  replaced by `greedyFill` — after the confident rows (≤ 3, the matcher's order) the slots are filled ONE AT A TIME: among the
  remaining below-threshold rows (weak + closest, in E-d16a's order: coverage, a closest before a weak match on a 1e-9 tie), the first
  that covers a prompt word NO already-shown row (confident OR an earlier pick) covers; none → E-d16a's next. No confident row → the
  first slot is E-d16a's top. "Covers" = the SHIPPED `sound-answer-words.ts` (`promptSoundWords` / `wordsCoveredBy`: any field, any
  strength, `promptTerms(prompt).terms`) imported unchanged. Same exports as the shipped module.
- **The driver:** `E3\variants-fix4c.e3.test.ts` — the 1,073 corpus rows (the seven files' `ROWS`, read as `catalog-fix4b` does; a
  right clip = one the expected string names) AND builder #16's 15,998 broad probes (frames F1–F9 generated verbatim as
  `variants-fix4b` does; a right clip = a carrier of the base word); per row the `7967c6f` answer, the shipped fill `c5a6124` (HEAD,
  via `fix4b-lib.answers`) and the greedy fill. **Report `E3\variants-fix4c.txt`** (374,932 bytes, every changed row inline — under
  1 MB, so nothing went to C:): :1-2 the index — 61 entries, the pool 57 without `generated/`, 51 audio = the fixture verbatim; SHA-256
  `876f9f61…6c95` / mtime `2026-10-28T22:31:02.584Z` before = after, **UNCHANGED**; :3-4 the counts; :7-12 the six quiet probes.
  The READ: `E3\variants-fix4c-read.txt` (180 lines, by awk from the report: the 30 corpus rows ids-only, the 895 broad per frame and as
  removed → added patterns, the 96 broad rows with a clip swapped per probe).
- **Corpus (1,073) — `variants-fix4c.txt:3`:** answers changed vs `c5a6124` **30** · right clip LOST vs `c5a6124` **5** (all with
  another right clip still shown: "a taking off whoosh" whoosh-soft → chess-piece-capture; "a whoosh going down" whoosh-reverse →
  party-popper; "a moving whoosh" whoosh-wind → chess-piece-thock; "a wind blowing softly" / "the wind is blowing softly" wind-soft →
  riser-soft) · right LOST vs `7967c6f` **5** — **3 NEW** ("a moving whoosh" whoosh-wind, "a wind blowing softly" / "the wind is
  blowing softly" wind-soft) + the 2 `c5a6124` already had ("a sucking whoosh before the reveal", "a moving transition") · GAINED 0 ·
  first moved 0 · **confident first moved 0** · recall false (right clip not in the three) greedy **0** / `c5a6124` 0.
- **The 7 corpus files run WITH the greedy selection:** `E3\vitest.e3-greedy-corpus.config.ts` (root = the worktree, include
  `src/main/services/library/sound-match-corpus*.test.ts`, alias `^\./sound-answer$` → the kit's greedy file; nothing in the worktree
  changes) → **7 files passed / 1,080 tests passed** (1,073 rows + 7 count tests); the alias proven by the module's own marker
  `E3\greedy-loaded.txt` (deleted before, written 12:05:53 by that run). **The corpus stays green** — its rows check recall in the
  three, and every lost clip above left another right clip shown.
- **Broad (15,998) — `variants-fix4c.txt:4`:** answers changed vs `c5a6124` **895** (F4 21 · F7 534 · F8 268 · F9 72; **799 are pure
  reorders of the same three clips**, 96 swap a clip) · right LOST vs `c5a6124` **56** — **6 with NO right clip left**: "a outed / outing
  screen", "a screen outing" (whoosh-wind → pop-reveal) and **"a sparkled / sparkling screen", "a screen sparkling" (sparkle-soft →
  scan-hum — E-d16b's own target undone: pop-reveal's DESCRIPTION covers "sparkling", so once it is shown no clip adds a new word and
  E-d16a's next, scan-hum, takes the slot)**; the other 50 keep a right clip (F7 / F8 "… screen" second carriers — whoosh-reverse,
  chime-magic, ui-send, camera-shutter, clock-tick-soft, keys-typing-soft, pencil-scribble, piano-c-maj, whoosh-data-burst — and F4 / F9
  "a soft / gentle / quiet `<-ing>`" second carriers replaced by a "-soft" file or clock-tick-soft) · right LOST vs `7967c6f` **20, all
  NEW** (`c5a6124`: 0) — F4 / F9: "a soft / gentle / quiet brokening", "a soft brokened" (crash-tumble), "a gentle / quiet digitaling"
  (whoosh-data-burst), "a gentle / quiet failing" (break-glass-crack), "a quiet impacting" (launch-thump), "a soft / gentle / quiet
  majing", "a soft majed" (piano-g-maj), "a quiet motioning" (whoosh-wind), "a soft / gentle / quiet pianoing", "a soft pianoed"
  (piano-f-maj), "a quiet rewarding" (warm-shimmer), "a quiet whooshing" (whoosh-wind) · GAINED **6** (= the six quiet probes) · first
  moved 0 · **confident first moved 0** · noun-first "right in the three: false" greedy **15** / `c5a6124` 9 (+ "a outed / outing
  screen", "a screen outing", "a sparkled / sparkling screen", "a screen sparkling").
- **The six F9 "a quiet `<-ing>`" probes (`variants-fix4c.txt:7-12`): all six FIXED by greedy** (a carrier 2nd, e.g. "a quiet
  snapping" → `clock-tick-soft 0.31 | ui-click-soft 0.29 | keys-typing-soft 0.31`, "a quiet warming" → `… | warm-shimmer 0.25 | …`).
- **The decision (E-d16d's rule, binding): greedy is NOT kept.** It moves no confident first and the corpus stays green, but it LOSES
  right clips vs `c5a6124` (corpus 5, broad 56 — 6 with none left) and vs `7967c6f` (corpus 3 NEW, broad 20 NEW). So: NO code change,
  `c5a6124` stays, the experiment is recorded here, and **the six F9 "a quiet `<-ing>`" probes ("a quiet airing / emphasising /
  singling / snapping / tailing / warming") are NOTES for verifier round 5 (E-d16d's fallback)**. Builder #18's gates and `wt/out`
  build stand (no `src/` change since `c5a6124`).

### Built (builder #20, fix round 4, 2026-10-29) — E-d16d item 3: the records, commit `dbe935a`; NO `src/` change (code stays `c5a6124`)

- **`Status.md` E3 entry (:10-1111 as of `dbe935a`; Edit tool only):** title :10 → "… DONE (fix round 4 after verifier round 4
  FAIL on F4 (builders #13–#20, decisions E-d16 + E-d16a + E-d16b + E-d16c + E-d16d: the answer-level recall fill with the
  word-diversity rule, no matcher change); fix round 3 …; the E3 verifier round 5 — E3's last — is next)"; NEW bullet :425-602
  "**Verifier round 4 FAIL (F4 …) → fix round 4 `34feafe` `9a13e3b` `d30830a` `c5a6124`.**" — F4, E-d16 / a / b / c / d one or
  two sentences each, then sub-items: the fill (pointers as of `c5a6124`, the exact header / row / last-line strings from
  `sound-reuse.ts` :37-68), E-d16b's rule + how "covers" is decided (`sound-answer-words.ts` :7-13), the tests red → green per
  builder (from the logs), the corpus (67 + 197 rows, red 36 / 266, the edge + vocabulary rows, recall misses 0 of 1,073), the
  record fixes (`d30830a`, `2d04e9a`), step 4 (both report files, the nine frames listed, the noun-first class), the definition
  experiment's three-way table, the fix4b re-run (both reports, the 63 read), the greedy experiment NOT kept, gates / build /
  matcher proof, the code + `wc -l`, E-d16's bar in one sentence with the a / b / c / d notes. Current-state parts updated (they
  described `7967c6f`): "The code" opening (`src/` last changed in `c5a6124`; "every commit after `c5a6124` is docs"), the
  `sound-reuse.ts` item (95 since `34feafe`, the old pointers marked history), the prompt :31 quote (the wording until
  `34feafe`), the `wt/out` line ("Rebuilt at `c5a6124`" — 11:54:37, markers 1 / 1 / 3), a NEW "Gates (fix round 4, builder
  #18 …)" bullet (the round-3 one renamed "Gates, fix round 3 (history; …)"); Not measured (9) line counts, NEW items (24)
  verifier round 4's notes 1–10, (25) the noun-first class, (26) the 9, (27) "a moving transition" / "a sucking whoosh before
  the reveal", (28) "a soft crunching", (29) the six F9 "a quiet `<-ing>`", (30) music "may have", (31) the 10 broad first
  changes, (32) stated choices / kit facts; the "For Hasan" line ("the right clip is first in it" → SECOND in four of seven,
  `[closest]` since fix round 4).
- **`docs/studio/TESTING.md` §18.17 (:524-541 as of `dbe935a`):** the material line :525 (fix round 4's commits and scope; `src/`
  as of `c5a6124`; `wt/out` rebuilt at `c5a6124` too); NEW item :534 "**Verifier round 4 FAIL (F4 …) → fix round 4 …**" (the same
  substance, shorter); the Gates item :540 → fix round 4's counted run first ("Earlier, fix round 3 …" kept); the Not-measured
  item :541 + "Fix round 4 notes".

## Verified (exact commands + outputs)

### builder #20 (the records, 2026-10-29 12:16–12:27) — no launch, no model call, no gate run, no `src/` change

- Every number in the records re-opened in its evidence file (worktree root, Bash): the header lines of `E3\catalog-order-fix4.txt`
  (:1-6), `E3\broad-probes-fix4-summary.txt` (:1-6; "right in the three: false" `grep -c` 51; :46 = 5,709), `E3\variants-fix4b.txt`
  (:1-4), `E3\catalog-order-fix4b.txt` (:1-7), `E3\broad-probes-fix4b-summary.txt` (:1-7; the per-frame counts 1,281 ×4 / 1,701 /
  729 / 5,064 / 2,532 / 848; `grep -c` "right in the three: false" 9, the nine listed; :56 = 5,709), `E3\variants-fix4c.txt` (:1-12),
  `E3\variants-fix4c-read.txt` (:33-38 — F4 21 / F7 534 / F8 268 / F9 72, 799 reorders), `E3\broad34-read.txt` (189 lines = 63
  probes; 48 "screen", 15 "a soft"), `E3\why-fix4b.txt` ("a sucking whoosh" words), `E3\fix4-corpus-review.txt:2` (kept 264,
  duplicates 45), the shutting rows of `catalog-order-fix4.txt` (trap-snap 0.3424 ×3, no 0.32); the test logs' `Test Files` /
  `Tests` lines (`fix4-red`, `fix4-green-2`, `fix4-corpus-red`, `-try1`, `-green`, `-green-2`, `fix4b-red`, `fix4b-green`,
  `fix4b-corpus`, `catalog-fix4b`, `broad-fix4b`, `variants-fix4c`, `corpus-greedy-fix4c`); the gates (`cpu-fix4.txt`,
  `vitest-full-fix4.log` — 3 / 508 / 5 (516), 9 / 5,394 / 35 (5,438), 63.53 s, `Start at` 11:51:35, 0 "timed out", the 9 FAIL
  lines = the 3 E-d2a suites; `diff-list-fix4.txt` 106 = 105 `src/` + 1; `import-graph-fix4.txt` 4 × NONE; tsc 26 / 10, 0 E3 lines;
  `build-fix4.log` the three "✓ built in" lines, 0 warn / error lines outside "use client"); the source strings (`sound-reuse.ts`
  :25-95, `sound-answer.ts` :44-96, `sound-answer-words.ts` :1-21) and the r4 rows (`edge:` 3 line + 1 tie, 4 "vocabulary note"
  rows, 67 / 197 rows); `wc -l` of the 15 code / test files; `git show --stat` of the four fix-round-4 commits.
- `git diff --stat` before the commit → `Status.md | 288 ++++…` and `docs/studio/TESTING.md | 7 +-` (2 files, 275 insertions, 20
  deletions); `git add Status.md docs/studio/TESTING.md` + commit → **`dbe935a`** (12:22:36).
- **Re-checked AFTER `dbe935a`:** `git log -1 --format=%h -- src/` → `c5a6124`; `git diff --stat c5a6124..HEAD -- src/ scripts/ |
  wc -l` → `0`; `git diff --name-only 5d77600..HEAD -- src/ scripts/ | wc -l` → `106` (unfiltered 122); `git diff 7967c6f --
  src/main/services/library/sound-match.ts src/main/services/library/sound-match-words.ts
  src/main/services/library/sound-match-vocab.ts | wc -c` → `0`; `out/main/index.js` mtime `2026-10-29 11:54:37` > `c5a6124`'s
  `11:36:59 +0200`; `grep -c` in it: "The library may have a sound for" 1, "No library sound matched" 1, "PLACEMENT_BONUS" 3;
  `sound-answer.ts` + `sound-answer-words.ts` + `sound-reuse.ts` = 96 + 39 + 95 (230). Every "as of `2102dbf`" statement in the
  records holds at `dbe935a` — none falsified, none changed. Tree after: clean but this HANDOFF / LOG.

### builder #19 (E-d16d items 1–2, 2026-10-29 12:03–12:15) — no launch, no model call, no `src/` change (HEAD `e3bcfdf`, `src/` = `c5a6124`)

- From the worktree root (`unset ELECTRON_RUN_AS_NODE`): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config
  D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/E3/vitest.e3.config.ts variants-fix4c > E3\variants-fix4c.log` → `Test Files 1 passed
  (1) · Tests 1 passed (1)`, Start 12:05:39, 136.83 s, rc=0 (the driver asserts the index SHA / mtime unchanged).
- `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config
  D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/E3/vitest.e3-greedy-corpus.config.ts > E3\corpus-greedy-fix4c.log` (marker deleted
  first) → `Test Files 7 passed (7) · Tests 1080 passed (1080)`, Start 12:05:53, 2.64 s, rc 0; `E3\greedy-loaded.txt` = `loaded
  2026-10-29T10:05:53.997Z` (= 12:05:53 local, this run). (A first corpus run at 12:05:39 overlapped the driver's start, so its marker
  could not be attributed — the re-run alone is the counted one; both 7 / 1,080 green.)

### builder #18 (item 2, 2026-10-29 11:41–11:50) — no launch, no model call, no `src/` change (HEAD `bedcff8`, `src/` = `c5a6124`)

- From the worktree root: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config
  D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/E3/vitest.e3.config.ts catalog-fix4b > E3\catalog-fix4b.log` → `1 passed`, 8.30 s
  (Start 11:41:51), exit 0; `… broad-fix4b > E3\broad-fix4b.log` → `1 passed`, 146.43 s (Start 11:42:06), exit 0; `… broad34-fix4b >
  E3\broad34-fix4b.log` → `1 passed` (11:47–11:49); `… why-fix4b --silent=false --reporter=verbose | grep WHY\|RANK > E3\why-fix4b.txt`
  → `Tests 2 passed`. Numbers in Built "builder #18" are the report lines cited there.
- Resources before (11:41): C: 51.9 GB free, memory commit headroom 29.1 GB, `electron.exe` 0.

### builder #18 (item 3, the gates, 2026-10-29 11:50–11:54) — no app running, `src/` = `c5a6124` (docs HEAD `1535ba7`)

- **CPU first** (`powershell -File E3\cpu-fix4.ps1` → `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\cpu-fix4.txt`, 11:50:57): 16
  logical cores; `Win32_Processor LoadPercentage` 32 / 39 (before / after the 5 s window); per-process CPU over 5 s, sum **48.22 %** of
  all cores — `brave` 20.04 %, `MsMpEng` 6.97 %, `chrome` 3.61 %, `vmmemWSL` 2.58 %, `WmiPrvSE` 2.42 %, `System` 1.7 %, the rest ≤ 1.23 %.
  **Guard:** C: 51.8 GB free, D: 43 GB, memory commit limit 99.7 GB / headroom 25.8 GB (C: + headroom 77.6 GB ≥ 6; headroom ≥ 10 →
  default workers); `electron.exe` 0; `%TEMP%\vidtsx-studio\export` absent. Moderate external load (a browser) → DRIVING's NORMAL
  load rule first (default workers), E-d13 only if it could not be met — it was met on the first run.
- **Full worktree vitest** (`bash E3\vitest-full-fix4.sh C:\…\vidtsx-e2e\E3\vitest-full-fix4.log` in the background — `cd <wt>; unset
  ELECTRON_RUN_AS_NODE; node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run`): **run 1 = the COUNTED run** (start 11:51:34
  HEAD `1535ba7` / `Start at` 11:51:35, end 11:52:39 rc=1) → **`Test Files 3 failed | 508 passed | 5 skipped (516)` · `Tests 9 failed |
  5394 passed | 35 skipped (5438)` · 63.53 s, 0 "timed out"**; the 3 files / 9 tests = `builder-libraries` 1 (`@remotion/paths
  (builder-libraries.ts) is not installed`), `shot-bundle` 5 (`Could not resolve` roughjs / @remotion/shapes / @react-three/fiber /
  chroma-js / @remotion/google-fonts/SpaceGrotesk), `shot-bundle-in-place` 3 (`Could not resolve "chroma-js"` + the assertions quoting
  it) — the three E-d2a suites, resolution only; no other FAIL line. **Gate MET under DRIVING's normal rule (default workers, first
  try) — not E-d13.** (Totals vs fix round 3's 511 / 5,141: + the r4 corpus files and the answer / words / fill tests.)
- **Rule (b)** at `src/` = `c5a6124`: `git diff --name-only 5d77600..HEAD -- src/ scripts/ > E3\diff-list-fix4.txt` → **106 paths (105
  `src/`, 1 `scripts/`)**; the unfiltered `git diff --name-only 5d77600..HEAD` = 122; `node
  C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\import-graph.cjs <wt> E3\diff-list-fix4.txt > E3\import-graph-fix4.txt` → rc 0:
  `builder-libraries.test.ts: 2 local modules … NONE` · `shot-bundle.test.ts: 15 … NONE` · `shot-bundle-in-place.test.ts: 23 …
  (vi.mock'd, not loaded: shot-generator.ts, shot-import-land.ts, media-import.ts) … NONE` · `scripts/builder-unpack.mjs: 1 … NONE`.
- **Types** at `c5a6124`: `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit >
  C:\…\vidtsx-e2e\E3\tsc-web-fix4.log` → rc 2, **26** `error TS`; `-p tsconfig.node.check.json` → `tsc-node-fix4.log` rc 2, **10**; 0
  lines name `sound-` / `audio-tools` / `library-listing` (11:53:00 → 11:54:02).
- **NO matcher change:** `git diff 7967c6f -- src/main/services/library/sound-match.ts src/main/services/library/sound-match-words.ts
  src/main/services/library/sound-match-vocab.ts | wc -c` → `0`; `git diff --name-only c5a6124..HEAD -- src/ scripts/` → empty (as of
  `1535ba7`). The last `src/` commit: `c5a6124` 2026-10-29 11:36:59 +0200.

### builder #18 (item 4, the rebuild, 2026-10-29 11:54–11:57) — `wt/out` at `src/` = `c5a6124`

- 0 `electron.exe`, C: 51.8 GB free first; from the worktree root: `unset ELECTRON_RUN_AS_NODE; export
  NODE_OPTIONS=--max-old-space-size=8192; node D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build >
  D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\build-fix4.log 2>&1` (11:54:14 → 11:57:38) → **rc 0**, main "✓ built in 12.69s",
  preload "245ms", renderer "✓ built in 2m 59s"; `grep -i "warn\|error" | grep -v "use client"` → nothing. `out/main/index.js`
  **2026-10-29 11:54:37** (3,067,635 bytes), `out/renderer/index.html` 11:57:36 — both AFTER `c5a6124` (11:36:59). In
  `out/main/index.js`: `The library may have a sound for` **1**, "No library sound matched" **1**, "PLACEMENT_BONUS" **3**. Tree after:
  only `HANDOFF.md` (mine) and `ORCHESTRATOR.md` (the orchestrator's uncommitted E-d16c edit — never staged) modified.

### builder #17 (item 1, 2026-10-29 11:25–11:37) — no launch, no model call

- RED (the new tests on `acb7ce8`'s code): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  src/main/services/library/sound-answer.test.ts src/main/services/library/sound-answer-words.test.ts
  src/main/services/studio/agent-tools/audio-tools-fill.test.ts` → `Test Files 3 failed (3) · Tests 6 failed | 21 passed (27)`
  (`sound-answer-words.test.ts` cannot load: `Cannot find module './sound-answer-words'`) — log `E3\fix4b-red.log`.
- GREEN: the two answer tests + `src/main/services/studio/agent-tools/` → `Test Files 17 passed (17) · Tests 99 passed (99)` (log
  `E3\fix4b-green.log`); `… vitest.mjs run src/main/services/library/` (the 7 corpus files incl.) → `Test Files 37 passed (37) ·
  Tests 1386 passed (1386)`, 6.74 s (log `E3\fix4b-corpus.log`).
- `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.node.check.json --noEmit` → 10 `error TS` (the
  baseline), none in a `sound*` / corpus file (log `E3\fix4b-tsc-node-step1.log`).
- The experiment: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config
  D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/E3/vitest.e3.config.ts variants-fix4b` (from the worktree root) → `1 passed`; the
  counts in Built "builder #17" are `E3\variants-fix4b.txt:2-4`.

### builder #16 (step 4, 2026-10-29 11:05–11:15) — no launch, no model call, no `src/` change

- `git diff 7967c6f -- src/main/services/library/sound-match.ts src/main/services/library/sound-match-words.ts
  src/main/services/library/sound-match-vocab.ts | wc -c` → `0` (as of `f1fe772`; this commit touches docs only).
- Index stamps (bash `sha256sum` + `stat`, before / after both drivers): `876f9f611c2704eb1980502bb8d9e44c79ef899957586af4bb10c86545c16c95`,
  mtime `2026-10-29 00:31:02.584` (+0200) — unchanged; the drivers' own header lines say the same ("UNCHANGED", 61 entries, 57
  without `generated/`, 51 audio = the fixture, the 4 `generated/` entries excluded).
- From the worktree root: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config
  D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/E3/vitest.e3.config.ts catalog-fix4` → `1 passed`, 7.36 s; the same with
  `broad-fix4` → `1 passed`, 114.62 s. Numbers above are copied from the two files' header lines.
- `node fix4-analyze.cjs broad-probes-fix4-summary.txt` → `rows 5709`, `F7 at0.50 right-in-3:true 2413`, `F8 at0.50 … 1211`, `F7
  >0.50 right-in-3:false 34`, `F8 … 17`, `F7 >0.50 right-in-3:true 1356`, `F8 … 678`; `node fix4-analyze3.cjs
  C:/Users/hasan/AppData/Local/vidtsx-e2e/E3/broad-probes-fix4.txt` → `{ total: 5709, over: 2085, at: 3624, r09: 1672, r788: 1961,
  rboth: 1320, overR09: 24, overNoRight: 51, overNoRightR09: 0 }`.

- **Fix round 4, builder #15 (2026-10-29 10:59–11:03, step 3; worktree root; HEAD `023b7b3` → `d30830a`):** Edit tool only;
  `git diff --stat` before the commit → `Status.md | 19 ++++++++++++-------`, `docs/studio/TESTING.md | 4 ++--`,
  `.../library/sound-match-corpus-r3-ordinary.test.ts | 2 +-` (3 files, 15 insertions, 10 deletions); after:
  `grep -n -o 'trap-snap 0.3[0-9][^,;]*\|build / build-up\|says build-up\|power-down 0.4[0-9]\|whooshes at 0.[0-9]*' Status.md
  docs/studio/TESTING.md` → only true values plus :789 (above); `git diff 7967c6f -- src/main/services/library/sound-match.ts
  src/main/services/library/sound-match-words.ts src/main/services/library/sound-match-vocab.ts | wc -c` → **`0`** (as of
  `d30830a`). No test run (a comment-only `src/` change); no gate, no build, no launch, no model call.

- **Fix round 4, builder #14 (2026-10-29 10:48–10:56, step 2; worktree root; HEAD `8fb6416` → `9a13e3b`):**
  - Kit: `FIX4_WRITE=1 node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config
    D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/E3/vitest.e3.config.ts fix4-corpus > E3/fix4-corpus.log` → **1 passed (1)**;
    `fix4-corpus-review.txt` line 1-2: "g 32 / c 236 / f 41 parsed", "kept 264 (g 32, f 35, c 197); duplicates …: 45"; **"LESS rows:
    1"** — "a moving transition" (expected `whoosh-soft|whoosh-wind`): 7967c6f answered `whoosh-soft 0.50 | whoosh-wind 0.30` (weak),
    the fill answers `[matched] whoosh-soft 0.50 | [closest] chess-piece-thock 0.30 | [closest] wind-soft 0.30` — whoosh-wind drops by
    E-d16a's tie rule (closest before weak at 0.30); the allowed first `whoosh-soft` is still shown first (Open problems).
  - **Red on the CURRENT helper** (the new rows written with `describeCorpus` = FIRST on `matches[0]` + recall over matches ∪ nearest,
    before (a)): `node …/vitest.mjs run src/main/services/library/sound-match-corpus-r4 > E3/fix4-corpus-red.log` → **Test Files 2
    failed (2), Tests 36 failed | 230 passed (266)** — 32 on the first match (the F4 power-down / chime-reward firsts, the verb-form ∅
    firsts, the 0.50 / tie firsts), 4 on recall ("a rewound tape", "a clicker", "a river running", "a running tap" — their clip scores 0).
  - After (a) + (b), the r4 files on `describeAnswerCorpus`: `… run src/main/services/library/sound-match-corpus >
    E3/fix4-corpus-try1.log` → **Test Files 2 failed | 5 passed (7), Tests 8 failed | 1072 passed (1080)** — the five old files all
    green (no old row changed); the 8 = the 4 E-d16a edges + the 4 vocabulary rows → annotated (Built) → `fix4-corpus-green.log`
    **Test Files 7 passed (7), Tests 1080 passed (1080)**.
  - `… run src/main/services/library/sound-answer.test.ts src/main/services/studio/agent-tools/
    src/main/services/studio/studio-agent-prompt.test.ts src/main/services/library/sound-match > E3/fix4-corpus-green-2.log` → **Test
    Files 28 passed (28), Tests 1261 passed (1261)**.
  - `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.node.check.json --noEmit` → **10 `error TS`** (baseline),
    none in a touched file (`fix4-tsc-node-step2.log`).
  - `git diff 7967c6f -- src/main/services/library/sound-match.ts src/main/services/library/sound-match-words.ts
    src/main/services/library/sound-match-vocab.ts | wc -c` → `0` (as of `9a13e3b`).

- **Fix round 4, builder #13 (2026-10-29 10:37–10:46, step 1; worktree root; HEAD `74b29e0` → `34feafe`):**
  - Red first (the new tests + the updated miss / reuse / prompt tests on the UNCHANGED code): `node
    D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/main/services/library/sound-answer.test.ts
    src/main/services/studio/agent-tools/audio-tools-fill.test.ts …/audio-tools-miss.test.ts …/audio-tools-reuse.test.ts
    src/main/services/studio/studio-agent-prompt.test.ts > E3/fix4-red.log` → **Test Files 5 failed (5), Tests 13 failed | 25
    passed (38)** + `sound-answer.test.ts` unloadable (the module did not exist; its 10 tests not collected). The one fill test
    green on the old code: "a TRUE miss … generates without force; force: true generates without looking" (unchanged behaviour).
  - Green: `… vitest.mjs run src/main/services/library/sound-answer.test.ts src/main/services/studio/agent-tools/
    src/main/services/studio/studio-agent-prompt.test.ts src/main/services/library/sound-match > E3/fix4-green-2.log` → **Test Files
    26 passed (26), Tests 995 passed (995)** (incl. the five corpus files — the 809 rows unchanged, their recall still over
    matches ∪ nearest until step 2). A wider first run (`… src/main/services/library/`, `fix4-green.log`, 50 files) had 3 × 5000 ms
    timeouts in `audio-normalize-ceiling` / `audio-normalize` / `catalog-import` (real ffmpeg, parallel load) → alone `fix4-ffmpeg-
    alone.log` **3 passed, 17 passed**.
  - `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.node.check.json --noEmit` → **10 `error TS`** (baseline),
    none in a touched file (`fix4-tsc-node-step1.log`). The web check is step 5's.
  - `git diff 7967c6f -- <the three matcher files> | wc -c` → `0`.

- **Fix round 3, builder #12 (2026-10-29, records only; worktree root; HEAD `78f32d9` → `3cff0be`; no `src/` / `scripts/`
  change, no gate re-run, no rebuild, no launch, no model turn, no test run — the logs read with `grep` / `wc` / `git show`):**
  - **Evidence re-read before writing** (every count checked against its file): `fix3-corpus-red.log` `Test Files 4 failed | 1
    passed (5)` · `Tests 88 failed | 726 passed (814)`, `Start at 00:05:57` · `fix3-green.log` `47 passed (47)` / `1181 passed
    (1181)`, 00:11:55 · `fix3-try1.log` `1 failed | 1091 passed (1092)` · `fix3-mi-mj-red.log` two runs, each `Test Files 1 failed
    (1)` · `Tests 1 failed | 2 passed (3)` × "MI — the bonus is capped …" / "MJ — the bonus is applied after the threshold …" ·
    `fix3-miss-red.log` `5 failed | 3 passed (8)` · `11 failed | 832 passed (843)`, 00:25:18 · `fix3-miss-green.log` `1 failed | 47
    passed (48)` · `3 failed | 1184 passed (1187)` · `fix3-miss-green-2.log` `5 passed (5)` · `814 passed (814)` ·
    `fix3-miss-green-3.log` `48 passed (48)` · `1187 passed (1187)`, 00:31:33 · the five drivers' logs each `1 passed (1)`
    (`tools-noprovider-fix3` 00:30:58, `tools-standin-fix3` 00:31:00, `catalog-fix3` 00:44:21, `broad-fix3` 00:44:30, `probe-fix3`
    00:49:27) · `catalog-order-fix3.txt` (133,703 bytes): the header (61 entries / 57 pool / 51 audio, the 4 `generated/` names, SHA
    `876f9f61…c16c95` + mtime `2026-10-28T22:31:02.584Z` UNCHANGED, rows 809 = 150 + 194 + 204 + 129 + 132), the two `OLD =` lines
    (358 / 165 / 19 / 114 / 3 / 4 and 301 / 116 / 19 / 55 / 7 / 7) and the strict lists (:1104-1113, :2041-2057) naming exactly the
    rows recorded · `broad-probes-fix3-summary.txt` (786,471 bytes) + the head of `broad-probes-fix3.txt` (1,657,184 bytes): base
    words 243, probes 7554, the two `vs` lines (4596 / 2555 / 491 / 1939 / 35 / 469; 3892 / 1803 / 12 / 1744 / 7 / 4), 2786 / 471;
    **the class labels re-counted from the summary** (`grep -o "vs 788c8d2: .*" | sed 's/ — WORSE?$//' | sed 's/.* — //' | sort |
    uniq -c`): vs 788 — carrier 1930 · swap new-carrier 90 · new miss NO carrier 467 · swap old-carrier new-carrier 21 · new miss
    carrier-in-nearest 24 · STRANGER 9 · swap old-carrier 14; vs 09e — 1736 · 40 · 12 (carrier in nearest) · 8 · 3 · 4 — identical to
    builder #11's analyzer output · `probe-fix3.txt` 98 lines, the 22 phrasings, every number quoted in Built "builder #11" matches ·
    `diff-list-fix3.txt` 99 lines (98 `src/`, 1 `scripts/`) · `import-graph-fix3.txt` the four "touched by the E diff: NONE" lines ·
    `build-fix3.log` "✓ built in 10.39s" / "192ms" / "2m 32s", nothing on `grep -i "warn\|error" | grep -v "use client"` ·
    `cpu-fix3.txt` 00:47:45, 16 cores, 28 / 29, sum 19.6 %, `vmmemWSL` 7.8 %, OLED 4.9 %, System 1.7 %, C: 46.4 / D: 43.8 /
    headroom 27.6 / 74.0 GB, electron 0 · `vitest-full-fix3.log` `4 failed | 502 passed | 5 skipped (511)` · `10 failed | 5096 passed
    | 35 skipped (5141)` · 71.36 s, `Start at 00:49:59`, "HEAD 1d7d5ed", `flow-render.test.ts:255:94` "expected 1 to be greater than
    1", 0 "timed out" · `vitest-fix3-flow-render-alone.log` `1 passed (1)` · `5 passed (5)` · 8.54 s, 00:51:35 · `vitest-full-fix3-2.log`
    `3 failed | 503 passed | 5 skipped (511)` · `9 failed | 5097 passed | 35 skipped (5141)` · 59.75 s, 00:51:49, 0 "timed out", the 9
    FAIL lines = builder-libraries 1 + shot-bundle-in-place 3 + shot-bundle 5 · `tsc-web-fix3.log` 26 / `tsc-node-fix3.log` 10 `error
    TS`, 0 lines naming an E3 file · `tools-noprovider-fix3.json` `at 2026-10-28T22:30:59.830Z`, `providers []` / `active null`, SHA
    `e5352386…12c5` ×2 + mtime `…T18:13:42.105Z` ×2, "No library sound matched" ×2 (the grandfather clock + the cooking-show bed),
    "No audio provider is configured …" ×2 (the dog bark + the bagpipe reel), `generatedBefore` = the two live-step files, the refs
    as recorded · `tools-standin-fix3.json` `at …T22:31:01.633Z`, `active "standin"`, `duration 1.6`, `loudnessLufs -20.26`,
    `peakDbfs -16.67`, `"I": -20.2`, `TP -16.7`, `category foley`, `generated/sfx-a-dog-bark.mp3` + `…-cuckoo-clock-chime-2.mp3`
    present, `already has 1 sound matching "a dog bark"` · `git log` for every hash + time (`574edbc` 00:05:59, `02e2a10` 00:12:04,
    `7967c6f` 00:30:57, `1d7d5ed` 00:37:59) · `git show --stat` of `574edbc` / `02e2a10` / `7967c6f` (5 / 5 / 11 files; `7967c6f`
    +290 / −71) · `wc -l` at `7967c6f`: `sound-match.ts` 181, `-words.ts` 211, `-vocab.ts` 90, `-corpus-rows.ts` 79, fixture 71,
    corpus test 192, r3 files 69 / 86 / 57 / 45, `-words.test.ts` 115, `-bonus.test.ts` 47, `sound-match.test.ts` 144, placement
    test 105, `sound-reuse.ts` 74, `audio-tools.ts` 199, `audio-tools-miss.test.ts` 180, `-reuse.test.ts` 173, `audio-tools.test.ts`
    202, `library-listing.ts` 93, `project-tools.ts` 80, prompt tools 87, prompt test 200 · the source wording quoted
    (`sound-reuse.ts:48` / :50, `audio-tools.ts:60-64`, the prompt test :122, `audio-tools-miss.test.ts` 5 `it(`, the ten `∅` rows
    with their "recall (fix 3)" comments, `matchStrength` :114 / `STEM_STRENGTH` :35, `hit.equal` `sound-match.ts:159`,
    `rankLibrarySounds` :135, `nearestLibrarySounds` :179, `run` / `running` in `sound-match-words.test.ts:12` + :31).
  - **Discrepancies found (recorded, not copied):** (1) the `*` rows — `grep -o "\['[^']*', '\*'"` over the four r3 files → 46
    (`-senses`) + 2 (`-ordinary`) = **48**, not the 38 of Built "builder #9" / the session-8 log (the HANDOFF's own enumeration
    has ~50 entries); the records say 48 and name the discrepancy. (2) `sound-match-corpus-rows.ts` was **62** lines at `574edbc`
    (`git show --stat`: 62 insertions), not 58 — 79 now. (3) `sound-match-bonus.test.ts` is **47** lines (Built "builder #9" says 52
    once; Next step said 47). (4) The `574edbc` message's 87 vs the log's 88 (known). Everything else matched its file.
  - **Records commit `3cff0be`** — Status.md E3 entry **:10-852** (E4's heading now :854): the title; the new fix-round-3 bullet
    :137-421 (round 3's findings + E-d15, the corpus, the fix, the miss rule, 4a, 4b, the bar); the code header :422- (fix round 3's
    files per commit) + the matcher / sound-reuse / audio-tools / prompt / tests pointers as of `7967c6f`; the `wt/out` line (rebuilt
    at `7967c6f`); Gates :645- (this round's; fix round 2's kept as history); open items (16)–(23) :777-; For Hasan; evidence :821-.
    TESTING **§18.17 :524-540** (Material :525, the new F3 item :533, the prompt rule :534 with the five sentences, Gates :539
    extended, Not measured :540). **Re-checked AFTER `3cff0be`:** `git log -1 --format=%h -- src/` → `7967c6f`; `git diff --stat
    7967c6f..HEAD -- src/ scripts/` → empty; `git diff --name-only 5d77600..HEAD -- src/ scripts/ | wc -l` → 99 and `diff -q` against
    `E3\diff-list-fix3.txt` → identical; `out/main/index.js` 00:54:49 (3,064,094 bytes), "No library sound matched" 1 hit; `git
    status --short` → empty. No stale line → no re-commit of the records.

- **Fix round 3, builder #11 (2026-10-29 00:40–01:00 local, worktree root, HEAD `1d7d5ed` (docs) with `src/` = `7967c6f` —
  `git log -1 --format=%h -- src/` → `7967c6f` before and after; `git status --short` empty before the records commit; NO `src/` /
  `scripts/` change, no launch, no model turn):**
  - **4a** `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/E3/vitest.e3.config.ts
    catalog-fix3 > E3\catalog-fix3.log` → rc 0, `1 passed`, 7.82 s (Start 00:44:21) → `E3\catalog-order-fix3.txt` (133,703 bytes): header
    "61 entries, 57 without generated/ (the candidates' pool), 51 audio (= the corpus fixture, verbatim: checked); generated/ entries
    present but EXCLUDED from the pool …: generated/sfx-a-cuckoo-clock-chime-2.mp3, generated/sfx-a-cuckoo-clock-chime.mp3,
    generated/sfx-a-dog-bark.mp3, generated/sfx-soft-whoosh.mp3" · "index SHA-256 before 876f9f61…c16c95 mtime 2026-10-28T22:31:02.584Z
    / after (the same) — UNCHANGED" · "rows 809 = 150 + 194 + 204 + 129 + 132" · `OLD = 788c8d2 · NEW = HEAD · rows 809 · changed 358 ·
    first result changed 165 · matches lost (old matched, new ∅) 19 · matches gained (old ∅, new matched) 114 · a CORRECT first lost 3 ·
    a CORRECT match lost 4` · `OLD = 09e81ea · … · changed 301 · first result changed 116 · matches lost 19 · matches gained 55 · a
    CORRECT first lost 7 · a CORRECT match lost 7` (the strict lists quoted in Built).
  - **4b** `… --config … broad-fix3 > E3\broad-fix3.log` → rc 0, `1 passed`, 45.05 s (Start 00:44:30) → `C:\…\vidtsx-e2e\E3\broad-probes-fix3.txt`
    (1,657,184 bytes) + `E3\broad-probes-fix3-summary.txt` (786,471 bytes): "base words 243 … probes 7554" · `vs 788c8d2: changed 4596 ·
    first changed 2555 · new misses 491 · new matches 1939 · swaps whose old first was a carrier 35 · WORSE? … 469` · `vs 09e81ea: changed
    3892 · first changed 1803 · new misses 12 · new matches 1744 · swaps whose old first was a carrier 7 · WORSE? … 4` · "probes whose first
    changed vs either old: 2786 · WORSE? vs either: 471"; index SHA / mtime UNCHANGED. `node E3\fix3-analyze.cjs` (vs 788: `{"new match
    (new first is a carrier)":1930,"swap new-carrier":90,"new miss (NO carrier in nearest)":467,"swap old-carrier new-carrier":21,"new
    miss (carrier in nearest)":24,"new match (new first is a STRANGER)":9,"swap old-carrier":14}`, WORSE? 469 of which -er forms 231;
    vs 09e: `{"new match (new first is a carrier)":1736,"swap new-carrier":40,"new miss (carrier in nearest)":12,"new match (new first is
    a STRANGER)":8,"swap old-carrier new-carrier":3,"swap old-carrier":4}`, WORSE? 4, -er 0) and `fix3-analyze2.cjs` (the 12 / 24 new
    misses with the carrier nearest, the 09e swaps and strangers) — every listed line read; the classification is in Built.
    `… --config … probe-fix3 > E3\probe-fix3.log` → rc 0, `1 passed` (Start 00:49:27) → `E3\probe-fix3.txt` (the 22 phrasings, quoted in Built).
  - **CPU first** (`C:\…\vidtsx-e2e\E3\cpu-fix3.txt`, 00:47:45): 16 logical cores; `Win32_Processor LoadPercentage` 28 / 29 (before /
    after the 5 s window); per-process CPU over 5 s, sum **19.6 %** of all cores — `vmmemWSL` 7.8 %, `OLED Care Screensaver.scr` 4.9 %,
    `System` 1.7 %, the rest ≤ 0.8 % → **no external load → DRIVING's NORMAL rule (default workers), not E-d13.** Guard: C: 46.4 GB, D:
    43.8 GB, memory commit limit 97.7 GB / headroom 27.6 GB (C: + headroom 74.0 GB; ≥ 10 GB → default workers); `electron.exe` 0;
    `%TEMP%\vidtsx-studio\export` absent.
  - **Full worktree vitest** (`bash E3\vitest-full-fix3.sh <log>` in the background — `cd <wt>; unset ELECTRON_RUN_AS_NODE; node
    D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run >> <log> 2>&1`): **run 1** (`C:\…\vidtsx-e2e\E3\vitest-full-fix3.log`, start
    00:49:57 / `Start at` 00:49:59, HEAD `1d7d5ed`) → `Test Files 4 failed | 502 passed | 5 skipped (511)` · `Tests 10 failed | 5096 passed
    | 35 skipped (5141)` · 71.36 s, 0 "timed out" — the 3 E-d2a suites + `flow-render.test.ts:255:94` ("expected 1 to be greater than 1"
    in its `vi.waitFor` — DRIVING's named LOAD timeout) → **alone** `vitest run src/main/services/flows/flow-render.test.ts`
    (`vitest-fix3-flow-render-alone.log`, `Start at` 00:51:35) → `1 passed (1)` · `5 passed (5)` · 8.54 s → **run 2, the COUNTED run**
    (`vitest-full-fix3-2.log`, start 00:51:48 / `Start at` 00:51:49) → **`Test Files 3 failed | 503 passed | 5 skipped (511)` · `Tests 9
    failed | 5097 passed | 35 skipped (5141)` · 59.75 s, 0 "timed out"**; the 3 files / 9 tests = `builder-libraries` 1 (`@remotion/paths
    (builder-libraries.ts) is not installed`), `shot-bundle` 5 (`Could not resolve` roughjs / @remotion/shapes / @react-three/fiber /
    chroma-js / @remotion/google-fonts/SpaceGrotesk), `shot-bundle-in-place` 3 (`Could not resolve "chroma-js"` ×2 + the assertion that
    quotes it) — resolution only. **Gate MET (DRIVING's load rule: the file green alone + a default run green on the 2nd try).** (The
    totals grew from fix round 2's 505 / 4,464: the four r3 corpus files + the miss / bonus tests.)
  - **Rule (b)** at `src/` = `7967c6f`: `git diff --name-only 5d77600..HEAD -- src/ scripts/ > E3\diff-list-fix3.txt` → **99 paths (98
    under `src/`, 1 `scripts/`; the unfiltered `git diff --name-only 5d77600..HEAD` = 115 incl. docs)**; `node
    C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\import-graph.cjs <wt> E3\diff-list-fix3.txt > E3\import-graph-fix3.txt` → rc 0:
    `builder-libraries.test.ts: 2 local modules in graph; touched by the E diff: NONE` · `shot-bundle.test.ts: 15 … NONE` ·
    `shot-bundle-in-place.test.ts: 23 … (vi.mock'd, not loaded: shot-generator.ts, shot-import-land.ts, media-import.ts) … NONE` ·
    `scripts/builder-unpack.mjs: 1 … NONE` (the fix-2 method: esbuild metafile per suite, packages external, `?raw` as leaves,
    `vi.mock`'d modules not followed).
  - **Types** at `7967c6f`: `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit >
    C:\…\vidtsx-e2e\E3\tsc-web-fix3.log` → rc 2, **26** `error TS`; `-p tsconfig.node.check.json` → `tsc-node-fix3.log` rc 2, **10**;
    0 lines name sound-match / sound-reuse / audio-tools / library-listing / project-tools / studio-agent-prompt / asset-library.
  - **`wt/out` rebuilt at `7967c6f`** (`src/` = `7967c6f`; DRIVING "Track E" step 1; 0 `electron.exe` first; C: 47 GB / D: 44 GB free,
    headroom 27.6 GB at 00:47; Bash from the worktree root, in the background): `unset ELECTRON_RUN_AS_NODE; export
    NODE_OPTIONS=--max-old-space-size=8192; node D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build >
    D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\build-fix3.log 2>&1` (00:54:37 → 00:57:22) → **rc 0**, main "✓ built in 10.39s",
    preload "192ms", renderer "✓ built in 2m 32s"; only the 3 "use client" warnings (`grep -i "warn\|error" | grep -v "use client"` →
    nothing). `out/main/index.js` **00:54:49** (3,064,094 bytes), `out/renderer/index.html` 00:57:20 — both AFTER the `7967c6f` commit
    (00:30:57); `grep -c "No library sound matched" out/main/index.js` → **1**; `STEM_STRENGTH` / "closest library sounds" → 9 hits.
    `src/` unchanged since (`git diff --stat 7967c6f..HEAD -- src/ scripts/` empty) — the build is the current code.

- **Fix round 3, builder #10 (2026-10-29 00:05–00:40 local, worktree root, base `c0fb9ab` → `7967c6f`; tree clean after; `src/`
  touched only under `library/` + `studio/`; no launch, no model turn, no gate re-run, no rebuild):**
  - **Red** (the tests before the code): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
    src/main/services/studio/agent-tools/audio-tools-miss.test.ts src/main/services/studio/agent-tools/audio-tools-reuse.test.ts
    src/main/services/studio/studio-agent-prompt.test.ts src/main/services/library/sound-match-corpus > E3\fix3-miss-red.log` → rc 1,
    `Test Files 5 failed | 3 passed (8)` · `Tests 11 failed | 832 passed (843)`: `audio-tools-miss` × 3 (both sfx near misses and
    the music one — the code still generated), the prompt pin × 1, recall × 7 (`recall — matches ∅ · nearest ∅` for a buildup / a
    runner / eaten / woooosh; `nearest chess-piece-capture` for taking a picture; `nearest dash-zip` for a tap running / running creek).
  - **Green** after the code (`vitest run src/main/services/library/ src/main/services/studio/agent-tools/
    src/main/services/studio/studio-agent-prompt.test.ts`): first `E3\fix3-miss-green.log` `1 failed | 47 passed` — the three "a
    ding" rows of the 150-row file (recall: the chimes carry no `ding`) → '∅' → the corpus alone `E3\fix3-miss-green-2.log` `Test
    Files 5 passed (5)` · `Tests 814 passed (814)`; the whole set `E3\fix3-miss-green-3.log` (`Start at 00:31:33`) → **`Test Files
    48 passed (48)` · `Tests 1187 passed (1187)`**. Commit `7967c6f` (11 files under `src/`, +290 / −71; `git status --short` empty).
  - **The no-provider driver** (`vitest run --config E3\vitest.e3.config.ts tools-noprovider-fix3` → rc 0, `E3\tools-noprovider-fix3.log`;
    record `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\tools-noprovider-fix3.json`, `at 2026-10-28T22:30:59Z`): `getLibraryRoot()` =
    `<E3 profile>\assets`; engine `providers [] / active null`, `VIDTSX_AUDIO_STANDIN_FILE` unset; **the index SHA-256
    `e5352386092d5849715abefe89eb33599b84f774f51bae556998bc9fd92912c5` + mtime `2026-10-28T18:13:42.105Z` identical before / after;
    `generated/` 2 → 2 files.** Calls: whoosh → `The library already has 3 sounds matching …` whoosh-soft / whoosh-wind / whoosh-reverse
    (30 ms; as before); **the near miss "a grandfather clock chiming midnight" → `No library sound matched "…" well — nothing was
    generated (no cost, no provider needed). The closest library sounds:` generated/sfx-a-cuckoo-clock-chime · sfx/clock-tick-soft ·
    sfx/chime-reward + "call generate_sfx again with force: true" (6 ms, isError false, no provider notice)**; the cuckoo → a MATCH
    (1 sound, the generated cuckoo); the true miss "a dog bark" → `No audio provider is configured …` (isError true, nothing written);
    music: "warm lo-fi bed" 30 s → the lofi-warm match (unchanged); "a warm bed for a cooking show" 30 s → the miss answer with
    lofi-warm · lullaby-tender · ambient-pad; "bagpipe reel" 30 s → the provider notice; `list_assets` "whoosh" → 7 rows (the generated
    soft-whoosh, dash-zip, flame-snuff, the four whooshes — as before), "grandfather midnight" → "No matching assets in the library.".
  - **The stand-in driver** (`… tools-standin-fix3` → rc 0, `E3\tools-standin-fix3.log`; record `…\vidtsx-e2e\E3\tools-standin-fix3.json`,
    `at 2026-10-28T22:31:01Z`; engine `providers ["standin"] / active "standin"`): "a dog bark" (category foley, tags dog / bark) →
    **generated ONCE** → `generated/sfx-a-dog-bark.mp3` 1.60 s, tags [dog, bark], category foley, −20.26 LUFS / −16.67 dBTP (true),
    source standin, `usedIn ["e3-tools"]`; independent ffmpeg-full `ebur128` I −20.2 LUFS / TP −16.7 (531 ms); the same ask → `The
    library already has 1 sound matching "a dog bark"` (found, 0 new); **the near miss "a grandfather clock chiming midnight" WITH the
    provider registered → the miss answer (the same three), 0 new files**; the cuckoo with `force: true` → generated once →
    `generated/sfx-a-cuckoo-clock-chime-2.mp3` (308 ms); the whoosh → the 3-match answer, 0 new; lofi 30 s → the match, 0 new.
    **`generated/` 2 → 4 entries — the E3 profile's index CHANGED by this run** (item 4's regression driver stamps the index as it is
    now; `generated/` is outside its pool, the 51-clip fixture check still holds). The dog and the cuckoo-2 share one project asset
    id (`2e89e21f-…`) — the stand-in's identical bytes dedup in the pool (builder #3's note (3)).

- **Fix round 3, builder #9 (2026-10-29, worktree root, base `d363526` → `574edbc` → `02e2a10`; tree clean; no `src/` change
  outside `library/`; no launch, no model turn, no gate re-run, no rebuild):**
  - Probe dedupe: scratch `dedupe-probes.cjs` over the 150-row test + the three probe files → `{"existing":150,"total":695,
    "inExisting":1,"dup":35,"kept":659}`; `check-rows.cjs` over the four row files → `want 659 / got 659 / missing [] / extra []
    / dups []` (scratchpad `C:\Users\hasan\AppData\Local\Temp\claude\d--repos-VidTSX-STUDIO\6bb10a3a-…\scratchpad\`, session
    scratch — the probe list it checked = `probe-keys-new.txt` there).
  - Corpus red at `09e81ea` code (`574edbc` = the rows only): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
    src/main/services/library/sound-match-corpus > …\E3\fix3-corpus-red.log` → rc 1, `Test Files 4 failed | 1 passed (5)` ·
    `Tests 88 failed | 726 passed (814)` (the 150-row file green; 88 `×` rows).
  - After the fix, first try (`E3\fix3-try1.log`, `vitest run src/main/services/library/`): `1 failed | 1091 passed (1092)` —
    only the old no-comma expectation in `sound-match-words.test.ts`. After the words-test update + the bonus test: `vitest run
    src/main/services/library/ src/main/services/studio/agent-tools/ src/main/services/studio/studio-agent-prompt.test.ts`
    → try 2: `2 failed | 1179 passed` ("the exact moment" gave bonus [exact, slide, changes]; and `pre-e1-control.test.ts` "a
    pre-E1 index …" `expected { candidates: +0, probed: +0 … } to match object { candidates: 7, probed: 7 …}` — a disk-timing
    flake, green on the re-run, unrelated code) → `exact` / `precise` added to STOP_WORDS → **`Test Files 47 passed (47)` ·
    `Tests 1181 passed (1181)`** (`E3\fix3-green.log`), commit `02e2a10`.
  - MI / MJ reds as in Built (`E3\fix3-mi-mj-red.log`); `git diff --stat` empty and `git status --short` empty after.

- **Fix round 2 records, builder #8 (2026-10-28, worktree root, HEAD `532559a`, tree clean except the orchestrator's untracked
  `docs/studio/end-to-end/E-exit/`; no `src/` / `scripts/` change, no gate re-run, no rebuild, no launch, no model turn):**
  - Evidence re-read before copying: `fix2-corpus-red.log` `Tests 10 failed | 141 passed (151)` (the 10 rows by name) ·
    `fix2-green.log` `41 passed (41)` / `493 passed (493)` · `catalog-order-fix2.txt` header "rows 150 · changed 24 · first result
    changed 7 · a match lost 2", index SHA-256 / mtime UNCHANGED, the changed rows' old / new as recorded · `cpu-fix2.txt` (22:07:51,
    LoadPercentage 4 / 19, sum 5.4 %, `vmmemWSL` 2.1 %) · `vitest-full-fix2.log` 4 / 496 / 5, 10 / 4419 / 35, 60.43 s, the extra =
    `flow-render.test.ts:255:94` "expected 0 to be greater than 0" · `vitest-fix2-flow-render-alone.log` 1 / 1, 5 / 5 ·
    `vitest-full-fix2-2.log` 3 / 497 / 5, 9 / 4420 / 35, 70.19 s, 0 "timed out", only the 3 E-d2a files · `tsc-node-fix2.log` 10 /
    `tsc-web-fix2.log` 26 `error TS`, 0 name `sound-match` · `build-fix2.log` "✓ built in 1m 56s" · `out/main/index.js` 22:11:17.58 /
    `out/renderer/index.html` 22:13:12.81; `PLACEMENT_BONUS` 3 lines, `placementHits` 3, `whilst` 2 · `wc -l` at HEAD:
    `sound-match.ts` 141, `sound-match-words.ts` 179, fixture 71, corpus test 208, words test 63, placement test 105,
    `sound-match.test.ts` 144; `git show 788c8d2:` / `b176881:` `sound-match.ts` → 249 lines.
  - **Location note:** `diff-list-fix2.txt` and `import-graph-fix2.txt` are in the D: scratch
    `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\` (NOT `C:\…\vidtsx-e2e\E3\` like the fix-1 lists); the records say so.
    `diff-list-fix2.txt` = 105 lines, 90 under `src/`.
  - **Records commit `5e56594`** — Status.md E3 entry **:10-453** (E4's now :455), TESTING **§18.17 :524-539** (new F2 item :532,
    the Gates item :538 rewritten for fix round 2, fix round 1 kept as "Earlier"). Re-checked AFTER `5e56594`: `git log -1
    --format=%h -- src/` → `09e81ea`; `git diff --stat 09e81ea..HEAD -- src/ scripts/` → empty; `git diff --name-only
    5d77600..HEAD | diff - …\E3\diff-list-fix2.txt` → identical (105; `git diff --name-only 09e81ea..HEAD` = Status.md, TESTING.md,
    E3 HANDOFF / LOG, NEXT-SESSION.md, ORCHESTRATOR.md — all six already in the list).

- **Fix round 2, builder #7 (2026-10-28, worktree root, base `0e168cf`):**
  - Corpus red (above). Green: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/main/services/library/
    src/main/services/studio/agent-tools/` → `Test Files 41 passed (41)` · `Tests 493 passed (493)` (`E3\fix2-green.log`).
  - **Regression, old `788c8d2` vs new, the WHOLE corpus on the real index** (driver `E3\catalog-fix2.e3.test.ts`, `--config
    E3\vitest.e3.config.ts catalog-fix2` → rc 0; READ-ONLY — SHA-256 `e5352386…12c5` + mtime identical before / after; the
    driver also asserts the fixture = the index's 51 audio entries) → **`E3\catalog-order-fix2.txt`**: 150 rows, **24 changed,
    7 first results changed, 2 matches lost.** The 7 firsts are the 7 intended fixes ("a bell rung once" / "a bell rung"
    dash-zip → ∅; "when the logo lands a deep impact hit" ∅ → impact-soft 0.42; "as the title appears a soft whoosh" ∅ →
    whoosh-soft 0.42; "if the answer is right a chime" ∅ → chime-reward 0.39; "a soft tick while the countdown runs" → clock-tick-soft;
    "a snap when the trap closes" → trap-snap); the 2 lost matches are the wrong dash-zip offers. Lower offers removed, each
    from the loose prefix rule: warm-shimmer 0.60 for "riser" ×7 rows (its description's "rise"), scan-hum 0.50 for "a tension
    riser until the reveal" (it reached 0.50 only because the prefix hit lowered riser's idf), trap-snap 0.46 for "camera
    shutter" ×2 (shut/shutter), zap-electric for "a sparkle when the star appears" (spark/sparkle; chime-magic 0.60 —
    "sparkles" — now third). The rest: coverage moves ≤ 0.05 with the same order. **No row lost a correct match or its first
    result.**
  - Types at `09e81ea` (`src/` = the commit): `tsc -p tsconfig.node.check.json --noEmit` → **10** `error TS`
    (`C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\tsc-node-fix2.log`), `-p tsconfig.web.check.json` → **26** (`tsc-web-fix2.log`);
    0 lines name `sound-match`.
  - **CPU measured** 22:07:51 (`…\vidtsx-e2e\E3\cpu-fix2.txt`): C: 48.7 GB, D: 43.8 GB, headroom 34.6 GB, 0 `electron.exe`, 16
    cores, `LoadPercentage` 4 / 19, per-process sum over 5 s 5.4 % of all cores (`vmmemWSL` 2.1 %) — **no external load →
    DRIVING's normal gate (default workers), not E-d13.**
  - **Full worktree vitest at `09e81ea`, tree clean** (logs `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\`): run 1 (`Start at`
    22:08:12, `vitest-full-fix2.log`) → `Test Files 4 failed | 496 passed | 5 skipped (505)` · `Tests 10 failed | 4419 passed |
    35 skipped (4464)` · 60.43 s — the 3 E-d2a suites + `flow-render.test.ts:255` ("expected 0 to be greater than 0", DRIVING's
    named LOAD timeout) → alone `vitest run src/main/services/flows/flow-render.test.ts` → `1 passed (1)` · `5 passed (5)`
    (`vitest-fix2-flow-render-alone.log`) → **run 2, the COUNTED run** (`Start at` 22:09:36, `vitest-full-fix2-2.log`) → `Test
    Files 3 failed | 497 passed | 5 skipped (505)` · `Tests 9 failed | 4420 passed | 35 skipped (4464)` · 70.19 s, 0 "timed out";
    the 3 files / 9 tests = `builder-libraries` 1 (`@remotion/paths (builder-libraries.ts) is not installed`), `shot-bundle` 5
    (`Could not resolve` roughjs / @remotion/shapes / @react-three/fiber / chroma-js / @remotion/google-fonts/SpaceGrotesk),
    `shot-bundle-in-place` 3 (`Could not resolve "chroma-js"`) — resolution only. **Gate MET (DRIVING's load rule: the file
    green alone + a default run green on the 2nd try).**
  - Rule (b) at `09e81ea`: `git diff --name-only 5d77600..HEAD > …\E3\diff-list-fix2.txt` → **105 paths (90 under `src/`)**;
    `node C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\import-graph.cjs <wt> …\E3\diff-list-fix2.txt > …\E3\import-graph-fix2.txt`
    → rc 0: `builder-libraries.test.ts` 2 local modules · `shot-bundle.test.ts` 15 · `shot-bundle-in-place.test.ts` 23
    (vi.mock'd, not loaded: shot-generator.ts, shot-import-land.ts, media-import.ts) · `scripts/builder-unpack.mjs` 1 —
    touched by the E diff: **NONE** each (method: esbuild metafile per suite, packages external, `?raw` as leaves, `vi.mock`'d
    modules not followed).
  - **`wt/out` rebuilt at `09e81ea`** (22:11; guard C: 48.4 GB, D: 43.8 GB, headroom 34.7 GB, 0 `electron.exe`; tree = `09e81ea`
    + docs only): `unset ELECTRON_RUN_AS_NODE; export NODE_OPTIONS=--max-old-space-size=8192; node
    D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build >
    D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\build-fix2.log` → rc 0, only "use client" warnings, renderer "✓ built in
    1m 56s"; `out/main/index.js` 22:11:17, `out/renderer/index.html` 22:13:12; `out/main/index.js` holds `PLACEMENT_BONUS` /
    `PLACEMENT_BONUS_MAX` and `placementHits` (3 hits), `whilst` 2 hits (the placement set + the stop words).

- **Fix round 1, builder #6 (2026-10-28, worktree root, HEAD `55b223a`, tree clean; no `src/` change, no launch, no model
  turn):**
  - **CPU measurement** (21:28:31; `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\cpu-fix1-6.txt`): guard C: 49.3 GB, D: 43.8 GB,
    headroom 28.3 GB, 0 `electron.exe`, 16 logical cores; `Win32_Processor LoadPercentage` 85 / 84 (before / after the 5 s);
    per-process CPU over 5 s (Δ CPU-seconds / 5 s / 16 cores): **`vmmemWSL` 74.8 %** of all cores, `OLED Care
    Screensaver.scr` 5.6 %, `System` 1.7 %, `WmiPrvSE` 1.5 %, the rest ≤ 0.5 %; sum 88.3 %. The external load persists →
    **E-d13** (DRIVING "Track E"; builder #5's three default tries + one `--maxWorkers=4` run already failed DRIVING's normal
    rule under the same load — table below).
  - **E-d13 counted run** (21:28:47 → 21:32:22, HEAD `55b223a`, tree clean): `node
    D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --maxWorkers=2 --testTimeout=20000 --hookTimeout=20000 >
    C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\vitest-full-fix1-ed13.log 2>&1` → `Test Files 4 failed | 494 passed | 5
    skipped (503)` · `Tests 10 failed | 4228 passed | 35 skipped (4273)` · `Duration 212.58s`; 0 "timed out". Failed: the
    3 E-d2a suites, resolution only (`builder-libraries` 1 — `@remotion/paths (builder-libraries.ts) is not installed`;
    `shot-bundle` 5 — `Could not resolve` roughjs / @remotion/shapes / @react-three/fiber / chroma-js /
    @remotion/google-fonts/SpaceGrotesk; `shot-bundle-in-place` 3 — chroma-js) + `shot-module-resolver.test.ts` 1 "a changed
    transpiler fingerprint misses every tier" (`Error: never written: …\shot-module-cache-cHFdyZ\…\v1.json` from its own
    `waitForFile` :55, called :158 — an explicit wait, not the 20 s timeout; DRIVING's named known list `:151`).
  - **Alone** (21:32:48): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
    src/main/services/studio/shot-module-resolver.test.ts > …\E3\vitest-fix1-ed13-alone.log 2>&1` → rc 0, `Test Files 1
    passed (1)` · `Tests 10 passed (10)`; `git diff --name-only 5d77600..HEAD | grep -c shot-module-resolver` → 0 (not E's).
    → **The E-d13 gate is MET** (one full run; no other failure, no persisting 20 s timeout).
  - Rule (b): `git diff --name-only 5d77600..HEAD` at `55b223a` = `diff-list-fix1.txt` byte-for-byte (101 paths; Status.md,
    TESTING.md, E3 HANDOFF / LOG already in it) → builder #5's `import-graph-fix1.txt` (NONE) holds; tsc 26 / 10 from
    `788c8d2` holds (`src/` unchanged since).
  - **Records commit `f593515`** — Status.md E3 entry **:10-325** (E4's now :327), TESTING **§18.17 :524-538** (new F1 item
    :531). Re-checked AFTER `f593515`: `git diff --name-only 5d77600..HEAD` still = `diff-list-fix1.txt` (101); `git log -1
    --format=%h -- src/` → `788c8d2`; `git diff --stat 788c8d2..HEAD -- src/ scripts/` empty → the `wt/out` build at
    `788c8d2` is the current code; `out/main/index.js` 21:22:29 / `out/renderer/index.html` 21:25:49, `whilst` 1 hit.

- **Fix round 1 (builder #5, 2026-10-28, worktree root):**
  - **F1 red** at HEAD `7a0d6ad` + the new test file only: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
    src/main/services/library/sound-match-placement.test.ts` (log `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\fix1-red.log`)
    → `Tests 11 failed | 2 passed (13)`: `expected 'changes' to be 'whoosh'` (headWord), `expected [] to deeply equal [
    'impact-deep-soft', 'impact-soft' ]` (×3 incl. the leading-clause form), `expected undefined to be 'ui-click-soft'` /
    `'riser-soft'` / `'impact-soft'`, `expected [] to deeply equal [ 'chime-magic', 'chime-reward' ]`, and the once-case
    `expected [ … ] to include 'ui-toggle-on'` (the not-contain failed: the toggle WAS offered); the 2 passing = "as a
    transition" and the no-match controls (unchanged behaviour, by design).
  - **Green** after the fix: `vitest run src/main/services/library/ src/main/services/studio/agent-tools/` (`fix1-green.log`)
    → `Test Files 38 passed (38)` · `Tests 301 passed (301)` (incl. `sound-match.test.ts` 14 — the cuckoo / dog-bark /
    metallic-ring no-match cases and the music `minDurationSec` drop). Commit `b176881`.
  - **Real index, old vs new** (app stopped; READ-ONLY — `index.json` SHA-256 `E5352386…12C5` and mtime
    `2026-10-28T18:13:42.105Z` identical before / after): driver `…\E3\catalog-fix1.e3.test.ts` (OLD = `git show
    HEAD:…/sound-match.ts` at `7a0d6ad` → `…\E3\sound-match-old.ts`, imports re-pointed; NEW = the worktree file), `node
    …/vitest.mjs run --config …\E3\vitest.e3.config.ts catalog-fix1` → rc 0 →
    **`D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\catalog-order-fix1.txt`**: index 59 entries (57 without
    `generated/`, 51 audio candidates); 70 prompts (the nine; builder #1's 13 sfx + 4 music; the verifier's 29 other sfx
    + 4 other music; this round's 9 sfx + 2 music); **16 changed, every one from no-match / weaker to the right sound; 0 lost a match or its first
    result.** The nine (old → new): quick whoosh when the slide changes ∅ → whoosh-soft / whoosh-wind / whoosh-data-burst
    0.85 · whoosh while the card flies in ∅ → whoosh-soft / -reverse / -wind 1.00 · deep impact hit when the logo lands ∅
    → impact-soft / impact-deep-soft 0.65, stamp-hit 0.35 · an impact when … ∅ → impact-soft / impact-deep-soft 1.00,
    launch-thump 0.90 · a hit when … ∅ → impact-soft / stamp-hit 1.00 · a click when the button is pressed ∅ →
    ui-click-soft / ui-toggle-on 1.00, trap-snap 0.60 · a chime when the answer is right ∅ → chime-reward / chime-magic
    1.00 · a tension riser until the reveal ∅ → riser-soft 1.00, scan-hum 0.50, warm-shimmer 0.30 · a whoosh once the
    scene switches `ui-toggle-on 0.30` → whoosh-soft / -reverse / -wind 1.00. The other 7 changed: "a deep impact hit as
    the logo lands" impact-soft 0.42 → + impact-deep-soft 0.65, stamp-hit (first kept); "a pop when the bubble appears"
    pop-reveal 0.86 → pop-reveal 1.00 + party-popper 1.00 (first kept; "appears" no longer weighs); "a chime as soon as
    the answer is right" chimes 0.30 → 1.00; "When the logo lands, add a deep impact hit." ∅ → the impacts; "a whoosh if
    you have one" ∅ → whooshes; music "a calm ambient bed while the host talks" ∅ → ambient-pad 1.00, "warm lo-fi bed
    until the outro" ∅ → lofi-warm 1.00. Unchanged incl. every no-match (cuckoo ×2 + "… when the timer ends", dog bark
    ×2, ding, applause, x / a / the / "sound effect", corporate rock, lo-fi ≥ 120 s, "music").
  - **Note 2 green**: `vitest run src/main/services/studio/agent-tools/audio-tools` (`fix1-audio-green.log`) → `Test
    Files 2 passed (2)` · `Tests 13 passed (13)` (7 + 6; was 12 in one file). **M2b red** (the verifier's exact from /
    to on `audio-tools.ts`: `if (!args.force && args.prompt && !args.compositionPlan) {` → `if (args.prompt &&
    !args.compositionPlan) {`, then restored from a copy — `git diff` empty after): same command (`fix1-m2b-red.log`) →
    `Tests 1 failed | 12 passed (13)`: "generate_music force: true generates …" — `expected "vi.fn()" to not be called at
    all, but actually been called 1 times` (the lookup ran). Commit `788c8d2`.
  - **Gates at HEAD `788c8d2`** (no app — 0 `electron.exe`; guard C: 49.3 GB, D: 43.8 GB, headroom 27.3–28.4 GB → default
    workers; **another session held the CPU at 79–99 %** — `Win32_Processor LoadPercentage` before runs 3 / 4 / 5 — two
    foreign `node` processes at ~217 s CPU each). Full worktree vitest, logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\`:
    | run | log | files failed / passed / skipped (503) | tests failed / passed / skipped (4,273) | beyond the 3 E-d2a suites |
    |---|---|---|---|---|
    | 1 default 21:06 | `vitest-full-fix1.log` | 6 / 492 / 5 · 96.5 s | 12 / 4,226 / 35 | `render-jobs.test.ts:100` + `project-package.test.ts:247` (5000 ms timeouts), `flow-render.test.ts:255` |
    | 2 default 21:08 | `vitest-full-fix1-2.log` | 4 / 494 / 5 · 88.0 s | 11 / 4,227 / 35 | `flow-render.test.ts` :188 (5000 ms) + :255 |
    | 3 `--maxWorkers=4` 21:10 | `vitest-full-fix1-3-mw4.log` | 4 / 494 / 5 · 144.5 s | 10 / 4,228 / 35 | `shot-module-resolver.test.ts:151` ("a changed transpiler fingerprint…", `waitForFile` "never written" :158) |
    | 4 default 21:13 | `vitest-full-fix1-4.log` | 6 / 492 / 5 · 103.7 s | 13 / 4,225 / 35 | `agent-memory.test.ts` (2), `flow-render.test.ts` (1), `shot-module-resolver.test.ts:151` |
    | 5 `--maxWorkers=2` 21:15 | `vitest-full-fix1-5-mw2.log` | 4 / 494 / 5 · 239.3 s | 10 / 4,228 / 35 | `shot-module-resolver.test.ts:151` only |
    Every extra file passed ALONE: `render-jobs` + `project-package` + `flow-render` → 3 / 3 files, 32 / 32
    (`vitest-fix1-alone.log`); `shot-module-resolver` → 10 / 10 (`vitest-fix1-alone-2.log`); `agent-memory` + `flow-render` +
    `shot-module-resolver` → 3 / 3, 30 / 30 (`vitest-fix1-alone-3.log`). `flow-render:255` and `shot-module-resolver:151` are
    DRIVING's named LOAD timeouts; none of these files imports `sound-match` / `audio-tools`. The 3 E-d2a suites fail only on
    package resolution in every run (`builder-libraries` 1 — `@remotion/paths (builder-libraries.ts) is not installed` +
    its `builder-unpack.mjs:73` stderr; `shot-bundle` 5 — `Could not resolve` roughjs / @remotion/shapes /
    @react-three/fiber / chroma-js / @remotion/google-fonts/SpaceGrotesk; `shot-bundle-in-place` 3 — chroma-js). **DRIVING's
    load rule (b) is NOT yet met** (no default run green within 3 tries, the mw4 run not green) → the counted run is
    still owed (Next step). Rule (b) of E-d2a: `git diff --name-only 5d77600..HEAD > …\E3\diff-list-fix1.txt` at `788c8d2`
    → **101 files (86 under `src/`)**; `node C:\Users\hasan\AppData\Local\vidtsx-e2e\E1\import-graph.cjs <wt>
    …\E3\diff-list-fix1.txt > …\E3\import-graph-fix1.txt` → rc 0: `builder-libraries.test.ts` 2 local modules ·
    `shot-bundle.test.ts` 15 · `shot-bundle-in-place.test.ts` 23 (vi.mock'd, not loaded: shot-generator.ts,
    shot-import-land.ts, media-import.ts) · `scripts/builder-unpack.mjs` 1 — touched by the E diff: **NONE** each (method:
    esbuild metafile per suite, packages external, `?raw` as leaves, `vi.mock`'d modules not followed). Types: `tsc -p
    tsconfig.web.check.json --noEmit` → **26** `error TS` (`tsc-web-fix1.log`), `-p tsconfig.node.check.json` → **10**
    (`tsc-node-fix1.log`); 0 lines name `sound-match`, `sound-reuse` or `audio-tools`.
  - **`wt/out` rebuilt at `788c8d2`** (`src/` as of `788c8d2`; DRIVING "Track E"; guard C: 49.3 GB, D: 43.8 GB, headroom
    28.4 GB, 0 `electron.exe`): `unset ELECTRON_RUN_AS_NODE; export NODE_OPTIONS=--max-old-space-size=8192; node
    D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build >
    D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\build-fix1.log` (21:22:02) → exit 0, renderer "✓ built in 3m 21s";
    `out/main/index.js` 21:22:29, `out/renderer/index.html` 21:25:49; `out/main/index.js` contains the `PLACEMENT` set
    (`whilst` — 1 hit).

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

**E3 verifier round 5 — E3's LAST; bar E-d16 + E-d16a + E-d16b + E-d16c + E-d16d (CDP 9273, `profiles\E3-verify` may be
reused; range `74b29e0..HEAD`; the records to check: Status.md E3 entry :10-1111, TESTING §18.17 :524-541).** (Line numbers as
of `dbe935a`; the fix-round-4 bullet is Status.md :425-602, the TESTING fix-round-4 item :534. No model call is needed — the tool
level runs the real handlers with the app stopped, as rounds 2–4 did; a FAIL stops the run; E-d16's bar is quoted in the Status
bullet's last sub-item, the decisions in ORCHESTRATOR.md "### E-d16" … "### E-d16d".) Builder #20's own brief, kept below, is DONE.

(Builder #20's brief — DONE, kept for the record:) **FIX ROUND 4, continued — builder #20: E-d16d item 3, the records (everything else is DONE: #17 `c5a6124` the rule; #18 the fix4b
re-run, the gates, the rebuild; #19 the greedy experiment → NOT kept, the fallback — Built / Verified "builder #18" and "builder #19";
do not redo them; no code change, no launch, no model call).** Write, with the Edit tool (never Python / node / sed / heredoc for a doc
edit), (a) the Status.md E3 entry: title :10 → "…; fix round 4 after verifier round 4 FAIL on F4 (builders #13–#20, decisions
E-d16 + E-d16a + E-d16b + E-d16c + E-d16d: the answer-level recall fill with the word-diversity rule, no matcher change); the E3
verifier round 5 — E3's last — is next" (and DONE stays); **plus E-d16d in the new bullet: one line for the decision (ORCHESTRATOR.md
"### E-d16d" :1494) and the greedy experiment from `E3\variants-fix4c.txt:1-4` + `:7-12` and `E3\variants-fix4c-read.txt` (Built
"builder #19": corpus 30 changed / 5 LOST vs `c5a6124` / 3 NEW vs `7967c6f` / 0 conf moved / corpus 7 files 1,080 green with greedy;
broad 895 changed (799 reorders) / 56 LOST vs `c5a6124` (6 none left, incl. "a sparkling screen") / 20 NEW vs `7967c6f` / 0 conf
moved / noun-first 15 vs 9; the six quiet probes fixed by greedy → greedy NOT kept by E-d16d's rule → the six are NOTES); the gates
that count = builder #18's (no code change);** a NEW bullet "**Verifier round 4 FAIL (F4 …) → fix round 4 `34feafe` `9a13e3b` `d30830a`
`c5a6124`.**" after the round-3 bullet (:137 to :424 as of `1535ba7` — re-grep) carrying builders #13–#18 in substance: F4 in one
sentence; E-d16 / E-d16a / E-d16b / E-d16c in one line each (E-d16c from ORCHESTRATOR.md "Session 9" — read the "### E-d16c" block
:1476, never stage that file); the fill + labels + wording (Built "#13"); how "covers" is decided (Built "#17": `sound-answer-words.ts`
any field, any strength = the matcher's `hitOf` weight > 0) and the definition experiment's three-way table (`E3\variants-fix4b.txt:2-4`);
the corpus (Built "#14"); the record fixes (Built "#15"); builder #16's step-4 numbers (`E3\catalog-order-fix4.txt`,
`E3\broad-probes-fix4-summary.txt`) AND the fix4b numbers (`E3\catalog-order-fix4b.txt:4-7`, `E3\broad-probes-fix4b-summary.txt:3-7`)
with the frames F1–F9 listed; the 63 changed vs `34feafe` read (48 "… screen" + 15 "a soft `<form>`"); the noun-first class 5,709 /
9 left; the `git diff 7967c6f` proof (0 bytes); E-d16's bar for verifier round 5 in one sentence + the E-d16a / E-d16b / E-d16c notes;
the code list + line counts (`wc -l` at HEAD: `sound-answer.ts`, `sound-answer-words.ts`, `sound-reuse.ts`, the corpus rows / r4 files,
the three test files). (b) The Status.md "The code" bullet (:425) if it lists the answer files; the Gates bullet (:648) → a NEW
"Gates (fix round 4, builder #18 …)" bullet from Verified "builder #18" items 3–4, the round-3 one marked history; the `wt/out` line
(:561) → built at `c5a6124` 11:54:37; "Not measured / open" (:739) + verifier round 4's notes 1–10 (Open problems "Verifier round 4"),
the 9 (E-d16c), "a sucking whoosh before the reveal", the "a soft crunching" side effect, "a moving transition", the F9 "a quiet
`<-ing>`" six — now NOTES by E-d16d's fallback (Open problems "builder #18" item 4 + "builder #19"; greedy fixed them but lost right
clips elsewhere, so it was not kept). (c) TESTING §18.17 (:524-543): a NEW `- [x]
**Verifier round 4 FAIL (F4 …) → fix round 4 …**` line after :533, the Gates line :539 → fix round 4's, the Not-measured line :540 +
the same notes. Numbers only from the report files (re-open each one you cite). Commit `docs(studio): E3 fix round 4 — the records`
(explicit paths: Status.md docs/studio/TESTING.md docs/studio/end-to-end/E3/HANDOFF.md docs/studio/end-to-end/E3/LOG.md); every git /
tree / build statement "as of `<hash>`", re-checked AFTER the commit; HANDOFF `status: DONE`, Next step = "E3 verifier round 5 — E3's
LAST; bar E-d16 + E-d16a + E-d16b + E-d16c + E-d16d (CDP 9273, `profiles\E3-verify` may be reused; range `74b29e0..HEAD`; the records
to check: Status.md E3 entry :<first>-<last>, TESTING §18.17 :<first>-<last>)"; the LOG line; commit. (Re-check before writing: `git log
-1 --format=%h -- src/` = `c5a6124`; `git diff --stat c5a6124..HEAD -- src/ scripts/` empty; matcher diff vs `7967c6f` 0 bytes.)

(Builder #18's own start note, 11:52 — kept:) **Item 2 is DONE (Built / Verified "builder #18" — do not redo it); builder #18 continues with item 3 (gates),
item 4 (rebuild), item 5 (records) as worded below. E-d16c (Hasan 11:46, ORCHESTRATOR.md "Session 9" — the orchestrator's
uncommitted edit; never stage ORCHESTRATOR.md) joins the bar: a shown CONFIDENT clip whose own text already carries the prompt word
(so E-d16b cannot fire), first already at `09e81ea`, right clip not in the three = a NOTE (the 9). The records carry E-d16c and the
verifier-round-5 Next step says "bar E-d16 + E-d16a + E-d16b + E-d16c".**

**FIX ROUND 4, continued — builder #18: items 2–5 of builder #17's brief (item 1 the E-d16b rule is DONE, `c5a6124` — Built /
Verified "builder #17"; do not redo it; NO matcher change — `git diff 7967c6f --` the three matcher files must stay empty).** Item 2:
from the worktree root run the PREPARED kit drivers `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config
D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/E3/vitest.e3.config.ts catalog-fix4b` and `… broad-fix4b` (logs
`E3\catalog-fix4b.log` / `broad-fix4b.log`; the E3 index READ-ONLY — the drivers assert SHA-256 + mtime before = after, its 4
`generated/` entries excluded; never a generating driver there) → `E3\catalog-order-fix4b.txt`, `…\vidtsx-e2e\E3\broad-probes-fix4b.txt`
+ `E3\broad-probes-fix4b-summary.txt` (builder #16's `*-fix4*` reports stay as they are); the corpus is already green at `c5a6124`
(37 files / 1,386 tests, the `edge` rows hold — re-check them in the catalog report). Report vs `7967c6f` AND vs `34feafe` (the
fourth column): changed, right clip LOST (must be 0 vs `7967c6f`; read + justify any vs `34feafe` — the experiment predicts 0),
none left, gained, confident first moved (must be 0), and the summary's "right in the three: false" count (the experiment
predicts 9 — the list + reason in Open problems "builder #17"); READ the changed rows vs `34feafe` (the experiment: 63 broad
probes). Then items 3 (gates), 4 (rebuild `wt/out`) and 5 (the records) = steps 5–7 of the builder-#15 text kept below (from "Then
**step 5 gates**" to its end; logs `…\E3\cpu-fix4.txt`, `vitest-full-fix4.log`, `E3\diff-list-fix4.txt`, `import-graph-fix4.txt`,
`tsc-web-fix4.log` / `tsc-node-fix4.log`, `build-fix4.log`), with these record additions: the Status.md E3 title → "…; fix round 4
after verifier round 4 FAIL on F4 (builders #13–#<n>, decisions E-d16 + E-d16a + E-d16b: the answer-level recall fill with the
word-diversity rule, no matcher change); the E3 verifier round 5 — E3's last — is next"; the bullet carries builders #13–#18 in
substance (E-d16b's rule + how "covers" is decided + the definition experiment's numbers from `E3\variants-fix4b.txt`, builder
#16's step-4 numbers AND the fix4b re-run's numbers each from its report file with the frames listed, the 9 left with the reason,
the `git diff 7967c6f` proof, E-d16's bar + the E-d16a / E-d16b notes, the code list + line counts, "Not measured / open" incl.
verifier round 4's notes 1–10, the noun-first class numbers, "a moving transition"); TESTING §18.17 likewise; HANDOFF `status: DONE`, Next step = "E3 verifier round 5 — E3's LAST; bar E-d16 +
E-d16a + E-d16b (CDP 9273, `profiles\E3-verify` may be reused; range `74b29e0..HEAD`; the records to check: Status.md E3 entry
:<first>-<last>, TESTING §18.17 :<first>-<last>)".

(Answered by Hasan — E-d16b, 2026-10-29 11:22 — kept for the record:) **BLOCKED (builder #16, 2026-10-29 11:15) — orchestrator: put the question in Open problems → "Fix round 4 (builder #16, step 4)
— BLOCKED" to Hasan, then spawn builder #17 for his answer.** Step 4 is DONE (Built / Verified "builder #16"; do not redo it —
its reports `E3\catalog-order-fix4.txt`, `…\vidtsx-e2e\E3\broad-probes-fix4.txt`, `E3\broad-probes-fix4-summary.txt` and the
`fix4-analyze*.cjs` counts are the step-4 numbers for the records), and Status.md :789 is settled (0.34, this commit). **On (A)**
builder #17 does steps 5–7 exactly as builder #15's brief below words them, adding the noun-first class (the numbers in Built
"builder #16") to the records' open notes and Hasan's bar sentence to the verifier-round-5 Next step; **on (B)** builder #17 makes
the tool-layer change red-first in `src/main/services/library/sound-answer.ts` (+ `sound-answer.test.ts`, an
`audio-tools-fill.test.ts` row for "a sparkling screen"), re-runs the corpus and both step-4 drivers with the same commands (the
LESS check vs `7967c6f` must stay 0), then steps 5–7; **on (C)** builder #17 writes the DONE-PARTIAL records (Status.md E3 entry +
TESTING §18.17) and the track-E exit runs next. NO matcher change in any case unless Hasan says so.

(Step 4 DONE by builder #16 — kept for the record:) **FIX ROUND 4, continued — builder #16: step 4 (regression + broad probes), then steps 5–7 (steps 1–3 are DONE — builder #13
`34feafe` the fill, builder #14 `9a13e3b` the corpus, builder #15 `d30830a` the (iv) record fixes: Built / Verified "builder #13" /
"#14" / "#15"; do not redo them; NO matcher change — `git diff 7967c6f --` the three matcher files must stay empty).** Do step 4
exactly as builder #15's brief below words it (from "**Step 4 — regression + broad probes**" to its end: the E3 index READ-ONLY with
SHA-256 + mtime before / after and its 4 `generated/` entries excluded; the ANSWER at HEAD vs `788c8d2` / `09e81ea` / `7967c6f` over
the 1,073 rows → `E3\catalog-order-fix4.txt`; builder #11's frames PLUS participle + noun and adjective + verb-form →
`C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\broad-probes-fix4.txt` + a kit summary; count probes / answer changed / a right clip LOST
/ a confident first changed; READ the changed rows; a LESS case with no right clip shown = fix in `sound-answer.ts` + re-run, or
BLOCKED), then steps 5–7 as written there. Two additions: (a) while the 7967c6f rankings are out, print "shutting down" / "shutting
off" / the other F3 shutting rows and settle Status.md :789 "(dash-zip 0.26–0.32 / trap-snap 0.32 / chess-piece-thock 0.38)" (open
item (16)) — if no F3 shutting row scores 0.32, correct it to 0.34 in step 7 (Edit tool; trap-snap is 0.3424 on "shutting down",
`E3\fix4-rank.txt:46-48`); (b) step 7's Status.md bullet also names step 3 (`d30830a`, the five nits + note 1) — the record's line
pointers moved by step 3 (re-grep before quoting).

(Step 3 DONE by builder #15, `d30830a` — kept for the record:) **FIX ROUND 4, continued — builder #15: step 3 (the record fixes), then steps 4–7 (steps 1–2 are DONE — builder #13 `34feafe`
the fill, builder #14 `9a13e3b` the corpus: Built / Verified "builder #13" / "builder #14"; do not redo them; NO matcher change —
`git diff 7967c6f --` the three matcher files must stay empty).** **Step 3 — the record fixes** (Edit tool; line numbers as of
`9a13e3b`): Status.md :189 "the whooshes at 0.41" → 0.38; :213 "trap-snap 0.32 on" (… "shutting down") → 0.34; :215 "power-down
0.46" → 0.43; :305 "(riser-soft says build / build-up)" → "(riser-soft says build / building)"; the same false comment in
`src/main/services/library/sound-match-corpus-r3-ordinary.test.ts:16` ("riser-soft says build-up" → "riser-soft says build /
building"); verifier note 1 — Status.md :406, :410 and :780 "the right clip FIRST in the nearest" → "the right clip in the nearest —
SECOND in four of the seven adjective + verb-form phrasings ('a soft / gentle / loud knocking' list chess-piece-capture first on an
exact tie, 'a slow ticking' ui-click-soft first)" (grep TESTING §18.17 for the same claim too); commit (`docs(studio): E3 fix round 4
— the (iv) record fixes`, explicit paths). **Step 4 — regression + broad probes** (the E3 index READ-ONLY: SHA-256 + mtime before /
after, its 4 `generated/` entries excluded from the pool; never a generating driver there): the ANSWER at HEAD (`selectSoundAnswer`,
labels) vs the answers of `788c8d2` / `09e81ea` (their matcher's top three — `E3\sound-match-788.ts`, `sound-match-09e.ts` present)
and `7967c6f` (matches top three, else nearest top three) over the 1,073 rows (809 + the r4 files' 264; `rowsOf()` in
`E3\fix4-corpus.e3.test.ts` reads the files) → `E3\catalog-order-fix4.txt`; the broad set = builder #11's frames
(`E3\broad-fix3.e3.test.ts`: every inflection of every tag / category / file-name word, bare / "a w" / "a w sound" / "a soft w", the
placement openers, the leading adverbs / wrappers) PLUS participle + noun ("a <-ed / -ing form> <noun>" with the nouns that are other
clips' words — screen, note, photo, message, board, device, door, card, …) and adjective + verb-form ("a soft / gentle / loud / slow /
quiet <-ing form>") → `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\broad-probes-fix4.txt` + a summary in the kit; per probe the old
answers vs the new (labels), counted: probes, answer changed, a right clip LOST from the answer (the LESS check — the corpus has one,
"a moving transition", Open problems), a confident first changed; READ the changed rows; a LESS case where no right clip stays shown =
fix it in the tool layer (`sound-answer.ts`, never the matcher) + re-run, or BLOCKED with the cases; list the frames in the record.
Then **step 5 gates** (CPU + top processes → `…\vidtsx-e2e\E3\cpu-fix4.txt`; the resource guard; 0 `electron.exe` of ours; the full
worktree vitest → `…\vidtsx-e2e\E3\vitest-full-fix4.log`, DRIVING's normal rule or E-d13 — say which run counted — green except the
three E-d2a suites; rule (b) `git diff --name-only 5d77600..HEAD -- src/ scripts/` → `E3\diff-list-fix4.txt` + the three suites' import
graphs → `E3\import-graph-fix4.txt`; tsc web 26 / node 10), **step 6 the rebuild** (`wt/out`, DRIVING "Track E" step 1, log
`E3\build-fix4.log`; `out/main/index.js` holds `The library may have a sound for` + "No library sound matched" + "PLACEMENT_BONUS";
its mtime after the last `src/` commit), **step 7 the records** (the Status.md E3 entry — title + a "Verifier round 4 FAIL (F4) → fix
round 4" bullet: E-d16 + E-d16a, the fill, the labels and wording, the corpus (1,073 rows; red 36 / 266 on the current helper; the
notes), the regression / broad numbers + frames, the gates, the `wt/out` line, E-d16's bar for verifier round 5 in one sentence; the
code list + line counts; open notes — and TESTING §18.17 likewise; every git / tree / build statement "as of `<hash>`", re-checked
after the commit), HANDOFF `status: DONE` with Next step = "E3 verifier round 5 — E3's LAST; bar E-d16 + E-d16a (CDP 9273,
`profiles\E3-verify` may be reused; range `963f3d9..HEAD`; the records to check: Status.md E3 entry :<lines>, TESTING §18.17
:<lines>)", the LOG line, commit.

(Step 2 DONE by builder #14, `9a13e3b` — kept for the record:) **FIX ROUND 4, continued — builder #14: steps 2–7 of the session-9 brief (step 1 is DONE by builder #13, `34feafe` — Built /
Verified "builder #13"; do not redo it; NO matcher change — `git diff 7967c6f -- sound-match.ts sound-match-words.ts
sound-match-vocab.ts` must stay empty).** Start with **step 2, the corpus:** (a) in `src/main/services/library/sound-match-corpus-rows.ts`
make `expectCorpusRow`'s RECALL run over the ANSWER's three — `selectSoundAnswer(rankLibrarySounds(CORPUS_LIBRARY, prompt, { …,
limit: CORPUS_LIBRARY.length }))` from the new `sound-answer.ts` (the same call `sound-reuse.ts` `libraryReuseAnswer` makes) — instead of
matches ∪ nearest (top 3 each); keep the FIRST assertion on `matches[0]` and the `not` list on the matches; run the 809 rows (the 150-row
file + the four r3 files) and record whether any row changed (expected none — say so with the run's counts). (b) State the E-d16 row
convention in the file header: the named clip must be in the answer's three; if the answer's first is `matched` it must be an allowed
clip — EXCEPT (E-d16a) a first at the 0.5 line (|coverage − 0.5| < 1e-9) or tied (within 1e-9) with an allowed clip among the confident
matches, when an allowed clip is in the three (assert that; list these rows as notes in the file); a right clip scoring 0 → '∅' with a
`// vocabulary note`. (c) Add verifier round 4's probes as rows with PLAIN-MEANING outcomes in new `sound-match-corpus-r4-*.test.ts`
files (≤ ~300 lines each, `describeCorpus` counts): `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3-verify\r4\g-probe.txt` (32),
`c-ordinary.txt` (236 — fix wrong expectations, say which), `f-probe.txt` (adjective + verb-form and participle + noun sections — write
the verdicts). Record the new rows' red count on the recall of matches ∪ nearest (the CURRENT corpus helper, before (a)) — or say which
baseline you used — then green. Then steps 3–7 of the brief exactly (records fixes, regression + broad probes with the frames listed,
gates, rebuild with the marker **`The library may have a sound for`** + "No library sound matched" + "PLACEMENT_BONUS", records, HANDOFF
DONE). Inputs ready: the full `7967c6f` rankings for 24 prompts in `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\fix4-rank.txt`.

**Session 9 (orchestrator, 2026-10-29 10:40) — E-d16a binds fix round 4 (ORCHESTRATOR.md "Session 9"):** E-d16's literal fill fails its
own bar on "a breaking screen" (`power-down` exactly 0.50 + two weak head-rule matches fill the three; the break clips 0.30 unseen).
Hasan (10:33): NO matcher change; **the fill = the confident matches (≥ 0.5, matcher order) first, then the below-threshold sounds —
weak matches AND closest together — by coverage, a closest before a weak match on a tie (epsilon compare)**; for verifier round 5 a
first AT the 0.5 line or TIED with a right clip among the confident matches, with the right clip in the three, is a NOTE, and a right
clip that shares no word with the prompt (scores 0) is a vocabulary NOTE. The brief below is otherwise unchanged.

**FIX ROUND 4 — builder #13 (Hasan's go 2026-10-29 10:07 = decision E-d16, ORCHESTRATOR.md "Stops (session 8)": option 1 below, the
answer-level recall fill, NO matcher change; then verifier round 5 = E3's LAST under E-d16's bar). Session 8 STOPPED 2026-10-29 02:05
on verifier round 4's FAIL (the session-8 rule).** Verifier round 4 FAILED on F4
(Open problems → "Verifier round 4"): the F3a factor (`STEM_STRENGTH = 0.6`, `sound-match-words.ts:35`, `matchStrength` :114-121)
with the equal-hit head rule (`sound-match.ts:159` `headHit` only on `hit.equal`, the match test :166) makes "a cracked screen" /
"a glitching screen" / "a shattered screen" / "a scribbled note" / "a typed note" a CONFIDENT match on the clip whose tag or text
equals the NOUN (`power-down`'s `screen` tag, `chime-reward`'s "bell notes") while the right clip (`break-glass-crack`, `glitch-zap`,
`pencil-scribble`, `keys-typing-soft` — first at `788c8d2` AND `09e81ea`) covers only the verb-form modifier at 0.6 → under 0.5
with no head hit → the nearest list, which a match answer never shows. Through the real handler: "The library already has 1 sound
matching "a cracked screen"" → `library:sfx/power-down.mp3` (`…\E3-verify\r4\h-noprov2.txt`). **Why no threshold tweak settles it:**
"running water" (F3 — the right `stream-soft` hits the HEAD "water" equally, the wrong `dash-zip` hits the modifier "running" by
stem) and "a cracked screen" (F4 — the wrong `power-down` hits the head "screen" equally, the right `break-glass-crack` hits the
modifier "cracked" by stem) are the SAME lexical shape; which word carries the sound is semantic. The verifier's `STEM_STRENGTH = 1`
probe reverts 13 of the 14 F4 firsts (`g-probe-STEM1.txt`) but brings F3's 0.50 tie back; ranking by unfactored coverage brings
"shutting down" → `trap-snap` back. Two ways forward:
1. **(Recommended) The answer-level recall fill — proposed E-d16.** The tool answer always shows up to THREE sounds: the matches
   first, then the closest other candidates (coverage > 0) to fill the three, each row labelled `matched` / `weak match` (a head-rule
   match under 0.5) / `closest`; when every match is weak the wording says the library "may have" the sound; `force: true` as now
   (`sound-reuse.ts` `formatSoundMatches` / `libraryReuseAnswer`; `rankLibrarySounds` already returns both lists). So the right clip is
   in front of the model on BOTH shapes ("a cracked screen": `power-down` weak 0.43, `break-glass-crack` closest 0.34 — the model
   reads "a pane of glass cracking" against "a device switching off" and picks; "running water": `stream-soft` matched, `dash-zip`
   closest). Tool layer only — no matcher change; `audio-tools-miss.test.ts` / `-reuse.test.ts` rows red first; the corpus RECALL
   assertion extended to the ANSWER's three (`expectCorpusRow`); corpus rows for the verifier's 14 F4 phrasings (`…\E3-verify\r4\
   g-probe.txt`) and its 236-phrasing ordinary set (`c-ordinary.txt`) with plain-meaning outcomes; the (iv) nits fixed in the records
   (Status.md :189 "0.41" → 0.38, :213 "trap-snap 0.32" → 0.34, :215 "power-down 0.46" → 0.43, :305 "(riser-soft says build /
   build-up)" → "build / building" — and the same comment in `sound-match-corpus-r3-ordinary.test.ts:16`) and the verifier's note 1
   ("the right clip FIRST in the nearest" → in the nearest, SECOND in four of the seven phrasings); the regression + broad-probe
   reports re-run with participle + noun frames added; gates; rebuild; records. **The bar for a verifier round 5 (E-d16):** (i) the
   corpus; (ii) an ordinary phrasing where the library has the sound and the right clip is NOT among the answer's three; (iii) a
   confident (≥ 0.5) match that puts a clearly wrong sound first while the right clip exists; (iv) a false record — a weak match
   first with the right clip beside it is a note.
2. **(Alternative) Stop E3 here as DONE-PARTIAL** (the exit is MET live — the whoosh case ×2, the stand-in generation found before
   regenerated, the Assets screen plays; the matcher is a recorded heuristic with four rounds of notes): F4 and round 4's notes go on
   Hasan's real-video list; the track-E exit runs next. Cheaper, but F4-shaped prompts keep telling the model "the library already
   has 1 sound" with the wrong clip until a later round.

(Done 2026-10-29 01:24–02:00 — FAIL on F4, see Open problems; kept for the record:) **E3 verifier round 4 — E3's LAST; the bar is E-d15 (i)–(iv)** (orchestrator: spawn it — CDP 9273, its own `profiles\E3-verify`
copy WITHOUT `settings.db*` may be reused (verifier scratch; its library holds its own stand-in files under `generated/`); range
`e98190f..HEAD` — the corpus `574edbc`, the matcher `02e2a10`, the miss rule `7967c6f`, the records `3cff0be` (the other commits in
the range are docs); the records to check: Status.md E3 entry **:10-852** (the fix-round-3 bullet :137-421, the code list :422-,
the `wt/out` line, Gates :645-, open items (16)–(23) :777-, evidence :821-), TESTING **§18.17 :524-540** (the F3 item :533, the
prompt rule :534, Gates :539, Not measured :540). The builders' E3 profile is read-only evidence (its index holds 4 `generated/`
entries — never run the stand-in driver on it; the regression / broad drivers exclude `generated/`). A FAIL there stops the run
(E-d15); a PASS → the track-E exit (`E-exit/HANDOFF.md`; its step 6 reads the miss rule). Fix round 3 is DONE (builders #9–#12);
no `src/` change since `7967c6f`, `wt/out` is its build.

(Item 4d DONE by builder #12, 2026-10-29 — kept for the record:) **FIX ROUND 3, continued — builder #12: item 4d, THE RECORDS (items 1–3 and 4a–4c are DONE — builder #9 `574edbc` `02e2a10`,
builder #10 `7967c6f`, builder #11 docs-only — do not redo them; no `src/` change, no gate re-run, no rebuild, no launch, no model turn
is needed). Edit / Write tools only. (1) The Status.md E3 entry (:10-453 as of `1d7d5ed`): its title → "…— DONE (fix round 3 after
verifier round 3 FAIL on F3, a matcher defect — builders #9–#11, E-d15: stem hits weigh less, openers / adverbs, the miss rule; fix round
2 …; fix round 1 …; the E3 verifier round 4 — E3's last — is next)"; a new "**Verifier round 3 FAIL (F3 matcher: the -ing stem `running`
→ `run` hit dash-zip's `run` tag — 'running water' → dash-zip first) → fix round 3 `574edbc` `02e2a10` `7967c6f`**" bullet after the
round-2 bullet, in its style, with sub-bullets carrying Built / Verified "builder #9", "#10" and "#11" verbatim in substance: F3 and
its fix (`matchStrength()` 1 vs `STEM_STRENGTH` 0.6 for a verb form; the head rule needs an EQUAL hit; `run` / `running` stays a match at
0.6); F3b (openers / adverbs / trailing words / wrappers / determiners; quantifier-of; the comparatives); F3c; the new
`sound-match-vocab.ts`; the corpus extension (659 rows in four files + `sound-match-corpus-rows.ts`; red **88** / 659 on `09e81ea` — the
`574edbc` message's 87 is a typo; the 38 `*` rows; the recall rows; builder #10's 10 rows → ∅ and why); MI / MJ pinned
(`sound-match-bonus.test.ts`) with their reds; the miss rule (E-d15) — the answer wording, the tool / prompt sentences,
`audio-tools-miss.test.ts` red 11 → green 48 files / 1,187 tests, the real-handler results incl. the corrected cuckoo fact; the
regression numbers vs BOTH old versions and the strict lists (4a); the broad-probe numbers, the classification and the one noted class
(4b, with the `probe-fix3.txt` numbers); builder #9's intentional first changes; the gates (4c: CPU → the normal rule, run 2 counted
503 / 3 / 5 files, 5,097 / 9 / 35 tests, rule (b) NONE over 99, tsc 26 / 10) and the `wt/out` line (the build line in Verified);
**E-d15's verifier bar in one sentence** ("verifier round 4 fails E3 only for (i) a corpus row failing — the 150 rows plus verifier
round 3's probes with plain-meaning outcomes, (ii) an ordinary phrasing where the library clearly has the sound and the tool generates
without `force`, (iii) an F1 / F2 / F3-class phrasing where a confident match puts a clearly wrong sound first while the right clip
exists, (iv) a false record; a right clip second or third, a stranger in the nearest list, or another class is a note for Hasan's
list"); the code list + line counts as of `7967c6f` (`sound-match.ts` 181, `sound-match-words.ts` 211, `sound-match-vocab.ts` 90 NEW,
`sound-match-corpus-rows.ts` 79 NEW, `sound-reuse.ts` 74, `audio-tools.ts` 199, `audio-tools-miss.test.ts` 180 NEW,
`sound-match-bonus.test.ts` 47 NEW, the corpus files 192 / 69 / 86 / 57 / 45, `sound-match-words.test.ts` 115, the prompt test 200);
the "Not measured / open" notes carried + the Open-problems notes of builders #9, #10 and #11 (what the miss rule changes for the live
cuckoo case: on a clean library it answers the nearest three; on the E3 profile the cuckoo is a MATCH on the live step's generated
file; the live turn belongs to the track-E exit); the evidence list (every file builders #9–#11 wrote — Built "builder #11" names them;
the C: files `cpu-fix3.txt`, `vitest-full-fix3.log`, `vitest-fix3-flow-render-alone.log`, `vitest-full-fix3-2.log` (counted),
`tsc-web-fix3.log`, `tsc-node-fix3.log`, `broad-probes-fix3.txt`; the D: kit files). (2) TESTING §18.17 (:524-539) likewise: a new
item after the F2 item (:532) covering fix round 3 as above; the Gates item (:538) extended with this round's counted run; the "Not
measured" item (:539) updated with the round-3 notes. (3) Every git / tree / build statement "as of `<hash>`", re-checked AFTER the
records commit: `git log -1 --format=%h -- src/` → `7967c6f`; `git diff --stat 7967c6f..HEAD -- src/ scripts/` empty; `git diff
--name-only 5d77600..HEAD -- src/ scripts/ | diff - E3\diff-list-fix3.txt` identical (99); `out/main/index.js` holds "No library sound
matched" and its mtime is after 00:38 (the `7967c6f` commit time 00:3x — see the build line). (4) Commit (explicit paths: `Status.md
docs/studio/TESTING.md docs/studio/end-to-end/E3/HANDOFF.md docs/studio/end-to-end/E3/LOG.md`), HANDOFF `status: DONE` with Next step
= "E3 verifier round 4 — E3's LAST; the bar is E-d15 (i)–(iv) (CDP 9273, `profiles\E3-verify` may be reused; range `e98190f..HEAD`; the
records to check: Status.md E3 entry :<first>-<last>, TESTING §18.17 :<first>-<last>)", the LOG line, commit.

(Items 4a–4c DONE by builder #11, 2026-10-29 — kept for the record:) **FIX ROUND 3, continued — builder #11: item 4 (items 1–3 are DONE — builder #9 `574edbc` `02e2a10`, builder #10 `7967c6f`; do
not redo them). Exactly the session-8 brief's item 4, in this order; commit at each green checkpoint; hand off per the 30 % rule:**
(1) **The regression report** over the WHOLE extended corpus (150 + 659 rows) on the real index, READ-ONLY (SHA-256 + mtime before /
after — take "before" from the index AS IT IS NOW: builder #10's stand-in driver added two `generated/` entries; the pool excludes
`generated/`): copy `E3\catalog-fix2.e3.test.ts` → `catalog-fix3.e3.test.ts`; old = `788c8d2` (`E3\sound-match-788.ts`, present) AND
`09e81ea` (`git show 09e81ea:src/main/services/library/sound-match.ts` and `…/sound-match-words.ts` into the kit as
`sound-match-09e.ts` / `sound-match-words-09e.ts`, the relative import between them re-pointed) vs HEAD → `E3\catalog-order-fix3.txt`:
every changed row (old first / new first, old top 3 / new top 3, and for a new miss the nearest 3 from `nearestLibrarySounds`), a
summary (rows, changed, first changed, matches lost, matches gained), and the statement that no row lost a CORRECT match or first
result — or which did and why (builder #9's intentional first changes are listed under Open problems "Fix round 3 (builder #9)");
the rows = the four r3 files' arrays + the 150-row file's (import them, or extract with a scratch script as `corpus-extract.cjs` did).
(2) **The BROAD probe set** (E-d15; required before "no regression"): every inflection (-s, -es, -ing, -ed, -y; -er where it is a
real word) of every tag / category / file-name word of the 51 catalog clips, bare and as "a <word>" / "a <word> sound" / "a soft
<word>"; plus each base phrase with the placement openers (`… when the slide changes`, `… every time the slide changes`, `… the
moment the logo lands`, `… right at the first cut`, `… shortly after the cut`, `… exactly when the slide changes`, `… only when …`)
and a leading adverb / wrapper ("right …", "just …", "could you add …"); old (`788c8d2`, `09e81ea`) vs new, old / new top 3 per probe
(+ the nearest 3 on a new miss) → `E3\broad-probes-fix3.txt` (> ~1 MB → `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\`) with a
summary (probes, changed, first changed, worse firsts); READ the changed rows yourself: every changed first must be an improvement
or a documented tie; a worse first on an ordinary phrasing where the library has the sound = fix it (then the corpus + the miss
tests green again, commit) or return BLOCKED with the case; list every worse first in HANDOFF. (3) **Gates:** CPU first
(`Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average` + the top processes over 5 s →
`…\vidtsx-e2e\E3\cpu-fix3.txt`); the resource guard; 0 `electron.exe` of ours; the full worktree vitest →
`…\vidtsx-e2e\E3\vitest-full-fix3.log` (DRIVING's normal rule, or E-d13 under measured load — say which run counted), green except
the three E-d2a suites; rule (b): `git diff --name-only 5d77600..HEAD -- src/ scripts/` → `E3\diff-list-fix3.txt`, the three
suites' import graphs → `E3\import-graph-fix3.txt` (the fix-2 method); tsc web 26 / node 10 (`…\vidtsx-e2e\E3\tsc-web-fix3.log` /
`tsc-node-fix3.log`). (4) **Rebuild `wt/out`** (DRIVING "Track E" step 1; 0 `electron.exe` first; log `E3\build-fix3.log`); confirm
`out/main/index.js` holds "No library sound matched" and note its mtime vs the last `src/` commit. (5) **Records:** the Status.md E3
entry (its title → "…; verifier round 3 FAIL on F3, a matcher defect → fix round 3 (builders #9–#11, E-d15: the miss rule); the E3
verifier round 4 — E3's last — is next"; a new "**Verifier round 3 FAIL (F3 matcher: the -ing stem `running` → `run` hit dash-zip's
`run` tag) → fix round 3 `02e2a10` `7967c6f` `<yours>`**" bullet in the style of the round-1 / round-2 bullets, carrying everything
in Built / Verified "builder #9" + "builder #10": F3a / F3b / F3c with the 0.6 factor and the equal-hit head rule; the corpus
extension — 659 rows in four files, red 88 / 659 on `09e81ea`, the 38 `*` rows, the recall rows; the miss rule — its wording, the
tool / prompt sentences, its tests, the real-handler results, the 10 '∅' recall rows and why; the regression numbers vs BOTH old
versions; the broad-probe numbers + the worse-firsts list; MI / MJ pinned with their reds; builder #9's intentional first changes;
the gates + the `wt/out` line; E-d15's bar in one sentence), the code list + line counts (`sound-match.ts` 181,
`sound-match-words.ts` 211, `sound-match-vocab.ts` 90, `sound-match-corpus-rows.ts` 79, `sound-reuse.ts` 74, `audio-tools.ts` 199,
`audio-tools-miss.test.ts` 180, the corpus files), "Not measured / open" carried + what the miss rule changes for the live cuckoo
case (it now answers the closest library sounds; on the E3 profile the cuckoo is a MATCH on the live step's generated cuckoo; the
live turn is the track-E exit's); TESTING §18.17 likewise (a new item after the F2 item, the Gates item extended, the "Not measured"
item updated). Every git / tree / build statement "as of `<hash>`", re-checked AFTER the records commit (`git log -1 --format=%h --
src/`, `git diff --stat <code-hash>..HEAD -- src/ scripts/` empty, the diff list count unchanged). Commit (explicit paths), HANDOFF
`status: DONE` with Next step = "E3 verifier round 4 — E3's LAST; the bar is E-d15 (i)–(iv) (CDP 9273, `profiles\E3-verify` may be
reused; range `e98190f..HEAD`; the records to check: Status.md E3 entry :<lines>, TESTING §18.17 :<lines>)", the LOG line, commit.

(Item 3 DONE by builder #10, 2026-10-29 — kept for the record:) **FIX ROUND 3, continued — builder #10: items 3–4 below (items 1–2 are DONE by builder #9 — Built / Verified "Fix round 3";
do not redo them). Red first, commit at each green checkpoint, hand off per the 30 % rule.** What is in place for item 3:
`rankLibrarySounds()` / `nearestLibrarySounds()` in `sound-match.ts` (the pure half). To build (the design, so it is not
re-derived): (a) `agent-tools/sound-reuse.ts` — `libraryReuseAnswer()` returns `{ kind: 'match' | 'nearest'; text: string } |
null` (null = a TRUE miss: `matches` and `nearest` both empty — or the index unreadable); a new `formatNearestSounds(nearest,
prompt, toolName)` wording DIFFERENT from the match case: `No library sound matched "<prompt>" well — nothing was generated (no
cost, no provider needed). The closest library sounds:` + the E2 `formatLibraryRow` rows + `If one of them fits, place it with
insert_asset(assetId: "library:<first>", lane: "audio", at: …). If none fits, call <tool> again with force: true to generate a
new one.`; (b) `audio-tools.ts` `:132-135` / `:172-178`: `if (reuse) return text(reuse.text)` (both kinds generate nothing;
`force` skips the lookup as now; a `compositionPlan` music call skips it; keep `minDurationSec` for the nearest too — a bed
that cannot cover the asked length is useless either way: stated choice); `REUSE_NOTE` + `FORCE_HINT` each gain one sentence
("on a miss it answers the three closest library sounds instead of generating; only when nothing in the library scores does
it generate without force"); (c) `studio-agent-prompt-tools.ts` `:21` / `:31` / `:32` / `:70` / `:75` say the miss rule in one
sentence each, pinned in `studio-agent-prompt.test.ts` (extend the E3 describe); (d) tests red first in a NEW
`agent-tools/audio-tools-miss.test.ts` (the reuse test is 173 lines; same mocks — read `audio-tools-reuse.test.ts` first): a
miss answers the nearest three with the index's candidates and calls neither the engine nor `hasAudioProvider` nor the
normalizer; a true miss (a prompt with no word in any clip, e.g. "a cuckoo clock chime" on the whoosh-only mock) generates; `force`
generates; music likewise; the answer text contains `force: true` and differs from "The library already has"; (e) the corpus
RECALL assertion in `sound-match-corpus-rows.ts` `describeCorpus()`: for every row whose expected is not '*' and holds a
clip id, some allowed clip must be in `matches` ∪ `nearestLibrarySounds(…)` (top 3 each) — the 'x|∅' rows are where it
bites; a row whose clip scores 0 there (e.g. "a dying battery" → power-down has no word of it) becomes '∅' — list those
rows (they are plain-meaning corrections, not taste); (f) the stopped-app REAL-handler drivers (`E3\tools-noprovider.e3.test.ts`,
`tools-standin.e3.test.ts`, `vitest.e3.config.ts`): the cuckoo with no provider → the nearest three named, 0 files, index
byte-identical; the stand-in: a no-word prompt generates, the cuckoo with `force: true` generates once, the whoosh / lofi
answers unchanged. Then item 4 exactly as written below (the regression report also vs `788c8d2` AND `09e81ea`; the broad
probe set; gates; rebuild; records — Status.md E3 entry + TESTING §18.17 with the numbers above and the open notes under
"Fix round 3 (builder #9)").

(Items 1–2 DONE by builder #9, 2026-10-29 — kept for the record:) **FIX ROUND 3 — builder #9 (Hasan's go 2026-10-28 23:34 = decision E-d15 in ORCHESTRATOR.md "Session 7": items 1–4 below, item 3
INCLUDED — read E-d15 for the exact miss rule and verifier round 4's bar).** Verifier round 3 FAILED on F3 (Open problems →
"Verifier round 3"). Red first, commit at each green checkpoint, hand off per the 30 % rule:
1. **Corpus first:** add verifier round 3's probes (`C:\Users\hasan\AppData\Local\vidtsx-e2e\E3-verify\r3\b-probes.txt`,
   `c-probes2.txt`, `c-probes3.txt`) with the right outcome by plain meaning — at least "running water" / "the sound of running
   water" / "a running brook" / "a running stream" → `stream-soft` first; "a tap running" / "water running over rocks" → never
   `dash-zip`; "shutting down" / "shutting off" / "a shutting down sound" → `power-down` first; "moving air" → `wind-soft` first;
   "a whoosh shortly after the cut", "Add a soft whoosh right at the first cut.", "a whoosh every time / each time / the moment the
   slide changes", "every time the slide changes, a whoosh", "a whoosh exactly when the slide changes" → a whoosh first;
   "swooshing" / "swooshed" / "wooshing" → a whoosh. Run red, record.
2. **F3a (the F2 class):** a word that matches only by stem must not tie or beat an equal-word hit — e.g. a stem-only hit weighs
   less than an equal hit (your factor, stated), and a clip whose only strong hit is a stem hit ranks after one with an equal hit.
   **F3b (the F1 class):** multi-word placement openers (`every time`, `each time`, `any time`, `the moment`, `the instant`, `the
   second`) and the adverbs that lead into a placement or a preposition (`right`, `exactly`, `only`, `even`, `just`, `shortly`,
   `immediately`; trailing `here` / `now` / `again` / `too`) never become the head word. **F3c:** stem before the `SAME_SOUND` map
   (swooshing = whooshing). Pin MI (the bonus cap) and MJ (the bonus applied only after the match threshold) with tests.
3. **The miss rule (Hasan chose it, E-d15):** make a matcher MISS cheap — when nothing reaches the threshold but the library
   holds candidates (coverage > 0), `generate_sfx` / `generate_music` answer the three nearest as "closest library sounds — none
   matched well; call again with `force: true` to generate", so every generation follows the model having seen the library. Then
   the matcher's bar is recall (the right clip in the top 3) and the model picks; one extra tool call on a true miss (the cuckoo).
4. Regression report old `788c8d2` and `09e81ea` vs new over the whole extended corpus; gates; rebuild `wt/out`; records (Status.md
   E3 entry — also its title, which still says "the E3 verifier round 3 is next" — and TESTING §18.17).
5. **Verifier round 4** (Hasan's go, E-d15) — E3's LAST: a FAIL stops the run; its bar is E-d15's (i)–(iv).

(Superseded 2026-10-28 23:15 by the round-3 FAIL:) **E3 verifier round 3 — the bar is E-d14** (CDP 9273, its own `profiles\E3-verify` copy WITHOUT `settings.db*` may be reused;
range `0e168cf..HEAD` — the fix `09e81ea`, the records `5e56594`; the records to check: Status.md E3 entry :10-453, TESTING
§18.17 :524-539). **E3's LAST round** (two FAILs already — a third stops the run). Fix round 2 is DONE (builders #7–#8).

(Done by builder #8, 2026-10-28 — kept for the record:) **Builder #8 (fix round 2, continued): write the records — step 5 of the brief below — then HANDOFF `status: DONE`.** Steps
1–4 are DONE by builder #7 (Built / Verified "Fix round 2"; code `09e81ea`; gates counted under DRIVING's normal rule, NOT
E-d13; `wt/out` rebuilt at `09e81ea`). No `src/` change, no gate re-run, no launch, no model turn is needed. Update the
Status.md E3 entry (title / Result / the code list: + `09e81ea`, `sound-match.ts` 141 + `sound-match-words.ts` 179 lines, the
corpus fixture + test + `sound-match-words.test.ts`; the `wt/out` line → rebuilt at `09e81ea`; the Gates paragraph → this
round's (Verified "Fix round 2"); "Not measured / open" → the Open-problems "Fix round 2" notes; the evidence list:
`catalog-order-fix2.txt`, `fix2-corpus-red.log`, `fix2-green.log`, `cpu-fix2.txt`, the two full-run logs, `build-fix2.log`)
and TESTING §18.17 likewise, with: F2 and its fix; the corpus (150 rows over the 51 clips; red 10 / 150; what it pins); the
regression numbers (24 changed, 7 firsts = the 7 fixes, 2 lost matches = the wrong dash-zip offers, the removed lower
offers + reasons — Verified); the line "verifier round 2 FAIL (F2 matcher: a loose prefix rule — 'a bell rung once' →
dash-zip) → fix round 2 `09e81ea`"; the round-2 notes as listed under Open problems "Fix round 2"; E-d14's bar in one
sentence ("verifier round 3 fails the matcher only for a corpus row failing, a regression vs `788c8d2` on ordinary phrasing,
or an F1 / F2-class phrasing where the library clearly has the sound and the tool finds nothing or a clearly wrong sound
first; other imperfections are notes for Hasan's real-video list"). Every git / build statement "as of `<hash>`", re-checked
AFTER the records commit (`git log -1 --format=%h -- src/` → `09e81ea`; `git diff --stat 09e81ea..HEAD -- src/ scripts/`
empty; the 105-path diff list unchanged except the docs). Commit, HANDOFF `status: DONE` with Next step "E3 verifier round 3
— the bar is E-d14 (CDP 9273, its own `profiles\E3-verify` copy WITHOUT `settings.db*`; range `0e168cf..HEAD`)", LOG line,
commit.

(Steps 1–4 DONE by builder #7, 2026-10-28 — kept for the record:) **FIX ROUND 2 — builder #7 (orchestrator, 2026-10-28 21:55; verifier round 2 FAILED on F2 — see "Verifier round 2" under Open
problems; decision E-d14 below). E3 has 2 of 3 FAILs: a third stops the run.** In order, red first, commit at each green checkpoint:
1. **The corpus, FIRST (it is the acceptance bar, E-d14).** A table-driven test (e.g. `src/main/services/library/sound-match-corpus.test.ts`)
   on a fixture of ALL 51 catalog entries copied verbatim from a real imported index (read-only: `C:\Users\hasan\AppData\Local\vidtsx-e2e\
   profiles\E3\profile\assets\.vidtsx\index.json` — only the fields the matcher reads: relPath, kind, tags, description, audio.category,
   probe.duration). Rows = EVERY prompt used so far with its expected outcome (the expected FIRST result — or a set of acceptable first
   results where two clips tie on a real reason — or "no match"): the builders' 70 (`D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\
   catalog-order-fix1.txt`), verifier round 1's (`C:\Users\hasan\AppData\Local\vidtsx-e2e\E3-verify\c-matcher.json`, `b-noprov.json`) and
   round 2's (`…\E3-verify\r2\a-noprov.json`, `a-noprov-summary.txt`, `c-probe*`) — read them; where a recorded result is WRONG by plain
   meaning (F2's "a bell rung once" → dash-zip; "a snap when the trap closes" → trap-snap must be FIRST; "a soft tick while the countdown
   runs" → clock-tick-soft first; "when the logo lands a deep impact hit" → an impact), the row states the RIGHT outcome. Music rows with
   durations. Run the corpus on the current code → record which rows fail (red).
2. **The fix (E-d14), until the corpus is green:** (a) **F2 — word matching by known inflections only:** replace the "≤ 3 extra letters"
   prefix rule (`wordsMatch`, `sound-match.ts:159-163`) with a list of English suffixes (e.g. s, es, ies↔y, ed, d, ing, er, y — your list,
   stated) so `rung`≠`run` while air/airy, whoosh/whooshes, tick/ticking, pop/popping still match; (b) **placement words become bonus-only:**
   they never count in the coverage denominator (so they cannot sink a match — F1 stays fixed) but a hit adds a small RANKING bonus (so
   "a snap when the trap closes" ranks trap-snap first); they never turn a non-match into a match on their own; (c) **a leading placement
   clause without a comma:** if cutting it leaves no content word, fall back to the uncut words with the placement words as half-weight
   qualifiers (as at `7a0d6ad`). Keep every existing matcher / placement / tool test green.
3. **Regression report:** old (`788c8d2`) vs new over the WHOLE corpus on the real index (a stopped-app driver, read-only — the builders'
   E3 profile index) → `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\catalog-order-fix2.txt`: every changed row, and a statement that
   no row lost a correct match / first result.
4. **Gates + rebuild:** CPU measured; DRIVING's normal gate, or **E-d13** under external load; rule (b); tsc 26 / 10; rebuild `wt/out`.
5. **Records** (Status.md E3 entry + TESTING §18.17; git / build statements "as of `<hash>`", re-checked after the commit): F2 and its fix,
   the corpus test (its size and what it pins), the regression numbers, the line "verifier round 2 FAIL (F2 matcher: a loose prefix rule —
   'a bell rung once' → dash-zip) → fix round 2 `<hash>`", the round-2 notes recorded (leading clause without a comma — now handled or
   stated; after / before near the floor; "a ding" / "a bell ringing once" find nothing though the chimes hold bell notes — fixed by (a) or
   stated), and E-d14's acceptance bar in one sentence. Commit, HANDOFF `status: DONE`, LOG line, commit.

**E-d14 (orchestrator, 2026-10-28 21:55) — the matcher's acceptance bar.** F2 is E3's (the matcher is E3's own code, `6224040`), so round
2 is a FAIL. The matcher is a heuristic: some phrasing will always rank imperfectly. From fix round 2 on, the bar is the CORPUS (step 1 —
every prompt the builders and verifiers have used, with the right outcome by plain meaning) plus the classes already fixed (placement
clauses F1; loose prefix matches F2). Verifier round 3 FAILS the matcher only for (i) a corpus row failing, (ii) a regression versus
`788c8d2` on any ordinary phrasing, or (iii) an ordinary phrasing of the SAME class as F1 / F2 where the library clearly has the sound and
the tool finds nothing or offers a clearly wrong sound first. A different-class imperfection it finds is a NOTE that goes on Hasan's
real-video list ("watch the reuse offers in real use"), with the prompt added to the corpus later. Recorded limits (negation does not
demote; after / before near the 0.30 floor) stay notes.

(Superseded 2026-10-28 by the round-2 FAIL:) **E3 verifier round 2** (orchestrator: spawn it — CDP 9273, its own `profiles\E3-verify` copy WITHOUT `settings.db*`; range
`7a0d6ad..HEAD` for the fix (`b176881` `788c8d2` + the records `f593515`), the earlier findings F1 + notes 1–7 under "Verifier
round 1"; the records to check: Status.md E3 entry :10-325, TESTING §18.17 :524-538). Fix round 1 is DONE (builders #5–#6).

(Done by builder #6, 2026-10-28 — kept for the record:) **Builder #6 (fix round 1, continued): get the COUNTED full worktree vitest run, then write the records (step 4 below).**
Steps 1–2 and the rest of step 3 are DONE (Built / Verified "Fix round 1"; commits `b176881`, `788c8d2`; `wt/out` rebuilt —
see the build line in Verified). First check `(Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average)`,
the guard and 0 `electron.exe`; run `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run >
C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\vitest-full-fix1-6.log 2>&1` from the worktree root (default workers; if a known
LOAD timeout appears, the rule allows up to 3 default tries in total for YOUR session, or one `--maxWorkers=4` run) — the
counted run must be green except the three E-d2a suites (resolution only); if every try under load still shows only DRIVING's
named LOAD timeouts green alone, say so in the records with the table above and let the verifier judge. No `src/` change is
expected (if one is needed, rebuild `wt/out` again and re-run rule (b)). Then step 4 exactly as written below (the records:
Status.md E3 entry — title, "Result" / the code list (+ `b176881` `788c8d2`, `sound-match.ts` now ~250 lines, the new test
files), `wt/out` line :118 (rebuilt at `788c8d2`), the Gates paragraph :186 (replace with this round's), "Not measured / open"
:203 (items (1) and (5) MEASURED by the verifier — move them out with its evidence; (8) `audio-tools.test.ts` now 202 + 173;
add the four new open notes), the evidence list; TESTING §18.17 likewise; every git / build statement "as of `<hash>`",
re-checked AFTER the records commit), commit, HANDOFF `status: DONE`, LOG line, commit.

(Steps 1–3 below: DONE by builder #5 except the counted run.) **FIX ROUND 1 — builder #5 (orchestrator, 2026-10-28; verifier round 1 FAILED on F1, a matcher defect — see "Verifier round 1"
under Open problems).** In order, red first, commit at each green checkpoint:
1. **F1 — the head clause ends at a subordinating conjunction.** `src/main/services/library/sound-match.ts` (`CLAUSE_CUT`
   :45-48, `headClause` :104-117, `promptTerms` :125-131): a placement clause introduced by `when` / `while` / `until` / `once` / `if` /
   `because` / `whenever` / `as soon as` (and any other you find that behaves the same — say which) must END the head clause, so the
   sound words stay the head and the placement words count only as qualifiers (or not at all — your call, stated, with the reason).
   RED FIRST: add the verifier's prompts to `sound-match.test.ts` on a fixture that mirrors the real catalog entries they hit (the
   whooshes, `impact-soft` / `impact-deep-soft`, `ui-click-soft`, `chime-reward` / `chime-magic`, `riser-soft`, `ui-toggle-on`) —
   "a quick whoosh when the slide changes", "a whoosh while the card flies in", "a deep impact hit when the logo lands", "an impact
   when the logo lands", "a hit when the logo lands", "a click when the button is pressed", "a chime when the answer is right", "a
   tension riser until the reveal", "a whoosh once the scene switches" (must offer a whoosh, not only `ui-toggle-on`) — run them
   RED on the current code (record), then fix → green; keep EVERY existing matcher test green (incl. the no-match cases: "a cuckoo
   clock chime", "a dog bark", and the music duration rule). Then a stopped-app driver over a REAL imported index (read-only: the E3
   profile's `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\E3\profile\assets`, or the verifier's `E3-verify` — read only) printing
   the top 3 for the nine prompts + the earlier ranking set (`D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\catalog-order.txt`) →
   `…\E3\catalog-order-fix1.txt`; no prompt that matched before may lose its match or its first result unless you say why.
2. **Note 2 — `generate_music` `force` gets a test** (the verifier's mutation M2b — `generate_music` ignoring `force` — left 12 / 12
   green): pin it in `audio-tools.test.ts` (or a split file — it is 302 lines; splitting it is fine and preferred), and prove the
   mutation now fails (record the red).
3. **Gates + rebuild:** full worktree vitest (default workers when headroom ≥ 10 GB, else `--maxWorkers=2`), green except the three
   E-d2a suites (rule (b) re-run on the new diff list), tsc 26 / 10; rebuild `wt/out` (main code changed) with no app running.
4. **Records** (Status.md E3 entry + TESTING §18.17; every git / build statement "as of `<hash>`"): the F1 fix + its numbers; a line
   "verifier round 1 FAIL (F1 matcher: subordinate clauses) → fix round 1 `<hash>`"; move the two items the verifier MEASURED out of
   "Not measured" with its evidence (a GENERATED file played on screen: tile 0.427 → 1.545 s / details 0.258 → 1.281 s; the details
   player pausing a STILL-playing tile at 2.496 s and the reverse — `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3-verify\live-assets.json`;
   origin chips 56 → 5 / 51); add to "Not measured / open": negation only drops words, never demotes ("a whoosh but not soft" still ranks
   `whoosh-soft` first); `list_assets` "whoosh" also lists `dash-zip`; the native `<audio controls>` renders as a light pill on the dark
   theme; and — for later tracks, not E3's — **the live assistant could not see where the cut was when ONE source asset is split into
   two V1 clips** (verifier's whoosh turn 1 asked for the cut time; the builders' two-asset projects hid it). Commit, HANDOFF `status:
   DONE`, LOG line, commit.

(Superseded 2026-10-28 by the FAIL above:) **Orchestrator:** E3 → VERIFY — spawn the E3 verifier round 1 (CDP 9273, its own `profiles\E3-verify` copy WITHOUT
`settings.db*`; range `ceb250c..HEAD`; the records to check: Status.md E3 entry :10-233, TESTING §18.17 :524-537). Builder
#4 (gates + records) is done: gates green (Verified above), records committed; no code change, no live run.

## Open problems

### Fix round 4 (builder #20, the records) — notes, none blocking

1. **No evidence file disagreed with a HANDOFF or log line** — every count, hash, line count and quoted string re-opened
   (Verified "builder #20") matched builders #13–#19's Built / Verified text.
2. **Stale record lines found in the Status.md E3 entry and fixed in `dbe935a`** (none was in verifier round 4's (iv) list): the
   "For Hasan" line still said "the right clip is first in it" for the adjective + verb-form class (verifier round 4's note 1 —
   `d30830a` corrected the three other places only); "The code" opening said `src/` last changed in `7967c6f` and "every later
   commit is docs"; the `sound-reuse.ts` item said "74 since `7967c6f`" (95 since `34feafe`); the prompt :31 quote was the
   pre-`34feafe` wording; Not measured (9) said `audio-tools-reuse.test.ts` 173 (177 since `34feafe`) and `sound-match.ts` 141 +
   `sound-match-words.ts` 179 "since `09e81ea`" (181 + 211 since `02e2a10` — stale since fix round 3, unflagged by round 4).
3. The E3 entry's Evidence bullet (Status.md, as of `dbe935a` :1080-1111) still lists the fix-round-3 files; fix round 4's report
   and log files are cited inline in the new bullet (:425-602) instead — a verifier looking for them should read there.
4. Status.md's new bullet gives fix round 4's span as "2026-10-29 10:37–12:30" (builder #13's start → builder #20's records); the
   records commit landed 12:22, this HANDOFF commit just after.

### Fix round 4 (builder #19, E-d16d items 1–2) — notes for the records, none blocking (E-d16d's fallback settles the quiet six)

1. **The six F9 "a quiet `<-ing>`" probes are NOTES for verifier round 5** (E-d16d's fallback; Hasan 12:05): "a quiet airing /
   emphasising / singling / snapping / tailing / warming" — no confident row is shown and five `quiet` clips tie above the verb's
   carrier, so E-d16b does not fire; greedy would show a carrier 2nd in all six (`E3\variants-fix4c.txt:7-12`) but was not kept.
2. **Why greedy was not kept, in one line for the records:** once a below row is picked, a SECOND carrier of the same word no longer
   adds a word, so E-d16a's next (often a stranger with more coverage) takes the slot — corpus 5 / broad 56 right clips lost vs
   `c5a6124`, 3 / 20 NEW losses vs `7967c6f`, and the description-cover case undoes E-d16b's own target ("a sparkling screen":
   pop-reveal's description covers "sparkling" → sparkle-soft out, none left). 0 confident firsts moved; the corpus stayed green.
3. Kit hygiene: the greedy module writes `E3\greedy-loaded.txt` on load (the alias proof); it is a scratch file, never committed.

### Fix round 4 (builder #18, items 2–4) — notes for the records, none blocking (E-d16c settles the 9)

1. **The 9 (E-d16c NOTES, Hasan 11:46):** "a clicked / clicking screen", "a screen clicking" (power-down's description "one soft
   click" carries the verb word), "a softed / softing screen", "a screen softing", "a warmed / warming screen", "a screen warming" —
   a shown CONFIDENT clip's own text carries the prompt word, so the E-d16b rule cannot fire; each first was already first at
   `09e81ea`. `E3\broad-probes-fix4b-summary.txt` "right in the three: false" = 9.
2. **"a sucking whoosh before the reveal"** (catalog, -r4-ordinary): whoosh-soft / whoosh-wind replaced by pop-reveal / impact-deep-soft
   (they cover `reveal`, which whoosh-reverse does not); whoosh-reverse stays first and confident — a "stranger in the three" NOTE.
   The catalog's LOST vs `7967c6f` is 2 (this + "a moving transition"), vs `34feafe` 1 (this); none-left 0 everywhere.
3. **"a soft crunching" side effect** (15 F4 probes): when the confident clip covers the verb but not `soft`, a "-soft" FILE NAME
   (whoosh-soft / impact-soft 0.16–0.18) takes the slot of a second verb clip (break-crash-digital 0.30, chess-piece-thock 0.49,
   crunch-bite 0.49 …); the right clip stays first — a NOTE (a stranger in the three).
4. **F9 "a quiet `<-ing>`" — 6 probes with no carrier in the three, at `7967c6f` already (fix round 3's matcher, not the fill):** "a
   quiet airing / emphasising / singling / snapping / tailing / warming" → three `quiet` clips at 0.31–0.36 (clock-tick-soft,
   keys-typing-soft, scan-hum; flame-snuff, owl-hoot tie), the verb's carrier 6th (0.25–0.29). No confident row → E-d16b does not
   apply; NO matcher change (E-d16 / E-d16c "no more code"). **Risk for verifier round 5: "a quiet snapping" / "a quiet warming" read as
   ordinary phrasings could be called bar (ii)** — the orchestrator may want Hasan's word before round 5 (they were in builder #16's
   22, so they are not new).

### Fix round 4 (builder #17, item 1) — notes for the records, none blocking

- **What the E-d16b rule leaves (the experiment, `E3\variants-fix4b.txt` section "any — noun-first, no right clip: 9"; to be
  re-counted by item 2's `broad-fix4b` summary):** 9 of builder #16's 51 — "a clicked / clicking screen", "a screen clicking"
  (`[matched] power-down 0.71 | pop-reveal 0.33 | scan-hum 0.33`), "a softed / softing screen", "a screen softing" (`power-down 0.89
  | [matched] pop-reveal 0.56 | scan-hum 0.49`), "a warmed / warming screen", "a screen warming" (`power-down 0.64 | [matched]
  pop-reveal 0.51 | scan-hum 0.38`). **Why:** the shown confident rows' OWN text carries every prompt word — power-down's
  description "one soft click … like a laptop screen dying" (fixture :53) covers `clicking` / `soft`; pop-reveal's "Rounded warm
  bubble pop … gentle soft pop … on screen" (fixture :52) covers `warm` / `soft` — so by the matcher's coverage no word is uncovered
  and the rule (by its letter) does not fire. Reaching them needs the strong-field reading, which costs 6 right clips vs `34feafe`
  (Built "builder #17"). Each first was already the first at `09e81ea` (builder #16: none of the 51 had a verb carrier first
  there). For the records: an E-d16b-shaped note (long-standing first), but the right clip is NOT in the three — the verifier's
  (ii) call on "a clicking screen" (the one ordinary phrasing of the 9; "softed / warming screen" are frame artefacts).
- **Stated choices:** (1) "covers" = any field, any strength (the experiment); (2) the groups are formed ONCE against the shown
  confident rows (Hasan's "within each group"), not re-formed after each below row is placed — so "a whooshing screen" shows two
  whooshes rather than whoosh + a screen clip; (3) no confident row → E-d16a's order (equivalent: every scoring row covers some
  word). (4) The prompt is a required second argument of `selectSoundAnswer` (tsc catches a caller that forgets it; the kit's
  `fix4-corpus.e3.test.ts` / `fix4-lib.ts` still call it with one argument — builder #14's / #16's finished reports, not re-run).

### Fix round 4 (builder #16, step 4) — ANSWERED by Hasan (E-d16b, 2026-10-29 11:22: option B, the word-diversity rule + a long-standing confident first is a note); kept for the record — the question E-d16 / E-d16a did not settle

- **The question (one paragraph).** The fill regresses nothing — vs `7967c6f` no broad probe and no corpus row loses its last right
  clip (the corpus's one LOST row is "a moving transition", the recorded note) and no confident first moves — and every fix-round-3
  regression in the participle + noun frames lands AT the 0.5 line with the verb carrier in the three (E-d16a notes, 1,648 probes).
  But 2,085 broad probes (F7 / F8) have a CONFIDENT first ABOVE the line (0.53–0.89) on the clip that carries only the NOUN; 2,061
  of them already had that first (or a non-carrier first) at `09e81ea` and many at `788c8d2` (the matcher's noun field weight, not
  a fix-round regression); 24 regressed, all "a longed / longing `<noun>`" nonsense. In 51 of them — all "… screen": "a sparkling /
  clicking / ticking / whooshing / snapping screen", their "a screen …-ing" forms, and nonsense forms — the verb carrier is NOT in
  the three, because the two weak head-rule screen clips (`pop-reveal`, `scan-hum`) outrank it by coverage under E-d16a's order
  ("a sparkling screen" → `[matched] power-down 0.53 | [weak match] pop-reveal 0.49 | [weak match] scan-hum 0.32`, sparkle-soft not
  shown); in the other 2,034 the verb carrier is a `[closest]` row ("a zapped device" → `[matched] power-down 0.54 | [closest]
  glitch-zap 0.28 | [closest] zap-electric 0.28`). By E-d16's letter, verifier round 5 could FAIL on such a phrasing under (ii)
  (the right clip not among the three) or (iii) (a confident first ≥ 0.5 that is clearly wrong while the right clip exists) — the
  bar does not say whether behaviour that is the same at `09e81ea` / `788c8d2` counts — and the fill cannot reach these without
  departing from E-d16a's "by coverage" order, while E-d16 forbids a matcher change. **Hasan, which: (A) record them as notes and go
  to steps 5–7 → verifier round 5, with one added bar sentence ("a confident first that is the same at `09e81ea` is a note; so is
  a right clip that the fill does not show where `7967c6f` did not either") — builder's recommendation: the fill met its goal
  (6,482 probes gain a right clip, none loses one) and the class is as old as the matcher; (B) amend E-d16a in the tool layer —
  after the confident rows, a below-threshold row that covers a prompt word no shown row covers goes before a row that covers only
  words already covered (expected to put sparkle-soft / ui-click-soft / clock-tick-soft / the whooshes into the 51 — to be
  verified red-first; the corpus + both step-4 drivers re-run), then steps 5–7; or (C) stop E3 as DONE-PARTIAL with this class on
  your real-video list?**
- The evidence: Built / Verified "builder #16"; the 51 = the lines of the kit summary's section "a CONFIDENT fill first that carries
  only the NOUN" whose coverage is above 0.50 and that end `right in the three: false`; the 24 = `fix4-analyze3.cjs`'s `overR09`
  set (it counts them; the list was printed with an inline reader over the same broad file — "a longed / longing" × the 8 nouns
  photo, message, device, door, page, glass, book, timer in F7 / F8); the broad file holds every probe's four answers.

### Fix round 4 (builder #15, step 3) — notes for the records, none blocking

- Status.md :789 (open item (16), as of `d30830a`) says "the F3 rows would stay unmatched (dash-zip 0.26–0.32 / trap-snap 0.32 /
  chess-piece-thock 0.38 …)"; the verifier flagged only :213's "trap-snap 0.32 on 'shutting down'" (true value 0.34 at `7967c6f`).
  :789 may describe another shutting row ("shutting off", "a lid shutting" …) — unchecked; builder #16 settles it from step 4's
  rankings (Next step (a)).
- The note-1 correction keeps the historical state (at `7967c6f`, the nearest list); at the fill (`34feafe`) those phrasings show
  the same clips labelled `[closest]` (e.g. "a soft knocking" → three closest, fix round 3's wording — `audio-tools-fill.test.ts`).

### Fix round 4 (builder #14, step 2) — notes for the records, none blocking

- **The one LESS row (the fill shows a clip fewer than `7967c6f` did) — "a moving transition"** (`whoosh-soft|whoosh-wind`, not
  `chess-piece-thock`): `7967c6f` answered `whoosh-soft 0.50 | whoosh-wind 0.30` (a weak head-rule match); the fill answers `[matched]
  whoosh-soft 0.50 | [closest] chess-piece-thock 0.30 | [closest] wind-soft 0.30` — E-d16a's own tie rule (a closest before a weak
  match at equal coverage) pushes whoosh-wind to fourth. The allowed first stays shown first, so NOT a "right clip lost" case; not
  changed (changing it would re-open E-d16a). A stranger (`chess-piece-thock`, "chess move") in the three = an E-d16 note.
- **Stated choices in the E-d16 row convention (`expectAnswerRow`):** '∅' means "no CONFIDENT first" (weak / closest rows may show
  — e.g. "a flickering screen" → `[weak match] power-down`); the E-d16a exception never excuses a '∅'-only row; an `edge` note whose
  first has become allowed FAILS (so the notes stay true); the old 809 rows keep the stricter matcher FIRST (`matches[0]`, weak
  included) — only their recall moved to the answer.
- **The r4 rows whose answer first is NOT an allowed clip (E-d16 notes; `E3\fix4-r4-notes.txt`):** the 8 F4 screen rows → `[weak match]
  power-down 0.43 / 0.47` first with the right clip beside it ("a cracked / glitching / glitched / corrupted / shattered / zapped /
  crashing screen"; "a flickering screen" has no right clip); the 3 `edge: 'line'` rows and the 1 `edge: 'tie'` row (Built); "a slow
  ticking" → `[closest] ui-click-soft 0.20` first, clock-tick-soft second (verifier note 1); "a shattered phone screen" → `[closest]
  power-down 0.24` first, break-glass-crack second; the vocabulary rows ("a rewound tape", "a clicker" → a true miss; "a river
  running", "a running tap" → `[closest] dash-zip` alone).
- f-probe's verdicts are mine (the probe file has none); the judgement calls: "a popped message" (`pop-reveal|ui-send`), "a launched
  message" (`ui-send|launch-thump`), "a crashed device" (`power-down|break-crash-digital`), "a swiped card" (`whoosh-soft`, a UI swipe).

### Fix round 4 (builder #13, step 1) — notes for the records, none blocking

- **Stated choices (not in E-d16's text, decided here):** (1) the answer's kind follows the rows SHOWN — a weak match that three
  closest candidates outrank by coverage leaves a 'nearest' answer (fix round 3's wording); (2) the 'match' header counts the
  CONFIDENT rows shown (≤ 3, as the old header counted the top three) and adds "K shown: a matched, b weak match(es), c closest" only
  when a non-matched row is shown — with three confident rows the header is the old one, byte for byte; (3) the pure-miss rows carry
  `[closest]` too (header and last line verbatim from fix round 3); (4) the label sits after the row's "- " so the model reads it
  first, the E2 row content after it is unchanged; (5) the below-threshold order is by COVERAGE (E-d16a), not the matcher's rank
  (coverage + the placement bonus) — the bonus still orders the confident matches and breaks ties inside one label.
- **A behaviour change visible in an old test:** the reuse test's 4-clip mock "a soft airy whoosh for a transition" — `whoosh-wind` was
  always a head-rule (weak) match; the old answer said "2 sounds matching", the new one "1 sound matching … 1 matched, 1 weak match, 1
  closest". The same relabelling applies on the real library wherever a head-rule match was counted as a match before.
- Music "may have": no music prompt on the 51-clip fixture yields a weak match (`fix4-rank.txt`, 8 bed prompts) — covered by the pure
  unit tests (class-independent) only.

### Verifier round 4 — FAIL on F4 (2026-10-29 01:24–02:00; E3's LAST round under E-d15; no launch, no model call; kit `.vidtsx-temp\end-to-end\E3-verify\r4\`, evidence `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3-verify\r4\`)

- **F4 (code defect in the F3 class — E-d15 (iii): a confident match puts a clearly wrong sound first while the right clip exists;
  the right clip was first at BOTH `788c8d2` and `09e81ea`).** On the committed fixture (= the real index's 51 clips, verified field
  by field; `g-probe.txt`, 32 phrasings, 14 wrong firsts) and through the REAL `generate_sfx` handler with no provider on the
  verifier's clean 51-clip scratch library (`h-noprov2.txt`): "a cracked screen" — `788c8d2` / `09e81ea` `break-glass-crack 0.57 |
  power-down 0.43`, HEAD **`power-down 0.43` (the head rule) alone**, nearest `break-glass-crack 0.34 | pop-reveal 0.26 | scan-hum
  0.26`; the handler answers "The library already has 1 sound matching "a cracked screen"" → `library:sfx/power-down.mp3` ("An
  electronic device switching off for good …"); the same for "a glitching / glitched / corrupted / shattered screen" (`glitch-zap` /
  `break-glass-crack` 0.57 → `power-down 0.43`), "a zapped screen" (`glitch-zap | zap-electric 0.53` → `power-down 0.47`), "a crashing
  screen", "a breaking screen" (a 3-way 0.50 tie → `power-down 0.50 | pop-reveal 0.30 | scan-hum 0.30`); "a scribbled note" —
  `pencil-scribble 0.50 | chime-reward 0.30` → **`chime-reward 0.30` (the head rule) alone**, nearest `pencil-scribble 0.30`; the same
  for "scribbling a note", "a sketched note", "a scribbled note when the text appears", "a typed note" (`keys-typing-soft 0.50` →
  `chime-reward 0.30`). **Mechanism (at `7967c6f`):** `sound-match-words.ts:35` `STEM_STRENGTH = 0.6`, applied by `matchStrength`
  :114-121 (a verb form scores 0.6); `sound-match.ts:94-104` `hitOf` → `weight = FIELD_WEIGHT × strength`, `equal` only at strength 1;
  :154-160 `headHit` only on `hit.equal`; :166 a match at `coverage ≥ 0.5 || (headHit && coverage ≥ 0.3)`. "a cracked screen": terms
  `cracked:1, screen:1`, head `screen`; `break-glass-crack` covers `cracked` via its `crack` tag at 0.6 → 0.34, no equal head →
  nearest; `power-down` covers `screen` (an equal TAG hit) → 0.43 with `headHit` → a match, first and only. **Proof it is F3a, not
  polysemy:** with `STEM_STRENGTH = 1` applied (then restored, sha verified; `mutate-probe.cjs`, `g-probe-STEM1.txt`) 13 of the 14
  wrong firsts revert to the right clip (the one left, "a flickering screen", has no right clip); the polysemy existed at `09e81ea`
  and the right clip still won there. The miss rule does not reach it (a match, not a miss): the model is told the library has the
  sound; a user who believes it places a wrong clip, or calls `force` and pays for a duplicate of a clip it never saw. The records'
  broad set did not cover participle + noun frames (bare / "a w" / "a w sound" / "a soft w" + openers), so its "no worse first" claim
  is scoped, not false. **Orchestrator confirmed** the code lines, the fixture entries (`power-down` tags `… screen, device …`;
  `break-glass-crack` tags `… crack …`; `chime-reward` "bell notes"; `pencil-scribble` tags `scribble, sketch …`) and the evidence
  lines (`g-probe.txt:3-10`, `h-noprov2.txt:1-9`, `g-probe-STEM1.txt:3-10`).
- **(iv) — false statements in the Status.md E3 entry (minor; none changes an outcome):** :305 "(riser-soft says build / build-up)"
  — riser-soft's text is the tag `build` + "riser building" (orchestrator confirmed in the fixture :54); "build-up(s)" appears only
  in ambient-pad's / docu-pluck's NEGATED "no build-ups" (the ∅ outcome itself is right; the same false comment sits in
  `sound-match-corpus-r3-ordinary.test.ts:16`); :213 "trap-snap 0.32 on 'shutting down'" — actual 0.34; :215 "power-down 0.46" —
  actual 0.43 (:363 says 0.43); :189 "a running whoosh … the whooshes at 0.41" — actual 0.38 (:257 says 0.38).
- **Passed (its own numbers):** gates — CPU 01:24 `LoadPercentage` 85, `vmmemWSL` 60.3 % (external); run 1 had `shot-module-resolver
  .test.ts:151` (DRIVING's named LOAD timeout, 10 / 10 alone) → **run 2 counted at default workers: 503 / 3 / 5 files (511), 5,097 /
  9 / 35 tests (5,141), 70.97 s, 0 timed out**, only the 3 E-d2a suites; rule (b) its own strict walk 2 / 12 / 23 modules, NONE of
  the 99 paths; tsc 26 / 10. The corpus: 5 files / 814 tests green; its own evaluation of the 809 rows 0 FAIL, every expectation
  fair, the recall assertion as recorded (49 `*` incl. "soft", 61 `∅`, 52 `x|∅`). Its own 13,970-probe broad set vs both olds (the
  "worse?" rows all -er / -ly / nonsense inflections the old prefix rule matched, "water X-ing" nonsense, and the noted adjective +
  verb-form class) and a 236-phrasing ordinary set (225 ok; the one real finding above; the rest notes). Real handlers on its own
  clean 51-clip scratch library (51 / 51 sha256 = the catalog): no provider — a match answers before the provider check, a near miss
  answers "No library sound matched …" with three rows + `force: true` and writes nothing (index byte-identical), a true miss → the
  provider notice; its own −29.4 LUFS stand-in — a true miss generated once (8 files in all, every one `ebur128` −20.2 LUFS / −13.6
  dBTP) then FOUND, near misses WITH the provider generated nothing, `force` generated (sfx + music), a 90 s bed and a
  `compositionPlan` generated, the length rule strict. Mutations: MI, MJ, F3a `STEM_STRENGTH = 1` (22 failed), the equal-hit head
  rule, the miss rule generating, `force` ignored (sfx / music), the nearest unsorted, the `covered <= 0` guard, the adverb stop words,
  SAME_SOUND off the stem — every one caught by a committed test; the openers-off mutation not applied (its pattern did not match;
  pinned by `sound-match-words.test.ts:82-90` + the placement corpus). Build: `out/main/index.js` 00:54:49 after `7967c6f` (00:30:57),
  the markers present; no renderer source changed since `8bde97c`. **Records: everything else true** — the title, E-d15's bar, every
  line pointer at `7967c6f`, every line / row / test count, git fact, log total and time, the regression and broad headers, both
  driver JSONs, the intentional first changes, the earlier rounds' facts at HEAD.
- **Notes (not failures — Hasan's list):** (1) the records' "the right clip FIRST in the nearest list" for the adjective + verb-form
  class is imprecise — "a soft / gentle / loud knocking" list `chess-piece-capture` first and `knock-solid` second (an exact tie,
  relPath order), "a slow ticking" `ui-click-soft` first, `clock-tick-soft` second: by plain meaning the right clip is SECOND in four
  of the seven phrasings; (2) vocabulary gaps that now generate without `force` (no candidate scores): "a buildup" (riser-soft is
  tagged `build`; only "a build-up" matches — the strongest (ii) candidate by plain meaning), "a ding" ×3, "a runner", "eaten",
  "woooosh", "a clicker / ticker / zipper"; (3) a music prompt containing "bed" can never be a true miss on this library (every bed
  carries the tag `bed`) — a genre the library lacks costs one extra tool call when phrased "… bed"; (4) "an F major triad" →
  `piano-c-maj` (one-letter tokens dropped, the three majors tie; same at both olds); (5) "cozy lofi hip hop under the tutorial" → ∅
  with lofi-warm first in the nearest; "a click every single time the button is tapped" → ∅ ("every single time" is not an opener)
  — F1-class near misses with the right clip first in the nearest; (6) "objects clattering down" → ∅ (nearest `crash-tumble 0.44`),
  a 0.58 match at both olds — the class (16); (7) strangers first in a nearest list: "a single bell ring" → `knock-solid 0.20` ahead
  of the chimes, "a dying battery" → `flame-snuff | power-down 0.24`, "a tap running" / "running creek" / "a river running" →
  `dash-zip` alone; (8) polysemy confident matches with no right clip: "a fire crackling" → `launch-thump` (cannon `fire`), "winding
  up" → the wind clips, "a shocking moment" → `zap-electric`, "a flickering screen" → `power-down` (at both olds too); (9) the
  library index's `hash` field is not a SHA-1 of the file bytes (nothing in E3 reads it); (10) generated files without a `category`
  argument index `category undefined` — expected.
- Its scratch: kit `…\E3-verify\r4\` (0.2 MB), evidence `…\vidtsx-e2e\E3-verify\r4\` (13.3 MB incl. its scratch library with 8
  stand-in files). Nothing running; the worktree clean at `963f3d9`; the builders' E3 profile untouched.

### Verifier round 3 — FAIL on F3 (2026-10-28 22:37–23:14; no launch, no model call; kit `.vidtsx-temp\end-to-end\E3-verify\r3\`, evidence `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3-verify\r3\`)

- **F3 (code defect in the matcher — E-d14 (ii) a regression vs `788c8d2` on ordinary phrasing, and (iii) the F2 class).** On the
  builders' REAL index (51 catalog clips, read-only, hash `e5352386…12c5` unchanged): "running water" (also "the sound of running
  water", "a running brook", "a running stream") — `788c8d2` `stream-soft` only 0.43, HEAD **`dash-zip` 0.50 first**, `stream-soft`
  0.50 second (the tool's answer tells the model `insert_asset(assetId: "library:sfx/dash-zip.mp3" …)`); "shutting down" / "shutting
  off" / "a shutting down sound" — `power-down` 0.36 → **`trap-snap` 0.57 first**; "moving air" — `wind-soft` first → **`chess-piece-
  thock` 0.63 first**; "a whoosh shortly after the cut" — whoosh-soft 0.91 → nothing (the handler answers "No audio provider is
  configured" — with a key, a paid duplicate; the old hit came from the loose prefix rule, "shortly" is now the head word). Cause:
  `sound-match-words.ts:96-100` strips -ing and undoubles (`running` → `run`, `shutting` → `shut`), :101 drops the silent e (`moving`
  = `move`); `wordsMatch` :107-110 then hits dash-zip's `run` TAG (the tag behind F2), trap-snap's `shut`, chess-piece-thock's `move`,
  at tag weight 1 (`sound-match.ts:72-78`); ties go to usedIn then relPath (`sound-match.ts:133-139`) and `sfx/dash-zip` sorts before
  `sfx/stream-soft`. `run` / `running` is pinned as a REQUIRED match in `sound-match-words.test.ts:11`. Orchestrator confirmed the
  stem path in the code and the evidence lines (`b-probes.txt:311-313`, `:458-460`, `:645-647`; `c-probes2.txt:4-5`, `:12`, `:23`,
  `:31-32`).
- **Also (iii), the same classes, unchanged since `788c8d2`:** F2 class — "swooshing", "a swooshing sound", "swooshed", "wooshing" → ∅
  (`SAME_SOUND` `sound-match-words.ts:29` maps swoosh / woosh / swooshes only; stem `swoosh` ≠ `whoosh`). F1 class — "a whoosh every
  time / each time / any time / the moment / the instant / the second the slide changes", "every time the slide changes, a whoosh",
  "a click every time the button is pressed", "a chime every time the answer is right", "a hit the moment the logo lands" → ∅ (head word
  'changes' — the F1 symptom); an adverb before the clause or preposition → ∅: "a whoosh right when the slide changes", **"Add a soft
  whoosh right at the first cut."**, "a pop right when it appears", "a click right when the button is pressed", "a whoosh only when /
  even when / immediately after …"; "a whoosh exactly when the slide changes" → party-popper / crunch-bite ("exactly" hits their
  "Exactly ONE …" descriptions). Cause: `PLACEMENT` (`sound-match-words.ts:39-41`) is single conjunctions only; `STOP_WORDS` (:42-50)
  lacks right / exactly / only / even / shortly / immediately (`cutHead` :116-124, `promptTerms` :146-153, :172).
- **Passed (its own numbers):** gates first try at default workers (CPU 47 %, `vmmemWSL` 16 %, headroom 32.6 GB — `cpu-1.txt`): 497 / 3
  / 5 files, 4,420 / 9 / 35 tests, 52.44 s, 0 timeouts, only the 3 E-d2a suites (resolution only); rule (b) its own strict walk 2 / 12 /
  23 local modules, none of the 107 paths; tsc 26 / 10. The fixture = the builders' 51 entries exactly; no prompt special-casing; the
  corpus 150 / 150 (also on the whole index — the cuckoo rows find the generated cuckoo, correctly); every corpus expectation fair by
  plain meaning. Mutations 16 / 18 caught (**MI** the bonus cap dropped, **MJ** the bonus applied before the threshold — NOT caught; the
  code does both right, no test pins them). Real handlers on a clean scratch library (the 51 verbatim): no provider → the library answer
  before the provider check, 0 files written, index byte-identical; its own stand-in (−15.0 LUFS) → generated once, the identical ask
  FOUND it (also with a placement clause), `force` generates, music likewise; meter −20.2 LUFS / −10.5 dBTP vs index −20.26 / −10.46.
  Build: renderer unchanged `788c8d2..09e81ea`; `wt/out` after the commit with the fix-2 markers. **Records true** (the 150 rows = the
  150 distinct prompts used; red = the 10 listed; the regression numbers; every pointer, count, git / tree / build statement).
- **Notes (different class — Hasan's list):** noun + participle ("wind blowing" → `flame-snuff` only, as at `788c8d2`); "X of Y" ("a
  bit of static" → `crunch-bite`; "a type of whoosh" → `keys-typing-soft`, new); polysemy ("a shocking reveal" → zap-electric, "a
  building collapse" → riser-soft, as before; "a door slamming" → stamp-hit, "a door closing" → knock-solid via "close-mic" — new); -er /
  -ly (recorded limit: "a deeper impact" → impact-soft first, was impact-deep-soft; "a wind blowing softly" → ∅); trailing words as the
  head word ("a whoosh here / now / again / too", "could you add a whoosh" → ∅); a music bed a hair under `durationSeconds` is not
  offered (strict ≥).
- **Earlier findings:** F1's nine prompts FIXED, the class still open (above); F2 FIXED for "a bell rung (once)", the same `run` collision
  back through "running"; round-1 notes 1 / 3 / 4 / 5 / 6 recorded (5 still open: `list_assets` "whoosh" lists dash-zip), 2 FIXED, 7 the
  light-pill nit recorded (the 20:17:55/56 time and the role=button-span nits not in the records); round-2 N1 / N2 FIXED, N3 recorded and
  open, N4 / N5 recorded.
- Its scratch: `…\E3-verify\r3\lib-profile` (51 clip copies + 10 stand-in files), projects `e3v3-noprov` / `e3v3-standin` under
  `.vidtsx-temp\end-to-end\E3-verify\r3\root\projects`. Nothing running; the worktree clean.

### Fix round 3 (builder #12, the records) — notes, none blocking

- **The `*` row count is 48**, not 38: `grep` of the rows whose expected is exactly `'*'` over the four r3 files → 46 in
  `-senses`, 2 in `-ordinary` (+ 1 in the 150-row file, fix round 2's). Built "builder #9" and the session-8 log keep their 38;
  the records say 48 and name the discrepancy (Status item (22), TESTING "Fix round 3 notes"). A verifier counting rows should
  expect 48.
- `sound-match-corpus-rows.ts` 62 → 79 (not 58 → 79) and `sound-match-bonus.test.ts` 47 lines (not 52) — as `git show --stat` /
  `wc -l` say; stated in the records. The `574edbc` message's 87 (the log: 88) stays a known typo.
- The Status.md E3 entry is now 843 lines (:10-852): the four verifier / fix bullets carry each round's material in full. A later
  cleanup could fold the round-1 / round-2 bullets into one history paragraph once E3 is PASSED — not this round's.
- Builder #12 wrote docs only; the Status / LOG phrase "builders #9–#12" covers the code + drivers (#9–#11) and the records (#12).

### Fix round 3 (builder #11) — notes for the records, none blocking

- **The adjective + verb-form class (Built "builder #11", the one noted class):** "a soft knocking" / "a gentle knocking" / "a soft
  breaking" / "a slow ticking" / "a loud crashing" were MATCHES at `788c8d2` and `09e81ea` (0.72–0.82; 0.36–0.43 for the loud / slow
  ones) and are near misses at `7967c6f` (0.49 / 0.44 / 0.49 / 0.20 / 0.24) — the right clip FIRST in the nearest list the tool now
  answers; nothing generated. E-d15 (ii) / (iii) do not reach it (no generation; no wrong first) → a note for Hasan's list + candidate
  recall rows (Built). The mechanism is F3a's own: a 0.6 stem hit on the head word cannot carry an adjective the clip's text lacks over
  the 0.5 line, and the head rule asks for an equal hit. Not fixed this round (the brief's fix clause is a clearly wrong FIRST).
- **The -er real words** ("a door knocker", "a ticker", "a sparkler", "a zipper", "a streamer", "a clicker"): nothing at `09e81ea` and
  `7967c6f` (fix round 2's design); `788c8d2` matched them through its loose prefix rule. Hasan's list (a synonym gap, as "a runner").
- **"a drums …" (music)**: lofi-warm 0.60 answers through its description's "drums" — the one bed with drums; the broad set flags it a
  "stranger" only because the word enters the set from ambient-pad's `no-drums` tag part. Right by meaning.
- The broad set is mechanical: ~60 % of its 7,554 probes are nonsense inflections ("keysing", "cozyy"); their changes vs `788c8d2` are
  the loose prefix rule's artefacts, not regressions. The ordinary-phrasing content is the 243 base words × the 10 placement / wrapper
  forms + the real inflections; the verifier's own probe set (E-d15) should be phrasings a user types, not this generator.
- `vitest-full-fix3.sh` prints "HEAD <hash>" = the docs HEAD (`1d7d5ed` for both runs); the code HEAD was `7967c6f` throughout.
- The E3 index stamp changed between fix round 2 (`e5352386…12c5`, 59 entries) and this round (`876f9f61…c16c95`, 61 entries) only by
  builder #10's two stand-in files under `generated/` (Do-not-redo: never re-run the stand-in driver); the pool is the same 51 clips.

### Fix round 3 (builder #10) — notes for the records, none blocking

- **A stated fact corrected:** the session-8 brief's driver line "with no provider, 'a cuckoo clock chime' → the nearest three
  named" does not hold on the E3 profile — its library holds `generated/sfx-a-cuckoo-clock-chime.mp3` from builder #3's live step,
  so the cuckoo is a MATCH there (the E2 promise: found before regenerated). The fix-3 drivers show the miss rule on "a grandfather
  clock chiming midnight" (sfx) and "a warm bed for a cooking show" (music) and record the cuckoo's match. On a clean 51-clip library
  (the verifier's own `lib-profile`) the cuckoo IS a near miss (`clock` → clock-tick-soft, `chime` → the two chimes); the unit test
  pins the one-word near miss on the mock. What the miss rule changes for the live cuckoo case: a turn asking for a sound the
  library lacks now gets the closest library sounds first and must call `force: true` to generate — one extra tool call (E-d15).
- **A `not` clip may be a NEAR miss** (by design): "a tap running" / "running creek" show dash-zip as the one closest sound — never a
  match (`NO_DASH` holds on `matches`); the model reads "a quick zippy whoosh … footsteps" and decides. E-d15 calls a stranger in the
  near-miss list a note, not a failure.
- **Ten corpus rows became '∅'** (Built (e)): the named clip carries no word of the prompt, so the recall promise could never hold —
  a synonym gap (ding ×3, picture, buildup, runner, eaten, woooosh, tap / creek), not a ranking fault; "a ding" ×3 were already a
  known gap (fix round 2 N3).
- `minDurationSec` applies to the nearest too (stated choice): `generate_music(…, durationSeconds: 90)` on a library whose longest
  bed is 57 s has NO candidate → a true miss → generates without `force`; a bed shorter than the asked length is never shown.
- The E3 profile's index now holds 4 `generated/` entries (the stand-in driver added `sfx-a-dog-bark.mp3` and
  `sfx-a-cuckoo-clock-chime-2.mp3`); item 4's regression driver excludes `generated/` and must stamp the index as it is now. The
  dog and the cuckoo-2 share one project asset id (identical stand-in bytes → pool dedup; builder #3's note (3)).
- The files builder #10 wrote are LF (git's "LF will be replaced by CRLF" warnings at commit; the older files are CRLF) — cosmetic.
- The old `tools-noprovider.e3.test.ts:88` (builder #3) would now fail on this profile — its cuckoo expectation predates the
  generated cuckoo and the miss rule; it is kept as the live step's record, the fix-3 copies are the current drivers.

### Fix round 3 (builder #9) — notes for the records, none blocking

- **First results that CHANGED vs `09e81ea` on purpose, each with its reason** (the regression report of item 4 will list them
  against both old versions): "a running whoosh" → dash-zip 0.60 first (its description is "a quick zippy whoosh" — accepted in
  the corpus as `W|dash-zip`; a note, not a defect: the whooshes follow at 0.41); "winding down" → power-down 0.50 first
  (old: whoosh-wind / wind-soft 0.53 — "winding" is now a 0.6 stem hit on `wind`; '*' row); "a key turning in a lock" →
  keys-typing-soft 0.50 (plural `keys` = `key`; '*'); "a door slamming" → knock-solid alone (stamp-hit's `slam` is a stem
  hit, 0.30 — not offered; the corpus accepts either); "air moving" / "moving air" → chess-piece-thock no longer offered at all
  (0.38, no equal head); "a long whoosh" → whoosh-wind 0.78 first (was impact-deep-soft 0.62); "a softer whoosh" →
  whoosh-soft 1.00 (was whoosh-wind 0.75); "a deeper impact" → impact-deep-soft 1.00 (was impact-soft 0.36 by usedIn).
- **Still open by design (different class, Hasan's list):** a noun + participle head ("water running over rocks", "a tap
  running", "wind blowing") finds nothing above the threshold — the right clip is now a NEAREST candidate (item 3 shows it);
  -er / -en forms ("a runner", "eaten", "a buildup", "a zipper") stay unmatched; negation still only drops words; "a hop" is
  now ∅ (hope ≠ hop) — the chimes are not offered for it any more.
- `wordsMatch('run', 'running')` stays TRUE (at strength 0.6) — the words test row :11 was kept, the strength test added.
- The commit message of `574edbc` says "red 87 / 659"; the log says 88 (3 of the 91 failures in the first run were the row-count
  pins, fixed before the recorded run). History not rewritten; the records must say 88.
- `pre-e1-control.test.ts` flaked once in the library run ("candidates 0 / probed 0", a disk-timing case like DRIVING's load
  flakes), green on the immediate re-run with no code change in between.
- Scratch left in the session scratchpad only (`dedupe-probes.cjs`, `check-rows.cjs`, `b-probes-compact*.txt`,
  `probe-keys-new.txt`) — nothing new under `.vidtsx-temp\end-to-end\E3\` except the logs `fix3-corpus-red.log`,
  `fix3-try1.log`, `fix3-green.log`, `fix3-mi-mj-red.log`.

### Fix round 2 (builder #7) — open notes for the records, none blocking

- **Round-2 notes, where they stand now:** N1 (a leading placement clause WITHOUT a comma drops the sound) — **handled** by
  (c): "when the logo lands a deep impact hit" → impact-soft 0.42, "as the title appears a soft whoosh" → whoosh-soft 0.42, "if
  the answer is right a chime" → chimes 0.39 (near the 0.30 floor; only `impact-soft` is offered for the first — `impact-deep-soft`
  reaches 0.42 without the head word `hit`). N2 (a placement clause holds the distinguishing word) — **fixed** by (b): trap-snap
  and clock-tick-soft first. N3 — `after` / `before` + a clause still near the floor (unchanged, a recorded limit); "a ding" /
  "a bell ringing once" / "a bell ring once" still find nothing — a synonym (`ding`) and a verb (`ring`) no clip carries (the
  chimes say "bell notes" in the description only); the corpus accepts ∅ or a bell-holding clip there — **stated, not fixed**.
  "a bell, rung once" matches the chimes at 0.30, on the floor. N4 / N5 — record-time nits and the verifier's own scratch.
- Design limits to state in the records: no -er / -est / -ly in the inflection list (riser ≠ rise, timer ≠ time, shutter ≠
  shut) — so "riser" no longer offers `warm-shimmer` (its description's "rise"); the placement bonus counts tag / name / category
  hits only (descriptions are similes — "like lines of data flying by"), particles excluded; negation still only drops words,
  never demotes.
- `ORCHESTRATOR.md` shows an uncommitted modification in the worktree that builder #7 did not make (the orchestrator's) — left
  untouched, never staged. (Builder #8: gone — the tree was clean at `532559a` except the orchestrator's untracked
  `docs/studio/end-to-end/E-exit/`, also left untouched.)
- Builder #8 (records): the brief named `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3\diff-list-fix2.txt`; the file (and
  `import-graph-fix2.txt`) is in the D: scratch `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E3\` — the records name the
  D: path. Builder #7's "`sound-match.ts` 250 → 141" was 249 → 141 (`git show 788c8d2:`); corrected above and in the records.

### Verifier round 2 — FAIL on F2 (2026-10-28; no launch; evidence `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3-verify\r2\`, kit `.vidtsx-temp\end-to-end\E3-verify\r2\`)

- **F2 (code defect — the cause predates fix round 1, exposed by it).** "a bell rung once" → `sfx/dash-zip.mp3` 0.60 offered first and
  only (a cartoon character dashing past) — the fix makes adverbial "once" a placement word (`sound-match.ts:60`, cut :122-126), the head
  word becomes the participle "rung" (`headWord` :145-148), and `wordsMatch`'s prefix rule (:159-163: short word ≥ 3 letters, ≤ 3 extra)
  matches `rung` to dash-zip's `run` tag at the highest idf → coverage 0.60 ≥ 0.5. "a bell rung" gives the same dash-zip answer at
  `7a0d6ad` and HEAD. The chimes hold bell notes. Impact: a wrong offer (the model would likely call `force`).
- Passed: F1 FIXED (the nine prompts match the records exactly on the real index, the index byte-identical); its break-it prompts mostly
  fine ("as soft as a feather", "as loud as possible", "where the cut is", "a pop as the bubble appears", leading clauses WITH a comma);
  the no-matches stay; music with "while …" + duration right; stand-in: found before regenerated, `force` generates (both tools; −20.28
  recorded / −20.3 meter); mutations all caught incl. M2b (`audio-tools-reuse.test.ts:122`) and four of the placement rule; gates —
  counted under **E-d13** at `316cf94` (CPU `vmmemWSL` 79 → 26 %): 495 / 3 / 5 files, 4,229 / 9 / 35 tests, 136 s, 0 timeouts, only the
  E-d2a suites; rule (b) 0; tsc 26 / 10. Records true (F1, M2b, the FAIL → fix line, round 1's measured items = `live-assets.json`, open
  notes, E-d13 + the CPU file, git facts, every moved pointer). **N1 recorded, N2 FIXED, N3 recorded, N4 recorded.**
- Notes: **1** a leading placement clause WITHOUT a comma drops the sound ("when the logo lands a deep impact hit" — impact-soft 0.31 at
  `7a0d6ad`; "as the title appears a soft whoosh", "if the answer is right a chime" found nothing before too); **2** a placement clause
  can hold the distinguishing word: "a snap when the trap closes" — trap-snap first at 0.95 at `7a0d6ad`, now third in a 1.00 tie with
  ui-click-soft / ui-send; "a soft tick while the countdown runs" puts ui-click-soft ahead of clock-tick-soft — the records' "none lost a
  match or its first result" holds only for the builders' 70 prompts; **3** after / before near the floor (0.39 / 0.32); "a ding" and "a
  bell ringing once" find nothing though the chimes hold bell notes (same at `7a0d6ad`); **4** record times 21:28:47 / 21:32:48 vs log
  "Start at" 21:28:49 / 21:32:50; **5** its profile now holds 10 stand-in files under `generated/` (its scratch).

### Verifier round 1 — FAIL (2026-10-28; its own profile `profiles\E3-verify`, CDP 9273; evidence `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3-verify\`, kit `.vidtsx-temp\end-to-end\E3-verify\`)

- **F1 (code defect, not an exit miss) — the head-word rule breaks on "when / while / until / once …" prompts, so `generate_sfx`
  generates although the library has the sound.** `sound-match.ts:45-48` `CLAUSE_CUT` has no `when` / `while` / `until` / `once` /
  `if` / `because` (`when` is in `STOP_WORDS` :52 — dropped, but it does not end the clause) → `headClause` :104-117 runs to the
  sentence end → `headWord` :119-123 picks the placement word ("changes", "lands", "pressed", "right", "reveal") → `promptTerms`
  :125-131 gives every placement word weight 1 with a high idf (no clip has them) → coverage under the threshold (:214). On the real
  imported index (51 clips; `c-matcher.json`) NO match for: "a quick whoosh when the slide changes" (4 whooshes exist — the exit's own
  sound), "a whoosh while the card flies in", "a deep impact hit when the logo lands", "an impact when the logo lands", "a hit when the
  logo lands", "a click when the button is pressed", "a chime when the answer is right", "a tension riser until the reveal"; WRONG
  sound: "a whoosh once the scene switches" → only `ui-toggle-on` 0.30. Without the clause they match ("a deep impact hit" →
  impact-soft / impact-deep-soft 0.65; "click" → ui-click-soft 1.00; "chime" → both chimes 1.00). Through the real handler
  (`b-noprov.json`) "a deep impact hit when the logo lands" → "No audio provider is configured" — with a key, a paid duplicate. It
  breaks the row's promise for a common phrasing; the prompt rule (search first) softens it, the tool's guard is the backstop.
- Passed (its own numbers): gates — counted run 3 (`--maxWorkers=4`; runs 1–2 load timeouts incl. `agent-memory` /
  `project-package-import`, all green alone 3 / 43) 493 / 3 / 5 files, 4,215 / 9 / 35 tests, the 3 E-d2a suites resolution only; its
  own runtime import graph 0 changed files; tsc 26 / 10. Its own prompts (whooshes / swoosh / riser / click / lo-fi bed → the right
  clips; cow / steam train / "a" / 600 s music / orchestral → provider notice); `list_assets` incl. a no-match → "No matching assets in
  the library."; the index byte-identical; with its stand-in (−17.2 LUFS) a train whistle generated once (−20.27 recorded / `ebur128`
  −20.2, TP −9.8), the identical ask then FOUND (0 new files), `force` generated; music likewise. Mutations M1 M2 M3 M3b M4 M4b M5 M6 M7
  M8 M9 caught; **M2b (`generate_music` ignoring `force`) NOT caught**. Live CDP 9273: tile + details play; **the details player
  pausing a STILL-playing tile (2.496 s) and the reverse**; **a GENERATED file plays** (tile 0.427 → 1.545 s, details 0.258 → 1.281 s);
  sound fields for a generated (−20.3 LUFS, −9.8 dBTP · true peak, source standin) and a catalog clip (−20.0, −1.6 dBFS · sample peak,
  licence, 16 used-in); chips `origin:generated` 56 → 5, `origin:imported` 56 → 51, `tag:whoosh` → 4. Live whoosh (its own words, 2
  turns, keyless sonnet-5-5): turn 1 found `whoosh-soft` and said no generation was needed but ASKED where the cut is (one source asset
  split into two V1 clips — the assistant saw an 8 s asset and a 6 s timeline); turn 2 (cut at 3.0 s, naming the clip it proposed) →
  `insert_asset(library:sfx/whoosh-soft.mp3, audio, at 2.75)` card, `generated/` 5 → 5, `usedIn` 16 → 17 — PASS with that caveat.
  Records: ~95 pointers + 25 numbers true; titles of E2 / E4 only.
- Notes (non-blocking): **1** negation only drops words, never demotes ("a whoosh but not soft" / "without air" still rank
  `whoosh-soft` first; "soft" alone → three unrelated soft clips); **2** M2b test gap; **3** the assistant's view of a split source
  clip (a capability gap for later tracks, not E3's); **4** two "Not measured" items are now measured (above) — update the records;
  **5** `list_assets` "whoosh" lists `flame-snuff` and `dash-zip` (recorded); **6** the importer rewrites the gitignored
  `wt/.vidtsx-temp/import-sfx-library/catalog-import.bundle.cjs`; **7** nits: a log start time 20:17:55 vs 20:17:56; the native `<audio
  controls>` renders as a light pill on the dark theme; `TilePlayButton` is a role=button span inside the tile `<button>` (as the copy
  control).

- **Fix round 1 (builder #5) — open, none blocking:** (1) ~~the counted full run is owed~~ DONE by builder #6 under E-d13
  (`vmmemWSL` 74.8 % of all cores; 494 / 4 / 5 files — the 3 E-d2a suites + `shot-module-resolver:151`, 10 / 10 alone; see
  Verified); records in `f593515`. (2) `after` / `before` + a clause still weigh as 0.5 qualifiers
  (a preposition just as often): "a hit after the logo lands" 0.39 / "a whoosh before the slide changes" 0.32 — they match,
  but near the 0.3 floor. (3) For the records (step 4): negation only drops words, never demotes ("a whoosh but not soft"
  still ranks `whoosh-soft` first); `list_assets` "whoosh" also lists `dash-zip` (and `flame-snuff`); the native `<audio
  controls>` renders as a light pill on the dark theme; and, for later tracks, the live assistant could not see where the
  cut was when ONE source asset is split into two V1 clips (verifier's whoosh turn 1). (4) The importer's gitignored
  `wt/.vidtsx-temp/import-sfx-library/catalog-import.bundle.cjs` is rewritten per run (verifier note 6) — scratch.
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

- E-d16d items 1–2 (builder #19, NO `src/` change, `src/` = `c5a6124`): the greedy experiment (`E3\sound-answer-greedy.ts`,
  `E3\variants-fix4c.e3.test.ts`, `E3\vitest.e3-greedy-corpus.config.ts` → `E3\variants-fix4c.txt`, `E3\variants-fix4c-read.txt`,
  `E3\corpus-greedy-fix4c.log`) and its decision — greedy NOT kept (it loses right clips vs `c5a6124` and `7967c6f`); the six quiet
  probes are notes. Never implement greedy; never re-run the gates or the build for it (builder #18's stand).
- Fix round 4 items 2–4 (builder #18, docs commits only, `src/` = `c5a6124`): the fix4b re-run (`E3\catalog-order-fix4b.txt`,
  `…\vidtsx-e2e\E3\broad-probes-fix4b.txt`, `E3\broad-probes-fix4b-summary.txt`, the 63-row read `E3\broad34-read.txt`,
  `E3\why-fix4b.txt`), the gates (`…\E3\cpu-fix4.txt`, `vitest-full-fix4.log`, `tsc-web-fix4.log` / `tsc-node-fix4.log`,
  `E3\diff-list-fix4.txt`, `E3\import-graph-fix4.txt`) and the `wt/out` rebuild (`E3\build-fix4.log`) — re-run them only if `src/`
  changes.
- Fix round 4 item 1 (builder #17, `c5a6124`): the E-d16b rule (`sound-answer.ts` + `sound-answer-words.ts`, red → green, the
  fill / unit / cover tests) and the "covers" definition experiment (`E3\variants-fix4b.txt`) — settled; do not re-open the
  definition unless Hasan says so.
- Fix round 4 step 4 (builder #16): the regression report over the 1,073 rows (`E3\catalog-order-fix4.txt`) and the 15,998-probe
  broad set with the F7 / F8 / F9 frames (`…\vidtsx-e2e\E3\broad-probes-fix4.txt` + the kit summary) — re-run (`catalog-fix4`,
  `broad-fix4`, the commands in Verified) only if `sound-answer.ts` or the matcher changes; Status.md :789's 0.34 is settled.
- Fix round 4 step 3 (builder #15, `d30830a`): the (iv) record fixes — Status.md :189 / :213 / :215 / :305, verifier note 1 at
  :405 / :412 / :783, TESTING §18.17 :533 / :540, the r3-ordinary comment :16 (only Status.md :789 is left, Next step (a)).
- Fix round 4 step 2 (builder #14, `9a13e3b`): the corpus — the recall over the answer's three, the E-d16 convention
  (`describeAnswerCorpus` / `expectAnswerRow`, `edge` notes), the two r4 row files (264 rows) — DONE; the kit
  `E3\fix4-corpus.e3.test.ts` regenerates the row files ONLY with `FIX4_WRITE=1` (never set it again: it would overwrite the
  annotated files).
- Fix round 4 step 1 (builder #13, `34feafe`): the fill (`sound-answer.ts`), the labelled wording (`sound-reuse.ts`), `REUSE_NOTE` /
  `FORCE_HINT`, the prompt :31 sentence and their tests are DONE — extend (the corpus recall uses `selectSoundAnswer`), do not
  redesign; never touch the three matcher files.
- The design note (a)–(f) and the matcher / tool / prompt build above — extend, do not redesign. The real-catalog
  order was recorded (`E3\catalog-order.txt`); the unit fixture pins the same shape.
- (c) the Assets screen (`8bde97c`) and (d) the G4 note — done and green; the `wt/out` rebuild at `8bde97c`; the E3
  profile copy (re-copy only if it is found damaged — verify `settings.db*` = 0 either way; the app creates a fresh
  store at its first launch, expected, never read it).
- The live step (builder #3): the import into the E3 library (51 clips — the library now ALSO holds two generated
  stand-in files under `generated/`), the Assets-screen CDP check, the tool-level checks (both drivers), the three live
  turns. Do NOT re-run the model turns (E-d9 budget spent: 3 turns + the probe).
- Fix round 3 items 1–2 (builder #9): the 659-row corpus extension (`574edbc`, red 88 / 659 recorded) and the matcher fix
  `02e2a10` (F3a / F3b / F3c, quantifier-of, comparatives, MI / MJ pinned and proved). Do NOT re-derive the rows or the
  factor; add rows. The regression report / broad probes / gates / rebuild for `02e2a10` + `7967c6f` are NOT done (item 4).
- Fix round 3 item 3 (builder #10, `7967c6f`): the miss rule's tool / answer / prompt / tests, the corpus recall assertion + the
  10 '∅' rows, the two fix-3 real-handler drivers (PASS; records `…\vidtsx-e2e\E3\tools-noprovider-fix3.json` /
  `tools-standin-fix3.json`). Do NOT re-run the stand-in driver (each run adds generated files to the E3 profile's library).
- Fix round 3 item 4a–4c (builder #11, docs-only): the regression report `E3\catalog-order-fix3.txt` (809 rows vs `788c8d2` AND
  `09e81ea`), the broad probe set (`C:\…\vidtsx-e2e\E3\broad-probes-fix3.txt` + `E3\broad-probes-fix3-summary.txt`, read and
  classified — no worse first), `E3\probe-fix3.txt`, the gates (CPU `cpu-fix3.txt` → the normal rule; run 2 counted; rule (b) NONE
  over 99; tsc 26 / 10) and the `wt/out` rebuild at `7967c6f` (Verified "builder #11"). Re-run the drivers only if the matcher changes
  again (`catalog-fix3` / `broad-fix3` / `probe-fix3`, ~1 min in all; the index READ-ONLY). The records (4d) are NOT done.
- Fix round 2 steps 1–4 (builder #7): the corpus (fixture + 150 rows, red 10 / 150 recorded), the F2 / bonus / no-comma fix
  (`09e81ea`), the real-index old-vs-new report (`E3\catalog-order-fix2.txt` — re-run only if the matcher changes again:
  `catalog-fix2.e3.test.ts`), the gates and the `wt/out` rebuild (Verified). Do NOT re-derive the corpus rows; add to them.
- Fix round 1 steps 1–3 (builder #5): the F1 fix + `sound-match-placement.test.ts` (`b176881`), the real-index old-vs-new
  table (`E3\catalog-order-fix1.txt` — re-run only if `sound-match.ts` changes again), the `audio-tools` split + the
  music `force` test + the M2b red (`788c8d2`), the gates and the `wt/out` rebuild (Verified). No app launch is needed for
  the records.

## For Hasan (real-video list candidates)

- Listening to the Assets-screen playback and to a placed library whoosh in the real editor (the by-ear half of
  "plays"); the one live ElevenLabs generation (E2's item) through the reuse rule with `force`.
- Verifier round 3's different-class notes (Open problems → "Verifier round 3"): watch the reuse offers in real use; each odd offer
  is a new corpus row.

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
- 2026-10-28 · builder #5 (fix round 1) · ~40 calls · steps 1–3 of the fix brief: F1 red (11 / 13) → fixed (placement
  clauses dropped) → green, `b176881`; the real-index old-vs-new driver (16 changed, 0 lost); the `generate_music` `force`
  pin + the `audio-tools.test.ts` split, M2b red, `788c8d2`; gates (5 full runs under another session's ~95 % CPU) + rule
  (b) + tsc + the `wt/out` rebuild. No launch, no model turn. Step 4 (records) handed to builder #6.
- 2026-10-28 · builder #6 (fix round 1, continued) · ~42 calls · CPU measured (`vmmemWSL` 74.8 %) → the E-d13 counted run
  (494 / 4 / 5 files, 4,228 / 10 / 35 tests; the 3 E-d2a suites + `shot-module-resolver:151`, 10 / 10 alone); rule (b) list
  unchanged (101); the records (Status.md E3 entry :10-325, TESTING §18.17 :524-538 — F1 + numbers, the test split, the
  verifier's two measured items, the new open notes, the gates) `f593515`; HANDOFF DONE. No `src/` change, no launch, no
  model turn.
- 2026-10-28 · builder #7 (fix round 2) · ~45 calls · steps 1–4: the corpus (51-clip verbatim fixture + 150 rows from every
  builder / verifier prompt; red 10 / 150), the fix (`sound-match-words.ts` — inflection stems, placement bonus, the no-comma
  fallback) → green (41 files / 493 tests in library + agent-tools), `09e81ea`; the real-index old-vs-new report (24 changed,
  0 correct matches / firsts lost); tsc 10 / 26; CPU idle → DRIVING's normal gate (run 2 counted, only the E-d2a suites); rule
  (b) NONE over 105; `wt/out` rebuilt. No launch, no model turn. Step 5 (records) handed to builder #8.
- 2026-10-28 · builder #8 (fix round 2, records only) · ~42 calls · every cited evidence file re-read; Status.md E3 entry
  (title, the F2 → fix round 2 bullet with the corpus / fix / regression / E-d14's bar, the matcher pointers re-pointed to
  `09e81ea`, tests, `wt/out` at `09e81ea`, the Gates under DRIVING's normal rule, open items 4 / 5 / 8 / 9 + new 14 / 15,
  evidence) and TESTING §18.17 (material, ranking, F1 pointers "as of", the new F2 item, gates, notes) — `5e56594`; re-checks
  after it all true; HANDOFF DONE. No `src/` / `scripts/` change, no gate re-run, no rebuild, no launch, no model turn.
- 2026-10-28 22:37–23:14 · verifier round 3 (orchestrator-spawned; E3's last) · ~113 calls · FAIL on F3 (Open problems → "Verifier
  round 3"); gates, corpus (150 / 150, expectations fair), the tool level, the build and the records all true. No launch, no model call.
- 2026-10-28/29 · builder #9 (fix round 3, items 1–2) · ~40 calls · the corpus extended with verifier round 3's 659 probes
  (four row files + the shared rows helper; red 88 / 659 on `09e81ea`, `574edbc`); the matcher fix (`sound-match-vocab.ts`
  new, `matchStrength` 1 / 0.6 / 0, the equal-hit head rule, openers / adverbs / trailing / wrappers / quantifier-of /
  comparatives, SAME_SOUND on the stem, the no-comma clause → bonus, `rankLibrarySounds` + `nearestLibrarySounds`), 47 files /
  1,181 tests green, MI / MJ pinned and proved, `02e2a10`. Items 3–4 (the miss rule's tool / prompt / tests / drivers, the
  regression + broad probes, gates, rebuild, records) handed to builder #10. No launch, no model turn, no gate run.
- 2026-10-29 00:05–00:40 · builder #10 (fix round 3, item 3) · ~24 calls · the miss rule (E-d15): `sound-reuse.ts` (`ReuseAnswer`,
  `formatNearestSounds`), `audio-tools.ts` (`reuse.text`, the FORCE_HINT / REUSE_NOTE sentences), the five prompt sentences pinned,
  `audio-tools-miss.test.ts` (5 tests; red first — 11 failed incl. 7 recall rows), the corpus recall assertion (`expectCorpusRow`;
  10 rows → '∅'), green 48 files / 1,187 tests, `7967c6f`; the two real-handler drivers PASS (no provider: the index byte-identical,
  the near miss answers the generated cuckoo / clock-tick-soft / chime-reward; stand-in: the dog generated once then found, the near
  miss generates nothing, the cuckoo `force` generates). Item 4 handed to builder #11. No launch, no model turn, no gate run, no rebuild.
- 2026-10-29 00:40–01:05 · builder #11 (fix round 3, item 4a–4c) · ~42 calls · the `09e81ea` matcher copies + `fix3-lib.ts`; the
  regression report over all 809 rows vs `788c8d2` and `09e81ea` on the read-only index (358 / 165 and 301 / 116 changed / firsts; the
  strict losses all `x|∅` recall rows with the clip first in the nearest); the broad probe set (243 base words → 7,554 probes; 2,786
  changed firsts read and classified — improvements, ties, the -er / nonsense-inflection artefacts of 788's prefix rule, 4 "WORSE?" vs
  09e none an ordinary phrasing; one class noted: an adjective + a verb-form head is now a near miss, e.g. "a soft knocking" 0.49);
  gates (CPU 19.6 % → the normal rule; run 1 `flow-render:255` alone 5 / 5 → run 2 counted 503 / 3 / 5 files, 5,097 / 9 / 35 tests; rule
  (b) NONE over 99; tsc 26 / 10); `wt/out` rebuilt at `7967c6f`. No `src/` change, no launch, no model turn. Item 4d (the records)
  handed to builder #12.
- 2026-10-29 · builder #12 (fix round 3, item 4d — records only) · ~28 calls · every cited evidence file re-read (the D: kit logs /
  reports, the C: outputs, the two driver records, `git show --stat`, `wc -l`, the source wording); Status.md E3 entry (the title;
  the F3 → fix round 3 bullet; the code list + pointers at `7967c6f`; `wt/out` at `7967c6f`; Gates under DRIVING's normal rule;
  open items 16–23; For Hasan; evidence) and TESTING §18.17 (Material, the F3 item, the prompt rule, Gates, Not measured) —
  `3cff0be`; four discrepancies recorded (48 `*` rows not 38; `-rows.ts` 62 not 58; `-bonus.test.ts` 47 not 52; 87 vs 88);
  re-checks after the commit all true; HANDOFF DONE. No `src/` / `scripts/` change, no gate re-run, no rebuild, no launch, no
  model turn.
- 2026-10-29 01:24–02:00 · verifier round 4 (orchestrator-spawned; E3's last under E-d15) · ~101 calls · **FAIL on F4** (Open problems
  → "Verifier round 4") + four (iv) number nits; gates, corpus (809 rows fair), its own 13,970-probe broad set + 236-phrasing ordinary
  set, real handlers on its own scratch library with its own stand-in, 12 mutations, the build and every other record true. No
  launch, no model call; the worktree untouched.
- 2026-10-29 10:37–10:47 · builder #13 (fix round 4, step 1) · ~45 calls · the answer-level recall fill (E-d16 + E-d16a): NEW pure
  `sound-answer.ts` + tests, `sound-reuse.ts` labelled rows / "may have" wording, `REUSE_NOTE` / `FORCE_HINT`, the prompt :31 sentence;
  NEW `audio-tools-fill.test.ts` (the real handlers over the 51-clip fixture, incl. the "a breaking screen" pin); red 13 / 38 →
  green 26 files / 995 tests; tsc node 10; matcher diff vs `7967c6f` empty — `34feafe`. Handed off at the step boundary (30 % rule);
  steps 2–7 to builder #14. No launch, no model call, no gate run, no rebuild.
- 2026-10-29 10:48–10:58 · builder #14 (fix round 4, step 2) · ~38 calls · the corpus: `expectCorpusRow`'s recall over the ANSWER's
  three (FIRST on `matches[0]` kept), the E-d16 convention `describeAnswerCorpus` / `expectAnswerRow` with E-d16a `edge` notes, NEW
  `sound-match-corpus-r4-frames.test.ts` (67 rows) + `-r4-ordinary.test.ts` (197 rows); red 36 / 266 on the current helper → green 7
  files / 1,080 tests (the 809 old rows unchanged), the E3 set 28 files / 1,261; tsc node 10; one LESS row (noted) — `9a13e3b`.
  Handed off at the step boundary (30 % rule); steps 3–7 to builder #15. No launch, no model call, no gate run, no rebuild.
- 2026-10-29 10:59–11:04 · builder #15 (fix round 4, step 3) · ~30 calls · the (iv) record fixes: Status.md :189 0.38, :213 0.34,
  :215 0.43, :305 build / building, note 1 at :405 / :412 / :783 (checked against `probe-fix3.txt`), TESTING §18.17 :533 / :540,
  the r3-ordinary comment :16; matcher diff vs `7967c6f` 0 bytes — `d30830a`. Handed off at the step boundary (30 % rule); steps 4–7
  to builder #16. No test run (comment-only `src/` change), no launch, no model call, no gate run, no rebuild.
- 2026-10-29 11:04–11:15 · builder #16 (fix round 4, step 4) · ~40 calls · the regression report (1,073 rows, four versions'
  answers, `catalog-order-fix4.txt`: vs `7967c6f` 1 LOST — "a moving transition" — 0 with no right clip left, 0 confident first
  changed) and the broad set (15,998 probes, builder #11's frames + participle + noun / noun + participle / adjective + verb-form:
  vs `7967c6f` 0 LOST, 6,482 gained, 0 confident first changed); open item (16) settled (trap-snap 0.3424, Status.md :789 → 0.34);
  the noun-first class found (2,085 confident firsts above the line, 51 with the verb carrier not shown, pre-existing at `09e81ea`)
  → BLOCKED on a question for Hasan. Index read-only (SHA-256 + mtime unchanged). No `src/` change, no gate run, no rebuild, no
  launch, no model call.
- 2026-10-29 11:23–11:40 · builder #17 (fix round 4, item 1) · ~45 calls · Hasan's E-d16b (the word-diversity rule) red → green
  `c5a6124`: `sound-answer.ts` 96 (`newWordsFirst`, `selectSoundAnswer(ranking, prompt)`) + NEW `sound-answer-words.ts` 39 ("covers"
  = any matcher field, any strength — the definition experiment over the 15,998 broad probes: any 0 / 0 losses vs `7967c6f` /
  `34feafe`, 9 of the 51 left; strong 0 / 6, 0 left; asym 0 / 35, 0 left); tests (unit 7 new, cover 3 new, fill 2 new; RED 6 failed /
  27 + the cover file unloadable → GREEN 17 files / 99 + library 37 files / 1,386); tsc node 10; matcher diff 0 bytes. The fix4b
  drivers prepared, not run. No gate run, no rebuild, no records, no launch, no model call.
- 2026-10-29 · builder #18 (fix round 4 items 2–4) · ~55 tool calls · the fix4b re-run (catalog 1,073 rows: vs `7967c6f` 329 changed,
  2 LOST with a right clip left — "a moving transition" + "a sucking whoosh before the reveal" (justified: E-d16b's group A covers
  `reveal`), 0 confident first moved; vs `34feafe` 10 / 1 / 0; broad 15,998 probes: vs `7967c6f` 8,196 / 0 LOST / 0 conf; vs `34feafe`
  63 changed (all read: 48 "… screen" + 15 "a soft `<form>`"), 0 LOST, 0 conf; noun-first 5,709, 9 left = E-d16c's list — every
  number builder #17's experiment predicted); the 8 no-carrier-left vs `09e81ea` classified (2 E-d16c + 6 F9 "a quiet `<-ing>`" from
  fix round 3's matcher — a verifier risk noted); gates (CPU 48 % external, normal rule met on run 1: 3 / 508 / 5, 9 / 5,394 / 35, the
  E-d2a suites only; rule (b) 106 paths, NONE; tsc 26 / 10); `wt/out` rebuilt 11:54:37 (markers 1 / 1 / 3). E-d16c (orchestrator
  message 11:46) taken into the Next step. No records (item 5 → builder #19), no launch, no model call.
- 2026-10-29 · builder #19 (E-d16d items 1–2) · ~35 tool calls · the greedy experiment in the kit (`sound-answer-greedy.ts`, driver
  `variants-fix4c`, the 7 corpus files run through an alias config): corpus 30 changed / 5 LOST vs `c5a6124` / 3 NEW vs `7967c6f` / 0
  conf moved / 7 files 1,080 green; broad 895 changed (799 reorders, read as patterns) / 56 LOST vs `c5a6124` (6 none left) / 20 NEW vs
  `7967c6f` / 0 conf moved / noun-first 15 vs 9; the six quiet probes fixed → NOT kept by E-d16d's rule (the fallback: no code change,
  the six are notes). No records (item 3 → builder #20), no gates / build needed, no launch, no model call.
- 2026-10-29 · builder #20 (E-d16d item 3, the records) · ~50 tool calls · the Status.md E3 entry (title; the new "Verifier
  round 4 FAIL (F4 …) → fix round 4" bullet :425-602 with builders #13–#19 in substance, every number re-opened in its report /
  log; the current-state parts that still described `7967c6f`; a fix-round-4 Gates bullet; Not measured (24)–(32); the For Hasan
  line) and TESTING §18.17 (material line, fix-round-4 item :534, Gates, notes) → `dbe935a`; re-checked after the commit (`src/`
  = `c5a6124`, 106 paths, matcher diff 0 bytes, `wt/out` 11:54:37 after `c5a6124`, markers 1 / 1 / 3); stale lines fixed and
  noted (Open problems "builder #20"). No `src/` change, no gate, no build, no launch, no model call. status: DONE → verifier
  round 5.

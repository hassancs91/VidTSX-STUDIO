# E3 — Reuse-before-generate (prompt rule, `generate_sfx` top-3 matches, `force`); Assets screen playback + origin/tag chips
status: NEW

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

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

**Builder #1:** read this file, E2's and E4's HANDOFF "Done", then the files under "§1.6 facts" (≈ 900 lines — the
prompt file, `audio-tools.ts`, `project-tools.ts` + `library-listing.ts`, `insert-tools.ts` :30-70, `AssetTile.tsx`,
`AssetDetailsPanel.tsx`, `asset-search.ts`, `AssetSearchBar.tsx`, the module server's `/asset` handler) and `UI_SPEC.md`
for the chips / controls. Write a **design note** here (under Done): (a) the matcher — a pure module (e.g.
`src/main/services/library/sound-match.ts`, ≤ 300 lines) scoring library audio entries for a prompt (tags, category,
description, file name; a threshold under which "no match" is returned), its top-3 answer text (refs + duration +
category + tags + LUFS + `usedIn` + "pass force:true to generate anyway"), and where `generate_sfx` calls it (before the
provider check); `generate_music` — the same rule or an explicit reason it differs; (b) the prompt rule wording
(`:70`, `:75`) and which existing prompt test pins it; (c) the Assets screen: playback (tile + details, one `<audio>`
at a time, the module-server URL, what happens when the server is down), the chips (origin, tags; filter semantics
in `asset-search.ts`), the sound fields in the details panel; (d) the G4 note; (e) the test list, red first; (f) the
live plan: the E3 profile (copy, no `settings.db`), E4's importer into it, the project, the stand-in's role per launch,
the turn budget. Then build (a) + (b) with tests, commit at a green checkpoint, hand off or continue by the 30 % rule.
Pure ops → tools → prompt → UI → live.

## Open problems

(none yet)

## Do-not-redo

(nothing yet)

## For Hasan (real-video list candidates)

- Listening to the Assets-screen playback and to a placed library whoosh in the real editor (the by-ear half of
  "plays"); the one live ElevenLabs generation (E2's item) through the reuse rule with `force`.

## Agents so far (date · approx tool calls · what they covered)

(none yet)

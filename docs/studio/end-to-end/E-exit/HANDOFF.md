# Track-E exit — §0 E5, a fresh check
status: NEW

> Track E, session 8 — runs only AFTER E3 verifier round 4 (E3's last, bar E-d15) PASSES. Updated 2026-10-29 for fix round 3's
> **miss rule** (E-d15, code `7967c6f`): on a miss with candidates `generate_sfx` answers the three closest library sounds and
> generates nothing — generation needs `force: true` (step 0's marker, step 6 (b), step 8). **Work only in the worktree**
> `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E\wt` (branch `end-to-end-p0-e`) for anything under git; the kit and the
> scratch root live OUTSIDE it. This is a CHECK, not a build: no `src/` or `scripts/` change. Written by the orchestrator.

## Goal (verbatim)

- Plan §3 Track E: `| **Track exit** | E5 met | |`.
- Plan §0 E5: "| E5 | **A generated sound is found before it is regenerated** | the agent asked for a sound that exists in the
  imported library | placed from the library, no generation call; a generated one appears with duration, tags, loudness, and
  plays |".

## How it is measured (orchestrator, from NEXT-SESSION "The track-E exit")

One fresh agent (a checker — it gets the exit and the safety rules, not the builders' conclusions), on a NEW isolated profile,
CDP **9280**, the worktree's own build (`wt/out`).

0. **Guard + build check.** C: free ≥ 3 GB and (C: free + memory commit headroom) ≥ 6 GB before the profile copy and before each
   launch; a watchdog that stops only OUR app (matched by profile path + `Name='electron.exe'`) if C: < 1.5 GB (kit
   `.vidtsx-temp\end-to-end\E1\watchdog.ps1`). 0 `electron.exe` of Hasan's running (his = `--user-data-dir` of `%APPDATA%\VidTSX
   Studio` or none) — if his app runs, E-d4 applies. Confirm `wt/out` is the build of the current `src/` (`git log -1 --format=%h --
   src/` must be the fix-round-3 code hash `7967c6f` (or a later one the orchestrator names) and the build stamp must follow it:
   `out/main/index.js` mtime after that commit's time, and the markers of the last matcher / tool changes present in
   `out/main/index.js` — `No library sound matched` (the miss rule, `7967c6f`) and `PLACEMENT_BONUS`); if not, STOP and say so
   (the orchestrator decides on a rebuild).
1. **Profile.** `robocopy C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\source\profile
   C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\E-exit\profile /E /XF settings.db*` — then list `settings.db*` in the copy:
   must be 0 (the app creates its own store at first launch; never open it). Never launch on `source`.
2. **First launch (no stand-in env):** Studio root FIRST (`studioRootSet({ root: 'D:\\repos\\VidTSX-STUDIO\\.vidtsx-temp\\end-to-end\\
   E-exit\\root' })` in the first CDP call, from a FILE-based driver; `studioRootGet` confirms), then `libraryRootGet` → must be
   `<E-exit profile>\assets` (stop if anything else), and the active Assistant provider (read without a model call — e.g. B6's
   `probe.mjs providers` shape → `claude-subscription`). Stop the app.
3. **Import (app stopped):** E4's importer into THIS profile's library only — dry run first, read it, then the real run (51 clips
   copied):
   `node scripts/import-sfx-library.mjs --library "C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\E-exit\profile\assets" --from
   D:\repos\claude-youtube-editor --dry-run --report C:\Users\hasan\AppData\Local\vidtsx-e2e\E-exit\import-dry.json` (from the
   worktree root; `node` only, never `npx`), then the same without `--dry-run` (`--report …\import.json`). The editor repo is
   read-only.
4. **Projects (seeded on disk, app stopped, or through the app's own IPC):** project **A** with TWO separate clip assets on V1 (two
   short distinct clips → one visible cut) and project **B** the same shape (for the "asked again" turn). Separate assets, not one
   asset split into two clips (the split-clip gap is a later track's, not this exit's).
5. **The stand-in:** make ONE mp3 with the source profile's full ffmpeg
   (`C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\source\profile\ffmpeg-full\ffmpeg-n8.1.2-50-g1a748fe2cd-win64-gpl-shared-8.1\bin\ffmpeg.exe`)
   — a short chime-like sound, deliberately NOT near −20 LUFS (so the normalization shows), bytes unlike any catalog clip; measure it
   (`ebur128=peak=true`) and keep it in the evidence folder. Relaunch WITH `VIDTSX_AUDIO_STANDIN_FILE=<that mp3>` (dev-only seam, E2;
   the provider id is `standin`; the engine initialises lazily, so its log line appears on first use). Studio root first again.
6. **Three Assistant turns, keyless `claude-subscription` only (≤ 3 turns + 1 retry on an API error; no `llmGenerate` probe — it
   is a model call), real input in the visible Assistant textarea:**
   - (a) project A: **"Add a soft whoosh at the first cut."** → PASS = the turn ends with an `insert_asset` card (or an applied
     clip) whose asset is a LIBRARY whoosh (`library:sfx/whoosh-…`), and NO generation: `<library>\generated\` file count and the
     index's `generated/` entries unchanged; no `standin` call in the app log; the tool calls of the turn (from the Assistant's
     messages) show `list_assets` and/or `generate_sfx` answering library matches.
   - (b) project A: **"Add a cuckoo clock chime at the first cut. The library has no cuckoo clock — generate a new one with force
     rather than reusing another chime."** (explicit, so ask-first costs no turn AND the model is told to pass `force`: under the miss
     rule (E-d15, `7967c6f`) the first `generate_sfx` call on a clean 51-clip library answers "No library sound matched … The closest
     library sounds:" — the chimes / clock-tick — and generates NOTHING; the model must call again with `force: true`) → PASS = the
     turn's tool calls show `generate_sfx` answering the closest library sounds (nothing generated, no `standin` call yet) and then
     `generate_sfx(…, force: true)` generating ONCE through the stand-in (`generated/` +1 file, one new index entry with
     `audio.source`/`model` `standin`, `audio.loudnessLufs` ≈ −20, `tags`, `probe.duration`, `usedIn` containing project A's id after
     the import/insert), an independent `ebur128` on the generated file = −20 ± 0.5 LUFS integrated and true peak ≤ −1.5 dBTP, and
     placed (an `insert_asset` card or clip for it). If the model places a library chime or asks instead of forcing, that is the
     turn's result — record it; then turn (c) becomes **"Generate it with force: true."** on project A (still inside the 3-turn
     budget) and the "asked again → FOUND" clause (c below) is measured through the REAL handler with the app STOPPED (no model; the
     E3 kit's `tools-noprovider-fix3.e3.test.ts` recipe on THIS profile's library) — stated in the report as a partial-live
     measurement.
   - (c) project **B**: **"Add a cuckoo clock chime at the first cut."** → PASS = FOUND in the library — now a MATCH (the generated
     chime's tags / description carry the words): the generated chime offered / placed by its `library:generated/…` ref ("The library
     already has …", not the miss answer), `generated/` count unchanged, no second `standin` call.
   If a turn ends asking a question instead of acting, that is the turn's result — record it (do not spend turns beyond the budget);
   one retry is allowed ONLY for an API / transport error.
7. **Assets screen (CDP, no model):** the generated chime's tile and details show duration, tags and loudness (the details' sound
   rows), and it PLAYS: click its tile play control (or the details `<audio controls>`) → an `<audio>` element with that file's
   module-server `src`, `!paused`, `currentTime` advancing over ~1 s, `readyState` ≥ 2. A still of the details panel.
8. **Report:** six lines (verdict per clause of E5: "found before regenerated", "placed from the library, no generation call", "a
   generated one appears with duration, tags, loudness", "and plays"; plus the miss rule — on the cuckoo's first ask the tool
   answered the closest library sounds and generated nothing, and generation happened only with `force` — or what happened), the
   evidence paths. The orchestrator records it in ORCHESTRATOR.md.

## Rules (binding)

- No paid-key call; generation only through the dev-only stand-in. Model calls only through the isolated instance's keyless
  `claude-subscription`, only the three turns (+1 retry on an API error). Never read, copy or open a credential store
  (`settings.db*` in ANY profile, `~/.claude`, …).
- Isolated profile only — never `%APPDATA%\VidTSX Studio` (Hasan's library / profile) or `~/Videos/VidTSX Studio/projects`. Never
  touch Hasan's stations (`B1-verify-root` + `profiles\B1-verify`, `B5-station-root` + `profiles\B5-station`) or any B6 / B7 scratch.
  The editor repo `D:\repos\claude-youtube-editor` is read-only (Python there only with `-I -B`).
- Worktree: never `npx` / `npm` there, never `git stash`, never touch the main checkout, its `out/` or `node_modules`. Docs
  (this HANDOFF, LOG.md) by the Edit / Write tools only. Select processes by `--remote-debugging-port=9280` or the profile path
  plus `Name='electron.exe'`, never a bare number. Stop only your own app; nothing of yours left running at hand-back.
- Scratch: kit + drivers `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\E-exit\` (copy what you need from the E1 / E3 / E3-verify
  / B6 kits — recipes, not results), scratch Studio root `…\E-exit\root`, evidence (> ~1 MB, logs, stills, JSON)
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\E-exit\`.
- Every git / tree / build statement you write is "as of `<hash>`".

## Kits (recipes only)

`docs/studio/end-to-end/DRIVING.md` "Track E" (launch recipe, Studio root FIRST, stop recipe); `docs/ui-automation-cdp.md`;
`.vidtsx-temp\end-to-end\E3\` (`launch.sh`, `restore.ps1`, `watchdog.ps1`, `cdp.mjs`, `e3.mjs` — `setupProject` two 3 s clips,
`runTurn`, `usageSince`, the `H` helpers incl. `findCur`); `.vidtsx-temp\end-to-end\E3-verify\` (`launch-standin.sh`,
`live-assets.mjs`, `whoosh.mjs`); `.vidtsx-temp\end-to-end\B6\` (`run.mjs`, `probe.mjs`). Kits are read-only: copy into the E-exit
kit and change the profile / port / paths.

## Done

(nothing yet)

## Verified

(nothing yet)

## Next step

Exit checker #1: steps 0–8 above, in order; hand off per the 30 % rule (write this file as you go, commit it and LOG.md with
explicit paths — `git add docs/studio/end-to-end/E-exit/HANDOFF.md docs/studio/end-to-end/E-exit/LOG.md` — at each step).

## Open problems

## Agents so far

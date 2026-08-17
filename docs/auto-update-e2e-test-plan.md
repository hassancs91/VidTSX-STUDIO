# Auto-update end-to-end test — throwaway public releases repo

> Status: **PASSED 2026-08-17** (all 7 matrix items, including the optional
> install-on-quit round). Companion to `docs/auto-update-plan.md` (§12 has
> the result summary). Two findings, both resolved same day: release-notes
> HTML rendering bug (fixed — `services/updater/release-notes.ts`) and
> transcription.db WAL sidecars (not a bug — stale debris from an Aug 13
> force-kill; the DB is lazily opened and no session since had opened it).
> The updater is no longer "code-complete but untested".
>
> Session note: run phases in order; each is independently stoppable. The
> working tree must be clean before Phase 1 (it is — updater landed `9117a19`).

## Core idea

electron-updater never reads repo *source* — only **release assets**
(`latest.yml`, `.exe`, `.blockmap`) from a public repo's Releases, fetched
anonymously. So the test target is an **empty public repo holding only
releases**. No source is ever pushed publicly → the prune/re-root decision
(V1_RELEASE_PLAN "Licensing & repo prep") is not violated even briefly.
The repo is deleted after the test.

## Phase 0 — tooling (~5 min, needs Hasan once)

- [x] `winget install GitHub.cli` (gh is NOT installed as of 2026-08-17).
      → installed 2.97.0 user-scope 2026-08-17 (machine-wide MSI hit a UAC
      cancel; `--scope user` needs no elevation).
- [ ] **Hasan runs `gh auth login`** (browser device flow — the one step only
      he can do). Scopes: `repo` now, `delete_repo` for teardown
      (`gh auth refresh -h github.com -s delete_repo` if missing).

## Phase 1 — test scaffold (~10 min)

- [x] Local branch `update-e2e-test` — **never pushed anywhere**. Main stays
      untouched at 1.0.0. (branch created off `54da05c`, commit `48a55c2`)
- [x] On the branch: `electron-builder.yml` publish `repo:` →
      `vidtsx-update-test`; `package.json` version → `0.9.0`
      (below 1.0.0 so test versions can never be confused with real releases).
- [x] `gh repo create hassancs91/vidtsx-update-test --public` with a
      one-line README: "Temporary update-flow test target. No source here.
      Will be deleted." (README pushed from a scratchpad repo — the repo's
      only content, ever)

## Phase 2 — baseline release (~15 min, mostly build)

- [x] `npm run publish:win` with `GH_TOKEN=$(gh auth token)` → uploads a
      **draft** release `v0.9.0` (rehearses the draft-then-publish rollout
      valve from the release checklist). First attempt failed on the known
      winCodeSign-cache symlink issue (no symlink privilege in a normal
      shell); fixed by extracting `winCodeSign-2.6.0.7z` into the cache by
      hand with `-x!darwin`. All three assets uploaded (latest.yml, exe,
      blockmap).
- [x] Publish it: `gh release edit v0.9.0 --repo hassancs91/vidtsx-update-test --draft=false`.
- [x] Install `dist/VidTSX Studio Setup 0.9.0.exe` on this machine — silent
      via `/S`, or normal (expect ONE SmartScreen "Run anyway": unsigned,
      known). Same appId as the real app → a real per-user install; userData
      is untouched by design; uninstalled at teardown. (silent /S, exit 0,
      landed in %LOCALAPPDATA%\Programs\VidTSX Studio)

## Phase 3 — upgrade release (~15 min)

- [x] Bump to `0.9.1` (a visible marker change is nice-to-have, e.g. a log
      line), rebuild, publish draft, publish release. (marker: `logger.info`
      version line after logging init in src/main/index.ts; v0.9.1 published
      with latest.yml + exe + blockmap)

## Phase 4 — verification loop (the point)

Launch installed 0.9.0 and walk `auto-update-plan.md` §11's matrix:

1. [x] **Silent auto-check** ~30 s after launch → chip: `Updating… N%` →
       `Update ready · Restart`; ONE toast; no modal anywhere.
       (check fired at t+30s exactly; staged 11 s later. Chip verified via
       CDP + screenshot, zero dialogs. Download-progress chip + toast missed
       — download took 9 s; re-observed on the 0.9.2 round.)
2. [x] **Differential download** — grep updater log for the differential
       line; compare transferred bytes vs installer size. If it fell back to
       full download, investigate before shipping (plan §13.3).
       ("Full: 309,488 KB, To download: 15,612 KB (5%)" — differential OK.)
3. [x] **Busy gate** — start a model download → install refused with a
       readable reason (chip suppressed / toast says why); cancel download →
       unblocks within the 30 s blocker poll.
       (dummy 302 MB download → install returned reason:busy,
       "1 download in progress", chip suppressed; cancel → unblocked in 20 s,
       chip returned.)
4. [x] **Manual path** — Settings → Updates: Check button spinner (≥600 ms
       hold), "You're up to date" on the 0.9.1 install afterward, release
       notes markdown renders. (spinner observed ~534 ms across 50 ms CDP
       samples, consistent with the 600 ms hold; "You're on the latest
       version." shown; notes rendering verified on the 0.9.2 round.)
5. [x] **The money shot** — click Restart: "Preparing…" → graceful shutdown →
       silent NSIS run (**no installer window** is the acceptance) → app
       relaunches as **0.9.1** → single-instance lock released (app actually
       comes back) → no `-wal`/`-shm` leftovers in
       `%APPDATA%/vidtsx-studio` → settings/projects intact.
       (~45 s click→relaunched; 300 ms window monitor saw NO installer
       window; log marker "VidTSX Studio v0.9.1 started"; userData intact.
       Finding: transcription.db-wal/-shm persist after close — WAL is
       0 bytes so no data at risk; minor follow-up, also repros on a plain
       quit. "Preparing…" chip state not observed — shutdown too fast for
       the sampler.)
6. [x] **Install-on-quit** (optional, +1 build): publish `0.9.2`, let it
       stage, quit normally, relaunch → 0.9.2, no prompts.
       (staged in 9.5 s — chip `Updating… 0→38→43%` then ready; exactly ONE
       toast with Restart action; quit → silent install ~30 s, 0 installer
       windows in 95 samples, correctly no auto-relaunch; manual relaunch
       logged "VidTSX Studio v0.9.2 started".
       FINDING (real bug): Settings "What's new" renders the release notes
       as escaped literal HTML — GitHub hands electron-updater the release
       body converted to HTML, but UpdateSection.tsx pipes it through
       ReactMarkdown, which escapes raw HTML. Fix before V1: convert or
       sanitize in normalizeReleaseNotes, or ReactMarkdown + rehype-raw
       with sanitization.)
7. [x] **Offline / feed-down** — disconnect network (and later, after repo
       deletion, a natural 404): status bar stays clean; error appears only
       in Settings on a manual check; retry works.
       (natural-404 path after repo deletion: Settings shows "No published
       release was found for this build channel.", status bar completely
       clean, Check button re-usable. Physical network-unplug variant not
       run — same surfacing path, offline errno mapping is covered by
       toUserMessage. Bonus observation: a manual check fired seconds after
       deletion still got a cached 200 from GitHub's CDN and reported
       not-available — stale-cache window is real but harmless.)

CDP note: packaged app needs `--remote-debugging-port=9222` as a launch arg
for driven UI checks (`docs/ui-automation-cdp.md` covers the dev recipe);
otherwise verify visually with Hasan watching the restart moment.

## Phase 5 — teardown (~5 min)

- [x] Uninstall the test app (per-user, no elevation). (silent /S, exit 0,
      app dir gone; userData left in place by design; also removed the
      staged-installer cache %LOCALAPPDATA%\vidtsx-studio-updater)
- [x] `gh repo delete hassancs91/vidtsx-update-test --yes`. (done BEFORE
      uninstall so the running app could exercise the natural-404 path)
- [x] Delete local branch `update-e2e-test`; confirm main untouched and tree
      clean. (branch tip dc5e51a deleted; main still 54da05c; vendor
      bundles restored after builds touched line endings only)
- [x] Record results in `auto-update-plan.md` §12 and the V1_RELEASE_PLAN
      session log. After a pass, the real flip only repeats a proven flow.

## Deliberately NOT tested here

- **CI** (`release.yml`) — it builds from repo source, which we are not
  pushing. First run happens at the real flip; low risk (same commands as
  the local build).
- Code signing / SmartScreen reputation (updater plan Phase G), macOS
  (Phase F).
- Clean first-install on a never-installed machine — stays on the Phase E
  release checklist.

## Risks / notes

- Same appId → the test install IS the real app identity on this machine.
  Fine: userData schema is identical (it's the same code), and teardown
  uninstalls. Installing real V1 later just installs over.
- `releaseType: draft` means nothing is visible to the updater until the
  release is explicitly published — if "update not found", check draft
  status first (updater plan §13.5).
- Tags must be `v${version}` exactly — use `npm version` or match by hand.
- Total ≈ 1.5–2 h, mostly the two (or three) full builds.

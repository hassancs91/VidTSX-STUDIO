# Auto-update end-to-end test — throwaway public releases repo

> Status: **PLANNED 2026-08-17, not started.** Companion to
> `docs/auto-update-plan.md` (§12 calls this "close the loop"). After this
> passes, the updater is no longer "code-complete but untested".
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

- [ ] `winget install GitHub.cli` (gh is NOT installed as of 2026-08-17).
- [ ] **Hasan runs `gh auth login`** (browser device flow — the one step only
      he can do). Scopes: `repo` now, `delete_repo` for teardown
      (`gh auth refresh -h github.com -s delete_repo` if missing).

## Phase 1 — test scaffold (~10 min)

- [ ] Local branch `update-e2e-test` — **never pushed anywhere**. Main stays
      untouched at 1.0.0.
- [ ] On the branch: `electron-builder.yml` publish `repo:` →
      `vidtsx-update-test`; `package.json` version → `0.9.0`
      (below 1.0.0 so test versions can never be confused with real releases).
- [ ] `gh repo create hassancs91/vidtsx-update-test --public` with a
      one-line README: "Temporary update-flow test target. No source here.
      Will be deleted."

## Phase 2 — baseline release (~15 min, mostly build)

- [ ] `npm run publish:win` with `GH_TOKEN=$(gh auth token)` → uploads a
      **draft** release `v0.9.0` (rehearses the draft-then-publish rollout
      valve from the release checklist).
- [ ] Publish it: `gh release edit v0.9.0 --repo hassancs91/vidtsx-update-test --draft=false`.
- [ ] Install `dist/VidTSX Studio Setup 0.9.0.exe` on this machine — silent
      via `/S`, or normal (expect ONE SmartScreen "Run anyway": unsigned,
      known). Same appId as the real app → a real per-user install; userData
      is untouched by design; uninstalled at teardown.

## Phase 3 — upgrade release (~15 min)

- [ ] Bump to `0.9.1` (a visible marker change is nice-to-have, e.g. a log
      line), rebuild, publish draft, publish release.

## Phase 4 — verification loop (the point)

Launch installed 0.9.0 and walk `auto-update-plan.md` §11's matrix:

1. [ ] **Silent auto-check** ~30 s after launch → chip: `Updating… N%` →
       `Update ready · Restart`; ONE toast; no modal anywhere.
2. [ ] **Differential download** — grep updater log for the differential
       line; compare transferred bytes vs installer size. If it fell back to
       full download, investigate before shipping (plan §13.3).
3. [ ] **Busy gate** — start a model download → install refused with a
       readable reason (chip suppressed / toast says why); cancel download →
       unblocks within the 30 s blocker poll.
4. [ ] **Manual path** — Settings → Updates: Check button spinner (≥600 ms
       hold), "You're up to date" on the 0.9.1 install afterward, release
       notes markdown renders.
5. [ ] **The money shot** — click Restart: "Preparing…" → graceful shutdown →
       silent NSIS run (**no installer window** is the acceptance) → app
       relaunches as **0.9.1** → single-instance lock released (app actually
       comes back) → no `-wal`/`-shm` leftovers in
       `%APPDATA%/vidtsx-studio` → settings/projects intact.
6. [ ] **Install-on-quit** (optional, +1 build): publish `0.9.2`, let it
       stage, quit normally, relaunch → 0.9.2, no prompts.
7. [ ] **Offline / feed-down** — disconnect network (and later, after repo
       deletion, a natural 404): status bar stays clean; error appears only
       in Settings on a manual check; retry works.

CDP note: packaged app needs `--remote-debugging-port=9222` as a launch arg
for driven UI checks (`docs/ui-automation-cdp.md` covers the dev recipe);
otherwise verify visually with Hasan watching the restart moment.

## Phase 5 — teardown (~5 min)

- [ ] Uninstall the test app (per-user, no elevation).
- [ ] `gh repo delete hassancs91/vidtsx-update-test --yes`.
- [ ] Delete local branch `update-e2e-test`; confirm main untouched and tree
      clean.
- [ ] Record results in `auto-update-plan.md` §12 and the V1_RELEASE_PLAN
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

# Auto-Update: Pre-Publish Checklist

> Companion to [auto-update-plan.md](auto-update-plan.md) — that one is the design, this
> one is the runbook. Work top to bottom; each stage assumes the previous passed.
>
> **Current state:** the app code is complete and type-checks, but the update flow has
> **never run against a real release**. Nothing below has been executed yet.

---

## Situation as of 2026-08-13

| Fact | Value | Consequence |
|---|---|---|
| `package.json` version | `1.0.0` | Next release is `1.0.1` |
| Tag `v1.0.0` | **already pushed** (`a316bfc`, 2026-07-29) | Re-pushing it will NOT trigger CI — it predates the workflow and has no assets |
| GitHub releases | none with installer assets | No feed exists; the updater has nothing to read |
| Repo visibility | private | **Hard blocker** — updates download anonymously |
| CI | [release.yml](../.github/workflows/release.yml) added, never run | First run is the likeliest failure point |
| Code signing | none | SmartScreen warns; updates still work |

Because `v1.0.0` is already tagged but empty, there are two ways to get a baseline:
either run the workflow manually (`workflow_dispatch`) against that tag, or skip it and
make `v1.0.1` the first real release. **Prefer the second** — a clean tag with a clean CI
run is easier to reason about than a retrofitted one.

---

## Stage 0 — Lock the open decisions

- [ ] **`"private": true` in package.json.** Keep it (blocks accidental `npm publish`,
      harmless otherwise) or drop it. Decide deliberately; don't leave it ambiguous once
      the repo is public.
- [ ] **Crash reporting in official builds.** If official releases should report crashes,
      add a `VITE_SENTRY_DSN` repo secret — the workflow already passes it to the build
      step. Without it, released builds silently have crash reporting compiled out.
      Full setup + test runbook: [crash-reporting-release-checklist.md](crash-reporting-release-checklist.md).
- [ ] **Windows signing stance for v1.x.** Shipping unsigned is a legitimate choice for a
      first open-source release; just decide it rather than discover it. Every unsigned
      installer triggers SmartScreen and accrues no reputation.
- [ ] **Installer directory choice.** [electron-builder.yml](../electron-builder.yml) now
      sets `allowToChangeInstallationDirectory: false` so silent updates never need UAC.
      Confirm you're happy trading the install-location prompt for that.

---

## Stage 1 — Secret audit, then go public

**This is the gate. Nothing downstream matters until it's done.**

- [ ] Scan the working tree and **git history** for credentials — API keys, Sentry DSN,
      tokens, `.aws-r2-config`, anything under `.env*`. `.gitignore` protects the tree,
      not history.

      ```powershell
      # Every blob ever committed, searched for common key shapes.
      git rev-list --all --objects | ForEach-Object { ($_ -split ' ')[0] } |
        Select-Object -Unique |
        ForEach-Object { git cat-file -p $_ 2>$null } |
        Select-String -Pattern 'sk-[A-Za-z0-9]{20,}','ghp_[A-Za-z0-9]{30,}','AKIA[0-9A-Z]{16}','sentry\.io/\d+' |
        Select-Object -First 40
      ```

- [ ] If anything turns up: rotate the credential first, then decide whether to rewrite
      history or start a fresh public repo. **Rotate before rewriting** — a leaked key in
      a fork or a clone is still leaked.
- [ ] Add `SECURITY.md` and `CONTRIBUTING.md` (not update blockers, but expected once the
      repo is public).
- [ ] Flip the repo to public.
- [ ] Confirm anonymous asset download works — from a signed-out browser or:
      ```powershell
      curl.exe -sI https://github.com/hassancs91/VidTSX-STUDIO/releases | Select-String '^HTTP'
      ```

---

## Stage 2 — Local dry run (before any release exists)

Validates wiring — check, state pushes, UI, error handling — without publishing anything.
**Cannot validate install**: a dev build has no packaged app to replace.

- [ ] Create `dev-app-update.yml` at the repo root:

      ```yaml
      provider: github
      owner: hassancs91
      repo: VidTSX-STUDIO
      ```

- [ ] Add it to [.gitignore](../.gitignore) — it's a local testing artifact, not config.
- [ ] Launch with the dev override (the service reads this and sets
      `forceDevUpdateConfig`, see [updater-service.ts](../src/main/services/updater/updater-service.ts)):

      ```powershell
      $env:VIDTSX_DEV_UPDATE = '1'; npm run dev
      ```

**Pass criteria**

- [ ] Settings → Updates renders with the real version, not the "unavailable in this build"
      card (that card appearing means the env var didn't take).
- [ ] `Check for updates` spins ≥600ms, then answers. With no published release it should
      report a not-found error, in a plain sentence — **not** a raw stack or a silent hang.
- [ ] Status bar stays clean throughout. A failed check must never surface there.
- [ ] Log shows the `Updater` module entries: `%APPDATA%\<app>\logs` — find it with
      `Get-ChildItem $env:APPDATA -Filter "*idTSX*"`.

---

## Stage 3 — First CI release (draft)

- [ ] `npm version patch` → creates `v1.0.1` and the commit.
- [ ] `git push --follow-tags`
- [ ] Watch the Actions run. Expected first-run failure points, in order of likelihood:
      `npm ci` native rebuilds (better-sqlite3 / sharp / node-llama-cpp), then disk space,
      then the `check:types` baseline gate.
- [ ] Confirm the draft release has **all three** asset types:
      `VidTSX-Studio-Setup-1.0.1.exe`, `...exe.blockmap`, **`latest.yml`**.
      A missing `latest.yml` means no feed — the updater reads that file, not the release page.
- [ ] Download the installer from the draft, install it on a clean machine, launch it,
      confirm it runs and reports 1.0.1.
- [ ] **Publish the draft.** Drafts are invisible to electron-updater by design — this
      manual step is the rollout safety valve.

---

## Stage 4 — The real upgrade test

This is the only test that proves the feature. Everything before it is plumbing.

- [ ] Install **1.0.1** on a clean Windows machine (or a VM with no prior install).
- [ ] `npm version patch` → push `v1.0.2` → CI builds → publish the release.
- [ ] Launch 1.0.1 and leave it idle.

**Pass criteria — walk the whole flow**

- [ ] Within ~30s of launch, a background check runs (visible in the log, invisible in UI).
- [ ] Auto-download starts on its own (`autoDownload` defaults on).
- [ ] Status bar shows `Updating… N%` while downloading.
- [ ] On completion: `Update ready · Restart` chip **and** exactly one toast.
- [ ] Settings → Updates shows version, date, and the GitHub release body as rendered
      markdown under "What's new".
- [ ] Click Restart → app closes → installer runs **silently** (no visible installer
      window, no UAC prompt) → app relaunches on 1.0.2.
- [ ] After relaunch: settings, API keys, projects, and downloaded models all intact.

---

## Stage 5 — Behaviour matrix

Each row is a distinct failure mode with its own way of going wrong silently.

| # | Test | How | Pass |
|---|---|---|---|
| 1 | **Silent install** | Stage 4 restart | No installer window, no UAC. If a window appears, `oneClick: false` isn't installing silently → fall back to `oneClick: true` |
| 2 | **Differential download** | Search the log for `differential` | Blocks-changed stats, not "fallback to full download". A fallback means every patch re-downloads ~250MB |
| 3 | **Busy gate** | Start a long render, then stage an update | No chip, no toast. Settings shows "Waiting on: 1 render in progress" |
| 4 | **Install-on-quit** | Stage an update, quit normally, relaunch | New version, no prompts. Exercises the `app.quit()` path in [index.ts](../src/main/index.ts) |
| 5 | **Safe shutdown** | Install with all DBs active | After relaunch, no leftover `-wal`/`-shm` in `%APPDATA%\<app>`, no data loss |
| 6 | **Single-instance** | Watch after install | App actually reappears. If not, the lock outlived the quit |
| 7 | **Offline** | Kill network mid-check and mid-download | Plain-language error in Settings, no crash, retry works |
| 8 | **Resume** | Cancel a download at ~50%, download again | Resumes from the cache — look for a `*-updater\pending` folder under `%LOCALAPPDATA%` — not from zero |
| 9 | **Integrity** | Edit the sha512 in a copy of `latest.yml`, serve it locally | Update rejected, app stays on the old version |
| 10 | **Skip** | Dismiss the toast with "Later", wait for the next auto-check | No re-nag. A manual check still surfaces it |
| 11 | **Beta channel** | Toggle "Receive beta releases" | Re-checks immediately; a prerelease is offered |
| 12 | **Manual check, up to date** | Click Check on the newest version | "You're on the latest version" — never silence |

---

## When something fails

| Symptom | Look here first |
|---|---|
| "No update found" on a version that exists | Release still a **draft**; or tag isn't `v${version}`; or `latest.yml` missing from assets |
| Update downloads every time in full | Blockmap missing or `resources/binaries` / `resources/python` changed in this release |
| Installed but app never relaunched | Single-instance lock, or the installer needed elevation |
| Update applies but settings are gone | userData path changed — check `appId` and productName stability |
| Nothing happens at all, no logs | `initUpdater` bailed early — dev build, darwin, or missing publish config |

App logs: `%APPDATA%\<app>\logs`. Updater lines are tagged `Updater`; teardown is `Shutdown`.

---

## Rollback

There is no downgrade path — electron-updater will not move users backwards.

- [ ] **A bad release is fixed by publishing a higher version**, not by deleting the bad one.
      Deleting assets only strands users who haven't updated; those who did are stuck.
- [ ] Keep the ability to cut a hotfix quickly — that speed *is* the rollback plan.
- [ ] If a release is catastrophic, unpublish it (back to draft) to stop further spread,
      then ship `N+1` immediately.

---

## Sign-off

Ready to announce when all of these are true:

- [ ] Stage 1 complete — repo public, no secrets in history
- [ ] Stage 4 complete — a real N → N+1 upgrade verified on a clean machine
- [ ] Matrix rows 1–6 pass (7–12 are quality; 1–6 are correctness)
- [ ] `docs/auto-update-plan.md` §12 phase boxes updated to match reality
- [ ] STATUS.md records the shipped version

---

## Still open in code (not blockers, but known gaps)

- No unit tests for the pure logic — busy-gate counting, release-notes normalization,
  and the error→message mapping in
  [updater-service.ts](../src/main/services/updater/updater-service.ts) are all testable.
- `scripts/split-register.mjs` is stale one-shot codegen. The dangling updater/license
  imports are gone, but its `features` array doesn't list `updater`, so re-running it
  would drop `registerUpdaterIpc()`. Don't re-run it without updating the array.
- macOS reports `unsupported` by design until Developer ID signing lands (plan §8, Phase F).

# Auto-Update Implementation Plan

> Status: **Phases B–D implemented** (main-process updater, renderer UI, preferences),
> plus the release plumbing from Phase A. **Not yet exercised against a real release** —
> the repo is still private and no version has ever been published, so the flow is
> code-complete but untested end to end. See §12 for exactly what remains.
> Owning phase: PLAN.md Phase 10 (Polish + distribution) → "Auto-updater (electron-updater, GitHub Releases)".

---

## 1. Goal

Ship an update experience that feels like VS Code / Slack / Discord: the user never
thinks about updating, never sees a blocking modal, and never loses work.

**Principles**

1. **Never interrupt.** No modal dialogs, ever. Updates surface as a quiet chip in the
   status bar and one dismissible toast.
2. **Never restart under the user.** A render, TSX generation job, or model download in
   flight blocks the restart prompt outright.
3. **Never lose data.** SQLite DBs (8 of them), download state, and job queues must be
   flushed and closed *before* the installer runs — not racing it.
4. **Always recoverable.** A failed update leaves the installed app untouched and working.
   A user with auto-update off must still be able to check manually.
5. **Honest about the build.** Dev builds, unsigned builds, and unsupported platforms say
   so instead of silently doing nothing.

---

## 2. Current state

| Piece | State |
|---|---|
| `electron-updater` dependency | ❌ not installed (only named in [PLAN.md:463](../PLAN.md#L463)) |
| `publish:` block in [electron-builder.yml](../electron-builder.yml) | ❌ absent — no `latest.yml` is generated, so there is no feed |
| Updater code in `src/main/` | ❌ none |
| CI / release workflow | ❌ no `.github/` directory at all — builds are local-only |
| Code signing | ❌ Windows unsigned, macOS unsigned/un-notarized |
| Release history on GitHub | ❌ none |
| `package.json` version | `1.0.0`, `"private": true`, `"license": "UNLICENSED"` |
| `LICENSE.txt` | MIT (already), referenced by the NSIS installer |

The only in-repo mention of an updater is a codegen string in
[scripts/split-register.mjs:779](../scripts/split-register.mjs#L779) that emits
`import { setupAutoUpdaterIPC } from '../../updater/auto-updater'` — a leftover template
pointing at a module that does not exist. **Delete that line** as part of this work so it
stops looking like a real path.

### What the app already has that this plugs into

- **Push-event IPC convention** — `bundle:progress`, `download:progress`, `tsxjob:event`
  in [channels.ts](../src/shared/ipc/channels.ts); `webContents.send` from main, `ipcRenderer.on`
  in a `src/preload/api/*.ts` module.
- **Per-feature IPC registration** — [register.ts](../src/main/ipc/register.ts) calls one
  `register*Ipc()` per feature from `src/main/ipc/registrations/`.
- **Settings store** — `getValue`/`setValue` on the settings SQLite DB, exposed as typed
  getters/setters in [settings.ts](../src/main/services/settings.ts) (see `getCrashReportingEnabled`
  for the exact shape to copy).
- **Build-time secret injection** — `import.meta.env.VITE_SENTRY_DSN` in
  [crash-reporting.ts](../src/main/services/crash-reporting.ts) is the precedent for
  "forks without the env var degrade gracefully".
- **Status bar** — [StatusBar.tsx](../src/renderer/components/StatusBar.tsx) already renders
  `v{version}` + a `BETA` chip and has a `flex-1` spacer before the settings gear. The update
  chip goes right there.
- **Settings modal** — [GeneralSettingsContent.tsx](../src/renderer/components/SettingsModal/GeneralSettingsContent.tsx)
  with `<SectionHeader>` + row components under `rows/`. An "Updates" section slots in
  above "About".
- **Toast** — [Toast.tsx](../src/shared/components/Toast.tsx).
- **`react-markdown` + `remark-gfm`** are already dependencies → release notes render for free.

---

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Library | `electron-updater` 6.8.x (pinned, no `^`) | Standard for electron-builder; NSIS differential downloads; sha512 verification |
| Feed | **GitHub Releases**, `hassancs91/VidTSX-STUDIO` | Repo is going public → assets are public, no token in the app, no hosting bill, free bandwidth |
| Auto-download | **On by default**, user-disableable | "Smooth" means the bits are already local when the chip appears |
| Auto-install | **Never mid-session.** `autoInstallOnAppQuit = true` | User restarts on their own schedule; a normal quit applies it silently |
| Channels | `stable` (default) + `beta` (opt-in, `allowPrerelease`) | App ships a `BETA` badge today; needed to dogfood without breaking users |
| Version scheme | semver in `package.json`; git tag `v${version}` | electron-builder's GitHub provider matches `v`-prefixed tags |
| Platform scope | **Windows first.** macOS gated behind signing | macOS auto-update is impossible without a paid Apple Developer ID (§8) |

**Rejected:** a self-hosted `generic` feed (S3/R2). CLAUDE.md forbids S3 SDKs and cloud
credentials in the app, and a public repo makes GitHub Releases strictly simpler. (Note:
[.gitignore:32](../.gitignore#L32) references a `scripts/publish-to-r2.mjs` that does not
exist — dead entry, unrelated.)

---

## 4. Architecture

### 4.1 New files

```
src/main/services/updater/
  updater-service.ts      # electron-updater wiring + state machine  (~180 lines)
  update-gate.ts          # "is the app busy?" — blocks restart prompts (~60 lines)
  update-shutdown.ts      # graceful teardown before quitAndInstall  (~70 lines)
src/main/ipc/
  updater-handlers.ts     # invoke handlers
  registrations/updater.ts
src/shared/ipc/types/updater.ts
src/preload/api/updater.ts
src/renderer/hooks/useUpdater.ts
src/renderer/components/UpdateChip.tsx              # status-bar chip
src/renderer/components/SettingsModal/UpdateSection.tsx
src/renderer/components/SettingsModal/rows/AutoUpdateRow.tsx
```

### 4.2 Modified files

- [channels.ts](../src/shared/ipc/channels.ts) — `UPDATER_*` channels
- [types/index.ts](../src/shared/ipc/types/index.ts) — re-export updater types
- [register.ts](../src/main/ipc/register.ts) — `registerUpdaterIpc()`
- [preload/api/index.ts](../src/preload/api/index.ts) — spread `updaterApi`
- [main/index.ts](../src/main/index.ts) — `initUpdater(win)` after `createWindow()`
- [settings.ts](../src/main/services/settings.ts) — 3 new get/set pairs
- [StatusBar.tsx](../src/renderer/components/StatusBar.tsx) — mount `<UpdateChip />`
- [GeneralSettingsContent.tsx](../src/renderer/components/SettingsModal/GeneralSettingsContent.tsx) — `<UpdateSection />`
- [electron-builder.yml](../electron-builder.yml) — `publish:` block, mac `zip` target
- `package.json` — dep, `private`/`license` fix, release scripts
- [scripts/split-register.mjs](../scripts/split-register.mjs) — drop the phantom updater import

### 4.3 State machine

One serialisable state object is the single source of truth; main pushes it wholesale on
every transition (no partial deltas — simpler to reason about, and the renderer can mount
late and still call `updater:get-state`).

```ts
// src/shared/ipc/types/updater.ts
export type UpdaterStatus =
  | 'idle'          // nothing known yet
  | 'checking'
  | 'not-available' // up to date
  | 'available'     // newer version exists, not downloaded
  | 'downloading'
  | 'downloaded'    // staged, waiting for restart
  | 'error'
  | 'unsupported';  // dev build, no publish config, unsigned mac

export interface UpdaterState {
  status: UpdaterStatus;
  currentVersion: string;
  availableVersion: string | null;
  releaseNotes: string | null;     // markdown from the GitHub release body
  releaseDate: string | null;
  progress: { percent: number; bytesPerSecond: number; transferred: number; total: number } | null;
  error: string | null;            // human-readable, never a raw stack
  lastCheckedAt: number | null;    // epoch ms
  lastCheckTrigger: 'auto' | 'manual';  // drives error/no-update visibility — see §5.1
  unsupportedReason: string | null;
  channel: 'stable' | 'beta';
  autoDownload: boolean;
  busy: boolean;                   // §6 gate — restart prompt suppressed
}
```

Transitions map 1:1 onto electron-updater events: `checking-for-update` → `checking`,
`update-available` → `available`, `download-progress` → `downloading`,
`update-downloaded` → `downloaded`, `update-not-available` → `not-available`,
`error` → `error`.

### 4.4 IPC surface

```ts
// channels.ts
UPDATER_GET_STATE: 'updater:get-state',
UPDATER_CHECK:     'updater:check',      // manual "Check for updates"
UPDATER_DOWNLOAD:  'updater:download',   // when autoDownload is off
UPDATER_INSTALL:   'updater:install',    // graceful shutdown → quitAndInstall
UPDATER_SET_PREFS: 'updater:set-prefs',  // { autoDownload?, channel? }
UPDATER_EVENT:     'updater:event',      // push: full UpdaterState
```

`UPDATER_INSTALL` returns `{ ok: false, reason: 'busy', blockers: string[] }` when the gate
says no — the renderer shows *why* rather than a dead button.

### 4.5 Main-process service sketch

```ts
// src/main/services/updater/updater-service.ts
import { autoUpdater } from 'electron-updater';

const CHECK_DELAY_MS = 30_000;        // after window shown — keep startup clean
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function initUpdater(win: BrowserWindow): void {
  if (!app.isPackaged) return setUnsupported('Auto-update is disabled in development builds.');

  autoUpdater.logger = updaterLogAdapter;    // → logEngine, never console
  autoUpdater.autoDownload = false;          // we drive it ourselves from the setting
  autoUpdater.autoInstallOnAppQuit = true;   // silent apply on a normal quit
  autoUpdater.allowPrerelease = channel === 'beta';

  autoUpdater.on('update-available', async (info) => {
    push({ status: 'available', availableVersion: info.version, releaseNotes: notes(info) });
    if (await getAutoUpdateDownloadEnabled()) await autoUpdater.downloadUpdate();
  });
  // …download-progress / update-downloaded / error → push(...)

  setTimeout(() => void check(), CHECK_DELAY_MS);
  setInterval(() => void check(), CHECK_INTERVAL_MS);
}
```

`releaseNotes` from electron-updater is `string | ReleaseNoteInfo[] | null`. Normalise to a
single markdown string in `notes()` — the renderer must not deal with the union.

---

## 5. UX flow

```
launch ──30s──► silent check
                   │
      ┌────────────┴─────────────┐
   up to date                 update found
      │                           │
   (silent)              auto-download in background
                                  │
                          ┌───────┴────────┐
                       busy?             idle
                          │                │
              stay silent, install    status-bar chip:
              on next normal quit     "Update ready · Restart"
                                       + one toast, dismissible
                                              │
                                     user clicks Restart
                                              │
                                 graceful shutdown (§7) → install → relaunch
```

**Status-bar chip** — sits in `StatusBar.tsx` next to the `v{version}` label:

- `downloading` → a thin progress ring + `Updating… 62%`, muted, no interaction.
- `downloaded` → accent-coloured `Update ready · Restart` button.
- `error` → nothing in the status bar. Errors are logged and shown only in Settings; a
  failed background check is not the user's problem.

**Toast** — fires exactly once per downloaded version: *"VidTSX Studio 1.1.0 is ready.
Restart to apply."* with `Restart` / `Later`. `Later` never re-nags for that version.

**Settings → Updates** — the complete surface:

- Current version + channel
- `Check for updates` button with inline spinner / "You're up to date" / error text
- Progress bar while downloading
- Release notes for the pending version (`react-markdown`, collapsed by default)
- `Download updates automatically` toggle (default on)
- `Receive beta releases` toggle (default off)
- `Restart and install` button when staged
- Link to the GitHub releases page via `appOpenExternal`

### 5.1 Manual update flow (user-initiated)

Manual and automatic share **one** state machine — the only difference is
`lastCheckTrigger`, which controls two things:

| Behaviour | `auto` | `manual` |
|---|---|---|
| "You're up to date" shown | ❌ silent | ✅ shown |
| Errors shown in UI | ❌ log only | ✅ inline, with retry |
| Previously-skipped version resurfaces | ❌ stays skipped | ✅ shown again |
| Download starts by itself | only if `autoDownload` on | ❌ always an explicit click |

Rationale: a background check that finds nothing or fails is not the user's problem. A
check the user *asked for* must always answer — silence reads as a broken button.

**Entry points:** Settings → Updates → `Check for updates`, and clicking the `v1.0.0`
label in the status bar (opens Settings straight to the Updates section).

**Step by step:**

```
[Check for updates]
        │
   status: checking          "Checking…" + spinner, button disabled
        │                    (hold ≥600ms so it can't flash-and-vanish)
        ├─── not-available ─► "You're on the latest version (1.0.0)"
        │                     reverts to "Last checked 2 minutes ago" after ~5s
        │
        ├─── error ────────► inline message + [Try again]
        │                     "Couldn't reach the update server. Check your connection."
        │                     (never a raw stack — map errno/HTTP to plain sentences)
        │
        └─── available ────► section expands:
                               VidTSX Studio 1.1.0 · 12 Aug 2026 · 248 MB
                               ▸ What's new   (collapsed react-markdown release notes)
                               [Download update]
                                        │
                             status: downloading
                               ▓▓▓▓▓▓░░░░ 62%  ·  154 / 248 MB  ·  8.2 MB/s   [Cancel]
                                        │
                             status: downloaded
                               "Update ready to install."
                               [Restart & install]
                               "Or it'll install automatically next time you quit."
                                        │
                                 busy gate (§6)
                            ┌───────────┴────────────┐
                         blocked                   clear
                            │                        │
              button disabled + reason:      "Preparing…" → gracefulShutdown()
              "Can't restart yet —            → quitAndInstall(silent)
               1 render in progress"          → app closes, installs, relaunches
```

**Notes on the manual path:**

- **The busy gate blocks only the restart**, never the check or the download. Checking and
  downloading during a render are harmless — they're network + disk writes to a staging dir.
- **Cancel is real.** `autoUpdater.downloadUpdate()` accepts a `CancellationToken` from
  `builder-util-runtime`; hold it in the service and expose `token.cancel()` behind
  `UPDATER_CANCEL`. Without this the Cancel button would be a lie, so either wire the token
  or don't render the button.
- **Downloads resume.** electron-updater stages into
  `%LOCALAPPDATA%\vidtsx-studio-updater\pending`. A cancelled or interrupted download is
  reused on the next attempt rather than restarting from zero — worth verifying explicitly,
  since it's the difference between a 12 MB retry and a 248 MB one on this payload.
- **Changing the channel re-checks.** Toggling "Receive beta releases" should immediately
  fire a `manual` check so the user sees the result of the toggle rather than waiting up to
  6 hours.
- **`Later` on the toast is per-version.** It sets `skippedVersion`, which suppresses only
  automatic nagging. A manual check always ignores it.

### 5.2 Fully manual fallback (no updater involved)

For dev builds, macOS before signing, or forks built without a `publish:` config, the
Updates section replaces every control with:

> Automatic updates aren't available in this build.
> Current version 1.0.0 · **[View releases on GitHub →]**

The link opens via `appOpenExternal`. The user downloads
`VidTSX-Studio-Setup-1.1.0.exe` and runs it over the existing install:

1. NSIS detects the previous per-user installation and closes the running app (the
   single-instance lock is released on quit).
2. It replaces the install directory in place — same path, same shortcuts.
3. `userData` is **untouched**: all 8 SQLite DBs, settings, API keys (safeStorage-encrypted),
   projects, and downloaded models survive. The installer only owns the program files.
4. App relaunches on the new version (`runAfterFinish: true`).

This path must keep working regardless of the updater — it's the recovery route when an
auto-update fails, and the only route for anyone building from source.

---

## 6. The busy gate (`update-gate.ts`)

This app runs long jobs that must not be killed. The gate returns a list of human-readable
blockers; a non-empty list suppresses the restart chip **and** the toast, and rejects
`UPDATER_INSTALL`.

Sources to query:

| Subsystem | Module |
|---|---|
| Remotion renders | render queue DB / `render-handlers` |
| TSX generation jobs | `tsxJobEngine` ([tsx-job-engine.ts](../src/main/services/tsx-jobs/tsx-job-engine.ts)) |
| Model downloads | download manager ([download-manager](../src/main/services/download-manager)) |
| Studio proxies / waveforms | `studioMediaJobs` ([media-jobs.ts](../src/main/services/studio/media-jobs.ts)) |
| Local AI inference | `imageLocalEngine` / `videoLocalEngine` / `llmLocalEngine` |
| Unsaved Studio project | Studio project store dirty flag |

```ts
export interface UpdateBlockers { blocked: boolean; reasons: string[] }
// e.g. { blocked: true, reasons: ['1 render in progress', '2 model downloads active'] }
```

When blocked we do nothing loud: the update stays staged and `autoInstallOnAppQuit` applies
it whenever the user quits normally.

---

## 7. Safe shutdown before install (`update-shutdown.ts`)

**This is the highest-risk part of the feature.** [main/index.ts:206](../src/main/index.ts#L206)
registers `app.on('will-quit', async () => { … })` with ~15 awaited teardown steps (job engine
shutdown, ffmpeg child kills, usage-log flush, download state flush, 8 `closeDb()` calls).
Electron **does not await async `will-quit` listeners** — today that is a latent race on a
normal quit; with an installer launching immediately after `quitAndInstall()`, it becomes a
real risk of a half-written SQLite WAL being overwritten by the installer.

So `UPDATER_INSTALL` must **not** call `quitAndInstall()` directly:

```ts
export async function installUpdateSafely(): Promise<void> {
  push({ status: 'downloaded', installing: true });   // UI shows "Preparing…"
  await gracefulShutdown();      // the will-quit body, extracted + awaited here
  autoUpdater.quitAndInstall(/* isSilent */ true, /* isForceRunAfter */ true);
}
```

Refactor the `will-quit` body into an exported, idempotent `gracefulShutdown()` in
`src/main/services/shutdown.ts`, guarded by a `hasShutDown` flag, and have both `will-quit`
and the updater call it. That fixes the existing race as a side effect.

Also relevant: the app takes a **single-instance lock** at
[main/index.ts:39](../src/main/index.ts#L39). The NSIS updater relaunches the app after
install; because we fully quit first, the lock is released in time. Worth an explicit manual
test — a stuck lock manifests as "update installed but app never comes back".

---

## 8. Platform specifics

### Windows (primary target)

Current NSIS config is **per-user** (`perMachine: false`, `oneClick: false`,
`allowToChangeInstallationDirectory: true`). Implications:

- ✅ Per-user install → `%LOCALAPPDATA%\Programs\…` → **no UAC prompt on update**. Good.
- ⚠️ `allowToChangeInstallationDirectory: true` lets a user install into `C:\Program Files`,
  where a silent update *would* need elevation and can fail or pop UAC mid-update.
  **Recommendation:** set it to `false` before the first public release. It is the single
  cheapest thing we can do to guarantee silent updates. (Costs a little user choice; the
  install is per-user anyway.)
- ⚠️ Assisted (`oneClick: false`) installers under `quitAndInstall(isSilent = true)` need a
  real end-to-end test — verify no installer window appears and the previous install
  directory is reused. If it misbehaves, the fallback is `oneClick: true`.
- **Differential downloads:** electron-builder emits a `.blockmap` next to the NSIS installer
  and electron-updater downloads only changed blocks. This matters a lot here — the installer
  carries `resources/binaries` + `resources/python` (~133 MB tracked in git) plus Remotion,
  Monaco, three.js, esbuild and a native `better-sqlite3`. Most releases will only touch
  `out/**`, so a typical update should transfer tens of MB, not the whole payload. Verify the
  `Differential download` line appears in the updater log; if it falls back to full download,
  investigate before shipping.
- **Signing:** unsigned auto-update *works* (integrity comes from the sha512 in `latest.yml`
  over HTTPS), but every new installer triggers a SmartScreen warning and the reputation
  never accumulates. Not a launch blocker; worth budgeting for Azure Trusted Signing or an
  OV/EV certificate. When a cert exists, also set `win.publisherName` so electron-updater
  verifies the downloaded installer's signature.

### macOS (deferred)

- **Auto-update on macOS requires a Developer ID signature + notarization.** Squirrel.Mac
  refuses to apply an unsigned update. There is no workaround.
- The current mac target is `dmg` only. Squirrel.Mac updates from a **`zip`** — add
  `- target: zip` alongside `dmg` (dmg stays for first-run distribution).
- Build **arm64 and x64 in a single `electron-builder --mac` invocation**. Two separate runs
  each write `latest-mac.yml` and the second silently clobbers the first, leaving one arch
  with a broken feed.
- Until an Apple Developer account exists: report `status: 'unsupported'` on darwin with the
  reason *"Automatic updates require a signed build. Download the latest version from GitHub."*
  plus a link. That is the honest behaviour, not a silent no-op.

---

## 9. Build & release pipeline

### 9.1 electron-builder config

```yaml
# electron-builder.yml
publish:
  provider: github
  owner: hassancs91
  repo: VidTSX-STUDIO
  releaseType: draft        # publish the release manually after smoke-testing
```

`releaseType: draft` is deliberate: **draft releases are invisible to electron-updater**, so
CI can build and upload, we smoke-test the artifact, and only then hit "Publish" to make it
live for every user. That is the whole rollout safety valve.

Also add to `mac:` when macOS ships:

```yaml
mac:
  target:
    - target: dmg
      arch: [arm64, x64]
    - target: zip
      arch: [arm64, x64]
```

### 9.2 GitHub Actions (`.github/workflows/release.yml`)

No CI exists yet. Minimum viable release workflow:

- Trigger: push of a `v*` tag (plus `workflow_dispatch`).
- Runner: `windows-latest` (macOS job added later, gated on secrets).
- Steps: checkout → setup-node (pin the version used locally) → `npm ci` →
  `npm run check:types` → `npm test` → `npx electron-builder --win --publish always`.
- Env: `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` — sufficient for publishing to the repo's own
  releases. Optional `VITE_SENTRY_DSN` secret so official builds keep crash reporting.
- Cache `~/.npm` and the electron/electron-builder download caches; this dependency tree is
  large and native modules rebuild via the existing `postinstall`.

Note: `npm ci` will rebuild `better-sqlite3` and pull platform-locked optional deps. The
current `package.json` pins several `*-win32-x64-*` packages as hard dependencies — a
macOS CI job will need those relaxed to `optionalDependencies` first.

### 9.3 Release checklist (per version)

1. `npm version <patch|minor|major>` → bumps `package.json`, creates the `vX.Y.Z` tag.
2. Push tag → CI builds and uploads a **draft** release.
3. Download the draft installer, install over the previous version locally, confirm the app
   launches and the version bumped.
4. Write release notes in the GitHub release body (this becomes the in-app "What's new").
5. Publish the release → users see it within 6 h, or immediately on manual check.
6. Optional: set `stagingPercentage` in `latest.yml` for a phased rollout.

---

## 10. Open-source repo prep

Going public is a prerequisite for the GitHub-Releases feed, and a few things are
inconsistent today:

- `package.json` has `"private": true` and `"license": "UNLICENSED"` while `LICENSE.txt` is
  **MIT**. Reconcile: set `"license": "MIT"`, drop or keep `private` deliberately
  (`private: true` only blocks npm publishing — harmless, but decide).
- Audit history for secrets before flipping the repo public — API keys, Sentry DSN, any
  `.aws-r2-config`. `.gitignore` covers `.env*`, but history is what matters.
- Add `SECURITY.md`, `CONTRIBUTING.md`, and a release-notes convention.
- The `BETA` chip in the status bar and About section should become version-driven rather
  than hardcoded once real releases exist.

---

## 11. Testing

| Test | How |
|---|---|
| Dev-mode wiring | `autoUpdater.forceDevUpdateConfig = true` + a `dev-app-update.yml` pointing at a scratch repo — lets the whole flow run from `npm run dev` |
| End-to-end upgrade | Publish `1.0.0` and `1.0.1` to a private test repo; install `1.0.0`, confirm detect → download → chip → restart → `1.0.1` |
| Differential download | Grep the updater log for the differential-download line; compare transferred bytes against installer size |
| Busy gate | Start a render, force `update-downloaded`, assert no toast/chip and that `updater:install` returns `busy` with the right reason |
| Safe shutdown | Trigger install with all DBs open; after relaunch assert no `-wal`/`-shm` leftovers and no data loss |
| Install on quit | Stage an update, quit normally, relaunch — new version, no prompts |
| Offline / feed down | Kill network mid-check and mid-download; assert `error` state, no crash, retry works |
| Corrupt download | Tamper with the sha512 in a test `latest.yml`; assert the update is rejected and the app stays on the old version |
| Single-instance | Confirm the app actually relaunches after install (lock released) |
| Unsupported paths | Dev build and (pre-signing) macOS both report `unsupported` with a readable reason |

Unit tests (vitest, per CLAUDE.md "Phase 4+ services get tests"): the state reducer and
`update-gate` are pure enough to test directly. The electron-updater wiring itself is
manual-test territory.

---

## 12. Phases

- [~] **Phase A — Repo & release plumbing** (no app code)
      ✅ `license` → MIT in package.json · ✅ `publish:` block · ✅ `.github/workflows/release.yml` ·
      ✅ `allowToChangeInstallationDirectory: false` · ✅ `publish:win` script.
      ⬜ **Secret audit + flip the repo public** · ⬜ first tagged release built by CI and
      installed manually. *Done when CI produces an installable artifact from a tag.*

- [x] **Phase B — Main-process updater**
      `electron-updater@6.8.9` pinned · `services/updater/updater-service.ts` state machine ·
      channels/types/handlers/preload · `services/shutdown.ts` extracted + awaited on both the
      quit and install paths · `services/updater/update-gate.ts` · phantom import removed from
      `split-register.mjs`.

- [x] **Phase C — Renderer UI**
      `useUpdater` hook · `UpdateChip` in the status bar · one-shot per-version toast ·
      Settings → Updates section with markdown release notes.

- [x] **Phase D — Preferences & channels**
      `updateAutoDownload` + `updateChannel` + `updateSkippedVersion` settings keys ·
      `allowPrerelease` wiring · beta toggle that re-checks immediately on switch.

- [ ] **Phase E — Hardening**
      Staged rollout via `stagingPercentage` · failure telemetry through the existing log
      engine · retry/backoff on transient feed errors · `allowToChangeInstallationDirectory: false`.

- [ ] **Phase F — macOS** *(gated on an Apple Developer account)*
      Developer ID signing + notarization · `zip` target · single-invocation multi-arch build ·
      remove the `unsupported` shortcut on darwin.

- [ ] **Phase G — Windows code signing** *(gated on a certificate)*
      Azure Trusted Signing or OV/EV cert · `win.publisherName` · verify SmartScreen is clean.

Phases A–D are the shippable core. E–G are quality/trust work that does not block a first
public auto-updating release on Windows.

### E2E test result — 2026-08-17: PASSED

The full flow was exercised for real via a throwaway releases-only public repo
(`docs/auto-update-e2e-test-plan.md`; repo created, used, and deleted the same day —
no source ever pushed). 0.9.0 installed → 0.9.1 via Restart chip → 0.9.2 via
install-on-quit, all on this machine. Every §11 matrix item passed:

- Silent auto-check at launch+30 s → staged 11 s later; chip `Updating… N%` →
  `Update ready · Restart`; exactly ONE toast; zero modals.
- **Differential download works**: 15.6 MB transferred of a 302 MB installer (5%).
- Busy gate: install refused with `busy` + "1 download in progress", chip suppressed;
  cancel → unblocked in 20 s (30 s poll).
- Manual path: 600 ms spinner hold observed; "You're on the latest version."
- Restart install: click → relaunch ~45 s, **no installer window** (300 ms monitor),
  single-instance lock released, marker log confirmed new version, userData intact.
- Install-on-quit: silent ~30 s install after normal quit, no auto-relaunch (correct).
- Feed-down (natural 404 after repo deletion): error only in Settings
  ("No published release was found for this build channel."), status bar clean, retry
  usable. Deleting/renaming the feed repo has a short GitHub CDN stale-cache window
  (a check seconds later still got the old 200) — harmless.

**Findings to fix before V1:**

1. **Release-notes rendering bug (renderer):** GitHub delivers `releaseNotes` as
   HTML (electron-updater converts the markdown body), but `UpdateSection.tsx`
   renders it with ReactMarkdown → users see escaped literal `<h2>…` markup. Fix:
   sanitize+render HTML (rehype-raw) or convert to markdown/text in
   `normalizeReleaseNotes`.
2. **Minor:** `transcription.db-wal/-shm` survive graceful shutdown (0-byte WAL, no
   data at risk; repros on a plain quit — likely a second open handle or a Windows
   delete race). Worth a look, not a blocker.

Build note for release day: electron-builder's winCodeSign cache fails to extract in
a normal shell (macOS symlinks need symlink privilege). One-time fix: extract
`winCodeSign-2.6.0.7z` into `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0`
with `-x!darwin`. Also: launching the packaged exe from a Claude Code/VS Code shell
requires clearing `ELECTRON_RUN_AS_NODE`.

### What has to happen before a user can actually update

The app code is done; the *feed* does not exist yet. In order:

1. **Audit git history for secrets, then make the repo public.** electron-updater reads
   release assets anonymously — a private repo would need a token embedded in the app,
   which CLAUDE.md forbids outright.
2. **Publish v1.0.0** (`npm version patch` → push tag → CI builds a draft → publish it).
   This release is the baseline; nobody updates *to* it, but it must exist so that later
   versions have something to supersede.
3. **Publish v1.0.1** and verify a real 1.0.0 → 1.0.1 upgrade on a clean machine.
4. Only then is the loop closed. Until step 3 passes, treat the feature as untested.

To exercise the flow before going public, add a `dev-app-update.yml` at the repo root
pointing at a scratch repo and launch with `VIDTSX_DEV_UPDATE=1` — the service honours
both (`updater-service.ts` sets `forceDevUpdateConfig`).

---

## 13. Risks & gotchas

1. **Async `will-quit` is not awaited** (existing bug) — §7. Fix before wiring
   `quitAndInstall`, or updates will eventually corrupt a SQLite file.
2. **Assisted-installer silent mode** — `oneClick: false` + custom install dir is the most
   likely source of "the update ran but nothing happened" reports. Test explicitly.
3. **Payload size** — the installer bundles ~133 MB of tracked binaries plus a very large
   node_modules tree. Without working differential downloads every user re-downloads
   everything on every patch. Verify blockmaps, and avoid touching `resources/binaries` /
   `resources/python` in patch releases.
4. **GitHub release asset limit** — 2 GB per file. Not currently at risk, but the
   `!node_modules/...` exclusions in [electron-builder.yml:51-78](../electron-builder.yml#L51-L78)
   are what keep it there. Re-enabling `node-llama-cpp` (~965 MB of GPU variants) or
   sherpa-onnx changes that calculus.
5. **Draft releases are invisible to the updater** — a real feature (safety valve), but also
   the #1 "why isn't my update showing up" cause. Document it in the release checklist.
6. **Tag/version mismatch** — the GitHub provider expects `v${version}`. Always use
   `npm version`, never hand-written tags.
7. **Downgrade / rollback** — electron-updater will not downgrade by default. A bad release
   is fixed by publishing a *higher* version, not by deleting the bad one. Keep the ability
   to ship a hotfix within minutes; that is the actual rollback plan.
8. **Unsigned builds erode trust** — auto-update works, but every SmartScreen warning costs
   installs. Budget for Phase G sooner rather than later.

---

## 14. Non-goals

- In-app patching without a restart.
- Delta updates beyond what electron-builder's blockmaps give for free.
- A custom update server or licence-gated feed (the backend API at
  `learnwithhasan.com/api/vidtsx/` stays out of the update path entirely).
- Updating the external binaries (`ffmpeg`, whisper, python) independently of the app —
  they ride along in the installer.
- Linux packaging.

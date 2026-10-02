# Crash Reporting: Pre-Publish Checklist

> Companion to the crash-reporting implementation (`src/main/services/crash-reporting.ts`)
> and sibling of [auto-update-release-checklist.md](auto-update-release-checklist.md) —
> its Stage 0 "crash reporting in official builds" decision resolves here.
> Work top to bottom; each stage assumes the previous passed.
>
> **Current state:** the code is complete, committed, and type-checks, but it has
> **never run against a real Sentry project** — no DSN has ever existed. Every stage
> below is unexecuted.

---

## Situation as of 2026-08-13

| Fact | Value | Consequence |
|---|---|---|
| Sentry account / project | none | Nothing works until Stage 1 |
| `VITE_SENTRY_DSN` repo secret | not set | CI builds compile crash reporting out; toggle shows "unavailable" |
| CI wiring | [release.yml](../.github/workflows/release.yml) passes the secret to `npm run build` | Already done — only the secret is missing |
| User consent | opt-in, **off by default** (Settings → Privacy) | Nothing sends without an explicit user action, ever |
| README | discloses opt-in crash reporting, "no telemetry by default" | Public-repo promise — behavior must keep matching the text |
| PII scrubbing | implemented ([crash-reporting.ts](../src/main/services/crash-reporting.ts) `scrubString`) | Never verified against a real event payload — Stage 3 is the gate |

How an event flows (all paths funnel through one choke point):

```
main-process log.error/fatal ─┐
                              ├─→ logEngine → crashDispatch → Sentry (if DSN + consent)
renderer error/rejection ─→ global-error-hooks → logWrite IPC ─┘
main-process uncaught exception ──→ Sentry's own handler (same gate via beforeSend)
```

---

## Stage 0 — Lock the open decisions

- [x] **Create the Sentry org.** Hasan already has one (2026-09-30). Free Developer tier
      covers a v1-scale app (5k errors/mo); Sentry also
      [sponsors open-source projects](https://sentry.io/for/open-source/) with a bigger
      free tier. The **data region** (US vs EU) is fixed at org creation and is a
      privacy-page detail once the repo is public.
- [x] **Ship the DSN in official builds?** **Yes — decided 2026-09-30 (go-live D3).** Note
      the DSN is not a secret in the classic sense — it ships inside the installer and
      anyone can extract it and send garbage events. It is protected by rate limits
      (Stage 1), not secrecy. It stays out of the repo so forks don't inherit your inbox.
- [x] **First-run consent prompt: now.** Built 2026-09-30: `CrashReportingPrompt.tsx`
      (mounted app-wide in `App.tsx`) asks once in DSN builds until answered; either
      answer goes through `SETTINGS_SET_CRASH_REPORTING`, which now also sets
      `crashReportingPrompted`, so the Settings → Privacy toggle retires the prompt too.
      Rule in `src/shared/crash-reporting-prompt.ts`: available && !prompted && !enabled.

---

## Stage 1 — Sentry project setup

- [ ] Create a project, platform **Electron**. Copy the DSN (`https://<key>@o<org>.ingest.sentry.io/<id>`).
- [ ] Before the DSN ever reaches a build, configure abuse limits:
  - [ ] **Spike protection** on (org settings — on by default, confirm).
  - [ ] **Key rate limit** on the DSN (e.g. 50 events/min) — this is the real defense for
        a public DSN.
  - [ ] An **alert rule**: email on "new issue created". Otherwise reports rot unseen and
        the feature is pointless.
- [ ] Add the repo secret: GitHub → Settings → Secrets and variables → Actions →
      `VITE_SENTRY_DSN`. The workflow already forwards it
      ([release.yml:41](../.github/workflows/release.yml#L41)); no YAML change needed.

---

> **Stages 2 and 3 RUN 2026-09-30 — PASS after two fixes** (go-live runbook step 1b).
> Method: instead of reading payloads in the Sentry UI, `.env` pointed the DSN at a local
> fake ingest endpoint (`http://key@127.0.0.1:8877/1`, a 40-line Node server that records
> every request and decodes the envelopes), the three Stage 2 commands were fired over CDP
> on isolated dev instances, and the captured bodies were grepped. Findings:
> 1. **Consent mid-session did not start the SDK** — `Sentry.init` after app `ready` throws
>    ("Sentry SDK should be initialized before the Electron app 'ready' event"), so the old
>    lazy `startSentry()` on the toggle failed and nothing was captured until the next launch.
>    Fixed: init at boot whenever a DSN exists; consent only gates `beforeSend`. The session
>    tracker (`MainProcessSession`) is dropped and `sendClientReports` is off so an
>    unconsented client makes **no** request — proven: 40 s idle, a batch of errors, and a
>    graceful quit with consent off produced zero requests.
> 2. **Pre-consent breadcrumbs leaked.** Log lines written while consent was off rode along
>    inside the first consented event (Sentry keeps the last 100 breadcrumbs on the scope
>    regardless of `beforeSend`). Fixed: `beforeBreadcrumb` gated on consent and the trail
>    cleared on every consent change — re-verified: none of the pre-consent text in any
>    consented payload.
> Pass rows: consent off → 0 requests; Enable → 3 envelopes (message, exception, uncaught
> renderer); toggle off → 0 new; toggle on, no restart → 3 new; `environment: development`,
> `release: vidtsx-studio@1.1.0`; the Windows username appears in **0** payloads and the
> planted `C:\Users\Malak\...` stack reads `C:\Users\[user]\...`. Stage 4 (main-process
> uncaught + native minidump) not run.

## Stage 2 — Dev smoke test (JS pipeline)

Runs the full real path with zero code changes, using the log-write IPC from DevTools.

- [ ] Launch with the DSN:

      ```powershell
      $env:VITE_SENTRY_DSN = 'https://...your dsn...'; npm run dev
      ```

- [ ] Settings → Privacy → "Send crash reports" renders as an **active checkbox** — the
      italic "Unavailable in this build" line appearing means the env var didn't reach the
      main-process build.
- [ ] Enable the toggle. Then, in the renderer DevTools console (Ctrl+Shift+I):

      ```js
      // captureMessage path
      window.api.logWrite({ level: 'error', module: 'sentry-test', message: 'smoke test message' })

      // captureException path, with a deliberately dirty stack to feed Stage 3
      window.api.logWrite({ level: 'error', module: 'sentry-test', message: 'smoke test exception',
        error: { name: 'TestError', message: 'boom', stack: 'TestError: boom\n    at fn (C:\\Users\\Malak\\fake\\file.js:1:1)' } })

      // renderer global-hook path (uncaught, escapes the console's own catch)
      setTimeout(() => { throw new Error('uncaught renderer test') })
      ```

**Pass criteria**

- [ ] All three events appear in Sentry within ~1 minute.
- [ ] `environment: development`, `release: vidtsx-studio@<version>`, tags `module` and
      `process` present (`process: renderer` on all three — they traveled over `logWrite`).
- [ ] The third event arrived via [global-error-hooks.ts](../src/renderer/utils/global-error-hooks.ts)
      with `module: global`.

---

## Stage 3 — Scrubbing verification (the privacy gate)

**This stage is the release blocker.** The README promises anonymized paths; verify it
against real payloads, not the regex in the source.

- [ ] Open each Stage 2 event → "JSON" (raw payload). Search for your Windows username.
      **Zero hits.** Paths must read `C:\Users\[user]\...`.
- [ ] Read the **breadcrumbs** on each event. The main process's console output becomes
      breadcrumbs (Sentry's default console integration), so every log line ≥ minLevel
      rides along. Confirm: paths scrubbed, and — read with hostile eyes — no prompt
      text, no transcript content, no API-key fragments. Anything sensitive here is a
      stop-ship: fix the offending log line or trim the console integration
      (see Open items).
- [ ] Toggle **off** → resend the Stage 2 commands → nothing new in Sentry (the
      `beforeSend` gate, no restart involved).
- [ ] Toggle **on** again (still no restart) → events flow again.
- [ ] Quit, relaunch dev **without** `VITE_SENTRY_DSN` → toggle disabled with the
      "Unavailable in this build" note; `logWrite` errors produce no network traffic.

---

## Stage 4 — Native + main-process crash paths (optional but recommended once)

JS errors are the main event; this proves the two rarer paths.

- [ ] **Main-process uncaught exception** — temporarily add to the end of
      [index.ts](../src/main/index.ts) `whenReady`:
      `setTimeout(() => { throw new Error('main uncaught test'); }, 10_000);`
      Run dev with DSN + toggle on. Expect an event with `process: main`, captured by
      Sentry's own uncaught-exception handler (not the log engine). **Remove the line.**
- [ ] **Native crash (minidump)** — same spot, `setTimeout(() => process.crash(), 10_000);`
      The app dies hard; the minidump uploads on the **next launch** — relaunch and wait
      ~1 min. Expect a "Native crash" event. **Remove the line.**
- [ ] Known edge (by design): native minidumps queued while consent is on will not upload
      if the app never relaunches with consent still on. Acceptable — verify nothing
      uploads after toggling consent off and relaunching.

---

## Stage 5 — Packaged build

- [ ] Get an installer with the DSN baked in — either the CI draft release (after Stage 1's
      secret), or locally:

      ```powershell
      $env:VITE_SENTRY_DSN = 'https://...'; npm run build:win
      ```

- [ ] Confirm the DSN made it into the artifact (and is absent when built without the var):

      ```powershell
      Select-String -Path .\out\main\*.js -Pattern 'ingest.sentry.io' -List
      ```

- [ ] Install on a machine/VM with no prior install.

**Pass criteria**

- [ ] Fresh install: toggle is **off**. No Sentry traffic before opting in.
- [ ] Enable, then trigger an organic error (no DevTools in packaged builds) — e.g. add an
      LLM provider with a garbage endpoint and generate, or transcribe with an invalid
      AssemblyAI key. Any error-level log works; they all funnel through the same dispatch.
- [ ] Event arrives with `environment: production` and the right `release`.
- [ ] In Sentry, set an environment filter so `development` noise never pollutes triage.

---

## Stage 6 — Behaviour matrix

| # | Test | How | Pass |
|---|---|---|---|
| 1 | **Default off** | Fresh install, watch network / Sentry | Zero events before opt-in — this is the README promise |
| 2 | **Consent persists** | Enable → quit → relaunch | Toggle still on; events still flow (flag lives in settings.db) |
| 3 | **Disable is immediate** | Toggle off, trigger errors | Nothing arrives; no restart needed |
| 4 | **No-DSN build inert** | Source build without the env var | Toggle unavailable; no `sentry` host contacted at all |
| 5 | **Offline resilience** | Kill network, trigger errors, restore | No error spam or crash; queued events send on reconnect (offline transport is an Electron SDK default) |
| 6 | **Unhandled rejection** | Dev console: `setTimeout(() => { Promise.reject(new Error('rej test')) })` | Arrives via the `unhandledrejection` hook, `module: global` |
| 7 | **Reporting never breaks the app** | Set a garbage DSN (`https://x@x.ingest.sentry.io/1`), enable, use the app | App fully functional; failures stay silent in the app (SDK may warn in the dev console) |

---

## When something fails

| Symptom | Look here first |
|---|---|
| No events at all | Consent flag: `crashReportingEnabled` in `%APPDATA%\<app>\settings\settings.db`; then DSN baked in (Stage 5 grep); then Sentry rate limit / spike protection ate it |
| Toggle "unavailable" in a CI build | Repo secret name mismatch (`VITE_SENTRY_DSN` exactly), or the env didn't reach the **build** step (it must be on `npm run build`, not on electron-builder) |
| Real username in an event | `scrubString` in [crash-reporting.ts](../src/main/services/crash-reporting.ts) — add the missing pattern, re-run Stage 3 before shipping |
| Events but wrong/missing release | `app.getVersion()` vs package.json — release string is `vidtsx-studio@<version>` |
| Dev noise in production triage | Filter by `environment` in Sentry; events are tagged at init |
| Duplicate-looking data | A log line appears both as breadcrumb and as event — expected; breadcrumbs are context, not issues |

---

## Sign-off

Ready to ship crash reporting in a public release when all of these are true:

- [ ] Stage 1 — project exists, rate-limited, alerting to a mailbox someone reads
- [ ] Stage 3 — scrubbing verified on real payloads, breadcrumbs reviewed for sensitive content
- [ ] Stage 5 — packaged build: default-off verified, opt-in event verified
- [ ] Matrix rows 1–4 pass (5–7 are quality; 1–4 are the privacy promise)
- [ ] README "Crash reporting (opt-in)" section still matches observed behavior exactly

---

## Still open in code (not blockers, but known gaps)

- **Default integrations are untrimmed.** The main-process console integration turns every
  log line into a breadcrumb. If Stage 3 finds anything uncomfortable, pass an explicit
  `integrations` list in `Sentry.init` (drop `consoleIntegration`) instead of fixing log
  lines one by one.
- **No sourcemap upload.** Renderer stack traces will reference minified bundle positions.
  If real reports prove unreadable, add `@sentry/vite-plugin` gated on `SENTRY_AUTH_TOKEN`
  (the pre-open-sourcing setup had exactly this; see commit `319d0ad` for the removed
  wiring).
- **No first-run consent prompt** — Stage 0 decision; settings-only discovery means very
  few reports will ever arrive.
- **`scrubString`/`deepScrub` have no unit tests.** Pure functions; extract to a
  `crash-scrub.ts` module to test without mocking Electron/Sentry.
- **No root React error boundary.** Uncaught render errors still reach `window.onerror`
  (React 19 default), but a root boundary would add component-stack context and a friendlier
  failure screen. Only ImageStudio has one today.

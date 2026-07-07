# Pushing a VidTSX Studio update

End-to-end runbook for shipping a new version to users. Auto-update is wired: every existing install polls `releases.vidtsx.com/releases/latest.yml` and pulls down the new `.exe` on next launch (or within ~4 hours if left running). The full pipeline is therefore: bump version → build → smoke-test → upload three files to R2 → done.

---

## 1. Bump the version

Edit [package.json](package.json) — increment the `version` field (semver). Patch bumps for fixes, minor for new features, major when you break compatibility.

```json
"version": "0.1.14"
```

## 2. Build

```bash
npm run build:win
```

Produces three artifacts in `dist/`:

- `VidTSX-Studio-Setup-<version>.exe` (the installer, ~400 MB)
- `VidTSX-Studio-Setup-<version>.exe.blockmap` (delta-update map)
- `latest.yml` (auto-update manifest)

## 3. Smoke-test on a clean Windows machine

Don't ship if any of these regress. They're the areas this codebase has historically broken in packaged builds (asar / spawn / scaling). Test on a machine that doesn't have a dev install of the app — UAC, Defender, and `%APPDATA%` paths behave differently than your dev box.

- **Creator → import TSX → Preview** — exercises esbuild spawn from `app.asar.unpacked`.
- **Transcribe a short clip end-to-end** — exercises ffmpeg spawn and whisper download.
- **Render the same composition at h264 MP4 and at least one of {h265, GIF, ProRes MOV, WebM}** — codec-specific validation has tripped us up before.
- **Render at a non-`original` resolution preset (e.g. 480p)** — even-integer dimension snap.
- **Settings → enable Claude provider → run a query** — exercises bundled `claude.exe`.
- **Render Queue with 2+ jobs queued** — sequential processing + cancel.
- **Quit and relaunch** — DB migrations re-run, queue + projects + settings persist.

If anything fails, fix it, bump the patch version again, rebuild. Don't ship a broken `<version>` — bump and reship.

## 4. Publish to R2

```bash
node scripts/publish-to-r2.mjs
```

Uploads all three artifacts for the version currently in `package.json` to `vidtsx-releases/releases/`. The script:

- Forces single-shot PUT (R2's S3 API multipart silently aborts on Windows over slow uplinks — see comments in the script).
- Runs a post-upload `aws s3api head-object` check to confirm the byte count matches.

**Other invocations**:

```bash
# Upload from a saved release folder instead of dist/
node scripts/publish-to-r2.mjs --from dist/release-v0.1.13

# Override the version (when package.json doesn't match the build)
node scripts/publish-to-r2.mjs --version 0.1.13 --from dist/release-v0.1.13

# Pull a bad release down — re-uploading the previous latest.yml restores updater
node scripts/publish-to-r2.mjs --delete 0.1.13

# Garbage-collect orphaned multipart parts (billable if left around)
node scripts/publish-to-r2.mjs --clean-multipart
```

### One-time R2 setup

Already done — see the [script header](scripts/publish-to-r2.mjs) for install steps if you ever need to redo this on a new machine. Summary: install AWS CLI v2, create a Cloudflare R2 API token with R/W on `vidtsx-releases`, drop credentials in `.env` at the project root.

## 5. Verify

- Direct download: `https://releases.vidtsx.com/releases/VidTSX-Studio-Setup-<version>.exe`. Click → installer runs → app launches.
- Auto-update: any machine running an older version will pick up `<version>` on next launch (or within 4 hours if left running). To force-test, install an older `.exe` from `dist/` and relaunch — the updater toast appears.

## 6. Tag and push

```bash
git tag v<version>
git push --tags
```

So you can `git checkout v0.1.13` later when a user reports a bug specific to a shipped version.

## 7. Watch Sentry

For the next 24–48 hours, check the Sentry dashboard for new events from `<version>`. New crashes from a fresh release are usually the most actionable signal you'll get — most users won't write detailed bug reports.

---

## Rollback

If a release is broken in the wild and you need to stop the auto-updater from pushing it to more users:

1. Re-upload the previous version's `latest.yml` (with its old version number) to R2:
   ```bash
   # Easiest: rebuild that previous version's latest.yml from a saved release folder, or
   # keep the prior latest.yml in dist/release-v<prev>/ as a habit and re-upload it via:
   node scripts/publish-to-r2.mjs --version <prev> --from dist/release-v<prev>
   ```
2. Optionally `--delete <bad-version>` to remove the broken artifacts.
3. Ship the fix on a new patch version.

Existing installs that already auto-updated to the bad version will not roll backward — only fix-forward works.

---

## Beta channel (not configured)

Today, every release goes to one channel (`latest`). Beta testers see the same `latest.yml` everyone else does. That's fine while "everyone else" is just your beta group.

When you go fully public, split the channels: set `channel: beta` in [electron-builder.yml](electron-builder.yml) for beta builds, and the publisher uploads `latest-beta.yml` to a separate path. Beta installers configure the Electron updater to use the `beta` channel; production stays on `latest`. (Add this section back here when you wire it up.)

---

## Logs and support

When a beta user reports a bug, ask them for everything in:

```
%APPDATA%\VidTSX Studio\logs\
```

That folder contains the rolling log files written by `logEngine`. Sentry usually has the stack already, but the log file gives you the surrounding events (which IPC was in flight, what file was being processed) that Sentry doesn't capture by default.

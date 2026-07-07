# Auto-Update End-to-End Setup (R2 + Pre-Publish Verification)

## Context

The app ships tomorrow as **v0.1.0**. The auto-updater code is already fully implemented — [auto-updater.ts](../src/updater/auto-updater.ts), IPC channels, preload API, and the Settings UI "Check for Updates" button all exist. What's missing is the **hosting infrastructure** and **end-to-end verification**.

The goal: wire Cloudflare R2 to `https://releases.vidtsx.com/releases`, publish v0.1.0 artifacts, and prove the update path works by installing v0.1.0 locally and watching it pull v0.1.1 from R2 before going public. Once verified, R2 is reverted to v0.1.0 as "latest" and the installer is published.

**Why this matters:** if the feed URL, bucket permissions, or `latest.yml` format is wrong, users stuck on v0.1.0 will never get v0.1.1 — and there is no way to push a fix to them. We must validate the full loop before shipping.

### What's already in place (no code changes needed)

- `electron-updater@6.3.9` installed ([package.json:81](../package.json#L81))
- Feed URL configured: `https://releases.vidtsx.com/releases` ([electron-builder.yml:18-21](../electron-builder.yml#L18-L21), [src/updater/config.ts:2-3](../src/updater/config.ts#L2-L3))
- `verifyUpdateCodeSignature: false` for unsigned v0.1 builds ([electron-builder.yml:82](../electron-builder.yml#L82))
- Main-process updater: [src/updater/auto-updater.ts](../src/updater/auto-updater.ts) — generic provider, `autoDownload: false`, 10s startup check, 4h interval
- IPC + preload: `UPDATER_CHECK/DOWNLOAD/INSTALL/GET_CURRENT_VERSION` wired through `window.api`
- UI: Settings → About section has version display, "Check for Updates" button, and a "Restart Now" banner ([src/renderer/components/SettingsScreen.tsx](../src/renderer/components/SettingsScreen.tsx))

---

## Part 1 — Cloudflare R2 Setup (one-time)

### 1.1 Create the bucket

1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket**.
2. Name: `vidtsx-releases` (lowercase, stable — never rename).
3. Location: **Automatic**.
4. Default storage class: **Standard**.
5. Click **Create bucket**.

### 1.2 Connect the custom domain `releases.vidtsx.com`

This is what makes the bucket publicly reachable over HTTPS.

1. Open the bucket → **Settings** tab → **Custom Domains** → **Connect Domain**.
2. Enter `releases.vidtsx.com` and confirm.
3. **If `vidtsx.com` is already on Cloudflare DNS:** Cloudflare adds the CNAME automatically. Wait ~1 min for SSL provisioning.
4. **If `vidtsx.com` is on another DNS provider:** Cloudflare shows a CNAME value (e.g. `public.r2.dev/<bucket-id>`). Add it as a CNAME record on `releases` at your DNS host. Wait up to 15 min for SSL.
5. Verify with `curl -I https://releases.vidtsx.com/` — expect `200`, `403`, or `404`. A `403` is normal and means the bucket is reachable but object listing is disabled (this is the default). What you're checking here is that the response comes from Cloudflare (look for `Server: cloudflare` and a `CF-RAY` header) — NOT a DNS error, NOT a TLS/cert error. The real `200` test happens in Part 3.3 once an object is uploaded.

**Do NOT enable "Allow Public Access" via the `r2.dev` toggle** — custom domain is the public path; the r2.dev URL should stay off to avoid a second uncached endpoint.

### 1.3 Note on the `releases/` prefix (nothing to do here)

The updater fetches `https://releases.vidtsx.com/releases/latest.yml`, so all uploads must use object keys that start with `releases/` (e.g. `releases/latest.yml`). R2 has no real folders — the `releases/` "folder" appears automatically the first time you upload a file with that prefix. **No action needed in this step**; just remember the prefix when you upload in Part 3.3.

---

## Part 2 — Build v0.1.0 (shipping version)

1. Confirm [package.json:3](../package.json#L3) shows `"version": "0.1.0"`.
2. Build: `npm run build:win`
3. After build, inspect `dist/`. You should see:
   - `latest.yml`
   - `VidTSX-Studio-Setup-0.1.0.exe`
   - `VidTSX-Studio-Setup-0.1.0.exe.blockmap`
4. Open `dist/latest.yml` and confirm:
   - `version: 0.1.0`
   - `path: VidTSX-Studio-Setup-0.1.0.exe`
   - `sha512: <hash>` present
5. Copy these three files somewhere safe (e.g. `dist/release-v0.1.0/`) — this is the **shipping set** you upload at the end.

---

## Part 3 — End-to-End Update Test (v0.1.0 → v0.1.1)

### 3.1 Install v0.1.0 locally

1. Run `dist/VidTSX-Studio-Setup-0.1.0.exe` and install normally.
2. Launch the app. Open **Settings → About**. Confirm it shows `v0.1.0`.
3. Leave it installed — this is the "old" client that must find the update.

### 3.2 Build v0.1.1 test artifacts

1. Edit [package.json:3](../package.json#L3): `"version": "0.1.1"`.
2. Build: `npm run build:win`
3. Confirm `dist/` now has:
   - `latest.yml` (with `version: 0.1.1`)
   - `VidTSX-Studio-Setup-0.1.1.exe`
   - `VidTSX-Studio-Setup-0.1.1.exe.blockmap`
4. Copy these three files to a separate folder (e.g. `dist/release-v0.1.1-test/`).

### 3.3 Upload v0.1.1 to R2

The `.exe` installer exceeds R2's 300 MiB single-shot PutObject cap (this limit applies to the dashboard AND to `wrangler r2 object put`). The [scripts/publish-to-r2.mjs](../scripts/publish-to-r2.mjs) script uploads via **AWS CLI** against R2's S3-compatible endpoint, which does automatic multipart upload with no size limit.

**One-time setup (first run only):**

1. **Install AWS CLI v2** (once per machine):
   ```
   winget install Amazon.AWSCLI
   ```
   or download the MSI from `https://awscli.amazonaws.com/AWSCLIV2.msi`. Verify:
   ```
   aws --version
   ```

2. **Create an R2 API token** (Cloudflare dashboard):
   - R2 → **Manage R2 API Tokens** → **Create API Token**
   - Permissions: **Object Read & Write**
   - Specify bucket: `vidtsx-releases` (or "Apply to all buckets")
   - TTL: no expiry (or long)
   - Click **Create**. **Copy the Access Key ID and Secret Access Key immediately** — the secret is only shown once.
   - Also note your **Cloudflare Account ID** (top-right of the R2 overview page — 32-char hex).

3. **Add credentials to `.env`** in the project root (gitignored — see [.gitignore:26](../.gitignore#L26)):
   ```
   R2_ACCOUNT_ID=<your-cloudflare-account-id>
   R2_ACCESS_KEY_ID=<access-key-id>
   R2_SECRET_ACCESS_KEY=<secret-access-key>
   ```
   The script auto-loads `.env`. Shell env vars (if set) take precedence, which is handy in CI.

**Upload v0.1.1:**

With `package.json` still at `0.1.1` and `dist/` containing the v0.1.1 build artifacts, run:

```
node scripts/publish-to-r2.mjs
```

The script reads the version from `package.json` and uploads these three keys to `vidtsx-releases`:
- `releases/latest.yml`
- `releases/VidTSX-Studio-Setup-0.1.1.exe`
- `releases/VidTSX-Studio-Setup-0.1.1.exe.blockmap`

**Verify uploads are reachable:**

- `curl -I https://releases.vidtsx.com/releases/latest.yml` → `200`
- `curl https://releases.vidtsx.com/releases/latest.yml` → should print YAML with `version: 0.1.1`
- `curl -I https://releases.vidtsx.com/releases/VidTSX-Studio-Setup-0.1.1.exe` → `200` with correct `Content-Length`

If `latest.yml` returns `404`, check the Cloudflare R2 dashboard and confirm object keys literally start with `releases/` — not the bucket root.

### 3.4 Verify the installed v0.1.0 client updates

1. Launch the installed v0.1.0 app (if not already running, or quit and relaunch — the scheduler fires 10s after startup).
2. **Option A — automatic:** wait ~15 seconds; the "update available" UI should appear.
3. **Option B — manual:** Settings → About → click **Check for Updates**.
4. Expected sequence:
   - Phase: `checking` → `available` (new version `0.1.1` shown)
   - Click the download button → phase `downloading` with progress bar advancing
   - Phase: `ready` with "Restart Now" button
   - Click **Restart Now** → app quits, installer runs silently, app relaunches as **v0.1.1**
5. Reopen Settings → About. Confirm `v0.1.1`.
6. Also sanity-check: click **Check for Updates** again → should show "You're on the latest version" (since `latest.yml` is also 0.1.1).

### 3.5 Check logs if anything fails

- Main process logs: check the log file location used by `logEngine` (scope = `Updater`).
- Common failure signatures:
  - `ENOTFOUND releases.vidtsx.com` → DNS not propagated; wait or fix CNAME.
  - `HTTP 403/404 on latest.yml` → wrong path in bucket or domain not mapped.
  - `sha512 mismatch` → the `.exe` and `latest.yml` you uploaded aren't from the same build. Re-upload from the same `dist/` snapshot.
  - `update-not-available` but you expect one → installed version ≥ `latest.yml` version. Double-check installed version.
  - On Windows, if download succeeds but install doesn't trigger, verify [electron-builder.yml:82](../electron-builder.yml#L82) still has `verifyUpdateCodeSignature: false`.

---

## Part 4 — Publish v0.1.0 (go-live)

Once Part 3 succeeds:

### 4.1 Revert package.json

1. Edit [package.json:3](../package.json#L3) back to `"version": "0.1.0"`. **Do not commit `0.1.1`** — that was a throwaway test bump.
2. Verify with `git diff package.json` that only the version reverts.

### 4.2 Replace R2 contents with v0.1.0 as latest

1. Delete the v0.1.1 test artifacts:
   ```
   node scripts/publish-to-r2.mjs --delete 0.1.1
   ```
2. With `package.json` reverted to `0.1.0` (from 4.1) and the v0.1.0 build artifacts back in `dist/` (restore from `dist/release-v0.1.0/` if needed), upload:
   ```
   node scripts/publish-to-r2.mjs
   ```
3. Verify `curl https://releases.vidtsx.com/releases/latest.yml` shows `version: 0.1.0`.

### 4.3 Sanity check the installed test app

The test machine still has v0.1.1 installed (from Part 3). Launch it, click **Check for Updates** — should say "You're on the latest version" (because 0.1.0 < 0.1.1, updater will not downgrade). This is expected behavior and confirms the feed is quiet.

Uninstall the v0.1.1 build from the test machine to clean up.

### 4.4 Distribute the v0.1.0 installer

Hand out `VidTSX-Studio-Setup-0.1.0.exe` however you're distributing (website download, direct link, etc.). The `.exe` does NOT need to be hosted at `releases.vidtsx.com/releases/` — only the updater uses that path. The public download link can be hosted anywhere, but putting it at the same R2 path is convenient (e.g. `releases.vidtsx.com/releases/VidTSX-Studio-Setup-0.1.0.exe` works since it's already uploaded).

---

## Part 5 — Future Releases (documented for tomorrow-you)

When v0.1.1 (real) ships:

1. Bump [package.json:3](../package.json#L3) to `0.1.1` and commit.
2. `npm run build:win`
3. Upload the new `latest.yml`, `.exe`, `.exe.blockmap` from `dist/` into `releases/` in R2 (overwrite `latest.yml`; the old `.exe` can be kept for blockmap-based delta downloads or deleted to save storage).
4. Within 10 seconds of launch (or 4 hours of runtime), every installed v0.1.0 client pulls the update automatically.

This is already documented in [electron-builder.yml:7-17](../electron-builder.yml#L7-L17).

---

## Files Touched

- [package.json](../package.json) — temporary bump to `0.1.1` during test, reverted to `0.1.0` before publish. **No other code changes.**

No source files need to be modified. The auto-updater implementation is complete.

---

## Verification Checklist (must all pass before publishing)

- [ ] `curl https://releases.vidtsx.com/releases/latest.yml` returns YAML with the correct version
- [ ] `curl -I https://releases.vidtsx.com/releases/VidTSX-Studio-Setup-0.1.0.exe` returns `200` with a matching `Content-Length`
- [ ] Installed v0.1.0 app detected v0.1.1 update (Part 3.4)
- [ ] v0.1.1 downloaded and installed successfully, app relaunched as v0.1.1
- [ ] After revert, installed app at >= 0.1.0 sees "up to date" against v0.1.0 feed
- [ ] `package.json` version is `0.1.0` in the final commit
- [ ] R2 `releases/` contains exactly: `latest.yml` + `VidTSX-Studio-Setup-0.1.0.exe` + `.blockmap` (v0.1.0 only)

/**
 * One-click in-app install of the sd-cli engine (stable-diffusion.cpp) —
 * mirrors the whisper.cpp flow: pinned official upstream release, downloaded
 * on first use, nothing self-hosted (V1_RELEASE_PLAN.md Phase F).
 *
 * Provenance: sd-cli IS the official `leejet/stable-diffusion.cpp` release
 * binary (docs/local-image-models-implementation.md §C). Vulkan backend =
 * vendor-neutral GPU with built-in CPU fallback via the ggml-cpu-* variants.
 *
 * ⚠️ Matched-set rule: the exe dynamically loads ggml — sd-cli.exe and ALL
 * DLLs must come from the SAME release zip, so the FULL zip is extracted into
 * `userData/sd-cli/` and never mixed with other releases.
 */
import fs from 'fs/promises';
import path from 'path';
import { enqueueDownload } from './download-manager';
import { getSdCliUserDir, isSdCliInstalled } from './sdimage-models';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('SdCliInstall');

// Pinned upstream release. Upstream is rolling-release; the pin + checksum is
// the v1 supply-chain story (optional later: mirror the zip as a fallback URL).
export const SDCLI_RELEASE_TAG = 'master-778-c00a9e9';
const SDCLI_ZIP_NAME = `sd-master-c00a9e9-bin-win-vulkan-x64.zip`;
export const SDCLI_DOWNLOAD_URL = `https://github.com/leejet/stable-diffusion.cpp/releases/download/${SDCLI_RELEASE_TAG}/${SDCLI_ZIP_NAME}`;
/** SHA-256 of the 37,696,851-byte zip, computed from the upstream asset. */
export const SDCLI_ZIP_SHA256 = 'd7b6729c0f52daf0eb499f28e32aef35d6f4c2b7cef038ff553de435b1ce1935';
/** Download task id — renderer filters DOWNLOAD_PROGRESS events on metadata.type. */
export const SDCLI_DOWNLOAD_ID = 'sdcli-binary';

let inflight: Promise<void> | null = null;

/** True while an install download/extract is running. */
export function isSdCliInstalling(): boolean {
  return inflight !== null;
}

/**
 * Download + verify + extract the pinned sd-cli release into userData/sd-cli.
 * Idempotent while running (concurrent calls share one install). Progress
 * reaches the renderer through the global DOWNLOAD_PROGRESS broadcast.
 */
export function installSdCli(): Promise<void> {
  inflight ??= doInstall().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doInstall(): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('In-app sd-cli install currently supports Windows only. On macOS/Linux, build stable-diffusion.cpp from source.');
  }

  const dir = getSdCliUserDir();
  await fs.mkdir(dir, { recursive: true });

  const zipPath = path.join(dir, SDCLI_ZIP_NAME);
  log.info('Installing sd-cli', { url: SDCLI_DOWNLOAD_URL, dir });

  // Engine verifies the SHA-256 before extraction and deletes the archive after.
  await enqueueDownload({
    id: SDCLI_DOWNLOAD_ID,
    url: SDCLI_DOWNLOAD_URL,
    destPath: zipPath,
    sha256: SDCLI_ZIP_SHA256,
    extraction: { format: 'zip', destDir: dir, deleteArchive: true },
    metadata: { type: 'sdcli-binary' },
  });

  // sd-server.exe ships in the zip but is deliberately not kept (unused; the
  // app only spawns sd-cli). Licenses (.txt) stay alongside the binaries.
  await fs.unlink(path.join(dir, 'sd-server.exe')).catch(() => {});

  if (!isSdCliInstalled()) {
    throw new Error('sd-cli install finished but the executable was not found. Try again, and check disk space.');
  }
  log.info('sd-cli installed', { dir });
}

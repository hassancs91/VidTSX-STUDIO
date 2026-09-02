/**
 * The optional full ffmpeg build behind "Faster proxy generation (GPU
 * encoder)". Remotion's bundled ffmpeg has no hardware encoders at all, so
 * NVENC/QSV/AMF need a second binary — downloaded on request through the
 * download manager, never bundled (80 MB, and GPL: see THIRD_PARTY_NOTICES.md).
 *
 * Pinned to one dated BtbN release asset with its published SHA-256, the same
 * supply-chain story as sd-cli. "latest" tags are rolling and cannot be
 * checksummed; the monthly autobuild snapshots are kept. Why an 8.1 build and
 * not 9.x: 9.0.1 requires NVENC API 13.1 (driver 610+) and refused to open on
 * a 592-series driver; 8.1 needs 13.0 (570+).
 *
 * Nothing here runs unless the user clicked Download. Proxies only — the
 * Remotion export path never sees this binary.
 */
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { app } from 'electron';
import { logEngine } from '../../../logging/log-engine';
import { enqueueDownload, getAllDownloads } from '../download-manager';
import { getProxyGpuEncoderEnabled } from '../settings';
import {
  chooseProxyEncoder,
  encoderProbeArgs,
  parseHardwareEncoders,
  type ProxyGpuEncoder,
} from './proxy-encoders';

const log = logEngine.createLogger('StudioFfmpegFull');

export const FFMPEG_FULL_CATALOGUE = {
  version: 'n8.1.2-50-g1a748fe2cd (BtbN autobuild 2026-08-31)',
  url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-08-31-13-27/ffmpeg-n8.1.2-50-g1a748fe2cd-win64-gpl-shared-8.1.zip',
  sha256: '0a41f31caff48e3035b48f09f5d840bd8d1863008240fc43e457f15e589cf5b3',
  /** Bytes of the zip, from the release asset. */
  bytes: 80069496,
  licence: 'GPL v3',
  sourceUrl: 'https://github.com/BtbN/FFmpeg-Builds',
  /** Folder inside the zip. */
  extractedDir: 'ffmpeg-n8.1.2-50-g1a748fe2cd-win64-gpl-shared-8.1',
} as const;

/** Download task id; the renderer filters DOWNLOAD_PROGRESS on metadata.type. */
export const FFMPEG_FULL_DOWNLOAD_ID = 'ffmpeg-full';
export const FFMPEG_FULL_DOWNLOAD_TYPE = 'ffmpeg-full';

const ENCODERS_CACHE_FILE = 'encoders.json';
/** Dev-only payload the shared zip carries; not needed to run ffmpeg. */
const REMOVABLE_AFTER_EXTRACT = ['include', 'lib', 'doc', path.join('bin', 'ffplay.exe')];

export function getFfmpegFullDir(): string {
  return path.join(app.getPath('userData'), 'ffmpeg-full');
}

function binaryPath(): string {
  return path.join(getFfmpegFullDir(), FFMPEG_FULL_CATALOGUE.extractedDir, 'bin', 'ffmpeg.exe');
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Installed-check reads the final artefact only, never the .zip or a .part. */
export async function getFfmpegFullBinary(): Promise<string | null> {
  return (await exists(binaryPath())) ? binaryPath() : null;
}

let inflight: Promise<void> | null = null;

export function isFfmpegFullInstalling(): boolean {
  return inflight !== null;
}

/** Download + verify + extract. Idempotent while running. */
export function installFfmpegFull(): Promise<void> {
  inflight ??= doInstall().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doInstall(): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('The GPU proxy encoder download is Windows-only for now.');
  }
  const dir = getFfmpegFullDir();
  await fs.mkdir(dir, { recursive: true });
  // A stale probe result must not outlive the binary it described.
  await fs.rm(path.join(dir, ENCODERS_CACHE_FILE), { force: true }).catch(() => {});
  log.info('Downloading full ffmpeg', { url: FFMPEG_FULL_CATALOGUE.url, dir });
  await enqueueDownload({
    id: FFMPEG_FULL_DOWNLOAD_ID,
    url: FFMPEG_FULL_CATALOGUE.url,
    destPath: path.join(dir, path.basename(FFMPEG_FULL_CATALOGUE.url)),
    sha256: FFMPEG_FULL_CATALOGUE.sha256,
    extraction: { format: 'zip', destDir: dir, deleteArchive: true },
    metadata: { type: FFMPEG_FULL_DOWNLOAD_TYPE },
  });
  if (!(await getFfmpegFullBinary())) {
    throw new Error('The ffmpeg download finished but ffmpeg.exe was not found. Try again, and check disk space.');
  }
  log.info('Full ffmpeg installed', { dir });
}

/** Is the download task currently queued/downloading/extracting? */
export function isFfmpegFullDownloading(): boolean {
  if (inflight) return true;
  return getAllDownloads().some(
    (d) => d.id === FFMPEG_FULL_DOWNLOAD_ID && !['completed', 'failed', 'cancelled'].includes(d.status),
  );
}

function runToExit(binary: string, args: string[]): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve) => {
    const proc = spawn(binary, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    proc.on('error', () => resolve({ code: null, stdout }));
    proc.on('close', (code) => resolve({ code, stdout }));
  });
}

export interface ProxyEncoderProbe {
  /** What `-encoders` lists. */
  listed: ProxyGpuEncoder[];
  /** The subset that actually opened on this machine and driver. */
  working: ProxyGpuEncoder[];
  probedAt: string;
}

/**
 * Which hardware encoders this binary can open here. Listing is not enough
 * (a listed NVENC can still refuse an old driver), so each candidate encodes
 * two synthetic frames. Cached beside the binary; the cache is deleted when a
 * new download starts.
 */
export function probeProxyEncoders(ffmpeg: string): Promise<ProxyEncoderProbe> {
  // Two status calls can land before the cache exists (the row refreshes on
  // the download's 'completed' event and again when install() resolves);
  // share one probe rather than spawning the encoders twice.
  probing ??= doProbe(ffmpeg).finally(() => {
    probing = null;
  });
  return probing;
}

let probing: Promise<ProxyEncoderProbe> | null = null;

async function doProbe(ffmpeg: string): Promise<ProxyEncoderProbe> {
  const cachePath = path.join(getFfmpegFullDir(), ENCODERS_CACHE_FILE);
  try {
    const cached = JSON.parse(await fs.readFile(cachePath, 'utf-8')) as ProxyEncoderProbe;
    if (Array.isArray(cached.listed) && Array.isArray(cached.working)) return cached;
  } catch {
    // No cache yet.
  }
  const { stdout } = await runToExit(ffmpeg, ['-hide_banner', '-encoders']);
  const listed = parseHardwareEncoders(stdout);
  const working: ProxyGpuEncoder[] = [];
  for (const encoder of listed) {
    const { code } = await runToExit(ffmpeg, encoderProbeArgs(encoder));
    if (code === 0) working.push(encoder);
  }
  const probe: ProxyEncoderProbe = { listed, working, probedAt: new Date().toISOString() };
  log.info('Probed GPU proxy encoders', { ...probe });
  await fs.writeFile(cachePath, JSON.stringify(probe), 'utf-8').catch(() => {});
  // Disk hygiene, best effort: the shared zip's headers and import libs are
  // 120 MB the app never reads. Done here rather than after the download,
  // because a download resumed in a later session never returns to install().
  for (const rel of REMOVABLE_AFTER_EXTRACT) {
    await fs.rm(path.join(getFfmpegFullDir(), FFMPEG_FULL_CATALOGUE.extractedDir, rel), { recursive: true, force: true }).catch(() => {});
  }
  return probe;
}

// ─── The sticky fallback ───
// One failed GPU window and the rest of the session is x264. Surfaced in the
// settings row so a silent slow-down never looks like the feature working.

export interface ProxyGpuFallback {
  encoder: ProxyGpuEncoder;
  reason: string;
  at: string;
}

let fallback: ProxyGpuFallback | null = null;

export function getProxyGpuFallback(): ProxyGpuFallback | null {
  return fallback;
}

export function markProxyGpuEncoderFailed(encoder: ProxyGpuEncoder, err: unknown): void {
  if (fallback) return;
  const reason = (err instanceof Error ? err.message : String(err)).slice(0, 300);
  fallback = { encoder, reason, at: new Date().toISOString() };
  log.warn('GPU proxy encoder failed; using x264 for the rest of this session', { encoder, reason });
}

/** Clearing the latch when the user toggles the setting gives a retry. */
export function clearProxyGpuFallback(): void {
  fallback = null;
}

export interface ResolvedProxyGpuEncoder {
  ffmpeg: string;
  encoder: ProxyGpuEncoder;
}

/**
 * The encoder the next proxy should use, or null for the bundled x264 path:
 * the setting must be on, the binary installed, an encoder proven working,
 * and no failure latched this session.
 */
export async function resolveProxyGpuEncoder(): Promise<ResolvedProxyGpuEncoder | null> {
  if (fallback) return null;
  if (!(await getProxyGpuEncoderEnabled())) return null;
  const ffmpeg = await getFfmpegFullBinary();
  if (!ffmpeg) return null;
  const probe = await probeProxyEncoders(ffmpeg);
  const encoder = chooseProxyEncoder(probe.working);
  return encoder ? { ffmpeg, encoder } : null;
}

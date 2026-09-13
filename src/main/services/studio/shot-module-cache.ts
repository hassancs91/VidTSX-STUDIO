// Disk cache of transpiled preview shot modules (video-10 feedback item 2).
//
// Opening a project asks main for one preview module per ready shot; a cold
// app transpiled every one of them again (62 on video-10, ~0.9 s of IPC wait).
// Entries live at <project>/cache/shot-modules/<shotId>/v<N>.json — under
// cache/, so "Clear cache" removes them with everything else derivable.
//
// Keyed by shotId@version (the app only ever ADDS v<N>.tsx files), and an
// entry is still re-checked before use, so nothing stale is ever served:
//   - source size + mtime: a linked-folder edit that rewrote v<N>.tsx in
//     place misses and re-transpiles (the entry is then overwritten);
//   - transpiler fingerprint (transpiler-fingerprint.ts): a new app build —
//     a changed transpiler, import rewriter or vendor map — misses everywhere.
// The module-server base URL is baked into transpiled imports and its port
// can change between runs, so it is stored as a token and restored on read.
//
// Cache failures are never errors: a read that fails is a miss, a write that
// fails is logged and dropped — the transpile result is still served.

import fs from 'fs/promises';
import path from 'path';
import type { CompositionConfig, TranspileResult } from '../tsx-transpiler';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('ShotModuleCache');

export const SHOT_MODULE_CACHE_DIR = 'shot-modules';
/** Bump when the ENTRY shape changes (the fingerprint covers the transpiler). */
export const SHOT_MODULE_CACHE_FORMAT = 1;
export const MODULE_BASE_TOKEN = '__VIDTSX_MODULE_BASE__';

/** What an entry must match to be served. */
export interface ShotModuleCacheKey {
  transpiler: string;
  sourceSize: number;
  sourceMtimeMs: number;
}

export interface ShotModuleCacheEntry extends ShotModuleCacheKey {
  format: number;
  hash: string;
  componentName: string;
  config: CompositionConfig;
  /** Transpiled code with the module-server base URL replaced by the token. */
  code: string;
}

export function shotModuleCachePath(cacheDir: string, shotId: string, version: number): string {
  return path.join(cacheDir, SHOT_MODULE_CACHE_DIR, shotId, `v${version}.json`);
}

export function isEntryUsable(entry: unknown, key: ShotModuleCacheKey): entry is ShotModuleCacheEntry {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as Partial<ShotModuleCacheEntry>;
  return (
    e.format === SHOT_MODULE_CACHE_FORMAT &&
    e.transpiler === key.transpiler &&
    e.sourceSize === key.sourceSize &&
    e.sourceMtimeMs === key.sourceMtimeMs &&
    typeof e.code === 'string' &&
    typeof e.hash === 'string' &&
    typeof e.componentName === 'string' &&
    !!e.config &&
    typeof e.config === 'object'
  );
}

export function tokenizeBaseUrl(code: string, baseUrl: string): string {
  return code.split(baseUrl).join(MODULE_BASE_TOKEN);
}

export function restoreBaseUrl(code: string, baseUrl: string): string {
  return code.split(MODULE_BASE_TOKEN).join(baseUrl);
}

export async function readShotModuleCache(
  cacheDir: string,
  shotId: string,
  version: number,
  key: ShotModuleCacheKey,
  baseUrl: string,
): Promise<TranspileResult | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(shotModuleCachePath(cacheDir, shotId, version), 'utf-8'));
  } catch {
    return null; // Missing or unreadable: a miss.
  }
  if (!isEntryUsable(parsed, key)) return null;
  return {
    success: true,
    code: restoreBaseUrl(parsed.code, baseUrl),
    hash: parsed.hash,
    config: parsed.config,
    componentName: parsed.componentName,
  };
}

export async function writeShotModuleCache(
  cacheDir: string,
  shotId: string,
  version: number,
  key: ShotModuleCacheKey,
  result: TranspileResult,
  baseUrl: string,
): Promise<void> {
  const target = shotModuleCachePath(cacheDir, shotId, version);
  const entry: ShotModuleCacheEntry = {
    format: SHOT_MODULE_CACHE_FORMAT,
    ...key,
    hash: result.hash,
    componentName: result.componentName,
    config: result.config,
    code: tokenizeBaseUrl(result.code, baseUrl),
  };
  // Write-then-rename so a crash mid-write never leaves a torn entry behind.
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(entry), 'utf-8');
    await fs.rename(tmp, target);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    log.warn('Shot module cache write failed', {
      shotId,
      version,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

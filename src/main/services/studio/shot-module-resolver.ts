// Resolve a shot version to its preview module (TSX_SHOTS_DESIGN D4), fastest
// source first: this process's memo → the project's disk cache → transpile.
//
// Every tier is checked against the same key — the source file's size + mtime
// and the transpiler fingerprint — so an in-place rewrite of v<N>.tsx or a new
// app build never serves an old module (shot-module-cache.ts has the why).
// A transpile writes the disk entry in the background; the caller never waits
// on the cache.

import fs from 'fs/promises';
import { transpileTsxCached, type TranspileOutput, type TranspileResult } from '../tsx-transpiler';
import { getTranspilerFingerprint } from '../transpiler-fingerprint';
import { getProjectCacheDir, getShotVersionPath } from './studio-paths';
import {
  readShotModuleCache,
  writeShotModuleCache,
  type ShotModuleCacheKey,
} from './shot-module-cache';

export type ShotModuleSource = 'memory' | 'disk' | 'transpile';

export type ResolvedShotModule =
  | (TranspileResult & { source: ShotModuleSource })
  | { success: false; error: string; missing?: boolean };

const memo = new Map<string, { key: ShotModuleCacheKey; result: TranspileResult }>();

const sameKey = (a: ShotModuleCacheKey, b: ShotModuleCacheKey): boolean =>
  a.transpiler === b.transpiler && a.sourceSize === b.sourceSize && a.sourceMtimeMs === b.sourceMtimeMs;

export async function resolveShotModule(
  projectId: string,
  shotId: string,
  version: number,
  baseUrl: string,
): Promise<ResolvedShotModule> {
  const filePath = await getShotVersionPath(projectId, shotId, version);
  let stat: { size: number; mtimeMs: number };
  try {
    stat = await fs.stat(filePath);
  } catch {
    return { success: false, error: `Shot source missing: ${shotId} v${version}`, missing: true };
  }
  const key: ShotModuleCacheKey = {
    transpiler: await getTranspilerFingerprint(),
    sourceSize: stat.size,
    sourceMtimeMs: stat.mtimeMs,
  };
  const memoKey = `${projectId}/${shotId}@${version}@${baseUrl}`;

  const remembered = memo.get(memoKey);
  if (remembered && sameKey(remembered.key, key)) {
    return { ...remembered.result, source: 'memory' };
  }

  const cacheDir = await getProjectCacheDir(projectId);
  const cached = await readShotModuleCache(cacheDir, shotId, version, key, baseUrl);
  if (cached) {
    memo.set(memoKey, { key, result: cached });
    return { ...cached, source: 'disk' };
  }

  const output: TranspileOutput = await transpileTsxCached(filePath, baseUrl);
  if (!output.success) return { success: false, error: output.error };
  memo.set(memoKey, { key, result: output });
  void writeShotModuleCache(cacheDir, shotId, version, key, output, baseUrl);
  return { ...output, source: 'transpile' };
}

/** Test seam: forget this process's memo. */
export function clearShotModuleMemo(): void {
  memo.clear();
}

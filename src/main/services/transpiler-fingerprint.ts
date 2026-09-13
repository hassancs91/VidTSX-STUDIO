// The transpiler's identity for on-disk caches of its output (shot-module-cache).
//
// A cached module is only valid for the transpiler that produced it. Rather
// than a hand-bumped constant someone forgets, the fingerprint hashes the
// built main-process bundle (every .js under out/main, where the transpiler,
// import rewriter and vendor maps are compiled in) plus esbuild's version.
// Any main build change therefore invalidates every cached module once — the
// first open after an update or a dev rebuild re-transpiles, which is the
// honest price of never serving output from an older transpiler. Computed
// once per process, lazily, on the first cache lookup.

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import * as esbuild from 'esbuild';
import { getMainBundleDir } from '../utils/paths';

let fingerprint: Promise<string> | null = null;

export function getTranspilerFingerprint(): Promise<string> {
  fingerprint ??= computeFingerprint(getMainBundleDir());
  return fingerprint;
}

export async function computeFingerprint(bundleDir: string): Promise<string> {
  const hash = createHash('sha256').update(`esbuild@${esbuild.version}\n`);
  const files = await listJsFiles(bundleDir);
  for (const file of files) {
    hash.update(`${path.relative(bundleDir, file)}\n`);
    hash.update(await fs.readFile(file));
  }
  if (files.length === 0) {
    // No readable bundle (unexpected layout): a per-process nonce keeps the
    // cache correct — it just never hits across restarts.
    hash.update(`nonce:${process.pid}:${Date.now()}`);
  }
  return hash.digest('hex').slice(0, 16);
}

async function listJsFiles(dir: string): Promise<string[]> {
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listJsFiles(full)));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

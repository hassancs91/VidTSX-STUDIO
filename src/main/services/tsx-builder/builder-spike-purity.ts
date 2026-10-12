// The frame-purity probe for builder-spike.ts (P2 part 3, no model): each
// source goes through `check` and then the purity look (build-looks.ts
// `measureFramePurity`), and passes when the verdict is the one it should get:
// the physics probes on @vidtsx/sim must come out PURE, the deliberately
// impure sources (a world stepped once per render, Math.random in a setup)
// IMPURE. The compared PNGs stay in `<outDir>/purity/<name>/` to look at.

import fs from 'fs/promises';
import path from 'path';
import { checkBuild } from './build-check';
import { measureFramePurity } from './build-looks';
import { describePurity } from './frame-purity';
import { BUILD_ENTRY } from './constants';

export interface PuritySource {
  name: string;
  /** A single .tsx (becomes the entry) or a folder with its own index.tsx. */
  path: string;
  expect: 'pure' | 'impure';
  /** Sample frames (default: the tool's own). */
  frames?: number[];
}

export interface PurityRequest {
  mode: 'purity';
  outDir: string;
  sources: PuritySource[];
  quit?: boolean;
}

export async function purityProbe(outDir: string, sources: PuritySource[]): Promise<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  for (const source of sources) {
    const dir = path.join(outDir, 'purity', source.name);
    const workDir = path.join(dir, 'work');
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(workDir, { recursive: true });
    if ((await fs.stat(source.path)).isDirectory()) await fs.cp(source.path, workDir, { recursive: true });
    else await fs.copyFile(source.path, path.join(workDir, BUILD_ENTRY));

    const check = await checkBuild(workDir);
    const record: Record<string, unknown> = {
      name: source.name,
      expect: source.expect,
      check: { ok: check.ok, errors: check.errors, ms: check.ms, bytes: check.code?.length ?? 0, inlinedPackages: check.inlinedPackages },
    };
    results.push(record);
    if (!check.ok || !check.code || !check.config) {
      record.pass = false;
      continue;
    }
    const started = Date.now();
    try {
      const purity = await measureFramePurity(check.code, check.config, dir, {
        label: 'purity',
        ...(source.frames ? { frames: source.frames } : {}),
      });
      record.pure = purity.pure;
      record.frames = purity.frames;
      record.scale = purity.scale;
      record.inOrderFrames = purity.inOrderFrames;
      record.ms = { ...purity.ms, total: Date.now() - started };
      record.bundleCached = purity.bundleCached;
      record.gl = purity.gl;
      record.paths = purity.paths;
      record.reply = describePurity(purity, purity.scale);
      record.pass = purity.pure === (source.expect === 'pure');
    } catch (err) {
      record.error = err instanceof Error ? err.message : String(err);
      record.pass = false;
    }
  }
  return { mode: 'purity', pass: results.every((r) => r.pass === true), results };
}

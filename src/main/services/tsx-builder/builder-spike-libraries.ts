// The library probe for builder-spike.ts (P2 part 1, no model): one small
// source per area of the library set (shared/tsx-engine/builder-libraries.ts)
// goes through `check` (the bundle step inlines it) and, when it should pass,
// through the builder's own stills path, so a library that bundles but fails
// in the renderer (WebGL, WASM, a package that needs the DOM) shows up here.
// Sources that must be refused (a clock-driven library) are checked for the
// refusal and its message.

import fs from 'fs/promises';
import path from 'path';
import { checkBuild } from './build-check';
import { renderBuildStills } from './build-stills';
import { BUILD_ENTRY } from './constants';

export interface LibrarySource {
  name: string;
  /** A single .tsx (becomes the entry) or a folder with its own index.tsx. */
  path: string;
  expect: 'ok' | 'refused';
  /** For `refused`: a fragment the check's error must contain. */
  refusedMatch?: string;
  /** Frames to render for `ok` (default: 0 and the middle frame). */
  frames?: number[];
}

export interface LibrariesRequest {
  mode: 'libraries';
  outDir: string;
  sources: LibrarySource[];
  quit?: boolean;
}

export async function libraryProbe(outDir: string, sources: LibrarySource[]): Promise<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  for (const source of sources) {
    const dir = path.join(outDir, 'libraries', source.name);
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
    if (source.expect === 'refused') {
      const text = check.errors.join('\n');
      record.pass = !check.ok && (!source.refusedMatch || text.includes(source.refusedMatch));
      continue;
    }
    if (!check.ok || !check.code || !check.config) {
      record.pass = false;
      continue;
    }
    const frames = source.frames ?? [0, Math.floor(check.config.durationInFrames / 2)];
    try {
      const stills = await renderBuildStills(check.code, check.config, dir, frames, { label: source.name });
      record.stills = { ms: stills.ms, paths: stills.stills.map((s) => s.path) };
      record.pass = true;
    } catch (err) {
      record.error = err instanceof Error ? err.message : String(err);
      record.pass = false;
    }
  }
  return { mode: 'libraries', pass: results.every((r) => r.pass === true), results };
}

// The look-backdrop probe for builder-spike.ts (P3 part 5, no model): what a
// transparent Studio shot's looks show behind it. Each source goes through
// `check` (a Studio shot build: the kit inlined, Studio media kinds) and then
// its frames are rendered as the builder sees them three ways: the piece
// alone (what a JPEG look showed before part 5), over the footage (the look
// wrapper with the backdrop video), and over the checkerboard (no footage);
// plus one contact sheet over the footage (Freeze + OffthreadVideo per tile).
// Images stay in `<outDir>/backdrop/<name>/` to look at; the run releases its
// bundles, as a builder run does.

import fs from 'fs/promises';
import path from 'path';
import { checkBuild } from './build-check';
import { renderBuildStills } from './build-stills';
import { renderContactSheet } from './build-looks';
import { BACKDROP_ENTRY, backdropLookSource } from './look-backdrop';
import { BUILD_ENTRY } from './constants';
import { releaseBundlesUnder } from '../remotion-bundler';

export interface BackdropSource {
  name: string;
  /** A single .tsx (becomes the entry) or a folder with its own index.tsx. */
  path: string;
  frames: number[];
  /** The footage under the piece: a video file and the source second at frame 0. */
  backdrop?: { file: string; startSeconds: number };
}

export interface BackdropRequest {
  mode: 'backdrop';
  outDir: string;
  sources: BackdropSource[];
  quit?: boolean;
}

export async function backdropProbe(outDir: string, sources: BackdropSource[]): Promise<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  try {
    for (const source of sources) {
      const dir = path.join(outDir, 'backdrop', source.name);
      const workDir = path.join(dir, 'work');
      await fs.rm(dir, { recursive: true, force: true });
      await fs.mkdir(workDir, { recursive: true });
      if ((await fs.stat(source.path)).isDirectory()) await fs.cp(source.path, workDir, { recursive: true });
      else await fs.copyFile(source.path, path.join(workDir, BUILD_ENTRY));

      const check = await checkBuild(workDir, undefined, { studioShot: true });
      const record: Record<string, unknown> = {
        name: source.name,
        check: {
          ok: check.ok,
          errors: check.errors,
          ms: check.ms,
          bytes: check.code?.length ?? 0,
          inlinedPackages: check.inlinedPackages,
          kitLeftExternal: check.code?.includes('@vidtsx/kit') ?? null,
        },
      };
      results.push(record);
      if (!check.ok || !check.code || !check.config) continue;
      const { code, config } = check;
      const timed = async (label: string, run: () => Promise<{ paths: string[] }>) => {
        const started = Date.now();
        try {
          const out = await run();
          record[label] = { ms: Date.now() - started, paths: out.paths };
        } catch (err) {
          record[label] = { error: err instanceof Error ? err.message : String(err) };
        }
      };
      const stills = (label: string, sourceCode: string, extra: { entryName?: string; backdropFile?: string } = {}) =>
        timed(label, async () => {
          const out = await renderBuildStills(sourceCode, config, path.join(dir, label), source.frames, { label, maxSide: 1024, ...extra });
          return { paths: out.stills.map((s) => s.path) };
        });

      await stills('alone', code);
      await stills('checker', backdropLookSource(code, config, null), { entryName: BACKDROP_ENTRY });
      if (source.backdrop) {
        const wrapped = backdropLookSource(code, config, source.backdrop.startSeconds * config.fps);
        await stills('footage', wrapped, { entryName: BACKDROP_ENTRY, backdropFile: source.backdrop.file });
        await timed('sheet', async () => {
          const sheet = await renderContactSheet(wrapped, config, path.join(dir, 'sheet'), source.frames, {
            label: 'sheet',
            backdropFile: source.backdrop!.file,
          });
          return { paths: [sheet.path] };
        });
      }
    }
  } finally {
    await releaseBundlesUnder(outDir).catch(() => 0);
  }
  return { mode: 'backdrop', results };
}

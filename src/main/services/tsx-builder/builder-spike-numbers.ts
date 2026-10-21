// The numbers probe for builder-spike.ts (P4-12, no model): number_check's
// sweep and verdict on sources whose clock is known. Each source goes through
// `check`, then the sweep (number-sweep.ts) and the comparison
// (number-check.ts), timed; the verdict is held against `expect` (ok / split)
// and the model's text is kept. The raw sweep is saved per source for reading.
// The same sweep also goes through text_overlaps (P5-4, text-overlaps.ts),
// held against `expectOverlaps` (clear / overlaps) when a source names one.
// Everything stays in `<outDir>/numbers/<name>/`; the run releases its bundles.

import fs from 'fs/promises';
import path from 'path';
import { checkBuild } from './build-check';
import { isWebGlBuild } from './builder-tool-common';
import { BUILD_ENTRY } from './constants';
import { checkNumbers, describeNumberCheck } from './number-check';
import { sweepFrameText } from './number-sweep';
import { checkOverlaps, describeOverlaps } from './text-overlaps';
import { releaseBundlesUnder } from '../remotion-bundler';

export interface NumbersSource {
  name: string;
  /** A single .tsx (becomes the entry) or a folder with its own index.tsx. */
  path: string;
  /** The verdict it should get. */
  expect?: 'ok' | 'split';
  /** The text_overlaps verdict it should get. */
  expectOverlaps?: 'clear' | 'overlaps';
}

export interface NumbersRequest {
  mode: 'numbers';
  outDir: string;
  sources: NumbersSource[];
  quit?: boolean;
}

export async function numbersProbe(outDir: string, sources: NumbersSource[]): Promise<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  try {
    for (const source of sources) {
      const dir = path.join(outDir, 'numbers', source.name);
      const workDir = path.join(dir, 'work');
      await fs.rm(dir, { recursive: true, force: true });
      await fs.mkdir(workDir, { recursive: true });
      if ((await fs.stat(source.path)).isDirectory()) await fs.cp(source.path, workDir, { recursive: true });
      else await fs.copyFile(source.path, path.join(workDir, BUILD_ENTRY));

      const check = await checkBuild(workDir);
      const record: Record<string, unknown> = { name: source.name, check: { ok: check.ok, errors: check.errors, ms: check.ms } };
      results.push(record);
      if (!check.ok || !check.code || !check.config) continue;
      try {
        const webgl = isWebGlBuild(check.inlinedPackages);
        const sweep = await sweepFrameText(check.code, check.config, path.join(dir, 'sweep'), { label: 'numbers', webgl });
        const result = checkNumbers(sweep.frames, check.config);
        await fs.writeFile(path.join(dir, 'sweep.json'), JSON.stringify(sweep.frames), 'utf-8');
        record.webgl = webgl;
        record.sweep = { step: sweep.step, tiles: sweep.tiles, unread: sweep.unread, ms: sweep.ms };
        record.verdict = result.ok ? 'ok' : 'split';
        if (source.expect) record.expect = source.expect === record.verdict ? 'pass' : `FAIL, wanted ${source.expect}`;
        record.result = {
          ...result,
          splits: result.splits.map((s) => ({ ...s, frames: s.frames.length, firstFrames: s.frames.slice(0, 12) })),
        };
        record.model = describeNumberCheck(result, sweep.step > 1 ? `, every ${sweep.step}th frame` : '');
        const overlaps = checkOverlaps(sweep.frames);
        const overlapVerdict = overlaps.clear ? 'clear' : 'overlaps';
        record.overlaps = {
          verdict: overlapVerdict,
          ...(source.expectOverlaps ? { expect: source.expectOverlaps === overlapVerdict ? 'pass' : `FAIL, wanted ${source.expectOverlaps}` } : {}),
          ...overlaps,
          model: describeOverlaps(overlaps, sweep.step > 1 ? `, every ${sweep.step}th frame` : ''),
        };
      } catch (err) {
        record.error = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
      }
    }
  } finally {
    await releaseBundlesUnder(outDir).catch(() => 0);
  }
  return { mode: 'numbers', sources: results };
}

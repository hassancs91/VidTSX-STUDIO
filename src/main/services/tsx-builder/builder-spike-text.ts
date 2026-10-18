// The frame-text probe for builder-spike.ts (P4 part 2, no model): does each
// frame's text come out of the looks, per frame, in order, for HTML and SVG
// text, for a 3D piece's overlay, and on the tile-by-tile WebGL sheet? Each
// source goes through `check`, then:
// - stills twice: the text must be the same both times, and equal `expect`
//   where the source's text is known;
// - one contact sheet (mounted for 2D, tile by tile for WebGL; `sheetTiles`
//   forces one), whose text per frame must equal the stills';
// - the same frames as PNGs from an entry with the probe and from one without,
//   `pixelRepeats` times each plus one more without (the render's own noise):
//   the probe must not change a pixel beyond that noise;
// - `timeInOrder`: the in-order render (purity_check's pass, which now
//   carries the probe too) with and without it, timed.
// Everything stays in `<outDir>/frametext/<name>/`; the run releases its bundles.

import fs from 'fs/promises';
import path from 'path';
import { checkBuild } from './build-check';
import { prepareBuildRender, readBitmap, renderBuildStills, renderPreparedFrames, type PreparedBuild } from './build-stills';
import { renderPreparedInOrder } from './build-in-order';
import { renderContactSheet } from './build-looks';
import { isWebGlBuild } from './builder-tool-common';
import { describeFrameText } from './frame-text';
import { BUILD_ENTRY } from './constants';
import { releaseBundlesUnder } from '../remotion-bundler';

export interface FrameTextSource {
  name: string;
  /** A single .tsx (becomes the entry) or a folder with its own index.tsx. */
  path: string;
  frames: number[];
  /** Per frame, the exact text line the model gets (describeFrameText), where it is known. */
  expect?: Record<string, string>;
  sheetTiles?: 'mounted' | 'separate';
  timeInOrder?: boolean;
  /** Renders per side in the pixel check (default 1), interleaved, to tell the probe from the render's own noise. */
  pixelRepeats?: number;
}

export interface FrameTextRequest {
  mode: 'frametext';
  outDir: string;
  sources: FrameTextSource[];
  quit?: boolean;
}

/** Two renders of the same frames, pixel for pixel: bytes that differ and the largest difference. */
function pixelDiff(a: string, b: string): { differing: number; max: number } {
  const x = readBitmap(a);
  const y = readBitmap(b);
  if (x.width !== y.width || x.height !== y.height) return { differing: -1, max: -1 };
  let differing = 0;
  let max = 0;
  for (let i = 0; i < x.data.length; i++) {
    const d = Math.abs(x.data[i] - y.data[i]);
    if (d > 0) differing += 1;
    if (d > max) max = d;
  }
  return { differing, max };
}

async function pngs(prepared: PreparedBuild, dir: string, frames: number[], label: string) {
  return renderPreparedFrames(prepared, dir, frames, { label, imageFormat: 'png' });
}

export async function frameTextProbe(outDir: string, sources: FrameTextSource[]): Promise<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  try {
    for (const source of sources) {
      const dir = path.join(outDir, 'frametext', source.name);
      const workDir = path.join(dir, 'work');
      await fs.rm(dir, { recursive: true, force: true });
      await fs.mkdir(workDir, { recursive: true });
      if ((await fs.stat(source.path)).isDirectory()) await fs.cp(source.path, workDir, { recursive: true });
      else await fs.copyFile(source.path, path.join(workDir, BUILD_ENTRY));

      const check = await checkBuild(workDir);
      const record: Record<string, unknown> = { name: source.name, check: { ok: check.ok, errors: check.errors, ms: check.ms } };
      results.push(record);
      if (!check.ok || !check.code || !check.config) continue;
      const { code, config } = check;
      const webgl = isWebGlBuild(check.inlinedPackages);
      const separateTiles = source.sheetTiles ? source.sheetTiles === 'separate' : webgl;
      record.webgl = webgl;
      try {
        let started = Date.now();
        const first = await renderBuildStills(code, config, path.join(dir, 'stills-a'), source.frames, { label: 'a' });
        const stillsMs = Date.now() - started;
        const second = await renderBuildStills(code, config, path.join(dir, 'stills-b'), source.frames, { label: 'b' });
        started = Date.now();
        const sheet = await renderContactSheet(code, config, path.join(dir, 'sheet'), source.frames, { label: 'sheet', separateTiles });
        const sheetMs = Date.now() - started;
        const sheetText = new Map(sheet.text.map((t) => [t.frame, describeFrameText(t.text)]));
        const frames = first.stills.map((still, i) => {
          const line = describeFrameText(still.text);
          const expected = source.expect?.[String(still.frame)];
          return {
            frame: still.frame,
            text: line,
            lines: still.text?.lines.length ?? null,
            again: describeFrameText(second.stills[i]?.text) === line,
            sheet: sheetText.get(still.frame) === line ? 'same' : (sheetText.get(still.frame) ?? 'missing'),
            ...(expected !== undefined ? { expect: expected === line ? 'pass' : `FAIL, wanted ${expected}` } : {}),
          };
        });
        record.stillsMs = stillsMs;
        record.sheet = { tiles: sheet.tiles, ms: sheetMs, path: sheet.path };
        record.frames = frames;
        record.textOk = frames.every((f) => f.again && f.sheet === 'same' && (f.expect === undefined || f.expect === 'pass'));

        // The probe must not change a pixel: with it, without it, and without it again (the render's own noise).
        const pxDir = path.join(dir, 'px');
        const withProbe = await prepareBuildRender(code, config, pxDir, { entryName: 'with-probe.tsx' });
        const without = await prepareBuildRender(code, config, pxDir, { entryName: 'without-probe.tsx', frameText: false });
        // Interleaved: without0, with0, without1, with1, … and one more without, so each side has its own noise.
        const repeats = Math.max(1, source.pixelRepeats ?? 1);
        const withRuns: Awaited<ReturnType<typeof pngs>>[] = [];
        const withoutRuns: Awaited<ReturnType<typeof pngs>>[] = [];
        for (let n = 0; n < repeats; n++) {
          withoutRuns.push(await pngs(without, pxDir, source.frames, `without${n}`));
          withRuns.push(await pngs(withProbe, pxDir, source.frames, `with${n}`));
        }
        withoutRuns.push(await pngs(without, pxDir, source.frames, `without${repeats}`));
        record.pixels = withoutRuns[0].map((base, i) => ({
          frame: base.frame,
          probe: withRuns.map((run) => pixelDiff(run[i].path, base.path)),
          noise: withoutRuns.slice(1).map((run) => pixelDiff(run[i].path, base.path)),
          probeNoise: withRuns.slice(1).map((run) => pixelDiff(run[i].path, withRuns[0][i].path)),
        }));

        if (source.timeInOrder) {
          const last = [Math.max(...source.frames)];
          started = Date.now();
          await renderPreparedInOrder(without, pxDir, last, { label: 'order-without' });
          const withoutMs = Date.now() - started;
          started = Date.now();
          await renderPreparedInOrder(withProbe, pxDir, last, { label: 'order-with' });
          record.inOrder = { frames: last[0] + 1, withoutMs, withMs: Date.now() - started };
        }
      } catch (err) {
        record.error = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
      }
    }
  } finally {
    await releaseBundlesUnder(outDir).catch(() => 0);
  }
  return { mode: 'frametext', results };
}

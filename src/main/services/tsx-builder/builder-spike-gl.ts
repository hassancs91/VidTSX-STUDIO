// The GL timing probe for builder-spike.ts (P2 part 2, no model). It reports
// the backend the app picked (gl-backend-probe.ts) and, for each source, what
// the builder's own stills path costs on that backend and on `swangle`: the
// bundle, selectComposition, and each frame as its own renderStill (as the
// look tools render), as PNGs. Then the pixel difference per frame between
// the two backends, and each backend against itself (frame 0 rendered again):
// loop_seam's thresholds need one backend to repeat itself exactly.
// `exportFrames` also exports that many frames as H.264 through
// renderComposition (the app's export) on each backend: a still opens a page
// per frame, an export renders a run of frames per tab, so the two costs differ.

import fs from 'fs/promises';
import path from 'path';
import { checkBuild } from './build-check';
import { prepareBuildRender, readBitmap, renderPreparedFrames } from './build-stills';
import { BUILD_ENTRY } from './constants';
import { changedRegion, meanAbsDiff } from './loop-seam';
import { probeGlBackend, type ProbedGl } from '../gl-backend-probe';
import { renderComposition } from '../remotion-renderer';
import type { CompositionConfig } from '../composition-config-parser';
import type { RenderCompleteEvent } from '../../../shared/ipc/types';

export interface GlTimingSource {
  name: string;
  /** A single .tsx (becomes the entry) or a folder with its own index.tsx. */
  path: string;
  /** Default: 0, the middle frame and the last. */
  frames?: number[];
  /** Also export the first N frames on each backend, timed. */
  exportFrames?: number;
}

export interface GlTimingRequest {
  mode: 'gl';
  outDir: string;
  sources: GlTimingSource[];
  quit?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function diff(a: string, b: string): { mean: number; changedShare: number } {
  const left = readBitmap(a);
  const right = readBitmap(b);
  return { mean: round2(meanAbsDiff(left, right)), changedShare: round2(changedRegion(left, right)?.share ?? 0) };
}

/** Export the first `frames` frames as H.264 on `gl`, as the app's export does (Remotion's default concurrency). */
async function timeExport(serveUrl: string, config: CompositionConfig, dir: string, gl: ProbedGl, frames: number) {
  const outputPath = path.join(dir, `export-${gl}.mp4`);
  await fs.rm(outputPath, { force: true });
  let settle: (event: RenderCompleteEvent) => void = () => {};
  const completed = new Promise<RenderCompleteEvent>((resolve) => {
    settle = resolve;
  });
  const started = Date.now();
  try {
    await renderComposition(
      { bundleUrl: serveUrl, compositionId: config.id, outputPath, codec: 'h264', width: config.width, height: config.height, fps: config.fps, durationInFrames: frames, gpuBackend: gl },
      () => {},
      settle,
    );
  } catch (err) {
    settle({ jobId: 'gl-export', success: false, error: err instanceof Error ? err.message : String(err) });
  }
  const done = await completed;
  const ms = Date.now() - started;
  return { ok: done.success, frames, ms, msPerFrame: Math.round(ms / frames), error: done.error ?? null };
}

async function timeBackend(code: string, config: CompositionConfig, dir: string, gl: ProbedGl, frames: number[], exportFrames?: number) {
  await fs.mkdir(dir, { recursive: true });
  const prepared = await prepareBuildRender(code, config, dir, { gl });
  const rendered: Array<{ frame: number; ms: number; path: string }> = [];
  for (const frame of frames) {
    const started = Date.now();
    const [still] = await renderPreparedFrames(prepared, dir, [frame], { label: gl, imageFormat: 'png' });
    rendered.push({ frame, ms: Date.now() - started, path: still.path });
  }
  const [again] = await renderPreparedFrames(prepared, path.join(dir, 'again'), [frames[0]], { label: gl, imageFormat: 'png' });
  const frameMs = rendered.map((r) => r.ms);
  const exported = exportFrames ? await timeExport(prepared.serveUrl, config, dir, gl, Math.min(exportFrames, config.durationInFrames)) : null;
  return {
    export: exported,
    bundleMs: prepared.ms.bundle,
    bundleCached: prepared.bundleCached,
    selectMs: prepared.ms.select,
    frames: rendered.map(({ frame, ms }) => ({ frame, ms })),
    meanFrameMs: Math.round(frameMs.reduce((s, ms) => s + ms, 0) / frameMs.length),
    repeatDiff: diff(rendered[0].path, again.path),
    paths: Object.fromEntries(rendered.map((r) => [r.frame, r.path])) as Record<number, string>,
  };
}

export async function glTimingProbe(outDir: string, sources: GlTimingSource[]): Promise<Record<string, unknown>> {
  const probe = await probeGlBackend();
  const backends: ProbedGl[] = probe.gl === 'swangle' ? ['swangle'] : [probe.gl, 'swangle'];
  const results: Array<Record<string, unknown>> = [];
  for (const source of sources) {
    const dir = path.join(outDir, 'gl', source.name);
    const workDir = path.join(dir, 'work');
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(workDir, { recursive: true });
    if ((await fs.stat(source.path)).isDirectory()) await fs.cp(source.path, workDir, { recursive: true });
    else await fs.copyFile(source.path, path.join(workDir, BUILD_ENTRY));
    const check = await checkBuild(workDir);
    const record: Record<string, unknown> = { name: source.name, check: { ok: check.ok, errors: check.errors, ms: check.ms, bytes: check.code?.length ?? 0 } };
    results.push(record);
    if (!check.ok || !check.code || !check.config) continue;
    const last = check.config.durationInFrames - 1;
    const frames = source.frames ?? [0, Math.floor(last / 2), last];
    const runs: Record<string, Awaited<ReturnType<typeof timeBackend>>> = {};
    try {
      for (const gl of backends) runs[gl] = await timeBackend(check.code, check.config, path.join(dir, gl), gl, frames, source.exportFrames);
    } catch (err) {
      record.error = err instanceof Error ? err.message : String(err);
    }
    record.runs = Object.fromEntries(Object.entries(runs).map(([gl, { paths: _paths, ...run }]) => [gl, run]));
    if (runs[probe.gl] && runs.swangle && probe.gl !== 'swangle') {
      record.backendDiff = frames.map((frame) => ({ frame, ...diff(runs[probe.gl].paths[frame], runs.swangle.paths[frame]) }));
      record.speedup = round2(runs.swangle.meanFrameMs / runs[probe.gl].meanFrameMs);
    }
  }
  return { mode: 'gl', probe, backends, results };
}

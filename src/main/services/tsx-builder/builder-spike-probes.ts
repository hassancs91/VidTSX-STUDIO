// Machinery probes for builder-spike.ts's fixture mode (no model): cancel
// mid-flight (P1 part 2), two bundles served at once (part 3) and the export
// path. Each returns a plain record for spike-report.json.

import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { bundleIdPrefix } from '../bundle-serve-paths';
import { bundleComposition } from '../remotion-bundler';
import { renderComposition } from '../remotion-renderer';
import { renderBuildStills } from './build-stills';
import type { CompositionConfig } from '../composition-config-parser';
import type { RenderCompleteEvent } from '../../../shared/ipc/types';

export interface ProbeFixture {
  outDir: string;
  /** The single-file artifact the rounds kept, and its config. */
  code: string;
  config: CompositionConfig;
  frames: number[];
  /** The kept code's own stills from the rounds, one per frame in order. */
  soloStills: string[];
}

async function md5File(file: string): Promise<string> {
  return createHash('md5').update(await fs.readFile(file)).digest('hex');
}

/** Per-frame byte comparison of two still sets; names the frames that differ. */
async function compareStills(got: string[], want: string[]): Promise<{ match: boolean; mismatched: string[] }> {
  const mismatched: string[] = [];
  if (got.length !== want.length) mismatched.push(`count ${got.length} vs ${want.length}`);
  for (let i = 0; i < Math.min(got.length, want.length); i++) {
    if ((await md5File(got[i])) !== (await md5File(want[i]))) mismatched.push(path.basename(got[i]));
  }
  return { match: mismatched.length === 0, mismatched };
}

/**
 * Abort stills calls mid-flight: a cold webpack bundle (the worker must die
 * and leave no bundle folder) and a renderStill on the cached bundle. Then one
 * uncancelled render: the machinery still works after a cancel.
 */
export async function cancelProbes(fx: ProbeFixture): Promise<Record<string, unknown>> {
  const dir = path.join(fx.outDir, 'stills');
  const probe = async (label: string, code: string, abortAfterMs: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), abortAfterMs);
    const started = Date.now();
    try {
      const stills = await renderBuildStills(code, fx.config, dir, fx.frames, { label, signal: controller.signal });
      return { label, abortAfterMs, completed: true, ms: Date.now() - started, rendered: stills.stills.length };
    } catch (err) {
      const ms = Date.now() - started;
      const error = err instanceof Error ? err.message : String(err);
      return { label, abortAfterMs, cancelled: controller.signal.aborted, ms, stopLagMs: ms - abortAfterMs, error };
    } finally {
      clearTimeout(timer);
    }
  };

  const coldCode = `${fx.code}\n// cancel probe ${Date.now()}\n`;
  const cold = await probe('p1-cold', coldCode, 3000);
  const hash = createHash('md5').update(coldCode).digest('hex');
  const cacheDir = path.join(app.getPath('userData'), 'bundle-cache');
  const leftoverBundles = (await fs.readdir(cacheDir).catch(() => [] as string[])).filter((n) =>
    n.startsWith(bundleIdPrefix(hash)),
  );
  const render = await probe('p2-render', fx.code, 2500);
  const afterStarted = Date.now();
  const after = await renderBuildStills(fx.code, fx.config, dir, [0], { label: 'p3-after' }).then(
    (r) => ({ ok: true, ms: Date.now() - afterStarted, bundleCached: r.bundleCached }),
    (err: unknown) => ({ ok: false, error: err instanceof Error ? err.message : String(err) }),
  );
  return { cold: { ...cold, leftoverBundles }, render, after };
}

/** A composition in the fixture's format whose frames look nothing like it: a dark card with the frame number. */
function probeComposition(config: CompositionConfig): { code: string; config: CompositionConfig } {
  const id = 'probe-b';
  const code = `import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

export const compositionConfig = {
  id: '${id}',
  width: ${config.width},
  height: ${config.height},
  fps: ${config.fps},
  durationInFrames: ${config.durationInFrames},
};

export default function ProbeB() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#14213d',
        color: '#fca311',
        fontFamily: 'sans-serif',
        fontSize: ${Math.round(config.width / 5)},
        fontWeight: 800,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      B {frame}
    </AbsoluteFill>
  );
}
`;
  return { code, config: { ...config, id } };
}

/**
 * Two different bundles in flight at once (P1 part 3). A is the fixture with
 * a comment appended (a cold bundle, pixel-identical to its solo stills); B is
 * `probeComposition`, rendered solo first, then also cold through a comment.
 * Both bundle and render concurrently, each in its own folder; every still
 * must equal its own solo render and the two serveUrls must differ. Before
 * per-path serving, the second bundle replaced the first under its Chromium.
 */
export async function concurrentProbe(fx: ProbeFixture): Promise<Record<string, unknown>> {
  const dir = path.join(fx.outDir, 'concurrent');
  const b = probeComposition(fx.config);
  const stamp = Date.now();
  const codeA = `${fx.code}\n// concurrent probe A ${stamp}\n`;
  const codeB = `${b.code}\n// concurrent probe B ${stamp}\n`;

  const soloB = await renderBuildStills(b.code, b.config, path.join(dir, 'solo-b'), fx.frames, { label: 'solo-b' });

  const timed = async (label: string, code: string, config: CompositionConfig) => {
    const startedAt = Date.now();
    const result = await renderBuildStills(code, config, path.join(dir, label), fx.frames, { label });
    return { startedAt, endedAt: Date.now(), ...result };
  };
  const [a2, b2] = await Promise.all([timed('cA', codeA, fx.config), timed('cB', codeB, b.config)]);

  const aCheck = await compareStills(a2.stills.map((s) => s.path), fx.soloStills);
  const bCheck = await compareStills(b2.stills.map((s) => s.path), soloB.stills.map((s) => s.path));
  const overlapped = a2.startedAt < b2.endedAt && b2.startedAt < a2.endedAt;
  const summary = (r: typeof a2, check: { match: boolean; mismatched: string[] }) => ({
    serveUrl: r.serveUrl,
    ms: r.ms,
    bundleCached: r.bundleCached,
    rendered: r.stills.length,
    ...check,
  });
  return {
    pass: overlapped && aCheck.match && bCheck.match && a2.serveUrl !== b2.serveUrl,
    overlapped,
    a: summary(a2, aCheck),
    b: summary(b2, bCheck),
    soloB: { serveUrl: soloB.serveUrl, ms: soloB.ms },
  };
}

/**
 * The render-handlers path (what the Creator's Render button runs, minus the
 * IPC): bundleComposition, then renderComposition on the bundle's own URL for
 * one second of H.264. Exports share the bundler, so this must keep working
 * with the bundle served under its path.
 */
export async function exportProbe(fx: ProbeFixture): Promise<Record<string, unknown>> {
  const dir = path.join(fx.outDir, 'export');
  await fs.mkdir(dir, { recursive: true });
  const entryPath = path.join(dir, 'composition.tsx');
  await fs.writeFile(entryPath, fx.code, 'utf-8');
  const started = Date.now();
  const bundle = await bundleComposition(entryPath);
  if (!bundle.success || !bundle.serveUrl) {
    return { ok: false, error: bundle.error ?? 'bundle failed', ms: Date.now() - started };
  }
  const outputPath = path.join(dir, 'probe-1s.mp4');
  await fs.rm(outputPath, { force: true });
  const frames = Math.min(fx.config.fps, fx.config.durationInFrames);

  let settle: (event: RenderCompleteEvent) => void = () => {};
  const completed = new Promise<RenderCompleteEvent>((resolve) => {
    settle = resolve;
  });
  try {
    await renderComposition(
      {
        bundleUrl: bundle.serveUrl,
        compositionId: fx.config.id,
        outputPath,
        codec: 'h264',
        width: fx.config.width,
        height: fx.config.height,
        fps: fx.config.fps,
        durationInFrames: frames,
      },
      () => {},
      settle,
    );
  } catch (err) {
    settle({ jobId: 'export-probe', success: false, error: err instanceof Error ? err.message : String(err) });
  }
  const done = await completed;
  return {
    ok: done.success,
    serveUrl: bundle.serveUrl,
    bundleCached: bundle.cached === true,
    frames,
    fileSize: done.fileSize ?? null,
    error: done.error ?? null,
    ms: Date.now() - started,
    outputPath,
  };
}

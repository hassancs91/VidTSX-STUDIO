// The Studio export path for builder shots, for builder-spike.ts (mode
// "studio-stills", P3 part 6, no model, never an MP4): `createExportEntry` of a
// Studio project, then the asset roots are forgotten and registered again from
// the entry's sidecar exactly as run-export.ts does (= an export queued before
// a restart), then the entry is bundled and rendered as PNG stills of the
// whole timeline at `frames` on the probed GL, plus one still of the shot
// layer alone (`{ layer: 'shots' }`, what the composite engine renders) with
// its alpha measured. Stills land in `<outDir>/studio-stills/`; the entry's
// bundle is released afterwards.

import fs from 'fs/promises';
import path from 'path';
import { selectComposition } from '@remotion/renderer';
import { bundleComposition, ensureAssetServerUrl, releaseBundlesUnder } from '../remotion-bundler';
import { clearAssetRoots } from '../asset-roots';
import { probeGlBackend } from '../gl-backend-probe';
import { loadProject } from '../studio/project-store';
import { createExportEntry } from '../studio/export-entry';
import { readExportContext } from '../studio/export-engines/export-context';
import { registerShotAssetRoots } from '../studio/shot-version-files';
import { getRemotionBinariesDir } from '../../utils/paths';
import { readBitmap, renderPreparedFrames, type PreparedBuild } from './build-stills';

export interface StudioStillsRequest {
  mode: 'studio-stills';
  outDir: string;
  /** A project under the profile's Studio projects root. */
  projectId: string;
  /** Timeline frames rendered whole (footage + shots). */
  frames: number[];
  /** One timeline frame of the shot layer alone, with alpha. */
  shotsFrame?: number;
  quit?: boolean;
}

/** What the generated entry's TIMELINE hands each tsx clip: shot id → its `assets` keys and URLs. */
function timelineShotFiles(entrySource: string): Record<string, Record<string, string>> {
  const line = entrySource.split('\n').find((l) => l.startsWith('const TIMELINE = '));
  if (!line) return {};
  const timeline = JSON.parse(line.slice('const TIMELINE = '.length).replace(/;\s*$/, '')) as {
    tracks: Array<{ clips: Array<{ tsx?: { shotId: string; props?: { assets?: Record<string, string> } } }> }>;
  };
  const out: Record<string, Record<string, string>> = {};
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.tsx?.props?.assets) out[clip.tsx.shotId] = clip.tsx.props.assets;
    }
  }
  return out;
}

/** Shares of fully transparent and fully opaque pixels in a BGRA bitmap. */
function alphaShares(file: string): { transparent: number; opaque: number } {
  const { data } = readBitmap(file);
  let transparent = 0;
  let opaque = 0;
  const pixels = data.length / 4;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) transparent++;
    else if (data[i] === 255) opaque++;
  }
  const share = (n: number) => Math.round((n / pixels) * 1000) / 1000;
  return { transparent: share(transparent), opaque: share(opaque) };
}

export async function studioStillsProbe(req: StudioStillsRequest): Promise<Record<string, unknown>> {
  const dir = path.join(req.outDir, 'studio-stills');
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const project = await loadProject(req.projectId);
  const started = Date.now();
  const entry = await createExportEntry(project, await ensureAssetServerUrl());
  const prepareMs = Date.now() - started;

  // A queued export after a restart: an empty registry, and only the sidecar to go on.
  clearAssetRoots();
  const context = await readExportContext(entry.entryPath);
  registerShotAssetRoots(context?.entry.assetRoots);
  const shotFiles = timelineShotFiles(await fs.readFile(entry.entryPath, 'utf-8'));

  try {
    const gl = (await probeGlBackend()).gl;
    const bundleStart = Date.now();
    const bundle = await bundleComposition(entry.entryPath);
    const bundleMs = Date.now() - bundleStart;
    if (!bundle.success || !bundle.serveUrl) {
      return { mode: 'studio-stills', entryPath: entry.entryPath, shotFiles, error: bundle.error ?? 'bundle failed' };
    }
    const serveUrl = bundle.serveUrl;
    // renderStill hands the component the props resolved at select time, so
    // the shot layer's `{ layer: 'shots' }` needs its own selection.
    const select = (inputProps: Record<string, unknown>) =>
      selectComposition({
        serveUrl,
        id: entry.compositionId,
        inputProps,
        chromiumOptions: { disableWebSecurity: true, gl },
        timeoutInMilliseconds: 120_000,
        binariesDirectory: getRemotionBinariesDir() ?? undefined,
      });
    const selectStart = Date.now();
    const composition = await select({});
    const prepared: PreparedBuild = {
      serveUrl,
      composition,
      gl,
      inputProps: {},
      bundleCached: bundle.cached === true,
      ms: { bundle: bundleMs, select: Date.now() - selectStart },
    };
    const wholeStart = Date.now();
    const whole = await renderPreparedFrames(prepared, dir, req.frames, { label: 'timeline', imageFormat: 'png' });
    const wholeMs = Date.now() - wholeStart;
    let shots: Record<string, unknown> | null = null;
    if (req.shotsFrame !== undefined) {
      const layerStart = Date.now();
      const layerProps = { layer: 'shots' };
      const layerPrepared = { ...prepared, composition: await select(layerProps), inputProps: layerProps };
      const [layer] = await renderPreparedFrames(layerPrepared, dir, [req.shotsFrame], {
        label: 'shots-layer',
        imageFormat: 'png',
      });
      shots = { frame: layer.frame, path: layer.path, ms: Date.now() - layerStart, alpha: alphaShares(layer.path) };
    }
    return {
      mode: 'studio-stills',
      projectId: req.projectId,
      entryPath: entry.entryPath,
      assetRoots: context?.entry.assetRoots ?? [],
      shotFiles,
      gl,
      ms: { prepare: prepareMs, ...prepared.ms, frames: wholeMs },
      stills: whole,
      shots,
    };
  } finally {
    await releaseBundlesUnder(path.dirname(entry.entryPath)).catch(() => 0);
  }
}

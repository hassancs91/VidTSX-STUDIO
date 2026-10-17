// The mechanical step for a shot that already HAS a folder (P3 part 8, D10): a
// package import's shots, "Convert for Studio" on a project shot, and a folder
// the reconcile scan finds. Bundle the folder's vN.tsx with the Import TSX
// bundler (shot-bundle.ts: the source's local files and the app's library set
// inline, no model, milliseconds), gate the one file, and land it as vN+1 in
// the SAME folder: the shot id, and every clip that points at it, stay. The
// untouched source is kept as original.tsx (the first one only). Media its
// staticFile() calls name are registered as project assets, as Import TSX does.
// Only when this cannot do it does a caller reach for a model (Convert).

import fs from 'fs/promises';
import path from 'path';
import type { StudioMediaAsset } from '../../../shared/types/studio';
import type { StudioShotImportReport } from '../../../shared/ipc/types';
import { writeNextVersion } from '../tsx-jobs/project-store';
import { bundleShotSource } from './shot-bundle';
import { registerBundleMedia } from './shot-bundle-media';
import { validateShotCode } from './shot-generator';
import { ORIGINAL_FILE_NAME, bundleNodePaths } from './shot-import-land';

export interface InPlaceBundleRequest {
  projectId: string;
  /** The shot's folder, `shots/<id>/`. */
  folderPath: string;
  /** The version whose `vN.tsx` is bundled. */
  version: number;
  /** That file's text, as the caller read it: kept as original.tsx. */
  source: string;
  /** Where packages resolve; the app's node_modules by default. */
  nodePaths?: string[];
}

export type InPlaceBundleOutcome =
  | {
      ok: true;
      /** The new version, `vN+1`. */
      version: number;
      code: string;
      assets: StudioMediaAsset[];
      assetRefs: Record<string, string>;
      report: StudioShotImportReport;
    }
  /** Why bundling is not the answer: the bundler's refusal or the gate's error on its output. */
  | { ok: false; reason: string };

/** Write original.tsx unless the folder already keeps one (an earlier pass's source wins). */
export async function keepOriginal(folderPath: string, source: string): Promise<void> {
  try {
    await fs.writeFile(path.join(folderPath, ORIGINAL_FILE_NAME), source, { encoding: 'utf-8', flag: 'wx' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
  }
}

export async function bundleShotInPlace(request: InPlaceBundleRequest): Promise<InPlaceBundleOutcome> {
  const versionPath = path.join(request.folderPath, `v${request.version}.tsx`);
  let bundle: Awaited<ReturnType<typeof bundleShotSource>>;
  try {
    bundle = await bundleShotSource(versionPath, { nodePaths: request.nodePaths ?? bundleNodePaths() });
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'bundling failed' };
  }
  const gate = await validateShotCode(bundle.code);
  if (!gate.success) {
    return { ok: false, reason: `the bundled file still fails the shot gate: ${gate.error ?? 'unknown error'}` };
  }

  const media = await registerBundleMedia(request.projectId, bundle);
  await keepOriginal(request.folderPath, request.source);
  const written = await writeNextVersion(request.folderPath, bundle.code);
  const version = Number(/v(\d+)\.tsx$/.exec(path.basename(written))?.[1]);
  return { ok: true, version, code: bundle.code, ...media };
}

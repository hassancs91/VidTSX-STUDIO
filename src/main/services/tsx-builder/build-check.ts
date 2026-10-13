// The builder's "compile" (TSX_BUILDER_DESIGN.md T2 `check`, T3).
//
// The builder works in a folder of files; every consumer in the app takes ONE
// file. So `check` bundles the folder's `index.tsx` mechanically — the same
// esbuild step Import TSX uses (shot-bundle.ts), which inlines local files and
// the allowed @remotion/* packages and keeps react + remotion external — and
// then runs every gate an artifact may meet on the RESULT: the transpile, the
// Studio shot lint (the strictest), the Creator import lint, and the literal
// compositionConfig parse. An artifact that passes here passes everywhere.

import fs from 'fs/promises';
import path from 'path';
import { bundleShotSource } from '../studio/shot-bundle';
import { bundleNodePaths } from '../studio/shot-import';
import { validateTsxCode } from '../../ipc/tsx-handlers';
import { lintShotSource } from '../../../shared/studio/shot-lint';
import { lintCreatorImports } from '../../../shared/tsx-engine/creator-imports';
import { parseCompositionConfig, type CompositionConfig } from '../composition-config-parser';
import { BUILD_ENTRY } from './constants';
import { formatErrors } from './build-format';
import { ASSETS_DIR, resolveBuildAssets, type BuildAsset } from './build-assets';
import type { BuildFormat } from './types';

export interface BuildCheckResult {
  ok: boolean;
  /** Verbatim, for the model to act on. */
  errors: string[];
  /** The single-file artifact, when bundling succeeded. */
  code?: string;
  config?: CompositionConfig;
  inlinedFiles: string[];
  inlinedPackages: string[];
  /** The files its staticFile() calls name, found in assets/. */
  assets: BuildAsset[];
  ms: number;
}

/** `expect`: the requested frame — a config that departs from it fails the check. */
export async function checkBuild(workDir: string, expect?: BuildFormat): Promise<BuildCheckResult> {
  const started = Date.now();
  const done = (partial: Omit<BuildCheckResult, 'ms'>): BuildCheckResult => ({
    ...partial,
    ms: Date.now() - started,
  });

  const entry = path.join(workDir, BUILD_ENTRY);
  try {
    await fs.access(entry);
  } catch {
    return done({
      ok: false,
      errors: [`${BUILD_ENTRY} is missing. It must default-export the composition and export a literal compositionConfig.`],
      inlinedFiles: [],
      inlinedPackages: [],
      assets: [],
    });
  }

  let bundled: Awaited<ReturnType<typeof bundleShotSource>>;
  try {
    bundled = await bundleShotSource(entry, { nodePaths: bundleNodePaths() });
  } catch (err) {
    return done({
      ok: false,
      errors: [err instanceof Error ? err.message : String(err)],
      inlinedFiles: [],
      inlinedPackages: [],
      assets: [],
    });
  }

  const errors: string[] = [];
  const transpile = await validateTsxCode(bundled.code);
  if (!transpile.success) errors.push(`Transpile: ${transpile.error ?? 'failed'}`);
  errors.push(...lintShotSource(bundled.code).errors);
  errors.push(...lintCreatorImports(bundled.code));
  const config = parseCompositionConfig(bundled.code) ?? undefined;
  if (!config) errors.push('compositionConfig could not be parsed after bundling.');
  if (config && expect) errors.push(...formatErrors(config, expect));
  const resolved = await resolveBuildAssets(
    path.join(workDir, ASSETS_DIR),
    bundled.media.map((m) => m.ref),
    bundled.dynamicStaticFileCalls,
  );
  errors.push(...resolved.errors);

  return done({
    ok: errors.length === 0,
    errors,
    code: bundled.code,
    ...(config ? { config } : {}),
    inlinedFiles: bundled.inlinedFiles,
    inlinedPackages: bundled.inlinedPackages,
    assets: resolved.assets,
  });
}

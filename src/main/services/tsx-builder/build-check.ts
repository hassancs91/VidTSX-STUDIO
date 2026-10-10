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

export const BUILD_ENTRY = 'index.tsx';

export interface BuildCheckResult {
  ok: boolean;
  /** Verbatim, for the model to act on. */
  errors: string[];
  /** The single-file artifact, when bundling succeeded. */
  code?: string;
  config?: CompositionConfig;
  inlinedFiles: string[];
  inlinedPackages: string[];
  ms: number;
}

export async function checkBuild(workDir: string): Promise<BuildCheckResult> {
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
    });
  }

  const errors: string[] = [];
  const transpile = await validateTsxCode(bundled.code);
  if (!transpile.success) errors.push(`Transpile: ${transpile.error ?? 'failed'}`);
  errors.push(...lintShotSource(bundled.code).errors);
  errors.push(...lintCreatorImports(bundled.code));
  const config = parseCompositionConfig(bundled.code) ?? undefined;
  if (!config) errors.push('compositionConfig could not be parsed after bundling.');
  if (bundled.media.length > 0) {
    errors.push(
      `staticFile() is not available to the builder yet (${bundled.media.map((m) => m.ref).join(', ')}). Draw it in code.`,
    );
  }

  return done({
    ok: errors.length === 0,
    errors,
    code: bundled.code,
    ...(config ? { config } : {}),
    inlinedFiles: bundled.inlinedFiles,
    inlinedPackages: bundled.inlinedPackages,
  });
}

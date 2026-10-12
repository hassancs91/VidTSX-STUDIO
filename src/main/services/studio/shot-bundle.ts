// The Import TSX bundle step (video-10 import gap 2): a real shot written
// outside Studio is rarely one file — it imports a theme, a few components, a
// helper — and the shot gate takes one file that imports react, remotion and
// the kit only. This bundles file-or-folder into one self-contained module
// MECHANICALLY (esbuild, ~50 ms), instead of asking an LLM to paraphrase it.
//
// What may be inlined: the source's own relative files, and the app's library
// set (shared/tsx-engine/builder-libraries.ts: the @remotion/* packages, d3,
// three + R3F, physics, roughjs, katex…) wherever esbuild can find them —
// beside the source file first, then in `nodePaths`. Libraries that animate on
// their own clock are refused by name with the reason.
// Anything else is refused with a message that names the package; the LLM
// "Convert for Studio" pass stays available for those.
//
// No electron in here: the caller passes the package search paths.

import path from 'path';
import fs from 'fs';
import * as esbuild from 'esbuild';
import { finishShotBundle, shotAssetKey } from './shot-bundle-finish';
import {
  BUILDER_LIBRARIES,
  bannedLibraryReason,
  isBuilderLibrary,
  packageNameOf,
} from '../../../shared/tsx-engine/builder-libraries';

/** Resolved by the shot preview and the export — never inlined. */
const EXTERNAL = /^(react|remotion|@vidtsx\/kit)$/;
const JSX_RUNTIME = /^react\/jsx-(dev-)?runtime$/;
/** What a refusal lists. Packages a shot may pull in come from the library set; their own dependencies follow freely. */
const ALLOWED_TEXT = `react, remotion, @vidtsx/kit, the @remotion/* packages, ${BUILDER_LIBRARIES.filter((l) => !l.name.startsWith('@remotion/'))
  .map((l) => (l.family ? `${l.name} (+ ${l.name}-* modules)` : l.name))
  .join(', ')}`;
/** A relative import of one of these is media or styling, not code. */
const NON_CODE = /\.(css|scss|sass|less|png|jpe?g|gif|webp|avif|svg|mp4|mov|webm|mp3|wav|woff2?|ttf|otf)$/i;

const JSX_SHIM = [
  "import React from 'react';",
  'export const Fragment = React.Fragment;',
  'export const jsx = (type, props, key) =>',
  '  React.createElement(type, key === undefined ? props : { ...props, key });',
  'export const jsxs = jsx;',
  'export const jsxDEV = jsx;',
].join('\n');

// A CommonJS dependency (use-sync-external-store under R3F, react-dom under
// @remotion/shapes) calls require('react'), and an ESM bundle cannot hand an
// external to require(). Such a call gets a small CommonJS module that takes
// the whole module object from an ESM import of the external: its default
// (react's module.exports under webpack, the virtual Proxy over the real React
// in preview), else the namespace (remotion has no default).
const CJS_EXTERNAL_NS = 'vidtsx-cjs-external';
const ESM_EXTERNAL_NS = 'vidtsx-esm-external';
const cjsExternalShim = (spec: string): string =>
  `module.exports = require(${JSON.stringify(`${ESM_EXTERNAL_NS}:${spec}`)}).default;`;
const esmExternalShim = (spec: string): string =>
  [
    `import * as ns from ${JSON.stringify(spec)};`,
    'export default ("default" in ns && ns.default) ? ns.default : ns;',
  ].join('\n');

export interface ShotBundleMedia {
  /** `assets.<key>` — what the bundled code looks up. */
  key: string;
  /** The `staticFile()` argument as written. */
  ref: string;
  /** The file on disk, or null when it was not found beside the source. */
  path: string | null;
}

export interface ShotBundleResult {
  code: string;
  /** Local files inlined, relative to the source's folder (the entry excluded). */
  inlinedFiles: string[];
  inlinedPackages: string[];
  media: ShotBundleMedia[];
  dynamicStaticFileCalls: number;
}

function isBare(spec: string): boolean {
  return !spec.startsWith('.') && !path.isAbsolute(spec) && !/^[a-zA-Z]:[\\/]/.test(spec);
}

/**
 * Where a `staticFile('a/b.png')` argument lives: a Remotion project keeps
 * media under `public/`, so look for `public/<ref>` in the source's folder
 * and each ancestor, and for `<ref>` beside the source itself.
 */
export function resolveShotMedia(sourcePath: string, ref: string): string | null {
  const clean = ref.replace(/^\/+/, '');
  const isFile = (candidate: string): boolean => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  };
  let dir = path.dirname(sourcePath);
  const beside = path.join(dir, clean);
  for (let depth = 0; depth < 8; depth++) {
    const inPublic = path.join(dir, 'public', clean);
    if (isFile(inPublic)) return inPublic;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return isFile(beside) ? beside : null;
}

function importGuard(): esbuild.Plugin {
  return {
    name: 'vidtsx-shot-import',
    setup(build) {
      build.onResolve({ filter: JSX_RUNTIME }, () => ({ path: 'jsx-shim', namespace: 'vidtsx-shim' }));
      build.onLoad({ filter: /.*/, namespace: 'vidtsx-shim' }, () => ({ contents: JSX_SHIM, loader: 'js' }));
      build.onResolve({ filter: EXTERNAL }, (args) =>
        args.kind === 'require-call'
          ? { path: args.path, namespace: CJS_EXTERNAL_NS }
          : { path: args.path, external: true },
      );
      build.onLoad({ filter: /.*/, namespace: CJS_EXTERNAL_NS }, (args) => ({ contents: cjsExternalShim(args.path), loader: 'js' }));
      build.onResolve({ filter: new RegExp(`^${ESM_EXTERNAL_NS}:`) }, (args) => ({
        path: args.path.slice(ESM_EXTERNAL_NS.length + 1),
        namespace: ESM_EXTERNAL_NS,
      }));
      build.onLoad({ filter: /.*/, namespace: ESM_EXTERNAL_NS }, (args) => ({ contents: esmExternalShim(args.path), loader: 'js' }));
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === 'entry-point' || args.namespace === 'vidtsx-shim') return null;
        if (args.namespace === CJS_EXTERNAL_NS || args.namespace === ESM_EXTERNAL_NS) return null;
        // A dependency of an allowed package resolves freely.
        if (/[\\/]node_modules[\\/]/.test(args.importer)) return null;
        if (isBare(args.path)) {
          const banned = bannedLibraryReason(args.path);
          if (banned) {
            return {
              errors: [{ text: `Package "${packageNameOf(args.path)}" is refused: ${banned}. Animate from useCurrentFrame() instead.` }],
            };
          }
          if (isBuilderLibrary(args.path)) return null;
          return {
            errors: [{ text: `Package "${packageNameOf(args.path)}" is not available to shots (allowed: ${ALLOWED_TEXT}).` }],
          };
        }
        if (NON_CODE.test(args.path)) {
          return {
            errors: [{
              text: `"${args.path}" is not code — a shot cannot import media or stylesheets. Load media with staticFile('…') (it is mapped to the assets prop on import) and use inline styles.`,
            }],
          };
        }
        return null;
      });
    },
  };
}

/** Throws an Error whose message is meant for the user. */
export async function bundleShotSource(
  sourcePath: string,
  options: { nodePaths?: string[] } = {},
): Promise<ShotBundleResult> {
  const workingDir = path.dirname(sourcePath);
  let result: esbuild.BuildResult<{ write: false; metafile: true }>;
  try {
    result = await esbuild.build({
      entryPoints: [sourcePath],
      bundle: true,
      format: 'esm',
      target: 'es2020',
      jsx: 'automatic',
      write: false,
      metafile: true,
      logLevel: 'silent',
      legalComments: 'none',
      // Dependencies pick their production builds (react-dom, zustand…) and never read `process`.
      define: { 'process.env.NODE_ENV': '"production"' },
      absWorkingDir: workingDir,
      nodePaths: options.nodePaths ?? [],
      plugins: [importGuard()],
    });
  } catch (err) {
    const failure = err as Partial<esbuild.BuildFailure>;
    const first = failure.errors?.[0];
    const where = first?.location ? ` (${path.basename(first.location.file)}:${first.location.line})` : '';
    throw new Error(first ? `${first.text}${where}` : err instanceof Error ? err.message : 'Bundling failed');
  }

  const finished = finishShotBundle(result.outputFiles[0].text);

  const inlinedFiles: string[] = [];
  const packages = new Set<string>();
  const entry = path.resolve(sourcePath);
  for (const input of Object.keys(result.metafile.inputs)) {
    if (input.includes(':') && !/^[a-zA-Z]:[\\/]/.test(input)) continue; // a plugin namespace (the jsx shim)
    const normalized = input.replace(/\\/g, '/');
    const inPackage = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(normalized);
    if (inPackage) {
      packages.add(inPackage[1]);
    } else if (path.resolve(workingDir, input) !== entry) {
      inlinedFiles.push(normalized);
    }
  }

  return {
    code: finished.code,
    inlinedFiles: inlinedFiles.sort(),
    inlinedPackages: [...packages].sort(),
    media: finished.mediaRefs.map((ref) => ({ key: shotAssetKey(ref), ref, path: resolveShotMedia(sourcePath, ref) })),
    dynamicStaticFileCalls: finished.dynamicStaticFileCalls,
  };
}

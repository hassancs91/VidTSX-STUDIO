// Pre-bundle Phase 1 vendor packages (3D stack) into resources/vendor/ so the
// app can serve them locally via the module server instead of fetching from
// esm.sh at runtime. Each bundle has react/react-dom/remotion/three/fiber
// externalized so all bundles share the same singletons.
//
// Run:  node scripts/build-vendor.mjs
// Run automatically as part of `npm run build` via the prebuild hook.

import esbuild from 'esbuild';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'resources', 'vendor');

mkdirSync(OUT_DIR, { recursive: true });

// Phase 1: the 3D stack — what drei needs to work. Order matters for the
// comment only; externals make the actual build order irrelevant.
const PACKAGES = [
  { name: 'three', out: 'three.js' },
  { name: '@react-three/fiber', out: 'react-three-fiber.js' },
  { name: '@react-three/drei', out: 'react-three-drei.js' },
  { name: '@remotion/three', out: 'remotion-three.js' },
];

// Bare specifier → absolute URL path served by our module server.
// These replace the externalized imports in the bundled output.
const EXTERNAL_MAP = {
  'react': '/virtual/react.js',
  'react-dom': '/virtual/react-dom.js',
  'react-dom/client': '/virtual/react-dom.js',
  'react/jsx-runtime': '/virtual/react.js/jsx-runtime',
  'react/jsx-dev-runtime': '/virtual/react.js/jsx-dev-runtime',
  'remotion': '/virtual/remotion.js',
  'remotion/no-react': '/virtual/remotion.js/no-react',
  'three': '/vendor/three.js',
  '@react-three/fiber': '/vendor/react-three-fiber.js',
};

// Prefix → target rewrites. Used for deep submodule imports that resolve to
// re-exports of the main entry (e.g. three/src/loaders/TextureLoader.js →
// TextureLoader is also a main export of /vendor/three.js).
const PREFIX_REWRITES = [
  { prefix: 'three/src/', target: '/vendor/three.js' },
];

// Full set of specifiers esbuild should treat as external (don't bundle).
const ALL_EXTERNALS = [
  ...Object.keys(EXTERNAL_MAP),
  // esbuild glob patterns for submodules
  'three/src/*',
  'three/examples/*',
];

/**
 * Rewrite bare-specifier imports in bundled output to absolute URL paths so
 * the browser resolves them through our module server. Handles:
 *  - exact matches from EXTERNAL_MAP (e.g. "react" → /virtual/react.js)
 *  - prefix matches from PREFIX_REWRITES (e.g. "three/src/foo" → /vendor/three.js)
 */
function rewriteExternals(code, skip) {
  // Matches quoted module specifiers in `from "..."`, `import("..."`, and
  // side-effect `import "..."`. Only the quoted specifier itself is replaced;
  // surrounding syntax (including a trailing `)` for dynamic imports) is
  // preserved by only rewriting the captured string.
  const specRegex = /(from\s*|import\s*\(\s*|import\s+)(["'])([^"']+)\2/g;
  return code.replace(specRegex, (match, prefix, _quote, spec) => {
    if (spec === skip) return match;
    if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('http')) {
      return match;
    }
    const exact = EXTERNAL_MAP[spec];
    if (exact) return `${prefix}"${exact}"`;
    for (const { prefix: p, target } of PREFIX_REWRITES) {
      if (spec.startsWith(p)) return `${prefix}"${target}"`;
    }
    return match;
  });
}

// Bundles whose __require() lookups for these packages should return the
// raw window globals (the full CJS-like module objects), NOT the ESM
// namespace from /virtual/. This matches CJS semantics — `require("react")`
// returned the full React object with every hook attached — and avoids
// having to keep the virtual module's named-exports list in lockstep with
// React's surface.
const WINDOW_GLOBAL_REQUIRES = {
  'react': 'window.__VIDTSX_REACT__',
  'react-dom': 'window.__VIDTSX_REACT_DOM__',
  'remotion': 'window.__VIDTSX_REMOTION__',
};

// Bundled packages without a window-global equivalent. For these, we still
// pre-import the ESM namespace under __EXT_* and return that for __require().
const BUNDLED_REQUIRE_CANDIDATES = {
  'three': '/vendor/three.js',
  '@react-three/fiber': '/vendor/react-three-fiber.js',
};

function safeVarName(pkg) {
  return '__EXT_' + pkg.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Build the top-of-bundle ESM imports for bundled packages (three, fiber),
 * plus a replacement __require that routes requests to either the raw
 * window global (for React/ReactDOM/Remotion) or the pre-imported namespace
 * (for three/fiber). Excludes the package being bundled.
 */
function buildRequireShim(skipPkg) {
  const bundledEntries = Object.entries(BUNDLED_REQUIRE_CANDIDATES).filter(([pkg]) => pkg !== skipPkg);
  const imports = bundledEntries
    .map(([pkg, url]) => `import * as ${safeVarName(pkg)} from "${url}";`)
    .join('\n');

  const cases = [];
  for (const [pkg, globalExpr] of Object.entries(WINDOW_GLOBAL_REQUIRES)) {
    if (pkg === skipPkg) continue;
    cases.push(`    case ${JSON.stringify(pkg)}: return ${globalExpr};`);
  }
  for (const [pkg] of bundledEntries) {
    cases.push(`    case ${JSON.stringify(pkg)}: return ${safeVarName(pkg)};`);
  }

  const requireFn =
    'var __require = (id) => {\n' +
    '  switch (id) {\n' +
    cases.join('\n') + '\n' +
    '  }\n' +
    '  throw new Error(\'Dynamic require of "\' + id + \'" is not supported\');\n' +
    '};';
  return { banner: imports, replacement: requireFn };
}

// Matches esbuild's generated __require definition so we can replace it.
// esbuild emits a `var __require = /* @__PURE__ */ ((x2) => ...)(...);` block.
const ESBUILD_REQUIRE_RE = /var __require = \/\* @__PURE__ \*\/[\s\S]*?\n}\);/;

async function bundlePackage(pkg) {
  const externals = ALL_EXTERNALS.filter((e) => e !== pkg.name);
  const shim = buildRequireShim(pkg.name);

  const result = await esbuild.build({
    entryPoints: [pkg.name],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    external: externals,
    write: false,
    resolveExtensions: ['.mjs', '.js', '.ts', '.tsx'],
    mainFields: ['module', 'main'],
    conditions: ['browser', 'import', 'default'],
    logLevel: 'warning',
    absWorkingDir: ROOT,
    legalComments: 'none',
    minify: false,
    sourcemap: false,
    banner: { js: shim.banner },
  });

  let code = result.outputFiles[0].text;
  code = rewriteExternals(code, pkg.name);

  // Replace esbuild's throw-on-require stub with our namespace-lookup version
  // when present. Bundles without CJS shims never get a __require and are fine.
  if (ESBUILD_REQUIRE_RE.test(code)) {
    code = code.replace(ESBUILD_REQUIRE_RE, shim.replacement);
  }

  const outPath = join(OUT_DIR, pkg.out);
  writeFileSync(outPath, code);
  const kb = (code.length / 1024).toFixed(1);
  console.log(`  ${pkg.name.padEnd(32)} → ${pkg.out.padEnd(32)} ${kb.padStart(8)} KB`);
}

/**
 * Bundle the preview runtime: React + ReactDOM + Remotion + @remotion/player
 * into a single self-contained ESM file. No externals — everything is included
 * so all modules share the same instances (avoids the "push" error from
 * mismatched Remotion internals).
 */
async function bundlePreviewRuntime() {
  const entryCode = `
    export * as React from 'react';
    export * as ReactDOM from 'react-dom';
    export { createRoot } from 'react-dom/client';
    export * as jsxRuntime from 'react/jsx-runtime';
    export * as Remotion from 'remotion';
    export * as RemotionNoReact from 'remotion/no-react';
    export { Player } from '@remotion/player';
  `;

  const result = await esbuild.build({
    stdin: {
      contents: entryCode,
      resolveDir: ROOT,
      loader: 'js',
    },
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    write: false,
    resolveExtensions: ['.mjs', '.js', '.ts', '.tsx'],
    mainFields: ['module', 'main'],
    conditions: ['browser', 'import', 'default'],
    logLevel: 'warning',
    absWorkingDir: ROOT,
    legalComments: 'none',
    minify: false,
    sourcemap: false,
    // No externals — bundle everything together for shared instances
  });

  const code = result.outputFiles[0].text;
  const outPath = join(OUT_DIR, 'preview-runtime.js');
  writeFileSync(outPath, code);
  const kb = (code.length / 1024).toFixed(1);
  console.log(`  preview-runtime                 → preview-runtime.js              ${kb.padStart(8)} KB`);
}

console.log('Bundling vendor packages to resources/vendor/ ...');
const t0 = Date.now();
for (const pkg of PACKAGES) {
  try {
    await bundlePackage(pkg);
  } catch (e) {
    console.error(`FAILED: ${pkg.name}\n`, e);
    process.exit(1);
  }
}

// Preview runtime (React + Remotion + Player in one bundle)
try {
  await bundlePreviewRuntime();
} catch (e) {
  console.error('FAILED: preview-runtime\n', e);
  process.exit(1);
}

console.log(`Done in ${Date.now() - t0}ms`);

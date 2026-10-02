// The second half of the Import TSX bundle step (video-10 import gap 2):
// turn an esbuild ESM bundle into source the shot gate accepts and the
// `assets` prop can feed. Pure text work, no esbuild and no electron, so it
// is tested on its own. Proven on video-10's 62 shots by the prototype this
// was ported from (`notes/import/build-video10.mjs` in that project).
//
// Three transformations:
//   1. compositionConfig becomes a LITERAL export (the gate parses it
//      statically); the original object stays as a local for inner code.
//   2. `staticFile('x')` becomes a lookup in the `assets` prop — a shot must
//      never carry a file path — and every literal argument is reported so
//      the importer can register the file as a project asset.
//   3. Everything but the imports moves into a lazily-run body, so
//      module-scope media lookups (top-level constants are the norm in shots
//      written outside Studio) see the `assets` prop; the body runs again
//      whenever that prop changes.

import { parseCompositionConfig } from '../composition-config-parser';

/** One rule for an asset key, at bundle time and at run time: the path
 *  without leading slashes or extension, non-identifier characters as `_`. */
export function shotAssetKey(ref: string): string {
  return ref
    .replace(/^\/+/, '')
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/[^a-zA-Z0-9_$]/g, '_');
}

export interface FinishedShotBundle {
  code: string;
  /** Literal `staticFile()` arguments, deduped, in first-seen order. */
  mediaRefs: string[];
  /** `staticFile()` calls whose argument is not a plain string literal — they
   *  resolve to '' at run time unless the key happens to be registered. */
  dynamicStaticFileCalls: number;
}

const RUNTIME_PRELUDE = [
  '// Imported into VidTSX Studio: bundled to one file. Media resolves through the',
  '// `assets` prop (shot.assetRefs), never a file path. The source is kept as original.tsx.',
  'import { createElement as __vidtsxCreateElement } from "react";',
  'let __vidtsxAssets = {};',
  'const __vidtsxAssetKey = (p) => String(p).replace(/^\\/+/, "").replace(/\\.[a-zA-Z0-9]+$/, "").replace(/[^a-zA-Z0-9_$]/g, "_");',
  'const __vidtsxAsset = (p) => { const k = __vidtsxAssetKey(p); return Object.prototype.hasOwnProperty.call(__vidtsxAssets, k) ? __vidtsxAssets[k] : ""; };',
].join('\n');

const TRAILING_EXPORT = /export\s*\{([^}]*)\}\s*;?\s*$/;

/** esbuild ends an ESM bundle with `export { X as default, compositionConfig };`.
 *  Make both explicit: `export default X;` and `export const compositionConfig`. */
function normaliseExports(code: string): string {
  let hoistConfig = false;
  let out = code.replace(TRAILING_EXPORT, (_m, inner: string) => {
    const parts = inner.split(',').map((x) => x.trim()).filter(Boolean);
    const def = parts.find((x) => /\bas default$/.test(x));
    const name = def ? def.replace(/\s+as default$/, '') : null;
    const rest = parts.filter((x) => x !== def && x !== 'compositionConfig');
    hoistConfig = parts.includes('compositionConfig');
    const named = rest.length ? `export { ${rest.join(', ')} };\n` : '';
    return named + (name ? `export default ${name};\n` : '');
  });
  if (hoistConfig) out = out.replace(/^var compositionConfig = /m, 'export const compositionConfig = ');
  return out;
}

/** Throws with a message meant for the user when the bundle cannot become a shot. */
export function finishShotBundle(bundled: string): FinishedShotBundle {
  let code = normaliseExports(bundled);

  const configStatement = /export const compositionConfig = (\{[\s\S]*?\});/.exec(code);
  const config = parseCompositionConfig(code);
  if (!configStatement || !config) {
    throw new Error(
      'compositionConfig was not found, or is not a plain object of literal numbers — the bundle step cannot evaluate expressions.',
    );
  }
  code = code.replace(configStatement[0], `var compositionConfig = ${configStatement[1]};`);
  const configLiteral = `export const compositionConfig = { id: ${JSON.stringify(config.id)}, durationInFrames: ${config.durationInFrames}, fps: ${config.fps}, width: ${config.width}, height: ${config.height} };`;

  const totalCalls = (code.match(/\bstaticFile\d*\(/g) ?? []).length;
  const mediaRefs: string[] = [];
  let literalCalls = 0;
  for (const match of code.matchAll(/\bstaticFile\d*\(\s*(["'`])([^"'`$\\]+)\1\s*\)/g)) {
    literalCalls += 1;
    if (!mediaRefs.includes(match[2])) mediaRefs.push(match[2]);
  }
  code = code.replace(/\bstaticFile\d*\(/g, '__vidtsxAsset(');

  const defaultExport = /^export default (\w+);\s*$/m.exec(code);
  if (!defaultExport) {
    throw new Error('The composition has no default export — a shot must default-export its component.');
  }
  const importRe = /^import\s[\s\S]*?from\s*"[^"]+";?[ \t]*$/gm;
  const imports = code.match(importRe) ?? [];
  const body = code
    .replace(importRe, '')
    .replace(defaultExport[0], '')
    .replace(/^export \{[^}]*\};?\s*$/gm, '');
  if (/^\s*export\s/m.test(body)) {
    throw new Error('The bundle still has an export the import step does not understand — this file needs a manual edit.');
  }

  return {
    code: [
      RUNTIME_PRELUDE,
      ...imports,
      configLiteral,
      'let __vidtsxInner = null;',
      'let __vidtsxInnerAssets = null;',
      'function __vidtsxInit() {',
      body.trim(),
      `  return ${defaultExport[1]};`,
      '}',
      // Module-scope lookups are frozen by the run that made them, so a changed
      // `assets` (a swap in the shot inspector's Media section) runs the body again.
      'const __vidtsxShot = (props) => {',
      '  __vidtsxAssets = (props && props.assets) || {};',
      '  const assetsKey = JSON.stringify(__vidtsxAssets);',
      '  if (!__vidtsxInner || assetsKey !== __vidtsxInnerAssets) {',
      '    __vidtsxInner = __vidtsxInit();',
      '    __vidtsxInnerAssets = assetsKey;',
      '  }',
      '  return __vidtsxCreateElement(__vidtsxInner, props);',
      '};',
      'export default __vidtsxShot;',
      '',
    ].join('\n'),
    mediaRefs,
    dynamicStaticFileCalls: totalCalls - literalCalls,
  };
}

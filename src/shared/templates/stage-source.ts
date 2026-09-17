// The two rewrites a template's source gets when it is STAGED into its working
// copy (docs/templates-plan.md §4). PURE — the fs half is
// `main/services/templates/template-stage.ts`.
//
// Preview and render both load the staged file, so what is previewed is
// byte-for-byte what renders. Both rewrites exist because a job's options
// cannot do the work:
//
// 1. CANVAS. The render handler takes width/height from the bundle's
//    `<Composition>`, which the wrapper builds from the file's own
//    `compositionConfig`; a job's width/height is only a fallback. So a format
//    is applied by rewriting the literal. The template contract already
//    requires that literal to be plain ("the app parses it textually"), which
//    is what makes a textual rewrite safe.
//
// 2. ASSETS. A form hands the composition a path as a PROP. The preview's
//    virtual `staticFile` accepts any path, the real one at render refuses an
//    absolute path, and `remotion-static-files.ts` only rewrites string
//    LITERALS. The preview page and the render bundle are both served by a
//    local server with an `/asset?path=` route, so one origin-relative helper
//    is right in both; a relative path resolves against the working copy.

/** Same shape `composition-config-parser.ts` reads, so the two always agree. */
const CONFIG_BLOCK = /(export\s+const\s+compositionConfig\s*=\s*)(\{[\s\S]*?\})(\s*(?:as\s+const|satisfies\s+[^;]+)?\s*;)/;

function setNumericKey(literal: string, key: string, value: number): string {
  const pattern = `\\b${key}\\s*:\\s*-?[\\d._]+`;
  if (new RegExp(pattern).test(literal)) {
    // Every occurrence: one inside a comment is harmless to rewrite, and
    // picking "the real one" would need a parser.
    return literal.replace(new RegExp(pattern, 'g'), `${key}: ${value}`);
  }
  const inner = literal.slice(1, -1).replace(/[\s,]+$/, '');
  return inner.trim() === '' ? `{ ${key}: ${value} }` : `{${inner}, ${key}: ${value} }`;
}

/**
 * The source with `compositionConfig.width/height` set, or null when the file
 * has no plain `compositionConfig` literal to rewrite.
 */
export function applyCanvasToConfig(source: string, canvas: { width: number; height: number }): string | null {
  const match = CONFIG_BLOCK.exec(source);
  if (!match) return null;
  const literal = setNumericKey(setNumericKey(match[2], 'width', canvas.width), 'height', canvas.height);
  return source.slice(0, match.index) + match[1] + literal + match[3] + source.slice(match.index + match[0].length);
}

export const ASSET_HELPER_NAME = '__vidtsxAsset';

/** A bare `staticFile(` call — not `x.staticFile(`, not the import specifier. */
const STATIC_FILE_CALL = /(?<![.\w$])staticFile\s*\(/g;

function assetHelper(assetDir: string): string {
  return [
    '',
    '// Added when this template was staged — see shared/templates/stage-source.ts.',
    `function ${ASSET_HELPER_NAME}(p: string): string {`,
    '  if (/^(?:https?:|data:|blob:)/i.test(p)) return p;',
    `  const abs = /^(?:[A-Za-z]:[\\\\/]|\\/|\\\\\\\\)/.test(p) ? p : ${JSON.stringify(assetDir)} + '/' + p.replace(/^\\.\\//, '');`,
    "  return window.location.origin + '/asset?path=' + encodeURIComponent(abs);",
    '}',
    '',
  ].join('\n');
}

/**
 * Route every `staticFile(...)` call through the local asset route. The helper
 * is APPENDED as a hoisted function declaration, so every original line keeps
 * its number and a transpile error still points at the author's line.
 *
 * @param assetDir absolute folder relative paths resolve against, forward slashes.
 */
export function rewriteStaticFiles(source: string, assetDir: string): string {
  STATIC_FILE_CALL.lastIndex = 0;
  if (!STATIC_FILE_CALL.test(source)) return source;
  STATIC_FILE_CALL.lastIndex = 0;
  const body = source.replace(STATIC_FILE_CALL, `${ASSET_HELPER_NAME}(`);
  return (body.endsWith('\n') ? body : `${body}\n`) + assetHelper(assetDir.replace(/\\/g, '/').replace(/\/$/, ''));
}

/** Both rewrites; null when the canvas cannot be applied. */
export function stageTemplateSource(
  source: string,
  options: { canvas: { width: number; height: number } | null; assetDir: string },
): string | null {
  const sized = options.canvas ? applyCanvasToConfig(source, options.canvas) : source;
  return sized === null ? null : rewriteStaticFiles(sized, options.assetDir);
}

// The pure half of the filter gate (docs/studio/FILTER_PACKS_DESIGN.md
// "Pack container and loader" → Gate). A pack filter is a bundled module that
// runs in the renderer, so the rules are the add-ons' AUTHORING contract made
// enforceable: one self-contained file, a default export, no wall clock, no
// randomness, no network. Textual and heuristic, like the shot lint — the
// trust model is unchanged (install is the act of trust); this catches the
// honest mistakes. The esbuild compile and the size cap run in main.

import { collectImportSpecifiers, type ShotLintResult } from './shot-lint';

/** A bundled filter is a few KB; anything near this is not a filter. */
export const FILTER_SOURCE_MAX_BYTES = 512 * 1024;

/** `export default x` or esbuild's `export { x as default }`. */
const DEFAULT_EXPORT_PATTERN = /export\s+default\s|export\s*\{[^}]*\bas\s+default\b[^}]*\}/;

/** What a deterministic, offline effect has no business calling. */
const BANNED: readonly [RegExp, string][] = [
  [/\bDate\.now\s*\(/, 'Date.now()'],
  [/\bnew\s+Date\s*\(\s*\)/, 'new Date()'],
  [/\bperformance\.now\s*\(/, 'performance.now()'],
  [/\bMath\.random\s*\(/, 'Math.random()'],
  [/\bfetch\s*\(/, 'fetch()'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\bnavigator\./, 'navigator'],
  [/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/, 'browser storage'],
  [/\bdocument\.cookie\b/, 'document.cookie'],
  [/\bnew\s+Worker\s*\(|\bimportScripts\s*\(/, 'workers'],
  [/\beval\s*\(|\bnew\s+Function\s*\(/, 'eval / new Function'],
];

/**
 * Rules: no imports of any kind (a bundle needs none — `react` and `remotion`
 * included), a default export, none of the banned globals, under the size cap.
 */
export function lintFilterSource(code: string): ShotLintResult {
  const errors: string[] = [];
  const bytes = new TextEncoder().encode(code).length;
  if (bytes > FILTER_SOURCE_MAX_BYTES) {
    errors.push(`The filter is ${Math.round(bytes / 1024)} KB; a bundled filter may be at most ${FILTER_SOURCE_MAX_BYTES / 1024} KB.`);
  }
  for (const spec of collectImportSpecifiers(code)) {
    errors.push(`Import "${spec}" is not allowed: filters are bundled single files with no imports at all.`);
  }
  if (!DEFAULT_EXPORT_PATTERN.test(code)) {
    errors.push('The filter must have a default export (its FilterDefinition).');
  }
  for (const [pattern, what] of BANNED) {
    if (pattern.test(code)) errors.push(`The filter uses ${what}: filters are pure functions of the frame and its time.`);
  }
  return { ok: errors.length === 0, errors };
}

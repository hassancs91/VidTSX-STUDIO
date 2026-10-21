// Import/single-file lint for generated TSX shots (TSX_SHOTS_DESIGN.md D6/D8).
//
// Shots may import `react`, `remotion`, and `@vidtsx/kit` ONLY, from a single
// file. This is what closes the preview/render gap (the preview can pull
// anything from esm.sh; the render bundle resolves only what is installed —
// the kit is served virtually in preview and copied+pinned at export,
// SHOT_QUALITY_DESIGN Q4) and what makes the export pre-flight's copy step
// safe (no relative imports to break). The lint runs inside the generation
// acceptance gate, so a violation is a fix-loop error the pipeline repairs —
// never a latent export failure.

const ALLOWED_IMPORTS: ReadonlySet<string> = new Set(['react', 'remotion', '@vidtsx/kit']);

/**
 * remotion's own entry points besides the root (its package `exports`). A
 * bundled shot keeps them external (END_TO_END_PLAN T7): `@remotion/google-fonts`
 * imports `remotion/no-react`, and an inlined copy of it resets
 * `window.remotion_delayRenderHandles` mid-render, orphaning every hold. The
 * preview serves both from the Player's copy; the export's webpack aliases both
 * to the app's one copy.
 */
export const REMOTION_SUBPATHS: readonly string[] = ['remotion/no-react', 'remotion/version'];

/** What a shot may import: the three shared modules and remotion's own subpaths. */
export function isShotModuleSpecifier(spec: string): boolean {
  return ALLOWED_IMPORTS.has(spec) || REMOTION_SUBPATHS.includes(spec);
}

/** Static `import ... from 'x'` / bare `import 'x'` / `export ... from 'x'`. */
const STATIC_IMPORT_PATTERN =
  /(?:^|\n)\s*(?:import|export)\s+(?:[^'"\n]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
/** Dynamic `import('x')` and CommonJS `require('x')`. */
const DYNAMIC_IMPORT_PATTERN = /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * True when `index` sits inside a string literal or a // comment that opened
 * earlier on the same line. A bundled library can mention `require("fs")` in a
 * message (opentype.js does, in a deprecation warning); that is text, not an
 * import. One line only, and a regex literal holding a quote earlier on the
 * line can fool it (a multi-line template literal is not tracked either).
 */
function inStringOnLine(code: string, index: number): boolean {
  const lineStart = code.lastIndexOf('\n', index - 1) + 1;
  let quote: string | null = null;
  for (let i = lineStart; i < index; i++) {
    const c = code[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
    } else if (c === '/' && code[i + 1] === '/') {
      return true;
    }
  }
  return quote !== null;
}

/** Every module specifier the source references, static or dynamic. */
export function collectImportSpecifiers(code: string): string[] {
  const specifiers: string[] = [];
  STATIC_IMPORT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STATIC_IMPORT_PATTERN.exec(code)) !== null) specifiers.push(match[1]);
  DYNAMIC_IMPORT_PATTERN.lastIndex = 0;
  while ((match = DYNAMIC_IMPORT_PATTERN.exec(code)) !== null) {
    if (!inStringOnLine(code, match.index)) specifiers.push(match[1]);
  }
  return specifiers;
}

export interface ShotLintResult {
  ok: boolean;
  errors: string[];
}

/**
 * The pure half of the shot acceptance gate (the other checks — esbuild
 * transpile and compositionConfig parse — live in main). Rules:
 *   - imports restricted to `react` + `remotion` + `@vidtsx/kit` (no subpaths
 *     except remotion's own `remotion/no-react` and `remotion/version`)
 *   - single file: no relative or absolute import paths
 *   - must default-export the component
 *   - must export `const compositionConfig = { ... }` (parsed in main; the
 *     parser's silent 300-frame fallback is exactly what this gate prevents)
 */
export interface ShotLintOptions {
  /** Caption templates (D13) are overlays spanning the timeline, not standalone
   *  compositions — they have no length/size of their own to declare, so the
   *  config requirement is lifted for them. Every other rule still applies:
   *  single file, react+remotion only, default export. */
  requireCompositionConfig?: boolean;
}

export function lintShotSource(code: string, options: ShotLintOptions = {}): ShotLintResult {
  const errors: string[] = [];

  for (const spec of collectImportSpecifiers(code)) {
    if (spec.startsWith('.') || spec.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(spec)) {
      errors.push(
        `Import "${spec}" is not allowed: shots are single-file — inline everything, no relative imports.`,
      );
    } else if (!isShotModuleSpecifier(spec)) {
      errors.push(
        `Import "${spec}" is not allowed: shots may only import from 'react', 'remotion', and '@vidtsx/kit' (plus remotion's own ${REMOTION_SUBPATHS.map((s) => `'${s}'`).join(' and ')}).`,
      );
    }
  }

  if (!/export\s+default\s/.test(code)) {
    errors.push('The shot must have a default export (the composition component).');
  }

  if (
    options.requireCompositionConfig !== false &&
    !/export\s+const\s+compositionConfig\s*=/.test(code)
  ) {
    errors.push(
      'The shot must export `const compositionConfig = { ... }` with literal values.',
    );
  }

  return { ok: errors.length === 0, errors };
}

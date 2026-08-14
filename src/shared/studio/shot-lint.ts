// Import/single-file lint for generated TSX shots (TSX_SHOTS_DESIGN.md D6/D8).
//
// v1 shots may import `react` and `remotion` ONLY, from a single file. This is
// what closes the preview/render gap (the preview can pull anything from
// esm.sh; the render bundle resolves only what is installed) and what makes
// the export pre-flight's copy step safe (no relative imports to break).
// The lint runs inside the generation acceptance gate, so a violation is a
// fix-loop error the pipeline repairs — never a latent export failure.

const ALLOWED_IMPORTS: ReadonlySet<string> = new Set(['react', 'remotion']);

/** Static `import ... from 'x'` / bare `import 'x'` / `export ... from 'x'`. */
const STATIC_IMPORT_PATTERN =
  /(?:^|\n)\s*(?:import|export)\s+(?:[^'"\n]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
/** Dynamic `import('x')` and CommonJS `require('x')`. */
const DYNAMIC_IMPORT_PATTERN = /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Every module specifier the source references, static or dynamic. */
export function collectImportSpecifiers(code: string): string[] {
  const specifiers: string[] = [];
  for (const pattern of [STATIC_IMPORT_PATTERN, DYNAMIC_IMPORT_PATTERN]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) specifiers.push(match[1]);
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
 *   - imports restricted to `react` + `remotion` (no subpaths, no packages)
 *   - single file: no relative or absolute import paths
 *   - must default-export the component
 *   - must export `const compositionConfig = { ... }` (parsed in main; the
 *     parser's silent 300-frame fallback is exactly what this gate prevents)
 */
export function lintShotSource(code: string): ShotLintResult {
  const errors: string[] = [];

  for (const spec of collectImportSpecifiers(code)) {
    if (spec.startsWith('.') || spec.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(spec)) {
      errors.push(
        `Import "${spec}" is not allowed: shots are single-file — inline everything, no relative imports.`,
      );
    } else if (!ALLOWED_IMPORTS.has(spec)) {
      errors.push(
        `Import "${spec}" is not allowed: shots may only import from 'react' and 'remotion'.`,
      );
    }
  }

  if (!/export\s+default\s/.test(code)) {
    errors.push('The shot must have a default export (the composition component).');
  }

  if (!/export\s+const\s+compositionConfig\s*=/.test(code)) {
    errors.push(
      'The shot must export `const compositionConfig = { ... }` with literal values.',
    );
  }

  return { ok: errors.length === 0, errors };
}

// Rewrite module specifiers in transpiled ESM by PARSING the module, not by
// searching its text. `es-module-lexer` (the parser Vite uses for the same job)
// returns the exact character range of every import / re-export / dynamic
// import specifier and ignores strings, comments and template literals — so a
// shot whose code merely contains the text `from "..."` (a syntax highlighter,
// a caption, a comment) is left untouched. The regex approach this replaces
// corrupted exactly such a shot (video-10 B3IntoCode, 2026-09-12).

import { init, parse } from 'es-module-lexer';

export interface SpecifierRewrite {
  /** The replacement specifier (typically a URL). */
  specifier: string;
  /**
   * Turn `import X from '<pkg>'` into `import * as X from '<url>'` — for
   * packages the CDN serves without a default export (pure ESM `export *`).
   */
  namespaceDefaultImport?: boolean;
}

/** Decide what a specifier becomes; `null` leaves it exactly as written. */
export type SpecifierResolver = (specifier: string) => SpecifierRewrite | null;

const DEFAULT_IMPORT_HEAD = /^(import\s+)([A-Za-z_$][\w$]*)(\s+from\s*)$/;

/**
 * Replace the specifier of every static import, `export … from` and
 * string-literal dynamic `import()` in `code` according to `resolve`.
 * Relative paths, URLs, `import.meta` and non-literal dynamic imports are never
 * touched (the resolver is simply not asked for them where the lexer cannot
 * name them; for relative/URL specifiers the resolver is expected to return
 * `null`). Edits are applied back to front so earlier offsets stay valid.
 */
export async function rewriteModuleSpecifiers(
  code: string,
  resolve: SpecifierResolver,
): Promise<string> {
  await init;
  const [imports] = parse(code);
  let out = code;
  // Reverse order: splicing near the end never moves an earlier range.
  for (let i = imports.length - 1; i >= 0; i--) {
    const imp = imports[i];
    if (imp.d === -2) continue; // import.meta
    if (imp.n === undefined) continue; // dynamic import with a non-literal arg
    const rewrite = resolve(imp.n);
    if (!rewrite) continue;

    if (imp.d >= 0) {
      // Dynamic import: [s, e) spans the literal INCLUDING its quotes.
      out = out.slice(0, imp.s) + JSON.stringify(rewrite.specifier) + out.slice(imp.e);
      continue;
    }

    // Static import / re-export: [s, e) is the specifier text inside the quotes.
    let replaced = out.slice(0, imp.s) + rewrite.specifier + out.slice(imp.e);
    if (rewrite.namespaceDefaultImport) {
      const head = out.slice(imp.ss, imp.s - 1); // statement start → opening quote
      const m = DEFAULT_IMPORT_HEAD.exec(head);
      if (m) {
        const newHead = `${m[1]}* as ${m[2]}${m[3]}`;
        replaced = replaced.slice(0, imp.ss) + newHead + replaced.slice(imp.s - 1);
      }
    }
    out = replaced;
  }
  return out;
}

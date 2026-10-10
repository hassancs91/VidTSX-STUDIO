// What a TSX Creator composition may import (T9 items 3 + 4, TSX_BUILDER_DESIGN.md).
//
// The Creator previews through the module server (vendored three family, esm.sh
// for the rest) and renders through bundleComposition, which resolves bare
// imports from the app's installed dependencies. A package outside this list
// either needs the network to preview or does not exist in an installed app,
// so it used to pass generation and fail at render. This is the single list the
// Creator gate enforces and the prompts' "Allowed imports" sections promise
// (a test keeps them in step).
//
// `@vidtsx/kit` is deliberately absent: the Creator render path has no alias
// for it. 2D and 3D share one list because the pipeline picks the mode itself.

import { collectImportSpecifiers } from '../studio/shot-lint';

export const CREATOR_IMPORT_PACKAGES: readonly string[] = [
  'react',
  'remotion',
  'chroma-js',
  'tone',
  '@remotion/paths',
  '@remotion/shapes',
  '@remotion/transitions',
  '@remotion/google-fonts',
  '@remotion/media-utils',
  // 3D mode
  'three',
  '@react-three/fiber',
  '@react-three/drei',
  '@remotion/three',
];

function isRelativeOrAbsolute(spec: string): boolean {
  return spec.startsWith('.') || spec.startsWith('/') || /^[a-zA-Z]:[\/]/.test(spec);
}

/** Subpaths count: `@remotion/transitions/slide`, `@remotion/google-fonts/Inter`. */
export function isCreatorImport(spec: string): boolean {
  return CREATOR_IMPORT_PACKAGES.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`));
}

/** Gate errors for a Creator composition's imports; empty when all are fine. */
export function lintCreatorImports(code: string): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const spec of collectImportSpecifiers(code)) {
    if (seen.has(spec)) continue;
    seen.add(spec);
    if (isRelativeOrAbsolute(spec)) {
      errors.push(`Import "${spec}" is not allowed: the composition is a single file — inline everything, no relative imports.`);
    } else if (!isCreatorImport(spec)) {
      errors.push(
        `Import "${spec}" is not available: it is not installed for rendering. Allowed: ${CREATOR_IMPORT_PACKAGES.join(', ')}. Inline what you need instead.`,
      );
    }
  }
  return errors;
}

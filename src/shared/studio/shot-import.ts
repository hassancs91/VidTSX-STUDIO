// The pure half of TSX import (TSX_SHOTS_DESIGN.md §D14 + PACKS_DESIGN.md
// "tsx-template"): what a source file's imports mean for the shot acceptance
// gate, and how a source PATH becomes a shot NAME.
//
// Nothing here knows where the file came from. "Import a TSX from anywhere" is
// the load-bearing constraint: the Creator is one source, an OS file picker is
// another, and a purchasable tsx-template pack is the next one — they differ
// only in how a caller finds the file and names it.
//
// The allowlist gap (D14): Creator 2d comps may import chroma-js,
// @remotion/shapes|paths|transitions, @remotion/google-fonts and tone. They
// RENDER fine (all installed), but the Studio shot preview resolves react +
// remotion only (decision #5), so those files fail the same gate generated
// shots pass. That failure is recoverable — one editTsxPipeline conform pass
// inlines them — which is exactly the distinction `classifyShotImport` draws.

import { collectImportSpecifiers, lintShotSource } from './shot-lint';

/** Out-of-allowlist packages a conform pass can realistically inline. */
const CONFORMABLE_MODULES: readonly string[] = [
  'chroma-js',
  '@remotion/shapes',
  '@remotion/paths',
  '@remotion/transitions',
  '@remotion/google-fonts',
  'tone',
];

/** What the shot preview resolves natively — never needs conforming. */
const SHOT_MODULES: ReadonlySet<string> = new Set(['react', 'remotion', '@vidtsx/kit']);

/** Subpaths count: `@remotion/google-fonts/Inter`, `@remotion/transitions/slide`. */
export function isConformableModule(specifier: string): boolean {
  return CONFORMABLE_MODULES.some(
    (mod) => specifier === mod || specifier.startsWith(`${mod}/`),
  );
}

export interface ShotImportClassification {
  /** Out-of-allowlist specifiers a conform pass would inline, de-duplicated. */
  conformable: string[];
  /** Imports no conform pass can fix: relative/absolute paths (the file is
   *  copied alone) and packages outside the known Creator 2d set. */
  blocking: string[];
  /** Non-import gate complaints (missing default export / compositionConfig).
   *  A conform pass is not the answer to those either. */
  otherErrors: string[];
  /** True when the ONLY thing wrong is the allowlist gap — the one case where
   *  "Convert for Studio" is worth an LLM run. */
  canConform: boolean;
}

/**
 * Why a source file fails the shot gate, sorted into "conversion fixes this"
 * and "conversion won't". Callers run the real gate for the verdict; this
 * decides which error the user sees and whether Convert is offered.
 */
export function classifyShotImport(code: string): ShotImportClassification {
  const conformable = new Set<string>();
  const blocking = new Set<string>();

  for (const spec of collectImportSpecifiers(code)) {
    if (SHOT_MODULES.has(spec)) continue;
    if (spec.startsWith('.') || spec.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(spec)) {
      blocking.add(spec);
    } else if (isConformableModule(spec)) {
      conformable.add(spec);
    } else {
      blocking.add(spec);
    }
  }

  // Import complaints are re-derived above; the rest of the lint (default
  // export, compositionConfig) is what's left. Imports still need the config —
  // an imported shot is a standalone composition, so D13's opt-out never
  // applies here.
  const otherErrors = lintShotSource(code).errors.filter((e) => !e.startsWith('Import "'));

  return {
    conformable: [...conformable],
    blocking: [...blocking],
    otherErrors,
    canConform: conformable.size > 0 && blocking.size === 0 && otherErrors.length === 0,
  };
}

/** The pointed error a rejected import shows, tuned to WHY it failed. */
export function describeImportFailure(
  classification: ShotImportClassification,
  gateError: string,
): string {
  const { conformable, blocking, otherErrors } = classification;
  if (classification.canConform) {
    return `This composition imports ${conformable.join(', ')}, which the shot preview can't resolve (shots run on react + remotion only). "Convert for Studio" rewrites it in one pass — the original is kept alongside.`;
  }
  const parts: string[] = [];
  if (blocking.length > 0) {
    parts.push(
      `It imports ${blocking.join(', ')} — shots are single-file and can't pull in local files or unknown packages, so this needs a manual edit.`,
    );
  }
  if (conformable.length > 0 && blocking.length > 0) {
    parts.push(`(${conformable.join(', ')} could be converted, but not alongside the above.)`);
  }
  parts.push(...otherErrors);
  return parts.length > 0 ? parts.join(' ') : gateError;
}

/** The one conform instruction (D14): rewrite to the shot import surface. */
export function buildConformInstruction(modules: readonly string[]): string {
  return [
    `Rewrite this composition so it imports ONLY from 'react' and 'remotion'.`,
    `Remove these imports and inline equivalent code: ${modules.join(', ')}.`,
    `- @remotion/shapes / @remotion/paths: replace the components with plain inline <svg> paths or CSS shapes that look the same.`,
    `- @remotion/google-fonts: drop the font loader and set fontFamily to a stack that starts with the same font name, e.g. fontFamily: '"Inter", system-ui, sans-serif'.`,
    `- chroma-js: replace colour maths with literal colour values or small inline helpers.`,
    `- @remotion/transitions: implement the transition with interpolate()/spring() and inline styles.`,
    `- tone: remove audio synthesis entirely; a shot is visual-only.`,
    `Keep the visual result as close to the original as possible, keep it a single file with a default export, and keep the exported compositionConfig exactly as it is.`,
  ].join('\n');
}

/** What the mechanical bundle step did to a source on the way in (video-10
 *  import gaps 2 and 3). Absent on an import that needed no bundling. */
export interface ShotImportReport {
  /** Local files inlined into the one shot file. */
  inlinedFiles: number;
  /** Packages inlined (Studio's own: lucide-react, chroma-js, @remotion/*). */
  inlinedPackages: string[];
  /** Media files registered as project assets and attached to the shot. */
  media: number;
  /** `staticFile()` arguments whose file was not found beside the source. */
  missingMedia: string[];
  /** `staticFile()` calls with a computed argument — they resolve to nothing. */
  dynamicMediaCalls: number;
}

/** One or two plain sentences for the import panel. */
export function describeImportReport(report: ShotImportReport): string {
  const inlined: string[] = [];
  if (report.inlinedFiles > 0) {
    inlined.push(`${report.inlinedFiles} local file${report.inlinedFiles === 1 ? '' : 's'}`);
  }
  if (report.inlinedPackages.length > 0) inlined.push(report.inlinedPackages.join(', '));
  const parts = [
    inlined.length > 0 ? `Bundled into one file (${inlined.join(' and ')} inlined).` : 'Bundled into one file.',
  ];
  if (report.media > 0) {
    parts.push(`${report.media} media file${report.media === 1 ? '' : 's'} attached as project asset${report.media === 1 ? '' : 's'}.`);
  }
  if (report.missingMedia.length > 0) {
    parts.push(`Not found beside the source: ${report.missingMedia.join(', ')} — attach them in the shot's Media section.`);
  }
  if (report.dynamicMediaCalls > 0) {
    parts.push(
      `${report.dynamicMediaCalls} staticFile() call${report.dynamicMediaCalls === 1 ? ' has' : 's have'} a computed path and will load nothing until the matching key is attached.`,
    );
  }
  return parts.join(' ');
}

/**
 * Display name for an imported shot, from its path alone. Creator projects are
 * folders of `v*.tsx`, so a version file borrows its folder's name; any other
 * file uses its own basename.
 */
export function deriveImportName(sourcePath: string): string {
  const segments = sourcePath.split(/[\\/]/).filter((s) => s.length > 0);
  const file = segments[segments.length - 1] ?? '';
  const base = file.replace(/\.[jt]sx?$/i, '').trim();
  if (/^v\d+$/i.test(base)) {
    const folder = segments[segments.length - 2]?.trim();
    if (folder) return folder;
  }
  return base.length > 0 ? base : 'imported-shot';
}

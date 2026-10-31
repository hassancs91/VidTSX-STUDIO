// The pure half of TSX import (TSX_SHOTS_DESIGN.md §D14 + PACKS_DESIGN.md
// "tsx-template"): what a source file's imports mean for the shot acceptance
// gate, and how a source PATH becomes a shot NAME.
//
// Nothing here knows where the file came from. "Import a TSX from anywhere" is
// the load-bearing constraint: the Creator is one source, an OS file picker is
// another, and a purchasable tsx-template pack is the next one — they differ
// only in how a caller finds the file and names it.
//
// Since P3 part 8 (D10) a source that fails the gate meets the BUNDLER first:
// local files and the app's library set (chroma-js, the @remotion/* packages,
// three, d3…) inline with no model. What reaches this module is what the
// bundler could not fix: a package outside the set (tone, an unknown one), a
// library on its own clock (gsap…), a missing or computed compositionConfig,
// no default export. "Convert for Studio" hands those to the TSX builder as a
// Quick edit of the one file — so two cases stay manual: a syntax error (fix
// the file), and a source that imports local files (Convert edits one file
// and would never see them).

import { collectImportSpecifiers, isShotModuleSpecifier, lintShotSource } from './shot-lint';

function isLocalSpecifier(spec: string): boolean {
  return spec.startsWith('.') || spec.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(spec);
}

export interface ShotImportClassification {
  /** Packages beyond react / remotion / the kit, de-duplicated (the bundler inlines the library set's; Convert rewrites the rest). */
  packages: string[];
  /** Local files the source imports: Convert edits one file, so these need a manual edit. */
  localFiles: string[];
  /** Non-import gate complaints (no default export, a missing compositionConfig): Convert fixes these. */
  otherErrors: string[];
  /** The file does not compile: never offered Convert. */
  syntaxError: boolean;
  /** "Convert for Studio" is worth offering: it compiles and imports no local files. */
  canConform: boolean;
}

/**
 * Why a source the bundler could not fix fails the shot gate, sorted into
 * "Convert fixes this" and "it won't". Callers run the real gate (and say
 * whether it failed on a syntax error); this decides the message and whether
 * Convert is offered.
 */
export function classifyShotImport(code: string, gate: { syntaxError?: boolean } = {}): ShotImportClassification {
  const packages = new Set<string>();
  const localFiles = new Set<string>();
  for (const spec of collectImportSpecifiers(code)) {
    if (isShotModuleSpecifier(spec)) continue; // what the shot preview resolves natively
    if (isLocalSpecifier(spec)) localFiles.add(spec);
    else packages.add(spec);
  }
  // Import complaints are re-derived above; the rest of the lint (default
  // export, compositionConfig) is what's left. An imported shot is a
  // standalone composition, so D13's opt-out never applies here.
  const otherErrors = gate.syntaxError ? [] : lintShotSource(code).errors.filter((e) => !e.startsWith('Import "'));
  const syntaxError = gate.syntaxError === true;
  return {
    packages: [...packages],
    localFiles: [...localFiles],
    otherErrors,
    syntaxError,
    canConform: !syntaxError && localFiles.size === 0,
  };
}

/** The pointed error a rejected import shows, tuned to WHY it failed. `bundlerReason`: why bundling it into one file did not work. */
export function describeImportFailure(
  classification: ShotImportClassification,
  gateError: string,
  bundlerReason?: string,
): string {
  if (classification.syntaxError) return gateError;
  const said = (bundlerReason ? `Bundling it into one Studio shot did not work: ${bundlerReason}` : gateError).trim();
  const why = /[.!?)]$/.test(said) ? said : `${said}.`;
  if (classification.canConform) {
    return `${why} "Convert for Studio" has the TSX builder fix it in a Quick edit (a paid model run); the original is kept alongside.`;
  }
  return `${why} It imports local files (${classification.localFiles.join(', ')}): Convert edits a single file and would not see them, so this needs a manual edit.`;
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
  /**
   * Files a TSX builder version loads that are not project media (3D models,
   * environment maps, fonts, data): copied into the new shot's `v1.assets/`,
   * which it plays them from (TSX_BUILDER_DESIGN.md P3 part 6). POSIX paths.
   */
  copiedFiles?: string[];
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
  if (report.copiedFiles && report.copiedFiles.length > 0) {
    const one = report.copiedFiles.length === 1;
    parts.push(
      `Copied into the shot's folder: ${report.copiedFiles.join(', ')} (${one ? 'it plays' : 'they play'} from there; ${one ? 'it is' : 'they are'} not project media).`,
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

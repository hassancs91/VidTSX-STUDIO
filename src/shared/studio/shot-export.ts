// Pure emission halves of the export entry's shot wiring (D6): which shots
// an entry references is `referencedShotIds` (shots.ts); these build the
// static-import block and components-map literal for the normalized copies.
// Kept in shared so the unit tests need no electron/fs.

import type { StudioShot } from '../types/studio';

/** One shot the export entry statically imports (its normalized copy). */
export interface ShotEntryRef {
  shotId: string;
  /** Import identifier — shot ids are kebab-case, identifiers can't be. */
  identifier: string;
  /** Basename of the normalized copy in the entry dir. The `studio-entry-`
   *  prefix matters: it keeps the copies inside the entry sweeper's TTL. */
  fileName: string;
}

export function shotEntryRef(shot: StudioShot, projectId: string): ShotEntryRef {
  return {
    shotId: shot.id,
    identifier: `Shot_${shot.id.replace(/-/g, '_')}`,
    fileName: `studio-entry-${projectId}-shot-${shot.id}-v${shot.activeVersion}.tsx`,
  };
}

/** The caption template's normalized copy in the entry dir (D13). Its import
 *  identifier is fixed — there is exactly one caption layer per project. */
export function captionEntryRef(templateId: string, projectId: string): ShotEntryRef {
  return {
    shotId: templateId,
    identifier: 'CaptionTemplate',
    fileName: `studio-entry-${projectId}-caption-${templateId.replace(/\//g, '-')}.tsx`,
  };
}

/**
 * The pack transitions' normalized copies in the entry dir
 * (TRANSITION_PACKS_DESIGN.md "Delivery"). Identifiers are positional — kinds
 * are `<pack>/<item>` slugs, and no character mapping of two dash-bearing
 * slugs into one identifier is collision-free. The file name keeps the halves
 * apart with a '.', which a slug can't contain, so two transitions never
 * share a copy.
 */
export function transitionEntryRefs(kinds: readonly string[], projectId: string): ShotEntryRef[] {
  return kinds.map((kind, index) => ({
    shotId: kind,
    identifier: `Transition_${index}`,
    fileName: `studio-entry-${projectId}-transition-${kind.replace('/', '.')}.tsx`,
  }));
}

/**
 * The pack filters' copies in the entry dir (FILTER_PACKS_DESIGN.md
 * "Delivery to the renderer and to export"). Same naming rules as the
 * transitions' — positional identifiers, a '.' between the kind's halves —
 * but the copy keeps its `.js` extension: a filter is a bundled module the
 * app never transpiles, and the entry imports it exactly as the pack ships it.
 */
export function filterEntryRefs(kinds: readonly string[], projectId: string): ShotEntryRef[] {
  return kinds.map((kind, index) => ({
    shotId: kind,
    identifier: `Filter_${index}`,
    fileName: `studio-entry-${projectId}-filter-${kind.replace('/', '.')}.js`,
  }));
}

/** The pinned kit copy's folder inside the entry dir (SHOT_QUALITY_DESIGN Q4).
 *  The `studio-entry-` prefix keeps it inside the entry sweeper's TTL. */
/**
 * Analysis tracks copied beside the entry as JSON and statically imported
 * (FILTER_PACKS_DESIGN.md "Analysis tracks"): `Track_<n>` identifiers, one
 * file per asset. The `.json` extension is what webpack keys the loader on.
 */
export function trackEntryRefs(assetIds: readonly string[], projectId: string): ShotEntryRef[] {
  return assetIds.map((assetId, index) => ({
    shotId: assetId,
    identifier: `Track_${index}`,
    fileName: `studio-entry-${projectId}-track-${assetId.replace(/[^A-Za-z0-9_-]/g, '_')}.json`,
  }));
}

export function kitEntryDirName(projectId: string, kitVersion: string): string {
  return `studio-entry-${projectId}-kit-${kitVersion}`;
}

/** Point a copy's '@vidtsx/kit' import at the pinned kit copy beside it, so
 *  the export bundles the exact kit the project was built against. */
export function rewriteKitImport(source: string, kitDirName: string): string {
  return source.replace(/from\s*['"]@vidtsx\/kit['"]/g, `from './${kitDirName}/index.tsx'`);
}

export function buildShotEntryParts(refs: ShotEntryRef[]): {
  imports: string;
  componentsLiteral: string;
} {
  if (refs.length === 0) return { imports: '', componentsLiteral: '' };
  const imports = refs
    .map((r) => `import ${r.identifier} from './${r.fileName}';`)
    .join('\n');
  const entries = refs.map((r) => `  ${JSON.stringify(r.shotId)}: ${r.identifier}`).join(',\n');
  return { imports, componentsLiteral: `{\n${entries}\n}` };
}

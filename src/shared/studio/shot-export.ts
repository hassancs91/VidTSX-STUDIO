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

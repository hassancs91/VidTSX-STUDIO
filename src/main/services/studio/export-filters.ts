// Export pre-flight for pack filters (docs/studio/FILTER_PACKS_DESIGN.md
// "Delivery to the renderer and to export"): the transitions' copy step over
// bundled modules. A filter is a self-contained `.js` (no imports, a default
// export) that the app never transpiles — the gate reads it, the entry
// imports a byte-identical copy beside it, and the render paints through the
// same definition the preview loaded from the module server.

import { logEngine } from '../../../logging/log-engine';
import type { SerializedTimeline } from '../../../shared/studio/serialize';
import { filterEntryRefs, type ShotEntryRef } from '../../../shared/studio/shot-export';
import { referencedFilterKinds } from '../../../shared/studio/filter-pack';
import { listFilters, readFilterSource } from './filter-packs';

const log = logEngine.createLogger('StudioExport');

export interface PreparedFilter {
  ref: ShotEntryRef;
  /** The pack file's content, verbatim — nothing rewrites a filter bundle. */
  source: string;
}

/**
 * One prepared copy per pack filter the serialized timeline uses.
 *
 * - A kind whose pack is not installed is LEFT OUT and logged: the clip
 *   renders its plain picture — the degrade the preview showed, so the export
 *   matches what the user saw and the id stays in the document.
 * - A kind that IS installed but fails the gate (an import, a banned global,
 *   no default export, oversize) throws: the export stops with a readable
 *   error instead of bundling code the pack author did not ship.
 */
export async function prepareFilterSources(
  serialized: Pick<SerializedTimeline, 'tracks'>,
  projectId: string,
): Promise<PreparedFilter[]> {
  const kinds = referencedFilterKinds(serialized);
  if (kinds.length === 0) return [];

  const installed = new Map((await listFilters()).map((item) => [item.kind, item]));
  const resolved: string[] = [];
  const sources: string[] = [];
  for (const kind of kinds) {
    const item = installed.get(kind);
    if (!item) {
      log.warn('Filter not installed — exporting its clips with the plain picture', { kind });
      continue;
    }
    const read = await readFilterSource(item);
    if (!read.ok) throw new Error(`${read.error} Remove it from the timeline or fix the pack to export.`);
    resolved.push(kind);
    sources.push(read.source);
  }

  return filterEntryRefs(resolved, projectId).map((ref, i) => ({ ref, source: sources[i] }));
}

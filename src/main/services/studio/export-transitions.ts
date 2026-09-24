// Export pre-flight for pack transitions (docs/studio/TRANSITION_PACKS_DESIGN.md
// "Delivery"): the same validate + normalize + copy step shots and the caption
// template get, so a transition renders in the bundle exactly as it previewed.

import { logEngine } from '../../../logging/log-engine';
import type { SerializedTimeline } from '../../../shared/studio/serialize';
import { transitionEntryRefs, type ShotEntryRef } from '../../../shared/studio/shot-export';
import { referencedTransitionKinds } from '../../../shared/studio/transition-pack';
import { validateTsxCode } from '../../ipc/tsx-handlers';
import { rewriteFontUrls } from '../font-proxy';
import { listTransitions, readTransitionSource } from './transition-packs';

const log = logEngine.createLogger('StudioExport');

export interface PreparedTransition {
  ref: ShotEntryRef;
  /** Normalized source for the copy beside the entry. */
  source: string;
}

/**
 * One prepared copy per pack transition the serialized timeline uses.
 *
 * - A kind whose pack is not installed is LEFT OUT and logged: its boundary
 *   renders as the crossfade the serializer already built — the same degrade
 *   the preview shows, so the export matches what the user saw.
 * - A kind that IS installed but fails the import gate or doesn't transpile
 *   throws: the export stops with a readable error instead of silently
 *   rendering something the pack author didn't ship.
 */
export async function prepareTransitionSources(
  serialized: Pick<SerializedTimeline, 'tracks'>,
  projectId: string,
  assetUrlBase: string,
): Promise<PreparedTransition[]> {
  const kinds = referencedTransitionKinds(serialized);
  if (kinds.length === 0) return [];

  const installed = new Map((await listTransitions()).map((item) => [item.kind, item]));
  const resolved: string[] = [];
  const sources: string[] = [];
  for (const kind of kinds) {
    const item = installed.get(kind);
    if (!item) {
      log.warn('Transition not installed — exporting its boundaries as crossfades', { kind });
      continue;
    }
    const read = await readTransitionSource(item);
    if (!read.ok) throw new Error(`${read.error} Remove it from the timeline or fix the pack to export.`);
    const transpile = await validateTsxCode(read.source);
    if (!transpile.success) {
      throw new Error(
        `Transition "${item.name}" (${kind}) failed export validation: ${transpile.error ?? 'transpile error'}`,
      );
    }
    resolved.push(kind);
    sources.push(rewriteFontUrls(read.source, assetUrlBase));
  }

  return transitionEntryRefs(resolved, projectId).map((ref, i) => ({ ref, source: sources[i] }));
}

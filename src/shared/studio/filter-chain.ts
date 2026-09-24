// A clip's `effects[]` against the definitions the composition was handed
// (docs/studio/FILTER_PACKS_DESIGN.md "Composition"). Pure, so ClipRenderer's
// branch and its test share one rule.

import type { FilterDefinition, StudioClipEffect } from '../types/studio-effects';
import type { FilterStage } from './FilteredPicture';

/**
 * The stages `FilteredPicture` paints, in document order. An entry whose kind
 * has no definition on hand — pack not installed, module failed to load, the
 * preview's filter toggle off — is left out, so the rest of the chain still
 * renders over the plain picture and the id stays in the document (the
 * degrade rule). A disabled entry never renders. Empty = the plain picture:
 * the caller then takes exactly the path it took before filters existed.
 */
export function resolveFilterChain(
  effects: readonly StudioClipEffect[] | undefined,
  definitions: Readonly<Record<string, FilterDefinition>> | undefined,
): FilterStage[] {
  if (!effects || !definitions) return [];
  const chain: FilterStage[] = [];
  for (const effect of effects) {
    if (effect.disabled) continue;
    const definition = definitions[effect.kind];
    if (!definition) continue;
    chain.push(effect.params ? { definition, params: effect.params } : { definition });
  }
  return chain;
}

// The session brand as the composition pipeline wants it (W7, decision 7):
// the same `buildBrandInstructions` block the Creator's prompt mode injects,
// read from the library for the session's `brandId`.
//
// Tolerant on purpose: a brand that no longer exists, or a library that will
// not read, means "no brand block" — the composition still generates, and
// `get_brand` is where the agent learns the brand is missing.

import { buildBrandInstructions } from '../../../../shared/studio/brand-instructions';
import { readBrand } from '../../library/brand-store';
import { getLibraryRoot } from '../../library/library-paths';
import { logEngine } from '../../../../logging/log-engine';

const log = logEngine.createLogger('AgentTools');

export async function readSessionBrandInstructions(
  brandId: string | undefined,
): Promise<string | undefined> {
  if (!brandId) return undefined;
  try {
    const brand = await readBrand(getLibraryRoot(), brandId);
    return brand ? buildBrandInstructions(brand) : undefined;
  } catch (err) {
    log.warn('Could not read the session brand for the composition', {
      brandId,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * Per-node brand (flows plan §0.1 item 9): a string overrides the run's or
 * session's brand, `null` opts out, and absent — or the inspector's cleared
 * text field, `''` — inherits `fallback`.
 */
export function resolveNodeBrand(nodeBrandId: unknown, fallback: string | undefined): string | undefined {
  if (nodeBrandId === null) return undefined;
  if (typeof nodeBrandId === 'string' && nodeBrandId.trim().length > 0) return nodeBrandId.trim();
  return fallback;
}

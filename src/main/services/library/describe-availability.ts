import type { LibraryDescribeAvailability } from '../../../shared/types/asset-library';
import { getLlmProviders } from '../settings';

/**
 * Can the library draft descriptions right now? (ASSET_LIBRARY_DESIGN.md
 * L2 Rev 3 — "no AI provider configured → nothing breaks".)
 *
 * Describing is a VISION call on the **app-default provider**: library
 * curation has no project context, so the provider is a fixed rule, not a
 * per-call choice. With nothing configured, describe reports itself
 * unavailable and the Assets view shows a dismissible note — imports still
 * land, and manual descriptions keep working exactly as before.
 */

/**
 * Pure resolver — takes the provider settings snapshot so it tests without
 * electron. The active provider must exist in the list AND carry the
 * credential its type needs; a half-configured entry is not a provider.
 */
export function resolveDescribeAvailability(settings: {
  providers: ReadonlyArray<{
    id: string;
    name?: string;
    authMode?: string;
    apiKey?: string;
    enabled?: boolean;
  }>;
  activeProvider?: string;
}): LibraryDescribeAvailability {
  const usable = settings.providers.filter((p) => p.enabled !== false);
  if (usable.length === 0) {
    return {
      available: false,
      reason: 'no-provider',
      message: 'No AI provider is configured.',
    };
  }
  const active = settings.activeProvider
    ? usable.find((p) => p.id === settings.activeProvider)
    : undefined;
  if (!active) {
    return {
      available: false,
      reason: 'no-default',
      message: 'No default AI provider is selected.',
    };
  }
  // Subscription providers sign in instead of carrying a key; an api-key
  // provider with no key is configured in name only.
  if (active.authMode === 'api-key' && !active.apiKey) {
    return {
      available: false,
      reason: 'no-key',
      message: `${active.name ?? active.id} has no API key.`,
    };
  }
  return { available: true, providerId: active.id };
}

/** Live availability, read from settings. */
export async function getDescribeAvailability(): Promise<LibraryDescribeAvailability> {
  const settings = await getLlmProviders();
  return resolveDescribeAvailability(settings);
}

import type { ProfileModelIpc } from '@shared/ipc/types';
import type { HardwareTier } from '@shared/model-library/fit';
import type { CatalogRowData } from '../types';

/** Laptop first — the order the Recommended list reads in (redesign §3.4 / §3.5). */
export const TIER_ORDER: readonly HardwareTier[] = ['laptop', 'mid', 'high', 'top'];

function tierRank(tier: HardwareTier | undefined): number {
  const index = tier ? TIER_ORDER.indexOf(tier) : -1;
  return index === -1 ? TIER_ORDER.length : index;
}

/** Stable sort by hardware tier; entries without a tier sink to the end, catalog order otherwise. */
export function sortByTier<T extends { tier?: HardwareTier }>(entries: readonly T[]): T[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => tierRank(a.entry.tier) - tierRank(b.entry.tier) || a.index - b.index)
    .map((x) => x.entry);
}

export interface CatalogSections<T> {
  /** Curated picks not yet installed, laptop tier first. */
  recommended: T[];
  /** Every uninstalled entry, the recommended ones included, in catalog order. */
  all: T[];
}

/**
 * The local-model page template's two catalog lists (docs/ai-models-redesign.md
 * §3.3): Recommended is the curated short list, All is the full catalog behind
 * a disclosure with search. Installed entries belong to neither — they are on
 * the Installed panel above.
 */
export function splitCatalogSections<T extends Pick<ProfileModelIpc, 'installed' | 'recommended' | 'tier'>>(
  profiles: readonly T[],
): CatalogSections<T> {
  const uninstalled = profiles.filter((p) => !p.installed);
  return {
    recommended: sortByTier(uninstalled.filter((p) => p.recommended)),
    all: uninstalled,
  };
}

/** Case-insensitive match on name, id or family; an empty query keeps everything. */
export function filterCatalog<T extends Pick<CatalogRowData, 'name' | 'id' | 'family'>>(
  rows: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter(
    (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.family.toLowerCase().includes(q),
  );
}

/** A scanned catalog profile as the template's catalog row renders it. */
export function profileToCatalogRow(profile: ProfileModelIpc): CatalogRowData {
  return {
    id: profile.id,
    name: profile.name,
    family: profile.family,
    sizeLabel: profile.sizeLabel,
    hasDownload: profile.hasDownload,
    sourceUrl: profile.sourceUrl,
    ...(profile.tier ? { tier: profile.tier } : {}),
    ...(profile.fit ? { fit: profile.fit } : {}),
    ...(profile.verifiedOn ? { verifiedOn: profile.verifiedOn } : {}),
  };
}

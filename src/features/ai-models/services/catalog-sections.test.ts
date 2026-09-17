import { describe, expect, it } from 'vitest';
import type { ProfileModelIpc } from '@shared/ipc/types';
import { filterCatalog, profileToCatalogRow, sortByTier, splitCatalogSections } from './catalog-sections';

function profile(overrides: Partial<ProfileModelIpc> & { id: string }): ProfileModelIpc {
  return {
    name: overrides.id,
    family: 'sdxl',
    sizeLabel: '1 GB',
    sourceUrl: `https://example.com/${overrides.id}`,
    hasDownload: true,
    installed: false,
    ...overrides,
  };
}

describe('splitCatalogSections', () => {
  it('puts uninstalled recommended entries under Recommended, laptop tier first, and everything uninstalled under All', () => {
    const profiles = [
      profile({ id: 'big', recommended: true, tier: 'high' }),
      profile({ id: 'installed-pick', recommended: true, tier: 'laptop', installed: true }),
      profile({ id: 'small', recommended: true, tier: 'laptop' }),
      profile({ id: 'plain', tier: 'mid' }),
      profile({ id: 'installed-plain', installed: true }),
    ];
    const sections = splitCatalogSections(profiles);
    expect(sections.recommended.map((p) => p.id)).toEqual(['small', 'big']);
    expect(sections.all.map((p) => p.id)).toEqual(['big', 'small', 'plain']);
  });

  it('is empty on both sides when every entry is installed', () => {
    const sections = splitCatalogSections([profile({ id: 'a', installed: true, recommended: true })]);
    expect(sections.recommended).toEqual([]);
    expect(sections.all).toEqual([]);
  });
});

describe('sortByTier', () => {
  it('keeps catalog order inside a tier and sinks entries without a tier to the end', () => {
    const sorted = sortByTier([
      { id: 'no-tier' },
      { id: 'top', tier: 'top' as const },
      { id: 'laptop-1', tier: 'laptop' as const },
      { id: 'mid', tier: 'mid' as const },
      { id: 'laptop-2', tier: 'laptop' as const },
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['laptop-1', 'laptop-2', 'mid', 'top', 'no-tier']);
  });
});

describe('filterCatalog', () => {
  const rows = [
    { id: 'flux-schnell-q4', name: 'FLUX.1 Schnell Q4', family: 'flux1' },
    { id: 'sd15-base-q8', name: 'SD 1.5 Base Q8', family: 'sd15' },
  ];

  it('matches name, id or family, case-insensitively', () => {
    expect(filterCatalog(rows, 'SCHNELL').map((r) => r.id)).toEqual(['flux-schnell-q4']);
    expect(filterCatalog(rows, 'sd15-base').map((r) => r.id)).toEqual(['sd15-base-q8']);
    expect(filterCatalog(rows, 'flux1').map((r) => r.id)).toEqual(['flux-schnell-q4']);
  });

  it('returns every row for a blank query', () => {
    expect(filterCatalog(rows, '   ')).toHaveLength(2);
  });
});

describe('profileToCatalogRow', () => {
  it('carries the row fields and drops absent optionals', () => {
    const row = profileToCatalogRow(profile({ id: 'x', tier: 'mid', verifiedOn: '2026-09-17', hasDownload: false }));
    expect(row).toEqual({
      id: 'x',
      name: 'x',
      family: 'sdxl',
      sizeLabel: '1 GB',
      hasDownload: false,
      sourceUrl: 'https://example.com/x',
      tier: 'mid',
      verifiedOn: '2026-09-17',
    });
    expect('fit' in row).toBe(false);
  });
});

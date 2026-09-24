import { describe, expect, it } from 'vitest';
import {
  isFilterSupported,
  parseFilterEntries,
  parseFilterKind,
  parseFilterPack,
  parseFilterParameters,
  parseFilterPresets,
  referencedFilterKinds,
} from './filter-pack';

const APP = '1.2.0';

const pack = (overrides: Record<string, unknown> = {}) => ({
  formatVersion: 1,
  id: 'core',
  name: 'Core',
  version: '1.0.0',
  filters: [{ id: 'noir', name: 'Noir', category: 'filter', defaultIntensity: 1, version: '1.0.0' }],
  ...overrides,
});

const BLOOM_PARAMS = [
  { key: 'threshold', label: 'Highlight threshold', type: 'range', min: 0, max: 1, step: 0.01, default: 0.65 },
  { key: 'radius', label: 'Bloom radius', type: 'range', min: 0.25, max: 8, step: 0.05, default: 2.5, unit: '%' },
  { key: 'tint', label: 'Tint', type: 'color', default: '#ffcc88' },
];

describe('parseFilterPack', () => {
  it('reads a filters-only pack and takes the folder name as the id', () => {
    const parsed = parseFilterPack(pack({ id: 'whatever' }), 'core', APP);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.manifest).toEqual({ id: 'core', name: 'Core', version: '1.0.0' });
    expect(parsed.entries.map((e) => [e.id, e.category])).toEqual([['noir', 'filter']]);
  });

  it('passes over a transitions-only or caption pack in the same root without complaint', () => {
    expect(parseFilterPack({ formatVersion: 1, transitions: [] }, 'core', APP)).toEqual({
      ok: false,
      reason: 'no filters[]',
      silent: true,
    });
    expect(parseFilterPack({ id: 'hormozi', type: 'caption-style' }, 'hormozi', APP)).toMatchObject({ silent: true });
  });

  it('refuses a bad folder name, an unknown format and a newer minAppVersion', () => {
    expect(parseFilterPack(pack(), 'Core Pack', APP).ok).toBe(false);
    expect(parseFilterPack(pack({ formatVersion: 2 }), 'core', APP).ok).toBe(false);
    expect(parseFilterPack(pack({ minAppVersion: '1.3.0' }), 'core', APP)).toMatchObject({
      ok: false,
      reason: 'needs VidTSX 1.3.0 (this app is 1.2.0)',
    });
    expect(parseFilterPack(pack({ minAppVersion: '1.2.0' }), 'core', APP).ok).toBe(true);
  });

  it('reads the shipped-style entry with parameters, presets, requires and heavy', () => {
    const parsed = parseFilterPack(
      pack({
        filters: [
          {
            id: 'cinematic-bloom',
            name: 'Cinematic Bloom',
            tier: 'intermediate',
            tagline: 'Let the highlights linger.',
            accent: '#e8bc83',
            symbol: '☼',
            animated: false,
            category: 'effect',
            defaultIntensity: 1,
            parameters: BLOOM_PARAMS,
            presets: [{ id: 'dreamlight', name: 'Dreamlight', parameters: { threshold: 0.4, radius: 6, tint: '#ffffff' } }],
            requires: [],
            heavy: true,
            version: '1.0.0',
          },
        ],
      }),
      'core',
      APP,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.entries[0]).toMatchObject({
      id: 'cinematic-bloom',
      category: 'effect',
      accent: '#e8bc83',
      heavy: true,
      requires: [],
      presets: [{ id: 'dreamlight', name: 'Dreamlight', parameters: { threshold: 0.4, radius: 6, tint: '#ffffff' } }],
    });
    expect(parsed.entries[0].parameters).toHaveLength(3);
  });
});

describe('parseFilterEntries', () => {
  it('drops malformed entries one by one and defaults the rest', () => {
    const entries = parseFilterEntries([
      null,
      'noir',
      { id: 'Bad Id' },
      { id: '../escape' },
      { id: 'ok-one' },
      { id: 'ok-one', name: 'duplicate' },
      { id: 'ok-two', category: 'filter', animated: true, defaultIntensity: 7, accent: 'red', heavy: 'yes' },
    ]);
    expect(entries).toEqual([
      {
        id: 'ok-one',
        name: 'ok-one',
        category: 'effect',
        animated: false,
        defaultIntensity: 1,
        parameters: [],
        presets: [],
        requires: [],
        heavy: false,
        version: '0.0.0',
      },
      expect.objectContaining({ id: 'ok-two', category: 'filter', animated: true, defaultIntensity: 1, heavy: false }),
    ]);
    // A bad accent is dropped, not stored.
    expect('accent' in entries[1]).toBe(false);
  });

  it('keeps foreign requirements so the loader can hold the item back', () => {
    const [entry] = parseFilterEntries([{ id: 'puppy', requires: ['faceTrack', 7, ''] }]);
    expect(entry.requires).toEqual(['faceTrack']);
    expect(isFilterSupported(entry)).toBe(false);
    expect(isFilterSupported({ requires: [] })).toBe(true);
  });
});

describe('parseFilterParameters', () => {
  it('validates each spec on its own', () => {
    expect(
      parseFilterParameters([
        ...BLOOM_PARAMS,
        { key: 'intensity', label: 'Claimed', type: 'range', min: 0, max: 1, step: 0.1, default: 0.5 },
        { key: 'threshold', label: 'dup', type: 'range', min: 0, max: 1, step: 0.1, default: 0.5 },
        { key: 'bad key', type: 'range', min: 0, max: 1, step: 0.1, default: 0.5 },
        { key: 'inverted', type: 'range', min: 1, max: 0, step: 0.1, default: 0.5 },
        { key: 'outside', type: 'range', min: 0, max: 1, step: 0.1, default: 2 },
        { key: 'nostep', type: 'range', min: 0, max: 1, step: 0, default: 0.5 },
        { key: 'shade', type: 'color', default: 'blue' },
        { key: 'unknown', type: 'select', default: 'a' },
        'nope',
      ]).map((p) => p.key),
    ).toEqual(['threshold', 'radius', 'tint']);
  });

  it('keeps a unit and fills a missing label', () => {
    const [radius] = parseFilterParameters([BLOOM_PARAMS[1]]);
    expect(radius).toMatchObject({ unit: '%', label: 'Bloom radius' });
    const [bare] = parseFilterParameters([{ key: 'k', type: 'range', min: 0, max: 1, step: 0.1, default: 0 }]);
    expect(bare.label).toBe('k');
  });
});

describe('parseFilterPresets', () => {
  const specs = parseFilterParameters(BLOOM_PARAMS);

  it('keeps only values the specs accept and drops an empty preset', () => {
    expect(
      parseFilterPresets(
        [
          { id: 'warm', name: 'Warm', parameters: { threshold: 0.5, radius: 99, tint: '#ff0000', stray: 1 } },
          { id: 'empty', parameters: { radius: 'wide' } },
          { id: 'warm', parameters: { threshold: 0.9 } },
          { id: 'Bad Id', parameters: { threshold: 0.9 } },
          { id: 'noparams' },
        ],
        specs,
      ),
    ).toEqual([{ id: 'warm', name: 'Warm', parameters: { threshold: 0.5, tint: '#ff0000' } }]);
  });
});

describe('parseFilterKind', () => {
  it('splits a namespaced id and refuses the rest', () => {
    expect(parseFilterKind('core/noir')).toEqual({ packId: 'core', itemId: 'noir' });
    for (const kind of ['noir', 'core/../x', 'a/b/c', 'Core/noir', '']) expect(parseFilterKind(kind)).toBeNull();
  });
});

describe('referencedFilterKinds', () => {
  it('collects each live pack filter once, sorted, across tracks', () => {
    const timeline = {
      tracks: [
        { clips: [{ effects: [{ kind: 'core/vhs' }, { kind: 'core/noir' }] }, { effects: [{ kind: 'core/noir', disabled: true }] }] },
        { clips: [{ effects: [{ kind: 'core/noir' }, { kind: 'not a kind' }] }, {}] },
      ],
    };
    expect(referencedFilterKinds(timeline)).toEqual(['core/noir', 'core/vhs']);
  });
});

import { describe, expect, it } from 'vitest';
import type { FilterDefinition } from '../types/studio-effects';
import { resolveFilterChain } from './filter-chain';

const def = (id: string): FilterDefinition => ({
  id,
  name: id,
  tier: 'common',
  tagline: '',
  description: '',
  accent: '#ffffff',
  symbol: '',
  faceTracking: false,
  animated: false,
  defaultIntensity: 1,
  render: () => {},
});

const DEFINITIONS = { 'core/noir': def('noir'), 'core/vhs': def('vhs') };

describe('resolveFilterChain', () => {
  it('keeps document order, carries params, skips disabled entries and kinds with no definition', () => {
    const chain = resolveFilterChain(
      [
        { kind: 'core/noir', params: { intensity: 0.5 } },
        { kind: 'core/vhs', disabled: true },
        { kind: 'looks/teal' },
        { kind: 'core/vhs' },
      ],
      DEFINITIONS,
    );
    expect(chain).toEqual([
      { definition: DEFINITIONS['core/noir'], params: { intensity: 0.5 } },
      { definition: DEFINITIONS['core/vhs'] },
    ]);
  });

  it('is empty — the plain picture — without effects or without definitions', () => {
    expect(resolveFilterChain(undefined, DEFINITIONS)).toEqual([]);
    expect(resolveFilterChain([], DEFINITIONS)).toEqual([]);
    expect(resolveFilterChain([{ kind: 'core/noir' }], undefined)).toEqual([]);
    expect(resolveFilterChain([{ kind: 'core/noir', disabled: true }], DEFINITIONS)).toEqual([]);
  });
});

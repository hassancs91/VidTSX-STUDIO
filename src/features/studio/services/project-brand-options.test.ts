import { describe, expect, it } from 'vitest';
import {
  CREATE_VALUE,
  PROJECT_BRAND_VALUE,
  brandOptions,
  brandValue,
  effectiveBrand,
  pickerChoice,
  presetOptions,
} from './project-brand-options';

const LIB = [{ id: 'acme', name: 'Acme' }];

describe('brand picker (feedback item 7)', () => {
  it('an empty library with no snapshot still offers No brand + Create brand…', () => {
    expect(brandOptions({ brands: [], brandId: undefined, snapshotName: null })).toEqual([
      { value: '', label: 'No brand' },
      { value: CREATE_VALUE, label: 'Create brand…' },
    ]);
    expect(brandValue(undefined, false)).toBe('');
  });

  it('a snapshot replaces No brand and is selected when no library brand is set', () => {
    const options = brandOptions({ brands: LIB, brandId: undefined, snapshotName: 'Learn With Hasan' });
    expect(options.map((o) => o.value)).toEqual([PROJECT_BRAND_VALUE, 'acme', CREATE_VALUE]);
    expect(options[0].label).toBe('Learn With Hasan (project snapshot)');
    expect(brandValue(undefined, true)).toBe(PROJECT_BRAND_VALUE);
    expect(brandValue('acme', true)).toBe('acme');
  });

  it('a stale brand id shows as missing', () => {
    const options = brandOptions({ brands: LIB, brandId: 'gone', snapshotName: null });
    expect(options).toContainEqual({ value: 'gone', label: 'gone (missing)' });
  });

  it('preset picker: always No preset + Create preset…, stale id visible', () => {
    expect(presetOptions({ presets: [], presetId: undefined }).map((o) => o.value)).toEqual(['', CREATE_VALUE]);
    expect(presetOptions({ presets: LIB, presetId: 'old' }).map((o) => o.label)).toEqual([
      'No preset',
      'Acme',
      'old (missing)',
      'Create preset…',
    ]);
  });

  it('maps picked values to choices', () => {
    expect(pickerChoice(CREATE_VALUE)).toEqual({ kind: 'create' });
    expect(pickerChoice(PROJECT_BRAND_VALUE)).toEqual({ kind: 'project' });
    expect(pickerChoice('')).toEqual({ kind: 'none' });
    expect(pickerChoice('acme')).toEqual({ kind: 'library', id: 'acme' });
  });

  it('effective brand mirrors resolveProjectBrand: library, then snapshot (also for a stale id), then none', () => {
    const snap = { id: 'project', name: 'Snap' };
    expect(effectiveBrand(LIB, 'acme', snap)).toEqual({ brand: LIB[0], source: 'library' });
    expect(effectiveBrand(LIB, 'gone', snap)).toEqual({ brand: snap, source: 'project' });
    expect(effectiveBrand(LIB, undefined, snap)).toEqual({ brand: snap, source: 'project' });
    expect(effectiveBrand(LIB, 'gone', null)).toEqual({ brand: null, source: 'none' });
  });
});

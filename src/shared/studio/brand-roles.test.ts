// The six optional palette roles (video-10 import gap 9): optional in
// validation, trimmed and dropped-when-empty by the sanitizer, kept by the
// normalizer, and present in the prompt ONLY when a brand sets them.
import { describe, expect, it } from 'vitest';
import type { StudioBrand } from '../types/asset-library';
import {
  OPTIONAL_PALETTE_KEYS,
  describeOptionalPaletteRoles,
  normalizeBrand,
  sanitizeBrandPalette,
  validateBrandInput,
} from './brand';
import { buildBrandInstructions } from './brand-instructions';

const core = { primary: '#7F77DD', secondary: '#c8b4ff', background: '#131316', text: '#e0e0e0', accent: '#EF9F27' };
const input = (palette: Record<string, string>) => ({ name: 'Acme', palette: { ...core, ...palette }, fonts: { display: 'Inter' } });

describe('optional palette roles', () => {
  it('has the six roles in display order', () => {
    expect([...OPTIONAL_PALETTE_KEYS]).toEqual(['success', 'warning', 'danger', 'muted', 'surface', 'line']);
  });

  it('validation accepts absent and empty extras, rejects a bad one', () => {
    expect(validateBrandInput(input({}))).toEqual([]);
    expect(validateBrandInput(input({ success: '', line: '   ' }))).toEqual([]);
    expect(validateBrandInput(input({ success: '#22a37c', line: 'rgb(1,2,3)' }))).toEqual([]);
    expect(validateBrandInput(input({ danger: 'url(x)' }))).toEqual(['Palette "danger" must be a CSS color, or left empty.']);
  });

  it('sanitize trims and drops empty extras, keeps set ones', () => {
    expect(sanitizeBrandPalette({ ...core, success: ' #22a37c ', warning: '', line: '  ' })).toEqual({ ...core, success: '#22a37c' });
  });

  it('normalize keeps valid extras from brand.json and ignores junk', () => {
    const brand = normalizeBrand(
      { name: 'Acme', palette: { ...core, surface: '#1b1b22', muted: 7, danger: '' }, fonts: { display: 'Inter' } },
      'acme',
    );
    expect(brand?.palette).toEqual({ ...core, surface: '#1b1b22' });
  });

  it('describes only the roles that are set, with the kit token', () => {
    expect(describeOptionalPaletteRoles(core)).toBeUndefined();
    expect(describeOptionalPaletteRoles({ ...core, success: '#22a37c', line: '#2a2a33' })).toBe(
      'success #22a37c (positive status: checkmarks, ok lines; kit `ok`), line #2a2a33 (hairline borders and dividers; kit `line`)',
    );
  });

  it('the TSX brand instructions carry an Extra roles line only when set', () => {
    const base: StudioBrand = { id: 'acme', name: 'Acme', palette: core, fonts: { display: 'Inter' }, logoRefs: [], createdAt: 'x', updatedAt: 'x' };
    expect(buildBrandInstructions(base)).not.toContain('Extra roles');
    const withRoles = buildBrandInstructions({ ...base, palette: { ...core, warning: '#f5c542' } });
    expect(withRoles).toContain('Extra roles — warning #f5c542 (attention: tags, caution; kit `warn`).');
    expect(withRoles.indexOf('Extra roles')).toBeLessThan(withRoles.indexOf('Fonts —'));
  });
});

import { describe, expect, it } from 'vitest';
import {
  STYLE_NOTES_MAX,
  isPlausibleCssColor,
  normalizeBrand,
  validateBrandInput,
  type StudioBrandInput,
} from './brand';

const GOOD: StudioBrandInput = {
  name: 'Acme',
  palette: {
    primary: '#7F77DD',
    secondary: 'rgb(200, 180, 255)',
    background: '#131316',
    text: 'white',
    accent: 'hsl(36, 87%, 54%)',
  },
  fonts: { display: 'Inter', body: 'Roboto' },
  logoRefs: ['logos/acme.png'],
  styleNotes: 'Minimal.',
};

describe('isPlausibleCssColor', () => {
  it('accepts hex, functional, and keyword colors', () => {
    for (const v of ['#fff', '#7F77DD', '#7F77DDcc', 'rgb(1, 2, 3)', 'hsla(1,2%,3%,0.5)', 'rebeccapurple', ' white ']) {
      expect(isPlausibleCssColor(v), v).toBe(true);
    }
  });

  it('rejects empties, breakout characters, and non-colors', () => {
    for (const v of ['', '  ', '#12', 'red; }', `'#fff'`, 'url(x)', '1234', 'a'.repeat(70), 'line\nbreak']) {
      expect(isPlausibleCssColor(v), JSON.stringify(v)).toBe(false);
    }
  });
});

describe('validateBrandInput', () => {
  it('accepts a complete brand', () => {
    expect(validateBrandInput(GOOD)).toEqual([]);
  });

  it('flags each broken field with its own error', () => {
    const errors = validateBrandInput({
      name: 'x',
      palette: { ...GOOD.palette, accent: 'not a color!' },
      fonts: { display: '' },
      logoRefs: [''],
      styleNotes: 'y'.repeat(STYLE_NOTES_MAX + 1),
    });
    expect(errors.some((e) => e.includes('at least 2 characters'))).toBe(true);
    expect(errors.some((e) => e.includes('"accent"'))).toBe(true);
    expect(errors.some((e) => e.includes('display font'))).toBe(true);
    expect(errors.some((e) => e.includes('Logo references'))).toBe(true);
    expect(errors.some((e) => e.includes(`${STYLE_NOTES_MAX} characters`))).toBe(true);
  });

  it('rejects font names that could break out of a CSS value', () => {
    const errors = validateBrandInput({ ...GOOD, fonts: { display: `Inter'; }` } });
    expect(errors.some((e) => e.includes('not allowed'))).toBe(true);
  });
});

describe('normalizeBrand', () => {
  const raw = { ...GOOD, id: 'ignored', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' };

  it('takes the id from the folder, keeps fields, drops empty optionals', () => {
    const brand = normalizeBrand({ ...raw, styleNotes: '  ', fonts: { display: 'Inter', body: '' } }, 'acme-2');
    expect(brand?.id).toBe('acme-2');
    expect(brand?.name).toBe('Acme');
    expect(brand?.styleNotes).toBeUndefined();
    expect(brand?.fonts).toEqual({ display: 'Inter' });
    expect(brand?.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('filters junk logoRefs and defaults them to []', () => {
    expect(normalizeBrand({ ...raw, logoRefs: ['ok.png', '', 42] }, 'b')?.logoRefs).toEqual(['ok.png']);
    expect(normalizeBrand({ ...raw, logoRefs: undefined }, 'b')?.logoRefs).toEqual([]);
  });

  it('returns null for unusable documents', () => {
    expect(normalizeBrand(null, 'b')).toBeNull();
    expect(normalizeBrand({}, 'b')).toBeNull();
    expect(normalizeBrand({ ...raw, palette: { primary: '#fff' } }, 'b')).toBeNull();
    expect(normalizeBrand({ ...raw, fonts: {} }, 'b')).toBeNull();
  });
});

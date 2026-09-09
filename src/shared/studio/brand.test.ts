import { describe, expect, it } from 'vitest';
import {
  STYLE_NOTES_MAX,
  applyStyleNotesPromotion,
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

  it('carries a normalized vocabulary and drops an empty one (W4)', () => {
    const brand = normalizeBrand(
      { ...raw, vocabulary: [{ term: ' VidTSX ', aliases: ['Vid TSX', 'vidtsx'] }, { term: '' }, 'junk'] },
      'b',
    );
    expect(brand?.vocabulary).toEqual([{ term: 'VidTSX', aliases: ['Vid TSX'] }]);
    expect(normalizeBrand({ ...raw, vocabulary: [] }, 'b')?.vocabulary).toBeUndefined();
    expect(validateBrandInput({ ...GOOD, vocabulary: [{ term: 'x'.repeat(61) }] })[0]).toContain('too long');
  });

  it('returns null for unusable documents', () => {
    expect(normalizeBrand(null, 'b')).toBeNull();
    expect(normalizeBrand({}, 'b')).toBeNull();
    expect(normalizeBrand({ ...raw, palette: { primary: '#fff' } }, 'b')).toBeNull();
    expect(normalizeBrand({ ...raw, fonts: {} }, 'b')).toBeNull();
  });
});

describe('applyStyleNotesPromotion (Q6c)', () => {
  it('appends as a list line; empty notes start the list', () => {
    expect(applyStyleNotesPromotion(undefined, 'Subtler entrances.')).toEqual({
      ok: true,
      next: '- Subtler entrances.',
    });
    expect(applyStyleNotesPromotion('Keep it minimal.', 'Subtler entrances.')).toEqual({
      ok: true,
      next: 'Keep it minimal.\n- Subtler entrances.',
    });
  });

  it('refuses a rule the notes already carry (case-insensitive)', () => {
    const r = applyStyleNotesPromotion('- subtler ENTRANCES.', 'Subtler entrances.');
    expect(r).toEqual({ ok: false, reason: 'already-present' });
  });

  it('displaces an exact substring and tidies the leftover blank lines', () => {
    const current = 'Line one.\n\n- Old rule to retire.\n\nLine three.';
    const r = applyStyleNotesPromotion(current, 'New rule.', '- Old rule to retire.\n');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.next).toBe('Line one.\n\nLine three.\n- New rule.');
    }
  });

  it('rejects a displaces string that is not present', () => {
    expect(applyStyleNotesPromotion('Notes.', 'Rule.', 'never there')).toEqual({
      ok: false,
      reason: 'displaces-not-found',
    });
  });

  it('reports over-cap with the overflow size', () => {
    const current = 'x'.repeat(STYLE_NOTES_MAX - 5);
    const r = applyStyleNotesPromotion(current, 'A longer new rule.');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('over-cap');
      expect(r.overBy).toBeGreaterThan(0);
    }
  });
});

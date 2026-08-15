import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAPTION_STYLE,
  FALLBACK_CAPTION_PALETTE,
  normalizeCaptionLayer,
  normalizeCaptionStyle,
  resolveCaptionPalette,
  resolvedStyle,
} from './caption-layer';

const brand = {
  palette: {
    primary: '#0a7cff',
    secondary: '#123456',
    background: '#001018',
    text: '#f2f8ff',
    accent: '#ffb703',
  },
  fonts: { display: 'Georgia', body: 'Inter' },
};

describe('normalizeCaptionLayer', () => {
  it('accepts a well-formed layer', () => {
    expect(
      normalizeCaptionLayer({
        templateId: 'core/word-pop',
        enabled: true,
        style: { position: 'center', scale: 1.4, wordsPerGroup: 2, uppercase: true, colors: 'brand' },
      }),
    ).toEqual({
      templateId: 'core/word-pop',
      enabled: true,
      style: {
        position: 'center',
        scale: 1.4,
        wordsPerGroup: 2,
        uppercase: true,
        colors: 'brand',
      },
    });
  });

  it('drops a layer with no usable templateId', () => {
    expect(normalizeCaptionLayer({ enabled: true })).toBeUndefined();
    expect(normalizeCaptionLayer({ templateId: '   ' })).toBeUndefined();
    expect(normalizeCaptionLayer(null)).toBeUndefined();
    expect(normalizeCaptionLayer('core/word-pop')).toBeUndefined();
  });

  it('keeps an UNINSTALLED pack id — reinstalling must bring captions back', () => {
    expect(normalizeCaptionLayer({ templateId: 'bought/neon' })?.templateId).toBe('bought/neon');
  });

  it('defaults a missing style and treats a missing `enabled` as on', () => {
    expect(normalizeCaptionLayer({ templateId: 'core/karaoke' })).toEqual({
      templateId: 'core/karaoke',
      enabled: true,
      style: DEFAULT_CAPTION_STYLE,
    });
  });
});

describe('normalizeCaptionStyle', () => {
  it('clamps scale and wordsPerGroup, and rejects unknown positions', () => {
    expect(
      normalizeCaptionStyle({ position: 'sideways', scale: 9, wordsPerGroup: 42 }),
    ).toMatchObject({ position: 'bottom', scale: 2, wordsPerGroup: 6 });
    expect(normalizeCaptionStyle({ scale: -3, wordsPerGroup: 0 })).toMatchObject({
      scale: 0.5,
      wordsPerGroup: 1,
    });
    expect(normalizeCaptionStyle({ scale: Number.NaN })).toMatchObject({ scale: 1 });
  });

  it('falls back to brand colors when an override is incomplete or unsafe', () => {
    expect(normalizeCaptionStyle({ colors: { primary: '#fff' } }).colors).toBe('brand');
    expect(
      normalizeCaptionStyle({
        colors: { ...brand.palette, accent: 'red; content: "</style>"' },
      }).colors,
    ).toBe('brand');
  });

  it('keeps a complete color override', () => {
    expect(normalizeCaptionStyle({ colors: brand.palette }).colors).toEqual(brand.palette);
  });
});

describe('resolveCaptionPalette', () => {
  it('resolves brand colors + display font', () => {
    expect(resolveCaptionPalette('brand', brand)).toEqual({
      ...brand.palette,
      fontFamily: 'Georgia',
    });
  });

  it('falls back to the built-in look when the brand is missing or stale', () => {
    expect(resolveCaptionPalette('brand', null)).toEqual(FALLBACK_CAPTION_PALETTE);
    expect(resolveCaptionPalette('brand', undefined)).toEqual(FALLBACK_CAPTION_PALETTE);
  });

  it('an explicit override beats the brand, but still borrows its font', () => {
    const override = { ...brand.palette, accent: '#ff0000' };
    expect(resolveCaptionPalette(override, brand)).toEqual({ ...override, fontFamily: 'Georgia' });
    expect(resolveCaptionPalette(override, null).fontFamily).toBe(
      FALLBACK_CAPTION_PALETTE.fontFamily,
    );
  });
});

describe('resolvedStyle', () => {
  it('strips `colors` (it is already resolved into the palette)', () => {
    expect(resolvedStyle(DEFAULT_CAPTION_STYLE)).toEqual({
      position: 'bottom',
      scale: 1,
      wordsPerGroup: 3,
      uppercase: false,
    });
  });
});

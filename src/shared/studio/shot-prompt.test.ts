import { describe, it, expect } from 'vitest';
import { buildShotExtraInstructions } from './shot-prompt';

const BASE = { width: 1920, height: 1080, fps: 30, durationSeconds: 4 } as const;

describe('buildShotExtraInstructions', () => {
  it('bakes exact literal config values (duration × fps rounded to frames)', () => {
    const text = buildShotExtraInstructions({ ...BASE, kind: 'cutaway', durationSeconds: 4.5 });
    expect(text).toContain('width: 1920,');
    expect(text).toContain('height: 1080,');
    expect(text).toContain('fps: 30,');
    expect(text).toContain('durationInFrames: 135');
  });

  it('cutaway mandates an opaque background; overlay/title mandate transparency', () => {
    expect(buildShotExtraInstructions({ ...BASE, kind: 'cutaway' })).toMatch(/opaque full-frame background/);
    expect(buildShotExtraInstructions({ ...BASE, kind: 'overlay' })).toMatch(/fully transparent/);
    expect(buildShotExtraInstructions({ ...BASE, kind: 'title' })).toMatch(/fully transparent/);
  });

  it('injects the WORDS block only when anchored words are given', () => {
    const without = buildShotExtraInstructions({ ...BASE, kind: 'title' });
    expect(without).not.toContain('const WORDS');
    const withWords = buildShotExtraInstructions({
      ...BASE,
      kind: 'title',
      words: [{ text: 'hello', start: 0.1, end: 0.4 }],
    });
    expect(withWords).toContain('const WORDS = [');
    expect(withWords).toContain('{ text: "hello", start: 0.1, end: 0.4 },');
  });

  it('always carries the import restriction and seconds×fps timing rule', () => {
    const text = buildShotExtraInstructions({ ...BASE, kind: 'overlay' });
    expect(text).toMatch(/ONLY from 'react' and 'remotion'/);
    expect(text).toMatch(/seconds × fps using the fps from useVideoConfig/);
  });

  // ── Brand injection (D11) ──────────────────────────────────────────────

  const BRAND = {
    id: 'acme',
    name: 'Acme',
    palette: {
      primary: '#7F77DD',
      secondary: '#c8b4ff',
      background: '#131316',
      text: '#e0e0e0',
      accent: '#EF9F27',
    },
    fonts: { display: 'Inter', body: 'Roboto' },
    logoRefs: ['logos/acme.png'],
    styleNotes: 'Minimal, generous whitespace. Logo bottom-right when space allows.',
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z',
  };

  it('no brand → no brand block', () => {
    expect(buildShotExtraInstructions({ ...BASE, kind: 'cutaway' })).not.toContain('## Brand');
  });

  it('injects every palette token, both fonts as CSS stacks, and notes verbatim', () => {
    const text = buildShotExtraInstructions({ ...BASE, kind: 'cutaway', brand: BRAND });
    expect(text).toContain('## Brand: Acme (MANDATORY styling)');
    for (const hex of ['#7F77DD', '#c8b4ff', '#131316', '#e0e0e0', '#EF9F27']) {
      expect(text).toContain(hex);
    }
    expect(text).toContain(`fontFamily: "'Inter', 'Segoe UI', sans-serif"`);
    expect(text).toContain(`fontFamily: "'Roboto', 'Segoe UI', sans-serif"`);
    expect(text).toContain('Do NOT import any font package');
    expect(text).toContain('Logo bottom-right when space allows.');
  });

  it('background token: cutaway uses it, overlay stays transparent', () => {
    const cutaway = buildShotExtraInstructions({ ...BASE, kind: 'cutaway', brand: BRAND });
    expect(cutaway).toContain('#131316 (use this for the opaque full-frame background)');
    const overlay = buildShotExtraInstructions({ ...BASE, kind: 'overlay', brand: BRAND });
    expect(overlay).toContain('#131316 (reference only');
  });

  it('body font falls back to display; explicit generic stacks pass through unquoted', () => {
    const text = buildShotExtraInstructions({
      ...BASE,
      kind: 'overlay',
      brand: { ...BRAND, fonts: { display: 'Georgia, serif' } },
    });
    expect(text).toContain('Display font (headings/numbers): fontFamily: "Georgia, serif"');
    expect(text).toContain('Body font (labels/paragraphs): fontFamily: "Georgia, serif"');
  });

  it('brand block coexists with the WORDS block for anchored title shots', () => {
    const text = buildShotExtraInstructions({
      ...BASE,
      kind: 'title',
      brand: BRAND,
      words: [{ text: 'hello', start: 0.1, end: 0.4 }],
    });
    expect(text.indexOf('## Brand')).toBeGreaterThan(-1);
    expect(text.indexOf('const WORDS')).toBeGreaterThan(text.indexOf('## Brand'));
  });
});

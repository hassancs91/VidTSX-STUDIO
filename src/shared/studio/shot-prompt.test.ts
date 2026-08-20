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

  // ── Craft block + exemplars (Q3a/Q3c) ──────────────────────────────────

  it('always opens with the craft block, before the contract', () => {
    const text = buildShotExtraInstructions({ ...BASE, kind: 'cutaway' });
    const craft = text.indexOf('## Craft (MANDATORY design discipline)');
    expect(craft).toBe(0);
    expect(text).toContain('One accent per beat');
  });

  it('renders exemplars as fenced code between craft and contract; none → no section', () => {
    const without = buildShotExtraInstructions({ ...BASE, kind: 'cutaway' });
    expect(without).not.toContain('## Exemplars');
    const text = buildShotExtraInstructions({
      ...BASE,
      kind: 'cutaway',
      exemplars: [{ name: 'Steps Row', description: 'stagger rhythm', code: 'const x = 1;\n' }],
    });
    const exemplars = text.indexOf('## Exemplars — the bar to match');
    const contract = text.indexOf('## Studio shot contract');
    expect(exemplars).toBeGreaterThan(text.indexOf('## Craft'));
    expect(contract).toBeGreaterThan(exemplars);
    expect(text).toContain('### Steps Row — stagger rhythm');
    expect(text).toContain('```tsx\nconst x = 1;\n```');
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

describe('media assets section (D12)', () => {
  const base = { kind: 'cutaway' as const, width: 1280, height: 720, fps: 30, durationSeconds: 5 };

  it('no assets → no assets section', () => {
    expect(buildShotExtraInstructions(base)).not.toContain('## Media assets');
    expect(buildShotExtraInstructions({ ...base, assets: [] })).not.toContain('## Media assets');
  });

  it('lists each asset with kind, dimensions, duration, and description', () => {
    const out = buildShotExtraInstructions({
      ...base,
      assets: [
        { key: 'logo', kind: 'image', width: 1024, height: 1024, description: 'white on transparent' },
        { key: 'demo', kind: 'video', width: 1920, height: 1080, durationSeconds: 8 },
      ],
    });
    expect(out).toContain('## Media assets (MANDATORY usage)');
    expect(out).toContain('`assets.logo` (image, 1024×1024) — white on transparent');
    expect(out).toContain('`assets.demo` (video, 1920×1080, 8.0 s)');
    expect(out).toContain('assets: Record<string, string>');
    expect(out).toContain('<Img src={assets.key}>');
    expect(out).toMatch(/NEVER hardcode a file path/);
  });

  it('assets section coexists with brand and WORDS blocks', () => {
    const out = buildShotExtraInstructions({
      ...base,
      kind: 'title',
      words: [{ text: 'hi', start: 0, end: 0.4 }],
      assets: [{ key: 'logo', kind: 'image' }],
    });
    expect(out).toContain('## Media assets (MANDATORY usage)');
    expect(out).toContain('## Word timings (shot-local seconds)');
  });
});

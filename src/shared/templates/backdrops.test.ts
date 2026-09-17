// Overlay stand-ins: one CSS background per backdrop, shaped to the frame.

import { describe, it, expect } from 'vitest';
import { TEMPLATE_BACKDROPS, backdropCss, isTemplateBackdrop } from './backdrops';

const svgOf = (css: string | null): string => {
  const m = /url\("data:image\/svg\+xml,([^"]+)"\)/.exec(css ?? '');
  return m ? decodeURIComponent(m[1]) : '';
};

describe('backdropCss', () => {
  it('paints nothing for none', () => {
    expect(backdropCss('none', { width: 1920, height: 1080 })).toBeNull();
  });

  it('draws the checker in square cells whatever the frame', () => {
    const wide = backdropCss('checker', { width: 1920, height: 1080 }) ?? '';
    expect(wide).toContain('repeating-conic-gradient');
    const [w, h] = /\/ ([\d.]+)% ([\d.]+)%/.exec(wide)!.slice(1).map(Number);
    expect(w * 1920).toBeCloseTo(h * 1080, 5);
  });

  it.each(['soft', 'dark', 'warm'] as const)('%s is a well-formed SVG with the frame aspect', (id) => {
    for (const canvas of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }, { width: 1080, height: 1080 }]) {
      const svg = svgOf(backdropCss(id, canvas));
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).not.toContain('NaN');
      const [, vw, vh] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)!.map(Number);
      expect(vw / vh).toBeCloseTo(canvas.width / canvas.height, 2);
      // SVG 1.1 has no rgba(): every colour went through the opacity split.
      expect(svg).not.toContain('rgba(');
    }
  });

  it('knows its own ids', () => {
    for (const id of TEMPLATE_BACKDROPS) expect(isTemplateBackdrop(id)).toBe(true);
    expect(isTemplateBackdrop('sepia')).toBe(false);
    expect(isTemplateBackdrop(null)).toBe(false);
  });
});

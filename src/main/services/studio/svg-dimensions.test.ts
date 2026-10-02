import { describe, expect, it } from 'vitest';
import { parseSvgDimensions } from './svg-dimensions';

describe('parseSvgDimensions', () => {
  it('reads unitless and px width/height attributes', () => {
    expect(parseSvgDimensions('<svg width="640" height="360"></svg>')).toEqual({ width: 640, height: 360 });
    expect(parseSvgDimensions("<svg xmlns='http://www.w3.org/2000/svg' width='1.5px' height='24PX'/>")).toEqual({ width: 2, height: 24 });
  });

  it('falls back to the viewBox for a missing side or both', () => {
    expect(parseSvgDimensions('<svg viewBox="0 0 1920 1080"></svg>')).toEqual({ width: 1920, height: 1080 });
    expect(parseSvgDimensions('<svg width="100" viewBox="0,0,200,50"></svg>')).toEqual({ width: 100, height: 50 });
  });

  it('treats percentages and other units as unknown rather than guessing', () => {
    expect(parseSvgDimensions('<svg width="100%" height="100%"></svg>')).toEqual({});
    expect(parseSvgDimensions('<svg width="10em" height="2in" viewBox="0 0 30 40"></svg>')).toEqual({ width: 30, height: 40 });
  });

  it('ignores anything before the root tag and documents with no svg tag', () => {
    expect(parseSvgDimensions('<?xml version="1.0"?>\n<!-- c -->\n<svg\n  height="8"\n  width="16"\n>')).toEqual({ width: 16, height: 8 });
    expect(parseSvgDimensions('<html><body>no</body></html>')).toEqual({});
    expect(parseSvgDimensions('<svg viewBox="0 0 0 10"></svg>')).toEqual({});
  });
});

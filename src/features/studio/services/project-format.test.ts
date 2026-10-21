import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT_ID, FORMAT_PRESETS, formatIdForOrientation, formatOrientation, fpsOptions, parseDimension } from './project-format';

describe('project format edits (feedback item 7)', () => {
  it('accepts even integers in range and rounds odd ones up', () => {
    expect(parseDimension('1920')).toBe(1920);
    expect(parseDimension(' 1081 ')).toBe(1082);
    expect(parseDimension('16')).toBe(16);
    expect(parseDimension('7680')).toBe(7680);
  });

  it('rejects junk, fractions and out-of-range sizes', () => {
    for (const bad of ['', 'abc', '19.5', '-2', '8', '8000', '1e3']) expect(parseDimension(bad)).toBeNull();
  });

  it('offers the common rates, plus an unusual current one in order', () => {
    expect(fpsOptions(30).map((o) => o.value)).toEqual(['24', '25', '30', '50', '60']);
    expect(fpsOptions(59.94).map((o) => o.value)).toEqual(['24', '25', '30', '50', '59.94', '60']);
  });
});

describe('shared format presets (A1 — New Project and Project settings read one list)', () => {
  it('has the 4K tile with every tile even-sized, in range and described', () => {
    expect(FORMAT_PRESETS.find((f) => f.id === '4k')).toMatchObject({ width: 3840, height: 2160 });
    for (const f of FORMAT_PRESETS) {
      expect(parseDimension(String(f.width))).toBe(f.width);
      expect(parseDimension(String(f.height))).toBe(f.height);
      expect(f.description.length).toBeGreaterThan(0);
    }
    expect(new Set(FORMAT_PRESETS.map((f) => f.id)).size).toBe(FORMAT_PRESETS.length);
    expect(FORMAT_PRESETS.find((f) => f.id === DEFAULT_FORMAT_ID)).toMatchObject({ width: 1920, height: 1080 });
  });

  it('names a size by its orientation', () => {
    expect(formatOrientation(3840, 2160)).toBe('16:9');
    expect(formatOrientation(1080, 1920)).toBe('9:16');
    expect(formatOrientation(1080, 1080)).toBe('1:1');
  });

  it("maps an editing preset's orientation to a tile, keeping a current tile that already fits (W5)", () => {
    expect(formatIdForOrientation('9:16', '1080p')).toBe('portrait');
    expect(formatIdForOrientation('1:1', '4k')).toBe('square');
    expect(formatIdForOrientation('16:9', 'portrait')).toBe('1080p');
    expect(formatIdForOrientation('16:9', '4k')).toBe('4k');
    expect(formatIdForOrientation(undefined, '4k')).toBe('4k');
  });
});

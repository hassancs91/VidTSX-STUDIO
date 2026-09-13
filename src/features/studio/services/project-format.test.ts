import { describe, expect, it } from 'vitest';
import { fpsOptions, parseDimension } from './project-format';

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

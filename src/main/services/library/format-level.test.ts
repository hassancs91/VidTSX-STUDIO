import { describe, expect, it } from 'vitest';
import { signed } from './format-level';

describe('signed (the LUFS / dB form the tool answers and the listing share)', () => {
  it('prints one decimal by default, with a typographic minus for negatives', () => {
    expect(signed(-20.04)).toBe('−20.0');
    expect(signed(-1.5)).toBe('−1.5');
    expect(signed(4.5)).toBe('4.5');
    expect(signed(0)).toBe('0.0');
  });

  it('takes a digit count', () => {
    expect(signed(-8.204, 2)).toBe('−8.20');
    expect(signed(2.9712, 2)).toBe('2.97');
  });
});

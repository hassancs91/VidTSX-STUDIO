import { describe, it, expect } from 'vitest';
import {
  classifyBand,
  NSFW_BORDERLINE_THRESHOLD,
  NSFW_HARD_BLOCK_THRESHOLD,
} from './bands';

describe('Content Safety threshold bands (D2b)', () => {
  it('freezes the designed band edges', () => {
    expect(NSFW_HARD_BLOCK_THRESHOLD).toBe(0.8);
    expect(NSFW_BORDERLINE_THRESHOLD).toBe(0.2);
  });

  it('p ≥ 0.8 is explicit', () => {
    expect(classifyBand(0.8)).toBe('explicit');
    expect(classifyBand(0.999)).toBe('explicit');
    expect(classifyBand(1)).toBe('explicit');
  });

  it('0.2 ≤ p < 0.8 is borderline (blocks by default)', () => {
    expect(classifyBand(0.2)).toBe('borderline');
    expect(classifyBand(0.5)).toBe('borderline');
    expect(classifyBand(0.7999)).toBe('borderline');
  });

  it('p < 0.2 passes', () => {
    expect(classifyBand(0)).toBe('pass');
    expect(classifyBand(0.1999)).toBe('pass');
  });
});

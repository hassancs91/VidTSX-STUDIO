import { describe, expect, it } from 'vitest';
import { estimateNeededVramGB, evaluateFit, hardwareTierFor } from './fit';

const GB = 1_000_000_000;

describe('estimateNeededVramGB + hardwareTierFor — the catalog tier label', () => {
  it('is the same number evaluateFit grades', () => {
    const req = { minVramGB: 6, sizeBytes: 3 * GB };
    expect(estimateNeededVramGB(req)).toBe(6);
    expect(evaluateFit(req, { vramGB: 8, ramGB: 32 }).neededVramGB).toBe(6);
    const bySize = { sizeBytes: 9.9 * GB };
    expect(estimateNeededVramGB(bySize)).toBe(11.4);
    expect(evaluateFit(bySize, { vramGB: null }).neededVramGB).toBe(11.4);
  });

  it('buckets by the estimate: ≤4 laptop, ≤8 mid, ≤12 high, else top', () => {
    expect(hardwareTierFor(2.2)).toBe('laptop');
    expect(hardwareTierFor(4)).toBe('laptop');
    expect(hardwareTierFor(5.6)).toBe('mid');
    expect(hardwareTierFor(8)).toBe('mid');
    expect(hardwareTierFor(11.4)).toBe('high');
    expect(hardwareTierFor(12)).toBe('high');
    expect(hardwareTierFor(14.3)).toBe('top');
  });

  it('places the recommended video rows where the plan says (docs/ai-models-redesign.md §3.5)', () => {
    // Wan 2.1 1.3B Q4: 866 MB, floor 6 → mid (the floor wins over the file size).
    expect(hardwareTierFor(estimateNeededVramGB({ minVramGB: 6, sizeBytes: 865_581_280 }))).toBe('mid');
    // LTX-2.3 Dev Q4: 12.7 GB, floor 16 → top.
    expect(hardwareTierFor(estimateNeededVramGB({ minVramGB: 16, sizeBytes: 12.7 * GB }))).toBe('top');
  });
});

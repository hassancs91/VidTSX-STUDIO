import { describe, expect, it } from 'vitest';
import { evaluateFit } from '@shared/model-library/fit';

const GB = 1_000_000_000;

describe('evaluateFit', () => {
  it('grades a small model that fits comfortably as ok', () => {
    // SD 1.5 Q4 ~1.7 GB → ~3.2 GB needed on a 6 GB GPU.
    const result = evaluateFit({ minVramGB: 2, sizeBytes: 1.7 * GB }, { vramGB: 6, ramGB: 32 });
    expect(result.level).toBe('ok');
    expect(result.canOffload).toBe(true);
    expect(result.neededVramGB).toBeCloseTo(3.2, 5);
  });

  it('grades a model slightly over VRAM (within the tight band) as tight', () => {
    // ~5.5 GB file → ~7.0 GB needed; 6 GB GPU, within the 1.5 GB tight band.
    const result = evaluateFit({ sizeBytes: 5.5 * GB }, { vramGB: 6, ramGB: 32 });
    expect(result.level).toBe('tight');
    expect(result.canOffload).toBe(true);
  });

  it('grades a model over VRAM but well within RAM as offload', () => {
    // SD 3.5 Large Q4 ~11.9 GB → ~13.4 GB needed; over 6 GB VRAM, fits 32 GB RAM.
    const result = evaluateFit({ minVramGB: 8, sizeBytes: 11.9 * GB }, { vramGB: 6, ramGB: 32 });
    expect(result.level).toBe('offload');
    expect(result.canOffload).toBe(true);
  });

  it('grades a model that fits neither VRAM nor RAM as wont-fit', () => {
    // Flux Dev Q8 ~13.4 GB → ~14.9 GB needed; 6 GB VRAM, only 8 GB RAM.
    const result = evaluateFit({ sizeBytes: 13.4 * GB }, { vramGB: 6, ramGB: 8 });
    expect(result.level).toBe('wont-fit');
    expect(result.canOffload).toBe(false);
  });

  it('returns unknown (no scary warning) when VRAM is undetected', () => {
    const result = evaluateFit({ minVramGB: 8, sizeBytes: 12 * GB }, { vramGB: null, ramGB: 32 });
    expect(result.level).toBe('unknown');
    expect(result.canOffload).toBe(true);
  });

  it('treats zero/missing VRAM as unknown', () => {
    expect(evaluateFit({ sizeBytes: 4 * GB }, { vramGB: 0, ramGB: 16 }).level).toBe('unknown');
    expect(evaluateFit({ sizeBytes: 4 * GB }, {}).level).toBe('unknown');
  });

  it('falls back to the size estimate when no minVramGB floor is given', () => {
    // Custom import: pure size estimate. 3 GB file → 4.5 GB needed on a 6 GB GPU → ok.
    const result = evaluateFit({ sizeBytes: 3 * GB }, { vramGB: 6, ramGB: 16 });
    expect(result.level).toBe('ok');
    expect(result.neededVramGB).toBeCloseTo(4.5, 5);
  });

  it('raises the estimate to the floor when the floor is higher than the size estimate', () => {
    // Tiny 1 GB file but a 6 GB family floor (e.g. bundled encoders) → needed = 6.
    const result = evaluateFit({ minVramGB: 6, sizeBytes: 1 * GB }, { vramGB: 6, ramGB: 16 });
    expect(result.neededVramGB).toBe(6);
    expect(result.level).toBe('ok');
  });

  it('offloads (never hard-blocks) when over VRAM but RAM is unknown', () => {
    // Known VRAM insufficient, RAM unknown → must not false-positive wont-fit.
    const result = evaluateFit({ sizeBytes: 12 * GB }, { vramGB: 6, ramGB: null });
    expect(result.level).toBe('offload');
    expect(result.canOffload).toBe(true);
  });

  it('is ok exactly at the VRAM boundary (overhead already included)', () => {
    // 4.5 GB file → 6.0 GB needed on a 6 GB GPU → exactly ok.
    const result = evaluateFit({ sizeBytes: 4.5 * GB }, { vramGB: 6, ramGB: 16 });
    expect(result.neededVramGB).toBe(6);
    expect(result.level).toBe('ok');
  });
});

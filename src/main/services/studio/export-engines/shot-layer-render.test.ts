// One shot-layer render per cluster of composite spans (Engine 3): the pure
// clustering rule behind `ShotLayerRuns` — gaps under the merge threshold are
// rendered through, a wider gap or the plan's end closes the run.
import { describe, expect, it } from 'vitest';
import type { ExportSpan } from '../../../../shared/studio/export-spans';
import { LAYER_MERGE_GAP_FRAMES, layerRunEnd } from './shot-layer-render';

const composite = (from: number, frames: number): ExportSpan => ({ kind: 'composite', from, frames, base: { kind: 'black', from, frames } });
const copy = (from: number, frames: number): ExportSpan => ({ kind: 'copy', from, frames, assetId: 'a', assetPath: 'a.mp4', sourceFrame: from, firstFrameCeil: false });
const browser = (from: number, frames: number): ExportSpan => ({ kind: 'browser', from, frames, reason: 'transform' });

describe('layerRunEnd', () => {
  it('spans contiguous composite spans and short gaps, stops at a wide gap or the end', () => {
    const plan = [copy(0, 100), composite(100, 60), composite(160, 40), copy(200, 3), composite(203, 50), browser(253, 400), composite(653, 30)];
    expect(layerRunEnd(plan, 1)).toBe(253);
    expect(layerRunEnd(plan, 4)).toBe(253);
    expect(layerRunEnd(plan, 6)).toBe(683);
  });

  it('adds up several small gaps before giving up', () => {
    const half = Math.floor(LAYER_MERGE_GAP_FRAMES / 2);
    const plan = [composite(0, 10), copy(10, half), composite(10 + half, 10), copy(20 + half, half), composite(20 + 2 * half, 10), copy(30 + 2 * half, LAYER_MERGE_GAP_FRAMES), composite(30 + 2 * half + LAYER_MERGE_GAP_FRAMES, 10)];
    expect(layerRunEnd(plan, 0)).toBe(30 + 2 * half);
  });
});

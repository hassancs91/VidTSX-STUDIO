import { describe, it, expect } from 'vitest';
import { pricedSteps, pricedStepsLine } from './priced-steps';

const graph = {
  nodes: [
    { id: 'n-text', toolId: 'input_text', position: { x: 0, y: 0 }, config: {}, pause: false },
    { id: 'n-img', toolId: 'generate_image', position: { x: 1, y: 0 }, config: {}, pause: false },
    { id: 'n-vid', toolId: 'generate_video', position: { x: 2, y: 0 }, config: {}, pause: false },
    { id: 'n-vid-2', toolId: 'generate_video', position: { x: 3, y: 0 }, config: {}, pause: false },
    { id: 'n-ghost', toolId: 'not_registered', position: { x: 4, y: 0 }, config: {}, pause: false },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

const specs = {
  input_text: { label: 'Text' },
  generate_image: { label: 'Generate Image', priced: true },
  generate_video: { label: 'Generate Video', priced: true, priceHint: 'hailuo-02 $0.045/s' },
};

describe('pricedSteps', () => {
  it('lists priced nodes in graph order with their hints; unknown and free nodes are skipped', () => {
    expect(pricedSteps({ graph }, specs)).toEqual([
      { nodeId: 'n-img', label: 'Generate Image' },
      { nodeId: 'n-vid', label: 'Generate Video', priceHint: 'hailuo-02 $0.045/s' },
      { nodeId: 'n-vid-2', label: 'Generate Video', priceHint: 'hailuo-02 $0.045/s' },
    ]);
  });

  it('the line folds repeats with a count and is empty for a free flow', () => {
    expect(pricedStepsLine(pricedSteps({ graph }, specs))).toBe(
      'Priced steps: Generate Image, Generate Video ×2 (hailuo-02 $0.045/s)',
    );
    expect(pricedStepsLine([])).toBe('');
  });
});

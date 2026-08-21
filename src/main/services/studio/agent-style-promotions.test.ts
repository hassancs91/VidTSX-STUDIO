import { beforeEach, describe, expect, it } from 'vitest';
import {
  addPromotion,
  clearAllPromotions,
  findPromotion,
  getPendingPromotions,
  hasPendingPromotion,
  removePromotion,
} from './agent-style-promotions';

const INPUT = {
  projectId: 'proj1',
  memoryId: 'mem1',
  ruleText: 'Subtler entrances.',
  brandId: 'acme-test',
  brandName: 'Acme Test',
  evidence: 'Held across intro-title and end-card.',
  proposedStyleNotes: '- Subtler entrances.',
};

describe('agent-style-promotions queue (Q6c)', () => {
  beforeEach(() => clearAllPromotions());

  it('queues one promotion per project and finds it by id', () => {
    const p = addPromotion(INPUT);
    expect(hasPendingPromotion('proj1')).toBe(true);
    expect(getPendingPromotions('proj1')).toEqual([p]);
    expect(findPromotion('proj1', p.id)).toEqual(p);
    expect(() => addPromotion(INPUT)).toThrow(/already waiting/);
  });

  it('removal is scoped and idempotent', () => {
    const p = addPromotion(INPUT);
    removePromotion('proj1', 'other-id');
    expect(hasPendingPromotion('proj1')).toBe(true);
    removePromotion('proj1', p.id);
    removePromotion('proj1', p.id);
    expect(getPendingPromotions('proj1')).toEqual([]);
  });
});

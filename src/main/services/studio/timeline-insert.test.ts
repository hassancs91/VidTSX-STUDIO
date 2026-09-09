import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INSERT_IMAGE_DURATION,
  buildInsertProposal,
  defaultInsertDuration,
  resolveWordAnchor,
} from './timeline-insert';

const words = [
  { text: 'So', start: 0.2, end: 0.4 },
  { text: 'the', start: 0.5, end: 0.6 },
  { text: 'dashboard,', start: 0.7, end: 1.2 },
  { text: 'right', start: 1.3, end: 1.5 },
  { text: 'the', start: 2.0, end: 2.1 },
  { text: 'Dashboard', start: 2.2, end: 2.8 },
  { text: 'shows', start: 2.9, end: 3.1 },
];

describe('resolveWordAnchor', () => {
  it('finds the Nth occurrence ignoring case and punctuation', () => {
    expect(resolveWordAnchor(words, 'dashboard')).toEqual({ start: 0.7, take: 1, total: 2 });
    expect(resolveWordAnchor(words, 'Dashboard.', 2)).toEqual({ start: 2.2, take: 2, total: 2 });
  });

  it('matches short phrases across words', () => {
    expect(resolveWordAnchor(words, 'the dashboard', 2)).toEqual({ start: 2.0, take: 2, total: 2 });
  });

  it('reports the total when the take is out of range or the word is absent', () => {
    expect(resolveWordAnchor(words, 'dashboard', 3)).toEqual({ start: null, take: 3, total: 2 });
    expect(resolveWordAnchor(words, 'chart')).toEqual({ start: null, take: 1, total: 0 });
    expect(resolveWordAnchor(words, '  ')).toEqual({ start: null, take: 1, total: 0 });
  });
});

describe('buildInsertProposal', () => {
  const clip = { id: 'a1', name: 'skyline.mp4', kind: 'video' as const, durationSeconds: 8 };

  it('defaults durations from the asset (images 5 s) and clamps to the source', () => {
    expect(defaultInsertDuration({ ...clip, kind: 'image' })).toBe(DEFAULT_INSERT_IMAGE_DURATION);
    expect(defaultInsertDuration(clip)).toBe(8);
    const proposal = buildInsertProposal({ asset: clip, lane: 'broll', at: { timelineStart: 12 }, duration: 20 });
    expect(proposal.items[0].duration).toBe(8);
  });

  it('builds a one-item accepted insert plan at a timeline position', () => {
    const proposal = buildInsertProposal({
      asset: clip,
      lane: 'broll',
      at: { timelineStart: 12.5 },
      duration: 4,
      note: 'cover the pause',
    });
    expect(proposal.kind).toBe('insert-plan');
    expect(proposal.status).toBe('proposed');
    expect(proposal.items).toHaveLength(1);
    expect(proposal.items[0]).toMatchObject({
      status: 'accepted',
      timelineStart: 12.5,
      duration: 4,
      note: 'cover the pause',
      insert: { assetId: 'a1', kind: 'video', lane: 'broll' },
    });
    expect(proposal.items[0].assetId).toBeUndefined();
    expect(proposal.agentNote).toContain('skyline.mp4');
    expect(proposal.agentNote).toContain('b-roll');
    expect(proposal.agentNote).toContain('0:12.5');
  });

  it('anchors to the footage as a source span when given a word position', () => {
    const proposal = buildInsertProposal({
      asset: { id: 'img', name: 'logo.png', kind: 'image' },
      lane: 'overlay',
      at: { anchorAssetId: 'footage', sourceStart: 2.2 },
      gain: 0.5,
    });
    expect(proposal.items[0]).toMatchObject({
      assetId: 'footage',
      sourceStart: 2.2,
      sourceEnd: 7.2,
      duration: 5,
      insert: { assetId: 'img', kind: 'image', lane: 'overlay', gain: 0.5 },
    });
    expect(proposal.items[0].timelineStart).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import type { StudioProposal, StudioTimeline } from '../types';
import { applyInsertProposal, insertItemPlacement } from './apply-insert-proposal';

function timeline(): StudioTimeline {
  return {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'Video 1',
        clips: [
          // Footage trimmed: source 0–10 removed, 10–40 plays from t=0.
          { id: 'c1', kind: 'video', assetId: 'footage', timelineStart: 0, duration: 30, sourceIn: 10 },
        ],
      },
    ],
  };
}

function proposal(items: StudioProposal['items']): StudioProposal {
  return { id: 'prop_1', kind: 'insert-plan', status: 'proposed', createdAt: 'now', items };
}

describe('applyInsertProposal', () => {
  it('places b-roll on a new overlay lane at the mapped footage anchor', () => {
    const next = applyInsertProposal(
      timeline(),
      proposal([
        {
          id: 'i1',
          status: 'accepted',
          assetId: 'footage',
          sourceStart: 15,
          sourceEnd: 19,
          duration: 4,
          insert: { assetId: 'broll', kind: 'video', lane: 'broll' },
        },
      ]),
    );
    expect(next.tracks[0].kind).toBe('overlay');
    const clip = next.tracks[0].clips[0];
    expect(clip).toMatchObject({
      kind: 'video',
      assetId: 'broll',
      timelineStart: 5,
      duration: 4,
      sourceIn: 0,
      origin: { by: 'agent', proposalId: 'prop_1' },
    });
    // The master lane is untouched — covering, never displacing.
    expect(next.tracks[1].clips).toHaveLength(1);
  });

  it('places audio on an audio lane at the timeline fallback, with gain', () => {
    const next = applyInsertProposal(
      timeline(),
      proposal([
        {
          id: 'i1',
          status: 'accepted',
          timelineStart: 12,
          duration: 8,
          insert: { assetId: 'music', kind: 'audio', lane: 'audio', gain: 0.4 },
        },
      ]),
    );
    const audio = next.tracks[next.tracks.length - 1];
    expect(audio.kind).toBe('audio');
    expect(audio.clips[0]).toMatchObject({ kind: 'audio', assetId: 'music', timelineStart: 12, gain: 0.4 });
  });

  it('returns the same timeline when nothing is accepted or placeable', () => {
    const tl = timeline();
    expect(
      applyInsertProposal(
        tl,
        proposal([
          { id: 'r', status: 'rejected', timelineStart: 1, duration: 2, insert: { assetId: 'x', kind: 'image', lane: 'overlay' } },
          // Anchor outside every clip (source 0–10 was cut away) — skipped.
          { id: 'gone', status: 'accepted', assetId: 'footage', sourceStart: 2, sourceEnd: 4, duration: 2, insert: { assetId: 'x', kind: 'image', lane: 'overlay' } },
        ]),
      ),
    ).toBe(tl);
    expect(
      insertItemPlacement(tl, { id: 'gone', status: 'accepted', assetId: 'footage', sourceStart: 2, sourceEnd: 4 }),
    ).toBeNull();
  });
});

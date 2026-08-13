import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '../types';
import { addMarker, moveMarker, removeMarker, renameMarker } from './marker-ops';

function base(): StudioTimeline {
  return {
    tracks: [],
    markers: [
      { id: 'm1', time: 2, label: 'Intro' },
      { id: 'm2', time: 8 },
    ],
  };
}

describe('addMarker', () => {
  it('adds at the given time, kept sorted', () => {
    const next = addMarker(base(), 'm3', 5);
    expect(next.markers?.map((m) => m.id)).toEqual(['m1', 'm3', 'm2']);
    expect(next.markers?.[1].time).toBe(5);
  });

  it('starts the markers array on a timeline that has none', () => {
    const next = addMarker({ tracks: [] }, 'm1', 1.5, '  Beat  ');
    expect(next.markers).toEqual([{ id: 'm1', time: 1.5, label: 'Beat' }]);
  });

  it('clamps negative times to zero and rejects non-finite ones', () => {
    expect(addMarker({ tracks: [] }, 'm1', -3).markers?.[0].time).toBe(0);
    const timeline = base();
    expect(addMarker(timeline, 'm3', Number.NaN)).toBe(timeline);
  });

  it('rejects a duplicate id (identity)', () => {
    const timeline = base();
    expect(addMarker(timeline, 'm1', 5)).toBe(timeline);
  });
});

describe('moveMarker', () => {
  it('moves and re-sorts', () => {
    const next = moveMarker(base(), 'm1', 10);
    expect(next.markers?.map((m) => m.id)).toEqual(['m2', 'm1']);
    expect(next.markers?.[1].time).toBe(10);
  });

  it('clamps to zero', () => {
    const next = moveMarker(base(), 'm2', -1);
    expect(next.markers?.find((m) => m.id === 'm2')?.time).toBe(0);
  });

  it('is identity on unknown id, non-finite time, or no change', () => {
    const timeline = base();
    expect(moveMarker(timeline, 'nope', 4)).toBe(timeline);
    expect(moveMarker(timeline, 'm1', Number.POSITIVE_INFINITY)).toBe(timeline);
    expect(moveMarker(timeline, 'm1', 2)).toBe(timeline);
  });
});

describe('removeMarker', () => {
  it('removes by id', () => {
    const next = removeMarker(base(), 'm1');
    expect(next.markers?.map((m) => m.id)).toEqual(['m2']);
  });

  it('drops the markers key entirely when the last one goes', () => {
    const next = removeMarker(removeMarker(base(), 'm1'), 'm2');
    expect('markers' in next).toBe(false);
  });

  it('is identity on unknown id', () => {
    const timeline = base();
    expect(removeMarker(timeline, 'nope')).toBe(timeline);
  });
});

describe('renameMarker', () => {
  it('sets a trimmed label', () => {
    const next = renameMarker(base(), 'm2', '  Outro ');
    expect(next.markers?.find((m) => m.id === 'm2')?.label).toBe('Outro');
  });

  it('removes the label key on an empty rename', () => {
    const next = renameMarker(base(), 'm1', '   ');
    expect('label' in next.markers![0]).toBe(false);
  });

  it('is identity on unknown id or unchanged label', () => {
    const timeline = base();
    expect(renameMarker(timeline, 'nope', 'X')).toBe(timeline);
    expect(renameMarker(timeline, 'm1', 'Intro')).toBe(timeline);
    expect(renameMarker(timeline, 'm2', '')).toBe(timeline);
  });
});

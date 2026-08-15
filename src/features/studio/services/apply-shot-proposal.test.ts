import { describe, it, expect } from 'vitest';
import type { StudioClip, StudioProposal, StudioShot, StudioTimeline } from '../types';
import {
  applyShotProposal,
  insertShotClip,
  isFromScratchTimeline,
  shotItemPlacement,
} from './apply-shot-proposal';
import { timelineReducer } from '../hooks/useTimeline';

function shot(overrides: Partial<StudioShot> = {}): StudioShot {
  return {
    id: 'shot-a',
    name: 'Stat card',
    kind: 'cutaway',
    createdAt: '',
    activeVersion: 1,
    status: 'ready',
    config: { durationInFrames: 120, fps: 30, width: 1920, height: 1080 },
    ...overrides,
  };
}

function videoClip(id: string, timelineStart: number, duration: number, sourceIn = 0): StudioClip {
  return { id, kind: 'video', assetId: 'asset-1', timelineStart, duration, sourceIn };
}

function masterTimeline(): StudioTimeline {
  return {
    tracks: [
      { id: 'v1', kind: 'video', name: 'V1', clips: [videoClip('c1', 0, 20, 5)] },
      { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
    ],
  };
}

function proposal(items: StudioProposal['items']): StudioProposal {
  return { id: 'prop-1', kind: 'shot-plan', status: 'proposed', createdAt: '', items };
}

const anchoredItem = (shotId: string, sourceStart: number, sourceEnd: number) => ({
  id: `i-${shotId}`,
  status: 'accepted' as const,
  shotId,
  assetId: 'asset-1',
  sourceStart,
  sourceEnd,
  duration: sourceEnd - sourceStart,
  mode: 'overlay' as const,
});

describe('shotItemPlacement', () => {
  it('maps the anchor through the clip that plays the asset (sourceIn honored)', () => {
    // Clip plays source 5–25 at timeline 0–20 → source 10 lands at timeline 5.
    const at = shotItemPlacement(masterTimeline(), anchoredItem('shot-a', 10, 13));
    expect(at).toBe(5);
  });

  it('falls back to timelineStart for unanchored items, clamped to ≥ 0', () => {
    const item = { id: 'i', status: 'accepted' as const, shotId: 'shot-a', timelineStart: -3 };
    expect(shotItemPlacement(masterTimeline(), item)).toBe(0);
  });

  it('returns null when the span is off-timeline and no fallback exists', () => {
    expect(
      shotItemPlacement(masterTimeline(), anchoredItem('shot-a', 100, 103)),
    ).toBeNull();
  });
});

describe('applyShotProposal', () => {
  it('places accepted shots on a created overlay lane at their mapped anchors', () => {
    const shots = [shot(), shot({ id: 'shot-b' })];
    const next = applyShotProposal(
      masterTimeline(),
      proposal([anchoredItem('shot-a', 10, 13), anchoredItem('shot-b', 15, 18)]),
      shots,
    );
    const overlay = next.tracks.find((t) => t.kind === 'overlay');
    expect(overlay).toBeDefined();
    expect(next.tracks[0]).toBe(overlay); // created on top
    expect(overlay!.clips.map((c) => [c.tsx?.shotId, c.timelineStart, c.duration])).toEqual([
      ['shot-a', 5, 3],
      ['shot-b', 10, 3],
    ]);
    expect(overlay!.clips[0].origin).toEqual({ by: 'agent', proposalId: 'prop-1' });
    expect(overlay!.clips[0].sourceIn).toBe(0); // split-continuity invariant
  });

  it('reuses an existing overlay lane and skips vetoed/not-ready/missing shots', () => {
    const timeline: StudioTimeline = {
      tracks: [
        { id: 'o1', kind: 'overlay', name: 'FX', clips: [] },
        ...masterTimeline().tracks,
      ],
    };
    const shots = [shot(), shot({ id: 'shot-err', status: 'error' })];
    const next = applyShotProposal(
      timeline,
      proposal([
        { ...anchoredItem('shot-a', 10, 13), status: 'rejected' },
        anchoredItem('shot-err', 15, 18), // not ready
        anchoredItem('shot-ghost', 15, 18), // not in registry
      ]),
      shots,
    );
    expect(next).toBe(timeline); // identity — nothing applied
  });

  it('from-scratch: accepted shots land back-to-back on the master lane as cutaways', () => {
    const empty: StudioTimeline = {
      tracks: [
        { id: 'v1', kind: 'video', name: 'V1', clips: [] },
        { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
      ],
    };
    expect(isFromScratchTimeline(empty)).toBe(true);
    const shots = [
      shot({ id: 's1', config: { durationInFrames: 90, fps: 30, width: 1, height: 1 } }),
      shot({ id: 's2', kind: 'overlay', config: { durationInFrames: 60, fps: 30, width: 1, height: 1 } }),
    ];
    const items = [
      { id: 'i1', status: 'accepted' as const, shotId: 's1', duration: 3, mode: 'cutaway' as const },
      { id: 'i2', status: 'accepted' as const, shotId: 's2', duration: 2, mode: 'overlay' as const },
    ];
    const next = applyShotProposal(empty, proposal(items), shots);
    const v1 = next.tracks.find((t) => t.id === 'v1')!;
    expect(v1.clips.map((c) => [c.tsx?.shotId, c.timelineStart, c.tsx?.mode])).toEqual([
      ['s1', 0, 'cutaway'],
      ['s2', 3, 'cutaway'], // forced opaque — nothing plays underneath
    ]);
    // A tsx clip on the timeline does NOT flip the project out of from-scratch.
    expect(isFromScratchTimeline(next)).toBe(true);
  });
});

describe('insertShotClip (pool-button path)', () => {
  it('creates the overlay lane on demand and lands at the recorded playhead', () => {
    const next = insertShotClip(masterTimeline(), shot(), 7.5, 'clip-new');
    const overlay = next.tracks.find((t) => t.kind === 'overlay')!;
    expect(overlay.clips).toHaveLength(1);
    expect(overlay.clips[0].id).toBe('clip-new');
    expect(overlay.clips[0].timelineStart).toBe(7.5);
    expect(overlay.clips[0].duration).toBe(4); // from config
  });

  it('refuses shots that are not ready', () => {
    const tl = masterTimeline();
    expect(insertShotClip(tl, shot({ status: 'error' }), 0, 'x')).toBe(tl);
  });

  it('from-scratch projects insert onto the master lane as cutaways', () => {
    const empty: StudioTimeline = {
      tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips: [] }],
    };
    const next = insertShotClip(empty, shot({ kind: 'overlay' }), 0, 'clip-new');
    expect(next.tracks.find((t) => t.id === 'v1')!.clips[0].tsx?.mode).toBe('cutaway');
  });
});

describe('reducer round-trips (shot proposals, D8/D9)', () => {
  const baseState = (shots: StudioShot[], prop: StudioProposal) => ({
    projectId: 'p1',
    past: [],
    present: { timeline: masterTimeline(), proposals: [prop], shots, captions: null },
    future: [],
  });

  it('proposal-apply (shot-plan) inserts clips + closes the proposal in ONE undo step', () => {
    const prop = proposal([anchoredItem('shot-a', 10, 13)]);
    const s1 = baseState([shot()], prop);
    const s2 = timelineReducer(s1, { type: 'proposal-apply', proposalId: 'prop-1' });
    expect(s2.present.proposals[0].status).toBe('applied');
    expect(s2.present.timeline.tracks.some((t) => t.kind === 'overlay')).toBe(true);
    expect(s2.present.shots).toBe(s1.present.shots); // registry untouched by apply
    const undone = timelineReducer(s2, { type: 'undo' });
    expect(undone.present).toBe(s1.present);
  });

  it('proposal-reject (shot-plan) drops the registry entries; undo restores them', () => {
    const prop = proposal([anchoredItem('shot-a', 10, 13)]);
    const keeper = shot({ id: 'shot-keeper' });
    const s1 = baseState([shot(), keeper], prop);
    const s2 = timelineReducer(s1, { type: 'proposal-reject', proposalId: 'prop-1' });
    expect(s2.present.proposals[0].status).toBe('rejected');
    expect(s2.present.shots.map((s) => s.id)).toEqual(['shot-keeper']);
    const undone = timelineReducer(s2, { type: 'undo' });
    expect(undone.present.shots.map((s) => s.id)).toEqual(['shot-a', 'shot-keeper']);
  });

  it('cut-plan reject still leaves the registry alone', () => {
    const cutProp: StudioProposal = {
      id: 'prop-c',
      kind: 'cut-plan',
      status: 'proposed',
      createdAt: '',
      items: [{ id: 'i1', status: 'accepted', assetId: 'asset-1', sourceStart: 1, sourceEnd: 2 }],
    };
    const s1 = baseState([shot()], cutProp);
    const s2 = timelineReducer(s1, { type: 'proposal-reject', proposalId: 'prop-c' });
    expect(s2.present.shots).toBe(s1.present.shots);
  });

  it('shot-clip-insert is one undoable step and lands the minted clip id', () => {
    const s1 = {
      projectId: 'p1',
      past: [],
      present: { timeline: masterTimeline(), proposals: [], shots: [shot()], captions: null },
      future: [],
    };
    const s2 = timelineReducer(s1, {
      type: 'shot-clip-insert',
      shot: shot(),
      preferredStart: 3,
      newClipId: 'clip-x',
    });
    const overlay = s2.present.timeline.tracks.find((t) => t.kind === 'overlay')!;
    expect(overlay.clips[0].id).toBe('clip-x');
    expect(timelineReducer(s2, { type: 'undo' }).present).toBe(s1.present);
  });
});

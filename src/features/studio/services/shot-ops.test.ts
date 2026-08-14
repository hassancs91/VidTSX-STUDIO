import { describe, it, expect } from 'vitest';
import type { StudioClip, StudioProposal, StudioShot, StudioTimeline } from '../types';
import { removeClipsForShot, removeShot, setShotVersion } from './shot-ops';
import { clipFromShot, DEFAULT_SHOT_DURATION } from './clip-factory';
import { timelineReducer, type TimelineAction } from '../hooks/useTimeline';

function shot(overrides: Partial<StudioShot> = {}): StudioShot {
  return {
    id: 'shot-a',
    name: 'Intro title',
    kind: 'title',
    createdAt: '',
    activeVersion: 1,
    status: 'ready',
    ...overrides,
  };
}

function tsxClip(id: string, shotId: string, timelineStart = 0): StudioClip {
  return {
    id,
    kind: 'tsx',
    timelineStart,
    duration: 4,
    sourceIn: 0,
    tsx: { shotId, mode: 'overlay' },
  };
}

function timeline(clips: StudioClip[]): StudioTimeline {
  return { tracks: [{ id: 'o1', kind: 'overlay', name: 'FX1', clips }] };
}

describe('setShotVersion', () => {
  it('bumps activeVersion immutably', () => {
    const shots = [shot(), shot({ id: 'shot-b' })];
    const next = setShotVersion(shots, 'shot-a', 2);
    expect(next).not.toBe(shots);
    expect(next[0].activeVersion).toBe(2);
    expect(next[1]).toBe(shots[1]);
  });

  it('returns the same array when nothing changes (no undo step)', () => {
    const shots = [shot()];
    expect(setShotVersion(shots, 'shot-a', 1)).toBe(shots); // already there
    expect(setShotVersion(shots, 'ghost', 2)).toBe(shots); // unknown shot
    expect(setShotVersion(shots, 'shot-a', 0)).toBe(shots); // invalid version
    expect(setShotVersion(shots, 'shot-a', 1.5)).toBe(shots);
  });
});

describe('removeShot / removeClipsForShot', () => {
  it('removes the entry and every referencing clip on every track', () => {
    const shots = [shot(), shot({ id: 'shot-b' })];
    expect(removeShot(shots, 'shot-a').map((s) => s.id)).toEqual(['shot-b']);
    expect(removeShot(shots, 'ghost')).toBe(shots);

    const tl: StudioTimeline = {
      tracks: [
        { id: 'o1', kind: 'overlay', name: 'FX1', clips: [tsxClip('t1', 'shot-a')] },
        {
          id: 'o2',
          kind: 'overlay',
          name: 'FX2',
          clips: [tsxClip('t2', 'shot-a', 5), tsxClip('t3', 'shot-b', 10)],
        },
      ],
    };
    const next = removeClipsForShot(tl, 'shot-a');
    expect(next.tracks.flatMap((t) => t.clips.map((c) => c.id))).toEqual(['t3']);
    expect(removeClipsForShot(tl, 'ghost')).toBe(tl);
  });
});

describe('clipFromShot', () => {
  it('takes duration from the shot config and pins sourceIn to 0', () => {
    const clip = clipFromShot(
      shot({ config: { durationInFrames: 90, fps: 30, width: 1280, height: 720 } }),
    );
    expect(clip).toMatchObject({
      kind: 'tsx',
      duration: 3,
      sourceIn: 0,
      tsx: { shotId: 'shot-a', mode: 'overlay' },
    });
    expect(clipFromShot(shot()).duration).toBe(DEFAULT_SHOT_DURATION);
  });

  it('maps shot kind to clip mode: cutaway stays, title becomes overlay', () => {
    expect(clipFromShot(shot({ kind: 'cutaway' })).tsx?.mode).toBe('cutaway');
    expect(clipFromShot(shot({ kind: 'title' })).tsx?.mode).toBe('overlay');
  });
});

// ---------------------------------------------------------------------------
// Reducer integration (D9): shots ride the same undo history as the timeline.
// ---------------------------------------------------------------------------

function freshState(shots: StudioShot[], clips: StudioClip[] = [], proposals: StudioProposal[] = []) {
  return timelineReducer(
    { projectId: null, past: [], present: { timeline: { tracks: [] }, proposals: [], shots: [] }, future: [] },
    { type: 'reset', projectId: 'p', timeline: timeline(clips), proposals, shots },
  );
}

function dispatch(
  state: ReturnType<typeof freshState>,
  ...actions: TimelineAction[]
): ReturnType<typeof freshState> {
  return actions.reduce(timelineReducer, state);
}

describe('timelineReducer shot actions', () => {
  it('shot-set-version is one undoable step; undo flips the pointer back', () => {
    let state = freshState([shot()]);
    state = dispatch(state, { type: 'shot-set-version', shotId: 'shot-a', version: 2 });
    expect(state.present.shots[0].activeVersion).toBe(2);
    expect(state.past).toHaveLength(1);
    state = dispatch(state, { type: 'undo' });
    expect(state.present.shots[0].activeVersion).toBe(1);
    state = dispatch(state, { type: 'redo' });
    expect(state.present.shots[0].activeVersion).toBe(2);
  });

  it('a no-op shot action creates no undo step', () => {
    const state = freshState([shot()]);
    expect(dispatch(state, { type: 'shot-set-version', shotId: 'shot-a', version: 1 })).toBe(state);
    expect(dispatch(state, { type: 'shot-remove', shotId: 'ghost' })).toBe(state);
  });

  it('shot-remove drops the entry and its clips in ONE undo step', () => {
    let state = freshState([shot(), shot({ id: 'shot-b' })], [
      tsxClip('t1', 'shot-a'),
      tsxClip('t2', 'shot-b', 5),
    ]);
    state = dispatch(state, { type: 'shot-remove', shotId: 'shot-a' });
    expect(state.present.shots.map((s) => s.id)).toEqual(['shot-b']);
    expect(state.present.timeline.tracks[0].clips.map((c) => c.id)).toEqual(['t2']);
    state = dispatch(state, { type: 'undo' });
    expect(state.present.shots).toHaveLength(2);
    expect(state.present.timeline.tracks[0].clips).toHaveLength(2);
  });

  it('shots-adopt updates present WITHOUT history entries and rewrites past/future', () => {
    let state = freshState([]);
    // A real user edit to have history on both sides.
    state = dispatch(
      state,
      { type: 'add', trackId: 'o1', clip: tsxClip('t1', 'shot-a') },
      { type: 'undo' },
    );
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(1);

    const arrived = [shot({ status: 'ready' })];
    state = dispatch(state, { type: 'shots-adopt', shots: arrived });
    expect(state.present.shots).toBe(arrived);
    expect(state.past).toHaveLength(0); // no undo step planted
    expect(state.future).toHaveLength(1); // redo stack survives
    // Redo an unrelated edit — the adopted registry must not be wiped.
    state = dispatch(state, { type: 'redo' });
    expect(state.present.shots).toBe(arrived);
  });

  it('proposal-apply carries the shot registry through its rebuilt doc', () => {
    const proposal: StudioProposal = {
      id: 'pr1',
      kind: 'cut-plan',
      status: 'proposed',
      createdAt: '',
      items: [],
    };
    let state = freshState([shot()], [], [proposal]);
    state = dispatch(state, { type: 'proposal-apply', proposalId: 'pr1' });
    expect(state.present.proposals[0].status).not.toBe('proposed');
    expect(state.present.shots.map((s) => s.id)).toEqual(['shot-a']);
  });
});

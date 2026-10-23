// B7 step 9 (a): which clips still have no card of this cut run. Pass 2 of the
// live exit run is the case: after Auto Cut on 0370 the model counted five clips
// left (six were) and ran 0372 next — 0371 never got Auto Cut.
import { describe, expect, it } from 'vitest';
import type { StudioClip, StudioProposal, StudioTimeline } from '../types/studio';
import { clipsWithoutCard, cutRunKind, formatCutRunLine, timelineMediaAssets } from './cut-sweep';

const M2 = ['0366', '0369', '0370', '0371', '0372', '0373', '0374', '0375', '0376'];

function clip(assetId: string, start: number, kind: 'video' | 'audio' = 'video'): StudioClip {
  return { id: `c-${assetId}-${start}-${kind}`, kind, assetId, timelineStart: start, duration: 1, sourceIn: 0 } as unknown as StudioClip;
}

/** The nine clips back to back on V1, each split once by an applied cut (two clips per asset). */
function m2Timeline(): StudioTimeline {
  const clips = M2.flatMap((id, i) => [clip(id, i * 10), clip(id, i * 10 + 5)]);
  return { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips } as unknown as StudioTimeline['tracks'][number]] };
}

let seq = 0;
function card(kind: 'auto-cut' | 'editorial', assetId: string, status: StudioProposal['status'] = 'applied'): StudioProposal {
  seq += 1;
  return {
    id: `p${seq}`,
    kind: 'cut-plan',
    status,
    createdAt: new Date(Date.UTC(2026, 9, 23, 15, 57, seq)).toISOString(),
    agentNote: kind === 'auto-cut' ? 'Auto Cut (tight · default) · −3.1 s of 20.0 s' : 'Editorial cut · assemblyai · −2.0 s of 30.0 s',
    items: [{ id: `i${seq}`, status: 'accepted', assetId, sourceStart: 1, sourceEnd: 2 } as StudioProposal['items'][number]],
  };
}

/** Pass 2's editorial run: a card for every clip but 0374 (read, nothing cut). */
function editorialRun(): StudioProposal[] {
  return M2.filter((id) => id !== '0374').map((id) => card('editorial', id, id === '0369' ? 'rejected' : 'applied'));
}

describe('cutRunKind', () => {
  it('tells the two cut cards apart by their headline; other proposals are neither', () => {
    expect(cutRunKind(card('auto-cut', 'a'))).toBe('auto-cut');
    expect(cutRunKind(card('editorial', 'a'))).toBe('editorial');
    expect(cutRunKind({ ...card('auto-cut', 'a'), kind: 'shot-plan' } as StudioProposal)).toBeNull();
    expect(cutRunKind({ ...card('auto-cut', 'a'), agentNote: undefined })).toBeNull();
  });
});

describe('timelineMediaAssets', () => {
  it('each asset once, by its first clip start; linked audio and non-media clips add nothing', () => {
    const timeline: StudioTimeline = {
      tracks: [
        { id: 'v1', kind: 'video', name: 'V1', clips: [clip('b', 4), clip('a', 0), clip('b', 9)] },
        { id: 'a1', kind: 'audio', name: 'A1', clips: [clip('a', 0, 'audio'), clip('c', 2, 'audio')] },
        { id: 't1', kind: 'video', name: 'T', clips: [{ id: 'x', kind: 'shot', timelineStart: 1, duration: 1 } as unknown as StudioClip] },
      ] as unknown as StudioTimeline['tracks'],
    };
    expect(timelineMediaAssets(timeline)).toEqual(['a', 'c', 'b']);
    expect(timelineMediaAssets(undefined)).toEqual([]);
  });
});

describe('clipsWithoutCard — pass 2 (turn 11 = 0370 done, 0371 next)', () => {
  it('Auto Cut on 0366 0369 0370: the other six, in timeline order, 0371 first; the editorial cards do not count', () => {
    const disk = [...editorialRun(), card('auto-cut', '0366'), card('auto-cut', '0369')];
    expect(clipsWithoutCard({ timeline: m2Timeline(), proposals: disk, kind: 'auto-cut', current: card('auto-cut', '0370') })).toEqual([
      '0371', '0372', '0373', '0374', '0375', '0376',
    ]);
  });

  it('the skip itself (Auto Cut ran on 0372 after 0370): 0371 is still listed, first', () => {
    const disk = [...editorialRun(), ...['0366', '0369', '0370'].map((id) => card('auto-cut', id))];
    expect(clipsWithoutCard({ timeline: m2Timeline(), proposals: disk, kind: 'auto-cut', current: card('auto-cut', '0372') })).toEqual([
      '0371', '0373', '0374', '0375', '0376',
    ]);
  });

  it('every clip carded (any status — rejected and partial count as done) → empty', () => {
    const disk = [...editorialRun(), ...M2.slice(0, 8).map((id, i) => card('auto-cut', id, i === 1 ? 'rejected' : 'partial'))];
    expect(clipsWithoutCard({ timeline: m2Timeline(), proposals: disk, kind: 'auto-cut', current: card('auto-cut', '0376') })).toEqual([]);
  });

  it('the editorial run: 0374 (read, nothing cut) stays listed; a rejected lone-fluff card counts as done', () => {
    const run = editorialRun();
    const current = run.pop();
    expect(clipsWithoutCard({ timeline: m2Timeline(), proposals: run, kind: 'editorial', ...(current ? { current } : {}) })).toEqual(['0374']);
  });

  it('an earlier run of the same kind does not count: a new sweep starts when a clip carded earlier comes back (not a retry of the last one)', () => {
    const earlier = M2.map((id) => card('auto-cut', id));
    expect(clipsWithoutCard({ timeline: m2Timeline(), proposals: earlier, kind: 'auto-cut', current: card('auto-cut', '0366') })).toEqual(
      M2.slice(1),
    );
    // A retry of the clip just carded is the same run.
    const retry = [...editorialRun(), card('auto-cut', '0366'), card('auto-cut', '0369', 'rejected')];
    expect(clipsWithoutCard({ timeline: m2Timeline(), proposals: retry, kind: 'auto-cut', current: card('auto-cut', '0369') })).toEqual(
      M2.slice(2),
    );
  });

  it('an Auto Cut card from before the editorial run does not count', () => {
    const disk = [card('auto-cut', '0371'), ...editorialRun()];
    expect(clipsWithoutCard({ timeline: m2Timeline(), proposals: disk, kind: 'auto-cut', current: card('auto-cut', '0366') })).toEqual(
      M2.slice(1),
    );
  });

  it('no current card (the tool found nothing to cut): `alsoDone` counts the clip it just ran', () => {
    const disk = [...editorialRun(), card('auto-cut', '0366')];
    expect(clipsWithoutCard({ timeline: m2Timeline(), proposals: disk, kind: 'auto-cut', alsoDone: ['0369'] })).toEqual(M2.slice(2));
  });

  it('a timeline with fewer than two media clips → null (no list for a one-clip project)', () => {
    const one: StudioTimeline = { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips: [clip('a', 0), clip('a', 4)] }] as unknown as StudioTimeline['tracks'] };
    expect(clipsWithoutCard({ timeline: one, proposals: [], kind: 'auto-cut', current: card('auto-cut', 'a') })).toBeNull();
  });
});

describe('formatCutRunLine', () => {
  it('names the clips left, or says the run covered every clip', () => {
    expect(formatCutRunLine('auto-cut', ['DJI_0371_D.MP4', 'DJI_0372_D.MP4'])).toBe(
      'Clips on the timeline still without an Auto Cut card in this run (timeline order): DJI_0371_D.MP4, DJI_0372_D.MP4. ',
    );
    expect(formatCutRunLine('editorial', [])).toBe('Every clip on the timeline has an editorial card in this run. ');
  });
});

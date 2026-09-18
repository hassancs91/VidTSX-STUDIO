import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '@shared/types/studio';
import { applyTextDelete, planTextDelete } from './text-delete';
import { timelineReducer } from '../hooks/useTimeline';
import { restoreDeletion } from './text-restore';
import { buildTranscriptDoc } from './transcript-doc';
import { ASSET, makeEnvelope, makeTimeline, master, shots, wordSource } from './text-edit-fixtures';

function deleteWords(timeline: StudioTimeline, pick: (text: string) => boolean, rippleAllTracks = false) {
  const doc = buildTranscriptDoc(timeline, wordSource());
  const result = planTextDelete({
    timeline,
    tokens: doc.tokens.filter((t) => pick(t.text)),
    words: wordSource(),
    envelopes: new Map([['a1', makeEnvelope()]]),
    assets: [ASSET],
  });
  return applyTextDelete(timeline, result.spans, { rippleAllTracks });
}

const words = (timeline: StudioTimeline) =>
  buildTranscriptDoc(timeline, wordSource()).tokens.map((t) => [t.text, t.start]);

describe('restoreDeletion', () => {
  it('is the inverse of a text delete: same words at the same seconds, no pill left', () => {
    const original = makeTimeline();
    const cut = deleteWords(original, (text) => text === 'to' || text === 'the');
    const [deletion] = buildTranscriptDoc(cut, wordSource()).deletions;

    const restored = restoreDeletion(cut, deletion.beforeClipId, deletion.afterClipId, { newClipId: 'back' });
    expect(buildTranscriptDoc(restored, wordSource()).deletions).toEqual([]);
    const after = words(restored);
    const before = words(original);
    expect(after.map(([text]) => text)).toEqual(before.map(([text]) => text));
    after.forEach(([, start], i) => expect(start).toBeCloseTo(before[i][1] as number, 3));
    expect(master(restored).reduce((sum, c) => sum + c.duration, 0)).toBeCloseTo(8, 6);
  });

  it('puts back a plain user clip — no fades, transition, label or note', () => {
    const timeline = makeTimeline();
    Object.assign(timeline.tracks[1].clips[0], { fadeInSec: 0.5, label: 'Take 1', note: 'keep', gain: 0.8 });
    const cut = deleteWords(timeline, (text) => text === 'um');
    const [deletion] = buildTranscriptDoc(cut, wordSource()).deletions;
    const restored = restoreDeletion(cut, deletion.beforeClipId, deletion.afterClipId, { newClipId: 'back' });
    const back = master(restored).find((c) => c.id === 'back')!;
    expect(back.origin).toEqual({ by: 'user' });
    expect(back.gain).toBe(0.8);
    expect([back.fadeInSec, back.fadeOutSec, back.transitionOut, back.label, back.note]).toEqual([
      undefined, undefined, undefined, undefined, undefined,
    ]);
    expect(back.sourceIn).toBeCloseTo(deletion.sourceStart, 6);
    expect(back.duration).toBeCloseTo(deletion.seconds, 3);
  });

  it('pushes the other lanes back in ripple-all mode, and only the master lane otherwise', () => {
    const cut = deleteWords(makeTimeline(), (text) => text === 'um', true);
    const [deletion] = buildTranscriptDoc(cut, wordSource()).deletions;

    const all = restoreDeletion(cut, deletion.beforeClipId, deletion.afterClipId, { rippleAllTracks: true });
    expect(shots(all)[0].timelineStart).toBeCloseTo(5, 3);
    expect(all.markers?.[0].time).toBeCloseTo(6, 3);

    const perTrack = restoreDeletion(cut, deletion.beforeClipId, deletion.afterClipId);
    expect(shots(perTrack)[0].timelineStart).toBe(shots(cut)[0].timelineStart);
    expect(perTrack.markers?.[0].time).toBe(cut.markers?.[0].time);
  });

  it('restores a sped join at its timeline length', () => {
    const timeline = makeTimeline();
    timeline.tracks[1].clips[0].speed = 2;
    timeline.tracks[1].clips[0].duration = 4;
    const cut = deleteWords(timeline, (text) => text === 'um');
    const [deletion] = buildTranscriptDoc(cut, wordSource()).deletions;
    const restored = restoreDeletion(cut, deletion.beforeClipId, deletion.afterClipId);
    expect(master(restored).reduce((sum, c) => sum + c.duration, 0)).toBeCloseTo(4, 6);
    expect(buildTranscriptDoc(restored, wordSource()).tokens.map((t) => t.text)).toContain('um');
  });

  it('returns the same timeline for a stale pill', () => {
    const cut = deleteWords(makeTimeline(), (text) => text === 'um');
    const [deletion] = buildTranscriptDoc(cut, wordSource()).deletions;

    expect(restoreDeletion(cut, 'gone', deletion.afterClipId)).toBe(cut);
    expect(restoreDeletion(cut, deletion.afterClipId, deletion.beforeClipId)).toBe(cut);

    const movedApart: StudioTimeline = {
      ...cut,
      tracks: cut.tracks.map((t) =>
        t.id !== 'v1'
          ? t
          : { ...t, clips: t.clips.map((c) => (c.id === deletion.afterClipId ? { ...c, timelineStart: c.timelineStart + 3 } : c)) },
      ),
    };
    expect(restoreDeletion(movedApart, deletion.beforeClipId, deletion.afterClipId)).toBe(movedApart);

    const locked: StudioTimeline = { ...cut, tracks: cut.tracks.map((t) => (t.id === 'v1' ? { ...t, locked: true } : t)) };
    expect(restoreDeletion(locked, deletion.beforeClipId, deletion.afterClipId)).toBe(locked);
  });
});

describe('reducer round-trips (text-based editing)', () => {
  const baseState = (timeline: StudioTimeline) => ({
    projectId: 'p1',
    past: [],
    present: { timeline, proposals: [], shots: [], captions: null, removedAssets: [] },
    future: [],
  });

  it('text-delete takes several spans out in ONE undo step', () => {
    const timeline = makeTimeline();
    const doc = buildTranscriptDoc(timeline, wordSource());
    const { spans } = planTextDelete({
      timeline,
      tokens: doc.tokens.filter((t) => t.text === 'and' || t.text === 'we'),
      words: wordSource(),
      envelopes: new Map([['a1', makeEnvelope()]]),
      assets: [ASSET],
    });
    expect(spans).toHaveLength(2);

    const s1 = baseState(timeline);
    const s2 = timelineReducer(s1, { type: 'text-delete', spans, allTracks: false });
    expect(s2.past).toHaveLength(1);
    expect(master(s2.present.timeline)).toHaveLength(3);
    expect(timelineReducer(s2, { type: 'undo' }).present).toBe(s1.present);
  });

  it('text-restore is one undo step, and a stale one is none', () => {
    const cut = deleteWords(makeTimeline(), (text) => text === 'um');
    const [deletion] = buildTranscriptDoc(cut, wordSource()).deletions;
    const restore = {
      type: 'text-restore' as const,
      beforeClipId: deletion.beforeClipId,
      afterClipId: deletion.afterClipId,
      newClipId: 'back',
      allTracks: false,
    };

    const s1 = baseState(cut);
    const s2 = timelineReducer(s1, restore);
    expect(s2.past).toHaveLength(1);
    expect(master(s2.present.timeline).map((c) => c.id)).toContain('back');
    expect(timelineReducer(s2, { type: 'undo' }).present).toBe(s1.present);

    // The join is whole again — the same pill clicked twice does nothing.
    const s3 = timelineReducer(s2, { ...restore, newClipId: 'again' });
    expect(s3).toBe(s2);
  });
});

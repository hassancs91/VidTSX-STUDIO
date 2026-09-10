// A shot range as source spans (W8 Stage 4, `flow-range.ts`): shots count
// the master track's media clips, a time range crops the clips it overlaps,
// contiguous spans of one source merge into one trim, and speed changes are
// refused. The render joins several trims through concat, one trim alone.
import { describe, it, expect, afterEach } from 'vitest';
import type { StudioProject } from '../../../../shared/types/studio';
import { mergeContiguous, planRange, renderRangeClip, setRenderRangeDepsForTests } from './flow-range';

const asset = { id: 'a1', kind: 'video' as const, path: 'C:/clips/talk.mp4', probe: { duration: 60, width: 1920, height: 1080, fps: 30, hasAudio: true } };
const still = { id: 'img', kind: 'image' as const, path: 'C:/clips/still.png', probe: { duration: 0, width: 1920, height: 1080, fps: 0, hasAudio: false } };

/** 20 × 3 s clips of one source, cut tight (sourceIn steps by 3 s, no gaps). */
function tight(): StudioProject {
  const clips = Array.from({ length: 20 }, (_, i) => ({ id: `c${i + 1}`, kind: 'video' as const, assetId: 'a1', timelineStart: i * 3, duration: 3, sourceIn: i * 3 }));
  return {
    assets: [asset, still],
    timeline: { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips }, { id: 'a1', kind: 'audio', name: 'A1', clips: [] }] },
  } as unknown as StudioProject;
}

describe('planRange', () => {
  it('shots 7–9 of a tight cut are one contiguous source span', () => {
    const plan = planRange(tight(), { fromShot: 7, toShot: 9 });
    expect(typeof plan).not.toBe('string');
    if (typeof plan === 'string') return;
    expect(plan.segments).toHaveLength(1);
    expect(plan.segments[0]).toMatchObject({ shot: 7, sourceStart: 18, sourceEnd: 27, timelineStart: 18, timelineEnd: 27 });
    expect(plan).toMatchObject({ timelineStart: 18, durationSeconds: 9, label: 'shots 7–9' });
  });

  it('an auto-cut range is several spans; a time range crops the clips it overlaps', () => {
    const project = tight();
    const clips = project.timeline.tracks[0].clips;
    // Cuts: shot 8 now starts 1 s later in the source, so 7 and 8 no longer touch.
    clips[7] = { ...clips[7], sourceIn: 22 };
    const shots = planRange(project, { fromShot: 7, toShot: 8 });
    if (typeof shots === 'string') throw new Error(shots);
    expect(shots.segments.map((s) => [s.sourceStart, s.sourceEnd])).toEqual([[18, 21], [22, 25]]);
    const seconds = planRange(project, { fromSec: 19.5, toSec: 22 });
    if (typeof seconds === 'string') throw new Error(seconds);
    expect(seconds.segments.map((s) => [s.shot, s.sourceStart, s.sourceEnd, s.timelineStart, s.timelineEnd])).toEqual([[7, 19.5, 21, 19.5, 21], [8, 22, 23, 21, 22]]);
    expect(seconds.label).toBe('19.5–22.0 s');
    expect(seconds.durationSeconds).toBe(2.5);
  });

  it('refuses ranges the timeline does not have, stills, and speed-changed clips', () => {
    const project = tight();
    expect(planRange(project, { fromShot: 19, toShot: 25 })).toContain('has 20 shots');
    expect(planRange(project, { fromShot: 3, toShot: 2 })).toContain('toShot must be at or after fromShot');
    expect(planRange(project, { fromSec: 70, toSec: 80 })).toContain('No master-track clip lies between');
    project.timeline.tracks[0].clips[2] = { ...project.timeline.tracks[0].clips[2], speed: 2 };
    expect(planRange(project, { fromShot: 3, toShot: 3 })).toContain('plays at 2×');
    project.timeline.tracks[0].clips[4] = { ...project.timeline.tracks[0].clips[4], kind: 'image', assetId: 'img' };
    expect(planRange(project, { fromShot: 5, toShot: 5 })).toContain('a still image');
  });

  it('mergeContiguous joins touching spans of one asset only', () => {
    const seg = (sourceStart: number, sourceEnd: number, assetId = 'a1') => ({
      clipId: 'c', shot: 1, asset: { ...asset, id: assetId }, sourceStart, sourceEnd, timelineStart: sourceStart, timelineEnd: sourceEnd,
    });
    expect(mergeContiguous([seg(0, 3), seg(3, 6), seg(7, 9), seg(9, 10, 'a2')]).map((s) => [s.asset.id, s.sourceStart, s.sourceEnd])).toEqual([
      ['a1', 0, 6],
      ['a1', 7, 9],
      ['a2', 9, 10],
    ]);
  });
});

describe('renderRangeClip', () => {
  afterEach(() => setRenderRangeDepsForTests(null));

  it('one span is one precise trim; several are trimmed then joined', async () => {
    const calls: string[] = [];
    setRenderRangeDepsForTests({
      trim: async (o) => {
        calls.push(`trim ${o.startSeconds}-${o.endSeconds} -> ${o.output.split(/[\\/]/).pop()}`);
        return { duration: o.endSeconds - o.startSeconds, width: 1920, height: 1080, fps: 30, hasVideo: true, hasAudio: true };
      },
      concat: async (o) => {
        calls.push(`concat ${o.inputs.length} -> ${o.output.split(/[\\/]/).pop()}`);
        return { duration: 6, width: 1920, height: 1080, fps: 30, hasVideo: true, hasAudio: true };
      },
    });
    const one = planRange(tight(), { fromShot: 7, toShot: 9 });
    if (typeof one === 'string') throw new Error(one);
    await renderRangeClip(one, 'C:/tmp', 'range.mp4');
    expect(calls).toEqual(['trim 18-27 -> range.mp4']);

    calls.length = 0;
    const project = tight();
    project.timeline.tracks[0].clips[7] = { ...project.timeline.tracks[0].clips[7], sourceIn: 22 };
    const two = planRange(project, { fromShot: 7, toShot: 8 });
    if (typeof two === 'string') throw new Error(two);
    await renderRangeClip(two, 'C:/tmp', 'range.mp4');
    expect(calls).toEqual(['trim 18-21 -> range-part1.mp4', 'trim 22-25 -> range-part2.mp4', 'concat 2 -> range.mp4']);
  });
});

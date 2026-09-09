import { describe, expect, it } from 'vitest';
import type { StudioClip, StudioProject } from '../../../shared/types/studio';
import { STUDIO_SCHEMA_VERSION } from '../../../shared/types/studio';
import {
  applyKnobChanges,
  buildLearnedSection,
  computeLearnStats,
  diffPresetKnobs,
  formatStatsSummary,
  inferPacing,
} from './preset-learn-stats';

function clip(overrides: Partial<StudioClip> & { id: string; timelineStart: number; duration: number }): StudioClip {
  return { kind: 'video', assetId: 'footage', sourceIn: 0, ...overrides };
}

/** A hand-tightened talking head: 60 s of footage cut to 14 clips in 30 s,
 *  two shots, one b-roll clip, karaoke captions, one crossfade, a title
 *  before the footage and a card after it. */
function tightProject(): StudioProject {
  const master: StudioClip[] = [clip({ id: 'title', kind: 'tsx', assetId: undefined, tsx: { shotId: 's1', mode: 'cutaway' }, timelineStart: 0, duration: 2, origin: { by: 'agent' } })];
  let t = 2;
  for (let i = 0; i < 14; i++) {
    master.push(clip({ id: `c${i}`, timelineStart: t, duration: 2, sourceIn: i * 4, ...(i === 3 ? { transitionOut: { kind: 'crossfade', duration: 0.5 } } : {}) }));
    t += 2;
  }
  master.push(clip({ id: 'end', kind: 'tsx', assetId: undefined, tsx: { shotId: 's2', mode: 'cutaway' }, timelineStart: t, duration: 3, origin: { by: 'user' } }));
  return {
    schemaVersion: STUDIO_SCHEMA_VERSION,
    id: 'tight',
    name: 'Tight demo',
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
    settings: { width: 1080, height: 1920, fps: 30, agent: {}, presetId: 'shorts' },
    assets: [
      { id: 'footage', kind: 'video', path: 'C:/x/footage.mp4', probe: { duration: 60, hasAudio: true } as never, transcript: { path: 't.json', status: 'ready', engine: 'assemblyai' } as never },
      { id: 'bed', kind: 'audio', path: 'C:/x/bed.mp3', probe: { duration: 120, hasAudio: true } as never },
      { id: 'broll', kind: 'video', path: 'C:/x/broll.mp4', probe: { duration: 5, hasAudio: false } as never },
    ],
    timeline: {
      tracks: [
        { id: 'v1', kind: 'video', name: 'V1', clips: master },
        { id: 'ov', kind: 'overlay', name: 'Overlay', clips: [clip({ id: 'b1', assetId: 'broll', timelineStart: 10, duration: 4, origin: { by: 'agent' } })] },
        { id: 'a1', kind: 'audio', name: 'A1', clips: [clip({ id: 'music', kind: 'audio', assetId: 'bed', timelineStart: 0, duration: 33, gain: 0.3 }), clip({ id: 'sfx1', kind: 'sfx', assetId: 'bed', timelineStart: 2, duration: 0.5 })] },
      ],
    },
    proposals: [
      {
        id: 'p1',
        kind: 'cut-plan',
        status: 'partial',
        createdAt: '2026-09-09T00:00:00.000Z',
        items: [
          { id: 'i1', status: 'accepted', assetId: 'footage', sourceStart: 1, sourceEnd: 3 },
          { id: 'i2', status: 'accepted', assetId: 'footage', sourceStart: 10, sourceEnd: 14.5, adjusted: true },
          { id: 'i3', status: 'rejected', assetId: 'footage', sourceStart: 20, sourceEnd: 25 },
        ],
      },
      { id: 'p2', kind: 'shot-plan', status: 'applied', createdAt: '2026-09-09T00:00:00.000Z', items: [{ id: 'i4', status: 'accepted', shotId: 's1' }] },
      { id: 'p3', kind: 'insert-plan', status: 'rejected', createdAt: '2026-09-09T00:00:00.000Z', items: [{ id: 'i5', status: 'rejected' }] },
    ],
    shots: [],
    captions: { templateId: 'core/karaoke', enabled: true, style: { position: 'bottom', scale: 1, wordsPerGroup: 3 } as never },
  };
}

describe('computeLearnStats', () => {
  it('measures the tightened edit deterministically', () => {
    const stats = computeLearnStats(tightProject());
    expect(stats.totalSeconds).toBe(33);
    expect(stats.masterClipCount).toBe(16);
    expect(stats.cutsPerMinute).toBe(27.3); // 15 boundaries in 33 s
    expect(stats.meanClipSeconds).toBe(2.1);
    expect(stats.removedSeconds).toBe(6.5); // accepted items only, the rejected 5 s stays
    expect(stats.shotCount).toBe(2);
    expect(stats.shotsPerMinute).toBe(3.6);
    expect(stats.brollCount).toBe(1);
    expect(stats.sfxCount).toBe(1);
    expect(stats.sfxPerMinute).toBe(1.8);
    expect(stats.musicBed).toBe('quiet');
    expect(stats.captions).toBe('karaoke');
    expect(stats.captionTemplateId).toBe('core/karaoke');
    expect(stats.transitions).toEqual([{ kind: 'crossfade', count: 1 }]);
    expect(stats.introSeconds).toBe(2);
    expect(stats.outroSeconds).toBe(3);
    expect(stats.agentClipCount).toBe(2);
    expect(stats.userClipCount).toBe(17);
    expect(stats.proposalsApplied).toBe(2);
    expect(stats.proposalsRejected).toBe(1);
    expect(stats.cutItemsProposed).toBe(3);
    expect(stats.cutItemsRejected).toBe(1);
    expect(stats.cutItemsAdjusted).toBe(1);
    expect(computeLearnStats(tightProject())).toEqual(stats);
  });

  it('reads an empty project as zeros with no music, captions or transitions', () => {
    const project = tightProject();
    project.timeline = { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips: [] }] };
    project.proposals = [];
    delete project.captions;
    const stats = computeLearnStats(project);
    expect(stats.totalSeconds).toBe(0);
    expect(stats.cutsPerMinute).toBe(0);
    expect(stats.musicBed).toBe('none');
    expect(stats.captions).toBe('none');
    expect(stats.transitions).toEqual([]);
    expect(stats.introSeconds).toBe(0);
  });

  it("the footage's own audio and a short jingle never count as a music bed; a loud long one is present", () => {
    const project = tightProject();
    const a1 = project.timeline.tracks[2];
    a1.clips = [clip({ id: 'own', kind: 'audio', assetId: 'footage', timelineStart: 0, duration: 33 })];
    expect(computeLearnStats(project).musicBed).toBe('none');
    a1.clips = [clip({ id: 'jingle', kind: 'audio', assetId: 'bed', timelineStart: 0, duration: 3 })];
    expect(computeLearnStats(project).musicBed).toBe('none');
    a1.clips = [clip({ id: 'loud', kind: 'audio', assetId: 'bed', timelineStart: 0, duration: 30 })];
    expect(computeLearnStats(project).musicBed).toBe('present');
  });
});

describe('inferPacing + diffPresetKnobs', () => {
  it('reads the tightened edit as tight and diffs every knob the preset had wrong, with the numbers', () => {
    const stats = computeLearnStats(tightProject());
    expect(inferPacing(stats)).toBe('tight');
    const changes = diffPresetKnobs(
      { pacing: 'normal', shotsPerMinute: 1.5, sfxPerMinute: 1, musicBed: 'present', captions: 'block', transitions: [], introSeconds: 8, outroSeconds: 10 },
      stats,
    );
    const byKey = Object.fromEntries(changes.map((c) => [c.key, c]));
    expect(Object.keys(byKey).sort()).toEqual(['captions', 'introSeconds', 'musicBed', 'outroSeconds', 'pacing', 'sfxPerMinute', 'shotsPerMinute', 'transitions']);
    expect(byKey.sfxPerMinute).toEqual({ key: 'sfxPerMinute', from: 1, to: 1.8, reason: '1 sound effect in 0:33' });
    expect(byKey.pacing).toEqual({ key: 'pacing', from: 'normal', to: 'tight', reason: '27.3 cuts/min on the master lane, mean clip 2.1 s, 6.5 s removed by accepted cuts' });
    expect(byKey.shotsPerMinute).toEqual({ key: 'shotsPerMinute', from: 1.5, to: 3.6, reason: '2 shots in 0:33' });
    expect(byKey.captions.to).toBe('karaoke');
    expect(byKey.transitions).toEqual({ key: 'transitions', from: [], to: ['crossfade'], reason: '1× crossfade' });
    expect(byKey.introSeconds.to).toBe(2);
    expect(byKey.outroSeconds.to).toBe(3);
    // 1.8/min against 1.6 is inside the tolerance (max of 0.5 and 25 %) — no change.
    expect(diffPresetKnobs({ sfxPerMinute: 1.6 }, stats).some((c) => c.key === 'sfxPerMinute')).toBe(false);
  });

  it('proposes nothing for a preset that already matches, and nothing at all under 10 seconds', () => {
    const stats = computeLearnStats(tightProject());
    const matching = { pacing: 'tight' as const, shotsPerMinute: 3.6, sfxPerMinute: 1.8, musicBed: 'quiet' as const, captions: 'karaoke' as const, transitions: ['crossfade'], introSeconds: 2, outroSeconds: 3 };
    expect(diffPresetKnobs(matching, stats)).toEqual([]);
    expect(diffPresetKnobs({}, { ...stats, totalSeconds: 8 })).toEqual([]);
  });

  it('a knob the preset never set is proposed only when the measurement is non-trivial', () => {
    const stats = computeLearnStats(tightProject());
    const keys = diffPresetKnobs({}, stats).map((c) => c.key);
    expect(keys).toContain('pacing');
    expect(keys).toContain('musicBed');
    expect(keys).toContain('transitions');
    const quiet = { ...stats, sfxCount: 0, sfxPerMinute: 0, musicBed: 'none' as const, transitions: [], captions: 'none' as const, introSeconds: 0, outroSeconds: 0 };
    const quietKeys = diffPresetKnobs({}, quiet).map((c) => c.key);
    expect(quietKeys).not.toContain('sfxPerMinute');
    expect(quietKeys).not.toContain('musicBed');
    expect(quietKeys).not.toContain('transitions');
    expect(quietKeys).not.toContain('captions');
    expect(quietKeys).not.toContain('introSeconds');
  });

  it('applyKnobChanges patches only the changed keys', () => {
    expect(applyKnobChanges({ pacing: 'normal', introSeconds: 8 }, [{ key: 'pacing', from: 'normal', to: 'tight', reason: 'x' }])).toEqual({ pacing: 'tight', introSeconds: 8 });
  });
});

describe('buildLearnedSection + formatStatsSummary', () => {
  it('renders the markdown section with the summary, the stat lines and the knob line', () => {
    const stats = computeLearnStats(tightProject());
    const changes = diffPresetKnobs({ pacing: 'normal' }, stats).filter((c) => c.key === 'pacing');
    const section = buildLearnedSection({ projectName: 'Tight demo', date: '2026-09-09', summary: 'The user cut far tighter than the preset.', stats, changes });
    expect(section.split('\n')[0]).toBe('## Learned from Tight demo on 2026-09-09');
    expect(section).toContain('The user cut far tighter than the preset.');
    expect(section).toContain('- Length 0:33 · 16 clips on the master lane · 27.3 cuts/min · mean clip 2.1 s · 6.5 s removed by accepted cuts');
    expect(section).toContain('- Review: 2 proposals applied, 1 rejected · 1 of 3 proposed cut items rejected by hand, 1 adjusted');
    expect(section).toContain('- Knobs: pacing normal → tight (27.3 cuts/min');
    expect(formatStatsSummary(stats)).toBe('0:33 long, 27.3 cuts/min (mean clip 2.1 s), 2 shots, 1 SFX, music bed quiet, captions karaoke.');
  });
});

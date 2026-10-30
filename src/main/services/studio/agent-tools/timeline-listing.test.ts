// get_timeline's text (ASSISTANT_TIMELINE_DESIGN §3): the exact 2-clip answer,
// the paging caps (40 master rows, 20 per other lane), global cut numbers on a
// later page, windows, and every label / flag / error string.
import { describe, it, expect } from 'vitest';
import type { StudioClip, StudioTimeline, StudioTrack } from '../../../../shared/types/studio';
import { formatTimelineListing } from './timeline-listing';

const E3V_ID = 'ed2cde25-2bfe-4005-a544-adced7e5299c';
const E3V_ASSET = { id: E3V_ID, path: 'C:\\Users\\hasan\\AppData\\Local\\vidtsx-e2e\\search\\S4\\r1\\media\\e3v-clip.mp4' };

function twoClip(): StudioTimeline {
  return {
    tracks: [
      {
        id: 'v1', kind: 'video', name: 'V1',
        clips: [
          { id: 'e3v-c1', kind: 'video', assetId: E3V_ID, timelineStart: 0, duration: 3, sourceIn: 0 },
          { id: 'e3v-c2', kind: 'video', assetId: E3V_ID, timelineStart: 3, duration: 3, sourceIn: 4 },
        ],
      },
      { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
    ],
  };
}

const TWO_CLIP_ANSWER = [
  'Timeline 0:06.00 · master track "V1" (video): 2 clips · 1 cut. Times are timeline M:SS.ss; "src" is seconds into the asset.',
  'V1 (master track):',
  '  #1 0:00.00–0:03.00 "e3v-clip.mp4" (video) src 0.00–3.00',
  '  #2 0:03.00–0:06.00 "e3v-clip.mp4" (video) src 4.00–7.00 ← cut 1 at 0:03.00',
  'A1 (audio): empty',
  'Place at a cut with insert_asset(at: { cut: n, offset }) — offset in seconds, negative = before the cut.',
].join('\n');

const FOOTER = 'Place at a cut with insert_asset(at: { cut: n, offset }) — offset in seconds, negative = before the cut.';

describe('formatTimelineListing — the 2-clip project', () => {
  it('answers the §3 text exactly', () => {
    const out = formatTimelineListing({ timeline: twoClip(), assets: [E3V_ASSET], shots: [] });
    expect(out.isError).toBe(false);
    expect(out.text).toBe(TWO_CLIP_ANSWER);
  });
});

/** 60 master clips (2 s each, one 0.5 s gap before #11, every join a cut),
 *  a hidden 25-shot overlay lane, a 2-clip audio lane, a muted + locked lane. */
function synthetic(): { timeline: StudioTimeline; assets: Array<{ id: string; path: string }>; shots: Array<{ id: string; name: string }> } {
  const master: StudioClip[] = Array.from({ length: 60 }, (_, k) => ({
    id: `m${k + 1}`, kind: 'video', assetId: 'talk', timelineStart: k * 2 + (k >= 10 ? 0.5 : 0), duration: 2, sourceIn: k * 3,
  }));
  const shotsLane: StudioClip[] = Array.from({ length: 25 }, (_, k) => ({
    id: `o${k + 1}`, kind: 'tsx', timelineStart: k * 4, duration: 1, tsx: { shotId: `s${k + 1}`, mode: 'overlay' },
  }));
  const tracks: StudioTrack[] = [
    { id: 'o1', kind: 'overlay', name: 'Shots', hidden: true, clips: shotsLane },
    { id: 'v1', kind: 'video', name: 'V1', clips: master },
    {
      id: 'a1', kind: 'audio', name: 'Music',
      clips: [
        { id: 'bed', kind: 'audio', assetId: 'bed', timelineStart: 0, duration: 30, sourceIn: 0, gain: 0.3 },
        { id: 'wh', kind: 'sfx', assetId: 'whoosh', timelineStart: 19.5, duration: 0.7, sourceIn: 0.1, speed: 1.5 },
      ],
    },
    { id: 'a2', kind: 'audio', name: 'VO', muted: true, locked: true, clips: [{ id: 'vo', kind: 'audio', assetId: 'vo', timelineStart: 0, duration: 5 }] },
  ];
  return {
    timeline: { tracks },
    assets: [
      { id: 'talk', path: 'C:/media/talk.mp4' },
      { id: 'bed', path: 'C:/media/bed.mp3' },
      { id: 'whoosh', path: 'D:\\lib\\sfx\\whoosh-soft.mp3' },
      { id: 'vo', path: 'C:/media/vo.wav' },
    ],
    shots: Array.from({ length: 25 }, (_, k) => ({ id: `s${k + 1}`, name: `Shot ${k + 1}` })),
  };
}

const SYN_LINE_1 =
  'Timeline 2:00.50 · master track "V1" (video): 60 clips · 58 cuts · 1 gap. Times are timeline M:SS.ss; "src" is seconds into the asset.';

describe('formatTimelineListing — caps and paging', () => {
  it('page 1: 40 master rows + "+20 more", 20 overlay rows + "+5 more", the other lanes exact', () => {
    const out = formatTimelineListing(synthetic());
    expect(out.isError).toBe(false);
    const lines = out.text.split('\n');
    expect(lines[0]).toBe(SYN_LINE_1);
    expect(lines[1]).toBe('V1 (master track):');
    expect(lines[2]).toBe('  #1 0:00.00–0:02.00 "talk.mp4" (video) src 0.00–2.00');
    expect(lines[3]).toBe('  #2 0:02.00–0:04.00 "talk.mp4" (video) src 3.00–5.00 ← cut 1 at 0:02.00');
    expect(lines[11]).toBe('  #10 0:18.00–0:20.00 "talk.mp4" (video) src 27.00–29.00 ← cut 9 at 0:18.00');
    expect(lines[12]).toBe('  gap 0:20.00–0:20.50 (0.50 s, nothing on this track)');
    expect(lines[13]).toBe('  #11 0:20.50–0:22.50 "talk.mp4" (video) src 30.00–32.00');
    expect(lines[14]).toBe('  #12 0:22.50–0:24.50 "talk.mp4" (video) src 33.00–35.00 ← cut 10 at 0:22.50');
    expect(lines[42]).toBe('  #40 1:18.50–1:20.50 "talk.mp4" (video) src 117.00–119.00 ← cut 38 at 1:18.50');
    expect(lines.filter((l) => /^ {2}#\d+ /.test(l))).toHaveLength(40);
    expect(lines[43]).toBe('  … +20 more — get_timeline(fromSec: 80.5) continues from 1:20.50.');
    expect(lines[44]).toBe('Shots (overlay, hidden):');
    expect(lines[45]).toBe('  0:00.00–0:01.00 shot "Shot 1" (overlay)');
    expect(lines[64]).toBe('  1:16.00–1:17.00 shot "Shot 20" (overlay)');
    expect(lines.slice(65)).toEqual([
      '  … +5 more — get_timeline(fromSec: 80) continues from 1:20.00.',
      'Music (audio):',
      '  0:00.00–0:30.00 "bed.mp3" (audio) src 0.00–30.00 · gain 0.3',
      '  0:19.50–0:20.20 "whoosh-soft.mp3" (sfx) src 0.10–1.15 at 1.5×',
      'VO (audio, muted, locked):',
      '  0:00.00–0:05.00 "vo.wav" (audio) src 0.00–5.00',
      FOOTER,
    ]);
  });

  it('page 2 (fromSec: 80.5) starts at clip #41 with GLOBAL cut numbers and the same line 1', () => {
    const out = formatTimelineListing({ ...synthetic(), fromSec: 80.5 });
    expect(out.isError).toBe(false);
    const lines = out.text.split('\n');
    expect(lines[0]).toBe(SYN_LINE_1);
    expect(lines[1]).toBe('Showing 1:20.50–the end; cut numbers count from the start of the timeline.');
    expect(lines[2]).toBe('V1 (master track):');
    expect(lines[3]).toBe('  #41 1:20.50–1:22.50 "talk.mp4" (video) src 120.00–122.00 ← cut 39 at 1:20.50');
    expect(lines[22]).toBe('  #60 1:58.50–2:00.50 "talk.mp4" (video) src 177.00–179.00 ← cut 58 at 1:58.50');
    expect(lines.filter((l) => /^ {2}#\d+ /.test(l))).toHaveLength(20);
    expect(lines.slice(23)).toEqual([
      'Shots (overlay, hidden):',
      '  1:20.00–1:21.00 shot "Shot 21" (overlay)',
      '  1:24.00–1:25.00 shot "Shot 22" (overlay)',
      '  1:28.00–1:29.00 shot "Shot 23" (overlay)',
      '  1:32.00–1:33.00 shot "Shot 24" (overlay)',
      '  1:36.00–1:37.00 shot "Shot 25" (overlay)',
      'Music (audio):',
      '  (nothing in this window)',
      'VO (audio, muted, locked):',
      '  (nothing in this window)',
      FOOTER,
    ]);
  });

  it('a toSec window lists what overlaps [0, toSec)', () => {
    const out = formatTimelineListing({ ...synthetic(), toSec: 10 });
    const lines = out.text.split('\n');
    expect(lines[1]).toBe('Showing 0:00.00–0:10.00; cut numbers count from the start of the timeline.');
    expect(lines.filter((l) => /^ {2}#\d+ /.test(l)).map((l) => l.split(' ')[2])).toEqual(['#1', '#2', '#3', '#4', '#5']);
    expect(out.text).toContain('Shots (overlay, hidden):\n  0:00.00–0:01.00 shot "Shot 1" (overlay)\n  0:04.00–0:05.00 shot "Shot 2" (overlay)\n  0:08.00–0:09.00 shot "Shot 3" (overlay)\nMusic (audio):\n  0:00.00–0:30.00 "bed.mp3" (audio) src 0.00–30.00 · gain 0.3\nVO (audio');
  });
});

describe('formatTimelineListing — errors, empty, no master, labels, joins', () => {
  it('toSec ≤ fromSec is an error', () => {
    expect(formatTimelineListing({ timeline: twoClip(), assets: [E3V_ASSET], shots: [], fromSec: 5, toSec: 5 })).toEqual({
      text: 'toSec must be after fromSec (got 5–5).',
      isError: true,
    });
    expect(formatTimelineListing({ timeline: twoClip(), assets: [E3V_ASSET], shots: [], toSec: 0 }).text).toBe(
      'toSec must be after fromSec (got 0–0).',
    );
  });

  it('no clip on any lane → the empty string exactly', () => {
    const tl: StudioTimeline = { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips: [] }, { id: 'a1', kind: 'audio', name: 'A1', clips: [] }] };
    expect(formatTimelineListing({ timeline: tl, assets: [], shots: [] })).toEqual({
      text: 'The timeline is empty — no clips on any lane.',
      isError: false,
    });
  });

  it('no master track: the no-master header, every lane listed, no footer', () => {
    const tl: StudioTimeline = {
      tracks: [
        { id: 'v1', kind: 'video', name: 'V1', clips: [] },
        { id: 'o1', kind: 'overlay', name: 'O1', clips: [{ id: 't', kind: 'tsx', timelineStart: 1, duration: 3, tsx: { shotId: 'gone-shot', mode: 'overlay' } }] },
        { id: 'c1', kind: 'caption', name: 'Captions', clips: [{ id: 'cap', kind: 'caption', timelineStart: 0, duration: 2, label: 'Hello' }] },
      ],
    };
    expect(formatTimelineListing({ timeline: tl, assets: [], shots: [] }).text).toBe(
      [
        'Timeline 0:04.00 · no master track (no clips on a video or audio lane) · 0 cuts. Times are timeline M:SS.ss; "src" is seconds into the asset.',
        'V1 (video): empty',
        'O1 (overlay):',
        '  0:01.00–0:04.00 shot gone-shot (not in the pool)',
        'Captions (caption):',
        '  0:00.00–0:02.00 caption "Hello"',
      ].join('\n'),
    );
  });

  it('labels: missing asset, image, shot in the pool, a plain caption; a through edit and a transition on the master', () => {
    const tl: StudioTimeline = {
      tracks: [
        {
          id: 'v1', kind: 'video', name: 'Main', locked: true,
          clips: [
            { id: 'c1', kind: 'video', assetId: 'talk', timelineStart: 0, duration: 2, sourceIn: 0, transitionOut: { kind: 'cross-dissolve', duration: 0.5 } },
            { id: 'c2', kind: 'video', assetId: 'talk', timelineStart: 2, duration: 2, sourceIn: 5 },
            { id: 'c3', kind: 'video', assetId: 'talk', timelineStart: 4, duration: 2, sourceIn: 7 },
            { id: 'c4', kind: 'video', assetId: 'fast', timelineStart: 6, duration: 2, sourceIn: 1, speed: 2 },
            { id: 'c5', kind: 'video', assetId: 'nowhere', timelineStart: 8, duration: 1, sourceIn: 0 },
          ],
        },
        {
          id: 'o1', kind: 'overlay', name: 'Over', muted: true, hidden: true, locked: true,
          clips: [
            { id: 'i', kind: 'image', assetId: 'logo', timelineStart: 1, duration: 2 },
            { id: 's', kind: 'tsx', timelineStart: 3, duration: 2, tsx: { shotId: 'intro', mode: 'cutaway' } },
            { id: 'cap', kind: 'caption', timelineStart: 5, duration: 1 },
          ],
        },
      ],
    };
    const out = formatTimelineListing({
      timeline: tl,
      assets: [{ id: 'talk', path: 'C:/m/talk.mp4' }, { id: 'fast', path: 'C:/m/fast.mp4' }, { id: 'logo', path: 'C:/m/logo.png' }],
      shots: [{ id: 'intro', name: 'Intro title' }],
    });
    expect(out.text).toBe(
      [
        'Timeline 0:09.00 · master track "Main" (video): 5 clips · 3 cuts. Times are timeline M:SS.ss; "src" is seconds into the asset.',
        'Main (master track, locked):',
        '  #1 0:00.00–0:02.00 "talk.mp4" (video) src 0.00–2.00',
        '  #2 0:02.00–0:04.00 "talk.mp4" (video) src 5.00–7.00 ← cut 1 at 0:02.00 (cross-dissolve 0.50 s)',
        '  #3 0:04.00–0:06.00 "talk.mp4" (video) src 7.00–9.00 ← join at 0:04.00 (same footage continues — not a cut)',
        '  #4 0:06.00–0:08.00 "fast.mp4" (video) src 1.00–5.00 at 2× ← cut 2 at 0:06.00',
        '  #5 0:08.00–0:09.00 asset nowhere (missing) ← cut 3 at 0:08.00',
        'Over (overlay, muted, hidden, locked):',
        '  0:01.00–0:03.00 "logo.png" (image)',
        '  0:03.00–0:05.00 shot "Intro title" (cutaway)',
        '  0:05.00–0:06.00 caption',
        FOOTER,
      ].join('\n'),
    );
  });
});

// D13: the caption layer's serializer emission — one synthetic top track
// carrying the live-derived word stream through D12's runtime-props channel.

import { describe, expect, it } from 'vitest';
import type { StudioCaptionLayer, StudioProject } from '../types/studio';
import { CAPTION_TRACK_ID, serializeTimeline, type CaptionSerializeContext } from './serialize';
import { DEFAULT_CAPTION_STYLE, FALLBACK_CAPTION_PALETTE } from './caption-layer';
import { referencedShotIds } from './shots';

const FPS = 30;

const LAYER: StudioCaptionLayer = {
  templateId: 'core/word-pop',
  enabled: true,
  style: DEFAULT_CAPTION_STYLE,
};

const brand = {
  palette: {
    primary: '#0a7cff',
    secondary: '#123456',
    background: '#001018',
    text: '#f2f8ff',
    accent: '#ffb703',
  },
  fonts: { display: 'Georgia' },
};

function project(captions?: StudioCaptionLayer): StudioProject {
  return {
    schemaVersion: 1,
    id: 'p',
    name: 'p',
    createdAt: '',
    updatedAt: '',
    settings: { width: 1080, height: 1920, fps: FPS, agent: {} },
    assets: [{ id: 'x', kind: 'video', path: 'C:/x.mp4', probe: { duration: 40, hasAudio: true } }],
    timeline: {
      tracks: [
        {
          id: 'v1',
          kind: 'video',
          name: 'V1',
          clips: [
            { id: 'c1', kind: 'video', assetId: 'x', timelineStart: 0, duration: 4, sourceIn: 0 },
          ],
        },
      ],
    },
    proposals: [],
    shots: [],
    ...(captions ? { captions } : {}),
  };
}

const context = (over: Partial<CaptionSerializeContext> = {}): CaptionSerializeContext => ({
  words: new Map([
    [
      'x',
      [
        { text: 'hello', start: 0, end: 0.5 },
        { text: 'there', start: 0.6, end: 1 },
      ],
    ],
  ]),
  ...over,
});

const serialize = (captions?: StudioCaptionLayer, ctx?: CaptionSerializeContext) =>
  serializeTimeline(project(captions), () => 'http://x/asset', ctx);

describe('caption emission', () => {
  it('emits ONE clip on a synthetic top track spanning the composition', () => {
    const timeline = serialize(LAYER, context());
    const [track] = timeline.tracks;
    expect(track).toMatchObject({ id: CAPTION_TRACK_ID, kind: 'caption' });
    // First in UI order = painted last = over every other lane.
    expect(timeline.tracks.map((t) => t.id)).toEqual([CAPTION_TRACK_ID, 'v1']);
    expect(track.clips).toHaveLength(1);
    expect(track.clips[0]).toMatchObject({
      kind: 'caption',
      from: 0,
      durationInFrames: timeline.durationInFrames,
    });
    // No trimBefore: word timings are already timeline seconds.
    expect(track.clips[0].trimBefore).toBeUndefined();
  });

  it('rides the D12 props channel — templateId in tsx, words in tsx.props', () => {
    const clip = serialize(LAYER, context()).tracks[0].clips[0];
    expect(clip.tsx).toMatchObject({ shotId: 'core/word-pop', mode: 'overlay' });
    expect(clip.tsx?.props?.captions).toEqual({
      groups: [
        {
          start: 0,
          end: 1,
          words: [
            { text: 'hello', start: 0, end: 0.5 },
            { text: 'there', start: 0.6, end: 1 },
          ],
        },
      ],
      style: { position: 'bottom', scale: 1, wordsPerGroup: 3, uppercase: false },
      palette: FALLBACK_CAPTION_PALETTE,
    });
  });

  it('resolves brand colors when the layer asks for them', () => {
    const clip = serialize(LAYER, context({ brand })).tracks[0].clips[0];
    expect(clip.tsx?.props?.captions?.palette).toEqual({ ...brand.palette, fontFamily: 'Georgia' });
  });

  it('emits nothing without a layer, when disabled, or with no context', () => {
    expect(serialize(undefined, context()).tracks.map((t) => t.id)).toEqual(['v1']);
    expect(
      serialize({ ...LAYER, enabled: false }, context()).tracks.map((t) => t.id),
    ).toEqual(['v1']);
    // No context = every pre-D13 caller (and the shot-only export path).
    expect(serialize(LAYER).tracks.map((t) => t.id)).toEqual(['v1']);
  });

  it('emits nothing when the master lane has no transcribed words', () => {
    expect(serialize(LAYER, { words: new Map() }).tracks.map((t) => t.id)).toEqual(['v1']);
  });

  it('re-derives after an edit — a trimmed master drops the words it cut', () => {
    const doc = project(LAYER);
    doc.timeline.tracks[0].clips[0].duration = 0.55; // keeps only "hello"
    const clip = serializeTimeline(doc, () => 'http://x/asset', context()).tracks[0].clips[0];
    expect(clip.tsx?.props?.captions?.groups.flatMap((g) => g.words.map((w) => w.text))).toEqual([
      'hello',
    ]);
  });

  it('the caption template is NOT collected as a referenced shot', () => {
    const timeline = serialize(LAYER, context());
    expect(referencedShotIds(timeline)).toEqual([]);
  });
});

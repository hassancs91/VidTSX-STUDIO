// Shared fixtures for the Transcript panel's service tests: one spoken source
// with two takes and a filler, its synthetic RMS envelope, and a timeline that
// plays it under a shot lane.

import { RmsEnvelope } from '@shared/studio';
import type { SourceWord } from '@shared/studio';
import type { StudioMediaAsset, StudioTimeline } from '../types';

const BPS = 50; // matches the waveform cache's PEAKS_PER_SECOND

const w = (text: string, start: number, end: number): SourceWord => ({ text, start, end });

/** Take 1 ends at 3.20; take 2 starts 1.3 s later. 'um' is the only filler. */
export const WORDS: SourceWord[] = [
  w('Hello', 0.5, 0.9),
  w('and', 1.0, 1.15),
  w('welcome', 1.2, 1.7),
  w('um', 1.95, 2.2),
  w('to', 2.45, 2.55),
  w('the', 2.6, 2.7),
  w('show.', 2.75, 3.2),
  w('Today', 4.5, 4.9),
  w('we', 5.0, 5.1),
  w('build', 5.15, 5.5),
  w('things.', 5.55, 6.1),
];

export const SOURCE_DURATION = 8;

/** Loud inside every word, quiet everywhere else — what a clean recording reads as. */
export function makeEnvelope(words: readonly SourceWord[] = WORDS, duration = SOURCE_DURATION): RmsEnvelope {
  const buckets = new Array<number>(Math.round(duration * BPS)).fill(-60);
  for (const word of words) {
    for (let i = Math.floor(word.start * BPS); i < Math.ceil(word.end * BPS); i++) buckets[i] = -20;
  }
  return new RmsEnvelope(buckets, BPS);
}

export const ASSET: StudioMediaAsset = {
  id: 'a1',
  kind: 'video',
  path: 'C:/media/talk.mp4',
  probe: { duration: SOURCE_DURATION, hasAudio: true },
} as StudioMediaAsset;

/** S1 holds a shot over take 2; V1 is the master lane playing the whole source. */
export function makeTimeline(): StudioTimeline {
  return {
    tracks: [
      {
        id: 's1',
        kind: 'overlay',
        name: 'Shots',
        clips: [
          { id: 'sh1', kind: 'tsx', timelineStart: 5, duration: 2, sourceIn: 0, tsx: { shotId: 'a', mode: 'overlay' } },
        ],
      },
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [{ id: 'c1', kind: 'video', assetId: 'a1', timelineStart: 0, duration: SOURCE_DURATION, sourceIn: 0 }],
      },
    ],
    markers: [{ id: 'mk1', time: 6 }],
  };
}

export const master = (t: StudioTimeline) => t.tracks.find((x) => x.id === 'v1')!.clips;
export const shots = (t: StudioTimeline) => t.tracks.find((x) => x.id === 's1')!.clips;
export const wordSource = (words: readonly SourceWord[] = WORDS) => new Map([['a1', words]]);

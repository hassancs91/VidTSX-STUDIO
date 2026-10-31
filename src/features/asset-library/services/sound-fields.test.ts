import { describe, expect, it } from 'vitest';
import { formatDuration, soundFieldsOf } from './sound-fields';

const probe = (duration: number) => ({ duration, hasAudio: true });

describe('formatDuration', () => {
  it('reads seconds under a minute with one decimal, m:ss above', () => {
    expect(formatDuration(0.84)).toBe('0.8 s');
    expect(formatDuration(12)).toBe('12.0 s');
    expect(formatDuration(65.4)).toBe('1:05');
    expect(formatDuration(600)).toBe('10:00');
  });
});

describe('soundFieldsOf (E3 — the details panel sound rows)', () => {
  it('nothing for an unindexed file or an entry with no probe / audio / usedIn', () => {
    expect(soundFieldsOf(undefined)).toEqual([]);
    expect(soundFieldsOf({})).toEqual([]);
  });

  it('a catalog clip: duration, category, LUFS, SAMPLE peak, source, licence, used in — in that order', () => {
    expect(
      soundFieldsOf({
        probe: probe(1.24),
        audio: {
          category: 'motion',
          loudnessLufs: -20,
          peakDbfs: -3.25,
          peakKind: 'sample',
          source: 'elevenlabs sound-generation',
          license: 'ElevenLabs paid plan, commercial use',
        },
        usedIn: ['vid-001', 'proj-abc'],
      })
    ).toEqual([
      { label: 'Duration', value: '1.2 s' },
      { label: 'Category', value: 'motion' },
      { label: 'Loudness', value: '−20.0 LUFS' },
      { label: 'Peak', value: '−3.3 dBFS · sample peak' },
      { label: 'Source', value: 'elevenlabs sound-generation' },
      { label: 'Licence', value: 'ElevenLabs paid plan, commercial use' },
      { label: 'Used in', value: 'vid-001, proj-abc' },
    ]);
  });

  it('a generated sound: TRUE peak in dBTP and the model', () => {
    expect(
      soundFieldsOf({
        probe: probe(2),
        audio: { loudnessLufs: -20.04, peakDbfs: -1.9, peakKind: 'true', source: 'standin', model: 'standin-v1' },
      })
    ).toEqual([
      { label: 'Duration', value: '2.0 s' },
      { label: 'Loudness', value: '−20.0 LUFS' },
      { label: 'Peak', value: '−1.9 dBTP · true peak' },
      { label: 'Source', value: 'standin' },
      { label: 'Model', value: 'standin-v1' },
    ]);
  });

  it('no LUFS reading: "not normalized" after a failed normalize, else "no LUFS reading"; unknown peak kind is plain dBFS', () => {
    expect(soundFieldsOf({ audio: { normalizeError: 'ffmpeg exited 1' } })).toEqual([
      { label: 'Loudness', value: 'not normalized' },
    ]);
    expect(soundFieldsOf({ audio: { peakDbfs: -1.9 } })).toEqual([
      { label: 'Loudness', value: 'no LUFS reading' },
      { label: 'Peak', value: '−1.9 dBFS' },
    ]);
  });

  it('skips a zero / non-finite duration and an empty usedIn', () => {
    expect(soundFieldsOf({ probe: probe(0), usedIn: [] })).toEqual([]);
    expect(soundFieldsOf({ probe: probe(Number.NaN) })).toEqual([]);
  });
});

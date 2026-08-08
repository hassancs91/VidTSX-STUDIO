import { describe, it, expect } from 'vitest';
import { parseWhisperJson, wordsFromTokens } from './whisper-output';

// Token stream shapes below mirror real `-ojf` output from the whisper.cpp
// v1.8.3 binary the app downloads (verified by running it on a test WAV).

const ms = (from: number, to: number) => ({ from, to });

function token(text: string, from: number, to: number, p = 0.9) {
  return { text, offsets: ms(from, to), p };
}

describe('wordsFromTokens', () => {
  it('merges BPE sub-word tokens into one word ("AutoCut" case)', () => {
    const words = wordsFromTokens(
      [token(' Auto', 3000, 3300), token('C', 3300, 3400), token('ut', 3400, 3600)],
      0,
      10,
    );
    expect(words).toEqual([{ text: 'AutoCut', start: 3, end: 3.6, confidence: 0.9 }]);
  });

  it('skips control tokens like [_BEG_] and [_TT_236]', () => {
    const words = wordsFromTokens(
      [token('[_BEG_]', 0, 0), token(' Hello', 150, 500), token('[_TT_236]', 4720, 4720)],
      0,
      10,
    );
    expect(words).toEqual([{ text: 'Hello', start: 0.15, end: 0.5, confidence: 0.9 }]);
  });

  it('attaches punctuation text without inheriting its phantom timing', () => {
    // Real case: "Hello there." — the "." token sat at 1600ms while "there"
    // ended at 740ms. Extending the word to 1600 would swallow a real pause.
    const words = wordsFromTokens(
      [token(' Hello', 150, 500), token(' there', 500, 740), token('.', 1600, 1600, 0.59)],
      0,
      10,
    );
    expect(words).toEqual([
      { text: 'Hello', start: 0.15, end: 0.5, confidence: 0.9 },
      { text: 'there.', start: 0.5, end: 0.74, confidence: 0.9 },
    ]);
  });

  it('uses the worst speech-token probability as word confidence', () => {
    const words = wordsFromTokens([token(' enco', 0, 200, 0.95), token('ding', 200, 400, 0.6)], 0, 10);
    expect(words?.[0].confidence).toBe(0.6);
  });

  it('falls back to punctuation timing for punctuation-only words', () => {
    const words = wordsFromTokens([token(' —', 1000, 1100)], 0, 10);
    expect(words).toEqual([{ text: '—', start: 1, end: 1.1 }]);
  });

  it('clamps word times into the segment span and keeps end ≥ start', () => {
    const words = wordsFromTokens([token(' late', 5200, 6800)], 0, 6);
    expect(words).toEqual([{ text: 'late', start: 5.2, end: 6, confidence: 0.9 }]);
  });

  it('returns undefined (not []) when there is no usable token data', () => {
    expect(wordsFromTokens(undefined, 0, 10)).toBeUndefined();
    expect(wordsFromTokens([], 0, 10)).toBeUndefined();
    expect(wordsFromTokens([token('[_BEG_]', 0, 0)], 0, 10)).toBeUndefined();
  });
});

describe('parseWhisperJson', () => {
  const fullJson = JSON.stringify({
    result: { language: 'en' },
    transcription: [
      {
        timestamps: { from: '00:00:00,000', to: '00:00:04,720' },
        offsets: { from: 0, to: 4720 },
        text: ' Hello there.',
        tokens: [
          token('[_BEG_]', 0, 0),
          token(' Hello', 150, 500),
          token(' there', 500, 740),
          token('.', 1600, 1600),
          token('[_TT_236]', 4720, 4720),
        ],
      },
      {
        timestamps: { from: '00:00:04,720', to: '00:00:07,360' },
        offsets: { from: 4720, to: 7360 },
        text: ' Let me pause now.',
        tokens: [token(' Let', 4900, 5100), token(' me', 5100, 5250), token(' pause', 5250, 5700), token(' now', 5700, 6000), token('.', 6000, 6050)],
      },
    ],
  });

  it('parses full -ojf output into segments with measured words', () => {
    const result = parseWhisperJson(fullJson);
    expect(result.language).toBe('en');
    expect(result.duration).toBe(7.36);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].text).toBe('Hello there.');
    expect(result.segments[0].words?.map((w) => [w.text, w.start, w.end])).toEqual([
      ['Hello', 0.15, 0.5],
      ['there.', 0.5, 0.74],
    ]);
    expect(result.segments[1].words).toHaveLength(4);
  });

  it('parses plain -oj output (no tokens) into words-less segments', () => {
    const plain = JSON.stringify({
      transcription: [
        {
          timestamps: { from: '00:00:00,000', to: '00:00:05,000' },
          offsets: { from: 0, to: 5000 },
          text: ' Hello world.',
        },
      ],
    });
    const result = parseWhisperJson(plain, 'en');
    expect(result.segments[0].words).toBeUndefined();
    expect(result.segments[0].start).toBe(0);
    expect(result.segments[0].end).toBe(5);
    expect(result.language).toBe('en');
  });

  it('parses the legacy numeric-seconds segment format', () => {
    const legacy = JSON.stringify({ segments: [{ start: 0, end: 2.5, text: ' Hi.' }] });
    const result = parseWhisperJson(legacy);
    expect(result.segments[0].end).toBe(2.5);
    expect(result.text).toBe('Hi.');
  });
});

import { describe, it, expect } from 'vitest';
import { formatTakesView, splitTakes, type TakesWord } from './transcript-takes-view';

function word(text: string, start: number, end: number): TakesWord {
  return { text, start, end };
}

describe('splitTakes', () => {
  it('splits on gaps > 0.8 s and numbers segments from 1', () => {
    const takes = splitTakes([
      word('One', 0, 0.3),
      word('two.', 0.4, 0.7),
      word('Three', 2.0, 2.4), // 1.3 s gap
      word('four.', 2.5, 2.9),
    ]);
    expect(takes.map((t) => t.index)).toEqual([1, 2]);
    expect(takes[0]).toMatchObject({ start: 0, end: 0.7 });
    expect(takes[1]).toMatchObject({ start: 2.0, end: 2.9 });
  });

  it('keeps a gap of exactly 0.8 s inside one segment', () => {
    const takes = splitTakes([word('a', 0, 0.5), word('b', 1.3, 1.6)]);
    expect(takes).toHaveLength(1);
  });

  it('sorts unordered words before segmenting', () => {
    const takes = splitTakes([word('late', 5, 5.4), word('early', 0, 0.4)]);
    expect(takes).toHaveLength(2);
    expect(takes[0].text).toBe('early');
  });

  it('returns no segments for an empty transcript', () => {
    expect(splitTakes([])).toEqual([]);
  });
});

describe('formatTakesView', () => {
  it('marks fillers inline with exact bounds, keeping the original token', () => {
    const view = formatTakesView('clip', [
      word('So', 0, 0.2),
      word('uh,', 0.3, 0.45),
      word('anyway.', 0.6, 1.0),
    ]);
    expect(view).toContain('So <<uh, 0.30-0.45>> anyway.');
  });

  it('does not mark words that merely contain a filler substring', () => {
    const view = formatTakesView('clip', [word('umbrella', 0, 0.5)]);
    expect(view).toContain('umbrella');
    expect(view).not.toContain('<<');
  });

  it('renders the header, segment lines, and pause lines', () => {
    const view = formatTakesView('recording.mp4', [
      word('First', 0.1, 0.5),
      word('take.', 0.6, 1.0),
      word('Second', 4.0, 4.4),
      word('take.', 4.5, 65.0),
    ]);
    const lines = view.split('\n');
    expect(lines[0]).toBe('# recording.mp4 — 4 words, ends 01:05');
    expect(lines[1]).toBe('#01 [0.10 - 1.00] (00:00) First take.');
    expect(lines[2]).toBe('     -- pause 3.0s --');
    expect(lines[3]).toBe('#02 [4.00 - 65.00] (00:04) Second take.');
  });

  it('handles an empty word list', () => {
    expect(formatTakesView('x', [])).toBe('# x — no words');
  });
});

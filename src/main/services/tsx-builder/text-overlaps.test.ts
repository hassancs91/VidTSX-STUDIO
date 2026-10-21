import { describe, expect, it } from 'vitest';
import type { FrameShape, FrameTextItem } from './frame-text';
import { checkOverlaps, describeOverlaps, frameOverlaps, MAX_LISTED_OVERLAPS, readableShape, THIN_SHAPE_PX } from './text-overlaps';

const text = (t: string, x: number, y: number, w: number, h = 40, o = 1): FrameTextItem => ({ t, x, y, w, h, o });
const shape = (k: string, x: number, y: number, w: number, h: number, o = 1): FrameShape => ({ k, x, y, w, h, o });

describe('text on text', () => {
  it('flags two texts sharing more than a fifth of the smaller box', () => {
    const hits = frameOverlaps([text('ROWS READ', 100, 100, 200), text('2.0 ms', 250, 110, 120)], []);
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe('text');
  });

  it('lets a light touch pass', () => {
    // 10 px of a 120 px wide box: under a fifth.
    expect(frameOverlaps([text('ROWS READ', 100, 100, 200), text('2.0 ms', 290, 100, 120)], [])).toEqual([]);
  });

  it('compares ink, not line boxes: lines stacked at lineHeight 1 pass (r1: a 84 px total under its title)', () => {
    // Poppins 84 px: content box ~118 px in an 88 px line, so it spills ~15 px onto the 48 px title above.
    expect(frameOverlaps([text('SIMPLE', 60, 250, 140, 48), text('$34,000', 60, 283, 330, 118)], [])).toEqual([]);
  });

  it('counts a shadow or an outline (the same text on the same spot) once', () => {
    expect(frameOverlaps([text('$25,182', 100, 100, 200), text('$25,182', 103, 103, 200)], [])).toEqual([]);
  });

  it('skips a crossfade: either side faint', () => {
    expect(frameOverlaps([text('YEAR 6', 100, 100, 200, 40, 0.2), text('YEAR 7', 100, 100, 200)], [])).toEqual([]);
  });

  it('skips the middle of a crossfade (both half shown), not a solid text on a ghost', () => {
    expect(frameOverlaps([text('YEAR 6', 100, 100, 200, 40, 0.5), text('YEAR 7', 100, 100, 200, 40, 0.5)], [])).toEqual([]);
    expect(frameOverlaps([text('YEAR 6', 100, 100, 200, 40, 0.6), text('YEAR 7', 100, 100, 200)], [])).toHaveLength(1);
  });
});

describe('text on a shape', () => {
  const label = text('$16,000', 100, 100, 200, 40); // core x 140-260, y 108-132

  it('flags a line through the word, even a hairline box', () => {
    expect(frameOverlaps([label], [shape('line', 50, 120, 400, 0)])).toHaveLength(1);
    expect(frameOverlaps([label], [shape('rect', 50, 118, 400, 4)])).toHaveLength(1);
  });

  it('flags a word hanging off a panel edge', () => {
    expect(frameOverlaps([label], [shape('box', 0, 0, 200, 400)])).toHaveLength(1);
  });

  it('flags a marker on the label', () => {
    expect(frameOverlaps([label], [shape('circle', 190, 110, 20, 20)])).toHaveLength(1);
  });

  it('lets a label sit on its own pill or card', () => {
    expect(frameOverlaps([label], [shape('box', 90, 95, 220, 50)])).toEqual([]);
    expect(frameOverlaps([label], [shape('rect', 0, 0, 1080, 1350)])).toEqual([]);
  });

  it('reads only shapes painted over the text (after it in document order): a backdrop grid or disc is under it', () => {
    const word = { ...label, i: 10 };
    expect(frameOverlaps([word], [{ ...shape('line', 0, 120, 1080, 0), i: 3 }])).toEqual([]); // a grid line drawn first
    expect(frameOverlaps([word], [{ ...shape('circle', 0, 0, 200, 400), i: 2 }])).toEqual([]); // a backdrop disc's edge
    expect(frameOverlaps([word], [{ ...shape('line', 0, 120, 1080, 0), i: 11 }])).toHaveLength(1); // drawn after: on top
    expect(frameOverlaps([{ ...word, i: -1 }], [{ ...shape('line', 0, 120, 1080, 0), i: 3 }])).toHaveLength(1); // order unknown: counted
  });

  it('ignores a shape that only grazes the edge (an underline)', () => {
    expect(frameOverlaps([label], [shape('rect', 100, 136, 200, 3)])).toEqual([]);
  });

  it('reads only shapes whose box is their ink', () => {
    expect(readableShape(shape('path', 0, 0, 300, 200))).toBe(false); // a curve's box
    expect(readableShape(shape('path', 0, 0, 300, THIN_SHAPE_PX))).toBe(true); // an axis
    expect(readableShape(shape('line', 0, 0, 300, 200))).toBe(false); // a diagonal
    expect(frameOverlaps([label], [shape('path', 0, 0, 400, 300)])).toEqual([]);
  });

  it('skips faint text and faint shapes', () => {
    expect(frameOverlaps([text('$16,000', 100, 100, 200, 40, 0.1)], [shape('line', 50, 120, 400, 0)])).toEqual([]);
    expect(frameOverlaps([label], [shape('line', 50, 120, 400, 0, 0.2)])).toEqual([]);
  });
});

describe('runs across the sweep', () => {
  /** A counting total and a bar that crosses it on frames 10-19, and again at 30. */
  const frames = Array.from({ length: 40 }, (_, frame) => ({
    frame,
    items: [text(`$${(10000 + frame * 240).toLocaleString('en-US')}`, 100, 100, 200)],
    shapes: [shape('rect', (frame >= 10 && frame < 20) || frame === 30 ? 150 : 600, 90, 20, 60)],
    moreShapes: 0,
  }));

  it('joins consecutive hits on the same pair (digits masked), longest first', () => {
    const result = checkOverlaps(frames);
    expect(result.clear).toBe(false);
    expect(result.runs.map((r) => [r.from, r.to, r.frames])).toEqual([
      [10, 19, 10],
      [30, 30, 1],
    ]);
    expect(result.runs[0].texts).toEqual(['$12,400']);
    expect(result.shapesRead).toBe(40);
  });

  it('describes the runs for the builder, listed and not enforced', () => {
    const out = describeOverlaps(checkOverlaps(frames), ', every 2th frame');
    expect(out).toContain('text_overlaps on 40 frames, every 2th frame: OVERLAPS, 2');
    expect(out).toContain('"$12,400" crossed by a rect: f10-19 (10 swept frames)');
    expect(out).toContain('"$17,200" crossed by a rect: f30 (1 swept frame)');
    expect(out).toContain('Not enforced');
  });

  it('is CLEAR when nothing meets, and says what it cannot read', () => {
    const out = describeOverlaps(checkOverlaps(frames.map((f) => ({ ...f, shapes: [] }))));
    expect(out).toContain('CLEAR');
    expect(out).toContain('not read');
  });

  it(`lists at most ${MAX_LISTED_OVERLAPS} runs`, () => {
    // Twenty different labels in a column, one vertical hairline through them all.
    const items = Array.from({ length: 20 }, (_, i) => text(`label ${String.fromCharCode(65 + i)}`, 100, 100 + i * 50, 200));
    const out = describeOverlaps(checkOverlaps([{ frame: 0, items, shapes: [shape('line', 200, 0, 0, 2000)] }]));
    expect(out).toContain('+ 8 more not listed');
  });
});

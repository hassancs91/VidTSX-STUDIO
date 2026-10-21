import { describe, expect, it } from 'vitest';
import {
  describeFrameText,
  FRAME_TEXT_MARK,
  FRAME_TEXT_PROBE,
  frameTextProbe,
  frameTextFor,
  frameTextLines,
  MAX_FRAME_LINES,
  readFrameTextLog,
  withFrameTextProbe,
  type FrameTextItem,
} from './frame-text';

/** A text node 48 px tall, solid unless `o` says otherwise. */
const item = (t: string, x: number, y: number, w: number, o = 1): FrameTextItem => ({ t, x, y, w, h: 55, o });
const texts = (items: FrameTextItem[]) => frameTextLines(items).map((l) => (l.faint ? `${l.text} (faint)` : l.text));

describe('the page probe', () => {
  it('is valid script that returns at once outside a browser', () => {
    expect(() => new Function(FRAME_TEXT_PROBE)()).not.toThrow();
  });

  it('never looks like a second export to the wrapper or the sheet renames', () => {
    expect(FRAME_TEXT_PROBE).not.toMatch(/\bexport\b/);
    expect(FRAME_TEXT_PROBE).not.toContain('compositionConfig');
    expect(withFrameTextProbe('export default function A() {}')).toMatch(/^export default function A\(\) \{\}\n;\(\(\) => \{/);
  });

  it('lists shapes only when asked (the number sweep), and that probe is valid script too', () => {
    const shapes = frameTextProbe(true);
    expect(() => new Function(shapes)()).not.toThrow();
    expect(shapes).not.toMatch(/\bexport\b/);
    expect(shapes).toContain('const SHAPES = true;');
    expect(FRAME_TEXT_PROBE).toContain('const SHAPES = false;');
    expect(withFrameTextProbe('x', { shapes: true })).toBe(`x\n${shapes}`);
    expect(withFrameTextProbe('x')).toBe(`x\n${FRAME_TEXT_PROBE}`);
  });
});

describe('readFrameTextLog', () => {
  it('reads the groups behind the mark and drops malformed items', () => {
    const log = `${FRAME_TEXT_MARK}${JSON.stringify({
      groups: [{ frame: null, items: [item('Year 12', 0, 0, 100), { t: 5 }, { t: 'x', x: 'a' }], more: 2 }],
    })}`;
    expect(readFrameTextLog(log)).toEqual([{ frame: null, items: [item('Year 12', 0, 0, 100)], more: 2 }]);
  });

  it('reads shapes when the group lists them, dropping malformed ones', () => {
    const rect = { k: 'rect', x: 10, y: 20, w: 30, h: 0, o: 0.8 };
    const log = `${FRAME_TEXT_MARK}${JSON.stringify({
      groups: [{ frame: 4, items: [], more: 0, shapes: [rect, { k: 'path', x: 'a' }, { x: 1 }], moreShapes: 3 }],
    })}`;
    expect(readFrameTextLog(log)).toEqual([{ frame: 4, items: [], more: 0, shapes: [rect], moreShapes: 3 }]);
  });

  it('is null for any other log, bad JSON, and the probe reporting its own error', () => {
    expect(readFrameTextLog('Download progress 50%')).toBeNull();
    expect(readFrameTextLog(`${FRAME_TEXT_MARK}{not json`)).toBeNull();
    expect(readFrameTextLog(`${FRAME_TEXT_MARK}${JSON.stringify({ error: 'boom' })}`)).toBeNull();
  });
});

describe('frameTextLines', () => {
  it('joins split nodes on one row: a trailing space, an adjacent span, an SVG tspan', () => {
    expect(texts([item('Total ', 100, 160, 120), item('$', 220, 160, 25), item('1,000', 245, 160, 110)])).toEqual(['Total $1,000']);
    expect(texts([item('Year ', 100, 265, 110), item('10', 210, 265, 50), item(' of 30', 260, 265, 130)])).toEqual(['Year 10 of 30']);
  });

  it('puts a space where nodes have a word gap and no space of their own', () => {
    expect(texts([item('Year', 100, 0, 90), item('12', 205, 0, 50)])).toEqual(['Year 12']);
  });

  it('reads top to bottom, left to right, and splits far-apart labels on one row', () => {
    expect(texts([item('Right', 800, 360, 110), item('Step 1', 100, 60, 140), item('Left', 100, 360, 90)])).toEqual(['Step 1', 'Left', 'Right']);
  });

  it('counts the same text drawn twice on one spot once, and solid when either copy is', () => {
    expect(texts([item('Shadowed', 103, 463, 200, 0.3), item('Shadowed', 100, 460, 200)])).toEqual(['Shadowed']);
    expect(texts([item('Faint', 100, 660, 100, 0.2)])).toEqual(['Faint (faint)']);
  });

  it('reads a small caption beside a big number on its row, a stacked second line as its own string', () => {
    // B5's "±5 m" at 120 px with "where all four / spheres meet" at 30 px beside it, centred.
    const big = { t: '±5 m', x: 0, y: 0, w: 230, h: 120, o: 1 };
    const one = { t: 'where all four', x: 258, y: 23, w: 200, h: 36, o: 1 };
    const two = { t: 'spheres meet', x: 258, y: 61, w: 180, h: 36, o: 1 };
    expect(texts([two, big, one])).toEqual(['±5 m where all four', 'spheres meet']);
    // The same layout drawn at a third of the size (a contact sheet tile) reads the same.
    const third = (i: FrameTextItem) => ({ ...i, x: i.x / 3 + 0.2, y: i.y / 3 - 0.3, w: i.w / 3, h: i.h / 3 });
    expect(texts([third(two), third(big), third(one)])).toEqual(['±5 m where all four', 'spheres meet']);
  });

  it('keeps two copies of a label that sit apart', () => {
    expect(texts([item('+$1,600', 100, 0, 150), item('+$1,600', 100, 300, 150)])).toEqual(['+$1,600', '+$1,600']);
  });
});

describe('frameTextFor', () => {
  const groups = [
    { frame: 0, items: [item('Year 0', 0, 0, 100)], more: 0 },
    { frame: 30, items: [item('Year 1', 0, 0, 100)], more: 3 },
  ];

  it('picks a mounted sheet tile by its frame', () => {
    expect(frameTextFor(groups, 30)).toEqual({ lines: [{ text: 'Year 1', faint: false }], more: 3 });
    expect(frameTextFor(groups, 60)).toBeNull();
  });

  it("takes a still's whole page, and is null when nothing was read", () => {
    expect(frameTextFor([{ frame: null, items: [item('A', 0, 0, 20)], more: 0 }], 120)?.lines).toEqual([{ text: 'A', faint: false }]);
    expect(frameTextFor(null, 0)).toBeNull();
  });
});

describe('describeFrameText', () => {
  it('quotes each string, marks faint ones, and says none or not read', () => {
    expect(describeFrameText({ lines: [{ text: 'Year 12', faint: false }, { text: 'Payoff', faint: true }], more: 0 })).toBe(
      '"Year 12" · "Payoff" (faint)',
    );
    expect(describeFrameText({ lines: [], more: 0 })).toBe('none');
    expect(describeFrameText(null)).toBe('not read');
  });

  it('caps the list and counts what it leaves out', () => {
    const lines = Array.from({ length: MAX_FRAME_LINES + 5 }, (_, i) => ({ text: `n${i}`, faint: false }));
    const line = describeFrameText({ lines, more: 2 });
    expect(line.split(' · ')).toHaveLength(MAX_FRAME_LINES + 1);
    expect(line.endsWith('+ 7 more not listed')).toBe(true);
    expect(describeFrameText({ lines: [{ text: 'x'.repeat(300), faint: false }], more: 0 })).toHaveLength(102);
  });
});

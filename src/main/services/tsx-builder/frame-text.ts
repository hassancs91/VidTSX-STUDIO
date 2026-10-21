// Frame text (P4 part 2, P4-4 (a)): every picture look also hands the builder
// the text on each frame, so it can read its numbers against its model instead
// of only squinting at pixels. P3's agent Craft build kept a label at its
// final value on every frame, and the builder's own look passed it.
//
// How: every look entry carries FRAME_TEXT_PROBE (build-stills.ts
// `prepareBuildRender`), a few lines of page script that, after each DOM
// change, walk the page's text nodes (HTML and SVG), keep the ones a viewer
// can see (opacity along the tree, visibility, fill / colour, inside the
// frame) with their boxes, and console.log them behind FRAME_TEXT_MARK.
// renderStill's `onBrowserLog` carries the last one out (a still is one page,
// closed right after its screenshot). A mounted contact sheet tags each tile
// with FRAME_TEXT_ATTR, so its one page reports a group per frame. The boxes
// are merged into reading-order strings here, in Node, where it can be tested.
// Text drawn on a canvas, in WebGL or inside an image is not in the DOM and is
// not listed. Free and not enforced: the method asks the builder to read it.
//
// With `shapes` (P5-4, the number sweep only), each group also lists the drawn
// shapes a viewer can see: SVG rect / circle / ellipse / line / polyline /
// polygon / path, and HTML elements with a visible background or border, as
// boxes, for text_overlaps (text-overlaps.ts). The looks keep text alone.

export const FRAME_TEXT_MARK = '__vidtsx_frame_text__';
/** On a mounted contact sheet's tile: the frame that tile shows. */
export const FRAME_TEXT_ATTR = 'data-vidtsx-frame';
/** Opacity (along the tree, times the text's own paint) under which text counts as not shown. */
const MIN_VISIBLE = 0.05;
/** Under this a shown string is marked "(faint)": mid-fade, a ghost. */
export const FAINT_BELOW = 0.35;
/** Text nodes one group reports; the rest are counted. */
const MAX_ITEMS = 400;
/** Shapes one group reports; the rest are counted. */
const MAX_SHAPES = 400;
/** Strings listed per frame for the model; the rest are counted. */
export const MAX_FRAME_LINES = 40;
const MAX_LINE_CHARS = 100;

/** What the model is told the list is (and is not). */
export const FRAME_TEXT_NOTE =
  'HTML and SVG text in reading order, "(faint)" = mostly transparent; text drawn on a canvas, in 3D or inside an image is not listed';

/**
 * The page script appended to a look entry. It contains no export and no
 * `compositionConfig`, so the wrapper's parser and the sheet's renames never
 * see it, and it returns at once outside a browser. `shapes`: also list the
 * drawn shapes (the number sweep).
 */
export function frameTextProbe(shapes: boolean): string {
  return String.raw`;(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__vidtsxFrameText) return;
  window.__vidtsxFrameText = true;
  const MARK = ${JSON.stringify(FRAME_TEXT_MARK)};
  const ATTR = ${JSON.stringify(FRAME_TEXT_ATTR)};
  const MAX_ITEMS = ${MAX_ITEMS};
  const MAX_SHAPES = ${MAX_SHAPES};
  const SHAPES = ${shapes ? 'true' : 'false'};
  const MIN_VISIBLE = ${MIN_VISIBLE};
  const SKIP = 'script,style,noscript,template,title,desc,metadata';
  const SVG_SHAPES = 'rect,circle,ellipse,line,polyline,polygon,path';
  const NOT_DRAWN = 'defs,clipPath,mask,marker,pattern,symbol,linearGradient,radialGradient,filter';
  const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
  const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const alpha = (c) => {
    if (!c || c === 'none' || c === 'transparent') return 0;
    const m = /^rgba?\(([^)]*)\)$/.exec(c);
    if (!m) return 1;
    const parts = m[1].split(/[\s,\/]+/).filter(Boolean);
    return parts.length >= 4 ? num(parts[3], 1) : 1;
  };
  const read = () => {
    const opacity = new Map();
    const chain = (el) => {
      if (!el || el.nodeType !== 1) return 1;
      const hit = opacity.get(el);
      if (hit !== undefined) return hit;
      const s = getComputedStyle(el);
      const own = s.display === 'none' ? 0 : num(s.opacity, 1);
      const value = own <= 0 ? 0 : own * chain(el.parentElement);
      opacity.set(el, value);
      return value;
    };
    const paint = (el) => {
      const s = getComputedStyle(el);
      if (s.visibility !== 'visible') return 0;
      if (el instanceof SVGElement) {
        const fill = s.fill === 'none' ? 0 : alpha(s.fill) * num(s.fillOpacity, 1);
        const stroke = s.stroke === 'none' || num(s.strokeWidth, 1) <= 0 ? 0 : alpha(s.stroke) * num(s.strokeOpacity, 1);
        return Math.max(fill, stroke);
      }
      const fill = alpha(s.webkitTextFillColor || s.color);
      if (fill > 0) return fill;
      for (let e = el, i = 0; e && i < 5; e = e.parentElement, i++) {
        const cs = getComputedStyle(e);
        if (cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text') return 1;
      }
      return num(s.webkitTextStrokeWidth, 0) > 0 ? alpha(s.webkitTextStrokeColor) : 0;
    };
    const range = document.createRange();
    const rectOf = (node) => {
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      return r.width > 0 || r.height > 0 ? r : node.parentElement.getBoundingClientRect();
    };
    const round = (v) => Math.round(v * 10) / 10;
    const tagged = Array.from(document.querySelectorAll('[' + ATTR + ']'));
    const groups = tagged.length
      ? tagged.map((root) => ({ root, frame: num(root.getAttribute(ATTR), null) }))
      : [{ root: document.body, frame: null }];
    return groups.map(({ root, frame }) => {
      const items = [];
      const owners = [];
      let more = 0;
      if (!root) return { frame, items, more };
      const box = frame === null
        ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
        : root.getBoundingClientRect();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const raw = node.nodeValue;
        const el = node.parentElement;
        if (!raw || !raw.trim() || !el || el.closest(SKIP)) continue;
        const o = chain(el) * paint(el);
        if (o < MIN_VISIBLE) continue;
        const r = rectOf(node);
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.right <= box.left || r.left >= box.right || r.bottom <= box.top || r.top >= box.bottom) continue;
        if (items.length >= MAX_ITEMS) { more += 1; continue; }
        owners.push(el);
        items.push({
          t: raw.replace(/\s+/g, ' ').slice(0, 200),
          x: round(r.left - box.left),
          y: round(r.top - box.top),
          w: round(r.width),
          h: round(r.height),
          o: Math.round(o * 100) / 100,
        });
      }
      if (!SHAPES) return { frame, items, more };
      // Document order stands for paint order (z-index is not read): each text and shape carries it.
      const all = root.querySelectorAll('*');
      const order = new Map();
      all.forEach((el, i) => order.set(el, i));
      items.forEach((item, n) => { item.i = order.has(owners[n]) ? order.get(owners[n]) : -1; });
      const meetsText = (x, y, w, h) => items.some((t) => x <= t.x + t.w && t.x <= x + w && y <= t.y + t.h && t.y <= y + h);
      const shapes = [];
      let moreShapes = 0;
      for (const el of all) {
        if (el.closest(SKIP) || el.closest(NOT_DRAWN)) continue;
        let k;
        let o;
        if (el instanceof SVGElement) {
          if (!el.matches(SVG_SHAPES)) continue;
          k = el.tagName.toLowerCase();
          o = chain(el) * paint(el);
        } else {
          const s = getComputedStyle(el);
          if (s.visibility !== 'visible') continue;
          const fill = Math.max(alpha(s.backgroundColor), s.backgroundImage && s.backgroundImage !== 'none' ? 1 : 0);
          const border = SIDES.some((side) => num(s['border' + side + 'Width'], 0) > 0 && s['border' + side + 'Style'] !== 'none' && alpha(s['border' + side + 'Color']) > 0) ? 1 : 0;
          if (!fill && !border) continue;
          k = 'box';
          o = chain(el) * Math.max(fill, border);
        }
        if (o < MIN_VISIBLE) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 && r.height <= 0) continue;
        if (r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom) continue;
        const x = round(r.left - box.left);
        const y = round(r.top - box.top);
        const w = round(r.width);
        const h = round(r.height);
        if (!meetsText(x, y, w, h)) continue; // only shapes that touch a text matter
        if (shapes.length >= MAX_SHAPES) { moreShapes += 1; continue; }
        shapes.push({ k, x, y, w, h, o: Math.round(o * 100) / 100, i: order.get(el) });
      }
      return { frame, items, more, shapes, moreShapes };
    });
  };
  const emit = () => {
    let body;
    try { body = JSON.stringify({ groups: read() }); } catch (err) { body = JSON.stringify({ error: String((err && err.message) || err) }); }
    console.log(MARK + body);
  };
  new MutationObserver(emit).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
})();
`;
}

/** The look's probe: text only. */
export const FRAME_TEXT_PROBE = frameTextProbe(false);

/** A look entry's code with the probe after it; `shapes` for the number sweep. */
export function withFrameTextProbe(code: string, options: { shapes?: boolean } = {}): string {
  return `${code}\n${options.shapes ? frameTextProbe(true) : FRAME_TEXT_PROBE}`;
}

/** One visible text node: its text (whitespace collapsed, not trimmed), box in its group, and opacity. */
export interface FrameTextItem {
  t: string;
  x: number;
  y: number;
  w: number;
  h: number;
  o: number;
  /** With shapes only: its element's place in document order (paint order, z-index aside); -1 unknown. */
  i?: number;
}

/**
 * One visible drawn shape that touches a text box: its kind (an SVG tag, or "box" for an HTML element with a
 * background or border), box, opacity and place in document order (a shape after a text is painted over it).
 */
export interface FrameShape {
  k: string;
  x: number;
  y: number;
  w: number;
  h: number;
  o: number;
  i?: number;
}

/**
 * A page's text: one group for a still (`frame` null), one per tile on a mounted sheet. `more` = nodes past the cap.
 * `shapes` / `moreShapes` only when the probe was asked for shapes.
 */
export interface FrameTextGroup {
  frame: number | null;
  items: FrameTextItem[];
  more: number;
  shapes?: FrameShape[];
  moreShapes?: number;
}

/** One string on screen. */
export interface FrameTextLine {
  text: string;
  faint: boolean;
}

/** A frame's text in reading order, and how many text nodes went unlisted. */
export interface FrameText {
  lines: FrameTextLine[];
  more: number;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function toItem(v: unknown): FrameTextItem | null {
  const i = v as Partial<FrameTextItem> | null;
  if (!i || typeof i.t !== 'string' || ![i.x, i.y, i.w, i.h, i.o].every(finite)) return null;
  return { t: i.t, x: i.x!, y: i.y!, w: i.w!, h: i.h!, o: i.o!, ...(finite(i.i) ? { i: i.i } : {}) };
}

function toShape(v: unknown): FrameShape | null {
  const s = v as Partial<FrameShape> | null;
  if (!s || typeof s.k !== 'string' || ![s.x, s.y, s.w, s.h, s.o].every(finite)) return null;
  return { k: s.k, x: s.x!, y: s.y!, w: s.w!, h: s.h!, o: s.o!, ...(finite(s.i) ? { i: s.i } : {}) };
}

/** The groups a page logged behind the mark, or null (another log, a malformed one, or the probe's own error). */
export function readFrameTextLog(text: string): FrameTextGroup[] | null {
  if (!text.startsWith(FRAME_TEXT_MARK)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(FRAME_TEXT_MARK.length));
  } catch {
    return null;
  }
  const groups = (parsed as { groups?: unknown } | null)?.groups;
  if (!Array.isArray(groups)) return null;
  return groups.map((g: { frame?: unknown; items?: unknown; more?: unknown; shapes?: unknown; moreShapes?: unknown }) => ({
    frame: finite(g?.frame) ? g.frame : null,
    items: Array.isArray(g?.items) ? g.items.map(toItem).filter((i): i is FrameTextItem => i !== null) : [],
    more: finite(g?.more) ? g.more : 0,
    ...(Array.isArray(g?.shapes)
      ? {
          shapes: g.shapes.map(toShape).filter((s): s is FrameShape => s !== null),
          moreShapes: finite(g?.moreShapes) ? g.moreShapes : 0,
        }
      : {}),
  }));
}

/** A node joins a row when this share of the shorter one's height lies inside the row's tallest node. */
const SAME_ROW = 0.6;
/** A gap wider than this many text heights starts a new string. */
const NEW_STRING_GAP = 1.2;
/** A gap wider than this many text heights is a space. */
const WORD_GAP = 0.15;
/** A node starting this many heights left of the last one's end sits under it (a stacked caption): a new string. */
const STACKED = 0.5;

/** How much of the shorter box's height the two share. */
function verticalShare(a: FrameTextItem, b: FrameTextItem): number {
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return h <= 0 ? 0 : h / Math.min(a.h, b.h);
}

function overlap(a: FrameTextItem, b: FrameTextItem): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

/**
 * Text nodes → the strings a reader sees, top to bottom, left to right. Rows
 * are seeded by the tallest text, and a node joins one when it sits mostly
 * inside it (a small "Year" beside a big "12", a two-line caption beside a big
 * number), so no threshold sits on a centre that rounds differently at another
 * scale. In a row, close nodes join into one string (a split "Year " + "12",
 * an SVG tspan), a wide gap or a stacked line starts another, and the same
 * text drawn again on the same spot (a shadow, an outline, a glow) counts once.
 */
export function frameTextLines(items: FrameTextItem[]): FrameTextLine[] {
  const rows: Array<{ seed: FrameTextItem; items: FrameTextItem[] }> = [];
  for (const item of [...items].sort((a, b) => b.h - a.h || a.y - b.y || a.x - b.x)) {
    const row = rows.find((r) => verticalShare(r.seed, item) >= SAME_ROW);
    if (row) row.items.push(item);
    else rows.push({ seed: item, items: [item] });
  }
  rows.sort((a, b) => a.seed.y - b.seed.y || a.seed.x - b.seed.x);
  const lines: FrameTextLine[] = [];
  for (const row of rows) {
    const kept: FrameTextItem[] = [];
    let text = '';
    let faint = true;
    let prev: FrameTextItem | null = null;
    const flush = () => {
      const t = text.replace(/\s+/g, ' ').trim();
      if (t) lines.push({ text: t, faint });
      text = '';
      faint = true;
    };
    for (const item of [...row.items].sort((a, b) => a.x - b.x || a.y - b.y)) {
      if (kept.some((k) => k.t.trim() === item.t.trim() && overlap(k, item) > 0.5)) {
        if (item.o >= FAINT_BELOW) faint = false; // a faint shadow under a solid copy is still solid
        continue;
      }
      kept.push(item);
      if (prev) {
        const gap = item.x - (prev.x + prev.w);
        const h = Math.min(prev.h, item.h);
        if (gap > h * NEW_STRING_GAP || gap < -h * STACKED) flush();
        else if (!/\s$/.test(text) && !/^\s/.test(item.t) && gap > h * WORD_GAP) text += ' ';
      }
      text += item.t;
      if (item.o >= FAINT_BELOW) faint = false;
      prev = item;
    }
    flush();
  }
  return lines;
}

/**
 * The text of `frame` from what its page logged: on a mounted sheet, that
 * tile's group; on a still's page (the frame alone), every untagged group.
 * Null when nothing was read.
 */
export function frameTextFor(groups: FrameTextGroup[] | null | undefined, frame: number): FrameText | null {
  if (!groups) return null;
  const own = groups.filter((g) => g.frame === frame);
  const picked = own.length ? own : groups.filter((g) => g.frame === null);
  if (!picked.length) return null;
  return {
    lines: frameTextLines(picked.flatMap((g) => g.items)),
    more: picked.reduce((sum, g) => sum + g.more, 0),
  };
}

const clip = (s: string) => (s.length > MAX_LINE_CHARS ? `${s.slice(0, MAX_LINE_CHARS - 1)}…` : s);

/** One frame's text for the model: `"Year 12" · "$25,182" (faint)`, "none" or "not read". */
export function describeFrameText(text: FrameText | null | undefined): string {
  if (!text) return 'not read';
  if (!text.lines.length && !text.more) return 'none';
  const shown = text.lines.slice(0, MAX_FRAME_LINES).map((l) => `"${clip(l.text)}"${l.faint ? ' (faint)' : ''}`);
  const rest = Math.max(0, text.lines.length - MAX_FRAME_LINES) + text.more;
  if (rest > 0) shown.push(`+ ${rest} more not listed`);
  return shown.join(' · ');
}

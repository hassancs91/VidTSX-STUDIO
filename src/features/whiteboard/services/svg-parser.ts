/**
 * Reads a user-uploaded SVG and reduces it to the data shape the whiteboard
 * animator understands: a flat ordered list of path `d` strings plus a viewBox.
 *
 * Bakes parent `<g transform>` matrices into the path coordinates so the output
 * has no transforms of its own. Converts `<rect>`, `<circle>`, `<ellipse>`,
 * `<line>`, `<polyline>`, `<polygon>` to equivalent `<path>` data. Drops
 * `<defs>`, `<filter>`, `<image>`, `<text>`, `<use>`, and styling.
 *
 * Arc transforms under non-uniform scale or rotation are approximated by
 * transforming the endpoint and scaling rx/ry by the matrix's component
 * magnitudes — acceptable for typical icon-pack uploads, not strictly correct
 * for arbitrary affine matrices.
 */

const FALLBACK_VIEWBOX = '0 0 200 200';

const DROP_TAGS = new Set([
  'defs',
  'filter',
  'image',
  'text',
  'use',
  'style',
  'metadata',
  'desc',
  'title',
  'foreignobject',
  'clippath',
  'mask',
  'pattern',
  'lineargradient',
  'radialgradient',
  'symbol',
  'marker',
]);

export interface ParsedSvg {
  paths: string[];
  viewBox: string;
}

export async function parseSvgFile(file: File): Promise<ParsedSvg> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) throw new Error('Invalid SVG file');
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') {
    throw new Error('Root element is not <svg>');
  }
  return normalizeSvgElement(root as unknown as SVGSVGElement);
}

export function normalizeSvgElement(svg: SVGSVGElement): ParsedSvg {
  const viewBox = resolveViewBox(svg);
  const paths: string[] = [];
  for (const child of Array.from(svg.children)) {
    walk(child, IDENTITY, paths);
  }
  return { paths, viewBox };
}

function resolveViewBox(svg: SVGSVGElement): string {
  const vb = svg.getAttribute('viewBox');
  if (vb && /\S/.test(vb)) return vb.trim().replace(/[,\s]+/g, ' ');
  const w = parseFloat(svg.getAttribute('width') ?? '');
  const h = parseFloat(svg.getAttribute('height') ?? '');
  if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
    return `0 0 ${w} ${h}`;
  }
  return FALLBACK_VIEWBOX;
}

// --- matrix helpers --------------------------------------------------------

interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function isIdentity(m: Matrix): boolean {
  return m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;
}

function multiply(m1: Matrix, m2: Matrix): Matrix {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

function transformPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

function parseTransform(transform: string): Matrix {
  let result: Matrix = IDENTITY;
  const re = /(\w+)\s*\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(transform)) !== null) {
    const name = match[1];
    const args = match[2]
      .split(/[\s,]+/)
      .map((s) => parseFloat(s))
      .filter((n) => Number.isFinite(n));
    let m: Matrix = IDENTITY;
    switch (name) {
      case 'translate': {
        const [tx, ty = 0] = args;
        m = { a: 1, b: 0, c: 0, d: 1, e: tx ?? 0, f: ty };
        break;
      }
      case 'scale': {
        const [sx, sy = sx] = args;
        m = { a: sx ?? 1, b: 0, c: 0, d: sy ?? 1, e: 0, f: 0 };
        break;
      }
      case 'rotate': {
        const [angle = 0, cx = 0, cy = 0] = args;
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const r: Matrix = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
        if (cx !== 0 || cy !== 0) {
          const t1: Matrix = { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy };
          const t2: Matrix = { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy };
          m = multiply(multiply(t1, r), t2);
        } else {
          m = r;
        }
        break;
      }
      case 'skewX': {
        const t = Math.tan(((args[0] ?? 0) * Math.PI) / 180);
        m = { a: 1, b: 0, c: t, d: 1, e: 0, f: 0 };
        break;
      }
      case 'skewY': {
        const t = Math.tan(((args[0] ?? 0) * Math.PI) / 180);
        m = { a: 1, b: t, c: 0, d: 1, e: 0, f: 0 };
        break;
      }
      case 'matrix': {
        const [a, b, c, d, e, f] = args;
        m = { a: a ?? 1, b: b ?? 0, c: c ?? 0, d: d ?? 1, e: e ?? 0, f: f ?? 0 };
        break;
      }
      default:
        m = IDENTITY;
    }
    result = multiply(result, m);
  }
  return result;
}

// --- DOM walk --------------------------------------------------------------

function walk(el: Element, parentMatrix: Matrix, paths: string[]): void {
  const tag = el.tagName.toLowerCase();
  if (DROP_TAGS.has(tag)) return;

  const own = parseTransform(el.getAttribute('transform') ?? '');
  const matrix = isIdentity(own) ? parentMatrix : multiply(parentMatrix, own);

  switch (tag) {
    case 'svg':
    case 'g':
    case 'a': {
      for (const child of Array.from(el.children)) walk(child, matrix, paths);
      return;
    }
    case 'path': {
      const d = el.getAttribute('d');
      if (d && d.trim()) paths.push(transformPath(d, matrix));
      return;
    }
    case 'rect': {
      const d = rectToPath(el);
      if (d) paths.push(transformPath(d, matrix));
      return;
    }
    case 'circle': {
      const d = circleToPath(el);
      if (d) paths.push(transformPath(d, matrix));
      return;
    }
    case 'ellipse': {
      const d = ellipseToPath(el);
      if (d) paths.push(transformPath(d, matrix));
      return;
    }
    case 'line': {
      const d = lineToPath(el);
      if (d) paths.push(transformPath(d, matrix));
      return;
    }
    case 'polyline':
    case 'polygon': {
      const d = polyToPath(el, tag === 'polygon');
      if (d) paths.push(transformPath(d, matrix));
      return;
    }
    default:
      return;
  }
}

// --- primitive → path ------------------------------------------------------

function num(el: Element, name: string, fallback = 0): number {
  const v = parseFloat(el.getAttribute(name) ?? '');
  return Number.isFinite(v) ? v : fallback;
}

function rectToPath(el: Element): string {
  const x = num(el, 'x');
  const y = num(el, 'y');
  const w = num(el, 'width');
  const h = num(el, 'height');
  if (!(w > 0 && h > 0)) return '';
  const rxRaw = parseFloat(el.getAttribute('rx') ?? 'NaN');
  const ryRaw = parseFloat(el.getAttribute('ry') ?? 'NaN');
  const rx = Number.isFinite(rxRaw) ? rxRaw : Number.isFinite(ryRaw) ? ryRaw : 0;
  const ry = Number.isFinite(ryRaw) ? ryRaw : Number.isFinite(rxRaw) ? rxRaw : 0;
  if (rx > 0 && ry > 0) {
    const a = Math.min(rx, w / 2);
    const b = Math.min(ry, h / 2);
    return `M${x + a} ${y} H${x + w - a} A${a} ${b} 0 0 1 ${x + w} ${y + b} V${y + h - b} A${a} ${b} 0 0 1 ${x + w - a} ${y + h} H${x + a} A${a} ${b} 0 0 1 ${x} ${y + h - b} V${y + b} A${a} ${b} 0 0 1 ${x + a} ${y} Z`;
  }
  return `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
}

function circleToPath(el: Element): string {
  const cx = num(el, 'cx');
  const cy = num(el, 'cy');
  const r = num(el, 'r');
  if (!(r > 0)) return '';
  return `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

function ellipseToPath(el: Element): string {
  const cx = num(el, 'cx');
  const cy = num(el, 'cy');
  const rx = num(el, 'rx');
  const ry = num(el, 'ry');
  if (!(rx > 0 && ry > 0)) return '';
  return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

function lineToPath(el: Element): string {
  return `M${num(el, 'x1')} ${num(el, 'y1')} L${num(el, 'x2')} ${num(el, 'y2')}`;
}

function polyToPath(el: Element, close: boolean): string {
  const raw = (el.getAttribute('points') ?? '').trim();
  if (!raw) return '';
  const nums = raw
    .split(/[\s,]+/)
    .map((s) => parseFloat(s))
    .filter((n) => Number.isFinite(n));
  if (nums.length < 4) return '';
  let d = `M${nums[0]} ${nums[1]}`;
  for (let i = 2; i + 1 < nums.length; i += 2) d += ` L${nums[i]} ${nums[i + 1]}`;
  if (close) d += ' Z';
  return d;
}

// --- path data tokenizer + transformer ------------------------------------

const PATH_TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)/g;

function tokenizePath(d: string): Array<string | number> {
  const out: Array<string | number> = [];
  PATH_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PATH_TOKEN.exec(d)) !== null) {
    if (m[1] !== undefined) out.push(m[1]);
    else out.push(parseFloat(m[2]));
  }
  return out;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  // Round to 3 decimals, drop trailing zeros.
  return `${+n.toFixed(3)}`;
}

function transformPath(d: string, m: Matrix): string {
  if (isIdentity(m)) return d.trim();
  const tokens = tokenizePath(d);
  const out: string[] = [];
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let lastCmd: string | null = null;
  let i = 0;

  while (i < tokens.length) {
    let cmd: string;
    if (typeof tokens[i] === 'string') {
      cmd = tokens[i] as string;
      i++;
      lastCmd = cmd;
    } else {
      if (!lastCmd) return d;
      // Implicit repeat: M/m repeats become L/l.
      cmd = lastCmd === 'M' ? 'L' : lastCmd === 'm' ? 'l' : lastCmd;
    }

    const upper = cmd.toUpperCase();
    const isRel = cmd !== upper && cmd !== 'z';

    switch (upper) {
      case 'M': {
        let x = tokens[i++] as number;
        let y = tokens[i++] as number;
        if (isRel) {
          x += curX;
          y += curY;
        }
        const [tx, ty] = transformPoint(m, x, y);
        out.push(`M${fmt(tx)} ${fmt(ty)}`);
        curX = x;
        curY = y;
        startX = x;
        startY = y;
        break;
      }
      case 'L': {
        let x = tokens[i++] as number;
        let y = tokens[i++] as number;
        if (isRel) {
          x += curX;
          y += curY;
        }
        const [tx, ty] = transformPoint(m, x, y);
        out.push(`L${fmt(tx)} ${fmt(ty)}`);
        curX = x;
        curY = y;
        break;
      }
      case 'H': {
        let x = tokens[i++] as number;
        if (isRel) x += curX;
        const [tx, ty] = transformPoint(m, x, curY);
        // After arbitrary matrix the segment is no longer axis-aligned: emit L.
        out.push(`L${fmt(tx)} ${fmt(ty)}`);
        curX = x;
        break;
      }
      case 'V': {
        let y = tokens[i++] as number;
        if (isRel) y += curY;
        const [tx, ty] = transformPoint(m, curX, y);
        out.push(`L${fmt(tx)} ${fmt(ty)}`);
        curY = y;
        break;
      }
      case 'C': {
        const x1r = tokens[i++] as number;
        const y1r = tokens[i++] as number;
        const x2r = tokens[i++] as number;
        const y2r = tokens[i++] as number;
        const xr = tokens[i++] as number;
        const yr = tokens[i++] as number;
        const x1 = isRel ? x1r + curX : x1r;
        const y1 = isRel ? y1r + curY : y1r;
        const x2 = isRel ? x2r + curX : x2r;
        const y2 = isRel ? y2r + curY : y2r;
        const x = isRel ? xr + curX : xr;
        const y = isRel ? yr + curY : yr;
        const p1 = transformPoint(m, x1, y1);
        const p2 = transformPoint(m, x2, y2);
        const p = transformPoint(m, x, y);
        out.push(`C${fmt(p1[0])} ${fmt(p1[1])} ${fmt(p2[0])} ${fmt(p2[1])} ${fmt(p[0])} ${fmt(p[1])}`);
        curX = x;
        curY = y;
        break;
      }
      case 'S': {
        const x2r = tokens[i++] as number;
        const y2r = tokens[i++] as number;
        const xr = tokens[i++] as number;
        const yr = tokens[i++] as number;
        const x2 = isRel ? x2r + curX : x2r;
        const y2 = isRel ? y2r + curY : y2r;
        const x = isRel ? xr + curX : xr;
        const y = isRel ? yr + curY : yr;
        const p2 = transformPoint(m, x2, y2);
        const p = transformPoint(m, x, y);
        out.push(`S${fmt(p2[0])} ${fmt(p2[1])} ${fmt(p[0])} ${fmt(p[1])}`);
        curX = x;
        curY = y;
        break;
      }
      case 'Q': {
        const x1r = tokens[i++] as number;
        const y1r = tokens[i++] as number;
        const xr = tokens[i++] as number;
        const yr = tokens[i++] as number;
        const x1 = isRel ? x1r + curX : x1r;
        const y1 = isRel ? y1r + curY : y1r;
        const x = isRel ? xr + curX : xr;
        const y = isRel ? yr + curY : yr;
        const p1 = transformPoint(m, x1, y1);
        const p = transformPoint(m, x, y);
        out.push(`Q${fmt(p1[0])} ${fmt(p1[1])} ${fmt(p[0])} ${fmt(p[1])}`);
        curX = x;
        curY = y;
        break;
      }
      case 'T': {
        let x = tokens[i++] as number;
        let y = tokens[i++] as number;
        if (isRel) {
          x += curX;
          y += curY;
        }
        const [tx, ty] = transformPoint(m, x, y);
        out.push(`T${fmt(tx)} ${fmt(ty)}`);
        curX = x;
        curY = y;
        break;
      }
      case 'A': {
        const rx = tokens[i++] as number;
        const ry = tokens[i++] as number;
        const xRot = tokens[i++] as number;
        const largeArc = tokens[i++] as number;
        const sweep = tokens[i++] as number;
        let x = tokens[i++] as number;
        let y = tokens[i++] as number;
        if (isRel) {
          x += curX;
          y += curY;
        }
        const [tx, ty] = transformPoint(m, x, y);
        const sx = Math.hypot(m.a, m.b);
        const sy = Math.hypot(m.c, m.d);
        const det = m.a * m.d - m.b * m.c;
        const newSweep = det < 0 ? (sweep ? 0 : 1) : sweep;
        out.push(`A${fmt(rx * sx)} ${fmt(ry * sy)} ${fmt(xRot)} ${largeArc} ${newSweep} ${fmt(tx)} ${fmt(ty)}`);
        curX = x;
        curY = y;
        break;
      }
      case 'Z': {
        out.push('Z');
        curX = startX;
        curY = startY;
        break;
      }
      default:
        // Unknown command — bail and return the original to avoid corrupting data.
        return d.trim();
    }
  }
  return out.join(' ');
}

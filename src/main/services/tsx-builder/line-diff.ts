// A unified line diff (Myers), for the hand edits a builder edit carries over
// (build-seed.ts, P3 part 3). A saved `vN.tsx` is the builder's bundle; when
// someone changes it by hand, the next edit gets the builder's own files plus
// this diff of the bundle, not the whole bundle (galton-bell's is 326 KB for
// 16 KB of source).
//
// esbuild marks each inlined module with a path comment relative to the folder
// it bundled from (`// ../../…/node_modules/d3-path/src/path.js`), so a bundle
// remade from another folder differs on those lines alone: they are compared
// from `node_modules/` on.

export interface LineDiff {
  /** Unified diff text, `--- a` / `+++ b` headers and @@ hunks. Empty when nothing differs. */
  text: string;
  /** Lines removed plus lines added. */
  changed: number;
}

type Op = { type: ' ' | '-' | '+'; line: string };

const MODULE_COMMENT = /^\/\/ (?:\.\.\/)+(?:.*?\/)?node_modules\//;

function normalise(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.replace(MODULE_COMMENT, '// node_modules/'));
}

/** The shortest edit script from `a` to `b`, or null when it needs more than `maxEdits` lines. */
function myers(a: string[], b: string[], maxEdits: number): Op[] | null {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  // trace[d] = v over k in [-d, d] as it stood before step d.
  const trace: Int32Array[] = [];
  let found = -1;
  for (let d = 0; d <= Math.min(max, maxEdits); d++) {
    trace.push(v.slice(offset - d, offset + d + 1));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
    if (found >= 0) break;
  }
  if (found < 0) return null;

  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const snap = trace[d];
    const at = (k: number) => snap[k + d];
    const k = x - y;
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ type: ' ', line: a[x - 1] });
      x--;
      y--;
    }
    if (x === prevX) ops.push({ type: '+', line: b[y - 1] });
    else ops.push({ type: '-', line: a[x - 1] });
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    ops.push({ type: ' ', line: a[x - 1] });
    x--;
    y--;
  }
  return ops.reverse();
}

function hunks(ops: Op[], context: number): string[] {
  const out: string[] = [];
  const changes = ops.map((op, i) => (op.type === ' ' ? -1 : i)).filter((i) => i >= 0);
  let i = 0;
  while (i < changes.length) {
    // Changes closer than two contexts apart share a hunk.
    let last = i;
    while (last + 1 < changes.length && changes[last + 1] - changes[last] <= 2 * context + 1) last++;
    const from = Math.max(0, changes[i] - context);
    const to = Math.min(ops.length - 1, changes[last] + context);
    let aStart = 1;
    let bStart = 1;
    for (let j = 0; j < from; j++) {
      if (ops[j].type !== '+') aStart++;
      if (ops[j].type !== '-') bStart++;
    }
    const body = ops.slice(from, to + 1);
    const aLen = body.filter((op) => op.type !== '+').length;
    const bLen = body.filter((op) => op.type !== '-').length;
    out.push(`@@ -${aLen === 0 ? aStart - 1 : aStart},${aLen} +${bLen === 0 ? bStart - 1 : bStart},${bLen} @@`);
    out.push(...body.map((op) => `${op.type}${op.line}`));
    i = last + 1;
  }
  return out;
}

/**
 * `a` → `b` as a unified diff, or null when more than `maxChanged` lines
 * differ (a rewrite, not an edit). Common head and tail lines are set aside
 * first, so a small change in a long file stays cheap.
 */
export function unifiedLineDiff(
  a: string,
  b: string,
  options: { aName: string; bName: string; context?: number; maxChanged?: number },
): LineDiff | null {
  const context = options.context ?? 3;
  const left = normalise(a);
  const right = normalise(b);
  let head = 0;
  while (head < left.length && head < right.length && left[head] === right[head]) head++;
  let tail = 0;
  while (
    tail < left.length - head &&
    tail < right.length - head &&
    left[left.length - 1 - tail] === right[right.length - 1 - tail]
  ) tail++;
  const middle = myers(left.slice(head, left.length - tail), right.slice(head, right.length - tail), options.maxChanged ?? Infinity);
  if (!middle) return null;
  const changed = middle.filter((op) => op.type !== ' ').length;
  if (changed === 0) return { text: '', changed: 0 };
  const ops: Op[] = [
    ...left.slice(0, head).map((line) => ({ type: ' ' as const, line })),
    ...middle,
    ...left.slice(left.length - tail).map((line) => ({ type: ' ' as const, line })),
  ];
  const text = [`--- ${options.aName}`, `+++ ${options.bName}`, ...hunks(ops, context)].join('\n');
  return { text: `${text}\n`, changed };
}

import { describe, expect, it } from 'vitest';
import { unifiedLineDiff } from './line-diff';

const names = { aName: 'v1.tsx (as the builder saved it)', bName: 'v2.tsx' };
const lines = (n: number, tag = 'line') => Array.from({ length: n }, (_, i) => `${tag} ${i + 1}`);

/** Apply a unified diff to `a` (a test oracle: the hunks must rebuild `b`). */
function apply(a: string, diff: string): string {
  const src = a.split('\n');
  const out: string[] = [];
  let at = 0;
  const rows = diff.split('\n').slice(2).filter((r) => r !== '');
  for (let i = 0; i < rows.length; i++) {
    const header = /^@@ -(\d+),(\d+) \+\d+,\d+ @@$/.exec(rows[i]);
    if (!header) continue;
    const start = Number(header[2]) === 0 ? Number(header[1]) : Number(header[1]) - 1;
    out.push(...src.slice(at, start));
    at = start;
    for (i++; i < rows.length && !rows[i].startsWith('@@'); i++) {
      const [type, line] = [rows[i][0], rows[i].slice(1)];
      if (type === ' ') {
        expect(src[at]).toBe(line);
        out.push(line);
        at++;
      } else if (type === '-') {
        expect(src[at]).toBe(line);
        at++;
      } else out.push(line);
    }
    i--;
  }
  return [...out, ...src.slice(at)].join('\n');
}

describe('unifiedLineDiff', () => {
  it('is empty when nothing differs', () => {
    expect(unifiedLineDiff('a\nb\n', 'a\nb\n', names)).toEqual({ text: '', changed: 0 });
  });

  it('shows one changed line in a long file with three lines of context', () => {
    const a = lines(5000).join('\n');
    const b = a.replace('line 2500', "line 2500 // title: 'Bounce!'");
    const diff = unifiedLineDiff(a, b, names)!;
    expect(diff.changed).toBe(2);
    expect(diff.text).toBe(
      [
        '--- v1.tsx (as the builder saved it)',
        '+++ v2.tsx',
        '@@ -2497,7 +2497,7 @@',
        ' line 2497',
        ' line 2498',
        ' line 2499',
        '-line 2500',
        "+line 2500 // title: 'Bounce!'",
        ' line 2501',
        ' line 2502',
        ' line 2503',
        '',
      ].join('\n'),
    );
    expect(apply(a, diff.text)).toBe(b);
  });

  it('keeps far-apart edits in separate hunks and rebuilds the target', () => {
    const a = lines(400);
    const b = [...a];
    b.splice(10, 1, 'changed 11');
    b.splice(300, 0, 'added after 300', 'and another');
    b.splice(390, 2);
    const diff = unifiedLineDiff(a.join('\n'), b.join('\n'), names)!;
    expect(diff.text.match(/^@@/gm)).toHaveLength(3);
    expect(diff.changed).toBe(2 + 2 + 2);
    expect(apply(a.join('\n'), diff.text)).toBe(b.join('\n'));
  });

  it('handles pure insertions and deletions at either end', () => {
    expect(apply('x\ny', unifiedLineDiff('x\ny', 'new\nx\ny', names)!.text)).toBe('new\nx\ny');
    expect(apply('x\ny', unifiedLineDiff('x\ny', 'x', names)!.text)).toBe('x');
    expect(apply('', unifiedLineDiff('', 'only', names)!.text)).toBe('only');
  });

  it('compares esbuild module comments from node_modules/ on, wherever the bundle was made from', () => {
    const a = '// ../../../../VidTSX-STUDIO/node_modules/d3-path/src/path.js\nconst x = 1;';
    const b = '// ../../../../../../../../../VidTSX-STUDIO/node_modules/d3-path/src/path.js\nconst x = 1;';
    expect(unifiedLineDiff(a, b, names)!.changed).toBe(0);
  });

  it('reads CRLF and LF alike', () => {
    expect(unifiedLineDiff('a\r\nb', 'a\nb', names)!.changed).toBe(0);
  });

  it('gives up past maxChanged (a rewrite, not an edit)', () => {
    const a = lines(200).join('\n');
    const b = lines(200, 'other').join('\n');
    expect(unifiedLineDiff(a, b, { ...names, maxChanged: 50 })).toBeNull();
    expect(unifiedLineDiff(a, a.replace('line 7', 'line seven'), { ...names, maxChanged: 50 })!.changed).toBe(2);
  });
});

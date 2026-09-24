import { describe, expect, it } from 'vitest';
import { FILTER_SOURCE_MAX_BYTES, lintFilterSource } from './filter-lint';

/** The shape esbuild emits for a bundled add-on filter. */
const BUNDLE = `// core/canvas.js
function base(f, filter2 = "none") {
  f.ctx.filter = filter2;
  f.ctx.drawImage(f.source, 0, 0);
  f.ctx.filter = "none";
}
var filter = { id: "noir", name: "Noir", tier: "common", faceTracking: false, animated: false, defaultIntensity: 1,
  render(f) { base(f, "grayscale(1)"); const c = document.createElement("canvas"); void c; } };
var stdin_default = filter;
export {
  stdin_default as default
};
`;

describe('lintFilterSource', () => {
  it('accepts a bundled filter, including its own canvas creation', () => {
    expect(lintFilterSource(BUNDLE)).toEqual({ ok: true, errors: [] });
    expect(lintFilterSource('export default { id: "x", render() {} };').ok).toBe(true);
  });

  it('refuses every import, react and remotion included', () => {
    for (const line of ["import React from 'react';", "import { x } from './core/canvas.js';", "const m = await import('x');", "const fs = require('fs');"]) {
      const result = lintFilterSource(`${line}\n${BUNDLE}`);
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toContain('no imports at all');
    }
  });

  it('requires a default export', () => {
    const result = lintFilterSource('export const filter = { render() {} };');
    expect(result.errors).toEqual(['The filter must have a default export (its FilterDefinition).']);
  });

  it('refuses the wall clock, randomness and the network', () => {
    for (const [snippet, what] of [
      ['const t = Date.now();', 'Date.now()'],
      ['const t = performance.now();', 'performance.now()'],
      ['const r = Math.random();', 'Math.random()'],
      ['fetch("https://x");', 'fetch()'],
      ['new XMLHttpRequest();', 'XMLHttpRequest'],
      ['new WebSocket("wss://x");', 'WebSocket'],
      ['localStorage.setItem("a", "b");', 'browser storage'],
      ['new Worker("w.js");', 'workers'],
      ['eval("1");', 'eval / new Function'],
    ]) {
      const result = lintFilterSource(`${BUNDLE}\n${snippet}`);
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toContain(what);
    }
  });

  it('caps the size', () => {
    const big = `${BUNDLE}\n// ${'x'.repeat(FILTER_SOURCE_MAX_BYTES)}`;
    expect(lintFilterSource(big).errors[0]).toMatch(/at most 512 KB/);
  });
});

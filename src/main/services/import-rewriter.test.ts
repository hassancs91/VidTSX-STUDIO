// The preview transpiler must rewrite IMPORT STATEMENTS only. Before the lexer
// (2026-09-12) a text regex also matched the word `from` followed by a quote
// inside strings and comments, which corrupted video-10's B3IntoCode shot (a
// VS Code-style syntax highlighter containing `prev === "from"`).

import { describe, it, expect } from 'vitest';
import { rewriteModuleSpecifiers, type SpecifierResolver } from './import-rewriter';
import { transpileTsxSource } from './tsx-transpiler';

const BASE = 'http://127.0.0.1:9247';

const resolve: SpecifierResolver = (spec) => {
  if (spec === 'react') return { specifier: `${BASE}/virtual/react.js` };
  if (spec === 'remotion') return { specifier: `${BASE}/virtual/remotion.js` };
  if (spec === 'tone') return { specifier: 'https://esm.sh/tone@1', namespaceDefaultImport: true };
  if (spec.startsWith('.') || spec.startsWith('/') || /^https?:/.test(spec)) return null;
  return { specifier: `https://esm.sh/${spec}` };
};

describe('rewriteModuleSpecifiers', () => {
  it('rewrites static imports, re-exports and literal dynamic imports', async () => {
    const src = [
      `import React from "react";`,
      `import { useCurrentFrame } from 'remotion';`,
      `export { fade } from '@remotion/transitions/fade';`,
      `const lazy = () => import("lucide-react");`,
      `import './local.css';`,
      `import x from 'https://esm.sh/already';`,
    ].join('\n');
    const out = await rewriteModuleSpecifiers(src, resolve);
    expect(out).toBe(
      [
        `import React from "${BASE}/virtual/react.js";`,
        `import { useCurrentFrame } from '${BASE}/virtual/remotion.js';`,
        `export { fade } from 'https://esm.sh/@remotion/transitions/fade';`,
        `const lazy = () => import("https://esm.sh/lucide-react");`,
        `import './local.css';`,
        `import x from 'https://esm.sh/already';`,
      ].join('\n'),
    );
  });

  it('leaves the text `from "…"` alone inside strings, comments and templates', async () => {
    const highlighter =
      `else if (prev === "import" || prev === "from" || /^[A-Z]/.test(t)) c = TOK.type;\n` +
      `out.push([t, c]);\nprev = t;\nif (!m[5]) prev = "";`;
    const src = [
      `import { AbsoluteFill } from 'remotion';`,
      `// copied from "old-kit" — do not import from 'there'`,
      `const caption = "greetings from 'home'";`,
      `const tpl = \`import { x } from "react"\`;`,
      highlighter,
    ].join('\n');
    const out = await rewriteModuleSpecifiers(src, resolve);
    expect(out).toBe(src.replace(`'remotion'`, `'${BASE}/virtual/remotion.js'`));
  });

  it('turns a default import of a namespace-only package into `import * as`', async () => {
    const out = await rewriteModuleSpecifiers(`import Tone from 'tone';\nTone.start();`, resolve);
    expect(out).toBe(`import * as Tone from 'https://esm.sh/tone@1';\nTone.start();`);
  });

  it('keeps named imports of a namespace-only package as they are', async () => {
    const out = await rewriteModuleSpecifiers(`import { Synth } from "tone";`, resolve);
    expect(out).toBe(`import { Synth } from "https://esm.sh/tone@1";`);
  });

  it('skips import.meta and non-literal dynamic imports', async () => {
    const src = `const u = import.meta.url;\nconst m = await import(name);`;
    expect(await rewriteModuleSpecifiers(src, resolve)).toBe(src);
  });
});

describe('transpileTsxSource (end to end)', () => {
  it('produces valid JS for a shot containing a `from"` string', async () => {
    const tsx = `
import React from 'react';
import { useCurrentFrame } from 'remotion';
const TOK = { type: '#4ec9b0', punct: '#ccc' };
export function hl(tokens: string[]) {
  let prev = '';
  return tokens.map((t) => {
    let c = TOK.punct;
    if (prev === "import" || prev === "from" || /^[A-Z]/.test(t)) c = TOK.type;
    prev = t;
    return [t, c] as const;
  });
}
export const compositionConfig = { id: 'X', durationInFrames: 30, fps: 30, width: 1920, height: 1080 };
const X: React.FC = () => <div>{useCurrentFrame()}{hl(['from', 'x']).length}</div>;
export default X;
`;
    const r = await transpileTsxSource(tsx, 'x.tsx', BASE);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.code).toContain(`prev === "from" || /^[A-Z]/.test(t)`);
    expect(r.code).toContain(`from "${BASE}/virtual/remotion.js"`);
    expect(r.code).toContain(`from "${BASE}/virtual/react-jsx-runtime.js"`);
    // Must parse as a module: this is what the renderer's dynamic import needs.
    const esbuild = await import('esbuild');
    await expect(esbuild.transform(r.code, { loader: 'js', format: 'esm' })).resolves.toBeTruthy();
  });
});

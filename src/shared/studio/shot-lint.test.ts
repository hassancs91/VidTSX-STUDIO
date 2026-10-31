import { describe, it, expect } from 'vitest';
import { collectImportSpecifiers, isShotModuleSpecifier, lintShotSource } from './shot-lint';

const VALID_SHOT = `import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

export const compositionConfig = {
  id: 'shot',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 150
};

export default function Shot() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <AbsoluteFill style={{ background: '#111' }}>{frame / fps}</AbsoluteFill>;
}
`;

describe('collectImportSpecifiers', () => {
  it('finds static, bare, re-export, dynamic, and require specifiers', () => {
    const code = [
      `import React from 'react';`,
      `import 'side-effect';`,
      `import { Img } from "remotion";`,
      `export { thing } from './local';`,
      `const x = await import('lodash');`,
      `const y = require('fs');`,
    ].join('\n');
    expect(collectImportSpecifiers(code)).toEqual([
      'react',
      'side-effect',
      'remotion',
      './local',
      'lodash',
      'fs',
    ]);
  });

  it('does not fire on the word import inside strings/JSX text', () => {
    const code = `import React from 'react';\nconst label = "we import nothing here";`;
    expect(collectImportSpecifiers(code)).toEqual(['react']);
  });

  it('skips a require() or import() written inside a string or a comment (a library message), keeps a real one', () => {
    const code = [
      `console.error('DEPRECATED! migrate to: opentype.parse(require("fs").readFileSync(url), opt)');`,
      'const hint = `use import("x") instead`;',
      `// require('path') was here`,
      `const msg = "a \\" quote"; const real = require('zlib');`,
    ].join('\n');
    expect(collectImportSpecifiers(code)).toEqual(['zlib']);
  });
});

describe('lintShotSource (acceptance-gate table)', () => {
  it('accepts a react+remotion single-file shot with config and default export', () => {
    expect(lintShotSource(VALID_SHOT)).toEqual({ ok: true, errors: [] });
  });

  it('accepts the @vidtsx/kit import (SHOT_QUALITY_DESIGN Q4 — the one widened entry)', () => {
    const shot = `import { BrowserWindow, EASINGS } from '@vidtsx/kit';\n${VALID_SHOT}`;
    expect(lintShotSource(shot)).toEqual({ ok: true, errors: [] });
  });

  it("accepts remotion's own subpaths (END_TO_END_PLAN T7: a bundled shot keeps them external)", () => {
    const shot = [
      "import { NoReactInternals } from 'remotion/no-react';",
      "import { VERSION } from 'remotion/version';",
      VALID_SHOT,
    ].join('\n');
    expect(lintShotSource(shot)).toEqual({ ok: true, errors: [] });
    expect(isShotModuleSpecifier('remotion/no-react')).toBe(true);
    expect(isShotModuleSpecifier('remotion/version')).toBe(true);
  });

  it('still rejects a remotion subpath that is not one of its entry points, and every other package', () => {
    for (const spec of ['remotion/foo', 'remotion/dist/esm/no-react.mjs', '@remotion/google-fonts/Inter', 'react-dom']) {
      expect(isShotModuleSpecifier(spec)).toBe(false);
      const result = lintShotSource(`import x from '${spec}';\n${VALID_SHOT}`);
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toMatch(/only import from 'react', 'remotion', and '@vidtsx\/kit'/);
    }
  });

  it.each([
    ['third-party package', `import _ from 'lodash';`, /only import from 'react', 'remotion', and '@vidtsx\/kit'/],
    ['react subpath', `import { jsx } from 'react/jsx-runtime';`, /only import from/],
    ['remotion subpath', `import { Player } from '@remotion/player';`, /only import from/],
    ['kit subpath', `import { EASINGS } from '@vidtsx/kit/easings';`, /only import from/],
    ['other @vidtsx package', `import x from '@vidtsx/other';`, /only import from/],
    ['relative import', `import { helper } from './helper';`, /single-file/],
    ['parent-relative import', `import x from '../shared';`, /single-file/],
    ['dynamic import', `const m = import('three');`, /only import from/],
    ['require call', `const fs = require('fs');`, /only import from/],
  ])('rejects a %s', (_label, line, pattern) => {
    const result = lintShotSource(`${line}\n${VALID_SHOT}`);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(pattern);
  });

  it('rejects a missing default export', () => {
    const result = lintShotSource(VALID_SHOT.replace('export default function Shot', 'export function Shot'));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/default export/);
  });

  it('rejects a missing compositionConfig export', () => {
    const result = lintShotSource(VALID_SHOT.replace('export const compositionConfig', 'const compositionConfig'));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/compositionConfig/);
  });

  it('collects multiple violations at once (one fix-loop round, all reasons)', () => {
    const result = lintShotSource(`import x from 'three';\nimport y from './y';\nconst nothing = 1;`);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

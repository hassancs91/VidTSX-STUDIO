import { describe, it, expect } from 'vitest';
import { collectImportSpecifiers, lintShotSource } from './shot-lint';

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
});

describe('lintShotSource (acceptance-gate table)', () => {
  it('accepts a react+remotion single-file shot with config and default export', () => {
    expect(lintShotSource(VALID_SHOT)).toEqual({ ok: true, errors: [] });
  });

  it.each([
    ['third-party package', `import _ from 'lodash';`, /only import from 'react' and 'remotion'/],
    ['react subpath', `import { jsx } from 'react/jsx-runtime';`, /only import from/],
    ['remotion subpath', `import { Player } from '@remotion/player';`, /only import from/],
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

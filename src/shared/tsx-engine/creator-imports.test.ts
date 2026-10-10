import { describe, expect, it } from 'vitest';
import { CREATOR_IMPORT_PACKAGES, isCreatorImport, lintCreatorImports } from './creator-imports';
import { buildGenerate2dPrompt } from './prompts/generate-2d-prompt';
import { buildGenerate3dPrompt } from './prompts/generate-3d-prompt';

describe('lintCreatorImports', () => {
  it('accepts the promised packages, subpaths included', () => {
    const code = [
      "import React from 'react';",
      "import { AbsoluteFill } from 'remotion';",
      "import chroma from 'chroma-js';",
      "import { slide } from '@remotion/transitions/slide';",
      "import { loadFont } from '@remotion/google-fonts/Inter';",
    ].join('\n');
    expect(lintCreatorImports(code)).toEqual([]);
  });

  it('rejects packages that are not installed for rendering, once each', () => {
    const errors = lintCreatorImports("import _ from 'lodash';\nimport { motion } from 'framer-motion';\nimport x from 'lodash';");
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('"lodash"');
  });

  it('rejects relative imports and the kit (no alias on the Creator render path)', () => {
    expect(lintCreatorImports("import a from './a';")[0]).toContain('single file');
    expect(lintCreatorImports("import { x } from '@vidtsx/kit';")).toHaveLength(1);
  });

  it('does not treat a prefix as a match', () => {
    expect(isCreatorImport('reactive-lib')).toBe(false);
    expect(isCreatorImport('react-dom')).toBe(false);
  });
});

describe('prompts stay in step with the Creator import list', () => {
  const NON_PROMISED = new Set(['react', 'remotion']);

  it('the open 2D + 3D prompts name every listed package', () => {
    const text = buildGenerate2dPrompt() + buildGenerate3dPrompt();
    for (const pkg of CREATOR_IMPORT_PACKAGES) {
      if (NON_PROMISED.has(pkg)) continue;
      expect(text, pkg).toContain(pkg);
    }
  });

  it('the strict 2D prompt promises no package beyond react, remotion and the kit', () => {
    const text = buildGenerate2dPrompt({ imports: 'strict' });
    expect(text).toContain('@vidtsx/kit');
    expect(text).not.toMatch(/import chroma from/);
    expect(text).not.toMatch(/from '@remotion\//);
    expect(text).not.toMatch(/from 'tone'/);
    expect(text).not.toContain('Tone.js audio synthesis');
  });
});

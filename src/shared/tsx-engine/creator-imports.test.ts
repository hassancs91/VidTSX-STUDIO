import { describe, expect, it } from 'vitest';
import { isCreatorImport, lintCreatorImports } from './creator-imports';

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

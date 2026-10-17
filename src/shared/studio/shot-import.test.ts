import { describe, expect, it } from 'vitest';
import { classifyShotImport, deriveImportName, describeImportFailure } from './shot-import';

const CLEAN = `import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
export const compositionConfig = { durationInFrames: 150, fps: 30, width: 1920, height: 1080 };
export default function Shot() {
  const frame = useCurrentFrame();
  return React.createElement('div', { style: { opacity: interpolate(frame, [0, 30], [0, 1]) } });
}
`;

function withImports(...specs: string[]): string {
  return `${specs.map((s, i) => `import X${i} from '${s}';`).join('\n')}\n${CLEAN}`;
}

// P3 part 8 (D10): what reaches the classification is what the bundler could not fix.
describe('classifyShotImport', () => {
  it('lists the packages and offers Convert for a single file that compiles (tone, gsap, three alike)', () => {
    const result = classifyShotImport(withImports('tone', 'gsap', 'three', '@remotion/google-fonts/Inter'));
    expect(result).toEqual({
      packages: ['tone', 'gsap', 'three', '@remotion/google-fonts/Inter'],
      localFiles: [],
      otherErrors: [],
      syntaxError: false,
      canConform: true,
    });
  });

  it('de-duplicates repeated specifiers and sees dynamic imports and requires', () => {
    const result = classifyShotImport(
      `import { Circle } from '@remotion/shapes';\nimport { Rect } from '@remotion/shapes';\n${CLEAN}\nconst c = await import('chroma-js');\nconst t = require('three');\n`,
    );
    expect(result.packages).toEqual(['@remotion/shapes', 'chroma-js', 'three']);
  });

  it('keeps a source that imports local files manual: Convert edits one file', () => {
    const result = classifyShotImport(withImports('./helpers', 'gsap', 'C:/abs/thing'));
    expect(result.localFiles).toEqual(['./helpers', 'C:/abs/thing']);
    expect(result.packages).toEqual(['gsap']);
    expect(result.canConform).toBe(false);
  });

  it('offers Convert for a missing compositionConfig or default export (the builder writes them)', () => {
    const noConfig = `import gsap from 'gsap';\nimport React from 'react';\nexport default function Shot() { return React.createElement('div'); }\n`;
    const result = classifyShotImport(noConfig);
    expect(result.otherErrors).toHaveLength(1);
    expect(result.otherErrors[0]).toContain('compositionConfig');
    expect(result.canConform).toBe(true);
  });

  it('never offers Convert for a syntax error', () => {
    const result = classifyShotImport(withImports('gsap'), { syntaxError: true });
    expect(result).toMatchObject({ syntaxError: true, otherErrors: [], canConform: false });
  });
});

describe('describeImportFailure', () => {
  it('names the bundler reason and offers Convert, saying it is a paid builder run', () => {
    const classification = classifyShotImport(withImports('tone'));
    const message = describeImportFailure(classification, 'gate error', 'Package "tone" is not available to shots (allowed: …).');
    expect(message).toContain('Package "tone" is not available to shots');
    expect(message).toContain('Convert for Studio');
    expect(message).toContain('paid');
  });

  it('explains local files instead of offering Convert', () => {
    const classification = classifyShotImport(withImports('./helpers', 'gsap'));
    const message = describeImportFailure(classification, 'gate error', 'Package "gsap" is refused');
    expect(message).toContain('./helpers');
    expect(message).not.toContain('Convert for Studio" has');
  });

  it('a syntax error shows the compiler error as is', () => {
    const classification = classifyShotImport(CLEAN, { syntaxError: true });
    expect(describeImportFailure(classification, 'Unexpected token', 'esbuild: Unexpected token')).toBe('Unexpected token');
  });
});

describe('deriveImportName', () => {
  it('borrows the folder name for a Creator version file', () => {
    expect(deriveImportName('C:/users/x/projects/spinning-logo/v3.tsx')).toBe('spinning-logo');
    expect(deriveImportName('C:\\users\\x\\projects\\spinning-logo\\v12.tsx')).toBe('spinning-logo');
  });

  it('uses the file name for any other source', () => {
    expect(deriveImportName('C:/downloads/my-intro.tsx')).toBe('my-intro');
    expect(deriveImportName('/home/x/packs/neon/lower-third.tsx')).toBe('lower-third');
  });

  it('falls back rather than producing an empty name', () => {
    expect(deriveImportName('v2.tsx')).toBe('v2');
    expect(deriveImportName('')).toBe('imported-shot');
  });
});

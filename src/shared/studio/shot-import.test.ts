import { describe, expect, it } from 'vitest';
import {
  buildConformInstruction,
  classifyShotImport,
  deriveImportName,
  describeImportFailure,
  isConformableModule,
} from './shot-import';

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

describe('isConformableModule', () => {
  it('accepts the Creator 2d allowlist, including subpaths', () => {
    expect(isConformableModule('chroma-js')).toBe(true);
    expect(isConformableModule('@remotion/shapes')).toBe(true);
    expect(isConformableModule('@remotion/google-fonts/Inter')).toBe(true);
    expect(isConformableModule('@remotion/transitions/slide')).toBe(true);
    expect(isConformableModule('tone')).toBe(true);
  });

  it('rejects anything else — a conform pass can only inline what it knows', () => {
    expect(isConformableModule('three')).toBe(false);
    expect(isConformableModule('@react-three/fiber')).toBe(false);
    expect(isConformableModule('chroma-js-extra')).toBe(false);
    expect(isConformableModule('./helpers')).toBe(false);
  });
});

describe('classifyShotImport', () => {
  it('reports nothing wrong for a file the gate accepts', () => {
    const result = classifyShotImport(CLEAN);
    expect(result).toEqual({
      conformable: [],
      blocking: [],
      otherErrors: [],
      canConform: false,
    });
  });

  it('flags the allowlist gap as conformable', () => {
    const result = classifyShotImport(
      withImports('@remotion/shapes', 'chroma-js', '@remotion/google-fonts/Inter'),
    );
    expect(result.conformable).toEqual([
      '@remotion/shapes',
      'chroma-js',
      '@remotion/google-fonts/Inter',
    ]);
    expect(result.blocking).toEqual([]);
    expect(result.canConform).toBe(true);
  });

  it('de-duplicates repeated specifiers', () => {
    const result = classifyShotImport(
      `import { Circle } from '@remotion/shapes';\nimport { Rect } from '@remotion/shapes';\n${CLEAN}`,
    );
    expect(result.conformable).toEqual(['@remotion/shapes']);
  });

  it('treats relative/absolute imports and unknown packages as blocking', () => {
    const result = classifyShotImport(withImports('./helpers', 'three', 'C:/abs/thing'));
    expect(result.blocking).toEqual(['./helpers', 'three', 'C:/abs/thing']);
    expect(result.canConform).toBe(false);
  });

  it('refuses to conform when a blocking import rides along with a conformable one', () => {
    const result = classifyShotImport(withImports('@remotion/shapes', 'three'));
    expect(result.conformable).toEqual(['@remotion/shapes']);
    expect(result.blocking).toEqual(['three']);
    expect(result.canConform).toBe(false);
  });

  it('surfaces non-import gate complaints and blocks conversion on them', () => {
    const noConfig = `import { Circle } from '@remotion/shapes';
import React from 'react';
export default function Shot() { return React.createElement('div'); }
`;
    const result = classifyShotImport(noConfig);
    expect(result.conformable).toEqual(['@remotion/shapes']);
    expect(result.otherErrors).toHaveLength(1);
    expect(result.otherErrors[0]).toContain('compositionConfig');
    expect(result.canConform).toBe(false);
  });

  it('sees dynamic imports and requires too', () => {
    const dynamic = `${CLEAN}\nconst c = await import('chroma-js');\nconst t = require('three');\n`;
    const result = classifyShotImport(dynamic);
    expect(result.conformable).toEqual(['chroma-js']);
    expect(result.blocking).toEqual(['three']);
  });
});

describe('describeImportFailure', () => {
  it('offers conversion when that is the whole problem', () => {
    const classification = classifyShotImport(withImports('@remotion/shapes'));
    const message = describeImportFailure(classification, 'gate error');
    expect(message).toContain('@remotion/shapes');
    expect(message).toContain('Convert for Studio');
  });

  it('explains a blocking import instead of offering conversion', () => {
    const classification = classifyShotImport(withImports('three'));
    const message = describeImportFailure(classification, 'gate error');
    expect(message).toContain('three');
    expect(message).not.toContain('Convert for Studio');
  });

  it('falls back to the gate error when nothing is classifiable', () => {
    const classification = classifyShotImport(CLEAN);
    expect(describeImportFailure(classification, 'Unexpected token')).toBe('Unexpected token');
  });
});

describe('buildConformInstruction', () => {
  it('names the modules to remove and keeps the shot contract explicit', () => {
    const instruction = buildConformInstruction(['@remotion/shapes', 'chroma-js']);
    expect(instruction).toContain('@remotion/shapes, chroma-js');
    expect(instruction).toContain("'react' and 'remotion'");
    expect(instruction).toContain('compositionConfig');
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

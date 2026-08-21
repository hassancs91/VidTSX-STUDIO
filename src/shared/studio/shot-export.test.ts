import { describe, it, expect } from 'vitest';
import type { StudioShot } from '../types/studio';
import { referencedShotIds } from './shots';
import { buildShotEntryParts, kitEntryDirName, rewriteKitImport, shotEntryRef } from './shot-export';

function shot(overrides: Partial<StudioShot> = {}): StudioShot {
  return {
    id: 'shot-a1b2',
    name: 'Stat card',
    kind: 'cutaway',
    createdAt: '',
    activeVersion: 2,
    status: 'ready',
    ...overrides,
  };
}

describe('referencedShotIds', () => {
  it('collects tsx clip shot ids, deduped, in first-use order', () => {
    const serialized = {
      tracks: [
        { clips: [{ tsx: { shotId: 'shot-b' } }, {}] },
        { clips: [{ tsx: { shotId: 'shot-a' } }, { tsx: { shotId: 'shot-b' } }] },
      ],
    };
    expect(referencedShotIds(serialized)).toEqual(['shot-b', 'shot-a']);
  });

  it('returns [] for a timeline without tsx clips', () => {
    expect(referencedShotIds({ tracks: [{ clips: [{}, {}] }] })).toEqual([]);
  });
});

describe('shotEntryRef / buildShotEntryParts (export entry emission, D6)', () => {
  it('emits static imports + components map for exactly the given shots', () => {
    const refs = [
      shotEntryRef(shot(), 'proj-1'),
      shotEntryRef(shot({ id: 'shot-c', activeVersion: 1 }), 'proj-1'),
    ];
    const { imports, componentsLiteral } = buildShotEntryParts(refs);
    expect(imports).toBe(
      [
        `import Shot_shot_a1b2 from './studio-entry-proj-1-shot-shot-a1b2-v2.tsx';`,
        `import Shot_shot_c from './studio-entry-proj-1-shot-shot-c-v1.tsx';`,
      ].join('\n'),
    );
    expect(componentsLiteral).toBe('{\n  "shot-a1b2": Shot_shot_a1b2,\n  "shot-c": Shot_shot_c\n}');
  });

  it('kebab ids become valid identifiers; the file name pins the ACTIVE version', () => {
    const ref = shotEntryRef(shot({ id: 'a-b-c', activeVersion: 7 }), 'p');
    expect(ref.identifier).toBe('Shot_a_b_c');
    expect(ref.fileName).toBe('studio-entry-p-shot-a-b-c-v7.tsx');
    // The sweeper filter (studio-entry-*.tsx) must keep matching the copies.
    expect(ref.fileName.startsWith('studio-entry-')).toBe(true);
  });

  it('emits nothing for zero shots (entry stays byte-identical to pre-S4)', () => {
    expect(buildShotEntryParts([])).toEqual({ imports: '', componentsLiteral: '' });
  });
});

describe('kit export pinning (Q4)', () => {
  it('kit dir name carries the sweeper prefix and the pinned version', () => {
    expect(kitEntryDirName('proj-1', '1.0.0')).toBe('studio-entry-proj-1-kit-1.0.0');
  });

  it('rewrites every @vidtsx/kit import to the pinned copy, any quote style', () => {
    const source = [
      `import { BrowserWindow } from '@vidtsx/kit';`,
      `import { EASINGS } from "@vidtsx/kit";`,
      `const label = "@vidtsx/kit stays untouched in strings";`,
    ].join('\n');
    const out = rewriteKitImport(source, 'studio-entry-p-kit-1.0.0');
    expect(out).toContain(`from './studio-entry-p-kit-1.0.0/index.tsx';`);
    expect(out).not.toMatch(/from\s*['"]@vidtsx\/kit['"]/);
    expect(out).toContain('stays untouched in strings');
  });
});

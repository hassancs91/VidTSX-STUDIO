import { describe, it, expect } from 'vitest';
import {
  TRANSITION_PACKAGE_LIMITS,
  parsePackPackageManifest,
  parseSingleTransitionManifest,
  transitionPackageFormat,
  versionAction,
} from './transition-package';

const HASH = 'a'.repeat(64);
const file = (path: string, size = 10) => ({ path, size, sha256: HASH });
const entry = (id: string) => ({ id, name: id, durationSeconds: 0.7, sceneCopies: 'single', version: '1.0.0' });

function pack(extra: Record<string, unknown> = {}) {
  return {
    formatVersion: 1,
    id: 'demo',
    name: 'Demo',
    version: '1.2.0',
    transitions: [entry('wipe'), entry('slide')],
    files: [file('transitions/wipe.tsx'), file('transitions/slide.tsx')],
    ...extra,
  };
}

describe('transitionPackageFormat', () => {
  it('tells the two extensions apart, case-insensitively', () => {
    expect(transitionPackageFormat('C:/x/Pack.VIDTSXPACK')).toBe('pack');
    expect(transitionPackageFormat('one.vidtsxtransition')).toBe('single');
    expect(transitionPackageFormat('project.vidtsx')).toBeNull();
  });
});

describe('parsePackPackageManifest', () => {
  it('reads the id from the manifest and keeps both entries', () => {
    const parsed = parsePackPackageManifest(pack(), '1.1.0');
    expect(parsed.manifest).toMatchObject({ id: 'demo', name: 'Demo', version: '1.2.0' });
    expect(parsed.entries.map((e) => e.id)).toEqual(['wipe', 'slide']);
    expect(parsed.problems).toEqual([]);
  });

  it('skips a malformed entry and one with no component file, and says so', () => {
    const parsed = parsePackPackageManifest(
      pack({ transitions: [entry('wipe'), { id: 'Bad Id' }, entry('ghost')], files: [file('transitions/wipe.tsx')] }),
      '1.1.0',
    );
    expect(parsed.entries.map((e) => e.id)).toEqual(['wipe']);
    expect(parsed.problems).toHaveLength(2);
    expect(parsed.problems[1]).toMatch(/ghost.*no transitions\/ghost\.tsx/);
  });

  it('accepts thumbnails and a README, refuses an oversized component', () => {
    expect(() =>
      parsePackPackageManifest(pack({ files: [...pack().files, file('thumbnails/wipe.mp4'), file('README.md')] }), '1.1.0'),
    ).not.toThrow();
    const big = TRANSITION_PACKAGE_LIMITS.maxComponentBytes + 1;
    expect(() => parsePackPackageManifest(pack({ files: [file('transitions/wipe.tsx', big)] }), '1.1.0')).toThrow(/at most/);
  });

  it('refuses a bad id, an unknown format and a duplicated file', () => {
    expect(() => parsePackPackageManifest(pack({ id: 'Not Valid' }), '1.1.0')).toThrow(/not valid/);
    expect(() => parsePackPackageManifest(pack({ formatVersion: 2 }), '1.1.0')).toThrow(/format 2/);
    expect(() =>
      parsePackPackageManifest(pack({ files: [file('transitions/wipe.tsx'), file('transitions/wipe.tsx')] }), '1.1.0'),
    ).toThrow(/twice/);
  });
});

describe('parseSingleTransitionManifest', () => {
  it('reads the entry fields from the top level', () => {
    const parsed = parseSingleTransitionManifest(
      { formatVersion: 1, ...entry('swirl'), sceneCopies: 'multi', license: 'CC-BY', files: [file('swirl.tsx')] },
      '1.1.0',
    );
    expect(parsed.entry).toMatchObject({ id: 'swirl', sceneCopies: 'multi' });
    expect(parsed.license).toBe('CC-BY');
  });

  it('refuses a missing id and a component under the wrong name', () => {
    expect(() => parseSingleTransitionManifest({ formatVersion: 1, files: [] }, '1.1.0')).toThrow(/no valid id/);
    expect(() =>
      parseSingleTransitionManifest({ formatVersion: 1, ...entry('swirl'), files: [file('transitions/swirl.tsx')] }, '1.1.0'),
    ).toThrow(/no use for/);
  });
});

describe('versionAction', () => {
  it('orders versions numerically', () => {
    expect(versionAction('1.0.0', null)).toBe('new');
    expect(versionAction('1.10.0', '1.9.0')).toBe('update');
    expect(versionAction('1.0.0', '1.0.0')).toBe('same');
    expect(versionAction('1.0.0', '2.0.0')).toBe('downgrade');
  });
});

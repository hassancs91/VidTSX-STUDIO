import { describe, it, expect } from 'vitest';
import {
  FILTER_KIND,
  PACK_KINDS,
  PACK_PACKAGE_LIMITS,
  TRANSITION_KIND,
  packPackageExtensions,
  packPackageFormat,
  parsePackPackageManifest,
  parseSinglePackageManifest,
  versionAction,
} from './pack-package';

const HASH = 'a'.repeat(64);
const file = (path: string, size = 10) => ({ path, size, sha256: HASH });
const transition = (id: string) => ({ id, name: id, durationSeconds: 0.7, sceneCopies: 'single', version: '1.0.0' });
const filter = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, category: 'filter', version: '1.0.0', ...extra });

function pack(extra: Record<string, unknown> = {}) {
  return {
    formatVersion: 1,
    id: 'demo',
    name: 'Demo',
    version: '1.2.0',
    transitions: [transition('wipe'), transition('slide')],
    files: [file('transitions/wipe.tsx'), file('transitions/slide.tsx')],
    ...extra,
  };
}

describe('packPackageFormat', () => {
  it('tells the pack and each kind of single apart, case-insensitively', () => {
    expect(packPackageFormat('C:/x/Pack.VIDTSXPACK')).toEqual({ format: 'pack' });
    expect(packPackageFormat('one.vidtsxtransition')).toEqual({ format: 'single', spec: TRANSITION_KIND });
    expect(packPackageFormat('one.VidTSXFilter')).toEqual({ format: 'single', spec: FILTER_KIND });
    expect(packPackageFormat('project.vidtsx')).toBeNull();
  });

  it('offers the pack plus the singles a tab asks for', () => {
    expect(packPackageExtensions()).toEqual(['.vidtsxpack', '.vidtsxtransition', '.vidtsxfilter']);
    expect(packPackageExtensions(['filter'])).toEqual(['.vidtsxpack', '.vidtsxfilter']);
    expect(PACK_KINDS.map((k) => [k.manifestKey, k.subdir, k.extension])).toEqual([
      ['transitions', 'transitions', '.tsx'],
      ['filters', 'filters', '.js'],
    ]);
  });
});

describe('parsePackPackageManifest', () => {
  it('reads the id from the manifest and keeps both entries', () => {
    const parsed = parsePackPackageManifest(pack(), '1.1.0');
    expect(parsed.manifest).toMatchObject({ id: 'demo', name: 'Demo', version: '1.2.0' });
    expect(parsed.sections.map((s) => [s.spec.type, s.entries.map((e) => e.id)])).toEqual([['transition', ['wipe', 'slide']]]);
    expect(parsed.problems).toEqual([]);
  });

  it('reads transitions and filters from one pack, each under its own folder and extension', () => {
    const parsed = parsePackPackageManifest(
      pack({
        filters: [filter('noir'), filter('vhs', { category: 'effect', animated: true, heavy: true })],
        files: [...pack().files, file('filters/noir.js'), file('filters/vhs.js'), file('thumbnails/noir.png')],
      }),
      '1.1.0',
    );
    expect(parsed.sections.map((s) => [s.spec.type, s.entries.map((e) => e.id)])).toEqual([
      ['transition', ['wipe', 'slide']],
      ['filter', ['noir', 'vhs']],
    ]);
    expect(parsed.sections[1].entries[1]).toMatchObject({ category: 'effect', animated: true, heavy: true });
  });

  it('accepts a filters-only pack and refuses a pack that lists neither kind', () => {
    const parsed = parsePackPackageManifest(
      { formatVersion: 1, id: 'fx', version: '1.0.0', filters: [filter('noir')], files: [file('filters/noir.js')] },
      '1.1.0',
    );
    expect(parsed.sections.map((s) => s.spec.type)).toEqual(['filter']);
    expect(() => parsePackPackageManifest({ formatVersion: 1, id: 'x', version: '1.0.0', files: [] }, '1.1.0')).toThrow(
      /lists no transitions or filters/,
    );
  });

  it('skips a malformed entry and one with no item file, and says so — per kind', () => {
    const parsed = parsePackPackageManifest(
      pack({
        transitions: [transition('wipe'), { id: 'Bad Id' }, transition('ghost')],
        filters: [filter('noir'), filter('phantom')],
        files: [file('transitions/wipe.tsx'), file('filters/noir.js')],
      }),
      '1.1.0',
    );
    expect(parsed.sections.map((s) => [s.spec.type, s.entries.map((e) => e.id)])).toEqual([
      ['transition', ['wipe']],
      ['filter', ['noir']],
    ]);
    expect(parsed.problems).toHaveLength(3);
    expect(parsed.problems[0]).toMatch(/^Transition 2/);
    expect(parsed.problems[1]).toMatch(/ghost.*no transitions\/ghost\.tsx/);
    expect(parsed.problems[2]).toMatch(/phantom.*no filters\/phantom\.js/);
  });

  it('refuses a file under the wrong kind folder: a .js under transitions/, a .tsx under filters/', () => {
    expect(() => parsePackPackageManifest(pack({ files: [...pack().files, file('transitions/noir.js')] }), '1.1.0')).toThrow(/no use for/);
    expect(() => parsePackPackageManifest(pack({ files: [...pack().files, file('filters/wipe.tsx')] }), '1.1.0')).toThrow(/no use for/);
  });

  it('accepts thumbnails and a README, refuses an oversized item of either kind', () => {
    expect(() =>
      parsePackPackageManifest(pack({ files: [...pack().files, file('thumbnails/wipe.mp4'), file('README.md')] }), '1.1.0'),
    ).not.toThrow();
    expect(() =>
      parsePackPackageManifest(pack({ files: [file('transitions/wipe.tsx', TRANSITION_KIND.maxItemBytes + 1)] }), '1.1.0'),
    ).toThrow(/a transition may be at most/);
    expect(() =>
      parsePackPackageManifest(
        pack({ filters: [filter('noir')], files: [...pack().files, file('filters/noir.js', FILTER_KIND.maxItemBytes + 1)] }),
        '1.1.0',
      ),
    ).toThrow(/a filter may be at most/);
    expect(PACK_PACKAGE_LIMITS.maxItemBytes).toBe(Math.max(TRANSITION_KIND.maxItemBytes, FILTER_KIND.maxItemBytes));
  });

  it('refuses a bad id, the reserved id, an unknown format and a duplicated file', () => {
    expect(() => parsePackPackageManifest(pack({ id: 'Not Valid' }), '1.1.0')).toThrow(/not valid/);
    expect(() => parsePackPackageManifest(pack({ id: 'imported' }), '1.1.0')).toThrow(/reserved/);
    expect(() => parsePackPackageManifest(pack({ formatVersion: 2 }), '1.1.0')).toThrow(/format 2/);
    expect(() =>
      parsePackPackageManifest(pack({ files: [file('transitions/wipe.tsx'), file('transitions/wipe.tsx')] }), '1.1.0'),
    ).toThrow(/twice/);
  });
});

describe('parseSinglePackageManifest', () => {
  it('reads a transition entry from the top level', () => {
    const parsed = parseSinglePackageManifest(
      { formatVersion: 1, ...transition('swirl'), sceneCopies: 'multi', license: 'CC-BY', files: [file('swirl.tsx')] },
      '1.1.0',
      TRANSITION_KIND,
    );
    expect(parsed.spec).toBe(TRANSITION_KIND);
    expect(parsed.entry).toMatchObject({ id: 'swirl', sceneCopies: 'multi' });
    expect(parsed.license).toBe('CC-BY');
  });

  it('reads a filter entry from the top level, with its knobs', () => {
    const parsed = parseSinglePackageManifest(
      {
        formatVersion: 1,
        ...filter('glow', { category: 'effect', parameters: [{ key: 'radius', label: 'Radius', type: 'range', min: 0, max: 8, step: 1, default: 3 }] }),
        author: 'Someone',
        files: [file('glow.js')],
      },
      '1.1.0',
      FILTER_KIND,
    );
    expect(parsed.spec).toBe(FILTER_KIND);
    expect(parsed.entry).toMatchObject({ id: 'glow', category: 'effect', parameters: [{ key: 'radius', default: 3 }] });
    expect(parsed.author).toBe('Someone');
  });

  it('refuses a missing id and an item under the wrong name or extension', () => {
    expect(() => parseSinglePackageManifest({ formatVersion: 1, files: [] }, '1.1.0', TRANSITION_KIND)).toThrow(/no valid id/);
    expect(() => parseSinglePackageManifest({ formatVersion: 1, files: [] }, '1.1.0', FILTER_KIND)).toThrow(/no valid id/);
    expect(() =>
      parseSinglePackageManifest({ formatVersion: 1, ...transition('swirl'), files: [file('transitions/swirl.tsx')] }, '1.1.0', TRANSITION_KIND),
    ).toThrow(/no use for/);
    expect(() => parseSinglePackageManifest({ formatVersion: 1, ...filter('glow'), files: [file('glow.tsx')] }, '1.1.0', FILTER_KIND)).toThrow(
      /no use for/,
    );
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

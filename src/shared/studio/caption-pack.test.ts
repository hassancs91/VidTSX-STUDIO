import { describe, expect, it } from 'vitest';
import {
  aspectOf,
  isValidPackSlug,
  mergePacks,
  namespacedId,
  parsePackManifest,
  parseTemplateEntries,
  parseTemplateId,
} from './caption-pack';

describe('pack ids', () => {
  it('accepts folder-safe slugs only', () => {
    expect(isValidPackSlug('core')).toBe(true);
    expect(isValidPackSlug('hormozi-pack-2')).toBe(true);
    expect(isValidPackSlug('..')).toBe(false);
    expect(isValidPackSlug('Core')).toBe(false);
    expect(isValidPackSlug('a/b')).toBe(false);
  });

  it('round-trips a namespaced item id', () => {
    expect(namespacedId('core', 'word-pop')).toBe('core/word-pop');
    expect(parseTemplateId('core/word-pop')).toEqual({ packId: 'core', itemId: 'word-pop' });
  });

  it('refuses ids that could escape the pack folder', () => {
    expect(parseTemplateId('word-pop')).toBeNull();
    expect(parseTemplateId('core/../../secrets')).toBeNull();
    expect(parseTemplateId('../core/word-pop')).toBeNull();
    expect(parseTemplateId('core/word pop')).toBeNull();
  });
});

describe('parsePackManifest', () => {
  const valid = { id: 'ignored', name: 'Core Captions', version: '1.0.0', type: 'caption-style' };

  it('takes the FOLDER as the id, not the manifest field', () => {
    expect(parsePackManifest(valid, 'core')).toMatchObject({ id: 'core', name: 'Core Captions' });
  });

  it('skips packs of another type or with an unusable folder name', () => {
    expect(parsePackManifest({ ...valid, type: 'sfx' }, 'boom')).toBeNull();
    expect(parsePackManifest(valid, 'Bad Folder')).toBeNull();
    expect(parsePackManifest('{}', 'core')).toBeNull();
    expect(parsePackManifest(null, 'core')).toBeNull();
  });

  it('defaults a missing name/version rather than rejecting the pack', () => {
    expect(parsePackManifest({ type: 'caption-style' }, 'core')).toMatchObject({
      name: 'core',
      version: '0.0.0',
    });
  });
});

describe('parseTemplateEntries', () => {
  it('keeps valid entries, drops malformed ones, dedupes ids', () => {
    const entries = parseTemplateEntries({
      templates: [
        { id: 'word-pop', name: 'Word Pop', sampleWords: ['this', 'pops', 42] },
        { id: 'word-pop', name: 'Duplicate' },
        { id: 'Bad Id', name: 'nope' },
        { name: 'no id' },
        'nonsense',
        { id: 'karaoke' },
      ],
    });
    expect(entries).toEqual([
      { id: 'word-pop', name: 'Word Pop', sampleWords: ['this', 'pops'] },
      { id: 'karaoke', name: 'karaoke' },
    ]);
  });

  it('parses per-aspect defaults and ignores non-numeric values', () => {
    const [entry] = parseTemplateEntries({
      templates: [
        {
          id: 'karaoke',
          defaults: {
            portrait: { scale: 1.2, wordsPerGroup: 3, margin: 0.18 },
            landscape: { scale: 'big' },
            nonsense: { scale: 2 },
          },
        },
      ],
    });
    // Unknown aspects, non-numeric values and fields with no document home
    // (margin) are all dropped — a pack can't seed what the style can't hold.
    expect(entry.defaults).toEqual({ portrait: { scale: 1.2, wordsPerGroup: 3 } });
  });

  it('returns [] for a manifest with no templates array', () => {
    expect(parseTemplateEntries({})).toEqual([]);
    expect(parseTemplateEntries(null)).toEqual([]);
  });
});

describe('mergePacks', () => {
  it('first root wins on a duplicate pack id, and the loser is reported', () => {
    const { packs, skipped } = mergePacks([
      [{ packId: 'core', from: 'builtin' }],
      [
        { packId: 'core', from: 'installed' },
        { packId: 'neon', from: 'installed' },
      ],
    ]);
    expect(packs).toEqual([
      { packId: 'core', from: 'builtin' },
      { packId: 'neon', from: 'installed' },
    ]);
    expect(skipped).toEqual(['core']);
  });
});

describe('aspectOf', () => {
  it('classifies the frame', () => {
    expect(aspectOf(1080, 1920)).toBe('portrait');
    expect(aspectOf(1920, 1080)).toBe('landscape');
    expect(aspectOf(1080, 1080)).toBe('square');
  });
});

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { CORPUS_LIBRARY } from '../library/sound-match-corpus.fixture';
import { passageText, queryText, PREFIX_VERSION } from '../../../library-search-engine/prefixes';
import { itemText, semanticItemOf, textHash } from './item-text';

const entry = (over: Partial<LibraryIndexEntry>): LibraryIndexEntry => ({ relPath: 'x.mp3', origin: 'imported', addedAt: 'a', ...over });
const clip = (id: string): LibraryIndexEntry => {
  const e = CORPUS_LIBRARY.find((c) => c.relPath.endsWith(`/${id}.mp3`));
  if (!e) throw new Error(id);
  return e;
};

describe('itemText (S1 itemText, report §14)', () => {
  it('joins the spaced file name, the category, the tags and the description with ". "', () => {
    const e = clip('crash-tumble');
    expect(itemText(e)).toBe(
      `crash tumble. emphasis. crash, tumble, mess, clatter, collapse, fail, broken, emphasis. ${e.description}`,
    );
  });

  it("reads S1's rule on every corpus clip (id with hyphens as spaces + category + tags + description)", () => {
    for (const e of CORPUS_LIBRARY) {
      const id = (e.relPath.split('/').pop() ?? '').replace(/\.mp3$/, '');
      const s1 = [id.replace(/-/g, ' '), e.audio?.category ?? '', (e.tags ?? []).join(', '), e.description ?? ''].filter(Boolean).join('. ');
      expect(itemText(e)).toBe(s1);
    }
  });

  it('drops the extension and the folders, reads "_" as a space, and leaves out missing fields', () => {
    expect(itemText(entry({ relPath: 'images/brand/My_logo-dark.v2.PNG' }))).toBe('My logo dark.v2');
    expect(itemText(entry({ relPath: 'b-roll/city_night.mp4', tags: ['city', 'night'] }))).toBe('city night. city, night');
    expect(itemText(entry({ relPath: 'a.mp3', description: 'A tone.' }))).toBe('a. A tone.');
  });
});

describe('textHash', () => {
  it('is the sha1 of the text', () => {
    expect(textHash('abc')).toBe(createHash('sha1').update('abc', 'utf8').digest('hex'));
  });

  it('changes with the name, the description, the tags or the category', () => {
    const base = entry({ relPath: 'sfx/a.mp3', description: 'd', tags: ['t'], audio: { category: 'c' } });
    const h = semanticItemOf(base).textHash;
    expect(semanticItemOf({ ...base, relPath: 'sfx/b.mp3' }).textHash).not.toBe(h);
    expect(semanticItemOf({ ...base, description: 'e' }).textHash).not.toBe(h);
    expect(semanticItemOf({ ...base, tags: ['u'] }).textHash).not.toBe(h);
    expect(semanticItemOf({ ...base, audio: { category: 'k' } }).textHash).not.toBe(h);
    expect(semanticItemOf(base)).toEqual({ relPath: 'sfx/a.mp3', text: itemText(base), textHash: h });
  });
});

describe('the e5 prefixes (report §9 / §14)', () => {
  it('adds "query: " / "passage: " (prefix version 1)', () => {
    expect(queryText('a soft whoosh')).toBe('query: a soft whoosh');
    expect(passageText('whoosh soft. motion')).toBe('passage: whoosh soft. motion');
    expect(PREFIX_VERSION).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { buildOrganizeDigest, folderList, parseOrganizeSuggestions } from './organize-suggest';

const entry = (relPath: string, description?: string): LibraryIndexEntry => ({
  relPath,
  ...(description ? { description } : {}),
  origin: 'imported',
  addedAt: '2026-08-16T00:00:00.000Z',
});

describe('folderList', () => {
  it('derives every folder, including intermediate ones, sorted', () => {
    expect(folderList([entry('a/b/c.png'), entry('logos/x.png'), entry('root.png')])).toEqual([
      'a',
      'a/b',
      'logos',
    ]);
  });

  it('is empty when everything sits at the root', () => {
    expect(folderList([entry('one.png'), entry('two.png')])).toEqual([]);
  });
});

describe('buildOrganizeDigest', () => {
  it('lists folders then one line per asset, marking undescribed ones', () => {
    const digest = buildOrganizeDigest([
      entry('logos/acme.png', 'primary logo, white on transparent'),
      entry('logos/dashboard-final2.png'),
    ]);
    expect(digest).toContain('Existing folders (1):');
    expect(digest).toContain('  logos/');
    expect(digest).toContain('logos/acme.png — primary logo, white on transparent');
    expect(digest).toContain('logos/dashboard-final2.png — (no description)');
  });

  it('says so explicitly when there are no folders yet', () => {
    expect(buildOrganizeDigest([entry('a.png')])).toContain('(none — everything is at the root)');
  });

  it('excludes brands/ — its layout is structural, not curation', () => {
    const digest = buildOrganizeDigest([entry('brands/acme/logo.png'), entry('a.png')]);
    expect(digest).not.toContain('brands/acme/logo.png');
    expect(digest).toContain('Assets (1):');
  });

  it('caps the asset list and says how many were left out', () => {
    const many = Array.from({ length: 450 }, (_, i) => entry(`f${i}.png`));
    const digest = buildOrganizeDigest(many);
    expect(digest).toContain('Assets (400 of 450):');
    expect(digest).not.toContain('f400.png');
  });
});

describe('parseOrganizeSuggestions', () => {
  const payload = '{"moves":[{"relPath":"a.png","toFolder":"logos","reason":"a logo"}]}';

  it('parses the documented shape', () => {
    expect(parseOrganizeSuggestions(payload)).toEqual([
      { relPath: 'a.png', toFolder: 'logos', reason: 'a logo' },
    ]);
  });

  it('tolerates a code fence and a leading sentence', () => {
    expect(parseOrganizeSuggestions('Here is the plan:\n```json\n' + payload + '\n```')).toHaveLength(1);
    expect(parseOrganizeSuggestions('Sure! ' + payload)).toHaveLength(1);
  });

  it('accepts a bare array as the shortcut it is', () => {
    expect(
      parseOrganizeSuggestions('[{"relPath":"a.png","toFolder":"","reason":"root"}]'),
    ).toEqual([{ relPath: 'a.png', toFolder: '', reason: 'root' }]);
  });

  it('accepts an empty plan — often the correct answer', () => {
    expect(parseOrganizeSuggestions('{"moves":[]}')).toEqual([]);
  });

  it('defaults a missing reason rather than dropping the move', () => {
    expect(parseOrganizeSuggestions('{"moves":[{"relPath":"a.png","toFolder":"logos"}]}')).toEqual([
      { relPath: 'a.png', toFolder: 'logos', reason: '' },
    ]);
  });

  it('throws rather than letting a malformed plan reach the review gate', () => {
    expect(() => parseOrganizeSuggestions('I could not do that.')).toThrow(/did not return JSON/);
    expect(() => parseOrganizeSuggestions('{"moves": [')).toThrow(/did not return JSON/);
    expect(() => parseOrganizeSuggestions('{"moves":[{"toFolder":"logos"}]}')).toThrow(
      /unexpected shape/,
    );
    expect(() => parseOrganizeSuggestions('{oops}')).toThrow(/malformed JSON/);
  });

  it('is not confused by braces inside a reason string', () => {
    const tricky = '{"moves":[{"relPath":"a.png","toFolder":"x","reason":"has } and \\" inside"}]}';
    expect(parseOrganizeSuggestions(tricky)[0].reason).toBe('has } and " inside');
  });
});

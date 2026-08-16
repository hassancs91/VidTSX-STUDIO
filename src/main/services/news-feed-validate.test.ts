import { describe, expect, it } from 'vitest';
import { compareVersions, parseNewsFeed } from './news-feed-validate';

const OPTS = { now: new Date('2026-08-16T12:00:00Z'), appVersion: '1.2.0' };

const msg = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  type: 'announcement',
  title: 'Title',
  body: 'Body',
  ...overrides,
});

describe('compareVersions', () => {
  it('orders three-part versions numerically, not lexically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBeLessThan(0);
  });
  it('tolerates a leading v and missing parts', () => {
    expect(compareVersions('v1.2', '1.2.0')).toBe(0);
    expect(compareVersions('2', '1.9.9')).toBeGreaterThan(0);
  });
  it('returns NaN for junk — never a confident answer', () => {
    expect(compareVersions('1.2.0-beta', '1.0.0')).toBeNaN();
    expect(compareVersions('abc', '1.0.0')).toBeNaN();
    expect(compareVersions('1.2.3.4', '1.0.0')).toBeNaN();
  });
});

describe('parseNewsFeed — schema + clamps (trust rules 1-2)', () => {
  it('accepts a well-formed message and passes it through', () => {
    const out = parseNewsFeed(
      { messages: [msg({ url: 'https://vidtsx.com/templates', cta: 'Get them' })] },
      OPTS,
    );
    expect(out).toEqual([
      {
        id: 'm1',
        type: 'announcement',
        title: 'Title',
        body: 'Body',
        url: 'https://vidtsx.com/templates',
        cta: 'Get them',
      },
    ]);
  });

  it('malformed feed shapes yield [] — never a throw', () => {
    expect(parseNewsFeed(null, OPTS)).toEqual([]);
    expect(parseNewsFeed('garbage', OPTS)).toEqual([]);
    expect(parseNewsFeed({ messages: 'nope' }, OPTS)).toEqual([]);
    expect(parseNewsFeed({ messages: [null, 42, 'x'] }, OPTS)).toEqual([]);
  });

  it('drops messages missing id/title/body; clamps long strings; caps the array', () => {
    const out = parseNewsFeed(
      {
        messages: [
          msg({ id: '' }),
          msg({ id: 'ok', title: 'T'.repeat(500), body: 'B'.repeat(9000) }),
          ...Array.from({ length: 30 }, (_, i) => msg({ id: `bulk-${i}` })),
        ],
      },
      OPTS,
    );
    expect(out[0].title).toHaveLength(120);
    expect(out[0].body).toHaveLength(500);
    expect(out.length).toBeLessThanOrEqual(20);
  });

  it('non-https urls are stripped (message kept, link dropped, cta with it)', () => {
    const out = parseNewsFeed(
      { messages: [msg({ url: 'http://evil.example', cta: 'Click' })] },
      OPTS,
    );
    expect(out).toHaveLength(1);
    expect(out[0].url).toBeUndefined();
    expect(out[0].cta).toBeUndefined();
  });

  it('unknown type falls back to announcement; duplicate ids are dropped', () => {
    const out = parseNewsFeed(
      { messages: [msg({ type: '<script>' }), msg({ title: 'Dupe' })] },
      OPTS,
    );
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('announcement');
  });
});

describe('parseNewsFeed — scheduling + version targeting', () => {
  it('date windows: future startsAt and past endsAt never render', () => {
    const out = parseNewsFeed(
      {
        messages: [
          msg({ id: 'future', startsAt: '2026-09-01' }),
          msg({ id: 'expired', endsAt: '2026-08-01' }),
          msg({ id: 'live', startsAt: '2026-08-01', endsAt: '2026-09-01' }),
        ],
      },
      OPTS,
    );
    expect(out.map((m) => m.id)).toEqual(['live']);
  });

  it('an unparseable date drops the message (conservative)', () => {
    const out = parseNewsFeed({ messages: [msg({ startsAt: 'not-a-date' })] }, OPTS);
    expect(out).toEqual([]);
  });

  it('minAppVersion gates by running version; invalid version strings drop the message', () => {
    const out = parseNewsFeed(
      {
        messages: [
          msg({ id: 'old-enough', minAppVersion: '1.0.0' }),
          msg({ id: 'too-new', minAppVersion: '2.0.0' }),
          msg({ id: 'junk-version', minAppVersion: 'lol' }),
        ],
      },
      OPTS,
    );
    expect(out.map((m) => m.id)).toEqual(['old-enough']);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

import { getNewsMessages, resetNewsFeed, NEWS_FEED_URL } from './news-feed';

const cachePath = () => path.join(tmpDir, 'news-feed-cache.json');

const FEED = {
  messages: [{ id: 'hello', type: 'tip', title: 'Hi', body: 'There' }],
};

const okFetch = (payload: unknown = FEED) =>
  vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-news-feed-test-'));
});
afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});
beforeEach(async () => {
  resetNewsFeed();
  await fs.rm(cachePath(), { force: true });
});

describe('news-feed service (Phase I trust rules 4: polite, silent, cached)', () => {
  it('success: returns validated messages and writes the last-good cache', async () => {
    const fetchImpl = okFetch();
    const out = await getNewsMessages({ appVersion: '1.0.0', fetchImpl });
    expect(out).toEqual([{ id: 'hello', type: 'tip', title: 'Hi', body: 'There' }]);
    expect(fetchImpl).toHaveBeenCalledWith(NEWS_FEED_URL, expect.objectContaining({ method: 'GET' }));
    await expect(fs.access(cachePath())).resolves.toBeUndefined();
  });

  it('fetches once per launch — a second call reuses the memo', async () => {
    const fetchImpl = okFetch();
    await getNewsMessages({ appVersion: '1.0.0', fetchImpl });
    await getNewsMessages({ appVersion: '1.0.0', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('offline: falls back to the last-good cache, silently', async () => {
    await fs.writeFile(cachePath(), JSON.stringify(FEED), 'utf-8');
    const failing = vi.fn(async () => {
      throw new Error('offline');
    });
    const out = await getNewsMessages({ appVersion: '1.0.0', fetchImpl: failing as unknown as typeof fetch });
    expect(out.map((m) => m.id)).toEqual(['hello']);
  });

  it('404 / garbage body / no cache: empty, never a throw, cache not clobbered', async () => {
    const notFound = vi.fn(async () => new Response('nope', { status: 404 }));
    expect(await getNewsMessages({ appVersion: '1.0.0', fetchImpl: notFound })).toEqual([]);

    resetNewsFeed();
    const garbage = vi.fn(async () => new Response('{not json', { status: 200 }));
    expect(await getNewsMessages({ appVersion: '1.0.0', fetchImpl: garbage })).toEqual([]);
    await expect(fs.access(cachePath())).rejects.toThrow(); // garbage never becomes last-good
  });

  it('cached content is RE-validated at serve time — expired campaigns die in cache too', async () => {
    const expiring = {
      messages: [
        { id: 'window', title: 'Sale', body: 'Now', endsAt: '2026-09-01' },
      ],
    };
    await getNewsMessages({
      appVersion: '1.0.0',
      now: new Date('2026-08-16'),
      fetchImpl: okFetch(expiring),
    });
    resetNewsFeed();
    const failing = vi.fn(async () => {
      throw new Error('offline');
    });
    const afterWindow = await getNewsMessages({
      appVersion: '1.0.0',
      now: new Date('2026-10-01'),
      fetchImpl: failing as unknown as typeof fetch,
    });
    expect(afterWindow).toEqual([]); // served from cache, but the window has closed
  });
});

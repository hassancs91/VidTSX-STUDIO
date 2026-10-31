import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTranscriptWords } from './useAssetTranscripts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTranscriptWords', () => {
  it('keeps UTF-8 word text from the cache file (em-dash, curly quote, Arabic)', async () => {
    const file = JSON.stringify({
      words: [
        { text: 'مرحبا', start: 2, end: 2.4 },
        { text: '39—', start: 0.5, end: 0.9 },
        { text: 'don’t', start: 1, end: 1.3 },
      ],
    });
    const data = Buffer.from(file, 'utf8').toString('base64');
    const studioCacheRead = vi.fn(async () => ({ success: true, data }));
    vi.stubGlobal('window', { api: { studioCacheRead } });

    const words = await fetchTranscriptWords('p1', 'cache/transcripts/a1.json');

    expect(studioCacheRead).toHaveBeenCalledWith({ projectId: 'p1', relPath: 'cache/transcripts/a1.json' });
    expect(words.map((w) => w.text)).toEqual(['39—', 'don’t', 'مرحبا']);
  });

  it('returns no words when the read fails', async () => {
    vi.stubGlobal('window', { api: { studioCacheRead: vi.fn(async () => ({ success: false, error: 'nope' })) } });
    expect(await fetchTranscriptWords('p1', 'x.json')).toEqual([]);
  });
});

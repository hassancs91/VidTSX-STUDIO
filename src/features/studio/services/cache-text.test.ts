import { describe, expect, it } from 'vitest';
import { decodeBase64Utf8 } from './cache-text';

/** What main's studioCacheRead sends: the file's raw bytes as base64. */
function b64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

describe('decodeBase64Utf8', () => {
  it('decodes an em-dash as one character, not three Latin-1 ones (B5 mojibake)', () => {
    expect(decodeBase64Utf8(b64('39—'))).toBe('39—');
    expect(decodeBase64Utf8(b64('application—'))).toBe('application—');
  });

  it('decodes curly quotes, accents and Arabic', () => {
    const text = '“don’t” café ‘ok’ مرحبا';
    expect(decodeBase64Utf8(b64(text))).toBe(text);
  });

  it('returns pure ASCII unchanged (waveform / envelope JSON)', () => {
    const json = '{"version":3,"peaks":[0,12,255],"peaksPerSecond":50}';
    expect(decodeBase64Utf8(b64(json))).toBe(json);
  });

  it('round-trips a transcript cache file holding non-ASCII words', () => {
    const file = JSON.stringify({ words: [{ text: '39—', start: 1.2, end: 1.5 }, { text: 'I’m', start: 1.5, end: 1.7 }] });
    const parsed = JSON.parse(decodeBase64Utf8(b64(file))) as { words: Array<{ text: string }> };
    expect(parsed.words.map((w) => w.text)).toEqual(['39—', 'I’m']);
  });

  it('decodes an empty payload to an empty string', () => {
    expect(decodeBase64Utf8('')).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import { SCRIPT_CONTEXT_CHARS, scriptHead, scriptSlice } from './project-script';

describe('scriptHead', () => {
  it('returns a short script whole', () => {
    expect(scriptHead('Welcome to VidTSX.')).toEqual({ head: 'Welcome to VidTSX.', remaining: 0, total: 18 });
  });

  it('cuts a long script at a word boundary and reports the remainder', () => {
    const script = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
    const { head, remaining, total } = scriptHead(script);
    expect(head.length).toBeLessThanOrEqual(SCRIPT_CONTEXT_CHARS);
    expect(head.endsWith('word')).toBe(false); // no half token
    expect(script.startsWith(head)).toBe(true);
    expect(remaining).toBe(total - head.length);
  });
});

describe('scriptSlice', () => {
  it('clamps the window to the text', () => {
    expect(scriptSlice('abcdef', 2, 3)).toEqual({ text: 'cde', start: 2, end: 5, total: 6 });
    expect(scriptSlice('abcdef', 10, 3)).toEqual({ text: '', start: 6, end: 6, total: 6 });
    expect(scriptSlice('abcdef', -4, 0)).toEqual({ text: 'a', start: 0, end: 1, total: 6 });
  });
});

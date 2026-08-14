import { describe, it, expect } from 'vitest';
import { buildShotExtraInstructions } from './shot-prompt';

const BASE = { width: 1920, height: 1080, fps: 30, durationSeconds: 4 } as const;

describe('buildShotExtraInstructions', () => {
  it('bakes exact literal config values (duration × fps rounded to frames)', () => {
    const text = buildShotExtraInstructions({ ...BASE, kind: 'cutaway', durationSeconds: 4.5 });
    expect(text).toContain('width: 1920,');
    expect(text).toContain('height: 1080,');
    expect(text).toContain('fps: 30,');
    expect(text).toContain('durationInFrames: 135');
  });

  it('cutaway mandates an opaque background; overlay/title mandate transparency', () => {
    expect(buildShotExtraInstructions({ ...BASE, kind: 'cutaway' })).toMatch(/opaque full-frame background/);
    expect(buildShotExtraInstructions({ ...BASE, kind: 'overlay' })).toMatch(/fully transparent/);
    expect(buildShotExtraInstructions({ ...BASE, kind: 'title' })).toMatch(/fully transparent/);
  });

  it('injects the WORDS block only when anchored words are given', () => {
    const without = buildShotExtraInstructions({ ...BASE, kind: 'title' });
    expect(without).not.toContain('const WORDS');
    const withWords = buildShotExtraInstructions({
      ...BASE,
      kind: 'title',
      words: [{ text: 'hello', start: 0.1, end: 0.4 }],
    });
    expect(withWords).toContain('const WORDS = [');
    expect(withWords).toContain('{ text: "hello", start: 0.1, end: 0.4 },');
  });

  it('always carries the import restriction and seconds×fps timing rule', () => {
    const text = buildShotExtraInstructions({ ...BASE, kind: 'overlay' });
    expect(text).toMatch(/ONLY from 'react' and 'remotion'/);
    expect(text).toMatch(/seconds × fps using the fps from useVideoConfig/);
  });
});

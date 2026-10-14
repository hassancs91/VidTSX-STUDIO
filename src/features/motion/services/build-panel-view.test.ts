import { describe, expect, it } from 'vitest';
import type { TsxBuildJobIpc, TsxJobIpc } from '@shared/ipc/types';
import {
  checksText,
  formatElapsed,
  formatLine,
  formatTokens,
  jobElapsedMs,
  latestLook,
  lookTitle,
  outcomeText,
  stillCaption,
  stillUrl,
  tokensText,
  verdictChips,
} from './build-panel-view';

// The panel's words from the snapshot: time ticks between events, tokens and
// checks read at a glance, stills load from their absolute paths.

const build = (over: Partial<TsxBuildJobIpc> = {}): TsxBuildJobIpc => ({
  budget: 'standard',
  edit: false,
  phase: 'rendering',
  round: 2,
  roundsMax: 3,
  checks: 0,
  turns: 4,
  tokens: { input: 820, output: 12_400, cacheRead: 1_130_000, cacheCreation: 54_000 },
  elapsedMs: 0,
  stills: [],
  ...over,
});

describe('numbers', () => {
  it('elapsed and tokens', () => {
    expect(formatElapsed(42_400)).toBe('0:42');
    expect(formatElapsed(725_000)).toBe('12:05');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(1_500)).toBe('1.5k');
    expect(formatTokens(12_400)).toBe('12.4k');
    expect(formatTokens(100_000)).toBe('100k');
    expect(formatTokens(1_130_000)).toBe('1.13M');
    expect(formatTokens(2_000_000)).toBe('2M');
    expect(tokensText(build())).toEqual({
      short: '12.4k tokens out',
      detail: 'output 12.4k · input 820 · cache read 1.13M · cache write 54k · 4 API turns',
    });
  });

  it('elapsed ticks from startedAt while running, stops at completedAt, never below the builder\'s own count', () => {
    const base: TsxJobIpc = { id: 'j', kind: 'build', prompt: 'p', status: 'generating', progress: { step: 's', label: 'l', percent: 0 }, createdAt: 0 };
    expect(jobElapsedMs(base, 9_000)).toBe(0);
    expect(jobElapsedMs({ ...base, startedAt: 1_000 }, 9_000)).toBe(8_000);
    expect(jobElapsedMs({ ...base, startedAt: 1_000, completedAt: 5_000 }, 9_000)).toBe(4_000);
    expect(jobElapsedMs({ ...base, startedAt: 1_000, build: build({ elapsedMs: 12_000 }) }, 9_000)).toBe(12_000);
  });
});

describe('words', () => {
  it('checks: none yet, passed, failed with the first error', () => {
    expect(checksText(build())).toEqual({ short: 'no check yet' });
    expect(checksText(build({ checks: 1, lastCheck: { n: 1, ok: true, errors: [] } }))).toEqual({ short: '1 check (last passed)' });
    expect(checksText(build({ checks: 4, lastCheck: { n: 4, ok: false, errors: ['size 1080x1080, wanted 1080x1350', 'x'] } })))
      .toEqual({ short: '4 checks (last failed)', error: 'size 1080x1080, wanted 1080x1350' });
  });

  it('the format line: Auto length, a fixed one, loop, edit', () => {
    expect(formatLine(build({ format: { width: 1080, height: 1350, fps: 30, loop: true } })))
      .toBe('Standard · 1080×1350 · 30 fps · length: builder decides · loop');
    expect(formatLine(build({ budget: 'quick', format: { width: 1920, height: 1080, fps: 25, durationInFrames: 175 } })))
      .toBe('Quick · 1920×1080 · 25 fps · 7 s');
    expect(formatLine(build({ budget: 'craft', edit: true, format: { width: 1080, height: 1080, fps: 30, durationInFrames: 100 } })))
      .toBe('Craft · edit · 1080×1080 · 30 fps · 3.3 s');
    expect(formatLine(build({ edit: true }))).toBe('Standard · edit');
  });

  it('verdict chips: seam, purity, generated images', () => {
    expect(verdictChips(build())).toEqual([]);
    expect(verdictChips(build({
      seam: { jump: false, wrap: 0.1, neighbours: 0.1 },
      purity: { pure: false, frames: [30], worst: 3.7 },
      images: { count: 2, costUsd: 0.08 },
    }))).toEqual([
      { text: 'loop seam OK', bad: false },
      { text: 'frames differ', bad: true },
      { text: '2 images · $0.08', bad: false },
    ]);
  });

  it('look titles and captions for frames, a contact sheet and the phone view', () => {
    const frames = [0, 120, 239].map((frame) => ({ round: 2, frame, size: 'model' as const, path: `/r/f${frame}.jpg` }));
    expect(lookTitle(frames)).toBe('Round 2 · 3 frames');
    expect(stillCaption(frames[1])).toBe('frame 120');
    const sheet = { round: 3, frame: 0, size: 'sheet' as const, frames: [0, 30, 60, 90], path: '/r/sheet.png' };
    expect(lookTitle([sheet])).toBe('Round 3 · contact sheet, 4 frames');
    expect(stillCaption(sheet)).toBe('frames 0–90');
    expect(lookTitle([{ round: 2, frame: 30, size: 'phone', path: '/r/p.jpg' }])).toBe('Round 2 · phone view');
    expect(lookTitle([])).toBe('');
  });

  it('a finished build\'s saved stills narrow to the last round', () => {
    const r1 = { round: 1, frame: 0, size: 'model' as const, path: '/v1.stills/r01-f000.jpg' };
    const r2 = { round: 2, frame: 0, size: 'model' as const, path: '/v1.stills/r02-f000.jpg' };
    const phone = { round: 2, frame: 30, size: 'phone' as const, path: '/v1.stills/phone1-f030.jpg' };
    expect(latestLook([r1, r2, phone])).toEqual([r2, phone]);
    expect(latestLook([])).toEqual([]);
  });

  it('a still path as a file URL', () => {
    expect(stillUrl('C:\\Users\\A B\\AppData\\Roaming\\VidTSX Studio\\tsx-builds\\r#1\\stills\\r01-f000.jpg'))
      .toBe('file:///C:/Users/A%20B/AppData/Roaming/VidTSX%20Studio/tsx-builds/r%231/stills/r01-f000.jpg');
    expect(stillUrl('/home/x/v1.stills/r01-f000.jpg')).toBe('file:///home/x/v1.stills/r01-f000.jpg');
  });

  it('why a build stopped', () => {
    const base: TsxJobIpc = { id: 'j', kind: 'build', prompt: 'p', status: 'generating', progress: { step: 's', label: 'l', percent: 0 }, createdAt: 0 };
    expect(outcomeText(base)).toBeNull();
    expect(outcomeText({ ...base, status: 'error', error: 'no tools' })).toEqual({ text: 'no tools', bad: true });
    expect(outcomeText({ ...base, status: 'cancelled' })).toEqual({ text: 'Cancelled. Nothing was saved.', bad: false });
    expect(outcomeText({ ...base, status: 'done', versionPath: 'C:/v1.tsx', projectName: 'bounce' })).toEqual({ text: 'Saved as bounce.', bad: false });
    expect(outcomeText({ ...base, status: 'done', build: build({ notice: 'Out of time.' }) })).toEqual({ text: 'Out of time.', bad: false });
  });
});

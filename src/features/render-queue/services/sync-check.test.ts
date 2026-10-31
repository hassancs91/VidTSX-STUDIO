import { describe, expect, it } from 'vitest';
import type { RenderQueueJob } from '@shared/ipc/types';
import type { SyncVerdict } from '@shared/studio/sync-verdict';
import {
  isSyncCheckableJob,
  summarizeSyncCheck,
  syncCheckProgressText,
  syncCheckStateFromResponse,
} from './sync-check';

const studioJob: RenderQueueJob = {
  id: 'j1',
  fileName: 'video-14 (range).mp4',
  filePath: 'D:\\repos\\VidTSX-STUDIO\\.vidtsx-temp\\studio\\studio-entry-video-14-4650cc99.tsx',
  compositionId: 'StudioTimeline',
  outputPath: 'D:\\out\\video-14 (range).mp4',
  codec: 'h264',
  width: 3840,
  height: 2160,
  fps: 60,
  exportEngine: 'remotion',
  status: 'done',
  progress: 100,
  framesRendered: 1800,
  totalFrames: 1800,
  createdAt: 0,
};

const passVerdict: SyncVerdict = {
  verdict: 'pass',
  offsetMs: 0.2,
  spreadMs: 7.3,
  driftMsPerSec: -0.28,
  driftOverSpanMs: -2.8,
  spanSec: 10.1,
  attempted: 16,
  confident: 16,
  used: 16,
  message: 'In sync: audio +0.2 ms vs the picture, drift -2.8 ms over 10.1 s (16 of 16 probes).',
};

describe('isSyncCheckableJob', () => {
  it('offers the check on a finished Studio export with sound', () => {
    expect(isSyncCheckableJob(studioJob)).toBe(true);
  });

  it('hides it while rendering, after an error, on a muted export and on non-Studio rows', () => {
    expect(isSyncCheckableJob({ ...studioJob, status: 'rendering' })).toBe(false);
    expect(isSyncCheckableJob({ ...studioJob, status: 'error' })).toBe(false);
    expect(isSyncCheckableJob({ ...studioJob, muted: true })).toBe(false);
    // A workspace TSX render: no engine, not a Studio entry.
    expect(isSyncCheckableJob({ ...studioJob, exportEngine: undefined, filePath: 'C:\\p\\GlitchIntro.tsx' })).toBe(false);
    // An engine but not an entry file (never written by the editor, but keep the source valid).
    expect(isSyncCheckableJob({ ...studioJob, filePath: '/tmp/other.tsx' })).toBe(false);
  });

  it('accepts forward-slash entry paths too', () => {
    expect(isSyncCheckableJob({ ...studioJob, filePath: '/x/.vidtsx-temp/studio/studio-entry-p1-abc.tsx' })).toBe(true);
  });
});

describe('syncCheckStateFromResponse', () => {
  it('a verdict becomes the result with its report and probe counts', () => {
    const s = syncCheckStateFromResponse({
      success: true,
      verdict: passVerdict,
      reportPath: 'D:\\out\\video-14 (range).sync.json',
      probes: { confident: 16, total: 16 },
      elapsedMs: 52600,
    });
    expect(s).toEqual({
      status: 'result',
      verdict: passVerdict,
      reportPath: 'D:\\out\\video-14 (range).sync.json',
      probes: { confident: 16, total: 16 },
      elapsedMs: 52600,
    });
  });

  it('cancelled → idle, busy → a plain wait message, errors pass through', () => {
    expect(syncCheckStateFromResponse({ success: false, cancelled: true })).toEqual({ status: 'idle' });
    const busy = syncCheckStateFromResponse({ success: false, busy: true, error: 'busy' });
    expect(busy.status).toBe('error');
    expect(busy.status === 'error' && busy.message).toMatch(/Another A\/V check is running/);
    expect(syncCheckStateFromResponse({ success: false, error: 'This export can no longer be checked' })).toEqual({
      status: 'error',
      message: 'This export can no longer be checked',
    });
    expect(syncCheckStateFromResponse({ success: false })).toEqual({ status: 'error', message: 'The A/V check failed.' });
  });
});

describe('summarizeSyncCheck', () => {
  it('pass: offset, drift over the span, probes, time', () => {
    const s = summarizeSyncCheck(passVerdict, { confident: 16, total: 16 }, 52600);
    expect(s.tone).toBe('pass');
    expect(s.label).toBe('In sync');
    expect(s.message).toBe(passVerdict.message);
    expect(s.details).toBe('Offset +0.2 ms · drift -2.8 ms over 10.1 s · 16 of 16 probes confident · 52.6 s');
  });

  it('fail at +99.4 ms and inconclusive without numbers', () => {
    const fail = summarizeSyncCheck({ ...passVerdict, verdict: 'fail', offsetMs: 99.4, message: 'Out of sync…' });
    expect(fail.label).toBe('Out of sync');
    expect(fail.details).toBe('Offset +99.4 ms · drift -2.8 ms over 10.1 s · 16 of 16 probes confident');
    const none = summarizeSyncCheck({
      ...passVerdict,
      verdict: 'inconclusive',
      offsetMs: null,
      spreadMs: null,
      driftMsPerSec: null,
      driftOverSpanMs: null,
      spanSec: null,
      confident: 2,
      used: 2,
      message: 'Not enough to judge…',
    });
    expect(none.label).toBe('Not enough to judge');
    expect(none.details).toBe('2 of 16 probes confident');
  });
});

describe('syncCheckProgressText', () => {
  it('reads the export first, then counts probes', () => {
    expect(syncCheckProgressText(0, 0)).toBe('Checking A/V: reading the export…');
    expect(syncCheckProgressText(3, 16)).toBe('Checking A/V: probe 3 of 16');
    expect(syncCheckProgressText(17, 16)).toBe('Checking A/V: probe 16 of 16');
  });
});

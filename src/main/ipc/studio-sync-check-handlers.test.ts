import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';

/**
 * The renderer-facing contract of T8 "Check this export": the document comes
 * from the entry's sidecar or the project (range-trimmed), one check runs at a
 * time, progress is pushed to the asking window, cancel aborts the run. The
 * measuring runner, the sidecar and the project store are faked at the
 * service seam; nothing spawns.
 */
const files = new Set<string>();
vi.mock('fs/promises', () => ({
  default: {
    access: async (p: string) => {
      if (!files.has(p)) throw new Error('ENOENT');
    },
  },
}));

const sidecars = new Map<string, unknown>();
vi.mock('../services/studio/export-engines/export-context', () => ({
  readExportContext: async (entryPath: string) => sidecars.get(entryPath) ?? null,
}));

const projects = new Map<string, unknown>();
vi.mock('../services/studio/project-store', () => ({
  loadProject: async (id: string) => {
    const p = projects.get(id);
    if (!p) throw new Error(`Project not found: ${id}`);
    return p;
  },
}));

interface CheckCall {
  exportPath: string;
  project: { id: string; timeline: { tracks: { clips: { timelineStart: number; duration: number; sourceIn: number }[] }[] } };
  signal?: AbortSignal;
  onProgress?: (p: { done: number; total: number }) => void;
}
const calls: CheckCall[] = [];
let gate: Promise<void> | null = null;
vi.mock('../services/studio/export-engines/export-sync-check', () => ({
  checkExportSync: async (options: CheckCall) => {
    calls.push(options);
    options.onProgress?.({ done: 1, total: 2 });
    if (gate) await gate;
    if (options.signal?.aborted) throw new Error('Sync check cancelled');
    options.onProgress?.({ done: 2, total: 2 });
    return {
      reportPath: options.exportPath.replace(/\.mp4$/, '.sync.json'),
      report: {
        elapsedMs: 1234,
        verdict: { verdict: 'pass', offsetMs: 0.2, spreadMs: 7.3, driftMsPerSec: -0.28, driftOverSpanMs: -2.8, spanSec: 10.1, attempted: 16, confident: 16, used: 16, message: 'In sync' },
      },
    };
  },
}));

import { IPC } from '../../shared/ipc/channels';
import { handleStudioExportSyncCheck, handleStudioExportSyncCheckCancel } from './studio-sync-check-handlers';

function fakeEvent(destroyed = false) {
  const sent: [string, unknown][] = [];
  const event = { sender: { isDestroyed: () => destroyed, send: (ch: string, payload: unknown) => sent.push([ch, payload]) } };
  return { event: event as unknown as IpcMainInvokeEvent, sent };
}

const clip = (timelineStart: number, duration: number) => ({ id: `c${timelineStart}`, type: 'video', timelineStart, duration, sourceIn: 0, assetId: 'a' });
const project = {
  id: 'p1',
  settings: { fps: 30, width: 1920, height: 1080 },
  timeline: { tracks: [{ id: 't1', kind: 'video', clips: [clip(0, 10), clip(10, 10)] }] },
};
const EXPORT = 'D:/out/studio-p1.mp4';

beforeEach(() => {
  files.clear();
  sidecars.clear();
  projects.clear();
  calls.length = 0;
  gate = null;
  files.add(EXPORT);
});

describe('studio:export:sync-check', () => {
  it('checks a queue row from its entry sidecar and pushes progress', async () => {
    sidecars.set('C:/tmp/studio-entry-p1.tsx', { project, entry: {} });
    const { event, sent } = fakeEvent();
    const res = await handleStudioExportSyncCheck(event, { exportPath: EXPORT, source: { kind: 'entry', entryPath: 'C:/tmp/studio-entry-p1.tsx' } });
    expect(res).toMatchObject({ success: true, reportPath: 'D:/out/studio-p1.sync.json', probes: { confident: 16, total: 16 }, elapsedMs: 1234 });
    expect(res.verdict?.verdict).toBe('pass');
    expect(calls[0].project).toBe(project);
    expect(sent).toEqual([
      [IPC.STUDIO_EXPORT_SYNC_CHECK_PROGRESS, { exportPath: EXPORT, done: 1, total: 2 }],
      [IPC.STUDIO_EXPORT_SYNC_CHECK_PROGRESS, { exportPath: EXPORT, done: 2, total: 2 }],
    ]);
  });

  it('says plainly when the entry sidecar is gone (swept after 24 h)', async () => {
    const { event } = fakeEvent();
    const res = await handleStudioExportSyncCheck(event, { exportPath: EXPORT, source: { kind: 'entry', entryPath: 'C:/tmp/gone.tsx' } });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cleared a day after the export/);
    expect(calls).toHaveLength(0);
  });

  it('trims a project source to the I→O range', async () => {
    projects.set('p1', project);
    const { event } = fakeEvent();
    const res = await handleStudioExportSyncCheck(event, { exportPath: EXPORT, source: { kind: 'project', projectId: 'p1', rangeIn: 5, rangeOut: 15 } });
    expect(res.success).toBe(true);
    const clips = calls[0].project.timeline.tracks[0].clips;
    expect(clips.map((c) => [c.timelineStart, c.duration, c.sourceIn])).toEqual([[0, 5, 5], [5, 5, 0]]);
  });

  it('refuses a missing export, an unknown project and a bad request', async () => {
    const { event } = fakeEvent();
    const missing = await handleStudioExportSyncCheck(event, { exportPath: 'D:/out/nope.mp4', source: { kind: 'project', projectId: 'p1' } });
    expect(missing.error).toMatch(/missing/);
    const unknown = await handleStudioExportSyncCheck(event, { exportPath: EXPORT, source: { kind: 'project', projectId: 'zz' } });
    expect(unknown.error).toMatch(/Could not open the project/);
    const bad = await handleStudioExportSyncCheck(event, { exportPath: EXPORT, source: { kind: 'nope' } } as never);
    expect(bad).toEqual({ success: false, error: 'Invalid check request' });
    expect(calls).toHaveLength(0);
  });

  it('runs one check at a time, and cancel aborts it', async () => {
    projects.set('p1', project);
    let release = () => {};
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { event } = fakeEvent();
    const first = handleStudioExportSyncCheck(event, { exportPath: EXPORT, source: { kind: 'project', projectId: 'p1' } });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    const second = await handleStudioExportSyncCheck(event, { exportPath: EXPORT, source: { kind: 'project', projectId: 'p1' } });
    expect(second).toMatchObject({ success: false, busy: true });
    expect(await handleStudioExportSyncCheckCancel(event, { exportPath: 'D:/out/other.mp4' })).toEqual({ success: true, cancelled: false });
    expect(await handleStudioExportSyncCheckCancel(event, { exportPath: EXPORT })).toEqual({ success: true, cancelled: true });
    release();
    expect(await first).toEqual({ success: false, cancelled: true, error: 'Check cancelled' });
    // The slot is free again.
    gate = null;
    expect((await handleStudioExportSyncCheck(event, { exportPath: EXPORT, source: { kind: 'project', projectId: 'p1' } })).success).toBe(true);
  });

  it('does not push progress to a closed window', async () => {
    projects.set('p1', project);
    const { event, sent } = fakeEvent(true);
    expect((await handleStudioExportSyncCheck(event, { exportPath: EXPORT, source: { kind: 'project', projectId: 'p1' } })).success).toBe(true);
    expect(sent).toHaveLength(0);
  });
});

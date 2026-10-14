import { describe, expect, it, vi } from 'vitest';
import type { TsxJobIpc, TsxJobStartRequest } from '@shared/ipc/types';
import { startBuildAndWait, type BuildJobEngine } from './build-and-wait';

const request: TsxJobStartRequest = { kind: 'build', prompt: 'A ball bounces.', build: { budget: 'quick', format: { width: 1080, height: 1080, fps: 30 } } };
const snap = (id: string, status: TsxJobIpc['status']): TsxJobIpc => ({
  id,
  kind: 'build',
  prompt: 'p',
  status,
  progress: { step: status, label: status, percent: 0 },
  createdAt: 0,
});

/** A fake engine: start() emits `queued` before it returns, like tsxJobEngine. */
function fakeEngine(opts: { refuse?: string } = {}) {
  const listeners = new Set<(job: TsxJobIpc) => void>();
  const streams = new Set<(id: string, chunk: string) => void>();
  const emit = (job: TsxJobIpc) => listeners.forEach((l) => l(job));
  const engine = {
    start: vi.fn((_req: TsxJobStartRequest, _owner?: unknown) => {
      if (opts.refuse) return { error: opts.refuse };
      emit(snap('other', 'generating'));
      emit(snap('job1', 'queued'));
      return { jobId: 'job1' };
    }),
    cancel: vi.fn((id: string) => {
      emit(snap(id, 'cancelled'));
      return { success: true };
    }),
    onEvent: (l: (job: TsxJobIpc) => void) => (listeners.add(l), () => listeners.delete(l)),
    onStream: (l: (id: string, chunk: string) => void) => (streams.add(l), () => streams.delete(l)),
  } satisfies BuildJobEngine;
  return { engine, emit, stream: (id: string, chunk: string) => streams.forEach((l) => l(id, chunk)), listeners };
}

describe('startBuildAndWait', () => {
  it("follows its own job from the events start() emits to done, with the owner and the job's narration only", async () => {
    const fake = fakeEngine();
    const seen: string[] = [];
    const chunks: string[] = [];
    const owner = { origin: 'agent' as const, into: 'C:/session/compositions/bounce' };
    const waiting = startBuildAndWait(fake.engine, request, { owner, onJob: (j) => seen.push(`${j.id}:${j.status}`), onStream: (c) => chunks.push(c) });
    fake.emit(snap('job1', 'generating'));
    fake.stream('other', 'not mine');
    fake.stream('job1', 'DESIGN: a ball');
    fake.emit(snap('other', 'done'));
    fake.emit(snap('job1', 'done'));
    const result = await waiting;
    expect(fake.engine.start).toHaveBeenCalledWith(request, owner);
    expect(result).toMatchObject({ jobId: 'job1', final: { status: 'done' } });
    expect(seen).toEqual(['job1:queued', 'job1:generating', 'job1:done']);
    expect(chunks).toEqual(['DESIGN: a ball']);
    expect(fake.listeners.size).toBe(0);
  });

  it("cancels the job when the caller's signal fires, and settles on its cancelled snapshot", async () => {
    const fake = fakeEngine();
    const stop = new AbortController();
    const waiting = startBuildAndWait(fake.engine, request, { signal: stop.signal });
    stop.abort();
    expect(await waiting).toMatchObject({ jobId: 'job1', final: { status: 'cancelled' } });
    expect(fake.engine.cancel).toHaveBeenCalledWith('job1');
  });

  it('starts nothing when the signal has already fired, and passes a refusal through', async () => {
    const fake = fakeEngine();
    const stop = new AbortController();
    stop.abort();
    expect(await startBuildAndWait(fake.engine, request, { signal: stop.signal })).toEqual({ startError: 'Cancelled before it started' });
    expect(fake.engine.start).not.toHaveBeenCalled();
    const refusing = fakeEngine({ refuse: 'A new build needs a format (width, height, fps)' });
    expect(await startBuildAndWait(refusing.engine, request)).toEqual({ startError: 'A new build needs a format (width, height, fps)' });
    expect(refusing.listeners.size).toBe(0);
  });
});

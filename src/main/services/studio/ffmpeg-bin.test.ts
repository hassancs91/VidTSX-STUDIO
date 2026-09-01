import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A fake child: emits 'close' on demand so runFfmpeg's promise settles.
class FakeProc extends EventEmitter {
  pid = 4242;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill(): boolean {
    this.killed = true;
    queueMicrotask(() => this.emit('close', null));
    return true;
  }
}

const spawnMock = vi.fn();
const setPriorityMock = vi.fn();

vi.mock('child_process', () => ({ spawn: (...args: unknown[]) => spawnMock(...args) }));
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  const setPriority = (...args: unknown[]) => setPriorityMock(...args);
  // `default` must come after the spread — the namespace carries its own.
  return { ...actual, setPriority, default: { ...actual, setPriority } };
});
vi.mock('../../utils/paths', () => ({ getRemotionBinariesDir: () => 'C:/fake' }));

import { runFfmpeg } from './ffmpeg-bin';

describe('runFfmpeg', () => {
  let proc: FakeProc;

  beforeEach(() => {
    proc = new FakeProc();
    spawnMock.mockReset().mockReturnValue(proc);
    setPriorityMock.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('leaves the child at normal priority unless a caller opts in', async () => {
    const done = runFfmpeg('ffmpeg', ['-i', 'x']);
    proc.emit('close', 0);
    await done;
    expect(setPriorityMock).not.toHaveBeenCalled();
  });

  it('lowers the child to below-normal when asked (background transcodes)', async () => {
    const done = runFfmpeg('ffmpeg', ['-i', 'x'], { priority: 'below-normal' });
    proc.emit('close', 0);
    await done;
    expect(setPriorityMock).toHaveBeenCalledWith(4242, 10);
  });

  it('maps idle to the lowest class', async () => {
    const done = runFfmpeg('ffmpeg', ['-i', 'x'], { priority: 'idle' });
    proc.emit('close', 0);
    await done;
    expect(setPriorityMock).toHaveBeenCalledWith(4242, 19);
  });

  it('a failed setPriority is not a failed transcode', async () => {
    setPriorityMock.mockImplementation(() => {
      throw new Error('EACCES');
    });
    const done = runFfmpeg('ffmpeg', ['-i', 'x'], { priority: 'below-normal' });
    proc.emit('close', 0);
    await expect(done).resolves.toBeUndefined();
  });

  it('rejects with the stderr tail on a non-zero exit', async () => {
    const done = runFfmpeg('ffmpeg', ['-i', 'x']);
    proc.stderr.emit('data', Buffer.from('Unknown encoder h264_nvenc'));
    proc.emit('close', 1);
    await expect(done).rejects.toThrow(/code 1: Unknown encoder h264_nvenc/);
  });

  it('kills the child on abort and rejects as Cancelled', async () => {
    const ac = new AbortController();
    const done = runFfmpeg('ffmpeg', ['-i', 'x'], { signal: ac.signal });
    ac.abort();
    await expect(done).rejects.toThrow('Cancelled');
    expect(proc.killed).toBe(true);
  });
});

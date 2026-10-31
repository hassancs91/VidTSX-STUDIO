import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DecisionsEvent, DecisionsStatus } from '../../../shared/ipc/types/decisions';

// The decisions IPC registration (DECISION_MODELS_DESIGN.md §12): the three request channels registered `lazily` (nothing built at startup,
// LS-r7's library-search pattern), a failed first-use start still answers a typed value, and the push event goes to every live window.
const hoisted = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  return {
    handlers,
    handle: (channel: string, fn: (...args: unknown[]) => Promise<unknown>) => handlers.set(channel, fn),
    contents: [] as { isDestroyed: () => boolean; send: (...args: unknown[]) => void }[],
    listener: null as ((event: DecisionsEvent) => void) | null,
  };
});
const STATUS = { mode: 'auto', jev: { available: true } } as unknown as DecisionsStatus;
const runtime = { status: vi.fn(async () => STATUS), decide: vi.fn(), setSettings: vi.fn(), testKey: vi.fn(async () => ({ ok: true })) };
const ensureDecisions = vi.fn(async () => undefined);

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(hoisted.handle) },
  webContents: { getAllWebContents: () => hoisted.contents },
}));
vi.mock('../../services/settings-db', () => ({ getValue: () => undefined, setValue: () => undefined }));
vi.mock('../../services/decisions/decision-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/decisions/decision-runtime')>()),
  getDecisionRuntime: () => runtime,
  ensureDecisions: () => ensureDecisions(),
  onDecisionsEvent: (fn: (event: DecisionsEvent) => void) => {
    hoisted.listener = fn;
    return () => undefined;
  },
}));

const { registerDecisionsIpc } = await import('./decisions');
const { IPC } = await import('@shared/ipc/channels');

beforeEach(() => {
  hoisted.handlers.clear();
  hoisted.contents.length = 0;
  hoisted.listener = null;
  ensureDecisions.mockReset().mockImplementation(async () => undefined);
  runtime.status.mockReset().mockImplementation(async () => STATUS);
  registerDecisionsIpc();
});

describe('registerDecisionsIpc', () => {
  it('registers exactly the three request channels and builds nothing', () => {
    expect([...hoisted.handlers.keys()].sort()).toEqual([IPC.DECISIONS_DECIDE, IPC.DECISIONS_SETTINGS_SET, IPC.DECISIONS_STATUS].sort());
    expect(ensureDecisions).not.toHaveBeenCalled();
    expect(runtime.status).not.toHaveBeenCalled();
  });

  it('the first call starts the runtime, then answers', async () => {
    await expect(hoisted.handlers.get(IPC.DECISIONS_STATUS)?.({}, {})).resolves.toEqual(STATUS);
    expect(ensureDecisions).toHaveBeenCalledTimes(1);
  });

  it('a failed start still answers a typed value, never a rejected invoke', async () => {
    ensureDecisions.mockImplementation(async () => { throw new Error('credential store locked'); });
    runtime.status.mockImplementation(async () => { throw new Error('credential store locked'); });
    await expect(hoisted.handlers.get(IPC.DECISIONS_STATUS)?.({}, {})).resolves.toMatchObject({ error: 'credential store locked' });
    await expect(hoisted.handlers.get(IPC.DECISIONS_DECIDE)?.({}, { test: 'jev' })).resolves.toMatchObject({ ok: true });
  });

  it('pushes decisions:event to every live window', () => {
    const live = { isDestroyed: () => false, send: vi.fn() };
    const gone = { isDestroyed: () => true, send: vi.fn() };
    hoisted.contents.push(live, gone);
    const event: DecisionsEvent = { type: 'status', status: STATUS };
    hoisted.listener?.(event);
    expect(live.send).toHaveBeenCalledWith(IPC.DECISIONS_EVENT, event);
    expect(gone.send).not.toHaveBeenCalled();
  });
});

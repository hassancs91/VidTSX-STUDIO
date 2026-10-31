import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DecisionsDecideRequest, DecisionsEvent, DecisionsStatus } from '../../shared/ipc/types/decisions';

// The decisions preload surface (DECISION_MODELS_DESIGN.md §12, §15.2): EXACTLY four functions on the four `decisions:*` channels, and no key
// crosses IPC — no key field in any decisions wire type, the envelope is rebuilt from its known fields (a smuggled key never reaches main).
const ipc = vi.hoisted(() => ({ invoke: vi.fn(async (..._args: unknown[]) => ({ ok: true })), on: vi.fn(), removeListener: vi.fn() }));
vi.mock('electron', () => ({ ipcRenderer: ipc }));

const { decisionsApi } = await import('./decisions');
const { IPC } = await import('../../shared/ipc/channels');

const ROOT = join(__dirname, '..', '..', '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const FAKE_KEY = 'sk-test-FAKE-preload-0007';
const FOUR = ['decisionsDecide', 'decisionsSettingsSet', 'decisionsStatus', 'onDecisionsEvent'];
/** A field that could carry a key: `apiKey`, `key`, `secret`, `token`, `authorization`, `bearer`, `password` (not `hasKey` / `keyProvider`). */
const KEY_FIELD = /(^|[^A-Za-z0-9_])(api[_-]?key|key|secret|token|authorization|bearer|password|credential)s?\s*\??\s*:/im;

beforeEach(() => {
  ipc.invoke.mockClear();
  ipc.on.mockClear();
  ipc.removeListener.mockClear();
});

describe('the decisions preload surface', () => {
  it('exposes exactly the four functions', () => {
    expect(Object.keys(decisionsApi).sort()).toEqual(FOUR);
  });

  it('the IPC table has exactly the four decisions channels', () => {
    const entries = Object.entries(IPC).filter(([name, value]) => name.startsWith('DECISIONS_') || String(value).startsWith('decisions:'));
    expect(Object.fromEntries(entries)).toEqual({
      DECISIONS_DECIDE: 'decisions:decide',
      DECISIONS_STATUS: 'decisions:status',
      DECISIONS_SETTINGS_SET: 'decisions:settings:set',
      DECISIONS_EVENT: 'decisions:event',
    });
  });

  it('decide: the key test sends ONLY the rung id — a smuggled key or request is dropped (D-r19)', async () => {
    const smuggled = { test: 'jev', apiKey: FAKE_KEY, request: { state: 'x' } } as unknown as DecisionsDecideRequest;
    await decisionsApi.decisionsDecide(smuggled);
    expect(ipc.invoke).toHaveBeenCalledWith('decisions:decide', { test: 'jev' });
    expect(JSON.stringify(ipc.invoke.mock.calls)).not.toContain(FAKE_KEY);
  });

  it('decide: a request rides in its envelope; an extra envelope field is dropped', async () => {
    const request = { state: 'one row', questions: { q: { type: 'noul' as const, instructions: 'Is it?' } }, featureSource: 'decision-test' as const };
    await decisionsApi.decisionsDecide({ request, apiKey: FAKE_KEY } as unknown as DecisionsDecideRequest);
    expect(ipc.invoke).toHaveBeenCalledWith('decisions:decide', { request });
    expect(JSON.stringify(ipc.invoke.mock.calls)).not.toContain(FAKE_KEY);
  });

  it('status and settings:set invoke their channels', async () => {
    await decisionsApi.decisionsStatus();
    expect(ipc.invoke).toHaveBeenLastCalledWith('decisions:status', {});
    await decisionsApi.decisionsSettingsSet({ mode: 'off', hostedOrder: ['openrouter-decisions'] });
    expect(ipc.invoke).toHaveBeenLastCalledWith('decisions:settings:set', { mode: 'off', hostedOrder: ['openrouter-decisions'] });
  });

  it('onDecisionsEvent subscribes to the push channel and unsubscribes the same listener', () => {
    const seen: DecisionsEvent[] = [];
    const off = decisionsApi.onDecisionsEvent((event) => seen.push(event));
    expect(ipc.on).toHaveBeenCalledTimes(1);
    const [channel, listener] = ipc.on.mock.calls[0] as [string, (e: unknown, data: DecisionsEvent) => void];
    expect(channel).toBe('decisions:event');
    const event = { type: 'status', status: { mode: 'off' } as DecisionsStatus } as DecisionsEvent;
    listener({}, event);
    expect(seen).toEqual([event]);
    off();
    expect(ipc.removeListener).toHaveBeenCalledWith('decisions:event', listener);
  });
});

describe('the wiring around it', () => {
  it('preload.ts spreads decisionsApi from ./api/decisions; api/index.ts re-exports it', () => {
    const preload = read('src/preload/preload.ts');
    expect(preload).toMatch(/import \{ decisionsApi \} from '\.\/api\/decisions';/);
    expect(preload).toMatch(/\.\.\.decisionsApi,/);
    expect(read('src/preload/api/index.ts')).toMatch(/export \{ decisionsApi \} from '\.\/decisions';/);
  });

  it('electron.d.ts declares exactly the four functions', () => {
    const names = [...read('src/renderer/types/electron.d.ts').matchAll(/^\s*((?:decisions|onDecisions)\w*)\s*:/gm)].map((m) => m[1]);
    expect(names.sort()).toEqual(FOUR);
  });

  it('only api/decisions.ts uses a DECISIONS_ channel in the preload', () => {
    const users = ['preload.ts', 'api/index.ts', ...['agents', 'flows', 'library-search', 'provider-keys', 'settings'].map((f) => `api/${f}.ts`)];
    for (const rel of users) expect(read(`src/preload/${rel}`)).not.toContain('DECISIONS_');
    expect(read('src/preload/api/decisions.ts').match(/IPC\.DECISIONS_\w+/g)?.sort()).toEqual([
      'IPC.DECISIONS_DECIDE',
      'IPC.DECISIONS_EVENT',
      'IPC.DECISIONS_EVENT',
      'IPC.DECISIONS_SETTINGS_SET',
      'IPC.DECISIONS_STATUS',
    ]);
  });

  it('no decisions wire type, nor the preload module, has a field that could carry a key', () => {
    for (const rel of ['src/shared/ipc/types/decisions.ts', 'src/preload/api/decisions.ts']) {
      const code = read(rel).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code, rel).not.toMatch(KEY_FIELD);
    }
  });
});

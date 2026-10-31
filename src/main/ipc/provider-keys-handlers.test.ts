import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';

// The provider-keys save re-registers the decision rungs (DECISION_MODELS_DESIGN.md §8, §12, §15.3 2): a saved or removed TypeSafe /
// OpenRouter key reaches `decisionsKeysChanged()` (which re-registers and pushes `decisions:event`) after the other engines; a decisions
// failure never fails the key save (the keys ARE saved) and never logs a key.
const FAKE_KEY = 'sk-test-FAKE-keys-0021';
const calls: string[] = [];
const m = vi.hoisted(() => ({
  stored: {} as Record<string, string>,
  logged: [] as unknown[],
  keysChanged: null as null | (() => Promise<void>),
}));
const step = (name: string) => vi.fn(async () => { calls.push(name); });

vi.mock('../services/settings', () => ({
  getProviderCredentials: async () => ({ ...m.stored }),
  saveProviderCredentials: async (keys: Record<string, string>, clear?: string[]) => {
    Object.assign(m.stored, keys);
    for (const id of clear ?? []) delete m.stored[id];
    return { ...m.stored };
  },
  getCloudflareAccountId: async () => '',
  setCloudflareAccountId: async () => undefined,
}));
vi.mock('../services/image-init', () => ({ initImageEngine: step('image') }));
vi.mock('../services/video-init', () => ({ initVideoEngine: step('video') }));
vi.mock('../services/audio-generation-init', () => ({ initAudioGenerationEngine: step('audio') }));
vi.mock('../services/llm-init', () => ({ initLLMEngine: step('llm') }));
vi.mock('../services/stt/stt-init', () => ({ initSttEngine: step('stt') }));
vi.mock('../services/decisions/decision-runtime', () => ({
  decisionsKeysChanged: async () => {
    calls.push('decisions');
    if (m.keysChanged) await m.keysChanged();
  },
}));
vi.mock('../../logging/log-engine', () => ({
  logEngine: {
    createLogger: () => ({
      info: (...args: unknown[]) => m.logged.push(args),
      warn: (...args: unknown[]) => m.logged.push(args),
      error: (...args: unknown[]) => m.logged.push(args),
    }),
  },
}));

const { handleProviderKeysSave } = await import('./provider-keys-handlers');
const EVENT = {} as IpcMainInvokeEvent;

beforeEach(() => {
  calls.length = 0;
  m.logged.length = 0;
  m.keysChanged = null;
  for (const id of Object.keys(m.stored)) delete m.stored[id];
});

describe('handleProviderKeysSave → decisions', () => {
  it('a saved TypeSafe key re-registers the decision rungs after the other engines', async () => {
    const res = await handleProviderKeysSave(EVENT, { keys: { typesafe: FAKE_KEY } });
    expect(res).toMatchObject({ success: true, hasKeys: { typesafe: true } });
    expect(calls).toEqual(['image', 'video', 'audio', 'llm', 'stt', 'decisions']);
    expect(JSON.stringify(res)).not.toContain(FAKE_KEY);
  });

  it('a removed key re-registers too (the rung flips back)', async () => {
    m.stored.typesafe = FAKE_KEY;
    const res = await handleProviderKeysSave(EVENT, { keys: {}, clear: ['typesafe'] });
    expect(res).toMatchObject({ success: true, hasKeys: { typesafe: false } });
    expect(calls).toContain('decisions');
  });

  it('a decisions failure never fails the save and never logs a key', async () => {
    m.keysChanged = async () => { throw new Error(`register failed for ${FAKE_KEY}`); };
    const res = await handleProviderKeysSave(EVENT, { keys: { openrouter: FAKE_KEY } });
    expect(res).toMatchObject({ success: true, hasKeys: { openrouter: true } });
    expect(JSON.stringify(m.logged)).not.toContain(FAKE_KEY);
  });
});

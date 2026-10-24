// registerDevStandinProvider (E2, E-d6): the dev-only seam that puts the
// stand-in audio provider on the engine. It must be inert when packaged, when
// the env var is unset, and when the named file is missing; when it does
// register it says so in the log and never displaces a real provider.
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const packaged = { value: false };
const warn = vi.fn();

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return packaged.value;
    },
    getPath: () => os.tmpdir(),
  },
}));
vi.mock('../../logging/log-engine', () => ({
  logEngine: {
    createLogger: () => ({ debug: () => {}, info: () => {}, warn: (...a: unknown[]) => warn(...a), error: () => {} }),
  },
}));

const { registerDevStandinProvider, STANDIN_AUDIO_FILE_ENV } = await import('./audio-generation-standin');
const { audioGenerationEngine } = await import('../../audio-engine/generation');

let dir = '';
let file = '';

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2-standin-reg-'));
  file = path.join(dir, 'sound.mp3');
  await fs.writeFile(file, Buffer.from('bytes'));
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

afterEach(() => {
  audioGenerationEngine.unregister('standin');
  audioGenerationEngine.unregister('real');
  delete process.env[STANDIN_AUDIO_FILE_ENV];
  packaged.value = false;
  warn.mockReset();
});

describe('registerDevStandinProvider', () => {
  it('names the env var VIDTSX_AUDIO_STANDIN_FILE', () => {
    expect(STANDIN_AUDIO_FILE_ENV).toBe('VIDTSX_AUDIO_STANDIN_FILE');
  });

  it('is inert when the app is packaged, even with the env var set to a real file', () => {
    packaged.value = true;
    process.env[STANDIN_AUDIO_FILE_ENV] = file;
    expect(registerDevStandinProvider()).toBe(false);
    expect(audioGenerationEngine.getProviders()).not.toContain('standin');
    expect(warn).not.toHaveBeenCalled();
  });

  it('is inert without the env var', () => {
    expect(registerDevStandinProvider()).toBe(false);
    expect(audioGenerationEngine.getProviders()).not.toContain('standin');
  });

  it('is inert when the named file does not exist (and does not throw)', () => {
    process.env[STANDIN_AUDIO_FILE_ENV] = path.join(dir, 'missing.mp3');
    expect(registerDevStandinProvider()).toBe(false);
    expect(audioGenerationEngine.getProviders()).not.toContain('standin');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('registers the stand-in on an unpackaged app with an existing file, logs it naming the file, and becomes active only when nothing else is', () => {
    process.env[STANDIN_AUDIO_FILE_ENV] = file;
    expect(registerDevStandinProvider()).toBe(true);
    expect(audioGenerationEngine.getProviders()).toContain('standin');
    expect(audioGenerationEngine.getActiveProvider()).toBe('standin');
    expect(audioGenerationEngine.getPricePerSecondUsd('sfx', 'standin')).toBe(0);
    const logged = JSON.stringify(warn.mock.calls[0]);
    expect(logged).toContain('standin');
    expect(logged).toContain(path.basename(file));
  });

  it('never displaces a real provider registered before it', () => {
    audioGenerationEngine.registerInstance({
      id: 'real',
      generate: async () => ({ bytes: Buffer.alloc(0), contentType: 'audio/mpeg', model: 'm' }),
      pricePerSecondUsd: () => 0.002,
    });
    process.env[STANDIN_AUDIO_FILE_ENV] = file;
    expect(registerDevStandinProvider()).toBe(true);
    expect(audioGenerationEngine.getActiveProvider()).toBe('real');
    expect(audioGenerationEngine.getProviders()).toEqual(expect.arrayContaining(['real', 'standin']));
  });
});

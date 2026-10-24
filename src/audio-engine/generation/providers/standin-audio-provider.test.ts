// The dev stand-in audio provider (E2, E-d6): a local file's bytes at the
// engine boundary, so everything after it — save, normalize, probe, index,
// import, insert — runs for real without an ElevenLabs call. Priced at 0.
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAudioGenerationEngine } from '../audio-generation-engine';
import { StandinAudioProvider } from './standin-audio-provider';

let dir = '';
let file = '';
const BYTES = Buffer.from('ID3-not-really-mp3-bytes-but-the-provider-does-not-care');

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2-standin-'));
  file = path.join(dir, 'standin.mp3');
  await fs.writeFile(file, BYTES);
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('StandinAudioProvider', () => {
  it('is "standin", answers with the file bytes as audio/mpeg from model "standin", and costs nothing', async () => {
    const provider = new StandinAudioProvider(file);
    expect(provider.id).toBe('standin');
    const res = await provider.generate({ kind: 'sfx', prompt: 'a whoosh', outputFormat: 'mp3_44100_128' });
    expect(Buffer.compare(res.bytes, BYTES)).toBe(0);
    expect(res.contentType).toBe('audio/mpeg');
    expect(res.model).toBe('standin');
    expect(provider.pricePerSecondUsd('sfx')).toBe(0);
    expect(provider.pricePerSecondUsd('music')).toBe(0);
  });

  it('through the engine: providerId / model "standin", costUsd 0, ext .mp3, the requested length', async () => {
    const engine = createAudioGenerationEngine();
    engine.registerInstance(new StandinAudioProvider(file));
    expect(engine.getActiveProvider()).toBe('standin');
    const out = await engine.generate({ kind: 'sfx', prompt: 'x', durationSec: 2 });
    expect(out).toMatchObject({ providerId: 'standin', model: 'standin', costUsd: 0, ext: '.mp3', durationSec: 2, kind: 'sfx' });
    expect(Buffer.compare(out.bytes, BYTES)).toBe(0);
    const music = await engine.generate({ kind: 'music', prompt: 'a bed', durationSec: 30 });
    expect(music).toMatchObject({ providerId: 'standin', model: 'standin', costUsd: 0, kind: 'music' });
  });

  it('a missing file surfaces as a generation error (nothing is filed)', async () => {
    const provider = new StandinAudioProvider(path.join(dir, 'missing.mp3'));
    await expect(provider.generate({ kind: 'sfx', prompt: 'x', outputFormat: 'mp3_44100_128' })).rejects.toThrow(/ENOENT|no such file/i);
  });
});

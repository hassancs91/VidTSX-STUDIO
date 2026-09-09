import { describe, expect, it, vi } from 'vitest';
import { createAudioGenerationEngine, validateAudioRequest } from './audio-generation-engine';
import { estimateMp3DurationSec } from './mp3-duration';
import type { AudioGenerationProvider, AudioProviderRequest } from './types';

function fakeProvider(id = 'elevenlabs', bytes = Buffer.alloc(16_000)) {
  const generate = vi.fn(async (_req: AudioProviderRequest) => ({
    bytes,
    contentType: 'audio/mpeg',
    model: 'eleven_text_to_sound_v2',
  }));
  const provider: AudioGenerationProvider = {
    id,
    generate,
    pricePerSecondUsd: (kind) => (kind === 'sfx' ? 0.002 : 0.0025),
  };
  return { provider, generate };
}

describe('validateAudioRequest', () => {
  it('enforces the SFX bounds and the prompt', () => {
    expect(() => validateAudioRequest({ kind: 'sfx', prompt: ' ' })).toThrow('needs a prompt');
    expect(() => validateAudioRequest({ kind: 'sfx', prompt: 'x', durationSec: 31 })).toThrow('0.5–30 s');
    expect(() => validateAudioRequest({ kind: 'sfx', prompt: 'x', promptInfluence: 2 })).toThrow('0–1');
    expect(validateAudioRequest({ kind: 'sfx', prompt: ' whoosh ', durationSec: 3, loop: true })).toEqual({
      kind: 'sfx',
      prompt: 'whoosh',
      durationSec: 3,
      loop: true,
      outputFormat: 'mp3_44100_128',
    });
  });

  it('music takes a prompt XOR a plan, 3–600 s, and a seed only with a plan', () => {
    expect(() => validateAudioRequest({ kind: 'music' })).toThrow('prompt or a composition plan');
    expect(() =>
      validateAudioRequest({ kind: 'music', prompt: 'x', compositionPlan: { sections: [{ name: 'a', durationSec: 5 }] } }),
    ).toThrow('not both');
    expect(() => validateAudioRequest({ kind: 'music', prompt: 'x', durationSec: 2 })).toThrow('3–600 s');
    expect(() => validateAudioRequest({ kind: 'music', prompt: 'x', seed: 1 })).toThrow('composition plan');
    expect(validateAudioRequest({ kind: 'music', prompt: 'bed', durationSec: 30, instrumental: true })).toEqual({
      kind: 'music',
      prompt: 'bed',
      durationSec: 30,
      instrumental: true,
      outputFormat: 'mp3_44100_128',
    });
    // A plan's length is its sections'; a durationSec beside it is dropped.
    const plan = { sections: [{ name: 'a', durationSec: 5 }] };
    expect(validateAudioRequest({ kind: 'music', compositionPlan: plan, seed: 3, durationSec: 20 })).toEqual({
      kind: 'music',
      compositionPlan: plan,
      seed: 3,
      outputFormat: 'mp3_44100_128',
    });
  });
});

describe('AudioGenerationEngine', () => {
  it('refuses with the needs-a-provider message when nothing is registered', async () => {
    const engine = createAudioGenerationEngine();
    expect(engine.getActiveProvider()).toBeNull();
    await expect(engine.generate({ kind: 'sfx', prompt: 'x' })).rejects.toThrow('No audio provider is configured');
  });

  it('registers a preset from its key and unregisters cleanly', () => {
    const engine = createAudioGenerationEngine();
    engine.register({ id: 'elevenlabs', name: 'ElevenLabs', type: 'elevenlabs', apiKey: 'k', enabled: true });
    expect(engine.getProviders()).toEqual(['elevenlabs']);
    expect(engine.getActiveProvider()).toBe('elevenlabs');
    expect(engine.getPricePerSecondUsd('music')).toBeCloseTo(0.15 / 60, 10);
    engine.unregister('elevenlabs');
    expect(engine.getActiveProvider()).toBeNull();
    expect(() =>
      engine.register({ id: 'elevenlabs', name: 'ElevenLabs', type: 'elevenlabs', apiKey: '', enabled: true }),
    ).toThrow('API key required');
  });

  it('generates, logs one usage row priced by the requested length', async () => {
    const engine = createAudioGenerationEngine();
    const { provider, generate } = fakeProvider();
    engine.registerInstance(provider);
    const usage = vi.fn();
    engine.setUsageLogger(usage);
    const result = await engine.generate({
      kind: 'sfx',
      prompt: 'whoosh',
      durationSec: 3,
      featureSource: 'agent',
      agentId: 'vidtsx/test',
    });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'sfx', prompt: 'whoosh', durationSec: 3 }));
    expect(result).toMatchObject({
      providerId: 'elevenlabs',
      model: 'eleven_text_to_sound_v2',
      kind: 'sfx',
      ext: '.mp3',
      durationSec: 3,
      costUsd: 0.006,
    });
    expect(usage).toHaveBeenCalledTimes(1);
    expect(usage.mock.calls[0][0]).toMatchObject({
      providerId: 'elevenlabs',
      model: 'eleven_text_to_sound_v2',
      kind: 'sfx',
      featureSource: 'agent',
      agentId: 'vidtsx/test',
      durationSec: 3,
      costUsd: 0.006,
    });
  });

  it('estimates the length from the bitrate when the model chose it', async () => {
    const engine = createAudioGenerationEngine();
    // 16 000 bytes of 128 kbit/s CBR = 1 s.
    const { provider } = fakeProvider('elevenlabs', Buffer.alloc(16_000));
    engine.registerInstance(provider);
    const result = await engine.generate({ kind: 'sfx', prompt: 'click' });
    expect(result.durationSec).toBe(1);
    expect(result.costUsd).toBeCloseTo(0.002, 6);
  });

  it('a composition plan is priced by its sections', async () => {
    const engine = createAudioGenerationEngine();
    const { provider } = fakeProvider();
    engine.registerInstance(provider);
    const usage = vi.fn();
    engine.setUsageLogger(usage);
    const result = await engine.generate({
      kind: 'music',
      compositionPlan: { sections: [{ name: 'a', durationSec: 10 }, { name: 'b', durationSec: 20 }] },
    });
    expect(result.durationSec).toBe(30);
    expect(usage.mock.calls[0][0]).toMatchObject({ kind: 'music', durationSec: 30, costUsd: 0.075 });
  });

  it('does not log usage when the provider fails', async () => {
    const engine = createAudioGenerationEngine();
    const { provider, generate } = fakeProvider();
    generate.mockRejectedValueOnce(new Error('boom'));
    engine.registerInstance(provider);
    const usage = vi.fn();
    engine.setUsageLogger(usage);
    await expect(engine.generate({ kind: 'sfx', prompt: 'x' })).rejects.toThrow('boom');
    expect(usage).not.toHaveBeenCalled();
  });
});

describe('estimateMp3DurationSec', () => {
  it('skips an ID3v2 tag and divides by the format bitrate', () => {
    const tag = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 10]); // "ID3", 10-byte body
    const bytes = Buffer.concat([tag, Buffer.alloc(10), Buffer.alloc(8_000)]);
    expect(estimateMp3DurationSec(bytes, 'mp3_44100_64')).toBe(1);
    expect(estimateMp3DurationSec(Buffer.alloc(24_000), 'mp3_44100_192')).toBe(1);
  });
});

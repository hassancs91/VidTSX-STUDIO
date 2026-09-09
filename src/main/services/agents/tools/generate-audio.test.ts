import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeToolContext } from './test-context';

const hasAudioProvider = vi.fn();
const generateAudioAsset = vi.fn();

vi.mock('../../library/generate-audio-asset', () => ({
  NO_AUDIO_PROVIDER_MESSAGE:
    'No audio provider is configured. Ask the user to add an ElevenLabs key in AI → Providers.',
  hasAudioProvider: () => hasAudioProvider(),
  generateAudioAsset: (req: unknown) => generateAudioAsset(req),
}));

const { generateAudioTool } = await import('./generate-audio');

beforeEach(() => {
  hasAudioProvider.mockReset();
  generateAudioAsset.mockReset();
  hasAudioProvider.mockResolvedValue(true);
  generateAudioAsset.mockResolvedValue({
    relPath: 'agents/test/sfx-a-fast-whoosh.mp3',
    kind: 'sfx',
    durationSeconds: 3,
    description: 'a fast whoosh',
    providerId: 'elevenlabs',
    model: 'eleven_text_to_sound_v2',
    brandId: 'acme-test',
    costUsd: 0.006,
  });
});

describe('generate_audio tool', () => {
  it('declares the audio-provider capability gate', () => {
    expect(generateAudioTool.id).toBe('generate_audio');
    expect(generateAudioTool.needs).toBe('audio-provider');
  });

  it('refuses with the shared needs-a-provider message, without generating', async () => {
    hasAudioProvider.mockResolvedValue(false);
    const res = await generateAudioTool.handler({ kind: 'sfx', prompt: 'a whoosh' }, makeToolContext());
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('AI → Providers');
    expect(generateAudioAsset).not.toHaveBeenCalled();
  });

  it('music needs a prompt or a plan', async () => {
    const res = await generateAudioTool.handler({ kind: 'music' }, makeToolContext());
    expect(res.isError).toBe(true);
    expect(generateAudioAsset).not.toHaveBeenCalled();
  });

  it('files the clip as the agent, brand-tagged, and returns an audio artifact', async () => {
    const ctx = makeToolContext({ agentId: 'vidtsx/sound', libraryFolder: 'agents/sound', brandId: 'acme-test' });
    const res = await generateAudioTool.handler(
      { kind: 'sfx', prompt: 'a fast whoosh', durationSeconds: 3, loop: false },
      ctx,
    );
    expect(res.isError).toBeUndefined();
    expect(generateAudioAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'sfx',
        prompt: 'a fast whoosh',
        durationSec: 3,
        loop: false,
        featureSource: 'agent',
        agentId: 'vidtsx/sound',
        folder: 'agents/sound',
        brandId: 'acme-test',
      }),
    );
    expect(res.content[0].text).toContain('agents/test/sfx-a-fast-whoosh.mp3');
    expect(res.content[0].text).toContain('$0.006');
    expect(res.artifact).toEqual({
      kind: 'audio',
      title: 'a fast whoosh',
      payload: { relPath: 'agents/test/sfx-a-fast-whoosh.mp3', durationSeconds: 3, sound: 'sfx' },
    });
  });

  it('music defaults to instrumental and passes a composition plan through', async () => {
    const plan = { sections: [{ name: 'intro', durationSec: 10 }] };
    await generateAudioTool.handler({ kind: 'music', compositionPlan: plan, seed: 4 }, makeToolContext());
    expect(generateAudioAsset).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'music', instrumental: true, compositionPlan: plan, seed: 4 }),
    );
    expect(generateAudioAsset.mock.calls[0][0]).not.toHaveProperty('prompt');
  });

  it('relays a provider failure as an error result', async () => {
    generateAudioAsset.mockRejectedValue(new Error('ElevenLabs rejected the API key for sound effects'));
    const res = await generateAudioTool.handler({ kind: 'sfx', prompt: 'x' }, makeToolContext());
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('rejected the API key');
  });
});

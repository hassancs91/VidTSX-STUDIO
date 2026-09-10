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

describe('generate_audio as a node (W8 Stage 3, §0.1 item 8)', () => {
  it('declares prompt → audio ports, is priced with a per-second hint per kind', () => {
    expect(generateAudioTool.ports?.inputs).toEqual([{ id: 'prompt', label: 'Prompt', dataType: 'text', required: true, argKey: 'prompt' }]);
    expect(generateAudioTool.ports?.outputs[0]).toMatchObject({ id: 'audio', dataType: 'audio' });
    expect(generateAudioTool.ports?.priced).toBe(true);
    expect(generateAudioTool.ports?.priceHint?.()).toBe('sfx $0.002/s, music $0.0025/s');
    expect(generateAudioTool.ports?.configSchema.map((f) => f.key)).toEqual(['kind', 'durationSeconds', 'loop', 'instrumental', 'brandId']);
  });

  it('runs as a flow: the inspector strings, the run source, a per-node brand override and a null opt-out', async () => {
    const flow = makeToolContext({ agentId: 'flow:01J', libraryFolder: 'flows/ad', brandId: 'run-brand', featureSource: 'flows' });
    await generateAudioTool.handler({ kind: 'sfx', prompt: 'rain', durationSeconds: 0, loop: 'on', brandId: 'node-brand' }, flow);
    expect(generateAudioAsset).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'sfx', prompt: 'rain', loop: true, featureSource: 'flows', folder: 'flows/ad', brandId: 'node-brand' }),
    );
    const first = generateAudioAsset.mock.calls[0][0] as Record<string, unknown>;
    expect(first).not.toHaveProperty('durationSec');
    expect(first).not.toHaveProperty('agentId');

    await generateAudioTool.handler({ kind: 'music', prompt: 'lofi', instrumental: 'off', brandId: null }, flow);
    const second = generateAudioAsset.mock.calls[1][0] as Record<string, unknown>;
    expect(second).toMatchObject({ kind: 'music', instrumental: false });
    expect(second).not.toHaveProperty('brandId');
  });
});

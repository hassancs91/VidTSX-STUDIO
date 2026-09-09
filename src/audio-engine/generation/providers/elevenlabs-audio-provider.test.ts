// The ElevenLabs audio wire, pinned against the API reference read on
// 2026-09-10 (sound-generation + music). A stale field is worse than a
// missing one, so every body is asserted whole.
import { describe, expect, it, vi } from 'vitest';
import {
  ElevenLabsAudioProvider,
  buildElevenLabsAudioBody,
  elevenLabsAudioUrl,
  ELEVENLABS_AUDIO_PRICE_PER_SECOND_USD,
} from './elevenlabs-audio-provider';
import { AudioGenerationError } from '../types';

function okResponse(bytes: Uint8Array, contentType = 'audio/mpeg'): Response {
  return new Response(bytes, { status: 200, headers: { 'content-type': contentType } });
}

describe('buildElevenLabsAudioBody', () => {
  it('sends the v2 SFX model with only the fields that were asked for', () => {
    expect(buildElevenLabsAudioBody({ kind: 'sfx', prompt: 'a whoosh', outputFormat: 'mp3_44100_128' })).toEqual({
      text: 'a whoosh',
      model_id: 'eleven_text_to_sound_v2',
    });
    expect(
      buildElevenLabsAudioBody({
        kind: 'sfx',
        prompt: 'rain on a tin roof',
        durationSec: 3,
        loop: true,
        promptInfluence: 0.6,
        outputFormat: 'mp3_44100_128',
      }),
    ).toEqual({
      text: 'rain on a tin roof',
      model_id: 'eleven_text_to_sound_v2',
      duration_seconds: 3,
      prompt_influence: 0.6,
      loop: true,
    });
  });

  it('music with a prompt carries music_length_ms (never duration_ms) and no seed', () => {
    expect(
      buildElevenLabsAudioBody({
        kind: 'music',
        prompt: 'warm lo-fi bed',
        durationSec: 30,
        instrumental: true,
        outputFormat: 'mp3_44100_128',
      }),
    ).toEqual({
      model_id: 'music_v2',
      force_instrumental: true,
      prompt: 'warm lo-fi bed',
      music_length_ms: 30000,
    });
  });

  it('music with a composition plan maps to the snake_case wire form and takes the seed', () => {
    const body = buildElevenLabsAudioBody({
      kind: 'music',
      compositionPlan: {
        positiveGlobalStyles: ['lo-fi'],
        sections: [{ name: 'intro', durationSec: 4.5, lines: [] }],
      },
      seed: 7,
      outputFormat: 'mp3_44100_128',
    });
    expect(body).toEqual({
      model_id: 'music_v2',
      composition_plan: {
        positive_global_styles: ['lo-fi'],
        negative_global_styles: [],
        sections: [
          {
            section_name: 'intro',
            positive_local_styles: [],
            negative_local_styles: [],
            duration_ms: 4500,
            lines: [],
          },
        ],
      },
      seed: 7,
    });
    expect(body).not.toHaveProperty('prompt');
    expect(body).not.toHaveProperty('music_length_ms');
  });

  it('routes each kind and puts output_format on the query string', () => {
    expect(elevenLabsAudioUrl('sfx', 'mp3_44100_128')).toBe(
      'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',
    );
    expect(elevenLabsAudioUrl('music', 'mp3_44100_192')).toBe(
      'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192',
    );
  });
});

describe('ElevenLabsAudioProvider', () => {
  it('posts JSON with the key header and returns the bytes', async () => {
    const fetchImpl = vi.fn(async () => okResponse(new Uint8Array([1, 2, 3])));
    const provider = new ElevenLabsAudioProvider('elevenlabs', 'key-1', fetchImpl);
    const result = await provider.generate({ kind: 'sfx', prompt: 'a whoosh', durationSec: 1, outputFormat: 'mp3_44100_128' });
    expect(result.bytes).toEqual(Buffer.from([1, 2, 3]));
    expect(result.contentType).toBe('audio/mpeg');
    expect(result.model).toBe('eleven_text_to_sound_v2');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/v1/sound-generation?output_format=mp3_44100_128');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'xi-api-key': 'key-1', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({
      text: 'a whoosh',
      model_id: 'eleven_text_to_sound_v2',
      duration_seconds: 1,
    });
  });

  it('turns a 401 into a permissions message that keeps the API detail', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: { status: 'missing_permissions', message: 'The API key is missing the permission sound_generation.' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const provider = new ElevenLabsAudioProvider('elevenlabs', 'key-1', fetchImpl);
    await expect(
      provider.generate({ kind: 'sfx', prompt: 'x', outputFormat: 'mp3_44100_128' }),
    ).rejects.toMatchObject({
      name: 'AudioGenerationError',
      status: 401,
      message: expect.stringContaining('missing_permissions: The API key is missing the permission sound_generation.'),
    });
  });

  it('reports other failures with the status and the detail string', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ detail: 'music_length_ms must be at least 3000' }), { status: 422 }),
    );
    const provider = new ElevenLabsAudioProvider('elevenlabs', 'key-1', fetchImpl);
    await expect(
      provider.generate({ kind: 'music', prompt: 'x', durationSec: 3, outputFormat: 'mp3_44100_128' }),
    ).rejects.toThrow('ElevenLabs returned 422: music_length_ms must be at least 3000');
  });

  it('rejects an empty file and wraps network errors', async () => {
    const empty = new ElevenLabsAudioProvider('elevenlabs', 'k', vi.fn(async () => okResponse(new Uint8Array())));
    await expect(empty.generate({ kind: 'sfx', prompt: 'x', outputFormat: 'mp3_44100_128' })).rejects.toBeInstanceOf(
      AudioGenerationError,
    );
    const down = new ElevenLabsAudioProvider('elevenlabs', 'k', vi.fn(async () => { throw new Error('ECONNRESET'); }));
    await expect(down.generate({ kind: 'sfx', prompt: 'x', outputFormat: 'mp3_44100_128' })).rejects.toThrow(
      'Network error connecting to ElevenLabs: ECONNRESET',
    );
  });

  it('publishes the per-second rates from the pricing page', () => {
    const provider = new ElevenLabsAudioProvider('elevenlabs', 'k');
    expect(provider.pricePerSecondUsd('sfx')).toBeCloseTo(0.12 / 60, 10);
    expect(provider.pricePerSecondUsd('music')).toBeCloseTo(0.15 / 60, 10);
    expect(ELEVENLABS_AUDIO_PRICE_PER_SECOND_USD.music * 60).toBeCloseTo(0.15, 10);
  });
});

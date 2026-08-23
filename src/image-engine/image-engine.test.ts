import { describe, it, expect, vi } from 'vitest';
import { imageEngine } from './image-engine';
import type { ImageProvider, ImageGenerationResponse } from './types';
import { ModerationBlockedError } from '../shared/content-safety';

function stubProvider(id: string): { provider: ImageProvider; generate: ReturnType<typeof vi.fn> } {
  const generate = vi.fn(
    async (): Promise<ImageGenerationResponse> => ({
      images: [{ base64: 'aGk=', width: 1, height: 1, contentType: 'image/png' }],
      model: 'stub-model',
      provider: id,
      durationMs: 1,
    }),
  );
  const provider: ImageProvider = {
    id,
    name: 'Stub',
    type: 'fal',
    generate,
    getSupportedModels: () => [],
  } as unknown as ImageProvider;
  return { provider, generate };
}

describe('imageEngine Content Safety Gate A (engine chokepoint)', () => {
  it('blocks a flagged prompt before the provider is called', async () => {
    const { provider, generate } = stubProvider('__cs_test_a');
    imageEngine.registerInstance(provider);
    try {
      await expect(
        imageEngine.generateWith('__cs_test_a', { operation: 'text-to-image', prompt: 'nude portrait' }),
      ).rejects.toBeInstanceOf(ModerationBlockedError);
      expect(generate).not.toHaveBeenCalled();
    } finally {
      imageEngine.unregister('__cs_test_a');
    }
  });

  it('carries gate and category on the thrown error', async () => {
    const { provider } = stubProvider('__cs_test_b');
    imageEngine.registerInstance(provider);
    try {
      const err = await imageEngine
        .generateWith('__cs_test_b', { operation: 'text-to-image', prompt: 'porn scene' })
        .then(
          () => null,
          (e: unknown) => e,
        );
      expect(err).toBeInstanceOf(ModerationBlockedError);
      const blocked = err as ModerationBlockedError;
      expect(blocked.gate).toBe('prompt');
      expect(blocked.category).toBe('pornography');
      expect(blocked.message).toContain('Blocked by Content Safety');
    } finally {
      imageEngine.unregister('__cs_test_b');
    }
  });

  it('passes a clean prompt through to the provider', async () => {
    const { provider, generate } = stubProvider('__cs_test_c');
    imageEngine.registerInstance(provider);
    try {
      const result = await imageEngine.generateWith('__cs_test_c', {
        operation: 'text-to-image',
        prompt: 'a sunny mountain landscape',
      });
      expect(result.images).toHaveLength(1);
      expect(generate).toHaveBeenCalledTimes(1);
    } finally {
      imageEngine.unregister('__cs_test_c');
    }
  });
});

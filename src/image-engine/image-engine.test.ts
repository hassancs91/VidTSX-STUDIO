import { describe, it, expect, vi, beforeEach } from 'vitest';
import { imageEngine } from './image-engine';
import type { ImageProvider, ImageGenerationResponse, ImageSafetyGuard } from './types';
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

function passingGuard(): ImageSafetyGuard & { checkImage: ReturnType<typeof vi.fn> } {
  return { checkImage: vi.fn(async () => undefined) };
}

describe('imageEngine Content Safety chokepoint', () => {
  beforeEach(() => {
    imageEngine.setSafetyGuard(passingGuard());
  });

  describe('Gate A (prompt)', () => {
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

  describe('Gate B (pixels) — fail-closed', () => {
    it('refuses to generate when no guard is installed', async () => {
      const { provider, generate } = stubProvider('__cs_test_d');
      imageEngine.registerInstance(provider);
      // @ts-expect-error deliberately clearing the guard to prove fail-closed
      imageEngine.setSafetyGuard(null);
      try {
        await expect(
          imageEngine.generateWith('__cs_test_d', { operation: 'text-to-image', prompt: 'a red circle' }),
        ).rejects.toThrow(/Content Safety is not initialized/);
        expect(generate).not.toHaveBeenCalled();
      } finally {
        imageEngine.unregister('__cs_test_d');
        imageEngine.setSafetyGuard(passingGuard());
      }
    });

    it('checks input reference images BEFORE the provider call', async () => {
      const { provider, generate } = stubProvider('__cs_test_e');
      imageEngine.registerInstance(provider);
      const guard = passingGuard();
      guard.checkImage.mockRejectedValueOnce(new ModerationBlockedError('image', 'explicit'));
      imageEngine.setSafetyGuard(guard);
      try {
        await expect(
          imageEngine.generateWith('__cs_test_e', {
            operation: 'image-to-image',
            prompt: 'make it a watercolor painting',
            sourceImage: 'bm90LXJlYWxseS1hbi1pbWFnZQ==',
          }),
        ).rejects.toBeInstanceOf(ModerationBlockedError);
        expect(guard.checkImage).toHaveBeenCalledWith('bm90LXJlYWxseS1hbi1pbWFnZQ==', 'input');
        expect(generate).not.toHaveBeenCalled();
      } finally {
        imageEngine.unregister('__cs_test_e');
      }
    });

    it('checks every multi-reference input', async () => {
      const { provider } = stubProvider('__cs_test_f');
      imageEngine.registerInstance(provider);
      const guard = passingGuard();
      imageEngine.setSafetyGuard(guard);
      try {
        await imageEngine.generateWith('__cs_test_f', {
          operation: 'multi-reference',
          prompt: 'combine these into a poster',
          referenceImages: ['QQ==', 'Qg=='],
        });
        const inputCalls = guard.checkImage.mock.calls.filter((c) => c[1] === 'input');
        expect(inputCalls.map((c) => c[0])).toEqual(['QQ==', 'Qg==']);
      } finally {
        imageEngine.unregister('__cs_test_f');
      }
    });

    it('classifies every output image and blocks the whole response on a trip', async () => {
      const { provider, generate } = stubProvider('__cs_test_g');
      imageEngine.registerInstance(provider);
      const guard = passingGuard();
      guard.checkImage.mockImplementation(async (_b64: string, context: string) => {
        if (context === 'output') throw new ModerationBlockedError('image', 'borderline');
      });
      imageEngine.setSafetyGuard(guard);
      try {
        const err = await imageEngine
          .generateWith('__cs_test_g', { operation: 'text-to-image', prompt: 'a red circle' })
          .then(
            () => null,
            (e: unknown) => e,
          );
        expect(generate).toHaveBeenCalledTimes(1);
        expect(err).toBeInstanceOf(ModerationBlockedError);
        expect((err as ModerationBlockedError).gate).toBe('image');
        expect((err as ModerationBlockedError).category).toBe('borderline');
      } finally {
        imageEngine.unregister('__cs_test_g');
      }
    });
  });
});

describe('imageEngine per-model parameter overrides (W2c)', () => {
  beforeEach(() => {
    imageEngine.setSafetyGuard(passingGuard());
  });

  it('fills request gaps from the resolver (request ⊕ override), keyed by provider/model', async () => {
    const { provider, generate } = stubProvider('__p_test_a');
    (provider as { defaultModel?: string }).defaultModel = 'stub-model';
    imageEngine.registerInstance(provider);
    imageEngine.setParamResolver((providerId, modelId) =>
      providerId === '__p_test_a' && modelId === 'stub-model'
        ? { steps: 12, seed: 7, width: 768, height: 512 }
        : undefined,
    );
    try {
      await imageEngine.generateWith('__p_test_a', {
        operation: 'text-to-image',
        prompt: 'a red circle',
        params: { steps: 30 },
      });
      const seen = generate.mock.calls[0][0] as { params?: unknown; width?: number; height?: number };
      expect(seen.params).toEqual({ steps: 30, seed: 7, width: 768, height: 512 });
      // Top-level size falls back to the override when the request names none.
      expect(seen.width).toBe(768);
      expect(seen.height).toBe(512);
    } finally {
      imageEngine.setParamResolver(null);
      imageEngine.unregister('__p_test_a');
    }
  });

  it('a request naming another model looks that model up, and no override passes the request through', async () => {
    const { provider, generate } = stubProvider('__p_test_b');
    imageEngine.registerInstance(provider);
    imageEngine.setParamResolver((_p, modelId) => (modelId === 'other' ? { steps: 3 } : undefined));
    try {
      await imageEngine.generateWith('__p_test_b', { operation: 'text-to-image', prompt: 'a red circle', model: 'other' });
      expect((generate.mock.calls[0][0] as { params?: unknown }).params).toEqual({ steps: 3 });
      await imageEngine.generateWith('__p_test_b', { operation: 'text-to-image', prompt: 'a red circle', model: 'none', width: 256 });
      const second = generate.mock.calls[1][0] as { params?: unknown; width?: number };
      expect(second.params).toBeUndefined();
      expect(second.width).toBe(256);
    } finally {
      imageEngine.setParamResolver(null);
      imageEngine.unregister('__p_test_b');
    }
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { BytePlusImageProvider, fitBytePlusImageSize } from './byteplus-image-provider';
import { BYTEPLUS_IMAGE_MODELS } from '../../shared/presets/image-model-entries';
import { IMAGE_DIALECT_DEFAULTS } from '../../shared/presets/image-dialects';
import { ImageEngineError } from '../types';
import type { ImageGenerationRequest } from '../types';

const SEEDREAM_45 = 'seedream-4-5-251128';
const SEEDREAM_50_PRO = 'dola-seedream-5-0-pro-260628';
const PNG = 'iVBORw0KGgoAAAANSUhEUg';
const JPEG = '/9j/4AAQSkZJRgABAQ';

function provider(defaultModel = SEEDREAM_45): BytePlusImageProvider {
  return new BytePlusImageProvider('byteplus', 'ark-key', defaultModel, [...BYTEPLUS_IMAGE_MODELS]);
}

function defOf(p: BytePlusImageProvider, id: string) {
  const models = (p as unknown as { models: Array<{ id: string }> }).models;
  const def = models.find((m) => m.id === id);
  expect(def).toBeDefined();
  return def as Parameters<BytePlusImageProvider['buildRequestBody']>[0];
}

/** Captures each request and answers with the queued response. */
function stubFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const queue = [...responses];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const next = queue.length > 1 ? queue.shift()! : queue[0];
      const status = next.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => next.body,
        text: async () => JSON.stringify(next.body),
      } as unknown as Response;
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fitBytePlusImageSize', () => {
  const seedream45 = { minPixels: 2560 * 1440, maxPixels: 4096 * 4096 };
  const pro = { minPixels: 1280 * 720, maxPixels: 4_624_220 };

  it('falls back to the 2K tier when the caller gave no size', () => {
    expect(fitBytePlusImageSize(seedream45)).toBe('2K');
    expect(fitBytePlusImageSize(seedream45, 1024)).toBe('2K');
  });

  it('passes a size inside the envelope through untouched', () => {
    expect(fitBytePlusImageSize(seedream45, 2048, 2048)).toBe('2048x2048');
    expect(fitBytePlusImageSize(pro, 1280, 720)).toBe('1280x720');
  });

  it('scales a small request up to the model floor on multiples of 16, keeping the aspect', () => {
    const [w, h] = fitBytePlusImageSize(seedream45, 1024, 1024).split('x').map(Number);
    expect(w).toBe(h);
    expect(w % 16).toBe(0);
    expect(w * h).toBeGreaterThanOrEqual(seedream45.minPixels);
    const [lw, lh] = fitBytePlusImageSize(seedream45, 1280, 720).split('x').map(Number);
    expect(lw * lh).toBeGreaterThanOrEqual(seedream45.minPixels);
    expect(Math.abs(lw / lh - 16 / 9)).toBeLessThan(0.02);
    // A 256² provider-test image lands on the floor too, never below it.
    const [tw, th] = fitBytePlusImageSize(pro, 256, 256).split('x').map(Number);
    expect(tw * th).toBeGreaterThanOrEqual(pro.minPixels);
  });

  it('scales an oversize request down to the model ceiling', () => {
    const [w, h] = fitBytePlusImageSize(pro, 4096, 4096).split('x').map(Number);
    expect(w * h).toBeLessThanOrEqual(pro.maxPixels);
    expect(w % 16).toBe(0);
  });
});

describe('BytePlusImageProvider.buildRequestBody', () => {
  it('text-to-image: model, prompt, fitted size, b64_json, no watermark, sequential disabled', () => {
    const p = provider();
    const body = p.buildRequestBody(defOf(p, SEEDREAM_45), {
      operation: 'text-to-image',
      prompt: 'a red apple on a table',
      width: 1024,
      height: 1024,
    });
    expect(body).toMatchObject({
      model: SEEDREAM_45,
      prompt: 'a red apple on a table',
      response_format: 'b64_json',
      watermark: false,
      sequential_image_generation: 'disabled',
    });
    expect(body.size).toMatch(/^\d+x\d+$/);
    expect(body).not.toHaveProperty('image');
    expect(body).not.toHaveProperty('seed');
    expect(body).not.toHaveProperty('guidance_scale');
    expect(body).not.toHaveProperty('output_format');
  });

  it('image-to-image sends ONE data URI under `image`', () => {
    const p = provider();
    const body = p.buildRequestBody(defOf(p, SEEDREAM_45), {
      operation: 'image-to-image',
      prompt: 'make it night',
      sourceImage: PNG,
    });
    expect(body.image).toBe(`data:image/png;base64,${PNG}`);
  });

  it('multi-reference sends an ARRAY of data URIs and keeps an existing data: prefix', () => {
    const p = provider();
    const body = p.buildRequestBody(defOf(p, SEEDREAM_45), {
      operation: 'multi-reference',
      prompt: 'the cat in the hat',
      referenceImages: [JPEG, `data:image/webp;base64,UklGRabc`],
    });
    expect(body.image).toEqual([`data:image/jpeg;base64,${JPEG}`, 'data:image/webp;base64,UklGRabc']);
  });

  it('refuses more references than the model takes (5.0 pro: 10)', () => {
    const p = provider();
    expect(() =>
      p.buildRequestBody(defOf(p, SEEDREAM_50_PRO), {
        operation: 'multi-reference',
        prompt: 'x',
        referenceImages: new Array(11).fill(PNG),
      }),
    ).toThrow(/at most 10 reference images/);
  });

  it('sends seed only when the caller set it, and never guidance_scale (the API rejects it)', () => {
    const p = provider();
    expect(IMAGE_DIALECT_DEFAULTS['byteplus-seedream'].paramSchema.fields.map((f) => f.key)).toEqual(['seed']);
    const body = p.buildRequestBody(defOf(p, SEEDREAM_45), {
      operation: 'text-to-image',
      prompt: 'x',
      params: { seed: 12345.4, cfgScale: 3, steps: 20, negativePrompt: 'blurry' },
    });
    expect(body.seed).toBe(12345);
    // Never a field ModelArk does not have — guidance_scale returned 400 live.
    expect(body).not.toHaveProperty('guidance_scale');
    expect(body).not.toHaveProperty('steps');
    expect(body).not.toHaveProperty('num_inference_steps');
    expect(body).not.toHaveProperty('negative_prompt');
  });

  it('a set rides sequential auto with max_images on 4.5, capped by the 15-image total', () => {
    const p = provider();
    const body = p.buildRequestBody(defOf(p, SEEDREAM_45), {
      operation: 'multi-reference',
      prompt: 'x',
      numImages: 4,
      referenceImages: new Array(13).fill(PNG),
    });
    expect(body.sequential_image_generation).toBe('auto');
    expect(body.sequential_image_generation_options).toEqual({ max_images: 2 });
  });

  it('5.0 pro never carries the sequential field, and takes output_format', () => {
    const p = provider();
    const body = p.buildRequestBody(defOf(p, SEEDREAM_50_PRO), {
      operation: 'text-to-image',
      prompt: 'x',
      numImages: 3,
      outputFormat: 'png',
    });
    expect(body).not.toHaveProperty('sequential_image_generation');
    expect(body).not.toHaveProperty('sequential_image_generation_options');
    expect(body.output_format).toBe('png');
  });

  it('4.5 ignores outputFormat (the API emits jpeg only)', () => {
    const p = provider();
    const body = p.buildRequestBody(defOf(p, SEEDREAM_45), {
      operation: 'text-to-image',
      prompt: 'x',
      outputFormat: 'png',
    });
    expect(body).not.toHaveProperty('output_format');
  });

  it('a user-added id gets the generic envelope: no sequential field, 10 references', () => {
    const p = new BytePlusImageProvider('byteplus', 'k', 'seedream-6-0-270101', [
      { id: 'seedream-6-0-270101', name: 'Future' },
    ]);
    const def = defOf(p, 'seedream-6-0-270101');
    expect(def.maxReferences).toBe(10);
    const body = p.buildRequestBody(def, { operation: 'text-to-image', prompt: 'x', numImages: 2, width: 1024, height: 1024 });
    expect(body).not.toHaveProperty('sequential_image_generation');
    const [w, h] = String(body.size).split('x').map(Number);
    expect(w * h).toBeGreaterThanOrEqual(2560 * 1440);
    expect(w * h).toBeLessThanOrEqual(4_624_220);
  });
});

describe('BytePlusImageProvider.generate', () => {
  const request: ImageGenerationRequest = {
    operation: 'text-to-image',
    prompt: 'a calm lake at dawn',
    width: 1024,
    height: 1024,
  };

  it('POSTs /images/generations with a bearer key and returns the decoded images', async () => {
    const calls = stubFetch([
      {
        body: {
          model: SEEDREAM_45,
          data: [{ b64_json: JPEG, size: '1936x1936' }],
          usage: { generated_images: 1, output_tokens: 14641, total_tokens: 14641 },
        },
      },
    ]);
    const result = await provider().generate(request);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://ark.ap-southeast.bytepluses.com/api/v3/images/generations');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer ark-key');
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe(SEEDREAM_45);
    expect(body.response_format).toBe('b64_json');
    expect(result.model).toBe(SEEDREAM_45);
    expect(result.provider).toBe('byteplus');
    expect(result.images).toEqual([
      { base64: JPEG, width: 1936, height: 1936, contentType: 'image/jpeg' },
    ]);
  });

  it('a set on 5.0 pro is N single calls (the API has no set mode there)', async () => {
    const calls = stubFetch([{ body: { data: [{ b64_json: PNG, size: '1280x720', output_format: 'png' }] } }]);
    const result = await provider(SEEDREAM_50_PRO).generate({ ...request, numImages: 3, width: 1280, height: 720 });
    expect(calls).toHaveLength(3);
    expect(result.images).toHaveLength(3);
    expect(result.images[0].contentType).toBe('image/png');
  });

  it('keeps the images that succeeded inside a set and fails only when none did', async () => {
    stubFetch([
      {
        body: {
          data: [
            { b64_json: JPEG, size: '2048x2048' },
            { error: { code: 'OutputImageSensitiveContentDetected', message: 'moderated' } },
          ],
          usage: { generated_images: 1 },
        },
      },
    ]);
    const partial = await provider().generate({ ...request, numImages: 2 });
    expect(partial.images).toHaveLength(1);

    stubFetch([{ body: { error: { code: 'InvalidParameter', message: 'size out of range' } } }]);
    await expect(provider().generate(request)).rejects.toMatchObject({
      name: 'ImageEngineError',
      message: 'size out of range',
    });
  });

  it('maps an HTTP error to ImageEngineError with the status', async () => {
    stubFetch([{ status: 401, body: { error: { code: 'AuthenticationError', message: 'bad key' } } }]);
    const err = await provider()
      .generate(request)
      .then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(ImageEngineError);
    expect((err as ImageEngineError).statusCode).toBe(401);
    expect((err as ImageEngineError).message).toBe('bad key');
  });

  it('reports the catalog with the dialect schema and every operation', () => {
    const models = provider().getSupportedModels();
    expect(models.map((m) => m.id)).toEqual(BYTEPLUS_IMAGE_MODELS.map((m) => m.id));
    for (const m of models) {
      expect(m.supportedOperations).toEqual(['text-to-image', 'image-to-image', 'multi-reference']);
      expect(m.paramSchema).toBe(IMAGE_DIALECT_DEFAULTS['byteplus-seedream'].paramSchema);
    }
  });
});

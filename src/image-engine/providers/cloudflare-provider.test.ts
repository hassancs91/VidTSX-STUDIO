import { describe, expect, it, afterEach, vi } from 'vitest';
import { CloudflareImageProvider } from './cloudflare-provider';
import { ImageEngineError } from '../types';

const RED_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubJsonFetch(payload: unknown, status = 200) {
  const impl = vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', impl);
  return impl;
}

function stubBinaryFetch(bytes: Buffer, contentType: string) {
  const impl = vi.fn(async () =>
    new Response(new Uint8Array(bytes), {
      status: 200,
      headers: { 'content-type': contentType },
    }),
  );
  vi.stubGlobal('fetch', impl);
  return impl;
}

function makeProvider(defaultModel = '@cf/black-forest-labs/flux-1-schnell') {
  return new CloudflareImageProvider('cloudflare', 'test-token', 'acct-123', defaultModel);
}

describe('CloudflareImageProvider.generate', () => {
  it('sends a JSON prompt-only body for flux-1-schnell and normalizes the base64 JSON response', async () => {
    const impl = stubJsonFetch({ result: { image: RED_PIXEL_PNG_BASE64 }, success: true });
    const result = await makeProvider().generate({
      operation: 'text-to-image',
      prompt: 'a red circle',
      width: 256,
      height: 256,
    });

    expect(impl).toHaveBeenCalledTimes(1);
    const [url, init] = impl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acct-123/ai/run/@cf/black-forest-labs/flux-1-schnell',
    );
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    // flux-1-schnell has no size parameters — prompt only.
    expect(JSON.parse(init.body as string)).toEqual({ prompt: 'a red circle' });

    expect(result.images).toHaveLength(1);
    expect(result.images[0].base64).toBe(RED_PIXEL_PNG_BASE64);
    expect(result.images[0].contentType).toBe('image/png');
    expect(result.model).toBe('@cf/black-forest-labs/flux-1-schnell');
  });

  it('base64-encodes raw binary responses (SDXL dialect) and sends clamped dimensions', async () => {
    const bytes = Buffer.from('fake-png-bytes');
    const impl = stubBinaryFetch(bytes, 'image/png');
    const provider = makeProvider('@cf/bytedance/stable-diffusion-xl-lightning');
    const result = await provider.generate({
      operation: 'text-to-image',
      prompt: 'a red circle',
      width: 4096,
      height: 100,
    });

    const [, init] = impl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ prompt: 'a red circle', width: 2048, height: 256 });
    expect(result.images[0].base64).toBe(bytes.toString('base64'));
    expect(result.images[0].contentType).toBe('image/png');
  });

  it('sends multipart form data with input_image_N fields for flux-2-dev multi-reference', async () => {
    const impl = stubJsonFetch({ result: { image: RED_PIXEL_PNG_BASE64 }, success: true });
    const provider = makeProvider('@cf/black-forest-labs/flux-2-dev');
    await provider.generate({
      operation: 'multi-reference',
      prompt: 'combine these',
      referenceImages: [RED_PIXEL_PNG_BASE64, RED_PIXEL_PNG_BASE64],
      width: 1024,
      height: 1024,
    });

    const [, init] = impl.mock.calls[0] as unknown as [string, RequestInit];
    const form = init.body as FormData;
    expect(form.get('prompt')).toBe('combine these');
    expect(form.get('width')).toBe('1024');
    expect(form.get('height')).toBe('1024');
    expect(form.get('input_image_0')).toBeInstanceOf(Blob);
    expect(form.get('input_image_1')).toBeInstanceOf(Blob);
    // multipart body → fetch sets the boundary; no manual Content-Type header
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('maps 429 to the daily-free-tier-exhausted message', async () => {
    stubJsonFetch({ success: false, errors: [{ code: 3040, message: 'neuron limit reached' }] }, 429);
    await expect(
      makeProvider().generate({ operation: 'text-to-image', prompt: 'x' }),
    ).rejects.toThrow(/daily free tier exhausted/i);
  });

  it('rejects operations the model does not support', async () => {
    stubJsonFetch({ result: { image: RED_PIXEL_PNG_BASE64 }, success: true });
    await expect(
      makeProvider().generate({
        operation: 'image-to-image',
        prompt: 'x',
        sourceImage: RED_PIXEL_PNG_BASE64,
      }),
    ).rejects.toThrow(ImageEngineError);
  });

  it('runs one request per requested image', async () => {
    const impl = stubJsonFetch({ result: { image: RED_PIXEL_PNG_BASE64 }, success: true });
    const result = await makeProvider().generate({
      operation: 'text-to-image',
      prompt: 'x',
      numImages: 3,
    });
    expect(impl).toHaveBeenCalledTimes(3);
    expect(result.images).toHaveLength(3);
  });
});

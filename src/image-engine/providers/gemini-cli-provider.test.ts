import { describe, expect, it, vi } from 'vitest';
import {
  GeminiCliImageProvider,
  nearestAgyAspect,
  jpegDimensions,
  type AgyCliBridge,
  type AgyCliStatus,
} from './gemini-cli-provider';
import { ImageEngineError } from '../types';

/** Minimal JPEG: SOI + SOF0 declaring 640×480 + EOI. Enough for the SOF parser. */
function tinyJpeg(width = 640, height = 480): Buffer {
  const sof = Buffer.alloc(19);
  sof[0] = 0xff;
  sof[1] = 0xc0;
  sof.writeUInt16BE(17, 2); // segment length
  sof[4] = 8; // precision
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = 3; // components (bytes 10..18 stay zero — parser doesn't read them)
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

const READY: AgyCliStatus = {
  installed: true,
  authenticated: true,
  binaryPath: 'C:\\fake\\agy.exe',
  probedAt: 1,
};

function makeBridge(status: AgyCliStatus = READY): AgyCliBridge & {
  generateImage: ReturnType<typeof vi.fn>;
} {
  return {
    getCachedStatus: vi.fn(() => status),
    ensureProbed: vi.fn(async () => status),
    generateImage: vi.fn(async () => ({ image: tinyJpeg(), conversationId: 'conv-1' })),
  };
}

describe('nearestAgyAspect', () => {
  it('buckets common pixel sizes onto the supported aspect set', () => {
    expect(nearestAgyAspect(1920, 1080)).toBe('16:9');
    expect(nearestAgyAspect(1080, 1920)).toBe('9:16');
    expect(nearestAgyAspect(1024, 1024)).toBe('1:1');
    expect(nearestAgyAspect(1080, 1350)).toBe('4:5'); // Instagram portrait
    expect(nearestAgyAspect(1200, 800)).toBe('3:2');
    expect(nearestAgyAspect(1000, 800)).toBe('4:3'); // 1.25 → nearest is 4:3
  });

  it('defaults to 1:1 without dimensions', () => {
    expect(nearestAgyAspect()).toBe('1:1');
    expect(nearestAgyAspect(1024, undefined)).toBe('1:1');
  });
});

describe('jpegDimensions', () => {
  it('reads width/height from the SOF marker', () => {
    expect(jpegDimensions(tinyJpeg(864, 1184))).toEqual({ width: 864, height: 1184 });
  });

  it('skips leading APP segments (JFIF layout)', () => {
    const app0 = Buffer.alloc(18);
    app0[0] = 0xff;
    app0[1] = 0xe0;
    app0.writeUInt16BE(16, 2);
    const jpeg = tinyJpeg(320, 200);
    const withApp = Buffer.concat([jpeg.subarray(0, 2), app0, jpeg.subarray(2)]);
    expect(jpegDimensions(withApp)).toEqual({ width: 320, height: 200 });
  });

  it('returns null for non-JPEG data', () => {
    expect(jpegDimensions(Buffer.from('iVBORnotajpeg'))).toBeNull();
    expect(jpegDimensions(Buffer.alloc(0))).toBeNull();
  });
});

describe('GeminiCliImageProvider.getSupportedModels', () => {
  it('reports zero models until the CLI is detected and authenticated', () => {
    const noProbe = makeBridge();
    (noProbe.getCachedStatus as ReturnType<typeof vi.fn>).mockReturnValue(null);
    expect(new GeminiCliImageProvider('gemini-cli', noProbe).getSupportedModels()).toEqual([]);

    const unauthed = makeBridge({ ...READY, authenticated: false });
    expect(new GeminiCliImageProvider('gemini-cli', unauthed).getSupportedModels()).toEqual([]);
  });

  it('offers exactly Nano Banana 2 with text-to-image + multi-reference when ready', () => {
    const models = new GeminiCliImageProvider('gemini-cli', makeBridge()).getSupportedModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('nano-banana-2');
    expect(models[0].supportedOperations).toEqual(['text-to-image', 'multi-reference']);
  });
});

describe('GeminiCliImageProvider.generate', () => {
  it('generates via the bridge, bucketing dimensions to an agy aspect', async () => {
    const bridge = makeBridge();
    const provider = new GeminiCliImageProvider('gemini-cli', bridge);
    const result = await provider.generate({
      operation: 'text-to-image',
      prompt: 'a red bicycle',
      width: 1920,
      height: 1080,
    });

    expect(bridge.generateImage).toHaveBeenCalledTimes(1);
    expect(bridge.generateImage.mock.calls[0][0]).toMatchObject({
      prompt: 'a red bicycle',
      aspect: '16:9',
    });
    expect(result.images).toHaveLength(1);
    // Actual JPEG dims win over the requested pixel size.
    expect(result.images[0].width).toBe(640);
    expect(result.images[0].height).toBe(480);
    expect(result.images[0].contentType).toBe('image/jpeg');
    expect(result.model).toBe('nano-banana-2');
    expect(result.provider).toBe('gemini-cli');
  });

  it('loops sequentially for numImages > 1', async () => {
    const bridge = makeBridge();
    const provider = new GeminiCliImageProvider('gemini-cli', bridge);
    const result = await provider.generate({
      operation: 'text-to-image',
      prompt: 'p',
      numImages: 3,
    });
    expect(bridge.generateImage).toHaveBeenCalledTimes(3);
    expect(result.images).toHaveLength(3);
  });

  it('rejects a 4th reference image with the fold-into-prompt message', async () => {
    const bridge = makeBridge();
    const provider = new GeminiCliImageProvider('gemini-cli', bridge);
    const refs = Array.from({ length: 4 }, () => tinyJpeg().toString('base64'));
    await expect(
      provider.generate({ operation: 'multi-reference', prompt: 'p', referenceImages: refs }),
    ).rejects.toThrow(/at most 3 reference images.*fold/i);
    expect(bridge.generateImage).not.toHaveBeenCalled();
  });

  it('stages reference images as files and hands their paths to the bridge', async () => {
    const bridge = makeBridge();
    const provider = new GeminiCliImageProvider('gemini-cli', bridge);
    const refs = [tinyJpeg().toString('base64'), tinyJpeg().toString('base64')];
    await provider.generate({ operation: 'multi-reference', prompt: 'p', referenceImages: refs });
    const request = bridge.generateImage.mock.calls[0][0] as { referencePaths?: string[] };
    expect(request.referencePaths).toHaveLength(2);
    // Base64 sniffed as JPEG → .jpg staging files.
    expect(request.referencePaths?.[0]).toMatch(/ref-1\.jpg$/);
  });

  it('requires at least one reference for multi-reference', async () => {
    const provider = new GeminiCliImageProvider('gemini-cli', makeBridge());
    await expect(
      provider.generate({ operation: 'multi-reference', prompt: 'p', referenceImages: [] }),
    ).rejects.toThrow(/at least one reference/i);
  });

  it('rejects image-to-image with a pointer to references', async () => {
    const provider = new GeminiCliImageProvider('gemini-cli', makeBridge());
    await expect(
      provider.generate({ operation: 'image-to-image', prompt: 'p', sourceImage: 'abc' }),
    ).rejects.toThrow(/reference/i);
  });

  it('fails with a setup pointer when the CLI is not installed', async () => {
    const bridge = makeBridge({ ...READY, installed: false, authenticated: false });
    const provider = new GeminiCliImageProvider('gemini-cli', bridge);
    await expect(
      provider.generate({ operation: 'text-to-image', prompt: 'p' }),
    ).rejects.toThrow(/not installed/i);
  });

  it('fails with a sign-in pointer when installed but unauthenticated', async () => {
    const bridge = makeBridge({ ...READY, authenticated: false });
    const provider = new GeminiCliImageProvider('gemini-cli', bridge);
    await expect(
      provider.generate({ operation: 'text-to-image', prompt: 'p' }),
    ).rejects.toThrow(/not signed in/i);
  });

  it('wraps bridge failures in ImageEngineError', async () => {
    const bridge = makeBridge();
    bridge.generateImage.mockRejectedValue(new Error('agy timed out after 300s'));
    const provider = new GeminiCliImageProvider('gemini-cli', bridge);
    await expect(
      provider.generate({ operation: 'text-to-image', prompt: 'p' }),
    ).rejects.toBeInstanceOf(ImageEngineError);
  });
});

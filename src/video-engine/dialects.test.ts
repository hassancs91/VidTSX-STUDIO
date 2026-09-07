import { describe, it, expect } from 'vitest';
import { buildVideoPayload, mediaToUrl, VIDEO_DIALECTS } from './dialects';
import { deriveVideoRoutes, hydrateVideoEntry } from './dialect-capabilities';
import {
  VIDEO_DIALECT_IDS,
  VIDEO_MODEL_CATALOG,
  getVideoModel,
} from '../shared/presets/video-models';
import type { VideoModelCatalogEntry } from '../shared/presets/video-models';
import type { VideoProviderRequest } from './types';

const PNG = 'iVBORw0KGgo=';
const JPEG = '/9j/4AAQ';

function request(overrides: Partial<VideoProviderRequest> = {}): VideoProviderRequest {
  return {
    model: 'x',
    prompt: 'a calm lake at dawn',
    durationSeconds: 5,
    aspectRatio: '16:9',
    generateAudio: false,
    ...overrides,
  };
}

function entry(id: string): VideoModelCatalogEntry {
  const found = getVideoModel(id);
  if (!found) throw new Error(`catalog entry ${id} missing`);
  return found;
}

describe('video dialect table', () => {
  it('implements every dialect id the catalog can name', () => {
    for (const id of VIDEO_DIALECT_IDS) expect(typeof VIDEO_DIALECTS[id]).toBe('function');
    for (const model of VIDEO_MODEL_CATALOG) expect(VIDEO_DIALECT_IDS).toContain(model.dialect);
  });

  it('mediaToUrl passes URLs and data URIs through and wraps base64 with a detected type', () => {
    expect(mediaToUrl({ kind: 'url', value: 'https://x/y.png' })).toBe('https://x/y.png');
    expect(mediaToUrl({ kind: 'base64', value: 'data:image/png;base64,AAAA' })).toBe('data:image/png;base64,AAAA');
    expect(mediaToUrl({ kind: 'base64', value: JPEG })).toBe(`data:image/jpeg;base64,${JPEG}`);
    expect(mediaToUrl({ kind: 'base64', value: PNG, contentType: 'image/webp' })).toBe(`data:image/webp;base64,${PNG}`);
  });
});

describe('fal-kling-2.5', () => {
  it('text-to-video: duration as a string, aspect ratio, nothing else', () => {
    const { endpoint, body } = buildVideoPayload(entry('kling-2.5-turbo-pro'), request({ seed: 7 }));
    expect(endpoint).toBe('fal-ai/kling-video/v2.5-turbo/pro/text-to-video');
    expect(body).toEqual({ prompt: 'a calm lake at dawn', duration: '5', aspect_ratio: '16:9' });
  });

  it('image-to-video: image_url + tail_image_url as data URIs', () => {
    const { endpoint, body } = buildVideoPayload(
      entry('kling-2.5-turbo-pro'),
      request({ durationSeconds: 10, firstFrame: { kind: 'base64', value: PNG }, lastFrame: { kind: 'url', value: 'https://x/last.png' } }),
    );
    expect(endpoint).toBe('fal-ai/kling-video/v2.5-turbo/pro/image-to-video');
    expect(body).toEqual({
      prompt: 'a calm lake at dawn',
      duration: '10',
      aspect_ratio: '16:9',
      image_url: `data:image/png;base64,${PNG}`,
      tail_image_url: 'https://x/last.png',
    });
  });
});

describe('fal-veo-3', () => {
  it('duration with an s suffix, generate_audio, seed, image_url (no tail)', () => {
    const { endpoint, body } = buildVideoPayload(
      entry('veo-3-fast'),
      request({ durationSeconds: 8, aspectRatio: '9:16', generateAudio: true, seed: 42, firstFrame: { kind: 'base64', value: JPEG }, lastFrame: { kind: 'base64', value: PNG } }),
    );
    expect(endpoint).toBe('fal-ai/veo3/fast/image-to-video');
    expect(body).toEqual({
      prompt: 'a calm lake at dawn',
      duration: '8s',
      aspect_ratio: '9:16',
      generate_audio: true,
      seed: 42,
      image_url: `data:image/jpeg;base64,${JPEG}`,
    });
  });
});

describe('fal-wan-2.5', () => {
  it('fixed 720p resolution and enable_audio only when audio is off', () => {
    const off = buildVideoPayload(entry('wan-2.5'), request({ resolution: '720p' }));
    expect(off.endpoint).toBe('fal-ai/wan-25-preview/text-to-video');
    expect(off.body).toEqual({ prompt: 'a calm lake at dawn', duration: '5', aspect_ratio: '16:9', resolution: '720p', enable_audio: false });

    const on = buildVideoPayload(entry('wan-2.5'), request({ generateAudio: true, seed: 3 }));
    expect(on.body).toEqual({ prompt: 'a calm lake at dawn', duration: '5', aspect_ratio: '16:9', resolution: '720p', seed: 3 });
  });
});

describe('fal-hailuo-02', () => {
  it('prompt + duration only, image_url when a first frame is given', () => {
    const t2v = buildVideoPayload(entry('hailuo-02'), request({ durationSeconds: 6, seed: 1 }));
    expect(t2v.endpoint).toBe('fal-ai/minimax/hailuo-02/standard/text-to-video');
    expect(t2v.body).toEqual({ prompt: 'a calm lake at dawn', duration: '6' });

    const i2v = buildVideoPayload(entry('hailuo-02'), request({ durationSeconds: 6, firstFrame: { kind: 'base64', value: PNG } }));
    expect(i2v.endpoint).toBe('fal-ai/minimax/hailuo-02/standard/image-to-video');
    expect(i2v.body).toEqual({ prompt: 'a calm lake at dawn', duration: '6', image_url: `data:image/png;base64,${PNG}` });
  });
});

describe('fal-seedance-1', () => {
  it('resolution, seed, and end_image_url for the last frame', () => {
    const { endpoint, body } = buildVideoPayload(
      entry('seedance-1-lite'),
      request({ aspectRatio: '21:9', resolution: '720p', seed: 9, firstFrame: { kind: 'base64', value: PNG }, lastFrame: { kind: 'base64', value: JPEG } }),
    );
    expect(endpoint).toBe('fal-ai/bytedance/seedance/v1/lite/image-to-video');
    expect(body).toEqual({
      prompt: 'a calm lake at dawn',
      duration: '5',
      aspect_ratio: '21:9',
      resolution: '720p',
      seed: 9,
      image_url: `data:image/png;base64,${PNG}`,
      end_image_url: `data:image/jpeg;base64,${JPEG}`,
    });
  });
});

describe('fal-generic', () => {
  it('sends the common denominator for an unknown family', () => {
    const custom: VideoModelCatalogEntry = {
      id: 'custom',
      name: 'Custom',
      tagline: '',
      dialect: 'fal-generic',
      textToVideoEndpoint: 'fal-ai/custom/text-to-video',
      supportsLastFrame: false,
      supportsAudio: false,
      allowedDurations: [5],
      allowedAspectRatios: ['16:9'],
    };
    const { endpoint, body } = buildVideoPayload(custom, request({ seed: 5, firstFrame: { kind: 'base64', value: PNG } }));
    // No image-to-video endpoint → text-to-video, but the frame still rides along.
    expect(endpoint).toBe('fal-ai/custom/text-to-video');
    expect(body).toEqual({ prompt: 'a calm lake at dawn', duration: '5', aspect_ratio: '16:9', image_url: `data:image/png;base64,${PNG}` });
  });
});

describe('fal-seedance-2', () => {
  it('text-to-video: one schema with duration, aspect, resolution and audio', () => {
    const { endpoint, body } = buildVideoPayload(
      entry('seedance-2.5'),
      request({ durationSeconds: 12, generateAudio: true, resolution: '1080p' }),
    );
    expect(endpoint).toBe('bytedance/seedance-2.5/text-to-video');
    expect(body).toEqual({
      prompt: 'a calm lake at dawn',
      duration: '12',
      aspect_ratio: '16:9',
      resolution: '1080p',
      generate_audio: true,
    });
  });

  it('image-to-video: frames go inline and the ratio follows the first frame', () => {
    const { endpoint, body } = buildVideoPayload(
      entry('seedance-2.0'),
      request({
        firstFrame: { kind: 'base64', value: PNG },
        lastFrame: { kind: 'url', value: 'https://x/last.png' },
      }),
    );
    expect(endpoint).toBe('bytedance/seedance-2.0/image-to-video');
    expect(body.aspect_ratio).toBe('auto');
    expect(body.image_url).toBe(`data:image/png;base64,${PNG}`);
    expect(body.end_image_url).toBe('https://x/last.png');
  });

  it('reference-to-video wins over frames and sends URL lists', () => {
    const { endpoint, body } = buildVideoPayload(
      entry('seedance-2.5'),
      request({
        referenceImages: [{ kind: 'url', value: 'https://x/1.png' }],
        referenceVideos: [{ kind: 'url', value: 'https://x/1.mp4' }],
        referenceAudios: [{ kind: 'url', value: 'https://x/1.mp3' }],
      }),
    );
    expect(endpoint).toBe('bytedance/seedance-2.5/reference-to-video');
    expect(body.image_urls).toEqual(['https://x/1.png']);
    expect(body.video_urls).toEqual(['https://x/1.mp4']);
    expect(body.audio_urls).toEqual(['https://x/1.mp3']);
    expect(body.image_url).toBeUndefined();
  });

  it('sends no seed — the family takes none', () => {
    const { body } = buildVideoPayload(entry('seedance-2.5'), request({ seed: 7 }));
    expect(body.seed).toBeUndefined();
  });
});

describe('byteplus-seedance', () => {
  it('text-to-video: one content array, the model id as the route', () => {
    const model = entry('dreamina-seedance-2-5-260628');
    const { endpoint, body } = buildVideoPayload(
      model,
      request({ durationSeconds: 8, generateAudio: true, resolution: '720p' }),
    );
    expect(endpoint).toBe('dreamina-seedance-2-5-260628');
    expect(body).toEqual({
      model: 'dreamina-seedance-2-5-260628',
      content: [{ type: 'text', text: 'a calm lake at dawn' }],
      ratio: '16:9',
      duration: 8,
      generate_audio: true,
      watermark: false,
      resolution: '720p',
    });
  });

  it('image-to-video: roles on the frames, and an adaptive ratio', () => {
    const { body } = buildVideoPayload(
      entry('dreamina-seedance-2-0-260128'),
      request({
        firstFrame: { kind: 'base64', value: PNG },
        lastFrame: { kind: 'url', value: 'https://x/last.png' },
      }),
    );
    expect(body.ratio).toBe('adaptive');
    expect(body.content).toEqual([
      { type: 'text', text: 'a calm lake at dawn' },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${PNG}` }, role: 'first_frame' },
      { type: 'image_url', image_url: { url: 'https://x/last.png' }, role: 'last_frame' },
    ]);
  });

  it('reference-to-video: one item per reference, each with its role', () => {
    const { body } = buildVideoPayload(
      entry('dreamina-seedance-2-5-260628'),
      request({
        firstFrame: { kind: 'base64', value: PNG },
        referenceImages: [{ kind: 'url', value: 'https://x/1.png' }],
        referenceVideos: [{ kind: 'url', value: 'https://x/1.mp4' }],
        referenceAudios: [{ kind: 'url', value: 'https://x/1.mp3' }],
      }),
    );
    expect(body.content).toEqual([
      { type: 'text', text: 'a calm lake at dawn' },
      { type: 'image_url', image_url: { url: 'https://x/1.png' }, role: 'reference_image' },
      { type: 'video_url', video_url: { url: 'https://x/1.mp4' }, role: 'reference_video' },
      { type: 'audio_url', audio_url: { url: 'https://x/1.mp3' }, role: 'reference_audio' },
    ]);
  });
});

describe('catalog hydration', () => {
  it('derives sibling routes from a slug that names one', () => {
    expect(deriveVideoRoutes('bytedance/seedance-2.5/text-to-video', 'fal-seedance-2')).toEqual({
      textToVideoEndpoint: 'bytedance/seedance-2.5/text-to-video',
      imageToVideoEndpoint: 'bytedance/seedance-2.5/image-to-video',
      referenceToVideoEndpoint: 'bytedance/seedance-2.5/reference-to-video',
    });
  });

  it('treats a slug with no route as the whole app (Veo)', () => {
    expect(deriveVideoRoutes('fal-ai/veo3.1/fast', 'fal-veo-3')).toEqual({
      textToVideoEndpoint: 'fal-ai/veo3.1/fast',
      imageToVideoEndpoint: 'fal-ai/veo3.1/fast/image-to-video',
    });
  });

  it('gives a hand-added slug its family capabilities, and a known id its own', () => {
    const added = hydrateVideoEntry({ id: 'bytedance/seedance-9.9/text-to-video', dialect: 'fal-seedance-2' });
    expect(added.supportsAudio).toBe(true);
    expect(added.references).toEqual({ images: 9, videos: 3, audios: 3 });
    expect(added.name).toBe('bytedance/seedance-9.9/text-to-video');

    const known = hydrateVideoEntry({ id: 'seedance-2.5', dialect: 'fal-seedance-2', name: 'Renamed' });
    expect(known.name).toBe('Renamed');
    expect(known.references).toEqual({ images: 30, videos: 10, audios: 10 });
    expect(known.durationRange).toEqual({ min: 4, max: 30, auto: true });
  });

  it('routes every BytePlus task type through the one model id', () => {
    expect(deriveVideoRoutes('dreamina-seedance-2-5-260628', 'byteplus-seedance')).toEqual({
      textToVideoEndpoint: 'dreamina-seedance-2-5-260628',
      imageToVideoEndpoint: 'dreamina-seedance-2-5-260628',
      referenceToVideoEndpoint: 'dreamina-seedance-2-5-260628',
    });
  });
});

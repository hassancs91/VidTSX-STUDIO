// The clamp between a caller's request and what a model takes, for the Kling
// families the interior staging flow leans on: a last frame survives only on a
// model that takes one, durations snap to the model's range or list, and a
// model with resolutions always gets one.

import { describe, it, expect } from 'vitest';
import { normalizeVideoRequest, type ResolvedMedia } from './normalize';
import { toVideoModelInfo } from './model-info';
import { getVideoModel } from '../shared/presets/video-models';
import type { VideoGenerationRequest } from './types';

const FIRST = { kind: 'url' as const, value: 'https://x/first.png' };
const LAST = { kind: 'url' as const, value: 'https://x/last.png' };
const FRAMES: ResolvedMedia = { firstFrame: FIRST, lastFrame: LAST, referenceImages: [], referenceVideos: [], referenceAudios: [] };

function normalize(id: string, overrides: Partial<VideoGenerationRequest> = {}) {
  const entry = getVideoModel(id);
  if (!entry) throw new Error(`no catalog entry for ${id}`);
  return normalizeVideoRequest(toVideoModelInfo(entry), { model: id, prompt: 'p', ...overrides }, FRAMES);
}

describe('normalizeVideoRequest — Kling', () => {
  it('Kling 3 keeps the last frame, any whole second from 3 to 15, and audio off', () => {
    const req = normalize('kling-3-pro', { durationSeconds: 6, aspectRatio: '9:16', generateAudio: false });
    expect(req).toMatchObject({ durationSeconds: 6, aspectRatio: '9:16', generateAudio: false, firstFrame: FIRST, lastFrame: LAST });
    expect(req.resolution).toBeUndefined();
    expect(normalize('kling-3-standard', { durationSeconds: 2 }).durationSeconds).toBe(3);
    expect(normalize('kling-3-pro', { durationSeconds: 20 }).durationSeconds).toBe(15);
  });

  it('Kling 4 runs to 30 s, takes no audio, and defaults to 720p', () => {
    expect(normalize('kling-4', { durationSeconds: 40, generateAudio: true })).toMatchObject({
      durationSeconds: 30,
      generateAudio: false,
      resolution: '720p',
      lastFrame: LAST,
    });
    expect(normalize('kling-4', { resolution: '1080p' }).resolution).toBe('1080p');
  });

  it('Kling 2.5 Turbo snaps 6 s to 5 s — it takes only 5 or 10', () => {
    expect(normalize('kling-2.5-turbo-pro', { durationSeconds: 6 })).toMatchObject({ durationSeconds: 5, lastFrame: LAST });
  });

  it('a model without a last frame drops it silently', () => {
    const req = normalize('veo-3.1-fast', { durationSeconds: 6 });
    expect(req.firstFrame).toEqual(FIRST);
    expect(req.lastFrame).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { budgetHint, buildJobRequest, type ComposerBuildInput } from './build-job-request';

// The composer → `build` job: the format the user fixed (Auto = no frame
// count), the loop flag only when on, brand and images only when given.

const input = (over: Partial<ComposerBuildInput> = {}): ComposerBuildInput => ({
  prompt: '  a ball bounces  ',
  providerId: 'claude-subscription',
  model: '',
  aspectRatio: '4:5',
  fps: 30,
  duration: 8,
  autoDuration: true,
  loop: false,
  budget: 'standard',
  referenceImages: [],
  ...over,
});

describe('buildJobRequest', () => {
  it('builds with Auto length: no frame count, the provider default model', () => {
    expect(buildJobRequest(input())).toEqual({
      kind: 'build',
      prompt: 'a ball bounces',
      providerId: 'claude-subscription',
      build: { format: { width: 1080, height: 1350, fps: 30 }, budget: 'standard' },
    });
  });

  it('turns a fixed length into frames, and carries loop, model, brand and images', () => {
    const image = { data: 'abc', mediaType: 'image/png' } as unknown as ComposerBuildInput['referenceImages'][number];
    const request = buildJobRequest(input({
      aspectRatio: '16:9', fps: 25, duration: 7, autoDuration: false, loop: true,
      model: 'claude-sonnet-5-5', budget: 'quick', brand: 'Colours: navy', referenceImages: [image],
    }));
    expect(request).toEqual({
      kind: 'build',
      prompt: 'a ball bounces',
      providerId: 'claude-subscription',
      options: { model: 'claude-sonnet-5-5' },
      build: {
        format: { width: 1920, height: 1080, fps: 25, durationInFrames: 175, loop: true },
        budget: 'quick',
        brand: 'Colours: navy',
        referenceImages: [image],
      },
    });
  });

  it('refuses an empty prompt or no provider', () => {
    expect(buildJobRequest(input({ prompt: '   ' }))).toBeNull();
    expect(buildJobRequest(input({ providerId: '' }))).toBeNull();
  });
});

describe('budgetHint', () => {
  it('reads the builder budgets', () => {
    expect(budgetHint('quick')).toBe('1 look · stops at 15 min');
    expect(budgetHint('standard')).toBe('up to 3 looks · stops at 30 min');
    expect(budgetHint('craft')).toBe('up to 6 looks · stops at 60 min');
  });
});

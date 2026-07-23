import { describe, expect, it } from 'vitest';
import { adaptPrompt, LTX_DEFAULT_NEGATIVE, WAN_DEFAULT_NEGATIVE } from './prompt-adapter';

describe('adaptPrompt', () => {
  it('wraps a plain lingbot prompt into the JSON caption structure', () => {
    const { prompt } = adaptPrompt('lingbot', 'a lovely cat');
    const parsed = JSON.parse(prompt);
    expect(parsed.caption.comprehensive_description).toBe('a lovely cat');
    expect(parsed.caption.world_knowledge).toEqual([]);
    expect(parsed.caption.prominent_elements).toEqual([]);
  });

  it('passes an already-JSON lingbot prompt through untouched', () => {
    const raw = '{"caption":{"comprehensive_description":"custom"}}';
    const { prompt } = adaptPrompt('lingbot', raw);
    expect(prompt).toBe(raw);
  });

  it('always produces a lingbot universal_negative (default terms when empty)', () => {
    const { negativePrompt } = adaptPrompt('lingbot', 'a cat');
    const parsed = JSON.parse(negativePrompt!);
    expect(parsed.universal_negative.visual_quality).toContain('low quality');
  });

  it('splits a plain lingbot negative into visual_quality terms', () => {
    const { negativePrompt } = adaptPrompt('lingbot', 'a cat', 'blurry, watermark');
    const parsed = JSON.parse(negativePrompt!);
    expect(parsed.universal_negative.visual_quality).toEqual(['blurry', 'watermark']);
  });

  it('escapes quotes safely in lingbot prompts (valid JSON out)', () => {
    const { prompt } = adaptPrompt('lingbot', 'a "quoted" cat, 100% cute');
    expect(JSON.parse(prompt).caption.comprehensive_description).toBe('a "quoted" cat, 100% cute');
  });

  it.each(['wan21', 'wan22'] as const)('%s gets the canonical Wan negative by default', (family) => {
    const adapted = adaptPrompt(family, 'a cat');
    expect(adapted.prompt).toBe('a cat');
    expect(adapted.negativePrompt).toBe(WAN_DEFAULT_NEGATIVE);
  });

  it('a user-provided wan negative wins over the default', () => {
    const adapted = adaptPrompt('wan21', 'a cat', 'blurry');
    expect(adapted.negativePrompt).toBe('blurry');
  });

  it('ltx gets the doc-recommended default negative', () => {
    const adapted = adaptPrompt('ltx', 'a cat');
    expect(adapted.prompt).toBe('a cat');
    expect(adapted.negativePrompt).toBe(LTX_DEFAULT_NEGATIVE);
  });
});

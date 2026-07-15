import { describe, expect, it } from 'vitest';
import { buildArgs } from './sd-cli-runner';
import type { ResolvedSdModel, SdGenerationRequest } from './types';

function resolved(overrides: Partial<ResolvedSdModel> = {}): ResolvedSdModel {
  return {
    modelId: 'm',
    modelFilePath: '/models/m.gguf',
    family: 'sd15',
    defaults: { width: 512, height: 512, steps: 20, cfgScale: 7, sampler: 'euler_a' },
    capabilities: { txt2img: true, img2img: true, reference: false },
    companionPaths: {},
    ...overrides,
  };
}

function req(overrides: Partial<SdGenerationRequest> = {}): SdGenerationRequest {
  return { operation: 'txt2img', prompt: 'a cat', ...overrides };
}

/** Value following a flag in the arg array. */
function valAfter(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

describe('buildArgs', () => {
  it('sd15 uses -m with no companion flags', () => {
    const args = buildArgs(resolved(), req(), '/out.png');
    expect(args).toContain('-m');
    expect(args).not.toContain('--diffusion-model');
    expect(valAfter(args, '-m')).toBe('/models/m.gguf');
    expect(valAfter(args, '-p')).toBe('a cat');
    expect(valAfter(args, '-o')).toBe('/out.png');
    expect(args).not.toContain('--clip_l');
    expect(args).not.toContain('--llm');
  });

  it('flux1 uses --diffusion-model + --clip_l/--t5xxl/--vae', () => {
    const args = buildArgs(
      resolved({
        family: 'flux1',
        useDiffusionModelFlag: true,
        companionPaths: {
          clipL: '/c/clip_l.safetensors',
          t5xxl: '/c/t5xxl_fp16.safetensors',
          vae: '/c/ae.safetensors',
        },
      }),
      req(),
      '/o.png',
    );
    expect(args).toContain('--diffusion-model');
    expect(args).not.toContain('-m');
    expect(valAfter(args, '--diffusion-model')).toBe('/models/m.gguf');
    expect(valAfter(args, '--clip_l')).toBe('/c/clip_l.safetensors');
    expect(valAfter(args, '--t5xxl')).toBe('/c/t5xxl_fp16.safetensors');
    expect(valAfter(args, '--vae')).toBe('/c/ae.safetensors');
    expect(args).not.toContain('--llm');
  });

  it('flux2 uses --diffusion-model + --llm + --vae', () => {
    const args = buildArgs(
      resolved({
        family: 'flux2',
        useDiffusionModelFlag: true,
        companionPaths: { llm: '/c/qwen3-4b-q4_0.gguf', vae: '/c/flux2_ae.safetensors' },
      }),
      req(),
      '/o.png',
    );
    expect(args).toContain('--diffusion-model');
    expect(valAfter(args, '--llm')).toBe('/c/qwen3-4b-q4_0.gguf');
    expect(valAfter(args, '--vae')).toBe('/c/flux2_ae.safetensors');
    expect(args).not.toContain('--clip_l');
    expect(args).not.toContain('--t5xxl');
  });

  it('all-in-one flux1 uses -m and drops all companion flags', () => {
    const args = buildArgs(
      resolved({
        family: 'flux1',
        useDiffusionModelFlag: true,
        allInOne: true,
        companionPaths: { clipL: '/c/clip_l.safetensors', vae: '/c/ae.safetensors' },
      }),
      req(),
      '/o.png',
    );
    expect(args).toContain('-m');
    expect(args).not.toContain('--diffusion-model');
    expect(args).not.toContain('--clip_l');
    expect(args).not.toContain('--vae');
  });

  it('passes through seed, img2img, and lora options', () => {
    const args = buildArgs(
      resolved(),
      req({
        seed: 42,
        operation: 'img2img',
        sourceImagePath: '/in.png',
        strength: 0.5,
        loraPath: '/lora',
        loraMultiplier: 0.8,
      }),
      '/o.png',
    );
    expect(valAfter(args, '-s')).toBe('42');
    expect(valAfter(args, '-i')).toBe('/in.png');
    expect(valAfter(args, '--strength')).toBe('0.5');
    expect(valAfter(args, '--lora-model-dir')).toBe('/lora');
    expect(valAfter(args, '--lora-multiplier')).toBe('0.8');
  });

  it('honors request overrides for width/height/steps/sampler', () => {
    const args = buildArgs(resolved(), req({ width: 768, height: 1024, steps: 30, sampler: 'dpmpp_2m' }), '/o.png');
    expect(valAfter(args, '-W')).toBe('768');
    expect(valAfter(args, '-H')).toBe('1024');
    expect(valAfter(args, '--steps')).toBe('30');
    expect(valAfter(args, '--sampling-method')).toBe('dpmpp_2m');
  });

  it('a request vaePath overrides the resolved companion vae', () => {
    const args = buildArgs(
      resolved({
        family: 'flux1',
        useDiffusionModelFlag: true,
        companionPaths: { vae: '/c/ae.safetensors' },
      }),
      req({ vaePath: '/custom/vae.safetensors' }),
      '/o.png',
    );
    // request vaePath wins; the resolved companion vae is not also appended
    expect(valAfter(args, '--vae')).toBe('/custom/vae.safetensors');
    expect(args.filter((a) => a === '--vae')).toHaveLength(1);
  });
});

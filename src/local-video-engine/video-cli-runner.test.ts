import { describe, expect, it } from 'vitest';
import { buildVideoArgs } from './video-cli-runner';
import { WAN_DEFAULT_NEGATIVE } from './prompt-adapter';
import type { ResolvedVideoModel, VideoGenerationRequest } from './types';

const WAN_DEFAULTS = {
  width: 832, height: 480, frames: 33, fps: 16, steps: 20, cfgScale: 6.0, sampler: 'euler',
};

function wanModel(overrides: Partial<ResolvedVideoModel> = {}): ResolvedVideoModel {
  return {
    modelId: 'wan21-t2v-1.3b-q4',
    modelFilePath: 'C:\\models\\video\\Wan2.1-T2V-1.3B-Q4_0.gguf',
    family: 'wan21',
    defaults: WAN_DEFAULTS,
    capabilities: { t2v: true, i2v: false },
    useDiffusionModelFlag: true,
    companionPaths: {
      t5xxl: 'C:\\models\\video\\umt5-xxl-encoder-Q3_K_S.gguf',
      vae: 'C:\\models\\video\\wan_2.1_vae.safetensors',
    },
    ...overrides,
  };
}

function req(overrides: Partial<VideoGenerationRequest> = {}): VideoGenerationRequest {
  return { modelId: 'wan21-t2v-1.3b-q4', prompt: 'a lovely cat', ...overrides };
}

function argValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx === -1 ? undefined : args[idx + 1];
}

describe('buildVideoArgs', () => {
  it('builds a wan t2v invocation matching the sd.cpp docs', () => {
    const args = buildVideoArgs(wanModel(), req(), 'C:\\out\\v.webm');

    expect(argValue(args, '-M')).toBe('vid_gen');
    expect(argValue(args, '--diffusion-model')).toContain('Wan2.1-T2V-1.3B-Q4_0.gguf');
    expect(argValue(args, '-p')).toBe('a lovely cat');
    expect(argValue(args, '-W')).toBe('832');
    expect(argValue(args, '-H')).toBe('480');
    expect(argValue(args, '--video-frames')).toBe('33');
    expect(argValue(args, '--fps')).toBe('16');
    expect(argValue(args, '--cfg-scale')).toBe('6');
    expect(argValue(args, '--sampling-method')).toBe('euler');
    expect(argValue(args, '-o')).toBe('C:\\out\\v.webm');
    expect(argValue(args, '--t5xxl')).toContain('umt5');
    expect(argValue(args, '--vae')).toContain('wan_2.1_vae');
    expect(argValue(args, '--flow-shift')).toBe('3.0');
    expect(args).toContain('--diffusion-fa');
    // The canonical Wan negative is applied when none is given
    expect(argValue(args, '-n')).toBe(WAN_DEFAULT_NEGATIVE);
  });

  it('request overrides beat model defaults', () => {
    const args = buildVideoArgs(
      wanModel(),
      req({ width: 640, height: 352, frames: 17, fps: 8, steps: 10, cfgScale: 5, seed: 42 }),
      'o.webm',
    );
    expect(argValue(args, '-W')).toBe('640');
    expect(argValue(args, '-H')).toBe('352');
    expect(argValue(args, '--video-frames')).toBe('17');
    expect(argValue(args, '--fps')).toBe('8');
    expect(argValue(args, '--steps')).toBe('10');
    expect(argValue(args, '--cfg-scale')).toBe('5');
    expect(argValue(args, '-s')).toBe('42');
  });

  it('passes the init image for i2v and offload flag', () => {
    const model = wanModel({ capabilities: { t2v: false, i2v: true } });
    const args = buildVideoArgs(
      model,
      req({ initImagePath: 'C:\\in\\frame.png', offloadToCpu: true }),
      'o.webm',
    );
    expect(argValue(args, '-i')).toBe('C:\\in\\frame.png');
    expect(args).toContain('--offload-to-cpu');
  });

  it('maps the full LTX companion set to its flags', () => {
    const model = wanModel({
      family: 'ltx',
      companionPaths: {
        llm: 'gemma.gguf',
        vae: 'video_vae.safetensors',
        audioVae: 'audio_vae.safetensors',
        embeddings: 'connectors.safetensors',
      },
    });
    const args = buildVideoArgs(model, req(), 'o.webm');
    expect(argValue(args, '--llm')).toBe('gemma.gguf');
    expect(argValue(args, '--vae')).toBe('video_vae.safetensors');
    expect(argValue(args, '--audio-vae')).toBe('audio_vae.safetensors');
    expect(argValue(args, '--embeddings-connectors')).toBe('connectors.safetensors');
    // LTX is not a Wan flow model — no flow-shift pin
    expect(args).not.toContain('--flow-shift');
  });

  it('passes clip_vision for wan i2v models and JSON prompt for lingbot', () => {
    const i2v = wanModel({
      companionPaths: { t5xxl: 'umt5.gguf', vae: 'vae.safetensors', clipVision: 'clip_vision_h.safetensors' },
    });
    expect(argValue(buildVideoArgs(i2v, req(), 'o.webm'), '--clip_vision')).toBe('clip_vision_h.safetensors');

    const lingbot = wanModel({
      family: 'lingbot',
      companionPaths: { llm: 'qwen.gguf', vae: 'wan_2.1_vae.safetensors' },
    });
    const args = buildVideoArgs(lingbot, req(), 'o.webm');
    const prompt = argValue(args, '-p')!;
    expect(JSON.parse(prompt).caption.comprehensive_description).toBe('a lovely cat');
    const negative = argValue(args, '-n')!;
    expect(JSON.parse(negative).universal_negative.visual_quality.length).toBeGreaterThan(0);
  });
});

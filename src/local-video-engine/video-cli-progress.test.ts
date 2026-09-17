import { describe, expect, it } from 'vitest';
import type { ResolvedVideoModel } from './types';
import { buildVideoArgs, parseProgress } from './video-cli-runner';

const RESOLVED: ResolvedVideoModel = {
  modelId: 'wan21-t2v-1.3b-q4',
  modelFilePath: 'D:/models/video/Wan2.1-T2V-1.3B-Q4_0.gguf',
  family: 'wan21',
  defaults: { width: 832, height: 480, frames: 33, fps: 16, steps: 20, cfgScale: 6, sampler: 'euler' },
  capabilities: { t2v: true, i2v: false },
  useDiffusionModelFlag: true,
  companionPaths: { t5xxl: 'D:/models/video/umt5.gguf', vae: 'D:/models/video/vae.safetensors' },
};

describe('parseProgress', () => {
  it('reads sampling steps from the s/it bar and ignores the tensor loader bar (GB/s)', () => {
    expect(parseProgress('  |=====>                | 5/20 - 3.20s/it', 'r')).toEqual({ requestId: 'r', step: 5, totalSteps: 20, percent: 25 });
    expect(parseProgress('  |##################| 242/242 - 668.30MB/s', 'r')).toBeNull();
    expect(parseProgress('[DEBUG] model_loader.cpp:1034 - loading 242/242 tensors from x.gguf', 'r')).toBeNull();
  });

  it('accepts the explicit "step n/m" form and rejects a zero total', () => {
    expect(parseProgress('step 20/20 done', 'r')).toEqual({ requestId: 'r', step: 20, totalSteps: 20, percent: 100 });
    expect(parseProgress('0/0 - 1.0s/it', 'r')).toBeNull();
  });
});

describe('buildVideoArgs CPU placement flags', () => {
  it('passes --offload-to-cpu, --clip-on-cpu and --vae-on-cpu only when asked', () => {
    const base = buildVideoArgs(RESOLVED, { modelId: RESOLVED.modelId, prompt: 'p' }, 'out.webm');
    expect(base).not.toContain('--offload-to-cpu');
    expect(base).not.toContain('--clip-on-cpu');
    expect(base).not.toContain('--vae-on-cpu');
    const cpu = buildVideoArgs(
      RESOLVED,
      { modelId: RESOLVED.modelId, prompt: 'p', offloadToCpu: true, clipOnCpu: true, vaeOnCpu: true },
      'out.webm',
    );
    expect(cpu).toEqual(expect.arrayContaining(['--offload-to-cpu', '--clip-on-cpu', '--vae-on-cpu']));
  });
});

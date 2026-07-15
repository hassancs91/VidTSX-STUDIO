import { describe, expect, it } from 'vitest';
import type { ScannedFile, SidecarFileV1 } from '@shared/model-library/types';
import {
  classifyFile,
  type ClassifierProfile,
  type ClassifyContext,
} from './classifier';

const PROFILES: ClassifierProfile[] = [
  { id: 'sd15', matchFileNames: ['v1-5-pruned-emaonly.safetensors', 'sd15.gguf'] },
  { id: 'sdxl', matchFileNames: ['sd_xl_base_1.0.safetensors'] },
];

const COMPANIONS: Record<string, string> = {
  'ae.safetensors': 'vae',
  't5xxl_fp16.safetensors': 't5xxl',
  'clip_l.safetensors': 'clip_l',
};

function scanned(fileName: string): ScannedFile {
  return {
    absolutePath: `/models/${fileName}`,
    fileName,
    sizeBytes: 1,
    relDepth: 0,
  };
}

function ctx(overrides: Partial<ClassifyContext> = {}): ClassifyContext {
  return {
    profiles: PROFILES,
    companionFileNames: COMPANIONS,
    readSidecar: () => null,
    ...overrides,
  };
}

describe('classifyFile', () => {
  it('matches a canonical filename to its profile', async () => {
    const result = await classifyFile(scanned('v1-5-pruned-emaonly.safetensors'), ctx());
    expect(result).toEqual({ kind: 'profile', profileId: 'sd15' });
  });

  it('matches filenames case-insensitively', async () => {
    const result = await classifyFile(scanned('SD_XL_BASE_1.0.SAFETENSORS'), ctx());
    expect(result).toEqual({ kind: 'profile', profileId: 'sdxl' });
  });

  it('treats a renamed file with a sidecar as a custom model', async () => {
    const sidecar: SidecarFileV1 = { version: 1, category: 'image', name: 'My Custom SDXL' };
    const result = await classifyFile(
      scanned('my-cool-model.safetensors'),
      ctx({ readSidecar: () => sidecar }),
    );
    expect(result).toEqual({ kind: 'custom', sidecar });
  });

  it('lets a profile match win over a sidecar', async () => {
    const sidecar: SidecarFileV1 = { version: 1, category: 'image', name: 'Should be ignored' };
    const result = await classifyFile(
      scanned('sd15.gguf'),
      ctx({ readSidecar: () => sidecar }),
    );
    expect(result).toEqual({ kind: 'profile', profileId: 'sd15' });
  });

  it('classifies a known companion filename as companion inventory', async () => {
    const result = await classifyFile(scanned('ae.safetensors'), ctx());
    expect(result).toEqual({ kind: 'companion', companionKind: 'vae' });
  });

  it('matches companion filenames case-insensitively', async () => {
    const result = await classifyFile(scanned('T5XXL_FP16.safetensors'), ctx());
    expect(result).toEqual({ kind: 'companion', companionKind: 't5xxl' });
  });

  it('marks an unknown file as unrecognized', async () => {
    const result = await classifyFile(scanned('random-download.safetensors'), ctx());
    expect(result).toEqual({ kind: 'unrecognized' });
  });

  it('awaits an async sidecar reader', async () => {
    const sidecar: SidecarFileV1 = { version: 1, category: 'image' };
    const result = await classifyFile(
      scanned('async-model.safetensors'),
      ctx({ readSidecar: async () => sidecar }),
    );
    expect(result).toEqual({ kind: 'custom', sidecar });
  });
});

import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SidecarFileV1 } from '@shared/model-library/types';
import { classifyFile, scanModelFiles } from './model-library';
import { buildCompanionFileKinds } from './sdimage-companions';
import { SD_MODEL_CATALOG } from '../../local-image-engine/model-registry';

const EXTS = ['.safetensors', '.gguf', '.ckpt'];

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-scan-migration-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function write(relPath: string): Promise<void> {
  const abs = path.join(root, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, 'x');
}

const ctx = {
  profiles: SD_MODEL_CATALOG,
  companionFileNames: buildCompanionFileKinds(),
  readSidecar: () => null,
};

describe('image library migration + classification', () => {
  it('classifies an old beta-layout install (image/<extractedName>/<file>) to the same profile id', async () => {
    // Mirrors a real old install: userData/ai-models/image/<extractedName>/<modelFileName>
    await write(path.join('sd15-base-q4', 'stable-diffusion-v1-5-Q4_0.gguf'));

    const files = await scanModelFiles(root, { extensions: EXTS });
    expect(files).toHaveLength(1);

    const result = await classifyFile(files[0], ctx);
    // Same profile id → the saved sdImageActiveModel setting still resolves. Zero migration.
    expect(result).toEqual({ kind: 'profile', profileId: 'sd15-base-q4' });
  });

  it('matches a flat, canonically-named download to its profile', async () => {
    await write('flux1-dev-q4_0.gguf');
    const files = await scanModelFiles(root, { extensions: EXTS });
    const result = await classifyFile(files[0], ctx);
    expect(result).toEqual({ kind: 'profile', profileId: 'flux-dev-q4' });
  });

  it('treats a renamed file with a sidecar as a custom model', async () => {
    await write('my-finetune.safetensors');
    const files = await scanModelFiles(root, { extensions: EXTS });
    const sidecar: SidecarFileV1 = { version: 1, category: 'image', family: 'sdxl', name: 'My Finetune' };
    const result = await classifyFile(files[0], { ...ctx, readSidecar: () => sidecar });
    expect(result.kind).toBe('custom');
  });

  it('classifies a Flux companion file as companion inventory, not a model', async () => {
    await write('t5xxl_fp16.safetensors');
    const files = await scanModelFiles(root, { extensions: EXTS });
    const result = await classifyFile(files[0], ctx);
    expect(result).toEqual({ kind: 'companion', companionKind: 't5xxl' });
  });

  it('leaves an unknown checkpoint unrecognized', async () => {
    await write('some-random-model.safetensors');
    const files = await scanModelFiles(root, { extensions: EXTS });
    const result = await classifyFile(files[0], ctx);
    expect(result).toEqual({ kind: 'unrecognized' });
  });
});

import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildCompanionFileKinds, resolveCompanions } from './sdimage-companions';
import { FAMILY_PRESETS } from '../../local-image-engine/family-presets';

let root: string;
let modelDir: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-companions-'));
  modelDir = path.join(root, 'flux');
  await fs.mkdir(modelDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function touch(dir: string, name: string): Promise<void> {
  await fs.writeFile(path.join(dir, name), 'x');
}

describe('buildCompanionFileKinds', () => {
  it('maps every catalog + preset companion filename to its kind', () => {
    const map = buildCompanionFileKinds();
    expect(map['ae.safetensors']).toBe('vae');
    expect(map['clip_l.safetensors']).toBe('clip_l');
    expect(map['t5xxl_fp16.safetensors']).toBe('t5xxl');
    expect(map['flux2_ae.safetensors']).toBe('vae');
    expect(map['qwen3-4b-q4_0.gguf']).toBe('llm');
  });
});

describe('resolveCompanions (flux1)', () => {
  const meta = FAMILY_PRESETS.flux1;

  it('resolves companions found next to the model file', async () => {
    await touch(modelDir, 'clip_l.safetensors');
    await touch(modelDir, 't5xxl_fp16.safetensors');
    await touch(modelDir, 'ae.safetensors');

    const { companionPaths, issues } = resolveCompanions(meta, modelDir, root);

    expect(issues).toEqual([]);
    expect(companionPaths.clipL).toBe(path.join(modelDir, 'clip_l.safetensors'));
    expect(companionPaths.t5xxl).toBe(path.join(modelDir, 't5xxl_fp16.safetensors'));
    expect(companionPaths.vae).toBe(path.join(modelDir, 'ae.safetensors'));
  });

  it('falls back to companions in the models-folder root', async () => {
    await touch(root, 'clip_l.safetensors');
    await touch(root, 't5xxl_fp16.safetensors');
    await touch(root, 'ae.safetensors');

    const { companionPaths, issues } = resolveCompanions(meta, modelDir, root);

    expect(issues).toEqual([]);
    expect(companionPaths.vae).toBe(path.join(root, 'ae.safetensors'));
  });

  it('reports missing companions with the searched dirs + source link', () => {
    const { companionPaths, issues } = resolveCompanions(meta, modelDir, root);

    expect(companionPaths).toEqual({});
    expect(issues).toHaveLength(3);

    const vae = issues.find((i) => i.kind === 'vae');
    expect(vae?.code).toBe('missing-companion');
    expect(vae?.searchedDirs).toEqual([modelDir, root]);
    expect(vae?.expectedNames).toContain('ae.safetensors');
    expect(vae?.sourceUrl).toMatch(/^https?:\/\//);
  });

  it('prefers the companion next to the model over the one in root', async () => {
    await touch(modelDir, 'clip_l.safetensors');
    await touch(modelDir, 't5xxl_fp16.safetensors');
    await touch(modelDir, 'ae.safetensors');
    await touch(root, 'ae.safetensors'); // also in root — model dir should win

    const { companionPaths } = resolveCompanions(meta, modelDir, root);
    expect(companionPaths.vae).toBe(path.join(modelDir, 'ae.safetensors'));
  });

  it('an all-in-one checkpoint needs no companions', () => {
    const { companionPaths, issues } = resolveCompanions({ ...meta, allInOne: true }, modelDir, root);
    expect(companionPaths).toEqual({});
    expect(issues).toEqual([]);
  });
});

describe('resolveCompanions (families without companions)', () => {
  it('sd15 resolves to nothing with no issues', () => {
    const { companionPaths, issues } = resolveCompanions(FAMILY_PRESETS.sd15, modelDir, root);
    expect(companionPaths).toEqual({});
    expect(issues).toEqual([]);
  });
});

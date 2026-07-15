import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ModelProfileEnvelope } from '@shared/model-library/types';
import { matchDirectoryUnits, scanModelFiles } from './scanner';

const EXTS = ['.safetensors', '.gguf', '.ckpt'];

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-scanner-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function touch(relPath: string, contents = 'x'): Promise<void> {
  const abs = path.join(root, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, contents);
}

describe('scanModelFiles', () => {
  it('finds model files across a nested layout (old image/<dir>/<file> shape)', async () => {
    await touch('model-a.safetensors');
    await touch('notes.txt');
    await touch('stable-diffusion-v1-5/model.safetensors'); // old extractedName layout, depth 1
    await touch('sub1/sub2/model-c.ckpt');

    const files = await scanModelFiles(root, { extensions: EXTS });
    const names = files.map((f) => f.fileName).sort();

    expect(names).toEqual(['model-a.safetensors', 'model-c.ckpt', 'model.safetensors']);
  });

  it('reports the correct relative depth for each file', async () => {
    await touch('root.safetensors'); // depth 0
    await touch('a/one.safetensors'); // depth 1
    await touch('a/b/two.gguf'); // depth 2

    const files = await scanModelFiles(root, { extensions: EXTS });
    const byName = Object.fromEntries(files.map((f) => [f.fileName, f.relDepth]));

    expect(byName['root.safetensors']).toBe(0);
    expect(byName['one.safetensors']).toBe(1);
    expect(byName['two.gguf']).toBe(2);
  });

  it('respects the maxDepth limit', async () => {
    await touch('d0.safetensors'); // depth 0
    await touch('a/d1.safetensors'); // depth 1
    await touch('a/b/d2.safetensors'); // depth 2

    const files = await scanModelFiles(root, { extensions: EXTS, maxDepth: 1 });
    const names = files.map((f) => f.fileName).sort();

    expect(names).toEqual(['d0.safetensors', 'd1.safetensors']);
  });

  it('excludes files deeper than the default maxDepth of 3', async () => {
    await touch('a/b/c/deep.safetensors'); // depth 3 — included
    await touch('a/b/c/d/tooDeep.safetensors'); // depth 4 — excluded

    const files = await scanModelFiles(root, { extensions: EXTS });
    const names = files.map((f) => f.fileName);

    expect(names).toContain('deep.safetensors');
    expect(names).not.toContain('tooDeep.safetensors');
  });

  it('filters by extension', async () => {
    await touch('keep.safetensors');
    await touch('keep.gguf');
    await touch('skip.txt');
    await touch('skip.json');

    const files = await scanModelFiles(root, { extensions: EXTS });
    const names = files.map((f) => f.fileName).sort();

    expect(names).toEqual(['keep.gguf', 'keep.safetensors']);
  });

  it('matches extensions case-insensitively', async () => {
    await touch('upper.SafeTensors');

    const files = await scanModelFiles(root, { extensions: EXTS });
    expect(files.map((f) => f.fileName)).toEqual(['upper.SafeTensors']);
  });

  it('skips dot-directories', async () => {
    await touch('.cache/hidden.safetensors');
    await touch('visible.safetensors');

    const files = await scanModelFiles(root, { extensions: EXTS });
    expect(files.map((f) => f.fileName)).toEqual(['visible.safetensors']);
  });

  it('returns [] for a missing root without throwing', async () => {
    const files = await scanModelFiles(path.join(root, 'does-not-exist'), {
      extensions: EXTS,
    });
    expect(files).toEqual([]);
  });

  it('returns [] for an empty directory', async () => {
    const files = await scanModelFiles(root, { extensions: EXTS });
    expect(files).toEqual([]);
  });

  it('reports real file sizes', async () => {
    await touch('sized.safetensors', 'hello world'); // 11 bytes
    const files = await scanModelFiles(root, { extensions: EXTS });
    expect(files[0].sizeBytes).toBe(11);
  });
});

describe('matchDirectoryUnits', () => {
  function dirProfile(id: string, dirName: string, files: string[]): ModelProfileEnvelope<unknown> {
    return {
      id,
      category: 'stt',
      name: id,
      sizeBytes: 0,
      sizeLabel: '0',
      sourceUrl: 'https://example.com',
      directoryUnit: { dirName, files },
      meta: {},
    };
  }

  it('matches a profile when its dir and all required files exist', async () => {
    await touch('whisper-tiny/encoder.onnx');
    await touch('whisper-tiny/decoder.onnx');
    await touch('whisper-tiny/tokens.txt');

    const matches = await matchDirectoryUnits(root, [
      dirProfile('whisper-tiny', 'whisper-tiny', [
        'encoder.onnx',
        'decoder.onnx',
        'tokens.txt',
      ]),
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0].profileId).toBe('whisper-tiny');
    expect(matches[0].sizeBytes).toBeGreaterThan(0);
  });

  it('does not match when a required file is missing', async () => {
    await touch('whisper-tiny/encoder.onnx');
    // decoder + tokens missing

    const matches = await matchDirectoryUnits(root, [
      dirProfile('whisper-tiny', 'whisper-tiny', [
        'encoder.onnx',
        'decoder.onnx',
        'tokens.txt',
      ]),
    ]);

    expect(matches).toEqual([]);
  });

  it('ignores profiles without a directoryUnit', async () => {
    const singleFileProfile: ModelProfileEnvelope<unknown> = {
      id: 'sd15',
      category: 'image',
      name: 'sd15',
      sizeBytes: 0,
      sizeLabel: '0',
      sourceUrl: 'https://example.com',
      matchFileNames: ['sd15.safetensors'],
      meta: {},
    };

    const matches = await matchDirectoryUnits(root, [singleFileProfile]);
    expect(matches).toEqual([]);
  });
});

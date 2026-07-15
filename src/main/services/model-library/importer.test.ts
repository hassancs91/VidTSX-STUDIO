import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModelLibraryError } from '@shared/model-library/types';
import { importModelFile } from './importer';

let workdir: string;
let srcDir: string;
let destDir: string;

beforeEach(async () => {
  workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-import-'));
  srcDir = path.join(workdir, 'src');
  destDir = path.join(workdir, 'models');
  await fs.mkdir(srcDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(workdir, { recursive: true, force: true });
});

async function makeSource(name: string, contents = 'weights'): Promise<string> {
  const p = path.join(srcDir, name);
  await fs.writeFile(p, contents);
  return p;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

describe('importModelFile', () => {
  it('moves a file into the (auto-created) dest dir and removes the source', async () => {
    const src = await makeSource('model.safetensors');

    const dest = await importModelFile(src, destDir, 'move');

    expect(dest).toBe(path.join(destDir, 'model.safetensors'));
    expect(await exists(dest)).toBe(true);
    expect(await exists(src)).toBe(false); // source gone after move
  });

  it('copies a file, leaving the source in place', async () => {
    const src = await makeSource('model.safetensors');

    const dest = await importModelFile(src, destDir, 'copy');

    expect(await exists(dest)).toBe(true);
    expect(await exists(src)).toBe(true); // original remains after copy
    expect(await fs.readFile(dest, 'utf-8')).toBe('weights');
  });

  it('throws file-exists on collision without overwriting', async () => {
    const src = await makeSource('model.safetensors', 'new');
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(path.join(destDir, 'model.safetensors'), 'original');

    await expect(importModelFile(src, destDir, 'copy')).rejects.toMatchObject({
      code: 'file-exists',
    });
    // existing file untouched
    expect(await fs.readFile(path.join(destDir, 'model.safetensors'), 'utf-8')).toBe('original');
  });

  it('throws ModelLibraryError (file-exists) as a typed error', async () => {
    const src = await makeSource('dupe.gguf');
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(path.join(destDir, 'dupe.gguf'), 'x');

    await expect(importModelFile(src, destDir, 'move')).rejects.toBeInstanceOf(
      ModelLibraryError,
    );
  });

  it('throws missing-file when the source does not exist', async () => {
    await expect(
      importModelFile(path.join(srcDir, 'ghost.safetensors'), destDir, 'move'),
    ).rejects.toMatchObject({ code: 'missing-file' });
  });
});

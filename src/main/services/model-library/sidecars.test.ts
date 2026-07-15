import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SidecarFileV1 } from '@shared/model-library/types';
import {
  deleteSidecar,
  readSidecar,
  sidecarPathFor,
  writeSidecar,
} from './sidecars';

let root: string;
let modelPath: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-sidecar-'));
  modelPath = path.join(root, 'model.safetensors');
  await fs.writeFile(modelPath, 'weights');
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('sidecarPathFor', () => {
  it('appends .vidtsx.json to the model path', () => {
    expect(sidecarPathFor('/a/b/model.gguf')).toBe('/a/b/model.gguf.vidtsx.json');
  });
});

describe('read/write/delete round-trip', () => {
  it('writes then reads back the same sidecar', async () => {
    const sidecar: SidecarFileV1 = {
      version: 1,
      category: 'image',
      name: 'Custom Flux',
      family: 'flux1',
      allInOne: false,
    };
    await writeSidecar(modelPath, sidecar);

    const { sidecar: readBack, issue } = await readSidecar(modelPath);
    expect(issue).toBeUndefined();
    expect(readBack).toEqual(sidecar);
    // category payload spread at top level survives the round-trip
    expect(readBack?.family).toBe('flux1');
  });

  it('deletes a sidecar and tolerates a second delete', async () => {
    await writeSidecar(modelPath, { version: 1, category: 'image' });
    await deleteSidecar(modelPath);

    const { sidecar } = await readSidecar(modelPath);
    expect(sidecar).toBeNull();

    // no throw on already-absent
    await expect(deleteSidecar(modelPath)).resolves.toBeUndefined();
  });
});

describe('readSidecar error handling', () => {
  it('returns null with no issue when the sidecar is missing', async () => {
    const { sidecar, issue } = await readSidecar(modelPath);
    expect(sidecar).toBeNull();
    expect(issue).toBeUndefined();
  });

  it('returns null + issue for invalid JSON', async () => {
    await fs.writeFile(sidecarPathFor(modelPath), '{ not valid json', 'utf-8');

    const { sidecar, issue } = await readSidecar(modelPath);
    expect(sidecar).toBeNull();
    expect(issue?.code).toBe('unreadable-sidecar');
    expect(issue?.reason).toBe('invalid-json');
  });

  it('returns null + issue for the wrong version', async () => {
    await fs.writeFile(
      sidecarPathFor(modelPath),
      JSON.stringify({ version: 2, category: 'image' }),
      'utf-8',
    );

    const { sidecar, issue } = await readSidecar(modelPath);
    expect(sidecar).toBeNull();
    expect(issue?.code).toBe('unreadable-sidecar');
    expect(issue?.reason).toBe('unsupported-version');
  });
});

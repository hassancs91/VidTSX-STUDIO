import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

// brand-store → library-paths → settings-db → electron; CRUD never touches
// settings (root is explicit), so a bare app stub is enough (library-store
// test pattern).
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

import type { StudioBrandInput } from '../../../shared/studio/brand';
import { createBrand, deleteBrand, listBrands, readBrand, updateBrand } from './brand-store';

let root = '';

const INPUT: StudioBrandInput = {
  name: 'Acme Corp',
  palette: {
    primary: '#7F77DD',
    secondary: '#c8b4ff',
    background: '#131316',
    text: '#e0e0e0',
    accent: '#EF9F27',
  },
  fonts: { display: 'Inter', body: 'Roboto' },
  logoRefs: ['logos/acme.png'],
  styleNotes: 'Minimal.',
};

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-brand-test-'));
  root = path.join(tmpDir, 'assets');
  await fs.mkdir(root, { recursive: true });
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('brand-store CRUD at brands/<slug>/brand.json', () => {
  it('createBrand slugs the name into the folder id and writes brand.json', async () => {
    const brand = await createBrand(root, INPUT);
    expect(brand.id).toBe('acme-corp');
    const onDisk = JSON.parse(
      await fs.readFile(path.join(root, 'brands', 'acme-corp', 'brand.json'), 'utf-8'),
    );
    expect(onDisk.name).toBe('Acme Corp');
    expect(onDisk.palette.accent).toBe('#EF9F27');
    expect(onDisk.logoRefs).toEqual(['logos/acme.png']);
  });

  it('a name collision reserves -2 instead of overwriting', async () => {
    const brand = await createBrand(root, INPUT);
    expect(brand.id).toBe('acme-corp-2');
    expect(await readBrand(root, 'acme-corp')).not.toBeNull();
  });

  it('createBrand rejects invalid input with the validation message', async () => {
    await expect(
      createBrand(root, { ...INPUT, palette: { ...INPUT.palette, primary: '' } }),
    ).rejects.toThrow(/"primary"/);
  });

  it('updateBrand keeps id + createdAt, bumps updatedAt, can clear styleNotes', async () => {
    const before = await readBrand(root, 'acme-corp');
    const updated = await updateBrand(root, 'acme-corp', {
      ...INPUT,
      name: 'Acme Rebrand',
      styleNotes: '   ',
    });
    expect(updated.id).toBe('acme-corp');
    expect(updated.name).toBe('Acme Rebrand');
    expect(updated.createdAt).toBe(before?.createdAt);
    expect(updated.styleNotes).toBeUndefined();
    expect((await readBrand(root, 'acme-corp'))?.name).toBe('Acme Rebrand');
  });

  it('updateBrand throws for a missing brand', async () => {
    await expect(updateBrand(root, 'nope', INPUT)).rejects.toThrow(/not found/i);
  });

  it('listBrands returns every valid brand sorted by name and skips corrupt folders', async () => {
    await fs.mkdir(path.join(root, 'brands', 'broken'), { recursive: true });
    await fs.writeFile(path.join(root, 'brands', 'broken', 'brand.json'), '{not json');
    const brands = await listBrands(root);
    expect(brands.map((b) => b.id)).toEqual(['acme-corp-2', 'acme-corp']); // 'Acme Corp' < 'Acme Rebrand'
  });

  it('deleteBrand removes the folder; reads return null afterwards', async () => {
    await deleteBrand(root, 'acme-corp-2');
    expect(await readBrand(root, 'acme-corp-2')).toBeNull();
    expect((await listBrands(root)).map((b) => b.id)).toEqual(['acme-corp']);
  });

  it('ids that escape the root are refused', async () => {
    await expect(readBrand(root, '../../outside')).resolves.toBeNull(); // read swallows into null
    await expect(deleteBrand(root, '../../outside')).rejects.toThrow(/escapes/);
  });
});

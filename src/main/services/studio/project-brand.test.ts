import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpRoot = '';

vi.mock('electron', () => ({ app: { getPath: () => tmpRoot, isPackaged: false } }));
vi.mock('./studio-paths', () => ({
  getProjectDir: (projectId: string) => Promise.resolve(path.join(tmpRoot, 'projects', projectId)),
}));
vi.mock('../library/library-paths', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../library/library-paths')>()),
  getLibraryRoot: () => path.join(tmpRoot, 'assets'),
}));

import { promoteProjectBrand, readProjectBrand, resolveProjectBrand } from './project-brand';

const SNAPSHOT = {
  name: 'Learn With Hasan',
  palette: { primary: '#6366F1', secondary: '#9b7cc4', background: '#fffef7', text: '#1a1a2e', accent: '#4db8a8' },
  fonts: { display: 'Space Grotesk', body: 'Inter' },
  logoRefs: [],
  styleNotes: 'Calm, premium indigo look.',
  vocabulary: [{ term: 'Claude Code' }],
};

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'project-brand-'));
  await fs.mkdir(path.join(tmpRoot, 'projects', 'p1'), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, 'assets'), { recursive: true });
});

describe('promoteProjectBrand (feedback item 7, "Save to library")', () => {
  it('copies the snapshot into assets/brands/<slug>/ and the library brand then resolves', async () => {
    await fs.writeFile(path.join(tmpRoot, 'projects', 'p1', 'brand.json'), JSON.stringify(SNAPSHOT), 'utf-8');
    const brand = await promoteProjectBrand('p1');
    expect(brand.name).toBe('Learn With Hasan');
    expect(brand.palette).toEqual(SNAPSHOT.palette);
    expect(brand.fonts).toEqual(SNAPSHOT.fonts);
    expect(brand.styleNotes).toBe(SNAPSHOT.styleNotes);
    expect(brand.vocabulary?.map((t) => t.term)).toEqual(['Claude Code']);
    const onDisk = JSON.parse(await fs.readFile(path.join(tmpRoot, 'assets', 'brands', brand.id, 'brand.json'), 'utf-8'));
    expect(onDisk.name).toBe('Learn With Hasan');
    // The snapshot stays; the library brand wins once brandId points at it.
    expect(await readProjectBrand('p1')).not.toBeNull();
    expect((await resolveProjectBrand('p1', brand.id))?.id).toBe(brand.id);
  });

  it('a second promote gets its own folder instead of overwriting the first', async () => {
    await fs.writeFile(path.join(tmpRoot, 'projects', 'p1', 'brand.json'), JSON.stringify(SNAPSHOT), 'utf-8');
    const first = await promoteProjectBrand('p1');
    const second = await promoteProjectBrand('p1');
    expect(second.id).not.toBe(first.id);
  });

  it('throws a readable error when the project has no snapshot', async () => {
    await expect(promoteProjectBrand('p1')).rejects.toThrow(/no brand snapshot/);
  });
});

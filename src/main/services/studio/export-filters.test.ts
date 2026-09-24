import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { FilterItem } from '../../../shared/studio/filter-pack';

let tmpDir = '';
let installed: FilterItem[] = [];
const list = vi.fn(async () => installed);

vi.mock('electron', () => ({ app: { getPath: () => tmpDir, getVersion: () => '1.2.0', isPackaged: false } }));
vi.mock('./filter-packs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./filter-packs')>()),
  listFilters: () => list(),
}));

import { prepareFilterSources } from './export-filters';

// A bundled filter exactly as the add-ons builder emits one: no imports,
// esbuild's `export { x as default }`.
const GOOD = `var noir = { id: "noir", defaultIntensity: 1, render(frame) { frame.ctx.drawImage(frame.source, 0, 0); } };\nexport { noir as default };\n`;
const IMPORTS = `import { pixels } from './core/pixels';\nexport default { id: "x", defaultIntensity: 1, render() {} };\n`;
const CLOCK = `export default { id: "x", defaultIntensity: 1, render() { return Date.now(); } };\n`;

function item(kind: string, file: string): FilterItem {
  const [packId, id] = kind.split('/');
  return {
    id, name: id, kind, packId, packName: packId, category: 'filter', tier: 'common', tagline: '', description: '',
    accent: '#fff', symbol: '◐', animated: false, defaultIntensity: 1, parameters: [], presets: [], requires: [],
    heavy: false, version: '1.0.0', filePath: path.join(tmpDir, file),
  };
}

const timeline = (...clips: Array<{ kind: string; disabled?: boolean }[]>) => ({
  tracks: [{ clips: clips.map((effects, i) => ({ id: `c${i}`, effects })) }],
}) as unknown as Parameters<typeof prepareFilterSources>[0];

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-export-filters-'));
  await fs.writeFile(path.join(tmpDir, 'good.js'), GOOD);
  await fs.writeFile(path.join(tmpDir, 'imports.js'), IMPORTS);
  await fs.writeFile(path.join(tmpDir, 'clock.js'), CLOCK);
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  installed = [item('core/noir', 'good.js'), item('core/vhs', 'good.js'), item('shady/pixels', 'imports.js'), item('shady/clock', 'clock.js')];
  list.mockClear();
});

describe('prepareFilterSources', () => {
  it('does nothing for a timeline without live filters', async () => {
    expect(await prepareFilterSources(timeline([], [{ kind: 'core/noir', disabled: true }]), 'p1')).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it('prepares one verbatim copy per kind the timeline uses, sorted and de-duplicated', async () => {
    const prepared = await prepareFilterSources(
      timeline([{ kind: 'core/vhs' }], [{ kind: 'core/noir' }, { kind: 'core/vhs' }], [{ kind: 'core/noir' }]),
      'p1',
    );
    expect(prepared.map((p) => [p.ref.shotId, p.ref.identifier, p.ref.fileName])).toEqual([
      ['core/noir', 'Filter_0', 'studio-entry-p1-filter-core.noir.js'],
      ['core/vhs', 'Filter_1', 'studio-entry-p1-filter-core.vhs.js'],
    ]);
    // Byte-for-byte the pack file: no font rewrite, no transpile, no kit pin.
    expect(prepared[0].source).toBe(GOOD);
    expect(prepared[1].source).toBe(GOOD);
  });

  it('leaves an uninstalled kind to the plain picture instead of failing', async () => {
    const prepared = await prepareFilterSources(timeline([{ kind: 'gone/whoosh' }, { kind: 'core/noir' }]), 'p1');
    expect(prepared.map((p) => [p.ref.shotId, p.ref.identifier])).toEqual([['core/noir', 'Filter_0']]);
  });

  it('stops the export when an installed filter breaks the gate', async () => {
    await expect(prepareFilterSources(timeline([{ kind: 'shady/pixels' }]), 'p1')).rejects.toThrow(
      /Filter "pixels" \(shady\/pixels\): Import "\.\/core\/pixels" is not allowed/,
    );
    await expect(prepareFilterSources(timeline([{ kind: 'shady/clock' }]), 'p1')).rejects.toThrow(
      /Filter "clock" \(shady\/clock\): The filter uses Date\.now\(\)/,
    );
  });

  it('stops the export when an installed filter is missing on disk', async () => {
    installed = [item('core/noir', 'vanished.js')];
    await expect(prepareFilterSources(timeline([{ kind: 'core/noir' }]), 'p1')).rejects.toThrow(
      'Filter "noir" (core/noir): the file is missing on disk. Remove it from the timeline or fix the pack to export.',
    );
  });
});

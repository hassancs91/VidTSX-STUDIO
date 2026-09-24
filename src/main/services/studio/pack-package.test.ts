// `.vidtsxpack` / `.vidtsxtransition` / `.vidtsxfilter` (TRANSITION_PACKS_DESIGN.md
// and FILTER_PACKS_DESIGN.md "Import"): the container refusals, the per-kind
// gates, the version rules, and what an install leaves on disk — read back
// through the real pack loaders of BOTH kinds.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { inspectPackPackage, type PackPackageDeps } from './pack-package';
import { installPackPackage } from './pack-install';
import { scanTransitionRoots } from './transition-packs';
import { scanFilterRoots } from './filter-packs';
import {
  BAD_COMPONENT,
  BAD_FILTER,
  GOOD_COMPONENT,
  GOOD_FILTER,
  packFiles,
  packFilterFiles,
  packManifest,
  singleFilterManifest,
  singleManifest,
  writeTestPackage,
} from './test-pack-package-builder';

let dir: string;
let deps: PackPackageDeps;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pack-package-'));
  await fs.mkdir(path.join(dir, 'builtin', 'core'), { recursive: true });
  deps = { appVersion: '1.1.0', builtinRoot: path.join(dir, 'builtin'), installedRoot: path.join(dir, 'installed') };
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

const at = (name: string): string => path.join(dir, name);

async function writePack(name: string, version = '1.0.0', extra: Partial<Parameters<typeof writeTestPackage>[1]> = {}) {
  await writeTestPackage(at(name), { manifest: packManifest('demo', version), files: packFiles(), ...extra });
}

const installedTransitions = async (): Promise<string[]> =>
  (await scanTransitionRoots(deps.builtinRoot, deps.installedRoot, deps.appVersion)).map((t) => t.kind);
const installedFilters = async (): Promise<string[]> =>
  (await scanFilterRoots(deps.builtinRoot, deps.installedRoot, deps.appVersion)).map((f) => f.kind);
const readPackJson = async (packId: string) =>
  JSON.parse(await fs.readFile(path.join(deps.installedRoot, packId, 'pack.json'), 'utf-8')) as Record<string, unknown>;

describe('.vidtsxpack — the container', () => {
  it('inspects a well-formed pack without writing anything', async () => {
    await writePack('demo.vidtsxpack');
    const pkg = await inspectPackPackage(at('demo.vidtsxpack'), deps);
    expect(pkg).toMatchObject({ format: 'pack', packId: 'demo', version: '1.0.0', action: 'new', author: 'Tests' });
    expect(pkg.items.map((i) => [i.type, i.kind])).toEqual([['transition', 'demo/wipe'], ['transition', 'demo/slide']]);
    await expect(fs.access(deps.installedRoot)).rejects.toThrow();
  });

  it('refuses a tampered item (hash) and a lying size', async () => {
    await writePack('hash.vidtsxpack', '1.0.0', {
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].sha256 = 'b'.repeat(64);
      },
    });
    await expect(installPackPackage(at('hash.vidtsxpack'), deps)).rejects.toThrow(/manifest hash/);
    await writePack('size.vidtsxpack', '1.0.0', {
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].size = 3;
      },
    });
    await expect(inspectPackPackage(at('size.vidtsxpack'), deps)).rejects.toThrow(/manifest declares/);
    expect(await installedTransitions()).toEqual([]);
  });

  it('refuses a zip-slip path, a file it has no use for, a filter under transitions/, and a non-zip', async () => {
    await writePack('slip.vidtsxpack', '1.0.0', {
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].path = '../evil.tsx';
      },
    });
    await expect(inspectPackPackage(at('slip.vidtsxpack'), deps)).rejects.toThrow(/unsafe entry path/);
    await writeTestPackage(at('odd.vidtsxpack'), { manifest: packManifest(), files: { ...packFiles(), 'scripts/run.js': 'x' } });
    await expect(inspectPackPackage(at('odd.vidtsxpack'), deps)).rejects.toThrow(/no use for/);
    await writeTestPackage(at('crossed.vidtsxpack'), { manifest: packManifest(), files: { ...packFiles(), 'transitions/noir.js': GOOD_FILTER } });
    await expect(inspectPackPackage(at('crossed.vidtsxpack'), deps)).rejects.toThrow(/no use for: transitions\/noir\.js/);
    await fs.writeFile(at('junk.vidtsxpack'), 'not a zip');
    await expect(inspectPackPackage(at('junk.vidtsxpack'), deps)).rejects.toThrow(/not a readable \.vidtsxpack/);
  });

  it('refuses the reserved id, a built-in id and a newer minAppVersion', async () => {
    for (const [name, manifest] of [
      ['reserved', { ...packManifest(), id: 'imported' }],
      ['builtin', { ...packManifest(), id: 'core' }],
      ['future', { ...packManifest(), minAppVersion: '9.0.0' }],
    ] as const) {
      await writeTestPackage(at(`${name}.vidtsxpack`), { manifest, files: packFiles() });
    }
    await expect(inspectPackPackage(at('reserved.vidtsxpack'), deps)).rejects.toThrow(/reserved/);
    await expect(inspectPackPackage(at('builtin.vidtsxpack'), deps)).rejects.toThrow(/built-in pack id/);
    await expect(inspectPackPackage(at('future.vidtsxpack'), deps)).rejects.toThrow(/needs VidTSX 9\.0\.0/);
  });

  it('never unpacks a stowaway entry', async () => {
    await writePack('stow.vidtsxpack', '1.0.0', { extraEntries: { 'transitions/hidden.tsx': GOOD_COMPONENT, 'filters/hidden.js': GOOD_FILTER } });
    await installPackPackage(at('stow.vidtsxpack'), deps);
    expect((await fs.readdir(path.join(deps.installedRoot, 'demo', 'transitions'))).sort()).toEqual(['slide.tsx', 'wipe.tsx']);
    await expect(fs.access(path.join(deps.installedRoot, 'demo', 'filters'))).rejects.toThrow();
  });
});

describe('.vidtsxpack — the per-kind gates and install', () => {
  it('installs the items that pass and reports the one that does not', async () => {
    await writeTestPackage(at('mixed.vidtsxpack'), {
      manifest: packManifest(),
      files: { 'transitions/wipe.tsx': GOOD_COMPONENT, 'transitions/slide.tsx': BAD_COMPONENT },
    });
    const pkg = await inspectPackPackage(at('mixed.vidtsxpack'), deps);
    expect(pkg.items.find((i) => i.kind === 'demo/slide')?.refused).toMatch(/Import "fs" is not allowed/);
    const outcome = await installPackPackage(at('mixed.vidtsxpack'), deps);
    expect(outcome.installed).toEqual({ packId: 'demo', kinds: ['demo/wipe'], types: ['transition'] });
    expect(outcome.skipped).toEqual([{ name: 'Slide', reason: expect.stringMatching(/fs/) }]);
    expect(await installedTransitions()).toEqual(['demo/wipe']);
    await expect(fs.access(path.join(deps.installedRoot, 'demo', 'transitions', 'slide.tsx'))).rejects.toThrow();
  });

  it('installs a pack of both kinds, and both loaders read it back', async () => {
    await writeTestPackage(at('both.vidtsxpack'), {
      manifest: packManifest('both', '1.0.0', { transitions: ['wipe'], filters: ['noir', 'glow'] }),
      files: { ...packFiles(['wipe']), ...packFilterFiles(['noir']), 'filters/glow.js': BAD_FILTER },
    });
    const pkg = await inspectPackPackage(at('both.vidtsxpack'), deps);
    expect(pkg.items.map((i) => [i.type, i.kind, i.refused ? 'refused' : 'ok'])).toEqual([
      ['transition', 'both/wipe', 'ok'],
      ['filter', 'both/noir', 'ok'],
      ['filter', 'both/glow', 'refused'],
    ]);
    expect(pkg.items[2].refused).toMatch(/Date\.now/);
    expect(pkg.items[1]).toMatchObject({ category: 'filter', animated: false, heavy: false });
    const outcome = await installPackPackage(at('both.vidtsxpack'), deps);
    expect(outcome.installed).toEqual({ packId: 'both', kinds: ['both/wipe', 'both/noir'], types: ['transition', 'filter'] });
    expect(await installedTransitions()).toEqual(['both/wipe']);
    expect(await installedFilters()).toEqual(['both/noir']);
    const written = await readPackJson('both');
    expect((written.transitions as unknown[]).length).toBe(1);
    expect((written.filters as Array<{ id: string }>).map((f) => f.id)).toEqual(['noir']);
    expect(await fs.readFile(path.join(deps.installedRoot, 'both', 'filters', 'noir.js'), 'utf-8')).toBe(GOOD_FILTER);
  });

  it('a filters-only pack writes no transitions[] at all, so the transitions loader stays silent', async () => {
    await writeTestPackage(at('fx.vidtsxpack'), {
      manifest: packManifest('fx', '1.0.0', { filters: ['noir'] }),
      files: packFilterFiles(['noir']),
    });
    await installPackPackage(at('fx.vidtsxpack'), deps);
    expect(await installedFilters()).toEqual(['fx/noir']);
    expect(await installedTransitions()).toEqual([]);
    expect('transitions' in (await readPackJson('fx'))).toBe(false);
  });

  it('holds back a filter that needs analysis this build cannot supply', async () => {
    await writeTestPackage(at('tracked.vidtsxpack'), {
      manifest: {
        ...packManifest('tracked', '1.0.0', { filters: ['noir'] }),
        filters: [{ id: 'noir', name: 'Noir', category: 'filter', version: '1.0.0' }, { id: 'puppy', name: 'Puppy', category: 'effect', version: '1.0.0', requires: ['faceTrack'] }],
      },
      files: packFilterFiles(['noir', 'puppy']),
    });
    const pkg = await inspectPackPackage(at('tracked.vidtsxpack'), deps);
    expect(pkg.items.find((i) => i.kind === 'tracked/puppy')?.refused).toMatch(/faceTrack/);
    expect((await installPackPackage(at('tracked.vidtsxpack'), deps)).installed?.kinds).toEqual(['tracked/noir']);
  });

  it('refuses a pack whose every item fails the gate', async () => {
    await writeTestPackage(at('bad.vidtsxpack'), { manifest: packManifest(), files: packFiles(undefined, BAD_COMPONENT) });
    await expect(installPackPackage(at('bad.vidtsxpack'), deps)).rejects.toThrow(/None of this pack/);
  });

  it('leaves the same version alone, updates to a newer one, and asks before a downgrade', async () => {
    await writePack('v1.vidtsxpack', '1.0.0');
    await writePack('v2.vidtsxpack', '2.0.0');
    expect((await installPackPackage(at('v1.vidtsxpack'), deps)).installed?.packId).toBe('demo');
    expect(await installPackPackage(at('v1.vidtsxpack'), deps)).toMatchObject({ unchanged: true, installedVersion: '1.0.0' });
    expect((await installPackPackage(at('v2.vidtsxpack'), deps)).installed?.kinds).toHaveLength(2);
    expect(await inspectPackPackage(at('v1.vidtsxpack'), deps)).toMatchObject({ action: 'downgrade', installedVersion: '2.0.0' });
    expect(await installPackPackage(at('v1.vidtsxpack'), deps)).toMatchObject({ needsConfirm: 'downgrade' });
    await installPackPackage(at('v1.vidtsxpack'), deps, { confirmDowngrade: true });
    expect((await readPackJson('demo')).version).toBe('1.0.0');
    // No staging or parked folders left behind.
    expect((await fs.readdir(deps.installedRoot)).filter((n) => n.startsWith('.'))).toEqual([]);
  });
});

describe('singles into the reserved `imported` pack', () => {
  const writeSingle = (name: string, id = 'swirl', version = '1.0.0', body = GOOD_COMPONENT) =>
    writeTestPackage(at(name), { manifest: singleManifest(id, version), files: { [`${id}.tsx`]: body } });
  const writeSingleFilter = (name: string, id = 'glow', version = '1.0.0', body = GOOD_FILTER) =>
    writeTestPackage(at(name), { manifest: singleFilterManifest(id, version, { animated: true }), files: { [`${id}.js`]: body } });

  it('installs a transition as imported/<id>, appends a second, and replaces a newer one in place', async () => {
    await writeSingle('a.vidtsxtransition');
    await writeSingle('b.vidtsxtransition', 'ripple');
    await writeSingle('a2.vidtsxtransition', 'swirl', '1.1.0');
    expect(await inspectPackPackage(at('a.vidtsxtransition'), deps)).toMatchObject({ format: 'single', packId: 'imported', action: 'new' });
    expect((await installPackPackage(at('a.vidtsxtransition'), deps)).installed).toEqual({ packId: 'imported', kinds: ['imported/swirl'], types: ['transition'] });
    await installPackPackage(at('b.vidtsxtransition'), deps);
    expect(await installedTransitions()).toEqual(['imported/swirl', 'imported/ripple']);
    expect(await installPackPackage(at('a.vidtsxtransition'), deps)).toMatchObject({ unchanged: true });
    await installPackPackage(at('a2.vidtsxtransition'), deps);
    const pack = (await readPackJson('imported')) as { transitions: Array<{ id: string; version: string; author?: string }> };
    expect(pack.transitions.map((t) => [t.id, t.version])).toEqual([['swirl', '1.1.0'], ['ripple', '1.0.0']]);
    expect(pack.transitions[0].author).toBe('Tests');
    expect(await installPackPackage(at('a.vidtsxtransition'), deps)).toMatchObject({ needsConfirm: 'downgrade' });
  });

  it('installs a filter beside the transitions in imported/, keeping the other kind', async () => {
    await writeSingle('a.vidtsxtransition');
    await writeSingleFilter('g.vidtsxfilter');
    await writeSingleFilter('g2.vidtsxfilter', 'glow', '1.2.0');
    await installPackPackage(at('a.vidtsxtransition'), deps);
    const pkg = await inspectPackPackage(at('g.vidtsxfilter'), deps);
    expect(pkg).toMatchObject({ format: 'single', packId: 'imported', action: 'new', name: 'Glow' });
    expect(pkg.items[0]).toMatchObject({ type: 'filter', kind: 'imported/glow', category: 'effect', animated: true });
    expect((await installPackPackage(at('g.vidtsxfilter'), deps)).installed).toEqual({ packId: 'imported', kinds: ['imported/glow'], types: ['filter'] });
    expect(await installedFilters()).toEqual(['imported/glow']);
    expect(await installedTransitions()).toEqual(['imported/swirl']);
    expect(await fs.readFile(path.join(deps.installedRoot, 'imported', 'filters', 'glow.js'), 'utf-8')).toBe(GOOD_FILTER);
    expect(await installPackPackage(at('g.vidtsxfilter'), deps)).toMatchObject({ unchanged: true, installedVersion: '1.0.0' });
    await installPackPackage(at('g2.vidtsxfilter'), deps);
    const pack = (await readPackJson('imported')) as { transitions: Array<{ id: string }>; filters: Array<{ id: string; version: string }> };
    expect(pack.transitions.map((t) => t.id)).toEqual(['swirl']);
    expect(pack.filters.map((f) => [f.id, f.version])).toEqual([['glow', '1.2.0']]);
    expect((await fs.readdir(deps.installedRoot)).filter((n) => n.startsWith('.'))).toEqual([]);
  });

  it('refuses a single whose item fails its gate, or whose file is missing or of the wrong kind', async () => {
    await writeSingle('bad.vidtsxtransition', 'swirl', '1.0.0', BAD_COMPONENT);
    await expect(installPackPackage(at('bad.vidtsxtransition'), deps)).rejects.toThrow(/cannot be installed/);
    await writeSingleFilter('bad.vidtsxfilter', 'glow', '1.0.0', BAD_FILTER);
    await expect(installPackPackage(at('bad.vidtsxfilter'), deps)).rejects.toThrow(/cannot be installed: The filter uses Date\.now/);
    await writeTestPackage(at('none.vidtsxtransition'), { manifest: singleManifest(), files: { 'other.tsx': GOOD_COMPONENT } });
    await expect(inspectPackPackage(at('none.vidtsxtransition'), deps)).rejects.toThrow(/no use for/);
    await writeTestPackage(at('tsx.vidtsxfilter'), { manifest: singleFilterManifest(), files: { 'glow.tsx': GOOD_COMPONENT } });
    await expect(inspectPackPackage(at('tsx.vidtsxfilter'), deps)).rejects.toThrow(/no use for/);
    expect(await installedTransitions()).toEqual([]);
    expect(await installedFilters()).toEqual([]);
  });
});

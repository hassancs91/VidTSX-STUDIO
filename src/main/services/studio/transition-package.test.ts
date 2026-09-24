// `.vidtsxpack` / `.vidtsxtransition` (TRANSITION_PACKS_DESIGN.md "Import"):
// the container refusals, the per-item gate, the version rules, and what an
// install leaves on disk — read back through the real pack loader.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { inspectTransitionPackage, type TransitionPackageDeps } from './transition-package';
import { installTransitionPackage } from './transition-install';
import { scanTransitionRoots } from './transition-packs';
import {
  BAD_COMPONENT,
  GOOD_COMPONENT,
  packFiles,
  packManifest,
  singleManifest,
  writeTestTransitionPackage,
} from './test-transition-package-builder';

let dir: string;
let deps: TransitionPackageDeps;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'transition-package-'));
  await fs.mkdir(path.join(dir, 'builtin', 'core'), { recursive: true });
  deps = { appVersion: '1.1.0', builtinRoot: path.join(dir, 'builtin'), installedRoot: path.join(dir, 'installed') };
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

const at = (name: string): string => path.join(dir, name);

async function writePack(name: string, version = '1.0.0', extra: Partial<Parameters<typeof writeTestTransitionPackage>[1]> = {}) {
  await writeTestTransitionPackage(at(name), { manifest: packManifest('demo', version), files: packFiles(), ...extra });
}

const installedKinds = async (): Promise<string[]> =>
  (await scanTransitionRoots(deps.builtinRoot, deps.installedRoot, deps.appVersion)).map((t) => t.kind);

describe('.vidtsxpack — the container', () => {
  it('inspects a well-formed pack without writing anything', async () => {
    await writePack('demo.vidtsxpack');
    const pkg = await inspectTransitionPackage(at('demo.vidtsxpack'), deps);
    expect(pkg).toMatchObject({ format: 'pack', packId: 'demo', version: '1.0.0', action: 'new', author: 'Tests' });
    expect(pkg.items.map((i) => i.kind)).toEqual(['demo/wipe', 'demo/slide']);
    await expect(fs.access(deps.installedRoot)).rejects.toThrow();
  });

  it('refuses a tampered component (hash) and a lying size', async () => {
    await writePack('hash.vidtsxpack', '1.0.0', {
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].sha256 = 'b'.repeat(64);
      },
    });
    await expect(installTransitionPackage(at('hash.vidtsxpack'), deps)).rejects.toThrow(/manifest hash/);
    await writePack('size.vidtsxpack', '1.0.0', {
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].size = 3;
      },
    });
    await expect(inspectTransitionPackage(at('size.vidtsxpack'), deps)).rejects.toThrow(/manifest declares/);
    expect(await installedKinds()).toEqual([]);
  });

  it('refuses a zip-slip path, a file it has no use for, and a non-zip', async () => {
    await writePack('slip.vidtsxpack', '1.0.0', {
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].path = '../evil.tsx';
      },
    });
    await expect(inspectTransitionPackage(at('slip.vidtsxpack'), deps)).rejects.toThrow(/unsafe entry path/);
    await writeTestTransitionPackage(at('odd.vidtsxpack'), {
      manifest: packManifest(),
      files: { ...packFiles(), 'scripts/run.js': 'x' },
    });
    await expect(inspectTransitionPackage(at('odd.vidtsxpack'), deps)).rejects.toThrow(/no use for/);
    await fs.writeFile(at('junk.vidtsxpack'), 'not a zip');
    await expect(inspectTransitionPackage(at('junk.vidtsxpack'), deps)).rejects.toThrow(/not a readable \.vidtsxpack/);
  });

  it('refuses the reserved id, a built-in id and a newer minAppVersion', async () => {
    for (const [name, manifest] of [
      ['reserved', { ...packManifest(), id: 'imported' }],
      ['builtin', { ...packManifest(), id: 'core' }],
      ['future', { ...packManifest(), minAppVersion: '9.0.0' }],
    ] as const) {
      await writeTestTransitionPackage(at(`${name}.vidtsxpack`), { manifest, files: packFiles() });
    }
    await expect(inspectTransitionPackage(at('reserved.vidtsxpack'), deps)).rejects.toThrow(/reserved/);
    await expect(inspectTransitionPackage(at('builtin.vidtsxpack'), deps)).rejects.toThrow(/built-in pack id/);
    await expect(inspectTransitionPackage(at('future.vidtsxpack'), deps)).rejects.toThrow(/needs VidTSX 9\.0\.0/);
  });

  it('never unpacks a stowaway entry', async () => {
    await writePack('stow.vidtsxpack', '1.0.0', { extraEntries: { 'transitions/hidden.tsx': GOOD_COMPONENT } });
    await installTransitionPackage(at('stow.vidtsxpack'), deps);
    const files = await fs.readdir(path.join(deps.installedRoot, 'demo', 'transitions'));
    expect(files.sort()).toEqual(['slide.tsx', 'wipe.tsx']);
  });
});

describe('.vidtsxpack — the per-item gate and install', () => {
  it('installs the items that pass and reports the one that does not', async () => {
    await writeTestTransitionPackage(at('mixed.vidtsxpack'), {
      manifest: packManifest(),
      files: { 'transitions/wipe.tsx': GOOD_COMPONENT, 'transitions/slide.tsx': BAD_COMPONENT },
    });
    const pkg = await inspectTransitionPackage(at('mixed.vidtsxpack'), deps);
    expect(pkg.items.find((i) => i.kind === 'demo/slide')?.refused).toMatch(/Import "fs" is not allowed/);
    const outcome = await installTransitionPackage(at('mixed.vidtsxpack'), deps);
    expect(outcome.installed).toEqual({ packId: 'demo', kinds: ['demo/wipe'] });
    expect(outcome.skipped).toEqual([{ name: 'Slide', reason: expect.stringMatching(/fs/) }]);
    expect(await installedKinds()).toEqual(['demo/wipe']);
    await expect(fs.access(path.join(deps.installedRoot, 'demo', 'transitions', 'slide.tsx'))).rejects.toThrow();
  });

  it('refuses a pack whose every item fails the gate', async () => {
    await writeTestTransitionPackage(at('bad.vidtsxpack'), { manifest: packManifest(), files: packFiles(undefined, BAD_COMPONENT) });
    await expect(installTransitionPackage(at('bad.vidtsxpack'), deps)).rejects.toThrow(/None of this pack/);
  });

  it('leaves the same version alone, updates to a newer one, and asks before a downgrade', async () => {
    await writePack('v1.vidtsxpack', '1.0.0');
    await writePack('v2.vidtsxpack', '2.0.0');
    expect((await installTransitionPackage(at('v1.vidtsxpack'), deps)).installed?.packId).toBe('demo');
    expect(await installTransitionPackage(at('v1.vidtsxpack'), deps)).toMatchObject({ unchanged: true, installedVersion: '1.0.0' });
    expect((await installTransitionPackage(at('v2.vidtsxpack'), deps)).installed?.kinds).toHaveLength(2);
    expect(await inspectTransitionPackage(at('v1.vidtsxpack'), deps)).toMatchObject({ action: 'downgrade', installedVersion: '2.0.0' });
    expect(await installTransitionPackage(at('v1.vidtsxpack'), deps)).toMatchObject({ needsConfirm: 'downgrade' });
    await installTransitionPackage(at('v1.vidtsxpack'), deps, { confirmDowngrade: true });
    const pack = JSON.parse(await fs.readFile(path.join(deps.installedRoot, 'demo', 'pack.json'), 'utf-8')) as { version: string };
    expect(pack.version).toBe('1.0.0');
    // No staging or parked folders left behind.
    expect((await fs.readdir(deps.installedRoot)).filter((n) => n.startsWith('.'))).toEqual([]);
  });
});

describe('.vidtsxtransition — singles into the reserved `imported` pack', () => {
  const writeSingle = (name: string, id = 'swirl', version = '1.0.0', body = GOOD_COMPONENT) =>
    writeTestTransitionPackage(at(name), { manifest: singleManifest(id, version), files: { [`${id}.tsx`]: body } });

  it('installs as imported/<id>, appends a second, and replaces a newer one in place', async () => {
    await writeSingle('a.vidtsxtransition');
    await writeSingle('b.vidtsxtransition', 'ripple');
    await writeSingle('a2.vidtsxtransition', 'swirl', '1.1.0');
    expect(await inspectTransitionPackage(at('a.vidtsxtransition'), deps)).toMatchObject({ format: 'single', packId: 'imported', action: 'new' });
    expect((await installTransitionPackage(at('a.vidtsxtransition'), deps)).installed).toEqual({ packId: 'imported', kinds: ['imported/swirl'] });
    await installTransitionPackage(at('b.vidtsxtransition'), deps);
    expect(await installedKinds()).toEqual(['imported/swirl', 'imported/ripple']);
    expect(await installTransitionPackage(at('a.vidtsxtransition'), deps)).toMatchObject({ unchanged: true });
    await installTransitionPackage(at('a2.vidtsxtransition'), deps);
    const pack = JSON.parse(await fs.readFile(path.join(deps.installedRoot, 'imported', 'pack.json'), 'utf-8')) as {
      transitions: Array<{ id: string; version: string; author?: string }>;
    };
    expect(pack.transitions.map((t) => [t.id, t.version])).toEqual([['swirl', '1.1.0'], ['ripple', '1.0.0']]);
    expect(pack.transitions[0].author).toBe('Tests');
    expect(await installTransitionPackage(at('a.vidtsxtransition'), deps)).toMatchObject({ needsConfirm: 'downgrade' });
  });

  it('refuses a single whose component fails the gate, or whose file is missing', async () => {
    await writeSingle('bad.vidtsxtransition', 'swirl', '1.0.0', BAD_COMPONENT);
    await expect(installTransitionPackage(at('bad.vidtsxtransition'), deps)).rejects.toThrow(/cannot be installed/);
    await writeTestTransitionPackage(at('none.vidtsxtransition'), { manifest: singleManifest(), files: { 'other.tsx': GOOD_COMPONENT } });
    await expect(inspectTransitionPackage(at('none.vidtsxtransition'), deps)).rejects.toThrow(/no use for/);
    expect(await installedKinds()).toEqual([]);
  });
});

// Installed flows on disk (flows plan §1.7, W8 Stage 6): scan, shadowing,
// install newer / equal / older, `.bak` rotation, remove and the built-in
// that reappears — the agents' store rules on the flow manifest.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp', isPackaged: false, getAppPath: () => 'C:/tmp', getVersion: () => '1.1.0' },
}));

import { AGENT_TOOL_IDS } from '../../../shared/agents/tool-ids';
import type { FlowPackageDeps } from './flow-package';
import { installFlowPackage, readFlowFolder, removeFlow, scanFlows, type FlowStoreRoots } from './flow-store';
import { defaultFlowManifest, testKeyPair, writeTestFlowPackage } from './test-flow-package-builder';

let dir: string;
let roots: FlowStoreRoots;

const deps: FlowPackageDeps = { manifestContext: { appVersion: '1.1.0', toolIds: AGENT_TOOL_IDS } };

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-store-'));
  roots = { userDir: path.join(dir, 'user'), builtinDir: path.join(dir, 'builtin') };
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

/** An unpacked flow folder straight into a root — how a built-in ships. */
async function writeFlowFolder(root: string, id: string, over: Record<string, unknown> = {}): Promise<string> {
  const [namespace, name] = id.split('/');
  const folder = path.join(root, namespace, name);
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'flow.json'), JSON.stringify({ ...defaultFlowManifest(id), files: [], ...over }));
  return folder;
}

describe('readFlowFolder / scanFlows', () => {
  it('reads a folder and skips one whose folder name is not its id', async () => {
    const good = await writeFlowFolder(roots.builtinDir, 'vidtsx/thumbnail');
    expect((await readFlowFolder(good, 'builtin', deps))?.manifest.id).toBe('vidtsx/thumbnail');
    const wrong = await writeFlowFolder(roots.builtinDir, 'vidtsx/other', { id: 'vidtsx/thumbnail' });
    expect(await readFlowFolder(wrong, 'builtin', deps)).toBeNull();
    // Inside an agent package the folder is `flows/<name>/`, so the check is optional.
    expect((await readFlowFolder(wrong, 'builtin', deps, { checkFolderName: false }))?.manifest.id).toBe('vidtsx/thumbnail');
  });

  it('lists both roots, highest version wins, equal prefers the built-in', async () => {
    await writeFlowFolder(roots.builtinDir, 'vidtsx/a', { version: '1.0.0', name: 'A' });
    await writeFlowFolder(roots.userDir, 'vidtsx/a', { version: '1.0.0', name: 'A user' });
    await writeFlowFolder(roots.builtinDir, 'vidtsx/b', { version: '1.0.0', name: 'B' });
    await writeFlowFolder(roots.userDir, 'vidtsx/b', { version: '2.0.0', name: 'B newer' });
    await writeFlowFolder(roots.userDir, 'acme/c', { version: '1.0.0', name: 'C' });
    const flows = await scanFlows(deps, roots);
    expect(flows.map((f) => `${f.manifest.id}@${f.manifest.version}:${f.origin}`)).toEqual([
      'vidtsx/a@1.0.0:builtin',
      'vidtsx/b@2.0.0:user',
      'acme/c@1.0.0:user',
    ]);
    expect(flows.every((f) => f.signature === 'unsigned')).toBe(true);
  });

  it('skips a folder that does not parse without hiding the others', async () => {
    await writeFlowFolder(roots.userDir, 'acme/ok');
    const bad = path.join(roots.userDir, 'acme', 'broken');
    await fs.mkdir(bad, { recursive: true });
    await fs.writeFile(path.join(bad, 'flow.json'), '{ not json');
    expect((await scanFlows(deps, roots)).map((f) => f.manifest.id)).toEqual(['acme/ok']);
  });
});

describe('installFlowPackage', () => {
  it('installs a user copy from a package, with flow.json verbatim', async () => {
    const pkg = path.join(dir, 'acme.flow.vidtsxflow');
    await writeTestFlowPackage(pkg, { manifest: { id: 'acme/flow', name: 'Acme flow' }, files: { 'assets/ref.txt': 'ref' } });
    const result = await installFlowPackage(pkg, deps, {}, roots);
    expect(result.flow?.manifest.id).toBe('acme/flow');
    expect(result.flow?.origin).toBe('user');
    const folder = path.join(roots.userDir, 'acme', 'flow');
    expect(await fs.readFile(path.join(folder, 'assets', 'ref.txt'), 'utf-8')).toBe('ref');
    const onDisk = JSON.parse(await fs.readFile(path.join(folder, 'flow.json'), 'utf-8')) as { name: string };
    expect(onDisk.name).toBe('Acme flow');
    expect((await scanFlows(deps, roots)).map((f) => f.manifest.id)).toEqual(['acme/flow']);
  });

  it('keeps the signature verifying after install (the side file is copied byte for byte)', async () => {
    const key = testKeyPair();
    const pkg = path.join(dir, 'signed.vidtsxflow');
    await writeTestFlowPackage(pkg, { manifest: { id: 'acme/signed' }, signWith: { privateKeyPem: key.privateKeyPem, keyId: 'acme-1' } });
    const publishers = [{ keyId: 'acme-1', name: 'Acme', publicKey: key.publicKeyBase64 }];
    const result = await installFlowPackage(pkg, { ...deps, publishers }, {}, roots);
    expect(result.flow?.signature).toBe('verified');
    expect(result.flow?.publisher).toBe('Acme');
    const scanned = await scanFlows({ ...deps, publishers }, roots);
    expect(scanned[0]?.signature).toBe('verified');
  });

  it('newer replaces and rotates the old copy to .bak; older asks first', async () => {
    const v1 = path.join(dir, 'v1.vidtsxflow');
    const v2 = path.join(dir, 'v2.vidtsxflow');
    await writeTestFlowPackage(v1, { manifest: { id: 'acme/flow', version: '1.0.0' } });
    await writeTestFlowPackage(v2, { manifest: { id: 'acme/flow', version: '2.0.0' } });
    await installFlowPackage(v1, deps, {}, roots);
    const up = await installFlowPackage(v2, deps, {}, roots);
    expect(up.flow?.manifest.version).toBe('2.0.0');
    const bak = JSON.parse(await fs.readFile(path.join(roots.userDir, 'acme', 'flow.bak', 'flow.json'), 'utf-8')) as { version: string };
    expect(bak.version).toBe('1.0.0');

    const down = await installFlowPackage(v1, deps, {}, roots);
    expect(down).toEqual({ needsConfirm: 'downgrade', installedVersion: '2.0.0' });
    const forced = await installFlowPackage(v1, deps, { confirmDowngrade: true }, roots);
    expect(forced.flow?.manifest.version).toBe('1.0.0');
  });

  it('never writes the built-in root; a user copy shadows only when newer', async () => {
    await writeFlowFolder(roots.builtinDir, 'vidtsx/thumbnail', { version: '1.0.0' });
    const pkg = path.join(dir, 'same.vidtsxflow');
    await writeTestFlowPackage(pkg, { manifest: { id: 'vidtsx/thumbnail', version: '1.0.0' } });
    await installFlowPackage(pkg, deps, {}, roots);
    const flows = await scanFlows(deps, roots);
    expect(flows).toHaveLength(1);
    expect(flows[0].origin).toBe('builtin');
  });
});

describe('removeFlow', () => {
  it('removes the user copy and its .bak, restoring a shadowed built-in', async () => {
    await writeFlowFolder(roots.builtinDir, 'vidtsx/thumbnail', { version: '1.0.0' });
    const pkg = path.join(dir, 'newer.vidtsxflow');
    await writeTestFlowPackage(pkg, { manifest: { id: 'vidtsx/thumbnail', version: '2.0.0' } });
    await installFlowPackage(pkg, deps, {}, roots);
    expect((await scanFlows(deps, roots))[0].origin).toBe('user');
    const result = await removeFlow('vidtsx/thumbnail', deps, roots);
    expect(result.restoredBuiltin?.manifest.version).toBe('1.0.0');
    expect((await scanFlows(deps, roots))[0].origin).toBe('builtin');
  });

  it('refuses to remove a built-in or a flow that is not installed', async () => {
    await writeFlowFolder(roots.builtinDir, 'vidtsx/thumbnail');
    await expect(removeFlow('vidtsx/thumbnail', deps, roots)).rejects.toThrow(/ships with the app/);
    await expect(removeFlow('acme/none', deps, roots)).rejects.toThrow(/not installed/);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// agent-store reaches paths.ts for its default roots; every test passes roots
// explicitly, so the app only has to exist, not to be real.
vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp', isPackaged: false, getAppPath: () => 'C:/tmp', getVersion: () => '1.0.0' },
}));

import { AGENT_TOOL_IDS } from '../../../shared/agents/tool-ids';
import { ARTIFACT_KINDS, INTERACTION_KINDS } from '../../../shared/types/agents';
import type { AgentPackageDeps } from './agent-package';
import {
  installAgentPackage,
  readAgentFolder,
  removeAgent,
  scanAgents,
  type AgentStoreRoots,
} from './agent-store';
import { testKeyPair, writeTestAgentPackage } from './test-package-builder';

let dir: string;
let roots: AgentStoreRoots;

const deps: AgentPackageDeps = {
  manifestContext: {
    appVersion: '1.0.0',
    toolIds: AGENT_TOOL_IDS,
    artifactKinds: ARTIFACT_KINDS,
    interactionKinds: INTERACTION_KINDS,
  },
};

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-store-'));
  roots = { userDir: path.join(dir, 'user'), builtinDir: path.join(dir, 'builtin') };
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

/** Write an unpacked agent folder straight into a root — how a built-in ships. */
async function writeAgentFolder(
  root: string,
  id: string,
  manifest: Record<string, unknown> = {},
): Promise<string> {
  const [namespace, name] = id.split('/');
  const folder = path.join(root, namespace, name);
  await fs.mkdir(folder, { recursive: true });
  const prompt = '# Built in\n';
  await fs.writeFile(path.join(folder, 'AGENT.md'), prompt);
  await fs.writeFile(
    path.join(folder, 'agent.json'),
    JSON.stringify({
      formatVersion: 1,
      id,
      name: `Agent ${name}`,
      version: '1.0.0',
      description: '',
      author: { name: 'VidTSX' },
      minAppVersion: '1.0.0',
      prompt: 'AGENT.md',
      tools: ['write_document'],
      files: [
        {
          path: 'AGENT.md',
          size: Buffer.byteLength(prompt),
          sha256: 'd'.repeat(64), // never re-hashed on scan; extraction verified it
        },
      ],
      ...manifest,
    }),
  );
  return folder;
}

const pkg = (name: string): string => path.join(dir, name);

async function packVersion(version: string, extra: Record<string, unknown> = {}): Promise<string> {
  const file = pkg(`agent-${version}.vidtsxagent`);
  await writeTestAgentPackage(file, { manifest: { version, ...extra } });
  return file;
}

describe('install', () => {
  it('installs into an empty store and lists the result', async () => {
    const result = await installAgentPackage(await packVersion('1.0.0'), deps, {}, roots);
    expect(result.agent?.manifest.version).toBe('1.0.0');
    expect(result.agent?.origin).toBe('user');

    const listed = await scanAgents(deps, roots);
    expect(listed.map((a) => a.manifest.id)).toEqual(['test/agent']);
    expect(await fs.readFile(path.join(roots.userDir, 'test/agent/AGENT.md'), 'utf-8')).toContain(
      'Test Agent',
    );
  });

  it('replaces a newer version and keeps ONE rotated backup', async () => {
    await installAgentPackage(await packVersion('1.0.0'), deps, {}, roots);
    const result = await installAgentPackage(await packVersion('2.0.0'), deps, {}, roots);
    expect(result.agent?.manifest.version).toBe('2.0.0');

    const backup = JSON.parse(
      await fs.readFile(path.join(roots.userDir, 'test/agent.bak/agent.json'), 'utf-8'),
    ) as { version: string };
    expect(backup.version).toBe('1.0.0');

    // A third install rotates again rather than accumulating .bak2, .bak3…
    await installAgentPackage(await packVersion('3.0.0'), deps, {}, roots);
    expect((await fs.readdir(path.join(roots.userDir, 'test'))).sort()).toEqual([
      'agent',
      'agent.bak',
    ]);
  });

  it('reinstalls an equal version without asking', async () => {
    await installAgentPackage(await packVersion('1.0.0'), deps, {}, roots);
    const again = await installAgentPackage(await packVersion('1.0.0'), deps, {}, roots);
    expect(again.needsConfirm).toBeUndefined();
    expect(again.agent?.manifest.version).toBe('1.0.0');
  });

  it('asks before a downgrade, and installs once confirmed', async () => {
    await installAgentPackage(await packVersion('2.0.0'), deps, {}, roots);

    const asked = await installAgentPackage(await packVersion('1.0.0'), deps, {}, roots);
    expect(asked).toEqual({ needsConfirm: 'downgrade', installedVersion: '2.0.0' });
    // Nothing was written while the question stood.
    const still = await readAgentFolder(path.join(roots.userDir, 'test/agent'), 'user', deps);
    expect(still?.manifest.version).toBe('2.0.0');

    const confirmed = await installAgentPackage(
      await packVersion('1.0.0'),
      deps,
      { confirmDowngrade: true },
      roots,
    );
    expect(confirmed.agent?.manifest.version).toBe('1.0.0');
  });

  it('leaves the installed agent in place when the package is refused', async () => {
    await installAgentPackage(await packVersion('1.0.0'), deps, {}, roots);
    const bad = pkg('bad.vidtsxagent');
    await writeTestAgentPackage(bad, { manifest: { version: '2.0.0', tools: ['launch_missiles'] } });

    await expect(installAgentPackage(bad, deps, {}, roots)).rejects.toThrow(/launch_missiles/);
    const still = await readAgentFolder(path.join(roots.userDir, 'test/agent'), 'user', deps);
    expect(still?.manifest.version).toBe('1.0.0');
    expect(await fs.readdir(path.join(roots.userDir, 'test'))).toEqual(['agent']);
  });

  it('carries the signature into the installed folder, so a scan re-derives it', async () => {
    const key = testKeyPair();
    const file = pkg('signed.vidtsxagent');
    await writeTestAgentPackage(file, {
      signWith: { privateKeyPem: key.privateKeyPem, keyId: 'vidtsx-1' },
    });
    const signedDeps: AgentPackageDeps = {
      ...deps,
      publishers: [{ keyId: 'vidtsx-1', name: 'VidTSX', publicKey: key.publicKeyBase64 }],
    };
    await installAgentPackage(file, signedDeps, {}, roots);

    const [listed] = await scanAgents(signedDeps, roots);
    expect(listed.signature).toBe('verified');
    expect(listed.keyId).toBe('vidtsx-1');

    // …and a folder whose agent.json was edited after install no longer verifies.
    const manifestPath = path.join(roots.userDir, 'test/agent/agent.json');
    const edited = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as Record<string, unknown>;
    edited.name = 'Edited In Place';
    await fs.writeFile(manifestPath, JSON.stringify(edited));
    expect(await scanAgents(signedDeps, roots)).toEqual([]);
  });
});

describe('scan', () => {
  it('skips corrupt, mismatched and non-agent folders without failing the list', async () => {
    await writeAgentFolder(roots.userDir, 'good/agent');
    await fs.mkdir(path.join(roots.userDir, 'broken/agent'), { recursive: true });
    await fs.writeFile(path.join(roots.userDir, 'broken/agent/agent.json'), '{ not json');
    await fs.mkdir(path.join(roots.userDir, 'empty/agent'), { recursive: true });
    // A folder whose manifest id names somewhere else — every path is built
    // from the id, so this must never be trusted.
    await writeAgentFolder(roots.userDir, 'liar/agent', { id: 'good/agent' });

    const listed = await scanAgents(deps, roots);
    expect(listed.map((a) => a.manifest.id)).toEqual(['good/agent']);
  });

  it('does not list a rotated .bak folder as an agent', async () => {
    await installAgentPackage(await packVersion('1.0.0'), deps, {}, roots);
    await installAgentPackage(await packVersion('2.0.0'), deps, {}, roots);
    const listed = await scanAgents(deps, roots);
    expect(listed).toHaveLength(1);
    expect(listed[0].manifest.version).toBe('2.0.0');
  });

  it('returns an empty list when neither root exists', async () => {
    expect(await scanAgents(deps, roots)).toEqual([]);
  });
});

describe('built-in shadowing', () => {
  it('prefers a higher user version, and the built-in on equal', async () => {
    await writeAgentFolder(roots.builtinDir, 'test/agent', { version: '2.0.0' });

    await installAgentPackage(await packVersion('1.0.0'), deps, {}, roots);
    expect((await scanAgents(deps, roots))[0]).toMatchObject({
      origin: 'builtin',
      manifest: { version: '2.0.0' },
    });

    await installAgentPackage(await packVersion('2.0.0'), deps, {}, roots);
    expect((await scanAgents(deps, roots))[0].origin).toBe('builtin');

    await installAgentPackage(await packVersion('3.0.0'), deps, {}, roots);
    expect((await scanAgents(deps, roots))[0]).toMatchObject({
      origin: 'user',
      manifest: { version: '3.0.0' },
    });
  });

  it('restores the built-in when the user copy is removed', async () => {
    await writeAgentFolder(roots.builtinDir, 'test/agent', { version: '1.0.0' });
    await installAgentPackage(await packVersion('3.0.0'), deps, {}, roots);

    const removed = await removeAgent('test/agent', deps, roots);
    expect(removed.restoredBuiltin?.manifest.version).toBe('1.0.0');
    expect(removed.restoredBuiltin?.origin).toBe('builtin');

    const listed = await scanAgents(deps, roots);
    expect(listed).toHaveLength(1);
    expect(listed[0].origin).toBe('builtin');
    // The `.bak` goes with the removal — "Remove" means gone.
    await expect(fs.stat(path.join(roots.userDir, 'test/agent.bak'))).rejects.toThrow();
  });

  it('refuses to remove a built-in, and says why', async () => {
    await writeAgentFolder(roots.builtinDir, 'test/agent');
    await expect(removeAgent('test/agent', deps, roots)).rejects.toThrow(/ships with the app/);
    expect(await scanAgents(deps, roots)).toHaveLength(1);
  });

  it('reports an id that is installed nowhere', async () => {
    await expect(removeAgent('test/agent', deps, roots)).rejects.toThrow(/not installed/);
  });

  it('refuses an id that is not <namespace>/<name>', async () => {
    await expect(removeAgent('../../etc', deps, roots)).rejects.toThrow(/Invalid agent id/);
  });
});

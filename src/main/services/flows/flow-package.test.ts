// Reading a `.vidtsxflow` (flows plan §1.7, W8 Stage 6) — the agents'
// package tests on the flow manifest: the container, the four signature
// outcomes, and the tamper case (a byte changed in flow.json after signing).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { AGENT_TOOL_IDS } from '../../../shared/agents/tool-ids';
import { openFlowPackage, type FlowPackageDeps } from './flow-package';
import { testKeyPair, writeTestFlowPackage } from './test-flow-package-builder';

let dir: string;

const deps = (extra: Partial<FlowPackageDeps> = {}): FlowPackageDeps => ({
  manifestContext: { appVersion: '1.1.0', toolIds: AGENT_TOOL_IDS },
  ...extra,
});

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-package-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

const pkgPath = (name = 'flow.vidtsxflow'): string => path.join(dir, name);

describe('openFlowPackage — the container', () => {
  it('opens a well-formed package and reads an asset', async () => {
    await writeTestFlowPackage(pkgPath(), { files: { 'assets/ref.txt': 'reference' } });
    const pkg = await openFlowPackage(pkgPath(), deps());
    expect(pkg.manifest.id).toBe('test/flow');
    expect(pkg.signature.status).toBe('unsigned');
    expect((await pkg.read('assets/ref.txt')).toString('utf-8')).toBe('reference');
    expect(pkg.manifestBytes.toString('utf-8')).toContain('"id": "test/flow"');
  });

  it('refuses a manifest that lists an entry the zip does not hold', async () => {
    await writeTestFlowPackage(pkgPath(), {
      mutateManifest: (m) => {
        (m.files as unknown[]).push({ path: 'assets/ghost.png', size: 4, sha256: 'a'.repeat(64) });
      },
    });
    await expect(openFlowPackage(pkgPath(), deps())).rejects.toThrow(/no such entry/);
  });

  it('refuses an under-declared size and a wrong hash', async () => {
    await writeTestFlowPackage(pkgPath('size.vidtsxflow'), {
      files: { 'assets/ref.txt': 'reference' },
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].size = 2;
      },
    });
    await expect(openFlowPackage(pkgPath('size.vidtsxflow'), deps())).rejects.toThrow(/manifest declares/);

    await writeTestFlowPackage(pkgPath('hash.vidtsxflow'), {
      files: { 'assets/ref.txt': 'reference' },
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].sha256 = 'b'.repeat(64);
      },
    });
    const pkg = await openFlowPackage(pkgPath('hash.vidtsxflow'), deps());
    await expect(pkg.read('assets/ref.txt')).rejects.toThrow(/hash/);
    await expect(pkg.extractAll(path.join(dir, 'out'))).rejects.toThrow(/tampered/);
  });

  it('refuses a zip-slip entry path and a stowaway is unreadable', async () => {
    await writeTestFlowPackage(pkgPath('slip.vidtsxflow'), {
      files: { 'assets/ref.txt': 'x' },
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].path = '../evil.txt';
      },
    });
    await expect(openFlowPackage(pkgPath('slip.vidtsxflow'), deps())).rejects.toThrow(/unsafe entry path/);

    await writeTestFlowPackage(pkgPath('stow.vidtsxflow'), { extraEntries: { 'assets/stowaway.txt': 'hi' } });
    const pkg = await openFlowPackage(pkgPath('stow.vidtsxflow'), deps());
    await expect(pkg.read('assets/stowaway.txt')).rejects.toThrow(/not listed/);
  });

  it('refuses a manifest that fails the flow rules, naming every problem', async () => {
    await writeTestFlowPackage(pkgPath(), { manifest: { minAppVersion: '9.9.9', requires: { tools: [], capabilities: [] } } });
    await expect(openFlowPackage(pkgPath(), deps())).rejects.toThrow(/needs VidTSX 9.9.9[\s\S]*requires.tools does not list/);
  });

  it('refuses a file that is not a zip', async () => {
    await fs.writeFile(pkgPath(), 'not a zip');
    await expect(openFlowPackage(pkgPath(), deps())).rejects.toThrow(/not a readable .vidtsxflow/);
  });
});

describe('openFlowPackage — signatures', () => {
  it('verified when the key is a known publisher, signed-unknown otherwise', async () => {
    const key = testKeyPair();
    await writeTestFlowPackage(pkgPath(), { signWith: { privateKeyPem: key.privateKeyPem, keyId: 'acme-1' } });

    const known = await openFlowPackage(
      pkgPath(),
      deps({ publishers: [{ keyId: 'acme-1', name: 'Acme', publicKey: key.publicKeyBase64 }] }),
    );
    expect(known.signature).toEqual({ status: 'verified', keyId: 'acme-1', publisher: 'Acme' });

    const unknown = await openFlowPackage(pkgPath(), deps({ publishers: [] }));
    expect(unknown.signature).toEqual({ status: 'signed-unknown', keyId: 'acme-1' });
    expect(unknown.sideFiles.map((s) => s.name)).toEqual(['signature.json']);
  });

  it('refuses a manifest edited after signing — the tamper case', async () => {
    const key = testKeyPair();
    await writeTestFlowPackage(pkgPath(), {
      signWith: { privateKeyPem: key.privateKeyPem, keyId: 'acme-1' },
      tamperAfterSigning: (m) => {
        m.description = 'A packaged flow, for tests. (edited)';
      },
    });
    await expect(openFlowPackage(pkgPath(), deps())).rejects.toThrow(/does not match its manifest — it is corrupt or was tampered with/);
  });

  it('matches a publisher by key bytes, never by the keyId it claims', async () => {
    const key = testKeyPair();
    const other = testKeyPair();
    await writeTestFlowPackage(pkgPath(), { signWith: { privateKeyPem: key.privateKeyPem, keyId: 'vidtsx-1' } });
    const pkg = await openFlowPackage(
      pkgPath(),
      deps({ publishers: [{ keyId: 'vidtsx-1', name: 'VidTSX', publicKey: other.publicKeyBase64 }] }),
    );
    expect(pkg.signature.status).toBe('signed-unknown');
  });

  it('reads the licensee stamp outside the signature', async () => {
    await writeTestFlowPackage(pkgPath(), { licensee: { name: 'Buyer', orderId: 'o-1' } });
    const pkg = await openFlowPackage(pkgPath(), deps());
    expect(pkg.licensee).toEqual({ name: 'Buyer', orderId: 'o-1', issuedAt: undefined });
  });
});

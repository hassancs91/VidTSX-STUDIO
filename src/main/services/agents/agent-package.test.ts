import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { AGENT_TOOL_IDS } from '../../../shared/agents/tool-ids';
import { ARTIFACT_KINDS, INTERACTION_KINDS } from '../../../shared/types/agents';
import { AGENT_LIMITS } from '../../../shared/agents/manifest';
import { resolvePackageEntry } from '../packages/zip-reader';
import { openAgentPackage, packagedCompositionPaths, type AgentPackageDeps } from './agent-package';
import { testKeyPair, writeTestAgentPackage } from './test-package-builder';

let dir: string;

const deps = (extra: Partial<AgentPackageDeps> = {}): AgentPackageDeps => ({
  manifestContext: {
    appVersion: '1.0.0',
    toolIds: AGENT_TOOL_IDS,
    artifactKinds: ARTIFACT_KINDS,
    interactionKinds: INTERACTION_KINDS,
  },
  ...extra,
});

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-package-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const pkgPath = (name = 'agent.vidtsxagent'): string => path.join(dir, name);

describe('openAgentPackage — the container', () => {
  it('opens a well-formed package', async () => {
    await writeTestAgentPackage(pkgPath());
    const pkg = await openAgentPackage(pkgPath(), deps());
    expect(pkg.manifest.id).toBe('test/agent');
    expect(pkg.signature.status).toBe('unsigned');
    expect((await pkg.read('AGENT.md')).toString('utf-8')).toContain('Test Agent');
  });

  it('refuses a manifest that lists an entry the zip does not hold', async () => {
    await writeTestAgentPackage(pkgPath(), {
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>).push({
          path: 'skills/ghost/SKILL.md',
          size: 4,
          sha256: 'a'.repeat(64),
        });
      },
    });
    await expect(openAgentPackage(pkgPath(), deps())).rejects.toThrow(/no such entry/);
  });

  it('refuses a manifest that under-declares a size (the zip-bomb shape)', async () => {
    await writeTestAgentPackage(pkgPath(), {
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].size = 4;
      },
    });
    await expect(openAgentPackage(pkgPath(), deps())).rejects.toThrow(/manifest declares/);
  });

  it('refuses a manifest whose hash does not match the bytes', async () => {
    await writeTestAgentPackage(pkgPath(), {
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].sha256 = 'b'.repeat(64);
      },
    });
    const pkg = await openAgentPackage(pkgPath(), deps());
    await expect(pkg.read('AGENT.md')).rejects.toThrow(/hash/);
    await expect(pkg.extractAll(path.join(dir, 'out'))).rejects.toThrow(/tampered/);
  });

  it('refuses a zip-slip entry path', async () => {
    await writeTestAgentPackage(pkgPath(), {
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].path = '../evil.md';
      },
    });
    await expect(openAgentPackage(pkgPath(), deps())).rejects.toThrow(/unsafe entry path/);
  });

  it('refuses an absolute or drive-lettered entry path', async () => {
    for (const bad of ['/etc/passwd', 'C:/Windows/system.md', 'skills/../../x.md']) {
      await writeTestAgentPackage(pkgPath('bad.vidtsxagent'), {
        mutateManifest: (m) => {
          (m.files as Array<Record<string, unknown>>)[0].path = bad;
        },
      });
      await expect(openAgentPackage(pkgPath('bad.vidtsxagent'), deps())).rejects.toThrow(
        /unsafe entry path|not listed in files/,
      );
    }
  });

  it('resolves entries only inside the extraction root (the second gate)', () => {
    const root = path.join(dir, 'root');
    expect(resolvePackageEntry(root, 'skills/a/SKILL.md')).toBe(
      path.resolve(root, 'skills/a/SKILL.md'),
    );
    expect(() => resolvePackageEntry(root, '../escape.md')).toThrow(/escapes/);
  });

  it('refuses an oversize entry and an oversize total', async () => {
    await writeTestAgentPackage(pkgPath(), {
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].size = AGENT_LIMITS.maxEntryBytes + 1;
      },
    });
    await expect(openAgentPackage(pkgPath(), deps())).rejects.toThrow(/max 33554432/);

    await writeTestAgentPackage(pkgPath('big.vidtsxagent'), {
      mutateManifest: (m) => {
        const files = m.files as Array<Record<string, unknown>>;
        const one = files[0];
        for (let i = 0; i < 3; i += 1) {
          files.push({ ...one, path: `assets/blob-${i}.bin`, size: AGENT_LIMITS.maxEntryBytes });
        }
        one.size = AGENT_LIMITS.maxEntryBytes;
      },
    });
    await expect(openAgentPackage(pkgPath('big.vidtsxagent'), deps())).rejects.toThrow(
      /bytes total/,
    );
  });

  it('ignores an entry the manifest does not list, and refuses to read it', async () => {
    await writeTestAgentPackage(pkgPath(), {
      extraEntries: { 'stowaway.md': 'never asked for' },
    });
    const pkg = await openAgentPackage(pkgPath(), deps());
    await expect(pkg.read('stowaway.md')).rejects.toThrow(/not listed in the manifest/);

    const out = path.join(dir, 'out');
    await pkg.extractAll(out);
    await expect(fs.stat(path.join(out, 'stowaway.md'))).rejects.toThrow();
  });

  it('refuses a file that is not a package at all', async () => {
    await fs.writeFile(pkgPath(), 'this is not a zip');
    await expect(openAgentPackage(pkgPath(), deps())).rejects.toThrow(/not a readable/);
  });
});

describe('openAgentPackage — manifest rules', () => {
  it('refuses an unknown tool id, and names it', async () => {
    await writeTestAgentPackage(pkgPath(), { manifest: { tools: ['launch_missiles'] } });
    await expect(openAgentPackage(pkgPath(), deps())).rejects.toThrow(/launch_missiles/);
  });

  it('refuses a package that needs a newer app', async () => {
    await writeTestAgentPackage(pkgPath(), { manifest: { minAppVersion: '9.9.9' } });
    await expect(openAgentPackage(pkgPath(), deps())).rejects.toThrow(/needs VidTSX 9\.9\.9/);
  });

  it('refuses Bash', async () => {
    await writeTestAgentPackage(pkgPath(), { manifest: { sdkTools: ['Bash'] } });
    await expect(openAgentPackage(pkgPath(), deps())).rejects.toThrow(/never include "Bash"/);
  });

  it('refuses a manifest that lists signature.json among its files', async () => {
    await writeTestAgentPackage(pkgPath(), {
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>).push({
          path: 'signature.json',
          size: 2,
          sha256: 'c'.repeat(64),
        });
      },
    });
    await expect(openAgentPackage(pkgPath(), deps())).rejects.toThrow(/written by the store/);
  });
});

describe('openAgentPackage — signatures', () => {
  it('reports a known publisher as verified', async () => {
    const key = testKeyPair();
    await writeTestAgentPackage(pkgPath(), {
      signWith: { privateKeyPem: key.privateKeyPem, keyId: 'whatever-they-claim' },
    });
    const pkg = await openAgentPackage(
      pkgPath(),
      deps({
        publishers: [{ keyId: 'vidtsx-1', name: 'VidTSX', publicKey: key.publicKeyBase64 }],
      }),
    );
    expect(pkg.signature).toMatchObject({
      status: 'verified',
      keyId: 'vidtsx-1',
      publisher: 'VidTSX',
    });
  });

  it('reports a valid signature by an unknown key as signed-unknown, and installs it', async () => {
    const key = testKeyPair();
    await writeTestAgentPackage(pkgPath(), {
      signWith: { privateKeyPem: key.privateKeyPem, keyId: 'someone-else' },
    });
    const pkg = await openAgentPackage(pkgPath(), deps({ publishers: [] }));
    expect(pkg.signature).toMatchObject({ status: 'signed-unknown', keyId: 'someone-else' });
  });

  it('does not let a package claim a publisher by naming its keyId', async () => {
    const impostor = testKeyPair();
    const real = testKeyPair();
    await writeTestAgentPackage(pkgPath(), {
      signWith: { privateKeyPem: impostor.privateKeyPem, keyId: 'vidtsx-1' },
    });
    const pkg = await openAgentPackage(
      pkgPath(),
      deps({
        publishers: [{ keyId: 'vidtsx-1', name: 'VidTSX', publicKey: real.publicKeyBase64 }],
      }),
    );
    expect(pkg.signature.status).toBe('signed-unknown');
  });

  it('refuses a package edited after signing', async () => {
    const key = testKeyPair();
    await writeTestAgentPackage(pkgPath(), {
      signWith: { privateKeyPem: key.privateKeyPem, keyId: 'vidtsx-1' },
      tamperAfterSigning: (m) => {
        m.name = 'Definitely Not Tampered';
      },
    });
    await expect(
      openAgentPackage(
        pkgPath(),
        deps({
          publishers: [{ keyId: 'vidtsx-1', name: 'VidTSX', publicKey: key.publicKeyBase64 }],
        }),
      ),
    ).rejects.toThrow(/tampered/);
  });

  it('treats an unsigned package as unsigned, not as refused', async () => {
    await writeTestAgentPackage(pkgPath());
    const pkg = await openAgentPackage(pkgPath(), deps());
    expect(pkg.signature.status).toBe('unsigned');
    expect(pkg.sideFiles).toHaveLength(0);
  });

  it('reads the store licensee stamp without letting it affect trust', async () => {
    const key = testKeyPair();
    await writeTestAgentPackage(pkgPath(), {
      signWith: { privateKeyPem: key.privateKeyPem, keyId: 'vidtsx-1' },
      licensee: { name: 'Hasan', orderId: 'A-1', issuedAt: '2026-09-07' },
    });
    const pkg = await openAgentPackage(pkgPath(), deps({ publishers: [] }));
    expect(pkg.licensee).toEqual({ name: 'Hasan', orderId: 'A-1', issuedAt: '2026-09-07' });
    expect(pkg.signature.status).toBe('signed-unknown');
    expect(pkg.sideFiles.map((f) => f.name)).toEqual(['signature.json', 'licensee.json']);
  });
});

describe('openAgentPackage — the D14 composition gate', () => {
  const TSX = 'export const compositionConfig = {};\n';

  it('gates every assets/**/*.tsx entry', async () => {
    await writeTestAgentPackage(pkgPath(), {
      files: { 'AGENT.md': '# a', 'assets/intro.tsx': TSX, 'assets/notes.md': 'x' },
    });
    const seen: string[] = [];
    await openAgentPackage(
      pkgPath(),
      deps({
        validateComposition: async (code) => {
          seen.push(code);
          return { success: true };
        },
      }),
    );
    expect(seen).toEqual([TSX]);
  });

  it('refuses a package whose TSX does not pass the gate', async () => {
    await writeTestAgentPackage(pkgPath(), {
      files: { 'AGENT.md': '# a', 'assets/broken.tsx': TSX },
    });
    await expect(
      openAgentPackage(
        pkgPath(),
        deps({
          validateComposition: async () => ({ success: false, error: 'compositionConfig missing' }),
        }),
      ),
    ).rejects.toThrow(/assets\/broken\.tsx is not a valid composition/);
  });

  it('selects only TSX under assets/', () => {
    expect(
      packagedCompositionPaths({
        files: [
          { path: 'assets/a.tsx', size: 1, sha256: '' },
          { path: 'assets/deep/b.TSX', size: 1, sha256: '' },
          { path: 'skills/x/example.tsx', size: 1, sha256: '' },
          { path: 'assets/c.md', size: 1, sha256: '' },
        ],
      } as never),
    ).toEqual(['assets/a.tsx', 'assets/deep/b.TSX']);
  });
});

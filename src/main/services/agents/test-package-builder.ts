// TEST-ONLY: build a `.vidtsxagent` on disk (agents plan §5 tests).
//
// Deliberately able to build BAD packages — a manifest that lies about a size,
// an entry the zip does not hold, a `..` path, a signature over a manifest that
// was then edited — because those are the cases the reader exists for. The
// happy path here is also exactly what `scripts/agent-pack.mjs` produces, so a
// change that breaks the packer breaks these tests too.

import archiver from 'archiver';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { signAgentManifest } from './agent-signing';

export interface TestPackageSpec {
  /** Entry path → contents. `AGENT.md` is added when nothing is given. */
  files?: Record<string, string>;
  /** Merged over the default manifest, before `files[]` is computed. */
  manifest?: Record<string, unknown>;
  /** Rewrite `files[]` (or anything else) AFTER it is computed — this is how a
   *  test declares a size or hash that does not match the zip. */
  mutateManifest?: (manifest: Record<string, unknown>) => void;
  /** Sign, then optionally edit the manifest again — the tamper case. */
  signWith?: { privateKeyPem: string; keyId: string };
  tamperAfterSigning?: (manifest: Record<string, unknown>) => void;
  licensee?: unknown;
  /** Entries put in the zip but NOT in `files[]` — the stowaway case. */
  extraEntries?: Record<string, string>;
}

export function testKeyPair(): { privateKeyPem: string; publicKeyBase64: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyBase64: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  };
}

function defaultManifest(): Record<string, unknown> {
  return {
    formatVersion: 1,
    id: 'test/agent',
    name: 'Test Agent',
    version: '1.0.0',
    description: 'A packaged agent, for tests.',
    author: { name: 'Tests' },
    minAppVersion: '1.0.0',
    prompt: 'AGENT.md',
    tools: ['write_document'],
    artifacts: ['document'],
  };
}

const sha256 = (body: string): string =>
  crypto.createHash('sha256').update(Buffer.from(body, 'utf-8')).digest('hex');

/** Write a package and return the manifest object that was packed. */
export async function writeTestAgentPackage(
  destPath: string,
  spec: TestPackageSpec = {},
): Promise<Record<string, unknown>> {
  const files = spec.files ?? { 'AGENT.md': '# Test Agent\n\nDo the thing.\n' };
  const manifest: Record<string, unknown> = {
    ...defaultManifest(),
    ...(spec.manifest ?? {}),
    files: Object.keys(files)
      .sort()
      .map((entryPath) => ({
        path: entryPath,
        size: Buffer.byteLength(files[entryPath], 'utf-8'),
        sha256: sha256(files[entryPath]),
      })),
  };
  spec.mutateManifest?.(manifest);

  const signature = spec.signWith
    ? signAgentManifest(manifest, spec.signWith.privateKeyPem, spec.signWith.keyId)
    : null;
  spec.tamperAfterSigning?.(manifest);

  await fs.mkdir(path.dirname(destPath), { recursive: true });
  const output = createWriteStream(destPath);
  const archive = archiver('zip', { zlib: { level: 0 } });
  const closed = new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(output);

  archive.append(JSON.stringify(manifest, null, 2), { name: 'agent.json' });
  if (signature) archive.append(JSON.stringify(signature), { name: 'signature.json' });
  if (spec.licensee) archive.append(JSON.stringify(spec.licensee), { name: 'licensee.json' });
  for (const [entryPath, body] of Object.entries(files)) {
    archive.append(body, { name: entryPath });
  }
  for (const [entryPath, body] of Object.entries(spec.extraEntries ?? {})) {
    archive.append(body, { name: entryPath });
  }
  await archive.finalize();
  await closed;
  return manifest;
}

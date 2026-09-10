// TEST-ONLY: build a `.vidtsxflow` on disk, including BAD ones on purpose —
// a manifest that lies about a size, a `..` path, a signature over a manifest
// that was then edited (the tamper case). The happy path is what
// `scripts/flow-pack.mjs` produces, so a change that breaks the packer breaks
// these tests too. Mirrors `agents/test-package-builder.ts`.

import archiver from 'archiver';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { signAgentManifest } from '../agents/agent-signing';

export { testKeyPair } from '../agents/test-package-builder';

export interface TestFlowPackageSpec {
  /** Extra entries (assets) → contents. */
  files?: Record<string, string>;
  /** Merged over the default manifest, before `files[]` is computed. */
  manifest?: Record<string, unknown>;
  mutateManifest?: (manifest: Record<string, unknown>) => void;
  signWith?: { privateKeyPem: string; keyId: string };
  tamperAfterSigning?: (manifest: Record<string, unknown>) => void;
  licensee?: unknown;
  /** Entries in the zip but NOT in `files[]` — the stowaway case. */
  extraEntries?: Record<string, string>;
}

/** A two-node flow that every registry has: input_text → generate_text. */
export function testFlowDoc(id = 'test/flow'): Record<string, unknown> {
  return {
    formatVersion: 2,
    id,
    name: 'Test flow',
    description: 'A packaged flow, for tests.',
    params: [
      { id: 'topic', label: 'Topic', kind: 'prompt', required: true, bind: [{ nodeId: 'n-in', key: 'prompt' }] },
    ],
    graph: {
      nodes: [
        { id: 'n-in', toolId: 'input_text', position: { x: 80, y: 80 }, config: { prompt: '' }, pause: false },
        {
          id: 'n-text',
          toolId: 'generate_text',
          position: { x: 480, y: 80 },
          config: { providerId: '', model: '', modelMode: 'default', systemPrompt: 'Answer briefly.' },
          pause: false,
        },
      ],
      edges: [{ id: 'e1', source: 'n-in', sourceHandle: 'text', target: 'n-text', targetHandle: 'prompt' }],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    outputs: [{ nodeId: 'n-text', handle: 'text', label: 'Text' }],
    origin: null,
  };
}

export function defaultFlowManifest(id = 'test/flow'): Record<string, unknown> {
  return {
    ...testFlowDoc(id),
    version: '1.0.0',
    author: { name: 'Tests' },
    minAppVersion: '1.0.0',
    requires: { tools: ['input_text', 'generate_text'], capabilities: [] },
  };
}

const sha256 = (body: string): string => crypto.createHash('sha256').update(Buffer.from(body, 'utf-8')).digest('hex');

/** Write a package and return the manifest object that was packed. */
export async function writeTestFlowPackage(destPath: string, spec: TestFlowPackageSpec = {}): Promise<Record<string, unknown>> {
  const files = spec.files ?? {};
  const manifest: Record<string, unknown> = {
    ...defaultFlowManifest(),
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

  const signature = spec.signWith ? signAgentManifest(manifest, spec.signWith.privateKeyPem, spec.signWith.keyId) : null;
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
  archive.append(JSON.stringify(manifest, null, 2), { name: 'flow.json' });
  if (signature) archive.append(JSON.stringify(signature), { name: 'signature.json' });
  if (spec.licensee) archive.append(JSON.stringify(spec.licensee), { name: 'licensee.json' });
  for (const [entryPath, body] of Object.entries(files)) archive.append(body, { name: entryPath });
  for (const [entryPath, body] of Object.entries(spec.extraEntries ?? {})) archive.append(body, { name: entryPath });
  await archive.finalize();
  await closed;
  return manifest;
}

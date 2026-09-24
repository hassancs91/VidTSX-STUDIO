// TEST-ONLY: build `.vidtsxpack` / `.vidtsxtransition` files on disk, BAD ones
// included on purpose — a size that lies, a hash that lies, a `..` path, a
// stowaway entry, a component that breaks the import rules. The happy path is
// the shape the add-ons builder is to emit (TRANSITION_PACKS_DESIGN.md
// "Import — two extensions"). Mirrors flows/test-flow-package-builder.ts.

import archiver from 'archiver';
import { createWriteStream } from 'fs';
import crypto from 'crypto';

/** A component that clears the import gate. */
export const GOOD_COMPONENT = `import React from 'react';
export default function T({ outgoing, incoming, progress }: { outgoing: React.ReactNode; incoming: React.ReactNode; progress: number }) {
  return <div style={{ position: 'relative' }}>{progress < 0.5 ? outgoing : incoming}</div>;
}
`;

/** A component the gate refuses (a Node import). */
export const BAD_COMPONENT = `import fs from 'fs';
export default function T() { return <div>{String(fs)}</div>; }
`;

export interface TestTransitionPackageSpec {
  /** Entry path → contents. Listed in `files[]` unless in `extraEntries`. */
  files: Record<string, string>;
  /** The manifest minus `files[]`, which is computed. */
  manifest: Record<string, unknown>;
  mutateManifest?: (manifest: Record<string, unknown>) => void;
  /** In the zip, NOT in `files[]` — the stowaway case. */
  extraEntries?: Record<string, string>;
}

const sha256 = (body: string): string => crypto.createHash('sha256').update(Buffer.from(body, 'utf-8')).digest('hex');

export function packManifest(id = 'demo', version = '1.0.0', itemIds = ['wipe', 'slide']): Record<string, unknown> {
  return {
    formatVersion: 1,
    id,
    name: `Demo pack ${id}`,
    version,
    author: 'Tests',
    license: 'MIT',
    transitions: itemIds.map((itemId) => ({
      id: itemId,
      name: itemId.charAt(0).toUpperCase() + itemId.slice(1),
      durationSeconds: 0.6,
      sceneCopies: 'single',
      version,
    })),
  };
}

export function singleManifest(id = 'swirl', version = '1.0.0'): Record<string, unknown> {
  return { formatVersion: 1, id, name: 'Swirl', durationSeconds: 0.8, sceneCopies: 'multi', version, author: 'Tests' };
}

/** Write a package; returns the manifest that was packed. */
export async function writeTestTransitionPackage(
  destPath: string,
  spec: TestTransitionPackageSpec,
): Promise<Record<string, unknown>> {
  const manifest: Record<string, unknown> = {
    ...spec.manifest,
    files: Object.keys(spec.files)
      .sort()
      .map((entryPath) => ({
        path: entryPath,
        size: Buffer.byteLength(spec.files[entryPath], 'utf-8'),
        sha256: sha256(spec.files[entryPath]),
      })),
  };
  spec.mutateManifest?.(manifest);
  const manifestName = destPath.toLowerCase().endsWith('.vidtsxpack') ? 'pack.json' : 'transition.json';

  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(destPath);
    const zip = archiver('zip', { zlib: { level: 6 } });
    out.on('close', () => resolve());
    zip.on('error', reject);
    zip.pipe(out);
    zip.append(JSON.stringify(manifest, null, 2), { name: manifestName });
    for (const [entryPath, body] of Object.entries({ ...spec.files, ...(spec.extraEntries ?? {}) })) {
      zip.append(body, { name: entryPath });
    }
    void zip.finalize();
  });
  return manifest;
}

/** The files of a well-formed pack for `packManifest(…, itemIds)`. */
export function packFiles(itemIds = ['wipe', 'slide'], body = GOOD_COMPONENT): Record<string, string> {
  return Object.fromEntries(itemIds.map((itemId) => [`transitions/${itemId}.tsx`, body]));
}

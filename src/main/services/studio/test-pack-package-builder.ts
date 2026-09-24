// TEST-ONLY: build `.vidtsxpack` / `.vidtsxtransition` / `.vidtsxfilter` files
// on disk, BAD ones included on purpose — a size that lies, a hash that lies,
// a `..` path, a stowaway entry, an item that breaks its kind's rules. The
// happy path is the shape the add-ons builders are to emit
// (TRANSITION_PACKS_DESIGN.md / FILTER_PACKS_DESIGN.md "Import"). Mirrors
// flows/test-flow-package-builder.ts.

import archiver from 'archiver';
import { createWriteStream } from 'fs';
import crypto from 'crypto';
import { PACK_KINDS, PACK_PACKAGE_MANIFEST } from '../../../shared/studio/pack-package';

/** A transition component that clears the import gate. */
export const GOOD_COMPONENT = `import React from 'react';
export default function T({ outgoing, incoming, progress }: { outgoing: React.ReactNode; incoming: React.ReactNode; progress: number }) {
  return <div style={{ position: 'relative' }}>{progress < 0.5 ? outgoing : incoming}</div>;
}
`;

/** A transition component the gate refuses (a Node import). */
export const BAD_COMPONENT = `import fs from 'fs';
export default function T() { return <div>{String(fs)}</div>; }
`;

/** A filter bundle that clears the filter gate: no imports, a default export. */
export const GOOD_FILTER = `var noir = { id: "noir", name: "Noir", defaultIntensity: 1, animated: false, render(f) { f.ctx.filter = "grayscale(1)"; f.ctx.drawImage(f.source, 0, 0); f.ctx.filter = "none"; } };
export { noir as default };
`;

/** A filter bundle the gate refuses (a wall clock). */
export const BAD_FILTER = `export default { id: "x", defaultIntensity: 1, render(f) { f.ctx.drawImage(f.source, Date.now() % 2, 0); } };
`;

export interface TestPackageSpec {
  /** Entry path → contents. Listed in `files[]` unless in `extraEntries`. */
  files: Record<string, string>;
  /** The manifest minus `files[]`, which is computed. */
  manifest: Record<string, unknown>;
  mutateManifest?: (manifest: Record<string, unknown>) => void;
  /** In the zip, NOT in `files[]` — the stowaway case. */
  extraEntries?: Record<string, string>;
}

const sha256 = (body: string): string => crypto.createHash('sha256').update(Buffer.from(body, 'utf-8')).digest('hex');

export function transitionEntries(itemIds: readonly string[], version = '1.0.0'): Array<Record<string, unknown>> {
  return itemIds.map((itemId) => ({
    id: itemId,
    name: itemId.charAt(0).toUpperCase() + itemId.slice(1),
    durationSeconds: 0.6,
    sceneCopies: 'single',
    version,
  }));
}

export function filterEntries(itemIds: readonly string[], version = '1.0.0', extra: Record<string, unknown> = {}): Array<Record<string, unknown>> {
  return itemIds.map((itemId) => ({
    id: itemId,
    name: itemId.charAt(0).toUpperCase() + itemId.slice(1),
    category: 'filter',
    animated: false,
    defaultIntensity: 1,
    version,
    ...extra,
  }));
}

/** A pack manifest with transitions, filters, or both. */
export function packManifest(
  id = 'demo',
  version = '1.0.0',
  itemIds: { transitions?: readonly string[]; filters?: readonly string[] } = { transitions: ['wipe', 'slide'] },
): Record<string, unknown> {
  return {
    formatVersion: 1,
    id,
    name: `Demo pack ${id}`,
    version,
    author: 'Tests',
    license: 'MIT',
    ...(itemIds.transitions ? { transitions: transitionEntries(itemIds.transitions, version) } : {}),
    ...(itemIds.filters ? { filters: filterEntries(itemIds.filters, version) } : {}),
  };
}

export function singleManifest(id = 'swirl', version = '1.0.0'): Record<string, unknown> {
  return { formatVersion: 1, id, name: 'Swirl', durationSeconds: 0.8, sceneCopies: 'multi', version, author: 'Tests' };
}

export function singleFilterManifest(id = 'glow', version = '1.0.0', extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { formatVersion: 1, ...filterEntries([id], version, extra)[0], name: 'Glow', category: 'effect', author: 'Tests' };
}

/** Write a package; returns the manifest that was packed. The manifest's
 *  name follows the file's extension, as the reader expects. */
export async function writeTestPackage(destPath: string, spec: TestPackageSpec): Promise<Record<string, unknown>> {
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
  const lower = destPath.toLowerCase();
  const manifestName = PACK_KINDS.find((k) => lower.endsWith(k.singleExt))?.singleManifest ?? PACK_PACKAGE_MANIFEST;

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

/** The transition files of a well-formed pack for `packManifest(…, { transitions: itemIds })`. */
export function packFiles(itemIds: readonly string[] = ['wipe', 'slide'], body = GOOD_COMPONENT): Record<string, string> {
  return Object.fromEntries(itemIds.map((itemId) => [`transitions/${itemId}.tsx`, body]));
}

/** The filter files of a well-formed pack for `packManifest(…, { filters: itemIds })`. */
export function packFilterFiles(itemIds: readonly string[], body = GOOD_FILTER): Record<string, string> {
  return Object.fromEntries(itemIds.map((itemId) => [`filters/${itemId}.js`, body]));
}

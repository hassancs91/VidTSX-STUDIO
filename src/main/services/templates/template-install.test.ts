// The template importer (docs/templates-plan.md §7), run on real zips: install
// into the user root with `template.json` verbatim, the package-level manifest
// rules, the signature (verified / tampered), the D14 gate on the entry,
// newer / older / `.bak`, and remove — the flows' store rules on templates.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import archiver from 'archiver';
import crypto from 'crypto';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp', isPackaged: false, getAppPath: () => 'C:/tmp', getVersion: () => '1.1.0' },
}));

import { signAgentManifest } from '../agents/agent-signing';
import { testKeyPair } from '../agents/test-package-builder';
import type { TemplatePackageDeps } from './template-package';
import { installTemplatePackage, removeTemplate } from './template-install';
import { scanTemplates, type TemplateStoreRoots } from './template-store';

let dir: string;
let roots: TemplateStoreRoots;
const deps: TemplatePackageDeps = { manifestContext: { appVersion: '1.1.0' } };

const COMPOSITION = [
  "import { AbsoluteFill, Audio, staticFile } from 'remotion';",
  "export const compositionConfig = { id: 'count', durationInFrames: 90, fps: 30, width: 1920, height: 1080 };",
  "export default function Count({ title = 'Hi', tickSound = '' }: { title?: string; tickSound?: string }) {",
  '  return <AbsoluteFill>{title}{tickSound !== "" && <Audio src={staticFile(tickSound)} />}</AbsoluteFill>;',
  '}',
].join('\n');

function manifest(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    formatVersion: 1,
    id: 'acme/count',
    name: 'Count',
    version: '1.0.0',
    author: { name: 'Acme' },
    minAppVersion: '1.1.0',
    category: 'openers',
    entry: 'composition.tsx',
    controls: [
      { key: 'title', label: 'Title', type: 'text', default: 'Hi' },
      { key: 'tickSound', label: 'Tick sound', type: 'audio', default: 'assets/tick.mp3' },
    ],
    ...over,
  };
}

const sha256 = (body: string) => crypto.createHash('sha256').update(Buffer.from(body, 'utf-8')).digest('hex');

interface PackageSpec {
  manifest?: Record<string, unknown>;
  files?: Record<string, string>;
  signWith?: { privateKeyPem: string; keyId: string };
  tamperAfterSigning?: (m: Record<string, unknown>) => void;
}

/** What `scripts/template-pack.mjs` writes: template.json with files[], the files, maybe a signature. */
async function writePackage(name: string, spec: PackageSpec = {}): Promise<string> {
  const files = spec.files ?? { 'composition.tsx': COMPOSITION, 'assets/tick.mp3': 'ID3-not-really-audio' };
  const m: Record<string, unknown> = {
    ...(spec.manifest ?? manifest()),
    files: Object.keys(files).sort().map((p) => ({ path: p, size: Buffer.byteLength(files[p]), sha256: sha256(files[p]) })),
  };
  const signature = spec.signWith ? signAgentManifest(m, spec.signWith.privateKeyPem, spec.signWith.keyId) : null;
  spec.tamperAfterSigning?.(m);
  const dest = path.join(dir, name);
  const output = createWriteStream(dest);
  const archive = archiver('zip', { zlib: { level: 0 } });
  const closed = new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    archive.on('error', reject);
  });
  archive.pipe(output);
  archive.append(JSON.stringify(m, null, 2), { name: 'template.json' });
  if (signature) archive.append(JSON.stringify(signature), { name: 'signature.json' });
  for (const [p, body] of Object.entries(files)) archive.append(body, { name: p });
  await archive.finalize();
  await closed;
  return dest;
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'template-install-'));
  roots = { userDir: path.join(dir, 'user'), builtinDir: path.join(dir, 'builtin') };
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('installTemplatePackage', () => {
  it('installs a user copy with template.json verbatim and its assets, and the scan lists it', async () => {
    const pkg = await writePackage('count.vidtsxtemplate');
    const result = await installTemplatePackage(pkg, deps, {}, roots);
    expect(result.template?.origin).toBe('user');
    expect(result.signature?.status).toBe('unsigned');
    const folder = path.join(roots.userDir, 'acme', 'count');
    expect(await fs.readFile(path.join(folder, 'assets', 'tick.mp3'), 'utf-8')).toBe('ID3-not-really-audio');
    const packed = JSON.parse(await fs.readFile(path.join(folder, 'template.json'), 'utf-8')) as { files: unknown[] };
    expect(packed.files).toHaveLength(2);
    const scanned = await scanTemplates(roots, '1.1.0');
    expect(scanned.map((t) => [t.manifest.id, t.origin])).toEqual([['acme/count', 'user']]);
  });

  it('refuses a package whose files[] misses a sound a default names — nothing is written', async () => {
    const pkg = await writePackage('bad.vidtsxtemplate', { files: { 'composition.tsx': COMPOSITION } });
    await expect(installTemplatePackage(pkg, deps, {}, roots)).rejects.toThrow(
      /"assets\/tick\.mp3" is named by a default or a preset but not listed in files\[\]/,
    );
    await expect(fs.access(roots.userDir)).rejects.toThrow();
  });

  it('runs the D14 gate on the entry and refuses what it rejects', async () => {
    const pkg = await writePackage('gated.vidtsxtemplate');
    const validateComposition = vi.fn(async () => ({ success: false, error: 'Import "lodash" is not allowed' }));
    await expect(installTemplatePackage(pkg, { ...deps, validateComposition }, {}, roots)).rejects.toThrow(
      /composition\.tsx is not a valid composition: Import "lodash" is not allowed/,
    );
    expect(validateComposition).toHaveBeenCalledWith(COMPOSITION);
    await expect(fs.access(path.join(roots.userDir, 'acme', 'count'))).rejects.toThrow();
  });

  it('verifies a signature from a known publisher and refuses a manifest edited after signing', async () => {
    const key = testKeyPair();
    const publishers = [{ keyId: 'acme-1', name: 'Acme', publicKey: key.publicKeyBase64 }];
    const signWith = { privateKeyPem: key.privateKeyPem, keyId: 'acme-1' };
    const good = await writePackage('signed.vidtsxtemplate', { signWith });
    const result = await installTemplatePackage(good, { ...deps, publishers }, {}, roots);
    expect(result.signature).toMatchObject({ status: 'verified', publisher: 'Acme' });
    expect(await fs.readFile(path.join(roots.userDir, 'acme', 'count', 'signature.json'), 'utf-8')).toContain('acme-1');

    const tampered = await writePackage('tampered.vidtsxtemplate', {
      signWith,
      tamperAfterSigning: (m) => { m.name = 'Count (edited)'; },
    });
    await expect(installTemplatePackage(tampered, { ...deps, publishers }, {}, roots)).rejects.toThrow();
  });

  it('newer replaces and rotates the old copy to .bak; older asks first, then installs on confirm', async () => {
    await installTemplatePackage(await writePackage('v1.vidtsxtemplate'), deps, {}, roots);
    await installTemplatePackage(await writePackage('v2.vidtsxtemplate', { manifest: manifest({ version: '1.2.0' }) }), deps, {}, roots);
    const parent = path.join(roots.userDir, 'acme');
    expect((await fs.readdir(parent)).sort()).toEqual(['count', 'count.bak']);
    expect((await scanTemplates(roots, '1.1.0'))[0]?.manifest.version).toBe('1.2.0');

    const older = await writePackage('v0.vidtsxtemplate', { manifest: manifest({ version: '0.9.0' }) });
    expect(await installTemplatePackage(older, deps, {}, roots)).toEqual({ needsConfirm: 'downgrade', installedVersion: '1.2.0' });
    expect((await scanTemplates(roots, '1.1.0'))[0]?.manifest.version).toBe('1.2.0');
    await installTemplatePackage(older, deps, { confirmDowngrade: true }, roots);
    expect((await scanTemplates(roots, '1.1.0'))[0]?.manifest.version).toBe('0.9.0');
  });

  it('refuses a template that needs a newer app', async () => {
    const pkg = await writePackage('future.vidtsxtemplate', { manifest: manifest({ minAppVersion: '9.0.0' }) });
    await expect(installTemplatePackage(pkg, deps, {}, roots)).rejects.toThrow(/needs VidTSX 9\.0\.0/);
  });
});

describe('removeTemplate', () => {
  it('removes the user copy and its .bak', async () => {
    await installTemplatePackage(await writePackage('v1.vidtsxtemplate'), deps, {}, roots);
    await installTemplatePackage(await writePackage('v2.vidtsxtemplate', { manifest: manifest({ version: '2.0.0' }) }), deps, {}, roots);
    await removeTemplate('acme/count', roots);
    expect(await fs.readdir(path.join(roots.userDir, 'acme'))).toEqual([]);
    expect(await scanTemplates(roots, '1.1.0')).toEqual([]);
  });

  it('refuses a built-in, and a template that is not installed', async () => {
    const builtin = path.join(roots.builtinDir, 'vidtsx', 'card');
    await fs.mkdir(builtin, { recursive: true });
    await expect(removeTemplate('vidtsx/card', roots)).rejects.toThrow(/ships with the app/);
    await expect(removeTemplate('acme/nothing', roots)).rejects.toThrow(/not installed/);
  });
});

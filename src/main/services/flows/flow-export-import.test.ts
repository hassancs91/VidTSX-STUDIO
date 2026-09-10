// Export → import round trip (flows plan §0.1 item 4, W8 Stage 6): a user
// flow becomes an unsigned `.vidtsxflow` with a namespaced id, opens through
// the reader byte-identical, installs; a bare flow.json imports as a document
// through the same validator; a manifest with packaged files is refused.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp', isPackaged: false, getAppPath: () => 'C:/tmp', getVersion: () => '1.1.0' },
}));

import { AGENT_TOOL_IDS } from '../../../shared/agents/tool-ids';
import type { FlowDoc } from '../../../shared/types/flows';
import { flowDocOf } from '../../../shared/flows/flow-package';
import { openFlowPackage } from './flow-package';
import {
  UNSIGNED_WARNING,
  buildExportManifest,
  exportFileName,
  importFlowFile,
  importFlowJson,
  packagedIdFor,
  writeFlowPackage,
  type ImportDeps,
} from './flow-export-import';
import { defaultFlowManifest, testFlowDoc, writeTestFlowPackage } from './test-flow-package-builder';

let dir: string;

const ctx = {
  appVersion: '1.1.0',
  author: 'Hasan',
  needsOf: (toolId: string) => (toolId === 'generate_text' ? undefined : toolId === 'generate_image' ? ['image-provider'] : undefined),
};

function importDeps(): ImportDeps {
  return {
    packageDeps: { manifestContext: { appVersion: '1.1.0', toolIds: AGENT_TOOL_IDS } },
    hasTool: (id) => (AGENT_TOOL_IDS as readonly string[]).includes(id),
    roots: { userDir: path.join(dir, 'user'), builtinDir: path.join(dir, 'builtin') },
  };
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-export-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('buildExportManifest', () => {
  it('namespaces a ulid id, fills requires from the graph, ships unsigned with no files', () => {
    const doc = { ...testFlowDoc('01J8ZKEGACYR0W000000000000'), name: 'My Captions Flow!' } as unknown as FlowDoc;
    const manifest = buildExportManifest(doc, ctx);
    expect(manifest.id).toBe('user/my-captions-flow');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.author).toEqual({ name: 'Hasan' });
    expect(manifest.minAppVersion).toBe('1.1.0');
    expect(manifest.requires).toEqual({ tools: ['input_text', 'generate_text'], capabilities: [] });
    expect(manifest.files).toEqual([]);
    expect(manifest.origin).toBeNull();
    expect(exportFileName(doc)).toBe('user.my-captions-flow.vidtsxflow');
  });

  it('keeps a namespaced id and collects the nodes capability gates', () => {
    const doc = testFlowDoc('acme/thing') as unknown as FlowDoc;
    doc.graph.nodes.push({ id: 'n-img', toolId: 'generate_image', position: { x: 0, y: 0 }, config: {}, pause: false });
    expect(packagedIdFor(doc)).toBe('acme/thing');
    expect(buildExportManifest(doc, ctx).requires.capabilities).toEqual(['image-provider']);
  });
});

describe('export → import round trip', () => {
  it('writes a package the reader opens with the same document, then installs it', async () => {
    const doc = testFlowDoc('01J8ZKEGACYR0W000000000000') as unknown as FlowDoc;
    const manifest = buildExportManifest(doc, ctx);
    const out = path.join(dir, exportFileName(doc));
    await writeFlowPackage(manifest, out);

    const pkg = await openFlowPackage(out, importDeps().packageDeps);
    expect(pkg.signature.status).toBe('unsigned');
    expect(flowDocOf(pkg.manifest)).toEqual({ ...doc, id: 'user/test-flow', origin: null });

    const outcome = await importFlowFile(out, importDeps());
    expect(outcome.kind).toBe('installed');
    if (outcome.kind !== 'installed') return;
    expect(outcome.flow.manifest.id).toBe('user/test-flow');
    expect(outcome.warnings).toEqual([UNSIGNED_WARNING]);
    await expect(fs.stat(path.join(dir, 'user', 'user', 'test-flow', 'flow.json'))).resolves.toBeTruthy();
  });

  it('a tampered package is refused at import', async () => {
    const out = path.join(dir, 'tampered.vidtsxflow');
    await writeTestFlowPackage(out, {
      files: { 'assets/a.txt': 'a' },
      mutateManifest: (m) => {
        (m.files as Array<Record<string, unknown>>)[0].sha256 = 'c'.repeat(64);
      },
    });
    await expect(importFlowFile(out, importDeps())).rejects.toThrow(/tampered/);
  });

  it('an older version asks before replacing', async () => {
    const v2 = path.join(dir, 'v2.vidtsxflow');
    const v1 = path.join(dir, 'v1.vidtsxflow');
    await writeTestFlowPackage(v2, { manifest: { version: '2.0.0' } });
    await writeTestFlowPackage(v1, { manifest: { version: '1.0.0' } });
    await importFlowFile(v2, importDeps());
    expect(await importFlowFile(v1, importDeps())).toEqual({ kind: 'needs-confirm', needsConfirm: 'downgrade', installedVersion: '2.0.0' });
    expect((await importFlowFile(v1, { ...importDeps(), confirmDowngrade: true })).kind).toBe('installed');
  });
});

describe('importFlowJson — a bare file through the same validator', () => {
  it('imports a plain FlowDoc as a document', () => {
    const doc = testFlowDoc('01J8ZKEGACYR0W000000000000');
    const outcome = importFlowJson(JSON.stringify(doc), importDeps());
    expect(outcome.kind).toBe('document');
    if (outcome.kind === 'document') expect(outcome.doc.graph.nodes).toHaveLength(2);
  });

  it('imports a manifest without files as a document; refuses one that lists files', () => {
    const outcome = importFlowJson(JSON.stringify(defaultFlowManifest()), importDeps());
    expect(outcome.kind).toBe('document');
    const withFiles = { ...defaultFlowManifest(), files: [{ path: 'assets/a.png', size: 1, sha256: 'a'.repeat(64) }] };
    expect(() => importFlowJson(JSON.stringify(withFiles), importDeps())).toThrow(/import the .vidtsxflow/);
  });

  it('refuses garbage, an unknown tool, a broken graph — with the reason', () => {
    expect(() => importFlowJson('nope', importDeps())).toThrow(/not readable JSON/);
    expect(() => importFlowJson('{"formatVersion":1}', importDeps())).toThrow(/formatVersion 2/);
    const doc = testFlowDoc('01J8ZKEGACYR0W000000000000') as { graph: { nodes: Array<{ toolId: string }> } };
    doc.graph.nodes[1].toolId = 'teleport';
    expect(() => importFlowJson(JSON.stringify(doc), importDeps())).toThrow(/does not have: teleport/);
    const bad = defaultFlowManifest();
    (bad.requires as { tools: string[] }).tools = [];
    expect(() => importFlowJson(JSON.stringify(bad), importDeps())).toThrow(/requires.tools does not list/);
  });

  it('importFlowFile routes .json to the document path and refuses other extensions', async () => {
    const file = path.join(dir, 'flow.json');
    await fs.writeFile(file, JSON.stringify(testFlowDoc('01J8ZKEGACYR0W000000000000')));
    expect((await importFlowFile(file, importDeps())).kind).toBe('document');
    await expect(importFlowFile(path.join(dir, 'x.txt'), importDeps())).rejects.toThrow(/not \.txt/);
  });
});

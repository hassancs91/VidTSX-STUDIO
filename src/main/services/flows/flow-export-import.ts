// Export a flow as `.vidtsxflow`, import a `.vidtsxflow` or a bare
// `flow.json` (flows plan §0.1 item 4, §1.8, W8 Stage 6).
//
// Export is unsigned by design: the app never holds a signing key (agents
// plan §1.6 — `scripts/flow-pack.mjs` signs, offline). A user flow carries a
// ulid; the package needs `<namespace>/<name>`, so export writes it as
// `user/<slug>` — a re-import then installs under Installed, and Duplicate
// makes an editable copy again.
//
// Import routes on the file: a `.vidtsxflow` installs into `<userData>/flows`
// through the store (signature outcome → the warning the toast shows); a
// `.json` goes through the SAME validator — as a manifest when it carries
// the package fields, as a bare document otherwise — and becomes a row of
// source `imported` with a fresh ulid, because a bare file has no folder to
// be the truth of.

import archiver from 'archiver';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { parseAgentId } from '../../../shared/agents/ids';
import {
  FLOW_MANIFEST_NAME,
  FLOW_PACKAGE_EXT,
  FlowManifestError,
  flowDocOf,
  graphToolIds,
  looksLikeFlowManifest,
  parseFlowPackageManifest,
  type FlowPackageManifest,
} from '../../../shared/flows/flow-package';
import { validateFlowDoc } from '../../../shared/flows/validate';
import type { FlowDoc } from '../../../shared/types/flows';
import { slugifyName } from '../agents/tools/workspace-files';
import type { FlowPackageDeps } from './flow-package';
import { installFlowPackage, type FlowStoreRoots, type InstalledFlow } from './flow-store';

export interface ExportContext {
  appVersion: string;
  /** The capability gates a tool carries (`needs`), for `requires.capabilities`. */
  needsOf(toolId: string): readonly string[] | undefined;
  /** The `author.name` — defaults to the OS user name. */
  author?: string;
}

/** A packaged id for any document id: namespaced ids pass, a ulid becomes `user/<slug>`. */
export function packagedIdFor(doc: Pick<FlowDoc, 'id' | 'name'>): string {
  if (parseAgentId(doc.id)) return doc.id;
  return `user/${slugifyName(doc.name, 'flow').slice(0, 64).replace(/-+$/, '') || 'flow'}`;
}

/** The manifest an export writes — pure over the document and the context. */
export function buildExportManifest(doc: FlowDoc, ctx: ExportContext): FlowPackageManifest {
  const tools = graphToolIds(doc);
  const capabilities = new Set<string>();
  for (const tool of tools) for (const need of ctx.needsOf(tool) ?? []) capabilities.add(need);
  return {
    ...doc,
    id: packagedIdFor(doc),
    origin: null,
    version: '1.0.0',
    author: { name: ctx.author ?? os.userInfo().username },
    minAppVersion: ctx.appVersion,
    requires: { tools, capabilities: [...capabilities] },
    files: [],
  };
}

/** Zip the manifest alone (no assets, no signature) at `outPath`. */
export async function writeFlowPackage(manifest: FlowPackageManifest, outPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const output = createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 6 } });
  const closed = new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(output);
  archive.append(JSON.stringify(manifest, null, 2), { name: FLOW_MANIFEST_NAME });
  await archive.finalize();
  await closed;
}

/** The default file name for an export: `<namespace>.<name>.vidtsxflow`. */
export function exportFileName(doc: Pick<FlowDoc, 'id' | 'name'>): string {
  return `${packagedIdFor(doc).replace('/', '.')}${FLOW_PACKAGE_EXT}`;
}

// ─── Import ─────────────────────────────────────────────────────────────────

export const UNSIGNED_WARNING = 'This flow is unsigned — VidTSX has not reviewed it. It runs with your providers and credits.';
export const UNVERIFIED_WARNING = 'This flow is signed by an unverified publisher. It runs with your providers and credits.';

export type ImportOutcome =
  | { kind: 'installed'; flow: InstalledFlow; warnings: string[] }
  | { kind: 'document'; doc: FlowDoc; warnings: string[] }
  | { kind: 'needs-confirm'; needsConfirm: 'downgrade'; installedVersion: string };

export function warningsFor(signature: InstalledFlow['signature']): string[] {
  if (signature === 'unsigned') return [UNSIGNED_WARNING];
  if (signature === 'signed-unknown') return [UNVERIFIED_WARNING];
  return [];
}

export interface ImportDeps {
  packageDeps: FlowPackageDeps;
  /** Unknown-tool check for a bare document (the manifest path checks through the context). */
  hasTool(toolId: string): boolean;
  roots?: FlowStoreRoots;
  confirmDowngrade?: boolean;
}

function problems(err: unknown): string {
  if (err instanceof FlowManifestError) return `This flow cannot be imported:\n${err.problems.map((p) => `• ${p}`).join('\n')}`;
  return err instanceof Error ? err.message : String(err);
}

/** A bare `.json`: a manifest (package fields) or a plain FlowDoc, through the same rules. */
export function importFlowJson(text: string, deps: ImportDeps): ImportOutcome {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error('That file is not readable JSON.');
  }
  if (looksLikeFlowManifest(raw)) {
    let manifest: FlowPackageManifest;
    try {
      manifest = parseFlowPackageManifest(raw, deps.packageDeps.manifestContext);
    } catch (err) {
      throw new Error(problems(err));
    }
    if (manifest.files.length > 0) {
      throw new Error('This flow.json lists packaged files — import the .vidtsxflow it came from, or pack the folder first.');
    }
    return { kind: 'document', doc: flowDocOf(manifest), warnings: [] };
  }
  if (typeof raw !== 'object' || raw === null || (raw as { formatVersion?: unknown }).formatVersion !== 2) {
    throw new Error('That file is not a flow: expected a flow.json with formatVersion 2.');
  }
  const doc = raw as FlowDoc;
  const structural = validateFlowDoc(doc, { requireNodes: true });
  if (!structural.ok) {
    throw new Error(`This flow cannot be imported:\n${structural.errors.map((e) => `• ${e.message}`).join('\n')}`);
  }
  const unknown = graphToolIds(doc).filter((t) => !deps.hasTool(t));
  if (unknown.length > 0) throw new Error(`This flow uses tools this app does not have: ${unknown.join(', ')}.`);
  return { kind: 'document', doc, warnings: [] };
}

/** A file on disk: `.vidtsxflow` installs, `.json` becomes a document. */
export async function importFlowFile(filePath: string, deps: ImportDeps): Promise<ImportOutcome> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === FLOW_PACKAGE_EXT) {
    const result = await installFlowPackage(
      filePath,
      deps.packageDeps,
      { ...(deps.confirmDowngrade ? { confirmDowngrade: true } : {}) },
      deps.roots,
    );
    if (result.needsConfirm) {
      return { kind: 'needs-confirm', needsConfirm: result.needsConfirm, installedVersion: result.installedVersion ?? '?' };
    }
    if (!result.flow) throw new Error('The flow installed but could not be read back.');
    return { kind: 'installed', flow: result.flow, warnings: warningsFor(result.flow.signature) };
  }
  if (ext === '.json') return importFlowJson(await fs.readFile(filePath, 'utf-8'), deps);
  throw new Error(`Import a ${FLOW_PACKAGE_EXT} package or a flow.json — not ${ext || 'a file without an extension'}.`);
}

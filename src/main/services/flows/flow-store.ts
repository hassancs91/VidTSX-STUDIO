// Installed flows on disk (flows plan §1.7, W8 Stage 6) — the agents'
// `agent-store.ts` with the flow manifest in place of the agent one.
//
// **Folder-as-truth.** `<root>/<namespace>/<name>/flow.json` is the store;
// listing walks two levels. A folder that does not parse is skipped with a
// warning so one bad flow cannot hide the others. The SQLite row a packaged
// flow gets (`flow-catalog.ts`) is a cache of this folder, never the source.
//
// **Two roots, highest version wins.** Built-ins ship in `resources/flows`
// (read-only, inside the signed installer, no signature of their own); user
// installs live under `<userData>/flows`. Same id in both → the higher
// version, equal prefers the built-in (agents plan §1.6).
//
// **Installs are rename-swaps.** Extract to a staging sibling, rotate the live
// folder to `.bak`, rename staging in. A crash leaves the old flow or the new
// one, never half of each.

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logEngine } from '../../../logging/log-engine';
import { compareAgentVersions } from '../../../shared/agents/manifest';
import { agentDirSegments, parseAgentId } from '../../../shared/agents/ids';
import { FLOW_MANIFEST_NAME, parseFlowPackageManifest, type FlowPackageManifest } from '../../../shared/flows/flow-package';
import type { AgentSignatureStatus } from '../../../shared/types/agents';
import { getBuiltinFlowsDir, getFlowsDir } from '../../utils/paths';
import { PackageReadError } from '../packages/zip-reader';
import {
  AGENT_SIGNATURE_NAME,
  AgentSignatureError,
  parseSignatureFile,
  verifyAgentSignature,
} from '../agents/agent-signing';
import { openFlowPackage, type FlowPackageDeps } from './flow-package';

const log = logEngine.createLogger('FlowStore');

export interface FlowStoreRoots {
  /** userData — writable; installs and removes act here only. */
  userDir: string;
  /** resources — read-only built-ins. */
  builtinDir: string;
}

export function defaultFlowRoots(): FlowStoreRoots {
  return { userDir: getFlowsDir(), builtinDir: getBuiltinFlowsDir() };
}

/** A packaged flow as the app found it on disk. */
export interface InstalledFlow {
  manifest: FlowPackageManifest;
  origin: 'builtin' | 'user';
  dir: string;
  signature: AgentSignatureStatus;
  keyId?: string;
  publisher?: string;
  /** Set when the folder lives inside an agent package (`flows/<name>/`, decision 10). */
  viaAgent?: { id: string; name: string };
}

async function readJson(file: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8')) as unknown;
  } catch {
    return null;
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read one folder, or null when it is not a usable flow. The signature is
 * re-verified on every read (a few hundred bytes of ed25519); the per-file
 * hashes were checked as the bytes landed at install time.
 */
export async function readFlowFolder(
  dir: string,
  origin: 'builtin' | 'user',
  deps: FlowPackageDeps,
  options: { checkFolderName?: boolean } = {},
): Promise<InstalledFlow | null> {
  const raw = await readJson(path.join(dir, FLOW_MANIFEST_NAME));
  if (raw === null) return null;
  try {
    const manifest = parseFlowPackageManifest(raw, deps.manifestContext);
    if (options.checkFolderName !== false) {
      const [namespace, name] = agentDirSegments(manifest.id);
      if (path.basename(path.dirname(dir)) !== namespace || path.basename(dir) !== name) {
        log.warn('Flow folder does not match its id — skipping', { dir, id: manifest.id });
        return null;
      }
    }
    const signatureRaw = await readJson(path.join(dir, AGENT_SIGNATURE_NAME));
    const signatureFile = signatureRaw === null ? null : parseSignatureFile(signatureRaw);
    if (signatureRaw !== null && !signatureFile) {
      log.warn('Flow signature.json is unreadable — skipping', { dir });
      return null;
    }
    const outcome = verifyAgentSignature(raw, signatureFile, deps.publishers);
    return {
      manifest,
      origin,
      dir,
      signature: outcome.status,
      ...(outcome.keyId ? { keyId: outcome.keyId } : {}),
      ...(outcome.publisher ? { publisher: outcome.publisher } : {}),
    };
  } catch (err) {
    const reason = err instanceof AgentSignatureError ? err.message : String(err);
    log.warn('Skipping unusable flow folder', { dir, reason });
    return null;
  }
}

async function listDirs(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function scanRoot(root: string, origin: 'builtin' | 'user', deps: FlowPackageDeps): Promise<InstalledFlow[]> {
  const found: InstalledFlow[] = [];
  for (const namespace of await listDirs(root)) {
    for (const name of await listDirs(path.join(root, namespace))) {
      if (!parseAgentId(`${namespace}/${name}`)) continue;
      const flow = await readFlowFolder(path.join(root, namespace, name), origin, deps);
      if (flow) found.push(flow);
    }
  }
  return found;
}

/** Every usable packaged flow, shadowing resolved, sorted by name. */
export async function scanFlows(deps: FlowPackageDeps, roots: FlowStoreRoots = defaultFlowRoots()): Promise<InstalledFlow[]> {
  const builtins = await scanRoot(roots.builtinDir, 'builtin', deps);
  const users = await scanRoot(roots.userDir, 'user', deps);
  const byId = new Map<string, InstalledFlow>();
  for (const flow of builtins) byId.set(flow.manifest.id, flow);
  for (const flow of users) {
    const builtin = byId.get(flow.manifest.id);
    if (builtin && compareAgentVersions(flow.manifest.version, builtin.manifest.version) <= 0) continue;
    byId.set(flow.manifest.id, flow);
  }
  return [...byId.values()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

export interface InstallFlowOptions {
  confirmDowngrade?: boolean;
}

export interface InstallFlowResult {
  flow?: InstalledFlow;
  needsConfirm?: 'downgrade';
  installedVersion?: string;
}

async function installedVersionAt(dir: string): Promise<string | null> {
  const raw = await readJson(path.join(dir, FLOW_MANIFEST_NAME));
  if (raw === null || typeof raw !== 'object') return null;
  const version = (raw as Record<string, unknown>).version;
  return typeof version === 'string' ? version : null;
}

/** Install (or replace) a user copy from a package file. Built-ins are never written. */
export async function installFlowPackage(
  filePath: string,
  deps: FlowPackageDeps,
  options: InstallFlowOptions = {},
  roots: FlowStoreRoots = defaultFlowRoots(),
): Promise<InstallFlowResult> {
  const pkg = await openFlowPackage(filePath, deps);
  const [namespace, name] = agentDirSegments(pkg.manifest.id);
  const parent = path.join(roots.userDir, namespace);
  const target = path.join(parent, name);
  const backup = path.join(parent, `${name}.bak`);

  const current = await installedVersionAt(target);
  if (current && compareAgentVersions(pkg.manifest.version, current) < 0 && !options.confirmDowngrade) {
    return { needsConfirm: 'downgrade', installedVersion: current };
  }

  await fs.mkdir(parent, { recursive: true });
  const staging = path.join(parent, `.staging-${name}-${crypto.randomBytes(4).toString('hex')}`);
  try {
    await pkg.extractAll(staging);
    // `flow.json` describes the other entries and the side files sit outside
    // the allowlist — none of them is extracted; all are copied VERBATIM.
    await fs.writeFile(path.join(staging, FLOW_MANIFEST_NAME), pkg.manifestBytes);
    for (const side of pkg.sideFiles) await fs.writeFile(path.join(staging, side.name), side.body);

    if (current) {
      await fs.rm(backup, { recursive: true, force: true });
      await fs.rename(target, backup);
    }
    try {
      await fs.rename(staging, target);
    } catch (err) {
      if (current && (await exists(backup))) await fs.rename(backup, target);
      throw err;
    }
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }

  const flow = await readFlowFolder(target, 'user', deps);
  if (!flow) throw new PackageReadError('The flow installed but could not be read back.');
  log.info('Installed flow', { id: flow.manifest.id, version: flow.manifest.version });
  return { flow };
}

export interface RemoveFlowResult {
  restoredBuiltin?: InstalledFlow;
}

/** Remove the USER copy of a flow, with its `.bak`. Built-ins are read-only. */
export async function removeFlow(
  flowId: string,
  deps: FlowPackageDeps,
  roots: FlowStoreRoots = defaultFlowRoots(),
): Promise<RemoveFlowResult> {
  const [namespace, name] = agentDirSegments(flowId);
  const target = path.join(roots.userDir, namespace, name);
  if (!(await exists(target))) {
    const builtinDir = path.join(roots.builtinDir, namespace, name);
    throw new PackageReadError(
      (await exists(builtinDir)) ? 'This flow ships with the app and cannot be removed.' : 'That flow is not installed.',
    );
  }
  await fs.rm(target, { recursive: true, force: true });
  await fs.rm(path.join(roots.userDir, namespace, `${name}.bak`), { recursive: true, force: true });
  log.info('Removed flow', { id: flowId });
  const builtin = await readFlowFolder(path.join(roots.builtinDir, namespace, name), 'builtin', deps);
  return builtin ? { restoredBuiltin: builtin } : {};
}

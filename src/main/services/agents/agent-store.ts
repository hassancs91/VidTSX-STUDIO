// Installed agents on disk (agents plan §1.5, §1.6).
//
// **Folder-as-truth.** There is no index file to fall out of sync: the store IS
// `<root>/<namespace>/<name>/agent.json`, and listing means walking two levels
// and parsing what is there. A folder that does not parse is skipped with a
// warning rather than failing the list — one bad agent must not hide the
// others.
//
// **Two roots, highest version wins.** Built-ins ship with the app and are
// read-only; user installs live under userData. When the same id exists in
// both, the higher version is used and an equal version prefers the built-in
// (§1.6), which is what makes "install a newer copy from a file, then get the
// built-in back by removing it" work without any special casing.
//
// **Installs are rename-swaps, never in-place writes.** The package is
// extracted to a sibling staging folder, the live folder is rotated to `.bak`,
// and staging is renamed into place. A crash mid-install therefore leaves
// either the old agent or the new one, never half of each — and `.bak` is the
// one rotated copy the plan allows.

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logEngine } from '../../../logging/log-engine';
import {
  AGENT_MANIFEST_NAME,
  compareAgentVersions,
  parseAgentManifest,
} from '../../../shared/agents/manifest';
import { agentDirSegments, parseAgentId } from '../../../shared/agents/ids';
import type { InstalledAgent } from '../../../shared/types/agents';
import { getAgentsDir, getBuiltinAgentsDir } from '../../utils/paths';
import { PackageReadError } from '../packages/zip-reader';
import {
  AGENT_LICENSEE_NAME,
  AGENT_SIGNATURE_NAME,
  AgentSignatureError,
  parseSignatureFile,
  verifyAgentSignature,
} from './agent-signing';
import { openAgentPackage, type AgentPackageDeps } from './agent-package';

const log = logEngine.createLogger('AgentStore');

export interface AgentStoreRoots {
  /** userData — writable; installs and removes act here only. */
  userDir: string;
  /** resources — read-only built-ins. */
  builtinDir: string;
}

export function defaultAgentRoots(): AgentStoreRoots {
  return { userDir: getAgentsDir(), builtinDir: getBuiltinAgentsDir() };
}

async function readJson(file: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8')) as unknown;
  } catch {
    return null;
  }
}

/**
 * Read one installed folder, or null when it is not a usable agent.
 *
 * The signature is re-verified from `signature.json` on every read: it is a
 * few hundred bytes of ed25519 and it is what the trust tag claims. The per-FILE
 * hashes are not re-checked here — they were verified as each byte landed at
 * install time, and re-hashing a tree on every list would make the Agents page
 * pay for a guarantee the extraction already gave.
 */
export async function readAgentFolder(
  dir: string,
  origin: 'builtin' | 'user',
  deps: AgentPackageDeps,
): Promise<InstalledAgent | null> {
  const raw = await readJson(path.join(dir, AGENT_MANIFEST_NAME));
  if (raw === null) return null;

  try {
    const manifest = parseAgentManifest(raw, deps.manifestContext);
    // The folder must be the one the id names, or every path later built from
    // the id would point somewhere else.
    const [namespace, name] = agentDirSegments(manifest.id);
    if (path.basename(path.dirname(dir)) !== namespace || path.basename(dir) !== name) {
      log.warn('Agent folder does not match its id — skipping', { dir, id: manifest.id });
      return null;
    }

    const signatureRaw = await readJson(path.join(dir, AGENT_SIGNATURE_NAME));
    const signatureFile = signatureRaw === null ? null : parseSignatureFile(signatureRaw);
    if (signatureRaw !== null && !signatureFile) {
      log.warn('Agent signature.json is unreadable — skipping', { dir });
      return null;
    }
    // `raw`, not `manifest`: the signature covers the bytes the publisher
    // wrote, which is also what the installer copied into this folder.
    const outcome = verifyAgentSignature(raw, signatureFile, deps.publishers);

    // A built-in has no signature and needs none — it is inside the signed
    // installer already. Its `signature` therefore reads `unsigned`, and the
    // UI must let `origin: 'builtin'` outrank the trust tag (§1.7) rather than
    // labelling a shipped agent "Unverified".
    return {
      manifest,
      origin,
      dir,
      signature: outcome.status,
      ...(outcome.keyId ? { keyId: outcome.keyId } : {}),
    };
  } catch (err) {
    const reason = err instanceof AgentSignatureError ? err.message : String(err);
    log.warn('Skipping unusable agent folder', { dir, reason });
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

/** Walk one root two levels deep. `.bak` and `.staging-*` siblings fail the id
 *  grammar, so they are skipped by the same check that validates real folders. */
async function scanRoot(
  root: string,
  origin: 'builtin' | 'user',
  deps: AgentPackageDeps,
): Promise<InstalledAgent[]> {
  const found: InstalledAgent[] = [];
  for (const namespace of await listDirs(root)) {
    for (const name of await listDirs(path.join(root, namespace))) {
      if (!parseAgentId(`${namespace}/${name}`)) continue;
      const agent = await readAgentFolder(path.join(root, namespace, name), origin, deps);
      if (agent) found.push(agent);
    }
  }
  return found;
}

/** Every usable agent, shadowing resolved, sorted by display name. */
export async function scanAgents(
  deps: AgentPackageDeps,
  roots: AgentStoreRoots = defaultAgentRoots(),
): Promise<InstalledAgent[]> {
  const builtins = await scanRoot(roots.builtinDir, 'builtin', deps);
  const users = await scanRoot(roots.userDir, 'user', deps);

  const byId = new Map<string, InstalledAgent>();
  for (const agent of builtins) byId.set(agent.manifest.id, agent);
  for (const agent of users) {
    const builtin = byId.get(agent.manifest.id);
    // Equal versions prefer the built-in (§1.6): a user copy of the same
    // version adds nothing, and preferring it would hide the shipped one.
    if (builtin && compareAgentVersions(agent.manifest.version, builtin.manifest.version) <= 0) {
      continue;
    }
    byId.set(agent.manifest.id, agent);
  }
  return [...byId.values()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

export interface InstallAgentOptions {
  /** The user answered yes to the downgrade prompt. */
  confirmDowngrade?: boolean;
}

export interface InstallAgentResult {
  agent?: InstalledAgent;
  /** Install stopped and wants an explicit yes first. */
  needsConfirm?: 'downgrade';
  /** The version currently installed, when `needsConfirm` is set. */
  installedVersion?: string;
}

async function installedVersionAt(dir: string): Promise<string | null> {
  const raw = await readJson(path.join(dir, AGENT_MANIFEST_NAME));
  if (raw === null || typeof raw !== 'object') return null;
  const version = (raw as Record<string, unknown>).version;
  return typeof version === 'string' ? version : null;
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
 * Install (or replace) a user copy of an agent from a package file.
 *
 * Built-ins are never written: installing an id that also ships built-in makes
 * a user copy, and shadowing in `scanAgents` decides which one is used.
 */
export async function installAgentPackage(
  filePath: string,
  deps: AgentPackageDeps,
  options: InstallAgentOptions = {},
  roots: AgentStoreRoots = defaultAgentRoots(),
): Promise<InstallAgentResult> {
  const pkg = await openAgentPackage(filePath, deps);
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
    // `agent.json` describes the other entries and so is not one of them, and
    // the side files sit outside the manifest allowlist — `extractAll` writes
    // none of the three. All are copied VERBATIM, because the folder must
    // re-derive the same signature outcome on every later scan.
    await fs.writeFile(path.join(staging, AGENT_MANIFEST_NAME), pkg.manifestBytes);
    for (const side of pkg.sideFiles) {
      await fs.writeFile(path.join(staging, side.name), side.body);
    }

    if (current) {
      await fs.rm(backup, { recursive: true, force: true });
      await fs.rename(target, backup);
    }
    try {
      await fs.rename(staging, target);
    } catch (err) {
      // The swap failed with the live folder already moved aside — put it back
      // rather than leaving the user with no agent at all.
      if (current && (await exists(backup))) await fs.rename(backup, target);
      throw err;
    }
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }

  const agent = await readAgentFolder(target, 'user', deps);
  if (!agent) {
    throw new PackageReadError('The agent installed but could not be read back.');
  }
  log.info('Installed agent', { id: agent.manifest.id, version: agent.manifest.version });
  return { agent };
}

export interface RemoveAgentResult {
  /** The built-in that reappears now the user copy is gone. */
  restoredBuiltin?: InstalledAgent;
}

/** Remove the USER copy of an agent, with its `.bak`. Built-ins are read-only. */
export async function removeAgent(
  agentId: string,
  deps: AgentPackageDeps,
  roots: AgentStoreRoots = defaultAgentRoots(),
): Promise<RemoveAgentResult> {
  const [namespace, name] = agentDirSegments(agentId);
  const target = path.join(roots.userDir, namespace, name);
  if (!(await exists(target))) {
    const builtinDir = path.join(roots.builtinDir, namespace, name);
    throw new PackageReadError(
      (await exists(builtinDir))
        ? 'This agent ships with the app and cannot be removed.'
        : 'That agent is not installed.',
    );
  }
  await fs.rm(target, { recursive: true, force: true });
  await fs.rm(path.join(roots.userDir, namespace, `${name}.bak`), { recursive: true, force: true });
  log.info('Removed agent', { id: agentId });

  const builtin = await readAgentFolder(
    path.join(roots.builtinDir, namespace, name),
    'builtin',
    deps,
  );
  return builtin ? { restoredBuiltin: builtin } : {};
}

export { AGENT_LICENSEE_NAME, AGENT_SIGNATURE_NAME };

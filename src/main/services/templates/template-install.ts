// Installing and removing USER templates (docs/templates-plan.md §7) — the
// flows' `flow-store.ts` install, with the template store's roots.
//
// **Installs are rename-swaps.** Extract to a staging sibling, rotate the live
// folder to `.bak`, rename staging in. A crash leaves the old template or the
// new one, never half of each. Built-ins are never written: a user copy of the
// same id with a higher version shadows the built-in (template-store.ts).

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { compareAgentVersions } from '../../../shared/agents/manifest';
import { agentDirSegments } from '../../../shared/agents/ids';
import { TEMPLATE_MANIFEST_NAME } from '../../../shared/templates/manifest';
import type { InstalledTemplate } from '../../../shared/types/templates';
import type { SignatureOutcome } from '../agents/agent-signing';
import { openTemplatePackage, PackageReadError, type TemplatePackageDeps } from './template-package';
import { defaultTemplateRoots, readTemplateFolder, type TemplateStoreRoots } from './template-store';

const log = logEngine.createLogger('TemplateInstall');

export interface InstallTemplateOptions {
  /** Replace an installed copy with an OLDER version. */
  confirmDowngrade?: boolean;
}

export interface InstallTemplateResult {
  template?: InstalledTemplate;
  signature?: SignatureOutcome;
  needsConfirm?: 'downgrade';
  installedVersion?: string;
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function installedVersionAt(dir: string): Promise<string | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(dir, TEMPLATE_MANIFEST_NAME), 'utf-8')) as unknown;
    const version = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).version : undefined;
    return typeof version === 'string' ? version : null;
  } catch {
    return null;
  }
}

/** Install (or replace) a user copy from a `.vidtsxtemplate` file. */
export async function installTemplatePackage(
  filePath: string,
  deps: TemplatePackageDeps,
  options: InstallTemplateOptions = {},
  roots: TemplateStoreRoots = defaultTemplateRoots(),
): Promise<InstallTemplateResult> {
  const pkg = await openTemplatePackage(filePath, deps);
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
    // `template.json` and the side files sit outside the allowlist: copied VERBATIM.
    await fs.writeFile(path.join(staging, TEMPLATE_MANIFEST_NAME), pkg.manifestBytes);
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

  const template = await readTemplateFolder(target, 'user', deps.manifestContext.appVersion);
  if (!template) throw new PackageReadError('The template installed but could not be read back.');
  log.info('Installed template', { id: template.manifest.id, version: template.manifest.version, signature: pkg.signature.status });
  return { template, signature: pkg.signature };
}

/** Remove the USER copy of a template, with its `.bak`. Built-ins are read-only. */
export async function removeTemplate(id: string, roots: TemplateStoreRoots = defaultTemplateRoots()): Promise<void> {
  const [namespace, name] = agentDirSegments(id);
  const target = path.join(roots.userDir, namespace, name);
  if (!(await exists(target))) {
    throw new PackageReadError(
      (await exists(path.join(roots.builtinDir, namespace, name)))
        ? 'This template ships with the app and cannot be removed.'
        : 'That template is not installed.',
    );
  }
  await fs.rm(target, { recursive: true, force: true });
  await fs.rm(path.join(roots.userDir, namespace, `${name}.bak`), { recursive: true, force: true });
  log.info('Removed template', { id });
}

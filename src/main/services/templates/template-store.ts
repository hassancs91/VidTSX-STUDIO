// Installed templates on disk (docs/templates-plan.md §3) — the flows'
// `flow-store.ts` scan with the template manifest in place of the flow one.
//
// **Folder-as-truth.** `<root>/<namespace>/<name>/template.json` is the store;
// listing walks two levels. A folder that does not parse is skipped with a
// warning so one bad template cannot hide the others.
//
// **Two roots, highest version wins.** Built-ins ship in `resources/templates`
// (read-only, inside the signed installer); user installs live under
// `<userData>/templates`. Same id in both → the higher version, equal prefers
// the built-in.
//
// Install, remove and signature checks arrive with the importer (plan §7); the
// scan is written so that adding them is `flow-store.ts` again, not a rewrite.

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { logEngine } from '../../../logging/log-engine';
import { compareAgentVersions } from '../../../shared/agents/manifest';
import { agentDirSegments, parseAgentId } from '../../../shared/agents/ids';
import { TEMPLATE_MANIFEST_NAME, parseTemplateManifest } from '../../../shared/templates/manifest';
import type { InstalledTemplate } from '../../../shared/types/templates';
import { getBuiltinTemplatesDir, getTemplatesDir } from '../../utils/paths';

const log = logEngine.createLogger('TemplateStore');

export interface TemplateStoreRoots {
  /** userData — writable; installs and removes will act here only. */
  userDir: string;
  /** resources — read-only built-ins. */
  builtinDir: string;
}

export function defaultTemplateRoots(): TemplateStoreRoots {
  return { userDir: getTemplatesDir(), builtinDir: getBuiltinTemplatesDir() };
}

async function listDirs(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/** Read one folder, or null when it is not a usable template. */
export async function readTemplateFolder(
  dir: string,
  origin: 'builtin' | 'user',
  appVersion: string | undefined,
): Promise<InstalledTemplate | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(path.join(dir, TEMPLATE_MANIFEST_NAME), 'utf-8')) as unknown;
  } catch {
    return null;
  }
  try {
    const manifest = parseTemplateManifest(raw, appVersion ? { appVersion } : {});
    const [namespace, name] = agentDirSegments(manifest.id);
    if (path.basename(path.dirname(dir)) !== namespace || path.basename(dir) !== name) {
      log.warn('Template folder does not match its id — skipping', { dir, id: manifest.id });
      return null;
    }
    await fs.access(path.join(dir, manifest.entry));
    return { manifest, origin, dir };
  } catch (err) {
    log.warn('Skipping unusable template folder', { dir, reason: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function scanRoot(root: string, origin: 'builtin' | 'user', appVersion: string | undefined): Promise<InstalledTemplate[]> {
  const found: InstalledTemplate[] = [];
  for (const namespace of await listDirs(root)) {
    for (const name of await listDirs(path.join(root, namespace))) {
      if (!parseAgentId(`${namespace}/${name}`)) continue;
      const template = await readTemplateFolder(path.join(root, namespace, name), origin, appVersion);
      if (template) found.push(template);
    }
  }
  return found;
}

/** Every usable template, shadowing resolved, sorted by name. */
export async function scanTemplates(
  roots: TemplateStoreRoots = defaultTemplateRoots(),
  appVersion: string | undefined = app.getVersion(),
): Promise<InstalledTemplate[]> {
  const builtins = await scanRoot(roots.builtinDir, 'builtin', appVersion);
  const users = await scanRoot(roots.userDir, 'user', appVersion);
  const byId = new Map<string, InstalledTemplate>();
  for (const template of builtins) byId.set(template.manifest.id, template);
  for (const template of users) {
    const builtin = byId.get(template.manifest.id);
    if (builtin && compareAgentVersions(template.manifest.version, builtin.manifest.version) <= 0) continue;
    byId.set(template.manifest.id, template);
  }
  return [...byId.values()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

export async function findTemplate(
  id: string,
  roots: TemplateStoreRoots = defaultTemplateRoots(),
  appVersion: string | undefined = app.getVersion(),
): Promise<InstalledTemplate | null> {
  if (!parseAgentId(id)) return null;
  return (await scanTemplates(roots, appVersion)).find((t) => t.manifest.id === id) ?? null;
}

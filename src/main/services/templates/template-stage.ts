// A template's WORKING COPY (docs/templates-plan.md §4).
//
// `<userData>/template-work/<namespace>/<name>/` holds what the Creator
// previews and renders from:
//
//   <name>-<format>.tsx   the entry, with the format's canvas written into
//                         `compositionConfig` and `staticFile(` routed onto the
//                         local asset server (shared/templates/stage-source.ts)
//   assets/               a copy of the template's bundled artwork
//   values.json           what the user has set — autosaved, per template
//
// The install folder is never touched: a built-in lives in `resources/`, which
// is read-only in an installed app, and the render writes its wrapper beside
// the entry. One file per format, so each format keeps its own render history
// and switching back is a no-op.

import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { agentDirSegments } from '../../../shared/agents/ids';
import { stageTemplateSource } from '../../../shared/templates/stage-source';
import { resolveFormat } from '../../../shared/templates/values';
import type { InstalledTemplate, TemplateSavedState } from '../../../shared/types/templates';
import { getTemplateWorkDir } from '../../utils/paths';

const log = logEngine.createLogger('TemplateStage');

const ASSETS_DIR = 'assets';
const VALUES_FILE = 'values.json';

export function templateWorkDir(id: string, workRoot: string = getTemplateWorkDir()): string {
  return path.join(workRoot, ...agentDirSegments(id));
}

/** Write only when the bytes differ — an unchanged file keeps its transpile cache entry. */
async function writeIfChanged(file: string, content: string): Promise<void> {
  try {
    if ((await fs.readFile(file, 'utf-8')) === content) return;
  } catch {
    // Missing — fall through and write it.
  }
  await fs.writeFile(file, content, 'utf-8');
}

/** Mirror `src` into `dest`, copying a file only when its size or mtime says it changed. */
async function syncDir(src: string, dest: string): Promise<void> {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(src, { withFileTypes: true });
  } catch {
    return; // The template ships no artwork.
  }
  await fs.mkdir(dest, { recursive: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await syncDir(from, to);
      continue;
    }
    if (!entry.isFile()) continue;
    const source = await fs.stat(from);
    const existing = await fs.stat(to).catch(() => null);
    if (existing && existing.size === source.size && existing.mtimeMs >= source.mtimeMs) continue;
    await fs.copyFile(from, to);
  }
}

export interface StagedTemplate {
  /** Absolute path of the staged entry — what the preview loads and the render bundles. */
  entryPath: string;
  workDir: string;
  /** The format that was applied, after falling back from a stale value. */
  format: string | null;
}

/** Stage `template` for `formatValue` and return the entry to load. */
export async function stageTemplate(
  template: InstalledTemplate,
  formatValue: string | undefined,
  workRoot: string = getTemplateWorkDir(),
): Promise<StagedTemplate> {
  const { manifest, dir } = template;
  const workDir = templateWorkDir(manifest.id, workRoot);
  await fs.mkdir(workDir, { recursive: true });

  const format = resolveFormat(manifest, formatValue);
  const source = await fs.readFile(path.join(dir, manifest.entry), 'utf-8');
  const staged = stageTemplateSource(source, {
    canvas: format ? { width: format.width, height: format.height } : null,
    assetDir: workDir,
  });
  if (staged === null) {
    throw new Error(`${manifest.entry} has no plain "export const compositionConfig = { … };" to size for ${format?.label ?? 'this format'}.`);
  }

  const [, name] = agentDirSegments(manifest.id);
  const entryPath = path.join(workDir, format ? `${name}-${format.value}.tsx` : `${name}.tsx`);
  await writeIfChanged(entryPath, staged);
  await syncDir(path.join(dir, ASSETS_DIR), path.join(workDir, ASSETS_DIR));

  log.debug('Staged template', { id: manifest.id, entryPath });
  return { entryPath, workDir, format: format?.value ?? null };
}

/** The user's autosaved state, or null when there is none (or it is unreadable). */
export async function loadTemplateState(id: string, workRoot: string = getTemplateWorkDir()): Promise<TemplateSavedState | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(templateWorkDir(id, workRoot), VALUES_FILE), 'utf-8')) as unknown;
    if (typeof raw !== 'object' || raw === null) return null;
    const doc = raw as Partial<TemplateSavedState>;
    if (typeof doc.values !== 'object' || doc.values === null) return null;
    return {
      templateVersion: typeof doc.templateVersion === 'string' ? doc.templateVersion : '0.0.0',
      ...(typeof doc.format === 'string' ? { format: doc.format } : {}),
      // Values are re-validated against the manifest by `resolveValues` on load.
      values: doc.values,
    };
  } catch {
    return null;
  }
}

export async function saveTemplateState(
  id: string,
  state: TemplateSavedState,
  workRoot: string = getTemplateWorkDir(),
): Promise<void> {
  const workDir = templateWorkDir(id, workRoot);
  await fs.mkdir(workDir, { recursive: true });
  // Write-then-rename: a crash mid-save leaves the old state, never half a file.
  const target = path.join(workDir, VALUES_FILE);
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state, null, 2), 'utf-8');
  await fs.rename(temp, target);
}

import { readdir, readFile } from 'fs/promises';
import path from 'path';
import type { SkillManifest } from '@shared/types/skills';
import { getSkillsDir } from '../utils/paths';
import { logEngine } from '../../logging/log-engine';

const logger = logEngine.createLogger('Skills');

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

let cache: Map<string, SkillManifest> | null = null;

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) meta[key] = value;
  }
  return { meta, body: match[2].trimStart() };
}

async function listFolderResources(folderPath: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs, rel);
      } else if (entry.isFile() && !(prefix === '' && entry.name === 'SKILL.md')) {
        results.push(rel);
      }
    }
  }
  await walk(folderPath, '');
  return results.sort();
}

async function loadFolderSkill(
  id: string,
  folderPath: string,
): Promise<SkillManifest | null> {
  const skillMdPath = path.join(folderPath, 'SKILL.md');
  let raw: string;
  try {
    raw = await readFile(skillMdPath, 'utf-8');
  } catch {
    return null;
  }
  const { meta, body } = parseFrontmatter(raw);
  if (!meta.name || !meta.description) {
    logger.warn(`Skill ${id} (folder) missing required frontmatter (name, description) — skipped`);
    return null;
  }
  let resources: string[] = [];
  try {
    resources = await listFolderResources(folderPath);
  } catch (err) {
    logger.warn(`Failed to list resources for skill ${id}`, { err: String(err) });
  }
  return {
    id,
    name: meta.name,
    description: meta.description,
    whenToUse: meta.when_to_use,
    body,
    filePath: skillMdPath,
    resourcesDir: folderPath,
    resources,
  };
}

async function loadFlatSkill(
  id: string,
  filePath: string,
): Promise<SkillManifest | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err) {
    logger.warn(`Failed to read skill ${id}`, { err: String(err) });
    return null;
  }
  const { meta, body } = parseFrontmatter(raw);
  if (!meta.name || !meta.description) {
    logger.warn(`Skill ${id} missing required frontmatter (name, description) — skipped`);
    return null;
  }
  return {
    id,
    name: meta.name,
    description: meta.description,
    whenToUse: meta.when_to_use,
    body,
    filePath,
  };
}

async function loadAll(): Promise<Map<string, SkillManifest>> {
  if (cache) return cache;
  const next = new Map<string, SkillManifest>();
  const dir = getSkillsDir();

  let entries: { name: string; isDir: boolean; isFile: boolean }[];
  try {
    const dirents = await readdir(dir, { withFileTypes: true });
    entries = dirents.map((d) => ({ name: d.name, isDir: d.isDirectory(), isFile: d.isFile() }));
  } catch (err) {
    logger.warn(`Skills directory not readable at ${dir}`, { err: String(err) });
    cache = next;
    return next;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;

    if (entry.isDir) {
      const id = entry.name;
      const skill = await loadFolderSkill(id, path.join(dir, entry.name));
      if (skill) {
        if (next.has(id)) {
          logger.warn(`Duplicate skill ID ${id} (folder vs flat) — folder wins`);
        }
        next.set(id, skill);
      }
    } else if (entry.isFile && entry.name.endsWith('.md')) {
      const id = entry.name.slice(0, -3);
      if (next.has(id)) continue;
      const skill = await loadFlatSkill(id, path.join(dir, entry.name));
      if (skill) next.set(id, skill);
    }
  }

  cache = next;
  return next;
}

export async function listSkills(): Promise<SkillManifest[]> {
  const map = await loadAll();
  return Array.from(map.values());
}

export async function loadSkill(id: string): Promise<SkillManifest | null> {
  const map = await loadAll();
  return map.get(id) ?? null;
}

export async function composeSystemPrompt(
  basePrompt: string,
  skillIds: string[],
  /** Appended AFTER the skill sections — the cache-cheapest position, since
   *  editing it (e.g. agent memory) never re-writes the skill text out of
   *  the cached prompt prefix (AGENT_MEMORY_DESIGN.md §Rev 2.5). */
  trailing?: string,
): Promise<string> {
  const sections: string[] = [];
  if (skillIds.length > 0) {
    const map = await loadAll();
    for (const id of skillIds) {
      const skill = map.get(id);
      if (!skill) {
        logger.warn(`Skill not found: ${id}`);
        continue;
      }
      sections.push(`## Skill: ${skill.name}\n\n${skill.body}`);
    }
  }
  if (trailing) sections.push(trailing);
  if (sections.length === 0) return basePrompt;
  return `${basePrompt}\n\n---\n\n${sections.join('\n\n')}`;
}

export async function readSkillResource(
  id: string,
  relativePath: string,
): Promise<string | null> {
  const skill = await loadSkill(id);
  if (!skill || !skill.resourcesDir) {
    logger.warn(`readSkillResource: skill ${id} has no resources directory`);
    return null;
  }
  const resolved = path.resolve(skill.resourcesDir, relativePath);
  const baseResolved = path.resolve(skill.resourcesDir);
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    logger.warn(`readSkillResource: path traversal attempt blocked for ${id}: ${relativePath}`);
    return null;
  }
  try {
    return await readFile(resolved, 'utf-8');
  } catch (err) {
    logger.warn(`readSkillResource: failed to read ${id}/${relativePath}`, { err: String(err) });
    return null;
  }
}

export function clearSkillCache(): void {
  cache = null;
}
